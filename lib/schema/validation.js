const { z } = require('zod');
const { FEATURES } = require('./features');
const { TAGS } = require('./tags');
const { taxonomyForFeatureKey } = require('../taxonomy');

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

const scalarSchema = z.union([z.string(), z.number(), z.boolean()]);
const taggedObjectSchema = z.object({ code: z.string().min(1) }).passthrough();
const objectSchema = z.record(z.string(), z.any());

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isTaggedObject(value) {
  return isPlainObject(value) && typeof value.code === 'string' && value.code.trim() !== '';
}

function unwrap(value) {
  if (isPlainObject(value) && 'value' in value && ('quotes' in value || 'text' in value)) return value.value;
  return value;
}

function featurePath(key) {
  return key ? [key] : [];
}

function issue(key, kind, message, severity = 'error') {
  return {
    path: featurePath(key),
    key: key || null,
    kind,
    message,
    detail: message,
    severity,
  };
}

function allFeatures() {
  return Object.values(FEATURES);
}

function featureAppliesTo(feature, provisionType, code) {
  if (!feature || !Array.isArray(feature.provisionTypes) || !feature.provisionTypes.includes(provisionType)) return false;
  if (!code) return true;
  return !Array.isArray(feature.provisionCodes) || feature.provisionCodes.length === 0 || feature.provisionCodes.includes(code);
}

function featuresForProvision(provisionType, code) {
  return allFeatures()
    .filter((feature) => featureAppliesTo(feature, provisionType, code))
    .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0) || a.key.localeCompare(b.key));
}

function tagsForFeature(feature) {
  if (!feature) return [];
  return Object.values(TAGS).filter((tag) => Array.isArray(tag.appearsOn) && tag.appearsOn.includes(feature.key));
}

function taxonomyDict(key) {
  return taxonomyForFeatureKey(key) || null;
}

function registryHasTagCode(feature, code) {
  if (!feature || !code) return false;
  const normalized = String(code).trim().toUpperCase();
  return tagsForFeature(feature).some((tag) => tag.code === normalized || (Array.isArray(tag.aliases) && tag.aliases.includes(normalized)));
}

function taxonomyHasCode(feature, code) {
  const dict = taxonomyDict(feature && feature.key);
  if (!dict || !code) return false;
  const normalized = String(code).trim().toUpperCase();
  if (Object.prototype.hasOwnProperty.call(dict, normalized)) return true;
  // Dictionary keys are not uniformly upper-case (EQUITY_INSTRUMENTS uses
  // "RSUs"/"PSUs") — a case-sensitive lookup on the upper-cased probe
  // false-flagged every RSU/PSU instrument corpus-wide (44 flags, TAX-1
  // survey 2026-07-18). Compare case-insensitively.
  return Object.keys(dict).some((k) => k.toUpperCase() === normalized);
}

function acceptedTaggedCode(feature, code) {
  if (!code) return false;
  return registryHasTagCode(feature, code) || taxonomyHasCode(feature, code);
}

function enumLikeScalar(raw) {
  const value = unwrap(raw);
  if (isTaggedObject(value)) return String(value.code).trim().toUpperCase();
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
}

function zodForAcceptedShape(feature) {
  switch (feature.valueType) {
    case 'boolean':
      return z.preprocess(unwrap, z.union([z.boolean(), z.string(), z.number()]).nullish());
    case 'list':
      return z.preprocess(unwrap, z.array(z.any()).nullish());
    case 'object':
      return z.preprocess(unwrap, z.union([objectSchema, scalarSchema, z.array(z.any())]).nullish());
    case 'enum':
      return z.preprocess(unwrap, z.union([scalarSchema, taggedObjectSchema]).nullish());
    case 'number':
    case 'string':
    case 'quote':
    default:
      return z.preprocess(unwrap, z.union([scalarSchema, taggedObjectSchema]).nullish());
  }
}

function buildValidatorForFeature(featureDef) {
  if (!featureDef || typeof featureDef !== 'object') {
    return z.any().superRefine((value, ctx) => {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'FeatureDef is missing.' });
    });
  }
  return zodForAcceptedShape(featureDef);
}

function buildValidatorForProvision(type, code) {
  const shape = {};
  for (const feature of featuresForProvision(type, code)) {
    shape[feature.key] = buildValidatorForFeature(feature).optional();
  }
  return z.object(shape).passthrough();
}

