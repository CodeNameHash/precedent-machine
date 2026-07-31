const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  buildTrustedReviewPlan,
  specificationRootFromMembers,
} = require('../lib/programme-gates/review-controller');

const MANIFEST_PATH = 'docs/codex-program/specification-manifest.json';

function sha256(bytes) {
  return require('node:crypto').createHash('sha256').update(bytes).digest('hex');
}

function membersFor(paths) {
  return paths.map((file, index) => {
    const bytes = require('node:fs').readFileSync(path.resolve(__dirname, '..', file));
    return {
      order: index + 1,
      path: file,
      byte_length: bytes.length,
      payload_digest: sha256(bytes),
      source_bytes_base64: bytes.toString('base64'),
    };
  });
}

function verifiedRoot() {
  const root = path.resolve(__dirname, '..');
  const result = spawnSync(process.execPath, ['scripts/verify-codex-program-spec.mjs'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.match(/PASS ([a-f0-9]{64})/)?.[1];
}

test('governing CODEX programme specification is mechanically valid', () => {
  assert.match(verifiedRoot(), /^[a-f0-9]{64}$/);
});

test('verifier root is the review-controller root for committed specification membership', () => {
  const manifest = JSON.parse(require('node:fs').readFileSync(
    path.resolve(__dirname, '..', MANIFEST_PATH),
    'utf8',
  ));
  const committedPaths = [MANIFEST_PATH, ...manifest.files.map(({ path: file }) => file)];
  assert.equal(verifiedRoot(), specificationRootFromMembers(membersFor(committedPaths)));
});

test('bootstrap-for-ledger membership substitution fails the committed root contract', () => {
  const manifest = JSON.parse(require('node:fs').readFileSync(
    path.resolve(__dirname, '..', MANIFEST_PATH),
    'utf8',
  ));
  const committedPaths = [MANIFEST_PATH, ...manifest.files.map(({ path: file }) => file)];
  const substitutedPaths = committedPaths.map((file) => (
    file === 'docs/codex-program/EXECUTION-LEDGER.md'
      ? 'docs/codex-program/bootstrap-acceptance-source.json'
      : file
  ));
  const root = verifiedRoot();
  assert.notEqual(specificationRootFromMembers(membersFor(substitutedPaths)), root);
  assert.throws(() => buildTrustedReviewPlan({
    controller_version: 'LOCAL_REVIEW_CONTROLLER/V1',
    controller_run_id: 'cold-review-root-regression',
    immutable_task_id: 'cold-review-root-regression',
    nonce: 'cold-review-root-regression',
    controller_key_id: 'PROGRAMME_GATE_REVIEW_CONTROLLER_2026_07',
    task_manifest: {
      manifest_version: 'TrustedReviewTaskManifest/V1',
      lane_id: 'ROOT_CONTRACT',
      exact_specification_root: root,
      frozen_specification: {
        manifest_id: 'codex-program-specification-manifest/v1',
        manifest_digest: membersFor([MANIFEST_PATH])[0].payload_digest,
        file_count: substitutedPaths.length,
        ordered_members: membersFor(substitutedPaths),
        immutable: true,
      },
      registered_prompt: {},
      output_schema: {},
    },
    runtime_context: {},
  }), /frozen specification bytes do not derive the exact specification root/);
});
