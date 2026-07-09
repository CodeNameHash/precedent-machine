import React from 'react';
import { allFeatures, cardCode, cardType, firstFeature, labelOf, makeRow, selectCards, splitForCell, textOf } from './card-utils.js';

// REBUILD-SPECS.md section 13: forum / governing-law selection does not
// belong on Advisers / Fees / Expenses -- it's generic Misc/Boilerplate
// content (DESIGN-REFERENCE.md: "Misc/Boilerplate: governing law, forum
// (forum belongs in Misc, not Advisers)"). Third-party beneficiaries is the
// same class of generic boilerplate and moves alongside it.
//
// FEEDBACK-2-PUNCHLIST.md item 45: Specific Performance and the Assignment
// group were moved BACK here from Advisers / Fees / Expenses -- they're
// generic Misc/boilerplate provisions, not adviser/fee/expense content
// (a prior WP had kept them on Advisers per an earlier reading of the spec;
// Ben's review corrected that).
const ROWS_TOP = [
  ['governing-law', 'Governing law', 'Boilerplate', ['governingLaw']],
  // forumCourts (the actual named court(s), verbatim list) is the real
  // ingestion-schema key (lib/parser-v2/extract.js: "NEVER return a bare
  // boolean" for forum) -- preferred over the legacy jurisdictionExclusive*
  // aliases, which stay as fallbacks for older extractions.
  ['forum', 'Forum / jurisdiction', 'Boilerplate', ['forumCourts', 'jurisdictionExclusive', 'jurisdictionExclusiveText', 'forumFallback']],
];

// Third-party beneficiaries renders separately (see buildThirdPartyBeneficiaryRow
// below), not through this generic single-pill mapping -- item 47.

const ROWS_BOTTOM = [
  ['specific-performance', 'Specific performance', 'Remedies', ['specificPerformance']],
  ['specific-performance-limitations', 'Specific performance limitations', 'Remedies', ['specificPerformanceLimitations']],
  // Assignment group: all five sit on the same MISC-ASSIGN boilerplate card
  // (Metsera parity gap root cause 4: "whole sub-section, no rows"). Kept as
  // five discrete rows -- each is a distinct fact the review team checks
  // independently -- clustered under the shared 'Assignment' kind.
  ['assignment-parent-right', 'Parent assignment right', 'Assignment', ['parentAssignmentRight']],
  ['assignment-parent-conditions', 'Parent assignment conditions', 'Assignment', ['parentAssignmentConditions']],
  ['assignment-company-consent', 'Company consent for assignment', 'Assignment', ['companyConsentForAssignment']],
  ['assignment-exceptions', 'Assignment exceptions', 'Assignment', ['assignmentExceptions']],
  ['assignment-restrictions', 'Assignment restrictions', 'Assignment', ['assignmentRestrictions']],
];

