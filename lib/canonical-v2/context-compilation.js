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
const CONTEXT_AMBIGUITY_SCHEMA_VERSION = 'CONTEXT_AMBIGUITY/V1';
const CONTEXT_RESIDUAL_SCHEMA_VERSION = 'CONTEXT_RESIDUAL/V1';
const CONTEXT_REFERENCE_EDGE_SCHEMA_VERSION = 'CONTEXT_REFERENCE_EDGE/V1';
const CONTEXT_DEFINITION_EDGE_SCHEMA_VERSION = 'CONTEXT_DEFINITION_EDGE/V1';
const CONTEXT_SEMANTIC_RELATIONSHIP_SCHEMA_VERSION = 'CONTEXT_SEMANTIC_RELATIONSHIP/V1';
const CONTEXT_DIAGNOSTIC_SCHEMA_VERSION = 'CONTEXT_DIAGNOSTIC/V1';
const CONTEXT_TOPOLOGY_ENTITY_SCHEMA_VERSION = 'CONTEXT_TOPOLOGY_ENTITY/V1';
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

function compileContextV1(focusNodeIds, agreementIndex, semanticPolicy) {
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

function compareNodeSource(left, right) {
  return left.extent_span.start_byte - right.extent_span.start_byte
    || left.extent_span.end_byte - right.extent_span.end_byte
    || left.node_occurrence_id.localeCompare(right.node_occurrence_id);
}

function compareSpanSource(left, right) {
  return left.start_byte - right.start_byte
    || left.end_byte - right.end_byte
    || left.text_sha256.localeCompare(right.text_sha256);
}

function ruleKey(rule) {
  return `${rule.rule_id}\0${rule.rule_version}`;
}

function fixtureKey(rule) {
  return `${rule.rule_id}\0${rule.rule_version}\0${rule.source_node_occurrence_id}`;
}

function exactKeys(value, expected) {
  return isPlainObject(value)
    && arraysEqual(Object.keys(value).sort(), [...expected].sort());
}

function compilePolicyPattern(pattern, flags, matchMode) {
  if (typeof pattern !== 'string' || typeof flags !== 'string') {
    fail('POLICY_SCHEMA_MISMATCH', 'policy regex');
  }
  const forbidden = matchMode === 'ALL_NON_OVERLAPPING' ? ['y'] : ['g', 'y'];
  if (forbidden.some((flag) => flags.includes(flag)) || flags.includes('d')) {
    fail('POLICY_SCHEMA_MISMATCH', 'policy regex flags');
  }
  try {
    return new RegExp(pattern, `${flags}d${matchMode === 'ALL_NON_OVERLAPPING' ? 'g' : ''}`);
  } catch {
    fail('POLICY_SCHEMA_MISMATCH', 'policy regex syntax');
  }
}

function validateSemanticPolicyV2(policy) {
  if (!isPlainObject(policy)
    || policy.schema_version !== SEMANTIC_POLICY_SCHEMA_VERSION
    || policy.policy_version !== 2) {
    fail('POLICY_SCHEMA_MISMATCH', policy?.schema_version ?? null);
  }
  if (typeof policy.policy_digest !== 'string'
    || !HEX_256.test(policy.policy_digest)
    || unsignedDigest(policy, 'policy_digest') !== policy.policy_digest) {
    fail('POLICY_DIGEST_MISMATCH', policy.policy_digest ?? null);
  }
  const schemas = [
    ['compilation_schema_version', CONTEXT_COMPILATION_SCHEMA_VERSION],
    ['frame_schema_version', CONTEXT_FRAME_SCHEMA_VERSION],
    ['fact_schema_version', CONTEXT_FACT_SCHEMA_VERSION],
    ['scope_edge_schema_version', CONTEXT_SCOPE_EDGE_SCHEMA_VERSION],
    ['ambiguity_schema_version', CONTEXT_AMBIGUITY_SCHEMA_VERSION],
    ['residual_schema_version', CONTEXT_RESIDUAL_SCHEMA_VERSION],
    ['reference_edge_schema_version', CONTEXT_REFERENCE_EDGE_SCHEMA_VERSION],
    ['definition_edge_schema_version', CONTEXT_DEFINITION_EDGE_SCHEMA_VERSION],
    ['semantic_relationship_schema_version', CONTEXT_SEMANTIC_RELATIONSHIP_SCHEMA_VERSION],
    ['diagnostic_schema_version', CONTEXT_DIAGNOSTIC_SCHEMA_VERSION],
  ];
  if (policy.coordinate_system !== COORDINATE_SYSTEM
    || !arraysEqual(policy.context_role_order, CONTEXT_ROLES)
    || !arraysEqual(policy.context_states, CONTEXT_STATES)
    || schemas.some(([field, value]) => policy[field] !== value)
    || !Array.isArray(policy.capture_rules)
    || !Array.isArray(policy.scope_rules)
    || !Array.isArray(policy.fixture_scope_rules)
    || !Array.isArray(policy.topology_rules)
    || !isPlainObject(policy.input_contract)
    || !isPlainObject(policy.reference_resolution_contract)
    || !isPlainObject(policy.definition_resolution_contract)
    || !isPlainObject(policy.inheritance_contract)
    || !isPlainObject(policy.inheritance_contract.capture_conflict_construction)
    || !isPlainObject(policy.inheritance_contract.override_construction)
    || !isPlainObject(policy.output_contract)
    || !isPlainObject(policy.identity_contract)
    || !isPlainObject(policy.ordering_contract)
    || !isPlainObject(policy.input_contract.residual_attachment)
    || !isPlainObject(policy.input_contract.residual_attachment
      .first_following_focus_within_nearest_structural_container)
    || !isPlainObject(policy.input_contract.topology_record_construction)) {
    fail('POLICY_SCHEMA_MISMATCH', 'V2 closed contract');
  }
  const captureBindings = new Map();
  const conflictConstruction = policy.inheritance_contract.capture_conflict_construction;
  const overrideConstruction = policy.inheritance_contract.override_construction;
  const ownerFallback = policy.input_contract.residual_attachment
    .first_following_focus_within_nearest_structural_container;
  const topologyConstruction = policy.input_contract.topology_record_construction;
  const topologyConflict = topologyConstruction.conflict_construction;
  if (!arraysEqual(conflictConstruction.conflict_partition_key, [
    'target_node_occurrence_id',
    'role',
    'precedence_tier',
    'source_node_occurrence_id',
  ])
    || conflictConstruction.component_relation !== 'HALF_OPEN_SOURCE_SPANS_OVERLAP_TRANSITIVELY'
    || conflictConstruction.conflicting_fact_state !== 'AMBIGUOUS'
    || !Array.isArray(conflictConstruction.overridden_fact_ids)
    || overrideConstruction.semantic_slot_alignment_required !== true
    || overrideConstruction.replacement_relation_source
      !== 'EXPLICIT_EXECUTABLE_POLICY_RULE_ONLY'
    || overrideConstruction.target_and_role_equality_is_replacement_proof !== false
    || overrideConstruction.source_span_overlap_is_replacement_proof !== false
    || !Array.isArray(overrideConstruction.replacement_rule_ids)
    || overrideConstruction.replacement_rule_ids.length !== 0
    || overrideConstruction.m3_overridden_fact_count !== 0
    || policy.inheritance_contract.precedence_without_replacement_rule
      !== 'ORDER_EVIDENCE_ONLY_DO_NOT_CHANGE_STATE_OR_SUPPRESS_FACT'
    || !Array.isArray(overrideConstruction.non_overridden_fact_overridden_fact_ids)
    || !Array.isArray(overrideConstruction.non_ambiguous_fact_alternative_fact_ids)
    || !Array.isArray(ownerFallback.permitted_container_kinds)
    || ownerFallback.permitted_container_kinds.length === 0
    || ownerFallback.candidate_start !== 'GREATER_THAN_OR_EQUAL_TO_OWNER_EXTENT_END_BYTE'
    || ownerFallback.ascend_beyond_selected_container !== false
    || topologyConstruction.resolved_relationship_state !== 'RESOLVED'
    || !isPlainObject(topologyConstruction.resolved_relationship_reason_by_temporal_scope_state)
    || !isPlainObject(topologyConstruction.unstated_temporal_scope)
    || !isPlainObject(topologyConflict)
    || !arraysEqual(topologyConflict.initial_partition_key, [
      'source_node_occurrence_id',
      'relationship_type',
      'directed',
    ])
    || !isPlainObject(topologyConflict.endpoint_slot_alignment)
    || topologyConflict.endpoint_slot_alignment.half_open_overlap
      !== 'LEFT_START_LESS_THAN_RIGHT_END_AND_LEFT_END_GREATER_THAN_RIGHT_START'
    || topologyConflict.endpoint_slot_alignment.directed
      !== 'SOURCE_CAPTURE_SPANS_OVERLAP_AND_TARGET_CAPTURE_SPANS_OVERLAP'
    || topologyConflict.endpoint_slot_alignment.undirected
      !== 'DIRECT_OR_REVERSED_SOURCE_AND_TARGET_CAPTURE_SPAN_OVERLAP'
    || topologyConflict.endpoint_slot_alignment.component_relation !== 'TRANSITIVE_CLOSURE'
    || topologyConflict.priority_selection
      !== 'WITHIN_EACH_ALIGNMENT_COMPONENT_RETAIN_ONLY_MAXIMUM_RULE_PRIORITY_THEN_REBUILD_ALIGNMENT_COMPONENTS_WITHOUT_SUPPRESSED_CANDIDATES'
    || topologyConflict.reading_identity
      !== 'ORDERED_ENDPOINT_ENTITY_ID_PAIR_AND_CANONICAL_TEMPORAL_SCOPE'
    || topologyConflict.identical_reading_tie_break
      !== 'RULE_ID_ASCENDING_THEN_RULE_VERSION_ASCENDING'
    || topologyConflict.conflicting_relationship_emission
      !== 'ONE_PER_DISTINCT_READING_IDENTITY_NO_RESOLVED_WINNER'
    || topologyConflict.conflicting_relationship_state !== 'AMBIGUOUS'
    || topologyConflict.conflicting_relationship_reason_code !== 'TOPOLOGY_SOURCE_CONFLICT'
    || !isPlainObject(topologyConflict.ambiguity)
    || topologyConflict.ambiguity.ambiguity_type !== 'TOPOLOGY_SOURCE_CONFLICT'
    || topologyConflict.ambiguity.state !== 'OPEN'
    || !arraysEqual(topologyConflict.ambiguity.reason_codes, ['TOPOLOGY_SOURCE_CONFLICT'])
    || topologyConflict.hidden_defaults !== false) {
    fail('POLICY_SCHEMA_MISMATCH', 'V2 execution contract');
  }
  for (const binding of policy.input_contract.capture_fixture_bindings || []) {
    if (!isPlainObject(binding)
      || typeof binding.rule_id !== 'string'
      || !Number.isSafeInteger(binding.rule_version)
      || typeof binding.source_node_occurrence_id !== 'string'
      || !Array.isArray(binding.expected_captures)) {
      fail('POLICY_SCHEMA_MISMATCH', 'capture fixture binding');
    }
    const key = ruleKey(binding);
    if (!captureBindings.has(key)) captureBindings.set(key, []);
    captureBindings.get(key).push(binding);
  }
  const captureRules = policy.capture_rules.map((rule, ordinal) => {
    if (!isPlainObject(rule)
      || typeof rule.rule_id !== 'string'
      || !Number.isSafeInteger(rule.rule_version)
      || !Number.isSafeInteger(rule.priority)
      || !Array.isArray(rule.applies_to_node_kinds)
      || !Array.isArray(rule.capture_roles)
      || !Array.isArray(rule.required_source_roles)
      || !['FULL', 'ALL_NON_OVERLAPPING'].includes(rule.match_mode)
      || rule.source_byte_mode !== 'AUTHORED_BYTES_EXCLUDING_SOURCE_ARTEFACTS') {
      fail('POLICY_SCHEMA_MISMATCH', 'capture rule');
    }
    for (const capture of rule.capture_roles) {
      if (!isPlainObject(capture)
        || typeof capture.capture_name !== 'string'
        || !CONTEXT_ROLES.includes(capture.role)
        || capture.value_mode !== 'EXACT_SOURCE_TEXT') {
        fail('POLICY_SCHEMA_MISMATCH', 'capture member');
      }
    }
    return {
      ...rule,
      ordinal,
      patternRuntime: compilePolicyPattern(
        rule.pattern,
        rule.pattern_flags,
        rule.match_mode,
      ),
    };
  });
  const scopeRules = policy.scope_rules.map((rule) => {
    if (!isPlainObject(rule)
      || typeof rule.rule_id !== 'string'
      || !Number.isSafeInteger(rule.rule_version)
      || !Number.isSafeInteger(rule.priority)
      || !Array.isArray(rule.source_node_kinds)
      || !Array.isArray(rule.target_node_kinds)
      || !Array.isArray(rule.governing_roles)) {
      fail('POLICY_SCHEMA_MISMATCH', 'scope rule');
    }
    return {
      ...rule,
      connectiveRuntime: rule.connective_pattern === null
        ? null
        : compilePolicyPattern(rule.connective_pattern, rule.pattern_flags, 'FIRST'),
    };
  });
  const fixtureKeys = new Set();
  for (const fixture of policy.fixture_scope_rules) {
    const key = fixtureKey(fixture);
    if (fixtureKeys.has(key)
      || !Array.isArray(fixture.target_node_occurrence_ids)
      || !Array.isArray(fixture.target_spans)
      || fixture.target_node_occurrence_ids.length !== fixture.target_spans.length
      || !Array.isArray(fixture.governing_roles)) {
      fail('POLICY_SCHEMA_MISMATCH', 'fixture scope rule');
    }
    fixtureKeys.add(key);
  }
  const topologyExecution = new Map(
    (policy.input_contract.topology_rule_execution || [])
      .map((entry) => [ruleKey(entry), entry]),
  );
  const topologyRules = policy.topology_rules.map((rule) => {
    const execution = topologyExecution.get(ruleKey(rule));
    if (!execution
      || !Number.isSafeInteger(rule.priority)
      || typeof rule.directed !== 'boolean'
      || typeof rule.relationship_type !== 'string'
      || typeof rule.source_endpoint_capture !== 'string'
      || typeof rule.target_endpoint_capture !== 'string'
      || execution.source_byte_mode !== 'AUTHORED_BYTES_EXCLUDING_SOURCE_ARTEFACTS'
      || !['FULL', 'FIRST'].includes(execution.match_mode)) {
      fail('POLICY_SCHEMA_MISMATCH', 'topology rule execution');
    }
    return {
      ...rule,
      execution,
      patternRuntime: compilePolicyPattern(
        rule.pattern,
        rule.pattern_flags,
        execution.match_mode,
      ),
    };
  });
  return {
    policy,
    captureBindings,
    captureRules,
    scopeRules,
    topologyRules,
  };
}

function deriveFocusNodes(index, nodesById, policy) {
  const selectedKinds = new Set(policy.input_contract.focus_derivation.selected_kinds);
  const hasSelectedDescendant = (node) => {
    const queue = [...node.child_node_occurrence_ids];
    const seen = new Set();
    while (queue.length > 0) {
      const id = queue.shift();
      if (seen.has(id)) fail('INDEX_DIGEST_MISMATCH', 'source cycle');
      seen.add(id);
      const child = nodesById.get(id);
      if (!child) fail('INDEX_DIGEST_MISMATCH', id);
      if (selectedKinds.has(child.node_kind)) return true;
      queue.push(...child.child_node_occurrence_ids);
    }
    return false;
  };
  return index.nodes
    .filter((node) => selectedKinds.has(node.node_kind)
      || (node.node_kind === 'SECTION' && !hasSelectedDescendant(node)))
    .sort(compareNodeSource);
}

function validateV2FocusIds(focusNodeIds, focusNodes, nodesById, allowedKinds) {
  if (!Array.isArray(focusNodeIds)) fail('FOCUS_SET_MISMATCH', 'focus list');
  const seen = new Set();
  const suppliedNodes = [];
  for (const id of focusNodeIds) {
    if (typeof id !== 'string' || !nodesById.has(id)) fail('FOCUS_UNKNOWN', id);
    if (seen.has(id)) fail('FOCUS_DUPLICATE', id);
    seen.add(id);
    const node = nodesById.get(id);
    if (!allowedKinds.includes(node.node_kind)) fail('FOCUS_KIND_MISMATCH', id);
    suppliedNodes.push(node);
  }
  const sorted = [...suppliedNodes].sort(compareNodeSource);
  if (sorted.some((node, index) => node.node_occurrence_id !== suppliedNodes[index].node_occurrence_id)) {
    fail('FOCUS_ORDER_MISMATCH', focusNodeIds);
  }
  const expectedIds = focusNodes.map((node) => node.node_occurrence_id);
  if (!arraysEqual(focusNodeIds, expectedIds)) fail('FOCUS_SET_MISMATCH', focusNodeIds.length);
}

function buildV2Runtime(index, indexRuntime, focusNodes) {
  const annotationsById = new Map();
  for (const annotation of index.annotations) {
    if (!isPlainObject(annotation)
      || typeof annotation.annotation_occurrence_id !== 'string'
      || annotationsById.has(annotation.annotation_occurrence_id)
      || !indexRuntime.nodesById.has(annotation.owner_node_occurrence_id)) {
      fail('INDEX_DIGEST_MISMATCH', 'annotation identity');
    }
    annotationsById.set(annotation.annotation_occurrence_id, annotation);
  }
  const focusById = new Map(focusNodes.map((node, ordinal) => [
    node.node_occurrence_id,
    { node, ordinal },
  ]));
  const descendantFocusByAncestor = new Map();
  for (const focus of focusNodes) {
    let current = focus;
    const seen = new Set();
    while (current.parent_node_occurrence_id !== null) {
      if (seen.has(current.node_occurrence_id)) fail('INDEX_DIGEST_MISMATCH', 'parent cycle');
      seen.add(current.node_occurrence_id);
      const parent = indexRuntime.nodesById.get(current.parent_node_occurrence_id);
      if (!parent) fail('INDEX_DIGEST_MISMATCH', current.parent_node_occurrence_id);
      if (!descendantFocusByAncestor.has(parent.node_occurrence_id)) {
        descendantFocusByAncestor.set(parent.node_occurrence_id, []);
      }
      descendantFocusByAncestor.get(parent.node_occurrence_id).push(focus);
      current = parent;
    }
  }
  for (const values of descendantFocusByAncestor.values()) values.sort(compareNodeSource);
  return {
    ...indexRuntime,
    annotationsById,
    focusById,
    descendantFocusByAncestor,
    sourceArtefacts: [...index.source_artefacts]
      .sort((left, right) => compareSpanSource(left.span, right.span)),
    sourceViewCache: new Map(),
  };
}

function sourceView(node, runtime) {
  if (runtime.sourceViewCache.has(node.node_occurrence_id)) {
    return runtime.sourceViewCache.get(node.node_occurrence_id);
  }
  const extent = node.extent_span;
  const exclusions = runtime.sourceArtefacts
    .map((artefact) => ({
      start: Math.max(extent.start_byte, artefact.span.start_byte),
      end: Math.min(extent.end_byte, artefact.span.end_byte),
    }))
    .filter((span) => span.end > span.start)
    .sort((left, right) => left.start - right.start || left.end - right.end);
  const merged = [];
  for (const exclusion of exclusions) {
    const previous = merged.at(-1);
    if (previous && exclusion.start <= previous.end) previous.end = Math.max(previous.end, exclusion.end);
    else merged.push({ ...exclusion });
  }
  const segments = [];
  let sourceCursor = extent.start_byte;
  let virtualCursor = 0;
  for (const exclusion of merged) {
    if (sourceCursor < exclusion.start) {
      const bytes = runtime.sourceBytes.subarray(sourceCursor, exclusion.start);
      segments.push({
        sourceStart: sourceCursor,
        sourceEnd: exclusion.start,
        virtualStart: virtualCursor,
        virtualEnd: virtualCursor + bytes.length,
      });
      virtualCursor += bytes.length;
    }
    sourceCursor = Math.max(sourceCursor, exclusion.end);
  }
  if (sourceCursor < extent.end_byte) {
    const bytes = runtime.sourceBytes.subarray(sourceCursor, extent.end_byte);
    segments.push({
      sourceStart: sourceCursor,
      sourceEnd: extent.end_byte,
      virtualStart: virtualCursor,
      virtualEnd: virtualCursor + bytes.length,
    });
  }
  const bytes = Buffer.concat(segments.map((segment) =>
    runtime.sourceBytes.subarray(segment.sourceStart, segment.sourceEnd)));
  const value = { text: bytes.toString('utf8'), bytes, segments };
  runtime.sourceViewCache.set(node.node_occurrence_id, value);
  return value;
}

function sourceSpanFromMatch(view, startIndex, endIndex, runtime, detail) {
  const startVirtual = Buffer.byteLength(view.text.slice(0, startIndex), 'utf8');
  const endVirtual = Buffer.byteLength(view.text.slice(0, endIndex), 'utf8');
  const segment = view.segments.find((entry) =>
    startVirtual >= entry.virtualStart && endVirtual <= entry.virtualEnd);
  if (!segment || endVirtual <= startVirtual) return null;
  const start = segment.sourceStart + startVirtual - segment.virtualStart;
  const end = segment.sourceStart + endVirtual - segment.virtualStart;
  const bytes = runtime.sourceBytes.subarray(start, end);
  if (bytes.toString('utf8') !== view.text.slice(startIndex, endIndex)) return null;
  return {
    coordinate_system: COORDINATE_SYSTEM,
    start_byte: start,
    end_byte: end,
    text_sha256: sha256Hex(bytes),
  };
}

function nodeIsWithinAmbiguity(node, ambiguity, nodesById) {
  if (node.extent_span.start_byte < ambiguity.span.end_byte
    && node.extent_span.end_byte > ambiguity.span.start_byte) return true;
  const predecessorNodes = new Set(ambiguity.node_occurrence_ids);
  let current = node;
  while (current) {
    if (predecessorNodes.has(current.node_occurrence_id)) return true;
    current = current.parent_node_occurrence_id === null
      ? null
      : nodesById.get(current.parent_node_occurrence_id);
  }
  return false;
}

function nodeIsAmbiguityTarget(node, ambiguity, nodesById) {
  const predecessorNodes = new Set(ambiguity.node_occurrence_ids);
  let current = node;
  while (current) {
    if (predecessorNodes.has(current.node_occurrence_id)) return true;
    current = current.parent_node_occurrence_id === null
      ? null
      : nodesById.get(current.parent_node_occurrence_id);
  }
  return node.extent_span.start_byte >= ambiguity.span.start_byte
    && node.extent_span.end_byte <= ambiguity.span.end_byte;
}

function captureRuleIsBoundToNode(rule, node, index, policyRuntime) {
  const bindings = policyRuntime.captureBindings.get(ruleKey(rule));
  if (!bindings || bindings.length === 0) return true;
  return bindings.some((binding) =>
    binding.agreement_id === index.source_binding.agreement_id
      && binding.agreement_index_id === index.agreement_index_id
      && binding.source_node_occurrence_id === node.node_occurrence_id);
}

function captureNode(rule, node, runtime) {
  const view = sourceView(node, runtime);
  const matches = [];
  rule.patternRuntime.lastIndex = 0;
  if (rule.match_mode === 'FULL') {
    const match = rule.patternRuntime.exec(view.text);
    if (match && match[0] === view.text) matches.push(match);
  } else {
    let match;
    while ((match = rule.patternRuntime.exec(view.text)) !== null) {
      matches.push(match);
      if (match[0].length === 0) rule.patternRuntime.lastIndex += 1;
    }
  }
  const captures = [];
  for (const match of matches) {
    for (const capture of rule.capture_roles) {
      const indices = match.indices?.groups?.[capture.capture_name];
      if (!indices || indices[1] <= indices[0]) continue;
      const span = sourceSpanFromMatch(
        view,
        indices[0],
        indices[1],
        runtime,
        `${rule.rule_id}:${capture.capture_name}`,
      );
      if (span === null) continue;
      captures.push({
        captureName: capture.capture_name,
        occurrence: capture.occurrence,
        role: capture.role,
        value: utf8Slice(runtime.sourceText, span.start_byte, span.end_byte),
        sourceSpan: span,
        sourceNode: node,
        captureRule: rule,
      });
    }
  }
  return captures;
}

function selectCaptures(index, runtime, focusNodes, policyRuntime) {
  const candidates = [];
  for (const node of focusNodes) {
    const blocked = index.ambiguities.some((ambiguity) =>
      nodeIsWithinAmbiguity(node, ambiguity, runtime.nodesById));
    for (const rule of policyRuntime.captureRules) {
      if (!rule.applies_to_node_kinds.includes(node.node_kind)
        || rule.required_source_roles.some((role) => !node.roles.includes(role))
        || (rule.blocked_by_m2_ambiguity && blocked)
        || !captureRuleIsBoundToNode(rule, node, index, policyRuntime)) continue;
      candidates.push(...captureNode(rule, node, runtime));
    }
  }
  const grouped = new Map();
  for (const capture of candidates) {
    const key = `${capture.sourceNode.node_occurrence_id}\0${capture.role}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(capture);
  }
  const selected = [];
  for (const captures of grouped.values()) {
    const priority = Math.max(...captures.map((capture) => capture.captureRule.priority));
    const seen = new Set();
    captures
      .filter((capture) => capture.captureRule.priority === priority)
      .sort((left, right) =>
        left.sourceSpan.start_byte - right.sourceSpan.start_byte
          || left.sourceSpan.end_byte - right.sourceSpan.end_byte
          || left.captureRule.rule_id.localeCompare(right.captureRule.rule_id)
          || left.captureRule.rule_version - right.captureRule.rule_version)
      .forEach((capture) => {
        const key = `${capture.role}\0${capture.value}\0${canonicalJson(capture.sourceSpan)}`;
        if (!seen.has(key)) {
          seen.add(key);
          selected.push(capture);
        }
      });
  }
  selected.sort((left, right) =>
    compareNodeSource(left.sourceNode, right.sourceNode)
      || CONTEXT_ROLES.indexOf(left.role) - CONTEXT_ROLES.indexOf(right.role)
      || left.sourceSpan.start_byte - right.sourceSpan.start_byte
      || left.captureRule.rule_id.localeCompare(right.captureRule.rule_id));
  return selected;
}

function validateCaptureFixtures(index, selected, policy) {
  for (const binding of policy.input_contract.capture_fixture_bindings) {
    if (binding.agreement_id !== index.source_binding.agreement_id) continue;
    if (binding.agreement_index_id !== index.agreement_index_id) {
      fail('EXPERIMENT_BINDING_MISMATCH', 'capture fixture index');
    }
    const actual = selected.filter((capture) =>
      capture.sourceNode.node_occurrence_id === binding.source_node_occurrence_id
        && capture.captureRule.rule_id === binding.rule_id
        && capture.captureRule.rule_version === binding.rule_version);
    if (actual.length !== binding.expected_captures.length) {
      fail('SOURCE_PROOF_MISMATCH', `capture fixture ${binding.rule_id}`);
    }
    for (const expected of binding.expected_captures) {
      const match = actual.find((capture) =>
        capture.captureName === expected.capture_name
          && capture.role === expected.role
          && capture.value === expected.value
          && canonicalJson(capture.sourceSpan) === canonicalJson(expected.span));
      if (!match) fail('SOURCE_PROOF_MISMATCH', `capture fixture ${binding.rule_id}`);
    }
  }
}

function nearestCommonAncestor(left, right, nodesById) {
  const leftAncestors = new Set();
  let current = left;
  while (current) {
    leftAncestors.add(current.node_occurrence_id);
    current = current.parent_node_occurrence_id === null
      ? null
      : nodesById.get(current.parent_node_occurrence_id);
  }
  current = right;
  while (current) {
    if (leftAncestors.has(current.node_occurrence_id)) return current;
    current = current.parent_node_occurrence_id === null
      ? null
      : nodesById.get(current.parent_node_occurrence_id);
  }
  return null;
}

function findConnectiveSpan(rule, node, runtime) {
  if (!rule.connectiveRuntime) return null;
  const view = sourceView(node, runtime);
  rule.connectiveRuntime.lastIndex = 0;
  const match = rule.connectiveRuntime.exec(view.text);
  if (!match) return null;
  const indices = match.indices?.groups?.connective || match.indices?.[0];
  return indices
    ? sourceSpanFromMatch(view, indices[0], indices[1], runtime, rule.rule_id)
    : null;
}

function treeDistance(source, target, nodesById) {
  const sourceDistance = new Map();
  let current = source;
  let distance = 0;
  while (current) {
    sourceDistance.set(current.node_occurrence_id, distance);
    current = current.parent_node_occurrence_id === null
      ? null
      : nodesById.get(current.parent_node_occurrence_id);
    distance += 1;
  }
  current = target;
  distance = 0;
  while (current) {
    if (sourceDistance.has(current.node_occurrence_id)) {
      return distance + sourceDistance.get(current.node_occurrence_id);
    }
    current = current.parent_node_occurrence_id === null
      ? null
      : nodesById.get(current.parent_node_occurrence_id);
    distance += 1;
  }
  return Number.MAX_SAFE_INTEGER;
}

function proofForEdge({ proofKind, sourceNode, targetNode, orderedTargets, connectiveSpan,
  sharedParent, runtime }) {
  return {
    proof_kind: proofKind,
    shared_parent_node_occurrence_id: sharedParent?.node_occurrence_id ?? null,
    source_node_kind: sourceNode.node_kind,
    target_node_kind: targetNode.node_kind,
    source_extent_span: normaliseSpan(sourceNode.extent_span, sourceNode.node_occurrence_id),
    target_extent_span: normaliseSpan(targetNode.extent_span, targetNode.node_occurrence_id),
    connective_span: connectiveSpan,
    ordered_target_node_occurrence_ids: [...orderedTargets],
  };
}

function createScopeEdge(capture, targetNode, rule, proof) {
  return withContentId(CONTEXT_SCOPE_EDGE_SCHEMA_VERSION, 'scope_edge_id', {
    edge_kind: rule.edge_kind,
    state: rule.edge_state || 'RESOLVED',
    governing_role: capture.role,
    source_node_occurrence_id: capture.sourceNode.node_occurrence_id,
    governing_source_span: capture.sourceSpan,
    target_node_occurrence_id: targetNode.node_occurrence_id,
    proof,
    rule_id: rule.rule_id,
    rule_version: rule.rule_version,
  });
}

function createFactDraft(capture, targetNode, edge, state, distance) {
  return {
    capture,
    targetNode,
    distance,
    unsigned: {
      role: capture.role,
      value: capture.value,
      state,
      source_node_occurrence_id: capture.sourceNode.node_occurrence_id,
      source_span: capture.sourceSpan,
      target_node_occurrence_id: targetNode.node_occurrence_id,
      scope_edge_id: edge.scope_edge_id,
      rule_id: capture.captureRule.rule_id,
      rule_version: capture.captureRule.rule_version,
      overridden_fact_ids: [],
      alternative_fact_ids: [],
    },
  };
}

function followingContiguousLimbs(sourceNode, runtime) {
  if (sourceNode.parent_node_occurrence_id === null) return [];
  const parent = runtime.nodesById.get(sourceNode.parent_node_occurrence_id);
  const position = parent.child_node_occurrence_ids.indexOf(sourceNode.node_occurrence_id);
  const result = [];
  for (let index = position + 1; index < parent.child_node_occurrence_ids.length; index += 1) {
    const node = runtime.nodesById.get(parent.child_node_occurrence_ids[index]);
    if (node.node_kind !== 'LIMB') break;
    result.push(node);
  }
  return result;
}

function nearestFocusAncestor(node, runtime, targetKinds) {
  let current = node;
  while (current.parent_node_occurrence_id !== null) {
    current = runtime.nodesById.get(current.parent_node_occurrence_id);
    if (runtime.focusById.has(current.node_occurrence_id)
      && targetKinds.includes(current.node_kind)) return current;
  }
  return null;
}

function genericScopeApplications(capture, runtime, policyRuntime) {
  const applications = [];
  const structuralTargets = [];
  for (const rule of policyRuntime.scopeRules) {
    if (rule.structural_relation === 'SAME_AUTHORED_NODE'
      || !rule.source_node_kinds.includes(capture.sourceNode.node_kind)
      || !rule.governing_roles.includes(capture.role)) continue;
    if (rule.structural_relation === 'PRECEDING_CHAPEAU_CONTIGUOUS_LIMB_SIBLINGS_SAME_PARENT') {
      const targets = followingContiguousLimbs(capture.sourceNode, runtime)
        .filter((node) => runtime.focusById.has(node.node_occurrence_id)
          && rule.target_node_kinds.includes(node.node_kind));
      structuralTargets.push(...targets);
      const connectiveSpan = findConnectiveSpan(rule, capture.sourceNode, runtime);
      if (targets.length > 0 && connectiveSpan) {
        applications.push({ rule, targets, orderedTargets: targets, connectiveSpan });
      }
    } else if (rule.structural_relation === 'STRICT_AUTHORED_ANCESTOR_DESCENDANT') {
      const targets = (runtime.descendantFocusByAncestor.get(
        capture.sourceNode.node_occurrence_id,
      ) || []).filter((node) => rule.target_node_kinds.includes(node.node_kind));
      structuralTargets.push(...targets);
      for (const target of targets) {
        applications.push({ rule, targets: [target], orderedTargets: [target], connectiveSpan: null });
      }
    } else if (rule.structural_relation === 'NEAREST_FOCUS_ANCESTOR_ONLY') {
      const target = nearestFocusAncestor(capture.sourceNode, runtime, rule.target_node_kinds);
      if (target) {
        structuralTargets.push(target);
        const connectiveSpan = findConnectiveSpan(rule, capture.sourceNode, runtime);
        if (connectiveSpan) {
          applications.push({ rule, targets: [target], orderedTargets: [target], connectiveSpan });
        }
      }
    }
  }
  return { applications, structuralTargets };
}

function compileFactsAndScopes(index, runtime, focusNodes, captures, policyRuntime) {
  const scopeEdges = [];
  const factDrafts = [];
  const noScopeSeeds = [];
  const scopeConflictSeeds = [];
  const fixtureEdgeCounts = new Map();
  const focusIds = new Set(focusNodes.map((node) => node.node_occurrence_id));
  for (const capture of captures) {
    const directRule = policyRuntime.scopeRules.find((rule) =>
      rule.structural_relation === 'SAME_AUTHORED_NODE'
        && rule.governing_roles.includes(capture.role));
    if (!directRule) fail('SOURCE_PROOF_MISMATCH', 'DIRECT_AT rule');
    const directProof = proofForEdge({
      proofKind: directRule.proof_kind,
      sourceNode: capture.sourceNode,
      targetNode: capture.sourceNode,
      orderedTargets: [capture.sourceNode.node_occurrence_id],
      connectiveSpan: null,
      sharedParent: null,
      runtime,
    });
    const directEdge = createScopeEdge(capture, capture.sourceNode, directRule, directProof);
    scopeEdges.push(directEdge);
    factDrafts.push(createFactDraft(
      capture,
      capture.sourceNode,
      directEdge,
      policyRuntime.policy.inheritance_contract.direct_state,
      0,
    ));

    const fixtures = policyRuntime.policy.fixture_scope_rules.filter((fixture) =>
      fixture.agreement_id === index.source_binding.agreement_id
        && fixture.agreement_index_id === index.agreement_index_id
        && fixture.source_node_occurrence_id === capture.sourceNode.node_occurrence_id
        && fixture.governing_roles.includes(capture.role));
    const fixtureSets = new Map();
    for (const fixture of fixtures) {
      const targetSetKey = fixture.target_node_occurrence_ids.join('\0');
      if (!fixtureSets.has(targetSetKey)) fixtureSets.set(targetSetKey, []);
      fixtureSets.get(targetSetKey).push(fixture);
    }
    const selectedFixtures = [...fixtureSets.values()].map((values) => [...values]
      .sort((left, right) => left.rule_id.localeCompare(right.rule_id)
        || left.rule_version - right.rule_version)[0]);
    const fixtureConflict = selectedFixtures.length > 1;
    const fixtureTargetIds = new Set();
    const fixtureConflictEntries = [];
    const fixtureConflictEdges = [];
    for (const fixture of selectedFixtures) {
      const sourceSpan = validateSpanAgainstSource(
        fixture.source_span,
        runtime.sourceBytes,
        fixture.rule_id,
      );
      if (canonicalJson(sourceSpan) !== canonicalJson(capture.sourceNode.extent_span)) {
        fail('SOURCE_PROOF_MISMATCH', fixture.rule_id);
      }
      for (let ordinal = 0; ordinal < fixture.target_node_occurrence_ids.length; ordinal += 1) {
        const targetId = fixture.target_node_occurrence_ids[ordinal];
        const target = runtime.nodesById.get(targetId);
        if (!target || !focusIds.has(targetId)
          || canonicalJson(target.extent_span) !== canonicalJson(fixture.target_spans[ordinal])) {
          fail('SOURCE_PROOF_MISMATCH', fixture.rule_id);
        }
        fixtureTargetIds.add(targetId);
        const connectiveSpan = fixture.connective_span === null
          ? null
          : validateSpanAgainstSource(
            fixture.connective_span,
            runtime.sourceBytes,
            fixture.rule_id,
          );
        if (connectiveSpan !== null
          && (connectiveSpan.start_byte < capture.sourceNode.extent_span.start_byte
            || connectiveSpan.end_byte > capture.sourceNode.extent_span.end_byte)) {
          fail('SOURCE_PROOF_MISMATCH', fixture.rule_id);
        }
        const sharedParent = nearestCommonAncestor(capture.sourceNode, target, runtime.nodesById);
        const proof = proofForEdge({
          proofKind: fixture.proof_kind,
          sourceNode: capture.sourceNode,
          targetNode: target,
          orderedTargets: fixture.target_node_occurrence_ids,
          connectiveSpan,
          sharedParent,
          runtime,
        });
        const edge = createScopeEdge(capture, target, {
          ...fixture,
          edge_state: fixtureConflict ? 'AMBIGUOUS' : 'RESOLVED',
        }, proof);
        scopeEdges.push(edge);
        if (fixtureConflict) {
          fixtureConflictEdges.push(edge);
          fixtureConflictEntries.push({ rule: fixture, target });
        } else {
          factDrafts.push(createFactDraft(
            capture,
            target,
            edge,
            policyRuntime.policy.inheritance_contract.inherited_state,
            treeDistance(capture.sourceNode, target, runtime.nodesById),
          ));
        }
        const key = fixtureKey(fixture);
        fixtureEdgeCounts.set(key, (fixtureEdgeCounts.get(key) || 0) + 1);
      }
    }
    if (fixtureConflict) {
      const selectedRule = selectedFixtures
        .sort((left, right) => left.rule_id.localeCompare(right.rule_id)
          || left.rule_version - right.rule_version)[0];
      scopeConflictSeeds.push({
        capture,
        selectedRule,
        edges: fixtureConflictEdges,
        targetNodeOccurrenceIds: [...new Set(fixtureConflictEntries
          .map((entry) => entry.target.node_occurrence_id))],
      });
    }

    const { applications, structuralTargets } = genericScopeApplications(
      capture,
      runtime,
      policyRuntime,
    );
    const byTarget = new Map();
    const applicationEntries = applications.map((application, ordinal) => ({
      ...application,
      applicationOrdinal: ordinal,
      targetSetKey: application.orderedTargets
        .map((target) => target.node_occurrence_id).join('\0'),
    }));
    for (const application of applicationEntries) {
      for (const target of application.targets) {
        if (fixtureTargetIds.has(target.node_occurrence_id)) continue;
        if (!byTarget.has(target.node_occurrence_id)) byTarget.set(target.node_occurrence_id, []);
        byTarget.get(target.node_occurrence_id).push({ ...application, target });
      }
    }
    const topCandidatesByTarget = new Map();
    for (const [targetId, candidates] of byTarget) {
      const priority = Math.max(...candidates.map((entry) => entry.rule.priority));
      topCandidatesByTarget.set(targetId, candidates
        .filter((entry) => entry.rule.priority === priority)
        .sort((left, right) => left.rule.rule_id.localeCompare(right.rule.rule_id)
          || left.rule.rule_version - right.rule.rule_version
          || left.applicationOrdinal - right.applicationOrdinal));
    }
    const competingApplicationOrdinals = new Set();
    const adjacency = new Map();
    for (const candidates of topCandidatesByTarget.values()) {
      if (new Set(candidates.map((entry) => entry.targetSetKey)).size < 2) continue;
      for (const candidate of candidates) {
        competingApplicationOrdinals.add(candidate.applicationOrdinal);
        if (!adjacency.has(candidate.applicationOrdinal)) {
          adjacency.set(candidate.applicationOrdinal, new Set());
        }
      }
      for (const left of candidates) {
        for (const right of candidates) {
          if (left.targetSetKey !== right.targetSetKey) {
            adjacency.get(left.applicationOrdinal).add(right.applicationOrdinal);
          }
        }
      }
    }
    const conflictComponents = [];
    const remainingApplications = new Set(competingApplicationOrdinals);
    while (remainingApplications.size > 0) {
      const first = remainingApplications.values().next().value;
      remainingApplications.delete(first);
      const component = new Set();
      const queue = [first];
      while (queue.length > 0) {
        const current = queue.shift();
        component.add(current);
        for (const next of adjacency.get(current) || []) {
          if (remainingApplications.delete(next)) queue.push(next);
        }
      }
      conflictComponents.push(component);
    }
    const conflictingTargets = new Set();
    const buildGenericEdge = (entry, state) => {
      const sharedParent = entry.rule.structural_relation
        === 'PRECEDING_CHAPEAU_CONTIGUOUS_LIMB_SIBLINGS_SAME_PARENT'
        ? runtime.nodesById.get(capture.sourceNode.parent_node_occurrence_id)
        : entry.rule.structural_relation === 'STRICT_AUTHORED_ANCESTOR_DESCENDANT'
          ? runtime.nodesById.get(capture.sourceNode.parent_node_occurrence_id) || null
          : nearestCommonAncestor(capture.sourceNode, entry.target, runtime.nodesById);
      const proof = proofForEdge({
        proofKind: entry.rule.proof_kind,
        sourceNode: capture.sourceNode,
        targetNode: entry.target,
        orderedTargets: entry.orderedTargets.map((node) => node.node_occurrence_id),
        connectiveSpan: entry.connectiveSpan,
        sharedParent,
        runtime,
      });
      return createScopeEdge(capture, entry.target, {
        ...entry.rule,
        edge_state: state,
      }, proof);
    };
    for (const component of conflictComponents) {
      const entries = [...topCandidatesByTarget.values()]
        .flat()
        .filter((entry) => component.has(entry.applicationOrdinal));
      const edges = [];
      const seen = new Set();
      for (const entry of entries) {
        const key = `${entry.applicationOrdinal}\0${entry.target.node_occurrence_id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        conflictingTargets.add(entry.target.node_occurrence_id);
        const edge = buildGenericEdge(entry, 'AMBIGUOUS');
        scopeEdges.push(edge);
        edges.push(edge);
      }
      scopeConflictSeeds.push({
        capture,
        selectedRule: entries
          .map((entry) => entry.rule)
          .sort((left, right) => right.priority - left.priority
            || left.rule_id.localeCompare(right.rule_id)
            || left.rule_version - right.rule_version)[0],
        edges,
        targetNodeOccurrenceIds: [...new Set(entries
          .map((entry) => entry.target.node_occurrence_id))],
      });
    }
    for (const [targetId, candidates] of topCandidatesByTarget) {
      if (conflictingTargets.has(targetId)) continue;
      const selected = candidates[0];
      const edge = buildGenericEdge(selected, selected.rule.edge_state);
      scopeEdges.push(edge);
      factDrafts.push(createFactDraft(
        capture,
        selected.target,
        edge,
        policyRuntime.policy.inheritance_contract.inherited_state,
        treeDistance(capture.sourceNode, selected.target, runtime.nodesById),
      ));
    }
    const unprovedTargets = structuralTargets.filter((target) =>
      !fixtureTargetIds.has(target.node_occurrence_id)
        && !byTarget.has(target.node_occurrence_id));
    if (unprovedTargets.length > 0) noScopeSeeds.push({ capture, targets: unprovedTargets });
  }
  for (const fixture of policyRuntime.policy.fixture_scope_rules) {
    if (fixture.agreement_id !== index.source_binding.agreement_id) continue;
    if ((fixtureEdgeCounts.get(fixtureKey(fixture)) || 0) !== fixture.expected_edge_count) {
      fail('SOURCE_PROOF_MISMATCH', `fixture edge count ${fixture.rule_id}`);
    }
  }
  return { scopeEdges, factDrafts, noScopeSeeds, scopeConflictSeeds };
}

