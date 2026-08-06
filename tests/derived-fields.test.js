'use strict';

// Regression coverage for the 2026-08-05 parseUsdAmount fix (was
// first-number-wins -- see the dated comment on parseUsdAmount in
// lib/query/derived-fields.js for the full defect writeup), and for the
// later-that-day consolidation onto lib/parse-money.js, the one shared
// implementation for what were six independent "parse a dollar amount"
// functions. This function backs feeDetails()/feePercentOfDealValue(),
// which power the LIVE feePctOfDealValue / reverseFeePctOfDealValue query
// fields (both the DERIVED_FIELDS path and executeMarketRange's amount_usd
// enrichment).
//
// The Modiv headlines used below are the REAL committed conditional
// termination fee amounts, pinned byte-for-byte in
// tests/canonical-v2-termination-fee-conditional-amount-projection.test.js
// (COMPANY_FEE_HEADLINE / PARENT_FEE_HEADLINE) -- not synthetic
// approximations. Both are sourced from the real committed fixture at
// tests/fixtures/review-parity/cases/termination-fees/dfaa71fa-modiv.resolution.json.

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DERIVED_FIELDS,
  computeDerivedField,
  feeDetails,
  feePercentOfDealValue,
  parseUsdAmount,
} = require('../lib/query/derived-fields');
const { executeMarketRange } = require('../lib/query/executors/market-range');

// The real Modiv Section 7.3/8.12 company termination fee headline -- see
// tests/canonical-v2-termination-fee-conditional-amount-projection.test.js's
// COMPANY_FEE_HEADLINE, produced by
// lib/canonical-v2/termination-product-projection.js from the actual
// resolution in
// evidence/canonical-v2/m3-pilot-20260804-fresh/final-output/execution-result.json.
const MODIV_COMPANY_FEE_HEADLINE = 'Lesser of $10,000,000 (§7.3(b)(i), (ii) or (iii)) or $15,000,000 (§7.3(b)(iv) or (v)) and the REIT Requirements cap';
// The reverse/parent fee headline for the same deal -- one dollar figure
// plus an unrelated section citation (the "§7.3(c)"), not a second dollar
// figure. lib/parse-money.js's ambiguity rule is dollar-sign-aware: it
// counts "$"-marked figures, not every bare numeral, so this string resolves
// to 15000000, not null (see that file's header "AMBIGUITY RULE" / "FINDING"
// notes for the full reasoning and the cross-surface inconsistency this
// closes -- the termination-fees review-page table already rendered this
// exact figure as "0.75% of deal value" via parseFeeAmountUsd before this
// file agreed with it).
const MODIV_PARENT_FEE_HEADLINE = 'Lesser of $15,000,000 (§7.3(c)) and the REIT Requirements cap';

function feature(value) {
  return { value, quotes: ['supporting quote'] };
}

function feeProvision({ id = 'p1', dealId = 'd1', companyAmount, reverseAmount, triggers } = {}) {
  const companyTerminationFee = companyAmount === undefined ? undefined : {
    amount: companyAmount,
    ...(triggers ? { triggers } : {}),
  };
  const reverseTerminationFee = reverseAmount === undefined ? undefined : { amount: reverseAmount };
  const features = {};
  if (companyTerminationFee) features.companyTerminationFee = companyTerminationFee;
  if (reverseTerminationFee) features.reverseTerminationFee = reverseTerminationFee;
  return {
    id,
    deal_id: dealId,
    type: 'TERMF',
    category: 'Termination fee',
    full_text: 'Company shall pay Parent a termination fee.',
    ai_metadata: { features },
  };
}

/* ─────────────────────────────────────────────────────────────────────────
   parseUsdAmount -- the unit itself
   ───────────────────────────────────────────────────────────────────────── */

test('parseUsdAmount: a single clean dollar figure still parses', () => {
  assert.equal(parseUsdAmount('$600,000,000'), 600000000);
  assert.equal(parseUsdAmount('600000000'), 600000000);
  assert.equal(parseUsdAmount('3.5'), 3.5);
  assert.equal(parseUsdAmount(600000000), 600000000);
});

