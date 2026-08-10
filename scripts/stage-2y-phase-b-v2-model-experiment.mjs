#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import {
  existsSync, mkdirSync, readFileSync, renameSync, writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { canonicalJson, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const V1_ROOT = 'evidence/canonical-v2/stage-2y-phase-b';
const OUTPUT_ROOT = 'evidence/canonical-v2/stage-2y-phase-b-v2';
const V1_MANIFEST_PATH = `${V1_ROOT}/manifest.json`;
const MANIFEST_PATH = `${OUTPUT_ROOT}/manifest.json`;
const BASELINE_PATH = `${OUTPUT_ROOT}/terra-calls.json`;
const CROSS_VENDOR_PATH = `${OUTPUT_ROOT}/cross-vendor-calls.json`;
const REPORT_PATH = `${OUTPUT_ROOT}/report.json`;
const REPORT_MD_PATH = `${OUTPUT_ROOT}/report.md`;
const PROTOCOL_VERSION = 'STAGE_2Y_PHASE_B_PROTOCOL/V2';
const MANIFEST_SCHEMA = 'STAGE_2Y_PHASE_B_MANIFEST/V2';
const BASELINE_SCHEMA = 'STAGE_2Y_PHASE_B_TERRA_CALLS/V2';
const CROSS_VENDOR_SCHEMA = 'STAGE_2Y_PHASE_B_CROSS_VENDOR_CALLS/V2';
const REPORT_SCHEMA = 'STAGE_2Y_PHASE_B_REPORT/V2';
const BASELINE_PROMPT_ID = 'STAGE_2Y_PHASE_B_BLOCKED_RECOVERY';
const BASELINE_PROMPT_VERSION = 'STAGE_2Y_PHASE_B_BLOCKED_RECOVERY_PROMPT/V2';
const CROSS_VENDOR_PROMPT_ID = 'STAGE_2Y_PHASE_B_RECOVERY_JUDGE';
const CROSS_VENDOR_PROMPT_VERSION = 'STAGE_2Y_PHASE_B_RECOVERY_JUDGE_PROMPT/V2';
const BLOCKED_COHORT = 'DETERMINISTIC_BLOCKED';
const BLOCKED_SAMPLE_SIZE = 150;
const EXPECTED_V1_MANIFEST_ID = 'd8b971b70635b9efcd3a434de0859320dfd83d0e97540a2dc103dae2ae4e923c';
const EXPECTED_V1_MANIFEST_DIGEST = '1a4d4948761ea8353a1211dfa4bb8b1cd02c3aac5f5f8c1b284fa3751f56d504';
const EXPECTED_V1_BLOCKED_ROW_ORDER_ROOT = '0d8cec7d8c29ae201b0ac9cdbac260c6d718e3f650fd9c2a60795aa509c86fd9';
const EXPECTED_V1_BLOCKED_ROW_SET_ROOT = '55ea6a7f5df6a7630d9264e42c8fce9924253dcc8be691e2a662b1fd2c9b6d20';
const GATE_THRESHOLDS = Object.freeze({
  recovery_rate_minimum: 0.60,
  recovered_human_adjudications_required: 50,
  recovered_human_correctness_minimum: 0.95,
  cross_vendor_human_agreement_minimum: 0.95,
  lead_tier_probe_calls_required: 46,
});
const JSON_ONLY = 'Output only the requested JSON object. Do not use tools. Use only the evidence in this prompt.';
const BASELINE_PROVIDER_BODY = Object.freeze({
  provider_id: 'OPENAI_CODEX_CLI_SUBSCRIPTION',
  vendor: 'OpenAI',
  execution_surface: 'CODEX_EXEC_JSONL',
  model: 'gpt-5.6-terra',
  reasoning_effort: 'medium',
  profile_id: 'TERRA_MEDIUM',
  requested_model_id: 'gpt-5.6-terra;reasoning=medium;profile=TERRA_MEDIUM',
  invocation_arguments: [
    'exec', '--json', '-s', 'read-only', '--color', 'never', '-m', 'gpt-5.6-terra',
    '-c', 'model_reasoning_effort="medium"', '--ephemeral', '--skip-git-repo-check', '-',
  ],
});
const CROSS_VENDOR_PROVIDER_BODY = Object.freeze({
  provider_id: 'ANTHROPIC_CLAUDE_CLI_SUBSCRIPTION',
  vendor: 'Anthropic',
  execution_surface: 'CLAUDE_PRINT_JSON',
  model: 'claude-opus-4-1',
  requested_model_id: 'claude-opus-4-1',
  invocation_arguments: [
    '-p', '--output-format', 'json', '--model', 'claude-opus-4-1',
    '--append-system-prompt', JSON_ONLY,
  ],
});
let sequence = 0;

function hash(value) {
  return sha256Hex(Buffer.from(typeof value === 'string' ? value : canonicalJson(value), 'utf8'));
}

function fileHash(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function readJson(path) {
  return JSON.parse(readFileSync(resolve(ROOT, path), 'utf8'));
}

function writeAtomic(path, value) {
  const absolute = resolve(ROOT, path);
  mkdirSync(dirname(absolute), { recursive: true });
  const temporary = `${absolute}.tmp-${process.pid}-${sequence++}`;
  writeFileSync(temporary, `${canonicalJson(value)}\n`);
  renameSync(temporary, absolute);
}

function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nonempty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function exactKeys(value, keys) {
  return object(value) && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}

function providerIdentity(body) {
  return Object.freeze({ ...body, provider_identity_id: hash(body) });
}

const BASELINE_PROVIDER = providerIdentity(BASELINE_PROVIDER_BODY);
const CROSS_VENDOR_PROVIDER = providerIdentity(CROSS_VENDOR_PROVIDER_BODY);
const BASELINE_INVOCATION_IDENTITY = Object.freeze({
  identity_basis: 'EXPLICIT_CLI_ARGUMENTS',
  command: 'codex',
  model: BASELINE_PROVIDER.model,
  reasoning_effort: BASELINE_PROVIDER.reasoning_effort,
  invocation_arguments: BASELINE_PROVIDER.invocation_arguments,
});
const CROSS_VENDOR_INVOCATION_IDENTITY = Object.freeze({
  identity_basis: 'EXPLICIT_CLI_ARGUMENTS',
  command: 'claude',
  model: CROSS_VENDOR_PROVIDER.model,
  reasoning_effort: null,
  invocation_arguments: CROSS_VENDOR_PROVIDER.invocation_arguments,
});

const BASELINE_PROMPT_INSTRUCTIONS = Object.freeze([
  'Apply the Stage 2Y corroboration rung-4 shape to one deterministically blocked merger-agreement row.',
  'Resolve only when the recorded source supports a listed governed claim placement and does not positively contradict it.',
  'Use OPEN_WORLD when the source contains a real legal item but none of the listed governed placements can express it.',
  'Use REVIEW when the source is insufficient, ambiguous, internally conflicting, or would require an unlisted value or unsupported inference.',
  'Never infer a party.',
  'The party field must be exactly null OR exactly an object with one key in the shape {"value":"explicit party text"}. Never return a bare string for party.',
  'If party is an object, party.value must be byte-identical text that occurs in source_text. If the party is not explicit in source_text, set party to null.',
  'For RESOLVED, claim_definition_key must be one listed governed placement. Every supporting quote must be byte-identical text from source_text.',
  'Echo input row_id exactly.',
  'Return exactly {"row_id":"...","disposition":"RESOLVED|OPEN_WORLD|REVIEW","claim_definition_key":null,"canonical_value":null,"party":null,"supporting_quotes":[],"rationale":"..."}.',
]);

const CROSS_VENDOR_PROMPT_INSTRUCTIONS = Object.freeze([
  'Independently score one proposed recovered placement from a merger agreement. You did not produce this placement.',
  'Use only the recorded source and governed-placement list.',
  'CORRECT means the exact placement, value, party and supporting quotes are supported. ERROR means any part is wrong. CANT_JUDGE means the evidence is insufficient.',
  'Treat party as valid only when it is null or an object with exactly one string key named value. A bare party string is invalid.',
  'Echo input row_id exactly.',
  'Return exactly {"row_id":"...","classification":"CORRECT|ERROR|CANT_JUDGE","error_class":"PARTY_ATTRIBUTION|MATERIALITY_OR_QUALIFIER|SPAN|TOPIC_BUCKET|OTHER|null","rationale":"..."}.',
]);

function baselinePrompt(row) {
  return [
    JSON_ONLY,
    `PROMPT_ID=${BASELINE_PROMPT_ID}`,
    `PROMPT_VERSION=${BASELINE_PROMPT_VERSION}`,
    ...BASELINE_PROMPT_INSTRUCTIONS,
    `ROW_ID=${row.row_id}`,
    `INPUT=${canonicalJson(row)}`,
  ].join('\n\n');
}

function baselineBinding(row) {
  const rowDigest = hash(row);
  const promptDigest = hash(baselinePrompt(row));
  const body = {
    protocol_version: PROTOCOL_VERSION,
    prompt_id: BASELINE_PROMPT_ID,
    prompt_version: BASELINE_PROMPT_VERSION,
    prompt_digest: promptDigest,
    row_id: row.row_id,
    row_digest: rowDigest,
    provider_identity_id: BASELINE_PROVIDER.provider_identity_id,
  };
  return { ...body, request_binding_id: hash(body) };
}

function crossVendorPrompt(row, baselineCall) {
  return [
    JSON_ONLY,
    `PROMPT_ID=${CROSS_VENDOR_PROMPT_ID}`,
    `PROMPT_VERSION=${CROSS_VENDOR_PROMPT_VERSION}`,
    ...CROSS_VENDOR_PROMPT_INSTRUCTIONS,
    `SOURCE=${canonicalJson(row)}`,
    `BASELINE_CALL_BINDING=${canonicalJson({
      baseline_call_id: baselineCall.call_id,
      baseline_response_digest: baselineCall.response_digest,
      proposed_placement: baselineCall.output,
    })}`,
  ].join('\n\n');
}

function crossVendorBinding(row, baselineCall) {
  const body = {
    protocol_version: PROTOCOL_VERSION,
    prompt_id: CROSS_VENDOR_PROMPT_ID,
    prompt_version: CROSS_VENDOR_PROMPT_VERSION,
    prompt_digest: hash(crossVendorPrompt(row, baselineCall)),
    row_id: row.row_id,
    row_digest: hash(row),
    provider_identity_id: CROSS_VENDOR_PROVIDER.provider_identity_id,
    baseline_call_id: baselineCall.call_id,
    baseline_response_digest: baselineCall.response_digest,
  };
  return { ...body, request_binding_id: hash(body) };
}

function blockedRowRoots(rows) {
  const ids = rows.map((row) => row.row_id);
  return { row_order_root: hash(ids), row_set_root: hash([...ids].sort()) };
}

function assertExactV1Source(sourceManifest, sourceManifestDigest) {
  if (!object(sourceManifest) || sourceManifest.schema_version !== 'STAGE_2Y_PHASE_B_MANIFEST/V1'
    || sourceManifest.manifest_id !== EXPECTED_V1_MANIFEST_ID || !Array.isArray(sourceManifest.rows)
    || sourceManifestDigest !== EXPECTED_V1_MANIFEST_DIGEST) {
    throw new Error('PHASE_B_V1_MANIFEST_INVALID');
  }
  const rows = sourceManifest.rows.filter((row) => row.cohort === BLOCKED_COHORT);
  if (rows.length !== BLOCKED_SAMPLE_SIZE || new Set(rows.map((row) => row.row_id)).size !== BLOCKED_SAMPLE_SIZE) {
    throw new Error(`BLOCKED_SAMPLE_COUNT_INVALID:${rows.length}`);
  }
  if (rows.some((row) => !nonempty(row.row_id))) throw new Error('BLOCKED_ROW_ID_INVALID');
  const roots = blockedRowRoots(rows);
  if (roots.row_order_root !== EXPECTED_V1_BLOCKED_ROW_ORDER_ROOT
    || roots.row_set_root !== EXPECTED_V1_BLOCKED_ROW_SET_ROOT) throw new Error('PHASE_B_V1_BLOCKED_ROW_AUTHORITY_INVALID');
  return { rows, roots };
}

function buildManifest({ sourceManifest, sourceManifestDigest }) {
  const { rows, roots } = assertExactV1Source(sourceManifest, sourceManifestDigest);
  const rowBindings = rows.map(baselineBinding);
  const body = {
    schema_version: MANIFEST_SCHEMA,
    protocol_version: PROTOCOL_VERSION,
    prepared_on: '2026-08-10',
    purpose: 'Corrected report-only Stage 2Y Phase B blocked-row model experiment. No publication or activation authority.',
    authority: { publication_authorisation: 'NONE', serving_activated: false, product_writes: false },
    source: {
      path: V1_MANIFEST_PATH,
      schema_version: sourceManifest.schema_version,
      manifest_id: sourceManifest.manifest_id,
      manifest_digest: sourceManifestDigest,
      use: 'ROW_SELECTION_SOURCE_ONLY',
      blocked_row_order_root: roots.row_order_root,
      blocked_row_set_root: roots.row_set_root,
    },
    selection: {
      cohort: BLOCKED_COHORT,
      predicate: 'row.cohort === "DETERMINISTIC_BLOCKED"',
      expected_row_count: BLOCKED_SAMPLE_SIZE,
      actual_row_count: rows.length,
      excluded_v1_cohorts: ['HUMAN_BLIND_FLOOR', 'HUMAN_ANCHOR_DECIDED'],
    },
    prompt_contracts: {
      baseline: {
        prompt_id: BASELINE_PROMPT_ID,
        prompt_version: BASELINE_PROMPT_VERSION,
        instruction_digest: hash(BASELINE_PROMPT_INSTRUCTIONS),
        party_schema: { any_of: [null, { value: 'string' }], additional_properties: false },
      },
      cross_vendor: {
        prompt_id: CROSS_VENDOR_PROMPT_ID,
        prompt_version: CROSS_VENDOR_PROMPT_VERSION,
        instruction_digest: hash(CROSS_VENDOR_PROMPT_INSTRUCTIONS),
      },
    },
    provider_identities: { baseline: BASELINE_PROVIDER, cross_vendor: CROSS_VENDOR_PROVIDER },
    gate_thresholds: GATE_THRESHOLDS,
    commands: {
      prepare: 'node scripts/stage-2y-phase-b-v2-model-experiment.mjs --prepare',
      baseline: 'node scripts/stage-2y-phase-b-v2-model-experiment.mjs --run-baseline --resume',
      cross_vendor: 'node scripts/stage-2y-phase-b-v2-model-experiment.mjs --run-cross-vendor --resume',
      report: 'node scripts/stage-2y-phase-b-v2-model-experiment.mjs --report',
    },
    row_bindings: rowBindings,
    rows,
  };
  return { ...body, manifest_id: hash(body) };
}

function validateManifest(manifest, { sourceManifest, sourceManifestDigest } = {}) {
  if (!object(manifest) || manifest.schema_version !== MANIFEST_SCHEMA
    || manifest.protocol_version !== PROTOCOL_VERSION || manifest.authority?.publication_authorisation !== 'NONE'
    || manifest.selection?.cohort !== BLOCKED_COHORT || manifest.selection?.actual_row_count !== BLOCKED_SAMPLE_SIZE
    || !Array.isArray(manifest.rows) || manifest.rows.length !== BLOCKED_SAMPLE_SIZE
    || manifest.rows.some((row) => row.cohort !== BLOCKED_COHORT)
    || !Array.isArray(manifest.row_bindings) || manifest.row_bindings.length !== BLOCKED_SAMPLE_SIZE
    || manifest.source?.path !== V1_MANIFEST_PATH
    || manifest.source?.manifest_id !== EXPECTED_V1_MANIFEST_ID
    || manifest.source?.manifest_digest !== EXPECTED_V1_MANIFEST_DIGEST
    || manifest.source?.blocked_row_order_root !== EXPECTED_V1_BLOCKED_ROW_ORDER_ROOT
    || manifest.source?.blocked_row_set_root !== EXPECTED_V1_BLOCKED_ROW_SET_ROOT
    || canonicalJson(manifest.provider_identities?.baseline) !== canonicalJson(BASELINE_PROVIDER)
    || canonicalJson(manifest.provider_identities?.cross_vendor) !== canonicalJson(CROSS_VENDOR_PROVIDER)
    || canonicalJson(manifest.gate_thresholds) !== canonicalJson(GATE_THRESHOLDS)
    || manifest.prompt_contracts?.baseline?.prompt_id !== BASELINE_PROMPT_ID
    || manifest.prompt_contracts?.baseline?.prompt_version !== BASELINE_PROMPT_VERSION
    || manifest.prompt_contracts?.cross_vendor?.prompt_id !== CROSS_VENDOR_PROMPT_ID
    || manifest.prompt_contracts?.cross_vendor?.prompt_version !== CROSS_VENDOR_PROMPT_VERSION) {
    throw new Error('PHASE_B_V2_MANIFEST_INVALID');
  }
  const roots = blockedRowRoots(manifest.rows);
  if (roots.row_order_root !== EXPECTED_V1_BLOCKED_ROW_ORDER_ROOT
    || roots.row_set_root !== EXPECTED_V1_BLOCKED_ROW_SET_ROOT) throw new Error('PHASE_B_V2_ROW_AUTHORITY_INVALID');
  const expectedBindings = manifest.rows.map(baselineBinding);
  if (canonicalJson(manifest.row_bindings) !== canonicalJson(expectedBindings)) throw new Error('PHASE_B_V2_ROW_BINDING_INVALID');
  const { manifest_id: ignored, ...body } = manifest;
  if (manifest.manifest_id !== hash(body)) throw new Error('PHASE_B_V2_MANIFEST_ID_INVALID');
  if (sourceManifest !== undefined) {
    const expected = buildManifest({ sourceManifest, sourceManifestDigest });
    if (canonicalJson(expected) !== canonicalJson(manifest)) throw new Error('PHASE_B_V2_MANIFEST_DRIFT');
  }
  return true;
}

function readAndValidateManifest() {
  const sourceManifest = readJson(V1_MANIFEST_PATH);
  const sourceManifestDigest = fileHash(resolve(ROOT, V1_MANIFEST_PATH));
  const manifest = readJson(MANIFEST_PATH);
  validateManifest(manifest, { sourceManifest, sourceManifestDigest });
  return manifest;
}

function canonicalValueErrors(definition, value) {
  if (!definition) return ['CONTRACT_DEFINITION_MISSING'];
  if (definition.canonical_value_required_when_present && value === null) return ['CANONICAL_VALUE_REQUIRED'];
  if (Array.isArray(definition.allowed_canonical_values)
    && !definition.allowed_canonical_values.some((allowed) => canonicalJson(allowed) === canonicalJson(value))) {
    return ['CANONICAL_VALUE_NOT_ALLOWED'];
  }
  if (definition.canonical_value_type === 'NON_NEGATIVE_DECIMAL_STRING'
    && !(typeof value === 'string' && /^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value))) return ['CANONICAL_VALUE_TYPE_INVALID'];
  if (definition.canonical_value_type === 'ISO_8601_DATE_STRING'
    && !(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value))) return ['CANONICAL_VALUE_TYPE_INVALID'];
  if (definition.canonical_value_type === 'SCHEDULE_REFERENCE_STRING' && !nonempty(value)) return ['CANONICAL_VALUE_TYPE_INVALID'];
  return [];
}

