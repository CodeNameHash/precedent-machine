/**
 * Emit TERMINATION_FEE Phase 2 authoring authority v2 from the M5 calibration
 * pack and six comparator resolution runs (20 admitted M4 claim terminals).
 *
 * Classification buckets are derived source-first from the comparator
 * (concept_key, resolved_claim_definition_key) pair. All four buckets that draw
 * comparator instances carry a sealed M5 subtype label; four sealed labels
 * (FEE_TRIGGER, EXPENSE_REIMBURSEMENT, LATE_INTEREST, CONDITIONAL_FEE_SCHEDULE)
 * draw none. Two further source divergences are recorded, not resolved: the ten
 * sole-remedy rows carry `owner_family: SPECIFIC_PERFORMANCE_REMEDIES` in the
 * comparator resolution, and two fee-amount rows carry a BUYER fee side that the
 * single sealed FEE_AMOUNT label does not distinguish.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import canonicalModule from '../lib/canonical-v2/canonical-bytes.js';

const { canonicalJson, contentId, sha256Hex } = canonicalModule;

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');

const SCHEMA =
  'STAGE_2Y_M7_V2_REPAIR_CONTRACT_TERMINATION_FEE_AUTHORING_PHASE2_AUTHORITY/V2';
const OUT_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-termination-fee-authoring-phase2-authority-v2.json';
const CALIBRATION_PACK_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/preparation/m5/calibration-packs/TERMINATION_FEE.json';
const TERMINATION_PHASE2_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-termination-authoring-phase2-authority-v2.json';
const SEALED_ROLE_SCHEMA_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/family-role-schemas/TERMINATION_FEE.json';
const FAMILY_ROLE_POLICY_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/family-specific-role-policies-v2/TERMINATION_FEE.json';

const CLASSIFICATION_BUCKETS = [
  'FEE_AMOUNT',
  'TAIL_FEE',
  'SOLE_REMEDY_LINK',
  'CARVEOUT',
];

/**
 * Source-first bucket assignment. REM-SOLE splits on claim definition key
 * because the comparator resolves both the sole-remedy legal effect and its
 * carve-out kinds under one concept key.
 */
const BUCKET_BY_CONCEPT_AND_CLAIM = Object.freeze({
  'TERMF-TARGET|TERMINATION_FEE_AMOUNT': 'FEE_AMOUNT',
  'TERMF-REVERSE|TERMINATION_FEE_AMOUNT': 'FEE_AMOUNT',
  'TERMF-TAIL|TERMINATION_FEE_TAIL_PERIOD_MONTHS': 'TAIL_FEE',
  'REM-SOLE|SOLE_REMEDY_LEGAL_EFFECT_PRESENT': 'SOLE_REMEDY_LINK',
  'REM-SOLE|SOLE_REMEDY_CARVEOUT_KIND': 'CARVEOUT',
});

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(REPO_ROOT, relativePath), 'utf8'));
}

function fileBinding(relativePath, recordIdField) {
  const bytes = readFileSync(path.join(REPO_ROOT, relativePath));
  const record = JSON.parse(bytes.toString('utf8'));
  return {
    path: relativePath,
    byte_length: bytes.byteLength,
    sha256: sha256Hex(bytes),
    schema_version: record.schema_version,
    record_id_field: recordIdField,
    record_id: record[recordIdField],
  };
}

function agreementBinding(agreementId) {
  const m2Path =
    `evidence/canonical-v2/stage-2y-structure-migration/shadow/m2/${agreementId}.agreement-index.json`;
  const m3Path =
    `evidence/canonical-v2/stage-2y-structure-migration/shadow/m3/${agreementId}.context-compilation.json`;
  const m4Path =
    `evidence/canonical-v2/stage-2y-structure-migration/shadow/m4/${agreementId}.agreement-analysis.json`;
  const sourceBinding = readJson(m2Path).source_binding;
  return {
    agreement_id: agreementId,
    canonical_text_id: sourceBinding.canonical_text_id,
    canonical_text_byte_length: sourceBinding.canonical_text_byte_length,
    canonical_text_sha256: sourceBinding.canonical_text_sha256,
    m2: fileBinding(m2Path, 'agreement_index_id'),
    m3: fileBinding(m3Path, 'context_compilation_id'),
    m4: fileBinding(m4Path, 'agreement_analysis_id'),
  };
}

