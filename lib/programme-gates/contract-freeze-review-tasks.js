const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('../canonical-v2/canonical-bytes');
const { domainDigest } = require('./bytes');
const { validateSchema } = require('./schema-registry');
const {
  compileGoverningSpecificationMembers,
} = require(
  '../canonical-v2/canonical-contract-bundle-pre-review-package-assembler'
);
const {
  REQUIRED_BUNDLE_KINDS,
  compileCanonicalContractBundle,
  validateCanonicalContractBundleAggregateMembers,
} = require('../canonical-v2/canonical-contract-bundle-compiler');
const {
  COMPILER_VERSION,
  DETERMINISM_REPORT_SCHEMA_VERSION,
  FORMAL_FREEZE_EVIDENCE_INPUTS,
  FREEZE_CANDIDATE_SCHEMA_VERSION,
  GENERATOR_VERSION,
} = require('../canonical-v2/canonical-contract-bundle-freeze-candidate-assembler');
const {
  GENERATED_MEMBER_SCHEMA_VERSION,
  GENERATED_TOPOLOGY_SCHEMA_VERSION,
  compileCanonicalContractBundleGeneratedTopology,
} = require('../canonical-v2/canonical-contract-bundle-generated-topology');
const {
  validateCanonicalPredecessorBundleMembers,
} = require('../canonical-v2/canonical-contract-bundle-pre-review-source-closure');
const {
  enumerateCompleteGitAuthorshipUniverse,
} = require('./git-authorship');
const {
  ContractFreezeReviewRegistrationError,
  verifyP1ContractFreezeReviewRegistration,
} = require('./contract-freeze-review-registration');

const REQUEST_INPUT_VERSION = 'P1ContractFreezeReviewRequestInput/V1';
const REQUEST_VERSION = 'P1ContractFreezeReviewRequest/V1';
const EXECUTION_PLAN_INPUT_VERSION = 'P1ContractFreezeReviewExecutionPlanInput/V1';
const EXECUTION_PLAN_VERSION = 'P1ContractFreezeReviewExecutionPlan/V1';
const TASK_VERSION = 'P1ContractFreezeReviewTask/V1';
const RESULT_VERSION = 'P1ContractFreezeReviewResult/V1';
const VALIDATION_VERSION = 'P1ContractFreezeReviewValidation/V1';
const EXACT_REVIEW_INPUT_VERSION =
  'CANONICAL_CONTRACT_BUNDLE_EXACT_REVIEW_INPUT/V2';
const EXACT_MODEL_IDENTIFIER = 'gpt-5.6-sol';
const EXACT_REASONING_LEVEL = 'high';
const GATE_ID = 'P1_CONTRACT_FREEZE_ATTESTED';
const REVIEW_PACKAGE_FINGERPRINT_DOMAIN =
  'CANONICAL_CONTRACT_BUNDLE_EXACT_REVIEW_PACKAGE_FINGERPRINT/V2';
const SOURCE_CONTROL_AUTHORSHIP_EVENT_SET_ROOT_DOMAIN =
  'PROGRAMME_GATE_SOURCE_CONTROL_AUTHORSHIP_EVENT_SET_ROOT/V1';
const DIGEST_RE = /^[a-f0-9]{64}$/;
const COMMIT_RE = /^[a-f0-9]{40}$/;

const REVIEW_LANES = Object.freeze([
  Object.freeze({
    lane_id: 'SEMANTIC_QUESTION_CATALOGUE_REVIEW',
    reviewer_role: 'INDEPENDENT_SEMANTIC_QUESTION_CATALOGUE_REVIEWER',
    formal_record_schema_id: 'ContractFreezeAuthorityEvidence/V1',
    formal_authority_kind: 'SEMANTIC_QUESTION_CATALOGUE_REVIEW',
    review_scope: 'LEGAL_SEMANTIC_COMPLETENESS',
    focus:
      'the completeness and legal meaning of the semantic-question catalogue',
  }),
  Object.freeze({
    lane_id: 'COMPOSITION_CATALOGUE_REVIEW',
    reviewer_role: 'INDEPENDENT_COMPOSITION_CATALOGUE_REVIEWER',
    formal_record_schema_id: 'ContractFreezeAuthorityEvidence/V1',
    formal_authority_kind: 'COMPOSITION_CATALOGUE_REVIEW',
    review_scope: 'LEGAL_COMPOSITION_COMPLETENESS',
    focus:
      'the completeness and legal meaning of the composition catalogue',
  }),
  Object.freeze({
    lane_id: 'SEMANTIC_AND_IDENTITY_DIFF_REVIEW',
    reviewer_role: 'INDEPENDENT_CONTRACT_DIFF_REVIEWER',
    formal_record_schema_id: 'ContractDiffReviewAttestation/V1',
    formal_authority_kind: 'CONTRACT_DIFF_REVIEW',
    review_scope: 'SEMANTIC_AND_IDENTITY_DIFF',
    focus:
      'every semantic and identity change between the exact predecessor and successor bundles',
  }),
]);

const REVIEW_PACKAGE_KEYS = Object.freeze([
  'schema_version',
  'specification_root',
  'root_manifest_digest',
  'code_commit',
  'environment',
  'pre_review_attestation_placeholder',
  'pre_review_frozen_pair_placeholder_digest',
  'predecessor_contract_bundle_id',
  'predecessor_contract_bundle_digest',
  'predecessor_contract_bundle_projection',
  'contract_bundle_id',
  'contract_bundle_digest',
  'canonical_contract_bundle_compiler_input',
  'governed_topology_input_identity',
  'canonical_contract_bundle_members',
  'generated_contract_bundle_members',
  'aggregate_canonical_contract_bundle_projection',
  'canonical_contract_bundle_projection',
  'semantic_identity_diff',
  'semantic_identity_diff_digest',
  'pre_review_input_context_placeholder_digest',
  'governing_specification_member_records',
  'contract_bundle_freeze_candidate',
  'contract_freeze_attestation_identity',
  'frozen_contract_pair_digest',
  'predecessor_canonical_contract_bundle_members',
  'predecessor_source_kinds',
  'reviewed_contract_source_set_digest',
  'exact_review_input_context_digest',
]);

const REQUEST_INPUT_KEYS = Object.freeze([
  'schema_version',
  'exact_review_package_fingerprint',
  'exact_review_package_bytes_base64',
  'code_commit',
  'frozen_contract_pair_digest',
  'source_closure_identity',
  'reviewer_bindings',
]);

const EXECUTION_PLAN_INPUT_KEYS = Object.freeze([
  'schema_version',
  'exact_review_package_fingerprint',
  'exact_review_package_bytes_base64',
  'code_commit',
  'frozen_contract_pair_digest',
  'source_closure_identity',
]);

const EXECUTION_PLAN_KEYS = Object.freeze([
  'schema_version',
  'execution_plan_id',
  'plan_input',
  'task_templates',
  'disposition',
]);

const EXECUTION_PLAN_TASK_KEYS = Object.freeze([
  'lane_id',
  'reviewer_role',
  'prompt',
  'task_template_id',
]);

const OBSERVED_REVIEW_KEYS = Object.freeze([
  'lane_id',
  'immutable_session_id',
  'reviewer_model_identifier',
  'reasoning_level',
  'finding_output',
]);

const REVIEWER_BINDING_KEYS = Object.freeze([
  'lane_id',
  'reviewer_role',
  'reviewer_principal_id',
  'reviewer_identity',
  'reviewer_model_identifier',
  'reasoning_level',
  'reviewer_source_control_identity_set',
  'reviewer_eligibility_digest',
  'review_disposition_id',
  'independence_binding',
]);

const INDEPENDENCE_BINDING_KEYS = Object.freeze([
  'immutable_session_id',
  'session_parent_or_genesis',
  'source_control_history_scope',
  'reviewed_code_commit',
  'source_control_authorship_events',
  'source_control_authorship_event_set_root',
  'prior_conclusion_input_set',
  'reviewer_edit_set',
]);

const FREEZE_CANDIDATE_KEYS = Object.freeze([
  'schema_version',
  'compiler_version',
  'generator_version',
  'canonical_contract_bundle_members',
  'generated_contract_bundle_members',
  'aggregate_canonical_contract_bundle_projection',
  'canonical_contract_bundle_projection',
  'generated_contract_topology',
  'contract_bundle_id',
  'contract_bundle_digest',
  'canonical_contract_bundle_member_root',
  'canonical_contract_bundle_required_kind_set_root',
  'compile_report',
  'compile_report_digest',
  'dependency_cycle_report',
  'cycle_report_digest',
  'determinism_report',
  'determinism_report_digest',
  'generated_output_inventory',
  'unsigned_contract_bundle_compilation_receipt_payload',
  'formal_freeze_evidence_input_inventory',
  'disposition',
  'freeze_candidate_payload_digest',
]);

const COMPILER_INPUT_KEYS = Object.freeze([
  'canonical_contract_input_compilation',
  'classification_registry',
  'dependency_registry',
  'governed_registry_bindings',
  'predecessor_classification_registry',
  'predecessor_dependency_registry',
]);

const COMPILE_REPORT_KEYS = Object.freeze([
  'schema_version',
  'authored_input_identity_id',
  'classification_registry_id',
  'dependency_registry_id',
  'non_governance_authored_member_count',
  'aggregate_member_count',
  'required_kind_count',
  'missing_member_count',
  'extra_member_count',
  'duplicate_identity_count',
  'conflict_count',
  'status',
]);

const CYCLE_REPORT_KEYS = Object.freeze([
  'schema_version',
  'node_count',
  'edge_count',
  'unresolved_dependency_count',
  'self_dependency_count',
  'cycle_count',
  'status',
]);

const DETERMINISM_REPORT_KEYS = Object.freeze([
  'schema_version',
  'compile_run_count',
  'first_compilation_payload_digest',
  'second_compilation_payload_digest',
  'canonical_byte_length',
  'mismatch_count',
  'status',
]);

