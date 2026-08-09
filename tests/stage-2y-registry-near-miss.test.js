'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
test('Stage 2Y-C near-miss report remains read-only and current', () => {
  const run = spawnSync(process.execPath, [path.resolve(__dirname, '..', 'scripts/stage-2y-registry-near-miss.mjs'), '--check'], { cwd: path.resolve(__dirname, '..'), encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
});

test('a changed registry identity rejects evidence even when receipt input is unchanged', async () => {
  const { isCurrentReport, markdown } = await import(path.resolve(__dirname, '..', 'scripts/stage-2y-registry-near-miss.mjs'));
  const current = {
    input_digest: 'sha256:unchanged-receipts',
    registry_substrate: { manifest_digest: 'sha256:current-registry' },
    summary: { runs_rebuilt: 1, runs_discovered: 1, runs_excluded: 0, evaluated_spans: 1, anchor_hits: 1, non_fires: 1, review_leads_reported: 0, review_leads_per_matcher_cap: 8 },
    records: [],
  };
  const stale = {
    ...current,
    registry_substrate: { manifest_digest: 'sha256:prior-registry' },
  };
  assert.equal(isCurrentReport({ stored: `${JSON.stringify(stale, null, 2)}\n`, storedMarkdown: markdown(stale), current }), false);
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
