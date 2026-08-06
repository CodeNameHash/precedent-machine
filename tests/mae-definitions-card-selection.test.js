'use strict';

// WHICH CARDS THE MATERIAL ADVERSE EFFECT TABLE IS ALLOWED TO READ.
//
// components/review/table-configs/mae-definitions.config.js#isMae selects a
// card three ways: the MAE provision_type, a canonical code containing "MAE",
// or -- as a FALLBACK for a genuine MAE card the classifier never subtyped --
// a phrase regex ("material adverse effect" / the word "MAE") over the
// card's title, defined term, and quote.
//
// Run unguarded that fallback is the LEAKIEST of the three fixed today: "would
// not reasonably be expected to have a Material Adverse Effect" is the
// standard materiality qualifier bolted onto almost every representation in a
// merger agreement (organization, tax, environmental, real property,
// insurance, labor, ...), and it shows up in covenants and closing
// conditions too. Once such a card is selected, mappedMaeRows() folds it into
// the same card set firstFeature() reads for the MAE Test / carve-outs rows.
//
// Every case below is REAL committed data: V1 snapshots of three real
// production deals (Skechers, TopBuild, Modiv) in
// tests/fixtures/canonical-v2/v1v2-comparator/, and the production
// `provision_cards` exports in tests/fixtures/canonical-v2/
// financing-covenants-fixtures and guaranty-fixtures.

const test = require('node:test');
const assert = require('node:assert/strict');

async function config() {
  return import('../components/review/table-configs/mae-definitions.config.js');
}
async function cardUtils() {
  return import('../components/review/table-configs/card-utils.js');
}

// The predicate as it stood before the guard, so the tests below can state
// what the fallback USED to select rather than merely asserting the current
// answer.
function unguardedIsMae(card) {
  const type = String(card?.provision_type || card?.type || '').trim().toUpperCase();
  const code = String(card?.provision_subtype || card?.canonical_code || card?.provision_code || card?.code || '').trim().toUpperCase();
  const text = `${card?.short_title || ''} ${card?.defined_term || ''} ${String(card?.primary_quote || card?.region_full_text || '').trim()}`;
  return type === 'MAE' || code.includes('MAE') || /material adverse effect|\bMAE\b/i.test(text);
}

// ---------------------------------------------------------------------------
// Two real foreign cards, from committed production exports
// ---------------------------------------------------------------------------

// Skechers' own Tax Matters representation qualifies almost every sentence
// with "except as would not have a Company Material Adverse Effect" -- the
// MAE definition's own name, quoted as a materiality qualifier on a totally
// different representation.
const SKECHERS_SNAPSHOT = require('./fixtures/canonical-v2/v1v2-comparator/skechers-v1-provision-snapshot.json');

function realTaxRepCard() {
  const card = SKECHERS_SNAPSHOT.cards.find((entry) => entry.id === '4e34cd94-2a38-478a-a805-894e6940ae40');
  assert.ok(card, 'the committed Skechers REP-T-TAX card must be present');
  assert.equal(SKECHERS_SNAPSHOT.schema_version, 'V1_PROVISION_SNAPSHOT/V1');
  assert.equal(card.provision_type, 'REPRESENTATION');
  assert.equal(card.provision_subtype, 'REP-T-TAX');
  assert.match(card.primary_quote, /Company Material Adverse Effect/);
  return card;
}

// A financing covenant: a delay to the Financing that "would reasonably be
// expected to ... have a Parent Material Adverse Effect" is one of several
// triggers described -- the MAE concept used as a materiality threshold
// inside financing-cooperation mechanics, not the definition itself.
const FINANCING_CORPUS = require('./fixtures/canonical-v2/financing-covenants-fixtures/corpus-cards.json');

function realFinancingCovenantCard() {
  const card = FINANCING_CORPUS.cards.find((entry) => entry.id === '7774a568-5268-4ee4-aa08-f2b3909516e1');
  assert.ok(card, 'the committed financing-covenants COV-FINANCING card must be present');
  assert.equal(FINANCING_CORPUS.source_table, 'provision_cards');
  assert.equal(card.provision_type, 'COVENANT_OTHER');
  assert.equal(card.provision_subtype, 'COV-FINANCING');
  assert.match(card.region_full_text || card.primary_quote, /Parent Material Adverse Effect/);
  return card;
}

