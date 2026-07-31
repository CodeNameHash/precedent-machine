const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const {
  APPLICATION_DEALS,
  buildMultiDealCandidateReleaseFixture,
} = require('../__fixtures__/canonical-v2/multi-deal-candidate-release');
const {
  buildFixtureCandidateRelease,
  releaseWideMarketContext,
  validateCandidateReleaseBundle,
} = require('../lib/canonical-v2/candidate-release');
const { contentId } = require('../lib/canonical-v2/canonical-bytes');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function byRowKey(packages) {
  return [...packages].sort((left, right) => (
    left.row.row_serving_key.localeCompare(right.row.row_serving_key)
  ));
}

function byApplicationDeal(records) {
  return [...records].sort((left, right) => (
    left.application_deal_id.localeCompare(right.application_deal_id)
  ));
}

let fixture;
test.before(() => {
  fixture = buildMultiDealCandidateReleaseFixture();
});

test('QXO and Landos freeze into one bounded shared release and namespace', () => {
  const { release } = fixture;

  assert.equal(validateCandidateReleaseBundle(release), true);
  assert.deepEqual(release.manifest.deal_keys, ['deal:landos-abbvie', 'deal:qxo-topbuild']);
  assert.deepEqual(release.manifest.counts, {
    deals: 2,
    deal_directory_records: 2,
    metric_slots: 14,
    observations: 14,
    exclusions: 0,
    shared_rows: 15,
    source_specific_rows: 1,
    source_specific_serving_records: 1,
    exact_detail_packages: 15,
    query_records: 14,
    validated_semantic_graphs: 1,
    correction_applications: 0,
    correction_discharges: 0,
    unresolved: 0,
    failed: 0,
    duplicates: 0,
  });
  assert.equal(release.manifest.corpus_release_id, fixture.corpusReleaseId);
  assert.equal(release.manifest.serving_namespace_id, fixture.servingNamespaceId);
  assert.equal(release.market_observations.every((row) => (
    row.corpus_release_id === fixture.corpusReleaseId
  )), true);
  assert.equal(release.shared_rows.every((row) => (
    row.corpus_release_id === fixture.corpusReleaseId
  )), true);
  assert.equal(release.query_records.every((row) => (
    row.serving_namespace_id === fixture.servingNamespaceId
      && row.corpus_release_id === fixture.corpusReleaseId
  )), true);
  const overlappingRows = release.shared_rows.filter((row) => (
    row.row_kind === 'CANONICAL_RESULT'
      && ['NO_SHOP_NOTICE_PERIOD_DAYS', 'NO_SHOP_INITIAL_MATCH_PERIOD_DAYS']
        .includes(row.canonical_result.market_context.metric_key)
  ));
  assert.equal(overlappingRows.length, 4);
  assert.equal(overlappingRows.every((row) => (
    row.canonical_result.market_context.cohort.counts.comparable_deals === 2
      && row.canonical_result.market_context.cohort.counts.distribution_deals === 2
      && row.canonical_result.market_context.cohort.distribution[0].deal_count === 2
  )), true);
  const feeRow = release.shared_rows.find((row) => (
    row.row_kind === 'CANONICAL_RESULT'
      && row.canonical_result.market_context.metric_key === 'SELLER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE'
  ));
  assert.equal(feeRow.canonical_result.market_context.cohort.counts.comparable_deals, 1);
  assert.deepEqual(feeRow.canonical_result.market_context.cohort.distribution, [{
    canonical_value: feeRow.canonical_result.market_context.subject_observation.canonical_value,
    subject_count: 1,
    deal_count: 1,
  }]);
  const iocRow = release.shared_rows.find((row) => (
    row.row_kind === 'CANONICAL_RESULT'
      && row.canonical_result.market_context.metric_key === 'IOC_CAPEX_THRESHOLD_PERCENT_OF_DEAL_VALUE'
  ));
  assert.equal(iocRow.canonical_result.market_context.subject_cohort_membership.status, 'INCLUDED');
  assert.equal(
    iocRow.canonical_result.market_context.subject_cohort_membership.cohort_digest,
    iocRow.canonical_result.market_context.cohort.cohort_digest,
  );
});

test('the combined release preserves every exact-detail package and both directory entries', () => {
  const expectedPackages = byRowKey([
    ...fixture.landos.release.exact_detail_packages,
    ...fixture.qxo.release.exact_detail_packages,
  ]);
  const expectedDirectory = byApplicationDeal([
    ...fixture.landos.release.deal_directory_records,
    ...fixture.qxo.release.deal_directory_records,
  ]);

  for (const detailPackage of fixture.release.exact_detail_packages) {
    const expected = expectedPackages.find((item) => (
      item.row.row_serving_key === detailPackage.row.row_serving_key
    ));
    assert.ok(expected);
    assert.deepEqual(detailPackage.action_definitions, expected.action_definitions);
    assert.deepEqual(detailPackage.detail_payloads, expected.detail_payloads);
    assert.deepEqual(detailPackage.references, expected.references);
    assert.deepEqual(detailPackage.parent_edges, expected.parent_edges);
  }
  assert.deepEqual(fixture.release.deal_directory_records, expectedDirectory);
  assert.deepEqual(
    fixture.release.deal_directory_records.map((row) => row.application_deal_id),
    [APPLICATION_DEALS.QXO, APPLICATION_DEALS.LANDOS],
  );
  assert.equal(new Set(fixture.release.exact_detail_packages.map((detailPackage) => (
    detailPackage.references[0].source_detail_reference_id
  ))).size, 15);
});

