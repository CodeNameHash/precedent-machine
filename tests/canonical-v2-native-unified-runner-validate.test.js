const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { buildSecEdgarIntakeCapture } = require('../lib/canonical-v2/sec-edgar-intake-capture');
const { convertSecHtmlToCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text');
const { sectionizeAdmittedSource, findSectionByReference } = require('../lib/canonical-v2/native-producer/deterministic-sectionizer');
const {
  ABSENCE_PROOF_SCHEMA,
  NativeUnifiedRunValidationError,
  validateUnifiedRunManifest,
} = require('../lib/canonical-v2/native-producer/unified-runner-validate');

const ROOT = path.resolve(__dirname, '..');
const RAW_PATH = 'tests/fixtures/canonical-v2/mae-definition-family/topbuild-raw-fetched.htm';
const RAW = fs.readFileSync(path.resolve(ROOT, RAW_PATH));
const URL = 'https://www.sec.gov/Archives/edgar/data/1/topbuild.htm';
const POLICY_DIGEST = sha256Hex('native unified runner validate test');
const DEAL_ADMISSION_ID = sha256Hex('native unified runner validate deal');

function admittedSource() {
  const capture = buildSecEdgarIntakeCapture({
    retrieval_url: URL,
    final_url: URL,
    status_code: 200,
    content_type: 'text/html; charset=UTF-8',
    retrieved_at: '2026-08-03T00:00:00.000Z',
    retrieval_policy_digest: POLICY_DIGEST,
    redirect_count: 0,
    response_bytes: RAW,
  });
  const conversion = convertSecHtmlToCanonicalText(capture);
  const tree = sectionizeAdmittedSource({ source_text: conversion.canonical_text, document_hash: sha256Hex(RAW) });
  return { conversion, tree };
}

function pin(reference) {
  const node = findSectionByReference(admittedSource().tree, reference);
  assert.ok(node, `missing fixture section ${reference}`);
  return {
    section_reference: node.reference,
    section_id: node.section_id,
    section_kind: node.kind,
    section_text_sha256: node.text_sha256,
  };
}

function localSource(overrides = {}) {
  const { conversion } = admittedSource();
  return {
    source_id: 'topbuild-original',
    disposition: 'ADMITTED_LOCAL',
    raw_file_path: RAW_PATH,
    retrieval_url: URL,
    retrieved_at: '2026-08-03T00:00:00.000Z',
    retrieval_policy_digest: POLICY_DIGEST,
    raw_sha256: sha256Hex(RAW),
    canonical_text_sha256: conversion.canonical_text_sha256,
    canonical_text_byte_length: conversion.canonical_text_byte_length,
    governed_deal_key: 'deal:topbuild-test',
    deal_admission_id: DEAL_ADMISSION_ID,
    source_ordinal: 0,
    ...overrides,
  };
}

function extract(id, family, reference = '2.1') {
  return { work_item_id: id, source_id: 'topbuild-original', family_id: family, disposition: 'EXTRACT', section_pin: pin(reference) };
}

function manifest({ sources = [localSource()], workItems = [extract('capitalisation', 'CAPITALISATION')] } = {}) {
  return { schema_version: 'NATIVE_UNIFIED_RUN_MANIFEST/V1', sources, work_items: workItems };
}

function errorCode(fn) {
  assert.throws(fn, (error) => error instanceof NativeUnifiedRunValidationError);
  try { fn(); } catch (error) { return error.code; }
  return null;
}

test('validation identity is stable across declaration order', () => {
  const first = validateUnifiedRunManifest({
    manifest: manifest({ workItems: [extract('b-consideration', 'CONSIDERATION'), extract('a-capitalisation', 'CAPITALISATION')] }),
    root_dir: ROOT,
  });
  const second = validateUnifiedRunManifest({
    manifest: manifest({ workItems: [extract('a-capitalisation', 'CAPITALISATION'), extract('b-consideration', 'CONSIDERATION')] }),
    root_dir: ROOT,
  });
  assert.equal(first.receipt.unified_run_manifest_id, second.receipt.unified_run_manifest_id);
  assert.equal(first.receipt.validation_receipt_id, second.receipt.validation_receipt_id);
  assert.equal(first.semantic_manifest.semantic_manifest_id, second.semantic_manifest.semantic_manifest_id);
});

test('execution plan is a pure zero-retry summary', () => {
  const blocked = {
    source_id: 'metsera-original-exhibit-2-1',
    disposition: 'BLOCKED_SOURCE_PIN',
    source_locator: 'SEC 8-K Exhibit 2.1, accession 0001193125-25-210030',
    blocking_code: 'EXHIBIT_BYTES_NOT_PINNED',
  };
  const absent = {
    work_item_id: 'absent-financing',
    source_id: 'topbuild-original',
    family_id: 'FINANCING_COVENANTS',
    disposition: 'NOT_PRESENT',
    absence_proof: {
      schema_version: ABSENCE_PROOF_SCHEMA,
      scanned_nodes: [pin('2.1')],
      heading_terms: ['unfindable-heading-token'],
      lexical_terms: ['unfindable-lexical-token'],
      heading_match_count: 0,
      lexical_match_count: 0,
    },
  };
  const blockedWork = {
    work_item_id: 'metsera-consideration',
    source_id: blocked.source_id,
    family_id: 'CONSIDERATION',
    disposition: 'BLOCKED_SOURCE_PIN',
    blocking_code: 'EXHIBIT_BYTES_NOT_PINNED',
  };
  const result = validateUnifiedRunManifest({
    manifest: manifest({
      sources: [localSource(), blocked],
      workItems: [
        extract('capitalisation', 'CAPITALISATION'),
        extract('consideration', 'CONSIDERATION'),
        absent,
        blockedWork,
      ],
    }),
    root_dir: ROOT,
  });
  assert.deepEqual(result.execution_plan, {
    schema_version: 'NATIVE_UNIFIED_RUN_EXECUTION_PLAN/V1',
    extract_work_item_count: 2,
    not_present_work_item_count: 1,
    blocked_source_pin_work_item_count: 1,
    distinct_source_count: 2,
    distinct_family_count: 3,
    distinct_extract_section_count: 1,
    zero_retry_provider_call_count: 2,
    execution_plan_id: result.execution_plan.execution_plan_id,
  });
  assert.equal(result.receipt.execution_plan_id, result.execution_plan.execution_plan_id);
});

test('duplicate work items fail closed', () => {
  const repeated = extract('same', 'CAPITALISATION');
  assert.equal(errorCode(() => validateUnifiedRunManifest({ manifest: manifest({ workItems: [repeated, repeated] }), root_dir: ROOT })), 'DUPLICATE_WORK_ITEM');
});

test('raw pin mismatch fails before section dispatch', () => {
  const source = localSource({ raw_sha256: '0'.repeat(64) });
  const invalidSection = { ...extract('capitalisation', 'CAPITALISATION'), section_pin: { ...pin('2.1'), section_id: '1'.repeat(64) } };
  assert.equal(errorCode(() => validateUnifiedRunManifest({ manifest: manifest({ sources: [source], workItems: [invalidSection] }), root_dir: ROOT })), 'RAW_PIN_MISMATCH');
});

test('TopBuild aliases must use the deterministic section-tree reference', () => {
  const result = validateUnifiedRunManifest({ manifest: manifest({ workItems: [extract('no-reps', 'NO_OTHER_REPS_FRAUD', 'III-INTRO(w)')] }), root_dir: ROOT });
  assert.equal(result.receipt.disposition_counts.EXTRACT, 1);
  const nonTreeAlias = extract('bad-alias', 'ANTITRUST_REGULATORY', '2.1');
  nonTreeAlias.section_pin = { ...nonTreeAlias.section_pin, section_reference: '4.6' };
  assert.equal(errorCode(() => validateUnifiedRunManifest({ manifest: manifest({ workItems: [nonTreeAlias] }), root_dir: ROOT })), 'SECTION_PIN_MISMATCH');
});

test('NOT_PRESENT needs explicit zero-match heading and lexical proof', () => {
  const item = {
    work_item_id: 'absent-financing',
    source_id: 'topbuild-original',
    family_id: 'FINANCING_COVENANTS',
    disposition: 'NOT_PRESENT',
    absence_proof: {
      schema_version: ABSENCE_PROOF_SCHEMA,
      scanned_nodes: [pin('2.1')],
      heading_terms: ['unfindable-heading-token'],
      lexical_terms: ['unfindable-lexical-token'],
      heading_match_count: 0,
      lexical_match_count: 0,
    },
  };
  const result = validateUnifiedRunManifest({ manifest: manifest({ workItems: [item] }), root_dir: ROOT });
  assert.equal(result.receipt.disposition_counts.NOT_PRESENT, 1);
  item.absence_proof.lexical_terms = [];
  assert.equal(errorCode(() => validateUnifiedRunManifest({ manifest: manifest({ workItems: [item] }), root_dir: ROOT })), 'INVALID_ABSENCE_PROOF');
});

test('Metsera blocked pins cannot create a legal absence conclusion', () => {
  const blocked = {
    source_id: 'metsera-original-exhibit-2-1',
    disposition: 'BLOCKED_SOURCE_PIN',
    source_locator: 'SEC 8-K Exhibit 2.1, accession 0001193125-25-210030',
    blocking_code: 'EXHIBIT_BYTES_NOT_PINNED',
  };
  const blockedWork = {
    work_item_id: 'metsera-consideration',
    source_id: blocked.source_id,
    family_id: 'CONSIDERATION',
    disposition: 'BLOCKED_SOURCE_PIN',
    blocking_code: 'EXHIBIT_BYTES_NOT_PINNED',
  };
  const result = validateUnifiedRunManifest({ manifest: manifest({ sources: [blocked], workItems: [blockedWork] }), root_dir: ROOT });
  assert.equal(result.receipt.disposition_counts.BLOCKED_SOURCE_PIN, 1);
  const absent = {
    work_item_id: blockedWork.work_item_id,
    source_id: blocked.source_id,
    family_id: blockedWork.family_id,
    disposition: 'NOT_PRESENT',
    absence_proof: {
      schema_version: ABSENCE_PROOF_SCHEMA,
      scanned_nodes: [{ section_reference: '2.01', section_id: '0'.repeat(64), section_kind: 'SECTION', section_text_sha256: '1'.repeat(64) }],
      heading_terms: ['consideration'],
      lexical_terms: ['consideration'],
      heading_match_count: 0,
      lexical_match_count: 0,
    },
  };
  assert.equal(errorCode(() => validateUnifiedRunManifest({ manifest: manifest({ sources: [blocked], workItems: [absent] }), root_dir: ROOT })), 'BLOCKED_SOURCE_PIN');
});

test('the CLI composes validate mode only', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'native-unified-runner-'));
  const manifestPath = path.join(tempDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest()));
  const output = execFileSync(process.execPath, [
    'scripts/canonical-v2-native-unified-runner.mjs', '--mode=validate', '--manifest', manifestPath,
  ], { cwd: ROOT, encoding: 'utf8' });
  const result = JSON.parse(output);
  assert.equal(result.receipt.mode, 'validate');
  assert.match(result.receipt.validation_receipt_id, /^[a-f0-9]{64}$/);
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('validate runner imports neither provider nor network transport', () => {
  const source = fs.readFileSync(path.resolve(ROOT, 'lib/canonical-v2/native-producer/unified-runner-validate.js'), 'utf8');
  assert.doesNotMatch(source, /anthropic-provider|provider-interface|node:https|node:http|\bfetch\s*\(/);
});
