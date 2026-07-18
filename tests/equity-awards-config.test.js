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
  assert.equal(rows[2].instrument, 'Award / contribution cutoff treatment');
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
  assert.match(options.considerationLabel, /Cashed Out at Spread/);
  assert.match(options.vestingLabel, /Fully accelerated/);
  assert.match(espp.considerationLabel, /Cancelled without consideration/);
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
  const cutoff = rows.find((row) => row.instrument === 'Award / contribution cutoff treatment');
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
  const find = (prefix) => rows.find((r) => String(r.instrument).startsWith(prefix));

  const rsu = find('Restricted Stock Units (RSUs)');
  assert.match(rsu.considerationLabel || '', /Company RSU/);
  assert.match(rsu.vestingLabel || '', /Company RSU/);

  const psu = find('Performance Stock Units (PSUs)');
  assert.match(psu.considerationLabel || '', /Company PSA/);
  assert.match(psu.vestingLabel || '', /Company PSA/);

  const rsa = find('Restricted Stock Awards');
  assert.match(rsa.considerationLabel || '', /Company RSA/);
  assert.match(rsa.vestingLabel || '', /Company RSA/);

  const espp = find('Employee Stock Purchase Plan rights');
  assert.match(espp.considerationLabel || '', /ESPP/);
  assert.match(espp.vestingLabel || '', /ESPP/);
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
