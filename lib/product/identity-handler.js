'use strict';

const { ProductPhase3Store } = require('./phase-3-store');
const { getProductActor, ProductRequestAuthError, requireSameOriginMutation } = require('./request-auth');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function createProductIdentityHandler({ getClient, storeFactory = (client) => new ProductPhase3Store({ client }), actorResolver = getProductActor } = {}) {
  return async function productIdentityHandler(req, res) {
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
      const run = await store.resolveIdentityReview({ runId, resolution: { confirmed: true, confirmed_by: actor } });
      return res.status(200).json(run);
    } catch (error) {
      if (error instanceof ProductRequestAuthError) return res.status(error.code === 'CSRF_REQUIRED' ? 403 : 401).json({ error: error.code });
      if (/access denied/i.test(error?.message || '')) return res.status(404).json({ error: 'Analysis run not found' });
      console.error('[product-identity]', error);
      return res.status(500).json({ error: 'Document identity could not be confirmed' });
    }
  };
}

module.exports = { createProductIdentityHandler };
