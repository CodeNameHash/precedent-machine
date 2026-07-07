const test = require('node:test');
const assert = require('node:assert/strict');

const { buildQueue } = require('../../scripts/schema-shape/reconcile-corpus');
const { normalizeValue } = require('../../lib/schema-shape/normalize-value');

test('PH0C-E: retrospective sweep is idempotent', () => {
  const normalized = {
    triples: [
      {
        deal_id: 'METSERA',
        field_key: 'triggerCode',
        canonicalKey: null,
        raw_value: 'strange bespoke trigger',
        source_provision_id: 'prov-1',
        evidence_quote: 'The company may terminate for a strange bespoke trigger.',
      },
    ],
  };
  const once = buildQueue(normalized);
  const twice = buildQueue(normalized);
  assert.deepEqual(twice, once);
  assert.equal(once.entries.length, 1);
  assert.equal(once.entries[0].status, 'NEW');
});

test('PH0C-E: known aliases do not queue', () => {
  const known = normalizeValue('end date', 'FROZEN-triggerCode-v1', 'prov-2');
  assert.equal(known.canonicalKey, 'OUTSIDE_DATE_ELAPSED');
  const queue = buildQueue({
    triples: [{
      deal_id: 'METSERA',
      field_key: 'triggerCode',
      canonicalKey: known.canonicalKey,
      raw_value: 'end date',
      source_provision_id: 'prov-2',
    }],
  });
  assert.deepEqual(queue.entries, []);
});