function compareFactDrafts(left, right, runtime, policy) {
  const leftFocus = runtime.focusById.get(left.targetNode.node_occurrence_id).ordinal;
  const rightFocus = runtime.focusById.get(right.targetNode.node_occurrence_id).ordinal;
  const leftRole = policy.context_role_order.indexOf(left.capture.role);
  const rightRole = policy.context_role_order.indexOf(right.capture.role);
  return leftFocus - rightFocus
    || leftRole - rightRole
    || left.capture.sourceSpan.start_byte - right.capture.sourceSpan.start_byte
    || left.capture.sourceSpan.end_byte - right.capture.sourceSpan.end_byte
    || left.capture.captureRule.rule_id.localeCompare(right.capture.captureRule.rule_id)
    || left.capture.captureRule.rule_version - right.capture.captureRule.rule_version
    || left.capture.value.localeCompare(right.capture.value)
    || left.unsigned.scope_edge_id.localeCompare(right.unsigned.scope_edge_id);
}

function overlapConnectedComponents(drafts) {
  const remaining = new Set(drafts);
  const components = [];
  while (remaining.size > 0) {
    const first = remaining.values().next().value;
    remaining.delete(first);
    const component = [];
    const queue = [first];
    while (queue.length > 0) {
      const current = queue.shift();
      component.push(current);
      for (const candidate of [...remaining]) {
        if (current.capture.sourceSpan.start_byte < candidate.capture.sourceSpan.end_byte
          && current.capture.sourceSpan.end_byte > candidate.capture.sourceSpan.start_byte) {
          remaining.delete(candidate);
          queue.push(candidate);
        }
      }
    }
    components.push(component);
  }
  return components;
}

