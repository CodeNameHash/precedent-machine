'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('near-miss explicitly excludes the inert representation-topic classifier', async () => {
  const script = path.resolve(__dirname, '..', 'scripts/stage-2y-registry-near-miss.mjs');
  const { INERT_REGISTRY_EXCLUSIONS } = await import(`${path.toNamespacedPath(script)}?inert=${Date.now()}`);
  assert.deepEqual(INERT_REGISTRY_EXCLUSIONS.representation_topic, {
    matcher_count: 0,
    reason: 'The representation-topic registry is inert. Stage 2Y-C near-miss scans resolver matchers only, and does not invoke this recorded-corpus classifier.',
  });
});

// Whether the committed near-miss report is current is proved by the named CI
// gate `npm run gate:near-miss` (see .github/workflows/ci.yml, job
// evidence-gates), which re-derives it from every admitted corpus run once per
// exact input digest. It is not part of `npm test`.

test('metadata migration preserves run and record bytes, and pins the scanned substrate', async () => {
  const { migrateStoredMetadata, markdown } = await import(path.resolve(__dirname, '..', 'scripts/stage-2y-registry-near-miss.mjs'));
  const current = {
    input_digest: 'sha256:unchanged-receipts',
    registry_substrate: { manifest: { modules: [{ name: 'general-covenant', version: 'V1', digest: 'sha256:general-current' }, { name: 'representation-topic', version: 'V1', digest: 'sha256:topic-current' }] } },
    matcher_coverage: { closing_condition_kinds: { matcher_count: 0 }, representation_topic: { matcher_count: 0 } },
    summary: { runs_rebuilt: 1, runs_discovered: 1, runs_excluded: 0, evaluated_spans: 1, anchor_hits: 1, non_fires: 1, review_leads_reported: 0, review_leads_per_matcher_cap: 8 },
    runs: [{ run_name: 'run-1', input_digests: { receipt: 'sha256:one' } }],
    records: [{ registry: 'general-covenant', matcher: 'COV-1', run_name: 'run-1', section_reference: '1.1', absolute_start: 0, absolute_end: 1, anchors_present: ['covenant'], recorded_candidate_ids: [], excerpt: 'text', excerpt_sha256: 'sha256:two' }],
  };
  const migrated = migrateStoredMetadata(current);
  assert.equal(JSON.stringify(migrated.runs), JSON.stringify(current.runs));
  assert.equal(JSON.stringify(migrated.records), JSON.stringify(current.records));
  assert.equal(migrated.registry_substrate.scanned_registry_substrate.modules.some(({ name }) => name === 'representation-topic'), false);
  assert.equal(migrated.registry_substrate.inert_registry_exclusions.representation_topic.matcher_count, 0);
  assert.match(markdown(migrated), /Excluded non-runtime registry: representation-topic/);
});

test('stored near-miss migration leaves every run, matcher summary, and record byte-identical', async () => {
  const script = path.resolve(__dirname, '..', 'scripts/stage-2y-registry-near-miss.mjs');
  const { migrateStoredMetadata } = await import(`${path.toNamespacedPath(script)}?stored=${Date.now()}`);
  const stored = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'evidence/canonical-v2/stage-2y-registry-near-miss.json'), 'utf8'));
  const migrated = migrateStoredMetadata(stored);
  for (const key of ['runs', 'matcher_summary', 'records']) assert.equal(JSON.stringify(migrated[key]), JSON.stringify(stored[key]), key);
});

test('matcher identities are unique and cover every matcher-bearing registry concern', async () => {
  const { MATCHERS } = await import(path.resolve(__dirname, '..', 'scripts/stage-2y-registry-near-miss.mjs'));
  const identities = MATCHERS.map(({ registry, key }) => `${registry}:${key}`);
  assert.equal(new Set(identities).size, identities.length);
  for (const registry of ['general-covenant', 'material-contract', 'interim-operating', 'party-capacity', 'materiality-qualifier']) {
    assert.ok(MATCHERS.some((matcher) => matcher.registry === registry), registry);
  }
});

test('generated Markdown has no trailing whitespace', async () => {
  const { markdown } = await import(path.resolve(__dirname, '..', 'scripts/stage-2y-registry-near-miss.mjs'));
  const report = {
    summary: { runs_rebuilt: 1, runs_discovered: 1, runs_excluded: 0, evaluated_spans: 1, anchor_hits: 1, non_fires: 1, review_leads_reported: 1, review_leads_per_matcher_cap: 8 },
    records: [{ registry: 'materiality-qualifier', matcher: 'TEST#1', run_name: 'run', section_reference: '1.1', absolute_start: 0, absolute_end: 1, anchors_present: ['test'], recorded_candidate_ids: [], excerpt: 'quoted text  \n  '}],
  };
  assert.doesNotMatch(markdown(report), /[\t ]+$/m);
});
