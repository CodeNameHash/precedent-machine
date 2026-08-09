#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildCorpusReviewModel, isFinalCorpusRun } from './canonical-v2-corpus-review-artifact.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '..');
const OUTPUT_PATH = resolve(ROOT, 'evidence/canonical-v2/stage-2y-k-residual-a.json');
const REGISTER_PATH = resolve(ROOT, 'docs/codex-program/notes/stage-2y/unresolved-register.json');
const EXPECTED_OCCURRENCES = 99;
const TARGET_FAMILIES = Object.freeze([
  'CLOSING_CONDITIONS',
  'PROXY_MEETING',
  'GENERAL_COVENANTS',
  'CONSIDERATION',
  'GUARANTY_FINANCING_PARTY',
  'MERGER_STRUCTURE_CLOSING',
]);
const TARGET_STATUSES = new Set(['LIKELY_MECHANISM', 'UNDIAGNOSED']);

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function relativePath(path) {
  return relative(ROOT, path).replaceAll('\\', '/');
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function countBy(items, valueFor) {
  const counts = new Map();
  for (const item of items) {
    const value = valueFor(item);
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

function assertion(condition, message) {
  if (!condition) throw new Error(message);
}

function verdict(mechanism_verdict, mechanism_class, fix_class, confidence, correct_abstention) {
  return Object.freeze({ mechanism_verdict, mechanism_class, fix_class, confidence, correct_abstention });
}

function sourceCandidates(receipt) {
  return (receipt.compiled_candidates || []).filter((entry) => entry?.candidate?.claim);
}

function sourceCandidateFor(item, candidates) {
  if (typeof item.original_claim_occurrence_id === 'string') {
    const selected = candidates.find((entry) => entry.candidate.claim.claim_occurrence_id === item.original_claim_occurrence_id);
    if (selected) return selected;
  }
  if (typeof item.claim_revision_id === 'string') {
    const selected = candidates.find((entry) => entry.candidate.claim.claim_revision_id === item.claim_revision_id);
    if (selected) return selected;
  }
  if (typeof item.closure_id === 'string') {
    const matches = candidates.filter((entry) => entry.candidate.claim.closure_id === item.closure_id);
    if (matches.length === 1) return matches[0];
  }
  const phrase = item.raw_value || item.normalised_phrase;
  const matches = candidates.filter((entry) => entry.candidate.claim.claim_definition_key === item.generic_claim_key
    && entry.candidate.claim.raw_value === phrase);
  return matches.length === 1 ? matches[0] : null;
}

function resolverMarkerFor(reasonCode) {
  if (reasonCode === 'NO_MONEY_LITERAL') return ['lib/canonical-v2/native-producer/per-share-cash-parse.js', 'function parsePerShareCash', 'NO_MONEY_LITERAL'];
  if (reasonCode === 'RATIO_CONTEXT_UNCORROBORATED') return ['lib/canonical-v2/native-producer/candidate-resolution.js', 'function handleConsiderationCandidate', 'RATIO_CONTEXT_UNCORROBORATED'];
  if (reasonCode === 'GTY_KIND_UNCORROBORATED') return ['lib/canonical-v2/native-producer/guaranty-corroboration.js', 'function corroborateGuarantyKind', 'GTY_KIND_UNCORROBORATED'];
  if (reasonCode === 'GENERAL_COVENANT_DEFINITION_REFERENCE_UNRESOLVED') return ['lib/canonical-v2/native-producer/candidate-resolution.js', 'function generalCovenantGroundingFailure', 'GENERAL_COVENANT_DEFINITION_REFERENCE_UNRESOLVED'];
  if (reasonCode === 'MERGER_TRANSACTION_STEP_ENTITY_NOT_IN_QUOTE') return ['lib/canonical-v2/native-producer/candidate-resolution.js', 'function handleMergerTransactionStepCandidate', 'MERGER_TRANSACTION_STEP_ENTITY_NOT_IN_QUOTE'];
  if (reasonCode === 'PARTY_UNRESOLVED') return ['lib/canonical-v2/native-producer/candidate-resolution.js', 'function resolveParty', 'PARTY_UNRESOLVED'];
  if (reasonCode === 'MEETING_REF_ABSENT') return ['lib/canonical-v2/native-producer/candidate-resolution.js', 'function handleProxyMeetingCandidate', 'refField.toUpperCase()'];
  if (reasonCode === 'DOCUMENT_REF_NOT_IN_QUOTE') return ['lib/canonical-v2/native-producer/candidate-resolution.js', 'function handleProxyMeetingCandidate', "${refField.toUpperCase()}_NOT_IN_QUOTE"];
  if (reasonCode.startsWith('AMBIGUOUS_PROXY_') || reasonCode.includes('ADJOURNMENT') || reasonCode.includes('MEETING_REF') || reasonCode.includes('CONTROL_PARTY') || reasonCode.includes('DOCUMENT_REF')) {
    return ['lib/canonical-v2/native-producer/candidate-resolution.js', 'function handleProxyMeetingCandidate', reasonCode];
  }
  return ['lib/canonical-v2/native-producer/candidate-resolution.js', 'function handleClosingConditionCandidate', reasonCode];
}

function openedResolver(reasonCode) {
  const [path, functionMarker, reasonMarker] = resolverMarkerFor(reasonCode);
  const absolutePath = resolve(ROOT, path);
  assertion(existsSync(absolutePath), `resolver source missing: ${path}`);
  const lines = readFileSync(absolutePath, 'utf8').split('\n');
  const functionIndex = lines.findIndex((line) => line.includes(functionMarker));
  const reasonIndex = lines.findIndex((line) => line.includes(reasonMarker));
  assertion(functionIndex >= 0, `resolver function marker missing: ${path}: ${functionMarker}`);
  assertion(reasonIndex >= 0, `resolver reason marker missing: ${path}: ${reasonMarker}`);
  return Object.freeze({
    path,
    function: functionMarker.replace(/^function /, ''),
    function_line: functionIndex + 1,
    reason_marker: reasonMarker,
    reason_marker_line: reasonIndex + 1,
  });
}

function isFullFrustrationCondition(quote) {
  return /(?:may|shall) not rely|neither .{0,60} may rely/i.test(quote);
}

function closingConditionVerdict(reasonCode, quote, attributes) {
  const kind = attributes.assertion_kind;
  if (reasonCode === 'ACCURACY_STANDARD_OUT_OF_VOCABULARY') {
    return attributes.accuracy_standard == null
      ? verdict('PRODUCER_ACCURACY_STANDARD_OMITTED', 'PRODUCER_ATTRIBUTE_OMISSION', 'PROMPT_CHANGE', 'HIGH', false)
      : verdict('PRODUCER_ACCURACY_STANDARD_LEGACY_ALIAS', 'PRODUCER_STALE_CODEBOOK_VALUE', 'PROMPT_CHANGE', 'HIGH', false);
  }
  if (reasonCode === 'PARTY_UNRESOLVED') {
    if (kind === 'BURDENSOME_CONDITION') return verdict('CORRECT_ABSTENTION_PARTYLESS_BURDENSOME_FRAGMENT', 'CORRECT_ABSTENTION_QUOTE_SCOPE', 'NO_FIX', 'HIGH', true);
    return verdict('PRODUCER_CONDITION_OBLIGOR_OMITTED', 'PRODUCER_ATTRIBUTE_OMISSION', 'PROMPT_CHANGE', 'HIGH', false);
  }
  if (reasonCode === 'MAE_PARTY_UNCORROBORATED') return verdict('TAXONOMY_BUYER_MAE_CONDITION_UNGOVERNED', 'GOVERNED_TAXONOMY_GAP', 'TAXONOMY_DESIGN', 'HIGH', false);
  if (reasonCode === 'APPROVAL_KIND_UNCORROBORATED') return verdict('RESOLVER_SCHEDULED_APPROVAL_LEXICAL_VARIANT', 'RESOLVER_CORROBORATION_PATTERN_GAP', 'RESOLVER_SIDE', 'HIGH', false);
  if (reasonCode === 'CERTIFIED_CONDITION_REF_NOT_IN_QUOTE') return verdict('RESOLVER_SECTION_REFERENCE_LIST_NORMALISATION_GAP', 'RESOLVER_REFERENCE_NORMALISATION_GAP', 'RESOLVER_SIDE', 'HIGH', false);
  if (reasonCode === 'SCRAPE_QUOTE_NOT_IN_QUOTE') return verdict('PRODUCER_SCRAPE_QUOTE_PAGE_ARTIFACT', 'PRODUCER_QUOTE_FIDELITY_GAP', 'PROMPT_CHANGE', 'HIGH', true);
  if (reasonCode !== 'CONDITION_KIND_UNCORROBORATED') return null;
  if (kind === 'S4_COMPONENT') return verdict('PRODUCER_S4_COMPONENT_MISCLASSIFICATION', 'PRODUCER_ASSERTION_KIND_MISCLASSIFICATION', 'PROMPT_CHANGE', 'HIGH', false);
  if (kind === 'OFFICER_CERTIFICATE') return verdict('RESOLVER_OFFICER_CERTIFICATE_CONFIRMING_VARIANT', 'RESOLVER_CORROBORATION_PATTERN_GAP', 'RESOLVER_SIDE', 'HIGH', false);
  if (kind === 'REGULATORY_APPROVAL') return verdict('RESOLVER_SCHEDULED_APPROVAL_LEXICAL_VARIANT', 'RESOLVER_CORROBORATION_PATTERN_GAP', 'RESOLVER_SIDE', 'HIGH', false);
  if (kind === 'FRUSTRATION_CAUSATION' || kind === 'FRUSTRATION_BREACH') {
    return isFullFrustrationCondition(quote)
      ? verdict('RESOLVER_FRUSTRATION_KIND_DETECTION_OMISSION', 'RESOLVER_CORROBORATION_PATTERN_GAP', 'RESOLVER_SIDE', 'HIGH', false)
      : verdict('CORRECT_ABSTENTION_FRUSTRATION_FRAGMENT_WITHOUT_RELIANCE_CHAPEAU', 'CORRECT_ABSTENTION_QUOTE_SCOPE', 'NO_FIX', 'HIGH', true);
  }
  if (kind === 'BRING_DOWN_TIER') return verdict('CORRECT_ABSTENTION_BRING_DOWN_FRAGMENT_WITHOUT_SUBJECT', 'CORRECT_ABSTENTION_QUOTE_SCOPE', 'NO_FIX', 'HIGH', true);
  if (kind === 'STOCKHOLDER_APPROVAL') {
    return /adopted by the stockholders/i.test(quote)
      ? verdict('RESOLVER_STOCKHOLDER_ADOPTION_LEXICAL_VARIANT', 'RESOLVER_CORROBORATION_PATTERN_GAP', 'RESOLVER_SIDE', 'HIGH', false)
      : verdict('TAXONOMY_DEFINED_APPROVAL_TERM_REQUIRES_DEFINITION_LINK', 'GOVERNED_TAXONOMY_GAP', 'TAXONOMY_DESIGN', 'HIGH', true);
  }
  if (kind === 'NO_MAE_CONDITION' || kind === 'MAE_CONTINUING') {
    if (attributes.mae_party === 'BUYER') return verdict('TAXONOMY_BUYER_MAE_CONDITION_UNGOVERNED', 'GOVERNED_TAXONOMY_GAP', 'TAXONOMY_DESIGN', 'HIGH', false);
    if (kind === 'MAE_CONTINUING' && !/continuing/i.test(quote)) return verdict('PRODUCER_MAE_CONTINUING_MISCLASSIFICATION', 'PRODUCER_ASSERTION_KIND_MISCLASSIFICATION', 'PROMPT_CHANGE', 'HIGH', false);
    return verdict('RESOLVER_MAE_DEFINED_TERM_OR_CONTINUING_VARIANT', 'RESOLVER_CORROBORATION_PATTERN_GAP', 'RESOLVER_SIDE', 'MEDIUM', false);
  }
  if (kind === 'BURDENSOME_CONDITION') return verdict('CORRECT_ABSTENTION_PARTYLESS_BURDENSOME_FRAGMENT', 'CORRECT_ABSTENTION_QUOTE_SCOPE', 'NO_FIX', 'HIGH', true);
  return verdict('NEEDS_SOURCE_ADJUDICATION_CONDITION_KIND', 'NEEDS_SOURCE_ADJUDICATION', 'NO_FIX', 'LOW', false);
}

function proxyMeetingVerdict(reasonCode, quote, attributes) {
  if (reasonCode === 'AMBIGUOUS_PROXY_MEETING_KIND') {
    if (attributes.assertion_kind === 'MERGER_SUB_APPROVAL') return verdict('RESOLVER_PARENT_APPROVAL_PATTERN_FALSE_POSITIVE', 'RESOLVER_CORROBORATION_PATTERN_GAP', 'RESOLVER_SIDE', 'HIGH', false);
    return verdict('PRODUCER_COMPOUND_PROXY_CLAUSE_NOT_SPLIT', 'PRODUCER_MULTI_FACT_CLAUSE', 'PROMPT_CHANGE', 'HIGH', false);
  }
  if (reasonCode === 'ADJOURNMENT_REASON_NOT_DIRECTLY_GROUNDED') return verdict('RESOLVER_QUORUM_ABSENCE_LEXICAL_VARIANT', 'RESOLVER_CORROBORATION_PATTERN_GAP', 'RESOLVER_SIDE', 'HIGH', false);
  if (reasonCode === 'MEETING_REF_ABSENT') return verdict('RESOLVER_PRESENCE_FACT_REQUIRES_UNNEEDED_MEETING_REFERENCE', 'RESOLVER_SCOPE_GATE_GAP', 'RESOLVER_SIDE', 'HIGH', false);
  if (reasonCode === 'CONTROL_PARTY_REF_UNCORROBORATED') return verdict('CORRECT_ABSTENTION_PASSIVE_MEETING_CONTROL', 'CORRECT_ABSTENTION_QUOTE_SCOPE', 'NO_FIX', 'HIGH', true);
  if (reasonCode === 'CONTROL_PARTY_REF_NOT_IN_QUOTE') return verdict('RESOLVER_CONTROL_PARTY_CASE_NORMALISATION_GAP', 'RESOLVER_REFERENCE_NORMALISATION_GAP', 'RESOLVER_SIDE', 'HIGH', false);
  if (reasonCode === 'DOCUMENT_REF_NOT_IN_QUOTE') return verdict('PRODUCER_DOCUMENT_REFERENCE_TYPO', 'PRODUCER_QUOTE_FIDELITY_GAP', 'PROMPT_CHANGE', 'HIGH', true);
  return null;
}

function assessmentFor({ family, reasonCode, rawQuote, attributes }) {
  const quote = String(rawQuote || '');
  if (family === 'CLOSING_CONDITIONS') {
    const assessed = closingConditionVerdict(reasonCode, quote, attributes);
    if (assessed) return assessed;
  }
  if (family === 'PROXY_MEETING') {
    const assessed = proxyMeetingVerdict(reasonCode, quote, attributes);
    if (assessed) return assessed;
  }
  if (reasonCode === 'NO_MONEY_LITERAL') return verdict('TAXONOMY_CITED_CONSIDERATION_VALUE_REQUIRES_CROSS_REFERENCE', 'GOVERNED_TAXONOMY_GAP', 'TAXONOMY_DESIGN', 'HIGH', false);
  if (reasonCode === 'RATIO_CONTEXT_UNCORROBORATED') return verdict('CORRECT_ABSTENTION_RATIO_QUOTE_WITHOUT_EXCHANGE_OPERATION', 'CORRECT_ABSTENTION_QUOTE_SCOPE', 'NO_FIX', 'HIGH', true);
  if (reasonCode === 'GTY_KIND_UNCORROBORATED') return verdict('RESOLVER_GUARANTY_IN_EFFECT_LEGACY_PATTERN_HOLD', 'RESOLVER_CORROBORATION_PATTERN_GAP', 'RESOLVER_SIDE', 'MEDIUM', false);
  if (reasonCode === 'GENERAL_COVENANT_DEFINITION_REFERENCE_UNRESOLVED') return verdict('TAXONOMY_GENERAL_COVENANT_DEFINITION_LINK_UNGOVERNED', 'GOVERNED_TAXONOMY_GAP', 'TAXONOMY_DESIGN', 'HIGH', false);
  if (reasonCode === 'MERGER_TRANSACTION_STEP_ENTITY_NOT_IN_QUOTE') return verdict('PRODUCER_FILING_COVENANT_MISCLASSIFIED_AS_TRANSACTION_STEP', 'PRODUCER_ASSERTION_KIND_MISCLASSIFICATION', 'PROMPT_CHANGE', 'HIGH', true);
  if (family === 'GENERAL_COVENANTS' && reasonCode === 'PARTY_UNRESOLVED') {
    if (/\b(?:No Party|Each party hereto)\b/i.test(quote)) return verdict('TAXONOMY_MUTUAL_GENERAL_COVENANT_PARTY_UNGOVERNED', 'GOVERNED_TAXONOMY_GAP', 'TAXONOMY_DESIGN', 'HIGH', true);
    return verdict('PRODUCER_GENERAL_COVENANT_OBLIGOR_MISCLASSIFICATION', 'PRODUCER_ATTRIBUTE_OMISSION', 'PROMPT_CHANGE', 'HIGH', false);
  }
  return verdict('NEEDS_SOURCE_ADJUDICATION_UNCLASSIFIED_RESIDUAL', 'NEEDS_SOURCE_ADJUDICATION', 'NO_FIX', 'LOW', false);
}

function loadedArtifacts(runName) {
  const runDirectory = resolve(ROOT, 'evidence/canonical-v2', runName);
  const paths = Object.freeze({
    run_manifest: resolve(runDirectory, 'run-manifest.json'),
    run_receipt: resolve(runDirectory, 'run-receipt.json'),
    resolution: resolve(runDirectory, 'resolution.json'),
    source_reference: resolve(runDirectory, 'source-reference.json'),
    recording: resolve(runDirectory, 'recording.json'),
  });
  const absent = Object.entries(paths).filter(([, path]) => !existsSync(path)).map(([name]) => name);
  assertion(absent.length === 0, `missing final-run artefact for ${runName}: ${absent.join(', ')}`);
  return Object.freeze({
    paths,
    manifest: readJson(paths.run_manifest),
    receipt: readJson(paths.run_receipt),
    resolution: readJson(paths.resolution),
    sourceReference: readJson(paths.source_reference),
    recording: readJson(paths.recording),
  });
}

function sourceAgreement(sourceReference) {
  const path = sourceReference?.reused_committed_raw_html || sourceReference?.admitted_source_capture_inputs?.raw_html_path || null;
  return Object.freeze({
    status: path && existsSync(resolve(ROOT, path)) ? 'LOCATED' : 'NOT_LOCATED',
    path,
    citation: sourceReference?.retrieval_url || null,
  });
}

function occurrenceItemFor(run, claim) {
  const artifacts = loadedArtifacts(run.name);
  const [bucket, indexText] = claim.source_index.split(':');
  const index = Number(indexText);
  assertion((bucket === 'review_queue' || bucket === 'open_world') && Number.isInteger(index), `invalid resolution source index: ${claim.source_index}`);
  const item = artifacts.resolution[bucket]?.[index] || null;
  assertion(item, `final resolution entry missing: ${run.name}:${claim.source_index}`);
  const sourceCandidate = sourceCandidateFor(item, sourceCandidates(artifacts.receipt));
  assertion(sourceCandidate, `compiled candidate missing: ${run.name}:${claim.source_index}`);
  return Object.freeze({ artifacts, item, sourceCandidate, sourceClaim: sourceCandidate.candidate.claim, bucket, index });
}

function recordFor({ run, claim, reasonCode, registerRow }) {
  const { artifacts, item, sourceCandidate, sourceClaim, bucket, index } = occurrenceItemFor(run, claim);
  const source = sourceAgreement(artifacts.sourceReference);
  const rawQuote = sourceClaim.raw_value || item.raw_value || claim.raw_value || null;
  const evidence = sourceClaim.evidence || item.evidence || [];
  const attributes = sourceClaim.attributes || item.attributes || {};
  const assessment = assessmentFor({ family: claim.family, reasonCode, rawQuote, attributes });
  const claimId = sourceClaim.claim_occurrence_id || sourceClaim.claim_revision_id || item.original_claim_occurrence_id || item.claim_revision_id;
  assertion(typeof claimId === 'string' && claimId.length > 0, `claim identity missing: ${run.name}:${claim.source_index}`);
  const legacyArtifactPaths = Object.freeze({
    run_manifest: relativePath(artifacts.paths.run_manifest),
    resolution: relativePath(artifacts.paths.resolution),
    receipt: relativePath(artifacts.paths.run_receipt),
    recording: relativePath(artifacts.paths.recording),
  });
  const evidenceByteSpans = evidence.map((entry) => Object.freeze({
    evidence_role: entry.evidence_role || null,
    excerpt_id: entry.excerpt_id || null,
    absolute_start: Number.isInteger(entry.absolute_start) ? entry.absolute_start : null,
    absolute_end: Number.isInteger(entry.absolute_end) ? entry.absolute_end : null,
  }));
  const resolverCodeOpened = openedResolver(reasonCode);
  return Object.freeze({
    id: sha256(JSON.stringify([run.name, claim.source_index, claimId, reasonCode])),
    claim_id: claimId,
    shared_claim_id: claimId,
    deal: run.deal,
    family: claim.family,
    reason_code: reasonCode,
    state: claim.state,
    location_status: source.status,
    run_path: relativePath(resolve(ROOT, 'evidence/canonical-v2', run.name)),
    artifact_status: 'LOCATED',
    artifact_paths: legacyArtifactPaths,
    recorded_source: Object.freeze({
      document_hash: artifacts.manifest.document_hash || null,
      source_sha256: artifacts.manifest.source_sha256 || null,
      recorded_to: artifacts.manifest.recorded_to || null,
      recording_status: 'LOCATED',
    }),
    winning_run: run.name,
    run_artifact_paths: Object.freeze({
      run_manifest: relativePath(artifacts.paths.run_manifest),
      run_receipt: relativePath(artifacts.paths.run_receipt),
      resolution: relativePath(artifacts.paths.resolution),
      source_reference: relativePath(artifacts.paths.source_reference),
      recording: relativePath(artifacts.paths.recording),
    }),
    resolution_entry_path: `${bucket}[${index}]`,
    section_reference: item.section_reference || claim.section || null,
    source_citation: item.source_citation || null,
    excerpt_id: evidence[0]?.excerpt_id || claim.excerpt_id || null,
    raw_quote: rawQuote,
    exact_raw_quote: rawQuote,
    source_evidence_byte_spans: evidenceByteSpans,
    evidence_byte_spans: evidenceByteSpans,
    source_agreement: source,
    recording: Object.freeze({
      status: 'LOCATED',
      schema_version: artifacts.recording.schema_version || null,
      model: artifacts.recording.model || null,
      provider_id: artifacts.recording.provider_id || null,
      call_count: artifacts.recording.call_count ?? null,
    }),
    producer_attributes: Object.freeze({
      claim_definition_key: sourceClaim.claim_definition_key || item.generic_claim_key || claim.claim_kind,
      canonical_value: sourceClaim.canonical_value ?? item.canonical_value ?? null,
      attributes,
      taxonomy_codes: sourceClaim.taxonomy_codes || {},
      extraction_version: sourceClaim.extraction_version || null,
      normalisation_version: sourceClaim.normalisation_version || null,
      derivation_version: sourceClaim.derivation_version || null,
      extraction_provenance: sourceCandidate.candidate.extraction_provenance || item.extraction_provenance || null,
    }),
    resolver_code_opened: resolverCodeOpened,
    resolver_function_code_path: `${resolverCodeOpened.path}:${resolverCodeOpened.function}`,
    mechanism_verdict: assessment.mechanism_verdict,
    mechanism_class: assessment.mechanism_class,
    fix_class: assessment.fix_class,
    confidence: assessment.confidence,
    correct_abstention: assessment.correct_abstention,
    source_status: source.status,
    register_diagnosis_status: registerRow.diagnosis_status,
  });
}

function buildInventory() {
  const register = readJson(REGISTER_PATH);
  const targetRows = register.rows.filter((row) => TARGET_FAMILIES.includes(row.family)
    && TARGET_STATUSES.has(row.diagnosis_status));
  const rowByKey = new Map(targetRows.map((row) => [`${row.family}\0${row.reason_code}`, row]));
  const expectedFromRegister = targetRows.reduce((total, row) => total + row.count, 0);
  assertion(expectedFromRegister === EXPECTED_OCCURRENCES, `target register occurrence drift: expected ${EXPECTED_OCCURRENCES}, got ${expectedFromRegister}`);

  const model = buildCorpusReviewModel({ repoRoot: ROOT });
  assertion(model.runs.every((run) => isFinalCorpusRun(run.name)), 'non-final run entered corpus-review model');
  const records = [];
  for (const run of model.runs) {
    for (const claim of run.claims) {
      for (const reasonCode of claim.reasons) {
        const registerRow = rowByKey.get(`${claim.family}\0${reasonCode}`);
        if (registerRow) records.push(recordFor({ run, claim, reasonCode, registerRow }));
      }
    }
  }
  records.sort((left, right) => left.deal.localeCompare(right.deal)
    || left.family.localeCompare(right.family)
    || left.winning_run.localeCompare(right.winning_run)
    || left.resolution_entry_path.localeCompare(right.resolution_entry_path)
    || left.reason_code.localeCompare(right.reason_code));
  assertion(records.length === EXPECTED_OCCURRENCES, `winning-run occurrence drift: expected ${EXPECTED_OCCURRENCES}, got ${records.length}`);
  assertion(new Set(records.map((record) => record.id)).size === records.length, 'duplicate stable occurrence id');
  assertion(records.every((record) => ['RESOLVER_SIDE', 'PROMPT_CHANGE', 'TAXONOMY_DESIGN', 'NO_FIX'].includes(record.fix_class)), 'non-concrete fix class');
  assertion(records.every((record) => ['HIGH', 'MEDIUM', 'LOW'].includes(record.confidence)), 'invalid confidence');
  assertion(records.every((record) => typeof record.correct_abstention === 'boolean'), 'correct_abstention must be explicit');
  const targetCounts = Object.fromEntries(targetRows.map((row) => [`${row.family}:${row.reason_code}`, row.count]).sort(([a], [b]) => a.localeCompare(b)));
  const extractedCounts = countBy(records, (record) => `${record.family}:${record.reason_code}`);
  assertion(JSON.stringify(targetCounts) === JSON.stringify(extractedCounts), 'register-to-winning-run reason count drift');
  const adjudicationRecords = records.filter((record) => record.mechanism_class === 'NEEDS_SOURCE_ADJUDICATION');
  const meta = Object.freeze({
      schema_version: 'STAGE_2Y_K_RESIDUAL_A_EVIDENCE/V2',
      corpus_review_artifact: 'evidence/canonical-v2/corpus-review-20260809.html',
      winning_run_rule: 'scripts/canonical-v2-corpus-review-artifact.mjs:isFinalCorpusRun',
      target_families: TARGET_FAMILIES,
      target_diagnosis_statuses: [...TARGET_STATUSES].sort(),
      expected_reason_code_occurrences: EXPECTED_OCCURRENCES,
      target_register_rows: targetRows.length,
      target_register_reason_code_occurrences: expectedFromRegister,
      extracted_reason_code_occurrences: records.length,
      target_counts_by_family_reason: targetCounts,
      extracted_counts_by_family_reason: extractedCounts,
      located: records.filter((record) => record.location_status === 'LOCATED').length,
      not_located: records.filter((record) => record.location_status === 'NOT_LOCATED').length,
      artifact_missing: 0,
      counts_by_mechanism: countBy(records, (record) => record.mechanism_verdict),
      counts_by_mechanism_class: countBy(records, (record) => record.mechanism_class),
      counts_by_fix_class: countBy(records, (record) => record.fix_class),
      counts_by_confidence: countBy(records, (record) => record.confidence),
      correct_abstentions: records.filter((record) => record.correct_abstention).length,
      needs_source_adjudication: adjudicationRecords.length,
      needs_source_adjudication_by_reason_group: countBy(adjudicationRecords, (record) => `${record.family}:${record.reason_code}`),
    });
  return Object.freeze({
    meta,
    _meta: meta,
    occurrences: records,
  });
}

function main() {
  const mode = process.argv[2];
  if (mode !== '--write' && mode !== '--check') throw new Error('usage: node scripts/stage-2y-k-residual-a.mjs --write|--check');
  const output = `${JSON.stringify(buildInventory(), null, 2)}\n`;
  if (mode === '--write') {
    writeFileSync(OUTPUT_PATH, output);
    process.stdout.write(`${relativePath(OUTPUT_PATH)}\n`);
    return;
  }
  assertion(existsSync(OUTPUT_PATH), `inventory missing: ${relativePath(OUTPUT_PATH)}`);
  assertion(readFileSync(OUTPUT_PATH, 'utf8') === output, `inventory drift: run node ${relativePath(fileURLToPath(import.meta.url))} --write`);
  process.stdout.write(`${relativePath(OUTPUT_PATH)}: checked\n`);
}

main();
