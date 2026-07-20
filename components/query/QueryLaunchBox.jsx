// Query launcher — the panel at the top of the deals index (pages/index.js).
// Complete redesign per Ben r15 ("please please please try a complete UI
// redesign of that box — HUMAN interaction is key"):
//
//   - COLLAPSED BY DEFAULT: renders as a one-line invitation (title bar +
//     the five question tabs). Clicking the bar or any tab expands it; the
//     expanded state survives tab switching, and the expanded height always
//     fits its content exactly — no internal scrollbars, ever.
//   - SENTENCE-STYLE BUILDERS: each tab's body reads as the question a
//     lawyer is asking ("Find deals where [No Solicitation] [Force the
//     vote] [Has …]"), with a single clear primary Run button.
//   - PLAIN-ENGLISH KIND NAMES: tabs use lib/query/filter-labels.js's
//     KIND_LABELS ("Find deals with a provision", "Benchmark a term",
//     "Compare deals", "Market check on a provision", "Deal vs market") —
//     machine keys never surface. A one-line description of the active
//     question sits under the tabs.
//   - DEAL PICKING IN THE BOX: Compare deals / Deal vs market get a
//     typeahead — type a party name, tick matching deals right there,
//     picked deals show as removable chips. The main table below stays a
//     SECONDARY picker (row clicks sync with the chips via the lifted
//     pickSelection state owned by pages/index.js).
//   - SHOW ALL: boolean/coded conditions have a third state ("Show all")
//     that lists every deal annotated has/hasn't + value. Payload shape
//     agreed with the engine: filters carry { provision_type, field,
//     mode: 'all' } — see coerceFilterForPayload.

import {
  useEffect, useMemo, useRef, useState,
} from 'react';
import { useRouter } from 'next/router';
import {
  ProvisionTypeSelect, FilterRow, coerceFilterForPayload, KindTabs,
  DealFiltersBlock, buildDealFilterPayload, describeDealFilters,
  useFieldsForProvisionType,
} from './QueryFilterControls';
import { KIND_LABELS, KIND_DESCRIPTIONS } from '../../lib/query/filter-labels';

// Kinds whose deal picker also lives in the main table below the box: the
// box tells the parent page (via onRequestDealPick) which kind is active so
// the page can put the table into pick-mode. The typeahead inside the box is
// the PRIMARY picker; table row clicks are the secondary one and sync with
// the chips through the shared pickSelection state.
const PICK_MODE_KINDS = new Set(['DEAL_TO_MARKET', 'DEAL_COMPARE']);

