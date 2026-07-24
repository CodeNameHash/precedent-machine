const { canonicalJson, contentId } = require('./canonical-bytes');

const DECIMAL_RE = /^(0|[1-9]\d*)(\.\d+)?$/;
const MONEY_BASES = new Set([
  'EQUITY_VALUE',
  'ENTERPRISE_VALUE',
  'HEADLINE_TRANSACTION_VALUE',
]);
const MONEY_DENOMINATOR_PRECISIONS = new Set(['EXACT', 'APPROXIMATE']);
const DAY_BASES = new Set(['ELAPSED', 'BUSINESS', 'CALENDAR', 'UNKNOWN']);

function requireDecimal(value, label) {
  if (typeof value !== 'string' || !DECIMAL_RE.test(value)) {
    throw new TypeError(`${label} must be a non-negative canonical decimal string`);
  }
  return value;
}

function requireText(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${label} is required`);
  return value.trim();
}

function decimalFraction(value) {
  const [integer, fractional = ''] = value.split('.');
  return {
    numerator: BigInt(`${integer}${fractional}`),
    denominator: 10n ** BigInt(fractional.length),
  };
}

function roundedDecimal(numerator, denominator, decimalPlaces) {
  const scale = 10n ** BigInt(decimalPlaces);
  const scaled = numerator * scale;
  const rounded = (scaled + (denominator / 2n)) / denominator;
  const integer = rounded / scale;
  const fractional = String(rounded % scale).padStart(decimalPlaces, '0').replace(/0+$/, '');
  return fractional ? `${integer}.${fractional}` : String(integer);
}

function finish(payload) {
  return Object.freeze({
    ...payload,
    normalisation_payload_digest: contentId('OBSERVATION_NORMALISATION_PAYLOAD/V1', payload),
  });
}

function normaliseMoneyRelativeToDealValue({
  rawAmount,
  currency,
  denominator = null,
  derivationVersion,
  percentageDecimalPlaces = 8,
} = {}) {
  const amount = requireDecimal(rawAmount, 'rawAmount');
  const governedCurrency = requireText(currency, 'currency').toUpperCase();
  const version = requireText(derivationVersion, 'derivationVersion');
  if (!Number.isInteger(percentageDecimalPlaces) || percentageDecimalPlaces < 0 || percentageDecimalPlaces > 12) {
    throw new TypeError('percentageDecimalPlaces must be an integer between 0 and 12');
  }

  const rawValue = { amount, currency: governedCurrency };
  const base = {
    schema_version: 'OBSERVATION_NORMALISATION/V1',
    value_kind: 'MONEY_RELATIVE_TO_DEAL_VALUE',
    raw_value: rawValue,
    canonical_unit: 'PERCENT_OF_DEAL_VALUE',
    derivation_version: version,
  };
  if (!denominator) {
    return finish({
      ...base,
      canonical_value: null,
      basis_key: null,
      denominator: null,
      comparability_state: 'EXCLUDED',
      exclusion_reason: 'MISSING_DENOMINATOR',
    });
  }

  const denominatorValue = requireDecimal(denominator.value, 'denominator.value');
  const denominatorCurrency = requireText(denominator.currency, 'denominator.currency').toUpperCase();
  const denominatorBasis = requireText(denominator.basis, 'denominator.basis').toUpperCase();
  const denominatorPrecision = denominator.precision == null
    ? null
    : requireText(denominator.precision, 'denominator.precision').toUpperCase();
  if (denominatorPrecision != null && !MONEY_DENOMINATOR_PRECISIONS.has(denominatorPrecision)) {
    throw new TypeError(`unsupported denominator.precision: ${denominatorPrecision}`);
  }
  const sourceLineageIds = [...(denominator.source_lineage_ids || [])].sort();
  const governedDenominator = {
    value: denominatorValue,
    currency: denominatorCurrency,
    basis: denominatorBasis,
    source_lineage_ids: sourceLineageIds,
  };
  if (denominatorPrecision != null) governedDenominator.precision = denominatorPrecision;
  let exclusionReason = null;
  if (decimalFraction(denominatorValue).numerator === 0n) exclusionReason = 'NON_POSITIVE_DENOMINATOR';
  else if (!MONEY_BASES.has(denominatorBasis)) exclusionReason = 'UNKNOWN_DENOMINATOR_BASIS';
  else if (denominatorCurrency !== governedCurrency) exclusionReason = 'CURRENCY_MISMATCH';
  else if (sourceLineageIds.length === 0) exclusionReason = 'MISSING_DENOMINATOR_LINEAGE';

  if (exclusionReason) {
    return finish({
      ...base,
      canonical_value: null,
      basis_key: null,
      denominator: governedDenominator,
      comparability_state: 'EXCLUDED',
      exclusion_reason: exclusionReason,
    });
  }

  const amountFraction = decimalFraction(amount);
  const denominatorFraction = decimalFraction(denominatorValue);
  const percentNumerator = amountFraction.numerator * denominatorFraction.denominator * 100n;
  const percentDenominator = amountFraction.denominator * denominatorFraction.numerator;
  return finish({
    ...base,
    canonical_value: roundedDecimal(percentNumerator, percentDenominator, percentageDecimalPlaces),
    basis_key: `PERCENT_OF_DEAL_VALUE:${denominatorBasis}:${governedCurrency}`,
    denominator: governedDenominator,
    comparability_state: 'COMPARABLE',
    exclusion_reason: null,
  });
}

function normaliseDurationToDays({ rawMagnitude, rawUnit, dayBasis, trigger, derivationVersion } = {}) {
  const magnitude = requireDecimal(rawMagnitude, 'rawMagnitude');
  const unit = requireText(rawUnit, 'rawUnit').toUpperCase();
  const basis = requireText(dayBasis, 'dayBasis').toUpperCase();
  const governedTrigger = requireText(trigger, 'trigger');
  const version = requireText(derivationVersion, 'derivationVersion');
  if (!DAY_BASES.has(basis)) throw new TypeError(`unsupported dayBasis: ${basis}`);

  const base = {
    schema_version: 'OBSERVATION_NORMALISATION/V1',
    value_kind: 'DURATION',
    raw_value: { magnitude, unit, day_basis: basis },
    canonical_unit: 'DAYS',
    day_basis: basis,
    trigger: governedTrigger,
    derivation_version: version,
  };
  let canonicalValue = null;
  let exclusionReason = null;
  if (basis === 'UNKNOWN') exclusionReason = 'UNKNOWN_DAY_BASIS';
  else if (unit === 'DAYS') canonicalValue = magnitude;
  else if (unit === 'HOURS' && basis === 'ELAPSED') {
    const fraction = decimalFraction(magnitude);
    canonicalValue = roundedDecimal(fraction.numerator, fraction.denominator * 24n, 12);
  } else exclusionReason = 'UNSUPPORTED_UNIT_BASIS_COMBINATION';

  if (exclusionReason) {
    return finish({
      ...base,
      canonical_value: null,
      basis_key: null,
      comparability_state: 'EXCLUDED',
      exclusion_reason: exclusionReason,
    });
  }
  return finish({
    ...base,
    canonical_value: canonicalValue,
    basis_key: `DAYS:${basis}:${governedTrigger}`,
    comparability_state: 'COMPARABLE',
    exclusion_reason: null,
  });
}

function validateObservationNormalisation(value) {
  if (!value || value.schema_version !== 'OBSERVATION_NORMALISATION/V1') {
    throw new TypeError('invalid observation normalisation');
  }
  if (value.value_kind === 'MONEY_RELATIVE_TO_DEAL_VALUE'
    && value.denominator?.precision != null
    && !MONEY_DENOMINATOR_PRECISIONS.has(value.denominator.precision)) {
    throw new TypeError('invalid money denominator precision');
  }
  const { normalisation_payload_digest: digest, ...payload } = value;
  if (digest !== contentId('OBSERVATION_NORMALISATION_PAYLOAD/V1', payload)) {
    throw new TypeError('observation normalisation payload digest mismatch');
  }
  if (value.comparability_state === 'COMPARABLE') {
    if (value.canonical_value == null || value.basis_key == null || value.exclusion_reason !== null) {
      throw new TypeError('comparable observation normalisation is incomplete');
    }
  } else if (value.comparability_state === 'EXCLUDED') {
    if (value.canonical_value !== null || value.basis_key !== null || !value.exclusion_reason) {
      throw new TypeError('excluded observation normalisation is incomplete');
    }
  } else throw new TypeError('invalid observation comparability state');
  return canonicalJson(value);
}

module.exports = {
  normaliseDurationToDays,
  normaliseMoneyRelativeToDealValue,
  validateObservationNormalisation,
};