const UNSIGNED_RECEIPT_KEYS = Object.freeze([
  'schema_version',
  'contract_bundle_id',
  'contract_bundle_digest',
  'frozen_contract_pair_digest',
  'compiler_version',
  'generator_version',
  'compile_report_digest',
  'cycle_report_digest',
  'drift_report_digest',
  'generated_outputs',
  'canonical_contract_bundle_member_root',
  'canonical_contract_bundle_member_count',
  'canonical_contract_bundle_required_kind_set_root',
  'compile_errors',
  'cycle_errors',
  'drift_errors',
  'terminal_state',
]);

const RESULT_KEYS = Object.freeze([
  'schema_version',
  'gate_id',
  'lane_id',
  'task_id',
  'exact_review_package_fingerprint',
  'exact_review_package_payload_digest',
  'code_commit',
  'frozen_contract_pair_digest',
  'contract_freeze_attestation_id',
  'review_disposition_id',
  'reviewer_principal_id',
  'reviewer_identity',
  'reviewer_role',
  'reviewer_model_identifier',
  'reasoning_level',
  'immutable_session_id',
  'independence_binding_digest',
  'disposition',
  'findings',
]);

class ContractFreezeReviewTaskError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ContractFreezeReviewTaskError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ContractFreezeReviewTaskError(code, message, details);
}

function isPlainObject(value) {
  return Boolean(value)
    && typeof value === 'object'
    && !Array.isArray(value)
    && (
      Object.getPrototypeOf(value) === Object.prototype
      || Object.getPrototypeOf(value) === null
    );
}

function requirePlainObject(value, label, code = 'INVALID_P1_REVIEW_INPUT') {
  if (!isPlainObject(value)) fail(code, `${label} must be a plain object.`);
}

function requireExactKeys(value, keys, label, code = 'INVALID_P1_REVIEW_INPUT') {
  requirePlainObject(value, label, code);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (
    actual.length !== expected.length
    || actual.some((key, index) => key !== expected[index])
  ) {
    fail(code, `${label} fields do not match the closed contract.`, {
      missing_keys: expected.filter((key) => !actual.includes(key)),
      extra_keys: actual.filter((key) => !expected.includes(key)),
    });
  }
}

function requireDigest(value, label, code = 'INVALID_P1_REVIEW_INPUT') {
  if (typeof value !== 'string' || !DIGEST_RE.test(value)) {
    fail(code, `${label} must be a lowercase SHA-256 digest.`);
  }
}

function requireCommit(value, label, code = 'INVALID_P1_REVIEW_INPUT') {
  if (typeof value !== 'string' || !COMMIT_RE.test(value)) {
    fail(code, `${label} must be an exact lowercase Git commit.`);
  }
}

function requireNonEmptyString(value, label, code = 'INVALID_P1_REVIEW_INPUT') {
  if (typeof value !== 'string' || value.length === 0) {
    fail(code, `${label} must be a non-empty string.`);
  }
}

function requireClosedStringSet(
  value,
  label,
  { allowEmpty = false, code = 'INVALID_P1_REVIEW_INPUT' } = {},
) {
  if (
    !Array.isArray(value)
    || (!allowEmpty && value.length === 0)
    || value.some((entry) => typeof entry !== 'string' || entry.length === 0)
    || new Set(value).size !== value.length
  ) {
    fail(code, `${label} must be a closed unique string set.`);
  }
}

function clone(value) {
  return JSON.parse(canonicalJson(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function sameValue(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function recordWithout(record, omittedKeys) {
  return Object.fromEntries(Object.entries(record).filter(
    ([key]) => !omittedKeys.includes(key),
  ));
}

function decodeCanonicalBase64(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    fail('INVALID_P1_REVIEW_INPUT', `${label} must contain canonical base64.`);
  }
  const bytes = Buffer.from(value, 'base64');
  if (bytes.length === 0 || bytes.toString('base64') !== value) {
    fail('INVALID_P1_REVIEW_INPUT', `${label} must contain canonical base64.`);
  }
  return bytes;
}

function validateSuccessorAggregates(records) {
  let validated;
  try {
    validated = validateCanonicalContractBundleAggregateMembers(records);
  } catch (error) {
    fail(
      'INVALID_EXACT_COMPILER_AGGREGATE_SET',
      'The successor bundle is not the exact eight-kind compiler aggregate set.',
      { compiler_error_code: error.code || 'UNKNOWN' },
    );
  }
  let authoredMemberCount = 0;
  let dependencyEdgeCount = 0;
  for (const member of validated) {
    const source = JSON.parse(
      Buffer.from(member.source_bytes_base64, 'base64').toString('utf8'),
    );
    authoredMemberCount += source.ordered_authored_members.length;
    dependencyEdgeCount += source.ordered_authored_members.reduce(
      (count, entry) => count + entry.ordered_dependency_identities.length,
      0,
    );
  }
  return {
    records: validated,
    projection: validated.map((record) => ({
      member_key: record.member_key,
      semantic_digest: record.semantic_digest,
      identity_digest: record.identity_digest,
    })),
    authoredMemberCount,
    dependencyEdgeCount,
  };
}

function validateGeneratedMembers(records) {
  if (!Array.isArray(records) || records.length === 0) {
    fail(
      'INVALID_EXACT_GENERATED_MEMBER_SET',
      'The successor bundle must retain every generated member.',
    );
  }
  const memberKeys = [];
  const projection = records.map((record, index) => {
    requireExactKeys(
      record,
      [
        'schema_version',
        'member_key',
        'object_type',
        'generated_id',
        'member_schema_version',
        'byte_length',
        'payload_digest',
        'source_bytes_base64',
        'semantic_digest',
        'identity_digest',
      ],
      `generated contract bundle member ${index}`,
      'INVALID_EXACT_GENERATED_MEMBER_SET',
    );
    if (
      record.schema_version !== GENERATED_MEMBER_SCHEMA_VERSION
      || typeof record.member_key !== 'string'
      || !record.member_key.startsWith('GENERATED/')
      || typeof record.object_type !== 'string'
      || record.object_type.length === 0
      || !DIGEST_RE.test(record.generated_id)
      || typeof record.member_schema_version !== 'string'
      || record.member_schema_version.length === 0
      || !Number.isSafeInteger(record.byte_length)
      || record.byte_length < 1
    ) {
      fail(
        'INVALID_EXACT_GENERATED_MEMBER_SET',
        'A generated member identity or size is invalid.',
      );
    }
    const bytes = decodeCanonicalBase64(
      record.source_bytes_base64,
      `generated member ${record.member_key} source_bytes_base64`,
    );
    let value;
    try {
      value = JSON.parse(bytes.toString('utf8'));
    } catch {
      fail(
        'INVALID_EXACT_GENERATED_MEMBER_SET',
        'A generated member does not contain UTF-8 JSON.',
      );
    }
    const idFieldByObjectType = {
      QUERY_DEFINITION_SET_ROOT: 'query_definition_set_root_id',
      QUERY_GOLDEN_SUITE_MANIFEST: 'query_golden_suite_manifest_id',
      APPLICABILITY_ELIGIBLE_MEMBER_KIND_PRODUCER_REGISTRY:
        'producer_registry_id',
      APPLICABILITY_REEXAMINATION_REQUIREMENT_DEFINITION: 'definition_id',
      APPLICABILITY_REEXAMINATION_REQUIREMENT_SET_ROOT: 'requirement_set_root_id',
      GLOBAL_MUTABLE_AUTHORITY_REGISTRY:
        'global_mutable_authority_registry_id',
      GENERATED_LOCK_PLAN_REGISTRY: 'generated_lock_plan_registry_id',
      SEMANTIC_STAGE_REGISTRY: 'semantic_stage_registry_id',
    };
    const idField = idFieldByObjectType[record.object_type];
    if (
      !bytes.equals(Buffer.from(canonicalJson(value), 'utf8'))
      || bytes.length !== record.byte_length
      || sha256Hex(bytes) !== record.payload_digest
      || value.schema_version !== record.member_schema_version
      || idField === undefined
      || value[idField] !== record.generated_id
      || value.canonical_payload_digest === undefined
      || record.semantic_digest !== contentId(
        'CANONICAL_GENERATED_CONTRACT_BUNDLE_MEMBER_SEMANTIC/V1',
        value,
      )
      || record.identity_digest !== contentId(
        'CANONICAL_GENERATED_CONTRACT_BUNDLE_MEMBER_IDENTITY/V1',
        {
          member_key: record.member_key,
          generated_id: record.generated_id,
          canonical_payload_digest: value.canonical_payload_digest,
        },
      )
    ) {
      fail(
        'INVALID_EXACT_GENERATED_MEMBER_SET',
        'A generated member does not match its retained canonical bytes.',
        { member_key: record.member_key },
      );
    }
    memberKeys.push(record.member_key);
    return {
      member_key: record.member_key,
      semantic_digest: record.semantic_digest,
      identity_digest: record.identity_digest,
    };
  });
  if (
    new Set(memberKeys).size !== memberKeys.length
    || memberKeys.some((key, index) => (
      index > 0 && memberKeys[index - 1].localeCompare(key) >= 0
    ))
  ) {
    fail(
      'INVALID_EXACT_GENERATED_MEMBER_SET',
      'Generated members must have unique keys in exact ascending order.',
    );
  }
  return { records: clone(records), projection };
}

function validateGeneratedTopologyIdentity(topology, successor) {
  const topologyPayload = recordWithout(topology, [
    'schema_version',
    'canonical_payload_digest',
  ]);
  if (
    topology.schema_version !== GENERATED_TOPOLOGY_SCHEMA_VERSION
    || topology.canonical_payload_digest !== contentId(
      'CANONICAL_CONTRACT_BUNDLE_GENERATED_TOPOLOGY_PAYLOAD/V2',
      topologyPayload,
    )
    || !sameValue(
      topology.generated_contract_bundle_members,
      successor.generatedRecords,
    )
    || !sameValue(
      topology.generated_contract_bundle_projection,
      successor.generatedProjection,
    )
  ) {
    fail(
      'INVALID_GENERATED_TOPOLOGY_IDENTITY',
      'The generated topology does not match its retained members and payload digest.',
    );
  }
  const generatedMemberRoot = contentId(
    'CANONICAL_GENERATED_CONTRACT_BUNDLE_MEMBER_ROOT/V1',
    successor.generatedRecords,
  );
  const manifest = topology.generated_output_manifest;
  const manifestPayload = recordWithout(manifest, [
    'generated_output_manifest_id',
    'canonical_payload_digest',
  ]);
  const expectedOutputs = successor.generatedRecords.map((record) => {
    const value = JSON.parse(
      Buffer.from(record.source_bytes_base64, 'base64').toString('utf8'),
    );
    return {
      object_type: record.object_type,
      generated_id: record.generated_id,
      canonical_payload_digest: value.canonical_payload_digest,
    };
  }).sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right)));
  if (
    manifest.generated_member_root !== generatedMemberRoot
    || manifest.generated_member_count !== successor.generatedRecords.length
    || manifest.output_count !== expectedOutputs.length
    || !sameValue(manifest.ordered_outputs, expectedOutputs)
    || manifest.generated_output_manifest_id !== contentId(
      'CANONICAL_CONTRACT_BUNDLE_GENERATED_OUTPUT_MANIFEST_ID/V1',
      manifestPayload,
    )
    || manifest.canonical_payload_digest !== contentId(
      'CANONICAL_CONTRACT_BUNDLE_GENERATED_OUTPUT_MANIFEST_PAYLOAD/V1',
      manifestPayload,
    )
  ) {
    fail(
      'INVALID_GENERATED_OUTPUT_MANIFEST',
      'The generated output manifest does not close the exact generated member set.',
    );
  }
  const finalBundle = topology.final_canonical_contract_bundle;
  const finalPayload = recordWithout(finalBundle, [
    'canonical_contract_bundle_id',
    'canonical_contract_bundle_fingerprint',
  ]);
  if (
    finalBundle.canonical_contract_bundle_id !== contentId(
      'CANONICAL_CONTRACT_BUNDLE_ID/V3',
      finalPayload,
    )
    || finalBundle.canonical_contract_bundle_fingerprint !== contentId(
      'CANONICAL_CONTRACT_BUNDLE/V3',
      finalPayload,
    )
    || !sameValue(finalBundle.generated_output_manifest, manifest)
    || !sameValue(
      finalBundle.ordered_generated_member_projection,
      successor.generatedProjection,
    )
  ) {
    fail(
      'INVALID_FINAL_CANONICAL_CONTRACT_BUNDLE',
      'The V3 bundle identity does not match its exact generated topology.',
    );
  }
  return {
    generatedMemberRoot,
    finalBundle,
  };
}

