'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const RUNNER = path.join(ROOT, 'scripts', 'stage-2y-f-terra-adjudication.mjs');

async function subject() {
  return import(path.join(ROOT, 'scripts', 'stage-2y-f-terra-adjudication.mjs'));
}

async function inventory() {
  const ledger = await import(path.join(ROOT, 'scripts', 'stage-2y-f-lexical-classification.mjs'));
  return ledger.buildLexicalClassificationInventory({ repoRoot: ROOT });
}

function genuineDecision(input) {
  return {
    root_id: input.root_id,
    evidence_fingerprint: input.evidence_fingerprint,
    classification: 'GENUINE_UNCAPTURED_ITEM',
    rationale: 'The evidence card identifies a distinct item that is not represented by a resolved claim.',
    missing_item_description: 'A distinct item represented by the lexical signal.',
    follow_up_id: `LEXICAL-GAP:${input.root_id}`,
    proving_disagreement_ids: [input.disagreement_items[0].disagreement_id],
  };
}

function ambiguousDecision(input) {
  return {
    root_id: input.root_id,
    evidence_fingerprint: input.evidence_fingerprint,
    classification: 'AMBIGUOUS_NEEDS_REVIEW',
    rationale: 'The evidence card does not prove whether the lexical signal is a distinct legal item.',
    review_question: 'Does the unresolved signal state a legal item that is absent from the resolved claims?',
  };
}

test('Terra prompt states the exact classification key and output shapes', async () => {
  const { buildTerraAdjudicationInput, buildTerraPrompt } = await subject();
  const source = await inventory();
  const prompt = buildTerraPrompt(buildTerraAdjudicationInput(source.roots[0]));
  assert.match(prompt, /"classification":"SAME_CONCEPT_REPEAT"/);
  assert.match(prompt, /"classification":"GENUINE_UNCAPTURED_ITEM"/);
  assert.match(prompt, /"classification":"AMBIGUOUS_NEEDS_REVIEW"/);
  assert.match(prompt, /The discriminant key is exactly "classification", not "class"/);
});

test('Terra adjudication runs one isolated evidence-only call for each of the 164 roots', async () => {
  const { EXPECTED_ROOT_COUNT, runTerraAdjudication, validateTerraAdjudicationArtifact } = await subject();
  const source = await inventory();
  const seen = []; let active = 0; let maxActive = 0;
  const artifact = await runTerraAdjudication({
    inventory: source,
    reviewedAt: '2026-08-09T12:00:00.000Z',
    invoke: async ({ input, root }) => {
      seen.push({ root_id: root.root_id, input });
      const callNumber = seen.length;
      active += 1; maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active -= 1;
      return { text: JSON.stringify(genuineDecision(input)), provider_request_id: `thread-${callNumber}`, usage: { input_tokens: 1, cached_input_tokens: 0, output_tokens: 1, reasoning_output_tokens: 0 }, codex_completion: { status: 'COMPLETE', terminal_event: 'turn.completed' } };
    },
  });
  assert.equal(EXPECTED_ROOT_COUNT, 164);
  assert.equal(seen.length, 164);
  assert.equal(new Set(seen.map((item) => item.root_id)).size, 164);
  assert.equal(artifact.expected_call_count, 164);
  assert.equal(artifact.actual_call_count, 164);
  assert.equal(artifact.calls.length, 164);
  assert.equal(artifact.decisions.length, 164);
  assert.equal(artifact.publication_authorisation, 'NONE');
  assert.equal(artifact.matcher_change_authorisation, false);
  assert.match(artifact.artifact_id, /^sha256:[0-9a-f]{64}$/);
  assert.equal(maxActive, 4);
  assert.equal(validateTerraAdjudicationArtifact({ inventory: source, artifact }).ok, true);
  assert.ok(seen.every((item) => !Object.hasOwn(item.input, 'canonical_text')));
});

