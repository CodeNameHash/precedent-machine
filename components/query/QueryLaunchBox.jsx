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

import {
  useEffect, useMemo, useRef, useState,
} from 'react';
import { useRouter } from 'next/router';
import {
  ProvisionTypeSelect, FilterRow, coerceFilterForPayload, KindTabs,
  DealFiltersBlock, buildDealFilterPayload, describeDealFilters,
  useFieldsForProvisionType,
} from './QueryFilterControls';

const KIND_LABELS = {
  FILTER_THEN_LIST: 'Filter then list',
  MARKET_RANGE: 'Market range',
  DEAL_COMPARE: 'Deal compare',
  PROVISION_CROSS_CUT: 'Provision cross-cut',
  DEAL_TO_MARKET: 'Deal to market',
};

// Kinds this box can fully build a payload for inline. DEAL_COMPARE joined
// this list once its deal picker moved out of the box and onto the main
// table (row clicks -> `pickSelection`, owned by the parent index page) —
// the box just needs 2+ picked deals to enable its Run button. PROVISION_CROSS_CUT
// still hands off to the full builder (no owner ask to bring that one inline).
const INLINE_KINDS = new Set(['FILTER_THEN_LIST', 'MARKET_RANGE', 'DEAL_COMPARE']);

// Kinds whose deal picker lives in the main table below the box (Ben:
// "deal to market and market range suck — they should just use the main
// deal list below as the picker, not suggest another picker"). The box
// tells the parent page (via onRequestDealPick) which kind is active so the
// page can put the table into pick-mode; MARKET_RANGE dropped off this list
// entirely since it needs no deal picker at all (deal_filter covers it).
const PICK_MODE_KINDS = new Set(['DEAL_TO_MARKET', 'DEAL_COMPARE']);

