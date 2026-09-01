#!/usr/bin/env node
/**
 * Emit NO_SHOP Phase 2 authoring authority v2.
 *
 * Three hundred sixty-five governed M4 claims across seven comparator deals
 * (Concho, Metsera, Modiv, Red Hat, Skechers, Skywater, TopBuild). Claim-scale
 * partition — one terminal per governed claim. Milestone A slice A package work
 * filters to NO_SHOP_PROHIBITED_ACTION + NO_SHOP_EXCEPTION_PREREQUISITE (204
 * claims); the Phase 2 registry materialises all 365 terminals.
 *
 * KEY_DEFINED_TERMS owns Acquisition Proposal / Superior Proposal definitions
 * (Q02 link-only). TERMINATION_FEE, PROXY_MEETING, and TERMINATION cross-refs
 * stay link-only — do not absorb.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import canonicalModule from '../lib/canonical-v2/canonical-bytes.js';

const { canonicalJson, contentId, sha256Hex } = canonicalModule;

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');

const SCHEMA =
  'STAGE_2Y_M7_V2_REPAIR_CONTRACT_NO_SHOP_AUTHORING_PHASE2_AUTHORITY/V2';
const OUT_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-no-shop-authoring-phase2-authority-v2.json';
const CALIBRATION_PACK_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/preparation/m5/calibration-packs/NO_SHOP.json';
const FAMILY_ROLE_POLICY_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/family-specific-role-policies-v2/NO_SHOP.json';
const SEALED_ROLE_SCHEMA_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/family-role-schemas/NO_SHOP.json';
const PROGRAMME_RULINGS_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m5-programme-rulings.json';
const CLOSING_CONDITIONS_PHASE2_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-closing-conditions-authoring-phase2-authority-v2.json';

const MODULE_PATH = 'lib/canonical-v2/m7-v2-no-shop-authoring.js';
const TEST_PATH = 'tests/stage-2y-structure-m7-v2-repair-no-shop-work3.test.js';

const SLICE_A_CLAIM_DEFINITION_KEYS = Object.freeze([
  'NO_SHOP_PROHIBITED_ACTION',
  'NO_SHOP_EXCEPTION_PREREQUISITE',
]);

const CLASSIFICATION_BUCKETS = [
  'RESTRICTION',
  'ENGAGEMENT_PERMISSION',
  'NOTICE',
  'STANDSTILL',
  'RECOMMENDATION_CHANGE',
  'SAFE_DISCLOSURE',
  'REPRESENTATIVE_CONTROL',
  'GO_SHOP_WINDOW',
];

const SUBTYPE_BY_CLAIM_DEFINITION_KEY = {
  NO_SHOP_PROHIBITED_ACTION: 'RESTRICTION',
  NO_SHOP_EXCEPTION_PREREQUISITE: 'RESTRICTION',
  NO_SHOP_CEASE_ACTION: 'RESTRICTION',
  NO_SHOP_FIDUCIARY_ENGAGEMENT_STANDARD: 'ENGAGEMENT_PERMISSION',
  NO_SHOP_INITIAL_MATCH_PERIOD_DAYS: 'RESTRICTION',
  NO_SHOP_SUBSEQUENT_MATCH_PERIOD_DAYS: 'RESTRICTION',
  NO_SHOP_RECOMMENDATION_CHANGE_ACTION: 'RECOMMENDATION_CHANGE',
  NO_SHOP_RECOMMENDATION_CHANGE_FIDUCIARY_STANDARD: 'RECOMMENDATION_CHANGE',
  NO_SHOP_RECOMMENDATION_CHANGE_TRIGGER: 'RECOMMENDATION_CHANGE',
  NO_SHOP_RECOMMENDATION_SAFE_DISCLOSURE: 'SAFE_DISCLOSURE',
  NO_SHOP_REPRESENTATIVE_BREACH_ATTRIBUTION: 'REPRESENTATIVE_CONTROL',
  NO_SHOP_REPRESENTATIVE_CONTROL_STANDARD: 'REPRESENTATIVE_CONTROL',
  NO_SHOP_STANDSTILL_ACTION: 'STANDSTILL',
};

const CROSS_FAMILY_LINK_ONLY_BOUNDARIES = [
  {
    agreement_id: null,
    deal: null,
    disposition: 'LINK_ONLY_NOT_A_NO_SHOP_TERMINAL',
    owner_family_key: 'KEY_DEFINED_TERMS',
    ruling_id: 'M5-RULING-ONE-SEMANTIC-OWNER',
    section_reference: null,
    subject: 'ACQUISITION_PROPOSAL_SUPERIOR_PROPOSAL_INTERVENING_EVENT_DEFINITIONS',
  },
  {
    agreement_id: null,
    deal: null,
    disposition: 'LINK_ONLY_NOT_A_NO_SHOP_TERMINAL',
    owner_family_key: 'TERMINATION_FEE',
    ruling_id: 'M5-RULING-ONE-SEMANTIC-OWNER',
    section_reference: null,
    subject: 'RECOMMENDATION_CHANGE_FEE_TRIGGERS',
  },
  {
    agreement_id: null,
    deal: null,
    disposition: 'LINK_ONLY_NOT_A_NO_SHOP_TERMINAL',
    owner_family_key: 'PROXY_MEETING',
    ruling_id: 'M5-RULING-ONE-SEMANTIC-OWNER',
    section_reference: null,
    subject: 'STOCKHOLDER_MEETING_ADJACENCY_ON_RECOMMENDATION_CHANGES',
  },
  {
    agreement_id: null,
    deal: null,
    disposition: 'LINK_ONLY_NOT_A_NO_SHOP_TERMINAL',
    owner_family_key: 'TERMINATION',
    ruling_id: 'M5-RULING-ONE-SEMANTIC-OWNER',
    section_reference: null,
    subject: 'TERMINATION_FOR_SUPERIOR_PROPOSAL_CROSS_REFS',
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
    byte_length: bytes.length,
    path: relativePath,
    sha256: sha256Hex(bytes),
  };
}

function sortedUnique(values) {
  return [...new Set(values)].sort();
}

function classificationPath(bucket) {
  return ['NO_SHOP', bucket];
}

function sectionToken(sectionReference) {
  return (sectionReference ?? 'NULL').replace(/[^0-9A-Za-z]/g, '_');
}

function discriminatorToken(claim) {
  const revision = claim.legacy_claim_revision;
  const attributes = revision?.attributes ?? {};
  if (typeof attributes.action_code === 'string') {
    return attributes.action_code.replace(/[^0-9A-Za-z]/g, '_');
  }
  if (typeof attributes.prerequisite_code === 'string') {
    return attributes.prerequisite_code.replace(/[^0-9A-Za-z]/g, '_');
  }
  if (typeof revision?.ordinal === 'number') return `ORDINAL_${revision.ordinal}`;
  if (typeof attributes.assertion_kind === 'string') return attributes.assertion_kind;
  if (typeof revision?.canonical_value === 'string') return String(revision.canonical_value);
  return claim.analysis_claim_id.slice(0, 8);
}

function requiredExpressionSignature(claim, bucket) {
  const parts = [
    claim.deal.toUpperCase(),
    sectionToken(claim.section_reference),
    claim.claim_definition_key,
    discriminatorToken(claim),
    claim.claim_occurrence_id.slice(0, 8),
  ];
  return `NO_SHOP::${bucket}::${parts.join('_')}`;
}

function sourceUnitKey(claim) {
  return [
    'NO_SHOP',
    claim.deal,
    claim.section_reference ?? 'NULL',
    claim.claim_occurrence_id,
  ].join(':');
}

function buildExampleLookup(calibrationPack) {
  const byClaimId = new Map();
  for (const example of calibrationPack.provision_examples) {
    for (const claimId of example.m4_claim_ids) {
      byClaimId.set(claimId, example);
    }
  }
  return byClaimId;
}

function buildTerminal(claim, node, example) {
  const bucket = SUBTYPE_BY_CLAIM_DEFINITION_KEY[claim.claim_definition_key];
  if (!bucket) {
    throw new Error(`no sealed subtype mapping for ${claim.claim_definition_key}`);
  }
  const revision = claim.legacy_claim_revision;
  const unresolvedItems = ['LEGAL_GROUPING_REVIEW_REQUIRED'];
  if (!example) {
    unresolvedItems.push('COMPARATOR_CLAIM_OUTSIDE_CALIBRATION_PROVISION_EXAMPLES');
  } else if (example.proposed_subtype !== bucket) {
    unresolvedItems.push('SUBTYPE_PARTITION_DIVERGES_FROM_CALIBRATION_PROPOSED_SUBTYPE');
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
    calibration_provision_example_id: example ? example.example_id : null,
    calibration_proposed_subtype: example ? example.proposed_subtype : null,
  };
}

function buildTerminals(calibrationPack, agreementBindings) {
  const exampleByClaimId = buildExampleLookup(calibrationPack);
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
    const claims = m4.claims.filter((claim) => claim.family === 'NO_SHOP');
    for (const claim of claims) {
      const nodeId = claim.source_node_occurrence_ids[0];
      const node = nodesById.get(nodeId);
      if (!node) throw new Error(`missing M2 node ${nodeId} for ${claim.analysis_claim_id}`);
      const example = exampleByClaimId.get(claim.analysis_claim_id) ?? null;
      terminals.push(buildTerminal(claim, node, example));
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
  const closingConditionsAuthority = readJson(CLOSING_CONDITIONS_PHASE2_PATH);
  const closingByAgreementId = new Map(
    closingConditionsAuthority.immutable_parent_bindings.m2_m3_m4.map(
      (binding) => [binding.agreement_id, binding],
    ),
  );
  const agreementIds = sortedUnique(
    calibrationPack.comparator_run_bindings.map((run) => run.agreement_id),
  );
  const agreementBindings = agreementIds.map((agreementId) => {
    const existing = closingByAgreementId.get(agreementId);
    if (!existing) throw new Error(`no sealed M2/M3/M4 binding for ${agreementId}`);
    return existing;
  });

  const terminals = buildTerminals(calibrationPack, agreementBindings);
  const m4ClaimIds = terminals.flatMap((terminal) => terminal.m4_claim_ids);
  const sliceATerminals = terminals.filter((terminal) => {
    const key = terminal.source_closure.members[0].claim_definition_key;
    return SLICE_A_CLAIM_DEFINITION_KEYS.includes(key);
  });
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
      authority_kind: 'ZERO_EFFECT_NO_SHOP_PHASE2_PARTITION_AUTHORITY',
      calibration_pack_status: calibrationPack.status,
      comparator_run_count: calibrationPack.comparator_run_bindings.length,
      exact_terminal_rule_count: terminals.length,
      family_key: 'NO_SHOP',
      legal_ruling_count: 0,
      milestone_a_slice_a_profile_count: sliceATerminals.length,
      milestone_a_slice_scope: 'SLICE_A_PROHIBITED_ACTION_AND_EXCEPTION_PREREQUISITE',
      proposed_on: '2026-08-24',
      purpose: 'Claim-scale comparator terminal registry for NO_SHOP Phase 2 partition only',
      sealed_role_schema_state: sealedRoleSchema.approval_state,
      supplemental_provision_example_count:
        calibrationPack.supplemental_input_bindings.length,
    },
    immutable_predecessor_binding: null,
    immutable_parent_bindings: {
      base_policy: closingConditionsAuthority.immutable_parent_bindings.base_policy,
      c3: closingConditionsAuthority.immutable_parent_bindings.c3,
      phase1: closingConditionsAuthority.immutable_parent_bindings.phase1,
      work3_manifest: closingConditionsAuthority.immutable_parent_bindings.work3_manifest,
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
      schema_version: 'STAGE_2Y_NO_SHOP_TERMINAL_SUCCESSOR_CONTRACT/V1',
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
        'COMPARATOR_CLAIM_BOUND_SIGNATURE_PER_TERMINAL_WITH_ACTION_OR_PREREQUISITE_DISCRIMINATOR',
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
      state: 'NOT_REQUIRED_FOR_NO_SHOP_SLICE_A',
    },
    policy_overlay: {
      cross_family_link_only_boundaries: CROSS_FAMILY_LINK_ONLY_BOUNDARIES,
      family_key: 'NO_SHOP',
      milestone_a_slice_a_claim_definition_keys: [...SLICE_A_CLAIM_DEFINITION_KEYS],
      native_producer_surface_split:
        'NO_SHOP_ASSERTIONS_GOVERNED_PROHIBITED_ACTIONS_AND_EXCEPTION_LADDERS_KEY_DEFINED_TERMS_Q02_LINK_ONLY',
      sealed_ruling_bindings: sealedRoleSchema.ruling_bindings,
      sparse_comparator_stress: 'THREE_HUNDRED_SIXTY_FIVE_GOVERNED_CLAIMS_ACROSS_SEVEN_COMPARATOR_DEALS',
      subtype_partition_stress:
        'CALIBRATION_PACK_TAGS_ALL_SEVEN_EXAMPLES_RESTRICTION_WHILE_CLAIM_KEYS_POPULATE_EIGHT_SUBTYPE_BUCKETS',
      temporal_graph_materialisation: 'DEFERRED_NOT_TERMINATION_FRONTIER',
    },
    implementation_contract: {
      authority_envelope: {
        path: OUT_PATH,
        record_id_field: 'no_shop_authoring_phase2_authority_id',
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
        public_seam: 'prepareNoShopPhase2FamilyProposal',
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
          'noShopAuthoringPhase2Authority',
          'governedSources',
        ],
      },
      lifecycle: {
        proposal_state: 'TREE_OUTPUT_INCOMPLETE',
        profile_approval_state: 'UNAPPROVED',
      },
      milestone_a_slice_contract: {
        active_slice: 'A',
        slice_a_claim_definition_keys: [...SLICE_A_CLAIM_DEFINITION_KEYS],
        slice_a_profile_count: sliceATerminals.length,
        slice_b_through_d_deferred: true,
      },
      no_persistence: true,
      output_constants: {
        family_key: 'NO_SHOP',
        profile_approval_state: 'UNAPPROVED',
        proposal_state: 'TREE_OUTPUT_INCOMPLETE',
        schema_version: 'M7_V2_NO_SHOP_FAMILY_PROPOSAL/V1',
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
        milestone_a_slice_filter: 'SLICE_A_PROHIBITED_ACTION_AND_EXCEPTION_PREREQUISITE',
        one_signature_per_proposed_terminal_leaf: true,
        profile_count_must_be_derived: true,
        profile_count_must_not_be_preassigned: true,
        profile_keys_and_content_ids: sliceATerminals.map((terminal) => ({
          source_unit_key: terminal.source_unit_key,
          required_expression_signature: terminal.required_expression_signature,
        })),
        proposed_partition_is_not_a_profile_tree: true,
        shared_classification_path_allowed: true,
      },
      permitted_identifier_classes: ['INTERNAL_REFERENCE_EDGE_ID'],
      public_error_contract: {
        missing_facade: 'NO_SHOP Phase2 proposal facade export is missing.',
      },
      public_seam: 'prepareNoShopPhase2FamilyProposal',
      reference_target_owner_template_registry: [],
      required_unresolved_items: [
        'EXACT_PROFILE_INVENTORY_REQUIRES_SEPARATE_APPROVAL',
        'LEGAL_GROUPING_REVIEW_REQUIRED',
        'NO_SHOP_Q01_Q02_Q03_BOUND_TO_SEALED_M5_PROGRAMME_RULINGS',
        'NO_SHOP_SLICE_B_THROUGH_D_DEFERRED',
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
      family_key: 'NO_SHOP',
      first_red_test_path: TEST_PATH,
      first_red_test_pattern:
        'Phase2 proposal derives a deterministic unapproved NO_SHOP slice A partition',
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
      authority_id_field: 'no_shop_authoring_phase2_authority_id',
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
      rationale: 'No-Shop slice A has no temporal state machines in Phase 2 authority',
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
    no_shop_authoring_phase2_authority_id: contentId(SCHEMA, unsigned),
  };
}

function main() {
  const record = buildAuthority();
  const body = `${canonicalJson(record)}\n`;
  writeFileSync(path.join(REPO_ROOT, OUT_PATH), body, 'utf8');
  const bytes = Buffer.from(body, 'utf8');
  const sliceA = record.source_terminal_successor_contract.terminal_rule_registry.filter(
    (terminal) => SLICE_A_CLAIM_DEFINITION_KEYS.includes(
      terminal.source_closure.members[0].claim_definition_key,
    ),
  ).length;
  process.stdout.write(`${JSON.stringify({
    path: OUT_PATH,
    schema_version: SCHEMA,
    record_id_field: 'no_shop_authoring_phase2_authority_id',
    record_id: record.no_shop_authoring_phase2_authority_id,
    byte_length: bytes.length,
    sha256: sha256Hex(bytes),
    terminal_count: record.source_terminal_successor_contract.terminal_rule_registry.length,
    slice_a_count: sliceA,
    m4_claim_count: record.source_terminal_successor_contract.admitted_m4_claim_exact_count,
    outside_calibration: record.source_terminal_successor_contract.terminal_rule_registry
      .filter((terminal) => terminal.unresolved_items.includes(
        'COMPARATOR_CLAIM_OUTSIDE_CALIBRATION_PROVISION_EXAMPLES',
      )).length,
    subtype_divergence: record.source_terminal_successor_contract.terminal_rule_registry
      .filter((terminal) => terminal.unresolved_items.includes(
        'SUBTYPE_PARTITION_DIVERGES_FROM_CALIBRATION_PROPOSED_SUBTYPE',
      )).length,
  }, null, 2)}\n`);
}

main();
