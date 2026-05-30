/**
 * extract-type.js — Phase 3+5 for a SINGLE provision type.
 *
 * Reads the previously-persisted `deals.metadata.classified_sections`, runs
 * extractProvisionsForType for the requested type, validates, and stores
 * (replaces) provisions of that type group on the deal. Bounded per-call so
 * we stay well inside the 300s Vercel budget.
 *
 * Input: POST { deal_id, type }
 *   - type is a canonical provision type ('REP-T', 'IOC', 'DEF', etc.)
 */

import Anthropic from '@anthropic-ai/sdk';
import { getServiceSupabase } from '../../../lib/supabase';

const {
  extractProvisionsForType,
  expandTypeGroup,
  enforceCanonicalCodes,
  consolidateProposedCodes,
} = require('../../../lib/parser-v2/extract');
const { validateProvisions } = require('../../../lib/parser-v2/validate');
const { storeProvisionsForType } = require('../../../lib/parser-v2/store');

export const config = {
  maxDuration: 300,
  api: { bodyParser: { sizeLimit: '50mb' } },
};

/**
 * Shared internal implementation — called by both this endpoint and the
 * run-all orchestrator. Returns { inserted, deleted, errors }.
 */
async function runExtractTypePhase({ dealId, type, sb, client }) {
  if (!type) {
    const err = new Error('type is required');
    err.statusCode = 400;
    throw err;
  }

  const { data: deal, error: dealErr } = await sb
    .from('deals')
    .select('id, metadata')
    .eq('id', dealId)
    .single();
  if (dealErr) {
    const err = new Error(`Deal lookup failed: ${dealErr.message}`);
    err.statusCode = 404;
    throw err;
  }
  const metadata = deal?.metadata || {};
  const classified = Array.isArray(metadata.classified_sections)
    ? metadata.classified_sections
    : null;
  if (!classified) {
    const err = new Error(
      'No classified_sections on deal — run /api/ingest/classify first',
    );
    err.statusCode = 404;
    throw err;
  }

  const cleaned = metadata.full_text || '';

  // Map persisted shape back to what extract expects
  const sectionsForExtract = classified.map((s) => ({
    text: s.text || '',
    body: s.text || '',
    startChar: typeof s.startChar === 'number' ? s.startChar : 0,
    start: typeof s.startChar === 'number' ? s.startChar : 0,
    number: s.sectionNumber || null,
    sectionNumber: s.sectionNumber || null,
    title: s.title || null,
    heading: s.title || null,
    articleType: s.articleType || null,
    provision_type: s.type || null,
    provisionType: s.type || null,
    provisionCode: s.code || null,
  }));

  const t0 = Date.now();
  const extracted = await extractProvisionsForType(
    sectionsForExtract,
    type,
    client,
    cleaned,
  );

  // Light post-processing for the standalone call: enforce canonical codes
  // and consolidate proposed codes. We do NOT run cross-type passes like
  // linkBringDownToReps here — those operate across REP+COND and only make
  // sense in the all-types path.
  try {
    await enforceCanonicalCodes(extracted, client);
    await consolidateProposedCodes(extracted, client);
  } catch (err) {
    console.warn('[extract-type] code enforcement failed:', err.message);
  }

  // Validate (lightweight — just shape/coverage flags). Pass only the
  // sections that belong to this type group so the coverage report stays
  // sensible.
  const groupSet = new Set(expandTypeGroup(type));
  const typeSections = sectionsForExtract.filter((s) =>
    groupSet.has(s.provision_type),
  );
  let validation;
  try {
    validation = validateProvisions(extracted, cleaned, typeSections);
  } catch (err) {
    console.warn('[extract-type] validation failed:', err.message);
    validation = { provisions: extracted, report: { errors: [err.message] } };
  }
  const finalProvisions = (validation && validation.provisions) || extracted;

  const storeResult = await storeProvisionsForType(dealId, type, finalProvisions, sb);

  // Update deal.metadata.extract_status[type]
  const completedAt = new Date().toISOString();
  const newStatus = {
    ...(metadata.extract_status || {}),
    [type]: {
      status: 'done',
      completed_at: completedAt,
      inserted: storeResult.insertedCount,
      deleted: storeResult.deletedCount,
      errors: storeResult.errors || null,
    },
  };
  const nextMetadata = { ...metadata, extract_status: newStatus };
  const { error: updErr } = await sb
    .from('deals')
    .update({ metadata: nextMetadata })
    .eq('id', dealId);
  if (updErr) {
    console.warn('[extract-type] metadata update failed:', updErr.message);
  }

  return {
    type,
    provisions_inserted: storeResult.insertedCount,
    provisions_deleted: storeResult.deletedCount,
    errors: storeResult.errors,
    timing_ms: Date.now() - t0,
  };
}

/**
 * Mark a type's extract_status as 'failed' with the error message (used by
 * run-all when an individual extract throws).
 */
async function markExtractFailed(sb, dealId, type, errorMessage) {
  try {
    const { data: deal } = await sb
      .from('deals')
      .select('metadata')
      .eq('id', dealId)
      .single();
    const metadata = deal?.metadata || {};
    const newStatus = {
      ...(metadata.extract_status || {}),
      [type]: {
        status: 'failed',
        completed_at: new Date().toISOString(),
        error: errorMessage,
      },
    };
    await sb
      .from('deals')
      .update({ metadata: { ...metadata, extract_status: newStatus } })
      .eq('id', dealId);
  } catch (err) {
    console.warn('[extract-type] failed-status write failed:', err.message);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { deal_id, type } = req.body || {};
  if (!deal_id || !type) {
    return res.status(400).json({ error: 'deal_id and type are required' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  const sb = getServiceSupabase();
  if (!sb) return res.status(500).json({ error: 'Supabase not configured' });

  const client = new Anthropic({ apiKey });

  try {
    const result = await runExtractTypePhase({ dealId: deal_id, type, sb, client });
    return res.status(200).json({
      success: true,
      deal_id,
      ...result,
    });
  } catch (err) {
    console.error('[ingest/extract-type] error:', err);
    await markExtractFailed(sb, deal_id, type, err.message);
    const status = err.statusCode || 500;
    return res.status(status).json({
      success: false,
      deal_id,
      type,
      error: err.message || 'Extract failed',
    });
  }
}

export { runExtractTypePhase, markExtractFailed };
