'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { canonicalJson, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const {
  AGREEMENT_TEXT_STATUS,
  AUTHORITY,
  RECORD_KIND,
  ROUNDING_MODE,
  SCHEMA_VERSION,
  buildDerivationPolicy,
  buildFxRateReceipt,
  buildFxRateVerification,
  buildMoneySourceResolution,
  buildSigningDateResolution,
  convertMoneyFx,
  convertPeriod,
  deriveMoneyComparison,
  validateDerivedComparison,
  validateFxRateReceipt,
} = require('../lib/canonical-v2/derived-comparison');

const VERSION = 'CANONICAL_DERIVED_COMPARISON/2026-08-04/V3';
const PERIOD_RULES = [
  'ANNUAL_TO_MONTHLY_DIV12',
  'ANNUAL_TO_QUARTERLY_DIV4',
  'MONTHLY_TO_ANNUAL_X12',
  'QUARTERLY_TO_ANNUAL_X4',
];

function digest(label) {
  return sha256Hex(`test:${label}`);
}

function reference(label) {
  return {
    claim_revision_id: digest(`claim:${label}`),
    evidence_excerpt_id: digest(`excerpt:${label}`),
  };
}

function fixture({
  label = 'source',
  literal = 'EUR 20,000,000 per year',
  value = '20000000',
  currency = 'EUR',
  basis = 'AGGREGATE',
  period = 'ANNUAL',
  signingDate = '2026-08-03',
  displayDecimalPlaces = 8,
} = {}) {
  const sourceReference = reference(label);
  const signingDateReference = reference(`signing:${label}`);
  const dealSnapshotId = digest(`deal:${label}`);
  const sourceResolution = buildMoneySourceResolution({
    resolutionPolicyId: digest('money-source-resolution-policy'),
    claimRevisionId: sourceReference.claim_revision_id,
    evidenceExcerptId: sourceReference.evidence_excerpt_id,
    dealSnapshotId,
    literal,
    value,
    currency,
    basis,
    period,
  });
  const signingResolution = buildSigningDateResolution({
    resolutionPolicyId: digest('signing-date-resolution-policy'),
    claimRevisionId: signingDateReference.claim_revision_id,
    evidenceExcerptId: signingDateReference.evidence_excerpt_id,
    evidenceTextSha256: digest(`signing-date-evidence:${label}`),
    dealSnapshotId,
    date: signingDate,
  });
  const policy = buildDerivationPolicy({
    derivationVersion: VERSION,
    policyAuthorityId: digest('derivation-policy-authority'),
    currencyPolicyId: digest('currency-policy'),
    moneySourceResolutionPolicyId: digest('money-source-resolution-policy'),
    signingDateResolutionPolicyId: digest('signing-date-resolution-policy'),
    fxVerificationPolicyId: digest('fx-verification-policy'),
    displayDecimalPlaces,
    permittedPeriodRules: PERIOD_RULES,
  });
  const trustedContext = {
    resolveMoneySource(input) {
      if (canonicalJson(input) !== canonicalJson(sourceReference)) throw new TypeError('unknown raw money claim');
      return sourceResolution;
    },
    resolveSigningDate(input) {
      if (canonicalJson(input) !== canonicalJson(signingDateReference)) throw new TypeError('unknown signing-date claim');
      return signingResolution;
    },
    resolveDerivationPolicy(input) {
      if (input.derivation_version !== VERSION) throw new TypeError('unknown derivation policy');
      return policy;
    },
    validateCurrency(input) {
      return input.currency_policy_id === digest('currency-policy')
        && ['EUR', 'GBP', 'USD'].includes(input.currency_code);
    },
    verifyFxRateReceipt(input) {
      if (input.provider_id !== 'APPROVED_TEST_PROVIDER' || input.provider_version !== 'FIXTURE/V1') {
        throw new TypeError('unapproved FX provider');
      }
      return buildFxRateVerification({
        verificationPolicyId: digest('fx-verification-policy'),
        fxRateReceiptId: input.fx_rate_receipt_id,
        verificationEvidenceDigest: digest(`fx-verification:${input.fx_rate_receipt_id}`),
      });
    },
  };
  return { sourceReference, signingDateReference, sourceResolution, signingResolution, policy, trustedContext };
}

