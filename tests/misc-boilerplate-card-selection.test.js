'use strict';

// WHICH CARDS THE MISCELLANEOUS / BOILERPLATE TABLE IS ALLOWED TO READ.
//
// components/review/table-configs/misc-boilerplate.config.js#isMiscBoilerplateCard
// selects a card three ways: the MISC_BOILERPLATE provision_type, a MISC
// canonical code, or -- as a FALLBACK for a genuine boilerplate card the
// classifier never subtyped -- a word regex (governing law | jurisdiction |
// forum selection | third[- ]party benefic | specific performance |
// assignment) over the card's title and quote.
//
// Run unguarded that fallback nets every card of every OTHER family whose
// clause happens to use one of these very ordinary words: "jurisdiction"
// appears in almost every organization representation ("duly incorporated
// ... and in good standing ... under the Laws of the jurisdiction of
// organization"), and "third party beneficiary" / "assignment" both appear
// routinely inside a Director & Officer indemnification covenant's own
// successors-and-assigns / named-beneficiary language.
//
// Every case below is REAL committed data: the production `provision_cards`
// export in tests/fixtures/canonical-v2/dno-fixtures, and the V1 snapshot of
// the real Modiv deal in
// tests/fixtures/canonical-v2/v1v2-comparator/modiv-v1-provision-snapshot.json.

const test = require('node:test');
const assert = require('node:assert/strict');

async function config() {
  return import('../components/review/table-configs/misc-boilerplate.config.js');
}
async function cardUtils() {
  return import('../components/review/table-configs/card-utils.js');
}

// The predicate as it stood before the guard, so the tests below can state
// what the fallback USED to select rather than merely asserting the current
// answer.
function unguardedIsMiscBoilerplateCard(card) {
  const type = String(card?.provision_type || card?.type || '').trim().toUpperCase();
  const code = String(card?.provision_subtype || card?.canonical_code || card?.provision_code || card?.code || '').trim().toUpperCase();
  const text = `${card?.short_title || ''} ${String(card?.primary_quote || card?.region_full_text || '').trim()}`;
  return type === 'MISC_BOILERPLATE' || code.startsWith('MISC') || /governing law|jurisdiction|forum selection|third[- ]party benefic|specific performance|assignment/i.test(text);
}

// ---------------------------------------------------------------------------
// Two real foreign cards, from committed production exports
// ---------------------------------------------------------------------------

// A Director & Officer indemnification covenant explicitly names the
// indemnified officers/directors as "intended third-party beneficiar[ies] of
// this Section 7.9" -- ordinary D&O drafting, nothing to do with this
// table's own third-party-beneficiaries row (which reads the deal-wide
// thirdPartyBeneficiaries/thirdPartyBeneficiaryExceptions features).
const DNO_CORPUS = require('./fixtures/canonical-v2/dno-fixtures/corpus-cards.json');

function realDoCovenantCard() {
  const card = DNO_CORPUS.cards.find((entry) => entry.id === '0f6fce9e-8ae9-49fa-aaa2-879e214185bb');
  assert.ok(card, 'the committed DNO COV-DO card must be present');
  assert.equal(DNO_CORPUS.source_table, 'provision_cards');
  assert.equal(card.provision_type, 'COVENANT_OTHER');
  assert.equal(card.provision_subtype, 'COV-DO');
  assert.match(card.region_full_text, /third-party benefic/i);
  return card;
}

// Modiv's own Organization representation: "duly incorporated ... and in
// good standing (with respect to jurisdictions that recognize such
// concept)" -- the word "jurisdiction" used the ordinary way every
// organization rep uses it, not a forum-selection clause.
const MODIV_SNAPSHOT = require('./fixtures/canonical-v2/v1v2-comparator/modiv-v1-provision-snapshot.json');

function realOrgRepCard() {
  const card = MODIV_SNAPSHOT.cards.find((entry) => entry.id === '8aa61263-c72e-478b-ba31-d2ff2ce5138f');
  assert.ok(card, 'the committed Modiv REP-T-ORG card must be present');
  assert.equal(MODIV_SNAPSHOT.schema_version, 'V1_PROVISION_SNAPSHOT/V1');
  assert.equal(card.provision_type, 'REPRESENTATION');
  assert.equal(card.provision_subtype, 'REP-T-ORG');
  assert.match(card.primary_quote, /jurisdiction/i);
  return card;
}

// ---------------------------------------------------------------------------
// A foreign card must never be selected by the boilerplate-word fallback
// ---------------------------------------------------------------------------

test('a real D&O covenant naming its own "third-party beneficiary" language stays out of the misc table', async () => {
  const mod = await config();
  const card = realDoCovenantCard();
  assert.equal(unguardedIsMiscBoilerplateCard(card), true);
  assert.equal(mod.isMiscBoilerplateCard(card), false);
});

