const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normaliseManifest,
  parseArgs,
  seedMetadata,
  selectManifestItems,
  truncate,
} = require('../scripts/ingest-seed-batch');

test('normaliseManifest accepts selector output and carries URL aliases', () => {
  const items = normaliseManifest({
    candidates: [{
      candidate_id: 'candidate-1',
      agreement_exhibit_url: 'https://sec.example/ex21.htm',
      priority_reasons: ['Paul Weiss named in agreement text'],
    }],
  });

  assert.equal(items.length, 1);
  assert.equal(items[0].candidate_id, 'candidate-1');
  assert.equal(items[0].url, 'https://sec.example/ex21.htm');
  assert.equal(items[0].agreement_exhibit_url, 'https://sec.example/ex21.htm');
  assert.deepEqual(items[0].priority_reasons, ['Paul Weiss named in agreement text']);
});

test('selectManifestItems supports candidate-id, offset, and limit filters', () => {
  const args = parseArgs([
    'node',
    'script',
    '--manifest',
    'manifest.json',
    '--candidate-id',
    'b',
    '--candidate-id',
    'c',
    '--offset',
    '1',
    '--limit',
    '1',
  ]);
  const items = [
    { candidate_id: 'a', url: 'https://sec.example/a.htm' },
    { candidate_id: 'b', url: 'https://sec.example/b.htm' },
    { candidate_id: 'c', url: 'https://sec.example/c.htm' },
  ];

  assert.deepEqual(selectManifestItems(items, args), [
    { candidate_id: 'c', url: 'https://sec.example/c.htm' },
  ]);
});

test('parseArgs defaults to Codex gpt-5.5 and caps concurrency at 2', () => {
  const args = parseArgs(['node', 'script', '--manifest', 'manifest.json', '--concurrency', '9']);
  assert.equal(args.backend, 'codex');
  assert.equal(args.model, 'gpt-5.5');
  assert.equal(args.concurrency, 2);
});

test('seedMetadata stamps extractor, model, run, candidate, deal key, and verification', () => {
  const metadata = seedMetadata({
    candidate_id: 'candidate-1',
    deal_key: 'deal-key',
    priority_reasons: ['Deal value at or above $10bn'],
    priority_verification: { value_usd: 14_000_000_000 },
  }, {
    backend: 'codex',
    model: 'gpt-5.5',
    runId: 'seed-50-test',
  });

  assert.deepEqual(metadata, {
    extractedBy: 'codex',
    extractionModel: 'gpt-5.5',
    seedRunId: 'seed-50-test',
    seedCandidateId: 'candidate-1',
    seedDealKey: 'deal-key',
    seedPriorityReasons: ['Deal value at or above $10bn'],
    seedPriorityVerification: { value_usd: 14_000_000_000 },
    seedCandidateDealValueUsd: null,
  });
});

test('truncate shortens long error text safely', () => {
  assert.equal(truncate('abcdef', 10), 'abcdef');
  assert.equal(truncate('abcdefghij', 6), 'abc...');
});
