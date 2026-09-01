/**
 * Emit DNO_INDEMNIFICATION Phase 2 authoring authority v2 from the M5 calibration
 * pack and seven comparator resolution runs (31 admitted M4 claim terminals).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import canonicalModule from '../lib/canonical-v2/canonical-bytes.js';

const { canonicalJson, contentId, sha256Hex } = canonicalModule;

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');

const SCHEMA =
  'STAGE_2Y_M7_V2_REPAIR_CONTRACT_DNO_INDEMNIFICATION_AUTHORING_PHASE2_AUTHORITY/V2';
const OUT_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-dno-indemnification-authoring-phase2-authority-v2.json';
const CALIBRATION_PACK_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/preparation/m5/calibration-packs/DNO_INDEMNIFICATION.json';
const TERMINATION_PHASE2_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-termination-authoring-phase2-authority-v2.json';

const ITEM42_DECISION_ID =
  'd44da4450537479614de70175996b16a86495de989d1795ed4c01b7cba24412e';
const ITEM42_SOURCE_NODE_ID =
  '005e1651ed5ba5f031509229658f4e9682d95f1b59ce894bfb4f319388ad9ad4';
const ITEM42_44_AGREEMENT_ID =
  'f4a123d7c2bd8ba6358499dd9870513c8bac6a6893985bf5a581a536af280d71';

const CLASSIFICATION_BUCKETS = [
  'INDEMNIFICATION_AND_EXCULPATION',
  'EXPENSE_ADVANCEMENT',
  'CHARTER_AND_CONTRACT_CONTINUATION',
  'DNO_INSURANCE_TAIL',
  'CLAIMS_PROCEDURE',
  'SUCCESSOR_ASSUMPTION',
  'THIRD_PARTY_ENFORCEMENT',
];

const CLAIM_TO_BUCKET = Object.freeze({
  INDEMNIFICATION_CONTINUATION: 'INDEMNIFICATION_AND_EXCULPATION',
  INDEMNIFICATION_SURVIVAL_YEARS: 'INDEMNIFICATION_AND_EXCULPATION',
  ADVANCEMENT_OF_EXPENSES: 'EXPENSE_ADVANCEMENT',
  CHARTER_PROTECTION_CONTINUATION: 'CHARTER_AND_CONTRACT_CONTINUATION',
  TAIL_POLICY_OBLIGATION: 'DNO_INSURANCE_TAIL',
  TAIL_POLICY_PERIOD_YEARS: 'DNO_INSURANCE_TAIL',
  TAIL_PREMIUM_CAP_OFF_AGREEMENT: 'DNO_INSURANCE_TAIL',
  TAIL_PREMIUM_CAP_PERCENT: 'DNO_INSURANCE_TAIL',
  COVERED_PERSON_TPB_RIGHTS: 'THIRD_PARTY_ENFORCEMENT',
});

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(REPO_ROOT, relativePath), 'utf8'));
}

function fileBinding(relativePath, recordIdField) {
  const absolutePath = path.join(REPO_ROOT, relativePath);
  const bytes = readFileSync(absolutePath);
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
  const m2Record = readJson(m2Path);
  const sourceBinding = m2Record.source_binding;
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
  return ['DNO_INDEMNIFICATION', 'INDEMNIFICATION_AND_EXCULPATION', bucket];
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
  claimDefinitionKey,
  m4ClaimId,
  provisionInstance,
  claimRevisionId,
  sectionReference,
}) {
  const bucket = CLAIM_TO_BUCKET[claimDefinitionKey];
  if (!bucket) {
    throw new Error(`Unmapped claim definition key: ${claimDefinitionKey}`);
  }
  const sourceUnitKey = contentId('DNO_INDEMNIFICATION_TERMINAL_SOURCE_UNIT/V1', {
    agreement_id: agreementId,
    claim_definition_key: claimDefinitionKey,
    m4_claim_id: m4ClaimId,
    claim_revision_id: claimRevisionId,
  });
  const signature = `ALL_OF(DNO_INDEMNIFICATION,${claimDefinitionKey},${deal.toUpperCase()})`;
  const sourceOccurrenceId = provisionInstance.source_occurrence_id;
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
        source_node_occurrence_id: sourceOccurrenceId,
        provision_instance_id: provisionInstance.provision_instance_id,
        claim_definition_key: claimDefinitionKey,
        claim_revision_id: claimRevisionId,
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
    const dnoClaims = m4.claims.filter((claim) => claim.family === 'DNO_INDEMNIFICATION');
    const claimsByDefinition = new Map(
      dnoClaims.map((claim) => [claim.claim_definition_key, claim]),
    );
    for (const entry of resolution.resolved) {
      const claimDefinitionKey = entry.resolved_claim_definition_key
        || entry.claim.claim_definition_key;
      const m4Claim = claimsByDefinition.get(claimDefinitionKey);
      if (!m4Claim) {
        throw new Error(
          `${run.deal}:${claimDefinitionKey} missing from M4 DNO_INDEMNIFICATION claims`,
        );
      }
      terminals.push(buildTerminal({
        agreementId: run.agreement_id,
        deal: run.deal,
        claimDefinitionKey,
        m4ClaimId: m4Claim.analysis_claim_id,
        provisionInstance: entry.provision_instance,
        claimRevisionId: entry.claim.claim_revision_id,
        sectionReference: entry.section_reference,
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
  return calibrationPack.comparator_run_bindings.map((run) => {
    const existing = terminationByAgreementId.get(run.agreement_id);
    if (existing) return existing;
    return agreementBinding(run.agreement_id);
  });
}

function buildAuthority() {
  const calibrationPack = readJson(CALIBRATION_PACK_PATH);
  const terminationAuthority = readJson(TERMINATION_PHASE2_PATH);
  const terminals = buildTerminals(calibrationPack);
  const m4ClaimIds = terminals.flatMap((terminal) => terminal.m4_claim_ids);
  const agreementTerminalCounts = Object.fromEntries(
    calibrationPack.comparator_run_bindings.map((run) => [
      run.agreement_id,
      run.expected_counts.resolution_claims,
    ]),
  );

  const classificationPathRegistry = CLASSIFICATION_BUCKETS.map((bucket) => ({
    classification_bucket: bucket,
    classification_path: classificationPath(bucket),
  }));

  const unsigned = {
    schema_version: SCHEMA,
    authority_state: 'PROPOSED_AWAITING_BEN_CALIBRATION_APPROVAL',
    approval_basis: {
      authority_kind: 'ZERO_EFFECT_DNO_INDEMNIFICATION_PHASE2_PARTITION_AUTHORITY',
      calibration_pack_status: calibrationPack.status,
      comparator_run_count: calibrationPack.comparator_run_bindings.length,
      exact_terminal_rule_count: terminals.length,
      family_key: 'DNO_INDEMNIFICATION',
      item_42_additive_identity_preserved: true,
      legal_ruling_count: 0,
      proposed_on: '2026-08-24',
      purpose:
        'Governed comparator-derived terminal registry for DNO_INDEMNIFICATION Phase 2 partition only',
    },
    immutable_predecessor_binding: null,
    immutable_parent_bindings: {
      base_policy: terminationAuthority.immutable_parent_bindings.base_policy,
      c3: terminationAuthority.immutable_parent_bindings.c3,
      phase1: terminationAuthority.immutable_parent_bindings.phase1,
      work3_manifest: terminationAuthority.immutable_parent_bindings.work3_manifest,
      family_role_policy: fileBinding(
        'evidence/canonical-v2/stage-2y-structure-migration/control/family-specific-role-policies-v2/DNO_INDEMNIFICATION.json',
        'family_policy_id',
      ),
      calibration_pack: {
        path: CALIBRATION_PACK_PATH,
        byte_length: readFileSync(path.join(REPO_ROOT, CALIBRATION_PACK_PATH)).byteLength,
        sha256: sha256Hex(readFileSync(path.join(REPO_ROOT, CALIBRATION_PACK_PATH))),
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
      source_inventory_contract: {
        admitted_m4_claim_count: m4ClaimIds.length,
        terminal_rule_count: terminals.length,
        terminal_rule_registry_path:
          'source_terminal_successor_contract.terminal_rule_registry',
      },
      topbuild_scope: {
        agreement_id: '3888fa7618bbd9fd6530b657aaa18c7e85ff515acf80edb1fc78a190af86e9cb',
        included: true,
      },
    },
    source_terminal_successor_contract: {
      schema_version: 'STAGE_2Y_DNO_INDEMNIFICATION_TERMINAL_SUCCESSOR_CONTRACT/V1',
      state: 'COMPLETE',
      admitted_m4_claim_exact_count: m4ClaimIds.length,
      analysis_fact_or_operator_evidence_forbidden: true,
      classification_path_registry: classificationPathRegistry,
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
      state: 'NOT_REQUIRED_FOR_DNO_FIRST_SLICE',
    },
    policy_overlay: {
      family_key: 'DNO_INDEMNIFICATION',
      item_42_additive_identity_contract: {
        decision_id: ITEM42_DECISION_ID,
        source_node_id: ITEM42_SOURCE_NODE_ID,
        agreement_id: ITEM42_44_AGREEMENT_ID,
        shared_source_profile_keys: [
          'PROFILE:DNO_INDEMNIFICATION:RIGHTS_SURVIVAL',
          'PROFILE:DNO_INDEMNIFICATION:NO_ADVERSE_AMENDMENT',
        ],
        preservation_rule: 'CONTRACT_SEALED_ITEM42_DECISION_ID_BYTE_SPANS_UNCHANGED',
      },
      linked_duty_stress: 'SAME_SOURCE_DISTINCT_LEGAL_EFFECT_ROLE',
      temporal_graph_materialisation: 'DEFERRED_NOT_TERMINATION_FRONTIER',
    },
    implementation_contract: {
      authority_envelope: {
        path: OUT_PATH,
        record_id_field: 'dno_indemnification_authoring_phase2_authority_id',
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
        public_seam: 'prepareDnoIndemnificationPhase2FamilyProposal',
        module_path: 'lib/canonical-v2/m7-v2-dno-indemnification-authoring.js',
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
          'dnoIndemnificationAuthoringPhase2Authority',
          'governedSources',
        ],
      },
      lifecycle: {
        proposal_state: 'TREE_OUTPUT_INCOMPLETE',
        profile_approval_state: 'UNAPPROVED',
      },
      no_persistence: true,
      output_constants: {
        family_key: 'DNO_INDEMNIFICATION',
        profile_approval_state: 'UNAPPROVED',
        proposal_state: 'TREE_OUTPUT_INCOMPLETE',
        schema_version: 'M7_V2_DNO_INDEMNIFICATION_FAMILY_PROPOSAL/V1',
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
          'DNO_INDEMNIFICATION Phase2 proposal facade export is missing.',
      },
      public_seam: 'prepareDnoIndemnificationPhase2FamilyProposal',
      reference_target_owner_template_registry: [],
      required_unresolved_items: [
        'EXACT_PROFILE_INVENTORY_REQUIRES_SEPARATE_APPROVAL',
        'DNO_INDEMNIFICATION_Q01_Q02_Q03_OPEN_REQUIRES_BEN_RULING',
        'LINKED_DUTY_SHARED_SOURCE_REVIEW_UNAPPROVED',
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
      family_key: 'DNO_INDEMNIFICATION',
      first_red_test_path: 'tests/stage-2y-structure-m7-v2-repair-dno-work3.test.js',
      first_red_test_pattern:
        'Phase2 proposal derives a deterministic unapproved DNO_INDEMNIFICATION partition',
      module_path: 'lib/canonical-v2/m7-v2-dno-indemnification-authoring.js',
    },
    record_identity_contract: {
      authority_id_field: 'dno_indemnification_authoring_phase2_authority_id',
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
      rationale: 'DNO first slice has no temporal state machines in Phase 2 authority',
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

  const authorityId = contentId(SCHEMA, unsigned);
  return {
    ...unsigned,
    dno_indemnification_authoring_phase2_authority_id: authorityId,
  };
}

function main() {
  const record = buildAuthority();
  const body = `${canonicalJson(record)}\n`;
  const outAbsolute = path.join(REPO_ROOT, OUT_PATH);
  writeFileSync(outAbsolute, body, 'utf8');
  const bytes = readFileSync(outAbsolute);
  process.stdout.write(
    `${JSON.stringify({
      path: OUT_PATH,
      byte_length: bytes.byteLength,
      sha256: sha256Hex(bytes),
      record_id: record.dno_indemnification_authoring_phase2_authority_id,
      terminal_count: record.source_terminal_successor_contract.terminal_rule_registry.length,
    })}\n`,
  );
}

main();
