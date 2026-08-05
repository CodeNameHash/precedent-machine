'use strict';

// WHICH CARDS THE TERMINATION-FEE TABLE IS ALLOWED TO READ.
//
// components/review/table-configs/termination-fees.config.js#isTerminationFee
// selects a card three ways: the fee provision_type, a TERMF canonical code,
// or -- as a FALLBACK for a genuine fee card the classifier never subtyped --
// a fee-word regex over the card's title and quote.
//
// Run unguarded that fallback also nets every card of every OTHER family whose
// clause merely MENTIONS the fee, and clauses that mention it are common: a
// sole-remedy clause is usually ABOUT the fee, and a buyer financing rep quotes
// the guarantee of "the Parent Termination Fee". Once selected, such a card is
// merged into the fee row's feature bag by combineTermfFeatures() and can be
// handed to a fee row as its evidence by findSourceCard()'s `|| cards[0]`.
//
// Every case below is REAL committed data: the production `provision_cards`
// export in tests/fixtures/canonical-v2/financing-covenants-fixtures, and the
// REM-SOLE card the Remedies projection builds from the full committed Landos
// agreement in __fixtures__/demo-deal.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContractV38 } = require('../lib/canonical-v2/contract-bundle');
const { shapeTerminationFeeProposals } = require('../lib/canonical-v2/native-producer/anthropic-provider');
const { runNativeExtraction } = require('../lib/canonical-v2/native-producer/native-extraction-run');
const { resolveCandidates } = require('../lib/canonical-v2/native-producer/candidate-resolution');
const { projectRemediesMiscProductSurfaces } = require('../lib/canonical-v2/remedies-misc-product-projection');
const { buildIdentityAdmittedSourceContext } = require('./helpers/identity-admitted-source');

const LANDOS_SOURCE = fs.readFileSync(path.join(
  __dirname, '..', '__fixtures__', 'demo-deal', 'landos-abbvie-agreement.txt',
), 'utf8');
const CONTRACT = compileFixtureContractV38();

async function config() {
  return import('../components/review/table-configs/termination-fees.config.js');
}

// The predicate as it stood before the guard, so the tests below can state what
// the fallback USED to select rather than merely asserting the current answer.
function unguardedIsTerminationFee(card) {
  const type = String(card?.provision_type || card?.type || '').trim().toUpperCase();
  const code = String(card?.provision_subtype || card?.canonical_code || card?.provision_code || card?.code || '').trim().toUpperCase();
  const text = `${card?.short_title || ''} ${String(card?.primary_quote || card?.region_full_text || '').trim()}`;
  return type === 'TERMINATION_FEE' || code.startsWith('TERMF') || /termination fee|reverse termination|tail fee|ticking fee/i.test(text);
}

// ---------------------------------------------------------------------------
// The real sole-remedy card, built from the full committed Landos agreement
// ---------------------------------------------------------------------------

function exactSlice(startMarker, endMarker) {
  const start = LANDOS_SOURCE.indexOf(startMarker);
  assert.notEqual(start, -1, startMarker);
  const end = LANDOS_SOURCE.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, endMarker);
  return LANDOS_SOURCE.slice(start, end).trim();
}

const SOLE_REMEDY_QUOTE = exactSlice(
  '(b) Claims. Each Party agrees that notwithstanding',
  ' (c) Acknowledgements. Each Party acknowledges',
);

// Both are exact, single-occurrence substrings of the same real §7.3 clause, so
// both corroborate and both mint the same REM-SOLE claim. The difference is how
// much of the sentence the producer quoted -- and the longer one spans the words
// "Termination Fee", because that is what the sentence is about.
const NARROW_EFFECT_QUOTE = 'sole and exclusive remedy';
const FEE_SPANNING_EFFECT_QUOTE = 'the payment of such Termination Fee\nshall be the sole and exclusive remedy of Parent';

