#!/usr/bin/env node

import {
  existsSync, readdirSync, readFileSync, writeFileSync,
} from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_JSON = 'evidence/canonical-v2/stage-2y-corroboration-ladder.json';
const OUTPUT_MD = 'evidence/canonical-v2/stage-2y-corroboration-ladder.md';
const REPORT_SCHEMA = 'STAGE_2Y_CORROBORATION_LADDER_REPORT/V1';
const MODE = 'INERT_REPLAY_ONLY';

const { canonicalJson, sha256Hex, utf8Slice } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContractV42 } = require('../lib/canonical-v2/contract-bundle');
const { createReplayClient, replayCoverage, resolveOriginalProviderIdentity } = require('../lib/canonical-v2/native-producer/provider-record-replay');
const { createAnthropicProvider } = require('../lib/canonical-v2/native-producer/anthropic-provider');
const { runNativeExtraction } = require('../lib/canonical-v2/native-producer/native-extraction-run');
const { resolveCandidates } = require('../lib/canonical-v2/native-producer/candidate-resolution');
const { assessCorroborationLadder, criterionIdentity, PUBLICATION_DISPOSITION, ANCHOR_STEM_DECLARATION_DIGEST } = require('../lib/canonical-v2/native-producer/corroboration-ladder');

const { isFinalCorpusRun } = await import('./canonical-v2-corpus-review-artifact.mjs');
const liveRunner = await import('./canonical-v2-live-extraction-run.mjs');

const FAMILIES = Object.freeze(['GENERAL_COVENANTS', 'MATERIAL_CONTRACTS', 'INTERIM_OPERATING']);
const DERIVATIONS = Object.freeze(['MATCH', 'EMPTY', 'AMBIGUOUS', 'POSITIVE_CONTRADICTION', 'INAPPLICABLE']);
const PROPOSED_RESOLUTIONS = Object.freeze(['RESOLVED', 'MODEL_DEFERRED', 'WITHHELD']);
const MODIV_IOC_R3_EXCEPTION = 'modiv-interim-operating-20260809-2xk-r3';
const EXPECTED_SELECTED_RUN_COUNT = 21;

const CORROBORATION_REASONS = Object.freeze({
  GENERAL_COVENANTS: 'GENERAL_COVENANT_CODE_UNCORROBORATED',
  MATERIAL_CONTRACTS: 'MATERIAL_CONTRACT_BUCKET_UNCORROBORATED',
  INTERIM_OPERATING: 'CATEGORY_UNCORROBORATED',
});
const REGISTER_COUNTS = Object.freeze({ GENERAL_COVENANTS: 24, MATERIAL_CONTRACTS: 66, INTERIM_OPERATING: 73 });

function fail(code, message) {
  throw new Error(`${code}: ${message}`);
}

function readJson(path) {
  if (!existsSync(path)) fail('INPUT_REJECTED', `missing required input ${relative(ROOT, path)}`);
  return JSON.parse(readFileSync(path, 'utf8'));
}

function selectOfficialRuns(runRecords) {
  const selected = runRecords.filter(({ run_name: runName, family }) => FAMILIES.includes(family)
    && (isFinalCorpusRun(runName) || runName === MODIV_IOC_R3_EXCEPTION));
  const selectedByDealFamily = new Map();
  for (const record of selected) {
    const key = `${record.deal_key}\u0000${record.family}`;
    if (selectedByDealFamily.has(key)) {
      fail('INPUT_REJECTED', `duplicate selected deal/family ${record.deal_key}/${record.family}: ${selectedByDealFamily.get(key).run_name}, ${record.run_name}`);
    }
    selectedByDealFamily.set(key, record);
  }
  return [...selectedByDealFamily.values()]
    .sort((left, right) => left.family.localeCompare(right.family) || left.deal_key.localeCompare(right.deal_key) || left.run_name.localeCompare(right.run_name));
}

