'use strict';

// WHICH CARDS THE ADVISERS / FEES / EXPENSES TABLE IS ALLOWED TO READ.
//
// components/review/table-configs/advisers-fees-expenses.config.js#isAdvisersFeesCard
// selects a card two ways: the MISC_BOILERPLATE provision_type / a MISC
// canonical code, or -- as a FALLBACK for a genuine adviser/fee/expense card
// the classifier never subtyped -- a word regex (fees | expenses | adviser |
// advisor | broker) over the card's title and quote.
//
// Run unguarded that fallback nets every card of every OTHER family whose
// clause happens to use one of these very ordinary words: a D&O
// indemnification covenant routinely promises "advancement of expenses", a
// financing representation names the "financial advisor" and "fees" of the
// debt commitment letters, a fairness-opinion rep names the company's
// financial advisor, and a no-brokers representation is entirely about
// "broker[s]" -- none of which is this table's own card.
//
// Every case below is REAL committed data: the production `provision_cards`
// exports in tests/fixtures/canonical-v2/dno-fixtures and
// .../financing-covenants-fixtures, and the V1 snapshot of the real Skechers
// deal in tests/fixtures/canonical-v2/v1v2-comparator/
// skechers-v1-provision-snapshot.json.

const test = require('node:test');
const assert = require('node:assert/strict');

async function config() {
  return import('../components/review/table-configs/advisers-fees-expenses.config.js');
}
async function cardUtils() {
  return import('../components/review/table-configs/card-utils.js');
}

// The predicate as it stood before the guard, so the tests below can state
// what the fallback USED to select rather than merely asserting the current
// answer.
function unguardedIsAdvisersFeesCard(card) {
  const type = String(card?.provision_type || card?.type || '').trim().toUpperCase();
  const code = String(card?.provision_subtype || card?.canonical_code || card?.provision_code || card?.code || '').trim().toUpperCase();
  const text = `${card?.short_title || ''} ${String(card?.primary_quote || card?.region_full_text || '').trim()}`;
  return type === 'MISC_BOILERPLATE' || code.startsWith('MISC') || /fees|expenses|adviser|advisor|broker/i.test(text);
}

// ---------------------------------------------------------------------------
// Three real foreign cards, from committed production exports
// ---------------------------------------------------------------------------

// A Director & Officer indemnification covenant promising "advancement of
// expenses" to indemnified officers/directors -- ordinary D&O drafting,
// nothing to do with this table's own fee/expense-allocation row (which
// reads the deal-wide feeExpenseAllocation/expensesAllocation features).
const DNO_CORPUS = require('./fixtures/canonical-v2/dno-fixtures/corpus-cards.json');

function realDoCovenantCard() {
  const card = DNO_CORPUS.cards.find((entry) => entry.id === '0f6fce9e-8ae9-49fa-aaa2-879e214185bb');
  assert.ok(card, 'the committed DNO COV-DO card must be present');
  assert.equal(DNO_CORPUS.source_table, 'provision_cards');
  assert.equal(card.provision_type, 'COVENANT_OTHER');
  assert.equal(card.provision_subtype, 'COV-DO');
  assert.match(card.region_full_text, /advancement of expenses/i);
  return card;
}

// A buyer financing representation naming the "fees" of the Debt Commitment
// Letter -- the same class of card termination-fees.config.js's own guard
// keeps out (there, for quoting "the Parent Termination Fee"); here it
// leaks in because the clause separately discusses financing fees.
const FINANCING_CORPUS = require('./fixtures/canonical-v2/financing-covenants-fixtures/corpus-cards.json');

function realFinancingRepCard() {
  const card = FINANCING_CORPUS.cards.find((entry) => entry.id === 'dd37da8c-30e2-4053-a0da-987e02120a40');
  assert.ok(card, 'the committed REP-B-FUNDS corpus card must be present');
  assert.equal(FINANCING_CORPUS.source_table, 'provision_cards');
  assert.equal(card.provision_type, 'REPRESENTATION');
  assert.equal(card.provision_subtype, 'REP-B-FUNDS');
  assert.match(card.region_full_text, /fees/i);
  return card;
}

// Skechers' own no-brokers representation: "there is no financial advisor,
// investment banker, broker, finder..." -- the exact words this table's OWN
// "Financial advisor" row (buildFinancialAdvisorRow) is looking for, on a
// representation that exists to say the opposite (no broker was retained).
const SKECHERS_SNAPSHOT = require('./fixtures/canonical-v2/v1v2-comparator/skechers-v1-provision-snapshot.json');