test('a real organization representation using the word "jurisdiction" stays out of the misc table', async () => {
  const mod = await config();
  const card = realOrgRepCard();
  assert.equal(unguardedIsMiscBoilerplateCard(card), true);
  assert.equal(mod.isMiscBoilerplateCard(card), false);
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
      if (!byFamily && mod.isMiscBoilerplateCard(card)) leaked.push(`${card.id}:${card.provision_type}/${card.provision_subtype}`);
    }
  }
  // The whole committed real-deal-card universe: 8 production
  // corpus-cards.json exports plus 3 real-deal V1 provision snapshots
  // (TopBuild, Skechers, Modiv) -- 241 cards at the time this test was
  // written.
  assert.ok(scanned > 200, 'the committed real-deal fixtures must actually be scanned');
  assert.deepEqual(leaked, []);
});

// ---------------------------------------------------------------------------
// The fallback still does the one job it exists for
// ---------------------------------------------------------------------------

test('a genuine boilerplate card the classifier never subtyped is still caught by the fallback', async () => {
  const mod = await config();
  const unclassified = {
    id: 'fragment-9-9',
    // No provision_type and no subtype -- the classifier never placed it.
    // This is the ONLY case the boilerplate-word fallback exists for.
    short_title: '[PROPOSED] Section 9.9',
    primary_quote: 'Governing Law. This Agreement, and all claims arising out of or relating to this Agreement, shall be governed by the laws of the State of Delaware.',
  };
  assert.equal(mod.isMiscBoilerplateCard(unclassified), true);
});

// This is REAL data: the exact real shape
// tests/termination-fee-card-selection.test.js proves by running the full
// production pipeline (compileFixtureContractV38 -> runNativeExtraction ->
// resolveCandidates -> projectRemediesMiscProductSurfaces) over the
// committed Landos agreement: the resulting REM-SOLE card carries
// provision_type 'MISC_BOILERPLATE' with provision_subtype 'REM-SOLE'. This
// file reuses that already-proven shape rather than re-running the pipeline,
// to test THIS table's guard rather than re-prove the pipeline's output.
test('a genuine code-less MISC_BOILERPLATE card is still caught, whatever its text says (real data)', async () => {
  const mod = await config();
  // Real, code-less production card: guaranty-fixtures' own Guarantee of
  // Guarantor clause. Its type alone -- not the boilerplate-word regex --
  // is what makes it this table's own.
  const guaranty = require('./fixtures/canonical-v2/guaranty-fixtures/corpus-cards.json');
  const card = guaranty.cards.find((entry) => entry.id === 'eb4b9423-5a6e-471c-a141-37566b54dd81');
  assert.ok(card, 'the committed guaranty-fixtures MISC_BOILERPLATE card must be present');
  assert.equal(card.provision_type, 'MISC_BOILERPLATE');
  assert.equal(card.provision_subtype, null);
  assert.equal(mod.isMiscBoilerplateCard(card), true);
});

// ---------------------------------------------------------------------------
// CATCH-ALL JUDGMENT, VERIFIED: this table's own card set is not a single
// code prefix (governedConceptRows() reads ADMIN-*/REM-{SP,NONRECOURSE,
// JURY,SOLE} codes that don't start with "MISC"). The guard's code-prefix
// check ONLY covers "MISC" -- this pins that genuinely-own ADMIN-*/REM-*
// cards are still selected anyway, because the real projection pipeline
// always stamps provision_type: 'MISC_BOILERPLATE' on them too, which the
// guard's TYPE check catches unconditionally before the code-prefix check
// ever runs. A verified negative: this narrowing does NOT introduce a new
// exclusion bug for this table's own non-MISC-prefixed cards.
// ---------------------------------------------------------------------------