function validPartyShape(party) {
  return party === null || (exactKeys(party, ['value']) && nonempty(party.value));
}

function validateBaselineOutput(row, output) {
  if (!object(output) || !exactKeys(output, [
    'row_id', 'disposition', 'claim_definition_key', 'canonical_value', 'party', 'supporting_quotes', 'rationale',
  ]) || output.row_id !== row.row_id || !nonempty(output.rationale)) return ['OUTPUT_SHAPE_INVALID'];
  const errors = [];
  if (!['RESOLVED', 'OPEN_WORLD', 'REVIEW'].includes(output.disposition)) errors.push('DISPOSITION_INVALID');
  if (!validPartyShape(output.party)) errors.push('PARTY_SHAPE_INVALID');
  if (!Array.isArray(output.supporting_quotes)
    || output.supporting_quotes.some((quote) => !nonempty(quote) || !String(row.source_text || '').includes(quote))) {
    errors.push('SUPPORTING_QUOTE_INVALID');
  }
  if (output.disposition === 'RESOLVED') {
    const placement = (row.governed_placements || []).find((entry) => entry.claim_definition_key === output.claim_definition_key);
    if (!placement || output.supporting_quotes.length === 0) errors.push('RESOLVED_PLACEMENT_INVALID');
    else errors.push(...canonicalValueErrors(placement.contract_definition, output.canonical_value));
    if (object(output.party) && !String(row.source_text || '').includes(output.party.value)) errors.push('PARTY_NOT_EXPLICIT_IN_SOURCE');
  } else if (output.claim_definition_key !== null || output.canonical_value !== null || output.party !== null) {
    errors.push('NON_RESOLVED_PLACEMENT_PRESENT');
  }
  return [...new Set(errors)];
}

