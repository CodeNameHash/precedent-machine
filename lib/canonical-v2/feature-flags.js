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

module.exports = {
  isCanonicalV2ReviewClientEnabled,
  isCanonicalV2ReviewEnabled,
  isCanonicalV2QueryEnabled,
  isCanonicalV2QueryUiEnabled,
  isCanonicalV2ProcessPilotUiEnabled,
};
