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
const { sanitizeQueryError } = require('../../../lib/query/error-sanitize');

QueryPage.noLayout = true;

// D (query error surfaces): a garbage ?payload= (hand-edited URL, a stale/
// truncated share link) used to throw a raw JSON.parse SyntaxError straight
// out of this function and into the effect below's .catch, which rendered
// the bare technical message ("Unexpected token '�', ...") as the entire
// page body. decodePayload itself stays a pure decode -- callers decide how
// to present a failure -- but it's wrapped everywhere it's called so a bad
// link can never throw uncaught.
function decodePayload(value) {
  if (!value) return null;
  const padded = String(value).replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(String(value).length / 4) * 4, '=');
  return JSON.parse(atob(padded));
}

// Thin wrapper: any decode failure (bad base64, truncated JSON, garbage
// bytes) becomes the same friendly "invalid link" message the API route
// (pages/api/query/run.js) now also returns for the same failure mode.
function decodePayloadSafe(value) {
  try {
    return decodePayload(value);
  } catch {
    const err = new Error('This query link is invalid.');
    err.isInvalidLink = true;
    throw err;
  }
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
      .then(async (res) => {
        // D (query error surfaces): a degraded Supabase can make the API
        // route itself unreachable at the platform edge (e.g. a Cloudflare
        // 522), in which case the response body is an HTML error page, not
        // JSON — res.json() throwing here used to surface as a raw
        // SyntaxError with a chunk of that HTML markup pasted into the
        // message. Read as text first and parse ourselves so a non-JSON
        // body gets the friendly sanitizer treatment below instead.
        const text = await res.text();
        try {
          return JSON.parse(text);
        } catch {
          const err = new Error(text);
          err.isNonJsonBody = true;
          throw err;
        }
      })
      .then((json) => {
        if (json.error) throw new Error(json.error);
        setResult(json.result);
        setSavedQuery(json.saved_query || null);
        setCurrentPayload(json.saved_query?.query_payload || (payload ? decodePayloadSafe(payload) : null));
      })
      .catch((err) => setError(sanitizeQueryError(err.message)));
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
              <p className="mtx-meta-label">{id === 'adhoc' ? 'Ad hoc query — not saved yet.' : 'Saved query.'}</p>
            </div>
          )}
        />
        <div className="actions">
          <div className="actionsInner">
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
        /* Same pageTitle voice as /query's own AppHeader center slot: 18px
           650-weight Inter h1 (the DealHeader identity block's h1 sits in
           the same 16-18px bold range), with the subtitle riding the
           app's meta-label voice (9px uppercase, 0.14em tracking, grey) —
           the same treatment DealHeader gives its "ACQUIRED BY" eyebrow —
           rather than a plain lowercase sentence. */
        .pageTitle h1 { margin: 0; font-size: 18px; font-family: var(--mtx-sans); font-weight: 650; color: var(--ink); }
        .pageTitle p { margin: 4px 0 0; font-size: 9px; letter-spacing: 0.14em; }
        .actions { border-bottom: 1px solid var(--line); background: var(--paper); }
        /* A (toolbar regression): this bar used to double up as both
           ".wrap" (the page's max-width-centering/column-stack class also
           used by <main>'s results wrapper) AND ".actionsInner" -- two
           same-specificity classes on one element, so ".wrap"'s
           flex-direction: column/gap: 4px (meant for the results content
           area) silently won over ".actionsInner"'s row layout, stretching
           every button to the full content width (100%) and stacking them
           -- the "Duplicate" primary button read as a giant black banner.
           Give the toolbar its own centering here instead of sharing the
           class, so nothing but this rule controls its layout. */
        .actionsInner { max-width: 1280px; margin: 0 auto; display: flex; flex-direction: row; align-items: center; justify-content: flex-end; gap: 10px; padding: 12px 34px; }
        .actionsInner .mtx-btn { flex: 0 0 auto; width: auto; }
        main { padding: 0; }
        .wrap { max-width: 1280px; margin: 0 auto; padding: 32px 34px; display: flex; flex-direction: column; gap: 4px; }
        .empty { border: 1px solid var(--line); background: var(--paper); padding: 24px; color: var(--ink-light); font-family: var(--mtx-sans); }
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

