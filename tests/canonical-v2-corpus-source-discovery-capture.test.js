const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const source = require('../lib/canonical-v2/corpus-source-discovery-capture');

const roster = { schema_version: 'M3_CORPUS_SOURCE_ROSTER/V1', deals: [{ deal_id: 'd1' }, { deal_id: 'd2' }] };
const sourceUrls = ['https://www.sec.gov/Archives/edgar/data/1/a.htm', 'https://www.sec.gov/Archives/edgar/data/2/b.htm'];
const rows = [
  { id: 'd1', acquirer: 'A', target: 'T', metadata: { full_text: '<html><body>One</body></html>', source_url: sourceUrls[0] } },
  { id: 'd2', acquirer: 'B', target: 'U', metadata: { full_text: '<html><body>Two</body></html>', source_url: sourceUrls[1] } },
];

test('CLI exposes planning only and rejects capture execution', () => {
  assert.throws(() => source.parseCliArgs([]), /--plan/);
  assert.throws(() => source.parseCliArgs(['--capture']), /CONTROLLED_CAPTURE_EXECUTOR_UNAVAILABLE/);
  assert.throws(() => source.parseCliArgs(['--plan', '--artifact-root', '/tmp/x', '--roster', '/y']), /temporary/);
  const parsed = source.parseCliArgs(['--plan', '--artifact-root', process.cwd(), '--roster', '/durable/r']);
  assert.equal(parsed.plan, true);
});

test('discovery cannot query a caller-supplied database boundary', async () => {
  let databaseCalls = 0;
  const db = { from() { databaseCalls += 1; } };
  await assert.rejects(source.readExactRosterDeals({ db, roster }), /CONTROLLED_DATABASE_SNAPSHOT_READER_UNAVAILABLE/);
  assert.equal(databaseCalls, 0);
});

test('adapts the committed home directory into the exact governed deal roster', () => {
  const adapted = source.deriveGovernedRoster({
    _meta: { schema_version: 'home-deal-directory/v1', source_digest: 'a'.repeat(64) },
    deals: [{ id: 'd1' }, { id: 'd2' }],
  });
  assert.deepEqual(adapted.deals, [{ deal_id: 'd1' }, { deal_id: 'd2' }]);
});

test('discovery retains declared occurrences and is explicitly not admission authority', () => {
  const occurrences = { schema_version: 'M3_SOURCE_OCCURRENCE_DECLARATIONS/V1', occurrences: [
    { occurrence_id: 'received-B', deal_id: 'd1', source_url: 'https://www.sec.gov/Archives/edgar/data/1/second-topbuild.htm' },
  ] };
  const records = source.buildDiscoveryRecords({ roster, deals: rows, occurrences });
  assert.equal(records.length, 3);
  assert.equal(records[2].stored_full_text_sha256, null);
  assert.equal(records[2].primary_occurrence_relationship.status, 'UNCOMPARED');
  assert.equal(records[0].admission_authority, 'NOT_ADMISSION_AUTHORITY');
  assert.equal(records[2].source_metadata.source_url, 'https://www.sec.gov/Archives/edgar/data/1/second-topbuild.htm');
  assert.throws(() => source.buildDiscoveryRecords({ roster, deals: rows, occurrences: { ...occurrences, occurrences: [{ ...occurrences.occurrences[0], source_url: sourceUrls[0] }] } }), /duplicates its metadata primary/);
});

test('capture executor is unavailable even with caller-supplied network and write boundaries', async () => {
  const records = source.buildDiscoveryRecords({ roster, deals: rows, occurrences: null }).slice(0, 1);
  let networkCalls = 0;
  let writes = 0;
  await assert.rejects(source.captureDiscoveryRecords({
    records,
    artifactRoot: process.cwd(),
    fs: { writeFileSync: () => { writes += 1; } },
    fetchImpl: async () => { networkCalls += 1; },
  }), /CONTROLLED_CAPTURE_EXECUTOR_UNAVAILABLE/);
  assert.equal(networkCalls, 0);
  assert.equal(writes, 0);
});

test('the Phase 1 source module contains no network or filesystem-write executor', () => {
  const moduleSource = require('node:fs').readFileSync(path.join(__dirname, '..', 'lib', 'canonical-v2', 'corpus-source-discovery-capture.js'), 'utf8');
  const script = require('node:fs').readFileSync(path.join(__dirname, '..', 'scripts', 'canonical-v2-corpus-source-discovery-capture.js'), 'utf8');
  for (const text of [moduleSource, script]) {
    assert.doesNotMatch(text, /createClient|SUPABASE_SERVICE_ROLE_KEY|\.from\(['"]deals['"]\)|globalThis\.fetch|writeFileSync|renameSync|mkdirSync/);
  }
});
