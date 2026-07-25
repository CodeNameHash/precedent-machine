const {
  canonicalJson,
  contentId,
} = require('./canonical-bytes');
const {
  validateClaimRevisionIdentity,
  validateRelationshipRevisionIdentity,
} = require('./claims-relationships');
const {
  validateQxoReviewedCapitalisationSlice,
} = require('./reviewed-qxo-capitalisation-slice');
const {
  buildQxoTierBParserBoundReviewSeed,
} = require('./qxo-tier-b-parser-bridge');

const MAX_CLOSURE_BYTES = 16 * 1024;
const MAX_CLOSURE_NODES = 4096;
const CLOSURE_SCHEMA = 'QXO_TIER_B_REVIEW_DEPENDENCY_CLOSURE/V1';
const CLOSURE_AUTHORITY = 'OFFLINE_REVIEW_IDENTITY_ONLY_NO_RESULT_AUTHORITY';
const BRIDGE_INPUT_KEYS = Object.freeze([
  'contract_bundle',
  'immutable_source_document',
  'source_admission_manifest',
  'semantic_extraction_input_envelope',
  'conversion',
  'admitted_source_context',
  'admitted_parser_proposal_envelope',
  'inference_transcript_set_marker',
  'reviewed_candidate_dispositions',
  'governed_parent_section_proposal_ids',
  'reviewed_definition_graph_package',
  'reviewed_capitalisation_slice',
]);
const CLOSURE_KEYS = Object.freeze([
  'schema_version',
  'authority_scope',
  'contract_binding',
  'source_binding',
  'parser_seed_binding',
  'review_subject_binding',
  'reviewed_source_references',
  'source_geometry',
  'party_uncertainty',
  'withheld_candidate_references',
  'status',
  'qxo_tier_b_review_dependency_closure_id',
  'canonical_payload_digest',
]);
const ADDED_BLOCKER_CODES = Object.freeze([
  'COMPOSITION_SCOPE_CLOSURE_NOT_FROZEN',
  'EXPECTED_LINEAGE_SLOTS_NOT_FROZEN',
  'RESULT_DEFINITION_NOT_FROZEN',
]);
const FORBIDDEN_AUTHORITY_KEYS = new Set([
  'component_occurrence_id',
  'component_revision_id',
  'composition_scope_closure_id',
  'corpus_release_id',
  'derived_result_id',
  'derived_result_revision_id',
  'expected_result_input_lineage_slot_id',
  'input_lineage_digest',
  'market_observation_id',
  'metric_slot_id',
  'result_component_occurrence_id',
  'result_component_revision_id',
  'result_definition_id',
  'result_input_lineage',
  'result_input_lineage_digest',
  'result_input_lineage_entry',
  'result_input_lineage_id',
  'uses_definition_relationship_revision_id',
]);
const LOCALLY_SUPPRESSIBLE_CODES = new Set([
  'CLOSURE_IDENTITY_MISMATCH',
  'PARTY_UNCERTAINTY_DRIFT',
  'REVIEW_EVIDENCE_DRIFT',
  'REVIEW_MAPPING_DRIFT',
  'SOURCE_GEOMETRY_DRIFT',
  'WITHHELD_REFERENCE_DRIFT',
]);

class QxoTierBReviewDependencyClosureError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'QxoTierBReviewDependencyClosureError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new QxoTierBReviewDependencyClosureError(code, message);
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function requireExact(value, expected, code, message) {
  if (canonicalJson(value) !== canonicalJson(expected)) fail(code, message);
}

function requireBridgeInput(input) {
  const expectedKeys = new Set(BRIDGE_INPUT_KEYS);
  const keys = input && typeof input === 'object' && !Array.isArray(input)
    ? Object.keys(input)
    : [];
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || keys.length !== BRIDGE_INPUT_KEYS.length
    || keys.some((key) => !expectedKeys.has(key))) {
    fail(
      'CLOSURE_INPUT_CONTRACT_MISMATCH',
      'the QXO Tier B review dependency input is outside its closed contract',
    );
  }
}

