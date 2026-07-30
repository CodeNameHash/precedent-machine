const { canonicalJson, sha256Hex } = require('./canonical-bytes');

const GOVERNED_RESIDUAL_CONTRACT_INPUT_KIND =
  'GOVERNED_RESIDUAL_CONTRACT_INPUT';
const GOVERNED_RESIDUAL_CONTRACT_INPUT_SCHEMA =
  'GOVERNED_RESIDUAL_CONTRACT_INPUT/V1';
const GOVERNED_RESIDUAL_CONTRACT_IDS = Object.freeze([
  'GOVERNED_RESIDUAL_DISPOSITION',
  'GOVERNED_RESIDUAL_IMPACT',
  'GOVERNED_RESIDUAL_OBSERVATION',
  'GOVERNED_RESIDUAL_PRODUCER_REGISTRY',
  'GOVERNED_RESIDUAL_REVIEW_QUEUE',
  'GOVERNED_RESIDUAL_UNIVERSE',
  'SEMANTIC_BOUNDARY_ADMISSION',
  'SEMANTIC_BOUNDARY_CONSUMPTION',
]);
const GOVERNED_RESIDUAL_CONTRACT_DEFINITIONS = Object.freeze({
  GOVERNED_RESIDUAL_DISPOSITION: Object.freeze({
    contract_type: 'GOVERNED_RESIDUAL_DISPOSITION_DEFINITION',
    definition_digest:
      'c3c7d2d7afeed13067181dbcc52e83d57aefb41f28922e760e2debc7c848c3f9',
  }),
  GOVERNED_RESIDUAL_IMPACT: Object.freeze({
    contract_type: 'GOVERNED_RESIDUAL_IMPACT_DEFINITION',
    definition_digest:
      'fa1811a00a4d1873a975c57f2f9e457f54057cc759e220c05cba1d9a9e9afa8c',
  }),
  GOVERNED_RESIDUAL_OBSERVATION: Object.freeze({
    contract_type: 'GOVERNED_RESIDUAL_OBSERVATION_DEFINITION',
    definition_digest:
      'bd4dc7df159f49e22c8e639ad74d4b0a856cf86003481f9bcc1fe3cca0c8162b',
  }),
  GOVERNED_RESIDUAL_PRODUCER_REGISTRY: Object.freeze({
    contract_type: 'GOVERNED_RESIDUAL_PRODUCER_REGISTRY_DEFINITION',
    definition_digest:
      'f0fbca794799c6045c8bf6dcbbbe7d35940fc5881af90959113c3d86dea76258',
  }),
  GOVERNED_RESIDUAL_REVIEW_QUEUE: Object.freeze({
    contract_type: 'GOVERNED_RESIDUAL_REVIEW_QUEUE_DEFINITION',
    definition_digest:
      '4b33544d6887218e4bae5afc6772025f5fcee8f0a3798d62835511a7458ef16e',
  }),
  GOVERNED_RESIDUAL_UNIVERSE: Object.freeze({
    contract_type: 'GOVERNED_RESIDUAL_UNIVERSE_DEFINITION',
    definition_digest:
      '9a2aa53538436840f2b30557b37b8968963aa5e49e06c61cf0c9c9b219ad01f6',
  }),
  SEMANTIC_BOUNDARY_ADMISSION: Object.freeze({
    contract_type: 'SEMANTIC_BOUNDARY_ADMISSION_DEFINITION',
    definition_digest:
      'e1a455662a1a54f5a9bfcd994d05e855734c8394924f753e13c43bbc3709738c',
  }),
  SEMANTIC_BOUNDARY_CONSUMPTION: Object.freeze({
    contract_type: 'SEMANTIC_BOUNDARY_CONSUMPTION_DEFINITION',
    definition_digest:
      'e305cfa321e163ba83eb8228c3143354eb49c3939cdcedbece1c05cb2a8dbd96',
  }),
});

