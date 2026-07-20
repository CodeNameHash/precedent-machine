function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeUnit(unit) {
  const value = String(unit || '').trim().toLowerCase();
  if (!value) return null;
  if (value === 'business_days') return 'business days';
  if (value === 'calendar_days') return 'calendar days';
  if (value === 'usd' || value === 'currency' || value === 'dollars') return 'usd';
  return value.replaceAll('_', ' ');
}

export function normalizeFeatureSummary(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const attribute = String(raw.attribute || '').trim();
  const label = String(raw.label || attribute || 'Market value').trim();
  const numericFields = ['min', 'p25', 'median', 'p75', 'max'];
  const numeric = raw.kind === 'numeric'
    || numericFields.some((field) => finiteNumber(raw[field]) !== null);

  if (numeric) {
    return {
      attribute: attribute || label,
      label,
      kind: 'numeric',
      unit: normalizeUnit(raw.unit),
      min: finiteNumber(raw.min),
      p25: finiteNumber(raw.p25),
      median: finiteNumber(raw.median),
      p75: finiteNumber(raw.p75),
      max: finiteNumber(raw.max),
      count: finiteNumber(raw.count),
    };
  }

  const values = (Array.isArray(raw.values) ? raw.values : [])
    .filter((value) => value && typeof value === 'object')
    .map((value) => ({
      value: value.value,
      label: String(value.label ?? value.value ?? 'Unknown'),
      count: finiteNumber(value.count),
    }));

  return {
    attribute: attribute || label,
    label,
    kind: 'categorical',
    values,
  };
}

export function formatFeatureSummaryNumber(value, unit) {
  const number = finiteNumber(value);
  if (number === null) return '—';
  const normalizedUnit = normalizeUnit(unit);
  if (normalizedUnit === 'usd') {
    if (Math.abs(number) >= 1e9) return `$${(number / 1e9).toFixed(1).replace(/\.0$/, '')}B`;
    if (Math.abs(number) >= 1e6) return `$${(number / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
    return `$${number.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  }

  const rendered = number.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (!normalizedUnit) return rendered;
  if (normalizedUnit === 'percent' || normalizedUnit === 'percentage' || normalizedUnit === '%') return `${rendered}%`;
  const singular = number === 1 && normalizedUnit.endsWith('s') ? normalizedUnit.slice(0, -1) : normalizedUnit;
  return `${rendered} ${singular}`;
}

export function formatFeatureSummaryUnit(unit, count = null) {
  const normalizedUnit = normalizeUnit(unit);
  if (!normalizedUnit) return null;
  if (normalizedUnit === 'usd') return 'USD';
  if (normalizedUnit === 'percent' || normalizedUnit === 'percentage' || normalizedUnit === '%') return 'percent';
  if (count === 1 && normalizedUnit.endsWith('s')) return normalizedUnit.slice(0, -1);
  return normalizedUnit;
}

export function isDurationFeatureSummaryUnit(unit) {
  const normalizedUnit = normalizeUnit(unit);
  return new Set(['hours', 'elapsed hours', 'days', 'calendar days', 'business days', 'months', 'years']).has(normalizedUnit);
}

export function matchingMoneyCohort(distribution, subjectBasis) {
  if (typeof subjectBasis !== 'string' || !subjectBasis.trim()) return null;
  const cohorts = Array.isArray(distribution?.normalised?.cohorts)
    ? distribution.normalised.cohorts
    : [];
  return cohorts.find((cohort) => cohort?.basis === subjectBasis) || null;
}
