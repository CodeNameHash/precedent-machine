// Feedback round 2 punch-list items #4-#8 (see FEEDBACK-2-PUNCHLIST.md
// "## Equity Awards" + "## DATA FINDINGS" #5): rebuilds Equity Awards off
// `equityAwardTreatment` as a real per-instrument map (the reliable join),
// removes the "Approximate pairing" icon and the Notes column, fixes the CVR
// Entitlement copy, and renders Consideration/Vesting Treatment as pills.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

let mod;
test.before(async () => {
  mod = await import(path.join('..', 'components', 'review', 'table-configs', 'equity-awards.config.js'));
});

// Real Metsera shape (verified against live claims data): ONE un-split
// CONSID-EQUITY card whose outstandingInstruments/instrumentTreatments/
// instrumentVesting are three independently alphabetically-sorted lists
// (so positional zipping is wrong), but whose equityAwardTreatment is a
// single object keyed by instrument with each instrument's own clause text.
function metseraStyleCard() {
  return {
    id: 'consid-equity-metsera',
    provision_type: 'CONSIDERATION',
    provision_subtype: 'CONSID-EQUITY',
    short_title: 'Treatment of Equity Awards / Stock Plans',
    primary_quote: 'SECTION 2.03. Treatment of Company Equity Awards.',
    features: {
      outstandingInstruments: [
        { code: 'ESPP', label: 'ESPP', text: 'ESPP' },
        { code: 'RESTRICTED_STOCK', label: 'Restricted Stock Awards', text: 'RESTRICTED_STOCK' },
        { code: 'STOCK_OPTIONS', label: 'Stock Options', text: 'STOCK_OPTIONS' },
      ],
      instrumentTreatments: [
        { code: 'ACCELERATED_VESTING', label: 'Accelerated Vesting', text: 'ACCELERATED_VESTING' },
        { code: 'CANCELLED_NO_CONSIDERATION', label: 'Cancelled No Consideration', text: 'CANCELLED_NO_CONSIDERATION' },
        { code: 'CASHED_OUT_SPREAD', label: 'Cashed Out Spread', text: 'CASHED_OUT_SPREAD' },
      ],
      instrumentVesting: [
        { code: 'ACCEL_ELSE_DOUBLE_TRIGGER', label: 'Accel Else Double Trigger', text: 'ACCEL_ELSE_DOUBLE_TRIGGER' },
        { code: 'FULLY_ACCELERATED', label: 'Fully Accelerated', text: 'FULLY_ACCELERATED' },
        { code: 'NO_ACCELERATION', label: 'No Acceleration', text: 'NO_ACCELERATION' },
      ],
      equityAwardTreatment: {
        espp: 'Company ESPP is frozen, no new participants or increased elections are permitted, the current offering period is shortened, and the ESPP terminates before the Effective Time.',
        stockOptions: 'Company Stock Options are cancelled. In-the-money options receive cash equal to the Closing Amount less the exercise price, plus one CVR per underlying share. Unvested options remain subject to vesting terms, including double-trigger protection. Underwater options are cancelled for no consideration.',
        restrictedStock: 'Company Restricted Stock Awards fully vest and receive the Merger Consideration.',
      },
      optionsCvrEarnIn: { code: 'MUST_BE_ITM', label: 'Must Be Itm', text: 'MUST_BE_ITM' },
      doubleTrigger: true,
    },
  };
}

test('equityAwardTreatment keyed-instrument map (real Metsera shape) builds one row per instrument, keyed off the map -- not positionally off the sorted arrays', () => {
  const rows = mod.equityAwardRows([metseraStyleCard()]);
  const named = rows.filter((r) => !r.id.includes('-gap-'));
  assert.equal(named.length, 3, 'one row per equityAwardTreatment key');
  const espp = named.find((r) => /ESPP/.test(r.instrument));
  const options = named.find((r) => /Stock Options/.test(r.instrument));
  const rsa = named.find((r) => /Restricted Stock/.test(r.instrument));
  assert.ok(espp && options && rsa);

  // The bug this fixes: ESPP must NOT show the double-trigger vesting that
  // belongs to Stock Options -- and Stock Options must show it.
  assert.doesNotMatch(espp.vestingLabel || '', /double-trigger/i, 'ESPP is frozen/terminated pre-close, not double-trigger');
  assert.match(espp.vestingLabel, /Cancelled/i);
  assert.match(options.vestingLabel, /double-trigger/i, 'the double-trigger clause is Stock Options\' own');
  assert.match(rsa.vestingLabel, /Fully vested/i);
});