async function realSoleRemedyCard(remedyEffectQuote) {
  const dealKey = 'deal:landos-sole-remedy-selection';
  const admittedSourceContext = buildIdentityAdmittedSourceContext(LANDOS_SOURCE, {
    dealKey,
    dealAdmissionId: sha256Hex(`deal-admission:${dealKey}`),
  });
  const receipt = await runNativeExtraction({
    source_text: LANDOS_SOURCE,
    document_hash: sha256Hex(Buffer.from(LANDOS_SOURCE, 'utf8')),
    section_references: ['7.3'],
    contract_bundle: CONTRACT,
    definitions: Object.freeze({ known_definitions: [] }),
    provider: async ({ governed_scope: governedScope }) => {
      const shaped = shapeTerminationFeeProposals({
        fee_amount_assertions: [],
        fee_trigger_assertions: [],
        tail_period_assertions: [],
        wave_b_mechanics: [{
          surface: 'SOLE_REMEDY',
          section_reference: '7.3',
          detail: 'sole-remedy legal effect and exceptions',
          quote: SOLE_REMEDY_QUOTE,
          payment_context_quote: 'payment of such Termination Fee',
          remedy_effect_quote: remedyEffectQuote,
          carve_outs: [{ kind: 'FRAUD', quote: 'Fraud' }, { kind: 'WILLFUL_BREACH', quote: 'Willful Breach' }],
        }],
        open_world_candidates: [],
      }, governedScope.source_text);
      return {
        provider_id: 'termination-fee-card-selection/v1',
        model_id: 'recorded-response',
        prompt: 'termination-fee-card-selection/v1',
        proposals: shaped.proposals,
        evidence_residuals: shaped.evidence_residuals,
      };
    },
  });
  const resolution = resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: CONTRACT,
    admitted_source_context: admittedSourceContext,
  });
  const projection = projectRemediesMiscProductSurfaces({ resolution, deal_id: 'landos-sole-remedy-selection' });
  const card = projection.cards.find((entry) => entry.provision_subtype === 'REM-SOLE');
  assert.ok(card, 'the committed Landos §7.3 clause must produce a REM-SOLE card');
  return card;
}

// ---------------------------------------------------------------------------
// The real financing rep, from the production provision_cards export
// ---------------------------------------------------------------------------

const FINANCING_CORPUS = require('./fixtures/canonical-v2/financing-covenants-fixtures/corpus-cards.json');

function realFinancingRepCard() {
  const card = FINANCING_CORPUS.cards.find((entry) => entry.id === 'dd37da8c-30e2-4053-a0da-987e02120a40');
  assert.ok(card, 'the committed REP-B-FUNDS corpus card must be present');
  assert.equal(FINANCING_CORPUS.source_table, 'provision_cards');
  assert.equal(card.provision_type, 'REPRESENTATION');
  assert.equal(card.provision_subtype, 'REP-B-FUNDS');
  // It is the guarantee of the Parent Termination Fee that puts the fee words
  // into a representation's quote.
  assert.match(card.region_full_text, /Parent Termination Fee/);
  return card;
}

// ---------------------------------------------------------------------------
// A foreign card must never be selected by the fee-word fallback
// ---------------------------------------------------------------------------

test('the real REM-SOLE card is never selected into the fee table, whichever quote the producer gave', async () => {
  const mod = await config();
  for (const effectQuote of [NARROW_EFFECT_QUOTE, FEE_SPANNING_EFFECT_QUOTE]) {
    const card = await realSoleRemedyCard(effectQuote);
    assert.equal(card.provision_type, 'MISC_BOILERPLATE');
    assert.equal(card.provision_subtype, 'REM-SOLE');
    assert.equal(card.features.soleRemedy, true);
    assert.equal(mod.isTerminationFee(card), false, effectQuote);
    // ...and it cannot reach either side of the partition.
    const partition = mod.partitionTerminationFeeCards({ cards: [card] });
    assert.deepEqual(partition.legacyCards, []);
    assert.deepEqual(partition.canonicalCards, []);
  }
});

test('the sole-remedy quote that spans the fee words is what the unguarded fallback selected', async () => {
  const mod = await config();
  const narrow = await realSoleRemedyCard(NARROW_EFFECT_QUOTE);
  const feeSpanning = await realSoleRemedyCard(FEE_SPANNING_EFFECT_QUOTE);

  // The published quote is the corroborated claim text, so how much of the real
  // sentence the producer quoted decides whether the fee words are on the card.
  assert.equal(narrow.primary_quote.includes('Termination Fee'), false);
  assert.match(feeSpanning.primary_quote, /Termination Fee/);

  // That is exactly the difference the unguarded fallback keyed on -- the same
  // clause, the same claim, selected or not by an accident of quote length.
  assert.equal(unguardedIsTerminationFee(narrow), false);
  assert.equal(unguardedIsTerminationFee(feeSpanning), true);
  // The guard removes the accident: neither is selected, because REM-SOLE is
  // owned by the Remedies family either way.
  assert.equal(mod.isTerminationFee(narrow), false);
  assert.equal(mod.isTerminationFee(feeSpanning), false);
});

