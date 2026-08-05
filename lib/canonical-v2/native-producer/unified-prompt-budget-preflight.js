'use strict';

const { canonicalJson, contentId, utf8ByteLength, utf8Slice } = require('../canonical-bytes');
const { findSectionByReference } = require('./deterministic-sectionizer');
const { getProducerPromptModule } = require('./producer-prompt-registry');
const { bindNativePromptToGovernedScope } = require('./native-prompt-binding');
const { loadAdmittedSourceForExecution, validateUnifiedRunManifest } = require('./unified-runner-validate');

const PREFLIGHT_SCHEMA = 'NATIVE_UNIFIED_RUN_PROMPT_BUDGET_PREFLIGHT/V1';
const POLICY_SCHEMA = 'NATIVE_UNIFIED_RUN_PROMPT_BUDGET_POLICY/V1';
const PROMPT_DOMAIN = 'NATIVE_UNIFIED_RUN_PREFLIGHT_PROMPT/V1';
const DIGEST_RE = /^[a-f0-9]{64}$/;

class UnifiedPromptBudgetPreflightError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'UnifiedPromptBudgetPreflightError';
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details) {
  throw new UnifiedPromptBudgetPreflightError(code, message, details);
}

function exactKeys(value, keys) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}

function validatePolicy(policy) {
  if (!exactKeys(policy, ['schema_version', 'policy_id', 'policy_version', 'prompt_byte_ceiling', 'policy_digest'])
    || policy.schema_version !== POLICY_SCHEMA
    || typeof policy.policy_id !== 'string' || !policy.policy_id.trim() || policy.policy_id.trim() !== policy.policy_id
    || !Number.isSafeInteger(policy.policy_version) || policy.policy_version < 1
    || !Number.isSafeInteger(policy.prompt_byte_ceiling) || policy.prompt_byte_ceiling < 1
    || typeof policy.policy_digest !== 'string' || !DIGEST_RE.test(policy.policy_digest)) {
    fail('INVALID_PROMPT_BUDGET_POLICY', 'prompt_budget_policy must be an exact content-addressed policy.');
  }
  const body = {
    schema_version: policy.schema_version,
    policy_id: policy.policy_id,
    policy_version: policy.policy_version,
    prompt_byte_ceiling: policy.prompt_byte_ceiling,
  };
  if (policy.policy_digest !== contentId(POLICY_SCHEMA, body)) {
    fail('PROMPT_BUDGET_POLICY_DIGEST_MISMATCH', 'prompt_budget_policy does not match its content identity.');
  }
  return Object.freeze({ ...policy });
}

function buildPromptBudgetPolicy({ policy_id: policyId, policy_version: policyVersion, prompt_byte_ceiling: promptByteCeiling } = {}) {
  const body = {
    schema_version: POLICY_SCHEMA,
    policy_id: policyId,
    policy_version: policyVersion,
    prompt_byte_ceiling: promptByteCeiling,
  };
  return Object.freeze({ ...body, policy_digest: contentId(POLICY_SCHEMA, body) });
}