const AUTHORITY_KEYS = Object.freeze([
  'definition_only',
  'creates_runtime_authority',
  'creates_extraction_authority',
  'creates_database_authority',
  'creates_writer_execution_authority',
  'creates_serving_authority',
  'creates_release_authority',
  'creates_import_authority',
  'creates_activation_authority',
  'creates_production_authority',
  'creates_contract_freeze_authority',
]);
const ENUMERATOR_AUTHORITIES = Object.freeze([
  'SEMANTIC_STAGE_REGISTRY',
  'CANONICAL_WRITER_DISPOSITION_REGISTRY',
  'PHYSICAL_CARRIER_SCHEMA_REGISTRY',
  'GENERATED_STAGE_OUTPUT_AND_WRITE_DISPOSITION_MANIFESTS',
]);
const PRODUCER_ENTRIES = Object.freeze([
  ['INTAKE_CAPTURE', 'PRE_SCOPE', ['INTAKE_REJECTION', 'PACKAGE_EXPANSION_REJECTION']],
  ['SOURCE_CONVERSION', 'PRE_SCOPE', ['SOURCE_CONVERSION_REJECTION', 'SOURCE_MAP_REJECTION']],
  ['SOURCE_ADMISSION', 'PRE_SCOPE', ['SOURCE_ADMISSION_REJECTION']],
  ['INFERENCE_REVIEW', 'PRE_SCOPE', ['MODEL_OBSERVATION_REJECTION', 'REVIEWED_INFERENCE_REJECTION']],
  ['GRAPH_NORMALISATION', 'PRE_SCOPE', ['NORMALISER_INPUT_REJECTION', 'GRAPH_VALIDATION_REJECTION']],
  ['LEGAL_DISCOVERY', 'PRE_SCOPE', ['DISCOVERY_COVERAGE_REJECTION', 'LEGAL_DIMENSION_MAPPING_REJECTION']],
  ['TAXONOMY_VALIDATION', 'PRE_SCOPE', ['TAXONOMY_CODE_REJECTION', 'UNKNOWN_SEMANTIC_KIND']],
  ['EXTRACTION_VALIDATION', 'CANDIDATE_COMPLETE', ['EXTRACTION_OUTPUT_REJECTION', 'COMPOSITION_INPUT_REJECTION']],
  ['WRITER_PREPARATION_VALIDATION', 'CANDIDATE_COMPLETE', ['WRITER_INPUT_REJECTION', 'WRITE_DISPOSITION_REJECTION']],
  ['CANDIDATE_CERTIFICATION', 'CANDIDATE_COMPLETE', ['CANDIDATE_OUTPUT_REJECTION', 'CANDIDATE_CERTIFICATION_REJECTION']],
]);
const TERMINAL_KINDS = Object.freeze([
  'GOVERNED_OBJECT',
  'OPEN_WORLD_CANDIDATE',
  'AFFIRMATIVE_NON_SUBSTANTIVE_DECISION',
  'GOVERNED_RESIDUAL_OBSERVATION',
]);
const FINAL_DISPOSITIONS = Object.freeze([
  'COVERED_BY_GOVERNED_OBJECT',
  'COVERED_BY_OPEN_WORLD_CANDIDATE',
  'REVIEWED_NON_SUBSTANTIVE_OR_INVALID',
  'REVIEWED_DUPLICATE',
]);

class GovernedResidualContractInputError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'GovernedResidualContractInputError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new GovernedResidualContractInputError(code, message, details);
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

function requireExact(value, expected, label, code) {
  let matches = false;
  try {
    matches = canonicalJson(value) === canonicalJson(expected);
  } catch (_) {
    matches = false;
  }
  if (!matches) {
    fail(code, `${label} does not match the governed contract.`, {
      actual: value,
      expected,
    });
  }
}

function requireFlags(value, requiredTrue, requiredFalse, label, code) {
  requireObject(value, label, code);
  for (const key of requiredTrue) {
    if (value[key] !== true) {
      fail(code, `${label}.${key} must be true.`);
    }
  }
  for (const key of requiredFalse) {
    if (value[key] !== false) {
      fail(code, `${label}.${key} must be false.`);
    }
  }
}

function validateAuthorityContract(authority, stableId) {
  const code = 'GOVERNED_RESIDUAL_AUTHORITY_ESCALATION';
  requireExactKeys(
    authority,
    AUTHORITY_KEYS,
    `${stableId} authority contract`,
    code,
  );
  requireFlags(
    authority,
    ['definition_only'],
    AUTHORITY_KEYS.filter((key) => key !== 'definition_only'),
    `${stableId} authority contract`,
    code,
  );
}