test('a real REP-B-FUNDS corpus card quoting the Parent Termination Fee stays out of the fee table', async () => {
  const mod = await config();
  const card = realFinancingRepCard();
  // The committed corpus proves this is not hypothetical: the unguarded
  // fallback selected a production representation card into the fee table.
  assert.equal(unguardedIsTerminationFee(card), true);
  assert.equal(mod.isTerminationFee(card), false);
  assert.deepEqual(mod.partitionTerminationFeeCards({ cards: [card] }).legacyCards, []);
});

test('no card in any committed provision_cards export is selected by the fallback alone', async () => {
  const mod = await config();
  const exports_ = [
    'guaranty-fixtures', 'employee-matters-fixtures', 'dno-fixtures',
    'financing-covenants-fixtures', 'm3-v31-fixtures',
  ].map((name) => require(`./fixtures/canonical-v2/${name}/corpus-cards.json`));
  let scanned = 0;
  const leaked = [];
  for (const corpus of exports_) {
    for (const card of corpus.cards) {
      scanned += 1;
      const byFamily = String(card.provision_type || '').toUpperCase() === 'TERMINATION_FEE'
        || String(card.provision_subtype || '').toUpperCase().startsWith('TERMF');
      if (!byFamily && mod.isTerminationFee(card)) leaked.push(`${card.provision_type}/${card.provision_subtype}`);
    }
  }
  assert.ok(scanned > 90, 'the committed corpus exports must actually be scanned');
  assert.deepEqual(leaked, []);
});

// ---------------------------------------------------------------------------
// What the leak did to the rendered table
// ---------------------------------------------------------------------------

test('a leaked sole-remedy card would have flipped the sole-remedy row to the wrong answer', async () => {
  const mod = await config();
  const remSole = await realSoleRemedyCard(FEE_SPANNING_EFFECT_QUOTE);
  // The agreement's own fee card records the established NEGATIVE: the
  // extractor looked and found no sole-remedy limitation.
  const feeCard = {
    id: 'legacy-termf-sole',
    provision_type: 'TERMINATION_FEE',
    provision_subtype: 'TERMF-SOLE',
    short_title: 'Sole Remedy',
    primary_quote: 'The Company shall pay Parent a termination fee of $100,000,000.',
    features: { soleAndExclusiveRemedy: false, feeRequired: true },
  };

  // Unguarded, the foreign REM-SOLE card is selected, its soleRemedy: true wins
  // firstFeature() whenever it sorts ahead of the fee card, and the row answers
  // "Yes" to a question the fee extraction answered "No" -- silently, and
  // varying with card order.
  const leakedRows = mod.scalarRows([remSole, feeCard].filter(unguardedIsTerminationFee));
  const leaked = leakedRows.find((row) => row.id === 'termination-fees-sole-remedy');
  assert.equal(leaked.detail, 'Yes');
  assert.equal(leaked.sourceCard.provision_subtype, 'REM-SOLE');

  // Guarded, only the fee card is selected and the row states the fee
  // extraction's own finding, in either card order.
  for (const cards of [[remSole, feeCard], [feeCard, remSole]]) {
    const rows = mod.terminationFeesConfig.selectRows({ cards });
    const row = rows.find((entry) => entry.id === 'termination-fees-sole-remedy');
    assert.equal(row.detail, 'No');
    assert.equal(row.sourceCard.provision_subtype, 'TERMF-SOLE');
  }
});

