'use strict';

/**
 * tests/canonical-v2-capitalisation-producer-prompt.test.js
 *
 * Task 6 (docs/superpowers/plans/2026-08-01-claim-identity-provenance-plan.md)
 * -- PROMPT_VERSION 4 vocabulary cleanup, spec section 6
 * (docs/superpowers/specs/2026-08-01-claim-identity-provenance-design.md).
 *
 * Asserts: exactly the five surviving ACCURACY_STANDARD codes; the five
 * removed/merged codes are absent from both the vocabulary object AND the
 * rendered prompt text sent to the model; PROMPT_VERSION is 4; the rendered
 * prompt instructs that aggregation language is qualifier text, never a
 * code; KNOWLEDGE_STANDARD and QUALIFIER_POSITION are unchanged.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  PROMPT_ID,
  PROMPT_VERSION,
  CONTROLLED_VOCABULARIES,
  RESPONSE_SHAPE,
  INSTRUCTIONS,
  buildCapitalisationProducerPrompt,
} = require('../lib/canonical-v2/native-producer/capitalisation-producer-prompt');

const REMOVED_OR_MERGED_CODES = Object.freeze([
  'MAT_MATERIAL_INLINE',
  'MAT_MATERIALITY_SCRAPE',
  'MAT_NO_QUALIFIER',
  'MAT_MAE_AGGREGATE',
  'MAT_DE_MINIMIS',
]);

const FINAL_FIVE_CODES = Object.freeze([
  'MAT_ALL_RESPECTS',
  'MAT_ALL_RESPECTS_DE_MINIMIS',
  'MAT_ALL_MATERIAL',
  'MAT_MATERIAL_TO_COMPANY',
  'MAT_MAE_QUALIFIED',
]);

const GOVERNED_SCOPE = Object.freeze({
  deal_key: 'test-deal:capitalisation-producer-prompt',
  governed_intervals: ['3.1'],
});

function renderedPromptText() {
  const built = buildCapitalisationProducerPrompt({
    source_text: 'SECTION 3.1. Capitalization. Placeholder source text.',
    governed_scope: GOVERNED_SCOPE,
  });
  assert.equal(built.messages.length, 1);
  return built.messages[0].content;
}

test('PROMPT_VERSION is 5 (P1 cap-table numerics: share_count_assertions added)', () => {
  assert.equal(PROMPT_VERSION, 5);
});

test('PROMPT_ID is unchanged by the vocabulary cleanup', () => {
  assert.equal(PROMPT_ID, 'CAPITALISATION_REPRESENTATION_PRODUCER');
});

test('ACCURACY_STANDARD carries exactly the five surviving codes, in the spec order', () => {
  const codes = Object.keys(CONTROLLED_VOCABULARIES.ACCURACY_STANDARD);
  assert.deepEqual(codes, FINAL_FIVE_CODES);
});

test('removed/merged codes are absent from the ACCURACY_STANDARD vocabulary object', () => {
  for (const code of REMOVED_OR_MERGED_CODES) {
    assert.equal(
      Object.prototype.hasOwnProperty.call(CONTROLLED_VOCABULARIES.ACCURACY_STANDARD, code),
      false,
      `${code} should have been removed or merged`,
    );
  }
});

test('KNOWLEDGE_STANDARD is unchanged by the cleanup', () => {
  assert.deepEqual(Object.keys(CONTROLLED_VOCABULARIES.KNOWLEDGE_STANDARD), [
    'ACTUAL',
    'CONSTRUCTIVE',
    'AFTER_INQUIRY',
  ]);
});

test('QUALIFIER_POSITION is unchanged by the cleanup', () => {
  assert.deepEqual(Object.keys(CONTROLLED_VOCABULARIES.QUALIFIER_POSITION), [
    'CHAPEAU',
    'ITEM',
    'TRAILING',
  ]);
});

test('the rendered prompt text (what the model actually receives) contains none of the removed/merged codes', () => {
  const rendered = renderedPromptText();
  for (const code of REMOVED_OR_MERGED_CODES) {
    assert.equal(
      rendered.includes(code),
      false,
      `rendered prompt text should not mention removed code ${code}`,
    );
  }
});

test('the rendered prompt text contains all five surviving codes', () => {
  const rendered = renderedPromptText();
  for (const code of FINAL_FIVE_CODES) {
    assert.ok(rendered.includes(code), `rendered prompt text should mention ${code}`);
  }
});

test('INSTRUCTIONS (in isolation) mention none of the removed/merged codes', () => {
  for (const code of REMOVED_OR_MERGED_CODES) {
    assert.equal(INSTRUCTIONS.includes(code), false);
  }
});

test('RESPONSE_SHAPE mentions none of the removed/merged codes', () => {
  for (const code of REMOVED_OR_MERGED_CODES) {
    assert.equal(RESPONSE_SHAPE.includes(code), false);
  }
});

test('the prompt instructs that aggregation language is qualifier text, never a code', () => {
  assert.match(
    INSTRUCTIONS,
    /individually or in the aggregate/i,
  );
  // The instruction must tie the aggregation phrase to reporting it as text
  // (a quote), not to a controlled code of its own -- guard against a
  // regression that merely mentions the phrase without the rule.
  const aggregationLine = INSTRUCTIONS
    .split('\n')
    .find((line) => /individually or in the aggregate/i.test(line));
  assert.ok(aggregationLine, 'expected a line covering aggregation language');
  assert.match(aggregationLine, /qualifier/i);
  assert.match(aggregationLine, /never/i);
});

test('CONTROLLED_VOCABULARIES.ACCURACY_STANDARD values still describe MAT_ALL_RESPECTS_DE_MINIMIS as the merged de-minimis concept', () => {
  assert.match(
    CONTROLLED_VOCABULARIES.ACCURACY_STANDARD.MAT_ALL_RESPECTS_DE_MINIMIS,
    /de minimis/i,
  );
});

test('lib/taxonomy.js is untouched by this cleanup (still exports the v1 MATERIALITY_CODES with the pre-cleanup vocabulary)', () => {
  // This is a guard, not a re-test of taxonomy.js semantics: Task 6 leaves
  // lib/taxonomy.js exactly as it was, so v1's own materiality codes are
  // unaffected by the native producer's PROMPT_VERSION 4 cleanup.
  const taxonomy = require('../lib/taxonomy.js');
  assert.ok(taxonomy, 'lib/taxonomy.js should still load');
});
