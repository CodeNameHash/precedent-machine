'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  resolveQualifierAttachment,
  buildAmbiguousReadings,
  firstMarkerMatch,
  SERIES_MARKER_PATTERNS,
  SINGLE_CLAUSE_MARKER_PATTERNS,
} = require('../lib/canonical-v2/native-producer/qualifier-attachment');

// ─── CHAPEAU / ITEM are unambiguous by construction. ───

test('CHAPEAU always implies ALL_ITEMS, with a null governs_path', () => {
  const result = resolveQualifierAttachment({
    position: 'CHAPEAU',
    quote_text: 'Except as set forth in the Disclosure Letter,',
    sibling_limb_paths: [['(i)'], ['(ii)']],
  });
  assert.equal(result.scope_reading, 'ALL_ITEMS');
  assert.equal(result.governs_path, null);
  assert.equal(result.readings, null);
});

test('ITEM always implies THIS_ITEM_ONLY, with governs_path set to the model-stated limb', () => {
  const result = resolveQualifierAttachment({
    position: 'ITEM',
    governs_path: ['(iv)'],
    quote_text: 'with a fair market value that is material to the Company',
    sibling_limb_paths: [['(i)'], ['(iv)']],
  });
  assert.equal(result.scope_reading, 'THIS_ITEM_ONLY');
  assert.deepEqual(result.governs_path, ['(iv)']);
  assert.equal(result.readings, null);
});

test('an ITEM qualifier with no usable governs_path resolves THIS_ITEM_ONLY with a null path, never a guess', () => {
  const result = resolveQualifierAttachment({
    position: 'ITEM',
    governs_path: null,
    quote_text: 'duly authorized and validly issued',
  });
  assert.equal(result.scope_reading, 'THIS_ITEM_ONLY');
  assert.equal(result.governs_path, null);
});

// ─── TRAILING: the deterministic marker test (Ben's refined rule). ───

test('a TRAILING qualifier with an explicit series marker resolves ALL_ITEMS without ambiguity', () => {
  const result = resolveQualifierAttachment({
    position: 'TRAILING',
    governs_path: ['(v)'],
    quote_text: 'in each case, except for de minimis inaccuracies',
    sibling_limb_paths: [['(i)'], ['(ii)'], ['(v)']],
  });
  assert.equal(result.scope_reading, 'ALL_ITEMS');
  assert.equal(result.ambiguity_signals.in_each_case_language, 'in each case');
  assert.equal(result.ambiguity_signals.single_clause_language, null);
  assert.equal(result.readings, null, 'a resolved reading carries no decision-support readings');
});

test('a TRAILING qualifier with an explicit single-clause marker resolves THIS_ITEM_ONLY without ambiguity', () => {
  const result = resolveQualifierAttachment({
    position: 'TRAILING',
    governs_path: ['(iv)'],
    quote_text: 'in the case of clause (iv), with a fair market value that is material',
    sibling_limb_paths: [['(i)'], ['(iv)'], ['(v)']],
  });
  assert.equal(result.scope_reading, 'THIS_ITEM_ONLY');
  assert.equal(result.ambiguity_signals.single_clause_language, 'in the case of clause (iv)');
  assert.equal(result.ambiguity_signals.in_each_case_language, null);
  assert.equal(result.readings, null);
});

test('a bare TRAILING qualifier with neither marker is AMBIGUOUS and carries both readings with correct governs_paths', () => {
  const siblingLimbPaths = [['(i)'], ['(ii)'], ['(iii)']];
  const result = resolveQualifierAttachment({
    position: 'TRAILING',
    governs_path: ['(iii)'],
    quote_text: 'with a fair market value that is material to the Company and its Subsidiaries, taken as a whole',
    sibling_limb_paths: siblingLimbPaths,
  });
  assert.equal(result.scope_reading, 'AMBIGUOUS');
  assert.equal(result.ambiguity_signals.in_each_case_language, null);
  assert.equal(result.ambiguity_signals.single_clause_language, null);
  assert.ok(Array.isArray(result.readings));
  const series = result.readings.find((r) => r.reading === 'SERIES');
  const lastAntecedent = result.readings.find((r) => r.reading === 'LAST_ANTECEDENT');
  assert.deepEqual(series.governs_paths, siblingLimbPaths);
  assert.deepEqual(lastAntecedent.governs_paths, [['(iii)']]);
});

