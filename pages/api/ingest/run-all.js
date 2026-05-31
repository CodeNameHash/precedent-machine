/**
 * run-all.js — Orchestrator for the split ingest pipeline.
 *
 * Runs classify ONLY (which is fast) and returns the list of types that
 * the client should extract next. The UI fires per-type extract-type calls
 * one-by-one. This keeps every individual function call well inside the
 * 300s Vercel budget; the all-in-one path (segment-v2 / from-url) remains
 * available for callers that don't want this dance.
 *
 * Input: POST { deal_id, url? }
 *
 * Output:
 *   { success, deal_id, classify: { section_count, by_type }, types_to_extract: [...] }
 */

import { getAnthropic, MODEL } from '../../../lib/anthropic';
import { getServiceSupabase } from '../../../lib/supabase';
import { runClassifyPhase } from './classify';

export const config = {
  maxDuration: 300,
  api: { bodyParser: { sizeLimit: '50mb' } },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { deal_id, url, full_text } = req.body || {};
  if (!deal_id) return res.status(400).json({ error: 'deal_id is required' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  const sb = getServiceSupabase();
  if (!sb) return res.status(500).json({ error: 'Supabase not configured' });

  const client = getAnthropic();
  const t0 = Date.now();

  try {
    // ── 1. Classify ──
    const classifyResult = await runClassifyPhase({
      dealId: deal_id,
      url,
      fullTextOverride: full_text,
      sb,
      client,
    });

    // ── 2. Derive the unique set of types to extract. We collapse
    // IOC/IOC-T/IOC-B → IOC, TERMR family → TERMR, COND family → COND so
    // each type-group is extracted exactly once. ──
    const collapse = (t) => {
      if (!t) return null;
      if (t === 'IOC-T' || t === 'IOC-B') return 'IOC';
      if (t === 'TERMR-M' || t === 'TERMR-B' || t === 'TERMR-T') return 'TERMR';
      if (t === 'COND-M' || t === 'COND-B' || t === 'COND-S') return 'COND';
      return t;
    };

    const seen = new Set();
    const types_to_extract = [];
    // Sort by descending section count so the UI extracts heavy types first
    // (gives the user visible progress quickly on the small types).
    const orderedTypes = Object.entries(classifyResult.by_type)
      .map(([t, n]) => [collapse(t), n])
      .filter(([t]) => t)
      .reduce((acc, [t, n]) => {
        acc[t] = (acc[t] || 0) + n;
        return acc;
      }, {});

    // P7 item 19: also collapse the sub-clause estimate by parent type.
    const estimateByType = classifyResult.by_type_estimate || {};
    const collapsedEstimate = {};
    for (const [t, est] of Object.entries(estimateByType)) {
      const k = collapse(t);
      if (!k) continue;
      if (!collapsedEstimate[k]) collapsedEstimate[k] = { sections: 0, sub_clauses: 0 };
      collapsedEstimate[k].sections += est.sections || 0;
      collapsedEstimate[k].sub_clauses += est.sub_clauses || 0;
      if (typeof est.definitions === 'number') {
        collapsedEstimate[k].definitions = (collapsedEstimate[k].definitions || 0) + est.definitions;
      }
    }

    for (const [t, n] of Object.entries(orderedTypes).sort((a, b) => b[1] - a[1])) {
      if (seen.has(t)) continue;
      seen.add(t);
      types_to_extract.push({
        type: t,
        section_count: n,
        // P7 item 19: surface estimated sub-clauses + definitions to the UI.
        estimate: collapsedEstimate[t] || null,
      });
    }

    return res.status(200).json({
      success: true,
      deal_id,
      classify: {
        section_count: classifyResult.section_count,
        article_count: classifyResult.article_count,
        by_type: classifyResult.by_type,
      },
      types_to_extract,
      timing_ms: Date.now() - t0,
    });
  } catch (err) {
    console.error('[ingest/run-all] error:', err);
    const status = err.statusCode || 500;
    return res.status(status).json({
      success: false,
      deal_id,
      error: err.message || 'Run-all failed',
    });
  }
}
