'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { canonicalJson, contentId, utf8ByteLength, utf8Slice } = require('../canonical-bytes');
const { findSectionByReference } = require('./deterministic-sectionizer');
const { getProducerPromptModule } = require('./producer-prompt-registry');
const { loadPilotWorkItems } = require('./m3-12-call-pilot-quality-gate');
const { loadAdmittedSourceForExecution } = require('./unified-runner-validate');

const PREFLIGHT_SCHEMA = 'M3_12_CALL_PILOT_PROMPT_BUDGET_PREFLIGHT/V1';
const PILOT_MANIFEST_PATH = 'tests/fixtures/canonical-v2/m3-12-call-pilot-manifest.json';
const PROMPT_BYTE_CEILING = 64 * 1024;

class PilotPromptBudgetPreflightError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'PilotPromptBudgetPreflightError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new PilotPromptBudgetPreflightError(code, message, details);
}

function resolveFile(rootDir, relativePath) {
  if (typeof relativePath !== 'string' || !relativePath || path.isAbsolute(relativePath)) {
    fail('INVALID_SOURCE_PATH', 'raw_file_path must be a non-empty path relative to root_dir.');
  }
  const root = path.resolve(rootDir);
  const file = path.resolve(root, relativePath);
  if (file !== root && !file.startsWith(`${root}${path.sep}`)) fail('INVALID_SOURCE_PATH', 'raw_file_path escapes root_dir.');
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) fail('SOURCE_FILE_MISSING', 'The admitted source file is unavailable.', { raw_file_path: relativePath });
  return file;
}

function loadPilotManifest(rootDir) {
  const manifestPath = resolveFile(rootDir, PILOT_MANIFEST_PATH);
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    fail('INVALID_PILOT_MANIFEST', 'The pilot manifest is not valid JSON.', { cause: error.code || error.name });
  }
}

function requireExactSection(node, pin, workItemId) {
  if (!node || !pin || node.section_id !== pin.section_id || node.kind !== pin.section_kind || node.text_sha256 !== pin.section_text_sha256) {
    fail('SECTION_PIN_MISMATCH', 'The pilot section pin does not match the admitted section tree.', { work_item_id: workItemId });
  }
}

function buildPromptBudgetCall({ source, work_item: workItem, root_dir: rootDir = process.cwd(), prompt_byte_ceiling: promptByteCeiling = PROMPT_BYTE_CEILING, admitted_source: admittedSource } = {}) {
  if (!Number.isSafeInteger(promptByteCeiling) || promptByteCeiling <= 0) {
    fail('INVALID_PROMPT_BYTE_CEILING', 'prompt_byte_ceiling must be a positive safe integer.');
  }
  if (!workItem || workItem.disposition !== 'EXTRACT') fail('INVALID_WORK_ITEM', 'Prompt budgeting requires an EXTRACT work item.');
  const promptBuilder = getProducerPromptModule(workItem.family_id);
  if (!promptBuilder) fail('UNREGISTERED_FAMILY', 'The pilot work item family has no registered prompt builder.', { work_item_id: workItem.work_item_id, family_id: workItem.family_id });
  const admitted = admittedSource || loadAdmittedSourceForExecution({ source, root_dir: rootDir });
  const node = findSectionByReference(admitted.tree, workItem.section_pin && workItem.section_pin.section_reference);
  requireExactSection(node, workItem.section_pin, workItem.work_item_id);
  const sectionText = utf8Slice(admitted.context.canonical_text.text, node.start, node.end);
  const governedScope = Object.freeze({
    schema_version: 'NATIVE_GOVERNED_SCOPE/V1',
    document_hash: admitted.context.document_hash,
    section_reference: node.reference,
    section_id: node.section_id,
    parent_section_id: node.parent_section_id,
    kind: node.kind,
    depth: node.depth,
    start: node.start,
    end: node.end,
    text_sha256: node.text_sha256,
    source_text: sectionText,
  });
  const prompt = promptBuilder({
    source_text: sectionText,
    governed_scope: governedScope,
    known_definitions: [],
  });
  const promptByteLength = utf8ByteLength(canonicalJson(prompt.messages));
  if (promptByteLength > promptByteCeiling) {
    fail('PROMPT_BYTE_CEILING_EXCEEDED', 'The registered prompt exceeds the conservative per-call byte ceiling.', {
      work_item_id: workItem.work_item_id,
      prompt_byte_length: promptByteLength,
      prompt_byte_ceiling: promptByteCeiling,
    });
  }
  return Object.freeze({
    work_item_id: workItem.work_item_id,
    source_id: source.source_id,
    family_id: workItem.family_id,
    section_reference: node.reference,
    section_id: node.section_id,
    section_text_sha256: node.text_sha256,
    section_text_byte_length: utf8ByteLength(sectionText),
    prompt_id: prompt.prompt_id,
    prompt_version: prompt.prompt_version,
    prompt_byte_length: promptByteLength,
    prompt_byte_ceiling: promptByteCeiling,
  });
}

function buildPilotPromptBudgetPreflight({ root_dir: rootDir = process.cwd() } = {}) {
  const expectedWorkItems = loadPilotWorkItems({ root_dir: rootDir });
  const manifest = loadPilotManifest(rootDir);
  const manifestWorkItems = new Map((manifest.work_items || []).map((item) => [item.work_item_id, item]));
  const sources = new Map((manifest.sources || []).map((source) => [source.source_id, source]));
  const admittedSources = new Map();
  const calls = expectedWorkItems.filter((item) => item.disposition === 'EXTRACT').map((expected) => {
    const workItem = manifestWorkItems.get(expected.work_item_id);
    if (!workItem || workItem.source_id !== expected.source_id || workItem.family_id !== expected.family_id || workItem.disposition !== expected.disposition) {
      fail('PILOT_MANIFEST_MISMATCH', 'The detailed pilot work item does not match the pinned pilot cohort.', { work_item_id: expected.work_item_id });
    }
    const source = sources.get(workItem.source_id);
    if (!admittedSources.has(workItem.source_id)) {
      admittedSources.set(workItem.source_id, loadAdmittedSourceForExecution({ source, root_dir: rootDir }));
    }
    return buildPromptBudgetCall({
      source,
      work_item: workItem,
      root_dir: rootDir,
      admitted_source: admittedSources.get(workItem.source_id),
    });
  });
  const body = {
    schema_version: PREFLIGHT_SCHEMA,
    prompt_byte_ceiling: PROMPT_BYTE_CEILING,
    call_count: calls.length,
    calls,
    total_prompt_byte_length: calls.reduce((total, call) => total + call.prompt_byte_length, 0),
  };
  return Object.freeze({ ...body, preflight_id: contentId(PREFLIGHT_SCHEMA, body) });
}

module.exports = {
  PREFLIGHT_SCHEMA,
  PROMPT_BYTE_CEILING,
  PilotPromptBudgetPreflightError,
  buildPilotPromptBudgetPreflight,
  buildPromptBudgetCall,
};