test('parseUsdAmount: the real Modiv conditional headline returns null, not the first branch', () => {
  assert.equal(parseUsdAmount(MODIV_COMPANY_FEE_HEADLINE), null);
  // Sanity: confirm this isn't null merely because parsing failed outright --
  // the string demonstrably DOES contain "10,000,000" first, which the old
  // first-number-wins implementation would have returned.
  assert.match(MODIV_COMPANY_FEE_HEADLINE, /^Lesser of \$10,000,000/);
});

test('parseUsdAmount: a single dollar figure alongside an unrelated citation number resolves (dollar-sign-scoped ambiguity)', () => {
  // "$15,000,000 (§7.3(c))" names one dollar figure and one unrelated
  // citation number. This function used to count every bare numeral
  // (matching numericValue()'s rule) and return null here; consolidating
  // onto lib/parse-money.js's dollar-sign-aware rule resolves it to
  // 15000000 instead, matching parseFeeAmountUsd's (termination-
  // fees.config.js) already-shipped, already-tested behavior on this exact
  // real Modiv string. See lib/parse-money.js's header "FINDING" note: before
  // this change the review page and the query engine silently disagreed
  // about this deal's reverse fee.
  assert.equal(parseUsdAmount(MODIV_PARENT_FEE_HEADLINE), 15000000);
});

test('parseUsdAmount: a range returns null, not its first endpoint', () => {
  assert.equal(parseUsdAmount('30-45 days'), null);
  assert.equal(parseUsdAmount('2-3%'), null);
});

test('parseUsdAmount: non-numeric and empty inputs remain null, unchanged', () => {
  assert.equal(parseUsdAmount(null), null);
  assert.equal(parseUsdAmount(undefined), null);
  assert.equal(parseUsdAmount(''), null);
  assert.equal(parseUsdAmount('TBD'), null);
  assert.equal(parseUsdAmount(NaN), null);
});

/* ─────────────────────────────────────────────────────────────────────────
   feeDetails() -- the direct caller
   ───────────────────────────────────────────────────────────────────────── */

test('feeDetails: single clean figure still resolves amount correctly (company + reverse)', () => {
  const provision = feeProvision({ companyAmount: '$100,000,000', reverseAmount: '$150,000,000' });
  assert.equal(feeDetails(provision, 'company').amount, 100000000);
  assert.equal(feeDetails(provision, 'reverse').amount, 150000000);
});

test('feeDetails: Modiv-shaped conditional company fee resolves amount to null, not $10,000,000', () => {
  const provision = feeProvision({
    companyAmount: MODIV_COMPANY_FEE_HEADLINE,
    triggers: [{ code: 'SUPERIOR_PROPOSAL', label: 'Superior proposal', text: 'Company terminates for a Superior Proposal.' }],
  });
  const details = feeDetails(provision, 'company');
  assert.equal(details.amount, null);
  // Surgical fix: everything else feeDetails reports off the same card is
  // untouched -- the amount is the only field parseUsdAmount touches.
  assert.equal(details.amountRaw, MODIV_COMPANY_FEE_HEADLINE);
  assert.equal(details.triggers[0].label, 'Superior proposal');
});

test('feeDetails: Modiv-shaped reverse fee (single figure + citation) resolves amount to 15000000, not null', () => {
  const provision = feeProvision({ reverseAmount: MODIV_PARENT_FEE_HEADLINE });
  assert.equal(feeDetails(provision, 'reverse').amount, 15000000);
});

/* ─────────────────────────────────────────────────────────────────────────
   feePercentOfDealValue() / computeDerivedField() -- the query fields
   ───────────────────────────────────────────────────────────────────────── */

test('feePercentOfDealValue: single clean figure still computes a real percentage', () => {
  const provision = feeProvision({ companyAmount: '$100,000,000' });
  const result = feePercentOfDealValue(provision, { value_usd: 2000000000 }, 'company');
  assert.equal(result.value, 5);
});

