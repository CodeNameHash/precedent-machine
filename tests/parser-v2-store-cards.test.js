const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { buildProvisionCardRows, storeProvisionCards } = require('../lib/parser-v2/store-cards');

function fixtureProvisions() {
  const fixture = JSON.parse(fs.readFileSync('fixtures/schema/provision-card-example.json', 'utf8'));
  return fixture.cards.map((card, index) => ({
    type: card.kind === 'definition' ? 'DEF' : 'COV',
    code: card.kind === 'definition' ? 'DEF-MAE' : 'COV-TEST',
    category: card.defined_term || card.section_path,
    section_path: card.section_path,
    region_id: `00000000-0000-4000-8000-00000000000${index + 1}`,
    region_full_text: card.text,
    text: card.text,
    defined_term: card.defined_term,
    defined_value: card.defined_value,
    provenance: card.provenance,
    features: card.defined_term ? {
      canonicalTerm: card.defined_term,
      definitionText: card.defined_value,
    } : {},
  }));
}

function fakeSupabase() {
  const calls = [];
  return {
    calls,
    from(table) {
      return {
        delete() {
          calls.push({ table, op: 'delete' });
          return {
            eq(column, value) {
              calls.push({ table, op: 'eq', column, value });
              return Promise.resolve({ error: null });
            },
          };
        },
        upsert(rows, options) {
          calls.push({ table, op: 'upsert', rows, options });
          return {
            select() {
              return Promise.resolve({
                data: rows.map((row, index) => ({
                  id: `card-${index}`,
                  provision_instance_id: row.provision_instance_id,
                  kind: row.kind,
                })),
                error: null,
              });
            },
          };
        },
      };
    },
  };
}

test('buildProvisionCardRows matches the canonical provision-card fixture kinds and IDs', () => {
  const expected = JSON.parse(fs.readFileSync('fixtures/schema/provision-card-example.json', 'utf8')).cards;
  const rows = buildProvisionCardRows('885edae5-49e8-464a-9f33-edd229119d7c', fixtureProvisions(), {
    model: 'claude-sonnet-4',
    promptHash: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
    runId: 'run-m2-00-example',
    extractedAt: '2026-07-08T00:00:00.000Z',
  });

  assert.deepEqual(rows.map((row) => row.kind), expected.map((card) => card.kind));
  assert.deepEqual(rows.map((row) => row.provision_instance_id), expected.map((card) => card.provision_instance_id));
  assert.deepEqual(rows.map((row) => row.excerpt_id), expected.map((card) => card.excerpt_id));
  assert.deepEqual(rows[2].references, [rows[1].provision_instance_id]);
});

test('Metsera-shaped fixture emits definition and cross-reference cards', () => {
  const fixture = JSON.parse(fs.readFileSync('tests/e2e/fixtures/metsera-card-writer.json', 'utf8'));
  const rows = buildProvisionCardRows(fixture.deal_id, fixture.provisions, {
    sourceDocId: fixture.source_doc_id,
    model: 'claude-sonnet-4',
    promptHash: 'sha256:test',
    runId: 'metsera-card-writer-test',
    extractedAt: '2026-07-08T00:00:00.000Z',
  });

  assert.equal(rows.length, 2);
  assert.equal(rows[0].kind, 'definition');
  assert.equal(rows[0].defined_term, 'Company Material Adverse Effect');
  assert.equal(rows[1].kind, 'cross-reference');
  assert.deepEqual(rows[1].references, [rows[0].provision_instance_id]);
  assert.equal(rows[1].provision_type, 'COVENANT_INTERIM_OPERATING');
});

test('storeProvisionCards replaces deal rows and upserts on provision_instance_id', async () => {
  const fixture = JSON.parse(fs.readFileSync('tests/e2e/fixtures/metsera-card-writer.json', 'utf8'));
  const sb = fakeSupabase();
  const result = await storeProvisionCards(fixture.deal_id, fixture, sb, {
    sourceDocId: fixture.source_doc_id,
    model: 'claude-sonnet-4',
    promptHash: 'sha256:test',
    runId: 'metsera-card-writer-test',
    extractedAt: '2026-07-08T00:00:00.000Z',
    replaceDeal: true,
  });

  assert.equal(result.insertedCount, 2);
  assert.equal(sb.calls[0].op, 'delete');
  const upsert = sb.calls.find((call) => call.op === 'upsert');
  assert.equal(upsert.table, 'provision_cards');
  assert.equal(upsert.options.onConflict, 'provision_instance_id');
  assert.equal(upsert.rows[1].kind, 'cross-reference');
});
