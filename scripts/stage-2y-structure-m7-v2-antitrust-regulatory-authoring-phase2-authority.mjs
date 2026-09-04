/**
 * Emit ANTITRUST_REGULATORY Phase 2 authoring authority v2 from the M5
 * calibration pack and seven comparator resolution runs (70 admitted M4 claim
 * terminals).
 *
 * Classification buckets are derived source-first from the comparator
 * (concept_key, resolved_claim_definition_key) pair. Fourteen buckets draw
 * comparator instances; eleven carry a sealed M5 subtype label, three do not
 * (FILING_TIMING_STANDARD, NOTIFICATION, WITHDRAWAL_REFILING), and one sealed
 * label (REGULATORY_REQUEST_RESPONSE) draws none. Two further source
 * divergences are recorded, not resolved: five filing rows name a regime other
 * than HSR while the sealed schema carries a single filing-deadline label, and
 * twelve rows name a one-sided regulatory obligor where the remaining
 * fifty-eight are mutual.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import canonicalModule from '../lib/canonical-v2/canonical-bytes.js';

const { canonicalJson, contentId, sha256Hex } = canonicalModule;

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');

const SCHEMA =
  'STAGE_2Y_M7_V2_REPAIR_CONTRACT_ANTITRUST_REGULATORY_AUTHORING_PHASE2_AUTHORITY/V2';
const OUT_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-antitrust-regulatory-authoring-phase2-authority-v2.json';
const CALIBRATION_PACK_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/preparation/m5/calibration-packs/ANTITRUST_REGULATORY.json';
const CLOSING_CONDITIONS_PHASE2_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-closing-conditions-authoring-phase2-authority-v2.json';
const SEALED_ROLE_SCHEMA_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/family-role-schemas/ANTITRUST_REGULATORY.json';
const FAMILY_ROLE_POLICY_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/family-specific-role-policies-v2/ANTITRUST_REGULATORY.json';

const CLASSIFICATION_BUCKETS = [
  'EFFORTS',
  'FILING_OBLIGATION',
  'FILING_DEADLINE',
  'FILING_TIMING_STANDARD',
  'BURDEN',
  'LITIGATION',
  'TIMING_AGREEMENT',
  'WITHDRAWAL_REFILING',
  'STRATEGY_CONTROL',
  'CONSULTATION',
  'COOPERATION',
  'INFORMATION_SHARING',
  'NON_IMPEDIMENT',
  'NOTIFICATION',
];

/**
 * Source-first bucket assignment. ANTI-FILING splits three ways and
 * ANTI-AGREEMENTS two ways on claim definition key, because the comparator
 * resolves several distinct regulatory facts under one concept key. HSR is
 * never aggregated with another filing regime: the HSR deadline claim keeps its
 * own bucket.
 */
const BUCKET_BY_CONCEPT_AND_CLAIM = Object.freeze({
  'ANTI-EFFORTS|REGULATORY_EFFORTS_STANDARD': 'EFFORTS',
  'ANTI-FILING|REGULATORY_FILING_OBLIGATION': 'FILING_OBLIGATION',
  'ANTI-FILING|HSR_FILING_DEADLINE_DAYS': 'FILING_DEADLINE',
  'ANTI-FILING|REGULATORY_FILING_TIMING_STANDARD': 'FILING_TIMING_STANDARD',
  'ANTI-BURDEN|REGULATORY_BURDEN_COMMITMENT': 'BURDEN',
  'ANTI-LITIGATION|REGULATORY_LITIGATION_OBLIGATION': 'LITIGATION',
  'ANTI-AGREEMENTS|REGULATORY_TIMING_AGREEMENT_RESTRICTION': 'TIMING_AGREEMENT',
  'ANTI-AGREEMENTS|REGULATORY_WITHDRAWAL_REFILING_RESTRICTION': 'WITHDRAWAL_REFILING',
  'ANTI-STRATEGY|REGULATORY_STRATEGY_CONTROL': 'STRATEGY_CONTROL',
  'ANTI-CONSULT|REGULATORY_CONSULTATION_RIGHT': 'CONSULTATION',
  'ANTI-COOPERATE|REGULATORY_COOPERATION_OBLIGATION': 'COOPERATION',
  'ANTI-INFO|REGULATORY_INFORMATION_SHARING_OBLIGATION': 'INFORMATION_SHARING',
  'ANTI-NOACTION|REGULATORY_NON_IMPEDIMENT_COVENANT': 'NON_IMPEDIMENT',
  'ANTI-NOTIFY|REGULATORY_NOTIFICATION_OBLIGATION': 'NOTIFICATION',
});

/** The comparator's mutual-obligor capacity; anything else is one-sided. */
const MUTUAL_OBLIGOR_CAPACITY = 'EITHER_PRINCIPAL_PARTY';

