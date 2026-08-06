'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { canonicalJson, contentId, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const {
  buildDerivationPolicy,
  buildFxRateReceipt,
  buildFxRateVerification,
  buildMoneySourceResolution,
  buildSigningDateResolution,
  convertMoneyFx,
  convertPeriod,
  deriveMoneyComparison,
  validateDerivedComparison,
} = require('../lib/canonical-v2/derived-comparison');

const VERSION = 'HOSTILE_DERIVED_COMPARISON/2026-08-04/V3';
const RULES = ['ANNUAL_TO_MONTHLY_DIV12', 'MONTHLY_TO_ANNUAL_X12'];

function digest(label) {
  return sha256Hex(`hostile:${label}`);
}

function ref(label) {
  return {
    claim_revision_id: digest(`claim:${label}`),
    evidence_excerpt_id: digest(`excerpt:${label}`),
  };
}

function harness({
  label = 'raw',
  literal = 'EUR 100 per month',
  value = '100',
  currency = 'EUR',
  basis = 'PER_MONTH_LIMIT',
  period = 'MONTHLY',
  dealSnapshotId = digest(`deal:${label}`),
  signingDealSnapshotId = dealSnapshotId,
  signingDate = '2026-08-03',
  displayDecimalPlaces = 2,
  acceptedCurrencies = ['EUR', 'GBP', 'USD'],
} = {}) {
  const sourceReference = ref(label);
  const signingDateReference = ref(`signing:${label}`);
  const sourceResolution = buildMoneySourceResolution({
    resolutionPolicyId: digest('source-policy'),
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
    resolutionPolicyId: digest('signing-policy'),
    claimRevisionId: signingDateReference.claim_revision_id,
    evidenceExcerptId: signingDateReference.evidence_excerpt_id,
    evidenceTextSha256: digest(`signing-evidence:${label}`),
    dealSnapshotId: signingDealSnapshotId,
    date: signingDate,
  });
  const policy = buildDerivationPolicy({
    derivationVersion: VERSION,
    policyAuthorityId: digest('policy-authority'),
    currencyPolicyId: digest('currency-policy'),
    moneySourceResolutionPolicyId: digest('source-policy'),
    signingDateResolutionPolicyId: digest('signing-policy'),
    fxVerificationPolicyId: digest('fx-policy'),
    displayDecimalPlaces,
    permittedPeriodRules: RULES,
  });
  const trustedContext = {
    resolveMoneySource(input) {
      if (canonicalJson(input) !== canonicalJson(sourceReference)) throw new TypeError('unknown raw claim revision');
      return sourceResolution;
    },
    resolveSigningDate(input) {
      if (canonicalJson(input) !== canonicalJson(signingDateReference)) throw new TypeError('unknown signing date revision');
      return signingResolution;
    },
    resolveDerivationPolicy(input) {
      if (input.derivation_version !== VERSION) throw new TypeError('unknown derivation policy');
      return policy;
    },
    validateCurrency(input) {
      return input.currency_policy_id === digest('currency-policy')
        && acceptedCurrencies.includes(input.currency_code);
    },
    verifyFxRateReceipt(input) {
      if (input.provider_id !== 'TRUSTED_TEST_FEED' || input.provider_version !== 'FIXTURE/V1') {
        throw new TypeError('unapproved FX provider');
      }
      return buildFxRateVerification({
        verificationPolicyId: digest('fx-policy'),
        fxRateReceiptId: input.fx_rate_receipt_id,
        verificationEvidenceDigest: digest(`verified:${input.fx_rate_receipt_id}`),
      });
    },
  };
  return { sourceReference, signingDateReference, sourceResolution, signingResolution, policy, trustedContext };
}

function receipt(overrides = {}) {
  return buildFxRateReceipt({
    providerId: 'TRUSTED_TEST_FEED',
    providerVersion: 'FIXTURE/V1',
    providerResponseDigest: digest(`provider-response:${canonicalJson(overrides)}`),
    baseCurrency: 'EUR',
    quoteCurrency: 'USD',
    rate: '1.2',
    rateDate: '2026-08-03',
    ...overrides,
  });
}