function validateCrossVendorOutput(row, output) {
  if (!object(output) || !exactKeys(output, ['row_id', 'classification', 'error_class', 'rationale'])
    || output.row_id !== row.row_id || !nonempty(output.rationale)
    || !['CORRECT', 'ERROR', 'CANT_JUDGE'].includes(output.classification)
    || !['PARTY_ATTRIBUTION', 'MATERIALITY_OR_QUALIFIER', 'SPAN', 'TOPIC_BUCKET', 'OTHER', null].includes(output.error_class)) {
    return ['CROSS_VENDOR_OUTPUT_INVALID'];
  }
  return [];
}

function baseBaselineArtifact(manifest) {
  return {
    schema_version: BASELINE_SCHEMA,
    protocol_version: PROTOCOL_VERSION,
    manifest_id: manifest.manifest_id,
    prompt_id: BASELINE_PROMPT_ID,
    prompt_version: BASELINE_PROMPT_VERSION,
    provider_identity: BASELINE_PROVIDER,
    generation_command: 'node scripts/stage-2y-phase-b-v2-model-experiment.mjs --run-baseline --resume',
    expected_call_count: BLOCKED_SAMPLE_SIZE,
    attempts: [],
    stopped: null,
    publication_authorisation: 'NONE',
  };
}

