// Review page compare mode (Ben: "just the normal deal review page but with
// an extra column in the main review area for the added deal(s) — literally
// just bold it on the side"). One narrow column per compared deal beside
// each primary section, rendering the SAME section config through the SAME
// ProvisionTable / MaeSection / DefinitionsSection / ElectionCard the
// primary column uses — read-only (no card selection: the corpus sidebar
// stays scoped to the primary deal).

import { Fragment, useMemo, useState } from 'react';
import Link from 'next/link';
import ProvisionTable, { FULL_TEXT_COLUMNS } from '../review/ProvisionTable';
import * as ProvisionTablePrimitives from '../review/primitives/ProvisionTablePrimitives';
import { buildCardIndex, resolveRowCard, resolveRowFocus, isFragmentDefinedTerm } from './provisionIndexHelpers.js';
import { getCitableValue, isCitableValue } from '../../lib/citable.js';
import MaeSection from './MaeSection';
import ElectionCard from './ElectionCard';
import { DefinitionsSection } from './ProvisionIndex';
import { deriveElectionSummary, EMPTY_REVIEW_DEAL, MAE_SECTION_ID } from './sectionList';
import { unionRows, rowFamilyLabel, unionDefinitions } from './compareRowUnion';
// r19 (WP-A, numeric market cells + off-market feed): marketSummaryForRow/
// isRowOffMarket moved to their own dependency-light module (no React, no
// fetches) so the off-market classification rule has real behavioral test
// coverage under node:test (see tests/market-off-market.test.js) — this
// file just calls in, it no longer holds the decision logic itself.
import { marketSummaryForRow, isRowOffMarket } from './marketOffMarket';
import { formatNumericMarketSummary, formatNumericValueForUnit } from './marketNumericFormat';

const CONSIDERATION_SECTION_ID = 'consideration-hero';

/* ── r15 addendum (Ben): compare-mode masthead ──────────────────────────
   In compare view the top masthead just NAMES the deals being compared —
   "Skechers / 3G Capital vs QXO / Beacon" — and does NOT show the primary
   deal's metric strip (one deal's announced/value/consideration up top
   reads as if it described both deals). Keeps the same `header.mtx-masthead`
   element the page's ResizeObserver measures for the sticky-nav offset, and
   keeps the Full Merger Agreement toggle (it opens the PRIMARY deal's
   agreement — the compared deals' agreements live behind their own column
   headers' links) plus an explicit "Exit compare" back to the plain review
   page. Normal (non-compare) review pages keep DealHeader unchanged. */
