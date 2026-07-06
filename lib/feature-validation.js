const { canonicalFavorability } = require('./search');
const {
  INFRA_KEYS,
  unwrap,
  validateFeatures: validateSchemaFeatures,
} = require('./schema/validation');

const CANONICAL_FAVORABILITY = new Set(['buyer-favorable', 'seller-favorable', 'neutral']);

function legacyIssue(issue) {
  return {
    key: issue.key == null ? null : issue.key,
    kind: issue.kind || (issue.severity === 'warn' ? 'warning' : 'shape'),
    detail: issue.detail || issue.message || '',
  };
}

function validateFeatures(provisionType, features) {
  const canonicalCode = features && typeof features === 'object' && !Array.isArray(features)
    ? features.canonicalCode || null
    : null;
  const result = validateSchemaFeatures(provisionType, canonicalCode, features);
  return {
    errors: result.errors.map(legacyIssue),
    warnings: result.warnings.map(legacyIssue),
  };
}

function validateProvisionRow(row) {
  const features = (row.ai_metadata && row.ai_metadata.features) || {};
  const result = validateFeatures(row.type, features);
  if (row.ai_favorability && !CANONICAL_FAVORABILITY.has(canonicalFavorability(row.ai_favorability))) {
    result.warnings.push({ key: 'ai_favorability', kind: 'non-canonical', detail: String(row.ai_favorability) });
  }
  return result;
}

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
