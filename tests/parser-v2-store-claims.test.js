const test = require('node:test');
const assert = require('node:assert/strict');

const { buildProvisionCardRows, storeProvisionCards } = require('../lib/parser-v2/store-cards');
const {
  atomicValues,
  buildClaimRowsForCard,
  buildClaimRowsForDeal,
  storeClaimsForDeal,
} = require('../lib/parser-v2/store-claims');
const { FEATURES } = require('../lib/schema/features');

const DEAL_ID = '885edae5-49e8-464a-9f33-edd229119d7c';

function richProvision(overrides = {}) {
  return {
    type: 'TERMR',
    code: 'TERMR-OUTSIDE',
    category: 'Outside Date Termination',
    section_path: 'Section 8.01(b)',
    region_id: '00000000-0000-4000-8000-000000000010',
    region_full_text: 'Either party may terminate if the Merger has not been consummated by the Outside Date.',
    text: 'Either party may terminate if the Merger has not been consummated by the Outside Date.',
    features: {
      // citable-wrapped scalar: { value, quotes } -- FEATURES.outsideDateMonths
      // has no enumSet, so canonical must stay null (never fabricated).
      outsideDateMonths: {
        value: '24',
        quotes: ['the Outside Date shall be twenty-four (24) months from the date hereof'],
      },
      // bare tagged scalar (valueType enum) -- code becomes canonical,
      // text becomes verbatim, per lib/queries/claims-adapter.js's read-side
      // contract (buildTaggedValue puts claim.verbatim into `text`,
      // claim.canonical into `code`).
      effortsStandard: {
        code: 'reasonable-best-efforts',
        label: 'Reasonable best efforts',
        text: 'reasonable best efforts',
      },
      // list of tagged values -- must expand to one claim per item.
      carveouts: [
        {
          code: 'PANDEMIC',
          label: 'Pandemic',
          text: 'pandemic or other public health crisis',
          quotes: ['except for any pandemic or other public health crisis affecting the industry generally'],
        },
        {
          code: 'ECONOMY_GENERAL',
          label: 'Economy (general)',
          text: 'general changes in the economy',
          // no quotes on this one -- evidence_quote must be null, never fabricated.
        },
      ],
      // plain string scalar, not in the registry enumSet (mainConcept has
      // none) -- canonical stays null.
      mainConcept: 'Material Adverse Effect',
      // plain boolean scalar.
      preventDelayProng: true,
      // NOT a registered feature key -- must be routed to unknownAttributes,
      // never coerced into a claim.
      notARealFeatureKey: 'ignore me',
    },
    ...overrides,
  };
}

test('atomicValues: citable-wrapped scalar carries its quote and leaves canonical null when the registry has no enumSet', () => {
  const atoms = atomicValues({ value: '24', quotes: ['the Outside Date shall be 24 months'] }, FEATURES.outsideDateMonths);
  assert.equal(atoms.length, 1);
  assert.equal(atoms[0].verbatim, '24');
  assert.equal(atoms[0].canonical, null);
  assert.equal(atoms[0].evidenceQuote, 'the Outside Date shall be 24 months');
});

test('atomicValues: bare tagged object puts text in verbatim and code in canonical (matches claims-adapter read side)', () => {
  const atoms = atomicValues(
    { code: 'reasonable-best-efforts', label: 'Reasonable best efforts', text: 'reasonable best efforts' },
    FEATURES.effortsStandard,
  );
  assert.equal(atoms.length, 1);
  assert.equal(atoms[0].verbatim, 'reasonable best efforts');
  assert.equal(atoms[0].canonical, 'reasonable-best-efforts');
});

