import { getServiceSupabase } from '../../lib/supabase';
import { diffCorrectionType, logCorrection } from './corrections';

const IMMUTABLE_FIELDS = ['deal_id'];

// Fields snapshotted into before/after for correction logging
const TRACKED_FIELDS = ['type', 'category', 'full_text', 'ai_favorability', 'prohibition', 'exceptions'];

function snapshot(provision) {
  if (!provision) return null;
  const snap = {};
  for (const k of TRACKED_FIELDS) {
    if (k in provision) snap[k] = provision[k];
  }
  // Hoist ai_metadata.features into snap.features so diffCorrectionType
  // (which looks for a top-level "features" key) can detect feature edits.
  const meta = provision && provision.ai_metadata;
  let parsed = meta;
  if (typeof meta === 'string') {
    try { parsed = JSON.parse(meta); } catch { parsed = null; }
  }
  if (parsed && typeof parsed === 'object' && parsed.features) {
    snap.features = parsed.features;
  }
  return snap;
}

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
    // Extract correction-logging metadata before processing updates
    const { id, reason, user_id, ...updates } = req.body;

    const blocked = IMMUTABLE_FIELDS.filter(f => f in updates);
    if (blocked.length > 0) {
      return res.status(403).json({
        error: `Cannot modify immutable field(s): ${blocked.join(', ')}. Provision text is locked after creation. Use annotations to enrich.`,
      });
    }
    // Only allow updating columns that exist in the DB
    const allowedFields = ['type', 'category', 'prohibition', 'exceptions', 'ai_favorability', 'full_text', 'ai_metadata'];
    const safeUpdates = {};
    for (const key of allowedFields) {
      if (key in updates) safeUpdates[key] = updates[key];
    }
    if ('full_text' in safeUpdates) {
      if (typeof safeUpdates.full_text !== 'string' || !safeUpdates.full_text.trim()) {
        return res.status(400).json({ error: 'full_text cannot be empty' });
      }
      safeUpdates.full_text = safeUpdates.full_text.trim();
    }
    if (!id) {
      return res.status(400).json({ error: 'id is required for PATCH' });
    }

    // Capture the "before" state for correction logging — best effort.
    let beforeRow = null;
    try {
      const { data: pre } = await sb.from('provisions').select('*').eq('id', id).single();
      beforeRow = pre || null;
    } catch (err) {
      console.warn('[provisions PATCH] failed to fetch before-state:', err?.message || err);
    }

    // Merge ai_metadata against the existing row so feature edits don't blow
    // away other metadata (rubric_code, ingestion flags, etc.).
    if ('ai_metadata' in safeUpdates && safeUpdates.ai_metadata && typeof safeUpdates.ai_metadata === 'object') {
      let existingMeta = beforeRow ? beforeRow.ai_metadata : null;
      if (typeof existingMeta === 'string') {
        try { existingMeta = JSON.parse(existingMeta); } catch { existingMeta = null; }
      }
      const baseMeta = (existingMeta && typeof existingMeta === 'object' && !Array.isArray(existingMeta)) ? existingMeta : {};
      const incoming = safeUpdates.ai_metadata;
      const mergedFeatures = {
        ...((baseMeta.features && typeof baseMeta.features === 'object' && !Array.isArray(baseMeta.features)) ? baseMeta.features : {}),
        ...((incoming.features && typeof incoming.features === 'object' && !Array.isArray(incoming.features)) ? incoming.features : {}),
      };
      safeUpdates.ai_metadata = {
        ...baseMeta,
        ...incoming,
        features: mergedFeatures,
        user_corrected: true,
      };
    }

    const { data, error } = await sb.from('provisions').update(safeUpdates).eq('id', id).select().single();
    if (error) return res.status(500).json({ error: error.message });

    // Log the correction (best-effort, never fails the PATCH).
    try {
      const before = snapshot(beforeRow);
      const after = snapshot(data);
      const correction_type = diffCorrectionType(before, after);
      if (correction_type) {
        await logCorrection(sb, {
          provision_id: id,
          deal_id: data?.deal_id || beforeRow?.deal_id || null,
          correction_type,
          before,
          after,
          context: {
            // Original AI classification (the state before user touched it).
            // Useful for future learning: "what did the model originally say?"
            original_ai_type: beforeRow?.type || null,
            original_ai_category: beforeRow?.category || null,
            original_ai_favorability: beforeRow?.ai_favorability || null,
          },
          reason: reason || null,
          user_id: user_id || null,
        });
      }
    } catch (err) {
      console.warn('[provisions PATCH] correction logging failed:', err?.message || err);
    }

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
