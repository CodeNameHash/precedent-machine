'use strict';

/**
 * tests/canonical-v2-draft-kind-rulings.test.js
 *
 * Test-first coverage for scripts/draft-kind-rulings.mjs (Task 7,
 * "separable: AI review drafter" -- docs/superpowers/plans/2026-08-01-
 * claim-identity-provenance-plan.md; docs/superpowers/specs/2026-08-01-
 * claim-identity-provenance-design.md, "5. Provenance tags" -> "AI review
 * drafter" and "4. Ruling corpus"). Mirrors
 * tests/canonical-v2-queue-volume-dry-run.test.js's pattern for testing an
 * ESM script: pure functions via dynamic `import()`, the CLI entry point via
 * `execFileSync` against real temp fixture files.
 *
 * No real model call is ever made here -- every model-shaped test uses
 * `--runner` to point at a stub script (also written to the temp dir) that
 * echoes canned JSON, per the task's requirement for "a stub runner
 * (injectable command that echoes canned JSON) exercises the full path
 * without any real model call".
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPO_ROOT = path.join(__dirname, '..');
const SCRIPT_PATH = path.join(REPO_ROOT, 'scripts', 'draft-kind-rulings.mjs');
const REAL_QUEUE_SCHEMA = 'RESOLUTION_REVIEW_QUEUE/V1';
const REAL_CORPUS_PATH = path.join(REPO_ROOT, 'contracts', 'ruling-corpus', 'ruling-corpus.v1.json');

function loadModule() {
  return import(`file://${SCRIPT_PATH}`);
}

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'draft-kind-rulings-'));
}

function writeQueueArtifact(dir, filename, items) {
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, JSON.stringify({
    schema_version: REAL_QUEUE_SCHEMA,
    review_queue: items,
  }, null, 2));
  return filePath;
}

function kindDisagreementItem(overrides = {}) {
  return {
    section_reference: '4.9(a)',
    generic_claim_key: 'REP_QUALIFIER',
    resolved_claim_definition_key: null,
    concept_key: 'REP-T-CAP',
    reasons: ['QUALIFIER_KIND_DISAGREEMENT'],
    materiality_rank: 40,
    materiality_label: 'MEDIUM',
    auto_pass: false,
    has_resolution: false,
    raw_value: 'true and correct in all material respects',
    canonical_value: null,
    normalised_phrase: 'true and correct in all material respects',
    attachment_position: 'CHAPEAU',
    concept_family: 'REP-T-CAP',
    ...overrides,
  };
}

function otherReasonItem(overrides = {}) {
  return {
    section_reference: '4.2(b)',
    generic_claim_key: 'PARTY_REP',
    reasons: ['PARTY_UNRESOLVED'],
    materiality_rank: 10,
    materiality_label: 'LOW',
    auto_pass: false,
    has_resolution: false,
    raw_value: 'the Company',
    normalised_phrase: 'the Company',
    attachment_position: 'CHAPEAU',
    concept_family: 'PARTY',
    ...overrides,
  };
}

/**
 * Writes a stub "model" script the test can point `--runner` at: it reads
 * (and discards) stdin, then prints `canned` (already-stringified JSON) to
 * stdout. This is the injectable "echoes canned JSON" runner the task
 * requires -- no real model call happens anywhere in this test file.
 */
function writeStubRunner(dir, canned) {
  const stubPath = path.join(dir, 'stub-runner.js');
  fs.writeFileSync(stubPath, `
    process.stdin.resume();
    let chunks = [];
    process.stdin.on('data', (d) => chunks.push(d));
    process.stdin.on('end', () => {
      process.stdout.write(${JSON.stringify(JSON.stringify(canned))});
    });
  `);
  return `node ${JSON.stringify(stubPath)}`;
}

// ─── Pure functions ───

test('selectKindReviewItems: selects only items whose reasons include a kind-review reason', async () => {
  const { selectKindReviewItems } = await loadModule();
  const queueArtifact = {
    schema_version: REAL_QUEUE_SCHEMA,
    review_queue: [
      otherReasonItem(),
      kindDisagreementItem(),
      otherReasonItem({ reasons: ['MULTI_SPAN_COMPOSED'] }),
      kindDisagreementItem({ reasons: ['QUALIFIER_KIND_UNCLASSIFIED'] }),
      kindDisagreementItem({ reasons: ['RULING_LEXICON_CONFLICT'] }),
    ],
  };
  const selected = selectKindReviewItems(queueArtifact);
  assert.equal(selected.length, 3);
  assert.deepEqual(selected.map((s) => s.index), [1, 3, 4]);
});

