const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const {
  canonicalJson,
  contentId,
} = require('../lib/canonical-v2/canonical-bytes');
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
  validateReviewedIocCapexServingRow,
} = require('../lib/canonical-v2/reviewed-ioc-capex-slice');
const { compileMarketCohortRequest } = require('../lib/canonical-v2/market-cohort-query');
const { adaptSharedServingRow, SURFACES } = require('../lib/canonical-v2/shared-row-adapter');
const {
  buildCanonicalResultServingRow,
  buildSubjectCohortMembershipReceipt,
  validateSharedServingRow,
} = require('../lib/canonical-v2/shared-serving-row');

const agreementText = fs.readFileSync('__fixtures__/demo-deal/landos-abbvie-agreement.txt', 'utf8');
const dealValueSourceText = fs.readFileSync('__fixtures__/canonical-v2/landos-deal-value-sec-excerpt.txt', 'utf8');
const contractBundle = compileFixtureContractV5();

function build() {
  return buildReviewedIocCapexSlice({ agreementText, dealValueSourceText, contractBundle });
}

function resealRow(row) {
  delete row.canonical_payload_digest;
  row.canonical_payload_digest = contentId(
    'SHARED_SERVING_ROW_PAYLOAD/V1',
    row,
  );
  return row;
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
  assert.equal(metric.distribution.normalised.cohorts[0].percent.stats.n, 1);
  assert.deepEqual(metric.distribution.normalised.cohorts[0].dealIds, []);
  assert.deepEqual(metric.exclusions, []);
  assert.deepEqual(metric.subject.cohortMembership, {
    status: 'included',
    exclusionReason: null,
  });
  for (const surface of SURFACES) {
    assert.equal(adapted.surface_bindings[surface].typed_market, adapted.typed_market);
    assert.deepEqual(
      adapted.surface_bindings[surface].typed_market.data.byRow[adapted.row_key]
        .metrics.IOC_CAPEX_THRESHOLD_PERCENT_OF_DEAL_VALUE.subject.cohortMembership,
      { status: 'included', exclusionReason: null },
    );
  }
});

test('the Landos Review subject remains source-backed and is included in its market cohort', () => {
  const slice = build();
  const row = buildReviewedIocCapexServingRow({ slice, contractBundle });
  const market = row.canonical_result.market_context;
  assert.equal(
    market.subject_observation.market_observation_serving_key,
    slice.projection.observation.market_observation_serving_key,
  );
  assert.equal(
    market.subject_observation.canonical_value,
    slice.thresholdClaim.canonical_value,
  );
  assert.equal(market.subject_cohort_membership.status, 'INCLUDED');
  assert.equal(market.subject_cohort_membership.exclusion_reason, null);
  assert.deepEqual(market.cohort.counts, {
    eligible_deals: 1,
    applicable_deals: 1,
    examined_deals: 1,
    present_deals: 1,
    comparable_deals: 1,
    distribution_deals: 1,
    excluded_deals: 0,
    observation_slots: 1,
    excluded_slots: 0,
  });
  assert.deepEqual(market.cohort.distribution, [{
    canonical_value: slice.thresholdClaim.canonical_value,
    subject_count: 1,
    deal_count: 1,
  }]);
  assert.deepEqual(market.cohort.exclusions, []);
  assert.equal(validateReviewedIocCapexServingRow(row), true);
});

test('rejects a re-signed false subject exclusion', () => {
  const slice = build();
  const row = structuredClone(
    buildReviewedIocCapexServingRow({ slice, contractBundle }),
  );
  const membership = row.canonical_result.market_context.subject_cohort_membership;
  membership.status = 'EXCLUDED';
  membership.exclusion_reason = 'NOT_COMPARABLE_UNDER_COHORT_RULE';
  const { membership_receipt_id: _receiptId, ...receiptBody } = membership;
  membership.membership_receipt_id = contentId(
    'SUBJECT_COHORT_MEMBERSHIP_RECEIPT/V1',
    receiptBody,
  );
  assert.throws(
    () => validateReviewedIocCapexServingRow(resealRow(row)),
    /must include its subject deal/,
  );
});

