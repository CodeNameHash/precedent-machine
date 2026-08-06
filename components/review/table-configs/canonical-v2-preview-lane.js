import React from 'react';

// Ben's ruling: replace four bespoke "append a dark row inline, suffix its
// own label" implementations (material-contracts.config.js's
// darkPreviewRows, general-covenants.config.js's darkPreviewFields,
// no-other-reps-fraud.config.js's darkPreviewRowFromCard, representations-
// qualifiers.config.js's darkPreviewRepRow) with ONE consistent Review
// preview lane, shared by all four areas: a single, labelled, read-only,
// default-collapsed section that sits BESIDE the legacy table rather than
// mixed into it.
//
// This module owns only the LANE itself -- the container, its exact label,
// the row/column-agnostic partition rule, and the hard read-only guarantee.
// Each config still owns building its own dark preview rows (unchanged --
// those four functions are exactly how each family already stamps the
// required invariants: authorityState VALIDATED_NOT_SERVED, comparisonState
// NOT_ADMITTED, marketSkip true, and the marketState below) and still owns
// which columns describe its own row shape. Sharing the lane container and
// the partition rule -- not four bespoke inline-append implementations -- is
// what makes this "one mechanism".
//
// selectRows() output is deliberately left untouched by this module: every
// dark-bridge test (tests/canonical-v2-legacy-card-bridge.test.js,
// tests/canonical-v2-general-covenants-dark-bridge.test.js, tests/canonical-
// v2-no-other-reps-fraud-dark-bridge.test.js, tests/canonical-v2-
// representations-dark-bridge.test.js) asserts against config.selectRows()'s
// exact returned array -- dark rows mixed in, each carrying the "(Canonical
// V2 preview)" label suffix and the invariant flags. That data contract is
// unchanged; only WHERE those already-flagged rows render changes, and only
// at render time (see components/review/ProvisionTable.jsx).

const CANONICAL_V2_PREVIEW_LANE_LABEL = 'Canonical V2 Preview';

// The single, shared value every dark-preview row builder stamps onto
// row.marketState. Exported so the four config files reference ONE constant
// instead of four independent string literals -- the actual value is
// unchanged (still 'DARK_REVIEW_ONLY', still what
// lib/market-metrics/section-rows.js's enumerateMarketSectionRows already
// keys off), so every existing pinned assertion on that literal string
// keeps passing.
const DARK_PREVIEW_MARKET_STATE = 'DARK_REVIEW_ONLY';

// The server-authoritative gate this module owns for all four config
// files: a review deal is only allowed to show its preview lane when the
// SERVER has stamped this exact boolean onto the reviewDeal payload it
// sent to the browser. This replaces each config's own
// isDarkBridgeIntegrationEnabled(process.env) read -- pages/review-v1/[id].js
// is a client component (no getServerSideProps, uses useState/useEffect),
// so CANONICAL_V2_DARK_BRIDGE (deliberately not a NEXT_PUBLIC_ variable --
// see lib/canonical-v2/dark-bridge-gate.js, kept that way on purpose so it
// can never be inlined into the client bundle or spoofed via devtools) was
// never visible to that browser-side process.env read in the first place,
// which meant the preview lane could never actually render for a real
// reviewer. This is NOT a client flag in the security sense: the server is
// also the only thing that ever puts a dark card into the payload, so
// flipping this boolean in devtools with no dark cards sent just yields an
// empty lane. It is a rendering hint, never an authorization check.
const CANONICAL_V2_PREVIEW_ENABLED_FIELD = 'canonical_v2_preview_enabled';

function isReviewDealPayload(candidate) {
  return candidate !== null && typeof candidate === 'object';
}

// Strict by construction: only an OWN property (never one reachable purely
// via the prototype chain -- a hostile or accidentally-shared prototype
// must not be able to switch every reviewDeal's preview on at once) holding
// the exact boolean `true` (never a truthy stand-in like the string
// "true", the number 1, or {}) enables the lane. Anything else -- missing,
// falsy, wrong type, non-object input -- fails closed to false.
function isCanonicalV2PreviewEnabled(reviewDeal) {
  if (!isReviewDealPayload(reviewDeal)) return false;
  if (!Object.prototype.hasOwnProperty.call(reviewDeal, CANONICAL_V2_PREVIEW_ENABLED_FIELD)) return false;
  return reviewDeal[CANONICAL_V2_PREVIEW_ENABLED_FIELD] === true;
}

// The single definition of "this row belongs in the preview lane, not the
// legacy table" -- keyed off the marketState stamp above. Verified against
// the whole components/ and lib/ tree: no config other than the four this
// task covers ever sets marketState to DARK_REVIEW_ONLY, so this partition
// can be applied uniformly by the shared renderer without risk of pulling
// an unrelated row out of some other family's legacy table.
function isCanonicalV2PreviewRow(row) {
  return Boolean(row) && row.marketState === DARK_PREVIEW_MARKET_STATE;
}