function outputEntry(outputPath, value) {
  return {
    path: outputPath,
    payload_digest: sha256Hex(Buffer.from(canonicalJson(value), 'utf8')),
  };
}

function validateFreezeCandidate(candidate, successor, frozenPairDigest) {
  requireExactKeys(
    candidate,
    FREEZE_CANDIDATE_KEYS,
    'contract bundle freeze candidate',
    'INVALID_FREEZE_CANDIDATE',
  );
  if (
    candidate.schema_version !== FREEZE_CANDIDATE_SCHEMA_VERSION
    || candidate.compiler_version !== COMPILER_VERSION
    || candidate.generator_version !== GENERATOR_VERSION
  ) {
    fail(
      'INVALID_FREEZE_CANDIDATE',
      'The freeze candidate does not use the registered compiler and generator contract.',
    );
  }
  const candidatePayload = recordWithout(candidate, [
    'schema_version',
    'freeze_candidate_payload_digest',
  ]);
  if (
    candidate.freeze_candidate_payload_digest !== contentId(
      'CANONICAL_CONTRACT_BUNDLE_FREEZE_CANDIDATE_PAYLOAD/V1',
      candidatePayload,
    )
    || !sameValue(candidate.canonical_contract_bundle_members, successor.records)
    || !sameValue(
      candidate.generated_contract_bundle_members,
      successor.generatedRecords,
    )
    || !sameValue(
      candidate.aggregate_canonical_contract_bundle_projection,
      successor.aggregateProjection,
    )
    || !sameValue(candidate.canonical_contract_bundle_projection, successor.projection)
    || candidate.generated_contract_topology.schema_version
      !== GENERATED_TOPOLOGY_SCHEMA_VERSION
    || !sameValue(
      candidate.generated_contract_topology.generated_contract_bundle_members,
      successor.generatedRecords,
    )
  ) {
    fail(
      'INVALID_FREEZE_CANDIDATE',
      'The freeze candidate payload or exact aggregate set drifted.',
    );
  }

  const topologyFacts = validateGeneratedTopologyIdentity(
    candidate.generated_contract_topology,
    successor,
  );
  const memberRoot = contentId(
    'CANONICAL_CONTRACT_BUNDLE_MEMBER_ROOT/V3',
    {
      aggregate_members: successor.records,
      generated_members: successor.generatedRecords,
    },
  );
  const requiredKindRoot = domainDigest(
    'PROGRAMME_GATE_CANONICAL_CONTRACT_BUNDLE_REQUIRED_KIND_SET_ROOT/V1',
    REQUIRED_BUNDLE_KINDS,
  );
  const finalBundle = topologyFacts.finalBundle;
  const bundleDigest = finalBundle.canonical_contract_bundle_fingerprint;
  const bundleId = finalBundle.canonical_contract_bundle_id;
  const expectedAggregateBundleDigest = domainDigest(
    'PROGRAMME_GATE_CONTRACT_BUNDLE_SNAPSHOT/V1',
    successor.aggregateProjection,
  );
  const expectedAggregateBundleId = domainDigest(
    'PROGRAMME_GATE_CONTRACT_BUNDLE_ID/V1',
    { contract_bundle_digest: expectedAggregateBundleDigest },
  );
  const expectedAggregateMemberRoot = domainDigest(
    'PROGRAMME_GATE_CANONICAL_CONTRACT_BUNDLE_MEMBER_ROOT/V1',
    successor.records,
  );
  if (
    candidate.contract_bundle_id !== bundleId
    || candidate.contract_bundle_digest !== bundleDigest
    || candidate.canonical_contract_bundle_member_root !== memberRoot
    || candidate.canonical_contract_bundle_required_kind_set_root !== requiredKindRoot
    || finalBundle.aggregate_contract_bundle_id !== expectedAggregateBundleId
    || finalBundle.aggregate_contract_bundle_digest !== expectedAggregateBundleDigest
    || finalBundle.aggregate_member_root !== expectedAggregateMemberRoot
  ) {
    fail(
      'INVALID_FREEZE_CANDIDATE',
      'The freeze candidate roots do not match the exact V3 bundle.',
    );
  }

  requireExactKeys(
    candidate.compile_report,
    COMPILE_REPORT_KEYS,
    'freeze candidate compile report',
    'INVALID_FREEZE_CANDIDATE',
  );
  const compileReport = candidate.compile_report;
  if (
    compileReport.schema_version !== 'CANONICAL_CONTRACT_BUNDLE_COMPILE_REPORT/V1'
    || !DIGEST_RE.test(compileReport.authored_input_identity_id)
    || !DIGEST_RE.test(compileReport.classification_registry_id)
    || !DIGEST_RE.test(compileReport.dependency_registry_id)
    || compileReport.non_governance_authored_member_count
      !== successor.authoredMemberCount
    || compileReport.aggregate_member_count !== REQUIRED_BUNDLE_KINDS.length
    || compileReport.required_kind_count !== REQUIRED_BUNDLE_KINDS.length
    || compileReport.missing_member_count !== 0
    || compileReport.extra_member_count !== 0
    || compileReport.duplicate_identity_count !== 0
    || compileReport.conflict_count !== 0
    || compileReport.status !== 'PASS'
    || candidate.compile_report_digest !== contentId(
      'CANONICAL_CONTRACT_BUNDLE_COMPILE_REPORT_DIGEST/V1',
      compileReport,
    )
  ) {
    fail(
      'INVALID_FREEZE_CANDIDATE',
      'The freeze candidate compile report is not exact and clean.',
    );
  }

  requireExactKeys(
    candidate.dependency_cycle_report,
    CYCLE_REPORT_KEYS,
    'freeze candidate dependency-cycle report',
    'INVALID_FREEZE_CANDIDATE',
  );
  const cycleReport = candidate.dependency_cycle_report;
  if (
    cycleReport.schema_version
      !== 'CANONICAL_CONTRACT_BUNDLE_DEPENDENCY_CYCLE_REPORT/V1'
    || cycleReport.node_count !== successor.authoredMemberCount
    || cycleReport.edge_count !== successor.dependencyEdgeCount
    || cycleReport.unresolved_dependency_count !== 0
    || cycleReport.self_dependency_count !== 0
    || cycleReport.cycle_count !== 0
    || cycleReport.status !== 'PASS'
    || candidate.cycle_report_digest !== contentId(
      'CANONICAL_CONTRACT_BUNDLE_DEPENDENCY_CYCLE_REPORT_DIGEST/V1',
      cycleReport,
    )
  ) {
    fail(
      'INVALID_FREEZE_CANDIDATE',
      'The freeze candidate dependency report is not exact and clean.',
    );
  }

  const aggregateBundleDigest = expectedAggregateBundleDigest;
  const aggregateBundleId = expectedAggregateBundleId;
  const aggregateMemberRoot = expectedAggregateMemberRoot;
  const compilationPayload = {
    canonical_contract_bundle_members: successor.records,
    canonical_contract_bundle_projection: successor.aggregateProjection,
    contract_bundle_id: aggregateBundleId,
    contract_bundle_digest: aggregateBundleDigest,
    canonical_contract_bundle_member_root: aggregateMemberRoot,
    canonical_contract_bundle_required_kind_set_root: requiredKindRoot,
    compile_report: compileReport,
    compile_report_digest: candidate.compile_report_digest,
    dependency_cycle_report: cycleReport,
    cycle_report_digest: candidate.cycle_report_digest,
  };
  const compilation = {
    schema_version: 'CANONICAL_CONTRACT_BUNDLE_COMPILATION/V1',
    ...compilationPayload,
    canonical_payload_digest: contentId(
      'CANONICAL_CONTRACT_BUNDLE_COMPILATION_PAYLOAD/V1',
      compilationPayload,
    ),
    disposition: {
      schema_version: 'CANONICAL_CONTRACT_BUNDLE_COMPILATION_DISPOSITION/V1',
      status: 'COMPILED_NOT_FROZEN',
      freeze_authority: 'NONE',
      signing_authority: 'NONE',
      writer_authority: 'NONE',
      serving_authority: 'NONE',
      database_authority: 'NONE',
      release_authority: 'NONE',
      activation_authority: 'NONE',
      production_authority: 'NONE',
    },
  };
  const compilationBytes = Buffer.from(canonicalJson(compilation), 'utf8');
  const compilationDigest = sha256Hex(compilationBytes);
  const expectedDeterminism = {
    schema_version: DETERMINISM_REPORT_SCHEMA_VERSION,
    compile_run_count: 2,
    first_compilation_payload_digest: compilationDigest,
    second_compilation_payload_digest: compilationDigest,
    canonical_byte_length: compilationBytes.length,
    mismatch_count: 0,
    status: 'PASS',
  };
  requireExactKeys(
    candidate.determinism_report,
    DETERMINISM_REPORT_KEYS,
    'freeze candidate determinism report',
    'INVALID_FREEZE_CANDIDATE',
  );
  if (
    !sameValue(candidate.determinism_report, expectedDeterminism)
    || candidate.determinism_report_digest !== contentId(
      'CANONICAL_CONTRACT_BUNDLE_DETERMINISM_REPORT_DIGEST/V1',
      expectedDeterminism,
    )
  ) {
    fail(
      'INVALID_FREEZE_CANDIDATE',
      'The freeze candidate determinism report does not reproduce the exact compilation.',
    );
  }

  const expectedOutputs = successor.records.map((member) => outputEntry(
    `generated/canonical-contract-bundle/members/${member.member_key.toLowerCase()}.json`,
    member,
  ));
  expectedOutputs.push(
    outputEntry(
      'generated/canonical-contract-bundle/canonical-contract-bundle-projection.json',
      successor.aggregateProjection,
    ),
    outputEntry(
      'generated/canonical-contract-bundle/compilation.json',
      compilation,
    ),
    outputEntry(
      'generated/canonical-contract-bundle/reports/compile-report.json',
      compileReport,
    ),
    outputEntry(
      'generated/canonical-contract-bundle/reports/dependency-cycle-report.json',
      cycleReport,
    ),
    outputEntry(
      'generated/canonical-contract-bundle/reports/determinism-report.json',
      expectedDeterminism,
    ),
    outputEntry(
      'generated/canonical-contract-bundle/generated-topology.json',
      candidate.generated_contract_topology,
    ),
  );
  expectedOutputs.sort((left, right) => left.path.localeCompare(right.path));
  if (!sameValue(candidate.generated_output_inventory, expectedOutputs)) {
    fail(
      'INVALID_FREEZE_CANDIDATE',
      'The freeze candidate generated-output inventory is not exact.',
    );
  }

  requireExactKeys(
    candidate.unsigned_contract_bundle_compilation_receipt_payload,
    UNSIGNED_RECEIPT_KEYS,
    'unsigned compilation receipt payload',
    'INVALID_FREEZE_CANDIDATE',
  );
  const expectedReceipt = {
    schema_version: 'ContractBundleCompilationReceipt/V1',
    contract_bundle_id: bundleId,
    contract_bundle_digest: bundleDigest,
    frozen_contract_pair_digest: frozenPairDigest,
    compiler_version: COMPILER_VERSION,
    generator_version: GENERATOR_VERSION,
    compile_report_digest: candidate.compile_report_digest,
    cycle_report_digest: candidate.cycle_report_digest,
    drift_report_digest: candidate.determinism_report_digest,
    generated_outputs: expectedOutputs,
    canonical_contract_bundle_member_root: memberRoot,
    canonical_contract_bundle_member_count:
      successor.records.length + successor.generatedRecords.length,
    canonical_contract_bundle_required_kind_set_root: requiredKindRoot,
    compile_errors: [],
    cycle_errors: [],
    drift_errors: [],
    terminal_state: 'PASS',
  };
  const expectedDisposition = {
    state: 'ASSEMBLED_NOT_FROZEN',
    complete_contract_universe_required: true,
    independent_reviews_required: true,
    ben_approval_required: true,
    receipt_signature_required: true,
    frozen_contract_pair_binding_validation:
      'DEFERRED_TO_CONTRACT_FREEZE_ATTESTATION_IDENTITY',
    freeze_authority: 'NONE',
    signing_authority: 'NONE',
    status_publication_authority: 'NONE',
    writer_authority: 'NONE',
    serving_authority: 'NONE',
    database_authority: 'NONE',
    release_authority: 'NONE',
    activation_authority: 'NONE',
    production_authority: 'NONE',
  };
  if (
    !sameValue(
      candidate.unsigned_contract_bundle_compilation_receipt_payload,
      expectedReceipt,
    )
    || !sameValue(
      candidate.formal_freeze_evidence_input_inventory,
      FORMAL_FREEZE_EVIDENCE_INPUTS,
    )
    || !sameValue(candidate.disposition, expectedDisposition)
  ) {
    fail(
      'INVALID_FREEZE_CANDIDATE',
      'The freeze candidate receipt, evidence inventory, or authority limits drifted.',
    );
  }
  return {
    bundleId,
    bundleDigest,
    memberRoot,
    requiredKindRoot,
  };
}

