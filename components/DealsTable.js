import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useViewMode } from './ViewModeContext';

/* ─── Deals home-page table: Excel/Airtable-style per-column header
 * controls (sort + multi-select filter), an active-filters chip row, and
 * shareable-URL state. Extracted from pages/index.js so the filter engine
 * (pure, testable) stays separate from page chrome.
 *
 * Filter semantics: within a column, selected values OR together; across
 * columns, AND; the free-text search box ANDs with everything (see
 * applyFilters). ────────────────────────────────────────────────────── */

const EM_DASH = '—';

/* Compact deal-value format: 9420000000 → "$9.4B", 137500000 → "$137.5M". */
export function fmtValue(v) {
  const n = typeof v === 'number' ? v : v ? Number(v) : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  const trim = (x) => {
    const s = x.toFixed(1);
    return s.endsWith('.0') ? s.slice(0, -2) : s;
  };
  if (n >= 1e9) return `$${trim(n / 1e9)}B`;
  if (n >= 1e6) return `$${trim(n / 1e6)}M`;
  if (n >= 1e3) return `$${trim(n / 1e3)}K`;
  return `$${n}`;
}

function fmtDate(d) {
  if (!d) return null;
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/* Accepts "5B" / "500M" / "250k" / "1200000000" shorthand — mirrors fmtValue
 * so what a user types round-trips with what the column displays. */
function parseValueShorthand(str) {
  if (str == null) return null;
  const s = String(str).trim().toLowerCase().replace(/[$,\s]/g, '');
  if (!s) return null;
  const m = s.match(/^(-?\d+(?:\.\d+)?)([bmk])?$/);
  if (!m) {
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  const mult = m[2] === 'b' ? 1e9 : m[2] === 'm' ? 1e6 : m[2] === 'k' ? 1e3 : 1;
  return n * mult;
}

function formatValueShort(n) {
  if (n == null || !Number.isFinite(n)) return '';
  const abs = Math.abs(n);
  const trim = (x) => {
    const s = x.toFixed(1);
    return s.endsWith('.0') ? s.slice(0, -2) : s;
  };
  if (abs >= 1e9) return `${trim(n / 1e9)}B`;
  if (abs >= 1e6) return `${trim(n / 1e6)}M`;
  if (abs >= 1e3) return `${trim(n / 1e3)}K`;
  return String(n);
}

/* ─── Column config: single source of truth for header rendering, distinct-
 * value computation, filtering, and sorting. ───────────────────────────── */
export const COLUMNS = [
  { key: 'date', label: 'Date', kind: 'date' },
  { key: 'buyer', label: 'Buyer', kind: 'text', get: (r) => r.buyer },
  { key: 'seller', label: 'Seller', kind: 'text', get: (r) => r.seller },
  { key: 'value', label: 'Value', kind: 'value' },
  { key: 'consideration', label: 'Consideration', kind: 'text', get: (r) => r.consideration },
  { key: 'industry', label: 'Industry', kind: 'text', get: (r) => r.industry },
  { key: 'buyerFirm', label: 'Buyer Firm', kind: 'multi', get: (r) => r.buyerFirms },
  { key: 'buyerLawyer', label: 'Buyer Lawyers', kind: 'multi', get: (r) => r.buyerLawyers },
  { key: 'sellerFirm', label: 'Seller Firm', kind: 'multi', get: (r) => r.sellerFirms },
  { key: 'sellerLawyer', label: 'Seller Lawyers', kind: 'multi', get: (r) => r.sellerLawyers },
];

const SELECTABLE_KEYS = COLUMNS.filter((c) => c.kind === 'text' || c.kind === 'multi').map((c) => c.key);

function getValues(col, row) {
  if (col.kind === 'multi') return col.get(row) || [];
  if (col.kind === 'text') {
    const v = col.get(row);
    return v ? [v] : [];
  }
  return [];
}

export function makeDefaultFilters() {
  const f = { value: { min: null, max: null }, date: { from: null, to: null } };
  for (const key of SELECTABLE_KEYS) f[key] = new Set();
  return f;
}

export function hasAnyActiveFilter(filters, queryText) {
  if (queryText && queryText.trim()) return true;
  if (filters.value.min != null || filters.value.max != null) return true;
  if (filters.date.from || filters.date.to) return true;
  return SELECTABLE_KEYS.some((k) => filters[k] && filters[k].size > 0);
}

function colHasActiveFilter(col, filters) {
  if (col.kind === 'value') return filters.value.min != null || filters.value.max != null;
  if (col.kind === 'date') return !!(filters.date.from || filters.date.to);
  return filters[col.key] && filters[col.key].size > 0;
}

function filterCount(col, filters) {
  if (col.kind === 'value') return (filters.value.min != null ? 1 : 0) + (filters.value.max != null ? 1 : 0);
  if (col.kind === 'date') return (filters.date.from ? 1 : 0) + (filters.date.to ? 1 : 0);
  return filters[col.key] ? filters[col.key].size : 0;
}

/* ─── Pure filter/sort engine (no React) — kept free of hooks so it's easy
 * to reason about and unit-test independently of the UI. ───────────────── */
export function applyFilters(rows, filters, queryText) {
  const q = (queryText || '').trim().toLowerCase();
  return rows.filter((r) => {
    if (q) {
      const hay = [r.buyer, r.seller, ...r.buyerFirms, ...r.sellerFirms, ...r.buyerLawyers, ...r.sellerLawyers];
      if (!hay.some((s) => s && s.toLowerCase().includes(q))) return false;
    }
    for (const key of SELECTABLE_KEYS) {
      const sel = filters[key];
      if (!sel || sel.size === 0) continue;
      const col = COLUMNS.find((c) => c.key === key);
      const vals = getValues(col, r);
      if (!vals.some((v) => sel.has(v))) return false;
    }
    if (filters.value.min != null || filters.value.max != null) {
      const n = typeof r.value === 'number' ? r.value : r.value ? Number(r.value) : NaN;
      if (!Number.isFinite(n)) return false;
      if (filters.value.min != null && n < filters.value.min) return false;
      if (filters.value.max != null && n > filters.value.max) return false;
    }
    if (filters.date.from || filters.date.to) {
      if (!r.date) return false;
      const t = new Date(r.date).getTime();
      if (filters.date.from && t < new Date(filters.date.from).getTime()) return false;
      if (filters.date.to) {
        const end = new Date(filters.date.to);
        end.setHours(23, 59, 59, 999);
        if (t > end.getTime()) return false;
      }
    }
    return true;
  });
}

export function sortRows(rows, sort) {
  const col = COLUMNS.find((c) => c.key === sort.key);
  if (!col) return rows;
  const dir = sort.dir === 'asc' ? 1 : -1;
  const val = (r) => {
    if (col.kind === 'value') {
      const n = typeof r.value === 'number' ? r.value : r.value ? Number(r.value) : NaN;
      return Number.isFinite(n) ? n : null;
    }
    if (col.kind === 'date') return r.date ? new Date(r.date).getTime() : null;
    if (col.kind === 'multi') {
      const vals = col.get(r) || [];
      return vals.length ? vals.join('; ') : null;
    }
    return col.get(r) || null;
  };
  return [...rows].sort((a, b) => {
    const va = val(a);
    const vb = val(b);
    if (va === null && vb === null) return 0;
    if (va === null) return 1; // nulls last regardless of direction
    if (vb === null) return -1;
    if (typeof va === 'string') return va.localeCompare(vb) * dir;
    return (va - vb) * dir;
  });
}

function sortOptionsFor(kind) {
  if (kind === 'date') return [{ dir: 'desc', label: 'Newest first' }, { dir: 'asc', label: 'Oldest first' }];
  if (kind === 'value') return [{ dir: 'desc', label: 'High to low' }, { dir: 'asc', label: 'Low to high' }];
  return [{ dir: 'asc', label: 'A → Z' }, { dir: 'desc', label: 'Z → A' }];
}

/* ─── Query-param (de)serialization — one manual encodeURIComponent pass so
 * commas embedded in firm/lawyer names ("Paul, Weiss") survive Next's own
 * (single) encode/decode of the query object round-trip. ───────────────── */
const DEFAULT_SORT = { key: 'date', dir: 'desc' };

export function filtersToQueryParams(filters, sort, queryText, defaultSort = DEFAULT_SORT) {
  const params = {};
  if (queryText && queryText.trim()) params.q = queryText;
  for (const key of SELECTABLE_KEYS) {
    const set = filters[key];
    if (set && set.size) params[key] = [...set].map(encodeURIComponent).join(',');
  }
  if (filters.value.min != null) params.valueMin = String(filters.value.min);
  if (filters.value.max != null) params.valueMax = String(filters.value.max);
  if (filters.date.from) params.dateFrom = filters.date.from;
  if (filters.date.to) params.dateTo = filters.date.to;
  // Omit the sort param entirely when it's just the default — keeps the URL
  // clean on an unfiltered, default-sorted page load.
  if (sort && sort.key && !(sort.key === defaultSort.key && sort.dir === defaultSort.dir)) {
    params.sort = `${sort.key}:${sort.dir}`;
  }
  return params;
}

export function queryParamsToFilters(q) {
  const filters = makeDefaultFilters();
  for (const key of SELECTABLE_KEYS) {
    const raw = q[key];
    const s = Array.isArray(raw) ? raw[0] : raw;
    if (typeof s === 'string' && s) {
      filters[key] = new Set(
        s
          .split(',')
          .filter(Boolean)
          .map((tok) => {
            try {
              return decodeURIComponent(tok);
            } catch {
              return tok;
            }
          })
      );
    }
  }
  const rawMin = Array.isArray(q.valueMin) ? q.valueMin[0] : q.valueMin;
  const rawMax = Array.isArray(q.valueMax) ? q.valueMax[0] : q.valueMax;
  const min = rawMin != null ? Number(rawMin) : null;
  const max = rawMax != null ? Number(rawMax) : null;
  filters.value = { min: Number.isFinite(min) ? min : null, max: Number.isFinite(max) ? max : null };
  const from = Array.isArray(q.dateFrom) ? q.dateFrom[0] : q.dateFrom;
  const to = Array.isArray(q.dateTo) ? q.dateTo[0] : q.dateTo;
  filters.date = { from: typeof from === 'string' ? from : null, to: typeof to === 'string' ? to : null };
  return filters;
}

export function parseSortParam(raw, fallback) {
  const s = Array.isArray(raw) ? raw[0] : raw;
  if (typeof s !== 'string') return fallback;
  const [key, dir] = s.split(':');
  if (!COLUMNS.some((c) => c.key === key)) return fallback;
  return { key, dir: dir === 'asc' ? 'asc' : 'desc' };
}

function buildChips(filters, queryText) {
  const chips = [];
  if (queryText && queryText.trim()) chips.push({ id: 'q', label: `Search: "${queryText.trim()}"` });
  for (const col of COLUMNS) {
    if (col.kind !== 'text' && col.kind !== 'multi') continue;
    for (const v of filters[col.key]) {
      chips.push({ id: `${col.key}:${v}`, label: `${col.label}: ${v}`, colKey: col.key, value: v });
    }
  }
  if (filters.value.min != null) chips.push({ id: 'valueMin', label: `Value ≥ $${formatValueShort(filters.value.min)}` });
  if (filters.value.max != null) chips.push({ id: 'valueMax', label: `Value ≤ $${formatValueShort(filters.value.max)}` });
  if (filters.date.from) chips.push({ id: 'dateFrom', label: `From ${filters.date.from}` });
  if (filters.date.to) chips.push({ id: 'dateTo', label: `To ${filters.date.to}` });
  return chips;
}

/* ─── Header popover: fixed-position (escapes the table's overflow clip,
 * same technique as HoverSource in components/review/shared.js), closes on
 * outside-click / Escape. Only one open at a time — governed by the shared
 * `openKey` state passed down from DealsTable. ─────────────────────────── */
function ColumnPopover({ colKey, label, openKey, onOpenKey, anchorRef, children }) {
  const isOpen = openKey === colKey;
  const popRef = useRef(null);
  const [pos, setPos] = useState(null);

  useEffect(() => {
    if (!isOpen) {
      setPos(null);
      return;
    }
    const el = anchorRef.current;
    if (el) {
      const r = el.getBoundingClientRect();
      const width = 280;
      let left = r.left;
      if (left + width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - width - 8);
      const flipUp = r.bottom > window.innerHeight * 0.6;
      setPos({
        left,
        top: flipUp ? undefined : r.bottom + 4,
        bottom: flipUp ? window.innerHeight - r.top + 4 : undefined,
      });
    }
    function handlePointerDown(e) {
      if (
        popRef.current &&
        !popRef.current.contains(e.target) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target)
      ) {
        onOpenKey(null);
      }
    }
    function handleKey(e) {
      if (e.key === 'Escape') onOpenKey(null);
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen || !pos) return null;
  return (
    <div
      ref={popRef}
      role="dialog"
      aria-label={`${label} filter`}
      className="fixed z-[200] w-[280px] bg-white border border-border rounded-lg shadow-xl font-ui text-xs normal-case tracking-normal font-normal text-ink"
      style={{ left: pos.left, top: pos.top, bottom: pos.bottom }}
    >
      {children}
    </div>
  );
}

function ChecklistItem({ value, checked, onToggle }) {
  return (
    <div
      role="checkbox"
      aria-checked={checked}
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle();
        }
      }}
      className="flex items-center gap-2 px-2.5 py-1 cursor-pointer hover:bg-bg/60 focus:outline-none focus:bg-bg/60"
    >
      <input type="checkbox" checked={checked} readOnly tabIndex={-1} className="accent-[var(--accent)] pointer-events-none" />
      <span className="truncate">{value}</span>
    </div>
  );
}

