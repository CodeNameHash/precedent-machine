const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  buildTrustedReviewPlan,
  specificationRootFromMembers,
} = require('../lib/programme-gates/review-controller');
const {
  compileGoverningSpecificationMembers,
} = require('../lib/canonical-v2/canonical-contract-bundle-pre-review-package-assembler');

const MANIFEST_PATH = 'docs/codex-program/specification-manifest.json';
const COLD_REVIEW_RUNNER_PATH = 'scripts/run-g0-local-cold-reviews.mjs';

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
  const manifest = JSON.parse(require('node:fs').readFileSync(
    path.resolve(__dirname, '..', MANIFEST_PATH),
    'utf8',
  ));
  assert.equal(manifest.schema, 'codex-program-specification-manifest/v2');
  assert.equal(manifest.purpose, 'DRIFT_DETECTION_ONLY_NOT_EXECUTION_AUTHORITY');
  // Two, not six, since 2026-08-06. Four prose documents were unpinned: the
  // fingerprint exists to catch a governing file changing unnoticed, which is
  // worth having for data the application reads and was not worth having for
  // prose, where git already records every change and the fingerprints mainly
  // made stale documents expensive to correct. The two survivors are the gates
  // registry and the parity register, both genuinely read by lib/ code.
  assert.equal(manifest.files.length, 2);
});

test('verifier root is the review-controller root for committed specification membership', () => {
  const manifest = JSON.parse(require('node:fs').readFileSync(
    path.resolve(__dirname, '..', MANIFEST_PATH),
    'utf8',
  ));
  const committedPaths = [MANIFEST_PATH, ...manifest.files.map(({ path: file }) => file)];
  assert.equal(verifiedRoot(), specificationRootFromMembers(membersFor(committedPaths)));
});

test('cold review runner supplies the manifest-derived member count to the trusted plan', () => {
  const root = path.resolve(__dirname, '..');
  const manifest = JSON.parse(require('node:fs').readFileSync(
    path.join(root, MANIFEST_PATH),
    'utf8',
  ));
  const committedPaths = [MANIFEST_PATH, ...manifest.files.map(({ path: file }) => file)];
  const orderedMembers = membersFor(committedPaths);
  const runner = require('node:fs').readFileSync(path.join(root, COLD_REVIEW_RUNNER_PATH), 'utf8');
  const promptBytes = Buffer.from('review exact frozen specification');
  const schemaBytes = Buffer.from('{"type":"object"}');

  assert.match(runner, /file_count:\s*orderedSpecificationMembers\.length,/);
  assert.doesNotMatch(runner, /\bSPEC_PATHS\b/);

  const plan = buildTrustedReviewPlan({
    controller_version: 'LOCAL_REVIEW_CONTROLLER/V1',
    controller_run_id: 'cold-review-member-count',
    immutable_task_id: 'cold-review-member-count/ROOT_CONTRACT',
    nonce: 'cold-review-member-count',
    controller_key_id: 'PROGRAMME_GATE_REVIEW_CONTROLLER_2026_07',
    task_manifest: {
      manifest_version: 'TrustedReviewTaskManifest/V1',
      lane_id: 'ROOT_CONTRACT',
      exact_specification_root: specificationRootFromMembers(orderedMembers),
      frozen_specification: {
        manifest_id: 'codex-program-specification-manifest/v2',
        manifest_digest: orderedMembers[0].payload_digest,
        file_count: orderedMembers.length,
        ordered_members: orderedMembers,
        immutable: true,
      },
      registered_prompt: {
        prompt_id: 'ROOT_CONTRACT_PROMPT',
        path: '/private/tmp/g0-cold-review-test/root-contract/prompt.txt',
        payload_digest: sha256(promptBytes),
        byte_length: promptBytes.length,
        immutable: true,
        contains_prior_review_conclusions: false,
      },
      output_schema: {
        schema_id: 'ColdReviewOutput/V1',
        path: '/private/tmp/g0-cold-review-test/root-contract/output-schema.json',
        payload_digest: sha256(schemaBytes),
        byte_length: schemaBytes.length,
        source_bytes_base64: schemaBytes.toString('base64'),
        immutable: true,
      },
    },
    runtime_context: {
      context_version: 'TrustedReviewRuntimeContext/V1',
      review_runtime_binary_path: '/opt/homebrew/bin/codex',
      review_runtime_version: 'codex-cli/test',
      review_runtime_binary_digest: 'a'.repeat(64),
      controller_run_root: '/private/tmp/g0-cold-review-test',
      lane_run_root: '/private/tmp/g0-cold-review-test/root-contract',
      working_directory: '/private/tmp/g0-cold-review-test/root-contract/specification',
      operating_system: 'darwin',
      architecture: 'arm64',
      home_path: '/private/tmp/g0-cold-review-test/root-contract/home',
      codex_home_path: '/private/tmp/g0-cold-review-test/root-contract/codex-home',
      tmpdir_path: '/private/tmp/g0-cold-review-test/root-contract/tmp',
      path_value: '/opt/homebrew/bin:/usr/bin:/bin',
      lang: 'en_US.UTF-8',
      lc_all: 'en_US.UTF-8',
      term: 'dumb',
    },
  });

  assert.equal(plan.task_manifest.frozen_specification.file_count, orderedMembers.length);
});

test('bootstrap-for-ledger membership substitution fails the committed root contract', () => {
  const manifest = JSON.parse(require('node:fs').readFileSync(
    path.resolve(__dirname, '..', MANIFEST_PATH),
    'utf8',
  ));
  const committedPaths = [MANIFEST_PATH, ...manifest.files.map(({ path: file }) => file)];
  // Substitutes a member that is still pinned. This used to swap
  // EXECUTION-LEDGER.md, which was unpinned on 2026-08-06, making the
  // substitution a no-op and the assertion below vacuously false. The property
  // under test is unchanged: swapping any member for a different file must
  // change the specification root, so the fingerprint cannot be satisfied by a
  // different set of files.
  const substitutedPaths = committedPaths.map((file) => (
    file === 'docs/codex-program/programme-gates.yaml'
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
        manifest_id: 'codex-program-specification-manifest/v2',
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

test('pre-review member compiler accepts only the current three-member V2 manifest contract', () => {
  const manifest = JSON.parse(require('node:fs').readFileSync(
    path.resolve(__dirname, '..', MANIFEST_PATH),
    'utf8',
  ));
  const members = membersFor([MANIFEST_PATH, ...manifest.files.map(({ path: file }) => file)]);
  const compiled = compileGoverningSpecificationMembers(members);
  assert.equal(compiled.specification_root, verifiedRoot());

  const v1 = structuredClone(members);
  const v1Manifest = JSON.parse(Buffer.from(v1[0].source_bytes_base64, 'base64').toString('utf8'));
  v1Manifest.schema = 'codex-program-specification-manifest/v1';
  const bytes = Buffer.from(JSON.stringify(v1Manifest));
  v1[0] = {
    ...v1[0],
    byte_length: bytes.length,
    payload_digest: sha256(bytes),
    source_bytes_base64: bytes.toString('base64'),
  };
  assert.throws(
    () => compileGoverningSpecificationMembers(v1),
    /frozen root contract/,
  );
});
