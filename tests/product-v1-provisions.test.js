'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const { v1Agreements, mergeGenerations } = require('../lib/product/v1-provisions');

function client({ deals, provisions }) {
  return {
    from(table) {
      const rows = table === 'deals' ? deals : provisions;
      const query = {
        select: () => query,
        in: () => Promise.resolve({ data: rows, error: null }),
      };
      return query;
    },
  };
}

test('V1 agreements come back labelled and marked as V1', async () => {
  const result = await v1Agreements(client({
    deals: [{ id: 'd1', acquirer: 'Acquirer', target: 'Target' }],
    provisions: [{ id: 'p1', deal_id: 'd1', type: 'IOC', category: 'Preservation', ai_metadata: { code: 'IOC-PRESERVE' } }],
  }), ['d1']);
  assert.equal(result.length, 1);
  assert.equal(result[0].label, 'Target / Acquirer');
  assert.equal(result[0].generation, 'V1');
  assert.equal(result[0].rows[0].answer.text, 'Ioc Preserve');
});

test('the merged comparison keeps V1 and V2 rows apart and stamps every cell', () => {
  const merged = mergeGenerations(
    [{ table_key: 'termination-fees', row_label: 'Termination fee', by_source: { v2: [{ answer: 'No-vote termination' }] } }],
    [{ id: 'd1', rows: [{ row_key: 'IOC', row_label: 'Preservation', answer: { text: 'Ioc Preserve' }, condition: null }] }],
  );
  assert.equal(merged.length, 2);
  const generations = merged.flatMap((row) => row.cells.map((cell) => cell.generation));
  assert.deepEqual(generations.sort(), ['V1', 'V2']);
});
