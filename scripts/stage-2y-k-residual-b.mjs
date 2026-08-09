#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

import { buildCorpusReviewModel, isFinalCorpusRun } from './canonical-v2-corpus-review-artifact.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '..');
const OUTPUT_PATH = resolve(ROOT, 'evidence/canonical-v2/stage-2y-k-residual-b.json');
const REGISTER_PATH = resolve(ROOT, 'docs/codex-program/notes/stage-2y/unresolved-register.json');
const EXPECTED_OCCURRENCES = 113;
const TARGET_FAMILIES = Object.freeze([
  'TERMINATION_FEE',
  'MAE_DEFINITION',
  'ANTITRUST_REGULATORY',
  'FINANCING_COVENANTS',
  'TAX_MATTERS',
  'INTERIM_OPERATING',
  'NO_SHOP',
  'KEY_DEFINED_TERMS',
  'TERMINATION',
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
    const key = valueFor(item);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

function assertion(condition, message) {
  if (!condition) throw new Error(message);
}

function sourceCandidates(receipt) {
  return (receipt.compiled_candidates || []).filter((entry) => entry?.candidate?.claim);
}

function sourceCandidateFor(item, candidates) {
  let selected = null;
  if (typeof item.original_claim_occurrence_id === 'string') {
    selected = candidates.find((entry) => entry.candidate.claim.claim_occurrence_id === item.original_claim_occurrence_id);
    if (selected) return selected;
  }
  if (typeof item.claim_revision_id === 'string') {
    selected = candidates.find((entry) => entry.candidate.claim.claim_revision_id === item.claim_revision_id);
    if (selected) return selected;
  }
  if (typeof item.closure_id === 'string') {
    const closureMatches = candidates.filter((entry) => entry.candidate.claim.closure_id === item.closure_id);
    if (closureMatches.length === 1) return closureMatches[0];
  }
  const phrase = item.raw_value || item.normalised_phrase;
  const phraseMatches = candidates.filter((entry) => entry.candidate.claim.claim_definition_key === item.generic_claim_key
    && entry.candidate.claim.raw_value === phrase);
  return phraseMatches.length === 1 ? phraseMatches[0] : null;
}

function resolverMarkerFor({ family, reasonCode }) {
  if (reasonCode === 'ANNIVERSARY_PHRASE') return ['lib/canonical-v2/native-producer/termination-fee-parse.js', 'function parseTailPeriod', 'ANNIVERSARY_PATTERN'];
  if (reasonCode === 'NO_CALENDAR_DATE') return ['lib/canonical-v2/native-producer/termination-deadline-parse.js', 'function parseTerminationDeadline', 'NO_CALENDAR_DATE'];
  if (reasonCode.startsWith('SOLE_REMEDY_')) return ['lib/canonical-v2/native-producer/sole-remedy-resolution.js', 'function resolveSoleRemedyOpenWorld', 'SOLE_REMEDY_CARVEOUT_QUOTE_UNCORROBORATED'];
  const byFamily = {
    TERMINATION_FEE: ['lib/canonical-v2/native-producer/candidate-resolution.js', 'function handleFeeTriggerCandidate', 'FEE_SIDE_UNCORROBORATED'],
    MAE_DEFINITION: ['lib/canonical-v2/native-producer/candidate-resolution.js', 'function handleMaeCarveoutCandidate', 'MAE_CARVEOUT_UNCORROBORATED'],
    ANTITRUST_REGULATORY: ['lib/canonical-v2/native-producer/candidate-resolution.js', 'function handleRegulatoryEffortsCandidate', 'regulatoryValueCorroborated'],
    FINANCING_COVENANTS: ['lib/canonical-v2/native-producer/candidate-resolution.js', 'function handleFinancingCandidate', 'reviewFinancingGuaranty'],
    TAX_MATTERS: ['lib/canonical-v2/native-producer/candidate-resolution.js', 'function handleTaxMattersCandidate', reasonCode],
    INTERIM_OPERATING: ['lib/canonical-v2/native-producer/candidate-resolution.js', 'function handleIocRestrictionCandidate', 'IOC_LONG_TAIL_RESTRICTION_OPEN_WORLD'],
    NO_SHOP: ['lib/canonical-v2/native-producer/candidate-resolution.js', 'function handleNoShopPeriodCandidate', 'NO_SHOP_PERIOD_HOUR_NOTICE_OPEN_WORLD'],
    KEY_DEFINED_TERMS: ['lib/canonical-v2/native-producer/candidate-resolution.js', 'function handleDefinedTermCandidate', 'STANDARD_CODE_OUT_OF_ENUM'],
    TERMINATION: ['lib/canonical-v2/native-producer/candidate-resolution.js', 'function handleTerminationRightCandidate', 'parseTerminationDeadline'],
  };
  return byFamily[family];
}

function openedResolver({ family, reasonCode }) {
  const [path, functionMarker, reasonMarker] = resolverMarkerFor({ family, reasonCode });
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

function verdictFor({ deal, family, reasonCode, rawQuote, attributes }) {
  const quote = String(rawQuote || '');
  const lower = quote.toLowerCase();
  if (reasonCode === 'FEE_SIDE_UNCORROBORATED') {
    if (deal === 'concho' && /^\([^)]{1,90}\)$/.test(quote.trim())) return verdict('PRODUCER_QUOTE_CLIPPING', 'PROMPT_CHANGE', 'HIGH', false);
    return verdict('RESOLVER_GOVERNING_PAYMENT_CONTEXT_NOT_CONSUMED', 'RESOLVER_SIDE', 'HIGH', false);
  }
  if (reasonCode === 'ANNIVERSARY_PHRASE') return verdict('CORRECT_ABSTENTION_INTERPRETIVE_ANNIVERSARY', 'NO_FIX', 'HIGH', true);
  if (reasonCode === 'SOLE_REMEDY_FEE_CONTEXT_LINKED') return verdict('CORRECT_ABSTENTION_CROSS_FAMILY_LINKED_EVIDENCE', 'NO_FIX', 'HIGH', true);
  if (reasonCode === 'SOLE_REMEDY_CARVEOUT_QUOTE_UNCORROBORATED') return verdict('RESOLVER_UNIQUE_QUOTE_EVIDENCE_GATE', 'RESOLVER_SIDE', 'HIGH', false);
  if (reasonCode === 'NO_CALENDAR_DATE') return verdict('CORRECT_ABSTENTION_RELATIVE_DEADLINE', 'NO_FIX', 'HIGH', true);
  if (reasonCode === 'IOC_LONG_TAIL_RESTRICTION_OPEN_WORLD') return verdict('CORRECT_ABSTENTION_LONG_TAIL_RESTRICTION', 'TAXONOMY_DESIGN', 'HIGH', true);
  if (reasonCode === 'NO_SHOP_PERIOD_HOUR_NOTICE_OPEN_WORLD') return verdict('TAXONOMY_GAP_HOUR_NOTICE_PERIOD', 'TAXONOMY_DESIGN', 'HIGH', false);
  if (reasonCode === 'STANDARD_CODE_OUT_OF_ENUM') return verdict('RESOLVER_STANDARD_ENUM_GATE', 'RESOLVER_SIDE', 'HIGH', false);
  if (reasonCode === 'SUBSTITUTION_UNCORROBORATED') return verdict('RESOLVER_THRESHOLD_SUBSTITUTION_PATTERN_MISS', 'RESOLVER_SIDE', 'HIGH', false);
  if (reasonCode === 'TAX_TREATMENT_KIND_UNCORROBORATED') {
    if (/section\s+355/i.test(quote)) return verdict('CORRECT_ABSTENTION_UNSUPPORTED_SECTION_355_TREATMENT', 'TAXONOMY_DESIGN', 'HIGH', true);
    return verdict('TAXONOMY_GAP_INTENDED_TREATMENT_CODEBOOK', 'TAXONOMY_DESIGN', 'HIGH', false);
  }
  if (reasonCode === 'TAX_ASSERTION_OPEN_WORLD') {
    if (attributes.assertion_kind === 'FIRPTA_CERTIFICATE' && !/FIRPTA|United States real property holding corporation|1\.897-2/i.test(quote)) return verdict('PRODUCER_ASSERTION_KIND_MISCLASSIFICATION', 'PROMPT_CHANGE', 'HIGH', false);
    return verdict('RESOLVER_TAX_CORROBORATION_PATTERN_MISS', 'RESOLVER_SIDE', 'MEDIUM', false);
  }
  if (reasonCode === 'MAE_CARVEOUT_UNCORROBORATED') {
    if (/compliance by .*agreement|actions expressly required|action taken .* request|approved.*consented/i.test(lower)) return verdict('RESOLVER_MAE_CARVEOUT_PATTERN_MISS', 'RESOLVER_SIDE', 'HIGH', false);
    return verdict('RESOLVER_MAE_CARVEOUT_PATTERN_OR_CODE_GAP', 'RESOLVER_SIDE', 'MEDIUM', false);
  }
  if (reasonCode === 'ASSERTION_KIND_UNCORROBORATED') {
    if (/payoff|note offer|consent solicitation|not conditioned.*financing|deliver.*information|furnish parent/i.test(lower)) return verdict('PRODUCER_ASSERTION_KIND_MISCLASSIFICATION', 'PROMPT_CHANGE', 'HIGH', false);
    return verdict('RESOLVER_FINANCING_ASSERTION_CORROBORATION_MISS', 'RESOLVER_SIDE', 'MEDIUM', false);
  }
  if (reasonCode === 'FINANCING_SCOPE_UNCORROBORATED') return verdict('RESOLVER_FINANCING_SCOPE_CORROBORATION_MISS', 'RESOLVER_SIDE', 'HIGH', false);
  if (reasonCode === 'PARTY_UNRESOLVED') return verdict('RESOLVER_ANTECEDENT_PARTY_CONTEXT_MISSING', 'RESOLVER_SIDE', 'MEDIUM', false);
  if (reasonCode === 'OBLIGOR_REF_NOT_IN_QUOTE') return verdict('RESOLVER_PARTY_REFERENCE_LEXICON_GAP', 'RESOLVER_SIDE', 'HIGH', false);
  if (reasonCode === 'OBLIGOR_REF_UNCORROBORATED') return verdict('RESOLVER_OBLIGOR_CORROBORATION_PATTERN_MISS', 'RESOLVER_SIDE', 'HIGH', false);
  if (reasonCode === 'WITHDRAWAL_EXCEPTION_PERIOD_UNCORROBORATED') return verdict('RESOLVER_WITHDRAWAL_PERIOD_PATTERN_MISS', 'RESOLVER_SIDE', 'HIGH', false);
  if (reasonCode === 'CONSULTATION_RIGHT_UNCORROBORATED') return verdict('RESOLVER_CONSULTATION_PATTERN_MISS', 'RESOLVER_SIDE', 'HIGH', false);
  if (reasonCode === 'INFORMATION_SHARING_OBLIGATION_UNCORROBORATED') {
    if (/competitively sensitive material/i.test(quote)) return verdict('PRODUCER_ASSERTION_KIND_MISCLASSIFICATION', 'PROMPT_CHANGE', 'HIGH', false);
    return verdict('RESOLVER_INFORMATION_SHARING_PATTERN_MISS', 'RESOLVER_SIDE', 'HIGH', false);
  }
  if (reasonCode === 'BURDEN_COMMITMENT_UNCORROBORATED') return verdict('RESOLVER_BURDEN_COMMITMENT_PATTERN_MISS', 'RESOLVER_SIDE', 'HIGH', false);
  if (reasonCode === 'INFORMATION_PROTECTION_UNCORROBORATED') return verdict('RESOLVER_INFORMATION_PROTECTION_PATTERN_MISS', 'RESOLVER_SIDE', 'HIGH', false);
  if (reasonCode === 'FILING_OBLIGATION_UNCORROBORATED') return verdict('RESOLVER_FILING_OBLIGATION_PATTERN_MISS', 'RESOLVER_SIDE', 'HIGH', false);
  return verdict('NOT_LOCATED', 'NO_FIX', 'LOW', false);
}

function verdict(mechanism_verdict, fix_class, confidence, correct_abstention) {
  return Object.freeze({ mechanism_verdict, fix_class, confidence, correct_abstention });
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
  if (absent.length) return { status: 'ARTIFACT_MISSING', paths, absent };
  return {
    status: 'LOCATED',
    paths,
    manifest: readJson(paths.run_manifest),
    receipt: readJson(paths.run_receipt),
    resolution: readJson(paths.resolution),
    sourceReference: readJson(paths.source_reference),
    recording: readJson(paths.recording),
  };
}

function sourceAgreement(sourceReference) {
  const path = sourceReference?.reused_committed_raw_html || sourceReference?.admitted_source_capture_inputs?.raw_html_path || null;
  if (!path) return Object.freeze({ status: 'NOT_LOCATED', path: null, citation: null });
  return Object.freeze({
    status: existsSync(resolve(ROOT, path)) ? 'LOCATED' : 'NOT_LOCATED',
    path,
    citation: sourceReference.retrieval_url || null,
  });
}

function occurrenceItemFor(run, claim) {
  const index = Number(claim.source_index.split(':')[1]);
  const artifacts = loadedArtifacts(run.name);
  if (artifacts.status !== 'LOCATED') return { artifacts, item: null, sourceClaim: null, index };
  const item = claim.source_index.startsWith('review_queue:')
    ? artifacts.resolution.review_queue?.[index]
    : artifacts.resolution.open_world?.[index];
  const sourceCandidate = item ? sourceCandidateFor(item, sourceCandidates(artifacts.receipt)) : null;
  return { artifacts, item, sourceCandidate, sourceClaim: sourceCandidate?.candidate?.claim || null, index };
}

function recordFor({ run, claim, reasonCode, registerRow }) {
  const { artifacts, item, sourceCandidate, sourceClaim, index } = occurrenceItemFor(run, claim);
  const source = artifacts.status === 'LOCATED' ? sourceAgreement(artifacts.sourceReference) : { status: 'ARTIFACT_MISSING', path: null, citation: null };
  const locationStatus = artifacts.status !== 'LOCATED'
    ? 'ARTIFACT_MISSING'
    : !item || !sourceClaim && claim.state === 'HELD'
      ? 'NOT_LOCATED'
      : source.status;
  const primaryClaim = sourceClaim || item || {};
  const rawQuote = primaryClaim.raw_value || claim.raw_value;
  const evidence = primaryClaim.evidence || item?.evidence || [];
  const producer = sourceCandidate?.candidate?.extraction_provenance || item?.extraction_provenance || null;
  const claimId = primaryClaim.claim_occurrence_id || primaryClaim.closure_id || item?.closure_id || `UNLOCATED:${run.name}:${claim.source_index}`;
  const id = sha256(JSON.stringify([run.name, claim.source_index, claimId, reasonCode]));
  const assessment = locationStatus === 'LOCATED'
    ? verdictFor({ deal: run.deal, family: claim.family, reasonCode, rawQuote, attributes: primaryClaim.attributes || {} })
    : verdict(locationStatus, 'NO_FIX', 'LOW', false);
  return Object.freeze({
    id,
    claim_id: claimId,
    deal: run.deal,
    family: claim.family,
    reason_code: reasonCode,
    state: claim.state,
    location_status: locationStatus,
    winning_run: run.name,
    run_artifact_paths: Object.freeze({
      run_manifest: relativePath(artifacts.paths.run_manifest),
      run_receipt: relativePath(artifacts.paths.run_receipt),
      resolution: relativePath(artifacts.paths.resolution),
      source_reference: relativePath(artifacts.paths.source_reference),
      recording: relativePath(artifacts.paths.recording),
    }),
    resolution_entry_path: `${claim.source_index.split(':')[0]}[${index}]`,
    section_reference: item?.section_reference || claim.section || null,
    source_citation: item?.source_citation || null,
    excerpt_id: evidence[0]?.excerpt_id || claim.excerpt_id || null,
    raw_quote: rawQuote || null,
    source_evidence_byte_spans: evidence.map((entry) => Object.freeze({
      evidence_role: entry.evidence_role || null,
      excerpt_id: entry.excerpt_id || null,
      absolute_start: Number.isInteger(entry.absolute_start) ? entry.absolute_start : null,
      absolute_end: Number.isInteger(entry.absolute_end) ? entry.absolute_end : null,
    })),
    source_agreement: source,
    recording: artifacts.status === 'LOCATED' ? Object.freeze({
      status: 'LOCATED',
      schema_version: artifacts.recording.schema_version || null,
      model: artifacts.recording.model || null,
      provider_id: artifacts.recording.provider_id || null,
      call_count: artifacts.recording.call_count ?? null,
    }) : Object.freeze({ status: 'ARTIFACT_MISSING' }),
    producer_attributes: Object.freeze({
      claim_definition_key: primaryClaim.claim_definition_key || item?.generic_claim_key || claim.claim_kind,
      canonical_value: primaryClaim.canonical_value ?? item?.canonical_value ?? null,
      attributes: primaryClaim.attributes || item?.attributes || {},
      taxonomy_codes: primaryClaim.taxonomy_codes || {},
      extraction_version: primaryClaim.extraction_version || null,
      normalisation_version: primaryClaim.normalisation_version || null,
      derivation_version: primaryClaim.derivation_version || null,
      extraction_provenance: producer,
    }),
    resolver_code_opened: openedResolver({ family: claim.family, reasonCode }),
    mechanism_verdict: assessment.mechanism_verdict,
    fix_class: assessment.fix_class,
    confidence: assessment.confidence,
    correct_abstention: assessment.correct_abstention,
    register_diagnosis_status: registerRow.diagnosis_status,
  });
}

function buildInventory() {
  const register = readJson(REGISTER_PATH);
  const targetRows = register.rows.filter((row) => TARGET_FAMILIES.includes(row.family)
    && TARGET_STATUSES.has(row.diagnosis_status));
  const rowByKey = new Map(targetRows.map((row) => [`${row.family}\0${row.reason_code}`, row]));
  const expectedFromRegister = targetRows.reduce((total, row) => total + row.count, 0);
  assertion(expectedFromRegister === EXPECTED_OCCURRENCES,
    `target register occurrence drift: expected ${EXPECTED_OCCURRENCES}, got ${expectedFromRegister}`);

  const model = buildCorpusReviewModel({ repoRoot: ROOT });
  assertion(model.runs.every((run) => isFinalCorpusRun(run.name)), 'non-winning run entered corpus-review model');
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
  assertion(records.length === EXPECTED_OCCURRENCES,
    `winning-run occurrence drift: expected ${EXPECTED_OCCURRENCES}, got ${records.length}`);
  assertion(new Set(records.map((record) => record.id)).size === records.length, 'duplicate stable occurrence id');
  const targetCounts = Object.fromEntries(targetRows.map((row) => [`${row.family}:${row.reason_code}`, row.count]).sort(([a], [b]) => a.localeCompare(b)));
  const extractedCounts = countBy(records, (record) => `${record.family}:${record.reason_code}`);
  assertion(JSON.stringify(targetCounts) === JSON.stringify(extractedCounts), 'register-to-winning-run reason count drift');
  return Object.freeze({
    _meta: Object.freeze({
      schema_version: 'STAGE_2Y_K_RESIDUAL_B_EVIDENCE/V1',
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
      artifact_missing: records.filter((record) => record.location_status === 'ARTIFACT_MISSING').length,
      counts_by_mechanism: countBy(records, (record) => record.mechanism_verdict),
      counts_by_fix_class: countBy(records, (record) => record.fix_class),
      counts_by_confidence: countBy(records, (record) => record.confidence),
      correct_abstentions: records.filter((record) => record.correct_abstention).length,
    }),
    occurrences: records,
  });
}

function main() {
  const mode = process.argv[2];
  if (mode !== '--write' && mode !== '--check') throw new Error('usage: node scripts/stage-2y-k-residual-b.mjs --write|--check');
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
