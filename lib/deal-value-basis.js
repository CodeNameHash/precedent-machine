const DEAL_VALUE_BASES = Object.freeze({
  EQUITY_VALUE: 'equity_value',
  ENTERPRISE_VALUE: 'enterprise_value',
  HEADLINE_TRANSACTION_VALUE: 'headline_transaction_value',
  UNKNOWN: 'unknown',
});

const BASIS_ALIASES = new Map([
  ['equity', DEAL_VALUE_BASES.EQUITY_VALUE],
  ['equity value', DEAL_VALUE_BASES.EQUITY_VALUE],
  ['equity_value', DEAL_VALUE_BASES.EQUITY_VALUE],
  ['enterprise', DEAL_VALUE_BASES.ENTERPRISE_VALUE],
  ['enterprise value', DEAL_VALUE_BASES.ENTERPRISE_VALUE],
  ['enterprise_value', DEAL_VALUE_BASES.ENTERPRISE_VALUE],
  ['headline', DEAL_VALUE_BASES.HEADLINE_TRANSACTION_VALUE],
  ['headline transaction value', DEAL_VALUE_BASES.HEADLINE_TRANSACTION_VALUE],
  ['headline_transaction_value', DEAL_VALUE_BASES.HEADLINE_TRANSACTION_VALUE],
  ['transaction value', DEAL_VALUE_BASES.HEADLINE_TRANSACTION_VALUE],
  ['transaction_value', DEAL_VALUE_BASES.HEADLINE_TRANSACTION_VALUE],
  ['unknown', DEAL_VALUE_BASES.UNKNOWN],
]);

function objectOrEmpty(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeExplicitBasis(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  return BASIS_ALIASES.get(value.trim().toLowerCase()) || DEAL_VALUE_BASES.UNKNOWN;
}

function inputParts(dealOrMetadata) {
  const root = objectOrEmpty(dealOrMetadata);
  const metadata = Object.keys(objectOrEmpty(root.metadata)).length ? objectOrEmpty(root.metadata) : root;
  const provenance = Object.keys(objectOrEmpty(root.value_provenance)).length
    ? objectOrEmpty(root.value_provenance)
    : (Object.keys(objectOrEmpty(metadata.value_provenance)).length
      ? objectOrEmpty(metadata.value_provenance)
      : (root.kind ? root : {}));
  return { metadata, provenance };
}

function explicitBasisSignals(metadata, provenance) {
  return [
    ['metadata.deal_value_basis', metadata.deal_value_basis],
    ['metadata.dealValueBasis', metadata.dealValueBasis],
    ['metadata.value_basis', metadata.value_basis],
    ['metadata.valueBasis', metadata.valueBasis],
    ['value_provenance.deal_value_basis', provenance.deal_value_basis],
    ['value_provenance.dealValueBasis', provenance.dealValueBasis],
    ['value_provenance.value_basis', provenance.value_basis],
    ['value_provenance.valueBasis', provenance.valueBasis],
    ['value_provenance.basis', provenance.basis],
  ]
    .filter(([, value]) => typeof value === 'string' && value.trim())
    .map(([source, value]) => ({ source, basis: normalizeExplicitBasis(value) }));
}

function basisFromText(text) {
  const value = String(text || '');
  const specific = new Set();
  if (/\bequity\s+value\b/i.test(value)) specific.add(DEAL_VALUE_BASES.EQUITY_VALUE);
  if (/\benterprise\s+value\b/i.test(value)) specific.add(DEAL_VALUE_BASES.ENTERPRISE_VALUE);
  if (specific.size > 1) return DEAL_VALUE_BASES.UNKNOWN;
  if (specific.size === 1) return [...specific][0];

  if (/\b(?:total\s+|aggregate\s+|headline\s+|implied\s+)?transaction\s+value\b/i.test(value)) {
    return DEAL_VALUE_BASES.HEADLINE_TRANSACTION_VALUE;
  }
  if (/\btransaction\s+(?:valued|valuing)\b/i.test(value)) return DEAL_VALUE_BASES.HEADLINE_TRANSACTION_VALUE;
  if (/\bacquir(?:e|es|ing)\b[\s\S]{0,120}\bfor\s+(?:approximately\s+)?(?:US\s*)?\$\s*\d/i.test(value)) {
    return DEAL_VALUE_BASES.HEADLINE_TRANSACTION_VALUE;
  }
  return null;
}

function classifyDealValueBasisDetailed(dealOrMetadata) {
  const { metadata, provenance } = inputParts(dealOrMetadata);
  if (provenance.kind === 'no_stated_value') {
    return { basis: DEAL_VALUE_BASES.UNKNOWN, source: 'value_provenance.kind', reason: 'no-stated-value' };
  }

  const explicit = explicitBasisSignals(metadata, provenance);
  if (explicit.length) {
    const bases = new Set(explicit.map((signal) => signal.basis));
    if (bases.size !== 1 || bases.has(DEAL_VALUE_BASES.UNKNOWN)) {
      return {
        basis: DEAL_VALUE_BASES.UNKNOWN,
        source: explicit.map((signal) => signal.source).join(','),
        reason: bases.size > 1 ? 'conflicting-explicit-basis' : 'unrecognized-explicit-basis',
      };
    }
    return {
      basis: [...bases][0],
      source: explicit.map((signal) => signal.source).join(','),
      reason: 'explicit-basis',
    };
  }

  if (provenance.kind === 'derived_per_share') {
    return { basis: DEAL_VALUE_BASES.EQUITY_VALUE, source: 'value_provenance.kind', reason: 'derived-per-share' };
  }

  const textSignals = [
    ['value_provenance.quote', provenance.quote],
    ['value_provenance.note', provenance.note],
    ['metadata.deal_value_description', metadata.deal_value_description],
    ['metadata.value_description', metadata.value_description],
  ]
    .filter(([, value]) => typeof value === 'string' && value.trim())
    .map(([source, value]) => ({ source, basis: basisFromText(value) }))
    .filter((signal) => signal.basis);

  const specificSignals = textSignals.filter((signal) => (
    signal.basis === DEAL_VALUE_BASES.EQUITY_VALUE || signal.basis === DEAL_VALUE_BASES.ENTERPRISE_VALUE
  ));
  const candidates = specificSignals.length ? specificSignals : textSignals;
  const bases = new Set(candidates.map((signal) => signal.basis));
  if (bases.size > 1 || bases.has(DEAL_VALUE_BASES.UNKNOWN)) {
    return {
      basis: DEAL_VALUE_BASES.UNKNOWN,
      source: candidates.map((signal) => signal.source).join(',') || null,
      reason: 'conflicting-provenance-language',
    };
  }
  if (bases.size === 1) {
    return {
      basis: [...bases][0],
      source: candidates.map((signal) => signal.source).join(','),
      reason: specificSignals.length ? 'specific-provenance-language' : 'headline-provenance-language',
    };
  }

  return { basis: DEAL_VALUE_BASES.UNKNOWN, source: null, reason: 'basis-not-explicit' };
}

function classifyDealValueBasis(dealOrMetadata) {
  return classifyDealValueBasisDetailed(dealOrMetadata).basis;
}

module.exports = {
  DEAL_VALUE_BASES,
  classifyDealValueBasis,
  classifyDealValueBasisDetailed,
};