function encodePayloadClient(payload) {
  const b64 = btoa(JSON.stringify(payload));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export default function QueryLaunchBox({
  deals: dealsProp,
  showTitle = true,
  defaultKind = 'FILTER_THEN_LIST',
  bordered = true,
  // Controlled deal-filter state — the parent page (pages/index.js) lifts
  // this up so a DEAL_TO_MARKET row-pick can read the same deal_filter the
  // box's own inline kinds use. Falls back to internal state so the box
  // still works if a caller doesn't wire these up.
  dealFilterValues: dealFilterValuesProp,
  onDealFilterValuesChange,
  // Pick-mode plumbing (Ben: DEAL_TO_MARKET/DEAL_COMPARE should use the main
  // deal table as the picker, not a second picker in this box). The box
  // tells the parent which kind wants pick-mode; the parent owns row clicks
  // and hands the running selection back via `pickSelection`.
  onRequestDealPick,
  pickSelection = [],
}) {
  const router = useRouter();
  const [deals, setDeals] = useState(dealsProp || null);
  const [kind, setKind] = useState(defaultKind);
  const [internalDealFilterValues, setInternalDealFilterValues] = useState({ consideration_type: '', buyer: '', law_firm: '', sector: '', signing_year: '' });
  const dealFilterValues = dealFilterValuesProp || internalDealFilterValues;
  const setDealFilterValues = onDealFilterValuesChange || setInternalDealFilterValues;
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

  // Tell the parent page whenever the active kind enters/leaves pick-mode,
  // and cancel pick-mode on unmount so a stale highlight bar never lingers
  // above the table.
  useEffect(() => {
    if (!onRequestDealPick) return;
    onRequestDealPick(PICK_MODE_KINDS.has(kind) ? kind : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);
  // Bug fix (Ben, wave-3 QA -- Deal compare / Deal to market pick mode never
  // armed): this used to be `useEffect(() => () => onRequestDealPick(null),
  // [onRequestDealPick])`. If the CALLER ever hands this component a
  // freshly-identitied callback on every render (pages/index.js did, before
  // its own fix), React treats that as "the dependency changed" and runs the
  // cleanup from the PREVIOUS effect instance immediately, before re-running
  // the effect -- so `onRequestDealPick(null)` fired on every parent
  // re-render, cancelling pick-mode a moment after it was armed. The real
  // fix is stabilizing the callback on the caller's side (done in
  // pages/index.js via useCallback), but this effect is made resilient to
  // caller identity churn too -- defense in depth, since any future caller
  // that forgets useCallback would silently reintroduce the same bug. Keep
  // the latest callback in a ref (always current, never a dependency) and
  // register the unmount-only cleanup with an EMPTY dependency array so it
  // only runs once, on this component's real unmount -- never on a parent
  // re-render.
  const onRequestDealPickRef = useRef(onRequestDealPick);
  onRequestDealPickRef.current = onRequestDealPick;
  useEffect(() => () => {
    if (onRequestDealPickRef.current) onRequestDealPickRef.current(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // MARKET_RANGE's field picker: a real dropdown of NUMERIC fields for the
  // chosen provision type (Ben: no free-text field-path box). Reuses the
  // same field-options fetch the full builder's FilterRow uses.
  const mrFields = useFieldsForProvisionType(mrProvisionType).filter((f) => f.numeric);
  useEffect(() => {
    if (mrFields.length && !mrFields.some((f) => f.key === mrField)) setMrField(mrFields[0].key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mrFields]);

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
    if (kind === 'DEAL_COMPARE') {
      return {
        deal_ids: pickSelection,
        provision_types: ['CONSIDERATION', 'TERMINATION_FEE', 'COVENANT_NO_SOLICITATION'],
        highlight_deltas: true,
        included_field_groups: ['primary', 'qualifiers'],
      };
    }
    return null;
  };

  const openFullBuilder = () => {
    router.push({ pathname: '/query', query: { kind } });
  };

  const run = async () => {
    if (kind === 'DEAL_TO_MARKET') return; // runs from a table row click instead
    if (kind === 'DEAL_COMPARE' && pickSelection.length < 2) return;
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

  const runDisabled = running || kind === 'DEAL_TO_MARKET' || (kind === 'DEAL_COMPARE' && pickSelection.length < 2);
  const runLabel = running ? 'Running…'
    : kind === 'DEAL_TO_MARKET' ? 'Pick a deal below ↓'
    : kind === 'DEAL_COMPARE' ? (pickSelection.length >= 2 ? `Compare ${pickSelection.length} deals` : 'Select 2+ deals below ↓')
    : INLINE_KINDS.has(kind) ? 'Run query' : 'Open full builder →';

  return (
    <div className="mtx">
      <div className={`qlb${bordered ? '' : ' qlbFlush'}`}>
        {showTitle && (
          <div className="qlbTitleBar">
            <span>Launch Query</span>
            <span className="qlbTitleSub">Pick a query type, filter the deals, go.</span>
          </div>
        )}

        <div className="qlbTabsRow">
          <KindTabs kinds={Object.keys(KIND_LABELS)} labels={KIND_LABELS} value={kind} onChange={setKind} />
          <button type="button" className="mtx-btn mtx-btn-primary qlbRun" disabled={runDisabled} onClick={run}>
            {runLabel}
          </button>
        </div>

        {/* Deal-type filter — available at this first stage, not buried
            below provision-level fields (Ben's explicit ask). Works for
            every kind since it narrows deal_filter, which every inline
            kind here reads the same way (lib/query/executors/shared.js
            comparisonDeals()). */}
        <DealFiltersBlock deals={deals || []} values={dealFilterValues} onChange={setDealFilterValues} />

        {/* One stable height across every tab, no scrollbar (Ben: "the
            query box shouldn't have a scroll bar — make it the right size
            by better layout"). Each kind body is a single compact row;
            min-height is sized to the tallest one (FILTER_THEN_LIST, which
            has a filter block + add-filter link) so shorter bodies just pad
            instead of the box resizing when tabs are flicked. */}
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
                  showPreview={false}
                />
              </div>
            ))}
            <button type="button" className="qlbAddFilter" onClick={() => setFilters([...filters, { provision_type: filters[filters.length - 1]?.provision_type || 'COVENANT_NO_SOLICITATION', field: '', op: null, value: '' }])}>
              + Add a filter
            </button>
          </div>
        )}

        {kind === 'MARKET_RANGE' && (
          <div className="qlbRow">
            <ProvisionTypeSelect value={mrProvisionType} onChange={setMrProvisionType} />
            <select className="mtx-select" value={mrField} onChange={(e) => setMrField(e.target.value)} disabled={!mrFields.length}>
              {!mrFields.length && <option value="">No numeric fields</option>}
              {mrFields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
          </div>
        )}

        {kind === 'DEAL_TO_MARKET' && (
          <p className="qlbMuted">Pick a deal in the table below — it runs deal-to-market for that deal against {describeDealFilters(dealFilterValues).length ? 'the deal filters above' : 'the whole corpus'}.</p>
        )}

        {kind === 'DEAL_COMPARE' && (
          <p className="qlbMuted">
            {pickSelection.length === 0 && 'Click 2 or more rows in the table below to select deals to compare.'}
            {pickSelection.length === 1 && '1 deal selected — pick at least 1 more in the table below.'}
            {pickSelection.length >= 2 && `${pickSelection.length} deals selected — hit Run, or keep clicking rows below to change the set.`}
          </p>
        )}

        {kind === 'PROVISION_CROSS_CUT' && (
          <p className="qlbMuted">Provision cross-cut needs a deal picker — running it opens the full builder with your deal filters carried over.</p>
        )}
        </div>

        {error && <div className="qlbErr">{error}</div>}


      </div>
      <style jsx>{`
        .qlb { border: 1px solid var(--line, #E0E0E0); background: #fff; display: flex; flex-direction: column; gap: 7px; font-family: var(--mtx-sans); padding: 0 0 9px; }
        /* Embedded mode (pages/index.js): the parent supplies ONE outer
           border around the box + table together (Ben: "read as one
           surface, no double borders/gaps") — this box contributes no
           border of its own. */
        .qlbFlush { border: none; }
        .qlb > :global(*) { margin-left: 14px; margin-right: 14px; }
        .qlbTitleBar { display: flex; align-items: baseline; gap: 10px; margin: 0 !important; padding: 6px 14px; border-bottom: 1px solid var(--line, #E0E0E0); background: var(--paper-2, #F6F6F6); font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: var(--ink, #1F1F1F); }
        .qlbTitleSub { font-weight: 400; text-transform: none; letter-spacing: 0; font-size: 11px; color: var(--ink-light, #6B6B6B); }
        .qlbTabsRow { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-top: 8px !important; }
        .qlbRun { flex: 0 0 auto; }
        /* No overflow/scroll — every kind body below is a single compact
           row, and min-height (not height) keeps the box from jumping size
           when tabs change without ever clipping content. */
        .qlbStage { min-height: 46px; display: flex; flex-direction: column; justify-content: center; gap: 6px; }
        .qlbBlock { position: relative; border: 1px solid var(--line, #E0E0E0); background: var(--paper-2, #FAFAFA); padding: 5px 7px; }
        .qlbAddFilter { align-self: flex-start; border: 1px dashed var(--line, #E0E0E0); background: #fff; color: var(--ink, #1F1F1F); font-family: var(--mtx-sans); font-size: 11px; padding: 4px 10px; cursor: pointer; }
        .qlbAddFilter:hover { background: var(--paper-2, #F6F6F6); border-color: var(--ink-light, #6B6B6B); }
        .qlbFilters { display: flex; flex-direction: column; gap: 5px; }
        .qlbRow { display: grid; grid-template-columns: 1.3fr 1fr; gap: 8px; align-items: center; }
        .qlbMuted { margin: 0; font-size: 11px; color: var(--ink-light, #6B6B6B); font-family: var(--mtx-sans); line-height: 1.4; }
        .qlbErr { border: 1px solid rgba(177, 78, 99, 0.3); background: rgba(177, 78, 99, 0.06); padding: 6px 9px; color: #B14E63; font-size: 11px; font-family: var(--mtx-sans); }
        /* Nothing in the box larger than 12px except the Run button (Ben's
           info-hierarchy note) — override the global 13px/36px .mtx-select
           and .mtx-input for every control rendered inside this box,
           including the ones FilterRow/DealFiltersBlock own. */
        .qlb :global(.mtx-select), .qlb :global(.mtx-input) { font-size: 11px; height: 26px; padding: 0 7px; }
        .qlb :global(.filterControls) { gap: 6px; }
        .qlb :global(.boolBtn), .qlb :global(.numUnit), .qlb :global(.numAnd) { font-size: 11px; }
        .qlb :global(.qkTab) { font-size: 12px; padding: 6px 12px; }
        .qlb :global(.mtx-btn:not(.qlbRun)) { font-size: 11px; height: 26px; padding: 0 8px; }
        @media (max-width: 640px) {
          .qlbRow { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
