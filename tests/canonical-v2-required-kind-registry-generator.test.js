const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const ROOT = path.join(__dirname, '..');
const SCRIPT = path.join(
  ROOT,
  'scripts/generate-canonical-v2-required-kind-registry.mjs',
);
const REGISTRY_PATH =
  'governance/canonical-bundle-input-required-kind-registry.v1.json';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'required-kind-registry-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'agreement'), { recursive: true });
  fs.mkdirSync(path.join(root, 'process'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'agreement', 'claim-a.json'),
    JSON.stringify({
      object_kind: 'CLAIM_DEFINITION',
      stable_id: 'CLAIM_A',
      schema_version: 'CLAIM_DEFINITION/V1',
    }),
  );
  fs.writeFileSync(
    path.join(root, 'agreement', 'claim-b.json'),
    JSON.stringify({
      object_kind: 'CLAIM_DEFINITION',
      stable_id: 'CLAIM_B',
      schema_version: 'CLAIM_DEFINITION/V2',
    }),
  );
  fs.writeFileSync(
    path.join(root, 'process', 'event.json'),
    JSON.stringify({
      object_kind: 'PROCESS_LOGICAL_TYPE_INPUT',
      stable_id: 'PROCESS_EVENT',
      schema_version: 'PROCESS_LOGICAL_TYPE_INPUT/V1',
    }),
  );
  fs.writeFileSync(path.join(root, 'manifest.json'), '{}\n');
  return root;
}

function run(root, args = []) {
  return spawnSync(process.execPath, [SCRIPT, '--root', root, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
  });
}

test('derives one exact closed required-kind registry deterministically', (t) => {
  const root = fixture(t);
  const first = run(root, ['--stdout']);
  const second = run(root, ['--stdout']);

  assert.equal(first.status, 0);
  assert.equal(second.status, 0);
  assert.equal(first.stdout, second.stdout);
  assert.deepEqual(JSON.parse(first.stdout), {
    object_kind: 'CANONICAL_BUNDLE_INPUT_REQUIRED_KIND_REGISTRY',
    stable_id: 'CANONICAL_BUNDLE_INPUT_REQUIRED_KIND_REGISTRY',
    schema_version: 'CANONICAL_BUNDLE_INPUT_REQUIRED_KIND_REGISTRY/V1',
    required_kinds: [
      {
        object_kind: 'CANONICAL_BUNDLE_INPUT_REQUIRED_KIND_REGISTRY',
        minimum_count: 1,
        maximum_count: 1,
        allowed_schema_versions: [
          'CANONICAL_BUNDLE_INPUT_REQUIRED_KIND_REGISTRY/V1',
        ],
      },
      {
        object_kind: 'CLAIM_DEFINITION',
        minimum_count: 2,
        maximum_count: 2,
        allowed_schema_versions: [
          'CLAIM_DEFINITION/V1',
          'CLAIM_DEFINITION/V2',
        ],
      },
      {
        object_kind: 'PROCESS_LOGICAL_TYPE_INPUT',
        minimum_count: 1,
        maximum_count: 1,
        allowed_schema_versions: ['PROCESS_LOGICAL_TYPE_INPUT/V1'],
      },
    ],
  });
  assert.equal(
    fs.existsSync(path.join(root, ...REGISTRY_PATH.split('/'))),
    false,
  );
});

test('writes and checks the exact registry without self-count drift', (t) => {
  const root = fixture(t);
  assert.equal(run(root).status, 0);
  assert.equal(run(root, ['--check']).status, 0);
  assert.equal(run(root).status, 0);
  assert.equal(run(root, ['--check']).status, 0);

  const registryPath = path.join(root, ...REGISTRY_PATH.split('/'));
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  const self = registry.required_kinds.find(
    (entry) => entry.object_kind
      === 'CANONICAL_BUNDLE_INPUT_REQUIRED_KIND_REGISTRY',
  );
  assert.equal(self.minimum_count, 1);

  registry.required_kinds[1].minimum_count = 1;
  fs.writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`);
  const stale = run(root, ['--check']);
  assert.equal(stale.status, 1);
  assert.match(stale.stderr, /Required-kind registry is stale/);
});

test('rejects malformed members and a second registry identity', (t) => {
  const malformedRoot = fixture(t);
  fs.writeFileSync(
    path.join(malformedRoot, 'agreement', 'invalid.json'),
    JSON.stringify({ object_kind: 'CLAIM_DEFINITION' }),
  );
  const malformed = run(malformedRoot, ['--stdout']);
  assert.notEqual(malformed.status, 0);
  assert.match(malformed.stderr, /has no valid stable_id/);

  const duplicateRoot = fixture(t);
  fs.writeFileSync(
    path.join(duplicateRoot, 'agreement', 'other-registry.json'),
    JSON.stringify({
      object_kind: 'CANONICAL_BUNDLE_INPUT_REQUIRED_KIND_REGISTRY',
      stable_id: 'OTHER',
      schema_version: 'CANONICAL_BUNDLE_INPUT_REQUIRED_KIND_REGISTRY/V1',
    }),
  );
  const duplicate = run(duplicateRoot, ['--stdout']);
  assert.notEqual(duplicate.status, 0);
  assert.match(duplicate.stderr, /required-kind registry exists outside/);
});

test('rejects symbolic links and incompatible command modes', (t) => {
  const root = fixture(t);
  fs.symlinkSync(
    path.join(root, 'agreement', 'claim-a.json'),
    path.join(root, 'agreement', 'linked.json'),
  );
  const linked = run(root, ['--stdout']);
  assert.notEqual(linked.status, 0);
  assert.match(linked.stderr, /Symbolic links are not permitted/);

  const incompatible = run(root, ['--stdout', '--check']);
  assert.notEqual(incompatible.status, 0);
  assert.match(incompatible.stderr, /cannot be combined/);
});

test('uses one exact three-file canonical-work-start allowlist', () => {
  const allowlist = JSON.parse(fs.readFileSync(
    path.join(
      ROOT,
      '.github/phase-allowlists/'
        + 'wp-canonical-required-kind-registry-generator-v1.json',
    ),
    'utf8',
  ));
  assert.equal(allowlist.required_work_class, 'canonical_work_start');
  assert.deepEqual(allowlist.allowed, [
    '.github/phase-allowlists/'
      + 'wp-canonical-required-kind-registry-generator-v1.json',
    'scripts/generate-canonical-v2-required-kind-registry.mjs',
    'tests/canonical-v2-required-kind-registry-generator.test.js',
  ]);
});
