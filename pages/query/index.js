import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import MergertraceStyles from '../../components/review-v2/MergertraceStyles';

QueryIndexPage.noLayout = true;

// Kept in sync with lib/query/types.js PROVISION_CARD_TYPES — duplicated
// here rather than imported so the builder stays a pure client bundle (the
// server lib pulls in rubric.js/expected-sets.js, which are Node-oriented
// and unnecessary weight for a dropdown list).
const PROVISION_TYPES = [
  'CONSIDERATION', 'REPRESENTATION', 'MATERIAL_CONTRACT', 'CLOSING_CONDITION',
  'COVENANT_INTERIM_OPERATING', 'COVENANT_NO_SOLICITATION', 'COVENANT_OTHER',
  'TERMINATION_RIGHT', 'TERMINATION_FEE', 'DEFINITION', 'ANTITRUST_REGULATORY',
  'SEC_FILING_MEETING', 'EMPLOYEE_BENEFITS', 'STRUCTURE_MECHANICS', 'MAE',
  'NO_OTHER_REPS', 'MISC_BOILERPLATE',
];

const OPS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains'];
const KIND_LABELS = {
  DEAL_COMPARE: 'Deal compare',
  PROVISION_CROSS_CUT: 'Provision cross-cut',
  MARKET_RANGE: 'Market range',
  FILTER_THEN_LIST: 'Filter then list',
  DEAL_TO_MARKET: 'Deal to market',
};

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
      <Head><title>Query · Mergertrace</title></Head>
      <MergertraceStyles />
      <div className="mtx qi">
        <header className="top">
          <Link href="/" className="brand"><span />Mergertrace</Link>
          <div>
            <h1>Query</h1>
            <p>Structured queries across the precedent corpus</p>
          </div>
          <Link href="/library" className="mtx-btn">Library</Link>
        </header>
        <main>
          <DemoSetSection queries={demoQueries} error={demoError} />
          <FeaturedSection rows={featured} />
          <SavedSection rows={savedQueries} />
          <BuilderSection deals={deals} schemas={kindSchemas} router={router} />
        </main>
      </div>
      <style jsx>{`
        .qi { min-height: 100vh; }
        .top { height: 72px; display: grid; grid-template-columns: 170px 1fr auto; gap: 12px; align-items: center; padding: 0 28px; border-bottom: 1px solid #E0E0E0; background: #fff; position: sticky; top: 0; z-index: 10; }
        .brand { color: #1F1F1F; text-decoration: none; font-size: 20px; font-weight: 650; display: inline-flex; align-items: center; gap: 9px; font-family: var(--mtx-sans); }
        .brand span { width: 9px; height: 9px; background: #1F1F1F; display: inline-block; }
        h1 { margin: 0; font-size: 18px; font-family: var(--mtx-sans); }
        p { margin: 3px 0 0; color: #6B6B6B; font-size: 12px; }
        main { max-width: 1280px; margin: 0 auto; padding: 32px; display: flex; flex-direction: column; gap: 36px; }
        @media (max-width: 900px) {
          .top { grid-template-columns: 1fr; height: auto; padding: 14px; }
          main { padding: 16px; }
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
        .sh h2 { margin: 0 0 4px; font-family: var(--mtx-sans); font-size: 15px; font-weight: 700; }
        .sh p { margin: 0 0 14px; color: #6B6B6B; font-size: 12px; }
      `}</style>
    </div>
  );
}

function DemoSetSection({ queries, error }) {
  return (
    <section>
      <SectionHeader title="Demo queries" subtitle="20 pinned corpus questions (WP-1 demo set) — one click to run." />
      {error && <div className="err">{error}</div>}
      {!queries ? <p className="muted">Loading demo set...</p> : (
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
                <p className="err-small">Unresolved: {q.error}</p>
              </div>
            )
          ))}
        </div>
      )}
      <style jsx>{`
        .tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
        .tile { display: block; border: 1px solid #E0E0E0; background: #fff; padding: 14px; text-decoration: none; color: #1F1F1F; }
        .tile:hover { background: #F6F6F6; }
        .tile-disabled { opacity: 0.55; cursor: not-allowed; }
        .tile h3 { margin: 10px 0 6px; font-size: 13px; font-weight: 650; }
        .tile p { margin: 0; font-size: 12px; color: #6B6B6B; line-height: 1.4; }
        .err-small { color: #B14E63; }
        .err { border: 1px solid #E0E0E0; background: #fff; padding: 12px; color: #B14E63; font-size: 13px; }
        .muted { color: #6B6B6B; font-size: 13px; }
      `}</style>
    </section>
  );
}

