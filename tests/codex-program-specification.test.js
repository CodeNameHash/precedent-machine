const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('governing CODEX programme specification is mechanically valid', () => {
  const root = path.resolve(__dirname, '..');
  const result = spawnSync(process.execPath, ['scripts/verify-codex-program-spec.mjs'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /CODEX programme specification PASS [a-f0-9]{64}/);
});
