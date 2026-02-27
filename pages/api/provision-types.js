import { getServiceSupabase } from '../../lib/supabase';

export default async function handler(req, res) {
  const sb = getServiceSupabase();
  if (!sb) return res.status(500).json({ error: 'Supabase not configured' });

  if (req.method === 'GET') {
    const { data: types, error: typesErr } = await sb.from('provision_types')
      .select('*')
      .order('key');
    if (typesErr) return res.status(500).json({ error: typesErr.message });

    const { data: categories, error: catsErr } = await sb.from('provision_categories')
      .select('*, provision_type:provision_types(key, label)')
      .order('sort_order', { ascending: true });
    if (catsErr) return res.status(500).json({ error: catsErr.message });

    return res.json({ provision_types: types, provision_categories: categories });
  }

  // POST: Add a new category
  if (req.method === 'POST') {
    const { provision_type_key, label, sort_order, parent_id } = req.body;
    if (!label) return res.status(400).json({ error: 'label is required' });

    // Look up provision_type_id from key
    let provision_type_id = req.body.provision_type_id;
    if (!provision_type_id && provision_type_key) {
      const { data: pt } = await sb.from('provision_types')
        .select('id').eq('key', provision_type_key).single();
      if (pt) provision_type_id = pt.id;
    }
    if (!provision_type_id) return res.status(400).json({ error: 'provision_type_key or provision_type_id required' });

    // Get next sort_order if not provided
    let order = sort_order;
    if (!order) {
      const { data: maxRow } = await sb.from('provision_categories')
        .select('sort_order')
        .eq('provision_type_id', provision_type_id)
        .order('sort_order', { ascending: false })
        .limit(1);
      order = (maxRow && maxRow.length > 0) ? maxRow[0].sort_order + 1 : 1;
    }

    const { data, error } = await sb.from('provision_categories')
      .upsert({
        provision_type_id,
        label: label.trim(),
        sort_order: order,
        parent_id: parent_id || null,
      }, { onConflict: 'provision_type_id,label,parent_id' })
      .select('*, provision_type:provision_types(key, label)')
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ category: data });
  }

  // PATCH: Rename or reorder a category
  if (req.method === 'PATCH') {
    const { id, label, sort_order } = req.body;
    if (!id) return res.status(400).json({ error: 'id is required' });
    const updates = {};
    if (label !== undefined) updates.label = label.trim();
    if (sort_order !== undefined) updates.sort_order = sort_order;
    const { data, error } = await sb.from('provision_categories')
      .update(updates).eq('id', id)
      .select('*, provision_type:provision_types(key, label)')
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ category: data });
  }

  // DELETE: Remove a category
  if (req.method === 'DELETE') {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id is required' });
    const { error } = await sb.from('provision_categories').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
