const test = require('node:test');
const assert = require('node:assert/strict');
const { carveoutCount, selectMaeDefinition } = require('../scripts/eval');

test('selectMaeDefinition prefers the actual MAE row over related Effect rows', () => {
  const rows = [
    {
      type: 'DEF',
      category: 'Effect',
      ai_metadata: {
        features: {
          canonicalCode: 'DEF-MAE',
          canonicalTerm: 'Effect',
        },
      },
    },
    {
      id: 'target-mae',
      type: 'DEF',
      category: 'Material Adverse Effect',
      ai_metadata: {
        features: {
          canonicalCode: 'DEF-MAE',
          canonicalTerm: 'Material Adverse Effect',
          carveouts: Array.from({ length: 16 }, (_, i) => ({ code: `C${i}` })),
        },
      },
    },
    {
      type: 'DEF',
      category: 'Parent Material Adverse Effect',
      ai_metadata: {
        features: {
          canonicalCode: 'DEF-MAE',
          canonicalTerm: 'Parent Material Adverse Effect',
        },
      },
    },
  ];

  const selected = selectMaeDefinition(rows);
  assert.equal(selected.id, 'target-mae');
  assert.equal(carveoutCount(selected), 16);
});
