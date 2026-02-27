import { getServiceSupabase } from '../../lib/supabase';

export default async function handler(req, res) {
  const sb = getServiceSupabase();
  if (!sb) return res.status(500).json({ error: 'Supabase not configured' });

  if (req.method === 'GET') {
    const { provision_id, provision_ids, id } = req.query;
    if (id) {
      const { data, error } = await sb.from('annotations').select('*, user:users(name)').eq('id', id).single();
      if (error) return res.status(404).json({ error: error.message });
      return res.json({ annotation: data });
    }
    // Batch fetch by multiple provision IDs
    if (provision_ids) {
      const ids = provision_ids.split(',').filter(Boolean).slice(0, 100);
      if (!ids.length) return res.json({ annotations_by_provision: {} });
      const { data, error } = await sb.from('annotations')
        .select('*, user:users(name), verifier:users!annotations_verified_by_fkey(name)')
        .in('provision_id', ids)
        .order('start_offset');
      if (error) return res.status(500).json({ error: error.message });
      const grouped = {};
      (data || []).forEach(a => {
        const pid = a.provision_id;
        if (!grouped[pid]) grouped[pid] = [];
        grouped[pid].push({ ...a, verified_by_name: a.verifier?.name || null });
      });
      return res.json({ annotations_by_provision: grouped });
    }
    if (provision_id) {
      const { data, error } = await sb.from('annotations')
        .select('*, user:users(name), verifier:users!annotations_verified_by_fkey(name)')
        .eq('provision_id', provision_id)
        .order('created_at');
      if (error) return res.status(500).json({ error: error.message });
      // Flatten verifier name
      const annotations = (data || []).map(a => ({
        ...a,
        verified_by_name: a.verifier?.name || null,
      }));
      return res.json({ annotations });
    }
    const { data, error } = await sb.from('annotations').select('*, user:users(name)').order('created_at', { ascending: false }).limit(100);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ annotations: data });
  }

  if (req.method === 'POST') {
    const { provision_id, phrase, start_offset, end_offset, favorability, note, user_id, is_ai_generated, overrides_id } = req.body;
    const { data, error } = await sb.from('annotations')
      .insert({ provision_id, phrase, start_offset, end_offset, favorability, note, user_id, is_ai_generated: is_ai_generated || false, overrides_id })
      .select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ annotation: data });
  }

  if (req.method === 'PATCH') {
    const { id, ...updates } = req.body;
    // If verifying, add verified_at
    if (updates.verified_by) {
      updates.verified_at = new Date().toISOString();
    }
    const { data, error } = await sb.from('annotations').update(updates).eq('id', id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ annotation: data });
  }

  if (req.method === 'DELETE') {
    const { id } = req.body;
    const { error } = await sb.from('annotations').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
