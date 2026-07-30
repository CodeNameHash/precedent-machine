const assert = require('node:assert/strict');
const test = require('node:test');
const {
  deriveSignerCoverage,
  runPilotIntegrationPreflight,
} = require('../../lib/programme-gates/pilot-integration-preflight');

const commit = 'a'.repeat(40);
function input() { return { main: { head: commit, expected_commit: commit, is_expected_ancestor: true }, worktrees: [{ clean: true }], changed_paths: ['a'], allowed_paths: ['a'], manifest: { registered: true }, contracts: { actual_count: 3, expected_count: 3 }, compiler: { development_compiles: 2, success: true }, signer: { inventory_paths: ['a'], required_paths: ['a'] }, author: { email: 'bengoodchild@gmail.com', verified_aliases: [] }, deployment: { present: true, code_commit: commit, specification_root: 'root', expected_specification_root: 'root' }, publication: { commit, expected_predecessor_commit: commit, generation: 44, expected_generation: 44 }, test_receipts: ['unit'], required_test_receipts: ['unit'] }; }
function code(result) { return result.stages.find((stage) => stage.state === 'BLOCKED')?.blocker.code; }
test('preflight accepts exact supplied local integration basis without mutation', () => { const before = JSON.stringify(input()); const result = runPilotIntegrationPreflight(input()); assert.equal(result.state, 'READY_FOR_INTEGRATION'); assert.deepEqual(result.mutations, []); assert.equal(JSON.stringify(input()), before); });
for (const [name, alter, expected] of [
  ['stale main/publication', (x) => { x.main.head = 'b'.repeat(40); }, 'STALE_MAIN'], ['dirty worktree', (x) => { x.worktrees[0].clean = false; }, 'DIRTY_WORKTREE'], ['path violation', (x) => { x.changed_paths = ['b']; }, 'PATH_VIOLATION'], ['stale manifest/count', (x) => { x.contracts.actual_count = 2; }, 'STALE_MANIFEST_OR_COUNT'], ['bundle compile failure', (x) => { x.compiler.success = false; }, 'BUNDLE_COMPILE_FAILURE'], ['signer omission', (x) => { x.signer.inventory_paths = []; }, 'SIGNER_PATH_OMISSION'], ['bad author email', (x) => { x.author.email = 'bad@example.com'; }, 'BAD_AUTHOR_EMAIL'], ['wrong deployment metadata', (x) => { x.deployment.code_commit = 'b'.repeat(40); }, 'DEPLOYMENT_METADATA_MISMATCH'], ['stale predecessor', (x) => { x.publication.generation = 43; }, 'STALE_PREDECESSOR_OR_MISSING_RECEIPT'], ['missing test receipt', (x) => { x.test_receipts = []; }, 'STALE_PREDECESSOR_OR_MISSING_RECEIPT'],
]) test(name, () => { const value = input(); alter(value); assert.equal(code(runPilotIntegrationPreflight(value)), expected); });
test('cache hit requires unchanged exact compiler input fingerprint', () => { const cache = new Map(); const first = runPilotIntegrationPreflight(input(), cache); const second = runPilotIntegrationPreflight(input(), cache); const changed = input(); changed.contracts.actual_count = 4; const third = runPilotIntegrationPreflight(changed, cache); assert.equal(first.stages[4].cache_hit, false); assert.equal(second.stages[4].cache_hit, true); assert.equal(third.stages[4].cache_hit, false); assert.notEqual(second.input_fingerprint, third.input_fingerprint); });
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
