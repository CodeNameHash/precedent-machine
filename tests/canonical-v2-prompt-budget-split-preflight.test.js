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

test('TopBuild III-INTRO splits MAE work at existing child boundaries', () => {
  const topbuild = material('tests/fixtures/canonical-v2/mae-definition-family/topbuild-raw-fetched.htm');
  const node = findSectionByReference(topbuild.tree, 'III-INTRO');
  const result = buildPromptBudgetSplitPreflight({
    source_id: 'topbuild', document_hash: topbuild.document_hash,
    canonical_text: topbuild.canonical_text, tree: topbuild.tree, nodes: [node],
    prompt_budget_policy: { prompt_byte_ceiling: 65536 },
  });

  assert.equal(result.status, 'PASS');
  assert.equal(result.resolutions[0].status, 'SPLIT');
  assert.ok(result.work_items.some((item) => (
    item.family_id === 'MAE_DEFINITION' && item.section_reference === 'III-INTRO(a)'
  )));
  assert.ok(result.work_items.every((item) => item.prompt_byte_length <= item.prompt_byte_ceiling));
  assert.ok(result.work_items.every((item) => item.work_item_id));
});

test('Skechers I-INTRO splits MAE work to existing child I-INTRO(r)', () => {
  const skechers = material('tests/fixtures/canonical-v2/skechers-first-live-run/skechers-raw-fetched.htm');
  const node = findSectionByReference(skechers.tree, 'I-INTRO');
  const result = buildPromptBudgetSplitPreflight({
    source_id: 'skechers', document_hash: skechers.document_hash,
    canonical_text: skechers.canonical_text, tree: skechers.tree, nodes: [node],
    prompt_budget_policy: { prompt_byte_ceiling: 65536 },
  });

  assert.equal(result.status, 'PASS');
  assert.equal(result.resolutions[0].status, 'SPLIT');
  assert.deepEqual(
    result.work_items.filter((item) => item.family_id === 'MAE_DEFINITION').map((item) => item.section_reference),
    ['I-INTRO(r)'],
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

test('an unselected overlapping representation is recorded but does not block the chosen Skechers tree', () => {
  const skechers = material('tests/fixtures/canonical-v2/skechers-first-live-run/skechers-raw-fetched.htm');
  const result = buildPromptBudgetSplitPreflight({
    source_id: 'skechers',
    document_hash: skechers.document_hash,
    canonical_text: skechers.canonical_text,
    tree: skechers.tree,
    nodes: [findSectionByReference(skechers.tree, 'I-INTRO')],
    prompt_budget_policy: { prompt_byte_ceiling: 65536 },
  });

  assert.equal(result.status, 'PASS');
  assert.deepEqual(result.tree_integrity_blockers, []);
  assert.ok(result.tree_integrity_observations.some((observation) => (
    observation.code === 'ALTERNATE_OVERLAPPING_REPRESENTATION_EXCLUDED'
    && [observation.left_reference, observation.right_reference].includes('I-INTRO')
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