function encodePayloadClient(payload) {
  const b64 = btoa(JSON.stringify(payload));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function dealName(deal) {
  const buyer = deal.buyer_display || deal.acquirer_display || deal.acquirer || 'Buyer';
  const target = deal.target_display || deal.target_entity || deal.target || 'Target';
  return `${buyer} / ${target}`;
}

// ── Typeahead deal picker (Ben r15, item 4) ────────────────────────────────
// "I'd just have a box where you can type party names and select them with a
// tick box." Type ≥2 chars of either party's name; matching deals appear as
// tickable rows directly under the input; ticked deals become removable
// chips. Esc clears the query. `single` mode (Deal vs market) replaces the
// selection instead of accumulating.
function DealPicker({
  deals, selection, onChange, single = false, placeholder,
}) {
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const matches = useMemo(() => {
    if (query.length < 2) return [];
    return (deals || []).filter((d) => dealName(d).toLowerCase().includes(query)).slice(0, 8);
  }, [deals, query]);
  const selectedDeals = (selection || [])
    .map((id) => (deals || []).find((d) => d.id === id))
    .filter(Boolean);
  const toggle = (id) => {
    if (single) {
      onChange(selection.includes(id) ? [] : [id]);
      setQ('');
      return;
    }
    onChange(selection.includes(id) ? selection.filter((x) => x !== id) : [...selection, id]);
  };
  return (
    <div className="dp">
      {selectedDeals.length > 0 && (
        <div className="dpChips">
          {selectedDeals.map((d) => (
            <span key={d.id} className="dpChip">
              {dealName(d)}
              <button type="button" aria-label={`Remove ${dealName(d)}`} onClick={() => onChange(selection.filter((x) => x !== d.id))}>×</button>
            </span>
          ))}
        </div>
      )}
      <input
        className="mtx-input dpInput"
        value={q}
        placeholder={placeholder}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape') setQ(''); }}
      />
      {matches.length > 0 && (
        <div className="dpList">
          {matches.map((d) => {
            const on = (selection || []).includes(d.id);
            return (
              <button key={d.id} type="button" className={`dpRow${on ? ' dpRowOn' : ''}`} onClick={() => toggle(d.id)}>
                <span className={`dpTick${on ? ' dpTickOn' : ''}`}>{on ? '✓' : ''}</span>
                <span className="dpName">{dealName(d)}</span>
                <span className="dpMeta">{String(d.signing_date || d.announce_date || '').slice(0, 4)}</span>
              </button>
            );
          })}
        </div>
      )}
      {query.length >= 2 && matches.length === 0 && (
        <p className="dpEmpty">No deals match &ldquo;{q}&rdquo;.</p>
      )}
      <style jsx>{`
        .dp { display: flex; flex-direction: column; gap: 6px; min-width: 260px; flex: 1; }
        .dpChips { display: flex; flex-wrap: wrap; gap: 6px; }
        .dpChip { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--ink, #1F1F1F); background: var(--ink, #1F1F1F); color: #fff; font-family: var(--mtx-sans); font-size: 11px; font-weight: 600; padding: 3px 6px 3px 9px; }
        .dpChip button { border: 0; background: transparent; color: #fff; font-size: 13px; line-height: 1; cursor: pointer; padding: 0 2px; }
        .dpChip button:hover { color: #E0E0E0; }
        .dpInput { max-width: min(420px, 100%); }
        .dpList { display: flex; flex-direction: column; border: 1px solid var(--line, #E0E0E0); background: #fff; max-width: min(420px, 100%); }
        .dpRow { display: flex; align-items: center; gap: 8px; border: 0; border-bottom: 1px solid var(--line-soft, #EEEEEE); background: #fff; padding: 6px 9px; cursor: pointer; text-align: left; font-family: var(--mtx-sans); font-size: 12px; color: var(--ink, #1F1F1F); }
        .dpRow:last-child { border-bottom: 0; }
        .dpRow:hover { background: var(--paper-2, #F6F6F6); }
        .dpRowOn { background: var(--paper-2, #F6F6F6); }
        .dpTick { display: inline-flex; align-items: center; justify-content: center; width: 14px; height: 14px; border: 1px solid var(--line, #E0E0E0); font-size: 10px; font-weight: 700; flex: 0 0 auto; }
        .dpTickOn { background: var(--ink, #1F1F1F); border-color: var(--ink, #1F1F1F); color: #fff; }
        .dpName { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .dpMeta { color: var(--ink-faint, #9A9A9A); font-size: 10px; font-variant-numeric: tabular-nums; }
        .dpEmpty { margin: 0; font-size: 11px; color: var(--ink-light, #6B6B6B); font-family: var(--mtx-sans); }
      `}</style>
    </div>
  );
}

export default function QueryLaunchBox({
  deals: dealsProp,
  showTitle = true,
  defaultKind = 'FILTER_THEN_LIST',
  bordered = true,
  // Controlled deal-filter state — pages/index.js lifts this up so a
  // DEAL_TO_MARKET table-row pick can read the same deal_filter the box's
  // inline kinds use. Falls back to internal state when unwired.
  dealFilterValues: dealFilterValuesProp,
  onDealFilterValuesChange,
  // Pick-mode plumbing: the box tells the parent which kind wants the table
  // in pick-mode; the parent owns row clicks and shares the selection (and
  // its setter) so typeahead chips and table ticks stay in sync.
  onRequestDealPick,
  pickSelection = [],
  onPickSelectionChange,
}) {
  const router = useRouter();
  const [deals, setDeals] = useState(dealsProp || null);
  const [kind, setKind] = useState(defaultKind);
  const [open, setOpen] = useState(false);
  const [internalDealFilterValues, setInternalDealFilterValues] = useState({ consideration_type: '', buyer: '', law_firm: '', sector: '', signing_year: '' });
  const dealFilterValues = dealFilterValuesProp || internalDealFilterValues;
  const setDealFilterValues = onDealFilterValuesChange || setInternalDealFilterValues;
  const [internalPickSelection, setInternalPickSelection] = useState([]);
  const selection = onPickSelectionChange ? pickSelection : internalPickSelection;
  const setSelection = onPickSelectionChange || setInternalPickSelection;
  const [filters, setFilters] = useState([{ provision_type: 'COVENANT_NO_SOLICITATION', field: 'forceTheVote', op: 'eq', value: 'true' }]);
  const [mrProvisionType, setMrProvisionType] = useState('TERMINATION_FEE');
  const [mrField, setMrField] = useState('companyTerminationFee');
  const [ccProvisionType, setCcProvisionType] = useState('COVENANT_NO_SOLICITATION');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // A supplied deals array (even an empty one while the parent's fetch is
    // in flight) means the parent owns the list — keeps the typeahead in
    // lockstep with the table below. Only self-fetch when truly standalone.
    if (dealsProp) { setDeals(dealsProp); return; }
    fetch('/api/deals').then((r) => r.json()).then((json) => setDeals(json.deals || json.rows || [])).catch(() => setDeals([]));
  }, [dealsProp]);

  const dealFilter = useMemo(() => buildDealFilterPayload(dealFilterValues), [dealFilterValues]);

  // Arm/disarm the table's pick-mode: only while the box is open on a
  // deal-picking kind. Collapsing the box or switching kinds disarms.
  useEffect(() => {
    if (!onRequestDealPick) return;
    onRequestDealPick(open && PICK_MODE_KINDS.has(kind) ? kind : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, open]);
  // Unmount-only cleanup via a ref so caller identity churn can never
  // disarm pick-mode mid-flight (see the wave-3 QA bug history in git).
  const onRequestDealPickRef = useRef(onRequestDealPick);
  onRequestDealPickRef.current = onRequestDealPick;
  useEffect(() => () => {
    if (onRequestDealPickRef.current) onRequestDealPickRef.current(null);
  }, []);

  // Benchmark a term: numeric fields only for the chosen provision type.
  const mrFields = useFieldsForProvisionType(mrProvisionType).filter((f) => f.numeric);
  useEffect(() => {
    if (mrFields.length && !mrFields.some((f) => f.key === mrField)) setMrField(mrFields[0].key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mrFields]);

  // Market check on a provision: runs inline (no hand-off to the full
  // builder) — every deal, first four fields of the chosen provision type
  // as columns, same payload pages/index.js's search shortcut builds.
  const ccFields = useFieldsForProvisionType(ccProvisionType);

  const update = (i, patch) => setFilters(filters.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));

  const expand = () => setOpen(true);
  const selectKind = (k) => { setKind(k); setError(null); expand(); };

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
        deal_ids: selection,
        provision_types: ['CONSIDERATION', 'TERMINATION_FEE', 'COVENANT_NO_SOLICITATION'],
        highlight_deltas: true,
        included_field_groups: ['primary', 'qualifiers'],
      };
    }
    if (kind === 'PROVISION_CROSS_CUT') {
      return {
        provision_type: ccProvisionType,
        provision_subtype: null,
        deal_ids: (deals || []).map((d) => d.id),
        columns: ccFields.slice(0, 4).map((f) => f.key),
        sort_by: 'deal_signing_date_desc',
      };
    }
    if (kind === 'DEAL_TO_MARKET') {
      return { deal_id: selection[0], comparison_set_filter: dealFilter, provision_types: null };
    }
    return null;
  };

  const navigateToResult = (payload) => {
    const slug = kind.toLowerCase().replace(/_/g, '-');
    router.push(`/query/${slug}/adhoc?payload=${encodePayloadClient(payload)}`);
  };

  const run = async () => {
    if (runDisabled) return;
    setError(null);
    const payload = buildPayload();
    if (!payload) return;
    // Compare / market-check / deal-vs-market navigate straight to the
    // result page (same as a table-row pick); the two filter-driven kinds
    // validate against the engine first so a bad combination errors inline
    // instead of on a fresh page.
    if (kind !== 'FILTER_THEN_LIST' && kind !== 'MARKET_RANGE') {
      navigateToResult(payload);
      return;
    }
    setRunning(true);
    try {
      const res = await fetch('/api/query/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, query_payload: payload }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      navigateToResult(payload);
    } catch (err) {
      setError(err.message || 'That combination of fields isn’t valid — check the values above and try again.');
    } finally {
      setRunning(false);
    }
  };

  const runDisabled = running
    || (kind === 'DEAL_COMPARE' && selection.length < 2)
    || (kind === 'DEAL_TO_MARKET' && selection.length < 1)
    || (kind === 'PROVISION_CROSS_CUT' && !ccFields.length);

  const runLabel = running ? 'Running…'
    : kind === 'FILTER_THEN_LIST' ? 'Find deals'
    : kind === 'MARKET_RANGE' ? 'Run benchmark'
    : kind === 'DEAL_COMPARE' ? (selection.length >= 2 ? `Compare ${selection.length} deals` : 'Compare deals')
    : kind === 'PROVISION_CROSS_CUT' ? 'Run market check'
    : 'Run deal vs market';

  const runHint = kind === 'DEAL_COMPARE' && selection.length < 2
    ? (selection.length === 1 ? 'Pick at least one more deal' : 'Pick two or more deals')
    : kind === 'DEAL_TO_MARKET' && selection.length < 1
    ? 'Pick a deal to test'
    : null;

  const collapsedHint = 'Find deals with a provision, benchmark a term, or compare precedents — pick a question to start.';

  return (
    <div className="mtx">
      <div className={`qlb${bordered ? '' : ' qlbFlush'}`}>
        {showTitle && (
          <button type="button" className="qlbTitleBar" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            <span className="qlbTitleMain">Query the corpus</span>
            <span className="qlbTitleSub">{open ? KIND_LABELS[kind] : collapsedHint}</span>
            <span className="qlbChevron" aria-hidden>{open ? '▾' : '▸'}</span>
          </button>
        )}

        <div className="qlbTabsRow" role="tablist">
          <KindTabs kinds={Object.keys(KIND_LABELS)} labels={KIND_LABELS} value={open ? kind : null} onChange={selectKind} />
        </div>

        {open && (
          <div className="qlbOpenArea">
            <p className="qlbKindDesc">{KIND_DESCRIPTIONS[kind]}</p>

            {kind === 'FILTER_THEN_LIST' && (
              <div className="qlbFilters">
                {filters.map((f, i) => (
                  <div className="qlbSentenceRow" key={i}>
                    <span className="qlbLead">{i === 0 ? 'Find deals where' : 'and'}</span>
                    <div className="qlbSentenceControls">
                      <FilterRow
                        filter={f}
                        onChange={(patch) => update(i, patch)}
                        onRemove={filters.length > 1 ? () => setFilters(filters.filter((_, idx) => idx !== i)) : null}
                        showPreview
                      />
                    </div>
                  </div>
                ))}
                <button type="button" className="qlbAddFilter" onClick={() => setFilters([...filters, { provision_type: filters[filters.length - 1]?.provision_type || 'COVENANT_NO_SOLICITATION', field: '', op: null, value: '' }])}>
                  + and another condition
                </button>
              </div>
            )}

            {kind === 'MARKET_RANGE' && (
              <div className="qlbSentenceRow">
                <span className="qlbLead">Benchmark</span>
                <div className="qlbSentenceControls qlbInlineRow">
                  <ProvisionTypeSelect value={mrProvisionType} onChange={setMrProvisionType} />
                  <select className="mtx-select" value={mrField} title={(mrFields.find((f) => f.key === mrField) || {}).label} onChange={(e) => setMrField(e.target.value)} disabled={!mrFields.length}>
                    {!mrFields.length && <option value="">No numeric terms for this provision</option>}
                    {mrFields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                  </select>
                  <span className="qlbLead qlbTrail">across the corpus</span>
                </div>
              </div>
            )}

            {kind === 'DEAL_COMPARE' && (
              <div className="qlbSentenceRow qlbSentenceRowTop">
                <span className="qlbLead">Compare</span>
                <div className="qlbSentenceControls">
                  <DealPicker
                    deals={deals || []}
                    selection={selection}
                    onChange={setSelection}
                    placeholder="Type a party name — e.g. Metsera, Pfizer…"
                  />
                  <p className="qlbSecondaryHint">…or click deal rows in the list below. Esc cancels.</p>
                </div>
              </div>
            )}

            {kind === 'PROVISION_CROSS_CUT' && (
              <div className="qlbSentenceRow">
                <span className="qlbLead">Market check</span>
                <div className="qlbSentenceControls qlbInlineRow">
                  <ProvisionTypeSelect value={ccProvisionType} onChange={setCcProvisionType} />
                  <span className="qlbLead qlbTrail">across every deal</span>
                </div>
              </div>
            )}

            {kind === 'DEAL_TO_MARKET' && (
              <div className="qlbSentenceRow qlbSentenceRowTop">
                <span className="qlbLead">Test</span>
                <div className="qlbSentenceControls">
                  <DealPicker
                    deals={deals || []}
                    selection={selection}
                    onChange={setSelection}
                    single
                    placeholder="Type a party name to pick the deal…"
                  />
                  <p className="qlbSecondaryHint">
                    …or click a deal row in the list below. It runs against {describeDealFilters(dealFilterValues).length ? 'the deal filters here' : 'the whole corpus'}.
                  </p>
                </div>
              </div>
            )}

            <DealFiltersBlock deals={deals || []} values={dealFilterValues} onChange={setDealFilterValues} />

            <div className="qlbFooter">
              <span className={`qlbFooterHint${error ? ' qlbFooterErr' : ''}`}>{error || runHint || ''}</span>
              <button type="button" className="mtx-btn mtx-btn-primary qlbRun" disabled={runDisabled} onClick={run}>
                {runLabel} →
              </button>
            </div>
          </div>
        )}
      </div>
      <style jsx>{`
        .qlb { border: 1px solid var(--line, #E0E0E0); background: #fff; display: flex; flex-direction: column; font-family: var(--mtx-sans); }
        /* Embedded mode (pages/index.js): the parent supplies the outer
           border — this box contributes none of its own. */
        .qlbFlush { border: none; }
        .qlbTitleBar { display: flex; align-items: baseline; gap: 10px; margin: 0; padding: 7px 14px; border: 0; border-bottom: 1px solid var(--line, #E0E0E0); background: var(--paper-2, #F6F6F6); font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: var(--ink, #1F1F1F); font-family: var(--mtx-sans); cursor: pointer; text-align: left; width: 100%; }
        .qlbTitleBar:hover { background: #F0F0F0; }
        .qlbTitleMain { flex: 0 0 auto; }
        .qlbTitleSub { flex: 1; font-weight: 400; text-transform: none; letter-spacing: 0; font-size: 11px; color: var(--ink-light, #6B6B6B); }
        .qlbChevron { flex: 0 0 auto; font-size: 10px; color: var(--ink-light, #6B6B6B); text-transform: none; letter-spacing: 0; }
        .qlbTabsRow { padding: 10px 14px 0; }
        .qlbOpenArea { display: flex; flex-direction: column; gap: 12px; padding: 10px 14px 12px; }
        .qlbKindDesc { margin: 0; font-size: 12px; line-height: 1.45; color: var(--ink-light, #6B6B6B); font-family: var(--mtx-sans); max-width: 720px; }
        .qlbFilters { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
        .qlbSentenceRow { display: flex; align-items: center; gap: 10px; width: 100%; }
        .qlbSentenceRowTop { align-items: flex-start; }
        .qlbSentenceRowTop .qlbLead { margin-top: 5px; }
        .qlbLead { flex: 0 0 auto; font-size: 13px; font-weight: 600; color: var(--ink, #1F1F1F); font-family: var(--mtx-sans); min-width: 108px; text-align: right; }
        .qlbSentenceRow:first-child .qlbLead { min-width: 108px; }
        .qlbTrail { min-width: 0; font-weight: 400; color: var(--ink-light, #6B6B6B); text-align: left; }
        .qlbSentenceControls { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
        .qlbInlineRow { flex-direction: row; align-items: center; gap: 8px; flex-wrap: wrap; }
        .qlbAddFilter { margin-left: 118px; border: 1px dashed var(--line, #E0E0E0); background: #fff; color: var(--ink, #1F1F1F); font-family: var(--mtx-sans); font-size: 11px; padding: 4px 10px; cursor: pointer; }
        .qlbAddFilter:hover { background: var(--paper-2, #F6F6F6); border-color: var(--ink-light, #6B6B6B); }
        .qlbSecondaryHint { margin: 0; font-size: 11px; color: var(--ink-faint, #9A9A9A); font-family: var(--mtx-sans); }
        .qlbFooter { display: flex; align-items: center; justify-content: flex-end; gap: 12px; border-top: 1px solid var(--line-soft, #EEEEEE); padding-top: 10px; }
        .qlbFooterHint { font-size: 11px; color: var(--ink-light, #6B6B6B); font-family: var(--mtx-sans); }
        .qlbFooterErr { color: #B14E63; }
        .qlbRun { flex: 0 0 auto; }
        /* Info hierarchy: nothing inside the box larger than 12px except the
           lead-in words and the Run button — override the global 13px/36px
           .mtx-select/.mtx-input for every control rendered inside. */
        .qlb :global(.mtx-select), .qlb :global(.mtx-input) { font-size: 11px; height: 26px; padding: 0 7px; max-width: 100%; min-width: 0; text-overflow: ellipsis; }
        /* Mobile (Ben r15 addendum): the box must never force horizontal
           page scroll — every flex child can shrink, closed controls clip
           their own label. */
        .qlb, .qlbOpenArea, .qlbSentenceControls, .qlbInlineRow, .qlbFilters { min-width: 0; max-width: 100%; }
        .qlb :global(.filterControls) { gap: 6px; }
        .qlb :global(.boolBtn), .qlb :global(.numUnit), .qlb :global(.numAnd), .qlb :global(.codedAllHint) { font-size: 11px; }
        .qlb :global(.boolBtn) { padding: 4px 9px; }
        .qlb :global(.mtx-btn:not(.qlbRun)) { font-size: 11px; height: 26px; padding: 0 8px; }
        @media (max-width: 720px) {
          .qlbLead { min-width: 0; text-align: left; }
          .qlbSentenceRow { flex-direction: column; align-items: flex-start; gap: 6px; }
          .qlbAddFilter { margin-left: 0; }
        }
      `}</style>
    </div>
  );
}
