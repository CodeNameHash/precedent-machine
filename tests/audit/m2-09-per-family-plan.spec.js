const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const { validateEntry } = require('../../lib/review-queue/store');

const {
  buildPlan,
  planMarkdown,
  queueEntry,
} = require('../../scripts/audit/m2-09-per-family-plan');

test('M2-09 per-family plan includes all families and baseline primitives', () => {
  const rows = buildPlan();
  assert.equal(rows.length, 15);
  const materialContracts = rows.find((row) => row.family === 'Material Contracts');
  assert.ok(materialContracts.primitives.includes('ThresholdCellWithHoverQuote'));
  assert.ok(materialContracts.primitives.includes('CoverageChecklist'));
  assert.ok(materialContracts.augmentations.some((item) => item.field === 'materialContractsBuckets'));
});

test('M2-09 per-family plan markdown names approval and rebuilt-table spec', () => {
  const text = planMarkdown(buildPlan(), '2026-07-08T00:00:00.000Z');
  assert.match(text, /Approval question for Ben/);
  assert.match(text, /## Antitrust \/ Regulatory/);
  assert.match(text, /### Rebuilt-Table Spec/);
  assert.match(text, /EvidenceHoverSource/);
});

test('M2-09 queue entry validates and blocks later steps pending approval', () => {
  const entry = queueEntry(buildPlan(), '2026-07-08T00:00:00.000Z');
  assert.equal(entry.id, 'm2-09-per-family-rebuild-plan');
  assert.equal(entry.kind, 'canonical');
  assert.equal(entry.resolution, null);
  assert.ok(entry.summary.includes('restore schema-first only after analytical parity is met'));
  validateEntry(entry);
});

test('committed M2-09 queue entry is resolved as approved, unblocking Step 4', () => {
  const entry = JSON.parse(fs.readFileSync('docs/review-queue/m2-09-per-family-rebuild-plan.json', 'utf8'));
  validateEntry(entry);
  assert.equal(entry.resolution.choice_key, 'approve');
  assert.equal(entry.resolution.codex_action, 'proceed with WP-M2-09 Steps 2-4 against the approved per-family rebuild plan');
  assert.ok(Number.isFinite(Date.parse(entry.resolved_at)), 'resolved_at must be a valid ISO date once resolved');
  assert.equal(entry.resolved_by, 'ben');
});
