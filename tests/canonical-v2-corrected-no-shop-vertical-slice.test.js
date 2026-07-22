const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { buildQxoNoShopReleaseFixture } = require('../__fixtures__/canonical-v2/qxo-no-shop-release');
const {
  buildFixtureCandidateRelease,
  validateCandidateReleaseBundle,
} = require('../lib/canonical-v2/candidate-release');
const { canonicalJson, contentId } = require('../lib/canonical-v2/canonical-bytes');
const { InMemoryCanonicalRepository, createCanonicalWriter } = require('../lib/canonical-v2/canonical-writer');
const { compileFixtureContract } = require('../lib/canonical-v2/contract-bundle');
const {
  buildFixtureClaimEvidenceDetailPackage,
  GENERAL_ACTION_SLOT_KEY,
  validateFixtureExactDetailPackage,
} = require('../lib/canonical-v2/exact-detail');
const {
  applyApprovedPostScopeClaimCorrection,
  buildCorrectionApprovalAttestation,
  buildPostScopeClaimCorrection,
  claimPayloadDigest,
} = require('../lib/canonical-v2/post-scope-claim-correction');
const {
  rebuildReviewedResultCollectionAfterClaimCorrection,
} = require('../lib/canonical-v2/post-scope-result-rebuild');
const { queryCanonicalResultPage } = require('../lib/canonical-v2/query-result');
const {
  buildReviewedNoShopServingRows,
  buildReviewedNoShopSlice,
} = require('../lib/canonical-v2/reviewed-no-shop-slice');
const { adaptSharedServingRow } = require('../lib/canonical-v2/shared-row-adapter');
const {
  buildFixtureSourceAdmission,
  buildImmutableSource,
} = require('../lib/canonical-v2/source-structure');
const { buildReadOnlyNoShopProposalBatch } = require('../lib/parser-v2/canonical-proposals');

const LANDOS_APPLICATION_DEAL_ID = 'c34415ed-44f7-432f-8d7c-6464b0310239';
const QXO_APPLICATION_DEAL_ID = '7dc3a05f-b170-4d59-a255-b7103cca16e1';
const LANDOS_DEAL_KEY = 'deal:landos-abbvie';
const NOTICE_METRIC = 'NO_SHOP_NOTICE_PERIOD_DAYS';
const sourceText = fs.readFileSync('__fixtures__/demo-deal/landos-abbvie-agreement.txt', 'utf8');

function digest(value) {
  return contentId('CORRECTED_NO_SHOP_VERTICAL_SLICE_TEST/V1', value);
}

function noticeResult(results) {
  return results.find((result) => result.metric_key === NOTICE_METRIC);
}

function noticeRow(rows) {
  return rows.find((row) => row.canonical_result.market_context.metric_key === NOTICE_METRIC);
}

function buildCorrection(slice) {
  const claim = slice.durationClaims.notice;
  const correction = buildPostScopeClaimCorrection({
    target: {
      deal_key: slice.canonicalWriteSet.deal.deal_key,
      deal_admission_id: slice.canonicalWriteSet.deal.deal_admission_id,
      document_hash: slice.canonicalWriteSet.deal.document_hash,
      subject_occurrence_id: claim.subject_occurrence_id,
      claim_occurrence_id: claim.claim_occurrence_id,
      expected_claim_revision_id: claim.claim_revision_id,
      expected_claim_payload_digest: claimPayloadDigest(claim),
    },
    patch: {
      derivation_version: 'LANDOS_NO_SHOP_LEGAL_REVIEWED/V2',
    },
  });
  const approval = buildCorrectionApprovalAttestation({
    correction,
    reviewer_id: 'reviewer:legal-semantic',
    reviewer_eligibility_evidence_digest: digest('reviewer-eligibility'),
    authorisation_evidence_digest: digest('correction-authorisation'),
    decision: 'PASS',
    reason_digest: digest('source-consistent-derivation-review'),
  });
  return { correction, approval };
}