test('EQ1 (feedback round 4): ESPP row sorts to the BOTTOM of the table regardless of its position in equityAwardTreatment\'s own key order', () => {
  const card = {
    id: 'consid-equity-mid-espp',
    provision_type: 'CONSIDERATION',
    provision_subtype: 'CONSID-EQUITY',
    short_title: 'Treatment of Equity Awards / Stock Plans',
    primary_quote: 'SECTION 2.03. Treatment of Company Equity Awards.',
    features: {
      equityAwardTreatment: {
        stockOptions: 'Company Stock Options are cancelled for cash equal to the spread.',
        espp: 'Company ESPP is frozen and terminates before the Effective Time.',
        restrictedStock: 'Company Restricted Stock Awards fully vest and receive the Merger Consideration.',
      },
    },
  };
  const rows = mod.equityAwardRows([card]);
  assert.equal(rows.length, 3);
  assert.equal(rows[rows.length - 1].instrument, 'ESPP (Employee Stock Purchase Plan)', 'ESPP must be the last row, even though it was the middle key in equityAwardTreatment');
  assert.ok(rows.slice(0, -1).every((row) => !/ESPP/i.test(row.instrument)), 'no other row should be pushed below ESPP');
});

test('EQ1: the cutoffTreatment catch-all row still renders after ESPP -- it is a distinct special row, not a per-instrument one, so it stays last regardless', () => {
  const card = {
    id: 'consid-equity-mid-espp-cutoff',
    provision_type: 'CONSIDERATION',
    provision_subtype: 'CONSID-EQUITY',
    features: {
      equityAwardTreatment: {
        espp: 'Company ESPP is frozen and terminates before the Effective Time.',
        stockOptions: 'Company Stock Options are cancelled for cash equal to the spread.',
      },
      cutoffTreatment: 'each Company RSU outstanding shall be cancelled',
    },
  };
  const rows = mod.equityAwardRows([card]);
  assert.equal(rows.length, 3);
  // r16 (Ben, Skechers item 2): row retitled in the table's voice -- it is
  // the grant-date cutoff for NEW awards, distinct from the consideration
  // column (see tests/r16-skechers-structured-voice.test.js).
  assert.equal(rows[2].instrument, 'New grants / contributions after signing');
  assert.match(rows[1].instrument, /ESPP/);
});

test('CVR Entitlement (#7): only the Stock Options row carries it, and it reads "Must be in the money at closing" not the raw ITM code', () => {
  const rows = mod.equityAwardRows([metseraStyleCard()]);
  const options = rows.find((r) => /Stock Options/.test(r.instrument));
  const espp = rows.find((r) => /ESPP/.test(r.instrument));
  const rsa = rows.find((r) => /Restricted Stock/.test(r.instrument));
  assert.equal(options.cvrEntitlement, 'Must be in the money at closing');
  assert.doesNotMatch(options.cvrEntitlement, /\bITM\b/);
  assert.equal(espp.cvrEntitlement, null);
  assert.equal(rsa.cvrEntitlement, null);
});