test('atomicValues: a list of tagged objects expands to one atom per item, each with its own quote (or null, never fabricated)', () => {
  const atoms = atomicValues(
    [
      { code: 'PANDEMIC', text: 'pandemic or other public health crisis', quotes: ['except for any pandemic ... generally'] },
      { code: 'ECONOMY_GENERAL', text: 'general changes in the economy' },
    ],
    FEATURES.carveouts,
  );
  assert.equal(atoms.length, 2);
  assert.equal(atoms[0].canonical, 'PANDEMIC');
  assert.equal(atoms[0].evidenceQuote, 'except for any pandemic ... generally');
  assert.equal(atoms[1].canonical, 'ECONOMY_GENERAL');
  assert.equal(atoms[1].evidenceQuote, null);
});

test('atomicValues: plain scalar with no registry enumSet never fabricates a canonical', () => {
  const atoms = atomicValues('Material Adverse Effect', FEATURES.mainConcept);
  assert.equal(atoms.length, 1);
  assert.equal(atoms[0].verbatim, 'Material Adverse Effect');
  assert.equal(atoms[0].canonical, null);
});

test('atomicValues: boolean scalar stringifies to verbatim', () => {
  const atoms = atomicValues(true, FEATURES.preventDelayProng);
  assert.equal(atoms.length, 1);
  assert.equal(atoms[0].verbatim, 'true');
});

test('atomicValues: null/undefined/empty produce no claim', () => {
  assert.deepEqual(atomicValues(null, FEATURES.mainConcept), []);
  assert.deepEqual(atomicValues(undefined, FEATURES.mainConcept), []);
  assert.deepEqual(atomicValues('', FEATURES.mainConcept), []);
});

test('buildClaimRowsForCard: anchors every claim to the card excerpt_id/provision_instance_id/region_id, one claim per scalar and one per list item', () => {
  const prov = richProvision();
  const [cardRow] = buildProvisionCardRows(DEAL_ID, [prov], {
    model: 'test',
    promptHash: 'sha256:test',
    runId: 'test-run',
    extractedAt: '2026-07-08T00:00:00.000Z',
  });

  const { rows, unknownAttributes } = buildClaimRowsForCard(DEAL_ID, cardRow, prov, {
    model: 'test',
    extractedAt: '2026-07-08T00:00:00.000Z',
  });

  // outsideDateMonths(1) + effortsStandard(1) + carveouts(2) + mainConcept(1)
  // + preventDelayProng(1) = 6. notARealFeatureKey must NOT appear.
  assert.equal(rows.length, 6);
  assert.deepEqual(unknownAttributes, ['notARealFeatureKey']);

  for (const row of rows) {
    assert.equal(row.deal_id, DEAL_ID);
    assert.equal(row.excerpt_id, cardRow.excerpt_id);
    assert.equal(row.provision_instance_id, cardRow.provision_instance_id);
    assert.equal(row.region_id, cardRow.region_id);
    assert.ok(row.id, 'claim id must be present');
  }

  const carveoutRows = rows.filter((row) => row.attribute === 'carveouts');
  assert.equal(carveoutRows.length, 2);
  assert.deepEqual(carveoutRows.map((row) => row.canonical).sort(), ['ECONOMY_GENERAL', 'PANDEMIC']);
  assert.deepEqual(carveoutRows.map((row) => row.verbatim).sort(), [
    'general changes in the economy',
    'pandemic or other public health crisis',
  ]);
  // Distinct ids -- the two list items must not collide.
  assert.notEqual(carveoutRows[0].id, carveoutRows[1].id);

  const outsideDate = rows.find((row) => row.attribute === 'outsideDateMonths');
  assert.equal(outsideDate.verbatim, '24');
  assert.equal(outsideDate.canonical, null);
  assert.equal(outsideDate.evidence_quote, 'the Outside Date shall be twenty-four (24) months from the date hereof');
  assert.equal(outsideDate.provenance.feature_key, 'outsideDateMonths');
  assert.equal(outsideDate.provenance.anchor_method, 'native_excerpt_id');

  const efforts = rows.find((row) => row.attribute === 'effortsStandard');
  assert.equal(efforts.verbatim, 'reasonable best efforts');
  assert.equal(efforts.canonical, 'reasonable-best-efforts');
});

