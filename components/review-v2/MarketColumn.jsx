// Review page market mode (?market=1). MarketRowsColumn renders the typed,
// row-level batch response. The older section and off-market exports remain
// for callers outside the main review page.

import { useEffect } from 'react';
import {
  formatStructuredMarketValue,
  matchingMoneyCohort,
  matchingSemanticCohort,
} from './marketSummaryHelpers';

const { prettifyEnumValue } = require('../review/shared');
// r19 (WP-A, numeric market cells): unit-aware formatting moved to its own
// dependency-light module (no React, no fetches — mirrors compareRowUnion.
// js/marketOffMarket.js's rule) so it has real behavioral test coverage
// under node:test (this file mixes in JSX and can't be dynamically
// imported there — see tests/mae-section-item-quote.test.js's header
// comment). Re-exported below for MarketColumn.jsx's own existing callers
// and for CompareColumn.jsx's market-cell rendering.
import {
  roundNum, formatMoney, formatNumericValueForUnit, formatNumericMarketSummary,
} from './marketNumericFormat';
import { attachTypedRowMarketContext, registerTypedRowMarketContext } from './rowMarketContext';

export { formatNumericValueForUnit, formatNumericMarketSummary };

const LAB = 'text-[9px] font-bold uppercase tracking-[0.14em] text-[#9A9A9A] mb-1.5';

const RAW_CODE_RE = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/;

function humanizeCode(raw) {
  const spaced = String(raw || '').replace(/[_-]+/g, ' ').toLowerCase().trim();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : String(raw || '');
}

// Same value treatment the query surface uses (bool -> Yes/No, >=1e6 ->
// money, enum codes -> the review page's own label path, raw UPPER_SNAKE
// never reaches the page).
export function formatMarketValue(value, fieldPath) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') {
    if (Math.abs(value) >= 1e6) return formatMoney(value);
    return roundNum(value);
  }
  const structured = formatStructuredMarketValue(value);
  if (structured) return structured;
  const pretty = prettifyEnumValue(fieldPath || '', String(value));
  if (typeof pretty === 'string' && RAW_CODE_RE.test(pretty)) return humanizeCode(pretty);
  return pretty;
}

// "Market norm" text off a baseline_stats object: numeric -> p25–p75 band;
// categorical -> the modal value. r19 (WP-A, off-market feed): `stats.unit`
// is a NEW, additive field the market-column-driven off-market entries
// carry (see CompareColumn.jsx's collectOffMarketEntries) -- when present,
// the band is unit-aware ("$20M–$60M" / "5–15 days") instead of bare
// numbers. The DEAL_TO_MARKET executor's own baseline_stats never carries
// `.unit`, so this is fully backward compatible with the pre-existing rows.
export function baselineText(stats, fieldPath) {
  if (!stats) return '—';
  if (stats.unit && (stats.p25 != null || stats.p75 != null)) {
    const lo = formatNumericValueForUnit(stats.p25, stats.unit);
    const hi = formatNumericValueForUnit(stats.p75, stats.unit);
    if (lo !== null && hi !== null) return `${lo}–${hi}`;
  }
  if (stats.p25 != null || stats.p75 != null) return `${roundNum(stats.p25)}–${roundNum(stats.p75)}`;
  if (Array.isArray(stats.distribution) && stats.distribution[0]) {
    const top = stats.distribution[0];
    const label = formatMarketValue(top.value, fieldPath);
    return top.count != null && stats.n ? `${label} (${top.count} of ${stats.n})` : label;
  }
  return '—';
}

function StatusNote({ children }) {
  return (
    <div className="border border-[#E0E0E0] bg-white px-3 py-4">
      <p className="mtx-meta-label text-[9px] tracking-[0.14em]">{children}</p>
    </div>
  );
}

