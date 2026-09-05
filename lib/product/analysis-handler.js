'use strict';

const { ProductPhase2Store } = require('./phase-2-store');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function createProductAnalysisHandler({
  getClient,
  storeFactory = (client) => new ProductPhase2Store({ client }),
  actorResolver = null,
} = {}) {
  if (typeof getClient !== 'function') throw new TypeError('getClient is required');
  return async function productAnalysisHandler(req, res) {
    res.setHeader('Cache-Control', 'private, no-store');
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    const runId = Array.isArray(req.query?.id) ? req.query.id[0] : req.query?.id;
    if (!UUID.test(runId || '')) return res.status(400).json({ error: 'Invalid analysis run ID' });
    const client = getClient();
    if (!client) return res.status(500).json({ error: 'Product database is not configured' });
    try {
      const actor = actorResolver ? await actorResolver(req) : null;
      const store = storeFactory(client);
      if (actor && typeof store.assertAccess === 'function') await store.assertAccess({ runId, actor });
      const analysis = await store.getAgreementAnalysis(runId);
      return res.status(200).json(analysis);
    } catch (error) {
      if (error?.code === 'UNAUTHENTICATED') return res.status(401).json({ error: error.code });
      if (error?.code === 'ACCESS_DENIED') return res.status(404).json({ error: 'Analysis run not found' });
      if (/analysis run not found/i.test(error?.message || '')) return res.status(404).json({ error: 'Analysis run not found' });
      console.error('[product-analysis]', error);
      return res.status(500).json({ error: 'Product analysis could not be read' });
    }
  };
}

module.exports = { createProductAnalysisHandler };
