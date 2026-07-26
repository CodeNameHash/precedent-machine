const {
  buildAdmittedSourceReference,
} = require('./admitted-semantic-source');
const { canonicalJson, contentId } = require('./canonical-bytes');
const {
  FIXTURE_CONTRACT_FINGERPRINT_V6,
  validateContractBundle,
} = require('./contract-bundle');
const {
  buildClaimRevision,
  buildRelationshipRevision,
  validateClaimRevisionIdentity,
  validateRelationshipRevisionIdentity,
} = require('./claims-relationships');
const {
  validateQxoAdmittedNoShopActionsF6Slice,
} = require('./reviewed-qxo-admitted-no-shop-actions-f6-slice');
const {
  UNRESOLVED_EFFECT_SPECS,
  validateQxoNoShopExceptionSourceBindingF6CarrierIdentity,
} = require('./qxo-no-shop-exception-source-binding-f6');
const {
  buildExcerpt,
  buildProvisionComponent,
  buildSemanticSpan,
} = require('./source-structure');

const MATERIALISATION_VERSION = 'QXO_NO_SHOP_INLINE_PERMISSION_F9/V1';
const DEAL_KEY = 'deal:qxo-topbuild';
const INLINE_PERMISSION_OPERATION =
  'PERMITS_INFORMING_PERSONS_OF_NO_SHOP_PROVISIONS';
const TARGET_PARTY = Object.freeze({
  role: 'COVENANT_OBLIGOR',
  value: 'COMPANY',
  capacity: 'TARGET',
});
const EXPECTED_ACTION_KEYS = Object.freeze([
  'B_ENGAGE_DISCUSSIONS',
  'B_ENGAGE_NEGOTIATIONS',
  'B_CONTINUE_DISCUSSIONS',
  'B_CONTINUE_NEGOTIATIONS',
  'B_PARTICIPATE_DISCUSSIONS',
  'B_PARTICIPATE_NEGOTIATIONS',
  'B_FURNISH',
  'B_ACCESS_PROPERTIES',
  'B_ACCESS_BOOKS',
  'B_ACCESS_RECORDS',
]);

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function evidenceInput(edge) {
  return {
    evidence_role: edge.evidence_role,
    excerpt_id: edge.excerpt_id,
    document_ordinal: edge.document_ordinal,
    absolute_start: edge.absolute_start,
    absolute_end: edge.absolute_end,
  };
}

function exactExcerpt(sourceContext, edge) {
  const excerpt = buildExcerpt({
    source: sourceContext,
    span: buildSemanticSpan(
      sourceContext,
      edge.absolute_start,
      edge.absolute_end,
    ),
  });
  if (excerpt.excerpt_id !== edge.excerpt_id) {
    throw new TypeError('F9 action evidence no longer matches its exact admitted excerpt');
  }
  return excerpt;
}