function latestAttempts(attempts) {
  const latest = new Map();
  for (const attempt of attempts) latest.set(attempt.row_id, attempt);
  return latest;
}

function validateAttemptHistory(manifest, artifact, { crossVendor = false, baselineByRow = null } = {}) {
  const rows = new Map(manifest.rows.map((row) => [row.row_id, row]));
  const counts = new Map();
  const completed = new Set();
  const requestIds = new Set();
  for (const attempt of artifact.attempts) {
    const row = rows.get(attempt.row_id);
    if (!row || completed.has(attempt.row_id)) throw new Error('PHASE_B_V2_CALL_ROW_INVALID');
    const attemptIndex = (counts.get(attempt.row_id) || 0) + 1;
    counts.set(attempt.row_id, attemptIndex);
    if (attempt.attempt_index !== attemptIndex) throw new Error('PHASE_B_V2_ATTEMPT_INDEX_INVALID');
    const binding = crossVendor ? crossVendorBinding(row, baselineByRow.get(row.row_id)) : baselineBinding(row);
    if (attempt.request_binding_id !== binding.request_binding_id || attempt.row_digest !== binding.row_digest
      || attempt.prompt_id !== binding.prompt_id || attempt.prompt_version !== binding.prompt_version
      || attempt.prompt_digest !== binding.prompt_digest
      || attempt.provider_identity_id !== binding.provider_identity_id) throw new Error('PHASE_B_V2_CALL_BINDING_INVALID');
    const { call_id: ignored, ...body } = attempt;
    if (attempt.call_id !== hash(body)) throw new Error('PHASE_B_V2_CALL_ID_INVALID');
    if (!['COMPLETE', 'MALFORMED_OUTPUT', 'CALL_FAILED'].includes(attempt.state)) throw new Error('PHASE_B_V2_CALL_STATE_INVALID');
    if (attempt.provider_request_id) {
      if (requestIds.has(attempt.provider_request_id)) throw new Error('PHASE_B_V2_PROVIDER_REQUEST_DUPLICATE');
      requestIds.add(attempt.provider_request_id);
    }
    if (attempt.response_text !== null && attempt.response_digest !== hash(attempt.response_text)) throw new Error('PHASE_B_V2_RESPONSE_BINDING_INVALID');
    const outputErrors = crossVendor ? validateCrossVendorOutput(row, attempt.output) : validateBaselineOutput(row, attempt.output);
    const expectedInvocationIdentity = crossVendor ? CROSS_VENDOR_INVOCATION_IDENTITY : BASELINE_INVOCATION_IDENTITY;
    if (attempt.state === 'COMPLETE' && (outputErrors.length || !nonempty(attempt.provider_request_id)
      || canonicalJson(attempt.provider_invocation_identity) !== canonicalJson(expectedInvocationIdentity))) {
      throw new Error('PHASE_B_V2_COMPLETE_OUTPUT_INVALID');
    }
    if (attempt.state === 'COMPLETE') completed.add(attempt.row_id);
  }
  const latest = latestAttempts(artifact.attempts);
  if (artifact.stopped) {
    const last = artifact.attempts.at(-1);
    if (!last || last.call_id !== artifact.stopped.call_id || last.row_id !== artifact.stopped.row_id
      || last.state === 'COMPLETE' || !['MALFORMED_OUTPUT', 'CALL_FAILED'].includes(artifact.stopped.code)) {
      throw new Error('PHASE_B_V2_STOP_BINDING_INVALID');
    }
  } else if ([...latest.values()].some((attempt) => attempt.state !== 'COMPLETE')) {
    throw new Error('PHASE_B_V2_STOP_BINDING_INVALID');
  }
  return true;
}