function deriveSemanticIdentityDiff(predecessor, successor, predecessorId, successorId) {
  const predecessorByKey = new Map(
    predecessor.map((member) => [member.member_key, member]),
  );
  const successorByKey = new Map(
    successor.map((member) => [member.member_key, member]),
  );
  const predecessorKeys = predecessor.map((member) => member.member_key);
  const successorKeys = successor.map((member) => member.member_key);
  const shared = predecessorKeys.filter((key) => successorByKey.has(key));
  return {
    predecessor_contract_bundle_id: predecessorId,
    successor_contract_bundle_id: successorId,
    added_member_keys: successorKeys.filter((key) => !predecessorByKey.has(key)),
    removed_member_keys: predecessorKeys.filter((key) => !successorByKey.has(key)),
    semantic_changed_member_keys: shared.filter(
      (key) => predecessorByKey.get(key).semantic_digest
        !== successorByKey.get(key).semantic_digest,
    ),
    identity_changed_member_keys: shared.filter(
      (key) => predecessorByKey.get(key).identity_digest
        !== successorByKey.get(key).identity_digest,
    ),
  };
}

function validateGoverningSpecification(packageValue) {
  const records = packageValue.governing_specification_member_records;
  let compiled;
  try {
    compiled = compileGoverningSpecificationMembers(
      records.map((record, index) => ({
        order: index + 1,
        path: record.path,
        byte_length: record.byte_length,
        payload_digest: record.payload_digest,
        source_bytes_base64: record.source_bytes_base64,
      })),
    );
  } catch (error) {
    fail(
      'INVALID_GOVERNING_SPECIFICATION_SOURCE_CLOSURE',
      'The governing specification does not satisfy the canonical six-member compiler.',
      { compiler_error_code: error.code || 'UNKNOWN' },
    );
  }
  if (
    !sameValue(compiled.governing_specification_member_records, records)
    || compiled.specification_root !== packageValue.specification_root
    || compiled.root_manifest_digest !== packageValue.root_manifest_digest
  ) {
    fail(
      'INVALID_GOVERNING_SPECIFICATION_SOURCE_CLOSURE',
      'The canonical specification compiler does not reproduce the retained records and roots.',
    );
  }
}

function validateIndependentGeneratedCompilation(packageValue) {
  const compilerInput = packageValue.canonical_contract_bundle_compiler_input;
  requireExactKeys(
    compilerInput,
    COMPILER_INPUT_KEYS,
    'canonical contract bundle compiler input',
    'INVALID_SOURCE_CLOSED_COMPILER_INPUT',
  );
  let aggregateCompilation;
  let generatedTopology;
  try {
    aggregateCompilation = compileCanonicalContractBundle(clone(compilerInput));
    generatedTopology = compileCanonicalContractBundleGeneratedTopology({
      canonical_contract_input_compilation:
        clone(compilerInput.canonical_contract_input_compilation),
      canonical_contract_bundle_compilation: aggregateCompilation,
    });
  } catch (error) {
    fail(
      'INVALID_SOURCE_CLOSED_COMPILER_INPUT',
      'The retained compiler input does not reproduce a complete generated topology.',
      { compiler_error_code: error.code || 'UNKNOWN' },
    );
  }
  const candidate = packageValue.contract_bundle_freeze_candidate;
  if (
    !sameValue(
      packageValue.governed_topology_input_identity,
      generatedTopology.governed_topology_input_identity,
    )
    || !sameValue(
      packageValue.canonical_contract_bundle_members,
      aggregateCompilation.canonical_contract_bundle_members,
    )
    || !sameValue(
      packageValue.aggregate_canonical_contract_bundle_projection,
      aggregateCompilation.canonical_contract_bundle_projection,
    )
    || !sameValue(
      packageValue.generated_contract_bundle_members,
      generatedTopology.generated_contract_bundle_members,
    )
    || !sameValue(
      candidate.generated_contract_topology,
      generatedTopology,
    )
    || candidate.contract_bundle_id
      !== generatedTopology.final_canonical_contract_bundle
        .canonical_contract_bundle_id
    || candidate.contract_bundle_digest
      !== generatedTopology.final_canonical_contract_bundle
        .canonical_contract_bundle_fingerprint
  ) {
    fail(
      'INDEPENDENT_GENERATED_TOPOLOGY_MISMATCH',
      'Independent compilation does not reproduce the retained generated members, manifest, roots, V3 ID and fingerprint.',
    );
  }
  return { aggregateCompilation, generatedTopology };
}