function realNoBrokersRepCard() {
  const card = SKECHERS_SNAPSHOT.cards.find((entry) => entry.id === '5841a3f6-faa4-4e48-b4de-3998d7313d69');
  assert.ok(card, 'the committed Skechers REP-T-BROKERS card must be present');
  assert.equal(SKECHERS_SNAPSHOT.schema_version, 'V1_PROVISION_SNAPSHOT/V1');
  assert.equal(card.provision_type, 'REPRESENTATION');
  assert.equal(card.provision_subtype, 'REP-T-BROKERS');
  assert.match(card.primary_quote, /financial advisor/i);
  return card;
}

// ---------------------------------------------------------------------------
// A foreign card must never be selected by the fee/adviser-word fallback
// ---------------------------------------------------------------------------

test('a real D&O covenant promising "advancement of expenses" stays out of the advisers/fees table', async () => {
  const mod = await config();
  const card = realDoCovenantCard();
  assert.equal(unguardedIsAdvisersFeesCard(card), true);
  assert.equal(mod.isAdvisersFeesCard(card), false);
});

test('a real financing representation naming Debt Commitment Letter "fees" stays out of the advisers/fees table', async () => {
  const mod = await config();
  const card = realFinancingRepCard();
  assert.equal(unguardedIsAdvisersFeesCard(card), true);
  assert.equal(mod.isAdvisersFeesCard(card), false);
});

test('a real no-brokers representation naming "financial advisor" stays out of the advisers/fees table', async () => {
  const mod = await config();
  const card = realNoBrokersRepCard();
  assert.equal(unguardedIsAdvisersFeesCard(card), true);
  assert.equal(mod.isAdvisersFeesCard(card), false);
});

test('no card in any committed real-deal fixture export is selected by the fallback alone', async () => {
  const mod = await config();
  const exports_ = [
    'appraisal-fixtures', 'dividends-fixtures', 'dno-fixtures', 'employee-matters-fixtures',
    'financing-covenants-fixtures', 'guaranty-fixtures', 'm3-v31-fixtures', 'tax-matters-fixtures',
  ].map((name) => require(`./fixtures/canonical-v2/${name}/corpus-cards.json`))
    .concat([
      'v1v2-comparator/topbuild-v1-provision-snapshot.json',
      'v1v2-comparator/skechers-v1-provision-snapshot.json',
      'v1v2-comparator/modiv-v1-provision-snapshot.json',
    ].map((name) => require(`./fixtures/canonical-v2/${name}`)));
  let scanned = 0;
  const leaked = [];
  for (const corpus of exports_) {
    for (const card of corpus.cards) {
      scanned += 1;
      const byFamily = String(card.provision_type || '').toUpperCase() === 'MISC_BOILERPLATE'
        || String(card.provision_subtype || '').toUpperCase().startsWith('MISC');
      if (!byFamily && mod.isAdvisersFeesCard(card)) leaked.push(`${card.id}:${card.provision_type}/${card.provision_subtype}`);
    }
  }
  // The whole committed real-deal-card universe: 8 production
  // corpus-cards.json exports plus 3 real-deal V1 provision snapshots
  // (TopBuild, Skechers, Modiv) -- 241 cards, of which 62 leaked (across 15
  // distinct foreign type/code combinations -- COV-DO, COV-EMPLOYEE,
  // COV-FINANCING, COV-PAYOFF, REP-B-FUNDS, REP-T-FAIRNESS, REP-B-FAIRNESS,
  // REP-T-BROKERS, REP-B-BROKERS, REP-B-SOLVENCY, REP-T-NOREP,
  // REP-T-MATERIAL-CONTRACTS, REP-T-SANCTIONS, REP-T-BENEFITS, and one
  // codeless COVENANT_OTHER) before this guard, measured empirically when
  // this test was written.
  assert.ok(scanned > 200, 'the committed real-deal fixtures must actually be scanned');
  assert.deepEqual(leaked, []);
});

// ---------------------------------------------------------------------------
// The fallback still does the one job it exists for
// ---------------------------------------------------------------------------

test('a genuine fee/expense card the classifier never subtyped is still caught by the fallback', async () => {
  const mod = await config();
  const unclassified = {
    id: 'fragment-8-2',
    // No provision_type and no subtype -- the classifier never placed it.
    // This is the ONLY case the fee/adviser-word fallback exists for.
    short_title: '[PROPOSED] Section 8.2',
    primary_quote: 'Fees and Expenses. Except as otherwise set forth in this Agreement, all fees and expenses incurred in connection with this Agreement shall be paid by the party incurring such fees and expenses.',
    features: { feeExpenseAllocation: 'Each party bears its own fees and expenses.' },
  };
  assert.equal(mod.isAdvisersFeesCard(unclassified), true);

  // And it reaches the rendered table as a real allocation row.
  const rows = mod.advisersFeesExpensesConfig.selectRows({ cards: [unclassified] });
  const row = rows.find((entry) => entry.id === 'advisers-fees-expenses-fee-expense' || entry.id === 'advisers-fees-expenses-expense-exceptions');
  assert.ok(row, 'a subtype-less fee/expense card must still produce its allocation row');
});

