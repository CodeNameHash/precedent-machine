const test = require('node:test');
const assert = require('node:assert/strict');

const { contentId, utf8ByteLength } = require('../lib/canonical-v2/canonical-bytes');
const { buildClaimRevision } = require('../lib/canonical-v2/claims-relationships');
const { compileFixtureContract } = require('../lib/canonical-v2/contract-bundle');
const {
  InMemoryCanonicalRepository,
  createCanonicalWriter,
} = require('../lib/canonical-v2/canonical-writer');
const { buildFixtureResultComponent, projectMarketMetricSlot } = require('../lib/canonical-v2/serving-projection');
const { buildIncompleteCanonicalResultServingRow } = require('../lib/canonical-v2/shared-serving-row');
const {
  buildExcerpt,
  buildFixtureSourceAdmission,
  buildImmutableSource,
  buildProvisionComponent,
  buildProvisionInstance,
  buildSemanticSpan,
} = require('../lib/canonical-v2/source-structure');

const contract = compileFixtureContract();
const digest = (value) => contentId('INCOMPLETE_CANONICAL_WRITER_TEST/V1', value);
const dealAdmissionId = digest('deal-admission');
const corpusReleaseId = digest('corpus-release');
const incompleteClosureId = digest('closure:incomplete-material-contract-period');
const familiarClosureId = digest('closure:familiar-capitalisation');
const party = Object.freeze({ role: 'REPRESENTATION_MAKER', value: 'COMPANY', capacity: 'TARGET' });
const sourceText = [
  'Material contracts include agreements requiring payments over $10,000,000 for actual 2025 or contemplated 2026 cash flow.',
  'The transaction has a headline value of $2,000,000,000.',
  'The capitalisation representation is not knowledge qualified.',
].join('\n');

function byteInterval(text) {
  const characterStart = sourceText.indexOf(text);
  assert.notEqual(characterStart, -1);
  const start = utf8ByteLength(sourceText.slice(0, characterStart));
  return { start, end: start + utf8ByteLength(text) };
}

function evidence(excerpt, role = 'OPERATIVE_TEXT') {
  return {
    evidence_role: role,
    excerpt_id: excerpt.excerpt_id,
    document_ordinal: 0,
    absolute_start: excerpt.absolute_start,
    absolute_end: excerpt.absolute_end,
  };
}

function close(rows, closureId) {
  return rows.map((row) => ({ ...row, closure_id: closureId }));
}

