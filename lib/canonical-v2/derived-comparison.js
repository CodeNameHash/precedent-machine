'use strict';

const { types: utilTypes } = require('node:util');
const { canonicalJson, contentId, sha256Hex } = require('./canonical-bytes');

const SCHEMA_VERSION = 'DERIVED_COMPARISON/V3';
const SOURCE_RESOLUTION_SCHEMA = 'DERIVED_MONEY_SOURCE_RESOLUTION/V1';
const SIGNING_DATE_RESOLUTION_SCHEMA = 'DERIVED_SIGNING_DATE_RESOLUTION/V1';
const FX_RECEIPT_SCHEMA = 'UNVERIFIED_FX_RATE_RECEIPT/V1';
const FX_VERIFICATION_SCHEMA = 'TRUSTED_FX_RATE_VERIFICATION/V1';
const DERIVATION_POLICY_SCHEMA = 'DERIVED_COMPARISON_POLICY/V1';
const RECORD_KIND = 'DERIVED_COMPARISON_ONLY';
const AUTHORITY = 'NONE_NOT_GOVERNED_AGREEMENT_CLAIM';
const AGREEMENT_TEXT_STATUS = 'NOT_AGREEMENT_TEXT';
const ROUNDING_MODE = 'HALF_UP';
const DECIMAL_RE = /^(0|[1-9]\d*)(\.\d*[1-9])?$/;
const DIGEST_RE = /^[a-f0-9]{64}$/;
const CURRENCY_RE = /^[A-Z]{3}$/;
const GOVERNED_KEY_RE = /^[A-Z0-9][A-Z0-9_-]*$/;
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MAX_DATA_TREE_ENTRIES = 4096;
const MAX_DATA_TREE_UTF8_BYTES = 2 * 1024 * 1024;
const MAX_CANONICAL_TEXT_BYTES = 256;
const MAX_GOVERNED_KEY_BYTES = 128;
const MAX_EXACT_LITERAL_BYTES = 1024 * 1024;
const PERIOD_RULES = Object.freeze({
  'MONTHLY:ANNUAL': Object.freeze({ rule: 'MONTHLY_TO_ANNUAL_X12', numerator: 12n, denominator: 1n }),
  'ANNUAL:MONTHLY': Object.freeze({ rule: 'ANNUAL_TO_MONTHLY_DIV12', numerator: 1n, denominator: 12n }),
  'QUARTERLY:ANNUAL': Object.freeze({ rule: 'QUARTERLY_TO_ANNUAL_X4', numerator: 4n, denominator: 1n }),
  'ANNUAL:QUARTERLY': Object.freeze({ rule: 'ANNUAL_TO_QUARTERLY_DIV4', numerator: 1n, denominator: 4n }),
});
const EXECUTABLE_PERIOD_RULES = new Set(Object.values(PERIOD_RULES).map((entry) => entry.rule));

function deepFreeze(value) {
  if (!value || typeof value !== 'object') return value;
  if (!Object.isFrozen(value)) {
    for (const entry of Object.values(value)) deepFreeze(entry);
    Object.freeze(value);
  }
  return value;
}

