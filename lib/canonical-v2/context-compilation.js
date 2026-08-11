'use strict';

const {
  canonicalJson,
  contentId,
  sha256Hex,
  utf8Slice,
} = require('./canonical-bytes');

const CONTEXT_COMPILATION_SCHEMA_VERSION = 'CONTEXT_COMPILATION/V1';
const CONTEXT_FRAME_SCHEMA_VERSION = 'CONTEXT_FRAME/V1';
const CONTEXT_FACT_SCHEMA_VERSION = 'CONTEXT_FACT/V1';
const CONTEXT_SCOPE_EDGE_SCHEMA_VERSION = 'CONTEXT_SCOPE_EDGE/V1';
const SEMANTIC_POLICY_SCHEMA_VERSION = 'STAGE_2Y_SEMANTIC_POLICY/V1';
const AGREEMENT_INDEX_SCHEMA_VERSION = 'AGREEMENT_INDEX/V1';
const COORDINATE_SYSTEM = 'UTF8_CANONICAL_TEXT_HALF_OPEN';

const CONTEXT_ROLES = Object.freeze([
  'SUBJECT',
  'ACTOR',
  'CAPACITY',
  'MODAL',
  'VERB',
  'OBJECT',
  'NEGATION',
  'CONNECTIVE',
  'TIME',
  'CONDITION',
  'SCOPE',
]);
const CONTEXT_STATES = Object.freeze([
  'DIRECT',
  'INHERITED',
  'OVERRIDDEN',
  'AMBIGUOUS',
  'UNRESOLVED',
]);
const SCOPE_EDGE_KINDS = Object.freeze(['CHAPEAU_GOVERNS_LIMB']);
const SCOPE_EDGE_STATES = Object.freeze(['RESOLVED', 'AMBIGUOUS', 'UNRESOLVED']);
const SCOPE_PROOF_KINDS = Object.freeze(['AUTHORED_CHAPEAU_CONTIGUOUS_LIMB_SIBLINGS']);
const FOCUS_NODE_KINDS = Object.freeze(['LIMB']);
const TOPBUILD_RULE_ID = 'TOPBUILD_6_2_CHAPEAU_FLOW';
const TOPBUILD_RULE_VERSION = 1;
const HEX_256 = /^[0-9a-f]{64}$/;

class ContextCompilationError extends Error {
  constructor(code, detail) {
    super(`${code}: ${typeof detail === 'string' ? detail : canonicalJson(detail)}`);
    this.name = 'ContextCompilationError';
    this.code = code;
    this.detail = detail;
  }
}

