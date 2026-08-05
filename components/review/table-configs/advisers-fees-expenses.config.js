import React from 'react';
import {
  buildSectionSubjectResolver,
  cardCode,
  cardType,
  extractSectionCites,
  firstFeature,
  labelOf,
  makeRow,
  selectCards,
  stripProposedTitle,
  textOf,
} from './card-utils.js';
import { TERM_COL_WIDTH, TERM_COL_MAX } from './layout.js';

// REBUILD-SPECS.md section 13 ("complete garbage" per Ben), tightened again
// per FEEDBACK-2-PUNCHLIST.md item 45: this table is scoped to genuinely
// adviser/fee/expense-allocation content only -- Financial advisor and
// Fee/expense allocation. Specific performance and the Assignment group are
// generic Miscellaneous/boilerplate provisions (not adviser/fee content) and
// now live on misc-boilerplate.config.js's "Miscellaneous / Boilerplate"
// table alongside governing law, forum, and third-party beneficiaries.
//
// Expense exceptions render separately (see buildExpenseExceptionsRow below,
// AF1) -- not through this generic single-pill mapping.
const ROWS = [
  ['fee-expense', 'Fee / expense allocation', 'Expenses', ['feeExpenseAllocation', 'expensesAllocation']],
];

// The title/quote fallback below exists for ONE case: a genuine adviser/fee/
// expense card the classifier never subtyped, which carries neither the
// MISC_BOILERPLATE provision_type nor a MISC canonical code and would
// otherwise be invisible to this table. It is NOT a classifier. Run
// unguarded it also nets every card of every OTHER family that merely
// MENTIONS fees, expenses, or an adviser -- and that is extremely common: a
// D&O indemnification covenant routinely promises "advancement of expenses"
// (the real COV-DO cards in tests/fixtures/canonical-v2/dno-fixtures/
// corpus-cards.json -- 27 of them), a financing representation names the
// "financial advisor" and "fees" of the debt commitment letters (the real
// REP-B-FUNDS cards in tests/fixtures/canonical-v2/financing-covenants-
// fixtures/corpus-cards.json), a fairness-opinion rep names the company's
// financial advisor (REP-T-FAIRNESS/REP-B-FAIRNESS), and a no-brokers rep is
// entirely about "broker[s]" (REP-T-BROKERS/REP-B-BROKERS). Every one of
// these is REAL committed data pulled straight into this table by the
// unguarded fallback -- 62 cards across 15 foreign type/code combinations in
// the committed real-deal fixture universe (dno/employee-matters/financing-
// covenants/guaranty-fixtures plus the TopBuild/Skechers/Modiv V1 snapshots),
// more than triple the 18 cards this table legitimately owns there.
//
// So the fallback is narrowed, not removed: it applies only to a card NO
// family has claimed. A card already carrying another family's
// provision_type or canonical code belongs to that family, and a word match
// in its quote must never re-home it here.
const ADVISERS_FEES_TEXT_RE = /fees|expenses|adviser|advisor|broker/i;

// This table shares the MISC_BOILERPLATE provision_type / MISC canonical-code
// namespace with misc-boilerplate.config.js#isMiscBoilerplateCard (that table's
// buildFeeExpenseRow() folds THIS table's own fee/expense-allocation row into
// its Misc section using this very predicate). Distinguishing "fee/expense"
// from misc-boilerplate.config.js's other MISC-* concepts (governing law,
// assignment, jury waiver, ...) is a separate, pre-existing design choice --
// row-level feature lookups such as firstFeature(cards, ['feeExpenseAllocation',
// 'expensesAllocation']) do that narrowing already -- and is out of scope
// here; this guard only closes the text-fallback leak into `cards`.
const MISC_CARD_TYPES = new Set(['MISC_BOILERPLATE', 'MISC']);

function isClaimedByAnotherFamily(card) {
  const type = cardType(card);
  if (type && !MISC_CARD_TYPES.has(type)) return true;
  const code = cardCode(card);
  return Boolean(code) && !code.startsWith('MISC');
}

function isAdvisersFeesCard(card) {
  const type = cardType(card);
  const code = cardCode(card);
  if (type === 'MISC_BOILERPLATE' || code.startsWith('MISC')) return true;
  if (isClaimedByAnotherFamily(card)) return false;
  return ADVISERS_FEES_TEXT_RE.test(`${card?.short_title || ''} ${textOf(card)}`);
}

