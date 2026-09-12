'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { compareReviewItems, summariseComparison } = require('../lib/product/review-comparison');

const fixturePath = path.join(__dirname, 'fixtures', 'product', 'review-comparison-fixture.v2.json');

function loadFixture() { return JSON.parse(fs.readFileSync(fixturePath, 'utf8')); }

function runCompare() {
  const fixture = loadFixture();
  return compareReviewItems({ v1Items: fixture.v1.items, v1Spans: fixture.v1.spans, v2Facts: fixture.v2 });
}

test('only items with a comment or a non-PENDING decision are included', () => {
  const results = runCompare();
  const ids = results.map((r) => r.v1_item_id);
  assert.equal(ids.length, 5);
  assert.ok(!ids.includes('v1-item-excluded-pending-no-comment'));
  assert.ok(ids.includes('v1-item-pending-comment'));
  assert.ok(ids.includes('v1-item-unresolved-no-comment'));
});

test('structure_node_id match takes priority over a same-byte-range fact elsewhere', () => {
  const factA = {
    fact_id: 'a', structure_node_id: 'nodeA',
    headline: { label: 'A', distinguishing_component_ids: ['x'] },
    components: [{ component_id: 'x', kind: 'TERM', origin: 'OWN', start_byte: 0, end_byte: 10, children: [] }],
  };
  const factB = {
    fact_id: 'b', structure_node_id: 'nodeB',
    headline: { label: 'B', distinguishing_component_ids: ['y'] },
    components: [{ component_id: 'y', kind: 'TERM', origin: 'OWN', start_byte: 0, end_byte: 10, children: [] }],
  };
  const item = {
    item_id: 'i1', comment: 'c', decision: 'ACCEPTED', section_reference: '1.1', structure_node_id: 'nodeB',
    original: { statement: 's', source_span_ids: ['s1'] },
  };
  const spans = { s1: { start_byte: 0, end_byte: 10, exact_text: 'x' } };
  const [result] = compareReviewItems({ v1Items: [item], v1Spans: spans, v2Facts: [factA, factB] });
  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0].fact_id, 'b');
});

test('MATCHED status for full byte overlap between a V1 item and its V2 fact', () => {
  const results = runCompare();
  const mae = results.find((r) => r.v1_item_id === 'v1-item-mae');
  assert.equal(mae.status, 'MATCHED');
  assert.equal(mae.matches.length, 1);
  assert.equal(mae.matches[0].fact_id, 'fact-mae-1');
  assert.equal(mae.matches[0].overlap_share, 1);
  assert.equal(mae.matches[0].headline_text.startsWith('MAE carve-out:'), true);
  assert.deepEqual(
    [...mae.matches[0].matched_components].sort(),
    ['c-war', 'c-war-1', 'c-war-2', 'c-war-3', 'c-war-4', 'c-war-4a'].sort(),
  );
});

test('PARTIAL status when overlap share is between 0 and 0.5', () => {
  const results = runCompare();
  const mc = results.find((r) => r.v1_item_id === 'v1-item-mc');
  assert.equal(mc.status, 'PARTIAL');
  assert.equal(mc.matches.length, 1);
  assert.ok(mc.matches[0].overlap_share > 0 && mc.matches[0].overlap_share < 0.5);
  assert.deepEqual([...mc.matches[0].matched_components].sort(), ['c-mc-period', 'c-mc-threshold']);
});

test('UNMATCHED status when the structure node matches but no byte overlap exists', () => {
  const results = runCompare();
  const term = results.find((r) => r.v1_item_id === 'v1-item-term');
  assert.equal(term.status, 'UNMATCHED');
  assert.deepEqual(term.matches, []);
});

test('items unrelated to any V2 fact fall back to a full scan and come back UNMATCHED', () => {
  const results = runCompare();
  const pending = results.find((r) => r.v1_item_id === 'v1-item-pending-comment');
  const unresolved = results.find((r) => r.v1_item_id === 'v1-item-unresolved-no-comment');
  assert.equal(pending.status, 'UNMATCHED');
  assert.deepEqual(pending.matches, []);
  assert.equal(unresolved.status, 'UNMATCHED');
  assert.deepEqual(unresolved.matches, []);
});

test('results are ordered by section_reference in natural order, then by V1 statement', () => {
  const results = runCompare();
  assert.deepEqual(results.map((r) => r.section_reference), ['3.2', '4.5', '5.1', '5.1', '9.1']);
  const tiedSection = results.filter((r) => r.section_reference === '5.1');
  assert.deepEqual(tiedSection.map((r) => r.v1_item_id), ['v1-item-pending-comment', 'v1-item-unresolved-no-comment']);
});

test('summariseComparison counts by status and section, and lists UNMATCHED items', () => {
  const results = runCompare();
  const summary = summariseComparison(results);
  assert.equal(summary.byStatus.MATCHED, 1);
  assert.equal(summary.byStatus.PARTIAL, 1);
  assert.equal(summary.byStatus.UNMATCHED, 3);
  assert.equal(summary.unmatched.length, 3);
  assert.equal(summary.bySection['3.2'].MATCHED, 1);
  assert.equal(summary.bySection['4.5'].PARTIAL, 1);
  assert.equal(summary.bySection['9.1'].UNMATCHED, 1);
  assert.equal(summary.bySection['5.1'].UNMATCHED, 2);
});

test('the CLI script writes a Markdown report from the fixture files', () => {
  const fixture = loadFixture();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'review-comparison-'));
  const v1Path = path.join(tmpDir, 'v1.json');
  const v2Path = path.join(tmpDir, 'v2.json');
  const outPath = path.join(tmpDir, 'report.md');
  fs.writeFileSync(v1Path, JSON.stringify(fixture.v1));
  fs.writeFileSync(v2Path, JSON.stringify(fixture.v2));
  const scriptPath = path.join(__dirname, '..', 'scripts', 'product', 'compare-review-items.js');

  const exitCode = (() => {
    try {
      execFileSync(process.execPath, [scriptPath, '--v1', v1Path, '--v2', v2Path, '--out', outPath]);
      return 0;
    } catch (e) {
      return e.status;
    }
  })();
  assert.equal(exitCode, 0);

  const report = fs.readFileSync(outPath, 'utf8');
  assert.match(report, /# V1-to-V2 review comparison/);
  assert.match(report, /## Summary/);
  assert.match(report, /\| MATCHED \| 1 \|/);
  assert.match(report, /\| PARTIAL \| 1 \|/);
  assert.match(report, /\| UNMATCHED \| 3 \|/);
  assert.match(report, /v1-item-mae \(MATCHED\)/);
  assert.match(report, /War\/terrorism\/sabotage carve-out reads correctly against the signed agreement\./);
  assert.match(report, /MAE carve-out:/);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});