test('feePercentOfDealValue: Modiv conditional fee skips the deal -- null, not a fabricated percentage off $10,000,000', () => {
  const provision = feeProvision({ companyAmount: MODIV_COMPANY_FEE_HEADLINE });
  const result = feePercentOfDealValue(provision, { value_usd: 2000000000 }, 'company');
  assert.equal(result, null);
  // Confirms this isn't accidentally null via missing deal value -- prove the
  // same deal value, fed a clean figure, DOES compute (would be 0.5%).
  const clean = feeProvision({ companyAmount: '$10,000,000' });
  assert.equal(feePercentOfDealValue(clean, { value_usd: 2000000000 }, 'company').value, 0.5);
});

test('computeDerivedField: feePctOfDealValue nulls out for the genuinely two-figure company headline; reverseFeePctOfDealValue resolves for the single-figure-plus-citation reverse headline', () => {
  const provision = feeProvision({
    companyAmount: MODIV_COMPANY_FEE_HEADLINE,
    reverseAmount: MODIV_PARENT_FEE_HEADLINE,
  });
  const deal = { value_usd: 2000000000 };
  // Company side genuinely names two different dollar figures ($10M or
  // $15M depending on branch) -- still null under any ambiguity rule.
  assert.equal(computeDerivedField('TERMINATION_FEE', 'feePctOfDealValue', provision, deal), null);
  // Reverse side names one dollar figure and one unrelated citation --
  // resolves to 15000000 / 2000000000 = 0.75%.
  assert.equal(computeDerivedField('TERMINATION_FEE', 'reverseFeePctOfDealValue', provision, deal).value, 0.75);
});

test('DERIVED_FIELDS registry entries are unchanged by the fix (key/label/type/provisionType)', () => {
  assert.equal(DERIVED_FIELDS.feePctOfDealValue.provisionType, 'TERMINATION_FEE');
  assert.equal(DERIVED_FIELDS.feePctOfDealValue.type, 'percentage');
  assert.equal(DERIVED_FIELDS.reverseFeePctOfDealValue.provisionType, 'TERMINATION_FEE');
  assert.equal(DERIVED_FIELDS.reverseFeePctOfDealValue.type, 'percentage');
});

/* ─────────────────────────────────────────────────────────────────────────
   executeMarketRange() -- the second live caller (direct feeDetails() import)
   ───────────────────────────────────────────────────────────────────────── */

test('executeMarketRange: a Modiv-shaped conditional fee is skipped from the comparison set, not published as $10,000,000 / a fabricated %', () => {
  const deals = [
    { id: 'clean-1', acquirer: 'Buyer One', target: 'Target One', value_usd: 1000000000 },
    { id: 'clean-2', acquirer: 'Buyer Two', target: 'Target Two', value_usd: 2000000000 },
    { id: 'modiv-like', acquirer: 'Modiv Buyer', target: 'Modiv Target', value_usd: 500000000 },
  ];
  const provisions = [
    feeProvision({ id: 'p1', dealId: 'clean-1', companyAmount: '$30,000,000' }), // 3%
    feeProvision({ id: 'p2', dealId: 'clean-2', companyAmount: '$60,000,000' }), // 3%
    feeProvision({ id: 'p3', dealId: 'modiv-like', companyAmount: MODIV_COMPANY_FEE_HEADLINE }),
  ];

  const result = executeMarketRange(
    { provision_type: 'TERMINATION_FEE', field_path: 'feePctOfDealValue', deal_filter: {} },
    { deals, provisions },
  );

  // The Modiv-shaped deal is skipped entirely (types.js#provisionFieldValue
  // returns { value: null }, and executeMarketRange's `if (result.value ===
  // null) continue;` guard drops it) -- not included with a null value, and
  // never included with $10,000,000 or a percentage computed off it.
  assert.equal(result.n, 2);
  assert.equal(result.deal_points.length, 2);
  assert.ok(result.deal_points.every((point) => point.deal_id !== 'modiv-like'));
  assert.deepEqual(result.deal_points.map((point) => point.value).sort(), [3, 3]);
});

