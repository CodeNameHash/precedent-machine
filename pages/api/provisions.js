import { getServiceSupabase } from '../../lib/supabase';

const IMMUTABLE_FIELDS = ['full_text', 'deal_id'];

export default async function handler(req, res) {
  const sb = getServiceSupabase();
  if (!sb) return res.status(500).json({ error: 'Supabase not configured' });

  if (req.method === 'GET') {
    const { id, deal_id, type, category } = req.query;
    if (id) {
      const { data, error } = await sb.from('provisions')
        .select('*, deal:deals(acquirer, target, sector), prov_type:provision_types(key, label), prov_category:provision_categories(label, sort_order)')
        .eq('id', id).single();
      if (error) return res.status(404).json({ error: error.message });
      return res.json({ provision: data });
    }
    let q = sb.from('provisions')
      .select('*, deal:deals(acquirer, target, sector), prov_type:provision_types(key, label), prov_category:provision_categories(label, sort_order)');
    if (deal_id) q = q.eq('deal_id', deal_id);
    if (type) q = q.eq('type', type);
    if (category) q = q.eq('category', category);
    q = q.order('sort_order', { ascending: true });
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ provisions: data });
  }

  if (req.method === 'POST') {
    const { deal_id, provision_type_id, category_id, parent_id, type, category, full_text, prohibition, exceptions, ai_favorability, sort_order, agreement_source_id, ai_metadata } = req.body;
    if (!full_text || !full_text.trim()) {
      return res.status(400).json({ error: 'full_text is required' });
    }
    const { data, error } = await sb.from('provisions')
      .insert({ deal_id, provision_type_id, category_id, parent_id, type, category, full_text: full_text.trim(), prohibition, exceptions, ai_favorability, sort_order, agreement_source_id, ai_metadata })
      .select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ provision: data });
  }

  if (req.method === 'PATCH') {
    const { id, ...updates } = req.body;
    const blocked = IMMUTABLE_FIELDS.filter(f => f in updates);
    if (blocked.length > 0) {
      return res.status(403).json({
        error: `Cannot modify immutable field(s): ${blocked.join(', ')}. Provision text is locked after creation. Use annotations to enrich.`,
      });
    }
    const { data, error } = await sb.from('provisions').update(updates).eq('id', id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ provision: data });
  }

  if (req.method === 'DELETE') {
    const { id } = req.body;
    const { error } = await sb.from('provisions').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
