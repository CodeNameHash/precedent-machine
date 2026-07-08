const assert = require('node:assert/strict');
const test = require('node:test');

const {
  compareDeal,
  discoveryMarkdown,
  legacyCells,
  parityMarkdown,
  parseArgs,
  schemaCells,
  triageMarkdown,
} = require('../../scripts/audit/schema-parity');

const DEAL = { id: 'deal-1', acquirer: 'Buyer', target: 'Target' };

test('schema parity reports zero diffs for matching visible legacy provision and card', () => {
  const provisions = [{
    id: 'p1',
    type: 'REP-T',
    category: '[PROPOSED] Material Contracts',
    full_text: 'The Company has no material contracts except as disclosed.',
  }];
  const cards = [{
    id: 'c1',
    provision_type: 'REPRESENTATION',
    section_ref: '4.12',
    short_title: 'Material Contracts',
    primary_quote: 'The Company has no material contracts except as disclosed.',
    kind: 'standard',
  }];

  const result = compareDeal({ deal: DEAL, provisions, cards });

  assert.equal(result.legacyCellCount, 1);
  assert.equal(result.schemaCellCount, 1);
  assert.deepEqual(result.diffs, []);
});

test('schema parity detects missing schema cards and schema-only cards', () => {
  const provisions = [{
    id: 'p1',
    type: 'COND',
    category: 'Regulatory Approval',
    full_text: 'Approval must have been obtained.',
  }];
  const cards = [{
    id: 'c1',
    provision_type: 'CLOSING_CONDITION',
    section_ref: '7.01',
    short_title: 'Stockholder Approval',
    primary_quote: 'The stockholder approval must have been obtained.',
    kind: 'standard',
  }];

  const result = compareDeal({ deal: DEAL, provisions, cards });

  assert.equal(result.diffs.length, 2);
  assert.equal(result.diffs[0].category, 'missing_schema_card');
  assert.equal(result.diffs[1].category, 'schema_only_card');
});

test('legacy cells apply user-mode filtering used by the review page', () => {
  const cells = legacyCells([
    { id: 'leftover', type: 'SECTION-LEFTOVER', category: 'Coverage', full_text: 'plumbing' },
    { id: 'visible', type: 'MISC', category: '[PROPOSED] Fees', full_text: 'fees text' },
  ]);

  assert.equal(cells.length, 1);
  assert.equal(cells[0].field, 'Fees');
});

test('schema cells fall back from primary quote to region text', () => {
  const cells = schemaCells([
    { id: 'c1', provision_type: 'DEFINITION', section_ref: '1.01', defined_term: 'MAE', region_full_text: 'MAE means...' },
  ]);

  assert.equal(cells.length, 1);
  assert.equal(cells[0].field, 'MAE');
  assert.equal(cells[0].quote, 'MAE means...');
});

test('markdown reports include corpus totals and triage categories', () => {
  const dirty = compareDeal({
    deal: DEAL,
    provisions: [{ id: 'p1', type: 'MISC', category: 'Fees', full_text: 'fees text' }],
    cards: [],
  });
  const report = parityMarkdown([dirty], '2026-07-08T00:00:00.000Z');
  const triage = triageMarkdown([dirty], '2026-07-08T00:00:00.000Z');
  const discovery = discoveryMarkdown([dirty], '2026-07-08T00:00:00.000Z');

  assert.match(report, /Total diffs: 1/);
  assert.match(report, /0 \/ 1 deals clean/);
  assert.match(triage, /missing_schema_card/);
  assert.match(discovery, /BELOW_CARD_THRESHOLD/);
});

test('parseArgs accepts explicit output paths and no-write mode', () => {
  assert.deepEqual(parseArgs([
    '--env-file', '.env.local',
    '--discovery', 'tmp/discovery.md',
    '--report', 'tmp/report.md',
    '--triage', 'tmp/triage.md',
    '--no-write',
  ]), {
    envFile: '.env.local',
    discoveryPath: 'tmp/discovery.md',
    reportPath: 'tmp/report.md',
    suppressedRecitalsPath: 'docs/audit/parity-suppressed-recitals.md',
    suppressedUnlocatedPath: 'docs/audit/parity-suppressed-unlocated-legacy.md',
    triagePath: 'tmp/triage.md',
    write: false,
  });
});