test('composePrompt: self-contained -- carries the quote, kind definitions, and the binding rule', async () => {
  const { composePrompt } = await loadModule();
  const item = kindDisagreementItem({
    normalised_phrase: 'true and correct, except for inaccuracies that are not material',
  });
  const prompt = composePrompt({ item, verifiedCorpusEntries: [] });
  assert.ok(prompt.includes('true and correct, except for inaccuracies that are not material'));
  assert.ok(prompt.includes('KNOWLEDGE'));
  assert.ok(prompt.includes('TEMPORAL'));
  assert.ok(prompt.includes('ACCURACY'));
  assert.ok(prompt.includes('THRESHOLD'));
  assert.ok(/except/i.test(prompt));
  assert.ok(prompt.includes('CHAPEAU'));
  assert.ok(prompt.toLowerCase().includes('json'));
});

test('composePrompt: includes VERIFIED corpus entries when present, and a placeholder note when absent', async () => {
  const { composePrompt } = await loadModule();
  const item = kindDisagreementItem();

  const withCorpus = composePrompt({
    item,
    verifiedCorpusEntries: [{
      normalised_phrase: 'true and correct in all material respects',
      attachment_position: 'CHAPEAU',
      concept_family: 'REP-T-CAP',
      ruled_kind: 'ACCURACY',
      ruled_code: 'MAT_ALL_MATERIAL',
    }],
  });
  assert.ok(withCorpus.includes('MAT_ALL_MATERIAL'));

  const withoutCorpus = composePrompt({ item, verifiedCorpusEntries: [] });
  assert.ok(withoutCorpus.toLowerCase().includes('no verified rulings'));
});

test('composePrompt: throws a typed error when the item has no quote to draft against', async () => {
  const { composePrompt, DraftKindRulingsError } = await loadModule();
  assert.throws(() => composePrompt({
    item: { attachment_position: 'CHAPEAU', concept_family: 'REP-T-CAP', reasons: ['QUALIFIER_KIND_UNCLASSIFIED'] },
    verifiedCorpusEntries: [],
  }), DraftKindRulingsError);
});

test('buildDraftOrReject: rejects when reasons_anchored_to_quote is missing entirely', async () => {
  const { buildDraftOrReject } = await loadModule();
  const outcome = buildDraftOrReject({
    queueItemRef: { index: 0 },
    quote: 'true and correct in all material respects',
    modelAnswer: { drafted_kind: 'ACCURACY', drafted_code: 'MAT_ALL_MATERIAL' },
    model: 'haiku',
    skillVersion: 1,
  });
  assert.equal(outcome.rejected, true);
  assert.equal(outcome.reason, 'MISSING_ANCHORED_REASONS');
});

test('buildDraftOrReject: rejects when a reason is not a verbatim substring of the quote', async () => {
  const { buildDraftOrReject } = await loadModule();
  const outcome = buildDraftOrReject({
    queueItemRef: { index: 0 },
    quote: 'true and correct in all material respects',
    modelAnswer: {
      drafted_kind: 'ACCURACY',
      drafted_code: 'MAT_ALL_MATERIAL',
      reasons_anchored_to_quote: ['a completely different sentence not in the quote'],
    },
    model: 'haiku',
    skillVersion: 1,
  });
  assert.equal(outcome.rejected, true);
  assert.equal(outcome.reason, 'UNANCHORED_REASON');
  assert.ok(outcome.details.unanchored.length === 1);
});