function classificationPath(bucket) {
  return ['TERMINATION_FEE', bucket];
}

function emptyDependencyContracts() {
  return {
    defined_term_dependencies: [],
    reference_dependencies: [],
    structural_dependencies: [],
  };
}

function buildTerminal({
  agreementId,
  deal,
  conceptKey,
  claimDefinitionKey,
  m4ClaimId,
  provisionInstance,
  claimRevisionId,
  sectionReference,
  sourceCitation,
  feeSide,
  ownerFamily,
  resolutionProvenance,
  genericClaimKey,
}) {
  const bucket = BUCKET_BY_CONCEPT_AND_CLAIM[`${conceptKey}|${claimDefinitionKey}`];
  if (!bucket) {
    throw new Error(`Unmapped concept/claim pair: ${conceptKey}|${claimDefinitionKey}`);
  }
  const sourceUnitKey = contentId('TERMINATION_FEE_TERMINAL_SOURCE_UNIT/V1', {
    agreement_id: agreementId,
    concept_key: conceptKey,
    m4_claim_id: m4ClaimId,
    claim_revision_id: claimRevisionId,
  });
  const signature = `ALL_OF(TERMINATION_FEE,${conceptKey},${deal.toUpperCase()},${m4ClaimId})`;
  return {
    source_unit_key: sourceUnitKey,
    agreement_id: agreementId,
    classification_bucket: bucket,
    classification_path: classificationPath(bucket),
    m4_claim_ids: [m4ClaimId],
    m4_silent_source_row_keys: [],
    source_closure: {
      members: [{
        agreement_id: agreementId,
        deal,
        section_reference: sectionReference,
        source_citation: sourceCitation,
        source_node_occurrence_id: provisionInstance.source_occurrence_id,
        provision_instance_id: provisionInstance.provision_instance_id,
        concept_key: conceptKey,
        claim_definition_key: claimDefinitionKey,
        claim_revision_id: claimRevisionId,
        fee_side: feeSide,
        comparator_owner_family: ownerFamily,
        comparator_generic_claim_key: genericClaimKey,
        comparator_resolution_provenance: resolutionProvenance,
      }],
    },
    signature_binding_kind: 'COMPARATOR_DERIVED',
    required_expression_signature: signature,
    linked_rule_bindings: [],
    dependency_contracts: emptyDependencyContracts(),
    qualification_contracts: [],
    temporal_contracts: [],
    unresolved_items: [],
  };
}

function buildTerminals(calibrationPack) {
  const terminals = [];
  for (const run of calibrationPack.comparator_run_bindings) {
    const resolution = readJson(run.resolution_binding.path);
    const m4 = readJson(
      `evidence/canonical-v2/stage-2y-structure-migration/shadow/m4/${run.agreement_id}.agreement-analysis.json`,
    );
    const familyClaims = m4.claims.filter((claim) => claim.family === 'TERMINATION_FEE');
    const claimsByOccurrence = new Map(
      familyClaims.map((claim) => [claim.claim_occurrence_id, claim]),
    );
    for (const entry of resolution.resolved) {
      const m4Claim = claimsByOccurrence.get(entry.claim.claim_occurrence_id);
      if (!m4Claim) {
        throw new Error(
          `${run.deal}:${entry.concept_key} missing from M4 TERMINATION_FEE claims`,
        );
      }
      if (m4Claim.claim_definition_key !== entry.resolved_claim_definition_key) {
        throw new Error(`${run.deal}:${entry.concept_key} claim definition key drift`);
      }
      terminals.push(buildTerminal({
        agreementId: run.agreement_id,
        deal: run.deal,
        conceptKey: entry.concept_key,
        claimDefinitionKey: m4Claim.claim_definition_key,
        m4ClaimId: m4Claim.analysis_claim_id,
        provisionInstance: entry.provision_instance,
        claimRevisionId: entry.claim.claim_revision_id,
        sectionReference: entry.section_reference,
        sourceCitation: entry.source_citation,
        feeSide: entry.party?.capacity ?? null,
        ownerFamily: entry.owner_family ?? null,
        resolutionProvenance: entry.claim.extraction_version,
        genericClaimKey: entry.generic_claim_key,
      }));
    }
  }
  terminals.sort((left, right) => left.source_unit_key.localeCompare(right.source_unit_key));
  return terminals;
}

