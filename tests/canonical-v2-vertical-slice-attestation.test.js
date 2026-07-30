const test = require('node:test');
const assert = require('node:assert/strict');

const {
  CASES,
  CONTRACT_FINGERPRINT,
  EXPECTED_AUTHORITY,
  EXPECTED_RELEASE,
  TEST_FILE,
  buildVerticalSliceAttestation,
  validateVerticalSliceAttestation,
} = require('../lib/canonical-v2/vertical-slice-attestation');

const buildVerticalSliceEvidence = buildVerticalSliceAttestation;
const validateVerticalSliceEvidence = validateVerticalSliceAttestation;

function evidence() {
  return {
    local_execution: {
      schema_version: 'P1_LOCAL_EXECUTION/V1',
      test_file: TEST_FILE,
      test_file_sha256: 'a'.repeat(64),
      command: ['node', '--test', TEST_FILE],
      exit_code: 0,
      case_keys: CASES,
    },
    staging_evidence: {
      schema_version: 'P1_STAGING_EVIDENCE/V1',
      environment: 'staging',
      project_ref: 'sjumbznveyyiizhwvixj',
      contract_fingerprint: CONTRACT_FINGERPRINT,
      active_release: EXPECTED_RELEASE,
      authority: EXPECTED_AUTHORITY,
      query: {
        rpc_name: 'canonical_v2_query_page',
        rpc_call_count: 1,
        first_read: 'MISS',
        second_read: 'HIT',
        page_size: 25,
        page_count: 1,
        total_count: 1,
        returned_row_keys: ['b'.repeat(64)],
      },
      state_unchanged: true,
    },
  };
}

test('vertical-slice evidence closes the exact fixture, writer, query and isolation claims', () => {
  const first = buildVerticalSliceEvidence(evidence());
  const second = buildVerticalSliceEvidence(evidence());
  assert.deepEqual(first, second);
  assert.equal(validateVerticalSliceEvidence(first), true);
  assert.deepEqual(first.acceptance_claims, {
    all_fixture_cases_pass: 'PASS',
    authoritative_writer_only: 'PASS',
    bounded_query_pass: 'PASS',
    sibling_render_isolation_pass: 'PASS',
  });
  assert.ok(Object.isFrozen(first));
  assert.ok(Object.isFrozen(first.local_execution));
});

test('vertical-slice evidence refuses incomplete, stale, unbounded or mutable input', () => {
  const cases = evidence();
  cases.local_execution.case_keys = CASES.slice(1);
  assert.throws(() => buildVerticalSliceEvidence(cases), /fixture case inventory/);

  const failed = evidence();
  failed.local_execution.exit_code = 1;
  assert.throws(() => buildVerticalSliceEvidence(failed), /did not pass/);

  const stale = evidence();
  stale.staging_evidence.active_release = { ...EXPECTED_RELEASE, generation: 7 };
  assert.throws(() => buildVerticalSliceEvidence(stale), /active release/);

  const broad = evidence();
  broad.staging_evidence.query.rpc_call_count = 2;
  assert.throws(() => buildVerticalSliceEvidence(broad), /bounded set-based read/);

  const duplicate = evidence();
  duplicate.staging_evidence.query.page_count = 2;
  duplicate.staging_evidence.query.total_count = 2;
  duplicate.staging_evidence.query.returned_row_keys = ['b'.repeat(64), 'b'.repeat(64)];
  assert.throws(() => buildVerticalSliceEvidence(duplicate), /bounded set-based read/);

  const moved = evidence();
  moved.staging_evidence.state_unchanged = false;
  assert.throws(() => buildVerticalSliceEvidence(moved), /stability proof/);
});