function resolveFacts(factDrafts, runtime, policy) {
  const conflictContract = policy.inheritance_contract.capture_conflict_construction;
  const overrideContract = policy.inheritance_contract.override_construction;
  const orderedDrafts = [...factDrafts]
    .sort((left, right) => compareFactDrafts(left, right, runtime, policy));
  const byConflictPartition = new Map();
  for (const draft of orderedDrafts) {
    const tier = draft.unsigned.state === policy.inheritance_contract.direct_state
      ? policy.inheritance_contract.precedence[0]
      : `${policy.inheritance_contract.precedence[1]}:${draft.distance}`;
    const key = [
      draft.targetNode.node_occurrence_id,
      draft.capture.role,
      tier,
      draft.capture.sourceNode.node_occurrence_id,
    ].join('\0');
    if (!byConflictPartition.has(key)) byConflictPartition.set(key, []);
    byConflictPartition.get(key).push(draft);
  }
  const conflictComponents = [];
  const ambiguousDrafts = new Set();
  for (const partition of byConflictPartition.values()) {
    for (const component of overlapConnectedComponents(partition)) {
      const ruleKeys = new Set(component.map((draft) => ruleKey(draft.capture.captureRule)));
      const valueSpans = new Set(component.map((draft) => [
        draft.capture.value,
        draft.capture.sourceSpan.start_byte,
        draft.capture.sourceSpan.end_byte,
      ].join('\0')));
      if (ruleKeys.size < 2 || valueSpans.size < 2) continue;
      const ordered = component
        .sort((left, right) => compareFactDrafts(left, right, runtime, policy));
      for (const draft of ordered) ambiguousDrafts.add(draft);
      conflictComponents.push(ordered);
    }
  }

  const factsByDraft = new Map();
  const conflictSeeds = [];
  for (const component of conflictComponents) {
    const earlierIds = [];
    const componentFacts = [];
    for (const draft of component) {
      const fact = withContentId(CONTEXT_FACT_SCHEMA_VERSION, 'context_fact_id', {
        ...draft.unsigned,
        state: conflictContract.conflicting_fact_state,
        overridden_fact_ids: [...conflictContract.overridden_fact_ids],
        alternative_fact_ids: [...earlierIds],
      });
      factsByDraft.set(draft, fact);
      componentFacts.push(fact);
      earlierIds.push(fact.context_fact_id);
    }
    conflictSeeds.push({ drafts: component, facts: componentFacts });
  }

  for (const draft of orderedDrafts.filter((entry) => !ambiguousDrafts.has(entry))) {
    factsByDraft.set(draft, withContentId(CONTEXT_FACT_SCHEMA_VERSION, 'context_fact_id', {
      ...draft.unsigned,
      overridden_fact_ids: [
        ...overrideContract.non_overridden_fact_overridden_fact_ids,
      ],
      alternative_fact_ids: [
        ...overrideContract.non_ambiguous_fact_alternative_fact_ids,
      ],
    }));
  }
  if (factsByDraft.size !== factDrafts.length) {
    fail('MEMBER_SCHEMA_MISMATCH', 'fact resolution completeness');
  }
  return {
    facts: orderedDrafts.map((draft) => factsByDraft.get(draft)),
    conflictSeeds,
  };
}