function buildFixtureWriteSet() {
  const source = buildImmutableSource({
    sourceBytes: sourceText,
    sourceOccurrenceKey: 'incomplete-canonical-writer-fixture',
  });
  const sourceAdmission = buildFixtureSourceAdmission({
    source,
    dealKey: 'deal:qxo-topbuild',
    dealAdmissionId,
    contractFingerprint: contract.fingerprint,
  });
  const materialText = sourceText.split('\n')[0];
  const criterionText = 'payments over $10,000,000 for actual 2025 or contemplated 2026 cash flow';
  const periodText = 'actual 2025 or contemplated 2026';
  const denominatorText = 'headline value of $2,000,000,000';
  const familiarText = sourceText.split('\n')[2];
  const span = (text) => {
    const interval = byteInterval(text);
    return buildSemanticSpan(source, interval.start, interval.end);
  };
  const spans = {
    material: span(materialText),
    criterion: span(criterionText),
    period: span(periodText),
    denominator: span(denominatorText),
    familiar: span(familiarText),
  };
  const excerpts = {
    criterion: buildExcerpt({ source, span: spans.criterion }),
    period: buildExcerpt({ source, span: spans.period }),
    denominator: buildExcerpt({ source, span: spans.denominator }),
    familiar: buildExcerpt({ source, span: spans.familiar }),
  };

  const materialProvision = buildProvisionInstance({
    source,
    span: spans.material,
    conceptKey: 'REP-T-CONTRACTS',
    party,
    ordinal: 1,
  });
  const materialComponent = buildProvisionComponent({
    source,
    parentProvision: materialProvision,
    span: spans.criterion,
    componentKey: 'MATERIAL_CONTRACT_CRITERION',
    ordinal: 1,
  });
  const materialScopeIds = [excerpts.criterion.excerpt_id, excerpts.denominator.excerpt_id].sort();
  const materialClaim = buildClaimRevision({
    subject_occurrence_id: materialComponent.provision_component_id,
    claim_definition_key: 'MATERIAL_CONTRACT_CASH_FLOW_THRESHOLD_PERCENT_OF_DEAL_VALUE',
    state: 'PRESENT',
    raw_value: '$10,000,000',
    canonical_value: '0.5',
    unit: 'PERCENT_OF_DEAL_VALUE',
    denominator: {
      value: '2000000000',
      currency: 'USD',
      basis: 'HEADLINE_TRANSACTION_VALUE',
      source_lineage_ids: [excerpts.denominator.excerpt_id],
    },
    attributes: {
      basis_key: 'PERCENT_OF_DEAL_VALUE:HEADLINE_TRANSACTION_VALUE:USD',
      measurement_period_raw_text: periodText,
      measurement_period_mapping_state: 'UNMAPPED_FROZEN_TAXONOMY',
    },
    allowed_attributes: [
      'basis_key',
      'measurement_period_raw_text',
      'measurement_period_mapping_state',
    ],
    evidence: [
      evidence(excerpts.criterion),
      evidence(excerpts.denominator, 'DERIVATION_INPUT'),
    ],
    scope: {
      scope_closure_id: contentId('CLAIM_SCOPE_CLOSURE/V1', materialScopeIds),
      coverage_status: 'COMPLETE',
      required_interval_ids: materialScopeIds,
      examined_interval_ids: materialScopeIds,
    },
    extraction_version: 'INCOMPLETE_CANONICAL_WRITER_TEST/V1',
    normalisation_version: 'INCOMPLETE_CANONICAL_WRITER_TEST/V1',
    derivation_version: 'INCOMPLETE_CANONICAL_WRITER_TEST/V1',
  });
  const result = buildFixtureResultComponent({
    deal_admission_id: dealAdmissionId,
    result_key: 'TARGET_MATERIAL_CONTRACT_CASH_FLOW_THRESHOLD',
    result_version: 1,
    concept_key: 'REP-T-CONTRACTS',
    party,
    value_slot_key: 'CASH_FLOW_THRESHOLD',
    ordinal: 0,
    claim: materialClaim,
    relationships: [],
    composition_scope_closure_id: digest('material-composition-scope'),
    completeness: 'INCOMPLETE',
    comparability: 'NOT_CERTIFIED',
  });
  const deal = {
    deal_key: 'deal:qxo-topbuild',
    deal_admission_id: dealAdmissionId,
    document_hash: source.document_hash,
    dimensions: {
      sector: 'Industrials',
      buyer: 'QXO',
      merger_form: 'Merger',
      adviser_firms: [],
      lawyers: [],
      announce_year: 2026,
      deal_value_usd: '2000000000',
    },
  };
  const projection = projectMarketMetricSlot({
    contract_bundle: contract,
    release_state: 'CANDIDATE_CERTIFIED',
    corpus_release_id: corpusReleaseId,
    deal,
    concept_key: 'REP-T-CONTRACTS',
    metric_key: 'MATERIAL_CONTRACT_CASH_FLOW_THRESHOLD_PERCENT_OF_DEAL_VALUE',
    party,
    result,
    claim: materialClaim,
    relationships: [],
    value_slot_key: result.value_slot_key,
    ordinal: result.ordinal,
  });
  const openWorldEvidenceBody = {
    evidence_role: 'UNMAPPED_ATTRIBUTE_OR_QUESTION',
    excerpt_id: excerpts.period.excerpt_id,
    semantic_span_id: excerpts.period.ordered_component_assignments[0].semantic_span_id,
    document_hash: source.document_hash,
    absolute_start: excerpts.period.absolute_start,
    absolute_end: excerpts.period.absolute_end,
    exact_bytes_digest: excerpts.period.exact_bytes_digest,
    governed_ordinal: 0,
  };
  const evidenceReferenceId = contentId('OPEN_WORLD_EVIDENCE_REFERENCE/V1', openWorldEvidenceBody);
  const observedPartyTokenDigest = contentId('OBSERVED_PARTY_TOKEN_SET/V1', ['Company']);
  const neutralPropositionDigest = contentId('NEUTRAL_LEGAL_PROPOSITION/V1', {
    attribute_or_question: 'MATERIAL_CONTRACT_MEASUREMENT_PERIOD',
    raw_value: periodText,
  });
  const candidateBody = {
    schema_version: 'NOVEL_CONCEPT_CANDIDATE/V1',
    candidate_kind: 'ATTRIBUTE_OR_QUESTION',
    document_hash: source.document_hash,
    ordered_proposition_evidence_reference_ids: [evidenceReferenceId],
    observed_party_token_digest: observedPartyTokenDigest,
    governed_ordinal: 0,
    neutral_proposition_digest: neutralPropositionDigest,
  };
  const candidateId = contentId('NOVEL_CONCEPT_CANDIDATE/V1', candidateBody);
  const occurrenceBody = {
    schema_version: 'OPEN_WORLD_CANDIDATE_OCCURRENCE/V1',
    candidate_id: candidateId,
    admission_state: 'ADMITTED_SEMANTIC',
    document_hash: source.document_hash,
    ordered_proposition_evidence_reference_ids: [evidenceReferenceId],
    observed_party_token_digest: observedPartyTokenDigest,
    governed_ordinal: 0,
    neutral_proposition_digest: neutralPropositionDigest,
  };
  const occurrenceId = contentId('OPEN_WORLD_CANDIDATE_OCCURRENCE/V1', occurrenceBody);
  const dispositionBody = {
    schema_version: 'OPEN_WORLD_CANDIDATE_FINAL_DISPOSITION/V1',
    open_world_candidate_occurrence_id: occurrenceId,
    disposition_code: 'REVIEWED_SOURCE_SPECIFIC',
    review_state: 'FINAL',
    reviewed_display_label: 'Material-contract measurement period',
    non_comparable_reason: 'The source period has no governed code in this corpus release.',
  };
  const finalDispositionId = contentId('OPEN_WORLD_CANDIDATE_FINAL_DISPOSITION/V1', dispositionBody);
  const derivedResultOccurrenceId = contentId('DERIVED_RESULT_OCCURRENCE/V1', {
    schema_version: 'DERIVED_RESULT_OCCURRENCE/V1',
    deal_admission_id: dealAdmissionId,
    result_key: result.result_key,
    result_version: result.result_version,
    concept_key: result.concept_key,
    party,
    result_ordinal: 0,
  });
  const impactBody = {
    schema_version: 'SEMANTIC_IMPACT_CLOSURE/V1',
    open_world_candidate_occurrence_id: occurrenceId,
    impact_value: 'AFFECTS_CANONICAL_RESULT',
    affected_canonical_result_occurrence_ids: [derivedResultOccurrenceId],
    market_authority: 'NO_MARKET_AUTHORITY',
  };
  const semanticImpactClosureId = contentId('SEMANTIC_IMPACT_CLOSURE/V1', impactBody);
  const primitiveBody = {
    primitive_kind: 'TIME',
    governed_ordinal: 0,
    raw_value: periodText,
    interpreted_value: 'Actual cash flow is tested for 2025 and contemplated cash flow for 2026.',
    evidence_reference_ids: [evidenceReferenceId],
  };
  const primitiveId = contentId('OPEN_WORLD_LEGAL_PRIMITIVE/V1', {
    open_world_candidate_occurrence_id: occurrenceId,
    ...primitiveBody,
  });
  const incompleteRow = buildIncompleteCanonicalResultServingRow({
    contract_bundle: contract,
    frozen_pair_id: digest('frozen-pair'),
    projection_output: projection,
    result,
    claim: materialClaim,
    relationships: [],
    governed_reason_codes: ['UNMAPPED_MEASUREMENT_PERIOD'],
    intersecting_candidates: [{
      open_world_candidate_occurrence_id: occurrenceId,
      final_disposition_id: finalDispositionId,
      semantic_impact_closure_id: semanticImpactClosureId,
      impact_value: 'AFFECTS_CANONICAL_RESULT',
    }],
  });

  const familiarProvision = buildProvisionInstance({
    source,
    span: spans.familiar,
    conceptKey: 'REP-T-CAP',
    party,
    ordinal: 1,
  });
  const familiarClaim = buildClaimRevision({
    subject_occurrence_id: familiarProvision.provision_instance_id,
    claim_definition_key: 'KNOWLEDGE_QUALIFIER',
    state: 'ABSENT',
    scope: {
      scope_closure_id: digest('familiar-scope'),
      coverage_status: 'COMPLETE',
      required_interval_ids: [excerpts.familiar.excerpt_id],
      examined_interval_ids: [excerpts.familiar.excerpt_id],
    },
  });

  const writeSet = {
    source,
    source_admission: sourceAdmission,
    deal,
    excerpts: [
      ...close([excerpts.criterion, excerpts.period, excerpts.denominator], incompleteClosureId),
      ...close([excerpts.familiar], familiarClosureId),
    ],
    validated_semantic_graphs: [],
    provisions: [
      ...close([materialProvision], incompleteClosureId),
      ...close([familiarProvision], familiarClosureId),
    ],
    components: close([materialComponent], incompleteClosureId),
    claims: [
      ...close([materialClaim], incompleteClosureId),
      ...close([familiarClaim], familiarClosureId),
    ],
    relationships: [],
    open_world_candidates: close([{ candidate_id: candidateId, ...candidateBody }], incompleteClosureId),
    open_world_candidate_occurrences: close([{
      open_world_candidate_occurrence_id: occurrenceId,
      candidate_kind: 'ATTRIBUTE_OR_QUESTION',
      ...occurrenceBody,
    }], incompleteClosureId),
    open_world_evidence_references: close([{
      evidence_reference_id: evidenceReferenceId,
      ...openWorldEvidenceBody,
      open_world_candidate_occurrence_id: occurrenceId,
      canonical_text_id: source.canonical_text_id,
    }], incompleteClosureId),
    open_world_candidate_dispositions: close([{
      final_disposition_id: finalDispositionId,
      ...dispositionBody,
    }], incompleteClosureId),
    open_world_primitives: close([{
      open_world_candidate_occurrence_id: occurrenceId,
      primitive_id: primitiveId,
      ...primitiveBody,
    }], incompleteClosureId),
    semantic_impact_closures: close([{
      semantic_impact_closure_id: semanticImpactClosureId,
      ...impactBody,
    }], incompleteClosureId),
    reviewed_source_specific_rows: [],
    incomplete_canonical_result_rows: close([{
      incomplete_result_review_row_serving_key: incompleteRow.row_serving_key,
      shared_serving_row: incompleteRow,
    }], incompleteClosureId),
  };
  return { writeSet, ids: { familiarClaim: familiarClaim.claim_revision_id } };
}