function validateBaselineArtifact(manifest, artifact) {
  validateManifest(manifest);
  if (!object(artifact) || artifact.schema_version !== BASELINE_SCHEMA || artifact.protocol_version !== PROTOCOL_VERSION
    || artifact.manifest_id !== manifest.manifest_id || artifact.prompt_id !== BASELINE_PROMPT_ID
    || artifact.prompt_version !== BASELINE_PROMPT_VERSION
    || canonicalJson(artifact.provider_identity) !== canonicalJson(BASELINE_PROVIDER)
    || artifact.expected_call_count !== BLOCKED_SAMPLE_SIZE || !Array.isArray(artifact.attempts)
    || artifact.publication_authorisation !== 'NONE') throw new Error('PHASE_B_V2_BASELINE_ARTIFACT_INVALID');
  return validateAttemptHistory(manifest, artifact);
}

function completedBaselineByRow(artifact) {
  return new Map([...latestAttempts(artifact.attempts)]
    .filter(([, attempt]) => attempt.state === 'COMPLETE'));
}

function recoveredBaselineByRow(artifact) {
  return new Map([...completedBaselineByRow(artifact)]
    .filter(([, attempt]) => attempt.output.disposition === 'RESOLVED'));
}

function baseCrossVendorArtifact(manifest, baselineArtifactDigest, recoveredCount) {
  return {
    schema_version: CROSS_VENDOR_SCHEMA,
    protocol_version: PROTOCOL_VERSION,
    manifest_id: manifest.manifest_id,
    prompt_id: CROSS_VENDOR_PROMPT_ID,
    prompt_version: CROSS_VENDOR_PROMPT_VERSION,
    provider_identity: CROSS_VENDOR_PROVIDER,
    baseline_schema_version: BASELINE_SCHEMA,
    baseline_artifact_digest: baselineArtifactDigest,
    generation_command: 'node scripts/stage-2y-phase-b-v2-model-experiment.mjs --run-cross-vendor --resume',
    expected_call_count: recoveredCount,
    attempts: [],
    stopped: null,
    publication_authorisation: 'NONE',
  };
}

function validateCrossVendorArtifact(manifest, baseline, artifact, baselineArtifactDigest) {
  validateBaselineArtifact(manifest, baseline);
  const recovered = recoveredBaselineByRow(baseline);
  if (!object(artifact) || artifact.schema_version !== CROSS_VENDOR_SCHEMA || artifact.protocol_version !== PROTOCOL_VERSION
    || artifact.manifest_id !== manifest.manifest_id || artifact.prompt_id !== CROSS_VENDOR_PROMPT_ID
    || artifact.prompt_version !== CROSS_VENDOR_PROMPT_VERSION
    || canonicalJson(artifact.provider_identity) !== canonicalJson(CROSS_VENDOR_PROVIDER)
    || artifact.baseline_schema_version !== BASELINE_SCHEMA || artifact.baseline_artifact_digest !== baselineArtifactDigest
    || artifact.expected_call_count !== recovered.size || !Array.isArray(artifact.attempts)
    || artifact.publication_authorisation !== 'NONE') throw new Error('PHASE_B_V2_CROSS_VENDOR_ARTIFACT_INVALID');
  const attemptedRows = new Set(artifact.attempts.map((attempt) => attempt.row_id));
  if ([...attemptedRows].some((rowId) => !recovered.has(rowId))) throw new Error('PHASE_B_V2_CROSS_VENDOR_ROW_INVALID');
  return validateAttemptHistory(manifest, artifact, { crossVendor: true, baselineByRow: recovered });
}

