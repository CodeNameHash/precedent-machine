const test = require('node:test');
const assert = require('node:assert/strict');

const { buildQueue, needsCanonicalReview } = require('../../scripts/schema-shape/reconcile-corpus');
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

test('PH0C-E: free-text and presence-only fields do not enter the reconciliation queue', () => {
  assert.equal(needsCanonicalReview('canonicalTerm', { type: 'string' }), false);
  assert.equal(needsCanonicalReview('crossReferences', { enumValues: ['ABSENT', 'PRESENT', 'UNKNOWN'] }), false);
  const queue = buildQueue({
    entries: [
      { key: 'canonicalTerm', type: 'string' },
      { key: 'crossReferences', type: 'enum', enumValues: ['ABSENT', 'PRESENT', 'UNKNOWN'] },
    ],
    triples: [
      { deal_id: 'deal-1', field_key: 'canonicalTerm', canonicalKey: null, raw_value: 'SEC', source_provision_id: 'prov-1' },
      { deal_id: 'deal-1', field_key: 'crossReferences', canonicalKey: null, raw_value: 'Exchange Act', source_provision_id: 'prov-2' },
    ],
  });
  assert.deepEqual(queue.entries, []);
});
