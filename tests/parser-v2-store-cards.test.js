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

function fakeSupabase(options = {}) {
  const calls = [];
  // `existingRows` seeds the provision_cards table only (legacy shape, kept
  // for every pre-existing test in this file). `claimsExistingRows` is the
  // equivalent seed for the claims table, used by the claims-writer tests;
  // it defaults to empty so the claims stale-cleanup query never finds
  // anything to delete unless a test explicitly opts in -- keeping the
  // pre-existing provision_cards-only assertions (call order, delete
  // counts) unaffected by the new claims writes.
  const existingRows = options.existingRows || [];
  const claimsExistingRows = options.claimsExistingRows || [];
  const rowsByTable = { provision_cards: existingRows, claims: claimsExistingRows };
  return {
    calls,
    from(table) {
      return {
        delete() {
          calls.push({ table, op: 'delete' });
          return {
            eq(column, value) {
              calls.push({ table, op: 'eq', column, value });
              // Awaitable directly (delete-all path: `await ...delete().eq(...)`)
              // and chainable with `.in()` (scoped orphan-delete path).
              return {
                in(column2, values) {
                  calls.push({ table, op: 'in', column: column2, values });
                  return Promise.resolve({ error: null });
                },
                then(resolve) {
                  return Promise.resolve({ error: null }).then(resolve);
                },
              };
            },
          };
        },
        select(columns) {
          calls.push({ table, op: 'select', columns });
          const tableRows = rowsByTable[table] || [];
          return {
            eq(column, value) {
              calls.push({ table, op: 'eq', column, value });
              const filtered = tableRows.filter((row) => row.deal_id === value || !row.deal_id);
              // Awaitable directly (provision_cards orphan-lookup path:
              // `await ...select().eq()`) and chainable with `.in()` (claims
              // stale-lookup path: `...select().eq().in()`).
              return {
                in(column2, values) {
                  calls.push({ table, op: 'in', column: column2, values });
                  const narrowed = filtered.filter((row) => values.includes(row[column2]));
                  return Promise.resolve({ data: narrowed, error: null });
                },
                then(resolve) {
                  return Promise.resolve({ data: filtered, error: null }).then(resolve);
                },
              };
            },
          };
        },
        upsert(rows, options) {
          calls.push({ table, op: 'upsert', rows, options });
          const result = {
            data: rows.map((row, index) => ({
              id: row.id || `card-${index}`,
              provision_instance_id: row.provision_instance_id,
              kind: row.kind,
            })),
            error: null,
          };
          // Awaitable directly (claims path: `await ...upsert(...)`) and
          // chainable with `.select()` (cards path: `...upsert(...).select()`).
          return {
            select() {
              return Promise.resolve(result);
            },
            then(resolve) {
              return Promise.resolve({ error: null }).then(resolve);
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

test('card writer maps STRUCT into the schema-valid structure card family', () => {
  const base = {
    region_id: '00000000-0000-4000-8000-000000000099',
    section_path: 'Section 2.01',
    region_full_text: 'The merger shall be effected.',
    text: 'The merger shall be effected.',
    provenance: {
      source_doc_id: 'doc-1',
      source_doc_page: 1,
      source_doc_offset_start: 0,
      source_doc_offset_end: 30,
      extractor_name: 'parser-v2',
      extractor_version: 'test',
      model: 'test',
      prompt_hash: 'sha256:test',
      run_id: 'run-1',
      extracted_at: '2026-07-08T00:00:00.000Z',
    },
  };
  const rows = buildProvisionCardRows('deal-1', [
    { ...base, type: 'STRUCT', code: 'STRUCT-MERGER', category: 'The Merger' },
    { ...base, type: 'OTHER', code: 'OTHER-CHARTER', category: 'Charter', text: 'The charter shall be amended.' },
  ]);

  assert.deepEqual(rows.map((row) => row.provision_type), ['STRUCTURE_MECHANICS', 'MISC_BOILERPLATE']);
});

test('storeProvisionCards upserts on provision_instance_id before touching existing rows', async () => {
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
  // Upsert must run first (claims FK-cascade safety, see store-cards.js
  // comment above storeProvisionCards): no delete of any kind may precede
  // the upsert.
  assert.equal(sb.calls[0].op, 'upsert');
  assert.ok(!sb.calls.slice(0, sb.calls.findIndex((call) => call.op === 'upsert')).some((call) => call.op === 'delete'));
  const upsert = sb.calls.find((call) => call.op === 'upsert');
  assert.equal(upsert.table, 'provision_cards');
  assert.equal(upsert.options.onConflict, 'provision_instance_id');
  assert.equal(upsert.rows[1].kind, 'cross-reference');
});

test('storeProvisionCards re-ingest: survivors are upserted in place, never deleted (claims FK-cascade safety)', async () => {
  const fixture = JSON.parse(fs.readFileSync('tests/e2e/fixtures/metsera-card-writer.json', 'utf8'));
  const options = {
    sourceDocId: fixture.source_doc_id,
    model: 'claude-sonnet-4',
    promptHash: 'sha256:test',
    runId: 'metsera-card-writer-test',
    extractedAt: '2026-07-08T00:00:00.000Z',
  };
  // Build the "new" rows the same way storeProvisionCards will, so we know
  // the exact provision_instance_id values that must survive re-ingest.
  const newRows = buildProvisionCardRows(fixture.deal_id, fixture, options);
  assert.equal(newRows.length, 2);

  const survivorIds = newRows.map((row) => row.provision_instance_id);
  const orphanId = `${fixture.deal_id}:Section 99.9:dropped-provision`;
  const existingRows = [
    { deal_id: fixture.deal_id, provision_instance_id: survivorIds[0] },
    { deal_id: fixture.deal_id, provision_instance_id: survivorIds[1] },
    { deal_id: fixture.deal_id, provision_instance_id: orphanId },
  ];
  const sb = fakeSupabase({ existingRows });

  const result = await storeProvisionCards(fixture.deal_id, fixture, sb, {
    ...options,
    replaceDeal: true,
  });

  assert.equal(result.insertedCount, 2);

  const upsertIndex = sb.calls.findIndex((call) => call.op === 'upsert');
  const deleteIndex = sb.calls.findIndex((call) => call.op === 'in');
  assert.ok(upsertIndex >= 0, 'upsert must be called');
  assert.ok(deleteIndex >= 0, 'orphan delete must be called');
  assert.ok(upsertIndex < deleteIndex, 'upsert must run before the orphan delete');

  // The upsert carries the survivors with their stable provision_instance_id
  // (same excerpt_id derives from this) -- a FK-cascade on claims would only
  // fire if those rows were deleted, and they never are.
  const upsertCall = sb.calls[upsertIndex];
  assert.deepEqual(
    upsertCall.rows.map((row) => row.provision_instance_id).sort(),
    survivorIds.slice().sort(),
  );

  // The orphan delete targets only the dropped provision, never a survivor.
  const orphanDeleteCall = sb.calls[deleteIndex];
  assert.deepEqual(orphanDeleteCall.values, [orphanId]);
  assert.equal(orphanDeleteCall.column, 'provision_instance_id');

  // Exactly one delete call total -- the scoped orphan cleanup -- never a
  // second, broader delete-all-for-deal call (the old, unsafe path).
  assert.equal(sb.calls.filter((call) => call.op === 'delete').length, 1);
});

test('storeProvisionCards with replaceDeal and zero new rows deletes all existing cards for the deal', async () => {
  const sb = fakeSupabase({ existingRows: [{ deal_id: 'deal-empty', provision_instance_id: 'x' }] });
  const result = await storeProvisionCards('deal-empty', { provisions: [] }, sb, { replaceDeal: true });

  assert.equal(result.insertedCount, 0);
  assert.equal(sb.calls[0].op, 'delete');
  assert.deepEqual(
    sb.calls.filter((call) => call.op === 'eq').map((call) => [call.column, call.value]),
    [['deal_id', 'deal-empty']],
  );
});