function fxReceipt(overrides = {}) {
  return buildFxRateReceipt({
    providerId: 'APPROVED_TEST_PROVIDER',
    providerVersion: 'FIXTURE/V1',
    providerResponseDigest: digest(`provider-response:${canonicalJson(overrides)}`),
    baseCurrency: 'EUR',
    quoteCurrency: 'USD',
    rate: '1.0873',
    rateDate: '2026-08-03',
    ...overrides,
  });
}

test('signing-date FX creates a non-authoritative comparison over one resolved raw claim', () => {
  const f = fixture();
  const value = convertMoneyFx({
    sourceReference: f.sourceReference,
    targetCurrency: 'USD',
    fxRateReceipt: fxReceipt(),
    signingDateReference: f.signingDateReference,
    derivationVersion: VERSION,
  }, f.trustedContext);

  assert.equal(value.schema_version, SCHEMA_VERSION);
  assert.equal(value.record_kind, RECORD_KIND);
  assert.equal(value.authority, AUTHORITY);
  assert.equal(value.agreement_text_status, AGREEMENT_TEXT_STATUS);
  assert.equal(value.output.canonical_decimal, '21746000');
  assert.equal(value.output.exact_numerator, '21746000');
  assert.equal(value.output.exact_denominator, '1');
  assert.equal(value.display.status, 'DISPLAY_ONLY_NOT_COMPARISON_INPUT');
  assert.equal(value.transformation.fx.applied_rule, 'SIGNING_DATE_FX_SPOT_MULTIPLY');
  assert.equal(value.source_resolution.source.literal, 'EUR 20,000,000 per year');
  assert.equal(value.source_resolution.source_record_kind, 'GOVERNED_RAW_CLAIM');
  assert.equal(value.comparability_state, 'COMPARABLE');
  assert.doesNotThrow(() => validateDerivedComparison(value, f.trustedContext));
  assert.doesNotThrow(() => validateFxRateReceipt(value.transformation.fx.fx_rate_receipt));
});

test('display rounding never replaces the exact comparison value', () => {
  const f = fixture({ label: 'rounding', literal: 'EUR 1', value: '1', period: null, displayDecimalPlaces: 2 });
  const value = convertMoneyFx({
    sourceReference: f.sourceReference,
    targetCurrency: 'USD',
    fxRateReceipt: fxReceipt({ rate: '1.005' }),
    signingDateReference: f.signingDateReference,
    derivationVersion: VERSION,
  }, f.trustedContext);

  assert.deepEqual(value.output, {
    exact_numerator: '201',
    exact_denominator: '200',
    canonical_decimal: '1.005',
    unit: 'MONEY',
    currency: 'USD',
    basis: 'AGGREGATE',
    period: null,
  });
  assert.equal(value.display.value, '1.01');
  assert.equal(value.display.rounding_applied, true);
  assert.equal(value.display.rounding_mode, ROUNDING_MODE);
});

test('FX exclusions are deterministic but retain every supplied trusted operand', () => {
  const f = fixture();
  const cases = [
    [{ fxRateReceipt: null, signingDateReference: f.signingDateReference }, 'MISSING_FX_RATE_RECEIPT'],
    [{ fxRateReceipt: fxReceipt({ rate: '0' }), signingDateReference: f.signingDateReference }, 'NON_POSITIVE_FX_RATE'],
    [{ fxRateReceipt: fxReceipt({ baseCurrency: 'GBP' }), signingDateReference: f.signingDateReference }, 'FX_PAIR_DIRECTION_MISMATCH'],
    [{ fxRateReceipt: fxReceipt(), signingDateReference: null }, 'MISSING_SIGNING_DATE_BINDING'],
    [{ fxRateReceipt: fxReceipt({ rateDate: '2026-08-02' }), signingDateReference: f.signingDateReference }, 'FX_RATE_DATE_NOT_SIGNING_DATE'],
  ];

  for (const [overrides, reason] of cases) {
    const value = convertMoneyFx({
      sourceReference: f.sourceReference,
      targetCurrency: 'USD',
      derivationVersion: VERSION,
      ...overrides,
    }, f.trustedContext);
    assert.equal(value.output, null, reason);
    assert.equal(value.display, null, reason);
    assert.equal(value.comparability_state, 'EXCLUDED', reason);
    assert.equal(value.exclusion_reason, reason);
    if (overrides.signingDateReference) assert.ok(value.transformation.fx.signing_date_resolution, reason);
    assert.doesNotThrow(() => validateDerivedComparison(value, f.trustedContext));
  }
});

