const test = require('node:test');
const assert = require('node:assert/strict');

const { buildLandosIocCapexServingFixture } = require('../__fixtures__/canonical-v2/landos-ioc-capex-row');
const { buildLandosMaterialContractsServingFixture } = require('../__fixtures__/canonical-v2/landos-material-contracts-row');
const { buildLandosNoShopServingFixture } = require('../__fixtures__/canonical-v2/landos-no-shop-rows');
const { buildLandosReviewedServingFixture } = require('../__fixtures__/canonical-v2/landos-reviewed-row');
const { buildLandosSourceSpecificServingFixture } = require('../__fixtures__/canonical-v2/landos-source-specific-row');
const { buildLandosTerminationFeeServingFixture } = require('../__fixtures__/canonical-v2/landos-termination-fee-row');
const { canonicalJson, contentId } = require('../lib/canonical-v2/canonical-bytes');
const { InMemoryCanonicalRepository, createCanonicalWriter } = require('../lib/canonical-v2/canonical-writer');
const {
  composeDealExtractionWriteSet,
  composeReferenceOnlyDealScopeWriteSet,
} = require('../lib/canonical-v2/deal-extraction-write-set');

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
  assert.equal(first.validated_semantic_graphs.length, 1);
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

  const conflictingGraphs = structuredClone(writeSets);
  const graph = conflictingGraphs.find((writeSet) => writeSet.validated_semantic_graphs?.length)
    .validated_semantic_graphs[0];
  conflictingGraphs[0].validated_semantic_graphs = [{ ...graph, document_hash: '0'.repeat(64) }];
  assert.throws(
    () => composeDealExtractionWriteSet({ writeSets: conflictingGraphs, deal }),
    /validated_semantic_graphs .* conflicting canonical content/,
  );
});

function referenceOnlyFamily({ family, closureId, excerptText = 'same source text' }) {
  const immutableSourceDocumentId = contentId('IMMUTABLE_SOURCE_DOCUMENT/V1', 'shared-source');
  const excerptId = contentId('EXCERPT/V1', 'shared-excerpt');
  return {
    source_references: [{
      schema_version: 'ADMITTED_SOURCE_REFERENCE/V1',
      source_ordinal: 0,
      immutable_source_document_id: immutableSourceDocumentId,
      source_admission_manifest_id: contentId('SOURCE_ADMISSION_MANIFEST/V2', 'shared-source'),
      canonical_text_id: contentId('CANONICAL_TEXT/V1', 'shared-source'),
    }],
    deal: {
      deal_key: 'deal:reference-only-test',
      deal_admission_id: contentId('DEAL_ADMISSION/V1', 'reference-only-test'),
      document_hash: 'a'.repeat(64),
      dimensions: { sector: 'Test' },
    },
    excerpts: [{
      excerpt_id: excerptId,
      exact_text: excerptText,
      family,
      closure_id: closureId,
    }],
  };
}

test('reference-only family graphs compose deterministically into one deal-scope write', () => {
  const sellerClosure = contentId('SEMANTIC_CLOSURE/V1', 'seller');
  const buyerClosure = contentId('SEMANTIC_CLOSURE/V1', 'buyer');
  const seller = referenceOnlyFamily({ family: 'termination-fee', closureId: sellerClosure });
  const buyer = referenceOnlyFamily({ family: 'termination-fee', closureId: buyerClosure });
  const deal = seller.deal;
  const first = composeReferenceOnlyDealScopeWriteSet({
    writeSets: [seller, buyer],
    deal,
  });
  const replay = composeReferenceOnlyDealScopeWriteSet({
    writeSets: [buyer, seller],
    deal,
  });

  assert.equal(canonicalJson(first), canonicalJson(replay));
  assert.equal(first.source_references.length, 1);
  assert.equal(first.excerpts.length, 1);
  assert.equal(
    first.excerpts[0].closure_id,
    contentId('COMPOSED_OBJECT_PUBLICATION_CLOSURE/V1', {
      object_type: 'excerpts',
      object_id: first.excerpts[0].excerpt_id,
      contributing_closure_ids: [buyerClosure, sellerClosure].sort(),
    }),
  );
});

test('reference-only composition fails closed on source, deal and semantic conflicts', () => {
  const seller = referenceOnlyFamily({
    family: 'termination-fee',
    closureId: contentId('SEMANTIC_CLOSURE/V1', 'seller'),
  });
  const buyer = referenceOnlyFamily({
    family: 'termination-fee',
    closureId: contentId('SEMANTIC_CLOSURE/V1', 'buyer'),
  });
  const missingSource = structuredClone(buyer);
  missingSource.source_references = [];
  assert.throws(
    () => composeReferenceOnlyDealScopeWriteSet({
      writeSets: [seller, missingSource],
      deal: seller.deal,
    }),
    /must carry admitted source references/,
  );

  const wrongDeal = structuredClone(buyer);
  wrongDeal.deal.document_hash = 'b'.repeat(64);
  assert.throws(
    () => composeReferenceOnlyDealScopeWriteSet({
      writeSets: [seller, wrongDeal],
      deal: seller.deal,
    }),
    /authoritative deal document_hash/,
  );

  const conflictingExcerpt = referenceOnlyFamily({
    family: 'termination-fee',
    closureId: contentId('SEMANTIC_CLOSURE/V1', 'buyer-conflict'),
    excerptText: 'invented source text',
  });
  assert.throws(
    () => composeReferenceOnlyDealScopeWriteSet({
      writeSets: [seller, conflictingExcerpt],
      deal: seller.deal,
    }),
    /excerpts .* conflicting canonical content/,
  );
});