function governedScope(admitted, node) {
  const sectionText = utf8Slice(admitted.context.canonical_text.text, node.start, node.end);
  return Object.freeze({
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
}

function buildPromptCall({ workItem, source, admitted, policy }) {
  const promptBuilder = getProducerPromptModule(workItem.family_id);
  if (!promptBuilder) {
    fail('UNREGISTERED_FAMILY', `work item ${workItem.work_item_id} has no registered prompt builder.`, {
      family_id: workItem.family_id,
    });
  }
  const node = findSectionByReference(admitted.tree, workItem.section_reference);
  if (!node || node.section_id !== workItem.section_id || node.kind !== workItem.section_kind
    || node.text_sha256 !== workItem.section_text_sha256) {
    fail('SECTION_PIN_MISMATCH', `work item ${workItem.work_item_id} no longer matches its validated section pin.`);
  }
  const scope = governedScope(admitted, node);
  const rawPrompt = promptBuilder({
    source_text: scope.source_text,
    governed_scope: scope,
    known_definitions: [],
  });
  const prompt = bindNativePromptToGovernedScope({ prompt: rawPrompt, governed_scope: scope });
  const promptByteLength = utf8ByteLength(canonicalJson(prompt.messages));
  return Object.freeze({
    work_item_id: workItem.work_item_id,
    source_id: source.source_id,
    family_id: workItem.family_id,
    section_reference: node.reference,
    section_id: node.section_id,
    section_text_sha256: node.text_sha256,
    section_text_byte_length: utf8ByteLength(scope.source_text),
    prompt_id: prompt.prompt_id,
    prompt_version: prompt.prompt_version,
    prompt_binding_schema: prompt.prompt_binding_schema,
    prompt_identity: contentId(PROMPT_DOMAIN, prompt),
    prompt_byte_length: promptByteLength,
    prompt_byte_ceiling: policy.prompt_byte_ceiling,
    status: promptByteLength <= policy.prompt_byte_ceiling ? 'WITHIN_POLICY' : 'EXCEEDS_POLICY',
  });
}

function summaries(calls, key, label) {
  const aggregate = new Map();
  for (const call of calls) {
    const value = call[key];
    const prior = aggregate.get(value) || { [key]: value, call_count: 0, total_prompt_byte_length: 0, total_section_text_byte_length: 0 };
    prior.call_count += 1;
    prior.total_prompt_byte_length += call.prompt_byte_length;
    prior.total_section_text_byte_length += call.section_text_byte_length;
    aggregate.set(value, prior);
  }
  return Object.freeze([...aggregate.values()].sort((left, right) => left[key].localeCompare(right[key]))
    .map((value) => Object.freeze({ [label]: value[key], call_count: value.call_count, total_prompt_byte_length: value.total_prompt_byte_length, total_section_text_byte_length: value.total_section_text_byte_length })));
}

function blockedMissingPolicy(validation) {
  const body = {
    schema_version: PREFLIGHT_SCHEMA,
    status: 'BLOCKED_MISSING_POLICY',
    unified_run_manifest_id: validation.receipt.unified_run_manifest_id,
    validation_receipt_id: validation.receipt.validation_receipt_id,
    prompt_budget_policy: null,
    calls: Object.freeze([]),
    totals_by_family: Object.freeze([]),
    totals_by_source: Object.freeze([]),
    total_prompt_byte_length: 0,
    total_section_text_byte_length: 0,
  };
  return Object.freeze({ ...body, preflight_id: contentId(PREFLIGHT_SCHEMA, body) });
}

function buildUnifiedPromptBudgetPreflight({
  manifest,
  prompt_budget_policy: promptBudgetPolicy,
  root_dir: rootDir = process.cwd(),
} = {}) {
  const validation = validateUnifiedRunManifest({ manifest, root_dir: rootDir });
  if (promptBudgetPolicy === undefined || promptBudgetPolicy === null) return blockedMissingPolicy(validation);
  const policy = validatePolicy(promptBudgetPolicy);
  const sourceById = new Map(manifest.sources.map((source) => [source.source_id, source]));
  const admittedBySourceId = new Map();
  const extractItems = validation.semantic_manifest.work_items
    .filter((workItem) => workItem.disposition === 'EXTRACT')
    .sort((left, right) => left.work_item_id.localeCompare(right.work_item_id));
  const calls = extractItems.map((workItem) => {
    const source = sourceById.get(workItem.source_id);
    if (!admittedBySourceId.has(source.source_id)) {
      admittedBySourceId.set(source.source_id, loadAdmittedSourceForExecution({ source, root_dir: rootDir }));
    }
    return buildPromptCall({
      workItem,
      source,
      admitted: admittedBySourceId.get(source.source_id),
      policy,
    });
  });
  const status = calls.some((call) => call.status === 'EXCEEDS_POLICY')
    ? 'BLOCKED_PROMPT_BYTE_CEILING' : 'PASS';
  const body = {
    schema_version: PREFLIGHT_SCHEMA,
    status,
    unified_run_manifest_id: validation.receipt.unified_run_manifest_id,
    validation_receipt_id: validation.receipt.validation_receipt_id,
    prompt_budget_policy: policy,
    calls: Object.freeze(calls),
    totals_by_family: summaries(calls, 'family_id', 'family_id'),
    totals_by_source: summaries(calls, 'source_id', 'source_id'),
    total_prompt_byte_length: calls.reduce((total, call) => total + call.prompt_byte_length, 0),
    total_section_text_byte_length: calls.reduce((total, call) => total + call.section_text_byte_length, 0),
  };
  return Object.freeze({ ...body, preflight_id: contentId(PREFLIGHT_SCHEMA, body) });
}

module.exports = {
  PREFLIGHT_SCHEMA,
  POLICY_SCHEMA,
  UnifiedPromptBudgetPreflightError,
  buildPromptBudgetPolicy,
  buildUnifiedPromptBudgetPreflight,
};
