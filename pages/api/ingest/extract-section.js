/**
 * extract-section.js — P7 item 3.
 *
 * Re-extracts a SINGLE classified section on a deal:
 *   1. Loads deal.metadata.classified_sections
 *   2. Locates the section by sectionId
 *   3. Runs extractProvisionsForType against a 1-element classifiedSections array
 *      containing only that section
 *   4. Finds existing provisions on the deal whose ai_metadata.startChar falls
 *      within the section's [startChar, endChar) range and DELETES them
 *   5. Inserts the freshly-extracted provisions
 *   6. Appends a per-section run entry to deal.metadata.section_runs[]
 *
 * Bounded to ~5-15s — single section, single AI roundtrip.
 *
 * Input: POST { deal_id, section_id }   (section_id is the "section-<startChar>" string)
 * Output: { success, deal_id, section_id, provisions_inserted, provisions_deleted, timing_ms }
 *
 * Unlike /api/ingest/extract-type, this endpoint does NOT mark the whole type
 * as done/failed — it appends to deal.metadata.section_runs[] as an audit log.
 */

import Anthropic from '@anthropic-ai/sdk';
import { getServiceSupabase } from '../../../lib/supabase';

const {
  extractProvisionsForType,
} = require('../../../lib/parser-v2/extract');

export const config = {
  maxDuration: 60,
  api: { bodyParser: { sizeLimit: '50mb' } },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { deal_id, section_id } = req.body || {};
  if (!deal_id || !section_id) {
    return res.status(400).json({ error: 'deal_id and section_id are required' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  const sb = getServiceSupabase();
  if (!sb) return res.status(500).json({ error: 'Supabase not configured' });

  const client = new Anthropic({ apiKey });
  const t0 = Date.now();

  try {
    // ── 1. Load deal ────────────────────────────────────────────────────
    const { data: deal, error: dealErr } = await sb
      .from('deals')
      .select('id, metadata')
      .eq('id', deal_id)
      .single();
    if (dealErr) throw Object.assign(new Error(`Deal lookup failed: ${dealErr.message}`), { statusCode: 404 });
    const metadata = deal?.metadata || {};
    const classified = Array.isArray(metadata.classified_sections) ? metadata.classified_sections : null;
    if (!classified) {
      throw Object.assign(new Error('No classified_sections — run /api/ingest/classify first'), { statusCode: 404 });
    }
    const cleaned = metadata.full_text || '';

    // ── 2. Locate target section by sectionId (or by exact startChar) ──
    // sectionId is "section-<startChar>" per classify.js.
    const findId = String(section_id);
    let target = classified.find((s) => {
      const sid = `section-${s.startChar ?? 0}`;
      return sid === findId || String(s.sectionId || '') === findId;
    });
    if (!target) {
      // Fallback: numeric coercion in case the caller passed a bare startChar
      const sc = Number(findId.replace(/^section-/, ''));
      if (Number.isFinite(sc)) target = classified.find((s) => Number(s.startChar) === sc);
    }
    if (!target) {
      throw Object.assign(new Error(`section ${section_id} not found on deal`), { statusCode: 404 });
    }
    if (!target.type) {
      throw Object.assign(new Error('target section has no classified type'), { statusCode: 400 });
    }

    // Section's end char — derived from the NEXT section's startChar, or
    // best-effort startChar + text length.
    const sortedByStart = [...classified].sort((a, b) => (a.startChar || 0) - (b.startChar || 0));
    const myIdx = sortedByStart.findIndex(
      (s) => Number(s.startChar) === Number(target.startChar),
    );
    const next = myIdx >= 0 && myIdx + 1 < sortedByStart.length ? sortedByStart[myIdx + 1] : null;
    const sectionEnd = next ? Number(next.startChar) : (Number(target.startChar) + (target.text || '').length);

    // ── 3. Run extract on a 1-element classifiedSections array ─────────
    const sectionForExtract = {
      text: target.text || '',
      body: target.text || '',
      startChar: target.startChar || 0,
      start: target.startChar || 0,
      number: target.sectionNumber || null,
      sectionNumber: target.sectionNumber || null,
      title: target.title || null,
      heading: target.title || null,
      articleType: target.articleType || null,
      provision_type: target.type,
      provisionType: target.type,
      provisionCode: target.code || null,
    };
    const extracted = await extractProvisionsForType([sectionForExtract], target.type, client, cleaned);

    // ── 4. Delete existing provisions in the section's char range ──────
    // We look at ai_metadata.startChar (the per-provision anchor we already store).
    const { data: existing, error: exErr } = await sb
      .from('provisions')
      .select('id, ai_metadata')
      .eq('deal_id', deal_id);
    if (exErr) throw Object.assign(new Error(`Failed to read provisions: ${exErr.message}`), { statusCode: 500 });

    const toDelete = [];
    for (const p of (existing || [])) {
      let meta = p.ai_metadata;
      if (typeof meta === 'string') {
        try { meta = JSON.parse(meta); } catch { meta = null; }
      }
      const sc = meta && typeof meta.startChar === 'number' ? meta.startChar : null;
      if (sc === null) continue;
      if (sc >= Number(target.startChar) && sc < sectionEnd) toDelete.push(p.id);
    }
    let deletedCount = 0;
    if (toDelete.length > 0) {
      const { error: annotErr } = await sb.from('annotations').delete().in('provision_id', toDelete);
      if (annotErr) {
        // non-fatal — log and continue
        console.warn('[extract-section] annotation delete failed:', annotErr.message);
      }
      const { error: delErr } = await sb.from('provisions').delete().in('id', toDelete);
      if (delErr) throw Object.assign(new Error(`Failed to delete existing provisions: ${delErr.message}`), { statusCode: 500 });
      deletedCount = toDelete.length;
    }

    // ── 5. Insert freshly-extracted provisions ────────────────────────
    let insertedCount = 0;
    if (extracted && extracted.length > 0) {
      const rows = extracted.map((prov) => ({
        deal_id,
        type: prov.type,
        category: prov.category || 'Unclassified',
        full_text: (prov.text || '').trim(),
        ai_favorability: prov.favorability || 'neutral',
        ai_metadata: {
          features: prov.features || {},
          code: prov.code || null,
          relatedDefinitions: prov.relatedDefinitions || [],
          isNewCode: prov.isNewCode || false,
          proposedCode: prov.proposedCode || null,
          proposedLabel: prov.proposedLabel || null,
          startChar: typeof prov.startChar === 'number' ? prov.startChar : null,
        },
      }));
      const { data: insData, error: insErr } = await sb.from('provisions').insert(rows).select('id');
      if (insErr) throw Object.assign(new Error(`Insert failed: ${insErr.message}`), { statusCode: 500 });
      insertedCount = insData ? insData.length : rows.length;
    }

    // ── 6. Append to deal.metadata.section_runs[] (audit log) ─────────
    const sectionRuns = Array.isArray(metadata.section_runs) ? [...metadata.section_runs] : [];
    sectionRuns.push({
      section_id: findId,
      section_startChar: target.startChar,
      section_number: target.sectionNumber || null,
      section_title: target.title || null,
      type: target.type,
      provisions_inserted: insertedCount,
      provisions_deleted: deletedCount,
      ran_at: new Date().toISOString(),
      timing_ms: Date.now() - t0,
    });
    const { error: updErr } = await sb
      .from('deals')
      .update({ metadata: { ...metadata, section_runs: sectionRuns } })
      .eq('id', deal_id);
    if (updErr) console.warn('[extract-section] section_runs update failed:', updErr.message);

    return res.status(200).json({
      success: true,
      deal_id,
      section_id: findId,
      type: target.type,
      provisions_inserted: insertedCount,
      provisions_deleted: deletedCount,
      timing_ms: Date.now() - t0,
    });
  } catch (err) {
    console.error('[ingest/extract-section] error:', err);
    const status = err.statusCode || 500;
    return res.status(status).json({
      success: false,
      deal_id,
      section_id,
      error: err.message || 'Extract failed',
    });
  }
}
