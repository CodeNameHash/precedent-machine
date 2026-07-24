const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const {
  APPLICATION_DEALS,
  buildMultiDealCandidateReleaseFixture,
} = require('../__fixtures__/canonical-v2/multi-deal-candidate-release');
const { buildQueryCohortSummary } = require('../__fixtures__/canonical-v2/query-cohort-summary');
const { validateCandidateReleaseBundle } = require('../lib/canonical-v2/candidate-release');
const { contentId, utf8Slice } = require('../lib/canonical-v2/canonical-bytes');
const {
  InMemoryCanonicalRepository,
  createCanonicalWriter,
} = require('../lib/canonical-v2/canonical-writer');
const {
  buildDefinitionCue,
  buildDefinitionUseCue,
  buildValidatedDefinitionGraph,
} = require('../lib/canonical-v2/definition-graph');
const { composeDealExtractionWriteSet } = require('../lib/canonical-v2/deal-extraction-write-set');
const { validateFixtureExactDetailPackage } = require('../lib/canonical-v2/exact-detail');
const { validateParserProposalEnvelope } = require('../lib/canonical-v2/parser-proposal-adapter');
const { queryCanonicalResultPage } = require('../lib/canonical-v2/query-result');
const {
  compileServingExactDetailRequest,
  queryServingExactDetail,
  validateServingExactDetailResult,
} = require('../lib/canonical-v2/serving-exact-detail');
const { adaptSharedServingRow, adaptSharedServingRows } = require('../lib/canonical-v2/shared-row-adapter');
const {
  buildFixtureSourceAdmission,
  buildImmutableSource,
  buildSemanticSpan,
} = require('../lib/canonical-v2/source-structure');

const QXO_FOUNDATION_TEXT = fs.readFileSync(
  'tests/fixtures/canonical-v2/foundation-source.txt',
  'utf8',
).replace(/\n$/, '');
const QXO_REVIEW = JSON.parse(fs.readFileSync(
  'tests/fixtures/canonical-v2/foundation-reviewed-payload.json',
  'utf8',
));
const NOTICE_METRIC = 'NO_SHOP_NOTICE_PERIOD_DAYS';

function buildNestedDefinitionGraph(contract) {
  const source = buildImmutableSource({
    sourceBytes: QXO_FOUNDATION_TEXT,
    sourceOccurrenceKey: 'QXO_5_2_FOUNDATION',
  });
  const dealKey = 'deal:qxo-topbuild';
  const dealAdmissionId = contentId('DEAL_ADMISSION/V1', 'qxo-foundation');
  const sourceAdmission = buildFixtureSourceAdmission({
    source,
    dealKey,
    dealAdmissionId,
    contractFingerprint: contract.fingerprint,
  });
  const span = ([absoluteStart, absoluteEnd]) => buildSemanticSpan(
    source,
    absoluteStart,
    absoluteEnd,
  );
  const definitionCue = buildDefinitionCue({
    source,
    termSpan: span(QXO_REVIEW.definition.term_span),
    bodySpans: QXO_REVIEW.definition.body_spans.map(span),
    rawTerm: QXO_REVIEW.definition.raw_term,
    syntacticRole: QXO_REVIEW.definition.syntactic_role,
  });
  const definitionUseCues = QXO_REVIEW.definition.use_spans.map((item, ordinal) => (
    buildDefinitionUseCue({
      source,
      definitionCue,
      useSpan: span(item.span),
      useRole: item.role,
      ordinal,
    })
  ));
  return {
    source,
    sourceAdmission,
    definitionCue,
    graph: buildValidatedDefinitionGraph({
      source,
      definitionCues: [definitionCue],
      definitionUseCues,
    }),
  };
}

function canonicalQueryRequest(fixture, row) {
  const market = row.canonical_result.market_context;
  return {
    serving_namespace_id: fixture.servingNamespaceId,
    corpus_release_id: fixture.corpusReleaseId,
    contract_fingerprint: fixture.contract.fingerprint,
    intent: 'MARKET_RANGE',
    metric_key: market.metric_key,
    metric_version: market.metric_version,
    concept_key: row.canonical_result.concept_key,
    party: row.canonical_result.party,
    filters: {},
    selected_columns: null,
    column_filters: {},
    page_size: 25,
    cursor: null,
  };
}

