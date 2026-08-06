'use strict';

// Representations dark bridge -- local/pre-production preview ONLY.
// Production authority is NONE. Every card and claim this module emits stays
// stamped authority_state = 'VALIDATED_NOT_SERVED' and
// source_authentication_state = 'SOURCE_UNAUTHENTICATED_EXTERNAL_BOUNDARY'.
// Nothing here ever gains serving authority.
//
// This module COPIES the structural/validation pattern established by
// lib/canonical-v2/legacy-card-bridge.js (the Material Contracts dark
// bridge) -- the same error-class shape, the same fail-closed philosophy,
// the same content-addressed identity discipline, the same card+claims split
// -- adapted for a materially different input shape. legacy-card-bridge.js
// is Material-Contracts-specific (it hardcodes REP-T-MATERIAL-CONTRACTS, the
// materialContractsBuckets feature, the REP-T-CONTRACTS claim provenance
// code, ...) and is never imported or called from here.
//
// WHY THIS BRIDGE NEEDS AN EXPLICIT ADAPTER STEP
// representations-product-projection.js's projectRepresentationClaims()
// does not emit card-shaped data the way material-contracts-product-
// projection.js does. It emits query/compare/market-oriented "product
// records" -- one projection_record_id per GOVERNED CLAIM, not per
// PROVISION -- with no id/deal_id/excerpt_id/short_title/provision_type
// fields anywhere (see its RECORD_SCHEMA body literal).
//
// A single representation routinely carries more than one governed claim
// (an accuracy-standard claim and a knowledge-qualifier claim both attach to
// the same provision_instance_id). Mapping one record straight to one card
// would fabricate several distinct legacy cards for what the agreement
// contains as a single provision -- exactly the card/claim conflation the
// legacy schema (and the Material Contracts bridge) already avoids by
// keeping one card with several bound claims. So the adapter here works in
// two steps:
//   1. groupGovernedRecordsByProvision groups the validated records by their
//      shared provision_instance_id.
//   2. adaptProvisionGroupToLegacyCard resolves ONE legacy join per group and
//      emits ONE card (one provision) plus one claim per record in the group
//      (one claim per governed fact about that provision) -- mirroring the
//      legacy card/claims shape exactly.
//
// WHAT IS SOURCED VS. RESOLVED VS. NEVER FABRICATED
//   - claim_revision_id, evidence.quote, review.*, query/compare/market are
//     real, sourced fields on each record, verified against the record's own
//     recomputed content hash.
//   - excerpt_id and deal_id exist NOWHERE in the projection (zero
//     occurrences of "excerpt" in representations-product-projection.js).
//     They are RESOLVED, never fabricated, by an exact, unambiguous join of
//     provision_instance_id against the target reviewDeal's own legacy
//     cards -- see indexLegacyCardsByProvisionInstanceId /
//     resolveLegacyJoinTarget. Zero matches or more than one match both fail
//     closed, with distinct error codes, rather than guessing.
//   - short_title, section_ref and the card's retained text are borrowed
//     from the joined legacy card (governed/joinable path only) instead of
//     invented. Every claim's own evidence.quote must occur verbatim inside
//     that legacy card's own retained text, or the bridge fails closed -- a
//     claim cannot be grounded in text its own joined provision never
//     contains. Records that resolve to the same provision but disagree on
//     side, concept key or section reference fail closed too (a genuine
//     disagreement means the join is wrong and must not be smoothed over).
//   - Open-world representation evidence carries no provision_instance_id at
//     all (why_unmapped is a required field precisely because this content
//     has no governed home yet) -- there is nothing to join against and
//     nothing to group. Its identity is derived from its own
//     content-addressed projection_record_id instead; deal_id still comes
//     from the target reviewDeal, same as the governed path. It never gets a
//     bound claim (open-world evidence carries no governed feature).
//
// NO CLOSED REPRESENTATION-SUBJECT CATALOGUE
// This module never maps a concept_key to a hand-authored subject name.
// provision_subtype is the raw concept_key, verbatim. short_title comes
// from the joined legacy card's OWN short_title when one exists (governed
// path), or stays null (never guessed) for open-world evidence. There is no
// dictionary anywhere in this file keyed on representation subject.

const {
  PROJECTION_SCHEMA: SOURCE_PROJECTION_SCHEMA,
  RECORD_SCHEMA: SOURCE_RECORD_SCHEMA,
  OPEN_WORLD_RECORD_SCHEMA: SOURCE_OPEN_WORLD_RECORD_SCHEMA,
  AUTHORITY_STATE,
  ACCURACY_CODES,
  KNOWLEDGE_STANDARDS,
  GOVERNED_CLAIMS,
} = require('./representations-product-projection');
const { canonicalJson, contentId } = require('./canonical-bytes');
const { assertDarkBridgeIntegrationAllowed } = require('./dark-bridge-gate');
const { hasUnclosedNegationBeforeSpan } = require('../negation-boundary-guard');

// Mirrors (does NOT import -- private to representations-product-
// projection.js, not in its module.exports) the ownership-boundary
// concept_key blocklist defined there (around lines 18-31). Those concepts
// are owned by other families' bridges (Material Contracts, No-Other-Reps &
// Fraud) and must never surface as a representations claim here. The
// upstream projectRepresentationClaims() already refuses to construct a
// record naming one of these, but this bridge never trusts an input
// projection blindly -- a hand-crafted or resealed-after-tampering
// projection object is exactly what the hostile tests exercise.
const EXCLUDED_CONCEPTS = Object.freeze(new Set([
  'REP-T-CONTRACTS',
  'REP-T-MATERIAL-CONTRACTS',
  'REP-B-CONTRACTS',
  'REP-B-MATERIAL-CONTRACTS',
  'REP-T-NOOTHERREPS',
  'REP-B-NOOTHERREPS',
  'REP-T-NONRELIANCE',
  'REP-B-NONRELIANCE',
  'REP-T-INDEPINVEST',
  'REP-B-INDEPINVEST',
  'REP-T-FRAUDCARVEOUT',
  'REP-B-FRAUDCARVEOUT',
]));

// Mirrors QUALIFIER_POSITIONS (private to representations-product-
// projection.js).
const QUALIFIER_POSITIONS = Object.freeze(['CHAPEAU', 'ITEM', 'TRAILING']);

const BRIDGE_SCHEMA = 'CANONICAL_V2_REPRESENTATIONS_LEGACY_CARD_BRIDGE/V1';
const CARD_SCHEMA = 'CANONICAL_V2_REPRESENTATIONS_LEGACY_CARD/V1';
const SOURCE_AUTHENTICATION_STATE = 'SOURCE_UNAUTHENTICATED_EXTERNAL_BOUNDARY';
const ID_PREFIX = 'cv2:';
const NATIVE_SOURCE = 'CANONICAL_V2_NATIVE_CLAIM';
const EVIDENCE_SOURCE = 'CANONICAL_V2_OPEN_WORLD_EVIDENCE';
const OPEN_WORLD_PROVISION_SUBTYPE = 'REP-EVIDENCE-OPEN-WORLD';
const ATTRIBUTE_BY_CLAIM_DEFINITION = Object.freeze({
  REPRESENTATION_ACCURACY_STANDARD: 'materialityQualifier',
  KNOWLEDGE_QUALIFIER: 'knowledgeQualifier',
});
const GOVERNED_ATTRIBUTES = Object.freeze(Object.values(ATTRIBUTE_BY_CLAIM_DEFINITION));
const LOWERCASE_SHA256 = /^[0-9a-f]{64}$/;
const MAX_PLAIN_DEPTH = 64;
const MAX_PLAIN_WIDTH = 50000;
const MAX_PLAIN_NODES = 250000;
const MAX_PLAIN_BYTES = 4 * 1024 * 1024;

const PROJECTION_FIELDS_REQUIRED = Object.freeze(['schema_version', 'authority_state', 'records', 'projection_id']);
const PROJECTION_FIELDS_OPTIONAL = Object.freeze(['open_items']);

const RECORD_FIELDS = Object.freeze([
  'schema_version', 'authority_state', 'owner_family', 'representation_side',
  'claim_revision_id', 'provision_instance_id', 'subject_occurrence_id',
  'evidence', 'review', 'query', 'compare', 'market', 'projection_record_id',
]);
const EVIDENCE_FIELDS = Object.freeze(['quote', 'category', 'spans']);
const REVIEW_FIELDS = Object.freeze(['section_key', 'row_key', 'label', 'value', 'dimensions', 'source_section_reference']);
const QUERY_COMPARE_FIELDS = Object.freeze(['field_key', 'value']);
const PRODUCT_VALUE_FIELDS = Object.freeze(['concept_key', 'claim_definition_key', 'canonical_value', 'dimensions']);
const DIMENSIONS_BASE_FIELDS = Object.freeze([
  'representation_side', 'representation_maker', 'representation_maker_capacity',
  'qualifier_position', 'qualifier_scope_state',
]);
const MARKET_FIELDS = Object.freeze([
  'metric_version', 'metric_key', 'value_dimension', 'canonical_unit',
  'canonical_value', 'breakdown', 'per_deal_rollup', 'weighting',
]);

const OPEN_WORLD_FIELDS = Object.freeze([
  'schema_version', 'authority_state', 'owner_family', 'candidate_kind',
  'category', 'quote', 'evidence', 'reason', 'why_unmapped',
  'nearest_concept', 'source_section_reference', 'certification_state',
  'comparison_eligible', 'projection_record_id',
]);