test('equity instruments expose consideration and vesting, while CVR entitlement is options-only', () => {
  const rows = mod.equityAwardRows([metseraStyleCard()]).filter((row) => !row.isLongText);
  assert.ok(rows.length > 0);
  for (const row of rows) {
    const expectedLabels = [
      'Consideration',
      'Vesting treatment',
      ...(row.instrumentCode === 'STOCK_OPTIONS' ? ['CVR entitlement'] : []),
    ];
    assert.deepEqual(row.marketSubterms.map((subterm) => subterm.label), expectedLabels);
    assert.equal(row.marketPresence.strategy, 'instrument_item');
    assert.equal(row.marketPresence.instrumentCode, row.instrumentCode);
    assert.equal(row.marketSubterms[0].kind, 'multi_select');
    assert.equal(row.marketSubterms[1].kind, 'multi_select');
    const cvr = row.marketSubterms.find((subterm) => subterm.key === 'cvr-entitlement');
    if (row.instrumentCode === 'STOCK_OPTIONS') {
      assert.equal(cvr.kind, 'presence');
      assert.equal(cvr.cohort.eligibility, 'instrument_present');
      assert.equal(cvr.cohort.instrumentCode, 'STOCK_OPTIONS');
      assert.equal(cvr.presence.missingState, 'absent');
      assert.ok(row.marketPresence.featureKeys.includes('optionsCvrEarnIn'));
    } else {
      assert.equal(cvr, undefined, `${row.instrumentCode} must not inherit optionsCvrEarnIn`);
      assert.ok(!row.marketPresence.featureKeys.includes('optionsCvrEarnIn'));
    }
  }
});

test('no row carries an "approximate" flag any more (#4) -- the field is gone entirely', () => {
  const rows = mod.equityAwardRows([metseraStyleCard()]);
  assert.ok(rows.every((row) => !('approximate' in row)));
});

test('a card the pipeline has already split to one instrument (singular tagged equityAwardTreatment) still renders a confident single row', () => {
  const cards = [
    {
      id: 'equity-options',
      provision_type: 'CONSIDERATION',
      provision_subtype: 'CONSID-EQUITY',
      short_title: 'Company Stock Options',
      primary_quote: 'Each Company Stock Option shall be canceled and converted into the right to receive a cash payment equal to the spread.',
      features: {
        instrumentType: { code: 'STOCK_OPTIONS', label: 'Stock Options', text: 'Company Stock Option' },
        equityAwardTreatment: { code: 'CASHED_OUT_SPREAD', label: 'Cashed Out at Spread', text: 'cash payment equal to the spread' },
        vestingAcceleration: { code: 'FULLY_ACCELERATED', label: 'Fully accelerated at closing', text: 'fully vested' },
      },
    },
    {
      id: 'equity-espp',
      provision_type: 'CONSIDERATION',
      provision_subtype: 'CONSID-EQUITY',
      short_title: 'ESPP',
      primary_quote: 'The ESPP shall terminate without consideration.',
      features: {
        instrumentType: { code: 'ESPP', label: 'Employee Stock Purchase Plan rights', text: 'Company ESPP' },
        equityAwardTreatment: { code: 'CANCELLED_NO_CONSIDERATION', label: 'Cancelled without consideration', text: 'ESPP terminates without consideration' },
      },
    },
  ];
  const rows = mod.equityAwardRows(cards);
  assert.equal(rows.length, 2);
  const options = rows.find((r) => r.instrument.includes('Stock Options'));
  const espp = rows.find((r) => r.instrument.includes('Employee Stock Purchase Plan'));
  // Item 11 (round 3): a matched entry's own canonical code now maps to the
  // SAME shared pill meta shape-1 uses (CASHED_OUT_SPREAD -> Cash,
  // FULLY_ACCELERATED -> Fully vested (accelerated),
  // CANCELLED_NO_CONSIDERATION -> Cancelled -- no consideration) instead of
  // echoing the entry's own raw label/text prose.
  assert.equal(options.considerationLabel, 'Cash');
  assert.equal(options.vestingLabel, 'Fully vested (accelerated)');
  assert.equal(espp.considerationLabel, 'Cancelled — no consideration');
});