function comparable(h, overrides = {}) {
  return deriveMoneyComparison({
    sourceReference: h.sourceReference,
    targetCurrency: 'USD',
    fxRateReceipt: receipt(),
    signingDateReference: h.signingDateReference,
    derivationVersion: VERSION,
    ...overrides,
  }, h.trustedContext);
}

function forgeRecord(value, mutate) {
  const payload = structuredClone(value);
  delete payload.derived_comparison_id;
  delete payload.derived_comparison_payload_digest;
  mutate(payload);
  const withDigest = {
    ...payload,
    derived_comparison_payload_digest: contentId('DERIVED_COMPARISON_PAYLOAD/V3', payload),
  };
  return {
    ...withDigest,
    derived_comparison_id: contentId('DERIVED_COMPARISON_RECORD/V3', withDigest),
  };
}

test('construction and validation fail without the injected trust boundary', () => {
  const h = harness();
  const input = {
    sourceReference: h.sourceReference,
    targetCurrency: 'USD',
    fxRateReceipt: receipt(),
    signingDateReference: h.signingDateReference,
    derivationVersion: VERSION,
  };
  assert.throws(() => convertMoneyFx(input), /trustedContext/);
  const value = convertMoneyFx(input, h.trustedContext);
  assert.throws(() => validateDerivedComparison(value), /trustedContext/);
});

test('the resolver, not caller text, supplies the complete raw money tuple', () => {
  const h = harness();
  const base = comparable(h);
  assert.equal(base.source_resolution.source.value, '100');

  assert.throws(() => comparable(h, { sourceAmount: '999' }), /closed contract/);
  assert.throws(() => comparable(h, { sourceCurrency: 'USD' }), /closed contract/);
  assert.throws(() => comparable(h, { sourceBasis: 'BANANAS' }), /closed contract/);

  const unknown = { claim_revision_id: digest('made-up-claim'), evidence_excerpt_id: digest('made-up-excerpt') };
  assert.throws(() => comparable(h, { sourceReference: unknown }), /unknown raw claim revision/);
});

test('a derived record cannot be relabelled as a raw source', () => {
  const h = harness();
  const first = comparable(h);
  assert.throws(() => convertPeriod({
    sourceReference: {
      claim_revision_id: first.derived_comparison_id,
      evidence_excerpt_id: h.sourceReference.evidence_excerpt_id,
    },
    targetPeriod: 'ANNUAL',
    transformationRule: 'MONTHLY_TO_ANNUAL_X12',
    derivationVersion: VERSION,
  }, h.trustedContext), /unknown raw claim revision/);
  assert.throws(() => convertPeriod({ sourceReference: first, derivationVersion: VERSION }, h.trustedContext), /closed claim and evidence reference/);
});

test('signing date must resolve from the same governed deal snapshot', () => {
  const h = harness({ signingDealSnapshotId: digest('different-deal') });
  assert.throws(() => comparable(h), /different deal snapshots/);
});

test('an unapproved or self-named FX provider cannot make a comparable value', () => {
  const h = harness();
  const fake = receipt({ providerId: 'MADE_UP_PROVIDER', rate: '999999' });
  assert.throws(() => comparable(h, { fxRateReceipt: fake }), /unapproved FX provider/);
});

test('the injected currency policy rejects syntactically valid private codes', () => {
  const h = harness({ currency: 'ZZZ' });
  assert.throws(() => deriveMoneyComparison({
    sourceReference: h.sourceReference,
    targetCurrency: 'USD',
    fxRateReceipt: receipt({ baseCurrency: 'ZZZ' }),
    signingDateReference: h.signingDateReference,
    derivationVersion: VERSION,
  }, h.trustedContext), /currency ZZZ/);
});

test('FX receipts are directional, evidence-bound inputs and never self-authoritative', () => {
  const h = harness();
  const value = comparable(h);
  assert.equal(value.output.canonical_decimal, '120');
  assert.equal(value.transformation.fx.fx_rate_receipt.trust_status, 'UNVERIFIED_EXTERNAL_INPUT');
  assert.equal(value.transformation.fx.fx_rate_verification.verification_status, 'VERIFIED_BY_INJECTED_POLICY');

  const inverse = comparable(h, { fxRateReceipt: receipt({ baseCurrency: 'USD', quoteCurrency: 'EUR' }) });
  assert.equal(inverse.exclusion_reason, 'FX_PAIR_DIRECTION_MISMATCH');
  assert.throws(() => buildFxRateReceipt({
    providerId: 'TRUSTED_TEST_FEED', providerVersion: 'FIXTURE/V1',
    providerResponseDigest: digest('response'), baseCurrency: 'EUR', quoteCurrency: 'EUR',
    rate: '1', rateDate: '2026-08-03',
  }), /must differ/);
  assert.throws(() => receipt({ operator: 'DIVIDE' }), /MULTIPLY/);
});

