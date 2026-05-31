/**
 * segment-v2.js — Next.js API route for the v2 parser pipeline.
 *
 * ⚠ LEGACY ROUTE — the live ingest entrypoint is now pages/ingest.js, which
 * calls /api/ingest/from-url (single-shot) and /api/ingest/run-all +
 * extract-type (split pipeline). Those wrap the SAME parser-v2 modules this
 * route does, but with the per-type/per-section iteration the UI depends on.
 * This monolithic single-request variant is only referenced by a docstring on
 * pages/index.js. Do not build new features on it.
 *
 * Orchestrates the full 5-phase pipeline:
 *   1. Clean text + parse structure (structural.js)
 *   2. Classify sections via AI (classify.js)
 *   3. Extract sub-provisions with canonical codes (extract.js)
 *   4. Validate against rubric (validate.js)
 *   5. Store in Supabase (store.js) — skipped in preview mode
 */

import { getAnthropic, MODEL } from '../../../lib/anthropic';
import { getServiceSupabase } from '../../../lib/supabase';

// Parser v2 modules (CommonJS)
const { parseStructure, cleanText, displayCleanText } = require('../../../lib/parser-v2/structural');
const { classifySections } = require('../../../lib/parser-v2/classify');
const { extractProvisions } = require('../../../lib/parser-v2/extract');
const { validateProvisions } = require('../../../lib/parser-v2/validate');
const { storeProvisions } = require('../../../lib/parser-v2/store');
const { extractAdvisors } = require('../../../lib/parser-v2/advisors');

export const config = {
  maxDuration: 300,
  api: { bodyParser: { sizeLimit: '50mb' } },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const { deal_id, full_text, title, source_url, filing_date, preview } = req.body;

  if (!full_text) {
    return res.status(400).json({ error: 'full_text is required' });
  }
  if (!preview && !deal_id) {
    return res.status(400).json({ error: 'deal_id is required when not in preview mode' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  const sb = getServiceSupabase();
  if (!sb && !preview) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  const timing = {};
  const totalStart = Date.now();

  try {
    const client = getAnthropic();

    // ── Phase 1: Clean text and parse structure ──
    const parseStart = Date.now();
    const cleaned = cleanText(full_text);
    const { sections, articles, diagnostics } = parseStructure(cleaned);
    timing.parse = Date.now() - parseStart;

    if (sections.length === 0) {
      return res.status(422).json({
        success: false,
        error: 'No sections found in the agreement text',
        diagnostics,
        timing: { parse: timing.parse, total: Date.now() - totalStart },
      });
    }

    // ── Phase 2: Classify sections ──
    const classifyStart = Date.now();
    const classifiedSections = await classifySections(sections, articles, client);
    timing.classify = Date.now() - classifyStart;

    // Map classified sections to the shape expected by extract.js
    // extract.js expects `provision_type` (from classify) and the original section fields
    const sectionsForExtract = classifiedSections.map(s => ({
      ...s,
      provision_type: s.provisionType,
    }));

    // ── Phase 3: Extract sub-provisions ──
    const extractStart = Date.now();
    const provisions = await extractProvisions(sectionsForExtract, client, cleaned);
    timing.extract = Date.now() - extractStart;

    // ── Phase 4: Validate ──
    // Pass the classified sections so the validator can backfill any orphans
    // as OTHER provisions, guaranteeing 100% coverage of the agreement.
    const validateStart = Date.now();
    const validation = validateProvisions(provisions, cleaned, sectionsForExtract);
    timing.validate = Date.now() - validateStart;

    // Use the validated provisions (which have status flags)
    const finalProvisions = validation.provisions;

    // ── Phase 5: Store (unless preview mode) ──
    let storeResult = null;
    if (!preview) {
      const storeStart = Date.now();
      // Store the display-cleaned version of the agreement text so the Full
      // Document view renders without EDGAR artifacts, page numbers, etc.
      const displayText = displayCleanText(full_text);
      // Stage 4: detect counsel / financial advisors from the preamble +
      // signature block. Conservative: only emits entries with a confident
      // party signal. Errors here are non-fatal — fall back to [].
      let advisors = [];
      try {
        advisors = extractAdvisors(displayText) || [];
      } catch (advErr) {
        console.warn('[segment-v2] advisor extraction failed:', advErr.message);
      }
      storeResult = await storeProvisions(deal_id, finalProvisions, displayText, title, sb, { advisors });
      timing.store = Date.now() - storeStart;
    }

    timing.total = Date.now() - totalStart;

    // ── Build response ──
    const provisionSummaries = finalProvisions.map(p => ({
      type: p.type,
      code: p.code || null,
      category: p.category || 'Unclassified',
      sourceCategory: p.sourceCategory || null,
      textPreview: (p.text || '').substring(0, 150),
      features: p.features || {},
      status: p.status || 'unknown',
      favorability: p.favorability || 'neutral',
      isNewCode: p.isNewCode || false,
      proposedCode: p.proposedCode || null,
      proposedLabel: p.proposedLabel || null,
      codeAssignedBy: p.codeAssignedBy || null,
      autoMergedFrom: p.autoMergedFrom || null,
    }));

    // Surface the canonical-code enforcement & auto-merge subreports at the
    // top level of the response (and keep them inside validation.report) so
    // the UI can render them prominently after each ingest without digging.
    const codeQuality = {
      uncoded_provisions: validation.report.uncoded_provisions || [],
      auto_merged_codes: validation.report.auto_merged_codes || [],
      proposed_new_codes_pending_approval:
        validation.report.proposed_new_codes_pending_approval || [],
      enforcement: validation.report.code_enforcement || null,
    };

    const response = {
      success: true,
      mode: preview ? 'preview' : 'live',
      deal_id: deal_id || null,
      timing,
      diagnostics,
      validation: validation.report,
      code_quality: codeQuality,
      provisions: provisionSummaries,
    };

    // Only include agreementSourceId in live mode
    if (!preview && storeResult) {
      response.agreementSourceId = storeResult.agreementSourceId;
      response.storage = {
        insertedCount: storeResult.insertedCount,
        deletedCount: storeResult.deletedCount,
        errors: storeResult.errors,
      };
    }

    return res.json(response);
  } catch (err) {
    timing.total = Date.now() - totalStart;
    console.error('[segment-v2] Pipeline error:', err);
    return res.status(500).json({
      success: false,
      error: err.message,
      timing,
    });
  }
}
