import { getServiceSupabase } from '../../lib/supabase';

export default async function handler(req, res) {
  const sb = getServiceSupabase();
  if (!sb) return res.status(500).json({ error: 'Supabase not configured' });

  if (req.method === 'GET') {
    const { data, error } = await sb.from('users').select('*').order('name');
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ users: data });
  }

  if (req.method === 'POST') {
    const { name, is_admin } = req.body;
    const { data, error } = await sb.from('users').insert({ name, is_admin: is_admin || false }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ user: data });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
