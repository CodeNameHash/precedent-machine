#!/usr/bin/env node

import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyClassificationDecisions,
  buildLexicalClassificationInventory,
} from './stage-2y-f-lexical-classification.mjs';

const require = createRequire(import.meta.url);
const { canonicalJson, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { createCodexCliClient, JSON_ONLY_INSTRUCTION } = require('../lib/llm-cli-client');
const { PROVIDER_ID, resolveProfile } = require('../lib/canonical-v2/native-producer/codex-cli-provider');

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(SCRIPT_DIR, '..');
const DEFAULT_OUTPUT = 'evidence/canonical-v2/stage-2y-f-terra-adjudication.json';
const EXPECTED_ROOT_COUNT = 164;
const SCHEMA_VERSION = 'STAGE_2Y_F_TERRA_ADJUDICATION/V1';
const PROFILE_ID = 'TERRA_MEDIUM';
const CLASSIFICATION_SOURCE = 'TERRA_ADJUDICATION';
const MODEL_OUTPUT_CLASSES = new Set(['SAME_CONCEPT_REPEAT', 'GENUINE_UNCAPTURED_ITEM', 'AMBIGUOUS_NEEDS_REVIEW']);
let atomicWriteSequence = 0;

function hash(value) {
  return `sha256:${sha256Hex(Buffer.from(typeof value === 'string' ? value : canonicalJson(value), 'utf8'))}`;
}
function plain(value) { return value && typeof value === 'object' && !Array.isArray(value); }
function string(value) { return typeof value === 'string' && value.trim().length > 0; }
function stringArray(value) { return Array.isArray(value) && value.every(string) && new Set(value).size === value.length; }
function isoDate(value) { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value); }
function usage(value) {
  return plain(value) && ['input_tokens', 'cached_input_tokens', 'output_tokens', 'reasoning_output_tokens']
    .every((key) => Number.isInteger(value[key]) && value[key] >= 0);
}
function sectionBytes(root) {
  return Buffer.from(root.canonical_text || '', 'utf8').subarray(root.section.start, root.section.end);
}
function excerpt(bytes, start, end) {
  let left = Math.max(0, start - 80); let right = Math.min(bytes.length, end + 80);
  while (left < bytes.length && (bytes[left] & 0xc0) === 0x80) left += 1;
  while (right > 0 && right < bytes.length && (bytes[right] & 0xc0) === 0x80) right -= 1;
  return bytes.subarray(left, right).toString('utf8');
}
function candidateCard(root, entry) {
  const claim = entry?.candidate?.claim || entry?.claim;
  if (!claim) return null;
  const bytes = sectionBytes(root);
  return {
    claim_revision_id: claim.claim_revision_id || null,
    claim_occurrence_id: claim.claim_occurrence_id || null,
    claim_definition_key: claim.claim_definition_key || null,
    canonical_value: claim.canonical_value,
    raw_value: claim.raw_value || null,
    evidence: (claim.evidence || []).map((edge) => ({
      claim_evidence_id: edge.claim_evidence_id || null,
      evidence_role: edge.evidence_role || null,
      absolute_start: edge.absolute_start,
      absolute_end: edge.absolute_end,
      excerpt: Number.isInteger(edge.absolute_start) && Number.isInteger(edge.absolute_end)
        ? excerpt(bytes, edge.absolute_start, edge.absolute_end) : null,
    })),
  };
}
function distinctCards(root, entries) {
  const byId = new Map();
  for (const entry of entries) {
    const card = candidateCard(root, entry); if (!card) continue;
    const id = card.claim_revision_id || card.claim_occurrence_id || canonicalJson(card);
    if (!byId.has(id)) byId.set(id, card);
  }
  return [...byId.values()].sort((left, right) => String(left.claim_revision_id || left.claim_occurrence_id).localeCompare(String(right.claim_revision_id || right.claim_occurrence_id)));
}
function buildTerraAdjudicationInput(root) {
  return {
    schema_version: 'STAGE_2Y_F_TERRA_ADJUDICATION_INPUT/V1',
    root_id: root.root_id,
    evidence_fingerprint: root.evidence_fingerprint,
    deal: root.deal,
    family: root.family,
    section_reference: root.section_reference,
    concept_key: root.concept_key,
    disagreement_items: root.disagreement_items.map((item) => ({
      disagreement_id: item.disagreement_id, pattern_id: item.pattern_id, exact_hit_text: item.exact_hit_text,
      excerpt: item.excerpt, start: item.start, end: item.end,
    })),
    resolved_claims: distinctCards(root, root.resolved_entries),
    compiled_candidate_context: distinctCards(root, root.compiled_candidates),
  };
}
function buildTerraPrompt(input) {
  return [
    'Classify one lexical-disagreement root from a recorded merger-agreement extraction. Use only this evidence card.',
    'Choose exactly one classification: SAME_CONCEPT_REPEAT, GENUINE_UNCAPTURED_ITEM, or AMBIGUOUS_NEEDS_REVIEW.',
    'SAME_CONCEPT_REPEAT is allowed only when every disagreement signal names the same legal concept already captured by resolved_claims. Same family, nearby text, or a compiled candidate that is not resolved is not enough.',
    'GENUINE_UNCAPTURED_ITEM is allowed only for a distinct legal item absent from resolved_claims. AMBIGUOUS_NEEDS_REVIEW is required whenever the evidence does not prove either result.',
    'Return one JSON object only. The discriminant key is exactly "classification", not "class". Echo root_id and evidence_fingerprint exactly. Do not add keys that are not in the selected shape.',
    'SAME_CONCEPT_REPEAT shape: {"root_id":"<exact root_id>","evidence_fingerprint":"<exact evidence_fingerprint>","classification":"SAME_CONCEPT_REPEAT","rationale":"<reason>","covered_claim_revision_ids":["<every resolved_claims claim_revision_id>"],"covered_disagreement_ids":["<every disagreement_id>"]}',
    'GENUINE_UNCAPTURED_ITEM shape: {"root_id":"<exact root_id>","evidence_fingerprint":"<exact evidence_fingerprint>","classification":"GENUINE_UNCAPTURED_ITEM","rationale":"<reason>","missing_item_description":"<distinct missing legal item>","follow_up_id":"<stable proposed identifier>","proving_disagreement_ids":["<one or more disagreement_id values>"]}',
    'AMBIGUOUS_NEEDS_REVIEW shape: {"root_id":"<exact root_id>","evidence_fingerprint":"<exact evidence_fingerprint>","classification":"AMBIGUOUS_NEEDS_REVIEW","rationale":"<reason>","review_question":"<specific question needed to decide>"}',
    `EVIDENCE_CARD=${canonicalJson(input)}`,
  ].join('\n\n');
}
function validateModelOutput(value, input) {
  const errors = [];
  if (!plain(value)) return { errors: ['MODEL_OUTPUT_NOT_OBJECT'] };
  const classification = value.classification;
  const required = new Set(['root_id', 'evidence_fingerprint', 'classification', 'rationale']);
  if (classification === 'SAME_CONCEPT_REPEAT') ['covered_claim_revision_ids', 'covered_disagreement_ids'].forEach((key) => required.add(key));
  if (classification === 'GENUINE_UNCAPTURED_ITEM') ['missing_item_description', 'follow_up_id', 'proving_disagreement_ids'].forEach((key) => required.add(key));
  if (classification === 'AMBIGUOUS_NEEDS_REVIEW') required.add('review_question');
  if (!MODEL_OUTPUT_CLASSES.has(classification)) errors.push('MODEL_OUTPUT_CLASS_INVALID');
  if (Object.keys(value).some((key) => !required.has(key))) errors.push('MODEL_OUTPUT_UNEXPECTED_FIELD');
  if ([...required].some((key) => !Object.hasOwn(value, key))) errors.push('MODEL_OUTPUT_REQUIRED_FIELD_MISSING');
  if (value.root_id !== input.root_id) errors.push('MODEL_OUTPUT_ROOT_ID_MISMATCH');
  if (value.evidence_fingerprint !== input.evidence_fingerprint) errors.push('MODEL_OUTPUT_EVIDENCE_FINGERPRINT_MISMATCH');
  if (!string(value.rationale)) errors.push('MODEL_OUTPUT_RATIONALE_INVALID');
  if (classification === 'SAME_CONCEPT_REPEAT' && (!stringArray(value.covered_claim_revision_ids) || !stringArray(value.covered_disagreement_ids))) errors.push('MODEL_OUTPUT_SAME_COVERAGE_INVALID');
  if (classification === 'GENUINE_UNCAPTURED_ITEM' && (!string(value.missing_item_description) || !string(value.follow_up_id) || !stringArray(value.proving_disagreement_ids) || value.proving_disagreement_ids.length === 0)) errors.push('MODEL_OUTPUT_GENUINE_FIELDS_INVALID');
  if (classification === 'AMBIGUOUS_NEEDS_REVIEW' && !string(value.review_question)) errors.push('MODEL_OUTPUT_REVIEW_QUESTION_INVALID');
  return { errors };
}
function inventoryDigest(inventory) {
  return hash(inventory.roots.map((root) => ({
    root_id: root.root_id, evidence_fingerprint: root.evidence_fingerprint,
    candidate_digest: root.candidate_digest, section_hash: root.section.text_sha256,
  })).sort((left, right) => left.root_id.localeCompare(right.root_id)));
}
function profileMetadata() {
  const profile = resolveProfile(PROFILE_ID);
  return { provider_id: PROVIDER_ID, profile_id: profile.profile_id, requested_model_id: `${profile.model};reasoning=${profile.reasoning_effort};profile=${profile.profile_id}` };
}
function callId(call) {
  const { call_id, ...withoutId } = call;
  return hash(withoutId);
}
function artifactId(artifact) {
  return hash({
    schema_version: artifact.schema_version, inventory_digest: artifact.inventory_digest,
    expected_call_count: artifact.expected_call_count, actual_call_count: artifact.actual_call_count,
    provider: artifact.provider, calls: artifact.calls,
    publication_authorisation: artifact.publication_authorisation,
    matcher_change_authorisation: artifact.matcher_change_authorisation,
  });
}
function decisionFromOutput({ output, call, reviewedAt, artifactId = null }) {
  const terraDecisionId = artifactId === null ? null : hash({ artifact_id: artifactId, root_id: call.root_id, terra_call_id: call.call_id, model_output: output });
  return {
    ...output,
    reviewed_by: `${call.provider_id}:${call.requested_model_id}`,
    reviewed_on: reviewedAt.slice(0, 10),
    classification_source: CLASSIFICATION_SOURCE,
    terra_call_id: call.call_id,
    terra_artifact_id: artifactId,
    terra_decision_id: terraDecisionId,
    terra_provenance: {
      provider_id: call.provider_id, profile_id: call.profile_id, requested_model_id: call.requested_model_id,
      input_digest: call.input_digest, prompt_digest: call.prompt_digest, response_digest: call.response_digest,
      provider_request_id: call.provider_request_id, artifact_id: artifactId, terra_decision_id: terraDecisionId,
    },
  };
}
function responseRecord(result) {
  return {
    provider_request_id: result?.provider_request_id || null,
    usage: result?.usage || null,
    codex_completion: result?.codex_completion || null,
    text: typeof result?.text === 'string' ? result.text : null,
  };
}
function modelOutputMatchesText(call) {
  if (typeof call?.model_output_text !== 'string') return false;
  try { return canonicalJson(JSON.parse(call.model_output_text)) === canonicalJson(call.model_output); } catch { return false; }
}
function orderedArtifact(artifact, inventory) {
  const ordinal = new Map(inventory.roots.map((root, index) => [root.root_id, index]));
  artifact.calls.sort((left, right) => ordinal.get(left.root_id) - ordinal.get(right.root_id));
  artifact.decisions.sort((left, right) => ordinal.get(left.root_id) - ordinal.get(right.root_id));
  artifact.actual_call_count = artifact.calls.length;
  return artifact;
}
function checkpointValidation({ inventory, artifact, expectedRootCount }) {
  const errors = [];
  if (!plain(artifact) || artifact.schema_version !== SCHEMA_VERSION) return ['CHECKPOINT_SCHEMA_INVALID'];
  if (artifact.inventory_digest !== inventoryDigest(inventory)) errors.push('CHECKPOINT_INVENTORY_DIGEST_MISMATCH');
  if (canonicalJson(artifact.provider) !== canonicalJson(profileMetadata())) errors.push('CHECKPOINT_PROVIDER_MISMATCH');
  if (artifact.expected_call_count !== expectedRootCount || !Array.isArray(artifact.calls) || !Array.isArray(artifact.decisions) || artifact.actual_call_count !== artifact.calls.length || artifact.calls.length > expectedRootCount) errors.push('CHECKPOINT_CALL_COUNT_INVALID');
  if (artifact.publication_authorisation !== 'NONE' || artifact.matcher_change_authorisation !== false) errors.push('CHECKPOINT_AUTHORISATION_INVALID');
  if (artifact.calls.length === expectedRootCount && artifact.artifact_id !== artifactId(artifact)) errors.push('CHECKPOINT_ARTIFACT_ID_MISMATCH');
  if (artifact.calls.length < expectedRootCount && artifact.artifact_id !== null) errors.push('CHECKPOINT_PARTIAL_ARTIFACT_ID_INVALID');
  const knownRoots = new Map(inventory.roots.map((root) => [root.root_id, root])); const decisions = new Map(); const calls = new Set(); const providerRequests = new Set();
  for (const decision of artifact.decisions || []) { if (!string(decision?.root_id) || decisions.has(decision.root_id)) errors.push('CHECKPOINT_DECISION_DUPLICATE'); else decisions.set(decision.root_id, decision); }
  for (const call of artifact.calls || []) {
    const root = knownRoots.get(call?.root_id);
    if (!root || calls.has(call.root_id)) { errors.push('CHECKPOINT_CALL_ROOT_INVALID'); continue; } calls.add(call.root_id);
    if (string(call.provider_request_id) && providerRequests.has(call.provider_request_id)) errors.push('CHECKPOINT_PROVIDER_REQUEST_DUPLICATE');
    if (string(call.provider_request_id)) providerRequests.add(call.provider_request_id);
    const input = buildTerraAdjudicationInput(root); const prompt = buildTerraPrompt(input);
    if (call.evidence_fingerprint !== root.evidence_fingerprint || call.input_digest !== hash(input) || call.prompt_digest !== hash(prompt) || call.call_id !== callId(call) || !isoDate(call.reviewed_at)) errors.push('CHECKPOINT_CALL_BINDING_MISMATCH');
    if (call.response_digest !== (typeof call.model_output_text === 'string' ? hash(call.model_output_text) : null)) errors.push('CHECKPOINT_RESPONSE_DIGEST_MISMATCH');
    if (!['COMPLETE', 'MALFORMED_OUTPUT', 'CALL_FAILED'].includes(call.state)) errors.push('CHECKPOINT_CALL_STATE_INVALID');
    if (call.state === 'COMPLETE') {
      if (validateModelOutput(call.model_output, input).errors.length || !modelOutputMatchesText(call) || !usage(call.usage) || call.codex_completion?.status !== 'COMPLETE' || call.codex_completion?.terminal_event !== 'turn.completed' || !string(call.provider_request_id)) errors.push('CHECKPOINT_COMPLETE_CALL_INVALID');
      const expectedDecision = decisionFromOutput({ output: call.model_output, call, reviewedAt: call.reviewed_at, artifactId: artifact.artifact_id || null });
      if (canonicalJson(decisions.get(root.root_id)) !== canonicalJson(expectedDecision)) errors.push('CHECKPOINT_DECISION_BINDING_MISMATCH');
    } else if (decisions.has(root.root_id)) errors.push('CHECKPOINT_NONCOMPLETE_DECISION_PRESENT');
  }
  for (const rootId of decisions.keys()) if (!calls.has(rootId)) errors.push('CHECKPOINT_ORPHAN_DECISION');
  return [...new Set(errors)].sort();
}
function terraAuthorityFromArtifact(artifact) {
  return {
    kind: 'STAGE_2Y_F_TERRA_ADJUDICATION_AUTHORITY/V1', artifact_id: artifact.artifact_id,
    bindings: new Map((artifact.decisions || []).map((decision) => [decision.root_id, {
      terra_call_id: decision.terra_call_id, terra_decision_id: decision.terra_decision_id,
    }])),
  };
}
async function makeCall({ root, invoke, reviewedAt, metadata }) {
    const input = buildTerraAdjudicationInput(root); const prompt = buildTerraPrompt(input);
    let result; let output; let state = 'COMPLETE'; let outputErrors = [];
    try {
      result = await invoke({ root, input, prompt });
      if (typeof result?.text !== 'string') outputErrors.push('MODEL_RESPONSE_TEXT_MISSING');
      else { try { output = JSON.parse(result.text); } catch { outputErrors.push('MODEL_OUTPUT_JSON_INVALID'); } }
      if (outputErrors.length === 0) outputErrors = validateModelOutput(output, input).errors;
      if (!usage(result?.usage) || result?.codex_completion?.status !== 'COMPLETE' || result?.codex_completion?.terminal_event !== 'turn.completed' || !string(result?.provider_request_id)) outputErrors.push('MODEL_TRANSPORT_PROVENANCE_INVALID');
    } catch (error) { state = 'CALL_FAILED'; outputErrors.push(`CALL_FAILED:${String(error?.message || error)}`); }
    if (outputErrors.length) state = state === 'CALL_FAILED' ? state : 'MALFORMED_OUTPUT';
    const response = responseRecord(result);
    const call = {
      root_id: root.root_id, evidence_fingerprint: root.evidence_fingerprint, input_digest: hash(input), prompt_digest: hash(prompt),
      response_digest: response.text === null ? null : hash(response.text), state, errors: outputErrors.sort(),
      model_output: output || null, model_output_text: response.text, reviewed_at: reviewedAt, ...metadata,
      provider_request_id: response.provider_request_id, usage: response.usage, codex_completion: response.codex_completion,
    };
    call.call_id = callId(call);
    return { call, decision: state === 'COMPLETE' ? decisionFromOutput({ output, call, reviewedAt }) : null };
}
async function runTerraAdjudication({ inventory, invoke, reviewedAt = new Date().toISOString(), expectedRootCount = EXPECTED_ROOT_COUNT, checkpointArtifact = null, onCheckpoint = null, concurrency = 4 } = {}) {
  if (!inventory || !Array.isArray(inventory.roots) || inventory.roots.length !== expectedRootCount) throw new Error('ROOT_COUNT_MISMATCH');
  if (typeof invoke !== 'function') throw new Error('TERRA_INVOKE_REQUIRED');
  if (!isoDate(reviewedAt)) throw new Error('REVIEWED_AT_INVALID');
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4) throw new Error('CONCURRENCY_INVALID');
  if (checkpointArtifact !== null) {
    const checkpointErrors = checkpointValidation({ inventory, artifact: checkpointArtifact, expectedRootCount });
    if (checkpointErrors.length) throw new Error(`RESUME_CHECKPOINT_INVALID:${checkpointErrors.join(',')}`);
  }
  const metadata = profileMetadata(); const artifact = checkpointArtifact === null ? {
    schema_version: SCHEMA_VERSION, inventory_digest: inventoryDigest(inventory), expected_call_count: expectedRootCount,
    actual_call_count: 0, provider: metadata, calls: [], decisions: [], artifact_id: null,
    publication_authorisation: 'NONE', matcher_change_authorisation: false,
  } : structuredClone(checkpointArtifact);
  const sealed = new Set(artifact.calls.map((call) => call.root_id)); const pending = inventory.roots.filter((root) => !sealed.has(root.root_id));
  let next = 0;
  async function worker() {
    while (next < pending.length) {
      const root = pending[next++]; const { call, decision } = await makeCall({ root, invoke, reviewedAt, metadata });
      artifact.calls.push(call); if (decision) artifact.decisions.push(decision); orderedArtifact(artifact, inventory);
      if (onCheckpoint) await onCheckpoint(structuredClone(artifact));
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, pending.length) }, () => worker()));
  orderedArtifact(artifact, inventory);
  if (artifact.calls.length === expectedRootCount) {
    artifact.artifact_id = artifactId(artifact);
    artifact.decisions = artifact.calls.filter((call) => call.state === 'COMPLETE')
      .map((call) => decisionFromOutput({ output: call.model_output, call, reviewedAt: call.reviewed_at, artifactId: artifact.artifact_id }));
  }
  return orderedArtifact(artifact, inventory);
}
function validateTerraAdjudicationArtifact({ inventory, artifact, expectedRootCount = EXPECTED_ROOT_COUNT } = {}) {
  const errors = [];
  if (!plain(artifact) || artifact.schema_version !== SCHEMA_VERSION) return { ok: false, errors: ['ARTIFACT_SCHEMA_INVALID'] };
  if (!inventory || !Array.isArray(inventory.roots) || inventory.roots.length !== expectedRootCount) errors.push('ROOT_COUNT_MISMATCH');
  if (artifact.inventory_digest !== inventoryDigest(inventory)) errors.push('INVENTORY_DIGEST_MISMATCH');
  if (canonicalJson(artifact.provider) !== canonicalJson(profileMetadata())) errors.push('ARTIFACT_PROVIDER_MISMATCH');
  if (artifact.publication_authorisation !== 'NONE' || artifact.matcher_change_authorisation !== false) errors.push('ARTIFACT_AUTHORISATION_INVALID');
  if (artifact.artifact_id !== artifactId(artifact)) errors.push('ARTIFACT_ID_MISMATCH');
  if (artifact.expected_call_count !== expectedRootCount || artifact.actual_call_count !== expectedRootCount || !Array.isArray(artifact.calls) || artifact.calls.length !== expectedRootCount) errors.push('CALL_COUNT_MISMATCH');
  const calls = new Map(); const providerRequests = new Set(); for (const call of artifact.calls || []) { if (!string(call?.root_id) || calls.has(call.root_id)) { errors.push('CALL_ROOT_DUPLICATE_OR_INVALID'); continue; } calls.set(call.root_id, call); if (!string(call.provider_request_id) || providerRequests.has(call.provider_request_id)) errors.push('CALL_PROVIDER_REQUEST_DUPLICATE_OR_INVALID'); else providerRequests.add(call.provider_request_id); }
  const decisions = new Map(); for (const decision of artifact.decisions || []) { if (!string(decision?.root_id) || decisions.has(decision.root_id)) { errors.push('DECISION_ROOT_DUPLICATE_OR_INVALID'); continue; } decisions.set(decision.root_id, decision); }
  for (const root of inventory.roots || []) {
    const call = calls.get(root.root_id); if (!call) { errors.push('CALL_ROOT_MISSING'); continue; }
    const input = buildTerraAdjudicationInput(root); const prompt = buildTerraPrompt(input);
    if (call.evidence_fingerprint !== root.evidence_fingerprint || call.input_digest !== hash(input) || call.prompt_digest !== hash(prompt) || call.provider_id !== artifact.provider.provider_id || call.profile_id !== artifact.provider.profile_id || call.requested_model_id !== artifact.provider.requested_model_id) errors.push('CALL_INPUT_PROVENANCE_MISMATCH');
    if (call.call_id !== callId(call)) errors.push('CALL_ID_MISMATCH');
    if (call.response_digest !== (typeof call.model_output_text === 'string' ? hash(call.model_output_text) : null)) errors.push('CALL_RESPONSE_DIGEST_MISMATCH');
    if (call.state !== 'COMPLETE') { errors.push('CALL_OUTPUT_INVALID'); continue; }
    const outputErrors = validateModelOutput(call.model_output, input).errors;
    if (outputErrors.length || !modelOutputMatchesText(call) || !usage(call.usage) || call.codex_completion?.status !== 'COMPLETE' || call.codex_completion?.terminal_event !== 'turn.completed' || !string(call.provider_request_id)) { errors.push('CALL_OUTPUT_INVALID'); continue; }
    const expectedDecision = decisionFromOutput({ output: call.model_output, call, reviewedAt: call.reviewed_at, artifactId: artifact.artifact_id });
    if (canonicalJson(decisions.get(root.root_id)) !== canonicalJson(expectedDecision)) errors.push('DECISION_CALL_BINDING_MISMATCH');
  }
  const terraAuthority = errors.includes('ARTIFACT_ID_MISMATCH') ? null : terraAuthorityFromArtifact(artifact);
  const applied = applyClassificationDecisions(inventory, { schema_version: 'STAGE_2Y_F_LEXICAL_DECISIONS/V1', decisions: artifact.decisions || [] }, { terraAuthority });
  for (const root of applied.roots) if (root.classification === 'INVALID_INPUT') errors.push('INVALID_ROOT');
  const uniqueErrors = [...new Set(errors)].sort();
  return {
    ok: uniqueErrors.length === 0,
    errors: uniqueErrors,
    decision_validation_errors: applied.decision_validation_errors,
    applied,
    terra_authority: uniqueErrors.length === 0 ? terraAuthority : null,
  };
}
function parseArgs(args) {
  const config = { mode: null, output: DEFAULT_OUTPUT, resume: false, concurrency: 4 };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--check' || arg === '--live') { if (config.mode) throw new Error('MODE_DUPLICATE'); config.mode = arg; }
    else if (arg === '--resume') config.resume = true;
    else if (arg === '--concurrency') { config.concurrency = Number(args[++index]); if (!Number.isInteger(config.concurrency) || config.concurrency < 1 || config.concurrency > 4) throw new Error('CONCURRENCY_INVALID'); }
    else if (arg === '--output') { config.output = args[++index]; if (!string(config.output)) throw new Error('OUTPUT_PATH_INVALID'); }
    else throw new Error('USAGE: --check | --live [--resume] [--concurrency 1..4] [--output <path>]');
  }
  if (!config.mode || (config.mode === '--check' && config.resume)) throw new Error('USAGE: --check | --live [--resume] [--concurrency 1..4] [--output <path>]'); return config;
}
function writeAtomic(path, value) {
  const temporary = `${path}.tmp-${process.pid}-${Date.now()}-${atomicWriteSequence++}`;
  writeFileSync(temporary, value);
  renameSync(temporary, path);
}
function makeLiveInvoker() {
  const profile = resolveProfile(PROFILE_ID);
  const client = createCodexCliClient({ model: profile.model, reasoningEffort: profile.reasoning_effort, maxAttempts: 1, ephemeral: true, ignoreUserConfig: true, ignoreRules: true, isolated: true });
  return async ({ prompt }) => {
    const response = await client.messages.create({ system: JSON_ONLY_INSTRUCTION, messages: [{ role: 'user', content: prompt }] });
    return { text: response?.content?.[0]?.text, provider_request_id: response?.provider_request_id, usage: response?.usage, codex_completion: response?.codex_completion };
  };
}
async function main() {
  const config = parseArgs(process.argv.slice(2)); const outputPath = resolve(DEFAULT_ROOT, config.output); const inventory = buildLexicalClassificationInventory();
  if (config.mode === '--check') {
    if (!existsSync(outputPath)) throw new Error('COMMITTED_TERRA_ADJUDICATION_MISSING');
    const checked = validateTerraAdjudicationArtifact({ inventory, artifact: JSON.parse(readFileSync(outputPath, 'utf8')) });
    if (!checked.ok) throw new Error(checked.errors.join(',')); return;
  }
  if (existsSync(outputPath) && !config.resume) throw new Error('OUTPUT_EXISTS_REQUIRES_RESUME');
  const checkpointArtifact = config.resume ? JSON.parse(readFileSync(outputPath, 'utf8')) : null;
  const artifact = await runTerraAdjudication({
    inventory, invoke: makeLiveInvoker(), checkpointArtifact, concurrency: config.concurrency,
    onCheckpoint: async (checkpoint) => writeAtomic(outputPath, `${canonicalJson(checkpoint)}\n`),
  });
  writeAtomic(outputPath, `${canonicalJson(artifact)}\n`);
  const checked = validateTerraAdjudicationArtifact({ inventory, artifact });
  if (!checked.ok) throw new Error(checked.errors.join(','));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

export {
  EXPECTED_ROOT_COUNT, buildTerraAdjudicationInput, buildTerraPrompt, runTerraAdjudication,
  validateModelOutput, validateTerraAdjudicationArtifact, checkpointValidation,
};
