#!/usr/bin/env node

import {
  existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import {
  basename, dirname, relative, resolve, sep,
} from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(SCRIPT_DIR, '..');
const {
  canonicalJson, contentId, sha256Hex, utf8Slice,
} = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContractV42 } = require('../lib/canonical-v2/contract-bundle');
const {
  computeSectionCandidatesForLexicalDigest, resolveCandidates,
} = require('../lib/canonical-v2/native-producer/candidate-resolution');
const {
  buildLexicalDisagreementReceipt,
} = require('../lib/canonical-v2/native-producer/lexical-disagreement-net');
const {
  assertRecordedSourceMapProvenance,
  readSourceMapPayload,
} = require('../lib/canonical-v2/source-map-payload-store');

const COHORT_SCHEMA = 'STEP_2X_K_BLIND_SUCCESSOR_COHORT/V1';
const SAMPLE_SCHEMA = 'STEP_2X_K_BLIND_SUCCESSOR_SAMPLE/V1';
const KEY_SCHEMA = 'STEP_2X_K_BLIND_SUCCESSOR_KEY/V1';
const SCORE_SCHEMA = 'STEP_2X_K_BLIND_SUCCESSOR_SCORE/V1';
const CARD_DOMAIN = 'STEP_2X_K_BLIND_SUCCESSOR_CARD/V1';
const SOURCE_RUN_CONCURRENCY = 4;
const HISTORICAL_REFERENCE = Object.freeze({
  exact_replay_available: false,
  total_resolved: 21,
  named_stratum_floors: Object.freeze({
    'REVIEW:CATEGORY_UNCORROBORATED': 4,
    'REVIEW:CLAUSE_LABEL_NOT_IN_QUOTE': 6,
    'REVIEW:QUALIFIER_KIND_UNCLASSIFIED': 4,
    'REVIEW:TERMINATING_PARTY_REF_NOT_IN_QUOTE': 7,
  }),
  unnamed_historical_strata_count: 8,
  unnamed_strata_exact_comparison: 'UNAVAILABLE_LOST_ARTEFACTS',
});
const DEFAULT_RESOLVER_MODULE = Object.freeze({
  compileContract: compileFixtureContractV42,
  resolveCandidates,
  computeSectionCandidatesForLexicalDigest,
  buildLexicalDisagreementReceipt,
});

class BlindSuccessorError extends Error {
  constructor(code, message, details = {}) {
    super(`${code}: ${message}`);
    this.name = 'BlindSuccessorError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new BlindSuccessorError(code, message, details);
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    fail('JSON_INPUT_INVALID', `cannot read ${path}`, { cause: error.message });
  }
}

function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}

function digestFile(path) {
  return sha256Hex(readFileSync(path));
}

function resolveContainedPath(repoRoot, candidatePath, field) {
  if (typeof candidatePath !== 'string' || candidatePath.length === 0) {
    fail('SOURCE_PATH_INVALID', `${field} must be a non-empty repository-relative path`);
  }
  const root = resolve(repoRoot);
  const absolute = resolve(root, candidatePath);
  const fromRoot = relative(root, absolute);
  if (fromRoot === '..' || fromRoot.startsWith(`..${sep}`) || fromRoot === '') {
    fail('SOURCE_PATH_OUTSIDE_REPOSITORY', `${field} must name a contained file`, { candidate_path: candidatePath });
  }
  return absolute;
}

function sourceBinding({ repoRoot, run, sourceReferencePath }) {
  const sourceReference = readJson(sourceReferencePath);
  const payloadPath = sourceReference.admitted_source_capture_inputs?.source_map_payload_path;
  const declaredPayloadSha = sourceReference.admitted_source_capture_inputs?.source_map_compressed_sha256;
  if (payloadPath == null && declaredPayloadSha == null) {
    fail('SOURCE_MAP_BINDING_REQUIRED', `${run} is importable but has no persisted source-map binding`);
  }
  if (typeof payloadPath !== 'string' || typeof declaredPayloadSha !== 'string') {
    fail('SOURCE_MAP_BINDING_INCOMPLETE', `${run} has an incomplete persisted source-map binding`);
  }
  return Object.freeze({
    source_reference_sha256: digestFile(sourceReferencePath),
    source_map_payload: Object.freeze({ path: payloadPath, sha256: declaredPayloadSha }),
  });
}