function servingExactDetailResult(fixture, detailPackage, applicationDealId) {
  const reference = detailPackage.references[0];
  const request = compileServingExactDetailRequest({
    serving_namespace_id: fixture.servingNamespaceId,
    corpus_release_id: fixture.corpusReleaseId,
    contract_fingerprint: fixture.contract.fingerprint,
    application_deal_id: applicationDealId,
    row_serving_key: detailPackage.row.row_serving_key,
    source_detail_reference_id: reference.source_detail_reference_id,
  });
  const result = {
    schema_version: 'SERVING_EXACT_DETAIL_RESULT/V1',
    serving_namespace_id: request.serving_namespace_id,
    corpus_release_id: request.corpus_release_id,
    contract_fingerprint: request.contract_fingerprint,
    application_deal_id: request.application_deal_id,
    governed_deal_key: detailPackage.row.governed_deal_key,
    row_serving_key: request.row_serving_key,
    source_detail_reference_id: request.source_detail_reference_id,
    exact_detail_package_digest: contentId('EXACT_DETAIL_ATOMIC_PACKAGE/V1', detailPackage),
    package: detailPackage,
  };
  return { request, result };
}

test('P1 fixed fixtures close from admitted source through one write, release and bounded serving', async () => {
  const fixture = buildMultiDealCandidateReleaseFixture();
  const { contract, landos, release } = fixture;

  assert.equal(validateParserProposalEnvelope({
    envelope: landos.reviewed.proposalEnvelope,
    contract_bundle: contract,
    source: landos.reviewed.source,
    source_admission: landos.reviewed.sourceAdmission,
    governed_deal_key: landos.reviewed.canonicalWriteSet.deal.deal_key,
    deal_admission_id: landos.reviewed.canonicalWriteSet.deal.deal_admission_id,
  }), true);
  assert.deepEqual(landos.reviewed.proposalEnvelope.diagnostics, {
    parser_section_count: 92,
    definition_candidate_count: 103,
    structural_gap_count: 0,
    region_coverage_complete: true,
  });
  const businessDayProposal = landos.reviewed.proposalEnvelope.definition_candidates.find(
    (candidate) => candidate.neutral_defined_term === 'business day',
  );
  assert.ok(businessDayProposal);
  assert.equal(
    utf8Slice(
      landos.reviewed.source.canonical_text.text,
      businessDayProposal.evidence_anchor.absolute_start,
      businessDayProposal.evidence_anchor.absolute_end,
    ),
    businessDayProposal.evidence_anchor.exact_text,
  );
  assert.equal(landos.noShop.proposalBatch.diagnostics.publication_blocked, false);
  assert.equal(landos.noShop.proposalBatch.proposals[0].section_number, '5.3');

  const nested = buildNestedDefinitionGraph(contract);
  assert.equal(nested.sourceAdmission.document_hash, nested.source.document_hash);
  assert.equal(nested.definitionCue.syntactic_role, 'NESTED_INLINE');
  assert.equal(nested.graph.definition_cues.length, 1);
  assert.deepEqual(nested.graph.definition_use_cues.map((cue) => cue.use_role), [
    'OPERATIVE_REFERENCE',
    'DECLARATION_REFERENCE',
  ]);

  const capitalisation = landos.reviewed;
  assert.deepEqual(capitalisation.knowledgeClaims.map((claim) => claim.state), ['ABSENT', 'ABSENT']);
  assert.equal(capitalisation.exceptionClaim.canonical_value, 'DE_MINIMIS_INACCURACIES');
  assert.equal(capitalisation.relationship.relationship_definition_key, 'BRINGS_DOWN');
  assert.deepEqual(
    capitalisation.relationship.target_occurrence_ids,
    capitalisation.representationComponents.map((component) => component.provision_component_id),
  );
  assert.deepEqual(
    capitalisation.relationship.scope.target_interval_ids,
    [capitalisation.excerpts.rep_a.excerpt_id, capitalisation.excerpts.rep_c_first_sentence.excerpt_id].sort(),
  );
  assert.ok(capitalisation.excerpts.rep_a.absolute_end < capitalisation.excerpts.rep_c_first_sentence.absolute_start);

  assert.equal(landos.ioc.thresholdClaim.raw_value, '$100,000');
  assert.equal(landos.ioc.thresholdClaim.canonical_value, '0.07272727');
  assert.equal(landos.ioc.thresholdClaim.unit, 'PERCENT_OF_DEAL_VALUE');
  assert.equal(landos.ioc.thresholdClaim.denominator.value, '137500000');
  assert.deepEqual(landos.ioc.thresholdClaim.evidence.map((item) => item.document_ordinal), [0, 1]);
  assert.deepEqual(
    Object.values(landos.noShop.durationClaims).map((claim) => ({
      canonical_value: claim.canonical_value,
      unit: claim.unit,
      day_basis: claim.day_basis,
      raw_unit: claim.attributes.raw_unit,
    })),
    [
      { canonical_value: '1', unit: 'DAYS', day_basis: 'ELAPSED', raw_unit: 'HOURS' },
      { canonical_value: '4', unit: 'DAYS', day_basis: 'BUSINESS', raw_unit: 'DAYS' },
      { canonical_value: '2', unit: 'DAYS', day_basis: 'BUSINESS', raw_unit: 'DAYS' },
    ],
  );
  assert.equal(new Set(landos.noShop.actionClaims.map((claim) => claim.canonical_value)).size, 5);
  assert.deepEqual(landos.noShop.actionRelationships.map((relationship) => relationship.effect.legal_operation), [
    'PERMITS_LIMITED_INFORMATION_SHARING',
    'PERMITS_DISCUSSIONS_OR_NEGOTIATIONS',
    'PERMITS_CONFIDENTIALITY_AGREEMENT',
  ]);
  assert.ok(landos.noShop.actionRelationships.every(
    (relationship) => relationship.effect.prerequisites.length === 7,
  ));

  const sourceSpecific = landos.sourceSpecific.row.reviewed_source_specific;
  assert.equal(sourceSpecific.final_disposition.disposition_code, 'REVIEWED_SOURCE_SPECIFIC');
  assert.equal(sourceSpecific.market_comparability, 'REVIEWED_SOURCE_SPECIFIC');
  assert.match(sourceSpecific.non_comparable_reason, /no governed cross-deal concept/i);
  assert.equal(sourceSpecific.semantic_impact_closure.market_authority, 'NO_MARKET_AUTHORITY');
  assert.equal(Object.hasOwn(sourceSpecific, 'concept_key'), false);
  assert.deepEqual(sourceSpecific.evidence_references.map((reference) => reference.evidence_role), [
    'OPERATIVE_PROPOSITION',
    'OPERATIVE_PROPOSITION_CONTINUATION',
    'NESTED_DEFINITION_DEPENDENCY',
  ]);

  const familyWriteSets = [
    landos.reviewed.canonicalWriteSet,
    landos.ioc.canonicalWriteSet,
    landos.materialContracts.canonicalWriteSet,
    landos.noShop.canonicalWriteSet,
    landos.terminationFee.canonicalWriteSet,
    landos.sourceSpecific.canonicalWriteSet,
  ];
  const composedWriteSet = composeDealExtractionWriteSet({
    writeSets: familyWriteSets,
    deal: landos.ioc.canonicalWriteSet.deal,
  });
  const repository = new InMemoryCanonicalRepository();
  const writer = createCanonicalWriter({ repository, contractBundle: contract });
  const committed = await writer.write({
    operation: 'FIXTURE_DEAL_EXTRACTION_RUN',
    idempotencyKey: 'p1-landos-all-families-v1',
    writeSet: composedWriteSet,
  });
  assert.equal(committed.receipt.status, 'COMMITTED');
  assert.deepEqual(committed.validation.counts, {
    publishable: 114,
    residuals: 0,
    quarantinedClosures: 0,
  });
  assert.deepEqual(committed.validation.quarantinedClosureIds, []);
  assert.equal(repository.transactionCount, 1);
  assert.equal(repository.snapshot().sources.length, 2);
  assert.equal(repository.snapshot().validated_semantic_graphs.length, 1);
  assert.equal(repository.snapshot().reviewed_source_specific_rows.length, 1);

  assert.equal(validateCandidateReleaseBundle(release), true);
  assert.deepEqual(release.manifest.deal_keys, ['deal:landos-abbvie', 'deal:qxo-topbuild']);
  assert.equal(release.manifest.counts.unresolved, 0);
  assert.equal(release.manifest.counts.failed, 0);
  assert.equal(release.manifest.counts.duplicates, 0);
  assert.equal(release.manifest.counts.validated_semantic_graphs, 1);
  assert.equal(release.validated_semantic_graphs[0].validated_semantic_graph_id,
    landos.sourceSpecific.validatedSemanticGraph.validated_semantic_graph_id);
  const noticeRows = release.shared_rows.filter((row) => (
    row.row_kind === 'CANONICAL_RESULT'
      && row.canonical_result.market_context.metric_key === NOTICE_METRIC
  ));
  assert.equal(noticeRows.length, 2);
  const landosNoticeRow = noticeRows.find((row) => row.governed_deal_key === 'deal:landos-abbvie');
  const qxoNoticeRow = noticeRows.find((row) => row.governed_deal_key === 'deal:qxo-topbuild');
  assert.ok(landosNoticeRow);
  assert.ok(qxoNoticeRow);
  assert.equal(landosNoticeRow.canonical_result.market_context.subject_observation.canonical_value, '1');
  assert.equal(qxoNoticeRow.canonical_result.market_context.subject_observation.canonical_value, '1');
  assert.equal(landosNoticeRow.canonical_result.market_context.cohort.counts.comparable_deals, 1);

  const noticeDetail = release.exact_detail_packages.find(
    (detailPackage) => detailPackage.row.row_serving_key === landosNoticeRow.row_serving_key,
  );
  assert.ok(noticeDetail);
  const noticeClaim = landos.noShop.durationClaims.notice;
  assert.equal(validateFixtureExactDetailPackage({
    package: landos.noShop.detailPackages.find(
      (detailPackage) => detailPackage.row.canonical_result.market_context.metric_key === NOTICE_METRIC,
    ),
    contract_bundle: contract,
    source: landos.noShop.source,
    source_admission: landos.noShop.sourceAdmission,
    excerpt: landos.noShop.excerpts.notice_clock,
    claim: noticeClaim,
  }), true);
  const exact = servingExactDetailResult(fixture, noticeDetail, APPLICATION_DEALS.LANDOS);
  assert.equal(validateServingExactDetailResult(exact.result, exact.request), exact.result);
  assert.match(exact.result.package.detail_payloads[0].response_body.excerpt.exact_text, /twenty-four \(24\) hours/);

  const queryRows = [...noticeRows].sort((left, right) => (
    left.governed_deal_key.localeCompare(right.governed_deal_key)
      || left.row_serving_key.localeCompare(right.row_serving_key)
  ));
  const queryCalls = [];
  const cacheValues = new Map();
  const queryClient = {
    rpc(name, params) {
      queryCalls.push({ name, params });
      return Promise.resolve({
        error: null,
        data: {
          schema_version: 'CANONICAL_QUERY_PAGE_RESULT/V2',
          cache_state: 'MISS',
          serving_namespace_id: params.p_serving_namespace_id,
          corpus_release_id: params.p_corpus_release_id,
          contract_fingerprint: params.p_contract_fingerprint,
          query_semantics_digest: params.p_query_semantics_digest,
          total_count: queryRows.length,
          page_count: queryRows.length,
          cohort_summary: buildQueryCohortSummary({ params, rows: queryRows }),
          rows: queryRows,
          next_cursor: null,
        },
      });
    },
  };
  const queryCache = {
    async get(key) { return cacheValues.get(key) || null; },
    async set(key, value) { cacheValues.set(key, value); },
  };
  const queryRequest = canonicalQueryRequest(fixture, landosNoticeRow);
  const queryMiss = await queryCanonicalResultPage({
    client: queryClient,
    cache: queryCache,
    request: queryRequest,
  });
  const queryHit = await queryCanonicalResultPage({
    client: queryClient,
    cache: queryCache,
    request: queryRequest,
  });
  assert.equal(queryMiss.cache, 'MISS');
  assert.equal(queryHit.cache, 'HIT');
  assert.equal(queryCalls.length, 1);
  assert.equal(queryCalls[0].name, 'canonical_v2_query_page_v2');
  assert.equal(queryCalls[0].params.p_page_size, 25);
  assert.equal(queryCalls[0].params.p_metric_key, NOTICE_METRIC);
  assert.equal(queryCalls[0].params.p_basis_key, 'DAYS:ELAPSED:RECEIPT_OF_COMPETING_PROPOSAL');

  const prepared = adaptSharedServingRow(landosNoticeRow);
  const queriedLandos = queryMiss.result.rows.find(
    (row) => row.governed_deal_key === 'deal:landos-abbvie',
  );
  assert.equal(queriedLandos.row_serving_key, landosNoticeRow.row_serving_key);
  for (const surface of ['REVIEW', 'CORPUS_CONTEXT', 'COMPARE', 'QUERY']) {
    assert.equal(prepared.surface_bindings[surface].row_key, queriedLandos.row_serving_key);
  }

  const releasedSourceSpecific = release.shared_rows.find(
    (row) => row.row_kind === 'REVIEWED_SOURCE_SPECIFIC',
  );
  const isolatedRows = adaptSharedServingRows([
    landosNoticeRow,
    { row_kind: 'MALFORMED' },
    releasedSourceSpecific,
  ]);
  assert.deepEqual(isolatedRows.map((row) => row.render_kind), ['ROW', 'ROW_RENDER_FAILED', 'ROW']);
  assert.equal(isolatedRows[0].prepared.row_key, landosNoticeRow.row_serving_key);
  assert.equal(isolatedRows[2].prepared.resolution.marketCohortEligible, false);
  assert.match(isolatedRows[2].prepared.resolution.sourceSpecific.nonComparableReason, /no governed cross-deal concept/i);

  let failedDetailCalls = 0;
  await assert.rejects(queryServingExactDetail({
    client: {
      rpc() {
        failedDetailCalls += 1;
        return Promise.resolve({ data: null, error: { message: 'unavailable' } });
      },
    },
    request: exact.request,
  }), (error) => error.code === 'DATA_SOURCE_ERROR');
  assert.equal(failedDetailCalls, 1);
  assert.deepEqual(
    adaptSharedServingRows([landosNoticeRow, releasedSourceSpecific]).map((row) => row.render_kind),
    ['ROW', 'ROW'],
  );
});