test('calendar dates must exist, including Gregorian leap-day rules', () => {
  assert.throws(() => receipt({ rateDate: '2026-02-29' }), /real Gregorian/);
  assert.throws(() => receipt({ rateDate: '2026-04-31' }), /real Gregorian/);
  assert.doesNotThrow(() => receipt({ rateDate: '2024-02-29' }));
});

test('display precision can round to zero but exact comparison value remains positive', () => {
  const h = harness({ label: 'small', literal: 'USD 0.001 per month', value: '0.001', currency: 'USD', displayDecimalPlaces: 0 });
  const value = convertPeriod({
    sourceReference: h.sourceReference,
    targetPeriod: 'ANNUAL',
    transformationRule: 'MONTHLY_TO_ANNUAL_X12',
    derivationVersion: VERSION,
  }, h.trustedContext);
  assert.equal(value.output.exact_numerator, '3');
  assert.equal(value.output.exact_denominator, '250');
  assert.equal(value.output.canonical_decimal, '0.012');
  assert.equal(value.display.value, '0');
  assert.equal(value.display.status, 'DISPLAY_ONLY_NOT_COMPARISON_INPUT');
});

test('all supplied operands affect excluded-record identity and malformed operands throw', () => {
  const h = harness({ currency: 'USD' });
  const first = deriveMoneyComparison({
    sourceReference: h.sourceReference,
    targetCurrency: 'USD',
    fxRateReceipt: receipt({ rate: '1.1' }),
    signingDateReference: h.signingDateReference,
    derivationVersion: VERSION,
  }, h.trustedContext);
  const second = deriveMoneyComparison({
    sourceReference: h.sourceReference,
    targetCurrency: 'USD',
    fxRateReceipt: receipt({ rate: '1.2' }),
    signingDateReference: h.signingDateReference,
    derivationVersion: VERSION,
  }, h.trustedContext);
  assert.equal(first.exclusion_reason, 'FX_OPERANDS_WITHOUT_CURRENCY_CHANGE');
  assert.equal(second.exclusion_reason, 'FX_OPERANDS_WITHOUT_CURRENCY_CHANGE');
  assert.notEqual(first.derived_comparison_id, second.derived_comparison_id);
  assert.throws(() => deriveMoneyComparison({
    sourceReference: h.sourceReference,
    targetCurrency: 'USD',
    fxRateReceipt: { malformed: true },
    derivationVersion: VERSION,
  }, h.trustedContext), /invalid unverified FX rate receipt/);
});

test('semantic reconstruction rejects rehashed false arithmetic and altered trust receipts', () => {
  const h = harness();
  const value = comparable(h);
  const forgeries = [
    forgeRecord(value, (record) => { record.output.exact_numerator = '999999'; }),
    forgeRecord(value, (record) => { record.output.canonical_decimal = '999999'; }),
    forgeRecord(value, (record) => { record.comparison_kind = 'PERIOD_NORMALISATION'; }),
    forgeRecord(value, (record) => { record.transformation.fx.applied_rule = 'ATTACKER_RULE'; }),
    forgeRecord(value, (record) => { record.source_resolution.source.value = '999'; }),
    forgeRecord(value, (record) => { record.authority = 'GOVERNED_AGREEMENT_CLAIM'; }),
    forgeRecord(value, (record) => { record.extra = true; }),
  ];
  for (const forged of forgeries) {
    assert.throws(() => validateDerivedComparison(forged, h.trustedContext), /(semantic reconstruction|invalid derived comparison envelope)/);
  }
});

