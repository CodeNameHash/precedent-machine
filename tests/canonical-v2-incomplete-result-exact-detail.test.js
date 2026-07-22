const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildAdmittedResultCompositionDetailPackage,
  validateAdmittedResultCompositionDetailPackage,
} = require('../lib/canonical-v2/admitted-composition-exact-detail');
const {
  buildFixtureResultCompositionDetailPackage,
  validateFixtureResultCompositionDetailPackage,
} = require('../lib/canonical-v2/composition-exact-detail');
const { canonicalJson, contentId, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { buildClaimRevision } = require('../lib/canonical-v2/claims-relationships');
const { compileFixtureContract } = require('../lib/canonical-v2/contract-bundle');
const { validateFixtureExactDetailPackage } = require('../lib/canonical-v2/exact-detail');
const { buildFixtureResultComponent, projectMarketMetricSlot } = require('../lib/canonical-v2/serving-projection');
const {
  buildIncompleteCanonicalResultServingRow,
  validateSharedServingRow,
} = require('../lib/canonical-v2/shared-serving-row');
const {
  buildExcerpt,
  buildFixtureSourceAdmission,
  buildImmutableSource,
  buildSemanticSpan,
} = require('../lib/canonical-v2/source-structure');

const SOURCE_TEXT = [
  'Material contracts include any agreement requiring payments exceeding $10,000,000 in a fiscal year.',
  'The transaction has a headline value of $2,000,000,000.',
].join('\n');

function digest(label) {
  return contentId('INCOMPLETE_RESULT_EXACT_DETAIL_TEST/V1', label);
}

function buildAdmittedSource() {
  const text = SOURCE_TEXT;
  const canonicalTextId = digest(`canonical:${sha256Hex(text)}`);
  const immutableSourceDocumentId = digest('immutable-source');
  const dealAdmissionId = digest('deal-admission');
  const sourceOccurrenceKey = contentId('ADMITTED_SOURCE_OCCURRENCE_KEY/V1', {
    deal_admission_id: dealAdmissionId,
    source_ordinal: 0,
    immutable_source_document_id: immutableSourceDocumentId,
  });
  const sourceContentId = digest('source-content');
  const sourceOccurrenceId = contentId('SOURCE_OCCURRENCE/V1', {
    source_content_id: sourceContentId,
    source_occurrence_key: sourceOccurrenceKey,
  });
  const sourceMapDigest = digest('source-map');
  const textLength = Buffer.byteLength(text, 'utf8');
  const admissionBody = {
    schema_version: 'SOURCE_ADMISSION_MANIFEST/V2',
    admission_state: 'VERIFIED',
    source_kind: 'ORIGINAL_BYTES',
    immutable_source_document_id: immutableSourceDocumentId,
    source_response_content_id: sourceContentId,
    canonical_text_id: canonicalTextId,
    verification_manifest_id: digest('verification'),
    admitted_intervals: [{ start: 0, end: textLength }],
    excluded_intervals: [],
    conversion_loss_residual_ids: [],
    discrepancy_count: 0,
    blocking_discrepancy_count: 0,
    coverage_proof_digest: contentId('SOURCE_ADMISSION_COVERAGE_PROOF/V2', {
      canonical_text_id: canonicalTextId,
      canonical_text_byte_length: textLength,
      source_map_digest: sourceMapDigest,
      admitted_intervals: [{ start: 0, end: textLength }],
      excluded_intervals: [],
      discrepancy_count: 0,
    }),
  };
  const admission = {
    ...admissionBody,
    source_admission_manifest_id: contentId('SOURCE_ADMISSION_MANIFEST/V2', admissionBody),
  };
  const body = {
    schema_version: 'ADMITTED_SEMANTIC_SOURCE_CONTEXT/V1',
    governed_deal_key: 'deal:qxo-topbuild',
    deal_admission_id: dealAdmissionId,
    source_ordinal: 0,
    immutable_source_document_id: immutableSourceDocumentId,
    source_admission_manifest_id: admission.source_admission_manifest_id,
    semantic_extraction_input_envelope_id: digest('semantic-envelope'),
    source_content_id: sourceContentId,
    source_occurrence_id: sourceOccurrenceId,
    source_occurrence_key: sourceOccurrenceKey,
    source_kind: 'ORIGINAL_BYTES',
    document_hash: digest('original-response-bytes'),
    source_byte_length: textLength + 128,
    canonical_text_id: canonicalTextId,
    canonical_text_sha256: sha256Hex(text),
    canonical_text_byte_length: textLength,
    canonical_text: {
      schema_version: 'ADMITTED_CANONICAL_TEXT_RUNTIME/V1',
      canonical_text_id: canonicalTextId,
      text,
    },
    converter_digest: digest('converter'),
    converter_config_digest: digest('converter-config'),
    source_map_encoding: 'DEFLATE_RAW_BASE64_UINT32_TUPLES/V1',
    source_map_compressed_sha256: digest('compressed-source-map'),
    source_map_uncompressed_byte_length: 16,
    input_region_count: 1,
    output_mapping_count: 1,
    source_map_digest: sourceMapDigest,
    verification_manifest_id: admission.verification_manifest_id,
  };
  return {
    source: {
      ...body,
      admitted_semantic_source_context_id: contentId('ADMITTED_SEMANTIC_SOURCE_CONTEXT/V1', body),
    },
    admission,
  };
}

function buildFixtureSource(contract) {
  const source = buildImmutableSource({
    sourceBytes: SOURCE_TEXT,
    sourceOccurrenceKey: 'qxo-incomplete-material-contract-fixture',
  });
  const dealAdmissionId = digest('deal-admission');
  const admission = buildFixtureSourceAdmission({
    source,
    dealKey: 'deal:qxo-topbuild',
    dealAdmissionId,
    contractFingerprint: contract.fingerprint,
    sourceOrdinal: 0,
  });
  return {
    source,
    admission,
  };
}

function evidence(excerpt, role) {
  return {
    evidence_role: role,
    excerpt_id: excerpt.excerpt_id,
    document_ordinal: 0,
    absolute_start: excerpt.absolute_start,
    absolute_end: excerpt.absolute_end,
  };
}

function buildFixture({ admitted = true } = {}) {
  const contract = compileFixtureContract();
  const { source, admission } = admitted ? buildAdmittedSource() : buildFixtureSource(contract);
  const governedDealKey = source.governed_deal_key || admission.governed_deal_key;
  const dealAdmissionId = source.deal_admission_id || admission.deal_admission_id;
  const text = source.canonical_text.text;
  const criterionText = 'payments exceeding $10,000,000 in a fiscal year';
  const denominatorText = 'headline value of $2,000,000,000';
  const criterionStart = Buffer.byteLength(text.slice(0, text.indexOf(criterionText)), 'utf8');
  const denominatorStart = Buffer.byteLength(text.slice(0, text.indexOf(denominatorText)), 'utf8');
  const criterion = buildExcerpt({
    source,
    span: buildSemanticSpan(source, criterionStart, criterionStart + Buffer.byteLength(criterionText)),
  });
  const denominator = buildExcerpt({
    source,
    span: buildSemanticSpan(source, denominatorStart, denominatorStart + Buffer.byteLength(denominatorText)),
  });
  const scopeIds = [criterion.excerpt_id, denominator.excerpt_id].sort();
  const claim = buildClaimRevision({
    subject_occurrence_id: digest('material-contract-component'),
    claim_definition_key: 'MATERIAL_CONTRACT_CASH_FLOW_THRESHOLD_PERCENT_OF_DEAL_VALUE',
    state: 'PRESENT',
    raw_value: '$10,000,000',
    canonical_value: '0.5',
    unit: 'PERCENT_OF_DEAL_VALUE',
    denominator: {
      value: '2000000000',
      currency: 'USD',
      basis: 'HEADLINE_TRANSACTION_VALUE',
      source_lineage_ids: [denominator.excerpt_id],
    },
    attributes: {
      basis_key: 'PERCENT_OF_DEAL_VALUE:HEADLINE_TRANSACTION_VALUE:USD',
      measurement_period_code: 'UNMAPPED_SOURCE_PERIOD',
    },
    allowed_attributes: ['basis_key', 'measurement_period_code'],
    evidence: [
      evidence(criterion, 'OPERATIVE_TEXT'),
      evidence(denominator, 'DERIVATION_INPUT'),
    ],
    scope: {
      scope_closure_id: contentId('CLAIM_SCOPE_CLOSURE/V1', scopeIds),
      coverage_status: 'COMPLETE',
      required_interval_ids: scopeIds,
      examined_interval_ids: scopeIds,
    },
    extraction_version: 'INCOMPLETE_RESULT_EXACT_DETAIL/V1',
    normalisation_version: 'INCOMPLETE_RESULT_EXACT_DETAIL/V1',
    derivation_version: 'INCOMPLETE_RESULT_EXACT_DETAIL/V1',
  });
  const party = { role: 'REPRESENTATION_MAKER', value: 'COMPANY', capacity: 'TARGET' };
  const result = buildFixtureResultComponent({
    deal_admission_id: dealAdmissionId,
    result_key: 'TARGET_MATERIAL_CONTRACT_CASH_FLOW_THRESHOLD',
    result_version: 1,
    concept_key: 'REP-T-CONTRACTS',
    party,
    value_slot_key: 'CASH_FLOW_THRESHOLD',
    ordinal: 0,
    claim,
    relationships: [],
    composition_scope_closure_id: digest('composition-scope'),
    completeness: 'INCOMPLETE',
    comparability: 'NOT_CERTIFIED',
  });
  const corpusReleaseId = digest('corpus-release');
  const projection = projectMarketMetricSlot({
    contract_bundle: contract,
    release_state: 'CANDIDATE_CERTIFIED',
    corpus_release_id: corpusReleaseId,
    deal: {
      deal_key: governedDealKey,
      deal_admission_id: dealAdmissionId,
      document_hash: source.document_hash,
      dimensions: {
        sector: null,
        buyer: 'QXO',
        merger_form: null,
        adviser_firms: [],
        lawyers: [],
        announce_year: 2025,
        deal_value_usd: '2000000000',
      },
    },
    concept_key: 'REP-T-CONTRACTS',
    metric_key: 'MATERIAL_CONTRACT_CASH_FLOW_THRESHOLD_PERCENT_OF_DEAL_VALUE',
    party,
    result,
    claim,
    relationships: [],
    value_slot_key: result.value_slot_key,
    ordinal: result.ordinal,
  });
  const row = buildIncompleteCanonicalResultServingRow({
    contract_bundle: contract,
    frozen_pair_id: digest('frozen-pair'),
    projection_output: projection,
    result,
    claim,
    relationships: [],
    governed_reason_codes: ['UNMAPPED_MEASUREMENT_PERIOD'],
    intersecting_candidates: [{
      open_world_candidate_occurrence_id: digest('candidate-occurrence'),
      final_disposition_id: digest('candidate-disposition'),
      semantic_impact_closure_id: digest('semantic-impact'),
      impact_value: 'AFFECTS_CANONICAL_RESULT',
    }],
  });
  const args = {
    contract_bundle: contract,
    row,
    source,
    source_admission: admission,
    components: [{ component: result, claim, relationships: [] }],
    relationship_targets: [],
    excerpts: [criterion, denominator].sort((left, right) => left.absolute_start - right.absolute_start),
  };
  return {
    args,
    package: admitted
      ? buildAdmittedResultCompositionDetailPackage(args)
      : buildFixtureResultCompositionDetailPackage(args),
    projection,
  };
}

test('an incomplete canonical result opens one exact admitted composition package without changing row kind', () => {
  const fixture = buildFixture();
  const attached = fixture.package.row;
  const body = attached.incomplete_canonical_result;
  const response = fixture.package.detail_payloads[0].response_body;

  assert.equal(validateSharedServingRow(attached), true);
  assert.equal(validateAdmittedResultCompositionDetailPackage({
    package: fixture.package,
    ...fixture.args,
  }), true);
  assert.equal(validateFixtureExactDetailPackage({
    package: fixture.package,
    ...fixture.args,
  }), true);
  assert.equal(attached.row_kind, 'INCOMPLETE_CANONICAL_RESULT');
  assert.equal(Object.hasOwn(attached, 'canonical_result'), false);
  assert.equal(body.result_completeness, 'INCOMPLETE_NOVEL_SEMANTIC');
  assert.equal(body.market_comparability, 'NOT_CERTIFIED');
  assert.deepEqual(body.governed_reason_codes, ['UNMAPPED_MEASUREMENT_PERIOD']);
  assert.equal(body.source_detail_state.state, 'AVAILABLE');
  assert.equal(attached.source_actions[0].action_slot_key, 'RESULT_COMPOSITION_EVIDENCE');
  assert.equal(fixture.package.action_definitions[0].parent_kind, 'RESULT_ROW');
  assert.equal(fixture.package.parent_edges[0].parent_kind, 'RESULT_ROW');
  assert.equal(
    attached.source_actions[0].parent_edge_id,
    fixture.package.parent_edges[0].parent_edge_id,
  );
  assert.equal(response.result_completeness, body.result_completeness);
  assert.equal(response.market_comparability, body.market_comparability);
  assert.deepEqual(response.governed_reason_codes, body.governed_reason_codes);
  assert.equal(
    fixture.package.detail_payloads[0].terminal_object_payload_digest,
    contentId('DERIVED_RESULT_REVISION_PAYLOAD/V1', {
      schema_version: 'DERIVED_RESULT_REVISION/V1',
      derived_result_occurrence_id: body.derived_result_occurrence_id,
      component_revision_ids: body.components.map((component) => component.component_revision_id),
      relationship_set_digests: body.components.map((component) => component.relationship_set_digest),
      result_completeness: body.result_completeness,
      market_comparability: body.market_comparability,
      governed_reason_codes: body.governed_reason_codes,
      intersecting_candidates: body.intersecting_candidates,
    }),
  );
});

test('the incomplete detail payload preserves every component input and exact evidence span', () => {
  const fixture = buildFixture();
  const response = fixture.package.detail_payloads[0].response_body;

  assert.equal(response.components.length, 1);
  assert.equal(response.relationships.length, 0);
  assert.equal(response.excerpts.length, 2);
  assert.deepEqual(
    response.excerpts.map((excerpt) => excerpt.exact_text),
    fixture.args.excerpts.map((excerpt) => excerpt.exact_text),
  );
  assert.deepEqual(
    response.components[0].claim.evidence_references.map((edge) => edge.excerpt_id).sort(),
    fixture.args.excerpts.map((excerpt) => excerpt.excerpt_id).sort(),
  );
  assert.equal(response.source_lineage.document_hash, fixture.args.source.document_hash);
  assert.equal(
    fixture.package.parent_edges[0].parent_row_serving_key,
    fixture.args.row.row_serving_key,
  );
});

test('fixture exact-detail dispatch accepts the same incomplete composition shape', () => {
  const fixture = buildFixture({ admitted: false });

  assert.equal(validateFixtureResultCompositionDetailPackage({
    package: fixture.package,
    ...fixture.args,
  }), true);
  assert.equal(validateFixtureExactDetailPackage({
    package: fixture.package,
    ...fixture.args,
  }), true);
  assert.equal(fixture.package.row.row_kind, 'INCOMPLETE_CANONICAL_RESULT');
  assert.equal(fixture.package.row.source_actions[0].detail_kind, 'RESULT_COMPOSITION_EVIDENCE');
  assert.deepEqual(
    fixture.package.detail_payloads[0].response_body.governed_reason_codes,
    ['UNMAPPED_MEASUREMENT_PERIOD'],
  );
});

test('exact-detail attachment leaves the incomplete base row unchanged and fails closed on disposition drift', () => {
  const fixture = buildFixture();

  assert.equal(fixture.args.row.source_actions.length, 0);
  assert.equal(fixture.args.row.incomplete_canonical_result.source_detail_state.state, 'UNAVAILABLE');
  assert.notEqual(fixture.package.row.canonical_payload_digest, fixture.args.row.canonical_payload_digest);

  const drifted = structuredClone(fixture.package);
  drifted.row.incomplete_canonical_result.governed_reason_codes = ['DIFFERENT_REASON'];
  const rowBody = { ...drifted.row };
  delete rowBody.canonical_payload_digest;
  drifted.row.canonical_payload_digest = contentId('SHARED_SERVING_ROW_PAYLOAD/V1', rowBody);
  assert.throws(() => validateFixtureExactDetailPackage({
    package: drifted,
    ...fixture.args,
  }), /reason code|identity|closure/i);

  assert.equal(canonicalJson(fixture.args.row.incomplete_canonical_result.governed_reason_codes),
    canonicalJson(['UNMAPPED_MEASUREMENT_PERIOD']));
});
