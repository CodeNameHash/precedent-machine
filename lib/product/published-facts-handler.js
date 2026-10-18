'use strict';

// The published read: every agreement whose current release carries
// layered facts, from the one atomic current-release pointer
// (product_agreement_release_heads) through ProductPhase3Store
// #listPublishedLayeredFacts. The /query/provisions page reads it; the
// Phase 6 scripts (lib/product/cutover-client.js) read it to prove which
// release a reader sees before and after a pointer move. Factory so the
// route and an in-process client share one handler (Ben: "everything to be
// driven by coding and not just a layer on top so all edits need to be
// repeatable across corpus").

const { ProductPhase3Store } = require('./phase-3-store');
const { getProductActor } = require('./request-auth');

function firstQueryValue(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === 'string' && raw.length > 0 ? raw : null;
}

function createPublishedFactsHandler({
  getClient, storeFactory = (client) => new ProductPhase3Store({ client }), actorResolver = getProductActor,
} = {}) {
  if (typeof getClient !== 'function') throw new TypeError('getClient is required');
  return async function publishedFactsHandler(req, res) {
    res.setHeader('Cache-Control', 'private, no-store');
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    const client = getClient();
    if (!client) return res.status(500).json({ error: 'Product database is not configured' });
    try {
      await actorResolver(req);
      const store = storeFactory(client);
      const agreements = await store.listPublishedLayeredFacts({
        familyKey: firstQueryValue(req.query?.family),
        subtypeKey: firstQueryValue(req.query?.subtype),
      });
      return res.status(200).json({ schema_version: 'PRODUCT_PUBLISHED_FACTS/V1', agreements });
    } catch (error) {
      if (error?.code === 'UNAUTHENTICATED') return res.status(401).json({ error: error.code });
      console.error('[product-published-facts]', error);
      return res.status(500).json({ error: 'Published facts could not be read' });
    }
  };
}

module.exports = { createPublishedFactsHandler };
