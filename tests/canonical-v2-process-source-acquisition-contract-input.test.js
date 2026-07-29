const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  validateAuthoredProcessSourceAcquisitionInputs,
} = require('../lib/canonical-v2/process-source-acquisition-contract-input-validator');

const ROOT = path.join(
  __dirname,
  '../contracts/canonical-v2/successor',
);

function loadMember(relativePath) {
  const canonicalValue = JSON.parse(
    fs.readFileSync(path.join(ROOT, relativePath), 'utf8'),
  );
  return {
    object_kind: canonicalValue.object_kind,
    canonical_value: canonicalValue,
  };
}

function acquisitionMembers() {
  return [
    loadMember(
      'process/source-acquisition/external-source-acquisition-manifest.v1.json',
    ),
    loadMember(
      'process/source-acquisition/source-universe-completeness.v1.json',
    ),
  ];
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function byId(members, stableId) {
  return members.find(
    (member) => member.canonical_value.stable_id === stableId,
  ).canonical_value.definition;
}

test('validates the independent acquisition and completeness contracts', () => {
  const members = acquisitionMembers();
  assert.doesNotThrow(
    () => validateAuthoredProcessSourceAcquisitionInputs(members),
  );

  const manifest = byId(members, 'EXTERNAL_SOURCE_ACQUISITION_MANIFEST');
  assert.equal(
    manifest.production_acquisition_contract.sec_inventory_source,
    'COMPLETE_ISSUER_SUBMISSIONS_HISTORY',
  );
  assert.equal(
    manifest.sec_completeness_oracle_contract.inventory_source,
    'SEC_DAILY_OR_FULL_INDEXES',
  );
  assert.notEqual(
    manifest.production_acquisition_contract.source_path_key,
    manifest.sec_completeness_oracle_contract.oracle_path_key,
  );
  assert.equal(
    manifest.production_acquisition_contract.paginated_older_file_indexes_required,
    true,
  );
  assert.equal(
    manifest.sec_completeness_oracle_contract
      .can_consume_production_submissions_history,
    false,
  );
  assert.equal(
    manifest.sec_completeness_oracle_contract
      .same_governed_source_scope_rule_required,
    true,
  );
  assert.equal(
    manifest.sec_completeness_oracle_contract
      .shared_enumeration_output_permitted,
    false,
  );
});

test('requires exact accession, package, reference and receipt reconciliation', () => {
  const completeness = byId(
    acquisitionMembers(),
    'SOURCE_UNIVERSE_COMPLETENESS',
  );

  assert.equal(
    completeness.sec_reconciliation_contract.membership_rule,
    'EXACT_ACCESSION_SET_EQUALITY',
  );
  assert.equal(
    completeness.sec_reconciliation_contract.missing_accession_permitted,
    false,
  );
  assert.equal(
    completeness.sec_reconciliation_contract.extra_accession_permitted,
    false,
  );
  assert.equal(
    completeness.sec_reconciliation_contract.package_member_validation_required,
    true,
  );
  assert.equal(
    completeness.sec_reconciliation_contract
      .cross_document_reference_validation_required,
    true,
  );
  assert.equal(
    completeness.sec_reconciliation_contract
      .expected_fetch_receipt_validation_required,
    true,
  );
});

test('limits non-SEC and absence claims to the proved universe', () => {
  const members = acquisitionMembers();
  const manifest = byId(members, 'EXTERNAL_SOURCE_ACQUISITION_MANIFEST');
  const completeness = byId(members, 'SOURCE_UNIVERSE_COMPLETENESS');

  assert.equal(
    manifest.non_sec_source_contract
      .authority_specific_expected_source_manifest_required,
    true,
  );
  assert.equal(
    manifest.non_sec_source_contract
      .independent_completeness_limit_must_be_disclosed,
    true,
  );
  assert.equal(
    manifest.non_sec_source_contract
      .absence_claim_beyond_proved_universe_permitted,
    false,
  );
  assert.equal(
    completeness.absence_claim_contract.acquisition_completeness_required,
    true,
  );
  assert.equal(
    completeness.absence_claim_contract.admission_completeness_required,
    true,
  );
  assert.equal(
    completeness.absence_claim_contract.silence_can_establish_express_refusal,
    false,
  );
});

test('refuses catalogue shortcuts and unresolved expected sources', () => {
  const members = acquisitionMembers();
  const manifest = byId(members, 'EXTERNAL_SOURCE_ACQUISITION_MANIFEST');
  const completeness = byId(members, 'SOURCE_UNIVERSE_COMPLETENESS');

  assert.equal(
    manifest.expected_source_resolution_contract.unresolved_fetch_blocks_manifest,
    true,
  );
  assert.equal(
    manifest.expected_source_resolution_contract
      .reviewed_non_receipt_counts_as_verified_intake_receipt,
    false,
  );
  assert.equal(
    manifest.expected_source_resolution_contract
      .reviewed_non_receipt_must_propagate_coverage_limit,
    true,
  );
  assert.equal(
    completeness.completeness_state_contract
      .unresolved_blocks_semantic_discovery,
    true,
  );
  assert.deepEqual(
    Object.values(completeness.insufficient_basis_contract),
    [false, false, false, false, false],
  );
  assert.equal(
    manifest.downstream_binding_contract
      .gold_source_manifest_can_derive_from_extractor_output,
    false,
  );
});

test('grants no acquisition, admission, extraction, write, release or freeze authority', () => {
  for (const member of acquisitionMembers()) {
    assert.deepEqual(
      Object.values(member.canonical_value.definition.authority_contract),
      [false, false, false, false, false, false],
    );
  }
});

test('rejects missing, dependent and semantically weakened inputs', () => {
  assert.throws(
    () => validateAuthoredProcessSourceAcquisitionInputs(
      acquisitionMembers().slice(1),
    ),
    (error) => error.code === 'SOURCE_ACQUISITION_CONTRACT_MEMBERSHIP_MISMATCH',
  );

  const sharedPath = clone(acquisitionMembers());
  const sharedPathManifest = byId(
    sharedPath,
    'EXTERNAL_SOURCE_ACQUISITION_MANIFEST',
  );
  sharedPathManifest.sec_completeness_oracle_contract.oracle_path_key =
    sharedPathManifest.production_acquisition_contract.source_path_key;
  assert.throws(
    () => validateAuthoredProcessSourceAcquisitionInputs(sharedPath),
    (error) => error.code === 'INVALID_EXTERNAL_SOURCE_ACQUISITION_MANIFEST_INPUT',
  );

  const missingOlderIndexes = clone(acquisitionMembers());
  byId(
    missingOlderIndexes,
    'EXTERNAL_SOURCE_ACQUISITION_MANIFEST',
  ).production_acquisition_contract.paginated_older_file_indexes_required = false;
  assert.throws(
    () => validateAuthoredProcessSourceAcquisitionInputs(missingOlderIndexes),
    (error) => error.code === 'INVALID_EXTERNAL_SOURCE_ACQUISITION_MANIFEST_INPUT',
  );

  const partialMembership = clone(acquisitionMembers());
  byId(
    partialMembership,
    'SOURCE_UNIVERSE_COMPLETENESS',
  ).sec_reconciliation_contract.membership_rule = 'SUBSET';
  assert.throws(
    () => validateAuthoredProcessSourceAcquisitionInputs(partialMembership),
    (error) => error.code === 'INVALID_SOURCE_UNIVERSE_COMPLETENESS_INPUT',
  );

  const admittedOnly = clone(acquisitionMembers());
  byId(
    admittedOnly,
    'SOURCE_UNIVERSE_COMPLETENESS',
  ).insufficient_basis_contract
    .admitted_document_list_alone_can_establish_completeness = true;
  assert.throws(
    () => validateAuthoredProcessSourceAcquisitionInputs(admittedOnly),
    (error) => error.code === 'INVALID_SOURCE_UNIVERSE_COMPLETENESS_INPUT',
  );
});
