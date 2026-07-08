const test = require('node:test');
const assert = require('node:assert/strict');

const {
  findRepairs,
  indexTargetProvisions,
  markdownReport,
  parseArgs,
  textHash,
} = require('../scripts/backfill/repair-card-type-mapping');

test('findRepairs maps MISC fallback cards back to the schema-valid structure family', () => {
  const provisions = [
    { id: 'p-struct', deal_id: 'deal-1', type: 'STRUCT', full_text: 'The merger shall be effected.' },
    { id: 'p-other', deal_id: 'deal-1', type: 'OTHER', full_text: 'The charter shall be amended.' },
    { id: 'p-misc', deal_id: 'deal-1', type: 'MISC', full_text: 'Fees shall be paid.' },
  ];
  const cards = [
    { id: 'c-struct', deal_id: 'deal-1', provision_type: 'MISC_BOILERPLATE', primary_quote: 'The merger shall be effected.', short_title: 'The Merger' },
    { id: 'c-other', deal_id: 'deal-1', provision_type: 'MISC_BOILERPLATE', primary_quote: 'The charter shall be amended.', short_title: 'Charter' },
    { id: 'c-noop', deal_id: 'deal-1', provision_type: 'MISC_BOILERPLATE', primary_quote: 'Fees shall be paid.', short_title: 'Fees' },
  ];

  const repairs = findRepairs(cards, indexTargetProvisions(provisions));

  assert.deepEqual(repairs.map((repair) => [repair.id, repair.source_type, repair.to]), [
    ['c-struct', 'STRUCT', 'STRUCTURE_MECHANICS'],
  ]);
});

test('findRepairs ignores OTHER because provision_cards has no raw OTHER family', () => {
  const index = indexTargetProvisions([
    { id: 'p-other', deal_id: 'deal-1', type: 'OTHER', full_text: 'Same text.' },
  ]);
  const repairs = findRepairs([
    { id: 'c-1', deal_id: 'deal-1', provision_type: 'MISC_BOILERPLATE', primary_quote: 'Same text.' },
  ], index);

  assert.deepEqual(repairs, []);
});

test('textHash is whitespace-insensitive for quote matching', () => {
  assert.equal(textHash('The   merger shall be effected.'), textHash('The merger shall be effected.'));
});

test('parseArgs supports apply, env-file, and report output', () => {
  assert.deepEqual(parseArgs(['--apply', '--env-file', '.env.local', '--out', 'report.md']), {
    apply: true,
    envFile: '.env.local',
    out: 'report.md',
  });
});

test('markdownReport summarises repair counts', () => {
  const report = markdownReport({
    apply: true,
    repairs: [
      { id: 'c-1', deal_id: 'deal-1', from: 'MISC_BOILERPLATE', to: 'STRUCTURE_MECHANICS', title: 'The Merger' },
    ],
  });

  assert.match(report, /Mode: APPLY/);
  assert.match(report, /\| STRUCTURE_MECHANICS \| 1 \|/);
});
