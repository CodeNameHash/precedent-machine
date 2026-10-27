// The runs this actor may open, for the review list (work package 53, plan
// finding (288)). A GET with no body: the store reads product_run_access for
// the actor and returns the runs newest first, with the fields a list needs.
import { getServiceSupabase } from '../../../lib/supabase';

const { ProductPhase3Store } = require('../../../lib/product/phase-3-store');
const { getProductActor, ProductRequestAuthError } = require('../../../lib/product/request-auth');

export default async function handleRuns(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'GET only' });
  }
  const client = getServiceSupabase();
  if (!client) return res.status(500).json({ error: 'Product database is not configured' });
  try {
    const actor = await getProductActor(req);
    const store = new ProductPhase3Store({ client });
    const runs = await store.listRuns({ actor, limit: 25 });
    return res.status(200).json({ runs });
  } catch (error) {
    if (error instanceof ProductRequestAuthError) return res.status(error.code === 'CSRF_REQUIRED' ? 403 : 401).json({ error: error.code });
    console.error('[product-runs]', error);
    return res.status(500).json({ error: 'Product runs could not be read' });
  }
}