function processCall(command, args, input) {
  return new Promise((resolveCall, reject) => {
    const env = { ...process.env };
    delete env.ANTHROPIC_API_KEY;
    delete env.OPENAI_API_KEY;
    const child = spawn(command, args, { cwd: ROOT, env, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`${command.toUpperCase()}_EXIT_${code}:${stderr.slice(0, 500)}`));
      return resolveCall(stdout);
    });
    child.stdin.end(input);
  });
}

function parseCodexJsonl(raw) {
  const events = raw.split(/\r?\n/).filter((line) => line.trim()).map((line) => JSON.parse(line));
  const thread = events.find((event) => event.type === 'thread.started');
  const answers = events.filter((event) => event.type === 'item.completed' && event.item?.type === 'agent_message');
  const completed = events.filter((event) => event.type === 'turn.completed');
  if (!nonempty(thread?.thread_id) || answers.length !== 1 || !nonempty(answers[0].item?.text)
    || completed.length !== 1 || events.at(-1) !== completed[0]) throw new Error('CODEX_JSONL_RECEIPT_INVALID');
  return { response_text: answers[0].item.text.trim(), provider_request_id: thread.thread_id, usage: completed[0].usage || null };
}

async function invokeBaseline(prompt) {
  const raw = await processCall('codex', BASELINE_PROVIDER.invocation_arguments, prompt);
  return { ...parseCodexJsonl(raw), provider_invocation_identity: BASELINE_INVOCATION_IDENTITY };
}

async function invokeCrossVendor(prompt) {
  const raw = await processCall('claude', CROSS_VENDOR_PROVIDER.invocation_arguments, prompt);
  const envelope = JSON.parse(raw);
  if (!nonempty(envelope.result) || !nonempty(envelope.session_id)) throw new Error('CLAUDE_JSON_RECEIPT_INVALID');
  return {
    response_text: envelope.result.trim(), provider_request_id: envelope.session_id,
    usage: envelope.usage || null, provider_invocation_identity: CROSS_VENDOR_INVOCATION_IDENTITY,
  };
}

function makeAttempt({ row, binding, priorAttempts, result, output, errors, startedAt, completedAt }) {
  const record = {
    row_id: row.row_id,
    attempt_index: priorAttempts + 1,
    request_binding_id: binding.request_binding_id,
    row_digest: binding.row_digest,
    prompt_id: binding.prompt_id,
    prompt_version: binding.prompt_version,
    prompt_digest: binding.prompt_digest,
    provider_identity_id: binding.provider_identity_id,
    provider_invocation_identity: result?.provider_invocation_identity || null,
    response_digest: result?.response_text ? hash(result.response_text) : null,
    response_text: result?.response_text || null,
    output: output || null,
    state: errors.length ? (result ? 'MALFORMED_OUTPUT' : 'CALL_FAILED') : 'COMPLETE',
    errors,
    provider_request_id: result?.provider_request_id || null,
    usage: result?.usage || null,
    started_at: startedAt,
    completed_at: completedAt,
  };
  return { ...record, call_id: hash(record) };
}

async function runAttempts({ manifest, artifact, rows, promptFor, bindingFor, validateOutput, invoke, outputPath, validateArtifact }) {
  if (artifact.stopped) artifact.stopped = null;
  const latest = latestAttempts(artifact.attempts);
  for (const row of rows) {
    if (latest.get(row.row_id)?.state === 'COMPLETE') continue;
    const priorAttempts = artifact.attempts.filter((attempt) => attempt.row_id === row.row_id).length;
    const prompt = promptFor(row);
    const binding = bindingFor(row);
    const startedAt = new Date().toISOString();
    let result = null;
    let output = null;
    let errors = [];
    try {
      result = await invoke(prompt, row);
      try { output = JSON.parse(result.response_text); } catch { errors.push('RESPONSE_JSON_INVALID'); }
      if (errors.length === 0) errors = validateOutput(row, output);
    } catch (error) {
      errors = [String(error?.message || error)];
    }
    const attempt = makeAttempt({
      row, binding, priorAttempts, result, output, errors,
      startedAt, completedAt: new Date().toISOString(),
    });
    artifact.attempts.push(attempt);
    latest.set(row.row_id, attempt);
    if (attempt.state !== 'COMPLETE') {
      artifact.stopped = { code: attempt.state, row_id: row.row_id, call_id: attempt.call_id, stopped_at: attempt.completed_at };
    }
    validateArtifact(artifact);
    writeAtomic(outputPath, artifact);
    if (artifact.stopped) break;
  }
  return artifact;
}

async function runBaseline({ resume, invoke = invokeBaseline } = {}) {
  const manifest = readAndValidateManifest();
  const outputExists = existsSync(resolve(ROOT, BASELINE_PATH));
  if (outputExists && !resume) throw new Error('PHASE_B_V2_BASELINE_EXISTS_USE_RESUME');
  const artifact = outputExists ? readJson(BASELINE_PATH) : baseBaselineArtifact(manifest);
  validateBaselineArtifact(manifest, artifact);
  if (artifact.stopped && !resume) throw new Error(`PHASE_B_V2_BASELINE_STOPPED:${artifact.stopped.code}`);
  return runAttempts({
    manifest,
    artifact,
    rows: manifest.rows,
    promptFor: baselinePrompt,
    bindingFor: baselineBinding,
    validateOutput: validateBaselineOutput,
    invoke,
    outputPath: BASELINE_PATH,
    validateArtifact: (value) => validateBaselineArtifact(manifest, value),
  });
}

