import {
  useEffect, useMemo, useRef, useState,
} from 'react';
import { useRouter } from 'next/router';
import {
  ProvisionTypeSelect, FilterRow, coerceFilterForPayload, KindTabs,
  DealFiltersBlock, buildDealFilterPayload, describeDealFilters,
  dealMatchesDealFilter, useFieldsForProvisionType,
} from './QueryFilterControls';
import DealPicker from './DealPicker';

const KIND_LABELS = {
  FILTER_THEN_LIST: 'Find deals',
  MARKET_RANGE: 'Market check',
  DEAL_COMPARE: 'Compare deals',
  PROVISION_CROSS_CUT: 'Compare a term',
  DEAL_TO_MARKET: 'Deal vs market',
};

const INLINE_KINDS = new Set(['FILTER_THEN_LIST', 'MARKET_RANGE', 'PROVISION_CROSS_CUT', 'DEAL_COMPARE', 'DEAL_TO_MARKET']);
const PICK_MODE_KINDS = new Set(['DEAL_TO_MARKET', 'DEAL_COMPARE']);
const EXAMPLES = [
  'Market range for termination fees as a percentage of deal value',
  'Which deals have a go-shop?',
  'Compare matching-rights periods across the corpus',
];

function encodePayloadClient(payload) {
  const b64 = btoa(JSON.stringify(payload));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function resultHref(kind, payload) {
  const slug = kind.toLowerCase().replace(/_/g, '-');
  return `/query/${slug}/adhoc?payload=${encodePayloadClient(payload)}`;
}

export default function QueryLaunchBox({
  deals: dealsProp,
  bordered = true,
  dealFilterValues: dealFilterValuesProp,
  onDealFilterValuesChange,
  onRequestDealPick,
  pickSelection = [],
}) {
  const router = useRouter();
  const [deals, setDeals] = useState(dealsProp || null);
  const [question, setQuestion] = useState('');
  const [interpretation, setInterpretation] = useState(null);
  const [kind, setKind] = useState('FILTER_THEN_LIST');
  const [manualOpen, setManualOpen] = useState(false);
  const [internalDealFilterValues, setInternalDealFilterValues] = useState({ consideration_type: '', buyer: '', law_firm: '', lawyer: '', merger_form: '', sector: '', signing_year: '', search: '' });
  const dealFilterValues = dealFilterValuesProp || internalDealFilterValues;
  const setDealFilterValues = onDealFilterValuesChange || setInternalDealFilterValues;
  const [filters, setFilters] = useState([{ provision_type: 'COVENANT_NO_SOLICITATION', field: 'forceTheVote', op: 'eq', value: true }]);
  const [mrProvisionType, setMrProvisionType] = useState('TERMINATION_FEE');
  const [mrField, setMrField] = useState('feePctOfDealValue');
  const [ccProvisionType, setCcProvisionType] = useState('COVENANT_NO_SOLICITATION');
  const [ccField, setCcField] = useState('initialMatchPeriodDays');
  const [dtmDealId, setDtmDealId] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (dealsProp) { setDeals(dealsProp); return; }
    fetch('/api/deals').then((r) => r.json()).then((json) => setDeals(json.deals || json.rows || [])).catch(() => setDeals([]));
  }, [dealsProp]);

  const dealFilter = useMemo(() => buildDealFilterPayload(dealFilterValues), [dealFilterValues]);
  const filteredDealIds = useMemo(() => (deals || [])
    .filter((deal) => dealMatchesDealFilter(deal, dealFilter))
    .map((deal) => deal.id), [deals, dealFilter]);
  const mrFields = useFieldsForProvisionType(mrProvisionType);
  const ccFields = useFieldsForProvisionType(ccProvisionType);

  useEffect(() => {
    if (mrFields.length && !mrFields.some((field) => field.key === mrField)) setMrField(mrFields[0].key);
  }, [mrFields, mrField]);

  useEffect(() => {
    if (ccFields.length && !ccFields.some((field) => field.key === ccField)) setCcField(ccFields[0].key);
  }, [ccFields, ccField]);

  useEffect(() => {
    if (!onRequestDealPick) return;
    onRequestDealPick(manualOpen && PICK_MODE_KINDS.has(kind) ? kind : null);
  }, [kind, manualOpen, onRequestDealPick]);

  const onRequestDealPickRef = useRef(onRequestDealPick);
  onRequestDealPickRef.current = onRequestDealPick;
  useEffect(() => () => {
    if (onRequestDealPickRef.current) onRequestDealPickRef.current(null);
  }, []);

  const updateFilter = (index, patch) => setFilters(filters.map((filter, i) => (i === index ? { ...filter, ...patch } : filter)));

  const buildManualPayload = () => {
    if (kind === 'FILTER_THEN_LIST') {
      return {
        filters: filters.map(coerceFilterForPayload),
        deal_filter: dealFilter,
        sort_by: 'deal_signing_date_desc',
        columns: ['deal_name', 'signing_date', 'consideration_type', 'total_deal_value'],
      };
    }
    if (kind === 'MARKET_RANGE') {
      const field = mrFields.find((item) => item.key === mrField);
      return {
        provision_type: mrProvisionType,
        field_path: mrField,
        deal_filter: dealFilter,
        chart_kind: field?.numeric ? 'HISTOGRAM' : 'BAR',
      };
    }
    if (kind === 'PROVISION_CROSS_CUT') {
      return {
        provision_type: ccProvisionType,
        provision_subtype: null,
        deal_ids: filteredDealIds,
        columns: ccField ? [ccField] : [],
        sort_by: 'deal_signing_date_desc',
      };
    }
    if (kind === 'DEAL_COMPARE') {
      return {
        deal_ids: pickSelection,
        provision_types: ['CONSIDERATION', 'TERMINATION_FEE', 'COVENANT_NO_SOLICITATION'],
        highlight_deltas: true,
        included_field_groups: ['primary', 'qualifiers'],
      };
    }
    if (kind === 'DEAL_TO_MARKET') {
      return {
        deal_id: dtmDealId,
        comparison_set_filter: dealFilter,
        provision_types: null,
      };
    }
    return null;
  };

  const validateAndOpen = async (queryKind, payload, summary = null) => {
    setError(null);
    setRunning(true);
    if (summary) setInterpretation((current) => ({ ...(current || {}), status: 'ready', kind: queryKind, summary }));
    try {
      const res = await fetch('/api/query/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: queryKind, query_payload: payload }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || 'The query could not be run.');
      await router.push(resultHref(queryKind, payload));
    } catch (err) {
      setError(err.message || 'That query could not be run. Refine it and try again.');
    } finally {
      setRunning(false);
    }
  };

  const ask = async (submittedQuestion = question) => {
    const text = String(submittedQuestion || '').trim();
    if (!text || running) return;
    setQuestion(text);
    setError(null);
    setInterpretation(null);
    setRunning(true);
    try {
      const res = await fetch('/api/query/interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || 'The question could not be interpreted.');
      setInterpretation(json);
      if (json.status === 'ready' && json.kind && json.payload) {
        setRunning(false);
        await validateAndOpen(json.kind, json.payload, json.summary);
      }
    } catch (err) {
      setError(err.message || 'The question could not be interpreted. Try being more specific.');
    } finally {
      setRunning(false);
    }
  };

  const runManual = () => {
    if (kind === 'DEAL_COMPARE' && pickSelection.length < 2) return;
    const payload = buildManualPayload();
    if (!payload || !INLINE_KINDS.has(kind)) return;
    validateAndOpen(kind, payload);
  };

  const manualDisabled = running
    || (kind === 'DEAL_TO_MARKET' && !dtmDealId)
    || (kind === 'DEAL_COMPARE' && pickSelection.length < 2)
    || (kind === 'MARKET_RANGE' && !mrField)
    || (kind === 'PROVISION_CROSS_CUT' && (!ccField || !filteredDealIds.length));
  const manualRunLabel = running ? 'Running...'
    : kind === 'DEAL_TO_MARKET' ? (dtmDealId ? 'Run deal vs market' : 'Select a deal')
    : kind === 'DEAL_COMPARE' ? (pickSelection.length >= 2 ? `Compare ${pickSelection.length} deals` : 'Select 2 or more deals below')
    : kind === 'PROVISION_CROSS_CUT' && !filteredDealIds.length ? 'No deals match filters'
    : 'Run query';
  const filterDescription = describeDealFilters(dealFilterValues);

  return (
    <div className="mtx">
      <section className={`qlb${bordered ? '' : ' qlbFlush'}`} aria-labelledby="ask-corpus-title">
        <div className="qlbIntro">
          <span className="qlbEyebrow">Ask corpus</span>
          <div>
            <h1 id="ask-corpus-title">What do you want to know?</h1>
            <p>Ask in plain English. Corpus will choose the query type and match your question to a specific comparable term.</p>
          </div>
        </div>

        <form className="qlbAsk" onSubmit={(event) => { event.preventDefault(); ask(); }}>
          <label htmlFor="corpus-question" className="srOnly">What do you want to know?</label>
          <input
            id="corpus-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="e.g. Compare matching-rights periods across healthcare deals"
            autoComplete="off"
          />
          <button type="submit" className="mtx-btn mtx-btn-primary qlbAskButton" disabled={running || !question.trim()}>
            {running ? 'Working...' : 'Ask corpus'}
          </button>
        </form>

        <div className="qlbExamples" aria-label="Example questions">
          <span>Try</span>
          {EXAMPLES.map((example) => (
            <button type="button" key={example} onClick={() => ask(example)} disabled={running}>{example}</button>
          ))}
        </div>

        <div className="qlbFeedback" aria-live="polite">
          {interpretation?.status === 'needs_clarification' && (
            <div className="qlbClarify">
              <div>
                <b>{/metric|term|matching-rights|provision/i.test(interpretation.clarification || '') ? 'Choose the term you mean' : 'One more detail'}</b>
                <p>{interpretation.clarification || 'That provision has several independently comparable terms.'}</p>
              </div>
              {!!interpretation.suggestions?.length && (
                <div className="qlbSuggestions">
                  {interpretation.suggestions.map((suggestion) => (
                    <button type="button" key={`${suggestion.label}-${suggestion.question}`} onClick={() => ask(suggestion.question)} disabled={running}>
                      {suggestion.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {interpretation?.status === 'ready' && interpretation.summary && (
            <div className="qlbInterpreted">
              <span>Interpreted as</span>
              <b>{KIND_LABELS[interpretation.kind] || interpretation.kind}</b>
              <span>{interpretation.summary}</span>
            </div>
          )}
          {error && <div className="qlbErr" role="alert">{error}</div>}
        </div>

        <details className="qlbManual" onToggle={(event) => setManualOpen(event.currentTarget.open)}>
          <summary>Build manually <span>Use the provision, metric and deal-filter controls</span></summary>
          <div className="qlbManualBody">
            <div className="qlbManualSection">
              <span className="qlbManualLabel">Query type</span>
              <KindTabs kinds={Object.keys(KIND_LABELS)} labels={KIND_LABELS} value={kind} onChange={setKind} />
            </div>

            {kind !== 'DEAL_COMPARE' && (
              <DealFiltersBlock deals={deals || []} values={dealFilterValues} onChange={setDealFilterValues} />
            )}

            <div className="qlbStage">
              {kind === 'FILTER_THEN_LIST' && (
                <div className="qlbFilters">
                  {filters.map((filter, index) => (
                    <div className="qlbBlock" key={index}>
                      <FilterRow
                        filter={filter}
                        onChange={(patch) => updateFilter(index, patch)}
                        onRemove={filters.length > 1 ? () => setFilters(filters.filter((_, i) => i !== index)) : null}
                        showPreview
                      />
                    </div>
                  ))}
                  <button type="button" className="qlbAddFilter" onClick={() => setFilters([...filters, { provision_type: filters[filters.length - 1]?.provision_type || 'COVENANT_NO_SOLICITATION', field: '', op: null, value: '' }])}>
                    Add another filter
                  </button>
                </div>
              )}

              {kind === 'MARKET_RANGE' && (
                <div className="qlbRow">
                  <label><span>Provision</span><ProvisionTypeSelect value={mrProvisionType} onChange={setMrProvisionType} /></label>
                  <label><span>Comparable metric</span>
                    <select className="mtx-select" value={mrField} onChange={(event) => setMrField(event.target.value)} disabled={!mrFields.length}>
                      {!mrFields.length && <option value="">Loading metrics...</option>}
                      {mrFields.map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}
                    </select>
                  </label>
                </div>
              )}

              {kind === 'PROVISION_CROSS_CUT' && (
                <div className="qlbRow">
                  <label><span>Provision</span><ProvisionTypeSelect value={ccProvisionType} onChange={setCcProvisionType} /></label>
                  <label><span>Term to compare</span>
                    <select className="mtx-select" value={ccField} onChange={(event) => setCcField(event.target.value)} disabled={!ccFields.length}>
                      {!ccFields.length && <option value="">Loading terms...</option>}
                      {ccFields.map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}
                    </select>
                  </label>
                </div>
              )}

              {kind === 'DEAL_TO_MARKET' && (
                <div className="qlbDealPicker">
                  <DealPicker deals={deals} value={dtmDealId} onChange={setDtmDealId} label="Deal to benchmark" />
                  <p className="qlbMuted">Or pick a row below. The comparison keeps {filterDescription.length ? 'the selected deal filters' : 'the full corpus'}.</p>
                </div>
              )}

              {kind === 'DEAL_COMPARE' && (
                <p className="qlbMuted">
                  {pickSelection.length === 0 && 'Select 2 to 4 deals in the table below.'}
                  {pickSelection.length === 1 && 'One deal selected. Select at least one more.'}
                  {pickSelection.length >= 2 && `${pickSelection.length} deals selected.`}
                </p>
              )}
            </div>

            <div className="qlbManualFooter">
              <span>{kind === 'DEAL_COMPARE' ? 'Selected deals only' : filterDescription.length ? filterDescription.join(' · ') : 'All deals'}</span>
              <button type="button" className="mtx-btn mtx-btn-primary" disabled={manualDisabled} onClick={runManual}>{manualRunLabel}</button>
            </div>
          </div>
        </details>
      </section>
      <style jsx>{`
        .qlb { border: 1px solid var(--line, #E0E0E0); background: #fff; padding: 26px 28px 20px; font-family: var(--mtx-sans); }
        .qlbFlush { border: none; }
        .qlbIntro { display: grid; grid-template-columns: 90px minmax(0, 1fr); gap: 18px; align-items: start; }
        .qlbEyebrow, .qlbManualLabel { padding-top: 4px; font-size: 9px; line-height: 1.2; font-weight: 750; letter-spacing: .14em; text-transform: uppercase; color: var(--accent-deep, #6F263D); }
        .qlbIntro h1 { margin: 0; font-size: 22px; line-height: 1.15; font-weight: 650; color: var(--ink, #1F1F1F); }
        .qlbIntro p { margin: 6px 0 0; max-width: 680px; font-size: 13px; line-height: 1.5; color: var(--ink-light, #6B6B6B); }
        .qlbAsk { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; margin-top: 20px; }
        .qlbAsk input { width: 100%; min-width: 0; height: 50px; border: 1px solid #AFAFAF; background: #fff; padding: 0 15px; font-family: var(--mtx-sans); font-size: 14px; color: var(--ink, #1F1F1F); outline: none; }
        .qlbAsk input::placeholder { color: #8A8A8A; }
        .qlbAsk input:focus { border-color: var(--accent, #9A3D57); box-shadow: inset 0 -2px 0 var(--accent, #9A3D57); }
        .qlbAskButton { min-width: 124px; height: 50px; padding: 0 18px; font-size: 13px; }
        .qlbExamples { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 10px; margin-top: 10px; color: var(--ink-faint, #9A9A9A); font-size: 11px; }
        .qlbExamples > span { font-weight: 700; letter-spacing: .08em; text-transform: uppercase; font-size: 9px; }
        .qlbExamples button { border: 0; border-bottom: 1px solid #CFCFCF; background: transparent; padding: 2px 0; color: var(--ink-light, #6B6B6B); font-family: var(--mtx-sans); font-size: 11px; cursor: pointer; text-align: left; }
        .qlbExamples button:hover { color: var(--ink, #1F1F1F); border-color: var(--accent, #9A3D57); }
        .qlbFeedback:empty { display: none; }
        .qlbClarify { margin-top: 16px; border-left: 3px solid var(--accent, #9A3D57); background: var(--paper-2, #F6F6F6); padding: 13px 14px; }
        .qlbClarify b { font-size: 13px; color: var(--ink, #1F1F1F); }
        .qlbClarify p { margin: 3px 0 0; font-size: 12px; line-height: 1.45; color: var(--ink-light, #6B6B6B); }
        .qlbSuggestions { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 10px; }
        .qlbSuggestions button { min-height: 34px; border: 1px solid var(--line, #E0E0E0); background: #fff; padding: 6px 10px; font-family: var(--mtx-sans); font-size: 12px; color: var(--ink, #1F1F1F); cursor: pointer; }
        .qlbSuggestions button:hover { border-color: var(--accent, #9A3D57); }
        .qlbInterpreted { display: flex; align-items: center; flex-wrap: wrap; gap: 7px; margin-top: 12px; font-size: 11px; color: var(--ink-light, #6B6B6B); }
        .qlbInterpreted > span:first-child { text-transform: uppercase; letter-spacing: .08em; font-size: 9px; font-weight: 700; color: var(--ink-faint, #9A9A9A); }
        .qlbInterpreted b { border: 1px solid var(--line, #E0E0E0); background: var(--paper-2, #F6F6F6); padding: 3px 6px; font-size: 10px; text-transform: uppercase; letter-spacing: .06em; color: var(--ink, #1F1F1F); }
        .qlbErr { margin-top: 14px; border: 1px solid rgba(177, 78, 99, 0.35); background: rgba(177, 78, 99, 0.06); padding: 9px 11px; color: #8F304A; font-size: 12px; }
        .qlbManual { margin-top: 18px; border-top: 1px solid var(--line, #E0E0E0); }
        .qlbManual summary { display: flex; align-items: baseline; gap: 9px; width: fit-content; padding-top: 13px; color: var(--ink, #1F1F1F); font-size: 12px; font-weight: 650; cursor: pointer; list-style: none; }
        .qlbManual summary::-webkit-details-marker { display: none; }
        .qlbManual summary::before { content: '+'; color: var(--accent-deep, #6F263D); font-weight: 700; }
        .qlbManual[open] summary::before { content: '−'; }
        .qlbManual summary span { font-size: 11px; font-weight: 400; color: var(--ink-faint, #9A9A9A); }
        .qlbManualBody { display: flex; flex-direction: column; gap: 16px; margin-top: 15px; padding: 18px; border: 1px solid var(--line, #E0E0E0); border-top: 2px solid var(--ink, #1F1F1F); background: #F8F8F8; }
        .qlbManualSection { display: flex; align-items: flex-start; gap: 12px; }
        .qlbBlock { border: 1px solid var(--line, #E0E0E0); background: #fff; padding: 10px; }
        .qlbFilters { display: flex; flex-direction: column; gap: 8px; }
        .qlbAddFilter { align-self: flex-start; min-height: 32px; border: 1px dashed var(--line, #E0E0E0); background: #fff; color: var(--ink, #1F1F1F); font-family: var(--mtx-sans); font-size: 11px; padding: 5px 10px; cursor: pointer; }
        .qlbAddFilter:hover { border-color: var(--ink-light, #6B6B6B); }
        .qlbRow { display: grid; grid-template-columns: minmax(200px, .8fr) minmax(260px, 1.2fr); gap: 10px; }
        .qlbRow label { display: flex; min-width: 0; flex-direction: column; gap: 5px; }
        .qlbRow label > span { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .09em; color: var(--ink-faint, #9A9A9A); }
        .qlbMuted { margin: 0; font-size: 12px; line-height: 1.5; color: var(--ink-light, #6B6B6B); }
        .qlbDealPicker { max-width: 620px; display: flex; flex-direction: column; gap: 8px; }
        .qlbManualFooter { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding-top: 12px; border-top: 1px solid var(--line, #E0E0E0); }
        .qlbManualFooter > span { font-size: 11px; color: var(--ink-light, #6B6B6B); }
        .qlbManualFooter :global(.mtx-btn) { min-height: 38px; }
        .qlb :global(.mtx-select), .qlb :global(.mtx-input) { min-height: 34px; font-size: 12px; }
        .qlbRow :global(.mtx-select) { width: 100%; min-width: 0; max-width: 100%; }
        .srOnly { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
        @media (max-width: 720px) {
          .qlb { padding: 20px 16px 16px; }
          .qlbIntro { grid-template-columns: 1fr; gap: 7px; }
          .qlbEyebrow { padding: 0; }
          .qlbAsk { grid-template-columns: 1fr; }
          .qlbAskButton { width: 100%; }
          .qlbManualSection { flex-direction: column; }
          .qlbRow { grid-template-columns: 1fr; }
          .qlbManualFooter { align-items: stretch; flex-direction: column; }
          .qlbManualFooter :global(.mtx-btn) { width: 100%; }
        }
      `}</style>
    </div>
  );
}