function loadCohort({ repoRoot = DEFAULT_ROOT, cohortPath }) {
  const absolute = resolve(repoRoot, cohortPath);
  const cohort = readJson(absolute);
  if (!exactKeys(cohort, [
    'schema_version', 'baseline_manifest_path', 'baseline_manifest_sha256',
    'selection', 'sampling_seed', 'stratum_count', 'cards_per_stratum',
  ]) || cohort.schema_version !== COHORT_SCHEMA) {
    fail('COHORT_SCHEMA_INVALID', `expected ${COHORT_SCHEMA}`);
  }
  if (cohort.selection !== 'ALL_IMPORTABLE_RUNS_WITH_SCOREABLE_REVIEW_HOLDBACKS') {
    fail('COHORT_SELECTION_INVALID', 'selection is not the frozen successor policy');
  }
  if (typeof cohort.sampling_seed !== 'string' || cohort.sampling_seed.length === 0
    || !Number.isInteger(cohort.stratum_count) || cohort.stratum_count <= 0
    || !Number.isInteger(cohort.cards_per_stratum) || cohort.cards_per_stratum <= 0) {
    fail('COHORT_PARAMETERS_INVALID', 'seed and positive sampling dimensions are required');
  }
  const baselinePath = resolve(repoRoot, cohort.baseline_manifest_path);
  if (!existsSync(baselinePath) || digestFile(baselinePath) !== cohort.baseline_manifest_sha256) {
    fail('COHORT_BASELINE_DIGEST_MISMATCH', 'the frozen baseline manifest changed or is missing');
  }
  return Object.freeze({ cohort, cohortPath: absolute, baselinePath, baseline: readJson(baselinePath) });
}

function rawClaims(runReceipt) {
  return (runReceipt.compiled_candidates || [])
    .map((entry) => entry?.candidate?.claim)
    .filter((claim) => claim && typeof claim.claim_occurrence_id === 'string');
}

function rawCandidateJoin(item, runReceipt) {
  if (typeof item.original_claim_occurrence_id === 'string') {
    const matches = rawClaims(runReceipt).filter((claim) => (
      claim.claim_occurrence_id === item.original_claim_occurrence_id
    ));
    if (matches.length !== 1) {
      fail('SOURCE_CANDIDATE_ORIGINAL_ID_INVALID', 'original_claim_occurrence_id must identify exactly one raw candidate', {
        original_claim_occurrence_id: item.original_claim_occurrence_id,
        match_count: matches.length,
      });
    }
    return item.original_claim_occurrence_id;
  }
  const matches = rawClaims(runReceipt).filter((claim) => claim.closure_id === item.closure_id);
  if (matches.length > 1) {
    fail('SOURCE_CANDIDATE_JOIN_AMBIGUOUS', 'a resolution item does not map to exactly one raw candidate', {
      closure_id: item.closure_id || null, match_count: matches.length,
    });
  }
  return matches[0]?.claim_occurrence_id || null;
}

function rawCandidateId(item, runReceipt) {
  const id = rawCandidateJoin(item, runReceipt);
  if (!id) {
    fail('SOURCE_CANDIDATE_JOIN_MISSING', 'a resolution item does not map to a raw candidate', {
      closure_id: item.closure_id || null,
    });
  }
  return id;
}

function reviewStratum(item) {
  if (!Array.isArray(item.reasons) || item.reasons.length === 0
    || item.reasons.some((reason) => typeof reason !== 'string' || reason.length === 0)) {
    fail('REVIEW_REASON_REQUIRED', 'an unresolved review item needs at least one reason');
  }
  return `REVIEW:${[...new Set(item.reasons)].sort().join('+')}`;
}

function sourceText(item) {
  for (const value of [item.raw_value, item.normalised_phrase, item.canonical_value]) {
    if (typeof value === 'string' && value.length > 0) return value;
  }
  fail('SOURCE_TEXT_REQUIRED', 'a blind candidate has no reviewable text');
}

function scoreOrder(seed, id) {
  return sha256Hex(`${seed}\0${id}`);
}

