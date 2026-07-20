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
import { buildCardIndex, resolveRowCard, resolveRowFocus } from './provisionIndexHelpers.js';
import { getCitableValue, isCitableValue } from '../../lib/citable.js';
import MaeSection from './MaeSection';
import ElectionCard from './ElectionCard';
import { DefinitionsSection } from './ProvisionIndex';
import { deriveElectionSummary, EMPTY_REVIEW_DEAL, MAE_SECTION_ID } from './sectionList';
import { unionRows, rowFamilyLabel } from './compareRowUnion';

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

function DealNameHeader({ deal, onRetry }) {
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
      const rows = !config || d.loading || d.error ? [] : safeRows(config, d.reviewDeal);
      return { ...d, ctx, rows };
    });
  }, [primaryName, primaryReviewDeal, comparedColumns, config, cardsById, onSelectCard, selectedCardId]);

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
            const row = entry.rows[i];
            const status = statusCellContent(d);
            if (status) return <td key={d.key} className="px-3 py-2">{status}</td>;
            if (!row) return <td key={d.key} className="px-3 py-2"><NotExtractedCell /></td>;
            const expandKey = `${entry.key}|${d.key}`;
            const expandable = Boolean(flatExpansionContent(row, d.ctx));
            const click = primaryClickProps(d, row);
            return (
              <td
                key={d.key}
                className={`px-3 py-2 whitespace-pre-wrap break-words text-ink ${click.className || ''}`.trim()}
                onClick={click.onClick}
                style={click.style}
              >
                {flatAnswerContent(row, d.ctx)}
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
                    const row = entry.rows[i];
                    const status = statusCellContent(d);
                    if (status) return <td key={d.key} className="px-3 py-2">{status}</td>;
                    if (!row) return <td key={d.key} className="px-3 py-2"><NotExtractedCell /></td>;
                    const expandKey = `${ge.key}|${entry.key}|${d.key}`;
                    const click = primaryClickProps(d, row);
                    return (
                      <td
                        key={d.key}
                        className={`px-3 py-2 whitespace-pre-wrap break-words text-xs text-ink ${click.className || ''}`.trim()}
                        onClick={click.onClick}
                        style={click.style}
                      >
                        {row.children || textValueLocal(row.value) || row.detail || <Muted>Not captured</Muted>}
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
      >
        <table className="min-w-full text-xs font-ui">
          <thead>
            <tr>
              <th className="px-3 py-2 text-left align-bottom border-b-2 border-black" style={{ width: 220, minWidth: 170 }}>
                <span className="mtx-meta-label text-[9px] tracking-[0.14em] font-medium">
                  {labelCol && labelCol.header ? labelCol.header : 'Term'}
                </span>
              </th>
              {deals.map((d) => <DealNameHeader key={d.key} deal={d} onRetry={d.isPrimary ? null : onRetry} />)}
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