function preflightClosure(closure) {
  if (!closure || typeof closure !== 'object' || Array.isArray(closure)) {
    fail('CLOSURE_CONTRACT_MISMATCH', 'the QXO Tier B review dependency closure is required');
  }
  const topLevelKeys = Object.keys(closure);
  const expectedKeys = new Set(CLOSURE_KEYS);
  if (topLevelKeys.length !== CLOSURE_KEYS.length
    || topLevelKeys.some((key) => !expectedKeys.has(key))) {
    fail(
      'CLOSURE_CONTRACT_MISMATCH',
      'the QXO Tier B review dependency closure is outside its closed contract',
    );
  }

  const active = new Set();
  const stack = [{ value: closure, exiting: false }];
  let nodes = 0;
  let stringBytes = 0;
  while (stack.length > 0) {
    const task = stack.pop();
    const value = task.value;
    if (task.exiting) {
      active.delete(value);
      continue;
    }
    nodes += 1;
    if (nodes > MAX_CLOSURE_NODES) {
      fail('CLOSURE_LIMIT_EXCEEDED', 'the QXO Tier B review dependency closure exceeds its node limit');
    }
    if (typeof value === 'string') {
      stringBytes += Buffer.byteLength(value, 'utf8');
      if (stringBytes > MAX_CLOSURE_BYTES) {
        fail('CLOSURE_LIMIT_EXCEEDED', 'the QXO Tier B review dependency closure exceeds 16 KiB');
      }
      continue;
    }
    if (!value || typeof value !== 'object') continue;
    if (active.has(value)) {
      fail('CLOSURE_CONTRACT_MISMATCH', 'the QXO Tier B review dependency closure is cyclic');
    }
    active.add(value);
    stack.push({ value, exiting: true });
    const keys = Object.keys(value);
    if (keys.length > MAX_CLOSURE_NODES) {
      fail('CLOSURE_LIMIT_EXCEEDED', 'the QXO Tier B review dependency closure exceeds its field limit');
    }
    for (let index = keys.length - 1; index >= 0; index -= 1) {
      const key = keys[index];
      if (FORBIDDEN_AUTHORITY_KEYS.has(key)) {
        fail('AUTHORITY_LEAK', `review-only closure contains forbidden authority field ${key}`);
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.hasOwn(descriptor, 'value')) {
        fail('CLOSURE_CONTRACT_MISMATCH', 'the QXO Tier B review dependency closure contains an accessor');
      }
      stringBytes += Buffer.byteLength(key, 'utf8');
      if (stringBytes > MAX_CLOSURE_BYTES) {
        fail('CLOSURE_LIMIT_EXCEEDED', 'the QXO Tier B review dependency closure exceeds 16 KiB');
      }
      stack.push({ value: descriptor.value, exiting: false });
    }
  }
  if (Buffer.byteLength(canonicalJson(closure), 'utf8') > MAX_CLOSURE_BYTES) {
    fail('CLOSURE_LIMIT_EXCEEDED', 'the QXO Tier B review dependency closure exceeds 16 KiB');
  }

  if (closure.schema_version !== CLOSURE_SCHEMA
    || closure.authority_scope !== CLOSURE_AUTHORITY
    || closure.review_subject_binding?.future_result_definition_state !== 'NOT_FROZEN'
    || closure.review_subject_binding?.future_expected_slot_contract_state !== 'NOT_FROZEN'
    || closure.reviewed_source_references?.definition_source_reference
      ?.definition_use_relationship_authority !== 'NONE_PENDING_FREEZE_GATE'
    || closure.status?.certification_state !== 'NOT_CERTIFIED'
    || closure.status?.comparability_state !== 'NOT_CERTIFIED'
    || closure.status?.canonical_result_authority !== 'NONE'
    || closure.status?.query_authority !== 'NONE'
    || closure.status?.cohort_authority !== 'NONE'
    || closure.status?.serving_projection_authority !== 'NONE'
    || closure.status?.canonical_write_authority !== 'NONE'
    || closure.status?.release_authority !== 'NONE') {
    fail('AUTHORITY_LEAK', 'the review-only closure attempts to grant unfrozen authority');
  }
}