test('Terra output is strict and malformed output stays fail-closed', async () => {
  const { runTerraAdjudication, validateTerraAdjudicationArtifact } = await subject();
  const source = await inventory();
  const one = { ...source, roots: [source.roots[0]] };
  const artifact = await runTerraAdjudication({
    inventory: one,
    expectedRootCount: 1,
    reviewedAt: '2026-08-09T12:00:00.000Z',
    invoke: async () => ({ text: '{"classification":"SAME_CONCEPT_REPEAT","extra":"forbidden"}', provider_request_id: 'thread-bad', usage: { input_tokens: 1, cached_input_tokens: 0, output_tokens: 1, reasoning_output_tokens: 0 }, codex_completion: { status: 'COMPLETE', terminal_event: 'turn.completed' } }),
  });
  assert.equal(artifact.calls[0].state, 'MALFORMED_OUTPUT');
  assert.equal(artifact.decisions.length, 0);
  const checked = validateTerraAdjudicationArtifact({ inventory: one, artifact, expectedRootCount: 1 });
  assert.equal(checked.ok, false);
  assert.ok(checked.errors.includes('CALL_OUTPUT_INVALID'));
});

test('a valid ambiguous result keeps the artifact valid but remains non-authoritative for publication and matcher changes', async () => {
  const { runTerraAdjudication, validateTerraAdjudicationArtifact } = await subject();
  const source = await inventory();
  const one = { ...source, roots: [source.roots[0]] };
  const artifact = await runTerraAdjudication({
    inventory: one,
    expectedRootCount: 1,
    reviewedAt: '2026-08-09T12:00:00.000Z',
    invoke: async ({ input }) => ({
      text: JSON.stringify(ambiguousDecision(input)),
      provider_request_id: 'thread-ambiguous',
      usage: { input_tokens: 1, cached_input_tokens: 0, output_tokens: 1, reasoning_output_tokens: 0 },
      codex_completion: { status: 'COMPLETE', terminal_event: 'turn.completed' },
    }),
  });
  const checked = validateTerraAdjudicationArtifact({ inventory: one, artifact, expectedRootCount: 1 });
  assert.equal(checked.ok, true);
  assert.equal(checked.applied.roots[0].classification, 'AMBIGUOUS_NEEDS_REVIEW');
  assert.equal(artifact.publication_authorisation, 'NONE');
  assert.equal(artifact.matcher_change_authorisation, false);
});

test('forged Terra-labelled decisions fail without verified artifact authority, while human decisions keep their source', async () => {
  const ledger = await import(path.join(ROOT, 'scripts', 'stage-2y-f-lexical-classification.mjs'));
  const { runTerraAdjudication, validateTerraAdjudicationArtifact } = await subject();
  const source = await inventory();
  const root = source.roots.find((item) => item.disagreement_items.length && item.resolved_entries.length);
  const one = { ...source, roots: [root] };
  const artifact = await runTerraAdjudication({ inventory: one, expectedRootCount: 1, reviewedAt: '2026-08-09T12:00:00.000Z', invoke: async ({ input }) => ({ text: JSON.stringify(genuineDecision(input)), provider_request_id: 'thread-good', usage: { input_tokens: 1, cached_input_tokens: 0, output_tokens: 1, reasoning_output_tokens: 0 }, codex_completion: { status: 'COMPLETE', terminal_event: 'turn.completed' } }) });
  const forged = ledger.applyClassificationDecisions(one, { schema_version: 'STAGE_2Y_F_LEXICAL_DECISIONS/V1', decisions: artifact.decisions });
  assert.equal(forged.roots[0].classification_source, 'DEFAULT_FAIL_CLOSED');
  assert.ok(forged.decision_validation_errors.includes('DECISION_TERRA_AUTHORITY_UNVERIFIED'));
  const verified = validateTerraAdjudicationArtifact({ inventory: one, artifact, expectedRootCount: 1 });
  assert.equal(verified.ok, true);
  const terra = ledger.applyClassificationDecisions(one, { schema_version: 'STAGE_2Y_F_LEXICAL_DECISIONS/V1', decisions: artifact.decisions }, { terraAuthority: verified.terra_authority });
  assert.equal(terra.roots[0].classification_source, 'TERRA_ADJUDICATION');
  const human = ledger.applyClassificationDecisions(one, { schema_version: 'STAGE_2Y_F_LEXICAL_DECISIONS/V1', decisions: [{ ...artifact.decisions[0], classification_source: undefined, terra_call_id: undefined, terra_provenance: undefined }] });
  assert.equal(human.roots[0].classification_source, 'HUMAN_REVIEW');
});

