'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DARK_BRIDGE_ENV_KEY,
  DARK_BRIDGE_ENABLED_VALUE,
  DARK_BRIDGE_GATE_REASON,
  describeDarkBridgeGate,
  isDarkBridgeIntegrationEnabled,
  isDarkBridgeIntegrationRequested,
  assertDarkBridgeIntegrationAllowed,
  DarkBridgeGateError,
} = require('../lib/canonical-v2/dark-bridge-gate');
const { isPermittedCanonicalV2Runtime } = require('../lib/canonical-v2/feature-flags');

test('an empty env is disabled by default', () => {
  assert.equal(isDarkBridgeIntegrationEnabled({}), false);
});

test('the exact enabled value with a clean local env is enabled', () => {
  assert.equal(
    isDarkBridgeIntegrationEnabled({ [DARK_BRIDGE_ENV_KEY]: DARK_BRIDGE_ENABLED_VALUE }),
    true,
  );
  assert.equal(
    isDarkBridgeIntegrationEnabled({
      [DARK_BRIDGE_ENV_KEY]: DARK_BRIDGE_ENABLED_VALUE,
      NODE_ENV: 'development',
    }),
    true,
  );
});

test('production signals block the gate even with the enabled value present', () => {
  const base = { [DARK_BRIDGE_ENV_KEY]: DARK_BRIDGE_ENABLED_VALUE };
  assert.equal(isDarkBridgeIntegrationEnabled({ ...base, NODE_ENV: 'production' }), false);
  assert.equal(isDarkBridgeIntegrationEnabled({ ...base, VERCEL_ENV: 'production' }), false);
  assert.equal(isDarkBridgeIntegrationEnabled({ ...base, VERCEL: '1' }), false);
  assert.equal(isDarkBridgeIntegrationEnabled({ ...base, CI: '1' }), false);
  assert.equal(isDarkBridgeIntegrationEnabled({ ...base, CI: 'true' }), false);
  assert.equal(isDarkBridgeIntegrationEnabled({ ...base, CI: 'TRUE' }), false);
});

test('wrong or near-miss enabled values are disabled', () => {
  const nearMisses = [
    '',
    'enabled_local_preproduction',
    ' ENABLED_LOCAL_PREPRODUCTION ',
    'true',
    true,
    1,
  ];
  for (const value of nearMisses) {
    assert.equal(
      isDarkBridgeIntegrationEnabled({ [DARK_BRIDGE_ENV_KEY]: value }),
      false,
      `expected ${JSON.stringify(value)} to leave the gate disabled`,
    );
  }
});

test('null, undefined, and non-object env values are disabled', () => {
  assert.equal(isDarkBridgeIntegrationEnabled(null), false);
  assert.equal(isDarkBridgeIntegrationEnabled(undefined), false);
  assert.equal(isDarkBridgeIntegrationEnabled('not-an-object'), false);
  assert.equal(isDarkBridgeIntegrationEnabled(42), false);
  assert.equal(isDarkBridgeIntegrationEnabled(true), false);
});

test('an enabled value present only on the prototype chain does not enable the gate', () => {
  const polluted = Object.create({ [DARK_BRIDGE_ENV_KEY]: DARK_BRIDGE_ENABLED_VALUE });
  // Confirm the fixture actually exercises the prototype-pollution path.
  assert.equal(Object.prototype.hasOwnProperty.call(polluted, DARK_BRIDGE_ENV_KEY), false);
  assert.equal(polluted[DARK_BRIDGE_ENV_KEY], DARK_BRIDGE_ENABLED_VALUE);
  assert.equal(isDarkBridgeIntegrationEnabled(polluted), false);
});

