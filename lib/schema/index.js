const { FEATURES } = require('./features');
const { TAGS } = require('./tags');
const { formatValue, formatters, humanizeEnum } = require('./formatters');
const { renderEmpty } = require('./empty-policy');

function allFeatures() {
  return Object.values(FEATURES);
}

function allTags() {
  return Object.values(TAGS);
}

function getFeature(key) {
  return FEATURES[key] || null;
}

function getFeaturesForType(type) {
  if (!type) return [];
  return allFeatures()
    .filter((feature) => Array.isArray(feature.provisionTypes) && feature.provisionTypes.includes(type))
    .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0) || a.key.localeCompare(b.key));
}

function getFeaturesForCode(type, code) {
  if (!code) return getFeaturesForType(type);
  return getFeaturesForType(type)
    .filter((feature) => !Array.isArray(feature.provisionCodes) || feature.provisionCodes.length === 0 || feature.provisionCodes.includes(code));
}

function getTag(code, family) {
  if (!code) return null;
  const direct = TAGS[`${family || ''}:${code}`] || TAGS[code];
  if (direct && (!family || direct.family === family)) return direct;
  return allTags().find((tag) => tag.code === code && (!family || tag.family === family)) || null;
}

function getTagsForFamily(family) {
  if (!family) return [];
  return allTags()
    .filter((tag) => tag.family === family)
    .sort((a, b) => a.label.localeCompare(b.label) || a.code.localeCompare(b.code));
}

function isEmptyValue(value) {
  return value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
}

function renderFeatureValue(featureKey, value, ctx = {}) {
  const feature = getFeature(featureKey);
  if (feature && isEmptyValue(value)) return renderEmpty(feature);
  if (!feature) {
    if (isEmptyValue(value)) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }
  return formatValue(feature.formatter, value, { ...ctx, feature });
}

function renderTag(code, family) {
  const tag = getTag(code, family);
  if (tag) return tag.label;
  return humanizeEnum(code);
}

module.exports = {
  FEATURES,
  TAGS,
  getFeature,
  getFeaturesForType,
  getFeaturesForCode,
  getTag,
  getTagsForFamily,
  renderFeatureValue,
  renderTag,
  renderEmpty,
  formatters,
};
