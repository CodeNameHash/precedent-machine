import { getProductSupabase } from '../../../lib/supabase';

const { getProductActor, ProductRequestAuthError } = require('../../../lib/product/request-auth');
const { reviewerForRequest, reviewersResponse, adminActor } = require('../../../lib/product/reviewers');

// The reviewer switcher's read. Emails are only returned to the admin.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'GET only' });
  }
  const client = getProductSupabase();
  if (!client) return res.status(500).json({ error: 'Product database is not configured' });
  try {
    const actor = await getProductActor(req);
    const admin = adminActor(actor);
    const result = await client.from('product_reviewers').select('id,name,level,email,active').eq('active', true).order('name');
    if (result.error) throw result.error;
    const declared = await reviewerForRequest({ req, client });
    return res.status(200).json(reviewersResponse({ rows: result.data, declared, actor, admin }));
  } catch (error) {
    if (error instanceof ProductRequestAuthError || error?.code === 'UNAUTHENTICATED') {
      return res.status(401).json({ error: 'UNAUTHENTICATED' });
    }
    console.error('[product-reviewers]', error);
    return res.status(500).json({ error: 'Reviewers could not be read' });
  }
}
