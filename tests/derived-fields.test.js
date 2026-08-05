'use strict';

// Regression coverage for the 2026-08-05 parseUsdAmount fix (was
// first-number-wins -- see the dated comment on parseUsdAmount in
// lib/query/derived-fields.js for the full defect writeup). This function
// backs feeDetails()/feePercentOfDealValue(), which power the LIVE
// feePctOfDealValue / reverseFeePctOfDealValue query fields (both the
// DERIVED_FIELDS path and executeMarketRange's amount_usd enrichment).
//
// The Modiv headline used below is the REAL committed conditional company
// termination fee, pinned byte-for-byte in
// tests/canonical-v2-termination-fee-conditional-amount-projection.test.js
// (COMPANY_FEE_HEADLINE) -- not a synthetic approximation.

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
// The reverse/parent fee headline for the same deal -- one dollar figure,
// but still names a second number (the "§7.3(c)" citation), so it is also
// not "one clean figure" by the same standard the company-side headline
// fails: a reader cannot programmatically tell a citation number from an
// amount without more structure than free text carries here.
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

test('parseUsdAmount: a single dollar figure alongside an unrelated citation number also returns null', () => {
  // "$15,000,000 (§7.3(c))" names two numbers (15000000 and 7.3) even though
  // only one is a dollar amount -- same "more than one figure" standard
  // numericValue() applies in lib/feature-compare.js, not a dollar-specific
  // carve-out. Documented here as a deliberate, conservative consequence of
  // following that established pattern rather than inventing a narrower
  // dollar-only counting rule.
  assert.equal(parseUsdAmount(MODIV_PARENT_FEE_HEADLINE), null);
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

test('feeDetails: Modiv-shaped reverse fee also resolves amount to null', () => {
  const provision = feeProvision({ reverseAmount: MODIV_PARENT_FEE_HEADLINE });
  assert.equal(feeDetails(provision, 'reverse').amount, null);
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

test('computeDerivedField: feePctOfDealValue / reverseFeePctOfDealValue both null out for the Modiv-shaped provision', () => {
  const provision = feeProvision({
    companyAmount: MODIV_COMPANY_FEE_HEADLINE,
    reverseAmount: MODIV_PARENT_FEE_HEADLINE,
  });
  const deal = { value_usd: 2000000000 };
  assert.equal(computeDerivedField('TERMINATION_FEE', 'feePctOfDealValue', provision, deal), null);
  assert.equal(computeDerivedField('TERMINATION_FEE', 'reverseFeePctOfDealValue', provision, deal), null);
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

test('executeMarketRange: raw feeAmount field query also nulls amount_usd for the Modiv-shaped provision, unchanged elsewhere', () => {
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
  // companyTerminationFee itself is a text/object field (not money-typed),
  // so BOTH deals still appear -- feeDetails() only degrades the enrichment
  // field amount_usd, it never removes the row.
  assert.equal(result.deal_points.length, 2);
  assert.equal(byDeal.get('clean-1').amount_usd, 30000000);
  assert.equal(byDeal.get('modiv-like').amount_usd, null);
});