function isMiscBoilerplateCard(card) {
  const type = cardType(card);
  const code = cardCode(card);
  return type === 'MISC_BOILERPLATE' || code.startsWith('MISC') || /governing law|jurisdiction|forum selection|third[- ]party benefic|specific performance|assignment/i.test(`${card?.short_title || ''} ${textOf(card)}`);
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

function mappedBoilerplateRows(cards, specs) {
  return specs
    .map(([id, label, kind, keys]) => {
      const hit = firstFeature(cards, keys || id);
      const row = makeRow('misc-boilerplate', id, label, kind, hit);
      if (!row) return null;
      return { ...row, sourceCard: hit.card, signals: [miscBoilerplateSignal({ ...row, sourceCard: hit.card })].filter(Boolean) };
    })
    .filter(Boolean);
}

// --- Third-party beneficiaries: person(s) + the provision they benefit
// under (item 47) -----------------------------------------------------
//
// thirdPartyBeneficiaries is a flat list of NAMED parties (e.g. "the D&O
// Indemnified Parties"); thirdPartyBeneficiaryExceptions is a list of the
// verbatim carve-out phrases to the "no third-party beneficiaries" rule
// (e.g. "Section 5.7 (which ... shall be for the sole benefit of the
// Indemnified Persons)"). Real deal data shows these two lists usually name
// the SAME parties -- each exception phrase typically both cites the
// section AND re-states which beneficiary it's for. Pairing them (instead of
// dumping both arrays as prose) is what turns this into "which people, for
// which provision" per Ben's punchlist -- no new extraction, just better use
// of data that's already there.
const SECTION_REF_RE = /\b(Section|Article)s?\s+([0-9]+(?:\.[0-9]+)*(?:\([a-zA-Z0-9]+\))*|[IVXLCivxlc]+)\b/gi;

function allProvisionRefs(text) {
  const refs = [];
  let match;
  SECTION_REF_RE.lastIndex = 0;
  while ((match = SECTION_REF_RE.exec(text))) {
    const kind = /article/i.test(match[1]) ? 'Article' : 'Section';
    refs.push({ text: `${kind} ${match[2]}`, index: match.index });
  }
  return refs;
}

// Nearest-by-distance, not "first in the string" -- when an exception phrase
// cites more than one beneficiary and more than one section (e.g. "the
// holders of X ... under Section 2.1 ... and the holders of Y ... under
// Section 4.3"), this keeps each person paired with the section actually
// closest to their own mention rather than always grabbing the first ref.
function nearestProvisionRef(refs, position) {
  if (!refs.length) return null;
  let best = null;
  let bestDist = Infinity;
  for (const ref of refs) {
    const dist = Math.abs(ref.index - position);
    if (dist < bestDist) {
      bestDist = dist;
      best = ref.text;
    }
  }
  return best;
}

// Reduces a beneficiary name to the "core" noun phrase that's likely to be
// re-used verbatim inside an exception's carve-out prose -- drops a trailing
// parenthetical aside (extraction sometimes appends one, e.g. "the holders
// of Shares (rights to receive the Offer Price...)") and a leading
// quantifier/article that carve-out phrasing often varies ("each of the
// Company Parties" vs "... by each of the Company Parties").
function normalizeBeneficiaryCore(name) {
  if (!name) return '';
  return String(name)
    .replace(/\s*\([^)]*\)\s*$/, '')
    .trim()
    .toLowerCase()
    .replace(/^(each of the|each of|all of the|all|each|the)\s+/, '')
    .trim();
}

function shortLabel(text, max = 60) {
  if (!text) return text;
  const { short, truncated } = splitForCell(String(text), max);
  return truncated ? `${short}…` : short;
}

function shortenPerson(name) {
  return shortLabel(String(name || '').replace(/\s*\([^)]*\)\s*$/, '').trim());
}

function factLabel(fact) {
  const person = fact.person ? shortenPerson(fact.person) : null;
  if (person && fact.provisionRef) return `${person} — ${fact.provisionRef}`;
  if (person) return person;
  return fact.provisionRef || 'Carve-out';
}

// One exception phrase can name several beneficiaries (or none) and cite
// several sections (or none). Matches every beneficiary whose core phrase
// appears in the text, each paired with its nearest section reference; if no
// beneficiary matches but a section is cited, keep a provision-only fact
// (still a real carve-out, just not tied to a named party in this data).
function factsForException(exceptionText, card, beneficiaries, keyPrefix) {
  const refs = allProvisionRefs(exceptionText);
  const lowerText = exceptionText.toLowerCase();
  const facts = [];
  const matchedNames = [];
  beneficiaries.forEach((beneficiary, idx) => {
    const core = normalizeBeneficiaryCore(beneficiary.name);
    if (core.length <= 3) return;
    const pos = lowerText.indexOf(core);
    if (pos === -1) return;
    matchedNames.push(beneficiary.name);
    facts.push({
      id: `${keyPrefix}-${idx}`,
      person: beneficiary.name,
      provisionRef: nearestProvisionRef(refs, pos),
      evidence: exceptionText,
      sourceCard: card,
    });
  });
  if (!facts.length && refs.length) {
    facts.push({
      id: `${keyPrefix}-provision`,
      person: null,
      provisionRef: refs[0].text,
      evidence: exceptionText,
      sourceCard: card,
    });
  }
  return { facts, matchedNames };
}

