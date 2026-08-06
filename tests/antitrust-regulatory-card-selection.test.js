'use strict';

// WHICH CARDS THE ANTITRUST / REGULATORY TABLE IS ALLOWED TO READ.
//
// components/review/table-configs/antitrust-regulatory.config.js#isAntitrust
// selects a card three ways: the ANTITRUST_REGULATORY provision_type, an ANTI
// canonical code, or -- as a FALLBACK for a genuine antitrust card the
// classifier never subtyped -- a word regex (antitrust|regulatory|HSR|
// competition) over the card's title and quote.
//
// Run unguarded that fallback nets every card of every OTHER family whose
// clause merely MENTIONS one of those words, and that is common: a
// no-conflict / governmental-approvals representation routinely names the
// "Hart-Scott-Rodino Antitrust Improvements Act", and a Director & Officer
// indemnification covenant routinely lists "regulatory action" among the
// claim types it indemnifies. Once selected, such a card is folded into
// mappedAntitrustRows()'s card set, and any row builder whose firstFeature()
// lookup happens to match one of its features attributes that row's value
// AND evidence to a foreign clause.
//
// Every case below is REAL committed data: the production `provision_cards`
// export in tests/fixtures/canonical-v2/dno-fixtures, and the V1 snapshot of
// the real TopBuild deal in
// tests/fixtures/canonical-v2/v1v2-comparator/topbuild-v1-provision-snapshot.json.

const test = require('node:test');
const assert = require('node:assert/strict');

async function config() {
  return import('../components/review/table-configs/antitrust-regulatory.config.js');
}
async function cardUtils() {
  return import('../components/review/table-configs/card-utils.js');
}

// The predicate as it stood before the guard, so the tests below can state
// what the fallback USED to select rather than merely asserting the current
// answer.
function unguardedIsAntitrust(card) {
  const type = String(card?.provision_type || card?.type || '').trim().toUpperCase();
  const code = String(card?.provision_subtype || card?.canonical_code || card?.provision_code || card?.code || '').trim().toUpperCase();
  const text = `${card?.short_title || ''} ${String(card?.primary_quote || card?.region_full_text || '').trim()}`;
  return type === 'ANTITRUST_REGULATORY' || code.startsWith('ANTI') || /antitrust|regulatory|HSR|competition/i.test(text);
}

// ---------------------------------------------------------------------------
// Two real foreign cards, from committed production exports
// ---------------------------------------------------------------------------

// TopBuild's own No Violations / Governmental Filings representation names
// the Hart-Scott-Rodino ANTITRUST Improvements Act while describing consents
// required for closing -- nothing to do with this table's antitrust-strategy
// concepts (efforts standard, burden cap, HSR deadline, ...).
const TOPBUILD_SNAPSHOT = require('./fixtures/canonical-v2/v1v2-comparator/topbuild-v1-provision-snapshot.json');

function realNoConflictRepCard() {
  const card = TOPBUILD_SNAPSHOT.cards.find((entry) => entry.id === '72463ecc-a135-4235-bbf3-27b37da9e364');
  assert.ok(card, 'the committed TopBuild REP-T-NOCONFLICT card must be present');
  assert.equal(TOPBUILD_SNAPSHOT.schema_version, 'V1_PROVISION_SNAPSHOT/V1');
  assert.equal(card.provision_type, 'REPRESENTATION');
  assert.equal(card.provision_subtype, 'REP-T-NOCONFLICT');
  assert.match(card.primary_quote, /Hart-Scott-Rodino Antitrust Improvements Act/);
  return card;
}

// A Director & Officer indemnification covenant: the indemnified claim types
// it lists include "a formal civil or criminal litigation or REGULATORY
// action" -- a plain English use of "regulatory" that has nothing to do with
// antitrust clearance strategy.
const DNO_CORPUS = require('./fixtures/canonical-v2/dno-fixtures/corpus-cards.json');

function realDoCovenantCard() {
  const card = DNO_CORPUS.cards.find((entry) => entry.id === '219a2167-d344-4a91-99c3-060f6efb7ba1');
  assert.ok(card, 'the committed DNO COV-DO card must be present');
  assert.equal(DNO_CORPUS.source_table, 'provision_cards');
  assert.equal(card.provision_type, 'COVENANT_OTHER');
  assert.equal(card.provision_subtype, 'COV-DO');
  // This export carries the quote on region_full_text, not primary_quote --
  // textOf() in card-utils.js (and therefore isAntitrust()) already falls
  // back to it; this assertion just proves the real text is what it claims.
  assert.match(card.region_full_text, /regulatory action/i);
  return card;
}

// ---------------------------------------------------------------------------
// A foreign card must never be selected by the antitrust-word fallback
// ---------------------------------------------------------------------------

