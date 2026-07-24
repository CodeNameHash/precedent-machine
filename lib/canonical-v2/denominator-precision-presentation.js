const DENOMINATOR_PRECISION = Object.freeze({
  EXACT: 'EXACT',
  APPROXIMATE: 'APPROXIMATE',
  NOT_CAPTURED: 'NOT_CAPTURED',
});

function normaliseDenominatorPrecision(value) {
  if (value === DENOMINATOR_PRECISION.EXACT) return DENOMINATOR_PRECISION.EXACT;
  if (value === DENOMINATOR_PRECISION.APPROXIMATE) return DENOMINATOR_PRECISION.APPROXIMATE;
  return DENOMINATOR_PRECISION.NOT_CAPTURED;
}

function resolveDenominatorPrecision(component, compatibilityPrecision) {
  const denominator = component?.denominator;
  if (denominator
    && Object.prototype.hasOwnProperty.call(denominator, 'precision')
    && denominator.precision != null) {
    return normaliseDenominatorPrecision(denominator.precision);
  }
  const fallback = compatibilityPrecision === undefined
    ? component?.claim_attributes?.denominator_precision
    : compatibilityPrecision;
  return normaliseDenominatorPrecision(fallback);
}

function qualifyDerivedValue(label, precision) {
  const resolved = normaliseDenominatorPrecision(precision);
  if (resolved === DENOMINATOR_PRECISION.EXACT) return label;
  if (resolved === DENOMINATOR_PRECISION.APPROXIMATE) return `Approximately ${label}`;
  return `${label} (denominator precision not captured)`;
}

function qualifyDealValueBasis(label, precision) {
  const resolved = normaliseDenominatorPrecision(precision);
  if (resolved === DENOMINATOR_PRECISION.EXACT) return label;
  if (resolved === DENOMINATOR_PRECISION.APPROXIMATE) {
    return label.startsWith('SEC-reported ')
      ? label.replace('SEC-reported ', 'SEC-reported approximate ')
      : `Approximately ${label}`;
  }
  return `${label} (denominator precision not captured)`;
}

module.exports = {
  DENOMINATOR_PRECISION,
  normaliseDenominatorPrecision,
  resolveDenominatorPrecision,
  qualifyDerivedValue,
  qualifyDealValueBasis,
};