function validateMemberIdentity(member) {
  const code = 'INVALID_GOVERNED_RESIDUAL_CONTRACT_INPUT';
  requireObject(member, 'Governed residual authored member', code);
  const value = member.canonical_value;
  requireExactKeys(
    value,
    ['object_kind', 'stable_id', 'schema_version', 'definition'],
    'Governed residual contract input',
    code,
  );
  const registered = GOVERNED_RESIDUAL_CONTRACT_DEFINITIONS[value.stable_id];
  if (
    !registered
    || member.object_kind !== GOVERNED_RESIDUAL_CONTRACT_INPUT_KIND
    || value.object_kind !== GOVERNED_RESIDUAL_CONTRACT_INPUT_KIND
    || value.schema_version !== GOVERNED_RESIDUAL_CONTRACT_INPUT_SCHEMA
    || value.definition?.domain_key !== 'GOVERNANCE'
    || value.definition?.contract_type !== registered.contract_type
    || value.definition?.contract_version !== 1
  ) {
    fail(code, 'The governed residual contract identity is not registered.', {
      stable_id: value?.stable_id,
    });
  }
  validateAuthorityContract(value.definition.authority_contract, value.stable_id);
  return value;
}

function validateProducer(definition) {
  const code = 'GOVERNED_RESIDUAL_PRODUCER_TOTALITY_MISMATCH';
  const pilot = definition.pilot_scope_contract;
  const registry = definition.producer_registry_contract;
  requireExact(pilot.allowed_deal_keys, ['METSERA', 'QXO'], 'Pilot deal scope', code);
  requireFlags(
    pilot,
    ['isolated_staging_only', 'exact_source_universe_manifest_required'],
    ['scope_widening_permitted', 'production_source_access_permitted'],
    'Pilot scope contract',
    code,
  );
  requireExact(
    registry.registry_authority_sources,
    ENUMERATOR_AUTHORITIES,
    'Producer registry authorities',
    code,
  );
  const expectedEntries = PRODUCER_ENTRIES.map(
    ([producer_kind, first_eligible_scope, residual_capable_boundaries]) => ({
      producer_kind,
      producer_version: 1,
      first_eligible_scope,
      residual_capable_boundaries,
      residual_carrier_schema_id: 'GOVERNED_RESIDUAL_OBSERVATION/V1',
      source_backed_evidence_required: true,
    }),
  );
  requireExact(
    registry.closed_producer_entries,
    expectedEntries,
    'Closed residual producer entries',
    code,
  );
  const boundaries = registry.closed_producer_entries.flatMap(
    (entry) => entry.residual_capable_boundaries,
  );
  if (new Set(boundaries).size !== boundaries.length) {
    fail(code, 'Each residual-capable boundary must have one producer.');
  }
  requireFlags(
    registry,
    [
      'every_residual_capable_boundary_has_exactly_one_entry',
      'every_residual_carrier_has_exactly_one_entry',
      'boundary_and_carrier_bidirectional_equality_required',
    ],
    [
      'unregistered_producer_permitted',
      'unregistered_boundary_or_carrier_permitted',
      'producer_scope_reassignment_permitted',
      'generic_warning_substitution_permitted',
    ],
    'Producer registry',
    code,
  );
}

