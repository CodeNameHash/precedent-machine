'use strict';

/**
 * lib/review-parity/mapping.js
 *
 * The field-mapping table is an INPUT to the harness, not part of it. Which
 * legacy row field corresponds to which Canonical V2 row field is being
 * determined separately; this module only defines the shape that answer has
 * to arrive in, validates it strictly, and content-addresses it so a report
 * can never be read against the wrong mapping.
 *
 * Validation is deliberately fail-closed: unknown keys are rejected rather
 * than ignored, because a typo'd field name that silently drops a field from
 * the comparison is exactly the failure this harness exists to prevent.
 */

const path = require('node:path');
const { contentId } = require('../canonical-v2/canonical-bytes');
const { compareCodeUnits } = require('./normalise');

const MAPPING_SCHEMA = 'REVIEW_PARITY_FIELD_MAPPING/V1';

/**
 * Field kinds. The kind decides how a difference is CLASSIFIED, never
 * whether it is reported.
 *
 *   text      Free text. Any post-fold difference is a DISAGREEMENT.
 *   quote     A quotation from the agreement. A shorter quote is V2_LOSS,
 *             a longer one V2_ADDITION, anything else DISAGREEMENT.
 *   citation  A section reference / code. Any difference is a DISAGREEMENT;
 *             citations are never "close enough".
 *   number    Numeric. Formatting ($, commas) folds; magnitude does not.
 *   set       Unordered collection. Order folds; membership does not.
 *             Multiset semantics -- a dropped duplicate is still a loss.
 *   sequence  Ordered collection. Order is substantive. A subsequence is
 *             V2_LOSS, a supersequence V2_ADDITION.
 *   flag      Boolean-ish. Any difference is a DISAGREEMENT.
 */
const FIELD_KINDS = Object.freeze([
  'text', 'quote', 'citation', 'number', 'set', 'sequence', 'flag',
]);

const V2_VIEWS = Object.freeze(['config_rows', 'projection_cards']);

// Module paths a mapping is allowed to name. A mapping is data supplied by a
// caller; without this an attacker-authored mapping file would be an
// arbitrary-require primitive.
const ALLOWED_MODULE_PREFIXES = Object.freeze([
  'components/review/table-configs/',
  'lib/canonical-v2/',
]);

const MAPPING_KEYS = new Set([
  'schema', 'mapping_version', 'family_id', 'notes', 'legacy', 'v2', 'row_key', 'fields',
]);
const LEGACY_KEYS = new Set(['config_module', 'config_export']);
const V2_KEYS = new Set(['config_module', 'config_export', 'projection_module', 'projection_export', 'view']);
const FIELD_KEYS = new Set(['field_id', 'legacy', 'v2', 'kind', 'fold_case', 'notes']);

class MappingError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'MappingError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new MappingError(code, message, details);
}

function requirePlainObject(value, code, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(code, `${label} must be an object`);
  }
  return value;
}

function rejectUnknownKeys(value, allowed, code, label) {
  const unknown = Object.keys(value).filter((key) => !allowed.has(key)).sort(compareCodeUnits);
  if (unknown.length) fail(code, `${label} has unknown keys: ${unknown.join(', ')}`, { unknown });
}

function requireNonEmptyString(value, code, label) {
  if (typeof value !== 'string' || value.trim() === '') fail(code, `${label} must be a non-empty string`);
  return value;
}

function assertSafeModulePath(value, label) {
  requireNonEmptyString(value, 'MAPPING_BAD_MODULE', label);
  if (value.startsWith('/') || value.includes('\\')) fail('MAPPING_BAD_MODULE', `${label} must be a repo-relative POSIX path`);
  const normalised = path.posix.normalize(value);
  if (normalised !== value) fail('MAPPING_BAD_MODULE', `${label} must be already-normalised (no . or .. segments)`);
  if (normalised.split('/').includes('..')) fail('MAPPING_BAD_MODULE', `${label} must not traverse upwards`);
  if (!normalised.endsWith('.js')) fail('MAPPING_BAD_MODULE', `${label} must name a .js module`);
  if (!ALLOWED_MODULE_PREFIXES.some((prefix) => normalised.startsWith(prefix))) {
    fail('MAPPING_BAD_MODULE', `${label} must live under one of: ${ALLOWED_MODULE_PREFIXES.join(', ')}`, {
      allowed: [...ALLOWED_MODULE_PREFIXES],
    });
  }
  return normalised;
}