test('a leaked representation would have supplied a fee row its evidence', async () => {
  const mod = await config();
  const rep = realFinancingRepCard();
  // The fee card here is the subtype-less fragment the fallback exists to
  // catch, so no card carries the TERMF-TARGET code findSourceCard() looks for
  // and it falls back to cards[0] -- which, unguarded, is the representation.
  const feeCard = {
    id: 'fragment-7-3',
    short_title: '[PROPOSED] Section 7.3',
    primary_quote: 'The Company shall pay Parent a termination fee of $100,000,000.',
    features: { companyTerminationFee: { amount: '$100,000,000' } },
  };
  const leakedRows = mod.feeTableRows([rep, feeCard].filter(unguardedIsTerminationFee), null);
  const leaked = leakedRows.find((row) => row.id === 'termination-fees-COMPANY_TERMINATION_FEE');
  assert.match(leaked.evidence, /Parent Termination Fee/);
  assert.equal(leaked.sourceCard.provision_subtype, 'REP-B-FUNDS');

  const rows = mod.terminationFeesConfig.selectRows({ cards: [rep, feeCard] });
  const row = rows.find((entry) => entry.id === 'termination-fees-COMPANY_TERMINATION_FEE');
  assert.equal(row.sourceCard.id, 'fragment-7-3');
  assert.equal(row.evidence.includes('Parent Termination Fee'), false);
});

// ---------------------------------------------------------------------------
// The fallback still does the one job it exists for
// ---------------------------------------------------------------------------

test('a genuine fee card the classifier never subtyped is still caught by the fallback', async () => {
  const mod = await config();
  const unclassified = {
    id: 'fragment-7-3',
    // No provision_type and no subtype -- the classifier never placed it. This
    // is the ONLY case the fee-word fallback exists for.
    short_title: '[PROPOSED] Section 7.3',
    primary_quote: 'If this Agreement is terminated under Section 7.1(d), the Company shall pay Parent a termination fee of $250,000,000 within two business days.',
    features: { companyTerminationFee: { amount: '$250,000,000' } },
  };
  assert.equal(mod.isTerminationFee(unclassified), true);
  assert.deepEqual(mod.partitionTerminationFeeCards({ cards: [unclassified] }).legacyCards, [unclassified]);

  // And it reaches the rendered table as a real fee row.
  const rows = mod.terminationFeesConfig.selectRows({ cards: [unclassified] });
  const fee = rows.find((row) => row.id === 'termination-fees-COMPANY_TERMINATION_FEE');
  assert.ok(fee, 'a subtype-less fee card must still produce its fee row');
  assert.match(fee.detail, /\$250,000,000/);
});

test('the fallback survives every shape that carries no other family claim', async () => {
  const mod = await config();
  const caught = [
    { short_title: 'Reverse Termination Fee', primary_quote: 'Parent shall pay the Company a reverse termination fee.' },
    { short_title: null, primary_quote: 'a tail fee is payable if a transaction is consummated within twelve months.' },
    { short_title: 'Ticking fee', primary_quote: 'the per-diem ticking fee accrues from the outside date.' },
    // A fee-family provision_type with no subtype yet is this family's own, so
    // the guard leaves the fallback available to it. `type: 'TERMF'` is the
    // spelling canonical cards carry alongside provision_type.
    { provision_type: 'TERMINATION_FEE', provision_subtype: null, primary_quote: 'no fee words here at all.' },
    { type: 'TERMF', provision_subtype: null, primary_quote: 'the Company shall pay a termination fee.' },
  ];
  for (const card of caught) assert.equal(mod.isTerminationFee(card), true, JSON.stringify(card));

  const rejected = [
    // Claimed by another family by type...
    { provision_type: 'REPRESENTATION', primary_quote: 'guarantee of the Parent Termination Fee.' },
    { provision_type: 'MISC_BOILERPLATE', provision_subtype: 'REM-SOLE', primary_quote: 'payment of the Termination Fee is the sole and exclusive remedy.' },
    { provision_type: 'TERMINATION_RIGHT', provision_subtype: 'TERMR-SUPERIOR', primary_quote: 'terminate to accept a Superior Proposal on payment of the termination fee.' },
    { provision_type: 'COVENANT_NO_SOLICITATION', primary_quote: 'and pay the termination fee required by Section 7.3.' },
    // ...or by code alone, with no type at all.
    { provision_subtype: 'NOSOL-PROHIBIT', primary_quote: 'and pay the termination fee required by Section 7.3.' },
    { canonical_code: 'COND-M-STOCKHOLDER', primary_quote: 'the termination fee shall have been paid.' },
    // Nothing that mentions the fee, with no fee words, was ever caught.
    { primary_quote: 'The Company shall hold a stockholders meeting.' },
  ];
  for (const card of rejected) assert.equal(mod.isTerminationFee(card), false, JSON.stringify(card));
});
