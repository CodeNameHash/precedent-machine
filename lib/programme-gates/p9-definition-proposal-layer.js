'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { canonicalJson, contentId } = require('../canonical-v2/canonical-bytes');
const { sha256Hex } = require('../canonical-v2/canonical-bytes');
const {
  COMPLETION_GATE_ID,
  COMPLETE_P9_GATE_IDS,
  CURRENT_LIVE_P9_GATE_IDS,
} = require('./p9-acceptance-definition-authority');
const {
  compileP9AcceptanceEvidenceInventory,
  validateP9AcceptanceEvidenceInventory,
} = require('./p9-acceptance-evidence-inventory');

const SCHEMA = 'P9_ACCEPTANCE_DEFINITION_PROPOSAL_LAYER/V1';
const RECORD_SCHEMA = 'P9_ACCEPTANCE_DEFINITION_PROPOSAL_RECORD/V1';
const STATE = 'PROPOSAL_ONLY_NOT_ADOPTED_NO_PREDICATE_NO_PASS';
const ADOPTION_BLOCKER = 'GOVERNING_AMENDMENT_AND_EXECUTABLE_DEFINITION_ADOPTION_REQUIRED';
const THRESHOLD_STATES = Object.freeze(['NOT_APPLICABLE_STRUCTURAL_GATE', 'UNKNOWN_OR_UNRATIFIED']);
const SOURCE_MODULE_PATH = 'lib/programme-gates/p9-definition-proposal-layer.js';

