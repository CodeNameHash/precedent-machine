import React from 'react';
import { buildTerminationFees, normalizeTermfFeatures } from '../../../lib/termf.js';
import { cardCode, cardFeatures, cardType, firstFeature, makeRow, selectCards, textOf } from './card-utils.js';
import taxonomy from '../../../lib/taxonomy.js';

const { labelForCode, taxonomyForFeatureKey } = taxonomy;

// Scalar rows read straight off a flat claim attribute that already matches
// its legacy/UI name 1:1 — no nested-shape bridging needed (that bridging
// lives in lib/termf.js's routeRawTerminationFees, used by feeTableRows()
// below for the amount/trigger/tail rows). REBUILD-SPECS.md §11's clean-row
// list is Company Termination Fee / Willful-breach exception / Interest on
// late payment / Sole remedy; "Fee required to terminate" and "Naked no-vote
// fee" are kept alongside them (real per-deal Yes/No facts, not prose) but
// the boilerplate "Effect of Termination" sentence (void-on-termination
// survival language) is dropped — it isn't a decision-relevant signal and
// its one substantive fact (willfulBreachException) already has its own row.
// Punchlist #36: "Interest on late payment" moved to the LAST position --
// it's a remedy-mechanics footnote, not a headline fact, and reads better
// after the fee/condition rows above it. Since selectRows() below appends
// scalarRows() after feeTableRows(), this ordering also puts it at the very
// bottom of the whole table, not just the scalar-row group.
const SCALAR_ROWS = [
  ['required', 'Fee required to terminate', 'Condition', ['feeRequired', 'terminationFeeRequired']],
  ['naked-no-vote', 'Naked no-vote fee', 'Condition', ['nakedNoVoteFeePresent', 'nakedNoVoteFee']],
  ['sole-remedy', 'Sole and exclusive remedy', 'Remedy', ['soleRemedy', 'soleAndExclusiveRemedy']],
  ['willful-breach', 'Willful-breach exception', 'Remedy', ['willfulBreachException']],
  ['interest', 'Interest on late payment', 'Remedy', ['interestOnLatePayment']],
];

const FEE_TYPE_LABELS = {
  COMPANY_TERMINATION_FEE: 'Company termination fee',
  REVERSE_TERMINATION_FEE: 'Reverse termination fee',
  NAKED_NO_VOTE_FEE: 'Naked no-vote fee',
};

// Tail-fee mechanics have their own tidied table directly after this one
// (tail-fee.config.js, spec §11) — buildTerminationFees() still synthesizes
// a TAIL_FEE row from the same TERMF-TAIL card this table also reads, so it
// is dropped here to avoid showing the same mechanics twice.
//
// Punchlist #37: EXPENSE_REIMBURSEMENT is also dropped. "Expense
// reimbursement" as a term reads like a naked-no-vote expense-reimbursement
// fee (a distinct, real deal term already covered by its own row above) --
// but this row's actual underlying fact is just "the termination fee is
// repayable," which is trivially true of every termination fee and adds
// nothing a reader doesn't already know.
function isVisibleFeeType(feeRow) {
  return feeRow.feeType !== 'TAIL_FEE' && feeRow.feeType !== 'EXPENSE_REIMBURSEMENT';
}

const PARTY_LABELS = { TARGET: 'Company / Target', BUYER: 'Parent / Buyer' };

const SOURCE_CARD_CODE_BY_KEY = {
  companyTerminationFee: 'TERMF-TARGET',
  feeAmount: 'TERMF-TARGET',
  reverseTerminationFee: 'TERMF-REVERSE',
  reverseFeeAmount: 'TERMF-REVERSE',
  expenseReimbursement: 'TERMF-EXPENSE',
  expenseReimbursementCap: 'TERMF-EXPENSE',
  tailProvision: 'TERMF-TAIL',
  tailFeeWindowMonths: 'TERMF-TAIL',
};

function isTerminationFee(card) {
  return cardType(card) === 'TERMINATION_FEE' || cardCode(card).startsWith('TERMF') || /termination fee|reverse termination|tail fee|ticking fee/i.test(`${card?.short_title || ''} ${textOf(card)}`);
}

