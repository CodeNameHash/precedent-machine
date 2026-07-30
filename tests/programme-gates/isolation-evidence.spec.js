const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const YAML = require('yaml');

const registry = YAML.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../../docs/codex-program/programme-gates.yaml'),
    'utf8',
  ),
).programme_gate_registry;

test('Tier A isolates Preview and staging from production credentials and writes', () => {
  const controls = new Set(registry.tier_a_pre_cutover.controls);
  for (const required of [
    'NO_EXTRACTION_REPLAY_BACKFILL_OR_LOAD_TEST_AGAINST_PRODUCTION',
    'STAGING_ONLY_CREDENTIALS_IN_STAGING_AND_PREVIEW',
    'NO_PRODUCTION_CREDENTIAL_IN_PREVIEW',
    'NO_SERVICE_CREDENTIAL_IN_BROWSER_CODE',
    'VERCEL_DEPLOYMENT_PROTECTION_OR_SSO_ON_PREVIEWS',
  ]) {
    assert.equal(controls.has(required), true, required);
  }
  assert.equal(registry.work_classes.snapshot_restore_and_preview.authority, 'ISOLATED_STAGING_ONLY');
});
