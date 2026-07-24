// Canonical Query UI slice (2026-07-22): renders a CANONICAL_QUERY_RESULT_
// VIEW/V1 (lib/canonical-v2/query-result.js buildCanonicalQueryResultView)
// for supported governed ad hoc requests. Deliberately does NOT reshape
// into the legacy MARKET_RANGE result
// contract and does NOT reuse the legacy MarketRange component (see
// pages/query/[kind]/[id].js) — this is a governed, differently-shaped
// contract and mixing the two render paths would blur which one produced a
// given number on screen.
//
// No client-side stats (min/median/max/etc across rows): `total_count` is
// the only cohort-level number this page ever shows. Computing a stat over
// one bounded page (up to page_size rows) and presenting it as if it
// described the cohort would be a legal-accuracy failure — page counts are
// not cohort counts.
//
// Slice 2 (2026-07-23): governed refinement controls + "Show more" — see
// RefinementControls below. `body`/`onRequest`/`pending` are optional so a
// caller with no refinement wiring yet still gets Slice 1's read-only
// rendering unchanged.

import { useMemo, useState } from 'react';
import { CanonicalSourceDetail } from '../review-v2/CanonicalReviewSection';
const {
  mapCanonicalRowForRender,
  buildRefinedCanonicalRequest,
  refinementOptionsFromView,
  humanizeRefinementLabel,
} = require('../../lib/canonical-v2/legacy-query-mapper');

// Labels are plain UI copy, not taxonomy or vocabulary codes.
const METRIC_LABELS = {
  SELLER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE: 'Seller termination fee — % of deal value',
  BUYER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE: 'Buyer / reverse termination fee — % of deal value',
  NO_SHOP_INITIAL_MATCH_PERIOD_DAYS: 'No-shop — initial match period (business days)',
};

function truncateDigest(value) {
  if (typeof value !== 'string' || !value) return '—';
  return value.length > 12 ? `${value.slice(0, 12)}…` : value;
}

function TriggerPathways({ pathways }) {
  if (pathways.length === 0) return '—';
  return (
    <div className="cmrTriggerPaths">
      {pathways.map((pathway, index) => (
        <details
          key={`${pathway.pathway_code || pathway.pathway_label}:${index}`}
          className="cmrTriggerPath"
        >
          <summary>{pathway.pathway_label}: {pathway.trigger_label}</summary>
          <dl>
            <div><dt>Terminating party</dt><dd>{pathway.terminating_party_label}</dd></div>
            <div><dt>Payment timing</dt><dd>{pathway.payment_timing_label}</dd></div>
            <div><dt>Conditions</dt><dd>{pathway.condition_expression_text}</dd></div>
          </dl>
        </details>
      ))}
    </div>
  );
}

// Renders one row's cells, isolated: mapCanonicalRowForRender already turns
// any per-row formatting failure into a `.error` marker rather than
// throwing, but this component wraps its own render pass too (belt-and-
// suspenders — the spec is explicit that a malformed row must never take
// sibling rows down with it).
function RowCells({ row, rawRow, columnCount, envelope }) {
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
                ? <TriggerPathways pathways={cell.display} />
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
  const activeFilters = (body && body.column_filters) || {};
  const [draft, setDraft] = useState(() => ({
    min_percent_of_deal_value: activeFilters.min_percent_of_deal_value || '',
    max_percent_of_deal_value: activeFilters.max_percent_of_deal_value || '',
    fee_side: activeFilters.fee_side || '',
    payer_capacity: activeFilters.payer_capacity || '',
    payee_capacity: activeFilters.payee_capacity || '',
    trigger_code: activeFilters.trigger_code || '',
    payment_timing: activeFilters.payment_timing || '',
    trigger_condition: activeFilters.trigger_condition || '',
  }));
  const [formError, setFormError] = useState(null);

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
              {option.values.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
        ))}
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
              {`${humanizeRefinementLabel(key)}: ${value}`} ×
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
  if (!view) return null;
  const columns = view.columns || [];
  const rows = (view.rows || []).map((rawRow) => ({
    rawRow,
    rendered: mapCanonicalRowForRender(rawRow, columns),
  }));
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
        .scroll { overflow-x: auto; }
        .cmrRowError { color: #B14E63; font-size: 12px; padding: 8px 12px; }
        :global(.cmrTriggerPaths) { min-width: 280px; display: grid; gap: 6px; }
        :global(.cmrTriggerPath) { border-bottom: 1px solid var(--line); padding: 0 0 6px; }
        :global(.cmrTriggerPath:last-child) { border-bottom: 0; padding-bottom: 0; }
        :global(.cmrTriggerPath summary) { cursor: pointer; font-size: 11px; font-weight: 650; color: var(--ink); }
        :global(.cmrTriggerPath dl) { margin: 6px 0 0; display: grid; gap: 4px; }
        :global(.cmrTriggerPath dl div) { display: grid; grid-template-columns: 88px minmax(0, 1fr); gap: 8px; }
        :global(.cmrTriggerPath dt) { font-size: 9px; text-transform: uppercase; letter-spacing: .05em; color: var(--ink-faint, #9A9A9A); }
        :global(.cmrTriggerPath dd) { margin: 0; font-size: 10px; line-height: 1.4; color: var(--ink-light); }
        .cmrEmpty { color: var(--ink-light); font-size: 12px; padding: 8px 12px; }
        .cmrShowMore { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-top: 1px solid var(--line); }
        .cmrNotice { margin: 0; font-size: 11px; color: var(--ink-light); }
      `}</style>
    </div>
  );
}