function SortOption({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2 py-1 rounded hover:bg-bg/60 text-left ${active ? 'text-accentDeep font-semibold' : 'text-inkMid'}`}
    >
      <span aria-hidden="true" className="w-3 inline-block">{active ? '✓' : ''}</span>
      {label}
    </button>
  );
}

function ValueRangeControl({ filters, onSetValueRange }) {
  const [minText, setMinText] = useState(filters.value.min != null ? formatValueShort(filters.value.min) : '');
  const [maxText, setMaxText] = useState(filters.value.max != null ? formatValueShort(filters.value.max) : '');
  const commit = (which, text) => onSetValueRange(which, parseValueShorthand(text));
  const inputCls =
    'font-ui text-xs px-2 py-1 rounded border border-border bg-white text-ink placeholder:text-inkFaint focus:outline-none focus:border-accent w-full';
  return (
    <div className="px-2.5 py-2 flex flex-col gap-1.5">
      <label className="flex flex-col gap-0.5">
        <span className="text-inkFaint text-[10px] uppercase tracking-wider">Min</span>
        <input
          type="text"
          value={minText}
          placeholder="e.g. 500M"
          onChange={(e) => setMinText(e.target.value)}
          onBlur={(e) => commit('min', e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && commit('min', e.currentTarget.value)}
          className={inputCls}
        />
      </label>
      <label className="flex flex-col gap-0.5">
        <span className="text-inkFaint text-[10px] uppercase tracking-wider">Max</span>
        <input
          type="text"
          value={maxText}
          placeholder="e.g. 5B"
          onChange={(e) => setMaxText(e.target.value)}
          onBlur={(e) => commit('max', e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && commit('max', e.currentTarget.value)}
          className={inputCls}
        />
      </label>
    </div>
  );
}

function DateRangeControl({ filters, onSetDateRange }) {
  const inputCls =
    'font-ui text-xs px-2 py-1 rounded border border-border bg-white text-ink focus:outline-none focus:border-accent w-full';
  return (
    <div className="px-2.5 py-2 flex flex-col gap-1.5">
      <label className="flex flex-col gap-0.5">
        <span className="text-inkFaint text-[10px] uppercase tracking-wider">From</span>
        <input
          type="date"
          value={filters.date.from || ''}
          onChange={(e) => onSetDateRange('from', e.target.value || null)}
          className={inputCls}
        />
      </label>
      <label className="flex flex-col gap-0.5">
        <span className="text-inkFaint text-[10px] uppercase tracking-wider">To</span>
        <input
          type="date"
          value={filters.date.to || ''}
          onChange={(e) => onSetDateRange('to', e.target.value || null)}
          className={inputCls}
        />
      </label>
    </div>
  );
}

function ChecklistControl({ col, filters, options, onToggleValue, onSelectAll, onClearColumn }) {
  const [search, setSearch] = useState('');
  const selected = filters[col.key];
  const visible = search.trim()
    ? options.filter((o) => o.toLowerCase().includes(search.trim().toLowerCase()))
    : options;
  return (
    <div className="pt-1.5">
      <div className="px-2.5 pb-1 flex items-center justify-between">
        <button type="button" onClick={() => onSelectAll(col.key, options)} className="text-inkLight hover:text-ink underline decoration-dotted">
          Select all
        </button>
        <button type="button" onClick={() => onClearColumn(col.key)} className="text-inkLight hover:text-ink underline decoration-dotted">
          Clear
        </button>
      </div>
      {options.length > 8 && (
        <div className="px-2.5 pb-1.5">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${col.label.toLowerCase()}…`}
            className="font-ui text-xs px-2 py-1 rounded border border-border bg-white text-ink placeholder:text-inkFaint focus:outline-none focus:border-accent w-full"
          />
        </div>
      )}
      <div className="max-h-[220px] overflow-y-auto">
        {visible.length === 0 ? (
          <div className="px-2.5 py-2 italic text-inkFaint">No matches</div>
        ) : (
          visible.map((v) => (
            <ChecklistItem key={v} value={v} checked={selected.has(v)} onToggle={() => onToggleValue(col.key, v)} />
          ))
        )}
      </div>
    </div>
  );
}