function populationFromRun({ run, family, deal, runReceipt, resolution, hashes, source_binding: sourceRunBinding }) {
  const rows = [];
  const exclusions = [];
  const push = (channel, item, index, stratum) => {
    const sourceCandidateId = rawCandidateJoin(item, runReceipt);
    if (!sourceCandidateId) {
      exclusions.push(Object.freeze({
        source_run: run,
        old_channel: channel,
        source_index: index,
        closure_id: item.closure_id || null,
        reason: 'NO_RAW_CANDIDATE_MATCH',
      }));
      return;
    }
    const body = {
      source_candidate_id: sourceCandidateId,
      deal,
      family,
      section_reference: item.section_reference || null,
      source_citation: item.source_citation || null,
      source_text: sourceText(item),
    };
    rows.push(Object.freeze({
      ...body,
      card_id: contentId(CARD_DOMAIN, body),
      stratum,
      old_channel: channel,
      old_reasons: channel === 'REVIEW' ? [...new Set(item.reasons)].sort() : [item.reason || item.claim_definition_key],
      source_run: run,
      source_index: index,
      source_hashes: hashes,
      source_binding: sourceRunBinding,
    }));
  };
  (resolution.review_queue || []).forEach((item, index) => {
    if (item.has_resolution === false) push('REVIEW', item, index, reviewStratum(item));
  });
  return Object.freeze({ rows, exclusions });
}

function deduplicatePopulation(rows) {
  const byCandidate = new Map();
  for (const row of [...rows].sort((a, b) => a.source_run.localeCompare(b.source_run))) {
    const sourceIdentity = canonicalJson([row.deal, row.family, row.source_candidate_id]);
    const previous = byCandidate.get(sourceIdentity);
    if (!previous) {
      byCandidate.set(sourceIdentity, row);
      continue;
    }
    const identityFields = ['deal', 'family', 'section_reference', 'source_citation', 'source_text'];
    if (identityFields.some((field) => previous[field] !== row[field])) {
      fail('SOURCE_CANDIDATE_ID_COLLISION', 'one raw candidate id identifies different source facts', {
        source_candidate_id: row.source_candidate_id,
        previous: Object.fromEntries(['source_run', ...identityFields].map((field) => [field, previous[field]])),
        current: Object.fromEntries(['source_run', ...identityFields].map((field) => [field, row[field]])),
      });
    }
  }
  return [...byCandidate.values()];
}

function selectSample({ population, seed, stratumCount, cardsPerStratum }) {
  const buckets = new Map();
  for (const row of population) {
    if (!buckets.has(row.stratum)) buckets.set(row.stratum, []);
    buckets.get(row.stratum).push(row);
  }
  const eligible = [...buckets.entries()]
    .filter(([, rows]) => rows.length >= cardsPerStratum)
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  if (eligible.length < stratumCount) {
    fail('INSUFFICIENT_STRATA', 'the frozen cohort cannot supply the requested stratified sample', {
      eligible: eligible.length, required: stratumCount,
    });
  }
  const selectedStrata = eligible.slice(0, stratumCount);
  return selectedStrata.flatMap(([stratum, rows]) => rows
    .sort((a, b) => scoreOrder(seed, a.card_id).localeCompare(scoreOrder(seed, b.card_id))
      || a.card_id.localeCompare(b.card_id))
    .slice(0, cardsPerStratum)
    .map((row) => ({ ...row, stratum_population: rows.length, stratum })));
}

