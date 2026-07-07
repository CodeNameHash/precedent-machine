const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const createCli = require('../../scripts/review-queue/create');
const pollCli = require('../../scripts/review-queue/poll');
const { resolveEntry } = require('../../lib/review-queue/resolve');

function tempRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pm-review-queue-cli-'));
  fs.writeFileSync(path.join(root, 'HANDOFF.md'), '# Handoff\n');
  return root;
}

test('create CLI writes a PR-linked review queue entry', () => {
  const root = tempRoot();
  const result = createCli.run([
    '--id', 'rq-pr-123',
    '--kind', 'canonical',
    '--title', 'Approve canonical mapping',
    '--summary', 'Codex needs Ben to approve this mapping before merge.',
    '--pr', '123',
    '--evidence', 'audit=https://example.test/audit',
  ], { root, now: '2026-07-07T22:00:00.000Z' });

  assert.equal(result.ok, true);
  assert.equal(result.entry.id, 'rq-pr-123');
  assert.equal(result.entry.evidence[0].url, 'https://github.com/CodeNameHash/precedent-machine/pull/123');
  assert.equal(result.entry.evidence[1].label, 'audit');
  assert.equal(result.entry.choices[0].codex_action, 'self-merge PR #123');
  assert.ok(fs.existsSync(path.join(root, 'docs/review-queue/rq-pr-123.json')));
});

test('create CLI validates argument shapes', () => {
  assert.throws(() => createCli.parseArgs(['--kind']), /Missing value/);
  assert.throws(() => createCli.parseEvidence('bad'), /label=url/);
  assert.throws(() => createCli.prNumber('abc'), /Invalid PR number/);
});

test('poll CLI returns matching HANDOFF resolution by PR number', () => {
  const root = tempRoot();
  createCli.run([
    '--id', 'rq-pr-456',
    '--kind', 'destructive',
    '--title', 'Authorize deletion',
    '--summary', 'Codex needs Ben to authorize this delete.',
    '--pr', '456',
  ], { root, now: '2026-07-07T22:00:00.000Z' });
  resolveEntry('rq-pr-456', { choice_key: 'approve' }, { root, now: '2026-07-07T22:05:00.000Z' });

  const result = pollCli.run(['--pr', '456'], { root });
  assert.equal(result.found, true);
  assert.equal(result.resolutions[0].id, 'rq-pr-456');
  assert.equal(result.resolutions[0].choice_key, 'approve');
});

test('poll CLI returns no match cleanly', () => {
  const root = tempRoot();
  const result = pollCli.run(['--pr', '789'], { root });
  assert.equal(result.found, false);
  assert.deepEqual(result.resolutions, []);
});

test('poll CLI can match by review queue id', () => {
  const line = 'REVIEW_QUEUE_RESOLUTION {"id":"rq-id-only","kind":"clarify","title":"Clarify","choice_key":"approve","codex_action":"self-merge PR #321","resolved_at":"2026-07-07T22:05:00.000Z","resolved_by":"ben"}';
  const root = tempRoot();
  fs.appendFileSync(path.join(root, 'HANDOFF.md'), `${line}\n`);
  assert.equal(pollCli.run(['--id', 'rq-id-only'], { root }).found, true);
  assert.equal(pollCli.run(['--id', 'missing'], { root }).found, false);
});
