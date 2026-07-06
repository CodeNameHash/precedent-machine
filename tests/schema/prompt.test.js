const test = require('node:test');
const assert = require('node:assert/strict');

const {
  MODEL_READONLY_KEYS,
  LOW_VALUE_PROMPT_KEYS,
  renderExtractionPrompt,
  renderExtractionPromptParts,
} = require('../../lib/schema/prompt');
const { getFeaturesForType } = require('../../lib/rubric');
const { buildFeatureInstructions } = require('../../lib/parser-v2/extract');

test('schema prompt policy excludes readonly and low-value fields by default', () => {
  const prompt = renderExtractionPrompt('REP-T', null, {
    features: getFeaturesForType('REP-T'),
  });

  assert.equal(MODEL_READONLY_KEYS.has('linkedBringDownStandard'), true);
  assert.equal(MODEL_READONLY_KEYS.has('aocCitedCovenantNames'), true);
  assert.equal(LOW_VALUE_PROMPT_KEYS.has('scheduleReference'), true);
  assert.doesNotMatch(prompt, /\blinkedBringDownStandard\b/);
  assert.doesNotMatch(prompt, /\baocCitedCovenantNames\b/);
  assert.doesNotMatch(prompt, /\bscheduleReference\b/);
});

test('mainConcept is rendered as a fallback summary, not a primary schema target', () => {
  const parts = renderExtractionPromptParts('TERMR', null, {
    features: getFeaturesForType('TERMR'),
  });
  const lines = parts.lines.join('\n');

  assert.match(lines, /Fallback summary:/);
  assert.match(lines, /mainConcept: .*Fallback one-sentence provision summary for admin\/search/);
  assert.ok(lines.indexOf('Fallback summary:') > lines.indexOf('Deal certainty:'));
});

test('permittedExceptions prompt preserves nuanced exception shapes', () => {
  const prompt = renderExtractionPrompt('IOC', null, {
    features: getFeaturesForType('IOC'),
  });

  assert.match(prompt, /permittedExceptions/);
  assert.match(prompt, /preserve the shape\/quote the agreement uses/);
  assert.equal((prompt.match(/\bpermittedExceptions:/g) || []).length, 1);
});

test('material contract buckets are promptable but not closed-world', () => {
  const prompt = renderExtractionPrompt('REP-T', null, {
    features: getFeaturesForType('REP-T'),
  });

  assert.match(prompt, /materialContractsBuckets/);
  assert.match(prompt, /Use the best canonical bucket where available/);
  assert.match(prompt, /OTHER with verbatim text/);
});

test('extractor prompt seam uses schema policy while retaining bespoke legal blocks', () => {
  const instr = buildFeatureInstructions('REP-T');

  assert.match(instr, /Fallback one-sentence provision summary for admin\/search/);
  assert.match(instr, /MATERIAL CONTRACTS REP/);
  assert.doesNotMatch(instr, /\blinkedBringDownStandard\b/);
  assert.doesNotMatch(instr, /\baocCitedCovenantNames\b/);
  assert.doesNotMatch(instr, /\bknowledgeScope\b(?!Type)/);
});
