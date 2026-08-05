'use strict';

// Per-family serving switch, termination fees: the FOURTH mode -- both sources
// rendered together so V1 and V2 can be compared by eye on the page.
//
// Ben's ruling (2026-08-05): switch to real Canonical V2 data as it lands, but
// keep V1 visible ON the rendering page, not merely retained in the database.
// Nine termination-fee fields have no V2 counterpart today; a straight switch
// makes them vanish, and to a lawyer a vanished row says "the agreement is
// silent", which is a different and far more damaging claim than "we have not
// extracted this yet".
//
// This suite proves the six properties the mode has to hold:
//   1. both sources render for the SAME term, distinguishably;
//   2. a disagreement is DETECTABLE in the output, not merely present;
//   3. a V2 gap reads as not-extracted BESIDE the V1 value, never as absent;
//   4. row identity does not move (the market sidebar stays attached);
//   5. the two card sets never merge (no hybrid row can be constructed);
//   6. the three existing modes are byte-identical to their current output.

const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const serving = require('../lib/canonical-v2/termination-fee-serving-source');
const { trimReviewDealForWire } = require('../lib/queries/review-deal-wire');
const { reconstructReviewDeal } = require('../lib/queries/reconstruct-review-deal');
const { bindPreparedRowsToReviewRows, findPreparedReviewBinding } = require('../lib/canonical-v2/review-row-binding');

const SERVING_FIELD = serving.CANONICAL_V2_TERMINATION_FEE_SERVING_FIELD;
const CARDS_FIELD = serving.CANONICAL_V2_TERMINATION_FEE_CARDS_FIELD;
const COMPARE_FIELD = serving.CANONICAL_V2_TERMINATION_FEE_COMPARE_FIELD;

const DEAL_VALUE_USD = 17000000000;

async function config() {
  return import('../components/review/table-configs/termination-fees.config.js');
}

// Stub primitives on the shared contract used by tests/r16-skechers-structured-
// voice.test.js, widened to surface tone/colour/wrap: the whole point of the
// verdict pill is that a difference is visible at a glance, so the tests have
// to be able to see which visual channel each pill lands in.
function primitives() {
  function PillCell({ label, tone, color, wrap }) {
    return React.createElement(
      'span',
      { className: 'pill' },
      `[PILL tone=${tone || ''} color=${color || ''} wrap=${wrap ? 'y' : 'n'} ${label}]`,
    );
  }
  return { PillCell };
}

function renderColumn(columns, columnId, row) {
  const column = columns.find((candidate) => candidate.id === columnId);
  assert.ok(column, `column ${columnId} must exist`);
  return renderToStaticMarkup(React.createElement('div', null, column.renderCell(row, { primitives: primitives() })));
}

// ---------------------------------------------------------------------------
// Fixtures. The legacy cards deliberately carry every field canonical has no
// counterpart for, so their disappearance under a straight switch -- and their
// survival under this mode -- are both observable.
// ---------------------------------------------------------------------------

const CANONICAL_TRIGGER_CODES = [
  'CHANGE_IN_RECOMMENDATION_TERMINATION',
  'STOCKHOLDER_APPROVAL_FAILURE_TERMINATION',
  'NO_SOLICIT_BREACH_TERMINATION',
  'COUNTERPARTY_COVENANT_BREACH_TERMINATION',
  'INTERVENING_EVENT_RECOMMENDATION_CHANGE_TERMINATION',
];

function legacyFeeCard(overrides = {}) {
  return {
    id: 'legacy-termf-target',
    deal_id: serving.QXO_TOPBUILD_DEAL_ID,
    provision_type: 'TERMINATION_FEE',
    provision_subtype: 'TERMF-TARGET',
    short_title: 'Company Termination Fee',
    primary_quote: 'The Company shall pay Parent a termination fee of $100,000,000.',
    features: {
      companyTerminationFee: {
        amount: '$100,000,000',
        percentage_of_equity: '9.9%',
        payment_deadline: 'two business days after termination',
        triggers: [{
          code: 'SUPERIOR_PROPOSAL_TERMINATION',
          label: 'Superior proposal',
          text: 'the Company terminates to accept a Superior Proposal',
        }],
        ...overrides,
      },
    },
  };
}

function legacySoleRemedyCard() {
  return {
    id: 'legacy-termf-sole',
    deal_id: serving.QXO_TOPBUILD_DEAL_ID,
    provision_type: 'TERMINATION_FEE',
    provision_subtype: 'TERMF-SOLE',
    short_title: 'Sole Remedy',
    primary_quote: 'Payment of the Company Termination Fee shall be the sole and exclusive remedy.',
    features: {
      // Established ABSENT: the extractor looked and recorded false.
      soleAndExclusiveRemedy: false,
      willfulBreachException: true,
      feeRequired: true,
      interestOnLatePayment: {
        rate: 'the prime rate of Bank of America (or its successors or assigns) in effect on the date such payment was required to be made',
        base: 'the amount of the payment',
      },
    },
  };
}

function legacyCards() {
  return [legacyFeeCard(), legacySoleRemedyCard()];
}