function assertPlainDataTree(value, label, state = null, depth = 0) {
  const traversal = state || {
    ancestors: new WeakSet(),
    entries: 0,
    utf8_bytes: 0,
  };
  traversal.entries += 1;
  if (traversal.entries > MAX_DATA_TREE_ENTRIES || depth > 64) {
    throw new TypeError(`${label} exceeds the bounded plain-data depth or size`);
  }
  if (typeof value === 'string') {
    traversal.utf8_bytes += Buffer.byteLength(value, 'utf8');
    if (traversal.utf8_bytes > MAX_DATA_TREE_UTF8_BYTES) {
      throw new TypeError(`${label} exceeds the bounded plain-data byte size`);
    }
    return;
  }
  if (value == null || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || Object.is(value, -0)) {
      throw new TypeError(`${label} must contain canonical finite numbers`);
    }
    return;
  }
  if (typeof value !== 'object' || utilTypes.isProxy(value)) {
    throw new TypeError(`${label} must be a plain data tree`);
  }
  if (traversal.ancestors.has(value)) throw new TypeError(`${label} contains a cycle`);
  traversal.ancestors.add(value);
  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype) {
      throw new TypeError(`${label} must be a plain data tree`);
    }
    if (value.length > MAX_DATA_TREE_ENTRIES) {
      throw new TypeError(`${label} exceeds the bounded plain-data array length`);
    }
    const keys = Reflect.ownKeys(value);
    const expected = [...Array(value.length).keys()].map(String);
    if (keys.some((key) => typeof key === 'symbol')
      || canonicalJson(Object.keys(value)) !== canonicalJson(expected)
      || keys.some((key) => key !== 'length' && !expected.includes(key))) {
      throw new TypeError(`${label} must be a dense plain data array`);
    }
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !Object.hasOwn(descriptor, 'value') || !descriptor.enumerable) {
        throw new TypeError(`${label} must contain enumerable data properties only`);
      }
      assertPlainDataTree(descriptor.value, `${label}[${index}]`, traversal, depth + 1);
    }
    traversal.ancestors.delete(value);
    return;
  }
  if (Object.getPrototypeOf(value) !== Object.prototype) {
    throw new TypeError(`${label} must be a plain data tree`);
  }
  const keys = Reflect.ownKeys(value);
  if (keys.length > MAX_DATA_TREE_ENTRIES) {
    throw new TypeError(`${label} exceeds the bounded plain-data object width`);
  }
  if (keys.some((key) => typeof key !== 'string')) {
    throw new TypeError(`${label} must not contain symbol fields`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  for (const key of keys) {
    traversal.utf8_bytes += Buffer.byteLength(key, 'utf8');
    if (traversal.utf8_bytes > MAX_DATA_TREE_UTF8_BYTES) {
      throw new TypeError(`${label} exceeds the bounded plain-data byte size`);
    }
    const descriptor = descriptors[key];
    if (!Object.hasOwn(descriptor, 'value') || !descriptor.enumerable) {
      throw new TypeError(`${label} must contain enumerable data properties only`);
    }
    assertPlainDataTree(descriptor.value, `${label}.${key}`, traversal, depth + 1);
  }
  traversal.ancestors.delete(value);
}

function exactKeys(value, keys) {
  try {
    assertPlainDataTree(value, 'closed record');
  } catch {
    return false;
  }
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}

function assertClosedInput(value, allowedKeys, label) {
  assertPlainDataTree(value, label);
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} contains fields outside the closed contract`);
  }
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== 'string' || !allowedKeys.includes(key))) {
    throw new TypeError(`${label} contains fields outside the closed contract`);
  }
}

function ownValue(value, key, fallback = undefined) {
  return Object.hasOwn(value, key) ? value[key] : fallback;
}

function requireCanonicalText(value, label, maximumBytes = MAX_CANONICAL_TEXT_BYTES) {
  if (typeof value !== 'string' || !value || value.trim() !== value
    || Buffer.byteLength(value, 'utf8') > maximumBytes) {
    throw new TypeError(`${label} must be a non-empty canonical string`);
  }
  return value;
}

function isWellFormedUtf16(value) {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xD800 && unit <= 0xDBFF) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xDC00 && next <= 0xDFFF)) return false;
      index += 1;
    } else if (unit >= 0xDC00 && unit <= 0xDFFF) return false;
  }
  return true;
}

function requireExactLiteral(value, label) {
  if (typeof value !== 'string' || !value.trim()
    || !isWellFormedUtf16(value)
    || Buffer.byteLength(value, 'utf8') > MAX_EXACT_LITERAL_BYTES) {
    throw new TypeError(`${label} is required and must fit the reviewed literal byte limit`);
  }
  return value;
}

function requireDecimal(value, label) {
  if (typeof value !== 'string' || value.length > 128 || !DECIMAL_RE.test(value)) {
    throw new TypeError(`${label} must be a bounded non-negative canonical decimal string`);
  }
  return value;
}

function requireDigest(value, label) {
  if (typeof value !== 'string' || !DIGEST_RE.test(value)) {
    throw new TypeError(`${label} must be a lower-case SHA-256 digest`);
  }
  return value;
}

function requireCurrency(value, label) {
  const supplied = requireCanonicalText(value, label);
  if (!/^[A-Za-z]{3}$/.test(supplied)) throw new TypeError(`${label} must use three ASCII letters`);
  const currency = supplied.toUpperCase();
  if (!CURRENCY_RE.test(currency)) throw new TypeError(`${label} must be a three-letter currency code`);
  return currency;
}

function requireGovernedKey(value, label) {
  const supplied = requireCanonicalText(value, label, MAX_GOVERNED_KEY_BYTES);
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(supplied)) {
    throw new TypeError(`${label} must use ASCII governed-key characters`);
  }
  const key = supplied.toUpperCase();
  if (!GOVERNED_KEY_RE.test(key)) throw new TypeError(`${label} must be a governed key`);
  return key;
}

function requirePrecision(value, label) {
  if (!Number.isInteger(value) || Object.is(value, -0) || value < 0 || value > 12) {
    throw new TypeError(`${label} must be an integer between 0 and 12`);
  }
  return value;
}

function normaliseDate(value, label) {
  const text = requireCanonicalText(value, label);
  const match = ISO_DATE_RE.exec(text);
  if (!match) throw new TypeError(`${label} must be an ISO date`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1000 || month < 1 || month > 12 || day < 1 || day > days[month - 1]) {
    throw new TypeError(`${label} must be a real Gregorian calendar date`);
  }
  return text;
}

function requireReference(reference, label) {
  const keys = ['claim_revision_id', 'evidence_excerpt_id'];
  if (!exactKeys(reference, keys)) throw new TypeError(`${label} must be a closed claim and evidence reference`);
  return deepFreeze({
    claim_revision_id: requireDigest(reference.claim_revision_id, `${label}.claim_revision_id`),
    evidence_excerpt_id: requireDigest(reference.evidence_excerpt_id, `${label}.evidence_excerpt_id`),
  });
}

function decimalFraction(value) {
  const [integer, fractional = ''] = value.split('.');
  return {
    numerator: BigInt(`${integer}${fractional}`),
    denominator: 10n ** BigInt(fractional.length),
  };
}

function gcd(a, b) {
  let left = a;
  let right = b;
  while (right !== 0n) [left, right] = [right, left % right];
  return left;
}

function reducedFraction(numerator, denominator) {
  if (numerator < 0n || denominator <= 0n) throw new TypeError('fraction must be non-negative');
  const divisor = gcd(numerator, denominator);
  return { numerator: numerator / divisor, denominator: denominator / divisor };
}

function exactTerminatingDecimal(numerator, denominator) {
  const reduced = reducedFraction(numerator, denominator);
  let remainder = reduced.denominator;
  let twos = 0;
  let fives = 0;
  while (remainder % 2n === 0n) { remainder /= 2n; twos += 1; }
  while (remainder % 5n === 0n) { remainder /= 5n; fives += 1; }
  if (remainder !== 1n) return null;
  const places = Math.max(twos, fives);
  const scale = 10n ** BigInt(places);
  const scaled = reduced.numerator * scale / reduced.denominator;
  const integer = scaled / scale;
  const fractional = String(scaled % scale).padStart(places, '0').replace(/0+$/, '');
  return fractional ? `${integer}.${fractional}` : String(integer);
}

function roundedDecimal(numerator, denominator, decimalPlaces) {
  const scale = 10n ** BigInt(decimalPlaces);
  const scaledNumerator = numerator * scale;
  const quotient = scaledNumerator / denominator;
  const remainder = scaledNumerator % denominator;
  const rounded = quotient + (remainder * 2n >= denominator ? 1n : 0n);
  const integer = rounded / scale;
  const fractional = String(rounded % scale).padStart(decimalPlaces, '0').replace(/0+$/, '');
  return {
    value: fractional ? `${integer}.${fractional}` : String(integer),
    rounding_applied: remainder !== 0n,
  };
}

function withIdentity(schema, idField, body) {
  return deepFreeze({ ...body, [idField]: contentId(schema, body) });
}

function buildMoneySourceResolution(input = {}) {
  assertClosedInput(input, [
    'basis', 'claimRevisionId', 'currency', 'dealSnapshotId', 'evidenceExcerptId',
    'literal', 'period', 'resolutionPolicyId', 'value',
  ], 'money source resolution input');
  const resolutionPolicyId = ownValue(input, 'resolutionPolicyId');
  const claimRevisionId = ownValue(input, 'claimRevisionId');
  const evidenceExcerptId = ownValue(input, 'evidenceExcerptId');
  const dealSnapshotId = ownValue(input, 'dealSnapshotId');
  const literal = ownValue(input, 'literal');
  const value = ownValue(input, 'value');
  const currency = ownValue(input, 'currency');
  const basis = ownValue(input, 'basis');
  const period = ownValue(input, 'period', null);
  const body = {
    schema_version: SOURCE_RESOLUTION_SCHEMA,
    resolution_policy_id: requireDigest(resolutionPolicyId, 'resolutionPolicyId'),
    source_record_kind: 'GOVERNED_RAW_CLAIM',
    claim_revision_id: requireDigest(claimRevisionId, 'claimRevisionId'),
    evidence_excerpt_id: requireDigest(evidenceExcerptId, 'evidenceExcerptId'),
    deal_snapshot_id: requireDigest(dealSnapshotId, 'dealSnapshotId'),
    source: {
      literal: requireExactLiteral(literal, 'literal'),
      literal_sha256: sha256Hex(literal),
      value: requireDecimal(value, 'value'),
      unit: 'MONEY',
      currency: requireCurrency(currency, 'currency'),
      basis: requireGovernedKey(basis, 'basis'),
      period: period == null ? null : requireGovernedKey(period, 'period'),
    },
  };
  return withIdentity(SOURCE_RESOLUTION_SCHEMA, 'source_resolution_id', body);
}

function validateMoneySourceResolution(resolution, reference) {
  const keys = [
    'claim_revision_id', 'deal_snapshot_id', 'evidence_excerpt_id', 'resolution_policy_id',
    'schema_version', 'source', 'source_record_kind', 'source_resolution_id',
  ];
  if (!exactKeys(resolution, keys) || resolution.schema_version !== SOURCE_RESOLUTION_SCHEMA
    || resolution.source_record_kind !== 'GOVERNED_RAW_CLAIM') {
    throw new TypeError('invalid trusted money-source resolution');
  }
  const expected = buildMoneySourceResolution({
    resolutionPolicyId: resolution.resolution_policy_id,
    claimRevisionId: resolution.claim_revision_id,
    evidenceExcerptId: resolution.evidence_excerpt_id,
    dealSnapshotId: resolution.deal_snapshot_id,
    literal: resolution.source?.literal,
    value: resolution.source?.value,
    currency: resolution.source?.currency,
    basis: resolution.source?.basis,
    period: resolution.source?.period,
  });
  if (canonicalJson(resolution) !== canonicalJson(expected)
    || resolution.claim_revision_id !== reference.claim_revision_id
    || resolution.evidence_excerpt_id !== reference.evidence_excerpt_id) {
    throw new TypeError('trusted money-source resolution does not match its reference');
  }
  return expected;
}

function buildSigningDateResolution(input = {}) {
  assertClosedInput(input, [
    'claimRevisionId', 'date', 'dealSnapshotId', 'evidenceExcerptId',
    'evidenceTextSha256', 'resolutionPolicyId',
  ], 'signing date resolution input');
  const resolutionPolicyId = ownValue(input, 'resolutionPolicyId');
  const claimRevisionId = ownValue(input, 'claimRevisionId');
  const evidenceExcerptId = ownValue(input, 'evidenceExcerptId');
  const evidenceTextSha256 = ownValue(input, 'evidenceTextSha256');
  const dealSnapshotId = ownValue(input, 'dealSnapshotId');
  const date = ownValue(input, 'date');
  const body = {
    schema_version: SIGNING_DATE_RESOLUTION_SCHEMA,
    resolution_policy_id: requireDigest(resolutionPolicyId, 'resolutionPolicyId'),
    source_record_kind: 'GOVERNED_SIGNING_DATE',
    claim_revision_id: requireDigest(claimRevisionId, 'claimRevisionId'),
    evidence_excerpt_id: requireDigest(evidenceExcerptId, 'evidenceExcerptId'),
    evidence_text_sha256: requireDigest(evidenceTextSha256, 'evidenceTextSha256'),
    deal_snapshot_id: requireDigest(dealSnapshotId, 'dealSnapshotId'),
    date: normaliseDate(date, 'date'),
  };
  return withIdentity(SIGNING_DATE_RESOLUTION_SCHEMA, 'signing_date_resolution_id', body);
}

function validateSigningDateResolution(resolution, reference) {
  const keys = [
    'claim_revision_id', 'date', 'deal_snapshot_id', 'evidence_excerpt_id',
    'evidence_text_sha256', 'resolution_policy_id', 'schema_version',
    'signing_date_resolution_id', 'source_record_kind',
  ];
  if (!exactKeys(resolution, keys) || resolution.schema_version !== SIGNING_DATE_RESOLUTION_SCHEMA
    || resolution.source_record_kind !== 'GOVERNED_SIGNING_DATE') {
    throw new TypeError('invalid trusted signing-date resolution');
  }
  const expected = buildSigningDateResolution({
    resolutionPolicyId: resolution.resolution_policy_id,
    claimRevisionId: resolution.claim_revision_id,
    evidenceExcerptId: resolution.evidence_excerpt_id,
    evidenceTextSha256: resolution.evidence_text_sha256,
    dealSnapshotId: resolution.deal_snapshot_id,
    date: resolution.date,
  });
  if (canonicalJson(resolution) !== canonicalJson(expected)
    || resolution.claim_revision_id !== reference.claim_revision_id
    || resolution.evidence_excerpt_id !== reference.evidence_excerpt_id) {
    throw new TypeError('trusted signing-date resolution does not match its reference');
  }
  return expected;
}

function buildFxRateReceipt(input = {}) {
  assertClosedInput(input, [
    'baseCurrency', 'operator', 'providerId', 'providerResponseDigest',
    'providerVersion', 'quoteCurrency', 'rate', 'rateDate',
  ], 'FX rate receipt input');
  const providerId = ownValue(input, 'providerId');
  const providerVersion = ownValue(input, 'providerVersion');
  const baseCurrency = ownValue(input, 'baseCurrency');
  const quoteCurrency = ownValue(input, 'quoteCurrency');
  const rate = ownValue(input, 'rate');
  const rateDate = ownValue(input, 'rateDate');
  const providerResponseDigest = ownValue(input, 'providerResponseDigest');
  const operator = ownValue(input, 'operator', 'MULTIPLY');
  const base = requireCurrency(baseCurrency, 'baseCurrency');
  const quote = requireCurrency(quoteCurrency, 'quoteCurrency');
  if (base === quote) throw new TypeError('FX receipt base and quote currencies must differ');
  const body = {
    schema_version: FX_RECEIPT_SCHEMA,
    trust_status: 'UNVERIFIED_EXTERNAL_INPUT',
    provider_id: requireCanonicalText(providerId, 'providerId'),
    provider_version: requireCanonicalText(providerVersion, 'providerVersion'),
    provider_response_digest: requireDigest(providerResponseDigest, 'providerResponseDigest'),
    base_currency: base,
    quote_currency: quote,
    rate: requireDecimal(rate, 'rate'),
    rate_date: normaliseDate(rateDate, 'rateDate'),
    operator: requireGovernedKey(operator, 'operator'),
  };
  if (body.operator !== 'MULTIPLY') throw new TypeError('operator must equal MULTIPLY');
  return withIdentity(FX_RECEIPT_SCHEMA, 'fx_rate_receipt_id', body);
}

function validateFxRateReceipt(receipt) {
  const keys = [
    'base_currency', 'fx_rate_receipt_id', 'operator', 'provider_id', 'provider_response_digest',
    'provider_version', 'quote_currency', 'rate', 'rate_date', 'schema_version', 'trust_status',
  ];
  if (!exactKeys(receipt, keys) || receipt.schema_version !== FX_RECEIPT_SCHEMA
    || receipt.trust_status !== 'UNVERIFIED_EXTERNAL_INPUT') {
    throw new TypeError('invalid unverified FX rate receipt');
  }
  const expected = buildFxRateReceipt({
    providerId: receipt.provider_id,
    providerVersion: receipt.provider_version,
    providerResponseDigest: receipt.provider_response_digest,
    baseCurrency: receipt.base_currency,
    quoteCurrency: receipt.quote_currency,
    rate: receipt.rate,
    rateDate: receipt.rate_date,
    operator: receipt.operator,
  });
  if (canonicalJson(receipt) !== canonicalJson(expected)) throw new TypeError('FX rate receipt identity mismatch');
  return expected;
}

function buildFxRateVerification(input = {}) {
  assertClosedInput(input, [
    'fxRateReceiptId', 'verificationEvidenceDigest', 'verificationPolicyId',
  ], 'FX rate verification input');
  const verificationPolicyId = ownValue(input, 'verificationPolicyId');
  const fxRateReceiptId = ownValue(input, 'fxRateReceiptId');
  const verificationEvidenceDigest = ownValue(input, 'verificationEvidenceDigest');
  const body = {
    schema_version: FX_VERIFICATION_SCHEMA,
    verification_status: 'VERIFIED_BY_INJECTED_POLICY',
    verification_policy_id: requireDigest(verificationPolicyId, 'verificationPolicyId'),
    fx_rate_receipt_id: requireDigest(fxRateReceiptId, 'fxRateReceiptId'),
    verification_evidence_digest: requireDigest(verificationEvidenceDigest, 'verificationEvidenceDigest'),
  };
  return withIdentity(FX_VERIFICATION_SCHEMA, 'fx_rate_verification_id', body);
}

function validateFxRateVerification(verification, receipt) {
  const keys = [
    'fx_rate_receipt_id', 'fx_rate_verification_id', 'schema_version',
    'verification_evidence_digest', 'verification_policy_id', 'verification_status',
  ];
  if (!exactKeys(verification, keys) || verification.schema_version !== FX_VERIFICATION_SCHEMA
    || verification.verification_status !== 'VERIFIED_BY_INJECTED_POLICY') {
    throw new TypeError('invalid trusted FX verification');
  }
  const expected = buildFxRateVerification({
    verificationPolicyId: verification.verification_policy_id,
    fxRateReceiptId: verification.fx_rate_receipt_id,
    verificationEvidenceDigest: verification.verification_evidence_digest,
  });
  if (canonicalJson(verification) !== canonicalJson(expected)
    || verification.fx_rate_receipt_id !== receipt.fx_rate_receipt_id) {
    throw new TypeError('trusted FX verification does not match its receipt');
  }
  return expected;
}

function buildDerivationPolicy(input = {}) {
  assertClosedInput(input, [
    'currencyPolicyId', 'derivationVersion', 'displayDecimalPlaces',
    'fxVerificationPolicyId', 'moneySourceResolutionPolicyId',
    'permittedPeriodRules', 'policyAuthorityId', 'signingDateResolutionPolicyId',
  ], 'derivation policy input');
  const derivationVersion = ownValue(input, 'derivationVersion');
  const policyAuthorityId = ownValue(input, 'policyAuthorityId');
  const currencyPolicyId = ownValue(input, 'currencyPolicyId');
  const moneySourceResolutionPolicyId = ownValue(input, 'moneySourceResolutionPolicyId');
  const signingDateResolutionPolicyId = ownValue(input, 'signingDateResolutionPolicyId');
  const fxVerificationPolicyId = ownValue(input, 'fxVerificationPolicyId');
  const displayDecimalPlaces = ownValue(input, 'displayDecimalPlaces');
  const permittedPeriodRules = ownValue(input, 'permittedPeriodRules', []);
  if (!Array.isArray(permittedPeriodRules)) throw new TypeError('permittedPeriodRules must be an array');
  const rules = permittedPeriodRules.map((rule) => requireGovernedKey(rule, 'permittedPeriodRule')).sort();
  if (new Set(rules).size !== rules.length) throw new TypeError('permittedPeriodRules must be unique');
  if (rules.some((rule) => !EXECUTABLE_PERIOD_RULES.has(rule))) {
    throw new TypeError('permittedPeriodRules must be an intentional subset of executable rules');
  }
  const body = {
    schema_version: DERIVATION_POLICY_SCHEMA,
    derivation_version: requireCanonicalText(derivationVersion, 'derivationVersion'),
    policy_authority_id: requireDigest(policyAuthorityId, 'policyAuthorityId'),
    currency_policy_id: requireDigest(currencyPolicyId, 'currencyPolicyId'),
    money_source_resolution_policy_id: requireDigest(
      moneySourceResolutionPolicyId,
      'moneySourceResolutionPolicyId',
    ),
    signing_date_resolution_policy_id: requireDigest(
      signingDateResolutionPolicyId,
      'signingDateResolutionPolicyId',
    ),
    fx_verification_policy_id: requireDigest(fxVerificationPolicyId, 'fxVerificationPolicyId'),
    exact_value_policy: 'REDUCED_RATIONAL_FOR_COMPARISON',
    display_rounding_mode: ROUNDING_MODE,
    display_decimal_places: requirePrecision(displayDecimalPlaces, 'displayDecimalPlaces'),
    permitted_period_rules: rules,
  };
  return withIdentity(DERIVATION_POLICY_SCHEMA, 'derivation_policy_id', body);
}

function validateDerivationPolicy(policy, derivationVersion) {
  const keys = [
    'currency_policy_id', 'derivation_policy_id', 'derivation_version', 'display_decimal_places',
    'display_rounding_mode', 'exact_value_policy', 'fx_verification_policy_id',
    'money_source_resolution_policy_id', 'permitted_period_rules', 'policy_authority_id',
    'schema_version', 'signing_date_resolution_policy_id',
  ];
  if (!exactKeys(policy, keys) || policy.schema_version !== DERIVATION_POLICY_SCHEMA
    || policy.exact_value_policy !== 'REDUCED_RATIONAL_FOR_COMPARISON'
    || policy.display_rounding_mode !== ROUNDING_MODE) {
    throw new TypeError('invalid trusted derivation policy');
  }
  const expected = buildDerivationPolicy({
    derivationVersion: policy.derivation_version,
    policyAuthorityId: policy.policy_authority_id,
    currencyPolicyId: policy.currency_policy_id,
    moneySourceResolutionPolicyId: policy.money_source_resolution_policy_id,
    signingDateResolutionPolicyId: policy.signing_date_resolution_policy_id,
    fxVerificationPolicyId: policy.fx_verification_policy_id,
    displayDecimalPlaces: policy.display_decimal_places,
    permittedPeriodRules: policy.permitted_period_rules,
  });
  if (canonicalJson(policy) !== canonicalJson(expected)
    || policy.derivation_version !== derivationVersion) {
    throw new TypeError('trusted derivation policy does not match requested version');
  }
  return expected;
}

function requireTrustFunction(context, name) {
  if (!context) throw new TypeError(`trustedContext.${name} is required`);
  const candidate = context[name];
  if (typeof candidate !== 'function') throw new TypeError(`trustedContext.${name} is required`);
  return candidate;
}

function resolveSource(reference, context) {
  const resolved = requireTrustFunction(context, 'resolveMoneySource')({ ...reference });
  return validateMoneySourceResolution(resolved, reference);
}

function resolveSigningDate(reference, context) {
  const resolved = requireTrustFunction(context, 'resolveSigningDate')({ ...reference });
  return validateSigningDateResolution(resolved, reference);
}

function resolvePolicy(derivationVersion, context) {
  const resolved = requireTrustFunction(context, 'resolveDerivationPolicy')({ derivation_version: derivationVersion });
  return validateDerivationPolicy(resolved, derivationVersion);
}

function verifyFxReceipt(receipt, policy, context) {
  const verified = requireTrustFunction(context, 'verifyFxRateReceipt')(receipt);
  const result = validateFxRateVerification(verified, receipt);
  if (result.verification_policy_id !== policy.fx_verification_policy_id) {
    throw new TypeError('FX verification does not match the derivation policy');
  }
  return result;
}

function requirePermittedCurrency(currency, policy, context) {
  const accepted = requireTrustFunction(context, 'validateCurrency')({
    currency_code: currency,
    currency_policy_id: policy.currency_policy_id,
  });
  if (accepted !== true) throw new TypeError(`currency ${currency} is not admitted by the trusted currency policy`);
}

function finish(payload) {
  const withDigest = {
    ...payload,
    derived_comparison_payload_digest: contentId('DERIVED_COMPARISON_PAYLOAD/V3', payload),
  };
  return deepFreeze({
    ...withDigest,
    derived_comparison_id: contentId('DERIVED_COMPARISON_RECORD/V3', withDigest),
  });
}

function baseRecord({ sourceResolution, policy, targetCurrency, targetPeriod, attemptedPeriodRule,
  receipt, verification, signingResolution }) {
  const source = sourceResolution.source;
  const currencyChanges = targetCurrency !== source.currency;
  const periodChanges = targetPeriod !== source.period;
  return {
    schema_version: SCHEMA_VERSION,
    record_kind: RECORD_KIND,
    authority: AUTHORITY,
    agreement_text_status: AGREEMENT_TEXT_STATUS,
    derived_status: 'DERIVED',
    comparison_kind: currencyChanges && periodChanges
      ? 'FX_AND_PERIOD_NORMALISATION'
      : currencyChanges ? 'FX_CONVERSION' : periodChanges ? 'PERIOD_NORMALISATION' : 'NO_OP',
    derivation_policy: policy,
    source_reference: {
      claim_revision_id: sourceResolution.claim_revision_id,
      evidence_excerpt_id: sourceResolution.evidence_excerpt_id,
    },
    source_resolution: sourceResolution,
    transformation: {
      fx: {
        attempted_rule: targetCurrency === source.currency ? null : 'SIGNING_DATE_FX_SPOT_MULTIPLY',
        applied_rule: null,
        fx_rate_receipt: receipt,
        fx_rate_verification: verification,
        signing_date_resolution: signingResolution,
      },
      period: {
        attempted_rule: attemptedPeriodRule,
        applied_rule: null,
        factor_numerator: null,
        factor_denominator: null,
      },
    },
    target: {
      unit: 'MONEY',
      currency: targetCurrency,
      basis: source.basis,
      period: targetPeriod,
    },
  };
}

function exclusion(base, reason) {
  return finish({
    ...base,
    output: null,
    display: null,
    comparability_state: 'EXCLUDED',
    exclusion_reason: reason,
  });
}

function deriveMoneyComparison(input = {}, trustedContext) {
  assertClosedInput(input, [
    'derivationVersion', 'fxRateReceipt', 'signingDateReference', 'sourceReference',
    'targetCurrency', 'targetPeriod', 'transformationRule',
  ], 'derived comparison input');
  const sourceReference = ownValue(input, 'sourceReference');
  const targetCurrency = ownValue(input, 'targetCurrency');
  const targetPeriod = ownValue(input, 'targetPeriod', null);
  const transformationRule = ownValue(input, 'transformationRule', null);
  const fxRateReceipt = ownValue(input, 'fxRateReceipt', null);
  const signingDateReference = ownValue(input, 'signingDateReference', null);
  const derivationVersion = ownValue(input, 'derivationVersion');
  const sourceRef = requireReference(sourceReference, 'sourceReference');
  const sourceResolution = resolveSource(sourceRef, trustedContext);
  const source = sourceResolution.source;
  const currency = targetCurrency == null ? source.currency : requireCurrency(targetCurrency, 'targetCurrency');
  const period = targetPeriod == null ? source.period : requireGovernedKey(targetPeriod, 'targetPeriod');
  const suppliedRule = transformationRule == null ? null : requireGovernedKey(transformationRule, 'transformationRule');
  const version = requireCanonicalText(derivationVersion, 'derivationVersion');
  const policy = resolvePolicy(version, trustedContext);
  if (sourceResolution.resolution_policy_id !== policy.money_source_resolution_policy_id) {
    throw new TypeError('money-source resolution does not match the derivation policy');
  }
  const receipt = fxRateReceipt == null ? null : validateFxRateReceipt(fxRateReceipt);
  requirePermittedCurrency(source.currency, policy, trustedContext);
  requirePermittedCurrency(currency, policy, trustedContext);
  if (receipt) {
    requirePermittedCurrency(receipt.base_currency, policy, trustedContext);
    requirePermittedCurrency(receipt.quote_currency, policy, trustedContext);
  }
  const verification = receipt == null ? null : verifyFxReceipt(receipt, policy, trustedContext);
  const signingRef = signingDateReference == null ? null : requireReference(signingDateReference, 'signingDateReference');
  const signingResolution = signingRef == null ? null : resolveSigningDate(signingRef, trustedContext);
  if (signingResolution
    && signingResolution.resolution_policy_id !== policy.signing_date_resolution_policy_id) {
    throw new TypeError('signing-date resolution does not match the derivation policy');
  }
  if (signingResolution && signingResolution.deal_snapshot_id !== sourceResolution.deal_snapshot_id) {
    throw new TypeError('source and signing-date resolutions belong to different deal snapshots');
  }
  const base = baseRecord({
    sourceResolution,
    policy,
    targetCurrency: currency,
    targetPeriod: period,
    attemptedPeriodRule: suppliedRule,
    receipt,
    verification,
    signingResolution,
  });

  const fxRequired = currency !== source.currency;
  const periodRequired = period !== source.period;
  if (!fxRequired && (receipt || signingResolution)) {
    return exclusion(base, 'FX_OPERANDS_WITHOUT_CURRENCY_CHANGE');
  }
  if (!periodRequired && suppliedRule) return exclusion(base, 'PERIOD_RULE_WITHOUT_PERIOD_CHANGE');
  if (!fxRequired && !periodRequired) return exclusion(base, 'SOURCE_TARGET_DIMENSIONS_IDENTICAL');
  if (fxRequired && !receipt) return exclusion(base, 'MISSING_FX_RATE_RECEIPT');
  if (fxRequired && (receipt.base_currency !== source.currency
    || receipt.quote_currency !== currency || receipt.operator !== 'MULTIPLY')) {
    return exclusion(base, 'FX_PAIR_DIRECTION_MISMATCH');
  }
  if (fxRequired && decimalFraction(receipt.rate).numerator <= 0n) {
    return exclusion(base, 'NON_POSITIVE_FX_RATE');
  }
  if (fxRequired && !signingResolution) return exclusion(base, 'MISSING_SIGNING_DATE_BINDING');
  if (fxRequired && receipt.rate_date !== signingResolution.date) {
    return exclusion(base, 'FX_RATE_DATE_NOT_SIGNING_DATE');
  }
  if (periodRequired && !source.period) return exclusion(base, 'MISSING_SOURCE_PERIOD');
  if (periodRequired && !suppliedRule) return exclusion(base, 'MISSING_PERIOD_TRANSFORMATION_RULE');
  const governedPeriod = periodRequired ? PERIOD_RULES[`${source.period}:${period}`] || null : null;
  if (periodRequired && (!governedPeriod || suppliedRule !== governedPeriod.rule
    || !policy.permitted_period_rules.includes(suppliedRule))) {
    return exclusion(base, 'UNSUPPORTED_PERIOD_TRANSFORMATION');
  }

  const amount = decimalFraction(source.value);
  const fx = fxRequired ? decimalFraction(receipt.rate) : { numerator: 1n, denominator: 1n };
  const periodFactor = periodRequired ? governedPeriod : { numerator: 1n, denominator: 1n, rule: null };
  const reduced = reducedFraction(
    amount.numerator * fx.numerator * periodFactor.numerator,
    amount.denominator * fx.denominator * periodFactor.denominator,
  );
  const display = roundedDecimal(reduced.numerator, reduced.denominator, policy.display_decimal_places);
  return finish({
    ...base,
    transformation: {
      fx: {
        ...base.transformation.fx,
        applied_rule: fxRequired ? 'SIGNING_DATE_FX_SPOT_MULTIPLY' : null,
      },
      period: {
        ...base.transformation.period,
        applied_rule: periodFactor.rule,
        factor_numerator: String(periodFactor.numerator),
        factor_denominator: String(periodFactor.denominator),
      },
    },
    output: {
      exact_numerator: String(reduced.numerator),
      exact_denominator: String(reduced.denominator),
      canonical_decimal: exactTerminatingDecimal(reduced.numerator, reduced.denominator),
      unit: 'MONEY',
      currency,
      basis: source.basis,
      period,
    },
    display: {
      status: 'DISPLAY_ONLY_NOT_COMPARISON_INPUT',
      value: display.value,
      decimal_places: policy.display_decimal_places,
      rounding_mode: policy.display_rounding_mode,
      rounding_applied: display.rounding_applied,
    },
    comparability_state: 'COMPARABLE',
    exclusion_reason: null,
  });
}

function convertMoneyFx(input, trustedContext) {
  return deriveMoneyComparison(input, trustedContext);
}

function convertPeriod(input, trustedContext) {
  return deriveMoneyComparison(input, trustedContext);
}

function validateEnvelopeIdentity(value) {
  const keys = [
    'agreement_text_status', 'authority', 'comparability_state', 'comparison_kind',
    'derivation_policy', 'derived_comparison_id', 'derived_comparison_payload_digest',
    'derived_status', 'display', 'exclusion_reason', 'output', 'record_kind', 'schema_version',
    'source_reference', 'source_resolution', 'target', 'transformation',
  ];
  if (!exactKeys(value, keys) || value.schema_version !== SCHEMA_VERSION
    || value.record_kind !== RECORD_KIND || value.authority !== AUTHORITY
    || value.agreement_text_status !== AGREEMENT_TEXT_STATUS || value.derived_status !== 'DERIVED') {
    throw new TypeError('invalid derived comparison envelope');
  }
  const { derived_comparison_id: identifier, derived_comparison_payload_digest: digest, ...payload } = value;
  if (digest !== contentId('DERIVED_COMPARISON_PAYLOAD/V3', payload)) {
    throw new TypeError('derived comparison payload digest mismatch');
  }
  const withDigest = { ...payload, derived_comparison_payload_digest: digest };
  if (identifier !== contentId('DERIVED_COMPARISON_RECORD/V3', withDigest)) {
    throw new TypeError('derived comparison identity mismatch');
  }
}

function validateDerivedComparison(value, trustedContext) {
  validateEnvelopeIdentity(value);
  const expected = deriveMoneyComparison({
    sourceReference: value.source_reference,
    targetCurrency: value.target.currency,
    targetPeriod: value.target.period,
    transformationRule: value.transformation.period.attempted_rule,
    fxRateReceipt: value.transformation.fx.fx_rate_receipt,
    signingDateReference: value.transformation.fx.signing_date_resolution == null ? null : {
      claim_revision_id: value.transformation.fx.signing_date_resolution.claim_revision_id,
      evidence_excerpt_id: value.transformation.fx.signing_date_resolution.evidence_excerpt_id,
    },
    derivationVersion: value.derivation_policy.derivation_version,
  }, trustedContext);
  if (canonicalJson(value) !== canonicalJson(expected)) {
    throw new TypeError('derived comparison semantic reconstruction mismatch');
  }
  return canonicalJson(value);
}

module.exports = {
  AGREEMENT_TEXT_STATUS,
  AUTHORITY,
  DERIVATION_POLICY_SCHEMA,
  FX_RECEIPT_SCHEMA,
  FX_VERIFICATION_SCHEMA,
  RECORD_KIND,
  ROUNDING_MODE,
  SCHEMA_VERSION,
  SIGNING_DATE_RESOLUTION_SCHEMA,
  SOURCE_RESOLUTION_SCHEMA,
  buildDerivationPolicy,
  buildFxRateReceipt,
  buildFxRateVerification,
  buildMoneySourceResolution,
  buildSigningDateResolution,
  convertMoneyFx,
  convertPeriod,
  deriveMoneyComparison,
  validateDerivedComparison,
  validateDerivationPolicy,
  validateFxRateReceipt,
  validateFxRateVerification,
  validateMoneySourceResolution,
  validateSigningDateResolution,
};