function assertFieldPath(value, code, label) {
  requireNonEmptyString(value, code, label);
  if (value !== value.trim()) fail(code, `${label} must not have surrounding whitespace`);
  const segments = value.split('.');
  if (segments.some((segment) => segment === '')) fail(code, `${label} has an empty path segment`);
  if (segments.some((segment) => segment === '__proto__' || segment === 'constructor' || segment === 'prototype')) {
    fail(code, `${label} names a forbidden path segment`);
  }
  return value;
}

/**
 * Validate and freeze a mapping table. Returns a frozen mapping carrying a
 * content-addressed `mapping_id`, so every report can name exactly which
 * mapping produced it.
 */
function compileMapping(input) {
  requirePlainObject(input, 'MAPPING_NOT_OBJECT', 'mapping');
  rejectUnknownKeys(input, MAPPING_KEYS, 'MAPPING_UNKNOWN_KEY', 'mapping');

  if (input.schema !== MAPPING_SCHEMA) {
    fail('MAPPING_BAD_SCHEMA', `mapping.schema must be ${MAPPING_SCHEMA}`, { found: input.schema });
  }
  requireNonEmptyString(input.mapping_version, 'MAPPING_BAD_VERSION', 'mapping.mapping_version');
  requireNonEmptyString(input.family_id, 'MAPPING_BAD_FAMILY', 'mapping.family_id');

  const legacy = requirePlainObject(input.legacy, 'MAPPING_BAD_LEGACY', 'mapping.legacy');
  rejectUnknownKeys(legacy, LEGACY_KEYS, 'MAPPING_UNKNOWN_KEY', 'mapping.legacy');
  const legacyModule = assertSafeModulePath(legacy.config_module, 'mapping.legacy.config_module');
  const legacyExport = requireNonEmptyString(legacy.config_export, 'MAPPING_BAD_LEGACY', 'mapping.legacy.config_export');

  const v2 = requirePlainObject(input.v2, 'MAPPING_BAD_V2', 'mapping.v2');
  rejectUnknownKeys(v2, V2_KEYS, 'MAPPING_UNKNOWN_KEY', 'mapping.v2');
  const view = v2.view === undefined ? 'config_rows' : v2.view;
  if (!V2_VIEWS.includes(view)) {
    fail('MAPPING_BAD_V2', `mapping.v2.view must be one of: ${V2_VIEWS.join(', ')}`, { found: v2.view });
  }
  // When the V2 side renders through a table config (the default), it uses
  // the legacy config unless the mapping deliberately names a different one
  // -- rendering both sides through the SAME config is what makes a
  // difference attributable to the data rather than to the renderer.
  const v2ConfigModule = v2.config_module === undefined
    ? legacyModule
    : assertSafeModulePath(v2.config_module, 'mapping.v2.config_module');
  const v2ConfigExport = v2.config_export === undefined
    ? legacyExport
    : requireNonEmptyString(v2.config_export, 'MAPPING_BAD_V2', 'mapping.v2.config_export');
  const projectionModule = v2.projection_module === undefined
    ? null
    : assertSafeModulePath(v2.projection_module, 'mapping.v2.projection_module');
  const projectionExport = v2.projection_export === undefined
    ? null
    : requireNonEmptyString(v2.projection_export, 'MAPPING_BAD_V2', 'mapping.v2.projection_export');
  if ((projectionModule === null) !== (projectionExport === null)) {
    fail('MAPPING_BAD_V2', 'mapping.v2.projection_module and projection_export must be supplied together');
  }

  if (!Array.isArray(input.fields) || input.fields.length === 0) {
    fail('MAPPING_BAD_FIELDS', 'mapping.fields must be a non-empty array');
  }
  const seen = new Set();
  const fields = input.fields.map((raw, index) => {
    requirePlainObject(raw, 'MAPPING_BAD_FIELDS', `mapping.fields[${index}]`);
    rejectUnknownKeys(raw, FIELD_KEYS, 'MAPPING_UNKNOWN_KEY', `mapping.fields[${index}]`);
    const fieldId = requireNonEmptyString(raw.field_id, 'MAPPING_BAD_FIELDS', `mapping.fields[${index}].field_id`);
    if (seen.has(fieldId)) fail('MAPPING_DUPLICATE_FIELD', `mapping.fields declares field_id "${fieldId}" twice`);
    seen.add(fieldId);
    if (!FIELD_KINDS.includes(raw.kind)) {
      fail('MAPPING_BAD_KIND', `mapping.fields[${index}].kind must be one of: ${FIELD_KINDS.join(', ')}`, { found: raw.kind });
    }
    if (raw.fold_case !== undefined && typeof raw.fold_case !== 'boolean') {
      fail('MAPPING_BAD_FIELDS', `mapping.fields[${index}].fold_case must be a boolean`);
    }
    return Object.freeze({
      field_id: fieldId,
      legacy: assertFieldPath(raw.legacy, 'MAPPING_BAD_FIELDS', `mapping.fields[${index}].legacy`),
      v2: assertFieldPath(raw.v2, 'MAPPING_BAD_FIELDS', `mapping.fields[${index}].v2`),
      kind: raw.kind,
      fold_case: raw.fold_case === true,
      notes: typeof raw.notes === 'string' ? raw.notes : null,
    });
  });

  if (!Array.isArray(input.row_key) || input.row_key.length === 0) {
    fail('MAPPING_BAD_ROW_KEY', 'mapping.row_key must be a non-empty array of field_ids');
  }
  const rowKeySeen = new Set();
  for (const fieldId of input.row_key) {
    requireNonEmptyString(fieldId, 'MAPPING_BAD_ROW_KEY', 'mapping.row_key entry');
    if (!seen.has(fieldId)) {
      fail('MAPPING_BAD_ROW_KEY', `mapping.row_key names "${fieldId}", which is not a declared field`, {
        declared: [...seen].sort(compareCodeUnits),
      });
    }
    if (rowKeySeen.has(fieldId)) fail('MAPPING_BAD_ROW_KEY', `mapping.row_key names "${fieldId}" twice`);
    rowKeySeen.add(fieldId);
  }

  const body = {
    schema: MAPPING_SCHEMA,
    mapping_version: input.mapping_version,
    family_id: input.family_id,
    legacy: { config_module: legacyModule, config_export: legacyExport },
    v2: {
      view,
      config_module: v2ConfigModule,
      config_export: v2ConfigExport,
      projection_module: projectionModule,
      projection_export: projectionExport,
    },
    row_key: [...input.row_key],
    fields: fields.map((field) => ({
      field_id: field.field_id,
      legacy: field.legacy,
      v2: field.v2,
      kind: field.kind,
      fold_case: field.fold_case,
    })),
  };

  return Object.freeze({
    ...body,
    legacy: Object.freeze(body.legacy),
    v2: Object.freeze(body.v2),
    row_key: Object.freeze(body.row_key),
    fields: Object.freeze(fields),
    notes: typeof input.notes === 'string' ? input.notes : null,
    mapping_id: contentId(MAPPING_SCHEMA, body),
  });
}

module.exports = {
  ALLOWED_MODULE_PREFIXES,
  FIELD_KINDS,
  MAPPING_SCHEMA,
  MappingError,
  V2_VIEWS,
  compileMapping,
};
