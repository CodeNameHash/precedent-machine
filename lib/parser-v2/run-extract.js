/* ─────────────────────────────────────────────────────────────────────────
   lib/parser-v2/run-extract.js — the single-type extraction phase, liftable.
   ───────────────────────────────────────────────────────────────────────────
   Lifted verbatim from pages/api/ingest/extract-type.js so the SAME
   orchestration runs from two entry points:

     • the API route (Vercel, Anthropic API client, 300s budget), and
     • scripts/extract-local.js (local, CLI-backed clients from
       lib/llm-cli-client.js — Claude Max / ChatGPT subscriptions, no token
       metering, no time budget).

   CommonJS on purpose (repo pattern: ESM pages can import CJS libs; local
   Node scripts can require them; the reverse does not work).

   Both `sb` (Supabase client) and `client` (anything exposing
   messages.create) are injected — this module never constructs credentials.
   ───────────────────────────────────────────────────────────────────────── */

const {
  extractProvisionsForType,
  expandTypeGroup,
  filterProvisionsToTypeGroup,
  enforceCanonicalCodes,
  consolidateProposedCodes,
} = require('./extract');
const { validateProvisions } = require('./validate');
const { storeProvisionsForType } = require('./store');
const { sectionsForExtractFromSnapshot } = require('./snapshot');
const { buildRunRecord, appendRunRecord, snapshotProvision } = require('../run-history');
const { reapplyCorrections } = require('./reapply-corrections');
const { MODEL } = require('../model');

/**
 * Run classify-output → extract → validate → store for a single type group.
 * Returns { type, provisions_inserted, provisions_deleted, errors, timing_ms }.
 * Throws with err.statusCode set for caller-mapped HTTP errors.
 */
async function runExtractTypePhase({ dealId, type, sb, client, dryRun = false }) {
  if (!type) {
    const err = new Error('type is required');
    err.statusCode = 400;
    throw err;
  }

  const { data: deal, error: dealErr } = await sb
    .from('deals')
    .select('id, metadata, announce_date')
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
  const dealMeta = {
    signingDate:
      metadata.signingDate ||
      metadata.signing_date ||
      metadata.announceDate ||
      metadata.announce_date ||
      deal?.announce_date ||
      null,
  };

  // Map persisted shape back to what extract expects
  const sectionsForExtract = sectionsForExtractFromSnapshot(classified);

  const t0 = Date.now();
  const extracted = await extractProvisionsForType(
    sectionsForExtract,
    type,
    client,
    cleaned,
    dealMeta,
  );

  // Light post-processing for the standalone call: enforce canonical codes
  // and consolidate proposed codes. We do NOT run cross-type passes like
  // linkBringDownToReps here — those operate across REP+COND and only make
  // sense in the all-types path.
  try {
    await enforceCanonicalCodes(extracted, client);
    await consolidateProposedCodes(extracted, client);
  } catch (err) {
    console.warn('[run-extract] code enforcement failed:', err.message);
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
    console.warn('[run-extract] validation failed:', err.message);
    validation = { provisions: extracted, report: { errors: [err.message] } };
  }
  const finalProvisions = filterProvisionsToTypeGroup(
    type,
    (validation && validation.provisions) || extracted,
  );

  // Dry run: full extraction, no writes — return what WOULD be stored so
  // callers can diff against current data without touching production.
  if (dryRun) {
    return {
      type,
      dry_run: true,
      would_insert: finalProvisions.length,
      // Snapshot rows (lib/run-history.js) — same shape run records use, so
      // callers can diff a dry run against stored data or past runs.
      provisions: finalProvisions.map(snapshotProvision),
      timing_ms: Date.now() - t0,
    };
  }

  const storeResult = await storeProvisionsForType(dealId, type, finalProvisions, sb);

  // Re-apply human corrections onto the fresh provisions — re-extraction must
  // never silently discard review work. Best-effort; failures are reported,
  // not thrown.
  let corrections = { applied: 0, unmatched: [], errors: [] };
  try {
    corrections = await reapplyCorrections({ dealId, typeGroup: expandTypeGroup(type), sb });
  } catch (err) {
    corrections.errors.push(err.message);
  }

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
  // Run record: backend/model/timings + a snapshot of what was stored, so
  // any two runs (or a run vs current data) can be diffed later.
  const runRecord = buildRunRecord({
    type,
    backend: client && client.backend ? client.backend : 'api',
    model: client && client.model ? client.model : MODEL,
    timingMs: Date.now() - t0,
    inserted: storeResult.insertedCount,
    deleted: storeResult.deletedCount,
    provisions: finalProvisions,
  });
  runRecord.corrections_reapplied = corrections.applied;
  if (corrections.unmatched.length) runRecord.corrections_unmatched = corrections.unmatched;
  const nextMetadata = appendRunRecord({ ...metadata, extract_status: newStatus }, runRecord);
  const { error: updErr } = await sb
    .from('deals')
    .update({ metadata: nextMetadata })
    .eq('id', dealId);
  if (updErr) {
    console.warn('[run-extract] metadata update failed:', updErr.message);
  }

  return {
    type,
    provisions_inserted: storeResult.insertedCount,
    provisions_deleted: storeResult.deletedCount,
    corrections_reapplied: corrections.applied,
    corrections_unmatched: corrections.unmatched.length,
    errors: [...(storeResult.errors || []), ...corrections.errors],
    timing_ms: Date.now() - t0,
  };
}

/**
 * Mark a type's extract_status as 'failed' with the error message (used by
 * callers when an individual extract throws).
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
    console.warn('[run-extract] failed-status write failed:', err.message);
  }
}

module.exports = { runExtractTypePhase, markExtractFailed };