function validateObservation(definition) {
  const code = 'GOVERNED_RESIDUAL_OBSERVATION_LINEAGE_MISMATCH';
  const observation = definition.observation_contract;
  const identity = definition.identity_contract;
  requireExact(
    observation.required_payload_fields,
    [
      'governing_contract_fingerprint',
      'producer_kind',
      'producer_version',
      'immutable_source_or_governed_subject',
      'ordered_evidence_spans_or_explicit_no_span_source',
      'neutral_residual_kind',
      'raw_value_or_bytes',
      'validation_details',
      'complete_provenance',
      'proposed_object_or_candidate_links',
      'governed_ordinal',
    ],
    'Residual observation payload',
    code,
  );
  requireFlags(
    observation,
    [
      'raw_value_or_bytes_must_be_retained',
      'source_backed_evidence_required',
      'explicit_no_span_requires_source_reference_and_reason',
      'complete_provenance_required',
      'proposed_object_or_candidate_links_required_even_when_empty',
    ],
    [
      'string_only_warning_permitted',
      'silent_drop_permitted',
      'unresolved_ordinal_permitted',
    ],
    'Residual observation',
    code,
  );
  requireExact(
    identity.required_identity_inputs,
    [
      'governing_contract_fingerprint',
      'producer_kind',
      'producer_version',
      'immutable_source_or_governed_subject',
      'ordered_evidence_span_identities_or_explicit_no_span_source',
      'neutral_residual_kind',
      'raw_value_or_bytes_digest',
      'governed_ordinal',
    ],
    'Residual observation identity',
    code,
  );
  requireFlags(
    identity,
    ['same_source_semantics_reproduce_identity', 'changed_raw_bytes_rekey_observation'],
    ['review_or_impact_state_rekeys_observation'],
    'Residual observation identity',
    code,
  );
}

function validateAdmission(definition) {
  const code = 'SEMANTIC_BOUNDARY_ADMISSION_CONTRACT_MISMATCH';
  const slots = definition.slot_registry_contract;
  const admission = definition.admission_contract;
  requireExact(
    slots.generated_from_authorities,
    ENUMERATOR_AUTHORITIES,
    'Admission slot authorities',
    code,
  );
  requireExact(
    slots.required_entry_fields,
    [
      'boundary_kind',
      'input_atom_key_extractor',
      'source_coordinate_rule',
      'first_eligible_scope',
      'terminal_kind_domain',
    ],
    'Admission slot entry fields',
    code,
  );
  requireFlags(
    slots,
    ['bidirectional_equality_with_residual_capable_boundary_universe_required'],
    ['unknown_boundary_or_slot_permitted'],
    'Admission slot registry',
    code,
  );
  if (
    admission.registered_producer_kinds_source
      !== 'GOVERNED_RESIDUAL_PRODUCER_REGISTRY'
  ) {
    fail(code, 'Admission must bind the governed residual producer registry.');
  }
  requireFlags(
    admission,
    [
      'one_receipt_per_exact_input_atom',
      'receipt_precedes_semantic_producer',
      'receipt_precedes_governed_carrier_candidate_decision_or_residual',
      'receipt_binds_exact_source_coordinates_or_governed_no_span',
      'receipt_binds_exact_boundary_and_input_atom',
      'receipt_binds_raw_digest',
    ],
    ['missing_receipt_permitted', 'duplicate_receipt_permitted'],
    'Admission receipt',
    code,
  );
}

function validateConsumption(definition) {
  const code = 'SEMANTIC_BOUNDARY_CONSUMPTION_CONTRACT_MISMATCH';
  const consumption = definition.consumption_contract;
  const reconciliation = definition.reconciliation_contract;
  requireExact(
    consumption.closed_terminal_kinds,
    TERMINAL_KINDS,
    'Semantic terminal kinds',
    code,
  );
  requireFlags(
    consumption,
    [
      'each_admission_has_exactly_one_terminal_consumption',
      'terminal_consumption_binds_receipt_id_and_payload_digest',
      'terminal_consumption_binds_terminal_id_and_payload_digest',
      'terminal_consumption_binds_producer_action_and_receipt',
    ],
    [
      'missing_consumption_permitted',
      'duplicate_or_multiple_consumption_permitted',
      'unregistered_terminal_kind_permitted',
    ],
    'Terminal consumption',
    code,
  );
  requireExact(
    reconciliation.required_empty_difference_roots,
    [
      'missing_root',
      'extra_root',
      'duplicate_root',
      'multiply_consumed_root',
      'wrong_terminal_kind_root',
      'unconsumed_root',
    ],
    'Consumption difference roots',
    code,
  );
  requireFlags(
    reconciliation,
    [
      'one_to_one_receipt_key_join_required',
      'implementation_disjoint_recorder_and_enumerator_required',
      'root_sets_require_complete_subject_key_universe',
      'pre_scope_selects_only_pre_scope_prefix',
      'candidate_complete_selects_pre_scope_and_adds_suffix_once',
    ],
    [],
    'Consumption reconciliation',
    code,
  );
}

