'use strict';

// Owner rulings, 2026-08-05, on the termination tables
// (components/review/table-configs/termination-fees.config.js and
// termination-rights.config.js):
//
//   1. The single "Willful-breach exception" row in the fee table conflated
//      two legally distinct facts (TERMF-EFFECT's carve-out to the
//      effect-of-termination survival rule, and TERMF-SOLE's carve-out to
//      the fee-as-damages cap) that share one feature key
//      (willfulBreachException) but can each be present without the other.
//      Reading firstFeature() over the combined card set meant which fact a
//      lawyer saw depended on card order -- a live defect. Split into two
//      rows, each scoped to its own source code.
//   2. "Fee required to terminate" (feeRequired) means payment is a
//      condition precedent to exercising the fiduciary out -- not that a fee
//      is payable -- and lib/schema/features.js already scopes it to the
//      Termination Rights table (TERMR / TERMR-SUPERIOR / "Fiduciary out").
//      Moved there; the fee table no longer renders it, in any mode.
//   3. termination-rights.config.js#isTerminationRight()'s unguarded
//      type||code||regex fallback let a no-shop or termination-fee card that
//      merely mentions "superior proposal" leak into the rights table.
//      Narrowed to the same "no other family has claimed this card" guard
//      already applied to termination-fees.config.js#isTerminationFee().
//   4. Extended same-day: the rights table's OWN cross-cutting
//      "Willful-breach exception" row (CROSS_CUTTING_ROWS) carried the
//      identical conflation and was, at first, only narrowed to TERMF-SOLE
//      -- closing the wrong-answer defect but opening a gap (a deal whose
//      only carve-out was to TERMF-EFFECT showed nothing in that group at
//      all). Asked whether to extend the fee table's split here too, the
//      owner ruled yes. Same split, same code-scoping mechanism, second
//      table.
//
// This file proves: the two willful-breach rows are independently populated,
// in either card order; the fee-required row renders in the rights table and
// never in the fee table, with prose preserved where prose was stored; a
// no-shop/fee card mentioning "superior proposal" no longer lands in the
// rights table while a genuine subtype-less rights card is still caught; all
// four fee-table serving modes still work; the rights table's own
// willful-breach cross-cutting row is likewise split into two
// independently-scoped rows, closing the effect-of-termination gap; and no
// row id collides with the review-row-binding registry.

const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const { F4_REVIEW_ROW_BINDING_RULES } = require('../lib/canonical-v2/review-row-binding');

async function feesConfig() {
  return import('../components/review/table-configs/termination-fees.config.js');
}
async function rightsConfig() {
  return import('../components/review/table-configs/termination-rights.config.js');
}

function rowById(rows, id) {
  return rows.find((row) => row.id === id) || null;
}

// ---------------------------------------------------------------------------
// 1. The willful-breach split (owner ruling 1)
// ---------------------------------------------------------------------------

function termfEffectCard(value, overrides = {}) {
  return {
    id: 'termf-effect',
    provision_type: 'TERMINATION_FEE',
    provision_subtype: 'TERMF-EFFECT',
    short_title: 'Effect of Termination',
    primary_quote: 'Termination shall not relieve either party of liability for a willful breach occurring prior to termination.',
    features: { willfulBreachException: value },
    ...overrides,
  };
}
function termfSoleCard(value, overrides = {}) {
  return {
    id: 'termf-sole',
    provision_type: 'TERMINATION_FEE',
    provision_subtype: 'TERMF-SOLE',
    short_title: 'Sole and Exclusive Remedy',
    primary_quote: 'Payment of the Termination Fee shall be the sole and exclusive remedy, except in the case of a willful and material breach.',
    features: { willfulBreachException: value },
    ...overrides,
  };
}