// Mirrors marketValue()'s two literal shapes in representations-product-
// projection.js. This is not a "representation subject catalogue" -- it is
// validating the CLAIM-KIND vocabulary, which GOVERNED_CLAIMS already
// closes upstream (exactly two governed claim kinds exist at all).
const EXPECTED_MARKET_SHAPE = Object.freeze({
  REPRESENTATION_ACCURACY_STANDARD: Object.freeze({
    metric_key: 'REPRESENTATION_ACCURACY_STANDARD',
    value_dimension: 'CATEGORICAL',
    canonical_unit: 'ACCURACY_STANDARD_CODE',
    per_deal_rollup: 'DISTINCT_VALUE_SET',
    weighting: 'DEAL',
  }),
  KNOWLEDGE_QUALIFIER: Object.freeze({
    metric_key: 'REPRESENTATION_KNOWLEDGE_QUALIFIER_PRESENCE',
    value_dimension: 'BOOLEAN_PRESENCE',
    canonical_unit: 'PRESENT_TRUE',
    per_deal_rollup: 'ANY_TRUE',
    weighting: 'DEAL',
  }),
});
const EXPECTED_FIELD_KEY = Object.freeze({ TARGET: 'targetRepresentationFact', PARENT: 'parentRepresentationFact' });
const EXPECTED_SECTION_KEY = Object.freeze({ TARGET: 'target-representations', PARENT: 'parent-representations' });
const EXPECTED_SIDE_PREFIX = Object.freeze({ TARGET: 'REP-T-', PARENT: 'REP-B-' });

const BRIDGE_FIELDS = Object.freeze([
  'schema_version', 'bridge_id', 'authority_state', 'source_authentication_state',
  'source_projection_schema', 'source_projection_id', 'deal_id', 'cards', 'claims', 'open_items',
]);
const GOVERNED_CARD_FIELDS = Object.freeze([
  'schema_version', 'id', 'deal_id', 'provision_instance_id',
  'excerpt_id', 'section_ref', 'short_title', 'kind', 'type', 'provision_type',
  'provision_subtype', 'primary_quote', 'primary_quote_span', 'region_full_text', 'features', 'ai_metadata',
  'canonical_v2_lineage', 'provenance', 'authority_state', 'source_authentication_state',
]);
const OPEN_WORLD_CARD_FIELDS = GOVERNED_CARD_FIELDS;
const CLAIM_FIELDS = Object.freeze([
  'id', 'deal_id', 'excerpt_id', 'provision_instance_id', 'attribute', 'canonical', 'verbatim',
  'verbatim_span', 'evidence_quote', 'provenance', 'authority_state', 'source_authentication_state',
]);
const CLAIM_PROVENANCE_FIELDS = Object.freeze([
  'code', 'source', 'source_claim_revision_ids', 'canonical_v2_authority_state', 'source_authentication_state',
]);

class RepresentationsDarkBridgeError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'RepresentationsDarkBridgeError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new RepresentationsDarkBridgeError(code, message, details);
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function requireObject(value, code, message) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype) {
    fail(code, message);
  }
  return value;
}

function assertSha256(value, code, message, details = {}) {
  if (!nonEmptyString(value) || !LOWERCASE_SHA256.test(value)) fail(code, message, details);
}

// -- grounding verification tiers --------------------------------------------
// A representation claim's own evidence quote (a materiality qualifier's
// text, a knowledge qualifier's verbatim, a card's own primary_quote) is
// legitimately a SUB-SPAN of its card's larger region_full_text by design --
// a qualifier is a phrase WITHIN a representation, not the whole
// representation. Plain substring containment (the previous check at every
// site below) accepts a meaning-inverting fragment as long as it lands on
// any word boundary: dropping a preceding "not"/"no"/"would not" never
// itself breaks a word boundary, so containment alone can never establish
// semantic fidelity -- whether a sub-span preserves meaning depends entirely
// on the text preceding it, which containment never inspects.
//
// The strongest available tier, in priority order, is applied at every
// grounding checkpoint below:
//   1. EXACT SLICE against a start/end offset. INVESTIGATED AND REJECTED as a
//      source: the projection's own evidence.spans (representations-product-
//      projection.js, RECORD_FIELDS) is the only candidate the projection
//      itself carries, and when a real native-pipeline span IS populated,
//      its absolute_start/absolute_end are offsets into the native
//      producer's own per-section `sectionText` (native-extraction-run.js),
//      never into legacyCard.region_full_text -- the text this bridge
//      actually grounds against. Those are two independently computed
//      strings from two unrelated pipelines with no assertion anywhere that
//      they agree byte-for-byte, so slicing region_full_text at an offset
//      meant for sectionText would be unsound. This bridge does not use it.
//
//      Instead, THIS bridge computes its own tier-1 offset, at build time,
//      from data it already trusts: legacyText IS region_full_text at that
//      point (see adaptProvisionGroupToLegacyCard), so locateGrounding's
//      match position against it is sound BY CONSTRUCTION, not merely
//      asserted. That position is carried forward onto the bridge's own
//      output (claim.verbatim_span, card.primary_quote_span) precisely so
//      the untrusted-envelope RE-VALIDATION path (assertCardShape /
//      assertClaimShape, reachable independently of the builder via
//      validateBridgeEnvelope / mergeCanonicalV2CardsIntoReviewDeal) can
//      slice-verify too, not only the fresh build. A present span that
//      fails to slice-match is a DEFINITIVE grounding failure -- it never
//      falls back to a weaker tier, or an envelope could always defeat tier
//      1 by attaching a broken span to force a softer check. This closes
//      the realistic attack this bridge's own header already documents as
//      its threat model: a hand-tampered envelope that changes a claim's
//      verbatim/quote field but leaves the surrounding, previously-verified
//      span stale. It does NOT, and cannot, close a fully coherent
//      envelope that fabricates region_full_text, the quote and a
//      self-consistent span together -- no different from every other
//      grounding check in this file (or in legacy-card-bridge.js /
//      general-covenants-dark-bridge.js), none of which have an
//      independent anchor against such a fully coherent forgery either;
//      see tests/canonical-v2-legacy-card-bridge.test.js's own
//      "internallyConsistentForgery" case for this codebase's existing,
//      documented acceptance of that boundary (downstream dark-authority
//      gating, not bridge validation, is what stops a forgery like that
//      from ever being SERVED).
//   2. EXACT EQUALITY to the full comparison text -- unconditionally sound,
//      and the correct check whenever a quote legitimately IS the whole of
//      its card's region_full_text (as this fixture's own accuracy-standard
//      claims are: see tests/fixtures/canonical-v2/dark-bridge/
//      representations-dark-review.json, where target_representation.
//      accuracy.quote equals legacy_cards[0].region_full_text verbatim).
//      Used only when no span is present at all (a hand-authored envelope
//      that predates this field, or an open-world card).
//   3. WORD-BOUNDARY-ANCHORED containment -- the weakest tier this bridge
//      accepts, used only when no span is present. It still closes a
//      truncated prefix, a mid-word slice (e.g. "accurate" out of
//      "inaccurate") and an arbitrary mid-quote substring. A word-boundary-
//      aligned negation drop ("have a Company Material Adverse Effect" cut
//      out of "...would not have a Company Material Adverse Effect...") used
//      to survive this tier untouched -- dropping a whole preceding word can
//      never itself violate a word boundary -- which is why tier 1's
//      carried-forward span existed as the only real backstop, and why the
//      two KNOWN LIMITATION tests below used to pin it as open. It no longer
//      does: every occurrence this tier accepts is now ALSO required to pass
//      lib/negation-boundary-guard.js's hasUnclosedNegationBeforeSpan, which
//      rejects an occurrence whose immediate governing clause carries a
//      negation ("would not", "in no event", "none of", a closed "no <noun>"
//      list, ...) that the candidate itself does not include. This is a
//      bounded, text-only heuristic, not a grammatical parse or an
//      independently-captured pre-trim offset -- see that module's header
//      for exactly what it does and does not close, and docs/codex-program/
//      notes/negation-reversal.md for the investigation and validation.
function isWordChar(character) {
  return /[A-Za-z0-9_]/.test(character || '');
}

// Returns { start, end } marking WHERE `candidate` is grounded within
// `sourceText` -- exact equality's span is always the whole string;
// anchored containment's span is the position of its first word-boundary-
// anchored occurrence THAT ALSO CLEARS hasUnclosedNegationBeforeSpan (a
// boundary is required only on a side where the needle's OWN edge is a word
// character, so a needle starting or ending in punctuation is not penalised
// on that side) -- or null if `candidate` is not soundly grounded in
// `sourceText` at all. This is the SAME computation used both to accept/
// reject a fresh quote at build time and to compute the span carried forward
// for later slice re-verification, so a record can never pass the
// build-time check at one position while a different, inconsistent position
// is recorded as its "verified" span.
function locateGrounding(candidate, sourceText) {
  if (typeof sourceText !== 'string' || !nonEmptyString(candidate)) return null;
  if (candidate === sourceText) return { start: 0, end: sourceText.length };
  let from = 0;
  for (;;) {
    const index = sourceText.indexOf(candidate, from);
    if (index === -1) return null;
    const before = index > 0 ? sourceText[index - 1] : '';
    const after = sourceText[index + candidate.length] || '';
    const leftOk = !isWordChar(candidate[0]) || !isWordChar(before);
    const rightOk = !isWordChar(candidate[candidate.length - 1]) || !isWordChar(after);
    if (leftOk && rightOk && !hasUnclosedNegationBeforeSpan(sourceText, index)) {
      return { start: index, end: index + candidate.length };
    }
    from = index + 1;
  }
}

// True when `candidate` is grounded in `sourceText` at the strongest
// SPAN-FREE tier this family's data can support: exact equality first,
// anchored containment as the fallback ceiling. Never plain (unanchored)
// containment. Used when no carried-forward span is available at all.
function groundedInSource(candidate, sourceText) {
  return locateGrounding(candidate, sourceText) !== null;
}

// A well-formed span: a plain object with exactly {start, end}, both
// integers, 0 <= start < end. Used only to validate an UNTRUSTED bridge
// envelope's own carried-forward span at re-validation time -- a malformed
// shape fails closed immediately, never silently treated as "no span
// provided" (that would let an envelope launder a broken span into a
// softer tier just by making it fail a lenient shape check instead).
function isWellFormedSpan(span) {
  return !!span && typeof span === 'object' && !Array.isArray(span)
    && Object.keys(span).length === 2 && Number.isInteger(span.start) && Number.isInteger(span.end)
    && span.start >= 0 && span.end > span.start;
}