test('canonical numeric inputs reject aliases and resource-exhaustion payloads', () => {
  for (const value of ['01', '1.0', '1.00', '+1', '1e0', '-1', '1'.repeat(129)]) {
    assert.throws(() => harness({ value }), /canonical decimal/);
  }
  assert.throws(() => receipt({ rate: '1.20' }), /canonical decimal/);
});

test('Unicode case-folding cannot create ASCII currency or governed-key aliases', () => {
  assert.throws(() => receipt({ baseCurrency: '\u00dfD' }), /ASCII letters/);
  assert.throws(() => receipt({ operator: 'mult\u0131ply' }), /ASCII governed-key/);
  assert.throws(() => harness({ basis: '\u017fOURCE' }), /ASCII governed-key/);
});

test('the exclusion order is stable when several operands are unsafe', () => {
  const same = harness({ currency: 'USD' });
  const identical = deriveMoneyComparison({
    sourceReference: same.sourceReference,
    targetCurrency: 'USD',
    transformationRule: 'MONTHLY_TO_ANNUAL_X12',
    derivationVersion: VERSION,
  }, same.trustedContext);
  assert.equal(identical.exclusion_reason, 'PERIOD_RULE_WITHOUT_PERIOD_CHANGE');

  const h = harness();
  const missing = deriveMoneyComparison({
    sourceReference: h.sourceReference,
    targetCurrency: 'USD',
    derivationVersion: VERSION,
  }, h.trustedContext);
  assert.equal(missing.exclusion_reason, 'MISSING_FX_RATE_RECEIPT');

  const pairBeforeRate = comparable(h, {
    fxRateReceipt: receipt({ baseCurrency: 'GBP', rate: '0' }),
    signingDateReference: null,
  });
  assert.equal(pairBeforeRate.exclusion_reason, 'FX_PAIR_DIRECTION_MISMATCH');
});

test('unsupported period bridges remain excluded even when caller supplies a plausible rule', () => {
  const h = harness();
  const value = convertPeriod({
    sourceReference: h.sourceReference,
    targetPeriod: 'QUARTERLY',
    transformationRule: 'MONTHLY_TO_QUARTERLY_DIV3',
    derivationVersion: VERSION,
  }, h.trustedContext);
  assert.equal(value.exclusion_reason, 'UNSUPPORTED_PERIOD_TRANSFORMATION');
  assert.equal(value.output, null);
});

test('every period exclusion branch is explicit and reconstructable', () => {
  const noSourcePeriod = harness({ label: 'no-source-period', period: null, currency: 'USD' });
  const missingSource = convertPeriod({
    sourceReference: noSourcePeriod.sourceReference,
    targetPeriod: 'ANNUAL',
    transformationRule: 'MONTHLY_TO_ANNUAL_X12',
    derivationVersion: VERSION,
  }, noSourcePeriod.trustedContext);
  assert.equal(missingSource.exclusion_reason, 'MISSING_SOURCE_PERIOD');
  assert.doesNotThrow(() => validateDerivedComparison(missingSource, noSourcePeriod.trustedContext));

  const monthly = harness({ label: 'missing-rule', currency: 'USD' });
  const missingRule = convertPeriod({
    sourceReference: monthly.sourceReference,
    targetPeriod: 'ANNUAL',
    derivationVersion: VERSION,
  }, monthly.trustedContext);
  assert.equal(missingRule.exclusion_reason, 'MISSING_PERIOD_TRANSFORMATION_RULE');
  assert.doesNotThrow(() => validateDerivedComparison(missingRule, monthly.trustedContext));

  const ruleWithoutChange = convertPeriod({
    sourceReference: monthly.sourceReference,
    targetPeriod: 'MONTHLY',
    transformationRule: 'MONTHLY_TO_ANNUAL_X12',
    derivationVersion: VERSION,
  }, monthly.trustedContext);
  assert.equal(ruleWithoutChange.exclusion_reason, 'PERIOD_RULE_WITHOUT_PERIOD_CHANGE');
  assert.doesNotThrow(() => validateDerivedComparison(ruleWithoutChange, monthly.trustedContext));
});

test('exact legal literals reject ill-formed UTF-16 before byte hashing', () => {
  assert.throws(() => harness({
    label: 'lone-surrogate',
    literal: `EUR ${String.fromCharCode(0xD800)} 1`,
  }), /literal byte limit/);
  assert.doesNotThrow(() => harness({ label: 'valid-surrogate-pair', literal: 'EUR \u{1F4B6} 1' }));
});

