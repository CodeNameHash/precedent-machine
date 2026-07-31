const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { canonicalJson } = require('../lib/canonical-v2/canonical-bytes');
const {
  compileFixtureContractV5,
} = require('../lib/canonical-v2/contract-bundle');
const { InMemoryCanonicalRepository, createCanonicalWriter } = require('../lib/canonical-v2/canonical-writer');
const {
  buildFixtureClaimEvidenceDetailPackage,
  GENERAL_ACTION_SLOT_KEY,
  validateFixtureExactDetailPackage,
} = require('../lib/canonical-v2/exact-detail');
const {
  buildReviewedIocCapexServingRow,
  buildReviewedIocCapexSlice,
} = require('../lib/canonical-v2/reviewed-ioc-capex-slice');
const { adaptSharedServingRow, SURFACES } = require('../lib/canonical-v2/shared-row-adapter');
const { validateSharedServingRow } = require('../lib/canonical-v2/shared-serving-row');

const agreementText = fs.readFileSync('__fixtures__/demo-deal/landos-abbvie-agreement.txt', 'utf8');
const dealValueSourceText = fs.readFileSync('__fixtures__/canonical-v2/landos-deal-value-sec-excerpt.txt', 'utf8');
const contractBundle = compileFixtureContractV5();

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
    precision: 'APPROXIMATE',
  });
  assert.equal(
    first.thresholdClaim.attributes.denominator_precision,
    'APPROXIMATE',
  );
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
  assert.equal(metric.subject.denominatorPrecision, 'APPROXIMATE');
  assert.equal(
    metric.subject.label,
    'Approximately 0.07% of headline deal value',
  );
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

test('the generic row action resolves either exact evidence source without broad document access', () => {
  const slice = build();
  const row = buildReviewedIocCapexServingRow({ slice, contractBundle });
  const inputs = [
    {
      source: slice.agreementSource,
      source_admission: slice.agreementAdmission,
      excerpt: slice.excerpts.threshold,
      evidence_ordinal: 0,
      exact_text: '$100,000',
    },
    {
      source: slice.dealValueSource,
      source_admission: slice.dealValueAdmission,
      excerpt: slice.excerpts.deal_value,
      evidence_ordinal: 1,
      exact_text: 'representing a total transaction value of approximately $137.5 million at the closing',
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
    assert.equal(detailPackage.detail_payloads[0].response_body.excerpt.exact_text, input.exact_text);
    assert.equal(validateFixtureExactDetailPackage({
      package: detailPackage,
      contract_bundle: contractBundle,
      source: input.source,
      source_admission: input.source_admission,
      excerpt: input.excerpt,
      claim: slice.thresholdClaim,
    }), true);
    assert.equal(detailPackage.row.source_actions[0].action_slot_key, GENERAL_ACTION_SLOT_KEY);
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
