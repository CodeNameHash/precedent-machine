'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  classifyDeterministicSectionFamily,
  classifyDeterministicSectionFamilies,
  classifySectionFamily,
} = require('../lib/canonical-v2/native-producer/section-family-classifier');

const CASES = [
  ['Finders/Brokers Fees', 'REPRESENTATIONS'],
  ['Termination of Exchange Fund', 'UNRESOLVED'],
  ['Termination of Certain Agreements', 'UNRESOLVED'],
  ['Termination of Intercompany Contracts', 'UNRESOLVED'],
  ['Directors and Officers of the Surviving Corporation', 'MERGER_STRUCTURE_CLOSING'],
  ['Tax Considerations', 'UNRESOLVED'],
  ['Material Adverse Effect. The Company shall not take any action', 'UNRESOLVED'],
];

for (const [title, expected] of CASES) {
  test(`captured-corpus exclusion: ${title} resolves as ${expected}`, () => {
    const actual = classifyDeterministicSectionFamily({ title, article_context: null, source_text: title });
    assert.equal(actual?.section_family || 'UNRESOLVED', expected);
  });
}

test('deterministic detection returns every justified family and the compatibility adapter returns one', () => {
  const input = {
    title: 'Definitions and Specific Performance',
    source_text: '“Company Material Adverse Effect” means any event, change or circumstance.',
  };
  const classifications = classifyDeterministicSectionFamilies(input);
  assert.deepEqual(
    classifications.map((item) => item.section_family),
    ['KEY_DEFINED_TERMS', 'SPECIFIC_PERFORMANCE_REMEDIES', 'MAE_DEFINITION'],
  );
  assert.equal(classifyDeterministicSectionFamily(input).section_family, 'KEY_DEFINED_TERMS');
});

test('deterministic detection supplies the five previously missing governed routes', () => {
  const cases = [
    [{ title: 'Capitalization' }, 'CAPITALISATION'],
    [{ title: 'Effective Time' }, 'MERGER_STRUCTURE_CLOSING'],
    [{ title: 'Governing Law' }, 'MISC_BOILERPLATE'],
    [{ title: 'Specific Performance' }, 'SPECIFIC_PERFORMANCE_REMEDIES'],
    [{ title: 'Definitions', source_text: '“Parent Material Adverse Effect” means any event.' }, 'MAE_DEFINITION'],
  ];
  for (const [input, family] of cases) {
    assert.equal(
      classifyDeterministicSectionFamilies(input).some((item) => item.section_family === family),
      true,
      `${family} should have a deterministic route`,
    );
  }
});

test('a body-polluted heading remains unresolved and never reaches the provider', async () => {
  let calls = 0;
  const result = await classifySectionFamily({
    title: 'Material Adverse Effect. The Company shall not take any action',
    source_text: 'Material Adverse Effect appears in this provision.',
    classifier_provider: async () => { calls += 1; return { section_family: 'MAE_DEFINITION' }; },
  });
  assert.equal(result.section_family, null);
  assert.equal(result.declined_reason, 'BODY_POLLUTED_HEADING');
  assert.equal(calls, 0);
});
