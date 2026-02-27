import { getServiceSupabase } from '../../lib/supabase';

export default async function handler(req, res) {
  const sb = getServiceSupabase();
  if (!sb) return res.status(500).json({ error: 'Supabase not configured' });

  if (req.method === 'GET') {
    // Fetch provision types
    const { data: types, error: typesErr } = await sb.from('provision_types')
      .select('*')
      .order('key');
    if (typesErr) return res.status(500).json({ error: typesErr.message });

    // Fetch provision categories with their type info
    const { data: categories, error: catsErr } = await sb.from('provision_categories')
      .select('*, provision_type:provision_types(key, label)')
      .order('sort_order', { ascending: true });
    if (catsErr) return res.status(500).json({ error: catsErr.message });

    return res.json({ provision_types: types, provision_categories: categories });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