// The full tiered check for sites that carry a span forward: exact slice
// (tier 1) when `span` is present -- and DEFINITIVE on failure, never
// falling back to a weaker tier just because a present span didn't verify
// -- otherwise the same two span-free tiers groundedInSource applies
// (equality, then anchored containment).
function verifiedAgainstSpan(candidate, sourceText, span) {
  if (span !== null) {
    if (!isWellFormedSpan(span) || typeof sourceText !== 'string' || span.end > sourceText.length) return false;
    return sourceText.slice(span.start, span.end) === candidate;
  }
  return groundedInSource(candidate, sourceText);
}

// -- generic plain-JSON / identity infra -------------------------------------
// Copied from legacy-card-bridge.js: this is defensive, family-agnostic
// infrastructure (reject Proxies, cycles, prototype pollution, oversized
// payloads; reserve identities without collision), not Material-Contracts-
// specific logic, so copying it here (rather than importing that module)
// keeps this bridge fully self-contained while preserving the exact same
// fail-closed discipline.

function snapshotPlainJson(value, path = 'value', seen = new Set(), state = { nodes: 0, bytes: 0 }, depth = 0) {
  state.nodes += 1;
  if (state.nodes > MAX_PLAIN_NODES || depth > MAX_PLAIN_DEPTH) {
    fail('INVALID_PLAIN_DATA', `${path} exceeds the plain-data complexity limit.`, { path });
  }
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    state.bytes += Buffer.byteLength(value, 'utf8');
    if (state.bytes > MAX_PLAIN_BYTES) fail('INVALID_PLAIN_DATA', `${path} exceeds the plain-data byte limit.`, { path });
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || Object.is(value, -0)) {
      fail('INVALID_PLAIN_DATA', `${path} must contain only canonical finite numbers.`);
    }
    return value;
  }
  if (typeof value !== 'object') fail('INVALID_PLAIN_DATA', `${path} must contain only JSON data.`, { path });
  if (require('node:util').types.isProxy(value)) fail('INVALID_PLAIN_DATA', `${path} must not be a Proxy.`, { path });
  if (seen.has(value)) fail('INVALID_PLAIN_DATA', `${path} must not contain cycles.`, { path });
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype) fail('INVALID_PLAIN_DATA', `${path} must be a plain array.`, { path });
      const length = value.length;
      if (!Number.isInteger(length) || length < 0 || length > MAX_PLAIN_WIDTH) {
        fail('INVALID_PLAIN_DATA', `${path} exceeds the plain-array width limit.`, { path });
      }
      return value.map((item, index) => snapshotPlainJson(item, `${path}[${index}]`, seen, state, depth + 1));
    }
    if (Object.getPrototypeOf(value) !== Object.prototype) fail('INVALID_PLAIN_DATA', `${path} must be a plain object.`, { path });
    const keys = Reflect.ownKeys(value);
    if (keys.length > MAX_PLAIN_WIDTH) fail('INVALID_PLAIN_DATA', `${path} exceeds the plain-object width limit.`, { path });
    const snapshot = {};
    for (const key of keys) {
      if (typeof key !== 'string') fail('INVALID_PLAIN_DATA', `${path} must not contain symbol properties.`, { path });
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
        fail('INVALID_PLAIN_DATA', `${path}.${key} must be an enumerable data property.`, { path: `${path}.${key}` });
      }
      if (descriptor.value === undefined && state.omitUndefinedObjectFields === true) continue;
      state.bytes += Buffer.byteLength(key, 'utf8');
      if (state.bytes > MAX_PLAIN_BYTES) fail('INVALID_PLAIN_DATA', `${path} exceeds the plain-data byte limit.`, { path });
      snapshot[key] = snapshotPlainJson(descriptor.value, `${path}.${key}`, seen, state, depth + 1);
    }
    return snapshot;
  } finally {
    seen.delete(value);
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object') return value;
  Object.values(value).forEach(deepFreeze);
  return Object.isFrozen(value) ? value : Object.freeze(value);
}

function assertCanonicalByteBudget(value, path) {
  if (Buffer.byteLength(canonicalJson(value), 'utf8') > MAX_PLAIN_BYTES) {
    fail('INVALID_PLAIN_DATA', `${path} exceeds the canonical byte limit.`, { path });
  }
}

function assertFieldSet(value, requiredFields, optionalFields, entity) {
  const allowed = new Set([...requiredFields, ...optionalFields]);
  const actual = Object.keys(value);
  const unexpected = actual.filter((field) => !allowed.has(field));
  const missing = requiredFields.filter((field) => !Object.hasOwn(value, field));
  if (unexpected.length || missing.length) {
    fail('INVALID_ENVELOPE_FIELDS', `${entity} does not have the exact expected field set.`, { entity, missing, unexpected });
  }
}

function assertExactFields(value, fields, entity) {
  assertFieldSet(value, fields, [], entity);
}

function cv2Id(rawId) {
  if (!nonEmptyString(rawId)) fail('MISSING_REQUIRED_FIELD', 'A Canonical V2 identity must be a non-empty string.', { field: 'identity' });
  if (rawId.startsWith(ID_PREFIX)) {
    fail('PREPREFIXED_IDENTITY', 'A source identity must not already use the Canonical V2 bridge prefix.', { identity: rawId });
  }
  return `${ID_PREFIX}${rawId}`;
}

function prefixedIdentity(value) {
  return nonEmptyString(value) && value.startsWith(ID_PREFIX) && value.length > ID_PREFIX.length;
}

function reserveIdentity(owners, value, owner, field, { allowOwnerAlias = false } = {}) {
  const existing = owners.get(value);
  if (existing && !(allowOwnerAlias && existing.owner === owner)) {
    fail('ID_COLLISION', `${owner} has an identity collision.`, {
      field, value, first_owner: existing.owner, first_field: existing.field, second_owner: owner, second_field: field,
    });
  }
  if (!existing) owners.set(value, { owner, field });
}

function cardSortKey(card) {
  const provenance = card.provenance && typeof card.provenance === 'object' ? card.provenance : {};
  const rawOffset = provenance.source_doc_offset_start;
  const offset = rawOffset !== null && rawOffset !== undefined && rawOffset !== '' && Number.isFinite(Number(rawOffset))
    ? Number(rawOffset) : Number.MAX_SAFE_INTEGER;
  return [offset, card.section_ref || '', card.short_title || '', card.provision_instance_id || ''];
}

function compareCards(leftCard, rightCard) {
  const left = cardSortKey(leftCard);
  const right = cardSortKey(rightCard);
  for (let index = 0; index < left.length; index += 1) {
    if (typeof left[index] === 'number' || typeof right[index] === 'number') {
      const difference = Number(left[index]) - Number(right[index]);
      if (difference !== 0) return difference;
    } else {
      const difference = String(left[index]).localeCompare(String(right[index]));
      if (difference !== 0) return difference;
    }
  }
  return 0;
}

function groupRowsBySection(cards) {
  const groups = new Map();
  for (const card of cards) {
    const sectionRef = card.section_ref || 'Unspecified';
    if (!groups.has(sectionRef)) groups.set(sectionRef, { sectionRef, title: sectionRef, cards: [] });
    groups.get(sectionRef).cards.push(card);
  }
  return [...groups.values()].map((group) => ({ ...group, cards: group.cards.sort(compareCards) }));
}

function bridgeProvenance() {
  return deepFreeze({
    source_doc_id: null,
    source_doc_page: null,
    source_doc_offset_start: null,
    source_doc_offset_end: null,
    extractor_name: 'CANONICAL_V2_NATIVE_PRODUCER',
    extractor_version: null,
    model: null,
    prompt_hash: null,
    run_id: null,
    extracted_at: null,
    canonical_v2_authority_state: AUTHORITY_STATE,
    source_authentication_state: SOURCE_AUTHENTICATION_STATE,
  });
}

// -- projection validation ---------------------------------------------------

function recordBody(record) {
  const { projection_record_id, ...body } = record;
  return body;
}