test('the fallback survives every shape that carries no other family claim', async () => {
  const mod = await config();
  const caught = [
    { short_title: 'Fees and Expenses', primary_quote: 'each party shall bear its own fees and expenses incurred in connection with this Agreement.' },
    { short_title: null, primary_quote: 'the Company shall retain a financial advisor to render a fairness opinion.' },
    { short_title: 'Brokers', primary_quote: 'neither party has incurred any liability for broker or finder fees.' },
    // A misc-family provision_type with no subtype yet is this family's own,
    // so the guard leaves the fallback available to it.
    { provision_type: 'MISC_BOILERPLATE', provision_subtype: null, primary_quote: 'no fee/adviser words here at all.' },
    { type: 'MISC', provision_subtype: null, primary_quote: 'the advisor fees shall be paid by the Company.' },
  ];
  for (const card of caught) assert.equal(mod.isAdvisersFeesCard(card), true, JSON.stringify(card));

  const rejected = [
    // Claimed by another family by type -- the three REAL cards proven above.
    realDoCovenantCard(),
    realFinancingRepCard(),
    realNoBrokersRepCard(),
    // Claimed by type, synthetic shapes for the remaining families.
    { provision_type: 'TERMINATION_RIGHT', primary_quote: 'terminate to accept a Superior Proposal, subject to payment of Parent\'s advisor fees.' },
    { provision_type: 'MAE', primary_quote: 'excluding fees and expenses incurred in connection with the Merger.' },
    // ...or by code alone, with no type at all.
    { provision_subtype: 'TERMF-EXPENSE', primary_quote: 'Parent shall reimburse the Company\'s expenses up to $10,000,000.' },
    { canonical_code: 'REP-T-BROKERS', primary_quote: 'no broker is entitled to any fee in connection with this Agreement.' },
    // Nothing that mentions fees/advisers, with no such words, was ever caught.
    { primary_quote: 'The Company shall hold a stockholders meeting.' },
  ];
  for (const card of rejected) assert.equal(mod.isAdvisersFeesCard(card), false, JSON.stringify(card));
});

// ---------------------------------------------------------------------------
// The real integration point every consumer uses
// ---------------------------------------------------------------------------

test('selectCards(reviewDeal, isAdvisersFeesCard) excludes the three real foreign cards from a mixed deal', async () => {
  const mod = await config();
  const { selectCards } = await cardUtils();
  const genuine = {
    id: 'fragment-8-2',
    short_title: '[PROPOSED] Section 8.2',
    primary_quote: 'Fees and Expenses. Each party shall bear its own fees and expenses.',
  };
  const reviewDeal = { cards: [realDoCovenantCard(), realFinancingRepCard(), realNoBrokersRepCard(), genuine] };
  const selected = selectCards(reviewDeal, mod.isAdvisersFeesCard);
  assert.deepEqual(selected.map((card) => card.id), ['fragment-8-2']);
});

// misc-boilerplate.config.js's buildFeeExpenseRow() reuses isAdvisersFeesCard
// directly against the WHOLE deal's card list (not just this table's own
// selectRows) to build its folded-in "Fee / expense allocation" row -- so the
// guard has to hold there too, not only inside this file's own selectRows.
test('misc-boilerplate.config.js\'s folded-in fee/expense row also excludes the real foreign cards', async () => {
  const mod = await config();
  const misc = await import('../components/review/table-configs/misc-boilerplate.config.js');
  const genuine = {
    id: 'fragment-8-2',
    short_title: '[PROPOSED] Section 8.2',
    primary_quote: 'Fees and Expenses. Except as set forth in Section 6.02, each party shall bear its own fees and expenses.',
    features: { feeExpenseAllocation: 'Except as set forth in Section 6.02, each party bears its own fees and expenses.' },
  };
  const reviewDeal = { cards: [realDoCovenantCard(), realFinancingRepCard(), realNoBrokersRepCard(), genuine] };
  const rows = misc.miscBoilerplateConfig.selectRows(reviewDeal);
  const feeRow = rows.find((row) => row.id === 'misc-boilerplate-fee-expense');
  assert.ok(feeRow, 'the folded-in fee/expense row must still be produced from the genuine card');
  assert.equal(feeRow.sourceCard.id, 'fragment-8-2');
});