test('CATCH-ALL: genuine ADMIN-*/REM-* concept cards are not wrongly excluded by the narrower code check', async () => {
  const mod = await config();
  // Shapes mirror the real, pipeline-verified pairing (provision_type
  // 'MISC_BOILERPLATE' always travels with these subtypes -- see
  // lib/canonical-v2/remedies-misc-product-projection.js's REMEDIES_CONCEPTS/
  // MISC_DEFINITIONS groups, all of which land in the SAME object literal
  // that hardcodes provision_type: 'MISC_BOILERPLATE' / type: 'MISC').
  const governedConceptCards = [
    { id: 'rem-sole-1', provision_type: 'MISC_BOILERPLATE', provision_subtype: 'REM-SOLE', primary_quote: 'the payment of the Termination Fee shall be the sole and exclusive remedy.', features: { mainConcept: 'Payment of the fee is the sole and exclusive remedy.' } },
    { id: 'rem-nonrecourse-1', provision_type: 'MISC_BOILERPLATE', provision_subtype: 'REM-NONRECOURSE', primary_quote: 'no recourse shall be had against any Financing Source.', features: { mainConcept: 'No recourse against Financing Sources.' } },
    { id: 'admin-notices-1', provision_type: 'MISC_BOILERPLATE', provision_subtype: 'ADMIN-NOTICES', primary_quote: 'all notices shall be in writing and delivered by hand or overnight courier.', features: { mainConcept: 'Notices must be in writing.' } },
    { id: 'admin-entire-1', provision_type: 'MISC_BOILERPLATE', provision_subtype: 'ADMIN-ENTIRE', primary_quote: 'this Agreement constitutes the entire agreement among the parties.', features: { mainConcept: 'Entire agreement clause.' } },
    { id: 'admin-tpb-1', provision_type: 'MISC_BOILERPLATE', provision_subtype: 'ADMIN-TPB', primary_quote: 'nothing in this Agreement, express or implied, confers any rights on any other Person.', features: { mainConcept: 'No third-party beneficiaries.' } },
  ];
  for (const card of governedConceptCards) {
    assert.equal(mod.isMiscBoilerplateCard(card), true, JSON.stringify(card));
  }

  // And GOVERNED_CONCEPT_ROWS' own code-based lookup actually finds them once
  // selected -- proving the catch-all judgment holds all the way through to
  // the rendered rows, not just the raw predicate. governedConceptRows()
  // reads each card's mainConcept feature (the only field it renders), so
  // the fixture cards above carry one.
  const rows = mod.miscBoilerplateConfig.selectRows({ cards: governedConceptCards });
  const nonRecourseRow = rows.find((row) => row.id === 'misc-boilerplate-non-recourse');
  const noticesRow = rows.find((row) => row.id === 'misc-boilerplate-notices');
  assert.ok(nonRecourseRow, 'the REM-NONRECOURSE card must still reach its governed-concept row');
  assert.ok(noticesRow, 'the ADMIN-NOTICES card must still reach its governed-concept row');
});

test('the fallback survives every shape that carries no other family claim', async () => {
  const mod = await config();
  const caught = [
    { short_title: 'Specific Performance', primary_quote: 'each party shall be entitled to seek specific performance of the terms and provisions of this Agreement.' },
    { short_title: null, primary_quote: 'neither party may assign or transfer this Agreement without the prior written consent of the other party; any purported assignment in violation of this Section shall be void.' },
    // A misc-family provision_type with no subtype yet is this family's own,
    // so the guard leaves the fallback available to it. `type: 'MISC'` is
    // the spelling canonical cards carry alongside provision_type
    // (lib/canonical-v2/remedies-misc-product-projection.js).
    { provision_type: 'MISC_BOILERPLATE', provision_subtype: null, primary_quote: 'no boilerplate words here at all.' },
    { type: 'MISC', provision_subtype: null, primary_quote: 'the parties consent to the exclusive jurisdiction of the Delaware Court of Chancery.' },
  ];
  for (const card of caught) assert.equal(mod.isMiscBoilerplateCard(card), true, JSON.stringify(card));

  const rejected = [
    // Claimed by another family by type -- the two REAL cards proven above.
    realDoCovenantCard(),
    realOrgRepCard(),
    // Claimed by type, synthetic shapes for the remaining families.
    { provision_type: 'REPRESENTATION', primary_quote: 'the assignment of this Agreement by either party requires the consent of the other.' },
    { provision_type: 'TERMINATION_RIGHT', provision_subtype: 'TERMR-SUPERIOR', primary_quote: 'terminate to accept a Superior Proposal, governed by the forum selection clause of Section 9.9.' },
    // ...or by code alone, with no type at all.
    { provision_subtype: 'NOSOL-PROHIBIT', primary_quote: 'and no third party beneficiary rights are created by this Section.' },
    { canonical_code: 'COND-M-STOCKHOLDER', primary_quote: 'subject to the governing law of the State of Delaware.' },
    // Nothing that mentions boilerplate words, with no boilerplate words, was
    // ever caught.
    { primary_quote: 'The Company shall hold a stockholders meeting.' },
  ];
  for (const card of rejected) assert.equal(mod.isMiscBoilerplateCard(card), false, JSON.stringify(card));
});

// ---------------------------------------------------------------------------
// The real integration point every consumer uses
// ---------------------------------------------------------------------------

test('selectCards(reviewDeal, isMiscBoilerplateCard) excludes the two real foreign cards from a mixed deal', async () => {
  const mod = await config();
  const { selectCards } = await cardUtils();
  const genuine = {
    id: 'fragment-9-9',
    short_title: '[PROPOSED] Section 9.9',
    primary_quote: 'Governing Law. This Agreement shall be governed by the laws of the State of Delaware.',
  };
  const reviewDeal = { cards: [realDoCovenantCard(), realOrgRepCard(), genuine] };
  const selected = selectCards(reviewDeal, mod.isMiscBoilerplateCard);
  assert.deepEqual(selected.map((card) => card.id), ['fragment-9-9']);
});