function isStrictDescendant(node, ancestorId, nodesById) {
  let current = node;
  while (current.parent_node_occurrence_id !== null) {
    if (current.parent_node_occurrence_id === ancestorId) return true;
    current = nodesById.get(current.parent_node_occurrence_id);
    if (!current) return false;
  }
  return false;
}

function ownerToFocus(ownerId, runtime, policy) {
  if (runtime.focusById.has(ownerId)) return ownerId;
  let current = runtime.nodesById.get(ownerId);
  if (!current) fail('DANGLING_ID_REFERENCE', ownerId);
  while (current && current.parent_node_occurrence_id !== null) {
    current = runtime.nodesById.get(current.parent_node_occurrence_id);
    if (runtime.focusById.has(current.node_occurrence_id)) return current.node_occurrence_id;
  }
  const owner = runtime.nodesById.get(ownerId);
  const construction = policy.input_contract.residual_attachment
    .first_following_focus_within_nearest_structural_container;
  const permittedKinds = new Set(construction.permitted_container_kinds);
  current = owner.parent_node_occurrence_id === null
    ? null
    : runtime.nodesById.get(owner.parent_node_occurrence_id);
  while (current && !permittedKinds.has(current.node_kind)) {
    current = current.parent_node_occurrence_id === null
      ? null
      : runtime.nodesById.get(current.parent_node_occurrence_id);
  }
  if (!current) fail('SOURCE_PROOF_MISMATCH', `owner focus ${ownerId}`);
  const containerId = current.node_occurrence_id;
  const descendants = [...runtime.focusById.values()]
    .map((entry) => entry.node)
    .filter((node) => isStrictDescendant(node, containerId, runtime.nodesById)
      && node.extent_span.start_byte >= owner.extent_span.end_byte)
    .sort(compareNodeSource);
  if (descendants.length > 0) return descendants[0].node_occurrence_id;
  fail('SOURCE_PROOF_MISMATCH', `owner focus ${ownerId}`);
}

function buildReferenceEdges(index, runtime, policy) {
  const contract = policy.reference_resolution_contract;
  const nodesByReference = new Map();
  for (const node of index.nodes) {
    if (node.reference === null || node.reference === undefined) continue;
    if (!nodesByReference.has(node.reference)) nodesByReference.set(node.reference, []);
    nodesByReference.get(node.reference).push(node);
  }
  for (const nodes of nodesByReference.values()) nodes.sort(compareNodeSource);
  const annotations = index.annotations
    .filter((annotation) => annotation.annotation_kind === 'SECTION_REFERENCE')
    .sort((left, right) => compareSpanSource(left.span, right.span)
      || left.annotation_occurrence_id.localeCompare(right.annotation_occurrence_id));
  const edges = annotations.map((annotation) => {
    const sourceSpan = validateSpanAgainstSource(
      annotation.span,
      runtime.sourceBytes,
      annotation.annotation_occurrence_id,
    );
    const candidates = nodesByReference.get(annotation.value) || [];
    const cardinality = candidates.length === 1 ? 'one' : candidates.length === 0 ? 'zero' : 'multiple';
    return withContentId(CONTEXT_REFERENCE_EDGE_SCHEMA_VERSION, 'reference_edge_id', {
      source_annotation_occurrence_id: annotation.annotation_occurrence_id,
      owner_node_occurrence_id: annotation.owner_node_occurrence_id,
      source_span: sourceSpan,
      raw_text: utf8Slice(runtime.sourceText, sourceSpan.start_byte, sourceSpan.end_byte),
      normalised_reference: annotation.value,
      state: contract.state_by_candidate_count[cardinality],
      target_node_occurrence_ids: candidates.map((node) => node.node_occurrence_id),
      selected_target_node_occurrence_id: candidates.length === 1
        ? candidates[0].node_occurrence_id
        : null,
      reason_code: contract.reason_by_candidate_count[cardinality],
      rule_id: contract.rule_id,
      rule_version: contract.rule_version,
    });
  });
  const expected = contract.per_agreement_expected.find((entry) =>
    entry.agreement_id === index.source_binding.agreement_id);
  const measured = {
    annotation_count: edges.length,
    resolved_unique: edges.filter((edge) => edge.state === 'RESOLVED').length,
    unresolved_no_target: edges.filter((edge) => edge.state === 'UNRESOLVED').length,
    ambiguous_multiple_targets: edges.filter((edge) => edge.state === 'AMBIGUOUS').length,
  };
  if (!expected || Object.entries(measured).some(([field, value]) => expected[field] !== value)) {
    fail('REFERENCE_INVENTORY_MISMATCH', measured);
  }
  return edges;
}

