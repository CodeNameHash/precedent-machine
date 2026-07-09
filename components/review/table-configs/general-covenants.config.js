import React from 'react';
import { cardCode, cardFeatures, cardType, firstFeature, selectCards, textOf } from './card-utils.js';

// REBUILD-SPECS.md section 6: interim-operating-covenant content (ordinary
// course, negative-covenant restrictions, affirmative limbs) is owned
// entirely by ioc-exceptions.config.js's grouped covenant table. The 5
// curated ROWS below are the genuine COVENANT_OTHER concepts that live in
// THIS section (§6.01-6.11-style general covenants, not the §5.01 IOC list).
const ROWS = [
  ['efforts', 'General efforts standard', ['effortsStandard', 'reasonableBestEfforts']],
  ['access', 'Access / information rights', ['accessRights', 'informationAccess']],
  ['public-statements', 'Public statements', ['publicStatements', 'publicStatementExceptions']],
  ['insurance', 'D&O / insurance covenant', ['insuranceCap', 'insurancePeriod', 'doInsurance']],
  ['financing', 'Financing cooperation', ['financingCooperation']],
];

// FEEDBACK-2-PUNCHLIST.md #13/#31/#32: stockholders-meeting mechanics
// (COV-MEETING / COV-PROXY -- already owned by sec-meeting.config.js) and
// Parent's adoption of the merger agreement (COV-SHAPRV-PARENT, now
// rendered on votes-approvals-meeting.config.js as its own "Parent / Merger
// Sub approvals" row) belong in Votes / Approvals / SEC / Meeting, not here.
// Excluded up front so neither ever falls through to the per-clause
// fallback below and double-renders on both pages.
const VOTES_OWNED_CODES = new Set(['COV-MEETING', 'COV-PROXY', 'COV-SHAPRV-PARENT']);

// Deliberately excludes COVENANT_INTERIM_OPERATING / IOC-prefixed cards
// (ioc-exceptions.config.js owns those) and drops the old free-text regex
// fallback -- that fallback was matching the MISC_BOILERPLATE §9.01 "No
// Survival / Nonsurvival" card (its repsSurvivalExceptions clause contains
// the word "covenant") into this table as a bogus "No survival" row.
function isGeneralCovenant(card) {
  const type = cardType(card);
  const code = cardCode(card);
  if (type === 'COVENANT_INTERIM_OPERATING' || code.startsWith('IOC')) return false;
  if (VOTES_OWNED_CODES.has(code)) return false;
  return type === 'COVENANT_OTHER' || code.startsWith('COV');
}

function clauseLabel(card) {
  return card?.short_title || card?.defined_term || cardCode(card) || 'Covenant';
}

// FEEDBACK-2-PUNCHLIST.md #30/#33 (Ben: "I don't know why you've got this
// signals one here, it's weird"): General Covenants is a grab-bag of
// unrelated clause types (efforts standard, access rights, public
// statements, D&O insurance, financing cooperation, plus whatever other
// one-off COV cards a deal has) with no shared structured shape to
// summarize into a signals-pill grid -- the old grid was pulling
// efforts/consent/knowledge/deadline meta that frequently didn't apply to
// the row it sat next to. This is now "Other Covenants": every row is a
// LINK to its own provision (same pattern as consideration-hero.config.js's
// "Other provisions in this section" row) instead of a content summary --
// the table names the provision and carries its full evidence on hover;
// reading the clause happens through that, not a pill paraphrase.
// `evidenceOverride` covers curated rows whose card has no primary_quote /
// region_full_text of its own (textOf(card) empty) -- falls back to the
// matched feature's own resolved text (firstFeature's `.detail`) so the
// link's hover never comes up empty when the card-level quote is missing.
function linkRow(idSuffix, label, card, evidenceOverride) {
  if (!card) return null;
  return {
    id: `general-covenants-${idSuffix}`,
    label,
    kind: 'Link',
    detail: label,
    isLink: true,
    evidence: textOf(card) || evidenceOverride || '',
    sourceCard: card,
    present: true,
  };
}

// The 5 curated concepts above render as friendly-labelled links first, so
// a genuinely mapped clause (e.g. the efforts-standard covenant) shows a
// readable term instead of falling through to its raw clause title.
function curatedRows(cards) {
  const rows = [];
  const covered = new Set();
  for (const [id, label, keys] of ROWS) {
    const hit = firstFeature(cards, keys);
    if (!hit) continue;
    const row = linkRow(id, label, hit.card, hit.detail);
    if (!row) continue;
    rows.push(row);
    covered.add(hit.card);
  }
  return { rows, covered };
}

// Every OTHER genuine COVENANT_OTHER card not already covered by a curated
// row above gets its own link, keyed off the clause's own short title --
// never a duplicate of a card already surfaced via curatedRows().
function perClauseRows(cards, covered) {
  return cards
    .filter((card) => !covered.has(card))
    .map((card) => linkRow(`clause-${card.id}`, clauseLabel(card), card))
    .filter(Boolean);
}

function renderLink(row, ctx) {
  const EvidenceHoverSource = ctx?.primitives?.EvidenceHoverSource;
  const linkNode = React.createElement(
    'a',
    {
      href: '#',
      onClick: (event) => event.preventDefault(),
      className: 'inline-flex items-center gap-1 text-[11px] font-medium text-sky-700 underline decoration-sky-300 underline-offset-2 hover:text-sky-800',
    },
    row.detail,
    React.createElement('span', { 'aria-hidden': 'true' }, '→'),
  );
  if (!EvidenceHoverSource) return linkNode;
  return React.createElement(EvidenceHoverSource, { evidence: row.evidence, source: row.sourceCard, as: 'span' }, linkNode);
}

// FEEDBACK-2-PUNCHLIST.md #33: this section now sits at the VERY END of the
// page (see REVIEW_TABLE_CONFIGS order in pages/review/[id].js) -- it is
// deliberately the last thing a reviewer sees, a plain link index into
// whatever general-covenant clauses didn't already get a home elsewhere.
const generalCovenantsConfig = {
  id: 'general-covenants',
  title: 'Other Covenants',
  layoutSlot: 'covenants',
  selectRows(reviewDeal) {
    const cards = selectCards(reviewDeal, isGeneralCovenant);
    const { rows: curated, covered } = curatedRows(cards);
    return [...curated, ...perClauseRows(cards, covered)];
  },
  columns: [
    { id: 'term', header: 'Provision', width: '20rem', renderCell: (row) => row.label },
    { id: 'detail', header: 'Link', renderCell: renderLink },
  ],
};

export { generalCovenantsConfig, linkRow, perClauseRows, renderLink };
