import { getServiceSupabase } from '../../lib/supabase';

const IMMUTABLE_FIELDS = ['deal_id', 'full_text'];

export default async function handler(req, res) {
  const sb = getServiceSupabase();
  if (!sb) return res.status(500).json({ error: 'Supabase not configured' });

  if (req.method === 'GET') {
    const { id, deal_id, type, category } = req.query;
    if (id) {
      const { data, error } = await sb.from('provisions')
        .select('*, deal:deals(acquirer, target, sector)')
        .eq('id', id).single();
      if (error) return res.status(404).json({ error: error.message });
      return res.json({ provision: data });
    }
    let q = sb.from('provisions')
      .select('*, deal:deals(acquirer, target, sector)');
    if (deal_id) q = q.eq('deal_id', deal_id);
    if (type) q = q.eq('type', type);
    if (category) q = q.eq('category', category);
    q = q.order('created_at', { ascending: true });
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ provisions: data });
  }

  if (req.method === 'POST') {
    const { deal_id, type, category, full_text, prohibition, exceptions, ai_favorability } = req.body;
    if (!full_text || !full_text.trim()) {
      return res.status(400).json({ error: 'full_text is required' });
    }
    const { data, error } = await sb.from('provisions')
      .insert({ deal_id, type, category, full_text: full_text.trim(), prohibition, exceptions, ai_favorability: ai_favorability || 'neutral' })
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
    // Only allow updating columns that exist in the DB
    const allowedFields = ['type', 'category', 'prohibition', 'exceptions', 'ai_favorability'];
    const safeUpdates = {};
    for (const key of allowedFields) {
      if (key in updates) safeUpdates[key] = updates[key];
    }
    const { data, error } = await sb.from('provisions').update(safeUpdates).eq('id', id).select().single();
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