function buildDefinitionEdges(index, runtime, policy) {
  const contract = policy.definition_resolution_contract;
  const definitionsByTerm = new Map();
  for (const annotation of index.annotations) {
    if (annotation.annotation_kind !== 'DEFINED_TERM_DEFINITION') continue;
    if (!definitionsByTerm.has(annotation.value)) definitionsByTerm.set(annotation.value, []);
    definitionsByTerm.get(annotation.value).push(annotation);
  }
  for (const definitions of definitionsByTerm.values()) {
    definitions.sort((left, right) => compareSpanSource(left.span, right.span)
      || left.annotation_occurrence_id.localeCompare(right.annotation_occurrence_id));
  }
  const uses = index.annotations
    .filter((annotation) => annotation.annotation_kind === 'DEFINED_TERM_USE')
    .sort((left, right) => compareSpanSource(left.span, right.span)
      || left.annotation_occurrence_id.localeCompare(right.annotation_occurrence_id));
  const edges = uses.map((annotation) => {
    const sourceSpan = validateSpanAgainstSource(
      annotation.span,
      runtime.sourceBytes,
      annotation.annotation_occurrence_id,
    );
    const candidates = definitionsByTerm.get(annotation.value) || [];
    const cardinality = candidates.length === 1 ? 'one' : candidates.length === 0 ? 'zero' : 'multiple';
    return withContentId(CONTEXT_DEFINITION_EDGE_SCHEMA_VERSION, 'definition_edge_id', {
      source_annotation_occurrence_id: annotation.annotation_occurrence_id,
      owner_node_occurrence_id: annotation.owner_node_occurrence_id,
      source_span: sourceSpan,
      raw_text: utf8Slice(runtime.sourceText, sourceSpan.start_byte, sourceSpan.end_byte),
      term: annotation.value,
      state: contract.state_by_candidate_count[cardinality],
      target_definition_annotation_occurrence_ids: candidates
        .map((candidate) => candidate.annotation_occurrence_id),
      target_owner_node_occurrence_ids: candidates
        .map((candidate) => candidate.owner_node_occurrence_id),
      selected_definition_annotation_occurrence_id: candidates.length === 1
        ? candidates[0].annotation_occurrence_id
        : null,
      reason_code: contract.reason_by_candidate_count[cardinality],
      rule_id: contract.rule_id,
      rule_version: contract.rule_version,
    });
  });
  const expected = contract.per_agreement_expected.find((entry) =>
    entry.agreement_id === index.source_binding.agreement_id);
  const measured = {
    definitions: index.annotations.filter((entry) =>
      entry.annotation_kind === 'DEFINED_TERM_DEFINITION').length,
    uses: edges.length,
    resolved_unique: edges.filter((edge) => edge.state === 'RESOLVED').length,
    ambiguous_multiple: edges.filter((edge) => edge.state === 'AMBIGUOUS').length,
  };
  if (!expected || Object.entries(measured).some(([field, value]) => expected[field] !== value)) {
    fail('DEFINITION_INVENTORY_MISMATCH', measured);
  }
  return { edges, definitionsByTerm };
}

function topologyEndpoint(label, span, node, index, definitionsByTerm) {
  const definitions = definitionsByTerm.get(label) || [];
  if (definitions.length > 1) return null;
  if (definitions.length === 1) {
    const definition = definitions[0];
    return {
      entity_id: contentId(CONTEXT_TOPOLOGY_ENTITY_SCHEMA_VERSION, {
        agreement_id: index.source_binding.agreement_id,
        definition_annotation_occurrence_id: definition.annotation_occurrence_id,
      }),
      entity_kind: 'DEFINED_ENTITY',
      canonical_label: label,
      definition_annotation_occurrence_id: definition.annotation_occurrence_id,
      source_node_occurrence_id: null,
      source_span: null,
    };
  }
  return {
    entity_id: contentId(CONTEXT_TOPOLOGY_ENTITY_SCHEMA_VERSION, {
      agreement_id: index.source_binding.agreement_id,
      source_node_occurrence_id: node.node_occurrence_id,
      source_span: span,
    }),
    entity_kind: 'SOURCE_LOCAL_ENTITY',
    canonical_label: label,
    definition_annotation_occurrence_id: null,
    source_node_occurrence_id: node.node_occurrence_id,
    source_span: span,
  };
}

function spansOverlap(left, right) {
  return left.start_byte < right.end_byte && left.end_byte > right.start_byte;
}

function topologyCandidatesAlign(left, right) {
  if (left.rule.directed) {
    return spansOverlap(left.sourceCaptureSpan, right.sourceCaptureSpan)
      && spansOverlap(left.targetCaptureSpan, right.targetCaptureSpan);
  }
  return (spansOverlap(left.sourceCaptureSpan, right.sourceCaptureSpan)
      && spansOverlap(left.targetCaptureSpan, right.targetCaptureSpan))
    || (spansOverlap(left.sourceCaptureSpan, right.targetCaptureSpan)
      && spansOverlap(left.targetCaptureSpan, right.sourceCaptureSpan));
}

function topologyAlignmentComponents(candidates) {
  const remaining = new Set(candidates);
  const components = [];
  while (remaining.size > 0) {
    const first = remaining.values().next().value;
    remaining.delete(first);
    const component = [];
    const queue = [first];
    while (queue.length > 0) {
      const current = queue.shift();
      component.push(current);
      for (const candidate of [...remaining]) {
        if (topologyCandidatesAlign(current, candidate)) {
          remaining.delete(candidate);
          queue.push(candidate);
        }
      }
    }
    components.push(component);
  }
  return components;
}

function topologyReadingIdentity(candidate) {
  return canonicalJson({
    source_endpoint_entity_id: candidate.sourceEndpoint.entity_id,
    target_endpoint_entity_id: candidate.targetEndpoint.entity_id,
    temporal_scope: candidate.temporalScope,
  });
}

function topologyRelationship(candidate, state, reasonCode) {
  return withContentId(
    CONTEXT_SEMANTIC_RELATIONSHIP_SCHEMA_VERSION,
    'semantic_relationship_id',
    {
      relationship_type: candidate.rule.relationship_type,
      state,
      directed: candidate.rule.directed,
      source_endpoint: candidate.sourceEndpoint,
      target_endpoint: candidate.targetEndpoint,
      temporal_scope: candidate.temporalScope,
      source_node_occurrence_ids: [candidate.node.node_occurrence_id],
      source_spans: candidate.sourceSpans,
      reason_code: reasonCode,
      rule_id: candidate.rule.rule_id,
      rule_version: candidate.rule.rule_version,
    },
  );
}

function buildTopology(index, runtime, focusNodes, definitionsByTerm, policyRuntime) {
  const candidates = [];
  const unavailable = [];
  const fixture = policyRuntime.policy.input_contract.topology_fixture;
  const construction = policyRuntime.policy.input_contract.topology_record_construction;
  for (const node of focusNodes) {
    for (const rule of policyRuntime.topologyRules) {
      if (!rule.applies_to_node_kinds.includes(node.node_kind)) continue;
      const view = sourceView(node, runtime);
      rule.patternRuntime.lastIndex = 0;
      const match = rule.patternRuntime.exec(view.text);
      if (!match || (rule.execution.match_mode === 'FULL' && match[0] !== view.text)) continue;
      const sourceIndices = match.indices?.groups?.[rule.source_endpoint_capture];
      const targetIndices = match.indices?.groups?.[rule.target_endpoint_capture];
      if (!sourceIndices || !targetIndices) fail('SOURCE_PROOF_MISMATCH', rule.rule_id);
      const sourceSpan = sourceSpanFromMatch(
        view,
        sourceIndices[0],
        sourceIndices[1],
        runtime,
        rule.rule_id,
      );
      const targetSpan = sourceSpanFromMatch(
        view,
        targetIndices[0],
        targetIndices[1],
        runtime,
        rule.rule_id,
      );
      if (sourceSpan === null || targetSpan === null) continue;
      const sourceLabel = utf8Slice(runtime.sourceText, sourceSpan.start_byte, sourceSpan.end_byte);
      const targetLabel = utf8Slice(runtime.sourceText, targetSpan.start_byte, targetSpan.end_byte);
      let sourceEndpoint = topologyEndpoint(
        sourceLabel,
        sourceSpan,
        node,
        index,
        definitionsByTerm,
      );
      let targetEndpoint = topologyEndpoint(
        targetLabel,
        targetSpan,
        node,
        index,
        definitionsByTerm,
      );
      let sourceSpans = [sourceSpan, targetSpan].sort(compareSpanSource);
      let temporalScope = structuredClone(construction.unstated_temporal_scope);
      if (fixture.agreement_id === index.source_binding.agreement_id
        && fixture.source_node_occurrence_id === node.node_occurrence_id
        && fixture.rule_ids.includes(rule.rule_id)) {
        sourceEndpoint = structuredClone(fixture.source_endpoint);
        const targetOrdinal = fixture.rule_ids.indexOf(rule.rule_id);
        targetEndpoint = structuredClone(fixture.target_endpoints[targetOrdinal]);
        sourceSpans = structuredClone(fixture.source_spans);
        temporalScope = structuredClone(fixture.temporal_scope);
      }
      if (!sourceEndpoint || !targetEndpoint) {
        unavailable.push({ rule, node, sourceSpans });
        continue;
      }
      if (!rule.directed && sourceEndpoint.entity_id > targetEndpoint.entity_id) {
        [sourceEndpoint, targetEndpoint] = [targetEndpoint, sourceEndpoint];
      }
      candidates.push({
        rule,
        node,
        sourceCaptureSpan: sourceSpan,
        targetCaptureSpan: targetSpan,
        sourceEndpoint,
        targetEndpoint,
        temporalScope,
        sourceSpans,
      });
    }
  }
  const partitions = new Map();
  for (const candidate of candidates) {
    const key = [
      candidate.node.node_occurrence_id,
      candidate.rule.relationship_type,
      candidate.rule.directed,
    ].join('\0');
    if (!partitions.has(key)) partitions.set(key, []);
    partitions.get(key).push(candidate);
  }
  const relationships = [];
  const conflictSeeds = [];
  for (const partition of partitions.values()) {
    for (const initialComponent of topologyAlignmentComponents(partition)) {
      const highestPriority = Math.max(...initialComponent
        .map((candidate) => candidate.rule.priority));
      const retained = initialComponent.filter((candidate) =>
        candidate.rule.priority === highestPriority);
      for (const component of topologyAlignmentComponents(retained)) {
        const byReading = new Map();
        for (const candidate of component) {
          const key = topologyReadingIdentity(candidate);
          if (!byReading.has(key)) byReading.set(key, []);
          byReading.get(key).push(candidate);
        }
        const selected = [...byReading.values()].map((values) => [...values]
          .sort((left, right) => left.rule.rule_id.localeCompare(right.rule.rule_id)
            || left.rule.rule_version - right.rule.rule_version)[0]);
        if (selected.length === 1) {
          const candidate = selected[0];
          relationships.push(topologyRelationship(
            candidate,
            construction.resolved_relationship_state,
            construction.resolved_relationship_reason_by_temporal_scope_state[
              candidate.temporalScope.state
            ],
          ));
          continue;
        }
        const conflicting = selected.map((candidate) => topologyRelationship(
          candidate,
          construction.conflict_construction.conflicting_relationship_state,
          construction.conflict_construction.conflicting_relationship_reason_code,
        ));
        relationships.push(...conflicting);
        conflictSeeds.push({ candidates: selected, relationships: conflicting });
      }
    }
  }
  if (fixture.agreement_id === index.source_binding.agreement_id) {
    const fixtureRelationships = relationships.filter((relationship) =>
      fixture.rule_ids.includes(relationship.rule_id)
        && relationship.source_node_occurrence_ids.includes(fixture.source_node_occurrence_id));
    if (fixtureRelationships.length !== fixture.expected_relationship_count) {
      fail('SOURCE_PROOF_MISMATCH', 'topology fixture relationship count');
    }
  }
  return { relationships, unavailable, conflictSeeds };
}

function buildM2Ambiguities(index, runtime, focusNodes, facts, scopeEdges, policy) {
  const result = [];
  for (const predecessor of index.ambiguities) {
    const targetIds = focusNodes
      .filter((node) => nodeIsAmbiguityTarget(node, predecessor, runtime.nodesById))
      .map((node) => node.node_occurrence_id);
    const blocked = [
      ...facts.filter((fact) => {
        const source = runtime.nodesById.get(fact.source_node_occurrence_id);
        const target = runtime.nodesById.get(fact.target_node_occurrence_id);
        return nodeIsWithinAmbiguity(source, predecessor, runtime.nodesById)
          || nodeIsWithinAmbiguity(target, predecessor, runtime.nodesById);
      }).map((fact) => fact.context_fact_id),
      ...scopeEdges.filter((edge) => {
        const source = runtime.nodesById.get(edge.source_node_occurrence_id);
        const target = runtime.nodesById.get(edge.target_node_occurrence_id);
        return nodeIsWithinAmbiguity(source, predecessor, runtime.nodesById)
          || nodeIsWithinAmbiguity(target, predecessor, runtime.nodesById);
      }).map((edge) => edge.scope_edge_id),
    ];
    const sourceIds = [...predecessor.node_occurrence_ids]
      .sort((left, right) => compareNodeSource(runtime.nodesById.get(left), runtime.nodesById.get(right)));
    result.push(withContentId(CONTEXT_AMBIGUITY_SCHEMA_VERSION, 'ambiguity_id', {
      ambiguity_type: 'M2_STRUCTURE_AMBIGUITY',
      state: 'CARRIED_FORWARD',
      reason_codes: ['M2_STRUCTURE_AMBIGUITY'],
      source_node_occurrence_ids: sourceIds,
      source_spans: [normaliseSpan(predecessor.span, predecessor.ambiguity_id)],
      target_node_occurrence_ids: targetIds,
      affected_roles: [...policy.context_role_order],
      alternative_fact_ids: [],
      alternative_scope_edge_ids: [],
      alternative_target_ids: [],
      blocked_dependency_ids: blocked,
      predecessor_ambiguity_id: predecessor.ambiguity_id,
      predecessor_detail_digest: sha256Hex(Buffer.from(canonicalJson(predecessor.detail), 'utf8')),
      rule_id: policy.inheritance_contract.ambiguity_carry.rule_id,
      rule_version: policy.inheritance_contract.ambiguity_carry.rule_version,
    }));
  }
  if (result.length !== index.ambiguities.length) fail('M2_AMBIGUITY_INVENTORY_MISMATCH', result.length);
  return result;
}

