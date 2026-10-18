'use strict';

const { advanceAgreementDraftAnalysis } = require('./analysis-runner');
const { createAnthropicProductModel } = require('./anthropic-model');
const { ProductPhase3Store } = require('./phase-3-store');
const {
  ANTHROPIC_API_PROVIDER_ID, CLAUDE_CLI_PROVIDER_ID, assertConfiguredRunModelConfig, configuredProductModelConfig, hostedModelConfigFor, isHostedProvider,
} = require('./product-model-config');
const { getProductActor, ProductRequestAuthError, requireSameOriginMutation } = require('./request-auth');
const { wakeSandboxProductRun } = require('./sandbox-wake');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const { legalSchemaForVersion } = require('./legal-schema-selection');

function createProductRunHandler({
  getClient,
  storeFactory = (client) => new ProductPhase3Store({ client }),
  modelFactory = createAnthropicProductModel,
  actorResolver = getProductActor,
  modelConfigResolver = configuredProductModelConfig,
  wakeRun = wakeSandboxProductRun,
  databaseUrlResolver = () => process.env.SUPABASE_URL,
  serviceRoleKeyResolver = () => process.env.SUPABASE_SERVICE_ROLE_KEY,
  claudeOauthTokenResolver = () => process.env.PRODUCT_CLAUDE_CODE_OAUTH_TOKEN || null,
  // Work package 3: the API key set on the preview environment by Ben.
  anthropicApiKeyResolver = () => process.env.ANTHROPIC_API_KEY || null,
} = {}) {
  return async function productRunHandler(req, res) {
    res.setHeader('Cache-Control', 'private, no-store');
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const runId = Array.isArray(req.query?.id) ? req.query.id[0] : req.query?.id;
    if (!UUID.test(runId || '')) return res.status(400).json({ error: 'Invalid analysis run ID' });
    try {
      requireSameOriginMutation(req);
      const actor = await actorResolver(req);
      const client = getClient();
      if (!client) return res.status(500).json({ error: 'Product database is not configured' });
      const store = storeFactory(client);
      await store.assertAccess({ runId, actor });
      if (req.body?.retry === true) {
        if (typeof req.body.idempotency_key !== 'string') return res.status(400).json({ error: 'Retry idempotency key is required' });
        await store.retryRun({ runId, actor, idempotencyKey: req.body.idempotency_key });
      }
      // A run chosen onto a hosted provider at intake (work package 3) is
      // driven on that provider whatever the environment's default; the
      // environment decides only for a run that names no hosted provider.
      const run = typeof store.getRun === 'function' ? await store.getRun(runId) : null;
      const runProvider = run?.model_config?.provider_id;
      const expectedModelConfig = isHostedProvider(runProvider) ? hostedModelConfigFor(runProvider) : modelConfigResolver();
      if (isHostedProvider(expectedModelConfig.provider_id)) {
        assertConfiguredRunModelConfig(run, expectedModelConfig);
        const wake = await wakeRun({
          runId,
          databaseUrl: databaseUrlResolver(),
          serviceRoleKey: serviceRoleKeyResolver(),
          providerId: expectedModelConfig.provider_id,
          ...(expectedModelConfig.provider_id === CLAUDE_CLI_PROVIDER_ID ? { claudeOauthToken: claudeOauthTokenResolver() } : {}),
          ...(expectedModelConfig.provider_id === ANTHROPIC_API_PROVIDER_ID ? { anthropicApiKey: anthropicApiKeyResolver() } : {}),
        });
        return res.status(202).json({
          ...await store.getAgreementAnalysis(runId),
          execution_mode: 'HOSTED',
          wake_command_id: wake.command_id,
        });
      }
      const legalSchema = legalSchemaForVersion(run?.schema_version);
      const analysis = await advanceAgreementDraftAnalysis({
        runId, store, legalSchema, model: modelFactory(), workerId: `web:${actor}`,
      });
      return res.status(200).json(analysis);
    } catch (error) {
      if (error instanceof ProductRequestAuthError) return res.status(error.code === 'CSRF_REQUIRED' ? 403 : 401).json({ error: error.code });
      // A sandbox that no longer resumes is an operator matter, not a
      // model-configuration one: the response names the code (work
      // package 4, plan finding (49)).
      if (error?.code === 'PRODUCT_SANDBOX_GONE') return res.status(503).json({ error: 'PRODUCT_SANDBOX_GONE' });
      if (/ANTHROPIC_API_KEY|PRODUCT_SANDBOX|PRODUCT_MODEL_PROVIDER/.test(error?.message || '')) {
        // The code of the configuration failure goes to the deployment log
        // (never a value): generation 8's first wake, 2026-10-18, answered
        // 503 with nothing in the log to say which check had failed.
        console.error('[product-run] not configured:', String(error?.code || error?.message || error).slice(0, 200));
        return res.status(503).json({ error: 'Product analysis model is not configured' });
      }
      if (/access denied/i.test(error?.message || '')) return res.status(404).json({ error: 'Analysis run not found' });
      console.error('[product-run]', error);
      return res.status(500).json({ error: 'Product analysis could not advance' });
    }
  };
}

module.exports = { createProductRunHandler };