const EVIDENCE_OBJECT_MAP = Object.freeze({
  P9_SCOPE_EXACT: Object.freeze(['CorpusScopeCompletenessReport', ['scope_member_set_exact', 'scope_has_no_missing_extra_or_duplicate_member'], ['verify_corpus_scope_member_set', 'verify_corpus_scope_cardinality'], 'NOT_APPLICABLE_STRUCTURAL_GATE']),
  P9_REGISTRY_DISPOSITIONS: Object.freeze(['RegistryDispositionCompletenessReport', ['registry_entries_have_one_resolved_disposition'], ['verify_registry_disposition_totality'], 'NOT_APPLICABLE_STRUCTURAL_GATE']),
  P9_MKT_WORK: Object.freeze(['MarketStatisticReconciliationReport', ['market_statistic_matches_active_release', 'market_statistic_lineage_is_complete'], ['recompute_market_statistic', 'verify_market_statistic_lineage'], 'UNKNOWN_OR_UNRATIFIED']),
  P9_BEN_RUNBOOK: Object.freeze(['BenRunbookFreshnessReport', ['ben_runbook_binds_current_bundle_and_ledger'], ['verify_ben_runbook_freshness'], 'UNKNOWN_OR_UNRATIFIED']),
  P9_NUMERIC: Object.freeze(['NumericVerificationReport', ['numeric_value_unit_precision_matches_citation'], ['verify_numeric_value_unit_precision'], 'UNKNOWN_OR_UNRATIFIED']),
  P9_RENDER_PARITY: Object.freeze(['P9RenderParityReport', ['rendered_field_set_equals_canonical_candidate_field_set'], ['verify_fresh_p9_render_parity'], 'NOT_APPLICABLE_STRUCTURAL_GATE']),
  P9_STRUCTURED_CLAIMS: Object.freeze(['StructuredClaimConformanceReport', ['structured_claims_are_schema_and_cross_reference_conformant'], ['verify_structured_claim_conformance'], 'UNKNOWN_OR_UNRATIFIED']),
  P9_PARTY_LINT: Object.freeze(['PartyLintReport', ['party_references_resolve_to_one_closed_entity_class'], ['verify_party_entity_class_lint'], 'UNKNOWN_OR_UNRATIFIED']),
  P9_SHADOW_REEXTRACTION: Object.freeze(['ShadowReextractionAttestation', ['shadow_output_matches_frozen_candidate_contract_pair', 'shadow_divergences_are_triaged'], ['verify_shadow_reextraction', 'verify_shadow_attestation_freshness'], 'UNKNOWN_OR_UNRATIFIED']),
  P9_IDENTITY_AND_DRIFT: Object.freeze(['IdentityDriftReport', ['content_addressed_identity_set_has_zero_drift'], ['verify_corpus_identity_drift'], 'NOT_APPLICABLE_STRUCTURAL_GATE']),
  P9_BROWSER_A11Y_PERFORMANCE: Object.freeze(['BrowserAccessibilityPerformanceReport', ['client_transition_performance_class_is_measured', 'accessibility_scope_has_zero_disqualifying_violations'], ['verify_client_transition_performance', 'verify_accessibility_conformance'], 'UNKNOWN_OR_UNRATIFIED']),
  P9_STAGING_SMOKE_AND_ROLLBACK: Object.freeze(['StagingSmokeAndRollbackReport', ['staging_smoke_covers_active_release', 'rollback_leaves_zero_residue'], ['verify_staging_smoke', 'verify_rollback_zero_residue'], 'NOT_APPLICABLE_STRUCTURAL_GATE']),
  P9_DATABASE_SOAK: Object.freeze(['DatabaseSoakReport', ['maximum_scale_fixture_is_complete', 'all_load_states_meet_soak_acceptance'], ['verify_maximum_scale_fixture', 'verify_database_soak'], 'UNKNOWN_OR_UNRATIFIED']),
  P9_BACKUP_RESTORE: Object.freeze(['BackupRestoreDrillReport', ['restored_corpus_equals_backup_source'], ['verify_backup_restore_equivalence'], 'UNKNOWN_OR_UNRATIFIED']),
  P9_PREIMPORT_TRACEABILITY: Object.freeze(['PreimportTraceabilityMatrix', ['preimport_traceability_prefix_is_complete'], ['verify_preimport_traceability'], 'NOT_APPLICABLE_STRUCTURAL_GATE']),
  P9_SECURITY_AUTH: Object.freeze(['ProductionAccessSecurityAttestation', ['security_review_passes_for_exact_candidate', 'unresolved_critical_or_high_finding_count_is_zero', 'production_access_precondition_is_current'], ['verify_exact_candidate_security_review', 'verify_zero_unresolved_critical_or_high_findings', 'verify_security_precedes_production_access'], 'NOT_APPLICABLE_STRUCTURAL_GATE']),
  P9_DEPLOYMENT_PARITY: Object.freeze(['DeploymentParityAttestation', ['deployment_matches_frozen_candidate_release'], ['verify_deployment_parity'], 'NOT_APPLICABLE_STRUCTURAL_GATE']),
  P9_IMPORT_PARITY: Object.freeze(['ProductionImportAttestation', ['production_import_matches_candidate_release'], ['verify_production_import_parity'], 'NOT_APPLICABLE_STRUCTURAL_GATE']),
  P9_PROMOTION_ELIGIBILITY: Object.freeze(['CandidatePromotionEligibilityAttestation', ['candidate_promotion_evidence_is_complete'], ['verify_candidate_promotion_eligibility'], 'NOT_APPLICABLE_STRUCTURAL_GATE']),
  P9_CUTOVER_AUTHORISATION: Object.freeze(['CutoverAuthorisationRecord', ['cutover_authorisation_is_one_use_and_current'], ['verify_cutover_authorisation'], 'UNKNOWN_OR_UNRATIFIED']),
  P9_POSTCUTOVER_SMOKE: Object.freeze(['PostCutoverSmokeAttestation', ['postcutover_production_smoke_matches_release'], ['verify_postcutover_smoke'], 'NOT_APPLICABLE_STRUCTURAL_GATE']),
  P9_TRACEABILITY: Object.freeze(['EndToEndTraceabilityMatrix', ['traceability_coverage_is_bidirectionally_complete'], ['verify_end_to_end_traceability'], 'NOT_APPLICABLE_STRUCTURAL_GATE']),
  P9_PROGRAMME_COMPLETION_ATTESTATION: Object.freeze(['ProgrammeCompletionAttestation', ['terminal_traceability_and_completion_pair_is_complete'], ['verify_programme_completion_terminal_pair'], 'NOT_APPLICABLE_STRUCTURAL_GATE']),
});

