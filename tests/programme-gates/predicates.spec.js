const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const YAML = require('yaml');

const registry = YAML.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../../docs/codex-program/programme-gates.yaml'),
    'utf8',
  ),
).programme_gate_registry;

test('every merge must pass the continuous mechanical gates', () => {
  assert.deepEqual(registry.merge_gates.required_for_every_merge, [
    'npm_test',
    'npm_run_build',
    'main_remains_deployable',
  ]);
  assert.deepEqual(registry.merge_gates.extraction_change, [
    'node_scripts_eval_js',
    'legal_semantic_diff_review',
  ]);
  assert.deepEqual(registry.merge_gates.registry_change, ['registry_drift_tests']);
  assert.deepEqual(registry.merge_gates.ingestion_change, ['ingest_qa_gates']);
  assert.deepEqual(registry.merge_gates.evidence_change, ['quote_verification_zero_flags']);
});

test('contract freeze requires mechanical closure, M1 review and Ben approval', () => {
  assert.deepEqual(registry.merge_gates.contract_freeze, [
    'two_uncached_compiles_byte_identical',
    'zero_missing_members',
    'zero_duplicate_identities',
    'zero_conflicts',
    'zero_dependency_cycles',
    'zero_unresolved_dependencies',
    'M1_ack_pass',
    'ben_exact_bundle_approval',
  ]);
});