function validateInlinePermissionPredecessor({
  sourceContext,
  actionsSlice,
  exceptionSourceBinding,
}) {
  const inlineExcerpt = actionsSlice.deferred_source_excerpts.inline_permission;
  const actionByKey = new Map(actionsSlice.action_occurrences.map(
    (occurrence) => [occurrence.occurrence_key, occurrence],
  ));
  const expectedOutcomes = EXPECTED_ACTION_KEYS.map((occurrenceKey) => {
    const occurrence = actionByKey.get(occurrenceKey);
    if (!occurrence) {
      throw new TypeError('an inline-permission predecessor action is absent');
    }
    return {
      occurrence_key: occurrenceKey,
      suppressed: false,
      failure_code: null,
      action_occurrence_id: occurrence.action_occurrence_id,
      action_occurrence_revision_id:
        occurrence.action_occurrence_revision_id,
    };
  });
  const inlineBody = {
    schema_version:
      'QXO_NO_SHOP_INLINE_PERMISSION_SOURCE_BINDING_F6/V1',
    legal_operation: INLINE_PERMISSION_OPERATION,
    permitted_action_code: 'INFORM_PERSONS_OF_NO_SHOP_PROVISIONS',
    information_subject_code: 'GOVERNING_NO_SHOP_PROVISIONS',
    temporal_scope_inheritance:
      'INHERITS_PARENT_NO_SHOP_RESTRICTION',
    permitted_actor_party: TARGET_PARTY,
    evidence_excerpt_ids: [inlineExcerpt.excerpt_id],
    qualified_action_outcomes: expectedOutcomes,
    source_binding_complete: true,
    relationship_effect_authority: 'NONE',
  };
  const expectedInline = {
    ...inlineBody,
    qxo_no_shop_inline_permission_source_binding_f6_id: contentId(
      'QXO_NO_SHOP_INLINE_PERMISSION_SOURCE_BINDING_F6/V1',
      inlineBody,
    ),
  };
  if (canonicalJson(exceptionSourceBinding.inline_permission_source_binding)
      !== canonicalJson(expectedInline)) {
    throw new TypeError(
      'the reviewed F6 inline-permission binding is not exact',
    );
  }
  const unresolvedByKey = new Map(
    exceptionSourceBinding.unresolved_effects.map(
      (effect) => [effect.action_occurrence_key, effect],
    ),
  );
  if (unresolvedByKey.size !== UNRESOLVED_EFFECT_SPECS.length
    || UNRESOLVED_EFFECT_SPECS.some((spec) => {
      const occurrence = actionByKey.get(spec.action_occurrence_key);
      const unresolved = unresolvedByKey.get(spec.action_occurrence_key);
      return !occurrence
        || !unresolved
        || unresolved.affected_action_code !== spec.affected_action_code
        || unresolved.action_occurrence_id
          !== occurrence.action_occurrence_id
        || unresolved.action_occurrence_revision_id
          !== occurrence.action_occurrence_revision_id
        || unresolved.state !== 'UNMAPPED_FROZEN_EFFECT_OPERATION'
        || unresolved.reason_code
          !== 'F6_EXCEPTION_EFFECT_LEGAL_OPERATION_NOT_FROZEN'
        || unresolved.legal_operation !== null
        || unresolved.absence_authority !== 'NONE'
        || unresolved.comparability_authority !== 'NONE'
        || unresolved.publication_effect
          !== 'BLOCK_DEPENDENT_RESULT_ONLY';
    })) {
    throw new TypeError('the unresolved F6 effect boundary has drifted');
  }
  const retained = exceptionSourceBinding.retained_source_residuals;
  const status = exceptionSourceBinding.status;
  if (!Array.isArray(retained)
    || retained.length === 0
    || retained.length !== status.retained_source_residual_count
    || retained.some((residual) => (
      residual.state !== 'PENDING_GOVERNED_DISPOSITION'
      || residual.publication_effect !== 'BLOCK_DEPENDENT_RESULT_ONLY'
      || residual.absence_authority !== 'NONE'
      || residual.comparability_authority !== 'NONE'
    ))
    || status.unresolved_exception_effect_count
      !== UNRESOLVED_EFFECT_SPECS.length
    || status.publication_blocked !== true
    || status.release_eligible !== false
    || status.review_renderable !== true
    || status.canonical_write_authority !== 'NONE'
    || status.result_authority !== 'NONE'
    || status.metric_authority !== 'NONE'
    || status.comparability_authority !== 'NONE'
    || status.query_authority !== 'NONE'
    || status.serving_authority !== 'NONE'
    || status.release_authority !== 'NONE'
    || !status.blocker_codes.includes(
      'F6_CONTINUE_DISCUSSIONS_EXCEPTION_EFFECT_UNGOVERNED',
    )
    || !status.blocker_codes.includes(
      'F6_CONTINUE_NEGOTIATIONS_EXCEPTION_EFFECT_UNGOVERNED',
    )
    || exceptionSourceBinding.source_binding.document_hash
      !== sourceContext.document_hash
    || exceptionSourceBinding.source_binding.canonical_text_id
      !== sourceContext.canonical_text_id) {
    throw new TypeError('the reviewed F6 publication boundary has drifted');
  }
}

function validateInputs({
  sourceContext,
  contractBundle,
  actionsSlice,
  exceptionSourceBinding,
}) {
  validateContractBundle(contractBundle);
  if (contractBundle.fingerprint !== FIXTURE_CONTRACT_FINGERPRINT_V6) {
    throw new TypeError('the exact frozen F6 contract is required');
  }
  if (sourceContext?.governed_deal_key !== DEAL_KEY) {
    throw new TypeError('the governed QXO deal is required');
  }
  buildAdmittedSourceReference(sourceContext);
  validateQxoAdmittedNoShopActionsF6Slice({
    sourceContext,
    contractBundle,
    slice: actionsSlice,
  });
  validateQxoNoShopExceptionSourceBindingF6CarrierIdentity(
    exceptionSourceBinding,
  );
  if (exceptionSourceBinding.source_binding.admitted_semantic_source_context_id
      !== sourceContext.admitted_semantic_source_context_id
    || exceptionSourceBinding.contract_binding.contract_fingerprint
      !== contractBundle.fingerprint
    || exceptionSourceBinding.status.inline_permission_source_binding_complete
      !== true
  ) {
    throw new TypeError('the reviewed F6 inline-permission predecessor is invalid');
  }
  validateInlinePermissionPredecessor({
    sourceContext,
    actionsSlice,
    exceptionSourceBinding,
  });
}