function fail(code, message) { const error = new Error(message); error.code = code; throw error; }
function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || canonicalJson(Object.keys(value).sort()) !== canonicalJson([...keys].sort())) {
    fail('P9_DEFINITION_PROPOSAL_EXACT_KEYS_REQUIRED', `${label} has unsupported or missing fields.`);
  }
}
function strings(value, label) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || item.length === 0) || new Set(value).size !== value.length) {
    fail('P9_DEFINITION_PROPOSAL_IDENTIFIER_SET_INVALID', `${label} must be a unique non-empty string set.`);
  }
}
function sourceAnchor(leaf) {
  const anchor = leaf.governing_contract_paragraph_anchors.find((entry) => entry.anchor_kind === 'GOVERNING_CONTRACT_PARAGRAPH');
  if (!anchor) fail('P9_DEFINITION_PROPOSAL_CONTRACT_ANCHOR_MISSING', `No contract anchor exists for ${leaf.gate_id}.`);
  return Object.freeze(structuredClone(anchor));
}
function mapFor(gateId) {
  const entry = EVIDENCE_OBJECT_MAP[gateId];
  if (!entry) fail('P9_DEFINITION_PROPOSAL_EVIDENCE_MAP_MISSING', `No evidence-object map exists for ${gateId}.`);
  const [proposedEvidenceObjectType, claimSuffixes, predicateSuffixes, thresholdState] = entry;
  return Object.freeze({
    proposed_evidence_object_type: proposedEvidenceObjectType,
    required_acceptance_claim_ids: Object.freeze(claimSuffixes.map((suffix) => `${gateId}:${suffix}`)),
    required_predicate_ids: Object.freeze(predicateSuffixes.map((suffix) => `${gateId}:${suffix}`)),
    threshold_state: thresholdState,
  });
}
function recordFor(inventory, leaf) {
  const mapped = mapFor(leaf.gate_id);
  const completion = leaf.gate_id === COMPLETION_GATE_ID;
  const body = {
    schema_version: RECORD_SCHEMA,
    state: STATE,
    inventory_id: inventory.inventory_id,
    gate_id: leaf.gate_id,
    partition: completion ? 'LIVE_BUNDLE_FROZEN_TERMINAL_LEAF' : 'LIVE_P9_LEAF',
    contract_anchor: sourceAnchor(leaf),
    proposed_evidence_object_type: mapped.proposed_evidence_object_type,
    required_acceptance_claim_ids: mapped.required_acceptance_claim_ids,
    required_predicate_ids: mapped.required_predicate_ids,
    required_executable_scenario_ids: Object.freeze(leaf.hostile_test_references.map((reference) => reference.test_id)),
    implementation_state: leaf.implementation_state,
    missing_mechanism: leaf.missing_mechanism,
    bundle_tier: leaf.phase_partition,
    threshold_state: mapped.threshold_state,
    adoption_blocker: ADOPTION_BLOCKER,
    formal_definition_authority: 'NONE',
    predicate_authority: 'NONE',
    pass_authority: 'NONE',
  };
  return Object.freeze({ ...body, definition_proposal_id: contentId(RECORD_SCHEMA, body) });
}
function sourceModuleSha256(repositoryRoot) {
  if (typeof repositoryRoot !== 'string' || !path.isAbsolute(repositoryRoot)) fail('P9_DEFINITION_PROPOSAL_REPOSITORY_ROOT_REQUIRED', 'P9 definition proposal layer requires an absolute repository root.');
  return sha256Hex(fs.readFileSync(path.join(repositoryRoot, SOURCE_MODULE_PATH)));
}
function buildP9DefinitionProposalLayerFromInventory({ inventory, repository_root: repositoryRoot } = {}) {
  if (!inventory || typeof inventory !== 'object' || !Array.isArray(inventory.leaves)
    || canonicalJson(inventory.live_p9_gate_ids) !== canonicalJson(CURRENT_LIVE_P9_GATE_IDS)
    || canonicalJson(inventory.complete_p9_gate_ids) !== canonicalJson(COMPLETE_P9_GATE_IDS)
    || inventory.leaves.length !== COMPLETE_P9_GATE_IDS.length) {
    fail('P9_DEFINITION_PROPOSAL_INVENTORY_INVALID', 'P9 definition proposal layer requires the complete ratified live inventory.');
  }
  const body = {
    schema_version: SCHEMA,
    state: STATE,
    inventory_id: inventory.inventory_id,
    live_p9_gate_ids: inventory.live_p9_gate_ids,
    complete_p9_gate_ids: inventory.complete_p9_gate_ids,
    records: Object.freeze(inventory.leaves.map((leaf) => recordFor(inventory, leaf))),
    source_module_path: SOURCE_MODULE_PATH,
    source_module_sha256: sourceModuleSha256(repositoryRoot),
    formal_definition_authority: 'NONE',
    predicate_authority: 'NONE',
    pass_authority: 'NONE',
  };
  return Object.freeze({ ...body, definition_proposal_layer_id: contentId(SCHEMA, body) });
}
function buildP9DefinitionProposalLayer({ repository_root: repositoryRoot } = {}) {
  const inventory = compileP9AcceptanceEvidenceInventory({ p9GateIds: CURRENT_LIVE_P9_GATE_IDS, repositoryRoot });
  validateP9AcceptanceEvidenceInventory(inventory, { p9GateIds: CURRENT_LIVE_P9_GATE_IDS, repositoryRoot });
  return buildP9DefinitionProposalLayerFromInventory({ inventory, repository_root: repositoryRoot });
}
function validateRecord(record, inventory, expectedLeaf) {
  exactKeys(record, [
    'adoption_blocker', 'bundle_tier', 'contract_anchor', 'definition_proposal_id', 'formal_definition_authority',
    'gate_id', 'implementation_state', 'inventory_id', 'missing_mechanism', 'partition', 'pass_authority',
    'predicate_authority', 'proposed_evidence_object_type', 'required_acceptance_claim_ids', 'required_executable_scenario_ids',
    'required_predicate_ids', 'schema_version', 'state', 'threshold_state',
  ], `Definition proposal record ${expectedLeaf.gate_id}`);
  const expected = recordFor(inventory, expectedLeaf);
  if (canonicalJson(record) !== canonicalJson(expected)) fail('P9_DEFINITION_PROPOSAL_RECORD_STALE', `Definition proposal record ${expectedLeaf.gate_id} is stale.`);
  return expected;
}
function validateP9DefinitionProposalLayerFromInventory(value, { inventory, repository_root: repositoryRoot } = {}) {
  exactKeys(value, [
    'definition_proposal_layer_id', 'formal_definition_authority', 'inventory_id', 'live_p9_gate_ids', 'pass_authority',
    'predicate_authority', 'records', 'complete_p9_gate_ids', 'schema_version', 'state',
    'source_module_path', 'source_module_sha256',
  ], 'P9 definition proposal layer');
  if (value.schema_version !== SCHEMA || value.state !== STATE || value.inventory_id !== inventory.inventory_id
    || value.formal_definition_authority !== 'NONE' || value.predicate_authority !== 'NONE' || value.pass_authority !== 'NONE'
    || canonicalJson(value.live_p9_gate_ids) !== canonicalJson(CURRENT_LIVE_P9_GATE_IDS)
    || canonicalJson(value.complete_p9_gate_ids) !== canonicalJson(COMPLETE_P9_GATE_IDS)
    || !Array.isArray(value.records) || value.records.length !== COMPLETE_P9_GATE_IDS.length) {
    fail('P9_DEFINITION_PROPOSAL_LAYER_INVALID', 'P9 definition proposal layer must remain complete and non-authoritative.');
  }
  value.records.forEach((record, index) => validateRecord(record, inventory, inventory.leaves[index]));
  const expected = buildP9DefinitionProposalLayerFromInventory({ inventory, repository_root: repositoryRoot });
  if (canonicalJson(value) !== canonicalJson(expected)) fail('P9_DEFINITION_PROPOSAL_LAYER_STALE', 'P9 definition proposal layer is stale.');
  return expected;
}
function validateP9DefinitionProposalLayer(value, { repository_root: repositoryRoot } = {}) {
  const inventory = compileP9AcceptanceEvidenceInventory({ p9GateIds: CURRENT_LIVE_P9_GATE_IDS, repositoryRoot });
  validateP9AcceptanceEvidenceInventory(inventory, { p9GateIds: CURRENT_LIVE_P9_GATE_IDS, repositoryRoot });
  return validateP9DefinitionProposalLayerFromInventory(value, { inventory, repository_root: repositoryRoot });
}
function proposalBinding(layer) {
  return Object.freeze({
    definition_proposal_layer_id: layer.definition_proposal_layer_id,
    source_module_path: layer.source_module_path,
    source_module_sha256: layer.source_module_sha256,
    live_record_count: layer.records.length,
    completion_terminal_count: layer.records.filter((record) => record.partition === 'LIVE_BUNDLE_FROZEN_TERMINAL_LEAF').length,
    threshold_blocker_gate_ids: Object.freeze(layer.records.filter((record) => record.threshold_state === 'UNKNOWN_OR_UNRATIFIED').map((record) => record.gate_id)),
    formal_definition_authority: layer.formal_definition_authority,
    predicate_authority: layer.predicate_authority,
    pass_authority: layer.pass_authority,
  });
}

module.exports = {
  ADOPTION_BLOCKER,
  EVIDENCE_OBJECT_MAP,
  RECORD_SCHEMA,
  SCHEMA,
  STATE,
  THRESHOLD_STATES,
  buildP9DefinitionProposalLayer,
  buildP9DefinitionProposalLayerFromInventory,
  proposalBinding,
  recordFor,
  sourceModuleSha256,
  validateP9DefinitionProposalLayer,
  validateP9DefinitionProposalLayerFromInventory,
};
