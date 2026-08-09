'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

async function ledger() {
  return import(path.join(ROOT, 'scripts/stage-2y-f-lexical-classification.mjs'));
}

test('Stage 2Y-F selects the current final corpus and records the historical discrepancy', async () => {
  const { isFinalCorpusRun } = await import(path.join(ROOT, 'scripts/canonical-v2-corpus-review-artifact.mjs'));
  const { buildLexicalClassificationInventory } = await ledger();
  assert.equal(isFinalCorpusRun('concho-no-shop-20260809-2xk-final'), true);
  assert.equal(isFinalCorpusRun('concho-no-shop-20260809-2xk-r3'), false);
  const inventory = buildLexicalClassificationInventory({ repoRoot: ROOT });
  assert.equal(inventory.selection_reconciliation.selected_run_count, 157);
  assert.equal(inventory.selection_reconciliation.historical_note_claimed_run_count, 151);
  assert.equal(inventory.selection_reconciliation.status, 'COUNT_DISCREPANCY_UNRESOLVED');
});

test('Stage 2Y-F builds the pinned mechanical inventory', async () => {
  const { buildLexicalClassificationInventory } = await ledger();
  const inventory = buildLexicalClassificationInventory({ repoRoot: ROOT });
  assert.deepEqual(inventory.stats, {
    selected_run_count: 157, lexical_file_count: 157, governed_section_count: 558,
    affected_claim_rows: 635, pattern_hits: 1670, matched_hits: 341, unmatched_hits: 1329, irreproducible_hits: 0,
    source_candidate_linkage_totals: { SOURCE_CANDIDATE_UNIQUE: 488, SOURCE_CANDIDATE_AMBIGUOUS: 130, SOURCE_CANDIDATE_NOT_LOCATED: 17 },
  });
  assert.equal(inventory.roots.length, 164);
  assert.equal(new Set(inventory.roots.map((root) => `${root.deal}\0${root.section_reference}\0${root.concept_key}`)).size, 164);
  assert.equal(inventory.roots.reduce((sum, root) => sum + root.queue_rows.length, 0), 635);
  assert.ok(inventory.roots.every((root) => root.evidence_valid));
  const linkage = {};
  for (const root of inventory.roots) for (const row of root.queue_rows) {
    const state = row.source_candidate_linkage.state;
    linkage[state] = (linkage[state] || 0) + 1;
  }
  assert.deepEqual(linkage, {
    SOURCE_CANDIDATE_UNIQUE: 488, SOURCE_CANDIDATE_AMBIGUOUS: 130, SOURCE_CANDIDATE_NOT_LOCATED: 17,
  });
  assert.equal(Object.values(linkage).reduce((sum, count) => sum + count, 0), 635);
});

