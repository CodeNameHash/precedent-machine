import { getServiceSupabase } from '../../lib/supabase';

export default async function handler(req, res) {
  const sb = getServiceSupabase();
  if (!sb) return res.status(500).json({ error: 'Supabase not configured' });

  if (req.method === 'GET') {
    const { id } = req.query;
    if (id) {
      const { data, error } = await sb.from('deals')
        .select('*')
        .eq('id', id).single();
      if (error) return res.status(404).json({ error: error.message });
      return res.json({ deal: data });
    }
    const { data, error } = await sb.from('deals')
      .select('*')
      .order('announce_date', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ deals: data });
  }

  if (req.method === 'POST') {
    const { acquirer, target, value_usd, announce_date, sector, metadata, created_by } = req.body;
    const { data, error } = await sb.from('deals')
      .insert({ acquirer, target, value_usd, announce_date, sector, metadata, created_by })
      .select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ deal: data });
  }

  if (req.method === 'PATCH') {
    const { id, ...updates } = req.body;
    // P8 item 5: server-side merge for the metadata column so concurrent
    // PATCHes from different tabs/users don't clobber each other's keys.
    // The client may still send a full pre-merged metadata blob (back-compat),
    // but if BOTH the existing row and the incoming update specify a metadata
    // object we deep-merge them shallow-key-wise and additionally deep-merge
    // the `custom_taxonomy_extensions` sub-object (per-featureKey list union).
    if (updates && updates.metadata && typeof updates.metadata === 'object' && !Array.isArray(updates.metadata)) {
      const { data: existing, error: readErr } = await sb.from('deals')
        .select('metadata').eq('id', id).single();
      if (!readErr && existing && existing.metadata && typeof existing.metadata === 'object') {
        const merged = { ...existing.metadata, ...updates.metadata };
        const existingExt = (existing.metadata.custom_taxonomy_extensions && typeof existing.metadata.custom_taxonomy_extensions === 'object') ? existing.metadata.custom_taxonomy_extensions : null;
        const incomingExt = (updates.metadata.custom_taxonomy_extensions && typeof updates.metadata.custom_taxonomy_extensions === 'object') ? updates.metadata.custom_taxonomy_extensions : null;
        if (existingExt || incomingExt) {
          const extMerged = { ...(existingExt || {}) };
          if (incomingExt) {
            for (const [key, list] of Object.entries(incomingExt)) {
              if (!Array.isArray(list)) { extMerged[key] = list; continue; }
              const prior = Array.isArray(extMerged[key]) ? extMerged[key] : [];
              // Union by code; the incoming entry wins on conflict.
              const byCode = new Map();
              for (const e of prior) if (e && e.code) byCode.set(e.code, e);
              for (const e of list) if (e && e.code) byCode.set(e.code, e);
              extMerged[key] = [...byCode.values()];
            }
          }
          merged.custom_taxonomy_extensions = extMerged;
        }
        updates.metadata = merged;
      }
    }
    const { data, error } = await sb.from('deals').update(updates).eq('id', id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ deal: data });
  }

  if (req.method === 'DELETE') {
    const { id } = req.body;
    const { error } = await sb.from('deals').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
