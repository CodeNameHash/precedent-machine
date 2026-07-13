const crypto = require('crypto');
const { FEATURES } = require('../schema/features');

// ---------------------------------------------------------------------------
// WP-CLAIMS-INGEST-WRITER: ingest-time claims writer.
//
// Companion to lib/parser-v2/store-cards.js (the "seam" that TODO called
// out at the old line ~303). Given the SAME extraction output a deal's
// provision_cards were built from, this module derives that deal's
// public.claims rows and anchors each one NATIVELY to the card's
// excerpt_id/provision_instance_id -- no text-match reconstruction, unlike
// scripts/backfill/claims-from-normalized.js, which had to recover the
// anchor after the fact via provisions.full_text === region_full_text
// (see supabase/schema-05-claims.sql header). At ingest time the card row
// and the source provision are still index-aligned in memory, so the
// anchor is exact by construction.
//
// Faithful-materialisation rules (mirrors the backfill, see
// scripts/backfill/claims-from-normalized.js header + PLAN-CLAIMS-LAYER.md):
//   1. verbatim is copied from the value AS WRITTEN. For extract.js's tagged
//      objects ({code,label,text[,quotes]} or a `{value,quotes}` citable
//      wrapper around one) that means the human-readable `text`/`label`,
//      NOT the taxonomy `code` -- this must agree with the READ side,
//      lib/queries/claims-adapter.js, which puts claim.verbatim into the
//      tagged object's `text` and claim.canonical into its `code`
//      (see buildTaggedValue there; also exercised by
//      tests/queries/claims-adapter.test.js).
//   2. canonical is nullable and NEVER fabricated: it is populated only from
//      a value's own extractor-assigned taxonomy `code`, or (for a bare
//      scalar declared `enum` in the registry) an exact case-insensitive
//      match against that feature's registry enumSet. No fuzzy/synonym
//      resolution happens here -- lib/queries/claims-adapter.js already
//      owns a synonym-fallback (deriveCode) on the read side for claims
//      whose canonical is null, so duplicating that guesswork at ingest
//      time would just create two disagreeing sources of "canonical".
//   3. Registry-gated: only feature-bag keys present in lib/schema/features.js
//      FEATURES are materialised. Unknown keys are routed to
//      `unknownAttributes` (returned to the caller, and console.warn'd once
//      per deal) -- never coerced into a claim.
//   4. Provenance carries extractor identity + the raw feature value
//      (verbatim jsonb), never merged into canonical.
// ---------------------------------------------------------------------------

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function trimmedString(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function cleanQuotes(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((quote) => typeof quote === 'string' && quote.trim()).map((quote) => quote.trim());
}

// Unwraps extract.js's citable `{ value, quotes }` wrapper (see the
// "CITATION RULE" prompt block), carrying quotes down to whichever inner
// shape `value` turns out to be (a bare scalar or a tagged object). Only
// unwraps objects that actually look like the wrapper (have a `value` key
// alongside `quotes`) so a legitimate tagged object that happens to have a
// field literally named `value` isn't misread -- tagged objects are keyed
// by `code`/`label`/`text`, never `value`.
function unwrapCitable(rawValue, inheritedQuotes) {
  if (isPlainObject(rawValue) && 'value' in rawValue && !('code' in rawValue) && !('text' in rawValue) && !('label' in rawValue)) {
    const ownQuotes = cleanQuotes(rawValue.quotes);
    return unwrapCitable(rawValue.value, ownQuotes.length ? ownQuotes : inheritedQuotes);
  }
  return { value: rawValue, quotes: inheritedQuotes || [] };
}

function scalarToVerbatim(value) {
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'number') return String(value);
  return trimmedString(value);
}

function canonicalForScalar(registryEntry, verbatim) {
  if (!registryEntry || !Array.isArray(registryEntry.enumSet) || !verbatim) return null;
  const match = registryEntry.enumSet.find((candidate) => String(candidate).toLowerCase() === verbatim.toLowerCase());
  return match == null ? null : String(match);
}

