'use strict';

const { advanceAgreementDraftAnalysis } = require('./analysis-runner');
const { createAnthropicProductModel } = require('./anthropic-model');
const { ProductPhase3Store } = require('./phase-3-store');
const {
  ANTHROPIC_API_PROVIDER_ID, CLAUDE_CLI_PROVIDER_ID, DEEPSEEK_API_PROVIDER_ID, assertConfiguredRunModelConfig, configuredProductModelConfig, hostedModelConfigFor, isHostedProvider,
} = require('./product-model-config');
const { getProductActor, ProductRequestAuthError, requireSameOriginMutation } = require('./request-auth');
const { keepSandboxAlive, wakeSandboxProductRun } = require('./sandbox-wake');
const { assignSandboxForRun, runSandbox, sandboxPoolNames } = require('./sandbox-pool');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const { legalSchemaForVersion } = require('./legal-schema-selection');

function createProductRunHandler({
  getClient,
  storeFactory = (client) => new ProductPhase3Store({ client }),
  modelFactory = createAnthropicProductModel,
  actorResolver = getProductActor,
  modelConfigResolver = configuredProductModelConfig,
  wakeRun = wakeSandboxProductRun,
  keepAlive = keepSandboxAlive,
  // The pool of worker sandboxes a hosted run is placed on (plan finding
  // (140)); one constant, lib/product/sandbox-pool.js.
  sandboxPool = sandboxPoolNames(),
  databaseUrlResolver = () => process.env.SUPABASE_URL,
  serviceRoleKeyResolver = () => process.env.SUPABASE_SERVICE_ROLE_KEY,
  claudeOauthTokenResolver = () => process.env.PRODUCT_CLAUDE_CODE_OAUTH_TOKEN || null,
  // Work package 3: the API key set on the preview environment by Ben.
  anthropicApiKeyResolver = () => process.env.ANTHROPIC_API_KEY || null,
  // Work package 11: the workspace id an organisation-level key needs
  // (plan finding (70)); optional, never logged.
  anthropicWorkspaceIdResolver = () => process.env.ANTHROPIC_WORKSPACE_ID || null,
  // 2026-10-23: the DeepSeek key, passed only for a DeepSeek run.
  deepseekApiKeyResolver = () => process.env.DEEPSEEK_API_KEY || null,
} = {}) {
  return async function productRunHandler(req, res) {
    // Work package 37 (plan finding (250)): whether this request has already
    // applied an operator retry. A retry that committed and a read after it
    // that timed out is an applied retry, not a failed one.
    let retryApplied = false;
    // Whether the request's own work is done and only its reply remains: a
    // failure past this point is a read failure, not a failure to advance.
    let buildingReply = false;
    let store = null;
    res.setHeader('Cache-Control', 'private, no-store');
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const runId = Array.isArray(req.query?.id) ? req.query.id[0] : req.query?.id;
    if (!UUID.test(runId || '')) return res.status(400).json({ error: 'Invalid analysis run ID' });
    try {
      requireSameOriginMutation(req);
      const actor = await actorResolver(req);
      const client = getClient();
      if (!client) return res.status(500).json({ error: 'Product database is not configured' });
      store = storeFactory(client);
      await store.assertAccess({ runId, actor });
      // Work package 8: { keepalive: true } resumes the worker sandbox and
      // gives its session MINIMUM_SESSION_MS again without launching a
      // worker (a generation outlives the session the wake created). The
      // live worker, if any, is untouched; nothing else changes.
      // Plan finding (140): the keepalive goes to the sandbox the run owns.
      // A run without a live assignment (never woken, or finished) has no
      // sandbox to keep alive and the answer says so, in the same 200 the
      // monitor reads each check.
      if (req.body?.keepalive === true) {
        const pooled = typeof store.getRunSandbox === 'function';
        const placement = pooled ? await runSandbox(store, runId) : null;
        if (pooled && !(placement && placement.live)) {
          return res.status(200).json({ run_id: runId, execution_mode: 'HOSTED', keepalive: { state: 'NOT_ASSIGNED', sandbox_name: null, released: placement } });
        }
        const keepalive = await keepAlive(placement ? { sandboxName: placement.sandbox_name } : {});
        return res.status(200).json({ run_id: runId, execution_mode: 'HOSTED', keepalive: { state: placement ? 'ASSIGNED' : 'UNPOOLED', ...keepalive } });
      }
      // An operator frees an abandoned run's sandbox (a PARTIAL run nobody
      // will wake again) so another run can take it; nothing is launched.
      if (req.body?.release_sandbox === true) {
        if (typeof store.releaseRunSandbox !== 'function') return res.status(409).json({ error: 'PRODUCT_SANDBOX_POOL_UNAVAILABLE' });
        const released = await store.releaseRunSandbox({ runId, reason: `OPERATOR:${actor}`.slice(0, 120) });
        return res.status(200).json({ run_id: runId, execution_mode: 'HOSTED', released });
      }
      if (req.body?.retry === true) {
        if (typeof req.body.idempotency_key !== 'string') return res.status(400).json({ error: 'Retry idempotency key is required' });
        // Work package 39 (the review of 2026-10-25, finding 5):
        // product_phase3_retry_run answers a READY run, or a key already
        // spent, with the run unchanged; that is not a retry applied, and
        // the route must not say it was.
        const beforeRetry = typeof store.getRun === 'function' ? await store.getRun(runId) : null;
        const retried = await store.retryRun({ runId, actor, idempotencyKey: req.body.idempotency_key });
        const afterRetry = retried && typeof retried === 'object' && typeof retried.status === 'string'
          ? retried
          : (typeof store.getRun === 'function' ? await store.getRun(runId) : null);
        retryApplied = Boolean(beforeRetry && afterRetry
          && (beforeRetry.status !== afterRetry.status || beforeRetry.stage !== afterRetry.stage));
      }
      // A run chosen onto a hosted provider at intake (work package 3) is
      // driven on that provider whatever the environment's default; the
      // environment decides only for a run that names no hosted provider.
      const run = typeof store.getRun === 'function' ? await store.getRun(runId) : null;
      const runProvider = run?.model_config?.provider_id;
      const expectedModelConfig = isHostedProvider(runProvider) ? hostedModelConfigFor(runProvider, run) : modelConfigResolver();
      if (isHostedProvider(expectedModelConfig.provider_id)) {
        assertConfiguredRunModelConfig(run, expectedModelConfig);
        // The run's sandbox: the one it owns, else a free one of the pool
        // (BUSY throws PRODUCT_SANDBOX_POOL_BUSY, answered below); a run
        // that is READY or FAILED owns none and nothing is launched for it.
        const assignment = await assignSandboxForRun({ store, runId, pool: sandboxPool });
        const sandbox = { sandbox_name: assignment.sandbox_name, state: assignment.state, sandboxes: assignment.sandboxes };
        if (assignment.state === 'RUN_ENDED') {
          buildingReply = true;
          return res.status(202).json({ ...await store.getAgreementAnalysis(runId), execution_mode: 'HOSTED', wake_command_id: null, sandbox });
        }
        let wake;
        try {
          wake = await wakeRun({
            runId,
            databaseUrl: databaseUrlResolver(),
            serviceRoleKey: serviceRoleKeyResolver(),
            providerId: expectedModelConfig.provider_id,
            sandboxName: assignment.sandbox_name,
            ...(expectedModelConfig.provider_id === CLAUDE_CLI_PROVIDER_ID ? { claudeOauthToken: claudeOauthTokenResolver() } : {}),
            ...(expectedModelConfig.provider_id === ANTHROPIC_API_PROVIDER_ID
              ? { anthropicApiKey: anthropicApiKeyResolver(), anthropicWorkspaceId: anthropicWorkspaceIdResolver() } : {}),
            ...(expectedModelConfig.provider_id === DEEPSEEK_API_PROVIDER_ID
              ? { deepseekApiKey: deepseekApiKeyResolver() } : {}),
          });
        } catch (error) {
          // A gone sandbox holds no worker: the run's ownership ends so its
          // next wake takes another sandbox while the operator recreates
          // this one.
          if (error?.code === 'PRODUCT_SANDBOX_GONE' && assignment.state !== 'UNPOOLED' && typeof store.releaseRunSandbox === 'function') {
            await store.releaseRunSandbox({ runId, reason: 'SANDBOX_GONE' }).catch((releaseError) => console.error('[product-run] release after gone:', String(releaseError?.message || releaseError).slice(0, 200)));
          }
          throw error;
        }
        buildingReply = true;
        return res.status(202).json({
          ...await store.getAgreementAnalysis(runId),
          execution_mode: 'HOSTED',
          wake_command_id: wake.command_id,
          sandbox,
        });
      }
      const legalSchema = legalSchemaForVersion(run?.schema_version);
      const analysis = await advanceAgreementDraftAnalysis({
        runId, store, legalSchema, model: modelFactory(), workerId: `web:${actor}`,
      });
      buildingReply = true;
      return res.status(200).json(analysis);
    } catch (error) {
      // Always on the deployment log, whatever the answer: the 202 branch
      // below used to swallow a genuine failure without a trace (the
      // review of 2026-10-25, finding 6).
      console.error('[product-run]', error);
      if (error instanceof ProductRequestAuthError) return res.status(error.code === 'CSRF_REQUIRED' ? 403 : 401).json({ error: error.code });
      // A sandbox that no longer resumes is an operator matter, not a
      // model-configuration one: the response names the code (work
      // package 4, plan finding (49)).
      if (error?.code === 'PRODUCT_SANDBOX_GONE') return res.status(503).json({ error: 'PRODUCT_SANDBOX_GONE', ...(error.sandbox_name ? { sandbox_name: error.sandbox_name } : {}) });
      // Every sandbox of the pool is held by a live run (plan finding
      // (140)): the code and the holders, so the intake and a script can
      // say which runs to wait for; nothing was launched and the run keeps
      // its state for a later wake.
      if (error?.code === 'PRODUCT_SANDBOX_POOL_BUSY') {
        res.setHeader('Retry-After', '300');
        return res.status(503).json({ error: 'PRODUCT_SANDBOX_POOL_BUSY', sandboxes: error.sandboxes || [] });
      }
      if (/ANTHROPIC_API_KEY|DEEPSEEK_API_KEY|PRODUCT_SANDBOX|PRODUCT_MODEL_PROVIDER/.test(error?.message || '')) {
        // The code of the configuration failure goes to the deployment log
        // (never a value): generation 8's first wake, 2026-10-18, answered
        // 503 with nothing in the log to say which check had failed.
        console.error('[product-run] not configured:', String(error?.code || error?.message || error).slice(0, 200));
        return res.status(503).json({ error: 'Product analysis model is not configured' });
      }
      if (/access denied/i.test(error?.message || '')) return res.status(404).json({ error: 'Analysis run not found' });
      // The retry has been applied (its idempotency key is spent) and the
      // request's own work is done: only the read that builds the reply
      // failed, so the retry must not be reported as a failure. Apogee
      // 88d4032a, 2026-10-23: the route answered 500 because it assembles
      // the run's full read to build its reply and that read timed out,
      // while the retry itself had worked and the run was READY minutes
      // later. A failure BEFORE that read (the advance itself, a write) is
      // not this case and stays a 500 below (the review of 2026-10-25,
      // finding 6).
      if (retryApplied && buildingReply) {
        let run = null;
        try { run = typeof store?.getRun === 'function' ? await store.getRun(runId) : null; } catch { run = null; }
        return res.status(202).json({
          run_id: runId, retry_applied: true,
          status: run?.status || null, stage: run?.stage || null,
          code: error?.code || null,
          warning: 'RETRY_APPLIED_READ_INCOMPLETE',
        });
      }
      return res.status(500).json({ error: 'Product analysis could not advance' });
    }
  };
}

module.exports = { createProductRunHandler };