test('buildDraftOrReject: accepts a properly anchored answer and builds the spec-shaped draft', async () => {
  const { buildDraftOrReject, DRAFTER_PROMPT_VERSION } = await loadModule();
  const outcome = buildDraftOrReject({
    queueItemRef: { index: 2, normalised_phrase: 'true and correct in all material respects', attachment_position: 'CHAPEAU', concept_family: 'REP-T-CAP' },
    quote: 'true and correct in all material respects',
    modelAnswer: {
      drafted_kind: 'ACCURACY',
      drafted_code: 'MAT_ALL_MATERIAL',
      reasons_anchored_to_quote: ['true and correct', 'in all material respects'],
    },
    model: 'haiku',
    skillVersion: 1,
  });
  assert.equal(outcome.rejected, false);
  assert.deepEqual(Object.keys(outcome.draft).sort(), [
    'answer_provenance', 'drafted_code', 'drafted_kind', 'queue_item_ref', 'reasons_anchored_to_quote',
  ].sort());
  assert.equal(outcome.draft.drafted_kind, 'ACCURACY');
  assert.equal(outcome.draft.drafted_code, 'MAT_ALL_MATERIAL');
  assert.deepEqual(outcome.draft.reasons_anchored_to_quote, ['true and correct', 'in all material respects']);
  assert.deepEqual(outcome.draft.answer_provenance, {
    tag: 'AI',
    pins: { model: 'haiku', prompt_version: DRAFTER_PROMPT_VERSION, skill_version: 1 },
  });
});

test('buildDraftOrReject: rejects an invalid drafted_kind and treats null as a clean abstention', async () => {
  const { buildDraftOrReject } = await loadModule();

  const invalid = buildDraftOrReject({
    queueItemRef: { index: 0 },
    quote: 'material to the Company',
    modelAnswer: { drafted_kind: 'NOT_A_REAL_KIND', reasons_anchored_to_quote: ['material to the Company'] },
    model: 'haiku',
    skillVersion: 1,
  });
  assert.equal(invalid.rejected, true);
  assert.equal(invalid.reason, 'INVALID_DRAFTED_KIND');

  const abstained = buildDraftOrReject({
    queueItemRef: { index: 0 },
    quote: 'material to the Company',
    modelAnswer: { drafted_kind: null, reasons_anchored_to_quote: [] },
    model: 'haiku',
    skillVersion: 1,
  });
  assert.equal(abstained.rejected, true);
  assert.equal(abstained.reason, 'MODEL_ABSTAINED');
});

test('extractRunnerJson: accepts a bare JSON draft object', async () => {
  const { extractRunnerJson } = await loadModule();
  const result = extractRunnerJson(JSON.stringify({ drafted_kind: 'ACCURACY', reasons_anchored_to_quote: ['x'] }));
  assert.equal(result.drafted_kind, 'ACCURACY');
});

test('extractRunnerJson: unwraps a claude -p --output-format json CLI envelope', async () => {
  const { extractRunnerJson } = await loadModule();
  const envelope = JSON.stringify({
    is_error: false,
    result: JSON.stringify({ drafted_kind: 'TEMPORAL', reasons_anchored_to_quote: ['as of the date hereof'] }),
  });
  const result = extractRunnerJson(envelope);
  assert.equal(result.drafted_kind, 'TEMPORAL');
});

test('extractRunnerJson: throws a typed error when the CLI envelope reports is_error', async () => {
  const { extractRunnerJson, DraftKindRulingsError } = await loadModule();
  const envelope = JSON.stringify({ is_error: true, result: 'model unavailable' });
  assert.throws(() => extractRunnerJson(envelope), DraftKindRulingsError);
});

// ─── draftKindRulings orchestration (in-process, injected runner) ───

test('draftKindRulings: dry-run composes prompts and calls no runner', async () => {
  const { draftKindRulings } = await loadModule();
  let runnerCalled = false;
  const queueArtifact = {
    schema_version: REAL_QUEUE_SCHEMA,
    review_queue: [kindDisagreementItem()],
  };
  const result = draftKindRulings({
    queueArtifact,
    verifiedCorpusEntries: [],
    model: 'haiku',
    skillVersion: 1,
    dryRun: true,
    runner: () => { runnerCalled = true; },
  });
  assert.equal(runnerCalled, false);
  assert.equal(result.prompts.length, 1);
  assert.equal(result.drafts.length, 0);
  assert.ok(result.prompts[0].prompt.includes('true and correct in all material respects'));
});

