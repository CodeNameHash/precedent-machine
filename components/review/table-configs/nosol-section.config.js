import React from 'react';
import { nosolNoshopConfig, renderDetail as noshopRenderDetail, renderSignals as noshopRenderSignals } from './nosol-noshop.config.js';
import { nosolSuperiorConfig, renderSignals as superiorRenderSignals } from './nosol-superior.config.js';
import { nosolInterveningConfig, renderDetail as interveningRenderDetail, renderSignals as interveningRenderSignals } from './nosol-intervening.config.js';
import { nosolFiduciaryConfig, renderSignals as fiduciaryRenderSignals } from './nosol-fiduciary.config.js';

// Rebuilt per FEEDBACK-2-PUNCHLIST.md #41-#43. Old site: NO-SOLICITATION was
// ONE section on the page (old NosolFourTables mounted under a single NOSOL
// header, never as four top-level siblings) -- the current build regressed
// that into four separate top-level accordion sections (nosol-noshop /
// nosol-superior / nosol-intervening / nosol-fiduciary). This file restores
// the single-section structure by wrapping all four as SUB-GROUPS of one
// "No-Solicitation / No-Shop" accordion entry (#42), reordered to the old
// precedent reading order (#41): definition -> cease/prohibit ->
// fiduciary-out/engagement -> notice -> matching -> superior -> intervening
// -> change-of-rec.
//
// Each of the four *.config.js files is UNCHANGED -- same exported name,
// same selectRows contract, same row ids/order/detail synthesis, so their
// existing standalone tests (provision-table-configs.test.js,
// table-configs-orphans.test.js) keep passing unmodified. This file only
// reshapes how the SAME rows are grouped/ordered for display, reusing each
// config's own renderSignals/renderDetail so every pill/collapsed-text/
// standard-colour/evidence-hover behaviour is byte-for-byte what the
// standalone table already rendered.
//
// Several feature keys are claimed by more than one of the four configs
// (that's #43's duplication: the same fact showing up two or three times
// across the old four-sibling layout). Rather than mutate the source
// configs' selectRows (which would break their tests and their `title`/
// standalone-render usefulness if ever unmounted individually), dedup here:
// GROUP_DEFS below is an explicit allow-list of exactly one row id per
// concept, in its correct bucket. Every row id produced by all four
// selectRows() calls is accounted for below -- either included once, or
// deliberately excluded as a same-concept duplicate of an included row
// (see the "excluded as duplicate" comments per bucket).

function seeText(node) {
  if (!node) return null;
  return React.createElement(
    'details',
    { className: 'mt-1' },
    React.createElement('summary', { className: 'term-cell-seetext', style: { listStyle: 'none' } }, 'see text'),
    React.createElement(
      'div',
      { className: 'mt-1 max-w-[36rem] whitespace-pre-wrap break-words text-[11px] leading-5 text-inkLight' },
      node,
    ),
  );
}

// Mirrors ProvisionTable.jsx's FULL_TEXT_COLUMNS relocation: nosol-noshop and
// nosol-intervening have a third 'detail' column whose renderCell is meant to
// render behind a per-row "see text" toggle rather than inline (see that
// file's FULL_TEXT_COLUMNS map). nosol-superior / nosol-fiduciary have no
// such column -- their 'signals' column ("Provision") is the whole cell.
const SOURCES = {
  noshop: { config: nosolNoshopConfig, renderSignals: noshopRenderSignals, renderDetail: noshopRenderDetail },
  superior: { config: nosolSuperiorConfig, renderSignals: superiorRenderSignals, renderDetail: null },
  intervening: { config: nosolInterveningConfig, renderSignals: interveningRenderSignals, renderDetail: interveningRenderDetail },
  fiduciary: { config: nosolFiduciaryConfig, renderSignals: fiduciaryRenderSignals, renderDetail: null },
};

function rowNode(row, ctx, source) {
  const signal = source.renderSignals(row, ctx);
  const detail = source.renderDetail ? source.renderDetail(row, ctx) : null;
  // Guard against the (rare) case where the relocated detail is identical to
  // what's already inline in the pill -- still shown today in the standalone
  // tables via the same "see text" affordance, so kept for parity; only
  // skipped here if renderDetail returned nothing at all.
  if (!detail) return signal;
  return React.createElement(React.Fragment, null, signal, seeText(detail));
}

