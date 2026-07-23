// Canonical Query UI slice (2026-07-22): renders a CANONICAL_QUERY_RESULT_
// VIEW/V1 (lib/canonical-v2/query-result.js buildCanonicalQueryResultView)
// for the one supported ad hoc request (seller termination fee, % of deal
// value). Deliberately does NOT reshape into the legacy MARKET_RANGE result
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

const { mapCanonicalRowForRender } = require('../../lib/canonical-v2/legacy-query-mapper');

// This slice supports exactly one governed metric (see the spec) — the
// label is plain UI copy, not a taxonomy/vocabulary code, so it is safe to
// hardcode here rather than invent a governed label dictionary for a
// single-entry table.
const METRIC_LABELS = {
  SELLER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE: 'Seller termination fee — % of deal value',
};

function truncateDigest(value) {
  if (typeof value !== 'string' || !value) return '—';
  return value.length > 12 ? `${value.slice(0, 12)}…` : value;
}

// Renders one row's cells, isolated: mapCanonicalRowForRender already turns
// any per-row formatting failure into a `.error` marker rather than
// throwing, but this component wraps its own render pass too (belt-and-
// suspenders — the spec is explicit that a malformed row must never take
// sibling rows down with it).
function RowCells({ row, columnCount }) {
  try {
    if (row.error) throw new Error(row.error);
    return (
      <>
        {row.cells.map((cell) => (
          <td key={cell.column_key}>
            {Array.isArray(cell.display)
              ? (cell.display.length ? cell.display.join('; ') : '—')
              : cell.display}
          </td>
        ))}
      </>
    );
  } catch {
    return <td colSpan={columnCount} className="cmrRowError">This row could not be displayed.</td>;
  }
}

export default function CanonicalMarketRange({ view }) {
  if (!view) return null;
  const columns = view.columns || [];
  const rows = (view.rows || []).map((row) => mapCanonicalRowForRender(row, columns));
  const metricLabel = METRIC_LABELS[view.metric_key] || view.metric_key;

  return (
    <div className="cmr">
      <div className="cmrHeader">
        <h2>{metricLabel}</h2>
        <p className="cmrMeta">
          Payer capacity: <b>{(view.party && view.party.capacity) || '—'}</b>
          {' · '}
          {view.total_count} total{typeof view.page_count === 'number' ? `, showing ${view.page_count}` : ''}
        </p>
        <p className="cmrProvenance mtx-mono">
          Release {truncateDigest(view.corpus_release_id)} · Contract {truncateDigest(view.contract_fingerprint)}
        </p>
        {view.next_cursor && (
          <p className="cmrNotice">
            {`Showing first ${view.page_count} of ${view.total_count} — narrow the filters to see more.`}
          </p>
        )}
      </div>
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
            ) : rows.map((row, index) => (
              <tr key={row.row_serving_key || index}>
                <RowCells row={row} columnCount={columns.length} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <style jsx>{`
        .cmr { border: 1px solid var(--line); background: var(--paper); font-family: var(--mtx-sans); }
        .cmrHeader { padding: 14px 16px; border-bottom: 1px solid var(--line); }
        .cmrHeader h2 { margin: 0 0 6px; font-size: 14px; font-weight: 700; color: var(--ink); }
        .cmrMeta { margin: 0; font-size: 12px; color: var(--ink-light); }
        .cmrProvenance { margin: 4px 0 0; font-size: 10px; color: var(--ink-faint, #9A9A9A); }
        .cmrNotice { margin: 6px 0 0; font-size: 11px; color: var(--ink-light); }
        .scroll { overflow-x: auto; }
        .cmrRowError { color: #B14E63; font-size: 12px; padding: 8px 12px; }
        .cmrEmpty { color: var(--ink-light); font-size: 12px; padding: 8px 12px; }
      `}</style>
    </div>
  );
}
