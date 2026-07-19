import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import MergertraceStyles from '../../../components/review-v2/MergertraceStyles';
import AppHeader from '../../../components/chrome/AppHeader';
const { toCsv, resultToCsvRows, csvFilename } = require('../../../lib/query/csv');
const { describeFilter } = require('../../../lib/query/filter-labels');
// E5 (2026-07-19 pre-demo audit): the review page's own "same label path"
// for bare enum codes ("ALL_CASH" -> "All cash") — reused here rather than
// re-implemented so the query surface never drifts from the review page's
// mapping.
const { prettifyEnumValue } = require('../../../components/review/shared');

QueryPage.noLayout = true;

function decodePayload(value) {
  if (!value) return null;
  const padded = String(value).replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(String(value).length / 4) * 4, '=');
  return JSON.parse(atob(padded));
}

function kindLabel(kind) {
  return String(kind || 'Query').replace(/_/g, ' ').replace(/-/g, ' ');
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

  const title = useMemo(() => savedQuery?.title || (result ? kindLabel(result.kind) : kindLabel(kind)), [savedQuery, result, kind]);
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
        .pageTitle h1 { margin: 0; font-size: 18px; text-transform: capitalize; font-family: var(--mtx-sans); font-weight: 650; color: var(--ink); }
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

function FilterList({ result }) {
  return (
    <Panel>
      <div className="chips">{result.filters_applied.map((f, i) => <span key={i} className="mtx-badge filterChip" title={`${f.field} ${f.op} ${String(f.value)}`}>{describeFilter(f).text}</span>)}</div>
      <table className="mtx-table"><thead><tr><th>Deal</th><th>Signing</th><th>Value</th><th>Consideration</th><th>Matched hits</th></tr></thead>
        <tbody>{result.rows.map((row) => <tr key={row.deal_id} onClick={() => { window.location.href = `/review/${row.deal_id}`; }}><td>{row.deal_name}</td><td className="mtx-mono">{row.signing_date || '-'}</td><td className="mtx-mono">{formatValue(row.columns.total_deal_value, 'total_deal_value')}</td><td>{prettifyEnumValue('considerationType', row.columns.consideration_type) || '-'}</td><td className="mtx-mono">{pluralize(row.matched_provision_hits.length, 'match', 'matches')}</td></tr>)}</tbody>
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
    .mtx .filterChip { text-transform: none; letter-spacing: 0.01em; font-weight: 500; }
    .mtx.qp .stats span { border: 1px solid #E0E0E0; padding: 5px 9px; font-size: 12px; color: #1F1F1F; }
    .mtx.qp h2 { font-size: 13px; margin: 22px 0 8px; font-family: var(--mtx-sans); text-transform: uppercase; letter-spacing: 0.08em; color: #6B6B6B; }
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
        <pre>{item.primary_quote?.text || item.verbatim_quote || JSON.stringify(item, null, 2)}</pre>
        <style jsx>{`
          h2 { margin: 14px 0 14px; font-size: 15px; }
          pre { white-space: pre-wrap; font-family: var(--mtx-serif); line-height: 1.5; color: #1F1F1F; margin-top: 12px; }
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

// `fieldPath` is optional — pass the requesting field/column key (e.g.
// 'considerationType', 'goShopPresent') so bare enum codes route through
// the same label path the review page uses (prettifyEnumValue) instead of
// rendering the raw extraction code. Callers with no field context (or a
// field prettifyEnumValue doesn't recognize) get the value back unchanged.
function formatValue(value, fieldPath) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') {
    if (Math.abs(value) >= 1e6) return formatMoney(value);
    return round(value);
  }
  return prettifyEnumValue(fieldPath || '', String(value));
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