function validateExactReviewPackage(input) {
  const bytes = decodeCanonicalBase64(
    input.exact_review_package_bytes_base64,
    'exact_review_package_bytes_base64',
  );
  let packageValue;
  try {
    packageValue = JSON.parse(bytes.toString('utf8'));
  } catch {
    fail(
      'INVALID_EXACT_REVIEW_PACKAGE',
      'The exact review package bytes must contain UTF-8 JSON.',
    );
  }
  if (!bytes.equals(Buffer.from(canonicalJson(packageValue), 'utf8'))) {
    fail(
      'NON_CANONICAL_EXACT_REVIEW_PACKAGE_BYTES',
      'The exact review package bytes must use canonical JSON.',
    );
  }
  requireExactKeys(
    packageValue,
    REVIEW_PACKAGE_KEYS,
    'exact review package',
    'INVALID_EXACT_REVIEW_PACKAGE',
  );
  if (packageValue.schema_version !== EXACT_REVIEW_INPUT_VERSION) {
    fail(
      'P1_G0_SCOPE_CONFUSION',
      `The review package must use ${EXACT_REVIEW_INPUT_VERSION}.`,
    );
  }
  const fingerprint = contentId(REVIEW_PACKAGE_FINGERPRINT_DOMAIN, packageValue);
  if (fingerprint !== input.exact_review_package_fingerprint) {
    fail(
      'EXACT_REVIEW_PACKAGE_FINGERPRINT_MISMATCH',
      'The supplied fingerprint does not identify the exact review package bytes.',
    );
  }
  validateGoverningSpecification(packageValue);

  let predecessor;
  try {
    predecessor = validateCanonicalPredecessorBundleMembers(
      packageValue.predecessor_canonical_contract_bundle_members,
    );
  } catch (error) {
    fail(
      'INVALID_EXACT_REVIEW_PACKAGE',
      'The predecessor source closure is not mechanically valid.',
      { source_error_code: error.code || 'UNKNOWN' },
    );
  }
  const successorAggregates = validateSuccessorAggregates(
    packageValue.canonical_contract_bundle_members,
  );
  const successorGenerated = validateGeneratedMembers(
    packageValue.generated_contract_bundle_members,
  );
  const successorProjection = [
    ...successorAggregates.projection,
    ...successorGenerated.projection,
  ].sort((left, right) => left.member_key.localeCompare(right.member_key));
  const successor = {
    ...successorAggregates,
    aggregateProjection: successorAggregates.projection,
    generatedRecords: successorGenerated.records,
    generatedProjection: successorGenerated.projection,
    projection: successorProjection,
  };
  if (
    !sameValue(predecessor.projection, packageValue.predecessor_contract_bundle_projection)
    || !sameValue(
      successor.aggregateProjection,
      packageValue.aggregate_canonical_contract_bundle_projection,
    )
    || !sameValue(successorProjection, packageValue.canonical_contract_bundle_projection)
    || !sameValue(predecessor.source_kinds, packageValue.predecessor_source_kinds)
  ) {
    fail(
      'INVALID_EXACT_REVIEW_PACKAGE',
      'A bundle projection does not match its exact retained member bytes.',
    );
  }

  const predecessorDigest = domainDigest(
    'PROGRAMME_GATE_CONTRACT_BUNDLE_SNAPSHOT/V1',
    predecessor.projection,
  );
  const predecessorId = domainDigest(
    'PROGRAMME_GATE_CONTRACT_BUNDLE_ID/V1',
    { contract_bundle_digest: predecessorDigest },
  );
  const finalBundle = packageValue.contract_bundle_freeze_candidate
    .generated_contract_topology.final_canonical_contract_bundle;
  const successorDigest = finalBundle.canonical_contract_bundle_fingerprint;
  const successorId = finalBundle.canonical_contract_bundle_id;
  if (
    packageValue.predecessor_contract_bundle_digest !== predecessorDigest
    || packageValue.predecessor_contract_bundle_id !== predecessorId
    || packageValue.contract_bundle_digest !== successorDigest
    || packageValue.contract_bundle_id !== successorId
  ) {
    fail(
      'INVALID_EXACT_REVIEW_PACKAGE',
      'The bundle identity does not match the exact predecessor and successor projections.',
    );
  }

  const expectedDiff = deriveSemanticIdentityDiff(
    predecessor.projection,
    successorProjection,
    predecessorId,
    successorId,
  );
  const diffDigest = domainDigest(
    'PROGRAMME_GATE_CONTRACT_SEMANTIC_IDENTITY_DIFF/V1',
    expectedDiff,
  );
  if (
    !sameValue(packageValue.semantic_identity_diff, expectedDiff)
    || packageValue.semantic_identity_diff_digest !== diffDigest
  ) {
    fail(
      'INVALID_EXACT_REVIEW_PACKAGE',
      'The semantic-and-identity diff does not match the exact bundle pair.',
    );
  }

  const identity = packageValue.contract_freeze_attestation_identity;
  try {
    validateSchema('ContractFreezeAttestationIdentity/V1', identity);
  } catch (error) {
    fail(
      'INVALID_SOURCE_CLOSURE_IDENTITY',
      'The source-closure identity does not satisfy its signed schema.',
      { validation_error: error.message },
    );
  }
  const expectedIdentityId = domainDigest(
    'PROGRAMME_GATE_CONTRACT_FREEZE_ATTESTATION_ID/V1',
    recordWithout(identity, ['contract_freeze_attestation_id']),
  );
  const predecessorMemberRoot = domainDigest(
    'PROGRAMME_GATE_CANONICAL_CONTRACT_BUNDLE_MEMBER_ROOT/V1',
    predecessor.members,
  );
  if (
    !sameValue(identity, input.source_closure_identity)
    || identity.contract_freeze_attestation_id !== expectedIdentityId
    || identity.specification_root !== packageValue.specification_root
    || identity.code_commit !== input.code_commit
    || identity.code_commit !== packageValue.code_commit
    || identity.environment !== packageValue.environment
    || identity.predecessor_contract_bundle_id !== predecessorId
    || identity.predecessor_contract_bundle_digest !== predecessorDigest
    || identity.predecessor_canonical_contract_bundle_member_root
      !== predecessorMemberRoot
    || identity.predecessor_canonical_contract_bundle_member_count
      !== predecessor.members.length
    || identity.contract_bundle_id !== successorId
    || identity.contract_bundle_digest !== successorDigest
  ) {
    fail(
      'SOURCE_CLOSURE_IDENTITY_MISMATCH',
      'The source-closure identity does not bind the exact code and bundle pair.',
    );
  }

  const pairDigest = domainDigest(
    'PROGRAMME_GATE_FROZEN_CONTRACT_PAIR/V1',
    {
      predecessor_contract_bundle_id: predecessorId,
      predecessor_contract_bundle_digest: predecessorDigest,
      successor_contract_bundle_id: successorId,
      successor_contract_bundle_digest: successorDigest,
      contract_freeze_attestation_id: expectedIdentityId,
    },
  );
  if (
    pairDigest !== input.frozen_contract_pair_digest
    || pairDigest !== packageValue.frozen_contract_pair_digest
  ) {
    fail(
      'FROZEN_CONTRACT_PAIR_MISMATCH',
      'The frozen-pair digest does not bind the exact source-closed bundle pair.',
    );
  }
  const candidateFacts = validateFreezeCandidate(
    packageValue.contract_bundle_freeze_candidate,
    successor,
    pairDigest,
  );
  validateIndependentGeneratedCompilation(packageValue);

  const sourceSetDigest = domainDigest(
    'PROGRAMME_GATE_CONTRACT_DIFF_REVIEW_SOURCE_SET/V1',
    {
      exact_review_input_schema_version: EXACT_REVIEW_INPUT_VERSION,
      canonical_contract_bundle_compiler_input:
        packageValue.canonical_contract_bundle_compiler_input,
      governed_topology_input_identity:
        packageValue.governed_topology_input_identity,
      predecessor_canonical_contract_bundle_members: predecessor.members,
      canonical_contract_bundle_members: packageValue.canonical_contract_bundle_members,
      generated_contract_bundle_members:
        packageValue.generated_contract_bundle_members,
    },
  );
  const inputContextDigest = domainDigest(
    'PROGRAMME_GATE_CONTRACT_DIFF_REVIEW_EXACT_INPUT_CONTEXT/V1',
    {
      specification_root: packageValue.specification_root,
      code_commit: input.code_commit,
      predecessor_contract_bundle_id: predecessorId,
      predecessor_contract_bundle_digest: predecessorDigest,
      contract_bundle_id: successorId,
      contract_bundle_digest: successorDigest,
      frozen_contract_pair_digest: pairDigest,
      semantic_identity_diff_digest: diffDigest,
      reviewed_contract_source_set_digest: sourceSetDigest,
    },
  );
  if (
    packageValue.reviewed_contract_source_set_digest !== sourceSetDigest
    || packageValue.exact_review_input_context_digest !== inputContextDigest
    || candidateFacts.bundleId !== successorId
    || candidateFacts.bundleDigest !== successorDigest
  ) {
    fail(
      'EXACT_REVIEW_CONTEXT_MISMATCH',
      'The exact review context does not bind the retained sources and frozen pair.',
    );
  }
  return {
    packageValue,
    bytes,
    payloadDigest: sha256Hex(bytes),
    inputContextDigest,
  };
}

function completeGitAuthorshipFacts(codeCommit, gitRuntime = {}) {
  requirePlainObject(gitRuntime, 'read-only Git runtime');
  const repositoryRoot = gitRuntime.repositoryRoot ?? process.cwd();
  let events;
  try {
    events = enumerateCompleteGitAuthorshipUniverse({
      repositoryRoot,
      expectedCommit: codeCommit,
    });
  } catch (error) {
    fail(
      'INCOMPLETE_P1_REVIEWER_ANCESTRY',
      'A complete non-shallow Git ancestry for the exact reviewed commit is required.',
      { git_error: error.message },
    );
  }
  return {
    events,
    root: domainDigest(
      SOURCE_CONTROL_AUTHORSHIP_EVENT_SET_ROOT_DOMAIN,
      events,
    ),
  };
}

