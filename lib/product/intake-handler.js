'use strict';

const { createPhase1Foundation } = require('./phase-1-foundation');
const { ProductPhase1Store, ProductPhase1StoreError } = require('./phase-1-store');
const { configuredProductModelConfig } = require('./product-model-config');
const { createSecIntakeAdapter, ProductSecIntakeError } = require('./sec-intake');

function createProductIntakeHandler({
  getClient,
  intakeFactory = createSecIntakeAdapter,
  storeFactory = (client) => new ProductPhase1Store({ client }),
  foundationFactory = createPhase1Foundation,
  actorResolver = null,
  requireMutation = null,
  modelConfigResolver = configuredProductModelConfig,
} = {}) {
  if (typeof getClient !== 'function') throw new TypeError('getClient is required');
  return async function productIntakeHandler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const client = getClient();
    if (!client) return res.status(500).json({ error: 'Product database is not configured' });
    try {
      if (requireMutation) requireMutation(req);
      const actor = actorResolver ? await actorResolver(req) : null;
      const store = storeFactory(client);
      const foundation = foundationFactory({ secIntake: intakeFactory(), store });
      const run = await foundation.submit({ ...req.body, modelConfig: modelConfigResolver() });
      if (actor && typeof store.assignRunOwner === 'function') await store.assignRunOwner({ runId: run.run_id, actor });
      return res.status(202).json({
        run_id: run.run_id,
        source_document_id: run.source_document_id,
        generation: run.source_generation,
        status: run.status,
        stage: run.stage,
      });
    } catch (error) {
      if (error?.code === 'UNAUTHENTICATED' || error?.code === 'CSRF_REQUIRED') {
        return res.status(error.code === 'CSRF_REQUIRED' ? 403 : 401).json({ error: error.code });
      }
      if (error instanceof TypeError || (error instanceof ProductSecIntakeError && /^INVALID_/.test(error.code))) {
        return res.status(400).json({ error: 'Invalid product intake request' });
      }
      if (error instanceof ProductPhase1StoreError && error.code === 'IDEMPOTENCY_CONFLICT') {
        return res.status(409).json({ error: error.message });
      }
      if (error instanceof ProductSecIntakeError) {
        console.error('[product-intake-sec]', error);
        return res.status(502).json({ error: 'SEC intake failed' });
      }
      console.error('[product-intake]', error);
      return res.status(500).json({ error: 'Product intake failed' });
    }
  };
}

module.exports = { createProductIntakeHandler };
