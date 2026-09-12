import { getServiceSupabase } from '../../../lib/supabase';

const { ProductPhase3Store } = require('../../../lib/product/phase-3-store');
const { getProductActor } = require('../../../lib/product/request-auth');

function firstQueryValue(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === 'string' && raw.length > 0 ? raw : null;
}

export default async function publishedFactsHandler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const client = getServiceSupabase();
  if (!client) return res.status(500).json({ error: 'Product database is not configured' });
  try {
    await getProductActor(req);
    const store = new ProductPhase3Store({ client });
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
}

export const config = { maxDuration: 60 };