// Same $600,000,000 and the same five trigger CODES canonical resolves, under
// deliberately DIFFERENT display names -- the two extractions do not share a
// display vocabulary, and a comparison that matched on prose would report a
// difference that does not exist.
function legacyCardsAgreeingWithCanonical() {
  return [legacyFeeCard({
    amount: '$600,000,000',
    percentage_of_equity: undefined,
    payment_deadline: undefined,
    triggers: CANONICAL_TRIGGER_CODES.map((code, index) => ({
      code,
      label: `legacy vocabulary ${index}`,
      text: `legacy clause ${index}`,
    })),
  })];
}

function qxoCanonicalCards() {
  return serving.canonicalTerminationFeeCardsForDeal(serving.QXO_TOPBUILD_DEAL_ID);
}

function canonicalDeferredEvidenceCard() {
  return {
    id: 'canonical-open-world-sole-remedy',
    provision_type: 'TERMINATION_FEE',
    provision_subtype: 'OPEN-WORLD',
    short_title: 'Deferred Evidence',
    primary_quote: 'Payment of the Company Termination Fee shall be the sole and exclusive remedy of Parent.',
    features: {
      canonicalV2OpenWorldEvidence: { surface: 'SOLE_REMEDY', detail: 'Retained for later adjudication' },
    },
    canonical_v2_lineage: { source: 'CANONICAL_V2_OPEN_WORLD_EVIDENCE' },
  };
}

function canonicalInterestCard() {
  return {
    id: 'canonical-open-world-interest',
    provision_type: 'TERMINATION_FEE',
    provision_subtype: 'OPEN-WORLD',
    short_title: 'Deferred Evidence',
    primary_quote: 'If the termination fee is not paid when due, interest accrues at the Applicable Rate.',
    features: { interestOnLatePayment: true, latePaymentInterestBenchmark: 'Applicable Rate' },
    canonical_v2_lineage: { source: 'CANONICAL_V2_NATIVE_CLAIM' },
  };
}

function bothSourcesDeal({ cards = legacyCards(), canonical = qxoCanonicalCards() } = {}) {
  return {
    cards,
    value_usd: DEAL_VALUE_USD,
    [SERVING_FIELD]: true,
    [COMPARE_FIELD]: true,
    [CARDS_FIELD]: canonical,
  };
}

function rowById(rows, id) {
  return rows.find((row) => row.id === id) || null;
}

function pillLabels(signals) {
  return (signals || []).map((signal) => signal.label);
}

// ---------------------------------------------------------------------------
// 1. Both sources render for the same term, distinguishably
// ---------------------------------------------------------------------------

test('both-sources mode renders V1 and V2 values for the same term, each attributed', async () => {
  const mod = await config();
  const rows = mod.terminationFeesConfig.selectRows(bothSourcesDeal());

  const fee = rowById(rows, 'termination-fees-COMPANY_TERMINATION_FEE');
  assert.ok(fee, 'the company-fee surface must be one row carrying both sources');

  // One row, two named sides. The V1 figure is on screen, not merely retained.
  assert.equal(fee.sources.v1.label, mod.V1_COLUMN_HEADER);
  assert.equal(fee.sources.v2.label, mod.V2_COLUMN_HEADER);
  assert.equal(fee.sources.v1.headline, '$100,000,000');
  assert.equal(fee.sources.v2.headline, '$600,000,000');

  // Each side carries its OWN pills -- the values, the triggers, the coverage
  // gaps -- exactly as that side's own single-source table renders them.
  assert.ok(pillLabels(fee.sources.v1.signals).some((label) => label.startsWith('$100,000,000')));
  assert.ok(pillLabels(fee.sources.v1.signals).includes('Superior proposal'));
  assert.ok(pillLabels(fee.sources.v2.signals).some((label) => label.startsWith('$600,000,000')));
  assert.ok(pillLabels(fee.sources.v2.signals).includes('Change in recommendation'));

  // Neither side's pill set has been contaminated by the other's.
  assert.equal(pillLabels(fee.sources.v1.signals).some((label) => label.includes('$600,000,000')), false);
  assert.equal(pillLabels(fee.sources.v2.signals).some((label) => label.includes('$100,000,000')), false);
  assert.equal(pillLabels(fee.sources.v2.signals).some((label) => /Superior proposal/i.test(label)), false);
});

test('every legacy field with no V2 counterpart still has a visible V1 value', async () => {
  const mod = await config();
  const rows = mod.terminationFeesConfig.selectRows(bothSourcesDeal());
  const surfaces = [
    ['termination-fees-required', 'Yes'],
    ['termination-fees-sole-remedy', 'No'],
    ['termination-fees-willful-breach', 'Yes'],
    ['termination-fees-interest', 'Prime rate (Bank of America)'],
  ];
  for (const [rowId, expected] of surfaces) {
    const row = rowById(rows, rowId);
    assert.ok(row, `${rowId} must survive as a row, not vanish`);
    assert.equal(row.sources.v1.headline, expected);
    assert.deepEqual(pillLabels(row.sources.v1.signals), [expected]);
  }
});

