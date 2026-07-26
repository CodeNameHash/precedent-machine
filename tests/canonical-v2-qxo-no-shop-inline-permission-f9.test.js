const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const fixture = require('./fixtures/canonical-v2/qxo-no-shop-f6-source-spans.json');
const { canonicalJson, contentId, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const {
  compileFixtureContractV6,
} = require('../lib/canonical-v2/contract-bundle');
const {
  buildQxoAdmittedNoShopActionsF6Slice,
} = require('../lib/canonical-v2/reviewed-qxo-admitted-no-shop-actions-f6-slice');
const {
  EXPECTED_ACTION_KEYS,
  buildQxoNoShopInlinePermissionF9,
  validateQxoNoShopInlinePermissionF9,
} = require('../lib/canonical-v2/qxo-no-shop-inline-permission-f9');
const {
  validateResolvedCanonicalWriteSet,
} = require('../lib/canonical-v2/validate-write-set');

function digest(label) {
  return contentId('QXO_NO_SHOP_F9_TEST_SOURCE/V1', label);
}

function resignRelationship(row) {
  row.relationship_revision_id = contentId(
    'RELATIONSHIP_REVISION/V1',
    {
      relationship_occurrence_id: row.relationship_occurrence_id,
      source_occurrence_id: row.source_occurrence_id,
      relationship_definition_key: row.relationship_definition_key,
      relationship_definition_version: row.relationship_definition_version,
      ordinal: row.ordinal,
      state: row.state,
      raw_scope: row.raw_scope,
      scope: row.scope,
      applicability: row.applicability,
      not_examined: row.not_examined,
      failure: row.failure,
      target_occurrence_ids: row.target_occurrence_ids,
      effect: row.effect,
      evidence_ids: row.evidence_ids,
      attributes: row.attributes,
      taxonomy_codes: row.taxonomy_codes,
      resolver_version: row.resolver_version,
    },
  );
}

function resignCarrier(carrier) {
  const body = structuredClone(carrier);
  delete body.qxo_no_shop_exception_source_binding_f6_id;
  delete body.canonical_payload_digest;
  carrier.qxo_no_shop_exception_source_binding_f6_id = contentId(
    'QXO_NO_SHOP_EXCEPTION_SOURCE_BINDING_F6/V1',
    body,
  );
  carrier.canonical_payload_digest = contentId(
    'QXO_NO_SHOP_EXCEPTION_SOURCE_BINDING_F6_PAYLOAD/V1',
    body,
  );
}

function sourceContext(contractBundle) {
  const bytes = Buffer.alloc(fixture.canonical_text_byte_length, 0x20);
  for (const [key, pin] of Object.entries(fixture.spans)) {
    const exact = Buffer.from(pin.base64, 'base64');
    assert.equal(exact.length, pin.end - pin.start, key);
    assert.equal(sha256Hex(exact), pin.sha256, key);
    exact.copy(bytes, pin.start);
  }
  const text = bytes.toString('utf8');
  const sourceAdmissionManifestId = digest('source-admission');
  const dealAdmissionId = contentId('DEAL_ADMISSION/V2', {
    governed_deal_key: 'deal:qxo-topbuild',
    source_admission_manifest_id: sourceAdmissionManifestId,
    contract_fingerprint: contractBundle.fingerprint,
  });
  const immutableSourceDocumentId = digest('immutable-source');
  const sourceContentId = digest('source-content');
  const sourceOccurrenceKey = contentId('ADMITTED_SOURCE_OCCURRENCE_KEY/V1', {
    deal_admission_id: dealAdmissionId,
    source_ordinal: 0,
    immutable_source_document_id: immutableSourceDocumentId,
  });
  const body = {
    schema_version: 'ADMITTED_SEMANTIC_SOURCE_CONTEXT/V1',
    governed_deal_key: 'deal:qxo-topbuild',
    deal_admission_id: dealAdmissionId,
    source_ordinal: 0,
    immutable_source_document_id: immutableSourceDocumentId,
    source_admission_manifest_id: sourceAdmissionManifestId,
    semantic_extraction_input_envelope_id: digest('envelope'),
    source_content_id: sourceContentId,
    source_occurrence_id: contentId('SOURCE_OCCURRENCE/V1', {
      source_content_id: sourceContentId,
      source_occurrence_key: sourceOccurrenceKey,
    }),
    source_occurrence_key: sourceOccurrenceKey,
    source_kind: 'ORIGINAL_BYTES',
    document_hash: fixture.document_sha256,
    source_byte_length: fixture.canonical_text_byte_length + 1000,
    canonical_text_id: fixture.canonical_text_id,
    canonical_text_sha256: sha256Hex(Buffer.from(text, 'utf8')),
    canonical_text_byte_length: fixture.canonical_text_byte_length,
    canonical_text: {
      schema_version: 'ADMITTED_CANONICAL_TEXT_RUNTIME/V1',
      canonical_text_id: fixture.canonical_text_id,
      text,
    },
    converter_digest: digest('converter'),
    converter_config_digest: digest('converter-config'),
    source_map_encoding: 'GZIP_BASE64_JSON_V1',
    source_map_compressed_sha256: digest('source-map-compressed'),
    source_map_uncompressed_byte_length: 1,
    input_region_count: 1,
    output_mapping_count: 1,
    source_map_digest: digest('source-map'),
    verification_manifest_id: digest('verification'),
  };
  return Object.freeze({
    ...body,
    admitted_semantic_source_context_id: contentId(
      'ADMITTED_SEMANTIC_SOURCE_CONTEXT/V1',
      body,
    ),
  });
}

function predecessorCarrier(source, contractBundle, actionsSlice) {
  const inlineBody = {
    schema_version:
      'QXO_NO_SHOP_INLINE_PERMISSION_SOURCE_BINDING_F6/V1',
    legal_operation:
      'PERMITS_INFORMING_PERSONS_OF_NO_SHOP_PROVISIONS',
    permitted_action_code: 'INFORM_PERSONS_OF_NO_SHOP_PROVISIONS',
    information_subject_code: 'GOVERNING_NO_SHOP_PROVISIONS',
    temporal_scope_inheritance:
      'INHERITS_PARENT_NO_SHOP_RESTRICTION',
    permitted_actor_party: {
      role: 'COVENANT_OBLIGOR',
      value: 'COMPANY',
      capacity: 'TARGET',
    },
    evidence_excerpt_ids: [
      actionsSlice.deferred_source_excerpts.inline_permission.excerpt_id,
    ],
    qualified_action_outcomes: EXPECTED_ACTION_KEYS.map((occurrenceKey) => {
      const occurrence = actionsSlice.action_occurrences.find(
        (candidate) => candidate.occurrence_key === occurrenceKey,
      );
      return {
        occurrence_key: occurrenceKey,
        suppressed: false,
        failure_code: null,
        action_occurrence_id: occurrence.action_occurrence_id,
        action_occurrence_revision_id:
          occurrence.action_occurrence_revision_id,
      };
    }),
    source_binding_complete: true,
    relationship_effect_authority: 'NONE',
  };
  const inlinePermissionSourceBinding = {
    ...inlineBody,
    qxo_no_shop_inline_permission_source_binding_f6_id: contentId(
      'QXO_NO_SHOP_INLINE_PERMISSION_SOURCE_BINDING_F6/V1',
      inlineBody,
    ),
  };
  const unresolvedEffects = [
    ['B_CONTINUE_DISCUSSIONS', 'CONTINUE_DISCUSSIONS'],
    ['B_CONTINUE_NEGOTIATIONS', 'CONTINUE_NEGOTIATIONS'],
  ].map(([occurrenceKey, actionCode]) => {
    const occurrence = actionsSlice.action_occurrences.find(
      (candidate) => candidate.occurrence_key === occurrenceKey,
    );
    return {
      action_occurrence_key: occurrenceKey,
      affected_action_code: actionCode,
      action_occurrence_id: occurrence.action_occurrence_id,
      action_occurrence_revision_id:
        occurrence.action_occurrence_revision_id,
      state: 'UNMAPPED_FROZEN_EFFECT_OPERATION',
      reason_code: 'F6_EXCEPTION_EFFECT_LEGAL_OPERATION_NOT_FROZEN',
      legal_operation: null,
      absence_authority: 'NONE',
      comparability_authority: 'NONE',
      publication_effect: 'BLOCK_DEPENDENT_RESULT_ONLY',
    };
  });
  const retainedSourceResiduals = [{
    state: 'PENDING_GOVERNED_DISPOSITION',
    publication_effect: 'BLOCK_DEPENDENT_RESULT_ONLY',
    absence_authority: 'NONE',
    comparability_authority: 'NONE',
  }];
  const body = {
    schema_version: 'QXO_NO_SHOP_EXCEPTION_SOURCE_BINDING_F6/V1',
    authority_scope:
      'OFFLINE_REVIEWED_QXO_NO_SHOP_EXCEPTION_SOURCE_BINDINGS_F6_ONLY',
    contract_binding: {
      contract_fingerprint: contractBundle.fingerprint,
    },
    source_binding: {
      admitted_semantic_source_context_id:
        source.admitted_semantic_source_context_id,
      document_hash: source.document_hash,
      canonical_text_id: source.canonical_text_id,
    },
    upstream_bindings: {},
    party_binding: {},
    governed_scopes: {},
    source_evidence: [],
    prerequisite_outcomes: [],
    exception_effect_outcomes: [],
    inline_permission_source_binding: inlinePermissionSourceBinding,
    unresolved_effects: unresolvedEffects,
    retained_source_residuals: retainedSourceResiduals,
    notice_dependency: {},
    definition_relationship_dependency: {},
    status: {
      inline_permission_source_binding_complete: true,
      unresolved_exception_effect_count: 2,
      retained_source_residual_count: 1,
      publication_blocked: true,
      release_eligible: false,
      review_renderable: true,
      canonical_write_authority: 'NONE',
      result_authority: 'NONE',
      metric_authority: 'NONE',
      comparability_authority: 'NONE',
      query_authority: 'NONE',
      serving_authority: 'NONE',
      release_authority: 'NONE',
      blocker_codes: [
        'F6_CONTINUE_DISCUSSIONS_EXCEPTION_EFFECT_UNGOVERNED',
        'F6_CONTINUE_NEGOTIATIONS_EXCEPTION_EFFECT_UNGOVERNED',
      ],
    },
  };
  return {
    ...body,
    qxo_no_shop_exception_source_binding_f6_id: contentId(
      'QXO_NO_SHOP_EXCEPTION_SOURCE_BINDING_F6/V1',
      body,
    ),
    canonical_payload_digest: contentId(
      'QXO_NO_SHOP_EXCEPTION_SOURCE_BINDING_F6_PAYLOAD/V1',
      body,
    ),
  };
}

function build() {
  const contractBundle = compileFixtureContractV6();
  const source = sourceContext(contractBundle);
  const actionsSlice = buildQxoAdmittedNoShopActionsF6Slice({
    sourceContext: source,
    contractBundle,
  });
  const exceptionSourceBinding = predecessorCarrier(
    source,
    contractBundle,
    actionsSlice,
  );
  return {
    contractBundle,
    source,
    actionsSlice,
    exceptionSourceBinding,
    materialisation: buildQxoNoShopInlinePermissionF9({
      sourceContext: source,
      contractBundle,
      actionsSlice,
      exceptionSourceBinding,
    }),
  };
}

test('F9 materialises one narrow provision-level permission over ten canonical action components', () => {
  const built = build();
  const first = built.materialisation;
  const second = build().materialisation;
  assert.equal(canonicalJson(first), canonicalJson(second));
  assert.equal(validateQxoNoShopInlinePermissionF9({
    qxoNoShopInlinePermissionF9: first,
    sourceContext: built.source,
    contractBundle: built.contractBundle,
    actionsSlice: built.actionsSlice,
    exceptionSourceBinding: built.exceptionSourceBinding,
  }), true);
  assert.equal(first.action_components.length, 10);
  assert.equal(first.action_claims.length, 10);
  assert.equal(first.relationship.source_occurrence_id,
    built.actionsSlice.prohibition_provision.provision_instance_id);
  assert.deepEqual(first.relationship.target_occurrence_ids, [
    first.permission_component.provision_component_id,
  ]);
  assert.deepEqual(
    first.relationship.effect.qualified_action_occurrence_ids,
    first.action_components.map((component) => component.provision_component_id),
  );
  assert.equal(
    first.relationship.effect.permitted_action_code,
    'INFORM_PERSONS_OF_NO_SHOP_PROVISIONS',
  );
  assert.equal(
    first.relationship.scope.coverage_status,
    'PARTIAL_POSITIVE_GRAPH',
  );
  assert.deepEqual(
    first.relationship.attributes.qualified_action_claim_revision_ids,
    first.action_claims.map((claim) => claim.claim_revision_id),
  );
  assert.equal(first.status.section_4_3_scope_complete, false);
  assert.equal(first.status.comparability_authority, 'NONE');
});

test('the authoritative writer accepts the exact partial positive graph with zero residuals', () => {
  const built = build();
  const validation = validateResolvedCanonicalWriteSet({
    writeSet: built.materialisation.canonical_write_set,
    contractBundle: built.contractBundle,
    admittedSourceContexts: [built.source],
    retainedCanonicalObjects: [],
  });
  assert.equal(
    validation.counts.residuals,
    0,
    JSON.stringify(validation.residuals),
  );
  assert.equal(validation.counts.quarantinedClosures, 0);
  assert.equal(validation.publishableWriteSet.relationships.length, 1);
  assert.equal(validation.publishableWriteSet.claims.length, 10);
});

test('an unresolved or invented qualified action quarantines the entire F9 closure', () => {
  const built = build();
  const writeSet = structuredClone(
    built.materialisation.canonical_write_set,
  );
  writeSet.relationships[0].effect.qualified_action_occurrence_ids[0]
    = digest('invented-action');
  const validation = validateResolvedCanonicalWriteSet({
    writeSet,
    contractBundle: built.contractBundle,
    admittedSourceContexts: [built.source],
    retainedCanonicalObjects: [],
  });
  assert.ok(validation.counts.residuals > 0);
  assert.equal(validation.counts.quarantinedClosures, 1);
  assert.equal(validation.publishableWriteSet.relationships.length, 0);
  assert.equal(validation.publishableWriteSet.claims.length, 0);
});

test('a re-signed unknown no-shop legal operation fails closed', () => {
  const built = build();
  const writeSet = structuredClone(
    built.materialisation.canonical_write_set,
  );
  writeSet.relationships[0].effect.legal_operation =
    'PERMITS_DISCUSSIONS_OR_NEGOTIATIONS';
  resignRelationship(writeSet.relationships[0]);
  const validation = validateResolvedCanonicalWriteSet({
    writeSet,
    contractBundle: built.contractBundle,
    admittedSourceContexts: [built.source],
    retainedCanonicalObjects: [],
  });
  assert.equal(validation.counts.quarantinedClosures, 1);
  assert.equal(validation.publishableWriteSet.relationships.length, 0);
  assert.equal(
    validation.residuals.some(
      (residual) => residual.reason_code === 'PRESENT_WITHOUT_EFFECT',
    ),
    true,
  );
});

test('a self-signed drifted F6 inline predecessor is rejected', () => {
  const built = build();
  const predecessor = structuredClone(built.exceptionSourceBinding);
  predecessor.inline_permission_source_binding.permitted_actor_party.value =
    'PARENT';
  const inlineBody = structuredClone(
    predecessor.inline_permission_source_binding,
  );
  delete inlineBody.qxo_no_shop_inline_permission_source_binding_f6_id;
  predecessor.inline_permission_source_binding
    .qxo_no_shop_inline_permission_source_binding_f6_id = contentId(
      'QXO_NO_SHOP_INLINE_PERMISSION_SOURCE_BINDING_F6/V1',
      inlineBody,
    );
  resignCarrier(predecessor);
  assert.throws(() => buildQxoNoShopInlinePermissionF9({
    sourceContext: built.source,
    contractBundle: built.contractBundle,
    actionsSlice: built.actionsSlice,
    exceptionSourceBinding: predecessor,
  }), /inline-permission binding is not exact/);
});

test('a stripped and re-signed unknown no-shop exception effect fails closed', () => {
  const built = build();
  const writeSet = structuredClone(
    built.materialisation.canonical_write_set,
  );
  writeSet.relationships[0].effect = {
    effect_mode: 'TYPED_LEGAL_EFFECT',
    legal_operation: 'PERMITS_DISCUSSIONS_OR_NEGOTIATIONS',
  };
  resignRelationship(writeSet.relationships[0]);
  const validation = validateResolvedCanonicalWriteSet({
    writeSet,
    contractBundle: built.contractBundle,
    admittedSourceContexts: [built.source],
    retainedCanonicalObjects: [],
  });
  assert.equal(
    validation.residuals.some(
      (residual) => residual.reason_code === 'PRESENT_WITHOUT_EFFECT',
    ),
    true,
  );
  assert.equal(validation.publishableWriteSet.relationships.length, 0);
  assert.equal(validation.quarantinedClosureIds.includes(
    built.materialisation.semantic_closure_id,
  ), true);
});

test('the staging unknown-effect probe carries a valid closed receipt', async () => {
  const built = build();
  const { buildUnknownEffectProbe } = await import(
    '../scripts/canonical-v2-staging-qxo-no-shop-inline-permission-f9.mjs'
  );
  const probe = buildUnknownEffectProbe(
    built.materialisation.canonical_write_set,
  );
  const receiptBody = structuredClone(probe.receipt);
  delete receiptBody.receiptId;

  assert.equal(
    probe.writeSet.relationships[0].effect.legal_operation,
    'PERMITS_DISCUSSIONS_OR_NEGOTIATIONS',
  );
  assert.equal(probe.receipt.operation, 'DEAL_SCOPE_RUN');
  assert.equal(probe.receipt.idempotencyKey, probe.idempotencyKey);
  assert.equal(probe.receipt.inputDigest, probe.inputDigest);
  assert.equal(probe.receipt.receiptId, contentId(
    'CANONICAL_WRITE_RECEIPT/V1',
    receiptBody,
  ));
});

test('the staging writer is rollback-first, bounded and cannot activate a release', () => {
  const runner = fs.readFileSync(
    'scripts/canonical-v2-staging-qxo-no-shop-inline-permission-f9.mjs',
    'utf8',
  );
  assert.match(runner, /MAX_WRITER_REQUEST_BYTES = 512 \* 1024/);
  assert.match(runner, /SET LOCAL statement_timeout='60000ms'/);
  assert.match(runner, /runSql\(writerSql\(write\)\);[\s\S]*Rollback-first/);
  assert.match(runner, /active_corpus_release_pointers/);
  assert.match(runner, /legacy_deal_admission_id/);
  assert.match(runner, /verifyUnknownEffectRejected\(write\)/);
  assert.match(runner, /PERMITS_DISCUSSIONS_OR_NEGOTIATIONS/);
  assert.match(runner, /release_authority: 'NONE'/);
  assert.doesNotMatch(
    runner,
    /(?:activate_candidate|active_corpus_release_pointer_history|candidate_release_import)/,
  );
});
