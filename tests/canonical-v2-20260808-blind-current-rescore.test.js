'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const {
  existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync,
} = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { canonicalJson } = require('../lib/canonical-v2/canonical-bytes');

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

function canonicalDigest(value) {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
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

test('the gate reports all twelve original strata and keeps Stage 3 closed on the current failed floor', () => {
  const { sample, key } = originalInputs();
  const root = resolve(__dirname, '../evidence/blind-review/2026-08-08');
  const baseline = JSON.parse(readFileSync(resolve(root, 'blind-rescore.json'), 'utf8'));
  const rows = JSON.parse(readFileSync(resolve(root, 'blind-current-rescore.json'), 'utf8'));
  const gate = scorer.evaluateStratumGate({ rows, baseline, sample, key });
  assert.equal(gate.stratum_count, 12);
  assert.equal(gate.cards_per_stratum, 8);
  assert.equal(gate.blind_rescore_gate, 'FAIL');
  assert.equal(gate.stage_3_entry, 'CLOSED');
  assert.equal(gate.pass, false);
  const termination = gate.strata.find((row) => row.reason === 'TERMINATING_PARTY_REF_NOT_IN_QUOTE');
  const category = gate.strata.find((row) => row.reason === 'CATEGORY_UNCORROBORATED');
  assert.deepEqual(termination.resolved, { current: 6, baseline: 7 });
  assert.deepEqual(category.resolved, { current: 5, baseline: 4 });
  for (const row of gate.strata) {
    assert.equal(typeof row.review, 'number');
    assert.equal(typeof row.not_located_in_output, 'number');
    assert.equal(typeof row.artifact_missing, 'number');
  }
  assert.deepEqual(gate.failures.map((row) => row.reason).sort(), [
    'CONDITION_KIND_UNCORROBORATED',
    'PARTY_UNRESOLVED',
    'PROXY_MEETING_KIND_UNCORROBORATED',
    'TERMINATING_PARTY_REF_NOT_IN_QUOTE',
  ]);
});

test('a passing blind-rescore gate cannot authorise Stage 3', () => {
  const { sample, key } = originalInputs();
  const root = resolve(__dirname, '../evidence/blind-review/2026-08-08');
  const baseline = JSON.parse(readFileSync(resolve(root, 'blind-rescore.json'), 'utf8'));
  const gate = scorer.evaluateStratumGate({ rows: baseline, baseline, sample, key });
  assert.equal(gate.pass, true);
  assert.equal(gate.blind_rescore_gate, 'PASS');
  assert.equal(gate.stage_3_entry, 'NOT_AUTHORISED_BY_THIS_GATE');
});

test('a tampered blind-rescore baseline cannot redefine the authorised floor', () => {
  const { sample, key } = originalInputs();
  const root = resolve(__dirname, '../evidence/blind-review/2026-08-08');
  const baseline = JSON.parse(readFileSync(resolve(root, 'blind-rescore.json'), 'utf8'));
  const tampered = structuredClone(baseline);
  tampered.find((row) => row.orig_reason === 'TERMINATING_PARTY_REF_NOT_IN_QUOTE' && row.now.startsWith('RESOLVED ')).now = 'REVIEW:TERMINATING_PARTY_REF_NOT_IN_QUOTE';
  assert.throws(() => scorer.evaluateStratumGate({ rows: baseline, baseline: tampered, sample, key }), (error) => (
    error.code === 'AUTHORISED_BASELINE_FLOOR_MISMATCH'
  ));
});

test('the gate fails a staged-stratum regression without changing any output row', () => {
  const { sample, key } = originalInputs();
  const root = resolve(__dirname, '../evidence/blind-review/2026-08-08');
  const baseline = JSON.parse(readFileSync(resolve(root, 'blind-rescore.json'), 'utf8'));
  const rows = structuredClone(baseline);
  const target = rows.find((row) => row.orig_reason === 'CLAUSE_LABEL_NOT_IN_QUOTE' && row.now.startsWith('RESOLVED '));
  target.now = 'REVIEW:CLAUSE_LABEL_NOT_IN_QUOTE';
  const gate = scorer.evaluateStratumGate({ rows, baseline, sample, key });
  assert.equal(gate.pass, false);
  assert.deepEqual(gate.failures, [{
    reason: 'CLAUSE_LABEL_NOT_IN_QUOTE', type: 'STAGED_STRATUM_REGRESSED', current_resolved: 5, baseline_resolved: 6,
  }]);
  assert.equal(Object.hasOwn(target, 'accepted'), false);
});

test('the gate fails any new resolution in a zero-baseline control stratum', () => {
  const { sample, key } = originalInputs();
  const root = resolve(__dirname, '../evidence/blind-review/2026-08-08');
  const baseline = JSON.parse(readFileSync(resolve(root, 'blind-rescore.json'), 'utf8'));
  const rows = structuredClone(baseline);
  const target = rows.find((row) => row.orig_reason === 'ASSERTION_KIND_UNCORROBORATED');
  target.now = 'RESOLVED [FINANCING_COVENANT_ASSERTION]';
  const gate = scorer.evaluateStratumGate({ rows, baseline, sample, key });
  assert.equal(gate.pass, false);
  assert.deepEqual(gate.failures, [{
    reason: 'ASSERTION_KIND_UNCORROBORATED', type: 'CONTROL_STRATUM_MOVED', current_resolved: 1, baseline_resolved: 0,
  }]);
});

test('the gate CLI emits its table and has a non-zero status while Stage 3 is closed', () => {
  const root = resolve(__dirname, '..');
  const run = spawnSync(process.execPath, [resolve(root, 'scripts/canonical-v2-20260808-blind-current-rescore.mjs'), '--gate'], {
    cwd: root, encoding: 'utf8', env: { ...process.env, CI: 'true' },
  });
  assert.equal(run.status, 1, run.stderr);
  const report = JSON.parse(run.stdout);
  assert.equal(report.stage_3_entry, 'CLOSED');
  assert.equal(report.strata.length, 12);
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

test('source manifest uses the audited 74 replay / 22 current committed split', () => {
  const { sample } = originalInputs();
  const counts = { replay: 0, committed: 0 };
  const committedFamilies = new Set(['CLOSING_CONDITIONS', 'FINANCING_COVENANTS']);
  for (const family of new Set(sample.map((card) => card.family))) {
    const mode = scorer.sourceModeForFamily(family);
    assert.equal(mode.source, committedFamilies.has(family) ? 'committed' : 'replay', family);
    if (mode.source === 'replay') {
      assert.ok(mode.resolver_paths.includes('lib/canonical-v2/native-producer/candidate-resolution.js'), family);
    }
    if (committedFamilies.has(family) || family === 'PROXY_MEETING') {
      assert.equal(mode.current_batch_path, 'evidence/canonical-v2/stage-2y-l-live-batch.json', family);
    }
  }
  for (const card of sample) counts[scorer.sourceModeForFamily(card.family).source] += 1;
  assert.deepEqual(counts, { replay: 74, committed: 22 });
});

test('changed-prompt families select nested Stage 2Y-L runs and every fallback stays visible', () => {
  const trace = JSON.parse(readFileSync(resolve(
    __dirname, '../evidence/blind-review/2026-08-08/blind-current-rescore-trace.json',
  ), 'utf8'));
  const { sample } = originalInputs();
  const changed = new Set(['CLOSING_CONDITIONS', 'FINANCING_COVENANTS', 'PROXY_MEETING']);
  const changedIds = new Set(sample.filter((card) => changed.has(card.family)).map((card) => card.id));
  const cards = trace.cards.filter((card) => changedIds.has(card.id));
  assert.equal(cards.length, 30);
  assert.equal(cards.every((card) => card.source_selection === 'current_batch'), true);
  assert.equal(cards.every((card) => card.matched_candidates.length === 1), true);
  assert.equal(cards.every((card) => card.matched_candidates[0].source_run.startsWith('stage-2y-l-live-runs/')), true);
  assert.deepEqual(trace.matching.fallback_card_ids, [
    'ITEM-002', 'ITEM-007', 'ITEM-013', 'ITEM-016', 'ITEM-023',
    'ITEM-024', 'ITEM-025', 'ITEM-028', 'ITEM-046', 'ITEM-054',
    'ITEM-056', 'ITEM-061', 'ITEM-063', 'ITEM-082', 'ITEM-089',
  ]);
});

test('source selection rejects a forged and internally resealed Stage 2Y-L batch', () => {
  const repoRoot = resolve(__dirname, '..');
  const original = JSON.parse(readFileSync(resolve(
    repoRoot, 'evidence/canonical-v2/stage-2y-l-live-batch.json',
  ), 'utf8'));
  const forged = structuredClone(original);
  forged.call_manifest[0].deal = 'forged-deal';
  forged.calls[0].spec = structuredClone(forged.call_manifest[0]);
  forged.call_manifest_digest = canonicalDigest(forged.call_manifest);
  delete forged.artifact_id;
  forged.artifact_id = canonicalDigest(forged);
  const scratch = mkdtempSync(join(tmpdir(), 'blind-current-batch-'));
  const batchPath = resolve(scratch, 'forged.json');
  try {
    writeFileSync(batchPath, JSON.stringify(forged));
    assert.throws(
      () => scorer.currentBatchRuns({ repoRoot, batchPath }),
      (error) => error.code === 'CURRENT_BATCH_INVALID'
        && error.details.errors.includes('CALL_MANIFEST_INVALID')
        && !error.details.errors.includes('ARTIFACT_ID_INVALID'),
    );
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test('committed mode fails closed when it points at the historical score', () => {
  const { sample, key } = originalInputs();
  assert.throws(() => scorer.currentCommittedRows({
    repoRoot: resolve(__dirname, '..'), sample, key,
    baselinePath: 'evidence/blind-review/2026-08-08/blind-rescore.json',
    sourceMode: { source: 'committed', current_score_path: 'evidence/blind-review/2026-08-08/blind-rescore.json' },
    cache: new Map(),
  }), (error) => error.code === 'HISTORICAL_SCORE_REUSE_FORBIDDEN');
});