test('a real no-conflict representation citing the Hart-Scott-Rodino Antitrust Improvements Act stays out of the antitrust table', async () => {
  const mod = await config();
  const card = realNoConflictRepCard();
  // The committed corpus proves this is not hypothetical: the unguarded
  // fallback selected a production representation card into the antitrust
  // table purely because it names the HSR Act while listing consents.
  assert.equal(unguardedIsAntitrust(card), true);
  assert.equal(mod.isAntitrust(card), false);
});

test('a real Director & Officer indemnification covenant mentioning "regulatory action" stays out of the antitrust table', async () => {
  const mod = await config();
  const card = realDoCovenantCard();
  assert.equal(unguardedIsAntitrust(card), true);
  assert.equal(mod.isAntitrust(card), false);
});

test('no card in any committed fixture export is selected by the fallback alone', async () => {
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
      const byFamily = String(card.provision_type || '').toUpperCase() === 'ANTITRUST_REGULATORY'
        || String(card.provision_subtype || '').toUpperCase().startsWith('ANTI');
      if (!byFamily && mod.isAntitrust(card)) leaked.push(`${card.id}:${card.provision_type}/${card.provision_subtype}`);
    }
  }
  // The whole committed real-card universe: 8 production corpus-cards.json
  // exports plus 3 real-deal V1 provision snapshots (TopBuild, Skechers,
  // Modiv) -- 241 cards at the time this test was written.
  assert.ok(scanned > 200, 'the committed real-card fixtures must actually be scanned');
  assert.deepEqual(leaked, []);
});

// ---------------------------------------------------------------------------
// The fallback still does the one job it exists for
// ---------------------------------------------------------------------------

test('a genuine antitrust card the classifier never subtyped is still caught by the fallback', async () => {
  const mod = await config();
  const unclassified = {
    id: 'fragment-6-2',
    // No provision_type and no subtype -- the classifier never placed it.
    // This is the ONLY case the antitrust-word fallback exists for.
    short_title: '[PROPOSED] Section 6.2',
    primary_quote: 'Each party shall use reasonable best efforts to obtain clearance under applicable antitrust laws and to make all filings required by the HSR Act.',
  };
  assert.equal(mod.isAntitrust(unclassified), true);
});

test('the fallback survives every shape that carries no other family claim', async () => {
  const mod = await config();
  const caught = [
    { short_title: 'Regulatory Cooperation', primary_quote: 'the parties shall cooperate in good faith with any Governmental Authority in connection with the antitrust review of the transaction.' },
    { short_title: null, primary_quote: 'the parties shall use reasonable best efforts to resolve any competition concerns raised by a Governmental Authority.' },
    // An antitrust-family provision_type with no subtype yet is this family's
    // own, so the guard leaves the fallback available to it. `type: 'ANTI'`
    // is the spelling canonical cards carry alongside provision_type
    // (lib/canonical-v2/antitrust-product-projection.js).
    { provision_type: 'ANTITRUST_REGULATORY', provision_subtype: null, primary_quote: 'no antitrust words here at all.' },
    { type: 'ANTI', provision_subtype: null, primary_quote: 'the parties shall make all HSR filings promptly.' },
  ];
  for (const card of caught) assert.equal(mod.isAntitrust(card), true, JSON.stringify(card));

  const rejected = [
    // Claimed by another family by type -- the two REAL cards proven above.
    realNoConflictRepCard(),
    realDoCovenantCard(),
    // Claimed by type, synthetic shapes for the remaining families.
    { provision_type: 'COVENANT_NO_SOLICITATION', primary_quote: 'and shall not solicit a competing Acquisition Proposal.' },
    { provision_type: 'TERMINATION_RIGHT', provision_subtype: 'TERMR-SUPERIOR', primary_quote: 'terminate to accept a Superior Proposal following a HSR-cleared competing bid.' },
    // ...or by code alone, with no type at all.
    { provision_subtype: 'NOSOL-PROHIBIT', primary_quote: 'and shall not facilitate a competing regulatory filing.' },
    { canonical_code: 'COND-M-STOCKHOLDER', primary_quote: 'antitrust clearance shall have been obtained.' },
    // Nothing that mentions antitrust words, with no antitrust words, was
    // ever caught.
    { primary_quote: 'The Company shall hold a stockholders meeting.' },
  ];
  for (const card of rejected) assert.equal(mod.isAntitrust(card), false, JSON.stringify(card));
});

// ---------------------------------------------------------------------------
// The real integration point every consumer uses
// ---------------------------------------------------------------------------

test('selectCards(reviewDeal, isAntitrust) excludes the two real foreign cards from a mixed deal', async () => {
  const mod = await config();
  const { selectCards } = await cardUtils();
  const genuine = {
    id: 'fragment-6-2',
    short_title: '[PROPOSED] Section 6.2',
    primary_quote: 'Each party shall use reasonable best efforts to obtain antitrust clearance.',
  };
  const reviewDeal = { cards: [realNoConflictRepCard(), realDoCovenantCard(), genuine] };
  const selected = selectCards(reviewDeal, mod.isAntitrust);
  assert.deepEqual(selected.map((card) => card.id), ['fragment-6-2']);
});
