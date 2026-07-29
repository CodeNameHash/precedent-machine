import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import YAML from 'yaml';

const require = createRequire(import.meta.url);
const {
  MANDATORY_ADVERSARIAL_TEST_IDS,
  TEST_EXECUTABLE_DIGESTS,
  TEST_EXECUTABLE_FILES,
  testExecutableState,
} = require('../lib/programme-gates/test-executable-registry');
const { domainDigest } = require('../lib/programme-gates/bytes');
const {
  VALIDATOR_EXECUTABLE_FILES,
  programmeGateValidatorExecutableDigest,
} = require('../lib/programme-gates/validator-executable');

const root = process.cwd();
const manifestPath = 'docs/codex-program/specification-manifest.json';
const contentPaths = [
  'docs/CODEX-PROGRAM.md',
  'docs/codex-program/programme-gates.yaml',
  'docs/codex-program/bootstrap-acceptance-source.json',
  'docs/codex-program/canonical-contracts.md',
  'docs/codex-program/adversarial-tests.md',
];
const domain = 'CODEX_PROGRAM_SPECIFICATION_ROOT_V1';
const expectedReviewer = 'Fable or an independent 5.6 Sol reviewer using extra-high reasoning';

function fail(message) {
  throw new Error(message);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath));
}

function specificationFiles() {
  return contentPaths.map((filePath, index) => {
    const bytes = read(filePath);
    return {
      order: index + 2,
      path: filePath,
      byte_length: bytes.length,
      sha256: sha256(bytes),
    };
  });
}

function specificationRoot(files) {
  const records = files.map((entry) => (
    `${entry.path}\0${entry.byte_length}\0${entry.sha256}\n`
  )).join('');
  return sha256(Buffer.from(`${domain}\n${records}`, 'utf8'));
}

function generatedManifest() {
  const files = specificationFiles();
  const gateRegistry = parseYaml('docs/codex-program/programme-gates.yaml').programme_gate_registry;
  const adversarialSource = read('docs/codex-program/adversarial-tests.md').toString('utf8');
  const adversarialStart = adversarialSource.indexOf('- `GATE-01`');
  if (adversarialStart < 0) fail('Cannot locate adversarial definition block');
  return {
    schema: 'codex-program-specification-manifest/v1',
    domain_separator: domain,
    root_input_encoding: 'SHA-256 over UTF-8 domain separator plus LF followed only by ordered member records 1 through 6; each record is UTF-8 path plus NUL, ASCII decimal byte length plus NUL, lowercase SHA-256 of raw member bytes plus LF; member 1 is the manifest record computed from raw manifest bytes, members 2 through 6 are the declared content-file records; no raw member bytes or implicit records are appended',
    root_membership: 'EXACT_ORDERED_MEMBER_RECORDS_MANIFEST_THEN_FIVE_DECLARED_CONTENT_FILES',
    files,
    baseline_identifier_continuity: {
      schema: 'codex-program-baseline-identifier-continuity/v1',
      scope: 'IDENTIFIER_CONTINUITY_ONLY_NOT_HISTORICAL_BYTE_EQUIVALENCE',
      baseline_gate_ids: {
        count: 34,
        ordered_id_list_sha256: '93ef3d6a1f8bc7790e2b3589e94a26d4dee7a96e8e61f86455ff4e391256e5d5',
      },
      baseline_work_classes: {
        count: 11,
        ordered_name_list_sha256: '391af1223a5732ba3e28b34955e6fff8060f29e4b29ab7e695051371b020dd7c',
      },
      baseline_adversarial_test_ids: {
        count: 276,
        ordered_id_list_sha256: 'c4d52483beb08c1feacac9222e4ab24b7156173dea8c2e6599fe3c11d575fe1c',
      },
      current_gate_count: gateRegistry.gates.length,
      current_gate_ordered_id_list_sha256: sha256(`${gateRegistry.gates.map((gate) => gate.id).join('\n')}\n`),
      current_work_class_count: Object.keys(gateRegistry.work_classes).length,
      current_work_class_ordered_name_list_sha256: sha256(`${Object.keys(gateRegistry.work_classes).join('\n')}\n`),
      current_adversarial_definition_block_sha256: sha256(adversarialSource.slice(adversarialStart)),
    },
  };
}

function parseYaml(relativePath) {
  const source = read(relativePath).toString('utf8');
  const documents = YAML.parseAllDocuments(source, {
    customTags: [],
    prettyErrors: false,
    strict: true,
    uniqueKeys: true,
  });
  if (documents.length !== 1) fail(`Expected one YAML document in ${relativePath}`);
  const [document] = documents;
  if (document.errors.length > 0) {
    fail(`YAML parse failed: ${document.errors.map((error) => error.message).join('; ')}`);
  }
  if (document.warnings.length > 0) {
    fail(`YAML warning: ${document.warnings.map((warning) => warning.message).join('; ')}`);
  }
  let hasAlias = false;
  YAML.visit(document, {
    Alias() {
      hasAlias = true;
    },
  });
  if (hasAlias) fail(`YAML aliases are prohibited in ${relativePath}`);
  return document.toJS({ maxAliasCount: 0 });
}

function assertUnique(values, label) {
  if (new Set(values).size !== values.length) fail(`Duplicate ${label}`);
}