test('a getter-backed trust function is captured exactly once', () => {
  const h = harness();
  let reads = 0;
  const context = { ...h.trustedContext };
  Object.defineProperty(context, 'resolveMoneySource', {
    configurable: true,
    enumerable: true,
    get() {
      reads += 1;
      if (reads === 1) return h.trustedContext.resolveMoneySource;
      return () => { throw new TypeError('swapped trust function executed'); };
    },
  });
  assert.doesNotThrow(() => deriveMoneyComparison({
    sourceReference: h.sourceReference,
    derivationVersion: VERSION,
  }, context));
  assert.equal(reads, 1);
});

test('display precision boundaries and carry stripping are deterministic', () => {
  assert.throws(() => harness({ displayDecimalPlaces: -1 }), /between 0 and 12/);
  assert.throws(() => harness({ displayDecimalPlaces: 13 }), /between 0 and 12/);

  const h = harness({ label: 'carry', literal: 'EUR 9.995', value: '9.995', period: null, displayDecimalPlaces: 2 });
  const value = comparable(h, { fxRateReceipt: receipt({ rate: '1' }) });
  assert.equal(value.display.value, '10');
  assert.equal(value.output.canonical_decimal, '9.995');

  const highPrecision = harness({ label: 'precision-12', displayDecimalPlaces: 12 });
  assert.doesNotThrow(() => comparable(highPrecision));
});

test('construction does not mutate caller-owned input objects', () => {
  const h = harness();
  const input = {
    sourceReference: structuredClone(h.sourceReference),
    targetCurrency: 'USD',
    fxRateReceipt: structuredClone(receipt()),
    signingDateReference: structuredClone(h.signingDateReference),
    derivationVersion: VERSION,
  };
  const before = canonicalJson(input);
  comparable(h, input);
  assert.equal(canonicalJson(input), before);
});

test('period-only comparisons exclude every supplied FX operand as contradictory', () => {
  const h = harness();
  const cases = [
    { fxRateReceipt: receipt({ baseCurrency: 'GBP', rate: '0', rateDate: '2025-01-01' }) },
    { signingDateReference: h.signingDateReference },
    {
      fxRateReceipt: receipt({ baseCurrency: 'GBP', rate: '0', rateDate: '2025-01-01' }),
      signingDateReference: h.signingDateReference,
    },
  ];
  for (const operands of cases) {
    const value = deriveMoneyComparison({
      sourceReference: h.sourceReference,
      targetPeriod: 'ANNUAL',
      transformationRule: 'MONTHLY_TO_ANNUAL_X12',
      derivationVersion: VERSION,
      ...operands,
    }, h.trustedContext);
    assert.equal(value.exclusion_reason, 'FX_OPERANDS_WITHOUT_CURRENCY_CHANGE');
    assert.equal(value.output, null);
  }
});

test('the derivation policy pins source, signing and FX verification policies', () => {
  const h = harness();
  const wrongFxPolicyContext = {
    ...h.trustedContext,
    verifyFxRateReceipt(input) {
      return buildFxRateVerification({
        verificationPolicyId: digest('rotated-fx-policy'),
        fxRateReceiptId: input.fx_rate_receipt_id,
        verificationEvidenceDigest: digest('rotated-verification'),
      });
    },
  };
  assert.throws(() => deriveMoneyComparison({
    sourceReference: h.sourceReference,
    targetCurrency: 'USD',
    fxRateReceipt: receipt(),
    signingDateReference: h.signingDateReference,
    derivationVersion: VERSION,
  }, wrongFxPolicyContext), /does not match the derivation policy/);

  const wrongSourcePolicyContext = {
    ...h.trustedContext,
    resolveMoneySource() {
      return buildMoneySourceResolution({
        resolutionPolicyId: digest('rotated-source-policy'),
        claimRevisionId: h.sourceReference.claim_revision_id,
        evidenceExcerptId: h.sourceReference.evidence_excerpt_id,
        dealSnapshotId: h.sourceResolution.deal_snapshot_id,
        literal: h.sourceResolution.source.literal,
        value: h.sourceResolution.source.value,
        currency: h.sourceResolution.source.currency,
        basis: h.sourceResolution.source.basis,
        period: h.sourceResolution.source.period,
      });
    },
  };
  assert.throws(() => comparable({ ...h, trustedContext: wrongSourcePolicyContext }), /does not match the derivation policy/);
});

