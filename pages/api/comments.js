import { getServiceSupabase } from '../../lib/supabase';

export default async function handler(req, res) {
  const sb = getServiceSupabase();
  if (!sb) return res.status(500).json({ error: 'Supabase not configured' });

  if (req.method === 'GET') {
    const { annotation_id } = req.query;
    if (!annotation_id) return res.status(400).json({ error: 'annotation_id required' });
    const { data, error } = await sb.from('comments')
      .select('*, user:users(name)')
      .eq('annotation_id', annotation_id)
      .order('created_at');
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ comments: data });
  }

  if (req.method === 'POST') {
    const { annotation_id, user_id, body } = req.body;
    const { data, error } = await sb.from('comments')
      .insert({ annotation_id, user_id, body })
      .select('*, user:users(name)').single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ comment: data });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
