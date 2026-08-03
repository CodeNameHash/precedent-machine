const fs = require('node:fs');
const path = require('node:path');

const { canonicalJson, contentId, sha256Hex, utf8Slice } = require('../canonical-bytes');
const { buildSecEdgarIntakeCapture } = require('../sec-edgar-intake-capture');
const { convertSecHtmlToCanonicalText } = require('../sec-html-canonical-text');
const { verifySecHtmlCanonicalText } = require('../sec-html-canonical-text-verifier');
const { buildVerifiedSecSourceAdmission } = require('../sec-source-admission');
const { buildAdmittedSemanticSourceContext } = require('../admitted-semantic-source');
const { sectionizeAdmittedSource, findSectionByReference } = require('./deterministic-sectionizer');
const { listRegisteredSectionFamilies } = require('./producer-prompt-registry');

const MANIFEST_SCHEMA = 'NATIVE_UNIFIED_RUN_MANIFEST/V1';
const RECEIPT_SCHEMA = 'NATIVE_UNIFIED_RUN_VALIDATION_RECEIPT/V1';
const SEMANTIC_MANIFEST_SCHEMA = 'NATIVE_UNIFIED_RUN_SEMANTIC_MANIFEST/V1';
const ABSENCE_PROOF_SCHEMA = 'NATIVE_UNIFIED_RUN_ABSENCE_PROOF/V1';
const EXECUTION_PLAN_SCHEMA = 'NATIVE_UNIFIED_RUN_EXECUTION_PLAN/V1';
const DIGEST_RE = /^[a-f0-9]{64}$/;
const DISPOSITIONS = new Set(['EXTRACT', 'NOT_PRESENT', 'BLOCKED_SOURCE_PIN']);

class NativeUnifiedRunValidationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'NativeUnifiedRunValidationError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new NativeUnifiedRunValidationError(code, message, details);
}

function exactKeys(value, keys) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}

function text(value, label) {
  if (typeof value !== 'string' || !value.trim() || value.trim() !== value) {
    fail('INVALID_MANIFEST', `${label} must be a non-empty trimmed string.`);
  }
  return value;
}

function digest(value, label) {
  if (typeof value !== 'string' || !DIGEST_RE.test(value)) {
    fail('INVALID_MANIFEST', `${label} must be a lower-case SHA-256 digest.`);
  }
  return value;
}

function nonNegativeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) fail('INVALID_MANIFEST', `${label} must be a non-negative safe integer.`);
  return value;
}

function requireUnique(values, label) {
  if (new Set(values).size !== values.length) fail('DUPLICATE_WORK_ITEM', `${label} must be unique.`);
}

function validateSourceDeclaration(source) {
  text(source && source.source_id, 'source.source_id');
  if (source.disposition === 'ADMITTED_LOCAL') {
    const keys = [
      'source_id', 'disposition', 'raw_file_path', 'retrieval_url', 'retrieved_at',
      'retrieval_policy_digest', 'raw_sha256', 'canonical_text_sha256',
      'canonical_text_byte_length', 'governed_deal_key', 'deal_admission_id', 'source_ordinal',
    ];
    if (!exactKeys(source, keys)) fail('INVALID_MANIFEST', `source ${source.source_id} must match the admitted-local source contract.`);
    text(source.raw_file_path, `source ${source.source_id}.raw_file_path`);
    text(source.retrieval_url, `source ${source.source_id}.retrieval_url`);
    text(source.retrieved_at, `source ${source.source_id}.retrieved_at`);
    digest(source.retrieval_policy_digest, `source ${source.source_id}.retrieval_policy_digest`);
    digest(source.raw_sha256, `source ${source.source_id}.raw_sha256`);
    digest(source.canonical_text_sha256, `source ${source.source_id}.canonical_text_sha256`);
    nonNegativeInteger(source.canonical_text_byte_length, `source ${source.source_id}.canonical_text_byte_length`);
    text(source.governed_deal_key, `source ${source.source_id}.governed_deal_key`);
    digest(source.deal_admission_id, `source ${source.source_id}.deal_admission_id`);
    nonNegativeInteger(source.source_ordinal, `source ${source.source_id}.source_ordinal`);
    return;
  }
  if (source.disposition === 'BLOCKED_SOURCE_PIN') {
    const keys = ['source_id', 'disposition', 'source_locator', 'blocking_code'];
    if (!exactKeys(source, keys)) fail('INVALID_MANIFEST', `source ${source.source_id} must match the blocked-source contract.`);
    text(source.source_locator, `source ${source.source_id}.source_locator`);
    text(source.blocking_code, `source ${source.source_id}.blocking_code`);
    return;
  }
  fail('INVALID_MANIFEST', `source ${source.source_id} has an unsupported disposition.`);
}

