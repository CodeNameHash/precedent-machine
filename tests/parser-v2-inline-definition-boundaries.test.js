const test = require('node:test');
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');

const {
  detectStructuralDefinitionProposals,
  normaliseStructuralDefinitionProposals,
} = require('../lib/parser-v2/canonical-structural-definitions');
const {
  definitionSignalPattern,
  findInlineDefinitionUnits,
} = require('../lib/parser-v2/regions/definitions');
const { QXO_5_2_TEXT } = require('./fixtures/qxo-section-5-2');

const LIMITS = Object.freeze({
  max_source_bytes: 4 * 1024 * 1024,
  max_sections: 4096,
  max_definitions: 16384,
  max_residuals: 4096,
  max_total_candidates: 16384,
});

function parsed(sections, bodyEnd) {
  return {
    sections,
    regions: [],
    diagnostics: {
      bodyStart: 0,
      bodyEnd,
      totalArticles: 1,
      delimiter: 'fallback',
      gaps: [],
      regionCoverageGaps: [],
      regionCoverageOverlaps: [],
    },
  };
}

function section(number, startChar, endChar) {
  return {
    number,
    title: `Section ${number}`,
    startChar,
    endChar,
    regionType: 'body.section.provision',
    atomic: false,
    definitionCompletenessWarnings: [],
  };
}

test('inline definition evidence retains internal list semicolons and U.S. periods', () => {
  const text = [
    '(i) "Covered Business" means (A) U.S. Government operations;',
    '(B) Canadian operations; and',
    '(C) Mexican operations; and',
    '(ii) the next clause applies.',
  ].join('\n');

  const units = findInlineDefinitionUnits(text);

  assert.equal(units.length, 1);
  assert.equal(
    text.slice(units[0].start, units[0].end),
    [
      '"Covered Business" means (A) U.S. Government operations;',
      '(B) Canadian operations; and',
      '(C) Mexican operations;',
    ].join('\n'),
  );
});

test('the exact QXO inline definition retains its terminal semicolon only', () => {
  const units = findInlineDefinitionUnits(QXO_5_2_TEXT);

  assert.equal(units.length, 1);
  assert.equal(units[0].term, 'De Minimis Inaccuracies');
  assert.equal(
    QXO_5_2_TEXT.slice(units[0].start, units[0].end),
    '"De Minimis Inaccuracies" means any inaccuracies that individually or in the aggregate '
      + 'are de minimis relative to the total fully diluted equity capitalization of the '
      + 'Company or Parent, as the case may be;',
  );
});

test('inline evidence retains Del. Ch. and other ambiguous sentence periods through its terminal semicolon', () => {
  const text = [
    '(i) "Delaware Decision" means a ruling of the Del. Ch. applying U.S. law;',
    'and',
    '(ii) the next clause applies.',
  ].join('\n');
  const units = findInlineDefinitionUnits(text);

  assert.equal(units.length, 1);
  assert.equal(
    text.slice(units[0].start, units[0].end),
    '"Delaware Decision" means a ruling of the Del. Ch. applying U.S. law;',
  );
});

test('a purpose-clause unquoted definition is emitted but ordinary uses of means are not', () => {
  const text = [
    '(i) For purposes of this Agreement, De Minimis Inaccuracies means any inaccuracies',
    'that are de minimis under Del. Ch. precedent; and',
    '(ii) the next clause applies.',
    'For purposes of this Agreement, the Company means to operate normally.',
    'The Board means to meet tomorrow.',
  ].join('\n');
  const units = findInlineDefinitionUnits(text);

  assert.equal(Array.from(text.matchAll(definitionSignalPattern())).length, 1);
  assert.deepEqual(units.map((unit) => unit.term), ['De Minimis Inaccuracies']);
  assert.equal(
    text.slice(units[0].start, units[0].end),
    'De Minimis Inaccuracies means any inaccuracies\n'
      + 'that are de minimis under Del. Ch. precedent;',
  );
});