test('all public data boundaries reject prototypes, accessors, proxies, symbols and unknown fields', () => {
  const h = harness();
  const valid = {
    sourceReference: h.sourceReference,
    targetCurrency: 'USD',
    fxRateReceipt: receipt(),
    signingDateReference: h.signingDateReference,
    derivationVersion: VERSION,
  };
  assert.throws(() => deriveMoneyComparison(Object.assign(Object.create({ forbidden: true }), valid), h.trustedContext), /plain data tree/);
  assert.throws(() => deriveMoneyComparison(Object.create(valid), h.trustedContext), /plain data tree/);
  assert.throws(() => deriveMoneyComparison(new Proxy(valid, {}), h.trustedContext), /plain data tree/);
  const withSymbol = { ...valid, [Symbol('forbidden')]: true };
  assert.throws(() => deriveMoneyComparison(withSymbol, h.trustedContext), /symbol fields/);
  const withAccessor = { ...valid };
  Object.defineProperty(withAccessor, 'targetCurrency', { enumerable: true, get: () => 'USD' });
  assert.throws(() => deriveMoneyComparison(withAccessor, h.trustedContext), /data properties only/);

  assert.throws(() => buildDerivationPolicy({
    derivationVersion: VERSION,
    policyAuthorityId: digest('policy-authority'),
    currencyPolicyId: digest('currency-policy'),
    moneySourceResolutionPolicyId: digest('source-policy'),
    signingDateResolutionPolicyId: digest('signing-policy'),
    fxVerificationPolicyId: digest('fx-policy'),
    displayDecimalPlaces: 2,
    permittedPeriodRules: RULES,
    forbidden: true,
  }), /closed contract/);
  assert.throws(() => buildMoneySourceResolution({
    resolutionPolicyId: digest('source-policy'),
    claimRevisionId: h.sourceReference.claim_revision_id,
    evidenceExcerptId: h.sourceReference.evidence_excerpt_id,
    dealSnapshotId: h.sourceResolution.deal_snapshot_id,
    literal: 'EUR 1', value: '1', currency: 'EUR', basis: 'AGGREGATE',
    forbidden: true,
  }), /closed contract/);
  assert.throws(() => buildFxRateReceipt({
    providerId: 'TRUSTED_TEST_FEED', providerVersion: 'FIXTURE/V1',
    providerResponseDigest: digest('response'), baseCurrency: 'EUR', quoteCurrency: 'USD',
    rate: '1', rateDate: '2026-08-03', forbidden: true,
  }), /closed contract/);
  assert.throws(() => buildFxRateVerification({
    verificationPolicyId: digest('fx-policy'), fxRateReceiptId: receipt().fx_rate_receipt_id,
    verificationEvidenceDigest: digest('verification'), forbidden: true,
  }), /closed contract/);
  assert.throws(() => buildSigningDateResolution({
    resolutionPolicyId: digest('signing-policy'),
    claimRevisionId: h.signingDateReference.claim_revision_id,
    evidenceExcerptId: h.signingDateReference.evidence_excerpt_id,
    evidenceTextSha256: digest('signing-text'), dealSnapshotId: h.sourceResolution.deal_snapshot_id,
    date: '2026-08-03', forbidden: true,
  }), /closed contract/);
});

test('a true no-op has an explicit non-transformation kind', () => {
  const h = harness();
  const value = deriveMoneyComparison({
    sourceReference: h.sourceReference,
    derivationVersion: VERSION,
  }, h.trustedContext);
  assert.equal(value.comparison_kind, 'NO_OP');
  assert.equal(value.exclusion_reason, 'SOURCE_TARGET_DIMENSIONS_IDENTICAL');
  assert.equal(value.output, null);
  assert.doesNotThrow(() => validateDerivedComparison(value, h.trustedContext));
});