// Splits a config's already-built row array (config.selectRows(reviewDeal)'s
// exact, unmodified output) into the rows the legacy table keeps rendering
// unchanged, and the rows that move into the preview lane instead. Preserves
// each half's original relative order; never mutates a row.
function partitionCanonicalV2PreviewRows(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const legacyRows = [];
  const previewRows = [];
  for (const row of list) {
    (isCanonicalV2PreviewRow(row) ? previewRows : legacyRows).push(row);
  }
  return { legacyRows, previewRows };
}

// A hard allowlist, not a blacklist: the lane's row-rendering context is
// built from scratch, carrying over ONLY what a read-only renderCell needs
// (reviewDeal / config / primitives) and forcing isEdit false. Every
// mutation-adjacent field a real rendering ctx can carry -- onSelectCard,
// onSelectCanonicalBinding, canonicalBindingForRow, selectedCardId,
// selectedCanonicalBindingKey, the SeeProvisionToggle/ExpansionRow/
// PortionExcludedNote/expandedRowId/setExpandedRowId wiring renderBody
// configs use -- is left off BY CONSTRUCTION, regardless of what the caller
// passes in. Every renderCell in these four configs already null-checks
// ctx?.primitives?.X / ctx?.onSelectCard / ctx?.SeeProvisionToggle before
// using them, so each one degrades to its own read-only fallback instead of
// throwing.
function readOnlyLaneContext(ctx) {
  return {
    reviewDeal: ctx && ctx.reviewDeal,
    config: ctx && ctx.config,
    primitives: ctx && ctx.primitives,
    isEdit: false,
  };
}

// One row's read-only content, built ONLY from the SAME column.renderCell
// functions the legacy table already uses for this config -- guarantees the
// lane shows the identical values/pills/evidence-hover a live row would,
// never a second bespoke rendering per family.
function renderLaneRowCells(row, columns, laneCtx) {
  return (Array.isArray(columns) ? columns : [])
    .map((column) => {
      const node = typeof column.renderCell === 'function' ? column.renderCell(row, laneCtx) : null;
      if (node === null || node === undefined || node === '') return null;
      return React.createElement(
        'div',
        { key: column.id, className: 'min-w-0' },
        column.header ? React.createElement(
          'div',
          { className: 'text-[9px] font-medium uppercase tracking-wide text-inkFaint' },
          column.header,
        ) : null,
        React.createElement('div', { className: 'text-[11px] text-ink' }, node),
      );
    })
    .filter(Boolean);
}

function laneRowKey(row, index) {
  return (row && (row.id || row.label)) || `preview-row-${index}`;
}

// The lane itself: a native <details> element, headed by a <summary> whose
// visible text is EXACTLY CANONICAL_V2_PREVIEW_LANE_LABEL (a row count
// renders alongside it in a separately-marked span, so a caller can assert
// on the label text alone). <details>/<summary> is collapsed by default --
// `open` is explicitly false here and never set true by this module, so
// expanding it is entirely the reader's own doing, a read gesture with no
// application state or event handler behind it. No row inside ever receives
// a click/select/edit handler (see readOnlyLaneContext above): there is no
// mutation affordance anywhere in the lane, only the disclosure toggle
// itself.
function buildCanonicalV2PreviewLane(previewRows, columns, ctx, options = {}) {
  const rows = Array.isArray(previewRows) ? previewRows : [];
  if (!rows.length) return null;
  const testId = options.testId || 'canonical-v2-preview-lane';
  const laneCtx = readOnlyLaneContext(ctx);
  return React.createElement(
    'details',
    {
      className: 'mtx-canonical-v2-preview-lane border-t border-dashed border-border bg-bg/30',
      'data-testid': testId,
      open: false,
    },
    React.createElement(
      'summary',
      {
        className: 'cursor-pointer select-none px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-inkFaint',
        'data-testid': `${testId}-summary`,
      },
      React.createElement('span', { 'data-testid': `${testId}-label` }, CANONICAL_V2_PREVIEW_LANE_LABEL),
      React.createElement(
        'span',
        {
          className: 'ml-1.5 font-normal normal-case tracking-normal text-inkFaint',
          'data-testid': `${testId}-count`,
          'aria-hidden': 'true',
        },
        ` (${rows.length})`,
      ),
    ),
    React.createElement(
      'div',
      { className: 'px-3 pb-3 space-y-2', 'data-testid': `${testId}-rows` },
      rows.map((row, index) => React.createElement(
        'div',
        {
          key: laneRowKey(row, index),
          className: 'rounded border border-dashed border-border/70 bg-white/60 px-2.5 py-2 space-y-1',
          'data-testid': `${testId}-row`,
        },
        renderLaneRowCells(row, columns, laneCtx),
      )),
    ),
  );
}

export {
  CANONICAL_V2_PREVIEW_ENABLED_FIELD,
  CANONICAL_V2_PREVIEW_LANE_LABEL,
  DARK_PREVIEW_MARKET_STATE,
  buildCanonicalV2PreviewLane,
  isCanonicalV2PreviewEnabled,
  isCanonicalV2PreviewRow,
  partitionCanonicalV2PreviewRows,
};