function validateNodePin(value, label) {
  if (!exactKeys(value, ['section_reference', 'section_id', 'section_kind', 'section_text_sha256'])) {
    fail('INVALID_MANIFEST', `${label} must contain exactly its section pin.`);
  }
  text(value.section_reference, `${label}.section_reference`);
  digest(value.section_id, `${label}.section_id`);
  text(value.section_kind, `${label}.section_kind`);
  digest(value.section_text_sha256, `${label}.section_text_sha256`);
}

function validateWorkItemDeclaration(item, registeredFamilies) {
  text(item && item.work_item_id, 'work_item.work_item_id');
  if (!DISPOSITIONS.has(item.disposition)) fail('INVALID_MANIFEST', `work item ${item.work_item_id} has an unsupported disposition.`);
  text(item.source_id, `work item ${item.work_item_id}.source_id`);
  text(item.family_id, `work item ${item.work_item_id}.family_id`);
  if (!registeredFamilies.has(item.family_id)) {
    fail('UNREGISTERED_FAMILY', `work item ${item.work_item_id} names an unregistered family.`, { family_id: item.family_id });
  }
  if (item.disposition === 'EXTRACT') {
    if (!exactKeys(item, ['work_item_id', 'source_id', 'family_id', 'disposition', 'section_pin'])) {
      fail('INVALID_MANIFEST', `EXTRACT work item ${item.work_item_id} must match its closed contract.`);
    }
    validateNodePin(item.section_pin, `work item ${item.work_item_id}.section_pin`);
    return;
  }
  if (item.disposition === 'NOT_PRESENT') {
    if (!exactKeys(item, ['work_item_id', 'source_id', 'family_id', 'disposition', 'absence_proof'])) {
      fail('INVALID_MANIFEST', `NOT_PRESENT work item ${item.work_item_id} must match its closed contract.`);
    }
    const proof = item.absence_proof;
    if (!exactKeys(proof, [
      'schema_version', 'scanned_nodes', 'heading_terms', 'lexical_terms',
      'heading_match_count', 'lexical_match_count',
    ]) || proof.schema_version !== ABSENCE_PROOF_SCHEMA) {
      fail('INVALID_ABSENCE_PROOF', `work item ${item.work_item_id} has an invalid absence proof schema.`);
    }
    if (!Array.isArray(proof.scanned_nodes) || proof.scanned_nodes.length === 0
      || !Array.isArray(proof.heading_terms) || proof.heading_terms.length === 0
      || !Array.isArray(proof.lexical_terms) || proof.lexical_terms.length === 0
      || proof.heading_match_count !== 0 || proof.lexical_match_count !== 0) {
      fail('INVALID_ABSENCE_PROOF', `work item ${item.work_item_id} must record explicit nodes, terms and zero matches.`);
    }
    proof.scanned_nodes.forEach((node, index) => validateNodePin(node, `work item ${item.work_item_id}.absence_proof.scanned_nodes[${index}]`));
    proof.heading_terms.forEach((term, index) => text(term, `work item ${item.work_item_id}.absence_proof.heading_terms[${index}]`));
    proof.lexical_terms.forEach((term, index) => text(term, `work item ${item.work_item_id}.absence_proof.lexical_terms[${index}]`));
    requireUnique(proof.scanned_nodes.map((node) => node.section_id), `work item ${item.work_item_id}.absence_proof.scanned_nodes`);
    return;
  }
  if (!exactKeys(item, ['work_item_id', 'source_id', 'family_id', 'disposition', 'blocking_code'])) {
    fail('INVALID_MANIFEST', `BLOCKED_SOURCE_PIN work item ${item.work_item_id} must match its closed contract.`);
  }
  text(item.blocking_code, `work item ${item.work_item_id}.blocking_code`);
}