function validateGovernedRecord(record, index) {
  requireObject(record, 'INVALID_PROJECTION', 'Each projected representation record must be an object.');
  assertExactFields(record, RECORD_FIELDS, 'representation record');
  if (record.schema_version !== SOURCE_RECORD_SCHEMA) fail('INVALID_PROJECTION', 'A representation record has the wrong schema.', { index });
  if (record.authority_state !== AUTHORITY_STATE) fail('WRONG_AUTHORITY', 'A representation record does not have dark-only authority.', { index });
  if (record.owner_family !== 'REPRESENTATIONS') fail('INVALID_PROJECTION', 'A representation record is not owned by the REPRESENTATIONS family.', { index });
  if (!Object.hasOwn(EXPECTED_SIDE_PREFIX, record.representation_side)) {
    fail('INVALID_PROJECTION', 'A representation record has an unresolved side.', { index });
  }

  assertSha256(record.claim_revision_id, 'INVALID_IDENTITY', 'A claim revision identity must be lower-case SHA-256.', { index, field: 'claim_revision_id' });
  assertSha256(record.provision_instance_id, 'INVALID_IDENTITY', 'A provision instance identity must be lower-case SHA-256.', { index, field: 'provision_instance_id' });
  assertSha256(record.subject_occurrence_id, 'INVALID_IDENTITY', 'A subject occurrence identity must be lower-case SHA-256.', { index, field: 'subject_occurrence_id' });

  const evidence = requireObject(record.evidence, 'INVALID_PROJECTION', 'A representation record needs evidence.');
  assertExactFields(evidence, EVIDENCE_FIELDS, 'record evidence');
  if (!nonEmptyString(evidence.quote)) fail('INVALID_PROJECTION', 'Record evidence needs a non-empty quote.', { index });
  if (!Array.isArray(evidence.spans)) fail('INVALID_PROJECTION', 'Record evidence spans must be an array.', { index });

  const review = requireObject(record.review, 'INVALID_PROJECTION', 'A representation record needs a review projection.');
  assertExactFields(review, REVIEW_FIELDS, 'record review');

  const query = requireObject(record.query, 'INVALID_PROJECTION', 'A representation record needs a query projection.');
  assertExactFields(query, QUERY_COMPARE_FIELDS, 'record query');
  const compare = requireObject(record.compare, 'INVALID_PROJECTION', 'A representation record needs a compare projection.');
  assertExactFields(compare, QUERY_COMPARE_FIELDS, 'record compare');
  if (canonicalJson(query.value) !== canonicalJson(compare.value)) {
    fail('ALTERED_CLAIM_CONTENT', 'The query and compare projections of a claim have diverged.', { index });
  }
  const productValue = requireObject(query.value, 'INVALID_PROJECTION', 'A record query value must be an object.');
  assertExactFields(productValue, PRODUCT_VALUE_FIELDS, 'record query value');

  const conceptKey = productValue.concept_key;
  if (!nonEmptyString(conceptKey)) fail('INVALID_PROJECTION', 'A representation record needs a concept key.', { index });
  if (EXCLUDED_CONCEPTS.has(conceptKey)) {
    fail('EXCLUDED_FAMILY_OWNERSHIP', 'This concept is owned by a different family and must not be bridged here.', { index, concept_key: conceptKey });
  }
  if (!conceptKey.startsWith(EXPECTED_SIDE_PREFIX[record.representation_side])) {
    fail('SIDE_IDENTITY_MISMATCH', "The concept key does not match the record's representation side.", {
      index, concept_key: conceptKey, representation_side: record.representation_side,
    });
  }

  const claimDefinitionKey = productValue.claim_definition_key;
  const definition = GOVERNED_CLAIMS[claimDefinitionKey];
  if (!definition) fail('UNGOVERNED_CLAIM', 'Only governed representation accuracy and knowledge claims can be bridged.', { index, claim_definition_key: claimDefinitionKey });
  if (query.field_key !== EXPECTED_FIELD_KEY[record.representation_side]) fail('INVALID_PROJECTION', 'The record field key does not match its side.', { index });
  if (compare.field_key !== query.field_key) fail('ALTERED_CLAIM_CONTENT', 'The compare field key does not match the query field key.', { index });

  if (review.section_key !== EXPECTED_SECTION_KEY[record.representation_side]) fail('INVALID_PROJECTION', 'The record review section key does not match its side.', { index });
  if (review.row_key !== `${record.representation_side}:${claimDefinitionKey}`) fail('INVALID_PROJECTION', "The record review row key does not bind its side and claim.", { index });
  if (review.label !== definition.label) fail('ALTERED_CLAIM_CONTENT', 'The record review label does not match its governed claim definition.', { index });
  if (!nonEmptyString(review.source_section_reference)) fail('INVALID_PROJECTION', 'The record needs a source section reference.', { index });

  if (!definition.values.includes(productValue.canonical_value)) fail('INVALID_PROJECTION', 'The record canonical value is not governed.', { index });
  if (canonicalJson(review.value) !== canonicalJson(productValue.canonical_value)) fail('ALTERED_CLAIM_CONTENT', 'The review value does not match the query canonical value.', { index });

  const dimensions = requireObject(productValue.dimensions, 'INVALID_PROJECTION', 'A record needs dimensions.');
  if (claimDefinitionKey === 'REPRESENTATION_ACCURACY_STANDARD') {
    assertExactFields(dimensions, DIMENSIONS_BASE_FIELDS, 'record dimensions');
  } else {
    assertFieldSet(dimensions, DIMENSIONS_BASE_FIELDS, ['knowledge_standard'], 'record dimensions');
  }
  if (canonicalJson(review.dimensions) !== canonicalJson(dimensions)) {
    fail('ALTERED_CLAIM_CONTENT', 'The review dimensions have diverged from the claim dimensions.', { index });
  }
  if (dimensions.representation_side !== record.representation_side) {
    fail('ALTERED_CLAIM_CONTENT', "Record dimensions disagree with the record's own side.", { index });
  }
  if (!nonEmptyString(dimensions.representation_maker)) fail('INVALID_PROJECTION', 'Record dimensions need a representation maker.', { index });
  if (!nonEmptyString(dimensions.representation_maker_capacity)) fail('INVALID_PROJECTION', 'Record dimensions need a representation maker capacity.', { index });
  if (!QUALIFIER_POSITIONS.includes(dimensions.qualifier_position)) fail('INVALID_PROJECTION', 'Record dimensions have an ungoverned qualifier position.', { index });
  if (dimensions.qualifier_scope_state !== 'POSITION_ONLY_NOT_LEGAL_SCOPE') fail('INVALID_PROJECTION', 'Record dimensions have an unexpected qualifier scope state.', { index });
  if (claimDefinitionKey === 'REPRESENTATION_ACCURACY_STANDARD' && dimensions.qualifier_position !== 'CHAPEAU') {
    fail('INVALID_PROJECTION', 'A representation-level accuracy standard must attach at the chapeau.', { index });
  }
  if (Object.hasOwn(dimensions, 'knowledge_standard') && !KNOWLEDGE_STANDARDS.includes(dimensions.knowledge_standard)) {
    fail('INVALID_PROJECTION', 'Record dimensions have an ungoverned knowledge standard.', { index });
  }
  if (dimensions.qualifier_position === 'CHAPEAU' && record.subject_occurrence_id !== record.provision_instance_id) {
    fail('INVALID_PROVISION_BINDING', 'A chapeau-attached claim must bind to its own representation instance.', { index });
  }

  const market = requireObject(record.market, 'INVALID_PROJECTION', 'A representation record needs a market projection.');
  assertExactFields(market, MARKET_FIELDS, 'record market');
  if (market.metric_version !== 1) fail('INVALID_PROJECTION', 'The record market projection has the wrong metric version.', { index });
  const expectedMarket = EXPECTED_MARKET_SHAPE[claimDefinitionKey];
  for (const [field, expected] of Object.entries(expectedMarket)) {
    if (market[field] !== expected) fail('ALTERED_CLAIM_CONTENT', `The record market ${field} does not match its governed claim definition.`, { index });
  }
  if (canonicalJson(market.canonical_value) !== canonicalJson(productValue.canonical_value)) {
    fail('ALTERED_CLAIM_CONTENT', 'The record market canonical value has diverged from the claim.', { index });
  }
  if (canonicalJson(market.breakdown) !== canonicalJson(dimensions)) {
    fail('ALTERED_CLAIM_CONTENT', 'The record market breakdown has diverged from the claim dimensions.', { index });
  }

  assertSha256(record.projection_record_id, 'INVALID_IDENTITY', 'A record identity must be lower-case SHA-256.', { index });
  const expectedId = contentId(SOURCE_RECORD_SCHEMA, recordBody(record));
  if (record.projection_record_id !== expectedId) {
    fail('STALE_RECORD_ID', "A representation record identity does not bind its current content.", { index, expected: expectedId, actual: record.projection_record_id });
  }
  return record;
}

function openWorldRecordBody(item) {
  const { projection_record_id, ...body } = item;
  return body;
}

function validateOpenWorldRecord(item, index) {
  requireObject(item, 'INVALID_PROJECTION', 'Each open-world representation record must be an object.');
  assertExactFields(item, OPEN_WORLD_FIELDS, 'open-world representation record');
  if (item.schema_version !== SOURCE_OPEN_WORLD_RECORD_SCHEMA) fail('INVALID_PROJECTION', 'An open-world record has the wrong schema.', { index });
  if (item.authority_state !== AUTHORITY_STATE) fail('WRONG_AUTHORITY', 'An open-world record does not have dark-only authority.', { index });
  if (item.owner_family !== 'REPRESENTATIONS') fail('INVALID_PROJECTION', 'An open-world record is not owned by the REPRESENTATIONS family.', { index });
  if (item.candidate_kind !== 'ATTRIBUTE_OR_QUESTION') fail('INVALID_PROJECTION', 'An open-world record has an ungoverned candidate kind.', { index });
  if (!nonEmptyString(item.category)) fail('INVALID_PROJECTION', 'An open-world record needs a category.', { index });
  if (!nonEmptyString(item.quote)) fail('INVALID_PROJECTION', 'An open-world record needs a non-empty quote.', { index });
  if (!Array.isArray(item.evidence) || item.evidence.length === 0) fail('INVALID_PROJECTION', 'An open-world record needs non-empty evidence.', { index });
  if (!nonEmptyString(item.reason)) fail('INVALID_PROJECTION', 'An open-world record needs a non-empty reason.', { index });
  if (!nonEmptyString(item.why_unmapped)) fail('INVALID_PROJECTION', 'An open-world record needs why_unmapped.', { index });
  if (item.nearest_concept !== null && !nonEmptyString(item.nearest_concept)) {
    fail('INVALID_PROJECTION', 'An open-world record nearest_concept must be null or a non-empty string.', { index });
  }
  if (!nonEmptyString(item.source_section_reference)) fail('INVALID_PROJECTION', 'An open-world record needs a source section reference.', { index });
  if (item.certification_state !== 'BLOCKED_OPEN_WORLD') fail('INVALID_PROJECTION', 'An open-world record must stay certification-blocked.', { index });
  if (item.comparison_eligible !== false) fail('INVALID_PROJECTION', 'An open-world record must stay comparison-ineligible.', { index });
  assertSha256(item.projection_record_id, 'INVALID_IDENTITY', 'An open-world record identity must be lower-case SHA-256.', { index });
  const expectedId = contentId(SOURCE_OPEN_WORLD_RECORD_SCHEMA, openWorldRecordBody(item));
  if (item.projection_record_id !== expectedId) {
    fail('STALE_RECORD_ID', 'An open-world record identity does not bind its current content.', { index, expected: expectedId, actual: item.projection_record_id });
  }
  return item;
}