function byId(rows) {
  const map = new Map();
  for (const row of rows || []) {
    if (row && row.id) map.set(row.id, row);
  }
  return map;
}

// ── Precedent order (#41): definition -> cease/prohibit -> fiduciary-out/
// engagement -> notice -> matching -> superior -> intervening -> change-of-rec.
const GROUP_DEFS = [
  {
    id: 'nosol-definitions',
    label: 'Definitions',
    items: [
      { source: 'noshop', id: 'nosol-noshop-acquisition-definition' },
      // Acquisition-proposal threshold is the quantitative half of the
      // Acquisition Proposal definition (e.g. 20% of assets) -- no other
      // config claims acquisitionTransactionPctThreshold, so it belongs here.
      { source: 'noshop', id: 'nosol-noshop-acquisition-threshold' },
      { source: 'fiduciary', id: 'nosol-fiduciary-acceptable-confidentiality' },
    ],
    // Excluded as duplicates of the above: none (both rows here are unique
    // to noshop/fiduciary respectively).
  },
  {
    id: 'nosol-no-shop-core',
    label: 'No-Shop Core Mechanics',
    items: [
      { source: 'noshop', id: 'nosol-noshop-prohibit' },
      { source: 'noshop', id: 'nosol-noshop-cease' },
      { source: 'noshop', id: 'nosol-noshop-exceptions' },
      { source: 'noshop', id: 'nosol-noshop-standstill-enforce' },
    ],
    // Excluded as duplicates: nosol-noshop-matching-period (-> Matching Rights,
    // sourced from nosol-fiduciary-initial-match), nosol-noshop-notice-hours
    // (-> Notice), nosol-noshop-superior-threshold (-> Superior Proposal,
    // sourced from nosol-superior-threshold), nosol-noshop-fiduciary-standard
    // (-> Fiduciary-Out / Engagement, sourced from nosol-fiduciary-fiduciary-
    // standard), nosol-noshop-subsequent-match (-> Matching Rights, sourced
    // from nosol-fiduciary-subsequent-match), nosol-noshop-change-of-rec-count
    // (-> Change of Recommendation, sourced from the fuller
    // nosol-fiduciary-change-of-rec-items list).
  },
  {
    id: 'nosol-fiduciary-engagement',
    label: 'Fiduciary-Out / Engagement',
    items: [
      { source: 'fiduciary', id: 'nosol-fiduciary-engage' },
      { source: 'fiduciary', id: 'nosol-fiduciary-final' },
      { source: 'fiduciary', id: 'nosol-fiduciary-fiduciary-standard' },
    ],
    // Excluded as duplicates: nosol-superior-engage, nosol-superior-final
    // (same fiduciaryEngageStandard/fiduciaryFinalStandard keys as the
    // fiduciary rows above), nosol-noshop-fiduciary-standard and
    // nosol-superior-fiduciary-standard (same fiduciaryOutStandard key).
  },
  {
    id: 'nosol-notice',
    label: 'Notice',
    items: [
      { source: 'noshop', id: 'nosol-noshop-notice-hours' },
      { source: 'fiduciary', id: 'nosol-fiduciary-notice-period' },
      { source: 'fiduciary', id: 'nosol-fiduciary-notice-content' },
    ],
    // Excluded as duplicate: nosol-intervening-notice-period (same
    // noticePeriod key as nosol-fiduciary-notice-period).
  },
  {
    id: 'nosol-matching',
    label: 'Matching Rights',
    items: [
      { source: 'fiduciary', id: 'nosol-fiduciary-initial-match' },
      { source: 'fiduciary', id: 'nosol-fiduciary-subsequent-match' },
    ],
    // Excluded as duplicates: nosol-noshop-matching-period,
    // nosol-noshop-subsequent-match, nosol-intervening-matching-period (all
    // same matchingPeriod key as the fiduciary rows above).
  },
  {
    id: 'nosol-superior',
    label: 'Superior Proposal',
    items: [
      { source: 'superior', id: 'nosol-superior-threshold' },
      { source: 'superior', id: 'nosol-superior-test' },
      { source: 'superior', id: 'nosol-superior-determiner' },
    ],
    // Excluded as duplicates: nosol-noshop-superior-threshold,
    // nosol-fiduciary-superior-threshold (same superiorProposalThresholdPct
    // key); nosol-fiduciary-superior-test (same superiorProposalTest key).
  },
  {
    id: 'nosol-intervening',
    label: 'Intervening Event',
    items: [
      { source: 'intervening', id: 'nosol-intervening-provision' },
      { source: 'intervening', id: 'nosol-intervening-definition' },
      { source: 'intervening', id: 'nosol-intervening-scope' },
      { source: 'intervening', id: 'nosol-intervening-exceptions' },
      { source: 'intervening', id: 'nosol-intervening-termination' },
    ],
    // Kept as its own standalone block (Ben's explicit preference, see
    // REBUILD-SPECS.md §7): its own definition/scope stay together here
    // rather than being pulled into the top Definitions bucket.
  },
  {
    id: 'nosol-change-of-rec',
    label: 'Change of Recommendation',
    items: [
      { source: 'fiduciary', id: 'nosol-fiduciary-board-change' },
      { source: 'fiduciary', id: 'nosol-fiduciary-force-vote' },
      { source: 'fiduciary', id: 'nosol-fiduciary-termination' },
      { source: 'fiduciary', id: 'nosol-fiduciary-reps' },
      { source: 'fiduciary', id: 'nosol-fiduciary-buyer-termination' },
      { source: 'fiduciary', id: 'nosol-fiduciary-change-of-rec-items' },
      { source: 'fiduciary', id: 'nosol-fiduciary-not-change-of-rec-items' },
    ],
    // Excluded as duplicates: nosol-superior-board-change-standard,
    // nosol-intervening-board-change-standard, nosol-fiduciary-board-change-
    // standard (all same boardChangeStandard key as nosol-fiduciary-board-
    // change above); nosol-noshop-change-of-rec-count (same
    // changeOfRecommendationItems key as nosol-fiduciary-change-of-rec-items,
    // which keeps the full per-item list rather than just a count).
  },
];