function buildQxoNoShopInlinePermissionF9({
  sourceContext,
  contractBundle,
  actionsSlice,
  exceptionSourceBinding,
} = {}) {
  validateInputs({
    sourceContext,
    contractBundle,
    actionsSlice,
    exceptionSourceBinding,
  });

  const actionByKey = new Map(actionsSlice.action_occurrences.map(
    (occurrence, index) => [
      occurrence.occurrence_key,
      {
        occurrence,
        component: actionsSlice.action_components[index],
      },
    ],
  ));
  const reviewedOutcomes =
    exceptionSourceBinding.inline_permission_source_binding.qualified_action_outcomes;
  if (canonicalJson(reviewedOutcomes.map((outcome) => outcome.occurrence_key))
      !== canonicalJson(EXPECTED_ACTION_KEYS)
    || reviewedOutcomes.some((outcome) => outcome.suppressed)) {
    throw new TypeError('the reviewed inline-permission action scope has drifted');
  }

  const selected = EXPECTED_ACTION_KEYS.map((occurrenceKey) => {
    const mapped = actionByKey.get(occurrenceKey);
    if (!mapped) throw new TypeError('an inline-permission action endpoint is unresolved');
    return mapped;
  });
  const componentIdByReviewedOccurrenceId = new Map(
    actionsSlice.action_occurrences.map((occurrence, index) => [
      occurrence.action_occurrence_id,
      actionsSlice.action_components[index].provision_component_id,
    ]),
  );

  const excerptsById = new Map();
  for (const { occurrence } of selected) {
    for (const edge of occurrence.claim.evidence) {
      const excerpt = exactExcerpt(sourceContext, edge);
      excerptsById.set(excerpt.excerpt_id, excerpt);
    }
  }
  const inlineExcerpt = actionsSlice.deferred_source_excerpts.inline_permission;
  excerptsById.set(inlineExcerpt.excerpt_id, inlineExcerpt);

  const permissionComponent = buildProvisionComponent({
    source: sourceContext,
    parentProvision: actionsSlice.prohibition_provision,
    span: buildSemanticSpan(
      sourceContext,
      inlineExcerpt.absolute_start,
      inlineExcerpt.absolute_end,
    ),
    componentKey: 'EXCEPTION_LIMB',
    ordinal: 1,
    contractBundle,
  });

  const claims = selected.map(({ occurrence, component }) => {
    const predecessorClaim = occurrence.claim;
    const methodIds = predecessorClaim.attributes.method_of_action_occurrence_ids
      .map((reviewedId) => {
        const componentId = componentIdByReviewedOccurrenceId.get(reviewedId);
        if (!componentId) {
          throw new TypeError('an F9 method-of-action endpoint is unresolved');
        }
        return componentId;
      });
    const claim = buildClaimRevision({
      subject_occurrence_id: component.provision_component_id,
      claim_definition_key: 'NO_SHOP_PROHIBITED_ACTION',
      claim_definition_version: 2,
      ordinal: 0,
      state: 'PRESENT',
      raw_value: predecessorClaim.raw_value,
      canonical_value: predecessorClaim.canonical_value,
      attributes: {
        source_limb_code: predecessorClaim.attributes.source_limb_code,
        governed_ordinal: predecessorClaim.attributes.governed_ordinal,
        knowledge_qualifier_code:
          predecessorClaim.attributes.knowledge_qualifier_code,
        method_of_action_occurrence_ids: methodIds,
        reviewed_predecessor_action_occurrence_id:
          occurrence.action_occurrence_id,
        reviewed_predecessor_action_occurrence_revision_id:
          occurrence.action_occurrence_revision_id,
      },
      allowed_attributes: [
        'source_limb_code',
        'governed_ordinal',
        'knowledge_qualifier_code',
        'method_of_action_occurrence_ids',
        'reviewed_predecessor_action_occurrence_id',
        'reviewed_predecessor_action_occurrence_revision_id',
      ],
      taxonomy_codes: predecessorClaim.taxonomy_codes,
      codebooks: {
        prohibited_action: contractBundle.claim_definitions.find(
          (definition) => (
            definition.claim_definition_key === 'NO_SHOP_PROHIBITED_ACTION'
          ),
        ).allowed_canonical_values,
      },
      evidence: predecessorClaim.evidence.map(evidenceInput),
      scope: predecessorClaim.scope,
      extraction_version: MATERIALISATION_VERSION,
      normalisation_version: MATERIALISATION_VERSION,
      derivation_version: MATERIALISATION_VERSION,
    });
    validateClaimRevisionIdentity(claim);
    return claim;
  });

  const qualifiedActionOccurrenceIds = selected.map(
    ({ component }) => component.provision_component_id,
  );
  const relationshipEvidence = [{
    evidence_role: 'EXCEPTION',
    excerpt_id: inlineExcerpt.excerpt_id,
    document_ordinal: sourceContext.source_ordinal,
    absolute_start: inlineExcerpt.absolute_start,
    absolute_end: inlineExcerpt.absolute_end,
  }];
  const relationshipEvidenceExcerptIds = relationshipEvidence.map(
    (edge) => edge.excerpt_id,
  );
  const relationshipScope = {
    scope_closure_id: contentId('QXO_NO_SHOP_INLINE_PERMISSION_SCOPE_F9/V1', {
      source_provision_instance_id:
        actionsSlice.prohibition_provision.provision_instance_id,
      target_permission_component_id:
        permissionComponent.provision_component_id,
      qualified_action_occurrence_ids: qualifiedActionOccurrenceIds,
      cross_reference_excerpt_id: inlineExcerpt.excerpt_id,
    }),
    coverage_status: 'PARTIAL_POSITIVE_GRAPH',
    required_interval_ids: relationshipEvidenceExcerptIds,
    examined_interval_ids: relationshipEvidenceExcerptIds,
    target_interval_ids: [inlineExcerpt.excerpt_id],
  };
  const retainedResidualsDigest = contentId(
    'QXO_NO_SHOP_ACTION_RETAINED_RESIDUAL_SET_F9/V1',
    actionsSlice.retained_residuals.map((residual) => ({
      residual_code: residual.residual_code,
      evidence_excerpt_id: residual.evidence_excerpt_id,
      publication_effect: residual.publication_effect,
    })),
  );
  const predecessorBindings = selected.map(({ occurrence, component }) => ({
    reviewed_action_occurrence_id: occurrence.action_occurrence_id,
    reviewed_action_occurrence_revision_id:
      occurrence.action_occurrence_revision_id,
    canonical_action_component_id: component.provision_component_id,
  }));
  const relationship = buildRelationshipRevision({
    source_occurrence_id:
      actionsSlice.prohibition_provision.provision_instance_id,
    relationship_definition_key: 'EXCEPTED_BY',
    relationship_definition_version: 2,
    ordinal: 0,
    state: 'PRESENT',
    raw_scope: inlineExcerpt.exact_text,
    target_occurrence_ids: [permissionComponent.provision_component_id],
    effect: {
      effect_mode: 'TYPED_LEGAL_EFFECT',
      legal_operation: INLINE_PERMISSION_OPERATION,
      permitted_action_code: 'INFORM_PERSONS_OF_NO_SHOP_PROVISIONS',
      qualified_action_occurrence_ids: qualifiedActionOccurrenceIds,
      permitted_actor_party: TARGET_PARTY,
      information_subject_code: 'GOVERNING_NO_SHOP_PROVISIONS',
      temporal_scope_inheritance:
        'INHERITS_PARENT_NO_SHOP_RESTRICTION',
      cross_reference_excerpt_id: inlineExcerpt.excerpt_id,
      evidence_excerpt_ids: relationshipEvidenceExcerptIds,
      scope_closure_id: relationshipScope.scope_closure_id,
    },
    evidence: relationshipEvidence,
    scope: relationshipScope,
    attributes: {
      materialisation_scope: 'POSITIVE_INLINE_PERMISSION_ONLY',
      reviewed_actions_mapping_id:
        actionsSlice.reviewed_mapping.reviewed_mapping_id,
      reviewed_actions_mapping_payload_digest:
        actionsSlice.reviewed_mapping.canonical_payload_digest,
      reviewed_exception_source_binding_id:
        exceptionSourceBinding.qxo_no_shop_exception_source_binding_f6_id,
      reviewed_exception_source_binding_payload_digest:
        exceptionSourceBinding.canonical_payload_digest,
      reviewed_predecessor_bindings: predecessorBindings,
      qualified_action_claim_revision_ids:
        claims.map((claim) => claim.claim_revision_id),
      retained_source_residual_count: actionsSlice.retained_residuals.length,
      retained_source_residuals_digest: retainedResidualsDigest,
    },
    allowed_attributes: [
      'materialisation_scope',
      'reviewed_actions_mapping_id',
      'reviewed_actions_mapping_payload_digest',
      'reviewed_exception_source_binding_id',
      'reviewed_exception_source_binding_payload_digest',
      'reviewed_predecessor_bindings',
      'qualified_action_claim_revision_ids',
      'retained_source_residual_count',
      'retained_source_residuals_digest',
    ],
    resolver_version: MATERIALISATION_VERSION,
  });
  validateRelationshipRevisionIdentity(relationship);

  const materialisationBody = {
    schema_version: 'QXO_NO_SHOP_INLINE_PERMISSION_F9/V1',
    materialisation_version: MATERIALISATION_VERSION,
    contract_fingerprint: contractBundle.fingerprint,
    governed_deal_key: DEAL_KEY,
    deal_admission_id: sourceContext.deal_admission_id,
    source_admission_manifest_id: sourceContext.source_admission_manifest_id,
    reviewed_actions_mapping_id:
      actionsSlice.reviewed_mapping.reviewed_mapping_id,
    reviewed_exception_source_binding_id:
      exceptionSourceBinding.qxo_no_shop_exception_source_binding_f6_id,
    relationship_revision_id: relationship.relationship_revision_id,
    qualified_action_occurrence_ids: qualifiedActionOccurrenceIds,
    retained_source_residual_count: actionsSlice.retained_residuals.length,
    retained_source_residuals_digest: retainedResidualsDigest,
  };
  const materialisationId = contentId(
    'QXO_NO_SHOP_INLINE_PERMISSION_F9/V1',
    materialisationBody,
  );
  const closureId = contentId('QXO_NO_SHOP_INLINE_PERMISSION_CLOSURE_F9/V1', {
    materialisation_id: materialisationId,
    relationship_revision_id: relationship.relationship_revision_id,
    claim_revision_ids: claims.map((claim) => claim.claim_revision_id),
  });
  const close = (rows) => rows.map((row) => ({ ...row, closure_id: closureId }));
  const writeSet = {
    source_references: [buildAdmittedSourceReference(sourceContext)],
    deal: {
      deal_key: DEAL_KEY,
      deal_admission_id: sourceContext.deal_admission_id,
      document_hash: sourceContext.document_hash,
    },
    excerpts: close([...excerptsById.values()]),
    validated_semantic_graphs: [],
    provisions: close([actionsSlice.prohibition_provision]),
    components: close([
      ...selected.map(({ component }) => component),
      permissionComponent,
    ]),
    claims: close(claims),
    relationships: close([relationship]),
    open_world_candidates: [],
    open_world_candidate_occurrences: [],
    open_world_evidence_references: [],
    open_world_candidate_dispositions: [],
    open_world_primitives: [],
    semantic_impact_closures: [],
    reviewed_source_specific_rows: [],
    incomplete_canonical_result_rows: [],
  };
  return freeze({
    ...materialisationBody,
    qxo_no_shop_inline_permission_f9_id: materialisationId,
    semantic_closure_id: closureId,
    permission_component: permissionComponent,
    action_components: selected.map(({ component }) => component),
    action_claims: claims,
    relationship,
    retained_source_residuals:
      actionsSlice.retained_residuals,
    canonical_write_set: writeSet,
    status: {
      canonical_write_authority: 'POSITIVE_INLINE_PERMISSION_GRAPH_ONLY',
      review_renderable: true,
      section_4_3_scope_complete: false,
      absence_authority: 'NONE',
      result_authority: 'NONE',
      metric_authority: 'NONE',
      comparability_authority: 'NONE',
      query_authority: 'NONE',
      serving_authority: 'NONE',
      release_authority: 'NONE',
      release_eligible: false,
    },
  });
}

function validateQxoNoShopInlinePermissionF9({
  qxoNoShopInlinePermissionF9,
  ...input
} = {}) {
  const expected = buildQxoNoShopInlinePermissionF9(input);
  if (canonicalJson(qxoNoShopInlinePermissionF9) !== canonicalJson(expected)) {
    throw new TypeError('the QXO F9 inline-permission materialisation has drifted');
  }
  return true;
}

module.exports = {
  EXPECTED_ACTION_KEYS,
  INLINE_PERMISSION_OPERATION,
  MATERIALISATION_VERSION,
  buildQxoNoShopInlinePermissionF9,
  validateQxoNoShopInlinePermissionF9,
};
