// WP review-ux-refinement: Equity Awards rebuilt as a real per-instrument
// table (instrument | treatment | vesting), matching the legacy pre-schema
// page, instead of three separately-unzipped outstandingInstruments /
// instrumentTreatments / instrumentVesting lists. See equity-awards.config.js
// for why a per-CARD join is safe here (lib/parser-v2/extract.js splits a
// multi-instrument section into one provision-card per instrument before
// persistence).
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

let mod;
test.before(async () => {
  mod = await import(path.join('..', 'components', 'review', 'table-configs', 'equity-awards.config.js'));
});

test('one CONSID-EQUITY card per instrument (post-expansion pipeline shape) renders one confident row each', () => {
  const cards = [
    {
      id: 'equity-options',
      provision_type: 'CONSIDERATION',
      provision_subtype: 'CONSID-EQUITY',
      short_title: 'Company Stock Options',
      primary_quote: 'Each Company Stock Option shall be canceled and converted into the right to receive a cash payment equal to the spread.',
      features: {
        instrumentType: { code: 'STOCK_OPTIONS', label: 'Stock Options', text: 'Company Stock Option' },
        outstandingInstruments: [{ code: 'STOCK_OPTIONS', label: 'Stock Options', text: 'Company Stock Option' }],
        equityAwardTreatment: { code: 'CASHED_OUT_SPREAD', label: 'Cashed Out at Spread', text: 'cash payment equal to the spread' },
        instrumentTreatments: [{ code: 'CASHED_OUT_SPREAD', label: 'Cashed Out at Spread', text: 'cash payment equal to the spread' }],
        vestingAcceleration: { code: 'FULLY_ACCELERATED', label: 'Fully accelerated at closing', text: 'fully vested' },
        instrumentVesting: [{ code: 'FULLY_ACCELERATED', label: 'Fully accelerated at closing', text: 'fully vested' }],
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
        vestingAcceleration: { code: 'NO_ACCELERATION', label: 'No acceleration; continues vesting', text: 'no new offering period' },
      },
    },
  ];
  const rows = mod.equityAwardRows(cards);
  assert.equal(rows.length, 2, 'each instrument-per-card should render exactly one row');
  const options = rows.find((r) => r.instrument.includes('Stock Options'));
  const espp = rows.find((r) => r.instrument.includes('Employee Stock Purchase Plan'));
  assert.ok(options && espp);
  assert.match(options.treatment, /Cashed Out at Spread/);
  assert.match(options.vesting, /Fully accelerated/);
  assert.match(espp.treatment, /Cancelled without consideration/);
  assert.equal(options.approximate, false, 'a singleton-per-card row is a confident join, not a positional guess');
});

test('a card with >1 instruments still on it (un-expanded/legacy data) pairs by code when possible, else flags an approximate row instead of silently zipping', () => {
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
      // No instrument-linking field on these treatment entries -- code-based
      // pairing is impossible, so this must NOT be positionally zipped
      // silently.
      instrumentTreatments: [
        { code: 'CASHED_OUT_SPREAD', label: 'Cashed Out at Spread', text: 'cash payment equal to the spread' },
        { code: 'ACCELERATED_VESTING', label: 'Vesting accelerated and cashed out', text: 'fully vested and cashed out' },
      ],
    },
  };
  const rows = mod.rowsForCard(card);
  assert.equal(rows.length, 2);
  assert.ok(rows.every((row) => row.approximate === true), 'rows built from an un-joinable multi-instrument card must be flagged approximate, not presented as certain');
});

test('cutoffTreatment (e.g. ESPP contribution cutoff) renders as its own note row', () => {
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
  assert.match(cutoff.treatment, /Company RSU/);
});

test('config exposes Equity Type / Consideration / Vesting Treatment / CVR Entitlement / Notes columns (spec REBUILD-SPECS.md §2)', () => {
  const ids = mod.equityAwardsConfig.columns.map((c) => c.id);
  assert.deepEqual(ids, ['equityType', 'consideration', 'vestingTreatment', 'cvrEntitlement', 'notes']);
});

