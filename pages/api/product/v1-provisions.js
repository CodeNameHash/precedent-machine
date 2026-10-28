// GET /api/product/v1-provisions?deals=<id>,<id> — the V1 corpus's provisions,
// adapted to the same answer shape the V2 facts produce, for a comparison
// (work package 54, finding (304)). Session-gated: it reads the corpus project,
// not the product database, so it uses that project's own client.
import { getServiceSupabase } from '../../../lib/supabase';
const { v1Agreements } = require('../../../lib/product/v1-provisions');

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'GET only' });
  }
  const raw = String(req.query.deals || '');
  const dealIds = raw.split(',').map((id) => id.trim()).filter(Boolean);
  if (dealIds.length === 0) return res.status(400).json({ error: 'deals is required' });
  try {
    const client = getServiceSupabase();
    if (!client) return res.status(500).json({ error: 'The corpus database is not configured' });
    const agreements = await v1Agreements(client, dealIds);
    return res.status(200).json({ schema_version: 'PRODUCT_V1_COMPARE/V1', agreements });
  } catch (error) {
    console.error('[product-v1-provisions]', error);
    return res.status(500).json({ error: 'The corpus could not be read' });
  }
}

export const config = { maxDuration: 60 };