test('selected final runs fail closed when a required file is missing', async () => {
  const { buildLexicalClassificationInventory } = await ledger();
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'stage-2y-f-ledger-'));
  const runName = 'fixture-20260809-2xk-final';
  fs.mkdirSync(path.join(fixtureRoot, 'evidence', 'canonical-v2', runName), { recursive: true });
  try {
    assert.throws(() => buildLexicalClassificationInventory({ repoRoot: fixtureRoot }), (error) => error.code === 'MISSING_REQUIRED_RUN_FILE' && error.message === `MISSING_REQUIRED_RUN_FILE:${runName}:run-manifest.json`);
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('evidence failures are typed and cannot become a semantic class', async () => {
  const { buildLexicalClassificationInventory, validateRootEvidence, applyClassificationDecisions } = await ledger();
  const inventory = buildLexicalClassificationInventory({ repoRoot: ROOT });
  const root = structuredClone(inventory.roots.find((item) => item.disagreement_items.length));
  root.section.text_sha256 = 'bad';
  const invalid = validateRootEvidence(root);
  assert.ok(invalid.failures.includes('SECTION_HASH_MISMATCH'));
  const applied = applyClassificationDecisions({ ...inventory, roots: [invalid] }, { schema_version: 'STAGE_2Y_F_LEXICAL_DECISIONS/V1', decisions: [] });
  assert.equal(applied.roots[0].classification, 'INVALID_INPUT');
});

test('UTF-8 continuation-byte hit boundaries fail closed', async () => {
  const { buildLexicalClassificationInventory, validateRootEvidence } = await ledger();
  const inventory = buildLexicalClassificationInventory({ repoRoot: ROOT });
  const root = structuredClone(inventory.roots.find((item) => item.outcome?.disagreement_set?.length));
  root.canonical_text = 'é';
  root.section.start = 0;
  root.section.end = Buffer.byteLength(root.canonical_text, 'utf8');
  root.outcome.disagreement_set[0].start = 1;
  root.outcome.disagreement_set[0].end = 2;
  assert.ok(validateRootEvidence(root).failures.includes('HIT_UTF8_BOUNDARY_INVALID'));
});

test('unreviewed valid roots fail closed, and decisions validate coverage and freshness', async () => {
  const { buildLexicalClassificationInventory, applyClassificationDecisions } = await ledger();
  const inventory = buildLexicalClassificationInventory({ repoRoot: ROOT });
  const root = inventory.roots.find((item) => item.evidence_valid && item.disagreement_items.length);
  const blank = applyClassificationDecisions(inventory, { schema_version: 'STAGE_2Y_F_LEXICAL_DECISIONS/V1', decisions: [] });
  assert.equal(blank.roots.find((item) => item.root_id === root.root_id).classification, 'AMBIGUOUS_NEEDS_REVIEW');
  assert.equal(blank.roots.find((item) => item.root_id === root.root_id).classification_source, 'DEFAULT_FAIL_CLOSED');
  const partial = applyClassificationDecisions({ ...inventory, roots: [root] }, { schema_version: 'STAGE_2Y_F_LEXICAL_DECISIONS/V1', decisions: [{ root_id: root.root_id, evidence_fingerprint: root.evidence_fingerprint, classification: 'SAME_CONCEPT_REPEAT', covered_claim_revision_ids: ['x'], covered_disagreement_ids: [root.disagreement_items[0].disagreement_id], rationale: 'Review.', reviewed_by: 'Ben', reviewed_on: '2026-08-09' }] });
  assert.ok(partial.decision_validation_errors.includes('DECISION_SAME_CONCEPT_CLAIM_COVERAGE_MISMATCH'));
  assert.ok(partial.decision_validation_errors.includes('DECISION_SAME_CONCEPT_DISAGREEMENT_COVERAGE_MISMATCH'));
  const stale = applyClassificationDecisions({ ...inventory, roots: [root] }, { schema_version: 'STAGE_2Y_F_LEXICAL_DECISIONS/V1', decisions: [{ root_id: root.root_id, evidence_fingerprint: 'sha256:stale', classification: 'AMBIGUOUS_NEEDS_REVIEW', review_question: 'What remains?', rationale: 'Review.', reviewed_by: 'Ben', reviewed_on: '2026-08-09' }] });
  assert.ok(stale.decision_validation_errors.includes('DECISION_STALE'));
});

test('claim evidence IDs and spans bind the decision fingerprint', async () => {
  const { buildLexicalClassificationInventory, applyClassificationDecisions } = await ledger();
  const inventory = buildLexicalClassificationInventory({ repoRoot: ROOT });
  const root = structuredClone(inventory.roots.find((item) => item.resolved_entries.some((entry) => entry.claim?.evidence?.length)));
  const evidence = root.resolved_entries.find((entry) => entry.claim?.evidence?.length).claim.evidence[0];
  evidence.claim_evidence_id = `${evidence.claim_evidence_id}-mutated`;
  evidence.absolute_start += 1;
  const applied = applyClassificationDecisions({ ...inventory, roots: [root] }, {
    schema_version: 'STAGE_2Y_F_LEXICAL_DECISIONS/V1',
    decisions: [{ root_id: root.root_id, evidence_fingerprint: root.evidence_fingerprint, classification: 'AMBIGUOUS_NEEDS_REVIEW', rationale: 'Evidence changed.', reviewed_by: 'Ben', reviewed_on: '2026-08-09', review_question: 'What changed?' }],
  });
  assert.ok(applied.decision_validation_errors.includes('DECISION_STALE'));
});

test('same-concept decisions require complete known IDs and every decision requires reviewer metadata', async () => {
  const { buildLexicalClassificationInventory, applyClassificationDecisions } = await ledger();
  const inventory = buildLexicalClassificationInventory({ repoRoot: ROOT });
  const root = inventory.roots.find((item) => item.evidence_valid && item.disagreement_items.length && item.resolved_entries.length);
  const valid = {
    root_id: root.root_id,
    evidence_fingerprint: root.evidence_fingerprint,
    classification: 'SAME_CONCEPT_REPEAT',
    covered_claim_revision_ids: [...new Set(root.resolved_entries.map((entry) => entry.claim.claim_revision_id))].sort(),
    covered_disagreement_ids: root.disagreement_items.map((item) => item.disagreement_id).sort(),
    rationale: 'Each signal is already represented by the resolved claims.',
    reviewed_by: 'Ben',
    reviewed_on: '2026-08-09',
  };
  assert.equal(applyClassificationDecisions({ ...inventory, roots: [root] }, { schema_version: 'STAGE_2Y_F_LEXICAL_DECISIONS/V1', decisions: [valid] }).roots[0].classification, 'SAME_CONCEPT_REPEAT');
  const unknownRoot = { ...valid, root_id: 'UNKNOWN_ROOT' };
  const unknownResult = applyClassificationDecisions({ ...inventory, roots: [root] }, { schema_version: 'STAGE_2Y_F_LEXICAL_DECISIONS/V1', decisions: [unknownRoot] });
  assert.ok(unknownResult.decision_validation_errors.includes('DECISION_UNKNOWN_ROOT'));
  assert.equal(unknownResult.roots[0].classification, 'AMBIGUOUS_NEEDS_REVIEW');
  const foreign = structuredClone(valid);
  foreign.covered_claim_revision_ids.push('foreign');
  foreign.covered_disagreement_ids = foreign.covered_disagreement_ids.slice(1);
  foreign.rationale = '';
  foreign.reviewed_by = '';
  foreign.reviewed_on = '2026-02-30';
  const rejected = applyClassificationDecisions({ ...inventory, roots: [root] }, { schema_version: 'STAGE_2Y_F_LEXICAL_DECISIONS/V1', decisions: [foreign] });
  assert.ok(rejected.decision_validation_errors.includes('DECISION_SAME_CONCEPT_CLAIM_COVERAGE_MISMATCH'));
  assert.ok(rejected.decision_validation_errors.includes('DECISION_SAME_CONCEPT_DISAGREEMENT_COVERAGE_MISMATCH'));
  assert.ok(rejected.decision_validation_errors.includes('DECISION_RATIONALE_MISSING'));
  assert.ok(rejected.decision_validation_errors.includes('DECISION_REVIEWER_MISSING'));
  assert.ok(rejected.decision_validation_errors.includes('DECISION_REVIEW_DATE_INVALID'));
  const genuine = {
    root_id: root.root_id,
    evidence_fingerprint: root.evidence_fingerprint,
    classification: 'GENUINE_UNCAPTURED_ITEM',
    missing_item_description: 'A separate legal item requires extraction.',
    follow_up_id: 'FOLLOW-UP-1',
    proving_disagreement_ids: [root.disagreement_items[0].disagreement_id],
    rationale: 'The signal is not represented by a resolved claim.',
    reviewed_by: 'Ben',
    reviewed_on: '2026-08-09',
  };
  assert.equal(applyClassificationDecisions({ ...inventory, roots: [root] }, { schema_version: 'STAGE_2Y_F_LEXICAL_DECISIONS/V1', decisions: [genuine] }).roots[0].classification, 'GENUINE_UNCAPTURED_ITEM');
  delete genuine.proving_disagreement_ids;
  assert.ok(applyClassificationDecisions({ ...inventory, roots: [root] }, { schema_version: 'STAGE_2Y_F_LEXICAL_DECISIONS/V1', decisions: [genuine] }).decision_validation_errors.includes('DECISION_GENUINE_PROVING_DISAGREEMENT_IDS_INVALID'));
});

test('rendered output is deterministic when reviewed decisions are shuffled', async () => {
  const { buildLexicalClassificationInventory, applyClassificationDecisions, renderLexicalClassificationInventory } = await ledger();
  const inventory = buildLexicalClassificationInventory({ repoRoot: ROOT });
  const decisions = inventory.roots.slice(0, 2).map((root) => ({
    root_id: root.root_id,
    evidence_fingerprint: root.evidence_fingerprint,
    classification: 'AMBIGUOUS_NEEDS_REVIEW',
    rationale: 'A human review remains necessary.',
    reviewed_by: 'Ben',
    reviewed_on: '2026-08-09',
    review_question: 'Does this signal name a separate legal item?',
  }));
  const input = { schema_version: 'STAGE_2Y_F_LEXICAL_DECISIONS/V1', decisions };
  assert.equal(renderLexicalClassificationInventory(applyClassificationDecisions(inventory, input)), renderLexicalClassificationInventory(applyClassificationDecisions(inventory, { ...input, decisions: [...decisions].reverse() })));
});

test('self-contained adjudication review contains every root once and its exact decision keys', async () => {
  const { buildLexicalClassificationInventory, applyClassificationDecisions, renderLexicalClassificationReview } = await ledger();
  const inventory = applyClassificationDecisions(buildLexicalClassificationInventory({ repoRoot: ROOT }), {
    schema_version: 'STAGE_2Y_F_LEXICAL_DECISIONS/V1', decisions: [],
  });
  const review = renderLexicalClassificationReview(inventory);
  assert.match(review, /Content-Security-Policy/);
  assert.doesNotMatch(review, /https?:\/\//);
  assert.match(review, /id="family"/);
  assert.match(review, /id="state"/);
  assert.equal((review.match(/data-root-id=/g) || []).length, 164);
  const root = inventory.roots.find((item) => item.disagreement_items.length && item.compiled_candidates.length);
  assert.ok(root);
  assert.match(review, new RegExp(root.root_id));
  assert.match(review, new RegExp(root.evidence_fingerprint));
  assert.match(review, new RegExp(root.disagreement_items[0].disagreement_id));
  assert.match(review, new RegExp(root.disagreement_items[0].exact_hit_text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(review, new RegExp(root.compiled_candidates[0].candidate.claim.raw_value.slice(0, 20).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('write and allow-unreviewed check are mechanical green, while the ordinary review gate remains closed', () => {
  const script = path.join(ROOT, 'scripts/stage-2y-f-lexical-classification.mjs');
  const run = (args) => spawnSync(process.execPath, [script, ...args], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(run(['--write']).status, 0);
  assert.equal(fs.existsSync(path.join(ROOT, 'evidence/canonical-v2/stage-2y-f-lexical-classification.html')), true);
  const mechanical = run(['--check', '--allow-unreviewed']);
  assert.equal(mechanical.status, 0);
  assert.match(mechanical.stdout, /source linkage: 488 unique, 130 ambiguous, 17 not located, 635 total/);
  const ordinary = run(['--check']);
  assert.notEqual(ordinary.status, 0);
  assert.match(ordinary.stderr, /INCOMPLETE_REVIEW/);
  assert.doesNotMatch(ordinary.stderr, /STALE_OUTPUT|INVALID_INPUT|MALFORMED/);
});