test('willful-breach: a TERMF-EFFECT-only card populates ONLY the effect row', async () => {
  const mod = await feesConfig();
  const rows = mod.scalarRows([termfEffectCard(true)]);
  const effect = rowById(rows, 'termination-fees-willful-breach-effect');
  const sole = rowById(rows, 'termination-fees-willful-breach-sole');
  assert.ok(effect, 'the effect-of-termination carve-out row must render');
  assert.equal(effect.label, 'Willful-breach carve-out', 'label derives from rubric.js TERMF-EFFECT wording');
  assert.equal(effect.detail, 'Yes');
  assert.equal(effect.sourceCard.provision_subtype, 'TERMF-EFFECT');
  assert.equal(sole, null, 'the sole-remedy carve-out row must NOT render -- there is no TERMF-SOLE card');
});

test('willful-breach: a TERMF-SOLE-only card populates ONLY the sole-remedy row', async () => {
  const mod = await feesConfig();
  const rows = mod.scalarRows([termfSoleCard(false)]);
  const effect = rowById(rows, 'termination-fees-willful-breach-effect');
  const sole = rowById(rows, 'termination-fees-willful-breach-sole');
  assert.equal(effect, null, 'the effect-of-termination carve-out row must NOT render -- there is no TERMF-EFFECT card');
  assert.ok(sole, 'the sole-remedy carve-out row must render');
  assert.equal(sole.label, 'Willful-breach carve-out to sole remedy', 'label derives from rubric.js TERMF-SOLE wording');
  assert.equal(sole.detail, 'No');
  assert.equal(sole.sourceCard.provision_subtype, 'TERMF-SOLE');
});

// The regression test: both facts present with DIFFERENT values, in EITHER
// card order. Before the split, firstFeature() over the combined card set
// meant whichever card sorted first silently decided the single row's
// answer. Now each row is scoped to its own code, so the answer cannot move.
test('willful-breach: both facts render independently and correctly regardless of card order', async () => {
  const mod = await feesConfig();
  for (const cards of [
    [termfEffectCard(true), termfSoleCard(false)],
    [termfSoleCard(false), termfEffectCard(true)],
  ]) {
    const rows = mod.scalarRows(cards);
    const effect = rowById(rows, 'termination-fees-willful-breach-effect');
    const sole = rowById(rows, 'termination-fees-willful-breach-sole');
    assert.equal(effect.detail, 'Yes', 'effect row must read TERMF-EFFECT, never TERMF-SOLE, whatever the array order');
    assert.equal(sole.detail, 'No', 'sole-remedy row must read TERMF-SOLE, never TERMF-EFFECT, whatever the array order');
    assert.equal(effect.sourceCard.provision_subtype, 'TERMF-EFFECT');
    assert.equal(sole.sourceCard.provision_subtype, 'TERMF-SOLE');
  }
});

test('willful-breach: the two row ids are distinct and neither collides with the pre-split id', async () => {
  const mod = await feesConfig();
  const rows = mod.scalarRows([termfEffectCard(true), termfSoleCard(true)]);
  const ids = rows.map((row) => row.id);
  assert.deepEqual(ids.filter((id) => id.includes('willful-breach')).sort(), [
    'termination-fees-willful-breach-effect',
    'termination-fees-willful-breach-sole',
  ]);
  assert.equal(rows.some((row) => row.id === 'termination-fees-willful-breach'), false, 'the old single-row id must no longer be produced');
});

// ---------------------------------------------------------------------------
// 2. feeRequired relocation (owner ruling 2)
// ---------------------------------------------------------------------------

test('fee-required: no longer renders in the termination-fees table under any card shape', async () => {
  const mod = await feesConfig();
  for (const value of [true, false, 'concurrently with, and as a condition to, any such termination the Company pays the Termination Fee pursuant to Section 10.5']) {
    const rows = mod.terminationFeesConfig.selectRows({
      cards: [{
        id: 'termf-target',
        provision_type: 'TERMINATION_FEE',
        provision_subtype: 'TERMF-TARGET',
        primary_quote: 'The Company shall pay a termination fee.',
        features: { terminationFees: { amount: '$50,000,000' }, feeRequired: value },
      }],
    });
    assert.equal(rows.some((row) => row.id === 'termination-fees-required'), false, `feeRequired=${JSON.stringify(value)} must not produce a fee-table row`);
    assert.equal(rows.some((row) => String(row.id).includes('required')), false);
  }
});