function buildGroups(reviewDeal, ctx) {
  const rowsBySource = {};
  for (const key of Object.keys(SOURCES)) {
    rowsBySource[key] = byId(SOURCES[key].config.selectRows(reviewDeal));
  }
  return GROUP_DEFS.map((group) => {
    const rows = group.items
      .map((item) => {
        const row = rowsBySource[item.source]?.get(item.id);
        if (!row) return null;
        return {
          id: row.id,
          label: row.label,
          children: ctx ? rowNode(row, ctx, SOURCES[item.source]) : null,
        };
      })
      .filter(Boolean);
    return { id: group.id, label: group.label, rows };
  }).filter((group) => group.rows.length > 0);
}

const nosolSectionConfig = {
  id: 'nosol',
  title: 'No-Solicitation / No-Shop',
  layoutSlot: 'nosol',
  selectRows(reviewDeal) {
    // Row-shape independent of ctx so the hasRows check in
    // pages/review/[id].js (which calls selectRows without ctx) still works;
    // the grouped body is rebuilt with primitives at render time via the
    // 'body' column below (same pattern as conditions.config.js).
    const hasAny = Object.values(SOURCES).some((source) => (source.config.selectRows(reviewDeal) || []).length > 0);
    if (!hasAny) return [];
    return [{ id: 'nosol-section-body', reviewDeal }];
  },
  columns: [
    {
      id: 'body',
      header: '',
      renderCell(row, ctx) {
        const GroupedSubRows = ctx?.primitives?.GroupedSubRows;
        if (!GroupedSubRows) return null;
        const groups = buildGroups(row.reviewDeal, ctx);
        return React.createElement(GroupedSubRows, {
          groups,
          emptyCopy: 'No no-solicitation provisions found.',
        });
      },
    },
  ],
  empty: { copy: 'No no-solicitation provisions found.' },
};

export { buildGroups, nosolSectionConfig };