function validateGateRegistry() {
  const parsed = parseYaml('docs/codex-program/programme-gates.yaml');
  const registry = parsed.programme_gate_registry;
  if (!registry) fail('Missing programme_gate_registry');
  if (registry.yaml_parser_binding?.yaml_version !== '1.2'
    || registry.yaml_parser_binding?.package !== 'yaml'
    || registry.yaml_parser_binding?.package_version !== '2.9.0'
    || JSON.stringify(registry.yaml_parser_binding?.options)
      !== JSON.stringify(['STRICT', 'UNIQUE_KEYS', 'NO_ALIASES'])) {
    fail('Gate registry YAML parser binding changed');
  }
  if (registry.specification_identity !== 'DOMAIN_SEPARATED_SPECIFICATION_ROOT_DIGEST') {
    fail('Gate registry does not bind the specification root');
  }
  if (registry.specification_manifest !== manifestPath) fail('Gate registry manifest path mismatch');
  if (registry.status_artifact !== 'docs/certification/programme-gate-status-v2.json') {
    fail('V2 programme status path changed');
  }
  const [historicalStatus] = registry.historical_status_artifacts || [];
  if ((registry.historical_status_artifacts || []).length !== 1
    || historicalStatus?.path !== 'docs/certification/programme-gate-status.json'
    || historicalStatus?.schema !== 'canonical-programme-gates/v1-status'
    || historicalStatus?.generation !== 4
    || historicalStatus?.disposition !== 'HISTORICAL_OWNER_DEEMED_RECORD_ONLY'
    || historicalStatus?.v2_predecessor !== false
    || historicalStatus?.executable_authority !== false) {
    fail('Historical generation-4 V1 status disposition changed');
  }

  const workClassNames = Object.keys(registry.work_classes || {});
  const gates = registry.gates || [];
  const gateIds = gates.map((gate) => gate.id);
  const evidenceContracts = gates.map((gate) => gate.evidence_contract);
  const evidenceObjectTypes = gates.map((gate) => gate.required_evidence_object_type);
  assertUnique(workClassNames, 'work class');
  assertUnique(gateIds, 'gate ID');
  assertUnique(evidenceContracts, 'gate evidence contract');
  assertUnique(evidenceObjectTypes, 'gate evidence object type');
  if (workClassNames.length !== 13) fail(`Expected 13 work classes, found ${workClassNames.length}`);
  if (gateIds.length !== 35) fail(`Expected 35 gates, found ${gateIds.length}`);
  if (sha256(`${gateIds.join('\n')}\n`) !== '5d107d8889326538adc021370f17df0bd1e2799292ef81072bcb7a5ed0c1c182') {
    fail('Current gate ID list changed');
  }
  if (sha256(`${workClassNames.join('\n')}\n`) !== '3d213f5416bd9e119cb1c891626d273baef8a60439c9fa1afa55fc74b009d9d0') {
    fail('Current work-class list changed');
  }
  const baselineGateIds = gateIds.filter((id) => id !== 'P1_VERTICAL_SLICE_PASS');
  const baselineWorkClasses = workClassNames.filter((name) => (
    name !== 'vertical_slice_execution' && name !== 'gate_status_bootstrap'
  ));
  if (sha256(`${baselineGateIds.join('\n')}\n`) !== '93ef3d6a1f8bc7790e2b3589e94a26d4dee7a96e8e61f86455ff4e391256e5d5') {
    fail('A relocated baseline gate ID was removed, renamed, duplicated or reordered');
  }
  if (sha256(`${baselineWorkClasses.join('\n')}\n`) !== '391af1223a5732ba3e28b34955e6fff8060f29e4b29ab7e695051371b020dd7c') {
    fail('A relocated baseline work class was removed, renamed, duplicated or reordered');
  }
  const reviewer = registry.reviewer_eligibility;
  if (reviewer?.formal_legal_semantic_reviewer !== `${expectedReviewer}.`) {
    fail('Formal reviewer label does not use the exact required wording');
  }
  if (reviewer.sol_provider_model_id !== 'gpt-5.6-sol' || reviewer.sol_provider_reasoning_value !== 'xhigh') {
    fail('Sol provider model or reasoning attestation binding changed');
  }
  const controllerAllowlist = reviewer.frozen_controller_and_runtime_allowlist;
  const laneAllowlist = reviewer.frozen_lane_prompt_allowlist;
  const independenceAllowlist = reviewer.frozen_independence_validator_allowlist;
  const testExecutionAttestation = registry.gate_evidence_validation
    ?.adversarial_test_execution_attestation;
  if (controllerAllowlist?.controller_id !== 'CODEX_CLI_REVIEW_CONTROLLER'
    || controllerAllowlist?.controller_version !== 'LOCAL_REVIEW_CONTROLLER/V1'
    || controllerAllowlist?.review_runtime_version !== 'codex-cli/0.145.0'
    || controllerAllowlist?.review_runtime_entrypoint_sha256
      !== '134063e133f0b4244fa3b251acf973d4fe4b4aeeacbdc135211bf480f59f1477'
    || controllerAllowlist?.exact_model_identifier !== 'gpt-5.6-sol'
    || controllerAllowlist?.reasoning_level !== 'xhigh'
    || laneAllowlist?.ARCHITECTURE?.[0] !== 'COLD_ARCHITECTURE_REVIEW/V1'
    || laneAllowlist?.ARCHITECTURE?.[1]
      !== 'e8aa3359ecf632383562b66d61114b0556d8954527610498663642ab0b972297'
    || laneAllowlist?.LEGAL_SEMANTIC?.[0] !== 'COLD_LEGAL_SEMANTIC_REVIEW/V1'
    || laneAllowlist?.LEGAL_SEMANTIC?.[1]
      !== '3f3d2e3b0e169a306307082cd3a0681e07164ca6dad73237794ccb78b0de4b6b'
    || laneAllowlist?.QUERY_EFFICIENCY?.[0] !== 'COLD_QUERY_EFFICIENCY_REVIEW/V1'
    || laneAllowlist?.QUERY_EFFICIENCY?.[1]
      !== '0e5d489625e6cf9124951eb9df47672a668f7f535d3641a972aed5c363f23b06'
    || laneAllowlist?.OPEN_WORLD?.[0] !== 'COLD_OPEN_WORLD_REVIEW/V1'
    || laneAllowlist?.OPEN_WORLD?.[1]
      !== '6d792fd85342d5cfa7b3863b32f9f6648afb91c2a27ed4e4b8b80519895d04d0'
    || laneAllowlist?.RELEASE_PROPAGATION?.[0]
      !== 'COLD_RELEASE_PROPAGATION_REVIEW/V1'
    || laneAllowlist?.RELEASE_PROPAGATION?.[1]
      !== '57f06078844342428cef8a88f1ccfc731d7a389cc157fb5e4916c98e61e49f56'
    || laneAllowlist?.missing_extra_or_digest_mismatched_prompt_effect !== 'INELIGIBLE'
    || independenceAllowlist?.validator_key_id
      !== 'PROGRAMME_GATE_VALIDATOR_2026_07'
    || independenceAllowlist?.validator_executable_digest
      !== 'bbae26b08e1366f5f5c0036c9bb99ad7949e5b611716790eeeb3f2ac9949096b'
    || independenceAllowlist?.validator_configuration_digest
      !== 'c37298016599d6cb09b3b100a536219376e6a68199f6bd5fe088dd75a47e6784') {
    fail('Frozen review controller, runtime, prompt or validator allowlist changed');
  }
  if (testExecutionAttestation?.schema !== 'ProgrammeGateTestExecutionRecord/V1'
    || testExecutionAttestation?.protected_signer_role !== 'TEST_EXECUTION_ATTESTER'
    || testExecutionAttestation?.signature_domain !== 'PROGRAMME_GATE_TEST_EXECUTION/V1'
    || !testExecutionAttestation?.attester_key_must_equal_envelope_validator_key
    || !testExecutionAttestation?.signed_fields_include_exit_code_and_output_digest
    || testExecutionAttestation?.caller_supplied_unsigned_or_tampered_result_effect !== 'OPEN'
    || !registry.gate_evidence_validation?.acceptance_predicate
      ?.required_adversarial_test_execution_signatures_are_trusted) {
    fail('Adversarial test execution attestation contract is incomplete');
  }
  if (reviewer.self_asserted_metadata_effect !== 'INELIGIBLE' || reviewer.ordinary_sol_effect !== 'ADVISORY_ONLY') {
    fail('Reviewer eligibility failure semantics changed');
  }
  const requiredReviewerFields = [
    'controller_id', 'controller_version',
    'review_runtime_version', 'review_runtime_binary_digest',
    'fixed_controller_runtime_context_digest',
    'exact_specification_root', 'exact_model_identifier', 'reasoning_level',
    'immutable_task_id', 'immutable_session_id', 'immutable_review_id',
    'registered_prompt_id', 'cold_review_prompt_digest',
    'controller_supplied_input_manifest_digest', 'exact_input_context_digest',
    'input_context_digest_before_review', 'input_context_digest_after_review',
    'review_output_digest', 'review_start_time', 'review_end_time', 'reviewer_principal_id',
    'reviewer_source_control_identity_set', 'reviewer_disposition',
    'reviewer_edit_set_root',
    'parent_session_state', 'no_earlier_review_conclusions_were_inputs',
    'nonce', 'signature_algorithm', 'controller_key_id', 'controller_signature',
  ];
  if (JSON.stringify(reviewer.review_record_required_fields) !== JSON.stringify(requiredReviewerFields)) {
    fail('Trusted review-controller record fields changed');
  }
  const taskPayload = reviewer.controller_supplied_task_payload;
  if (JSON.stringify(taskPayload?.exact_members_in_order) !== JSON.stringify([
    'EXACT_FROZEN_SPECIFICATION_BYTES',
    'ONE_REGISTERED_LANE_SPECIFIC_COLD_PROMPT',
    'REQUIRED_OUTPUT_SCHEMA',
  ])
    || taskPayload?.extra_member_effect !== 'INELIGIBLE'
    || !taskPayload?.manifest_must_bind_every_member_digest_and_byte_length) {
    fail('Controller-supplied task payload is not closed');
  }
  const runtimeContext = reviewer.fixed_controller_runtime_context;
  if (JSON.stringify(runtimeContext?.permitted_members) !== JSON.stringify([
    'PINNED_PLATFORM_INSTRUCTIONS',
    'PINNED_TOOL_SCHEMAS',
  ])
    || !runtimeContext?.must_be_fixed_for_CONTROLLER_ID_VERSION_AND_REVIEW_RUNTIME_VERSION
    || runtimeContext?.case_specific_content_permitted !== false
    || runtimeContext?.prior_review_finding_or_conclusion_content_permitted !== false
    || runtimeContext?.unknown_changed_or_unrecorded_context_effect !== 'INELIGIBLE') {
    fail('Fixed controller runtime context is open or case-specific');
  }
  const principal = reviewer.reviewer_principal_definition;
  if (principal?.identity !== 'EXACT_CONTROLLER_RUN_PLUS_FRESH_EPHEMERAL_CLI_SESSION'
    || principal?.model_family_is_reviewer_principal !== false) {
    fail('Reviewer principal is not bound to the exact controller run and session');
  }
  const isolation = reviewer.review_session_isolation;
  if (!isolation?.all_five_lanes_start_concurrently
    || JSON.stringify(isolation?.output_bundle_order) !== JSON.stringify([
      'ARCHITECTURE',
      'LEGAL_SEMANTIC',
      'QUERY_EFFICIENCY',
      'OPEN_WORLD',
      'RELEASE_PROPAGATION',
    ])
    || !isolation?.fresh_ephemeral_cli_session
    || !isolation?.new_CODEX_HOME
    || isolation?.resume_prior_session !== false
    || isolation?.project_rules_loaded !== false
    || isolation?.user_configuration_loaded !== false
    || isolation?.plugins_loaded !== false
    || isolation?.memory_loaded !== false
    || isolation?.prior_session_content_loaded !== false
    || !isolation?.review_execution_read_only
    || !isolation?.input_context_digest_before_and_after_must_match) {
    fail('Review CLI session isolation is incomplete');
  }
  const evidenceLimit = reviewer.controller_evidence_limit;
  if (evidenceLimit?.proves_provider_internal_build !== false
    || evidenceLimit?.proves_provider_signature !== false
    || evidenceLimit?.proves_absence_of_hidden_provider_context !== false
    || evidenceLimit?.claims_any_of_these !== false
    || evidenceLimit?.formal_evidence_scope !== 'CONTROLLER_EXECUTION_EVIDENCE_UNDER_THIS_AMENDED_STANDARD') {
    fail('Controller evidence overclaims provider-internal facts');
  }
  const profiles = reviewer.reviewer_profiles;
  if (profiles?.FABLE_ELIGIBLE?.reviewer_identity_class !== 'FABLE'
    || JSON.stringify(profiles?.FABLE_ELIGIBLE?.exact_model_identifiers)
      !== JSON.stringify(['fable-legal-reviewer'])
    || profiles?.FABLE_ELIGIBLE?.exact_reasoning_level !== 'provider_default'
    || profiles?.SOL_5_6_EXTRA_HIGH_ELIGIBLE?.reviewer_identity_class !== 'OPENAI_MODEL'
    || profiles?.SOL_5_6_EXTRA_HIGH_ELIGIBLE?.exact_model_rule !== 'gpt-5.6-sol'
    || profiles?.SOL_5_6_EXTRA_HIGH_ELIGIBLE?.exact_reasoning_level !== 'xhigh') {
    fail('Reviewer profiles are incomplete');
  }
  const controllerCapabilities = reviewer.review_controller_required_capabilities;
  if (reviewer.review_evidence_source !== 'TRUSTED_REVIEW_CONTROLLER_SIGNED_IMMUTABLE_RECORD'
    || reviewer.review_evidence_retrieval !== 'VALIDATOR_DETERMINISTICALLY_ENUMERATES_CLOSED_EVIDENCE_SET_AND_LOADS_EXACT_RECORD'
    || reviewer.review_controller_signature_verification !== 'SIGNATURE_TO_ALLOWLISTED_CONTROLLER_PROCESS_ONLY_KEY'
    || !controllerCapabilities?.directly_controls_review_execution
    || !controllerCapabilities?.directly_observes_exact_inputs_outputs_and_times
    || controllerCapabilities?.permits_review_mutation !== false
    || !controllerCapabilities?.owns_signing_key
    || !controllerCapabilities?.controller_process_is_sole_permitted_signing_key_user
    || controllerCapabilities?.signing_key_accessible_to_reviewer_review_process_operator_input_or_repository !== false
    || controllerCapabilities?.private_key_enters_review_environment_logs_or_checkout !== false
    || reviewer.controller_record_unavailable_or_unverifiable_effect !== 'INELIGIBLE'
    || reviewer.local_cli_or_transcript_only_effect !== 'ADVISORY_ONLY') {
    fail('Trusted review-controller evidence oracle changed');
  }
  const verification = reviewer.review_controller_verification_predicate;
  if (!verification?.deterministically_enumerate_closed_evidence_set_and_load_exact_record
    || !verification.verify_signature_to_allowlisted_controller_process_only_key
    || !verification.verify_controller_directly_controlled_and_observed_execution
    || !verification.verify_review_was_read_only
    || !verification.verify_all_payload_fields_against_review_set
    || !verification.verify_record_nonce_is_unique
    || !verification.reject_user_reviewer_or_repository_supplied_substitute) {
    fail('Review-controller authenticity predicate is incomplete');
  }
  const reviewAcceptance = reviewer.review_record_acceptance;
  if (!reviewAcceptance?.controller_id_and_version_must_be_allowlisted
    || !reviewAcceptance?.review_runtime_version_and_binary_digest_must_be_allowlisted
    || !reviewAcceptance?.fixed_controller_runtime_context_digest_must_be_allowlisted
    || !reviewAcceptance?.controller_supplied_input_manifest_must_equal_exact_task_payload
    || reviewAcceptance?.unknown_changed_or_extra_runtime_or_task_input_effect !== 'INELIGIBLE'
    || !reviewAcceptance?.input_context_digests_before_and_after_must_match
    || !reviewAcceptance?.exact_specification_root_must_equal_review_set_root
    || reviewAcceptance?.parent_session_state_must_be !== 'GENESIS'
    || reviewAcceptance?.no_earlier_review_conclusions_were_inputs_must_be !== true
    || reviewAcceptance?.reviewer_edit_set_root_must_be !== 'EMPTY'
    || reviewAcceptance?.reviewer_disposition_must_be !== 'PASS'
    || !reviewAcceptance?.record_nonce_must_be_unique) {
    fail('Review-controller record acceptance rules are incomplete');
  }
  const frozenTrust = reviewer.frozen_trust_root_set;
  const expectedTrustKeys = {
    PROGRAMME_GATE_VALIDATOR_2026_07: '5b028d01aaa4f077c6f2f28ef8075195330eff00c2f81061fad8622b761de566',
    PROGRAMME_STATUS_PUBLISHER_2026_07: 'd7f562af345fcb04a78f26c87b3e3f19b1cad6c8627ccc612396a4217d8a02c1',
    PROGRAMME_GATE_REVIEW_CONTROLLER_2026_07: 'd32aebc95114afab334ab1afa2b7c4130a2dafdec93af05dcab56589d4e063d0',
    PROGRAMME_GATE_BEN_APPROVER_2026_07: '2baac1c454dfb918097f2816fc9a230eb93139f735db35b9ed64d0e6846b4c17',
  };
  if (reviewer.review_controller_trust_root_set !== 'trusted-review-controller-keys/2026-07-frozen-v1'
    || frozenTrust?.registry_source_sha256 !== '55fbd67d3c90e8f1a6e2843ab04753522e343d857e726961689830658e016b47'
    || sha256(read('lib/programme-gates/registry.js')) !== frozenTrust?.registry_source_sha256
    || JSON.stringify(frozenTrust?.keys) !== JSON.stringify(expectedTrustKeys)
    || frozenTrust?.unknown_replacement_or_post_review_key_effect !== 'OPEN') {
    fail('Frozen programme-gate trust root changed');
  }
  const independence = reviewer.independence_acceptance;
  const independenceUniverse = reviewer.independence_universe_contract;
  if (reviewer.independence_evidence_source !== 'STATUS_VALIDATOR_RECOMPUTED_FROM_CONTROLLER_RECORD_AND_COMPLETE_GIT_HISTORY'
    || !independenceUniverse?.reviewed_bytes_must_be_committed
    || independenceUniverse?.reviewer_principal_identity_mapping !== 'REVIEWER_PRINCIPAL_TO_COMPLETE_SOURCE_CONTROL_IDENTITY_SET_FROM_CONTROLLER_RECORD'
    || independenceUniverse?.authorship_membership !== 'COMPLETE_NON_SHALLOW_GIT_COMMIT_DAG_AT_THE_REVIEWED_COMMIT_AS_A_CONSERVATIVE_SUPERSET_OF_EVERY_BYTE_AUTHOR'
    || independenceUniverse?.review_input_membership !== 'EVERY_CONTROLLER_OBSERVED_TASK_INPUT_PLUS_THE_PINNED_FIXED_CONTROLLER_RUNTIME_CONTEXT'
    || independenceUniverse?.allowed_review_input !== 'EXACT_CONTROLLER_SUPPLIED_TASK_PAYLOAD_PLUS_FIXED_CONTROLLER_RUNTIME_CONTEXT'
    || !independenceUniverse?.cold_prompt_constraint
    || independenceUniverse?.prior_conclusion_membership !== 'EVERY_CONTROLLER_OBSERVED_INPUT_OUTSIDE_THE_ALLOWED_TASK_AND_FIXED_RUNTIME_CONTEXT_PLUS_ANY_PRIOR_REVIEW_OUTPUT'
    || !independenceUniverse?.cutoff
    || independenceUniverse?.authorship_source !== 'COMPLETE_GIT_COMMIT_DAG_SUPPLEMENTARY_TO_CONTROLLER_REVIEW_EVIDENCE'
    || independenceUniverse?.review_input_source !== 'TRUSTED_REVIEW_CONTROLLER_RECORD_ONLY'
    || independenceUniverse?.completeness_proof !== 'FROZEN_VALIDATOR_ENUMERATES_THE_COMPLETE_NON_SHALLOW_GIT_DAG_DIRECTLY_AND_MAPS_ALL_AUTHOR_AND_COMMITTER_IDENTITIES_TO_THE_REVIEWER_PRINCIPAL_IDENTITY_SET'
    || independenceUniverse?.missing_or_ambiguous_reviewer_identity_mapping_effect !== 'INELIGIBLE'
    || independenceUniverse?.missing_unsigned_unattributed_or_unenumerable_event_effect !== 'INELIGIBLE'
    || independence?.session_parent_must_be !== 'GENESIS'
    || independence?.authoring_event_intersection_root_must_be !== 'EMPTY'
    || independence?.prior_conclusion_intersection_root_must_be !== 'EMPTY'
    || independence?.reviewer_edit_set_root_must_be !== 'EMPTY'
    || !independence?.validator_must_recompute_not_accept_assertion) {
    fail('Reviewer independence oracle is incomplete');
  }
  const gateEvidence = registry.gate_evidence_validation;
  if (gateEvidence?.contract_identifier_semantics !== 'CLOSED_SCHEMA_ID_NOT_OPAQUE_LABEL'
    || gateEvidence?.acceptance_definition_schema !== 'programme-gate-acceptance-definition/v1'
    || gateEvidence?.acceptance_definition_resolution !== 'UNIQUE_CONTENT_ADDRESSED_DEFINITION_FOR_EVIDENCE_CONTRACT'
    || gateEvidence?.normative_semantic_authority !== 'EXACT_GATE_ENTRY_PLUS_NORMATIVE_EVIDENCE_OBJECT_CONTRACT_AT_THE_REVIEWED_SPECIFICATION_ROOT'
    || gateEvidence?.post_review_semantic_authoring !== 'PROHIBITED'
    || gateEvidence?.unresolved_ambiguous_or_unbound_acceptance_definition_effect !== 'OPEN'
    || gateEvidence?.schema_or_predicate_unregistered_effect !== 'OPEN'
    || gateEvidence?.status_projection !== 'RECOMPUTED_FROM_VALIDATED_EVIDENCE_ONLY') {
    fail('Gate evidence contracts remain opaque or non-fail-closed');
  }
  const acceptanceDefinitionFields = new Set(gateEvidence.acceptance_definition_required_fields || []);
  for (const field of ['definition_digest', 'evidence_object_json_schema_digest', 'evidence_subject_identity_fields', 'immutable_member_universe_definition', 'immutable_member_json_schema_set_digest', 'member_enumerator_executable_digest', 'ordered_claim_predicate_definitions']) {
    if (!acceptanceDefinitionFields.has(field)) fail(`Gate acceptance definition missing ${field}`);
  }
  const claimPredicateFields = new Set(gateEvidence.claim_predicate_required_fields || []);
  for (const field of ['claim_key', 'result_type', 'exact_input_member_types_and_paths', 'measurement_executable_digest', 'measurement_configuration_digest', 'comparison_operator', 'expected_typed_value']) {
    if (!claimPredicateFields.has(field)) fail(`Gate claim predicate missing ${field}`);
  }
  const acceptance = gateEvidence.acceptance_predicate;
  const frozenDsl = gateEvidence.frozen_predicate_dsl;
  const claimAst = gateEvidence.claim_ast_derivation;
  const sourceRoot = gateEvidence.complete_acceptance_source_root;
  const compiledRegistry = gateEvidence.bootstrap_compiled_registry_binding;
  const authorityTiers = gateEvidence.acceptance_authority_tiers;
  if (!acceptance?.evidence_contract_selects_exact_schema
    || !acceptance?.acceptance_definition_is_unique_root_bound_and_content_addressed
    || !acceptance?.subject_type_identity_and_payload_match_definition
    || !acceptance?.member_universe_and_member_schemas_match_definition
    || !acceptance?.acceptance_claim_keys_equal_gate_claims
    || !acceptance?.every_claim_uses_its_exact_typed_predicate
    || !acceptance?.recompute_member_universe_and_measurements_from_immutable_members
    || !acceptance?.validator_executable_and_configuration_are_allowlisted
    || acceptance?.terminal_state_must_equal !== 'PASS') {
    fail('Gate evidence acceptance predicate is incomplete');
  }
  if (frozenDsl?.schema !== 'programme-gate-predicate-dsl/v1'
    || frozenDsl?.implicit_operator_or_expected_value !== 'PROHIBITED'
    || frozenDsl?.request_supplied_measurement !== 'PROHIBITED'
    || frozenDsl?.executable_role !== 'NON_AUTHORITATIVE_IMPLEMENTATION_OF_FROZEN_DSL'
    || claimAst?.result_type !== 'BOOLEAN'
    || claimAst?.comparison_operator !== 'EQUALS'
    || claimAst?.expected_typed_value !== true
    || claimAst?.asserted_boolean_without_RECOMPUTED_MEMBER_WITNESS_ROOT !== 'OPEN'
    || sourceRoot?.source !== 'AUTHORITY_TIER_SELECTED_BY_GATE_ID'
    || sourceRoot?.missing_or_post_review_selected_member_effect !== 'OPEN'
    || compiledRegistry?.source_path !== 'docs/codex-program/bootstrap-acceptance-source.json'
    || compiledRegistry?.source_sha256
      !== sha256(read('docs/codex-program/bootstrap-acceptance-source.json'))
    || compiledRegistry?.closed_validator_executable_set_digest
      !== 'bbae26b08e1366f5f5c0036c9bb99ad7949e5b611716790eeeb3f2ac9949096b'
    || compiledRegistry?.authority
      !== 'ROOT_INDEPENDENT_REVIEWED_BOOTSTRAP_ACCEPTANCE_SOURCE'
    || compiledRegistry?.exact_active_definition_count !== 11
    || compiledRegistry?.exact_genesis_gate_count !== 10
    || compiledRegistry?.exact_active_gate_order?.at(-1) !== 'P1_CONTRACT_FREEZE_ATTESTED'
    || compiledRegistry?.required_definition_field_totality
      !== 'EXACTLY_ALL_ACCEPTANCE_DEFINITION_REQUIRED_FIELDS_AND_CLAIM_PREDICATE_REQUIRED_FIELDS'
    || compiledRegistry?.runtime_or_request_supplied_semantics !== 'PROHIBITED'
    || compiledRegistry?.missing_extra_duplicate_or_digest_mismatched_definition_effect !== 'OPEN'
    || compiledRegistry?.runtime_digest_mismatch_effect !== 'OPEN') {
    fail('Frozen gate acceptance semantics are incomplete');
  }
  const tierGateIds = [
    ...(authorityTiers?.BOOTSTRAP_FROZEN?.gates || []),
    ...(authorityTiers?.BUNDLE_FROZEN?.gates || []),
  ];
  if (authorityTiers?.BOOTSTRAP_FROZEN?.source
      !== 'ROOT_INDEPENDENT_REVIEWED_BOOTSTRAP_ACCEPTANCE_SOURCE'
    || authorityTiers?.BUNDLE_FROZEN?.source !== 'CANONICAL_CONTRACT_BUNDLE_MEMBER_APPROVED_BY_CONTRACT_FREEZE_ATTESTATION'
    || authorityTiers?.BUNDLE_FROZEN?.unresolved_before_freeze_effect !== 'OPEN_NOT_PERMANENTLY_UNDEFINED'
    || tierGateIds.length !== registry.gates.length
    || new Set(tierGateIds).size !== registry.gates.length
    || registry.gates.some((gate) => !tierGateIds.includes(gate.id))) {
    fail('Gate acceptance authority tiers are incomplete or overlapping');
  }
  const mandatoryTests = registry.mandatory_adversarial_test_binding;
  if (mandatoryTests?.expected_identifier_count !== 289
    || mandatoryTests?.executable_registry_source
      !== 'lib/programme-gates/test-executable-registry.js'
    || mandatoryTests?.fail_closed_unimplemented_executable
      !== 'scripts/run-unimplemented-adversarial-test.mjs'
    || mandatoryTests?.expected_identifier_set_sha256 !== 'a03e2ac797ce941f1b04f82b30be78eb183ab5f26bf24c46b34046eef62b16a8'
    || mandatoryTests?.enforcement_gate !== 'P9_SCOPE_EXACT'
    || mandatoryTests?.pre_cutover_requirement !== 'EVERY_MEMBER_TERMINAL_PASS'
    || mandatoryTests?.executable_mapping_totality
      !== 'EVERY_IDENTIFIER_HAS_ONE_FROZEN_EXECUTABLE_DIGEST_AND_UNIMPLEMENTED_HANDLERS_CANNOT_EXIT_ZERO'
    || mandatoryTests?.missing_extra_duplicate_or_unbound_member_effect !== 'OPEN'
    || MANDATORY_ADVERSARIAL_TEST_IDS.length !== 289
    || Object.keys(TEST_EXECUTABLE_FILES).length !== 289
    || Object.keys(TEST_EXECUTABLE_DIGESTS).length !== 289
    || MANDATORY_ADVERSARIAL_TEST_IDS.some((testId) => (
      !Array.isArray(TEST_EXECUTABLE_FILES[testId])
      || !/^[a-f0-9]{64}$/.test(TEST_EXECUTABLE_DIGESTS[testId])
      || !['IMPLEMENTED', 'BOUND_FAIL_CLOSED_UNIMPLEMENTED']
        .includes(testExecutableState(testId))
    ))) {
    fail('Mandatory adversarial-test catalogue binding is incomplete');
  }
  const bootstrap = registry.work_classes.gate_status_bootstrap;
  const permittedBootstrapActions = [
    'GOVERNING_SPECIFICATION_AMENDMENT_FOR_GATE_STATUS_BOOTSTRAP',
    'REVIEW_CONTROLLER_SOFTWARE',
    'REVIEW_CONTROLLER_EVIDENCE_SCHEMAS',
    'GATE_EVIDENCE_SCHEMAS',
    'DETERMINISTIC_COMPILATION_OF_FROZEN_GATE_ACCEPTANCE_DEFINITIONS',
    'IMPLEMENTATION_OF_FROZEN_EVIDENCE_ENUMERATORS',
    'IMPLEMENTATION_OF_FROZEN_EVIDENCE_PREDICATES',
    'IMPLEMENTATION_OF_FROZEN_CERTIFICATION_INTEGRITY_VALIDATOR',
    'SIGNING_SYSTEM',
    'STATUS_PUBLISHER',
    'PROGRAMME_STATUS_PUBLICATION_HEAD',
    'G0_SECURITY_DISPOSITION_EVIDENCE_COLLECTION',
    'G0_CONTAINMENT_EVIDENCE_COLLECTION',
    'ISOLATED_STAGING_BOUNDARY_SETUP',
    'STAGING_ACCESS_PROTECTION_AND_VALIDATION',
    'TESTS_FOR_THESE_ITEMS',
  ];
  const prohibitedBootstrapActions = [
    'AUTHOR_OR_AMEND_GATE_ACCEPTANCE_SEMANTICS',
    'SELECT_OR_REPLACE_TRUST_ROOTS',
    'CORPUS_EXTRACTION',
    'CORPUS_REPROCESSING',
    'CORPUS_WRITES',
    'BACKFILLS',
    'PRODUCTION_DATA_CHANGES',
    'RELEASE_IMPORT',
    'RELEASE_ACTIVATION',
    'PRODUCT_FEATURE_ACTIVATION',
  ];
  const bootstrapTerminal = bootstrap?.terminal_condition;
  if (JSON.stringify(bootstrap?.all_of) !== JSON.stringify(['specification_review'])
    || bootstrap?.authority_model !== 'TEMPORARY_ONE_USE'
    || bootstrap?.predecessor !== 'NONE'
    || bootstrap?.nonce !== 'gate-status-bootstrap-2026-07-27-v1'
    || JSON.stringify(bootstrap?.required_adversarial_tests) !== JSON.stringify(['GATE-BOOTSTRAP-01'])
    || JSON.stringify(bootstrap?.authority_scope?.permitted) !== JSON.stringify(permittedBootstrapActions)
    || JSON.stringify(bootstrap?.authority_scope?.prohibited) !== JSON.stringify(prohibitedBootstrapActions)
    || bootstrapTerminal?.event !== 'FIRST_VALID_PROGRAMME_GATE_STATUS_ARTEFACT_V2_PUBLICATION'
    || bootstrapTerminal?.required_generation !== 1
    || bootstrapTerminal?.required_predecessor !== 'NONE'
    || bootstrapTerminal?.required_work_class_state !== 'canonical_work_start'
    || bootstrapTerminal?.required_work_class_result !== 'PASS'
    || bootstrapTerminal?.work_class_evaluation_source
      !== 'PROPOSED_STATUS_RECOMPUTED_FROM_VALIDATED_G0_EVIDENCE'
    || !bootstrapTerminal?.consume_nonce
    || !bootstrapTerminal?.expires_immediately
    || bootstrapTerminal?.reissue_without_new_registry_amendment !== 'PROHIBITED') {
    fail('One-use gate-status bootstrap authority is incomplete or widened');
  }
  const publication = registry.ordinary_status_publication;
  const firstPublication = publication?.first_v2_publication;
  if (publication?.status_schema !== 'ProgrammeGateStatusArtefact/V2'
    || publication?.publication_head_schema !== 'ProgrammeStatusPublicationHead/V1'
    || publication?.publication_head_authority !== 'REPOSITORY_NATIVE_SINGLE_GIT_REF'
    || publication?.publication_head_git_ref !== 'refs/heads/programme-status-publication-head'
    || publication?.publication_writer !== 'PROTECTED_GITHUB_ACTION_ONLY'
    || publication?.compare_and_swap?.status_and_head_commit !== 'ONE_ATOMIC_GIT_REF_UPDATE'
    || publication?.compare_and_swap?.stale_predecessor_effect !== 'REJECT_WITH_ZERO_REF_CHANGE'
    || publication?.compare_and_swap?.manual_status_edit_effect !== 'INVALID'
    || firstPublication?.generation !== 1
    || firstPublication?.predecessor !== 'NONE'
    || firstPublication?.gate_projection !== 'ALL_35_REGISTRY_GATES_EXACTLY_ONCE_IN_REGISTRY_ORDER'
    || firstPublication?.unsupported_p1_and_p9_gate_state !== 'OPEN'
    || firstPublication?.canonical_work_start_must_be !== 'PASS'
    || firstPublication?.canonical_work_start_evaluation
      !== 'RECOMPUTE_WITHIN_PROPOSED_STATUS_FROM_VALIDATED_G0_EVIDENCE_NOT_PREDECESSOR_STATUS'
    || !firstPublication?.consumes_gate_status_bootstrap_nonce) {
    fail('Repository-native programme-status publication contract is incomplete');
  }
  if (JSON.stringify(registry.work_classes.vertical_slice_execution?.all_of) !== JSON.stringify(['canonical_work_start', 'P1_CONTRACT_FREEZE_ATTESTED'])) {
    fail('Vertical-slice execution dependencies changed');
  }
  if (JSON.stringify(registry.work_classes.candidate_scope_and_extraction?.all_of) !== JSON.stringify(['vertical_slice_execution', 'P1_VERTICAL_SLICE_PASS'])) {
    fail('Broad family expansion is not gated by the vertical-slice result');
  }

  const known = new Set([...workClassNames, ...gateIds]);
  for (const [name, definition] of Object.entries(registry.work_classes)) {
    const dependencies = definition.all_of || [];
    assertUnique(dependencies, `dependency in work class ${name}`);
    for (const dependency of dependencies) {
      if (!known.has(dependency)) fail(`Unknown dependency ${dependency} in ${name}`);
    }
  }
  for (const gate of gates) {
    const conditionalGate = gate.not_applicable_only_if?.gate;
    if (conditionalGate && !gateIds.includes(conditionalGate)) {
      fail(`Unknown conditional gate ${conditionalGate}`);
    }
    if (!/^[A-Z][A-Za-z0-9]+$/.test(gate.required_evidence_object_type || '')) {
      fail(`Gate ${gate.id} has no closed evidence object type`);
    }
    if (!Array.isArray(gate.acceptance_claims) || gate.acceptance_claims.length === 0) {
      fail(`Gate ${gate.id} has no acceptance claims`);
    }
    assertUnique(gate.acceptance_claims, `acceptance claim in ${gate.id}`);
    if (gate.acceptance_claims.some((claim) => !/^[a-z][a-z0-9_]+$/.test(claim))) {
      fail(`Gate ${gate.id} has an invalid acceptance claim key`);
    }
    if (!Array.isArray(gate.required_adversarial_tests) || gate.required_adversarial_tests.length === 0) {
      fail(`Gate ${gate.id} has no mandatory adversarial test mapping`);
    }
  }
  const adversarialIds = new Set([
    ...read('docs/codex-program/adversarial-tests.md').toString('utf8').matchAll(/^- `([A-Z0-9]+(?:-[A-Z0-9]+)*-\d{2})`:/gm),
  ].map((match) => match[1]));
  for (const gate of gates) {
    for (const testId of gate.required_adversarial_tests) {
      if (!adversarialIds.has(testId)) fail(`Unknown adversarial test ${testId} in ${gate.id}`);
    }
  }
  for (const gateId of registry.terminal_completion_binding?.proposed_status_gates || []) {
    if (!gateIds.includes(gateId)) fail(`Unknown terminal gate ${gateId}`);
  }
  const terminalBinding = registry.terminal_completion_binding;
  if (terminalBinding?.publication !== 'DATABASE_TERMINAL_PAIR_THEN_PROTECTED_GIT_REF_CAS'
    || terminalBinding?.database_terminal_pair_authority !== 'APPEND_ONLY_COMPLETION_TERMINAL_PAIR_ATTEMPTS'
    || JSON.stringify(terminalBinding?.attempt_unique_key)
      !== JSON.stringify(['status_generation', 'expected_git_predecessor_object_id', 'proposed_status_payload_digest'])
    || terminalBinding?.open_attempt_cardinality !== 'AT_MOST_ONE_PER_EXPECTED_GIT_PREDECESSOR'
    || terminalBinding?.published_attempt_cardinality !== 'AT_MOST_ONE_GLOBALLY'
    || terminalBinding?.git_head_remains_sole_programme_status_publication_head !== true
    || terminalBinding?.cross_system_atomic_commit_required !== false
    || terminalBinding?.retry_rule
      !== 'SAME_PREDECESSOR_REVALIDATES_EXISTING_ATTEMPT;ADVANCED_PREDECESSOR_APPENDS_STALE_ABANDONMENT_AND_FULLY_RECOMPUTES_FRESH_NEXT_GENERATION_ATTEMPT'
    || terminalBinding?.partial_pair_effect
      !== 'OPEN_UNTIL_GIT_HEAD_REFERENCES_THE_EXACT_DATABASE_PAIR') {
    fail('Terminal status publication still claims split or cross-system authority');
  }

  const visiting = new Set();
  const visited = new Set();
  function visit(name) {
    if (visiting.has(name)) fail(`Work-class dependency cycle at ${name}`);
    if (visited.has(name)) return;
    visiting.add(name);
    for (const dependency of registry.work_classes[name].all_of || []) {
      if (registry.work_classes[dependency]) visit(dependency);
    }
    visiting.delete(name);
    visited.add(name);
  }
  workClassNames.forEach(visit);
  return { gateIds, workClassNames };
}

