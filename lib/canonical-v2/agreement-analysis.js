'use strict';

const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');

const ANALYSIS_POLICY_SCHEMA = 'STAGE_2Y_ANALYSIS_POLICY/V1';
const ANALYSIS_TASK_SCHEMA = 'AGREEMENT_ANALYSIS_TASK/V1';
const AGREEMENT_INDEX_SCHEMA = 'AGREEMENT_INDEX/V1';
const CONTEXT_COMPILATION_SCHEMA = 'CONTEXT_COMPILATION/V1';
const AGREEMENT_ANALYSIS_SCHEMA = 'AGREEMENT_ANALYSIS/V1';
const ANALYSIS_CLAIM_SCHEMA = 'AGREEMENT_ANALYSIS_CLAIM/V1';
const ANALYSIS_EVIDENCE_SCHEMA = 'AGREEMENT_ANALYSIS_EVIDENCE_EDGE/V1';
const ANALYSIS_ROLE_SCHEMA = 'AGREEMENT_ANALYSIS_ROLE/V1';
const ROLE_PROVENANCE_SCHEMA = 'AGREEMENT_ANALYSIS_ROLE_PROVENANCE/V1';
const DEPENDENCY_EDGE_SCHEMA = 'AGREEMENT_ANALYSIS_DEPENDENCY_EDGE/V1';
const VALIDATION_RESULT_SCHEMA = 'PROPOSITION_VALIDATION_RESULT/V1';
const REPOSITORY_PROOF_SCHEMA = 'SHADOW_AGREEMENT_REPOSITORY_ROUND_TRIP_PROOF/V1';
const COORDINATE_SYSTEM = 'UTF8_CANONICAL_TEXT_HALF_OPEN';
const SEALED_POLICY_DIGEST = 'c4e0f233d7e247ebe348b811fa774d07a7618b8501859039b73cb4c931d014cd';
const SEALED_POLICY_BINDING = Object.freeze({
  path: 'evidence/canonical-v2/stage-2y-structure-migration/control/analysis-policy.json',
  byte_length: 252175,
  sha256: '2ac70b72546cb8acb8bb2e031368c7128e2ccad659c1cf1ec1fc6042b53c7927',
  schema_version: ANALYSIS_POLICY_SCHEMA,
  policy_version: 1,
  policy_digest: SEALED_POLICY_DIGEST,
});
const METSERA_AGREEMENT_ID = 'f783c4cdcaca4626c695d1c2c67924ccd8867eb066e16f17407ca64497ba778c';
const HEX_256 = /^[0-9a-f]{64}$/;

const TASK_MEMBERS = Object.freeze([
  'schema_version',
  'analysis_task_id',
  'requested_scope',
  'analysis_policy_binding',
  'analysis_policy',
  'context_compilation_binding',
  'context_compilation',
  'legacy_resolution_runs',
  'execution',
]);

const LEGACY_RUN_MEMBERS = Object.freeze([
  'run_identifier',
  'family',
  'resolution_binding',
  'resolution',
  'adapter_result_binding',
  'adapter_result',
  'validation_binding',
  'validation',
]);

const EXECUTION_CONTRACT = Object.freeze({
  mode: 'SHADOW_REPLAY',
  repository_mode: 'ROUND_TRIP_VERIFY',
  inference_adapter: 'NONE',
  model_calls_authorised: 0,
  phase_b_calls_authorised: 0,
});

const NODE_KIND_RANK = new Map([
  'QUALIFICATION',
  'SENTENCE',
  'LIMB',
  'CHAPEAU',
  'PARAGRAPH',
  'HEADING',
  'SECTION',
  'ARTICLE',
  'ANNEX',
  'AGREEMENT',
].map((kind, index) => [kind, index]));

const DEPENDENCY_KIND_RANK = new Map([
  'CONTEXT_FACT',
  'SCOPE_EDGE',
  'REFERENCE_EDGE',
  'DEFINITION_EDGE',
  'SEMANTIC_RELATIONSHIP',
  'SOURCE_NODE',
  'LEGACY_CLAIM_REVISION',
].map((kind, index) => [kind, index]));

class AgreementAnalysisError extends Error {
  constructor(code, detail) {
    const serialised = typeof detail === 'string' ? detail : canonicalJson(detail);
    super(`${code}: ${serialised}`);
    this.name = 'AgreementAnalysisError';
    this.code = code;
    this.detail = detail;
  }
}