function validateUniverse(definition) {
  const code = 'GOVERNED_RESIDUAL_UNIVERSE_CONTRACT_MISMATCH';
  const universe = definition.universe_contract;
  const manifest = definition.manifest_contract;
  requireExact(
    universe.scope_codes,
    ['PRE_SCOPE', 'CANDIDATE_COMPLETE'],
    'Residual universe scopes',
    code,
  );
  if (universe.first_enumerator_authority !== 'GOVERNED_RESIDUAL_PRODUCER_REGISTRY') {
    fail(code, 'The first universe enumerator must use the producer registry.');
  }
  requireExact(
    universe.second_enumerator_authorities,
    ENUMERATOR_AUTHORITIES,
    'Independent boundary enumerator authorities',
    code,
  );
  requireFlags(
    universe,
    [
      'second_enumerator_must_not_read_producer_registry',
      'enumerator_implementation_configuration_and_authority_independence_required',
      'bidirectional_identity_and_payload_equality_required',
      'pre_scope_predecessor_or_genesis_required',
      'pre_scope_excludes_extraction_and_candidate_prefix',
      'candidate_complete_selects_exact_pre_scope_manifest',
      'candidate_complete_adds_extraction_and_candidate_prefix_once',
    ],
    [
      'phase_reassignment_permitted',
      'unregistered_carrier_permitted',
      'unregistered_producer_permitted',
    ],
    'Residual universe',
    code,
  );
  requireExact(
    manifest.required_bindings,
    [
      'frozen_contract_pair',
      'scope_code',
      'pre_scope_predecessor_manifest_id_and_payload_digest_or_genesis',
      'captured_terminal_head_tuple',
      'producer_enumeration_authority_root_id',
      'producer_enumeration_authority_root_payload_digest',
      'boundary_enumeration_authority_root_id',
      'boundary_enumeration_authority_root_payload_digest',
      'universe_reconciliation_id',
      'universe_reconciliation_payload_digest',
      'producer_registry_id',
      'producer_registry_payload_digest',
      'admission_receipt_root_set_id',
      'admission_receipt_root_set_payload_digest',
      'terminal_consumption_root_set_id',
      'terminal_consumption_root_set_payload_digest',
      'consumption_reconciliation_set_root_id',
      'consumption_reconciliation_set_root_payload_digest',
      'ordered_residual_id_and_payload_digest_set',
    ],
    'Residual universe manifest bindings',
    code,
  );
  requireExact(
    manifest.required_empty_difference_roots,
    [
      'missing_root',
      'extra_root',
      'duplicate_root',
      'conflicting_payload_root',
      'unregistered_carrier_root',
      'unregistered_producer_root',
      'wrong_scope_prefix_root',
      'admission_consumption_mismatch_root',
    ],
    'Residual universe difference roots',
    code,
  );
  requireFlags(
    manifest,
    ['all_root_ids_bind_payload_digests'],
    ['count_only_completeness_permitted', 'open_world_candidate_universe_substitution_permitted'],
    'Residual universe manifest',
    code,
  );
}

