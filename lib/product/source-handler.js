'use strict';

const { ProductPhase3Store } = require('./phase-3-store');
const { getProductActor, ProductRequestAuthError } = require('./request-auth');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function createProductSourceHandler({ getClient, storeFactory = (client) => new ProductPhase3Store({ client }), actorResolver = getProductActor } = {}) {
  return async function productSourceHandler(req, res) {
    res.setHeader('Cache-Control', 'private, no-store');
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    const runId = Array.isArray(req.query?.id) ? req.query.id[0] : req.query?.id;
    if (!UUID.test(runId || '')) return res.status(400).json({ error: 'Invalid analysis run ID' });
    try {
      const actor = await actorResolver(req);
      const client = getClient();
      if (!client) return res.status(500).json({ error: 'Product database is not configured' });
      const store = storeFactory(client);
      await store.assertAccess({ runId, actor });
      const { sourceDocument } = await store.getRunContext(runId);
      return res.status(200).json({
        schema_version: 'PRODUCT_SOURCE_READ/V1',
        source_document_id: sourceDocument.source_document_id,
        canonical_text: sourceDocument.canonical_text,
        canonical_text_sha256: sourceDocument.canonical_text_sha256,
        coordinate_system: 'UTF8_CANONICAL_TEXT_HALF_OPEN',
      });
    } catch (error) {
      if (error instanceof ProductRequestAuthError) return res.status(401).json({ error: error.code });
      if (/access denied/i.test(error?.message || '')) return res.status(404).json({ error: 'Analysis run not found' });
      console.error('[product-source]', error);
      return res.status(500).json({ error: 'Product source could not be read' });
    }
  };
}

module.exports = { createProductSourceHandler };
