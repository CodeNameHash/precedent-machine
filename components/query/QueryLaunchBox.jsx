// Compact query launcher — a single clean .mtx panel meant to sit at the
// top of the deals index page (pages/index.js), above the deal table, under
// a "Launch Query" heading. NOT the full builder (pages/query/index.js's
// BuilderSection): one deal-type filter, one kind-specific parameter row,
// Run. Anything more elaborate (multi-deal compare/cross-cut pickers) links
// out to the full builder instead of trying to fit in this box.
//
// Embed usage (index.js integration — left to a follow-up pass per Ben's
// note, this worktree only builds + exports the component):
//
//   import QueryLaunchBox from '../components/query/QueryLaunchBox';
//   ...
//   <h2>Launch Query</h2>
//   <QueryLaunchBox deals={deals} />
//
// `deals` is optional — pass the same array the index page already has
// (from /api/home) to avoid a second fetch; omitted, the box fetches
// /api/deals itself so it also works standalone (screenshotted at 1440px
// and 390px via a temporary pages/query/_launch-box-preview.js harness,
// removed after the work-package screenshots were captured).

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { describeFilter } from '../../lib/query/filter-labels';
import { PROVISION_TYPES, OpSelect, ProvisionTypeSelect, FieldSelect, KindTabs, ValueControl, defaultsForField, opsForFieldType } from './QueryFilterControls';
import { fieldOption } from '../../lib/query/field-options';
// Reuses the deals-index column registry's consideration-type label map
// (the "existing field-label helper" for deal-level values — item 3's ask
// to check before writing new ones) so "CASH_PLUS_CVR" reads as
// "Cash + CVR" here the same way it does in the corpus table's Type column.
import { considerationTypeDisplay } from '../../lib/deals-index-columns';

const KIND_LABELS = {
  FILTER_THEN_LIST: 'Filter then list',
  MARKET_RANGE: 'Market range',
  DEAL_COMPARE: 'Deal compare',
  PROVISION_CROSS_CUT: 'Provision cross-cut',
  DEAL_TO_MARKET: 'Deal to market',
};

// Kinds this box can fully build a payload for inline. The other two
// (DEAL_COMPARE, PROVISION_CROSS_CUT, DEAL_TO_MARKET) need a deal picker
// that doesn't fit a "simple box" — selecting one of those hands off to the
// full builder with the kind preselected instead.
const INLINE_KINDS = new Set(['FILTER_THEN_LIST', 'MARKET_RANGE']);