// Merge every TERMF card's features into one bag, routing each card's flat
// `terminationFees` claim into the legacy nested key buildTerminationFees()
// expects (see lib/termf.js) BEFORE the merge, so e.g. TERMF-TARGET's and
// TERMF-TAIL's same-named `terminationFees` attribute don't clobber each
// other.
function combineTermfFeatures(cards) {
  let combined = {};
  for (const card of cards) combined = { ...combined, ...normalizeTermfFeatures(cardFeatures(card), cardCode(card)) };
  return combined;
}

function findSourceCard(cards, sourceKey) {
  const wantCode = SOURCE_CARD_CODE_BY_KEY[sourceKey];
  return (wantCode && cards.find((card) => cardCode(card) === wantCode)) || cards[0];
}

// Renders the structured fee row (amount, % of equity, payer/payee,
// deadline, sole-remedy flag) as a short readable line instead of the raw
// { amount, triggers, payment_deadline, ... } object the claims-adapter
// hands back.
function formatFeeDetail(feeRow) {
  const parts = [];
  if (feeRow.amount) parts.push(String(feeRow.amount));
  if (feeRow.percentEquityValue) parts.push(`${feeRow.percentEquityValue} of equity value`);
  if (feeRow.payableBy && feeRow.payableTo) {
    parts.push(`Payable by ${PARTY_LABELS[feeRow.payableBy] || feeRow.payableBy} to ${PARTY_LABELS[feeRow.payableTo] || feeRow.payableTo}`);
  }
  if (feeRow.paymentDeadline) parts.push(`Deadline: ${feeRow.paymentDeadline}`);
  if (feeRow.soleRemedy === true) parts.push('Sole and exclusive remedy');
  return parts.filter(Boolean).join(' · ') || 'Amount not specified';
}

// Headline "$ amount pill" (REBUILD-SPECS.md §11: "Company Termination Fee
// [$ amount pill]") -- the quantitative fact a reader scans for first, ahead
// of the trigger pills. `amount` already arrives pre-formatted with its `$`
// sign from the claims data, so this stays a straight pass-through, not a
// re-derivation.
function feeAmountSignal(feeRow) {
  if (!feeRow.amount) return null;
  const pctSuffix = feeRow.percentEquityValue ? ` (${feeRow.percentEquityValue} of equity value)` : '';
  return {
    id: `${feeRow.feeType}-amount`,
    label: `${feeRow.amount}${pctSuffix}`,
    value: feeRow.amount,
    tone: 'present',
  };
}

// One pill per trigger (short plain-English name), not the trigger's full
// verbatim clause text — the clause itself is still reachable via the
// pill's evidence hover.
function feeTriggerSignals(feeRow) {
  return (feeRow.triggers || []).map((trigger, index) => ({
    id: `${feeRow.feeType}-trigger-${index}`,
    label: trigger.name,
    value: trigger.name,
    tone: 'info',
    evidence: trigger.sourceText,
  }));
}

function feeSignals(feeRow) {
  return [feeAmountSignal(feeRow), ...feeTriggerSignals(feeRow)].filter(Boolean);
}

function feeTableRows(cards) {
  const combined = combineTermfFeatures(cards);
  return buildTerminationFees(combined).filter(isVisibleFeeType).map((feeRow) => {
    const sourceCard = findSourceCard(cards, feeRow.sourceKey);
    return {
      id: `termination-fees-${feeRow.feeType}`,
      label: FEE_TYPE_LABELS[feeRow.feeType] || feeRow.feeType,
      kind: 'Amount',
      detail: formatFeeDetail(feeRow),
      evidence: textOf(sourceCard),
      sourceCard,
      present: true,
      signals: feeSignals(feeRow),
    };
  });
}