test('executeMarketRange: companyTerminationFee is registered "usd"-typed, so a Modiv-shaped raw query is also excluded, not merely amount-nulled', () => {
  const deals = [
    { id: 'clean-1', acquirer: 'Buyer One', target: 'Target One', value_usd: 1000000000 },
    { id: 'modiv-like', acquirer: 'Modiv Buyer', target: 'Modiv Target', value_usd: 500000000 },
  ];
  const provisions = [
    feeProvision({ id: 'p1', dealId: 'clean-1', companyAmount: '$30,000,000' }),
    feeProvision({ id: 'p3', dealId: 'modiv-like', companyAmount: MODIV_COMPANY_FEE_HEADLINE }),
  ];
  const result = executeMarketRange(
    { provision_type: 'TERMINATION_FEE', field_path: 'companyTerminationFee', deal_filter: {} },
    { deals, provisions },
  );
  const byDeal = new Map(result.deal_points.map((point) => [point.deal_id, point]));
  // companyTerminationFee is registered "usd" in docs/schema-shape/
  // normalized-v1.json (lib/query/executors/market-range.js's own
  // isMoneyFieldType comment names it as the worked example), not a text/
  // object field -- so its raw value goes through the SAME numeric-typed
  // branch of valueFromRaw() (lib/query/types.js), which falls back to
  // amountObjectValue() to pull the amount out of the { amount, triggers[],
  // ... } shape and re-parses THAT through numericValue()
  // (lib/feature-compare.js) -- the same ambiguity-rejecting function
  // feeDetails()/parseUsdAmount() use. A Modiv-shaped raw amount is
  // therefore ambiguous at the level of provisionFieldValue()'s own
  // `result.value`, not only at feeDetails()'s enrichment layer -- so
  // executeMarketRange's `if (result.value === null) continue;` guard drops
  // the point entirely, exactly like the feePctOfDealValue test above. Only
  // the clean deal appears.
  assert.equal(result.deal_points.length, 1);
  assert.equal(byDeal.get('clean-1').amount_usd, 30000000);
  assert.ok(!byDeal.has('modiv-like'));
});

test('executeMarketRange: reverseFeePctOfDealValue includes the Modiv-shaped deal (single figure + citation resolves), still skips a genuinely two-figure deal', () => {
  // Three deals: a plain clean figure, the real Modiv-shaped reverse fee
  // (one dollar figure + an unrelated citation -- resolves), and a
  // genuinely two-branch conditional fee reused from the company side above
  // (two real dollar figures -- still excluded). Proves the dollar-sign-
  // scoped ambiguity rule is a targeted fix, not a blanket "include
  // everything" change.
  const deals = [
    { id: 'clean-1', acquirer: 'Buyer One', target: 'Target One', value_usd: 2000000000 },
    { id: 'modiv-like', acquirer: 'Modiv Buyer', target: 'Modiv Target', value_usd: 500000000 },
    { id: 'two-branch', acquirer: 'Two Branch Buyer', target: 'Two Branch Target', value_usd: 1000000000 },
  ];
  const provisions = [
    feeProvision({ id: 'p1', dealId: 'clean-1', reverseAmount: '$150,000,000' }), // 7.5%
    feeProvision({ id: 'p3', dealId: 'modiv-like', reverseAmount: MODIV_PARENT_FEE_HEADLINE }), // 15000000 / 500000000 = 3%
    feeProvision({ id: 'p4', dealId: 'two-branch', reverseAmount: MODIV_COMPANY_FEE_HEADLINE }), // genuinely 2 figures -> excluded
  ];
  const result = executeMarketRange(
    { provision_type: 'TERMINATION_FEE', field_path: 'reverseFeePctOfDealValue', deal_filter: {} },
    { deals, provisions },
  );
  // clean-1 and modiv-like both resolve; two-branch is still excluded --
  // never included with either $10,000,000/$15,000,000 branch or a
  // percentage computed off an arbitrary one of them.
  assert.equal(result.n, 2);
  assert.equal(result.deal_points.length, 2);
  assert.ok(result.deal_points.every((point) => point.deal_id !== 'two-branch'));
  const byDeal = new Map(result.deal_points.map((point) => [point.deal_id, point]));
  assert.equal(byDeal.get('clean-1').value, 7.5);
  assert.equal(byDeal.get('clean-1').amount_usd, 150000000);
  assert.equal(byDeal.get('modiv-like').value, 3);
  assert.equal(byDeal.get('modiv-like').amount_usd, 15000000);
});