test('fee-required: never appears as a "not yet extracted" coverage placeholder in canonical serving mode', async () => {
  const mod = await feesConfig();
  const rows = mod.terminationFeesConfig.selectRows({
    cards: [],
    [mod.CANONICAL_V2_TERMINATION_FEE_SERVING_FIELD]: true,
    [mod.CANONICAL_V2_TERMINATION_FEE_CARDS_FIELD]: [{
      id: 'canonical-fee',
      provision_type: 'TERMINATION_FEE',
      provision_subtype: 'TERMF-TARGET',
      primary_quote: 'q',
      features: { terminationFees: { amount: '$1' } },
      canonical_v2_lineage: { source: 'CANONICAL_V2_NATIVE_CLAIM' },
    }],
  });
  assert.equal(rows.some((row) => String(row.label || '').toLowerCase().includes('fee required')), false);
  assert.equal(rows.some((row) => row.id === 'termination-fees-not-yet-extracted-required'), false);
});

test('fee-required: renders on the termination-rights table\'s Fiduciary out group, boolean true/false', async () => {
  const mod = await rightsConfig();
  for (const [value, expected] of [[true, 'Yes'], [false, 'No']]) {
    const rows = mod.terminationRightsConfig.selectRows({
      cards: [{
        id: 'sup',
        provision_type: 'TERMINATION_RIGHT',
        provision_subtype: 'TERMR-SUPERIOR',
        primary_quote: 'concurrently with such termination, the Company pays the Termination Fee.',
        features: { feeRequired: value },
      }],
    });
    const group = rows[0].groups.find((g) => g.id === 'fiduciary-out');
    assert.ok(group, `feeRequired=${value} must produce the Fiduciary out group`);
    assert.equal(group.label, 'Fiduciary out (cross-reference)');
    const row = group.rows.find((r) => r.id === 'termination-rights-fee-required');
    assert.ok(row, 'row must render even for the established-negative false case');
    assert.equal(row.present, true, 'false is a finding, not an absence -- present must stay true');
    assert.deepEqual(row.value, [expected]);
    assert.deepEqual(row.featureKeys, ['feeRequired']);
  }
});

test('fee-required: prose is preserved verbatim, not collapsed to a boolean', async () => {
  const mod = await rightsConfig();
  const prose = 'concurrently with, and as a condition to, any such termination the Company pays the Termination Fee pursuant to Section 10.5';
  const rows = mod.terminationRightsConfig.selectRows({
    cards: [{
      id: 'sup',
      provision_type: 'TERMINATION_RIGHT',
      provision_subtype: 'TERMR-SUPERIOR',
      primary_quote: `(iii) ${prose} and (iv) the Board has authorized entry into a definitive agreement.`,
      features: { feeRequired: prose },
    }],
  });
  const group = rows[0].groups.find((g) => g.id === 'fiduciary-out');
  const row = group.rows.find((r) => r.id === 'termination-rights-fee-required');
  assert.deepEqual(row.value, [prose], 'the prose sentence must render in full, not "Yes"');

  // row.children (pre-built by selectRows() with no live PillCell) is the
  // plain-span fallback -- render it directly to prove the prose reaches the
  // DOM rather than collapsing to a boolean stand-in.
  const staticHtml = renderToStaticMarkup(React.createElement(React.Fragment, null, row.children));
  assert.match(staticHtml, /pursuant to Section 10\.5/);
  assert.doesNotMatch(staticHtml, />\s*Yes\s*</, 'must never collapse real prose to "Yes"');

  // And through the live-PillCell path renderCell() actually uses.
  const PillCell = ({ label }) => React.createElement('span', { className: 'pill' }, label);
  const groups = mod.buildGroups(rows[0].reviewDeal, rows[0].cards, PillCell);
  const liveGroup = groups.find((g) => g.id === 'fiduciary-out');
  const liveRow = liveGroup.rows.find((r) => r.id === 'termination-rights-fee-required');
  const liveHtml = renderToStaticMarkup(React.createElement(React.Fragment, null, liveRow.children));
  assert.match(liveHtml, /class="pill"/);
  assert.match(liveHtml, /pursuant to Section 10\.5/);
});

