#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import {
  existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { isFinalCorpusRun } from './canonical-v2-corpus-review-artifact.mjs';
import { check as checkSolArtifact } from './stage-2y-phase-b-sol-probe.mjs';
import { assertPhaseBLiveAllowed } from './stage-2y-phase-b-live-authority.mjs';

const require = createRequire(import.meta.url);
const { canonicalJson, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { createCodexCliClient, codexInvocationIdentity } = require('../lib/llm-cli-client');
const { FIXTURE_CONTRACT_INPUT_V43 } = require('../lib/canonical-v2/contract-bundle');

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_ROOT = 'evidence/canonical-v2/stage-2y-phase-b';
const MANIFEST_PATH = `${OUTPUT_ROOT}/manifest.json`;
const TERRA_PATH = `${OUTPUT_ROOT}/terra-calls.json`;
const CROSS_VENDOR_PATH = `${OUTPUT_ROOT}/cross-vendor-calls.json`;
const HUMAN_PACKET_PATH = `${OUTPUT_ROOT}/recovered-blocked-human-packet.json`;
const HUMAN_LEDGER_PATH = `${OUTPUT_ROOT}/recovered-blocked-human-ledger.json`;
const HIDDEN_COMPARISON_PATH = `${OUTPUT_ROOT}/recovered-blocked-hidden-comparison.json`;
const REPORT_PATH = `${OUTPUT_ROOT}/report.json`;
const REPORT_MD_PATH = `${OUTPUT_ROOT}/report.md`;
const SOL_PROBE_PATH = `${OUTPUT_ROOT}/sol-probe.json`;
const BLOCKED_SAMPLE_SIZE = 150;
const TERRA = Object.freeze({
  provider_id: 'OPENAI_CODEX_CLI_SUBSCRIPTION',
  profile_id: 'TERRA_MEDIUM',
  model: 'gpt-5.6-terra',
  reasoning_effort: 'medium',
  requested_model_id: 'gpt-5.6-terra;reasoning=medium;profile=TERRA_MEDIUM',
});
const CROSS_VENDOR = Object.freeze({
  provider_id: 'ANTHROPIC_CLAUDE_CLI_SUBSCRIPTION',
  requested_model_id: 'claude-opus-4-1',
  vendor: 'Anthropic',
});
const CLAIM_DEFINITIONS = new Map(FIXTURE_CONTRACT_INPUT_V43.claim_definitions
  .map((definition) => [definition.claim_definition_key, definition]));
const JSON_ONLY = 'Output only the requested JSON object. Do not use tools. Use only the evidence in this prompt.';
const TERRA_INVOCATION_IDENTITY = codexInvocationIdentity({ model: TERRA.model, reasoningEffort: TERRA.reasoning_effort });
let sequence = 0;

function hash(value) {
  return sha256Hex(Buffer.from(typeof value === 'string' ? value : canonicalJson(value), 'utf8'));
}
function fileHash(path) { return createHash('sha256').update(readFileSync(path)).digest('hex'); }
function readJson(path) { return JSON.parse(readFileSync(resolve(ROOT, path), 'utf8')); }
function writeAtomic(path, value) {
  const absolute = resolve(ROOT, path); mkdirSync(dirname(absolute), { recursive: true });
  const temporary = `${absolute}.tmp-${process.pid}-${sequence++}`;
  writeFileSync(temporary, `${canonicalJson(value)}\n`); renameSync(temporary, absolute);
}
function nonempty(value) { return typeof value === 'string' && value.trim().length > 0; }
function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function evidenceDigest(value) { return hash(value); }
function sourceTextFromRecording(recording, sectionReference) {
  for (const call of recording.calls || []) {
    const text = (call.request_messages || []).map((message) => message.content || '').join('\n');
    const governed = text.match(/^GOVERNED SECTION REFERENCE: (.+)$/m)?.[1]?.trim();
    if (!governed || !(governed === sectionReference
      || sectionReference.startsWith(`${governed}(`)
      || governed.startsWith(`${sectionReference}(`))) continue;
    const match = /^SOURCE TEXT[^\n]*:\n+/gm; let current; let last = null;
    while ((current = match.exec(text)) !== null) last = current;
    if (last) return text.slice(last.index + last[0].length);
  }
  return null;
}
function currentRowEvidence(row, resolution) {
  if (nonempty(row.raw_value)) return row.raw_value;
  const resolved = (resolution.resolved || []).find((entry) => (
    entry.claim?.claim_revision_id === row.claim_revision_id
    || entry.claim_revision_id === row.claim_revision_id
  ));
  return resolved?.claim?.raw_value || resolved?.raw_value || row.normalised_phrase || null;
}
function rowReason(row, state) {
  if (state === 'OPEN_WORLD') return row.reason || row.reason_code || row.attributes?.why_unmapped || 'UNSPECIFIED';
  return (row.reasons || [])[0] || 'UNSPECIFIED';
}
function compactPlacementDefinition(entry) {
  const claim = entry.claim || entry.compiled_candidate?.candidate?.claim;
  if (!claim?.claim_definition_key) return null;
  return {
    claim_definition_key: claim.claim_definition_key,
    canonical_value: claim.canonical_value,
    state: claim.state || 'PRESENT',
    party: entry.party || entry.provision_instance?.party || null,
    attributes: claim.attributes || null,
  };
}
function finalRuns() {
  const evidenceRoot = resolve(ROOT, 'evidence/canonical-v2');
  function loadRun(directory, run) {
    const manifestPath = resolve(directory, 'run-manifest.json');
    const resolutionPath = resolve(directory, 'resolution.json');
    const recordingPath = resolve(directory, 'recording.json');
    if (![manifestPath, resolutionPath, recordingPath].every(existsSync)) return null;
    return {
      run,
      manifest: JSON.parse(readFileSync(manifestPath, 'utf8')),
      resolution: JSON.parse(readFileSync(resolutionPath, 'utf8')),
      recording: JSON.parse(readFileSync(recordingPath, 'utf8')),
      source_digests: {
        run_manifest: fileHash(manifestPath), resolution: fileHash(resolutionPath), recording: fileHash(recordingPath),
      },
    };
  }
  const baselineRuns = readdirSync(evidenceRoot).filter(isFinalCorpusRun).sort().map((run) => loadRun(resolve(evidenceRoot, run), run)).filter(Boolean);
  const latestBatchPath = resolve(evidenceRoot, 'stage-2y-l-live-batch.json'); const latestBatch = JSON.parse(readFileSync(latestBatchPath, 'utf8'));
  if (latestBatch.expected_call_count !== 46 || latestBatch.actual_call_count !== 46 || latestBatch.calls.some((call) => call.state !== 'COMPLETE')) throw new Error('LATEST_STAGE_2Y_L_BATCH_INVALID');
  const replacedPairs = new Set(latestBatch.calls.map((call) => `${call.spec.deal}|${call.spec.family}`));
  const latestRuns = latestBatch.calls.map((call) => loadRun(resolve(ROOT, call.output.output_directory), call.output.output_directory));
  if (latestRuns.some((run) => run === null)) throw new Error('LATEST_STAGE_2Y_L_RUN_MISSING');
  const runs = [...baselineRuns.filter((run) => !replacedPairs.has(`${run.manifest.deal}|${run.manifest.section_family}`)), ...latestRuns];
  const sectionOwners = new Map();
  for (const run of runs) {
    for (const sectionReference of run.manifest.section_references || []) {
      const key = `${run.manifest.deal}|${run.manifest.section_family}|${sectionReference}`;
      if (sectionOwners.has(key)) throw new Error(`MIXED_RUN_REVISION:${key}:${sectionOwners.get(key)}:${run.run}`);
      sectionOwners.set(key, run.run);
    }
  }
  return runs;
}
function governedPlacementsByFamily(runs) {
  const byFamily = new Map();
  for (const run of runs) {
    const family = run.manifest.section_family; if (!byFamily.has(family)) byFamily.set(family, new Map());
    const definitions = byFamily.get(family);
    for (const entry of run.resolution.resolved || []) {
      const placement = compactPlacementDefinition(entry); if (!placement) continue;
      const key = placement.claim_definition_key;
      if (!definitions.has(key)) definitions.set(key, []);
      const examples = definitions.get(key);
      if (examples.length < 3 && !examples.some((value) => canonicalJson(value) === canonicalJson(placement))) examples.push(placement);
    }
  }
  return new Map([...byFamily].map(([family, definitions]) => [family,
    [...definitions].sort(([left], [right]) => left.localeCompare(right)).map(([claim_definition_key, examples]) => ({
      claim_definition_key,
      contract_definition: CLAIM_DEFINITIONS.get(claim_definition_key) || null,
      examples,
    })),
  ]));
}
function blockedPopulation(runs) {
  const governed = governedPlacementsByFamily(runs); const rows = [];
  for (const run of runs) {
    const family = run.manifest.section_family; const sourceBySection = new Map();
    function source(sectionReference) {
      if (!sourceBySection.has(sectionReference)) sourceBySection.set(sectionReference, sourceTextFromRecording(run.recording, sectionReference));
      return sourceBySection.get(sectionReference);
    }
    const candidates = [
      ...(run.resolution.review_queue || []).filter((row) => row.has_resolution !== true).map((row, index) => ({ state: 'REVIEW', row, index })),
      ...(run.resolution.open_world || []).map((row, index) => ({ state: 'OPEN_WORLD', row, index })),
    ];
    for (const candidate of candidates) {
      const sectionReference = candidate.row.section_reference || candidate.row.source_citation || 'UNKNOWN';
      const rowId = hash({ run: run.run, state: candidate.state, index: candidate.index, closure_id: candidate.row.closure_id || null });
      const evidence = currentRowEvidence(candidate.row, run.resolution);
      rows.push({
        row_id: rowId, cohort: 'DETERMINISTIC_BLOCKED', run: run.run,
        deal: run.manifest.deal, family, section_reference: sectionReference,
        current_state: candidate.state, reason: rowReason(candidate.row, candidate.state),
        source_text: source(sectionReference) || evidence,
        source_text_status: source(sectionReference) ? 'FULL_RECORDED_SECTION' : 'ROW_EVIDENCE_ONLY',
        row_evidence: evidence,
        candidate: candidate.row,
        governed_placements: governed.get(family) || [],
        source_digests: run.source_digests,
      });
    }
  }
  return rows;
}
function stratifiedSample(rows, size = BLOCKED_SAMPLE_SIZE) {
  const strata = new Map();
  for (const row of rows) {
    const key = `${row.family}|${row.current_state}|${row.reason}`;
    if (!strata.has(key)) strata.set(key, []); strata.get(key).push(row);
  }
  for (const values of strata.values()) values.sort((left, right) => hash(left.row_id).localeCompare(hash(right.row_id)));
  const keys = [...strata.keys()].sort(); const selected = []; let round = 0;
  while (selected.length < size) {
    let moved = false;
    for (const key of keys) {
      const row = strata.get(key)[round]; if (!row) continue; selected.push(row); moved = true;
      if (selected.length === size) break;
    }
    if (!moved) break; round += 1;
  }
  if (selected.length !== size) throw new Error(`BLOCKED_SAMPLE_UNDERSIZED:${selected.length}`);
  return selected;
}
function blindRows() {
  const sample = readJson('evidence/blind-review/2026-08-08/blind-sample.json');
  const key = new Map(readJson('evidence/blind-review/2026-08-08/blind-key.json').map((row) => [row.id, row]));
  const verdicts = new Map(readJson('evidence/blind-review/2026-08-08/blind-verdicts.json').map((row) => [row.id, row]));
  return sample.map((row) => ({
    row_id: `BLIND:${row.id}`, cohort: 'HUMAN_BLIND_FLOOR', human_label: verdicts.get(row.id)?.verdict,
    input: { ...row, original_reason: key.get(row.id)?._reason || null },
  }));
}
function anchorRows() {
  const packet = readJson('evidence/blind-review/2026-08-09/stage-2y-0-human-anchor-machine-packet.json');
  const verdicts = readJson('evidence/blind-review/2026-08-09/stage-2y-0-console-verdicts-ben.json');
  const label = new Map(); for (const value of ['CORRECT', 'ERROR']) for (const key of verdicts[value] || []) label.set(key, value);
  return packet.cards.filter((card) => label.has(card.decision_key)).map((card) => ({
    row_id: `ANCHOR:${card.decision_key}`, cohort: 'HUMAN_ANCHOR_DECIDED', human_label: label.get(card.decision_key), input: card,
  }));
}
function buildManifest() {
  const runs = finalRuns(); const population = blockedPopulation(runs); const blocked = stratifiedSample(population);
  const blind = blindRows(); const anchor = anchorRows();
  if (blind.length !== 96 || anchor.length !== 54 || blocked.length !== BLOCKED_SAMPLE_SIZE) throw new Error('COHORT_COUNT_MISMATCH');
  const latestRunSets = [...runs.reduce((groups, run) => {
    const key = `${run.manifest.deal}|${run.manifest.section_family}`; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(run);
    return groups;
  }, new Map())].map(([key, values]) => ({ deal: key.split('|')[0], family: key.split('|')[1], run_names: values.map((run) => run.run).sort(), section_references: values.flatMap((run) => run.manifest.section_references || []).sort() }))
    .sort((left, right) => `${left.deal}|${left.family}`.localeCompare(`${right.deal}|${right.family}`));
  const excludedReceipts = ['terra-calls.invalid-prompt.json', 'terra-calls.pre-audit-noncounting.json'].flatMap((name) => {
    const path = resolve(ROOT, OUTPUT_ROOT, name); return existsSync(path) ? [{ path: `${OUTPUT_ROOT}/${name}`, digest: fileHash(path), authority: 'NON_COUNTING_PRE_AUDIT' }] : [];
  });
  const body = {
    schema_version: 'STAGE_2Y_PHASE_B_MANIFEST/V1', prepared_on: '2026-08-10',
    purpose: 'Report-only Stage 2Y Phase B model experiment. No publication or activation authority.',
    measurement_scope: { resolved_label_meaning: 'MODEL_PROPOSED_GOVERNED_PLACEMENT', lawyer_visible_recovery_claimed: false, resolver_adapter_projection_validation: 'LATER_GATE' },
    authority: { publication_authorisation: 'NONE', serving_activated: false, product_writes: false },
    providers: { baseline: { ...TERRA, invocation_identity: TERRA_INVOCATION_IDENTITY }, cross_vendor: CROSS_VENDOR, lead_tier_probe: { provider_id: TERRA.provider_id, model: 'gpt-5.6-sol', reasoning_effort: 'medium' } },
    commands: {
      prepare: 'node scripts/stage-2y-phase-b-model-experiment.mjs --prepare',
      terra: 'node scripts/stage-2y-phase-b-model-experiment.mjs --run-terra --resume',
      cross_vendor: 'node scripts/stage-2y-phase-b-model-experiment.mjs --run-cross-vendor --resume',
      seal_human_ledger: 'node scripts/stage-2y-phase-b-model-experiment.mjs --seal-human-ledger',
      report: 'node scripts/stage-2y-phase-b-model-experiment.mjs --report',
    },
    inputs: {
      blind_sample_digest: fileHash(resolve(ROOT, 'evidence/blind-review/2026-08-08/blind-sample.json')),
      blind_verdict_digest: fileHash(resolve(ROOT, 'evidence/blind-review/2026-08-08/blind-verdicts.json')),
      anchor_packet_digest: fileHash(resolve(ROOT, 'evidence/blind-review/2026-08-09/stage-2y-0-human-anchor-machine-packet.json')),
      anchor_verdict_digest: fileHash(resolve(ROOT, 'evidence/blind-review/2026-08-09/stage-2y-0-console-verdicts-ben.json')),
      final_run_count: runs.length, blocked_population_count: population.length,
      run_selector: 'LATEST_FINAL_RUN_SET_PER_DEAL_FAMILY_WITH_DISJOINT_SECTION_SHARDS/V1',
      latest_stage_2y_l_batch_digest: fileHash(resolve(ROOT, 'evidence/canonical-v2/stage-2y-l-live-batch.json')),
      latest_run_sets: latestRunSets,
      excluded_receipts: excludedReceipts,
    },
    selection: {
      blocked_sample_size: BLOCKED_SAMPLE_SIZE,
      algorithm: 'ROUND_ROBIN_BY_FAMILY_CURRENT_STATE_REASON_THEN_SHA256_ROW_ID/V1',
      counts: { human_blind_floor: blind.length, human_anchor_decided: anchor.length, deterministic_blocked: blocked.length },
    },
    rows: [...blind, ...anchor, ...blocked],
  };
  return { ...body, manifest_id: hash(body) };
}
function validateManifest(manifest) {
  const expected = buildManifest(); if (canonicalJson(manifest) !== canonicalJson(expected)) throw new Error('PHASE_B_MANIFEST_DRIFT'); return true;
}
function terraPrompt(row) {
  if (row.cohort === 'HUMAN_BLIND_FLOOR') return [
    'Classify this extracted merger-agreement item using the human blind-floor rubric.',
    'REAL means a complete useful legal item. FRAGMENT means legally relevant but incomplete without governing context. NOISE means not a useful legal item.',
    'Echo input row_id exactly. Return exactly {"row_id":"...","classification":"REAL|FRAGMENT|NOISE","rationale":"..."}.',
    `ROW_ID=${row.row_id}`,
    `INPUT=${canonicalJson(row.input)}`,
  ].join('\n\n');
  if (row.cohort === 'HUMAN_ANCHOR_DECIDED') return [
    'Judge the proposed analysis using only this card. Follow its error_class and proposed_analysis.',
    'Return CORRECT if supported, ERROR if contradicted, or CANT_JUDGE if the card lacks enough context.',
    'Echo input row_id exactly. Return exactly {"row_id":"...","classification":"CORRECT|ERROR|CANT_JUDGE","rationale":"..."}.',
    `ROW_ID=${row.row_id}`,
    `INPUT=${canonicalJson(row.input)}`,
  ].join('\n\n');
  return [
    'Apply the Stage 2Y corroboration rung-4 shape to one deterministically blocked merger-agreement row.',
    'Resolve only when the recorded source supports a listed governed claim placement and does not positively contradict it.',
    'Use OPEN_WORLD when the source contains a real legal item but none of the listed governed placements can express it.',
    'Use REVIEW when the source is insufficient, ambiguous, internally conflicting, or would require an unlisted value or unsupported inference.',
    'Never infer a party. If the party is not explicit in the source, set party to null.',
    'For RESOLVED, claim_definition_key must be one listed governed placement. Quote support must be byte-identical text from source_text.',
    'Echo input row_id exactly. Return exactly {"row_id":"...","disposition":"RESOLVED|OPEN_WORLD|REVIEW","claim_definition_key":null,"canonical_value":null,"party":null,"supporting_quotes":[],"rationale":"..."}.',
    `ROW_ID=${row.row_id}`,
    `INPUT=${canonicalJson(row)}`,
  ].join('\n\n');
}
function exactKeys(value, keys) {
  return object(value) && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}
function canonicalValueErrors(definition, value) {
  if (!definition) return ['CONTRACT_DEFINITION_MISSING'];
  if (definition.canonical_value_required_when_present && value === null) return ['CANONICAL_VALUE_REQUIRED'];
  if (Array.isArray(definition.allowed_canonical_values)
    && !definition.allowed_canonical_values.some((allowed) => canonicalJson(allowed) === canonicalJson(value))) return ['CANONICAL_VALUE_NOT_ALLOWED'];
  if (definition.canonical_value_type === 'NON_NEGATIVE_DECIMAL_STRING'
    && !(typeof value === 'string' && /^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value))) return ['CANONICAL_VALUE_TYPE_INVALID'];
  if (definition.canonical_value_type === 'ISO_8601_DATE_STRING'
    && !(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value))) return ['CANONICAL_VALUE_TYPE_INVALID'];
  if (definition.canonical_value_type === 'SCHEDULE_REFERENCE_STRING'
    && !nonempty(value)) return ['CANONICAL_VALUE_TYPE_INVALID'];
  return [];
}
function validateTerraOutput(row, output) {
  if (!object(output) || output.row_id !== row.row_id || !nonempty(output.rationale)) return ['OUTPUT_SHAPE_INVALID'];
  if (row.cohort === 'HUMAN_BLIND_FLOOR') return exactKeys(output, ['row_id', 'classification', 'rationale']) && ['REAL', 'FRAGMENT', 'NOISE'].includes(output.classification) ? [] : ['CLASSIFICATION_INVALID'];
  if (row.cohort === 'HUMAN_ANCHOR_DECIDED') return exactKeys(output, ['row_id', 'classification', 'rationale']) && ['CORRECT', 'ERROR', 'CANT_JUDGE'].includes(output.classification) ? [] : ['CLASSIFICATION_INVALID'];
  const errors = []; if (!exactKeys(output, ['row_id', 'disposition', 'claim_definition_key', 'canonical_value', 'party', 'supporting_quotes', 'rationale'])) errors.push('OUTPUT_KEYS_INVALID');
  if (!['RESOLVED', 'OPEN_WORLD', 'REVIEW'].includes(output.disposition)) errors.push('DISPOSITION_INVALID');
  if (!Array.isArray(output.supporting_quotes) || output.supporting_quotes.some((quote) => !nonempty(quote) || !String(row.source_text || '').includes(quote))) errors.push('SUPPORTING_QUOTE_INVALID');
  if (output.disposition === 'RESOLVED') {
    const placement = row.governed_placements.find((entry) => entry.claim_definition_key === output.claim_definition_key);
    if (!placement || output.supporting_quotes.length === 0) errors.push('RESOLVED_PLACEMENT_INVALID');
    else errors.push(...canonicalValueErrors(placement.contract_definition, output.canonical_value));
    if (output.party !== null) {
      if (!object(output.party) || !nonempty(output.party.value) || !String(row.source_text || '').includes(output.party.value)) errors.push('PARTY_NOT_EXPLICIT_IN_SOURCE');
    }
  } else if (output.claim_definition_key !== null || output.canonical_value !== null || output.party !== null) errors.push('NON_RESOLVED_PLACEMENT_PRESENT');
  return errors;
}
function baseCallArtifact(manifest) {
  return { schema_version: 'STAGE_2Y_PHASE_B_TERRA_CALLS/V1', manifest_id: manifest.manifest_id, provider: TERRA, generation_command: 'node scripts/stage-2y-phase-b-model-experiment.mjs --run-terra --resume', expected_call_count: manifest.rows.length, calls: [], stopped: null, publication_authorisation: 'NONE' };
}
function terraInvocationIdentityValid(value) { return object(value) && canonicalJson(value) === canonicalJson(TERRA_INVOCATION_IDENTITY); }
function validateTerraArtifact(manifest, artifact) {
  if (!object(artifact) || artifact.schema_version !== 'STAGE_2Y_PHASE_B_TERRA_CALLS/V1' || artifact.manifest_id !== manifest.manifest_id
    || canonicalJson(artifact.provider) !== canonicalJson(TERRA) || artifact.expected_call_count !== manifest.rows.length || artifact.publication_authorisation !== 'NONE' || !Array.isArray(artifact.calls) || artifact.calls.length > manifest.rows.length) throw new Error('TERRA_ARTIFACT_INVALID');
  const rows = new Map(manifest.rows.map((row) => [row.row_id, row])); const seen = new Set(); const requests = new Set();
  for (const call of artifact.calls) {
    const row = rows.get(call.row_id); if (!row || seen.has(call.row_id)) throw new Error('TERRA_CALL_ROW_INVALID'); seen.add(call.row_id);
    const { call_id: ignored, ...body } = call; let callHash = null; try { callHash = hash(body); } catch {} if (call.call_id !== callHash || call.input_digest !== evidenceDigest(row) || call.prompt_digest !== hash(terraPrompt(row))) throw new Error('TERRA_CALL_BINDING_INVALID');
    if (!['COMPLETE', 'MALFORMED_OUTPUT', 'CALL_FAILED'].includes(call.state)) throw new Error('TERRA_CALL_STATE_INVALID');
    if (call.provider_request_id) { if (requests.has(call.provider_request_id)) throw new Error('TERRA_PROVIDER_REQUEST_DUPLICATE'); requests.add(call.provider_request_id); }
    if (call.response_text !== null && call.response_digest !== hash(call.response_text)) throw new Error('TERRA_RESPONSE_BINDING_INVALID');
    if (call.state === 'COMPLETE' && (validateTerraOutput(row, call.output).length || !nonempty(call.provider_request_id) || call.codex_completion?.status !== 'COMPLETE' || call.codex_completion?.terminal_event !== 'turn.completed'
      || !terraInvocationIdentityValid(call.codex_invocation_identity))) throw new Error('TERRA_COMPLETE_OUTPUT_INVALID');
  }
  if (artifact.stopped && (!artifact.calls.length || artifact.stopped.row_id !== artifact.calls.at(-1).row_id || !['OPEN_WORLD_RISE', 'MALFORMED_OUTPUT', 'CALL_FAILED'].includes(artifact.stopped.code))) throw new Error('TERRA_STOP_BINDING_INVALID');
  if (!artifact.stopped && artifact.calls.some((call) => call.state !== 'COMPLETE')) throw new Error('TERRA_STOP_BINDING_INVALID');
  return true;
}
async function runTerra({ resume }) {
  assertPhaseBLiveAllowed('V1_TERRA');
  const manifest = readJson(MANIFEST_PATH); const output = resume && existsSync(resolve(ROOT, TERRA_PATH)) ? readJson(TERRA_PATH) : baseCallArtifact(manifest);
  validateTerraArtifact(manifest, output);
  if (output.stopped) throw new Error(`TERRA_ARTIFACT_STOPPED:${output.stopped.code}`);
  const completed = new Set(output.calls.map((call) => call.row_id));
  const client = createCodexCliClient({ model: TERRA.model, reasoningEffort: TERRA.reasoning_effort, maxAttempts: 1, ephemeral: true, ignoreUserConfig: true, ignoreRules: true, isolated: true });
  for (const row of manifest.rows) {
    if (completed.has(row.row_id)) continue;
    const prompt = terraPrompt(row); const started = new Date().toISOString(); let response; let parsed; let errors = [];
    try {
      const result = await client.messages.create({ messages: [{ role: 'user', content: `${JSON_ONLY}\n\n${prompt}` }] });
      response = result.content?.map((item) => item.text || '').join('').trim() || null;
      try { parsed = JSON.parse(response); } catch { errors.push('RESPONSE_JSON_INVALID'); }
      if (errors.length === 0) errors = validateTerraOutput(row, parsed);
      const record = { row_id: row.row_id, cohort: row.cohort, input_digest: evidenceDigest(row), prompt_digest: hash(prompt), response_digest: response === null ? null : hash(response), response_text: response, output: parsed || null, state: errors.length ? 'MALFORMED_OUTPUT' : 'COMPLETE', errors, provider_request_id: result.provider_request_id || null, usage: result.usage || null, codex_completion: result.codex_completion || null, codex_invocation_identity: result.codex_invocation_identity || null, started_at: started, completed_at: new Date().toISOString() };
      output.calls.push({ ...record, call_id: hash(record) });
    } catch (error) {
      const record = { row_id: row.row_id, cohort: row.cohort, input_digest: evidenceDigest(row), prompt_digest: hash(prompt), response_digest: null, response_text: null, output: null, state: 'CALL_FAILED', errors: [String(error?.message || error)], provider_request_id: null, usage: null, codex_completion: null, codex_invocation_identity: null, started_at: started, completed_at: new Date().toISOString() };
      output.calls.push({ ...record, call_id: hash(record) });
    }
    const latest = output.calls.at(-1);
    if (latest.state !== 'COMPLETE') output.stopped = { code: latest.state, row_id: row.row_id, stopped_at: new Date().toISOString() };
    if (row.cohort === 'DETERMINISTIC_BLOCKED' && row.current_state === 'REVIEW' && latest.output?.disposition === 'OPEN_WORLD') {
      output.stopped = { code: 'OPEN_WORLD_RISE', row_id: row.row_id, stopped_at: new Date().toISOString() };
    }
    validateTerraArtifact(manifest, output); writeAtomic(TERRA_PATH, output);
    if (output.stopped) break;
  }
  return output;
}
function crossVendorPrompt(row, terraCall) {
  return [
    'Independently score a proposed recovered placement from a merger agreement. You did not produce this placement.',
    'Use only the recorded source and governed-placement list. CORRECT means the exact placement, value, party and supporting quotes are supported. ERROR means any part is wrong. CANT_JUDGE means evidence is insufficient.',
    'Return exactly {"row_id":"...","classification":"CORRECT|ERROR|CANT_JUDGE","error_class":"PARTY_ATTRIBUTION|MATERIALITY_OR_QUALIFIER|SPAN|TOPIC_BUCKET|OTHER|null","rationale":"..."}.',
    `SOURCE=${canonicalJson(row)}`,
    `TERRA_CALL_BINDING=${canonicalJson({ terra_call_id: terraCall.call_id, terra_response_digest: terraCall.response_digest, proposed_placement: terraCall.output })}`,
  ].join('\n\n');
}
function claudeCall(prompt) {
  return new Promise((resolveCall, reject) => {
    const env = { ...process.env }; delete env.ANTHROPIC_API_KEY; delete env.OPENAI_API_KEY; delete env.XAI_API_KEY;
    const child = spawn('claude', ['-p', '--output-format', 'json', '--model', CROSS_VENDOR.requested_model_id, '--append-system-prompt', JSON_ONLY], { cwd: ROOT, env, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = ''; child.stdout.on('data', (chunk) => { stdout += chunk; }); child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject); child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`CLAUDE_EXIT_${code}:${stderr.slice(0, 500)}`));
      try { const envelope = JSON.parse(stdout); resolveCall({ envelope, response: String(envelope.result || '').trim(), raw_digest: hash(stdout) }); } catch (error) { reject(error); }
    }); child.stdin.end(prompt);
  });
}
function baseCrossVendorArtifact(manifest, terraCallsDigest, expectedCallCount) {
  return { schema_version: 'STAGE_2Y_PHASE_B_CROSS_VENDOR_CALLS/V1', manifest_id: manifest.manifest_id, terra_calls_digest: terraCallsDigest, provider: CROSS_VENDOR, expected_call_count: expectedCallCount, calls: [], publication_authorisation: 'NONE' };
}
function validateCrossVendorArtifact(manifest, terra, artifact, terraCallsDigest) {
  const rows = new Map(manifest.rows.map((row) => [row.row_id, row]));
  const recovered = new Map(terra.calls.filter((call) => call.cohort === 'DETERMINISTIC_BLOCKED' && call.state === 'COMPLETE' && call.output?.disposition === 'RESOLVED').map((call) => [call.row_id, call]));
  if (!object(artifact) || artifact.schema_version !== 'STAGE_2Y_PHASE_B_CROSS_VENDOR_CALLS/V1' || artifact.manifest_id !== manifest.manifest_id
    || artifact.terra_calls_digest !== terraCallsDigest || canonicalJson(artifact.provider) !== canonicalJson(CROSS_VENDOR)
    || artifact.expected_call_count !== recovered.size || artifact.publication_authorisation !== 'NONE'
    || !Array.isArray(artifact.calls) || artifact.calls.length > recovered.size) throw new Error('CROSS_VENDOR_ARTIFACT_INVALID');
  const seen = new Set(); const requests = new Set();
  for (const call of artifact.calls) {
    const row = rows.get(call.row_id); const placement = recovered.get(call.row_id);
    if (!row || !placement || seen.has(call.row_id)) throw new Error('CROSS_VENDOR_CALL_ROW_INVALID'); seen.add(call.row_id);
    const { call_id: ignored, ...body } = call; let callHash = null; try { callHash = hash(body); } catch {}
    if (call.call_id !== callHash || call.terra_call_id !== placement.call_id || call.terra_response_digest !== placement.response_digest
      || call.input_digest !== evidenceDigest(row) || call.proposed_placement_digest !== hash(placement.output)
      || call.prompt_digest !== hash(crossVendorPrompt(row, placement)) || call.requested_model_id !== CROSS_VENDOR.requested_model_id) throw new Error('CROSS_VENDOR_CALL_BINDING_INVALID');
    if (!['COMPLETE', 'MALFORMED_OUTPUT', 'CALL_FAILED'].includes(call.state) || !Array.isArray(call.errors)) throw new Error('CROSS_VENDOR_CALL_STATE_INVALID');
    if (call.response_text !== null && call.response_digest !== hash(call.response_text)) throw new Error('CROSS_VENDOR_RESPONSE_BINDING_INVALID');
    if (call.provider_request_id) { if (requests.has(call.provider_request_id)) throw new Error('CROSS_VENDOR_PROVIDER_REQUEST_DUPLICATE'); requests.add(call.provider_request_id); }
    if (call.state === 'COMPLETE') {
      if (!exactKeys(call.output, ['row_id', 'classification', 'error_class', 'rationale']) || call.output.row_id !== row.row_id
        || !['CORRECT', 'ERROR', 'CANT_JUDGE'].includes(call.output.classification) || !nonempty(call.output.rationale)
        || (call.output.classification === 'CORRECT' && call.output.error_class !== null)
        || (call.output.classification === 'ERROR' && !['PARTY_ATTRIBUTION', 'MATERIALITY_OR_QUALIFIER', 'SPAN', 'TOPIC_BUCKET', 'OTHER'].includes(call.output.error_class))) throw new Error('CROSS_VENDOR_COMPLETE_OUTPUT_INVALID');
      if (!nonempty(call.provider_request_id) || call.resolved_model_id !== CROSS_VENDOR.requested_model_id
        || !object(call.model_usage) || canonicalJson(Object.keys(call.model_usage)) !== canonicalJson([CROSS_VENDOR.requested_model_id])
        || call.transport_receipt?.session_id !== call.provider_request_id || !/^[a-f0-9]{64}$/.test(call.raw_envelope_digest || '')) throw new Error('CROSS_VENDOR_MODEL_IDENTITY_INVALID');
    }
  }
  return true;
}
function validatePacketWriteInputs(manifest, terra, cross, { terraPresent, crossPresent, terraCallsDigest = null }) {
  validateManifest(manifest);
  if (terraPresent) validateTerraArtifact(manifest, terra); else if (crossPresent) throw new Error('CROSS_VENDOR_WITHOUT_TERRA');
  if (crossPresent) validateCrossVendorArtifact(manifest, terra, cross, terraCallsDigest);
  return true;
}
function validateSolForReport(sol) {
  const result = checkSolArtifact(sol); if (!result.ok) throw new Error(`SOL_PROBE_ARTIFACT_INVALID:${result.errors.join(',')}`); return true;
}
async function runCrossVendor({ resume }) {
  assertPhaseBLiveAllowed('V1_CROSS_VENDOR');
  const manifest = readJson(MANIFEST_PATH); const terra = readJson(TERRA_PATH); const rows = new Map(manifest.rows.map((row) => [row.row_id, row]));
  validateTerraArtifact(manifest, terra);
  const recovered = terra.calls.filter((call) => call.cohort === 'DETERMINISTIC_BLOCKED' && call.state === 'COMPLETE' && call.output?.disposition === 'RESOLVED');
  const terraCallsDigest = fileHash(resolve(ROOT, TERRA_PATH));
  const output = resume && existsSync(resolve(ROOT, CROSS_VENDOR_PATH)) ? readJson(CROSS_VENDOR_PATH) : baseCrossVendorArtifact(manifest, terraCallsDigest, recovered.length);
  validateCrossVendorArtifact(manifest, terra, output, terraCallsDigest);
  if (output.calls.some((call) => call.state !== 'COMPLETE')) throw new Error('CROSS_VENDOR_ARTIFACT_STOPPED');
  const completed = new Set(output.calls.map((call) => call.row_id));
  for (const placement of recovered) {
    if (completed.has(placement.row_id)) continue; const row = rows.get(placement.row_id); const prompt = crossVendorPrompt(row, placement); const started = new Date().toISOString();
    try {
      const result = await claudeCall(prompt); let parsed; const errors = []; try { parsed = JSON.parse(result.response); } catch { errors.push('RESPONSE_JSON_INVALID'); }
      if (!exactKeys(parsed, ['row_id', 'classification', 'error_class', 'rationale']) || parsed.row_id !== row.row_id || !['CORRECT', 'ERROR', 'CANT_JUDGE'].includes(parsed.classification) || !nonempty(parsed.rationale)) errors.push('OUTPUT_SHAPE_INVALID');
      if (parsed?.classification === 'CORRECT' && parsed.error_class !== null) errors.push('CORRECT_ERROR_CLASS_PRESENT');
      if (parsed?.classification === 'ERROR' && !['PARTY_ATTRIBUTION', 'MATERIALITY_OR_QUALIFIER', 'SPAN', 'TOPIC_BUCKET', 'OTHER'].includes(parsed.error_class)) errors.push('ERROR_CLASS_INVALID');
      const modelUsage = result.envelope.modelUsage || {}; const modelIds = Object.keys(modelUsage);
      if (modelIds.length !== 1 || modelIds[0] !== CROSS_VENDOR.requested_model_id) errors.push('RESOLVED_MODEL_ID_UNPROVEN');
      if (!nonempty(result.envelope.session_id)) errors.push('PROVIDER_REQUEST_ID_MISSING');
      const record = { row_id: row.row_id, terra_call_id: placement.call_id, terra_response_digest: placement.response_digest, input_digest: evidenceDigest(row), proposed_placement_digest: hash(placement.output), prompt_digest: hash(prompt), response_digest: hash(result.response), raw_envelope_digest: result.raw_digest, response_text: result.response, output: parsed || null, state: errors.length ? 'MALFORMED_OUTPUT' : 'COMPLETE', errors: [...new Set(errors)], provider_request_id: result.envelope.session_id || null, usage: result.envelope.usage || null, model_usage: modelUsage, resolved_model_id: modelIds.length === 1 ? modelIds[0] : null, transport_receipt: { type: result.envelope.type || null, subtype: result.envelope.subtype || null, is_error: result.envelope.is_error || false, session_id: result.envelope.session_id || null, uuid: result.envelope.uuid || null, duration_ms: result.envelope.duration_ms || null, num_turns: result.envelope.num_turns || null }, requested_model_id: CROSS_VENDOR.requested_model_id, started_at: started, completed_at: new Date().toISOString() };
      output.calls.push({ ...record, call_id: hash(record) });
    } catch (error) { const record = { row_id: row.row_id, terra_call_id: placement.call_id, terra_response_digest: placement.response_digest, input_digest: evidenceDigest(row), proposed_placement_digest: hash(placement.output), prompt_digest: hash(prompt), response_digest: null, raw_envelope_digest: null, response_text: null, output: null, state: 'CALL_FAILED', errors: [String(error?.message || error)], provider_request_id: null, usage: null, model_usage: null, resolved_model_id: null, transport_receipt: null, requested_model_id: CROSS_VENDOR.requested_model_id, started_at: started, completed_at: new Date().toISOString() }; output.calls.push({ ...record, call_id: hash(record) }); }
    validateCrossVendorArtifact(manifest, terra, output, terraCallsDigest); writeAtomic(CROSS_VENDOR_PATH, output);
  }
  return output;
}
function countsBy(rows, keyFn) {
  const out = {}; for (const row of rows) { const key = keyFn(row); out[key] = (out[key] || 0) + 1; } return Object.fromEntries(Object.entries(out).sort());
}
function recoveredCalls(terra) {
  return (terra.calls || []).filter((call) => call.cohort === 'DETERMINISTIC_BLOCKED' && call.state === 'COMPLETE' && call.output?.disposition === 'RESOLVED');
}
function exactCrossCoverage(terra, cross) {
  const recovered = recoveredCalls(terra); const expected = new Set(recovered.map((call) => call.row_id)); const seen = new Set();
  const calls = cross?.calls || [];
  const complete = calls.length === recovered.length && calls.every((call) => call.state === 'COMPLETE' && expected.has(call.row_id) && !seen.has(call.row_id) && seen.add(call.row_id));
  return { complete: complete && seen.size === expected.size, recovered, expected, seen };
}
function buildHumanPacket(manifest, terra, cross) {
  const coverage = exactCrossCoverage(terra, cross); if (!coverage.complete) throw new Error('HUMAN_PACKET_REQUIRES_EXACT_CROSS_VENDOR_COVERAGE');
  const rows = new Map(manifest.rows.map((row) => [row.row_id, row]));
  const recovered = coverage.recovered
    .sort((left, right) => hash(left.row_id).localeCompare(hash(right.row_id)));
  if (recovered.length < 50) throw new Error('HUMAN_PACKET_REQUIRES_AT_LEAST_50_RECOVERED_ROWS');
  const subset = recovered.slice(0, 50);
  const body = { schema_version: 'STAGE_2Y_PHASE_B_RECOVERED_HUMAN_PACKET/V1', manifest_id: manifest.manifest_id, terra_calls_digest: existsSync(resolve(ROOT, TERRA_PATH)) ? fileHash(resolve(ROOT, TERRA_PATH)) : hash(terra), cross_vendor_calls_digest: existsSync(resolve(ROOT, CROSS_VENDOR_PATH)) ? fileHash(resolve(ROOT, CROSS_VENDOR_PATH)) : hash(cross), selection_algorithm: 'FIRST_50_RECOVERED_BY_SHA256_ROW_ID/V1', recovered_population_count: recovered.length, required_human_decisions: 50, selected_human_rows: subset.length, blinding: 'CROSS_VENDOR_VERDICTS_WITHHELD', status: 'PENDING_HUMAN_ADJUDICATION', instructions: 'For each row choose CORRECT, ERROR, or CANT_JUDGE against the source and model-proposed governed placement. Do not infer a party. Cross-vendor verdicts are hidden.', cards: subset.map((call, index) => ({ card_number: index + 1, row: rows.get(call.row_id), terra_call_id: call.call_id, proposed_governed_placement: call.output })) };
  return { ...body, packet_id: hash(body) };
}
function emptyHumanLedger(packet) {
  return sealHumanLedger(packet, []);
}
function sealHumanLedger(packet, decisions) {
  const body = { schema_version: 'STAGE_2Y_PHASE_B_RECOVERED_HUMAN_LEDGER/V1', packet_id: packet.packet_id, required_row_ids: packet.cards.map((card) => card.row.row_id), decisions, status: decisions.length === 50 ? 'COMPLETE' : 'PENDING_HUMAN_ADJUDICATION' };
  return { ...body, ledger_id: hash(body) };
}
function humanLedgerMetrics(packet, ledger) {
  const required = new Set(packet.cards.map((card) => card.row.row_id)); const seen = new Set(); let valid = true;
  const topKeys = ['schema_version', 'packet_id', 'required_row_ids', 'decisions', 'status', 'ledger_id'];
  if (!exactKeys(ledger, topKeys) || ledger.schema_version !== 'STAGE_2Y_PHASE_B_RECOVERED_HUMAN_LEDGER/V1' || ledger.packet_id !== packet.packet_id
    || canonicalJson(ledger.required_row_ids) !== canonicalJson(packet.cards.map((card) => card.row.row_id)) || !Array.isArray(ledger.decisions)) valid = false;
  for (const decision of ledger?.decisions || []) {
    if (!exactKeys(decision, ['row_id', 'verdict', 'rationale', 'reviewed_by', 'reviewed_on']) || !required.has(decision.row_id) || seen.has(decision.row_id)
      || !['CORRECT', 'ERROR', 'CANT_JUDGE'].includes(decision.verdict) || !nonempty(decision.rationale) || !nonempty(decision.reviewed_by) || !/^\d{4}-\d{2}-\d{2}$/.test(decision.reviewed_on)) valid = false;
    seen.add(decision.row_id);
  }
  const decisionCount = Array.isArray(ledger?.decisions) ? ledger.decisions.length : 0; const expectedStatus = decisionCount === 50 ? 'COMPLETE' : 'PENDING_HUMAN_ADJUDICATION';
  if (ledger?.status !== expectedStatus) valid = false;
  if (object(ledger)) { const { ledger_id: ignored, ...body } = ledger; let ledgerHash = null; try { ledgerHash = hash(body); } catch {} if (ledger.ledger_id !== ledgerHash) valid = false; }
  const decisions = valid ? ledger.decisions : []; const correct = decisions.filter((row) => row.verdict === 'CORRECT').length;
  const complete = valid && required.size === 50 && decisions.length === 50 && seen.size === 50;
  return { valid, decisions: decisions.length, correct, agreement: complete ? correct / 50 : null, complete, decision_rows: decisions };
}
function wilsonLowerBound(successes, n, z = 1.6448536269514722) {
  if (!Number.isInteger(successes) || !Number.isInteger(n) || n <= 0 || successes < 0 || successes > n) return null;
  const p = successes / n; const denominator = 1 + ((z ** 2) / n);
  return Math.max(0, Math.min(1, ((p + ((z ** 2) / (2 * n))) - z * Math.sqrt(((p * (1 - p)) / n) + ((z ** 2) / (4 * (n ** 2))))) / denominator));
}
function buildHiddenComparison(packet, ledger, cross) {
  const human = humanLedgerMetrics(packet, ledger); if (!human.complete) throw new Error('HIDDEN_COMPARISON_REQUIRES_COMPLETE_HUMAN_LEDGER');
  const crossById = new Map((cross.calls || []).map((call) => [call.row_id, call])); const decisionById = new Map(human.decision_rows.map((decision) => [decision.row_id, decision]));
  const rows = packet.cards.map((card) => {
    const rowId = card.row.row_id; const score = crossById.get(rowId); const decision = decisionById.get(rowId);
    if (score?.state !== 'COMPLETE' || !decision) throw new Error('HIDDEN_COMPARISON_COVERAGE_INVALID');
    return { row_id: rowId, human_verdict: decision.verdict, cross_vendor_verdict: score.output.classification, human_correct: decision.verdict === 'CORRECT', cross_vendor_matches_human: score.output.classification === decision.verdict };
  });
  const humanCorrect = rows.filter((row) => row.human_correct).length; const crossMatches = rows.filter((row) => row.cross_vendor_matches_human).length;
  const body = { schema_version: 'STAGE_2Y_PHASE_B_HIDDEN_COMPARISON/V1', packet_id: packet.packet_id, ledger_id: ledger.ledger_id, cross_vendor_calls_digest: existsSync(resolve(ROOT, CROSS_VENDOR_PATH)) ? fileHash(resolve(ROOT, CROSS_VENDOR_PATH)) : hash(cross), row_count: rows.length, rows, metrics: { recovered_human_correct: humanCorrect, recovered_human_n: rows.length, recovered_human_agreement: humanCorrect / rows.length, cross_vendor_human_matches: crossMatches, cross_vendor_human_n: rows.length, cross_vendor_human_agreement: crossMatches / rows.length } };
  return { ...body, comparison_id: hash(body) };
}
function buildReport() {
  const manifest = readJson(MANIFEST_PATH); const terraPresent = existsSync(resolve(ROOT, TERRA_PATH)); const crossPresent = existsSync(resolve(ROOT, CROSS_VENDOR_PATH));
  const terra = terraPresent ? readJson(TERRA_PATH) : { calls: [], stopped: null }; const cross = crossPresent ? readJson(CROSS_VENDOR_PATH) : { calls: [] };
  validatePacketWriteInputs(manifest, terra, cross, { terraPresent, crossPresent, terraCallsDigest: terraPresent ? fileHash(resolve(ROOT, TERRA_PATH)) : null });
  const sol = existsSync(resolve(ROOT, SOL_PROBE_PATH)) ? readJson(SOL_PROBE_PATH) : { expected_call_count: 46, calls: [], stopped: null, provider: null };
  if (existsSync(resolve(ROOT, SOL_PROBE_PATH))) validateSolForReport(sol);
  const manifestRows = new Map(manifest.rows.map((row) => [row.row_id, row]));
  const complete = terra.calls.filter((call) => call.state === 'COMPLETE'); const blockedAttempts = terra.calls.filter((call) => call.cohort === 'DETERMINISTIC_BLOCKED'); const blocked = blockedAttempts.filter((call) => call.state === 'COMPLETE'); const recovered = blocked.filter((call) => call.output.disposition === 'RESOLVED');
  const blindAttempts = terra.calls.filter((call) => call.cohort === 'HUMAN_BLIND_FLOOR'); const anchorAttempts = terra.calls.filter((call) => call.cohort === 'HUMAN_ANCHOR_DECIDED');
  const blind = blindAttempts.filter((call) => call.state === 'COMPLETE'); const anchor = anchorAttempts.filter((call) => call.state === 'COMPLETE');
  const blindCorrect = blind.filter((call) => call.output.classification === manifestRows.get(call.row_id).human_label).length;
  const anchorScorable = anchor.filter((call) => manifestRows.get(call.row_id).input.error_class !== 'PARTY_ATTRIBUTION');
  const anchorCorrect = anchorScorable.filter((call) => call.output.classification === manifestRows.get(call.row_id).human_label).length;
  const anchorParty = anchor.filter((call) => manifestRows.get(call.row_id).input.error_class === 'PARTY_ATTRIBUTION');
  const anchorPartyCorrect = anchorParty.filter((call) => call.output.classification === manifestRows.get(call.row_id).human_label).length;
  const anchorNonPartyN = manifest.rows.filter((row) => row.cohort === 'HUMAN_ANCHOR_DECIDED' && row.input.error_class !== 'PARTY_ATTRIBUTION').length;
  const anchorPartyN = manifest.rows.filter((row) => row.cohort === 'HUMAN_ANCHOR_DECIDED' && row.input.error_class === 'PARTY_ATTRIBUTION').length;
  const preadjudicatedNonPartyN = 96 + anchorNonPartyN; const preadjudicatedNonPartyCorrect = blindCorrect + anchorCorrect;
  const preadjudicatedComplete = blindAttempts.length === 96 && blind.length === 96 && anchorAttempts.length === 54 && anchor.length === 54;
  const crossComplete = cross.calls.filter((call) => call.state === 'COMPLETE'); const crossCorrect = crossComplete.filter((call) => call.output.classification === 'CORRECT').length;
  const crossCoverage = exactCrossCoverage(terra, cross);
  const packet = existsSync(resolve(ROOT, HUMAN_PACKET_PATH)) ? readJson(HUMAN_PACKET_PATH) : null;
  if (!packet && existsSync(resolve(ROOT, HUMAN_LEDGER_PATH))) throw new Error('HUMAN_LEDGER_WITHOUT_PACKET');
  if (packet && canonicalJson(packet) !== canonicalJson(buildHumanPacket(manifest, terra, cross))) throw new Error('HUMAN_PACKET_DRIFT');
  const ledger = packet && existsSync(resolve(ROOT, HUMAN_LEDGER_PATH)) ? readJson(HUMAN_LEDGER_PATH) : null;
  const human = packet && ledger ? humanLedgerMetrics(packet, ledger) : { valid: packet ? ledger === null : true, decisions: 0, correct: 0, agreement: null, complete: false, decision_rows: [] };
  const hidden = human.complete ? buildHiddenComparison(packet, ledger, cross) : null;
  if (!hidden && existsSync(resolve(ROOT, HIDDEN_COMPARISON_PATH))) throw new Error('HIDDEN_COMPARISON_BEFORE_COMPLETE_HUMAN_LEDGER');
  if (hidden && existsSync(resolve(ROOT, HIDDEN_COMPARISON_PATH)) && canonicalJson(readJson(HIDDEN_COMPARISON_PATH)) !== canonicalJson(hidden)) throw new Error('HIDDEN_COMPARISON_DRIFT');
  const humanDecisionById = new Map(human.decision_rows.map((decision) => [decision.row_id, decision])); const humanSelected = new Set((packet?.cards || []).map((card) => card.row.row_id));
  const selectedBlocked = manifest.rows.filter((row) => row.cohort === 'DETERMINISTIC_BLOCKED'); const callById = new Map(blockedAttempts.map((call) => [call.row_id, call]));
  const perItem = selectedBlocked.map((row) => { const call = callById.get(row.row_id); const disposition = call?.state === 'COMPLETE' ? call.output.disposition : null; return { row_id: row.row_id, family: row.family, attempted: Boolean(call), before: { attempted: 1, resolved: 0, open_world: row.current_state === 'OPEN_WORLD' ? 1 : 0, review: row.current_state === 'REVIEW' ? 1 : 0 }, after: { attempted: call ? 1 : 0, resolved: disposition === 'RESOLVED' ? 1 : 0, open_world: disposition === 'OPEN_WORLD' ? 1 : 0, review: disposition === 'REVIEW' ? 1 : 0 }, call_state: call?.state || 'PENDING', measurement_state: disposition === 'RESOLVED' ? 'MODEL_PROPOSED_GOVERNED_PLACEMENT' : disposition || 'PENDING', claim_definition_key: call?.output?.claim_definition_key || null, cross_vendor: cross.calls.find((score) => score.row_id === row.row_id)?.output?.classification || 'NOT_SCORED', human: humanDecisionById.get(row.row_id)?.verdict || (humanSelected.has(row.row_id) ? 'PENDING' : 'NOT_SELECTED') }; });
  const perFamily = [...new Set(perItem.map((row) => row.family))].sort().map((family) => { const items = perItem.filter((row) => row.family === family); const sum = (side, key) => items.reduce((total, item) => total + item[side][key], 0); return { family, selected: items.length, before: { attempted: sum('before', 'attempted'), resolved: sum('before', 'resolved'), open_world: sum('before', 'open_world'), review: sum('before', 'review') }, after: { attempted: sum('after', 'attempted'), resolved: sum('after', 'resolved'), open_world: sum('after', 'open_world'), review: sum('after', 'review') }, failed: items.filter((row) => row.call_state === 'CALL_FAILED' || row.call_state === 'MALFORMED_OUTPUT').length, pending: items.filter((row) => row.call_state === 'PENDING').length }; });
  const recoveryRate = recovered.length / manifest.selection.blocked_sample_size; const crossRate = crossComplete.length ? crossCorrect / crossComplete.length : null;
  const recoveredIds = new Set(recovered.map((call) => call.row_id)); const scoredIds = new Set(crossComplete.map((call) => call.row_id));
  const stoppedCall = terra.stopped ? terra.calls.at(-1) : null;
  const stopDiagnostic = stoppedCall?.state === 'MALFORMED_OUTPUT'
    && typeof stoppedCall.output?.party === 'string'
    && String(manifestRows.get(stoppedCall.row_id)?.source_text || '').includes(stoppedCall.output.party)
    ? {
      code: 'PARTY_SCHEMA_SHAPE_MISMATCH',
      frozen_receipt_error: stoppedCall.errors,
      party_value: stoppedCall.output.party,
      party_value_is_byte_explicit_in_source: true,
      explanation: 'The prompt showed party as null but did not state the permitted non-null object shape. The source-grounded string therefore failed the object validator.',
      retry_authority: 'NEW_MANIFEST_REQUIRED',
    }
    : null;
  const gates = {
    terra_explicit_invocation_identity_receipts_complete: terra.calls.length === manifest.rows.length ? terra.calls.every((call) => call.state === 'COMPLETE' && terraInvocationIdentityValid(call.codex_invocation_identity)) : null,
    blocked_sample_complete: blockedAttempts.length === manifest.selection.blocked_sample_size && blocked.length === manifest.selection.blocked_sample_size,
    recovery_at_least_60_percent: blockedAttempts.length === manifest.selection.blocked_sample_size ? recoveryRate >= 0.60 : null,
    every_recovered_cross_vendor_scored: recovered.length > 0 && crossCoverage.complete && scoredIds.size === recoveredIds.size && [...recoveredIds].every((id) => scoredIds.has(id)),
    recovered_human_adjudications_at_least_50: human.complete,
    recovered_human_correctness_at_least_95_percent: human.complete ? hidden.metrics.recovered_human_agreement >= 0.95 : null,
    cross_vendor_to_human_agreement_at_least_95_percent: human.complete ? hidden.metrics.cross_vendor_human_agreement >= 0.95 : null,
    party_attribution: 'UNMEASURED_PENDING_JUDGEABLE_RE_SIT',
    lead_tier_probe_complete_without_stop: sol.calls.length === 46 && sol.calls.every((call) => call.state === 'COMPLETE') && sol.stopped === null,
    publication_authorised: false,
  };
  const status = terra.stopped || sol.stopped ? 'STOPPED' : !human.valid ? 'INVALID_HUMAN_LEDGER' : !gates.blocked_sample_complete || !preadjudicatedComplete || !gates.terra_explicit_invocation_identity_receipts_complete ? 'INCOMPLETE_CALLS' : gates.recovery_at_least_60_percent === false ? 'STOPPED_COHORT_FAR_UNDER_ESTIMATE' : !gates.every_recovered_cross_vendor_scored ? 'INCOMPLETE_CROSS_VENDOR' : !gates.lead_tier_probe_complete_without_stop ? 'INCOMPLETE_LEAD_TIER_PROBE' : !human.complete ? 'PENDING_HUMAN_ADJUDICATION' : gates.recovered_human_correctness_at_least_95_percent && gates.cross_vendor_to_human_agreement_at_least_95_percent ? 'REPORT_ONLY_MEASUREMENT_COMPLETE' : 'NO_PASS';
  const fourStateTotal = (side) => ({ attempted: perItem.reduce((sum, row) => sum + row[side].attempted, 0), resolved: perItem.reduce((sum, row) => sum + row[side].resolved, 0), open_world: perItem.reduce((sum, row) => sum + row[side].open_world, 0), review: perItem.reduce((sum, row) => sum + row[side].review, 0) });
  const solItems = sol.calls.map((call) => ({ call_id: call.call_id, deal: call.spec.deal, family: call.spec.family, section_reference: call.spec.section_reference, state: call.state, before: call.output?.comparison?.before || null, after: call.output?.comparison?.after || null, delta: call.output?.comparison?.delta || null, stop: call.output?.comparison?.stop || null }));
  const solFamilies = [...new Set(solItems.map((row) => row.family))].sort().map((family) => { const items = solItems.filter((row) => row.family === family && row.before && row.after); const total = (side, key) => items.reduce((sum, row) => sum + row[side][key], 0); return { family, attempted_sections: items.length, before: { attempted: total('before', 'attempted'), resolved: total('before', 'resolved'), open_world: total('before', 'open_world'), review: total('before', 'review') }, after: { attempted: total('after', 'attempted'), resolved: total('after', 'resolved'), open_world: total('after', 'open_world'), review: total('after', 'review') } }; });
  const confidenceMethod = { method_id: 'WILSON_SCORE_ONE_SIDED_LOWER_BOUND/V1', confidence_level: 0.95, sidedness: 'ONE_SIDED_LOWER', z: 1.6448536269514722 };
  return {
    schema_version: 'STAGE_2Y_PHASE_B_REPORT/V1', generated_at: new Date().toISOString(), manifest_id: manifest.manifest_id, status,
    stop: terra.stopped || sol.stopped || null, stop_diagnostic: stopDiagnostic, providers: manifest.providers,
    measurement_scope: {
      resolved_label_meaning: 'MODEL_PROPOSED_GOVERNED_PLACEMENT',
      lawyer_visible_recovery_claimed: false,
      resolver_adapter_projection_validation: 'NOT_RUN_RESERVED_FOR_LATER_ADAPTER_GATE',
      warning: 'A Phase B RESOLVED disposition is not a proved resolver-accepted or rendered-with-content row.',
    },
    confidence_method: confidenceMethod,
    counts: { terra_selected: manifest.rows.length, terra_attempted: terra.calls.length, terra_complete: complete.length, terra_failed_or_malformed: terra.calls.length - complete.length, blind_selected: 96, blind_attempted: blindAttempts.length, anchor_selected: 54, anchor_attempted: anchorAttempts.length, blocked_selected: manifest.selection.blocked_sample_size, blocked_attempted: blockedAttempts.length, blocked_complete: blocked.length, blocked_failed_or_malformed: blockedAttempts.length - blocked.length, blocked_model_proposed_placements: recovered.length, cross_vendor_attempted: cross.calls.length, cross_vendor_complete: crossComplete.length, cross_vendor_failed_or_malformed: cross.calls.length - crossComplete.length, human_recovered_decisions: human.decisions, sol_probe_selected: sol.expected_call_count || 46, sol_probe_attempted: sol.calls.length, sol_probe_complete: sol.calls.filter((call) => call.state === 'COMPLETE').length },
    calibration: {
      blind_floor: { correct: blindCorrect, n: 96, attempted: blindAttempts.length, agreement: blindCorrect / 96, lower_confidence_bound: wilsonLowerBound(blindCorrect, 96) },
      anchor_excluding_party: { correct: anchorCorrect, n: anchorNonPartyN, attempted: anchorScorable.length, agreement: anchorCorrect / anchorNonPartyN, lower_confidence_bound: wilsonLowerBound(anchorCorrect, anchorNonPartyN) },
      preadjudicated_non_party_ground_truth: { correct: preadjudicatedNonPartyCorrect, n: preadjudicatedNonPartyN, attempted: blindAttempts.length + anchorAttempts.length, complete: preadjudicatedComplete, agreement: preadjudicatedNonPartyCorrect / preadjudicatedNonPartyN, lower_confidence_bound: wilsonLowerBound(preadjudicatedNonPartyCorrect, preadjudicatedNonPartyN) },
      party_attribution_descriptive_only: { criterion_status: 'UNMEASURED_PENDING_JUDGEABLE_RE_SIT', descriptive_only: true, correct: anchorPartyCorrect, n: anchorPartyN, attempted: anchorParty.length, agreement: anchorPartyN ? anchorPartyCorrect / anchorPartyN : null, lower_confidence_bound: wilsonLowerBound(anchorPartyCorrect, anchorPartyN), excluded_cant_judge_cards: 9 },
    },
    recovery: {
      metric: 'MODEL_PROPOSED_GOVERNED_PLACEMENT_RATE', rate: recoveryRate, denominator: manifest.selection.blocked_sample_size, lower_confidence_bound: wilsonLowerBound(recovered.length, manifest.selection.blocked_sample_size),
      cross_vendor_correct: crossCorrect, cross_vendor_n: crossComplete.length, cross_vendor_correctness: crossRate, cross_vendor_correctness_lower_confidence_bound: wilsonLowerBound(crossCorrect, crossComplete.length),
      recovered_human_correct: hidden?.metrics.recovered_human_correct ?? null, recovered_human_n: hidden?.metrics.recovered_human_n ?? 0, recovered_human_correctness: hidden?.metrics.recovered_human_agreement ?? null, recovered_human_correctness_lower_confidence_bound: hidden ? wilsonLowerBound(hidden.metrics.recovered_human_correct, hidden.metrics.recovered_human_n) : null,
      cross_vendor_human_matches: hidden?.metrics.cross_vendor_human_matches ?? null, cross_vendor_human_n: hidden?.metrics.cross_vendor_human_n ?? 0, cross_vendor_human_agreement: hidden?.metrics.cross_vendor_human_agreement ?? null, cross_vendor_human_agreement_lower_confidence_bound: hidden ? wilsonLowerBound(hidden.metrics.cross_vendor_human_matches, hidden.metrics.cross_vendor_human_n) : null,
      hidden_comparison_id: hidden?.comparison_id || null,
    },
    blocked_four_state: { before: fourStateTotal('before'), after: fourStateTotal('after') }, per_family: perFamily, per_item: perItem,
    lead_tier_probe: { provider: sol.provider, cohort_name: 'AUTHORITATIVE_46_CALL_CLOSING_CONDITIONS_BATCH', composition: countsBy(sol.call_manifest || [], (call) => call.family), selected_sections: sol.expected_call_count || 46, attempted_sections: sol.calls.length, stopped: sol.stopped || null, per_family: solFamilies, per_item: solItems },
    human_adjudication: { packet_status: packet?.status || 'NOT_CREATED_PENDING_EXACT_CROSS_VENDOR_COVERAGE', ledger_valid: human.valid, ledger_complete: human.complete, decisions: human.decisions, comparison_sealed_separately: true },
    gates, publication_authorisation: 'NONE',
  };
}
function markdownReport(report) {
  const percent = (value) => value === null ? 'not measured' : `${(value * 100).toFixed(1)}%`;
  const rows = report.per_family.map((row) => `| ${row.family} | ${row.before.attempted} | ${row.before.resolved} | ${row.before.open_world} | ${row.before.review} | ${row.after.attempted} | ${row.after.resolved} | ${row.after.open_world} | ${row.after.review} | ${row.failed} | ${row.pending} |`).join('\n');
  const stopped = report.stop_diagnostic ? `\n- Stop diagnostic: ${report.stop_diagnostic.code}. ${report.stop_diagnostic.explanation}` : '';
  return `# Stage 2Y Phase B model experiment\n\nStatus: **${report.status}**. Publication authority: **NONE**.\n\nA RESOLVED result means a model-proposed governed placement. It does not mean resolver acceptance or a lawyer-visible rendered row. Adapter and projection validation are a later gate.\n\n- Terra calls complete: ${report.counts.terra_complete}${stopped}\n- Pre-adjudicated non-party agreement: ${percent(report.calibration.preadjudicated_non_party_ground_truth.agreement)}. This is calibration, not the recovered-row 95% gate.\n- Proposed placements: ${report.counts.blocked_model_proposed_placements}/${report.recovery.denominator} (${percent(report.recovery.rate)}; one-sided 95% Wilson lower bound ${percent(report.recovery.lower_confidence_bound)})\n- Cross-vendor scores: ${report.counts.cross_vendor_complete}/${report.counts.blocked_model_proposed_placements}\n- Human decisions on proposed placements: ${report.counts.human_recovered_decisions}, exactly 50 required\n- Lead probe composition: 26 Closing Conditions, 8 Financing Covenants, 12 Proxy Meeting calls\n- Party attribution: n=7 is descriptive only; the criterion is unmeasured pending a judgeable re-sit\n\n| family | before attempted | before resolved | before open-world | before review | after attempted | after proposed placement | after open-world | after review | failed | pending |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|\n${rows}\n`;
}
function prepare() { const manifest = buildManifest(); writeAtomic(MANIFEST_PATH, manifest); return manifest; }
function sealHumanLedgerFile() {
  if (!existsSync(resolve(ROOT, HUMAN_PACKET_PATH)) || !existsSync(resolve(ROOT, HUMAN_LEDGER_PATH))) throw new Error('HUMAN_PACKET_OR_LEDGER_MISSING');
  const packet = readJson(HUMAN_PACKET_PATH); const current = readJson(HUMAN_LEDGER_PATH); if (!Array.isArray(current.decisions)) throw new Error('HUMAN_LEDGER_DECISIONS_INVALID');
  const sealed = sealHumanLedger(packet, current.decisions); const metrics = humanLedgerMetrics(packet, sealed); if (!metrics.valid) throw new Error('HUMAN_LEDGER_INVALID');
  writeAtomic(HUMAN_LEDGER_PATH, sealed); return sealed;
}
function report() {
  const manifest = readJson(MANIFEST_PATH); const terraPresent = existsSync(resolve(ROOT, TERRA_PATH)); const crossPresent = existsSync(resolve(ROOT, CROSS_VENDOR_PATH));
  const terra = terraPresent ? readJson(TERRA_PATH) : { calls: [], stopped: null }; const cross = crossPresent ? readJson(CROSS_VENDOR_PATH) : { calls: [] };
  validatePacketWriteInputs(manifest, terra, cross, { terraPresent, crossPresent, terraCallsDigest: terraPresent ? fileHash(resolve(ROOT, TERRA_PATH)) : null });
  const blockedComplete = terra.calls.filter((call) => call.cohort === 'DETERMINISTIC_BLOCKED' && call.state === 'COMPLETE').length === manifest.selection.blocked_sample_size;
  const coverage = exactCrossCoverage(terra, cross);
  if (blockedComplete && coverage.complete && coverage.recovered.length >= 50) {
    const packet = buildHumanPacket(manifest, terra, cross);
    if (existsSync(resolve(ROOT, HUMAN_PACKET_PATH)) && canonicalJson(readJson(HUMAN_PACKET_PATH)) !== canonicalJson(packet)) throw new Error('HUMAN_PACKET_DRIFT');
    if (!existsSync(resolve(ROOT, HUMAN_PACKET_PATH))) writeAtomic(HUMAN_PACKET_PATH, packet);
    if (!existsSync(resolve(ROOT, HUMAN_LEDGER_PATH))) writeAtomic(HUMAN_LEDGER_PATH, emptyHumanLedger(packet));
    const ledger = readJson(HUMAN_LEDGER_PATH); const human = humanLedgerMetrics(packet, ledger);
    if (!human.valid) throw new Error('HUMAN_LEDGER_INVALID');
    if (human.complete) {
      const hidden = buildHiddenComparison(packet, ledger, cross);
      if (existsSync(resolve(ROOT, HIDDEN_COMPARISON_PATH)) && canonicalJson(readJson(HIDDEN_COMPARISON_PATH)) !== canonicalJson(hidden)) throw new Error('HIDDEN_COMPARISON_DRIFT');
      if (!existsSync(resolve(ROOT, HIDDEN_COMPARISON_PATH))) writeAtomic(HIDDEN_COMPARISON_PATH, hidden);
    }
  }
  const value = buildReport(); writeAtomic(REPORT_PATH, value); writeFileSync(resolve(ROOT, REPORT_MD_PATH), markdownReport(value)); return value;
}
function parseArgs(argv) {
  const modes = argv.filter((arg) => ['--prepare', '--run-terra', '--run-cross-vendor', '--seal-human-ledger', '--report'].includes(arg));
  if (modes.length !== 1 || argv.some((arg) => ![...modes, '--resume'].includes(arg)) || (argv.includes('--resume') && !['--run-terra', '--run-cross-vendor'].includes(modes[0]))) throw new Error('USAGE: --prepare | --run-terra [--resume] | --run-cross-vendor [--resume] | --seal-human-ledger | --report');
  return { mode: modes[0], resume: argv.includes('--resume') };
}
async function main() {
  const args = parseArgs(process.argv.slice(2)); let value;
  if (args.mode === '--prepare') value = prepare();
  if (args.mode === '--run-terra') value = await runTerra(args);
  if (args.mode === '--run-cross-vendor') value = await runCrossVendor(args);
  if (args.mode === '--seal-human-ledger') value = sealHumanLedgerFile();
  if (args.mode === '--report') value = report();
  process.stdout.write(`${args.mode} complete: ${value.manifest_id || value.status || value.calls?.length || 0}\n`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1; });

export { buildManifest, validateManifest, stratifiedSample, terraPrompt, validateTerraOutput, terraInvocationIdentityValid, validateTerraArtifact, baseCallArtifact, validateCrossVendorArtifact, baseCrossVendorArtifact, validatePacketWriteInputs, validateSolForReport, exactCrossCoverage, buildHumanPacket, emptyHumanLedger, sealHumanLedger, humanLedgerMetrics, buildHiddenComparison, wilsonLowerBound, buildReport, parseArgs };
