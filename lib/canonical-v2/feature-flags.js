const TRUE_VALUES = new Set(['1', 'true', 'on', 'yes']);

function isEnabled(value) {
  return TRUE_VALUES.has(String(value || '').trim().toLowerCase());
}

function isCanonicalV2ReviewEnabled(env = process.env) {
  return isEnabled(env.CANONICAL_V2_REVIEW_ENABLED);
}

function isCanonicalV2ReviewClientEnabled(env = process.env) {
  return isEnabled(env.NEXT_PUBLIC_CANONICAL_V2_REVIEW_ENABLED);
}

module.exports = {
  isCanonicalV2ReviewClientEnabled,
  isCanonicalV2ReviewEnabled,
};