function ErrorNote({ onRetry, children }) {
  return (
    <div className="border border-[#E0E0E0] bg-white px-3 py-4 flex items-center justify-between gap-2">
      <p className="mtx-meta-label text-[9px] tracking-[0.14em] text-[#B14E63]">{children}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#2F6DB5] hover:underline shrink-0"
          data-testid="market-column-retry"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}

// Per-section market cell. `entry` from useSectionMarketStats:
// { code, stats, loading, error }.
export function MarketSectionColumn({ entry, onRetry }) {
  if (!entry || !entry.code) return <StatusNote>No market metric is configured for this section.</StatusNote>;
  if (entry.loading) return <StatusNote>Loading market data…</StatusNote>;
  if (entry.error) return <ErrorNote onRetry={onRetry}>Market data unavailable right now — retry</ErrorNote>;
  const stats = entry.stats;
  if (!stats) return <StatusNote>The market metric returned no result.</StatusNote>;
  const featureSummary = Array.isArray(stats.featureSummary) ? stats.featureSummary : [];
  return (
    <div className="border border-[#E0E0E0] bg-white px-3 py-3" style={{ fontFamily: 'var(--mtx-sans)' }} data-testid="market-section-column">
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-[10px] text-[#6B6B6B]">Deals with this provision</span>
        <span className="text-[13px] font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {stats.dealsWithCode} of {stats.peerSetSize}
        </span>
      </div>
      {featureSummary.length ? (
        <div>
          <div className={LAB}>Common values across the corpus</div>
          {featureSummary.slice(0, 5).map((f) => (
            <div key={f.attribute} className="mb-2">
              <div className="text-[9px] text-[#6B6B6B] mb-1">{f.label}</div>
              <div className="flex flex-wrap gap-1">
                {(f.values || []).slice(0, 4).map((v) => (
                  <span
                    key={v.value}
                    className="border px-1.5 py-0.5 text-[8.5px]"
                    style={{ color: '#2F6DB5', borderColor: 'rgba(47,109,181,.25)', background: 'rgba(47,109,181,.08)' }}
                  >
                    {v.label} · {v.count}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[10px] text-[#9A9A9A]">No common-value summary captured for this provision type.</p>
      )}
    </div>
  );
}

function formatPercent(value, { proportion = false } = {}) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  const percent = proportion ? number * 100 : number;
  const digits = Math.abs(percent) < 0.1 ? 2 : Math.abs(percent) < 10 ? 1 : 0;
  return `${percent.toFixed(digits)}%`;
}

function formatUnit(unit, value) {
  const singular = Math.abs(Number(value)) === 1;
  const labels = {
    elapsed_hours: singular ? 'hour' : 'hours',
    business_days: singular ? 'business day' : 'business days',
    calendar_days: singular ? 'calendar day' : 'calendar days',
    days_equivalent: singular ? 'day' : 'days',
    months: singular ? 'month' : 'months',
    years: singular ? 'year' : 'years',
    percent: '%',
    multiplier: '×',
  };
  return labels[unit] || unit || '';
}

function formatNumeric(value, unit) {
  if (!Number.isFinite(Number(value))) return '—';
  const number = roundNum(value);
  const label = formatUnit(unit, value);
  if (label === '%' || label === '×') return `${number}${label}`;
  return label ? `${number} ${label}` : number;
}

function formatBasis(basis) {
  return ({
    equity_value: 'equity value',
    enterprise_value: 'enterprise value',
    headline_transaction_value: 'headline deal value',
  })[basis] || humanizeCode(basis);
}

function formatCadence(cadence) {
  return ({
    aggregate: 'aggregate',
    annual: 'annual',
    specified_year: 'specified-year',
    per_event: 'per-event',
    per_day: 'daily',
    per_month: 'monthly',
    one_time: 'one-time',
  })[cadence] || humanizeCode(cadence);
}

function coverageNote(result) {
  const coverage = result?.coverage;
  if (!coverage) return null;
  const notes = [];
  if (coverage.unknownCount) notes.push(`${coverage.unknownCount} unclassified`);
  if (coverage.valueUnknownCount) notes.push(`${coverage.valueUnknownCount} value${coverage.valueUnknownCount === 1 ? '' : 's'} not extracted`);
  if (coverage.excludedCount) notes.push(`${coverage.excludedCount} excluded as non-comparable`);
  return notes.length ? notes.join(' · ') : null;
}

function subjectText(result, kind, role = null) {
  const subject = result?.subject;
  if (!subject) return null;
  if (subject.status === 'unknown') return 'This deal: not extracted';
  if (subject.status === 'absent') {
    return `This deal: ${role === 'exception' || kind === 'multi_select' ? 'none specified' : 'not present'}`;
  }
  if (subject.status !== 'present') return null;
  if (kind === 'presence') return 'This deal: present';
  if (kind === 'money') {
    if (Number.isFinite(subject.percentOfDealValue)) {
      return `This deal: ${formatPercent(subject.percentOfDealValue)} of ${formatBasis(subject.dealValueBasis)}`;
    }
    if (!Number.isFinite(subject.rawUsd)) return 'This deal: value not extracted';
    return 'This deal: relative value unavailable';
  }
  if (kind === 'categorical') return subject.value == null ? 'This deal: value not extracted' : `This deal: ${formatMarketValue(subject.value)}`;
  if (kind === 'multi_select') {
    const values = Array.isArray(subject.values) ? subject.values : [];
    return values.length ? `This deal: ${values.map((value) => formatMarketValue(value)).join(', ')}` : 'This deal: value not extracted';
  }
  if (kind === 'numeric' || kind === 'duration') {
    return Number.isFinite(subject.value)
      ? `This deal: ${formatNumeric(subject.value, subject.semantics?.unit)}`
      : 'This deal: value not extracted';
  }
  return null;
}

function PresenceResult({ result }) {
  const present = result?.prevalence?.presentCount ?? result?.coverage?.presentCount ?? 0;
  const eligible = result?.prevalence?.eligibleCount ?? result?.coverage?.eligibleCount ?? 0;
  const rate = formatPercent(result?.prevalence?.rate, { proportion: true });
  return (
    <>
      <p className="text-[11px] font-bold text-[#1F1F1F]" style={{ fontVariantNumeric: 'tabular-nums' }}>
        Observed in {present} of {eligible} peer deals{rate ? ` · ${rate}` : ''}
      </p>
      {coverageNote(result) ? <p className="mt-1 text-[9px] text-[#8A8782]">{coverageNote(result)}</p> : null}
    </>
  );
}

function ValuesResult({ result, kind }) {
  const distribution = result?.distribution;
  if (!distribution) return <p className="text-[10px] text-[#8A8782]">Value distribution unavailable.</p>;

  if (kind === 'categorical' || kind === 'multi_select') {
    const values = Array.isArray(distribution.values) ? distribution.values.slice(0, 4) : [];
    return values.length ? (
      <div className="flex flex-wrap gap-1">
        {values.map((item) => (
          <span key={`${String(item.value)}-${item.count}`} className="border border-[#D8E2EF] bg-[#F3F7FB] px-1.5 py-0.5 text-[8.5px] text-[#2F6DB5]">
            {formatMarketValue(item.value)} · {item.count}/{distribution.denominatorCount}
          </span>
        ))}
      </div>
    ) : <p className="text-[10px] text-[#8A8782]">Values not yet structured.</p>;
  }

  if (kind === 'money') {
    const subjectBasis = result?.subject?.dealValueBasis;
    const subjectSemantics = result?.subject?.semantics;
    const cohort = matchingMoneyCohort(distribution, subjectBasis, subjectSemantics);
    const relative = cohort?.percent?.stats;
    const hasCadence = Boolean(subjectSemantics?.cadence);
    const separateCohorts = (distribution?.normalised?.cohorts || [])
      .filter((candidate) => candidate !== cohort && candidate?.semantics?.cadence)
      .slice(0, 3);
    return (
      <div className="space-y-0.5 text-[10px] text-[#1F1F1F]">
        {relative ? (
          <p>
            Peer median {formatPercent(relative.median)} of {formatBasis(cohort.basis)}
            {hasCadence ? ` · ${formatCadence(cohort.semantics?.cadence)} basis` : ''}
            {' · '}IQR {formatPercent(relative.p25)}–{formatPercent(relative.p75)} · n={relative.n}
          </p>
        ) : (
          <p className="text-[#8A8782]">
            {hasCadence ? 'No peer percentage cohort with the same deal-value basis and cadence.' : 'No same-basis percentage cohort yet.'}
          </p>
        )}
        {separateCohorts.length ? (
          <p className="text-[8.5px] text-[#8A8782]">
            Kept separate: {separateCohorts.map((candidate) => (
              `${formatCadence(candidate.semantics.cadence)}, ${formatBasis(candidate.basis)} (n=${candidate.percent?.stats?.n || 0})`
            )).join('; ')}
          </p>
        ) : null}
      </div>
    );
  }

  const cohort = matchingSemanticCohort(distribution, result?.subject?.semantics);
  const stats = cohort?.stats;
  if (!stats) return <p className="text-[10px] text-[#8A8782]">Comparable values not yet extracted.</p>;
  const unit = cohort.semantics?.unit;
  return (
    <p className="text-[10px] text-[#1F1F1F]">
      Peer median {formatNumeric(stats.median, unit)} · IQR {formatNumeric(stats.p25, unit)}–{formatNumeric(stats.p75, unit)} · n={stats.n}
    </p>
  );
}

function MetricResult({ spec, result, displayLabel = null }) {
  if (!result) return <p className="text-[10px] text-[#8A8782]">Awaiting a typed market result.</p>;
  if (result.state === 'not_comparable') {
    return (
      <div>
        {displayLabel ? <p className="text-[9px] font-bold text-[#6B6B6B] mb-0.5">{displayLabel}</p> : null}
        <p className="text-[10px] text-[#8A642E]">Not comparable: {result.reason?.detail || 'no safe denominator is defined.'}</p>
      </div>
    );
  }
  if (result.state === 'error') return <p className="text-[10px] text-[#B14E63]">Metric failed: {result.error?.message || 'unknown error'}</p>;
  const kind = spec?.comparison?.kind || result.distribution?.kind;
  const subject = subjectText(result, kind, spec?.presentation?.role);
  return (
    <div>
      {displayLabel ? <p className="text-[9px] font-bold text-[#6B6B6B] mb-0.5">{displayLabel}</p> : null}
      {subject ? <p className="text-[9.5px] text-[#2F6DB5] mb-0.5">{subject}</p> : null}
      {kind === 'presence' ? <PresenceResult result={result} /> : <ValuesResult result={result} kind={kind} />}
      {kind !== 'presence' && coverageNote(result) ? <p className="mt-1 text-[9px] text-[#8A8782]">{coverageNote(result)}</p> : null}
    </div>
  );
}

function isPrevalenceSpec(spec) {
  if (spec?.presentation?.role) return spec.presentation.role === 'prevalence';
  return spec?.comparison?.kind === 'presence';
}

function metricDisplayLabel(spec, rowLabel) {
  let label = String(spec?.label || '').trim();
  const parent = String(rowLabel || '').trim();
  const displayParent = parent.replace(/^(?:Company|Parent):\s*/i, '').trim();
  if (!label) return null;
  const prefix = [parent, displayParent]
    .filter(Boolean)
    .find((candidate) => label.toLowerCase().startsWith(candidate.toLowerCase()));
  if (prefix) {
    label = label.slice(prefix.length).replace(/^\s*(?:[:\-–—]|prevalence\b)\s*/i, '').trim();
  }
  if (!label || [parent, displayParent].some((candidate) => label.toLowerCase() === candidate.toLowerCase())) return null;
  return label;
}

function hasUsableMetricResult(spec, result) {
  if (!result || result.state === 'error' || result.state === 'not_comparable') return false;
  if (result?.subject?.status === 'absent') return true;
  const kind = spec?.comparison?.kind || result?.distribution?.kind;
  if (kind === 'presence') {
    return Number.isFinite(result?.prevalence?.eligibleCount)
      || Number.isFinite(result?.coverage?.eligibleCount);
  }
  if (kind === 'categorical' || kind === 'multi_select') {
    return Boolean(result?.distribution?.values?.length)
      || result?.subject?.value != null
      || Boolean(result?.subject?.values?.length);
  }
  if (kind === 'money') {
    return Boolean(result?.distribution?.raw?.stats)
      || Boolean(result?.distribution?.normalised?.cohorts?.some((cohort) => cohort?.percent?.stats))
      || Number.isFinite(result?.subject?.rawUsd);
  }
  return Boolean(result?.distribution?.cohorts?.some((cohort) => cohort?.stats))
    || Number.isFinite(result?.subject?.value);
}

function PrevalenceFooter({ result }) {
  const present = result?.prevalence?.presentCount ?? result?.coverage?.presentCount;
  const eligible = result?.prevalence?.eligibleCount ?? result?.coverage?.eligibleCount;
  if (!Number.isFinite(present) || !Number.isFinite(eligible)) return null;
  const rate = formatPercent(result?.prevalence?.rate, { proportion: true });
  return (
    <p className="pt-1 border-t border-[#EDEDEC] text-[8.5px] text-[#8A8782]" style={{ fontVariantNumeric: 'tabular-nums' }}>
      Term present in {present}/{eligible} peer deals{rate ? ` · ${rate}` : ''}
    </p>
  );
}

function LegacyMarketSummary({ summary }) {
  if (!summary) return null;
  if (summary.kind === 'numeric') {
    const formatted = formatNumericMarketSummary(summary);
    if (!formatted) return null;
    return (
      <div>
        <p className="text-[11px] font-semibold text-[#1F1F1F]">{formatted.headline}</p>
        {formatted.range ? <p className="mt-0.5 text-[9px] text-[#8A8782]">Range {formatted.range}</p> : null}
      </div>
    );
  }
  const values = Array.isArray(summary.values) ? summary.values : [];
  if (!values.length) return null;
  const [top, ...rest] = values;
  const denominator = top.denominator ?? summary.denominator ?? summary.total;
  return (
    <div>
      <p className="text-[11px] font-semibold text-[#1F1F1F]">
        {top.label || formatMarketValue(top.value)}{Number.isFinite(top.count) ? ` · ${top.count}${Number.isFinite(denominator) ? `/${denominator}` : ''}` : ''}
      </p>
      {rest.length ? <p className="mt-0.5 text-[9px] text-[#8A8782]">{rest.slice(0, 2).map((item) => `${item.label || formatMarketValue(item.value)} · ${item.count}`).join(' · ')}</p> : null}
    </div>
  );
}

export function MarketMetricCell({ resolution, data, onRetry = null, fallbackSummary = null }) {
  useEffect(() => {
    registerTypedRowMarketContext(resolution, data, fallbackSummary);
  }, [resolution, data, fallbackSummary]);
  if (!resolution) return fallbackSummary ? <LegacyMarketSummary summary={fallbackSummary} /> : <p className="text-[10px] text-[#8A8782]">Market metric not configured.</p>;
  const responseRow = data?.byRow?.[resolution.rowKey];
  const rowFailed = Array.isArray(data?.failedRowKeys) && data.failedRowKeys.includes(resolution.rowKey);
  if (data?.loading && !responseRow && !fallbackSummary) return <p className="text-[10px] text-[#8A8782]">Loading comparison…</p>;
  if (data?.error && !responseRow && !fallbackSummary) return <ErrorNote onRetry={onRetry}>Market comparison unavailable</ErrorNote>;
  if (rowFailed && !responseRow) {
    return (
      <div className="space-y-2">
        {fallbackSummary ? <LegacyMarketSummary summary={fallbackSummary} /> : null}
        <ErrorNote onRetry={onRetry}>Detailed market terms could not be loaded</ErrorNote>
      </div>
    );
  }
  const substantive = resolution.metrics.filter((spec) => !isPrevalenceSpec(spec));
  const prevalence = resolution.metrics.filter(isPrevalenceSpec);
  const availableSubstantive = substantive.filter((spec) => hasUsableMetricResult(spec, responseRow?.metrics?.[spec.metricKey]));
  const availablePrevalence = prevalence.filter((spec) => hasUsableMetricResult(spec, responseRow?.metrics?.[spec.metricKey]));
  return (
    <div
      ref={(node) => attachTypedRowMarketContext(node, resolution, data, fallbackSummary)}
      className="space-y-2"
      data-testid="market-cell"
      data-market-row-key={resolution.rowKey}
      data-market-provision-codes={resolution.metrics[0]?.cohort?.provisionCodes?.join(',') || undefined}
    >
      {availableSubstantive.map((spec) => (
        <MetricResult
          key={spec.metricKey}
          spec={spec}
          result={responseRow?.metrics?.[spec.metricKey]}
          displayLabel={metricDisplayLabel(spec, resolution.label)}
        />
      ))}
      {!availableSubstantive.length && fallbackSummary ? <LegacyMarketSummary summary={fallbackSummary} /> : null}
      {!availableSubstantive.length && !availablePrevalence.length && !fallbackSummary ? <p className="text-[10px] text-[#8A8782]">Term detail is not yet structured.</p> : null}
      {availablePrevalence.map((spec) => (
        <PrevalenceFooter key={spec.metricKey} result={responseRow?.metrics?.[spec.metricKey]} />
      ))}
      {resolution.errors?.length ? <p className="text-[9px] text-[#B14E63]">Metric contract needs attention.</p> : null}
    </div>
  );
}

export function MarketRowsColumn({ section, data, onRetry }) {
  const rows = section?.rows || [];
  const resolvedCount = rows.filter((row) => data?.byRow?.[row.rowKey]).length;
  return (
    <div className="border border-[#E0E0E0] bg-white" style={{ fontFamily: 'var(--mtx-sans)' }} data-testid="market-rows-column">
      <div className="px-3 py-2 border-b border-[#E0E0E0] flex items-center justify-between gap-2">
        <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#6B6B6B]">Row coverage</span>
        <span className="text-[9px] text-[#6B6B6B]" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {data?.loading ? `${rows.length} rows loading` : `${resolvedCount}/${rows.length} resolved`}
        </span>
      </div>
      {data?.error ? <ErrorNote onRetry={onRetry}>Market comparison unavailable: {data.error}</ErrorNote> : null}
      {!rows.length ? <StatusNote>No extracted rows require a market comparison.</StatusNote> : null}
      <div>
        {rows.map((row) => (
            <div
              key={row.rowKey}
              className="px-3 py-3 border-b border-[#EDEDEC] last:border-b-0"
            >
              <p className="text-[10.5px] font-bold text-[#1F1F1F] mb-1.5">{row.label}</p>
              <MarketMetricCell resolution={row} data={data} onRetry={onRetry} />
            </div>
        ))}
      </div>
    </div>
  );
}

// "Off-market terms" — review-style section at the top of the section
// list. `data` from useDealToMarket: { rows, loading, error }. Renders
// nothing at all when resolved-and-empty (per spec: "if none, hide it").
export function OffMarketSection({ data }) {
  if (!data) return null;
  const { rows, loading, error } = data;
  if (!loading && !error && (!rows || !rows.length)) return null;
  return (
    <section id="sec-off-market" className="scroll-mt-28" data-testid="off-market-section">
      <details open className="mtx-section">
        <summary
          className="flex items-center gap-2.5 pb-2 border-b-2 border-black cursor-pointer select-none"
          style={{ listStyle: 'none' }}
        >
          <span className="w-2.5 h-2.5" style={{ background: '#B14E63', borderRadius: '9999px' }} />
          <h2 className="text-base font-bold tracking-tight text-[#1F1F1F]">Off-market terms</h2>
          <span aria-hidden="true" className="mtx-section-caret ml-auto text-[10px] text-[#6B6B6B]">▾</span>
        </summary>
        <div className="mt-4">
          {loading ? (
            <StatusNote>Comparing this deal to the market…</StatusNote>
          ) : error ? (
            <ErrorNote onRetry={data.retry}>Market data unavailable right now — retry</ErrorNote>
          ) : (
            <div className="rounded border border-border bg-white shadow-sm overflow-x-auto">
              <table className="w-full text-xs" style={{ fontFamily: 'var(--mtx-sans)' }}>
                <thead>
                  <tr className="border-b border-[#E0E0E0]">
                    <th className="text-left px-3 py-2 mtx-meta-label text-[9px] tracking-[0.14em] font-bold">Term</th>
                    <th className="text-left px-3 py-2 mtx-meta-label text-[9px] tracking-[0.14em] font-bold">This deal</th>
                    <th className="text-left px-3 py-2 mtx-meta-label text-[9px] tracking-[0.14em] font-bold">Market norm</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={`${row.provision_type}-${row.field_path}`}
                      className="border-b border-[#EDEDEC] last:border-b-0 align-top"
                      style={row.status === 'UNUSUAL' ? { background: 'rgba(177, 78, 99, 0.06)' } : { background: 'rgba(168, 122, 46, 0.06)' }}
                    >
                      <td className="px-3 py-2 text-[#1F1F1F]">{row.field_label}</td>
                      <td className="px-3 py-2 mtx-mono font-bold text-[#1F1F1F]">{formatMarketValue(row.deal_value, row.field_path)}</td>
                      <td className="px-3 py-2 mtx-mono text-[#6B6B6B]">{baselineText(row.baseline_stats, row.field_path)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </details>
    </section>
  );
}