function setup() {
  const repository = new InMemoryCanonicalRepository();
  const writer = createCanonicalWriter({ repository, contractBundle: contract });
  return { repository, writer };
}

test('the authoritative writer dry-runs and transactionally commits one complete incomplete-result closure', async () => {
  const fixture = buildFixtureWriteSet();
  const { repository, writer } = setup();
  const request = {
    operation: 'FIXTURE_DEAL_EXTRACTION_RUN',
    idempotencyKey: 'incomplete-material-contract',
    writeSet: fixture.writeSet,
  };

  const dryRun = await writer.write({ ...request, dryRun: true });
  assert.equal(dryRun.validation.counts.residuals, 0);
  assert.equal(dryRun.validation.counts.quarantinedClosures, 0);
  assert.equal(repository.transactionCount, 0);

  const committed = await writer.write(request);
  const state = repository.snapshot();
  assert.equal(committed.validation.counts.residuals, 0);
  assert.equal(committed.validation.counts.quarantinedClosures, 0);
  assert.equal(repository.transactionCount, 1);
  assert.equal(state.open_world_candidates.length, 1);
  assert.equal(state.open_world_candidate_occurrences.length, 1);
  assert.equal(state.open_world_evidence_references.length, 1);
  assert.equal(state.open_world_candidate_dispositions.length, 1);
  assert.deepEqual(state.open_world_primitives.map((row) => row.primitive_kind), ['TIME']);
  assert.deepEqual(state.semantic_impact_closures.map((row) => row.impact_value), ['AFFECTS_CANONICAL_RESULT']);
  assert.equal(state.incomplete_canonical_result_rows.length, 1);
  assert.equal(state.incomplete_canonical_result_rows[0].shared_serving_row.row_kind, 'INCOMPLETE_CANONICAL_RESULT');
  assert.equal(state.receipts.length, 1);
});

