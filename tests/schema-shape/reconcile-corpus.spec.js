const test = require('node:test');
const assert = require('node:assert/strict');

const { buildQueue } = require('../../scripts/schema-shape/reconcile-corpus');
const { normalizeValue } = require('../../lib/schema-shape/normalize-value');

test('PH0C-E: retrospective sweep is idempotent', () => {
  const normalized = {
    entries: [
      {
        key: 'triggerCode',
        vocab_ref: 'FROZEN-triggerCode-v1',
        deal_id: 'METSERA',
        value: {
          canonicalKey: 'FREEFORM',
          extractorRawValue: 'strange bespoke trigger',
          sourceProvisionId: 'prov-1',
        },
      },
    ],
  };
  const once = buildQueue(normalized);
  const twice = buildQueue(normalized, once);
  assert.deepEqual(twice, once);
  assert.equal(once.entries.length, 1);
  assert.equal(once.entries[0].status, 'NEW');
});

test('PH0C-E: known aliases do not queue', () => {
  const known = normalizeValue('end date', 'FROZEN-triggerCode-v1', 'prov-2');
  assert.equal(known.canonicalKey, 'OUTSIDE_DATE_ELAPSED');
  const queue = buildQueue({ entries: [{ key: 'triggerCode', vocab_ref: 'FROZEN-triggerCode-v1', value: known }] });
  assert.deepEqual(queue.entries, []);
});