function PopoverBody({ col, sort, onSort, filters, options, onToggleValue, onSelectAll, onClearColumn, onSetValueRange, onSetDateRange }) {
  const opts = sortOptionsFor(col.kind);
  return (
    <div className="py-1.5">
      <div className="px-2.5 pb-1.5 border-b border-border flex flex-col gap-0.5">
        {opts.map((opt) => (
          <SortOption
            key={opt.dir}
            label={opt.label}
            active={sort.key === col.key && sort.dir === opt.dir}
            onClick={() => onSort(col.key, opt.dir)}
          />
        ))}
      </div>
      {col.kind === 'value' && <ValueRangeControl filters={filters} onSetValueRange={onSetValueRange} />}
      {col.kind === 'date' && <DateRangeControl filters={filters} onSetDateRange={onSetDateRange} />}
      {(col.kind === 'text' || col.kind === 'multi') && (
        <ChecklistControl
          col={col}
          filters={filters}
          options={options}
          onToggleValue={onToggleValue}
          onSelectAll={onSelectAll}
          onClearColumn={onClearColumn}
        />
      )}
    </div>
  );
}

function FilterableTh({ col, sort, onSort, filters, options, openKey, onOpenKey, ...rest }) {
  const anchorRef = useRef(null);
  const active = sort.key === col.key;
  const hasFilter = colHasActiveFilter(col, filters);
  return (
    <th className="px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider whitespace-nowrap relative">
      <button
        ref={anchorRef}
        type="button"
        onClick={() => onOpenKey(openKey === col.key ? null : col.key)}
        className={`inline-flex items-center gap-1 uppercase tracking-wider hover:text-ink ${active || hasFilter ? 'text-ink' : ''}`}
        title={`Sort or filter by ${col.label.toLowerCase()}`}
      >
        {col.label}
        {active && (
          <span aria-hidden="true" className="text-accent">
            {sort.dir === 'asc' ? '▲' : '▼'}
          </span>
        )}
        {hasFilter && (
          <span className="inline-flex items-center justify-center min-w-[14px] h-[14px] px-[3px] rounded-full bg-accent text-white text-[9px] leading-none font-mono normal-case">
            {filterCount(col, filters)}
          </span>
        )}
        <span aria-hidden="true" className="text-inkFaint/60">▾</span>
      </button>
      <ColumnPopover colKey={col.key} label={col.label} openKey={openKey} onOpenKey={onOpenKey} anchorRef={anchorRef}>
        <PopoverBody col={col} sort={sort} onSort={onSort} filters={filters} options={options} {...rest} />
      </ColumnPopover>
    </th>
  );
}

