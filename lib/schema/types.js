const FEATURE_VALUE_TYPES = new Set(['number', 'string', 'enum', 'boolean', 'object', 'list', 'quote']);
const FEATURE_UNITS = new Set([
  'percent',
  'usd',
  'days',
  'months',
  'business_days',
  'calendar_days',
  'multiplier',
]);
const PRESENCE_VALUES = new Set(['always', 'often', 'sometimes', 'rare', 'conditional']);
const EMPTY_POLICIES = new Set(['not_applicable', 'silent', 'extraction_pending', 'needs_review']);
const FAVORABILITY_DIRECTIONS = new Set(['buyer', 'seller', 'neutral', 'contextual']);

/**
 * @typedef {Object} FeatureDef
 * @property {string} key
 * @property {string} label
 * @property {string} description
 * @property {'number'|'string'|'enum'|'boolean'|'object'|'list'|'quote'} valueType
 * @property {?string} unit
 * @property {?string[]} enumSet
 * @property {?Object} objectShape
 * @property {?string} listItemType
 * @property {?string} listItemTagFamily
 * @property {string[]} provisionTypes
 * @property {?string[]} provisionCodes
 * @property {'always'|'often'|'sometimes'|'rare'|'conditional'} presence
 * @property {?Object} presenceCondition
 * @property {boolean} requiredEvidence
 * @property {boolean} citable
 * @property {string} displayGroup
 * @property {number} displayOrder
 * @property {boolean} benchmarkable
 * @property {?string} benchmarkFamily
 * @property {?number} benchmarkMinN
 * @property {?'buyer'|'seller'|'neutral'|'contextual'} favorabilityDirection
 * @property {?number} favorabilityWeight
 * @property {?Object} favorabilityRule
 * @property {'not_applicable'|'silent'|'extraction_pending'|'needs_review'} whenEmpty
 * @property {boolean} stableAnchor
 * @property {?string[]} aliases
 * @property {?string} formatter
 * @property {?Function} validator
 * @property {?string} extractionPrompt
 * @property {?string} exampleValue
 */

/**
 * @typedef {Object} TagDef
 * @property {string} code
 * @property {string} family
 * @property {string} label
 * @property {string} description
 * @property {string[]} appearsOn
 * @property {?string[]} aliases
 * @property {boolean} benchmarkable
 */

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nullableString(value) {
  return value === null || value === undefined || typeof value === 'string';
}

function nullableStringArray(value) {
  return value === null || value === undefined || (Array.isArray(value) && value.every((v) => typeof v === 'string'));
}

function nullableNumber(value) {
  return value === null || value === undefined || typeof value === 'number';
}

function add(errors, path, message) {
  errors.push({ path, message });
}