function rejectUnknownFields(actual, expected, path = '$') {
  if (!actual || typeof actual !== 'object'
    || !expected || typeof expected !== 'object') return;
  if (Array.isArray(actual) || Array.isArray(expected)) {
    if (!Array.isArray(actual) || !Array.isArray(expected)) return;
    for (let index = 0; index < Math.min(actual.length, expected.length); index += 1) {
      rejectUnknownFields(actual[index], expected[index], `${path}[${index}]`);
    }
    return;
  }
  const expectedKeys = new Set(Object.keys(expected));
  const unknown = Object.keys(actual).filter((key) => !expectedKeys.has(key));
  if (unknown.length > 0) {
    fail(
      'CLOSURE_CONTRACT_MISMATCH',
      `${path} contains fields outside the closed review dependency contract`,
    );
  }
  for (const key of Object.keys(actual)) {
    rejectUnknownFields(actual[key], expected[key], `${path}.${key}`);
  }
}

function claimPayloadDigest(claim) {
  const { closure_id: ignored, ...payload } = claim;
  return contentId('CLAIM_REVISION_CANONICAL_PAYLOAD/V1', payload);
}

function relationshipPayloadDigest(relationship) {
  const { closure_id: ignored, ...payload } = relationship;
  return contentId('QXO_TIER_B_REVIEW_RELATIONSHIP_REVISION_PAYLOAD/V1', payload);
}

function sourceSpanReference(span) {
  return {
    semantic_span_id: span.semantic_span_id,
    absolute_start: span.absolute_start,
    absolute_end: span.absolute_end,
    exact_bytes_digest: span.exact_bytes_digest,
  };
}

function claimReference(claim, referenceClass) {
  validateClaimRevisionIdentity(claim);
  return {
    reference_class: referenceClass,
    claim_occurrence_id: claim.claim_occurrence_id,
    claim_revision_id: claim.claim_revision_id,
    claim_payload_digest: claimPayloadDigest(claim),
    subject_occurrence_id: claim.subject_occurrence_id,
    claim_definition_key: claim.claim_definition_key,
    claim_definition_version: claim.claim_definition_version,
    ordinal: claim.ordinal,
    state: claim.state,
    claim_scope_closure_id: claim.scope?.scope_closure_id || null,
    required_scope_excerpt_ids: [...(claim.scope?.required_interval_ids || [])],
    examined_scope_excerpt_ids: [...(claim.scope?.examined_interval_ids || [])],
    evidence_edge_ids: [...claim.evidence_ids],
    evidence_excerpt_ids: claim.evidence.map((edge) => edge.excerpt_id),
  };
}

function relationshipReference(relationship) {
  validateRelationshipRevisionIdentity(relationship);
  return {
    reference_class: 'REVIEWED_BRINGS_DOWN_RELATIONSHIP',
    relationship_occurrence_id: relationship.relationship_occurrence_id,
    relationship_revision_id: relationship.relationship_revision_id,
    relationship_payload_digest: relationshipPayloadDigest(relationship),
    source_occurrence_id: relationship.source_occurrence_id,
    relationship_definition_key: relationship.relationship_definition_key,
    relationship_definition_version: relationship.relationship_definition_version,
    ordinal: relationship.ordinal,
    state: relationship.state,
    relationship_scope_closure_id: relationship.scope?.scope_closure_id || null,
    required_scope_excerpt_ids: [...(relationship.scope?.required_interval_ids || [])],
    examined_scope_excerpt_ids: [...(relationship.scope?.examined_interval_ids || [])],
    target_scope_excerpt_ids: [...(relationship.scope?.target_interval_ids || [])],
    ordered_target_occurrence_ids: [...relationship.target_occurrence_ids],
    evidence_edge_ids: [...relationship.evidence_ids],
    evidence_excerpt_ids: relationship.evidence.map((edge) => edge.excerpt_id),
    reviewed_effect_digest: contentId('RELATIONSHIP_EFFECT/V1', relationship.effect),
    effect_contract_state: 'REFERENCE_EVIDENCE_PENDING_FREEZE_GATE',
  };
}

function componentReference(component, excerpt) {
  return {
    provision_component_id: component.provision_component_id,
    parent_provision_instance_id: component.parent_provision_instance_id,
    component_key: component.component_key,
    ordinal: component.ordinal,
    source_anchor_id: component.source_anchor_id,
    excerpt_id: excerpt.excerpt_id,
    absolute_start: component.absolute_start,
    absolute_end: component.absolute_end,
  };
}

