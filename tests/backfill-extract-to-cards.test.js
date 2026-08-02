const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildExtractorOutput,
  dedupeProvisionCardRows,
  findRegionForProvision,
  legacyProvisionForCard,
  markdownReport,
  parseArgs,
  replaceProvisionCardRows,
  sectionPathForRow,
} = require('../scripts/backfill/extract-to-cards');

test('parseArgs supports all, apply, env file, output and min-card gate', () => {
  const args = parseArgs([
    'node',
    'scripts/backfill/extract-to-cards.js',
    '--all',
    '--apply',
    '--env-file',
    '/tmp/env',
    '--out',
    '/tmp/report.md',
    '--min-cards',
    '50',
  ]);
  assert.equal(args.all, true);
  assert.equal(args.apply, true);
  assert.equal(args.envFile, '/tmp/env');
  assert.equal(args.out, '/tmp/report.md');
  assert.equal(args.minCards, 50);
});

test('parseArgs defaults extractionVersion to the m2-00 label, unchanged for ordinary runs', () => {
  const args = parseArgs(['node', 'scripts/backfill/extract-to-cards.js', '--all']);
  assert.equal(args.extractionVersion, 'm2-00-corpus-backfill-v1');
});

// v1 reclassification (2026-08-02, audit A-M4): the reclassification apply
// pass (documented, NOT executed by this code-only slice) bumps this label
// so the comparator's isComparisonReceiptStale fires on pre-reclass
// receipts. See docs/superpowers/specs/2026-08-02-v1-reclassification-design.md §4.
test('parseArgs accepts --extraction-version to override the label for the reclass apply pass', () => {
  const args = parseArgs(['node', 'scripts/backfill/extract-to-cards.js', '--all', '--extraction-version', 'm2-01-reclass-v1']);
  assert.equal(args.extractionVersion, 'm2-01-reclass-v1');
});

test('legacyProvisionForCard stamps the passed-in extractionVersion, defaulting when omitted', () => {
  const row = { id: 'r1', type: 'REP-T', category: 'x', full_text: 'text', ai_metadata: {} };
  const deal = { id: 'd1' };
  const region = { id: 'reg1', text_hash: 'h1' };
  const withDefault = legacyProvisionForCard(row, deal, region);
  assert.equal(withDefault.extraction_version, 'm2-00-corpus-backfill-v1');
  const withOverride = legacyProvisionForCard(row, deal, region, 'm2-01-reclass-v1');
  assert.equal(withOverride.extraction_version, 'm2-01-reclass-v1');
});

test('findRegionForProvision maps legacy provision text to parser region rows', () => {
  const region = {
    id: 'region-1',
    raw_text: 'Section 5.01. Interim Operations. The Company shall operate in the ordinary course until closing.',
  };
  const found = findRegionForProvision({
    full_text: 'The Company shall operate in the ordinary course until closing.',
  }, [{ row: region, normalized: 'section 5.01 interim operations the company shall operate in the ordinary course until closing', compact: 'section 5.01. interim operations. the company shall operate in the ordinary course until closing.' }]);
  assert.equal(found.id, 'region-1');
});

test('buildExtractorOutput skips unmatched rows and emits card-ready legacy provisions', () => {
  const deal = { id: 'deal-1', acquirer: 'Buyer', target: 'Target' };
  const output = buildExtractorOutput(deal, [
    {
      id: 'p1',
      type: 'IOC',
      category: 'Ordinary Course',
      full_text: 'The Company shall operate in the ordinary course until closing.',
      ai_metadata: { code: 'IOC-ORDINARY', features: { sectionNumber: '5.01' } },
    },
    { id: 'p2', type: 'COV', category: 'Missing', full_text: 'Not in the region.' },
  ], [
    {
      id: 'region-1',
      section_ref: '5.01',
      title: 'Interim Operations',
      raw_text: 'Section 5.01. Interim Operations. The Company shall operate in the ordinary course until closing.',
      text_hash: 'hash-1',
    },
  ]);
  assert.equal(output.provisions.length, 1);
  assert.equal(output.skipped.length, 1);
  assert.equal(output.provisions[0].region_id, 'region-1');
  assert.equal(output.provisions[0].code, 'IOC-ORDINARY');
});

test('sectionPathForRow includes a stable span hash to avoid section/type collisions', () => {
  const path = sectionPathForRow({
    type: 'REP-T',
    category: 'Capitalization',
    full_text: 'Capitalization rep text.',
    ai_metadata: { features: { sectionNumber: '4.02' } },
  }, null);
  assert.match(path, /^4\.02 \| Capitalization \| [a-f0-9]{12}$/);
});

test('markdownReport records pass/fail status and per-deal counts', () => {
  const report = markdownReport([
    {
      deal: 'Buyer / Target',
      provisions: 45,
      matched_provisions: 44,
      skipped_provisions: 1,
      parser_regions: 12,
      before_cards: 0,
      cards: 44,
      duplicate_cards_removed: 2,
      ms: 15,
      ok: true,
      skipped_sample: [{ id: 'p2', reason: 'missing full_text' }],
    },
  ], { apply: false, generatedAt: '2026-07-08T00:00:00.000Z', minCards: 40 });
  assert.match(report, /Mode: DRY-RUN/);
  assert.match(report, /Status: PASS/);
  assert.match(report, /\| Buyer \/ Target \| 45 \| 44 \| 1 \| 2 \| 12 \| 0 \| 44 \| 15 \| PASS \|/);
  assert.match(report, /p2 \(missing full_text\)/);
});