// ---------------------------------------------------------------------------
// A foreign card must never be selected by the MAE-phrase fallback
// ---------------------------------------------------------------------------

test('a real Tax Matters representation quoting "Company Material Adverse Effect" stays out of the MAE table', async () => {
  const mod = await config();
  const card = realTaxRepCard();
  assert.equal(unguardedIsMae(card), true);
  assert.equal(mod.isMae(card), false);
});

test('a real financing covenant quoting "Parent Material Adverse Effect" stays out of the MAE table', async () => {
  const mod = await config();
  const card = realFinancingCovenantCard();
  assert.equal(unguardedIsMae(card), true);
  assert.equal(mod.isMae(card), false);
});

// ---------------------------------------------------------------------------
// A DEFINITION-typed card is a different family, even when its own content
// IS an MAE definition -- a deliberate judgment call, pinned so it cannot
// silently flip either way later.
// ---------------------------------------------------------------------------

test('a DEFINITION-typed card whose own text IS the MAE definition still stays out, because DEFINITION is a real, distinct family', async () => {
  const mod = await config();
  // A real fixture card (from the dark-bridge / legacy-card-bridge test
  // suite's own data, not a synthetic built for this test): provision_type
  // 'DEFINITION', no subtype, short_title AND defined_term both literally
  // "Company Material Adverse Effect", and a quote that IS the definition.
  const darkBridge = require('./fixtures/canonical-v2/dark-bridge/general-covenants-dark-review.json');
  const legacyMaeDefinition = darkBridge.legacy_cards.find((entry) => entry.id === 'legacy-definition-mae');
  assert.ok(legacyMaeDefinition, 'the committed legacy-definition-mae dark-bridge card must be present');
  assert.equal(legacyMaeDefinition.provision_type, 'DEFINITION');
  assert.equal(legacyMaeDefinition.provision_subtype, undefined);
  assert.equal(legacyMaeDefinition.short_title, 'Company Material Adverse Effect');

  // Unguarded, this was selected -- its own name matches the phrase fallback
  // trivially.
  assert.equal(unguardedIsMae(legacyMaeDefinition), true);

  // Guarded, it is excluded, and deliberately so: card-model.js's
  // PROVISION_CARD_TYPES lists 'DEFINITION' and 'MAE' as two SEPARATE
  // provision types (the schema was designed so a generic defined-term card
  // and an MAE-definition card are distinguishable), and the canonical V2
  // projection that emits real DEF-MAE cards stamps them 'MAE_DEFINITION'/
  // 'MAE', never bare 'DEFINITION' (lib/canonical-v2/
  // key-terms-mae-product-projection.js). Treating EVERY 'DEFINITION'-typed
  // card as fair game for this table's fallback would reopen exactly the
  // leak this guard exists to close -- a "Superior Proposal" or "Intervening
  // Event" definition that merely cross-references the MAE concept in a
  // subordinate clause would leak in on the same reasoning as this card. A
  // legacy 'DEFINITION' card that genuinely IS the MAE definition has its
  // own dedicated promotion path -- lib/canonical-v2/legacy-card-bridge.js /
  // content-reviewed-definition-reclassification-contract.js -- which is
  // where it should be reclassified to DEF-MAE, not this review table's
  // phrase fallback.
  assert.equal(mod.isMae(legacyMaeDefinition), false);
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
      const byFamily = String(card.provision_type || '').toUpperCase() === 'MAE'
        || String(card.provision_subtype || '').toUpperCase().includes('MAE');
      if (!byFamily && mod.isMae(card)) leaked.push(`${card.id}:${card.provision_type}/${card.provision_subtype}`);
    }
  }
  // The whole committed real-deal-card universe: 8 production
  // corpus-cards.json exports plus 3 real-deal V1 provision snapshots
  // (TopBuild, Skechers, Modiv) -- 241 cards at the time this test was
  // written. (This sweep deliberately excludes the synthetic dark-bridge
  // fixtures -- see the DEFINITION-typed test above, which covers those
  // directly by id.)
  assert.ok(scanned > 200, 'the committed real-deal fixtures must actually be scanned');
  assert.deepEqual(leaked, []);
});

