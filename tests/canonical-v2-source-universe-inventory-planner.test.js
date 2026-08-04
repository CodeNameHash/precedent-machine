'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { buildSecEdgarIntakeCapture } = require('../lib/canonical-v2/sec-edgar-intake-capture');
const { convertSecHtmlToCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text');
const {
  SourceUniverseInventoryPlannerError,
  buildSourceUniverseInventory,
} = require('../lib/canonical-v2/source-universe-inventory-planner');
const { buildFullCorpusExecutionManifestProposal } = require('../lib/canonical-v2/native-producer/full-corpus-execution-manifest-planner');

const ROOT = path.resolve(__dirname, '..');
const RAW_PATH = 'tests/fixtures/canonical-v2/native-unified-runner/compact-source.htm';
const RAW = fs.readFileSync(path.resolve(ROOT, RAW_PATH));
const URL = 'https://www.sec.gov/Archives/edgar/data/1/topbuild.htm';
const POLICY_DIGEST = sha256Hex('source universe inventory test');

function sourceDeclaration(sourceId, dealKey) {
  const capture = buildSecEdgarIntakeCapture({
    retrieval_url: URL, final_url: URL, status_code: 200, content_type: 'text/html; charset=UTF-8',
    retrieved_at: '2026-08-03T00:00:00.000Z', retrieval_policy_digest: POLICY_DIGEST,
    redirect_count: 0, response_bytes: RAW,
  });
  const conversion = convertSecHtmlToCanonicalText(capture);
  return {
    source_id: sourceId,
    disposition: 'ADMITTED_LOCAL',
    raw_file_path: RAW_PATH,
    retrieval_url: URL,
    retrieved_at: '2026-08-03T00:00:00.000Z',
    retrieval_policy_digest: POLICY_DIGEST,
    raw_sha256: sha256Hex(RAW),
    canonical_text_sha256: conversion.canonical_text_sha256,
    canonical_text_byte_length: conversion.canonical_text_byte_length,
    governed_deal_key: dealKey,
    deal_admission_id: sha256Hex(`admission:${dealKey}`),
    source_ordinal: 0,
  };
}

function evidence(label) {
  return {
    evidence_id: `evidence:${label}`,
    exact_text: `Exact evidence for ${label}.`,
    exact_text_sha256: sha256Hex(`Exact evidence for ${label}.`),
  };
}

function include(occurrenceId, dealKey, sourceId) {
  return {
    occurrence_id: occurrenceId,
    governed_deal_key: dealKey,
    source_locator: `received/${occurrenceId}.htm`,
    raw_sha256: sha256Hex(RAW),
    raw_byte_length: RAW.length,
    terminal_disposition: 'INCLUDE_AS_ROLE',
    source_role: 'MERGER_AGREEMENT',
    source_declaration: sourceDeclaration(sourceId, dealKey),
  };
}

function input(overrides = {}) {
  return {
    governed_deal_roster: [
      { governed_deal_key: 'deal:alpha' },
      { governed_deal_key: 'deal:beta' },
    ],
    received_source_occurrences: [
      include('alpha-agreement', 'deal:alpha', 'alpha-original'),
      include('beta-agreement', 'deal:beta', 'beta-original'),
    ],
    ...overrides,
  };
}

function errorCode(fn) {
  assert.throws(fn, (error) => error instanceof SourceUniverseInventoryPlannerError);
  try { fn(); } catch (error) { return error.code; }
  return null;
}

test('produces a stable proposal-only source inventory without inferring admission', () => {
  const first = buildSourceUniverseInventory(input());
  const second = buildSourceUniverseInventory(input({
    governed_deal_roster: [...input().governed_deal_roster].reverse(),
    received_source_occurrences: [...input().received_source_occurrences].reverse(),
  }));
  assert.equal(first.inventory.inventory_id, second.inventory.inventory_id);
  assert.equal(first.blocker_report.blocker_report_id, second.blocker_report.blocker_report_id);
  assert.equal(first.inventory.authority, 'NONE');
  assert.equal(first.inventory.status, 'PROPOSAL_ONLY_NOT_ADMISSION_AUTHORITY');
  assert.equal(first.blocker_report.status, 'BLOCKED_PROPOSAL_ONLY_NOT_EXECUTION_AUTHORITY');
  assert.deepEqual(first.inventory.source_declaration_diagnostics.map((source) => source.source_id), ['alpha-original', 'beta-original']);
});

test('requires approval for exceptional open-world role inclusion and preserves it in the inventory', () => {
  const occurrences = input().received_source_occurrences;
  occurrences[1] = {
    occurrence_id: 'beta-agreement',
    governed_deal_key: 'deal:beta',
    source_locator: 'received/beta-agreement.htm',
    raw_sha256: sha256Hex(RAW),
    raw_byte_length: RAW.length,
    terminal_disposition: 'INCLUDE_WITH_OPEN_WORLD_ROLE_CANDIDATE',
    source_role_candidate: 'SIDE_LETTER_OR_UNKNOWN_TRANSACTION_DOCUMENT',
    governed_approval_id: 'approval:open-world-role:beta',
    source_declaration: sourceDeclaration('beta-original', 'deal:beta'),
  };
  assert.equal(buildSourceUniverseInventory(input({ received_source_occurrences: occurrences })).blocker_report.status, 'BLOCKED_PROPOSAL_ONLY_NOT_EXECUTION_AUTHORITY');
  delete occurrences[1].governed_approval_id;
  assert.equal(errorCode(() => buildSourceUniverseInventory(input({ received_source_occurrences: occurrences }))), 'INVALID_SOURCE_OCCURRENCE');
});

test('requires exact evidence plus review and approval for non-included received material', () => {
  const occurrences = [...input().received_source_occurrences, {
    occurrence_id: 'alpha-cover-email',
    governed_deal_key: 'deal:alpha',
    source_locator: 'received/alpha-cover-email.eml',
    raw_sha256: sha256Hex('cover email'),
    raw_byte_length: Buffer.byteLength('cover email'),
    terminal_disposition: 'NON_DOCUMENT_TRANSPORT',
    evidence: evidence('alpha-cover-email'),
    review_id: 'review:alpha-cover-email',
    approval_id: 'approval:alpha-cover-email',
  }];
  assert.equal(buildSourceUniverseInventory(input({ received_source_occurrences: occurrences })).blocker_report.status, 'BLOCKED_PROPOSAL_ONLY_NOT_EXECUTION_AUTHORITY');
  delete occurrences[2].approval_id;
  assert.equal(errorCode(() => buildSourceUniverseInventory(input({ received_source_occurrences: occurrences }))), 'INVALID_SOURCE_OCCURRENCE');
});

test('exact duplicates must resolve to an included retained occurrence with the same raw bytes', () => {
  const duplicate = {
    occurrence_id: 'alpha-duplicate',
    governed_deal_key: 'deal:alpha',
    source_locator: 'received/alpha-duplicate.htm',
    raw_sha256: sha256Hex(RAW),
    raw_byte_length: RAW.length,
    terminal_disposition: 'EXACT_DUPLICATE_OF',
    retained_occurrence_id: 'alpha-agreement',
    review_id: 'review:alpha-duplicate',
    approval_id: 'approval:alpha-duplicate',
    evidence: evidence('alpha-duplicate'),
  };
  assert.equal(buildSourceUniverseInventory(input({
    received_source_occurrences: [...input().received_source_occurrences, duplicate],
  })).blocker_report.status, 'BLOCKED_PROPOSAL_ONLY_NOT_EXECUTION_AUTHORITY');
  duplicate.raw_sha256 = sha256Hex('not identical');
  const blocked = buildSourceUniverseInventory(input({
    received_source_occurrences: [...input().received_source_occurrences, duplicate],
  }));
  assert.equal(blocked.blocker_report.status, 'BLOCKED_PROPOSAL_ONLY_NOT_EXECUTION_AUTHORITY');
  assert.ok(blocked.blocker_report.blockers.some((entry) => entry.code === 'INCONSISTENT_HASH'));
});

test('cycles, missing replacements, missing deals and zero-source deals remain explicit blockers', () => {
  const duplicateA = {
    occurrence_id: 'alpha-duplicate-a', governed_deal_key: 'deal:alpha', source_locator: 'received/a.htm',
    raw_sha256: sha256Hex(RAW), raw_byte_length: RAW.length, terminal_disposition: 'EXACT_DUPLICATE_OF',
    retained_occurrence_id: 'alpha-duplicate-b', review_id: 'review:a', approval_id: 'approval:a', evidence: evidence('a'),
  };
  const duplicateB = { ...duplicateA, occurrence_id: 'alpha-duplicate-b', source_locator: 'received/b.htm', retained_occurrence_id: 'alpha-duplicate-a', review_id: 'review:b', approval_id: 'approval:b', evidence: evidence('b') };
  const result = buildSourceUniverseInventory(input({
    received_source_occurrences: [include('alpha-agreement', 'deal:alpha', 'alpha-original'), duplicateA, duplicateB],
  }));
  const codes = new Set(result.blocker_report.blockers.map((entry) => entry.code));
  assert.ok(codes.has('DUPLICATE_CYCLE'));
  assert.ok(codes.has('MISSING_DEAL_OCCURRENCES'));
  assert.ok(codes.has('ZERO_SOURCE_WITHOUT_UNRESOLVED'));
});

test('an explicit unresolved source occurrence is the only permitted zero-source deal record', () => {
  const unresolved = {
    occurrence_id: 'beta-agreement-unresolved',
    governed_deal_key: 'deal:beta',
    source_locator: 'SEC Exhibit 2.1, accession pending pin',
    terminal_disposition: 'BLOCKING_UNRESOLVED',
    blocker_id: 'EXHIBIT_BYTES_NOT_PINNED',
    evidence: evidence('beta-unresolved'),
    review_id: 'review:beta-unresolved',
    approval_id: 'approval:beta-unresolved',
  };
  const result = buildSourceUniverseInventory(input({
    received_source_occurrences: [include('alpha-agreement', 'deal:alpha', 'alpha-original'), unresolved],
  }));
  const codes = result.blocker_report.blockers.map((entry) => entry.code);
  assert.ok(codes.includes('BLOCKING_UNRESOLVED'));
  assert.equal(codes.includes('ZERO_SOURCE_WITHOUT_UNRESOLVED'), false);
});

test('binds every included role to non-empty matching declared source bytes and its governed deal', () => {
  const mismatch = include('alpha-agreement', 'deal:alpha', 'alpha-original');
  mismatch.raw_byte_length = 0;
  assert.equal(errorCode(() => buildSourceUniverseInventory(input({
    received_source_occurrences: [mismatch, include('beta-agreement', 'deal:beta', 'beta-original')],
  }))), 'EMPTY_RAW_BYTES');

  const wrongDeal = include('alpha-agreement', 'deal:alpha', 'alpha-original');
  wrongDeal.source_declaration.governed_deal_key = 'deal:beta';
  assert.equal(errorCode(() => buildSourceUniverseInventory(input({
    received_source_occurrences: [wrongDeal, include('beta-agreement', 'deal:beta', 'beta-original')],
  }))), 'INCONSISTENT_GOVERNED_DEAL');

  const recorded = include('alpha-recorded', 'deal:alpha', 'alpha-recorded');
  recorded.source_declaration = {
    source_id: 'alpha-recorded', disposition: 'ADMITTED_RECORDED',
    recorded_admitted_source_context_path: 'tests/fixtures/recorded-context.json',
    admitted_semantic_source_context_id: sha256Hex('alpha-context'),
    admitted_source_reference: {}, canonical_text_sha256: sha256Hex('canonical'),
    canonical_text_byte_length: 9, document_hash: sha256Hex('different raw bytes'),
  };
  assert.equal(errorCode(() => buildSourceUniverseInventory(input({
    received_source_occurrences: [recorded, include('beta-agreement', 'deal:beta', 'beta-original')],
  }))), 'INCONSISTENT_HASH');
});

test('local source ordinals are unique by deal and an inventory never exposes an admitted execution source list', () => {
  const second = include('alpha-second-sec-occurrence', 'deal:alpha', 'alpha-second');
  const result = buildSourceUniverseInventory(input({
    received_source_occurrences: [
      include('alpha-agreement', 'deal:alpha', 'alpha-original'),
      second,
      include('beta-agreement', 'deal:beta', 'beta-original'),
    ],
  }));
  assert.equal(result.blocker_report.status, 'BLOCKED_PROPOSAL_ONLY_NOT_EXECUTION_AUTHORITY');
  assert.equal(Object.hasOwn(result.inventory, 'admitted_source_declarations'), false);
  assert.ok(result.blocker_report.blockers.some((entry) => entry.code === 'DUPLICATE_LOCAL_SOURCE_ORDINAL'));
});

test('TopBuild-style distinct SEC occurrences cannot be exact duplicates without exact bytes in the same governed deal', () => {
  const hostile = {
    occurrence_id: 'topbuild-second-sec-occurrence', governed_deal_key: 'deal:alpha',
    source_locator: 'SEC accession 2, Exhibit 2.1', raw_sha256: sha256Hex('different TopBuild bytes'),
    raw_byte_length: Buffer.byteLength('different TopBuild bytes'), terminal_disposition: 'EXACT_DUPLICATE_OF',
    retained_occurrence_id: 'alpha-agreement', review_id: 'review:topbuild-second',
    approval_id: 'approval:topbuild-second', evidence: evidence('topbuild-second'),
  };
  const result = buildSourceUniverseInventory(input({
    received_source_occurrences: [...input().received_source_occurrences, hostile],
  }));
  assert.equal(result.blocker_report.status, 'BLOCKED_PROPOSAL_ONLY_NOT_EXECUTION_AUTHORITY');
  assert.equal(Object.hasOwn(result.inventory, 'admitted_source_declarations'), false);
  assert.ok(result.blocker_report.blockers.some((entry) => entry.code === 'INCONSISTENT_HASH'));

  hostile.governed_deal_key = 'deal:beta';
  const crossDeal = buildSourceUniverseInventory(input({
    received_source_occurrences: [...input().received_source_occurrences, hostile],
  }));
  assert.ok(crossDeal.blocker_report.blockers.some((entry) => entry.code === 'CROSS_DEAL_EXACT_DUPLICATE'));
});

test('an inventory exposes diagnostics, not source declarations consumable by the planner', () => {
  const inventory = buildSourceUniverseInventory({
    governed_deal_roster: [{ governed_deal_key: 'deal:alpha' }],
    received_source_occurrences: [include('alpha-agreement', 'deal:alpha', 'alpha-original')],
  });
  assert.equal(inventory.blocker_report.status, 'BLOCKED_PROPOSAL_ONLY_NOT_EXECUTION_AUTHORITY');
  assert.equal(Object.hasOwn(inventory.inventory, 'admitted_source_declarations'), false);
  assert.throws(() => buildFullCorpusExecutionManifestProposal({
    sources: inventory.inventory.source_declaration_diagnostics,
    family_ids: ['CAPITALISATION'],
    source_family_units: [],
  }), /unsupported disposition|admitted-local source contract/);
});
