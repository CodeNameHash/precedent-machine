import { Fragment, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import MergertraceStyles from '../../../components/review-v2/MergertraceStyles';
import AppHeader from '../../../components/chrome/AppHeader';
const { toCsv, resultToCsvRows, csvFilename } = require('../../../lib/query/csv');
const { humanizeKey } = require('../../../lib/query/filter-labels');
// E5 (2026-07-19 pre-demo audit): the review page's own "same label path"
// for bare enum codes ("ALL_CASH" -> "All cash") — reused here rather than
// re-implemented so the query surface never drifts from the review page's
// mapping.
const { prettifyEnumValue } = require('../../../components/review/shared');
// R (2026-07-19 query-results overhaul): the Consideration cell used to
// route DEAL-level codes (STOCK/MIXED_ELECTION/CASH_PLUS_CVR) through
// prettifyEnumValue('considerationType', …), which is tuned for the
// PROVISION-level considerationType enum vocabulary (cash-with-cvr, etc)
// and echoes the deal-level codes back unhumanized. The deals index page
// already solved "deal-level consideration code -> label" — reuse it here
// instead of growing a second mapping.
const { considerationTypeDisplay } = require('../../../lib/deals-index-columns');
// R (2026-07-19 query-results overhaul): item 1 — human titles. Pulled out
// into a plain-Node module (lib/query/result-title.js) rather than defined
// inline, so the title logic can be unit-tested without a JSX/Next runtime.
const { resultTitle, kindLabel } = require('../../../lib/query/result-title');

QueryPage.noLayout = true;

function decodePayload(value) {
  if (!value) return null;
  const padded = String(value).replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(String(value).length / 4) * 4, '=');
  return JSON.parse(atob(padded));
}