test('the three-column shape is the side-by-side rendering, and only in this mode', async () => {
  const mod = await config();
  const rows = mod.terminationFeesConfig.selectRows(bothSourcesDeal());
  const columns = mod.terminationFeesConfig.columnsFor(rows);
  assert.deepEqual(columns.map((column) => column.id), ['term', 'source-v1', 'source-v2']);
  assert.deepEqual(columns.map((column) => column.header), ['Term', mod.V1_COLUMN_HEADER, mod.V2_COLUMN_HEADER]);

  const fee = rowById(rows, 'termination-fees-COMPANY_TERMINATION_FEE');
  const v1Cell = renderColumn(columns, 'source-v1', fee);
  const v2Cell = renderColumn(columns, 'source-v2', fee);
  assert.ok(v1Cell.includes('$100,000,000'));
  assert.equal(v1Cell.includes('$600,000,000'), false);
  assert.ok(v2Cell.includes('$600,000,000'));
  assert.equal(v2Cell.includes('$100,000,000'), false);

  // The header row itself names which extraction each column is.
  assert.match(mod.V1_COLUMN_HEADER, /^V1\b/);
  assert.match(mod.V2_COLUMN_HEADER, /^V2\b/);
});

// ---------------------------------------------------------------------------
// 2. A disagreement is DETECTABLE, not merely present
// ---------------------------------------------------------------------------

test('a disagreement is stated in words and carries both figures', async () => {
  const mod = await config();
  const rows = mod.terminationFeesConfig.selectRows(bothSourcesDeal());
  const fee = rowById(rows, 'termination-fees-COMPANY_TERMINATION_FEE');

  assert.equal(fee.sourceComparison.state, 'DIFFER');
  // A reader must never have to compare two numbers character by character:
  // the verdict SAYS they differ, and names both figures with their source.
  assert.equal(fee.detail, 'V1 and V2 differ — V1: $100,000,000 · V2: $600,000,000');
  assert.equal(fee.sourceComparison.v1, '$100,000,000');
  assert.equal(fee.sourceComparison.v2, '$600,000,000');

  // And it is in the RENDERED output, on the term, where the eye scans.
  const columns = mod.terminationFeesConfig.columnsFor(rows);
  const term = renderColumn(columns, 'term', fee);
  assert.ok(term.includes('Company termination fee'));
  assert.ok(term.includes('V1 and V2 differ'));
  assert.ok(term.includes('$100,000,000') && term.includes('$600,000,000'));
  // Its own visual channel, distinct from every other state, and wrapping so
  // the figures are never truncated to an ellipsis.
  assert.ok(term.includes('color=violet'));
  assert.ok(term.includes('wrap=y'));
});

test('agreement is stated too, and cross-vocabulary triggers are not a false difference', async () => {
  const mod = await config();
  const rows = mod.terminationFeesConfig.selectRows(bothSourcesDeal({ cards: legacyCardsAgreeingWithCanonical() }));
  const fee = rowById(rows, 'termination-fees-COMPANY_TERMINATION_FEE');

  assert.equal(fee.sourceComparison.state, 'MATCH');
  assert.equal(fee.detail, 'V1 and V2 agree — $600,000,000');

  // The two sides name the same five grounds completely differently. They are
  // matched on the canonical trigger CODE, so different prose for the same
  // ground is not reported as a disagreement.
  assert.ok(pillLabels(fee.sources.v1.signals).includes('legacy vocabulary 0'));
  assert.ok(pillLabels(fee.sources.v2.signals).includes('Change in recommendation'));

  const columns = mod.terminationFeesConfig.columnsFor(rows);
  const term = renderColumn(columns, 'term', fee);
  assert.ok(term.includes('V1 and V2 agree'));
  assert.ok(term.includes('tone=present'));
  assert.equal(term.includes('color=violet'), false);
});

test('a same-value / different-triggers row is still reported as a difference', async () => {
  const mod = await config();
  const rows = mod.terminationFeesConfig.selectRows(bothSourcesDeal({
    cards: [legacyFeeCard({
      amount: '$600,000,000',
      percentage_of_equity: undefined,
      payment_deadline: undefined,
      triggers: [{ code: 'SUPERIOR_PROPOSAL_TERMINATION', label: 'Superior proposal', text: 'superior proposal' }],
    })],
  }));
  const fee = rowById(rows, 'termination-fees-COMPANY_TERMINATION_FEE');

  // The amounts agree; a headline-only comparison would show green here and
  // silently hide that the two extractions found completely different grounds.
  assert.equal(fee.sourceComparison.state, 'DIFFER');
  assert.match(fee.detail, /^V1 and V2 differ — same value \(\$600,000,000\), triggers differ/);
  assert.match(fee.detail, /only V1: Superior proposal/);
  assert.match(fee.detail, /only V2: Change in recommendation/);
});

test('the five comparison states are visually distinct from one another', async () => {
  const mod = await config();
  const rows = mod.terminationFeesConfig.selectRows(bothSourcesDeal({
    canonical: [...qxoCanonicalCards(), canonicalDeferredEvidenceCard(), canonicalInterestCard()],
  }));
  const columns = mod.terminationFeesConfig.columnsFor(rows);
  const channelFor = (rowId) => {
    const row = rowById(rows, rowId);
    assert.ok(row, `${rowId} must exist`);
    const term = renderColumn(columns, 'term', row);
    return `${(term.match(/tone=([a-z]*)/) || [])[1]}/${(term.match(/color=([a-z]*)/) || [])[1]}`;
  };
  const states = {
    DIFFER: channelFor('termination-fees-COMPANY_TERMINATION_FEE'),
    V2_NOT_YET_EXTRACTED: channelFor('termination-fees-sole-remedy'),
    V2_PARTIAL: channelFor('termination-fees-interest'),
    V1_ABSENT: channelFor('termination-fees-deferred-canonical-open-world-sole-remedy'),
    NEITHER_SOURCE: channelFor('termination-fees-not-yet-extracted-REVERSE_TERMINATION_FEE'),
  };
  assert.equal(rowById(rows, 'termination-fees-COMPANY_TERMINATION_FEE').sourceComparison.state, 'DIFFER');
  assert.equal(rowById(rows, 'termination-fees-interest').sourceComparison.state, 'V2_PARTIAL');
  assert.equal(
    rowById(rows, 'termination-fees-deferred-canonical-open-world-sole-remedy').sourceComparison.state,
    'V1_ABSENT',
  );
  // Disagreement, an agreed value, and a coverage gap must never share a
  // channel -- otherwise the colour says nothing.
  assert.notEqual(states.DIFFER, states.V2_NOT_YET_EXTRACTED);
  assert.notEqual(states.DIFFER, states.V1_ABSENT);
  assert.notEqual(states.V2_NOT_YET_EXTRACTED, states.V1_ABSENT);
});

