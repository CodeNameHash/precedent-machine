'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..');
const FAMILIES = [
  'employee-matters-live-run',
  'dno-live-run',
  'financing-covenants-live-run',
  'guaranty-live-run',
];

for (const family of FAMILIES) {
  test(`${family} retains literal production card text and provenance`, () => {
    const fixturePath = path.join(
      ROOT, 'tests', 'fixtures', 'canonical-v2', family, 'corpus-cards.json',
    );
    const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    assert.equal(fixture.schema, 'CANONICAL_V2_FAMILY_CORPUS_FIXTURES/V1');
    assert.equal(fixture.family, family);
    assert.match(fixture.retrieval_date, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(fixture.source_table, 'provision_cards');
    assert.ok(fixture.cards.length >= 14);
    assert.equal(new Set(fixture.cards.map((card) => card.id)).size, fixture.cards.length);
    for (const card of fixture.cards) {
      assert.match(card.id, /^[0-9a-f-]{36}$/);
      assert.match(card.deal_id, /^[0-9a-f-]{36}$/);
      assert.equal(typeof card.provision_type, 'string');
      assert.ok(Buffer.byteLength(card.region_full_text, 'utf8') > 0);
    }
  });
}