test('rejects a self-rehashed inclusion receipt not bound to the subject observation', () => {
  const slice = build();
  const row = structuredClone(
    buildReviewedIocCapexServingRow({ slice, contractBundle }),
  );
  const membership = row.canonical_result.market_context.subject_cohort_membership;
  membership.market_observation_serving_key = contentId(
    'MARKET_OBSERVATION/V1',
    'forged-subject-observation',
  );
  const { membership_receipt_id: _receiptId, ...receiptBody } = membership;
  membership.membership_receipt_id = contentId(
    'SUBJECT_COHORT_MEMBERSHIP_RECEIPT/V1',
    receiptBody,
  );
  assert.throws(
    () => validateReviewedIocCapexServingRow(resealRow(row)),
    /does not bind the selected observation/,
  );
});

test('rejects a self-rehashed row with a cohort digest different from its receipt', () => {
  const slice = build();
  const row = structuredClone(
    buildReviewedIocCapexServingRow({ slice, contractBundle }),
  );
  row.canonical_result.market_context.cohort.cohort_digest = contentId(
    'MARKET_COHORT/V1',
    'forged-stored-cohort',
  );
  assert.throws(
    () => validateReviewedIocCapexServingRow(resealRow(row)),
    /does not match the stored cohort/,
  );
});

test('represents an explicit narrower-filter exclusion with its typed reason', () => {
  const slice = build();
  const observation = slice.projection.observation;
  const request = {
    serving_namespace_id: contentId('SERVING_NAMESPACE/V1', 'landos-reviewed-fixture'),
    corpus_release_id: observation.corpus_release_id,
    contract_fingerprint: contractBundle.fingerprint,
    metric_key: observation.metric_key,
    metric_version: observation.metric_version,
    concept_key: observation.concept_key,
    party: observation.party,
    subject_deal_key: observation.deal_key,
    filters: { min_value_usd: '137500001' },
  };
  const compiled = compileMarketCohortRequest(request);
  const row = buildCanonicalResultServingRow({
    contract_bundle: contractBundle,
    frozen_pair_id: contentId('FROZEN_PAIR/V1', {
      reviewed_mapping_id: slice.reviewed_mapping.reviewed_mapping_id,
      contract_fingerprint: contractBundle.fingerprint,
    }),
    projection_output: slice.projection,
    cohort_request: request,
    cohort_result: {
      schema_version: 'MARKET_COHORT_RESULT/V1',
      serving_namespace_id: compiled.serving_namespace_id,
      corpus_release_id: compiled.corpus_release_id,
      contract_fingerprint: compiled.contract_fingerprint,
      cohort_digest: compiled.cohort_digest,
      metric_key: compiled.metric_key,
      metric_version: compiled.metric_version,
      concept_key: compiled.concept_key,
      subject_deal_key: compiled.subject_deal_key,
      counts: {
        eligible_deals: 0,
        applicable_deals: 0,
        examined_deals: 0,
        present_deals: 0,
        comparable_deals: 0,
        distribution_deals: 0,
        excluded_deals: 0,
        observation_slots: 0,
        excluded_slots: 0,
      },
      distribution: [],
      exclusions: [],
    },
    subject_cohort_membership: buildSubjectCohortMembershipReceipt({
      cohort_request: request,
      observation,
      status: 'EXCLUDED',
      exclusion_reason: 'FILTER_DEAL_VALUE_OUT_OF_RANGE',
    }),
    result_ordinal: 0,
  });
  assert.deepEqual(
    adaptSharedServingRow(row).data.byRow[row.row_serving_key]
      .metrics.IOC_CAPEX_THRESHOLD_PERCENT_OF_DEAL_VALUE.subject.cohortMembership,
    { status: 'excluded', exclusionReason: 'FILTER_DEAL_VALUE_OUT_OF_RANGE' },
  );
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

test('uses the exact IOC subject-cohort inclusion boundary', () => {
  const allowlistPath =
    '.github/phase-allowlists/wp-p8-stage4-ioc-subject-cohort-inclusion-v1.json';
  const allowlist = JSON.parse(fs.readFileSync(allowlistPath, 'utf8'));
  assert.equal(
    allowlist.phase,
    'WP-P8-STAGE4-IOC-SUBJECT-COHORT-INCLUSION-V1',
  );
  assert.deepEqual(allowlist.allowed, [
    allowlistPath,
    'lib/canonical-v2/reviewed-ioc-capex-slice.js',
    'lib/canonical-v2/shared-row-adapter.js',
    'lib/canonical-v2/shared-serving-row.js',
    'tests/canonical-v2-reviewed-ioc-capex-slice.test.js',
  ]);
  assert.match(allowlist.note, /included/i);
  assert.match(allowlist.note, /typed exclusion reason/i);
});
