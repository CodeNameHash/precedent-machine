const { canonicalJson } = require('./canonical-bytes');

const SOURCE_ACQUISITION_CONTRACT_INPUT_KIND =
  'SOURCE_ACQUISITION_CONTRACT_INPUT';
const SOURCE_ACQUISITION_CONTRACT_INPUT_SCHEMA =
  'SOURCE_ACQUISITION_CONTRACT_INPUT/V1';
const SOURCE_ACQUISITION_CONTRACT_IDS = Object.freeze([
  'EXTERNAL_SOURCE_ACQUISITION_MANIFEST',
  'SOURCE_UNIVERSE_COMPLETENESS',
]);

class ProcessSourceAcquisitionContractInputError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProcessSourceAcquisitionContractInputError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProcessSourceAcquisitionContractInputError(code, message, details);
}

function requireObject(value, label, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(code, `${label} must be an object.`);
  }
}

function requireExactKeys(value, expected, label, code) {
  requireObject(value, label, code);
  const actual = Object.keys(value).sort();
  const orderedExpected = [...expected].sort();
  if (canonicalJson(actual) !== canonicalJson(orderedExpected)) {
    fail(code, `${label} fields do not match the governed contract.`, {
      actual,
      expected: orderedExpected,
    });
  }
}

function requireExactArray(value, expected, label, code) {
  if (!Array.isArray(value) || canonicalJson(value) !== canonicalJson(expected)) {
    fail(code, `${label} does not match the governed ordered values.`, {
      actual: value,
      expected,
    });
  }
}

function requireExactObject(value, expected, label, code) {
  requireObject(value, label, code);
  if (canonicalJson(value) !== canonicalJson(expected)) {
    fail(code, `${label} does not match the governed value.`, {
      actual: value,
      expected,
    });
  }
}

function validateEnvelope(member, stableId, contractType) {
  const code = 'INVALID_SOURCE_ACQUISITION_CONTRACT_INPUT';
  const value = member.canonical_value;
  requireExactKeys(value, [
    'object_kind',
    'stable_id',
    'schema_version',
    'definition',
  ], 'Process source-acquisition input', code);
  if (
    value.object_kind !== SOURCE_ACQUISITION_CONTRACT_INPUT_KIND
    || value.schema_version !== SOURCE_ACQUISITION_CONTRACT_INPUT_SCHEMA
    || value.stable_id !== stableId
    || value.definition?.domain_key !== 'PROCESS'
    || value.definition?.contract_type !== contractType
    || value.definition?.contract_version !== 1
  ) {
    fail(code, 'The Process source-acquisition contract identity is not registered.');
  }
  return value.definition;
}

function requireNoAuthority(value, runtimeField, label, code) {
  requireExactObject(value, {
    [runtimeField]: false,
    creates_source_admission_authority: false,
    creates_extraction_authority: false,
    creates_writer_authority: false,
    creates_release_authority: false,
    creates_contract_freeze_authority: false,
  }, label, code);
}