function canonicalManifest(manifest) {
  if (!exactKeys(manifest, ['schema_version', 'sources', 'work_items']) || manifest.schema_version !== MANIFEST_SCHEMA) {
    fail('INVALID_MANIFEST', `manifest must match ${MANIFEST_SCHEMA}.`);
  }
  if (!Array.isArray(manifest.sources) || manifest.sources.length === 0 || !Array.isArray(manifest.work_items) || manifest.work_items.length === 0) {
    fail('INVALID_MANIFEST', 'manifest must contain sources and work items.');
  }
  const registeredFamilies = new Set(listRegisteredSectionFamilies());
  manifest.sources.forEach(validateSourceDeclaration);
  manifest.work_items.forEach((item) => validateWorkItemDeclaration(item, registeredFamilies));
  requireUnique(manifest.sources.map((source) => source.source_id), 'source.source_id');
  requireUnique(manifest.work_items.map((item) => item.work_item_id), 'work_item.work_item_id');
  const sourceIds = new Set(manifest.sources.map((source) => source.source_id));
  manifest.work_items.forEach((item) => {
    if (!sourceIds.has(item.source_id)) fail('UNKNOWN_SOURCE', `work item ${item.work_item_id} names an unknown source.`);
  });
  const workKeys = manifest.work_items.map((item) => canonicalJson({
    source_id: item.source_id,
    family_id: item.family_id,
    disposition: item.disposition,
    section_pin: item.section_pin || null,
  }));
  requireUnique(workKeys, 'logical work item');
  return Object.freeze({
    schema_version: MANIFEST_SCHEMA,
    sources: Object.freeze([...manifest.sources].sort((a, b) => a.source_id.localeCompare(b.source_id))),
    work_items: Object.freeze([...manifest.work_items].sort((a, b) => a.work_item_id.localeCompare(b.work_item_id))),
  });
}

function resolveRawFile(rootDir, relativePath) {
  if (path.isAbsolute(relativePath)) fail('INVALID_MANIFEST', 'raw_file_path must be relative to root_dir.');
  const root = path.resolve(rootDir);
  const file = path.resolve(root, relativePath);
  if (file !== root && !file.startsWith(`${root}${path.sep}`)) fail('INVALID_MANIFEST', 'raw_file_path escapes root_dir.');
  if (!fs.statSync(file).isFile()) fail('SOURCE_FILE_MISSING', `pinned source file is missing: ${relativePath}`);
  return file;
}

