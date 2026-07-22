const test = require('node:test');
const assert = require('node:assert/strict');

const {
  APPLICATION_DEALS,
  buildMultiDealCandidateReleaseFixture,
} = require('../__fixtures__/canonical-v2/multi-deal-candidate-release');
const {
  buildFixtureCandidateRelease,
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
    row.canonical_result.market_context.cohort.counts.comparable_deals === 1
      && row.canonical_result.market_context.cohort.counts.distribution_deals === 1
      && row.canonical_result.market_context.cohort.distribution[0].deal_count === 1
  )), true);
  const feeRow = release.shared_rows.find((row) => (
    row.row_kind === 'CANONICAL_RESULT'
      && row.canonical_result.market_context.metric_key === 'SELLER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE'
  ));
  assert.equal(feeRow.canonical_result.market_context.cohort.counts.comparable_deals, 0);
  assert.deepEqual(feeRow.canonical_result.market_context.cohort.distribution, []);
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
    deal_directory_entries: fixture.dealDirectoryEntries,
  }), /closed atomic graph|not the same release member/);

  assert.throws(() => buildFixtureCandidateRelease({
    contract_bundle: fixture.contract,
    serving_namespace_id: fixture.servingNamespaceId,
    corpus_release_id: fixture.corpusReleaseId,
    members: fixture.members,
    source_specific_members: fixture.sourceSpecificMembers,
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
      && item.canonical_result.market_context.metric_key === 'SELLER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE'
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
