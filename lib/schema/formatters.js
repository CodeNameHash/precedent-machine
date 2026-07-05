const ENUM_LABELS = {
  QUORUM_ABSENT: 'Quorum failure',
  INSUFFICIENT_VOTES: 'Insufficient votes',
  SUPPLEMENTAL_DISCLOSURE: 'Supplemental disclosure',
};

function isNil(value) {
  return value === null || value === undefined || value === '';
}

function numberValue(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.replace(/[$,%\s,]/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function humanizeEnum(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (ENUM_LABELS[raw]) return ENUM_LABELS[raw];
  return raw
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (ch) => ch.toUpperCase())
    .replace(/\bHsr\b/g, 'HSR')
    .replace(/\bDgcl\b/g, 'DGCL')
    .replace(/\bCvr\b/g, 'CVR');
}

function formatPercent(value, decimals) {
  const n = numberValue(value);
  if (n === null) return '';
  return `${(n * 100).toFixed(decimals)}%`;
}

function formatUsd(value, compact) {
  const n = numberValue(value);
  if (n === null) return '';
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (!compact) return `${sign}$${Math.round(abs).toLocaleString('en-US')}`;
  const units = [
    { suffix: 'T', value: 1_000_000_000_000 },
    { suffix: 'B', value: 1_000_000_000 },
    { suffix: 'M', value: 1_000_000 },
    { suffix: 'K', value: 1_000 },
  ];
  const unit = units.find((u) => abs >= u.value);
  if (!unit) return `${sign}$${Math.round(abs).toLocaleString('en-US')}`;
  const scaled = abs / unit.value;
  const decimals = scaled >= 10 ? 1 : 2;
  return `${sign}$${scaled.toFixed(decimals).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1')}${unit.suffix}`;
}

function plural(value, singular, pluralLabel) {
  return value === 1 ? singular : pluralLabel;
}

function formatDays(value, ctx = {}) {
  const n = numberValue(value);
  if (n === null) return '';
  const rounded = Math.round(n);
  const unit = ctx.unit === 'business_days' ? 'business day' : 'day';
  return `${rounded} ${plural(rounded, unit, `${unit}s`)}`;
}

function formatMonths(value) {
  const n = numberValue(value);
  if (n === null) return '';
  const rounded = Math.round(n);
  return `${rounded} ${plural(rounded, 'month', 'months')}`;
}

function formatDeadlineObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const days = numberValue(value.days);
  if (days === null) return '';
  const unit = value.unit === 'business_days' ? 'business days' : 'days';
  const trigger = value.trigger ? ` from ${String(value.trigger).replace(/[_-]+/g, ' ')}` : '';
  return `${Math.round(days)} ${unit}${trigger}`;
}

function formatTenderBasis(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const pct = numberValue(value.thresholdPct);
  const basis = value.basis ? humanizeEnum(value.basis).toLowerCase() : 'shares';
  if (pct === null) return basis;
  return `${pct}% of ${basis}`;
}

const formatters = {
  percent1dp: (value) => formatPercent(value, 1),
  percent2dp: (value) => formatPercent(value, 2),
  usd_short: (value) => formatUsd(value, true),
  usd_long: (value) => formatUsd(value, false),
  months_int: (value) => formatMonths(value),
  days_int: (value, ctx) => formatDays(value, ctx),
  enum_titlecase: (value, ctx = {}) => {
    if (isNil(value)) return '';
    const labels = ctx.enumLabels || {};
    return labels[value] || humanizeEnum(value);
  },
  enum_verbatim: (value) => (isNil(value) ? '' : String(value)),
  deadline_object: (value) => formatDeadlineObject(value),
  tender_basis: (value) => formatTenderBasis(value),
  quote: (value) => (isNil(value) ? '' : escapeHtml(value)),
};

function formatValue(formatterName, value, ctx = {}) {
  const formatter = formatterName && formatters[formatterName];
  if (!formatter) return isNil(value) ? '' : String(value);
  return formatter(value, ctx);
}

module.exports = {
  ENUM_LABELS,
  escapeHtml,
  humanizeEnum,
  formatValue,
  formatters,
};