function buildBlindSuccessorSample({ repoRoot = DEFAULT_ROOT, cohortPath }) {
  const loaded = loadCohort({ repoRoot, cohortPath });
  if (!Array.isArray(loaded.baseline.runs)) fail('BASELINE_RUNS_INVALID', 'baseline.runs must be an array');
  const population = [];
  const exclusions = [];
  for (const baselineRun of loaded.baseline.runs.filter((entry) => entry.importable === true)) {
    const run = baselineRun.run;
    const runDir = resolve(repoRoot, 'evidence/canonical-v2', run);
    const receiptPath = resolve(runDir, 'run-receipt.json');
    const resolutionPath = resolve(runDir, 'resolution.json');
    const manifestPath = resolve(runDir, 'run-manifest.json');
    const sourceReferencePath = resolve(runDir, 'source-reference.json');
    const requiredPaths = { receiptPath, resolutionPath, manifestPath, sourceReferencePath };
    const missing = Object.entries(requiredPaths).filter(([, path]) => !existsSync(path)).map(([name]) => name);
    if (missing.length > 0) {
      fail('IMPORTABLE_RUN_EVIDENCE_MISSING', `${run} is importable but required evidence is missing`, { missing });
    }
    const manifest = readJson(manifestPath);
    const fromRun = populationFromRun({
      run,
      family: baselineRun.section_family,
      deal: manifest.deal,
      runReceipt: readJson(receiptPath),
      resolution: readJson(resolutionPath),
      hashes: Object.freeze({
        run_receipt_sha256: digestFile(receiptPath),
        resolution_sha256: digestFile(resolutionPath),
        run_manifest_sha256: digestFile(manifestPath),
      }),
      source_binding: sourceBinding({ repoRoot, run, sourceReferencePath }),
    });
    population.push(...fromRun.rows);
    exclusions.push(...fromRun.exclusions);
  }
  const deduplicated = deduplicatePopulation(population);
  const selected = selectSample({
    population: deduplicated,
    seed: loaded.cohort.sampling_seed,
    stratumCount: loaded.cohort.stratum_count,
    cardsPerStratum: loaded.cohort.cards_per_stratum,
  });
  const cohortId = contentId(COHORT_SCHEMA, loaded.cohort);
  const sampleBody = {
    schema_version: SAMPLE_SCHEMA,
    successor_notice: 'SUCCESSOR_SAMPLE_NOT_EXACT_REPLAY_OF_LOST_2026_08_08_SAMPLE',
    cohort_id: cohortId,
    sampling_seed: loaded.cohort.sampling_seed,
    stratum_count: loaded.cohort.stratum_count,
    cards_per_stratum: loaded.cohort.cards_per_stratum,
    cards: selected.map((row) => Object.freeze({
      card_id: row.card_id,
      deal: row.deal,
      family: row.family,
      section_reference: row.section_reference,
      source_citation: row.source_citation,
      source_text: row.source_text,
    })),
  };
  const sample = Object.freeze({ ...sampleBody, sample_id: contentId(SAMPLE_SCHEMA, sampleBody) });
  const keyBody = {
    schema_version: KEY_SCHEMA,
    successor_notice: sampleBody.successor_notice,
    cohort_id: cohortId,
    sample_id: sample.sample_id,
    population_count: deduplicated.length,
    unscoreable_exclusions: exclusions,
    cards: selected.map((row) => Object.freeze({
      card_id: row.card_id,
      source_candidate_id: row.source_candidate_id,
      stratum: row.stratum,
      stratum_population: row.stratum_population,
      old_channel: row.old_channel,
      old_reasons: row.old_reasons,
      source_run: row.source_run,
      source_hashes: row.source_hashes,
      source_binding: row.source_binding,
    })),
  };
  const key = Object.freeze({ ...keyBody, key_id: contentId(KEY_SCHEMA, keyBody) });
  return Object.freeze({ sample, key });
}

function claimOccurrenceIdFromResolved(item) {
  return item?.compiled_candidate?.candidate?.claim?.claim_occurrence_id || null;
}

function sourceEdges(claim) {
  return (claim?.evidence || []).map((edge) => ({
    document_ordinal: edge.document_ordinal,
    absolute_start: edge.absolute_start,
    absolute_end: edge.absolute_end,
    evidence_role: edge.evidence_role,
  }));
}

function containsCanonicalSubset(value, subset) {
  if (Array.isArray(subset)) return canonicalJson(value) === canonicalJson(subset);
  if (subset && typeof subset === 'object') {
    return value && typeof value === 'object' && !Array.isArray(value)
      && Object.entries(subset).every(([key, child]) => containsCanonicalSubset(value[key], child));
  }
  return value === subset;
}