function downloadCsv(result) {
  const rows = resultToCsvRows(result);
  if (!rows.length) return;
  const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = csvFilename(result.kind);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function QueryPage() {
  const router = useRouter();
  const { kind, id, payload } = router.query;
  const [result, setResult] = useState(null);
  const [savedQuery, setSavedQuery] = useState(null);
  const [currentPayload, setCurrentPayload] = useState(null);
  const [error, setError] = useState(null);
  const [active, setActive] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!router.isReady || !kind) return;
    setResult(null);
    setSavedQuery(null);
    setCurrentPayload(null);
    setError(null);
    const params = new URLSearchParams({ kind: String(kind) });
    if (id && id !== 'adhoc') params.set('id', String(id));
    if (payload) params.set('payload', String(payload));
    fetch(`/api/query/run?${params.toString()}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.error) throw new Error(json.error);
        setResult(json.result);
        setSavedQuery(json.saved_query || null);
        setCurrentPayload(json.saved_query?.query_payload || (payload ? decodePayload(payload) : null));
      })
      .catch((err) => setError(err.message));
  }, [router.isReady, kind, id, payload]);

  const title = useMemo(() => savedQuery?.title || (result ? resultTitle(result) : kindLabel(kind)), [savedQuery, result, kind]);
  const canPersist = !!(result && currentPayload);
  const saveQuery = async (duplicate = false) => {
    if (!canPersist) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/saved-queries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query_kind: result.kind,
          title: duplicate && savedQuery ? `${savedQuery.title} copy` : title,
          description: savedQuery?.description || null,
          query_payload: currentPayload,
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      router.replace(`/query/${String(kind)}/${json.saved_query.id}`);
    } catch (err) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Head>
        <title>{`${title} · Corpus`}</title>
      </Head>
      <MergertraceStyles />
      <div className="mtx qp">
        <AppHeader
          active="query"
          center={(
            <div className="pageTitle">
              <h1>{title}</h1>
              <p>{id === 'adhoc' ? 'Ad hoc query — not saved yet.' : 'Saved query.'}</p>
            </div>
          )}
        />
        <div className="actions">
          <div className="wrap actionsInner">
            <button type="button" className="mtx-btn" onClick={() => navigator.clipboard?.writeText(window.location.href)}>Share</button>
            <button type="button" className="mtx-btn" disabled={!result} onClick={() => downloadCsv(result)}>Export CSV</button>
            <button type="button" className="mtx-btn" disabled={!canPersist || saving || id !== 'adhoc'} onClick={() => saveQuery(false)}>{saving ? 'Saving…' : 'Save'}</button>
            <button type="button" className="mtx-btn mtx-btn-primary" disabled={!canPersist || saving} onClick={() => saveQuery(true)}>Duplicate</button>
          </div>
        </div>
        <main>
          <div className="wrap">
            {error ? <div className="empty">{error}</div> : !result ? <div className="empty">Loading query…</div> : <ResultView result={result} onOpen={setActive} />}
          </div>
        </main>
        {active && <Drilldown item={active} onClose={() => setActive(null)} />}
      </div>
      <style jsx>{`
        .qp { min-height: 100vh; background: var(--paper); color: var(--ink); font-family: var(--mtx-sans); }
        .pageTitle h1 { margin: 0; font-size: 18px; font-family: var(--mtx-sans); font-weight: 650; color: var(--ink); }
        .pageTitle p { margin: 3px 0 0; color: var(--ink-light); font-size: 12px; font-family: var(--mtx-sans); }
        .actions { border-bottom: 1px solid var(--line); background: #fff; }
        .actionsInner { display: flex; justify-content: flex-end; gap: 10px; padding: 12px 34px; }
        main { padding: 0; }
        .wrap { max-width: 1280px; margin: 0 auto; padding: 32px 34px; }
        .empty { border: 1px solid var(--line); background: #fff; padding: 24px; color: var(--ink-light); font-family: var(--mtx-sans); }
        @media (max-width: 900px) {
          .actionsInner { padding: 12px 16px; flex-wrap: wrap; }
          .wrap { padding: 16px; }
        }
      `}</style>
    </>
  );
}

// WP-3 (M4-02) normalizer badges: a small hover/click marker on any
// value-bearing query-result cell, showing the registry's canonical key,
// the raw alias actually matched on the provision, the registry version,
// and the extractor version + run id (pages/api/query/run.js attaches
// these server-side — see lib/query/prov.js). Renders nothing when the
// cell carries no `_prov` (empty cells, or results predating WP-3).
function ProvBadge({ prov }) {
  const [open, setOpen] = useState(false);
  if (!prov) return null;
  const showsAlias = prov.matched_key && prov.matched_key !== prov.canonical_key;
  return (
    <span className="mtx-prov-cell" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        className="mtx-prov-trigger"
        aria-expanded={open}
        aria-label="Normalizer provenance"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
      >i</button>
      {open && (
        <span className="mtx-prov-popover" onClick={(e) => e.stopPropagation()}>
          <dl>
            <dt>Key</dt>
            <dd>
              {prov.canonical_key || '—'}
              {showsAlias && <><span className="mtx-prov-arrow">&larr;</span>{prov.matched_key}</>}
            </dd>
            <dt>Registry version</dt>
            <dd>{prov.registry_version || '—'}</dd>
            <dt>Extractor</dt>
            <dd>{prov.extraction_version || '—'}{prov.extraction_run_id ? ` · run ${prov.extraction_run_id}` : ''}</dd>
          </dl>
        </span>
      )}
    </span>
  );
}

function ResultView({ result, onOpen }) {
  if (result.kind === 'DEAL_COMPARE') return <DealCompare result={result} onOpen={onOpen} />;
  if (result.kind === 'PROVISION_CROSS_CUT') return <CrossCut result={result} onOpen={onOpen} />;
  if (result.kind === 'MARKET_RANGE') return <MarketRange result={result} onOpen={onOpen} />;
  if (result.kind === 'FILTER_THEN_LIST') return <FilterList result={result} />;
  if (result.kind === 'DEAL_TO_MARKET') return <DealToMarket result={result} onOpen={onOpen} />;
  return <pre>{JSON.stringify(result, null, 2)}</pre>;
}

function DealCompare({ result, onOpen }) {
  if (result.columns.length < 2) return <Panel>Less than 2 deals selected. Add another deal to compare.</Panel>;
  return (
    <Panel>
      <div className="scroll">
        <table className="mtx-table">
          <thead><tr><th>Provision</th>{result.columns.map((col) => <th key={col.deal_id}>{col.deal_name}<small>{col.signing_date}</small></th>)}</tr></thead>
          <tbody>
            {result.rows.map((row) => <tr key={row.provision_type}>
              <th>{row.provision_type.replace(/_/g, ' ')}</th>
              {row.cells.map((cell) => <td key={cell.deal_id} className={cell.delta_severity.toLowerCase()} onClick={() => onOpen(cell)}>
                {cell.key_fields.map((field) => <div key={field.field}><b>{field.label}</b><span className="mtx-mono">{formatValue(field.value, field.field)}{field._prov && <ProvBadge prov={field._prov} />}</span></div>)}
                {cell.primary_quote?.text && <small className="mtx-serif">{cell.primary_quote.text.slice(0, 220)}</small>}
              </td>)}
            </tr>)}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function CrossCut({ result, onOpen }) {
  return (
    <Panel>
      <div className="scroll">
        <table className="mtx-table">
          <thead><tr><th>Deal</th><th>Signing</th>{result.columns.map((col) => <th key={col.field}>{col.label}</th>)}</tr></thead>
          <tbody>{result.rows.map((row) => <tr key={row.deal_id}>
            <td>{row.deal_name}</td><td className="mtx-mono">{row.signing_date || '-'}</td>
            {row.cells.map((cell, i) => <td key={i} className="mtx-mono mtx-prov-cell" title={cell.verbatim_quote || ''} onClick={() => onOpen({ ...cell, card_id: row.card_id, deal_id: row.deal_id })}>{formatValue(cell.value, result.columns[i] && result.columns[i].field)}{cell._prov && <ProvBadge prov={cell._prov} />}</td>)}
          </tr>)}</tbody>
        </table>
      </div>
    </Panel>
  );
}

function MarketRange({ result, onOpen }) {
  const counts = result.stats ? result.distribution.map((x) => x.count) : result.distribution.map((x) => x.count);
  const max = Math.max(1, ...counts);
  return (
    <Panel>
      <div className="chart">
        {(result.distribution || []).map((bucket, i) => <button key={i} type="button" style={{ height: `${Math.max(12, (bucket.count / max) * 170)}px` }} title={bucket.value || `${bucket.bucket_min} to ${bucket.bucket_max}`}>
          <span>{bucket.count}</span>
        </button>)}
      </div>
      <div className="stats">
        <b className="mtx-mono">n={result.n}</b>
        {result.stats && <><span className="mtx-mono">median {round(result.stats.median)}</span><span className="mtx-mono">p25 {round(result.stats.p25)}</span><span className="mtx-mono">p75 {round(result.stats.p75)}</span><span className="mtx-mono">range {round(result.stats.min)}-{round(result.stats.max)}</span></>}
      </div>
      <details>
        <summary>Underlying deals</summary>
        <table className="mtx-table"><tbody>{result.deal_points.map((point) => <tr key={`${point.deal_id}-${point.card_id}`} onClick={() => onOpen(point)}><td>{point.deal_name}</td><td className="mtx-mono mtx-prov-cell">{formatValue(point.value, result.field_path)}{point._prov && <ProvBadge prov={point._prov} />}</td><td className="mtx-mono">{point.quote_section_ref || '-'}</td></tr>)}</tbody></table>
      </details>
    </Panel>
  );
}

// R (2026-07-19 query-results overhaul): item 6 — the always-visible base
// columns plus whatever feature columns the payload asked for (row.columns'
// keys — the result row shape is { deal_id, deal_name, signing_date,
// total_deal_value, columns:{...} }, distinct from the deals-index row
// shape, so this deliberately does NOT reuse lib/deals-index-columns'
// accessors). 'consideration_type' is a base column even though it lives
// inside row.columns (the query builder always requests it for display).
const FILTER_LIST_BASE_COLUMNS = [
  { key: 'deal_name', label: 'Deal', locked: true },
  { key: 'signing_date', label: 'Signing', mono: true },
  { key: 'total_deal_value', label: 'Value', mono: true },
  { key: 'consideration_type', label: 'Consideration' },
];
const FILTER_LIST_BASE_KEYS = new Set(FILTER_LIST_BASE_COLUMNS.map((col) => col.key));

function filterListColumnValue(row, key) {
  if (key === 'deal_name') return row.deal_name;
  if (key === 'signing_date') return row.signing_date;
  if (key === 'total_deal_value') return row.total_deal_value;
  return row.columns ? row.columns[key] : undefined;
}

function filterListColumnDisplay(row, key) {
  const value = filterListColumnValue(row, key);
  if (key === 'consideration_type') return value ? (considerationTypeDisplay(value) || humanizeKey(value)) : '-';
  if (key === 'signing_date') return value || '-';
  return formatValue(value, key);
}

function availableFilterListColumns(result) {
  const extra = new Set();
  for (const row of result.rows || []) {
    for (const key of Object.keys(row.columns || {})) {
      if (!FILTER_LIST_BASE_KEYS.has(key)) extra.add(key);
    }
  }
  return [...FILTER_LIST_BASE_COLUMNS, ...[...extra].map((key) => ({ key, label: humanizeKey(key) }))];
}

// R (2026-07-19 query-results overhaul): item 3 — "N matched hits" told Ben
// nothing; each hit now carries its own citable quote (filter-then-list.js
// executor change) and expands, collapsed by default, into the actual
// provision span(s) that made the deal match: field label, humanized value,
// the quote text, and its section reference — same clause-block treatment
// as the review page (serif, left-bordered).
function FilterList({ result }) {
  const allColumns = useMemo(() => availableFilterListColumns(result), [result]);
  const [visible, setVisible] = useState(() => new Set(allColumns.map((col) => col.key)));
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [sort, setSort] = useState(null);
  const [expanded, setExpanded] = useState(() => new Set());

  const toggleColumn = (key) => setVisible((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const toggleSort = (key) => setSort((prev) => {
    if (!prev || prev.key !== key) return { key, dir: 'asc' };
    if (prev.dir === 'asc') return { key, dir: 'desc' };
    return null;
  });

  const toggleExpanded = (dealId) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(dealId)) next.delete(dealId); else next.add(dealId);
    return next;
  });

  const rows = useMemo(() => {
    const base = result.rows || [];
    if (!sort) return base;
    const sorted = [...base].sort((a, b) => {
      const av = filterListColumnValue(a, sort.key);
      const bv = filterListColumnValue(b, sort.key);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return av - bv;
      return String(av).localeCompare(String(bv));
    });
    if (sort.dir === 'desc') sorted.reverse();
    return sorted;
  }, [result.rows, sort]);

  const visibleColumns = allColumns.filter((col) => visible.has(col.key));

  return (
    <Panel>
      <div className="listHead">
        <p className="rowCount">{pluralize(result.rows.length, 'deal')}</p>
        <div className="colPicker">
          <button type="button" className="mtx-btn" onClick={() => setColumnsOpen((v) => !v)}>Columns</button>
          {columnsOpen && (
            <div className="colPopover" onMouseLeave={() => setColumnsOpen(false)}>
              {allColumns.map((col) => (
                <label key={col.key}>
                  <input type="checkbox" checked={visible.has(col.key)} disabled={col.locked} onChange={() => toggleColumn(col.key)} />
                  {col.label}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>
      <table className="mtx-table">
        <thead>
          <tr>
            <th className="expandCol" />
            {visibleColumns.map((col) => (
              <th key={col.key} className="sortable" onClick={() => toggleSort(col.key)}>
                {col.label}{sort && sort.key === col.key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const hits = row.matched_provision_hits || [];
            const isOpen = expanded.has(row.deal_id);
            return (
              <Fragment key={row.deal_id}>
                <tr>
                  <td className="expandCol">
                    {hits.length > 0 && (
                      <button type="button" className="term-cell-seetext" onClick={() => toggleExpanded(row.deal_id)}>
                        {isOpen ? '▾ hide' : '▸ show'} provision{hits.length === 1 ? '' : 's'}
                      </button>
                    )}
                  </td>
                  {visibleColumns.map((col) => (
                    <td
                      key={col.key}
                      className={col.mono ? 'mtx-mono' : ''}
                      onClick={col.key === 'deal_name' ? () => { window.location.href = `/review/${row.deal_id}`; } : undefined}
                    >
                      {filterListColumnDisplay(row, col.key)}
                    </td>
                  ))}
                </tr>
                {isOpen && hits.length > 0 && (
                  <tr className="hitsRow">
                    <td colSpan={visibleColumns.length + 1}>
                      {hits.map((hit, i) => (
                        <div key={i} className="hitBlock">
                          <div className="hitLabel"><b>{humanizeKey(hit.field)}</b><span className="mtx-mono">{formatValue(hit.value, hit.field)}</span></div>
                          {hit.quote?.text && <blockquote className="mtx-serif">{hit.quote.text}</blockquote>}
                          {hit.quote?.section_ref && <div className="hitSection mtx-mono">{hit.quote.section_ref}</div>}
                        </div>
                      ))}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </Panel>
  );
}

// E5 (2026-07-19 pre-demo audit): DEAL_TO_MARKET's status is an internal
// scoreValue() enum (lib/query/market-baseline.js), not a provision feature
// — no taxonomy dictionary applies, so it needs its own small label map
// rather than routing through prettifyEnumValue.
const STATUS_LABELS = {
  MARKET: 'Market',
  OFF_MARKET: 'Off-market',
  UNUSUAL: 'Unusual',
  MISSING: 'Missing',
  NOT_APPLICABLE: 'Not applicable',
};

function DealToMarket({ result, onOpen }) {
  const order = ['UNUSUAL', 'OFF_MARKET', 'MARKET', 'MISSING'];
  return (
    <Panel>
      <div className="chips">
        <span className="mtx-badge">{result.summary.market_count} Market</span><span className="mtx-badge">{result.summary.off_market_count} Off-market</span><span className="mtx-badge">{result.summary.unusual_count} Unusual</span><span className="mtx-badge">{result.summary.missing_count} Missing</span>
      </div>
      {order.map((status) => {
        const rows = result.scorecard.filter((row) => row.status === status);
        if (!rows.length) return null;
        return <section key={status}><h2>{STATUS_LABELS[status] || status.replace(/_/g, '-')} ({rows.length})</h2><table className="mtx-table"><tbody>{rows.map((row) => <tr key={`${row.provision_type}-${row.field_path}`} className={status.toLowerCase()} onClick={() => onOpen(row)}><td>{row.field_label}</td><td className="mtx-mono mtx-prov-cell">{formatValue(row.deal_value, row.field_path)}{row._prov && <ProvBadge prov={row._prov} />}</td><td className="mtx-mono">{baseline(row.baseline_stats)}</td><td>{STATUS_LABELS[row.status] || row.status}</td></tr>)}</tbody></table></section>;
      })}
    </Panel>
  );
}

function Panel({ children }) {
  return <div className="panel">{children}<style jsx global>{`
    .mtx.qp .panel { border: 1px solid #E0E0E0; background: #fff; overflow: hidden; padding: 18px; }
    .mtx.qp .scroll { overflow-x: auto; }
    .mtx.qp .mtx-table th small { display: block; margin-top: 4px; color: #6B6B6B; text-transform: none; letter-spacing: 0; }
    .mtx.qp .mtx-table td { cursor: pointer; }
    .mtx.qp .mtx-table td div { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 4px; }
    .mtx.qp .mtx-table td small { color: #6B6B6B; display: block; margin-top: 8px; line-height: 1.35; }
    .mtx.qp .major, .mtx.qp .unusual { background: rgba(177, 78, 99, 0.08); }
    .mtx.qp .minor, .mtx.qp .off_market { background: rgba(168, 122, 46, 0.08); }
    .mtx.qp .trivial, .mtx.qp .market { background: #FFFFFF; }
    .mtx.qp .missing { background: rgba(31, 31, 31, 0.05); }
    .mtx.qp .chart { height: 210px; display: flex; align-items: flex-end; gap: 8px; border-bottom: 1px solid #E0E0E0; padding: 12px 0; }
    .mtx.qp .chart button { flex: 1; min-width: 20px; border: 0; background: #1F1F1F; color: #fff; border-radius: 0; cursor: pointer; }
    .mtx.qp .stats, .mtx.qp .chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 14px 0; }
    .mtx.qp .stats span { border: 1px solid #E0E0E0; padding: 5px 9px; font-size: 12px; color: #1F1F1F; }
    .mtx.qp h2 { font-size: 13px; margin: 22px 0 8px; font-family: var(--mtx-sans); text-transform: uppercase; letter-spacing: 0.08em; color: #6B6B6B; }

    /* item 6 — Columns popover + client sort (FILTER_THEN_LIST only). */
    .mtx.qp .listHead { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    .mtx.qp .rowCount { margin: 0; font-family: var(--mtx-sans); font-size: 12px; color: #6B6B6B; }
    .mtx.qp .colPicker { position: relative; }
    .mtx.qp .colPopover { position: absolute; right: 0; top: calc(100% + 4px); z-index: 6; background: #fff; border: 1px solid #E0E0E0; padding: 8px 10px; min-width: 180px; box-shadow: 0 4px 14px rgba(0,0,0,0.08); }
    .mtx.qp .colPopover label { display: flex; align-items: center; gap: 8px; font-family: var(--mtx-sans); font-size: 12px; color: #1F1F1F; padding: 4px 0; cursor: pointer; }
    .mtx.qp .mtx-table th.sortable { cursor: pointer; user-select: none; }
    .mtx.qp .mtx-table th.expandCol, .mtx.qp .mtx-table td.expandCol { width: 1%; white-space: nowrap; }

    /* item 3 — expandable provision spans, collapsed by default. Same
       "see text" affordance the review page uses (.term-cell-seetext). */
    .mtx.qp .mtx-table td.expandCol { cursor: default; }
    .mtx.qp .hitsRow td { cursor: default; padding: 0; background: #FAFAF9; }
    .mtx.qp .hitBlock { padding: 12px 18px; border-top: 1px solid #EDEDEC; }
    .mtx.qp .hitBlock:first-child { border-top: none; }
    .mtx.qp .hitLabel { display: flex; justify-content: space-between; gap: 12px; font-family: var(--mtx-sans); font-size: 12px; color: #1F1F1F; margin-bottom: 6px; }
    .mtx.qp .hitBlock blockquote { margin: 0 0 6px; padding: 6px 0 6px 12px; border-left: 2px solid #1F1F1F; font-family: var(--mtx-serif); font-size: 13px; line-height: 1.5; color: #1F1F1F; }
    .mtx.qp .hitSection { font-size: 11px; color: #6B6B6B; }
  `}</style></div>;
}

function Drilldown({ item, onClose }) {
  return (
    <>
      <div className="mtx-drawer-backdrop" onClick={onClose} />
      <aside className="mtx-drawer">
        <button type="button" className="mtx-btn" onClick={onClose}>Close</button>
        <h2>Provision card</h2>
        {item.card_id && item.deal_id && <Link href={`/review/${item.deal_id}`} className="mtx-btn">Open deal review</Link>}
        <pre className="mtx-serif">{item.primary_quote?.text || item.verbatim_quote || JSON.stringify(item, null, 2)}</pre>
        <style jsx>{`
          h2 { margin: 14px 0 14px; font-size: 15px; font-family: var(--mtx-sans); }
          pre { white-space: pre-wrap; line-height: 1.5; color: #1F1F1F; margin-top: 12px; }
        `}</style>
      </aside>
    </>
  );
}

// E1/B3 (2026-07-19 pre-demo audit): a raw feature/deal-meta value can be a
// bare USD amount (companyTerminationFee's amount, deals.value_usd) with no
// type tag telling this generic renderer "this one's money" — every query
// tile (DEAL_COMPARE cells, FILTER_THEN_LIST's Value column, MARKET_RANGE,
// DEAL_TO_MARKET) hits the same formatValue() with just a bare number, so a
// $65.5M fee or an $11.5B deal value rendered as "65533735"/"11500000000".
// Percentages/day-counts/etc. never realistically reach 7 figures, so
// >= 1e6 is a safe, field-agnostic money signal — same threshold/shape as
// components/review-v2/DealHeader.jsx's formatDealValue(), reused here
// rather than reinvented (that component isn't importable into this page's
// bundle cleanly, so the small pure function is duplicated, not re-derived).
function trimOneDecimal(x) {
  const s = x.toFixed(1);
  return s.endsWith('.0') ? s.slice(0, -2) : s;
}

function formatMoney(n) {
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 1e9) {
    const b = abs / 1e9;
    return `${sign}$${b >= 100 ? Math.round(b) : trimOneDecimal(b)}B`;
  }
  const m = abs / 1e6;
  return `${sign}$${m >= 100 ? Math.round(m) : trimOneDecimal(m)}M`;
}

// UPPER_SNAKE (or PascalCase-ish ALL-CAPS) is never a legitimate display
// string on this page — it's always a raw enum/code that slipped through.
const RAW_CODE_RE = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/;

// `fieldPath` is optional — pass the requesting field/column key (e.g.
// 'considerationType', 'goShopPresent') so bare enum codes route through
// the same label path the review page uses (prettifyEnumValue) instead of
// rendering the raw extraction code. Callers with no field context (or a
// field prettifyEnumValue doesn't recognize) get the value back unchanged.
//
// R (2026-07-19 query-results overhaul): item 4 — prettifyEnumValue's own
// per-field taxonomy branches (e.g. considerationType) can still echo an
// UPPER_SNAKE code back unchanged when a value falls outside that branch's
// own vocabulary (deal-level codes like STOCK/MIXED_ELECTION hitting the
// provision-level considerationType dictionary). Never let a raw code reach
// the page across ANY query kind — humanize it as a last resort.
function formatValue(value, fieldPath) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') {
    if (Math.abs(value) >= 1e6) return formatMoney(value);
    return round(value);
  }
  const pretty = prettifyEnumValue(fieldPath || '', String(value));
  if (typeof pretty === 'string' && RAW_CODE_RE.test(pretty)) return humanizeKey(pretty);
  return pretty;
}

function round(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  return n.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

function pluralize(n, singular, plural) {
  return `${n} ${n === 1 ? singular : (plural || `${singular}s`)}`;
}

function baseline(stats) {
  if (!stats) return '-';
  if (stats.p25 != null || stats.p75 != null) return `${round(stats.p25)}-${round(stats.p75)}`;
  if (Array.isArray(stats.distribution) && stats.distribution[0]) return stats.distribution[0].value;
  return '-';
}
