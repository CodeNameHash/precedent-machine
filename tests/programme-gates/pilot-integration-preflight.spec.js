const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  authorisedPaths,
  deriveSignerCoverage,
  runPilotIntegrationPreflight,
  validateSignerPolicyEvolution,
} = require('../../lib/programme-gates/pilot-integration-preflight');

const commit = 'a'.repeat(40);
const candidateCommit = 'c'.repeat(40);
const root = 'd'.repeat(64);
function input() { return { main: { head: commit, expected_commit: commit, is_expected_ancestor: true }, candidate: { head: candidateCommit }, worktrees: [{ clean: true }], changed_paths: ['a'], allowed_paths: ['a'], signer: { inventory_paths: ['a'], required_paths: ['a'] }, author: { email: 'bengoodchild@gmail.com', verified_aliases: [] }, publication: { commit, generation: 44 }, specification_root: root, evidence: { manifest: { schema_version: 'PilotIntegrationManifestReceipt/V1', candidate_commit: candidateCommit, specification_root: root, registered: true, actual_count: 3, expected_count: 3 }, development_compiles: { schema_version: 'PilotIntegrationCompileReceipt/V1', candidate_commit: candidateCommit, specification_root: root, compile_count: 2, success: true }, deployment: { schema_version: 'PilotIntegrationDeploymentReceipt/V1', candidate_commit: candidateCommit, specification_root: root, present: true }, test_receipts: { schema_version: 'PilotIntegrationTestReceipt/V1', candidate_commit: candidateCommit, specification_root: root, required_receipts: ['unit'], receipts: ['unit'] } } }; }
function hasCode(result, expected) { return result.stages.some((stage) => stage.blocker?.code === expected); }
test('preflight accepts exact supplied local integration basis without mutation', () => { const before = JSON.stringify(input()); const result = runPilotIntegrationPreflight(input()); assert.equal(result.state, 'READY_FOR_INTEGRATION'); assert.deepEqual(result.mutations, []); assert.equal(JSON.stringify(input()), before); });
test('permits an authorised historical path that is absent from the final diff', () => {
  const value = input();
  value.allowed_paths = ['a', 'historical-path.js'];
  assert.equal(runPilotIntegrationPreflight(value).stages[2].state, 'READY');
});
for (const [name, alter, expected] of [
  ['stale main', (x) => { x.main.head = 'b'.repeat(40); }, 'STALE_MAIN'], ['dirty worktree', (x) => { x.worktrees[0].clean = false; }, 'DIRTY_WORKTREE'], ['invented allowlist', (x) => { x.allowed_paths = ['b']; }, 'PATH_VIOLATION'], ['stale manifest/count', (x) => { x.evidence.manifest.actual_count = 2; }, 'STALE_MANIFEST_OR_COUNT'], ['fabricated compile assertion', (x) => { x.evidence.development_compiles.success = false; }, 'FORMAL_FREEZE_PACKAGE_REQUIRED'], ['signer omission', (x) => { x.signer.inventory_paths = []; }, 'SIGNER_PATH_OMISSION'], ['bad author email', (x) => { x.author.email = 'bad@example.com'; }, 'BAD_AUTHOR_EMAIL'], ['stale deployment commit', (x) => { x.evidence.deployment.candidate_commit = commit; }, 'DEPLOYMENT_METADATA_REQUIRED'], ['stale deployment root', (x) => { x.evidence.deployment.specification_root = 'e'.repeat(64); }, 'DEPLOYMENT_METADATA_REQUIRED'], ['stale test receipt', (x) => { x.evidence.test_receipts.candidate_commit = commit; }, 'STALE_PREDECESSOR_OR_MISSING_RECEIPT'], ['missing test receipt', (x) => { x.evidence.test_receipts.receipts = []; }, 'STALE_PREDECESSOR_OR_MISSING_RECEIPT'],
]) test(name, () => { const value = input(); alter(value); assert.equal(hasCode(runPilotIntegrationPreflight(value), expected), true); });
test('cache hit requires unchanged exact compiler input fingerprint', () => { const cache = new Map(); const first = runPilotIntegrationPreflight(input(), cache); const second = runPilotIntegrationPreflight(input(), cache); const changed = input(); changed.evidence.manifest.actual_count = 4; const third = runPilotIntegrationPreflight(changed, cache); assert.equal(first.stages[4].cache_hit, false); assert.equal(second.stages[4].cache_hit, true); assert.equal(third.stages[4].cache_hit, undefined); assert.notEqual(second.input_fingerprint, third.input_fingerprint); });
test('rejects a caller-supplied forged predecessor pair before evidence is read', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pilot-preflight-'));
  try {
    const inputPath = path.join(directory, 'input.json');
    fs.writeFileSync(inputPath, JSON.stringify({ additional_worktree_paths: [], evidence_paths: {}, publication: { commit: 'b'.repeat(40), generation: 1 } }));
    assert.throws(() => execFileSync(process.execPath, [path.resolve(__dirname, '../../scripts/pilot-integration-preflight.mjs'), '--input', inputPath], { cwd: path.resolve(__dirname, '../..'), stdio: 'pipe' }), /input must contain only/);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
test('accepts legacy allowedWrites as the exact phase permission set', () => {
  assert.deepEqual(authorisedPaths({ allowedWrites: ['lib/a.js', 'tests/a.test.js'] }), ['lib/a.js', 'tests/a.test.js']);
});
test('rejects an unknown allowlist shape as a path violation', () => {
  const value = input();
  value.allowlist_valid = false;
  assert.equal(hasCode(runPilotIntegrationPreflight(value), 'PATH_VIOLATION'), true);
});
test('derives signer coverage from the closed signer policy instead of caller claims', () => {
  const source = `
const REVIEW_BASIS_COMMIT = '${'b'.repeat(40)}';
const OWNER_AUTHORITY_ALLOWED_PATHS = Object.freeze([
  'allowed.js',
  'unused.js',
]);
`;
  assert.deepEqual(
    deriveSignerCoverage(source, ['missing.js', 'allowed.js']),
    {
      review_basis_commit: 'b'.repeat(40),
      allowed_paths: ['allowed.js', 'unused.js'],
      non_allowlist_source_digest:
        deriveSignerCoverage(source, []).non_allowlist_source_digest,
      inventory_paths: ['allowed.js'],
      required_paths: ['allowed.js', 'missing.js'],
    },
  );
});
test('rejects signer source without the closed policy declarations', () => {
  assert.throws(
    () => deriveSignerCoverage('const unrelated = true;', []),
    /does not expose the closed owner-authority policy/,
  );
});
test('permits only exact monotonic signer allowlist additions for required paths', () => {
  const trusted = `
const REVIEW_BASIS_COMMIT = '${'b'.repeat(40)}';
const OWNER_AUTHORITY_ALLOWED_PATHS = Object.freeze([
  'existing.js',
]);
const unchanged = true;
`;
  const candidate = trusted.replace(
    "  'existing.js',",
    "  'existing.js',\n  'required.js',",
  );
  assert.deepEqual(
    validateSignerPolicyEvolution(trusted, candidate, ['required.js'])
      .inventory_paths,
    ['required.js'],
  );
  assert.throws(
    () => validateSignerPolicyEvolution(
      trusted,
      candidate.replace('const unchanged = true;', 'const unchanged = false;'),
      ['required.js'],
    ),
    /changed protected policy/,
  );
  assert.throws(
    () => validateSignerPolicyEvolution(
      trusted,
      candidate.replace(
        "  'required.js',",
        "  'required.js',\n  'unrelated.js',",
      ),
      ['required.js'],
    ),
    /not the exact monotonic integration delta/,
  );
});
