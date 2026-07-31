const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const test = require('node:test');

const REVIEW_BASIS_COMMIT = 'd62456a81567baf8bf6aef7ae0c6290567086a08';
const SOURCE = 'scripts/sign-g0-evidence.mjs';

function ownerAuthorityAllowedPaths() {
  const source = fs.readFileSync(SOURCE, 'utf8');
  const match = source.match(
    /const OWNER_AUTHORITY_ALLOWED_PATHS = Object\.freeze\(\[([\s\S]*?)\]\);/,
  );
  assert.ok(match, 'owner-authority allowlist must remain a closed static array');
  return new Set([...match[1].matchAll(/'([^']+)'/g)].map((entry) => entry[1]));
}

test('owner-authority allowlist covers every fixed review-basis diff path and rejects extra paths', () => {
  const changedPaths = execFileSync(
    'git',
    ['diff', '--name-only', `${REVIEW_BASIS_COMMIT}..HEAD`],
    { encoding: 'utf8' },
  ).trim().split('\n').filter(Boolean);
  const allowedPaths = ownerAuthorityAllowedPaths();

  assert.ok(changedPaths.length > 0);
  for (const changedPath of changedPaths) {
    assert.equal(allowedPaths.has(changedPath), true, `missing allowlist path: ${changedPath}`);
  }
  assert.equal(allowedPaths.has('tests/unapproved-owner-authority-path.test.js'), false);
});