function Dash() {
  return <span className="text-inkFaint/70">{EM_DASH}</span>;
}

function DealRow({ row, selected, onToggle, onOpen }) {
  const { isEdit } = useViewMode();
  const date = fmtDate(row.date);
  const value = fmtValue(row.value);
  return (
    <tr
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpen();
      }}
      tabIndex={0}
      className="hover:bg-bg/40 transition-colors cursor-pointer"
    >
      <td className="px-3 py-2 align-top" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          aria-label="Select deal for comparison"
          className="accent-[var(--accent)] cursor-pointer"
        />
      </td>
      <td className="px-3 py-2 align-top whitespace-nowrap text-inkMid">{date || <Dash />}</td>
      <td className="px-3 py-2 align-top font-semibold text-ink max-w-[240px]">{row.buyer || <Dash />}</td>
      <td className="px-3 py-2 align-top font-semibold text-ink max-w-[240px]">{row.seller || <Dash />}</td>
      <td className="px-3 py-2 align-top whitespace-nowrap text-ink">{value || <Dash />}</td>
      <td className="px-3 py-2 align-top whitespace-nowrap text-inkMid">{row.consideration || <Dash />}</td>
      <td className="px-3 py-2 align-top whitespace-nowrap text-inkMid">{row.industry || <Dash />}</td>
      <td className="px-3 py-2 align-top text-ink max-w-[240px]">
        {row.buyerFirms.length ? row.buyerFirms.join('; ') : <Dash />}
      </td>
      <td className="px-3 py-2 align-top text-inkMid max-w-[240px]">
        {row.buyerLawyers.length ? row.buyerLawyers.join(', ') : <Dash />}
      </td>
      <td className="px-3 py-2 align-top text-ink max-w-[240px]">
        {row.sellerFirms.length ? row.sellerFirms.join('; ') : <Dash />}
      </td>
      <td className="px-3 py-2 align-top text-inkMid max-w-[240px]">
        {row.sellerLawyers.length ? row.sellerLawyers.join(', ') : <Dash />}
      </td>
      <td className="px-3 py-2 align-top whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
        {isEdit ? (
          <Link
            href={`/ingest?deal_id=${row.id}`}
            title="Classify only, extract a specific type, or re-ingest"
            className="font-mono text-[10px] uppercase tracking-wider text-inkLight hover:text-accentDeep"
          >
            Ingest
          </Link>
        ) : null}
      </td>
    </tr>
  );
}

