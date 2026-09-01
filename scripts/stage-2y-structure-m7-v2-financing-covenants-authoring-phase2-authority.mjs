#!/usr/bin/env node
/**
 * Emit FINANCING_COVENANTS Phase 2 authoring authority v2.
 *
 * The family has a sparse comparator set: five governed M4 claims across three
 * comparator deals (Concho, Skechers, TopBuild). The terminal registry is
 * claim-scale — one terminal per governed comparator claim — because the two
 * Concho payoff lead-time claims share one printed section but carry different
 * delivery stages, so a section-scale partition would silently fold them.
 *
 * TopBuild s7.16 (financing-source waiver) stays with GUARANTY_FINANCING_PARTY
 * under the sealed cross-family title rule; it is recorded as a link-only
 * boundary, never as a Financing Covenants terminal.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import canonicalModule from '../lib/canonical-v2/canonical-bytes.js';

const { canonicalJson, contentId, sha256Hex } = canonicalModule;

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');

const SCHEMA =
  'STAGE_2Y_M7_V2_REPAIR_CONTRACT_FINANCING_COVENANTS_AUTHORING_PHASE2_AUTHORITY/V2';
const OUT_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-financing-covenants-authoring-phase2-authority-v2.json';
const CALIBRATION_PACK_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/preparation/m5/calibration-packs/FINANCING_COVENANTS.json';
const FAMILY_ROLE_POLICY_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/family-specific-role-policies-v2/FINANCING_COVENANTS.json';
const SEALED_ROLE_SCHEMA_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/family-role-schemas/FINANCING_COVENANTS.json';
const PROGRAMME_RULINGS_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m5-programme-rulings.json';
const TERMINATION_PHASE2_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-termination-authoring-phase2-authority-v2.json';

const MODULE_PATH = 'lib/canonical-v2/m7-v2-financing-covenants-authoring.js';
const TEST_PATH = 'tests/stage-2y-structure-m7-v2-repair-financing-covenants-work3.test.js';

/** Every sealed M5 subtype bucket, populated or not. */
const CLASSIFICATION_BUCKETS = [
  'OBTAIN_FINANCING',
  'ALTERNATIVE_FINANCING',
  'TARGET_COOPERATION',
  'PAYOFF',
  'NO_FINANCING_CONDITION',
  'NOTE_OFFER_OR_CONSENT',
  'COST_AND_RISK_ALLOCATION',
];

/**
 * Claim definition key -> sealed subtype bucket. The sealed role schema admits
 * all three claim keys under every subtype, so this mapping is a proposal that
 * Ben must confirm; every derived profile therefore carries
 * LEGAL_GROUPING_REVIEW_REQUIRED.
 */
const SUBTYPE_BY_CLAIM_DEFINITION_KEY = {
  FINANCING_OBTAIN_EFFORTS_STANDARD: 'OBTAIN_FINANCING',
  NO_FINANCING_CONDITION_ACKNOWLEDGMENT: 'NO_FINANCING_CONDITION',
  PAYOFF_DELIVERY_LEAD_TIME_DAYS: 'PAYOFF',
};

const CROSS_FAMILY_LINK_ONLY_BOUNDARIES = [
  {
    agreement_id: '3888fa7618bbd9fd6530b657aaa18c7e85ff515acf80edb1fc78a190af86e9cb',
    deal: 'topbuild',
    disposition: 'LINK_ONLY_NOT_A_FINANCING_COVENANTS_TERMINAL',
    owner_family_key: 'GUARANTY_FINANCING_PARTY',
    ruling_id: 'M5-RULING-ONE-SEMANTIC-OWNER',
    section_reference: '7.16',
    subject: 'FINANCING_SOURCE_PROTECTION_WAIVER',
  },
];

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

function digestBinding(relativePath) {
  const bytes = readFileSync(path.join(REPO_ROOT, relativePath));
  return {
    byte_length: bytes.byteLength,
    path: relativePath,
    sha256: sha256Hex(bytes),
  };
}

function sortedUnique(values) {
  return [...new Set(values)].sort();
}

function classificationPath(bucket) {
  return ['FINANCING_COVENANTS', bucket];
}

function sectionToken(sectionReference) {
  return sectionReference.replace(/[^0-9A-Za-z]/g, '_');
}

function stageToken(claim) {
  const attributes = claim.legacy_claim_revision?.attributes ?? {};
  if (typeof attributes.delivery_stage === 'string') return attributes.delivery_stage;
  if (typeof attributes.standard_code === 'string') return attributes.standard_code;
  return null;
}

