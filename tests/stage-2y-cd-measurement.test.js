const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
async function load() { return import(path.join(ROOT, 'scripts/stage-2y-cd-measurement.mjs')); }

function rendered({ fourth = 'four', seventh = 'seven' } = {}) {
  return {
    section: { id: 'test', title: 'Test' },
    rows: [
      { id: 'one', label: 'One', matches_claim_key: true, cells: [{ id: 'a', header: 'A', text: 'one' }] },
      { id: 'two', label: 'Two', matches_claim_key: false, cells: [{ id: 'b', header: 'B', text: 'two' }] },
      { id: 'three', label: 'Three', matches_claim_key: false, cells: [{ id: 'c', header: 'C', text: 'three' }] },
      {
        id: 'four', label: 'Four', matches_claim_key: false, cells: [
          { id: '1', header: '1', text: 'one' },
          { id: '2', header: '2', text: 'two' },
          { id: '3', header: '3', text: 'three' },
          { id: '4', header: '4', text: fourth },
          { id: '5', header: '5', text: 'five' },
          { id: '6', header: '6', text: 'six' },
          { id: '7', header: '7', text: seventh },
        ],
      },
    ],
  };
}

test('four-state counts exclude review rows that already have a resolution', async () => {
  const { resolutionCounts } = await load();
  assert.deepEqual(resolutionCounts({
    resolved: [{}, {}],
    open_world: [{}, {}, {}],
    review_queue: [{ has_resolution: false }, { has_resolution: true }, { has_resolution: false }],
  }), { attempted: 4, resolved: 2, open_world: 3, review: 2 });
});

test('full-output signatures include rows after the third and cells after the sixth', async () => {
  const { renderSignature } = await load();
  const baseline = renderSignature(rendered());
  assert.notEqual(renderSignature(rendered({ fourth: 'changed' })).digest, baseline.digest);
  assert.notEqual(renderSignature(rendered({ seventh: 'changed' })).digest, baseline.digest);
  assert.equal(baseline.payload.rows.length, 4);
  assert.equal(baseline.payload.rows[3].cells.length, 7);
});

test('claim content is measured only on the one exact matched row', async () => {
  const { hasContent, matchedClaimRow } = await load();
  const payload = {
    rows: [
      { matches_claim_key: true, cells: [{ text: null }] },
      { matches_claim_key: false, cells: [{ text: 'Content from another claim' }] },
    ],
  };
  assert.equal(hasContent(matchedClaimRow(payload)), false);
  assert.throws(
    () => matchedClaimRow({ rows: payload.rows.map((row) => ({ ...row, matches_claim_key: false })) }),
    /MEASUREMENT_CLAIM_ROW_NOT_UNIQUE:0/,
  );
});

test('an absence note does not erase substantive content in the same row', async () => {
  const { hasContent } = await load();
  assert.equal(hasContent({ cells: [{ text: 'Not specified' }] }), false);
  assert.equal(hasContent({ cells: [{ text: 'Party: Parent. Continuing requirement not specified' }] }), true);
});

test('duplicate excess counts every repeated claim after the retained full output', async () => {
  const { buildDuplicateReport } = await load();
  const groups = new Map([
    ['a', { family: 'A', deal: 'one', signature: 'a', members: [{}, {}, {}] }],
    ['b', { family: 'A', deal: 'one', signature: 'b', members: [{}] }],
  ]);
  const report = buildDuplicateReport(groups);
  assert.equal(report.raw_rendered_claims, 4);
  assert.equal(report.distinct_full_output_signatures, 2);
  assert.equal(report.duplicate_excess, 2);
  assert.equal(report.collapse_rate, 0.5);
});

test('the baseline discovery remains exactly 130 unique deal-family runs', async () => {
  const { buildManifest, discoverBaselineRuns, stage2yNBinding, validateManifest } = await load();
  const runs = discoverBaselineRuns();
  assert.equal(runs.length, 130);
  assert.equal(new Set(runs.map((run) => `${run.family}|${run.deal}`)).size, 130);
  const manifest = buildManifest({ runs, stage2yN: stage2yNBinding() });
  assert.equal(validateManifest(manifest), true);
});

test('the committed baseline binds the old Stage 2Y-N state and the complete measurement funnel', async () => {
  const { validateBaseline, validateManifest } = await load();
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'evidence/canonical-v2/stage-2y-cd-baseline-manifest.json')));
  const baseline = JSON.parse(fs.readFileSync(path.join(ROOT, 'evidence/canonical-v2/stage-2y-cd-baseline.json')));
  assert.equal(validateManifest(manifest), true);
  assert.equal(validateBaseline(baseline, manifest), true);
  assert.equal(manifest.stage_2y_n_before.sha256, '537b1f132f4fcfa7df50cc9536f68fc615a81c7334929b4cbb55fd70f2f884d4');
  assert.equal(baseline.row_measurement, 'EXACT_GOVERNED_ROW_V3_ROUTE_BOUND');
  assert.deepEqual(baseline.measurement.totals.rendering_funnel, {
    resolved_input: 1526,
    route_available: 474,
    card_projected: 447,
    row_emitted: 229,
    row_with_content: 229,
  });
  assert.deepEqual({
    attempted: baseline.measurement.totals.attempted,
    resolved: baseline.measurement.totals.resolved,
    open_world: baseline.measurement.totals.open_world,
    review: baseline.measurement.totals.review,
  }, { attempted: 2201, resolved: 1526, open_world: 1701, review: 675 });
  assert.deepEqual(baseline.measurement.totals.duplicates, {
    raw_rendered_claims: 229,
    distinct_full_output_signatures: 153,
    duplicate_excess: 76,
    collapse_rate: 76 / 229,
  });
});

test('report validation rejects stale current measurement and stale delta under a valid envelope', async () => {
  const {
    compareMeasurements,
    measurePinnedRuns,
    validateReport,
  } = await load();
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'evidence/canonical-v2/stage-2y-cd-baseline-manifest.json')));
  const baseline = JSON.parse(fs.readFileSync(path.join(ROOT, 'evidence/canonical-v2/stage-2y-cd-baseline.json')));
  const report = JSON.parse(fs.readFileSync(path.join(ROOT, 'evidence/canonical-v2/stage-2y-cd-report.json')));
  const current = measurePinnedRuns(manifest);

  const staleCurrent = structuredClone(report);
  staleCurrent.current.totals.rendering_funnel.row_emitted -= 1;
  assert.throws(
    () => validateReport(staleCurrent, manifest, baseline, current),
    /CD_REPORT_CURRENT_STALE/,
  );

  const staleDelta = structuredClone(report);
  staleDelta.current = current;
  staleDelta.delta = compareMeasurements(baseline.measurement, current);
  staleDelta.delta.totals.rendering_funnel.row_emitted -= 1;
  assert.throws(
    () => validateReport(staleDelta, manifest, baseline, current),
    /CD_REPORT_DELTA_STALE/,
  );
});