function SkeletonTable() {
  return (
    <div className="p-[22px] space-y-3">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex gap-4">
          <div className="h-3 rounded bg-lineSoft" style={{ width: '10%' }} />
          <div className="h-3 rounded bg-line" style={{ width: '18%' }} />
          <div className="h-3 rounded bg-line" style={{ width: '18%' }} />
          <div className="h-3 rounded bg-lineSoft" style={{ width: '8%' }} />
          <div className="h-3 rounded bg-lineSoft" style={{ width: '14%' }} />
          <div className="h-3 rounded bg-lineSoft" style={{ width: '14%' }} />
        </div>
      ))}
    </div>
  );
}

function EmptyDeals() {
  return (
    <div style={{ padding: '36px 12px', textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink-mid)', marginBottom: 8 }}>
        No deals ingested yet
      </div>
      <p style={{ fontSize: 13, color: 'var(--ink-light)', maxWidth: 460, margin: '0 auto' }}>
        Use the ingest pipeline (
        <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>POST /api/ingest/segment-v2</code>) to parse
        a merger agreement and seed your first deal. See{' '}
        <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>HANDOFF.md</code> for the full pipeline.
      </p>
    </div>
  );
}

function FilterChipsRow({ filters, queryText, onRemoveChip, onClearAll }) {
  const chips = useMemo(() => buildChips(filters, queryText), [filters, queryText]);
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 px-[22px] py-2 border-b border-border bg-bg/30">
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          onClick={() => onRemoveChip(chip)}
          className="inline-flex items-center gap-1 font-ui text-[11px] px-2 py-0.5 rounded-full border border-border bg-white text-inkMid hover:text-ink hover:border-accent"
          title="Remove filter"
        >
          {chip.label}
          <span aria-hidden="true" className="text-inkFaint">×</span>
        </button>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className="font-ui text-[11px] text-inkLight hover:text-ink underline decoration-dotted ml-1"
      >
        Clear all
      </button>
    </div>
  );
}