// ---------------------------------------------------------------------------
// 3. A V2 gap reads as NOT EXTRACTED beside the V1 value, never as absent
// ---------------------------------------------------------------------------

test('a V2 gap renders as not-yet-extracted beside the V1 value, not as absence', async () => {
  const mod = await config();
  const rows = mod.terminationFeesConfig.selectRows(bothSourcesDeal());
  const soleRemedy = rowById(rows, 'termination-fees-sole-remedy');

  assert.ok(soleRemedy, 'the row must not vanish -- a vanished row reads as "the agreement is silent"');
  assert.equal(soleRemedy.sourceComparison.state, 'V2_NOT_YET_EXTRACTED');
  assert.equal(soleRemedy.detail, 'Not yet extracted in V2 — V1: No');

  // V1's established negative, and V2's silence, side by side and different.
  assert.deepEqual(pillLabels(soleRemedy.sources.v1.signals), ['No']);
  assert.deepEqual(pillLabels(soleRemedy.sources.v2.signals), [mod.NOT_YET_EXTRACTED_DETAIL]);
  assert.equal(soleRemedy.sources.v2.signals[0].label, 'Not yet extracted');

  // Grey `missing` is the app's established-absent pill. V2's cell must never
  // wear it: that would be V2 asserting a negative it has not established.
  assert.equal(soleRemedy.sources.v1.signals[0].tone, 'missing');
  assert.equal(soleRemedy.sources.v2.signals[0].tone, 'warning');
  assert.notEqual(soleRemedy.sources.v2.signals[0].tone, soleRemedy.sources.v1.signals[0].tone);

  const columns = mod.terminationFeesConfig.columnsFor(rows);
  assert.ok(renderColumn(columns, 'source-v1', soleRemedy).includes('tone=missing'));
  const v2Cell = renderColumn(columns, 'source-v2', soleRemedy);
  assert.ok(v2Cell.includes('Not yet extracted'));
  assert.ok(v2Cell.includes('tone=warning'));
  assert.equal(v2Cell.includes('tone=missing'), false);
  assert.equal(/>\s*No\s*</.test(v2Cell), false, 'V2 must never render the established-absent "No"');
});

test('a V2 row that is only partly extracted says so rather than reading as a disagreement', async () => {
  const mod = await config();
  const rows = mod.terminationFeesConfig.selectRows(bothSourcesDeal({
    canonical: [...qxoCanonicalCards(), canonicalInterestCard()],
  }));
  const interest = rowById(rows, 'termination-fees-interest');
  assert.equal(interest.sourceComparison.state, 'V2_PARTIAL');
  assert.equal(
    interest.detail,
    'V2 only partly extracted — V1: Prime rate (Bank of America) · V2: Yes (reference rate not yet extracted)',
  );
  assert.equal(interest.sources.v1.headline, 'Prime rate (Bank of America)');
  assert.equal(interest.sources.v2.headline, 'Yes (reference rate not yet extracted)');
});

test('a field-level V2 gap inside a served row is still named', async () => {
  const mod = await config();
  const rows = mod.terminationFeesConfig.selectRows(bothSourcesDeal());
  const fee = rowById(rows, 'termination-fees-COMPANY_TERMINATION_FEE');
  // V2 served the amount but not the % of equity / deadline / sole-remedy
  // status. Those are absent from V2's cell BUT present in V1's -- so the gap
  // has to be named, or V2's cell reads as a complete fee row.
  const gap = fee.sources.v2.signals.find((signal) => signal.tone === 'warning');
  assert.ok(gap);
  assert.equal(gap.label, 'Not yet extracted: % of equity value, payment deadline, sole-remedy status');
  assert.ok(pillLabels(fee.sources.v1.signals).some((label) => label.includes('9.9% of equity value')));
});

test('a surface neither source produced is named for both sides, never dropped', async () => {
  const mod = await config();
  const rows = mod.terminationFeesConfig.selectRows(bothSourcesDeal());
  const reverse = rowById(rows, 'termination-fees-not-yet-extracted-REVERSE_TERMINATION_FEE');
  assert.ok(reverse);
  assert.equal(reverse.label, 'Reverse termination fee');
  assert.equal(reverse.sourceComparison.state, 'NEITHER_SOURCE');
  assert.deepEqual(pillLabels(reverse.sources.v1.signals), [mod.NOT_IN_V1_DETAIL]);
  assert.deepEqual(pillLabels(reverse.sources.v2.signals), [mod.NOT_YET_EXTRACTED_DETAIL]);
  // Neither side is allowed to wear the established-absent grey here either.
  assert.equal(reverse.sources.v1.signals[0].tone, 'neutral');
  assert.equal(reverse.sources.v2.signals[0].tone, 'warning');
  assert.equal(reverse.present, false);
  assert.equal(reverse.marketSkip, true);
});

