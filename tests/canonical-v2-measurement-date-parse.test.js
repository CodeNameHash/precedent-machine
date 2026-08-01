'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  MEASUREMENT_DATE_PARSE_VERSION,
  AGREEMENT_DATE_SYMBOLIC_PHRASES,
  parseMeasurementDate,
} = require('../lib/canonical-v2/native-producer/measurement-date-parse');

test('version is pinned', () => {
  assert.equal(MEASUREMENT_DATE_PARSE_VERSION, 1);
});

test('a calendar date resolves to ISO-8601', () => {
  const result = parseMeasurementDate({ quote: 'As of April 17, 2026, other things being equal' });
  assert.equal(result.outcome, 'RESOLVED');
  assert.equal(result.resolution, 'CALENDAR');
  assert.equal(result.iso_date, '2026-04-17');
});

test('a calendar date with a single-digit day resolves correctly', () => {
  const result = parseMeasurementDate({ quote: 'as of March 3, 2027' });
  assert.equal(result.outcome, 'RESOLVED');
  assert.equal(result.iso_date, '2027-03-03');
});

test('an invalid calendar date (February 30) abstains, never wraps to March', () => {
  const result = parseMeasurementDate({ quote: 'as of February 30, 2026' });
  assert.equal(result.outcome, 'ABSTAIN');
  assert.equal(result.reason, 'INVALID_CALENDAR_DATE');
});

test('February 29 resolves in a leap year', () => {
  const result = parseMeasurementDate({ quote: 'as of February 29, 2028' });
  assert.equal(result.outcome, 'RESOLVED');
  assert.equal(result.iso_date, '2028-02-29');
});

test('February 29 abstains in a non-leap year', () => {
  const result = parseMeasurementDate({ quote: 'as of February 29, 2026' });
  assert.equal(result.outcome, 'ABSTAIN');
  assert.equal(result.reason, 'INVALID_CALENDAR_DATE');
});

test('"the date hereof" resolves via an injected agreement_date', () => {
  const result = parseMeasurementDate({ quote: 'as of the date hereof', agreement_date: '2026-04-18' });
  assert.equal(result.outcome, 'RESOLVED');
  assert.equal(result.resolution, 'SYMBOLIC');
  assert.equal(result.iso_date, '2026-04-18');
  assert.equal(result.symbolic_phrase, 'the date hereof');
});

test('"the date of this Agreement" resolves via an injected agreement_date', () => {
  const result = parseMeasurementDate({ quote: 'as of the date of this Agreement', agreement_date: '2026-04-18' });
  assert.equal(result.outcome, 'RESOLVED');
  assert.equal(result.iso_date, '2026-04-18');
});

test('a symbolic date abstains when no agreement_date is supplied', () => {
  const result = parseMeasurementDate({ quote: 'as of the date hereof' });
  assert.equal(result.outcome, 'ABSTAIN');
  assert.equal(result.reason, 'AGREEMENT_DATE_UNAVAILABLE');
  assert.equal(result.symbolic_phrase, 'the date hereof');
});

test('a symbolic date abstains when agreement_date is not a valid ISO date string', () => {
  const result = parseMeasurementDate({ quote: 'as of the date hereof', agreement_date: 'April 18, 2026' });
  assert.equal(result.outcome, 'ABSTAIN');
  assert.equal(result.reason, 'AGREEMENT_DATE_UNAVAILABLE');
});

// "the Closing Date" / "the Effective Time" are DELIBERATELY never resolved
// in this slice -- no governed source exists for either yet (see the
// module's header DEVIATION note). This is asserted positively so a future
// change that silently starts resolving them is a deliberate decision, not
// an accident.
test('"the Closing Date" never resolves, even with an agreement_date supplied', () => {
  const result = parseMeasurementDate({ quote: 'as of the Closing Date', agreement_date: '2026-04-18' });
  assert.equal(result.outcome, 'ABSTAIN');
  assert.equal(result.reason, 'SYMBOLIC_DATE_NOT_GOVERNED');
  assert.equal(result.symbolic_phrase, 'the Closing Date');
});

test('"the Effective Time" never resolves, even with an agreement_date supplied', () => {
  const result = parseMeasurementDate({ quote: 'as of the Effective Time', agreement_date: '2026-04-18' });
  assert.equal(result.outcome, 'ABSTAIN');
  assert.equal(result.reason, 'SYMBOLIC_DATE_NOT_GOVERNED');
});

test('no date at all abstains with NO_DATE_FOUND', () => {
  const result = parseMeasurementDate({ quote: 'material to the Company and its Subsidiaries' });
  assert.equal(result.outcome, 'ABSTAIN');
  assert.equal(result.reason, 'NO_DATE_FOUND');
});

test('every closed symbolic phrase in the lexicon is classified as governed or not, never silently ignored', () => {
  for (const phrase of AGREEMENT_DATE_SYMBOLIC_PHRASES) {
    assert.ok(['the date hereof', 'the date of this Agreement'].includes(phrase));
  }
});

test('pure function: same input produces the same frozen output shape', () => {
  const a = parseMeasurementDate({ quote: 'as of April 17, 2026' });
  const b = parseMeasurementDate({ quote: 'as of April 17, 2026' });
  assert.deepEqual(a, b);
  assert.ok(Object.isFrozen(a));
});

test('throws a TypeError on a missing/empty quote rather than silently returning null', () => {
  assert.throws(() => parseMeasurementDate({}), TypeError);
  assert.throws(() => parseMeasurementDate({ quote: '' }), TypeError);
});