function fail(suffix, detail) {
  throw new ContextCompilationError(`CONTEXT_COMPILATION_${suffix}`, detail);
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function arraysEqual(left, right) {
  return Array.isArray(left)
    && left.length === right.length
    && left.every((value, index) => value === right[index]);
}

function unsignedDigest(value, digestField) {
  const unsigned = structuredClone(value);
  delete unsigned[digestField];
  return sha256Hex(Buffer.from(canonicalJson(unsigned), 'utf8'));
}

function normaliseSpan(span, detail) {
  if (!isPlainObject(span)
    || span.coordinate_system !== COORDINATE_SYSTEM
    || !Number.isSafeInteger(span.start_byte)
    || !Number.isSafeInteger(span.end_byte)
    || span.start_byte < 0
    || span.end_byte <= span.start_byte
    || typeof span.text_sha256 !== 'string'
    || !HEX_256.test(span.text_sha256)) {
    fail('SOURCE_PROOF_MISMATCH', detail);
  }
  return {
    coordinate_system: COORDINATE_SYSTEM,
    start_byte: span.start_byte,
    end_byte: span.end_byte,
    text_sha256: span.text_sha256,
  };
}

function validateSpanAgainstSource(span, sourceBytes, detail) {
  const value = normaliseSpan(span, detail);
  if (value.end_byte > sourceBytes.length
    || sha256Hex(sourceBytes.subarray(value.start_byte, value.end_byte)) !== value.text_sha256) {
    fail('SOURCE_PROOF_MISMATCH', detail);
  }
  return value;
}

function validateAgreementIndex(index) {
  if (!isPlainObject(index) || index.schema_version !== AGREEMENT_INDEX_SCHEMA_VERSION) {
    fail('INDEX_SCHEMA_MISMATCH', index?.schema_version ?? null);
  }
  if (typeof index.agreement_index_id !== 'string' || !HEX_256.test(index.agreement_index_id)) {
    fail('INDEX_DIGEST_MISMATCH', 'agreement_index_id');
  }
  const binding = index.source_binding;
  if (!isPlainObject(binding)
    || typeof binding.canonical_text !== 'string'
    || typeof binding.agreement_id !== 'string'
    || typeof binding.canonical_text_id !== 'string'
    || typeof binding.canonical_text_sha256 !== 'string'
    || !HEX_256.test(binding.canonical_text_sha256)) {
    fail('INDEX_DIGEST_MISMATCH', 'source_binding');
  }
  const sourceBytes = Buffer.from(binding.canonical_text, 'utf8');
  if (sourceBytes.length !== binding.canonical_text_byte_length
    || sha256Hex(sourceBytes) !== binding.canonical_text_sha256) {
    fail('INDEX_DIGEST_MISMATCH', 'canonical_text');
  }
  if (typeof binding.source_binding_digest !== 'string'
    || !HEX_256.test(binding.source_binding_digest)) {
    fail('INDEX_DIGEST_MISMATCH', 'source_binding_digest');
  }
  const unsignedBinding = structuredClone(binding);
  delete unsignedBinding.source_binding_digest;
  if (contentId('AGREEMENT_SOURCE_BINDING/V1', unsignedBinding)
    !== binding.source_binding_digest) {
    fail('INDEX_DIGEST_MISMATCH', 'source_binding_digest');
  }
  if (!isPlainObject(index.structural_policy)
    || typeof index.structural_policy.policy_digest !== 'string'
    || !HEX_256.test(index.structural_policy.policy_digest)) {
    fail('INDEX_DIGEST_MISMATCH', 'structural_policy_digest');
  }

  const collections = [
    'nodes',
    'annotations',
    'source_artefacts',
    'aliases',
    'ambiguities',
    'diagnostics',
    'inline_marker_dispositions',
  ];
  if (collections.some((field) => !Array.isArray(index[field]))) {
    fail('INDEX_DIGEST_MISMATCH', 'index collection');
  }
  if (!isPlainObject(index.inline_marker_partition)
    || !isPlainObject(index.byte_coverage)
    || !isPlainObject(index.counts)) {
    fail('INDEX_DIGEST_MISMATCH', 'index proof');
  }

  const nodesById = new Map();
  for (const node of index.nodes) {
    if (!isPlainObject(node)
      || typeof node.node_occurrence_id !== 'string'
      || !HEX_256.test(node.node_occurrence_id)
      || nodesById.has(node.node_occurrence_id)
      || !Array.isArray(node.child_node_occurrence_ids)) {
      fail('INDEX_DIGEST_MISMATCH', 'node identity');
    }
    validateSpanAgainstSource(node.extent_span, sourceBytes, node.node_occurrence_id);
    nodesById.set(node.node_occurrence_id, node);
  }
  const root = nodesById.get(index.root_node_occurrence_id);
  if (!root || root.parent_node_occurrence_id !== null) {
    fail('INDEX_DIGEST_MISMATCH', 'root node');
  }
  for (const node of index.nodes) {
    if (node.parent_node_occurrence_id !== null) {
      const parent = nodesById.get(node.parent_node_occurrence_id);
      if (!parent || !parent.child_node_occurrence_ids.includes(node.node_occurrence_id)) {
        fail('INDEX_DIGEST_MISMATCH', node.node_occurrence_id);
      }
    }
    if (new Set(node.child_node_occurrence_ids).size !== node.child_node_occurrence_ids.length) {
      fail('INDEX_DIGEST_MISMATCH', node.node_occurrence_id);
    }
    for (const childId of node.child_node_occurrence_ids) {
      const child = nodesById.get(childId);
      if (!child || child.parent_node_occurrence_id !== node.node_occurrence_id) {
        fail('INDEX_DIGEST_MISMATCH', childId);
      }
    }
  }
  for (const annotation of index.annotations) {
    validateSpanAgainstSource(annotation.span, sourceBytes, annotation.annotation_id);
  }
  for (const artefact of index.source_artefacts) {
    validateSpanAgainstSource(artefact.span, sourceBytes, artefact.source_artefact_id);
  }

  const expectedCounts = {
    nodes: index.nodes.length,
    annotations: index.annotations.length,
    source_artefacts: index.source_artefacts.length,
    aliases: index.aliases.length,
    ambiguities: index.ambiguities.length,
    diagnostics: index.diagnostics.length,
    inline_marker_dispositions: index.inline_marker_dispositions.length,
    inline_marker_candidates: index.inline_marker_partition.candidate_count,
    source_bytes: sourceBytes.length,
  };
  if (canonicalJson(expectedCounts) !== canonicalJson(index.counts)) {
    fail('INDEX_DIGEST_MISMATCH', 'counts');
  }

  const partition = index.inline_marker_partition;
  const partitionPayload = {
    schema_version: partition.schema_version,
    scanned_node_occurrence_ids: partition.scanned_node_occurrence_ids,
    candidate_markers: partition.candidate_markers,
    candidate_count: partition.candidate_count,
    disposition_count: partition.disposition_count,
    candidate_marker_span_set_digest: partition.candidate_marker_span_set_digest,
    disposition_marker_span_set_digest: partition.disposition_marker_span_set_digest,
    exact_partition: partition.exact_partition,
  };
  if (contentId(partition.schema_version, partitionPayload) !== partition.proof_digest) {
    fail('INDEX_DIGEST_MISMATCH', 'inline_marker_partition');
  }
  if (contentId('AGREEMENT_BYTE_COVERAGE_PROOF/V1', index.byte_coverage.segments)
    !== index.byte_coverage.proof_digest) {
    fail('INDEX_DIGEST_MISMATCH', 'byte_coverage');
  }

  const identityPayload = {
    agreement_id: binding.agreement_id,
    canonical_text_id: binding.canonical_text_id,
    structural_policy_digest: index.structural_policy.policy_digest,
    root_node_occurrence_id: index.root_node_occurrence_id,
    counts: index.counts,
    node_set_digest: contentId('AGREEMENT_INDEX_NODE_SET/V1', index.nodes),
    annotation_set_digest: contentId('AGREEMENT_INDEX_ANNOTATION_SET/V1', index.annotations),
    source_artefact_set_digest: contentId(
      'AGREEMENT_INDEX_SOURCE_ARTEFACT_SET/V1',
      index.source_artefacts,
    ),
    alias_set_digest: contentId('AGREEMENT_INDEX_ALIAS_SET/V1', index.aliases),
    ambiguity_set_digest: contentId('AGREEMENT_INDEX_AMBIGUITY_SET/V1', index.ambiguities),
    diagnostic_set_digest: contentId('AGREEMENT_INDEX_DIAGNOSTIC_SET/V1', index.diagnostics),
    inline_marker_disposition_set_digest: contentId(
      'AGREEMENT_INDEX_INLINE_MARKER_DISPOSITION_SET/V1',
      index.inline_marker_dispositions,
    ),
    inline_marker_partition_proof_digest: partition.proof_digest,
    byte_coverage_proof_digest: index.byte_coverage.proof_digest,
  };
  if (contentId(AGREEMENT_INDEX_SCHEMA_VERSION, identityPayload) !== index.agreement_index_id) {
    fail('INDEX_DIGEST_MISMATCH', 'agreement_index_id');
  }

  return {
    sourceBytes,
    sourceText: binding.canonical_text,
    nodesById,
    agreementIndexSha256: sha256Hex(Buffer.from(`${canonicalJson(index)}\n`, 'utf8')),
  };
}

function validateSemanticPolicy(policy) {
  if (!isPlainObject(policy) || policy.schema_version !== SEMANTIC_POLICY_SCHEMA_VERSION) {
    fail('POLICY_SCHEMA_MISMATCH', policy?.schema_version ?? null);
  }
  if (!Number.isSafeInteger(policy.policy_version) || policy.policy_version < 1) {
    fail('POLICY_SCHEMA_MISMATCH', 'policy_version');
  }
  if (typeof policy.policy_digest !== 'string'
    || !HEX_256.test(policy.policy_digest)
    || unsignedDigest(policy, 'policy_digest') !== policy.policy_digest) {
    fail('POLICY_DIGEST_MISMATCH', policy.policy_digest ?? null);
  }
  const closedCollections = [
    ['context_role_order', CONTEXT_ROLES],
    ['context_states', CONTEXT_STATES],
    ['scope_edge_kinds', SCOPE_EDGE_KINDS],
    ['scope_edge_states', SCOPE_EDGE_STATES],
    ['scope_proof_kinds', SCOPE_PROOF_KINDS],
  ];
  if (policy.coordinate_system !== COORDINATE_SYSTEM
    || closedCollections.some(([field, expected]) => !arraysEqual(policy[field], expected))
    || policy.compilation_schema_version !== CONTEXT_COMPILATION_SCHEMA_VERSION
    || policy.frame_schema_version !== CONTEXT_FRAME_SCHEMA_VERSION
    || policy.fact_schema_version !== CONTEXT_FACT_SCHEMA_VERSION
    || policy.scope_edge_schema_version !== CONTEXT_SCOPE_EDGE_SCHEMA_VERSION
    || !isPlainObject(policy.input_contract)
    || policy.input_contract.focus_node_kind !== FOCUS_NODE_KINDS[0]
    || !Array.isArray(policy.input_contract.focus_node_occurrence_ids)
    || !isPlainObject(policy.bound_experiment)
    || !Array.isArray(policy.context_rules)
    || policy.context_rules.length !== 1) {
    fail('POLICY_SCHEMA_MISMATCH', 'closed policy contract');
  }
  const rule = policy.context_rules[0];
  if (!isPlainObject(rule)
    || rule.rule_id !== TOPBUILD_RULE_ID
    || rule.rule_version !== TOPBUILD_RULE_VERSION
    || rule.source_node_kind !== 'CHAPEAU'
    || rule.target_node_kind !== 'LIMB'
    || rule.structural_relation
      !== 'PRECEDING_CHAPEAU_CONTIGUOUS_LIMB_SIBLINGS_SAME_PARENT'
    || rule.edge_kind !== SCOPE_EDGE_KINDS[0]
    || rule.edge_state !== 'RESOLVED'
    || rule.proof_kind !== SCOPE_PROOF_KINDS[0]
    || !Array.isArray(rule.required_source_roles)
    || !rule.required_source_roles.includes('GOVERNING_TEXT')
    || typeof rule.full_match_pattern !== 'string'
    || !Array.isArray(rule.capture_roles)
    || rule.capture_roles.length !== 6) {
    fail('POLICY_SCHEMA_MISMATCH', 'context rule');
  }
  const captureNames = new Set();
  const captureRoles = new Set();
  for (const capture of rule.capture_roles) {
    if (!isPlainObject(capture)
      || typeof capture.capture_name !== 'string'
      || !CONTEXT_ROLES.includes(capture.role)
      || captureNames.has(capture.capture_name)
      || captureRoles.has(capture.role)) {
      fail('POLICY_SCHEMA_MISMATCH', 'capture role');
    }
    captureNames.add(capture.capture_name);
    captureRoles.add(capture.role);
  }
  const expectedRoles = ['OBJECT', 'MODAL', 'VERB', 'TIME', 'ACTOR', 'CONNECTIVE'];
  if (expectedRoles.some((role) => !captureRoles.has(role))) {
    fail('POLICY_SCHEMA_MISMATCH', 'TopBuild role set');
  }
  let pattern;
  try {
    const flags = typeof rule.pattern_flags === 'string' ? rule.pattern_flags : 'u';
    if (flags.includes('g') || flags.includes('y') || flags.includes('d')) {
      fail('POLICY_SCHEMA_MISMATCH', 'pattern flags');
    }
    pattern = new RegExp(rule.full_match_pattern, `${flags}d`);
  } catch (error) {
    if (error instanceof ContextCompilationError) throw error;
    fail('POLICY_SCHEMA_MISMATCH', 'full_match_pattern');
  }
  return { policy, rule, pattern };
}

function validateFocusNodeIds(focusNodeIds, nodesById, expectedKind) {
  if (!Array.isArray(focusNodeIds) || focusNodeIds.length === 0) {
    fail('FOCUS_UNKNOWN', 'focusNodeIds must be a non-empty array');
  }
  const seen = new Set();
  const nodes = [];
  for (const id of focusNodeIds) {
    if (typeof id !== 'string' || !nodesById.has(id)) fail('FOCUS_UNKNOWN', id);
    if (seen.has(id)) fail('FOCUS_DUPLICATE', id);
    seen.add(id);
    const node = nodesById.get(id);
    if (node.node_kind !== expectedKind) fail('FOCUS_KIND_MISMATCH', id);
    nodes.push(node);
  }
  const ordered = [...nodes].sort((left, right) =>
    left.extent_span.start_byte - right.extent_span.start_byte
      || left.extent_span.end_byte - right.extent_span.end_byte
      || left.node_occurrence_id.localeCompare(right.node_occurrence_id));
  if (ordered.some((node, index) => node.node_occurrence_id !== nodes[index].node_occurrence_id)) {
    fail('FOCUS_ORDER_MISMATCH', focusNodeIds);
  }
  return nodes;
}

function firstAncestorOfKind(node, wantedKind, nodesById) {
  let current = node;
  const seen = new Set();
  while (current && current.parent_node_occurrence_id !== null) {
    if (seen.has(current.node_occurrence_id)) {
      fail('SOURCE_PROOF_MISMATCH', 'cycle in source parentage');
    }
    seen.add(current.node_occurrence_id);
    current = nodesById.get(current.parent_node_occurrence_id);
    if (current?.node_kind === wantedKind) return current;
  }
  return null;
}

function validateExperimentBinding(
  agreementIndex,
  indexRuntime,
  semanticPolicy,
  focusNodeIds,
  focusNodes,
) {
  const input = semanticPolicy.input_contract;
  const bound = semanticPolicy.bound_experiment;
  if (!arraysEqual(input.focus_node_occurrence_ids, bound.ordered_limb_node_occurrence_ids)
    || input.interface !== 'compileContext(focusNodeIds, AgreementIndex, semanticPolicy)'
    || input.agreement_index_schema_version !== AGREEMENT_INDEX_SCHEMA_VERSION
    || input.focus_order_rule !== 'SOURCE_EXTENT_START_THEN_END_THEN_NODE_OCCURRENCE_ID'
    || [
      'reject_unknown_focus',
      'reject_duplicate_focus',
      'reject_wrong_kind_focus',
      'reject_out_of_source_order_focus',
      'reject_extra_focus',
      'reject_missing_focus',
      'reject_unbound_index',
      'reject_policy_digest_mismatch',
    ].some((field) => input[field] !== true)
    || bound.expected_inherited_fact_count !== 24
    || bound.expected_scope_edge_count !== 24
    || bound.expected_output_diagnostic_count !== 0) {
    fail('POLICY_SCHEMA_MISMATCH', 'bounded experiment contract');
  }

  if (agreementIndex.source_binding.agreement_id !== bound.agreement_id
    || agreementIndex.agreement_index_id !== bound.agreement_index_id
    || indexRuntime.agreementIndexSha256 !== bound.agreement_index_sha256
    || agreementIndex.source_binding.canonical_text_sha256 !== bound.canonical_text_sha256
    || agreementIndex.structural_policy.policy_digest !== bound.structural_policy_digest
    || !arraysEqual(focusNodeIds, input.focus_node_occurrence_ids)
    || !arraysEqual(focusNodeIds, bound.ordered_limb_node_occurrence_ids)) {
    fail('EXPERIMENT_BINDING_MISMATCH', 'index or focus binding');
  }

  const chapeau = indexRuntime.nodesById.get(bound.chapeau_node_occurrence_id);
  const sharedParent = indexRuntime.nodesById.get(bound.shared_parent_node_occurrence_id);
  if (!chapeau
    || chapeau.node_kind !== 'CHAPEAU'
    || chapeau.parent_node_occurrence_id !== bound.shared_parent_node_occurrence_id
    || !sharedParent
    || canonicalJson(normaliseSpan(chapeau.extent_span, chapeau.node_occurrence_id))
      !== canonicalJson(bound.chapeau_span)
    || focusNodes.some((node) =>
      node.parent_node_occurrence_id !== bound.shared_parent_node_occurrence_id)) {
    fail('EXPERIMENT_BINDING_MISMATCH', 'chapeau or shared parent binding');
  }

  if (!Array.isArray(bound.local_qualification_isolation)
    || bound.local_qualification_isolation.length !== 2) {
    fail('POLICY_SCHEMA_MISMATCH', 'qualification isolation contract');
  }
  for (const isolation of bound.local_qualification_isolation) {
    const qualification = indexRuntime.nodesById.get(
      isolation.qualification_node_occurrence_id,
    );
    if (!qualification
      || qualification.node_kind !== 'QUALIFICATION'
      || !Array.isArray(isolation.permitted_target_node_occurrence_ids)
      || isolation.permitted_target_node_occurrence_ids.length !== 1
      || !Array.isArray(isolation.forbidden_target_node_occurrence_ids)
      || canonicalJson(normaliseSpan(qualification.extent_span, qualification.node_occurrence_id))
        !== canonicalJson(isolation.span)) {
      fail('EXPERIMENT_BINDING_MISMATCH', 'qualification binding');
    }
    const owningLimb = firstAncestorOfKind(qualification, 'LIMB', indexRuntime.nodesById);
    if (!owningLimb
      || owningLimb.node_occurrence_id !== isolation.permitted_target_node_occurrence_ids[0]
      || isolation.forbidden_target_node_occurrence_ids.includes(owningLimb.node_occurrence_id)
      || isolation.forbidden_target_node_occurrence_ids.some((id) => !focusNodeIds.includes(id))) {
      fail('EXPERIMENT_BINDING_MISMATCH', 'qualification parent isolation');
    }
  }
}

function selectGoverningChapeau(focusNodes, nodesById, rule) {
  if (focusNodes.length !== 4) fail('EXPERIMENT_BINDING_MISMATCH', 'four focus limbs required');
  const sharedParentId = focusNodes[0].parent_node_occurrence_id;
  if (!sharedParentId
    || focusNodes.some((node) => node.parent_node_occurrence_id !== sharedParentId)) {
    fail('SOURCE_PROOF_MISMATCH', 'focus limbs do not share a parent');
  }
  const parent = nodesById.get(sharedParentId);
  if (!parent) fail('SOURCE_PROOF_MISMATCH', sharedParentId);
  const siblings = parent.child_node_occurrence_ids.map((id) => nodesById.get(id));
  if (siblings.some((node) => !node)) fail('SOURCE_PROOF_MISMATCH', sharedParentId);
  const focusPositions = focusNodes.map((node) => siblings.indexOf(node));
  if (focusPositions.some((position) => position < 0)
    || focusPositions.some((position, index) => index > 0 && position !== focusPositions[index - 1] + 1)) {
    fail('SOURCE_PROOF_MISMATCH', 'focus limbs are not contiguous siblings');
  }
  const firstPosition = focusPositions[0];
  const candidates = siblings.slice(0, firstPosition).filter((node) =>
    node.node_kind === rule.source_node_kind
      && rule.required_source_roles.every((role) => node.roles.includes(role)));
  const chapeau = candidates.at(-1);
  if (!chapeau || siblings.indexOf(chapeau) !== firstPosition - 1) {
    fail('SOURCE_PROOF_MISMATCH', 'no immediately preceding authored chapeau');
  }
  return { chapeau, parent, orderedFocusNodeIds: focusNodes.map((node) => node.node_occurrence_id) };
}

function exactCaptureFacts(chapeau, sourceText, pattern, rule) {
  const chapeauText = utf8Slice(
    sourceText,
    chapeau.extent_span.start_byte,
    chapeau.extent_span.end_byte,
  );
  const match = pattern.exec(chapeauText);
  if (!match || match[0] !== chapeauText || !match.indices?.groups) {
    fail('SOURCE_PROOF_MISMATCH', 'chapeau grammar');
  }
  const facts = rule.capture_roles.map(({ capture_name: captureName, role }) => {
    const indices = match.indices.groups[captureName];
    if (!indices || indices[1] <= indices[0]) {
      fail('SOURCE_PROOF_MISMATCH', `missing capture ${captureName}`);
    }
    const prefix = chapeauText.slice(0, indices[0]);
    const value = chapeauText.slice(indices[0], indices[1]);
    const startByte = chapeau.extent_span.start_byte + Buffer.byteLength(prefix, 'utf8');
    const endByte = startByte + Buffer.byteLength(value, 'utf8');
    return {
      role,
      value,
      sourceSpan: {
        coordinate_system: COORDINATE_SYSTEM,
        start_byte: startByte,
        end_byte: endByte,
        text_sha256: sha256Hex(Buffer.from(value, 'utf8')),
      },
    };
  });
  if (!Array.isArray(rule.expected_capture_spans)
    || rule.expected_capture_spans.length !== facts.length) {
    fail('POLICY_SCHEMA_MISMATCH', 'expected capture spans');
  }
  for (const fact of facts) {
    const expected = rule.expected_capture_spans.find((entry) => entry.role === fact.role);
    if (!expected
      || expected.value !== fact.value
      || canonicalJson(expected.span) !== canonicalJson(fact.sourceSpan)) {
      fail('SOURCE_PROOF_MISMATCH', `capture proof ${fact.role}`);
    }
  }
  return facts;
}

function withContentId(schemaVersion, idField, unsigned) {
  const payload = {
    schema_version: schemaVersion,
    ...unsigned,
  };
  return {
    schema_version: schemaVersion,
    [idField]: contentId(schemaVersion, payload),
    ...unsigned,
  };
}

function compareByFocusAndRole(left, right, focusOrder, roleOrder) {
  return focusOrder.get(left.target_node_occurrence_id)
    - focusOrder.get(right.target_node_occurrence_id)
    || roleOrder.get(left.role ?? left.governing_role)
    - roleOrder.get(right.role ?? right.governing_role)
    || (left.source_span?.start_byte ?? left.governing_source_span?.start_byte)
    - (right.source_span?.start_byte ?? right.governing_source_span?.start_byte)
    || (left.source_span?.end_byte ?? left.governing_source_span?.end_byte)
    - (right.source_span?.end_byte ?? right.governing_source_span?.end_byte)
    || String(left.context_fact_id ?? left.scope_edge_id)
      .localeCompare(String(right.context_fact_id ?? right.scope_edge_id));
}

function compileContext(focusNodeIds, agreementIndex, semanticPolicy) {
  const indexRuntime = validateAgreementIndex(agreementIndex);
  const policyRuntime = validateSemanticPolicy(semanticPolicy);
  const focusNodes = validateFocusNodeIds(
    focusNodeIds,
    indexRuntime.nodesById,
    semanticPolicy.input_contract.focus_node_kind,
  );
  validateExperimentBinding(
    agreementIndex,
    indexRuntime,
    semanticPolicy,
    focusNodeIds,
    focusNodes,
  );
  const structuralProof = selectGoverningChapeau(
    focusNodes,
    indexRuntime.nodesById,
    policyRuntime.rule,
  );
  const capturedFacts = exactCaptureFacts(
    structuralProof.chapeau,
    indexRuntime.sourceText,
    policyRuntime.pattern,
    policyRuntime.rule,
  );
  const connective = capturedFacts.find((fact) => fact.role === 'CONNECTIVE');
  if (!connective) fail('SOURCE_PROOF_MISMATCH', 'connective capture');

  const roleOrder = new Map(
    semanticPolicy.context_role_order.map((role, index) => [role, index]),
  );
  const focusOrder = new Map(focusNodeIds.map((id, index) => [id, index]));
  const contextFacts = [];
  const scopeEdges = [];
  for (const targetNode of focusNodes) {
    for (const captured of capturedFacts) {
      const proof = {
        proof_kind: policyRuntime.rule.proof_kind,
        shared_parent_node_occurrence_id: structuralProof.parent.node_occurrence_id,
        source_node_kind: structuralProof.chapeau.node_kind,
        target_node_kind: targetNode.node_kind,
        source_extent_span: normaliseSpan(
          structuralProof.chapeau.extent_span,
          structuralProof.chapeau.node_occurrence_id,
        ),
        target_extent_span: normaliseSpan(targetNode.extent_span, targetNode.node_occurrence_id),
        connective_span: connective.sourceSpan,
        ordered_target_node_occurrence_ids: [...structuralProof.orderedFocusNodeIds],
      };
      const unsignedEdge = {
        edge_kind: policyRuntime.rule.edge_kind,
        state: policyRuntime.rule.edge_state,
        governing_role: captured.role,
        source_node_occurrence_id: structuralProof.chapeau.node_occurrence_id,
        governing_source_span: captured.sourceSpan,
        target_node_occurrence_id: targetNode.node_occurrence_id,
        proof,
        rule_id: policyRuntime.rule.rule_id,
        rule_version: policyRuntime.rule.rule_version,
      };
      const edge = withContentId(
        CONTEXT_SCOPE_EDGE_SCHEMA_VERSION,
        'scope_edge_id',
        unsignedEdge,
      );
      scopeEdges.push(edge);
      const unsignedFact = {
        role: captured.role,
        value: captured.value,
        state: 'INHERITED',
        source_node_occurrence_id: structuralProof.chapeau.node_occurrence_id,
        source_span: captured.sourceSpan,
        target_node_occurrence_id: targetNode.node_occurrence_id,
        scope_edge_id: edge.scope_edge_id,
        rule_id: policyRuntime.rule.rule_id,
        rule_version: policyRuntime.rule.rule_version,
        overridden_fact_ids: [],
        alternative_fact_ids: [],
      };
      contextFacts.push(withContentId(
        CONTEXT_FACT_SCHEMA_VERSION,
        'context_fact_id',
        unsignedFact,
      ));
    }
  }
  contextFacts.sort((left, right) => compareByFocusAndRole(left, right, focusOrder, roleOrder));
  scopeEdges.sort((left, right) => compareByFocusAndRole(left, right, focusOrder, roleOrder));

  const framesByFocusNodeId = {};
  for (const focusNode of focusNodes) {
    const factIds = contextFacts
      .filter((fact) => fact.target_node_occurrence_id === focusNode.node_occurrence_id)
      .map((fact) => fact.context_fact_id);
    const edgeIds = scopeEdges
      .filter((edge) => edge.target_node_occurrence_id === focusNode.node_occurrence_id)
      .map((edge) => edge.scope_edge_id);
    const unsignedFrame = {
      focus_node_occurrence_id: focusNode.node_occurrence_id,
      focus_node_kind: focusNode.node_kind,
      focus_node_span: normaliseSpan(focusNode.extent_span, focusNode.node_occurrence_id),
      context_fact_ids: factIds,
      scope_edge_ids: edgeIds,
      ambiguity_ids: [],
      residual_ids: [],
    };
    framesByFocusNodeId[focusNode.node_occurrence_id] = withContentId(
      CONTEXT_FRAME_SCHEMA_VERSION,
      'context_frame_id',
      unsignedFrame,
    );
  }

  const payload = {
    schema_version: CONTEXT_COMPILATION_SCHEMA_VERSION,
    agreement_index_binding: {
      agreement_index_id: agreementIndex.agreement_index_id,
      agreement_index_sha256: indexRuntime.agreementIndexSha256,
      canonical_text_sha256: agreementIndex.source_binding.canonical_text_sha256,
      structural_policy_digest: agreementIndex.structural_policy.policy_digest,
    },
    semantic_policy_binding: {
      schema_version: semanticPolicy.schema_version,
      policy_version: semanticPolicy.policy_version,
      policy_digest: semanticPolicy.policy_digest,
    },
    focus_node_occurrence_ids: [...focusNodeIds],
    frames_by_focus_node_id: framesByFocusNodeId,
    context_facts: contextFacts,
    scope_edges: scopeEdges,
    ambiguities: [],
    residuals: [],
    reference_edges: [],
    definition_edges: [],
    semantic_relationships: [],
    diagnostics: [],
  };
  if (contextFacts.length !== semanticPolicy.bound_experiment.expected_inherited_fact_count
    || scopeEdges.length !== semanticPolicy.bound_experiment.expected_scope_edge_count
    || payload.diagnostics.length
      !== semanticPolicy.bound_experiment.expected_output_diagnostic_count) {
    fail('SOURCE_PROOF_MISMATCH', 'bounded output count');
  }
  const result = {
    ...payload,
    context_compilation_id: contentId(
      CONTEXT_COMPILATION_SCHEMA_VERSION,
      payload,
    ),
  };
  return Object.freeze(structuredClone(result));
}

module.exports = {
  CONTEXT_COMPILATION_SCHEMA_VERSION,
  CONTEXT_FRAME_SCHEMA_VERSION,
  CONTEXT_FACT_SCHEMA_VERSION,
  CONTEXT_SCOPE_EDGE_SCHEMA_VERSION,
  SEMANTIC_POLICY_SCHEMA_VERSION,
  CONTEXT_ROLES,
  CONTEXT_STATES,
  SCOPE_EDGE_KINDS,
  SCOPE_PROOF_KINDS,
  FOCUS_NODE_KINDS,
  ContextCompilationError,
  compileContext,
};
