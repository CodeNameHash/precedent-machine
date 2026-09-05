'use strict';

const { advanceAgreementDraftAnalysis } = require('./analysis-runner');
const { createAnthropicProductModel } = require('./anthropic-model');
const { ProductPhase3Store } = require('./phase-3-store');
const {
  CODEX_PROVIDER_ID, assertConfiguredRunModelConfig, configuredProductModelConfig,
} = require('./product-model-config');
const { getProductActor, ProductRequestAuthError, requireSameOriginMutation } = require('./request-auth');
const { wakeSandboxProductRun } = require('./sandbox-wake');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const legalSchema = require('../../contracts/product/legal-schema.v1.json');

function createProductRunHandler({
  getClient,
  storeFactory = (client) => new ProductPhase3Store({ client }),
  modelFactory = createAnthropicProductModel,
  actorResolver = getProductActor,
  modelConfigResolver = configuredProductModelConfig,
  wakeRun = wakeSandboxProductRun,
  databaseUrlResolver = () => process.env.SUPABASE_URL,
  serviceRoleKeyResolver = () => process.env.SUPABASE_SERVICE_ROLE_KEY,
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
      const expectedModelConfig = modelConfigResolver();
      if (expectedModelConfig.provider_id === CODEX_PROVIDER_ID) {
        assertConfiguredRunModelConfig(await store.getRun(runId), expectedModelConfig);
        const wake = await wakeRun({
          runId,
          databaseUrl: databaseUrlResolver(),
          serviceRoleKey: serviceRoleKeyResolver(),
          providerId: expectedModelConfig.provider_id,
        });
        return res.status(202).json({
          ...await store.getAgreementAnalysis(runId),
          execution_mode: 'HOSTED',
          wake_command_id: wake.command_id,
        });
      }
      const analysis = await advanceAgreementDraftAnalysis({
        runId, store, legalSchema, model: modelFactory(), workerId: `web:${actor}`,
      });
      return res.status(200).json(analysis);
    } catch (error) {
      if (error instanceof ProductRequestAuthError) return res.status(error.code === 'CSRF_REQUIRED' ? 403 : 401).json({ error: error.code });
      if (/ANTHROPIC_API_KEY|PRODUCT_SANDBOX|PRODUCT_MODEL_PROVIDER/.test(error?.message || '')) {
        return res.status(503).json({ error: 'Product analysis model is not configured' });
      }
      if (/access denied/i.test(error?.message || '')) return res.status(404).json({ error: 'Analysis run not found' });
      console.error('[product-run]', error);
      return res.status(500).json({ error: 'Product analysis could not advance' });
    }
  };
}

module.exports = { createProductRunHandler };
