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
import {
  ProvisionTypeSelect, FilterRow, coerceFilterForPayload, KindTabs,
  DealFiltersBlock, buildDealFilterPayload, describeDealFilters,
} from './QueryFilterControls';

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
  const [dealFilterValues, setDealFilterValues] = useState({ consideration_type: '', buyer: '', law_firm: '', sector: '', signing_year: '' });
  const [filters, setFilters] = useState([{ provision_type: 'COVENANT_NO_SOLICITATION', field: 'forceTheVote', op: 'eq', value: 'true' }]);
  const [mrProvisionType, setMrProvisionType] = useState('TERMINATION_FEE');
  const [mrField, setMrField] = useState('companyTerminationFee');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (dealsProp) { setDeals(dealsProp); return; }
    fetch('/api/deals').then((r) => r.json()).then((json) => setDeals(json.deals || json.rows || [])).catch(() => setDeals([]));
  }, [dealsProp]);

  const dealFilter = useMemo(() => buildDealFilterPayload(dealFilterValues), [dealFilterValues]);

  const update = (i, patch) => setFilters(filters.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));

  const buildPayload = () => {
    if (kind === 'FILTER_THEN_LIST') {
      return {
        filters: filters.map(coerceFilterForPayload),
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
          <div className="qlbTitleBar">
            <span>Launch Query</span>
            <span className="qlbTitleSub">Pick a query type, filter the deals, go.</span>
          </div>
        )}

        <div className="qlbTabsRow">
          <KindTabs kinds={Object.keys(KIND_LABELS)} labels={KIND_LABELS} value={kind} onChange={setKind} />
          <button type="button" className="mtx-btn mtx-btn-primary qlbRun" disabled={running} onClick={run}>
            {running ? 'Running…' : INLINE_KINDS.has(kind) ? 'Run query' : 'Open full builder →'}
          </button>
        </div>

        {/* Deal-type filter — available at this first stage, not buried
            below provision-level fields (Ben's explicit ask). Works for
            every kind since it narrows deal_filter, which every inline
            kind here reads the same way (lib/query/executors/shared.js
            comparisonDeals()). */}
        <DealFiltersBlock deals={deals || []} values={dealFilterValues} onChange={setDealFilterValues} />

        {/* Fixed-height stage so flicking tabs/selectors never grows the page. */}
        <div className="qlbStage">
        {kind === 'FILTER_THEN_LIST' && (
          <div className="qlbFilters">
            {/* Ben r7: each refinement is its own bordered BLOCK, with a
                "+" to add more filters and a per-block remove. */}
            {filters.map((f, i) => (
              <div className="qlbBlock" key={i}>
                <FilterRow
                  filter={f}
                  onChange={(patch) => update(i, patch)}
                  onRemove={filters.length > 1 ? () => setFilters(filters.filter((_, idx) => idx !== i)) : null}
                />
              </div>
            ))}
            <button type="button" className="qlbAddFilter" onClick={() => setFilters([...filters, { provision_type: filters[filters.length - 1]?.provision_type || 'COVENANT_NO_SOLICITATION', field: '', op: null, value: '' }])}>
              + Add a filter
            </button>
            {describeDealFilters(dealFilterValues).length > 0 && (
              <p className="qlbPreview">— and the {describeDealFilters(dealFilterValues).join(', and the ')}</p>
            )}
          </div>
        )}

        {kind === 'MARKET_RANGE' && (
          <div className="qlbRow">
            <ProvisionTypeSelect value={mrProvisionType} onChange={setMrProvisionType} />
            <input className="mtx-input" value={mrField} onChange={(e) => setMrField(e.target.value)} placeholder="e.g. companyTerminationFee" />
          </div>
        )}

        {!INLINE_KINDS.has(kind) && (
          <p className="qlbMuted">{KIND_LABELS[kind]} needs a deal picker — running it opens the full builder with this kind and your deal filters carried over.</p>
        )}
        </div>

        {error && <div className="qlbErr">{error}</div>}


      </div>
      <style jsx>{`
        .qlb { border: 1px solid var(--line, #E0E0E0); background: #fff; display: flex; flex-direction: column; gap: 8px; font-family: var(--mtx-sans); padding: 0 0 10px; }
        .qlb > :global(*) { margin-left: 16px; margin-right: 16px; }
        .qlbTitleBar { display: flex; align-items: baseline; gap: 10px; margin: 0 !important; padding: 7px 16px; border-bottom: 1px solid var(--line, #E0E0E0); background: var(--paper-2, #F6F6F6); font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: var(--ink, #1F1F1F); }
        .qlbTitleSub { font-weight: 400; text-transform: none; letter-spacing: 0; font-size: 11px; color: var(--ink-light, #6B6B6B); }
        .qlbTabsRow { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
        .qlbRun { flex: 0 0 auto; }
        .qlbStage { height: 96px; display: flex; flex-direction: column; gap: 8px; overflow-y: auto; }
        .qlbBlock { position: relative; border: 1px solid var(--line, #E0E0E0); background: var(--paper-2, #FAFAFA); padding: 6px 8px; }
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