// interestOnLatePayment lands as a { base, rate } claim object; the generic
// valueText() field-dump ("base: the amount of the payment; rate: the prime
// rate of...") doubles the field name onto the value exactly like the
// "efforts standard: efforts standard" pattern the spec calls out elsewhere
// as a "dull row" to fix. The rate is the operative fact; `base` is near-
// always the boilerplate "the amount of the payment" and is only appended
// when it says something else.
// Ben (round 6): the rate dumped the whole clause ("the prime rate of Bank of
// America (or its successors or assigns) in effect on the date...") -> "Prime
// rate (Bank of America)".
function summarizeRate(rate) {
  const t = String(rate || '');
  if (!/prime rate/i.test(t)) return rate;
  const bank = t.match(/prime rate of\s+([A-Z][A-Za-z.& ]+?)(?:\s*\(| in effect|,|\.|$)/i);
  return bank ? `Prime rate (${bank[1].trim()})` : 'Prime rate';
}
function formatInterestOnLatePayment(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const rate = typeof raw.rate === 'string' ? summarizeRate(raw.rate.trim()) : null;
  const base = typeof raw.base === 'string' ? raw.base.trim() : null;
  if (rate && base && !/^the amount of the payment$/i.test(base)) return `${rate}, applied to ${base}`;
  return rate || base || null;
}

// Stage 4 canonical layer: prefer the extracted `interestRateBasis` code over
// the summarizeRate() prose regex. The code resolves to a stable display label
// via INTEREST_RATE_BASIS; the spread (e.g. "+2%") is a scalar rider parsed off
// the interestOnLatePayment rate prose and appended. Returns null when no code
// is present (pre-reprocess), so summarizeRate()/formatInterestOnLatePayment()
// still drive the row until the corpus is reprocessed -- transition-safe.
function extractSpread(rateRaw) {
  const rate = rateRaw && typeof rateRaw === 'object' && !Array.isArray(rateRaw) ? rateRaw.rate : rateRaw;
  const match = String(rate || '').match(/(?:\+|plus)\s*(\d+(?:\.\d+)?)\s*%/i);
  return match ? `${match[1]}%` : null;
}
function formatInterestBasis(cards) {
  const hit = firstFeature(cards, ['interestRateBasis']);
  if (!hit) return null;
  const raw = hit.value;
  const code = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw.code || raw.value)
    : (typeof raw === 'string' ? raw : null);
  const label = code ? labelForCode(String(code), taxonomyForFeatureKey('interestRateBasis')) : null;
  if (!label) return null;
  const rateHit = firstFeature(cards, ['interestOnLatePayment']);
  const spread = extractSpread(rateHit?.value);
  return spread ? `${label} + ${spread}` : label;
}

// A boolean-shaped scalar (soleRemedy, willfulBreachException, feeRequired,
// nakedNoVoteFeePresent) renders as an affirmative "Yes" pill (present/
// green) or a "No" pill (missing/grey) so those read the same as every other
// present/absent flag in the app; a substantive non-boolean fact (the
// interest formula) gets the neutral quantitative tone (info/blue) instead
// of the old Condition-vs-Remedy warning/neutral split, which didn't track
// whether the underlying value was actually true.
function scalarTone(detail) {
  if (detail === 'Yes') return 'present';
  if (detail === 'No') return 'missing';
  return 'info';
}

function scalarRows(cards) {
  return SCALAR_ROWS
    .map(([id, label, kind, keys]) => {
      const hit = firstFeature(cards, keys || id);
      const row = makeRow('termination-fees', id, label, kind, hit);
      if (!row) return null;
      const detail = id === 'interest'
        ? (formatInterestBasis(cards) || formatInterestOnLatePayment(hit.value) || row.detail)
        : row.detail;
      return {
        ...row,
        detail,
        sourceCard: hit.card,
        // Bare value only -- the Term column already names this row.
        signals: [{
          id: `${row.id}-signal`,
          label: detail,
          value: detail,
          tone: scalarTone(detail),
          evidence: row.evidence,
          source: row.sourceCard,
        }],
      };
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

// Punchlist #35: the "Detail" column (feeTableRows()' formatFeeDetail prose
// summary) was an unclear third copy of information the Signals column
// already carries as pills (amount, triggers) -- dropped as a rendered
// column. row.detail is still computed and kept on the row data (other
// call sites / tests read it directly), it just isn't given its own table
// column any more.
const terminationFeesConfig = {
  id: 'termination-fees',
  title: 'Termination Fees',
  layoutSlot: 'termination',
  selectRows(reviewDeal) {
    const cards = selectCards(reviewDeal, isTerminationFee);
    if (!cards.length) return [];
    return [...feeTableRows(cards), ...scalarRows(cards)];
  },
  columns: [
    { id: 'term', header: 'Term', width: '18rem', renderCell: (row) => row.label },
    { id: 'signals', header: 'Provision', renderCell: renderSignals },
  ],
};

export {
  combineTermfFeatures,
  feeTableRows,
  formatFeeDetail,
  renderSignals,
  scalarRows,
  terminationFeesConfig,
};