function deriveSelectedRuns({ repoRoot = ROOT } = {}) {
  const evidenceRoot = resolve(repoRoot, 'evidence/canonical-v2');
  const runRecords = readdirSync(evidenceRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((runName) => isFinalCorpusRun(runName) || runName === MODIV_IOC_R3_EXCEPTION)
    .map((runName) => {
      const manifest = readJson(resolve(evidenceRoot, runName, 'run-manifest.json'));
      return { run_name: runName, family: manifest.section_family, deal_key: manifest.deal };
    });
  const selected = selectOfficialRuns(runRecords);
  if (selected.length !== EXPECTED_SELECTED_RUN_COUNT) {
    fail('INPUT_REJECTED', `selected ${selected.length} official corroboration runs, expected ${EXPECTED_SELECTED_RUN_COUNT}`);
  }
  return selected.map(({ family, run_name: runName }) => Object.freeze([family, runName]));
}

const SELECTED_RUNS = Object.freeze(deriveSelectedRuns());

function digestFile(path) {
  if (!existsSync(path)) fail('INPUT_REJECTED', `missing required input ${relative(ROOT, path)}`);
  return sha256Hex(readFileSync(path));
}

function candidateId(entry) {
  const id = entry?.candidate?.claim?.claim_occurrence_id;
  if (typeof id !== 'string' || id.length === 0) fail('INPUT_REJECTED', 'compiled candidate has no exact claim_occurrence_id');
  return id;
}

function sameIds(left, right) {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

function replayInput({ family, runName, manifest, sourceReference, recording, oldReceipt }) {
  if (manifest.section_family !== family || sourceReference.deal !== manifest.deal) {
    fail('INPUT_REJECTED', `${runName} family/deal does not agree across manifest and source reference`);
  }
  if (recording.schema_version !== 'NATIVE_PRODUCER_RECORDED_RUN/V3'
    || !Array.isArray(recording.calls) || recording.calls.length === 0
    || recording.call_count !== recording.calls.length) {
    fail('INPUT_REJECTED', `${runName} recording is missing, unsealed, or malformed`);
  }
  for (const call of recording.calls) {
    if (typeof call?.request_key !== 'string' || !Array.isArray(call.request_messages)
      || !Array.isArray(call.request_system) || typeof call.raw_response_text !== 'string') {
      fail('INPUT_REJECTED', `${runName} recording is not a sealed V3 request/response recording`);
    }
  }
  if (oldReceipt.document_hash !== sourceReference.document_hash
    || oldReceipt.source_sha256 !== sourceReference.canonical_text_sha256
    || manifest.document_hash !== sourceReference.document_hash
    || manifest.source_sha256 !== sourceReference.canonical_text_sha256) {
    fail('INPUT_REJECTED', `${runName} source digest does not agree across immutable inputs`);
  }
}

function promptSectionReference(prompt, source) {
  const messages = prompt?.messages;
  if (!Array.isArray(messages) || messages.length !== 1
    || messages[0]?.role !== 'user' || typeof messages[0]?.content !== 'string') {
    fail('INPUT_REJECTED', `${source} does not contain one sealed user prompt`);
  }
  const match = /^GOVERNED SECTION REFERENCE: ([^\n]+)\n\n/.exec(messages[0].content);
  if (!match) fail('INPUT_REJECTED', `${source} has no governed section reference`);
  return match[1];
}

// A replay re-executes current compilation and resolution against the recorded
// provider response. It must use the sealed historical request to retrieve
// that response. Current prompt text can change independently and must never
// turn an otherwise complete recording into a model-call miss.
function createRecordedPromptTransformer({ recording, oldReceipt, runName }) {
  const expectedReferences = new Set((oldReceipt.resolved_sections || []).map((section) => section.section_reference));
  if (expectedReferences.size === 0) fail('INPUT_REJECTED', `${runName} receipt has no resolved sections`);
  const recordedByReference = new Map();
  for (const [index, call] of (recording.calls || []).entries()) {
    const sectionReference = promptSectionReference({ messages: call.request_messages }, `${runName} recording call ${index + 1}`);
    if (!expectedReferences.has(sectionReference) || recordedByReference.has(sectionReference)) {
      fail('INPUT_REJECTED', `${runName} recording does not map one prompt to each committed section`);
    }
    recordedByReference.set(sectionReference, call);
  }
  if (recordedByReference.size !== expectedReferences.size) {
    fail('INPUT_REJECTED', `${runName} recording does not cover every committed section`);
  }
  return (currentPrompt) => {
    const sectionReference = promptSectionReference(currentPrompt, `${runName} current prompt`);
    const recorded = recordedByReference.get(sectionReference);
    if (!recorded) fail('INPUT_REJECTED', `${runName} current prompt has no sealed recording`);
    return Object.freeze({
      ...currentPrompt,
      system: recorded.request_system,
      messages: recorded.request_messages,
    });
  };
}

function runControlMap(resolution, receipt) {
  const controls = new Map();
  const sourceClaims = (receipt.compiled_candidates || []).filter((entry) => entry?.candidate?.claim);
  for (const row of resolution.resolved || []) {
    let id = row.original_claim_occurrence_id;
    if (typeof id !== 'string' || !id) {
      const raw = row.compiled_candidate?.candidate?.claim?.raw_value;
      const resolvedAttrs = row.claim?.attributes || row.compiled_candidate?.candidate?.claim?.attributes || {};
      const matches = sourceClaims.filter((entry) => entry.section_reference === row.section_reference
        && entry.candidate.claim.raw_value === raw
        && entry.candidate.claim.claim_definition_key === row.generic_claim_key
        && Object.entries(entry.candidate.claim.attributes || {}).every(([key, value]) => JSON.stringify(resolvedAttrs[key]) === JSON.stringify(value)));
      if (matches.length !== 1) fail('INPUT_REJECTED', 'resolved control has no exact original claim identity');
      id = candidateId(matches[0]);
    }
    controls.set(id, { state: 'RESOLVED', reason: null, resolution_receipt_id: resolution.resolution_receipt?.resolution_receipt_id || null });
  }
  for (const row of resolution.review_queue || []) {
    // This array records every attempted candidate. Rows with a resolution
    // are audit copies of resolved rows, not current REVIEW controls.
    if (row.has_resolution !== false) continue;
    let id = row.original_claim_occurrence_id;
    if (typeof id !== 'string' || !id) {
      const closureMatches = sourceClaims.filter((entry) => entry.candidate.claim.closure_id === row.closure_id);
      const phrase = row.raw_value || row.normalised_phrase;
      const phraseMatches = sourceClaims.filter((entry) => entry.candidate.claim.raw_value === phrase
        && (!row.generic_claim_key || entry.candidate.claim.claim_definition_key === row.generic_claim_key));
      const matched = closureMatches.length === 1 ? closureMatches : phraseMatches;
      if (matched.length === 1) id = candidateId(matched[0]);
    }
    if (typeof id !== 'string' || !id) {
      if ((row.reasons || []).some((reason) => Object.values(CORROBORATION_REASONS).includes(reason))) {
        fail('INPUT_REJECTED', 'specific corroboration control has no exact original claim identity');
      }
      continue;
    }
    controls.set(id, {
      state: 'REVIEW',
      reason: Array.isArray(row.reasons) && row.reasons.length === 1 ? row.reasons[0] : (row.reasons || []).join('|') || null,
      resolution_receipt_id: resolution.resolution_receipt?.resolution_receipt_id || null,
    });
  }
  return controls;
}

function familyShapeValid(family, entry) {
  const claim = entry?.candidate?.claim;
  if (entry?.section_family !== family || entry?.candidate?.kind !== 'claim' || !claim) return false;
  if (family === 'GENERAL_COVENANTS') return /^NATIVE_GENERAL_COVENANT_/.test(claim.claim_definition_key || '');
  if (family === 'MATERIAL_CONTRACTS') return claim.claim_definition_key === 'NATIVE_MATERIAL_CONTRACT_BUCKET_CANDIDATE'
    || claim.claim_definition_key === 'NATIVE_MATERIAL_CONTRACT_THRESHOLD_CANDIDATE';
  return claim.claim_definition_key === 'NATIVE_IOC_RESTRICTION_CANDIDATE';
}

function verifiedEvidence({ sourceText, entry, receipt, canonicalTextId }) {
  const claim = entry.candidate.claim;
  const evidence = claim.evidence;
  if (!Array.isArray(evidence) || evidence.length !== 1) fail('INPUT_REJECTED', `${candidateId(entry)} does not have one exact evidence edge`);
  const span = evidence[0];
  const section = (receipt.resolved_sections || []).find((item) => item.section_reference === entry.section_reference);
  if (!section || !Number.isInteger(section.start)) fail('INPUT_REJECTED', `${candidateId(entry)} has no resolved source section`);
  // Candidate proposal evidence is section-relative. The report always uses
  // canonical-document byte coordinates and verifies the translated span.
  const absoluteStart = section.start + span.absolute_start;
  const absoluteEnd = section.start + span.absolute_end;
  let quote;
  try { quote = utf8Slice(sourceText, absoluteStart, absoluteEnd); } catch (error) {
    fail('INPUT_REJECTED', `${candidateId(entry)} has invalid UTF-8 byte evidence: ${error.message}`);
  }
  if (quote !== claim.raw_value) fail('INPUT_REJECTED', `${candidateId(entry)} byte evidence does not reproduce its exact quote`);
  const textSha = sha256Hex(quote);
  return {
    source_text: sourceText,
    spans: [{ absolute_start: absoluteStart, absolute_end: absoluteEnd, text_sha256: textSha }],
    report: [{ canonical_text_id: canonicalTextId, absolute_start: absoluteStart, absolute_end: absoluteEnd, text_sha256: textSha }],
  };
}

function nonCorroborationGates({ family, entry, evidence }) {
  const claim = entry.candidate.claim;
  const attrs = claim.attributes || {};
  const structural = familyShapeValid(family, entry)
    && entry.ok === true && entry.citation_validation?.accepted === true
    && (family === 'INTERIM_OPERATING'
      || (Array.isArray(attrs.definition_cross_references) && attrs.definition_cross_references.length === 0));
  const enumPassed = family === 'GENERAL_COVENANTS'
    ? typeof attrs.covenant_code === 'string' && typeof attrs.owner_id === 'string' && attrs.owner_id.length > 0
    : family === 'MATERIAL_CONTRACTS'
      ? typeof attrs.bucket_code === 'string'
      : attrs.assertion_kind === 'RESTRICTION_PRESENT' && typeof attrs.restriction_category === 'string';
  return { structural_passed: structural, enum_passed: enumPassed, evidence_passed: evidence != null };
}

async function replayReceipt({ family, runName, manifest, sourceReference, recording, oldReceipt }) {
  const dealPin = liveRunner.DEAL_PINS[manifest.deal];
  if (!dealPin) fail('INPUT_REJECTED', `${runName} deal has no current pinned source`);
  const verified = liveRunner.loadAndVerifySource({ dealPin, deal: manifest.deal, rawHtmlPath: sourceReference.reused_committed_raw_html });
  if (verified.conversion.canonical_text_sha256 !== sourceReference.canonical_text_sha256) {
    fail('INPUT_REJECTED', `${runName} canonical source digest changed`);
  }
  const sourceMap = sourceReference.admitted_source_capture_inputs;
  if (!sourceMap?.source_map_payload_path || !sourceMap.source_map_compressed_sha256) {
    fail('INPUT_REJECTED', `${runName} has no sealed source-map recording`);
  }
  const payloadPath = resolve(ROOT, sourceMap.source_map_payload_path);
  const adopted = liveRunner.adoptStoredSourceMapPayload({ verified, payloadBytes: readFileSync(payloadPath) });
  if (adopted.sourceMapCompressedSha256 !== sourceMap.source_map_compressed_sha256) {
    fail('INPUT_REJECTED', `${runName} source-map recording digest changed`);
  }
  const { admittedSourceContext } = liveRunner.buildAdmittedContext({
    deal: manifest.deal, family, dealPin, verified: adopted.verified,
    locallyValidatedConversion: verified.conversion,
    recordedSourceMapProvenance: {
      source_map_payload_path: sourceMap.source_map_payload_path,
      source_map_compressed_sha256: sourceMap.source_map_compressed_sha256,
    },
  });
  if (admittedSourceContext.document_hash !== oldReceipt.document_hash) fail('INPUT_REJECTED', `${runName} admitted source identity changed`);

  const identity = resolveOriginalProviderIdentity({ recording, runReceipt: oldReceipt, source: runName });
  const replay = createReplayClient({ recording });
  const transformPrompt = createRecordedPromptTransformer({ recording, oldReceipt, runName });
  const provider = createAnthropicProvider({
    providerId: identity.provider_id,
    model: identity.model_id,
    client: replay,
    maxRetries: 0,
    maxOutputTokens: null,
    includeRawResponse: true,
    transformPrompt,
  });
  const sectionReferences = manifest.section_references;
  const receipt = await runNativeExtraction({
    source_text: adopted.verified.conversion.canonical_text,
    document_hash: admittedSourceContext.document_hash,
    section_references: sectionReferences,
    section_family_assignments: sectionReferences.map((section_reference) => ({ section_reference, family_id: family })),
    contract_bundle: compileFixtureContractV42(),
    definitions: { known_definitions: [] },
    provider,
  });
  const coverage = replayCoverage({ recording, served: replay.served });
  if (!coverage.complete) fail('INPUT_REJECTED', `${runName} recording replay is incomplete or exhausted`);
  const oldIds = (oldReceipt.compiled_candidates || []).map(candidateId).sort();
  const newIds = (receipt.compiled_candidates || []).map(candidateId).sort();
  if (!sameIds(oldIds, newIds)) fail('INPUT_REJECTED', `${runName} replayed candidates do not have the exact committed identities`);
  const oldPrompt = new Map((oldReceipt.resolved_sections || []).map((section) => [section.section_reference, section.prompt_digest]));
  for (const section of receipt.resolved_sections || []) {
    if (oldPrompt.get(section.section_reference) !== section.prompt_digest) fail('INPUT_REJECTED', `${runName} source or prompt digest changed for ${section.section_reference}`);
  }
  // The resolver rebuilds claims in-place as part of its normal output path.
  // Keep the replayed receipt immutable as the experimental candidate source.
  const resolution = resolveCandidates({
    run_receipt: JSON.parse(JSON.stringify(receipt)),
    contract_vocabulary: compileFixtureContractV42(),
    admitted_source_context: admittedSourceContext,
    agreement_date: manifest.agreement_date,
  });
  return { receipt, resolution, sourceText: adopted.verified.conversion.canonical_text, coverage, admittedSourceContext };
}

function mergeMaterial(rows) {
  const units = new Map();
  for (const row of rows) {
    const identity = criterionIdentity({ deal_key: row.deal_key, section_reference: row.section_reference, candidate: row.entry.candidate });
    const current = units.get(identity) || {
      ...row, criterion_identity: identity, source_candidates: [], source_candidate_row_count: 0,
    };
    const sourceCandidate = {
      compiled_candidate_id: candidateId(row.entry),
      claim_kind: row.entry.candidate.claim.claim_definition_key,
      current_resolution: row.control,
    };
    if (!current.source_candidates.some((candidate) => candidate.compiled_candidate_id === sourceCandidate.compiled_candidate_id)) {
      current.source_candidates.push(sourceCandidate);
    }
    current.source_candidate_row_count += 1;
    if (row.entry.candidate.claim.claim_definition_key === 'NATIVE_MATERIAL_CONTRACT_BUCKET_CANDIDATE') {
      current.entry = row.entry;
      current.evidence = row.evidence;
      current.control = row.control;
    }
    units.set(identity, current);
  }
  return [...units.values()];
}

function mergeExactCriteria(rows) {
  const units = new Map();
  for (const row of rows) {
    const sourceId = candidateId(row.entry);
    const identity = `sha256:${sha256Hex(canonicalJson([row.deal_key, sourceId]))}`;
    const sourceCandidate = {
      compiled_candidate_id: sourceId,
      claim_kind: row.entry.candidate.claim.claim_definition_key,
      current_resolution: row.control,
    };
    const comparison = canonicalJson({
      family: row.family,
      run_name: row.run_name,
      deal_key: row.deal_key,
      section_reference: row.section_reference,
      entry: row.entry,
      control: row.control,
      evidence: row.evidence.report,
      gates: row.gates,
    });
    const current = units.get(identity);
    if (!current) {
      units.set(identity, {
        ...row,
        criterion_identity: identity,
        source_candidates: [sourceCandidate],
        source_candidate_row_count: 1,
        comparison,
      });
      continue;
    }
    if (current.comparison !== comparison) {
      fail('INPUT_REJECTED', `duplicate criterion ${identity} has conflicting source rows`);
    }
    current.source_candidate_row_count += 1;
  }
  return [...units.values()].map(({ comparison, ...unit }) => unit);
}

function assessRows({ family, runName, deal, sourceText, admittedSourceContext, receipt, resolution }) {
  const controls = runControlMap(resolution, receipt);
  const selected = [];
  for (const entry of receipt.compiled_candidates || []) {
    if (!familyShapeValid(family, entry)) continue;
    const id = candidateId(entry);
    const control = controls.get(id);
    if (!control) continue;
    if (control.state !== 'RESOLVED' && control.reason !== CORROBORATION_REASONS[family]) continue;
    const evidence = verifiedEvidence({ sourceText, entry, receipt, canonicalTextId: admittedSourceContext.canonical_text_id });
    const gates = nonCorroborationGates({ family, entry, evidence });
    if (!Object.values(gates).every(Boolean)) continue;
    selected.push({ family, run_name: runName, deal_key: admittedSourceContext.governed_deal_key, section_reference: entry.section_reference, entry, control, evidence, gates });
  }
  const units = family === 'MATERIAL_CONTRACTS' ? mergeMaterial(selected) : mergeExactCriteria(selected);
  return { candidate_rows: selected.length, units };
}

function reportAssessment(unit) {
  const claim = unit.entry.candidate.claim;
  const candidate = { ...unit.entry.candidate, non_corroboration_gates: unit.gates };
  const ladder = assessCorroborationLadder({ family: unit.family, candidate, verified_evidence: unit.evidence });
  return {
    family: unit.family,
    deal_key: unit.deal_key,
    run_name: unit.run_name,
    compiled_candidate_id: candidateId(unit.entry),
    criterion_identity: unit.criterion_identity,
    source_candidate_row_count: unit.source_candidate_row_count,
    source_claim_ids: unit.source_candidates.map((row) => row.compiled_candidate_id).sort(),
    source_candidates: unit.source_candidates.sort((left, right) => left.compiled_candidate_id.localeCompare(right.compiled_candidate_id)),
    claim_kind: claim.claim_definition_key,
    asserted_code: ladder.asserted_code,
    current_resolution: unit.control,
    verified_evidence: unit.evidence.report,
    non_corroboration_gates: unit.gates,
    rungs: ladder.rungs,
    publication_disposition: PUBLICATION_DISPOSITION,
  };
}

function partition(values, vocabulary, field) {
  const counts = Object.fromEntries(vocabulary.map((value) => [value, 0]));
  for (const value of values) {
    if (!Object.hasOwn(counts, value[field])) fail('INPUT_REJECTED', `unknown ${field} ${value[field]}`);
    counts[value[field]] += 1;
  }
  return counts;
}

function assertPartition({ family, rung, label, counts, distinctCriteria }) {
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  if (total !== distinctCriteria) {
    fail('INPUT_REJECTED', `${family} rung ${rung} ${label} partition is ${total}, expected ${distinctCriteria}`);
  }
}

function curves(assessments, candidateCounts) {
  return FAMILIES.flatMap((family) => {
    const rows = assessments.filter((assessment) => assessment.family === family);
    const distinctCriteria = new Set(rows.map((item) => item.criterion_identity)).size;
    let previousDeferred = new Set();
    return [0, 1, 2, 3, 4].map((rung) => {
      const results = rows.map((assessment) => ({ criterion_identity: assessment.criterion_identity, ...assessment.rungs[rung] }));
      const derivations = partition(results, DERIVATIONS, 'derivation');
      const proposedResolutions = partition(results, PROPOSED_RESOLUTIONS, 'proposed_resolution');
      assertPartition({ family, rung, label: 'derivation', counts: derivations, distinctCriteria });
      assertPartition({ family, rung, label: 'proposed-resolution', counts: proposedResolutions, distinctCriteria });
      const deferred = new Set(results.filter((result) => result.proposed_resolution === 'MODEL_DEFERRED').map((result) => result.criterion_identity));
      const marginalModelDeferred = [...deferred].filter((identity) => !previousDeferred.has(identity)).length;
      const curve = {
        family, rung,
        denominator: { candidate_rows: candidateCounts[family] || 0, distinct_criteria: distinctCriteria },
        derivations,
        proposed_resolutions: proposedResolutions,
        total_model_deferred: deferred.size,
        marginal_model_deferred: marginalModelDeferred,
        publication_disposition: PUBLICATION_DISPOSITION,
      };
      previousDeferred = deferred;
      return curve;
    });
  });
}

function renderMarkdown(report) {
  const lines = [
    '# Stage 2Y corroboration ladder',
    '',
    'Mode: `INERT_REPLAY_ONLY`. No adjudication or rung selection occurred. Every assessment is withheld. Model deferred is an assessment only.',
    '',
    '| Family | Selected candidate rows | Distinct criteria | Register rows | Difference |',
    '| --- | ---: | ---: | ---: | ---: |',
  ];
  for (const family of ['GENERAL_COVENANTS', 'MATERIAL_CONTRACTS', 'INTERIM_OPERATING']) {
    const row = report.denominators.find((item) => item.family === family);
    lines.push(`| ${family} | ${row.candidate_rows} | ${row.distinct_criteria} | ${row.register_rows} | ${row.difference_from_register} |`);
  }
  lines.push('', '## Five-rung curves', '');
  for (const family of FAMILIES) {
    lines.push(`### ${family}`, '', '| Rung | MATCH | EMPTY | AMBIGUOUS | POSITIVE_CONTRADICTION | INAPPLICABLE | RESOLVED | MODEL_DEFERRED | WITHHELD | Total deferred | Marginal deferred |', '| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
    for (const curve of report.curves.filter((item) => item.family === family)) {
      lines.push(`| ${curve.rung} | ${curve.derivations.MATCH} | ${curve.derivations.EMPTY} | ${curve.derivations.AMBIGUOUS} | ${curve.derivations.POSITIVE_CONTRADICTION} | ${curve.derivations.INAPPLICABLE} | ${curve.proposed_resolutions.RESOLVED} | ${curve.proposed_resolutions.MODEL_DEFERRED} | ${curve.proposed_resolutions.WITHHELD} | ${curve.total_model_deferred} | ${curve.marginal_model_deferred} |`);
    }
    lines.push('');
  }
  lines.push('', `Selected runs: ${report.runs.length}. Model calls: ${report.publication.model_calls}. Writes: ${report.publication.writes_performed}. Serving activated: ${report.publication.serving_activated}.`);
  return `${lines.join('\n')}\n`;
}

async function buildReport({ repoRoot = ROOT } = {}) {
  const assessments = [];
  const runs = [];
  const candidateCounts = {};
  for (const [family, runName] of SELECTED_RUNS) {
    const runDir = resolve(repoRoot, 'evidence/canonical-v2', runName);
    const manifestPath = resolve(runDir, 'run-manifest.json');
    const sourcePath = resolve(runDir, 'source-reference.json');
    const recordingPath = resolve(runDir, 'recording.json');
    const receiptPath = resolve(runDir, 'run-receipt.json');
    const manifest = readJson(manifestPath);
    const sourceReference = readJson(sourcePath);
    const recording = readJson(recordingPath);
    const oldReceipt = readJson(receiptPath);
    const finalByHelper = isFinalCorpusRun(runName);
    const designatedR3Final = runName === 'modiv-interim-operating-20260809-2xk-r3';
    if (!finalByHelper && !designatedR3Final) fail('INPUT_REJECTED', `${runName} is not an official final corpus run`);
    replayInput({ family, runName, manifest, sourceReference, recording, oldReceipt });
    const replayed = await replayReceipt({ family, runName, manifest, sourceReference, recording, oldReceipt });
    const selected = assessRows({ family, runName, deal: manifest.deal, ...replayed });
    candidateCounts[family] = (candidateCounts[family] || 0) + selected.candidate_rows;
    assessments.push(...selected.units.map(reportAssessment));
    runs.push({
      run_name: runName, family, deal_key: manifest.deal, official_final_by_isFinalCorpusRun: finalByHelper,
      official_final_exception: designatedR3Final ? 'DESIGNATED_FINAL_R3_IN_APPROVED_SLICE_DESIGN' : null,
      replay_coverage: replayed.coverage,
      input_digests: {
        source_reference: digestFile(sourcePath), run_manifest: digestFile(manifestPath), recording: digestFile(recordingPath), run_receipt: digestFile(receiptPath),
        source_document: sha256Hex(replayed.sourceText),
        prompt_digests: Object.fromEntries((replayed.receipt.resolved_sections || []).map((section) => [section.section_reference, section.prompt_digest])),
      },
    });
  }
  assessments.sort((left, right) => left.family.localeCompare(right.family) || left.run_name.localeCompare(right.run_name) || left.compiled_candidate_id.localeCompare(right.compiled_candidate_id));
  const denominators = ['GENERAL_COVENANTS', 'MATERIAL_CONTRACTS', 'INTERIM_OPERATING'].map((family) => {
    const distinct = new Set(assessments.filter((assessment) => assessment.family === family).map((assessment) => assessment.criterion_identity)).size;
    const rows = candidateCounts[family] || 0;
    return { family, candidate_rows: rows, distinct_criteria: distinct, register_rows: REGISTER_COUNTS[family], difference_from_register: rows - REGISTER_COUNTS[family] };
  });
  const report = {
    schema_version: REPORT_SCHEMA,
    mode: MODE,
    publication: { publication_disposition: PUBLICATION_DISPOSITION, writes_performed: false, serving_activated: false, model_calls: 0 },
    inputs: {
      resolver_digest: digestFile(resolve(repoRoot, 'lib/canonical-v2/native-producer/candidate-resolution.js')),
      ladder_module_digest: digestFile(resolve(repoRoot, 'lib/canonical-v2/native-producer/corroboration-ladder.js')),
      adapter_module_digest: digestFile(resolve(repoRoot, 'lib/canonical-v2/native-producer/anthropic-provider.js')),
      ladder_declaration_digest: ANCHOR_STEM_DECLARATION_DIGEST,
    },
    runs,
    denominators,
    assessments,
    curves: curves(assessments, candidateCounts),
  };
  if (JSON.stringify(report).includes('"ELIGIBLE"') || JSON.stringify(report).includes('"PUBLISHED"')) fail('INPUT_REJECTED', 'inert report contains a publication state');
  return report;
}

function parseArgs(args) {
  if (args.length !== 1 || !['--write', '--check'].includes(args[0])) fail('USAGE', 'use exactly one of --write or --check');
  return args[0];
}

async function main(args = process.argv.slice(2)) {
  const mode = parseArgs(args);
  const report = await buildReport();
  const json = `${JSON.stringify(report, null, 2)}\n`;
  const markdown = renderMarkdown(report);
  const jsonPath = resolve(ROOT, OUTPUT_JSON);
  const markdownPath = resolve(ROOT, OUTPUT_MD);
  if (mode === '--check') {
    if (!existsSync(jsonPath) || !existsSync(markdownPath) || readFileSync(jsonPath, 'utf8') !== json || readFileSync(markdownPath, 'utf8') !== markdown) {
      fail('CHECK_FAILED', 'generated Stage 2Y corroboration ladder evidence is stale or missing');
    }
  } else {
    writeFileSync(jsonPath, json);
    writeFileSync(markdownPath, markdown);
  }
  process.stdout.write(`${mode} ${OUTPUT_JSON}\n`);
  return report;
}

const isMain = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) main().catch((error) => { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1; });

export {
  OUTPUT_JSON, OUTPUT_MD, SELECTED_RUNS, REPORT_SCHEMA, EXPECTED_SELECTED_RUN_COUNT,
  deriveSelectedRuns, selectOfficialRuns, mergeExactCriteria, curves, buildReport, renderMarkdown, parseArgs, main,
  replayInput, replayReceipt, createRecordedPromptTransformer,
};
