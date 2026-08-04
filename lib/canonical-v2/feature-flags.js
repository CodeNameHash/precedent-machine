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

function isCanonicalV2QueryEnabled(env = process.env) {
  return isEnabled(env.CANONICAL_V2_QUERY_ENABLED);
}

function isCanonicalV2QueryUiEnabled(env = process.env) {
  return isEnabled(env.NEXT_PUBLIC_CANONICAL_V2_QUERY_UI_ENABLED);
}

// This flag is intentionally server-only. The fixture is a preview artefact,
// and a truthy value alone must never make it available in production.
function isCanonicalV2ProcessPilotUiEnabled(env = process.env) {
  return isEnabled(env.CANONICAL_V2_PROCESS_PILOT_UI_ENABLED)
    && env.VERCEL_ENV === 'preview';
}

const CANONICAL_V2_FEATURE_FLAG_DEFINITIONS = Object.freeze([
  Object.freeze({
    environment_key: 'CANONICAL_V2_REVIEW_ENABLED',
    surface: 'REVIEW_API',
    is_enabled: isCanonicalV2ReviewEnabled,
  }),
  Object.freeze({
    environment_key: 'NEXT_PUBLIC_CANONICAL_V2_REVIEW_ENABLED',
    surface: 'REVIEW_UI',
    is_enabled: isCanonicalV2ReviewClientEnabled,
  }),
  Object.freeze({
    environment_key: 'CANONICAL_V2_QUERY_ENABLED',
    surface: 'QUERY_API',
    is_enabled: isCanonicalV2QueryEnabled,
  }),
  Object.freeze({
    environment_key: 'NEXT_PUBLIC_CANONICAL_V2_QUERY_UI_ENABLED',
    surface: 'QUERY_UI',
    is_enabled: isCanonicalV2QueryUiEnabled,
  }),
  Object.freeze({
    environment_key: 'CANONICAL_V2_PROCESS_PILOT_UI_ENABLED',
    surface: 'PROCESS_PILOT_UI',
    is_enabled: isCanonicalV2ProcessPilotUiEnabled,
  }),
]);

module.exports = {
  CANONICAL_V2_FEATURE_FLAG_DEFINITIONS,
  isEnabled,
  isCanonicalV2ReviewClientEnabled,
  isCanonicalV2ReviewEnabled,
  isCanonicalV2QueryEnabled,
  isCanonicalV2QueryUiEnabled,
  isCanonicalV2ProcessPilotUiEnabled,
};