test('nested references, trust records and final envelopes admit only identity-bound plain data', () => {
  const h = harness();
  const baseInput = {
    sourceReference: h.sourceReference,
    targetCurrency: 'USD',
    fxRateReceipt: receipt(),
    signingDateReference: h.signingDateReference,
    derivationVersion: VERSION,
  };
  const symbolReference = { ...h.sourceReference, [Symbol('hidden')]: 'ATTACKER' };
  assert.throws(() => deriveMoneyComparison({ ...baseInput, sourceReference: symbolReference }, h.trustedContext), /symbol fields/);
  assert.throws(() => deriveMoneyComparison({
    ...baseInput,
    sourceReference: new Proxy(h.sourceReference, {}),
  }, h.trustedContext), /plain data tree/);
  assert.throws(() => deriveMoneyComparison({
    ...baseInput,
    sourceReference: Object.assign(Object.create({ hidden: true }), h.sourceReference),
  }, h.trustedContext), /plain data tree/);
  const accessorReference = {};
  Object.defineProperties(accessorReference, {
    claim_revision_id: { enumerable: true, get: () => h.sourceReference.claim_revision_id },
    evidence_excerpt_id: { enumerable: true, get: () => h.sourceReference.evidence_excerpt_id },
  });
  assert.throws(() => deriveMoneyComparison({ ...baseInput, sourceReference: accessorReference }, h.trustedContext), /data properties only/);
  assert.throws(() => deriveMoneyComparison({
    ...baseInput,
    fxRateReceipt: new Proxy(receipt(), {}),
  }, h.trustedContext), /plain data tree/);

  const maliciousResolverContext = {
    ...h.trustedContext,
    resolveMoneySource() {
      const resolution = structuredClone(h.sourceResolution);
      resolution.source[Symbol('hidden')] = 'ATTACKER';
      return resolution;
    },
  };
  assert.throws(() => deriveMoneyComparison(baseInput, maliciousResolverContext), /invalid trusted money-source resolution/);

  const record = comparable(h);
  const withSymbol = structuredClone(record);
  withSymbol[Symbol('hidden')] = 'ATTACKER';
  assert.throws(() => validateDerivedComparison(withSymbol, h.trustedContext), /invalid derived comparison envelope/);
  const withHidden = structuredClone(record);
  Object.defineProperty(withHidden, 'hidden', { enumerable: false, value: 'ATTACKER' });
  assert.throws(() => validateDerivedComparison(withHidden, h.trustedContext), /invalid derived comparison envelope/);
  assert.throws(() => validateDerivedComparison(new Proxy(record, {}), h.trustedContext), /invalid derived comparison envelope/);
});

test('base-prototype pollution cannot supply an allowed input field', () => {
  const h = harness();
  Object.defineProperty(Object.prototype, 'targetCurrency', {
    configurable: true,
    enumerable: false,
    value: 'USD',
  });
  try {
    const value = deriveMoneyComparison({
      sourceReference: h.sourceReference,
      fxRateReceipt: receipt(),
      signingDateReference: h.signingDateReference,
      derivationVersion: VERSION,
    }, h.trustedContext);
    assert.equal(value.target.currency, 'EUR');
    assert.equal(value.exclusion_reason, 'FX_OPERANDS_WITHOUT_CURRENCY_CHANGE');
  } finally {
    delete Object.prototype.targetCurrency;
  }
});

test('negative zero cannot collide with the canonical zero policy identity', () => {
  assert.throws(() => harness({ displayDecimalPlaces: -0 }), /canonical finite numbers/);
  const h = harness({ displayDecimalPlaces: 0 });
  assert.equal(Object.is(h.policy.display_decimal_places, -0), false);
});

test('cyclic and excessive-depth inputs fail with bounded contract errors', () => {
  const h = harness();
  const cyclicReference = { ...h.sourceReference };
  cyclicReference.cycle = cyclicReference;
  assert.throws(() => deriveMoneyComparison({
    sourceReference: cyclicReference,
    derivationVersion: VERSION,
  }, h.trustedContext), /contains a cycle/);

  const deepReference = { ...h.sourceReference };
  let cursor = deepReference;
  for (let index = 0; index < 70; index += 1) {
    cursor.next = {};
    cursor = cursor.next;
  }
  assert.throws(() => deriveMoneyComparison({
    sourceReference: deepReference,
    derivationVersion: VERSION,
  }, h.trustedContext), /bounded plain-data depth/);
});