function FeaturedSection({ rows }) {
  if (rows && rows.length === 0) return null;
  return (
    <section>
      <SectionHeader title="Featured" subtitle="Admin-curated queries." />
      {!rows ? <p className="muted">Loading...</p> : (
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
        .muted { color: #6B6B6B; font-size: 13px; }
        td :global(a) { color: #1F1F1F; font-weight: 650; text-decoration: none; }
      `}</style>
    </section>
  );
}

function SavedSection({ rows }) {
  return (
    <section>
      <SectionHeader title="Saved queries" subtitle="Your saved-query library." />
      {!rows ? <p className="muted">Loading...</p> : rows.length === 0 ? <p className="muted">No saved queries yet — save one from any result page.</p> : (
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
        .muted { color: #6B6B6B; font-size: 13px; }
        td :global(a) { color: #1F1F1F; font-weight: 650; text-decoration: none; }
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
      setError(err.message || 'Invalid payload');
    } finally {
      setRunning(false);
    }
  };

  const requiredFields = schema?.schema?.required || [];

  return (
    <section>
      <SectionHeader title="Build a query" subtitle="Pick a kind, fill in the fields, run. Payload is validated server-side before it renders." />
      <div className="builder">
        <label className="mtx-meta-label">
          Kind
          <select className="mtx-select" value={kind} onChange={(e) => setKind(e.target.value)}>
            {Object.keys(KIND_LABELS).map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
          </select>
        </label>
        {requiredFields.length > 0 && (
          <p className="req">Required fields: <span className="mtx-mono">{requiredFields.join(', ')}</span></p>
        )}

        {kind === 'FILTER_THEN_LIST' && (
          <FilterListBuilder filters={filters} setFilters={setFilters} provisionTypes={PROVISION_TYPES} ops={OPS} />
        )}

        {kind === 'MARKET_RANGE' && (
          <div className="row">
            <label className="mtx-meta-label">Provision type
              <select className="mtx-select" value={mrProvisionType} onChange={(e) => setMrProvisionType(e.target.value)}>
                {PROVISION_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
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
              <select className="mtx-select" value={ccProvisionType} onChange={(e) => setCcProvisionType(e.target.value)}>
                {PROVISION_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
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
        .builder { border: 1px solid #E0E0E0; background: #fff; padding: 20px; display: flex; flex-direction: column; gap: 14px; max-width: 720px; }
        .builder > label { max-width: 320px; }
        .builder select, .builder input { width: 100%; margin-top: 6px; }
        .req { margin: 0; font-size: 11px; color: #6B6B6B; }
        .row { display: flex; flex-direction: column; gap: 14px; }
        .err { border: 1px solid rgba(177, 78, 99, 0.3); background: rgba(177, 78, 99, 0.06); padding: 10px; color: #B14E63; font-size: 13px; }
      `}</style>
    </section>
  );
}

function FilterListBuilder({ filters, setFilters, provisionTypes, ops }) {
  const update = (i, patch) => setFilters(filters.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  return (
    <div className="fb">
      {filters.map((f, i) => (
        <div className="frow" key={i}>
          <select className="mtx-select" value={f.provision_type} onChange={(e) => update(i, { provision_type: e.target.value })}>
            {provisionTypes.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
          </select>
          <input className="mtx-input" value={f.field} onChange={(e) => update(i, { field: e.target.value })} placeholder="field path" />
          <select className="mtx-select" value={f.op} onChange={(e) => update(i, { op: e.target.value })}>
            {ops.map((op) => <option key={op} value={op}>{op}</option>)}
          </select>
          <input className="mtx-input" value={f.value} onChange={(e) => update(i, { value: e.target.value })} placeholder="value" />
          <button type="button" className="mtx-btn" onClick={() => setFilters(filters.filter((_, idx) => idx !== i))}>Remove</button>
        </div>
      ))}
      <button type="button" className="mtx-btn" onClick={() => setFilters([...filters, { provision_type: 'CONSIDERATION', field: '', op: 'eq', value: '' }])}>+ Add filter</button>
      <style jsx>{`
        .fb { display: flex; flex-direction: column; gap: 8px; }
        .frow { display: grid; grid-template-columns: 1.4fr 1fr 0.7fr 1fr auto; gap: 8px; align-items: center; }
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
        .dms { display: flex; flex-direction: column; gap: 6px; }
        .list { max-height: 180px; overflow: auto; border: 1px solid #E0E0E0; padding: 8px; display: flex; flex-direction: column; gap: 4px; }
        .opt { display: flex; align-items: center; gap: 8px; font-size: 12px; }
      `}</style>
    </div>
  );
}