test('assertDarkBridgeIntegrationAllowed throws when disabled and passes through when enabled', () => {
  assert.throws(
    () => assertDarkBridgeIntegrationAllowed({}),
    (error) => error instanceof DarkBridgeGateError
      && error.code === 'DARK_BRIDGE_INTEGRATION_NOT_PERMITTED',
  );

  const enabledEnv = { [DARK_BRIDGE_ENV_KEY]: DARK_BRIDGE_ENABLED_VALUE };
  assert.doesNotThrow(() => assertDarkBridgeIntegrationAllowed(enabledEnv));
  assert.equal(assertDarkBridgeIntegrationAllowed(enabledEnv), undefined);
});

// Ben's ruling 2, applied after full acceptance passed: the gate widens from local-only
// to local plus Vercel preview. It shares the Canonical V2 feature flags' positive
// allowlist so the permitted-runtime rule exists once. Production stays hard-off.
test('the gate permits Vercel preview and stays hard-off in production', () => {
  const enabled = { [DARK_BRIDGE_ENV_KEY]: DARK_BRIDGE_ENABLED_VALUE };

  // Widened: a real Vercel preview deployment is now permitted.
  assert.equal(isDarkBridgeIntegrationEnabled({ ...enabled, VERCEL: '1', VERCEL_ENV: 'preview' }), true);
  // Unchanged: a genuinely local runtime is permitted.
  assert.equal(isDarkBridgeIntegrationEnabled(enabled), true);

  // Production remains denied on either signal, and an unrecognised Vercel runtime is
  // denied rather than assumed local.
  for (const productionEnv of [
    { VERCEL: '1', VERCEL_ENV: 'production' },
    { VERCEL_ENV: 'production' },
    { NODE_ENV: 'production' },
    { VERCEL: '1' },
    { VERCEL: '1', VERCEL_ENV: 'development' },
  ]) {
    assert.equal(
      isDarkBridgeIntegrationEnabled({ ...enabled, ...productionEnv }),
      false,
      `${JSON.stringify(productionEnv)} must not enable the gate`,
    );
  }

  // The CI belt survives the widening: a preview runtime under CI is still denied.
  assert.equal(isDarkBridgeIntegrationEnabled({ ...enabled, VERCEL_ENV: 'preview', CI: 'true' }), false);

  // The flag itself is still required. A permitted runtime alone enables nothing.
  assert.equal(isDarkBridgeIntegrationEnabled({ VERCEL_ENV: 'preview' }), false);
});

// =============================================================================
// Defect 2: the gate's decision and its reason must be observable. A gate that
// refuses silently is indistinguishable, from outside, from a gate nobody
// switched on -- which is how a Vercel preview gets "verified" while the
// preview is actually off and the page is rendering legacy.
// =============================================================================

const ENABLED_FLAG = Object.freeze({ [DARK_BRIDGE_ENV_KEY]: DARK_BRIDGE_ENABLED_VALUE });

test('the gate reports a decision, a reason, and the signals it decided on', () => {
  const permitted = describeDarkBridgeGate({ ...ENABLED_FLAG, VERCEL: '1', VERCEL_ENV: 'preview' });
  assert.equal(permitted.enabled, true);
  assert.equal(permitted.reason, DARK_BRIDGE_GATE_REASON.PERMITTED);
  assert.equal(permitted.signals.vercel_env, 'preview');
  assert.equal(permitted.signals.integration_flag_matches_required_value, true);
  assert.equal(permitted.schema_version, 'DARK_BRIDGE_GATE_DECISION/V1');

  // A decision record is inert: nothing downstream can quietly re-write the
  // reason it reports.
  assert.equal(Object.isFrozen(permitted), true);
  assert.equal(Object.isFrozen(permitted.signals), true);
});

