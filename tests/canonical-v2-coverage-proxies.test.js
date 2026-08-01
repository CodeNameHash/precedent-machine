'use strict';

/**
 * tests/canonical-v2-coverage-proxies.test.js
 *
 * Test-first for lib/canonical-v2/native-producer/coverage-proxies.js.
 * Calibrates against the real governed-section source text
 * (tests/fixtures/qxo-section-3-1-b.txt) and the two REAL recorded F28
 * runs, per the file header's documented calibration: the section carries
 * 10 total marker hits ("as of" x5, "except" x4, "material" x1,
 * "knowledge" x0); run 1's ~12 qualifiers should NOT trip the
 * QUALIFIER_MARKER_GAP signal, run 2's 2 qualifiers SHOULD.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { parseJSON } = require('../lib/parser-v2/parse-json');
const { indexOfIgnoringZeroWidth, normaliseForMatching } = require('../lib/canonical-v2/zero-width-normalise');
const {
  computeCoverageProxies,
  CoverageProxiesError,
  MARKERS,
  QUALIFIER_MARKER_RATIO_SUSPECT_THRESHOLD,
  COVERAGE_SHARE_SUSPECT_THRESHOLD,
} = require('../lib/canonical-v2/native-producer/coverage-proxies');

const SOURCE_TEXT = fs.readFileSync(
  path.join(__dirname, 'fixtures', 'qxo-section-3-1-b.txt'),
  'utf8',
);

function loadRecordedResponse(relativePath) {
  const recording = JSON.parse(fs.readFileSync(path.join(__dirname, relativePath), 'utf8'));
  const parsed = parseJSON(recording.raw_response_text);
  assert.ok(parsed, `recorded fixture at ${relativePath} must parse via parseJSON`);
  return parsed;
}

function locateSpan(sourceText, quote) {
  const startChar = indexOfIgnoringZeroWidth(sourceText, quote);
  if (startChar === -1) return null;
  const normalisedNeedleLength = normaliseForMatching(quote).length;
  let consumed = 0;
  let endChar = startChar;
  while (consumed < normalisedNeedleLength && endChar < sourceText.length) {
    if (!/[​‌‍‎‏﻿­]/.test(sourceText[endChar])) consumed += 1;
    endChar += 1;
  }
  const byteStart = Buffer.byteLength(sourceText.slice(0, startChar), 'utf8');
  const byteEnd = byteStart + Buffer.byteLength(sourceText.slice(startChar, endChar), 'utf8');
  return { start: byteStart, end: byteEnd };
}

function collectAssertionSpansAndQualifiers(recorded) {
  const spans = [];
  const qualifiers = [];
  for (const representation of recorded.representation_instances || []) {
    for (const limb of representation.limbs || []) {
      const span = locateSpan(SOURCE_TEXT, limb.assertion_quote);
      if (span) spans.push(span);
      for (const qualifier of limb.qualifiers || []) {
        qualifiers.push({ quote: qualifier.quote });
      }
    }
    // Run 2's PROMPT_VERSION 2 shape carries qualifiers at the
    // representation level, not per limb (docs/handoffs/
    // F28-SECOND-LIVE-RUN.md defect 2) -- collect both shapes.
    for (const qualifier of representation.qualifiers || []) {
      qualifiers.push({ quote: qualifier.quote });
    }
  }
  return { spans, qualifiers };
}

test('MARKERS and the calibration numbers documented in the file header hold for the real fixture', () => {
  assert.deepEqual(MARKERS, ['as of', 'except', 'knowledge', 'material']);
  const lower = SOURCE_TEXT.toLowerCase();
  assert.equal((lower.match(/as of/g) || []).length, 5);
  assert.equal((lower.match(/except/g) || []).length, 4);
  assert.equal((lower.match(/knowledge/g) || []).length, 0);
  assert.equal((lower.match(/material/g) || []).length, 1);
});

test('computeCoverageProxies: run 1 (rich qualifiers) does not trip QUALIFIER_MARKER_GAP', () => {
  const run1Raw = loadRecordedResponse('fixtures/canonical-v2/f28-live-run/qxo-topbuild-3-1-b-live-response.json');
  const { spans, qualifiers } = collectAssertionSpansAndQualifiers(run1Raw);

  const report = computeCoverageProxies({
    section_reference: '3.1(b)',
    source_text: SOURCE_TEXT,
    assertion_spans: spans,
    qualifiers,
  });

  assert.equal(report.schema_version, 'COVERAGE_PROXY_REPORT/V1');
  assert.equal(report.marker_counts.total, 10);
  assert.ok(qualifiers.length >= 10);
  const gapSignal = report.signals.find((signal) => signal.reason === 'QUALIFIER_MARKER_GAP');
  assert.equal(gapSignal, undefined, 'run 1 should not be flagged for qualifier/marker gap');
});

test('computeCoverageProxies: run 2 (2 qualifiers against 10 markers) DOES trip QUALIFIER_MARKER_GAP', () => {
  const run2Raw = loadRecordedResponse('fixtures/canonical-v2/f28-second-live-run/qxo-topbuild-3-1-b-live-response.json');
  const { spans, qualifiers } = collectAssertionSpansAndQualifiers(run2Raw);

  const report = computeCoverageProxies({
    section_reference: '3.1(b)',
    source_text: SOURCE_TEXT,
    assertion_spans: spans,
    qualifiers,
  });

  assert.equal(report.marker_counts.total, 10);
  assert.equal(qualifiers.length, 2, 'run 2 (defect 2) emits only 2 representation-level qualifiers');
  const gapSignal = report.signals.find((signal) => signal.reason === 'QUALIFIER_MARKER_GAP');
  assert.ok(gapSignal, 'run 2 must be flagged: 2 qualifiers against 10 source markers');
  assert.equal(gapSignal.type, 'COVERAGE_SUSPECT');
  assert.ok(gapSignal.ratio < QUALIFIER_MARKER_RATIO_SUSPECT_THRESHOLD);

  // Run 2's 21 limbs cover almost the whole governed section, so span
  // coverage alone should stay healthy even though qualifiers are sparse --
  // the two proxies are independent.
  assert.ok(report.coverage_share > COVERAGE_SHARE_SUSPECT_THRESHOLD);
  assert.equal(report.signals.some((signal) => signal.reason === 'LOW_SPAN_COVERAGE'), false);
});

test('computeCoverageProxies: overlapping spans are merged, not double-counted', () => {
  const report = computeCoverageProxies({
    section_reference: 'x',
    source_text: 'ABCDEFGHIJ',
    assertion_spans: [{ start: 0, end: 5 }, { start: 3, end: 8 }],
    qualifiers: [],
  });
  assert.equal(report.covered_byte_length, 8);
  assert.equal(report.coverage_share, 0.8);
});

test('computeCoverageProxies: low span coverage trips LOW_SPAN_COVERAGE', () => {
  const report = computeCoverageProxies({
    section_reference: 'x',
    source_text: 'A'.repeat(100),
    assertion_spans: [{ start: 0, end: 10 }],
    qualifiers: [{ quote: 'irrelevant' }],
  });
  assert.equal(report.coverage_share, 0.1);
  const lowCoverageSignal = report.signals.find((signal) => signal.reason === 'LOW_SPAN_COVERAGE');
  assert.ok(lowCoverageSignal);
});

test('computeCoverageProxies: zero-width marks in source text do not inflate or deflate marker counts', () => {
  const withZeroWidth = 'except​for as‌of knowledge material';
  const withoutZeroWidth = 'exceptfor asof knowledge material';
  const a = computeCoverageProxies({
    section_reference: 'x', source_text: withZeroWidth, assertion_spans: [], qualifiers: [],
  });
  const b = computeCoverageProxies({
    section_reference: 'x', source_text: withoutZeroWidth, assertion_spans: [], qualifiers: [],
  });
  assert.deepEqual(a.marker_counts, b.marker_counts);
});

test('computeCoverageProxies: frozen output, typed errors on malformed input', () => {
  const report = computeCoverageProxies({
    section_reference: 'x', source_text: 'as of except knowledge material', assertion_spans: [], qualifiers: [],
  });
  assert.ok(Object.isFrozen(report));
  assert.ok(Object.isFrozen(report.signals));
  assert.throws(() => computeCoverageProxies({ section_reference: 'x', source_text: 123, assertion_spans: [], qualifiers: [] }), CoverageProxiesError);
  assert.throws(() => computeCoverageProxies({ section_reference: 'x', source_text: 'x', assertion_spans: 'nope', qualifiers: [] }), CoverageProxiesError);
});