function projectionBody(snapshot) {
  return {
    schema_version: snapshot.schema_version,
    authority_state: snapshot.authority_state,
    records: snapshot.records,
    ...(Object.hasOwn(snapshot, 'open_items') ? { open_items: snapshot.open_items } : {}),
  };
}

function validateProjectionEnvelope(projection) {
  const snapshot = snapshotPlainJson(projection, 'projection');
  assertCanonicalByteBudget(snapshot, 'projection');
  requireObject(snapshot, 'INVALID_PROJECTION', 'A representations product projection is required.');
  assertFieldSet(snapshot, PROJECTION_FIELDS_REQUIRED, PROJECTION_FIELDS_OPTIONAL, 'projection');
  if (snapshot.schema_version !== SOURCE_PROJECTION_SCHEMA) fail('INVALID_PROJECTION', 'The input is not a representations product projection.');
  if (snapshot.authority_state !== AUTHORITY_STATE) fail('WRONG_AUTHORITY', 'The projection does not have dark-only authority.');
  if (!Array.isArray(snapshot.records)) fail('INVALID_PROJECTION', 'The projection needs a records array.');
  if (Object.hasOwn(snapshot, 'open_items')) {
    if (!Array.isArray(snapshot.open_items) || snapshot.open_items.length === 0) {
      fail('INVALID_PROJECTION', 'A present open_items key must be a non-empty array.');
    }
  }
  if (snapshot.records.length === 0 && !Object.hasOwn(snapshot, 'open_items')) {
    fail('INVALID_PROJECTION', 'The projection needs at least one governed or open-world record.');
  }
  snapshot.records.forEach(validateGovernedRecord);
  (snapshot.open_items || []).forEach(validateOpenWorldRecord);

  assertSha256(snapshot.projection_id, 'INVALID_IDENTITY', 'The projection identity must be lower-case SHA-256.');
  const expectedId = contentId(SOURCE_PROJECTION_SCHEMA, projectionBody(snapshot));
  if (snapshot.projection_id !== expectedId) {
    fail('STALE_PROJECTION_ID', 'The projection identity does not bind its current content.', { expected: expectedId, actual: snapshot.projection_id });
  }
  return snapshot;
}

// -- legacy provision join ---------------------------------------------------
// excerpt_id and deal_id do not exist in the projection. They are resolved
// by an exact, unambiguous join of provision_instance_id against the target
// reviewDeal's own legacy cards. Zero matches or more than one match both
// fail closed with distinct codes -- never guess, never pick the first hit.

function indexLegacyCardsByProvisionInstanceId(reviewDeal) {
  requireObject(reviewDeal, 'INVALID_REVIEW_DEAL', 'A reviewDeal object is required to resolve the legacy provision join.');
  if (!nonEmptyString(reviewDeal.dealId) || !Array.isArray(reviewDeal.cards)) {
    fail('INVALID_REVIEW_DEAL', 'reviewDeal must contain dealId and cards to resolve the legacy provision join.');
  }
  const byProvisionInstanceId = new Map();
  const ambiguous = new Set();
  for (const card of reviewDeal.cards) {
    const key = card && card.provision_instance_id;
    if (!nonEmptyString(key)) continue;
    if (byProvisionInstanceId.has(key)) { ambiguous.add(key); continue; }
    byProvisionInstanceId.set(key, card);
  }
  return { dealId: reviewDeal.dealId, byProvisionInstanceId, ambiguous };
}

function resolveLegacyJoinTarget(legacyIndex, provisionInstanceId, index) {
  if (legacyIndex.ambiguous.has(provisionInstanceId)) {
    fail('AMBIGUOUS_PROVISION_JOIN', 'More than one legacy card in the review deal shares this provision instance identity.', {
      index, provision_instance_id: provisionInstanceId,
    });
  }
  const match = legacyIndex.byProvisionInstanceId.get(provisionInstanceId);
  if (!match) {
    fail('PROVISION_JOIN_NOT_FOUND', 'No legacy card in the review deal matches this provision instance identity.', {
      index, provision_instance_id: provisionInstanceId,
    });
  }
  if (match.kind === 'definition' || String(match.provision_type || '').toUpperCase() !== 'REPRESENTATION') {
    fail('INVALID_PROVISION_JOIN_TARGET', 'The joined legacy card is not itself a representation provision.', {
      index, provision_instance_id: provisionInstanceId,
    });
  }
  return match;
}

// -- provision grouping + record/group -> legacy card+claims adapter --------
// Explicit, named, separately-tested adapter step (see the file header).
// Every field on the returned card/claims is either copied verbatim from a
// record, or borrowed from the joined legacy card -- nothing is invented.

// Groups ALREADY-VALIDATED governed records by their shared
// provision_instance_id, preserving first-occurrence order. A single
// representation can carry more than one governed claim (accuracy AND
// knowledge); every record in a group becomes one claim bound to the SAME
// card -- never several distinct cards for one real provision.
function groupGovernedRecordsByProvision(records) {
  const groups = new Map();
  const order = [];
  for (const record of records) {
    const key = record.provision_instance_id;
    if (!groups.has(key)) { groups.set(key, []); order.push(key); }
    groups.get(key).push(record);
  }
  return order.map((key) => groups.get(key));
}

function adaptProvisionGroupToLegacyCard(group, groupIndex, legacyIndex, identities) {
  const [first] = group;
  const provisionInstanceId = first.provision_instance_id;
  const legacyCard = resolveLegacyJoinTarget(legacyIndex, provisionInstanceId, groupIndex);
  const conceptKey = first.query.value.concept_key;
  const sectionReference = first.review.source_section_reference;

  // Cross-record agreement within the group: a genuine disagreement means
  // the join is wrong and must fail closed rather than be smoothed over by
  // preferring one record's view over another's.
  for (const record of group) {
    if (record.provision_instance_id !== provisionInstanceId) {
      fail('PROVISION_GROUP_MISMATCH', 'Records grouped under one provision disagree on their provision instance identity.', { groupIndex });
    }
    if (record.representation_side !== first.representation_side) {
      fail('PROVISION_GROUP_MISMATCH', 'Records grouped under one provision disagree on representation side.', { groupIndex });
    }
    if (record.query.value.concept_key !== conceptKey) {
      fail('PROVISION_GROUP_MISMATCH', 'Records grouped under one provision disagree on concept key.', { groupIndex });
    }
    if (record.review.source_section_reference !== sectionReference) {
      fail('PROVISION_GROUP_MISMATCH', 'Records grouped under one provision disagree on section reference.', { groupIndex });
    }
  }

  if (nonEmptyString(legacyCard.section_ref) && legacyCard.section_ref !== sectionReference) {
    fail('SECTION_REFERENCE_MISMATCH', "The claim's cited section does not match its joined legacy provision's section.", {
      groupIndex, claim_section: sectionReference, legacy_section: legacyCard.section_ref,
    });
  }

  const legacyText = String(legacyCard.region_full_text || legacyCard.primary_quote || '');
  if (!legacyText) fail('INVALID_PROVISION_JOIN_TARGET', 'The joined legacy card has no retained text to ground claims against.', { groupIndex });

  const rawId = provisionInstanceId;
  const id = cv2Id(rawId);
  // excerpt_id is derived citation data (borrowed from the joined legacy
  // card), not a unique card identity: two distinct provisions may
  // legitimately join to legacy cards that already share one excerpt_id
  // (e.g. a non-reliance acknowledgment and its auto-derived sibling -- see
  // lib/canonical-v2/no-other-reps-fraud-dark-bridge.js). id (aliased to
  // provision_instance_id below) is the true identity and is reserved here;
  // excerpt_id never is.
  const excerptId = cv2Id(`${legacyCard.excerpt_id || legacyCard.provision_instance_id}:representations-dark`);
  const owner = `provision-group:${groupIndex}`;
  reserveIdentity(identities, id, owner, 'id');

  const features = {};
  const claimRevisionIds = [];
  const claims = [];
  const seenAttributes = new Set();

  for (const record of group) {
    const productValue = record.query.value;
    const claimDefinitionKey = productValue.claim_definition_key;
    const attribute = ATTRIBUTE_BY_CLAIM_DEFINITION[claimDefinitionKey];
    if (seenAttributes.has(attribute)) {
      fail('DUPLICATE_CARD_ATTRIBUTE', 'A provision has more than one claim for the same governed attribute.', { groupIndex, attribute });
    }
    seenAttributes.add(attribute);

    // locateGrounding both accepts/rejects the fresh quote AND computes the
    // exact position it matched at -- that position is sound to carry
    // forward (see the groundedInSource header comment) because legacyText
    // IS region_full_text right here, at the moment of computation, not an
    // offset borrowed from an unrelated pipeline.
    const verbatimSpan = locateGrounding(record.evidence.quote, legacyText);
    if (!verbatimSpan) {
      fail('QUOTE_NOT_GROUNDED', 'The claim evidence quote does not occur verbatim in its joined legacy provision text.', {
        groupIndex, attribute, verification_tier: 'NONE',
      });
    }

    const canonicalFeatureValue = attribute === 'knowledgeQualifier'
      ? true
      : Object.freeze({ code: productValue.canonical_value, text: record.evidence.quote });
    features[attribute] = canonicalFeatureValue;
    claimRevisionIds.push(record.claim_revision_id);

    const claimId = cv2Id(record.projection_record_id);
    reserveIdentity(identities, claimId, owner, `claim:${attribute}`);
    claims.push(deepFreeze({
      id: claimId,
      deal_id: legacyIndex.dealId,
      excerpt_id: excerptId,
      provision_instance_id: id,
      attribute,
      canonical: canonicalFeatureValue,
      verbatim: record.evidence.quote,
      verbatim_span: verbatimSpan,
      evidence_quote: record.evidence.quote,
      provenance: deepFreeze({
        code: conceptKey,
        source: NATIVE_SOURCE,
        source_claim_revision_ids: Object.freeze([record.claim_revision_id]),
        canonical_v2_authority_state: AUTHORITY_STATE,
        source_authentication_state: SOURCE_AUTHENTICATION_STATE,
      }),
      authority_state: AUTHORITY_STATE,
      source_authentication_state: SOURCE_AUTHENTICATION_STATE,
    }));
  }

  const sortedClaimRevisionIds = Object.freeze([...new Set(claimRevisionIds)].sort());
  const frozenFeatures = deepFreeze({ ...features });
  const primaryQuote = legacyCard.primary_quote || legacyText;
  // Same soundness argument as verbatimSpan above: legacyText IS
  // region_full_text right here, so this position is trustworthy to carry
  // forward for re-validation to slice-check independently of the builder.
  const primaryQuoteSpan = locateGrounding(primaryQuote, legacyText);
  const card = deepFreeze({
    schema_version: CARD_SCHEMA,
    id,
    deal_id: legacyIndex.dealId,
    provision_instance_id: id,
    excerpt_id: excerptId,
    section_ref: sectionReference,
    short_title: legacyCard.short_title || null,
    kind: 'standard',
    type: 'REPRESENTATION',
    provision_type: 'REPRESENTATION',
    provision_subtype: conceptKey,
    primary_quote: primaryQuote,
    primary_quote_span: primaryQuoteSpan,
    region_full_text: legacyText,
    features: frozenFeatures,
    ai_metadata: { features: frozenFeatures, code: conceptKey },
    canonical_v2_lineage: { source: NATIVE_SOURCE, claim_revision_ids: sortedClaimRevisionIds },
    provenance: bridgeProvenance(),
    authority_state: AUTHORITY_STATE,
    source_authentication_state: SOURCE_AUTHENTICATION_STATE,
  });

  return { card, claims: Object.freeze(claims) };
}

