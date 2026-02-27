import { getServiceSupabase } from '../../../lib/supabase';
import crypto from 'crypto';

export const config = {
  api: { bodyParser: { sizeLimit: '50mb' } },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { full_text, title } = req.body;
  if (!full_text || full_text.length < 100) {
    return res.status(400).json({ error: 'full_text is required (min 100 chars)' });
  }

  const sb = getServiceSupabase();
  if (!sb) return res.status(500).json({ error: 'Supabase not configured' });

  try {
    const text_hash = crypto.createHash('sha256').update(full_text).digest('hex');

    // Check for duplicate by hash
    const { data: existing } = await sb.from('agreement_sources')
      .select('id').eq('text_hash', text_hash).single();

    if (existing) {
      return res.json({ id: existing.id, is_duplicate: true });
    }

    // Insert new agreement source
    const { data, error } = await sb.from('agreement_sources')
      .insert({
        title: title || 'Merger Agreement',
        full_text,
        text_hash,
        metadata: { ingested_at: new Date().toISOString(), char_count: full_text.length },
      })
      .select('id').single();

    if (error) return res.status(500).json({ error: 'Failed to store agreement: ' + error.message });

    return res.json({ id: data.id, is_duplicate: false });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