function cohortRequestFor(row, servingNamespaceId, contract) {
  const market = row.canonical_result.market_context;
  return {
    serving_namespace_id: servingNamespaceId,
    corpus_release_id: row.corpus_release_id,
    contract_fingerprint: contract.fingerprint,
    metric_key: market.metric_key,
    metric_version: market.metric_version,
    concept_key: row.canonical_result.concept_key,
    party: row.canonical_result.party,
    subject_deal_key: row.governed_deal_key,
    filters: {},
  };
}

test('one corrected no-shop claim closes from admitted source through writer, release and shared surfaces', async () => {
  const contract = compileFixtureContract();
  const corpusReleaseId = digest('two-deal-corpus-release');
  const servingNamespaceId = digest('two-deal-serving-namespace');
  const dealAdmissionId = contentId('DEAL_ADMISSION/V1', 'landos-abbvie');
  const source = buildImmutableSource({
    sourceBytes: sourceText,
    sourceOccurrenceKey: 'landos-abbvie-merger-agreement',
  });
  const sourceAdmission = buildFixtureSourceAdmission({
    source,
    dealKey: LANDOS_DEAL_KEY,
    dealAdmissionId,
    contractFingerprint: contract.fingerprint,
  });
  const proposalBatch = buildReadOnlyNoShopProposalBatch({
    contract_bundle: contract,
    source,
    source_admission: sourceAdmission,
    governed_deal_key: LANDOS_DEAL_KEY,
    deal_admission_id: dealAdmissionId,
  });
  assert.deepEqual(proposalBatch.diagnostics, {
    legacy_proposal_count: 1,
    source_backed_proposal_count: 1,
    quarantined_proposal_count: 0,
    publication_blocked: false,
  });

  const slice = buildReviewedNoShopSlice({
    sourceText,
    contractBundle: contract,
    corpusReleaseId,
    proposalBatch,
  });
  assert.equal(slice.proposalBatch, proposalBatch);
  assert.deepEqual(slice.reviewed_mapping.source_backed_provision_proposal_ids, [
    proposalBatch.proposals[0].source_backed_provision_proposal_id,
  ]);
  const originalResults = slice.results;
  const originalRows = buildReviewedNoShopServingRows({ slice, contractBundle: contract });
  const predecessorResult = noticeResult(originalResults);
  const predecessorRow = noticeRow(originalRows);
  const predecessorClaim = predecessorResult.claim;
  const { correction, approval } = buildCorrection(slice);
  const correctionOutput = applyApprovedPostScopeClaimCorrection({
    writeSet: slice.canonicalWriteSet,
    correction,
    approval,
    contractBundle: contract,
  });
  const successorClaim = correctionOutput.successor_claim_revision;

  assert.equal(successorClaim.raw_value, 'within twenty-four (24) hours');
  assert.equal(successorClaim.canonical_value, '1');
  assert.equal(successorClaim.unit, 'DAYS');
  assert.equal(successorClaim.day_basis, 'ELAPSED');
  assert.deepEqual(successorClaim.evidence, predecessorClaim.evidence);
  assert.equal(successorClaim.normalisation_version, predecessorClaim.normalisation_version);
  assert.equal(successorClaim.derivation_version, 'LANDOS_NO_SHOP_LEGAL_REVIEWED/V2');
  assert.notEqual(successorClaim.claim_revision_id, predecessorClaim.claim_revision_id);

  const rebuilt = rebuildReviewedResultCollectionAfterClaimCorrection({
    reviewed_results: originalResults,
    shared_rows: originalRows,
    correction_output: correctionOutput,
    contract_bundle: contract,
    deal: slice.canonicalWriteSet.deal,
    cohort_request: cohortRequestFor(predecessorRow, servingNamespaceId, contract),
  });
  const correctedResult = noticeResult(rebuilt.reviewed_results);
  const correctedRow = noticeRow(rebuilt.shared_rows);
  assert.equal(correctedResult.claim.claim_revision_id, successorClaim.claim_revision_id);
  assert.equal(
    correctedRow.canonical_result.market_context.subject_observation.canonical_value,
    '1',
  );
  for (const [index, result] of rebuilt.reviewed_results.entries()) {
    if (result.metric_key !== NOTICE_METRIC) assert.equal(result, originalResults[index]);
  }
  for (const [index, row] of rebuilt.shared_rows.entries()) {
    if (row.canonical_result.market_context.metric_key !== NOTICE_METRIC) {
      assert.equal(row, originalRows[index]);
    }
  }

  const repository = new InMemoryCanonicalRepository();
  const writer = createCanonicalWriter({ repository, contractBundle: contract });
  const committed = await writer.write({
    operation: 'FIXTURE_DEAL_EXTRACTION_RUN',
    idempotencyKey: 'landos-corrected-no-shop-v1',
    writeSet: correctionOutput.corrected_write_set,
  });
  assert.equal(committed.replayed, false);
  assert.equal(repository.transactionCount, 1);
  const stored = repository.snapshot();
  assert.equal(stored.claims.some((claim) => claim.claim_revision_id === successorClaim.claim_revision_id), true);
  assert.equal(stored.claims.some((claim) => claim.claim_revision_id === predecessorClaim.claim_revision_id), false);

  const correctedExcerpt = Object.values(slice.excerpts).find(
    (excerpt) => excerpt.excerpt_id === successorClaim.evidence[0].excerpt_id,
  );
  const correctedDetail = buildFixtureClaimEvidenceDetailPackage({
    contract_bundle: contract,
    row: correctedRow,
    source: slice.source,
    source_admission: slice.sourceAdmission,
    excerpt: correctedExcerpt,
    claim: successorClaim,
    action_slot_key: GENERAL_ACTION_SLOT_KEY,
    evidence_ordinal: 0,
  });
  assert.equal(validateFixtureExactDetailPackage({
    package: correctedDetail,
    contract_bundle: contract,
    source: slice.source,
    source_admission: slice.sourceAdmission,
    excerpt: correctedExcerpt,
    claim: successorClaim,
  }), true);

  const qxo = buildQxoNoShopReleaseFixture({
    contractBundle: contract,
    corpusReleaseId,
    servingNamespaceId,
  });
  const qxoNoticeIndex = qxo.results.findIndex((result) => result.metric_key === NOTICE_METRIC);
  const qxoNotice = qxo.results[qxoNoticeIndex];
  assert.equal(qxoNotice.claim.canonical_value, '1');
  assert.equal(qxoNotice.claim.day_basis, 'ELAPSED');
  const members = [{
    projection_output: correctedResult.projection,
    shared_row: correctedDetail.row,
    exact_detail: {
      package: correctedDetail,
      source: slice.source,
      source_admission: slice.sourceAdmission,
      excerpt: correctedExcerpt,
      claim: successorClaim,
    },
  }, qxo.members[qxoNoticeIndex]];
  const release = buildFixtureCandidateRelease({
    contract_bundle: contract,
    serving_namespace_id: servingNamespaceId,
    corpus_release_id: corpusReleaseId,
    members,
    deal_directory_entries: [
      { application_deal_id: LANDOS_APPLICATION_DEAL_ID, governed_deal_key: LANDOS_DEAL_KEY },
      { application_deal_id: QXO_APPLICATION_DEAL_ID, governed_deal_key: 'deal:qxo-topbuild' },
    ],
  });
  assert.equal(validateCandidateReleaseBundle(release), true);
  assert.deepEqual(release.manifest.counts, {
    deals: 2,
    deal_directory_records: 2,
    metric_slots: 2,
    observations: 2,
    exclusions: 0,
    shared_rows: 2,
    source_specific_rows: 0,
    source_specific_serving_records: 0,
    exact_detail_packages: 2,
    query_records: 2,
    unresolved: 0,
    failed: 0,
    duplicates: 0,
  });
  const releasedLandosRow = release.shared_rows.find(
    (row) => row.governed_deal_key === LANDOS_DEAL_KEY,
  );
  const releasedMarket = releasedLandosRow.canonical_result.market_context;
  assert.equal(releasedMarket.cohort.counts.comparable_deals, 1);
  assert.equal(releasedMarket.cohort.counts.distribution_deals, 1);
  assert.deepEqual(releasedMarket.cohort.distribution, [{
    canonical_value: '1',
    subject_count: 1,
    deal_count: 1,
  }]);
  const queryProjection = release.query_records.find(
    (record) => record.row_serving_key === releasedLandosRow.row_serving_key,
  );
  assert.equal(queryProjection.canonical_numeric_value, '1');
  assert.deepEqual(queryProjection.canonical_payload, releasedLandosRow);

  const prepared = adaptSharedServingRow(releasedLandosRow);
  for (const surface of ['REVIEW', 'CORPUS_CONTEXT', 'COMPARE']) {
    assert.equal(prepared.surface_bindings[surface].row_key, releasedLandosRow.row_serving_key);
    assert.equal(prepared.surface_bindings[surface].typed_market, prepared.typed_market);
  }
  const preparedMetric = prepared.data.byRow[prepared.row_key].metrics[NOTICE_METRIC];
  assert.equal(preparedMetric.subject.value, 1);
  assert.equal(preparedMetric.subject.label, '1 elapsed day');
  assert.equal(preparedMetric.coverage.comparableCount, 1);
  assert.equal(prepared.surface_bindings.QUERY.row_key, releasedLandosRow.row_serving_key);

  const queryRows = release.shared_rows
    .filter((row) => row.canonical_result?.market_context.metric_key === NOTICE_METRIC)
    .sort((left, right) => (
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
          schema_version: 'CANONICAL_QUERY_PAGE_RESULT/V1',
          serving_namespace_id: params.p_serving_namespace_id,
          corpus_release_id: params.p_corpus_release_id,
          contract_fingerprint: params.p_contract_fingerprint,
          query_semantics_digest: params.p_query_semantics_digest,
          total_count: queryRows.length,
          page_count: queryRows.length,
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
  const queryRequest = {
    serving_namespace_id: servingNamespaceId,
    corpus_release_id: corpusReleaseId,
    contract_fingerprint: contract.fingerprint,
    intent: 'MARKET_RANGE',
    metric_key: releasedMarket.metric_key,
    metric_version: releasedMarket.metric_version,
    concept_key: releasedLandosRow.canonical_result.concept_key,
    party: releasedLandosRow.canonical_result.party,
    filters: {},
    selected_columns: null,
    column_filters: {},
    page_size: 25,
    cursor: null,
  };
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
  assert.equal(queryCalls[0].name, 'canonical_v2_query_page');
  assert.equal(queryCalls[0].params.p_metric_key, NOTICE_METRIC);
  assert.equal(queryCalls[0].params.p_basis_key, 'DAYS:ELAPSED:RECEIPT_OF_COMPETING_PROPOSAL');
  const queriedLandosRow = queryMiss.result.rows.find(
    (row) => row.governed_deal_key === LANDOS_DEAL_KEY,
  );
  assert.equal(queriedLandosRow.row_serving_key, releasedLandosRow.row_serving_key);
  assert.deepEqual(queriedLandosRow.shared_row, releasedLandosRow);
  assert.equal(queriedLandosRow.cells.duration.canonical_value, '1');
  assert.equal(queriedLandosRow.cells.duration.raw_unit, 'HOURS');

  const releasedBytes = canonicalJson(release);
  assert.equal(releasedBytes.includes(successorClaim.claim_revision_id), true);
  assert.equal(releasedBytes.includes(predecessorClaim.claim_revision_id), false);

  const driftedProposalBatch = structuredClone(proposalBatch);
  driftedProposalBatch.proposals[0].evidence_anchor.absolute_end -= 1;
  assert.throws(() => buildReviewedNoShopSlice({
    sourceText,
    contractBundle: contract,
    corpusReleaseId,
    proposalBatch: driftedProposalBatch,
  }), /proposal batch identity or exact source mapping mismatch/);

  const staleMember = structuredClone(members[0]);
  staleMember.shared_row = predecessorRow;
  assert.throws(() => buildFixtureCandidateRelease({
    contract_bundle: contract,
    serving_namespace_id: servingNamespaceId,
    corpus_release_id: corpusReleaseId,
    members: [staleMember, members[1]],
    deal_directory_entries: [
      { application_deal_id: LANDOS_APPLICATION_DEAL_ID, governed_deal_key: LANDOS_DEAL_KEY },
      { application_deal_id: QXO_APPLICATION_DEAL_ID, governed_deal_key: 'deal:qxo-topbuild' },
    ],
  }), /does not close over its market observation|not the same release member|not a closed atomic graph/);
});