function admitSource(source, rootDir) {
  if (source.disposition === 'BLOCKED_SOURCE_PIN') return Object.freeze({ source_id: source.source_id, disposition: source.disposition, blocking_code: source.blocking_code });
  const rawBytes = fs.readFileSync(resolveRawFile(rootDir, source.raw_file_path));
  if (sha256Hex(rawBytes) !== source.raw_sha256) fail('RAW_PIN_MISMATCH', `source ${source.source_id} raw hash does not match its pin.`);
  const capture = buildSecEdgarIntakeCapture({
    retrieval_url: source.retrieval_url,
    final_url: source.retrieval_url,
    status_code: 200,
    content_type: 'text/html; charset=UTF-8',
    retrieved_at: source.retrieved_at,
    retrieval_policy_digest: source.retrieval_policy_digest,
    redirect_count: 0,
    response_bytes: rawBytes,
  });
  const conversion = convertSecHtmlToCanonicalText(capture);
  if (conversion.canonical_text_sha256 !== source.canonical_text_sha256
    || conversion.canonical_text_byte_length !== source.canonical_text_byte_length) {
    fail('CANONICAL_PIN_MISMATCH', `source ${source.source_id} canonical pin does not match its admission chain.`);
  }
  const verification = verifySecHtmlCanonicalText({ capture, conversion });
  if (verification.verification_status !== 'PASS') fail('SOURCE_NOT_VERIFIED', `source ${source.source_id} did not pass canonical verification.`);
  const bundle = buildVerifiedSecSourceAdmission({ capture, conversion, verification });
  const context = buildAdmittedSemanticSourceContext({
    immutable_source_document: bundle.immutable_source_document,
    source_admission_manifest: bundle.source_admission_manifest,
    semantic_extraction_input_envelope: bundle.semantic_extraction_input_envelope,
    conversion,
    governed_deal_key: source.governed_deal_key,
    deal_admission_id: source.deal_admission_id,
    source_ordinal: source.source_ordinal,
  });
  return Object.freeze({
    source_id: source.source_id,
    disposition: source.disposition,
    context,
    tree: sectionizeAdmittedSource({ source_text: conversion.canonical_text, document_hash: context.document_hash }),
  });
}

function verifyNodePin(node, pin, itemId) {
  if (!node || node.section_id !== pin.section_id || node.kind !== pin.section_kind || node.text_sha256 !== pin.section_text_sha256) {
    fail('SECTION_PIN_MISMATCH', `work item ${itemId} section pin does not match the independent section tree.`);
  }
}

function validateAbsenceProof(item, admitted) {
  const proof = item.absence_proof;
  const textByNode = [];
  for (const pin of proof.scanned_nodes) {
    const node = findSectionByReference(admitted.tree, pin.section_reference);
    verifyNodePin(node, pin, item.work_item_id);
    textByNode.push({ node, text: utf8Slice(admitted.context.canonical_text.text, node.start, node.end) });
  }
  const matches = (term, value) => value.toLocaleLowerCase('en-US').includes(term.toLocaleLowerCase('en-US'));
  const headingMatches = proof.heading_terms.reduce((total, term) => total + textByNode.filter(({ node }) => matches(term, node.heading || '')).length, 0);
  const lexicalMatches = proof.lexical_terms.reduce((total, term) => total + textByNode.filter(({ text: nodeText }) => matches(term, nodeText)).length, 0);
  if (headingMatches !== 0 || lexicalMatches !== 0) {
    fail('ABSENCE_PROOF_NOT_ZERO', `work item ${item.work_item_id} has a non-zero deterministic absence match.`, { heading_matches: headingMatches, lexical_matches: lexicalMatches });
  }
  return Object.freeze({
    work_item_id: item.work_item_id,
    source_id: item.source_id,
    family_id: item.family_id,
    disposition: item.disposition,
    absence_proof_digest: contentId(ABSENCE_PROOF_SCHEMA, proof),
  });
}

function buildExecutionPlanSummary(workItems) {
  const dispositionCount = (disposition) => workItems.filter((item) => item.disposition === disposition).length;
  const extractItems = workItems.filter((item) => item.disposition === 'EXTRACT');
  const body = {
    schema_version: EXECUTION_PLAN_SCHEMA,
    extract_work_item_count: dispositionCount('EXTRACT'),
    not_present_work_item_count: dispositionCount('NOT_PRESENT'),
    blocked_source_pin_work_item_count: dispositionCount('BLOCKED_SOURCE_PIN'),
    distinct_source_count: new Set(workItems.map((item) => item.source_id)).size,
    distinct_family_count: new Set(workItems.map((item) => item.family_id)).size,
    distinct_extract_section_count: new Set(extractItems.map((item) => `${item.source_id}:${item.section_id}`)).size,
    zero_retry_provider_call_count: extractItems.length,
  };
  return Object.freeze({
    ...body,
    execution_plan_id: contentId(EXECUTION_PLAN_SCHEMA, body),
  });
}

