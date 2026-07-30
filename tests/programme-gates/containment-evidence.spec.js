const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const YAML = require('yaml');

const ROOT = path.resolve(__dirname, '../..');
const registry = YAML.parse(
  fs.readFileSync(path.join(ROOT, 'docs/codex-program/programme-gates.yaml'), 'utf8'),
).programme_gate_registry;

test('Tier A production containment remains active before cutover', () => {
  assert.equal(registry.tier_a_pre_cutover.state, 'ACTIVE');
  assert.deepEqual(registry.tier_a_pre_cutover.controls, [
    'NO_EXTRACTION_REPLAY_BACKFILL_OR_LOAD_TEST_AGAINST_PRODUCTION',
    'BEN_RUN_LOCAL_DRY_RUN_FIRST_CORPUS_WRITES_ONLY',
    'STAGING_ONLY_CREDENTIALS_IN_STAGING_AND_PREVIEW',
    'NO_PRODUCTION_CREDENTIAL_IN_PREVIEW',
    'NO_SERVICE_CREDENTIAL_IN_BROWSER_CODE',
    'VERCEL_DEPLOYMENT_PROTECTION_OR_SSO_ON_PREVIEWS',
    'NO_SECRETS_IN_EVIDENCE_PROMPTS_OR_COMMITTED_FILES',
    'EXISTING_LIVE_ROUTE_GUARD_TESTS_REMAIN_ACTIVE',
  ]);
});

test('the production market endpoint stays hard-contained without database code', () => {
  const source = fs.readFileSync(path.join(ROOT, 'pages/api/market-stats.js'), 'utf8');
  assert.match(source, /marketStatsContainedHandler/);
  assert.doesNotMatch(source, /supabase|canonical_v2_market|canonical_v2_query/i);
});