export function CompareMasthead({
  primaryName,
  primaryHref,
  comparedColumns,
  view,
  onToggleView,
  hasAgreementText,
}) {
  const inAgreement = view === 'agreement';
  const names = [
    { key: 'primary', label: primaryName || 'This deal', href: null },
    ...(comparedColumns || []).map((col, i) => ({
      key: col.id || `cmp-${i}`,
      label: col.loading ? 'Loading…' : (col.name || `Compared deal ${i + 1}`),
      href: col.id ? `/review/${col.id}` : null,
    })),
  ];
  return (
    <header className="mtx-masthead sticky top-0 z-30 bg-white border-b border-[#E0E0E0]" data-testid="compare-masthead">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 lg:px-8 py-3 md:py-0 md:h-[72px]">
        <div className="min-w-0">
          <div className="mtx-meta-label text-[9px] tracking-[0.14em]">COMPARING</div>
          <div className="flex flex-wrap items-baseline gap-x-2 mt-0.5 min-w-0">
            {names.map((n, i) => (
              <Fragment key={n.key}>
                {i > 0 ? (
                  <span className="text-[11px] font-medium text-[#6B6B6B] shrink-0" aria-hidden="true">vs</span>
                ) : null}
                {n.href ? (
                  <Link
                    href={n.href}
                    className="min-w-0 truncate text-base lg:text-lg font-bold leading-tight tracking-tight text-[#1F1F1F] hover:underline"
                  >
                    {n.label}
                  </Link>
                ) : (
                  <span className="min-w-0 truncate text-base lg:text-lg font-bold leading-tight tracking-tight text-[#1F1F1F]">
                    {n.label}
                  </span>
                )}
              </Fragment>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-auto">
          {primaryHref ? (
            <Link
              href={primaryHref}
              className="mtx-meta-label text-[9px] tracking-[0.12em] hover:text-[#1F1F1F] whitespace-nowrap"
              data-testid="compare-exit"
            >
              ← EXIT COMPARE
            </Link>
          ) : null}
          {hasAgreementText ? (
            <button
              type="button"
              onClick={onToggleView}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-[#1F1F1F] text-[10px] font-bold uppercase tracking-wider text-[#1F1F1F] hover:bg-[#1F1F1F] hover:text-white transition whitespace-nowrap"
            >
              {inAgreement ? '← Back to Summary' : 'Full Merger Agreement →'}
            </button>
          ) : (
            <button
              type="button"
              disabled
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-[#E0E0E0] text-[10px] font-bold uppercase tracking-wider text-[#6B6B6B] opacity-60 cursor-not-allowed whitespace-nowrap"
            >
              Full Merger Agreement <span className="normal-case font-medium tracking-normal">(no source text)</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

// Bold column header band — styled like the section title bars' meta labels
// (10px, tracking) but font-weight 700 with the deal name in sentence case.
// The Market column passes `uppercase` for its all-caps "MARKET" band.
export function ColumnHeaderBand({ label, href = null, uppercase = false }) {
  const text = (
    <span
      className={`text-[10px] font-bold tracking-[0.08em] text-[#1F1F1F] ${uppercase ? 'uppercase tracking-[0.14em]' : ''}`}
    >
      {label}
    </span>
  );
  return (
    <div className="flex items-center pb-2 mb-4 border-b-2 border-black" data-testid="compare-column-band">
      {href ? (
        <Link href={href} className="hover:underline min-w-0 truncate">{text}</Link>
      ) : text}
    </div>
  );
}

function EmptyBox({ children }) {
  return (
    <div className="border border-[#E0E0E0] bg-white px-3 py-4">
      <p className="mtx-meta-label text-[9px] tracking-[0.14em]">{children}</p>
    </div>
  );
}

// C (deal-to-market/compare robustness, Supabase-degraded incident): a
// failed compared-deal fetch used to be a dead end -- "Deal unavailable: …"
// with no way to try again short of reloading the whole review page. Now
// that compareData.js's useComparedDeals bounds the fetch with a timeout
// and exposes retry(), give the column a working retry affordance.
function ErrorBox({ onRetry, children }) {
  return (
    <div className="border border-[#E0E0E0] bg-white px-3 py-4">
      <p className="mtx-meta-label text-[9px] tracking-[0.14em] text-[#B14E63] mb-1.5">{children}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#2F6DB5] hover:underline"
          data-testid="compare-column-retry"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}

function sectionRowCount(section, reviewDeal) {
  if (!section || !reviewDeal) return 0;
  if (section.id === '__definitions') return (reviewDeal.definitions || []).length;
  if (!section.config || typeof section.config.selectRows !== 'function') return 0;
  try {
    const rows = section.config.selectRows(reviewDeal);
    return Array.isArray(rows) ? rows.length : 0;
  } catch {
    return 0;
  }
}

// One compared-deal cell for one section. `column` comes straight from
// useComparedDeals: { id, name, reviewDeal, loading, error }.
export default function CompareSectionColumn({ section, column, onRetry }) {
  if (!column) return null;
  if (column.loading) return <EmptyBox>Loading deal…</EmptyBox>;
  if (column.error) return <ErrorBox onRetry={onRetry}>Deal data unavailable right now — retry</ErrorBox>;
  const reviewDeal = column.reviewDeal || EMPTY_REVIEW_DEAL;
  if (sectionRowCount(section, reviewDeal) === 0) {
    // Standard empty state: the section box exists (alignment holds) but
    // says plainly that this deal has nothing extracted here.
    return <EmptyBox>No extracted provisions for this section.</EmptyBox>;
  }
  if (section.id === '__definitions') {
    return <DefinitionsSection definitions={reviewDeal.definitions} />;
  }
  if (section.id === MAE_SECTION_ID) {
    return <MaeSection config={section.config} reviewDeal={reviewDeal} />;
  }
  const election = section.id === CONSIDERATION_SECTION_ID ? deriveElectionSummary(reviewDeal) : null;
  return (
    <>
      {election ? <ElectionCard election={election} /> : null}
      <ProvisionTable config={section.config} reviewDeal={reviewDeal} isEdit={false} />
    </>
  );
}

/* ── r14: unified compare table ─────────────────────────────────────────
   Ben: "Use the same left column rows from the table and don't repeat
   them! It should just be: Closing | Deal 1 answer | Deal 2 answer. If a
   row doesn't exist for one deal just say 'Not extracted for this deal'."

   One table per section: the label column is the UNION of row identities
   across the primary + compared deals (primary's row order first, then
   compared-only rows appended in their own order — see compareRowUnion.js
   for the identity rule), and each deal contributes one answer column.
   Answer cells reuse the SAME config-produced renderCells each deal's own
   table would have shown (values, pills); columns ProvisionTable relocates
   behind "See provision" (FULL_TEXT_COLUMNS) get the same treatment here,
   per deal. Grouped configs (conditions / termination rights / IOC /
   no-shop, whose single 'body' column renders GroupedSubRows) are unified
   at the sub-row level, with the group bands as full-width divider rows. */

const NOT_EXTRACTED_COPY = 'Not extracted for this deal';

function Muted({ children }) {
  return <span className="text-[11px] italic text-[#9A9A9A]">{children}</span>;
}

function NotExtractedCell() {
  return (
    <span className="text-[11px] italic text-[#9A9A9A]" data-testid="compare-not-extracted">
      {NOT_EXTRACTED_COPY}
    </span>
  );
}

// Mirrors ProvisionTablePrimitives' private textValue() for grouped
// sub-row values (that helper isn't exported; a React element guard is
// added since we can hit arbitrary row.value shapes here).
function textValueLocal(value) {
  const inner = isCitableValue(value) ? getCitableValue(value) : value;
  if (inner === null || inner === undefined || inner === '') return null;
  if (typeof inner === 'boolean') return inner ? 'Yes' : 'No';
  if (Array.isArray(inner)) return inner.map(textValueLocal).filter(Boolean).join(', ');
  if (typeof inner === 'object') {
    if (inner.$$typeof) return null; // React element -- render via children path, not as text
    return inner.label || inner.text || inner.code || inner.value || null;
  }
  return String(inner);
}

function safeRows(config, reviewDeal) {
  if (!config || typeof config.selectRows !== 'function') return [];
  try {
    const rows = config.selectRows(reviewDeal);
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function renderCellSafe(column, row, ctx) {
  if (!column || typeof column.renderCell !== 'function') return null;
  try {
    return column.renderCell(row, ctx);
  } catch {
    return null;
  }
}

// Grouped-config detection: the conditions / termination-rights / IOC /
// nosol configs all render ONE wrapper row through ONE 'body' column whose
// renderCell returns a GroupedSubRows element -- the groups live on that
// element's props. Returns the groups array, or null when this config
// isn't grouped-shaped (flat multi-column configs).
function extractGroupsForDeal(config, rows, ctx) {
  const cols = Array.isArray(config.columns) ? config.columns : [];
  if (cols.length !== 1 || rows.length !== 1) return null;
  const node = renderCellSafe(cols[0], rows[0], ctx);
  if (node && node.props && Array.isArray(node.props.groups)) return node.props.groups;
  return null;
}

// Same fallback ProvisionTable.jsx's generic path uses when no full-text
// column produced expansion content: an explicit row.evidence string, else
// the backing card's own quoted text.
function unifiedFallbackEvidence(row) {
  if (typeof row?.evidence === 'string' && row.evidence.trim()) return row.evidence.trim();
  const card = row?.sourceCard || row?.card || null;
  const text = String(card?.primary_quote || card?.region_full_text || '').trim();
  return text || null;
}

// r18 item 5 (Ben, "deal vs market as unified table"): the market column
// is headed "MARKET — N deals" -- bold, uppercase, like a compared deal's
// band -- N being the corpus peer-set size behind this section's stats
// (never the count of deals actually carrying the code -- that's the
// per-value denominator inside each cell, see MarketCell below).
function marketColumnLabel(marketColumn) {
  const n = marketColumn && marketColumn.stats && Number.isFinite(marketColumn.stats.peerSetSize)
    ? marketColumn.stats.peerSetSize
    : null;
  return n !== null ? `MARKET — ${n} deals` : 'MARKET';
}

function DealNameHeader({ deal, onRetry }) {
  if (deal.isMarket) {
    return (
      <th
        className="px-3 py-2 text-left align-bottom border-b-2 border-black"
        style={{ minWidth: 230 }}
        data-testid="unified-compare-market-header"
      >
        <span className="text-[10px] font-bold tracking-[0.14em] uppercase text-[#1F1F1F]">{deal.name}</span>
        {deal.loading ? (
          <div className="mtx-meta-label text-[9px] tracking-[0.14em] mt-0.5 font-normal">Loading market data…</div>
        ) : null}
        {deal.error ? (
          <div className="text-[9px] font-normal text-[#B14E63] mt-0.5">
            Market data unavailable{onRetry ? (
              <>
                {' — '}
                <button
                  type="button"
                  onClick={onRetry}
                  className="font-bold uppercase tracking-[0.1em] text-[#2F6DB5] hover:underline"
                  data-testid="market-column-retry"
                >
                  Retry
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </th>
    );
  }
  const text = (
    <span className="text-[10px] font-bold tracking-[0.08em] text-[#1F1F1F]">{deal.name}</span>
  );
  return (
    <th
      className="px-3 py-2 text-left align-bottom border-b-2 border-black"
      style={{ minWidth: 230 }}
      data-testid="unified-compare-deal-header"
    >
      {deal.href ? <Link href={deal.href} className="hover:underline">{text}</Link> : text}
      {deal.loading ? (
        <div className="mtx-meta-label text-[9px] tracking-[0.14em] mt-0.5 font-normal">Loading deal…</div>
      ) : null}
      {deal.error ? (
        <div className="text-[9px] font-normal text-[#B14E63] mt-0.5">
          Deal data unavailable —{' '}
          <button
            type="button"
            onClick={onRetry}
            className="font-bold uppercase tracking-[0.1em] text-[#2F6DB5] hover:underline"
            data-testid="compare-column-retry"
          >
            Retry
          </button>
        </div>
      ) : null}
    </th>
  );
}

// marketSummaryForRow: moved to marketOffMarket.js (imported above) — r18
// item 5's original resolution rule, unchanged: a union row's matching
// corpus-stats featureSummary entry via its own featureKeys, the same
// per-row attribute scoping several configs already thread for
// ClauseSidebar (e.g. ioc-exceptions.config.js's renderNegativeRow/
// exceptionsRow). Reads ONLY the existing per-SECTION corpus-stats-batch
// payload (useSectionMarketStats in compareData.js) -- no new query.

// r19 (WP-A, numeric market cells): row.value's numeric extraction --
// mirrors textValueLocal's citable-unwrap but returns a finite number
// (from a plain number, or a rich amount-object's .amount/.value) rather
// than text. Returns null (never a guess) for anything else, so a
// non-numeric/uncitable value simply never resolves a numeric market cell
// or off-market flag.
function numericValueLocal(value) {
  const inner = isCitableValue(value) ? getCitableValue(value) : value;
  if (typeof inner === 'number' && Number.isFinite(inner)) return inner;
  if (inner && typeof inner === 'object' && !Array.isArray(inner) && !inner.$$typeof) {
    for (const key of ['amount', 'value']) {
      const raw = inner[key];
      if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    }
  }
  return null;
}

// Market cell (r19 extends r18 item 5 to numeric attributes): categorical
// -> modal value as a headline pill with its count ("Superior Proposal
// standard — 22 of 31"), up to 2 runner-ups small/muted; numeric -> median
// headline ("$45M", "· 3.1% of deal value" suffix when a percent-of-deal
// distribution exists, "N months before signing" for deal-relative
// look-back fields) with the min–max range muted beneath (see
// MarketColumn.jsx's formatNumericMarketSummary). "No market data" (muted,
// never a guess) when this row carries no featureKeys, none resolve
// against the section's featureSummary, or the resolved numeric summary
// has no median (an empty numeric pool).
function MarketCell({ row, marketColumn }) {
  if (!marketColumn) return <Muted>—</Muted>;
  if (marketColumn.loading) return <Muted>Loading market data…</Muted>;
  if (marketColumn.error) return <Muted>Market data unavailable</Muted>;
  const summary = marketSummaryForRow(row, marketColumn);
  if (!summary) return <Muted>No market data</Muted>;
  if (summary.kind === 'numeric') {
    const cell = formatNumericMarketSummary(summary);
    if (!cell) return <Muted>No market data</Muted>;
    return (
      <div data-testid="market-cell">
        <div className="font-medium text-ink text-[11px]">{cell.headline}</div>
        {cell.range ? <div className="mt-1 text-[9.5px] text-inkFaint">{cell.range}</div> : null}
      </div>
    );
  }
  if (!Array.isArray(summary.values) || !summary.values.length) {
    return <Muted>No market data</Muted>;
  }
  const [top, ...rest] = summary.values;
  const denom = summary.total || null;
  return (
    <div data-testid="market-cell">
      <div className="font-medium text-ink text-[11px]">
        {top.label}{denom ? ` — ${top.count} of ${denom}` : ` (${top.count})`}
      </div>
      {rest.length ? (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {rest.slice(0, 2).map((v) => (
            <span key={v.value} className="text-[9.5px] text-inkFaint">{v.label} · {v.count}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// Off-market marker (r18 item 5, extended r19 to numeric rows AND grouped
// rows): THIS deal's own headline value differs from the market's modal
// value (coded) or falls outside the corpus p25–p75 band (numeric) --
// subtle marker on the deal's own cell, never a guess (no market summary,
// or no captured own value, never gets marked). r19 also flags grouped
// (IOC-style) sub-rows: those carry a plain `row.value`/featureKeys same as
// flat rows once unpacked to the sub-row level (see groupedBody below) --
// r18's "grouped rows never get flagged" limitation was about the WRAPPER
// row (whose single `children` element has no single own value), not the
// sub-rows themselves.
function isOffMarketRow(row, marketColumn) {
  const summary = marketSummaryForRow(row, marketColumn);
  if (!summary) return false;
  if (summary.kind === 'numeric') return isRowOffMarket({ summary, ownNum: numericValueLocal(row.value) });
  return isRowOffMarket({ summary, ownText: textValueLocal(row.value) });
}

function OffMarketBadge() {
  return (
    <span
      title="Differs from market norm"
      data-testid="off-market-badge"
      className="ml-1.5 inline-block w-[7px] h-[7px] rounded-full align-middle"
      style={{ background: '#A87A2E' }}
    />
  );
}

// r19 (WP-A, "off-market feed"): aggregates the PRIMARY deal's own rows for
// one section (flat + grouped sub-rows, same off-market rule the market
// cell's badge uses) into candidate entries for the "Off-market terms" top
// section (pages/review/[id].js's OffMarketSection wiring) — the badge and
// the feed must never diverge on which rows count as off-market, so this
// reuses isOffMarketRow/marketSummaryForRow rather than a second rule.
// Returns entries shaped for OffMarketSection's table (field_path/
// field_label/deal_value/baseline_stats/status/provision_type) — callers
// apply compareData.js's isCommercialField exclusion themselves (kept
// exactly as-is per the r19 spec; this function does not pre-filter it so
// that exclusion stays the single source of truth in one place).
export function collectOffMarketEntries(section, reviewDeal, marketColumn) {
  if (!section || !section.config || !marketColumn || marketColumn.loading || marketColumn.error || !marketColumn.stats) return [];
  const config = section.config;
  const rows = safeRows(config, reviewDeal);
  if (!rows.length) return [];
  const ctx = {
    reviewDeal, config, primitives: ProvisionTablePrimitives, isEdit: false,
    resolveCard: () => null, onSelectCard: null, selectedCardId: null,
  };
  const groups = rows.length === 1 ? extractGroupsForDeal(config, rows, ctx) : null;
  const candidateRows = Array.isArray(groups)
    ? groups.flatMap((g) => (g && Array.isArray(g.rows) ? g.rows : []))
    : rows;
  const isConsideration = section.id === CONSIDERATION_SECTION_ID;
  const entries = [];
  for (const row of candidateRows) {
    if (!row) continue;
    const summary = marketSummaryForRow(row, marketColumn);
    if (!summary) continue;
    const isNumeric = summary.kind === 'numeric';
    const ownNum = isNumeric ? numericValueLocal(row.value) : null;
    const ownText = isNumeric ? null : textValueLocal(row.value);
    if (!isRowOffMarket({ summary, ownNum, ownText })) continue;
    const label = (typeof row.label === 'string' && row.label.trim()) ? row.label : summary.label;
    const fieldPath = (Array.isArray(row.featureKeys) && row.featureKeys[0]) || summary.attribute;
    const dealValue = isNumeric ? formatNumericValueForUnit(ownNum, summary.unit) : ownText;
    const baselineStats = isNumeric
      ? { p25: summary.p25, p75: summary.p75, unit: summary.unit }
      : { distribution: [{ value: summary.values[0].value, count: summary.values[0].count }], n: summary.total };
    entries.push({
      field_path: fieldPath,
      field_label: label,
      deal_value: dealValue,
      baseline_stats: baselineStats,
      status: 'OFF_MARKET',
      provision_type: isConsideration ? 'CONSIDERATION' : undefined,
    });
  }
  return entries;
}

// r18 item 2 (Ben): "Definitions join the unified format (currently
// side-by-side)". Same union-table shape as UnifiedCompareSection but keyed
// by normalized defined term rather than a config row identity (see
// compareRowUnion.js's unionDefinitions -- alphabetical, matched terms
// aligned, "Not extracted for this deal" for gaps) -- Definitions has no
// ProvisionTable config/columns to drive UnifiedCompareSection's generic
// row-rendering path, so this is its own small component reusing the same
// primitives (Muted / NotExtractedCell / DealNameHeader-style header).
function filteredDefinitions(definitions) {
  return (definitions || []).filter((d) => d && d.defined_term && !isFragmentDefinedTerm(d.defined_term));
}

export function UnifiedDefinitionsSection({
  primaryName,
  primaryReviewDeal,
  comparedColumns,
  onRetry = null,
}) {
  const deals = useMemo(() => [
    {
      key: 'primary',
      name: primaryName || 'This deal',
      href: null,
      loading: false,
      error: null,
      reviewDeal: primaryReviewDeal || EMPTY_REVIEW_DEAL,
      isPrimary: true,
    },
    ...(comparedColumns || []).map((col, i) => ({
      key: col.id || `cmp-${i}`,
      name: col.name || `Compared deal ${i + 1}`,
      href: col.id ? `/review/${col.id}` : null,
      loading: Boolean(col.loading),
      error: col.error || null,
      reviewDeal: col.reviewDeal || EMPTY_REVIEW_DEAL,
      isPrimary: false,
    })),
  ], [primaryName, primaryReviewDeal, comparedColumns]);

  const entries = useMemo(() => {
    const lists = deals.map((d) => (d.loading || d.error ? [] : filteredDefinitions(d.reviewDeal.definitions)));
    return unionDefinitions(lists);
  }, [deals]);

  if (!entries.length) return null;

  return (
    <section data-testid="unified-compare-definitions" className="border border-border bg-white">
      <div className="border-b border-border bg-paper2 px-3 py-1.5">
        <p>Defined terms ({entries.length})</p>
      </div>
      {/* data-scroll-sync: r18 item 3 -- horizontal scroll on this table
          mirrors every other unified section table's scroll position (see
          pages/review/[id].js's scroll-sync effect). */}
      <div className="overflow-x-auto" data-scroll-sync="unified-table">
        <table className="min-w-full text-xs font-ui">
          <thead className="border-b border-border">
            <tr>
              <th className="px-3 py-2 text-left align-bottom font-medium uppercase tracking-wider text-inkFaint" style={{ width: '12rem' }}>Term</th>
              {deals.map((d) => (
                <th key={d.key} className="px-3 py-2 text-left align-bottom" style={{ minWidth: 230 }}>
                  {d.href ? (
                    <Link href={d.href} className="hover:underline text-[10px] font-bold tracking-[0.08em] text-[#1F1F1F] normal-case">{d.name}</Link>
                  ) : (
                    <span className="text-[10px] font-bold tracking-[0.08em] text-[#1F1F1F] normal-case">{d.name}</span>
                  )}
                  {d.loading ? (
                    <div className="mtx-meta-label text-[9px] tracking-[0.14em] mt-0.5 font-normal">Loading deal…</div>
                  ) : null}
                  {d.error ? (
                    <div className="text-[9px] font-normal text-[#B14E63] mt-0.5">
                      Deal data unavailable{onRetry && !d.isPrimary ? (
                        <>
                          {' — '}
                          <button
                            type="button"
                            onClick={onRetry}
                            className="font-bold uppercase tracking-[0.1em] text-[#2F6DB5] hover:underline"
                            data-testid="compare-column-retry"
                          >
                            Retry
                          </button>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {entries.map((entry) => (
              <tr key={entry.key} className="align-top">
                <td className="px-3 py-2 align-top font-medium text-ink">{entry.term}</td>
                {deals.map((d, i) => {
                  if (d.loading) return <td key={d.key} className="px-3 py-2"><Muted>Loading deal…</Muted></td>;
                  if (d.error) return <td key={d.key} className="px-3 py-2"><Muted>—</Muted></td>;
                  const def = entry.defs[i];
                  if (!def) return <td key={d.key} className="px-3 py-2"><NotExtractedCell /></td>;
                  const full = def.region_full_text || def.primary_quote || '';
                  const summary = def.defined_value || '';
                  return (
                    <td key={d.key} className="px-3 py-2 align-top text-ink">
                      <span className="whitespace-pre-wrap break-words">{summary}</span>
                      {full && full !== summary ? (
                        <details className="mt-1">
                          <summary className="term-cell-seetext" style={{ listStyle: 'none' }}>full text</summary>
                          <div className="mt-1 whitespace-pre-wrap break-words text-[11px] leading-5 text-inkLight">{full}</div>
                        </details>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function UnifiedCompareSection({
  section,
  primaryName,
  primaryReviewDeal,
  comparedColumns,
  onRetry = null,
  election = null,
  sectionCards = null,
  onSelectCard = null,
  selectedCardId = null,
  // r18 item 5: { code, stats, loading, error } from useSectionMarketStats,
  // or null when market mode is off for this page. Rendered as one more
  // synthetic column in the SAME unified table (Ben: "not this two sets of
  // tables crap") rather than the old side-column MarketSectionColumn.
  marketColumn = null,
  onMarketRetry = null,
}) {
  // One expansion open at a time, keyed `${rowKey}|${dealKey}` so each
  // deal's cell expands ITS OWN provision text (not just the primary's).
  const [expanded, setExpanded] = useState(null);
  const config = section ? section.config : null;
  const cardsById = useMemo(() => buildCardIndex(sectionCards), [sectionCards]);
  const deals = useMemo(() => {
    const list = [
      {
        key: 'primary',
        name: primaryName || 'This deal',
        href: null,
        loading: false,
        error: null,
        reviewDeal: primaryReviewDeal || EMPTY_REVIEW_DEAL,
        isPrimary: true,
      },
      ...(comparedColumns || []).map((col, i) => ({
        key: col.id || `cmp-${i}`,
        name: col.name || `Compared deal ${i + 1}`,
        href: col.id ? `/review/${col.id}` : null,
        loading: Boolean(col.loading),
        error: col.error || null,
        reviewDeal: col.reviewDeal || EMPTY_REVIEW_DEAL,
        isPrimary: false,
      })),
      // The market column is appended LAST, always -- it never contributes
      // rows to the union (isMarket rows below always resolve to []), it
      // only supplies an extra answer cell per existing union row.
      ...(marketColumn ? [{
        key: 'market',
        name: marketColumnLabel(marketColumn),
        href: null,
        loading: Boolean(marketColumn.loading),
        error: marketColumn.error || null,
        reviewDeal: EMPTY_REVIEW_DEAL,
        isPrimary: false,
        isMarket: true,
      }] : []),
    ];
    return list.map((d) => {
      const ctx = {
        reviewDeal: d.reviewDeal,
        config,
        primitives: ProvisionTablePrimitives,
        isEdit: false,
        // Card selection (ClauseSidebar) stays scoped to the PRIMARY deal,
        // same as the previous compare rendering.
        resolveCard: d.isPrimary && onSelectCard ? (row) => resolveRowCard(row, cardsById) : () => null,
        onSelectCard: d.isPrimary ? onSelectCard : null,
        selectedCardId: d.isPrimary ? selectedCardId : null,
      };
      const rows = !config || d.loading || d.error || d.isMarket ? [] : safeRows(config, d.reviewDeal);
      return { ...d, ctx, rows };
    });
  }, [primaryName, primaryReviewDeal, comparedColumns, config, cardsById, onSelectCard, selectedCardId, marketColumn]);

  if (!config) return null;

  const colSpan = 1 + deals.length;
  const groupsPerDeal = deals.map((d) => (d.rows.length ? extractGroupsForDeal(config, d.rows, d.ctx) : []));
  const firstWithRows = deals.findIndex((d) => d.rows.length > 0);
  const grouped = firstWithRows >= 0
    && groupsPerDeal[firstWithRows] !== null
    && Array.isArray(groupsPerDeal[firstWithRows]);

  const allColumns = Array.isArray(config.columns) ? config.columns : [];
  const fullTextIds = FULL_TEXT_COLUMNS[config.id] || [];
  const visibleCols = allColumns.filter((c) => !fullTextIds.includes(c.id));
  const labelCol = visibleCols[0] || null;
  const answerCols = visibleCols.slice(1);
  const ftCols = allColumns.filter((c) => fullTextIds.includes(c.id));

  const toggleExpanded = (key) => setExpanded((cur) => (cur === key ? null : key));

  function seeProvisionToggle(key) {
    const open = expanded === key;
    return (
      <button
        type="button"
        className="term-cell-seetext mt-1 block"
        style={{ listStyle: 'none' }}
        onClick={(e) => { e.stopPropagation(); toggleExpanded(key); }}
        aria-expanded={open}
      >
        {open ? 'Hide provision' : 'See provision'}
      </button>
    );
  }

  function expansionTr(key, dealName, content) {
    if (expanded !== key || !content) return null;
    return (
      <tr className="mtx-provision-expansion-row bg-bg/20">
        <td colSpan={colSpan} className="px-3 py-3 border-t border-dashed border-border">
          <div className="text-[9px] font-bold tracking-[0.08em] uppercase text-[#9A9A9A] mb-1">{dealName}</div>
          <div className="max-w-none whitespace-pre-wrap break-words text-[11px] leading-5 text-inkLight">{content}</div>
        </td>
      </tr>
    );
  }

  function primaryClickProps(deal, row) {
    if (!deal.isPrimary || !onSelectCard || !row) return {};
    const rowCard = resolveRowCard(row, cardsById);
    if (!rowCard) return {};
    const rowCardKey = rowCard.id || rowCard.provision_instance_id;
    const isSelected = Boolean(rowCardKey) && selectedCardId === rowCardKey;
    return {
      onClick: () => onSelectCard(rowCard, resolveRowFocus(row)),
      style: {
        cursor: 'pointer',
        ...(isSelected ? { background: 'rgba(47,109,181,.07)', boxShadow: 'inset 2px 0 0 #2F6DB5' } : {}),
      },
      className: 'mtx-row-clickable',
    };
  }

  function statusCellContent(deal) {
    if (deal.loading) return <Muted>Loading deal…</Muted>;
    if (deal.error) return <Muted>—</Muted>;
    return null;
  }

  // ── Flat (multi-column) sections ──
  function flatAnswerContent(row, ctx) {
    const pairs = answerCols
      .map((col) => ({ header: col.header, node: renderCellSafe(col, row, ctx) }))
      .filter((p) => p.node !== null && p.node !== undefined && p.node !== '');
    if (pairs.length > 1) {
      return pairs.map((p, i) => (
        <div key={i} className="mb-1.5 last:mb-0">
          {p.header ? (
            <div className="text-[9px] font-medium uppercase tracking-wider text-inkFaint">{p.header}</div>
          ) : null}
          <div>{p.node}</div>
        </div>
      ));
    }
    if (pairs.length === 1) return pairs[0].node;
    const fallback = textValueLocal(row.value) || (typeof row.detail === 'string' ? row.detail : null);
    return fallback || <Muted>—</Muted>;
  }

  function flatExpansionContent(row, ctx) {
    const nodes = ftCols.map((col) => renderCellSafe(col, row, ctx)).filter(Boolean);
    if (nodes.length) return nodes;
    return unifiedFallbackEvidence(row);
  }

  function flatLabelNode(entry) {
    // r16 ROW_FAMILY canonicalization (compareRowUnion.js): a handful of
    // taxonomy-split code pairs union onto one shared key with a fixed
    // surviving label -- render that label rather than whichever deal's
    // own row.label happened to be first (that's still deal-specific card
    // title text, not the canonical concept name).
    const familyLabel = rowFamilyLabel(entry.key);
    if (familyLabel) return familyLabel;
    const firstIdx = entry.rows.findIndex(Boolean);
    if (firstIdx < 0) return null;
    const row = entry.rows[firstIdx];
    // Prefer the row's plain string label: some configs' label renderCell
    // appends DEAL-SPECIFIC decorations (the reps family's bringdown/
    // qualifier chips) which, in a SHARED label column, would silently
    // attribute one deal's data to every deal in the comparison. Fall back
    // to the rendered label cell only when the row has no string label.
    if (typeof row.label === 'string' && row.label.trim()) return row.label;
    const node = labelCol ? renderCellSafe(labelCol, row, deals[firstIdx].ctx) : null;
    if (node !== null && node !== undefined && node !== '') return node;
    return row.label || entry.key;
  }

  function flatBody() {
    const entries = unionRows(deals.map((d) => d.rows));
    return entries.map((entry) => (
      <Fragment key={entry.key}>
        <tr className="align-top">
          <td className="px-3 py-2 whitespace-normal break-words text-ink font-medium">{flatLabelNode(entry)}</td>
          {deals.map((d, i) => {
            if (d.isMarket) {
              const refRow = entry.rows.find(Boolean) || null;
              return (
                <td key={d.key} className="px-3 py-2 align-top">
                  <MarketCell row={refRow} marketColumn={marketColumn} />
                </td>
              );
            }
            const row = entry.rows[i];
            const status = statusCellContent(d);
            if (status) return <td key={d.key} className="px-3 py-2">{status}</td>;
            if (!row) return <td key={d.key} className="px-3 py-2"><NotExtractedCell /></td>;
            const expandKey = `${entry.key}|${d.key}`;
            const expandable = Boolean(flatExpansionContent(row, d.ctx));
            const click = primaryClickProps(d, row);
            const offMarket = Boolean(marketColumn) && !marketColumn.loading && !marketColumn.error
              && isOffMarketRow(row, marketColumn);
            return (
              <td
                key={d.key}
                className={`px-3 py-2 whitespace-pre-wrap break-words text-ink ${click.className || ''}`.trim()}
                onClick={click.onClick}
                style={click.style}
              >
                {flatAnswerContent(row, d.ctx)}
                {offMarket ? <OffMarketBadge /> : null}
                {expandable ? seeProvisionToggle(expandKey) : null}
              </td>
            );
          })}
        </tr>
        {deals.map((d, i) => {
          const row = entry.rows[i];
          if (!row) return null;
          const expandKey = `${entry.key}|${d.key}`;
          if (expanded !== expandKey) return null;
          return <Fragment key={`${d.key}-x`}>{expansionTr(expandKey, d.name, flatExpansionContent(row, d.ctx))}</Fragment>;
        })}
      </Fragment>
    ));
  }

  // ── Grouped sections (GroupedSubRows configs) ──
  function groupedBody() {
    const groupEntries = unionRows(groupsPerDeal.map((g) => (Array.isArray(g) ? g : [])));
    return groupEntries.map((ge) => {
      const firstIdx = ge.rows.findIndex(Boolean);
      const groupLabel = firstIdx >= 0 ? ge.rows[firstIdx].label : ge.key;
      const subEntries = unionRows(ge.rows.map((g) => (g && Array.isArray(g.rows) ? g.rows : [])));
      return (
        <Fragment key={ge.key}>
          <tr>
            <td colSpan={colSpan} className="px-3 py-1.5 bg-bg/60 border-t border-border text-[10px] font-medium uppercase tracking-wider text-inkFaint">
              {groupLabel}
            </td>
          </tr>
          {subEntries.map((entry) => {
            const labelIdx = entry.rows.findIndex(Boolean);
            const labelRow = labelIdx >= 0 ? entry.rows[labelIdx] : null;
            return (
              <Fragment key={entry.key}>
                <tr className="align-top">
                  <td className="px-3 py-2 whitespace-normal break-words">
                    <span className="text-[11px] font-medium text-ink">{labelRow ? labelRow.label : entry.key}</span>
                  </td>
                  {deals.map((d, i) => {
                    if (d.isMarket) {
                      const refRow = entry.rows.find(Boolean) || null;
                      return (
                        <td key={d.key} className="px-3 py-2 align-top">
                          <MarketCell row={refRow} marketColumn={marketColumn} />
                        </td>
                      );
                    }
                    const row = entry.rows[i];
                    const status = statusCellContent(d);
                    if (status) return <td key={d.key} className="px-3 py-2">{status}</td>;
                    if (!row) return <td key={d.key} className="px-3 py-2"><NotExtractedCell /></td>;
                    const expandKey = `${ge.key}|${entry.key}|${d.key}`;
                    const click = primaryClickProps(d, row);
                    // r19 item 2 ("grouped rows get the marker too"): r18
                    // only flagged flat rows, reasoning the grouped WRAPPER
                    // row's single `children` element had no reliable own
                    // value to compare -- but the SUB-rows here (one per
                    // group entry) carry the same featureKeys/value shape
                    // flat rows do, so the same off-market check applies.
                    const offMarket = Boolean(marketColumn) && !marketColumn.loading && !marketColumn.error
                      && isOffMarketRow(row, marketColumn);
                    return (
                      <td
                        key={d.key}
                        className={`px-3 py-2 whitespace-pre-wrap break-words text-xs text-ink ${click.className || ''}`.trim()}
                        onClick={click.onClick}
                        style={click.style}
                      >
                        {row.children || textValueLocal(row.value) || row.detail || <Muted>Not captured</Muted>}
                        {offMarket ? <OffMarketBadge /> : null}
                        {row.seeTextContent ? seeProvisionToggle(expandKey) : (row.seeText || null)}
                      </td>
                    );
                  })}
                </tr>
                {deals.map((d, i) => {
                  const row = entry.rows[i];
                  if (!row || !row.seeTextContent) return null;
                  const expandKey = `${ge.key}|${entry.key}|${d.key}`;
                  if (expanded !== expandKey) return null;
                  return <Fragment key={`${d.key}-x`}>{expansionTr(expandKey, d.name, row.seeTextContent)}</Fragment>;
                })}
              </Fragment>
            );
          })}
        </Fragment>
      );
    });
  }

  // Consideration section: each deal's election summary card (when it has
  // one) renders above the unified table, captioned with the deal name --
  // the compared columns used to render these inline.
  const electionBlock = section.id === CONSIDERATION_SECTION_ID ? (
    <div className="space-y-3 mb-4">
      {deals.map((d, i) => {
        const e = d.isPrimary ? election : (d.reviewDeal && !d.loading && !d.error ? deriveElectionSummary(d.reviewDeal) : null);
        if (!e) return null;
        return (
          <div key={d.key}>
            <div className="text-[9px] font-bold tracking-[0.08em] uppercase text-[#9A9A9A] mb-1">{d.name}</div>
            <ElectionCard election={e} />
          </div>
        );
      })}
    </div>
  ) : null;

  return (
    <div data-testid={`unified-compare-${config.id}`}>
      {electionBlock}
      {/* data-testid starts with 'provision-table-' ON PURPOSE: every .mtx
          table rule in MergertraceStyles keys off that prefix (grey header
          bar, white body, #E0E0E0 rules, and critically the pill-wrap rule —
          without it long single-line pills paint past their cell and push
          the second deal's column off-screen). */}
      <section
        className="rounded border border-border bg-white shadow-sm overflow-x-auto"
        data-testid={`provision-table-unified-${config.id}`}
        data-scroll-sync="unified-table"
      >
        <table className="min-w-full text-xs font-ui">
          <thead>
            <tr>
              <th className="px-3 py-2 text-left align-bottom border-b-2 border-black" style={{ width: 220, minWidth: 170 }}>
                <span className="mtx-meta-label text-[9px] tracking-[0.14em] font-medium">
                  {labelCol && labelCol.header ? labelCol.header : 'Term'}
                </span>
              </th>
              {deals.map((d) => (
                <DealNameHeader key={d.key} deal={d} onRetry={d.isMarket ? onMarketRetry : (d.isPrimary ? null : onRetry)} />
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {grouped ? groupedBody() : flatBody()}
          </tbody>
        </table>
      </section>
    </div>
  );
}
