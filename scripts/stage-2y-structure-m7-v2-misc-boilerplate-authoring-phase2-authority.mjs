#!/usr/bin/env node
/**
 * Emit MISC_BOILERPLATE Phase 2 authoring authority v2.
 *
 * One hundred fourteen governed M4 claims across six comparator deals (Concho,
 * Metsera, Modiv, Skechers, Skywater, TopBuild). Claim-scale partition — one
 * terminal per governed claim. Termination rights-survival rows on shared
 * sections stay link-only under Q02.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import canonicalModule from '../lib/canonical-v2/canonical-bytes.js';

const { canonicalJson, contentId, sha256Hex } = canonicalModule;

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');

const SCHEMA =
  'STAGE_2Y_M7_V2_REPAIR_CONTRACT_MISC_BOILERPLATE_AUTHORING_PHASE2_AUTHORITY/V2';
const OUT_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-misc-boilerplate-authoring-phase2-authority-v2.json';
const CALIBRATION_PACK_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/preparation/m5/calibration-packs/MISC_BOILERPLATE.json';
const FAMILY_ROLE_POLICY_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/family-specific-role-policies-v2/MISC_BOILERPLATE.json';
const SEALED_ROLE_SCHEMA_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/family-role-schemas/MISC_BOILERPLATE.json';
const PROGRAMME_RULINGS_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m5-programme-rulings.json';
const REPRESENTATIONS_PHASE2_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-representations-authoring-phase2-authority-v2.json';

const MODULE_PATH = 'lib/canonical-v2/m7-v2-misc-boilerplate-authoring.js';
const TEST_PATH = 'tests/stage-2y-structure-m7-v2-repair-misc-boilerplate-work3.test.js';

const CLASSIFICATION_BUCKETS = [
  'GOVERNING_LAW',
  'FORUM',
  'ASSIGNMENT',
  'AMENDMENT_WAIVER',
  'NOTICE',
  'ENTIRE_AGREEMENT',
  'THIRD_PARTY_BENEFICIARY',
  'SEVERABILITY',
  'COUNTERPARTS',
  'SURVIVAL',
  'CONSTRUCTION',
  'EXPENSES',
];

const ASSERTION_KIND_TO_BUCKET = Object.freeze({
  GOVERNING_LAW: 'GOVERNING_LAW',
  FORUM_FALLBACK: 'FORUM',
  ASSIGNMENT_DETAIL: 'ASSIGNMENT',
  NOTICE: 'NOTICE',
  TPB_EXCEPTION: 'THIRD_PARTY_BENEFICIARY',
});

const CROSS_FAMILY_LINK_ONLY_BOUNDARIES = [
  {
    disposition: 'LINK_ONLY_NOT_A_MISC_BOILERPLATE_TERMINAL',
    owner_family_key: 'TERMINATION',
    ruling_id: 'M5-RULING-ONE-SEMANTIC-OWNER',
    subject: 'RIGHTS_SURVIVAL_ON_SHARED_SECTION',
  },
];

function bucketFromChapeau(chapeau) {
  const heading = (chapeau || '').toLowerCase();
  if (/severabilit/.test(heading)) return 'SEVERABILITY';
  if (/entire agreement|integration/.test(heading)) return 'ENTIRE_AGREEMENT';
  if (/counterpart/.test(heading)) return 'COUNTERPARTS';
  if (/survival|nonsurvival|non-survival|non survival/.test(heading)) return 'SURVIVAL';
  if (/amendment|waiver|extension; waiver|modification/.test(heading)) return 'AMENDMENT_WAIVER';
  if (/expense|fees and expenses|costs and expenses/.test(heading)) return 'EXPENSES';
  if (/interpretation|construction|rules of construction|caption|no limitation/.test(heading)) {
    return 'CONSTRUCTION';
  }
  if (/governing law|venue|jurisdiction|jury trial|enforcement/.test(heading)) return 'FORUM';
  if (/confidential/.test(heading)) return 'AMENDMENT_WAIVER';
  if (/affiliate liability|specific enforcement/.test(heading)) return 'AMENDMENT_WAIVER';
  return null;
}

function classificationBucketForClaim(claim, citationContext) {
  const assertionKind = claim.legacy_claim_revision?.attributes?.assertion_kind;
  if (typeof assertionKind === 'string' && ASSERTION_KIND_TO_BUCKET[assertionKind]) {
    return ASSERTION_KIND_TO_BUCKET[assertionKind];
  }
  const fromChapeau = bucketFromChapeau(citationContext?.parent_chapeau_quote);
  if (fromChapeau) return fromChapeau;
  if (assertionKind === 'WAIVER_OR_SURVIVAL') return 'AMENDMENT_WAIVER';
  if (assertionKind === 'CONSTRUCTION_OR_EXPENSES') return 'CONSTRUCTION';
  throw new Error(`no sealed subtype mapping for ${claim.claim_definition_key} / ${assertionKind ?? 'none'}`);
}

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

function sortedUnique(values) {
  return [...new Set(values)].sort();
}

function classificationPath(bucket) {
  return ['MISC_BOILERPLATE', bucket];
}

function sectionToken(sectionReference) {
  return sectionReference.replace(/[^0-9A-Za-z]/g, '_');
}

function discriminatorToken(claim) {
  const revision = claim.legacy_claim_revision;
  const attributes = revision?.attributes ?? {};
  if (typeof attributes.assertion_kind === 'string') return attributes.assertion_kind;
  if (typeof attributes.step_kind === 'string') return attributes.step_kind;
  if (typeof revision?.ordinal === 'number') return `ORDINAL_${revision.ordinal}`;
  return claim.claim_occurrence_id.slice(0, 8);
}

function citationToken(sourceCitation) {
  return (sourceCitation ?? '').replace(/[^0-9A-Za-z]/g, '_');
}

function requiredExpressionSignature(claim, bucket, sourceCitation) {
  const parts = [
    claim.deal.toUpperCase(),
    sectionToken(claim.section_reference),
    citationToken(sourceCitation),
    claim.claim_definition_key,
    discriminatorToken(claim),
    claim.analysis_claim_id,
  ];
  return `MISC_BOILERPLATE::${bucket}::${parts.join('_')}`;
}

function sourceUnitKey(claim) {
  return [
    'MISC_BOILERPLATE',
    claim.deal,
    claim.section_reference,
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

function buildTerminal(claim, node, example, sourceCitation, citationContext) {
  const bucket = classificationBucketForClaim(claim, citationContext);
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
        source_citation: sourceCitation,
        source_node_occurrence_id: node.node_occurrence_id,
        source_span: node.extent_span,
      }],
    },
    signature_binding_kind: 'COMPARATOR_DERIVED',
    required_expression_signature: requiredExpressionSignature(claim, bucket, sourceCitation),
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
  const resolutionByOccurrence = new Map();
  for (const run of calibrationPack.comparator_run_bindings) {
    const resolution = readJson(run.resolution_binding.path);
    for (const entry of resolution.resolved) {
      if (entry.resolved_claim_definition_key || entry.claim?.claim_definition_key) {
        resolutionByOccurrence.set(entry.claim.claim_occurrence_id, entry);
      }
    }
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
    const claims = m4.claims.filter((claim) => claim.family === 'MISC_BOILERPLATE');
    for (const claim of claims) {
      const resolutionEntry = resolutionByOccurrence.get(claim.claim_occurrence_id);
      if (!resolutionEntry) {
        throw new Error(`missing resolution entry for ${claim.claim_occurrence_id}`);
      }
      const nodeId = claim.source_node_occurrence_ids[0];
      const node = nodesById.get(nodeId);
      if (!node) throw new Error(`missing M2 node ${nodeId} for ${claim.analysis_claim_id}`);
      const example = exampleByClaimId.get(claim.analysis_claim_id) ?? null;
      const enriched = {
        ...claim,
        deal: calibrationPack.comparator_run_bindings.find(
          (run) => run.agreement_id === agreementId,
        ).deal,
        legacy_claim_revision: resolutionEntry.claim,
      };
      terminals.push(buildTerminal(
        enriched,
        node,
        example,
        resolutionEntry.source_citation,
        resolutionEntry.citation_context,
      ));
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
  const representationsAuthority = readJson(REPRESENTATIONS_PHASE2_PATH);
  const representationsByAgreementId = new Map(
    representationsAuthority.immutable_parent_bindings.m2_m3_m4.map(
      (binding) => [binding.agreement_id, binding],
    ),
  );
  const agreementIds = sortedUnique(
    calibrationPack.comparator_run_bindings.map((run) => run.agreement_id),
  );
  const agreementBindings = agreementIds.map((agreementId) => {
    const existing = representationsByAgreementId.get(agreementId);
    if (existing) return existing;
    return agreementBinding(agreementId);
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
  const subtypeDivergenceCount = terminals.filter(
    (terminal) => terminal.unresolved_items.includes(
      'SUBTYPE_PARTITION_DIVERGES_FROM_CALIBRATION_PROPOSED_SUBTYPE',
    ),
  ).length;

  const unsigned = {
    schema_version: SCHEMA,
    authority_state: 'PROPOSED_AWAITING_BEN_CALIBRATION_APPROVAL',
    approval_basis: {
      authority_kind: 'ZERO_EFFECT_MISC_BOILERPLATE_PHASE2_PARTITION_AUTHORITY',
      calibration_pack_status: calibrationPack.status,
      comparator_run_count: calibrationPack.comparator_run_bindings.length,
      exact_terminal_rule_count: terminals.length,
      family_key: 'MISC_BOILERPLATE',
      legal_ruling_count: 0,
      proposed_on: '2026-08-24',
      purpose: 'Claim-scale comparator terminal registry for MISC_BOILERPLATE Phase 2 partition only',
      sealed_role_schema_state: sealedRoleSchema.approval_state,
      supplemental_provision_example_count:
        calibrationPack.supplemental_input_bindings.length,
    },
    immutable_predecessor_binding: null,
    immutable_parent_bindings: {
      base_policy: representationsAuthority.immutable_parent_bindings.base_policy,
      c3: representationsAuthority.immutable_parent_bindings.c3,
      phase1: representationsAuthority.immutable_parent_bindings.phase1,
      work3_manifest: representationsAuthority.immutable_parent_bindings.work3_manifest,
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
      schema_version: 'STAGE_2Y_MISC_BOILERPLATE_TERMINAL_SUCCESSOR_CONTRACT/V1',
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
        'COMPARATOR_CLAIM_BOUND_SIGNATURE_PER_TERMINAL_WITH_ORDINAL_OR_ASSERTION_DISCRIMINATOR',
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
      state: 'NOT_REQUIRED_FOR_MISC_BOILERPLATE_FIRST_SLICE',
    },
    policy_overlay: {
      cross_family_link_only_boundaries: CROSS_FAMILY_LINK_ONLY_BOUNDARIES,
      family_key: 'MISC_BOILERPLATE',
      native_producer_surface_split:
        'MISC_BOILERPLATE_ASSERTIONS_GOVERNED_BOILERPLATE_MECHANIC_EVIDENCE_ONLY',
      sealed_ruling_bindings: sealedRoleSchema.ruling_bindings,
      sparse_comparator_stress: 'ONE_HUNDRED_FOURTEEN_GOVERNED_CLAIMS_ACROSS_SIX_COMPARATOR_DEALS',
      subtype_partition_stress:
        'CALIBRATION_PACK_TAGS_ALL_SIX_EXAMPLES_GOVERNING_LAW_WHILE_COMPARATOR_CLAIMS_SPAN_TWELVE_SUBTYPE_BUCKETS',
      subtype_divergence_from_calibration_count: subtypeDivergenceCount,
      temporal_graph_materialisation: 'DEFERRED_NOT_TERMINATION_FRONTIER',
    },
    implementation_contract: {
      authority_envelope: {
        path: OUT_PATH,
        record_id_field: 'misc_boilerplate_authoring_phase2_authority_id',
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
        public_seam: 'prepareMiscBoilerplatePhase2FamilyProposal',
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
          'miscBoilerplateAuthoringPhase2Authority',
          'governedSources',
        ],
      },
      lifecycle: {
        proposal_state: 'TREE_OUTPUT_INCOMPLETE',
        profile_approval_state: 'UNAPPROVED',
      },
      no_persistence: true,
      output_constants: {
        family_key: 'MISC_BOILERPLATE',
        profile_approval_state: 'UNAPPROVED',
        proposal_state: 'TREE_OUTPUT_INCOMPLETE',
        schema_version: 'M7_V2_MISC_BOILERPLATE_FAMILY_PROPOSAL/V1',
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
        missing_facade: 'MISC_BOILERPLATE Phase2 proposal facade export is missing.',
      },
      public_seam: 'prepareMiscBoilerplatePhase2FamilyProposal',
      reference_target_owner_template_registry: [],
      required_unresolved_items: [
        'EXACT_PROFILE_INVENTORY_REQUIRES_SEPARATE_APPROVAL',
        'LEGAL_GROUPING_REVIEW_REQUIRED',
        'MISC_BOILERPLATE_Q01_Q02_Q03_BOUND_TO_SEALED_M5_PROGRAMME_RULINGS',
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
      family_key: 'MISC_BOILERPLATE',
      first_red_test_path: TEST_PATH,
      first_red_test_pattern:
        'Phase2 proposal derives a deterministic unapproved MISC_BOILERPLATE partition',
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
      authority_id_field: 'misc_boilerplate_authoring_phase2_authority_id',
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
      rationale: 'Misc Boilerplate first slice has no temporal state machines in Phase 2 authority',
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
    misc_boilerplate_authoring_phase2_authority_id: contentId(SCHEMA, unsigned),
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
    record_id_field: 'misc_boilerplate_authoring_phase2_authority_id',
    record_id: record.misc_boilerplate_authoring_phase2_authority_id,
    byte_length: bytes.length,
    sha256: sha256Hex(bytes),
    terminal_count: record.source_terminal_successor_contract.terminal_rule_registry.length,
    m4_claim_count: record.source_terminal_successor_contract.admitted_m4_claim_exact_count,
    agreement_terminal_counts:
      record.source_terminal_successor_contract.exact_agreement_terminal_counts,
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
