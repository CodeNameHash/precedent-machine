const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const { validateEntry } = require('../../lib/review-queue/store');

test('review queue admin documentation names the queue flow and Codex helpers', () => {
  const doc = fs.readFileSync('docs/admin/review-queue.md', 'utf8');
  assert.match(doc, /\/admin\/review-queue/);
  assert.match(doc, /scripts\/review-queue\/create\.js/);
  assert.match(doc, /scripts\/review-queue\/poll\.js/);
  assert.match(doc, /REVIEW_QUEUE_RESOLUTION/);
});

test('first live queue entry validates and gates legacy vocab deletion', () => {
  const entry = validateEntry(JSON.parse(fs.readFileSync('docs/review-queue/authorize-legacy-vocab-deletion.json', 'utf8')));
  assert.equal(entry.id, 'authorize-legacy-vocab-deletion');
  assert.equal(entry.kind, 'destructive');
  assert.equal(entry.title, 'Authorize legacy vocab deletion');
  assert.equal(entry.resolution, null);
  assert.ok(entry.summary.includes('does not delete anything by itself'));
  assert.deepEqual(entry.choices.map((choice) => choice.key), ['approve', 'reject', 'defer']);
});
