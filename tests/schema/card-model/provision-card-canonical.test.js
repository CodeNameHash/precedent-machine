const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  PROVISION_KINDS,
  REQUIRED_PROVENANCE_FIELDS,
  excerptId,
  provisionInstanceId,
  validateProvisionCardShape,
} = require('../../../lib/schema/provision-card');

const migrationPath = path.join(__dirname, '..', '..', '..', 'supabase', 'schema-04-provision-card-canonical.sql');
const fixturePath = path.join(__dirname, '..', '..', '..', 'fixtures', 'schema', 'provision-card-example.json');

test('schema-04 migration adds canonical provision-card columns and indexes', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');
  assert.match(sql, /CREATE TYPE public\.provision_card_kind AS ENUM \('standard', 'definition', 'cross-reference'\)/);
  for (const column of [
    'provision_instance_id text',
    'excerpt_id text',
    'kind public.provision_card_kind',
    'defined_term text',
    'defined_value text',
    '"references" jsonb',
    'provenance jsonb',
  ]) {
    assert.match(sql, new RegExp(column.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(sql, /provision_cards_provision_instance_unique/);
  assert.match(sql, /provision_cards_excerpt_unique/);
  assert.match(sql, /provision_cards_provision_instance_idx/);
  assert.match(sql, /provision_cards_kind_idx/);
  for (const field of REQUIRED_PROVENANCE_FIELDS) {
    assert.match(sql, new RegExp(`'${field}'`));
  }
});

test('provision-card helper defines canonical kind enum', () => {
  assert.deepEqual(PROVISION_KINDS, ['standard', 'definition', 'cross-reference']);
});

test('golden provision-card fixture validates all canonical kinds', () => {
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  assert.equal(fixture.schema_version, 1);
  assert.deepEqual(fixture.cards.map((card) => card.kind), PROVISION_KINDS);

  const definitionIds = new Set(fixture.cards.filter((card) => card.kind === 'definition').map((card) => card.provision_instance_id));
  for (const card of fixture.cards) {
    assert.equal(
      card.provision_instance_id,
      provisionInstanceId({ dealId: card.deal_id, sectionPath: card.section_path, text: card.text }),
    );
    assert.equal(card.excerpt_id, excerptId(card.provision_instance_id, 0));
    assert.equal(validateProvisionCardShape(card), card);
    for (const ref of card.references) {
      assert.ok(definitionIds.has(ref), `reference resolves to a definition card: ${ref}`);
    }
  }
});