test('every refusal names which clause refused', () => {
  const cases = [
    [{}, DARK_BRIDGE_GATE_REASON.INTEGRATION_FLAG_NOT_SET],
    [{ [DARK_BRIDGE_ENV_KEY]: 'nearly' }, DARK_BRIDGE_GATE_REASON.INTEGRATION_FLAG_VALUE_NOT_EXACT],
    [{ [DARK_BRIDGE_ENV_KEY]: '' }, DARK_BRIDGE_GATE_REASON.INTEGRATION_FLAG_VALUE_NOT_EXACT],
    [{ ...ENABLED_FLAG, VERCEL_ENV: 'production' }, DARK_BRIDGE_GATE_REASON.RUNTIME_NOT_PERMITTED],
    [{ ...ENABLED_FLAG, NODE_ENV: 'production' }, DARK_BRIDGE_GATE_REASON.RUNTIME_NOT_PERMITTED],
    [{ ...ENABLED_FLAG, VERCEL: '1' }, DARK_BRIDGE_GATE_REASON.RUNTIME_NOT_PERMITTED],
    [{ ...ENABLED_FLAG, CI: '1' }, DARK_BRIDGE_GATE_REASON.CI_ENVIRONMENT_DETECTED],
    [{ ...ENABLED_FLAG, VERCEL_ENV: 'preview', CI: 'true' }, DARK_BRIDGE_GATE_REASON.CI_ENVIRONMENT_DETECTED],
    [null, DARK_BRIDGE_GATE_REASON.ENV_NOT_READABLE],
    ['not-an-object', DARK_BRIDGE_GATE_REASON.ENV_NOT_READABLE],
  ];
  for (const [env, expectedReason] of cases) {
    const decision = describeDarkBridgeGate(env);
    assert.equal(decision.enabled, false, `${JSON.stringify(env)} must stay refused`);
    assert.equal(decision.reason, expectedReason, `${JSON.stringify(env)} must report ${expectedReason}`);
  }
});

test('the reported decision cannot drift from the enforced one', () => {
  // isDarkBridgeIntegrationEnabled / assertDarkBridgeIntegrationAllowed are
  // readers of the SAME evaluation the reason comes from -- so an observer
  // can never be told "on" while a caller is being told "off".
  for (const env of buildEnvMatrix()) {
    const decision = describeDarkBridgeGate(env);
    assert.equal(isDarkBridgeIntegrationEnabled(env), decision.enabled);
    if (decision.enabled) {
      assert.doesNotThrow(() => assertDarkBridgeIntegrationAllowed(env));
    } else {
      assert.throws(
        () => assertDarkBridgeIntegrationAllowed(env),
        (error) => error instanceof DarkBridgeGateError
          && error.code === 'DARK_BRIDGE_INTEGRATION_NOT_PERMITTED'
          && error.reason === decision.reason
          && error.message.includes(decision.reason),
        `${JSON.stringify(env)} must throw carrying its own reason`,
      );
    }
  }
});

// The pre-fix rule, transcribed verbatim from lib/canonical-v2/dark-bridge-
// gate.js as it stood before the observability change (same clause order,
// same own-property reads, same CI truthy set, same shared runtime
// allowlist import). The matrix below cross-checks the new implementation
// against it on every combination: the gate must be exactly as closed as it
// was, never one case more permissive.
function legacyGateRule(env) {
  if (env === null || typeof env !== 'object') return false;
  const own = (key) => (Object.prototype.hasOwnProperty.call(env, key) ? env[key] : undefined);
  if (own(DARK_BRIDGE_ENV_KEY) !== DARK_BRIDGE_ENABLED_VALUE) return false;
  if (!isPermittedCanonicalV2Runtime(env)) return false;
  const ci = own('CI');
  if (typeof ci === 'string' && new Set(['1', 'true']).has(ci.toLowerCase())) return false;
  return true;
}

