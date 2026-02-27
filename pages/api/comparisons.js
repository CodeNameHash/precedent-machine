import { getServiceSupabase } from '../../lib/supabase';

export default async function handler(req, res) {
  const sb = getServiceSupabase();
  if (!sb) return res.status(500).json({ error: 'Supabase not configured' });

  if (req.method === 'GET') {
    const { data, error } = await sb.from('comparisons')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ comparisons: data });
  }

  if (req.method === 'POST') {
    const { deal_ids, category, summary, ai_generated_at } = req.body;
    const { data, error } = await sb.from('comparisons')
      .insert({ deal_ids, category, summary, ai_generated_at })
      .select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ comparison: data });
  }

  if (req.method === 'PATCH') {
    const { id, verified_by } = req.body;
    const { data, error } = await sb.from('comparisons')
      .update({ verified_by, verified_at: new Date().toISOString() })
      .eq('id', id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ comparison: data });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
