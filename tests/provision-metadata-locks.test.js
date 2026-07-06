const test = require('node:test');
const assert = require('node:assert/strict');

const {
  mergeProvisionAiMetadata,
  unlockedFeaturePatch,
} = require('../lib/provision-metadata-locks');

test('definitionText is stripped from incoming feature edits', () => {
  assert.deepEqual(
    unlockedFeaturePatch({
      canonicalTerm: 'Final Order',
      definitionText: 'edited text that is not the provision',
      permittedExceptions: ['x'],
    }),
    {
      canonicalTerm: 'Final Order',
      permittedExceptions: ['x'],
    },
  );
});

test('metadata merge preserves existing definitionText while accepting other feature edits', () => {
  const merged = mergeProvisionAiMetadata(
    {
      code: 'DEF-GENERAL',
      features: {
        canonicalTerm: 'Final Order',
        definitionText: '"Final Order" means an order that is final.',
      },
    },
    {
      features: {
        canonicalTerm: 'Final Order',
        definitionText: 'user-edited non-source text',
        crossReferences: ['Order'],
      },
    },
  );

  assert.equal(merged.user_corrected, true);
  assert.equal(merged.code, 'DEF-GENERAL');
  assert.deepEqual(merged.features, {
    canonicalTerm: 'Final Order',
    definitionText: '"Final Order" means an order that is final.',
    crossReferences: ['Order'],
  });
});