function validateIndependenceBinding(
  binding,
  reviewerBinding,
  codeCommit,
  gitAuthorship,
) {
  requireExactKeys(
    binding,
    INDEPENDENCE_BINDING_KEYS,
    `${reviewerBinding.lane_id} independence_binding`,
  );
  requireNonEmptyString(
    binding.immutable_session_id,
    `${reviewerBinding.lane_id} immutable_session_id`,
  );
  if (
    binding.session_parent_or_genesis !== 'GENESIS'
    || binding.source_control_history_scope
      !== 'REVIEWED_COMMIT_ANCESTRY_FROM_REPOSITORY_GENESIS'
    || binding.reviewed_code_commit !== codeCommit
  ) {
    fail(
      'NON_INDEPENDENT_P1_REVIEWER',
      `${reviewerBinding.lane_id} does not use a genesis review session bound to the exact commit.`,
    );
  }
  if (
    !Array.isArray(binding.source_control_authorship_events)
    || binding.source_control_authorship_events.length === 0
  ) {
    fail(
      'INCOMPLETE_P1_REVIEWER_ANCESTRY',
      `${reviewerBinding.lane_id} must bind the enumerated complete Git ancestry.`,
    );
  }
  const ancestryIdentities = new Set();
  for (const [index, event] of binding.source_control_authorship_events.entries()) {
    requireExactKeys(
      event,
      ['commit_id', 'identity_set'],
      `${reviewerBinding.lane_id} source_control_authorship_events[${index}]`,
    );
    requireCommit(event.commit_id, `${reviewerBinding.lane_id} authorship commit`);
    requireClosedStringSet(
      event.identity_set,
      `${reviewerBinding.lane_id} authorship identity_set`,
    );
    event.identity_set.forEach((identity) => ancestryIdentities.add(identity));
  }
  if (
    !sameValue(binding.source_control_authorship_events, gitAuthorship.events)
    || binding.source_control_authorship_event_set_root !== gitAuthorship.root
  ) {
    fail(
      'INCOMPLETE_P1_REVIEWER_ANCESTRY',
      `${reviewerBinding.lane_id} omitted or changed the enumerated Git ancestry.`,
    );
  }
  requireClosedStringSet(
    binding.prior_conclusion_input_set,
    `${reviewerBinding.lane_id} prior_conclusion_input_set`,
    { allowEmpty: true },
  );
  requireClosedStringSet(
    binding.reviewer_edit_set,
    `${reviewerBinding.lane_id} reviewer_edit_set`,
    { allowEmpty: true },
  );
  if (
    binding.prior_conclusion_input_set.length !== 0
    || binding.reviewer_edit_set.length !== 0
    || reviewerBinding.reviewer_source_control_identity_set.some(
      (identity) => ancestryIdentities.has(identity),
    )
  ) {
    fail(
      'NON_INDEPENDENT_P1_REVIEWER',
      `${reviewerBinding.lane_id} reviewer ancestry, prior conclusions, or edits are not independent.`,
    );
  }
}

function validateReviewerBindings(bindings, codeCommit, gitRuntime) {
  if (!Array.isArray(bindings) || bindings.length !== REVIEW_LANES.length) {
    fail(
      'INVALID_P1_REVIEW_LANE_SET',
      'Exactly three governed P1 reviewer bindings are required.',
    );
  }
  const principals = new Set();
  const identities = new Set();
  const sessions = new Set();
  const dispositionIds = new Set();
  const reviewerSourceControlIdentities = new Set();
  const gitAuthorship = completeGitAuthorshipFacts(codeCommit, gitRuntime);
  for (const [index, expectedLane] of REVIEW_LANES.entries()) {
    const binding = bindings[index];
    requireExactKeys(
      binding,
      REVIEWER_BINDING_KEYS,
      `reviewer_bindings[${index}]`,
    );
    if (
      binding.lane_id !== expectedLane.lane_id
      || binding.reviewer_role !== expectedLane.reviewer_role
    ) {
      fail(
        binding.lane_id?.startsWith('G0_')
          ? 'P1_G0_SCOPE_CONFUSION'
          : 'INVALID_P1_REVIEW_LANE_SET',
        'Reviewer bindings must use the exact ordered formal P1 lanes and roles.',
      );
    }
    requireNonEmptyString(binding.reviewer_principal_id, 'reviewer_principal_id');
    requireNonEmptyString(binding.reviewer_identity, 'reviewer_identity');
    requireClosedStringSet(
      binding.reviewer_source_control_identity_set,
      'reviewer_source_control_identity_set',
    );
    if (!binding.reviewer_source_control_identity_set.includes(
      binding.reviewer_identity,
    )) {
      fail(
        'INVALID_P1_REVIEWER_IDENTITY_BINDING',
        `${binding.lane_id} reviewer identity is absent from its source-control identity set.`,
      );
    }
    if (binding.reviewer_source_control_identity_set.some(
      (identity) => reviewerSourceControlIdentities.has(identity),
    )) {
      fail(
        'OVERLAPPING_P1_REVIEWER_IDENTITY_SETS',
        'The three reviewer source-control identity sets must be pairwise disjoint.',
      );
    }
    requireDigest(binding.reviewer_eligibility_digest, 'reviewer_eligibility_digest');
    requireDigest(binding.review_disposition_id, 'review_disposition_id');
    if (
      binding.reviewer_model_identifier !== EXACT_MODEL_IDENTIFIER
      || binding.reasoning_level !== EXACT_REASONING_LEVEL
    ) {
      fail(
        'INVALID_P1_REVIEWER_RUNTIME',
        `Every P1 reviewer must use ${EXACT_MODEL_IDENTIFIER} with high reasoning.`,
      );
    }
    validateIndependenceBinding(
      binding.independence_binding,
      binding,
      codeCommit,
      gitAuthorship,
    );
    if (
      principals.has(binding.reviewer_principal_id)
      || identities.has(binding.reviewer_identity)
      || sessions.has(binding.independence_binding.immutable_session_id)
      || dispositionIds.has(binding.review_disposition_id)
    ) {
      fail(
        'DUPLICATE_P1_REVIEWER',
        'The three P1 lanes require distinct principals, identities, sessions, and disposition IDs.',
      );
    }
    principals.add(binding.reviewer_principal_id);
    identities.add(binding.reviewer_identity);
    sessions.add(binding.independence_binding.immutable_session_id);
    dispositionIds.add(binding.review_disposition_id);
    binding.reviewer_source_control_identity_set.forEach(
      (identity) => reviewerSourceControlIdentities.add(identity),
    );
  }
}

function promptFor(lane) {
  return [
    `You are the independent ${lane.lane_id} reviewer for the formal P1 contract-freeze bundle.`,
    'Review only ./exact-review-package.json. It contains the exact canonical package bytes supplied in this task.',
    `Focus on ${lane.focus}.`,
    'Do not use G0 cold-review conclusions as a substitute for this P1 review.',
    'Do not modify files, sign records, approve the freeze, or claim gate authority.',
    'Use PASS only when there is no finding.',
    'Use BLOCKING when at least one finding prevents the formal record.',
    'Use NON-BLOCKING only when every finding is non-blocking.',
    'Each finding must name the exact file, exact rule, and required correction.',
    'Return only the closed result object.',
  ].join('\n');
}

function taskFor(lane, binding, input, packageFacts) {
  const independenceBindingDigest = domainDigest(
    'PROGRAMME_GATE_P1_REVIEW_INDEPENDENCE_BINDING/V1',
    binding.independence_binding,
  );
  const payload = {
    schema_version: TASK_VERSION,
    gate_id: GATE_ID,
    lane_id: lane.lane_id,
    formal_record_schema_id: lane.formal_record_schema_id,
    formal_authority_kind: lane.formal_authority_kind,
    review_scope: lane.review_scope,
    exact_review_input: {
      exact_review_package_fingerprint:
        input.exact_review_package_fingerprint,
      exact_review_package_payload_digest: packageFacts.payloadDigest,
      exact_review_package_byte_length: packageFacts.bytes.length,
      exact_review_package_bytes_base64:
        input.exact_review_package_bytes_base64,
      exact_input_context_digest: packageFacts.inputContextDigest,
      code_commit: input.code_commit,
      frozen_contract_pair_digest: input.frozen_contract_pair_digest,
      contract_freeze_attestation_id:
        input.source_closure_identity.contract_freeze_attestation_id,
    },
    reviewer_binding: clone(binding),
    independence_binding_digest: independenceBindingDigest,
    prompt: promptFor(lane),
    output_contract: {
      schema_version: RESULT_VERSION,
      dispositions: ['PASS', 'BLOCKING', 'NON-BLOCKING'],
      finding_fields: [
        'disposition',
        'file',
        'rule',
        'required_correction',
      ],
      signing_authority: 'NONE',
      gate_authority: 'NONE',
    },
  };
  return {
    ...payload,
    task_id: domainDigest(
      'PROGRAMME_GATE_P1_CONTRACT_FREEZE_REVIEW_TASK_ID/V1',
      payload,
    ),
  };
}

function validateRequestInput(value, gitRuntime) {
  requireExactKeys(value, REQUEST_INPUT_KEYS, 'P1 review request input');
  if (value.schema_version !== REQUEST_INPUT_VERSION) {
    fail(
      value.schema_version?.includes('G0')
        ? 'P1_G0_SCOPE_CONFUSION'
        : 'INVALID_P1_REVIEW_INPUT',
      `P1 review input must use ${REQUEST_INPUT_VERSION}.`,
    );
  }
  requireDigest(
    value.exact_review_package_fingerprint,
    'exact_review_package_fingerprint',
  );
  requireCommit(value.code_commit, 'code_commit');
  requireDigest(value.frozen_contract_pair_digest, 'frozen_contract_pair_digest');
  validateReviewerBindings(value.reviewer_bindings, value.code_commit, gitRuntime);
  return validateExactReviewPackage(value);
}

function planInputFromRequestInput(value) {
  return Object.fromEntries(
    EXECUTION_PLAN_INPUT_KEYS.map((key) => [key, value[key]]),
  );
}

function validateExecutionPlanInput(value) {
  requireExactKeys(value, EXECUTION_PLAN_INPUT_KEYS, 'P1 review execution-plan input');
  if (value.schema_version !== EXECUTION_PLAN_INPUT_VERSION) {
    fail('INVALID_P1_REVIEW_EXECUTION_PLAN', `P1 review execution-plan input must use ${EXECUTION_PLAN_INPUT_VERSION}.`);
  }
  requireDigest(value.exact_review_package_fingerprint, 'exact_review_package_fingerprint');
  requireCommit(value.code_commit, 'code_commit');
  requireDigest(value.frozen_contract_pair_digest, 'frozen_contract_pair_digest');
  return validateExactReviewPackage(value);
}

