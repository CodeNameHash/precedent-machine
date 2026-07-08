const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildExtractorOutput,
  dedupeProvisionCardRows,
  findRegionForProvision,
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

test('replaceProvisionCardRows deletes deal rows and upserts in batches', async () => {
  const calls = [];
  const sb = {
    from(table) {
      return {
        delete() {
          calls.push({ table, op: 'delete' });
          return {
            eq(column, value) {
              calls.push({ table, op: 'delete-eq', column, value });
              return Promise.resolve({ error: null });
            },
          };
        },
        upsert(rows, options) {
          calls.push({ table, op: 'upsert', rows, options });
          return Promise.resolve({ error: null });
        },
      };
    },
  };
  await replaceProvisionCardRows(sb, 'deal-1', [{ id: 1 }, { id: 2 }, { id: 3 }], 2);
  assert.equal(calls[0].op, 'delete');
  assert.equal(calls[1].op, 'delete-eq');
  assert.deepEqual(calls.filter((call) => call.op === 'upsert').map((call) => call.rows.length), [2, 1]);
  assert.equal(calls.find((call) => call.op === 'upsert').options.onConflict, 'provision_instance_id');
});