// Financial advisor is a SINGLE clean row per the spec, not three ("Adviser
// fees" / "Company adviser" / "Parent adviser"). Company/Parent advisor
// identity and the fee itself render as sub-fact pills under it (global
// design rule: sub-labelled facts, not separate rows, when a cell has >1
// fact for the same concept).
// DATA GAP: no ingestion schema key currently captures adviser identity
// (no companyFinancialAdvisor/parentFinancialAdvisor/adviserFees key exists
// in lib/schema/features.generated.js as of this WP) -- this row will not
// populate until that's added upstream. The nearest real signal today is the
// no-broker reps (REP-T-BROKERS / REP-B-BROKERS) and the fairness-opinion
// rep (REP-T-FAIRNESS, which names the advisor in prose, e.g. "Goldman
// Sachs"), but those live in Representations and are out of this WP's scope
// to reroute.
function buildFinancialAdvisorRow(cards) {
  const companyHit = firstFeature(cards, ['companyFinancialAdvisor', 'companyAdvisor']);
  const parentHit = firstFeature(cards, ['parentFinancialAdvisor', 'parentAdvisor']);
  const feesHit = firstFeature(cards, ['adviserFees', 'brokerFees', 'financialAdvisorFees']);
  if (!companyHit && !parentHit && !feesHit) return null;
  const primary = companyHit || parentHit || feesHit;
  const signals = [];
  if (companyHit) {
    signals.push({
      id: 'advisers-fees-expenses-financial-advisor-company',
      label: `Company: ${companyHit.detail}`,
      value: companyHit.detail,
      tone: 'neutral',
      evidence: textOf(companyHit.card),
      source: companyHit.card,
    });
  }
  if (parentHit) {
    signals.push({
      id: 'advisers-fees-expenses-financial-advisor-parent',
      label: `Parent: ${parentHit.detail}`,
      value: parentHit.detail,
      tone: 'neutral',
      evidence: textOf(parentHit.card),
      source: parentHit.card,
    });
  }
  if (feesHit) {
    signals.push({
      id: 'advisers-fees-expenses-financial-advisor-fees',
      label: `Fees: ${feesHit.detail}`,
      value: feesHit.detail,
      tone: 'info',
      evidence: textOf(feesHit.card),
      source: feesHit.card,
    });
  }
  return {
    id: 'advisers-fees-expenses-financial-advisor',
    label: 'Financial advisor',
    kind: 'Advisers',
    detail: primary.detail,
    evidence: textOf(primary.card),
    source: labelOf(primary.card),
    sourceCard: primary.card,
    present: true,
    signals,
  };
}

// Read-view pill is the resolved value alone -- the Term column already
// names the row, so a "<Kind>: " prefix only repeated it.
function miscSignal(row) {
  if (!row?.detail) return null;
  return {
    id: `${row.id}-signal`,
    label: row.detail,
    value: row.detail,
    tone: row.kind === 'Expenses' ? 'info' : 'neutral',
    evidence: row.evidence,
    source: row.sourceCard,
  };
}

// AF1: "Each party bears its own expenses, except [named sections]" --
// feeExpenseAllocationExceptions was rendering TRUNCATED (e.g. "Except as
// set forth in Section 6.02" only, dropping the rest of a four-section
// list), because the exceptions attribute itself is sometimes just the
// first excerpted phrase. The FULL exception list lives in the base
// feeExpenseAllocation clause's own lead-in ("Except as set forth in
// Section 6.02, Section 6.03(b), Section 6.05 and Section 8.02, ..."). Parse
// every Section citation out of THAT text, then name each one by resolving
// it against every other card in the deal (D&O indemnification, access to
// information, effect of termination, etc. are their own cards elsewhere in
// the deal, not on this Misc-scoped card) via buildSectionSubjectResolver.
function antitrustFilingFeeCard(allCards) {
  return (allCards || []).find((card) => {
    const text = textOf(card);
    return /\b(HSR|antitrust|foreign merger control)\b/i.test(text) && /filing fee/i.test(text);
  }) || null;
}

