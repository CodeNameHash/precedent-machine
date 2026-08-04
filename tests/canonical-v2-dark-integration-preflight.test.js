'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const {
  CURRENT_ENVIRONMENT_VERIFICATION,
  DARK_INTEGRATION_AUTHORITY,
  DARK_INTEGRATION_CONFIGURATION_SCHEMA,
  DARK_INTEGRATION_PREFLIGHT_SCHEMA,
  buildDarkIntegrationPreflight,
  validateDarkIntegrationPreflightReceipt,
} = require('../lib/canonical-v2/dark-integration-preflight');
const { CANONICAL_V2_FEATURE_FLAG_DEFINITIONS } = require('../lib/canonical-v2/feature-flags');
const { contentId } = require('../lib/canonical-v2/canonical-bytes');

const SAFE_ROOT = path.resolve(__dirname, '..');

function configuration(overrides = {}) {
  return {
    schema_version: DARK_INTEGRATION_CONFIGURATION_SCHEMA,
    authority: {
      production_authority: 'NONE',
      production_corpus_write_authority: 'NONE',
      production_import_authority: 'NONE',
      production_activation_authority: 'NONE',
    },
    durable_artifact_root: SAFE_ROOT,
    ...overrides,
  };
}

function blockerCodes(receipt) {
  return receipt.blockers.map((entry) => entry.code);
}

test('closed local diagnostics remain blocked without trusted current-environment verification', () => {
  const first = buildDarkIntegrationPreflight({ configuration: configuration(), environment: {} });
  const second = buildDarkIntegrationPreflight({ configuration: configuration(), environment: {} });
  assert.equal(first.status, 'BLOCKED');
  assert.equal(first.preflight_id, second.preflight_id);
  assert.equal(first.authority, DARK_INTEGRATION_AUTHORITY);
  assert.equal(first.authority, 'NONE');
  assert.equal(first.executable_pass, false);
  assert.equal(first.current_environment_verification, CURRENT_ENVIRONMENT_VERIFICATION);
  assert.ok(blockerCodes(first).includes('DARK_INTEGRATION_TRUSTED_CURRENT_ENVIRONMENT_VERIFIER_UNAVAILABLE'));
  assert.deepEqual(first.feature_flags.map((entry) => entry.environment_key), CANONICAL_V2_FEATURE_FLAG_DEFINITIONS
    .map((entry) => entry.environment_key).sort());
  assert.ok(first.feature_flags.every((entry) => entry.configured === null && !entry.configured_enabled && !entry.effective_enabled));
  assert.equal(first.production_authority.production_authority, 'NONE');
  assert.deepEqual(validateDarkIntegrationPreflightReceipt(first), first);
});

function rehash(receipt) {
  const { preflight_id: _oldId, ...body } = receipt;
  return { ...body, preflight_id: contentId(DARK_INTEGRATION_PREFLIGHT_SCHEMA, body) };
}

test('fabricated and self-hashed PASS receipts cannot become executable authority', () => {
  const diagnostic = buildDarkIntegrationPreflight({ configuration: configuration(), environment: {} });
  for (const fabricated of [
    rehash({ ...diagnostic, status: 'PASS' }),
    rehash({ ...diagnostic, status: 'PASS', executable_pass: true, authority: 'GRANTED' }),
  ]) {
    assert.throws(
      () => validateDarkIntegrationPreflightReceipt(fabricated),
      /invalid schema/,
    );
  }
});

test('a self-hashed receipt cannot remove the permanent external-verifier blocker', () => {
  const diagnostic = buildDarkIntegrationPreflight({ configuration: configuration(), environment: {} });
  const cleared = rehash({ ...diagnostic, blockers: [] });
  assert.throws(
    () => validateDarkIntegrationPreflightReceipt(cleared),
    /required external current-environment verifier blocker/,
  );
});

test('stale, substituted and replayed diagnostics remain non-executable', () => {
  const diagnostic = buildDarkIntegrationPreflight({ configuration: configuration(), environment: {} });
  assert.throws(
    () => validateDarkIntegrationPreflightReceipt(diagnostic, {
      current_environment: {},
      trusted_controller: { result: 'PASS' },
    }),
    /Caller-supplied current-environment verification is not trusted/,
  );

  const substituted = rehash({
    ...diagnostic,
    authority: 'GRANTED',
  });
  assert.throws(() => validateDarkIntegrationPreflightReceipt(substituted), /invalid schema/);

  for (let replay = 0; replay < 2; replay += 1) {
    const acceptedDiagnostic = validateDarkIntegrationPreflightReceipt(diagnostic);
    assert.equal(acceptedDiagnostic.status, 'BLOCKED');
    assert.equal(acceptedDiagnostic.authority, 'NONE');
    assert.equal(acceptedDiagnostic.executable_pass, false);
  }
});

test('blocks each truthy feature-flag value, including a pilot flag that production routing would otherwise suppress', () => {
  for (const definition of CANONICAL_V2_FEATURE_FLAG_DEFINITIONS) {
    const receipt = buildDarkIntegrationPreflight({
      configuration: configuration(),
      environment: { [definition.environment_key]: 'yes', VERCEL_ENV: 'production' },
    });
    assert.equal(receipt.status, 'BLOCKED', definition.environment_key);
    assert.ok(blockerCodes(receipt).includes('DARK_INTEGRATION_FEATURE_FLAG_ENABLED'), definition.environment_key);
  }
});

test('blocks non-NONE production, write, import, or activation authority', () => {
  for (const key of ['production_authority', 'production_corpus_write_authority', 'production_import_authority', 'production_activation_authority']) {
    const receipt = buildDarkIntegrationPreflight({
      configuration: configuration({ authority: { ...configuration().authority, [key]: 'ALLOW' } }),
      environment: {},
    });
    assert.equal(receipt.status, 'BLOCKED');
    assert.ok(blockerCodes(receipt).includes('DARK_INTEGRATION_PRODUCTION_AUTHORITY_ENABLED'));
  }
});

test('blocks omitted authority controls and configuration schema drift', () => {
  const missingAuthority = configuration();
  delete missingAuthority.authority.production_import_authority;
  const receipt = buildDarkIntegrationPreflight({ configuration: missingAuthority, environment: {} });
  assert.equal(receipt.status, 'BLOCKED');
  assert.ok(blockerCodes(receipt).includes('DARK_INTEGRATION_AUTHORITY_SCHEMA_DRIFT'));

  const drifted = buildDarkIntegrationPreflight({
    configuration: configuration({ unexpected_control: 'NONE' }),
    environment: {},
  });
  assert.equal(drifted.status, 'BLOCKED');
  assert.ok(blockerCodes(drifted).includes('DARK_INTEGRATION_CONFIGURATION_SCHEMA_DRIFT'));
});

test('blocks a missing, temporary, or unavailable durable evidence root', () => {
  for (const root of [undefined, '/tmp/canonical-v2-evidence', '/Users/example/not-created-canonical-v2-evidence']) {
    const receipt = buildDarkIntegrationPreflight({
      configuration: configuration({ durable_artifact_root: root }),
      environment: {},
    });
    assert.equal(receipt.status, 'BLOCKED');
    assert.ok(blockerCodes(receipt).some((code) => code.startsWith('DURABLE_ARTIFACT_ROOT_')));
  }
});
