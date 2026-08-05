import React from 'react';
import { buildTerminationFees, normalizeTermfFeatures } from '../../../lib/termf.js';
import { cardCode, cardFeatures, cardType, firstFeature, makeRow, selectCards, textOf } from './card-utils.js';
import { TERM_COL_WIDTH, TERM_COL_MAX } from './layout.js';
import taxonomy from '../../../lib/taxonomy.js';
import { formatPercentOfDeal } from '../../../lib/percent-of-deal.js';
import { parseMoneyAmount } from '../../../lib/parse-money.js';

const { labelForCode, taxonomyForFeatureKey } = taxonomy;

// Scalar rows read straight off a flat claim attribute that already matches
// its legacy/UI name 1:1 — no nested-shape bridging needed (that bridging
// lives in lib/termf.js's routeRawTerminationFees, used by feeTableRows()
// below for the amount/trigger/tail rows). REBUILD-SPECS.md §11's clean-row
// list is Company Termination Fee / Willful-breach exception / Interest on
// late payment / Sole remedy; "Naked no-vote fee" is kept alongside them (a
// real per-deal Yes/No fact, not prose) but the boilerplate "Effect of
// Termination" sentence (void-on-termination survival language) is dropped —
// it isn't a decision-relevant signal and its substantive facts (the two
// willful-breach rows below) already have their own rows.
//
// Owner ruling (2026-08-05): "Willful-breach exception" split into TWO rows.
// TERMF-EFFECT's willfulBreachException (rubric.js ~3627, "Willful Breach
// Carve-out") is a carve-out to the effect-of-termination rule — liability
// survives termination. TERMF-SOLE's willfulBreachException (rubric.js
// ~3634, "Willful Breach Carve-out to Sole Remedy") is a carve-out to the
// fee-as-damages cap. Same feature key, two legally distinct facts that
// allocate different risk, and an agreement can carry either without the
// other — so each row below is scoped to its OWN source code (see the 5th
// tuple element, read by scalarRows()) rather than both reading
// firstFeature() over the combined card set, which let card order silently
// decide which of the two facts a lawyer saw (the live defect this fixes).
//
// "Fee required to terminate" (feeRequired) has moved OUT of this table: it
// means payment is a condition precedent to exercising the fiduciary out
// (lib/schema/features.js scopes it to provisionTypes: ["TERMR"],
// provisionCodes: ["TERMR-SUPERIOR"]), not that a termination fee is itself
// payable. It now renders on the Termination Rights table's "Fiduciary out"
// cross-reference group — see termination-rights.config.js.
//
// Punchlist #36: "Interest on late payment" moved to the LAST position --
// it's a remedy-mechanics footnote, not a headline fact, and reads better
// after the fee/condition rows above it. Since selectRows() below appends
// scalarRows() after feeTableRows(), this ordering also puts it at the very
// bottom of the whole table, not just the scalar-row group.
const SCALAR_ROWS = [
  ['naked-no-vote', 'Naked no-vote fee', 'Condition', ['nakedNoVoteFeePresent', 'nakedNoVoteFee']],
  ['sole-remedy', 'Sole and exclusive remedy', 'Remedy', ['soleRemedy', 'soleAndExclusiveRemedy']],
  ['willful-breach-effect', 'Willful-breach carve-out', 'Remedy', ['willfulBreachException'], 'TERMF-EFFECT'],
  ['willful-breach-sole', 'Willful-breach carve-out to sole remedy', 'Remedy', ['willfulBreachException'], 'TERMF-SOLE'],
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

// The title/quote fallback below exists for ONE case: a genuine fee card the
// classifier never subtyped, which carries neither the fee provision_type nor a
// TERMF code and would otherwise be invisible to this table. It is NOT a
// classifier. Run unguarded it also nets every card of every OTHER family that
// merely MENTIONS the fee -- and clauses that mention it are common: a
// sole-remedy clause (REM-SOLE, owned by Specific Performance / Remedies) is
// usually about the fee, and a buyer financing rep quotes the guarantee of "the
// Parent Termination Fee" (see the real REP-B-FUNDS card in
// tests/fixtures/canonical-v2/financing-covenants-live-run/corpus-cards.json,
// exported from the production provision_cards table, which this guard now
// keeps out). Once such a card is selected, combineTermfFeatures() merges its
// features into the fee row's bag and findSourceCard()'s `|| cards[0]` fallback
// can hand a fee row a foreign clause as its evidence.
//
// So the fallback is narrowed, not removed: it applies only to a card NO family
// has claimed. A card already carrying another family's provision_type or
// canonical code belongs to that family, and a word match in its quote must
// never re-home it here.
const FEE_TEXT_RE = /termination fee|reverse termination|tail fee|ticking fee/i;

// cardType() reads provision_type first and falls back to `type`; canonical fee
// cards carry 'TERMINATION_FEE' on the former and 'TERMF' on the latter, so
// both spellings count as this family's own.
const FEE_CARD_TYPES = new Set(['TERMINATION_FEE', 'TERMF']);

function isClaimedByAnotherFamily(card) {
  const type = cardType(card);
  if (type && !FEE_CARD_TYPES.has(type)) return true;
  const code = cardCode(card);
  return Boolean(code) && !code.startsWith('TERMF');
}

function isTerminationFee(card) {
  if (cardType(card) === 'TERMINATION_FEE' || cardCode(card).startsWith('TERMF')) return true;
  if (isClaimedByAnotherFamily(card)) return false;
  return FEE_TEXT_RE.test(`${card?.short_title || ''} ${textOf(card)}`);
}

// Merge every TERMF card's features into one bag, routing each card's flat
// `terminationFees` claim into the legacy nested key buildTerminationFees()
// expects (see lib/termf.js) BEFORE the merge, so e.g. TERMF-TARGET's and
// TERMF-TAIL's same-named `terminationFees` attribute don't clobber each
// other.
function combineTermfFeatures(cards) {
  let combined = {};
  for (const card of cards) {
    const next = normalizeTermfFeatures(cardFeatures(card), cardCode(card));
    const merged = { ...combined, ...next };
    for (const key of ['companyTerminationFee', 'reverseTerminationFee', 'tailProvision']) {
      const left = combined[key];
      const right = next[key];
      if (!left || !right || typeof left !== 'object' || typeof right !== 'object') continue;
      merged[key] = { ...left, ...right };
      if (Array.isArray(left.triggers) || Array.isArray(right.triggers)) {
        merged[key].triggers = [...new Map([...(left.triggers || []), ...(right.triggers || [])]
          .map((trigger) => [trigger?.code || JSON.stringify(trigger), trigger])).values()];
      }
    }
    combined = merged;
  }
  return combined;
}

function findSourceCard(cards, sourceKey) {
  const wantCode = SOURCE_CARD_CODE_BY_KEY[sourceKey];
  return cards.find((card) => cardCode(card) === wantCode && cardFeatures(card)[sourceKey] !== undefined)
    || (wantCode && cards.find((card) => cardCode(card) === wantCode))
    || cards[0];
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
//
// Delegates to lib/parse-money.js, the one shared implementation for what
// were six independent, duplicate "parse a dollar amount" functions (see
// that file's header for the full backstory). This was the one call site
// whose own dollar-sign-scoped ambiguity rule and million/billion scale
// words became the shared parser's default behavior — its own inline
// implementation is gone, but its exact behavior on every string this table
// has ever rendered is unchanged (see tests/canonical-v2-termination-fee-
// conditional-amount-projection.test.js and tests/review/termination-fees-
// percent-of-deal.test.js, both still pinned byte-for-byte).
function parseFeeAmountUsd(amount) {
  return parseMoneyAmount(amount, { scale: true });
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
    label: pctText ? `${feeRow.amount} (${pctText})` : String(feeRow.amount),
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

/* ─────────────────────────────────────────────────────────────────────────
   CANONICAL LATE-PAYMENT INTEREST
   ─────────────────────────────────────────────────────────────────────────
   Canonical serving publishes the rate as PROSE on
   `latePaymentInterestBenchmark`, beside a BOOLEAN `interestOnLatePayment`
   (lib/canonical-v2/termination-product-projection.js's LATE_PAYMENT_INTEREST
   branch). formatInterestOnLatePayment() above only reads the legacy
   { rate, base } object, so it saw the bare boolean and the row that reads
   "Prime rate (Bank of America)" under legacy collapsed to "Yes".

   The prose runs through the SAME summarizeRate() the legacy rate goes
   through, so one agreement reads identically whichever extraction served it,
   and the two sides of the V1/V2 comparison are compared like for like rather
   than differing only in house style.

   The reference-rate CODE is NOT re-derived here. The projection derives it
   with lib/row-market-stats/legal-normalizers.js#latePaymentRateBasis -- the
   classifier this row's own market subterms already use -- and publishes it as
   `interestRateBasis`. Its presence is therefore this config's signal that the
   rate was actually resolved; its absence is the signal that it was not.
   ───────────────────────────────────────────────────────────────────────── */
const INTEREST_BENCHMARK_KEYS = ['latePaymentInterestBenchmark'];

function interestBenchmarkProse(cards) {
  const hit = firstFeature(cards, INTEREST_BENCHMARK_KEYS);
  const raw = typeof hit?.value === 'string' ? hit.value : null;
  const prose = raw ? raw.trim() : '';
  return prose || null;
}

function formatInterestBenchmark(cards) {
  const prose = interestBenchmarkProse(cards);
  if (!prose) return null;
  const summarized = summarizeRate(prose);
  return typeof summarized === 'string' && summarized.trim() ? summarized.trim() : prose;
}

// The projection publishes interestRateBasis ONLY when its classifier resolved
// a real reference rate, so "benchmark prose but no code" is exactly the case
// where the agreement states something the classifier could not read as a rate
// -- a defined-term cross-reference ("the Applicable Rate") above all.
function hasResolvedInterestRateBasis(cards) {
  return Boolean(firstFeature(cards, ['interestRateBasis']));
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

// A boolean-shaped scalar (soleRemedy, willfulBreachException,
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
    .map(([id, label, kind, keys, sourceCode]) => {
      // sourceCode (willful-breach-effect / willful-breach-sole) scopes the
      // lookup to cards carrying that EXACT canonical code before the first-
      // match search runs, so the two rows can never read each other's card
      // even though they share the willfulBreachException feature key -- the
      // fix for the order-dependent hybrid described above SCALAR_ROWS.
      const pool = sourceCode ? cards.filter((c) => cardCode(c) === sourceCode) : cards;
      const hit = firstFeature(pool, keys || id);
      const row = makeRow('termination-fees', id, label, kind, hit);
      if (!row) return null;
      // Benchmark prose first: it is what the AGREEMENT says, and it is
      // strictly more informative than the code's taxonomy label ("Prime rate
      // (Bank of America)" vs "Prime rate (a named bank)"). Legacy cards carry
      // no benchmark, so their row is byte-identical to before.
      const detail = id === 'interest'
        ? (formatInterestBenchmark(cards) || formatInterestBasis(cards) || formatInterestOnLatePayment(hit.value) || row.detail)
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

function deferredEvidenceRows(cards) {
  return cards
    .filter((card) => card?.canonical_v2_lineage?.source === 'CANONICAL_V2_OPEN_WORLD_EVIDENCE')
    .map((card, index) => {
      const evidence = cardFeatures(card).canonicalV2OpenWorldEvidence || {};
      const surface = String(evidence.surface || 'UNCLASSIFIED').replaceAll('_', ' ').toLowerCase();
      const label = surface.charAt(0).toUpperCase() + surface.slice(1);
      const detail = evidence.detail || 'Evidence retained for later adjudication';
      return {
        id: `termination-fees-deferred-${card.id || index}`,
        label: `Deferred evidence: ${label}`,
        kind: 'Evidence',
        detail,
        evidence: textOf(card),
        sourceCard: card,
        present: true,
        signals: [{
          id: `termination-fees-deferred-${card.id || index}-signal`,
          label: detail,
          value: detail,
          tone: 'neutral',
          evidence: textOf(card),
          source: card,
        }],
      };
    });
}

/* ─────────────────────────────────────────────────────────────────────────
   PER-FAMILY SERVING SWITCH (termination fees)
   ─────────────────────────────────────────────────────────────────────────
   The switch lives here, at selectRows(), because every consumer of this
   table routes through config.selectRows -- ProvisionTable.jsx, pages/
   review-v1/[id].js, components/review-v2/CompareColumn.jsx, lib/market-
   metrics/section-rows.js -- so one seam covers all of them, and the row
   builders below (feeTableRows/scalarRows/deferredEvidenceRows) stay
   completely unaware of which source fed them.

   PARTITION, NEVER MERGE. combineTermfFeatures() object-merges every card's
   features into one bag. Hand it a mixed array -- a canonical TERMF-TARGET
   card beside a legacy one -- and the resulting fee row is an ORDER-DEPENDENT
   HYBRID: canonical amount, legacy percentage, legacy deadline, changing with
   array order. It is silent, and it corrupts the exact figures a reader
   relies on. So exactly ONE card set reaches the row builders, chosen by the
   flag; the two sets are never concatenated.

   Server-only flag, read as a strict own-property boolean off the wire
   payload (see lib/canonical-v2/termination-fee-serving-source.js for the
   env gate and the stamping, lib/queries/review-deal-wire.js for the wire
   allowlist). Default OFF and fail closed: absent, malformed, non-object or
   explicitly-undefined all yield legacy.
   ───────────────────────────────────────────────────────────────────────── */

// Re-declared here rather than imported: this file is client-side, and
// lib/canonical-v2/termination-fee-serving-source.js is a server module that
// pulls in node:fs and the projection pipeline. tests/canonical-v2-
// termination-fee-serving-switch.test.js pins that the two declarations agree.
const CANONICAL_V2_TERMINATION_FEE_SERVING_FIELD = 'canonical_v2_termination_fee_serving_enabled';
const CANONICAL_V2_TERMINATION_FEE_CARDS_FIELD = 'canonical_v2_termination_fee_cards';
// Fourth mode (both sources rendered together). A SEPARATE own-property boolean
// rather than a widened value on the serving field, so the three existing modes
// read exactly the field they read today and a payload without this key is
// bit-for-bit the payload they already handle.
const CANONICAL_V2_TERMINATION_FEE_COMPARE_FIELD = 'canonical_v2_termination_fee_compare_enabled';
// The outcome that produced CANONICAL_V2_TERMINATION_FEE_CARDS_FIELD (see
// lib/canonical-v2/termination-fee-serving-source.js's TERMINATION_FEE_SOURCE_STATE
// -- re-declared as a bare string check below rather than imported, same
// client/server split as the three fields above). Absent, or present with
// state !== 'FAILED', renders exactly the pre-existing "no canonical data"
// fallback -- so every reviewDeal built before this field existed, and every
// deal that is genuinely just unregistered, is byte-identical to before.
// Only an explicit FAILED renders the DIFFERENT message below: a registered
// source Canonical V2 could not read or verify is not the same claim as "no
// data for this deal", and must never look like it on the page.
const CANONICAL_V2_TERMINATION_FEE_SOURCE_STATUS_FIELD = 'canonical_v2_termination_fee_source_status';

const CANONICAL_V2_CARD_SOURCES = new Set(['CANONICAL_V2_NATIVE_CLAIM', 'CANONICAL_V2_OPEN_WORLD_EVIDENCE']);

// Strict by construction, mirroring canonical-v2-preview-lane.js's reader:
// only an OWN property (never one reachable through the prototype chain)
// holding the exact boolean `true` enables canonical serving. A truthy
// stand-in ("true", 1, {}), a missing field, or a non-object payload all fail
// closed to legacy.
function isCanonicalTerminationFeeServingEnabled(reviewDeal) {
  if (reviewDeal === null || typeof reviewDeal !== 'object') return false;
  if (!Object.prototype.hasOwnProperty.call(reviewDeal, CANONICAL_V2_TERMINATION_FEE_SERVING_FIELD)) return false;
  return reviewDeal[CANONICAL_V2_TERMINATION_FEE_SERVING_FIELD] === true;
}

// Both-sources mode is strictly NARROWER than canonical serving: it needs the
// canonical cards on the wire, which only the serving gate stamps. So it
// requires BOTH own-property booleans, and fails closed on either.
function isCanonicalTerminationFeeCompareEnabled(reviewDeal) {
  if (!isCanonicalTerminationFeeServingEnabled(reviewDeal)) return false;
  if (!Object.prototype.hasOwnProperty.call(reviewDeal, CANONICAL_V2_TERMINATION_FEE_COMPARE_FIELD)) return false;
  return reviewDeal[CANONICAL_V2_TERMINATION_FEE_COMPARE_FIELD] === true;
}

function isCanonicalV2Card(card) {
  return CANONICAL_V2_CARD_SOURCES.has(card?.canonical_v2_lineage?.source);
}

// Strict by construction, same idiom as isCanonicalTerminationFeeServingEnabled
// above: only an OWN property holding a status object whose `state` is the
// exact string 'FAILED' counts. A missing field, a non-object payload, or any
// other state (NOT_REGISTERED, ATTACHED, or a value from a future state this
// config does not yet know about) all read as "not a failure" -- fail closed
// into the existing, already-correct fallback message rather than risk a
// false "source failed" claim.
function isCanonicalTerminationFeeSourceFailed(reviewDeal) {
  if (reviewDeal === null || typeof reviewDeal !== 'object') return false;
  if (!Object.prototype.hasOwnProperty.call(reviewDeal, CANONICAL_V2_TERMINATION_FEE_SOURCE_STATUS_FIELD)) return false;
  const status = reviewDeal[CANONICAL_V2_TERMINATION_FEE_SOURCE_STATUS_FIELD];
  return Boolean(status) && typeof status === 'object' && status.state === 'FAILED';
}

// Splits every termination-fee card reachable for this deal into the two
// sources, keyed off the canonical lineage stamp the projection puts on its
// own cards. Canonical cards arrive on their own wire field
// (canonical_v2_termination_fee_cards) but are also recognised inside
// reviewDeal.cards -- that is the shape that produces the hybrid defect, so it
// is precisely the shape the partition has to handle.
function partitionTerminationFeeCards(reviewDeal) {
  const inline = selectCards(reviewDeal, isTerminationFee);
  const attached = Array.isArray(reviewDeal?.[CANONICAL_V2_TERMINATION_FEE_CARDS_FIELD])
    ? reviewDeal[CANONICAL_V2_TERMINATION_FEE_CARDS_FIELD].filter(isTerminationFee)
    : [];
  const legacyCards = [];
  const canonicalCards = [];
  const seen = new Set();
  for (const card of [...inline, ...attached]) {
    const key = card?.id || card;
    if (seen.has(key)) continue;
    seen.add(key);
    (isCanonicalV2Card(card) ? canonicalCards : legacyCards).push(card);
  }
  return { legacyCards, canonicalCards };
}

const SERVING_SOURCE_ROW_ID = 'termination-fees-serving-source';

// The reader must never have to guess which extraction produced the table, and
// a deal that has no canonical data must fall back VISIBLY -- an unannounced
// legacy table under a canonical flag is the same class of silent wrongness
// the partition exists to prevent. Both notices are ordinary rows (first in
// the table) carrying marketSkip, so no market metric is ever computed off a
// provenance notice.
// LEGACY_FALLBACK_SOURCE_FAILED (2026-08-05 fix): a registered canonical
// source that Canonical V2 could not READ or VERIFY -- an unreadable pinned
// file or a sha256 digest mismatch -- is not the same fact as LEGACY_FALLBACK
// (this deal simply has no canonical entry) and must not render the same
// sentence. The 2026-08-05 production incident was exactly this collapse: a
// Vercel file-tracing gap made TopBuild's registered source unreadable, and
// the page told a reviewer "Canonical V2 has no termination-fee data for
// this deal" -- true only for the OTHER deals, false for this one. The
// message below says what actually happened (data exists, could not be
// loaded) without naming the specific cause -- that detail belongs in the
// server log (see reportTerminationFeeSourceFailure in termination-fee-
// serving-source.js), not on a lawyer's review page.
function servingSourceRow(state) {
  if (state === 'BOTH_SOURCES') return bothSourcesProvenanceRow();
  const detail = state === 'CANONICAL'
    ? 'Canonical V2'
    : state === 'LEGACY_FALLBACK_SOURCE_FAILED'
      ? 'Legacy extraction — Canonical V2 has termination-fee data for this deal but could not load or verify its source'
      : 'Legacy extraction — Canonical V2 has no termination-fee data for this deal';
  return {
    id: SERVING_SOURCE_ROW_ID,
    label: 'Served from',
    kind: 'Provenance',
    detail,
    present: true,
    marketSkip: true,
    servingSourceState: state,
    signals: [{
      id: `${SERVING_SOURCE_ROW_ID}-signal`,
      label: detail,
      value: detail,
      tone: state === 'CANONICAL' ? 'info' : 'warning',
    }],
  };
}

/* ─────────────────────────────────────────────────────────────────────────
   NOT-YET-EXTRACTED vs ESTABLISHED-ABSENT
   ─────────────────────────────────────────────────────────────────────────
   A row that simply vanishes reads, to a lawyer, as a statement about the
   AGREEMENT: no sole-remedy row means no sole-remedy clause. When the row is
   missing only because canonical has not extracted the field yet, that
   statement is false, and confidently-wrong is the worst failure this product
   has. So the two states are rendered differently and neither is silent:

     established absent   -> the legacy "No" pill, tone `missing` (grey).
                             The extractor looked and found nothing.
     not yet extracted    -> an explicit "Not yet extracted" pill, tone
                             `warning` (amber), on a row that still carries the
                             term's real name. We have not looked yet.

   The gap list is DERIVED, never hardcoded: a surface gets a placeholder iff
   the canonical card set produced no row with that id. As canonical coverage
   grows the placeholders disappear on their own, with no edit here. The
   deliberate conservative consequence: if canonical one day proves a term is
   genuinely absent, it still reads "Not yet extracted" until it emits a row
   for it -- visibly incomplete, never confidently wrong.
   ───────────────────────────────────────────────────────────────────────── */

const NOT_YET_EXTRACTED_DETAIL = 'Not yet extracted';

// Every surface the legacy table can render, in render order. Placeholder ids
// are deliberately NOT the real row ids: lib/canonical-v2/review-row-binding.js
// matches `termination-fees-COMPANY_TERMINATION_FEE` /
// `termination-fees-REVERSE_TERMINATION_FEE` exactly, and a placeholder must
// never be mistaken for the real row by the market sidebar.
//
// The NAKED_NO_VOTE_FEE *fee* row is deliberately absent from this list: the
// `naked-no-vote` scalar row below already names that concept, and two
// placeholders for one gap is noise, not honesty.
const CANONICAL_COVERAGE_SURFACES = [
  ['termination-fees-COMPANY_TERMINATION_FEE', 'Company termination fee'],
  ['termination-fees-REVERSE_TERMINATION_FEE', 'Reverse termination fee'],
  ['termination-fees-EXPENSE_REIMBURSEMENT', 'Expense reimbursement cap'],
  ['termination-fees-naked-no-vote', 'Naked no-vote fee'],
  ['termination-fees-sole-remedy', 'Sole and exclusive remedy'],
  ['termination-fees-willful-breach-effect', 'Willful-breach carve-out'],
  ['termination-fees-willful-breach-sole', 'Willful-breach carve-out to sole remedy'],
  ['termination-fees-interest', 'Interest on late payment'],
];

function notYetExtractedRow(rowId, label) {
  const id = `termination-fees-not-yet-extracted-${rowId.replace(/^termination-fees-/, '')}`;
  return {
    id,
    label,
    kind: 'Coverage',
    detail: NOT_YET_EXTRACTED_DETAIL,
    // present:false is the honest flag -- there is no extracted value here.
    // It is NOT the same as "absent from the agreement", which is what the
    // detail/tone below exist to say out loud.
    present: false,
    marketSkip: true,
    coverageState: 'NOT_YET_EXTRACTED',
    coverageRowId: rowId,
    signals: [{
      id: `${id}-signal`,
      label: NOT_YET_EXTRACTED_DETAIL,
      value: NOT_YET_EXTRACTED_DETAIL,
      tone: 'warning',
    }],
  };
}

function notYetExtractedRows(rows) {
  const produced = new Set(rows.map((row) => row.id));
  return CANONICAL_COVERAGE_SURFACES
    .filter(([rowId]) => !produced.has(rowId))
    .map(([rowId, label]) => notYetExtractedRow(rowId, label));
}

// Field-level gaps INSIDE a row canonical did produce. A served fee row whose
// amount is canonical but whose "% of equity value"/deadline/sole-remedy
// fields are simply not extracted yet would otherwise read as a complete fee
// row -- the reader would take the silence on sole remedy as a finding. One
// amber pill names the gaps explicitly instead.
const FEE_ROW_FIELD_LABELS = [
  ['percentEquityValue', '% of equity value'],
  ['paymentDeadline', 'payment deadline'],
  ['soleRemedy', 'sole-remedy status'],
];

function feeRowCoverageSignal(feeRow) {
  const missing = FEE_ROW_FIELD_LABELS
    .filter(([key]) => feeRow[key] === null || feeRow[key] === undefined || feeRow[key] === '')
    .map(([, label]) => label);
  if (!missing.length) return null;
  const text = `${NOT_YET_EXTRACTED_DETAIL}: ${missing.join(', ')}`;
  return {
    id: `${feeRow.feeType}-not-yet-extracted`,
    label: text,
    value: text,
    tone: 'warning',
  };
}

// The interest row degrades rather than vanishes under canonical. Two
// different, and differently-honest, degradations:
//
//   no benchmark at all -- Wave B recorded only `interestOnLatePayment: true`,
//     so the row that reads "Prime rate (Bank of America)" under legacy
//     collapses to a bare "Yes". "Yes" alone implies we know the terms; we do
//     not. Say so.
//
//   benchmark, but no resolved reference rate -- the agreement DOES state a
//     rate and we DO have its words, but they are a defined-term
//     cross-reference ("the Applicable Rate"): a pointer to a definition
//     elsewhere in the agreement, not a rate. The projection deliberately
//     publishes no interestRateBasis for one, so nothing downstream treats the
//     pointer as an extracted rate. The row shows the agreement's own words --
//     hiding them behind "not yet extracted" would be false, we did extract
//     them -- in quotes, so they read as the agreement's term rather than as
//     our finding, followed by the plain statement that they have not been
//     resolved to a reference rate. Amber, and PARTIAL_NOT_YET_EXTRACTED, the
//     same as the bare-"Yes" case: this row is not finished either way.
const INTEREST_RATE_NOT_EXTRACTED = 'reference rate not yet extracted';
const INTEREST_RATE_NOT_RESOLVED = 'reference rate not resolved';

function interestCoverageDetail(row, cards) {
  if (row.detail === 'Yes') return `Yes (${INTEREST_RATE_NOT_EXTRACTED})`;
  const prose = interestBenchmarkProse(cards);
  if (!prose || hasResolvedInterestRateBasis(cards)) return null;
  return `"${prose}" (${INTEREST_RATE_NOT_RESOLVED})`;
}

function withInterestCoverage(row, cards) {
  if (row.id !== 'termination-fees-interest') return row;
  const detail = interestCoverageDetail(row, cards);
  if (!detail) return row;
  return {
    ...row,
    detail,
    coverageState: 'PARTIAL_NOT_YET_EXTRACTED',
    signals: (row.signals || []).map((signal) => ({ ...signal, label: detail, value: detail, tone: 'warning' })),
  };
}

// One structured fee row per real row id, keyed the same way feeTableRows()
// keys its output. Callers use it to reach the fields the RENDERED row has
// already flattened into pills (amount, triggers, coverage gaps).
function feeRowsById(cards) {
  return new Map(
    buildTerminationFees(combineTermfFeatures(cards))
      .filter(isVisibleFeeType)
      .map((feeRow) => [`termination-fees-${feeRow.feeType}`, feeRow]),
  );
}

// The rows one card set actually produced, coverage-annotated -- WITHOUT the
// derived placeholder appendix. Split out from canonicalRows() because
// both-sources mode needs the produced rows on their own: there, a surface
// canonical did not produce is stated inside the V2 cell of the row V1
// produced, not as a separate placeholder row.
function canonicalServedRows(cards, dealValueUsd) {
  const byId = feeRowsById(cards);
  const fees = feeTableRows(cards, dealValueUsd).map((row) => {
    const coverage = byId.has(row.id) ? feeRowCoverageSignal(byId.get(row.id)) : null;
    return coverage ? { ...row, signals: [...row.signals, coverage] } : row;
  });
  return [...fees, ...scalarRows(cards).map((row) => withInterestCoverage(row, cards)), ...deferredEvidenceRows(cards)];
}

// Builds the canonical-served rows: the same builders the legacy path uses,
// with the coverage annotations layered on. The row builders themselves are
// untouched -- row ids in particular stay byte-identical, so
// `termination-fees-COMPANY_TERMINATION_FEE` /
// `termination-fees-REVERSE_TERMINATION_FEE` still bind to the market sidebar.
function canonicalRows(cards, dealValueUsd) {
  const rows = canonicalServedRows(cards, dealValueUsd);
  return [...rows, ...notYetExtractedRows(rows)];
}

// The legacy path's row expression, named. Byte-identical to the literal
// `[...feeTableRows(cards, v), ...scalarRows(cards), ...deferredEvidenceRows(cards)]`
// selectRows() used inline before, and still uses via this function.
function legacyServedRows(cards, dealValueUsd) {
  return [...feeTableRows(cards, dealValueUsd), ...scalarRows(cards), ...deferredEvidenceRows(cards)];
}

function renderPills(signals, ctx) {
  const PillCell = ctx?.primitives?.PillCell;
  if (!PillCell) return (signals || []).map((item) => item.label).join('\n');
  return (signals || []).map((item) => React.createElement(PillCell, {
    key: item.id,
    label: item.label,
    value: item.value,
    tone: item.tone,
    // `color`/`wrap` are undefined on every pre-existing signal, and PillCell
    // falls straight back to `tone` / single-line truncation for undefined --
    // so threading them changes nothing for any row that does not set them.
    // The comparison verdict pill sets both.
    color: item.color,
    wrap: item.wrap,
    evidence: item.evidence,
    source: item.source,
  }));
}

function renderSignals(row, ctx) {
  return renderPills(row.signals, ctx);
}

/* ─────────────────────────────────────────────────────────────────────────
   BOTH SOURCES, SIDE BY SIDE (fourth mode)
   ─────────────────────────────────────────────────────────────────────────
   Ben's ruling (2026-08-05): switch to real Canonical V2 data as it lands, but
   keep V1 VISIBLE ON THE PAGE beside it. Nine termination-fee fields have no V2
   counterpart today; under a straight switch they vanish, and a vanished row
   reads to a lawyer as "the agreement is silent", which is a different and far
   more damaging claim than "we have not extracted this yet".

   THE PARTITION STILL HOLDS. The two card sets are still never concatenated:
   each side's rows are built by handing ONE card set to the ordinary row
   builders (legacyServedRows / canonicalServedRows). What is joined here is
   ROWS, by row id, after each side's values are already fully determined --
   never features, never cards. No rendered value is ever composed from both
   sides, so the order-dependent hybrid (canonical amount + legacy percentage)
   cannot be constructed by this path at all.

   ROW IDENTITY DOES NOT MOVE. Each joined row keeps the id the surface already
   had, exactly once -- `termination-fees-COMPANY_TERMINATION_FEE` /
   `...-REVERSE_TERMINATION_FEE` still match lib/canonical-v2/review-row-
   binding.js:126,136. Emitting the two sources as two ROWS was rejected for
   precisely this reason: duplicate ids make findPreparedReviewBinding() throw
   AMBIGUOUS_BOUND_REVIEW_ROW and detach the market sidebar. The only rows this
   mode ADDS carry the existing distinct `termination-fees-not-yet-extracted-`
   prefix.

   WHY NOT components/review-v2/CompareColumn.jsx's UnifiedCompareSection --
   the product's existing side-by-side idiom. Its MODEL is right and is copied
   here wholesale: one shared label column, one answer column per source,
   answers aligned by row identity, an explicit "not extracted" cell rather
   than a blank. Its MECHANISM does not fit. That component's columns are
   DEALS: it calls safeRows(config, deal.reviewDeal) once per compared deal and
   keys each column off a distinct reviewDeal fetched by compareData.js. V1 and
   V2 are two extractions of the SAME deal, reachable only from inside one
   selectRows() call, so driving them through it would mean fabricating a
   second reviewDeal for the same deal and pushing it in as a compared column
   -- which mislabels the masthead ("X vs X"), gives one deal two deal-name
   headers with two agreement links, and stacks a source axis onto a deal axis
   the component has no 2-D model for. It is also page-mode plumbing outside
   this seam. So: the idiom, not the component. The one real cost is noted in
   the config's export comment below.
   ───────────────────────────────────────────────────────────────────────── */

const V1_COLUMN_HEADER = 'V1 (legacy extraction)';
const V2_COLUMN_HEADER = 'V2 (Canonical V2)';
const V1_EVIDENCE_HEADING = 'V1 — legacy extraction';
const V2_EVIDENCE_HEADING = 'V2 — Canonical V2';
const NOT_IN_V1_DETAIL = 'Not in the V1 extraction';

function bothSourcesProvenanceRow() {
  const detail = 'V1 legacy extraction and Canonical V2, rendered side by side';
  return {
    id: SERVING_SOURCE_ROW_ID,
    label: 'Served from',
    kind: 'Provenance',
    detail,
    present: true,
    marketSkip: true,
    servingSourceState: 'BOTH_SOURCES',
    // No sourceComparison: a provenance notice has nothing to compare, and the
    // Term column only renders a verdict chip for rows that carry one.
    sources: {
      v1: { label: V1_COLUMN_HEADER, present: true, headline: 'Legacy extraction', detail: 'Legacy extraction', signals: [{ id: `${SERVING_SOURCE_ROW_ID}-v1`, label: 'Legacy extraction', value: 'Legacy extraction', tone: 'info' }] },
      v2: { label: V2_COLUMN_HEADER, present: true, headline: 'Canonical V2', detail: 'Canonical V2', signals: [{ id: `${SERVING_SOURCE_ROW_ID}-v2`, label: 'Canonical V2', value: 'Canonical V2', tone: 'info' }] },
    },
    signals: [{ id: `${SERVING_SOURCE_ROW_ID}-signal`, label: detail, value: detail, tone: 'info' }],
  };
}

function normalizedText(value) {
  return String(value === null || value === undefined ? '' : value).trim().replace(/\s+/g, ' ').toLowerCase();
}

// The one value a reader compares first: a fee row's dollar amount, or --
// for the Yes/No/formula scalar rows, which have no amount -- the row's own
// rendered detail.
function headlineOf(row, feeRow) {
  if (feeRow && feeRow.amount) return String(feeRow.amount);
  return typeof row?.detail === 'string' && row.detail.trim() ? row.detail.trim() : null;
}

// Numeric equality is used ONLY when both sides are fee amounts ("$600,000,000"
// vs "$600,000,000.00" are the same money). It is deliberately NOT applied to
// scalar details: parseFeeAmountUsd() would read "12 months" and "12 days" as
// the same number 12 and report a false match.
function headlinesAgree(left, right, bothAreFeeAmounts) {
  if (left === null || right === null) return false;
  if (bothAreFeeAmounts) {
    const l = parseFeeAmountUsd(left);
    const r = parseFeeAmountUsd(right);
    if (l !== null && r !== null) return l === r;
  }
  return normalizedText(left) === normalizedText(right);
}

// A trigger is identified by its canonical code when it has one, and by its
// display name otherwise. BOTH keys are emitted so the two extractions'
// different vocabularies for the same ground still match: legacy's
// { code: 'SUPERIOR_PROPOSAL_TERMINATION', name: 'Superior proposal' } and
// canonical's same code under the name 'Company terminates to accept a superior
// proposal' share the code key and are correctly reported as the SAME trigger.
function triggerKeys(trigger) {
  const keys = [];
  const code = typeof trigger?.code === 'string' && trigger.code.trim() ? trigger.code.trim() : null;
  if (code) keys.push(`code:${code}`);
  const name = normalizedText(trigger?.name);
  if (name) keys.push(`name:${name}`);
  return keys;
}

function diffTriggers(leftTriggers, rightTriggers) {
  const right = (rightTriggers || []).map((trigger) => ({ trigger, keys: new Set(triggerKeys(trigger)), taken: false }));
  const onlyLeft = [];
  for (const trigger of leftTriggers || []) {
    const keys = triggerKeys(trigger);
    const hit = right.find((candidate) => !candidate.taken && keys.some((key) => candidate.keys.has(key)));
    if (hit) hit.taken = true;
    else onlyLeft.push(trigger);
  }
  return { onlyLeft, onlyRight: right.filter((candidate) => !candidate.taken).map((candidate) => candidate.trigger) };
}

/* The verdict. Constraint: a reader scanning the table must never have to
   compare two figures character by character to find out whether they agree --
   so the comparison is STATED, in words, and carries both figures with it.
   Colour reinforces but never carries the meaning alone.

     MATCH               emerald   both sources, same value, same triggers
     DIFFER              violet    both sources, genuinely different values
     V2_PARTIAL          amber     V2 has the row but says its own value is
                                   incomplete (coverageState PARTIAL_...)
     V2_NOT_YET_EXTRACTED amber    V1 has a value, V2 has not extracted this
     V1_ABSENT           sky       only V2 produced this surface
     NEITHER_SOURCE      amber     neither produced it (derived gap list)
     NO_VALUE            grey      both rows exist but neither carries a value

   V2_NOT_YET_EXTRACTED is the whole point of the ruling and is deliberately
   NOT the grey `missing` tone the established-absent "No" pill uses: grey says
   the extractor looked and found nothing. */
const COMPARISON_TONES = {
  MATCH: { tone: 'present' },
  DIFFER: { tone: 'neutral', color: 'violet' },
  V2_PARTIAL: { tone: 'warning' },
  V2_NOT_YET_EXTRACTED: { tone: 'warning' },
  V1_ABSENT: { tone: 'info' },
  NEITHER_SOURCE: { tone: 'warning' },
  NO_VALUE: { tone: 'missing' },
};

// Names the unmatched triggers, capped: the verdict is a headline, and the
// full lists are already on screen as that side's own pills.
function triggerNames(triggers) {
  const names = triggers.map((trigger) => trigger.name).filter(Boolean);
  if (names.length <= 3) return names.join(', ');
  return `${names.slice(0, 3).join(', ')} +${names.length - 3} more`;
}

function triggerDiffText(diff) {
  const parts = [];
  if (diff.onlyLeft.length) parts.push(`only V1: ${triggerNames(diff.onlyLeft)}`);
  if (diff.onlyRight.length) parts.push(`only V2: ${triggerNames(diff.onlyRight)}`);
  return parts.join('; ');
}

function comparisonFor({ v1Row, v2Row, v1Fee, v2Fee }) {
  if (!v1Row && !v2Row) {
    return { state: 'NEITHER_SOURCE', label: 'No value from either source', v1: null, v2: null };
  }
  const v1Headline = v1Row ? headlineOf(v1Row, v1Fee) : null;
  const v2Headline = v2Row ? headlineOf(v2Row, v2Fee) : null;
  if (!v2Row) {
    return {
      state: 'V2_NOT_YET_EXTRACTED',
      label: `${NOT_YET_EXTRACTED_DETAIL} in V2 — V1: ${v1Headline || 'no value'}`,
      v1: v1Headline,
      v2: null,
    };
  }
  if (!v1Row) {
    return {
      state: 'V1_ABSENT',
      label: `No V1 counterpart — V2: ${v2Headline || 'no value'}`,
      v1: null,
      v2: v2Headline,
    };
  }
  if (v1Headline === null && v2Headline === null) {
    return { state: 'NO_VALUE', label: 'Neither V1 nor V2 carries a value here', v1: null, v2: null };
  }
  const diff = diffTriggers(v1Fee?.triggers, v2Fee?.triggers);
  const triggersAgree = !diff.onlyLeft.length && !diff.onlyRight.length;
  const sameHeadline = headlinesAgree(v1Headline, v2Headline, Boolean(v1Fee?.amount && v2Fee?.amount));
  if (sameHeadline && triggersAgree) {
    return { state: 'MATCH', label: `V1 and V2 agree — ${v1Headline}`, v1: v1Headline, v2: v2Headline };
  }
  const detail = sameHeadline
    ? `same value (${v1Headline}), triggers differ — ${triggerDiffText(diff)}`
    : `V1: ${v1Headline || 'no value'} · V2: ${v2Headline || 'no value'}`;
  if (v2Row.coverageState === 'PARTIAL_NOT_YET_EXTRACTED') {
    // V2 has already said, on its own row, that this value is incomplete.
    // Calling that a disagreement would overstate it: an incomplete reading and
    // a complete one are not two competing findings.
    return { state: 'V2_PARTIAL', label: `V2 only partly extracted — ${detail}`, v1: v1Headline, v2: v2Headline };
  }
  return { state: 'DIFFER', label: `V1 and V2 differ — ${detail}`, v1: v1Headline, v2: v2Headline };
}

function comparisonSignal(row) {
  const comparison = row.sourceComparison;
  const style = COMPARISON_TONES[comparison.state] || COMPARISON_TONES.NO_VALUE;
  return {
    id: `${row.id}-source-comparison`,
    label: comparison.label,
    value: comparison.label,
    tone: style.tone,
    color: style.color,
    // The verdict names both figures, so it is legitimately long prose rather
    // than a short code -- it must wrap, not truncate to an ellipsis.
    wrap: true,
  };
}

function missingSourceSignals(rowId, sourceKey) {
  const detail = sourceKey === 'v2' ? NOT_YET_EXTRACTED_DETAIL : NOT_IN_V1_DETAIL;
  return [{
    id: `${rowId}-${sourceKey}-missing`,
    label: detail,
    value: detail,
    // Amber for V2 (we have not looked). Neutral, never the grey `missing`
    // tone, for V1: a surface V1 did not produce is not V1 establishing a
    // negative either.
    tone: sourceKey === 'v2' ? 'warning' : 'neutral',
  }];
}

function sourceView(row, rowId, sourceKey, feeRow) {
  if (!row) {
    return {
      label: sourceKey === 'v2' ? V2_COLUMN_HEADER : V1_COLUMN_HEADER,
      present: false,
      headline: null,
      detail: sourceKey === 'v2' ? NOT_YET_EXTRACTED_DETAIL : NOT_IN_V1_DETAIL,
      signals: missingSourceSignals(rowId, sourceKey),
    };
  }
  return {
    label: sourceKey === 'v2' ? V2_COLUMN_HEADER : V1_COLUMN_HEADER,
    present: true,
    headline: headlineOf(row, feeRow),
    detail: row.detail,
    // The side's OWN pills, untouched -- same labels, tones and evidence its
    // own single-source table renders.
    signals: (row.signals || []).map((signal) => ({ ...signal, id: `${sourceKey}-${signal.id}` })),
  };
}

function evidenceTextOf(row) {
  if (!row) return null;
  if (typeof row.evidence === 'string' && row.evidence.trim()) return row.evidence.trim();
  const card = row.sourceCard || row.card || null;
  return String(card?.primary_quote || card?.region_full_text || '').trim() || null;
}

// Two labelled quotes under one "See provision" expander. This is a
// presentational concatenation of two attributed texts, not a merged value:
// each block says which extraction it came from.
function bothSourcesEvidence(v1Row, v2Row) {
  const blocks = [];
  const v1Text = evidenceTextOf(v1Row);
  if (v1Text) blocks.push(`${V1_EVIDENCE_HEADING}\n${v1Text}`);
  const v2Text = evidenceTextOf(v2Row);
  if (v2Text) blocks.push(`${V2_EVIDENCE_HEADING}\n${v2Text}`);
  return blocks.join('\n\n') || null;
}

function bothSourcesRow({ rowId, v1Row, v2Row, v1Fee, v2Fee, base }) {
  const comparison = comparisonFor({ v1Row, v2Row, v1Fee, v2Fee });
  const v1 = sourceView(v1Row, rowId, 'v1', v1Fee);
  const v2 = sourceView(v2Row, rowId, 'v2', v2Fee);
  const row = {
    // `base` is ONE side's row, taken whole -- never a field-by-field blend of
    // the two. It supplies the scaffolding the table plumbing needs to be
    // single-valued (sourceCard for the ClauseSidebar drilldown, featureKeys /
    // marketProvisionCodes / marketSubterms for the market sidebar). V1 wins
    // when it has the row, because the corpus those market metrics are computed
    // against is the V1 extraction.
    ...base,
    id: rowId,
    label: base.label,
    // Never one side's value: a consumer reading row.detail in this mode gets
    // the comparison, with both figures attributed.
    detail: comparison.label,
    sourceComparison: comparison,
    sources: { v1, v2 },
    evidence: bothSourcesEvidence(v1Row, v2Row),
    // The stacked form, for any consumer rendering this config's static
    // two-column shape (CompareColumn.jsx's unified table reads config.columns
    // directly). Same three pieces the three-column form shows, in one cell,
    // with the source named on every pill so nothing is ever unattributed.
    signals: [
      comparisonSignal({ id: rowId, sourceComparison: comparison }),
      ...v1.signals.map((signal) => ({ ...signal, label: `V1 · ${signal.label}` })),
      ...v2.signals.map((signal) => ({ ...signal, label: `V2 · ${signal.label}` })),
    ],
  };
  if (!row.evidence) delete row.evidence;
  return row;
}

// Surfaces NEITHER source produced. Same derived gap list the canonical-only
// mode uses, and the same distinct `termination-fees-not-yet-extracted-` id
// prefix, so a placeholder can still never be mistaken for a market-bound row.
function neitherSourceRows(rows) {
  return notYetExtractedRows(rows).map((placeholder) => ({
    ...placeholder,
    detail: 'No value from either source',
    sourceComparison: { state: 'NEITHER_SOURCE', label: 'No value from either source', v1: null, v2: null },
    sources: {
      v1: sourceView(null, placeholder.id, 'v1', null),
      v2: sourceView(null, placeholder.id, 'v2', null),
    },
    signals: [
      comparisonSignal({ id: placeholder.id, sourceComparison: { state: 'NEITHER_SOURCE', label: 'No value from either source' } }),
      { ...missingSourceSignals(placeholder.id, 'v1')[0], label: `V1 · ${NOT_IN_V1_DETAIL}` },
      { ...missingSourceSignals(placeholder.id, 'v2')[0], label: `V2 · ${NOT_YET_EXTRACTED_DETAIL}` },
    ],
  }));
}

function bothSourcesRows(legacyCards, canonicalCards, dealValueUsd) {
  // Two independent builds. Neither card set is visible to the other.
  const v1Rows = legacyServedRows(legacyCards, dealValueUsd);
  const v2Rows = canonicalServedRows(canonicalCards, dealValueUsd);
  const v1ById = new Map(v1Rows.map((row) => [row.id, row]));
  const v2ById = new Map(v2Rows.map((row) => [row.id, row]));
  const v1Fees = feeRowsById(legacyCards);
  const v2Fees = feeRowsById(canonicalCards);

  // V1's order first -- it is the reader's familiar reading order and the only
  // side with full coverage today -- then V2-only surfaces, in V2's own order.
  const orderedIds = [...v1Rows.map((row) => row.id), ...v2Rows.map((row) => row.id).filter((id) => !v1ById.has(id))];

  const joined = orderedIds.map((rowId) => {
    const v1Row = v1ById.get(rowId) || null;
    const v2Row = v2ById.get(rowId) || null;
    return bothSourcesRow({
      rowId,
      v1Row,
      v2Row,
      v1Fee: v1Fees.get(rowId) || null,
      v2Fee: v2Fees.get(rowId) || null,
      base: v1Row || v2Row,
    });
  });

  return [servingSourceRow('BOTH_SOURCES'), ...joined, ...neitherSourceRows(joined)];
}

function isBothSourcesRowSet(rows) {
  return Array.isArray(rows) && rows.some((row) => row && row.servingSourceState === 'BOTH_SOURCES');
}

function renderBothSourcesTerm(row, ctx) {
  if (!row.sourceComparison) return row.label;
  const signal = comparisonSignal(row);
  const PillCell = ctx?.primitives?.PillCell;
  if (!PillCell) return `${row.label}\n${signal.label}`;
  return React.createElement(
    React.Fragment,
    null,
    React.createElement('div', { key: 'label' }, row.label),
    React.createElement(
      'div',
      { key: 'verdict', className: 'mt-1' },
      React.createElement(PillCell, {
        label: signal.label,
        value: signal.value,
        tone: signal.tone,
        color: signal.color,
        wrap: true,
      }),
    ),
  );
}

function renderSourceCell(row, sourceKey, ctx) {
  return renderPills(row?.sources?.[sourceKey]?.signals, ctx);
}

// One shared Term column, one answer column per SOURCE, answers aligned by row
// identity -- CompareColumn.jsx's unified-table model, applied to the two
// extractions of one deal instead of to two deals.
const BOTH_SOURCES_COLUMNS = [
  {
    id: 'term',
    header: 'Term',
    width: TERM_COL_WIDTH,
    maxWidth: TERM_COL_MAX,
    renderCell: renderBothSourcesTerm,
  },
  { id: 'source-v1', header: V1_COLUMN_HEADER, renderCell: (row, ctx) => renderSourceCell(row, 'v1', ctx) },
  { id: 'source-v2', header: V2_COLUMN_HEADER, renderCell: (row, ctx) => renderSourceCell(row, 'v2', ctx) },
];

// Punchlist #35: the "Detail" column (feeTableRows()' formatFeeDetail prose
// summary) was an unclear third copy of information the Signals column
// already carries as pills (amount, triggers) -- dropped as a rendered
// column. row.detail is still computed and kept on the row data (other
// call sites / tests read it directly), it just isn't given its own table
// column any more.
//
// `columns` stays the two-column shape in every mode; `columnsFor(rows)` is the
// row-dependent override ProvisionTable.jsx consults, and returns null (=
// "use `columns`") for every mode but both-sources. A consumer that reads
// `config.columns` directly rather than going through ProvisionTable --
// CompareColumn.jsx's unified table is the one that does -- therefore keeps
// working and still shows BOTH sources, stacked in the single Provision cell
// with `V1 ·`/`V2 ·` on every pill, because row.signals carries the same three
// pieces the three columns do. Loss is layout only, never attribution.
const terminationFeesConfig = {
  id: 'termination-fees',
  title: 'Termination Fees',
  layoutSlot: 'termination',
  selectRows(reviewDeal) {
    // r13: reviewDeal.value_usd is attached server-side by
    // lib/queries/review-deal.js#fetchDealValueUsd (deals.value_usd, the
    // deal's equity value at announcement) and survives the wire trim (see
    // lib/queries/review-deal-wire.js) — null when not on file, in which
    // case fee rows render exactly as they did before this feature.
    const dealValueUsd = reviewDeal && typeof reviewDeal.value_usd === 'number' && Number.isFinite(reviewDeal.value_usd)
      ? reviewDeal.value_usd
      : null;
    const { legacyCards, canonicalCards } = partitionTerminationFeeCards(reviewDeal);

    // Both-sources mode, and this deal HAS canonical data: each card set is
    // built into rows on its own, then the ROWS (never the cards) are joined by
    // row id so a reader can compare the two extractions of the same term
    // without leaving the page. Compare-on with no canonical data falls through
    // to the visible legacy fallback below -- there is no second source to show.
    if (isCanonicalTerminationFeeCompareEnabled(reviewDeal) && canonicalCards.length) {
      return bothSourcesRows(legacyCards, canonicalCards, dealValueUsd);
    }

    // Flag ON and this deal HAS canonical data: canonical is the only card set
    // the row builders see.
    if (isCanonicalTerminationFeeServingEnabled(reviewDeal) && canonicalCards.length) {
      return [servingSourceRow('CANONICAL'), ...canonicalRows(canonicalCards, dealValueUsd)];
    }

    // Flag OFF, or ON with no canonical data for this deal. Exactly the legacy
    // cards reach the row builders, and the output is byte-identical to the
    // pre-switch config for every input that isn't mixed — for an unmixed
    // input `legacyCards` IS `selectCards(reviewDeal, isTerminationFee)`. The
    // one input where behaviour differs is the mixed one, where the canonical
    // cards are DROPPED rather than merged: that merge is the hybrid-row
    // defect, and legacy is authoritative while the flag is off.
    //
    // The `!legacyCards.length && canonicalCards.length` case keeps the
    // pre-switch contract for a payload that carries canonical cards and no
    // legacy ones (how the projection parity suites drive this config): there
    // is no legacy source to be authoritative, nothing is mixed, and the cards
    // flow through exactly as they did before.
    const cards = legacyCards.length ? legacyCards : canonicalCards;
    if (!cards.length) return [];
    const rows = legacyServedRows(cards, dealValueUsd);
    // Flag on but no canonical rows reached the table: say so, and say
    // WHICH of the two reasons it is. Never render an empty table as though
    // the agreement were silent, and never claim "no data" for a deal whose
    // registered source merely failed to load or verify.
    if (isCanonicalTerminationFeeServingEnabled(reviewDeal)) {
      const sourceState = isCanonicalTerminationFeeSourceFailed(reviewDeal)
        ? 'LEGACY_FALLBACK_SOURCE_FAILED'
        : 'LEGACY_FALLBACK';
      return [servingSourceRow(sourceState), ...rows];
    }
    return rows;
  },
  fixedLayout: true,
  columns: [
    { id: 'term', header: 'Term', width: TERM_COL_WIDTH, maxWidth: TERM_COL_MAX, renderCell: (row) => row.label },
    { id: 'signals', header: 'Provision', renderCell: renderSignals },
  ],
  // Null for the three single-source modes -- ProvisionTable.jsx falls straight
  // back to `columns`, so their rendered table is untouched.
  columnsFor(rows) {
    return isBothSourcesRowSet(rows) ? BOTH_SOURCES_COLUMNS : null;
  },
};

export {
  BOTH_SOURCES_COLUMNS,
  CANONICAL_V2_TERMINATION_FEE_CARDS_FIELD,
  CANONICAL_V2_TERMINATION_FEE_COMPARE_FIELD,
  CANONICAL_V2_TERMINATION_FEE_SERVING_FIELD,
  CANONICAL_V2_TERMINATION_FEE_SOURCE_STATUS_FIELD,
  INTEREST_RATE_NOT_EXTRACTED,
  INTEREST_RATE_NOT_RESOLVED,
  NOT_IN_V1_DETAIL,
  NOT_YET_EXTRACTED_DETAIL,
  V1_COLUMN_HEADER,
  V2_COLUMN_HEADER,
  bothSourcesRows,
  combineTermfFeatures,
  dealPercentText,
  deferredEvidenceRows,
  feeAmountSignal,
  feeTableRows,
  formatFeeDetail,
  isCanonicalTerminationFeeCompareEnabled,
  isCanonicalTerminationFeeServingEnabled,
  isCanonicalTerminationFeeSourceFailed,
  isTerminationFee,
  parseFeeAmountUsd,
  partitionTerminationFeeCards,
  renderSignals,
  scalarRows,
  terminationFeesConfig,
};
