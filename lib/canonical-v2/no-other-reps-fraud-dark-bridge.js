'use strict';

// No Other Reps / Fraud dark bridge -- INTEGRATED_NOT_SERVED preview only.
// Production authority is NONE. Every emitted record stays stamped
// authority_state: 'VALIDATED_NOT_SERVED', and assertDarkBridgeIntegrationAllowed()
// gates every exported function that mints or validates a record --
// bridgeNoOtherRepsFraudCardsToLegacyShape, mergeCanonicalV2NoOtherRepsFraudCardsIntoReviewDeal,
// validateBridgeEnvelope, and adaptReviewFactToLegacyCard -- so none of them
// runs at all outside local/pre-production, however a caller reaches them.
//
// Unlike lib/canonical-v2/legacy-card-bridge.js (the Material Contracts
// bridge, the template this module follows), the No Other Reps / Fraud
// product projection (no-other-reps-fraud-product-projection.js) is NOT
// card/claim shaped. projectNoOtherRepsFraudProduct returns four flat,
// parallel fact arrays -- review, query, compare, market -- one entry per
// resolved positive-presence claim, and has no `cards`, `claims`,
// `open_items`, `canonical_v2_lineage`, `excerpt_id` or `deal_id`.
//
// So this module's first job is an explicit, separately-tested SHAPE
// ADAPTER -- adaptReviewFactToLegacyCard, below -- that turns one
// `review[]` fact record into a legacy-shaped provision card. Every field
// is sourced honestly, never fabricated:
//
//   - primary_quote / region_full_text / full_text: `review[].evidence` is
//     real exact evidence (projectNoOtherRepsFraudProduct's evidenceQuote()
//     returns `claim.raw_value`, the resolver's byte-verified quote). No
//     Other Reps / Fraud facts are atomic (one quote per fact, no provision
//     grouping), so all three legacy fields carry that same real quote --
//     never invented filler text.
//   - deal_id: absent from the projection entirely. The Material Contracts
//     PROJECTION has the same gap and is handed deal_id as a sibling
//     constructor argument (see projectMaterialContractsProductSurfaces).
//     This bridge follows that precedent: callers must pass deal_id
//     explicitly, sourced from the legacy review deal being bridged into,
//     and it is cross-checked against that review deal's own dealId before
//     merge.
//   - excerpt_id and canonical_v2_lineage.claim_revision_ids: the
//     PROJECTION drops both, but the resolver's own `resolved` array (the
//     same array the caller already passed to projectNoOtherRepsFraudProduct
//     to build the projection in the first place) still carries them, on
//     `resolved[i].claim.evidence[0].excerpt_id` and
//     `resolved[i].claim.claim_revision_id` -- both real, content-derived
//     identities computed upstream, never invented here. This bridge
//     therefore takes `resolved` as a REQUIRED second input alongside the
//     projection (see bridgeNoOtherRepsFraudCardsToLegacyShape) and binds
//     each review fact to its resolved item by resolution_id (embedded in
//     `row_id`), the same lookup projectNoOtherRepsFraudProduct itself uses
//     to fill in `source_section_reference`. A fact with zero or duplicate
//     resolution bindings fails closed (MISSING_RESOLUTION_BINDING /
//     DUPLICATE_RESOLUTION_ID) rather than guessing.
//   - excerpt_id is NOT a unique card identity in this family: a
//     non-reliance acknowledgment and its auto-derived extra-contractual
//     disclaimer proposal legitimately quote the SAME source sentence (see
//     shapeNoOtherRepsFraudProposals), so they legitimately share one
//     excerpt_id. Card identity and claim-to-card binding therefore use
//     `provision_instance_id` (unique per resolved claim), never
//     `excerpt_id` -- matching how Material Contracts' own bridge claims
//     also carry an explicit provision_instance_id binding field.
//   - open_items / open-world evidence: the projection surfaces none (every
//     `review` entry is already a resolved, positive-presence claim), so
//     this bridge has no open-item concept to reconcile. Its closest
//     faithful analogue is internal: `review`, `query`, `compare` and
//     `market` are four parallel arrays built from the same underlying
//     facts, in the same order, and assertProjectionFactsReconcile checks
//     that they still agree before anything is bridged.
//
// FAIL CLOSED exactly like the Material Contracts bridge: altered
// authority, altered claim content (a short_title that no longer matches
// its governed label), altered lineage (a claim_revision_id no longer
// bound to its own claim identity), a fabricated quote/attribute not
// present verbatim in the fact's own evidence, and malformed identities all
// throw NoOtherRepsFraudDarkBridgeError before anything reaches a review
// deal.

const { types: nodeTypes } = require('node:util');
const { canonicalJson, contentId } = require('./canonical-bytes');
const {
  AUTHORITY_STATE: PROJECTION_AUTHORITY_STATE,
  LABELS,
  PRODUCT_PROJECTION_SCHEMA,
} = require('./no-other-reps-fraud-product-projection');
const {
  REQUIRED_ATTRIBUTES,
} = require('./native-producer/no-other-reps-fraud-resolution');
const {
  ELEMENTS,
} = require('./native-producer/no-other-reps-fraud-contract');
const {
  assertDarkBridgeIntegrationAllowed,
} = require('./dark-bridge-gate');

const BRIDGE_SCHEMA = 'CANONICAL_V2_NO_OTHER_REPS_FRAUD_LEGACY_CARD_BRIDGE/V1';
const AUTHORITY_STATE = 'VALIDATED_NOT_SERVED';
const SOURCE_AUTHENTICATION_STATE = 'SOURCE_UNAUTHENTICATED_EXTERNAL_BOUNDARY';
const ID_PREFIX = 'cv2:';
const NATIVE_SOURCE = 'CANONICAL_V2_NATIVE_CLAIM';
const ROW_ID_PREFIX = 'no-other-reps-fraud-';
const SIDES = Object.freeze(['TARGET', 'BUYER']);
const LOWERCASE_SHA256 = /^[0-9a-f]{64}$/;

const OWNER_FAMILY_TABLE_ID = Object.freeze({
  NO_OTHER_REPS_FRAUD: 'no-other-reps-fraud',
  KEY_DEFINED_TERMS: 'key-defined-terms',
});
const WILLFUL_BREACH_CLAIM_DEFINITION_KEY = 'WILLFUL_BREACH_DEFINITION_PRESENT';

// LABELS maps claim_definition_key -> label (six distinct labels). The
// projection's review facts carry only the label, never the key, so this
// bridge inverts LABELS once at load time to recover it.
const LABEL_TO_CLAIM_DEFINITION_KEY = Object.freeze(
  Object.fromEntries(Object.entries(LABELS).map(([key, label]) => [label, key])),
);