test('ambiguous unparented and same-level nested lists remain overinclusive', () => {
  const unparented = [
    '"Covered Actions" means:',
    '(i) filing a notice;',
    '(ii) obtaining consent; and',
    '(iii) closing the transaction.',
    'Next sentence.',
  ].join('\n');
  const sameLevelNested = [
    '(i) "Covered Actions" means:',
    '(i) filing a notice;',
    '(ii) obtaining consent; and',
    '(iii) closing the transaction; and',
    '(ii) the next outer clause.',
  ].join('\n');

  for (const text of [unparented, sameLevelNested]) {
    const [unit] = findInlineDefinitionUnits(text);
    assert.match(text.slice(unit.start, unit.end), /\(iii\) closing the transaction[.;]/);
  }
});

test('a narrower valid sibling survives a malformed overlapping parent', () => {
  const first = '1.1First. "First Term" means first value.\n';
  const second = '1.2Second. "Second Term" means second value.';
  const text = first + second;
  const detected = normaliseStructuralDefinitionProposals({
    cleanText: text,
    governedLimits: LIMITS,
    parsed: parsed([
      {
        startChar: 0,
        endChar: text.length,
        atomic: false,
        definitionCompletenessWarnings: [],
      },
      section('1.1', 0, first.length),
      section('1.2', first.length, text.length),
    ], text.length),
  });

  assert.deepEqual(
    detected.definitions.map((row) => row.neutral_defined_term),
    ['First Term', 'Second Term'],
  );
  assert.ok(detected.candidate_failures.some(
    (row) => row.reason_code === 'OVERLAPPING_STRUCTURAL_PARENT_ISOLATED'
      && row.producer_ordinal === 0,
  ));
});

test('valid sibling sections dominate a malformed wrapper one character wider', () => {
  const prefix = 'x';
  const first = '1.1First. "First Term" means first value.\n';
  const second = '1.2Second. "Second Term" means second value.';
  const text = prefix + first + second;
  const detected = normaliseStructuralDefinitionProposals({
    cleanText: text,
    governedLimits: LIMITS,
    parsed: parsed([
      {
        startChar: 0,
        endChar: text.length,
        atomic: false,
        definitionCompletenessWarnings: [],
      },
      section('1.1', prefix.length, prefix.length + first.length),
      section('1.2', prefix.length + first.length, text.length),
    ], text.length),
  });

  assert.deepEqual(
    detected.definitions.map((row) => row.neutral_defined_term),
    ['First Term', 'Second Term'],
  );
  assert.ok(detected.candidate_failures.some(
    (row) => row.reason_code === 'OVERLAPPING_STRUCTURAL_PARENT_ISOLATED'
      && row.producer_ordinal === 0,
  ));
  assert.deepEqual(
    detected.definitions.map((row) => (
      detected.sections[row.parent_section_index].section_number
    )),
    ['1.1', '1.2'],
  );
});

test('a labelled wrapper overlapping governed children fails closed', () => {
  const prefix = 'x';
  const first = '1.1First. "First Term" means first value.\n';
  const second = '1.2Second. "Second Term" means second value.';
  const text = prefix + first + second;
  const detected = normaliseStructuralDefinitionProposals({
    cleanText: text,
    governedLimits: LIMITS,
    parsed: parsed([
      section('1.0', 0, text.length),
      section('1.1', prefix.length, prefix.length + first.length),
      section('1.2', prefix.length + first.length, text.length),
    ], text.length),
  });

  assert.deepEqual(detected.definitions, []);
  assert.equal(
    detected.candidate_failures.filter(
      (row) => row.reason_code === 'AMBIGUOUS_OVERLAPPING_STRUCTURAL_PARENTS',
    ).length,
    3,
  );
});

test('distinct governed parents with the same geometry fail closed', () => {
  const text = '1.1Provision. "Valid Term" means the complete definition.';
  const detected = normaliseStructuralDefinitionProposals({
    cleanText: text,
    governedLimits: LIMITS,
    parsed: parsed([
      section('1.1', 0, text.length),
      section('9.9', 0, text.length),
    ], text.length),
  });

  assert.deepEqual(detected.definitions, []);
  assert.equal(
    detected.candidate_failures.filter(
      (row) => row.reason_code === 'AMBIGUOUS_OVERLAPPING_STRUCTURAL_PARENTS',
    ).length,
    2,
  );
});

