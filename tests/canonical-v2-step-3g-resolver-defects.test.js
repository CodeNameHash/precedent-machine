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
 * Also covers the hostile tests that live inline in candidate-resolution.js
 * rather than in a sibling lexicon file: the Material Contracts ANY-
 * threshold widening (defect 1, plus its word-numeral/superlative markers
 * from the post-merge review) and the General Covenants cross-code
 * double-fire routing rule (also from the post-merge review, condition 2b).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  resolveCandidates,
  MATERIAL_CONTRACT_ANY_THRESHOLD_CONTRADICTION,
} = require('../lib/canonical-v2/native-producer/candidate-resolution');
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
// Defect 1: Step 3G reduced Material Contracts from 16 open-world rows to 7
// by clearing 9 MATERIAL_CONTRACT_THRESHOLD_UNCORROBORATED rows. Step 2X-G
// later promoted the recurring NONCOMPETE shape, resolving the bucket and
// paired threshold claims from the same Modiv quote and reducing 7 to 5.
// ─────────────────────────────────────────────────────────────────────────
test('Material Contracts: Step 3G moves 16 to 7, then Step 2X-G NONCOMPETE moves 7 to 5', () => {
  const result = loadAndResolve('modiv-material-contracts-20260807-replay');
  const counts = reasonCounts(result.open_world);
  assert.equal(result.open_world.length, 5, 'expected 16 -> 5 (a reduction of 11)');
  assert.equal(counts.MATERIAL_CONTRACT_THRESHOLD_UNCORROBORATED, undefined, 'the ANY-threshold defect must be fully cleared for this run');
  // Two uncorroborated buckets and three genuine proposals remain after the
  // separate Step 2X-G NONCOMPETE promotion.
  assert.equal(counts.MATERIAL_CONTRACT_BUCKET_UNCORROBORATED, 2);
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

// HOSTILE (review condition 1). The first widening of this gate only caught
// DIGIT contradiction markers. Top-N-customer Material Contract buckets are
// routinely drafted in word numerals, not digits -- each of these four real
// drafting shapes must still be caught as a contradiction of "no threshold".
test('HOSTILE: word-numeral and superlative Material Contract threshold markers still contradict ANY', () => {
  assert.match('is a Contract with any of the ten largest customers or suppliers', MATERIAL_CONTRACT_ANY_THRESHOLD_CONTRADICTION);
  assert.match('each Contract with a top ten customer', MATERIAL_CONTRACT_ANY_THRESHOLD_CONTRADICTION);
  assert.match('in excess of two hundred fifty thousand dollars', MATERIAL_CONTRACT_ANY_THRESHOLD_CONTRADICTION);
  assert.match('five percent or more of consolidated revenues', MATERIAL_CONTRACT_ANY_THRESHOLD_CONTRADICTION);
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

// Step 3F1 (docs/core/PLAN.md, "give the marker a downstream contract"):
// "Also pin the behaviour change nobody claimed" -- replaying this same
// committed evidence, the two section 5.7 COV-PUBLICITY provisions resolve
// with party.capacity JOINT_MULTI_PARTY_CAPACITY, not the pre-Step-3F
// answer TARGET (the `company` pattern matching first inside "The Company
// and Parent, and their respective Subsidiaries" via the OLD whole-string
// scan). That is Step 3F's fix working -- TARGET was the wrong answer, a
// publicity covenant this text binds BOTH parties to -- but nothing pinned
// it end to end before this test, and Step 3G's own note above never
// mentions that committed resolved output for this family includes a
// joint-capacity party.
test('Step 3F1 pin: the two general-covenants COV-PUBLICITY provisions resolve JOINT_MULTI_PARTY_CAPACITY, not TARGET, end to end', () => {
  const result = loadAndResolve('modiv-general-covenants-20260807-replay');
  const publicityRows = result.resolved.filter((entry) => entry.concept_key === 'COV-PUBLICITY');
  assert.equal(publicityRows.length, 2, 'both 5.7 publicity provisions must resolve');
  for (const row of publicityRows) {
    assert.equal(row.source_citation, '5.7');
    assert.equal(row.party.role, 'COVENANT_OBLIGOR');
    assert.equal(row.party.value, 'The Company and Parent, and their respective Subsidiaries');
    assert.equal(row.party.capacity, 'JOINT_MULTI_PARTY');
    assert.notEqual(row.party.capacity, 'TARGET', 'the pre-Step-3F wrong answer must not reappear');
  }
});

test('Step 2X-B: Concho Takeover Laws clauses resolve the section-grounded all-Parties actor end to end', () => {
  const result = loadAndResolve('concho-general-covenants-20260808-r1');
  const takeoverRows = result.resolved.filter((entry) => entry.concept_key === 'COV-TAKEOVER');
  assert.equal(takeoverRows.length, 2);
  assert.deepEqual(
    takeoverRows.map((entry) => entry.claim.raw_value).sort(),
    [
      'None of the Parties will take any action that would cause the Transactions to be subject to requirements imposed by any Takeover Laws',
      'each of them will take all reasonable steps within its control to exempt (or ensure the continued exemption of) the Transactions from the Takeover Laws of any state that purport to apply to this Agreement or the Transactions',
    ].sort(),
  );
  for (const entry of takeoverRows) {
    assert.equal(entry.party.capacity, 'JOINT_MULTI_PARTY');
    assert.ok(entry.party.value === 'None of the Parties' || entry.party.value === 'each of them');
  }
  assert.equal(
    result.review_queue.some((entry) => entry.concept_family === 'COV-TAKEOVER'
      && entry.reasons.includes('PARTY_UNRESOLVED')),
    false,
  );
  assert.equal(result.open_world.some((entry) => entry.canonical_value === 'COV-TAKEOVER'), false);
});

test('Step 2X-B: Metsera Post-Closing SEC Reports clause resolves end to end', () => {
  const result = loadAndResolve('metsera-general-covenants-20260808-r1');
  const secReportRows = result.resolved.filter((entry) => entry.concept_key === 'COV-SECREPORT');
  assert.equal(secReportRows.length, 1);
  assert.equal(secReportRows[0].party.capacity, 'TARGET');
  assert.match(secReportRows[0].claim.raw_value, /^The Post-Closing SEC Reports provided by the Company/);
  assert.equal(result.open_world.some((entry) => entry.canonical_value === 'COV-SECREPORT'
    && entry.raw_value.startsWith('The Post-Closing SEC Reports provided by the Company')), false);
});

// DECISIONS.md §16 (lex specialis). A litigation-notice clause fires both
// COV-NOTIFY and COV-LITNOTIFY at the corroboration level — that is still
// true and still tested in canonical-v2-general-covenant-corroboration.
// The resolver no longer holds that pair forever: the more specific code
// wins, one row coded COV-LITNOTIFY, even when the model asserted NOTIFY.
test('HOSTILE: NOTIFY+LITNOTIFY dual-coding remaps to COV-LITNOTIFY (specificity), not review_queue', () => {
  const dir = path.join(EVIDENCE_ROOT, 'modiv-general-covenants-20260807-replay');
  const runReceipt = JSON.parse(fs.readFileSync(path.join(dir, 'run-receipt.json'), 'utf8'));
  const adapter = JSON.parse(fs.readFileSync(path.join(dir, 'adapter-result.json'), 'utf8'));
  const admittedSourceContext = adapter.admitted_source_contexts[0];

  const original = runReceipt.compiled_candidates.find((c) => {
    const claim = c.candidate && c.candidate.claim;
    return claim && claim.claim_definition_key === 'NATIVE_GENERAL_COVENANT_NOTIFY_PRESENT_CANDIDATE';
  });
  assert.ok(original, 'fixture must still contain a real COV-NOTIFY candidate');

  const forged = JSON.parse(JSON.stringify(original));
  forged.candidate.claim.raw_value = 'The Company shall promptly notify Parent of any Transaction Litigation '
    + 'of which it becomes aware.';

  const forgedReceipt = { ...runReceipt, compiled_candidates: [forged] };
  const result = resolveCandidates({
    run_receipt: forgedReceipt,
    contract_vocabulary: compileFixtureContractV38(),
    admitted_source_context: admittedSourceContext,
  });
  assert.equal(result.open_world.length, 0, 'specificity pair must not fall to open_world');
  assert.equal(result.resolved.length, 1);
  assert.equal(result.resolved[0].concept_key, 'COV-LITNOTIFY');
  assert.equal(result.resolved[0].claim.canonical_value, 'COV-LITNOTIFY');
  assert.equal(result.resolved[0].claim.attributes.covenant_code, 'COV-LITNOTIFY');
  assert.equal(result.resolved[0].claim.attributes.specificity_precedence_from, 'COV-NOTIFY');
  // Non-auto-pass resolved rows still appear on review_queue with
  // has_resolution true — that is not a DOUBLE_FIRE hold.
  const held = result.review_queue.filter((row) => row.has_resolution === false);
  assert.equal(held.length, 0, 'specificity pair must not produce an unresolved hold');
  assert.ok(
    !result.review_queue.some((row) => (row.reasons || []).includes('GENERAL_COVENANT_CODE_DOUBLE_FIRE')),
    'DOUBLE_FIRE must not fire on the ruled lex-specialis pair',
  );
});

test('HOSTILE: an asserted general-covenant code that misses while two other codes match keeps the ambiguity reason', () => {
  const dir = path.join(EVIDENCE_ROOT, 'modiv-general-covenants-20260807-replay');
  const runReceipt = JSON.parse(fs.readFileSync(path.join(dir, 'run-receipt.json'), 'utf8'));
  const adapter = JSON.parse(fs.readFileSync(path.join(dir, 'adapter-result.json'), 'utf8'));
  const admittedSourceContext = adapter.admitted_source_contexts[0];
  const original = runReceipt.compiled_candidates.find((entry) => (
    entry.candidate?.claim?.attributes?.covenant_code === 'COV-NOTIFY'
  ));
  assert.ok(original);

  const forged = structuredClone(original);
  forged.candidate.claim.raw_value = 'The Company shall give Parent reasonable access and issue a press release.';
  const result = resolveCandidates({
    run_receipt: { ...runReceipt, compiled_candidates: [forged] },
    contract_vocabulary: compileFixtureContractV38(),
    admitted_source_context: admittedSourceContext,
  });

  assert.equal(result.resolved.length, 0);
  assert.equal(result.open_world.length, 1);
  assert.equal(result.open_world[0].reason, 'AMBIGUOUS_GENERAL_COVENANT_CODE');
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
// Aggregate acceptance criterion: Step 3G alone falls by at least 30 from
// its re-measured baseline. Step 2X-G then removes two more Modiv Material
// Contracts claims without changing the other three family counts.
// ─────────────────────────────────────────────────────────────────────────
test('Step 3G reduces total open-world by at least 30, then Step 2X-G reduces it by two more', () => {
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
  const STEP_3G_AFTER_TOTAL = 7 + 1 + 18 + 6;
  let afterTotal = 0;
  for (const dirName of families) {
    afterTotal += loadAndResolve(dirName).open_world.length;
  }
  assert.equal(afterTotal, 5 + 1 + 18 + 6);
  const step3gReduction = BEFORE_TOTAL - STEP_3G_AFTER_TOTAL;
  assert.ok(step3gReduction >= 30, `expected Step 3G to reduce at least 30, got ${step3gReduction}`);
  assert.equal(STEP_3G_AFTER_TOTAL - afterTotal, 2);
});
