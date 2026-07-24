// Canonical Query UI slice: renders a CANONICAL_QUERY_RESULT_VIEW/V2
// (lib/canonical-v2/query-result.js buildCanonicalQueryResultView)
// for supported governed ad hoc requests. Deliberately does NOT reshape
// into the legacy MARKET_RANGE result
// contract and does NOT reuse the legacy MarketRange component (see
// pages/query/[kind]/[id].js) — this is a governed, differently-shaped
// contract and mixing the two render paths would blur which one produced a
// given number on screen.
//
// Cohort statistics are rendered only from the server-produced full-cohort
// summary. They are never reconstructed from the bounded page rows.

import { useEffect, useMemo, useState } from 'react';
import { CanonicalSourceDetail } from '../review-v2/CanonicalReviewSection';
const {
  mapCanonicalRowForRender,
  buildRefinedCanonicalRequest,
  refinementOptionsFromView,
  humanizeRefinementLabel,
  hasPercentRangeRefinement,
} = require('../../lib/canonical-v2/legacy-query-mapper');
const {
  factLabel,
  paymentTimingLabel,
  triggerLabel,
} = require('../../lib/canonical-v2/termination-fee-trigger-presentation');

// Labels are plain UI copy, not taxonomy or vocabulary codes.
const METRIC_LABELS = {
  SELLER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE: 'Seller termination fee — % of deal value',
  BUYER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE: 'Buyer / reverse termination fee — % of deal value',
  IOC_CAPEX_THRESHOLD_PERCENT_OF_DEAL_VALUE: 'Interim operating covenant capex threshold — % of deal value',
  MATERIAL_CONTRACT_CASH_FLOW_THRESHOLD_PERCENT_OF_DEAL_VALUE: 'Material contract cash-flow threshold — % of deal value',
  NO_SHOP_NOTICE_PERIOD_DAYS: 'No-shop notice period — elapsed days',
  NO_SHOP_INITIAL_MATCH_PERIOD_DAYS: 'No-shop — initial match period (business days)',
};

function truncateDigest(value) {
  if (typeof value !== 'string' || !value) return '—';
  return value.length > 12 ? `${value.slice(0, 12)}…` : value;
}

function formatSummaryValue(value, metricKey) {
  if (value === null || value === undefined) return '—';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '—';
  const compact = numeric.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (metricKey.includes('PERCENT_OF_DEAL_VALUE')) return `${compact}%`;
  if (metricKey.includes('_DAYS')) return `${compact} day${numeric === 1 ? '' : 's'}`;
  return compact;
}

function scalePosition(value, min, max) {
  const numeric = Number(value);
  const lower = Number(min);
  const upper = Number(max);
  if (![numeric, lower, upper].every(Number.isFinite)) return 0;
  if (upper === lower) return 50;
  return Math.max(0, Math.min(100, ((numeric - lower) / (upper - lower)) * 100));
}

function summaryHeading(view) {
  if (view.metric_key === 'SELLER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE') {
    return 'Seller / target termination fee';
  }
  if (view.metric_key === 'BUYER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE') {
    return 'Buyer / reverse termination fee';
  }
  return METRIC_LABELS[view.metric_key] || view.metric_key;
}

const SUMMARY_STATE_COPY = {
  NO_VALUES: 'No comparable values match these refinements.',
  INCOMPLETE_NUMERIC_DOMAIN: 'Some matching deals do not have a complete comparable numeric value.',
  NOT_DEFINED_MULTI_VALUE_PER_DEAL: 'At least one deal has multiple values, so a single-deal distribution is not defined.',
};

function facetValueLabel(value, facetKey, metricKey) {
  const legalOperation = metricKey === 'BUYER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE'
    ? 'CREATES_BUYER_TERMINATION_FEE_PAYMENT_TRIGGER'
    : 'CREATES_SELLER_TERMINATION_FEE_PAYMENT_TRIGGER';
  try {
    if (facetKey === 'trigger_codes') {
      return triggerLabel({ trigger_code: value, legal_operation: legalOperation }) || value;
    }
    if (facetKey === 'payment_timings') {
      return paymentTimingLabel({ payment_timing: value }) || value;
    }
    if (facetKey === 'trigger_conditions') {
      return factLabel(value, { legal_operation: legalOperation }) || value;
    }
  } catch {
    return value;
  }
  return value;
}

