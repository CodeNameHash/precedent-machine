const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const test = require('node:test');

const ROOT = path.join(
  __dirname,
  '../contracts/canonical-v2/successor',
);
const GENERATOR = path.join(
  __dirname,
  '../scripts/generate-canonical-v2-successor-manifest.mjs',
);

function run(...args) {
  return execFileSync(process.execPath, [GENERATOR, ...args], {
    encoding: 'utf8',
  });
}

test('the checked-in successor manifest is the deterministic generator output', () => {
  assert.doesNotThrow(() => run('--check', '--root', ROOT));
  const first = run('--stdout', '--root', ROOT);
  const second = run('--stdout', '--root', ROOT);
  const checkedIn = fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8');

  assert.equal(first, second);
  assert.equal(first, checkedIn);
});

test('the successor manifest generator rejects nested manifests', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'canonical-successor-manifest-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.cpSync(ROOT, root, { recursive: true });
  const nestedDirectory = path.join(root, 'process', 'nested');
  fs.mkdirSync(nestedDirectory, { recursive: true });
  fs.writeFileSync(path.join(nestedDirectory, 'manifest.json'), '{}\n');

  const result = spawnSync(
    process.execPath,
    [GENERATOR, '--stdout', '--root', root],
    { encoding: 'utf8' },
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Nested manifests are not permitted/);
});

test('the successor manifest generator rejects members without governed metadata', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'canonical-successor-metadata-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.cpSync(ROOT, root, { recursive: true });
  fs.writeFileSync(path.join(root, 'process', 'unregistered.json'), '{}\n');

  const result = spawnSync(
    process.execPath,
    [GENERATOR, '--stdout', '--root', root],
    { encoding: 'utf8' },
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /has no valid object_kind/);
});