test('buildClaimRowsForCard: idempotent -- rebuilding from the same source provision produces identical rows', () => {
  const prov = richProvision();
  const [cardRow] = buildProvisionCardRows(DEAL_ID, [prov], { extractedAt: '2026-07-08T00:00:00.000Z' });
  const first = buildClaimRowsForCard(DEAL_ID, cardRow, prov, { extractedAt: '2026-07-08T00:00:00.000Z' });
  const second = buildClaimRowsForCard(DEAL_ID, cardRow, prov, { extractedAt: '2026-07-08T00:00:00.000Z' });
  assert.deepEqual(
    first.rows.map((row) => row.id).sort(),
    second.rows.map((row) => row.id).sort(),
  );
  assert.equal(first.rows.length, second.rows.length);
});

test('buildClaimRowsForDeal: aggregates claims across every card, index-aligned with the source provisions', () => {
  const provA = richProvision();
  const provB = {
    type: 'DEF',
    code: 'DEF-MAE',
    category: 'Company Material Adverse Effect',
    section_path: 'Article I',
    region_id: '00000000-0000-4000-8000-000000000011',
    region_full_text: '"Company Material Adverse Effect" means any effect materially adverse to the Company.',
    text: '"Company Material Adverse Effect" means any effect materially adverse to the Company.',
    features: {
      canonicalTerm: 'Company Material Adverse Effect',
      definitionText: 'any effect materially adverse to the Company',
    },
  };
  const provisions = [provA, provB];
  const cardRows = buildProvisionCardRows(DEAL_ID, provisions, { extractedAt: '2026-07-08T00:00:00.000Z' });

  const { rows, unknownAttributeCounts } = buildClaimRowsForDeal(DEAL_ID, cardRows, provisions, { extractedAt: '2026-07-08T00:00:00.000Z' });

  assert.equal(unknownAttributeCounts.get('notARealFeatureKey'), 1);
  const defCardClaims = rows.filter((row) => row.excerpt_id === cardRows[1].excerpt_id);
  assert.equal(defCardClaims.length, 2);
  assert.ok(defCardClaims.every((row) => row.provision_instance_id === cardRows[1].provision_instance_id));

  const termrCardClaims = rows.filter((row) => row.excerpt_id === cardRows[0].excerpt_id);
  assert.equal(termrCardClaims.length, 6);
});

// ---------------------------------------------------------------------------
// storeClaimsForDeal / storeProvisionCards wiring, against a minimal fake
// supabase client that mirrors tests/parser-v2-store-cards.test.js's
// fakeSupabase but keeps claims and provision_cards rows in separate,
// mutable, in-memory tables so upsert/delete semantics can be exercised
// across two consecutive "ingest" calls (the re-ingest-safety scenario).
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
                  // Simulate claims.excerpt_id -> provision_cards.excerpt_id
                  // ON DELETE CASCADE (supabase/schema-05-claims.sql) so
                  // tests can assert the orphan-card path really does take
                  // its claims with it.
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

test('storeProvisionCards writes claims atomically with cards on a fresh ingest', async () => {
  const sb = inMemorySupabase();
  const provisions = [richProvision()];
  const result = await storeProvisionCards(DEAL_ID, provisions, sb, {
    extractedAt: '2026-07-08T00:00:00.000Z',
    replaceDeal: true,
  });

  assert.equal(result.insertedCount, 1);
  assert.equal(result.claims.insertedCount, 6);
  assert.equal(sb.tables.claims.length, 6);
  assert.ok(sb.tables.claims.every((row) => row.excerpt_id === result.rows[0].excerpt_id));
});

test('storeProvisionCards re-ingest is idempotent: same input twice converges to the same claim rows, no duplicates', async () => {
  const sb = inMemorySupabase();
  const provisions = [richProvision()];
  const options = { extractedAt: '2026-07-08T00:00:00.000Z', replaceDeal: true };

  await storeProvisionCards(DEAL_ID, provisions, sb, options);
  const afterFirst = sb.tables.claims.length;
  await storeProvisionCards(DEAL_ID, provisions, sb, options);
  const afterSecond = sb.tables.claims.length;

  assert.equal(afterFirst, 6);
  assert.equal(afterSecond, 6, 'no duplicate claims after re-ingesting identical input');
});