// ---------------------------------------------------------------------------
// 4. Row identity does not move
// ---------------------------------------------------------------------------

test('the two market-bound row ids appear exactly once and are unchanged', async () => {
  const mod = await config();
  const rows = mod.terminationFeesConfig.selectRows(bothSourcesDeal({
    canonical: [...qxoCanonicalCards(), canonicalDeferredEvidenceCard()],
  }));
  const ids = rows.map((row) => row.id);
  assert.equal(new Set(ids).size, ids.length, 'no duplicate row ids -- a duplicate detaches the market sidebar');
  assert.equal(ids.filter((id) => id === 'termination-fees-COMPANY_TERMINATION_FEE').length, 1);

  // Every row this mode ADDS beyond the two sources' own rows carries the
  // existing distinct placeholder prefix, never a real surface id.
  const added = rows.filter((row) => row.sourceComparison?.state === 'NEITHER_SOURCE');
  assert.ok(added.length);
  for (const row of added) assert.match(row.id, /^termination-fees-not-yet-extracted-/);
  assert.equal(
    rows.some((row) => row.sourceComparison?.state === 'NEITHER_SOURCE'
      && (row.id === 'termination-fees-COMPANY_TERMINATION_FEE' || row.id === 'termination-fees-REVERSE_TERMINATION_FEE')),
    false,
  );
});

test('the governed F4 seller-fee binding still resolves against a both-sources table', async () => {
  const mod = await config();
  const rows = mod.terminationFeesConfig.selectRows(bothSourcesDeal());
  const reviewRows = rows.map((row) => ({ section_id: 'termination-fees', group_id: null, row_id: row.id }));
  const prepared = [{
    row_key: 'prepared-seller-fee',
    governed_binding: {
      concept_key: 'TERMF-TARGET',
      concept_version: 1,
      metric_key: 'SELLER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE',
      metric_version: 1,
      party: { role: 'FEE_PAYER', value: 'COMPANY', capacity: 'TARGET' },
      component_slot_key: 'FEE_AMOUNT',
      result_ordinal: 0,
      governed_ordinal: 0,
    },
    resolution: { rowKind: 'CANONICAL_RESULT' },
  }];

  const result = bindPreparedRowsToReviewRows({ prepared_rows: prepared, review_rows: reviewRows });
  assert.deepEqual(result.errors, []);
  const binding = result.bindings.find((item) => item.binding_key === 'F4_SELLER_TERMINATION_FEE');
  assert.ok(binding, 'the seller-fee binding must still attach');
  assert.equal(binding.review_row.row_id, 'termination-fees-COMPANY_TERMINATION_FEE');

  // And the reverse lookup is unambiguous -- more than one matching row would
  // throw AMBIGUOUS_BOUND_REVIEW_ROW.
  assert.doesNotThrow(() => findPreparedReviewBinding(result, {
    section_id: 'termination-fees',
    group_id: null,
    row_id: 'termination-fees-COMPANY_TERMINATION_FEE',
  }));
});

// ---------------------------------------------------------------------------
// 5. The two card sets never merge
// ---------------------------------------------------------------------------

test('the two card sets never merge into a hybrid, in either card order', async () => {
  const mod = await config();
  const canonical = qxoCanonicalCards();
  const legacy = legacyCards();

  for (const cards of [[...legacy, ...canonical], [...canonical, ...legacy]]) {
    const rows = mod.terminationFeesConfig.selectRows({
      cards,
      value_usd: DEAL_VALUE_USD,
      [SERVING_FIELD]: true,
      [COMPARE_FIELD]: true,
    });
    const fee = rowById(rows, 'termination-fees-COMPANY_TERMINATION_FEE');
    assert.ok(fee);

    // V1's side is wholly V1: legacy amount, legacy percentage, legacy deadline.
    const v1 = pillLabels(fee.sources.v1.signals).join(' | ');
    assert.ok(v1.includes('$100,000,000'));
    assert.ok(v1.includes('9.9% of equity value'));
    assert.equal(v1.includes('$600,000,000'), false);

    // V2's side is wholly V2: canonical amount, the percentage COMPUTED from it
    // and the deal's own value_usd, and no legacy deadline riding along.
    const v2 = pillLabels(fee.sources.v2.signals).join(' | ');
    assert.ok(v2.includes('$600,000,000'));
    assert.ok(v2.includes('3.5% of deal value'));
    assert.equal(v2.includes('9.9%'), false);
    assert.equal(v2.includes('$100,000,000'), false);
    assert.equal(/Deadline:/.test(v2), false);

    // The hybrid -- one value composed from both -- exists nowhere on the row.
    assert.equal(fee.sources.v1.headline, '$100,000,000');
    assert.equal(fee.sources.v2.headline, '$600,000,000');
  }
});