function resolvedSourceCandidateId(item, runReceipt, candidateIds = null) {
  const resolvedClaim = item?.compiled_candidate?.candidate?.claim;
  const direct = claimOccurrenceIdFromResolved(item);
  const entries = (runReceipt.compiled_candidates || []).filter((entry) => (
    entry?.ok === true && entry?.candidate?.kind === 'claim'
      && (!candidateIds || candidateIds.has(entry.candidate.claim.claim_occurrence_id))
  ));
  if (entries.some((entry) => entry.candidate.claim.claim_occurrence_id === direct)) return direct;
  const resolvedEdges = sourceEdges(resolvedClaim);
  let matches = entries.filter((entry) => {
    const raw = entry.candidate.claim;
    if (entry.section_reference !== item.section_reference
      || raw.claim_definition_key !== item.generic_claim_key
      || typeof raw.raw_value !== 'string'
      || typeof resolvedClaim?.raw_value !== 'string'
      || !raw.raw_value.includes(resolvedClaim.raw_value)
      || resolvedEdges.length === 0) return false;
    const rawEdges = sourceEdges(raw);
    return resolvedEdges.every((resolvedEdge) => rawEdges.some((rawEdge) => (
      rawEdge.document_ordinal === resolvedEdge.document_ordinal
      && rawEdge.evidence_role === resolvedEdge.evidence_role
      && rawEdge.absolute_start <= resolvedEdge.absolute_start
      && rawEdge.absolute_end >= resolvedEdge.absolute_end
    )));
  });
  if (matches.length > 1) {
    const exactSourceMatches = matches.filter((entry) => (
      entry.candidate.claim.raw_value === resolvedClaim.raw_value
      && canonicalJson(sourceEdges(entry.candidate.claim)) === canonicalJson(resolvedEdges)
    ));
    if (exactSourceMatches.length > 0) matches = exactSourceMatches;
  }
  if (matches.length > 1) {
    const attributeMatches = matches.filter((entry) => {
      const { section_reference: _sourceSectionReference, ...sourceAttributes } = entry.candidate.claim.attributes || {};
      return containsCanonicalSubset(resolvedClaim?.attributes || {}, sourceAttributes);
    });
    if (attributeMatches.length > 0) matches = attributeMatches;
  }
  if (matches.length > 1 && Number.isInteger(resolvedClaim?.ordinal)) {
    const ordinalMatches = matches.filter((entry) => entry.candidate.claim.ordinal === resolvedClaim.ordinal);
    if (ordinalMatches.length > 0) matches = ordinalMatches;
  }
  if (candidateIds && matches.length === 0) return null;
  if (matches.length !== 1) {
    fail('CURRENT_RESOLVED_LINEAGE_AMBIGUOUS', 'a resolved claim does not map to exactly one source candidate', {
      claim_occurrence_id: direct,
      section_reference: item?.section_reference || null,
      generic_claim_key: item?.generic_claim_key || null,
      match_count: matches.length,
    });
  }
  return matches[0].candidate.claim.claim_occurrence_id;
}

function indexCurrentOutcomes({ runReceipt, resolution, candidateIds = null }) {
  const observations = new Map();
  const add = (id, channel, reasons = []) => {
    if (typeof id !== 'string') return;
    if (candidateIds && !candidateIds.has(id)) return;
    if (!observations.has(id)) observations.set(id, new Map());
    const channels = observations.get(id);
    if (!channels.has(channel)) channels.set(channel, new Set());
    for (const reason of reasons) channels.get(channel).add(reason);
  };
  for (const item of resolution.resolved || []) {
    add(resolvedSourceCandidateId(item, runReceipt, candidateIds), 'RESOLVED');
  }
  for (const item of resolution.review_queue || []) {
    if (item.has_resolution === false) add(rawCandidateId(item, runReceipt), 'REVIEW', [...new Set(item.reasons || [])].sort());
  }
  for (const item of resolution.open_world || []) add(rawCandidateId(item, runReceipt), 'OPEN_WORLD', [item.reason || item.claim_definition_key]);
  for (const item of resolution.residuals || []) {
    const ids = Object.entries(item)
      .filter(([key, value]) => key.endsWith('claim_occurrence_id') && typeof value === 'string')
      .map(([, value]) => value);
    for (const id of ids) add(id, 'RESIDUAL', [item.residual_type || 'RESIDUAL']);
  }
  const outcomes = new Map();
  const priority = ['RESIDUAL', 'REVIEW', 'OPEN_WORLD', 'RESOLVED'];
  for (const [id, channels] of observations) {
    const observedChannels = priority.filter((channel) => channels.has(channel));
    const channel = observedChannels[0];
    outcomes.set(id, Object.freeze({
      channel,
      reasons: [...channels.get(channel)].sort(),
      observed_channels: Object.freeze(observedChannels),
    }));
  }
  return outcomes;
}