function validateAdversarialTests() {
  const definition = /^- `([A-Z0-9]+(?:-[A-Z0-9]+)*-\d{2})`:/gm;
  const rows = contentPaths.filter((item) => item.endsWith('.md')).flatMap((filePath) => (
    [...read(filePath).toString('utf8').matchAll(definition)].map((match) => ({ filePath, id: match[1] }))
  ));
  const ids = rows.map((row) => row.id);
  if (ids.length !== 289) fail(`Expected 289 adversarial tests, found ${ids.length}`);
  assertUnique(ids, 'adversarial test ID');
  if (rows.some((row) => row.filePath !== 'docs/codex-program/adversarial-tests.md')) {
    fail('Adversarial test definition outside authoritative file');
  }
  if (sha256(`${ids.join('\n')}\n`) !== 'a03e2ac797ce941f1b04f82b30be78eb183ab5f26bf24c46b34046eef62b16a8') {
    fail('Current adversarial test ID list changed');
  }
  const addedIds = new Set([
    'VERTICAL-SLICE-01',
    'PAIR-NEUTRAL-MEMBERSHIP-01',
    'RESIDUAL-TOTALITY-01',
    'SOURCE-SPECIFIC-CARDINALITY-01',
    'SHADOW-REEXTRACTION-01',
    'GATE-BOOTSTRAP-01',
    'REVIEW-CONTEXT-01',
    'DEAL-IDENTITY-AUTHORITY-01',
    'RESIDUAL-IMPACT-PUBLICATION-01',
    'CLAIM-ONLY-IMPACT-CLEARANCE-01',
    'DEPLOYMENT-PARITY-FRESHNESS-01',
    'ONGOING-READINESS-AUTHORITY-01',
    'POST-ATTESTATION-ABANDONMENT-01',
  ]);
  const baselineIds = ids.filter((id) => !addedIds.has(id));
  if (sha256(`${baselineIds.join('\n')}\n`) !== 'c4d52483beb08c1feacac9222e4ab24b7156173dea8c2e6599fe3c11d575fe1c') {
    fail('A relocated baseline adversarial test ID was removed, renamed, duplicated or reordered');
  }
  const known = new Set(ids);
  const token = /\b[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-01\b/g;
  for (const filePath of contentPaths.filter((item) => item.endsWith('.md'))) {
    for (const match of read(filePath).toString('utf8').matchAll(token)) {
      if (!known.has(match[0])) fail(`Unknown adversarial test reference ${match[0]} in ${filePath}`);
    }
  }
}

function headingAnchors(markdown) {
  const counts = new Map();
  const anchors = new Map();
  for (const match of markdown.matchAll(/^#{1,6}\s+(.+)$/gm)) {
    const base = match[1]
      .replace(/<[^>]+>/g, '')
      .replace(/[`*_~]/g, '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .trim()
      .replace(/\s+/g, '-');
    const count = counts.get(base) || 0;
    counts.set(base, count + 1);
    anchors.set(count === 0 ? base : `${base}-${count}`, (anchors.get(base) || 0) + 1);
  }
  return anchors;
}

function validateMarkdownLinksAndFences() {
  const markdownPaths = contentPaths.filter((item) => item.endsWith('.md'));
  const anchorCache = new Map();
  for (const filePath of markdownPaths) {
    const markdown = read(filePath).toString('utf8');
    if ((markdown.match(/^```/gm) || []).length % 2 !== 0) fail(`Unbalanced Markdown fences in ${filePath}`);
    for (const match of markdown.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      const target = match[1];
      if (/^[a-z]+:/i.test(target)) continue;
      const [relativeTarget, anchor] = target.split('#');
      const targetPath = relativeTarget
        ? path.normalize(path.join(path.dirname(filePath), relativeTarget))
        : filePath;
      const absoluteTarget = path.join(root, targetPath);
      if (!fs.existsSync(absoluteTarget)) fail(`Broken link ${target} in ${filePath}`);
      if (anchor && targetPath.endsWith('.md')) {
        if (!anchorCache.has(targetPath)) {
          anchorCache.set(targetPath, headingAnchors(fs.readFileSync(absoluteTarget, 'utf8')));
        }
        if (!anchorCache.get(targetPath).has(anchor)) fail(`Broken anchor ${target} in ${filePath}`);
      }
    }
  }
}

function validateAuthorityAndReviewerLanguage() {
  const programme = read('docs/CODEX-PROGRAM.md').toString('utf8');
  const contracts = read('docs/codex-program/canonical-contracts.md').toString('utf8');
  const tests = read('docs/codex-program/adversarial-tests.md').toString('utf8');
  const combined = [programme, contracts, tests].join('\n').replace(/\s+/g, ' ');
  const normalisedProgramme = programme.replace(/-\s+/g, '-').replace(/\s+/g, ' ');
  for (const [filePath, markdown] of [
    ['docs/CODEX-PROGRAM.md', programme],
    ['docs/codex-program/canonical-contracts.md', contracts],
    ['docs/codex-program/adversarial-tests.md', tests],
  ]) {
    if (markdown.includes('programme_gate_registry:') || markdown.includes('```yaml')) {
      fail(`Gate registry remains embedded in ${filePath}`);
    }
  }
  if ((contracts.match(/This file is the sole authority for detailed identities, state machines, writer grammars, release contracts and traceability contracts\./g) || []).length !== 1) {
    fail('Canonical-contract authority declaration missing');
  }
  if ((tests.match(/This file is the sole authority for numbered adversarial tests/g) || []).length !== 1) {
    fail('Adversarial-test authority declaration missing');
  }
  if ((programme.match(/sole authority for\n?\s*gates and work classes/g) || []).length !== 1) {
    fail('Gate and work-class authority declaration must occur exactly once');
  }
  if ((programme.match(/^### [0-8]\. /gm) || []).length !== 0) {
    fail('Detailed canonical contract heading remains in programme spine');
  }
  if ((contracts.match(/^### [0-8]\. /gm) || []).length !== 9) {
    fail('Canonical contract section authority is incomplete');
  }
  if (/Fable or Claude 5\.6|Claude 5\.6 Sonnet|Fable-only|Fable-or-Claude/.test(combined)) {
    fail('Stale reviewer eligibility wording');
  }
  const fableCount = (combined.match(/\bFable\b/g) || []).length;
  const eligibleCount = (combined.match(new RegExp(expectedReviewer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  if (fableCount !== eligibleCount) fail('Every Fable eligibility reference must use the exact wording');
  if (!combined.includes('ordinary Sol review remains advisory unless')) {
    fail('Ordinary Sol advisory boundary missing');
  }
  const verticalSliceTerms = [
    'representation with qualifiers and bring-down',
    'interim operating covenant with money and time normalisation',
    'no-shop with exceptions',
    'multi-span composition',
    'nested definition',
    'multiple valid values',
    'reviewed unfamiliar proposition',
    'row-level rendering isolation',
  ];
  for (const term of verticalSliceTerms) {
    if (!normalisedProgramme.includes(term)) fail(`Vertical-slice requirement missing: ${term}`);
  }
}

function validateGateReferences(gateIds) {
  const known = new Set(gateIds);
  const gateToken = /\b(?:G0|P1|P9)_[A-Z0-9_]+\b/g;
  for (const filePath of contentPaths.filter((item) => item.endsWith('.md'))) {
    for (const match of read(filePath).toString('utf8').matchAll(gateToken)) {
      if (!known.has(match[0])) fail(`Unknown gate reference ${match[0]} in ${filePath}`);
    }
  }
}

function validateBootstrapAcceptanceSource() {
  execFileSync(
    process.execPath,
    ['scripts/generate-bootstrap-acceptance-source.mjs', '--check'],
    { cwd: root, stdio: 'pipe' },
  );
  const source = JSON.parse(
    read('docs/codex-program/bootstrap-acceptance-source.json').toString('utf8'),
  );
  const expectedGateIds = [
    'G0_MARKET_STATS_CONTAINED',
    'G0_BROAD_CORPUS_ROUTES_CONTAINED',
    'G0_ZAYO_DISPOSITION',
    'G0_CLAUDE_CREDENTIAL_ROTATION',
    'G0_SUPABASE_SECRET_DISPOSITION',
    'G0_STAGING_SUPABASE_ISOLATED',
    'G0_STAGING_VERCEL_ISOLATED',
    'G0_STAGING_ACCESS_PROTECTED',
    'G0_EXACT_DIGEST_REVIEW_SET',
    'G0_BEN_SPEC_APPROVAL',
    'P1_CONTRACT_FREEZE_ATTESTED',
  ];
  if (source.schema_version !== 'ProgrammeGateBootstrapAcceptanceSource/V1'
    || source.authority !== 'ROOT_INDEPENDENT_REVIEWED_BOOTSTRAP_ACCEPTANCE_SOURCE'
    || source.definition_count !== 11
    || source.genesis_gate_count !== 10
    || JSON.stringify(source.ordered_gate_ids) !== JSON.stringify(expectedGateIds)
    || source.definitions?.length !== 11) {
    fail('Bootstrap acceptance source does not contain the closed eleven-gate authority');
  }
  const runtimeModules = source.runtime_source_modules;
  const modulePaths = runtimeModules?.map((module) => module.path) || [];
  const modulePathSet = new Set(modulePaths);
  if (!Array.isArray(runtimeModules)
    || runtimeModules.length === 0
    || modulePathSet.size !== runtimeModules.length
    || JSON.stringify(modulePaths) !== JSON.stringify([...modulePaths].sort())
    || source.local_dependency_closure?.resolver
      !== 'STATIC_RELATIVE_REQUIRE_IMPORT_EXPORT/V1'
    || source.local_dependency_closure?.unresolved_local_dependencies?.length !== 0
    || VALIDATOR_EXECUTABLE_FILES.some((file) => !modulePathSet.has(file))
    || source.acceptance_executable_closure_digest
      !== programmeGateValidatorExecutableDigest({ root })
    || runtimeModules.some((module) => (
      typeof module.utf8_source !== 'string'
      || Buffer.byteLength(module.utf8_source) !== module.byte_length
      || sha256(Buffer.from(module.utf8_source, 'utf8')) !== module.sha256
    ))
    || source.runtime_source_set_digest !== domainDigest(
      'PROGRAMME_GATE_BOOTSTRAP_RUNTIME_SOURCE_SET/V1',
      runtimeModules.map((module) => ({
        path: module.path,
        byte_length: module.byte_length,
        sha256: module.sha256,
      })),
    )) {
    fail('Bootstrap acceptance runtime source closure is incomplete');
  }
  for (const module of runtimeModules.filter((entry) => /\.(?:js|mjs)$/.test(entry.path))) {
    const specifiers = [
      ...module.utf8_source.matchAll(/\brequire\(\s*['"](\.[^'"]+)['"]\s*\)/g),
      ...module.utf8_source.matchAll(
        /\b(?:import|export)\s+(?:[^'"]+\s+from\s+)?['"](\.[^'"]+)['"]/g,
      ),
    ].map((match) => match[1]);
    for (const specifier of specifiers) {
      const base = path.posix.normalize(
        path.posix.join(path.posix.dirname(module.path), specifier),
      );
      const candidates = path.posix.extname(base)
        ? [base]
        : [base, `${base}.js`, `${base}.mjs`, `${base}.json`, `${base}/index.js`];
      if (!candidates.some((candidate) => modulePathSet.has(candidate))) {
        fail(`Bootstrap source omits ${specifier} required by ${module.path}`);
      }
    }
  }
  for (const [index, definition] of source.definitions.entries()) {
    if (definition.descriptor?.gate_id !== expectedGateIds[index]
      || definition.descriptor?.activation_state !== 'ACTIVE'
      || !definition.evidence_schema
      || !Array.isArray(definition.member_schemas)
      || definition.member_schemas.length === 0
      || !Array.isArray(definition.ordered_claim_predicates)
      || definition.ordered_claim_predicates.length === 0
      || definition.ordered_claim_predicates.some((predicate) => (
        predicate.measurement_language !== 'ECMASCRIPT_FUNCTION_SOURCE_V1'
        || typeof predicate.measurement_source !== 'string'
        || predicate.measurement_source.length === 0
        || !/^[a-f0-9]{64}$/.test(predicate.measurement_executable_digest)
        || predicate.measurement_transitive_source_closure_digest
          !== source.acceptance_executable_closure_digest
        || predicate.comparison_operator !== 'EQUALS'
        || predicate.expected_typed_value !== true
      ))
      || definition.member_universe?.enumerator_transitive_source_closure_digest
        !== source.acceptance_executable_closure_digest) {
      fail(`Bootstrap acceptance source definition ${expectedGateIds[index]} is incomplete`);
    }
  }
  const reviewDefinition = source.definitions.find(
    (definition) => definition.descriptor.gate_id === 'G0_EXACT_DIGEST_REVIEW_SET',
  );
  const reviewInputs = reviewDefinition.ordered_claim_predicates.find(
    (predicate) => predicate.claim_key === 'five_named_lanes_pass_same_root',
  ).exact_input_member_types_and_paths;
  for (const jsonPointer of [
    '/registered_prompt_id',
    '/cold_review_prompt_digest',
    '/parent_session_state',
    '/no_earlier_review_conclusions_were_inputs',
    '/controller_key_id',
    '/reviewer_principal_id',
  ]) {
    if (!reviewInputs.some((input) => (
      input.member_type === 'TrustedReviewControllerRecord'
      && input.json_pointer === jsonPointer
    ))) {
      fail(`Exact review acceptance input is not total: ${jsonPointer}`);
    }
  }
}

function validateRootCauseClosure() {
  const contracts = read('docs/codex-program/canonical-contracts.md').toString('utf8');
  const adversarial = read('docs/codex-program/adversarial-tests.md').toString('utf8');
  const programme = read('docs/CODEX-PROGRAM.md').toString('utf8');
  const requiredContractTerms = [
    'exactly eight top-level actions: `OPEN_IMPORT`,',
    '`VERIFY_PRODUCTION_BLOB_AVAILABILITY`, `IMPORT_MEMBER_BATCH`',
    'exact eight-action\n  top-level set',
    'A ninth action,',
    '`N_capacity` is the exact eight-field tuple measured',
    'Its first seven fields are therefore exactly ten times',
    'sums\n`pg_relation_size` for each distinct selected index',
    'observed production physical-plan-fingerprint root',
    'exact equality of the certified and production statistics roots',
    'No result-page carrier, per-query result',
    'impact_clear_for_metric_slot=PASS',
    'approved successor ContractFreezeAttestation',
    '`COMMIT_PASS` is the sole producer of `ReleaseActivationCertification`',
    'prohibits every field and lock owned only by the other',
  ];
  for (const term of requiredContractTerms) {
    if (!contracts.includes(term)) fail(`Root-cause closure contract missing: ${term}`);
  }
  for (const forbidden of [
    'ImmutableQueryExecutionResult',
    'IMMUTABLE_EXECUTION_RESULT_FETCH',
    '`CERTIFY_RELEASE_ACTIVATION`',
    'exact seven-action\n  top-level set',
    'An eighth action,\n  an omitted action, a semantic-parity phase',
  ]) {
    if (`${programme}\n${contracts}\n${adversarial}`.includes(forbidden)) {
      fail(`Removed root-cause contract remains present: ${forbidden}`);
    }
  }
  for (const testId of [
    'IMPORT-LIFECYCLE-01',
    'QUERY-EXEC-01',
    'RESIDUAL-IMPACT-PUBLICATION-01',
    'CLAIM-ONLY-IMPACT-CLEARANCE-01',
    'POST-ACTIVATION-FAULT-BOUNDARY-01',
    'HISTORICAL-REACTIVATION-ADVANCED-HEAD-01',
  ]) {
    if (!adversarial.includes(`\`${testId}\``)) {
      fail(`Root-cause closure adversarial test missing: ${testId}`);
    }
  }
}

function validateManifest(writeManifest) {
  const generated = generatedManifest();
  const absoluteManifest = path.join(root, manifestPath);
  if (writeManifest) {
    fs.writeFileSync(absoluteManifest, `${JSON.stringify(generated, null, 2)}\n`);
  }
  if (!fs.existsSync(absoluteManifest)) fail('Specification manifest missing');
  const actual = JSON.parse(fs.readFileSync(absoluteManifest, 'utf8'));
  if (JSON.stringify(actual) !== JSON.stringify(generated)) fail('Specification manifest is not reproducible');
  if ('specification_root_sha256' in actual) fail('Detached specification root cannot be stored inside its manifest');
  if (actual.files.some((entry) => entry.path === manifestPath)) fail('Manifest cannot hash itself');
  const manifestBytes = fs.readFileSync(absoluteManifest);
  const rootMembers = [{
    order: 1,
    path: manifestPath,
    byte_length: manifestBytes.length,
    sha256: sha256(manifestBytes),
  }, ...actual.files];
  if (rootMembers.map((entry) => entry.order).join(',') !== '1,2,3,4,5,6') {
    fail('Specification root members are not ordered 1 through 6');
  }
  const rootDigest = specificationRoot(rootMembers);
  const mutated = structuredClone(actual);
  mutated.baseline_identifier_continuity.current_gate_count += 1;
  const mutatedBytes = Buffer.from(`${JSON.stringify(mutated, null, 2)}\n`, 'utf8');
  const mutatedRoot = specificationRoot([{
    order: 1,
    path: manifestPath,
    byte_length: mutatedBytes.length,
    sha256: sha256(mutatedBytes),
  }, ...actual.files]);
  if (mutatedRoot === rootDigest) fail('Specification root does not bind manifest policy bytes');
  return rootDigest;
}

const writeManifest = process.argv.includes('--write-manifest');
const { gateIds } = validateGateRegistry();
validateGateReferences(gateIds);
validateAdversarialTests();
validateAuthorityAndReviewerLanguage();
validateBootstrapAcceptanceSource();
validateRootCauseClosure();
const rootDigest = validateManifest(writeManifest);
validateMarkdownLinksAndFences();
console.log(`CODEX programme specification PASS ${rootDigest}`);
