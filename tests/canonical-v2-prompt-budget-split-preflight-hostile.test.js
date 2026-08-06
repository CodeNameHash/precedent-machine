'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { compileDecisionReconciliationProposal } = require('../lib/canonical-v2/decision-reconciliation-proposal');
const { buildCurrentSuccessorM1ReadinessPacket } = require('../lib/canonical-v2/successor-m1-readiness-packet');
const { buildSecEdgarIntakeCapture } = require('../lib/canonical-v2/sec-edgar-intake-capture');
const { convertSecHtmlToCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text');
const {
  findSectionByReference,
  sectionizeAdmittedSource,
} = require('../lib/canonical-v2/native-producer/deterministic-sectionizer');
const {
  resolvePromptBudgetSplitWorkItems,
} = require('../lib/canonical-v2/native-producer/prompt-budget-split-preflight');

const ROOT = path.resolve(__dirname, '..');
const SEC_URL = 'https://www.sec.gov/Archives/edgar/data/1/prompt-budget-hostile.htm';

function node({ id, reference, parent = null, heading, articleContext, text, start = 0, end = Buffer.byteLength(text, 'utf8') }) {
  return Object.freeze({
    section_id: id,
    reference,
    parent_section_id: parent,
    kind: parent ? 'SUBSECTION' : 'SECTION',
    depth: parent ? 2 : 1,
    heading,
    article_context: articleContext,
    start,
    end,
    text_sha256: sha256Hex(Buffer.from(text, 'utf8').subarray(start, end)),
  });
}

function resolveSynthetic({ text, nodes, selected, documentHash = sha256Hex(text), ceiling = 65536 }) {
  return resolvePromptBudgetSplitWorkItems({
    tree: Object.freeze({ nodes: Object.freeze(nodes) }),
    canonical_text: text,
    document_hash: documentHash,
    node: selected,
    prompt_budget_policy: { prompt_byte_ceiling: ceiling },
  });
}

function material(relativePath) {
  const raw = fs.readFileSync(path.join(ROOT, relativePath));
  const capture = buildSecEdgarIntakeCapture({
    retrieval_url: SEC_URL,
    final_url: SEC_URL,
    status_code: 200,
    content_type: 'text/html; charset=UTF-8',
    retrieved_at: '2026-08-04T00:00:00.000Z',
    retrieval_policy_digest: sha256Hex('prompt-budget hostile fixture policy'),
    redirect_count: 0,
    response_bytes: raw,
  });
  const conversion = convertSecHtmlToCanonicalText(capture);
  const documentHash = sha256Hex(raw);
  return Object.freeze({
    document_hash: documentHash,
    canonical_text: conversion.canonical_text,
    tree: sectionizeAdmittedSource({
      source_text: conversion.canonical_text,
      document_hash: documentHash,
    }),
  });
}

test('a split retains an under-ceiling parent-family call and splits only the over-ceiling family', () => {
  const modiv = material('tests/fixtures/canonical-v2/mae-definition-family/modiv-raw-fetched.htm');
  const selected = findSectionByReference(modiv.tree, '8.12');
  assert.ok(selected);
  const baseline = resolvePromptBudgetSplitWorkItems({
    tree: modiv.tree,
    canonical_text: modiv.canonical_text,
    document_hash: modiv.document_hash,
    node: selected,
    prompt_budget_policy: { prompt_byte_ceiling: 10_000_000 },
  });
  const keyTerms = baseline.work_items.find((item) => item.family_id === 'KEY_DEFINED_TERMS');
  const mae = baseline.work_items.find((item) => item.family_id === 'MAE_DEFINITION');
  assert.ok(keyTerms && mae && keyTerms.prompt_byte_length < mae.prompt_byte_length);

  const result = resolvePromptBudgetSplitWorkItems({
    tree: modiv.tree,
    canonical_text: modiv.canonical_text,
    document_hash: modiv.document_hash,
    node: selected,
    prompt_budget_policy: {
      prompt_byte_ceiling: Math.floor((keyTerms.prompt_byte_length + mae.prompt_byte_length) / 2),
    },
  });

  assert.equal(result.status, 'SPLIT');
  assert.deepEqual(
    result.work_items.filter((item) => item.family_id === 'KEY_DEFINED_TERMS').map((item) => item.section_reference),
    ['8.12'],
  );
  assert.ok(result.work_items.some((item) => item.family_id === 'MAE_DEFINITION' && item.section_reference !== '8.12'));
});

test('a child cannot silently discard uncovered parent bytes containing another fact in the same family', () => {
  const omitted = `Material Adverse Effect means ${'x'.repeat(70_000)}.\n`;
  const retained = 'Parent Material Adverse Effect means a material adverse effect on Parent.';
  const text = `${omitted}${retained}`;
  const parent = node({
    id: 'parent', reference: '1.1', heading: 'Material Adverse Effect',
    articleContext: 'DEFINITIONS', text,
  });
  const child = node({
    id: 'child', reference: '1.1(a)', parent: 'parent', heading: 'Material Adverse Effect',
    articleContext: 'DEFINITIONS', text, start: Buffer.byteLength(omitted, 'utf8'),
  });
  const result = resolveSynthetic({ text, nodes: [parent, child], selected: parent });

  assert.notEqual(result.status, 'SPLIT');
  assert.deepEqual(result.work_items, []);
  assert.ok(result.blockers.length > 0);
});

test('a child inherits the exact covenant party from parent text when the heading is generic', () => {
  const prefix = 'Buyer shall not ';
  const text = `${prefix}acquire assets without consent.`;
  const parent = node({
    id: 'parent', reference: '4.1', heading: 'Interim Operating Covenants',
    articleContext: 'INTERIM_OPERATING', text,
  });
  const child = node({
    id: 'child', reference: '4.1(a)', parent: 'parent', heading: null,
    articleContext: 'INTERIM_OPERATING', text, start: Buffer.byteLength(prefix, 'utf8'),
  });
  const result = resolveSynthetic({ text, nodes: [parent, child], selected: child });
  const ioc = result.work_items.find((item) => item.family_id === 'INTERIM_OPERATING');

  assert.ok(ioc);
  assert.equal(ioc.covenant_side, 'BUYER');
  assert.equal(ioc.covenant_side_source, 'OPERATIVE_PARENT_TEXT');
  assert.equal(ioc.covenant_side_source_section_id, 'parent');
  assert.equal(ioc.covenant_side_evidence_start, 0);
  assert.equal(ioc.covenant_side_evidence_end, Buffer.byteLength(prefix, 'utf8'));
  assert.equal(ioc.covenant_side_evidence_sha256, sha256Hex(prefix));
});

test('work-item identity cannot collide when prompt source bytes change behind stale caller metadata', () => {
  const firstText = 'Material Adverse Effect means A.';
  const secondText = 'Material Adverse Effect means B.';
  const selected = node({
    id: 'mae', reference: '1.1', heading: 'Material Adverse Effect',
    articleContext: 'DEFINITIONS', text: firstText,
  });
  const reusedDocumentHash = 'd'.repeat(64);
  const first = resolveSynthetic({
    text: firstText, nodes: [selected], selected, documentHash: reusedDocumentHash,
  });
  const repeated = resolveSynthetic({
    text: firstText, nodes: [selected], selected, documentHash: reusedDocumentHash,
  });
  assert.equal(first.work_items[0].work_item_id, repeated.work_items[0].work_item_id);
  assert.throws(() => resolveSynthetic({
    text: secondText, nodes: [selected], selected, documentHash: reusedDocumentHash,
  }), (error) => error?.code === 'SECTION_TREE_NODE_HASH_MISMATCH');
});

test('the live execution path binds split-preflight PASS and cannot consume blocked work', () => {
  const source = [
    'lib/canonical-v2/native-producer/unified-runner-execute.js',
    'lib/canonical-v2/native-producer/unified-runner-validate.js',
    'scripts/canonical-v2-native-unified-runner.mjs',
  ].map((relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8')).join('\n');

  assert.match(source, /validatePromptBudgetSplitPreflightFence/);
  assert.match(source, /PROMPT_BUDGET_SPLIT_PREFLIGHT_BLOCKED/);
});

test('ruling evidence readiness cannot hide implementation gaps from successor M1', () => {
  const reconciliation = compileDecisionReconciliationProposal();
  assert.equal(reconciliation.ruling_evidence_freeze_ready, true);
  assert.ok(reconciliation.implementation_gap_ruling_ids.length > 0);
  assert.equal(reconciliation.implementation_reconciliation_ready, false);
  assert.equal(reconciliation.decision_register_freeze_ready, false);
  assert.equal(reconciliation.family_completion_ready, false);

  const packet = buildCurrentSuccessorM1ReadinessPacket({ repository_root: ROOT });
  assert.equal(packet.decision_reconciliation.implementation_reconciliation_ready, false);
  assert.equal(packet.decision_reconciliation.decision_register_freeze_ready, false);
  assert.equal(packet.family_register.status, 'BLOCKED');
  assert.ok(packet.blockers.some((blocker) => blocker.code === 'RECORDED_RULING_IMPLEMENTATION_GAPS'));
  assert.equal(packet.m1_authority, 'NONE');
});
