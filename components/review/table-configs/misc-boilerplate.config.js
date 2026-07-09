import React from 'react';
import { cardCode, cardType, firstFeature, makeRow, selectCards, textOf } from './card-utils.js';

// REBUILD-SPECS.md section 13: forum / governing-law selection does not
// belong on Advisers / Fees / Expenses -- it's generic Misc/Boilerplate
// content (DESIGN-REFERENCE.md: "Misc/Boilerplate: governing law, forum
// (forum belongs in Misc, not Advisers)"). Third-party beneficiaries is the
// same class of generic boilerplate and moves alongside it. Assignment and
// Specific Performance stay on Advisers / Fees / Expenses per the new spec
// even though they lived here in the old site -- this table is deliberately
// scoped to just these three rows, not a full boilerplate catch-all.
const ROWS = [
  ['governing-law', 'Governing law', 'Boilerplate', ['governingLaw']],
  // forumCourts (the actual named court(s), verbatim list) is the real
  // ingestion-schema key (lib/parser-v2/extract.js: "NEVER return a bare
  // boolean" for forum) -- preferred over the legacy jurisdictionExclusive*
  // aliases, which stay as fallbacks for older extractions.
  ['forum', 'Forum / jurisdiction', 'Boilerplate', ['forumCourts', 'jurisdictionExclusive', 'jurisdictionExclusiveText', 'forumFallback']],
  ['third-party', 'Third-party beneficiaries', 'Boilerplate', ['thirdPartyBeneficiaryExceptions', 'thirdPartyBeneficiaries']],
];

function isMiscBoilerplateCard(card) {
  const type = cardType(card);
  const code = cardCode(card);
  return type === 'MISC_BOILERPLATE' || code.startsWith('MISC') || /governing law|jurisdiction|forum selection|third[- ]party benefic/i.test(`${card?.short_title || ''} ${textOf(card)}`);
}

// Read-view pill is the resolved value alone -- the Term column already
// names the row, so a "<Kind>: " prefix only repeated it.
function miscBoilerplateSignal(row) {
  if (!row?.detail) return null;
  return {
    id: `${row.id}-signal`,
    label: row.detail,
    value: row.detail,
    tone: 'neutral',
    evidence: row.evidence,
    source: row.sourceCard,
  };
}

function mappedBoilerplateRows(cards) {
  return ROWS
    .map(([id, label, kind, keys]) => {
      const hit = firstFeature(cards, keys || id);
      const row = makeRow('misc-boilerplate', id, label, kind, hit);
      if (!row) return null;
      return { ...row, sourceCard: hit.card, signals: [miscBoilerplateSignal({ ...row, sourceCard: hit.card })].filter(Boolean) };
    })
    .filter(Boolean);
}

function renderSignals(row, ctx) {
  const PillCell = ctx?.primitives?.PillCell;
  if (!PillCell) return (row.signals || []).map((item) => item.label).join('\n');
  return (row.signals || []).map((item) => React.createElement(PillCell, {
    key: item.id,
    label: item.label,
    value: item.value,
    tone: item.tone,
    evidence: item.evidence,
    source: item.source,
  }));
}

function renderDetail(row, ctx) {
  const EvidenceHoverSource = ctx?.primitives?.EvidenceHoverSource;
  if (!EvidenceHoverSource || !row.evidence) return row.detail;
  return React.createElement(EvidenceHoverSource, { evidence: row.evidence, source: row.sourceCard, as: 'span' }, row.detail);
}

const miscBoilerplateConfig = {
  id: 'misc-boilerplate',
  title: 'Miscellaneous / Boilerplate',
  layoutSlot: 'misc',
  selectRows(reviewDeal) {
    return mappedBoilerplateRows(selectCards(reviewDeal, isMiscBoilerplateCard));
  },
  columns: [
    { id: 'term', header: 'Term', width: '18rem', renderCell: (row) => row.label },
    { id: 'signals', header: 'Signals', width: '18rem', renderCell: renderSignals },
    { id: 'detail', header: 'Detail', renderCell: renderDetail },
  ],
};

export { miscBoilerplateConfig, miscBoilerplateSignal, renderDetail, renderSignals };
