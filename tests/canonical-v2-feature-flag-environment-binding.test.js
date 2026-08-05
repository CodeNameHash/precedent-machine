'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  CANONICAL_V2_FEATURE_FLAG_DEFINITIONS,
  isCanonicalV2ProcessPilotUiEnabled,
  isPermittedCanonicalV2Runtime,
} = require('../lib/canonical-v2/feature-flags');

// CANONICAL_V2_PROCESS_PILOT_UI_ENABLED keeps its own, deliberately stricter,
// preview-only expression (see the comment on isCanonicalV2ProcessPilotUiEnabled
// in lib/canonical-v2/feature-flags.js) rather than the shared allowlist the
// other four flags use: it never permits local development, only an explicit
// Vercel preview deployment. Every scenario below holds identically for all
// five flags except where this key is called out separately.
const STRICT_PREVIEW_ONLY_KEY = 'CANONICAL_V2_PROCESS_PILOT_UI_ENABLED';

function truthyEnv(key, overrides = {}) {
  return { [key]: 'true', ...overrides };
}

test('every flag denies a truthy value on a Vercel production deployment', () => {
  for (const { environment_key: key, is_enabled: isFlagEnabled } of CANONICAL_V2_FEATURE_FLAG_DEFINITIONS) {
    assert.equal(isFlagEnabled(truthyEnv(key, { VERCEL_ENV: 'production' })), false, key);
  }
});

test('every flag denies a truthy value when NODE_ENV claims production', () => {
  for (const { environment_key: key, is_enabled: isFlagEnabled } of CANONICAL_V2_FEATURE_FLAG_DEFINITIONS) {
    assert.equal(isFlagEnabled(truthyEnv(key, { NODE_ENV: 'production' })), false, key);
  }
});

test('every flag denies a truthy value on an unrecognised Vercel runtime with no VERCEL_ENV', () => {
  for (const { environment_key: key, is_enabled: isFlagEnabled } of CANONICAL_V2_FEATURE_FLAG_DEFINITIONS) {
    // VERCEL is set (so this really is some Vercel runtime) but VERCEL_ENV is
    // absent -- an unrecognised Vercel runtime is not proof of preview.
    assert.equal(isFlagEnabled(truthyEnv(key, { VERCEL: '1' })), false, key);
  }
});

test('every flag permits a truthy value on an explicit Vercel preview deployment', () => {
  for (const { environment_key: key, is_enabled: isFlagEnabled } of CANONICAL_V2_FEATURE_FLAG_DEFINITIONS) {
    assert.equal(isFlagEnabled(truthyEnv(key, { VERCEL_ENV: 'preview' })), true, key);
  }
});

test('the four non-pilot flags permit a truthy value in clean local development', () => {
  for (const { environment_key: key, is_enabled: isFlagEnabled } of CANONICAL_V2_FEATURE_FLAG_DEFINITIONS) {
    if (key === STRICT_PREVIEW_ONLY_KEY) continue;
    assert.equal(isFlagEnabled(truthyEnv(key)), true, key);
  }
});

test('the pilot flag stays preview-only and denies a truthy value in clean local development', () => {
  assert.equal(isCanonicalV2ProcessPilotUiEnabled(truthyEnv(STRICT_PREVIEW_ONLY_KEY)), false);
});

test('every flag denies a falsy or absent value in every environment', () => {
  for (const { environment_key: key, is_enabled: isFlagEnabled } of CANONICAL_V2_FEATURE_FLAG_DEFINITIONS) {
    assert.equal(isFlagEnabled({}), false, `${key} absent key, no runtime signal`);
    assert.equal(isFlagEnabled({ VERCEL_ENV: 'preview' }), false, `${key} absent key, permitted runtime`);
    assert.equal(isFlagEnabled({ [key]: 'false', VERCEL_ENV: 'preview' }), false, `${key} explicit false`);
    assert.equal(isFlagEnabled({ [key]: '0', VERCEL_ENV: 'preview' }), false, `${key} zero`);
  }
});

test('every flag denies a value that exists only on a polluted prototype', () => {
  for (const { environment_key: key, is_enabled: isFlagEnabled } of CANONICAL_V2_FEATURE_FLAG_DEFINITIONS) {
    const polluted = Object.create({ [key]: 'true' });
    assert.equal(isFlagEnabled(polluted), false, key);

    // Adding an OWN VERCEL_ENV = 'preview' still must not enable a flag whose
    // truthy value is only inherited: the flag's own read has to be an own-
    // property check independent of the runtime check. This does not hold for
    // the pilot flag, which reads env.<key> directly (unchanged, per the
    // brief) -- see the report for that residual, out-of-scope gap.
    polluted.VERCEL_ENV = 'preview';
    if (key === STRICT_PREVIEW_ONLY_KEY) continue;
    assert.equal(isFlagEnabled(polluted), false, `${key} with an own preview runtime`);
  }
});

test('every flag denies a non-object env', () => {
  for (const { environment_key: key, is_enabled: isFlagEnabled } of CANONICAL_V2_FEATURE_FLAG_DEFINITIONS) {
    assert.equal(isFlagEnabled('not-an-object'), false, `${key} string`);
    assert.equal(isFlagEnabled(42), false, `${key} number`);
  }
});

test('every flag denies a null env, except the pilot flag which throws on its unguarded direct read', () => {
  for (const { environment_key: key, is_enabled: isFlagEnabled } of CANONICAL_V2_FEATURE_FLAG_DEFINITIONS) {
    if (key === STRICT_PREVIEW_ONLY_KEY) continue;
    assert.equal(isFlagEnabled(null), false, key);
  }
  // isCanonicalV2ProcessPilotUiEnabled reads `env.VERCEL_ENV` directly
  // (unchanged from today, per the brief) rather than through a guarded read,
  // so a literal null throws instead of denying cleanly. Every real call site
  // invokes it with zero arguments (defaulting to process.env), never an
  // explicit null -- documented here and in the report rather than changed.
  assert.throws(() => isCanonicalV2ProcessPilotUiEnabled(null), TypeError);
});

test('the shared runtime allowlist denies null, undefined, and non-object input directly', () => {
  assert.equal(isPermittedCanonicalV2Runtime(null), false);
  assert.equal(isPermittedCanonicalV2Runtime(undefined), false);
  assert.equal(isPermittedCanonicalV2Runtime('not-an-object'), false);
  assert.equal(isPermittedCanonicalV2Runtime(42), false);
});