test('legacy un-split, un-keyed data (no equityAwardTreatment map) still renders one row per outstanding instrument, with no approximate icon', () => {
  const card = {
    id: 'equity-multi',
    provision_type: 'CONSIDERATION',
    provision_subtype: 'CONSID-EQUITY',
    short_title: 'Treatment of Equity Awards',
    primary_quote: 'Options and RSAs are treated as set forth herein.',
    features: {
      outstandingInstruments: [
        { code: 'STOCK_OPTIONS', label: 'Stock Options', text: 'Company Stock Option' },
        { code: 'RESTRICTED_STOCK', label: 'Restricted Stock Awards', text: 'Company Restricted Stock Award' },
      ],
      instrumentTreatments: [
        { code: 'CASHED_OUT_SPREAD', label: 'Cashed Out at Spread', text: 'cash payment equal to the spread' },
        { code: 'ACCELERATED_VESTING', label: 'Vesting accelerated and cashed out', text: 'fully vested and cashed out' },
      ],
    },
  };
  const rows = mod.rowsForCard(card);
  assert.equal(rows.length, 2);
  assert.ok(rows.every((row) => !('approximate' in row)));
});

test('cutoffTreatment (e.g. ESPP contribution cutoff) still renders as its own long-text row', () => {
  const cards = [{
    id: 'equity-cutoff',
    provision_type: 'CONSIDERATION',
    provision_subtype: 'CONSID-EQUITY',
    short_title: 'Treatment of Equity Awards / Stock Plans',
    primary_quote: 'Each Company RSU shall be treated as set forth herein.',
    features: {
      cutoffTreatment: 'each Company RSU, whether vested or unvested, that is outstanding as of the Effective Time shall be cancelled',
    },
  }];
  const rows = mod.equityAwardRows(cards);
  // r16 (Ben, Skechers item 2): retitled -- see the comment on the EQ1 test.
  const cutoff = rows.find((row) => row.instrument === 'New grants / contributions after signing');
  assert.ok(cutoff, 'cutoffTreatment should render a row');
  assert.match(cutoff.considerationLabel, /Company RSU/);
  assert.equal(cutoff.isLongText, true);
});

test('an instrument named in outstandingInstruments but missing from equityAwardTreatment is flagged, not fabricated or dropped', () => {
  const card = {
    id: 'equity-gap',
    provision_type: 'CONSIDERATION',
    provision_subtype: 'CONSID-EQUITY',
    short_title: 'Treatment of Equity Awards',
    primary_quote: 'Options and PSUs are treated as set forth herein.',
    features: {
      outstandingInstruments: [
        { code: 'STOCK_OPTIONS', label: 'Stock Options', text: 'Company Stock Option' },
        { code: 'PSU', label: 'PSUs', text: 'Company PSU' },
      ],
      equityAwardTreatment: {
        stockOptions: 'Company Stock Options are cancelled for cash equal to the spread.',
      },
    },
  };
  const rows = mod.rowsForCard(card);
  const gap = rows.find((r) => /PSU/.test(r.instrument));
  assert.ok(gap, 'the un-covered instrument must still surface as a row');
  assert.equal(gap.considerationTone, 'warning');
  assert.match(gap.considerationLabel, /not captured|see source/i);
});

test('config exposes Equity Type / Consideration / Vesting Treatment / CVR Entitlement columns -- no Notes column (#6)', () => {
  const ids = mod.equityAwardsConfig.columns.map((c) => c.id);
  assert.deepEqual(ids, ['equityType', 'consideration', 'vestingTreatment', 'cvrEntitlement']);
});

test('renderInstrument never surfaces an "Approximate pairing" flag (#4)', () => {
  const primitives = {
    EvidenceHoverSource: ({ children }) => React.createElement('span', null, children),
  };
  const instrumentColumn = mod.equityAwardsConfig.columns.find((c) => c.id === 'equityType');
  const row = { instrument: 'RSAs', evidence: '', sourceCard: null };
  const html = renderToStaticMarkup(React.createElement(React.Fragment, null, instrumentColumn.renderCell(row, { primitives })));
  assert.doesNotMatch(html, /Approximate pairing/);
  assert.match(html, /RSAs/);
});