function adaptOpenWorldRecordToLegacyCard(item, index, legacyIndex, identities) {
  const rawId = item.projection_record_id;
  const id = cv2Id(rawId);
  // excerpt_id is carried citation data here too -- see
  // adaptProvisionGroupToLegacyCard above -- never a unique identity.
  const excerptId = cv2Id(`open-world:${rawId}`);
  const owner = `open-item:${index}`;
  reserveIdentity(identities, id, owner, 'id');

  const features = Object.freeze({});
  return deepFreeze({
    schema_version: CARD_SCHEMA,
    id,
    deal_id: legacyIndex.dealId,
    provision_instance_id: id,
    excerpt_id: excerptId,
    section_ref: item.source_section_reference,
    short_title: null,
    kind: 'standard',
    type: 'REPRESENTATION',
    provision_type: 'REPRESENTATION',
    provision_subtype: OPEN_WORLD_PROVISION_SUBTYPE,
    primary_quote: item.quote,
    // Open-world evidence sets primary_quote and region_full_text to the
    // SAME item.quote by construction (both lines above), so equality
    // (tier 2) already holds unconditionally here -- no independent span
    // is needed. The field stays present (null) only to satisfy the
    // closed GOVERNED_CARD_FIELDS/OPEN_WORLD_CARD_FIELDS field set.
    primary_quote_span: null,
    region_full_text: item.quote,
    features,
    ai_metadata: { features },
    canonical_v2_lineage: { source: EVIDENCE_SOURCE, reason: item.reason, claim_revision_ids: [] },
    provenance: bridgeProvenance(),
    authority_state: AUTHORITY_STATE,
    source_authentication_state: SOURCE_AUTHENTICATION_STATE,
  });
}

// -- bridge construction ------------------------------------------------------

function bridgeRepresentationRecordsToLegacyShape(projection, reviewDeal, env) {
  if (arguments.length >= 3) assertDarkBridgeIntegrationAllowed(env);
  else assertDarkBridgeIntegrationAllowed();

  const validatedProjection = validateProjectionEnvelope(projection);
  const legacyIndex = indexLegacyCardsByProvisionInstanceId(reviewDeal);
  const identities = new Map();

  const provisionGroups = groupGovernedRecordsByProvision(validatedProjection.records);
  const adaptedGroups = provisionGroups.map((group, index) => (
    adaptProvisionGroupToLegacyCard(group, index, legacyIndex, identities)
  ));
  const governedCards = adaptedGroups.map((entry) => entry.card);
  const claims = Object.freeze(adaptedGroups.flatMap((entry) => entry.claims));

  const openWorldItems = validatedProjection.open_items || [];
  const openWorldCards = openWorldItems.map((item, index) => (
    adaptOpenWorldRecordToLegacyCard(item, index, legacyIndex, identities)
  ));
  if (openWorldCards.length !== openWorldItems.length) {
    fail('OPEN_WORLD_RECONCILIATION_FAILED', 'Open-world evidence cards do not fully reconcile with their source records.');
  }

  const cards = Object.freeze([...governedCards, ...openWorldCards].sort(compareCards));
  const openItems = Object.freeze(openWorldItems.map(deepFreeze));

  const body = {
    authority_state: AUTHORITY_STATE,
    source_authentication_state: SOURCE_AUTHENTICATION_STATE,
    source_projection_schema: SOURCE_PROJECTION_SCHEMA,
    source_projection_id: validatedProjection.projection_id,
    deal_id: legacyIndex.dealId,
    cards,
    claims,
    open_items: openItems,
  };
  return deepFreeze({ schema_version: BRIDGE_SCHEMA, bridge_id: contentId(BRIDGE_SCHEMA, body), ...body });
}

// -- bridge (re-)validation ---------------------------------------------------
// Never trusts a bridge envelope blindly, even one this module just
// produced -- an arbitrary or hand-tampered bridge object must fail closed
// exactly like a fresh construction would.

function assertCardShape(card, index) {
  requireObject(card, 'INVALID_BRIDGE_ENVELOPE', 'Each bridge card must be a plain object.');
  const lineage = requireObject(card.canonical_v2_lineage, 'INVALID_LINEAGE', 'A bridge card needs canonical_v2_lineage.');
  if (![NATIVE_SOURCE, EVIDENCE_SOURCE].includes(lineage.source)) {
    fail('INVALID_LINEAGE', 'A bridge card has an unsupported Canonical V2 source.', { index, source: lineage.source });
  }
  const isNative = lineage.source === NATIVE_SOURCE;
  assertExactFields(card, isNative ? GOVERNED_CARD_FIELDS : OPEN_WORLD_CARD_FIELDS, 'bridge card');
  assertExactFields(lineage, isNative ? ['source', 'claim_revision_ids'] : ['source', 'reason', 'claim_revision_ids'], 'card lineage');

  if (card.authority_state !== AUTHORITY_STATE) fail('WRONG_AUTHORITY', 'A bridge card does not have dark-only authority.', { index });
  if (card.source_authentication_state !== SOURCE_AUTHENTICATION_STATE) {
    fail('SOURCE_NOT_AUTHENTICATED', 'A bridge card must remain source-unauthenticated.', { index });
  }
  if (card.provision_type !== 'REPRESENTATION' || card.type !== 'REPRESENTATION') {
    fail('INVALID_CARD_KIND', 'A bridge card must be a representation.', { index });
  }
  if (card.provision_instance_id !== card.id) {
    fail('INVALID_BRIDGE_IDENTITY', 'A bridge card identity and provision instance identity must bind exactly.', { index });
  }
  if (!prefixedIdentity(card.id) || !prefixedIdentity(card.excerpt_id)) {
    fail('INVALID_BRIDGE_IDENTITY', 'Each bridge card identity must use the Canonical V2 namespace.', { index });
  }
  assertSha256(card.id.slice(ID_PREFIX.length), 'INVALID_BRIDGE_IDENTITY', 'A bridge card identity must contain lower-case SHA-256.', { index });
  if (!nonEmptyString(card.deal_id)) fail('INVALID_BRIDGE_ENVELOPE', 'A bridge card needs a deal_id.', { index });
  if (canonicalJson(card.provenance) !== canonicalJson(bridgeProvenance())) fail('WRONG_AUTHORITY', 'A bridge card must retain exact dark provenance.', { index });

  const claimRevisionIds = lineage.claim_revision_ids;
  if (!Array.isArray(claimRevisionIds) || !claimRevisionIds.every((v) => nonEmptyString(v) && LOWERCASE_SHA256.test(v))
    || new Set(claimRevisionIds).size !== claimRevisionIds.length) {
    fail('INVALID_LINEAGE', 'Bridge card lineage must contain distinct lower-case SHA-256 identities.', { index });
  }

  if (isNative) {
    if (claimRevisionIds.length === 0) fail('NATIVE_LINEAGE_REQUIRED', 'A native governed card needs at least one claim revision identity.', { index });
    if (EXCLUDED_CONCEPTS.has(card.provision_subtype)) {
      fail('EXCLUDED_FAMILY_OWNERSHIP', 'This concept is owned by a different family and must not be bridged here.', { index, concept_key: card.provision_subtype });
    }
    if (!/^REP-[TB]-/.test(String(card.provision_subtype || ''))) {
      fail('INVALID_CARD_KIND', 'A native bridge card needs a party-prefixed concept code.', { index });
    }
    const featureKeys = Object.keys(card.features || {});
    if (featureKeys.length === 0 || featureKeys.some((key) => !GOVERNED_ATTRIBUTES.includes(key))) {
      fail('INVALID_CARD_KIND', 'A native bridge card needs at least one governed representations feature.', { index });
    }
    if (canonicalJson(card.ai_metadata?.features) !== canonicalJson(card.features)) {
      fail('FEATURE_METADATA_MISMATCH', 'Card features and metadata features must match exactly.', { index });
    }
    if (featureKeys.includes('materialityQualifier')) {
      const value = card.features.materialityQualifier;
      // Structural shape only -- the grounding strength of value.text is
      // NOT independently re-derived here. It is enforced transitively,
      // and more strongly, in assertClaimShape below: every governed
      // feature is required to have exactly one bound claim (checked once
      // all cards and claims are known, after both passes complete), that
      // claim's own canonical.text is required to equal value.text exactly
      // (the canonicalJson check on card.features[claim.attribute] vs
      // claim.canonical), canonical.text is required to equal claim.
      // verbatim exactly (the divergence guard just below in
      // assertClaimShape), and claim.verbatim is the one field that
      // actually receives the full tier-1/2/3 grounding check via
      // claim.verbatim_span. Re-deriving grounding independently here too
      // would only ever be AS strong as that chain (never stronger, since
      // it has no span of its own to check against) while doubling the
      // surface a reader has to trust matches.
      if (!value || typeof value !== 'object' || !ACCURACY_CODES.includes(value.code) || !nonEmptyString(value.text)) {
        fail('INVALID_NATIVE_FEATURES', 'A materiality qualifier feature is not exact and source-grounded.', { index });
      }
    }
    if (featureKeys.includes('knowledgeQualifier') && card.features.knowledgeQualifier !== true) {
      fail('INVALID_NATIVE_FEATURES', 'A knowledge qualifier feature must be a bare true presence flag.', { index });
    }
    if (!nonEmptyString(card.region_full_text)
      || !verifiedAgainstSpan(card.primary_quote, card.region_full_text, card.primary_quote_span)) {
      fail('QUOTE_NOT_GROUNDED', 'A native bridge card primary quote must occur in its retained legacy text.', {
        index, verification_tier: card.primary_quote_span !== null ? 'EXACT_SLICE_FAILED' : 'NONE',
      });
    }
  } else {
    if (claimRevisionIds.length !== 0) fail('EVIDENCE_LINEAGE_NOT_EMPTY', 'Open-world evidence cannot claim governed claim revisions.', { index });
    if (!nonEmptyString(lineage.reason)) fail('OPEN_WORLD_REASON_REQUIRED', 'Open-world evidence needs a non-empty reason.', { index });
    if (card.provision_subtype !== OPEN_WORLD_PROVISION_SUBTYPE) fail('INVALID_CARD_KIND', 'Open-world evidence must use the open-world subtype.', { index });
    if (Object.keys(card.features || {}).length !== 0) fail('OPEN_WORLD_FEATURES_NOT_EMPTY', 'Open-world evidence cannot carry governed features.', { index });
  }
}

