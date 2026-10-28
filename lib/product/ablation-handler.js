'use strict';

// Work package E2 (implementer E; the manager, 2026-10-19 02:55 UTC): the
// ablation job through the deployment's own wake path. A sibling of the run
// route (lib/product/run-handler.js), never part of it: the run route is
// implementer D's worker path and nothing here touches a run, a sandbox of
// the run pool or the product tables.
//
//   POST /api/product/ablation   Authorization: Bearer <PRODUCT_INTERNAL_TOKEN>
//     { run_id, sections: ["3.19","5.2","5.17"], variants: ["baseline","format"], sandbox_name?, provider?, loops? }
//       -> 202 { job: { job_id, job_dir, run_id, sandbox_name, provider_id, sections, variants, command_id } }
//     { status: true, job_id?, sandbox_name? }
//       -> 200 { status: { job_id, job_dir, jobs, state, exit_code, log_tail, table } }
//
// The internal bearer token alone opens the route (a browser session does
// not: the job spends subscription capacity or credit and the operator
// runs it on purpose). The sandbox is the experiments sandbox unless a
// known one is named; the provider is the subscription CLI unless the body
// names the API. The route passes the credential the provider needs the
// way the run route does, from the deployment's environment, and returns
// none of it.

const { ABLATION_VARIANTS } = require('./cost-ablation');
const { ANTHROPIC_API_PROVIDER_ID, CLAUDE_CLI_PROVIDER_ID } = require('./product-model-config');
const { ProductRequestAuthError, internalBearerActor } = require('./request-auth');
const { ABLATION_SANDBOX_NAME, isKnownSandboxName, readSandboxAblationStatus, wakeSandboxAblation } = require('./sandbox-wake');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SECTION_REFERENCE = /^[A-Za-z0-9][A-Za-z0-9.()_-]{0,39}$/;
const PROVIDERS = Object.freeze([CLAUDE_CLI_PROVIDER_ID, ANTHROPIC_API_PROVIDER_ID]);

function list(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map((item) => item.trim()).filter(Boolean);
  return [];
}

function createProductAblationHandler({
  actorResolver = (req) => internalBearerActor(req),
  wakeAblation = wakeSandboxAblation,
  readStatus = readSandboxAblationStatus,
  // The product database, as the run route (finding (289)).
  databaseUrlResolver = () => process.env.PRODUCT_SUPABASE_URL || process.env.SUPABASE_URL,
  serviceRoleKeyResolver = () => process.env.PRODUCT_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  claudeOauthTokenResolver = () => process.env.PRODUCT_CLAUDE_CODE_OAUTH_TOKEN || null,
  anthropicApiKeyResolver = () => process.env.ANTHROPIC_API_KEY || null,
  anthropicWorkspaceIdResolver = () => process.env.ANTHROPIC_WORKSPACE_ID || null,
  defaultProvider = CLAUDE_CLI_PROVIDER_ID,
  now = Date.now,
} = {}) {
  return async function productAblationHandler(req, res) {
    res.setHeader('Cache-Control', 'private, no-store');
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    try {
      const actor = await actorResolver(req);
      if (!actor) return res.status(401).json({ error: 'PRODUCT_INTERNAL_TOKEN_REQUIRED' });
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const sandboxName = body.sandbox_name === undefined ? ABLATION_SANDBOX_NAME : body.sandbox_name;
      if (!isKnownSandboxName(sandboxName)) return res.status(400).json({ error: 'PRODUCT_SANDBOX_NAME_INVALID' });
      if (body.status === true) {
        const jobId = body.job_id === undefined || body.job_id === null ? null : String(body.job_id);
        const status = await readStatus({ sandboxName, jobId });
        return res.status(200).json({ actor, status });
      }
      const runId = typeof body.run_id === 'string' ? body.run_id : '';
      if (!UUID.test(runId)) return res.status(400).json({ error: 'PRODUCT_ABLATION_RUN_ID_INVALID' });
      const sections = list(body.sections);
      if (sections.length === 0 || sections.some((item) => !SECTION_REFERENCE.test(item))) return res.status(400).json({ error: 'PRODUCT_ABLATION_SECTIONS_INVALID' });
      const variants = list(body.variants);
      const unknown = variants.filter((name) => !ABLATION_VARIANTS[name]);
      if (variants.length === 0 || unknown.length) return res.status(400).json({ error: 'PRODUCT_ABLATION_VARIANTS_INVALID', unknown, known: Object.keys(ABLATION_VARIANTS) });
      const providerId = body.provider === undefined ? defaultProvider : body.provider;
      // Plan finding (193): sections at once on the sandbox; 1 unless the body asks.
      const loops = body.loops === undefined ? 1 : Number(body.loops);
      if (!Number.isInteger(loops) || loops < 1 || loops > 16) return res.status(400).json({ error: 'PRODUCT_ABLATION_LOOPS_INVALID' });
      if (!PROVIDERS.includes(providerId)) return res.status(400).json({ error: 'PRODUCT_ABLATION_PROVIDER_INVALID', known: PROVIDERS });
      const job = await wakeAblation({
        runId, sections, variants, providerId, sandboxName, now, loops,
        databaseUrl: databaseUrlResolver(),
        serviceRoleKey: serviceRoleKeyResolver(),
        ...(providerId === CLAUDE_CLI_PROVIDER_ID ? { claudeOauthToken: claudeOauthTokenResolver() } : {}),
        ...(providerId === ANTHROPIC_API_PROVIDER_ID ? { anthropicApiKey: anthropicApiKeyResolver(), anthropicWorkspaceId: anthropicWorkspaceIdResolver() } : {}),
      });
      return res.status(202).json({ actor, job });
    } catch (error) {
      if (error instanceof ProductRequestAuthError) return res.status(401).json({ error: error.code });
      if (error?.code === 'PRODUCT_SANDBOX_GONE') return res.status(503).json({ error: 'PRODUCT_SANDBOX_GONE', ...(error.sandbox_name ? { sandbox_name: error.sandbox_name } : {}) });
      if (/PRODUCT_ABLATION_(JOB_ID|SECTIONS|VARIANTS)_INVALID/.test(error?.message || '')) return res.status(400).json({ error: String(error.message).split(':')[0] });
      if (/PRODUCT_SANDBOX|ANTHROPIC_API_KEY|PRODUCT_MODEL_PROVIDER/.test(error?.message || '')) {
        console.error('[product-ablation] not configured:', String(error?.code || error?.message || error).slice(0, 200));
        return res.status(503).json({ error: 'Product ablation is not configured' });
      }
      console.error('[product-ablation]', error);
      return res.status(500).json({ error: 'Product ablation could not start' });
    }
  };
}

module.exports = { PROVIDERS, createProductAblationHandler };
