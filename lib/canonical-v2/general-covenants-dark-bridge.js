'use strict';

// General Covenants DARK bridge. Mirrors lib/canonical-v2/legacy-card-bridge.js
// (the Material Contracts dark bridge) structurally, but is NOT a consumer of
// it -- that module hardcodes Material-Contracts-only shapes (card kind
// REP-T/REPRESENTATION, the materialContractsBuckets feature, the fixed
// REP-T-CONTRACTS claim provenance code) and would reject every General
// Covenants card by design. This file re-implements the same fail-closed
// pattern against lib/canonical-v2/general-covenants-product-projection.js's
// actual output shape instead.
//
// Production authority is NONE. Every record this module emits is stamped
// authority_state: 'VALIDATED_NOT_SERVED' and stays INTEGRATED_NOT_SERVED --
// inspectable only in local/pre-production preview, never served.
//
// KEY DIFFERENCE FROM THE MATERIAL CONTRACTS TEMPLATE: the General Covenants
// projection does not stamp authority_state anywhere (neither does Material
// Contracts' input, so that part is the same) -- but its
// canonical_v2_lineage carries an EXTRA `owner_id` field for NATIVE_SOURCE
// cards (`{ source, owner_id, claim_revision_ids }` vs the template's
// `{ source, claim_revision_ids }`). Silently permitting an unrecognised
// extra field would defeat the closed-field-set discipline the template
// relies on, so this module widens the lineage contract to admit exactly
// `owner_id` (never any other extra key) and separately validates it against
// the registered lib/canonical-v2/p0-product-surface-routing.js owner for
// the card's own code -- an unmappable or mismatched owner fails closed
// (UNKNOWN_COVENANT_CODE / UNMAPPABLE_OWNER), it is never stripped or
// silently accepted.

const { types: nodeTypes } = require('node:util');
const { canonicalJson, contentId } = require('./canonical-bytes');
const {
  EVIDENCE_SOURCE,
  NATIVE_SOURCE,
  PROJECTION_SCHEMA,
} = require('./general-covenants-product-projection');
const { GENERAL_COVENANT_FOLLOW_ON_OWNERS } = require('./p0-product-surface-routing');
const { assertDarkBridgeIntegrationAllowed } = require('./dark-bridge-gate');

const BRIDGE_SCHEMA = 'CANONICAL_V2_GENERAL_COVENANTS_DARK_BRIDGE/V1';
const AUTHORITY_STATE = 'VALIDATED_NOT_SERVED';
const SOURCE_AUTHENTICATION_STATE = 'SOURCE_UNAUTHENTICATED_EXTERNAL_BOUNDARY';
const ID_PREFIX = 'cv2:';
const MAIN_CONCEPT_ATTRIBUTE = 'mainConcept';
const EVIDENCE_SUBTYPE = 'COV-UNTYPED-EVIDENCE';
const EVIDENCE_CARD_SCHEMA = 'CANONICAL_V2_GENERAL_COVENANT_EVIDENCE_CARD/V1';
const FEATURE_CLAIM_SCHEMA = 'CANONICAL_V2_GENERAL_COVENANT_PRODUCT_FEATURE_CLAIM/V1';

const PROJECTION_FIELDS = Object.freeze([
  'schema_version',
  'projection_id',
  'deal_id',
  'source',
  'cards',
  'claims',
  'open_items',
]);
const BRIDGE_FIELDS = Object.freeze([
  'schema_version',
  'bridge_id',
  'authority_state',
  'source_authentication_state',
  'source_projection_schema',
  'source_projection_id',
  'deal_id',
  'cards',
  'claims',
  'open_items',
]);
const REQUIRED_CARD_FIELDS = Object.freeze([
  'id',
  'deal_id',
  'excerpt_id',
  'section_ref',
  'short_title',
  'primary_quote',
  'provision_type',
]);
const REQUIRED_CLAIM_FIELDS = Object.freeze([
  'id',
  'deal_id',
  'excerpt_id',
  'attribute',
  'verbatim',
  'evidence_quote',
]);
const LOWERCASE_SHA256 = /^[0-9a-f]{64}$/;
const SOURCE_CARD_FIELDS = Object.freeze([
  'id',
  'provision_instance_id',
  'deal_id',
  'excerpt_id',
  'type',
  'provision_type',
  'provision_subtype',
  'section_ref',
  'short_title',
  'primary_quote',
  'region_full_text',
  'full_text',
  'features',
  'ai_metadata',
  'canonical_v2_lineage',
]);
const SOURCE_EVIDENCE_CARD_FIELDS = Object.freeze(
  SOURCE_CARD_FIELDS.filter((field) => field !== 'provision_instance_id'),
);
const SOURCE_CLAIM_FIELDS = Object.freeze([
  ...REQUIRED_CLAIM_FIELDS,
  'canonical',
  'provenance',
]);
const BRIDGE_CARD_FIELDS = Object.freeze([
  ...SOURCE_CARD_FIELDS,
  'provenance',
  'authority_state',
  'source_authentication_state',
]);
const BRIDGE_CLAIM_FIELDS = Object.freeze([
  ...SOURCE_CLAIM_FIELDS,
  'provision_instance_id',
  'authority_state',
  'source_authentication_state',
]);
const SOURCE_CLAIM_PROVENANCE_FIELDS = Object.freeze(['code', 'source', 'source_claim_revision_ids']);
const BRIDGE_CLAIM_PROVENANCE_FIELDS = Object.freeze([
  ...SOURCE_CLAIM_PROVENANCE_FIELDS,
  'canonical_v2_authority_state',
  'source_authentication_state',
]);
const MAX_PLAIN_DEPTH = 64;
const MAX_PLAIN_WIDTH = 50000;
const MAX_PLAIN_NODES = 250000;
const MAX_PLAIN_BYTES = 4 * 1024 * 1024;
const OPEN_ITEM_FIELDS = Object.freeze([
  'section_reference',
  'source_citation',
  'reason',
  'claim_definition_key',
  'raw_value',
  'canonical_value',
  'attributes',
  'evidence',
  'closure_id',
  'extraction_provenance',
  'citation_validation',
  'answer_provenance',
  'section_family_ai_unverified',
]);

