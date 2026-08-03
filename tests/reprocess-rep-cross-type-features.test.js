const test = require('node:test');
const assert = require('node:assert/strict');

const {
  hydratePerTypeCrossTypeFeatures,
} = require('../lib/parser-v2/run-extract');

test('REP per-type extraction rebuilds knowledge features from the stored definition', () => {
  const extracted = [{
    type: 'REP-T',
    code: 'REP-T-COMPLY',
    text: 'To the Knowledge of the Company, the Company is in compliance with applicable Law.',
    features: {},
  }];
  const definitions = [{
    type: 'DEF',
    provision_subtype: 'DEF-KNOWLEDGE',
    category: 'Knowledge',
    full_text: '“Knowledge” means the actual knowledge of Alice Example and Bob Example.',
    ai_metadata: {
      features: {
        canonicalTerm: 'Knowledge',
        definitionText: 'the actual knowledge of Alice Example and Bob Example',
      },
    },
  }];

  hydratePerTypeCrossTypeFeatures('REP-T', extracted, definitions);

  assert.equal(
    extracted[0].features.knowledgeScope,
    'the actual knowledge of Alice Example and Bob Example',
  );
  assert.deepEqual(extracted[0].features.knowledgeQualifier, {
    code: 'KNOWLEDGE_QUALIFIED',
    label: 'Knowledge-qualified',
    text: 'To the Knowledge of',
  });
});

test('non-REP per-type extraction remains unchanged', () => {
  const extracted = [{ type: 'MISC', text: 'Miscellaneous', features: {} }];
  assert.equal(hydratePerTypeCrossTypeFeatures('MISC', extracted, []), extracted);
  assert.deepEqual(extracted[0].features, {});
});