test('a tiny malformed overlap cannot suppress a complete valid parent', () => {
  const text = '1.1Provision. Introductory text. "Valid Term" means the complete definition.';
  const detected = normaliseStructuralDefinitionProposals({
    cleanText: text,
    governedLimits: LIMITS,
    parsed: parsed([
      section('1.1', 0, text.length),
      {
        startChar: 0,
        endChar: 10,
        regionType: null,
        atomic: false,
        definitionCompletenessWarnings: [],
      },
    ], text.length),
  });

  assert.deepEqual(
    detected.definitions.map((row) => row.neutral_defined_term),
    ['Valid Term'],
  );
  assert.ok(detected.candidate_failures.some(
    (row) => row.reason_code === 'OVERLAPPING_STRUCTURAL_PARENT_ISOLATED'
      && row.producer_ordinal === 1,
  ));
});

test('an exact-span malformed duplicate cannot suppress its valid parent', () => {
  const text = '1.1Provision. "Valid Term" means the complete definition.';
  const detected = normaliseStructuralDefinitionProposals({
    cleanText: text,
    governedLimits: LIMITS,
    parsed: parsed([
      section('1.1', 0, text.length),
      {
        startChar: 0,
        endChar: text.length,
        atomic: false,
        definitionCompletenessWarnings: [],
      },
    ], text.length),
  });

  assert.deepEqual(
    detected.definitions.map((row) => row.neutral_defined_term),
    ['Valid Term'],
  );
  assert.ok(detected.candidate_failures.some(
    (row) => row.reason_code === 'OVERLAPPING_STRUCTURAL_PARENT_ISOLATED'
      && row.producer_ordinal === 1,
  ));
});

test('4,096 overlapping maximum-size parents are isolated before one source-bounded scan', () => {
  const prefix = '"Budget Term" means a bounded value. ';
  const text = prefix.padEnd(LIMITS.max_source_bytes, 'x');
  const sections = Array.from(
    { length: LIMITS.max_sections },
    () => section('1.1', 0, text.length),
  );
  const detected = normaliseStructuralDefinitionProposals({
    cleanText: text,
    governedLimits: LIMITS,
    parsed: parsed(sections, text.length),
  });

  assert.equal(detected.definitions.length, 1);
  assert.equal(detected.definitions[0].neutral_defined_term, 'Budget Term');
  assert.equal(
    detected.candidate_failures.filter(
      (row) => row.reason_code === 'OVERLAPPING_STRUCTURAL_PARENT_ISOLATED',
    ).length,
    LIMITS.max_sections - 1,
  );
  assert.equal(
    detected.candidate_failures.some(
      (row) => row.reason_code === 'SECTION_SCAN_CHARACTER_BUDGET_EXCEEDED',
    ),
    false,
  );
});

test('the governed aggregate scan budget fails closed after the admitted character ceiling', () => {
  const first = '"First Term" means first value.'.padEnd(40, ' ');
  const second = '"Second Term" means second value.'.padEnd(40, ' ');
  const text = first + second;
  const detected = normaliseStructuralDefinitionProposals({
    cleanText: text,
    governedLimits: {
      ...LIMITS,
      max_source_bytes: first.length,
    },
    parsed: parsed([
      section('1.1', 0, first.length),
      section('1.2', first.length, text.length),
    ], text.length),
  });

  assert.deepEqual(
    detected.definitions.map((row) => row.neutral_defined_term),
    ['First Term'],
  );
  assert.ok(detected.candidate_failures.some(
    (row) => row.reason_code === 'SECTION_SCAN_CHARACTER_BUDGET_EXCEEDED'
      && row.producer_ordinal === 1,
  ));
});

test('16,000 governed definition signals remain within the runtime ceiling', () => {
  const definitions = Array.from(
    { length: 16000 },
    (_, index) => `"Term ${String(index).padStart(5, '0')}" means value.`,
  ).join(' ');
  const text = `1.1Definitions. ${definitions}`;
  const started = performance.now();
  const detected = detectStructuralDefinitionProposals(text, LIMITS);
  const elapsed = performance.now() - started;

  assert.equal(detected.definitions.length, 16000);
  assert.ok(elapsed < 5000, `definition detection took ${Math.round(elapsed)}ms`);
});