function buildCaptureConflictAmbiguities(conflictSeeds, facts, runtime, policy) {
  const factOrder = new Map(facts.map((fact, ordinal) => [fact.context_fact_id, ordinal]));
  const construction = policy.output_contract.member_construction
    .ambiguity_by_type.CONTEXT_CAPTURE_CONFLICT;
  return conflictSeeds.map((seed) => {
    const orderedFacts = [...seed.facts].sort((left, right) =>
      factOrder.get(left.context_fact_id) - factOrder.get(right.context_fact_id));
    for (let ordinal = 0; ordinal < orderedFacts.length; ordinal += 1) {
      const expectedAlternatives = orderedFacts.slice(0, ordinal)
        .map((fact) => fact.context_fact_id);
      if (!arraysEqual(orderedFacts[ordinal].alternative_fact_ids, expectedAlternatives)) {
        fail('OUTPUT_ORDER_MISMATCH', 'capture conflict alternative facts');
      }
    }
    const rules = seed.drafts.map((draft) => draft.capture.captureRule);
    const highestPriority = Math.max(...rules.map((rule) => rule.priority));
    const selectedRule = rules
      .filter((rule) => rule.priority === highestPriority)
      .sort((left, right) => left.rule_id.localeCompare(right.rule_id)
        || left.rule_version - right.rule_version)[0];
    const sourceIds = [...new Set(seed.drafts
      .map((draft) => draft.capture.sourceNode.node_occurrence_id))]
      .sort((left, right) => compareNodeSource(
        runtime.nodesById.get(left),
        runtime.nodesById.get(right),
      ));
    const sourceSpans = orderedFacts.map((fact) => fact.source_span)
      .sort(compareSpanSource);
    return withContentId(CONTEXT_AMBIGUITY_SCHEMA_VERSION, 'ambiguity_id', {
      ambiguity_type: 'CONTEXT_CAPTURE_CONFLICT',
      state: construction.state,
      reason_codes: [...construction.reason_codes],
      source_node_occurrence_ids: sourceIds,
      source_spans: sourceSpans,
      target_node_occurrence_ids: [orderedFacts[0].target_node_occurrence_id],
      affected_roles: [orderedFacts[0].role],
      alternative_fact_ids: orderedFacts.map((fact) => fact.context_fact_id),
      alternative_scope_edge_ids: [...construction.alternative_scope_edge_ids],
      alternative_target_ids: [...construction.alternative_target_ids],
      blocked_dependency_ids: orderedFacts.map((fact) => fact.context_fact_id),
      predecessor_ambiguity_id: null,
      predecessor_detail_digest: null,
      rule_id: selectedRule.rule_id,
      rule_version: selectedRule.rule_version,
    });
  });
}

function buildScopeConflictAmbiguities(conflictSeeds, scopeEdges, runtime, policy) {
  const edgeOrder = new Map(scopeEdges.map((edge, ordinal) => [edge.scope_edge_id, ordinal]));
  const focusOrder = new Map([...runtime.focusById.entries()]
    .map(([id, entry]) => [id, entry.ordinal]));
  const construction = policy.output_contract.member_construction
    .ambiguity_by_type.MULTIPLE_SCOPE_READINGS;
  return conflictSeeds.map((seed) => {
    const edges = [...seed.edges].sort((left, right) =>
      edgeOrder.get(left.scope_edge_id) - edgeOrder.get(right.scope_edge_id));
    const targetIds = [...new Set(seed.targetNodeOccurrenceIds)]
      .sort((left, right) => focusOrder.get(left) - focusOrder.get(right));
    return withContentId(CONTEXT_AMBIGUITY_SCHEMA_VERSION, 'ambiguity_id', {
      ambiguity_type: 'MULTIPLE_SCOPE_READINGS',
      state: construction.state,
      reason_codes: [...construction.reason_codes],
      source_node_occurrence_ids: [seed.capture.sourceNode.node_occurrence_id],
      source_spans: [seed.capture.sourceSpan],
      target_node_occurrence_ids: targetIds,
      affected_roles: [seed.capture.role],
      alternative_fact_ids: [...construction.alternative_fact_ids],
      alternative_scope_edge_ids: edges.map((edge) => edge.scope_edge_id),
      alternative_target_ids: [...targetIds],
      blocked_dependency_ids: [],
      predecessor_ambiguity_id: null,
      predecessor_detail_digest: null,
      rule_id: seed.selectedRule.rule_id,
      rule_version: seed.selectedRule.rule_version,
    });
  });
}

function buildTopologyConflictAmbiguities(conflictSeeds, relationships, runtime, policy) {
  const relationshipOrder = new Map(relationships
    .map((relationship, ordinal) => [relationship.semantic_relationship_id, ordinal]));
  const construction = policy.input_contract.topology_record_construction
    .conflict_construction.ambiguity;
  return conflictSeeds.map((seed) => {
    const conflicting = [...seed.relationships].sort((left, right) =>
      relationshipOrder.get(left.semantic_relationship_id)
        - relationshipOrder.get(right.semantic_relationship_id));
    const sourceIds = [...new Set(conflicting
      .flatMap((relationship) => relationship.source_node_occurrence_ids))]
      .sort((left, right) => compareNodeSource(
        runtime.nodesById.get(left),
        runtime.nodesById.get(right),
      ));
    const spansByValue = new Map();
    for (const relationship of conflicting) {
      for (const span of relationship.source_spans) {
        spansByValue.set(canonicalJson(span), span);
      }
    }
    const sourceSpans = [...spansByValue.values()].sort(compareSpanSource);
    const endpointIds = [...new Set(conflicting.flatMap((relationship) => [
      relationship.source_endpoint.entity_id,
      relationship.target_endpoint.entity_id,
    ]))].sort((left, right) => left.localeCompare(right));
    const highestPriority = Math.max(...seed.candidates
      .map((candidate) => candidate.rule.priority));
    const selectedRule = seed.candidates
      .filter((candidate) => candidate.rule.priority === highestPriority)
      .map((candidate) => candidate.rule)
      .sort((left, right) => left.rule_id.localeCompare(right.rule_id)
        || left.rule_version - right.rule_version)[0];
    return withContentId(CONTEXT_AMBIGUITY_SCHEMA_VERSION, 'ambiguity_id', {
      ambiguity_type: construction.ambiguity_type,
      state: construction.state,
      reason_codes: [...construction.reason_codes],
      source_node_occurrence_ids: sourceIds,
      source_spans: sourceSpans,
      target_node_occurrence_ids: [],
      affected_roles: [],
      alternative_fact_ids: [],
      alternative_scope_edge_ids: [],
      alternative_target_ids: endpointIds,
      blocked_dependency_ids: conflicting
        .map((relationship) => relationship.semantic_relationship_id),
      predecessor_ambiguity_id: null,
      predecessor_detail_digest: null,
      rule_id: selectedRule.rule_id,
      rule_version: selectedRule.rule_version,
    });
  });
}

function makeResidual(unsigned) {
  return withContentId(CONTEXT_RESIDUAL_SCHEMA_VERSION, 'residual_id', unsigned);
}

function buildResiduals({ index, runtime, focusNodes, facts, noScopeSeeds, referenceEdges,
  definitionEdges, relationships, topologyUnavailable, policy }) {
  const residuals = [];
  const factsByTarget = new Set(facts.map((fact) => fact.target_node_occurrence_id));
  for (const focus of focusNodes) {
    if (factsByTarget.has(focus.node_occurrence_id)) continue;
    const applicableRules = policy.capture_rules
      .filter((rule) => rule.applies_to_node_kinds.includes(focus.node_kind))
      .sort((left, right) => right.priority - left.priority
        || left.rule_id.localeCompare(right.rule_id))
      .map((rule) => rule.rule_id);
    residuals.push(makeResidual({
      residual_kind: 'NO_CONTEXT_RULE_APPLIED',
      reason_code: 'NO_CONTEXT_RULE_APPLIED',
      focus_node_occurrence_id: focus.node_occurrence_id,
      source_node_occurrence_ids: [focus.node_occurrence_id],
      source_spans: [normaliseSpan(focus.extent_span, focus.node_occurrence_id)],
      affected_roles: [...policy.context_role_order],
      related_ambiguity_ids: [],
      attempted_rule_ids: [...new Set(applicableRules)],
      blocked_dependency_ids: [],
    }));
  }
  for (const seed of noScopeSeeds) {
    const directFact = facts.find((fact) =>
      fact.source_node_occurrence_id === seed.capture.sourceNode.node_occurrence_id
        && fact.target_node_occurrence_id === seed.capture.sourceNode.node_occurrence_id
        && fact.role === seed.capture.role
        && canonicalJson(fact.source_span) === canonicalJson(seed.capture.sourceSpan));
    residuals.push(makeResidual({
      residual_kind: 'NO_SCOPE_PROOF',
      reason_code: 'NO_SCOPE_PROOF',
      focus_node_occurrence_id: ownerToFocus(
        seed.capture.sourceNode.node_occurrence_id,
        runtime,
        policy,
      ),
      source_node_occurrence_ids: [seed.capture.sourceNode.node_occurrence_id],
      source_spans: [seed.capture.sourceSpan],
      affected_roles: [seed.capture.role],
      related_ambiguity_ids: [],
      attempted_rule_ids: policy.scope_rules
        .filter((rule) => rule.source_node_kinds.includes(seed.capture.sourceNode.node_kind)
          && rule.governing_roles.includes(seed.capture.role))
        .sort((left, right) => right.priority - left.priority
          || left.rule_id.localeCompare(right.rule_id))
        .map((rule) => rule.rule_id),
      blocked_dependency_ids: directFact ? [directFact.context_fact_id] : [],
    }));
  }
  for (const edge of referenceEdges.filter((value) => value.state !== 'RESOLVED')) {
    residuals.push(makeResidual({
      residual_kind: 'REFERENCE_TARGET_UNAVAILABLE',
      reason_code: edge.reason_code,
      focus_node_occurrence_id: ownerToFocus(edge.owner_node_occurrence_id, runtime, policy),
      source_node_occurrence_ids: [edge.owner_node_occurrence_id],
      source_spans: [edge.source_span],
      affected_roles: [],
      related_ambiguity_ids: [],
      attempted_rule_ids: [edge.rule_id],
      blocked_dependency_ids: [edge.reference_edge_id],
    }));
  }
  for (const edge of definitionEdges.filter((value) => value.state !== 'RESOLVED')) {
    residuals.push(makeResidual({
      residual_kind: 'DEFINITION_TARGET_UNAVAILABLE',
      reason_code: edge.reason_code,
      focus_node_occurrence_id: ownerToFocus(edge.owner_node_occurrence_id, runtime, policy),
      source_node_occurrence_ids: [edge.owner_node_occurrence_id],
      source_spans: [edge.source_span],
      affected_roles: [],
      related_ambiguity_ids: [],
      attempted_rule_ids: [edge.rule_id],
      blocked_dependency_ids: [edge.definition_edge_id],
    }));
  }
  for (const unavailable of topologyUnavailable) {
    residuals.push(makeResidual({
      residual_kind: 'TOPOLOGY_ENDPOINT_UNAVAILABLE',
      reason_code: 'TOPOLOGY_ENDPOINT_UNAVAILABLE',
      focus_node_occurrence_id: ownerToFocus(
        unavailable.node.node_occurrence_id,
        runtime,
        policy,
      ),
      source_node_occurrence_ids: [unavailable.node.node_occurrence_id],
      source_spans: unavailable.sourceSpans,
      affected_roles: [],
      related_ambiguity_ids: [],
      attempted_rule_ids: [unavailable.rule.rule_id],
      blocked_dependency_ids: [],
    }));
  }
  for (const relationship of relationships.filter((value) =>
    value.temporal_scope.state === 'UNSTATED')) {
    residuals.push(makeResidual({
      residual_kind: 'TEMPORAL_SCOPE_UNSTATED',
      reason_code: 'TEMPORAL_SCOPE_UNSTATED',
      focus_node_occurrence_id: ownerToFocus(
        relationship.source_node_occurrence_ids[0],
        runtime,
        policy,
      ),
      source_node_occurrence_ids: [...relationship.source_node_occurrence_ids],
      source_spans: [...relationship.source_spans],
      affected_roles: [],
      related_ambiguity_ids: [],
      attempted_rule_ids: [relationship.rule_id],
      blocked_dependency_ids: [relationship.semantic_relationship_id],
    }));
  }
  return residuals;
}

function diagnosticRecord(type, sourceIds, sourceSpans, relatedIds, reasonCode, ruleId,
  ruleVersion, policy) {
  const construction = policy.output_contract.member_construction.diagnostic_by_type[type];
  if (!construction) fail('POLICY_SCHEMA_MISMATCH', `diagnostic construction ${type}`);
  if (typeof ruleId !== 'string' || !Number.isSafeInteger(ruleVersion)) {
    fail('POLICY_SCHEMA_MISMATCH', `diagnostic trigger ${type}`);
  }
  return withContentId(CONTEXT_DIAGNOSTIC_SCHEMA_VERSION, 'diagnostic_id', {
    diagnostic_type: type,
    severity: construction.severity,
    reason_code: reasonCode,
    source_node_occurrence_ids: sourceIds,
    source_spans: sourceSpans,
    related_ids: relatedIds,
    detail: construction.detail,
  });
}