test('release bytes are deterministic regardless of caller member and directory order', () => {
  const rebuilt = buildFixtureCandidateRelease({
    contract_bundle: fixture.contract,
    serving_namespace_id: fixture.servingNamespaceId,
    corpus_release_id: fixture.corpusReleaseId,
    members: [...fixture.members].reverse(),
    source_specific_members: [...fixture.sourceSpecificMembers].reverse(),
    validated_semantic_graphs: [...fixture.validatedSemanticGraphs].reverse(),
    correction_authority_selection: fixture.correctionAuthoritySelection,
    deal_directory_entries: [...fixture.dealDirectoryEntries].reverse(),
  });
  const fresh = buildMultiDealCandidateReleaseFixture();

  assert.deepEqual(rebuilt, fixture.release);
  assert.deepEqual(fresh.release, fixture.release);
});

test('cross-deal exact-detail substitution and incomplete directory coverage fail closed', () => {
  const crossedMembers = clone(fixture.members);
  const landosIndex = crossedMembers.findIndex((member) => (
    member.shared_row.governed_deal_key === 'deal:landos-abbvie'
  ));
  const qxoIndex = crossedMembers.findIndex((member) => (
    member.shared_row.governed_deal_key === 'deal:qxo-topbuild'
  ));
  crossedMembers[qxoIndex].exact_detail = clone(crossedMembers[landosIndex].exact_detail);

  assert.throws(() => buildFixtureCandidateRelease({
    contract_bundle: fixture.contract,
    serving_namespace_id: fixture.servingNamespaceId,
    corpus_release_id: fixture.corpusReleaseId,
    members: crossedMembers,
    source_specific_members: fixture.sourceSpecificMembers,
    correction_authority_selection: fixture.correctionAuthoritySelection,
    deal_directory_entries: fixture.dealDirectoryEntries,
  }), /fields do not match|closed atomic graph|not the same release member/);

  assert.throws(() => buildFixtureCandidateRelease({
    contract_bundle: fixture.contract,
    serving_namespace_id: fixture.servingNamespaceId,
    corpus_release_id: fixture.corpusReleaseId,
    members: fixture.members,
    source_specific_members: fixture.sourceSpecificMembers,
    correction_authority_selection: fixture.correctionAuthoritySelection,
    deal_directory_entries: [fixture.dealDirectoryEntries[0]],
  }), /cover every release deal exactly once/);
});

test('tampering with a carried detail reference or directory record breaks the certified roots', () => {
  const detailDrift = clone(fixture.release);
  detailDrift.exact_detail_packages[0].references[0].source_detail_reference_id = '0'.repeat(64);
  assert.throws(() => validateCandidateReleaseBundle(detailDrift), /certified roots|deal inventory/);

  const directoryDrift = clone(fixture.release);
  directoryDrift.deal_directory_records[0].governed_deal_key = 'deal:wrong';
  assert.throws(() => validateCandidateReleaseBundle(directoryDrift), /directory record identity|directory is incomplete/);
});

test('candidate validation rejects a validly re-signed row carrying its stale one-deal cohort', () => {
  const stale = clone(fixture.release);
  const row = stale.shared_rows.find((item) => (
    item.row_kind === 'CANONICAL_RESULT'
      && item.canonical_result.market_context.metric_key === 'NO_SHOP_NOTICE_PERIOD_DAYS'
  ));
  const market = row.canonical_result.market_context;
  market.cohort.counts = {
    eligible_deals: 1,
    applicable_deals: 1,
    examined_deals: 1,
    present_deals: 1,
    comparable_deals: 1,
    distribution_deals: 1,
    excluded_deals: 0,
    observation_slots: 1,
    excluded_slots: 0,
  };
  market.cohort.distribution = [{
    canonical_value: market.subject_observation.canonical_value,
    subject_count: 1,
    deal_count: 1,
  }];
  market.denominators.prevalence.deal_count = 1;
  market.denominators.distribution.deal_count = 1;
  delete row.canonical_payload_digest;
  row.canonical_payload_digest = contentId('SHARED_SERVING_ROW_PAYLOAD/V1', row);

  assert.throws(
    () => validateCandidateReleaseBundle(stale),
    /stale embedded market cohort statistics/,
  );
});