test('fee-required: absent when no card carries it -- no empty group renders', async () => {
  const mod = await rightsConfig();
  const rows = mod.terminationRightsConfig.selectRows({
    cards: [{
      id: 'outside',
      provision_type: 'TERMINATION_RIGHT',
      provision_subtype: 'TERMR-OUTSIDE',
      primary_quote: 'Outside date text.',
      features: { outsideDate: 'June 30, 2026' },
    }],
  });
  assert.equal(rows[0].groups.some((g) => g.id === 'fiduciary-out'), false);
});

// ---------------------------------------------------------------------------
// 3. isTerminationRight() family guard (owner ruling 3)
// ---------------------------------------------------------------------------

test('isTerminationRight: a no-shop card mentioning "superior proposal" is excluded', async () => {
  const mod = await rightsConfig();
  const noShopCard = {
    provision_type: 'COVENANT_NO_SOLICITATION',
    provision_subtype: 'NOSOL-PROHIBIT',
    primary_quote: 'The Company shall not solicit Acquisition Proposals, except that the Company may terminate this Agreement to accept a Superior Proposal.',
  };
  assert.equal(mod.isTerminationRight(noShopCard), false);
  const rows = mod.terminationRightsConfig.selectRows({ cards: [noShopCard] });
  assert.deepEqual(rows, [], 'a no-shop card must never produce a termination-rights row');
});

test('isTerminationRight: a termination-fee card mentioning "superior proposal" or "outside date" is excluded', async () => {
  const mod = await rightsConfig();
  const feeCard = {
    provision_type: 'TERMINATION_FEE',
    provision_subtype: 'TERMF-TARGET',
    primary_quote: 'If, prior to the outside date, the Company terminates to accept a Superior Proposal, the Company shall pay the Termination Fee.',
  };
  assert.equal(mod.isTerminationRight(feeCard), false);
  const rows = mod.terminationRightsConfig.selectRows({ cards: [feeCard] });
  assert.deepEqual(rows, []);
});

test('isTerminationRight: a card claimed by another family (by code, no type at all) is still excluded', async () => {
  const mod = await rightsConfig();
  const codedElsewhere = { provision_subtype: 'NOSOL-MATCH', primary_quote: 'the Company terminates to accept a Superior Proposal after the matching period.' };
  assert.equal(mod.isTerminationRight(codedElsewhere), false);
});

test('isTerminationRight: a genuine subtype-less termination-rights card is still caught by the fallback', async () => {
  const mod = await rightsConfig();
  const caught = [
    { short_title: '[PROPOSED] Section 7.1', primary_quote: 'Either party may terminate this Agreement if the Merger has not been consummated by the outside date.' },
    { short_title: null, primary_quote: 'This is a termination right exercisable by either party upon notice.' },
    { provision_type: 'TERMINATION_RIGHT', provision_subtype: null, primary_quote: 'no keyword words here at all.' },
    // `type: 'TERMR'` alone (no provision_type, no code) does not satisfy the
    // first branch, so this one -- like the TERMF sibling case in
    // tests/termination-fee-card-selection.test.js -- depends on the text
    // fallback actually matching; unlike the entry above, its quote must
    // genuinely carry one of the three keywords.
    { type: 'TERMR', provision_subtype: null, primary_quote: 'Either party may exercise this termination right upon notice.' },
  ];
  for (const card of caught) assert.equal(mod.isTerminationRight(card), true, JSON.stringify(card));

  // And it still reaches the rendered table when nothing else claims it: an
  // unsubtyped card with no matching TERMR_CANONICAL code renders no family
  // row, but must not be silently dropped from selection itself.
  const rows = mod.terminationRightsConfig.selectRows({
    cards: [{ short_title: '[PROPOSED] Section 7.1', primary_quote: 'Either party may terminate after the outside date.' }],
  });
  // No canonical family/cross-cutting content matches an uncoded card, so the
  // table legitimately renders empty groups -- the assertion that matters is
  // that isTerminationRight() itself said true above, not that a full row
  // appears for a card with no resolvable concept.
  assert.ok(Array.isArray(rows));
});

