import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';

QueryPage.noLayout = true;

function decodePayload(value) {
  if (!value) return null;
  const padded = String(value).replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(String(value).length / 4) * 4, '=');
  return JSON.parse(atob(padded));
}

function kindLabel(kind) {
  return String(kind || 'Query').replace(/_/g, ' ').replace(/-/g, ' ');
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
      router.replace(`/newhome/query/${String(kind)}/${json.saved_query.id}`);
    } catch (err) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Head><title>{`${title} · Corpus`}</title></Head>
      <div className="qp">
        <header className="top">
          <Link href="/newhome" className="brand"><span />Corpus</Link>
          <div>
            <h1>{title}</h1>
            <p>{id === 'adhoc' ? 'Ad hoc query' : 'Saved query'}</p>
          </div>
          <button type="button" onClick={() => navigator.clipboard?.writeText(window.location.href)}>Share</button>
          <button type="button" disabled={!canPersist || saving || id !== 'adhoc'} onClick={() => saveQuery(false)}>{saving ? 'Saving' : 'Save'}</button>
          <button type="button" disabled={!canPersist || saving} onClick={() => saveQuery(true)}>Duplicate</button>
        </header>
        <main>
          {error ? <div className="empty">{error}</div> : !result ? <div className="empty">Loading query...</div> : <ResultView result={result} onOpen={setActive} />}
        </main>
        {active && <Drilldown item={active} onClose={() => setActive(null)} />}
      </div>
      <style jsx>{`
        .qp { min-height: 100vh; background: var(--paper); color: var(--ink); }
        .top { height: 72px; display: grid; grid-template-columns: 170px 1fr auto auto auto; gap: 12px; align-items: center; padding: 0 28px; border-bottom: 1px solid var(--line); background: #fff; position: sticky; top: 0; z-index: 10; }
        .brand { color: var(--ink); text-decoration: none; font-size: 22px; font-weight: 650; display: inline-flex; align-items: center; gap: 9px; }
        .brand span { width: 9px; height: 9px; border-radius: 2px; background: var(--accent); display: inline-block; }
        h1 { margin: 0; font-size: 20px; text-transform: capitalize; }
        p { margin: 3px 0 0; color: var(--ink-light); font-size: 12px; }
        button, a.action { border: 1px solid var(--line); background: #fff; border-radius: 7px; height: 34px; padding: 0 11px; color: var(--ink); font: inherit; font-size: 13px; text-decoration: none; display: inline-flex; align-items: center; }
        main { max-width: 1280px; margin: 0 auto; padding: 32px; }
        .empty { border: 1px solid var(--line); background: #fff; border-radius: 8px; padding: 24px; color: var(--ink-light); }
        @media (max-width: 820px) {
          .top { grid-template-columns: 1fr; height: auto; padding: 14px; }
          main { padding: 16px; }
        }
      `}</style>
    </>
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
        <table>
          <thead><tr><th>Provision</th>{result.columns.map((col) => <th key={col.deal_id}>{col.deal_name}<small>{col.signing_date}</small></th>)}</tr></thead>
          <tbody>
            {result.rows.map((row) => <tr key={row.provision_type}>
              <th>{row.provision_type.replace(/_/g, ' ')}</th>
              {row.cells.map((cell) => <td key={cell.deal_id} className={cell.delta_severity.toLowerCase()} onClick={() => onOpen(cell)}>
                {cell.key_fields.map((field) => <div key={field.field}><b>{field.label}</b><span>{formatValue(field.value)}</span></div>)}
                {cell.primary_quote?.text && <small>{cell.primary_quote.text.slice(0, 220)}</small>}
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
        <table>
          <thead><tr><th>Deal</th><th>Signing</th>{result.columns.map((col) => <th key={col.field}>{col.label}</th>)}</tr></thead>
          <tbody>{result.rows.map((row) => <tr key={row.deal_id}>
            <td>{row.deal_name}</td><td>{row.signing_date || '-'}</td>
            {row.cells.map((cell, i) => <td key={i} title={cell.verbatim_quote || ''} onClick={() => onOpen({ ...cell, card_id: row.card_id, deal_id: row.deal_id })}>{formatValue(cell.value)}</td>)}
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
        <b>n={result.n}</b>
        {result.stats && <><span>median {round(result.stats.median)}</span><span>p25 {round(result.stats.p25)}</span><span>p75 {round(result.stats.p75)}</span><span>range {round(result.stats.min)}-{round(result.stats.max)}</span></>}
      </div>
      <details>
        <summary>Underlying deals</summary>
        <table><tbody>{result.deal_points.map((point) => <tr key={`${point.deal_id}-${point.card_id}`} onClick={() => onOpen(point)}><td>{point.deal_name}</td><td>{formatValue(point.value)}</td><td>{point.quote_section_ref || '-'}</td></tr>)}</tbody></table>
      </details>
    </Panel>
  );
}

function FilterList({ result }) {
  return (
    <Panel>
      <div className="chips">{result.filters_applied.map((f, i) => <span key={i}>{f.field} {f.op} {String(f.value)}</span>)}</div>
      <table><thead><tr><th>Deal</th><th>Signing</th><th>Value</th><th>Consideration</th><th>Matched hits</th></tr></thead>
        <tbody>{result.rows.map((row) => <tr key={row.deal_id} onClick={() => { window.location.href = `/review/${row.deal_id}`; }}><td>{row.deal_name}</td><td>{row.signing_date || '-'}</td><td>{formatValue(row.columns.total_deal_value)}</td><td>{row.columns.consideration_type || '-'}</td><td>{row.matched_provision_hits.length} matches</td></tr>)}</tbody>
      </table>
    </Panel>
  );
}

function DealToMarket({ result, onOpen }) {
  const order = ['UNUSUAL', 'OFF_MARKET', 'MARKET', 'MISSING'];
  return (
    <Panel>
      <div className="chips">
        <span>{result.summary.market_count} Market</span><span>{result.summary.off_market_count} Off-market</span><span>{result.summary.unusual_count} Unusual</span><span>{result.summary.missing_count} Missing</span>
      </div>
      {order.map((status) => {
        const rows = result.scorecard.filter((row) => row.status === status);
        if (!rows.length) return null;
        return <section key={status}><h2>{status.replace(/_/g, '-')} ({rows.length})</h2><table><tbody>{rows.map((row) => <tr key={`${row.provision_type}-${row.field_path}`} className={status.toLowerCase()} onClick={() => onOpen(row)}><td>{row.field_label}</td><td>{formatValue(row.deal_value)}</td><td>{baseline(row.baseline_stats)}</td><td>{row.status}</td></tr>)}</tbody></table></section>;
      })}
    </Panel>
  );
}

function Panel({ children }) {
  return <div className="panel">{children}<style jsx global>{`
    .qp .panel { border: 1px solid var(--line); border-radius: 8px; background: #fff; overflow: hidden; padding: 18px; }
    .qp .scroll { overflow-x: auto; }
    .qp table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .qp th, .qp td { border-bottom: 1px solid var(--line-soft); padding: 10px; text-align: left; vertical-align: top; }
    .qp th { color: var(--ink-faint); text-transform: uppercase; font-size: 11px; letter-spacing: .1em; background: var(--paper-2); }
    .qp th small { display: block; margin-top: 4px; color: var(--ink-light); text-transform: none; letter-spacing: 0; }
    .qp td { cursor: pointer; }
    .qp td div { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 4px; }
    .qp td small { color: var(--ink-light); display: block; margin-top: 8px; line-height: 1.35; }
    .qp .major, .qp .unusual { background: color-mix(in srgb, var(--seller) 12%, #fff); }
    .qp .minor, .qp .off_market { background: #fff7e4; }
    .qp .trivial, .qp .market { background: var(--paper); }
    .qp .missing { background: color-mix(in srgb, var(--accent) 10%, #fff); }
    .qp .chart { height: 210px; display: flex; align-items: flex-end; gap: 8px; border-bottom: 1px solid var(--line); padding: 12px 0; }
    .qp .chart button { flex: 1; min-width: 20px; border: 0; background: var(--accent); color: #fff; border-radius: 4px 4px 0 0; cursor: pointer; }
    .qp .stats, .qp .chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 14px 0; }
    .qp .stats span, .qp .chips span { border: 1px solid var(--line); border-radius: 999px; padding: 5px 9px; font-size: 12px; color: var(--ink-mid); }
    .qp h2 { font-size: 14px; margin: 22px 0 8px; }
  `}</style></div>;
}

function Drilldown({ item, onClose }) {
  return (
    <aside className="drawer">
      <button type="button" onClick={onClose}>Close</button>
      <h2>Provision card</h2>
      {item.card_id && item.deal_id && <Link href={`/review/${item.deal_id}/provision/${item.card_id}`}>Open deal review</Link>}
      <pre>{item.primary_quote?.text || item.verbatim_quote || JSON.stringify(item, null, 2)}</pre>
      <style jsx>{`
        .drawer { position: fixed; top: 0; right: 0; bottom: 0; width: min(520px, 92vw); background: #fff; border-left: 1px solid var(--line); box-shadow: -18px 0 60px rgba(0,0,0,.16); z-index: 40; padding: 22px; overflow: auto; }
        button { float: right; border: 1px solid var(--line); background: #fff; border-radius: 7px; height: 32px; padding: 0 10px; }
        h2 { margin: 8px 0 14px; }
        a { color: var(--accent-deep); font-weight: 650; }
        pre { white-space: pre-wrap; font-family: var(--font-sans); line-height: 1.45; color: var(--ink-mid); }
      `}</style>
    </aside>
  );
}

function formatValue(value) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return round(value);
  return String(value);
}

function round(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  return n.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

function baseline(stats) {
  if (!stats) return '-';
  if (stats.p25 != null || stats.p75 != null) return `${round(stats.p25)}-${round(stats.p75)}`;
  if (Array.isArray(stats.distribution) && stats.distribution[0]) return stats.distribution[0].value;
  return '-';
}
