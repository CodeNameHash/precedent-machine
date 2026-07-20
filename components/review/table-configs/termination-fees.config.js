import React from 'react';
import { buildTerminationFees, normalizeTermfFeatures } from '../../../lib/termf.js';
import { cardCode, cardFeatures, cardType, firstFeature, makeRow, selectCards, textOf } from './card-utils.js';
import { TERM_COL_WIDTH, TERM_COL_MAX } from './layout.js';
import taxonomy from '../../../lib/taxonomy.js';
import { formatPercentOfDeal } from '../../../lib/percent-of-deal.js';

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
// Punchlist #37, amended r13 (Ben): EXPENSE_REIMBURSEMENT used to be
// dropped wholesale because its usual underlying fact is just "the
// termination fee is repayable" — trivially true, adds nothing. But some
// deals carry a REAL expense-reimbursement cap with its own dollar amount
// (expenseReimbursement.amount_cap / legacy expenseReimbursementCap — see
// lib/termf.js), and Ben wants those shown with the % of deal value
// treatment. Amended rule: the row shows ONLY when it carries its own
// amount; the contentless "repayable" variant stays hidden per #37.
function isVisibleFeeType(feeRow) {
  if (feeRow.feeType === 'TAIL_FEE') return false;
  if (feeRow.feeType === 'EXPENSE_REIMBURSEMENT') return Boolean(feeRow.amount);
  return true;
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

// r13 (Ben, "% of deal value" feature): scope is FEES ONLY — company/parent
// termination fees plus expense-reimbursement caps that carry a real amount
// (see the amended Punchlist #37 rule above isVisibleFeeType). Naked-no-
// vote/tail fee are mechanics variants, not the headline fee, so they're
// left out deliberately.
const FEE_TYPES_ELIGIBLE_FOR_DEAL_PERCENT = new Set(['COMPANY_TERMINATION_FEE', 'REVERSE_TERMINATION_FEE', 'EXPENSE_REIMBURSEMENT']);

// A fee `amount` arrives pre-formatted with its `$` sign and thousands
// separators (e.g. "$332,000,000") — parse it back to a plain number so it
// can be divided by the deal's value_usd. Never guesses: anything that
// doesn't contain a clean dollar figure resolves to null.
function parseFeeAmountUsd(amount) {
  if (typeof amount === 'number') return Number.isFinite(amount) ? amount : null;
  const str = String(amount || '').replace(/,/g, '');
  const match = str.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  let n = Number(match[0]);
  if (!Number.isFinite(n)) return null;
  // Word-scaled amounts ("$10 million", "$1.2 billion"): scale the numeral
  // by the word that immediately follows it, or bail if a scale word
  // appears anywhere else in the string (a bare `10` divided into a
  // billion-dollar deal value would render an absurd near-zero percent
  // that reads as authoritative).
  const tail = str.slice(match.index + match[0].length);
  if (/^\s*million\b/i.test(tail)) n *= 1e6;
  else if (/^\s*billion\b/i.test(tail)) n *= 1e9;
  else if (/\b(?:million|billion)\b/i.test(str)) return null;
  return n;
}

// The agreement's own extracted percentage (feeRow.percentEquityValue) wins
// over anything we compute — it's the deal's own stated number, not a
// derived one. Only fall back to a computed % of deal value when no
// extracted percent exists AND the deal's value_usd is on the review
// payload (see lib/queries/review-deal.js#fetchDealValueUsd). Returns null
// (render nothing) when neither is available, or when the fee type is
// outside this feature's scope (price/consideration/deal-value fields are
// explicitly excluded — see FEE_TYPES_ELIGIBLE_FOR_DEAL_PERCENT above).
function dealPercentText(feeRow, dealValueUsd) {
  if (feeRow.percentEquityValue) return null; // extracted figure wins; see formatFeeDetail/feeAmountSignal
  if (!FEE_TYPES_ELIGIBLE_FOR_DEAL_PERCENT.has(feeRow.feeType)) return null;
  const amountUsd = parseFeeAmountUsd(feeRow.amount);
  return formatPercentOfDeal(amountUsd, dealValueUsd);
}

// Renders the structured fee row (amount, % of equity, payer/payee,
// deadline, sole-remedy flag) as a short readable line instead of the raw
// { amount, triggers, payment_deadline, ... } object the claims-adapter
// hands back.
function formatFeeDetail(feeRow, dealValueUsd) {
  const parts = [];
  if (feeRow.percentEquityValue) {
    parts.push(`${feeRow.percentEquityValue} of equity value`);
  } else {
    const computed = dealPercentText(feeRow, dealValueUsd);
    if (computed) parts.push(computed);
  }
  if (feeRow.amount) parts.push(`${String(feeRow.amount)} raw amount`);
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
// re-derivation. The parenthetical secondary text prefers the agreement's
// own extracted % of equity value; when the deal doesn't carry one, it falls
// back to the computed % of deal value (r13) using the SAME parenthetical
// idiom so no new visual language is introduced. If value_usd isn't
// available either, the amount renders alone exactly as before.
function feeAmountSignal(feeRow, dealValueUsd) {
  if (!feeRow.amount) return null;
  const pctText = feeRow.percentEquityValue
    ? `${feeRow.percentEquityValue} of equity value`
    : dealPercentText(feeRow, dealValueUsd);
  return {
    id: `${feeRow.feeType}-amount`,
    label: pctText ? `${pctText} (${feeRow.amount})` : String(feeRow.amount),
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

function feeSignals(feeRow, dealValueUsd) {
  return [feeAmountSignal(feeRow, dealValueUsd), ...feeTriggerSignals(feeRow)].filter(Boolean);
}

function feeTableRows(cards, dealValueUsd) {
  const combined = combineTermfFeatures(cards);
  return buildTerminationFees(combined).filter(isVisibleFeeType).map((feeRow) => {
    const sourceCard = findSourceCard(cards, feeRow.sourceKey);
    return {
      id: `termination-fees-${feeRow.feeType}`,
      label: FEE_TYPE_LABELS[feeRow.feeType] || feeRow.feeType,
      kind: 'Amount',
      detail: formatFeeDetail(feeRow, dealValueUsd),
      evidence: textOf(sourceCard),
      sourceCard,
      present: true,
      signals: feeSignals(feeRow, dealValueUsd),
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

const INTEREST_MARKET_CODES = ['TERMF-TARGET', 'TERMF-REVERSE'];
const INTEREST_MARKET_KEYS = ['interestOnLatePayment', 'interestRateBasis'];

function interestMarketSubterms() {
  return [
    {
      key: 'rate-basis',
      label: 'Reference rate',
      featureKeys: INTEREST_MARKET_KEYS,
      kind: 'categorical',
      value: { strategy: 'feature_value', featureKeys: INTEREST_MARKET_KEYS, normalizer: 'late_payment_rate_basis' },
    },
    {
      key: 'spread',
      label: 'Spread over reference rate',
      featureKeys: ['interestOnLatePayment'],
      kind: 'numeric',
      value: { strategy: 'feature_value', featureKeys: ['interestOnLatePayment'], normalizer: 'late_payment_spread_percent' },
      semantics: { unit: 'percent' },
    },
    {
      key: 'interest-base',
      label: 'Interest base',
      featureKeys: ['interestOnLatePayment'],
      kind: 'categorical',
      value: { strategy: 'feature_value', featureKeys: ['interestOnLatePayment'], normalizer: 'late_payment_interest_base' },
    },
  ];
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
        ...(id === 'interest' ? {
          featureKeys: INTEREST_MARKET_KEYS,
          marketProvisionCodes: INTEREST_MARKET_CODES,
          marketPresence: {
            strategy: 'feature_non_empty',
            featureKeys: INTEREST_MARKET_KEYS,
            missingState: 'absent',
          },
          marketSubterms: interestMarketSubterms(),
        } : {}),
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
    // r13: reviewDeal.value_usd is attached server-side by
    // lib/queries/review-deal.js#fetchDealValueUsd (deals.value_usd, the
    // deal's equity value at announcement) and survives the wire trim (see
    // lib/queries/review-deal-wire.js) — null when not on file, in which
    // case fee rows render exactly as they did before this feature.
    const dealValueUsd = reviewDeal && typeof reviewDeal.value_usd === 'number' && Number.isFinite(reviewDeal.value_usd)
      ? reviewDeal.value_usd
      : null;
    return [...feeTableRows(cards, dealValueUsd), ...scalarRows(cards)];
  },
  fixedLayout: true,
  columns: [
    { id: 'term', header: 'Term', width: TERM_COL_WIDTH, maxWidth: TERM_COL_MAX, renderCell: (row) => row.label },
    { id: 'signals', header: 'Provision', renderCell: renderSignals },
  ],
};

export {
  combineTermfFeatures,
  dealPercentText,
  feeAmountSignal,
  feeTableRows,
  formatFeeDetail,
  parseFeeAmountUsd,
  renderSignals,
  scalarRows,
  terminationFeesConfig,
};
