const { canonicalJson, contentId } = require('./canonical-bytes');

const SCHEMA_VERSION = 'VERTICAL_SLICE_ATTESTATION/V1';
const EVIDENCE_CONTRACT = 'source-to-shared-row-and-bounded-query-vertical-slice/v1';
const TEST_FILE = 'tests/canonical-v2-p1-vertical-slice.test.js';
const CONTRACT_FINGERPRINT = '56da82bee06331793ba2ed8b78ef4186361407e60733595091e5951853e7d41d';
const PROJECT_REF = 'sjumbznveyyiizhwvixj';
const EXPECTED_RELEASE = Object.freeze({
  generation: 8,
  corpus_release_id: 'c9c19dc1ad92496953ee04f52b4a8dc575ea21ab9502acfd449a9299055817d3',
  serving_namespace_id: '9270602408312e80a65c0ce46b895fa2c8f07d1c676aef5bd171029edd209b68',
  candidate_manifest_id: '4e955c415bcb4c4e32e818bad11f82e48e247c3e12efee9a5e120d927a6ecf98',
  correction_input_seal_id: '7fe908d2a5e359f8f87bb8f72e204a90fa4e25a73da4f8588be1350f6ba2a8bd',
  correction_input_root: 'aa260ffdf873a51a93b23f6f85173de1a1183e21ade0668aa5a45977cb0f8012',
  candidate_release_import_plan_id: '4e6187aef580c1c083ed19cc6511af2586da7e028393a74dc34c60c7985898b5',
});
const EXPECTED_AUTHORITY = Object.freeze({
  input_generation: 1,
  candidate_input_head_id: '47e58bdccc8712e52538e001d69237cbe0d5c1d3ab4a8bdd5fcfac57439220bf',
  candidate_input_head_payload_digest: '6235cfd8f97babed44c1a4666008c239aec08983eb2d186bb00ad527a4f95c47',
  correction_discharge_map_id: '3adb162bbf57c85be369b8b819c81f7f2a42e9afa06b13f048e2dd01085af5d9',
  correction_discharge_map_payload_digest: 'c365c50625e6dc02d044b51087a7cb86d7c92477ff64c51477d948cdce7f180c',
});
const CASES = Object.freeze([
  'IMMUTABLE_SOURCE_AND_NESTED_DEFINITION',
  'REPRESENTATION_QUALIFIERS_BRINGDOWN_AND_MULTI_SPAN',
  'IOC_RELATIVE_MONEY_NORMALISATION',
  'DURATION_HOURS_TO_DAYS_WITH_DAY_BASIS',
  'NO_SHOP_ACTIONS_EXCEPTIONS_AND_MULTIPLE_VALUES',
  'REVIEWED_SOURCE_SPECIFIC_NON_COMPARABLE',
  'AUTHORITATIVE_WRITER_SINGLE_TRANSACTION',
  'SEALED_CANDIDATE_RELEASE',
  'BOUNDED_QUERY_SINGLE_RPC_AND_CACHE',
  'SHARED_ROW_FOUR_SURFACES',
  'SIBLING_RENDER_ISOLATION',
]);
const CLAIMS = Object.freeze([
  'all_fixture_cases_pass',
  'authoritative_writer_only',
  'bounded_query_pass',
  'sibling_render_isolation_pass',
]);
const DIGEST = /^[a-f0-9]{64}$/;

class VerticalSliceAttestationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'VerticalSliceAttestationError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new VerticalSliceAttestationError(code, message);
}

function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || canonicalJson(Object.keys(value).sort()) !== canonicalJson([...keys].sort())) {
    fail('INVALID_P1_EVIDENCE', `${label} fields do not match the closed contract.`);
  }
}

function exact(actual, expected, label) {
  if (canonicalJson(actual) !== canonicalJson(expected)) {
    fail('P1_EVIDENCE_DRIFT', `${label} does not match the reviewed vertical slice.`);
  }
}

function requireDigest(value, label) {
  if (!DIGEST.test(value || '')) fail('INVALID_P1_EVIDENCE', `${label} must be a SHA-256 digest.`);
}

