'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const { compareAcross } = require('../lib/product/provision-compare');

const shapes = {
  sections: [{ section_key: 's', tables: [{ table_key: 'termination-fees', columns: [
    { column_id: 'trigger', render: 'vocabulary', vocabulary: [
      { code: 'NO_VOTE', label: 'No-vote termination' },
      { code: 'SUPERIOR_PROPOSAL', label: 'Superior proposal' },
    ] },
  ] }] }],
  shared_vocabularies: {},
};
const agreement = (id, code) => ({
  source_document_id: id,
  agreement_label: id,
  facts: [{ statement: 'Fee.', conclusions: { table_key: 'termination-fees', row_label: 'Termination fee', cells: [{ column_id: 'trigger', code }] } }],
});

test('the same provision lines up across agreements and counts the answers', () => {
  const rows = compareAcross([agreement('a', 'NO_VOTE'), agreement('b', 'SUPERIOR_PROPOSAL'), agreement('c', 'NO_VOTE')], shapes);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].row_label, 'Termination fee');
  assert.equal(rows[0].by_source.a[0].answer, 'No-vote termination');
  assert.deepEqual(rows[0].distribution, { 'No-vote termination': 2, 'Superior proposal': 1 });
  assert.equal(rows[0].n, 3);
});

test('an agreement that does not answer a row is simply absent from it', () => {
  const rows = compareAcross([agreement('a', 'NO_VOTE')], shapes);
  assert.equal(rows[0].by_source.b, undefined);
  assert.equal(rows[0].n, 1);
});