test('release-wide computation preserves a matching typed subject exclusion and rejects a stale receipt', () => {
  const row = clone(fixture.release.shared_rows.find((item) => (
    item.row_kind === 'CANONICAL_RESULT'
      && item.canonical_result.market_context.metric_key === 'IOC_CAPEX_THRESHOLD_PERCENT_OF_DEAL_VALUE'
  )));
  const membership = row.canonical_result.market_context.subject_cohort_membership;
  membership.status = 'EXCLUDED';
  membership.exclusion_reason = 'NOT_COMPARABLE_UNDER_COHORT_RULE';
  const { membership_receipt_id: _receiptId, ...receiptBody } = membership;
  membership.membership_receipt_id = contentId(
    'SUBJECT_COHORT_MEMBERSHIP_RECEIPT/V1',
    receiptBody,
  );
  const excluded = releaseWideMarketContext({
    row,
    servingNamespaceId: fixture.servingNamespaceId,
    observations: fixture.release.market_observations,
    exclusions: fixture.release.market_exclusions,
  });
  assert.deepEqual(excluded.subject_cohort_membership, membership);
  assert.equal(excluded.cohort.counts.comparable_deals, 0);
  assert.deepEqual(excluded.cohort.distribution, []);

  membership.cohort_digest = contentId('MARKET_COHORT/V1', 'stale-subject-receipt');
  const { membership_receipt_id: _staleReceiptId, ...staleReceiptBody } = membership;
  membership.membership_receipt_id = contentId(
    'SUBJECT_COHORT_MEMBERSHIP_RECEIPT/V1',
    staleReceiptBody,
  );
  assert.throws(
    () => releaseWideMarketContext({
      row,
      servingNamespaceId: fixture.servingNamespaceId,
      observations: fixture.release.market_observations,
      exclusions: fixture.release.market_exclusions,
    }),
    /stale subject exclusion receipt/,
  );
});

test('release-wide computation materialises inclusion when the incoming row has no receipt', () => {
  const row = clone(fixture.release.shared_rows.find((item) => (
    item.row_kind === 'CANONICAL_RESULT'
      && item.canonical_result.market_context.metric_key === 'IOC_CAPEX_THRESHOLD_PERCENT_OF_DEAL_VALUE'
  )));
  delete row.canonical_result.market_context.subject_cohort_membership;
  const market = releaseWideMarketContext({
    row,
    servingNamespaceId: fixture.servingNamespaceId,
    observations: fixture.release.market_observations,
    exclusions: fixture.release.market_exclusions,
  });
  assert.equal(market.subject_cohort_membership.status, 'INCLUDED');
  assert.equal(market.subject_cohort_membership.exclusion_reason, null);
  assert.equal(
    market.subject_cohort_membership.cohort_digest,
    market.cohort.cohort_digest,
  );
  assert.equal(market.cohort.counts.comparable_deals, 1);
});

test('release-wide computation rejects forged, invalid and unselected subject exclusion receipts', () => {
  const source = fixture.release.shared_rows.find((item) => (
    item.row_kind === 'CANONICAL_RESULT'
      && item.canonical_result.market_context.metric_key === 'IOC_CAPEX_THRESHOLD_PERCENT_OF_DEAL_VALUE'
  ));
  const releaseWide = (row) => releaseWideMarketContext({
    row,
    servingNamespaceId: fixture.servingNamespaceId,
    observations: fixture.release.market_observations,
    exclusions: fixture.release.market_exclusions,
  });
  const excludedRow = (reason) => {
    const row = clone(source);
    const membership = row.canonical_result.market_context.subject_cohort_membership;
    membership.status = 'EXCLUDED';
    membership.exclusion_reason = reason;
    const { membership_receipt_id: _receiptId, ...receiptBody } = membership;
    membership.membership_receipt_id = contentId(
      'SUBJECT_COHORT_MEMBERSHIP_RECEIPT/V1',
      receiptBody,
    );
    return row;
  };

  const forged = excludedRow('NOT_COMPARABLE_UNDER_COHORT_RULE');
  forged.canonical_result.market_context.subject_cohort_membership
    .membership_receipt_id = 'f'.repeat(64);
  assert.throws(() => releaseWide(forged), /receipt identity mismatch/);

  assert.throws(
    () => releaseWide(excludedRow('INVENTED_EXCLUSION_REASON')),
    /reason is invalid/,
  );
  assert.throws(
    () => releaseWide(excludedRow('FILTER_SECTOR_MISMATCH')),
    /no selected narrower filter/,
  );
});

test('uses the exact release-wide subject-cohort inclusion boundary', () => {
  const allowlistPath =
    '.github/phase-allowlists/wp-p8-stage4-release-wide-subject-cohort-inclusion-v1.json';
  const allowlist = JSON.parse(fs.readFileSync(allowlistPath, 'utf8'));
  assert.equal(
    allowlist.phase,
    'WP-P8-STAGE4-RELEASE-WIDE-SUBJECT-COHORT-INCLUSION-V1',
  );
  assert.deepEqual(allowlist.allowed, [
    allowlistPath,
    'lib/canonical-v2/candidate-release.js',
    'tests/canonical-v2-multi-deal-candidate-release.test.js',
  ]);
  assert.match(allowlist.note, /stale receipt fails closed/i);
});