test('Consideration and Vesting Treatment columns render through PillCell (#8), not plain text', () => {
  const calls = [];
  const primitives = {
    EvidenceHoverSource: ({ children }) => React.createElement('span', null, children),
    PillCell: ({ label, tone }) => {
      calls.push({ label, tone });
      return React.createElement('span', { 'data-pill': tone }, label);
    },
  };
  const row = mod.equityAwardRows([metseraStyleCard()]).find((r) => /Stock Options/.test(r.instrument));
  const considerationColumn = mod.equityAwardsConfig.columns.find((c) => c.id === 'consideration');
  const vestingColumn = mod.equityAwardsConfig.columns.find((c) => c.id === 'vestingTreatment');
  const considerationHtml = renderToStaticMarkup(React.createElement(React.Fragment, null, considerationColumn.renderCell(row, { primitives })));
  const vestingHtml = renderToStaticMarkup(React.createElement(React.Fragment, null, vestingColumn.renderCell(row, { primitives })));
  assert.match(considerationHtml, /data-pill/);
  assert.match(vestingHtml, /data-pill/);
  assert.ok(calls.some((c) => c.label === row.considerationLabel));
  assert.ok(calls.some((c) => c.label === row.vestingLabel));
});

test('the cutoff row stays on the plain-text cell, not squeezed into a pill', () => {
  const primitives = {
    EvidenceHoverSource: ({ children }) => React.createElement('span', null, children),
    PillCell: () => React.createElement('span', { 'data-pill': true }),
  };
  const row = mod.equityAwardRows([{
    id: 'equity-cutoff',
    provision_type: 'CONSIDERATION',
    provision_subtype: 'CONSID-EQUITY',
    features: { cutoffTreatment: 'each Company RSU outstanding shall be cancelled' },
  }])[0];
  const considerationColumn = mod.equityAwardsConfig.columns.find((c) => c.id === 'consideration');
  const html = renderToStaticMarkup(React.createElement(React.Fragment, null, considerationColumn.renderCell(row, { primitives })));
  assert.doesNotMatch(html, /data-pill/);
  assert.match(html, /Company RSU/);
});

