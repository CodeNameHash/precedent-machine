const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const test = require('node:test');

const {
  enumerateCompleteGitAuthorshipUniverse,
} = require('../../lib/programme-gates/git-authorship');

const ROOT = path.resolve(__dirname, '../..');

test('review independence enumerates the complete non-shallow Git DAG itself', () => {
  const expectedCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim();
  const expectedCommits = new Set(execFileSync(
    'git',
    ['rev-list', '--all', expectedCommit],
    { cwd: ROOT, encoding: 'utf8' },
  ).trim().split('\n'));
  const events = enumerateCompleteGitAuthorshipUniverse({
    repositoryRoot: ROOT,
    expectedCommit,
  });
  assert.deepEqual(new Set(events.map((event) => event.commit_id)), expectedCommits);
  assert.ok(events.every((event) => event.identity_set.length > 0));
});

test('review independence rejects a commit other than repository HEAD', () => {
  assert.throws(
    () => enumerateCompleteGitAuthorshipUniverse({
      repositoryRoot: ROOT,
      expectedCommit: '0'.repeat(40),
    }),
    /reviewed commit/,
  );
});
