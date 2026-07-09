import React from 'react';
import { conditionsBConfig, conditionsMConfig, conditionsSConfig } from './conditions-m.config.js';

// Consolidates the three party-scoped condition tables (Mutual / Buyer /
// Seller) into the ONE grouped table the legacy pre-schema page showed,
// instead of three separate accordion sections. Reuses conditionsMConfig /
// conditionsBConfig / conditionsSConfig's row-building UNCHANGED (signals,
// evidence, canonical-code pills all stay exactly as those configs already
// compute them) -- only the presentation shell changes: each party's rows
// become a labelled group inside one GroupedSubRows table instead of its own
// header + accordion.

const GROUP_SPECS = [
  { id: 'mutual', label: 'Mutual', config: conditionsMConfig },
  { id: 'buyer', label: 'Buyer / Parent', config: conditionsBConfig },
  { id: 'seller', label: 'Seller / Company', config: conditionsSConfig },
];

function renderRowBody(row, ctx) {
  const PillCell = ctx?.primitives?.PillCell;
  const TruncatedWithSeeText = ctx?.primitives?.TruncatedWithSeeText;
  const pills = PillCell
    ? (row.signals || []).map((item) => React.createElement(PillCell, {
      key: item.id,
      label: item.label,
      value: item.value,
      tone: item.tone,
      evidence: item.evidence,
      source: item.source,
    }))
    : null;
  const detail = TruncatedWithSeeText
    ? React.createElement(TruncatedWithSeeText, { text: row.detail, evidence: row.evidence, source: row.source })
    : row.detail;
  return React.createElement(
    'div',
    { className: 'space-y-1' },
    pills && pills.length ? React.createElement('div', { className: 'flex flex-wrap gap-1' }, pills) : null,
    React.createElement('div', { className: 'text-inkLight' }, detail),
  );
}

function groupRow(row, ctx) {
  return {
    id: row.id,
    label: row.label,
    value: row.detail,
    evidence: row.evidence,
    source: row.source,
    children: renderRowBody(row, ctx),
  };
}

function conditionGroups(reviewDeal, ctx) {
  return GROUP_SPECS
    .map((spec) => {
      const rows = spec.config.selectRows(reviewDeal) || [];
      return { id: spec.id, label: spec.label, rows: rows.map((row) => groupRow(row, ctx)) };
    })
    .filter((group) => group.rows.length > 0);
}

const conditionsConfig = {
  id: 'conditions',
  title: 'Closing Conditions',
  layoutSlot: 'conditions',
  selectRows(reviewDeal) {
    // Row-shape independent of ctx (primitives) so hasRows checks in
    // pages/review/[id].js (which call selectRows without ctx) still work;
    // the actual grouped body is rebuilt with primitives at render time via
    // the 'body' column below.
    const hasAny = GROUP_SPECS.some((spec) => (spec.config.selectRows(reviewDeal) || []).length > 0);
    if (!hasAny) return [];
    return [{ id: 'conditions-body', reviewDeal }];
  },
  columns: [
    {
      id: 'body',
      header: '',
      renderCell(row, ctx) {
        const GroupedSubRows = ctx?.primitives?.GroupedSubRows;
        if (!GroupedSubRows) return null;
        const groups = conditionGroups(row.reviewDeal, ctx);
        return React.createElement(GroupedSubRows, { groups, emptyCopy: 'No closing conditions found.' });
      },
    },
  ],
};

export { conditionGroups, conditionsConfig };