test('isTerminationRight: nothing that merely mentions the keywords with no other signal was ever caught (sanity)', async () => {
  const mod = await rightsConfig();
  assert.equal(mod.isTerminationRight({ primary_quote: 'The Company shall hold a stockholders meeting.' }), false);
});

// ---------------------------------------------------------------------------
// 4. All four fee-table serving modes still work
// ---------------------------------------------------------------------------

function canonicalFeeCard() {
  return {
    id: 'canonical-fee',
    provision_type: 'TERMINATION_FEE',
    provision_subtype: 'TERMF-TARGET',
    primary_quote: 'Canonical fee clause.',
    features: { terminationFees: { amount: '$600,000,000' } },
    canonical_v2_lineage: { source: 'CANONICAL_V2_NATIVE_CLAIM' },
  };
}

test('all four fee-table modes render correctly with the split/relocated rows', async () => {
  const mod = await feesConfig();
  const SERVING_FIELD = mod.CANONICAL_V2_TERMINATION_FEE_SERVING_FIELD;
  const CARDS_FIELD = mod.CANONICAL_V2_TERMINATION_FEE_CARDS_FIELD;
  const COMPARE_FIELD = mod.CANONICAL_V2_TERMINATION_FEE_COMPARE_FIELD;
  const legacyCards = [termfEffectCard(true), termfSoleCard(false)];

  // Mode 1: legacy only (flag off).
  const legacyOnly = mod.terminationFeesConfig.selectRows({ cards: legacyCards });
  assert.ok(rowById(legacyOnly, 'termination-fees-willful-breach-effect'));
  assert.ok(rowById(legacyOnly, 'termination-fees-willful-breach-sole'));
  assert.equal(legacyOnly.some((row) => row.id === 'termination-fees-required'), false);

  // Mode 2: canonical only (flag on, deal has canonical data).
  const canonicalOnly = mod.terminationFeesConfig.selectRows({
    cards: [],
    [SERVING_FIELD]: true,
    [CARDS_FIELD]: [canonicalFeeCard()],
  });
  assert.equal(canonicalOnly[0].servingSourceState, 'CANONICAL');
  assert.ok(rowById(canonicalOnly, 'termination-fees-COMPANY_TERMINATION_FEE'));
  assert.ok(rowById(canonicalOnly, 'termination-fees-not-yet-extracted-willful-breach-effect'), 'the gapped surface must be named, not dropped');
  assert.ok(rowById(canonicalOnly, 'termination-fees-not-yet-extracted-willful-breach-sole'));
  assert.equal(canonicalOnly.some((row) => String(row.id).includes('required')), false);

  // Mode 3: canonical flag on, but THIS deal has no canonical data -- visible
  // legacy fallback notice.
  const fallback = mod.terminationFeesConfig.selectRows({
    cards: legacyCards,
    [SERVING_FIELD]: true,
    [CARDS_FIELD]: [],
  });
  assert.equal(fallback[0].servingSourceState, 'LEGACY_FALLBACK');
  assert.ok(rowById(fallback, 'termination-fees-willful-breach-effect'));
  assert.ok(rowById(fallback, 'termination-fees-willful-breach-sole'));

  // Mode 4: both sources side by side.
  const both = mod.terminationFeesConfig.selectRows({
    cards: legacyCards,
    [SERVING_FIELD]: true,
    [COMPARE_FIELD]: true,
    [CARDS_FIELD]: [canonicalFeeCard()],
  });
  assert.equal(both[0].servingSourceState, 'BOTH_SOURCES');
  const effectBoth = rowById(both, 'termination-fees-willful-breach-effect');
  const soleBoth = rowById(both, 'termination-fees-willful-breach-sole');
  assert.equal(effectBoth.sources.v1.headline, 'Yes');
  assert.equal(soleBoth.sources.v1.headline, 'No');
  assert.equal(effectBoth.sources.v2.present, false, 'V2 has no willful-breach claim in this fixture -- not-yet-extracted, not absent');
  assert.equal(both.some((row) => String(row.id).includes('required')), false, 'feeRequired must never resurface as a neither-source placeholder either');
});