// ELEMENTS is keyed by producer GENERIC_KEY; REQUIRED_ATTRIBUTES too. Both
// are re-indexed here by claim_definition_key (the key the projection's
// facts actually resolve to via LABEL_TO_CLAIM_DEFINITION_KEY), and merged
// into one lookup so allowed/required attribute rules are read from the
// real contract module, never re-typed by hand.
const ELEMENT_BY_CLAIM_DEFINITION_KEY = Object.freeze(
  Object.fromEntries(
    Object.entries(ELEMENTS).map(([genericKey, element]) => [
      element.claim_definition_key,
      Object.freeze({
        ...element,
        required_attributes: Object.freeze(REQUIRED_ATTRIBUTES[genericKey] || []),
      }),
    ]),
  ),
);

const REVIEW_FACT_FIELDS = Object.freeze([
  'row_id', 'table_id', 'label', 'status', 'concept_key',
  'owner_family', 'attributes', 'evidence', 'source_section_reference',
]);
const QUERY_FACT_FIELDS = Object.freeze(['field_key', 'value', 'concept_key', 'present', 'attributes']);
const COMPARE_FACT_FIELDS = Object.freeze(['field_key', 'display_value', 'concept_key']);
const MARKET_FACT_FIELDS = Object.freeze(['metric_key', 'cohort', 'present', 'concept_key', 'breakdown']);
const PROJECTION_FIELDS = Object.freeze([
  'schema_version', 'authority_state', 'review', 'query', 'compare', 'market', 'projection_id',
]);
const LINEAGE_FIELDS = Object.freeze(['source', 'claim_revision_ids']);
const NORF_CARD_FIELDS = Object.freeze([
  'id', 'provision_instance_id', 'deal_id', 'excerpt_id',
  'type', 'provision_type', 'provision_subtype',
  'section_ref', 'short_title',
  'primary_quote', 'region_full_text', 'full_text',
  'features', 'ai_metadata',
  'concept_key', 'owner_family', 'claim_definition_key', 'attributes',
  'canonical_v2_lineage',
]);
const BRIDGE_CARD_FIELDS = Object.freeze([
  ...NORF_CARD_FIELDS, 'provenance', 'authority_state', 'source_authentication_state',
]);
const NORF_CLAIM_FIELDS = Object.freeze([
  'id', 'deal_id', 'excerpt_id', 'provision_instance_id',
  'attribute', 'verbatim', 'evidence_quote',
  'concept_key', 'claim_definition_key', 'attributes',
]);
const BRIDGE_CLAIM_FIELDS = Object.freeze([
  ...NORF_CLAIM_FIELDS, 'authority_state', 'source_authentication_state',
]);
const BRIDGE_FIELDS = Object.freeze([
  'schema_version', 'bridge_id', 'authority_state', 'source_authentication_state',
  'source_projection_schema', 'source_projection_id', 'deal_id', 'cards', 'claims',
]);

const MAX_PLAIN_DEPTH = 64;
const MAX_PLAIN_WIDTH = 50000;
const MAX_PLAIN_NODES = 250000;
const MAX_PLAIN_BYTES = 4 * 1024 * 1024;

class NoOtherRepsFraudDarkBridgeError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'NoOtherRepsFraudDarkBridgeError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new NoOtherRepsFraudDarkBridgeError(code, message, details);
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

// --- generic plain-data hygiene, copied from legacy-card-bridge.js -------
// These helpers are family-agnostic (no Material Contracts vocabulary in
// them); they are reproduced here rather than imported so this module has
// no runtime dependency on the Material Contracts bridge module.