test('period conversion preserves the source and uses an approved exact factor', () => {
  const f = fixture({ label: 'monthly', literal: '$2 million per month', value: '2000000', currency: 'USD', basis: 'PER_COVENANT_LIMIT', period: 'MONTHLY' });
  const value = convertPeriod({
    sourceReference: f.sourceReference,
    targetPeriod: 'ANNUAL',
    transformationRule: 'MONTHLY_TO_ANNUAL_X12',
    derivationVersion: VERSION,
  }, f.trustedContext);

  assert.equal(value.output.canonical_decimal, '24000000');
  assert.deepEqual(value.source_resolution.source, {
    literal: '$2 million per month',
    literal_sha256: sha256Hex('$2 million per month'),
    value: '2000000',
    unit: 'MONEY',
    currency: 'USD',
    basis: 'PER_COVENANT_LIMIT',
    period: 'MONTHLY',
  });
  assert.equal(value.target.period, 'ANNUAL');
  assert.equal(value.transformation.period.applied_rule, 'MONTHLY_TO_ANNUAL_X12');
  assert.doesNotThrow(() => validateDerivedComparison(value, f.trustedContext));
});

test('non-terminating period division remains an exact rational', () => {
  const f = fixture({ label: 'annual', literal: '$10 per year', value: '10', currency: 'USD', period: 'ANNUAL', displayDecimalPlaces: 2 });
  const value = convertPeriod({
    sourceReference: f.sourceReference,
    targetPeriod: 'MONTHLY',
    transformationRule: 'ANNUAL_TO_MONTHLY_DIV12',
    derivationVersion: VERSION,
  }, f.trustedContext);

  assert.equal(value.output.exact_numerator, '5');
  assert.equal(value.output.exact_denominator, '6');
  assert.equal(value.output.canonical_decimal, null);
  assert.equal(value.display.value, '0.83');
  assert.doesNotThrow(() => validateDerivedComparison(value, f.trustedContext));
});

test('FX and period conversion compose over the same raw claim without derived-on-derived input', () => {
  const f = fixture({ label: 'composed', literal: 'EUR 100 per month', value: '100', period: 'MONTHLY', displayDecimalPlaces: 2 });
  const value = deriveMoneyComparison({
    sourceReference: f.sourceReference,
    targetCurrency: 'USD',
    targetPeriod: 'ANNUAL',
    transformationRule: 'MONTHLY_TO_ANNUAL_X12',
    fxRateReceipt: fxReceipt({ rate: '1.2' }),
    signingDateReference: f.signingDateReference,
    derivationVersion: VERSION,
  }, f.trustedContext);

  assert.equal(value.comparison_kind, 'FX_AND_PERIOD_NORMALISATION');
  assert.equal(value.output.canonical_decimal, '1440');
  assert.equal(value.transformation.fx.applied_rule, 'SIGNING_DATE_FX_SPOT_MULTIPLY');
  assert.equal(value.transformation.period.applied_rule, 'MONTHLY_TO_ANNUAL_X12');
  assert.doesNotThrow(() => validateDerivedComparison(value, f.trustedContext));
});

test('records and all nested trust receipts are immutable', () => {
  const f = fixture();
  const value = convertMoneyFx({
    sourceReference: f.sourceReference,
    targetCurrency: 'USD',
    fxRateReceipt: fxReceipt(),
    signingDateReference: f.signingDateReference,
    derivationVersion: VERSION,
  }, f.trustedContext);
  assert.equal(Object.isFrozen(value), true);
  assert.equal(Object.isFrozen(value.source_resolution), true);
  assert.equal(Object.isFrozen(value.transformation), true);
  assert.equal(Object.isFrozen(value.transformation.fx.fx_rate_receipt), true);
  assert.equal(Object.isFrozen(value.transformation.fx.fx_rate_verification), true);
  assert.equal(Object.isFrozen(value.transformation.fx.signing_date_resolution), true);
  assert.equal(Object.isFrozen(value.output), true);
});