function validateFeatureDef(feature) {
  const errors = [];
  if (!isPlainObject(feature)) {
    add(errors, 'feature', 'FeatureDef must be an object.');
    return errors;
  }

  if (!feature.key || typeof feature.key !== 'string') add(errors, 'key', 'FeatureDef.key must be a non-empty string.');
  if (!feature.label || typeof feature.label !== 'string') add(errors, 'label', 'FeatureDef.label must be a non-empty string.');
  if (!feature.description || typeof feature.description !== 'string') add(errors, 'description', 'FeatureDef.description must be a non-empty string.');
  if (!FEATURE_VALUE_TYPES.has(feature.valueType)) add(errors, 'valueType', `FeatureDef.valueType must be one of ${[...FEATURE_VALUE_TYPES].join(', ')}.`);
  if (feature.unit !== null && feature.unit !== undefined && !FEATURE_UNITS.has(feature.unit)) add(errors, 'unit', `FeatureDef.unit must be null or one of ${[...FEATURE_UNITS].join(', ')}.`);
  if (feature.valueType === 'enum' && (!Array.isArray(feature.enumSet) || feature.enumSet.length === 0)) add(errors, 'enumSet', 'Enum features must declare a non-empty enumSet.');
  if (feature.enumSet !== null && feature.enumSet !== undefined && !nullableStringArray(feature.enumSet)) add(errors, 'enumSet', 'FeatureDef.enumSet must be null or a string array.');
  if (feature.objectShape !== null && feature.objectShape !== undefined && !isPlainObject(feature.objectShape)) add(errors, 'objectShape', 'FeatureDef.objectShape must be null or an object.');
  if (!nullableString(feature.listItemType)) add(errors, 'listItemType', 'FeatureDef.listItemType must be null or a string.');
  if (!nullableString(feature.listItemTagFamily)) add(errors, 'listItemTagFamily', 'FeatureDef.listItemTagFamily must be null or a string.');
  if (!Array.isArray(feature.provisionTypes) || feature.provisionTypes.length === 0 || !feature.provisionTypes.every((v) => typeof v === 'string')) add(errors, 'provisionTypes', 'FeatureDef.provisionTypes must be a non-empty string array.');
  if (!nullableStringArray(feature.provisionCodes)) add(errors, 'provisionCodes', 'FeatureDef.provisionCodes must be null or a string array.');
  if (!PRESENCE_VALUES.has(feature.presence)) add(errors, 'presence', `FeatureDef.presence must be one of ${[...PRESENCE_VALUES].join(', ')}.`);
  if (feature.presenceCondition !== null && feature.presenceCondition !== undefined && !isPlainObject(feature.presenceCondition)) add(errors, 'presenceCondition', 'FeatureDef.presenceCondition must be null or an object.');
  if (typeof feature.requiredEvidence !== 'boolean') add(errors, 'requiredEvidence', 'FeatureDef.requiredEvidence must be boolean.');
  if (typeof feature.citable !== 'boolean') add(errors, 'citable', 'FeatureDef.citable must be boolean.');
  if (!feature.displayGroup || typeof feature.displayGroup !== 'string') add(errors, 'displayGroup', 'FeatureDef.displayGroup must be a non-empty string.');
  if (typeof feature.displayOrder !== 'number') add(errors, 'displayOrder', 'FeatureDef.displayOrder must be number.');
  if (typeof feature.benchmarkable !== 'boolean') add(errors, 'benchmarkable', 'FeatureDef.benchmarkable must be boolean.');
  if (!nullableString(feature.benchmarkFamily)) add(errors, 'benchmarkFamily', 'FeatureDef.benchmarkFamily must be null or a string.');
  if (!nullableNumber(feature.benchmarkMinN)) add(errors, 'benchmarkMinN', 'FeatureDef.benchmarkMinN must be null or number.');
  if (feature.favorabilityDirection !== null && feature.favorabilityDirection !== undefined && !FAVORABILITY_DIRECTIONS.has(feature.favorabilityDirection)) add(errors, 'favorabilityDirection', `FeatureDef.favorabilityDirection must be null or one of ${[...FAVORABILITY_DIRECTIONS].join(', ')}.`);
  if (!nullableNumber(feature.favorabilityWeight)) add(errors, 'favorabilityWeight', 'FeatureDef.favorabilityWeight must be null or number.');
  if (feature.favorabilityRule !== null && feature.favorabilityRule !== undefined && !isPlainObject(feature.favorabilityRule)) add(errors, 'favorabilityRule', 'FeatureDef.favorabilityRule must be null or an object.');
  if (!EMPTY_POLICIES.has(feature.whenEmpty)) add(errors, 'whenEmpty', `FeatureDef.whenEmpty must be one of ${[...EMPTY_POLICIES].join(', ')}.`);
  if (typeof feature.stableAnchor !== 'boolean') add(errors, 'stableAnchor', 'FeatureDef.stableAnchor must be boolean.');
  if (!nullableStringArray(feature.aliases)) add(errors, 'aliases', 'FeatureDef.aliases must be null or a string array.');
  if (!nullableString(feature.formatter)) add(errors, 'formatter', 'FeatureDef.formatter must be null or a string.');
  if (feature.validator !== null && feature.validator !== undefined && typeof feature.validator !== 'function') add(errors, 'validator', 'FeatureDef.validator must be null or a function.');
  if (!nullableString(feature.extractionPrompt)) add(errors, 'extractionPrompt', 'FeatureDef.extractionPrompt must be null or a string.');
  if (!nullableString(feature.exampleValue)) add(errors, 'exampleValue', 'FeatureDef.exampleValue must be null or a string.');
  return errors;
}

function validateTagDef(tag) {
  const errors = [];
  if (!isPlainObject(tag)) {
    add(errors, 'tag', 'TagDef must be an object.');
    return errors;
  }
  if (!tag.code || typeof tag.code !== 'string') add(errors, 'code', 'TagDef.code must be a non-empty string.');
  if (!tag.family || typeof tag.family !== 'string') add(errors, 'family', 'TagDef.family must be a non-empty string.');
  if (!tag.label || typeof tag.label !== 'string') add(errors, 'label', 'TagDef.label must be a non-empty string.');
  if (!tag.description || typeof tag.description !== 'string') add(errors, 'description', 'TagDef.description must be a non-empty string.');
  if (!Array.isArray(tag.appearsOn) || !tag.appearsOn.every((v) => typeof v === 'string')) add(errors, 'appearsOn', 'TagDef.appearsOn must be a string array.');
  if (!nullableStringArray(tag.aliases)) add(errors, 'aliases', 'TagDef.aliases must be null or a string array.');
  if (typeof tag.benchmarkable !== 'boolean') add(errors, 'benchmarkable', 'TagDef.benchmarkable must be boolean.');
  return errors;
}

function assertValidFeatureDef(feature) {
  const errors = validateFeatureDef(feature);
  if (errors.length) throw new Error(`Invalid FeatureDef ${feature && feature.key ? feature.key : ''}: ${JSON.stringify(errors)}`);
  return feature;
}

function assertValidTagDef(tag) {
  const errors = validateTagDef(tag);
  if (errors.length) throw new Error(`Invalid TagDef ${tag && tag.code ? tag.code : ''}: ${JSON.stringify(errors)}`);
  return tag;
}

module.exports = {
  FEATURE_VALUE_TYPES,
  FEATURE_UNITS,
  PRESENCE_VALUES,
  EMPTY_POLICIES,
  FAVORABILITY_DIRECTIONS,
  validateFeatureDef,
  validateTagDef,
  assertValidFeatureDef,
  assertValidTagDef,
};
