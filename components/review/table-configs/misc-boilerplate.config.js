import React from 'react';
import {
  allFeatures,
  buildSectionSubjectResolver,
  cardCode,
  cardType,
  extractSectionCites,
  firstFeature,
  labelOf,
  makeRow,
  selectCards,
  splitForCell,
  textOf,
} from './card-utils.js';
import { buildExpenseExceptionsRow, isAdvisersFeesCard } from './advisers-fees-expenses.config.js';
import taxonomy from '../../../lib/taxonomy.js';
import { TERM_COL_WIDTH, TERM_COL_MAX } from './layout.js';

const { labelForCode, taxonomyForFeatureKey } = taxonomy;

// Ben (round 6): "Advisers / Fees / Expenses" is folded INTO this Misc table
// (it was one thin fee/expense-allocation row). The base rule ("Each party
// bears its own expenses, except:") moves to the TOP of the Provision cell,
// with the named exception sections stacked as pills beneath it.
function buildFeeExpenseRow(reviewDeal) {
  const allCards = reviewDeal?.cards || [];
  const feeCards = allCards.filter(isAdvisersFeesCard);
  const row = buildExpenseExceptionsRow(feeCards, allCards);
  if (!row) return null;
  return { ...row, id: 'misc-boilerplate-fee-expense', kind: 'Boilerplate', baseRule: row.detail, detail: null };
}

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
  // Assignment: the five raw-clause rows below are replaced by ONE summarized
  // "Assignment" row (buildAssignmentRow) -- Ben round 6. Kept commented for
  // provenance.
  // Assignment group: all five sit on the same MISC-ASSIGN boilerplate card
  // (Metsera parity gap root cause 4: "whole sub-section, no rows"). Kept as
  // five discrete rows -- each is a distinct fact the review team checks
  // independently -- clustered under the shared 'Assignment' kind.
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

