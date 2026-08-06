const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createEntry } = require('../../lib/review-queue/create');
const { resolveEntry } = require('../../lib/review-queue/resolve');
const { listEntries, readEntry } = require('../../lib/review-queue/store');
const listHandler = require('../../pages/api/admin/review-queue/index');
const resolveHandler = require('../../pages/api/admin/review-queue/[id]/resolve');

function tempRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pm-review-queue-'));
  fs.mkdirSync(path.join(root, 'archive'), { recursive: true });
  fs.writeFileSync(path.join(root, 'archive', 'HANDOFF.md'), '# Handoff\n');
  return root;
}

function entryInput(overrides = {}) {
  return {
    id: 'rq-test-1',
    kind: 'canonical',
    title: 'Approve canonical mapping',
    summary: 'Codex needs a lawyer decision before changing a canonical mapping.',
    evidence: [{ label: 'PR', url: 'https://github.com/CodeNameHash/precedent-machine/pull/999' }],
    choices: [
      { key: 'approve', label: 'Approve as proposed', codex_action: 'self-merge PR #999' },
      { key: 'reject', label: 'Reject', codex_action: 'close PR #999' },
    ],
    ...overrides,
  };
}

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
  };
}

test('createEntry validates and writes a review queue entry', () => {
  const root = tempRoot();
  const entry = createEntry(entryInput(), { root, now: '2026-07-07T21:00:00.000Z' });
  assert.equal(entry.id, 'rq-test-1');
  assert.equal(entry.resolution, null);
  const stored = JSON.parse(fs.readFileSync(path.join(root, 'docs/review-queue/rq-test-1.json'), 'utf8'));
  assert.equal(stored.title, 'Approve canonical mapping');
  assert.throws(() => createEntry(entryInput({ id: '../bad' }), { root }), /Invalid review queue id/);
});

test('listEntries returns unresolved entries newest-first', () => {
  const root = tempRoot();
  createEntry(entryInput({ id: 'rq-old', title: 'Old' }), { root, now: '2026-07-07T20:00:00.000Z' });
  createEntry(entryInput({ id: 'rq-new', title: 'New' }), { root, now: '2026-07-07T22:00:00.000Z' });
  resolveEntry('rq-new', { choice_key: 'approve' }, { root, now: '2026-07-07T22:05:00.000Z' });
  assert.deepEqual(listEntries({ root }).map((entry) => entry.id), ['rq-old']);
  assert.deepEqual(listEntries({ root, includeResolved: true }).map((entry) => entry.id), ['rq-new', 'rq-old']);
});

test('resolveEntry records resolution and appends machine-readable HANDOFF line', () => {
  const root = tempRoot();
  createEntry(entryInput(), { root, now: '2026-07-07T21:00:00.000Z' });
  const result = resolveEntry('rq-test-1', {
    choice_key: 'approve',
    resolved_by: 'ben',
    note: 'Looks right.',
  }, { root, now: '2026-07-07T21:05:00.000Z' });
  assert.equal(result.entry.resolution.choice_key, 'approve');
  assert.equal(readEntry('rq-test-1', { root }).resolved_at, '2026-07-07T21:05:00.000Z');
  const handoff = fs.readFileSync(path.join(root, 'archive', 'HANDOFF.md'), 'utf8');
  assert.match(handoff, /^REVIEW_QUEUE_RESOLUTION /m);
  assert.match(handoff, /"id":"rq-test-1"/);
  assert.throws(() => resolveEntry('rq-test-1', { choice_key: 'approve' }, { root }), /already resolved/);
});

test('review queue API lists and resolves entries', () => {
  const root = tempRoot();
  const previousRoot = process.env.REVIEW_QUEUE_ROOT;
  process.env.REVIEW_QUEUE_ROOT = root;
  try {
    createEntry(entryInput(), { root, now: '2026-07-07T21:00:00.000Z' });
    const listRes = mockRes();
    listHandler({ method: 'GET', query: {} }, listRes);
    assert.equal(listRes.statusCode, 200);
    assert.equal(listRes.body.total, 1);
    assert.equal(listRes.body.entries[0].id, 'rq-test-1');

    const resolveRes = mockRes();
    resolveHandler({
      method: 'POST',
      query: { id: 'rq-test-1' },
      body: { choice_key: 'reject', resolved_by: 'ben' },
    }, resolveRes);
    assert.equal(resolveRes.statusCode, 200);
    assert.equal(resolveRes.body.entry.resolution.choice_key, 'reject');

    const afterRes = mockRes();
    listHandler({ method: 'GET', query: {} }, afterRes);
    assert.equal(afterRes.body.total, 0);
  } finally {
    if (previousRoot == null) delete process.env.REVIEW_QUEUE_ROOT;
    else process.env.REVIEW_QUEUE_ROOT = previousRoot;
  }
});
