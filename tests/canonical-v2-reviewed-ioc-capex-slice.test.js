const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { canonicalJson } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContract } = require('../lib/canonical-v2/contract-bundle');
const { InMemoryCanonicalRepository, createCanonicalWriter } = require('../lib/canonical-v2/canonical-writer');
const {
  buildReviewedIocCapexServingRow,
  buildReviewedIocCapexSlice,
} = require('../lib/canonical-v2/reviewed-ioc-capex-slice');
const { adaptSharedServingRow, SURFACES } = require('../lib/canonical-v2/shared-row-adapter');
const { validateSharedServingRow } = require('../lib/canonical-v2/shared-serving-row');

const agreementText = fs.readFileSync('__fixtures__/demo-deal/landos-abbvie-agreement.txt', 'utf8');
const dealValueSourceText = fs.readFileSync('__fixtures__/canonical-v2/landos-deal-value-sec-excerpt.txt', 'utf8');
const contractBundle = compileFixtureContract();

function build() {
  return buildReviewedIocCapexSlice({ agreementText, dealValueSourceText, contractBundle });
}

test('the real Landos capex restriction becomes one deterministic source-backed percentage', () => {
  const first = build();
  const second = build();
  assert.equal(canonicalJson(first), canonicalJson(second));
  assert.equal(first.section.section_number, '5.2');
  assert.equal(first.excerpts.threshold.exact_text, '$100,000');
  assert.equal(first.excerpts.deal_value.exact_text, 'representing a total transaction value of approximately $137.5 million at the closing');
  assert.equal(first.thresholdClaim.raw_value, '$100,000');
  assert.equal(first.thresholdClaim.canonical_value, '0.07272727');
  assert.equal(first.thresholdClaim.unit, 'PERCENT_OF_DEAL_VALUE');
  assert.deepEqual(first.thresholdClaim.denominator, {
    value: '137500000',
    currency: 'USD',
    basis: 'HEADLINE_TRANSACTION_VALUE',
    source_lineage_ids: [first.excerpts.deal_value.excerpt_id],
  });
  assert.deepEqual(first.thresholdClaim.evidence.map((row) => row.document_ordinal), [0, 1]);
});

test('the capex result carries its pre-closing period and all three governing exceptions', () => {
  const slice = build();
  assert.deepEqual(slice.exceptionRelationship.target_occurrence_ids, [
    slice.exceptionComponent.provision_component_id,
  ]);
  assert.deepEqual(slice.exceptionRelationship.effect, {
    effect_mode: 'TYPED_LEGAL_EFFECT',
    legal_operation: 'EXCLUDES_CAPEX_RESTRICTION_WHEN_APPLICABLE',
    restriction_period: 'PRE_CLOSING_PERIOD',
    obligors: ['COMPANY', 'COMPANY_SUBSIDIARIES'],
    exceptions: [
      'REQUIRED_OR_CONTEMPLATED_BY_AGREEMENT_OR_LAW',
      'PARENT_WRITTEN_CONSENT',
      'COMPANY_DISCLOSURE_SCHEDULE',
    ],
    consent_standard: 'NOT_UNREASONABLY_WITHHELD_CONDITIONED_OR_DELAYED',
  });
  assert.equal(slice.exceptionRelationship.evidence.length, 2);
});

test('both immutable sources and every semantic object commit in one transaction', async () => {
  const slice = build();
  const repository = new InMemoryCanonicalRepository();
  const writer = createCanonicalWriter({ repository, contractBundle });
  const dryRun = await writer.write({
    operation: 'FIXTURE_DEAL_EXTRACTION_RUN',
    idempotencyKey: 'landos-ioc-capex-v1',
    dryRun: true,
    writeSet: slice.canonicalWriteSet,
  });
  assert.equal(dryRun.validation.counts.publishable, 10);
  assert.equal(dryRun.validation.counts.residuals, 0);

  await writer.write({
    operation: 'FIXTURE_DEAL_EXTRACTION_RUN',
    idempotencyKey: 'landos-ioc-capex-v1',
    writeSet: slice.canonicalWriteSet,
  });
  const stored = repository.snapshot();
  assert.equal(repository.transactionCount, 1);
  assert.equal(stored.sources.length, 2);
  assert.equal(stored.sourceAdmissions.length, 2);
  assert.equal(stored.excerpts.length, 4);
  assert.equal(stored.provisions.length, 2);
  assert.equal(stored.components.length, 2);
  assert.equal(stored.claims.length, 1);
  assert.equal(stored.relationships.length, 1);
});