class GeneralCovenantsDarkBridgeError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'GeneralCovenantsDarkBridgeError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new GeneralCovenantsDarkBridgeError(code, message, details);
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

function assertNoAuthorityFields(value, path = 'value') {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (key === 'authority_state' || key === 'canonical_v2_authority_state') {
      fail('INVALID_ENVELOPE_FIELDS', `${path} contains an authority field.`, { path, field: key });
    }
    assertNoAuthorityFields(child, `${path}.${key}`);
  }
}

function assertExactFields(value, expectedFields, entity) {
  const expected = new Set(expectedFields);
  const actual = Object.keys(value);
  const unexpected = actual.filter((field) => !expected.has(field));
  const missing = expectedFields.filter((field) => !Object.hasOwn(value, field));
  if (unexpected.length || missing.length) {
    fail('INVALID_ENVELOPE_FIELDS', `${entity} does not have the exact closed field set.`, {
      entity,
      missing,
      unexpected,
    });
  }
}

function cv2Id(rawId) {
  if (!nonEmptyString(rawId)) {
    fail('MISSING_REQUIRED_FIELD', 'A Canonical V2 identity must be a non-empty string.', {
      field: 'identity',
    });
  }
  if (rawId.startsWith(ID_PREFIX)) {
    fail('PREPREFIXED_IDENTITY', 'A source identity must not already use the Canonical V2 bridge prefix.', {
      identity: rawId,
    });
  }
  return `${ID_PREFIX}${rawId}`;
}

function assertRequiredFields(value, fields, entity, index) {
  for (const field of fields) {
    if (!nonEmptyString(value[field])) {
      fail('MISSING_REQUIRED_FIELD', `${entity} is missing required field ${field}.`, {
        entity,
        field,
        index,
      });
    }
  }
}

function assertAuthority(value, entity, index = null) {
  if (value.authority_state !== AUTHORITY_STATE) {
    fail('WRONG_AUTHORITY', `${entity} does not have dark-only authority.`, {
      entity,
      index,
      authority_state: value.authority_state,
    });
  }
}

function assertRawSha(value, code, message, details = {}) {
  if (!nonEmptyString(value) || !LOWERCASE_SHA256.test(value)) fail(code, message, details);
}

function reserveIdentity(owners, value, owner, field, { allowOwnerAlias = false } = {}) {
  const existing = owners.get(value);
  if (existing && !(allowOwnerAlias && existing.owner === owner)) {
    fail('ID_COLLISION', `${owner} has an identity collision.`, {
      field,
      value,
      first_owner: existing.owner,
      first_field: existing.field,
      second_owner: owner,
      second_field: field,
    });
  }
  if (!existing) owners.set(value, { owner, field });
}

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

// Widened vs. the Material Contracts template: NATIVE_SOURCE lineage here
// carries an extra `owner_id` -- admitted as a known field in a still-closed
// set, never opened up generally. `owner_id` presence/shape is validated
// here; whether it is the CORRECT registered owner for the card's own code
// is a business-rule cross-check that needs the card, so that half lives in
// assertGeneralCovenantCardKind below.
function cloneLineage(lineage, index) {
  requireObject(
    lineage,
    'MISSING_REQUIRED_FIELD',
    'A bridged card needs canonical_v2_lineage.',
  );
  if (![NATIVE_SOURCE, EVIDENCE_SOURCE].includes(lineage.source)) {
    fail('INVALID_LINEAGE', 'A bridged card has an unsupported Canonical V2 source.', {
      index,
      source: lineage.source,
    });
  }
  assertExactFields(
    lineage,
    lineage.source === NATIVE_SOURCE
      ? ['source', 'owner_id', 'claim_revision_ids']
      : ['source', 'reason', 'claim_revision_ids'],
    'canonical_v2_lineage',
  );
  const claimRevisionIds = Array.isArray(lineage.claim_revision_ids)
    ? [...lineage.claim_revision_ids]
    : [];
  if (!claimRevisionIds.every((value) => nonEmptyString(value) && LOWERCASE_SHA256.test(value))
    || new Set(claimRevisionIds).size !== claimRevisionIds.length) {
    fail('INVALID_LINEAGE', 'Canonical V2 claim lineage must contain distinct lower-case SHA-256 identities.', {
      index,
    });
  }
  if (lineage.source === NATIVE_SOURCE) {
    if (claimRevisionIds.length === 0) {
      fail('NATIVE_LINEAGE_REQUIRED', 'A native governed card needs at least one claim revision identity.', {
        index,
      });
    }
    if (!nonEmptyString(lineage.owner_id)) {
      fail('UNMAPPABLE_OWNER', 'A native General Covenants card lineage needs a non-empty owner_id.', { index });
    }
  }
  if (lineage.source === EVIDENCE_SOURCE) {
    if (claimRevisionIds.length !== 0) {
      fail('EVIDENCE_LINEAGE_NOT_EMPTY', 'Open-world evidence cannot claim governed claim revisions.', {
        index,
      });
    }
    if (!nonEmptyString(lineage.reason)) {
      fail('OPEN_WORLD_REASON_REQUIRED', 'Open-world evidence needs a non-empty reason.', { index });
    }
  }
  return Object.freeze({
    source: lineage.source,
    ...(lineage.source === NATIVE_SOURCE ? { owner_id: lineage.owner_id } : { reason: lineage.reason }),
    claim_revision_ids: Object.freeze(claimRevisionIds),
  });
}

