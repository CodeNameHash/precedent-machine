/**
 * lib/canonical-v2/native-producer/known-defect-registry.js
 *
 * A versioned, data-only registry of known extraction defects, referenced by
 * the M3 review protocol (docs/codex-program/EXECUTION-LEDGER.md, "M3 review
 * protocol": auto-pass requires "not in a known-defect group for that deal,
 * family, attribute or extraction mechanism"; a sampled error "adds the
 * pattern to the known-defect registry"). This file owns exactly the
 * registry's SHAPE, a validator for that shape, and an EMPTY initial entry
 * set -- it does not invent defects. Entries are added later, by hand, when
 * a real sampled error is confirmed, per the protocol.
 *
 * WHY {deal, family, attribute, extraction_mechanism}. This is the exact
 * four-part key the protocol names: a defect can be scoped to one deal, one
 * provision family, one attribute (claim definition), one extraction
 * mechanism, or any combination -- each field independently accepts the
 * wildcard '*' to mean "any". A defect entry with all four fields wildcarded
 * would exclude every candidate from auto-pass, so `validateKnownDefectRegistry`
 * does not forbid it (that is a legitimate, if drastic, moderation action)
 * but callers should treat it as exceptional.
 *
 * NO MODEL CALLS, NO INVENTED DEFECTS. This module never decides that
 * something IS a defect -- it only stores and matches entries a human
 * (per the protocol: Ben, after a sampled error) already confirmed.
 */

'use strict';

const { contentId } = require('../canonical-bytes');

const KNOWN_DEFECT_REGISTRY_SCHEMA = 'NATIVE_PRODUCER_KNOWN_DEFECT_REGISTRY/V1';
const KNOWN_DEFECT_ENTRY_SCHEMA = 'NATIVE_PRODUCER_KNOWN_DEFECT_ENTRY/V1';
const WILDCARD = '*';
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ENTRY_KEYS = Object.freeze([
  'schema_version',
  'deal',
  'family',
  'attribute',
  'extraction_mechanism',
  'pattern_description',
  'date_added',
]);
const SCOPE_FIELDS = Object.freeze(['deal', 'family', 'attribute', 'extraction_mechanism']);

class KnownDefectRegistryError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'KnownDefectRegistryError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new KnownDefectRegistryError(code, message, details);
}

function requireScopeField(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    fail('INVALID_ENTRY', `${label} must be a non-empty string (use '*' for "any")`, { label, value });
  }
  return value;
}

function validateEntryShape(entry, index) {
  const label = `known_defect_registry.entries[${index}]`;
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    fail('INVALID_ENTRY', `${label} must be an object`, { index });
  }
  const actualKeys = Object.keys(entry).sort();
  const expectedKeys = [...ENTRY_KEYS].sort();
  if (actualKeys.length !== expectedKeys.length || actualKeys.some((key, i) => key !== expectedKeys[i])) {
    fail('INVALID_ENTRY', `${label} fields do not match the closed defect-entry contract`, {
      index, actualKeys, expectedKeys,
    });
  }
  if (entry.schema_version !== KNOWN_DEFECT_ENTRY_SCHEMA) {
    fail('INVALID_ENTRY', `${label}.schema_version must be ${KNOWN_DEFECT_ENTRY_SCHEMA}`, { index });
  }
  for (const field of SCOPE_FIELDS) requireScopeField(entry[field], `${label}.${field}`);
  if (typeof entry.pattern_description !== 'string' || entry.pattern_description.trim().length === 0) {
    fail('INVALID_ENTRY', `${label}.pattern_description must be a non-empty string`, { index });
  }
  if (typeof entry.date_added !== 'string' || !ISO_DATE_RE.test(entry.date_added)) {
    fail('INVALID_ENTRY', `${label}.date_added must be an ISO-8601 date string (YYYY-MM-DD)`, { index });
  }
}

/**
 * Validates a known-defect-registry object's shape. Throws
 * `KnownDefectRegistryError` on any structural problem; returns the registry
 * unchanged (never mutated) when valid.
 */
function validateKnownDefectRegistry(registry) {
  if (!registry || typeof registry !== 'object' || Array.isArray(registry)) {
    fail('INVALID_REGISTRY', 'known_defect_registry must be an object');
  }
  if (registry.schema_version !== KNOWN_DEFECT_REGISTRY_SCHEMA) {
    fail('INVALID_REGISTRY', `known_defect_registry.schema_version must be ${KNOWN_DEFECT_REGISTRY_SCHEMA}`);
  }
  if (!Number.isInteger(registry.version) || registry.version < 1) {
    fail('INVALID_REGISTRY', 'known_defect_registry.version must be a positive integer');
  }
  if (!Array.isArray(registry.entries)) {
    fail('INVALID_REGISTRY', 'known_defect_registry.entries must be an array');
  }
  registry.entries.forEach((entry, index) => validateEntryShape(entry, index));
  return registry;
}

/**
 * Builds a frozen, content-addressed known-defect registry from a version
 * number and an entries array. `known_defect_registry_id` is content-addressed
 * over the version and entries, so two registries with the same entries in
 * the same order are the same registry -- and any change to the entry set
 * changes the id, so a resolution_receipt that pins this id can never point
 * silently at a different defect set later.
 */
function buildKnownDefectRegistry({ version, entries } = {}) {
  const body = {
    schema_version: KNOWN_DEFECT_REGISTRY_SCHEMA,
    version,
    entries: (entries || []).map((entry) => ({ schema_version: KNOWN_DEFECT_ENTRY_SCHEMA, ...entry })),
  };
  validateKnownDefectRegistry(body);
  const registry = Object.freeze({
    ...body,
    entries: Object.freeze(body.entries.map((entry) => Object.freeze({ ...entry }))),
    known_defect_registry_id: contentId(KNOWN_DEFECT_REGISTRY_SCHEMA, body),
  });
  return registry;
}

function scopeFieldMatches(entryValue, actualValue) {
  return entryValue === WILDCARD || entryValue === actualValue;
}

/**
 * Returns the first entry in `registry` whose four scope fields all match
 * `scope` (each field matches on exact equality or the entry's `'*'`
 * wildcard), or `null` if none match. Never throws for an unmatched scope --
 * "no known defect" is the expected common case, not an error.
 */
function matchesKnownDefect(registry, scope) {
  validateKnownDefectRegistry(registry);
  if (!scope || typeof scope !== 'object' || Array.isArray(scope)) {
    fail('INVALID_SCOPE', 'scope must be an object with deal, family, attribute and extraction_mechanism');
  }
  for (const field of SCOPE_FIELDS) requireScopeField(scope[field], `scope.${field}`);
  return registry.entries.find((entry) => SCOPE_FIELDS.every(
    (field) => scopeFieldMatches(entry[field], scope[field]),
  )) || null;
}

// The initial entry set is intentionally empty: no defect has been sampled
// and confirmed yet. See the file header -- this module never invents one.
const EMPTY_REGISTRY = buildKnownDefectRegistry({ version: 1, entries: [] });

module.exports = {
  KNOWN_DEFECT_REGISTRY_SCHEMA,
  KNOWN_DEFECT_ENTRY_SCHEMA,
  WILDCARD,
  KnownDefectRegistryError,
  EMPTY_REGISTRY,
  buildKnownDefectRegistry,
  validateKnownDefectRegistry,
  matchesKnownDefect,
};