test('tampering quarantines only the incomplete-result closure and commits its familiar sibling', async () => {
  const fixture = buildFixtureWriteSet();
  fixture.writeSet.open_world_primitives[0].interpreted_value = 'Forged governed interpretation.';
  const { repository, writer } = setup();

  const result = await writer.write({
    operation: 'FIXTURE_DEAL_EXTRACTION_RUN',
    idempotencyKey: 'tampered-incomplete-material-contract',
    writeSet: fixture.writeSet,
  });
  const state = repository.snapshot();

  assert.deepEqual(result.validation.quarantinedClosureIds, [incompleteClosureId]);
  assert.equal(result.validation.counts.quarantinedClosures, 1);
  assert.ok(result.validation.residuals.every((row) => row.closure_id === incompleteClosureId));
  assert.equal(repository.transactionCount, 1);
  assert.equal(state.quarantines.length, 1);
  assert.equal(state.open_world_candidates.length, 0);
  assert.equal(state.open_world_primitives.length, 0);
  assert.equal(state.semantic_impact_closures.length, 0);
  assert.equal(state.incomplete_canonical_result_rows.length, 0);
  assert.deepEqual(state.claims.map((row) => row.claim_revision_id), [fixture.ids.familiarClaim]);
  assert.equal(state.provisions.length, 1);
  assert.equal(state.excerpts.length, 1);
});