test('flat width, arrays and text are bounded before allocation or hashing', () => {
  const h = harness();
  const wide = {};
  for (let index = 0; index < 4097; index += 1) wide[`field_${index}`] = true;
  assert.throws(() => deriveMoneyComparison(wide, h.trustedContext), /object width/);

  assert.throws(() => buildDerivationPolicy({
    derivationVersion: VERSION,
    policyAuthorityId: digest('policy-authority'),
    currencyPolicyId: digest('currency-policy'),
    moneySourceResolutionPolicyId: digest('source-policy'),
    signingDateResolutionPolicyId: digest('signing-policy'),
    fxVerificationPolicyId: digest('fx-policy'),
    displayDecimalPlaces: 2,
    permittedPeriodRules: Array.from({ length: 4097 }, (_, index) => `RULE_${index}`),
  }), /array length/);

  const providerBoundary = buildFxRateReceipt({
    providerId: 'p'.repeat(256), providerVersion: 'V1', providerResponseDigest: digest('response'),
    baseCurrency: 'EUR', quoteCurrency: 'USD', rate: '1', rateDate: '2026-08-03',
  });
  assert.equal(providerBoundary.provider_id.length, 256);
  assert.throws(() => buildFxRateReceipt({
    providerId: 'p'.repeat(257), providerVersion: 'V1', providerResponseDigest: digest('response'),
    baseCurrency: 'EUR', quoteCurrency: 'USD', rate: '1', rateDate: '2026-08-03',
  }), /canonical string/);

  const literalAtLimit = 'x'.repeat(1024 * 1024);
  assert.doesNotThrow(() => buildMoneySourceResolution({
    resolutionPolicyId: digest('source-policy'), claimRevisionId: digest('large-claim'),
    evidenceExcerptId: digest('large-excerpt'), dealSnapshotId: digest('large-deal'),
    literal: literalAtLimit, value: '1', currency: 'USD', basis: 'AGGREGATE',
  }));
  const large = harness({
    label: 'literal-at-limit', literal: literalAtLimit, value: '1', currency: 'USD',
    basis: 'AGGREGATE', period: null,
  });
  const largeRecord = deriveMoneyComparison({
    sourceReference: large.sourceReference,
    derivationVersion: VERSION,
  }, large.trustedContext);
  assert.doesNotThrow(() => validateDerivedComparison(largeRecord, large.trustedContext));
  assert.throws(() => buildMoneySourceResolution({
    resolutionPolicyId: digest('source-policy'), claimRevisionId: digest('too-large-claim'),
    evidenceExcerptId: digest('too-large-excerpt'), dealSnapshotId: digest('too-large-deal'),
    literal: `${literalAtLimit}x`, value: '1', currency: 'USD', basis: 'AGGREGATE',
  }), /literal byte limit/);
});

test('a derivation policy can permit only executable period rules', () => {
  assert.throws(() => buildDerivationPolicy({
    derivationVersion: VERSION,
    policyAuthorityId: digest('policy-authority'),
    currencyPolicyId: digest('currency-policy'),
    moneySourceResolutionPolicyId: digest('source-policy'),
    signingDateResolutionPolicyId: digest('signing-policy'),
    fxVerificationPolicyId: digest('fx-policy'),
    displayDecimalPlaces: 2,
    permittedPeriodRules: ['RULE_ENGINE_CANNOT_EXECUTE'],
  }), /subset of executable rules/);
});

test('FX and period normalisation compose directly from one raw claim', () => {
  const h = harness();
  const value = deriveMoneyComparison({
    sourceReference: h.sourceReference,
    targetCurrency: 'USD',
    targetPeriod: 'ANNUAL',
    transformationRule: 'MONTHLY_TO_ANNUAL_X12',
    fxRateReceipt: receipt(),
    signingDateReference: h.signingDateReference,
    derivationVersion: VERSION,
  }, h.trustedContext);
  assert.equal(value.output.canonical_decimal, '1440');
  assert.equal(value.comparison_kind, 'FX_AND_PERIOD_NORMALISATION');
  assert.doesNotThrow(() => validateDerivedComparison(value, h.trustedContext));
});