function createP1ContractFreezeReviewExecutionPlan(value) {
  requirePlainObject(value, 'P1 review execution-plan input');
  const planInput = clone(value);
  const packageFacts = validateExecutionPlanInput(planInput);
  const taskTemplates = REVIEW_LANES.map((lane) => {
    const payload = {
      lane_id: lane.lane_id,
      reviewer_role: lane.reviewer_role,
      prompt: promptFor(lane),
    };
    return {
      ...payload,
      task_template_id: domainDigest(
        'PROGRAMME_GATE_P1_CONTRACT_FREEZE_REVIEW_TASK_TEMPLATE_ID/V1',
        {
          ...payload,
          exact_review_package_fingerprint: planInput.exact_review_package_fingerprint,
          exact_review_package_payload_digest: packageFacts.payloadDigest,
          code_commit: planInput.code_commit,
          frozen_contract_pair_digest: planInput.frozen_contract_pair_digest,
        },
      ),
    };
  });
  const identity = {
    exact_review_package_fingerprint: planInput.exact_review_package_fingerprint,
    exact_review_package_payload_digest: packageFacts.payloadDigest,
    code_commit: planInput.code_commit,
    frozen_contract_pair_digest: planInput.frozen_contract_pair_digest,
    ordered_task_template_ids: taskTemplates.map((task) => task.task_template_id),
  };
  return deepFreeze({
    schema_version: EXECUTION_PLAN_VERSION,
    execution_plan_id: domainDigest(
      'PROGRAMME_GATE_P1_CONTRACT_FREEZE_REVIEW_EXECUTION_PLAN_ID/V1',
      identity,
    ),
    plan_input: planInput,
    task_templates: taskTemplates,
    disposition: {
      state: 'SEALED_PRE_EXECUTION_NOT_REVIEWED',
      signing_authority: 'NONE',
      gate_authority: 'NONE',
      freeze_authority: 'NONE',
    },
  });
}

function validateExecutionPlan(plan) {
  requireExactKeys(plan, EXECUTION_PLAN_KEYS, 'P1 review execution plan', 'INVALID_P1_REVIEW_EXECUTION_PLAN');
  if (plan.schema_version !== EXECUTION_PLAN_VERSION) {
    fail('INVALID_P1_REVIEW_EXECUTION_PLAN', `P1 review execution plan must use ${EXECUTION_PLAN_VERSION}.`);
  }
  const expected = createP1ContractFreezeReviewExecutionPlan(plan.plan_input);
  if (!sameValue(plan, expected)) {
    fail('SELF_REHASHED_P1_REVIEW_EXECUTION_PLAN', 'The P1 review execution plan does not match the exact sealed package and task templates.');
  }
  return expected;
}

function validateObservedFindingOutput(output, laneId) {
  requireExactKeys(
    output,
    ['disposition', 'findings'],
    `${laneId} observed finding output`,
    'INVALID_P1_REVIEW_RESULT',
  );
  if (!['PASS', 'BLOCKING', 'NON-BLOCKING'].includes(output.disposition) || !Array.isArray(output.findings)) {
    fail('INVALID_P1_REVIEW_RESULT', `${laneId} observed finding output has an invalid closed disposition.`);
  }
  const provisional = { lane_id: laneId };
  output.findings.forEach((finding, index) => validateFinding(finding, index, provisional));
  const blockingCount = output.findings.filter((finding) => finding.disposition === 'BLOCKING').length;
  if (
    (output.disposition === 'PASS' && output.findings.length !== 0)
    || (output.disposition === 'BLOCKING' && (output.findings.length === 0 || blockingCount === 0))
    || (output.disposition === 'NON-BLOCKING' && (output.findings.length === 0 || blockingCount !== 0))
  ) {
    fail('INVALID_P1_REVIEW_RESULT', `${laneId} observed disposition does not match its findings.`);
  }
}

function finaliseP1ContractFreezeReviewExecution({ executionPlan, observedReviews, gitRuntime = {} } = {}) {
  const plan = validateExecutionPlan(executionPlan);
  if (!Array.isArray(observedReviews) || observedReviews.length !== REVIEW_LANES.length) {
    fail('INVALID_P1_REVIEW_OBSERVATION_SET', 'Exactly three observed fresh P1 review sessions are required.');
  }
  const observations = observedReviews.map((value, index) => {
    requireExactKeys(value, OBSERVED_REVIEW_KEYS, `P1 observed review ${index + 1}`, 'INVALID_P1_REVIEW_OBSERVATION_SET');
    const expectedLane = REVIEW_LANES[index];
    if (
      value.lane_id !== expectedLane.lane_id
      || value.reviewer_model_identifier !== EXACT_MODEL_IDENTIFIER
      || value.reasoning_level !== EXACT_REASONING_LEVEL
    ) {
      fail('INVALID_P1_REVIEW_OBSERVATION_SET', 'Observed P1 review runtime or lane does not match the sealed task template.');
    }
    requireNonEmptyString(value.immutable_session_id, `${value.lane_id} immutable_session_id`, 'INVALID_P1_REVIEW_OBSERVATION_SET');
    validateObservedFindingOutput(value.finding_output, value.lane_id);
    return clone(value);
  });
  if (new Set(observations.map((value) => value.immutable_session_id)).size !== REVIEW_LANES.length) {
    fail('DUPLICATE_P1_REVIEWER', 'The three P1 review observations must have distinct fresh session IDs.');
  }
  const authorship = completeGitAuthorshipFacts(plan.plan_input.code_commit, gitRuntime);
  const reviewerBindings = observations.map((observation, index) => {
    const template = plan.task_templates[index];
    const sessionPrincipal = `P1_REVIEW_SESSION_PRINCIPAL/${observation.immutable_session_id}`;
    const sessionIdentity = `P1_REVIEW_SESSION_IDENTITY/${observation.immutable_session_id}`;
    return {
      lane_id: observation.lane_id,
      reviewer_role: template.reviewer_role,
      reviewer_principal_id: sessionPrincipal,
      reviewer_identity: sessionIdentity,
      reviewer_model_identifier: observation.reviewer_model_identifier,
      reasoning_level: observation.reasoning_level,
      reviewer_source_control_identity_set: [sessionIdentity],
      reviewer_eligibility_digest: domainDigest(
        'PROGRAMME_GATE_P1_OBSERVED_REVIEWER_ELIGIBILITY/V1',
        {
          execution_plan_id: plan.execution_plan_id,
          task_template_id: template.task_template_id,
          immutable_session_id: observation.immutable_session_id,
          reviewer_principal_id: sessionPrincipal,
          reviewer_identity: sessionIdentity,
          reviewer_model_identifier: observation.reviewer_model_identifier,
          reasoning_level: observation.reasoning_level,
        },
      ),
      review_disposition_id: domainDigest(
        'PROGRAMME_GATE_P1_OBSERVED_REVIEW_DISPOSITION/V1',
        {
          execution_plan_id: plan.execution_plan_id,
          task_template_id: template.task_template_id,
          immutable_session_id: observation.immutable_session_id,
          finding_output: observation.finding_output,
        },
      ),
      independence_binding: {
        immutable_session_id: observation.immutable_session_id,
        session_parent_or_genesis: 'GENESIS',
        source_control_history_scope: 'REVIEWED_COMMIT_ANCESTRY_FROM_REPOSITORY_GENESIS',
        reviewed_code_commit: plan.plan_input.code_commit,
        source_control_authorship_events: authorship.events,
        source_control_authorship_event_set_root: authorship.root,
        prior_conclusion_input_set: [],
        reviewer_edit_set: [],
      },
    };
  });
  const request = createP1ContractFreezeReviewRequest({
    ...planInputFromRequestInput(plan.plan_input),
    schema_version: REQUEST_INPUT_VERSION,
    reviewer_bindings: reviewerBindings,
  }, { gitRuntime });
  const results = request.tasks.map((task, index) => ({
    schema_version: RESULT_VERSION,
    gate_id: GATE_ID,
    lane_id: task.lane_id,
    task_id: task.task_id,
    exact_review_package_fingerprint: task.exact_review_input.exact_review_package_fingerprint,
    exact_review_package_payload_digest: task.exact_review_input.exact_review_package_payload_digest,
    code_commit: task.exact_review_input.code_commit,
    frozen_contract_pair_digest: task.exact_review_input.frozen_contract_pair_digest,
    contract_freeze_attestation_id: task.exact_review_input.contract_freeze_attestation_id,
    review_disposition_id: task.reviewer_binding.review_disposition_id,
    reviewer_principal_id: task.reviewer_binding.reviewer_principal_id,
    reviewer_identity: task.reviewer_binding.reviewer_identity,
    reviewer_role: task.reviewer_binding.reviewer_role,
    reviewer_model_identifier: task.reviewer_binding.reviewer_model_identifier,
    reasoning_level: task.reviewer_binding.reasoning_level,
    immutable_session_id: task.reviewer_binding.independence_binding.immutable_session_id,
    independence_binding_digest: domainDigest('PROGRAMME_GATE_P1_REVIEW_INDEPENDENCE_BINDING/V1', task.reviewer_binding.independence_binding),
    disposition: observations[index].finding_output.disposition,
    findings: observations[index].finding_output.findings,
  }));
  return deepFreeze({ execution_plan: plan, request, results });
}

function createP1ContractFreezeReviewRequest(value, { gitRuntime = {} } = {}) {
  requirePlainObject(value, 'P1 review request input');
  const input = clone(value);
  const packageFacts = validateRequestInput(input, gitRuntime);
  const tasks = REVIEW_LANES.map((lane, index) => (
    taskFor(lane, input.reviewer_bindings[index], input, packageFacts)
  ));
  const requestIdentity = {
    gate_id: GATE_ID,
    exact_review_package_fingerprint:
      input.exact_review_package_fingerprint,
    exact_review_package_payload_digest: packageFacts.payloadDigest,
    code_commit: input.code_commit,
    frozen_contract_pair_digest: input.frozen_contract_pair_digest,
    source_closure_identity: input.source_closure_identity,
    ordered_task_ids: tasks.map((task) => task.task_id),
  };
  return deepFreeze({
    schema_version: REQUEST_VERSION,
    request_id: domainDigest(
      'PROGRAMME_GATE_P1_CONTRACT_FREEZE_REVIEW_REQUEST_ID/V1',
      requestIdentity,
    ),
    gate_id: GATE_ID,
    request_input: input,
    tasks,
    disposition: {
      state: 'TASKS_CREATED_NOT_REVIEWED',
      structural_validation_only: true,
      review_execution: 'NOT_PERFORMED',
      signing_authority: 'NONE',
      freeze_authority: 'NONE',
      status_publication_authority: 'NONE',
    },
  });
}

