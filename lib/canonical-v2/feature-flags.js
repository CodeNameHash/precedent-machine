const TRUE_VALUES = new Set(['1', 'true', 'on', 'yes']);

function isEnabled(value) {
  return TRUE_VALUES.has(String(value || '').trim().toLowerCase());
}

// Reads only an OWN property of `env`, never one inherited through the
// prototype chain, so a polluted Object.prototype can never manufacture a
// flag value or a runtime signal that was never actually set on this
// specific environment object. A missing/non-object env reads as undefined,
// same as a genuinely absent property.
function ownEnvValue(env, key) {
  if (!env || typeof env !== 'object') return undefined;
  return Object.prototype.hasOwnProperty.call(env, key) ? env[key] : undefined;
}

// The one shared positive allowlist for every Canonical V2 flag below other
// than the pilot flag, which keeps its own, deliberately stricter expression
// (see the comment on isCanonicalV2ProcessPilotUiEnabled). Permitted on a
// Vercel preview deployment, or when nothing at all identifies a Vercel
// runtime and NODE_ENV does not itself claim production (local development).
// Denied in every other case -- a Vercel runtime whose VERCEL_ENV is
// 'production' or any other non-preview value, NODE_ENV === 'production',
// and any unrecognised or missing value -- so production stays hard-off.
function isPermittedCanonicalV2Runtime(env) {
  if (!env || typeof env !== 'object') return false;
  if (ownEnvValue(env, 'VERCEL_ENV') === 'preview') return true;
  const noVercelRuntimeDetected = ownEnvValue(env, 'VERCEL') === undefined
    && ownEnvValue(env, 'VERCEL_ENV') === undefined;
  return noVercelRuntimeDetected && ownEnvValue(env, 'NODE_ENV') !== 'production';
}

function isCanonicalV2ReviewEnabled(env = process.env) {
  return isEnabled(ownEnvValue(env, 'CANONICAL_V2_REVIEW_ENABLED'))
    && isPermittedCanonicalV2Runtime(env);
}

function isCanonicalV2ReviewClientEnabled(env = process.env) {
  return isEnabled(ownEnvValue(env, 'NEXT_PUBLIC_CANONICAL_V2_REVIEW_ENABLED'))
    && isPermittedCanonicalV2Runtime(env);
}

function isCanonicalV2QueryEnabled(env = process.env) {
  return isEnabled(ownEnvValue(env, 'CANONICAL_V2_QUERY_ENABLED'))
    && isPermittedCanonicalV2Runtime(env);
}

function isCanonicalV2QueryUiEnabled(env = process.env) {
  return isEnabled(ownEnvValue(env, 'NEXT_PUBLIC_CANONICAL_V2_QUERY_UI_ENABLED'))
    && isPermittedCanonicalV2Runtime(env);
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
  isPermittedCanonicalV2Runtime,
  isCanonicalV2ReviewClientEnabled,
  isCanonicalV2ReviewEnabled,
  isCanonicalV2QueryEnabled,
  isCanonicalV2QueryUiEnabled,
  isCanonicalV2ProcessPilotUiEnabled,
};
