const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { buildQxoNoShopReleaseFixture } = require('../__fixtures__/canonical-v2/qxo-no-shop-release');
const { canonicalJson } = require('../lib/canonical-v2/canonical-bytes');
const { InMemoryCanonicalRepository, createCanonicalWriter } = require('../lib/canonical-v2/canonical-writer');
const { validateCandidateReleaseBundle } = require('../lib/canonical-v2/candidate-release');
const { adaptSharedServingRow, adaptSharedServingRows } = require('../lib/canonical-v2/shared-row-adapter');

test('QXO notice and match clocks retain exact source while hours canonicalise to days', () => {
  const fixture = buildQxoNoShopReleaseFixture();
  const byMetric = new Map(fixture.results.map((item) => [item.metric_key, item]));
  const notice = byMetric.get('NO_SHOP_NOTICE_PERIOD_DAYS');
  const match = byMetric.get('NO_SHOP_INITIAL_MATCH_PERIOD_DAYS');

  assert.equal(notice.claim.raw_value, 'twenty-four (24) hours after receipt');
  assert.equal(notice.claim.canonical_value, '1');
  assert.equal(notice.claim.unit, 'DAYS');
  assert.equal(notice.claim.day_basis, 'ELAPSED');
  assert.equal(notice.claim.attributes.raw_unit, 'HOURS');
  assert.equal(notice.claim.attributes.trigger, 'RECEIPT_OF_COMPETING_PROPOSAL');
  assert.equal(match.claim.raw_value, "four (4) business days' prior written notice");
  assert.equal(match.claim.canonical_value, '4');
  assert.equal(match.claim.unit, 'DAYS');
  assert.equal(match.claim.day_basis, 'BUSINESS');
  assert.equal(match.claim.attributes.raw_unit, 'DAYS');
  assert.equal(match.claim.attributes.trigger, 'SUPERIOR_PROPOSAL_NOTICE');
  assert.notEqual(notice.claim.attributes.basis_key, match.claim.attributes.basis_key);
});

test('QXO business-day notice opens as a valid shared row with bounded exact source', () => {
  const fixture = buildQxoNoShopReleaseFixture();
  const matchRow = fixture.rows.find((row) => (
    row.canonical_result.market_context.metric_key === 'NO_SHOP_INITIAL_MATCH_PERIOD_DAYS'
  ));
  const adapted = adaptSharedServingRow(matchRow);
  const metric = adapted.data.byRow[adapted.row_key].metrics.NO_SHOP_INITIAL_MATCH_PERIOD_DAYS;
  assert.equal(metric.subject.label, '4 business days');
  assert.equal(metric.subject.semantics.calendarBasis, 'business');
  assert.equal(metric.source.state, 'available');
  const detail = fixture.detailPackages.find((item) => item.row.row_serving_key === matchRow.row_serving_key);
  assert.equal(
    detail.detail_payloads[0].response_body.excerpt.exact_text,
    "four (4) business days' prior written notice",
  );
});

test('one malformed QXO provision fails locally and cannot crash its valid sibling', () => {
  const fixture = buildQxoNoShopReleaseFixture();
  const malformed = {
    row_serving_key: fixture.rows[0].row_serving_key,
    row_kind: 'UNRECOGNISED_PROVISION_CANDIDATE',
  };
  const prepared = adaptSharedServingRows([malformed, fixture.rows[1]]);
  assert.equal(prepared[0].render_kind, 'ROW_RENDER_FAILED');
  assert.equal(prepared[1].render_kind, 'ROW');
  assert.equal(prepared[1].prepared.resolution.label, 'Initial matching period');
});

test('QXO notice closure passes the authoritative writer and freezes into a complete candidate release', async () => {
  const fixture = buildQxoNoShopReleaseFixture();
  const writer = createCanonicalWriter({
    repository: new InMemoryCanonicalRepository(),
    contractBundle: fixture.contract,
  });
  const dryRun = await writer.write({
    operation: 'FIXTURE_DEAL_EXTRACTION_RUN',
    idempotencyKey: 'qxo-no-shop-notice-v1',
    writeSet: fixture.canonicalWriteSet,
    dryRun: true,
  });
  assert.equal(dryRun.dryRun, true);
  assert.equal(dryRun.validation.residuals.length, 0);
  assert.equal(validateCandidateReleaseBundle(fixture.release), true);
  assert.deepEqual(fixture.release.manifest.counts, {
    deals: 1,
    deal_directory_records: 1,
    metric_slots: 2,
    observations: 2,
    exclusions: 0,
    shared_rows: 2,
    source_specific_rows: 0,
    source_specific_serving_records: 0,
    exact_detail_packages: 2,
    query_records: 2,
    validated_semantic_graphs: 0,
    unresolved: 0,
    failed: 0,
    duplicates: 0,
  });
  assert.equal(fixture.release.deal_directory_records[0].application_deal_id, '7dc3a05f-b170-4d59-a255-b7103cca16e1');
});

test('QXO reviewed evidence and release are deterministic and source drift fails closed', () => {
  const first = buildQxoNoShopReleaseFixture();
  const second = buildQxoNoShopReleaseFixture();
  assert.equal(canonicalJson(first.release), canonicalJson(second.release));
  const source = fs.readFileSync('__fixtures__/canonical-v2/qxo-no-shop-reviewed-excerpts.txt', 'utf8');
  assert.throws(() => require('../lib/canonical-v2/reviewed-qxo-no-shop-slice').buildQxoNoShopNoticeSlice({
    sourceText: source.replace('twenty-four (24)', 'twenty five (25)'),
    contractBundle: first.contract,
  }), /source hash mismatch/);
});

test('production Review mounts the default-off canonical section and catches source failures inside the row', () => {
  const page = fs.readFileSync('pages/review/[id].js', 'utf8');
  const component = fs.readFileSync('components/review-v2/CanonicalReviewSection.jsx', 'utf8');
  assert.match(page, /<CanonicalReviewSection dealId=\{dealId\}/);
  assert.match(component, /NEXT_PUBLIC_CANONICAL_V2_REVIEW_ENABLED/);
  assert.match(component, /Other certified provisions remain available/);
  assert.match(component, /catch \(error\)/);
  assert.doesNotMatch(component, /throw error/);
});