// Ben (round 6): Forum -> "Delaware Court of Chancery; any DE state or federal
// court" instead of the long verbatim court list.
function forumLabel(detail, card) {
  const t = `${detail || ''} ${textOf(card) || ''}`.toLowerCase();
  if (/court of chancery[^.]*delaware|delaware[^.]*court of chancery/.test(t)) {
    return /state or federal court/.test(t) ? 'Delaware Court of Chancery; any DE state or federal court' : 'Delaware Court of Chancery';
  }
  return detail;
}
const ROW_CLEANERS = { forum: forumLabel };
// Canonical layer: governingLaw can carry an extraction-assigned
// GOVERNING_LAW code (tagged {code,label,text} object, or -- back-compat --
// a bare code string). labelForCode() validates against the dict before
// returning, so a raw prose/state-name value (which never matches a dict
// key like 'DELAWARE') safely returns null, leaving row.detail's existing
// valueText() rendering as the transition-safe fallback.
function governingLawCodeLabel(hit) {
  if (!hit) return null;
  const raw = hit.value;
  const code = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw.code || raw.value)
    : (typeof raw === 'string' ? raw : null);
  return code ? labelForCode(String(code), taxonomyForFeatureKey('governingLaw')) : null;
}
function mappedBoilerplateRows(cards, specs) {
  return specs
    .map(([id, label, kind, keys]) => {
      const hit = firstFeature(cards, keys || id);
      let row = makeRow('misc-boilerplate', id, label, kind, hit);
      if (!row) return null;
      const cleaner = ROW_CLEANERS[id];
      if (cleaner && row.detail) row = { ...row, detail: cleaner(row.detail, hit.card) };
      if (id === 'governing-law') {
        const canonical = governingLawCodeLabel(hit);
        if (canonical) row = { ...row, detail: canonical };
      }
      return { ...row, sourceCard: hit.card, signals: [miscBoilerplateSignal({ ...row, sourceCard: hit.card })].filter(Boolean) };
    })
    .filter(Boolean);
}
// Canonical layer: parentAssignmentConditions is a LIST feature whose items
// can carry an extraction-assigned ASSIGNMENT_PARENT_EXCEPTION code. When at
// least one item resolves to a canonical label, those labels replace the
// single hardcoded "Merger Sub may assign..." pill below with one pill per
// distinct exception. Returns null (no codes found anywhere) so
// buildAssignmentRow() keeps its exact pre-canonical single pill --
// transition-safe. Reads parentAssignmentConditions directly (via
// allFeatures, across every card) rather than through the parentRight
// alias-hit above, so a code on this key is never shadowed by a same-card
// parentAssignmentRight boolean claim.
function assignmentParentCodeLabels(cards) {
  const hits = allFeatures(cards, ['parentAssignmentConditions']);
  if (!hits.length) return null;
  const dict = taxonomyForFeatureKey('parentAssignmentConditions');
  const seen = new Set();
  const labels = [];
  for (const hit of hits) {
    const items = Array.isArray(hit.value) ? hit.value : [hit.value];
    for (const item of items) {
      const code = item && typeof item === 'object' && !Array.isArray(item) ? item.code : null;
      const label = code ? labelForCode(String(code), dict) : null;
      if (label && !seen.has(label)) { seen.add(label); labels.push(label); }
    }
  }
  return labels.length ? labels : null;
}
// Canonical layer: assignmentProvisos is a LIST feature (ASSIGNMENT_PROVISO
// codes: NO_RELEASE / NO_DELAY_IMPEDE). One pill per item, preferring the
// canonical code label when extraction assigned one; falling back to the
// item's own verbatim text when it didn't -- transition-safe, and unlike
// parentAssignmentConditions there is no prior hardcoded proviso pill to
// fall back to since this feature was previously unwired.
function assignmentProvisoSignals(cards, evidence, card) {
  const hits = allFeatures(cards, ['assignmentProvisos']);
  if (!hits.length) return [];
  const dict = taxonomyForFeatureKey('assignmentProvisos');
  const seen = new Set();
  const signals = [];
  for (const hit of hits) {
    const items = Array.isArray(hit.value) ? hit.value : [hit.value];
    for (const item of items) {
      const code = item && typeof item === 'object' && !Array.isArray(item) ? item.code : null;
      const text = item && typeof item === 'object' && !Array.isArray(item) ? item.text : item;
      const label = (code ? labelForCode(String(code), dict) : null) || (typeof text === 'string' ? text.trim() : null);
      if (!label || seen.has(label)) continue;
      seen.add(label);
      signals.push({ id: `misc-assign-proviso-${signals.length}`, label, value: 'assign-proviso', tone: 'neutral', evidence, source: card });
    }
  }
  return signals;
}
// Ben (round 6): collapse the five raw-clause Assignment rows into ONE
// "Assignment" row with two crisp pills.
function buildAssignmentRow(cards) {
  const parentRight = firstFeature(cards, ['parentAssignmentRight', 'parentAssignmentConditions']);
  const restriction = firstFeature(cards, ['assignmentRestrictions', 'companyConsentForAssignment']);
  const provisoHit = firstFeature(cards, ['assignmentProvisos']);
  if (!parentRight && !restriction && !provisoHit) return null;
  const card = parentRight?.card || restriction?.card || provisoHit?.card;
  const evidence = textOf(card);
  const signals = [];
  if (parentRight) {
    const canonicalLabels = assignmentParentCodeLabels(cards);
    if (canonicalLabels) {
      canonicalLabels.forEach((label, index) => {
        signals.push({ id: `misc-assign-parent-${index}`, label, value: 'parent-assign', tone: 'neutral', evidence, source: card });
      });
    } else {
      signals.push({ id: 'misc-assign-parent', label: 'Merger Sub may assign to Parent or a wholly-owned subsidiary', value: 'parent-assign', tone: 'neutral', evidence, source: card });
    }
  }
  if (restriction) signals.push({ id: 'misc-assign-restrict', label: "Otherwise, no assignment without the other party's prior written consent", value: 'no-assign', tone: 'neutral', evidence, source: card });
  signals.push(...assignmentProvisoSignals(cards, evidence, card));
  if (!signals.length) return null;
  return { id: 'misc-boilerplate-assignment', label: 'Assignment', kind: 'Boilerplate', detail: null, evidence, source: labelOf(card), sourceCard: card, present: true, signals };
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
      best = ref;
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

// TB1: don't show a bare section number -- name what the section IS. When a
// Section citation resolves to a subject (via buildSectionSubjectResolver,
// shared with AF1's expense-exceptions naming), pair them as "<subject>
// (§ref)"; otherwise fall back to the bare ref (never fabricated).
function formatProvision(ref, subject) {
  if (!ref) return null;
  return subject ? `${subject} (${ref})` : ref;
}

function factLabel(fact) {
  const person = fact.person ? shortenPerson(fact.person) : null;
  const provision = formatProvision(fact.provisionRef, fact.provisionSubject);
  if (person && provision) return `${person} — ${provision}`;
  if (person) return person;
  return provision || 'Carve-out';
}

// One exception phrase can name several beneficiaries (or none) and cite
// several sections (or none). Matches every beneficiary whose core phrase
// appears in the text, each paired with its nearest section reference; if no
// beneficiary matches but a section is cited, keep a provision-only fact
// (still a real carve-out, just not tied to a named party in this data).
// `resolveSection` (see buildSectionSubjectResolver) names each Section
// citation from ITS OWN card elsewhere in the deal -- e.g. "Section 6.05"
// becomes "D&O Indemnification and Insurance (§6.05)" -- Article citations
// are left unresolved (no reliable per-card article heading to match).
function factsForException(exceptionText, card, beneficiaries, keyPrefix, resolveSection) {
  const refs = extractSectionCites(exceptionText);
  const lowerText = exceptionText.toLowerCase();
  const facts = [];
  const matchedNames = [];
  const subjectFor = (ref) => {
    if (!ref || ref.kind !== 'Section' || !resolveSection) return null;
    const resolved = resolveSection(ref.number);
    return resolved ? resolved.subject : null;
  };
  beneficiaries.forEach((beneficiary, idx) => {
    const core = normalizeBeneficiaryCore(beneficiary.name);
    if (core.length <= 3) return;
    const pos = lowerText.indexOf(core);
    if (pos === -1) return;
    matchedNames.push(beneficiary.name);
    const ref = nearestProvisionRef(refs, pos);
    facts.push({
      id: `${keyPrefix}-${idx}`,
      person: beneficiary.name,
      provisionRef: ref ? ref.display : null,
      provisionSubject: subjectFor(ref),
      evidence: exceptionText,
      sourceCard: card,
    });
  });
  if (!facts.length && refs.length) {
    const ref = refs[0];
    facts.push({
      id: `${keyPrefix}-provision`,
      person: null,
      provisionRef: ref.display,
      provisionSubject: subjectFor(ref),
      evidence: exceptionText,
      sourceCard: card,
    });
  }
  return { facts, matchedNames };
}

function buildThirdPartyBeneficiaryRow(cards, allCards) {
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

  // Sections cited within a beneficiary exception (e.g. "Section 6.05") are
  // resolved against every card in the deal, not just this Misc-scoped set
  // -- D&O indemnification, CVR payment terms, etc. live on their own cards
  // elsewhere (see AF1's identical resolver in advisers-fees-expenses.config.js).
  const resolveSection = buildSectionSubjectResolver(allCards);
  const matchedNames = new Set();
  const facts = [];
  exceptions.forEach((exception, index) => {
    const result = factsForException(exception.text, exception.card, beneficiaries, `misc-boilerplate-third-party-${index}`, resolveSection);
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
      // G4: which party benefits under which named provision is a plain
      // fact, not a graded standard -- neutral, not colored, either way.
      tone: 'neutral',
      evidence: fact.evidence,
      source: fact.sourceCard,
    })),
  };
}