function buildDiagnostics({ index, runtime, ambiguities, residuals, referenceEdges,
  definitionEdges, relationships, policy }) {
  const diagnostics = [];
  for (const ambiguity of ambiguities) {
    const type = ambiguity.ambiguity_type === 'M2_STRUCTURE_AMBIGUITY'
      ? 'M2_AMBIGUITY_CARRIED'
      : 'CONTEXT_AMBIGUITY_RECORDED';
    const diagnostic = diagnosticRecord(
      type,
      ambiguity.source_node_occurrence_ids,
      ambiguity.source_spans,
      [ambiguity.ambiguity_id],
      type === 'M2_AMBIGUITY_CARRIED'
        ? policy.output_contract.member_construction
          .diagnostic_by_type.M2_AMBIGUITY_CARRIED.reason_code
        : ambiguity.reason_codes[0],
      ambiguity.rule_id,
      ambiguity.rule_version,
      policy,
    );
    diagnostics.push(diagnostic);
    if (ambiguity.ambiguity_type === 'TOPOLOGY_SOURCE_CONFLICT') {
      diagnostics.push(diagnosticRecord(
        'TOPOLOGY_AMBIGUOUS',
        ambiguity.source_node_occurrence_ids,
        ambiguity.source_spans,
        [ambiguity.ambiguity_id],
        ambiguity.reason_codes[0],
        ambiguity.rule_id,
        ambiguity.rule_version,
        policy,
      ));
    }
  }
  for (const residual of residuals) {
    if (['NO_CONTEXT_RULE_APPLIED', 'NO_SCOPE_PROOF'].includes(residual.residual_kind)) {
      const construction = policy.output_contract.member_construction
        .residual_by_kind[residual.residual_kind];
      const diagnostic = diagnosticRecord(
        'CONTEXT_RESIDUAL_RECORDED',
        residual.source_node_occurrence_ids,
        residual.source_spans,
        [residual.residual_id],
        residual.reason_code,
        construction.trigger_rule_id,
        construction.trigger_rule_version,
        policy,
      );
      diagnostics.push(diagnostic);
    } else if (residual.residual_kind === 'TOPOLOGY_ENDPOINT_UNAVAILABLE') {
      diagnostics.push(diagnosticRecord(
        'TOPOLOGY_UNRESOLVED',
        residual.source_node_occurrence_ids,
        residual.source_spans,
        [residual.residual_id],
        residual.reason_code,
        residual.attempted_rule_ids[0],
        1,
        policy,
      ));
    } else if (residual.residual_kind === 'TEMPORAL_SCOPE_UNSTATED') {
      const relationshipId = residual.blocked_dependency_ids[0];
      const relationship = relationships.find((entry) =>
        entry.semantic_relationship_id === relationshipId);
      diagnostics.push(diagnosticRecord(
        'TEMPORAL_SCOPE_UNSTATED',
        residual.source_node_occurrence_ids,
        residual.source_spans,
        [residual.residual_id, relationshipId],
        residual.reason_code,
        relationship.rule_id,
        relationship.rule_version,
        policy,
      ));
    }
  }
  for (const edge of referenceEdges.filter((value) => value.state !== 'RESOLVED')) {
    diagnostics.push(diagnosticRecord(
      edge.state === 'AMBIGUOUS' ? 'REFERENCE_AMBIGUOUS' : 'REFERENCE_UNRESOLVED',
      [edge.owner_node_occurrence_id],
      [edge.source_span],
      [edge.reference_edge_id],
      edge.reason_code,
      edge.rule_id,
      edge.rule_version,
      policy,
    ));
  }
  for (const edge of definitionEdges.filter((value) => value.state !== 'RESOLVED')) {
    diagnostics.push(diagnosticRecord(
      edge.state === 'AMBIGUOUS' ? 'DEFINITION_AMBIGUOUS' : 'DEFINITION_UNRESOLVED',
      [edge.owner_node_occurrence_id],
      [edge.source_span],
      [edge.definition_edge_id],
      edge.reason_code,
      edge.rule_id,
      edge.rule_version,
      policy,
    ));
  }
  for (const omission of policy.reference_resolution_contract.upstream_annotation_omissions) {
    if (!runtime.nodesById.has(omission.owner_node_occurrence_id)) continue;
    validateSpanAgainstSource(omission.source_span, runtime.sourceBytes, omission.rule_id);
    diagnostics.push(diagnosticRecord(
      'UPSTREAM_REFERENCE_ANNOTATION_ABSENT',
      [omission.owner_node_occurrence_id],
      [omission.source_span],
      [],
      policy.output_contract.member_construction.diagnostic_by_type
        .UPSTREAM_REFERENCE_ANNOTATION_ABSENT.reason_code,
      omission.rule_id,
      omission.rule_version,
      policy,
    ));
  }
  return diagnostics;
}

function firstSourceStart(record) {
  const spans = record.source_spans || [];
  return spans.length > 0 ? spans[0].start_byte : Number.MAX_SAFE_INTEGER;
}

function compareSemanticRelationships(left, right) {
  return firstSourceStart(left) - firstSourceStart(right)
    || (left.source_spans[0]?.end_byte ?? Number.MAX_SAFE_INTEGER)
      - (right.source_spans[0]?.end_byte ?? Number.MAX_SAFE_INTEGER)
    || left.relationship_type.localeCompare(right.relationship_type)
    || left.source_endpoint.entity_id.localeCompare(right.source_endpoint.entity_id)
    || left.target_endpoint.entity_id.localeCompare(right.target_endpoint.entity_id)
    || left.semantic_relationship_id.localeCompare(right.semantic_relationship_id);
}

function sortV2Members({ facts, scopeEdges, ambiguities, residuals, referenceEdges,
  definitionEdges, relationships, diagnostics, runtime, policy }) {
  const roleOrder = new Map(policy.context_role_order.map((role, index) => [role, index]));
  const focusOrder = new Map([...runtime.focusById.entries()].map(([id, entry]) => [id, entry.ordinal]));
  facts.sort((left, right) => compareByFocusAndRole(left, right, focusOrder, roleOrder));
  scopeEdges.sort((left, right) => compareByFocusAndRole(left, right, focusOrder, roleOrder));
  ambiguities.sort((left, right) => firstSourceStart(left) - firstSourceStart(right)
    || (left.source_spans[0]?.end_byte ?? Number.MAX_SAFE_INTEGER)
      - (right.source_spans[0]?.end_byte ?? Number.MAX_SAFE_INTEGER)
    || left.ambiguity_type.localeCompare(right.ambiguity_type)
    || left.ambiguity_id.localeCompare(right.ambiguity_id));
  residuals.sort((left, right) => focusOrder.get(left.focus_node_occurrence_id)
    - focusOrder.get(right.focus_node_occurrence_id)
    || left.residual_kind.localeCompare(right.residual_kind)
    || left.residual_id.localeCompare(right.residual_id));
  referenceEdges.sort((left, right) => left.source_span.start_byte - right.source_span.start_byte
    || left.source_span.end_byte - right.source_span.end_byte
    || left.source_annotation_occurrence_id.localeCompare(right.source_annotation_occurrence_id));
  definitionEdges.sort((left, right) => left.source_span.start_byte - right.source_span.start_byte
    || left.source_span.end_byte - right.source_span.end_byte
    || left.source_annotation_occurrence_id.localeCompare(right.source_annotation_occurrence_id));
  relationships.sort(compareSemanticRelationships);
  diagnostics.sort((left, right) => firstSourceStart(left) - firstSourceStart(right)
    || left.diagnostic_type.localeCompare(right.diagnostic_type)
    || left.diagnostic_id.localeCompare(right.diagnostic_id));
}

function sortFactsAndScopes(facts, scopeEdges, runtime, policy) {
  const roleOrder = new Map(policy.context_role_order.map((role, index) => [role, index]));
  const focusOrder = new Map([...runtime.focusById.entries()].map(([id, entry]) => [id, entry.ordinal]));
  facts.sort((left, right) => compareByFocusAndRole(left, right, focusOrder, roleOrder));
  scopeEdges.sort((left, right) => compareByFocusAndRole(left, right, focusOrder, roleOrder));
}

function assertUniqueIds(collections) {
  const seen = new Set();
  for (const [collection, idField] of collections) {
    for (const value of collection) {
      const id = value[idField];
      if (seen.has(id)) fail('DUPLICATE_PRIMARY_ID', id);
      seen.add(id);
      const unsigned = structuredClone(value);
      delete unsigned[idField];
      if (contentId(value.schema_version, unsigned) !== id) fail('OUTPUT_IDENTITY_MISMATCH', id);
    }
  }
  return seen;
}

function assertMemberFields(record, fields, detail) {
  if (!exactKeys(record, fields)) fail('MEMBER_SCHEMA_MISMATCH', detail);
}

function assertMemberVocabulary(value, vocabulary, detail) {
  if (!vocabulary.includes(value)) fail('MEMBER_SCHEMA_MISMATCH', `${detail}:${value}`);
}