function buildEnvMatrix() {
  const flagValues = [undefined, DARK_BRIDGE_ENABLED_VALUE, 'enabled_local_preproduction', '', 'true', 1, true];
  const vercelValues = [undefined, '1'];
  const vercelEnvValues = [undefined, 'preview', 'production', 'development'];
  const nodeEnvValues = [undefined, 'development', 'test', 'production'];
  const ciValues = [undefined, '1', 'true', 'TRUE', '0', 'false', 'yes', 1, true];
  const envs = [];
  for (const flag of flagValues) {
    for (const vercel of vercelValues) {
      for (const vercelEnv of vercelEnvValues) {
        for (const nodeEnv of nodeEnvValues) {
          for (const ci of ciValues) {
            const env = {};
            if (flag !== undefined) env[DARK_BRIDGE_ENV_KEY] = flag;
            if (vercel !== undefined) env.VERCEL = vercel;
            if (vercelEnv !== undefined) env.VERCEL_ENV = vercelEnv;
            if (nodeEnv !== undefined) env.NODE_ENV = nodeEnv;
            if (ci !== undefined) env.CI = ci;
            envs.push(env);
          }
        }
      }
    }
  }
  return envs;
}

test('no weaker than before: across the full env matrix the gate permits exactly what the pre-fix rule permitted', () => {
  const matrix = buildEnvMatrix();
  assert.ok(matrix.length > 500, 'sanity: the matrix must actually be a matrix');
  let permittedCount = 0;
  for (const env of matrix) {
    const before = legacyGateRule(env);
    const after = describeDarkBridgeGate(env).enabled;
    assert.equal(after, before, `gate decision changed for ${JSON.stringify(env)}: was ${before}, now ${after}`);
    if (after) permittedCount += 1;
  }
  // Sanity in both directions: the matrix contains genuinely-permitted cases
  // (so "always false" would not pass this test) and mostly-refused ones.
  assert.ok(permittedCount > 0, 'the matrix must contain at least one genuinely permitted environment');
  assert.ok(permittedCount < matrix.length / 10, 'the gate must still refuse the overwhelming majority of environments');
});

test('closed by default, and unopenable by an absent or malformed environment', () => {
  // No argument at all resolves to the real process.env, which in this test
  // run carries no integration flag -- and, under CI, carries CI=true too.
  assert.equal(describeDarkBridgeGate().enabled, false);
  assert.equal(isDarkBridgeIntegrationEnabled(), false);

  // An explicitly-passed undefined must NOT fall back to process.env.
  assert.equal(describeDarkBridgeGate(undefined).enabled, false);
  assert.equal(describeDarkBridgeGate(undefined).reason, DARK_BRIDGE_GATE_REASON.ENV_NOT_READABLE);
  assert.equal(isDarkBridgeIntegrationEnabled(undefined), false);

  for (const malformed of [null, undefined, 'not-an-object', 42, true, NaN, Symbol('env')]) {
    const decision = describeDarkBridgeGate(malformed);
    assert.equal(decision.enabled, false, `${String(malformed)} must not open the gate`);
    assert.equal(decision.reason, DARK_BRIDGE_GATE_REASON.ENV_NOT_READABLE);
  }

  // Arrays and functions are objects, but carry no own flag property.
  for (const oddObject of [[], () => {}, new Map(), Object.create(null)]) {
    assert.equal(describeDarkBridgeGate(oddObject).enabled, false);
  }

  // A malformed value in the right key is a refusal, not a fallback.
  for (const malformedValue of [true, 1, {}, [], ['ENABLED_LOCAL_PREPRODUCTION'], null]) {
    const decision = describeDarkBridgeGate({ [DARK_BRIDGE_ENV_KEY]: malformedValue });
    assert.equal(decision.enabled, false, `${JSON.stringify(malformedValue)} must not open the gate`);
    assert.notEqual(decision.reason, DARK_BRIDGE_GATE_REASON.PERMITTED);
  }

  // Prototype-only flag: reported as not set, never as present.
  const polluted = Object.create({ [DARK_BRIDGE_ENV_KEY]: DARK_BRIDGE_ENABLED_VALUE });
  const pollutedDecision = describeDarkBridgeGate(polluted);
  assert.equal(pollutedDecision.enabled, false);
  assert.equal(pollutedDecision.reason, DARK_BRIDGE_GATE_REASON.INTEGRATION_FLAG_NOT_SET);
  assert.equal(pollutedDecision.signals.integration_flag_present, false);
});

