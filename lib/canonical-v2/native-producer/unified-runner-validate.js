const fs = require('node:fs');
const path = require('node:path');

const { canonicalJson, contentId, sha256Hex, utf8Slice } = require('../canonical-bytes');
const { buildSecEdgarIntakeCapture } = require('../sec-edgar-intake-capture');
const { convertSecHtmlToCanonicalText } = require('../sec-html-canonical-text');
const { verifySecHtmlCanonicalText } = require('../sec-html-canonical-text-verifier');
const { sectionizeAdmittedSource, findSectionByReference } = require('./deterministic-sectionizer');
const { listRegisteredSectionFamilies } = require('./producer-prompt-registry');
const {
  validatePromptBudgetSplitPreflight,
} = require('./prompt-budget-split-preflight');

const MANIFEST_SCHEMA = 'NATIVE_UNIFIED_RUN_MANIFEST/V1';
const RECEIPT_SCHEMA = 'NATIVE_UNIFIED_RUN_VALIDATION_RECEIPT/V1';
const SEMANTIC_MANIFEST_SCHEMA = 'NATIVE_UNIFIED_RUN_SEMANTIC_MANIFEST/V1';
const ABSENCE_PROOF_SCHEMA = 'NATIVE_UNIFIED_RUN_ABSENCE_PROOF/V1';
const EXECUTION_PLAN_SCHEMA = 'NATIVE_UNIFIED_RUN_EXECUTION_PLAN/V1';
const DIAGNOSTIC_CONTEXT_SCHEMA = 'NATIVE_SOURCE_DIAGNOSTIC_CONTEXT/V1';
const DIAGNOSTIC_MANIFEST_SCHEMA = 'NATIVE_UNIFIED_RUN_MANIFEST_DIAGNOSTIC/V1';
const DIAGNOSTIC_RECEIPT_SCHEMA = 'NATIVE_UNIFIED_RUN_VALIDATION_DIAGNOSTIC/V1';
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
  if (source.disposition === 'ADMITTED_RECORDED') {
    const keys = [
      'source_id', 'disposition', 'recorded_admitted_source_context_path',
      'admitted_semantic_source_context_id', 'admitted_source_reference',
      'canonical_text_sha256', 'canonical_text_byte_length', 'document_hash',
    ];
    if (!exactKeys(source, keys)) fail('INVALID_MANIFEST', `source ${source.source_id} must match the admitted-recorded source contract.`);
    text(source.recorded_admitted_source_context_path,
      `source ${source.source_id}.recorded_admitted_source_context_path`);
    digest(source.admitted_semantic_source_context_id,
      `source ${source.source_id}.admitted_semantic_source_context_id`);
    if (!source.admitted_source_reference || typeof source.admitted_source_reference !== 'object'
      || Array.isArray(source.admitted_source_reference)) {
      fail('INVALID_MANIFEST', `source ${source.source_id}.admitted_source_reference must be an object.`);
    }
    digest(source.canonical_text_sha256, `source ${source.source_id}.canonical_text_sha256`);
    nonNegativeInteger(source.canonical_text_byte_length,
      `source ${source.source_id}.canonical_text_byte_length`);
    digest(source.document_hash, `source ${source.source_id}.document_hash`);
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
    const proofKeys = proof && proof.draft_detection_profile === undefined
      ? [
      'schema_version', 'scanned_nodes', 'heading_terms', 'lexical_terms',
      'heading_match_count', 'lexical_match_count',
      ]
      : [
        'schema_version', 'scanned_nodes', 'heading_terms', 'lexical_terms',
        'heading_match_count', 'lexical_match_count', 'draft_detection_profile',
        'coverage_attestation_digest',
      ];
    if (!exactKeys(proof, proofKeys) || proof.schema_version !== ABSENCE_PROOF_SCHEMA) {
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
    if (proof.draft_detection_profile !== undefined) {
      if (!exactKeys(proof.draft_detection_profile, ['profile_id', 'profile_version', 'profile_digest'])
        || typeof proof.draft_detection_profile.profile_id !== 'string'
        || !Number.isSafeInteger(proof.draft_detection_profile.profile_version)
        || !DIGEST_RE.test(proof.draft_detection_profile.profile_digest)
        || !DIGEST_RE.test(proof.coverage_attestation_digest)) {
        fail('INVALID_ABSENCE_PROOF', `work item ${item.work_item_id} has an invalid detection profile binding.`);
      }
    }
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

function validatePromptBudgetSplitPreflightFence({
  manifest,
  prompt_budget_split_preflights: promptBudgetSplitPreflights,
} = {}) {
  const normalized = canonicalManifest(manifest);
  const extractItems = normalized.work_items.filter((item) => item.disposition === 'EXTRACT');
  if (!Array.isArray(promptBudgetSplitPreflights)) {
    fail(
      'PROMPT_BUDGET_SPLIT_PREFLIGHTS_REQUIRED',
      'prompt_budget_split_preflights must contain one validated PASS preflight for every EXTRACT work item.',
    );
  }

  const preflightsByOrigin = new Map();
  for (const [index, preflight] of promptBudgetSplitPreflights.entries()) {
    try {
      validatePromptBudgetSplitPreflight(preflight);
    } catch (error) {
      fail(
        'INVALID_PROMPT_BUDGET_SPLIT_PREFLIGHT',
        `prompt_budget_split_preflights[${index}] is not a valid content-addressed preflight.`,
        { cause_code: error && error.code ? error.code : null },
      );
    }
    if (preflight.status !== 'PASS') {
      fail(
        'PROMPT_BUDGET_SPLIT_PREFLIGHT_BLOCKED',
        `prompt-budget split preflight ${preflight.preflight_id} is ${preflight.status}.`,
        {
          preflight_id: preflight.preflight_id,
          origin_work_item_id: preflight.origin_work_item_id,
          status: preflight.status,
        },
      );
    }
    if (preflightsByOrigin.has(preflight.origin_work_item_id)) {
      fail(
        'DUPLICATE_PROMPT_BUDGET_SPLIT_PREFLIGHT',
        `EXTRACT work item ${preflight.origin_work_item_id} has more than one prompt-budget split preflight.`,
      );
    }
    preflightsByOrigin.set(preflight.origin_work_item_id, preflight);
  }

  if (preflightsByOrigin.size !== extractItems.length) {
    fail(
      'PROMPT_BUDGET_SPLIT_PREFLIGHT_COVERAGE_MISMATCH',
      'Prompt-budget split preflights must cover exactly the EXTRACT work-item set.',
      {
        extract_work_item_ids: extractItems.map((item) => item.work_item_id).sort(),
        origin_work_item_ids: [...preflightsByOrigin.keys()].sort(),
      },
    );
  }

  for (const item of extractItems) {
    const preflight = preflightsByOrigin.get(item.work_item_id);
    if (!preflight) {
      fail(
        'PROMPT_BUDGET_SPLIT_PREFLIGHT_COVERAGE_MISMATCH',
        `EXTRACT work item ${item.work_item_id} has no prompt-budget split preflight.`,
      );
    }
    if (preflight.source_id !== item.source_id || preflight.family_id !== item.family_id) {
      fail(
        'PROMPT_BUDGET_SPLIT_PREFLIGHT_BINDING_MISMATCH',
        `Prompt-budget split preflight ${preflight.preflight_id} does not bind its EXTRACT work item.`,
        {
          origin_work_item_id: item.work_item_id,
          expected_source_id: item.source_id,
          actual_source_id: preflight.source_id,
          expected_family_id: item.family_id,
          actual_family_id: preflight.family_id,
        },
      );
    }
    const parentMatches = preflight.work_items.filter((workItem) => (
      workItem.origin_work_item_id === item.work_item_id
      && workItem.source_id === item.source_id
      && workItem.family_id === item.family_id
      && workItem.section_id === item.section_pin.section_id
      && workItem.section_reference === item.section_pin.section_reference
      && workItem.section_kind === item.section_pin.section_kind
      && workItem.section_text_sha256 === item.section_pin.section_text_sha256
    ));
    if (parentMatches.length !== 1) {
      fail(
        'PROMPT_BUDGET_PARENT_WORK_ITEM_NOT_EXECUTABLE',
        `PASS preflight ${preflight.preflight_id} must contain EXTRACT work item ${item.work_item_id} exactly once.`,
        { match_count: parentMatches.length },
      );
    }
    const [parent] = parentMatches;
    if (!Number.isSafeInteger(parent.prompt_byte_length)
      || !Number.isSafeInteger(parent.prompt_byte_ceiling)
      || parent.prompt_byte_length > parent.prompt_byte_ceiling
      || parent.prompt_byte_ceiling !== preflight.prompt_byte_ceiling) {
      fail(
        'PROMPT_BUDGET_PARENT_WORK_ITEM_OVER_CEILING',
        `EXTRACT work item ${item.work_item_id} is not proved within its prompt-byte ceiling.`,
        {
          prompt_byte_length: parent.prompt_byte_length,
          prompt_byte_ceiling: parent.prompt_byte_ceiling,
          preflight_prompt_byte_ceiling: preflight.prompt_byte_ceiling,
        },
      );
    }
  }

  return Object.freeze({
    status: 'PASS',
    extract_work_item_ids: Object.freeze(extractItems.map((item) => item.work_item_id).sort()),
    preflight_ids: Object.freeze(promptBudgetSplitPreflights.map((preflight) => preflight.preflight_id).sort()),
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

function resolveRecordedContextFile(rootDir, relativePath) {
  if (path.isAbsolute(relativePath)) {
    fail('INVALID_MANIFEST', 'recorded_admitted_source_context_path must be relative to root_dir.');
  }
  const root = path.resolve(rootDir);
  const file = path.resolve(root, relativePath);
  if (file !== root && !file.startsWith(`${root}${path.sep}`)) {
    fail('INVALID_MANIFEST', 'recorded_admitted_source_context_path escapes root_dir.');
  }
  if (!fs.statSync(file).isFile()) {
    fail('RECORDED_CONTEXT_FILE_MISSING', `recorded source context is missing: ${relativePath}`);
  }
  return file;
}

function loadRecordedSourceForDiagnostic(source, rootDir) {
  let recorded;
  try {
    recorded = JSON.parse(fs.readFileSync(
      resolveRecordedContextFile(rootDir, source.recorded_admitted_source_context_path),
      'utf8',
    ));
  } catch (error) {
    if (error instanceof NativeUnifiedRunValidationError) throw error;
    fail('INVALID_RECORDED_CONTEXT', `source ${source.source_id} recorded context file is not valid JSON.`);
  }
  if (!recorded || typeof recorded !== 'object' || Array.isArray(recorded)
    || !Array.isArray(recorded.admitted_source_contexts)
    || recorded.admitted_source_contexts.length !== 1) {
    fail('INVALID_RECORDED_CONTEXT', `source ${source.source_id} must load exactly one recorded admitted source context.`);
  }
  const context = recorded.admitted_source_contexts[0];
  if (context.admitted_semantic_source_context_id !== source.admitted_semantic_source_context_id
    || context.canonical_text_sha256 !== source.canonical_text_sha256
    || context.canonical_text_byte_length !== source.canonical_text_byte_length
    || context.document_hash !== source.document_hash) {
    fail('RECORDED_CONTEXT_PIN_MISMATCH', `source ${source.source_id} recorded context does not match its explicit manifest pins.`);
  }
  const diagnosticContext = Object.freeze({
    schema_version: DIAGNOSTIC_CONTEXT_SCHEMA,
    authority: 'NONE',
    document_hash: context.document_hash,
    canonical_text_sha256: context.canonical_text_sha256,
    canonical_text_byte_length: context.canonical_text_byte_length,
    canonical_text: Object.freeze({
      schema_version: 'NATIVE_DIAGNOSTIC_CANONICAL_TEXT/V1',
      text: context.canonical_text.text,
    }),
  });
  return Object.freeze({
    source_id: source.source_id,
    disposition: 'DIAGNOSTIC_RECORDED_SOURCE',
    authority: 'NONE',
    context: diagnosticContext,
    tree: sectionizeAdmittedSource({
      source_text: context.canonical_text.text,
      document_hash: context.document_hash,
    }),
  });
}

function loadSourceForDiagnostic({ source, root_dir: rootDir = process.cwd() } = {}) {
  validateSourceDeclaration(source);
  if (source.disposition === 'BLOCKED_SOURCE_PIN') return Object.freeze({ source_id: source.source_id, disposition: source.disposition, blocking_code: source.blocking_code });
  if (source.disposition === 'ADMITTED_RECORDED') return loadRecordedSourceForDiagnostic(source, rootDir);
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
  const context = Object.freeze({
    schema_version: DIAGNOSTIC_CONTEXT_SCHEMA,
    authority: 'NONE',
    document_hash: sha256Hex(rawBytes),
    canonical_text_sha256: conversion.canonical_text_sha256,
    canonical_text_byte_length: conversion.canonical_text_byte_length,
    canonical_text: Object.freeze({
      schema_version: 'NATIVE_DIAGNOSTIC_CANONICAL_TEXT/V1',
      text: conversion.canonical_text,
    }),
  });
  return Object.freeze({
    source_id: source.source_id,
    disposition: 'DIAGNOSTIC_LOCAL_SOURCE',
    authority: 'NONE',
    context,
    tree: sectionizeAdmittedSource({ source_text: conversion.canonical_text, document_hash: context.document_hash }),
  });
}

function loadAdmittedSourceForExecution({ source, root_dir: rootDir = process.cwd() } = {}) {
  validateSourceDeclaration(source);
  fail('TRUSTED_SOURCE_ADMISSION_VERIFIER_UNAVAILABLE', 'Caller source declarations cannot create an admitted source for execution.');
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

function validateUnifiedRunManifestDiagnostic({ manifest, root_dir: rootDir = process.cwd() } = {}) {
  const normalized = canonicalManifest(manifest);
  const sources = new Map(normalized.sources.map((source) => [
    source.source_id,
    loadSourceForDiagnostic({ source, root_dir: rootDir }),
  ]));
  const workItemDiagnostics = normalized.work_items.map((item) => {
    const admitted = sources.get(item.source_id);
    if (item.disposition === 'BLOCKED_SOURCE_PIN') {
      if (admitted.disposition !== 'BLOCKED_SOURCE_PIN') fail('INVALID_BLOCKED_WORK_ITEM', `work item ${item.work_item_id} blocks an admitted source.`);
      return Object.freeze({ work_item_id: item.work_item_id, source_id: item.source_id, family_id: item.family_id, diagnostic_state: 'BLOCKED_SOURCE_PIN', blocking_code: item.blocking_code });
    }
    if (admitted.disposition === 'BLOCKED_SOURCE_PIN') fail('BLOCKED_SOURCE_PIN', `work item ${item.work_item_id} cannot make a presence or absence conclusion for a blocked source.`);
    if (item.disposition === 'NOT_PRESENT') {
      return Object.freeze({
        work_item_id: item.work_item_id,
        source_id: item.source_id,
        family_id: item.family_id,
        diagnostic_state: 'NO_PRESENCE_CONCLUSION_PENDING_TRUSTED_ABSENCE_EVIDENCE',
      });
    }
    const node = findSectionByReference(admitted.tree, item.section_pin.section_reference);
    verifyNodePin(node, item.section_pin, item.work_item_id);
    return Object.freeze({
      work_item_id: item.work_item_id,
      source_id: item.source_id,
      family_id: item.family_id,
      diagnostic_state: 'EXTRACT_CANDIDATE_PENDING_TRUSTED_SOURCE_ADMISSION',
      section_reference: node.reference,
      section_id: node.section_id,
      section_kind: node.kind,
      section_text_sha256: node.text_sha256,
    });
  });
  const diagnosticBody = {
    schema_version: DIAGNOSTIC_MANIFEST_SCHEMA,
    status: 'BLOCKED_PROPOSAL_ONLY_NOT_EXECUTION_AUTHORITY',
    authority: 'NONE',
    source_count: normalized.sources.length,
    source_diagnostics: [...sources.values()].map((source) => Object.freeze({
      source_id: source.source_id,
      diagnostic_disposition: source.disposition,
      authority: 'NONE',
    })),
    work_item_diagnostics: workItemDiagnostics,
  };
  const diagnosticManifest = Object.freeze({
    ...diagnosticBody,
    diagnostic_manifest_id: contentId(DIAGNOSTIC_MANIFEST_SCHEMA, diagnosticBody),
  });
  const receiptBody = {
    schema_version: DIAGNOSTIC_RECEIPT_SCHEMA,
    status: 'BLOCKED_PROPOSAL_ONLY_NOT_EXECUTION_AUTHORITY',
    authority: 'NONE',
    diagnostic_manifest_id: diagnosticManifest.diagnostic_manifest_id,
    source_count: normalized.sources.length,
    work_item_count: workItemDiagnostics.length,
  };
  return Object.freeze({
    receipt: Object.freeze({ ...receiptBody, diagnostic_receipt_id: contentId(DIAGNOSTIC_RECEIPT_SCHEMA, receiptBody) }),
    diagnostic_manifest: diagnosticManifest,
  });
}

function validateUnifiedRunManifest({ manifest } = {}) {
  canonicalManifest(manifest);
  fail('TRUSTED_UNIFIED_RUN_VERIFIER_UNAVAILABLE', 'Caller manifests cannot produce an executable unified-run validation result.');
}

module.exports = {
  MANIFEST_SCHEMA,
  RECEIPT_SCHEMA,
  SEMANTIC_MANIFEST_SCHEMA,
  ABSENCE_PROOF_SCHEMA,
  EXECUTION_PLAN_SCHEMA,
  DIAGNOSTIC_CONTEXT_SCHEMA,
  DIAGNOSTIC_MANIFEST_SCHEMA,
  DIAGNOSTIC_RECEIPT_SCHEMA,
  NativeUnifiedRunValidationError,
  buildExecutionPlanSummary,
  validateSourceDeclaration,
  loadSourceForDiagnostic,
  loadAdmittedSourceForExecution,
  validatePromptBudgetSplitPreflightFence,
  validateUnifiedRunManifestDiagnostic,
  validateUnifiedRunManifest,
};