// One feature-bag entry -> zero, one, or many atomic claim values (a list
// feature expands to one entry per item). Never fabricates a canonical or
// an evidence_quote -- both are left null when the source doesn't supply
// one.
function atomicValues(rawFeatureValue, registryEntry, inheritedQuotes = []) {
  if (rawFeatureValue === null || rawFeatureValue === undefined) return [];
  if (Array.isArray(rawFeatureValue)) {
    return rawFeatureValue.flatMap((item) => atomicValues(item, registryEntry, inheritedQuotes));
  }

  const { value, quotes } = unwrapCitable(rawFeatureValue, inheritedQuotes);
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return atomicValues(value, registryEntry, quotes);

  if (isPlainObject(value)) {
    const hasTag = 'code' in value || 'label' in value || 'text' in value;
    if (hasTag) {
      const text = trimmedString(value.text);
      const label = trimmedString(value.label);
      const code = value.code === null || value.code === undefined ? null : trimmedString(String(value.code));
      const verbatim = text || label || code;
      if (verbatim === null) return [];
      const ownQuotes = cleanQuotes(value.quotes);
      const finalQuotes = ownQuotes.length ? ownQuotes : quotes;
      return [{
        verbatim,
        canonical: code,
        evidenceQuote: finalQuotes[0] || null,
        rawFeatureValue: value,
      }];
    }
    // Untagged structured object (e.g. a compensationItems line item):
    // store compact JSON as verbatim, exactly as the backfill does for the
    // same shape (see supabase/schema-05-claims.sql COMMENT ON COLUMN
    // public.claims.verbatim). Never fabricate a canonical for these.
    const compact = JSON.stringify(value);
    if (!compact || compact === '{}') return [];
    return [{
      verbatim: compact,
      canonical: null,
      evidenceQuote: quotes[0] || null,
      rawFeatureValue: value,
    }];
  }

  const verbatim = scalarToVerbatim(value);
  if (verbatim === null) return [];
  return [{
    verbatim,
    canonical: canonicalForScalar(registryEntry, verbatim),
    evidenceQuote: quotes[0] || null,
    rawFeatureValue: value,
  }];
}

function featureBagOf(prov) {
  if (prov.features && typeof prov.features === 'object') return prov.features;
  if (prov.ai_metadata && prov.ai_metadata.features && typeof prov.ai_metadata.features === 'object') return prov.ai_metadata.features;
  return {};
}

function claimId(excerptId, attribute, index) {
  return crypto.createHash('sha256').update(`${excerptId}|${attribute}|${index}`).digest('hex').slice(0, 24);
}

function extractorCode(prov) {
  return prov.code || prov.provision_subtype || prov.provisionSubtype || (prov.ai_metadata && prov.ai_metadata.code) || null;
}

function buildClaimProvenance(prov, attribute, atom, options) {
  return {
    extractor_id: options.extractorName || prov.extractor_name || prov.extractedBy || prov.extracted_by || 'parser-v2',
    extractor_version: options.extractionVersion || prov.extraction_version || prov.extractionVersion || null,
    extracted_at: options.extractedAt || prov.extracted_at || null,
    model: options.model || null,
    run_id: options.runId || null,
    code: extractorCode(prov),
    feature_key: attribute,
    feature_value: atom.rawFeatureValue,
    anchor_method: 'native_excerpt_id',
  };
}

// Builds every claim row for a single card, given the CARD row
// (storeProvisionCards's already-computed excerpt_id/provision_instance_id/
// region_id) and the SOURCE provision it was built from (carries the
// feature bag). `cardRow` and `prov` must be the index-aligned pair
// produced by the same extractorOutput -> buildProvisionCardRows pass, so
// the anchor is exact -- no text matching.
function buildClaimRowsForCard(dealId, cardRow, prov, options = {}) {
  const featureBag = featureBagOf(prov);
  const rows = [];
  const unknownAttributes = [];
  for (const [attribute, rawValue] of Object.entries(featureBag)) {
    const registryEntry = FEATURES[attribute];
    if (!registryEntry) {
      unknownAttributes.push(attribute);
      continue;
    }
    const atoms = atomicValues(rawValue, registryEntry);
    atoms.forEach((atom, index) => {
      rows.push({
        id: claimId(cardRow.excerpt_id, attribute, index),
        deal_id: dealId,
        excerpt_id: cardRow.excerpt_id,
        provision_instance_id: cardRow.provision_instance_id,
        region_id: cardRow.region_id || null,
        attribute,
        verbatim: atom.verbatim,
        evidence_quote: atom.evidenceQuote,
        canonical: atom.canonical,
        provenance: buildClaimProvenance(prov, attribute, atom, options),
        source_provision_id: prov.id || prov.source_provision_id || prov.sourceProvisionId || null,
      });
    });
  }
  return { rows, unknownAttributes };
}

// Builds every claim row for a whole deal's worth of cards. `cardRows` and
// `provisions` must be the same index-aligned pair storeProvisionCards
// already computed (cardRows[i] was built from provisions[i]).
function buildClaimRowsForDeal(dealId, cardRows, provisions, options = {}) {
  const rows = [];
  const unknownAttributeCounts = new Map();
  for (let i = 0; i < cardRows.length; i += 1) {
    const { rows: cardClaims, unknownAttributes } = buildClaimRowsForCard(dealId, cardRows[i], provisions[i], options);
    rows.push(...cardClaims);
    for (const attribute of unknownAttributes) {
      unknownAttributeCounts.set(attribute, (unknownAttributeCounts.get(attribute) || 0) + 1);
    }
  }
  return { rows, unknownAttributeCounts };
}

