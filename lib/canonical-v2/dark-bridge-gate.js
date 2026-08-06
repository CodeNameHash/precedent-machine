'use strict';

// Dark-bridge gate: this module never grants serving authority. Anything
// integrated behind it stays INTEGRATED_NOT_SERVED — inspectable only in
// local or pre-production, never rendered on a served, authoritative
// surface. Production authority is NONE. Every missing, empty, mistyped,
// or otherwise ambiguous signal below must resolve to disabled.
//
// Refusing is not enough on its own: a gate that refuses silently reads,
// from the outside, exactly like a gate nobody switched on -- which is how a
// preview deployment gets verified while it is actually off. So the single
// rule below is evaluated once, into an observable decision record
// (describeDarkBridgeGate) carrying `enabled`, the `reason` it refused, and
// the signals it decided on. The boolean and the assert are thin readers of
// that same record. Making the state observable is the point; nothing here
// is permissive that was not permissive before.

const DARK_BRIDGE_ENV_KEY = 'CANONICAL_V2_DARK_BRIDGE';
const DARK_BRIDGE_ENABLED_VALUE = 'ENABLED_LOCAL_PREPRODUCTION';
const DARK_BRIDGE_GATE_ERROR_CODE = 'DARK_BRIDGE_INTEGRATION_NOT_PERMITTED';

const { isPermittedCanonicalV2Runtime } = require('./feature-flags');

const CI_TRUTHY_VALUES = new Set(['1', 'true']);

// Every reason this gate can refuse, plus the single reason it can permit.
// Exported so callers, tests and operators name one constant instead of
// re-typing a string literal that could drift from the decision that
// produced it.
const DARK_BRIDGE_GATE_REASON = Object.freeze({
  // Permitted.
  PERMITTED: 'PERMITTED',
  // Refused.
  ENV_NOT_READABLE: 'ENV_NOT_READABLE',
  INTEGRATION_FLAG_NOT_SET: 'INTEGRATION_FLAG_NOT_SET',
  INTEGRATION_FLAG_VALUE_NOT_EXACT: 'INTEGRATION_FLAG_VALUE_NOT_EXACT',
  RUNTIME_NOT_PERMITTED: 'RUNTIME_NOT_PERMITTED',
  CI_ENVIRONMENT_DETECTED: 'CI_ENVIRONMENT_DETECTED',
});

class DarkBridgeGateError extends Error {
  constructor(code, message, decision) {
    super(message);
    this.name = 'DarkBridgeGateError';
    this.code = code;
    // The refusal's own reason travels with the error, so a caller that only
    // ever sees the throw (the four dark-bridge modules -- legacy-card-
    // bridge.js plus the three *-dark-bridge.js-named families -- assert
    // through assertDarkBridgeIntegrationAllowed) can still report WHY the
    // gate said no, not merely that it did.
    this.reason = decision ? decision.reason : undefined;
    this.gate_decision = decision;
  }
}

function ownEnvValue(env, key) {
  return Object.prototype.hasOwnProperty.call(env, key) ? env[key] : undefined;
}

function isEnvObject(candidate) {
  return candidate !== null && typeof candidate === 'object';
}

function stringOrNull(value) {
  return typeof value === 'string' ? value : null;
}

function isCiTruthy(value) {
  return typeof value === 'string' && CI_TRUTHY_VALUES.has(value.toLowerCase());
}

// Everything the decision below was actually taken on, reported on EVERY
// decision (permitted or refused) so an operator reading a permitted
// decision can still see the signals that nearly refused it -- e.g. a CI
// value this gate does not recognise as truthy.
function describeEnvSignals(env) {
  const flagValue = ownEnvValue(env, DARK_BRIDGE_ENV_KEY);
  const ci = ownEnvValue(env, 'CI');
  return Object.freeze({
    // Deliberately reports only presence/exactness, never the raw value: a
    // decision record travels into logs and API payloads, and echoing back
    // whatever someone actually put in the variable is how a mistyped secret
    // ends up in a log line.
    integration_flag_present: flagValue !== undefined,
    integration_flag_matches_required_value: flagValue === DARK_BRIDGE_ENABLED_VALUE,
    // Non-secret Vercel/Node system signals -- the whole runtime clause is
    // decided on these three, so a refusal is undiagnosable without them.
    vercel: stringOrNull(ownEnvValue(env, 'VERCEL')),
    vercel_env: stringOrNull(ownEnvValue(env, 'VERCEL_ENV')),
    node_env: stringOrNull(ownEnvValue(env, 'NODE_ENV')),
    ci_present: ci !== undefined,
    ci_recognised_truthy: isCiTruthy(ci),
  });
}

const UNREADABLE_ENV_SIGNALS = Object.freeze({
  integration_flag_present: false,
  integration_flag_matches_required_value: false,
  vercel: null,
  vercel_env: null,
  node_env: null,
  ci_present: false,
  ci_recognised_truthy: false,
});

function decision(enabled, reason, signals) {
  return Object.freeze({
    schema_version: 'DARK_BRIDGE_GATE_DECISION/V1',
    enabled,
    reason,
    signals,
  });
}