function validateRequest(request, gitRuntime) {
  requireExactKeys(
    request,
    ['schema_version', 'request_id', 'gate_id', 'request_input', 'tasks', 'disposition'],
    'P1 review request',
    'INVALID_P1_REVIEW_REQUEST',
  );
  if (request.schema_version !== REQUEST_VERSION || request.gate_id !== GATE_ID) {
    fail('P1_G0_SCOPE_CONFUSION', 'Only a formal P1 review request is accepted.');
  }
  const expected = createP1ContractFreezeReviewRequest(
    request.request_input,
    { gitRuntime },
  );
  if (!sameValue(request, expected)) {
    fail(
      'SELF_REHASHED_P1_REVIEW_SUBSTITUTION',
      'The review request does not match the exact controller-generated request.',
    );
  }
  return expected;
}

function validateFinding(finding, index, result) {
  requireExactKeys(
    finding,
    ['disposition', 'file', 'rule', 'required_correction'],
    `${result.lane_id} findings[${index}]`,
    'INVALID_P1_REVIEW_RESULT',
  );
  if (!['BLOCKING', 'NON-BLOCKING'].includes(finding.disposition)) {
    fail(
      'INVALID_P1_REVIEW_RESULT',
      'A finding disposition must be BLOCKING or NON-BLOCKING.',
    );
  }
  for (const field of ['file', 'rule', 'required_correction']) {
    requireNonEmptyString(
      finding[field],
      `${result.lane_id} finding ${field}`,
      'INVALID_P1_REVIEW_RESULT',
    );
  }
  if (
    finding.file.startsWith('/')
    || finding.file.includes('\\')
    || finding.file.split('/').some((part) => part === '' || part === '.' || part === '..')
  ) {
    fail(
      'INVALID_P1_REVIEW_RESULT',
      'A finding file must be an exact safe repository-relative path.',
    );
  }
}

function validateOneResult(result, task) {
  requireExactKeys(
    result,
    RESULT_KEYS,
    `${task.lane_id} result`,
    'INVALID_P1_REVIEW_RESULT',
  );
  const expected = {
    schema_version: RESULT_VERSION,
    gate_id: GATE_ID,
    lane_id: task.lane_id,
    task_id: task.task_id,
    exact_review_package_fingerprint:
      task.exact_review_input.exact_review_package_fingerprint,
    exact_review_package_payload_digest:
      task.exact_review_input.exact_review_package_payload_digest,
    code_commit: task.exact_review_input.code_commit,
    frozen_contract_pair_digest:
      task.exact_review_input.frozen_contract_pair_digest,
    contract_freeze_attestation_id:
      task.exact_review_input.contract_freeze_attestation_id,
    review_disposition_id:
      task.reviewer_binding.review_disposition_id,
    reviewer_principal_id:
      task.reviewer_binding.reviewer_principal_id,
    reviewer_identity: task.reviewer_binding.reviewer_identity,
    reviewer_role: task.reviewer_binding.reviewer_role,
    reviewer_model_identifier:
      task.reviewer_binding.reviewer_model_identifier,
    reasoning_level: task.reviewer_binding.reasoning_level,
    immutable_session_id:
      task.reviewer_binding.independence_binding.immutable_session_id,
    independence_binding_digest: task.independence_binding_digest,
  };
  for (const [key, value] of Object.entries(expected)) {
    if (result[key] !== value) {
      fail(
        result.gate_id?.startsWith('G0_')
          ? 'P1_G0_SCOPE_CONFUSION'
          : 'P1_REVIEW_RESULT_BINDING_MISMATCH',
        `${task.lane_id} result changed the exact ${key} binding.`,
      );
    }
  }
  if (!['PASS', 'BLOCKING', 'NON-BLOCKING'].includes(result.disposition)) {
    fail(
      'INVALID_P1_REVIEW_RESULT',
      `${task.lane_id} result must contain a closed disposition.`,
    );
  }
  if (!Array.isArray(result.findings)) {
    fail(
      'INVALID_P1_REVIEW_RESULT',
      `${task.lane_id} result must contain findings.`,
    );
  }
  result.findings.forEach((finding, index) => validateFinding(finding, index, result));
  const blockingCount = result.findings.filter(
    (finding) => finding.disposition === 'BLOCKING',
  ).length;
  const nonBlockingCount = result.findings.length - blockingCount;
  if (
    (result.disposition === 'PASS' && result.findings.length !== 0)
    || (
      result.disposition === 'BLOCKING'
      && (result.findings.length === 0 || blockingCount === 0)
    )
    || (
      result.disposition === 'NON-BLOCKING'
      && (result.findings.length === 0 || blockingCount !== 0)
    )
  ) {
    fail(
      'INVALID_P1_REVIEW_RESULT',
      `${task.lane_id} disposition does not match its findings.`,
    );
  }
  return {
    lane_id: task.lane_id,
    reported_disposition: result.disposition,
    blocking_finding_count: blockingCount,
    non_blocking_finding_count: nonBlockingCount,
  };
}

function blockedValidation(exactRequest, {
  reasonCode,
  reason,
  authenticatedResultCount = 0,
  resultAuthentication = 'NOT_REGISTERED',
  signedRecordProduction = 'NOT_PERFORMED',
} = {}) {
  return deepFreeze({
    schema_version: VALIDATION_VERSION,
    request_id: exactRequest.request_id,
    exact_review_package_fingerprint:
      exactRequest.request_input.exact_review_package_fingerprint,
    code_commit: exactRequest.request_input.code_commit,
    frozen_contract_pair_digest:
      exactRequest.request_input.frozen_contract_pair_digest,
    validation_state: 'BLOCKED',
    reason_code: reasonCode,
    reason,
    structurally_checked_result_count: REVIEW_LANES.length,
    accepted_result_count: authenticatedResultCount,
    review_execution: 'NOT_PERFORMED_BY_CONTROLLER',
    result_authentication: resultAuthentication,
    signed_record_production: signedRecordProduction,
    gate_state: 'NOT_EVALUATED',
    freeze_authority: 'NONE',
    status_publication_authority: 'NONE',
  });
}

function validateP1ContractFreezeReviewResults({
  request,
  results,
  registration = null,
  authenticatedResults = null,
  reviewAuthority = null,
  gitRuntime = {},
} = {}) {
  const exactRequest = validateRequest(request, gitRuntime);
  if (!Array.isArray(results) || results.length !== REVIEW_LANES.length) {
    fail(
      'INVALID_P1_REVIEW_RESULT_SET',
      'Exactly one result for each of the three formal P1 lanes is required.',
    );
  }
  const laneIds = results.map((result) => result?.lane_id);
  if (
    new Set(laneIds).size !== laneIds.length
    || laneIds.some((laneId, index) => laneId !== REVIEW_LANES[index].lane_id)
  ) {
    fail(
      laneIds.some((laneId) => typeof laneId === 'string' && laneId.startsWith('G0_'))
        ? 'P1_G0_SCOPE_CONFUSION'
        : 'INVALID_P1_REVIEW_RESULT_SET',
      'Results must contain the exact ordered three-lane P1 review set.',
    );
  }
  results.forEach((result, index) => {
    validateOneResult(result, exactRequest.tasks[index]);
  });
  if (!registration && !authenticatedResults && !reviewAuthority) {
    return blockedValidation(exactRequest, {
      reasonCode: 'P1_SIGNED_REVIEW_REGISTRATION_UNAVAILABLE',
      reason:
        'No registered signed authority schema binds the exact P1 package, ordered task set, complete reviewer bindings, and authenticated result digests.',
    });
  }
  try {
    const acceptedResultCount = verifyP1ContractFreezeReviewRegistration({
      request: exactRequest,
      results,
      registration,
      authenticatedResults,
      authority: reviewAuthority,
    });
    return blockedValidation(exactRequest, {
      reasonCode: 'P1_FORMAL_REVIEW_GATE_AUTHORITY_UNAVAILABLE',
      reason:
        'Signed registration and authenticated lane records were verified, but no P1 freeze gate authority has evaluated them.',
      authenticatedResultCount: acceptedResultCount,
      resultAuthentication: 'CONTROLLER_SIGNED_AND_REGISTERED',
      signedRecordProduction: 'VERIFIED',
    });
  } catch (error) {
    if (!(error instanceof ContractFreezeReviewRegistrationError)) throw error;
    return blockedValidation(exactRequest, {
      reasonCode: error.code,
      reason: error.message,
      resultAuthentication: 'NOT_ACCEPTED',
      signedRecordProduction: 'NOT_VERIFIED',
    });
  }
}

module.exports = {
  EXACT_MODEL_IDENTIFIER,
  EXACT_REASONING_LEVEL,
  P1_CONTRACT_FREEZE_REVIEW_GATE_ID: GATE_ID,
  P1_CONTRACT_FREEZE_REVIEW_LANES: REVIEW_LANES,
  ContractFreezeReviewTaskError,
  createP1ContractFreezeReviewExecutionPlan,
  createP1ContractFreezeReviewPrompt(laneId) {
    const lane = REVIEW_LANES.find((candidate) => candidate.lane_id === laneId);
    if (!lane) throw new ContractFreezeReviewTaskError(
      'INVALID_P1_REVIEW_LANE_SET',
      'A formal P1 review prompt requires one governed lane.',
    );
    return promptFor(lane);
  },
  createP1ContractFreezeReviewRequest,
  finaliseP1ContractFreezeReviewExecution,
  validateP1ContractFreezeReviewResults,
};