function validateDisposition(definition) {
  const code = 'GOVERNED_RESIDUAL_DISPOSITION_CONTRACT_MISMATCH';
  const disposition = definition.disposition_contract;
  const duplicate = definition.duplicate_contract;
  const review = definition.review_decision_contract;
  const manifest = definition.manifest_contract;
  requireExact(
    disposition.closed_final_dispositions,
    FINAL_DISPOSITIONS,
    'Final residual dispositions',
    code,
  );
  requireExact(
    disposition.required_target_bindings_by_disposition,
    {
      COVERED_BY_GOVERNED_OBJECT: [
        'governed_object_id',
        'governed_object_payload_digest',
      ],
      COVERED_BY_OPEN_WORLD_CANDIDATE: [
        'open_world_candidate_id',
        'open_world_candidate_payload_digest',
      ],
      REVIEWED_NON_SUBSTANTIVE_OR_INVALID: [
        'affirmative_non_substantive_decision_id',
        'affirmative_non_substantive_decision_payload_digest',
      ],
      REVIEWED_DUPLICATE: [
        'earliest_equivalent_residual_id',
        'earliest_equivalent_residual_payload_digest',
      ],
    },
    'Disposition target bindings',
    code,
  );
  requireFlags(
    disposition,
    [
      'one_final_disposition_per_effective_residual',
      'exact_residual_and_target_identity_required',
      'source_and_evidence_closure_required',
    ],
    [
      'caller_supplied_disposition_permitted',
      'unknown_disposition_permitted',
      'terminal_disposition_erases_residual_permitted',
      'terminal_disposition_implies_impact_clearance',
    ],
    'Residual disposition',
    code,
  );
  requireFlags(
    duplicate,
    [
      'links_must_target_earliest_equivalent_residual',
      'duplicate_chains_are_flattened',
      'duplicate_inherits_target_disposition',
      'duplicate_inherits_target_link',
      'duplicate_inherits_target_impact',
    ],
    ['cycles_permitted', 'forward_links_permitted'],
    'Duplicate residual contract',
    code,
  );
  requireExact(
    review.required_signed_body_bindings,
    [
      'frozen_contract_pair',
      'scope_code',
      'residual_id',
      'residual_payload_digest',
      'final_disposition',
      'exact_target_id',
      'exact_target_payload_digest',
      'evidence_closure_id',
      'evidence_closure_payload_digest',
      'reviewer_principal_id',
      'review_time',
      'legal_semantic_review_policy_id',
      'legal_semantic_review_policy_payload_digest',
      'legal_reviewer_trust_registry_id',
      'legal_reviewer_trust_registry_payload_digest',
      'signing_revocation_head_id',
      'signing_revocation_head_payload_digest',
    ],
    'Signed review decision bindings',
    code,
  );
  if (
    review.required_eligibility_action !== 'RESIDUAL_FINAL_DISPOSITION'
    || review.legal_semantic_review_policy_stable_id !== 'LEGAL_SEMANTIC_REVIEW_POLICY'
    || review.legal_reviewer_trust_registry_stable_id !== 'LEGAL_REVIEWER_TRUST_REGISTRY'
  ) {
    fail(code, 'The residual review authority is cross-wired.');
  }
  requireFlags(
    review,
    [
      'eligibility_proof_required',
      'current_revocation_head_recheck_required',
      'review_decision_signature_required',
    ],
    ['cross_residual_or_cross_target_decision_reuse_permitted'],
    'Residual review decision',
    code,
  );
  requireFlags(
    manifest,
    [
      'complete_universe_manifest_required',
      'exact_one_to_one_universe_partition_required',
      'ordered_residual_and_disposition_pairs_required',
      'historical_duplicate_links_retained',
    ],
    ['count_only_completeness_permitted'],
    'Residual disposition manifest',
    code,
  );
  requireExact(
    manifest.required_empty_difference_roots,
    ['missing_root', 'extra_root', 'duplicate_root', 'conflict_root', 'invalid_link_root'],
    'Disposition difference roots',
    code,
  );
}