function DealCompare({ result }) {
  // Deal-compare renders on the review page now (Ben: "just the normal deal
  // review page but with an extra column for the added deal(s)") — this
  // renderer only forwards to /review/<primary>?compare=<rest>. The
  // executor is untouched; result.columns keeps carrying the deal ids.
  const router = useRouter();
  const ids = (result.columns || []).map((col) => col.deal_id).filter(Boolean);
  const enough = ids.length >= 2;
  useEffect(() => {
    if (!enough) return;
    router.replace(`/review/${ids[0]}?compare=${ids.slice(1).join(',')}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enough, ids.join(',')]);
  if (!enough) return <Panel>Less than 2 deals selected. Add another deal to compare.</Panel>;
  return <Panel>Opening review comparison…</Panel>;
}

function CrossCut({ result, onOpen }) {
  return (
    <Panel title={`Provision cross-cut — ${pluralize(result.rows.length, 'deal')}`}>
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

// R (2026-07-19 query-results overhaul): item 2 — the min/median/max stat
// strip now reads as review-page fact tiles (DealHeader's metric-column
// voice: 9px uppercase label over a bold value, divided by a 1px rule)
// instead of the old bordered pill-per-stat row.
function FactTile({ label, value }) {
  return (
    <div className="factTile">
      <p className="factLabel">{label}</p>
      <p className="factValue mtx-mono">{value}</p>
    </div>
  );
}

// B (market-range QA): the stat tiles ("MEDIAN 288500000", "P25
// 51573958.07") and the histogram bucket titles used to print the raw
// numeric stat with no formatting at all, even though the deal rows right
// below already humanize the same field via formatValue()/formatMoney().
// `result.field_kind` is the registry's field type ('usd', 'percent',
// 'number', ...) -- reuse it to pick the right unit instead of assuming
// every numeric stat is money. Also rounds float dust (51573958.07 -> a
// clean money figure) the same way row values already do.
function formatStat(value, fieldKind) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  if (fieldKind === 'usd') return formatMoney(n);
  if (fieldKind === 'percent') return `${round(n)}%`;
  return round(n);
}

function MarketRange({ result, onOpen }) {
  const counts = result.distribution.map((x) => x.count);
  const max = Math.max(1, ...counts);
  const fieldKind = result.field_kind;
  return (
    <>
      <Panel title="Distribution">
        <div className="panelPad">
          <div className="chart">
            {(result.distribution || []).map((bucket, i) => {
              // Min bar height only applies to buckets that actually have
              // deals in them -- a genuinely empty bucket (count 0) used to
              // get the same 12px floor as a 1-count bucket, reading as a
              // real (if small) result. Give it a hairline instead so
              // "empty" and "small" are visually distinguishable.
              const height = bucket.count > 0 ? Math.max(12, (bucket.count / max) * 170) : 2;
              const rangeLabel = bucket.value
                || (bucket.bucket_min !== undefined && bucket.bucket_max !== undefined
                  ? `${formatStat(bucket.bucket_min, fieldKind)}–${formatStat(bucket.bucket_max, fieldKind)}`
                  : '');
              return (
                <div key={i} className="chartBar">
                  <button type="button" style={{ height: `${height}px` }} title={rangeLabel}>
                    <span>{bucket.count}</span>
                  </button>
                  <p className="chartBarLabel mtx-mono" title={rangeLabel}>{rangeLabel}</p>
                </div>
              );
            })}
          </div>
          <div className="factTiles">
            <FactTile label="N" value={result.n} />
            {result.stats && <>
              <FactTile label="Median" value={formatStat(result.stats.median, fieldKind)} />
              <FactTile label="P25" value={formatStat(result.stats.p25, fieldKind)} />
              <FactTile label="P75" value={formatStat(result.stats.p75, fieldKind)} />
              <FactTile label="Range" value={`${formatStat(result.stats.min, fieldKind)}–${formatStat(result.stats.max, fieldKind)}`} />
            </>}
          </div>
        </div>
      </Panel>
      {/* B: "Underlying deals — 29" used to be a collapsed <details> with no
          visual hint that it was a disclosure at all -- it read as a
          missing deal list, not a control. Expanded by default now (Ben's
          bar: don't hide detail without a clear affordance); still a real
          <details> so it CAN be collapsed once seen. */}
      <details className="subPanel" open>
        <summary className="subPanelTitleBar">{`Underlying deals — ${result.deal_points.length}`}</summary>
        <div className="subPanelBody">
          <table className="mtx-table"><tbody>{result.deal_points.map((point) => <tr key={`${point.deal_id}-${point.card_id}`} onClick={() => onOpen(point)}><td>{point.deal_name}</td><td className="mtx-mono mtx-prov-cell">{formatValue(point.value, result.field_path)}{point._prov && <ProvBadge prov={point._prov} />}</td><td className="mtx-mono">{point.quote_section_ref || '-'}</td></tr>)}</tbody></table>
        </div>
      </details>
    </>
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
    <Panel title={`Matching deals — ${result.rows.length}`}>
      <div className="listHead">
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
                          {/* r10c: the standard is a property of an obligation —
                              say what it attaches to, never just that the words
                              occur somewhere in the family. */}
                          {hit.attaches_to && <div className="hitAttach">Attaches to: {hit.attaches_to}</div>}
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

function DealToMarket({ result }) {
  // Deal-to-market renders on the review page now (?market=1: a Market
  // column per section + an "Off-market terms" section on top) — this
  // renderer only forwards there. The executor is untouched;
  // result.deal_id is the payload's deal_id echoed back (see
  // lib/query/executors/deal-to-market.js).
  const router = useRouter();
  const dealId = result.deal_id || (result.deal && result.deal.deal_id) || null;
  useEffect(() => {
    if (dealId) router.replace(`/review/${dealId}?market=1`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId]);
  if (!dealId) return <Panel>Deal not found in this result — re-run the query with a deal selected.</Panel>;
  return <Panel>Opening review comparison…</Panel>;
}

// R (2026-07-19 render-parity pass): every result section now reads as a
// review-page SECTION card — a grey uppercase title bar (same voice as the
// reused ProvisionTable's own `[data-testid^='provision-table-'] > div:
// first-child:has(> p)` title-bar rule in MergertraceStyles) over a white
// body, all colors/sizes pulled from the .mtx custom properties rather than
// restated as one-off hex. `title` is optional so DealCompare/DealToMarket
// (owned by the render-swap in flight elsewhere) keep their existing
// untitled/padded card look unchanged.
function Panel({ title, children }) {
  return (
    <div className={`panel${title ? ' panelTitled' : ''}`}>
      {title && <div className="panelTitleBar"><p>{title}</p></div>}
      {title ? <div className="panelBody">{children}</div> : children}
      <style jsx global>{`
    .mtx.qp .panel { border: 1px solid var(--line); background: var(--paper); overflow: hidden; }
    .mtx.qp .panel:not(.panelTitled) { padding: 18px; }
    .mtx.qp .panelTitleBar { background: var(--paper-2); border-bottom: 1px solid var(--line); padding: 8px 12px; }
    .mtx.qp .panelTitleBar p { margin: 0; font-family: var(--mtx-sans); font-size: 9px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-light); }
    .mtx.qp .panelBody .mtx-table { border: 0; }
    .mtx.qp .panelPad { padding: 18px; }
    .mtx.qp .scroll { overflow-x: auto; }
    .mtx.qp .mtx-table th small { display: block; margin-top: 4px; color: var(--ink-light); text-transform: none; letter-spacing: 0; }
    .mtx.qp .mtx-table td { cursor: pointer; padding: 8px 12px; font-size: 13px; }
    .mtx.qp .mtx-table th { padding: 8px 12px; }
    .mtx.qp .mtx-table td div { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 4px; }
    .mtx.qp .mtx-table td small { color: var(--ink-light); display: block; margin-top: 8px; line-height: 1.35; }
    .mtx.qp .major, .mtx.qp .unusual { background: rgba(177, 78, 99, 0.08); }
    .mtx.qp .minor, .mtx.qp .off_market { background: rgba(168, 122, 46, 0.08); }
    .mtx.qp .trivial, .mtx.qp .market { background: var(--paper); }
    .mtx.qp .missing { background: rgba(31, 31, 31, 0.05); }
    /* B (market-range QA): the bars used to be direct flex children with no
       room for a range label underneath -- each bar is now wrapped in
       .chartBar (bar + label stacked), and the chart's own height grew a
       little to fit the label row without shrinking the bars themselves. */
    .mtx.qp .chart { height: 240px; display: flex; align-items: flex-end; gap: 8px; border-bottom: 1px solid var(--line); padding: 12px 0 0; }
    .mtx.qp .chartBar { flex: 1; min-width: 20px; display: flex; flex-direction: column; align-items: stretch; justify-content: flex-end; height: 100%; }
    .mtx.qp .chartBar button { border: 0; background: var(--ink); color: var(--paper); border-radius: 0; cursor: pointer; width: 100%; }
    .mtx.qp .chartBarLabel { margin: 4px 0 0; font-size: 8.5px; line-height: 1.3; color: var(--ink-light); text-align: center; white-space: nowrap; overflow: hidden; text-overflow: clip; }
    .mtx.qp .chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 14px 0; }
    .mtx.qp h2 { font-size: 13px; margin: 22px 0 8px; font-family: var(--mtx-sans); text-transform: uppercase; letter-spacing: 0.08em; color: var(--ink-light); }

    /* item 2 — market-range stat strip as review-page fact tiles: 9px
       uppercase label over a bold value, DealHeader's metric-column voice. */
    .mtx.qp .factTiles { display: flex; flex-wrap: wrap; margin-top: 14px; }
    .mtx.qp .factTile { padding: 0 16px; }
    .mtx.qp .factTile:first-child { padding-left: 0; }
    .mtx.qp .factTile + .factTile { border-left: 1px solid var(--line); }
    .mtx.qp .factLabel { margin: 0; font-family: var(--mtx-sans); font-size: 9px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-light); }
    .mtx.qp .factValue { margin: 4px 0 0; font-size: 15px; font-weight: 700; color: var(--ink); }

    /* Underlying-deals disclosure — same grey title-bar voice as a Panel,
       via native <details>/<summary> so it stays collapsed by default. */
    .mtx.qp .subPanel { border: 1px solid var(--line); background: var(--paper); margin-top: 18px; }
    .mtx.qp .subPanelTitleBar { display: block; background: var(--paper-2); border-bottom: 1px solid var(--line); padding: 8px 12px; font-family: var(--mtx-sans); font-size: 9px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-light); cursor: pointer; list-style: none; }
    .mtx.qp .subPanelTitleBar::-webkit-details-marker { display: none; }
    .mtx.qp .subPanelBody .mtx-table { border: 0; }

    /* item 6 — Columns popover + client sort (FILTER_THEN_LIST only). */
    .mtx.qp .listHead { display: flex; align-items: center; justify-content: flex-end; padding: 10px 12px; border-bottom: 1px solid var(--line); }
    .mtx.qp .colPicker { position: relative; }
    .mtx.qp .colPopover { position: absolute; right: 0; top: calc(100% + 4px); z-index: 6; background: var(--paper); border: 1px solid var(--line); padding: 8px 10px; min-width: 180px; box-shadow: 0 4px 14px rgba(0,0,0,0.08); }
    .mtx.qp .colPopover label { display: flex; align-items: center; gap: 8px; font-family: var(--mtx-sans); font-size: 12px; color: var(--ink); padding: 4px 0; cursor: pointer; }
    .mtx.qp .mtx-table th.sortable { cursor: pointer; user-select: none; }
    .mtx.qp .mtx-table th.expandCol, .mtx.qp .mtx-table td.expandCol { width: 1%; white-space: nowrap; }

    /* item 3 — expandable provision spans, collapsed by default. Same
       "see text" affordance the review page uses (.term-cell-seetext), and
       the quote itself now takes the review page's exact clause-block
       treatment (ClauseSidebar.jsx: border-l-2 border-[#1F1F1F]
       bg-[#F6F6F6] px-2.5 py-2) rather than a one-off tint. */
    .mtx.qp .mtx-table td.expandCol { cursor: default; }
    .mtx.qp .hitsRow td { cursor: default; padding: 0; background: var(--paper); }
    .mtx.qp .hitBlock { padding: 12px 18px; border-top: 1px solid var(--line); }
    .mtx.qp .hitBlock:first-child { border-top: none; }
    .mtx.qp .hitLabel { display: flex; justify-content: space-between; gap: 12px; font-family: var(--mtx-sans); font-size: 12px; color: var(--ink); margin-bottom: 6px; }
    .mtx.qp .hitAttach { font-family: var(--mtx-sans); font-size: 11px; color: var(--ink-light); margin: -2px 0 6px; }
    .mtx.qp .hitBlock blockquote { margin: 0 0 6px; padding: 8px 10px; border-left: 2px solid var(--ink); background: var(--paper-2); font-family: var(--mtx-serif); font-size: 13px; line-height: 1.5; color: var(--ink); }
    .mtx.qp .hitSection { font-size: 11px; color: var(--ink-light); }
  `}</style>
    </div>
  );
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
          pre { white-space: pre-wrap; line-height: 1.5; color: var(--ink); margin-top: 12px; }
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
