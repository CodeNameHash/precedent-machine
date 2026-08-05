'use strict';

// Dark-bridge gate: this module never grants serving authority. Anything
// integrated behind it stays INTEGRATED_NOT_SERVED — inspectable only in
// local or pre-production, never rendered on a served, authoritative
// surface. Production authority is NONE. Every missing, empty, mistyped,
// or otherwise ambiguous signal below must resolve to disabled.

const DARK_BRIDGE_ENV_KEY = 'CANONICAL_V2_DARK_BRIDGE';
const DARK_BRIDGE_ENABLED_VALUE = 'ENABLED_LOCAL_PREPRODUCTION';
const DARK_BRIDGE_GATE_ERROR_CODE = 'DARK_BRIDGE_INTEGRATION_NOT_PERMITTED';

const { isPermittedCanonicalV2Runtime } = require('./feature-flags');

const CI_TRUTHY_VALUES = new Set(['1', 'true']);

class DarkBridgeGateError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'DarkBridgeGateError';
    this.code = code;
  }
}

function ownEnvValue(env, key) {
  return Object.prototype.hasOwnProperty.call(env, key) ? env[key] : undefined;
}

function isEnvObject(candidate) {
  return candidate !== null && typeof candidate === 'object';
}

function isDarkBridgeIntegrationEnabled(env) {
  // A default parameter can't tell an omitted argument from an explicit
  // `undefined`; both would silently resolve to process.env. Checking
  // arguments.length keeps an explicit `undefined` failing closed instead.
  const resolvedEnv = arguments.length === 0 ? process.env : env;
  if (!isEnvObject(resolvedEnv)) return false;

  if (ownEnvValue(resolvedEnv, DARK_BRIDGE_ENV_KEY) !== DARK_BRIDGE_ENABLED_VALUE) return false;
  // Ben's ruling 2, applied after full acceptance passed: the gate is widened from
  // local-only to local plus Vercel preview. It uses the SAME positive allowlist as the
  // Canonical V2 feature flags rather than a second copy, so the permitted-runtime rule
  // is stated once and cannot drift. Production stays hard-off: the allowlist admits
  // only VERCEL_ENV === 'preview', or a genuinely local runtime with no Vercel signals
  // and NODE_ENV !== 'production'.
  if (!isPermittedCanonicalV2Runtime(resolvedEnv)) return false;

  const ci = ownEnvValue(resolvedEnv, 'CI');
  if (typeof ci === 'string' && CI_TRUTHY_VALUES.has(ci.toLowerCase())) return false;

  return true;
}

function assertDarkBridgeIntegrationAllowed(env) {
  const permitted = arguments.length === 0
    ? isDarkBridgeIntegrationEnabled()
    : isDarkBridgeIntegrationEnabled(env);
  if (permitted) return undefined;
  throw new DarkBridgeGateError(
    DARK_BRIDGE_GATE_ERROR_CODE,
    'Dark-bridge integration is not permitted outside local or pre-production environments.',
  );
}

module.exports = {
  DARK_BRIDGE_ENV_KEY,
  DARK_BRIDGE_ENABLED_VALUE,
  isDarkBridgeIntegrationEnabled,
  assertDarkBridgeIntegrationAllowed,
  DarkBridgeGateError,
};