async function runCrossVendor({ resume, invoke = invokeCrossVendor } = {}) {
  const manifest = readAndValidateManifest();
  const baseline = readJson(BASELINE_PATH);
  validateBaselineArtifact(manifest, baseline);
  const complete = completedBaselineByRow(baseline);
  if (baseline.stopped || complete.size !== BLOCKED_SAMPLE_SIZE) throw new Error('PHASE_B_V2_BASELINE_INCOMPLETE');
  const baselineArtifactDigest = fileHash(resolve(ROOT, BASELINE_PATH));
  const recovered = recoveredBaselineByRow(baseline);
  const outputExists = existsSync(resolve(ROOT, CROSS_VENDOR_PATH));
  if (outputExists && !resume) throw new Error('PHASE_B_V2_CROSS_VENDOR_EXISTS_USE_RESUME');
  const artifact = outputExists
    ? readJson(CROSS_VENDOR_PATH)
    : baseCrossVendorArtifact(manifest, baselineArtifactDigest, recovered.size);
  validateCrossVendorArtifact(manifest, baseline, artifact, baselineArtifactDigest);
  return runAttempts({
    manifest,
    artifact,
    rows: manifest.rows.filter((row) => recovered.has(row.row_id)),
    promptFor: (row) => crossVendorPrompt(row, recovered.get(row.row_id)),
    bindingFor: (row) => crossVendorBinding(row, recovered.get(row.row_id)),
    validateOutput: validateCrossVendorOutput,
    invoke,
    outputPath: CROSS_VENDOR_PATH,
    validateArtifact: (value) => validateCrossVendorArtifact(manifest, baseline, value, baselineArtifactDigest),
  });
}

function wilsonLowerBound(successes, n, z = 1.6448536269514722) {
  if (!Number.isInteger(n) || n <= 0 || !Number.isInteger(successes) || successes < 0 || successes > n) return null;
  const proportion = successes / n;
  const denominator = 1 + ((z * z) / n);
  const centre = proportion + ((z * z) / (2 * n));
  const margin = z * Math.sqrt(((proportion * (1 - proportion)) / n) + ((z * z) / (4 * n * n)));
  return (centre - margin) / denominator;
}

function buildReport({ manifest, baseline = null, crossVendor = null, baselineArtifactDigest = null, generatedAt = new Date().toISOString() }) {
  validateManifest(manifest);
  if (baseline) validateBaselineArtifact(manifest, baseline);
  if (crossVendor) {
    if (!baseline || !baselineArtifactDigest) throw new Error('PHASE_B_V2_REPORT_CROSS_VENDOR_WITHOUT_BASELINE');
    validateCrossVendorArtifact(manifest, baseline, crossVendor, baselineArtifactDigest);
  }
  const baselineLatest = baseline ? latestAttempts(baseline.attempts) : new Map();
  const baselineComplete = [...baselineLatest.values()].filter((attempt) => attempt.state === 'COMPLETE');
  const recovered = baselineComplete.filter((attempt) => attempt.output.disposition === 'RESOLVED');
  const crossLatest = crossVendor ? latestAttempts(crossVendor.attempts) : new Map();
  const crossComplete = [...crossLatest.values()].filter((attempt) => attempt.state === 'COMPLETE');
  const crossCorrect = crossComplete.filter((attempt) => attempt.output.classification === 'CORRECT').length;
  const baselineDone = baselineComplete.length === BLOCKED_SAMPLE_SIZE && !baseline?.stopped;
  const crossDone = baselineDone && recovered.length === crossComplete.length && !crossVendor?.stopped;
  const recoveryRate = baselineDone ? recovered.length / BLOCKED_SAMPLE_SIZE : null;
  const perFamily = [...new Set(manifest.rows.map((row) => row.family))].sort().map((family) => {
    const rows = manifest.rows.filter((row) => row.family === family);
    const attempts = rows.map((row) => baselineLatest.get(row.row_id)).filter(Boolean);
    return {
      family,
      selected: rows.length,
      baseline_complete: attempts.filter((attempt) => attempt.state === 'COMPLETE').length,
      resolved: attempts.filter((attempt) => attempt.output?.disposition === 'RESOLVED').length,
      open_world: attempts.filter((attempt) => attempt.output?.disposition === 'OPEN_WORLD').length,
      review: attempts.filter((attempt) => attempt.output?.disposition === 'REVIEW').length,
      failed_or_malformed: attempts.filter((attempt) => attempt.state !== 'COMPLETE').length,
      pending: rows.length - new Set(attempts.map((attempt) => attempt.row_id)).size,
    };
  });
  const gates = {
    terra_explicit_invocation_identity_receipts_complete: baselineDone
      ? baselineComplete.every((attempt) => canonicalJson(attempt.provider_invocation_identity) === canonicalJson(BASELINE_INVOCATION_IDENTITY)) : null,
    blocked_sample_complete: baselineDone,
    recovery_at_least_60_percent: recoveryRate === null ? null : recoveryRate >= GATE_THRESHOLDS.recovery_rate_minimum,
    every_recovered_cross_vendor_scored: recovered.length > 0 ? crossDone : null,
    recovered_human_adjudications_at_least_50: false,
    recovered_human_correctness_at_least_95_percent: null,
    cross_vendor_to_human_agreement_at_least_95_percent: null,
    party_attribution: 'UNMEASURED_PENDING_JUDGEABLE_RE_SIT',
    lead_tier_probe_complete_without_stop: null,
    publication_authorised: false,
  };
  const status = baseline?.stopped ? 'STOPPED_BASELINE'
    : !baselineDone ? 'INCOMPLETE_BASELINE'
      : crossVendor?.stopped ? 'STOPPED_CROSS_VENDOR'
        : !crossDone ? 'INCOMPLETE_CROSS_VENDOR'
          : 'PENDING_HUMAN_ADJUDICATION';
  return {
    schema_version: REPORT_SCHEMA,
    protocol_version: PROTOCOL_VERSION,
    generated_at: generatedAt,
    manifest_id: manifest.manifest_id,
    status,
    stop: baseline?.stopped || crossVendor?.stopped || null,
    measurement_scope: {
      resolved_label_meaning: 'MODEL_PROPOSED_GOVERNED_PLACEMENT',
      lawyer_visible_recovery_claimed: false,
      resolver_adapter_projection_validation: 'NOT_RUN_RESERVED_FOR_LATER_ADAPTER_GATE',
    },
    confidence_method: {
      method_id: 'WILSON_SCORE_ONE_SIDED_LOWER_BOUND/V1',
      confidence_level: 0.95,
      sidedness: 'ONE_SIDED_LOWER',
      z: 1.6448536269514722,
    },
    gate_thresholds: manifest.gate_thresholds,
    counts: {
      blocked_selected: BLOCKED_SAMPLE_SIZE,
      baseline_unique_attempted: baselineLatest.size,
      baseline_complete: baselineComplete.length,
      baseline_attempt_receipts: baseline?.attempts.length || 0,
      blocked_model_proposed_placements: recovered.length,
      cross_vendor_selected: recovered.length,
      cross_vendor_unique_attempted: crossLatest.size,
      cross_vendor_complete: crossComplete.length,
      cross_vendor_correct: crossCorrect,
    },
    recovery: {
      metric: 'MODEL_PROPOSED_GOVERNED_PLACEMENT_RATE',
      rate: recoveryRate,
      denominator: BLOCKED_SAMPLE_SIZE,
      lower_confidence_bound: baselineDone ? wilsonLowerBound(recovered.length, BLOCKED_SAMPLE_SIZE) : null,
      cross_vendor_correctness: crossComplete.length ? crossCorrect / crossComplete.length : null,
      cross_vendor_correctness_lower_confidence_bound: wilsonLowerBound(crossCorrect, crossComplete.length),
    },
    per_family: perFamily,
    gates,
    publication_authorisation: 'NONE',
  };
}

