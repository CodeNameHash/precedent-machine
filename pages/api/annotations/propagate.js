import { getServiceSupabase } from '../../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const sb = getServiceSupabase();
  if (!sb) return res.status(500).json({ error: 'Supabase not configured' });

  const { annotation_id, provision_id, phrase, favorability, note, user_id } = req.body;
  if (!phrase || !provision_id) return res.status(400).json({ error: 'phrase and provision_id required' });

  try {
    // Find all other provisions containing this phrase
    const { data: allProvisions, error: provErr } = await sb
      .from('provisions')
      .select('id, full_text, deal_id, type, category')
      .neq('id', provision_id);

    if (provErr) throw provErr;

    const phraseLC = phrase.toLowerCase();
    const matches = allProvisions.filter(p =>
      p.full_text && p.full_text.toLowerCase().includes(phraseLC)
    );

    if (matches.length === 0) {
      return res.json({ propagated: 0, matches: [] });
    }

    // Check for existing human-overridden annotations on these provisions for the same phrase
    const matchIds = matches.map(m => m.id);
    const { data: existingAnns } = await sb
      .from('annotations')
      .select('*')
      .in('provision_id', matchIds)
      .ilike('phrase', phrase);

    const existingMap = {};
    (existingAnns || []).forEach(a => {
      if (!existingMap[a.provision_id]) existingMap[a.provision_id] = [];
      existingMap[a.provision_id].push(a);
    });

    // Propagate: create linked annotations where no human override exists
    const toInsert = [];
    matches.forEach(m => {
      const existing = existingMap[m.id] || [];
      const hasHumanOverride = existing.some(a => a.overrides_id && !a.is_ai_generated);
      if (hasHumanOverride) return; // Skip — human override is authoritative

      // Check if already propagated
      const alreadyPropagated = existing.some(a => a.overrides_id === annotation_id);
      if (alreadyPropagated) return;

      toInsert.push({
        provision_id: m.id,
        phrase,
        favorability,
        note: note || null,
        user_id,
        is_ai_generated: false,
        overrides_id: annotation_id,
      });
    });

    if (toInsert.length > 0) {
      const { error: insertErr } = await sb.from('annotations').insert(toInsert);
      if (insertErr) throw insertErr;
    }

    return res.json({
      propagated: toInsert.length,
      skipped_human_overrides: matches.length - toInsert.length,
      matches: matches.map(m => ({ id: m.id, deal_id: m.deal_id, type: m.type, category: m.category })),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