function validateExternalSourceAcquisitionManifest(member) {
  const code = 'INVALID_EXTERNAL_SOURCE_ACQUISITION_MANIFEST_INPUT';
  const definition = validateEnvelope(
    member,
    'EXTERNAL_SOURCE_ACQUISITION_MANIFEST',
    'ACQUISITION_MANIFEST_DEFINITION',
  );
  requireExactKeys(definition, [
    'domain_key',
    'contract_type',
    'contract_version',
    'manifest_identity',
    'production_acquisition_contract',
    'sec_completeness_oracle_contract',
    'non_sec_source_contract',
    'expected_source_resolution_contract',
    'downstream_binding_contract',
    'authority_contract',
  ], 'External source acquisition manifest definition', code);
  requireExactObject(definition.manifest_identity, {
    stable_id_domain: 'EXTERNAL_SOURCE_ACQUISITION_MANIFEST/V1',
    stable_id_inputs: [
      'frozen_external_snapshot_identities',
      'intake_cutoff_attestation_id',
      'source_scope_rule_key_and_version',
      'production_source_inventory_digest',
      'sec_oracle_inventory_digest',
      'non_sec_expected_source_manifest_digests',
      'reconciliation_rule_key_and_version',
    ],
    runtime_fetch_order_is_identity_input: false,
  }, 'External source acquisition manifest identity', code);
  requireExactObject(definition.production_acquisition_contract, {
    source_path_key: 'PROCESS_PRODUCTION_ACQUISITION/V1',
    frozen_cutoff_required: true,
    relevant_source_classes: [
      'FILING',
      'AMENDMENT',
      'SUPPLEMENT',
      'EXHIBIT',
      'INCORPORATED_REFERENCE',
      'APPROVED_NON_SEC_SOURCE',
    ],
    sec_inventory_source: 'COMPLETE_ISSUER_SUBMISSIONS_HISTORY',
    paginated_older_file_indexes_required: true,
    recursive_package_traversal_required: true,
    recursive_cross_reference_traversal_required: true,
    governed_source_scope_rule_required: true,
    runtime_label_can_expand_or_narrow_scope: false,
    production_path_can_consume_sec_oracle_output: false,
  }, 'Production source-acquisition contract', code);
  requireExactObject(definition.sec_completeness_oracle_contract, {
    oracle_path_key: 'PROCESS_SEC_COMPLETENESS_ORACLE/V1',
    inventory_source: 'SEC_DAILY_OR_FULL_INDEXES',
    can_consume_production_submissions_history: false,
    implementation_independent_from_production_path: true,
    separate_executable_identity_required: true,
    same_governed_source_scope_rule_required: true,
    shared_enumeration_output_permitted: false,
    exact_accession_inventory_required: true,
  }, 'SEC completeness-oracle contract', code);
  if (
    definition.production_acquisition_contract.source_path_key
      === definition.sec_completeness_oracle_contract.oracle_path_key
  ) {
    fail(code, 'The production acquisition path and SEC oracle must be independent.');
  }
  requireExactObject(definition.non_sec_source_contract, {
    authority_specific_expected_source_manifest_required: true,
    frozen_external_snapshot_required: true,
    independent_completeness_limit_must_be_disclosed: true,
    absence_claim_beyond_proved_universe_permitted: false,
    manual_unmanifested_source_permitted: false,
  }, 'Non-SEC source contract', code);
  requireExactObject(definition.expected_source_resolution_contract, {
    terminal_dispositions: [
      'VERIFIED_INTAKE_RECEIPT',
      'REVIEWED_NON_RECEIPT',
    ],
    every_expected_source_requires_one_terminal_disposition: true,
    unresolved_fetch_blocks_manifest: true,
    reviewed_non_receipt_counts_as_verified_intake_receipt: false,
    reviewed_non_receipt_must_propagate_coverage_limit: true,
    duplicate_expected_source_permitted: false,
  }, 'Expected source resolution contract', code);
  requireExactObject(definition.downstream_binding_contract, {
    required_bindings: [
      'INTAKE_CUTOFF_ATTESTATION',
      'RECEIPT_EXPECTATIONS',
      'INTAKE_UNIVERSE_MANIFEST',
      'DEAL_ADMISSION',
      'CORPUS_SCOPE_MANIFEST',
      'CANDIDATE_RELEASE',
      'COVERAGE_METADATA',
      'END_TO_END_TRACEABILITY',
    ],
    feeds_existing_pm_intake: true,
    feeds_independent_deal_document_admission: true,
    gold_source_manifest_is_separately_frozen: true,
    gold_source_manifest_can_derive_from_extractor_output: false,
  }, 'Source-acquisition downstream binding', code);
  requireNoAuthority(
    definition.authority_contract,
    'creates_runtime_acquisition',
    'Source-acquisition authority',
    code,
  );
}