// Real Skechers shape (verified against live claims data): un-split
// CONSID-EQUITY card, NO equityAwardTreatment map (extracted as prose), and
// outstandingInstruments / instrumentTreatments / instrumentVesting as three
// independently-ordered tagged lists with no cross-tag. The only join the
// source data supports is the instrument each clause NAMES in its own text
// ("each Company RSA…", "each Company PSA…", "…Company ESPP"). Positional
// zipping cross-wired the live page: the RSU row carried the RSA clause's
// consideration and the PSA clause's vesting.
test('shape-3 lists pair by the instrument named in each clause text, not by index', () => {
  const card = {
    id: 'consid-equity-skechers',
    provision_type: 'CONSIDERATION',
    provision_subtype: 'CONSID-EQUITY',
    features: {
      equityAwardTreatment: 'Company RSAs and qualifying Company RSUs fully vest and are cashed out; PSAs are replaced with retention awards.',
      outstandingInstruments: [
        { code: 'RSUs', label: 'Restricted Stock Units (RSUs)', text: 'each Company RSU, whether vested or unvested, that is outstanding' },
        { code: 'PSUs', label: 'Performance Stock Units (PSUs)', text: 'each Company PSA' },
        { code: 'RESTRICTED_STOCK', label: 'Restricted Stock Awards', text: 'each Company RSA, whether vested or unvested, that is outstanding' },
        { code: 'ESPP', label: 'Employee Stock Purchase Plan rights', text: "each participant's then-outstanding share purchase right under the Company ESPP" },
      ],
      instrumentTreatments: [
        { code: 'ACCELERATED_VESTING', label: 'Vesting accelerated and cashed out', text: 'each Company RSA, whether vested or unvested, shall be fully vested, cancelled and converted into the right to receive the Cash Election Consideration' },
        { code: 'REPLACEMENT_AWARDS', label: 'Cancelled and replaced with retention awards', text: 'each Company PSA shall be cancelled and replaced with a right to receive the Company PSA Consideration' },
        { code: 'CASHED_OUT_AT_CONSIDERATION', label: 'Cashed out at Merger Consideration', text: "each participant's then-outstanding share purchase right under the Company ESPP shall be automatically exercised" },
        { code: 'ACCELERATED_VESTING', label: 'Vesting accelerated and cashed out', text: 'each Company RSU, whether vested or unvested, shall be fully vested, cancelled and converted into the right to receive the Cash Election Consideration' },
      ],
      instrumentVesting: [
        { code: 'FULLY_ACCELERATED', label: 'Fully Accelerated', text: 'each Company RSA, whether vested or unvested, shall be fully vested' },
        { code: 'TIME_BASED_VESTING', label: 'Time Based Vesting', text: 'Such replacement award shall be subject to the same service-based vesting conditions as were applicable to the replaced Company PSA' },
        { code: 'FULLY_ACCELERATED', label: 'Fully Accelerated', text: "each participant's then-outstanding share purchase right under the Company ESPP shall be automatically exercised" },
        { code: 'FULLY_ACCELERATED', label: 'Fully Accelerated', text: 'each Company RSU, whether vested or unvested, that was granted on or before the date of this Agreement shall be fully vested' },
      ],
    },
  };
  const rows = mod.equityAwardRows([card]);
  // Item 11 (round 3): instrument/consideration/vesting cells now resolve
  // through INSTRUMENT_KEY_META / canonical-code pill maps rather than
  // echoing each entry's raw label/text, so the pairing regression this
  // test guards against (RSU showing RSA's data, or vice versa) is now
  // verified via instrumentCode (the canonical identity the mention-pairing
  // resolved) plus PSU's DISTINCT pill (its REPLACEMENT_AWARDS/
  // TIME_BASED_VESTING codes don't collide with any other instrument's
  // codes here, so a mis-pair would swap this label out).
  const byCode = (code) => rows.find((r) => r.instrumentCode === code);

  const rsu = byCode('RSU');
  assert.ok(rsu, 'expected an RSU row');
  assert.equal(rsu.considerationLabel, 'Cash', 'RSU consideration text mentions "Cash Election Consideration"');
  assert.equal(rsu.vestingLabel, 'Fully vested (accelerated)', 'RSU vesting is coded FULLY_ACCELERATED');

  const psu = byCode('PSU');
  assert.ok(psu, 'expected a PSU row');
  assert.equal(psu.considerationLabel, 'Cancelled and replaced with retention awards', 'PSU must keep its OWN distinct treatment, not RSU/RSA/ESPP\'s cash treatment (the mis-pairing this test guards against)');
  assert.equal(psu.vestingLabel, 'Continues vesting (double-trigger protection)', 'PSU vesting is coded TIME_BASED_VESTING');

  const rsa = byCode('RESTRICTED_STOCK');
  assert.ok(rsa, 'expected a Restricted Stock Awards row');
  assert.equal(rsa.considerationLabel, 'Cash');
  assert.equal(rsa.vestingLabel, 'Fully vested (accelerated)');

  const espp = byCode('ESPP');
  assert.ok(espp, 'expected an ESPP row');
  // CASHED_OUT_AT_CONSIDERATION isn't one of the mapped canonical codes
  // (only CASHED_OUT/CASHED_OUT_SPREAD/CASHED_OUT_AT_MERGER_CONSIDERATION
  // are) and its own text doesn't hit a classifier pattern -- falls through
  // to the entry's own short label, never the raw joined "label: text".
  assert.equal(espp.considerationLabel, 'Cashed out at Merger Consideration');
  assert.equal(espp.vestingLabel, 'Fully vested (accelerated)', 'ESPP vesting is coded FULLY_ACCELERATED');
});