function verifyRunHashes(repoRoot, card) {
  const runDir = resolve(repoRoot, 'evidence/canonical-v2', card.source_run);
  const paths = {
    run_receipt_sha256: resolve(runDir, 'run-receipt.json'),
    resolution_sha256: resolve(runDir, 'resolution.json'),
    run_manifest_sha256: resolve(runDir, 'run-manifest.json'),
  };
  for (const [key, path] of Object.entries(paths)) {
    if (!existsSync(path) || digestFile(path) !== card.source_hashes[key]) {
      fail('SOURCE_RUN_DIGEST_MISMATCH', `${card.source_run} no longer matches the frozen key`, { key });
    }
  }
  const sourceReferencePath = resolve(runDir, 'source-reference.json');
  if (!existsSync(sourceReferencePath)
    || digestFile(sourceReferencePath) !== card.source_binding?.source_reference_sha256) {
    fail('SOURCE_RUN_DIGEST_MISMATCH', `${card.source_run} source-reference.json no longer matches the frozen key`, {
      key: 'source_reference_sha256',
    });
  }
  const sourceReference = readJson(sourceReferencePath);
  const referencedPath = sourceReference.admitted_source_capture_inputs?.source_map_payload_path || null;
  const referencedSha = sourceReference.admitted_source_capture_inputs?.source_map_compressed_sha256 || null;
  const frozenPayload = card.source_binding?.source_map_payload || null;
  if ((frozenPayload?.path || null) !== referencedPath || (frozenPayload?.sha256 || null) !== referencedSha) {
    fail('SOURCE_MAP_BINDING_MISMATCH', `${card.source_run} source-map path or digest differs from the frozen key`);
  }
  return runDir;
}

async function resolveSourceRun({ repoRoot, sourceRun, runner, resolverModule = DEFAULT_RESOLVER_MODULE }) {
  const runDir = resolve(repoRoot, 'evidence/canonical-v2', sourceRun);
  const manifest = readJson(resolve(runDir, 'run-manifest.json'));
  const sourceReference = readJson(resolve(runDir, 'source-reference.json'));
  const runReceipt = readJson(resolve(runDir, 'run-receipt.json'));
  const dealPin = runner.DEAL_PINS[manifest.deal];
  if (!dealPin) fail('SOURCE_DEAL_UNPINNED', `${manifest.deal} is not in DEAL_PINS`);
  const locallyVerified = runner.loadAndVerifySource({
    dealPin,
    deal: manifest.deal,
    rawHtmlPath: sourceReference.reused_committed_raw_html,
  });
  let verified = locallyVerified;
  let recordedSourceMapProvenance = null;
  const captureInputs = sourceReference.admitted_source_capture_inputs;
  if (captureInputs?.source_map_payload_path || captureInputs?.source_map_compressed_sha256) {
    assertRecordedSourceMapProvenance(captureInputs, locallyVerified.conversion.canonical_text_id);
    const payloadBytes = readSourceMapPayload({
      repoRoot,
      canonicalTextId: locallyVerified.conversion.canonical_text_id,
    });
    const actual = sha256Hex(payloadBytes);
    if (actual !== captureInputs.source_map_compressed_sha256) {
      fail('SOURCE_MAP_PAYLOAD_DIGEST_MISMATCH', `${sourceRun} names different compressed bytes`);
    }
    const adopted = runner.adoptStoredSourceMapPayload({ verified: locallyVerified, payloadBytes });
    verified = adopted.verified;
    recordedSourceMapProvenance = {
      source_map_payload_path: captureInputs.source_map_payload_path,
      source_map_compressed_sha256: adopted.sourceMapCompressedSha256,
    };
  }
  const { admittedSourceContext } = runner.buildAdmittedContext({
    deal: manifest.deal,
    family: manifest.section_family,
    dealPin,
    verified,
    locallyValidatedConversion: recordedSourceMapProvenance ? locallyVerified.conversion : null,
    recordedSourceMapProvenance,
  });
  const contract = resolverModule.compileContract();
  const plain = resolverModule.resolveCandidates({
    run_receipt: runReceipt,
    contract_vocabulary: contract,
    admitted_source_context: admittedSourceContext,
    agreement_date: manifest.agreement_date,
  });
  const lexical = {};
  for (const section of runReceipt.resolved_sections || []) {
    lexical[section.section_reference] = resolverModule.buildLexicalDisagreementReceipt({
      governed_section: {
        section_ref: section.section_reference,
        text: utf8Slice(verified.conversion.canonical_text, section.start, section.end),
        text_sha256: section.text_sha256,
      },
      candidates: resolverModule.computeSectionCandidatesForLexicalDigest(
        plain.resolved, section.section_reference,
      ),
    });
  }
  const resolution = resolverModule.resolveCandidates({
    run_receipt: runReceipt,
    contract_vocabulary: contract,
    admitted_source_context: admittedSourceContext,
    agreement_date: manifest.agreement_date,
    lexical_disagreement: lexical,
  });
  return { runReceipt, resolution };
}

