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
  enforceCanonicalCodes,
  consolidateProposedCodes,
} = require('./extract');
const { validateProvisions } = require('./validate');
const { storeProvisionsForType } = require('./store');

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
  const finalProvisions = (validation && validation.provisions) || extracted;

  // Dry run: full extraction, no writes — return what WOULD be stored so
  // callers can diff against current data without touching production.
  if (dryRun) {
    return {
      type,
      dry_run: true,
      would_insert: finalProvisions.length,
      // In-memory provisions carry `text`/`features`; storeProvisionsForType
      // maps them to full_text/ai_metadata at write time.
      provisions: finalProvisions.map((p) => ({
        type: p.type,
        category: p.category,
        code: (p.features && p.features.canonicalCode) || p.code || null,
        text_chars: (p.text || '').length,
        feature_keys: Object.keys(p.features || {}),
      })),
      timing_ms: Date.now() - t0,
    };
  }

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
    console.warn('[run-extract] metadata update failed:', updErr.message);
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