test('joining happens on rows, after each side is fully determined, never on cards', async () => {
  const mod = await config();
  const legacy = legacyCards();
  const canonical = qxoCanonicalCards();

  // The partition still separates the card sets before either row builder runs.
  const { legacyCards: l, canonicalCards: c } = mod.partitionTerminationFeeCards({ cards: [...legacy, ...canonical] });
  const legacyIds = new Set(l.map((card) => card.id));
  assert.equal(c.some((card) => legacyIds.has(card.id)), false);

  // And each side of the joined row is exactly the row that side's own
  // single-source table produces from its own cards alone.
  const v1Alone = mod.terminationFeesConfig.selectRows({ cards: legacy, value_usd: DEAL_VALUE_USD });
  const rows = mod.terminationFeesConfig.selectRows(bothSourcesDeal());
  const feeV1Alone = rowById(v1Alone, 'termination-fees-COMPANY_TERMINATION_FEE');
  const feeJoined = rowById(rows, 'termination-fees-COMPANY_TERMINATION_FEE');
  assert.deepEqual(
    pillLabels(feeJoined.sources.v1.signals),
    pillLabels(feeV1Alone.signals),
    'the V1 cell must be byte-identical to V1\'s own table',
  );
});

// ---------------------------------------------------------------------------
// 6. The three existing modes are byte-identical to their current output
// ---------------------------------------------------------------------------

function threeExistingModes(mod) {
  const canonical = qxoCanonicalCards();
  return {
    'flag off (legacy)': { cards: legacyCards(), value_usd: DEAL_VALUE_USD },
    'flag on, canonical data': {
      cards: legacyCards(), value_usd: DEAL_VALUE_USD, [SERVING_FIELD]: true, [CARDS_FIELD]: canonical,
    },
    'flag on, no canonical data': {
      cards: legacyCards(), value_usd: DEAL_VALUE_USD, [SERVING_FIELD]: true, [CARDS_FIELD]: [],
    },
    _mod: mod,
  };
}

test('flag off is still byte-identical to the literal pre-switch expression', async () => {
  const mod = await config();
  const cards = legacyCards();
  const expected = [
    ...mod.feeTableRows(cards, DEAL_VALUE_USD),
    ...mod.scalarRows(cards),
    ...mod.deferredEvidenceRows(cards),
  ];
  const rows = mod.terminationFeesConfig.selectRows({ cards, value_usd: DEAL_VALUE_USD });
  assert.equal(JSON.stringify(rows), JSON.stringify(expected));
});

test('the three existing modes carry no both-sources data and no third column', async () => {
  const mod = await config();
  const modes = threeExistingModes(mod);
  for (const [name, reviewDeal] of Object.entries(modes)) {
    if (name === '_mod') continue;
    const rows = mod.terminationFeesConfig.selectRows(reviewDeal);
    assert.ok(rows.length, `${name} must still produce rows`);
    assert.equal(rows.some((row) => row.sources), false, `${name} must carry no per-source cells`);
    assert.equal(rows.some((row) => row.sourceComparison), false, `${name} must carry no comparison verdict`);
    assert.equal(rows.some((row) => row.servingSourceState === 'BOTH_SOURCES'), false);
    // ProvisionTable.jsx falls back to config.columns whenever columnsFor
    // returns null, so the rendered table shape is unchanged too.
    assert.equal(mod.terminationFeesConfig.columnsFor(rows), null, `${name} must keep the two-column shape`);
  }
  assert.deepEqual(mod.terminationFeesConfig.columns.map((column) => column.id), ['term', 'signals']);
});

test('anything but the exact boolean true leaves the three modes untouched', async () => {
  const mod = await config();
  const modes = threeExistingModes(mod);
  const notTrue = [undefined, false, null, 0, '', 'true', 'TRUE', 1, {}, [], Object(true), 'ENABLED'];
  for (const [name, reviewDeal] of Object.entries(modes)) {
    if (name === '_mod') continue;
    const baselineRows = mod.terminationFeesConfig.selectRows(reviewDeal);
    assert.ok(baselineRows.length, `${name} must produce rows to compare against`);
    const baseline = JSON.stringify(baselineRows);
    for (const value of notTrue) {
      const rows = mod.terminationFeesConfig.selectRows({ ...reviewDeal, [COMPARE_FIELD]: value });
      assert.equal(JSON.stringify(rows), baseline,
        `${name} with compare=${JSON.stringify(value)} must be byte-identical`);
    }
    // A prototype-chain compare flag can never reach the fourth mode either.
    const polluted = Object.create({ [COMPARE_FIELD]: true });
    Object.assign(polluted, reviewDeal);
    assert.equal(JSON.stringify(mod.terminationFeesConfig.selectRows(polluted)), baseline);
  }
});

test('compare mode requires the serving flag, and degrades visibly with no canonical data', async () => {
  const mod = await config();

  // Compare on, serving off: fails closed to plain legacy.
  const servingOff = mod.terminationFeesConfig.selectRows({
    cards: legacyCards(), value_usd: DEAL_VALUE_USD, [COMPARE_FIELD]: true, [CARDS_FIELD]: qxoCanonicalCards(),
  });
  assert.equal(servingOff.some((row) => row.sources), false);
  assert.equal(
    JSON.stringify(servingOff),
    JSON.stringify(mod.terminationFeesConfig.selectRows({ cards: legacyCards(), value_usd: DEAL_VALUE_USD })),
  );

  // Compare on, serving on, but this deal has no canonical data: the existing
  // visible legacy fallback, unchanged -- there is no second source to show.
  const noData = mod.terminationFeesConfig.selectRows({
    cards: legacyCards(), value_usd: DEAL_VALUE_USD, [SERVING_FIELD]: true, [COMPARE_FIELD]: true, [CARDS_FIELD]: [],
  });
  assert.equal(noData[0].servingSourceState, 'LEGACY_FALLBACK');
  assert.equal(noData.some((row) => row.sources), false);
});