function buildAgreementBindings(calibrationPack, terminationAuthority) {
  const terminationByAgreementId = new Map(
    terminationAuthority.immutable_parent_bindings.m2_m3_m4.map(
      (binding) => [binding.agreement_id, binding],
    ),
  );
  return calibrationPack.comparator_run_bindings.map((run) => (
    terminationByAgreementId.get(run.agreement_id) ?? agreementBinding(run.agreement_id)
  ));
}

function sealedSubtypeBuckets(sealedRoleSchema) {
  return sealedRoleSchema.subtype_profiles.map(
    (profile) => profile.profile_id.replace('TERMINATION_FEE::', ''),
  );
}

function buildSubtypeReconciliation(terminals, sealedRoleSchema) {
  const sealedBuckets = sealedSubtypeBuckets(sealedRoleSchema);
  const bucketCounts = Object.fromEntries(CLASSIFICATION_BUCKETS.map((bucket) => [
    bucket,
    terminals.filter((terminal) => terminal.classification_bucket === bucket).length,
  ]));
  return {
    comparator_bucket_counts: bucketCounts,
    comparator_bucket_derivation: 'COMPARATOR_CONCEPT_KEY_AND_CLAIM_DEFINITION_KEY_SOURCE_FIRST',
    concept_and_claim_key_to_bucket: BUCKET_BY_CONCEPT_AND_CLAIM,
    m5_sealed_subtype_profile_ids: sealedRoleSchema.subtype_profiles.map(
      (profile) => profile.profile_id,
    ),
    m5_sealed_subtype_buckets: sealedBuckets,
    m5_subtype_claim_scope_is_uniform_across_subtypes: true,
    comparator_buckets_without_sealed_m5_label: CLASSIFICATION_BUCKETS.filter(
      (bucket) => !sealedBuckets.includes(bucket),
    ),
    sealed_m5_labels_without_comparator_instance: sealedBuckets.filter(
      (bucket) => !CLASSIFICATION_BUCKETS.includes(bucket),
    ),
    reconciliation_state: 'UNRESOLVED_REQUIRES_LEGAL_GROUPING_REVIEW',
    reconciliation_disposition:
      'BUCKETS_ARE_TECHNICAL_PARTITION_KEYS_ONLY_AND_DO_NOT_ASSERT_M5_SUBTYPE_MEMBERSHIP',
  };
}

function buildOwnerFamilyResiduals(terminals) {
  const foreignOwnerRows = terminals.filter(
    (terminal) => terminal.source_closure.members[0].comparator_owner_family !== null,
  );
  const ownerFamilies = [...new Set(foreignOwnerRows.map(
    (terminal) => terminal.source_closure.members[0].comparator_owner_family,
  ))].sort();
  return {
    comparator_declared_owner_families: ownerFamilies,
    foreign_owner_family_row_count: foreignOwnerRows.length,
    foreign_owner_family_buckets: [...new Set(foreignOwnerRows.map(
      (terminal) => terminal.classification_bucket,
    ))].sort(),
    foreign_owner_family_source_unit_keys: foreignOwnerRows.map(
      (terminal) => terminal.source_unit_key,
    ).sort(),
    supplemental_resolution_provenance_versions: [...new Set(foreignOwnerRows.map(
      (terminal) => terminal.source_closure.members[0].comparator_resolution_provenance,
    ))].sort(),
    residual_disposition:
      'Q02_ONE_SEMANTIC_OWNER_UNRESOLVED_FOR_ROWS_THE_COMPARATOR_ASSIGNS_TO_ANOTHER_FAMILY',
  };
}

function buildFeeSideResiduals(terminals) {
  const feeSides = [...new Set(terminals.map(
    (terminal) => terminal.source_closure.members[0].fee_side,
  ).filter((side) => side !== null))].sort();
  const nonTargetRows = terminals.filter((terminal) => {
    const side = terminal.source_closure.members[0].fee_side;
    return side !== null && side !== 'TARGET';
  });
  return {
    comparator_observed_fee_sides: feeSides,
    fee_side_is_a_role_not_a_bucket: true,
    non_target_fee_side_row_count: nonTargetRows.length,
    non_target_fee_side_source_unit_keys: nonTargetRows.map(
      (terminal) => terminal.source_unit_key,
    ).sort(),
    sealed_m5_label_distinguishes_fee_side: false,
    residual_disposition:
      'REVERSE_SIDE_FEE_ROWS_SHARE_ONE_SEALED_FEE_AMOUNT_LABEL_AND_REQUIRE_EXPLICIT_INVENTORY_DISPOSITION',
  };
}