test('source document ordinal is part of evidence validity', async () => {
  const slice = build();
  const writeSet = structuredClone(slice.canonicalWriteSet);
  writeSet.claims[0].evidence[1].document_ordinal = 0;
  const writer = createCanonicalWriter({ repository: new InMemoryCanonicalRepository(), contractBundle });
  const result = await writer.write({
    operation: 'FIXTURE_DEAL_EXTRACTION_RUN',
    idempotencyKey: 'wrong-source-ordinal',
    dryRun: true,
    writeSet,
  });
  assert.ok(result.validation.residuals.some((row) => row.reason_code === 'EVIDENCE_REFERENCE_UNRESOLVED'));
  assert.equal(result.validation.counts.quarantinedClosures, 1);
});

test('a deal-value denominator cannot cite lineage outside the claim evidence set', async () => {
  const slice = build();
  const writeSet = structuredClone(slice.canonicalWriteSet);
  writeSet.claims[0].denominator.source_lineage_ids = [slice.excerpts.threshold.excerpt_id];
  const writer = createCanonicalWriter({ repository: new InMemoryCanonicalRepository(), contractBundle });
  const result = await writer.write({
    operation: 'FIXTURE_DEAL_EXTRACTION_RUN',
    idempotencyKey: 'wrong-denominator-lineage',
    dryRun: true,
    writeSet,
  });
  assert.ok(result.validation.residuals.some((row) => row.reason_code === 'EVIDENCE_REFERENCE_UNRESOLVED'));
  assert.equal(result.validation.counts.quarantinedClosures, 1);
});

test('the percentage, raw dollars, denominator and legal terms reach every shared surface', () => {
  const slice = build();
  assert.equal(slice.projection.exclusion, null);
  const row = buildReviewedIocCapexServingRow({ slice, contractBundle });
  assert.equal(validateSharedServingRow(row), true);
  const component = row.canonical_result.components[0];
  assert.equal(component.raw_value, '$100,000');
  assert.equal(component.canonical_value, '0.07272727');
  assert.equal(component.denominator.value, '137500000');
  assert.deepEqual(component.denominator.source_lineage_ids, [slice.excerpts.deal_value.excerpt_id]);

  const adapted = adaptSharedServingRow(row);
  const metric = adapted.data.byRow[adapted.row_key].metrics.IOC_CAPEX_THRESHOLD_PERCENT_OF_DEAL_VALUE;
  assert.equal(metric.subject.percentOfDealValue, 0.07272727);
  assert.equal(metric.subject.rawAmount, '$100,000');
  assert.deepEqual(metric.subject.legalTerms.map((term) => term.label), [
    'Capex threshold',
    'Applies',
    'Exceptions',
    'Consent standard',
  ]);
  assert.equal(metric.distribution.normalised.cohorts[0].basis, 'headline_transaction_value');
  for (const surface of SURFACES) {
    assert.equal(adapted.surface_bindings[surface].typed_market, adapted.typed_market);
  }
});

test('either exact source drifting blocks the reviewed mapping', () => {
  assert.throws(() => buildReviewedIocCapexSlice({
    agreementText: `${agreementText} `,
    dealValueSourceText,
    contractBundle,
  }), /agreement source hash mismatch/);
  assert.throws(() => buildReviewedIocCapexSlice({
    agreementText,
    dealValueSourceText: `${dealValueSourceText} `,
    contractBundle,
  }), /deal-value source hash mismatch/);
});
