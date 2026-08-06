/* One logical claim, one identity — whichever writer produced it.
 *
 * public.claims.id is the upsert conflict target for BOTH claim writers:
 *   - lib/parser-v2/store-claims.js (ingest / reprocess / rematerialize),
 *     which mints claimId(excerpt_id, attribute, index);
 *   - scripts/backfill/claims-from-normalized.js, which used to key on the
 *     normaliser's own opaque triple id.
 * Two id spaces over one conflict target means the same logical claim
 * written by both paths does not conflict — it lands as two rows. These
 * tests pin the shared identity and the duplicate that used to follow from
 * not having one.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { buildProvisionCardRows, storeProvisionCards } = require('../lib/parser-v2/store-cards');
const { buildClaimRowsForCard, claimId } = require('../lib/parser-v2/store-claims');
const {
  assignIngestIdentities,
  ingestClaimIdsForGroup,
  claimRowFromTriple,
} = require('../scripts/backfill/claims-from-normalized');

const DEAL_ID = '885edae5-49e8-464a-9f33-edd229119d7c';
const EXTRACTED_AT = '2026-07-08T00:00:00.000Z';

// A provision shaped like the ones the ingest writer sees, carrying one
// single-valued feature and one LIST feature (the case where `index` is
// actually load-bearing).
function provision(overrides = {}) {
  return {
    type: 'TERMR',
    code: 'TERMR-OUTSIDE',
    category: 'Outside Date Termination',
    section_path: 'Section 8.01(b)',
    region_id: '00000000-0000-4000-8000-000000000010',
    region_full_text: 'Either party may terminate if the Merger has not been consummated by the Outside Date.',
    text: 'Either party may terminate if the Merger has not been consummated by the Outside Date.',
    features: {
      outsideDateMonths: {
        value: '24',
        quotes: ['the Outside Date shall be twenty-four (24) months from the date hereof'],
      },
      carveouts: [
        {
          code: 'PANDEMIC',
          label: 'Pandemic',
          text: 'pandemic or other public health crisis',
        },
        {
          code: 'ECONOMY_GENERAL',
          label: 'Economy (general)',
          text: 'general changes in the economy',
        },
      ],
    },
    ...overrides,
  };
}

function cardFor(prov) {
  const [cardRow] = buildProvisionCardRows(DEAL_ID, [prov], { extractedAt: EXTRACTED_AT });
  return cardRow;
}

// The snapshot rows scripts/backfill/claims-from-normalized.js reads
// (docs/schema-shape/normalized-v1.json `triples`): one triple per ATOM, each
// carrying the whole pre-expansion feature value in ai_metadata.feature_value,
// and an opaque 16-hex `id` minted by the normaliser.
function triple(fieldKey, rawValue, featureValue, id) {
  return {
    id,
    deal_id: DEAL_ID,
    field_key: fieldKey,
    canonicalKey: null,
    raw_value: rawValue,
    source_provision_id: 'aaaaaaaa-0000-4000-8000-000000000001',
    evidence_quote: 'the Outside Date shall be twenty-four (24) months from the date hereof',
    extractor_id: 'codex',
    extracted_at: EXTRACTED_AT,
    ai_metadata: { code: 'TERMR-OUTSIDE', feature_key: fieldKey, feature_value: featureValue },
  };
}

function triplesFor(prov) {
  const { outsideDateMonths, carveouts } = prov.features;
  return [
    triple('outsideDateMonths', '24', outsideDateMonths, '7c1bd19ebca11efb'),
    triple('carveouts', 'PANDEMIC', carveouts, '36ebeaf3aab974a8'),
    triple('carveouts', 'ECONOMY_GENERAL', carveouts, '512d92f858e5a0f9'),
  ];
}

function backfillRecords(prov, card) {
  return triplesFor(prov).map((t) => ({ row: claimRowFromTriple(t, card), triple: t }));
}

// ---------------------------------------------------------------------------
// 1. The two writers agree on identity.
// ---------------------------------------------------------------------------

test('the same logical claim gets the same id from the ingest writer and from the backfill', () => {
  const prov = provision();
  const card = cardFor(prov);

  const ingestRows = buildClaimRowsForCard(DEAL_ID, card, prov, { extractedAt: EXTRACTED_AT }).rows;
  const { identified: backfillRows, unidentified } = assignIngestIdentities(backfillRecords(prov, card));

  assert.deepEqual(unidentified, [], 'every triple in this fixture has a provable ingest identity');
  assert.equal(backfillRows.length, ingestRows.length);
  assert.deepEqual(
    backfillRows.map((r) => r.id).sort(),
    ingestRows.map((r) => r.id).sort(),
    'backfill and ingest must land on the same ids, not two id spaces',
  );
});

test('the backfill no longer writes the normaliser triple id', () => {
  const prov = provision();
  const card = cardFor(prov);
  const legacyIds = new Set(triplesFor(prov).map((t) => t.id));

  const { identified } = assignIngestIdentities(backfillRecords(prov, card));

  assert.ok(identified.length > 0);
  assert.ok(
    identified.every((row) => !legacyIds.has(row.id)),
    'a triple id must never reach claims.id again — that is the second id space',
  );
});

test('a list feature keeps its per-item ordinal, so item 0 and item 1 stay distinct claims', () => {
  const prov = provision();
  const card = cardFor(prov);

  const ids = ingestClaimIdsForGroup(card.excerpt_id, 'carveouts', triplesFor(prov).slice(1));

  assert.deepEqual(ids, [
    claimId(card.excerpt_id, 'carveouts', 0),
    claimId(card.excerpt_id, 'carveouts', 1),
  ]);
  assert.notEqual(ids[0], ids[1]);
});

// ---------------------------------------------------------------------------
// 2. Fail closed. An identity that cannot be PROVEN is reported, not guessed:
//    a wrong ordinal would silently overwrite a different ingest-written
//    claim, which is worse than the split id spaces this replaces.
// ---------------------------------------------------------------------------

test('an attribute the ingest writer would never materialise has no shared identity', () => {
  const prov = provision();
  const card = cardFor(prov);
  const orphanTriple = triple('notARealFeatureKey', 'x', 'x', 'deadbeefdeadbeef');

  assert.equal(ingestClaimIdsForGroup(card.excerpt_id, 'notARealFeatureKey', [orphanTriple]), null);

  const { identified, unidentified } = assignIngestIdentities([
    { row: claimRowFromTriple(orphanTriple, card), triple: orphanTriple },
  ]);
  assert.deepEqual(identified, []);
  assert.equal(unidentified.length, 1);
});

test('a group the atom expansion does not account for is unidentified, never given a guessed ordinal', () => {
  const prov = provision();
  const card = cardFor(prov);
  const [, pandemic, economy] = triplesFor(prov);
  // Three triples against a two-item list: the snapshot and the expansion
  // disagree, so the ordinals are not recoverable.
  const extra = triple('carveouts', 'WAR', prov.features.carveouts, '99999999aaaaaaaa');

  assert.equal(
    ingestClaimIdsForGroup(card.excerpt_id, 'carveouts', [pandemic, economy, extra]),
    null,
  );
});

test('a group whose triples disagree about the feature value is unidentified (more than one extraction)', () => {
  const prov = provision();
  const card = cardFor(prov);
  const [, pandemic] = triplesFor(prov);
  const fromAnotherExtraction = triple('carveouts', 'ECONOMY_GENERAL', [prov.features.carveouts[1]], 'bbbbbbbbcccccccc');

  assert.equal(
    ingestClaimIdsForGroup(card.excerpt_id, 'carveouts', [pandemic, fromAnotherExtraction]),
    null,
  );
});

// ---------------------------------------------------------------------------
// 3. The duplicate that exists today, and its closure.
//
// Scenario: a deal was backfilled (2026-07-08 `--apply`), then written again
// by the ingest writer. storeProvisionCards runs the claims writer
// unconditionally but only cleans up stale claims under `replaceDeal`, so the
// incremental per-type reprocess path is where a second row survives.
// ---------------------------------------------------------------------------

function inMemorySupabase() {
  const tables = { provision_cards: [], claims: [] };
  function upsert(table, rows, onConflict) {
    for (const row of rows) {
      const idx = tables[table].findIndex((existing) => existing[onConflict] === row[onConflict]);
      if (idx >= 0) tables[table][idx] = { ...tables[table][idx], ...row };
      else tables[table].push({ ...row });
    }
    return { data: rows, error: null };
  }
  return {
    tables,
    from(table) {
      return {
        delete() {
          return {
            eq(column, value) {
              return {
                in(column2, values) {
                  const valueSet = new Set(values);
                  const toDelete = tables[table].filter((row) => row[column] === value && valueSet.has(row[column2]));
                  tables[table] = tables[table].filter((row) => !(row[column] === value && valueSet.has(row[column2])));
                  if (table === 'provision_cards' && toDelete.length > 0) {
                    const deletedExcerptIds = new Set(toDelete.map((row) => row.excerpt_id));
                    tables.claims = tables.claims.filter((row) => !deletedExcerptIds.has(row.excerpt_id));
                  }
                  return Promise.resolve({ error: null });
                },
                then(resolve) {
                  const toDelete = tables[table].filter((row) => row[column] === value);
                  tables[table] = tables[table].filter((row) => row[column] !== value);
                  if (table === 'provision_cards' && toDelete.length > 0) {
                    const deletedExcerptIds = new Set(toDelete.map((row) => row.excerpt_id));
                    tables.claims = tables.claims.filter((row) => !deletedExcerptIds.has(row.excerpt_id));
                  }
                  return Promise.resolve({ error: null }).then(resolve);
                },
              };
            },
          };
        },
        select() {
          return {
            eq(column, value) {
              const filtered = tables[table].filter((row) => row[column] === value);
              return {
                in(column2, values) {
                  const valueSet = new Set(values);
                  return Promise.resolve({ data: filtered.filter((row) => valueSet.has(row[column2])), error: null });
                },
                then(resolve) {
                  return Promise.resolve({ data: filtered, error: null }).then(resolve);
                },
              };
            },
          };
        },
        upsert(rows, options) {
          const result = upsert(table, rows, options.onConflict);
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

test('re-materialising a previously-backfilled deal updates in place instead of duplicating', async () => {
  const sb = inMemorySupabase();
  const prov = provision();
  const card = cardFor(prov);

  // The backfill ran first and wrote this deal's claims.
  const { identified: backfilled } = assignIngestIdentities(backfillRecords(prov, card));
  await sb.from('claims').upsert(backfilled, { onConflict: 'id' });
  assert.equal(sb.tables.claims.length, 3);

  // Now the ingest writer runs over the same deal on the incremental path
  // (no replaceDeal — so no stale-claim cleanup can paper over a duplicate).
  await storeProvisionCards(DEAL_ID, [prov], sb, { extractedAt: EXTRACTED_AT });

  assert.equal(sb.tables.claims.length, 3, 'one row per logical claim, not two');
  const ids = new Set(sb.tables.claims.map((row) => row.id));
  assert.equal(ids.size, 3);
  assert.ok(
    sb.tables.claims.every((row) => row.excerpt_id === card.excerpt_id),
    'still anchored to the same card',
  );
});

test('regression pin: the OLD triple-id scheme really did double the rows on that same path', async () => {
  const sb = inMemorySupabase();
  const prov = provision();
  const card = cardFor(prov);

  // Exactly what the backfill used to write: identical payload, keyed on the
  // normaliser's triple id.
  const legacyRows = backfillRecords(prov, card).map(({ row, triple: t }) => ({ ...row, id: t.id }));
  await sb.from('claims').upsert(legacyRows, { onConflict: 'id' });
  assert.equal(sb.tables.claims.length, 3);

  await storeProvisionCards(DEAL_ID, [prov], sb, { extractedAt: EXTRACTED_AT });

  assert.equal(
    sb.tables.claims.length,
    6,
    'the bug: three legacy rows plus three freshly-minted ones for the same three claims',
  );
});

test('the backfill is idempotent against itself under the shared identity', () => {
  const prov = provision();
  const card = cardFor(prov);

  const first = assignIngestIdentities(backfillRecords(prov, card)).identified.map((r) => r.id);
  const second = assignIngestIdentities(backfillRecords(prov, card)).identified.map((r) => r.id);

  assert.deepEqual(first, second);
});
