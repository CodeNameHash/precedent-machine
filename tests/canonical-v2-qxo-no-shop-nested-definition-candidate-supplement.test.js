const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {
  withoutF20RollbackOnlyCertification,
} = require('./helpers/canonical-v2-staging-runner-scope');

const { canonicalJson, contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  FIXTURE_CONTRACT_FINGERPRINT_V6,
  FIXTURE_SERVING_CONTRACT_FINGERPRINTS,
} = require('../lib/canonical-v2/contract-bundle');
const {
  CANDIDATE_SPECS,
  buildQxoNoShopNestedDefinitionCandidateSupplement,
  validateQxoNoShopNestedDefinitionCandidateSupplementCarrierIdentity,
} = require('../lib/canonical-v2/qxo-no-shop-nested-definition-candidate-supplement');

const MODULE =
  'lib/canonical-v2/qxo-no-shop-nested-definition-candidate-supplement.js';
const RUNNER = 'scripts/canonical-v2-staging-qxo-no-shop-clock-attestation.mjs';
const FIXTURE =
  'tests/fixtures/canonical-v2/qxo-no-shop-definitions-f6-staging-attestation.json';

function carrier() {
  const body = {
    schema_version: 'QXO_NO_SHOP_NESTED_DEFINITION_CANDIDATE_SUPPLEMENT/V1',
    authority_scope: 'OFFLINE_REVIEWED_QXO_NESTED_DEFINITION_CANDIDATES_ONLY',
    contract_binding: {},
    source_binding: {},
    parser_binding: {},
    supplemental_definition_candidates: [],
    status: {},
  };
  return {
    ...body,
    qxo_no_shop_nested_definition_candidate_supplement_id: contentId(
      'QXO_NO_SHOP_NESTED_DEFINITION_CANDIDATE_SUPPLEMENT/V1',
      body,
    ),
    canonical_payload_digest: contentId(
      'QXO_NO_SHOP_NESTED_DEFINITION_CANDIDATE_SUPPLEMENT_PAYLOAD/V1',
      body,
    ),
  };
}

test('the supplemental-candidate carrier is closed, bounded and deterministic', () => {
  const first = carrier();
  const second = carrier();
  assert.equal(canonicalJson(first), canonicalJson(second));
  assert.equal(
    validateQxoNoShopNestedDefinitionCandidateSupplementCarrierIdentity(first),
    true,
  );
  const changed = JSON.parse(JSON.stringify(first));
  changed.status.release_eligible = true;
  assert.throws(
    () => validateQxoNoShopNestedDefinitionCandidateSupplementCarrierIdentity(changed),
    /identity has drifted/i,
  );
  assert.throws(
    () => buildQxoNoShopNestedDefinitionCandidateSupplement({
      unknown_authority: true,
    }),
    /outside its closed contract/i,
  );
});

test('the exact two missed QXO definitions are source-pinned in staging', () => {
  const attestation = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  assert.equal(attestation.environment, 'STAGING');
  assert.equal(
    attestation.contract_binding.contract_fingerprint,
    FIXTURE_CONTRACT_FINGERPRINT_V6,
  );
  assert.deepEqual(
    attestation.supplemental_definition_candidates.map((candidate) => ({
      candidate_key: candidate.candidate_key,
      neutral_defined_term: candidate.neutral_defined_term,
      absolute_start: candidate.absolute_start,
      absolute_end: candidate.absolute_end,
    })),
    [
      {
        candidate_key: 'BASELINE_CONFIDENTIALITY_AGREEMENT',
        neutral_defined_term: 'Confidentiality Agreement',
        absolute_start: 207459,
        absolute_end: 207582,
      },
      {
        candidate_key: 'COMPANY_REQUEST',
        neutral_defined_term: 'Company Request',
        absolute_start: 208020,
        absolute_end: 208373,
      },
    ],
  );
  assert.equal(
    attestation.supplemental_definition_candidates.every(
      (candidate) => /^[a-f0-9]{64}$/.test(candidate.exact_bytes_digest)
        && /^[a-f0-9]{64}$/.test(
          candidate.reviewed_supplemental_definition_candidate_id,
        )
        && candidate.reviewed_disposition_required,
    ),
    true,
  );
  assert.deepEqual(
    CANDIDATE_SPECS.map((spec) => spec.candidate_key),
    ['BASELINE_CONFIDENTIALITY_AGREEMENT', 'COMPANY_REQUEST'],
  );
});

test('the supplement preserves the historical parser envelope unchanged', () => {
  const attestation = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  assert.equal(attestation.parser_binding.parser_runtime_candidates_mutated, false);
  assert.equal(attestation.parser_binding.parser_runtime_candidate_count, 39);
  assert.deepEqual(
    attestation.existing_section_4_3_definition_candidates.map(
      (candidate) => candidate.neutral_defined_term,
    ),
    [
      'Acceptable Confidentiality Agreement',
      'Company Acquisition Proposal',
      'Company Superior Proposal',
      'Company Intervening Event',
    ],
  );
  assert.equal(
    attestation.existing_section_4_3_definition_candidates.some(
      (candidate) => ['Confidentiality Agreement', 'Company Request']
        .includes(candidate.neutral_defined_term),
    ),
    false,
  );
  assert.equal(attestation.carrier_drift_rejected, true);
});

test('the candidate increment grants no graph, write, market or release authority', () => {
  const attestation = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  const status = attestation.supplement_status;
  assert.equal(status.source_reference_complete, true);
  assert.equal(status.reviewed_disposition_complete, false);
  assert.equal(status.publication_blocked, true);
  assert.equal(status.release_eligible, false);
  for (const key of [
    'definition_graph_authority',
    'parser_runtime_authority',
    'canonical_write_authority',
    'result_authority',
    'metric_authority',
    'comparability_authority',
    'query_authority',
    'serving_authority',
    'release_authority',
  ]) {
    assert.equal(status[key], 'NONE', key);
  }
  assert.equal(
    FIXTURE_SERVING_CONTRACT_FINGERPRINTS.includes(
      attestation.contract_binding.contract_fingerprint,
    ),
    false,
  );
});

test('the staging verification remains one bounded read with no write path', () => {
  const moduleSource = fs.readFileSync(MODULE, 'utf8');
  const runnerSource = withoutF20RollbackOnlyCertification(
    fs.readFileSync(RUNNER, 'utf8'),
  );
  assert.match(runnerSource, /--definitions-f6-print/);
  assert.match(runnerSource, /--definitions-f6-verify/);
  assert.match(runnerSource, /SELECT canonical_payload/);
  assert.match(runnerSource, /LIMIT 2/);
  assert.match(runnerSource, /timeout: 90_000/);
  assert.match(runnerSource, /MAX_RESPONSE_BYTES = 4 \* 1024 \* 1024/);
  assert.doesNotMatch(
    runnerSource,
    /\b(?:INSERT\s+INTO|UPDATE\s+[a-z_]|DELETE\s+FROM|UPSERT)\b/i,
  );
  assert.doesNotMatch(moduleSource, /canonical-writer|candidate-release|serving-projection|lib\/query/);
});