/**
 * A signature must be unique per terminal. Concho s6.17 carries two payoff
 * lead-time claims, distinguished only by delivery stage, so the stage token is
 * appended wherever the claim carries one.
 */
function requiredExpressionSignature(claim, bucket) {
  const parts = [
    claim.deal.toUpperCase(),
    sectionToken(claim.section_reference),
    claim.claim_definition_key,
  ];
  const stage = stageToken(claim);
  if (stage) parts.push(stage);
  return `FINANCING_COVENANTS::${bucket}::${parts.join('_')}`;
}

function sourceUnitKey(claim) {
  return [
    'FINANCING_COVENANTS',
    claim.deal,
    claim.section_reference,
    claim.claim_occurrence_id,
  ].join(':');
}

function buildTerminal(claim, node, calibrationExampleId) {
  const bucket = SUBTYPE_BY_CLAIM_DEFINITION_KEY[claim.claim_definition_key];
  if (!bucket) {
    throw new Error(`no sealed subtype mapping for ${claim.claim_definition_key}`);
  }
  const revision = claim.legacy_claim_revision;
  const unresolvedItems = ['LEGAL_GROUPING_REVIEW_REQUIRED'];
  if (calibrationExampleId === null) {
    unresolvedItems.push('COMPARATOR_CLAIM_OUTSIDE_CALIBRATION_PROVISION_EXAMPLES');
  }
  return {
    source_unit_key: sourceUnitKey(claim),
    agreement_id: claim.agreement_id,
    classification_bucket: bucket,
    classification_path: classificationPath(bucket),
    m4_claim_ids: [claim.analysis_claim_id],
    m4_silent_source_row_keys: [],
    source_closure: {
      members: [{
        agreement_id: claim.agreement_id,
        claim_definition_key: claim.claim_definition_key,
        claim_occurrence_id: claim.claim_occurrence_id,
        claim_revision_id: revision.claim_revision_id,
        closure_role: 'COMPARATOR_GOVERNED_CLAIM',
        deal: claim.deal,
        node_kind: node.node_kind,
        section_reference: claim.section_reference,
        source_node_occurrence_id: node.node_occurrence_id,
        source_span: node.extent_span,
      }],
    },
    signature_binding_kind: 'COMPARATOR_DERIVED',
    required_expression_signature: requiredExpressionSignature(claim, bucket),
    linked_rule_bindings: [],
    dependency_contracts: {
      defined_term_dependencies: [],
      reference_dependencies: [],
      structural_dependencies: [],
    },
    qualification_contracts: [],
    temporal_contracts: [],
    unresolved_items: unresolvedItems,
    calibration_provision_example_id: calibrationExampleId,
    calibration_proposed_subtype: calibrationExampleId === null
      ? null
      : 'OBTAIN_FINANCING',
  };
}

function buildTerminals(calibrationPack, agreementBindings) {
  const exampleByAgreementAndSection = new Map();
  for (const example of calibrationPack.provision_examples) {
    exampleByAgreementAndSection.set(
      `${example.agreement_id}:${example.printed_reference}`,
      example,
    );
  }
  const comparatorAgreementIds = calibrationPack.comparator_run_bindings.map(
    (run) => run.agreement_id,
  );
  const terminals = [];
  for (const agreementId of comparatorAgreementIds) {
    const binding = agreementBindings.find((entry) => entry.agreement_id === agreementId);
    if (!binding) throw new Error(`missing agreement binding for ${agreementId}`);
    const m2 = readJson(binding.m2.path);
    const m4 = readJson(binding.m4.path);
    const nodesById = new Map(m2.nodes.map((node) => [node.node_occurrence_id, node]));
    const claims = m4.claims.filter((claim) => claim.family === 'FINANCING_COVENANTS');
    for (const claim of claims) {
      const nodeId = claim.source_node_occurrence_ids[0];
      const node = nodesById.get(nodeId);
      if (!node) throw new Error(`missing M2 node ${nodeId} for ${claim.analysis_claim_id}`);
      const example = exampleByAgreementAndSection.get(
        `${agreementId}:${claim.section_reference}`,
      ) ?? null;
      terminals.push(buildTerminal(claim, node, example ? example.example_id : null));
    }
  }
  terminals.sort((left, right) => (
    left.source_unit_key < right.source_unit_key ? -1
      : left.source_unit_key > right.source_unit_key ? 1 : 0
  ));
  return terminals;
}