// ---------------------------------------------------------------------------
// 5. No row id collides with the review-row-binding registry
// ---------------------------------------------------------------------------

test('row identity: neither table produces a duplicate id, and none of the new/moved ids are bound', async () => {
  const feesMod = await feesConfig();
  const rightsMod = await rightsConfig();

  const feeRows = feesMod.terminationFeesConfig.selectRows({
    cards: [
      { id: 'target', provision_type: 'TERMINATION_FEE', provision_subtype: 'TERMF-TARGET', primary_quote: 't', features: { terminationFees: { amount: '$1' } } },
      termfEffectCard(true, { id: 'effect' }),
      termfSoleCard(false, { id: 'sole' }),
      { id: 'tail', provision_type: 'TERMINATION_FEE', provision_subtype: 'TERMF-TAIL', primary_quote: 't', features: { nakedNoVoteFee: true } },
    ],
  });
  const feeIds = feeRows.map((row) => row.id);
  assert.equal(new Set(feeIds).size, feeIds.length, 'termination-fees table must never emit two rows sharing one id');

  const rightsRows = rightsMod.terminationRightsConfig.selectRows({
    cards: [
      { id: 'outside', provision_type: 'TERMINATION_RIGHT', provision_subtype: 'TERMR-OUTSIDE', primary_quote: 't', features: { outsideDate: '2026-06-30' } },
      termfEffectCard(true, { id: 'effect' }),
      { id: 'sp', provision_type: 'MISC_BOILERPLATE', provision_subtype: 'MISC-REMEDIES', primary_quote: 't', features: { specificPerformanceMutual: true } },
      { id: 'sup', provision_type: 'TERMINATION_RIGHT', provision_subtype: 'TERMR-SUPERIOR', primary_quote: 't', features: { feeRequired: true } },
    ],
  });
  const rightsIds = rightsRows[0].groups.flatMap((g) => g.rows.map((row) => row.id));
  assert.equal(new Set(rightsIds).size, rightsIds.length, 'termination-rights table must never emit two rows sharing one id');

  const boundRowIds = F4_REVIEW_ROW_BINDING_RULES.filter((rule) => rule.review.identity_kind === 'ROW_ID').map((rule) => rule.review.identity_value);
  // The willful-breach row was never bound before the split (confirmed here,
  // not merely asserted), so nothing needed preserving when it was renamed.
  assert.equal(boundRowIds.includes('termination-fees-willful-breach'), false);
  assert.equal(boundRowIds.includes('termination-fees-required'), false);
  for (const id of ['termination-fees-willful-breach-effect', 'termination-fees-willful-breach-sole', 'termination-rights-fee-required']) {
    assert.equal(boundRowIds.includes(id), false, `${id} must not collide with a bound review row`);
  }
  // The two rows that ARE bound remain present and correctly named --
  // unaffected by this change.
  assert.ok(boundRowIds.includes('termination-fees-COMPANY_TERMINATION_FEE'));
  assert.ok(boundRowIds.includes('termination-fees-REVERSE_TERMINATION_FEE'));
  assert.ok(feeIds.includes('termination-fees-COMPANY_TERMINATION_FEE'));
});

// ---------------------------------------------------------------------------
// 6. The RIGHTS table's OWN willful-breach cross-cutting rows (owner ruling 4)
// ---------------------------------------------------------------------------
//
// termination-rights.config.js#CROSS_CUTTING_ROWS' own
// 'termination-rights-willful-breach' row had the IDENTICAL defect
// (willfulBreachException read, unscoped, over TERMF-EFFECT/TERMF-SOLE cards
// that share the key but mean different things). It was first narrowed to
// TERMF-SOLE only, which fixed the wrong-answer defect but opened a gap: a
// deal whose only carve-out was to TERMF-EFFECT rendered nothing in this
// group. The owner has now ruled to close that gap the same way the fee
// table did: two rows, each scoped to its own code.