function validateUnifiedRunManifest({ manifest, root_dir: rootDir = process.cwd() } = {}) {
  const normalized = canonicalManifest(manifest);
  const unifiedRunManifestId = contentId(MANIFEST_SCHEMA, normalized);
  const sources = new Map(normalized.sources.map((source) => [source.source_id, admitSource(source, rootDir)]));
  const validatedWorkItems = normalized.work_items.map((item) => {
    const admitted = sources.get(item.source_id);
    if (item.disposition === 'BLOCKED_SOURCE_PIN') {
      if (admitted.disposition !== 'BLOCKED_SOURCE_PIN') fail('INVALID_BLOCKED_WORK_ITEM', `work item ${item.work_item_id} blocks an admitted source.`);
      return Object.freeze({ work_item_id: item.work_item_id, source_id: item.source_id, family_id: item.family_id, disposition: item.disposition, blocking_code: item.blocking_code });
    }
    if (admitted.disposition === 'BLOCKED_SOURCE_PIN') fail('BLOCKED_SOURCE_PIN', `work item ${item.work_item_id} cannot make a presence or absence conclusion for a blocked source.`);
    if (item.disposition === 'NOT_PRESENT') return validateAbsenceProof(item, admitted);
    const node = findSectionByReference(admitted.tree, item.section_pin.section_reference);
    verifyNodePin(node, item.section_pin, item.work_item_id);
    return Object.freeze({
      work_item_id: item.work_item_id,
      source_id: item.source_id,
      family_id: item.family_id,
      disposition: item.disposition,
      section_reference: node.reference,
      section_id: node.section_id,
      section_kind: node.kind,
      section_text_sha256: node.text_sha256,
    });
  });
  const semanticBody = {
    schema_version: SEMANTIC_MANIFEST_SCHEMA,
    unified_run_manifest_id: unifiedRunManifestId,
    sources: [...sources.values()].map((source) => source.disposition === 'BLOCKED_SOURCE_PIN'
      ? source
      : ({ source_id: source.source_id, disposition: source.disposition, admitted_semantic_source_context_id: source.context.admitted_semantic_source_context_id, section_tree_sha256: contentId('DETERMINISTIC_SECTION_TREE/V1', source.tree) })),
    work_items: validatedWorkItems,
  };
  const semanticManifest = Object.freeze({
    ...semanticBody,
    semantic_manifest_id: contentId(SEMANTIC_MANIFEST_SCHEMA, semanticBody),
  });
  const executionPlan = buildExecutionPlanSummary(validatedWorkItems);
  const counts = Object.fromEntries([...DISPOSITIONS].sort().map((disposition) => [disposition, validatedWorkItems.filter((item) => item.disposition === disposition).length]));
  const receiptBody = {
    schema_version: RECEIPT_SCHEMA,
    mode: 'validate',
    unified_run_manifest_id: unifiedRunManifestId,
    semantic_manifest_id: semanticManifest.semantic_manifest_id,
    source_count: normalized.sources.length,
    work_item_count: validatedWorkItems.length,
    disposition_counts: counts,
    execution_plan_id: executionPlan.execution_plan_id,
  };
  return Object.freeze({
    receipt: Object.freeze({ ...receiptBody, validation_receipt_id: contentId(RECEIPT_SCHEMA, receiptBody) }),
    semantic_manifest: semanticManifest,
    execution_plan: executionPlan,
  });
}

module.exports = {
  MANIFEST_SCHEMA,
  RECEIPT_SCHEMA,
  SEMANTIC_MANIFEST_SCHEMA,
  ABSENCE_PROOF_SCHEMA,
  EXECUTION_PLAN_SCHEMA,
  NativeUnifiedRunValidationError,
  buildExecutionPlanSummary,
  validateUnifiedRunManifest,
};