async function scoreBlindSuccessor({
  repoRoot = DEFAULT_ROOT, cohortPath, key, runnerModule = null, resolverModule = DEFAULT_RESOLVER_MODULE,
}) {
  const loaded = loadCohort({ repoRoot, cohortPath });
  if (!key || key.schema_version !== KEY_SCHEMA || !Array.isArray(key.cards)
    || key.cohort_id !== contentId(COHORT_SCHEMA, loaded.cohort)) {
    fail('SCORE_KEY_INVALID', 'the key is absent, malformed, or bound to another cohort');
  }
  const expectedKey = buildBlindSuccessorSample({ repoRoot, cohortPath }).key;
  if (canonicalJson(key) !== canonicalJson(expectedKey)) {
    fail('SCORE_KEY_NOT_FROZEN', 'the scoring key differs from the deterministic cohort key');
  }
  const runner = runnerModule || await import(pathToFileURL(resolve(repoRoot, 'scripts/canonical-v2-live-extraction-run.mjs')));
  const byRun = new Map();
  for (const card of key.cards) verifyRunHashes(repoRoot, card);
  const sourceRuns = [...new Set(key.cards.map((card) => card.source_run))].sort();
  for (let offset = 0; offset < sourceRuns.length; offset += SOURCE_RUN_CONCURRENCY) {
    const batch = sourceRuns.slice(offset, offset + SOURCE_RUN_CONCURRENCY);
    const resolvedRuns = await Promise.all(batch.map(async (run) => [
      run, await resolveSourceRun({ repoRoot, sourceRun: run, runner, resolverModule }),
    ]));
    for (const [run, resolvedRun] of resolvedRuns) byRun.set(run, resolvedRun);
  }
  const outcomesByRun = new Map();
  for (const [run, resolvedRun] of byRun) {
    try {
      const candidateIds = new Set(key.cards
        .filter((card) => card.source_run === run)
        .map((card) => card.source_candidate_id));
      outcomesByRun.set(run, indexCurrentOutcomes({ ...resolvedRun, candidateIds }));
    } catch (error) {
      if (error instanceof BlindSuccessorError) {
        error.message = `${error.message} [source_run=${run}]`;
        error.details = { ...error.details, source_run: run };
      }
      throw error;
    }
  }
  const results = key.cards.map((card) => {
    const current = outcomesByRun.get(card.source_run).get(card.source_candidate_id);
    if (!current) {
      fail('CURRENT_OUTCOME_MISSING', `sampled card ${card.card_id} from ${card.source_run} has no current resolver disposition`, {
        card_id: card.card_id, source_candidate_id: card.source_candidate_id, source_run: card.source_run,
      });
    }
    return Object.freeze({
      card_id: card.card_id,
      source_candidate_id: card.source_candidate_id,
      stratum: card.stratum,
      old_channel: card.old_channel,
      current_channel: current.channel,
      current_reasons: current.reasons,
      current_observed_channels: current.observed_channels,
    });
  });
  const resolved = results.filter((row) => row.current_channel === 'RESOLVED');
  const named = Object.fromEntries(Object.entries(HISTORICAL_REFERENCE.named_stratum_floors).map(([stratum, floor]) => {
    const current = resolved.filter((row) => row.stratum === stratum).length;
    return [stratum, { current_resolved: current, historical_reference_floor: floor, pass: current >= floor }];
  }));
  const acceptance = {
    exact_replay_claimed: false,
    all_cards_accounted: results.length === loaded.cohort.stratum_count * loaded.cohort.cards_per_stratum,
    total_resolved_floor: { current: resolved.length, floor: HISTORICAL_REFERENCE.total_resolved, pass: resolved.length >= HISTORICAL_REFERENCE.total_resolved },
    named_stratum_floors: named,
    unnamed_historical_strata_exact_comparison: {
      available: false,
      gate_applied: false,
      reason: 'EXACT_STRATUM_IDENTITIES_AND_CARD_MEMBERSHIP_LOST',
    },
  };
  acceptance.accepted = acceptance.all_cards_accounted
    && acceptance.total_resolved_floor.pass
    && Object.values(named).every((entry) => entry.pass);
  const body = {
    schema_version: SCORE_SCHEMA,
    successor_notice: 'SUCCESSOR_SCORE_NOT_EXACT_REPLAY_OF_LOST_2026_08_08_SAMPLE',
    cohort_id: key.cohort_id,
    sample_id: key.sample_id,
    key_id: key.key_id,
    historical_reference: HISTORICAL_REFERENCE,
    results,
    acceptance,
  };
  return Object.freeze({ ...body, score_id: contentId(SCORE_SCHEMA, body) });
}

