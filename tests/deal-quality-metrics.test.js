const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  QUALITY_METRICS_TABLE,
  QUALITY_METRICS_VERSION,
  provisionFingerprint,
  publicSummary,
  qualityMetricsRowFromSummary,
  summaryFromStoredQualityMetrics,
  summariseDealQuality,
} = require('../lib/deal-quality-metrics');

test('deal quality metrics summarise, store, and rehydrate admin gaps summary rows', () => {
  const gapText = [
    'Section 5.04 No Solicitation.',
    'The Company shall not solicit, initiate, knowingly encourage or knowingly facilitate any Acquisition Proposal.',
    'The Company may respond only to a bona fide written Superior Proposal after complying with the notice mechanics.',
    'The Company Board may make a Change of Recommendation only after determining that failure to do so would be inconsistent with fiduciary duties.',
    'Parent must be notified promptly of any Acquisition Proposal and the material terms thereof.',
  ].join(' ');
  const source = [
    'Section 1.01 Intro. Parent will acquire the Company at the Effective Time.',
    gapText,
    'Section 9.02 Notices. All notices must be in writing and delivered to the parties listed below.',
  ].join(' ');
  const deal = {
    id: '00000000-0000-4000-a000-000000000001',
    acquirer: 'ParentCo',
    target: 'TargetCo',
    metadata: { full_text: source, ingest_status: 'succeeded' },
  };
  const provisions = [
    {
      id: 'p1',
      type: 'STRUCT',
      category: 'Intro',
      full_text: 'Section 1.01 Intro. Parent will acquire the Company at the Effective Time.',
      ai_metadata: { features: { canonicalCode: 'STRUCT-INTRO' } },
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'p2',
      type: 'MISC',
      category: 'Notices',
      full_text: 'Section 9.02 Notices. All notices must be in writing and delivered to the parties listed below.',
      ai_metadata: { features: { canonicalCode: 'MISC-NOTICES' } },
      created_at: '2026-01-01T00:00:01.000Z',
      updated_at: '2026-01-01T00:00:01.000Z',
    },
  ];
  const latestIngest = { run_id: 'run-1', candidate_id: 'cand-1', run_status: 'succeeded' };

  const summary = summariseDealQuality(deal, provisions, latestIngest);
  assert.equal(summary.deal_id, deal.id);
  assert.equal(summary.provision_count, 2);
  assert.equal(summary.gap_count, 1);
  assert.match(summary.largest_gap_preview, /No Solicitation/);
  assert.equal(summary.metadata.ingest_status, 'succeeded');
  assert.equal(summary.latest_ingest_run_id, 'run-1');
  assert.equal(summary.quality_metrics_source, 'computed');

  const computedAt = new Date('2026-07-06T12:00:00.000Z');
  const row = qualityMetricsRowFromSummary(summary, computedAt);
  assert.equal(row.deal_id, deal.id);
  assert.equal(row.metrics_version, QUALITY_METRICS_VERSION);
  assert.equal(row.computed_at, '2026-07-06T12:00:00.000Z');
  assert.equal(row.metadata.ingest_status, 'succeeded');

  const stored = summaryFromStoredQualityMetrics(
    { id: deal.id, acquirer: deal.acquirer, target: deal.target },
    row,
    latestIngest,
  );
  assert.equal(stored.quality_metrics_source, 'stored');
  assert.equal(stored.quality_metrics_computed_at, row.computed_at);
  assert.equal(stored.coverage_pct, summary.coverage_pct);
  assert.equal(stored.gap_count, summary.gap_count);
  assert.equal(stored.latest_ingest_candidate_id, 'cand-1');
  assert.equal(publicSummary(summary).source_text_hash, undefined);
});

test('provision fingerprint is stable across object key order and changes when provision content changes', () => {
  const first = provisionFingerprint([
    { id: 'b', full_text: 'Beta text', ai_metadata: { b: 2, a: 1 } },
    { id: 'a', full_text: 'Alpha text', ai_metadata: { nested: { y: true, x: false } } },
  ]);
  const second = provisionFingerprint([
    { id: 'a', full_text: 'Alpha text', ai_metadata: { nested: { x: false, y: true } } },
    { id: 'b', full_text: 'Beta text', ai_metadata: { a: 1, b: 2 } },
  ]);
  const changed = provisionFingerprint([
    { id: 'a', full_text: 'Alpha text changed', ai_metadata: { nested: { x: false, y: true } } },
    { id: 'b', full_text: 'Beta text', ai_metadata: { a: 1, b: 2 } },
  ]);

  assert.equal(first, second);
  assert.notEqual(first, changed);
});

test('deal quality metrics schema is explicit and service-role-only', () => {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'deal-quality-metrics-schema.sql'), 'utf8');
  const compact = sql.toLowerCase().replace(/\s+/g, ' ');

  assert.match(compact, /create table if not exists public\.deal_quality_metrics/);
  assert.match(compact, /deal_id uuid primary key references public\.deals\(id\) on delete cascade/);
  assert.match(compact, /metrics_version int not null default 1/);
  assert.match(compact, /coverage_pct numeric\(5,2\)/);
  assert.match(compact, /needs_code_type_counts jsonb not null default '\{\}'::jsonb/);
  assert.match(compact, /create index if not exists idx_deal_quality_metrics_coverage/);
  assert.match(compact, /create trigger trg_deal_quality_metrics_updated/);
  assert.match(compact, /create trigger trg_deal_quality_metrics_provisions_changed/);
  assert.match(compact, /after insert or update or delete on public\.provisions/);
  assert.match(compact, /create trigger trg_deal_quality_metrics_deals_changed/);
  assert.match(compact, /after update of metadata on public\.deals/);
  assert.match(compact, /alter table public\.deal_quality_metrics enable row level security/);
  assert.doesNotMatch(compact, /create policy/);
});

test('/api/admin/gaps summary is stored-metrics first with explicit refresh fallback', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'pages/api/admin/gaps.js'), 'utf8');

  assert.match(source, new RegExp(`const QUALITY_METRICS_TABLE = '${QUALITY_METRICS_TABLE}'|QUALITY_METRICS_TABLE`));
  assert.match(source, /\.from\(QUALITY_METRICS_TABLE\)\s*[\s\S]*\.select\(QUALITY_METRICS_SELECT\)/);
  assert.match(source, /\.select\('id, acquirer, target', \{ count: 'exact' \}\)/);
  assert.doesNotMatch(source, /\.select\('id, acquirer, target, metadata', \{ count: 'exact' \}\)/);
  assert.match(source, /summaryFromStoredQualityMetrics\(deal, stored/);
  assert.match(source, /computeDealIds\.push\(deal\.id\)/);
  assert.match(source, /refresh_metrics/);
});
