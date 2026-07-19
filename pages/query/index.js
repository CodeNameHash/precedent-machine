import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import MergertraceStyles from '../../components/review-v2/MergertraceStyles';
import AppHeader from '../../components/chrome/AppHeader';
import { MtxFontLinks } from '../../components/chrome/mtxFonts';
import { humanizeKey, describeFilter } from '../../lib/query/filter-labels';
import { PROVISION_TYPES, OpSelect, ProvisionTypeSelect, FilterValueInput } from '../../components/query/QueryFilterControls';

QueryIndexPage.noLayout = true;

const KIND_LABELS = {
  DEAL_COMPARE: 'Deal compare',
  PROVISION_CROSS_CUT: 'Provision cross-cut',
  MARKET_RANGE: 'Market range',
  FILTER_THEN_LIST: 'Filter then list',
  DEAL_TO_MARKET: 'Deal to market',
};

// requiredFieldSentence: "filters, sort_by, columns" -> "the filters, the
// sort order, and the columns to show" — item 4's ask to replace the terse
// "required fields: X, Y" enum dump with a plain sentence. Kept local (not
// in lib/query/filter-labels.js) since it's schema-key -> prose, a
// different job than the field-value humanizing that module does.
const REQUIRED_FIELD_PHRASES = {
  filters: 'the filters',
  sort_by: 'the sort order',
  columns: 'the columns to show',
  deal_ids: 'the deals',
  provision_types: 'the provision types',
  provision_type: 'the provision type',
  field_path: 'the field to chart',
  deal_filter: 'the deal filter',
  chart_kind: 'the chart type',
  highlight_deltas: 'whether to highlight differences',
  included_field_groups: 'the field groups to include',
  deal_id: 'the deal',
  comparison_set_filter: 'the comparison set',
};

function requiredFieldsSentence(fields) {
  if (!fields || !fields.length) return null;
  const phrases = fields.map((f) => REQUIRED_FIELD_PHRASES[f] || humanizeKey(f).toLowerCase());
  let list;
  if (phrases.length === 1) list = phrases[0];
  else if (phrases.length === 2) list = `${phrases[0]} and ${phrases[1]}`;
  else list = `${phrases.slice(0, -1).join(', ')}, and ${phrases[phrases.length - 1]}`;
  return `This query needs ${list} before it can run.`;
}

function dealLabel(deal) {
  return `${deal.acquirer || 'Buyer'} / ${deal.target || 'Target'}`;
}