test('storeProvisionCards re-ingest deletes stale claims for a surviving card whose feature bag shrank', async () => {
  const sb = inMemorySupabase();
  const options = { extractedAt: '2026-07-08T00:00:00.000Z', replaceDeal: true };

  // First ingest: full feature bag (6 claims, as established above).
  await storeProvisionCards(DEAL_ID, [richProvision()], sb, options);
  assert.equal(sb.tables.claims.length, 6);

  // Second ingest: SAME provision (same excerpt_id -- card survives), but
  // re-extraction now only found one carve-out instead of two, and dropped
  // mainConcept entirely. Total should shrink to 5 claims, and the dropped
  // carve-out / mainConcept claim ids must not linger.
  const shrunk = richProvision({
    features: {
      outsideDateMonths: { value: '24', quotes: ['the Outside Date shall be twenty-four (24) months from the date hereof'] },
      effortsStandard: { code: 'reasonable-best-efforts', label: 'Reasonable best efforts', text: 'reasonable best efforts' },
      carveouts: [
        { code: 'PANDEMIC', text: 'pandemic or other public health crisis', quotes: ['except for any pandemic ... generally'] },
      ],
      preventDelayProng: true,
    },
  });
  const result = await storeProvisionCards(DEAL_ID, [shrunk], sb, options);

  assert.equal(result.claims.staleDeleted, 2, 'the dropped carve-out and mainConcept claims must be cleaned up');
  assert.equal(sb.tables.claims.length, 4);
  assert.ok(!sb.tables.claims.some((row) => row.attribute === 'mainConcept'));
  const carveoutRows = sb.tables.claims.filter((row) => row.attribute === 'carveouts');
  assert.equal(carveoutRows.length, 1);
  assert.equal(carveoutRows[0].canonical, 'PANDEMIC');
});

test('storeProvisionCards re-ingest cascades claims for a card that is genuinely dropped (orphaned provision)', async () => {
  const sb = inMemorySupabase();
  const options = { extractedAt: '2026-07-08T00:00:00.000Z', replaceDeal: true };
  const defProvision = {
    type: 'DEF',
    code: 'DEF-MAE',
    category: 'Company Material Adverse Effect',
    section_path: 'Article I',
    region_id: '00000000-0000-4000-8000-000000000011',
    region_full_text: '"Company Material Adverse Effect" means any effect materially adverse to the Company.',
    text: '"Company Material Adverse Effect" means any effect materially adverse to the Company.',
    features: { canonicalTerm: 'Company Material Adverse Effect', definitionText: 'any effect materially adverse to the Company' },
  };

  await storeProvisionCards(DEAL_ID, [richProvision(), defProvision], sb, options);
  assert.equal(sb.tables.claims.length, 8); // 6 from the TERMR provision + 2 from the DEF.
  assert.equal(sb.tables.provision_cards.length, 2);

  // Re-ingest with ONLY the DEF provision -- the TERMR provision (and its
  // card) is genuinely gone. This module never explicitly deletes claims by
  // excerpt_id for orphaned cards -- it relies on the
  // claims.excerpt_id -> provision_cards.excerpt_id ON DELETE CASCADE FK
  // (supabase/schema-05-claims.sql), which this in-memory fake simulates.
  await storeProvisionCards(DEAL_ID, [defProvision], sb, options);
  assert.equal(sb.tables.provision_cards.length, 1);
  assert.equal(sb.tables.claims.length, 2, 'the orphaned TERMR card\'s 6 claims must cascade away, leaving only the DEF card\'s 2');
  assert.ok(sb.tables.claims.every((row) => row.attribute === 'canonicalTerm' || row.attribute === 'definitionText'));
});