test('draftKindRulings: end-to-end with an injected runner produces one draft per selected item', async () => {
  const { draftKindRulings } = await loadModule();
  const queueArtifact = {
    schema_version: REAL_QUEUE_SCHEMA,
    review_queue: [kindDisagreementItem(), otherReasonItem()],
  };
  const result = draftKindRulings({
    queueArtifact,
    verifiedCorpusEntries: [],
    model: 'haiku',
    skillVersion: 1,
    dryRun: false,
    runner: () => ({
      drafted_kind: 'ACCURACY',
      drafted_code: 'MAT_ALL_MATERIAL',
      reasons_anchored_to_quote: ['true and correct', 'in all material respects'],
    }),
  });
  assert.equal(result.selected_count, 1);
  assert.equal(result.drafts.length, 1);
  assert.equal(result.rejections.length, 0);
  assert.equal(result.drafts[0].queue_item_ref.index, 0);
});

test('draftKindRulings: an unanchored model answer is rejected, not drafted', async () => {
  const { draftKindRulings } = await loadModule();
  const queueArtifact = {
    schema_version: REAL_QUEUE_SCHEMA,
    review_queue: [kindDisagreementItem()],
  };
  const result = draftKindRulings({
    queueArtifact,
    verifiedCorpusEntries: [],
    model: 'haiku',
    skillVersion: 1,
    dryRun: false,
    runner: () => ({
      drafted_kind: 'ACCURACY',
      reasons_anchored_to_quote: ['something the model made up'],
    }),
  });
  assert.equal(result.drafts.length, 0);
  assert.equal(result.rejections.length, 1);
  assert.equal(result.rejections[0].reason, 'UNANCHORED_REASON');
});

// ─── CLI end-to-end (stub runner; no real model call) ───

test('CLI --dry-run: prints prompts, writes no drafts file, touches neither the queue nor the corpus file', () => {
  const dir = makeTempDir();
  const queuePath = writeQueueArtifact(dir, 'queue.json', [kindDisagreementItem()]);
  const queueBefore = fs.readFileSync(queuePath, 'utf8');
  const corpusBefore = fs.readFileSync(REAL_CORPUS_PATH, 'utf8');
  const draftsPath = `${queuePath}.drafts.json`;

  const stdout = execFileSync('node', [SCRIPT_PATH, '--queue', queuePath, '--dry-run'], { encoding: 'utf8' });
  const parsed = JSON.parse(stdout);

  assert.equal(parsed.dry_run, true);
  assert.equal(parsed.selected_count, 1);
  assert.equal(parsed.prompts.length, 1);
  assert.ok(parsed.prompts[0].prompt.includes('true and correct in all material respects'));
  assert.equal(fs.existsSync(draftsPath), false);
  assert.equal(fs.readFileSync(queuePath, 'utf8'), queueBefore);
  assert.equal(fs.readFileSync(REAL_CORPUS_PATH, 'utf8'), corpusBefore);
});

test('CLI: full run with a stub runner writes a spec-shaped drafts artifact and leaves queue/corpus untouched', () => {
  const dir = makeTempDir();
  const queuePath = writeQueueArtifact(dir, 'queue.json', [
    kindDisagreementItem(),
    otherReasonItem(),
  ]);
  const queueBefore = fs.readFileSync(queuePath, 'utf8');
  const corpusBefore = fs.readFileSync(REAL_CORPUS_PATH, 'utf8');

  const runnerCommand = writeStubRunner(dir, {
    drafted_kind: 'ACCURACY',
    drafted_code: 'MAT_ALL_MATERIAL',
    reasons_anchored_to_quote: ['true and correct', 'in all material respects'],
  });

  const outPath = path.join(dir, 'drafts.json');
  const stdout = execFileSync('node', [
    SCRIPT_PATH, '--queue', queuePath, '--out', outPath, '--runner', runnerCommand, '--skill-version', '1',
  ], { encoding: 'utf8' });

  const cliResult = JSON.parse(stdout);
  assert.equal(cliResult.ok, true);
  assert.equal(cliResult.drafted_count, 1);
  assert.equal(cliResult.rejected_count, 0);

  const artifact = JSON.parse(fs.readFileSync(outPath, 'utf8'));
  assert.equal(artifact.schema_version, 'RESOLUTION_REVIEW_QUEUE_DRAFTS/V1');
  assert.equal(artifact.drafts.length, 1);
  assert.equal(artifact.rejections.length, 0);
  const draft = artifact.drafts[0];
  assert.equal(draft.drafted_kind, 'ACCURACY');
  assert.equal(draft.drafted_code, 'MAT_ALL_MATERIAL');
  assert.deepEqual(draft.reasons_anchored_to_quote, ['true and correct', 'in all material respects']);
  assert.equal(draft.answer_provenance.tag, 'AI');
  assert.equal(draft.answer_provenance.pins.model, 'haiku');
  assert.equal(draft.answer_provenance.pins.skill_version, 1);
  assert.equal(typeof draft.answer_provenance.pins.prompt_version, 'number');

  // NEVER writes into the queue file or the ruling corpus.
  assert.equal(fs.readFileSync(queuePath, 'utf8'), queueBefore);
  assert.equal(fs.readFileSync(REAL_CORPUS_PATH, 'utf8'), corpusBefore);
});

