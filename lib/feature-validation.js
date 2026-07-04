/* ─────────────────────────────────────────────────────────────────────────
   lib/feature-validation.js — write-time feature-shape validation.
   ───────────────────────────────────────────────────────────────────────────
   The rubric's FEATURES map is already a declarative schema (key, type,
   options, citable) per provision type/code — this module turns it into a
   validator so malformed feature bags are FLAGGED AT THE DOOR instead of
   surfacing months later as renderer bugs (the `[object Object]` fee hero,
   favorability under ten spellings, bool-vs-object drift).

   Severity model, calibrated against live data:
     error — shapes that break renderers (object where a scalar is declared,
             non-array where a list is declared, features not an object)
     warn  — drift worth counting but not breaking (unknown keys, enum values
             outside the declared options, stringly booleans)

   Enforcement is FLAG, not reject: rows store a compact
   ai_metadata.validation summary; the trust report aggregates per deal. Once
   the counts are driven to zero we can consider rejecting.

   CommonJS (used by parser-v2/store.js, API routes, tests).
   ───────────────────────────────────────────────────────────────────────── */

const { getFeaturesForType } = require('./rubric');
const { canonicalFavorability } = require('./search');

/* Keys the pipeline itself stamps into features — infrastructure, not
 * extraction output; never validated against the type schema. */
const INFRA_KEYS = new Set([
  'canonicalCode',
  'proposedCode',
  'proposedLabel',
  'isNewCode',
  'sectionNumber',
  'sort_order',
  'sourceSection',
  'sourceSectionTitle',
  'sourceSectionType',
  'inlineDefinition',
  'crossReferences',
  'relatedDefinitions',
  'startChar',
  'linkedBringDownStandard',
  'knowledgeScope',
  'aocCitedCovenantNames',
  'reapplied_corrections',
]);

const CANONICAL_FAVORABILITY = new Set(['buyer-favorable', 'seller-favorable', 'neutral']);

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/* Citable wrapper: { value, quotes|text } → the inner value. */
function unwrap(v) {
  if (isPlainObject(v) && 'value' in v && ('quotes' in v || 'text' in v)) return v.value;
  return v;
}

function checkDeclaredType(declared, raw) {
  const v = unwrap(raw);
  if (v === null || v === undefined) return null; // explicit null is always fine
  switch (declared) {
    case 'text':
    case 'currency':
    case 'percentage':
    case 'number':
      if (isPlainObject(v) || Array.isArray(v)) {
        return { kind: 'shape', severity: 'error', detail: `${declared} declared, got ${Array.isArray(v) ? 'array' : 'object'}` };
      }
      return null;
    case 'boolean':
      if (typeof v === 'boolean') return null;
      if (v === 'true' || v === 'false') {
        return { kind: 'stringly-boolean', severity: 'warn', detail: `boolean declared, got string "${v}"` };
      }
      if (isPlainObject(v) || Array.isArray(v)) {
        return { kind: 'shape', severity: 'error', detail: 'boolean declared, got object/array' };
      }
      return { kind: 'shape', severity: 'warn', detail: `boolean declared, got ${typeof v}` };
    case 'list':
      if (Array.isArray(v)) return null;
      return { kind: 'shape', severity: 'error', detail: `list declared, got ${isPlainObject(v) ? 'object' : typeof v}` };
    case 'enum':
      if (isPlainObject(v) || Array.isArray(v)) {
        return { kind: 'shape', severity: 'error', detail: 'enum declared, got object/array' };
      }
      return null; // option membership checked separately (needs schema entry)
    case 'object':
      if (isPlainObject(v)) return null;
      return { kind: 'shape', severity: 'warn', detail: `object declared, got ${Array.isArray(v) ? 'array' : typeof v}` };
    default:
      return null;
  }
}

/**
 * Validate a feature bag against the rubric schema for (type, canonicalCode).
 * Returns { errors: [...], warnings: [...] } of { key, kind, detail }.
 */
function validateFeatures(provisionType, features) {
  const errors = [];
  const warnings = [];
  const push = (v, key) => (v.severity === 'error' ? errors : warnings).push({ key, kind: v.kind, detail: v.detail });

  if (features === null || features === undefined) return { errors, warnings };
  if (!isPlainObject(features)) {
    errors.push({ key: null, kind: 'malformed-features', detail: `features is ${Array.isArray(features) ? 'array' : typeof features}` });
    return { errors, warnings };
  }

  const schema = getFeaturesForType(provisionType, features.canonicalCode) || [];
  const byKey = new Map();
  for (const entry of schema) if (!byKey.has(entry.key)) byKey.set(entry.key, entry);
  // Universal novelty channel: every type may carry a flags array of
  // { concern, text } — the no-shoehorning escape valve.
  if (!byKey.has('flags')) byKey.set('flags', { key: 'flags', type: 'list' });

  for (const [key, raw] of Object.entries(features)) {
    if (INFRA_KEYS.has(key)) continue;
    const entry = byKey.get(key);
    if (!entry) {
      warnings.push({ key, kind: 'unknown-key', detail: `not in ${provisionType}${features.canonicalCode ? `/${features.canonicalCode}` : ''} schema` });
      continue;
    }
    const typeViolation = checkDeclaredType(entry.type, raw);
    if (typeViolation) push(typeViolation, key);
    if (entry.type === 'enum' && Array.isArray(entry.options)) {
      const v = unwrap(raw);
      if (typeof v === 'string' && v && !entry.options.includes(v)) {
        warnings.push({ key, kind: 'enum-mismatch', detail: `"${v}" not in [${entry.options.join(', ')}]` });
      }
    }
  }
  return { errors, warnings };
}

/**
 * Validate a DB-shaped provision row (favorability + features).
 */
function validateProvisionRow(row) {
  const features = (row.ai_metadata && row.ai_metadata.features) || {};
  const result = validateFeatures(row.type, features);
  if (row.ai_favorability && !CANONICAL_FAVORABILITY.has(canonicalFavorability(row.ai_favorability))) {
    result.warnings.push({ key: 'ai_favorability', kind: 'non-canonical', detail: String(row.ai_favorability) });
  }
  return result;
}

/**
 * Compact summary for storage on the row (null when clean, so clean rows pay
 * zero bytes). Detail list capped.
 */
function validationSummary(result) {
  if (!result.errors.length && !result.warnings.length) return null;
  return {
    errors: result.errors.length,
    warnings: result.warnings.length,
    details: [...result.errors, ...result.warnings].slice(0, 10),
  };
}

module.exports = {
  validateFeatures,
  validateProvisionRow,
  validationSummary,
  unwrap,
  INFRA_KEYS,
};