// ---------------------------------------------------------------------------
// The fallback still does the one job it exists for
// ---------------------------------------------------------------------------

test('a genuine MAE card the classifier never subtyped is still caught by the fallback', async () => {
  const mod = await config();
  const unclassified = {
    id: 'fragment-1-1',
    // No provision_type and no subtype -- the classifier never placed it.
    // This is the ONLY case the MAE-phrase fallback exists for.
    short_title: '[PROPOSED] Article I',
    defined_term: 'Company Material Adverse Effect',
    primary_quote: '"Company Material Adverse Effect" means any effect, change, event or occurrence that, individually or in the aggregate, is materially adverse to the business, financial condition or results of operations of the Company and its Subsidiaries, taken as a whole.',
  };
  assert.equal(mod.isMae(unclassified), true);
});

test('the fallback survives every shape that carries no other family claim', async () => {
  const mod = await config();
  const caught = [
    { short_title: 'Parent MAE', primary_quote: 'Parent Material Adverse Effect means an effect materially adverse to Parent, excluding the enumerated carve-outs below.' },
    { short_title: null, primary_quote: 'no MAE shall be deemed to have occurred solely as a result of changes in the trading price of the Company Shares.' },
    // An MAE-family provision_type with no subtype yet is this family's own,
    // so the guard leaves the fallback available to it. `type: 'MAE'` is the
    // spelling canonical cards carry alongside provision_type
    // (lib/canonical-v2/key-terms-mae-product-projection.js stamps
    // provision_type: 'MAE_DEFINITION' / type: 'MAE' together; legacy
    // extraction's own provision_type is bare 'MAE' -- lib/schema/
    // card-model.js).
    { provision_type: 'MAE', provision_subtype: null, primary_quote: 'no MAE words in the quote at all.' },
    { type: 'MAE', provision_subtype: null, primary_quote: 'would not reasonably be expected to have a Material Adverse Effect.' },
  ];
  for (const card of caught) assert.equal(mod.isMae(card), true, JSON.stringify(card));

  const rejected = [
    // Claimed by another family by type -- the two REAL cards proven above,
    // plus the real DEFINITION-typed card (a distinct family, see above).
    realTaxRepCard(),
    realFinancingCovenantCard(),
    require('./fixtures/canonical-v2/dark-bridge/general-covenants-dark-review.json')
      .legacy_cards.find((entry) => entry.id === 'legacy-definition-mae'),
    // Claimed by type, synthetic shapes for the remaining families.
    { provision_type: 'CLOSING_CONDITION', provision_subtype: 'COND-M-BRINGDOWN', primary_quote: 'the representations shall be true except as would not have a Company Material Adverse Effect.' },
    { provision_type: 'TERMINATION_RIGHT', provision_subtype: 'TERMR-OUTSIDE', primary_quote: 'either party may terminate if a Parent Material Adverse Effect has occurred.' },
    // ...or by code alone, with no type at all.
    { provision_subtype: 'NOSOL-PROHIBIT', primary_quote: 'and no Company Material Adverse Effect shall excuse the obligation.' },
    { canonical_code: 'COND-M-STOCKHOLDER', primary_quote: 'no Material Adverse Effect shall have occurred prior to the vote.' },
    // Nothing that mentions MAE words, with no MAE words, was ever caught.
    { primary_quote: 'The Company shall hold a stockholders meeting.' },
  ];
  for (const card of rejected) assert.equal(mod.isMae(card), false, JSON.stringify(card));
});

// ---------------------------------------------------------------------------
// The real integration point every consumer uses
// ---------------------------------------------------------------------------

test('selectCards(reviewDeal, isMae) excludes the two real foreign cards from a mixed deal', async () => {
  const mod = await config();
  const { selectCards } = await cardUtils();
  const genuine = {
    id: 'fragment-1-1',
    short_title: '[PROPOSED] Article I',
    defined_term: 'Company Material Adverse Effect',
    primary_quote: '"Company Material Adverse Effect" means any effect materially adverse to the Company.',
  };
  const reviewDeal = { cards: [realTaxRepCard(), realFinancingCovenantCard(), genuine] };
  const selected = selectCards(reviewDeal, mod.isMae);
  assert.deepEqual(selected.map((card) => card.id), ['fragment-1-1']);
});
