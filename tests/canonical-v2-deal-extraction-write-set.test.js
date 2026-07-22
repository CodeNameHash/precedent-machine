const test = require('node:test');
const assert = require('node:assert/strict');

const { buildLandosIocCapexServingFixture } = require('../__fixtures__/canonical-v2/landos-ioc-capex-row');
const { buildLandosMaterialContractsServingFixture } = require('../__fixtures__/canonical-v2/landos-material-contracts-row');
const { buildLandosNoShopServingFixture } = require('../__fixtures__/canonical-v2/landos-no-shop-rows');
const { buildLandosReviewedServingFixture } = require('../__fixtures__/canonical-v2/landos-reviewed-row');
const { buildLandosSourceSpecificServingFixture } = require('../__fixtures__/canonical-v2/landos-source-specific-row');
const { buildLandosTerminationFeeServingFixture } = require('../__fixtures__/canonical-v2/landos-termination-fee-row');
const { canonicalJson } = require('../lib/canonical-v2/canonical-bytes');
const { InMemoryCanonicalRepository, createCanonicalWriter } = require('../lib/canonical-v2/canonical-writer');
const { composeDealExtractionWriteSet } = require('../lib/canonical-v2/deal-extraction-write-set');

function landosFamilies() {
  const fixtures = [
    buildLandosReviewedServingFixture(),
    buildLandosIocCapexServingFixture(),
    buildLandosMaterialContractsServingFixture(),
    buildLandosNoShopServingFixture(),
    buildLandosTerminationFeeServingFixture(),
    buildLandosSourceSpecificServingFixture(),
  ];
  const deal = fixtures.find((fixture) => fixture.canonicalWriteSet.deal.dimensions.deal_value_usd)?.canonicalWriteSet.deal;
  return { fixtures, deal, contract: fixtures[0].contract };
}

test('all reviewed Landos families compose into one deterministic deal-run write set', () => {
  const { fixtures, deal } = landosFamilies();
  const writeSets = fixtures.map((fixture) => fixture.canonicalWriteSet);
  const first = composeDealExtractionWriteSet({ writeSets, deal });
  const replay = composeDealExtractionWriteSet({ writeSets: [...writeSets].reverse(), deal });

  assert.equal(canonicalJson(first), canonicalJson(replay));
  assert.equal(first.sources.length, 2);
  assert.equal(first.source_admissions.length, 2);
  assert.equal(first.deal.dimensions.deal_value_usd, '137500000');
  assert.ok(first.provisions.length > 10);
  assert.ok(first.claims.length > 20);
  assert.equal(first.open_world_candidates.length, 1);
  assert.equal(first.reviewed_source_specific_rows.length, 1);
});

test('the composed Landos extraction validates and writes in one transaction', async () => {
  const { fixtures, deal, contract } = landosFamilies();
  const writeSet = composeDealExtractionWriteSet({
    writeSets: fixtures.map((fixture) => fixture.canonicalWriteSet),
    deal,
  });
  const repository = new InMemoryCanonicalRepository();
  const writer = createCanonicalWriter({ repository, contractBundle: contract });
  const result = await writer.write({
    operation: 'FIXTURE_DEAL_EXTRACTION_RUN',
    idempotencyKey: 'landos-complete-reviewed-deal-v1',
    writeSet,
  });

  assert.equal(result.receipt.status, 'COMMITTED');
  assert.equal(result.validation.residuals.length, 0);
  assert.equal(result.validation.quarantines.length, 0);
  assert.equal(repository.transactionCount, 1);
  assert.equal(repository.snapshot().receipts.length, 1);
});

test('composition fails on semantic conflicts instead of choosing plausible values', () => {
  const { fixtures, deal } = landosFamilies();
  const writeSets = fixtures.map((fixture) => fixture.canonicalWriteSet);
  const conflictingDeal = structuredClone(deal);
  conflictingDeal.dimensions.deal_value_usd = '1';
  assert.throws(
    () => composeDealExtractionWriteSet({ writeSets, deal: conflictingDeal }),
    /deal dimension deal_value_usd/,
  );

  const conflictingWriteSets = structuredClone(writeSets);
  const repeatedClaim = conflictingWriteSets[0].claims[0];
  conflictingWriteSets[1].claims.push({ ...repeatedClaim, raw_value: 'invented' });
  assert.throws(
    () => composeDealExtractionWriteSet({ writeSets: conflictingWriteSets, deal }),
    /claims .* conflicting canonical content/,
  );
});