const HSR_REGIME_PATTERN = /HSR/i;

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
  return ['ANTITRUST_REGULATORY', bucket];
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
  obligorCapacity,
  filingRegime,
  ownerFamily,
  resolutionProvenance,
  genericClaimKey,
}) {
  const bucket = BUCKET_BY_CONCEPT_AND_CLAIM[`${conceptKey}|${claimDefinitionKey}`];
  if (!bucket) {
    throw new Error(`Unmapped concept/claim pair: ${conceptKey}|${claimDefinitionKey}`);
  }
  const sourceUnitKey = contentId('ANTITRUST_REGULATORY_TERMINAL_SOURCE_UNIT/V1', {
    agreement_id: agreementId,
    concept_key: conceptKey,
    m4_claim_id: m4ClaimId,
    claim_revision_id: claimRevisionId,
  });
  const signature =
    `ALL_OF(ANTITRUST_REGULATORY,${conceptKey},${deal.toUpperCase()},${m4ClaimId})`;
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
        obligor_capacity: obligorCapacity,
        filing_regime_ref: filingRegime,
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
    const familyClaims = m4.claims.filter(
      (claim) => claim.family === 'ANTITRUST_REGULATORY',
    );
    const claimsByOccurrence = new Map(
      familyClaims.map((claim) => [claim.claim_occurrence_id, claim]),
    );
    for (const entry of resolution.resolved) {
      const m4Claim = claimsByOccurrence.get(entry.claim.claim_occurrence_id);
      if (!m4Claim) {
        throw new Error(
          `${run.deal}:${entry.concept_key} missing from M4 ANTITRUST_REGULATORY claims`,
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
        obligorCapacity: entry.party?.capacity ?? null,
        filingRegime: entry.claim.attributes?.filing_regime_ref ?? null,
        ownerFamily: entry.owner_family ?? null,
        resolutionProvenance: entry.claim.extraction_version,
        genericClaimKey: entry.generic_claim_key,
      }));
    }
  }
  terminals.sort((left, right) => left.source_unit_key.localeCompare(right.source_unit_key));
  return terminals;
}

function buildAgreementBindings(calibrationPack, predecessorAuthority) {
  const predecessorByAgreementId = new Map(
    predecessorAuthority.immutable_parent_bindings.m2_m3_m4.map(
      (binding) => [binding.agreement_id, binding],
    ),
  );
  return calibrationPack.comparator_run_bindings.map((run) => (
    predecessorByAgreementId.get(run.agreement_id) ?? agreementBinding(run.agreement_id)
  ));
}

function sealedSubtypeBuckets(sealedRoleSchema) {
  return sealedRoleSchema.subtype_profiles.map(
    (profile) => profile.profile_id.replace('ANTITRUST_REGULATORY::', ''),
  );
}