test('tampering with the Terra artifact content ID fails verification', async () => {
  const { runTerraAdjudication, validateTerraAdjudicationArtifact } = await subject();
  const source = await inventory(); const one = { ...source, roots: [source.roots[0]] };
  const artifact = await runTerraAdjudication({ inventory: one, expectedRootCount: 1, reviewedAt: '2026-08-09T12:00:00.000Z', invoke: async ({ input }) => ({ text: JSON.stringify(genuineDecision(input)), provider_request_id: 'thread-artifact-id', usage: { input_tokens: 1, cached_input_tokens: 0, output_tokens: 1, reasoning_output_tokens: 0 }, codex_completion: { status: 'COMPLETE', terminal_event: 'turn.completed' } }) });
  artifact.artifact_id = 'sha256:tampered';
  const checked = validateTerraAdjudicationArtifact({ inventory: one, artifact, expectedRootCount: 1 });
  assert.equal(checked.ok, false);
  assert.ok(checked.errors.includes('ARTIFACT_ID_MISMATCH'));
});

test('check validates a sealed committed artifact without invoking Codex', async () => {
  const { runTerraAdjudication } = await subject();
  const source = await inventory();
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'stage-2y-f-terra-check-'));
  const output = path.join(scratch, 'adjudication.json');
  const bin = path.join(scratch, 'bin');
  const marker = path.join(scratch, 'codex-called');
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'codex'), `#!/bin/sh\ntouch "${marker}"\nexit 99\n`, { mode: 0o755 });
  try {
    const artifact = await runTerraAdjudication({
      inventory: source,
      reviewedAt: '2026-08-09T12:00:00.000Z',
      invoke: async ({ input, root }) => ({ text: JSON.stringify(genuineDecision(input)), provider_request_id: `thread-${root.root_id}`, usage: { input_tokens: 1, cached_input_tokens: 0, output_tokens: 1, reasoning_output_tokens: 0 }, codex_completion: { status: 'COMPLETE', terminal_event: 'turn.completed' } }),
    });
    fs.writeFileSync(output, JSON.stringify(artifact));
    const result = spawnSync('node', [RUNNER, '--check', '--output', output], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.equal(fs.existsSync(marker), false);
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});

test('resume skips sealed calls and rejects a tampered checkpoint', async () => {
  const { runTerraAdjudication } = await subject();
  const source = await inventory();
  const three = { ...source, roots: source.roots.slice(0, 3) };
  let checkpoint = null;
  let initialCalls = 0;
  await assert.rejects(runTerraAdjudication({
    inventory: three,
    expectedRootCount: 3,
    concurrency: 1,
    reviewedAt: '2026-08-09T12:00:00.000Z',
    invoke: async ({ input }) => {
      initialCalls += 1;
      return { text: JSON.stringify(genuineDecision(input)), provider_request_id: `initial-${initialCalls}`, usage: { input_tokens: 1, cached_input_tokens: 0, output_tokens: 1, reasoning_output_tokens: 0 }, codex_completion: { status: 'COMPLETE', terminal_event: 'turn.completed' } };
    },
    onCheckpoint: async (artifact) => {
      checkpoint = structuredClone(artifact);
      if (artifact.calls.length === 2) throw new Error('INTERRUPT_AFTER_TWO');
    },
  }), /INTERRUPT_AFTER_TWO/);
  assert.equal(initialCalls, 2);
  assert.equal(checkpoint.calls.length, 2);
  let resumedCalls = 0;
  const resumed = await runTerraAdjudication({
    inventory: three,
    expectedRootCount: 3,
    checkpointArtifact: checkpoint,
    concurrency: 1,
    reviewedAt: '2026-08-09T12:00:00.000Z',
    invoke: async ({ input }) => {
      resumedCalls += 1;
      return { text: JSON.stringify(genuineDecision(input)), provider_request_id: `resumed-${resumedCalls}`, usage: { input_tokens: 1, cached_input_tokens: 0, output_tokens: 1, reasoning_output_tokens: 0 }, codex_completion: { status: 'COMPLETE', terminal_event: 'turn.completed' } };
    },
  });
  assert.equal(resumedCalls, 1);
  assert.equal(resumed.calls.length, 3);
  const tampered = structuredClone(checkpoint);
  tampered.calls[0].prompt_digest = 'sha256:tampered';
  await assert.rejects(runTerraAdjudication({ inventory: three, expectedRootCount: 3, checkpointArtifact: tampered, invoke: async () => { throw new Error('must not call'); } }), /RESUME_CHECKPOINT_INVALID/);
});