function renderSignals(row, ctx) {
  const PillCell = ctx?.primitives?.PillCell;
  if (!PillCell) return (row.signals || []).map((item) => item.label).join('\n');
  const pills = (row.signals || []).map((item) => React.createElement(PillCell, {
    key: item.id,
    label: item.label,
    value: item.value,
    tone: item.tone,
    evidence: item.evidence,
    source: item.source,
  }));
  // Fee/expense allocation: base rule on top of the cell, exception pills
  // stacked beneath (Ben round 6).
  if (row.baseRule) {
    return React.createElement(
      'div',
      { className: 'space-y-1' },
      React.createElement('div', { className: 'text-[11px] text-ink' }, row.baseRule),
      React.createElement('div', { className: 'flex flex-col items-start gap-1' }, pills),
    );
  }
  return pills;
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
    const thirdPartyRow = buildThirdPartyBeneficiaryRow(cards, reviewDeal?.cards || []);
    const feeRow = buildFeeExpenseRow(reviewDeal);
    const assignmentRow = buildAssignmentRow(cards);
    return [
      ...mappedBoilerplateRows(cards, ROWS_TOP),
      ...(thirdPartyRow ? [thirdPartyRow] : []),
      ...(feeRow ? [feeRow] : []),
      ...mappedBoilerplateRows(cards, ROWS_BOTTOM),
      ...(assignmentRow ? [assignmentRow] : []),
    ];
  },
  // Item 46: narrower Term/Signals columns than the 18rem default other
  // tables use, plus 'detail' relocated behind the "see text" expander (see
  // ProvisionTable.jsx's FULL_TEXT_COLUMNS) -- the un-truncated full-prose
  // detail column (governing-law/forum clause text, assignment restrictions,
  // the old third-party-beneficiaries raw dump) was what blew this table's
  // width out, not the pill columns themselves.
  fixedLayout: true,
  columns: [
    { id: 'term', header: 'Term', width: TERM_COL_WIDTH, maxWidth: TERM_COL_MAX, renderCell: (row) => row.label },
    { id: 'signals', header: 'Provision', renderCell: renderSignals },
    { id: 'detail', header: 'Detail', renderCell: renderDetail },
  ],
};

export { miscBoilerplateConfig, miscBoilerplateSignal, renderDetail, renderSignals };
