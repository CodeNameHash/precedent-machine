'use strict';

const path = require('node:path');

const { canonicalJson, contentId } = require('../canonical-bytes');
const {
  GENERAL_COVENANT_DEDICATED_OWNERS,
  GENERAL_COVENANT_FOLLOW_ON_OWNERS,
  isDedicatedFamilyCovenantCode,
  routeGeneralCovenantCode,
} = require('../p0-product-surface-routing');

const OWNERSHIP_SCHEMA = 'CANONICAL_V2_M3_P0_PRODUCT_SURFACE_OWNERSHIP/V1';
const OWNERSHIP_PATH = path.resolve(
  __dirname,
  '../../../docs/codex-program/m3-p0-product-surface-ownership.json',
);
const OWNER_IDS = Object.freeze([
  'MATERIAL_CONTRACTS',
  'NO_OTHER_REPS_FRAUD',
  'GENERAL_COVENANT_ROUTER',
]);
const SOURCE_KINDS = Object.freeze([
  'COMPARE_FIELD',
  'DERIVED_VALUE',
  'MARKET_FIELD',
  'QUERY_FIELD',
  'RENDERED_ROW',
]);
const DISPOSITIONS = Object.freeze([
  'FOLLOW_ON',
  'NATIVE_FIRST_SLICE',
  'NO_SHARED_DERIVATION',
  'OWNED',
]);

class P0ProductSurfaceOwnershipError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'P0ProductSurfaceOwnershipError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new P0ProductSurfaceOwnershipError(code, message, details);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function exactKeys(value, expected) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && canonicalJson(Object.keys(value).sort()) === canonicalJson([...expected].sort());
}

function requireText(value, label) {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim()) {
    fail('INVALID_P0_OWNERSHIP', `${label} must be a non-empty trimmed string.`);
  }
  return value;
}

function validateSource(source, label) {
  if (!exactKeys(source, ['disposition', 'source_kind', 'source_locator', 'source_path'])) {
    fail('INVALID_P0_OWNERSHIP', `${label} must match the closed source contract.`);
  }
  if (!SOURCE_KINDS.includes(source.source_kind) || !DISPOSITIONS.includes(source.disposition)) {
    fail('INVALID_P0_OWNERSHIP', `${label} uses an unknown source kind or disposition.`);
  }
  requireText(source.source_path, `${label}.source_path`);
  requireText(source.source_locator, `${label}.source_locator`);
}

function validateOwner(owner, index) {
  const label = `owners[${index}]`;
  if (!exactKeys(owner, [
    'corpus',
    'first_slice',
    'follow_on',
    'owner_id',
    'owner_kind',
    'product_surface_id',
    'source_inventory',
    'surface_locator',
    'surface_path',
  ])) {
    fail('INVALID_P0_OWNERSHIP', `${label} must match the closed owner contract.`);
  }
  requireText(owner.owner_id, `${label}.owner_id`);
  if (!['NATIVE_FAMILY', 'ROUTING_UMBRELLA'].includes(owner.owner_kind)) {
    fail('INVALID_P0_OWNERSHIP', `${label}.owner_kind is not governed.`);
  }
  requireText(owner.product_surface_id, `${label}.product_surface_id`);
  requireText(owner.surface_path, `${label}.surface_path`);
  requireText(owner.surface_locator, `${label}.surface_locator`);
  if (!exactKeys(owner.first_slice, ['evidence_paths', 'slice_id', 'state'])
    || owner.first_slice.state !== 'IMPLEMENTED'
    || !Array.isArray(owner.first_slice.evidence_paths)
    || owner.first_slice.evidence_paths.length === 0) {
    fail('INVALID_P0_OWNERSHIP', `${label}.first_slice requires implemented evidence.`);
  }
  requireText(owner.first_slice.slice_id, `${label}.first_slice.slice_id`);
  if (!exactKeys(owner.corpus, ['card_count', 'claim_counts', 'deal_count', 'examples'])
    || !Number.isInteger(owner.corpus.card_count) || owner.corpus.card_count < 1
    || !Number.isInteger(owner.corpus.deal_count) || owner.corpus.deal_count < 1
    || !owner.corpus.claim_counts || typeof owner.corpus.claim_counts !== 'object'
    || Array.isArray(owner.corpus.claim_counts)
    || !Array.isArray(owner.corpus.examples) || owner.corpus.examples.length < 2) {
    fail('INVALID_P0_OWNERSHIP', `${label}.corpus must carry counts and examples.`);
  }
  if (!Array.isArray(owner.source_inventory) || owner.source_inventory.length === 0) {
    fail('INVALID_P0_OWNERSHIP', `${label}.source_inventory must not be empty.`);
  }
  owner.source_inventory.forEach((source, sourceIndex) => validateSource(
    source,
    `${label}.source_inventory[${sourceIndex}]`,
  ));
  const observedKinds = [...new Set(owner.source_inventory.map((source) => source.source_kind))].sort();
  if (canonicalJson(observedKinds) !== canonicalJson(SOURCE_KINDS)) {
    fail('INCOMPLETE_P0_SOURCE_INVENTORY', `${label} must inventory rendered, query, compare, market and derived sources.`);
  }
  if (!Array.isArray(owner.follow_on) || owner.follow_on.length === 0) {
    fail('INVALID_P0_OWNERSHIP', `${label}.follow_on must not be empty.`);
  }
}

function validateP0ProductSurfaceOwnership(register) {
  if (!exactKeys(register, ['owners', 'schema', 'snapshot'])
    || register.schema !== OWNERSHIP_SCHEMA
    || !exactKeys(register.snapshot, ['date', 'source'])) {
    fail('INVALID_P0_OWNERSHIP', 'The P0 ownership register has the wrong closed contract.');
  }
  requireText(register.snapshot.date, 'snapshot.date');
  requireText(register.snapshot.source, 'snapshot.source');
  if (!Array.isArray(register.owners) || register.owners.length !== OWNER_IDS.length) {
    fail('INVALID_P0_OWNERSHIP', 'The P0 ownership register must contain exactly three owners.');
  }
  register.owners.forEach(validateOwner);
  if (canonicalJson(register.owners.map((owner) => owner.owner_id)) !== canonicalJson(OWNER_IDS)) {
    fail('INVALID_P0_OWNERSHIP', 'The P0 owner universe must remain unique, complete and ordered.');
  }
  return register;
}

const CURRENT_P0_PRODUCT_SURFACE_OWNERSHIP = deepFreeze(require(OWNERSHIP_PATH));
validateP0ProductSurfaceOwnership(CURRENT_P0_PRODUCT_SURFACE_OWNERSHIP);
const CURRENT_P0_PRODUCT_SURFACE_OWNERSHIP_ID = contentId(
  OWNERSHIP_SCHEMA,
  CURRENT_P0_PRODUCT_SURFACE_OWNERSHIP,
);

module.exports = {
  CURRENT_P0_PRODUCT_SURFACE_OWNERSHIP,
  CURRENT_P0_PRODUCT_SURFACE_OWNERSHIP_ID,
  GENERAL_COVENANT_DEDICATED_OWNERS,
  GENERAL_COVENANT_FOLLOW_ON_OWNERS,
  OWNER_IDS,
  OWNERSHIP_PATH,
  OWNERSHIP_SCHEMA,
  P0ProductSurfaceOwnershipError,
  SOURCE_KINDS,
  isDedicatedFamilyCovenantCode,
  routeGeneralCovenantCode,
  validateP0ProductSurfaceOwnership,
};