// Item 5 (round 3, QXO card 7c4ff1fb): equityAwardTreatment is a keyed map
// (shape 1) covering psus/rsus/options/restrictedStock, but
// outstandingInstruments stores plural string codes "PSUs"/"RSUs" which
// codeOf() only uppercases to PSUS/RSUS -- NOT the canonical PSU/RSU the
// keyed map's rows carry. Before the fix this produced two spurious
// "No structured treatment captured" gap rows duplicating the PSU/RSU rows
// already built from the map.
test('Item 5: outstandingInstruments plural string codes (PSUs/RSUs) do not spawn duplicate gap rows for instruments already covered by the equityAwardTreatment map', () => {
  const card = {
    id: 'consid-equity-qxo',
    provision_type: 'CONSIDERATION',
    provision_subtype: 'CONSID-EQUITY',
    short_title: 'Treatment of Equity Awards',
    primary_quote: 'Treatment of equity awards.',
    features: {
      equityAwardTreatment: {
        psus: 'Each Company PSU award will be converted into an adjusted Parent RSU award, retaining the same vesting conditions.',
        rsus: 'Each Company RSU award will be converted into an adjusted Parent RSU award, retaining the existing time-based vesting conditions.',
        options: 'Each Company Option will be assumed and converted into an option to purchase Parent shares.',
        restrictedStock: 'Each Company restricted stock award will be assumed and converted into a Parent restricted stock award.',
      },
      outstandingInstruments: ['PSUs', 'RSUs', 'Options', { code: 'RESTRICTED_STOCK', label: 'Restricted Stock', text: 'RESTRICTED_STOCK' }],
    },
  };
  const rows = mod.equityAwardRows([card]);
  const psuRows = rows.filter((r) => /^PSUs$/.test(r.instrument));
  const rsuRows = rows.filter((r) => /^RSUs$/.test(r.instrument));
  assert.equal(psuRows.length, 1, 'PSUs must render exactly one row, not a real row plus a gap-row duplicate');
  assert.equal(rsuRows.length, 1, 'RSUs must render exactly one row, not a real row plus a gap-row duplicate');
  const gapRows = rows.filter((r) => /No structured treatment captured/.test(r.considerationLabel || ''));
  assert.equal(gapRows.length, 0, 'every outstanding instrument is covered by the map -- no gap rows should render at all');
});

// Item 5, secondary (QXO): the classifiers missed QXO's "converted into an
// adjusted Parent ... award" / "retaining the existing ... vesting" phrasing,
// so the shape-1 PSU/RSU rows rendered "--" instead of pills.
test('Item 5: classifyConsiderationType covers "converted into an adjusted Parent award" phrasing (QXO)', () => {
  const text = 'Each Company PSU award will be converted into an adjusted Parent RSU award.';
  assert.equal(mod.classifyConsiderationType(text, 'PSU'), 'STOCK');
});

test('Item 5: classifyConsiderationType covers plain "parent shares" phrasing', () => {
  const text = 'Each award will be converted into parent shares at the exchange ratio.';
  assert.equal(mod.classifyConsiderationType(text, 'RSU'), 'STOCK');
});

test('Item 5: classifyVestingTreatment covers "retaining the existing ... vesting" phrasing (QXO)', () => {
  const text = 'The replacement award will be subject to the same terms, retaining the existing time-based vesting conditions.';
  assert.equal(mod.classifyVestingTreatment(text, 'RSU'), 'CONTINUED_VESTING');
});

test('Item 5: classifyVestingTreatment covers "same terms and conditions" phrasing', () => {
  const text = 'The award continues on the same terms and conditions as in effect immediately prior to the Effective Time.';
  assert.equal(mod.classifyVestingTreatment(text, 'PSU'), 'CONTINUED_VESTING');
});