function validateOutputMembers(result, index, policy) {
  const contract = policy.output_contract;
  assertMemberFields(result, contract.context_compilation_fields, 'context compilation');
  assertMemberFields(
    result.agreement_index_binding,
    contract.agreement_index_binding_fields,
    'agreement index binding',
  );
  assertMemberFields(
    result.semantic_policy_binding,
    contract.semantic_policy_binding_fields,
    'semantic policy binding',
  );
  for (const frame of Object.values(result.frames_by_focus_node_id)) {
    assertMemberFields(frame, contract.context_frame_fields, 'context frame');
  }
  for (const fact of result.context_facts) {
    assertMemberFields(fact, contract.context_fact_fields, 'context fact');
    assertMemberVocabulary(fact.role, policy.context_role_order, 'context fact role');
    assertMemberVocabulary(fact.state, policy.context_states, 'context fact state');
  }
  for (const edge of result.scope_edges) {
    assertMemberFields(edge, contract.scope_edge_fields, 'scope edge');
    assertMemberFields(edge.proof, contract.scope_edge_proof_fields, 'scope proof');
    assertMemberVocabulary(edge.edge_kind, policy.scope_edge_kinds, 'scope edge kind');
    assertMemberVocabulary(edge.state, policy.scope_edge_states, 'scope edge state');
    assertMemberVocabulary(edge.governing_role, policy.context_role_order, 'governing role');
    assertMemberVocabulary(edge.proof.proof_kind, policy.scope_proof_kinds, 'proof kind');
  }
  for (const ambiguity of result.ambiguities) {
    assertMemberFields(ambiguity, contract.context_ambiguity_fields, 'context ambiguity');
    assertMemberVocabulary(ambiguity.ambiguity_type, policy.ambiguity_types, 'ambiguity type');
    assertMemberVocabulary(ambiguity.state, policy.ambiguity_states, 'ambiguity state');
    for (const role of ambiguity.affected_roles) {
      assertMemberVocabulary(role, policy.context_role_order, 'ambiguity role');
    }
  }
  for (const residual of result.residuals) {
    assertMemberFields(residual, contract.context_residual_fields, 'context residual');
    assertMemberVocabulary(residual.residual_kind, policy.residual_kinds, 'residual kind');
    assertMemberVocabulary(residual.reason_code, policy.reason_codes, 'residual reason');
    for (const role of residual.affected_roles) {
      assertMemberVocabulary(role, policy.context_role_order, 'residual role');
    }
  }
  for (const edge of result.reference_edges) {
    assertMemberFields(edge, contract.context_reference_edge_fields, 'reference edge');
    assertMemberVocabulary(edge.state, policy.scope_edge_states, 'reference state');
    assertMemberVocabulary(
      edge.reason_code,
      Object.values(policy.reference_resolution_contract.reason_by_candidate_count),
      'reference reason',
    );
  }
  for (const edge of result.definition_edges) {
    assertMemberFields(edge, contract.context_definition_edge_fields, 'definition edge');
    assertMemberVocabulary(edge.state, policy.scope_edge_states, 'definition state');
    assertMemberVocabulary(
      edge.reason_code,
      Object.values(policy.definition_resolution_contract.reason_by_candidate_count),
      'definition reason',
    );
  }
  for (const relationship of result.semantic_relationships) {
    assertMemberFields(
      relationship,
      contract.semantic_relationship_fields,
      'semantic relationship',
    );
    assertMemberFields(relationship.source_endpoint, contract.semantic_endpoint_fields, 'endpoint');
    assertMemberFields(relationship.target_endpoint, contract.semantic_endpoint_fields, 'endpoint');
    assertMemberFields(relationship.temporal_scope, contract.temporal_scope_fields, 'temporal scope');
    assertMemberVocabulary(
      relationship.relationship_type,
      policy.relationship_types,
      'relationship type',
    );
    assertMemberVocabulary(relationship.state, policy.relationship_states, 'relationship state');
    assertMemberVocabulary(
      relationship.source_endpoint.entity_kind,
      policy.endpoint_kinds,
      'source endpoint kind',
    );
    assertMemberVocabulary(
      relationship.target_endpoint.entity_kind,
      policy.endpoint_kinds,
      'target endpoint kind',
    );
    assertMemberVocabulary(
      relationship.temporal_scope.state,
      policy.temporal_scope_states,
      'temporal state',
    );
    assertMemberVocabulary(
      relationship.temporal_scope.code,
      policy.temporal_scope_codes,
      'temporal code',
    );
    assertMemberVocabulary(
      relationship.reason_code,
      [
        ...Object.values(policy.input_contract.topology_record_construction
          .resolved_relationship_reason_by_temporal_scope_state),
        policy.input_contract.topology_record_construction.conflict_construction
          .conflicting_relationship_reason_code,
      ],
      'relationship reason',
    );
  }
  for (const diagnostic of result.diagnostics) {
    assertMemberFields(diagnostic, contract.context_diagnostic_fields, 'diagnostic');
    assertMemberVocabulary(diagnostic.diagnostic_type, policy.diagnostic_types, 'diagnostic type');
    assertMemberVocabulary(diagnostic.severity, policy.diagnostic_severities, 'diagnostic severity');
    assertMemberVocabulary(diagnostic.reason_code, policy.reason_codes, 'diagnostic reason');
  }
  const spans = [];
  for (const frame of Object.values(result.frames_by_focus_node_id)) spans.push(frame.focus_node_span);
  for (const fact of result.context_facts) spans.push(fact.source_span);
  for (const edge of result.scope_edges) {
    spans.push(edge.governing_source_span, edge.proof.source_extent_span, edge.proof.target_extent_span);
    if (edge.proof.connective_span !== null) spans.push(edge.proof.connective_span);
  }
  for (const collection of [result.ambiguities, result.residuals, result.semantic_relationships,
    result.diagnostics]) {
    for (const member of collection) spans.push(...member.source_spans);
  }
  for (const edge of [...result.reference_edges, ...result.definition_edges]) spans.push(edge.source_span);
  for (const relationship of result.semantic_relationships) {
    for (const endpoint of [relationship.source_endpoint, relationship.target_endpoint]) {
      if (endpoint.source_span !== null) spans.push(endpoint.source_span);
    }
    if (relationship.temporal_scope.source_span !== null) {
      spans.push(relationship.temporal_scope.source_span);
    }
  }
  for (const span of spans) assertMemberFields(span, contract.span_fields, 'source span');

  const nodeIds = new Set(index.nodes.map((node) => node.node_occurrence_id));
  const annotationIds = new Set(index.annotations.map((entry) => entry.annotation_occurrence_id));
  const primaryIds = new Set([
    ...result.context_facts.map((entry) => entry.context_fact_id),
    ...result.scope_edges.map((entry) => entry.scope_edge_id),
    ...result.ambiguities.map((entry) => entry.ambiguity_id),
    ...result.residuals.map((entry) => entry.residual_id),
    ...result.reference_edges.map((entry) => entry.reference_edge_id),
    ...result.definition_edges.map((entry) => entry.definition_edge_id),
    ...result.semantic_relationships.map((entry) => entry.semantic_relationship_id),
    ...result.diagnostics.map((entry) => entry.diagnostic_id),
    ...Object.values(result.frames_by_focus_node_id).map((entry) => entry.context_frame_id),
  ]);
  const requireId = (id, set) => {
    if (!set.has(id)) fail('DANGLING_ID_REFERENCE', id);
  };
  for (const frame of Object.values(result.frames_by_focus_node_id)) {
    requireId(frame.focus_node_occurrence_id, nodeIds);
    for (const id of [...frame.context_fact_ids, ...frame.scope_edge_ids,
      ...frame.ambiguity_ids, ...frame.residual_ids]) requireId(id, primaryIds);
  }
  for (const fact of result.context_facts) {
    requireId(fact.source_node_occurrence_id, nodeIds);
    requireId(fact.target_node_occurrence_id, nodeIds);
    requireId(fact.scope_edge_id, primaryIds);
    for (const id of [...fact.overridden_fact_ids, ...fact.alternative_fact_ids]) {
      requireId(id, primaryIds);
    }
  }
  for (const edge of result.scope_edges) {
    requireId(edge.source_node_occurrence_id, nodeIds);
    requireId(edge.target_node_occurrence_id, nodeIds);
    if (edge.proof.shared_parent_node_occurrence_id !== null) {
      requireId(edge.proof.shared_parent_node_occurrence_id, nodeIds);
    }
    for (const id of edge.proof.ordered_target_node_occurrence_ids) requireId(id, nodeIds);
  }
  const relationshipById = new Map(result.semantic_relationships
    .map((relationship) => [relationship.semantic_relationship_id, relationship]));
  const topologyEntityIds = new Set(result.semantic_relationships.flatMap((relationship) => [
    relationship.source_endpoint.entity_id,
    relationship.target_endpoint.entity_id,
  ]));
  for (const ambiguity of result.ambiguities) {
    for (const id of [...ambiguity.source_node_occurrence_ids,
      ...ambiguity.target_node_occurrence_ids]) requireId(id, nodeIds);
    if (ambiguity.ambiguity_type === 'MULTIPLE_SCOPE_READINGS') {
      for (const id of ambiguity.alternative_target_ids) requireId(id, nodeIds);
      const propagatedEdgeIds = new Set(result.context_facts
        .map((fact) => fact.scope_edge_id));
      if (ambiguity.alternative_scope_edge_ids.some((id) => propagatedEdgeIds.has(id))) {
        fail('MEMBER_SCHEMA_MISMATCH', 'ambiguous scope propagation');
      }
    } else if (ambiguity.ambiguity_type === 'TOPOLOGY_SOURCE_CONFLICT') {
      for (const id of ambiguity.alternative_target_ids) requireId(id, topologyEntityIds);
      if (ambiguity.target_node_occurrence_ids.length > 0
        || ambiguity.blocked_dependency_ids.some((id) => {
          const relationship = relationshipById.get(id);
          return !relationship
            || relationship.state !== 'AMBIGUOUS'
            || relationship.reason_code !== 'TOPOLOGY_SOURCE_CONFLICT';
        })) {
        fail('MEMBER_SCHEMA_MISMATCH', 'topology conflict construction');
      }
    }
    for (const id of [...ambiguity.alternative_fact_ids,
      ...ambiguity.alternative_scope_edge_ids, ...ambiguity.blocked_dependency_ids]) {
      requireId(id, primaryIds);
    }
  }
  for (const residual of result.residuals) {
    requireId(residual.focus_node_occurrence_id, nodeIds);
    for (const id of residual.source_node_occurrence_ids) requireId(id, nodeIds);
    for (const id of residual.related_ambiguity_ids) requireId(id, primaryIds);
    for (const id of residual.blocked_dependency_ids) requireId(id, primaryIds);
  }
  for (const edge of result.reference_edges) {
    requireId(edge.source_annotation_occurrence_id, annotationIds);
    requireId(edge.owner_node_occurrence_id, nodeIds);
    for (const id of edge.target_node_occurrence_ids) requireId(id, nodeIds);
  }
  for (const edge of result.definition_edges) {
    requireId(edge.source_annotation_occurrence_id, annotationIds);
    requireId(edge.owner_node_occurrence_id, nodeIds);
    for (const id of edge.target_definition_annotation_occurrence_ids) {
      requireId(id, annotationIds);
    }
    for (const id of edge.target_owner_node_occurrence_ids) requireId(id, nodeIds);
  }
  for (const relationship of result.semantic_relationships) {
    for (const id of relationship.source_node_occurrence_ids) requireId(id, nodeIds);
    for (const endpoint of [relationship.source_endpoint, relationship.target_endpoint]) {
      if (endpoint.definition_annotation_occurrence_id !== null) {
        requireId(endpoint.definition_annotation_occurrence_id, annotationIds);
      }
      if (endpoint.source_node_occurrence_id !== null) {
        requireId(endpoint.source_node_occurrence_id, nodeIds);
      }
    }
  }
  for (const diagnostic of result.diagnostics) {
    for (const id of diagnostic.source_node_occurrence_ids) requireId(id, nodeIds);
    for (const id of diagnostic.related_ids) requireId(id, primaryIds);
  }
}

function compileContextV2(focusNodeIds, agreementIndex, semanticPolicy) {
  const indexRuntime = validateAgreementIndex(agreementIndex);
  const policyRuntime = validateSemanticPolicyV2(semanticPolicy);
  const binding = semanticPolicy.input_contract.agreement_indexes.find((entry) =>
    entry.agreement_id === agreementIndex.source_binding.agreement_id);
  if (!binding
    || binding.agreement_index_id !== agreementIndex.agreement_index_id
    || binding.sha256 !== indexRuntime.agreementIndexSha256
    || binding.canonical_text_sha256 !== agreementIndex.source_binding.canonical_text_sha256
    || binding.structural_policy_digest !== agreementIndex.structural_policy.policy_digest) {
    fail('EXPERIMENT_BINDING_MISMATCH', 'seven-agreement binding');
  }
  const focusNodes = deriveFocusNodes(agreementIndex, indexRuntime.nodesById, semanticPolicy);
  if (focusNodes.length !== binding.focus_count) fail('FOCUS_SET_MISMATCH', focusNodes.length);
  validateV2FocusIds(
    focusNodeIds,
    focusNodes,
    indexRuntime.nodesById,
    semanticPolicy.focus_node_kinds,
  );
  const runtime = buildV2Runtime(agreementIndex, indexRuntime, focusNodes);
  const captures = selectCaptures(agreementIndex, runtime, focusNodes, policyRuntime);
  validateCaptureFixtures(agreementIndex, captures, semanticPolicy);
  const compiled = compileFactsAndScopes(
    agreementIndex,
    runtime,
    focusNodes,
    captures,
    policyRuntime,
  );
  const factResolution = resolveFacts(compiled.factDrafts, runtime, semanticPolicy);
  const facts = factResolution.facts;
  const scopeEdges = compiled.scopeEdges;
  sortFactsAndScopes(facts, scopeEdges, runtime, semanticPolicy);
  const referenceEdges = buildReferenceEdges(agreementIndex, runtime, semanticPolicy);
  const definitionResult = buildDefinitionEdges(agreementIndex, runtime, semanticPolicy);
  const definitionEdges = definitionResult.edges;
  const topology = buildTopology(
    agreementIndex,
    runtime,
    focusNodes,
    definitionResult.definitionsByTerm,
    policyRuntime,
  );
  const relationships = topology.relationships;
  relationships.sort(compareSemanticRelationships);
  const ambiguities = [
    ...buildM2Ambiguities(
    agreementIndex,
    runtime,
    focusNodes,
    facts,
    scopeEdges,
      semanticPolicy,
    ),
    ...buildScopeConflictAmbiguities(
      compiled.scopeConflictSeeds,
      scopeEdges,
      runtime,
      semanticPolicy,
    ),
    ...buildCaptureConflictAmbiguities(
      factResolution.conflictSeeds,
      facts,
      runtime,
      semanticPolicy,
    ),
    ...buildTopologyConflictAmbiguities(
      topology.conflictSeeds,
      relationships,
      runtime,
      semanticPolicy,
    ),
  ];
  const residuals = buildResiduals({
    index: agreementIndex,
    runtime,
    focusNodes,
    facts,
    noScopeSeeds: compiled.noScopeSeeds,
    referenceEdges,
    definitionEdges,
    relationships,
    topologyUnavailable: topology.unavailable,
    policy: semanticPolicy,
  });
  const diagnostics = buildDiagnostics({
    index: agreementIndex,
    runtime,
    ambiguities,
    residuals,
    referenceEdges,
    definitionEdges,
    relationships,
    policy: semanticPolicy,
  });
  sortV2Members({
    facts,
    scopeEdges,
    ambiguities,
    residuals,
    referenceEdges,
    definitionEdges,
    relationships,
    diagnostics,
    runtime,
    policy: semanticPolicy,
  });
  const factIdsByFocus = new Map();
  const scopeEdgeIdsByFocus = new Map();
  const ambiguityIdsByFocus = new Map();
  const residualIdsByFocus = new Map();
  const appendId = (map, focusId, id) => {
    if (!map.has(focusId)) map.set(focusId, []);
    map.get(focusId).push(id);
  };
  for (const fact of facts) {
    appendId(factIdsByFocus, fact.target_node_occurrence_id, fact.context_fact_id);
  }
  for (const edge of scopeEdges) {
    appendId(scopeEdgeIdsByFocus, edge.target_node_occurrence_id, edge.scope_edge_id);
  }
  for (const ambiguity of ambiguities) {
    for (const focusId of ambiguity.target_node_occurrence_ids) {
      appendId(ambiguityIdsByFocus, focusId, ambiguity.ambiguity_id);
    }
  }
  for (const residual of residuals) {
    appendId(residualIdsByFocus, residual.focus_node_occurrence_id, residual.residual_id);
  }
  const framesByFocusNodeId = {};
  for (const focus of focusNodes) {
    const unsigned = {
      focus_node_occurrence_id: focus.node_occurrence_id,
      focus_node_kind: focus.node_kind,
      focus_node_span: normaliseSpan(focus.extent_span, focus.node_occurrence_id),
      context_fact_ids: factIdsByFocus.get(focus.node_occurrence_id) || [],
      scope_edge_ids: scopeEdgeIdsByFocus.get(focus.node_occurrence_id) || [],
      ambiguity_ids: ambiguityIdsByFocus.get(focus.node_occurrence_id) || [],
      residual_ids: residualIdsByFocus.get(focus.node_occurrence_id) || [],
    };
    framesByFocusNodeId[focus.node_occurrence_id] = withContentId(
      CONTEXT_FRAME_SCHEMA_VERSION,
      'context_frame_id',
      unsigned,
    );
  }
  const globalIds = assertUniqueIds([
    [facts, 'context_fact_id'],
    [scopeEdges, 'scope_edge_id'],
    [ambiguities, 'ambiguity_id'],
    [residuals, 'residual_id'],
    [referenceEdges, 'reference_edge_id'],
    [definitionEdges, 'definition_edge_id'],
    [relationships, 'semantic_relationship_id'],
    [diagnostics, 'diagnostic_id'],
    [Object.values(framesByFocusNodeId), 'context_frame_id'],
  ]);
  for (const fact of facts) {
    if (!globalIds.has(fact.scope_edge_id)) fail('DANGLING_ID_REFERENCE', fact.scope_edge_id);
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
    context_facts: facts,
    scope_edges: scopeEdges,
    ambiguities,
    residuals,
    reference_edges: referenceEdges,
    definition_edges: definitionEdges,
    semantic_relationships: relationships,
    diagnostics,
  };
  const result = {
    ...payload,
    context_compilation_id: contentId(CONTEXT_COMPILATION_SCHEMA_VERSION, payload),
  };
  validateOutputMembers(result, agreementIndex, semanticPolicy);
  return Object.freeze(structuredClone(result));
}

function compileContext(focusNodeIds, agreementIndex, semanticPolicy) {
  if (semanticPolicy?.policy_version === 2) {
    return compileContextV2(focusNodeIds, agreementIndex, semanticPolicy);
  }
  return compileContextV1(focusNodeIds, agreementIndex, semanticPolicy);
}

module.exports = {
  compileContext,
};