test('rights willful-breach: unguarded, card order alone decided which legally distinct fact rendered (the defect the split fixes)', () => {
  // firstCardWithFeature() as it read with no code scoping at all -- first
  // card in array order with a non-null willfulBreachException wins,
  // whichever family it belongs to.
  function unguardedFirstCardWithFeature(cards, keys) {
    for (const card of cards || []) {
      const f = card.features || {};
      for (const key of keys) {
        if (f[key] !== null && f[key] !== undefined && f[key] !== '') return { card, key, raw: f[key] };
      }
    }
    return null;
  }
  const effect = termfEffectCard(true);
  const sole = termfSoleCard(false);
  // Same two cards, opposite array order -> opposite answer, silently.
  const firstOrder = unguardedFirstCardWithFeature([effect, sole], ['willfulBreachException']);
  const secondOrder = unguardedFirstCardWithFeature([sole, effect], ['willfulBreachException']);
  assert.equal(firstOrder.card.provision_subtype, 'TERMF-EFFECT');
  assert.equal(secondOrder.card.provision_subtype, 'TERMF-SOLE');
  assert.notEqual(firstOrder.raw, secondOrder.raw, 'the unguarded lookup answers differently depending on array order alone');
});

test('rights willful-breach: a TERMF-EFFECT-only card populates ONLY the effect row -- the gap this split closes', async () => {
  const mod = await rightsConfig();
  // Before this fix, a TERMF-EFFECT-only deal rendered NOTHING in this
  // group: the row was scoped to TERMF-SOLE only, so an EFFECT-only carve-
  // out had no row anywhere in the table. This is the gap the owner's
  // extension ruling closes.
  const group = mod.crossCuttingGroup({ cards: [termfEffectCard(true)] });
  assert.ok(group, 'the group must now render for a TERMF-EFFECT-only deal');
  const effect = group.rows.find((row) => row.id === 'termination-rights-willful-breach-effect');
  const sole = group.rows.find((row) => row.id === 'termination-rights-willful-breach-sole');
  assert.ok(effect, 'the effect-of-termination carve-out row must render');
  assert.equal(effect.label, 'Willful-breach carve-out', 'label derives from rubric.js TERMF-EFFECT wording');
  assert.equal(effect.sourceCard.provision_subtype, 'TERMF-EFFECT');
  assert.equal(effect.value[0], 'Yes');
  assert.equal(sole, undefined, 'the sole-remedy row must NOT render -- there is no TERMF-SOLE card');
});

test('rights willful-breach: a TERMF-SOLE-only card populates ONLY the sole-remedy row', async () => {
  const mod = await rightsConfig();
  const group = mod.crossCuttingGroup({ cards: [termfSoleCard(true)] });
  const effect = group.rows.find((row) => row.id === 'termination-rights-willful-breach-effect');
  const sole = group.rows.find((row) => row.id === 'termination-rights-willful-breach-sole');
  assert.equal(effect, undefined, 'the effect-of-termination row must NOT render -- there is no TERMF-EFFECT card');
  assert.ok(sole, 'the row must render from a real TERMF-SOLE card');
  assert.equal(sole.label, 'Willful-breach carve-out to sole remedy', 'label derives from rubric.js TERMF-SOLE wording');
  assert.equal(sole.sourceCard.provision_subtype, 'TERMF-SOLE');
  assert.equal(sole.featureKeys[0], 'willfulBreachException');
});

// The regression test: both facts present with DIFFERENT values, in EITHER
// card order. Before the split, an unscoped search meant whichever card
// sorted first silently decided the single row's answer; a TERMF-SOLE-only
// scope fixed that but at the cost of the effect row entirely. Now each row
// is scoped to its own code, so both answers render and neither can move.
test('rights willful-breach: both facts render independently and correctly regardless of card order', async () => {
  const mod = await rightsConfig();
  for (const cards of [
    [termfEffectCard(true), termfSoleCard(false)],
    [termfSoleCard(false), termfEffectCard(true)],
  ]) {
    const group = mod.crossCuttingGroup({ cards });
    const effect = group.rows.find((row) => row.id === 'termination-rights-willful-breach-effect');
    const sole = group.rows.find((row) => row.id === 'termination-rights-willful-breach-sole');
    assert.equal(effect.sourceCard.provision_subtype, 'TERMF-EFFECT', 'effect row must read TERMF-EFFECT, never TERMF-SOLE, whatever the array order');
    assert.equal(sole.sourceCard.provision_subtype, 'TERMF-SOLE', 'sole row must read TERMF-SOLE, never TERMF-EFFECT, whatever the array order');
    assert.equal(effect.value[0], 'Yes', 'effect row must read TERMF-EFFECT\'s own value (true), never TERMF-SOLE\'s (false)');
    assert.equal(sole.value[0], 'No', 'sole row must read TERMF-SOLE\'s own value (false), never TERMF-EFFECT\'s (true)');
  }
});

