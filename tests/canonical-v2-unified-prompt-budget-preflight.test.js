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
  buildPromptBudgetPolicy,
  buildUnifiedPromptBudgetPreflight,
} = require('../lib/canonical-v2/native-producer/unified-prompt-budget-preflight');

const ROOT = path.resolve(__dirname, '..');
const RAW_PATH = 'tests/fixtures/canonical-v2/native-unified-runner/compact-source.htm';
const RAW = fs.readFileSync(path.resolve(ROOT, RAW_PATH));
const URL = 'https://www.sec.gov/Archives/edgar/data/1/topbuild.htm';
const POLICY_DIGEST = sha256Hex('unified prompt-budget preflight test');

function material() {
  const capture = buildSecEdgarIntakeCapture({
    retrieval_url: URL, final_url: URL, status_code: 200, content_type: 'text/html; charset=UTF-8',
    retrieved_at: '2026-08-03T00:00:00.000Z', retrieval_policy_digest: POLICY_DIGEST,
    redirect_count: 0, response_bytes: RAW,
  });
  const conversion = convertSecHtmlToCanonicalText(capture);
  return { conversion, tree: sectionizeAdmittedSource({ source_text: conversion.canonical_text, document_hash: sha256Hex(RAW) }) };
}

function source() {
  const { conversion } = material();
  return {
    source_id: 'topbuild-original', disposition: 'ADMITTED_LOCAL', raw_file_path: RAW_PATH,
    retrieval_url: URL, retrieved_at: '2026-08-03T00:00:00.000Z', retrieval_policy_digest: POLICY_DIGEST,
    raw_sha256: sha256Hex(RAW), canonical_text_sha256: conversion.canonical_text_sha256,
    canonical_text_byte_length: conversion.canonical_text_byte_length,
    governed_deal_key: 'deal:unified-prompt-budget', deal_admission_id: sha256Hex('unified-prompt-budget-admission'), source_ordinal: 0,
  };
}

function pin(reference = '2.1') {
  const node = findSectionByReference(material().tree, reference);
  return { section_reference: node.reference, section_id: node.section_id, section_kind: node.kind, section_text_sha256: node.text_sha256 };
}

function manifest(workItems = [{
  work_item_id: 'capitalisation', source_id: 'topbuild-original', family_id: 'CAPITALISATION', disposition: 'EXTRACT', section_pin: pin(),
}]) {
  return { schema_version: 'NATIVE_UNIFIED_RUN_MANIFEST/V1', sources: [source()], work_items: workItems };
}

function policy(ceiling = 200000) {
  return buildPromptBudgetPolicy({ policy_id: 'policy:test', policy_version: 1, prompt_byte_ceiling: ceiling });
}

test('prompt-budget preflight cannot run from a caller-provided execution manifest', () => {
  assert.throws(
    () => buildUnifiedPromptBudgetPreflight({ manifest: manifest(), prompt_budget_policy: policy(), root_dir: ROOT }),
    (error) => error.code === 'TRUSTED_UNIFIED_RUN_VERIFIER_UNAVAILABLE',
  );
});

test('missing policy cannot weaken the trusted-manifest requirement', () => {
  assert.throws(
    () => buildUnifiedPromptBudgetPreflight({ manifest: manifest(), root_dir: ROOT }),
    (error) => error.code === 'TRUSTED_UNIFIED_RUN_VERIFIER_UNAVAILABLE',
  );
});

test('NOT_PRESENT items still require trusted-manifest validation before prompt handling', () => {
  const absent = {
    work_item_id: 'absent-financing', source_id: 'topbuild-original', family_id: 'FINANCING_COVENANTS', disposition: 'NOT_PRESENT',
    absence_proof: {
      schema_version: 'NATIVE_UNIFIED_RUN_ABSENCE_PROOF/V1', scanned_nodes: [pin()],
      heading_terms: ['unfindable-heading-token'], lexical_terms: ['unfindable-lexical-token'], heading_match_count: 0, lexical_match_count: 0,
    },
  };
  assert.throws(
    () => buildUnifiedPromptBudgetPreflight({ manifest: manifest([absent]), prompt_budget_policy: policy(), root_dir: ROOT }),
    (error) => error.code === 'TRUSTED_UNIFIED_RUN_VERIFIER_UNAVAILABLE',
  );
});

test('section drift, unknown family and duplicate work items fail before prompt construction', () => {
  const sectionDrift = manifest();
  sectionDrift.work_items[0].section_pin.section_id = '0'.repeat(64);
  assert.throws(() => buildUnifiedPromptBudgetPreflight({ manifest: sectionDrift, prompt_budget_policy: policy(), root_dir: ROOT }));
  const unknownFamily = manifest();
  unknownFamily.work_items[0].family_id = 'UNKNOWN_FAMILY';
  assert.throws(() => buildUnifiedPromptBudgetPreflight({ manifest: unknownFamily, prompt_budget_policy: policy(), root_dir: ROOT }));
  const duplicate = manifest();
  duplicate.work_items.push(structuredClone(duplicate.work_items[0]));
  assert.throws(() => buildUnifiedPromptBudgetPreflight({ manifest: duplicate, prompt_budget_policy: policy(), root_dir: ROOT }));
});

test('a low prompt ceiling cannot bypass the trusted-manifest requirement', () => {
  assert.throws(
    () => buildUnifiedPromptBudgetPreflight({ manifest: manifest(), prompt_budget_policy: policy(1), root_dir: ROOT }),
    (error) => error.code === 'TRUSTED_UNIFIED_RUN_VERIFIER_UNAVAILABLE',
  );
});

test('preflight code imports no provider, transport, database or UI path', () => {
  const sourceText = fs.readFileSync(path.join(ROOT, 'lib/canonical-v2/native-producer/unified-prompt-budget-preflight.js'), 'utf8');
  assert.doesNotMatch(sourceText, /provider-interface|anthropic-provider|codex-cli-provider|node:https|node:http|\bfetch\s*\(|supabase|next\//);
  assert.match(sourceText, /validateUnifiedRunManifest/);
  assert.match(sourceText, /loadAdmittedSourceForExecution/);
});