function checkSemanticDrift(feature, raw) {
  const value = unwrap(raw);
  if (value === null || value === undefined) return null;

  switch (feature.valueType) {
    case 'boolean':
      if (typeof value === 'boolean') return null;
      if (value === 'true' || value === 'false') {
        return issue(feature.key, 'stringly-boolean', `boolean declared, got string "${value}"`, 'warn');
      }
      if (isPlainObject(value) || Array.isArray(value)) {
        return issue(feature.key, 'shape', 'boolean declared, got object/array');
      }
      return issue(feature.key, 'shape', `boolean declared, got ${typeof value}`, 'warn');
    case 'list':
      if (Array.isArray(value)) return null;
      return issue(feature.key, 'shape', `list declared, got ${isPlainObject(value) ? 'object' : typeof value}`);
    case 'object':
      if (isPlainObject(value)) return null;
      return issue(feature.key, 'shape', `object declared, got ${Array.isArray(value) ? 'array' : typeof value}`, 'warn');
    case 'enum': {
      if (isTaggedObject(value) && acceptedTaggedCode(feature, value.code)) return null;
      if (isPlainObject(value) || Array.isArray(value)) return issue(feature.key, 'shape', 'enum declared, got object/array');
      const v = enumLikeScalar(raw);
      if (typeof v === 'string' && v && Array.isArray(feature.enumSet) && !feature.enumSet.includes(v) && !acceptedTaggedCode(feature, v)) {
        return issue(feature.key, 'enum-mismatch', `"${v}" not in [${feature.enumSet.join(', ')}]`, 'warn');
      }
      return null;
    }
    case 'number':
    case 'string':
    case 'quote':
    default:
      if ((isPlainObject(value) || Array.isArray(value)) && !(isTaggedObject(value) && acceptedTaggedCode(feature, value.code))) {
        return issue(feature.key, 'shape', `${feature.valueType} declared, got ${Array.isArray(value) ? 'array' : 'object'}`);
      }
      return null;
  }
}

function validateFeatures(provisionType, code, features) {
  if (features === undefined && isPlainObject(code)) {
    features = code;
    code = features.canonicalCode || null;
  }
  const errors = [];
  const warnings = [];

  if (features === null || features === undefined) return { ok: true, errors, warnings };
  const bag = z.record(z.string(), z.any()).safeParse(features);
  if (!bag.success || Array.isArray(features)) {
    errors.push(issue(null, 'malformed-features', `features is ${Array.isArray(features) ? 'array' : typeof features}`));
    return { ok: false, errors, warnings };
  }

  const canonicalCode = code || features.canonicalCode || null;
  const validator = buildValidatorForProvision(provisionType, canonicalCode);
  const parse = validator.safeParse(features);
  const zodErrorKeys = new Set();
  if (!parse.success) {
    for (const zodIssue of parse.error.issues) {
      const key = zodIssue.path && zodIssue.path.length ? String(zodIssue.path[0]) : null;
      if (!key || INFRA_KEYS.has(key)) continue;
      zodErrorKeys.add(key);
      errors.push(issue(key, 'shape', zodIssue.message));
    }
  }

  const byKey = new Map();
  for (const feature of featuresForProvision(provisionType, canonicalCode)) byKey.set(feature.key, feature);
  const typeWideByKey = new Map();
  for (const feature of featuresForProvision(provisionType, null)) typeWideByKey.set(feature.key, feature);
  if (!byKey.has('flags')) byKey.set('flags', FEATURES.flags || { key: 'flags', valueType: 'list' });

  for (const [key, raw] of Object.entries(features)) {
    if (INFRA_KEYS.has(key)) continue;
    const feature = byKey.get(key) || typeWideByKey.get(key);
    if (!feature) {
      warnings.push(issue(key, 'unknown-key', `not in ${provisionType}${canonicalCode ? `/${canonicalCode}` : ''} schema`, 'warn'));
      continue;
    }
    if (zodErrorKeys.has(key)) continue;
    const drift = checkSemanticDrift(feature, raw);
    if (!drift) continue;
    if (drift.severity === 'error') errors.push(drift);
    else warnings.push(drift);
  }

  return { ok: errors.length === 0, errors, warnings };
}

function validationSummary(result) {
  if (!result.errors.length && !result.warnings.length) return null;
  return {
    errors: result.errors.length,
    warnings: result.warnings.length,
    details: [...result.errors, ...result.warnings].slice(0, 10).map((entry) => ({
      key: entry.key == null ? null : entry.key,
      kind: entry.kind,
      detail: entry.detail || entry.message || '',
    })),
  };
}

module.exports = {
  INFRA_KEYS,
  buildValidatorForFeature,
  buildValidatorForProvision,
  validateFeatures,
  validationSummary,
  unwrap,
  registryHasTagCode,
  taxonomyHasCode,
  acceptedTaggedCode,
};