function snapshotPlainJson(
  value,
  path = 'value',
  seen = new Set(),
  state = { nodes: 0, bytes: 0 },
  depth = 0,
) {
  state.nodes += 1;
  if (state.nodes > MAX_PLAIN_NODES || depth > MAX_PLAIN_DEPTH) {
    fail('INVALID_PLAIN_DATA', `${path} exceeds the plain-data complexity limit.`, { path });
  }
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    state.bytes += Buffer.byteLength(value, 'utf8');
    if (state.bytes > MAX_PLAIN_BYTES) {
      fail('INVALID_PLAIN_DATA', `${path} exceeds the plain-data byte limit.`, { path });
    }
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || Object.is(value, -0)) {
      fail('INVALID_PLAIN_DATA', `${path} must contain only canonical finite numbers.`);
    }
    return value;
  }
  if (typeof value !== 'object') {
    fail('INVALID_PLAIN_DATA', `${path} must contain only JSON data.`, { path });
  }
  if (nodeTypes.isProxy(value)) fail('INVALID_PLAIN_DATA', `${path} must not be a Proxy.`, { path });
  if (seen.has(value)) fail('INVALID_PLAIN_DATA', `${path} must not contain cycles.`, { path });
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype) {
        fail('INVALID_PLAIN_DATA', `${path} must be a plain array.`, { path });
      }
      const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
      const length = lengthDescriptor?.value;
      if (!Number.isInteger(length) || length < 0 || length > MAX_PLAIN_WIDTH) {
        fail('INVALID_PLAIN_DATA', `${path} exceeds the plain-array width limit.`, { path });
      }
      const allowedKeys = new Set(['length', ...Array.from({ length }, (_, index) => String(index))]);
      for (const key of Reflect.ownKeys(value)) {
        if (typeof key !== 'string' || !allowedKeys.has(key)) {
          fail('INVALID_PLAIN_DATA', `${path} must not contain hidden or symbol properties.`, { path });
        }
      }
      return Array.from({ length }, (_, index) => {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
          fail('INVALID_PLAIN_DATA', `${path}[${index}] must be an enumerable data property.`, {
            path: `${path}[${index}]`,
          });
        }
        return snapshotPlainJson(descriptor.value, `${path}[${index}]`, seen, state, depth + 1);
      });
    }
    if (Object.getPrototypeOf(value) !== Object.prototype) {
      fail('INVALID_PLAIN_DATA', `${path} must be a plain object.`, { path });
    }
    const keys = Reflect.ownKeys(value);
    if (keys.length > MAX_PLAIN_WIDTH) {
      fail('INVALID_PLAIN_DATA', `${path} exceeds the plain-object width limit.`, { path });
    }
    const snapshot = {};
    for (const key of keys) {
      if (typeof key !== 'string') {
        fail('INVALID_PLAIN_DATA', `${path} must not contain symbol properties.`, { path });
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
        fail('INVALID_PLAIN_DATA', `${path}.${key} must be an enumerable data property.`, {
          path: `${path}.${key}`,
        });
      }
      if (descriptor.value === undefined && state.omitUndefinedObjectFields === true) continue;
      state.bytes += Buffer.byteLength(key, 'utf8');
      if (state.bytes > MAX_PLAIN_BYTES) {
        fail('INVALID_PLAIN_DATA', `${path} exceeds the plain-data byte limit.`, { path });
      }
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

function assertExactFields(value, expectedFields, entity) {
  const expected = new Set(expectedFields);
  const actual = Object.keys(value);
  const unexpected = actual.filter((field) => !expected.has(field));
  const missing = expectedFields.filter((field) => !Object.hasOwn(value, field));
  if (unexpected.length || missing.length) {
    fail('INVALID_ENVELOPE_FIELDS', `${entity} does not have the exact closed field set.`, {
      entity, missing, unexpected,
    });
  }
}

function cv2Id(rawId) {
  if (!nonEmptyString(rawId)) {
    fail('MISSING_REQUIRED_FIELD', 'A Canonical V2 identity must be a non-empty string.', { field: 'identity' });
  }
  if (rawId.startsWith(ID_PREFIX)) {
    fail('PREPREFIXED_IDENTITY', 'A source identity must not already use the Canonical V2 bridge prefix.', {
      identity: rawId,
    });
  }
  return `${ID_PREFIX}${rawId}`;
}

function prefixedIdentity(value) {
  return nonEmptyString(value) && value.startsWith(ID_PREFIX) && value.length > ID_PREFIX.length;
}

function assertRawSha(value, code, message, details = {}) {
  if (!nonEmptyString(value) || !LOWERCASE_SHA256.test(value)) fail(code, message, details);
}

// -- grounding verification tiers --------------------------------------------
// A record attribute (relying_party_ref, agreement_scope_quote, defined_term_ref,
// ...) is genuinely a SUB-PHRASE of its own fact's evidence quote by design --
// these attributes have never carried an independent start/end offset
// anywhere in this family's pipeline. Checked directly: the PRODUCER only
// ever does `quote.includes(value)` when shaping a candidate (see
// no-other-reps-fraud-producer.js's `contained()`); the RESOLVER repeats the
// same plain containment check against proposal.raw_value (no-other-reps-
// fraud-resolution.js, REQUIRED_ATTRIBUTES/quotedAttributes validation); and
// the PROJECTION carries `attributes` straight through with no span field at
// all. So no upstream stage -- not just this bridge -- ever computes or
// retains a per-attribute offset. Plain substring containment (the previous
// check here) accepts a meaning-inverting fragment as long as it lands on
// any word boundary: dropping a preceding "not"/"no"/"would not" never
// breaks a word boundary, so containment alone can never establish semantic
// fidelity (whether a sub-span preserves meaning depends on the text
// preceding it, which containment never looks at).
//
// Two tiers are applied here, in order, each strictly stronger than plain
// containment:
//   1. EXACT EQUALITY to the fact's full evidence quote -- unconditionally
//      sound, and the correct check whenever an attribute legitimately IS
//      the whole quote.
//   2. WORD-BOUNDARY-ANCHORED containment -- the weakest tier this bridge
//      accepts, and the family's ceiling absent upstream offsets. It still
//      closes a truncated prefix, a mid-word slice (e.g. "accurate" out of
//      "inaccurate") and an arbitrary mid-quote substring; it CANNOT close a
//      word-boundary-aligned negation drop, because dropping a whole
//      preceding word can never itself violate a word boundary. Closing
//      that would require the resolver to capture and forward a genuine
//      per-attribute start/end offset -- an upstream change outside this
//      bridge, not something re-derivable safely down here.
//
// PLAN.md Step 3E re-checked this, deliberately, rather than trusting
// docs/codex-program/notes/negation-reversal.md's section 6 unverified, and
// left it as found. Re-running that note's own proposed fix (wire in the
// shared lib/negation-boundary-guard.js at this checkpoint, exempting
// `_ref`-suffixed attributes and any `_quote` value beginning with an
// "except"/"excluding"/"other than"/"but for"/"save for" lead-in) against
// this family's one real fixture surfaces a SECOND real false positive the
// note never found: `non_reliance.extra_contractual_scope_quote`
// ("including projections, forecasts...") sits after the exact same "is not
// relying" negation as the note's own documented case, but its own lead-in
// ("including") is not in the proposed exemption list, so the proposed fix
// does not save it either. The measurements are in
// tests/canonical-v2-no-other-reps-fraud-negation-investigation.test.js.
// Nothing here was changed as a result: shipping a heuristic that has now
// failed real-fixture validation on two separate fields is the same
// half-right outcome the note already rejected once, not a smaller version
// of it.
function isWordChar(character) {
  return /[A-Za-z0-9_]/.test(character || '');
}

// A boundary is required only on a side where the needle's OWN edge is a
// word character -- if the needle's edge is punctuation (e.g. a threshold
// like "$100,000"), there is no word to accidentally extend on that side,
// so that side is satisfied unconditionally.
function anchoredContains(haystack, needle) {
  if (typeof haystack !== 'string' || !nonEmptyString(needle)) return false;
  let from = 0;
  for (;;) {
    const index = haystack.indexOf(needle, from);
    if (index === -1) return false;
    const before = index > 0 ? haystack[index - 1] : '';
    const after = haystack[index + needle.length] || '';
    const leftOk = !isWordChar(needle[0]) || !isWordChar(before);
    const rightOk = !isWordChar(needle[needle.length - 1]) || !isWordChar(after);
    if (leftOk && rightOk) return true;
    from = index + 1;
  }
}

// True when `candidate` is grounded in `sourceText` at the strongest tier
// this family's data can support: exact equality first, anchored
// containment as the fallback ceiling. Never plain (unanchored) containment.
function groundedInSource(candidate, sourceText) {
  if (typeof sourceText !== 'string' || !nonEmptyString(candidate)) return false;
  return candidate === sourceText || anchoredContains(sourceText, candidate);
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

// cardSortKey/compareCards/groupRowsBySection, copied (not imported) from
// legacy-card-bridge.js for the same reason the other generic helpers above
// are copied rather than required: family-agnostic infrastructure, no
// runtime dependency on a sibling bridge module. Used below so a chained
// merge recomputes `sections`/`definitions` exactly the way the other three
// families' merges already do (see the merge function's own header comment
// for why this family did not need them until dark-bridge chaining made
// this the normal path -- F11).
function cardSortKey(card) {
  const provenance = card.provenance && typeof card.provenance === 'object' ? card.provenance : {};
  const rawOffset = provenance.source_doc_offset_start;
  const offset = rawOffset !== null && rawOffset !== undefined && rawOffset !== ''
    && Number.isFinite(Number(rawOffset))
    ? Number(rawOffset)
    : Number.MAX_SAFE_INTEGER;
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
    if (!groups.has(sectionRef)) groups.set(sectionRef, {
      sectionRef,
      title: sectionRef,
      cards: [],
    });
    groups.get(sectionRef).cards.push(card);
  }
  return [...groups.values()].map((group) => ({
    ...group,
    cards: group.cards.sort(compareCards),
  }));
}

// buildBridgeReceipt/appendBridgeReceipt, copied (not imported) from
// legacy-card-bridge.js -- see that module's identical pair for the full
// rationale (F3): chained merges must APPEND to canonical_v2_bridge_receipts,
// never replace it, and must not duplicate a receipt for a bridge_id already
// present. This family used to write a distinct
// canonical_v2_no_other_reps_fraud_bridge_receipts key instead of the shared
// one -- the ONE reason its receipt alone survived a four-family chain
// (F3's symptom) rather than being lost the way General Covenants' and
// Material Contracts' were. That distinct key is retired in favour of the
// shared key below: nothing in this repository ever read it (no test, no
// table config, no other lib module), so moving entirely is a pure
// simplification, not a behaviour cut a consumer depended on -- see the
// merge function's own header comment.
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

// --- family-specific shape and content guards -----------------------------

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

// Single source of truth for "does this concept_key/claim_definition_key/
// owner_family/attributes/evidence combination cohere". Used both when
// adapting a fresh projection fact (nothing pre-existing to compare
// against, only derive) and when re-validating an already-built bridge card
// during merge (an untrusted envelope that may not have come from this
// module's own adapter at all -- so the same rule must be re-run, not
// merely assumed).
function assertGovernedClaimShape({
  claimDefinitionKey, ownerFamily, conceptKey, attributes, evidenceText,
}, index) {
  const element = ELEMENT_BY_CLAIM_DEFINITION_KEY[claimDefinitionKey];
  if (!element) {
    fail('UNKNOWN_LABEL', 'A record does not carry a governed No Other Reps / Fraud claim type.', { index });
  }
  if (ownerFamily !== element.owner_family) {
    fail('LABEL_KEY_MISMATCH', 'A record owner_family does not match its claim type.', { index });
  }
  requireObject(attributes, 'INVALID_PROJECTION', 'A record needs an attributes object.');
  const isWillful = claimDefinitionKey === WILLFUL_BREACH_CLAIM_DEFINITION_KEY;
  const side = attributes.representation_side;
  if (!isWillful && !SIDES.includes(side)) {
    fail('ATTRIBUTE_OUTSIDE_CLOSED_CONTRACT', 'A record representation_side is out of the governed enum.', { index });
  }
  if (isWillful && Object.hasOwn(attributes, 'representation_side')) {
    fail('ATTRIBUTE_OUTSIDE_CLOSED_CONTRACT', 'A Willful Breach record must not carry a representation side.', { index });
  }
  const expectedConcept = element.concept_key || `REP-${side === 'TARGET' ? 'T' : 'B'}-${element.element_kind}`;
  if (conceptKey !== expectedConcept) {
    fail('LABEL_KEY_MISMATCH', 'A record concept_key does not bind to its claim type and side.', { index });
  }
  const allowedAttributeKeys = new Set([
    ...element.allowed_attributes,
    ...(isWillful ? [] : ['representation_side']),
  ]);
  if (Object.keys(attributes).some((key) => !allowedAttributeKeys.has(key))) {
    fail('ATTRIBUTE_OUTSIDE_CLOSED_CONTRACT', 'A record attribute key is outside its closed contract.', { index });
  }
  for (const requiredKey of element.required_attributes) {
    if (!nonEmptyString(attributes[requiredKey])) {
      fail('REQUIRED_ATTRIBUTE_MISSING', `A record is missing required attribute ${requiredKey}.`, { index, requiredKey });
    }
  }
  for (const [key, value] of Object.entries(attributes)) {
    if (key === 'representation_side' || value === null || value === undefined) continue;
    if (typeof value !== 'string' || !groundedInSource(value, evidenceText)) {
      fail('ATTRIBUTE_NOT_VERBATIM', 'A record attribute is not grounded verbatim in its own evidence quote.', {
        index, key, verification_tier: 'NONE',
      });
    }
  }
  const expectedType = isWillful ? 'DEF' : (expectedConcept.startsWith('REP-T-') ? 'REP-T' : 'REP-B');
  const expectedProvisionType = isWillful ? 'DEFINITION' : 'REPRESENTATION';
  return { expectedConcept, expectedType, expectedProvisionType };
}

// Every review/query/compare/market entry is derived from the same
// underlying `facts` list inside projectNoOtherRepsFraudProduct, in the
// same order. This is the closest faithful analogue this family has to
// Material Contracts' open_items/evidence-card reconciliation: if any of
// the three derived arrays has drifted from `review` (wrong length, wrong
// concept_key, a fabricated market breakdown, ...), the projection cannot
// be trusted and the bridge must fail closed before adapting anything.
function assertProjectionFactsReconcile(review, query, compare, market) {
  if (query.length !== review.length || compare.length !== review.length || market.length !== review.length) {
    fail('PROJECTION_FACT_RECONCILIATION_FAILED', 'The projection fact arrays do not reconcile in length.');
  }
  review.forEach((fact, index) => {
    requireObject(fact, 'INVALID_PROJECTION', 'Each review fact must be an object.');
    const claimDefinitionKey = LABEL_TO_CLAIM_DEFINITION_KEY[fact.label];
    const expectedFieldKey = fact.owner_family === 'KEY_DEFINED_TERMS' ? 'definedTermFact' : 'noOtherRepsFraudFact';
    const expectedMetricKey = claimDefinitionKey ? `${claimDefinitionKey.toLowerCase()}_prevalence` : null;
    const q = query[index];
    const c = compare[index];
    const m = market[index];
    requireObject(q, 'PROJECTION_FACT_RECONCILIATION_FAILED', 'A query fact must be an object.');
    requireObject(c, 'PROJECTION_FACT_RECONCILIATION_FAILED', 'A compare fact must be an object.');
    requireObject(m, 'PROJECTION_FACT_RECONCILIATION_FAILED', 'A market fact must be an object.');
    assertExactFields(q, QUERY_FACT_FIELDS, 'query fact');
    assertExactFields(c, COMPARE_FACT_FIELDS, 'compare fact');
    assertExactFields(m, MARKET_FACT_FIELDS, 'market fact');
    const reconciled = expectedMetricKey !== null
      && q.field_key === expectedFieldKey
      && q.value === fact.label
      && q.concept_key === fact.concept_key
      && q.present === true
      && canonicalJson(q.attributes) === canonicalJson(fact.attributes)
      && c.field_key === expectedFieldKey
      && c.display_value === fact.label
      && c.concept_key === fact.concept_key
      && m.metric_key === expectedMetricKey
      && m.cohort === fact.owner_family
      && m.present === true
      && m.concept_key === fact.concept_key
      && canonicalJson(m.breakdown) === canonicalJson(fact.attributes);
    if (!reconciled) {
      fail('PROJECTION_FACT_RECONCILIATION_FAILED', 'A fact does not reconcile across review, query, compare and market.', { index });
    }
  });
}

function projectionBody(projection) {
  return {
    schema_version: projection.schema_version,
    authority_state: projection.authority_state,
    review: projection.review,
    query: projection.query,
    compare: projection.compare,
    market: projection.market,
  };
}

function validateProjection(projection) {
  const snapshot = snapshotPlainJson(projection, 'projection');
  assertCanonicalByteBudget(snapshot, 'projection');
  requireObject(snapshot, 'INVALID_PROJECTION', 'A No Other Reps / Fraud product projection is required.');
  assertExactFields(snapshot, PROJECTION_FIELDS, 'projection');
  if (snapshot.schema_version !== PRODUCT_PROJECTION_SCHEMA) {
    fail('INVALID_PROJECTION', 'The input is not a No Other Reps / Fraud product projection.');
  }
  if (snapshot.authority_state !== PROJECTION_AUTHORITY_STATE) {
    fail('WRONG_AUTHORITY', 'The projection does not carry dark-only authority.');
  }
  if (!Array.isArray(snapshot.review) || !Array.isArray(snapshot.query)
    || !Array.isArray(snapshot.compare) || !Array.isArray(snapshot.market)) {
    fail('INVALID_PROJECTION', 'The projection is missing its fact arrays.');
  }
  const expectedProjectionId = contentId(PRODUCT_PROJECTION_SCHEMA, projectionBody(snapshot));
  if (!LOWERCASE_SHA256.test(snapshot.projection_id) || snapshot.projection_id !== expectedProjectionId) {
    fail('STALE_PROJECTION_ID', 'The projection identity does not bind its current content.', {
      expected: expectedProjectionId, actual: snapshot.projection_id,
    });
  }
  assertProjectionFactsReconcile(snapshot.review, snapshot.query, snapshot.compare, snapshot.market);
  return snapshot;
}

// Indexes the resolver's own `resolved` array (the same array the caller
// already passed to projectNoOtherRepsFraudProduct) by resolution_id, so
// adaptReviewFactToLegacyCard can look up the real excerpt_id and
// claim_revision_id behind each review fact. A duplicate resolution_id
// fails closed immediately (a distinct code from the zero-match case
// adaptReviewFactToLegacyCard raises) -- never silently resolved by
// picking the first.
function indexResolvedByResolutionId(resolved) {
  if (!Array.isArray(resolved) || resolved.length === 0) {
    fail(
      'MISSING_RESOLUTION_INPUT',
      'The resolver resolved array is required to bridge No Other Reps / Fraud cards: it carries the real '
        + 'excerpt_id and claim_revision_id the projection itself does not surface.',
    );
  }
  const byId = new Map();
  resolved.forEach((item, index) => {
    requireObject(item, 'MISSING_RESOLUTION_INPUT', 'Each resolved item must be an object.');
    if (!nonEmptyString(item.resolution_id)) {
      fail('MISSING_RESOLUTION_INPUT', 'Each resolved item needs a resolution_id.', { index });
    }
    if (byId.has(item.resolution_id)) {
      fail('DUPLICATE_RESOLUTION_ID', 'Two resolved items share the same resolution_id.', {
        index, resolution_id: item.resolution_id,
      });
    }
    byId.set(item.resolution_id, item);
  });
  return byId;
}

// STEP 1 -- the explicit shape adapter. Converts ONE projection.review[]
// fact (flat, non-card-shaped) into a legacy-shaped provision card, binding
// it to its real upstream resolved claim for the fields the projection
// itself drops. See the module header for exactly which legacy fields are
// sourced from where.
//
// Gated even though its own output is not yet authority-stamped (stamping
// happens in stampCardAuthority, below, inside the builder): it still mints
// a legacy-shaped card from real projection/resolution data on demand, and
// this function is directly exported for its own separate test coverage, so
// it must refuse outside local/pre-production independent of the builder.
function adaptReviewFactToLegacyCard(fact, index, { dealId, resolvedIndex, env } = {}) {
  if (arguments.length >= 3) assertDarkBridgeIntegrationAllowed(env);
  else assertDarkBridgeIntegrationAllowed();
  requireObject(fact, 'INVALID_PROJECTION', 'Each projected review fact must be an object.');
  assertExactFields(fact, REVIEW_FACT_FIELDS, 'review fact');
  if (fact.status !== 'Present') {
    fail('INVALID_FACT_STATUS', 'A bridged fact must be a positive Present claim.', { index });
  }
  if (!nonEmptyString(fact.row_id) || !fact.row_id.startsWith(ROW_ID_PREFIX)) {
    fail('INVALID_FACT_IDENTITY', 'A fact row_id must use the No Other Reps / Fraud row prefix.', { index });
  }
  const resolutionId = fact.row_id.slice(ROW_ID_PREFIX.length);
  if (!LOWERCASE_SHA256.test(resolutionId)) {
    fail('INVALID_FACT_IDENTITY', 'A fact row_id must embed a lower-case SHA-256 resolution identity.', { index });
  }
  const claimDefinitionKey = LABEL_TO_CLAIM_DEFINITION_KEY[fact.label];
  if (!claimDefinitionKey) {
    fail('UNKNOWN_LABEL', 'A fact label does not match a governed No Other Reps / Fraud claim type.', {
      index, label: fact.label,
    });
  }
  const expectedTableId = OWNER_FAMILY_TABLE_ID[fact.owner_family];
  if (!expectedTableId || fact.table_id !== expectedTableId) {
    fail('LABEL_KEY_MISMATCH', 'A fact table_id does not match its owner_family.', { index });
  }
  if (!nonEmptyString(fact.evidence)) {
    fail('MISSING_REQUIRED_FIELD', 'A fact needs a non-empty evidence quote.', { index });
  }
  if (!nonEmptyString(fact.source_section_reference)) {
    fail('MISSING_REQUIRED_FIELD', 'A fact needs a non-empty source section reference.', { index });
  }
  if (!nonEmptyString(dealId)) {
    fail('MISSING_REQUIRED_FIELD', 'A deal_id is required to bridge No Other Reps / Fraud cards.');
  }
  const { expectedConcept, expectedType, expectedProvisionType } = assertGovernedClaimShape({
    claimDefinitionKey,
    ownerFamily: fact.owner_family,
    conceptKey: fact.concept_key,
    attributes: fact.attributes,
    evidenceText: fact.evidence,
  }, index);

  // Bind to the real upstream resolved claim for excerpt_id / claim_revision_id.
  // Zero matches fails closed here; duplicate resolution_ids already failed
  // closed in indexResolvedByResolutionId.
  const matched = resolvedIndex instanceof Map ? resolvedIndex.get(resolutionId) : undefined;
  if (!matched) {
    fail('MISSING_RESOLUTION_BINDING', 'A fact does not bind to any resolved claim.', { index });
  }
  requireObject(matched.claim, 'MISSING_RESOLUTION_BINDING', 'A resolved item needs a claim.');
  const boundMismatch = matched.claim.raw_value !== fact.evidence
    || matched.claim.concept_key !== fact.concept_key
    || matched.claim.owner_family !== fact.owner_family
    || matched.claim.claim_definition_key !== claimDefinitionKey
    || matched.section_reference !== fact.source_section_reference
    || matched.claim.state !== 'PRESENT'
    || matched.claim.canonical_value !== true
    || canonicalJson(matched.claim.attributes) !== canonicalJson(fact.attributes);
  if (boundMismatch) {
    fail('RESOLUTION_BINDING_MISMATCH', 'A fact does not match the resolved claim it is bound to.', { index });
  }
  if (!Array.isArray(matched.claim.evidence) || matched.claim.evidence.length !== 1) {
    fail('MISSING_RESOLUTION_BINDING', 'A resolved claim needs exactly one evidence edge.', { index });
  }
  const edge = matched.claim.evidence[0];
  requireObject(edge, 'MISSING_RESOLUTION_BINDING', 'A resolved claim evidence edge must be an object.');
  assertRawSha(
    edge.excerpt_id,
    'MISSING_RESOLUTION_BINDING',
    'A resolved claim evidence edge needs a real lower-case SHA-256 excerpt_id.',
    { index },
  );
  assertRawSha(
    matched.claim.claim_revision_id,
    'MISSING_RESOLUTION_BINDING',
    'A resolved claim needs a real lower-case SHA-256 claim_revision_id.',
    { index },
  );

  const id = cv2Id(resolutionId);
  const excerptId = cv2Id(edge.excerpt_id);
  const claimRevisionId = matched.claim.claim_revision_id;
  return deepFreeze({
    id,
    provision_instance_id: id,
    deal_id: dealId,
    excerpt_id: excerptId,
    type: expectedType,
    provision_type: expectedProvisionType,
    provision_subtype: expectedConcept,
    section_ref: fact.source_section_reference,
    short_title: fact.label,
    primary_quote: fact.evidence,
    region_full_text: fact.evidence,
    full_text: fact.evidence,
    features: Object.freeze({}),
    ai_metadata: Object.freeze({ features: Object.freeze({}) }),
    concept_key: expectedConcept,
    owner_family: fact.owner_family,
    claim_definition_key: claimDefinitionKey,
    attributes: deepFreeze({ ...fact.attributes }),
    canonical_v2_lineage: Object.freeze({
      source: NATIVE_SOURCE,
      claim_revision_ids: Object.freeze([claimRevisionId]),
    }),
  });
}

function buildClaimForCard(card) {
  const claimRevisionId = card.canonical_v2_lineage.claim_revision_ids[0];
  return deepFreeze({
    id: cv2Id(claimRevisionId),
    deal_id: card.deal_id,
    excerpt_id: card.excerpt_id,
    provision_instance_id: card.provision_instance_id,
    attribute: card.owner_family === 'KEY_DEFINED_TERMS' ? 'definedTermFact' : 'noOtherRepsFraudFact',
    verbatim: card.primary_quote,
    evidence_quote: card.primary_quote,
    concept_key: card.concept_key,
    claim_definition_key: card.claim_definition_key,
    attributes: card.attributes,
  });
}

function stampCardAuthority(card) {
  return deepFreeze({
    ...card,
    provenance: bridgeProvenance(),
    authority_state: AUTHORITY_STATE,
    source_authentication_state: SOURCE_AUTHENTICATION_STATE,
  });
}

function stampClaimAuthority(claim) {
  return deepFreeze({
    ...claim,
    authority_state: AUTHORITY_STATE,
    source_authentication_state: SOURCE_AUTHENTICATION_STATE,
  });
}

// STEP 2 -- build a fresh, validated bridge envelope from a V2 projection,
// its resolver `resolved` array, and a caller-supplied deal_id. Refuses to
// run at all unless the dark bridge gate is enabled. `env || process.env`
// cannot tell an explicit falsy env (undefined, null, '') from one that was
// never supplied -- both would silently resolve to the ambient process.env
// -- so arguments.length is used instead, exactly like the gate module.
function bridgeNoOtherRepsFraudCardsToLegacyShape(projection, { deal_id: dealId, resolved, env } = {}) {
  const envArgumentProvided = arguments.length >= 2;
  if (envArgumentProvided) assertDarkBridgeIntegrationAllowed(env);
  else assertDarkBridgeIntegrationAllowed();
  if (!nonEmptyString(dealId)) {
    fail('MISSING_REQUIRED_FIELD', 'A deal_id is required to bridge No Other Reps / Fraud cards.');
  }
  const validated = validateProjection(projection);
  const resolvedSnapshot = snapshotPlainJson(resolved, 'resolved');
  assertCanonicalByteBudget(resolvedSnapshot, 'resolved');
  const resolvedIndex = indexResolvedByResolutionId(resolvedSnapshot);

  const identities = new Map();
  const cards = [];
  const claims = [];
  validated.review.forEach((fact, index) => {
    const card = envArgumentProvided
      ? adaptReviewFactToLegacyCard(fact, index, { dealId, resolvedIndex, env })
      : adaptReviewFactToLegacyCard(fact, index, { dealId, resolvedIndex });
    const owner = `fact:${index}`;
    reserveIdentity(identities, card.id, owner, 'id');
    const claim = buildClaimForCard(card);
    reserveIdentity(identities, claim.id, owner, 'claim_id');
    cards.push(stampCardAuthority(card));
    claims.push(stampClaimAuthority(claim));
  });
  const body = {
    authority_state: AUTHORITY_STATE,
    source_authentication_state: SOURCE_AUTHENTICATION_STATE,
    source_projection_schema: PRODUCT_PROJECTION_SCHEMA,
    source_projection_id: validated.projection_id,
    deal_id: dealId,
    cards: Object.freeze(cards),
    claims: Object.freeze(claims),
  };
  return deepFreeze({
    schema_version: BRIDGE_SCHEMA,
    bridge_id: contentId(BRIDGE_SCHEMA, body),
    ...body,
  });
}

function bridgeBody(bridge) {
  return {
    authority_state: bridge.authority_state,
    source_authentication_state: bridge.source_authentication_state,
    source_projection_schema: bridge.source_projection_schema,
    source_projection_id: bridge.source_projection_id,
    deal_id: bridge.deal_id,
    cards: bridge.cards,
    claims: bridge.claims,
  };
}

// Independently re-validates an UNTRUSTED bridge envelope -- one that may
// not have come from bridgeNoOtherRepsFraudCardsToLegacyShape at all --
// before it is allowed anywhere near a review deal. Never assumes an
// envelope is legitimate just because it has the right shape.
//
// Gated too: this mints a deep-frozen, fully authority-stamped envelope of
// VALIDATED_NOT_SERVED records on its own, so it must refuse independently
// of whether a caller went through the builder above.
//
// excerpt_id is legitimately shared by more than one card in this family
// (see the module header), so cards bind to claims by the unique
// provision_instance_id, not by excerpt_id; excerpt_id is only checked for
// format and for matching between a claim and the card it binds to.
function validateBridgeEnvelope(bridge, env) {
  if (arguments.length >= 2) assertDarkBridgeIntegrationAllowed(env);
  else assertDarkBridgeIntegrationAllowed();
  const snapshot = snapshotPlainJson(bridge, 'bridge');
  assertCanonicalByteBudget(snapshot, 'bridge');
  requireObject(snapshot, 'INVALID_BRIDGE_ENVELOPE', 'A validated bridge envelope is required.');
  assertExactFields(snapshot, BRIDGE_FIELDS, 'bridge');
  if (snapshot.authority_state !== AUTHORITY_STATE) {
    fail('WRONG_AUTHORITY', 'The bridge does not have dark-only authority.');
  }
  if (snapshot.source_authentication_state !== SOURCE_AUTHENTICATION_STATE) {
    fail('SOURCE_NOT_AUTHENTICATED', 'The bridge must remain explicit that source authenticity is unverified.');
  }
  if (snapshot.schema_version !== BRIDGE_SCHEMA
    || snapshot.source_projection_schema !== PRODUCT_PROJECTION_SCHEMA
    || !LOWERCASE_SHA256.test(snapshot.source_projection_id)
    || !LOWERCASE_SHA256.test(snapshot.bridge_id)
    || !nonEmptyString(snapshot.deal_id)
    || !Array.isArray(snapshot.cards)
    || !Array.isArray(snapshot.claims)) {
    fail('INVALID_BRIDGE_ENVELOPE', 'The bridge envelope is incomplete.');
  }
  if (snapshot.bridge_id !== contentId(BRIDGE_SCHEMA, bridgeBody(snapshot))) {
    fail('STALE_BRIDGE_ID', 'The bridge identity does not bind its current content.');
  }

  const identities = new Map();
  const cardsByProvisionInstanceId = new Map();
  snapshot.cards.forEach((card, index) => {
    requireObject(card, 'INVALID_BRIDGE_ENVELOPE', 'Each bridge card must be a plain object.');
    assertExactFields(card, BRIDGE_CARD_FIELDS, 'bridge card');
    if (card.authority_state !== AUTHORITY_STATE) {
      fail('WRONG_AUTHORITY', 'A bridge card does not have dark-only authority.', { index });
    }
    if (card.source_authentication_state !== SOURCE_AUTHENTICATION_STATE) {
      fail('SOURCE_NOT_AUTHENTICATED', 'A bridge card must remain source-unauthenticated.', { index });
    }
    if (card.deal_id !== snapshot.deal_id) fail('DEAL_ID_MISMATCH', 'A bridge card belongs to a different deal.', { index });
    if (!prefixedIdentity(card.id) || !prefixedIdentity(card.excerpt_id)) {
      fail('INVALID_BRIDGE_IDENTITY', 'Each bridge card identity must use the Canonical V2 namespace.', { index });
    }
    if (card.provision_instance_id !== card.id) {
      fail('INVALID_BRIDGE_IDENTITY', 'A No Other Reps / Fraud bridge card must alias its own provision identity.', { index });
    }
    assertRawSha(
      card.id.slice(ID_PREFIX.length),
      'INVALID_BRIDGE_IDENTITY',
      'A bridge card identity must contain lower-case SHA-256.',
      { index },
    );
    assertRawSha(
      card.excerpt_id.slice(ID_PREFIX.length),
      'INVALID_BRIDGE_IDENTITY',
      'A bridge card excerpt identity must contain lower-case SHA-256.',
      { index },
    );
    requireObject(card.canonical_v2_lineage, 'INVALID_LINEAGE', 'A bridge card needs canonical_v2_lineage.');
    assertExactFields(card.canonical_v2_lineage, LINEAGE_FIELDS, 'canonical_v2_lineage');
    if (card.canonical_v2_lineage.source !== NATIVE_SOURCE) {
      fail('INVALID_LINEAGE', 'A bridge card lineage must be a native Canonical V2 claim.', { index });
    }
    const claimRevisionIds = card.canonical_v2_lineage.claim_revision_ids;
    if (!Array.isArray(claimRevisionIds) || claimRevisionIds.length !== 1
      || !LOWERCASE_SHA256.test(claimRevisionIds[0])) {
      fail(
        'INVALID_LINEAGE',
        'A bridge card lineage must carry exactly one lower-case SHA-256 claim revision identity.',
        { index },
      );
    }
    if (canonicalJson(card.provenance) !== canonicalJson(bridgeProvenance())) {
      fail('WRONG_AUTHORITY', 'A bridge card must retain exact dark provenance.', { index });
    }
    const { expectedConcept, expectedType, expectedProvisionType } = assertGovernedClaimShape({
      claimDefinitionKey: card.claim_definition_key,
      ownerFamily: card.owner_family,
      conceptKey: card.concept_key,
      attributes: card.attributes,
      evidenceText: card.primary_quote,
    }, index);
    if (card.concept_key !== expectedConcept || card.provision_subtype !== expectedConcept
      || card.type !== expectedType || card.provision_type !== expectedProvisionType) {
      fail('INVALID_CARD_KIND', 'A bridge card type does not match its claim type.', { index });
    }
    if (card.region_full_text !== card.primary_quote || card.full_text !== card.primary_quote) {
      fail('INVALID_CARD_KIND', 'A bridge card evidence fields must all equal its primary quote.', { index });
    }
    // Altered-claim-content guard: a card's stated title must still match
    // the governed label for the claim type it says it carries.
    if (card.short_title !== LABELS[card.claim_definition_key]) {
      fail('INVALID_CARD_KIND', 'A bridge card short_title does not match its governed label.', { index });
    }
    const owner = `bridge-card:${index}`;
    reserveIdentity(identities, card.id, owner, 'id');
    cardsByProvisionInstanceId.set(card.provision_instance_id, card);
  });

  snapshot.claims.forEach((claim, index) => {
    requireObject(claim, 'INVALID_BRIDGE_ENVELOPE', 'Each bridge claim must be a plain object.');
    assertExactFields(claim, BRIDGE_CLAIM_FIELDS, 'bridge claim');
    if (claim.authority_state !== AUTHORITY_STATE) {
      fail('WRONG_AUTHORITY', 'A bridge claim does not have dark-only authority.', { index });
    }
    if (claim.source_authentication_state !== SOURCE_AUTHENTICATION_STATE) {
      fail('SOURCE_NOT_AUTHENTICATED', 'A bridge claim must remain source-unauthenticated.', { index });
    }
    if (claim.deal_id !== snapshot.deal_id) fail('DEAL_ID_MISMATCH', 'A bridge claim belongs to a different deal.', { index });
    if (!prefixedIdentity(claim.id) || !prefixedIdentity(claim.provision_instance_id)) {
      fail('INVALID_BRIDGE_IDENTITY', 'A bridge claim identity must use the Canonical V2 namespace.', { index });
    }
    const rawClaimId = claim.id.slice(ID_PREFIX.length);
    assertRawSha(rawClaimId, 'INVALID_BRIDGE_IDENTITY', 'A bridge claim identity must contain lower-case SHA-256.', { index });
    const card = cardsByProvisionInstanceId.get(claim.provision_instance_id);
    if (!card) fail('MISSING_CARD_BINDING', 'A bridge claim does not bind to a bridge card.', { index });
    if (claim.excerpt_id !== card.excerpt_id
      || claim.verbatim !== card.primary_quote
      || claim.evidence_quote !== card.primary_quote
      || claim.concept_key !== card.concept_key
      || claim.claim_definition_key !== card.claim_definition_key
      || canonicalJson(claim.attributes) !== canonicalJson(card.attributes)) {
      fail('INVALID_CLAIM_CONTRACT', 'A bridge claim does not match its bridge card.', { index });
    }
    // Altered-lineage guard: the claim's own identity is a namespaced wrap
    // of a real claim_revision_id, and the card it binds to must carry that
    // SAME claim_revision_id in its lineage. A card whose lineage was
    // swapped to an unrelated (even if validly-shaped) revision id, without
    // the bound claim's identity changing to match, is caught here.
    if (card.canonical_v2_lineage.claim_revision_ids[0] !== rawClaimId) {
      fail('LINEAGE_IDENTITY_MISMATCH', 'A bridge claim identity does not bind to its card lineage.', { index });
    }
    const expectedAttribute = card.owner_family === 'KEY_DEFINED_TERMS' ? 'definedTermFact' : 'noOtherRepsFraudFact';
    if (claim.attribute !== expectedAttribute) {
      fail('INVALID_CLAIM_CONTRACT', 'A bridge claim has the wrong attribute key.', { index });
    }
    reserveIdentity(identities, claim.id, `bridge-claim:${index}`, 'id');
  });

  const claimedProvisionInstances = new Set(snapshot.claims.map((claim) => claim.provision_instance_id));
  if (claimedProvisionInstances.size !== snapshot.cards.length) {
    fail('MISSING_CARD_BINDING', 'Every No Other Reps / Fraud bridge card must have exactly one bridge claim.');
  }
  return deepFreeze(snapshot);
}

// STEP 3 -- merge a validated bridge envelope into a legacy review deal.
// Existing cards/claims are never mutated; incoming card/claim identities
// must not collide with anything already present. Refuses to run at all
// unless the dark bridge gate is enabled, independent of whether the
// envelope came from bridgeNoOtherRepsFraudCardsToLegacyShape in this same
// process.
//
// Recomputes `sections` and `definitions` from the full merged card set,
// exactly like the other three families' merges (F11 fix). This used to be
// the one merge that didn't: No Other Reps / Fraud dark cards are consumed
// directly off reviewDeal.cards by no-other-reps-fraud.config.js's own
// dark-preview path, so no consumer of ITS OWN read a recomputed section
// view, and that reasoning held as long as this bridge only ever merged
// alone. It stopped holding once lib/canonical-v2/review-preview-assembly.js
// started chaining all four families' merges into one reviewDeal: whichever
// family merges immediately before this one has already populated
// `sections`/`definitions` from ITS OWN cards, and leaving them unrecomputed
// here silently carried that now-stale view forward -- this family's own
// cards missing from `sections` (and, if THIS family merges before another,
// that next family inheriting the same staleness) even though `cards` and
// `cardCount` were always kept current. A chained review deal must be
// internally consistent regardless of which family merges in which
// position, not rely on some other family merging last to paper over it.
// `env || process.env` cannot tell an explicit falsy env (undefined, null,
// '') from one that was never supplied -- both would silently resolve to
// the ambient process.env -- so arguments.length is used instead, exactly
// like the gate module.
function mergeCanonicalV2NoOtherRepsFraudCardsIntoReviewDeal(reviewDeal, bridgeEnvelope, { env } = {}) {
  const envArgumentProvided = arguments.length >= 3;
  if (envArgumentProvided) assertDarkBridgeIntegrationAllowed(env);
  else assertDarkBridgeIntegrationAllowed();
  const reviewSnapshot = snapshotPlainJson(
    reviewDeal,
    'reviewDeal',
    new Set(),
    { nodes: 0, bytes: 0, omitUndefinedObjectFields: true },
  );
  assertCanonicalByteBudget(reviewSnapshot, 'reviewDeal');
  requireObject(reviewSnapshot, 'INVALID_REVIEW_DEAL', 'A reviewDeal object is required.');
  if (!nonEmptyString(reviewSnapshot.dealId) || !Array.isArray(reviewSnapshot.cards)) {
    fail('INVALID_REVIEW_DEAL', 'reviewDeal must contain dealId and cards.');
  }
  const bridge = envArgumentProvided
    ? validateBridgeEnvelope(bridgeEnvelope, env)
    : validateBridgeEnvelope(bridgeEnvelope);
  if (bridge.deal_id !== reviewSnapshot.dealId) {
    fail('DEAL_ID_MISMATCH', 'The bridge envelope belongs to a different review deal.', {
      expected: reviewSnapshot.dealId, actual: bridge.deal_id,
    });
  }

  const identities = new Map();
  reviewSnapshot.cards.forEach((card, index) => {
    requireObject(card, 'INVALID_REVIEW_DEAL', 'Each legacy card must be an object.');
    const owner = `legacy-card:${index}`;
    if (nonEmptyString(card.id)) reserveIdentity(identities, card.id, owner, 'id');
    if (nonEmptyString(card.provision_instance_id)) {
      reserveIdentity(identities, card.provision_instance_id, owner, 'provision_instance_id', {
        allowOwnerAlias: card.provision_instance_id === card.id,
      });
    }
  });
  (Array.isArray(reviewSnapshot.claims) ? reviewSnapshot.claims : []).forEach((claim, index) => {
    requireObject(claim, 'INVALID_REVIEW_DEAL', 'Each legacy claim must be an object.');
    if (nonEmptyString(claim.id)) reserveIdentity(identities, claim.id, `legacy-claim:${index}`, 'id');
  });
  // excerpt_id is intentionally NOT reserved as a unique identity for
  // incoming bridge cards: this family legitimately lets two distinct
  // claims (e.g. a non-reliance acknowledgment and its auto-derived
  // extra-contractual disclaimer) share one excerpt_id when they quote the
  // same source sentence. id/provision_instance_id remain the true, unique
  // identities and are reserved below.
  bridge.cards.forEach((card, index) => {
    const owner = `incoming-card:${index}`;
    reserveIdentity(identities, card.id, owner, 'id');
    reserveIdentity(identities, card.provision_instance_id, owner, 'provision_instance_id', { allowOwnerAlias: true });
  });
  bridge.claims.forEach((claim, index) => {
    reserveIdentity(identities, claim.id, `incoming-claim:${index}`, 'id');
  });

  const cards = Object.freeze([...reviewSnapshot.cards, ...bridge.cards]);
  const claims = Object.freeze([...(Array.isArray(reviewSnapshot.claims) ? reviewSnapshot.claims : []), ...bridge.claims]);
  const sections = Object.freeze(groupRowsBySection(cards).map((section) => Object.freeze({
    ...section,
    cards: Object.freeze([...section.cards]),
  })));
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

module.exports = {
  AUTHORITY_STATE,
  BRIDGE_SCHEMA,
  ID_PREFIX,
  NoOtherRepsFraudDarkBridgeError,
  SOURCE_AUTHENTICATION_STATE,
  adaptReviewFactToLegacyCard,
  bridgeNoOtherRepsFraudCardsToLegacyShape,
  cv2Id,
  mergeCanonicalV2NoOtherRepsFraudCardsIntoReviewDeal,
  validateBridgeEnvelope,
};