test('CVR Entitlement column is populated from optionsCvrEarnIn on the options row only (ITM-gated CVR earn-in), not on RSA/ESPP rows', () => {
  const cards = [
    {
      id: 'equity-options',
      provision_type: 'CONSIDERATION',
      provision_subtype: 'CONSID-EQUITY',
      short_title: 'Company Stock Options',
      primary_quote: 'Each Company Stock Option shall be canceled and converted into the right to receive a cash payment equal to the spread, subject to the CVR earn-in.',
      features: {
        instrumentType: { code: 'STOCK_OPTIONS', label: 'Stock Options', text: 'Company Stock Option' },
        equityAwardTreatment: { code: 'CASHED_OUT_SPREAD', label: 'Cashed Out at Spread', text: 'cash payment equal to the spread' },
        vestingAcceleration: { code: 'FULLY_ACCELERATED', label: 'Fully accelerated at closing', text: 'fully vested' },
        optionsCvrEarnIn: { code: 'MUST_BE_ITM', label: 'Must be in-the-money', text: 'MUST_BE_ITM' },
      },
    },
    {
      id: 'equity-rsa',
      provision_type: 'CONSIDERATION',
      provision_subtype: 'CONSID-EQUITY',
      short_title: 'Company Restricted Stock Awards',
      primary_quote: 'Each Company Restricted Stock Award shall vest in full.',
      features: {
        instrumentType: { code: 'RESTRICTED_STOCK', label: 'Restricted Stock Awards', text: 'Company Restricted Stock Award' },
        equityAwardTreatment: { code: 'CASHED_OUT_AT_CONSIDERATION', label: 'Cashed out at Merger Consideration', text: 'vests in full' },
      },
    },
  ];
  const rows = mod.equityAwardRows(cards);
  const options = rows.find((r) => r.instrument.includes('Stock Options'));
  const rsa = rows.find((r) => r.instrument.includes('Restricted Stock'));
  assert.ok(options && rsa);
  assert.match(options.cvrEntitlement, /Must be in-the-money/);
  assert.equal(rsa.cvrEntitlement, null, 'RSA rows must not carry an options-only CVR earn-in condition');
});

test('Notes column surfaces espp_treatment on the ESPP row and a double-trigger note on non-ESPP rows with doubleTrigger set', () => {
  const cards = [
    {
      id: 'equity-espp',
      provision_type: 'CONSIDERATION',
      provision_subtype: 'CONSID-EQUITY',
      short_title: 'ESPP',
      primary_quote: 'The ESPP shall terminate.',
      features: {
        instrumentType: { code: 'ESPP', label: 'Employee Stock Purchase Plan rights', text: 'Company ESPP' },
        equityAwardTreatment: { code: 'CANCELLED_NO_CONSIDERATION', label: 'Cancelled without consideration', text: 'ESPP terminates' },
        espp_treatment: 'Company ESPP is frozen, no new participants or increased elections are permitted.',
      },
    },
    {
      id: 'equity-options-dt',
      provision_type: 'CONSIDERATION',
      provision_subtype: 'CONSID-EQUITY',
      short_title: 'Company Stock Options',
      primary_quote: 'Options are cashed out.',
      features: {
        instrumentType: { code: 'STOCK_OPTIONS', label: 'Stock Options', text: 'Company Stock Option' },
        equityAwardTreatment: { code: 'CASHED_OUT_SPREAD', label: 'Cashed Out at Spread', text: 'cash payment equal to the spread' },
        doubleTrigger: true,
      },
    },
  ];
  const rows = mod.equityAwardRows(cards);
  const espp = rows.find((r) => r.instrument.includes('Employee Stock Purchase Plan'));
  const options = rows.find((r) => r.instrument.includes('Stock Options'));
  assert.match(espp.notes, /Company ESPP is frozen/);
  assert.match(options.notes, /Double-trigger/);
});

test('renderInstrument surfaces an approximate-pairing flag only when the row is flagged', () => {
  const primitives = {
    EvidenceHoverSource: ({ children }) => React.createElement('span', null, children),
  };
  const instrumentColumn = mod.equityAwardsConfig.columns.find((c) => c.id === 'equityType');
  const confident = { instrument: 'Stock Options', approximate: false, evidence: '', sourceCard: null };
  const approximate = { instrument: 'RSAs', approximate: true, evidence: '', sourceCard: null };
  const confidentHtml = renderToStaticMarkup(React.createElement(React.Fragment, null, instrumentColumn.renderCell(confident, { primitives })));
  const approximateHtml = renderToStaticMarkup(React.createElement(React.Fragment, null, instrumentColumn.renderCell(approximate, { primitives })));
  assert.doesNotMatch(confidentHtml, /Approximate pairing/);
  assert.match(approximateHtml, /Approximate pairing/);
});
