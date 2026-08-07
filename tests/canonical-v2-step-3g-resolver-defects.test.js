'use strict';

/**
 * tests/canonical-v2-step-3g-resolver-defects.test.js
 *
 * PLAN.md Step 3G: four located defects in candidate-resolution.js, each
 * fixed as a loosening of an over-narrow corroboration check. This file
 * proves each fix by replaying the relevant committed
 * `evidence/canonical-v2/<family>-20260807-replay` run through the REAL
 * `resolveCandidates` -- the run_receipt and admitted_source_context are
 * both loaded verbatim from the committed evidence directory, zero model
 * calls, zero reconstruction -- and comparing the open-world count and
 * reason breakdown against what the SAME committed run-receipt produces
 * through the code as it stood before this Step (recorded in comments
 * below, independently reproducible by checking out the parent commit and
 * rerunning `loadAndResolve`).
 *
 * Also covers the one hostile test that lives inline in
 * candidate-resolution.js rather than in a sibling lexicon file: the
 * Material Contracts ANY-threshold widening (defect 1).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { resolveCandidates } = require('../lib/canonical-v2/native-producer/candidate-resolution');
const { compileFixtureContractV38 } = require('../lib/canonical-v2/contract-bundle');

const EVIDENCE_ROOT = path.join(__dirname, '..', 'evidence', 'canonical-v2');

function loadAndResolve(dirName) {
  const dir = path.join(EVIDENCE_ROOT, dirName);
  const runReceipt = JSON.parse(fs.readFileSync(path.join(dir, 'run-receipt.json'), 'utf8'));
  const adapter = JSON.parse(fs.readFileSync(path.join(dir, 'adapter-result.json'), 'utf8'));
  const admittedSourceContext = adapter.admitted_source_contexts[0];
  return resolveCandidates({
    run_receipt: runReceipt,
    contract_vocabulary: compileFixtureContractV38(),
    admitted_source_context: admittedSourceContext,
  });
}

function reasonCounts(entries) {
  const out = {};
  for (const entry of entries) out[entry.reason] = (out[entry.reason] || 0) + 1;
  return out;
}

// ─────────────────────────────────────────────────────────────────────────
// Defect 1: Material Contracts ANY-threshold (line ~4071, pre-Step-3G).
// Before this fix: 16 open world, 9 of them MATERIAL_CONTRACT_THRESHOLD_
// UNCORROBORATED (every ANY-tagged threshold candidate in the run).
// ─────────────────────────────────────────────────────────────────────────
test('Material Contracts: modiv-material-contracts-20260807-replay open-world falls by 9, THRESHOLD_UNCORROBORATED clears to zero', () => {
  const result = loadAndResolve('modiv-material-contracts-20260807-replay');
  const counts = reasonCounts(result.open_world);
  assert.equal(result.open_world.length, 7, 'expected 16 -> 7 (a reduction of 9)');
  assert.equal(counts.MATERIAL_CONTRACT_THRESHOLD_UNCORROBORATED, undefined, 'the ANY-threshold defect must be fully cleared for this run');
  // Untouched by this fix: the bucket-corroboration gate (a separate,
  // already-widened check) and the model's own genuine open-world proposals.
  assert.equal(counts.MATERIAL_CONTRACT_BUCKET_UNCORROBORATED, 4);
  assert.equal(counts.NATIVE_OPEN_WORLD_PROPOSAL, 3);
});

test('HOSTILE: a real USD-threshold Material Contract quote does not corroborate as ANY, even if mistagged', () => {
  // Real filed text, evidence/canonical-v2/modiv-material-contracts-20260807-
  // replay: this is the REAL_ESTATE bucket's genuine USD threshold
  // candidate ($200,000), correctly tagged threshold_kind USD in the real
  // run. Feed the identical quote through resolveCandidates again, but with
  // threshold_kind forged to ANY/"Any" -- the shape of a genuinely wrong
  // candidate (a real numeric threshold, wrongly tagged as "no threshold").
  // The fix must still refuse it: the quote itself carries the dollar
  // marker that MATERIAL_CONTRACT_ANY_THRESHOLD_CONTRADICTION exists to
  // catch.
  const dir = path.join(EVIDENCE_ROOT, 'modiv-material-contracts-20260807-replay');
  const runReceipt = JSON.parse(fs.readFileSync(path.join(dir, 'run-receipt.json'), 'utf8'));
  const adapter = JSON.parse(fs.readFileSync(path.join(dir, 'adapter-result.json'), 'utf8'));
  const admittedSourceContext = adapter.admitted_source_contexts[0];

  const original = runReceipt.compiled_candidates.find((c) => {
    const claim = c.candidate && c.candidate.claim;
    return claim && claim.claim_definition_key === 'NATIVE_MATERIAL_CONTRACT_THRESHOLD_CANDIDATE'
      && claim.attributes && claim.attributes.bucket_code === 'REAL_ESTATE'
      && claim.attributes.threshold_kind === 'USD';
  });
  assert.ok(original, 'fixture must still contain the real REAL_ESTATE USD threshold candidate');
  assert.match(original.candidate.claim.raw_value, /\$200,000/);

  const forged = JSON.parse(JSON.stringify(original));
  forged.candidate.claim.attributes.threshold_kind = 'ANY';
  forged.candidate.claim.attributes.threshold_value = 'Any';
  forged.candidate.claim.canonical_value = 'ANY';

  const forgedReceipt = {
    ...runReceipt,
    compiled_candidates: [forged],
  };
  const result = resolveCandidates({
    run_receipt: forgedReceipt,
    contract_vocabulary: compileFixtureContractV38(),
    admitted_source_context: admittedSourceContext,
  });
  assert.equal(result.resolved.length, 0, 'a genuinely wrong ANY-tagged candidate must not resolve');
  assert.equal(result.open_world.length, 1);
  assert.equal(result.open_world[0].reason, 'MATERIAL_CONTRACT_THRESHOLD_UNCORROBORATED');
});

// ─────────────────────────────────────────────────────────────────────────
// Defect 2: General Covenants lexicon (general-covenant-corroboration.js
// carries its own hostile tests -- tests/canonical-v2-general-covenant-
// corroboration.test.js). This is the family-level before/after proof.
// Before this fix: 12 open world, 11 GENERAL_COVENANT_CODE_UNCORROBORATED
// (the family resolved zero).
// ─────────────────────────────────────────────────────────────────────────
test('General Covenants: modiv-general-covenants-20260807-replay open-world falls by 11, family stops resolving zero', () => {
  const result = loadAndResolve('modiv-general-covenants-20260807-replay');
  const counts = reasonCounts(result.open_world);
  assert.equal(result.open_world.length, 1, 'expected 12 -> 1 (a reduction of 11)');
  assert.equal(counts.GENERAL_COVENANT_CODE_UNCORROBORATED, undefined, 'the label/alias defect must be fully cleared for this run');
  assert.equal(counts.NATIVE_OPEN_WORLD_PROPOSAL, 1);
  assert.ok(result.resolved.length > 0, 'the family must stop resolving zero (PLAN.md Step 3G symptom)');
});

// ─────────────────────────────────────────────────────────────────────────
// Defect 3: Representations ACCURACY REVIEW-routing.
// Before this fix: 28 open world (10 REPRESENTATION_QUALIFIER_KIND_NOT_EXACT,
// 9 REPRESENTATION_QUALIFIER_KIND_NOT_GOVERNED, 9 NATIVE_OPEN_WORLD_PROPOSAL
// prose declines).
// ─────────────────────────────────────────────────────────────────────────
test('Representations: modiv-representations-20260807-replay open-world falls by 10, NOT_EXACT clears, everything else untouched', () => {
  const result = loadAndResolve('modiv-representations-20260807-replay');
  const openCounts = reasonCounts(result.open_world);
  assert.equal(result.open_world.length, 18, 'expected 28 -> 18 (a reduction of 10)');
  assert.equal(openCounts.REPRESENTATION_QUALIFIER_KIND_NOT_EXACT, undefined, 'the REVIEW-misrouting defect must be fully cleared for this run');
  // NOT this fix's territory (PLAN.md Step 3H: "Representations' temporal
  // and threshold qualifiers") -- must be untouched.
  assert.equal(openCounts.REPRESENTATION_QUALIFIER_KIND_NOT_GOVERNED, 9);
  // The 9 prose declines -- the model itself said the text is not a
  // qualifier -- are correct and must stay in open world, untouched.
  assert.equal(openCounts.NATIVE_OPEN_WORLD_PROPOSAL, 9);

  // The 10 that moved landed in review_queue, not silently resolved: this
  // is a routing fix, never an auto-pass. Every one keeps has_resolution
  // false and carries a real classifyQualifierQuote REVIEW reason.
  assert.equal(result.review_queue.length, 10);
  for (const item of result.review_queue) {
    assert.equal(item.has_resolution, false);
    assert.equal(item.auto_pass, false);
    assert.ok(['REP-T-QUALIFIER', 'REP-B-QUALIFIER'].includes(item.concept_key));
    assert.ok(item.reasons.length >= 1);
  }
  assert.equal(result.resolved.length, 0, 'REVIEW routing must never resolve a candidate outright');
});

test('HOSTILE: the 9 real prose-decline open-world entries are unaffected, and none of them silently became a review-queue item', () => {
  const result = loadAndResolve('modiv-representations-20260807-replay');
  const proseDeclines = result.open_world.filter((entry) => entry.reason === 'NATIVE_OPEN_WORLD_PROPOSAL');
  assert.equal(proseDeclines.length, 9);
  const reviewRawValues = new Set(result.review_queue.map((item) => item.raw_value));
  for (const entry of proseDeclines) {
    assert.equal(reviewRawValues.has(entry.raw_value), false, 'a genuine prose decline must not also appear in review_queue');
  }
});

// ─────────────────────────────────────────────────────────────────────────
// Defect 4: Tax Matters cooperation lexicon (tax-cooperation-corroboration.js
// carries its own hostile tests -- tests/canonical-v2-tax-cooperation-
// corroboration.test.js). This is the family-level before/after proof.
// Before this fix: 11 open world (3 TAX_TREATMENT_KIND_UNCORROBORATED, 7
// TAX_ASSERTION_OPEN_WORLD, 1 non-native NATIVE_OPEN_WORLD_PROPOSAL).
// Step 3H's territory (the remaining TAX_ASSERTION_OPEN_WORLD entries and
// TAX_TREATMENT_KIND_UNCORROBORATED, an unrelated INTENDED_TREATMENT-kind
// defect this Step never targeted) is explicitly NOT expected to clear.
// ─────────────────────────────────────────────────────────────────────────
test('Tax Matters: modiv-tax-matters-20260807-replay open-world falls by 5 (TAX_OPINION_COOPERATION + TRANSFER_COOPERATION), rest untouched', () => {
  const result = loadAndResolve('modiv-tax-matters-20260807-replay');
  const counts = reasonCounts(result.open_world);
  assert.equal(result.open_world.length, 6, 'expected 11 -> 6 (a reduction of 5)');
  // Untouched: INTENDED_TREATMENT's own defect (a different code path this
  // Step never targeted) and Step 3H's TAX_ASSERTION_OPEN_WORLD remainder
  // (TREATMENT_PROTECTION's REIT-status quotes, which this defect's fix
  // never touches; and the one non-native OPEN_WORLD_PROPOSITION entry).
  assert.equal(counts.TAX_TREATMENT_KIND_UNCORROBORATED, 3);
  assert.equal(counts.TAX_ASSERTION_OPEN_WORLD, 2);
  assert.equal(counts.NATIVE_OPEN_WORLD_PROPOSAL, 1);
  assert.equal(result.resolved.length, 5, 'the 4 TAX_OPINION_COOPERATION + 1 TRANSFER_COOPERATION candidates now resolve');
});

// ─────────────────────────────────────────────────────────────────────────
// Aggregate acceptance criterion: total open-world across the four families
// falls by at least 30 of the (this Step's own re-measured) baseline.
// ─────────────────────────────────────────────────────────────────────────
test('Total open-world across the four Step 3G families falls by at least 30', () => {
  const families = [
    'modiv-material-contracts-20260807-replay',
    'modiv-general-covenants-20260807-replay',
    'modiv-representations-20260807-replay',
    'modiv-tax-matters-20260807-replay',
  ];
  // Independently re-measured baseline (BEFORE this Step's fixes), fixed
  // here as a plain number rather than re-derived from git history: 16 + 12
  // + 28 + 11 = 67. Cross-checked against each family's own before/after
  // test above, which each restate their own family's "before" number in a
  // comment.
  const BEFORE_TOTAL = 16 + 12 + 28 + 11;
  let afterTotal = 0;
  for (const dirName of families) {
    afterTotal += loadAndResolve(dirName).open_world.length;
  }
  assert.equal(afterTotal, 7 + 1 + 18 + 6);
  const reduction = BEFORE_TOTAL - afterTotal;
  assert.ok(reduction >= 30, `expected a reduction of at least 30, got ${reduction} (before ${BEFORE_TOTAL}, after ${afterTotal})`);
});