function fail(code, detail) {
  throw new AgreementAnalysisError(`AGREEMENT_ANALYSIS_${code}`, detail);
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function clone(value) {
  return structuredClone(value);
}

function sameValue(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function assertExactMembers(value, members, detail) {
  if (!isPlainObject(value)) fail('INPUT_CONTRACT_MISMATCH', detail);
  const actual = Object.keys(value).sort();
  const expected = [...members].sort();
  if (!sameValue(actual, expected)) {
    fail('INPUT_CONTRACT_MISMATCH', { detail, expected, actual });
  }
}

function assertHex(value, detail) {
  if (typeof value !== 'string' || !HEX_256.test(value)) {
    fail('IDENTITY_MISMATCH', detail);
  }
}

function unsignedDigest(value, digestMember) {
  const unsigned = clone(value);
  delete unsigned[digestMember];
  return sha256Hex(canonicalJson(unsigned));
}

function verifyRawBoundObject(value, binding, serialisation, detail) {
  if (!isPlainObject(binding)
    || !Number.isSafeInteger(binding.byte_length)
    || binding.byte_length <= 0
    || !HEX_256.test(binding.sha256 || '')) {
    fail('RAW_BOUND_OBJECT_MISMATCH', `${detail}:binding`);
  }
  let text;
  if (serialisation === 'CANONICAL_JSON_ONE_LF') {
    text = `${canonicalJson(value)}\n`;
  } else if (serialisation === 'PRETTY_JSON_NO_LF') {
    text = JSON.stringify(value, null, 2);
  } else {
    fail('RAW_BOUND_OBJECT_MISMATCH', `${detail}:serialisation`);
  }
  const bytes = Buffer.from(text, 'utf8');
  if (bytes.length !== binding.byte_length || sha256Hex(bytes) !== binding.sha256) {
    fail('RAW_BOUND_OBJECT_MISMATCH', detail);
  }
}

function recordWithId(schemaVersion, idMember, unsignedRecord) {
  const id = contentId(schemaVersion, unsignedRecord);
  const entries = Object.entries(unsignedRecord);
  return Object.fromEntries([
    entries[0],
    [idMember, id],
    ...entries.slice(1),
  ]);
}

function deepFreeze(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

function span(startByte, endByte, sourceBytes) {
  if (!Number.isSafeInteger(startByte)
    || !Number.isSafeInteger(endByte)
    || startByte < 0
    || endByte <= startByte
    || endByte > sourceBytes.length) {
    fail('EVIDENCE_SPAN_NOT_CONSTRUCTIBLE', { start_byte: startByte, end_byte: endByte });
  }
  return {
    coordinate_system: COORDINATE_SYSTEM,
    start_byte: startByte,
    end_byte: endByte,
    text_sha256: sha256Hex(sourceBytes.subarray(startByte, endByte)),
  };
}

function validateSourceSpan(value, sourceBytes, detail) {
  if (!isPlainObject(value)
    || value.coordinate_system !== COORDINATE_SYSTEM
    || !Number.isSafeInteger(value.start_byte)
    || !Number.isSafeInteger(value.end_byte)
    || value.start_byte < 0
    || value.end_byte <= value.start_byte
    || value.end_byte > sourceBytes.length
    || !HEX_256.test(value.text_sha256 || '')
    || sha256Hex(sourceBytes.subarray(value.start_byte, value.end_byte)) !== value.text_sha256) {
    fail('SOURCE_BYTES_MISMATCH', detail);
  }
  return clone(value);
}

function sortedUnique(values) {
  return [...new Set(values)].sort();
}

function validatePolicy(policy, binding) {
  if (!isPlainObject(policy)
    || policy.schema_version !== ANALYSIS_POLICY_SCHEMA
    || policy.policy_version !== 1
    || policy.stage !== 'M4'
    || policy.effect !== 'ADDITIVE_SHADOW_JSON_ONLY'
    || policy.hidden_defaults !== false) {
    fail('POLICY_SCHEMA_MISMATCH', policy?.schema_version ?? null);
  }
  if (policy.policy_digest !== SEALED_POLICY_DIGEST
    || unsignedDigest(policy, 'policy_digest') !== policy.policy_digest) {
    fail('POLICY_DIGEST_MISMATCH', policy.policy_digest ?? null);
  }
  const expectedBinding = { ...SEALED_POLICY_BINDING };
  if (!sameValue(binding, expectedBinding)) {
    fail('POLICY_BINDING_MISMATCH', binding);
  }
  if (!Array.isArray(policy.required_role_schemas)
    || policy.required_role_schemas.length !== 1
    || policy.required_role_schemas[0].claim_definition_key !== 'METSERA_7_04_FRUSTRATION_BRANCH') {
    fail('NON_METSERA_REQUIRED_ROLE_SCHEMA', policy.required_role_schemas?.length ?? null);
  }
  return expectedBinding;
}

function buildDepths(nodesById, rootNodeId) {
  const depths = new Map([[rootNodeId, 0]]);
  function depth(nodeId, visiting = new Set()) {
    if (depths.has(nodeId)) return depths.get(nodeId);
    if (visiting.has(nodeId)) fail('INDEX_SCHEMA_MISMATCH', 'node cycle');
    const node = nodesById.get(nodeId);
    if (!node) fail('INDEX_SCHEMA_MISMATCH', `missing node ${nodeId}`);
    visiting.add(nodeId);
    const value = depth(node.parent_node_occurrence_id, visiting) + 1;
    visiting.delete(nodeId);
    depths.set(nodeId, value);
    return value;
  }
  for (const nodeId of nodesById.keys()) depth(nodeId);
  return depths;
}

function validateIndex(index, policy) {
  if (!isPlainObject(index) || index.schema_version !== AGREEMENT_INDEX_SCHEMA) {
    fail('INDEX_SCHEMA_MISMATCH', index?.schema_version ?? null);
  }
  const expected = policy.input_contract.agreement_inputs.find(
    (candidate) => candidate.agreement_index_id === index.agreement_index_id,
  );
  if (!expected) fail('UNBOUND_OR_CHANGED_INPUT', index.agreement_index_id ?? null);
  verifyRawBoundObject(
    index,
    expected.agreement_index_binding,
    'CANONICAL_JSON_ONE_LF',
    `${expected.deal}:agreement-index`,
  );
  const agreementId = index.source_binding?.agreement_id;
  if (!expected
    || agreementId !== expected.agreement_id
    || index.agreement_index_id !== expected.agreement_index_id
    || index.root_node_occurrence_id !== expected.root_node_occurrence_id
    || index.source_binding?.deal !== expected.deal) {
    fail('UNBOUND_OR_CHANGED_INPUT', agreementId ?? null);
  }
  const canonicalText = index.source_binding?.canonical_text;
  if (typeof canonicalText !== 'string') fail('INDEX_SCHEMA_MISMATCH', 'canonical_text');
  const sourceBytes = Buffer.from(canonicalText, 'utf8');
  if (sourceBytes.length !== index.source_binding.canonical_text_byte_length
    || sha256Hex(sourceBytes) !== index.source_binding.canonical_text_sha256) {
    fail('SOURCE_BYTES_MISMATCH', 'canonical_text');
  }
  if (!Array.isArray(index.nodes)) fail('INDEX_SCHEMA_MISMATCH', 'nodes');
  const nodesById = new Map();
  for (const node of index.nodes) {
    if (!isPlainObject(node)
      || !HEX_256.test(node.node_occurrence_id || '')
      || nodesById.has(node.node_occurrence_id)
      || !Array.isArray(node.child_node_occurrence_ids)) {
      fail('INDEX_SCHEMA_MISMATCH', 'node identity');
    }
    validateSourceSpan(node.extent_span, sourceBytes, node.node_occurrence_id);
    nodesById.set(node.node_occurrence_id, node);
  }
  const root = nodesById.get(index.root_node_occurrence_id);
  if (!root || root.parent_node_occurrence_id !== null || root.node_kind !== 'AGREEMENT') {
    fail('INDEX_SCHEMA_MISMATCH', 'root');
  }
  for (const node of index.nodes) {
    if (node.parent_node_occurrence_id !== null && !nodesById.has(node.parent_node_occurrence_id)) {
      fail('INDEX_SCHEMA_MISMATCH', `parent ${node.node_occurrence_id}`);
    }
    for (const childId of node.child_node_occurrence_ids) {
      if (nodesById.get(childId)?.parent_node_occurrence_id !== node.node_occurrence_id) {
        fail('INDEX_SCHEMA_MISMATCH', `child ${childId}`);
      }
    }
  }
  return {
    agreementId,
    expected,
    sourceBytes,
    nodesById,
    depths: buildDepths(nodesById, index.root_node_occurrence_id),
  };
}

function validateContext(task, indexState) {
  const context = task.context_compilation;
  const expectedBinding = indexState.expected.context_compilation_binding;
  if (!sameValue(task.context_compilation_binding, expectedBinding)) {
    fail('CONTEXT_BINDING_MISMATCH', task.context_compilation_binding);
  }
  verifyRawBoundObject(
    context,
    expectedBinding,
    'CANONICAL_JSON_ONE_LF',
    `${indexState.expected.deal}:context-compilation`,
  );
  if (!isPlainObject(context)
    || context.schema_version !== CONTEXT_COMPILATION_SCHEMA
    || context.context_compilation_id !== indexState.expected.context_compilation_id
    || context.agreement_index_binding?.agreement_index_id !== indexState.expected.agreement_index_id
    || context.agreement_index_binding?.canonical_text_sha256
      !== sha256Hex(indexState.sourceBytes)) {
    fail('CONTEXT_COMPILATION_MISMATCH', context?.context_compilation_id ?? null);
  }
  for (const member of [
    'context_facts',
    'scope_edges',
    'reference_edges',
    'definition_edges',
    'semantic_relationships',
  ]) {
    if (!Array.isArray(context[member])) fail('CONTEXT_COMPILATION_MISMATCH', member);
  }
  return context;
}

function validateTask(task, policy, policyBinding, indexState) {
  assertExactMembers(task, TASK_MEMBERS, 'analysisTask');
  if (task.schema_version !== ANALYSIS_TASK_SCHEMA) {
    fail('TASK_SCHEMA_MISMATCH', task.schema_version);
  }
  if (!sameValue(task.analysis_policy, policy)
    || !sameValue(task.analysis_policy_binding, policyBinding)) {
    fail('POLICY_BINDING_MISMATCH', 'analysisTask');
  }
  const expectedScope = {
    scope_kind: 'AGREEMENT',
    agreement_id: indexState.agreementId,
    root_node_occurrence_id: indexState.expected.root_node_occurrence_id,
  };
  if (!sameValue(task.requested_scope, expectedScope)) {
    fail('REQUESTED_SCOPE_MISMATCH', task.requested_scope);
  }
  if (!sameValue(task.execution, EXECUTION_CONTRACT)) {
    fail('EXECUTION_CONTRACT_MISMATCH', task.execution);
  }
  assertHex(task.analysis_task_id, 'analysis_task_id');

  const expectedRunIds = indexState.expected.run_identifiers;
  if (!Array.isArray(task.legacy_resolution_runs)
    || task.legacy_resolution_runs.length !== expectedRunIds.length) {
    fail('LEGACY_RUN_SET_MISMATCH', task.legacy_resolution_runs?.length ?? null);
  }
  const policyRuns = new Map(
    policy.input_contract.legacy_run_bindings
      .filter((run) => run.agreement_id === indexState.agreementId)
      .map((run) => [run.run_identifier, run]),
  );
  task.legacy_resolution_runs.forEach((run, ordinal) => {
    assertExactMembers(run, LEGACY_RUN_MEMBERS, `legacy run ${ordinal}`);
    const expected = policyRuns.get(run.run_identifier);
    if (!expected
      || run.run_identifier !== expectedRunIds[ordinal]
      || run.family !== expected.family
      || !sameValue(run.resolution_binding, expected.resolution_binding)
      || !sameValue(run.adapter_result_binding, expected.adapter_result_binding)
      || !sameValue(run.validation_binding, expected.validation_binding)) {
      fail('LEGACY_RUN_SET_MISMATCH', run.run_identifier);
    }
    verifyRawBoundObject(
      run.resolution,
      run.resolution_binding,
      'PRETTY_JSON_NO_LF',
      `${run.run_identifier}:resolution`,
    );
    verifyRawBoundObject(
      run.adapter_result,
      run.adapter_result_binding,
      'PRETTY_JSON_NO_LF',
      `${run.run_identifier}:adapter-result`,
    );
    verifyRawBoundObject(
      run.validation,
      run.validation_binding,
      'PRETTY_JSON_NO_LF',
      `${run.run_identifier}:validation`,
    );
  });
  const legacyResolutionBindings = task.legacy_resolution_runs.map((run) => ({
    run_identifier: run.run_identifier,
    family: run.family,
    resolution_binding: run.resolution_binding,
    adapter_result_binding: run.adapter_result_binding,
    validation_binding: run.validation_binding,
  }));
  const taskIdentityPayload = {
    requested_scope: task.requested_scope,
    analysis_policy_binding: task.analysis_policy_binding,
    context_compilation_binding: task.context_compilation_binding,
    legacy_resolution_bindings: legacyResolutionBindings,
    execution: task.execution,
  };
  if (contentId(ANALYSIS_TASK_SCHEMA, taskIdentityPayload) !== task.analysis_task_id) {
    fail('TASK_ID_MISMATCH', task.analysis_task_id);
  }
}

function selectSourceNode(sourceSpan, indexState) {
  const candidates = [];
  for (const node of indexState.nodesById.values()) {
    if (node.extent_span.start_byte <= sourceSpan.start_byte
      && node.extent_span.end_byte >= sourceSpan.end_byte) {
      candidates.push(node);
    }
  }
  if (candidates.length === 0) fail('EVIDENCE_SPAN_NOT_CONSTRUCTIBLE', sourceSpan);
  candidates.sort((left, right) => {
    const leftLength = left.extent_span.end_byte - left.extent_span.start_byte;
    const rightLength = right.extent_span.end_byte - right.extent_span.start_byte;
    return leftLength - rightLength
      || indexState.depths.get(right.node_occurrence_id) - indexState.depths.get(left.node_occurrence_id)
      || (NODE_KIND_RANK.get(left.node_kind) ?? 99) - (NODE_KIND_RANK.get(right.node_kind) ?? 99)
      || left.node_occurrence_id.localeCompare(right.node_occurrence_id);
  });
  return candidates[0];
}

function semanticClaimPayload(claim) {
  const value = clone(claim);
  delete value.claim_revision_id;
  delete value.evidence_ids;
  delete value.evidence;
  return value;
}

function claimsByOccurrence(writeSet) {
  const claims = writeSet?.claims;
  if (!Array.isArray(claims)) fail('LEGACY_RUN_SCHEMA_MISMATCH', 'claims');
  const result = new Map();
  for (const claim of claims) {
    if (result.has(claim.claim_occurrence_id)) {
      fail('LEGACY_CLAIM_IDENTITY_CHANGE', claim.claim_occurrence_id);
    }
    result.set(claim.claim_occurrence_id, claim);
  }
  return result;
}

function evidenceByOrdinal(claim) {
  if (!Array.isArray(claim?.evidence)) fail('EVIDENCE_SPAN_NOT_CONSTRUCTIBLE', 'claim evidence');
  const result = new Map();
  for (const evidence of claim.evidence) {
    const key = `${evidence.ordinal}:${evidence.evidence_role}`;
    if (result.has(key)) fail('EVIDENCE_SPAN_NOT_CONSTRUCTIBLE', key);
    result.set(key, evidence);
  }
  return result;
}

function stageEvidenceIds(resolutionEvidence, writeEvidence, validationEvidence) {
  return {
    proposal_claim_evidence_id: null,
    resolution_claim_evidence_id: resolutionEvidence.claim_evidence_id,
    write_set_claim_evidence_id: writeEvidence?.claim_evidence_id ?? null,
    validation_claim_evidence_id: validationEvidence?.claim_evidence_id ?? null,
  };
}

function makeEvidenceEdge({
  analysisClaimId,
  evidenceRole,
  ordinal,
  stageIds,
  sourceNodeId,
  sourceSpan,
  spanProvenance,
}) {
  const identityPayload = {
    analysis_claim_id: analysisClaimId,
    stage_evidence_ids: stageIds,
    evidence_role: evidenceRole,
    ordinal,
    source_node_occurrence_id: sourceNodeId,
    source_span: sourceSpan,
  };
  return {
    schema_version: ANALYSIS_EVIDENCE_SCHEMA,
    analysis_evidence_edge_id: contentId(ANALYSIS_EVIDENCE_SCHEMA, identityPayload),
    analysis_claim_id: analysisClaimId,
    evidence_role: evidenceRole,
    ordinal,
    stage_evidence_ids: stageIds,
    source_node_occurrence_id: sourceNodeId,
    source_span: sourceSpan,
    span_provenance: spanProvenance,
    source_bytes_match: true,
  };
}

function buildLegacyRecords(task, indexState, policy) {
  const claims = [];
  const evidenceEdges = [];
  const claimEvidence = new Map();
  const legacyByResolutionRevision = new Map();
  const supplementalByResolutionId = new Map(
    policy.identity_contract.supplemental_claims
      .filter((record) => record.agreement_id === indexState.agreementId)
      .map((record) => [record.resolution_claim_revision_id, record]),
  );

  for (const run of task.legacy_resolution_runs) {
    const resolved = run.resolution?.resolved;
    if (!Array.isArray(resolved)) fail('LEGACY_RUN_SCHEMA_MISMATCH', `${run.run_identifier}:resolved`);
    const writeClaims = claimsByOccurrence(run.adapter_result?.write_set);
    const validationClaims = claimsByOccurrence(run.validation?.publishableWriteSet);
    const expectedRun = policy.input_contract.legacy_run_bindings.find(
      (candidate) => candidate.run_identifier === run.run_identifier,
    );
    if (resolved.length !== expectedRun.expected_counts.resolution_claims
      || writeClaims.size !== expectedRun.expected_counts.write_set_claims
      || validationClaims.size !== expectedRun.expected_counts.validation_claims) {
      fail('LEGACY_RUN_SET_MISMATCH', `${run.run_identifier}:counts`);
    }

    for (const resolvedRecord of resolved) {
      const resolutionClaim = resolvedRecord.claim;
      if (!isPlainObject(resolutionClaim)
        || resolutionClaim.schema_version !== 'CLAIM_REVISION/V1'
        || !HEX_256.test(resolutionClaim.claim_revision_id || '')
        || !HEX_256.test(resolutionClaim.claim_occurrence_id || '')) {
        fail('LEGACY_CLAIM_IDENTITY_CHANGE', run.run_identifier);
      }
      if (legacyByResolutionRevision.has(resolutionClaim.claim_revision_id)) {
        fail('LEGACY_CLAIM_IDENTITY_CHANGE', resolutionClaim.claim_revision_id);
      }
      const writeClaim = writeClaims.get(resolutionClaim.claim_occurrence_id) ?? null;
      const validationClaim = validationClaims.get(resolutionClaim.claim_occurrence_id) ?? null;
      const supplemental = supplementalByResolutionId.get(resolutionClaim.claim_revision_id) ?? null;
      if (writeClaim) {
        if (!validationClaim
          || writeClaim.claim_revision_id === resolutionClaim.claim_revision_id
          || validationClaim.claim_revision_id !== writeClaim.claim_revision_id
          || !sameValue(semanticClaimPayload(resolutionClaim), semanticClaimPayload(writeClaim))
          || !sameValue(writeClaim, validationClaim)) {
          fail('LEGACY_CLAIM_IDENTITY_CHANGE', resolutionClaim.claim_revision_id);
        }
      } else if (!supplemental
        || validationClaim
        || supplemental.run_identifier !== run.run_identifier
        || supplemental.section_reference !== resolvedRecord.section_reference
        || supplemental.claim_definition_key !== resolutionClaim.claim_definition_key
        || supplemental.claim_occurrence_id !== resolutionClaim.claim_occurrence_id) {
        fail('LEGACY_CLAIM_IDENTITY_CHANGE', resolutionClaim.claim_revision_id);
      }

      const identityState = 'PRESERVED';
      const analysisClaimId = contentId(ANALYSIS_CLAIM_SCHEMA, {
        agreement_id: indexState.agreementId,
        identity_state: identityState,
        resolution_claim_revision_id: resolutionClaim.claim_revision_id,
      });
      const stageIds = writeClaim
        ? {
          proposal_claim_revision_id: null,
          proposal_identity_state: policy.identity_contract.proposal_identity_state,
          proposal_identity_reason: policy.identity_contract.ordinary_proposal_reason,
          resolution_claim_revision_id: resolutionClaim.claim_revision_id,
          write_set_claim_revision_id: writeClaim.claim_revision_id,
          validation_claim_revision_id: validationClaim.claim_revision_id,
          stage_identity_disposition: 'EVIDENCE_COORDINATE_REBASE_ONLY',
          rebasing_provenance: clone(policy.evidence_rebasing_contract.adapter_present_rebasing_provenance),
        }
        : {
          proposal_claim_revision_id: null,
          proposal_identity_state: policy.identity_contract.proposal_identity_state,
          proposal_identity_reason: policy.identity_contract.supplemental_proposal_reason,
          resolution_claim_revision_id: resolutionClaim.claim_revision_id,
          write_set_claim_revision_id: null,
          validation_claim_revision_id: null,
          stage_identity_disposition: 'SUPPLEMENTAL_RESOLUTION_ONLY',
          rebasing_provenance: clone(policy.evidence_rebasing_contract.supplemental_rebasing_provenance),
        };

      const writeEvidence = writeClaim ? evidenceByOrdinal(writeClaim) : new Map();
      const validationEvidence = validationClaim ? evidenceByOrdinal(validationClaim) : new Map();
      const claimEdges = [];
      for (const resolutionEvidence of [...resolutionClaim.evidence].sort(
        (left, right) => left.ordinal - right.ordinal || left.claim_evidence_id.localeCompare(right.claim_evidence_id),
      )) {
        const provisionStart = resolvedRecord.provision_instance?.absolute_start;
        const startByte = provisionStart + resolutionEvidence.absolute_start;
        const endByte = provisionStart + resolutionEvidence.absolute_end;
        const sourceSpan = span(startByte, endByte, indexState.sourceBytes);
        const key = `${resolutionEvidence.ordinal}:${resolutionEvidence.evidence_role}`;
        const matchingWrite = writeEvidence.get(key) ?? null;
        const matchingValidation = validationEvidence.get(key) ?? null;
        if (writeClaim && (!matchingWrite
          || !matchingValidation
          || matchingWrite.absolute_start !== startByte
          || matchingWrite.absolute_end !== endByte
          || !sameValue(matchingWrite, matchingValidation))) {
          fail('EVIDENCE_SPAN_NOT_CONSTRUCTIBLE', `${resolutionClaim.claim_revision_id}:${key}`);
        }
        const ownerNode = selectSourceNode(sourceSpan, indexState);
        const edge = makeEvidenceEdge({
          analysisClaimId,
          evidenceRole: resolutionEvidence.evidence_role,
          ordinal: resolutionEvidence.ordinal,
          stageIds: stageEvidenceIds(resolutionEvidence, matchingWrite, matchingValidation),
          sourceNodeId: ownerNode.node_occurrence_id,
          sourceSpan,
          spanProvenance: {
            mode: writeClaim
              ? 'RESOLUTION_PROVISION_RELATIVE_TO_CANONICAL_WRITE_SET'
              : 'RESOLUTION_ONLY_SUPPLEMENTAL',
            provision_instance_id: resolvedRecord.provision_instance?.provision_instance_id ?? null,
            provision_absolute_start: provisionStart,
            resolution_relative_start: resolutionEvidence.absolute_start,
            resolution_relative_end: resolutionEvidence.absolute_end,
          },
        });
        evidenceEdges.push(edge);
        claimEdges.push(edge);
      }

      const legacyParty = clone(resolvedRecord.party ?? resolvedRecord.provision_instance?.party ?? null);
      const claimRecord = {
        schema_version: ANALYSIS_CLAIM_SCHEMA,
        analysis_claim_id: analysisClaimId,
        agreement_id: indexState.agreementId,
        deal: indexState.expected.deal,
        family: run.family,
        source_run_identifier: run.run_identifier,
        section_reference: resolvedRecord.section_reference,
        claim_definition_key: resolutionClaim.claim_definition_key,
        claim_definition_version: resolutionClaim.claim_definition_version,
        claim_occurrence_id: resolutionClaim.claim_occurrence_id,
        complete_proposition_claim_revision_id: null,
        stage_claim_revision_ids: stageIds,
        identity_state: identityState,
        legacy_resolution_state: resolutionClaim.state,
        proposition_validation_state: 'SCHEMA_APPROVAL_PENDING',
        required_role_schema_id: null,
        projection_eligibility: 'BLOCKED',
        projection_block_reason: 'SCHEMA_APPROVAL_PENDING',
        legacy_claim_revision: clone(resolutionClaim),
        legacy_party: legacyParty,
        legacy_capacity: legacyParty?.capacity ?? null,
        complete_proposition: null,
        source_node_occurrence_ids: sortedUnique(claimEdges.map((edge) => edge.source_node_occurrence_id)),
        evidence_edge_ids: claimEdges.map((edge) => edge.analysis_evidence_edge_id),
        role_ids: [],
        dependency_edge_ids: [],
        diagnostic_codes: [],
      };
      claims.push(claimRecord);
      claimEvidence.set(analysisClaimId, claimEdges);
      legacyByResolutionRevision.set(resolutionClaim.claim_revision_id, claimRecord);
    }
  }

  if (claims.length !== indexState.expected.expected_counts.legacy_claims
    || evidenceEdges.length !== indexState.expected.expected_counts.legacy_evidence) {
    fail('LEGACY_RUN_SET_MISMATCH', {
      claims: claims.length,
      evidence: evidenceEdges.length,
    });
  }
  return { claims, evidenceEdges, claimEvidence, legacyByResolutionRevision };
}

function contextRecordIndex(context, indexState) {
  const byKind = {
    CONTEXT_FACT: new Map(),
    SCOPE_EDGE: new Map(),
    REFERENCE_EDGE: new Map(),
    DEFINITION_EDGE: new Map(),
    SEMANTIC_RELATIONSHIP: new Map(),
  };
  const flat = [];
  function add(kind, id, record, nodeIds, spans) {
    const normalisedSpans = spans.map((sourceSpan) => validateSourceSpan(sourceSpan, indexState.sourceBytes, id));
    const descriptor = {
      kind,
      id,
      state: record.state ?? 'RESOLVED',
      nodeIds: sortedUnique(nodeIds.filter(Boolean)),
      spans: normalisedSpans,
      record,
    };
    byKind[kind].set(id, descriptor);
    flat.push(descriptor);
  }
  for (const record of context.context_facts) {
    add('CONTEXT_FACT', record.context_fact_id, record,
      [record.source_node_occurrence_id], [record.source_span]);
  }
  for (const record of context.scope_edges) {
    add('SCOPE_EDGE', record.scope_edge_id, record,
      [record.source_node_occurrence_id], [record.governing_source_span]);
  }
  for (const record of context.reference_edges) {
    add('REFERENCE_EDGE', record.reference_edge_id, record,
      [record.owner_node_occurrence_id], [record.source_span]);
  }
  for (const record of context.definition_edges) {
    add('DEFINITION_EDGE', record.definition_edge_id, record,
      [record.owner_node_occurrence_id], [record.source_span]);
  }
  for (const record of context.semantic_relationships) {
    add('SEMANTIC_RELATIONSHIP', record.semantic_relationship_id, record,
      record.source_node_occurrence_ids, record.source_spans);
  }
  return { byKind, flat };
}

function makeDependencyEdge({
  analysisClaimId,
  roleId,
  kind,
  use,
  descriptor,
  blocking,
  reasonCode,
}) {
  const unsigned = {
    schema_version: DEPENDENCY_EDGE_SCHEMA,
    analysis_claim_id: analysisClaimId,
    role_id: roleId,
    dependency_kind: kind,
    dependency_use: use,
    target_id: descriptor.id,
    target_state: descriptor.state,
    source_node_occurrence_ids: clone(descriptor.nodeIds),
    source_spans: clone(descriptor.spans),
    blocking,
    reason_code: reasonCode,
  };
  return recordWithId(DEPENDENCY_EDGE_SCHEMA, 'dependency_edge_id', unsigned);
}

function makeValidation({
  analysisClaimId,
  scenario,
  removedRoleKey,
  requiredRoleSchemaId,
  requiredRoleStates,
  propositionState,
  missing,
  unresolved,
  renderable,
  eligible,
}) {
  const unsigned = {
    schema_version: VALIDATION_RESULT_SCHEMA,
    analysis_claim_id: analysisClaimId,
    scenario,
    removed_role_key: removedRoleKey,
    required_role_schema_id: requiredRoleSchemaId,
    required_role_states: requiredRoleStates,
    proposition_validation_state: propositionState,
    missing_role_keys: missing,
    unresolved_role_keys: unresolved,
    renderable,
    projection_eligible: eligible,
  };
  return recordWithId(VALIDATION_RESULT_SCHEMA, 'validation_result_id', unsigned);
}

function buildGoldenRecords(indexState, policy, contextIndex, legacyByResolutionRevision) {
  if (indexState.agreementId !== METSERA_AGREEMENT_ID) {
    return {
      claims: [], evidenceEdges: [], roles: [], provenance: [], dependencies: [], validations: [], claimEvidence: new Map(),
    };
  }
  const fixture = policy.metsera_7_04_fixture;
  const roleSchema = policy.required_role_schemas[0];
  validateSourceSpan(fixture.section_span, indexState.sourceBytes, fixture.fixture_id);
  const nodeById = indexState.nodesById;
  if (!nodeById.has(fixture.section_node_occurrence_id)) {
    fail('METSERA_REQUIRED_ROLE_MISSING_OR_AMBIGUOUS', 'section node');
  }

  const claims = [];
  const evidenceEdges = [];
  const roles = [];
  const provenance = [];
  const dependencies = [];
  const validations = [];
  const claimEvidence = new Map();

  for (const branch of fixture.branches) {
    validateSourceSpan(branch.sentence_span, indexState.sourceBytes, branch.sentence_node_occurrence_id);
    validateSourceSpan(branch.qualification_span, indexState.sourceBytes, branch.qualification_node_occurrence_id);
    if (!nodeById.has(branch.sentence_node_occurrence_id)
      || !nodeById.has(branch.qualification_node_occurrence_id)) {
      fail('METSERA_REQUIRED_ROLE_MISSING_OR_AMBIGUOUS', branch.branch_key);
    }
    const orderedRoleSemanticPayloads = [...branch.roles]
      .sort((left, right) => left.ordinal - right.ordinal)
      .map((role) => ({
        role_key: role.role_key,
        role_type: role.role_type,
        normalised_value: clone(role.normalised_value),
      }));
    const claimOccurrenceId = contentId('COMPLETE_PROPOSITION_CLAIM_OCCURRENCE/V1', {
      agreement_id: indexState.agreementId,
      claim_definition_key: fixture.claim_definition_key,
      section_node_occurrence_id: fixture.section_node_occurrence_id,
      sentence_node_occurrence_id: branch.sentence_node_occurrence_id,
      branch_ordinal: branch.branch_ordinal,
    });
    const completeRevisionId = contentId('COMPLETE_PROPOSITION_CLAIM_REVISION/V1', {
      claim_occurrence_id: claimOccurrenceId,
      claim_definition_key: fixture.claim_definition_key,
      claim_definition_version: fixture.claim_definition_version,
      branch_ordinal: branch.branch_ordinal,
      ordered_role_semantic_payloads: orderedRoleSemanticPayloads,
    });
    const identityState = 'NEW_GOLDEN_PROPOSITION';
    const analysisClaimId = contentId(ANALYSIS_CLAIM_SCHEMA, {
      agreement_id: indexState.agreementId,
      identity_state: identityState,
      claim_occurrence_id: claimOccurrenceId,
      complete_proposition_claim_revision_id: completeRevisionId,
    });
    const goldenStageIds = {
      proposal_claim_revision_id: null,
      proposal_identity_state: null,
      proposal_identity_reason: null,
      resolution_claim_revision_id: null,
      write_set_claim_revision_id: null,
      validation_claim_revision_id: null,
      stage_identity_disposition: 'NO_LEGACY_COUNTERPART',
      rebasing_provenance: clone(policy.evidence_rebasing_contract.new_golden_rebasing_provenance),
    };
    const goldenEvidence = makeEvidenceEdge({
      analysisClaimId,
      evidenceRole: 'COMPLETE_PROPOSITION',
      ordinal: 0,
      stageIds: {
        proposal_claim_evidence_id: null,
        resolution_claim_evidence_id: null,
        write_set_claim_evidence_id: null,
        validation_claim_evidence_id: null,
      },
      sourceNodeId: branch.sentence_node_occurrence_id,
      sourceSpan: clone(branch.sentence_span),
      spanProvenance: { mode: 'NO_LEGACY_COUNTERPART' },
    });
    evidenceEdges.push(goldenEvidence);
    claimEvidence.set(analysisClaimId, [goldenEvidence]);

    const branchRoles = [];
    for (const fixtureRole of [...branch.roles].sort((left, right) => left.ordinal - right.ordinal)) {
      const sourceSpans = fixtureRole.source_spans.map((sourceSpan) => (
        validateSourceSpan(sourceSpan, indexState.sourceBytes, `${branch.branch_key}:${fixtureRole.role_key}`)
      ));
      const roleId = contentId(ANALYSIS_ROLE_SCHEMA, {
        analysis_claim_id: analysisClaimId,
        required_role_schema_id: fixture.required_role_schema_id,
        role_key: fixtureRole.role_key,
        role_type: fixtureRole.role_type,
        ordinal: fixtureRole.ordinal,
        normalised_value: fixtureRole.normalised_value,
        source_spans: sourceSpans,
      });
      const roleDependencies = [];
      const requiredTargets = [
        ...fixtureRole.required_context_fact_ids.map((id) => ['CONTEXT_FACT', id]),
        ...fixtureRole.required_scope_edge_ids.map((id) => ['SCOPE_EDGE', id]),
        ...fixtureRole.required_reference_edge_ids.map((id) => ['REFERENCE_EDGE', id]),
      ];
      for (const [kind, id] of requiredTargets) {
        const descriptor = contextIndex.byKind[kind].get(id);
        if (!descriptor || ['AMBIGUOUS', 'UNRESOLVED'].includes(descriptor.state)) {
          fail('METSERA_REQUIRED_ROLE_MISSING_OR_AMBIGUOUS', `${branch.branch_key}:${fixtureRole.role_key}:${id}`);
        }
        const dependency = makeDependencyEdge({
          analysisClaimId,
          roleId,
          kind,
          use: 'REQUIRED_ROLE',
          descriptor,
          blocking: true,
          reasonCode: 'REQUIRED_BY_SETTLED_ROLE_SCHEMA',
        });
        dependencies.push(dependency);
        roleDependencies.push(dependency);
      }
      const provenanceUnsigned = {
        schema_version: ROLE_PROVENANCE_SCHEMA,
        role_id: roleId,
        provenance_kind: fixtureRole.provenance_kind,
        source_node_occurrence_id: fixtureRole.source_node_occurrence_id,
        source_spans: sourceSpans,
        context_fact_ids: clone(fixtureRole.required_context_fact_ids),
        scope_edge_ids: clone(fixtureRole.required_scope_edge_ids),
        reference_edge_ids: clone(fixtureRole.required_reference_edge_ids),
        definition_edge_ids: [],
        semantic_relationship_ids: [],
        derivation_rule_id: fixture.fixture_id,
        derivation_rule_version: 1,
      };
      const provenanceRecord = recordWithId(
        ROLE_PROVENANCE_SCHEMA,
        'role_provenance_id',
        provenanceUnsigned,
      );
      provenance.push(provenanceRecord);
      const roleRecord = {
        schema_version: ANALYSIS_ROLE_SCHEMA,
        role_id: roleId,
        analysis_claim_id: analysisClaimId,
        required_role_schema_id: fixture.required_role_schema_id,
        role_key: fixtureRole.role_key,
        role_type: fixtureRole.role_type,
        ordinal: fixtureRole.ordinal,
        cardinality_state: 'EXACTLY_ONE_ROLE_RECORD',
        normalised_value: clone(fixtureRole.normalised_value),
        provenance_ids: [provenanceRecord.role_provenance_id],
        dependency_edge_ids: roleDependencies.map((edge) => edge.dependency_edge_id),
        validation_state: 'SATISFIED',
      };
      roles.push(roleRecord);
      branchRoles.push(roleRecord);
    }

    for (const nodeId of branch.derived_from.source_node_occurrence_ids) {
      const node = nodeById.get(nodeId);
      if (!node) fail('METSERA_REQUIRED_ROLE_MISSING_OR_AMBIGUOUS', nodeId);
      dependencies.push(makeDependencyEdge({
        analysisClaimId,
        roleId: null,
        kind: 'SOURCE_NODE',
        use: 'DERIVED_FROM',
        descriptor: {
          id: nodeId,
          state: 'RESOLVED',
          nodeIds: [nodeId],
          spans: [clone(node.extent_span)],
        },
        blocking: true,
        reasonCode: 'SETTLED_BRANCH_SOURCE',
      }));
    }
    for (const revisionId of branch.derived_from.legacy_claim_revision_ids) {
      const legacyClaim = legacyByResolutionRevision.get(revisionId);
      if (!legacyClaim) fail('METSERA_REQUIRED_ROLE_MISSING_OR_AMBIGUOUS', revisionId);
      dependencies.push(makeDependencyEdge({
        analysisClaimId,
        roleId: null,
        kind: 'LEGACY_CLAIM_REVISION',
        use: 'DERIVED_FROM',
        descriptor: {
          id: revisionId,
          state: legacyClaim.legacy_resolution_state,
          nodeIds: clone(legacyClaim.source_node_occurrence_ids),
          spans: [],
        },
        blocking: true,
        reasonCode: 'SETTLED_FRAGMENT_DERIVATION',
      }));
    }
    for (const definitionId of branch.related_non_blocking_definition_edge_ids) {
      const descriptor = contextIndex.byKind.DEFINITION_EDGE.get(definitionId);
      if (!descriptor) fail('METSERA_REQUIRED_ROLE_MISSING_OR_AMBIGUOUS', definitionId);
      dependencies.push(makeDependencyEdge({
        analysisClaimId,
        roleId: null,
        kind: 'DEFINITION_EDGE',
        use: 'RELATED_NON_BLOCKING',
        descriptor,
        blocking: false,
        reasonCode: 'RELATED_AMBIGUOUS_DEFINITION_USE',
      }));
    }

    const requiredRoleStates = branchRoles.map((role) => ({
      role_key: role.role_key,
      validation_state: role.validation_state,
    }));
    validations.push(makeValidation({
      analysisClaimId,
      scenario: 'BASELINE',
      removedRoleKey: null,
      requiredRoleSchemaId: fixture.required_role_schema_id,
      requiredRoleStates,
      propositionState: 'COMPLETE',
      missing: [],
      unresolved: [],
      renderable: true,
      eligible: true,
    }));
    for (const removedRole of branchRoles) {
      validations.push(makeValidation({
        analysisClaimId,
        scenario: 'ROLE_DELETION',
        removedRoleKey: removedRole.role_key,
        requiredRoleSchemaId: fixture.required_role_schema_id,
        requiredRoleStates: branchRoles.map((role) => ({
          role_key: role.role_key,
          validation_state: role.role_id === removedRole.role_id ? 'MISSING' : 'SATISFIED',
        })),
        propositionState: 'MISSING_REQUIRED_ROLE',
        missing: [removedRole.role_key],
        unresolved: [],
        renderable: false,
        eligible: false,
      }));
    }

    const claimRecord = {
      schema_version: ANALYSIS_CLAIM_SCHEMA,
      analysis_claim_id: analysisClaimId,
      agreement_id: indexState.agreementId,
      deal: indexState.expected.deal,
      family: roleSchema.family,
      source_run_identifier: null,
      section_reference: '7.04',
      claim_definition_key: fixture.claim_definition_key,
      claim_definition_version: fixture.claim_definition_version,
      claim_occurrence_id: claimOccurrenceId,
      complete_proposition_claim_revision_id: completeRevisionId,
      stage_claim_revision_ids: goldenStageIds,
      identity_state: identityState,
      legacy_resolution_state: 'NO_LEGACY_COUNTERPART',
      proposition_validation_state: 'COMPLETE',
      required_role_schema_id: fixture.required_role_schema_id,
      projection_eligibility: 'ELIGIBLE',
      projection_block_reason: null,
      legacy_claim_revision: null,
      legacy_party: null,
      legacy_capacity: null,
      complete_proposition: {
        branch_key: branch.branch_key,
        branch_ordinal: branch.branch_ordinal,
        ordered_role_semantic_payloads: orderedRoleSemanticPayloads,
      },
      source_node_occurrence_ids: clone(branch.derived_from.source_node_occurrence_ids),
      evidence_edge_ids: [goldenEvidence.analysis_evidence_edge_id],
      role_ids: branchRoles.map((role) => role.role_id),
      dependency_edge_ids: [],
      diagnostic_codes: [],
    };
    claims.push(claimRecord);
  }
  return { claims, evidenceEdges, roles, provenance, dependencies, validations, claimEvidence };
}

function descriptorContainedByEvidence(descriptor, evidenceEdges) {
  if (descriptor.spans.length === 0) return false;
  return evidenceEdges.some((edge) => descriptor.spans.every((sourceSpan) => (
    sourceSpan.start_byte >= edge.source_span.start_byte
    && sourceSpan.end_byte <= edge.source_span.end_byte
  )));
}

function addGenericDependencies(claims, claimEvidence, contextIndex, existingDependencies) {
  const dependencies = [...existingDependencies];
  const keys = new Set(dependencies.map((edge) => canonicalJson([
    edge.analysis_claim_id,
    edge.role_id,
    edge.dependency_kind,
    edge.dependency_use,
    edge.target_id,
  ])));
  for (const claim of claims) {
    const evidence = claimEvidence.get(claim.analysis_claim_id) ?? [];
    for (const descriptor of contextIndex.flat) {
      if (!descriptorContainedByEvidence(descriptor, evidence)) continue;
      const key = canonicalJson([
        claim.analysis_claim_id,
        null,
        descriptor.kind,
        'RELATED_NON_BLOCKING',
        descriptor.id,
      ]);
      if (keys.has(key)) continue;
      keys.add(key);
      dependencies.push(makeDependencyEdge({
        analysisClaimId: claim.analysis_claim_id,
        roleId: null,
        kind: descriptor.kind,
        use: 'RELATED_NON_BLOCKING',
        descriptor,
        blocking: false,
        reasonCode: 'M3_SOURCE_FULLY_CONTAINED_BY_ANALYSIS_EVIDENCE',
      }));
    }
  }
  return dependencies;
}

function orderRecords(records, evidenceEdges, policy) {
  const evidenceById = new Map(evidenceEdges.map((edge) => [edge.analysis_evidence_edge_id, edge]));
  const familyOrder = new Map(Object.keys(policy.diff_contract.open_world.by_family)
    .map((family, ordinal) => [family, ordinal]));
  function claimMinimum(claim) {
    const spans = claim.evidence_edge_ids.map((id) => evidenceById.get(id)?.source_span).filter(Boolean);
    return {
      start: Math.min(...spans.map((sourceSpan) => sourceSpan.start_byte)),
      end: Math.min(...spans.map((sourceSpan) => sourceSpan.end_byte)),
    };
  }
  records.claims.sort((left, right) => {
    const leftMin = claimMinimum(left);
    const rightMin = claimMinimum(right);
    return leftMin.start - rightMin.start
      || leftMin.end - rightMin.end
      || (familyOrder.get(left.family) ?? 999) - (familyOrder.get(right.family) ?? 999)
      || left.claim_definition_key.localeCompare(right.claim_definition_key)
      || left.claim_definition_version - right.claim_definition_version
      || left.analysis_claim_id.localeCompare(right.analysis_claim_id);
  });
  const claimOrder = new Map(records.claims.map((claim, ordinal) => [claim.analysis_claim_id, ordinal]));
  records.evidenceEdges.sort((left, right) => (
    claimOrder.get(left.analysis_claim_id) - claimOrder.get(right.analysis_claim_id)
    || left.ordinal - right.ordinal
    || left.analysis_evidence_edge_id.localeCompare(right.analysis_evidence_edge_id)
  ));
  records.roles.sort((left, right) => (
    claimOrder.get(left.analysis_claim_id) - claimOrder.get(right.analysis_claim_id)
    || left.ordinal - right.ordinal
    || left.role_id.localeCompare(right.role_id)
  ));
  const roleOrder = new Map(records.roles.map((role, ordinal) => [role.role_id, ordinal]));
  records.provenance.sort((left, right) => (
    roleOrder.get(left.role_id) - roleOrder.get(right.role_id)
    || left.role_provenance_id.localeCompare(right.role_provenance_id)
  ));
  records.dependencies.sort((left, right) => {
    const leftStart = left.source_spans[0]?.start_byte ?? Number.MAX_SAFE_INTEGER;
    const rightStart = right.source_spans[0]?.start_byte ?? Number.MAX_SAFE_INTEGER;
    const leftRole = left.role_id === null ? Number.MAX_SAFE_INTEGER : roleOrder.get(left.role_id);
    const rightRole = right.role_id === null ? Number.MAX_SAFE_INTEGER : roleOrder.get(right.role_id);
    return claimOrder.get(left.analysis_claim_id) - claimOrder.get(right.analysis_claim_id)
      || leftRole - rightRole
      || (DEPENDENCY_KIND_RANK.get(left.dependency_kind) ?? 99)
        - (DEPENDENCY_KIND_RANK.get(right.dependency_kind) ?? 99)
      || leftStart - rightStart
      || left.target_id.localeCompare(right.target_id)
      || left.dependency_edge_id.localeCompare(right.dependency_edge_id);
  });
  const roleOrdinal = new Map(records.roles.map((role) => [role.role_key, role.ordinal]));
  records.validations.sort((left, right) => (
    claimOrder.get(left.analysis_claim_id) - claimOrder.get(right.analysis_claim_id)
    || (left.scenario === 'BASELINE' ? 0 : 1) - (right.scenario === 'BASELINE' ? 0 : 1)
    || (roleOrdinal.get(left.removed_role_key) ?? -1) - (roleOrdinal.get(right.removed_role_key) ?? -1)
    || left.validation_result_id.localeCompare(right.validation_result_id)
  ));

  const evidenceIdsByClaim = new Map();
  const roleIdsByClaim = new Map();
  const dependencyIdsByClaim = new Map();
  const dependencyIdsByRole = new Map();
  for (const edge of records.evidenceEdges) {
    if (!evidenceIdsByClaim.has(edge.analysis_claim_id)) evidenceIdsByClaim.set(edge.analysis_claim_id, []);
    evidenceIdsByClaim.get(edge.analysis_claim_id).push(edge.analysis_evidence_edge_id);
  }
  for (const role of records.roles) {
    if (!roleIdsByClaim.has(role.analysis_claim_id)) roleIdsByClaim.set(role.analysis_claim_id, []);
    roleIdsByClaim.get(role.analysis_claim_id).push(role.role_id);
  }
  for (const edge of records.dependencies) {
    if (!dependencyIdsByClaim.has(edge.analysis_claim_id)) dependencyIdsByClaim.set(edge.analysis_claim_id, []);
    dependencyIdsByClaim.get(edge.analysis_claim_id).push(edge.dependency_edge_id);
    if (edge.role_id !== null) {
      if (!dependencyIdsByRole.has(edge.role_id)) dependencyIdsByRole.set(edge.role_id, []);
      dependencyIdsByRole.get(edge.role_id).push(edge.dependency_edge_id);
    }
  }
  for (const claim of records.claims) {
    claim.evidence_edge_ids = evidenceIdsByClaim.get(claim.analysis_claim_id) ?? [];
    claim.role_ids = roleIdsByClaim.get(claim.analysis_claim_id) ?? [];
    claim.dependency_edge_ids = dependencyIdsByClaim.get(claim.analysis_claim_id) ?? [];
  }
  for (const role of records.roles) {
    role.dependency_edge_ids = dependencyIdsByRole.get(role.role_id) ?? [];
  }
}

function roundTripRecords(records) {
  const payload = {
    claims: records.claims,
    roles: records.roles,
    role_provenance: records.provenance,
    evidence_edges: records.evidenceEdges,
    dependency_edges: records.dependencies,
    proposition_validation_results: records.validations,
  };
  const serialised = canonicalJson(payload);
  const preDigest = sha256Hex(serialised);
  const reloaded = JSON.parse(serialised);
  const postDigest = sha256Hex(canonicalJson(reloaded));
  if (preDigest !== postDigest || !sameValue(payload, reloaded)) {
    fail('REPOSITORY_ROUND_TRIP_MISMATCH', { preDigest, postDigest });
  }
  const recordCounts = {
    claims: reloaded.claims.length,
    roles: reloaded.roles.length,
    role_provenance: reloaded.role_provenance.length,
    evidence_edges: reloaded.evidence_edges.length,
    dependency_edges: reloaded.dependency_edges.length,
    proposition_validation_results: reloaded.proposition_validation_results.length,
  };
  const unsignedProof = {
    schema_version: REPOSITORY_PROOF_SCHEMA,
    pre_round_trip_digest: preDigest,
    post_round_trip_digest: postDigest,
    record_counts: recordCounts,
    field_loss_count: 0,
    status: 'PASS',
  };
  return {
    reloaded,
    proof: recordWithId(REPOSITORY_PROOF_SCHEMA, 'repository_round_trip_proof_id', unsignedProof),
  };
}

function outputCounts(records, legacyResolutionRunCount) {
  const claimById = new Map(records.claims.map((claim) => [claim.analysis_claim_id, claim]));
  return {
    legacy_resolution_run_count: legacyResolutionRunCount,
    legacy_claim_count: records.claims.filter((claim) => claim.identity_state === 'PRESERVED').length,
    adapter_present_claim_count: records.claims.filter((claim) => (
      claim.identity_state === 'PRESERVED'
      && claim.stage_claim_revision_ids.write_set_claim_revision_id !== null
    )).length,
    supplemental_claim_count: records.claims.filter((claim) => (
      claim.identity_state === 'PRESERVED'
      && claim.stage_claim_revision_ids.stage_identity_disposition === 'SUPPLEMENTAL_RESOLUTION_ONLY'
    )).length,
    analysis_claim_count: records.claims.length,
    pending_claim_count: records.claims.filter(
      (claim) => claim.proposition_validation_state === 'SCHEMA_APPROVAL_PENDING',
    ).length,
    complete_claim_count: records.claims.filter(
      (claim) => claim.proposition_validation_state === 'COMPLETE',
    ).length,
    legacy_evidence_count: records.evidenceEdges.filter(
      (edge) => claimById.get(edge.analysis_claim_id)?.identity_state === 'PRESERVED',
    ).length,
    analysis_evidence_count: records.evidenceEdges.length,
    role_count: records.roles.length,
    role_provenance_count: records.provenance.length,
    dependency_edge_count: records.dependencies.length,
    baseline_validation_count: records.validations.filter((result) => result.scenario === 'BASELINE').length,
    role_deletion_validation_count: records.validations.filter(
      (result) => result.scenario === 'ROLE_DELETION',
    ).length,
    alias_count: 0,
    equivalence_count: 0,
    diagnostic_count: 0,
  };
}

function validateAgreementMetrics(records, indexState, legacyResolutionRunCount) {
  const expected = indexState.expected.expected_counts;
  const counts = outputCounts(records, legacyResolutionRunCount);
  if (counts.legacy_claim_count !== expected.legacy_claims
    || counts.adapter_present_claim_count !== expected.adapter_present_claims
    || counts.supplemental_claim_count !== expected.supplemental_claims
    || counts.analysis_claim_count !== expected.analysis_claims
    || counts.legacy_evidence_count !== expected.legacy_evidence
    || counts.analysis_evidence_count !== expected.analysis_evidence
    || counts.pending_claim_count !== expected.legacy_claims
    || counts.complete_claim_count !== (indexState.agreementId === METSERA_AGREEMENT_ID ? 2 : 0)
    || counts.role_count !== (indexState.agreementId === METSERA_AGREEMENT_ID ? 14 : 0)
    || counts.baseline_validation_count !== (indexState.agreementId === METSERA_AGREEMENT_ID ? 2 : 0)
    || counts.role_deletion_validation_count !== (indexState.agreementId === METSERA_AGREEMENT_ID ? 14 : 0)) {
    fail('EXPECTED_METRICS_MISMATCH', { expected, counts });
  }
  return counts;
}

function analyseAgreement(agreementIndex, analysisTask) {
  if (arguments.length !== 2) fail('INTERFACE_MISMATCH', arguments.length);
  const policyBinding = validatePolicy(
    analysisTask?.analysis_policy,
    analysisTask?.analysis_policy_binding,
  );
  const policy = analysisTask.analysis_policy;
  const indexState = validateIndex(agreementIndex, policy);
  validateTask(analysisTask, policy, policyBinding, indexState);
  const context = validateContext(analysisTask, indexState);
  const contextIndex = contextRecordIndex(context, indexState);

  const legacy = buildLegacyRecords(analysisTask, indexState, policy);
  const golden = buildGoldenRecords(
    indexState,
    policy,
    contextIndex,
    legacy.legacyByResolutionRevision,
  );
  const claims = [...legacy.claims, ...golden.claims];
  const evidenceEdges = [...legacy.evidenceEdges, ...golden.evidenceEdges];
  const claimEvidence = new Map([...legacy.claimEvidence, ...golden.claimEvidence]);
  const dependencies = addGenericDependencies(
    claims,
    claimEvidence,
    contextIndex,
    golden.dependencies,
  );
  const records = {
    claims,
    evidenceEdges,
    roles: golden.roles,
    provenance: golden.provenance,
    dependencies,
    validations: golden.validations,
  };
  orderRecords(records, evidenceEdges, policy);
  const counts = validateAgreementMetrics(
    records,
    indexState,
    analysisTask.legacy_resolution_runs.length,
  );
  const repository = roundTripRecords(records);

  const legacyResolutionBindings = analysisTask.legacy_resolution_runs.map((run) => ({
    run_identifier: run.run_identifier,
    family: run.family,
    resolution_binding: clone(run.resolution_binding),
    adapter_result_binding: clone(run.adapter_result_binding),
    validation_binding: clone(run.validation_binding),
  }));
  const unsignedAnalysis = {
    schema_version: AGREEMENT_ANALYSIS_SCHEMA,
    coordinate_system: COORDINATE_SYSTEM,
    agreement_id: indexState.agreementId,
    agreement_index_binding: clone(context.agreement_index_binding),
    context_compilation_binding: clone(indexState.expected.context_compilation_binding),
    analysis_task_binding: {
      schema_version: ANALYSIS_TASK_SCHEMA,
      analysis_task_id: analysisTask.analysis_task_id,
    },
    analysis_policy_binding: clone(policyBinding),
    requested_scope: clone(analysisTask.requested_scope),
    legacy_resolution_bindings: legacyResolutionBindings,
    claims: repository.reloaded.claims,
    roles: repository.reloaded.roles,
    role_provenance: repository.reloaded.role_provenance,
    evidence_edges: repository.reloaded.evidence_edges,
    dependency_edges: repository.reloaded.dependency_edges,
    proposition_validation_results: repository.reloaded.proposition_validation_results,
    claim_aliases: [],
    claim_equivalences: [],
    repository_round_trip_proof: repository.proof,
    diagnostics: [],
    counts,
  };
  return deepFreeze(recordWithId(
    AGREEMENT_ANALYSIS_SCHEMA,
    'agreement_analysis_id',
    unsignedAnalysis,
  ));
}

module.exports = {
  analyseAgreement,
};
