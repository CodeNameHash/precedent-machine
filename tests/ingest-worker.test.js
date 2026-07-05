const test = require('node:test');
const assert = require('node:assert/strict');

const {
  CLAIMABLE_KINDS,
  jobUrl,
  parseArgs,
  seedMetadata,
  truncate,
} = require('../scripts/ingest-worker');

test('worker CLI caps concurrency at the production hard cap', () => {
  const args = parseArgs(['node', 'script', '--concurrency', '28', '--backend', 'codex']);
  assert.equal(args.concurrency, 8);
  assert.equal(args.backend, 'codex');
});

test('worker validates requested job kinds', () => {
  assert.doesNotThrow(() => parseArgs(['node', 'script', '--kinds', [...CLAIMABLE_KINDS].join(',')]));
  assert.throws(
    () => parseArgs(['node', 'script', '--kinds', 'deal-prepare,unknown']),
    /Unknown job kind/,
  );
});

test('jobUrl reads current and legacy payload shapes', () => {
  assert.equal(jobUrl({ payload: { url: 'https://sec.example/a.htm' } }), 'https://sec.example/a.htm');
  assert.equal(
    jobUrl({ payload: { candidate: { agreement_exhibit_url: 'https://sec.example/b.htm' } } }),
    'https://sec.example/b.htm',
  );
});

test('seed metadata follows run and candidate identity', () => {
  const meta = seedMetadata({
    run_id: 'run-1',
    candidate_id: 'candidate-1',
    payload: {
      deal_key: 'deal-key',
      priority_reasons: ['reason'],
    },
  }, { backend: 'codex', model: 'gpt-5.5' });

  assert.deepEqual(meta, {
    run_id: 'run-1',
    candidate_id: 'candidate-1',
    deal_key: 'deal-key',
    priority_reasons: ['reason'],
    priority_verification: null,
    ingested_by: 'codex',
    extraction_model: 'gpt-5.5',
  });
});

test('truncate keeps worker error payloads bounded', () => {
  const value = truncate('x'.repeat(1300), 12);
  assert.equal(value.length, 12);
  assert.match(value, /\.\.\.$/);
});