// =============================================================================
// The CI clause specifically. Vercel documents CI=1 as available at BUILD
// time, unlike VERCEL/VERCEL_ENV which are documented at both build and
// runtime -- so this clause is not expected to fire on a preview function.
// If it ever does (a project-level CI variable configured into the runtime, a
// platform change), the preview is off, and that must be reported, not
// inferred from an empty-looking page.
// =============================================================================

test('CI set in the function runtime keeps a Vercel preview refused, and says why', () => {
  const previewRuntime = { ...ENABLED_FLAG, VERCEL: '1', VERCEL_ENV: 'preview' };

  // Baseline: the same runtime without CI is permitted. Every assertion
  // below therefore isolates the CI clause and nothing else.
  const baseline = describeDarkBridgeGate(previewRuntime);
  assert.equal(baseline.enabled, true);
  assert.equal(baseline.signals.ci_present, false);
  assert.equal(baseline.signals.ci_recognised_truthy, false);

  for (const ciValue of ['1', 'true', 'TRUE', 'True']) {
    const decision = describeDarkBridgeGate({ ...previewRuntime, CI: ciValue });
    assert.equal(decision.enabled, false, `CI=${ciValue} in the function runtime must refuse`);
    assert.equal(decision.reason, DARK_BRIDGE_GATE_REASON.CI_ENVIRONMENT_DETECTED);
    assert.equal(decision.signals.ci_recognised_truthy, true);
    // The runtime clause itself passed -- the reason is precise about which
    // clause refused, so nobody debugs the wrong one.
    assert.equal(isPermittedCanonicalV2Runtime({ ...previewRuntime, CI: ciValue }), true);
  }

  // A CI value this gate does not treat as truthy leaves the gate open (that
  // is the pre-existing rule, deliberately unchanged), but the signal is
  // still reported -- so "CI is set and the gate is open" is inspectable
  // rather than invisible.
  const unrecognised = describeDarkBridgeGate({ ...previewRuntime, CI: 'yes' });
  assert.equal(unrecognised.enabled, true);
  assert.equal(unrecognised.signals.ci_present, true);
  assert.equal(unrecognised.signals.ci_recognised_truthy, false);
});

test('the decision record reports the flag without echoing its value', () => {
  // A decision travels into logs and API payloads. Whatever someone actually
  // put in the variable never travels with it.
  const decision = describeDarkBridgeGate({ [DARK_BRIDGE_ENV_KEY]: 'not-the-value-but-sensitive-looking' });
  assert.equal(decision.signals.integration_flag_present, true);
  assert.equal(decision.signals.integration_flag_matches_required_value, false);
  assert.equal(JSON.stringify(decision).includes('sensitive-looking'), false);
});

test('isDarkBridgeIntegrationRequested reports stated intent, and grants nothing', () => {
  // Intent = "someone named the flag", which is a different question from
  // "is it on". This is what makes a refusal-against-intent reportable.
  assert.equal(isDarkBridgeIntegrationRequested({}), false);
  assert.equal(isDarkBridgeIntegrationRequested({ [DARK_BRIDGE_ENV_KEY]: '' }), false);
  assert.equal(isDarkBridgeIntegrationRequested({ [DARK_BRIDGE_ENV_KEY]: '   ' }), false);
  assert.equal(isDarkBridgeIntegrationRequested({ [DARK_BRIDGE_ENV_KEY]: 'anything' }), true);
  assert.equal(isDarkBridgeIntegrationRequested(ENABLED_FLAG), true);
  assert.equal(isDarkBridgeIntegrationRequested(undefined), false);
  assert.equal(isDarkBridgeIntegrationRequested(null), false);
  assert.equal(isDarkBridgeIntegrationRequested(Object.create({ [DARK_BRIDGE_ENV_KEY]: 'inherited' })), false);

  // Intent never enables anything: a requested-but-refused environment is
  // still refused.
  assert.equal(isDarkBridgeIntegrationEnabled({ [DARK_BRIDGE_ENV_KEY]: 'anything' }), false);
});