function definitionSourceReference(reviewedDefinitionGraphPackage, seed) {
  const graph = reviewedDefinitionGraphPackage.validated_semantic_graph;
  const cue = graph.definition_cues.find(
    (item) => item.definition_cue_id
      === seed.reviewed_definition_binding.definition_cue_id,
  );
  const operativeUse = graph.definition_use_cues.find(
    (item) => item.definition_use_cue_id
      === seed.reviewed_definition_binding.operative_definition_use_cue_id,
  );
  const declarationUse = graph.definition_use_cues.find(
    (item) => item.definition_use_cue_id
      === seed.reviewed_definition_binding.declaration_definition_use_cue_id,
  );
  if (!cue || !operativeUse || !declarationUse
    || operativeUse.use_role !== 'OPERATIVE_REFERENCE'
    || declarationUse.use_role !== 'DECLARATION_REFERENCE') {
    fail('REVIEW_MAPPING_DRIFT', 'the reviewed nested-definition references have drifted');
  }
  return {
    reference_class: 'REVIEWED_DEFINITION_SOURCE_GEOMETRY',
    reviewed_definition_graph_package_id:
      reviewedDefinitionGraphPackage.reviewed_definition_graph_package_id,
    reviewed_definition_graph_package_payload_digest:
      reviewedDefinitionGraphPackage.canonical_payload_digest,
    validated_semantic_graph_id: graph.validated_semantic_graph_id,
    definition_cue_id: cue.definition_cue_id,
    term_span: sourceSpanReference(cue.term_span),
    body_spans: cue.body_spans.map(sourceSpanReference),
    operative_definition_use_cue_id: operativeUse.definition_use_cue_id,
    operative_use_span: sourceSpanReference(operativeUse.use_span),
    declaration_definition_use_cue_id: declarationUse.definition_use_cue_id,
    declaration_use_span: sourceSpanReference(declarationUse.use_span),
    co_reviewed_reference_ids: [
      ...seed.reviewed_definition_binding.affected_reference_ids,
    ],
    definition_dependency_state: 'PENDING_GOVERNED_USES_DEFINITION_RELATIONSHIP',
    definition_use_relationship_authority: 'NONE_PENDING_FREEZE_GATE',
  };
}

function validatePartyUncertainty(seed) {
  const observations = seed.party_observations;
  if (!Array.isArray(observations) || observations.length !== 3) {
    fail('PARTY_UNCERTAINTY_DRIFT', 'the Section 5.2 party observations have drifted');
  }
  requireExact(
    observations.map((item) => ({
      token_key: item.token_key,
      allocation_status: item.allocation_status,
      assigned_party_value: item.assigned_party_value,
    })),
    [
      {
        token_key: 'PARENT',
        allocation_status: 'MAPPED_EXISTING_PARTY_REFERENCE_ONLY',
        assigned_party_value: 'PARENT',
      },
      {
        token_key: 'TITANIUM_MERGER_SUB',
        allocation_status: 'OBSERVED_UNASSIGNED',
        assigned_party_value: null,
      },
      {
        token_key: 'FORWARD_MERGER_SUB',
        allocation_status: 'OBSERVED_UNASSIGNED',
        assigned_party_value: null,
      },
    ],
    'PARTY_UNCERTAINTY_DRIFT',
    'the Section 5.2 party allocation state has drifted',
  );
}