function validateImpact(definition) {
  const code = 'GOVERNED_RESIDUAL_IMPACT_CONTRACT_MISMATCH';
  const governed = definition.governed_object_impact_contract;
  const finalImpact = definition.final_residual_impact_contract;
  const projections = definition.projection_reconciliation_contract;
  const effect = definition.pilot_effect_contract;
  requireExact(
    governed.closed_closure_states,
    [
      'FULLY_INCORPORATED',
      'AFFECTS_CANONICAL_RESULT',
      'AFFECTS_CORPUS_SCOPE',
      'AFFECTS_CANONICAL_CONTRACT',
    ],
    'Governed-object impact states',
    code,
  );
  if (
    governed.first_walker_authority === governed.second_walker_authority
    || governed.first_walker_authority !== 'CANONICAL_OBJECT_DEPENDENCY_GRAPH'
    || governed.second_walker_authority
      !== 'CANONICAL_WRITER_AND_DERIVED_OBJECT_REFERENCE_UNIVERSE'
  ) {
    fail(code, 'The governed-object impact walkers are not independent.');
  }
  requireFlags(
    governed,
    [
      'exactly_two_governed_object_walkers_required',
      'walker_implementation_and_authority_independence_required',
      'signed_independence_attestation_required',
      'third_reconciler_independent_of_both_walkers',
      'bidirectional_affected_object_equality_required',
      'transitive_dependency_closure_required',
      'stale_dependant_detection_required',
      'walker_disagreement_blocks_closure',
    ],
    [],
    'Governed-object impact closure',
    code,
  );
  requireExact(
    finalImpact.branch_by_final_disposition,
    {
      COVERED_BY_GOVERNED_OBJECT: 'GOVERNED_OBJECT_IMPACT_CLOSURE',
      COVERED_BY_OPEN_WORLD_CANDIDATE: 'SEMANTIC_IMPACT_CLOSURE',
      REVIEWED_NON_SUBSTANTIVE_OR_INVALID: 'TYPED_NON_SUBSTANTIVE_ZERO_IMPACT',
      REVIEWED_DUPLICATE: 'INHERITED_EARLIEST_EQUIVALENT_RESIDUAL_IMPACT',
    },
    'Residual impact branches',
    code,
  );
  requireExact(
    finalImpact.closed_final_impact_states,
    [
      'ZERO_ADDITIONAL_IMPACT_FULLY_INCORPORATED',
      'ZERO_IMPACT_REVIEWED_NON_SUBSTANTIVE_OR_INVALID',
      'ISOLATED_SOURCE_SPECIFIC',
      'AFFECTS_CANONICAL_RESULT',
      'AFFECTS_CORPUS_SCOPE',
      'AFFECTS_CANONICAL_CONTRACT',
    ],
    'Final residual impact states',
    code,
  );
  requireFlags(
    finalImpact,
    [
      'candidate_branch_requires_semantic_impact_closure',
      'non_substantive_zero_requires_typed_signed_decision',
      'fully_incorporated_zero_distinct_from_non_substantive_zero',
      'duplicate_inherits_target_disposition_link_and_impact',
    ],
    ['terminal_disposition_implies_zero_impact'],
    'Final residual impact',
    code,
  );
  requireFlags(
    projections,
    [
      'exactly_two_residual_impact_projections_required',
      'projection_implementation_and_authority_independence_required',
      'third_reconciler_independent_of_both_projections',
      'bidirectional_impact_member_and_payload_equality_required',
      'unresolved_impact_root_required_empty',
      'missing_extra_duplicate_conflict_and_stale_dependant_roots_required_empty',
    ],
    [],
    'Residual impact projection reconciliation',
    code,
  );
  requireFlags(
    effect,
    [
      'canonical_contract_impact_blocks_through_reconciled_impact_mapping',
      'canonical_contract_impact_requires_successor_contract',
      'review_queue_presence_is_not_the_contract_impact_blocker',
    ],
    ['production_publication_permitted'],
    'Residual pilot effect',
    code,
  );
}

function validateQueue(definition) {
  const code = 'GOVERNED_RESIDUAL_REVIEW_QUEUE_CONTRACT_MISMATCH';
  const queue = definition.queue_contract;
  const empty = definition.empty_root_contract;
  requireFlags(
    queue,
    [
      'complete_universe_manifest_required',
      'complete_disposition_manifest_required',
      'complete_reconciled_impact_closure_set_required',
      'exact_one_to_one_universe_disposition_impact_partition_required',
      'independent_queue_enumerator_required',
      'effective_residual_without_final_disposition_is_queued',
      'missing_or_invalid_review_decision_is_queued',
      'invalid_duplicate_or_target_link_is_queued',
      'missing_or_unreconciled_impact_closure_is_queued',
      'reconciled_contract_impact_blocks_through_impact_mapping',
      'review_queue_presence_is_not_the_contract_impact_blocker',
    ],
    [
      'reconciled_nonzero_impact_alone_is_queued',
      'zero_count_without_member_reconciliation_can_be_empty',
      'caller_supplied_empty_boolean_permitted',
      'queue_member_erasure_permitted',
    ],
    'Residual review queue',
    code,
  );
  requireExact(
    empty.required_empty_difference_roots,
    [
      'missing_root',
      'extra_root',
      'duplicate_root',
      'conflict_root',
      'invalid_link_root',
      'unresolved_impact_root',
    ],
    'Review queue difference roots',
    code,
  );
  requireFlags(
    empty,
    [
      'exact_empty_member_root_required',
      'universe_disposition_and_impact_set_equality_required',
      'impact_closure_payload_coverage_required',
      'empty_root_required_for_scope_and_candidate_sealing',
      'empty_root_is_certification_input_not_execution_authority',
    ],
    [],
    'Residual review queue empty root',
    code,
  );
}