// ---------------------------------------------------------------------------
// Provenance, evidence and the two-column fallback rendering
// ---------------------------------------------------------------------------

test('the table says which extraction each column is', async () => {
  const mod = await config();
  const rows = mod.terminationFeesConfig.selectRows(bothSourcesDeal());
  assert.equal(rows[0].id, 'termination-fees-serving-source');
  assert.equal(rows[0].servingSourceState, 'BOTH_SOURCES');
  assert.equal(rows[0].detail, 'V1 legacy extraction and Canonical V2, rendered side by side');
  assert.equal(rows[0].marketSkip, true);
  assert.equal(rows[0].sourceComparison, undefined, 'a provenance notice has nothing to compare');
  assert.deepEqual(pillLabels(rows[0].sources.v1.signals), ['Legacy extraction']);
  assert.deepEqual(pillLabels(rows[0].sources.v2.signals), ['Canonical V2']);
});

test('the provision expander shows both sources\' text, each labelled', async () => {
  const mod = await config();
  const rows = mod.terminationFeesConfig.selectRows(bothSourcesDeal());
  const fee = rowById(rows, 'termination-fees-COMPANY_TERMINATION_FEE');
  assert.match(fee.evidence, /V1 — legacy extraction/);
  assert.match(fee.evidence, /V2 — Canonical V2/);
  assert.ok(fee.evidence.includes('termination fee of \$100,000,000'));
  assert.ok(fee.evidence.includes('$600,000,000.'));
  // Two labelled quotes, never one unattributed block.
  assert.ok(fee.evidence.indexOf('V1 — legacy extraction') < fee.evidence.indexOf('V2 — Canonical V2'));
});

test('the two-column fallback attributes every pill to its source', async () => {
  const mod = await config();
  const rows = mod.terminationFeesConfig.selectRows(bothSourcesDeal());
  const fee = rowById(rows, 'termination-fees-COMPANY_TERMINATION_FEE');

  // CompareColumn.jsx's unified table reads config.columns directly, so the
  // stacked form must carry the same three pieces -- and nothing unattributed.
  const html = renderToStaticMarkup(React.createElement('div', null, mod.renderSignals(fee, { primitives: primitives() })));
  assert.ok(html.includes('V1 and V2 differ'));
  assert.ok(html.includes('V1 · $100,000,000'));
  assert.ok(html.includes('V2 · $600,000,000'));
  const unattributed = pillLabels(fee.signals).filter((label) => !/^(V1 · |V2 · |V1 and V2 )/.test(label));
  assert.deepEqual(unattributed, [], 'no pill in the stacked form may be unattributed');

  // Signal ids stay unique across both sides (React keys).
  const ids = fee.signals.map((signal) => signal.id);
  assert.equal(new Set(ids).size, ids.length);
});

// ---------------------------------------------------------------------------
// Server gate and wire plumbing for the fourth mode
// ---------------------------------------------------------------------------

test('the compare env gate fails closed and is unreachable in production', () => {
  const servingKey = serving.CANONICAL_V2_TERMINATION_FEE_SERVING_ENV_KEY;
  const servingOn = serving.CANONICAL_V2_TERMINATION_FEE_SERVING_ENABLED_VALUE;
  const compareKey = serving.CANONICAL_V2_TERMINATION_FEE_COMPARE_ENV_KEY;
  const compareOn = serving.CANONICAL_V2_TERMINATION_FEE_COMPARE_ENABLED_VALUE;

  assert.equal(serving.isCanonicalV2TerminationFeeCompareEnabled({}), false);
  assert.equal(serving.isCanonicalV2TerminationFeeCompareEnabled(undefined), false);
  assert.equal(serving.isCanonicalV2TerminationFeeCompareEnabled(null), false);
  assert.equal(serving.isCanonicalV2TerminationFeeCompareEnabled('ENABLED'), false);

  // Compare without serving is off: there would be no second source.
  assert.equal(serving.isCanonicalV2TerminationFeeCompareEnabled({ [compareKey]: compareOn }), false);
  // Serving without compare is the third mode, not the fourth.
  assert.equal(serving.isCanonicalV2TerminationFeeCompareEnabled({ [servingKey]: servingOn }), false);
  // Both sentinels, local: on.
  assert.equal(
    serving.isCanonicalV2TerminationFeeCompareEnabled({ [servingKey]: servingOn, [compareKey]: compareOn }),
    true,
  );
  // Truthy stand-ins are not the sentinel.
  for (const value of ['1', 'true', 'on', 'yes', 'enabled', true, 1]) {
    assert.equal(
      serving.isCanonicalV2TerminationFeeCompareEnabled({ [servingKey]: servingOn, [compareKey]: value }),
      false,
    );
  }
  // Production is unreachable, both sentinels or not.
  assert.equal(serving.isCanonicalV2TerminationFeeCompareEnabled({
    [servingKey]: servingOn, [compareKey]: compareOn, NODE_ENV: 'production',
  }), false);
  assert.equal(serving.isCanonicalV2TerminationFeeCompareEnabled({
    [servingKey]: servingOn, [compareKey]: compareOn, VERCEL: '1', VERCEL_ENV: 'production',
  }), false);
  // A prototype-chain sentinel is not an own property.
  assert.equal(serving.isCanonicalV2TerminationFeeCompareEnabled(
    Object.create({ [servingKey]: servingOn, [compareKey]: compareOn }),
  ), false);
});