function validateSourceUniverseCompleteness(member) {
  const code = 'INVALID_SOURCE_UNIVERSE_COMPLETENESS_INPUT';
  const definition = validateEnvelope(
    member,
    'SOURCE_UNIVERSE_COMPLETENESS',
    'COMPLETENESS_RECONCILIATION_DEFINITION',
  );
  requireExactKeys(definition, [
    'domain_key',
    'contract_type',
    'contract_version',
    'input_contract',
    'sec_reconciliation_contract',
    'completeness_state_contract',
    'absence_claim_contract',
    'insufficient_basis_contract',
    'publication_contract',
    'authority_contract',
  ], 'Source universe completeness definition', code);
  requireExactObject(definition.input_contract, {
    acquisition_manifest_definition_stable_id:
      'EXTERNAL_SOURCE_ACQUISITION_MANIFEST',
    production_inventory_required: true,
    independent_sec_oracle_inventory_required: true,
    frozen_governed_source_scope_rule_required: true,
    non_sec_expected_source_manifests_required_where_applicable: true,
    complete_intake_receipt_and_disposition_inventory_required: true,
    complete_deal_document_admission_inventory_required: true,
  }, 'Source universe completeness inputs', code);
  requireExactObject(definition.sec_reconciliation_contract, {
    membership_rule: 'EXACT_ACCESSION_SET_EQUALITY',
    missing_accession_permitted: false,
    extra_accession_permitted: false,
    duplicate_accession_permitted: false,
    package_member_validation_required: true,
    cross_document_reference_validation_required: true,
    expected_fetch_receipt_validation_required: true,
    terminal_disposition_validation_required: true,
  }, 'SEC source reconciliation', code);
  requireExactObject(definition.completeness_state_contract, {
    states: [
      'COMPLETE',
      'INCOMPLETE',
      'UNRESOLVED',
    ],
    complete_requires_exact_reconciliation: true,
    complete_requires_no_unbounded_reviewed_non_receipt: true,
    incomplete_requires_source_backed_discrepancy: true,
    unresolved_fetch_or_disposition_is_unresolved: true,
    unresolved_blocks_semantic_discovery: true,
    incomplete_blocks_claimed_complete_scope: true,
  }, 'Source universe completeness states', code);
  requireExactObject(definition.absence_claim_contract, {
    acquisition_completeness_required: true,
    admission_completeness_required: true,
    non_sec_absence_limited_to_proved_universe: true,
    silence_can_establish_express_refusal: false,
    no_recorded_grant_requires_governed_interval: true,
  }, 'Source universe absence contract', code);
  requireExactObject(definition.insufficient_basis_contract, {
    eight_k_only_catalogue_can_establish_completeness: false,
    manually_curated_accession_list_can_establish_completeness: false,
    admitted_document_list_alone_can_establish_completeness: false,
    production_inventory_alone_can_establish_sec_completeness: false,
    oracle_inventory_alone_can_establish_acquisition_and_admission_completeness: false,
  }, 'Source universe insufficient bases', code);
  requireExactObject(definition.publication_contract, {
    manifest_and_reconciliation_identity_required: true,
    coverage_limit_must_be_published: true,
    release_pinned: true,
    candidate_release_membership_required: true,
    historical_release_immutable: true,
  }, 'Source universe publication contract', code);
  requireNoAuthority(
    definition.authority_contract,
    'creates_runtime_completeness',
    'Source universe completeness authority',
    code,
  );
}

function validateAuthoredProcessSourceAcquisitionInputs(authoredMembers) {
  if (!Array.isArray(authoredMembers)) {
    throw new TypeError('authoredMembers must be an array');
  }
  const members = authoredMembers.filter(
    (member) => member?.object_kind === SOURCE_ACQUISITION_CONTRACT_INPUT_KIND,
  );
  if (members.length === 0) return;

  const stableIds = members
    .map((member) => member.canonical_value?.stable_id)
    .sort();
  requireExactArray(
    stableIds,
    SOURCE_ACQUISITION_CONTRACT_IDS,
    'Source-acquisition contract member set',
    'SOURCE_ACQUISITION_CONTRACT_MEMBERSHIP_MISMATCH',
  );

  const validators = {
    EXTERNAL_SOURCE_ACQUISITION_MANIFEST:
      validateExternalSourceAcquisitionManifest,
    SOURCE_UNIVERSE_COMPLETENESS: validateSourceUniverseCompleteness,
  };
  for (const member of members) {
    validators[member.canonical_value.stable_id](member);
  }
}

module.exports = {
  SOURCE_ACQUISITION_CONTRACT_IDS,
  SOURCE_ACQUISITION_CONTRACT_INPUT_KIND,
  SOURCE_ACQUISITION_CONTRACT_INPUT_SCHEMA,
  ProcessSourceAcquisitionContractInputError,
  validateAuthoredProcessSourceAcquisitionInputs,
};