function parseArgs(argv) {
  const out = {
    command: argv[0], cohortPath: null, outDir: null, keyPath: null, keyOutPath: null,
  };
  for (let i = 1; i < argv.length; i += 1) {
    if (argv[i] === '--cohort') out.cohortPath = argv[++i];
    else if (argv[i] === '--out-dir') out.outDir = argv[++i];
    else if (argv[i] === '--key') out.keyPath = argv[++i];
    else if (argv[i] === '--key-out') out.keyOutPath = argv[++i];
    else fail('ARGUMENT_UNKNOWN', `unknown argument ${argv[i]}`);
  }
  if (!['sample', 'score'].includes(out.command) || !out.cohortPath || !out.outDir
    || (out.command === 'sample' && !out.keyOutPath)
    || (out.command === 'score' && !out.keyPath)) {
    fail('USAGE', 'sample --cohort <json> --out-dir <public-dir> --key-out <private-json> | score --cohort <json> --key <json> --out-dir <dir>');
  }
  return out;
}

function assertSeparateKeyOutput({ sampleOutDir, keyOutPath }) {
  const realSampleOutDir = realpathSync(sampleOutDir);
  const realKeyParent = realpathSync(dirname(keyOutPath));
  const effectiveKeyPath = resolve(realKeyParent, basename(keyOutPath));
  const fromSampleDirectory = relative(realSampleOutDir, effectiveKeyPath);
  if (fromSampleDirectory === ''
    || (fromSampleDirectory !== '..' && !fromSampleDirectory.startsWith(`..${sep}`))) {
    fail('KEY_OUTPUT_NOT_SEPARATE', 'the key output must be outside the public sample directory');
  }
  try {
    lstatSync(keyOutPath);
    fail('KEY_OUTPUT_ALREADY_EXISTS', 'the private key output must be a new file');
  } catch (error) {
    if (error instanceof BlindSuccessorError || error.code !== 'ENOENT') throw error;
  }
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const outDir = resolve(DEFAULT_ROOT, args.outDir);
  if (args.command === 'sample') {
    const keyOutPath = resolve(DEFAULT_ROOT, args.keyOutPath);
    mkdirSync(outDir, { recursive: true });
    mkdirSync(dirname(keyOutPath), { recursive: true });
    assertSeparateKeyOutput({ sampleOutDir: outDir, keyOutPath });
    const { sample, key } = buildBlindSuccessorSample({ cohortPath: args.cohortPath });
    writeFileSync(resolve(outDir, 'sample.json'), `${JSON.stringify(sample, null, 2)}\n`);
    writeFileSync(keyOutPath, `${JSON.stringify(key, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    process.stdout.write(`${sample.sample_id} ${key.key_id}\n`);
    return;
  }
  mkdirSync(outDir, { recursive: true });
  const key = readJson(resolve(DEFAULT_ROOT, args.keyPath));
  const score = await scoreBlindSuccessor({ cohortPath: args.cohortPath, key });
  writeFileSync(resolve(outDir, 'score.json'), `${JSON.stringify(score, null, 2)}\n`);
  process.stdout.write(`${score.score_id} accepted=${score.acceptance.accepted}\n`);
}

const isMain = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) main().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});

export {
  BlindSuccessorError,
  COHORT_SCHEMA,
  KEY_SCHEMA,
  SAMPLE_SCHEMA,
  SCORE_SCHEMA,
  buildBlindSuccessorSample,
  deduplicatePopulation,
  indexCurrentOutcomes,
  loadCohort,
  populationFromRun,
  scoreBlindSuccessor,
  selectSample,
};