test('contradictory markers (both series and single-clause language present) yield AMBIGUOUS', () => {
  const result = resolveQualifierAttachment({
    position: 'TRAILING',
    governs_path: ['(iii)'],
    quote_text: 'in each case, except in the case of clause (ii), which is disregarded',
    sibling_limb_paths: [['(i)'], ['(ii)'], ['(iii)']],
  });
  assert.equal(result.scope_reading, 'AMBIGUOUS');
  assert.ok(result.ambiguity_signals.in_each_case_language);
  assert.ok(result.ambiguity_signals.single_clause_language);
  assert.ok(Array.isArray(result.readings));
});

test('a TRAILING qualifier with no sibling limb_paths captured still resolves AMBIGUOUS, just with no readings to show', () => {
  const result = resolveQualifierAttachment({
    position: 'TRAILING',
    governs_path: null,
    quote_text: 'solely as it relates to the foregoing',
    sibling_limb_paths: [],
  });
  assert.equal(result.scope_reading, 'AMBIGUOUS');
  assert.equal(result.readings, null);
});

// ─── The model cannot express a resolved TRAILING reading through the
// schema: the function accepts no scope_reading input at all, so nothing the
// caller passes in can influence the computed value except position and the
// qualifier's own quote text. ───

test('the function has no scope_reading input: passing one has no effect, the marker test always decides', () => {
  const withBogusScopeReading = resolveQualifierAttachment({
    position: 'TRAILING',
    governs_path: ['(iii)'],
    quote_text: 'with no marker language at all',
    scope_reading: 'ALL_ITEMS', // not a real parameter -- must be silently ignored
    sibling_limb_paths: [['(i)'], ['(iii)']],
  });
  assert.equal(withBogusScopeReading.scope_reading, 'AMBIGUOUS');
});

test('in_each_case_language / single_clause_language are computed from the quote, not echoed from a model-supplied field', () => {
  // No such input exists on the function at all -- passing arbitrary extra
  // fields (as a non-conforming caller might) must not leak through.
  const result = resolveQualifierAttachment({
    position: 'TRAILING',
    governs_path: ['(ii)'],
    quote_text: 'in each case as provided herein',
    in_each_case_language: 'THIS IS NOT WHAT WAS MATCHED',
    single_clause_language: 'NEITHER IS THIS',
    sibling_limb_paths: [['(i)'], ['(ii)']],
  });
  assert.equal(result.ambiguity_signals.in_each_case_language, 'in each case');
  assert.equal(result.ambiguity_signals.single_clause_language, null);
});

test('position must be one of the three governed values', () => {
  assert.throws(() => resolveQualifierAttachment({ position: 'PROVISO', quote_text: 'x' }), TypeError);
});

// ─── Marker matching itself. ───

test('firstMarkerMatch is case-insensitive and returns the matched substring verbatim', () => {
  assert.equal(firstMarkerMatch('In Each Case, as provided', SERIES_MARKER_PATTERNS), 'In Each Case');
  assert.equal(firstMarkerMatch('SOLELY WITH RESPECT TO clause (ii)', SINGLE_CLAUSE_MARKER_PATTERNS), 'SOLELY WITH RESPECT TO');
  assert.equal(firstMarkerMatch('no markers here', SERIES_MARKER_PATTERNS), null);
});

// ─── buildAmbiguousReadings directly. ───

test('buildAmbiguousReadings returns null with no valid sibling paths', () => {
  assert.equal(buildAmbiguousReadings([]), null);
  assert.equal(buildAmbiguousReadings([[], null, undefined]), null);
});

test('buildAmbiguousReadings ignores malformed sibling entries but keeps valid ones in order', () => {
  const readings = buildAmbiguousReadings([['(i)'], [], ['(ii)'], ['(iii)']]);
  const series = readings.find((r) => r.reading === 'SERIES');
  assert.deepEqual(series.governs_paths, [['(i)'], ['(ii)'], ['(iii)']]);
});
