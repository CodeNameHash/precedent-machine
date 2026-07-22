const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { canonicalJson } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContract } = require('../lib/canonical-v2/contract-bundle');
const { InMemoryCanonicalRepository, createCanonicalWriter } = require('../lib/canonical-v2/canonical-writer');
const {
  buildFixtureClaimEvidenceDetailPackage,
  GENERAL_ACTION_SLOT_KEY,
  validateFixtureExactDetailPackage,
} = require('../lib/canonical-v2/exact-detail');
const {
  buildReviewedMaterialContractsServingRow,
  buildReviewedMaterialContractsSlice,
} = require('../lib/canonical-v2/reviewed-material-contracts-slice');
const { adaptSharedServingRow, SURFACES } = require('../lib/canonical-v2/shared-row-adapter');
const { validateSharedServingRow } = require('../lib/canonical-v2/shared-serving-row');

const agreementText = fs.readFileSync('__fixtures__/demo-deal/landos-abbvie-agreement.txt', 'utf8');
const dealValueSourceText = fs.readFileSync('__fixtures__/canonical-v2/landos-deal-value-sec-excerpt.txt', 'utf8');
const contractBundle = compileFixtureContract();

function build() {
  return buildReviewedMaterialContractsSlice({ agreementText, dealValueSourceText, contractBundle });
}

test('the real Material Contracts cash-flow criterion becomes one deterministic percentage', () => {
  const first = build();
  const second = build();
  assert.equal(canonicalJson(first), canonicalJson(second));
  assert.equal(first.section.section_number, '3.13');
  assert.match(first.excerpts.criterion.exact_text, /payment of cash or other consideration by or to the Company/);
  assert.match(first.excerpts.criterion.exact_text, /in excess of \$100,000/);
  assert.equal(first.thresholdClaim.raw_value, '$100,000');
  assert.equal(first.thresholdClaim.canonical_value, '0.07272727');
  assert.equal(first.thresholdClaim.unit, 'PERCENT_OF_DEAL_VALUE');
  assert.equal(first.thresholdClaim.attributes.criterion_code, 'PAYMENTS_BY_OR_TO_COMPANY_PER_FISCAL_YEAR');
  assert.deepEqual(first.result.party, {
    role: 'REPRESENTATION_MAKER',
    value: 'COMPANY',
    capacity: 'TARGET',
  });
});

test('the criterion and denominator write together with no residuals', async () => {
  const slice = build();
  const repository = new InMemoryCanonicalRepository();
  const writer = createCanonicalWriter({ repository, contractBundle });
  const dryRun = await writer.write({
    operation: 'FIXTURE_DEAL_EXTRACTION_RUN',
    idempotencyKey: 'landos-material-contract-cash-flow-v1',
    dryRun: true,
    writeSet: slice.canonicalWriteSet,
  });
  assert.equal(dryRun.validation.counts.residuals, 0);
  assert.equal(dryRun.validation.counts.quarantinedClosures, 0);

  await writer.write({
    operation: 'FIXTURE_DEAL_EXTRACTION_RUN',
    idempotencyKey: 'landos-material-contract-cash-flow-v1',
    writeSet: slice.canonicalWriteSet,
  });
  const stored = repository.snapshot();
  assert.equal(repository.transactionCount, 1);
  assert.equal(stored.sources.length, 2);
  assert.equal(stored.excerpts.length, 2);
  assert.equal(stored.provisions.length, 1);
  assert.equal(stored.components.length, 1);
  assert.equal(stored.claims.length, 1);
});

test('the raw dollars, percentage and governing criterion reach every shared surface', () => {
  const slice = build();
  const row = buildReviewedMaterialContractsServingRow({ slice, contractBundle });
  assert.equal(validateSharedServingRow(row), true);
  const adapted = adaptSharedServingRow(row);
  const metric = adapted.data.byRow[adapted.row_key]
    .metrics.MATERIAL_CONTRACT_CASH_FLOW_THRESHOLD_PERCENT_OF_DEAL_VALUE;
  assert.equal(metric.subject.rawAmount, '$100,000');
  assert.equal(metric.subject.percentOfDealValue, 0.07272727);
  assert.deepEqual(metric.subject.legalTerms.map((term) => term.label), [
    'Cash-flow threshold',
    'Criterion',
    'Contract scope',
    'Cash flow',
    'Measured over',
    'Threshold rule',
    'Deal-value basis',
  ]);
  assert.match(metric.subject.legalTerms[1].value, /Payments by or to the Company/);
  assert.match(metric.subject.legalTerms.find((term) => term.key === 'period').value, /single fiscal year thereafter/);
  for (const surface of SURFACES) {
    assert.equal(adapted.surface_bindings[surface].typed_market, adapted.typed_market);
  }
});

test('the exact-detail action opens the full criterion or its denominator, never a broad source', () => {
  const slice = build();
  const row = buildReviewedMaterialContractsServingRow({ slice, contractBundle });
  const inputs = [
    {
      source: slice.agreementSource,
      source_admission: slice.agreementAdmission,
      excerpt: slice.excerpts.criterion,
      evidence_ordinal: 0,
    },
    {
      source: slice.dealValueSource,
      source_admission: slice.dealValueAdmission,
      excerpt: slice.excerpts.deal_value,
      evidence_ordinal: 1,
    },
  ];
  for (const input of inputs) {
    const detailPackage = buildFixtureClaimEvidenceDetailPackage({
      contract_bundle: contractBundle,
      row,
      claim: slice.thresholdClaim,
      action_slot_key: GENERAL_ACTION_SLOT_KEY,
      ...input,
    });
    assert.equal(
      detailPackage.detail_payloads[0].response_body.excerpt.exact_text,
      input.excerpt.exact_text,
    );
    assert.equal(validateFixtureExactDetailPackage({
      package: detailPackage,
      contract_bundle: contractBundle,
      source: input.source,
      source_admission: input.source_admission,
      excerpt: input.excerpt,
      claim: slice.thresholdClaim,
    }), true);
  }
});

test('source drift blocks the reviewed Material Contracts mapping', () => {
  assert.throws(() => buildReviewedMaterialContractsSlice({
    agreementText: `${agreementText} `,
    dealValueSourceText,
    contractBundle,
  }), /agreement source hash mismatch/);
  assert.throws(() => buildReviewedMaterialContractsSlice({
    agreementText,
    dealValueSourceText: `${dealValueSourceText} `,
    contractBundle,
  }), /deal-value source hash mismatch/);
});