function validateInputs(local, staging) {
  exactKeys(local, ['schema_version', 'test_file', 'test_file_sha256', 'command', 'exit_code', 'case_keys'], 'local execution');
  if (local.schema_version !== 'P1_LOCAL_EXECUTION/V1' || local.test_file !== TEST_FILE
    || local.exit_code !== 0) fail('P1_TEST_FAILED', 'the exact P1 test did not pass.');
  exact(local.command, ['node', '--test', TEST_FILE], 'test command');
  exact(local.case_keys, CASES, 'fixture case inventory');
  requireDigest(local.test_file_sha256, 'test_file_sha256');

  exactKeys(staging, ['schema_version', 'environment', 'project_ref', 'contract_fingerprint', 'active_release', 'authority', 'query', 'state_unchanged'], 'staging evidence');
  if (staging.schema_version !== 'P1_STAGING_EVIDENCE/V1' || staging.environment !== 'staging'
    || staging.project_ref !== PROJECT_REF || staging.contract_fingerprint !== CONTRACT_FINGERPRINT
    || staging.state_unchanged !== true) fail('INVALID_STAGING_BINDING', 'staging identity or stability proof failed.');
  exact(staging.active_release, EXPECTED_RELEASE, 'active release');
  exact(staging.authority, EXPECTED_AUTHORITY, 'candidate input authority');
  exactKeys(staging.query, ['rpc_name', 'rpc_call_count', 'first_read', 'second_read', 'page_size', 'page_count', 'total_count', 'returned_row_keys'], 'bounded query');
  if (staging.query.rpc_name !== 'canonical_v2_query_page' || staging.query.rpc_call_count !== 1
    || staging.query.first_read !== 'MISS' || staging.query.second_read !== 'HIT'
    || staging.query.page_size !== 25 || !Number.isInteger(staging.query.page_count)
    || staging.query.page_count < 1 || staging.query.page_count > 25
    || !Number.isInteger(staging.query.total_count) || staging.query.total_count < staging.query.page_count
    || staging.query.returned_row_keys.length !== staging.query.page_count
    || new Set(staging.query.returned_row_keys).size !== staging.query.returned_row_keys.length) {
    fail('UNBOUNDED_P1_QUERY', 'staging did not prove one bounded set-based read followed by a cache hit.');
  }
  staging.query.returned_row_keys.forEach((value) => requireDigest(value, 'returned_row_key'));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function buildVerticalSliceAttestation({ local_execution: local, staging_evidence: staging } = {}) {
  validateInputs(local, staging);
  const body = {
    schema_version: SCHEMA_VERSION,
    gate_id: 'P1_VERTICAL_SLICE_PASS',
    evidence_contract: EVIDENCE_CONTRACT,
    contract_fingerprint: CONTRACT_FINGERPRINT,
    fixture_cases: CASES,
    acceptance_claims: Object.fromEntries(CLAIMS.map((claim) => [claim, 'PASS'])),
    local_execution: local,
    staging_evidence: staging,
  };
  return deepFreeze({
    ...body,
    vertical_slice_attestation_id: contentId('VERTICAL_SLICE_ATTESTATION/V1', body),
  });
}

function validateVerticalSliceAttestation(value) {
  exactKeys(value, [
    'schema_version', 'gate_id', 'evidence_contract', 'contract_fingerprint', 'fixture_cases',
    'acceptance_claims', 'local_execution', 'staging_evidence', 'vertical_slice_attestation_id',
  ], 'vertical slice attestation');
  const rebuilt = buildVerticalSliceAttestation({
    local_execution: value.local_execution,
    staging_evidence: value.staging_evidence,
  });
  exact(value, rebuilt, 'vertical slice attestation');
  return true;
}

module.exports = {
  CASES,
  CONTRACT_FINGERPRINT,
  EXPECTED_AUTHORITY,
  EXPECTED_RELEASE,
  TEST_FILE,
  VerticalSliceAttestationError,
  buildVerticalSliceAttestation,
  validateVerticalSliceAttestation,
};
