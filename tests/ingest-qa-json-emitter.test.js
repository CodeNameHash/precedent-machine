/* Tests for the WP-6 (M5-05) ingest-qa JSON emitter refactor:
   docs/handoffs/M4-M5-RECONCILED-PLAN-2026-07-18.md §7 item 2.

   Two concerns, kept in separate tests:
     1. The PASS-path CONSOLE OUTPUT must be byte-identical to pre-refactor
        HEAD (commit 080c5ab) — captured as a golden fixture below by
        running the *unmodified* printScorecard/printDealMetadataScorecard
        against fixed synthetic inputs before any code changed.
     2. The new structured JSON shape (buildDealResult) and the new CLI
        flags (--json, --report-db/--no-report-db) are pure, DB-free, and
        additive — no change to gate logic or thresholds. */
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  evaluateGates,
  evaluateDealMetadataGates,
  printScorecard,
  printDealMetadataScorecard,
  buildDealResult,
  parseArgs,
} = require('../scripts/ingest-qa');

// Golden console output, captured from git HEAD (080c5ab) — the commit
// immediately prior to this WP's changes — via:
//   node -e "... printScorecard(...); printDealMetadataScorecard(...); ..."
// with the exact synthetic metrics/deal reproduced in the test below. This
// is what scripts/ingest-qa.js printed to stdout for a clean PASS-path deal
// before the JSON-emitter refactor touched the file.
const GOLDEN_PASS_OUTPUT = [
  '═══ Acme Corp / Widget Inc ═══',
  '  total provisions: 97',
  '  REP-T                      20  >=15   PASS',
  '  REP-B                       8  >=5   PASS',
  '  DEF                        50  >=40   PASS',
  '  COND                       10  >=8   PASS',
  '  coverage %                 96  >=95   PASS',
  '  unverified quotes           0  ==0   PASS',
  '  duplicate clauses           0  ==0   PASS',
  '  canonical rate           0.85  >=0.70   PASS',
  '  ── informational (not gated) ──',
  '  raw coverage %             90   (vs total document incl. cover/TOC/signatures/exhibits)',
  '  excluded chars           1200   (cover_toc)',
  '  IOC (T/B)                   3',
  '  NOSOL                        1',
  '  TERMR (all)                 4',
  '  TERMF                        1',
  '  GATE RESULT: PASS',
  '  ── deal metadata (buyer/value/type/profile/signing_date) ──',
  '  buyer_display                   Acme Corp   PASS',
  '  value                          5000000000   PASS',
  '  consideration_type                   CASH   PASS',
  '  buyer_profile                   strategic   PASS',
  '  signing_date                   2025-01-01   PASS',
  '  advisors_found                        yes   info: yes',
  '  law_firms_found                        no   info: no',
  '  METADATA GATE RESULT: PASS',
].join('\n');

function syntheticFixture() {
  const metrics = {
    counts: { total: 97, repT: 20, repB: 8, def: 50, cond: 10, ioc: 3, nosol: 1, termr: 4, termf: 1 },
    coveragePct: 96,
    rawCoveragePct: 90,
    excludedChars: 1200,
    excludedRegions: [{ label: 'cover_toc', length: 1200 }],
    unverified: 0,
    duplicates: 0,
    canonicalRate: 0.85,
  };
  const deal = {
    id: 'deal-fixture-1',
    acquirer: 'Acme Corp',
    target: 'Widget Inc',
    value_usd: 5000000000,
    announce_date: '2025-01-01',
    metadata: {
      advisors_v2: { buyer_firms: ['BofA'] },
      headlineConsiderationType: 'CASH',
      buyer_profile: 'strategic',
    },
  };
  return { metrics, deal };
}

test('PASS-path console output is byte-identical to pre-refactor HEAD (snapshot)', () => {
  const { metrics, deal } = syntheticFixture();
  const evalResult = evaluateGates(metrics);
  const metaEval = evaluateDealMetadataGates(deal);
  const label = `${deal.acquirer} / ${deal.target}`;

  const lines = [];
  const originalLog = console.log;
  console.log = (...parts) => lines.push(parts.join(' '));
  try {
    printScorecard(label, metrics, evalResult);
    printDealMetadataScorecard(metaEval, { staging: false });
  } finally {
    console.log = originalLog;
  }

  // printScorecard's first console.log call emits a leading "\n" — strip it
  // for the join, matching how the golden fixture was captured line-by-line.
  const actual = lines.join('\n').replace(/^\n/, '');
  assert.equal(actual, GOLDEN_PASS_OUTPUT);
});