function buildExpenseExceptionsRow(cards, allCards) {
  const allocationHit = firstFeature(cards, ['feeExpenseAllocation', 'expensesAllocation']);
  const cites = allocationHit ? extractSectionCites(allocationHit.detail).filter((cite) => cite.kind === 'Section') : [];

  if (cites.length) {
    const resolveSection = buildSectionSubjectResolver(allCards);
    // Recurring extraction gap (same class as IOC's I7): a cited section
    // sometimes only survives as an unclassified "[PROPOSED]" fragment card
    // whose own section_ref/heading didn't get tagged with the true
    // document number. Antitrust/HSR filing-fee allocation is the one
    // consistently-recurring exception this affects -- when a citation
    // can't be resolved by heading or section_ref, and a card unambiguously
    // about antitrust/HSR filing fees exists, use it once (never invented,
    // never reused across multiple unresolved citations).
    let fallbackCard = antitrustFilingFeeCard(allCards);
    const seen = new Set();
    const facts = cites
      .filter((cite) => {
        if (seen.has(cite.number)) return false;
        seen.add(cite.number);
        return true;
      })
      .map((cite) => {
        let resolved = resolveSection(cite.number);
        if (!resolved && fallbackCard) {
          resolved = {
            subject: stripProposedTitle(labelOf(fallbackCard)),
            evidence: textOf(fallbackCard),
            source: labelOf(fallbackCard),
            sourceCard: fallbackCard,
          };
          fallbackCard = null;
        }
        return {
          id: `advisers-fees-expenses-expense-exceptions-${cite.number}`,
          label: resolved ? `${cite.display} — ${resolved.subject}` : cite.display,
          value: resolved ? resolved.subject : cite.display,
          // G4: named exception sections are plain facts, not a graded
          // standard (efforts ladder / materiality) -- neutral, not colored.
          tone: 'neutral',
          evidence: resolved ? resolved.evidence : allocationHit.detail,
          source: resolved ? resolved.sourceCard : allocationHit.card,
        };
      });
    return {
      id: 'advisers-fees-expenses-expense-exceptions',
      label: 'Fee / expense allocation',
      kind: 'Expenses',
      // Ben (round 4): the Detail column was re-joining the same section pills
      // ("§6.02 — ...; §6.03(b) — ...") that the Provision column already shows,
      // and a separate row dumped the whole raw clause. Detail now carries only
      // the clean base rule; the named sections live solely in the pills.
      detail: 'Each party bears its own expenses, except:',
      evidence: textOf(allocationHit.card),
      source: labelOf(allocationHit.card),
      sourceCard: allocationHit.card,
      present: true,
      signals: facts,
    };
  }

  // No citations to resolve (e.g. "Except as otherwise expressly provided
  // herein" with no Section list, or an older extraction that only ever
  // captured the standalone exceptions attribute) -- fall back to the
  // legacy single-pill rendering of whatever exceptions text exists.
  const hit = firstFeature(cards, ['feeExpenseAllocationExceptions', 'feeExpenseExceptions', 'expenseExceptions']);
  const row = makeRow('advisers-fees-expenses', 'expense-exceptions', 'Expense exceptions', 'Expenses', hit);
  if (!row) return null;
  return { ...row, sourceCard: hit.card, signals: [miscSignal({ ...row, sourceCard: hit.card })].filter(Boolean) };
}

function mappedMiscRows(cards) {
  return ROWS
    .map(([id, label, kind, keys]) => {
      const hit = firstFeature(cards, keys || id);
      const row = makeRow('advisers-fees-expenses', id, label, kind, hit);
      if (!row) return null;
      return { ...row, sourceCard: hit.card, signals: [miscSignal({ ...row, sourceCard: hit.card })].filter(Boolean) };
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

// r16 raw-dump sweep: 'advisers-fees-expenses' is NOT in ProvisionTable's
// FULL_TEXT_COLUMNS relocation list, so this detail cell really does render
// inline -- it was one of the two genuine inline-dump sites found by the
// corpus sweep (Marriott/Starwood's 536-char fee-allocation clause and four
// others rendered as unbounded prose). Long values now route through the
// shared TruncatedWithSeeText primitive (short values still render inline,
// hover-linked, exactly as before).
function renderDetail(row, ctx) {
  const TruncatedWithSeeText = ctx?.primitives?.TruncatedWithSeeText;
  if (TruncatedWithSeeText) {
    return React.createElement(TruncatedWithSeeText, { text: row.detail, evidence: row.evidence, source: row.sourceCard });
  }
  const EvidenceHoverSource = ctx?.primitives?.EvidenceHoverSource;
  if (!EvidenceHoverSource || !row.evidence) return row.detail;
  return React.createElement(EvidenceHoverSource, { evidence: row.evidence, source: row.sourceCard, as: 'span' }, row.detail);
}

const advisersFeesExpensesConfig = {
  id: 'advisers-fees-expenses',
  title: 'Advisers / Fees / Expenses',
  layoutSlot: 'misc',
  selectRows(reviewDeal) {
    const cards = selectCards(reviewDeal, isAdvisersFeesCard);
    // Section-name resolution (AF1) needs every card in the deal, not just
    // the Misc-scoped ones above -- the sections a fee/expense-allocation
    // clause excepts (D&O indemnification, access to information, effect of
    // termination, ...) live on other cards entirely.
    const allCards = reviewDeal?.cards || [];
    const advisorRow = buildFinancialAdvisorRow(cards);
    const exceptionsRow = buildExpenseExceptionsRow(cards, allCards);
    // Ben (round 4): mappedMiscRows dumped the raw feeExpenseAllocation clause
    // as its own row/pill, duplicating the clean allocation row below. The
    // exceptions row (base rule + named-section pills) is the single, clean
    // presentation; only fall back to the raw mapping when it's absent.
    const allocationRows = exceptionsRow ? [exceptionsRow] : mappedMiscRows(cards);
    return [...(advisorRow ? [advisorRow] : []), ...allocationRows];
  },
  fixedLayout: true,
  columns: [
    { id: 'term', header: 'Term', width: TERM_COL_WIDTH, maxWidth: TERM_COL_MAX, renderCell: (row) => row.label },
    { id: 'signals', header: 'Provision', renderCell: renderSignals },
    { id: 'detail', header: 'Detail', renderCell: renderDetail },
  ],
};

export { advisersFeesExpensesConfig, buildExpenseExceptionsRow, isAdvisersFeesCard, miscSignal, renderDetail, renderSignals };