function encodePayloadClient(payload) {
  const b64 = btoa(JSON.stringify(payload));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Mirrors lib/query/types.js's considerationTypeRaw() resolution order
// (headlineConsiderationType -> considerationType -> deal_facts.consideration
// .summary) so the deal-type options offered here, and the deal_filter they
// build, line up with what the query engine actually reads server-side.
// Duplicated rather than imported: that module pulls in rubric.js/
// expected-sets.js (Node-oriented, heavy for a client bundle) — see the
// same tradeoff noted in components/query/QueryFilterControls.jsx.
const NUMERIC_LEADING_RE = /^[\s$0-9.,%-]/;
function dealConsiderationType(deal) {
  const meta = deal && deal.metadata && typeof deal.metadata === 'object' ? deal.metadata : {};
  const enumValue = meta.headlineConsiderationType || meta.considerationType || meta.consideration_type || null;
  if (enumValue) return enumValue;
  const facts = meta.deal_facts && typeof meta.deal_facts === 'object' ? meta.deal_facts : {};
  const consideration = facts.consideration && typeof facts.consideration === 'object' ? facts.consideration : {};
  const summary = consideration.summary;
  if (typeof summary === 'string' && summary.trim() && !NUMERIC_LEADING_RE.test(summary.trim())) return summary;
  return deal && deal.consideration_type ? deal.consideration_type : null;
}

function dealLabel(deal) {
  const meta = deal && deal.metadata && typeof deal.metadata === 'object' ? deal.metadata : {};
  const acquirer = meta.acquirer_display || deal.acquirer || 'Buyer';
  const target = meta.target_display || deal.target || 'Target';
  return `${acquirer} / ${target}`;
}

export default function QueryLaunchBox({ deals: dealsProp, showTitle = true, defaultKind = 'FILTER_THEN_LIST' }) {
  const router = useRouter();
  const [deals, setDeals] = useState(dealsProp || null);
  const [kind, setKind] = useState(defaultKind);
  const [dealTypes, setDealTypes] = useState([]);
  const [filters, setFilters] = useState([{ provision_type: 'COVENANT_NO_SOLICITATION', field: 'forceTheVote', op: 'eq', value: 'true' }]);
  const [mrProvisionType, setMrProvisionType] = useState('TERMINATION_FEE');
  const [mrField, setMrField] = useState('companyTerminationFee');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (dealsProp) { setDeals(dealsProp); return; }
    fetch('/api/deals').then((r) => r.json()).then((json) => setDeals(json.deals || json.rows || [])).catch(() => setDeals([]));
  }, [dealsProp]);

  const dealTypeOptions = useMemo(() => {
    const types = new Set();
    for (const deal of deals || []) {
      const t = dealConsiderationType(deal);
      if (t) types.add(t);
    }
    return [...types].sort();
  }, [deals]);

  const toggleDealType = (type) => {
    setDealTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  };

  const dealFilter = dealTypes.length ? { consideration_type: dealTypes } : {};

  const update = (i, patch) => setFilters(filters.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));

  const buildPayload = () => {
    if (kind === 'FILTER_THEN_LIST') {
      return {
        filters: filters.map((f) => ({ ...f, value: f.value === 'true' ? true : f.value === 'false' ? false : (Number.isNaN(Number(f.value)) || f.value === '' ? f.value : Number(f.value)) })),
        deal_filter: dealFilter,
        sort_by: 'deal_signing_date_desc',
        columns: ['deal_name', 'signing_date', 'consideration_type', 'total_deal_value'],
      };
    }
    if (kind === 'MARKET_RANGE') {
      return { provision_type: mrProvisionType, field_path: mrField, deal_filter: dealFilter, chart_kind: 'HISTOGRAM' };
    }
    return null;
  };

  const openFullBuilder = () => {
    router.push({ pathname: '/query', query: { kind } });
  };

  const run = async () => {
    if (!INLINE_KINDS.has(kind)) { openFullBuilder(); return; }
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

  return (
    <div className="mtx">
      <div className="qlb">
        {showTitle && (
          <div className="qlbHead">
            <h2>Launch a query</h2>
            <p>Pick what to run, filter by type of deal, go.</p>
          </div>
        )}

        {/* Ben r7: query types as TABS to flick between, not a dropdown. */}
        <div className="qlbKindTabs">
          <span className="mtx-meta-label">Query type</span>
          <KindTabs kinds={Object.keys(KIND_LABELS)} labels={KIND_LABELS} value={kind} onChange={setKind} />
        </div>

        {/* Deal-type filter — available at this first stage, not buried
            below provision-level fields (Ben's explicit ask). Works for
            every kind since it narrows deal_filter, which every inline
            kind here reads the same way (lib/query/executors/shared.js
            comparisonDeals()). */}
        <div className="qlbDealType">
          <span className="mtx-meta-label">Type of deal</span>
          {dealTypeOptions.length === 0 ? (
            <p className="qlbMuted">Loading deal types…</p>
          ) : (
            <div className="qlbChips">
              {dealTypeOptions.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`qlbChip${dealTypes.includes(t) ? ' qlbChipOn' : ''}`}
                  onClick={() => toggleDealType(t)}
                >
                  {considerationTypeDisplay(t) || t}
                </button>
              ))}
            </div>
          )}
        </div>

        {kind === 'FILTER_THEN_LIST' && (
          <div className="qlbFilters">
            {/* Ben r7: each refinement is its own bordered BLOCK, with a
                "+" to add more filters. Value control is registry-typed
                (Yes/No, enum options, number) — never raw free text for a
                field that has real options. */}
            {filters.map((f, i) => (
              <div className="qlbBlock" key={i}>
                <div className="qlbRow">
                  <ProvisionTypeSelect value={f.provision_type} onChange={(v) => update(i, { provision_type: v, field: '', value: '' })} types={PROVISION_TYPES} />
                  <FieldSelect provisionType={f.provision_type} value={f.field} onChange={(v) => update(i, { field: v, ...defaultsForField(f.provision_type, v) })} />
                  <OpSelect value={f.op} onChange={(v) => update(i, { op: v })} ops={opsForFieldType(fieldOption(f.provision_type, f.field)?.type)} />
                  <ValueControl provisionType={f.provision_type} fieldKey={f.field} value={f.value} onChange={(v) => update(i, { value: v })} />
                </div>
                {filters.length > 1 && (
                  <button type="button" className="qlbBlockRemove" aria-label="Remove filter" onClick={() => setFilters(filters.filter((_, idx) => idx !== i))}>×</button>
                )}
              </div>
            ))}
            <button type="button" className="qlbAddFilter" onClick={() => setFilters([...filters, { provision_type: filters[filters.length - 1]?.provision_type || 'COVENANT_NO_SOLICITATION', field: '', op: 'eq', value: '' }])}>
              + Add a filter
            </button>
            <p className="qlbPreview">{filters.map((f) => describeFilter(f).text).join(' · and · ')}{dealTypes.length ? ` · Deal type · is one of · ${dealTypes.map((t) => considerationTypeDisplay(t) || t).join(', ')}` : ''}</p>
          </div>
        )}

        {kind === 'MARKET_RANGE' && (
          <div className="qlbRow">
            <ProvisionTypeSelect value={mrProvisionType} onChange={setMrProvisionType} />
            <input className="mtx-input" value={mrField} onChange={(e) => setMrField(e.target.value)} placeholder="e.g. companyTerminationFee" />
          </div>
        )}

        {!INLINE_KINDS.has(kind) && (
          <p className="qlbMuted">{KIND_LABELS[kind]} needs a deal picker — running it opens the full builder with this kind and your deal-type filter carried over.</p>
        )}

        {error && <div className="qlbErr">{error}</div>}

        <button type="button" className="mtx-btn mtx-btn-primary" disabled={running} onClick={run}>
          {running ? 'Running…' : INLINE_KINDS.has(kind) ? 'Run query' : 'Open full builder →'}
        </button>
      </div>
      <style jsx>{`
        .qlb { border: 1px solid var(--line, #E0E0E0); background: #fff; padding: 18px 20px; display: flex; flex-direction: column; gap: 12px; font-family: var(--mtx-sans); }
        .qlbHead h2 { margin: 0 0 3px; font-size: 14px; font-weight: 700; color: var(--ink, #1F1F1F); font-family: var(--mtx-sans); }
        .qlbHead p { margin: 0; font-size: 12px; color: var(--ink-light, #6B6B6B); font-family: var(--mtx-sans); }
        .qlbKindTabs { display: flex; flex-direction: column; gap: 6px; }
        .qlbBlock { position: relative; border: 1px solid var(--line, #E0E0E0); background: var(--paper-2, #FAFAFA); padding: 10px 34px 10px 10px; }
        .qlbBlockRemove { position: absolute; top: 6px; right: 8px; border: 0; background: transparent; color: var(--ink-light, #6B6B6B); font-size: 14px; cursor: pointer; padding: 2px 4px; }
        .qlbBlockRemove:hover { color: #B14E63; }
        .qlbAddFilter { align-self: flex-start; border: 1px dashed var(--line, #E0E0E0); background: #fff; color: var(--ink, #1F1F1F); font-family: var(--mtx-sans); font-size: 12px; padding: 6px 12px; cursor: pointer; }
        .qlbAddFilter:hover { background: var(--paper-2, #F6F6F6); border-color: var(--ink-light, #6B6B6B); }
        .qlbDealType { display: flex; flex-direction: column; gap: 6px; }
        .qlbChips { display: flex; flex-wrap: wrap; gap: 6px; }
        .qlbChip { border: 1px solid var(--line, #E0E0E0); background: #fff; color: var(--ink, #1F1F1F); font-family: var(--mtx-sans); font-size: 12px; font-weight: 600; padding: 5px 10px; cursor: pointer; }
        .qlbChip:hover { background: var(--paper-2, #F6F6F6); }
        .qlbChipOn { background: var(--ink, #1F1F1F); color: #fff; border-color: var(--ink, #1F1F1F); }
        .qlbFilters { display: flex; flex-direction: column; gap: 6px; }
        .qlbRow { display: grid; grid-template-columns: 1.3fr 1fr 0.9fr 1fr; gap: 8px; align-items: center; }
        .qlbPreview { margin: 0; font-size: 11px; color: var(--ink-light, #6B6B6B); font-family: var(--mtx-sans); }
        .qlbMuted { margin: 0; font-size: 12px; color: var(--ink-light, #6B6B6B); font-family: var(--mtx-sans); }
        .qlbErr { border: 1px solid rgba(177, 78, 99, 0.3); background: rgba(177, 78, 99, 0.06); padding: 8px 10px; color: #B14E63; font-size: 12px; font-family: var(--mtx-sans); }
        @media (max-width: 640px) {
          .qlbRow { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