function encodePayloadClient(payload) {
  const b64 = btoa(JSON.stringify(payload));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export default function QueryIndexPage() {
  const router = useRouter();
  const [demoQueries, setDemoQueries] = useState(null);
  const [demoError, setDemoError] = useState(null);
  const [savedQueries, setSavedQueries] = useState(null);
  const [featured, setFeatured] = useState(null);
  const [deals, setDeals] = useState([]);
  const [kindSchemas, setKindSchemas] = useState(null);

  useEffect(() => {
    fetch('/api/query/demo-set').then((r) => r.json()).then((json) => {
      if (json.error) throw new Error(json.error);
      setDemoQueries(json.queries || []);
    }).catch((err) => setDemoError(err.message));
    fetch('/api/saved-queries').then((r) => r.json()).then((json) => setSavedQueries(json.saved_queries || [])).catch(() => setSavedQueries([]));
    fetch('/api/saved-queries?featured=1').then((r) => r.json()).then((json) => setFeatured(json.saved_queries || [])).catch(() => setFeatured([]));
    fetch('/api/deals').then((r) => r.json()).then((json) => setDeals(json.deals || json.rows || [])).catch(() => setDeals([]));
    fetch('/api/query/kinds').then((r) => r.json()).then((json) => setKindSchemas(json.kinds || [])).catch(() => setKindSchemas([]));
  }, []);

  return (
    <>
      <Head>
        <title>Query · Corpus</title>
        <MtxFontLinks />
      </Head>
      <MergertraceStyles />
      <div className="mtx nh">
        <AppHeader
          active="query"
          center={(
            <div className="pageTitle">
              <h1>Query</h1>
              <p>Structured queries across the precedent corpus.</p>
            </div>
          )}
        />
        <main>
          <div className="wrap">
            {/* Item 2: Build a Query first, then Saved Queries, then
                everything else (featured picks, the demo tile wall). */}
            <BuilderSection deals={deals} schemas={kindSchemas} router={router} />
            <SavedSection rows={savedQueries} />
            <FeaturedSection rows={featured} />
            <DemoSetSection queries={demoQueries} error={demoError} />
          </div>
        </main>
      </div>
      <style jsx>{`
        .nh { min-height: 100vh; background: var(--paper); color: var(--ink); font-family: var(--mtx-sans); }
        .pageTitle h1 { margin: 0; font-size: 18px; font-family: var(--mtx-sans); font-weight: 650; color: var(--ink); }
        .pageTitle p { margin: 3px 0 0; color: var(--ink-light); font-size: 12px; font-family: var(--mtx-sans); }
        .wrap { max-width: 1280px; margin: 0 auto; padding: 34px; display: flex; flex-direction: column; gap: 36px; }
        @media (max-width: 900px) {
          .wrap { padding: 16px; }
        }
      `}</style>
    </>
  );
}

function SectionHeader({ title, subtitle }) {
  return (
    <div className="sh">
      <h2>{title}</h2>
      {subtitle && <p>{subtitle}</p>}
      <style jsx>{`
        .sh h2 { margin: 0 0 4px; font-family: var(--mtx-sans); font-size: 15px; font-weight: 700; color: var(--ink); }
        .sh p { margin: 0 0 14px; color: var(--ink-light); font-size: 12px; font-family: var(--mtx-sans); }
      `}</style>
    </div>
  );
}

function DemoSetSection({ queries, error }) {
  return (
    <section>
      <SectionHeader title="Demo queries" subtitle="20 pinned corpus questions (WP-1 demo set) — one click to run." />
      {error && <div className="err">{error}</div>}
      {!queries ? <p className="muted">Loading demo set…</p> : (
        <div className="tiles">
          {queries.map((q) => (
            q.href ? (
              <Link key={q.id} href={q.href} className="tile">
                <span className="mtx-badge">{KIND_LABELS[q.kind] || q.kind}</span>
                <h3>{q.title}</h3>
                <p>{q.question}</p>
              </Link>
            ) : (
              <div key={q.id} className="tile tile-disabled" title={q.error}>
                <span className="mtx-badge">{KIND_LABELS[q.kind] || q.kind}</span>
                <h3>{q.title}</h3>
                <p className="err-small">This query can&rsquo;t run right now: {q.error}</p>
              </div>
            )
          ))}
        </div>
      )}
      <style jsx>{`
        .tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
        .tile { display: block; border: 1px solid var(--line); background: #fff; padding: 14px; text-decoration: none; color: var(--ink); font-family: var(--mtx-sans); }
        .tile:hover { background: var(--paper-2); }
        .tile-disabled { opacity: 0.55; cursor: not-allowed; }
        .tile h3 { margin: 10px 0 6px; font-size: 13px; font-weight: 650; font-family: var(--mtx-sans); }
        .tile p { margin: 0; font-size: 12px; color: var(--ink-light); line-height: 1.4; font-family: var(--mtx-sans); }
        .err-small { color: #B14E63; }
        .err { border: 1px solid var(--line); background: #fff; padding: 12px; color: #B14E63; font-size: 13px; font-family: var(--mtx-sans); }
        .muted { color: var(--ink-light); font-size: 13px; font-family: var(--mtx-sans); }
      `}</style>
    </section>
  );
}

function FeaturedSection({ rows }) {
  if (rows && rows.length === 0) return null;
  return (
    <section>
      <SectionHeader title="Featured" subtitle="Admin-curated queries." />
      {!rows ? <p className="muted">Loading…</p> : (
        <table className="mtx-table">
          <thead><tr><th>Title</th><th>Kind</th><th>Description</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td><Link href={`/query/${row.query_kind.toLowerCase().replace(/_/g, '-')}/${row.id}`}>{row.title}</Link></td>
                <td>{KIND_LABELS[row.query_kind] || row.query_kind}</td>
                <td>{row.description || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <style jsx>{`
        .muted { color: var(--ink-light); font-size: 13px; font-family: var(--mtx-sans); }
        td :global(a) { color: var(--ink); font-weight: 650; text-decoration: none; }
      `}</style>
    </section>
  );
}

function SavedSection({ rows }) {
  return (
    <section>
      <SectionHeader title="Saved queries" subtitle="Your saved-query library." />
      {!rows ? <p className="muted">Loading…</p> : rows.length === 0 ? <p className="muted">No saved queries yet — save one from any result page.</p> : (
        <table className="mtx-table">
          <thead><tr><th>Title</th><th>Kind</th><th>Last run</th><th>Runs</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td><Link href={`/query/${row.query_kind.toLowerCase().replace(/_/g, '-')}/${row.id}`}>{row.title}</Link></td>
                <td>{KIND_LABELS[row.query_kind] || row.query_kind}</td>
                <td className="mtx-mono">{row.last_run_at ? new Date(row.last_run_at).toLocaleString() : '-'}</td>
                <td className="mtx-mono">{row.run_count || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <style jsx>{`
        .muted { color: var(--ink-light); font-size: 13px; font-family: var(--mtx-sans); }
        td :global(a) { color: var(--ink); font-weight: 650; text-decoration: none; }
      `}</style>
    </section>
  );
}


function BuilderSection({ deals, schemas, router }) {
  const [kind, setKind] = useState('FILTER_THEN_LIST');
  const [error, setError] = useState(null);
  const [running, setRunning] = useState(false);

  // FILTER_THEN_LIST state
  const [filters, setFilters] = useState([{ provision_type: 'COVENANT_NO_SOLICITATION', field: 'forceTheVote', op: 'eq', value: 'true' }]);
  // MARKET_RANGE state
  const [mrProvisionType, setMrProvisionType] = useState('TERMINATION_FEE');
  const [mrField, setMrField] = useState('companyTerminationFee');
  const [mrChart, setMrChart] = useState('HISTOGRAM');
  // PROVISION_CROSS_CUT state
  const [ccProvisionType, setCcProvisionType] = useState('COVENANT_NO_SOLICITATION');
  const [ccDealIds, setCcDealIds] = useState([]);
  const [ccColumns, setCcColumns] = useState('forceTheVote, goShopPresent');
  // DEAL_COMPARE state
  const [dcDealIds, setDcDealIds] = useState([]);
  const [dcProvisionTypes, setDcProvisionTypes] = useState(['CONSIDERATION', 'TERMINATION_FEE']);
  // DEAL_TO_MARKET state
  const [dtmDealId, setDtmDealId] = useState('');

  const schema = useMemo(() => (schemas || []).find((s) => s.kind === kind), [schemas, kind]);

  const buildPayload = () => {
    if (kind === 'FILTER_THEN_LIST') {
      return {
        filters: filters.map((f) => ({ ...f, value: f.value === 'true' ? true : f.value === 'false' ? false : (Number.isNaN(Number(f.value)) || f.value === '' ? f.value : Number(f.value)) })),
        sort_by: 'deal_signing_date_desc',
        columns: ['deal_name', 'signing_date', 'consideration_type', 'total_deal_value'],
      };
    }
    if (kind === 'MARKET_RANGE') {
      return { provision_type: mrProvisionType, field_path: mrField, deal_filter: {}, chart_kind: mrChart };
    }
    if (kind === 'PROVISION_CROSS_CUT') {
      return {
        provision_type: ccProvisionType,
        provision_subtype: null,
        deal_ids: ccDealIds,
        columns: ccColumns.split(',').map((s) => s.trim()).filter(Boolean),
        sort_by: 'deal_signing_date_desc',
      };
    }
    if (kind === 'DEAL_COMPARE') {
      return { deal_ids: dcDealIds, provision_types: dcProvisionTypes, highlight_deltas: true, included_field_groups: ['primary', 'qualifiers'] };
    }
    if (kind === 'DEAL_TO_MARKET') {
      return { deal_id: dtmDealId, comparison_set_filter: {}, provision_types: null };
    }
    return {};
  };

  const run = async () => {
    setError(null);
    const payload = buildPayload();
    setRunning(true);
    try {
      const res = await fetch('/api/query/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, query_payload: payload }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      const slug = kind.toLowerCase().replace(/_/g, '-');
      router.push(`/query/${slug}/adhoc?payload=${encodePayloadClient(payload)}`);
    } catch (err) {
      setError(err.message || 'That combination of fields isn’t valid — check the values above and try again.');
    } finally {
      setRunning(false);
    }
  };

  const requiredSentence = requiredFieldsSentence(schema?.schema?.required);

  return (
    <section>
      <SectionHeader title="Build a query" subtitle="Pick a kind, fill in the fields, run. The payload is validated on the server before it renders." />
      <div className="builder">
        <label className="mtx-meta-label">
          Kind
          <select className="mtx-select" value={kind} onChange={(e) => setKind(e.target.value)}>
            {Object.keys(KIND_LABELS).map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
          </select>
        </label>
        {requiredSentence && <p className="req">{requiredSentence}</p>}

        {kind === 'FILTER_THEN_LIST' && (
          <FilterListBuilder filters={filters} setFilters={setFilters} provisionTypes={PROVISION_TYPES} />
        )}

        {kind === 'MARKET_RANGE' && (
          <div className="row">
            <label className="mtx-meta-label">Provision type
              <ProvisionTypeSelect value={mrProvisionType} onChange={setMrProvisionType} />
            </label>
            <label className="mtx-meta-label">Field path
              <input className="mtx-input" value={mrField} onChange={(e) => setMrField(e.target.value)} placeholder="e.g. companyTerminationFee" />
            </label>
            <label className="mtx-meta-label">Chart
              <select className="mtx-select" value={mrChart} onChange={(e) => setMrChart(e.target.value)}>
                <option value="HISTOGRAM">Histogram</option>
                <option value="BOX">Box</option>
                <option value="BAR">Bar</option>
              </select>
            </label>
          </div>
        )}

        {kind === 'PROVISION_CROSS_CUT' && (
          <div className="row">
            <label className="mtx-meta-label">Provision type
              <ProvisionTypeSelect value={ccProvisionType} onChange={setCcProvisionType} />
            </label>
            <label className="mtx-meta-label">Columns (comma-separated field paths)
              <input className="mtx-input" value={ccColumns} onChange={(e) => setCcColumns(e.target.value)} />
            </label>
            <DealMultiSelect deals={deals} selected={ccDealIds} onChange={setCcDealIds} label="Deals" />
          </div>
        )}

        {kind === 'DEAL_COMPARE' && (
          <div className="row">
            <DealMultiSelect deals={deals} selected={dcDealIds} onChange={setDcDealIds} label="Deals (2-4)" />
            <label className="mtx-meta-label">Provision types (comma-separated)
              <input className="mtx-input" value={dcProvisionTypes.join(', ')} onChange={(e) => setDcProvisionTypes(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} />
            </label>
          </div>
        )}

        {kind === 'DEAL_TO_MARKET' && (
          <div className="row">
            <label className="mtx-meta-label">Deal
              <select className="mtx-select" value={dtmDealId} onChange={(e) => setDtmDealId(e.target.value)}>
                <option value="">Select a deal…</option>
                {deals.map((d) => <option key={d.id} value={d.id}>{dealLabel(d)}</option>)}
              </select>
            </label>
          </div>
        )}

        {error && <div className="err">{error}</div>}
        <button type="button" className="mtx-btn mtx-btn-primary" disabled={running} onClick={run}>{running ? 'Running…' : 'Build & run'}</button>
      </div>
      <style jsx>{`
        .builder { border: 1px solid var(--line); background: #fff; padding: 20px; display: flex; flex-direction: column; gap: 14px; max-width: 720px; font-family: var(--mtx-sans); }
        .builder > label { max-width: 320px; font-family: var(--mtx-sans); }
        .builder select, .builder input { width: 100%; margin-top: 6px; }
        .req { margin: 0; font-size: 12px; color: var(--ink-light); font-family: var(--mtx-sans); line-height: 1.5; }
        .row { display: flex; flex-direction: column; gap: 14px; }
        .err { border: 1px solid rgba(177, 78, 99, 0.3); background: rgba(177, 78, 99, 0.06); padding: 10px; color: #B14E63; font-size: 13px; font-family: var(--mtx-sans); }
      `}</style>
    </section>
  );
}

function FilterListBuilder({ filters, setFilters, provisionTypes }) {
  const update = (i, patch) => setFilters(filters.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  return (
    <div className="fb">
      {filters.map((f, i) => (
        <div className="frow" key={i}>
          <ProvisionTypeSelect value={f.provision_type} onChange={(v) => update(i, { provision_type: v })} types={provisionTypes} />
          <input className="mtx-input" value={f.field} onChange={(e) => update(i, { field: e.target.value })} placeholder="field path" />
          <OpSelect value={f.op} onChange={(v) => update(i, { op: v })} />
          <FilterValueInput value={f.value} onChange={(v) => update(i, { value: v })} />
          <span className="preview">{describeFilter(f).text}</span>
          <button type="button" className="mtx-btn" onClick={() => setFilters(filters.filter((_, idx) => idx !== i))}>Remove</button>
        </div>
      ))}
      <button type="button" className="mtx-btn" onClick={() => setFilters([...filters, { provision_type: 'CONSIDERATION', field: '', op: 'eq', value: '' }])}>+ Add filter</button>
      <style jsx>{`
        .fb { display: flex; flex-direction: column; gap: 8px; }
        .frow { display: grid; grid-template-columns: 1.4fr 1fr 0.9fr 1fr auto; gap: 8px; align-items: center; }
        .preview { grid-column: 1 / -1; font-size: 11px; color: var(--ink-light); font-family: var(--mtx-sans); }
      `}</style>
    </div>
  );
}

function DealMultiSelect({ deals, selected, onChange, label }) {
  const toggle = (id) => {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  };
  return (
    <div className="dms">
      <span className="mtx-meta-label">{label}</span>
      <div className="list">
        {deals.map((d) => (
          <label key={d.id} className="opt">
            <input type="checkbox" checked={selected.includes(d.id)} onChange={() => toggle(d.id)} />
            <span>{dealLabel(d)}</span>
          </label>
        ))}
      </div>
      <style jsx>{`
        .dms { display: flex; flex-direction: column; gap: 6px; font-family: var(--mtx-sans); }
        .list { max-height: 180px; overflow: auto; border: 1px solid var(--line); padding: 8px; display: flex; flex-direction: column; gap: 4px; }
        .opt { display: flex; align-items: center; gap: 8px; font-size: 12px; font-family: var(--mtx-sans); }
      `}</style>
    </div>
  );
}