function refinementValueLabel(value, columnKey, metricKey) {
  const facetKey = {
    trigger_code: 'trigger_codes',
    payment_timing: 'payment_timings',
    trigger_condition: 'trigger_conditions',
  }[columnKey];
  return facetKey ? facetValueLabel(value, facetKey, metricKey) : value;
}

function draftFromFilters(filters) {
  return {
    min_percent_of_deal_value: filters.min_percent_of_deal_value || '',
    max_percent_of_deal_value: filters.max_percent_of_deal_value || '',
    fee_side: filters.fee_side || '',
    payer_capacity: filters.payer_capacity || '',
    payee_capacity: filters.payee_capacity || '',
    trigger_code: filters.trigger_code || '',
    payment_timing: filters.payment_timing || '',
    trigger_condition: filters.trigger_condition || '',
  };
}

function SummaryFacet({
  label, facetKey, values, denominator, metricKey,
}) {
  if (!Array.isArray(values) || values.length === 0) return null;
  return (
    <section className="cmrFacet">
      <h4>{label}</h4>
      <div className="cmrFacetRows">
        {values.map((entry) => {
          const width = denominator > 0 ? (entry.deal_count / denominator) * 100 : 0;
          return (
            <div className="cmrFacetRow" key={entry.value}>
              <span className="cmrFacetLabel">
                {facetValueLabel(entry.value, facetKey, metricKey)}
              </span>
              <span className="cmrFacetTrack" aria-hidden="true">
                <span style={{ width: `${width}%` }} />
              </span>
              <span className="cmrFacetCount">
                {entry.deal_count}/{denominator}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function CohortSummary({ view }) {
  const summary = view.cohort_summary;
  if (!summary) return null;
  const { statistics, counts, facets } = summary;
  const available = statistics.state === 'AVAILABLE';
  const minPosition = scalePosition(statistics.min, statistics.min, statistics.max);
  const maxPosition = scalePosition(statistics.max, statistics.min, statistics.max);
  const p25Position = scalePosition(statistics.p25, statistics.min, statistics.max);
  const p75Position = scalePosition(statistics.p75, statistics.min, statistics.max);
  const medianPosition = scalePosition(statistics.median, statistics.min, statistics.max);
  const meanPosition = scalePosition(statistics.mean, statistics.min, statistics.max);
  const stats = [
    ['Min', statistics.min],
    ['25th', statistics.p25],
    ['Median', statistics.median],
    ['Mean', statistics.mean],
    ['75th', statistics.p75],
    ['Max', statistics.max],
  ];

  return (
    <section className="cmrSummary" aria-labelledby="cmr-summary-heading">
      <div className="cmrSummaryHead">
        <div>
          <p className="cmrEyebrow">Full comparable cohort</p>
          <h3 id="cmr-summary-heading">{summaryHeading(view)}</h3>
        </div>
        <p>{counts.distinct_deals} deal{counts.distinct_deals === 1 ? '' : 's'}</p>
      </div>
      {available ? (
        <>
          {counts.approximate_distinct_deals > 0 && (
            <p className="cmrApproximate">
              {counts.approximate_distinct_deals === counts.distinct_deals
                ? 'All values use an approximate deal-value denominator.'
                : `${counts.approximate_distinct_deals} of ${counts.distinct_deals} deals use an approximate deal-value denominator.`}
            </p>
          )}
          <div className="cmrScale" aria-label={`Market range from ${formatSummaryValue(statistics.min, view.metric_key)} to ${formatSummaryValue(statistics.max, view.metric_key)}`}>
            <div className="cmrScaleLine" style={{ left: `${minPosition}%`, right: `${100 - maxPosition}%` }} />
            <div
              className="cmrScaleIqr"
              style={{ left: `${p25Position}%`, width: `${Math.max(p75Position - p25Position, 1)}%` }}
            />
            <span className="cmrScaleMarker cmrScaleMedian" style={{ left: `${medianPosition}%` }} title="Median" />
            <span className="cmrScaleMarker cmrScaleMean" style={{ left: `${meanPosition}%` }} title="Mean" />
          </div>
          <div className="cmrStats">
            {stats.map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <b>{formatSummaryValue(value, view.metric_key)}</b>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="cmrSummaryState">{SUMMARY_STATE_COPY[statistics.state] || 'Comparable statistics are unavailable.'}</p>
      )}
      <div className="cmrFacets">
        <SummaryFacet label="Trigger" facetKey="trigger_codes" values={facets.trigger_codes} denominator={counts.distinct_deals} metricKey={view.metric_key} />
        <SummaryFacet label="Payment timing" facetKey="payment_timings" values={facets.payment_timings} denominator={counts.distinct_deals} metricKey={view.metric_key} />
        <SummaryFacet label="Condition" facetKey="trigger_conditions" values={facets.trigger_conditions} denominator={counts.distinct_deals} metricKey={view.metric_key} />
      </div>
    </section>
  );
}

function TriggerPathways({
  pathways, expanded, onToggle,
}) {
  if (pathways.length === 0) return '—';
  return (
    <div className="cmrTriggerPaths">
      <button
        type="button"
        className="cmrTriggerToggle"
        aria-expanded={expanded}
        onClick={onToggle}
      >
        {pathways.length} pathway{pathways.length === 1 ? '' : 's'}
        <span>{expanded ? 'Hide' : 'View'}</span>
      </button>
      {expanded && (
        <div className="cmrTriggerDetail">
          {pathways.map((pathway, index) => (
            <section
              key={`${pathway.pathway_code || pathway.pathway_label}:${index}`}
              className="cmrTriggerPath"
            >
              <h4>{pathway.pathway_label}: {pathway.trigger_label}</h4>
              <dl>
                <div><dt>Terminating party</dt><dd>{pathway.terminating_party_label}</dd></div>
                <div><dt>Payment timing</dt><dd>{pathway.payment_timing_label}</dd></div>
                <div><dt>Conditions</dt><dd>{pathway.condition_expression_text}</dd></div>
              </dl>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function RowCells({
  row,
  rawRow,
  columnCount,
  envelope,
  triggerExpanded,
  onTriggerToggle,
}) {
  try {
    if (row.error) throw new Error(row.error);
    return (
      <>
        {row.cells.map((cell) => {
          const sourceAction = cell.column_key === 'source'
            ? rawRow?.source_actions?.[0]
            : null;
          return (
            <td key={cell.column_key}>
              {sourceAction ? (
                <CanonicalSourceDetail
                  envelope={envelope}
                  governedDealKey={rawRow.governed_deal_key}
                  rowKey={rawRow.row_serving_key}
                  sourceAction={sourceAction}
                />
              ) : cell.column_key === 'triggers' && Array.isArray(cell.display)
                ? (
                  <TriggerPathways
                    pathways={cell.display}
                    expanded={triggerExpanded}
                    onToggle={onTriggerToggle}
                  />
                )
                : Array.isArray(cell.display)
                  ? (cell.display.length ? cell.display.join('; ') : '—')
                  : cell.display}
            </td>
          );
        })}
      </>
    );
  } catch {
    return <td colSpan={columnCount} className="cmrRowError">This row could not be displayed.</td>;
  }
}

// Slice 2 (2026-07-23): governed refinement controls — dropdowns sourced
// from refinementOptionsFromView (never a hardcoded vocabulary list), two
// free-text percent-of-deal-value inputs, and Apply/Clear. Every action
// builds its request body through buildRefinedCanonicalRequest and hands it
// to `onRequest` — this component never touches the network itself, and
// never fires a request on a keystroke or dropdown change, only on an
// explicit button/chip click. `body` is the CURRENT canonical request body
// (Slice 1's mapper output, or whatever was last successfully applied) —
// needed here (not just `view`) because the view itself never echoes back
// the deal-level `filters` a refinement must carry forward untouched.
function RefinementControls({ view, body, onRequest, pending }) {
  const options = useMemo(() => refinementOptionsFromView(view), [view]);
  const showPercentRange = hasPercentRangeRefinement(view);
  const activeFilters = (body && body.column_filters) || {};
  const activeFilterSignature = JSON.stringify(activeFilters);
  const [draft, setDraft] = useState(() => draftFromFilters(activeFilters));
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    setDraft(draftFromFilters(JSON.parse(activeFilterSignature)));
  }, [activeFilterSignature]);

  const setField = (key, value) => setDraft((prev) => ({ ...prev, [key]: value }));

  const submit = (columnFilters) => {
    if (pending) return; // single-in-flight: an explicit second action is a no-op, never queued
    setFormError(null);
    try {
      onRequest(buildRefinedCanonicalRequest(body, columnFilters));
    } catch (err) {
      // An invalid refinement never spends a POST — the previous view and
      // controls stay exactly as they were, plus a local correction hint.
      setFormError(err.message || 'This refinement could not be applied.');
    }
  };

  const chipEntries = Object.entries(activeFilters).filter(([, value]) => value !== null && value !== undefined && value !== '');

  return (
    <div className="cmrRefine">
      <div className="cmrRefineRow">
        {options.map((option) => (
          <label key={option.column_key} className="cmrRefineField">
            <span>{option.label}</span>
            <select
              className="mtx-select"
              value={draft[option.column_key] || ''}
              disabled={pending}
              onChange={(event) => setField(option.column_key, event.target.value)}
            >
              <option value="">Any</option>
              {option.values.map((value) => (
                <option key={value} value={value}>
                  {refinementValueLabel(value, option.column_key, view.metric_key)}
                </option>
              ))}
            </select>
          </label>
        ))}
        {showPercentRange && (
          <>
            <label className="cmrRefineField">
              <span>Min % of deal value</span>
              <input
                type="text"
                inputMode="decimal"
                className="mtx-input"
                disabled={pending}
                value={draft.min_percent_of_deal_value}
                onChange={(event) => setField('min_percent_of_deal_value', event.target.value)}
              />
            </label>
            <label className="cmrRefineField">
              <span>Max % of deal value</span>
              <input
                type="text"
                inputMode="decimal"
                className="mtx-input"
                disabled={pending}
                value={draft.max_percent_of_deal_value}
                onChange={(event) => setField('max_percent_of_deal_value', event.target.value)}
              />
            </label>
          </>
        )}
      </div>
      <div className="cmrRefineActions">
        <button type="button" className="mtx-btn mtx-btn-primary" disabled={pending} onClick={() => submit(draft)}>Apply refinements</button>
        <button type="button" className="mtx-btn" disabled={pending} onClick={() => submit({})}>Clear</button>
      </div>
      {formError && <p className="cmrRefineError">{formError}</p>}
      {chipEntries.length > 0 && (
        <div className="cmrChips">
          {chipEntries.map(([key, value]) => (
            <button
              key={key}
              type="button"
              className="cmrChip"
              disabled={pending}
              title="Remove this filter"
              onClick={() => {
                const { [key]: _dropped, ...rest } = activeFilters;
                submit(rest);
              }}
            >
              {`${humanizeRefinementLabel(key)}: ${refinementValueLabel(value, key, view.metric_key)}`} ×
            </button>
          ))}
        </div>
      )}
      <style jsx>{`
        .cmrRefine { padding: 12px 16px; border-bottom: 1px solid var(--line); background: var(--paper-2); }
        .cmrRefineRow { display: flex; flex-wrap: wrap; gap: 10px 14px; align-items: flex-end; }
        .cmrRefineField { display: flex; flex-direction: column; gap: 2px; font: 8px var(--mtx-sans); text-transform: uppercase; letter-spacing: .08em; color: var(--ink-faint, #9A9A9A); min-width: 120px; }
        .cmrRefineField :global(.mtx-select), .cmrRefineField :global(.mtx-input) { height: 28px; min-height: 28px; font-size: 11px; }
        .cmrRefineActions { display: flex; gap: 8px; margin-top: 10px; }
        .cmrRefineError { margin: 8px 0 0; font-size: 11px; color: #B14E63; }
        .cmrChips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
        .cmrChip { border: 1px solid var(--line); background: var(--paper); font: 10px var(--mtx-sans); padding: 3px 8px; cursor: pointer; color: var(--ink); }
        .cmrChip:disabled { opacity: .5; cursor: default; }
      `}</style>
    </div>
  );
}

export default function CanonicalMarketRange({
  view, body = null, onRequest = null, pending = false,
}) {
  const [expandedTriggerRow, setExpandedTriggerRow] = useState(null);
  const columns = view?.columns || [];
  const rows = useMemo(() => (view?.rows || []).map((rawRow) => ({
    rawRow,
    rendered: mapCanonicalRowForRender(rawRow, columns),
  })), [view, columns]);
  if (!view) return null;
  const metricLabel = METRIC_LABELS[view.metric_key] || view.metric_key;

  return (
    <div className="cmr">
      <div className="cmrHeader">
        <h2>{metricLabel}</h2>
        <p className="cmrMeta">
          Payer capacity: <b>{(view.party && view.party.capacity) || '—'}</b>
          {' · '}
          {view.total_count} total{Array.isArray(view.rows) ? `, showing ${view.rows.length}` : ''}
        </p>
        <p className="cmrProvenance mtx-mono">
          Release {truncateDigest(view.corpus_release_id)} · Contract {truncateDigest(view.contract_fingerprint)}
        </p>
      </div>
      <CohortSummary view={view} />
      {/* Refinement controls only appear once we have a body to refine from
          (always true once a canonical view is on screen — the page sets
          both together). Keyed on the currently-ACTIVE filters so the draft
          form resets whenever an external action (Clear/chip removal/a
          completed Apply) changes what's actually applied, without
          remounting on every keystroke in between (same technique as
          ResultRefinements' `key={JSON.stringify(currentPayload)}` in
          pages/query/[kind]/[id].js). */}
      {body && onRequest && (
        <RefinementControls
          key={JSON.stringify(body.column_filters || {})}
          view={view}
          body={body}
          onRequest={onRequest}
          pending={pending}
        />
      )}
      <div className="scroll">
        <table className="mtx-table">
          <thead>
            <tr>
              {columns.map((column) => <th key={column.column_key}>{column.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={Math.max(columns.length, 1)} className="cmrEmpty">No matching deals.</td></tr>
            ) : rows.map(({ rawRow, rendered }, index) => (
              <tr key={rendered.row_serving_key || index}>
                <RowCells
                  row={rendered}
                  rawRow={rawRow}
                  columnCount={columns.length}
                  envelope={view}
                  triggerExpanded={expandedTriggerRow === rawRow.row_serving_key}
                  onTriggerToggle={() => setExpandedTriggerRow((current) => (
                    current === rawRow.row_serving_key ? null : rawRow.row_serving_key
                  ))}
                />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* "Show more" (Slice 2): one bounded follow-up POST carrying the
          CURRENT body's column_filters forward with cursor: view.next_cursor
          untouched — the append/replace decision itself lives in
          resolveCanonicalQueryPageUpdate (legacy-query-mapper.js), driven
          off `!!body.cursor`, not a flag threaded through here. */}
      {view.next_cursor && (
        <div className="cmrShowMore">
          {/* rows.length (not view.page_count) — after one or more Show
              more appends, page_count is only the LAST fetched page's size
              (appendCanonicalPage takes it verbatim from nextView per the
              spec); the actual rendered row count is what "showing N" must
              describe, or a second Show more would read as regressing. */}
          <p className="cmrNotice">{`Showing ${rows.length} of ${view.total_count}.`}</p>
          {body && onRequest && (
            <button
              type="button"
              className="mtx-btn"
              disabled={pending}
              onClick={() => onRequest(Object.freeze({ ...body, cursor: { ...view.next_cursor } }))}
            >
              {pending ? 'Loading…' : 'Show more'}
            </button>
          )}
        </div>
      )}
      <style jsx>{`
        .cmr { border: 1px solid var(--line); background: var(--paper); font-family: var(--mtx-sans); }
        .cmrHeader { padding: 14px 16px; border-bottom: 1px solid var(--line); }
        .cmrHeader h2 { margin: 0 0 6px; font-size: 14px; font-weight: 700; color: var(--ink); }
        .cmrMeta { margin: 0; font-size: 12px; color: var(--ink-light); }
        .cmrProvenance { margin: 4px 0 0; font-size: 10px; color: var(--ink-faint, #9A9A9A); }
        :global(.cmrSummary) { padding: 14px 16px; border-bottom: 1px solid var(--line); background: var(--paper-2); }
        :global(.cmrSummaryHead) { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
        :global(.cmrSummaryHead h3) { margin: 1px 0 0; font-size: 13px; color: var(--ink); }
        :global(.cmrSummaryHead > p) { margin: 0; font-size: 11px; color: var(--ink-light); }
        :global(.cmrEyebrow) { margin: 0; font-size: 8px; text-transform: uppercase; letter-spacing: .1em; color: var(--ink-faint, #9A9A9A); }
        :global(.cmrScale) { position: relative; height: 28px; margin: 14px 6px 4px; }
        :global(.cmrScaleLine) { position: absolute; top: 13px; height: 2px; background: var(--ink-faint, #9A9A9A); }
        :global(.cmrScaleIqr) { position: absolute; top: 9px; height: 10px; min-width: 4px; border-radius: 2px; background: #C7A86B; }
        :global(.cmrScaleMarker) { position: absolute; top: 5px; width: 2px; height: 18px; transform: translateX(-1px); background: var(--ink); }
        :global(.cmrScaleMean) { width: 8px; height: 8px; top: 10px; transform: translateX(-4px) rotate(45deg); background: #B14E63; }
        :global(.cmrStats) { display: grid; grid-template-columns: repeat(6, minmax(70px, 1fr)); gap: 8px; }
        :global(.cmrStats div) { display: grid; gap: 2px; }
        :global(.cmrStats span) { font-size: 8px; text-transform: uppercase; letter-spacing: .08em; color: var(--ink-faint, #9A9A9A); }
        :global(.cmrStats b) { font-size: 11px; color: var(--ink); }
        :global(.cmrSummaryState) { margin: 12px 0 0; font-size: 11px; color: var(--ink-light); }
        :global(.cmrApproximate) { margin: 10px 0 0; font-size: 10px; color: #8A6030; }
        :global(.cmrFacets) { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 16px; margin-top: 14px; }
        :global(.cmrFacet h4) { margin: 0 0 6px; font-size: 9px; text-transform: uppercase; letter-spacing: .08em; color: var(--ink-faint, #9A9A9A); }
        :global(.cmrFacetRows) { display: grid; gap: 5px; }
        :global(.cmrFacetRow) { display: grid; grid-template-columns: minmax(110px, 1fr) 70px auto; align-items: center; gap: 7px; }
        :global(.cmrFacetLabel) { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 10px; color: var(--ink-light); }
        :global(.cmrFacetTrack) { height: 4px; background: var(--line); }
        :global(.cmrFacetTrack span) { display: block; height: 100%; background: #C7A86B; }
        :global(.cmrFacetCount) { font: 9px var(--mtx-mono); color: var(--ink-faint, #9A9A9A); }
        .scroll { overflow-x: auto; }
        .scroll :global(.mtx-table) { width: 100%; table-layout: auto; font-size: 11px; }
        .scroll :global(.mtx-table th), .scroll :global(.mtx-table td) { max-width: 280px; padding: 7px 9px; vertical-align: top; }
        .cmrRowError { color: #B14E63; font-size: 12px; padding: 8px 12px; }
        :global(.cmrTriggerPaths) { min-width: 170px; display: grid; gap: 7px; }
        :global(.cmrTriggerToggle) { display: flex; justify-content: space-between; gap: 10px; width: 100%; border: 0; border-bottom: 1px solid var(--line); padding: 0 0 4px; background: transparent; cursor: pointer; font: 600 10px var(--mtx-sans); color: var(--ink); }
        :global(.cmrTriggerToggle span) { color: var(--ink-faint, #9A9A9A); }
        :global(.cmrTriggerDetail) { display: grid; gap: 7px; min-width: 280px; }
        :global(.cmrTriggerPath) { border-bottom: 1px solid var(--line); padding: 0 0 7px; }
        :global(.cmrTriggerPath:last-child) { border-bottom: 0; padding-bottom: 0; }
        :global(.cmrTriggerPath h4) { margin: 0; font-size: 10px; color: var(--ink); }
        :global(.cmrTriggerPath dl) { margin: 6px 0 0; display: grid; gap: 4px; }
        :global(.cmrTriggerPath dl div) { display: grid; grid-template-columns: 88px minmax(0, 1fr); gap: 8px; }
        :global(.cmrTriggerPath dt) { font-size: 9px; text-transform: uppercase; letter-spacing: .05em; color: var(--ink-faint, #9A9A9A); }
        :global(.cmrTriggerPath dd) { margin: 0; font-size: 10px; line-height: 1.4; color: var(--ink-light); }
        .cmrEmpty { color: var(--ink-light); font-size: 12px; padding: 8px 12px; }
        .cmrShowMore { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-top: 1px solid var(--line); }
        .cmrNotice { margin: 0; font-size: 11px; color: var(--ink-light); }
        @media (max-width: 760px) {
          :global(.cmrStats) { grid-template-columns: repeat(3, 1fr); }
          :global(.cmrFacetRow) { grid-template-columns: minmax(90px, 1fr) 55px auto; }
        }
      `}</style>
    </div>
  );
}