function buildSubtypeReconciliation(terminals, sealedRoleSchema) {
  const sealedBuckets = sealedSubtypeBuckets(sealedRoleSchema);
  const bucketCounts = Object.fromEntries(CLASSIFICATION_BUCKETS.map((bucket) => [
    bucket,
    terminals.filter((terminal) => terminal.classification_bucket === bucket).length,
  ]));
  const claimScopes = new Set(sealedRoleSchema.subtype_profiles.map(
    (profile) => canonicalJson([...profile.claim_definition_keys].sort()),
  ));
  return {
    comparator_bucket_counts: bucketCounts,
    comparator_bucket_derivation:
      'COMPARATOR_CONCEPT_KEY_AND_CLAIM_DEFINITION_KEY_SOURCE_FIRST',
    concept_and_claim_key_to_bucket: BUCKET_BY_CONCEPT_AND_CLAIM,
    m5_sealed_subtype_profile_ids: sealedRoleSchema.subtype_profiles.map(
      (profile) => profile.profile_id,
    ),
    m5_sealed_subtype_buckets: sealedBuckets,
    m5_subtype_claim_scope_is_uniform_across_subtypes: claimScopes.size === 1,
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

function buildFilingRegimeResiduals(terminals) {
  const regimeRows = terminals.filter(
    (terminal) => terminal.source_closure.members[0].filing_regime_ref !== null,
  );
  const nonHsrRows = regimeRows.filter(
    (terminal) => !HSR_REGIME_PATTERN.test(
      terminal.source_closure.members[0].filing_regime_ref,
    ),
  );
  return {
    comparator_observed_filing_regimes: [...new Set(regimeRows.map(
      (terminal) => terminal.source_closure.members[0].filing_regime_ref,
    ))].sort(),
    hsr_row_count: regimeRows.length - nonHsrRows.length,
    hsr_is_never_aggregated_with_another_regime: true,
    non_hsr_regime_row_count: nonHsrRows.length,
    non_hsr_regime_source_unit_keys: nonHsrRows.map(
      (terminal) => terminal.source_unit_key,
    ).sort(),
    non_hsr_regime_buckets: [...new Set(nonHsrRows.map(
      (terminal) => terminal.classification_bucket,
    ))].sort(),
    regime_is_a_fact_not_a_bucket: true,
    sealed_m5_label_distinguishes_filing_regime: false,
    residual_disposition:
      'NON_HSR_FILING_REGIME_ROWS_SHARE_THE_SEALED_FILING_LABELS_AND_REQUIRE_EXPLICIT_INVENTORY_DISPOSITION',
  };
}

function buildObligorCapacityResiduals(terminals) {
  const oneSidedRows = terminals.filter((terminal) => {
    const capacity = terminal.source_closure.members[0].obligor_capacity;
    return capacity !== null && capacity !== MUTUAL_OBLIGOR_CAPACITY;
  });
  return {
    comparator_observed_obligor_capacities: [...new Set(terminals.map(
      (terminal) => terminal.source_closure.members[0].obligor_capacity,
    ).filter((capacity) => capacity !== null))].sort(),
    mutual_obligor_capacity: MUTUAL_OBLIGOR_CAPACITY,
    one_sided_obligor_row_count: oneSidedRows.length,
    one_sided_obligor_source_unit_keys: oneSidedRows.map(
      (terminal) => terminal.source_unit_key,
    ).sort(),
    obligor_capacity_is_carried_by_a_sealed_required_role: true,
    sealed_required_role_key: 'LEGAL_ACTOR_OR_SUBJECT',
    residual_disposition:
      'OBLIGOR_CAPACITY_IS_FILLED_BY_THE_SEALED_LEGAL_ACTOR_OR_SUBJECT_ROLE_AND_IS_NOT_A_BUCKET_DIVERGENCE',
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
  const predecessorAuthority = readJson(CLOSING_CONDITIONS_PHASE2_PATH);
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
      authority_kind: 'ZERO_EFFECT_ANTITRUST_REGULATORY_PHASE2_PARTITION_AUTHORITY',
      calibration_pack_status: calibrationPack.status,
      comparator_run_count: calibrationPack.comparator_run_bindings.length,
      exact_terminal_rule_count: terminals.length,
      family_key: 'ANTITRUST_REGULATORY',
      legal_ruling_count: 0,
      proposed_on: '2026-08-24',
      purpose:
        'Governed comparator-derived terminal registry for ANTITRUST_REGULATORY Phase 2 partition only',
      sealed_role_schema_binding: fileBinding(
        SEALED_ROLE_SCHEMA_PATH,
        'family_role_schema_id',
      ),
    },
    immutable_predecessor_binding: null,
    immutable_parent_bindings: {
      base_policy: predecessorAuthority.immutable_parent_bindings.base_policy,
      c3: predecessorAuthority.immutable_parent_bindings.c3,
      phase1: predecessorAuthority.immutable_parent_bindings.phase1,
      work3_manifest: predecessorAuthority.immutable_parent_bindings.work3_manifest,
      family_role_policy: fileBinding(FAMILY_ROLE_POLICY_PATH, 'family_policy_id'),
      calibration_pack: {
        path: CALIBRATION_PACK_PATH,
        byte_length: calibrationPackBytes.byteLength,
        sha256: sha256Hex(calibrationPackBytes),
        schema_version: calibrationPack.schema_version,
        record_id_field: 'calibration_pack_id',
        record_id: calibrationPack.calibration_pack_id,
      },
      m2_m3_m4: buildAgreementBindings(calibrationPack, predecessorAuthority),
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
        'ALL_SEVEN_EXAMPLES_TAGGED_EFFORTS_PENDING_LEGAL_GROUPING_REVIEW',
      source_inventory_contract: {
        admitted_m4_claim_count: m4ClaimIds.length,
        terminal_rule_count: terminals.length,
        terminal_rule_registry_path:
          'source_terminal_successor_contract.terminal_rule_registry',
      },
    },
    m5_subtype_reconciliation: buildSubtypeReconciliation(terminals, sealedRoleSchema),
    sealed_claim_scope_residuals: buildScopeResiduals(terminals, sealedRoleSchema),
    filing_regime_residuals: buildFilingRegimeResiduals(terminals),
    obligor_capacity_residuals: buildObligorCapacityResiduals(terminals),
    source_terminal_successor_contract: {
      schema_version: 'STAGE_2Y_ANTITRUST_REGULATORY_TERMINAL_SUCCESSOR_CONTRACT/V1',
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
      state: 'NOT_REQUIRED_FOR_ANTITRUST_REGULATORY_FIRST_SLICE',
    },
    policy_overlay: {
      family_key: 'ANTITRUST_REGULATORY',
      regulatory_covenant_taxonomy_stress:
        'COMPARATOR_CONCEPT_KEY_AND_CLAIM_DEFINITION_KEY_TO_REGULATORY_COVENANT_BUCKET',
      filing_regime_stress: 'HSR_IS_A_SEPARATE_FACT_AND_IS_NEVER_AGGREGATED_WITH_ANOTHER_REGIME',
      burden_versus_efforts_stress:
        'REGULATORY_BURDEN_COMMITMENT_IS_A_DISTINCT_CLAIM_FROM_REGULATORY_EFFORTS_STANDARD',
      obligor_capacity_stress: 'OBLIGOR_CAPACITY_IS_A_ROLE_NOT_A_BUCKET',
      cross_family_boundaries: {
        CLOSING_CONDITIONS:
          'LINK_ONLY_REGULATORY_APPROVAL_CONDITION_SEMANTICS_OWNED_BY_SEALED_CLOSING_CONDITIONS_PACKAGE',
        TERMINATION:
          'LINK_ONLY_REGULATORY_FAILURE_TERMINATION_RIGHTS_OWNED_BY_SEALED_TERMINATION_PACKAGE',
        GENERAL_COVENANTS:
          'LINK_ONLY_NON_REGULATORY_INTERIM_COVENANT_SEMANTICS_OWNED_BY_SEALED_GENERAL_COVENANTS_PACKAGE',
      },
      phase3_reference_frontier: 'DEFERRED_NOT_TERMINATION_FRONTIER',
      temporal_graph_materialisation: 'DEFERRED_NOT_TERMINATION_FRONTIER',
    },
    implementation_contract: {
      authority_envelope: {
        path: OUT_PATH,
        record_id_field: 'antitrust_regulatory_authoring_phase2_authority_id',
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
        terminal_rule_registry_path:
          'source_terminal_successor_contract.terminal_rule_registry',
      },
      compiler_phase2_dispatch_contract: {
        public_seam: 'prepareAntitrustRegulatoryPhase2FamilyProposal',
        module_path: 'lib/canonical-v2/m7-v2-antitrust-regulatory-authoring.js',
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
          'antitrustRegulatoryAuthoringPhase2Authority',
          'governedSources',
        ],
      },
      lifecycle: {
        proposal_state: 'TREE_OUTPUT_INCOMPLETE',
        profile_approval_state: 'UNAPPROVED',
      },
      no_persistence: true,
      output_constants: {
        family_key: 'ANTITRUST_REGULATORY',
        profile_approval_state: 'UNAPPROVED',
        proposal_state: 'TREE_OUTPUT_INCOMPLETE',
        schema_version: 'M7_V2_ANTITRUST_REGULATORY_FAMILY_PROPOSAL/V1',
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
        missing_facade:
          'ANTITRUST_REGULATORY Phase2 proposal facade export is missing.',
      },
      public_seam: 'prepareAntitrustRegulatoryPhase2FamilyProposal',
      reference_target_owner_template_registry: [],
      required_unresolved_items: [
        'ANTITRUST_REGULATORY_Q01_Q02_Q03_OPEN_REQUIRES_BEN_RULING',
        'EXACT_PROFILE_INVENTORY_REQUIRES_SEPARATE_APPROVAL',
        'FILING_REGIME_PARTITION_UNRESOLVED',
        'LEGAL_GROUPING_REVIEW_REQUIRED',
        'M5_SUBTYPE_BUCKET_PARTITION_UNRESOLVED',
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
      family_key: 'ANTITRUST_REGULATORY',
      first_red_test_path:
        'tests/stage-2y-structure-m7-v2-repair-antitrust-regulatory-work3.test.js',
      first_red_test_pattern:
        'Phase2 proposal derives a deterministic unapproved ANTITRUST_REGULATORY partition',
      module_path: 'lib/canonical-v2/m7-v2-antitrust-regulatory-authoring.js',
    },
    record_identity_contract: {
      authority_id_field: 'antitrust_regulatory_authoring_phase2_authority_id',
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
        'Antitrust regulatory first slice has no temporal state machines in Phase 2 authority',
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
    antitrust_regulatory_authoring_phase2_authority_id: contentId(SCHEMA, unsigned),
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
      record_id: record.antitrust_regulatory_authoring_phase2_authority_id,
      terminal_count: record.source_terminal_successor_contract.terminal_rule_registry.length,
      bucket_counts: record.m5_subtype_reconciliation.comparator_bucket_counts,
      buckets_without_sealed_label:
        record.m5_subtype_reconciliation.comparator_buckets_without_sealed_m5_label,
      sealed_labels_without_instance:
        record.m5_subtype_reconciliation.sealed_m5_labels_without_comparator_instance,
      non_hsr_regime_row_count: record.filing_regime_residuals.non_hsr_regime_row_count,
      one_sided_obligor_row_count:
        record.obligor_capacity_residuals.one_sided_obligor_row_count,
    }, null, 2)}\n`,
  );
}

main();
