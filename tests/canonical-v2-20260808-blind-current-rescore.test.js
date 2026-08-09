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

function originalInputs() {
  const root = resolve(__dirname, '../evidence/blind-review/2026-08-08');
  return {
    sample: JSON.parse(readFileSync(resolve(root, 'blind-sample.json'), 'utf8')),
    key: JSON.parse(readFileSync(resolve(root, 'blind-key.json'), 'utf8')),
  };
}

function rowFor(card, key, now, source = 'replay') {
  return {
    id: card.id, deal: card.deal, family: card.family,
    orig_reason: key.find((item) => item.id === card.id)._reason,
    now, source,
  };
}

test('current output has the exact public schema and all 96 original IDs', () => {
  const outputPath = resolve(__dirname, '../evidence/blind-review/2026-08-08/blind-current-rescore.json');
  const samplePath = resolve(__dirname, '../evidence/blind-review/2026-08-08/blind-sample.json');
  assert.equal(existsSync(outputPath), true, 'generated current output is required');
  const rows = JSON.parse(readFileSync(outputPath, 'utf8'));
  const sample = JSON.parse(readFileSync(samplePath, 'utf8'));
  const key = JSON.parse(readFileSync(resolve(__dirname, '../evidence/blind-review/2026-08-08/blind-key.json'), 'utf8'));
  scorer.assertOutput(rows, sample, key);
  assert.equal(rows.length, 96);
  assert.deepEqual(new Set(rows.map((row) => row.id)), new Set(sample.map((row) => row.id)));
});

test('the original sample and answer key are a content-identical 96-ID join with twelve eight-card strata', () => {
  const { sample, key } = originalInputs();
  const joined = scorer.assertOriginalSampleJoin(sample, key);
  assert.equal(joined.sampleById.size, 96);
  assert.equal(joined.keyById.size, 96);
  const strata = scorer.assertStrata(key);
  assert.equal(strata.size, 12);
  for (const cards of strata.values()) assert.equal(cards.length, 8);
});

test('only the five governed current-state shapes are accepted', () => {
  const { sample, key } = originalInputs();
  const shapes = [
    'RESOLVED [TERMINATION_RIGHT_GRANT]',
    'REVIEW:ASSERTION_KIND_UNCORROBORATED',
    'OPEN_WORLD:NATIVE_OPEN_WORLD_PROPOSAL',
    'NOT_LOCATED_IN_OUTPUT',
    'ARTIFACT_MISSING',
  ];
  const rows = sample.map((card, index) => rowFor(card, key, shapes[index % shapes.length], index % 2 === 0 ? 'replay' : 'committed'));
  scorer.assertOutput(rows, sample, key);
  rows[0] = { ...rows[0], now: 'REVIEW:NOT_LOCATED_IN_OUTPUT' };
  assert.throws(() => scorer.assertOutput(rows, sample, key), (error) => error.code === 'OUTPUT_DISPOSITION_INVALID');
});

test('a missed floor cannot add accepted=false or alter any card state', () => {
  const { sample, key } = originalInputs();
  const rows = sample.map((card) => rowFor(card, key, 'REVIEW:ASSERTION_KIND_UNCORROBORATED'));
  scorer.assertOutput(rows, sample, key);
  const withAcceptanceRewrite = rows.map((row) => ({ ...row, accepted: false }));
  assert.throws(() => scorer.assertOutput(withAcceptanceRewrite, sample, key), (error) => error.code === 'OUTPUT_SCHEMA_INVALID');
  assert.equal(rows.every((row) => row.now === 'REVIEW:ASSERTION_KIND_UNCORROBORATED'), true);
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

test('current replay output also uses normalised exact matching before fallback', () => {
  const card = { section: '1.1', claim_key: 'NATIVE_CLAIM', quote: 'Exact candidate text' };
  const exact = { section: '1.1', claim_key: 'NATIVE_CLAIM', raw_value: 'Exact  candidate\u200E text', now: 'REVIEW:FIRST' };
  const fallback = { section: '1.1', claim_key: 'NATIVE_CLAIM', raw_value: 'Exact candidate text with context', now: 'REVIEW:SECOND' };
  const matched = scorer.matchCurrentOutput(card, [fallback, exact]);
  assert.equal(matched.method, 'exact');
  assert.deepEqual(matched.candidates, [exact]);
});

test('unlocatable states remain distinct from review', async () => {
  assert.equal(scorer.outcomeText(undefined), 'NOT_LOCATED_IN_OUTPUT');
  const artifact = await scorer.resolveMatches({
    repoRoot: process.cwd(), matched: [candidate({ replayable: false })], resolveRun: async () => { throw new Error('must not run'); },
  });
  assert.equal(artifact.now, 'ARTIFACT_MISSING');
  assert.notEqual(artifact.now, 'REVIEW:ARTIFACT_MISSING');
  const notLocated = await scorer.resolveMatches({
    repoRoot: process.cwd(), card: { section: '1.1', claim_key: 'NATIVE_CLAIM', quote: 'Exact candidate text' }, matched: [candidate()],
    resolveRun: async () => ({ runReceipt: { compiled_candidates: [] }, resolution: { resolved: [], review_queue: [], open_world: [] } }),
  });
  assert.equal(notLocated.now, 'NOT_LOCATED_IN_OUTPUT');
  assert.notEqual(notLocated.now, 'REVIEW:NOT_LOCATED_IN_OUTPUT');
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

test('source is selected once per family from the recorded resolver route changes', () => {
  const { sample } = originalInputs();
  const baseline = JSON.parse(readFileSync(resolve(__dirname, '../evidence/blind-review/2026-08-08/blind-rescore.json'), 'utf8'));
  const expectedReplay = new Set(['TERMINATION', 'REPRESENTATIONS', 'INTERIM_OPERATING', 'MAE_DEFINITION', 'DNO_INDEMNIFICATION']);
  const counts = { replay: 0, committed: 0 };
  for (const family of new Set(sample.map((card) => card.family))) {
    const mode = scorer.sourceModeForFamily(family);
    assert.equal(mode.source, expectedReplay.has(family) ? 'replay' : 'committed', family);
    const baselineSources = new Set(baseline.filter((row) => row.family === family).map((row) => row.source));
    assert.deepEqual(baselineSources, new Set([mode.baseline_source]), `${family} baseline source`);
    if (mode.source === 'replay') {
      assert.ok(mode.resolver_paths.length > 0, `${family} needs a resolver path`);
      assert.ok(mode.change_commits.length > 0, `${family} needs a change commit`);
    } else {
      assert.deepEqual(mode.resolver_paths, []);
      assert.deepEqual(mode.change_commits, []);
    }
  }
  for (const card of sample) counts[scorer.sourceModeForFamily(card.family).source] += 1;
  assert.deepEqual(counts, { replay: 57, committed: 39 });
});