test('rights willful-breach: the real end-to-end pipeline (terminationRightsConfig.selectRows) is scoped identically', async () => {
  const mod = await rightsConfig();
  for (const cards of [
    [termfEffectCard(true), termfSoleCard(false)],
    [termfSoleCard(false), termfEffectCard(true)],
  ]) {
    const rows = mod.terminationRightsConfig.selectRows({ cards });
    const remedies = rows[0].groups.find((g) => g.id === 'remedies');
    const effect = remedies.rows.find((row) => row.id === 'termination-rights-willful-breach-effect');
    const sole = remedies.rows.find((row) => row.id === 'termination-rights-willful-breach-sole');
    assert.equal(effect.sourceCard.provision_subtype, 'TERMF-EFFECT');
    assert.equal(sole.sourceCard.provision_subtype, 'TERMF-SOLE');
  }
});

test('rights willful-breach: row ids are distinct and neither collides with the pre-split id', async () => {
  const mod = await rightsConfig();
  const group = mod.crossCuttingGroup({ cards: [termfEffectCard(true), termfSoleCard(true)] });
  const ids = group.rows.map((row) => row.id);
  assert.equal(new Set(ids).size, ids.length, 'no two rows in the group may share an id');
  assert.deepEqual(ids.filter((id) => id.includes('willful-breach')).sort(), [
    'termination-rights-willful-breach-effect',
    'termination-rights-willful-breach-sole',
  ]);
  assert.equal(ids.includes('termination-rights-willful-breach'), false, 'the old single-row id must no longer be produced');
});

test('rights willful-breach: neither new row id is bound by the review-row-binding registry', async () => {
  const boundRowIds = F4_REVIEW_ROW_BINDING_RULES.filter((rule) => rule.review.identity_kind === 'ROW_ID').map((rule) => rule.review.identity_value);
  // The pre-split id was never bound either (confirmed here, not merely
  // asserted), so nothing needed preserving when it was renamed.
  assert.equal(boundRowIds.includes('termination-rights-willful-breach'), false);
  for (const id of ['termination-rights-willful-breach-effect', 'termination-rights-willful-breach-sole']) {
    assert.equal(boundRowIds.includes(id), false, `${id} must not collide with a bound review row`);
  }
});

test('rights willful-breach: verified negative -- specific-performance-mutual carries no code scope and is unaffected (rubric.js declares it once, no ambiguity to guard against)', async () => {
  const mod = await rightsConfig();
  // Two cards, two different codes, both carrying specificPerformanceMutual
  // -- unlike willfulBreachException there is no second, legally distinct
  // meaning for this key to disambiguate, so the first-found card is still
  // the correct (only) answer and the search stays unscoped.
  const cardA = { id: 'sp-a', provision_type: 'MISC_BOILERPLATE', provision_subtype: 'MISC-SPECIFIC', primary_quote: 'a', features: { specificPerformanceMutual: true } };
  const cardB = { id: 'sp-b', provision_type: 'MISC_BOILERPLATE', provision_subtype: 'REM-SP', primary_quote: 'b', features: { specificPerformanceMutual: true } };
  const group = mod.crossCuttingGroup({ cards: [cardA, cardB] });
  const specPerf = group.rows.find((row) => row.id === 'termination-rights-specific-performance-mutual');
  assert.ok(specPerf, 'unscoped lookup still finds the row from either code');
  assert.equal(specPerf.sourceCard.id, 'sp-a', 'first-in-order card still wins -- unchanged, since no ambiguity exists to guard against');
});