function assertClaimShape(claim, index, cardsByProvisionInstanceId) {
  requireObject(claim, 'INVALID_BRIDGE_ENVELOPE', 'Each bridge claim must be a plain object.');
  assertExactFields(claim, CLAIM_FIELDS, 'bridge claim');
  if (claim.authority_state !== AUTHORITY_STATE) fail('WRONG_AUTHORITY', 'A bridge claim does not have dark-only authority.', { index });
  if (claim.source_authentication_state !== SOURCE_AUTHENTICATION_STATE) {
    fail('SOURCE_NOT_AUTHENTICATED', 'A bridge claim must remain source-unauthenticated.', { index });
  }
  if (!prefixedIdentity(claim.id) || !prefixedIdentity(claim.excerpt_id) || !prefixedIdentity(claim.provision_instance_id)) {
    fail('INVALID_BRIDGE_IDENTITY', 'Each bridge claim identity must use the Canonical V2 namespace.', { index });
  }
  assertSha256(claim.id.slice(ID_PREFIX.length), 'INVALID_BRIDGE_IDENTITY', 'A bridge claim identity must contain lower-case SHA-256.', { index });
  if (!GOVERNED_ATTRIBUTES.includes(claim.attribute)) fail('INVALID_CLAIM_CONTRACT', 'A bridge claim has an ungoverned attribute.', { index });
  if (!nonEmptyString(claim.verbatim) || claim.verbatim !== claim.evidence_quote) {
    fail('INVALID_CLAIM_CONTRACT', 'A bridge claim verbatim and evidence quote must match exactly.', { index });
  }

  // Bind by provision_instance_id (the unique identity), not excerpt_id --
  // a legacy join target's excerpt_id, and therefore this card's own
  // derived excerpt_id, may legitimately be shared by another, distinct
  // provision (see adaptProvisionGroupToLegacyCard). excerpt_id is still
  // cross-checked for consistency with the bound card below.
  const card = cardsByProvisionInstanceId.get(claim.provision_instance_id);
  if (!card || card.excerpt_id !== claim.excerpt_id) {
    fail('MISSING_CARD_BINDING', 'A bridge claim does not bind to a bridge card.', { index });
  }
  if (card.canonical_v2_lineage.source !== NATIVE_SOURCE) fail('EVIDENCE_CLAIM_BINDING', 'A claim cannot bind to open-world evidence.', { index });
  if (canonicalJson(card.features[claim.attribute]) !== canonicalJson(claim.canonical)) {
    fail('INVALID_CLAIM_CONTRACT', "The claim canonical value does not match its card's feature.", { index });
  }
  // Independent of the grounding check below: without this, claim.verbatim
  // could be set to the genuine, fully-grounded quote (passing that check)
  // while claim.canonical.text -- mirrored onto card.features.
  // materialityQualifier by the check above -- is set to a DIFFERENT,
  // independently-truncated string that separately squeaks past its OWN
  // anchored-containment check in assertCardShape. Two different
  // "plausible" strings for what must be one and the same underlying
  // evidence is exactly the divergence this closes.
  if (claim.attribute === 'materialityQualifier' && claim.canonical.text !== claim.verbatim) {
    fail('INVALID_CLAIM_CONTRACT', "A materiality qualifier's canonical text must equal the claim's own verbatim quote exactly.", { index });
  }
  // The primary grounding check: exact slice against claim.verbatim_span
  // when present (tier 1 -- and definitive on failure, see
  // verifiedAgainstSpan), otherwise equality then anchored containment
  // (tiers 2/3). A present-but-malformed span, or a span whose slice
  // doesn't match, fails here -- it is never treated as "no span".
  if (!verifiedAgainstSpan(claim.verbatim, card.region_full_text, claim.verbatim_span)) {
    fail('QUOTE_NOT_GROUNDED', 'A bridge claim quote does not occur verbatim in its card text.', {
      index, verification_tier: claim.verbatim_span !== null ? 'EXACT_SLICE_FAILED' : 'NONE',
    });
  }

  const provenance = requireObject(claim.provenance, 'INVALID_CLAIM_CONTRACT', 'A bridge claim needs provenance.');
  assertExactFields(provenance, CLAIM_PROVENANCE_FIELDS, 'claim provenance');
  if (provenance.source !== NATIVE_SOURCE) fail('INVALID_CLAIM_CONTRACT', 'A bridge claim has invalid provenance source.', { index });
  if (provenance.code !== card.provision_subtype) fail('INVALID_CLAIM_CONTRACT', 'A bridge claim provenance code does not match its card.', { index });
  if (provenance.canonical_v2_authority_state !== AUTHORITY_STATE) fail('WRONG_AUTHORITY', 'A bridge claim provenance is not dark-only.', { index });
  if (provenance.source_authentication_state !== SOURCE_AUTHENTICATION_STATE) {
    fail('SOURCE_NOT_AUTHENTICATED', 'A bridge claim must retain its explicit unauthenticated-source state.', { index });
  }
  const revisionIds = provenance.source_claim_revision_ids;
  if (!Array.isArray(revisionIds) || revisionIds.length !== 1 || !LOWERCASE_SHA256.test(revisionIds[0])
    || !card.canonical_v2_lineage.claim_revision_ids.includes(revisionIds[0])) {
    fail('INVALID_LINEAGE', "The claim provenance revision id must be one of its card's lineage revisions.", { index });
  }
  return card;
}