test('dedupeProvisionCardRows removes rows that would violate live unique constraints', () => {
  const base = {
    deal_id: 'deal-1',
    provision_instance_id: 'pi-1',
    region_hash: 'rh-1',
    section_ref: 'sec-1',
    provision_type: 'REPRESENTATION',
  };
  const result = dedupeProvisionCardRows([
    base,
    { ...base, provision_instance_id: 'pi-2' },
    { ...base, provision_instance_id: 'pi-3', region_hash: 'rh-3' },
    { ...base, provision_instance_id: 'pi-4', region_hash: 'rh-4', section_ref: 'sec-4' },
  ]);
  assert.equal(result.rows.length, 2);
  assert.equal(result.removed, 2);
});

function fakeReplaceSupabase(options = {}) {
  const calls = [];
  const existingRows = options.existingRows || [];
  return {
    calls,
    from(table) {
      return {
        delete() {
          calls.push({ table, op: 'delete' });
          return {
            eq(column, value) {
              calls.push({ table, op: 'delete-eq', column, value });
              return {
                in(column2, values) {
                  calls.push({ table, op: 'delete-in', column: column2, values });
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
          return {
            eq(column, value) {
              calls.push({ table, op: 'select-eq', column, value });
              return Promise.resolve({
                data: existingRows.filter((row) => row.deal_id === value),
                error: null,
              });
            },
          };
        },
        upsert(rows, upsertOptions) {
          calls.push({ table, op: 'upsert', rows, options: upsertOptions });
          return Promise.resolve({ error: null });
        },
      };
    },
  };
}

test('replaceProvisionCardRows upserts before deleting (claims FK-cascade safety) and batches the upsert', async () => {
  // provision_cards.excerpt_id cascades ON DELETE to public.claims -- a
  // delete-then-upsert here would wipe every claim for the deal on any
  // corpus rebuild, even when nothing actually changed. Mirrors
  // lib/parser-v2/store-cards.js's storeProvisionCards fix.
  const orphanId = 'orphan-1';
  const sb = fakeReplaceSupabase({
    existingRows: [
      { deal_id: 'deal-1', provision_instance_id: 'pi-1' },
      { deal_id: 'deal-1', provision_instance_id: 'pi-2' },
      { deal_id: 'deal-1', provision_instance_id: 'pi-3' },
      { deal_id: 'deal-1', provision_instance_id: orphanId },
    ],
  });
  const rows = [
    { id: 1, provision_instance_id: 'pi-1' },
    { id: 2, provision_instance_id: 'pi-2' },
    { id: 3, provision_instance_id: 'pi-3' },
  ];
  const written = await replaceProvisionCardRows(sb, 'deal-1', rows, 2);
  assert.equal(written, 3);

  const upsertIndex = sb.calls.findIndex((call) => call.op === 'upsert');
  const orphanDeleteIndex = sb.calls.findIndex((call) => call.op === 'delete-in');
  assert.ok(upsertIndex >= 0, 'upsert must be called');
  assert.ok(orphanDeleteIndex >= 0, 'orphan delete must be called');
  assert.ok(upsertIndex < orphanDeleteIndex, 'upsert must run before the orphan delete');
  assert.ok(!sb.calls.slice(0, upsertIndex).some((call) => call.op === 'delete' || call.op === 'delete-eq' || call.op === 'delete-in'), 'no delete may precede the upsert');

  assert.deepEqual(sb.calls.filter((call) => call.op === 'upsert').map((call) => call.rows.length), [2, 1]);
  assert.equal(sb.calls.find((call) => call.op === 'upsert').options.onConflict, 'provision_instance_id');

  const orphanDeleteCall = sb.calls[orphanDeleteIndex];
  assert.equal(orphanDeleteCall.column, 'provision_instance_id');
  assert.deepEqual(orphanDeleteCall.values, [orphanId]);

  // Exactly one delete call total -- the scoped orphan cleanup -- never a
  // second, broader delete-all-for-deal call (the old, unsafe path).
  assert.equal(sb.calls.filter((call) => call.op === 'delete').length, 1);
});

test('replaceProvisionCardRows with zero rows deletes all existing cards for the deal', async () => {
  const sb = fakeReplaceSupabase({
    existingRows: [{ deal_id: 'deal-empty', provision_instance_id: 'x' }],
  });
  const written = await replaceProvisionCardRows(sb, 'deal-empty', [], 50);
  assert.equal(written, 0);
  assert.equal(sb.calls[0].op, 'delete');
  assert.deepEqual(
    sb.calls.filter((call) => call.op === 'delete-eq').map((call) => [call.column, call.value]),
    [['deal_id', 'deal-empty']],
  );
  assert.ok(!sb.calls.some((call) => call.op === 'upsert'), 'no upsert should run when there are zero rows to write');
});
