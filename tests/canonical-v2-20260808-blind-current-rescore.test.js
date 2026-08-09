'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('node:fs');
const { resolve } = require('node:path');

let scorer;

test.before(async () => {
  scorer = await import('../scripts/canonical-v2-20260808-blind-current-rescore.mjs');
});

function candidate(overrides = {}) {
  return {
    source_run: 'historical-run', deal: 'deal', family: 'FAMILY', section: '1.1',
    claim_key: 'NATIVE_CLAIM', raw_value: 'Exact candidate text', candidate_id: 'candidate-1', replayable: true,
    ...overrides,
  };
}

function resolvedReplay(id, kind) {
  const entry = { ok: true, section_reference: '1.1', candidate: { kind: 'claim', claim: { claim_occurrence_id: id, raw_value: 'Exact candidate text' } } };
  return {
    runReceipt: { compiled_candidates: [entry] },
    resolution: {
      resolved: [{ section_reference: '1.1', generic_claim_key: 'NATIVE_CLAIM', resolved_claim_definition_key: kind, claim: entry.candidate.claim, compiled_candidate: entry }],
      review_queue: [], open_world: [], residuals: [],
    },
  };
}

test('current output has the exact public schema and all 96 original IDs', () => {
  const outputPath = resolve(__dirname, '../evidence/blind-review/2026-08-08/blind-current-rescore.json');
  const samplePath = resolve(__dirname, '../evidence/blind-review/2026-08-08/blind-sample.json');
  assert.equal(existsSync(outputPath), true, 'generated current output is required');
  const rows = JSON.parse(readFileSync(outputPath, 'utf8'));
  const sample = JSON.parse(readFileSync(samplePath, 'utf8'));
  scorer.assertOutput(rows, sample);
  assert.equal(rows.length, 96);
  assert.deepEqual(new Set(rows.map((row) => row.id)), new Set(sample.map((row) => row.id)));
});

test('normalised exact matching wins before fallback matching', () => {
  const card = { deal: 'deal', family: 'FAMILY', section: '1.1', claim_key: 'NATIVE_CLAIM', quote: 'Exact candidate text' };
  const exact = candidate({ candidate_id: 'exact', raw_value: 'Exact  candidate\u200E text' });
  const fallback = candidate({ candidate_id: 'fallback', raw_value: 'Exact candidate text with extra context' });
  const matched = scorer.matchCard(card, [fallback, exact]);
  assert.equal(matched.method, 'exact');
  assert.deepEqual(matched.candidates.map((item) => item.candidate_id), ['exact']);
});

test('fallback matching is visible only after normalised exact matching misses', () => {
  const card = { deal: 'deal', family: 'FAMILY', section: '1.1', claim_key: 'NATIVE_CLAIM', quote: 'short evidence' };
  const matched = scorer.matchCard(card, [candidate({ raw_value: 'short evidence with its governing context' })]);
  assert.equal(matched.method, 'fallback');
  assert.equal(matched.candidates.length, 1);
});

test('unlocatable states remain distinct from review', async () => {
  assert.equal(scorer.outcomeText(undefined), 'NOT_LOCATED_IN_OUTPUT');
  const artifact = await scorer.resolveMatches({
    repoRoot: process.cwd(), matched: [candidate({ replayable: false })], resolveRun: async () => { throw new Error('must not run'); },
  });
  assert.equal(artifact.now, 'ARTIFACT_MISSING');
  assert.notEqual(artifact.now, 'REVIEW:ARTIFACT_MISSING');
});

test('duplicate exact matches from different recordings fail when their selected dispositions conflict', async () => {
  const first = candidate({ source_run: 'run-a', candidate_id: 'a' });
  const second = candidate({ source_run: 'run-b', candidate_id: 'b' });
  await assert.rejects(
    scorer.resolveMatches({
      repoRoot: process.cwd(), card: { section: '1.1', claim_key: 'NATIVE_CLAIM', quote: 'Exact candidate text' }, matched: [first, second],
      resolveRun: async ({ sourceRun }) => resolvedReplay(sourceRun === 'run-a' ? 'a' : 'b', sourceRun === 'run-a' ? 'FIRST_KIND' : 'SECOND_KIND'),
    }),
    (error) => error.code === 'DUPLICATE_EXACT_CURRENT_DISPOSITION_CONFLICT',
  );
});

test('the original sample retains twelve eight-card strata', () => {
  const key = JSON.parse(readFileSync(resolve(__dirname, '../evidence/blind-review/2026-08-08/blind-key.json'), 'utf8'));
  const strata = Map.groupBy(key, (row) => row._reason);
  assert.equal(strata.size, 12);
  for (const rows of strata.values()) assert.equal(rows.length, 8);
});