function markdownReport(reportValue) {
  const percent = (value) => value === null ? 'not measured' : `${(value * 100).toFixed(1)}%`;
  return `# Stage 2Y Phase B V2 model experiment\n\nStatus: **${reportValue.status}**. Publication authority: **NONE**.\n\n- Blocked rows selected: ${reportValue.counts.blocked_selected}\n- Baseline rows complete: ${reportValue.counts.baseline_complete}\n- Proposed placements: ${reportValue.counts.blocked_model_proposed_placements}/${reportValue.recovery.denominator} (${percent(reportValue.recovery.rate)})\n- Cross-vendor scores complete: ${reportValue.counts.cross_vendor_complete}/${reportValue.counts.cross_vendor_selected}\n\nA RESOLVED result means a model-proposed governed placement. It does not mean resolver acceptance or a lawyer-visible row.\n`;
}

function prepare() {
  const sourceManifest = readJson(V1_MANIFEST_PATH);
  const sourceManifestDigest = fileHash(resolve(ROOT, V1_MANIFEST_PATH));
  const manifest = buildManifest({ sourceManifest, sourceManifestDigest });
  writeAtomic(MANIFEST_PATH, manifest);
  return manifest;
}

function report() {
  const manifest = readAndValidateManifest();
  const baselinePresent = existsSync(resolve(ROOT, BASELINE_PATH));
  const crossPresent = existsSync(resolve(ROOT, CROSS_VENDOR_PATH));
  const baseline = baselinePresent ? readJson(BASELINE_PATH) : null;
  const baselineArtifactDigest = baselinePresent ? fileHash(resolve(ROOT, BASELINE_PATH)) : null;
  const crossVendor = crossPresent ? readJson(CROSS_VENDOR_PATH) : null;
  const value = buildReport({ manifest, baseline, crossVendor, baselineArtifactDigest });
  writeAtomic(REPORT_PATH, value);
  writeFileSync(resolve(ROOT, REPORT_MD_PATH), markdownReport(value));
  return value;
}

function parseArgs(argv) {
  const modes = argv.filter((arg) => ['--prepare', '--run-baseline', '--run-cross-vendor', '--report'].includes(arg));
  if (modes.length !== 1 || argv.some((arg) => ![...modes, '--resume'].includes(arg))
    || (argv.includes('--resume') && !['--run-baseline', '--run-cross-vendor'].includes(modes[0]))) {
    throw new Error('USAGE: --prepare | --run-baseline [--resume] | --run-cross-vendor [--resume] | --report');
  }
  return { mode: modes[0], resume: argv.includes('--resume') };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let value;
  if (args.mode === '--prepare') value = prepare();
  if (args.mode === '--run-baseline') value = await runBaseline(args);
  if (args.mode === '--run-cross-vendor') value = await runCrossVendor(args);
  if (args.mode === '--report') value = report();
  process.stdout.write(`${args.mode} complete: ${value.manifest_id || value.status || value.attempts?.length || 0}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.stack || error}\n`);
    process.exitCode = 1;
  });
}

export {
  BASELINE_INVOCATION_IDENTITY,
  BASELINE_PROMPT_ID,
  BASELINE_PROMPT_VERSION,
  BASELINE_PROVIDER,
  CROSS_VENDOR_INVOCATION_IDENTITY,
  CROSS_VENDOR_PROMPT_ID,
  CROSS_VENDOR_PROMPT_VERSION,
  CROSS_VENDOR_PROVIDER,
  EXPECTED_V1_BLOCKED_ROW_ORDER_ROOT,
  EXPECTED_V1_BLOCKED_ROW_SET_ROOT,
  EXPECTED_V1_MANIFEST_DIGEST,
  EXPECTED_V1_MANIFEST_ID,
  MANIFEST_SCHEMA,
  PROTOCOL_VERSION,
  baselineBinding,
  baselinePrompt,
  baseBaselineArtifact,
  baseCrossVendorArtifact,
  buildManifest,
  buildReport,
  crossVendorBinding,
  crossVendorPrompt,
  parseArgs,
  validPartyShape,
  validateBaselineArtifact,
  validateBaselineOutput,
  validateCrossVendorArtifact,
  validateCrossVendorOutput,
  validateManifest,
  wilsonLowerBound,
};