test('the compare field is stamped only when its own sentinel is set, and rides the wire', async () => {
  const mod = await config();
  const servingKey = serving.CANONICAL_V2_TERMINATION_FEE_SERVING_ENV_KEY;
  const servingOn = serving.CANONICAL_V2_TERMINATION_FEE_SERVING_ENABLED_VALUE;
  const compareKey = serving.CANONICAL_V2_TERMINATION_FEE_COMPARE_ENV_KEY;
  const compareOn = serving.CANONICAL_V2_TERMINATION_FEE_COMPARE_ENABLED_VALUE;
  const fetched = {
    dealId: serving.QXO_TOPBUILD_DEAL_ID,
    cardCount: 2,
    cards: legacyCards(),
    value_usd: DEAL_VALUE_USD,
  };

  // Serving only: the field is absent entirely, so the third mode's payload is
  // bit-for-bit what it is today.
  const servingOnly = serving.attachCanonicalTerminationFeeServing(fetched, { env: { [servingKey]: servingOn } });
  assert.equal(Object.prototype.hasOwnProperty.call(servingOnly, COMPARE_FIELD), false);
  assert.equal(
    Object.prototype.hasOwnProperty.call(trimReviewDealForWire({ ...servingOnly, cardCount: 2 }), COMPARE_FIELD),
    false,
  );

  // Both sentinels: stamped, carried through the wire, and it drives the mode.
  const served = reconstructReviewDeal(trimReviewDealForWire(serving.attachCanonicalTerminationFeeServing(
    fetched,
    { env: { [servingKey]: servingOn, [compareKey]: compareOn } },
  )));
  assert.equal(served[COMPARE_FIELD], true);
  const rows = mod.terminationFeesConfig.selectRows(served);
  assert.equal(rows[0].servingSourceState, 'BOTH_SOURCES');
  const fee = rowById(rows, 'termination-fees-COMPANY_TERMINATION_FEE');
  assert.equal(fee.sources.v1.headline, '$100,000,000');
  assert.equal(fee.sources.v2.headline, '$600,000,000');
  // The legacy cards still ride the payload untouched.
  assert.equal(served.cards.length, 2);

  // Production stays on legacy through the same pipeline.
  const production = reconstructReviewDeal(trimReviewDealForWire(serving.attachCanonicalTerminationFeeServing(
    fetched,
    { env: { [servingKey]: servingOn, [compareKey]: compareOn, VERCEL: '1', VERCEL_ENV: 'production' } },
  )));
  assert.equal(Object.prototype.hasOwnProperty.call(production, COMPARE_FIELD), false);
  assert.equal(mod.terminationFeesConfig.selectRows(production).some((row) => row.sources), false);
});

test('the client-side and server-side compare field names agree', async () => {
  const mod = await config();
  assert.equal(mod.CANONICAL_V2_TERMINATION_FEE_COMPARE_FIELD, COMPARE_FIELD);
  assert.equal(COMPARE_FIELD, 'canonical_v2_termination_fee_compare_enabled');
});

// ---------------------------------------------------------------------------
// FEE_TRIGGER_LABELS gap (same change): two encoded grounds had no label and
// rendered as lowercased machine codes.
// ---------------------------------------------------------------------------

test('every encoded QXO trigger renders as a legal name, never a machine code', () => {
  const cards = qxoCanonicalCards();
  const triggers = cards[0].features.companyTerminationFee.triggers;
  const byCode = new Map(triggers.map((trigger) => [trigger.code, trigger.label]));

  assert.equal(byCode.get('COUNTERPARTY_COVENANT_BREACH_TERMINATION'), 'Counterparty covenant breach');
  assert.equal(byCode.get('INTERVENING_EVENT_RECOMMENDATION_CHANGE_TERMINATION'), 'Intervening-event recommendation change');

  // No label may be the lowercased-code fallback, and each reads like the six
  // that already had entries (sentence case, no underscores, no "termination"
  // suffix bolted on from the code).
  for (const trigger of triggers) {
    assert.notEqual(trigger.label, String(trigger.code).replaceAll('_', ' ').toLowerCase());
    assert.equal(/_/.test(trigger.label), false);
    assert.match(trigger.label, /^[A-Z]/);
    assert.equal(/\btermination$/i.test(trigger.label), false);
  }
});

test('the new labels reach the rendered table in both-sources mode', async () => {
  const mod = await config();
  const rows = mod.terminationFeesConfig.selectRows(bothSourcesDeal());
  const columns = mod.terminationFeesConfig.columnsFor(rows);
  const v2Cell = renderColumn(columns, 'source-v2', rowById(rows, 'termination-fees-COMPANY_TERMINATION_FEE'));
  assert.ok(v2Cell.includes('Counterparty covenant breach'));
  assert.ok(v2Cell.includes('Intervening-event recommendation change'));
  assert.equal(v2Cell.includes('counterparty covenant breach termination'), false);
  assert.equal(v2Cell.includes('intervening event recommendation change termination'), false);
});
