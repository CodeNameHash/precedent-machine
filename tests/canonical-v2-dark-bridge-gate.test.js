'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DARK_BRIDGE_ENV_KEY,
  DARK_BRIDGE_ENABLED_VALUE,
  isDarkBridgeIntegrationEnabled,
  assertDarkBridgeIntegrationAllowed,
  DarkBridgeGateError,
} = require('../lib/canonical-v2/dark-bridge-gate');

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