/* ─── Top-level table: owns filter/sort/search state, syncs it to the URL
 * (shallow router.replace, mirroring pages/compare.js) so a filtered view
 * is shareable via ?buyerFirm=Paul%2C%20Weiss&sort=date:asc etc. ───────── */
export default function DealsTable({ rows, loading, dealsCount, totalProvisions, countsLoading, selected, onToggle, onOpen }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [queryText, setQueryText] = useState('');
  const [filters, setFilters] = useState(() => makeDefaultFilters());
  const [sort, setSort] = useState({ key: 'date', dir: 'desc' });
  const [openKey, setOpenKey] = useState(null);

  // Hydrate from the URL once, on first render after the router is ready.
  useEffect(() => {
    if (!router.isReady || ready) return;
    const q = router.query;
    const rawQ = Array.isArray(q.q) ? q.q[0] : q.q;
    if (typeof rawQ === 'string') setQueryText(rawQ);
    setFilters(queryParamsToFilters(q));
    setSort(parseSortParam(q.sort, { key: 'date', dir: 'desc' }));
    setReady(true);
  }, [router.isReady, ready, router.query]);

  // One-way sync back to the URL after hydration (state → URL only, so we
  // never fight the hydrate effect above). Skip the replace entirely when
  // it would be a no-op, so a plain unfiltered visit never grows a query
  // string and filter changes don't spam the history/network.
  useEffect(() => {
    if (!ready) return;
    const params = filtersToQueryParams(filters, sort, queryText);
    const current = router.query || {};
    const paramKeys = Object.keys(params);
    const currentKeys = Object.keys(current);
    const unchanged =
      paramKeys.length === currentKeys.length &&
      paramKeys.every((k) => current[k] === params[k]);
    if (unchanged) return;
    router.replace({ pathname: router.pathname, query: params }, undefined, { shallow: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, sort, queryText, ready]);

  // FACETED options: each column's checklist lists only values present in the
  // rows that survive every OTHER column's filters (Excel-style — a column's
  // own selections are excluded from its facet base so multi-select within
  // the column stays possible). Already-selected values stay listed even at
  // zero results so they can be un-picked.
  const columnOptions = useMemo(() => {
    const out = {};
    for (const col of COLUMNS) {
      if (col.kind !== 'text' && col.kind !== 'multi') continue;
      const othersFilters = { ...filters, [col.key]: new Set() };
      const base = applyFilters(rows, othersFilters, queryText);
      const set = new Set();
      for (const r of base) {
        for (const v of getValues(col, r)) set.add(v);
      }
      for (const v of (filters[col.key] || [])) set.add(v);
      out[col.key] = [...set].sort((a, b) => a.localeCompare(b));
    }
    return out;
  }, [rows, filters, queryText]);

  const filteredRows = useMemo(() => applyFilters(rows, filters, queryText), [rows, filters, queryText]);
  const sortedRows = useMemo(() => sortRows(filteredRows, sort), [filteredRows, sort]);

  const handleSort = (key, dir) => setSort({ key, dir });
  const onToggleValue = (colKey, value) => {
    setFilters((prev) => {
      const next = new Set(prev[colKey]);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return { ...prev, [colKey]: next };
    });
  };
  const onSelectAll = (colKey, allValues) => setFilters((prev) => ({ ...prev, [colKey]: new Set(allValues) }));
  const onClearColumn = (colKey) => setFilters((prev) => ({ ...prev, [colKey]: new Set() }));
  const onSetValueRange = (which, val) => setFilters((prev) => ({ ...prev, value: { ...prev.value, [which]: val } }));
  const onSetDateRange = (which, val) => setFilters((prev) => ({ ...prev, date: { ...prev.date, [which]: val } }));
  const clearAll = () => {
    setQueryText('');
    setFilters(makeDefaultFilters());
  };
  const removeChip = (chip) => {
    if (chip.id === 'q') return setQueryText('');
    if (chip.id === 'valueMin') return onSetValueRange('min', null);
    if (chip.id === 'valueMax') return onSetValueRange('max', null);
    if (chip.id === 'dateFrom') return onSetDateRange('from', null);
    if (chip.id === 'dateTo') return onSetDateRange('to', null);
    if (chip.colKey && chip.value !== undefined) return onToggleValue(chip.colKey, chip.value);
  };

  const headerProps = { onSort: handleSort, onToggleValue, onSelectAll, onClearColumn, onSetValueRange, onSetDateRange, openKey, onOpenKey: setOpenKey };

  return (
    <section
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 13,
        overflow: 'hidden',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 12,
          padding: '16px 22px',
          borderBottom: '1px solid var(--line)',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '.14em',
            textTransform: 'uppercase',
            color: 'var(--ink-faint)',
          }}
        >
          Deals
        </span>
        <span style={{ flex: 1, height: 1, background: 'var(--line)', alignSelf: 'center' }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-faint)' }}>
          {loading ? '…' : `${dealsCount} deal${dealsCount === 1 ? '' : 's'}`}
          {!countsLoading && totalProvisions > 0 && <> · {totalProvisions} provisions</>}
        </span>
      </header>

      {/* Free-text box removed per review — column-header filters carry the
          load. ?q= URLs still parse (queryText state kept). */}
      <div className="flex items-center justify-end px-[22px] py-2 border-b border-border">
        <span className="font-mono text-[11px] text-inkFaint">
          {loading ? '' : `${sortedRows.length} of ${rows.length}`}
        </span>
      </div>

      <FilterChipsRow filters={filters} queryText={queryText} onRemoveChip={removeChip} onClearAll={clearAll} />

      {loading ? (
        <SkeletonTable />
      ) : rows.length === 0 ? (
        <EmptyDeals />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full table-auto text-xs font-ui">
            <thead className="bg-bg/60 border-b border-border">
              <tr>
                <th className="px-3 py-2 w-8" aria-label="Select for comparison" />
                {COLUMNS.map((col) => (
                  <FilterableTh
                    key={col.key}
                    col={col}
                    sort={sort}
                    filters={filters}
                    options={columnOptions[col.key]}
                    {...headerProps}
                  />
                ))}
                <th className="px-3 py-2" aria-label="Actions" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length + 2} className="px-4 py-8 text-center italic text-inkFaint">
                    No deals match the current filters.
                  </td>
                </tr>
              ) : (
                sortedRows.map((r) => (
                  <DealRow
                    key={r.id}
                    row={r}
                    selected={selected.has(r.id)}
                    onToggle={() => onToggle(r.id)}
                    onOpen={() => onOpen(r.id)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
