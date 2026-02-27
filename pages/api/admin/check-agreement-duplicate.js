import crypto from 'crypto';
import { getServiceSupabase } from '../../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { text, deal_id } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });

  const sb = getServiceSupabase();
  if (!sb) return res.json({ is_duplicate: false });

  try {
    // Check by hash (exact match)
    const hash = crypto.createHash('sha256').update(text).digest('hex');
    const { data: exactMatch } = await sb.from('agreement_sources')
      .select('id, title')
      .eq('text_hash', hash)
      .single();

    if (exactMatch) {
      return res.json({
        is_duplicate: true,
        match_percentage: 100,
        existing_deal: exactMatch.title,
        existing_id: exactMatch.id,
      });
    }

    // Check by deal_id - does this deal already have an agreement?
    if (deal_id) {
      const { data: existingProvs } = await sb.from('provisions')
        .select('id')
        .eq('deal_id', deal_id)
        .limit(1);

      if (existingProvs && existingProvs.length > 0) {
        // Get deal info
        const { data: deal } = await sb.from('deals')
          .select('acquirer, target')
          .eq('id', deal_id)
          .single();

        return res.json({
          is_duplicate: true,
          match_percentage: 85,
          existing_deal: deal ? `${deal.acquirer} / ${deal.target}` : 'Unknown',
          existing_id: deal_id,
        });
      }
    }

    return res.json({ is_duplicate: false });
  } catch (err) {
    return res.json({ is_duplicate: false, error: err.message });
  }
}