// Item 11 (round 3, Theravance card b1514608): equityAwardTreatment stored
// as a SINGLE tagged value (not a keyed per-instrument map) -> shape-3
// legacy branch. The old branch rendered valueText(inst)/valueText(treatment)
// -- both a joined "Label: verbose 800-char clause" string -- for every
// cell ("Stock Options: Each Company Option, whether vested or unvested,
// that is outstanding…"). Acceptance per spec: 4 rows, every cell a short
// pill (never the raw joined label:text blob), CVR "Must be in the money
// at closing" on Options only.
test('Item 11: Theravance shape-3 equity awards render as short pills (instrument label, consideration, vesting), never the raw valueText(label:text) prose dump', () => {
  const card = {
    id: 'consid-equity-theravance',
    provision_type: 'CONSIDERATION',
    provision_subtype: 'CONSID-EQUITY',
    short_title: 'Treatment of Equity Awards',
    primary_quote: 'SECTION 2.03. Treatment of Company Equity Awards.',
    features: {
      outstandingInstruments: [
        { code: 'STOCK_OPTIONS', label: 'Stock Options', text: 'Each Company Option, whether vested or unvested, that is outstanding' },
        { code: 'PSU', label: 'PSUs', text: 'Each Company PSU, whether vested or unvested, that is outstanding' },
        { code: 'RSU', label: 'RSUs', text: 'Each Company RSU, whether vested or unvested, that is outstanding' },
        { code: 'ESPP', label: 'Employee Stock Purchase Plan rights', text: "Each participant's then-outstanding purchase right under the Company ESPP" },
      ],
      instrumentTreatments: [
        { code: 'CASHED_OUT_SPREAD', label: 'Cashed Out at Spread', text: 'will, at the Effective Time, be canceled and converted into the right to receive an amount in cash equal to the excess, if any, of the Merger Consideration over the exercise price' },
        { code: 'CASHED_OUT_AT_MERGER_CONSIDERATION', label: 'Cashed Out at Merger Consideration', text: 'will be canceled and converted into the right to receive the Merger Consideration' },
        { code: 'CASHED_OUT_AT_MERGER_CONSIDERATION', label: 'Cashed Out at Merger Consideration', text: 'will be canceled and converted into the right to receive the Merger Consideration' },
        { code: 'CASHED_OUT_AT_MERGER_CONSIDERATION', label: 'Cashed Out at Merger Consideration', text: 'each participant\'s purchase right will be exercised and canceled and converted into the right to receive the Merger Consideration' },
      ],
      instrumentVesting: [
        { code: 'FULLY_ACCELERATED', label: 'Fully Accelerated', text: 'each Company Option, whether vested or unvested, shall be fully vested' },
        { code: 'FULLY_ACCELERATED', label: 'Fully Accelerated', text: 'each Company PSU, whether vested or unvested, shall be fully vested' },
        { code: 'FULLY_ACCELERATED', label: 'Fully Accelerated', text: 'each Company RSU, whether vested or unvested, shall be fully vested' },
        { code: 'NO_ACCELERATION', label: 'No Acceleration', text: "each participant's purchase right is not subject to acceleration" },
      ],
      optionsCvrEarnIn: { code: 'MUST_BE_ITM', label: 'Must Be Itm', text: 'MUST_BE_ITM' },
    },
  };
  const rows = mod.equityAwardRows([card]);
  assert.equal(rows.length, 4, 'expected 4 rows: Options / PSUs / RSUs / ESPP');

  const MAX_PILL_LEN = 60;
  for (const row of rows) {
    assert.ok((row.instrument || '').length < MAX_PILL_LEN, `instrument cell must be a short label, got: ${row.instrument}`);
    if (row.considerationLabel) assert.ok(row.considerationLabel.length < MAX_PILL_LEN, `consideration cell must be a short pill, got: ${row.considerationLabel}`);
    if (row.vestingLabel) assert.ok(row.vestingLabel.length < MAX_PILL_LEN, `vesting cell must be a short pill, got: ${row.vestingLabel}`);
    assert.doesNotMatch(row.instrument || '', /: /, 'instrument cell must never contain the joined "Label: text" separator');
  }

  const options = rows.find((r) => r.instrumentCode === 'STOCK_OPTIONS');
  assert.ok(options, 'expected a Stock Options row');
  assert.equal(options.considerationLabel, 'Cash');
  assert.equal(options.vestingLabel, 'Fully vested (accelerated)');
  assert.equal(options.cvrEntitlement, 'Must be in the money at closing', 'CVR entitlement only on Options');

  const psu = rows.find((r) => r.instrumentCode === 'PSU');
  assert.equal(psu.cvrEntitlement, null, 'CVR entitlement must not leak onto non-Options rows');

  // ESPP still sorts last regardless of key order (moveEsppToBottom, #4).
  assert.equal(rows[rows.length - 1].instrumentCode, 'ESPP');
});
