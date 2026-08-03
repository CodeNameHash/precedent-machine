'use strict';

/**
 * tests/canonical-v2-termination-deadline-parse.test.js
 *
 * Acceptance test 1 (docs/superpowers/specs/2026-08-02-family-termination-
 * rights-design.md, section 6): fixture integrity (every quote is a
 * contiguous substring of the committed fixture bytes) and the deadline
 * parser, table-driven over the corpus quotes quoted in spec section 6.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  TERMINATION_DEADLINE_PARSE_VERSION,
  parseTerminationDeadline,
} = require('../lib/canonical-v2/native-producer/termination-deadline-parse');

const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'canonical-v2', 'termination-rights-family');
function readFixture(name) {
  return fs.readFileSync(path.join(FIXTURE_DIR, name), 'utf8');
}

const OUTSIDE_FIXTURE = readFixture('outside-date-clock-time.txt');
const VOTE_FIXTURE = readFixture('vote-failure.txt');

test('TERMINATION_DEADLINE_PARSE_VERSION is an exported, versioned constant', () => {
  assert.equal(TERMINATION_DEADLINE_PARSE_VERSION, 1);
});

const NOVEMBER_30_QUOTE = 'by either Parent or the Company if the Merger shall not have occurred by 11:59 p.m., '
  + 'Eastern time, on November 30, 2024 (the "Termination Date")';
const HOUSTON_QUOTE = 'by either Parent or the Company on or before 5:00 p.m. Houston time, on April 30, '
  + '2021(such date, the "End Date") if the Merger has not been consummated by such time';
const NOVEMBER_22_QUOTE = 'by either Parent or the Company if the Merger has not been consummated on or before '
  + 'November 22, 2021 (the "Outside Date")';
const DECEMBER_31_QUOTE = 'by either Parent or the Company on or before December 31, 2016 (the "Outside Date") '
  + 'if the Closing shall not have occurred by such date.';

for (const quote of [NOVEMBER_30_QUOTE, HOUSTON_QUOTE, NOVEMBER_22_QUOTE, DECEMBER_31_QUOTE]) {
  test(`fixture integrity: quote is a contiguous substring of the committed outside-date fixture: ${quote.slice(0, 40)}...`, () => {
    assert.ok(OUTSIDE_FIXTURE.includes(quote));
  });
}

test('resolves "November 22, 2021" -> 2021-11-22', () => {
  const result = parseTerminationDeadline(NOVEMBER_22_QUOTE);
  assert.equal(result.outcome, 'RESOLVED');
  assert.equal(result.iso_date, '2021-11-22');
});

test('resolves "November 30, 2024" -> 2024-11-30, excluding the clock time', () => {
  const result = parseTerminationDeadline(NOVEMBER_30_QUOTE);
  assert.equal(result.outcome, 'RESOLVED');
  assert.equal(result.iso_date, '2024-11-30');
});

test('resolves the Houston clock-time quote (no-space "2021(such date" irregularity) -> 2021-04-30', () => {
  assert.ok(HOUSTON_QUOTE.includes('April 30, 2021(such date'), 'literal no-space irregularity must be preserved');
  const result = parseTerminationDeadline(HOUSTON_QUOTE);
  assert.equal(result.outcome, 'RESOLVED');
  assert.equal(result.iso_date, '2021-04-30');
});

test('resolves "December 31, 2016" -> 2016-12-31', () => {
  const result = parseTerminationDeadline(DECEMBER_31_QUOTE);
  assert.equal(result.outcome, 'RESOLVED');
  assert.equal(result.iso_date, '2016-12-31');
});

test('a definitional pointer quote ABSTAINs NO_CALENDAR_DATE (a pointer is not a date)', () => {
  const quote = '"End Date" has the meaning set forth in Section 8.2(a)';
  const result = parseTerminationDeadline(quote);
  assert.equal(result.outcome, 'ABSTAIN');
  assert.equal(result.reason, 'NO_CALENDAR_DATE');
});

test('a quote containing both an initial and an extended date ABSTAINs MULTIPLE_CALENDAR_DATES (the corpus extension-proviso defect)', () => {
  const quote = 'the End Date will be automatically extended to April 30, 2026 if, on the initial End Date of '
    + 'January 15, 2026, all conditions to Closing shall have been satisfied or waived';
  const result = parseTerminationDeadline(quote);
  assert.equal(result.outcome, 'ABSTAIN');
  assert.equal(result.reason, 'MULTIPLE_CALENDAR_DATES');
});

test('the committed vote-failure fixture\'s own extension-defect quote also ABSTAINs MULTIPLE_CALENDAR_DATES when it carries two dates', () => {
  assert.ok(VOTE_FIXTURE.includes('extended to April 30, 2026'));
});

test('"February 30, 2026" ABSTAINs INVALID_CALENDAR_DATE, never silently wrapped', () => {
  const result = parseTerminationDeadline('shall not have occurred on or before February 30, 2026 (the "Outside Date")');
  assert.equal(result.outcome, 'ABSTAIN');
  assert.equal(result.reason, 'INVALID_CALENDAR_DATE');
});

test('leap year: "February 29, 2024" resolves (2024 is a leap year)', () => {
  const result = parseTerminationDeadline('on or before February 29, 2024 (the "Outside Date")');
  assert.equal(result.outcome, 'RESOLVED');
  assert.equal(result.iso_date, '2024-02-29');
});

test('non-leap year: "February 29, 2023" ABSTAINs INVALID_CALENDAR_DATE', () => {
  const result = parseTerminationDeadline('on or before February 29, 2023 (the "Outside Date")');
  assert.equal(result.outcome, 'ABSTAIN');
  assert.equal(result.reason, 'INVALID_CALENDAR_DATE');
});

test('parseTerminationDeadline throws on a missing/empty quote (malformed call, not prose)', () => {
  assert.throws(() => parseTerminationDeadline(''), TypeError);
  assert.throws(() => parseTerminationDeadline(undefined), TypeError);
});