test('CLI: a stub runner that omits anchored reasons produces a rejection, not a draft, and still touches nothing else', () => {
  const dir = makeTempDir();
  const queuePath = writeQueueArtifact(dir, 'queue.json', [kindDisagreementItem()]);
  const corpusBefore = fs.readFileSync(REAL_CORPUS_PATH, 'utf8');

  const runnerCommand = writeStubRunner(dir, {
    drafted_kind: 'ACCURACY',
    drafted_code: 'MAT_ALL_MATERIAL',
    reasons_anchored_to_quote: [],
  });

  const outPath = path.join(dir, 'drafts.json');
  const stdout = execFileSync('node', [
    SCRIPT_PATH, '--queue', queuePath, '--out', outPath, '--runner', runnerCommand,
  ], { encoding: 'utf8' });

  const cliResult = JSON.parse(stdout);
  assert.equal(cliResult.drafted_count, 0);
  assert.equal(cliResult.rejected_count, 1);

  const artifact = JSON.parse(fs.readFileSync(outPath, 'utf8'));
  assert.equal(artifact.drafts.length, 0);
  assert.equal(artifact.rejections.length, 1);
  assert.equal(artifact.rejections[0].reason, 'MISSING_ANCHORED_REASONS');
  assert.equal(fs.readFileSync(REAL_CORPUS_PATH, 'utf8'), corpusBefore);
});

test('CLI: defaults --out to <queue>.drafts.json when --out is not given', () => {
  const dir = makeTempDir();
  const queuePath = writeQueueArtifact(dir, 'queue.json', [kindDisagreementItem()]);
  const runnerCommand = writeStubRunner(dir, {
    drafted_kind: 'ACCURACY',
    drafted_code: null,
    reasons_anchored_to_quote: ['true and correct'],
  });

  execFileSync('node', [SCRIPT_PATH, '--queue', queuePath, '--runner', runnerCommand], { encoding: 'utf8' });

  const defaultOutPath = `${queuePath}.drafts.json`;
  assert.equal(fs.existsSync(defaultOutPath), true);
  const artifact = JSON.parse(fs.readFileSync(defaultOutPath, 'utf8'));
  assert.equal(artifact.drafts.length, 1);
});

test('CLI: fails closed (non-zero exit, typed message) when the queue file has the wrong schema_version', () => {
  const dir = makeTempDir();
  const badPath = path.join(dir, 'bad.json');
  fs.writeFileSync(badPath, JSON.stringify({ schema_version: 'SOMETHING_ELSE/V1', review_queue: [] }));
  assert.throws(() => {
    execFileSync('node', [SCRIPT_PATH, '--queue', badPath], { encoding: 'utf8', stdio: 'pipe' });
  }, (error) => {
    assert.match(error.stderr.toString(), /QUEUE_FILE_WRONG_SCHEMA|schema_version/);
    return true;
  });
});

test('CLI: fails closed when --queue is omitted', () => {
  assert.throws(() => {
    execFileSync('node', [SCRIPT_PATH], { encoding: 'utf8', stdio: 'pipe' });
  }, (error) => {
    assert.match(error.stderr.toString(), /--queue is required/);
    return true;
  });
});