function buildThirdPartyBeneficiaryRow(cards) {
  const beneficiaries = [];
  const seenNames = new Set();
  allFeatures(cards, ['thirdPartyBeneficiaries']).forEach((hit) => {
    const list = Array.isArray(hit.value) ? hit.value : [hit.value];
    list.forEach((raw) => {
      const name = raw ? String(raw).trim() : '';
      if (!name || seenNames.has(name)) return;
      seenNames.add(name);
      beneficiaries.push({ name, card: hit.card });
    });
  });

  const exceptions = [];
  allFeatures(cards, ['thirdPartyBeneficiaryExceptions']).forEach((hit) => {
    const list = Array.isArray(hit.value) ? hit.value : [hit.value];
    list.forEach((raw) => {
      const text = raw ? String(raw).trim() : '';
      if (text) exceptions.push({ text, card: hit.card });
    });
  });

  if (!beneficiaries.length && !exceptions.length) return null;

  const matchedNames = new Set();
  const facts = [];
  exceptions.forEach((exception, index) => {
    const result = factsForException(exception.text, exception.card, beneficiaries, `misc-boilerplate-third-party-${index}`);
    result.facts.forEach((fact) => facts.push(fact));
    result.matchedNames.forEach((name) => matchedNames.add(name));
  });
  // Named beneficiaries no exception phrase could be tied to (e.g. named on
  // a different card than the one carrying the exceptions) still render --
  // as a person-only pill, since inventing a section ref for them would be
  // fabrication.
  beneficiaries.forEach((beneficiary, index) => {
    if (matchedNames.has(beneficiary.name)) return;
    facts.push({
      id: `misc-boilerplate-third-party-unmatched-${index}`,
      person: beneficiary.name,
      provisionRef: null,
      evidence: textOf(beneficiary.card),
      sourceCard: beneficiary.card,
    });
  });

  if (!facts.length) return null;

  const primaryCard = (exceptions[0] && exceptions[0].card) || (beneficiaries[0] && beneficiaries[0].card);
  return {
    id: 'misc-boilerplate-third-party',
    label: 'Third-party beneficiaries',
    kind: 'Boilerplate',
    detail: facts.map(factLabel).join('; '),
    evidence: textOf(primaryCard),
    source: labelOf(primaryCard),
    sourceCard: primaryCard,
    present: true,
    signals: facts.map((fact) => ({
      id: fact.id,
      label: factLabel(fact),
      value: fact.provisionRef || fact.person,
      tone: fact.person ? 'neutral' : 'info',
      evidence: fact.evidence,
      source: fact.sourceCard,
    })),
  };
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
    const cards = selectCards(reviewDeal, isMiscBoilerplateCard);
    const thirdPartyRow = buildThirdPartyBeneficiaryRow(cards);
    return [
      ...mappedBoilerplateRows(cards, ROWS_TOP),
      ...(thirdPartyRow ? [thirdPartyRow] : []),
      ...mappedBoilerplateRows(cards, ROWS_BOTTOM),
    ];
  },
  // Item 46: narrower Term/Signals columns than the 18rem default other
  // tables use, plus 'detail' relocated behind the "see text" expander (see
  // ProvisionTable.jsx's FULL_TEXT_COLUMNS) -- the un-truncated full-prose
  // detail column (governing-law/forum clause text, assignment restrictions,
  // the old third-party-beneficiaries raw dump) was what blew this table's
  // width out, not the pill columns themselves.
  columns: [
    { id: 'term', header: 'Term', width: '15rem', renderCell: (row) => row.label },
    { id: 'signals', header: 'Signals', width: '16rem', renderCell: renderSignals },
    { id: 'detail', header: 'Detail', renderCell: renderDetail },
  ],
};

export { miscBoilerplateConfig, miscBoilerplateSignal, renderDetail, renderSignals };