function buildQxoTierBReviewDependencyClosure(input = {}) {
  requireBridgeInput(input);
  const seed = buildQxoTierBParserBoundReviewSeed(input);

  const slice = input.reviewed_capitalisation_slice;
  validateQxoReviewedCapitalisationSlice({
    sourceContext: input.admitted_source_context,
    contractBundle: input.contract_bundle,
    slice,
  });
  const accuracyClaim = slice.accuracyClaims[0];
  const exceptionClaim = slice.exceptionClaim;
  const relationship = slice.relationships[0];
  const targetComponents = [slice.components[0], slice.components[2]];
  const targetExcerpts = [slice.excerpts.limb_i, slice.excerpts.limb_iii];
  const orderedSourceExcerpts = [
    slice.excerpts.limb_i,
    slice.excerpts.limb_iii,
    slice.excerpts.tier_b,
    slice.excerpts.earlier_date,
    slice.excerpts.de_minimis_definition,
  ];

  if (accuracyClaim.claim_revision_id
      !== seed.composition_binding.accuracy_claim_revision_id
    || exceptionClaim.claim_revision_id
      !== seed.composition_binding.exception_claim_revision_id
    || relationship.relationship_revision_id
      !== seed.composition_binding.brings_down_relationship_revision_id) {
    fail('REVIEW_MAPPING_DRIFT', 'the reviewed Tier B source references have drifted');
  }
  requireExact(
    relationship.target_occurrence_ids,
    targetComponents.map((component) => component.provision_component_id),
    'SOURCE_GEOMETRY_DRIFT',
    'the reviewed BRINGS_DOWN targets are no longer exact limbs (i) and (iii)',
  );
  if (targetComponents[0].absolute_end >= targetComponents[1].absolute_start) {
    fail('SOURCE_GEOMETRY_DRIFT', 'the reviewed Tier B target limbs are not non-contiguous');
  }
  requireExact(
    relationship.evidence.map((edge) => edge.excerpt_id),
    orderedSourceExcerpts.map((excerpt) => excerpt.excerpt_id),
    'REVIEW_EVIDENCE_DRIFT',
    'the reviewed BRINGS_DOWN evidence group has drifted',
  );
  requireExact(
    accuracyClaim.evidence.map((edge) => edge.excerpt_id),
    [slice.excerpts.tier_b.excerpt_id],
    'REVIEW_EVIDENCE_DRIFT',
    'the reviewed accuracy evidence group has drifted',
  );
  requireExact(
    exceptionClaim.evidence.map((edge) => edge.excerpt_id),
    [
      slice.excerpts.tier_b.excerpt_id,
      slice.excerpts.de_minimis_definition.excerpt_id,
    ],
    'REVIEW_EVIDENCE_DRIFT',
    'the reviewed exception evidence group has drifted',
  );

  validatePartyUncertainty(seed);
  const withheldClaims = [slice.knowledgeClaims[0], slice.knowledgeClaims[2]];
  requireExact(
    seed.withheld_legacy_claim_references.map((item) => item.claim_revision_id),
    withheldClaims.map((claim) => claim.claim_revision_id),
    'WITHHELD_REFERENCE_DRIFT',
    'the withheld knowledge references have drifted',
  );
  withheldClaims.forEach((claim) => validateClaimRevisionIdentity(claim));

  const blockerCodes = [...new Set([
    ...seed.status.blocker_codes,
    ...ADDED_BLOCKER_CODES,
  ])].sort();
  const definitionReference = definitionSourceReference(
    input.reviewed_definition_graph_package,
    seed,
  );
  const body = {
    schema_version: CLOSURE_SCHEMA,
    authority_scope: CLOSURE_AUTHORITY,
    contract_binding: seed.contract_binding,
    source_binding: seed.source_binding,
    parser_seed_binding: {
      qxo_tier_b_parser_bound_review_seed_id:
        seed.qxo_tier_b_parser_bound_review_seed_id,
      qxo_tier_b_parser_bound_review_seed_payload_digest:
        seed.canonical_payload_digest,
    },
    review_subject_binding: {
      concept_reference_key: seed.composition_binding.concept_key,
      condition_provision_instance_id:
        seed.composition_binding.condition_provision_instance_id,
      representation_provision_instance_id:
        seed.composition_binding.representation_provision_instance_id,
      reviewed_mapping_id: slice.reviewed_mapping.reviewed_mapping_id,
      reviewed_mapping_payload_digest: slice.reviewed_mapping.canonical_payload_digest,
      parent_party_reference: seed.composition_binding.party,
      future_result_definition_state: 'NOT_FROZEN',
      future_expected_slot_contract_state: 'NOT_FROZEN',
    },
    reviewed_source_references: {
      accuracy_claim_reference: claimReference(
        accuracyClaim,
        'REVIEWED_ACCURACY_CLAIM',
      ),
      exception_claim_reference: claimReference(
        exceptionClaim,
        'REVIEWED_CONTEXT_EXCEPTION_CLAIM',
      ),
      brings_down_relationship_reference: relationshipReference(relationship),
      definition_source_reference: definitionReference,
    },
    source_geometry: {
      ordered_target_component_references: targetComponents.map(
        (component, index) => componentReference(component, targetExcerpts[index]),
      ),
      target_order_state: 'EXACT_SOURCE_ORDER',
      target_geometry_state: 'NON_CONTIGUOUS',
      target_gap_byte_length:
        targetComponents[1].absolute_start - targetComponents[0].absolute_end,
      ordered_review_excerpt_ids:
        orderedSourceExcerpts.map((excerpt) => excerpt.excerpt_id),
    },
    party_uncertainty: {
      allocation_state: 'PARTIAL_PENDING_FREEZE_GATE',
      parent_reference_completeness: 'NOT_CERTIFIED',
      observed_party_references: seed.party_observations,
    },
    withheld_candidate_references: withheldClaims.map((claim) => ({
      reference_class: 'WITHHELD_LEGACY_KNOWLEDGE_ABSENCE',
      claim_occurrence_id: claim.claim_occurrence_id,
      claim_revision_id: claim.claim_revision_id,
      claim_payload_digest: claimPayloadDigest(claim),
      subject_occurrence_id: claim.subject_occurrence_id,
      state: claim.state,
      reason_code: 'ABSENCE_SCOPE_NOT_CERTIFIED',
      dependency_state: 'WITHHELD_NOT_A_LINEAGE_OR_COMPLETENESS_INPUT',
    })),
    status: {
      review_reference_renderable: true,
      underlying_review_provision_visibility: 'UNAFFECTED',
      certification_state: 'NOT_CERTIFIED',
      comparability_state: 'NOT_CERTIFIED',
      canonical_result_authority: 'NONE',
      query_authority: 'NONE',
      cohort_authority: 'NONE',
      serving_projection_authority: 'NONE',
      canonical_write_authority: 'NONE',
      release_authority: 'NONE',
      failure_isolation: 'SUPPRESS_THIS_CLOSURE_ONLY',
      blocker_codes: blockerCodes,
    },
  };
  const closure = freeze({
    ...body,
    qxo_tier_b_review_dependency_closure_id: contentId(CLOSURE_SCHEMA, body),
    canonical_payload_digest: contentId(
      'QXO_TIER_B_REVIEW_DEPENDENCY_CLOSURE_PAYLOAD/V1',
      body,
    ),
  });
  if (Buffer.byteLength(canonicalJson(closure), 'utf8') > MAX_CLOSURE_BYTES) {
    fail('CLOSURE_LIMIT_EXCEEDED', 'the QXO Tier B review dependency closure exceeds 16 KiB');
  }
  return closure;
}

