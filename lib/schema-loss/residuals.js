// lib/schema-loss/residuals.js — GAP-E residual-capture PLUMBING (read path only).
//
// Scope line (see docs/schema-shape/provision-processing-flow.md GAP-E and
// provision-taxonomy-triple-model.md § 8.5): this module NEVER assigns a
// code, never adds a vocabulary entry, and never edits the rubric or
// registry. It only DETECTS, from claims data that already exists, the
// altitude-2 residual case described in § 8.5: a claim whose attribute has
// an allowlisted codebook (an `enumSet` or a `listItemTagFamily` in
// lib/schema/features.js) came back with no code — `canonical` is null
// while `verbatim` is populated. That is "the model saw this and nothing
// fit", captured for review, never force-mapped onto the nearest code.
//
// Feature-gated: every entry point here honors RESIDUAL_CAPTURE_ENABLED.
// When the flag is off (the default), computeFeatureResiduals returns an
// empty array unconditionally — zero behavior change for every existing
// caller. Nothing outside this module needs to know the flag exists.
//
// Deliberately dependency-light (CommonJS, no framework imports) so it can
// be required from a script, an API route, or a hermetic node:test file
// without pulling in Next.js or a live Supabase connection.

const { getFeature } = require('../schema');

const TRUE_VALUES = new Set(['1', 'true', 'on', 'yes']);

/** Reads the feature flag. `env` is injectable so tests never have to
 * mutate process.env (and therefore never leak state across test files). */
function isResidualCaptureEnabled(env = process.env) {
  const raw = env && env.RESIDUAL_CAPTURE_ENABLED;
  if (raw == null) return false;
  return TRUE_VALUES.has(String(raw).trim().toLowerCase());
}

/** Does this attribute have an allowlisted codebook at all? Covers both
 * coded shapes already in lib/schema/features.js:
 *   - scalar enum:  valueType === 'enum' with a non-empty enumSet
 *   - list-tagged:  listItemType === 'tag' with a listItemTagFamily
 * Returns null (no codebook / unknown attribute) rather than false so
 * callers can distinguish "not a coded feature" from "coded feature with
 * this family". Never consults extraction prompts or the rubric directly —
 * only the already-generated registry. */
function codebookFor(attribute) {
  const feature = getFeature(attribute);
  if (!feature) return null;
  if (feature.valueType === 'enum' && Array.isArray(feature.enumSet) && feature.enumSet.length > 0) {
    return { kind: 'enum', family: null, enumSet: feature.enumSet };
  }
  if (feature.listItemType === 'tag' && feature.listItemTagFamily) {
    return { kind: 'list-tagged', family: feature.listItemTagFamily, enumSet: null };
  }
  return null;
}

function hasCodebook(attribute) {
  return codebookFor(attribute) !== null;
}

function trimmedOrNull(value) {
  if (typeof value !== 'string') return value == null ? null : value;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

// Normalizes across the two claim shapes seen in this codebase: the live
// public.claims row (attribute/verbatim/canonical, supabase/schema-05-claims.sql)
// and the offline normalized-v1.json triple shape used by the existing
// schema-loss audits (field_key/raw_value/canonicalKey, see
// scripts/schema-loss/audit-residuals.js). Reads only — never writes either
// shape back.
function normalizeClaim(claim) {
  const attribute = claim.attribute != null ? claim.attribute : claim.field_key;
  const verbatim = claim.verbatim != null ? claim.verbatim : claim.raw_value;
  const canonical = claim.canonical !== undefined ? claim.canonical : claim.canonicalKey;
  return {
    id: claim.id || null,
    deal_id: claim.deal_id || null,
    attribute,
    verbatim,
    canonical,
    evidence_quote: claim.evidence_quote != null ? claim.evidence_quote : null,
  };
}

/** True iff this single (already-normalized) claim is a GAP-E residual: its
 * attribute carries a codebook, but the claim resolved with no code while
 * still carrying verbatim text. Never mutates the claim. */
function isResidualClaim(normalizedClaim) {
  const { attribute, verbatim, canonical } = normalizedClaim;
  if (!attribute) return false;
  if (!hasCodebook(attribute)) return false;
  if (trimmedOrNull(canonical) !== null) return false; // has a code -> not a residual
  return trimmedOrNull(verbatim) !== null; // verbatim-only outcome
}

/** Builds the read-only residual descriptor surfaced to the admin panel.
 * Carries the verbatim text through byte-for-byte (no trimming, no
 * re-encoding) alongside the codebook it failed to match, so a reviewer can
 * judge fit without the tool guessing for them. */
function buildResidualEntry(normalizedClaim) {
  const codebook = codebookFor(normalizedClaim.attribute);
  return {
    id: normalizedClaim.id,
    deal_id: normalizedClaim.deal_id,
    attribute: normalizedClaim.attribute,
    codebook_kind: codebook.kind,
    family: codebook.family,
    verbatim: normalizedClaim.verbatim,
    evidence_quote: normalizedClaim.evidence_quote,
    canonical: normalizedClaim.canonical == null ? null : normalizedClaim.canonical,
    reason: 'no-code-for-allowlisted-feature',
  };
}

/** Main entry point. `claims` is any array of claim-shaped objects (live
 * `public.claims` rows or normalized-v1.json triples). Returns [] whenever
 * the flag is off (default) or `claims` isn't a usable array — that is the
 * entire "zero behavior change" contract for this module. Pass
 * `{ enabled: true }` to bypass the env read in tests without touching
 * process.env. */
function computeFeatureResiduals(claims, options = {}) {
  const enabled = options.enabled === undefined ? isResidualCaptureEnabled(options.env) : options.enabled;
  if (!enabled) return [];
  if (!Array.isArray(claims)) return [];
  return claims
    .map(normalizeClaim)
    .filter(isResidualClaim)
    .map(buildResidualEntry);
}

module.exports = {
  buildResidualEntry,
  codebookFor,
  computeFeatureResiduals,
  hasCodebook,
  isResidualCaptureEnabled,
  isResidualClaim,
  normalizeClaim,
};
