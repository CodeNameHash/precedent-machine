const test = require('node:test');
const assert = require('node:assert/strict');

const {
  fetchStoredDefinitionsForPostPass,
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
    category: 'Knowledge',
    full_text: '“Knowledge” means the actual knowledge of Alice Example and Bob Example.',
    ai_metadata: {
      code: 'DEF-KNOWLEDGE',
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

test('stored definition lookup uses only columns in the legacy provisions table', async () => {
  let selected = null;
  const query = {
    select(columns) {
      selected = columns;
      return this;
    },
    eq() { return this; },
    then(resolve, reject) {
      return Promise.resolve({ data: [{ type: 'DEF', category: 'Knowledge', full_text: 'text', ai_metadata: {} }], error: null })
        .then(resolve, reject);
    },
  };
  const sb = {
    from(table) {
      assert.equal(table, 'provisions');
      return query;
    },
  };

  const rows = await fetchStoredDefinitionsForPostPass(sb, 'deal-id');
  assert.equal(selected, 'type, category, full_text, ai_metadata');
  assert.equal(rows.length, 1);
});

test('non-REP per-type extraction remains unchanged', () => {
  const extracted = [{ type: 'MISC', text: 'Miscellaneous', features: {} }];
  assert.equal(hydratePerTypeCrossTypeFeatures('MISC', extracted, []), extracted);
  assert.deepEqual(extracted[0].features, {});
});