function validateFamilySemantics(values) {
  const byId = new Map(values.map((value) => [value.stable_id, value.definition]));
  const producer = byId.get('GOVERNED_RESIDUAL_PRODUCER_REGISTRY');
  const observation = byId.get('GOVERNED_RESIDUAL_OBSERVATION');
  const admission = byId.get('SEMANTIC_BOUNDARY_ADMISSION');
  const consumption = byId.get('SEMANTIC_BOUNDARY_CONSUMPTION');
  const universe = byId.get('GOVERNED_RESIDUAL_UNIVERSE');
  const disposition = byId.get('GOVERNED_RESIDUAL_DISPOSITION');
  const impact = byId.get('GOVERNED_RESIDUAL_IMPACT');
  const queue = byId.get('GOVERNED_RESIDUAL_REVIEW_QUEUE');
  validateProducer(producer);
  validateObservation(observation);
  validateAdmission(admission);
  validateConsumption(consumption);
  validateUniverse(universe);
  validateDisposition(disposition);
  validateImpact(impact);
  validateQueue(queue);

  const code = 'GOVERNED_RESIDUAL_FAMILY_CROSS_BINDING_MISMATCH';
  requireExact(
    admission.slot_registry_contract.generated_from_authorities,
    producer.producer_registry_contract.registry_authority_sources,
    'Admission and producer authority bindings',
    code,
  );
  requireExact(
    universe.universe_contract.second_enumerator_authorities,
    admission.slot_registry_contract.generated_from_authorities,
    'Universe and admission authority bindings',
    code,
  );
  requireExact(
    Object.keys(impact.final_residual_impact_contract.branch_by_final_disposition),
    disposition.disposition_contract.closed_final_dispositions,
    'Disposition and impact branches',
    code,
  );
  if (
    consumption.consumption_contract.closed_terminal_kinds.length
      !== disposition.disposition_contract.closed_final_dispositions.length
    || queue.queue_contract.complete_reconciled_impact_closure_set_required !== true
  ) {
    fail(code, 'The residual lifecycle contracts do not form one closed family.');
  }
}

function validateDefinitionDigest(value) {
  const registered = GOVERNED_RESIDUAL_CONTRACT_DEFINITIONS[value.stable_id];
  const actualDigest = sha256Hex(
    Buffer.from(canonicalJson(value.definition), 'utf8'),
  );
  if (actualDigest !== registered.definition_digest) {
    fail(
      'INVALID_GOVERNED_RESIDUAL_CONTRACT_INPUT',
      'The governed residual contract does not match its complete reviewed definition.',
      {
        stable_id: value.stable_id,
        expected_definition_digest: registered.definition_digest,
        actual_definition_digest: actualDigest,
      },
    );
  }
}

function validateAuthoredGovernedResidualInputs(authoredMembers) {
  if (!Array.isArray(authoredMembers)) {
    throw new TypeError('authoredMembers must be an array');
  }
  const members = authoredMembers.filter(
    (member) => member?.object_kind === GOVERNED_RESIDUAL_CONTRACT_INPUT_KIND,
  );
  const stableIds = members
    .map((member) => member.canonical_value?.stable_id)
    .sort();
  requireExact(
    stableIds,
    GOVERNED_RESIDUAL_CONTRACT_IDS,
    'Governed residual contract member set',
    'GOVERNED_RESIDUAL_CONTRACT_MEMBERSHIP_MISMATCH',
  );
  const values = members.map(validateMemberIdentity);
  validateFamilySemantics(values);
  values.forEach(validateDefinitionDigest);
  return true;
}

module.exports = {
  AUTHORITY_KEYS,
  GOVERNED_RESIDUAL_CONTRACT_DEFINITIONS,
  GOVERNED_RESIDUAL_CONTRACT_IDS,
  GOVERNED_RESIDUAL_CONTRACT_INPUT_KIND,
  GOVERNED_RESIDUAL_CONTRACT_INPUT_SCHEMA,
  GovernedResidualContractInputError,
  validateAuthoredGovernedResidualInputs,
};