test('buildDealResult shape matches the spec: {dealId, counts, rawCoveragePct, excludedRegions, checks[], pass}', () => {
  const { metrics, deal } = syntheticFixture();
  const evalResult = evaluateGates(metrics);
  const metaEval = evaluateDealMetadataGates(deal);

  const result = buildDealResult(deal, metrics, evalResult, metaEval, { staging: false });

  assert.equal(result.dealId, 'deal-fixture-1');
  assert.equal(result.pass, true);
  assert.deepEqual(result.counts, metrics.counts);
  assert.equal(result.rawCoveragePct, 90);
  assert.deepEqual(result.excludedRegions, [{ label: 'cover_toc', length: 1200 }]);
  assert.ok(Array.isArray(result.checks));
  // 8 gate checks + 7 metadata checks (buyer_display, value,
  // consideration_type, buyer_profile, signing_date, advisors_found,
  // law_firms_found)
  assert.equal(result.checks.length, 8 + 7);
  assert.ok(result.checks.every((c) => c.group === 'gate' || c.group === 'metadata'));
  assert.ok(result.checks.some((c) => c.label === 'REP-T' && c.group === 'gate'));
  assert.ok(result.checks.some((c) => c.label === 'buyer_display' && c.group === 'metadata'));
});

test('buildDealResult: staging deals pass on gate-only result even if metadata gates fail', () => {
  const { metrics } = syntheticFixture();
  const evalResult = evaluateGates(metrics);
  const stagingDeal = { id: 'deal-staging-1', acquirer: 'X', target: 'Y', metadata: { ingest_status: 'staging' } };
  const metaEval = evaluateDealMetadataGates(stagingDeal); // fails (no value/consideration/etc)
  assert.equal(metaEval.ok, false);

  const result = buildDealResult(stagingDeal, metrics, evalResult, metaEval, { staging: true });
  assert.equal(result.staging, true);
  assert.equal(result.pass, true); // staging bypasses the metadata gate, per qaOneDeal's existing logic
});

test('buildDealResult: a real (non-staging) deal failing metadata gates fails overall even with clean provision gates', () => {
  const { metrics } = syntheticFixture();
  const evalResult = evaluateGates(metrics);
  const deal = { id: 'deal-2', acquirer: 'X', target: 'Y', metadata: {} }; // no value/consideration/profile/signing
  const metaEval = evaluateDealMetadataGates(deal);
  assert.equal(metaEval.ok, false);

  const result = buildDealResult(deal, metrics, evalResult, metaEval, { staging: false });
  assert.equal(result.pass, false);
});

test('parseArgs: --json and --report-db/--no-report-db parse without disturbing existing flags', () => {
  const withJson = parseArgs(['node', 'ingest-qa.js', '--all', '--json', '/tmp/out.json']);
  assert.equal(withJson.json, '/tmp/out.json');
  assert.equal(withJson.reportDb, null);

  const withReportDbOn = parseArgs(['node', 'ingest-qa.js', '--deal', 'Acme', '--report-db']);
  assert.equal(withReportDbOn.reportDb, true);
  assert.equal(withReportDbOn.deal, 'Acme');

  const withReportDbOff = parseArgs(['node', 'ingest-qa.js', '--all', '--no-report-db']);
  assert.equal(withReportDbOff.reportDb, false);

  const plain = parseArgs(['node', 'ingest-qa.js', '--all']);
  assert.equal(plain.json, null);
  assert.equal(plain.reportDb, null);
  // Existing gate-override flags still work alongside the new ones.
  const combined = parseArgs(['node', 'ingest-qa.js', '--all', '--min-rep-t', '10', '--json', 'x.json', '--report-db']);
  assert.equal(combined.gates.repT, 10);
  assert.equal(combined.json, 'x.json');
  assert.equal(combined.reportDb, true);
});