// The single evaluation of the gate rule. isDarkBridgeIntegrationEnabled()
// and assertDarkBridgeIntegrationAllowed() are both thin readers of THIS
// function's result, so the reason a caller reports and the decision the
// caller acts on are the same object -- the observable state cannot drift
// from the enforced one, which is the whole point: this gate must never be
// off while a human believes it is on.
//
// Clause order is load-bearing and unchanged: env readable -> flag exact ->
// runtime permitted -> CI absent. Each clause refuses on its own, so the
// FIRST failing clause is the reported reason.
function describeDarkBridgeGate(env) {
  // A default parameter can't tell an omitted argument from an explicit
  // `undefined`; both would silently resolve to process.env. Checking
  // arguments.length keeps an explicit `undefined` failing closed instead.
  const resolvedEnv = arguments.length === 0 ? process.env : env;
  if (!isEnvObject(resolvedEnv)) {
    return decision(false, DARK_BRIDGE_GATE_REASON.ENV_NOT_READABLE, UNREADABLE_ENV_SIGNALS);
  }

  const signals = describeEnvSignals(resolvedEnv);

  if (!signals.integration_flag_matches_required_value) {
    return decision(
      false,
      signals.integration_flag_present
        ? DARK_BRIDGE_GATE_REASON.INTEGRATION_FLAG_VALUE_NOT_EXACT
        : DARK_BRIDGE_GATE_REASON.INTEGRATION_FLAG_NOT_SET,
      signals,
    );
  }

  // Ben's ruling 2, applied after full acceptance passed: the gate is widened from
  // local-only to local plus Vercel preview. It uses the SAME positive allowlist as the
  // Canonical V2 feature flags rather than a second copy, so the permitted-runtime rule
  // is stated once and cannot drift. Production stays hard-off: the allowlist admits
  // only VERCEL_ENV === 'preview', or a genuinely local runtime with no Vercel signals
  // and NODE_ENV !== 'production'.
  if (!isPermittedCanonicalV2Runtime(resolvedEnv)) {
    return decision(false, DARK_BRIDGE_GATE_REASON.RUNTIME_NOT_PERMITTED, signals);
  }

  // The CI belt. Vercel documents CI=1 as a BUILD-time system environment
  // variable ("Available at build time", vercel.com/docs/environment-
  // variables/system-environment-variables) -- unlike VERCEL / VERCEL_ENV /
  // VERCEL_TARGET_ENV, which that same table marks "available at both build
  // and runtime" -- so on a Vercel preview FUNCTION this clause is expected
  // not to fire. It still fires for a CI harness (GitHub Actions sets
  // CI=true) that happens to carry the integration flag, and it would still
  // fire if a project-level CI variable were configured into the function
  // runtime. That last case is exactly the silent-off risk: it is kept
  // REFUSING (never weakened to permit), but it is now reported as
  // CI_ENVIRONMENT_DETECTED rather than being indistinguishable from a
  // preview that was simply never switched on.
  if (signals.ci_recognised_truthy) {
    return decision(false, DARK_BRIDGE_GATE_REASON.CI_ENVIRONMENT_DETECTED, signals);
  }

  return decision(true, DARK_BRIDGE_GATE_REASON.PERMITTED, signals);
}

function isDarkBridgeIntegrationEnabled(env) {
  const gateDecision = arguments.length === 0
    ? describeDarkBridgeGate()
    : describeDarkBridgeGate(env);
  return gateDecision.enabled === true;
}

// "Did anyone ASK for the dark bridge?", which is a different question from
// "is it on?". An env that names the integration flag at all has stated an
// intent; a refusal against a stated intent is the case a human can be wrong
// about, and therefore the case that has to be reported rather than silently
// returning the legacy result. Never itself an authorization: an intent
// signal grants nothing, the decision above is the only thing that does.
function isDarkBridgeIntegrationRequested(env) {
  const resolvedEnv = arguments.length === 0 ? process.env : env;
  if (!isEnvObject(resolvedEnv)) return false;
  const flagValue = ownEnvValue(resolvedEnv, DARK_BRIDGE_ENV_KEY);
  if (flagValue === undefined || flagValue === null) return false;
  return String(flagValue).trim() !== '';
}

function assertDarkBridgeIntegrationAllowed(env) {
  const gateDecision = arguments.length === 0
    ? describeDarkBridgeGate()
    : describeDarkBridgeGate(env);
  if (gateDecision.enabled === true) return undefined;
  throw new DarkBridgeGateError(
    DARK_BRIDGE_GATE_ERROR_CODE,
    `Dark-bridge integration is not permitted outside local or pre-production environments. (gate reason: ${gateDecision.reason})`,
    gateDecision,
  );
}

module.exports = {
  DARK_BRIDGE_ENV_KEY,
  DARK_BRIDGE_ENABLED_VALUE,
  DARK_BRIDGE_GATE_ERROR_CODE,
  DARK_BRIDGE_GATE_REASON,
  describeDarkBridgeGate,
  isDarkBridgeIntegrationEnabled,
  isDarkBridgeIntegrationRequested,
  assertDarkBridgeIntegrationAllowed,
  DarkBridgeGateError,
};
