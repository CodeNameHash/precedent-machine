const test = require('node:test');
const assert = require('node:assert/strict');

const { isTriple, migrateDocument, migrateValue } = require('../../scripts/schema-shape/migrate-to-triples');

test('PH0C-A: migrate-to-triples is idempotent and complete', () => {
  const fixture = {
    entries: [
      { key: 'party', vocab_ref: 'FROZEN-party_role-v1', value: 'company', sourceProvisionId: 'p1' },
      { key: 'freeText', value: 'not migrated' },
    ],
  };
  const once = migrateDocument(fixture);
  const twice = migrateDocument(once);
  assert.deepEqual(twice, once);
  assert.equal(isTriple(once.entries[0].value), true);
  assert.deepEqual(once.entries[0].value, {
    canonicalKey: 'company',
    extractorRawValue: null,
    sourceProvisionId: 'p1',
  });
  assert.equal(once.entries[1].value, 'not migrated');
});

test('PH0C-A: migrated triples are byte-stable across helper runs', () => {
  const fixture = { entries: [{ key: 'triggerCode', value: 'outside date' }] };
  const triples = [{
    deal_id: 'deal-1',
    field_key: 'triggerCode',
    canonicalKey: 'OUTSIDE_DATE_ELAPSED',
    raw_value: 'outside date',
    source_provision_id: 'prov-1',
  }];
  assert.deepEqual(migrateDocument(fixture, triples), migrateDocument(fixture, triples));
});

test('PH0C-A: migrateValue converts bare strings to triples', () => {
  assert.deepEqual(migrateValue('OUTSIDE_DATE_ELAPSED', 'prov-1'), {
    canonicalKey: 'OUTSIDE_DATE_ELAPSED',
    extractorRawValue: null,
    sourceProvisionId: 'prov-1',
  });
});