function validateQxoTierBReviewDependencyClosure({
  qxo_tier_b_review_dependency_closure: closure,
  ...inputs
} = {}) {
  preflightClosure(closure);
  const expected = buildQxoTierBReviewDependencyClosure(inputs);
  rejectUnknownFields(closure, expected);
  if (canonicalJson(closure) !== canonicalJson(expected)) {
    fail('CLOSURE_IDENTITY_MISMATCH', 'the QXO Tier B review dependency closure has drifted');
  }
  return true;
}

function validateQxoTierBReviewDependencyClosureIsolated(input = {}) {
  const {
    qxo_tier_b_review_dependency_closure: closure,
    ...inputs
  } = input;
  try {
    validateQxoTierBReviewDependencyClosure({
      qxo_tier_b_review_dependency_closure: closure,
      ...inputs,
    });
    return freeze({
      schema_version: 'QXO_TIER_B_REVIEW_DEPENDENCY_CLOSURE_OUTCOME/V1',
      suppressed: false,
      failure_code: null,
      underlying_review_provision_visibility: 'UNAFFECTED',
      closure,
    });
  } catch (error) {
    if (!(error instanceof QxoTierBReviewDependencyClosureError)
      || !LOCALLY_SUPPRESSIBLE_CODES.has(error.code)) {
      throw error;
    }
    return freeze({
      schema_version: 'QXO_TIER_B_REVIEW_DEPENDENCY_CLOSURE_OUTCOME/V1',
      suppressed: true,
      failure_code: error.code,
      underlying_review_provision_visibility: 'UNAFFECTED',
      closure: null,
    });
  }
}

module.exports = {
  MAX_CLOSURE_BYTES,
  QxoTierBReviewDependencyClosureError,
  buildQxoTierBReviewDependencyClosure,
  validateQxoTierBReviewDependencyClosure,
  validateQxoTierBReviewDependencyClosureIsolated,
};