function buildAuthority() {
  const calibrationPack = readJson(CALIBRATION_PACK_PATH);
  const sealedRoleSchema = readJson(SEALED_ROLE_SCHEMA_PATH);
  const terminationAuthority = readJson(TERMINATION_PHASE2_PATH);
  const terminationByAgreementId = new Map(
    terminationAuthority.immutable_parent_bindings.m2_m3_m4.map(
      (binding) => [binding.agreement_id, binding],
    ),
  );
  const agreementIds = sortedUnique(
    calibrationPack.comparator_run_bindings.map((run) => run.agreement_id),
  );
  const agreementBindings = agreementIds.map((agreementId) => {
    const existing = terminationByAgreementId.get(agreementId);
    if (!existing) throw new Error(`no sealed M2/M3/M4 binding for ${agreementId}`);
    return existing;
  });

  const terminals = buildTerminals(calibrationPack, agreementBindings);
  const m4ClaimIds = terminals.flatMap((terminal) => terminal.m4_claim_ids);
  const agreementTerminalCounts = Object.fromEntries(
    sortedUnique(terminals.map((terminal) => terminal.agreement_id)).map((agreementId) => [
      agreementId,
      terminals.filter((terminal) => terminal.agreement_id === agreementId).length,
    ]),
  );
  const populatedBuckets = sortedUnique(
    terminals.map((terminal) => terminal.classification_bucket),
  );

  const unsigned = {
    schema_version: SCHEMA,
    authority_state: 'PROPOSED_AWAITING_BEN_CALIBRATION_APPROVAL',
    approval_basis: {
      authority_kind: 'ZERO_EFFECT_FINANCING_COVENANTS_PHASE2_PARTITION_AUTHORITY',
      calibration_pack_status: calibrationPack.status,
      comparator_run_count: calibrationPack.comparator_run_bindings.length,
      exact_terminal_rule_count: terminals.length,
      family_key: 'FINANCING_COVENANTS',
      legal_ruling_count: 0,
      proposed_on: '2026-08-24',
      purpose:
        'Claim-scale comparator terminal registry for FINANCING_COVENANTS Phase 2 partition only',
      sealed_role_schema_state: sealedRoleSchema.approval_state,
      supplemental_provision_example_count:
        calibrationPack.supplemental_input_bindings.length,
    },
    immutable_predecessor_binding: null,
    immutable_parent_bindings: {
      base_policy: terminationAuthority.immutable_parent_bindings.base_policy,
      c3: terminationAuthority.immutable_parent_bindings.c3,
      phase1: terminationAuthority.immutable_parent_bindings.phase1,
      work3_manifest: terminationAuthority.immutable_parent_bindings.work3_manifest,
      family_role_policy: fileBinding(FAMILY_ROLE_POLICY_PATH, 'family_policy_id'),
      calibration_pack: fileBinding(CALIBRATION_PACK_PATH, 'calibration_pack_id'),
      m2_m3_m4: agreementBindings,
    },
    calibration_source_contract: {
      account_each_admitted_m4_claim_exactly_once: true,
      account_each_independent_in_scope_m2_terminal_limb_exactly_once: true,
      comparator_deal_scope: calibrationPack.comparator_run_bindings.map((run) => ({
        agreement_id: run.agreement_id,
        comparator_run_identifier: run.run_identifier,
        deal: run.deal,
        expected_resolution_claims: run.expected_counts.resolution_claims,
        included: true,
      })),
      exact_calibration_claim_count: m4ClaimIds.length,
      exact_examples: calibrationPack.provision_examples,
      expected_complete_agreement_closure_count: agreementBindings.length,
      expected_m4_silent_terminal_count: 0,
      profile_count_derived_not_assumed: true,
      source_inventory_contract: {
        admitted_m4_claim_count: m4ClaimIds.length,
        terminal_rule_count: terminals.length,
        terminal_rule_registry_path:
          'source_terminal_successor_contract.terminal_rule_registry',
      },
    },
    source_terminal_successor_contract: {
      schema_version: 'STAGE_2Y_FINANCING_COVENANTS_TERMINAL_SUCCESSOR_CONTRACT/V1',
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
      populated_classification_buckets: populatedBuckets,
      registered_classification_bucket_count: CLASSIFICATION_BUCKETS.length,
      required_expression_signature_semantics:
        'COMPARATOR_CLAIM_BOUND_SIGNATURE_PER_TERMINAL_WITH_DELIVERY_STAGE_DISCRIMINATOR',
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
        'calibration_provision_example_id',
        'calibration_proposed_subtype',
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
      state: 'NOT_REQUIRED_FOR_FINANCING_COVENANTS_FIRST_SLICE',
    },
    policy_overlay: {
      cross_family_link_only_boundaries: CROSS_FAMILY_LINK_ONLY_BOUNDARIES,
      family_key: 'FINANCING_COVENANTS',
      native_producer_surface_split:
        'FINANCING_ASSERTIONS_GOVERNED_FINANCING_MECHANICS_EVIDENCE_ONLY',
      sealed_ruling_bindings: sealedRoleSchema.ruling_bindings,
      sparse_comparator_stress: 'FIVE_GOVERNED_CLAIMS_ACROSS_THREE_COMPARATOR_DEALS',
      subtype_partition_stress:
        'CALIBRATION_PACK_TAGS_ALL_THREE_EXAMPLES_OBTAIN_FINANCING_WHILE_CLAIM_KEYS_SPLIT_PAYOFF_AND_NO_FINANCING_CONDITION',
      temporal_graph_materialisation: 'DEFERRED_NOT_TERMINATION_FRONTIER',
    },
    implementation_contract: {
      authority_envelope: {
        path: OUT_PATH,
        record_id_field: 'financing_covenants_authoring_phase2_authority_id',
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
        module_path: MODULE_PATH,
        public_seam: 'prepareFinancingCovenantsPhase2FamilyProposal',
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
          'financingCovenantsAuthoringPhase2Authority',
          'governedSources',
        ],
      },
      lifecycle: {
        proposal_state: 'TREE_OUTPUT_INCOMPLETE',
        profile_approval_state: 'UNAPPROVED',
      },
      no_persistence: true,
      output_constants: {
        family_key: 'FINANCING_COVENANTS',
        profile_approval_state: 'UNAPPROVED',
        proposal_state: 'TREE_OUTPUT_INCOMPLETE',
        schema_version: 'M7_V2_FINANCING_COVENANTS_FAMILY_PROPOSAL/V1',
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
        missing_facade: 'FINANCING_COVENANTS Phase2 proposal facade export is missing.',
      },
      public_seam: 'prepareFinancingCovenantsPhase2FamilyProposal',
      reference_target_owner_template_registry: [],
      required_unresolved_items: [
        'EXACT_PROFILE_INVENTORY_REQUIRES_SEPARATE_APPROVAL',
        'FINANCING_COVENANTS_Q01_Q02_Q03_BOUND_TO_SEALED_M5_PROGRAMME_RULINGS',
        'LEGAL_GROUPING_REVIEW_REQUIRED',
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
      family_key: 'FINANCING_COVENANTS',
      first_red_test_path: TEST_PATH,
      first_red_test_pattern:
        'Phase2 proposal derives a deterministic unapproved FINANCING_COVENANTS partition',
      module_path: MODULE_PATH,
    },
    m5_gate_reconciliation: {
      calibration_pack_status: calibrationPack.status,
      programme_rulings_binding: digestBinding(PROGRAMME_RULINGS_PATH),
      reconciliation:
        'CALIBRATION_PACK_Q01_Q03_REMAIN_OPEN_WHILE_SEALED_ROLE_SCHEMA_BINDS_PROGRAMME_RULINGS',
      sealed_role_schema_binding: digestBinding(SEALED_ROLE_SCHEMA_PATH),
      sealed_role_schema_state: sealedRoleSchema.approval_state,
      profile_set_v1_claim_permitted: false,
    },
    record_identity_contract: {
      authority_id_field: 'financing_covenants_authoring_phase2_authority_id',
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
        'Financing Covenants first slice has no temporal state machines in Phase 2 authority',
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
    financing_covenants_authoring_phase2_authority_id: contentId(SCHEMA, unsigned),
  };
}

function main() {
  const record = buildAuthority();
  const body = `${canonicalJson(record)}\n`;
  writeFileSync(path.join(REPO_ROOT, OUT_PATH), body, 'utf8');
  const bytes = Buffer.from(body, 'utf8');
  process.stdout.write(`${JSON.stringify({
    path: OUT_PATH,
    schema_version: SCHEMA,
    record_id_field: 'financing_covenants_authoring_phase2_authority_id',
    record_id: record.financing_covenants_authoring_phase2_authority_id,
    byte_length: bytes.length,
    sha256: sha256Hex(bytes),
    terminal_count: record.source_terminal_successor_contract.terminal_rule_registry.length,
    m4_claim_count: record.source_terminal_successor_contract.admitted_m4_claim_exact_count,
    signatures: record.source_terminal_successor_contract.terminal_rule_registry.map(
      (terminal) => terminal.required_expression_signature,
    ),
  }, null, 2)}\n`);
}

main();