// Gated too: this mints a deep-frozen, fully authority-stamped envelope of
// VALIDATED_NOT_SERVED records on its own, so it must refuse independently
// of whether a caller went through the builder above.
function validateBridgeEnvelope(bridge, env) {
  if (arguments.length >= 2) assertDarkBridgeIntegrationAllowed(env);
  else assertDarkBridgeIntegrationAllowed();
  const snapshot = snapshotPlainJson(bridge, 'bridge');
  assertCanonicalByteBudget(snapshot, 'bridge');
  requireObject(snapshot, 'INVALID_BRIDGE_ENVELOPE', 'A validated bridge envelope is required.');
  assertExactFields(snapshot, BRIDGE_FIELDS, 'bridge');
  if (snapshot.authority_state !== AUTHORITY_STATE) fail('WRONG_AUTHORITY', 'The bridge does not have dark-only authority.');
  if (snapshot.source_authentication_state !== SOURCE_AUTHENTICATION_STATE) {
    fail('SOURCE_NOT_AUTHENTICATED', 'The bridge must remain explicit that source authenticity is unverified.');
  }
  if (snapshot.schema_version !== BRIDGE_SCHEMA
    || snapshot.source_projection_schema !== SOURCE_PROJECTION_SCHEMA
    || !LOWERCASE_SHA256.test(snapshot.source_projection_id)
    || !LOWERCASE_SHA256.test(snapshot.bridge_id)
    || !nonEmptyString(snapshot.deal_id)
    || !Array.isArray(snapshot.cards)
    || !Array.isArray(snapshot.claims)
    || !Array.isArray(snapshot.open_items)) {
    fail('INVALID_BRIDGE_ENVELOPE', 'The bridge envelope is incomplete.');
  }
  const body = {
    authority_state: snapshot.authority_state,
    source_authentication_state: snapshot.source_authentication_state,
    source_projection_schema: snapshot.source_projection_schema,
    source_projection_id: snapshot.source_projection_id,
    deal_id: snapshot.deal_id,
    cards: snapshot.cards,
    claims: snapshot.claims,
    open_items: snapshot.open_items,
  };
  if (snapshot.bridge_id !== contentId(BRIDGE_SCHEMA, body)) fail('STALE_BRIDGE_ID', 'The bridge identity does not bind its current content.');

  snapshot.open_items.forEach(validateOpenWorldRecord);

  const identities = new Map();
  // Keyed by provision_instance_id (== id here -- assertCardShape enforces
  // the alias), not excerpt_id: excerpt_id is carried citation data (two
  // distinct cards may legitimately share one, borrowed from legacy cards
  // that already share it -- see adaptProvisionGroupToLegacyCard), so it
  // does no identity or join work here.
  const cardsByProvisionInstanceId = new Map();
  const evidenceCardIds = new Set();
  snapshot.cards.forEach((card, index) => {
    assertCardShape(card, index);
    if (card.deal_id !== snapshot.deal_id) fail('DEAL_ID_MISMATCH', 'A bridge card belongs to a different deal.', { index });
    const owner = `bridge-card:${index}`;
    reserveIdentity(identities, card.id, owner, 'id');
    cardsByProvisionInstanceId.set(card.provision_instance_id, card);
    if (card.canonical_v2_lineage.source === EVIDENCE_SOURCE) evidenceCardIds.add(card.id);
  });

  // Incomplete open-item reconciliation: every retained open_item must bind
  // to exactly one evidence-sourced card, and every evidence-sourced card
  // must bind to exactly one retained open_item -- neither side may be
  // silently dropped or fabricated.
  const expectedEvidenceIds = new Set(snapshot.open_items.map((item) => cv2Id(item.projection_record_id)));
  if (expectedEvidenceIds.size !== snapshot.open_items.length
    || evidenceCardIds.size !== expectedEvidenceIds.size
    || [...evidenceCardIds].some((id) => !expectedEvidenceIds.has(id))) {
    fail('OPEN_WORLD_RECONCILIATION_FAILED', 'Bridge open items and open-world evidence cards do not reconcile one-to-one.');
  }

  const claimCountByProvisionInstance = new Map();
  const claimAttributes = new Set();
  snapshot.claims.forEach((claim, index) => {
    assertClaimShape(claim, index, cardsByProvisionInstanceId);
    const attributeKey = `${claim.provision_instance_id}::${claim.attribute}`;
    if (claimAttributes.has(attributeKey)) {
      fail('DUPLICATE_CARD_ATTRIBUTE', 'A bridge card excerpt has duplicate attribute claims.', { index });
    }
    claimAttributes.add(attributeKey);
    claimCountByProvisionInstance.set(
      claim.provision_instance_id,
      (claimCountByProvisionInstance.get(claim.provision_instance_id) || 0) + 1,
    );
    reserveIdentity(identities, claim.id, `bridge-claim:${index}`, 'id');
  });
  snapshot.cards.forEach((card, index) => {
    const claimCount = claimCountByProvisionInstance.get(card.provision_instance_id) || 0;
    const featureCount = Object.keys(card.features || {}).length;
    if (card.canonical_v2_lineage.source === NATIVE_SOURCE && claimCount !== featureCount) {
      fail('MISSING_CARD_BINDING', 'A native bridge card does not have exactly one claim per governed feature.', { index });
    }
    if (card.canonical_v2_lineage.source === EVIDENCE_SOURCE && claimCount !== 0) {
      fail('EVIDENCE_CLAIM_BINDING', 'An evidence bridge card owns a bridge claim.', { index });
    }
  });

  return deepFreeze(snapshot);
}

// -- merge --------------------------------------------------------------------

// Chained dark-bridge merges (lib/canonical-v2/review-preview-assembly.js
// merges all four families' bridges into ONE review deal, in a fixed order)
// must not let a later family's receipt REPLACE an earlier family's -- see
// the identical pair in lib/canonical-v2/legacy-card-bridge.js (the
// template this module's structural/validation pattern was copied from,
// per the file header) for the full rationale (F3). Reproduced here, not
// imported, for the same reason every other generic helper in this file is
// copied rather than required from that module. Dedup is keyed on
// bridge_id, a content hash of the bridge's own full body: two receipts
// sharing one bridge_id are, by construction, the same bridge, so merging
// it again must not duplicate it.
function buildBridgeReceipt(bridge) {
  return deepFreeze({
    schema_version: bridge.schema_version,
    bridge_id: bridge.bridge_id,
    source_projection_id: bridge.source_projection_id,
    authority_state: bridge.authority_state,
    source_authentication_state: bridge.source_authentication_state,
  });
}

function appendBridgeReceipt(existingReceipts, bridge) {
  const receipts = Array.isArray(existingReceipts) ? existingReceipts : [];
  const receipt = buildBridgeReceipt(bridge);
  if (receipts.some((existing) => existing && existing.bridge_id === receipt.bridge_id)) {
    return Object.freeze([...receipts]);
  }
  return Object.freeze([...receipts, receipt]);
}

// `env || process.env` cannot tell an explicit falsy env (undefined, null,
// '') from one that was never supplied -- both would silently resolve to
// the ambient process.env -- so arguments.length is used instead, exactly
// like the gate module.
function mergeCanonicalV2CardsIntoReviewDeal(reviewDeal, bridgeEnvelope, { env } = {}) {
  // The gate is asserted at every public entry point, before any other validation. A
  // caller that hand-authors a self-consistent envelope must not be able to merge dark
  // cards by skipping the bridge builder that would otherwise have checked the gate.
  const envArgumentProvided = arguments.length >= 3;
  if (envArgumentProvided) assertDarkBridgeIntegrationAllowed(env);
  else assertDarkBridgeIntegrationAllowed();
  const reviewSnapshot = snapshotPlainJson(reviewDeal, 'reviewDeal', new Set(), { nodes: 0, bytes: 0, omitUndefinedObjectFields: true });
  assertCanonicalByteBudget(reviewSnapshot, 'reviewDeal');
  requireObject(reviewSnapshot, 'INVALID_REVIEW_DEAL', 'A reviewDeal object is required.');
  if (!nonEmptyString(reviewSnapshot.dealId) || !Array.isArray(reviewSnapshot.cards)) {
    fail('INVALID_REVIEW_DEAL', 'reviewDeal must contain dealId and cards.');
  }
  const bridge = envArgumentProvided
    ? validateBridgeEnvelope(bridgeEnvelope, env)
    : validateBridgeEnvelope(bridgeEnvelope);
  if (bridge.deal_id !== reviewSnapshot.dealId) {
    fail('DEAL_ID_MISMATCH', 'The bridge envelope belongs to a different review deal.', { expected: reviewSnapshot.dealId, actual: bridge.deal_id });
  }

  const identities = new Map();
  for (const [index, card] of reviewSnapshot.cards.entries()) {
    requireObject(card, 'INVALID_REVIEW_DEAL', 'Each legacy card must be an object.');
    const owner = `legacy-card:${index}`;
    if (nonEmptyString(card.id)) reserveIdentity(identities, card.id, owner, 'id');
    if (nonEmptyString(card.provision_instance_id)) {
      reserveIdentity(identities, card.provision_instance_id, owner, 'provision_instance_id', { allowOwnerAlias: card.provision_instance_id === card.id });
    }
    // excerpt_id is intentionally NOT reserved here: this and other
    // families legitimately let two distinct cards (id/provision_instance_id
    // still unique) share one excerpt_id when they cite the same source
    // excerpt -- reserving it across the whole reviewDeal would make
    // chaining two families' bridge merges into one reviewDeal impossible.
  }
  for (const [index, claim] of (Array.isArray(reviewSnapshot.claims) ? reviewSnapshot.claims : []).entries()) {
    requireObject(claim, 'INVALID_REVIEW_DEAL', 'Each legacy claim must be an object.');
    if (nonEmptyString(claim.id)) reserveIdentity(identities, claim.id, `legacy-claim:${index}`, 'id');
  }
  for (const [index, card] of bridge.cards.entries()) {
    const owner = `incoming-card:${index}`;
    reserveIdentity(identities, card.id, owner, 'id');
    // excerpt_id is not reserved here either -- see the pre-existing-cards
    // loop above for why.
  }
  for (const [index, claim] of bridge.claims.entries()) {
    reserveIdentity(identities, claim.id, `incoming-claim:${index}`, 'id');
  }

  const cards = Object.freeze([...reviewSnapshot.cards, ...bridge.cards].sort(compareCards));
  const claims = Object.freeze([
    ...(Array.isArray(reviewSnapshot.claims) ? reviewSnapshot.claims : []),
    ...bridge.claims,
  ]);
  const sections = Object.freeze(groupRowsBySection(cards).map((section) => Object.freeze({ ...section, cards: Object.freeze([...section.cards]) })));
  return deepFreeze({
    ...reviewSnapshot,
    cards,
    claims,
    definitions: Object.freeze(cards.filter((card) => card.kind === 'definition')),
    sections,
    cardCount: cards.length,
    canonical_v2_bridge_receipts: appendBridgeReceipt(reviewSnapshot.canonical_v2_bridge_receipts, bridge),
  });
}

// adaptOpenWorldRecordToLegacyCard and adaptProvisionGroupToLegacyCard are
// deliberately NOT exported: both mint fully authority-stamped
// (VALIDATED_NOT_SERVED) records with no gate of their own, so calling
// either directly used to bypass bridgeRepresentationRecordsToLegacyShape's
// gate check entirely. Nothing outside this module calls them (confirmed
// against tests/ and lib/ before this change), so removing them from the
// public surface closes that path without touching their internal callers
// below, which still reach them exactly as before.
module.exports = {
  AUTHORITY_STATE,
  BRIDGE_SCHEMA,
  CARD_SCHEMA,
  ID_PREFIX,
  SOURCE_AUTHENTICATION_STATE,
  RepresentationsDarkBridgeError,
  bridgeRepresentationRecordsToLegacyShape,
  cv2Id,
  groupGovernedRecordsByProvision,
  indexLegacyCardsByProvisionInstanceId,
  mergeCanonicalV2CardsIntoReviewDeal,
  resolveLegacyJoinTarget,
  validateBridgeEnvelope,
  validateGovernedRecord,
  validateOpenWorldRecord,
  validateProjectionEnvelope,
};