function buildScopeResiduals(terminals, sealedRoleSchema) {
  const observedClaimDefinitionKeys = [...new Set(terminals.map(
    (terminal) => terminal.source_closure.members[0].claim_definition_key,
  ))].sort();
  const sealedScope = sealedRoleSchema.claim_definition_scope.included_claim_definition_keys;
  return {
    sealed_included_claim_definition_keys: [...sealedScope].sort(),
    comparator_observed_claim_definition_keys: observedClaimDefinitionKeys,
    sealed_keys_without_comparator_instance: sealedScope.filter(
      (key) => !observedClaimDefinitionKeys.includes(key),
    ).sort(),
    comparator_keys_outside_sealed_scope: observedClaimDefinitionKeys.filter(
      (key) => !sealedScope.includes(key),
    ),
    residual_disposition:
      'ABSENT_SEALED_KEYS_ARE_NOT_MATERIALISED_AS_PROFILES_AND_REQUIRE_EXPLICIT_INVENTORY_DISPOSITION',
  };
}

function buildAuthority() {
  const calibrationPack = readJson(CALIBRATION_PACK_PATH);
  const terminationAuthority = readJson(TERMINATION_PHASE2_PATH);
  const sealedRoleSchema = readJson(SEALED_ROLE_SCHEMA_PATH);
  const terminals = buildTerminals(calibrationPack);
  const m4ClaimIds = terminals.flatMap((terminal) => terminal.m4_claim_ids);
  const agreementTerminalCounts = Object.fromEntries(
    calibrationPack.comparator_run_bindings.map((run) => [
      run.agreement_id,
      run.expected_counts.resolution_claims,
    ]),
  );
  const calibrationPackBytes = readFileSync(path.join(REPO_ROOT, CALIBRATION_PACK_PATH));

  const unsigned = {
    schema_version: SCHEMA,
    authority_state: 'PROPOSED_AWAITING_BEN_CALIBRATION_APPROVAL',
    approval_basis: {
      authority_kind: 'ZERO_EFFECT_TERMINATION_FEE_PHASE2_PARTITION_AUTHORITY',
      calibration_pack_status: calibrationPack.status,
      comparator_run_count: calibrationPack.comparator_run_bindings.length,
      exact_terminal_rule_count: terminals.length,
      family_key: 'TERMINATION_FEE',
      legal_ruling_count: 0,
      proposed_on: '2026-08-24',
      purpose:
        'Governed comparator-derived terminal registry for TERMINATION_FEE Phase 2 partition only',
      sealed_role_schema_binding: fileBinding(
        SEALED_ROLE_SCHEMA_PATH,
        'family_role_schema_id',
      ),
    },
    immutable_predecessor_binding: null,
    immutable_parent_bindings: {
      base_policy: terminationAuthority.immutable_parent_bindings.base_policy,
      c3: terminationAuthority.immutable_parent_bindings.c3,
      phase1: terminationAuthority.immutable_parent_bindings.phase1,
      work3_manifest: terminationAuthority.immutable_parent_bindings.work3_manifest,
      family_role_policy: fileBinding(FAMILY_ROLE_POLICY_PATH, 'family_policy_id'),
      calibration_pack: {
        path: CALIBRATION_PACK_PATH,
        byte_length: calibrationPackBytes.byteLength,
        sha256: sha256Hex(calibrationPackBytes),
        schema_version: calibrationPack.schema_version,
        record_id_field: 'calibration_pack_id',
        record_id: calibrationPack.calibration_pack_id,
      },
      m2_m3_m4: buildAgreementBindings(calibrationPack, terminationAuthority),
    },
    calibration_source_contract: {
      account_each_admitted_m4_claim_exactly_once: true,
      account_each_independent_in_scope_m2_terminal_limb_exactly_once: true,
      exact_calibration_claim_count: m4ClaimIds.length,
      exact_examples: calibrationPack.provision_examples,
      expected_complete_agreement_closure_count:
        calibrationPack.comparator_run_bindings.length,
      expected_m4_silent_terminal_count: 0,
      profile_count_derived_not_assumed: true,
      provision_example_subtype_tagging_state:
        'ALL_SIX_EXAMPLES_TAGGED_FEE_AMOUNT_PENDING_LEGAL_GROUPING_REVIEW',
      source_inventory_contract: {
        admitted_m4_claim_count: m4ClaimIds.length,
        terminal_rule_count: terminals.length,
        terminal_rule_registry_path:
          'source_terminal_successor_contract.terminal_rule_registry',
      },
    },
    m5_subtype_reconciliation: buildSubtypeReconciliation(terminals, sealedRoleSchema),
    sealed_claim_scope_residuals: buildScopeResiduals(terminals, sealedRoleSchema),
    comparator_owner_family_residuals: buildOwnerFamilyResiduals(terminals),
    fee_side_residuals: buildFeeSideResiduals(terminals),
    source_terminal_successor_contract: {
      schema_version: 'STAGE_2Y_TERMINATION_FEE_TERMINAL_SUCCESSOR_CONTRACT/V1',
      state: 'COMPLETE',
      admitted_m4_claim_exact_count: m4ClaimIds.length,
      analysis_fact_or_operator_evidence_forbidden: true,
      classification_path_registry: CLASSIFICATION_BUCKETS.map((bucket) => ({
        classification_bucket: bucket,
        classification_path: classificationPath(bucket),
      })),
      counts_derived_from_registry: true,
      exact_agreement_terminal_counts: agreementTerminalCounts,
      m4_silent_terminal_exact_count: 0,
      required_expression_signature_semantics: 'ONE_SIGNATURE_PER_TERMINAL_LEAF',
      terminal_rule_exact_keys: [
        'source_unit_key',
        'agreement_id',
        'classification_bucket',
        'classification_path',
        'm4_claim_ids',
        'm4_silent_source_row_keys',
        'source_closure',
        'signature_binding_kind',
        'required_expression_signature',
        'linked_rule_bindings',
        'dependency_contracts',
        'qualification_contracts',
        'temporal_contracts',
        'unresolved_items',
      ],
      terminal_rule_registry: terminals,
      terminal_rule_registry_exact_count: terminals.length,
      terminal_rule_registry_order: 'SOURCE_UNIT_KEY_ASCENDING',
    },
    authorised_synthetic_rule_components: [],
    authorised_symbolic_graph_fixtures: [],
    temporal_state_reference_occurrence_schedule: [],
    synthetic_component_contract: {
      component_count: 0,
      state: 'NOT_REQUIRED_FOR_TERMINATION_FEE_FIRST_SLICE',
    },
    policy_overlay: {
      family_key: 'TERMINATION_FEE',
      fee_economics_taxonomy_stress: 'COMPARATOR_CONCEPT_KEY_TO_FEE_ECONOMICS_BUCKET',
      fee_side_stress: 'FEE_SIDE_IS_A_ROLE_NOT_A_BUCKET',
      sole_remedy_provenance_stress:
        'SUPPLEMENTAL_SOLE_REMEDY_RESOLUTION_IS_NOT_PRODUCER_PROPOSAL_LINKED',
      cross_family_boundaries: {
        TERMINATION: 'LINK_ONLY_TERMINATION_RIGHT_SEMANTICS_OWNED_BY_SEALED_TERMINATION_PACKAGE',
        SPECIFIC_PERFORMANCE_REMEDIES:
          'OWNERSHIP_UNRESOLVED_COMPARATOR_ASSIGNS_SOLE_REMEDY_ROWS_TO_THAT_FAMILY',
        CLOSING_CONDITIONS: 'LINK_ONLY_FEE_TRIGGERS_MAY_REFERENCE_CONDITION_FAILURE',
      },
      phase3_reference_frontier: 'DEFERRED_NOT_TERMINATION_FRONTIER',
      temporal_graph_materialisation: 'DEFERRED_NOT_TERMINATION_FRONTIER',
    },
    implementation_contract: {
      authority_envelope: {
        path: OUT_PATH,
        record_id_field: 'termination_fee_authoring_phase2_authority_id',
        schema_version: SCHEMA,
      },
      classification_mapping_contract: {
        classification_path_registry_path:
          'source_terminal_successor_contract.classification_path_registry',
        duplicate_missing_or_foreign_assignment_disposition: 'FAIL_CLOSED',
        exact_admitted_m4_claim_count: m4ClaimIds.length,
        exact_m4_silent_terminal_count: 0,
        exact_terminal_rule_count: terminals.length,
        free_text_classification_forbidden: true,
        m4_claim_assignment_path: 'terminal_rule_registry[].m4_claim_ids',
        m4_silent_assignment_path: 'terminal_rule_registry[].m4_silent_source_row_keys',
        m5_classification_input_forbidden: true,
        terminal_rule_registry_path: 'source_terminal_successor_contract.terminal_rule_registry',
      },
      compiler_phase2_dispatch_contract: {
        public_seam: 'prepareTerminationFeePhase2FamilyProposal',
        module_path: 'lib/canonical-v2/m7-v2-termination-fee-authoring.js',
      },
      deep_frozen_non_aliasing_output: true,
      evidence_validation_contract: {
        synthetic_components_required: false,
        temporal_graphs_required: false,
      },
      exact_output_keys: [
        'schema_version',
        'proposal_id',
        'family_key',
        'proposal_state',
        'profile_approval_state',
        'authority_binding',
        'm4_claim_accounting',
        'source_terminal_coverage',
        'zero_m4_claim_gaps',
        'symbolic_temporal_graphs',
        'temporal_state_reference_edges',
        'authorised_rule_components',
        'proposed_partition',
        'derived_profile_count',
        'inventory_digest',
        'unresolved_items',
      ],
      forbidden_capability_paths: [],
      forbidden_identifier_classes: [
        'BEN_APPROVAL_ID',
        'BEN_DECISION_ID',
        'GOVERNED_APPROVAL_ID',
        'GOVERNED_PACKAGE_ID',
        'GOVERNED_CANDIDATE_ID',
        'GOVERNED_REGISTRATION_ID',
        'GOVERNED_TRANSITION_ID',
        'GOVERNED_ACTIVATION_ID',
      ],
      governed_sources_contract: {
        exact_input_keys: [
          'terminationFeeAuthoringPhase2Authority',
          'governedSources',
        ],
      },
      lifecycle: {
        proposal_state: 'TREE_OUTPUT_INCOMPLETE',
        profile_approval_state: 'UNAPPROVED',
      },
      no_persistence: true,
      output_constants: {
        family_key: 'TERMINATION_FEE',
        profile_approval_state: 'UNAPPROVED',
        proposal_state: 'TREE_OUTPUT_INCOMPLETE',
        schema_version: 'M7_V2_TERMINATION_FEE_FAMILY_PROPOSAL/V1',
        zero_m4_claim_gaps: true,
      },
      output_member_contracts: {
        source_terminal_coverage: {
          classification_buckets: CLASSIFICATION_BUCKETS,
          m4_silent_source_unit_keys: [],
        },
      },
      partition_derivation: {
        abstract_root_profile_authorised: false,
        class_buckets_are_not_profiles: true,
        current_profile_approval_state: 'UNAPPROVED',
        current_tree_state: 'TREE_OUTPUT_INCOMPLETE',
        distinct_signatures_require_distinct_proposed_terminal_leaves: true,
        grouping_key_members: ['classification_path', 'required_expression_signature'],
        later_exact_inventory_approval_required: true,
        one_signature_per_proposed_terminal_leaf: true,
        profile_count_must_be_derived: true,
        profile_count_must_not_be_preassigned: true,
        profile_keys_and_content_ids: terminals.map((terminal) => ({
          source_unit_key: terminal.source_unit_key,
          required_expression_signature: terminal.required_expression_signature,
        })),
        proposed_partition_is_not_a_profile_tree: true,
        shared_classification_path_allowed: true,
      },
      permitted_identifier_classes: ['INTERNAL_REFERENCE_EDGE_ID'],
      public_error_contract: {
        missing_facade: 'TERMINATION_FEE Phase2 proposal facade export is missing.',
      },
      public_seam: 'prepareTerminationFeePhase2FamilyProposal',
      reference_target_owner_template_registry: [],
      required_unresolved_items: [
        'COMPARATOR_OWNER_FAMILY_ASSIGNMENT_UNRESOLVED',
        'EXACT_PROFILE_INVENTORY_REQUIRES_SEPARATE_APPROVAL',
        'FEE_SIDE_PARTITION_UNRESOLVED',
        'LEGAL_GROUPING_REVIEW_REQUIRED',
        'TERMINATION_FEE_Q01_Q02_Q03_OPEN_REQUIRES_BEN_RULING',
      ],
      source_inventory: {
        admitted_m4_claim_count: m4ClaimIds.length,
        agreement_terminal_counts_path:
          'source_terminal_successor_contract.exact_agreement_terminal_counts',
        m4_silent_terminal_count: 0,
        no_source_exclusion_or_fold_without_later_authority: true,
        terminal_rule_count: terminals.length,
        terminal_rule_registry_path:
          'source_terminal_successor_contract.terminal_rule_registry',
      },
      source_terminal_coverage: {
        state: 'COMPLETE',
      },
    },
    execution_scope: {
      authority_path: OUT_PATH,
      authority_record_creation: 'GENERATOR_EMIT_ONCE',
      family_key: 'TERMINATION_FEE',
      first_red_test_path:
        'tests/stage-2y-structure-m7-v2-repair-termination-fee-work3.test.js',
      first_red_test_pattern:
        'Phase2 proposal derives a deterministic unapproved TERMINATION_FEE partition',
      module_path: 'lib/canonical-v2/m7-v2-termination-fee-authoring.js',
    },
    record_identity_contract: {
      authority_id_field: 'termination_fee_authoring_phase2_authority_id',
      authority_id_rule: 'contentId(schema_version,unsigned_record)',
      authority_schema_version: SCHEMA,
      authority_unsigned_record_rule: 'DELETE_AUTHORITY_ID_FIELD_ONLY',
      canonical_encoding: 'UTF8',
      canonical_file_rule: 'canonicalJson(record)+SINGLE_LF',
      prospective_envelope_binding_path: OUT_PATH,
      prospective_envelope_binding_exact_keys: [
        'path',
        'schema_version',
        'record_id_field',
        'record_id',
        'byte_length',
        'sha256',
      ],
      test_fixture_builder_must_derive_all_output_ids: true,
    },
    state_transition_only_exclusions: {
      excluded_state_keys: [],
      rationale:
        'Termination Fee first slice has no temporal state machines in Phase 2 authority',
    },
    zero_effect_boundary: {
      approved_package_count: 0,
      approved_profile_count: 0,
      base_policy_phase1_c3_work3_m2_m3_m4_unchanged: true,
      commit_count: 0,
      database_write_count: 0,
      governed_activation_count: 0,
      governed_candidate_count: 0,
      manifest_count: 0,
      network_write_count: 0,
      no_ben_approval_or_decision_id_in_proposal: true,
      no_governed_approval_package_candidate_registration_transition_or_activation_id_in_proposal: true,
      non_governed_internal_reference_edge_ids_permitted: true,
      persisted_tree_count: 0,
      product_write_count: 0,
      profile_approval_state: 'UNAPPROVED',
      prohibited_identifier_classes: [
        'BEN_APPROVAL_ID',
        'BEN_DECISION_ID',
        'GOVERNED_APPROVAL_ID',
        'GOVERNED_PACKAGE_ID',
        'GOVERNED_CANDIDATE_ID',
        'GOVERNED_REGISTRATION_ID',
        'GOVERNED_TRANSITION_ID',
        'GOVERNED_ACTIVATION_ID',
      ],
      proposal_lifecycle: 'EPHEMERAL_IN_MEMORY_DIES_WITH_PROCESS',
      proposal_state: 'TREE_OUTPUT_INCOMPLETE',
      push_count: 0,
      real_analysis_v2_record_count: 0,
      real_projection_v2_record_count: 0,
      receipt_count: 0,
    },
  };

  return {
    ...unsigned,
    termination_fee_authoring_phase2_authority_id: contentId(SCHEMA, unsigned),
  };
}

function main() {
  const record = buildAuthority();
  const outAbsolute = path.join(REPO_ROOT, OUT_PATH);
  writeFileSync(outAbsolute, `${canonicalJson(record)}\n`, 'utf8');
  const bytes = readFileSync(outAbsolute);
  process.stdout.write(
    `${JSON.stringify({
      path: OUT_PATH,
      byte_length: bytes.byteLength,
      sha256: sha256Hex(bytes),
      record_id: record.termination_fee_authoring_phase2_authority_id,
      terminal_count: record.source_terminal_successor_contract.terminal_rule_registry.length,
      bucket_counts: record.m5_subtype_reconciliation.comparator_bucket_counts,
      foreign_owner_family_row_count:
        record.comparator_owner_family_residuals.foreign_owner_family_row_count,
      non_target_fee_side_row_count: record.fee_side_residuals.non_target_fee_side_row_count,
    }, null, 2)}\n`,
  );
}

main();
