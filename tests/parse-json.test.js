'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { parseJSON } = require('../lib/parser-v2/parse-json');

// A realistic extraction payload — the shape the pipeline actually returns from
// strategy B/C/D and the classify pass.
const PAYLOAD = {
  results: [
    {
      idx: 0,
      code: 'TERMR-OUTSIDE',
      features: {
        outsideDate: { text: 'November 30, 2025', code: 'DATE_FIXED' },
        partyWhoCanTerminate: { code: 'PARTY_MUTUAL', label: 'Either party', text: 'either Parent or the Company' },
      },
      isNewCode: false,
    },
  ],
};

const PAYLOAD_JSON = JSON.stringify(PAYLOAD);

test('clean JSON parses identically to JSON.parse (no regression)', () => {
  const parsed = parseJSON(PAYLOAD_JSON);
  assert.deepStrictEqual(parsed, PAYLOAD);
  // Byte-for-byte equivalence with a plain JSON.parse on the same input.
  assert.deepStrictEqual(parsed, JSON.parse(PAYLOAD_JSON));
});

test('clean JSON array parses (classify-pass shape)', () => {
  const arr = [
    { index: 0, provisionType: 'COND-M', confidence: 'high', reasoning: 'Mutual conditions article' },
    { index: 1, provisionType: 'TERMR', confidence: 'medium', reasoning: 'Termination rights' },
  ];
  assert.deepStrictEqual(parseJSON(JSON.stringify(arr)), arr);
});

test('shape (a): valid JSON followed by trailing prose', () => {
  const raw =
    PAYLOAD_JSON +
    '\n\nNone of the nine TERMR codes fit perfectly, so I flagged it as a new ' +
    'code rather than forcing it into TERMR-EXTENSION.';
  assert.deepStrictEqual(parseJSON(raw), PAYLOAD);
});

test('shape (b): prose preamble followed by JSON', () => {
  const raw =
    'Here is the structured extraction for the termination provision. ' +
    'I reviewed the outside date and party carefully:\n\n' +
    PAYLOAD_JSON;
  assert.deepStrictEqual(parseJSON(raw), PAYLOAD);
});

test('shape (b): prose preamble containing a stray brace before the JSON', () => {
  const raw =
    'Note: the schema (see {reference} above) requires an idx field.\n' +
    PAYLOAD_JSON;
  assert.deepStrictEqual(parseJSON(raw), PAYLOAD);
});

test('shape (c): markdown ```json fences', () => {
  const raw = '```json\n' + PAYLOAD_JSON + '\n```';
  assert.deepStrictEqual(parseJSON(raw), PAYLOAD);
});

test('shape (c): bare ``` fences with prose around them', () => {
  const raw =
    'Sure, here you go:\n```\n' + PAYLOAD_JSON + '\n```\nLet me know if you need changes.';
  assert.deepStrictEqual(parseJSON(raw), PAYLOAD);
});

test('shape (d): truncation repair — cut off mid-object', () => {
  // Response cut off after the last complete value, before the closing braces.
  const truncated =
    '{ "results": [ { "idx": 0, "code": "TERMR-OUTSIDE", "features": { "outsideDate": "November 30, 2025", "isNewCode": false }';
  const parsed = parseJSON(truncated);
  assert.ok(parsed && Array.isArray(parsed.results), 'expected repaired results array');
  assert.strictEqual(parsed.results[0].code, 'TERMR-OUTSIDE');
  assert.strictEqual(parsed.results[0].features.outsideDate, 'November 30, 2025');
  assert.strictEqual(parsed.results[0].features.isNewCode, false);
});

test('shape (d): truncation repair — cut mid-string then dangling comma', () => {
  // Cut in the middle of a string value; repair should walk back to the last
  // complete value and close the structure.
  const truncated =
    '{ "results": [ { "idx": 0, "code": "TERMF-REIMBURSE", "amount": "$25,000,000" }, { "idx": 1, "code": "TERMF-RTF-ANTI", "text": "the Regulatory Reverse Terminati';
  const parsed = parseJSON(truncated);
  assert.ok(parsed && Array.isArray(parsed.results), 'expected repaired results array');
  // The first fully-formed element must survive the repair.
  assert.strictEqual(parsed.results[0].code, 'TERMF-REIMBURSE');
  assert.strictEqual(parsed.results[0].amount, '$25,000,000');
});

test('shape (d): truncated array cut mid-object', () => {
  const truncated =
    '[ { "index": 0, "provisionType": "REP-T", "confidence": "high" }, { "index": 1, "provisionType": "REP-B"';
  const parsed = parseJSON(truncated);
  assert.ok(Array.isArray(parsed), 'expected repaired array');
  assert.strictEqual(parsed[0].provisionType, 'REP-T');
});

test('garbage returns null (not throw)', () => {
  assert.strictEqual(parseJSON('This is just prose with no JSON at all.'), null);
  assert.strictEqual(parseJSON(''), null);
  assert.strictEqual(parseJSON(null), null);
  assert.strictEqual(parseJSON('```\nnot json either\n```'), null);
});

test('string/escape aware — braces inside string values do not break the scan', () => {
  const obj = { text: 'terminate if {Parent} or [Company] fails }{', code: 'TERMR' };
  const raw = 'Extraction:\n' + JSON.stringify(obj) + '\nThat is my answer.';
  assert.deepStrictEqual(parseJSON(raw), obj);
});

test('escaped quotes inside strings are respected', () => {
  const obj = { text: 'the \\"Outside Date\\" means', code: 'DEF' };
  // Build via JSON.stringify to get correct escaping, then wrap in prose.
  const json = JSON.stringify({ text: 'the "Outside Date" means', code: 'DEF' });
  const raw = 'Prose first.\n' + json + '\nTrailing prose { with a brace }.';
  assert.deepStrictEqual(parseJSON(raw), { text: 'the "Outside Date" means', code: 'DEF' });
  void obj;
});
