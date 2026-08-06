'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { buildSecEdgarIntakeCapture } = require('../lib/canonical-v2/sec-edgar-intake-capture');
const { convertSecHtmlToCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text');
const { sectionizeAdmittedSource, findSectionByReference } = require('../lib/canonical-v2/native-producer/deterministic-sectionizer');
const {
  buildPromptBudgetSplitPreflight,
  resolvePromptBudgetSplitWorkItems,
} = require('../lib/canonical-v2/native-producer/prompt-budget-split-preflight');

const ROOT = path.resolve(__dirname, '..');
const URL = 'https://www.sec.gov/Archives/edgar/data/1/prompt-budget-split.htm';
const RETRIEVAL_POLICY_DIGEST = sha256Hex('prompt-budget-split-preflight fixture policy');

function material(relativePath) {
  const raw = fs.readFileSync(path.resolve(ROOT, relativePath));
  const capture = buildSecEdgarIntakeCapture({
    retrieval_url: URL,
    final_url: URL,
    status_code: 200,
    content_type: 'text/html; charset=UTF-8',
    retrieved_at: '2026-08-04T00:00:00.000Z',
    retrieval_policy_digest: RETRIEVAL_POLICY_DIGEST,
    redirect_count: 0,
    response_bytes: raw,
  });
  const conversion = convertSecHtmlToCanonicalText(capture);
  return Object.freeze({
    document_hash: sha256Hex(raw),
    canonical_text: conversion.canonical_text,
    tree: sectionizeAdmittedSource({
      source_text: conversion.canonical_text,
      document_hash: sha256Hex(raw),
    }),
  });
}

function resolve(input, reference, ceiling = 65536) {
  const node = findSectionByReference(input.tree, reference);
  assert.ok(node, `fixture must contain ${reference}`);
  return resolvePromptBudgetSplitWorkItems({
    source_id: 'fixture-source',
    occurrence_id: 'fixture-occurrence',
    document_hash: input.document_hash,
    canonical_text: input.canonical_text,
    tree: input.tree,
    node,
    prompt_budget_policy: { prompt_byte_ceiling: ceiling },
  });
}

// Retargeted on 2026-08-05 from "III-INTRO" to "3.1", for a reason that is the
// point of the test rather than an accident of it.
//
// This test proves an oversized section is split at boundaries that already
// exist, instead of at arbitrary byte offsets. It used to demonstrate that on
// III-INTRO, because the Article III chapeau was swallowing the entire article,
// roughly 131 KB, and minting lettered children of its own. That was a
// sectionizer defect: TopBuild's Sections 3.1 and 3.2 have titles longer than
// the old 78-character heading cap, so neither was ever recognised.
//
// With the cap raised, III-INTRO shrinks from about 131 KB to 43 bytes, which
// is what an article chapeau should be, so asserting that it needs splitting
// would now be asserting the bug.
//
// Retargeting at Section 3.1, the genuinely oversized node at about 84 KB,
// revealed something the phantom tree had been hiding, and it is the reason
// this test now pins a refusal rather than a split. Section 3.1 is the
// Company's representations, so it is classified REPRESENTATIONS, and that
// family has no complete-relevant-byte accounting. The splitter therefore
// declines to divide it at all, reporting
// BLOCKED_CHILD_RELEVANT_COVERAGE_LOSS, because it cannot prove the pieces
// would still cover everything that matters. That is the correct, conservative
// answer, and it was previously unreachable: the phantom node carried only
// MAE_DEFINITION, for which coverage IS provable, so the old tree got a split
// it had not earned.
//
// Note what the splitter still gets right in the same breath: MAE coverage is
// complete, one relevant fact of one, via the defined-term anchor. It is not
// failing to understand the section, it is refusing to act on a family it
// cannot fully account for.
//
// The ordinary split-at-existing-child-boundaries property is unaffected and
// remains covered by the Modiv 8.12 test below, which is why it is not
// re-proved here.
test('TopBuild 3.1 refuses to split a representations section it cannot fully account for', () => {
  const topbuild = material('tests/fixtures/canonical-v2/mae-definition-family/topbuild-raw-fetched.htm');
  const node = findSectionByReference(topbuild.tree, '3.1');
  assert.ok(node, 'Section 3.1 must exist: its absence, swallowed by the Article III chapeau, was the original defect');
  assert.ok(node.end - node.start > 65536, 'Section 3.1 must be over the ceiling for this test to mean anything');
  const result = buildPromptBudgetSplitPreflight({
    source_id: 'topbuild', document_hash: topbuild.document_hash,
    canonical_text: topbuild.canonical_text, tree: topbuild.tree, nodes: [node],
    prompt_budget_policy: { prompt_byte_ceiling: 65536 },
  });

  assert.equal(result.status, 'BLOCKED_IRREDUCIBLE');
  const resolution = result.resolutions[0];
  assert.equal(resolution.status, 'BLOCKED_IRREDUCIBLE');
  assert.deepEqual(resolution.work_items, [], 'no work item may be issued when the split is refused');

  const blocker = resolution.blockers[0];
  assert.equal(blocker.code, 'BLOCKED_CHILD_RELEVANT_COVERAGE_LOSS');
  assert.equal(blocker.reason, 'COMPLETE_RELEVANT_BYTE_ACCOUNTING_UNAVAILABLE');
  assert.deepEqual(blocker.family_ids, ['REPRESENTATIONS']);

  // The refusal is specific, not blanket: MAE is fully covered even so.
  const mae = resolution.coverage.find((entry) => entry.family_id === 'MAE_DEFINITION');
  assert.ok(mae, 'MAE coverage must still be computed');
  assert.equal(mae.relevant_fact_count, 1);
  assert.equal(mae.covered_relevant_fact_count, 1);
});

test('Skechers 1.1 resolves the real Certain Definitions section and covers MAE_DEFINITION directly', () => {
  // Regression note: this used to resolve "I-INTRO" instead, because the
  // deterministic sectionizer's article-chapeau node swallowed the whole,
  // un-anchored "1.1 Certain Definitions." body (Skechers numbers its
  // sections inline, with no "Section" prefix or blank-line anchor — see
  // INLINE_DECIMAL_HEADING_RE in deterministic-sectionizer.js). "I-INTRO"
  // wrongly owned the Company Material Adverse Effect definition (clause
  // (r)) as "I-INTRO(r)", requiring a split to reach it. Now that the
  // sectionizer clips the stale INTRO node at the real "1.1" boundary
  // (see reconcileStaleArticleChildren), "1.1" resolves to its own real,
  // correctly-bounded 50,736-byte span, which fits under the ceiling as a
  // single work item — no split needed to reach the MAE definition.
  const skechers = material('tests/fixtures/canonical-v2/skechers-first-live-run/skechers-raw-fetched.htm');
  const introNode = findSectionByReference(skechers.tree, 'I-INTRO');
  assert.ok(introNode, 'I-INTRO must still resolve (now just the true, tiny chapeau before 1.1)');
  const node = findSectionByReference(skechers.tree, '1.1');
  assert.ok(node.start >= introNode.end, '1.1 must start at or after the clipped I-INTRO end, never overlapping it');
  assert.match(node.heading, /definitions/i);
  const result = buildPromptBudgetSplitPreflight({
    source_id: 'skechers', document_hash: skechers.document_hash,
    canonical_text: skechers.canonical_text, tree: skechers.tree, nodes: [node],
    prompt_budget_policy: { prompt_byte_ceiling: 65536 },
  });

  assert.equal(result.status, 'PASS');
  assert.deepEqual(result.tree_integrity_blockers, []);
  assert.equal(result.resolutions[0].status, 'WITHIN_POLICY');
  assert.deepEqual(
    result.work_items.filter((item) => item.family_id === 'MAE_DEFINITION').map((item) => item.section_reference),
    ['1.1'],
  );
});

test('Modiv 8.12 keeps the under-ceiling Key Defined Terms parent call and splits only MAE', () => {
  const modiv = material('tests/fixtures/canonical-v2/mae-definition-family/modiv-raw-fetched.htm');
  // 65,000 bytes is an execution policy used to exercise the near-ceiling
  // branch. The production ceiling remains owned by the downstream checker.
  const result = resolve(modiv, '8.12', 65000);

  assert.equal(result.status, 'SPLIT');
  assert.ok(result.work_items.some((item) => (
    item.family_id === 'MAE_DEFINITION' && item.section_reference === '8.12(g)'
  )));
  assert.deepEqual(
    result.work_items.filter((item) => item.family_id === 'KEY_DEFINED_TERMS').map((item) => item.section_reference),
    ['8.12'],
  );
  assert.ok(result.work_items.every((item) => item.prompt_byte_length <= item.prompt_byte_ceiling));
});

test('Modiv 8.12 passes the real aggregate preflight with complete MAE anchor coverage', () => {
  const modiv = material('tests/fixtures/canonical-v2/mae-definition-family/modiv-raw-fetched.htm');
  const node = findSectionByReference(modiv.tree, '8.12');
  const result = buildPromptBudgetSplitPreflight({
    source_id: 'modiv',
    document_hash: modiv.document_hash,
    canonical_text: modiv.canonical_text,
    tree: modiv.tree,
    nodes: [node],
    prompt_budget_policy: { prompt_byte_ceiling: 65000 },
  });

  assert.equal(result.status, 'PASS');
  assert.equal(result.resolutions[0].status, 'SPLIT');
  assert.deepEqual(result.tree_integrity_blockers, []);
  assert.deepEqual(
    result.work_items.filter((item) => item.family_id === 'MAE_DEFINITION')
      .map((item) => item.section_reference),
    ['8.12(g)', '8.12(z)'],
  );
  const maeCoverage = result.resolutions[0].coverage.find((item) => item.family_id === 'MAE_DEFINITION');
  assert.equal(maeCoverage.relevant_fact_count, 2);
  assert.equal(maeCoverage.covered_relevant_fact_count, 2);
  assert.deepEqual(maeCoverage.uncovered_relevant_offsets, []);
});

test('an under-ceiling child remains one work item and is not split', () => {
  const modiv = material('tests/fixtures/canonical-v2/mae-definition-family/modiv-raw-fetched.htm');
  const result = resolve(modiv, '8.12(g)');

  assert.equal(result.status, 'WITHIN_POLICY');
  assert.ok(result.work_items.length >= 1);
  assert.ok(result.work_items.every((item) => item.section_reference === '8.12(g)'));
});

test('an unselected overlapping representation is recorded but does not block the chosen tree', () => {
  // Regression note: this used to reproduce on the real Skechers fixture,
  // where "I-INTRO" wholly contained "1.1" (the deterministic sectionizer's
  // article-chapeau node had swallowed the whole un-anchored 1.1 body — see
  // the "Skechers 1.1 resolves..." test above). That overlap no longer
  // exists once the sectionizer clips stale INTRO nodes at the real first
  // section boundary (reconcileStaleArticleChildren), so this scenario is
  // reconstructed synthetically here: it exercises
  // ALTERNATE_OVERLAPPING_REPRESENTATION_EXCLUDED — the "one sibling wholly
  // contains another and only one of them is selected" path — independent
  // of any one fixture happening to still contain a live overlap.
  const canonicalText = 'Material Adverse Effect means one event and another event.';
  const documentHash = sha256Hex(canonicalText);
  const fullLen = Buffer.byteLength(canonicalText, 'utf8');
  const parent = Object.freeze({
    section_id: 'parent', reference: '1', parent_section_id: null, kind: 'ARTICLE', depth: 1,
    heading: 'Definitions', article_context: 'DEFINITIONS', start: 0, end: fullLen, text_sha256: sha256Hex(canonicalText),
  });
  // `outer` mirrors a stale article-chapeau node that still spans its
  // sibling's entire range; `inner` mirrors the real, correctly-bounded
  // section it wrongly overlaps. Only `outer` is selected, so the overlap
  // is between one selected and one unselected node — the EXCLUDED
  // observation path, not the hard BLOCKED_TREE_INTEGRITY path (that path
  // is covered by "overlapping siblings inside the selected subtree fail
  // closed" below, where both overlapping nodes are selected).
  const outer = Object.freeze({
    section_id: 'outer', reference: '1-INTRO', parent_section_id: 'parent', kind: 'SECTION', depth: 2,
    heading: 'General Introduction', article_context: 'DEFINITIONS', start: 0, end: fullLen, text_sha256: sha256Hex(canonicalText),
  });
  const innerText = Buffer.from(canonicalText, 'utf8').subarray(10).toString('utf8');
  const inner = Object.freeze({
    section_id: 'inner', reference: '1.1', parent_section_id: 'parent', kind: 'SECTION', depth: 2,
    heading: 'Material Adverse Effect', article_context: 'DEFINITIONS', start: 10, end: fullLen, text_sha256: sha256Hex(innerText),
  });
  const result = buildPromptBudgetSplitPreflight({
    source_id: 'synthetic',
    document_hash: documentHash,
    canonical_text: canonicalText,
    tree: Object.freeze({ nodes: Object.freeze([parent, outer, inner]) }),
    nodes: [outer],
    prompt_budget_policy: { prompt_byte_ceiling: 65536 },
  });

  assert.equal(result.status, 'PASS');
  assert.deepEqual(result.tree_integrity_blockers, []);
  assert.ok(result.tree_integrity_observations.some((observation) => (
    observation.code === 'ALTERNATE_OVERLAPPING_REPRESENTATION_EXCLUDED'
    && [observation.left_reference, observation.right_reference].includes('1-INTRO')
    && [observation.left_reference, observation.right_reference].includes('1.1')
  )));
});

test('overlapping siblings inside the selected subtree fail closed before any work item is issued', () => {
  const canonicalText = 'Material Adverse Effect means one event and another event.';
  const documentHash = sha256Hex(canonicalText);
  const parent = Object.freeze({
    section_id: 'parent', reference: '1.1', parent_section_id: null, kind: 'SECTION', depth: 1,
    heading: 'Material Adverse Effect', article_context: 'DEFINITIONS', start: 0,
    end: Buffer.byteLength(canonicalText, 'utf8'), text_sha256: sha256Hex(canonicalText),
  });
  const leftText = Buffer.from(canonicalText, 'utf8').subarray(0, 40).toString('utf8');
  const rightText = Buffer.from(canonicalText, 'utf8').subarray(30).toString('utf8');
  const left = Object.freeze({
    section_id: 'left', reference: '1.1(a)', parent_section_id: 'parent', kind: 'SUBSECTION', depth: 2,
    heading: null, article_context: 'DEFINITIONS', start: 0, end: 40, text_sha256: sha256Hex(leftText),
  });
  const right = Object.freeze({
    section_id: 'right', reference: '1.1(b)', parent_section_id: 'parent', kind: 'SUBSECTION', depth: 2,
    heading: null, article_context: 'DEFINITIONS', start: 30,
    end: Buffer.byteLength(canonicalText, 'utf8'), text_sha256: sha256Hex(rightText),
  });
  const result = buildPromptBudgetSplitPreflight({
    source_id: 'synthetic', document_hash: documentHash, canonical_text: canonicalText,
    tree: Object.freeze({ nodes: Object.freeze([parent, left, right]) }), nodes: [parent],
    prompt_budget_policy: { prompt_byte_ceiling: 65536 },
  });

  assert.equal(result.status, 'BLOCKED_TREE_INTEGRITY');
  assert.deepEqual(result.work_items, []);
  assert.equal(result.tree_integrity_blockers.length, 1);
});

test('an oversized leaf fails closed without truncation', () => {
  const canonicalText = `Material Adverse Effect means ${'x'.repeat(70000)}`;
  const documentHash = sha256Hex(canonicalText);
  const node = Object.freeze({
    section_id: 'leaf', reference: '1.1', parent_section_id: null, kind: 'SECTION', depth: 1,
    heading: 'Material Adverse Effect', article_context: 'DEFINITIONS', start: 0,
    end: Buffer.byteLength(canonicalText, 'utf8'), text_sha256: sha256Hex(canonicalText),
  });
  const tree = Object.freeze({ nodes: Object.freeze([node]) });
  const result = resolvePromptBudgetSplitWorkItems({
    source_id: 'synthetic', document_hash: documentHash, canonical_text: canonicalText,
    tree, node, prompt_budget_policy: { prompt_byte_ceiling: 65536 },
  });

  assert.equal(result.status, 'BLOCKED_IRREDUCIBLE');
  assert.deepEqual(result.work_items, []);
  assert.deepEqual(result.blockers.map((blocker) => blocker.code), ['BLOCKED_IRREDUCIBLE']);
});

test('a child preserves the party scope inherited from its existing parent section', () => {
  const canonicalText = 'Parent shall operate its business in the ordinary course.';
  const documentHash = sha256Hex(canonicalText);
  const parent = Object.freeze({
    section_id: 'parent', reference: '4.1', parent_section_id: null, kind: 'SECTION', depth: 1,
    heading: 'Conduct of Business by Parent', article_context: 'INTERIM_OPERATING', start: 0,
    end: Buffer.byteLength(canonicalText, 'utf8'), text_sha256: sha256Hex(canonicalText),
  });
  const child = Object.freeze({
    section_id: 'child', reference: '4.1(a)', parent_section_id: 'parent', kind: 'SUBSECTION', depth: 2,
    heading: null, article_context: 'INTERIM_OPERATING', start: 0,
    end: Buffer.byteLength(canonicalText, 'utf8'), text_sha256: sha256Hex(canonicalText),
  });
  const tree = Object.freeze({ nodes: Object.freeze([parent, child]) });
  const result = resolvePromptBudgetSplitWorkItems({
    source_id: 'synthetic', document_hash: documentHash, canonical_text: canonicalText,
    tree, node: child, prompt_budget_policy: { prompt_byte_ceiling: 65536 },
  });

  assert.equal(result.status, 'WITHIN_POLICY');
  assert.ok(result.work_items.some((item) => (
    item.family_id === 'INTERIM_OPERATING' && item.covenant_side === 'BUYER'
    && item.section_reference === '4.1(a)'
  )));
});

test('the splitter has no provider, transport, database or UI dependency', () => {
  const sourceText = fs.readFileSync(path.join(ROOT, 'lib/canonical-v2/native-producer/prompt-budget-split-preflight.js'), 'utf8');
  assert.doesNotMatch(sourceText, /provider-interface|anthropic-provider|codex-cli-provider|node:https|node:http|\bfetch\s*\(|supabase|next\//);
});