const UPSERT_BATCH_SIZE = 500;

async function upsertClaims(sb, rows) {
  for (let i = 0; i < rows.length; i += UPSERT_BATCH_SIZE) {
    const batch = rows.slice(i, i + UPSERT_BATCH_SIZE);
    const { error } = await sb.from('claims').upsert(batch, { onConflict: 'id' });
    if (error) throw new Error(`Failed to upsert claims: ${error.message}`);
  }
}

// Re-ingest safety for claims on a card that SURVIVES re-extraction (same
// excerpt_id, still present): the card row itself isn't deleted (see the
// WRITE ORDER comment in store-cards.js), so a claim that existed for this
// excerpt_id in a prior ingest but is absent from the CURRENT feature bag
// (a value was removed / a list shrank) would otherwise linger forever.
// Deletes only claims whose excerpt_id is in the surviving set AND whose id
// is not among the ids this run just wrote for that excerpt_id.
//
// Claims belonging to a card that did NOT survive (an orphaned
// provision_instance_id) are NOT handled here -- they are cleaned up for
// free by the ON DELETE CASCADE FK from claims.excerpt_id to
// provision_cards.excerpt_id (schema-05-claims.sql) when
// storeProvisionCards deletes that orphaned card row.
// Excerpt ids are long human-readable strings; a single .in() over a whole
// deal's worth of them overflows the request line (PostgREST 431 "Request
// Header Fields Too Large"), so both the read and the delete are chunked.
const STALE_LOOKUP_BATCH_SIZE = 50;

async function deleteStaleClaimsForSurvivors(sb, dealId, survivorExcerptIds, keepClaimIds) {
  if (survivorExcerptIds.length === 0) return 0;
  const staleIds = [];
  for (let i = 0; i < survivorExcerptIds.length; i += STALE_LOOKUP_BATCH_SIZE) {
    const batch = survivorExcerptIds.slice(i, i + STALE_LOOKUP_BATCH_SIZE);
    const { data, error } = await sb
      .from('claims')
      .select('id,excerpt_id')
      .eq('deal_id', dealId)
      .in('excerpt_id', batch);
    if (error) throw new Error(`Failed to read existing claims for stale cleanup: ${error.message}`);
    for (const row of data || []) {
      if (!keepClaimIds.has(row.id)) staleIds.push(row.id);
    }
  }
  if (staleIds.length === 0) return 0;
  for (let i = 0; i < staleIds.length; i += UPSERT_BATCH_SIZE) {
    const batch = staleIds.slice(i, i + UPSERT_BATCH_SIZE);
    const { error: deleteError } = await sb
      .from('claims')
      .delete()
      .eq('deal_id', dealId)
      .in('id', batch);
    if (deleteError) throw new Error(`Failed to delete stale claims: ${deleteError.message}`);
  }
  return staleIds.length;
}

// Writes public.claims for a deal atomically alongside its provision_cards.
// Called by storeProvisionCards AFTER both the cards upsert (so excerpt_id
// values exist to anchor to) and the cards orphan-delete (so any claims
// belonging to a just-removed card have already cascade-deleted before this
// function's own stale-claim cleanup -- scoped to the surviving excerpt_ids
// only -- runs).
async function storeClaimsForDeal(dealId, cardRows, provisions, sb, options = {}) {
  if (!sb) throw new Error('Supabase client is required');
  const { rows, unknownAttributeCounts } = buildClaimRowsForDeal(dealId, cardRows, provisions, options);
  await upsertClaims(sb, rows);

  let staleDeleted = 0;
  if (options.replaceDeal) {
    const survivorExcerptIds = cardRows.map((row) => row.excerpt_id);
    const keepClaimIds = new Set(rows.map((row) => row.id));
    staleDeleted = await deleteStaleClaimsForSurvivors(sb, dealId, survivorExcerptIds, keepClaimIds);
  }

  if (unknownAttributeCounts.size > 0) {
    const summary = [...unknownAttributeCounts.entries()].sort((a, b) => b[1] - a[1]);
    // eslint-disable-next-line no-console
    console.warn(`[store-claims] deal ${dealId}: ${summary.length} registry-unknown feature key(s) skipped: ${summary.map(([key, count]) => `${key}(${count})`).join(', ')}`);
  }

  return {
    rows,
    insertedCount: rows.length,
    staleDeleted,
    unknownAttributes: [...unknownAttributeCounts.keys()],
  };
}

module.exports = {
  atomicValues,
  buildClaimProvenance,
  buildClaimRowsForCard,
  buildClaimRowsForDeal,
  claimId,
  deleteStaleClaimsForSurvivors,
  storeClaimsForDeal,
  upsertClaims,
};