// Card-kind + feature-shape guard. For NATIVE_SOURCE cards this is also
// where "unmappable provenance" fails closed: a code with no registered
// follow-on owner (UNKNOWN_COVENANT_CODE), or a lineage owner_id that does
// not match the registered owner for the card's own code (UNMAPPABLE_OWNER
// -- catches tampering/drift), both reject the card rather than silently
// promoting it. This never reclassifies EVIDENCE_SOURCE material as
// NATIVE_SOURCE (general-covenants-source-disposition.js's promotion
// boundary is respected by construction: the two branches below are
// disjoint and an evidence card can never take the native branch).
function assertGeneralCovenantCardKind(card, lineage, index) {
  if (card.type !== 'COV' || card.provision_type !== 'COVENANT_OTHER') {
    fail('INVALID_CARD_KIND', 'A bridged General Covenants card must be a covenant-other provision.', {
      index,
    });
  }
  const code = card.provision_subtype;
  if (lineage.source === EVIDENCE_SOURCE) {
    if (code !== EVIDENCE_SUBTYPE) {
      fail('INVALID_EVIDENCE_SUBTYPE', 'A bridged General Covenants evidence card has the wrong source-specific subtype.', {
        index,
        expected: EVIDENCE_SUBTYPE,
        actual: code,
      });
    }
    requireObject(
      card.ai_metadata,
      'INVALID_CARD_KIND',
      'A bridged General Covenants evidence card needs exact AI metadata.',
    );
    assertExactFields(card.ai_metadata, ['features'], 'card ai_metadata');
    if (canonicalJson(card.features || {}) !== canonicalJson({})
      || canonicalJson(card.ai_metadata.features) !== canonicalJson({})) {
      fail('OPEN_WORLD_FEATURES_NOT_EMPTY', 'Open-world evidence cannot carry governed features.', { index });
    }
    return;
  }
  if (!nonEmptyString(code) || !GENERAL_COVENANT_FOLLOW_ON_OWNERS[code]) {
    fail('UNKNOWN_COVENANT_CODE', 'A native General Covenants card has no registered follow-on owner for its code.', {
      index,
      code,
    });
  }
  if (lineage.owner_id !== GENERAL_COVENANT_FOLLOW_ON_OWNERS[code]) {
    fail('UNMAPPABLE_OWNER', 'A native General Covenants card lineage owner does not match its registered code owner.', {
      index,
      code,
      expected: GENERAL_COVENANT_FOLLOW_ON_OWNERS[code],
      actual: lineage.owner_id,
    });
  }
  requireObject(
    card.ai_metadata,
    'INVALID_CARD_KIND',
    'A bridged General Covenants card needs exact AI metadata.',
  );
  assertExactFields(card.ai_metadata, ['features', 'code'], 'card ai_metadata');
  if (card.ai_metadata.code !== code) {
    fail('INVALID_CARD_KIND', 'A native General Covenants card ai_metadata code must match its provision_subtype.', {
      index,
    });
  }
  if (canonicalJson(card.ai_metadata.features) !== canonicalJson(card.features || {})) {
    fail('FEATURE_METADATA_MISMATCH', 'Card features and metadata features must match exactly.', { index });
  }
  const featureKeys = Object.keys(card.features || {});
  if (featureKeys.length !== 1
    || featureKeys[0] !== MAIN_CONCEPT_ATTRIBUTE
    || typeof card.features[MAIN_CONCEPT_ATTRIBUTE] !== 'string'
    || !card.features[MAIN_CONCEPT_ATTRIBUTE]) {
    fail('INVALID_NATIVE_FEATURES', 'A native General Covenants card needs exactly one non-empty mainConcept feature.', {
      index,
      feature_keys: featureKeys,
    });
  }
  // The verbatim guard: mainConcept must equal the card's own retained
  // quotes exactly -- no paraphrase, no drift between the feature value and
  // what the source primary_quote actually says.
  const quote = card.features[MAIN_CONCEPT_ATTRIBUTE];
  if (quote !== card.primary_quote || quote !== card.region_full_text || quote !== card.full_text) {
    fail('QUOTE_NOT_VERBATIM', 'A native General Covenants card mainConcept must equal its primary quote verbatim.', {
      index,
    });
  }
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

function assertClaimContract(claim, card, index, { bridged = false } = {}) {
  const provenance = requireObject(
    claim.provenance,
    'INVALID_CLAIM_CONTRACT',
    'A General Covenants feature claim needs provenance.',
  );
  assertExactFields(
    provenance,
    bridged ? BRIDGE_CLAIM_PROVENANCE_FIELDS : SOURCE_CLAIM_PROVENANCE_FIELDS,
    `${bridged ? 'bridge ' : ''}claim provenance`,
  );
  if (claim.attribute !== MAIN_CONCEPT_ATTRIBUTE
    || claim.canonical !== card.features[MAIN_CONCEPT_ATTRIBUTE]) {
    fail('INVALID_CLAIM_CONTRACT', 'The feature claim must equal its card mainConcept feature.', { index });
  }
  if (claim.verbatim !== card.primary_quote || claim.evidence_quote !== card.primary_quote) {
    fail('INVALID_CLAIM_CONTRACT', 'The feature claim quotes must equal the card primary quote.', { index });
  }
  if (provenance.code !== card.provision_subtype || provenance.source !== NATIVE_SOURCE) {
    fail('INVALID_CLAIM_CONTRACT', 'The feature claim has invalid Canonical V2 provenance.', { index });
  }
  if (bridged && provenance.canonical_v2_authority_state !== AUTHORITY_STATE) {
    fail('WRONG_AUTHORITY', 'The bridge claim provenance is not dark-only.', { index });
  }
  if (bridged && provenance.source_authentication_state !== SOURCE_AUTHENTICATION_STATE) {
    fail('SOURCE_NOT_AUTHENTICATED', 'The bridge claim must retain its explicit unauthenticated-source state.', { index });
  }
  const revisionIds = provenance.source_claim_revision_ids;
  if (!Array.isArray(revisionIds)
    || revisionIds.some((value) => !LOWERCASE_SHA256.test(value))
    || new Set(revisionIds).size !== revisionIds.length
    || canonicalJson([...revisionIds].sort())
      !== canonicalJson([...card.canonical_v2_lineage.claim_revision_ids].sort())) {
    fail('INVALID_LINEAGE', 'The feature claim provenance must equal its card lineage.', { index });
  }
  const rawClaimId = bridged ? claim.id.slice(ID_PREFIX.length) : claim.id;
  assertRawSha(rawClaimId, 'INVALID_CLAIM_CONTRACT', 'A feature claim identity must be lower-case SHA-256.', { index });
  const rawProvisionInstanceId = card.provision_instance_id.startsWith(ID_PREFIX)
    ? card.provision_instance_id.slice(ID_PREFIX.length)
    : card.provision_instance_id;
  const expectedClaimId = contentId(FEATURE_CLAIM_SCHEMA, {
    provision_instance_id: rawProvisionInstanceId,
    code: card.provision_subtype,
    mainConcept: card.features[MAIN_CONCEPT_ATTRIBUTE],
  });
  if (rawClaimId !== expectedClaimId) {
    fail('INVALID_CLAIM_CONTRACT', 'The feature claim identity does not bind its governed feature.', { index });
  }
}

function assertOpenItemCard(item, card, ordinal, dealId) {
  requireObject(item, 'INVALID_OPEN_WORLD_ITEM', 'Each open item must be a plain object.');
  assertExactFields(item, OPEN_ITEM_FIELDS, 'open item');
  assertNoAuthorityFields(item, `open_items[${ordinal}]`);
  for (const field of ['closure_id', 'section_reference', 'raw_value', 'reason']) {
    if (!nonEmptyString(item[field])) {
      fail('INVALID_OPEN_WORLD_ITEM', `An open item is missing ${field}.`, { ordinal, field });
    }
  }
  const expectedId = contentId(EVIDENCE_CARD_SCHEMA, {
    deal_id: dealId,
    closure_id: item.closure_id,
    ordinal,
  });
  const matches = card
    && card.canonical_v2_lineage.source === EVIDENCE_SOURCE
    && card.id === expectedId
    && card.excerpt_id === `open-world:${item.closure_id}`
    && card.section_ref === item.section_reference
    && card.primary_quote === item.raw_value
    && card.region_full_text === item.raw_value
    && card.full_text === item.raw_value
    && card.canonical_v2_lineage.reason === item.reason;
  if (!matches) {
    fail('OPEN_WORLD_RECONCILIATION_FAILED', 'Each open item must bind to its exact evidence card.', {
      ordinal,
      closure_id: item.closure_id,
    });
  }
}

function bridgeCard(card, index, identities, dealId) {
  requireObject(card, 'INVALID_PROJECTION', 'Each projected card must be an object.');
  assertRequiredFields(card, REQUIRED_CARD_FIELDS, 'card', index);
  const lineageSource = card?.canonical_v2_lineage?.source;
  assertExactFields(
    card,
    lineageSource === EVIDENCE_SOURCE ? SOURCE_EVIDENCE_CARD_FIELDS : SOURCE_CARD_FIELDS,
    'source card',
  );
  if (card.deal_id !== dealId) {
    fail('DEAL_ID_MISMATCH', 'A projected card belongs to a different deal.', {
      index,
      expected: dealId,
      actual: card.deal_id,
    });
  }
  const lineage = cloneLineage(card.canonical_v2_lineage, index);
  assertGeneralCovenantCardKind(card, lineage, index);
  const rawProvisionId = nonEmptyString(card.provision_instance_id)
    ? card.provision_instance_id
    : card.id;
  assertRawSha(card.id, 'INVALID_CARD_IDENTITY', 'A source card identity must be lower-case SHA-256.', { index });
  assertRawSha(rawProvisionId, 'INVALID_CARD_IDENTITY', 'A source provision identity must be lower-case SHA-256.', { index });
  if (lineage.source === NATIVE_SOURCE
    && (card.id !== rawProvisionId || card.excerpt_id !== `native:${rawProvisionId}`)) {
    fail('INVALID_CARD_IDENTITY', 'A native card identity, provision identity and excerpt identity must bind exactly.', {
      index,
    });
  }
  const id = cv2Id(card.id);
  const provisionInstanceId = cv2Id(rawProvisionId);
  const excerptId = cv2Id(card.excerpt_id);
  const owner = `card:${index}`;
  reserveIdentity(identities, id, owner, 'id');
  reserveIdentity(identities, provisionInstanceId, owner, 'provision_instance_id', {
    allowOwnerAlias: provisionInstanceId === id,
  });
  // excerpt_id is carried citation data, not a unique card identity (see
  // lib/canonical-v2/no-other-reps-fraud-dark-bridge.js, the pattern this
  // follows programme-wide): two distinct cards may legitimately quote the
  // same source excerpt. id/provision_instance_id are the true identities
  // and are reserved above.
  const features = deepFreeze(snapshotPlainJson(card.features || {}, `cards[${index}].features`));
  const aiMetadata = deepFreeze({
    ...(card.ai_metadata || {}),
    features,
  });
  return deepFreeze({
    ...card,
    id,
    provision_instance_id: provisionInstanceId,
    excerpt_id: excerptId,
    features,
    ai_metadata: aiMetadata,
    provenance: bridgeProvenance(),
    canonical_v2_lineage: lineage,
    authority_state: AUTHORITY_STATE,
    source_authentication_state: SOURCE_AUTHENTICATION_STATE,
  });
}

function bridgeClaim(claim, index, identities, cardByRawExcerpt, dealId) {
  requireObject(claim, 'INVALID_PROJECTION', 'Each projected claim must be an object.');
  assertRequiredFields(claim, REQUIRED_CLAIM_FIELDS, 'claim', index);
  assertExactFields(claim, SOURCE_CLAIM_FIELDS, 'source claim');
  if (claim.deal_id !== dealId) {
    fail('DEAL_ID_MISMATCH', 'A projected claim belongs to a different deal.', {
      index,
      expected: dealId,
      actual: claim.deal_id,
    });
  }
  const bound = cardByRawExcerpt.get(claim.excerpt_id);
  if (!bound) {
    fail('MISSING_CARD_BINDING', 'A bridged claim does not bind to a bridged card excerpt.', {
      index,
      excerpt_id: claim.excerpt_id,
    });
  }
  if (bound.canonical_v2_lineage.source !== NATIVE_SOURCE) {
    fail('EVIDENCE_CLAIM_BINDING', 'A governed claim cannot bind to open-world evidence.', {
      index,
      excerpt_id: claim.excerpt_id,
    });
  }
  if (nonEmptyString(claim.provision_instance_id)
    && cv2Id(claim.provision_instance_id) !== bound.provision_instance_id) {
    fail('MISSING_CARD_BINDING', 'A bridged claim has a different provision identity from its card.', {
      index,
    });
  }
  assertClaimContract(claim, bound, index);
  const id = cv2Id(claim.id);
  reserveIdentity(identities, id, `claim:${index}`, 'id');
  const provenance = deepFreeze({
    ...claim.provenance,
    canonical_v2_authority_state: AUTHORITY_STATE,
    source_authentication_state: SOURCE_AUTHENTICATION_STATE,
  });
  return deepFreeze({
    ...claim,
    id,
    excerpt_id: bound.excerpt_id,
    provision_instance_id: bound.provision_instance_id,
    provenance,
    authority_state: AUTHORITY_STATE,
    source_authentication_state: SOURCE_AUTHENTICATION_STATE,
  });
}

function projectionBody(projection) {
  return {
    deal_id: projection.deal_id,
    source: projection.source,
    cards: projection.cards,
    claims: projection.claims,
    open_items: projection.open_items,
  };
}

function validateProjection(projection) {
  const snapshot = snapshotPlainJson(projection, 'projection');
  assertCanonicalByteBudget(snapshot, 'projection');
  requireObject(snapshot, 'INVALID_PROJECTION', 'A General Covenants projection is required.');
  assertExactFields(snapshot, PROJECTION_FIELDS, 'projection');
  if (snapshot.schema_version !== PROJECTION_SCHEMA
    || snapshot.source !== NATIVE_SOURCE
    || !LOWERCASE_SHA256.test(snapshot.projection_id)
    || !nonEmptyString(snapshot.deal_id)
    || !Array.isArray(snapshot.cards)
    || !Array.isArray(snapshot.claims)
    || !Array.isArray(snapshot.open_items)) {
    fail('INVALID_PROJECTION', 'The input is not a complete General Covenants product projection.');
  }
  const expectedProjectionId = contentId(PROJECTION_SCHEMA, projectionBody(snapshot));
  if (snapshot.projection_id !== expectedProjectionId) {
    fail('STALE_PROJECTION_ID', 'The General Covenants projection identity does not bind its current content.', {
      expected: expectedProjectionId,
      actual: snapshot.projection_id,
    });
  }
  return snapshot;
}

// Entry point. Fails closed immediately outside local/pre-production (see
// lib/canonical-v2/dark-bridge-gate.js) before any projection parsing runs,
// then rebuilds every card/claim from the ground up rather than trusting the
// input's own shape. `env = process.env` as a DEFAULT PARAMETER cannot tell
// an omitted argument from an explicit `undefined` (both silently resolve to
// process.env) -- arguments.length is used instead, exactly like the gate
// module's own isDarkBridgeIntegrationEnabled/assertDarkBridgeIntegrationAllowed.
function bridgeGeneralCovenantsCardsToLegacyShape(projection, env) {
  if (arguments.length >= 2) assertDarkBridgeIntegrationAllowed(env);
  else assertDarkBridgeIntegrationAllowed();
  const validatedProjection = validateProjection(projection);
  const identities = new Map();
  const cards = validatedProjection.cards.map((card, index) => bridgeCard(
    card,
    index,
    identities,
    validatedProjection.deal_id,
  ));
  // cardByRawExcerpt stays keyed by the projection's raw excerpt_id purely
  // as a join aid for binding claims to their card below (claims only carry
  // excerpt_id pre-bridge, never provision_instance_id) -- it is never a
  // uniqueness check. excerpt_id sharing across distinct cards is
  // legitimate (see bridgeCard above); identity collisions are guarded on
  // provision_instance_id instead, the same identity bridgeCard's own
  // reservation already protects.
  const cardByRawExcerpt = new Map();
  const rawProvisionInstanceIds = new Set();
  validatedProjection.cards.forEach((card, index) => {
    const rawProvisionInstanceId = nonEmptyString(card.provision_instance_id)
      ? card.provision_instance_id
      : card.id;
    if (rawProvisionInstanceIds.has(rawProvisionInstanceId)) {
      fail('ID_COLLISION', 'Projected cards share a provision identity.', {
        provision_instance_id: rawProvisionInstanceId,
      });
    }
    rawProvisionInstanceIds.add(rawProvisionInstanceId);
    cardByRawExcerpt.set(card.excerpt_id, cards[index]);
  });
  const sourceEvidenceCards = validatedProjection.cards.filter((card) => (
    card.canonical_v2_lineage?.source === EVIDENCE_SOURCE
  ));
  if (sourceEvidenceCards.length !== validatedProjection.open_items.length) {
    fail('OPEN_WORLD_RECONCILIATION_FAILED', 'Open items and evidence cards must have one-to-one coverage.');
  }
  validatedProjection.open_items.forEach((item, ordinal) => {
    const expectedId = contentId(EVIDENCE_CARD_SCHEMA, {
      deal_id: validatedProjection.deal_id,
      closure_id: item.closure_id,
      ordinal,
    });
    assertOpenItemCard(
      item,
      sourceEvidenceCards.find((card) => card.id === expectedId),
      ordinal,
      validatedProjection.deal_id,
    );
  });
  const claims = validatedProjection.claims.map((claim, index) => bridgeClaim(
    claim,
    index,
    identities,
    cardByRawExcerpt,
    validatedProjection.deal_id,
  ));
  // Keyed by provision_instance_id, not excerpt_id -- see cardByRawExcerpt
  // above. claims here already carry provision_instance_id, attached by
  // bridgeClaim's own return value.
  const claimCountByProvisionInstance = new Map();
  const claimAttributes = new Set();
  claims.forEach((claim, index) => {
    const claimAttributeKey = canonicalJson([claim.provision_instance_id, claim.attribute]);
    if (claimAttributes.has(claimAttributeKey)) {
      fail('DUPLICATE_CARD_ATTRIBUTE', 'A card excerpt has more than one claim for the same attribute.', {
        index,
        excerpt_id: claim.excerpt_id,
        attribute: claim.attribute,
      });
    }
    claimAttributes.add(claimAttributeKey);
    claimCountByProvisionInstance.set(
      claim.provision_instance_id,
      (claimCountByProvisionInstance.get(claim.provision_instance_id) || 0) + 1,
    );
  });
  for (const [index, card] of cards.entries()) {
    const claimCount = claimCountByProvisionInstance.get(card.provision_instance_id) || 0;
    if (card.canonical_v2_lineage.source === NATIVE_SOURCE && claimCount === 0) {
      fail('MISSING_CARD_BINDING', 'A native governed card has no projected feature claim.', { index });
    }
    if (card.canonical_v2_lineage.source === EVIDENCE_SOURCE && claimCount !== 0) {
      fail('EVIDENCE_CLAIM_BINDING', 'Open-world evidence cannot own projected feature claims.', { index });
    }
  }
  const body = {
    authority_state: AUTHORITY_STATE,
    source_authentication_state: SOURCE_AUTHENTICATION_STATE,
    source_projection_schema: PROJECTION_SCHEMA,
    source_projection_id: validatedProjection.projection_id,
    deal_id: validatedProjection.deal_id,
    cards: Object.freeze(cards),
    claims: Object.freeze(claims),
    open_items: deepFreeze(validatedProjection.open_items),
  };
  return deepFreeze({
    schema_version: BRIDGE_SCHEMA,
    bridge_id: contentId(BRIDGE_SCHEMA, body),
    ...body,
  });
}

function prefixedIdentity(value) {
  return nonEmptyString(value) && value.startsWith(ID_PREFIX) && value.length > ID_PREFIX.length;
}

function sourceProjectionBodyFromBridge(bridge) {
  const cards = bridge.cards.map((card) => {
    const source = {
      id: card.id.slice(ID_PREFIX.length),
      ...(card.canonical_v2_lineage.source === NATIVE_SOURCE
        ? { provision_instance_id: card.provision_instance_id.slice(ID_PREFIX.length) }
        : {}),
      deal_id: card.deal_id,
      excerpt_id: card.excerpt_id.slice(ID_PREFIX.length),
      type: card.type,
      provision_type: card.provision_type,
      provision_subtype: card.provision_subtype,
      section_ref: card.section_ref,
      short_title: card.short_title,
      primary_quote: card.primary_quote,
      region_full_text: card.region_full_text,
      full_text: card.full_text,
      features: card.features,
      ai_metadata: card.ai_metadata,
      canonical_v2_lineage: card.canonical_v2_lineage,
    };
    return source;
  });
  const claims = bridge.claims.map((claim) => ({
    id: claim.id.slice(ID_PREFIX.length),
    deal_id: claim.deal_id,
    excerpt_id: claim.excerpt_id.slice(ID_PREFIX.length),
    attribute: claim.attribute,
    canonical: claim.canonical,
    verbatim: claim.verbatim,
    evidence_quote: claim.evidence_quote,
    provenance: {
      code: claim.provenance.code,
      source: claim.provenance.source,
      source_claim_revision_ids: claim.provenance.source_claim_revision_ids,
    },
  }));
  return {
    deal_id: bridge.deal_id,
    source: NATIVE_SOURCE,
    cards,
    claims,
    open_items: bridge.open_items,
  };
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
  assertAuthority(snapshot, 'bridge');
  if (snapshot.source_authentication_state !== SOURCE_AUTHENTICATION_STATE) {
    fail('SOURCE_NOT_AUTHENTICATED', 'The bridge must remain explicit that source authenticity is unverified.');
  }
  if (snapshot.schema_version !== BRIDGE_SCHEMA
    || snapshot.source_projection_schema !== PROJECTION_SCHEMA
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
  if (snapshot.bridge_id !== contentId(BRIDGE_SCHEMA, body)) {
    fail('STALE_BRIDGE_ID', 'The bridge identity does not bind its current content.');
  }
  const reconstructedProjectionBody = sourceProjectionBodyFromBridge(snapshot);
  if (snapshot.source_projection_id !== contentId(PROJECTION_SCHEMA, reconstructedProjectionBody)) {
    fail('SOURCE_PROJECTION_MISMATCH', 'The bridge does not reconstruct its bound source projection.');
  }
  const identities = new Map();
  // Keyed by provision_instance_id, not excerpt_id: excerpt_id is carried
  // citation data (two distinct cards may legitimately quote the same
  // source excerpt -- see bridgeCard above), so it does no identity or join
  // work here. provision_instance_id is the unique key claims bind to below.
  const cardsByProvisionInstanceId = new Map();
  snapshot.cards.forEach((card, index) => {
    requireObject(card, 'INVALID_BRIDGE_ENVELOPE', 'Each bridge card must be a plain object.');
    assertRequiredFields(card, REQUIRED_CARD_FIELDS, 'bridge card', index);
    assertExactFields(card, BRIDGE_CARD_FIELDS, 'bridge card');
    assertAuthority(card, 'bridge card', index);
    if (card.source_authentication_state !== SOURCE_AUTHENTICATION_STATE) {
      fail('SOURCE_NOT_AUTHENTICATED', 'A bridge card must remain source-unauthenticated.', { index });
    }
    if (card.deal_id !== snapshot.deal_id) fail('DEAL_ID_MISMATCH', 'A bridge card belongs to a different deal.', { index });
    if (!prefixedIdentity(card.id)
      || !prefixedIdentity(card.provision_instance_id)
      || !prefixedIdentity(card.excerpt_id)) {
      fail('INVALID_BRIDGE_IDENTITY', 'Each bridge card identity must use the Canonical V2 namespace.', { index });
    }
    assertRawSha(card.id.slice(ID_PREFIX.length), 'INVALID_BRIDGE_IDENTITY', 'A bridge card identity must contain lower-case SHA-256.', { index });
    assertRawSha(card.provision_instance_id.slice(ID_PREFIX.length), 'INVALID_BRIDGE_IDENTITY', 'A bridge provision identity must contain lower-case SHA-256.', { index });
    const lineage = cloneLineage(card.canonical_v2_lineage, index);
    assertGeneralCovenantCardKind(card, lineage, index);
    if (canonicalJson(card.provenance) !== canonicalJson(bridgeProvenance())) {
      fail('WRONG_AUTHORITY', 'A bridge card must retain exact dark provenance.', { index });
    }
    const owner = `bridge-card:${index}`;
    reserveIdentity(identities, card.id, owner, 'id');
    reserveIdentity(identities, card.provision_instance_id, owner, 'provision_instance_id', {
      allowOwnerAlias: card.provision_instance_id === card.id,
    });
    cardsByProvisionInstanceId.set(card.provision_instance_id, card);
  });
  const evidenceCards = snapshot.cards.filter((card) => (
    card.canonical_v2_lineage.source === EVIDENCE_SOURCE
  ));
  if (evidenceCards.length !== snapshot.open_items.length) {
    fail('OPEN_WORLD_RECONCILIATION_FAILED', 'Bridge open items and evidence cards must have one-to-one coverage.');
  }
  snapshot.open_items.forEach((item, ordinal) => {
    const expectedRawId = contentId(EVIDENCE_CARD_SCHEMA, {
      deal_id: snapshot.deal_id,
      closure_id: item.closure_id,
      ordinal,
    });
    const card = evidenceCards.find((candidate) => candidate.id === cv2Id(expectedRawId));
    if (!card) {
      fail('OPEN_WORLD_RECONCILIATION_FAILED', 'A bridge open item has no exact evidence card.', { ordinal });
    }
    assertOpenItemCard(item, {
      ...card,
      id: expectedRawId,
      excerpt_id: card.excerpt_id.slice(ID_PREFIX.length),
    }, ordinal, snapshot.deal_id);
  });
  const claimCountByProvisionInstance = new Map();
  const claimAttributes = new Set();
  snapshot.claims.forEach((claim, index) => {
    requireObject(claim, 'INVALID_BRIDGE_ENVELOPE', 'Each bridge claim must be a plain object.');
    assertRequiredFields(claim, REQUIRED_CLAIM_FIELDS, 'bridge claim', index);
    assertExactFields(claim, BRIDGE_CLAIM_FIELDS, 'bridge claim');
    assertAuthority(claim, 'bridge claim', index);
    if (claim.source_authentication_state !== SOURCE_AUTHENTICATION_STATE) {
      fail('SOURCE_NOT_AUTHENTICATED', 'A bridge claim must remain source-unauthenticated.', { index });
    }
    if (claim.deal_id !== snapshot.deal_id) fail('DEAL_ID_MISMATCH', 'A bridge claim belongs to a different deal.', { index });
    if (!prefixedIdentity(claim.id)
      || !prefixedIdentity(claim.excerpt_id)
      || !prefixedIdentity(claim.provision_instance_id)) {
      fail('INVALID_BRIDGE_IDENTITY', 'Each bridge claim identity must use the Canonical V2 namespace.', { index });
    }
    assertRawSha(claim.id.slice(ID_PREFIX.length), 'INVALID_BRIDGE_IDENTITY', 'A bridge claim identity must contain lower-case SHA-256.', { index });
    // Bind by provision_instance_id (the unique identity), not excerpt_id
    // (carried citation data that distinct cards may legitimately share).
    // excerpt_id is still cross-checked for consistency with the bound card.
    const card = cardsByProvisionInstanceId.get(claim.provision_instance_id);
    if (!card || card.excerpt_id !== claim.excerpt_id) {
      fail('MISSING_CARD_BINDING', 'A bridge claim does not bind to its bridge card.', { index });
    }
    if (card.canonical_v2_lineage.source !== NATIVE_SOURCE) {
      fail('EVIDENCE_CLAIM_BINDING', 'A bridge claim cannot bind to evidence-only text.', { index });
    }
    assertClaimContract(claim, card, index, { bridged: true });
    reserveIdentity(identities, claim.id, `bridge-claim:${index}`, 'id');
    const claimAttributeKey = canonicalJson([claim.provision_instance_id, claim.attribute]);
    if (claimAttributes.has(claimAttributeKey)) {
      fail('DUPLICATE_CARD_ATTRIBUTE', 'A bridge card excerpt has duplicate attribute claims.', {
        index,
        excerpt_id: claim.excerpt_id,
        attribute: claim.attribute,
      });
    }
    claimAttributes.add(claimAttributeKey);
    claimCountByProvisionInstance.set(
      claim.provision_instance_id,
      (claimCountByProvisionInstance.get(claim.provision_instance_id) || 0) + 1,
    );
  });
  snapshot.cards.forEach((card, index) => {
    const claimCount = claimCountByProvisionInstance.get(card.provision_instance_id) || 0;
    if (card.canonical_v2_lineage.source === NATIVE_SOURCE && claimCount === 0) {
      fail('MISSING_CARD_BINDING', 'A native bridge card has no bridge claim.', { index });
    }
    if (card.canonical_v2_lineage.source === EVIDENCE_SOURCE && claimCount !== 0) {
      fail('EVIDENCE_CLAIM_BINDING', 'An evidence bridge card owns a bridge claim.', { index });
    }
  });
  return deepFreeze(snapshot);
}

// Chained dark-bridge merges (lib/canonical-v2/review-preview-assembly.js
// merges all four families' bridges into ONE review deal, in a fixed order)
// must not let a later family's receipt REPLACE an earlier family's -- see
// the identical pair in lib/canonical-v2/legacy-card-bridge.js (the
// template this module structurally mirrors) for the full rationale (F3).
// Reproduced here, not imported, matching this module's own "re-implements
// the same fail-closed pattern" convention rather than a runtime dependency
// on that sibling file. Dedup is keyed on bridge_id, a content hash of the
// bridge's own full body: two receipts sharing one bridge_id are, by
// construction, the same bridge, so merging it again must not duplicate it.
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

function mergeCanonicalV2CardsIntoReviewDeal(reviewDeal, bridgeEnvelope, { env } = {}) {
  // The gate is asserted at every public entry point, before any other validation. A
  // caller that hand-authors a self-consistent envelope must not be able to merge dark
  // cards by skipping the bridge builder that would otherwise have checked the gate.
  // `env || process.env` cannot tell an explicit falsy env (undefined, null, '') from
  // one that was never supplied -- both would silently resolve to the ambient
  // process.env -- so arguments.length is used instead, exactly like the gate module.
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
      expected: reviewSnapshot.dealId,
      actual: bridge.deal_id,
    });
  }
  const identities = new Map();
  for (const [index, card] of reviewSnapshot.cards.entries()) {
    requireObject(card, 'INVALID_REVIEW_DEAL', 'Each legacy card must be an object.');
    const owner = `legacy-card:${index}`;
    if (nonEmptyString(card.id)) reserveIdentity(identities, card.id, owner, 'id');
    if (nonEmptyString(card.provision_instance_id)) {
      reserveIdentity(
        identities,
        card.provision_instance_id,
        owner,
        'provision_instance_id',
        { allowOwnerAlias: card.provision_instance_id === card.id },
      );
    }
    // excerpt_id is intentionally NOT reserved here: this and other
    // families legitimately let two distinct cards (id/provision_instance_id
    // still unique) share one excerpt_id when they cite the same source
    // excerpt -- reserving it across the whole reviewDeal would make
    // chaining two families' bridge merges into one reviewDeal impossible.
  }
  for (const [index, claim] of (Array.isArray(reviewSnapshot.claims) ? reviewSnapshot.claims : []).entries()) {
    requireObject(claim, 'INVALID_REVIEW_DEAL', 'Each legacy claim must be an object.');
    if (nonEmptyString(claim.id)) {
      reserveIdentity(identities, claim.id, `legacy-claim:${index}`, 'id');
    }
  }
  for (const [index, card] of bridge.cards.entries()) {
    const owner = `incoming-card:${index}`;
    reserveIdentity(identities, card.id, owner, 'id');
    reserveIdentity(identities, card.provision_instance_id, owner, 'provision_instance_id', {
      allowOwnerAlias: card.provision_instance_id === card.id,
    });
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
  GeneralCovenantsDarkBridgeError,
  SOURCE_AUTHENTICATION_STATE,
  bridgeGeneralCovenantsCardsToLegacyShape,
  cv2Id,
  mergeCanonicalV2CardsIntoReviewDeal,
  validateBridgeEnvelope,
};
