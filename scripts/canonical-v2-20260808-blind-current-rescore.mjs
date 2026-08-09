#!/usr/bin/env node
/**
 * Deterministically re-score the recovered 2026-08-08 96-card blind sample.
 *
 * Matching is normalised exact-first. Fallback matching is recorded in the
 * trace and is used only when exact matching finds no historical candidate.
 * Replays use committed receipts with the current resolver and make no model
 * calls. The public score is deliberately just the 96-row join result.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  resolveSourceRun,
} from './canonical-v2-step-2x-k-blind-successor.mjs';
import {
  validateStage2yLArtifact,
} from './stage-2y-l-live-batch.mjs';

const require = createRequire(import.meta.url);
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(SCRIPT_DIR, '..');
const { canonicalJson, utf8ByteLength } = require('../lib/canonical-v2/canonical-bytes');
const { normaliseForMatching } = require('../lib/canonical-v2/zero-width-normalise');

const SAMPLE_PATH = 'evidence/blind-review/2026-08-08/blind-sample.json';
const KEY_PATH = 'evidence/blind-review/2026-08-08/blind-key.json';
const BASELINE_SCORE_PATH = 'evidence/blind-review/2026-08-08/blind-rescore.json';
const SUCCESSOR_SCORE_PATH = 'evidence/canonical-v2/step-2x-k-blind-successor-20260809/score/score.json';
const OUTPUT_PATH = 'evidence/blind-review/2026-08-08/blind-current-rescore.json';
const TRACE_PATH = 'evidence/blind-review/2026-08-08/blind-current-rescore-trace.json';
const STAGE_2Y_L_BATCH_PATH = 'evidence/canonical-v2/stage-2y-l-live-batch.json';
const SAMPLE_CUTOFF = '2026-08-08T23:59:59.999Z';
const OUTPUT_KEYS = Object.freeze(['id', 'deal', 'family', 'orig_reason', 'now', 'source']);
const SAMPLE_CARD_KEYS = Object.freeze(['deal', 'family', 'section', 'quote', 'claim_key', 'id']);
const KEY_CARD_KEYS = Object.freeze([...SAMPLE_CARD_KEYS, '_reason']);
const RESERVED_DISPOSITION_CODES = new Set(['NOT_LOCATED_IN_OUTPUT', 'ARTIFACT_MISSING']);
const AUTHORISED_STRATUM_BASELINE = Object.freeze({
  TERMINATING_PARTY_REF_NOT_IN_QUOTE: 7,
  ASSERTION_KIND_UNCORROBORATED: 0,
  QUALIFIER_KIND_UNCLASSIFIED: 4,
  CATEGORY_UNCORROBORATED: 4,
  CONDITION_KIND_UNCORROBORATED: 0,
  NO_SHOP_PREREQUISITE_UNCORROBORATED: 0,
  IOC_PARENT_ATTACHMENT_SCOPE_UNCORROBORATED: 0,
  CLAUSE_LABEL_NOT_IN_QUOTE: 6,
  PARTY_UNRESOLVED: 0,
  IOC_ATTACHMENT_TARGET_QUOTE_MISSING: 0,
  PROXY_MEETING_KIND_UNCORROBORATED: 0,
  DNO_KIND_UNCORROBORATED: 0,
});

const SHARED_RESOLVER_PATH = 'lib/canonical-v2/native-producer/candidate-resolution.js';

// This manifest is the audit record for source selection. Closing and
// financing have post-change Stage 2Y-L recordings whose committed resolver
// output is current. Proxy uses the same new recording, but replays it because
// its resolver changed after the recording. The other families replay the
// original receipts through their changed resolver paths.
const FAMILY_SOURCE_MANIFEST = Object.freeze({
  TERMINATION: Object.freeze({ source: 'replay', resolver_paths: Object.freeze([SHARED_RESOLVER_PATH]), reason: 'TERMINATION_RESOLVER_CHANGED_AFTER_SAMPLE' }),
  REPRESENTATIONS: Object.freeze({ source: 'replay', resolver_paths: Object.freeze([SHARED_RESOLVER_PATH, 'lib/canonical-v2/native-producer/same-deal-defined-term-resolution.js']), reason: 'REPRESENTATIONS_RESOLVER_CHANGED_AFTER_SAMPLE' }),
  INTERIM_OPERATING: Object.freeze({ source: 'replay', resolver_paths: Object.freeze([SHARED_RESOLVER_PATH, 'lib/canonical-v2/native-producer/corroboration-ladder.js']), reason: 'INTERIM_OPERATING_RESOLVER_CHANGED_AFTER_SAMPLE' }),
  MAE_DEFINITION: Object.freeze({ source: 'replay', resolver_paths: Object.freeze([SHARED_RESOLVER_PATH, 'lib/canonical-v2/native-producer/duplicate-suppression.js']), reason: 'MAE_RESOLVER_CHANGED_AFTER_SAMPLE' }),
  DNO_INDEMNIFICATION: Object.freeze({ source: 'replay', resolver_paths: Object.freeze([SHARED_RESOLVER_PATH, 'lib/normalize-numeric.js']), reason: 'DNO_NUMERAL_RESOLVER_CHANGED_AFTER_SAMPLE' }),
  FINANCING_COVENANTS: Object.freeze({ source: 'committed', current_batch_path: STAGE_2Y_L_BATCH_PATH, reason: 'STAGE_2Y_L_POST_CHANGE_RECORDING_IS_CURRENT' }),
  CLOSING_CONDITIONS: Object.freeze({ source: 'committed', current_batch_path: STAGE_2Y_L_BATCH_PATH, reason: 'STAGE_2Y_L_POST_CHANGE_RECORDING_IS_CURRENT' }),
  NO_SHOP: Object.freeze({ source: 'replay', resolver_paths: Object.freeze([SHARED_RESOLVER_PATH]), reason: 'NO_SHOP_RESOLVER_CHANGED_AFTER_SAMPLE' }),
  PROXY_MEETING: Object.freeze({ source: 'replay', resolver_paths: Object.freeze([SHARED_RESOLVER_PATH]), current_batch_path: STAGE_2Y_L_BATCH_PATH, reason: 'PROXY_RESOLVER_CHANGED_AFTER_STAGE_2Y_L_RECORDING' }),
});

class CurrentBlindRescoreError extends Error {
  constructor(code, message, details = {}) {
    super(`${code}: ${message}`);
    this.name = 'CurrentBlindRescoreError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new CurrentBlindRescoreError(code, message, details);
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

function assertOriginalSampleJoin(sample, key) {
  if (!Array.isArray(sample) || !Array.isArray(key) || sample.length !== 96 || key.length !== 96) {
    fail('ORIGINAL_SAMPLE_CARD_COUNT_INVALID', 'sample and key must each contain exactly 96 cards');
  }
  const sampleById = new Map();
  const keyById = new Map();
  for (const card of sample) {
    if (!exactKeys(card, SAMPLE_CARD_KEYS) || typeof card.id !== 'string' || sampleById.has(card.id)) {
      fail('ORIGINAL_SAMPLE_SCHEMA_INVALID', 'every sample card must have the exact public card schema and unique id', { id: card?.id });
    }
    sampleById.set(card.id, card);
  }
  for (const card of key) {
    if (!exactKeys(card, KEY_CARD_KEYS) || typeof card.id !== 'string' || keyById.has(card.id)
      || typeof card._reason !== 'string' || card._reason.length === 0) {
      fail('ORIGINAL_KEY_SCHEMA_INVALID', 'every key card must have the exact keyed card schema, reason, and unique id', { id: card?.id });
    }
    keyById.set(card.id, card);
  }
  if (sampleById.size !== 96 || keyById.size !== 96
    || [...sampleById.keys()].some((id) => !keyById.has(id))) {
    fail('ORIGINAL_SAMPLE_ID_JOIN_INVALID', 'sample and key must join exactly on 96 IDs');
  }
  for (const [id, card] of sampleById) {
    const keyed = keyById.get(id);
    for (const field of SAMPLE_CARD_KEYS) {
      if (card[field] !== keyed[field]) {
        fail('ORIGINAL_SAMPLE_KEY_CONTENT_MISMATCH', 'sample and key cards must agree on every non-blind field', { id, field });
      }
    }
  }
  return Object.freeze({ sampleById, keyById });
}

function assertStrata(key) {
  const strata = Map.groupBy(key, (card) => card._reason);
  if (strata.size !== 12 || [...strata.values()].some((cards) => cards.length !== 8)) {
    fail('ORIGINAL_SAMPLE_STRATA_INVALID', 'the original sample must retain twelve strata of eight cards');
  }
  return strata;
}

function assertAuthorisedBaseline({ baseline, sample, key }) {
  assertOutput(baseline, sample, key);
  const strata = assertStrata(key);
  const authorisedReasons = Object.keys(AUTHORISED_STRATUM_BASELINE).sort();
  const actualReasons = [...strata.keys()].sort();
  if (canonicalJson(actualReasons) !== canonicalJson(authorisedReasons)) {
    fail('AUTHORISED_BASELINE_STRATA_MISMATCH', 'the original key does not have the authorised twelve reason strata');
  }
  const baselineById = new Map(baseline.map((row) => [row.id, row]));
  for (const [reason, cards] of strata) {
    const resolved = cards.filter((card) => baselineById.get(card.id).now.startsWith('RESOLVED ')).length;
    if (resolved !== AUTHORISED_STRATUM_BASELINE[reason]) {
      fail('AUTHORISED_BASELINE_FLOOR_MISMATCH', 'blind-rescore.json does not match the authorised original floor', {
        reason, expected: AUTHORISED_STRATUM_BASELINE[reason], actual: resolved,
      });
    }
  }
  return strata;
}

function sourceModeForFamily(family) {
  const mode = FAMILY_SOURCE_MANIFEST[family];
  if (!mode) fail('FAMILY_SOURCE_MODE_MISSING', 'every sample family must have an explicit source mode', { family });
  if (!['replay', 'committed'].includes(mode.source) || typeof mode.reason !== 'string' || mode.reason.length === 0) {
    fail('FAMILY_SOURCE_MANIFEST_INVALID', 'every source manifest entry needs a governed source and audit reason', { family });
  }
  if (mode.source === 'replay' && (!Array.isArray(mode.resolver_paths) || mode.resolver_paths.length === 0)) {
    fail('FAMILY_SOURCE_MANIFEST_INVALID', 'a replay family must name its changed resolver path', { family });
  }
  if (mode.source === 'committed'
    && typeof mode.current_score_path !== 'string'
    && typeof mode.current_batch_path !== 'string') {
    fail('CURRENT_COMMITTED_EVIDENCE_REQUIRED', 'a committed family must name a current score artefact or current batch', { family });
  }
  return mode;
}

function currentBatchRuns({ repoRoot = DEFAULT_ROOT, batchPath = STAGE_2Y_L_BATCH_PATH }) {
  const batch = readJson(resolve(repoRoot, batchPath));
  const validation = validateStage2yLArtifact({ artifact: batch });
  if (!validation.ok) {
    fail('CURRENT_BATCH_INVALID', 'current batch is not the sealed authorised Stage 2Y-L batch', {
      batch_path: batchPath,
      errors: validation.errors,
    });
  }
  const complete = new Set((batch.calls || [])
    .filter((call) => call.state === 'COMPLETE')
    .map((call) => call.call_id));
  const runs = new Map();
  for (const call of batch.call_manifest || []) {
    if (!complete.has(call.call_id)) continue;
    const key = canonicalJson([call.deal, call.family, String(call.section_reference)]);
    if (runs.has(key)) {
      fail('CURRENT_BATCH_RUN_AMBIGUOUS', 'current batch has duplicate deal-family-section calls', {
        deal: call.deal, family: call.family, section: call.section_reference,
      });
    }
    runs.set(key, `stage-2y-l-live-runs/${call.call_id}`);
  }
  return runs;
}

function currentBatchCandidate({ repoRoot, card, sourceMode, batchCache }) {
  const batchPath = sourceMode.current_batch_path;
  if (!batchCache.has(batchPath)) {
    batchCache.set(batchPath, currentBatchRuns({ repoRoot, batchPath }));
  }
  const sourceRun = batchCache.get(batchPath).get(canonicalJson([
    card.deal, card.family, String(card.section),
  ]));
  if (!sourceRun) return null;
  const runDir = resolve(repoRoot, 'evidence/canonical-v2', sourceRun);
  const required = sourceMode.source === 'committed'
    ? ['run-receipt.json', 'resolution.json']
    : ['run-manifest.json', 'run-receipt.json', 'source-reference.json'];
  return Object.freeze({
    source_run: sourceRun,
    deal: card.deal,
    family: card.family,
    section: card.section,
    claim_key: card.claim_key,
    raw_value: card.quote,
    orig_reasons: Object.freeze([card._reason]),
    candidate_id: `${sourceRun}:${card.id}`,
    replayable: required.every((name) => existsSync(resolve(runDir, name))),
  });
}

async function readCommittedRun({ repoRoot, sourceRun }) {
  const runDir = resolve(repoRoot, 'evidence/canonical-v2', sourceRun);
  return Object.freeze({
    runReceipt: readJson(resolve(runDir, 'run-receipt.json')),
    resolution: readJson(resolve(runDir, 'resolution.json')),
  });
}

function normalise(value) {
  if (typeof value !== 'string') return null;
  const output = normaliseForMatching(value).normalize('NFKC').replace(/\s+/gu, ' ').trim();
  // Keep every comparison on a canonical UTF-8 boundary. This scorer never
  // uses UTF-16 indices or slices for an evidence match.
  utf8ByteLength(output);
  return output;
}

function exactKey(value) {
  return canonicalJson([
    normalise(value.deal), normalise(value.family), normalise(String(value.section)),
    normalise(value.quote), normalise(value.claim_key),
  ]);
}

function fallbackMatch(card, candidate) {
  if (normalise(card.deal) !== normalise(candidate.deal)
    || normalise(card.family) !== normalise(candidate.family)
    || normalise(String(card.section)) !== normalise(String(candidate.section))
    || normalise(card.claim_key) !== normalise(candidate.claim_key)) return false;
  const cardQuote = normalise(card.quote);
  const candidateQuote = normalise(candidate.raw_value);
  return cardQuote.length > 0 && candidateQuote.length > 0
    && (candidateQuote.includes(cardQuote) || cardQuote.includes(candidateQuote));
}

function eligibleRunName(name) {
  return !name.includes('20260809-2xk-final')
    && !name.startsWith('step-2x-k-blind-successor-');
}

function historicalCandidates({ repoRoot = DEFAULT_ROOT }) {
  const evidenceRoot = resolve(repoRoot, 'evidence/canonical-v2');
  const candidates = [];
  const dealFamilyRuns = new Set();
  for (const run of readdirSync(evidenceRoot).sort()) {
    if (!eligibleRunName(run)) continue;
    const runDir = resolve(evidenceRoot, run);
    const manifestPath = resolve(runDir, 'run-manifest.json');
    const receiptPath = resolve(runDir, 'run-receipt.json');
    const resolutionPath = resolve(runDir, 'resolution.json');
    if (!existsSync(manifestPath)) continue;
    const manifest = readJson(manifestPath);
    if (typeof manifest.run_started_at !== 'string' || manifest.run_started_at > SAMPLE_CUTOFF) continue;
    if (typeof manifest.deal !== 'string' || typeof manifest.section_family !== 'string') continue;
    dealFamilyRuns.add(canonicalJson([manifest.deal, manifest.section_family]));
    if (!existsSync(resolutionPath)) continue;
    const resolution = readJson(resolutionPath);
    const replayable = [receiptPath, resolve(runDir, 'source-reference.json')].every(existsSync);
    for (const [sourceIndex, item] of (resolution.review_queue || []).entries()) {
      if (item.has_resolution !== false) continue;
      const rawValue = [item.raw_value, item.normalised_phrase, item.canonical_value]
        .find((value) => typeof value === 'string' && value.length > 0);
      if (!rawValue) continue;
      const candidate = Object.freeze({
        source_run: run,
        deal: manifest.deal,
        family: manifest.section_family,
        section: item.section_reference,
        claim_key: item.generic_claim_key,
        raw_value: rawValue,
        orig_reasons: Object.freeze([...(item.reasons || [])].sort()),
        candidate_id: `${run}:review_queue:${sourceIndex}`,
        replayable,
      });
      candidates.push(candidate);
    }
  }
  return Object.freeze({ candidates: Object.freeze(candidates), dealFamilyRuns });
}

function matchCard(card, candidates) {
  const exact = candidates.filter((candidate) => exactKey(card) === canonicalJson([
    normalise(candidate.deal), normalise(candidate.family), normalise(String(candidate.section)),
    normalise(candidate.raw_value), normalise(candidate.claim_key),
  ]) && (!card._reason || candidate.orig_reasons.includes(card._reason)));
  if (exact.length > 0) return Object.freeze({ method: 'exact', candidates: exact });
  const fallback = candidates.filter((candidate) => fallbackMatch(card, candidate)
    && (!card._reason || candidate.orig_reasons.includes(card._reason)));
  return Object.freeze({ method: fallback.length > 0 ? 'fallback' : 'not_located', candidates: fallback });
}

function outcomeText(outcome) {
  if (!outcome || outcome.channel === 'RESIDUAL') return 'NOT_LOCATED_IN_OUTPUT';
  if (outcome.channel === 'RESOLVED') {
    const kind = outcome.reasons[0];
    if (typeof kind !== 'string' || kind.length === 0) fail('RESOLVED_KIND_MISSING', 'resolved output has no claim kind');
    return `RESOLVED [${kind}]`;
  }
  if (outcome.channel === 'REVIEW') {
    if (outcome.reasons.length !== 1) fail('REVIEW_REASON_AMBIGUOUS', 'review output must have exactly one reason code', { reasons: outcome.reasons });
    return `REVIEW:${outcome.reasons[0]}`;
  }
  if (outcome.channel === 'OPEN_WORLD') {
    if (outcome.reasons.length !== 1) fail('OPEN_WORLD_KIND_AMBIGUOUS', 'open-world output must have exactly one proposal kind', { reasons: outcome.reasons });
    return `OPEN_WORLD:${outcome.reasons[0]}`;
  }
  fail('CURRENT_OUTPUT_CHANNEL_UNKNOWN', 'current resolver returned an unsupported channel', { channel: outcome.channel });
}

function currentOutputCandidates(replay) {
  const rows = [];
  const add = ({ section, claimKey, rawValues, now }) => {
    for (const rawValue of rawValues) {
      if (typeof rawValue !== 'string' || rawValue.length === 0) continue;
      rows.push(Object.freeze({ section, claim_key: claimKey, raw_value: rawValue, now }));
    }
  };
  for (const item of replay.resolution.resolved || []) {
    const kind = item.resolved_claim_definition_key || item.claim?.claim_definition_key;
    if (typeof kind !== 'string' || kind.length === 0) {
      fail('RESOLVED_KIND_MISSING', 'resolved output has no claim kind');
    }
    add({
      section: item.section_reference,
      claimKey: item.generic_claim_key,
      rawValues: [item.claim?.raw_value, item.normalised_phrase, item.compiled_candidate?.candidate?.claim?.raw_value],
      now: `RESOLVED [${kind}]`,
    });
  }
  for (const item of replay.resolution.review_queue || []) {
    if (item.has_resolution !== false) continue;
    const reasons = [...new Set(item.reasons || [])];
    if (reasons.length === 0) fail('REVIEW_REASON_MISSING', 'held output has no reason code');
    add({
      section: item.section_reference,
      claimKey: item.generic_claim_key,
      rawValues: [item.raw_value, item.normalised_phrase, item.canonical_value],
      now: `REVIEW:${reasons[0]}`,
    });
  }
  for (const item of replay.resolution.open_world || []) {
    const kind = item.reason || item.claim_definition_key;
    if (typeof kind !== 'string' || kind.length === 0) {
      fail('OPEN_WORLD_KIND_MISSING', 'open-world output has no proposal kind');
    }
    add({
      section: item.section_reference,
      claimKey: item.claim_definition_key,
      rawValues: [item.raw_value, item.normalised_phrase, item.canonical_value],
      now: `OPEN_WORLD:${kind}`,
    });
  }
  return rows;
}

function matchCurrentOutput(card, outputs) {
  const sameIdentity = (candidate) => normalise(String(card.section)) === normalise(String(candidate.section))
    && normalise(card.claim_key) === normalise(candidate.claim_key);
  const exact = outputs.filter((candidate) => sameIdentity(candidate)
    && normalise(card.quote) === normalise(candidate.raw_value));
  if (exact.length > 0) return Object.freeze({ method: 'exact', candidates: exact });
  const quote = normalise(card.quote);
  const fallback = outputs.filter((candidate) => {
    if (!sameIdentity(candidate)) return false;
    const value = normalise(candidate.raw_value);
    return quote.length > 0 && value.length > 0 && (quote.includes(value) || value.includes(quote));
  });
  return Object.freeze({ method: fallback.length > 0 ? 'fallback' : 'not_located', candidates: fallback });
}

async function resolveMatches({ repoRoot, card, matched, resolveRun = resolveSourceRun }) {
  const usable = matched.filter((candidate) => candidate.replayable);
  if (usable.length === 0) return Object.freeze({ now: 'ARTIFACT_MISSING', observations: [] });
  const byRun = Map.groupBy(usable, (candidate) => candidate.source_run);
  const observations = [];
  for (const run of [...byRun.keys()].sort()) {
    try {
      const replay = await resolveRun({ repoRoot, sourceRun: run });
      const outputMatch = matchCurrentOutput(card, currentOutputCandidates(replay));
      const runDispositions = [...new Set(outputMatch.candidates.map((candidate) => candidate.now))];
      if (runDispositions.length > 0) {
        const precedence = ['RESOLVED [', 'REVIEW:', 'OPEN_WORLD:'];
        const selected = [...runDispositions].sort((left, right) => (
          precedence.findIndex((prefix) => left.startsWith(prefix))
          - precedence.findIndex((prefix) => right.startsWith(prefix))
        ) || left.localeCompare(right))[0];
        observations.push(Object.freeze({
          candidate: byRun.get(run)[0],
          now: selected,
          error_code: null,
          match_method: outputMatch.method,
          observed_dispositions: Object.freeze(runDispositions.sort()),
        }));
      }
    } catch (error) {
      fail('REPLAY_FAILED', `current replay failed for ${run}`, {
        cause_code: error.code || error.name,
        cause_message: error.message,
      });
    }
  }
  if (observations.length === 0) return Object.freeze({ now: 'NOT_LOCATED_IN_OUTPUT', observations });
  const exact = observations.filter((observation) => observation.match_method === 'exact');
  const current = exact.length > 0 ? exact : observations;
  const dispositions = [...new Set(current.map((observation) => observation.now))].sort();
  if (dispositions.length !== 1) {
    fail('DUPLICATE_EXACT_CURRENT_DISPOSITION_CONFLICT', 'duplicate historical matches have conflicting current dispositions', {
      dispositions,
      candidates: current.map(({ candidate, now }) => ({ source_run: candidate.source_run, candidate_id: candidate.candidate_id, now })),
    });
  }
  return Object.freeze({ now: dispositions[0], observations });
}

function familyModes(cards) {
  return [...new Set(cards.map((card) => card.family))].sort().map((family) => {
    const mode = sourceModeForFamily(family);
    return Object.freeze({
      family,
      source: mode.source,
      resolver_paths: mode.resolver_paths,
      current_score_path: mode.current_score_path || null,
      current_batch_path: mode.current_batch_path || null,
      reason: mode.reason,
    });
  });
}

function currentCommittedRows({ repoRoot, sourceMode, sample, key, baselinePath, cache }) {
  const path = sourceMode.current_score_path;
  if (typeof path !== 'string' || path.length === 0) {
    fail('CURRENT_COMMITTED_EVIDENCE_REQUIRED', 'committed mode requires a named current score artefact');
  }
  if (path === baselinePath || resolve(repoRoot, path) === resolve(repoRoot, baselinePath)) {
    fail('HISTORICAL_SCORE_REUSE_FORBIDDEN', 'committed mode may not reuse blind-rescore.json');
  }
  if (!cache.has(path)) {
    const rows = readJson(resolve(repoRoot, path));
    assertOutput(rows, sample, key);
    cache.set(path, new Map(rows.map((row) => [row.id, row])));
  }
  return cache.get(path);
}

function successorComparison({ baseline, key, successor }) {
  const baselineById = new Map(baseline.map((row) => [row.id, row]));
  const keyById = new Map(key.map((row) => [row.id, row]));
  const original = (reason) => {
    const rows = key.filter((row) => row._reason === reason);
    return Object.freeze({ cards: rows.length, resolved: rows.filter((row) => baselineById.get(row.id)?.now.startsWith('RESOLVED ')).length });
  };
  const successorRows = successor.results || [];
  const successorStratum = (reason) => {
    const rows = successorRows.filter((row) => row.stratum === `REVIEW:${reason}`);
    return Object.freeze({ cards: rows.length, resolved: rows.filter((row) => row.current_channel === 'RESOLVED').length });
  };
  return Object.freeze({
    comparison_is_invalid: true,
    reason: 'SUCCESSOR_CARD_MEMBERSHIP_DIFFERS_FROM_THE_RECOVERED_ORIGINAL_SAMPLE',
    original_ids_verified: keyById.size,
    QUALIFIER_KIND_UNCLASSIFIED: { original: original('QUALIFIER_KIND_UNCLASSIFIED'), successor: successorStratum('QUALIFIER_KIND_UNCLASSIFIED') },
    TERMINATING_PARTY_REF_NOT_IN_QUOTE: { original: original('TERMINATING_PARTY_REF_NOT_IN_QUOTE'), successor: successorStratum('TERMINATING_PARTY_REF_NOT_IN_QUOTE') },
  });
}

async function buildCurrentBlindRescore({
  repoRoot = DEFAULT_ROOT,
  samplePath = SAMPLE_PATH,
  keyPath = KEY_PATH,
  baselinePath = BASELINE_SCORE_PATH,
  successorPath = SUCCESSOR_SCORE_PATH,
  candidates = null,
  resolveRun = resolveSourceRun,
  runnerModule = null,
} = {}) {
  const sample = readJson(resolve(repoRoot, samplePath));
  const key = readJson(resolve(repoRoot, keyPath));
  const { keyById } = assertOriginalSampleJoin(sample, key);
  assertStrata(key);
  const baseline = readJson(resolve(repoRoot, baselinePath));
  assertAuthorisedBaseline({ baseline, sample, key });
  const discovered = historicalCandidates({ repoRoot });
  const inventory = candidates || discovered.candidates;
  let runner = runnerModule;
  const getRunner = async () => {
    if (!runner) runner = await import(pathToFileURL(resolve(repoRoot, 'scripts/canonical-v2-live-extraction-run.mjs')));
    return runner;
  };
  const replayCache = new Map();
  const cachedResolveRun = async (args) => {
    if (!replayCache.has(args.sourceRun)) {
      replayCache.set(args.sourceRun, getRunner().then((currentRunner) => resolveRun({ ...args, runner: currentRunner })));
    }
    return replayCache.get(args.sourceRun);
  };
  const rows = [];
  const matchTrace = [];
  const committedEvidenceCache = new Map();
  const batchCache = new Map();
  for (const card of sample) {
    const keyedCard = Object.freeze({ ...card, _reason: keyById.get(card.id)._reason });
    const sourceMode = sourceModeForFamily(card.family);
    const origReason = keyById.get(card.id)._reason;
    if (sourceMode.current_batch_path) {
      const selected = currentBatchCandidate({
        repoRoot, card: keyedCard, sourceMode, batchCache,
      });
      const resolved = selected === null
        ? { now: 'ARTIFACT_MISSING', observations: [] }
        : await resolveMatches({
          repoRoot,
          card,
          matched: [selected],
          resolveRun: sourceMode.source === 'committed' ? readCommittedRun : cachedResolveRun,
        });
      const currentMatchMethod = resolved.observations.some((observation) => observation.match_method === 'exact')
        ? 'exact'
        : resolved.observations.some((observation) => observation.match_method === 'fallback')
          ? 'fallback'
          : 'not_located';
      rows.push(Object.freeze({
        id: card.id, deal: card.deal, family: card.family,
        orig_reason: origReason, now: resolved.now, source: sourceMode.source,
      }));
      matchTrace.push(Object.freeze({
        id: card.id,
        source: sourceMode.source,
        source_selection: 'current_batch',
        match_method: currentMatchMethod,
        matched_candidates: selected === null ? [] : [{
          source_run: selected.source_run,
          candidate_id: selected.candidate_id,
          replayable: selected.replayable,
        }],
        observations: resolved.observations.map((observation) => ({
          source_run: observation.candidate.source_run,
          candidate_id: observation.candidate.candidate_id,
          now: observation.now,
          error_code: observation.error_code,
          match_method: observation.match_method,
          observed_dispositions: observation.observed_dispositions || [observation.now],
        })),
        now: resolved.now,
      }));
      continue;
    }
    if (sourceMode.source === 'committed') {
      const committed = currentCommittedRows({
        repoRoot, sourceMode, sample, key, baselinePath, cache: committedEvidenceCache,
      }).get(card.id);
      if (!committed || committed.source !== 'committed') {
        fail('CURRENT_COMMITTED_EVIDENCE_CARD_MISSING', 'current committed evidence must provide this card as committed', { id: card.id, family: card.family });
      }
      rows.push(Object.freeze({ id: card.id, deal: card.deal, family: card.family, orig_reason: origReason, now: committed.now, source: 'committed' }));
      matchTrace.push(Object.freeze({
        id: card.id,
        source: 'committed',
        source_selection: 'current_committed_evidence',
        match_method: 'current_committed_evidence',
        matched_candidates: [],
        observations: [],
        now: committed.now,
      }));
      continue;
    }
    const match = matchCard(keyedCard, inventory);
    const resolved = match.method === 'not_located'
      ? {
        now: discovered.dealFamilyRuns.has(canonicalJson([card.deal, card.family]))
          ? 'NOT_LOCATED_IN_OUTPUT' : 'ARTIFACT_MISSING',
        observations: [],
      }
      : await resolveMatches({ repoRoot, card, matched: match.candidates, resolveRun: cachedResolveRun });
    rows.push(Object.freeze({ id: card.id, deal: card.deal, family: card.family, orig_reason: origReason, now: resolved.now, source: 'replay' }));
    matchTrace.push(Object.freeze({
      id: card.id,
      source: 'replay',
      source_selection: 'original_pre_cutoff_recording',
      match_method: match.method,
      matched_candidates: match.candidates.map((candidate) => ({ source_run: candidate.source_run, candidate_id: candidate.candidate_id, replayable: candidate.replayable })),
      observations: resolved.observations.map((observation) => ({
        source_run: observation.candidate.source_run,
        candidate_id: observation.candidate.candidate_id,
        now: observation.now,
        error_code: observation.error_code,
        match_method: observation.match_method,
        observed_dispositions: observation.observed_dispositions || [observation.now],
      })),
      now: resolved.now,
    }));
  }
  assertOutput(rows, sample, key);
  const trace = Object.freeze({
    schema_version: 'BLIND_CURRENT_RESCORE_TRACE/V1',
    family_source_modes: familyModes(sample),
    matching: {
      exact_first: true,
      fallback_only_after_exact_miss: true,
      normaliser: 'zero-width-strip + NFKC + whitespace-collapse',
      fallback_card_ids: matchTrace.filter((card) => (
        card.match_method === 'fallback'
        || card.observations.some((observation) => observation.match_method === 'fallback')
      )).map((card) => card.id),
    },
    cards: matchTrace,
    successor_comparison: successorComparison({
      baseline, key, successor: readJson(resolve(repoRoot, successorPath)),
    }),
  });
  return Object.freeze({ rows: Object.freeze(rows), trace });
}

function assertOutput(rows, sample, key = null) {
  if (!Array.isArray(rows) || rows.length !== 96) fail('OUTPUT_CARD_COUNT_INVALID', 'current output must contain exactly 96 rows');
  const sampleById = new Map(sample.map((card) => [card.id, card]));
  const keyById = key === null ? null : new Map(key.map((card) => [card.id, card]));
  const ids = new Set(rows.map((row) => row.id));
  if (ids.size !== 96 || sample.some((card) => !ids.has(card.id))) fail('OUTPUT_ID_SET_INVALID', 'current output must contain every original sample ID exactly once');
  for (const row of rows) {
    if (canonicalJson(Object.keys(row).sort()) !== canonicalJson([...OUTPUT_KEYS].sort())) fail('OUTPUT_SCHEMA_INVALID', 'each output row must have exactly the public schema keys', { id: row.id });
    const card = sampleById.get(row.id);
    if (!card || row.deal !== card.deal || row.family !== card.family) {
      fail('OUTPUT_CARD_JOIN_INVALID', 'each output row must carry its original deal and family', { id: row.id });
    }
    if (keyById && row.orig_reason !== keyById.get(row.id)?._reason) {
      fail('OUTPUT_REASON_JOIN_INVALID', 'each output row must carry its original reason from the key', { id: row.id });
    }
    if (!['replay', 'committed'].includes(row.source)) {
      fail('OUTPUT_SOURCE_INVALID', 'each output row must declare replay or committed source', { id: row.id, source: row.source });
    }
    if (!/^(RESOLVED \[[A-Z0-9_]+\]|REVIEW:[A-Z0-9_]+|OPEN_WORLD:[A-Z0-9_]+|NOT_LOCATED_IN_OUTPUT|ARTIFACT_MISSING)$/.test(row.now)) {
      fail('OUTPUT_DISPOSITION_INVALID', 'current disposition is outside the governed grammar', { id: row.id, now: row.now });
    }
    const qualifiedCode = row.now.match(/^(?:REVIEW|OPEN_WORLD):([A-Z0-9_]+)$/)?.[1];
    if (qualifiedCode && RESERVED_DISPOSITION_CODES.has(qualifiedCode)) {
      fail('OUTPUT_DISPOSITION_INVALID', 'location and artefact states must not be folded into review or open-world output', { id: row.id, now: row.now });
    }
  }
}

function stateCounts(rows) {
  return Object.freeze({
    resolved: rows.filter((row) => row.now.startsWith('RESOLVED ')).length,
    review: rows.filter((row) => row.now.startsWith('REVIEW:')).length,
    open_world: rows.filter((row) => row.now.startsWith('OPEN_WORLD:')).length,
    not_located_in_output: rows.filter((row) => row.now === 'NOT_LOCATED_IN_OUTPUT').length,
    artifact_missing: rows.filter((row) => row.now === 'ARTIFACT_MISSING').length,
  });
}

function evaluateStratumGate({ rows, baseline, sample, key }) {
  assertOriginalSampleJoin(sample, key);
  const strata = assertAuthorisedBaseline({ baseline, sample, key });
  assertOutput(rows, sample, key);
  const currentById = new Map(rows.map((row) => [row.id, row]));
  const results = [...strata.entries()].map(([reason, cards]) => {
    const current = stateCounts(cards.map((card) => currentById.get(card.id)));
    const authorisedBaseline = AUTHORISED_STRATUM_BASELINE[reason];
    const control = authorisedBaseline === 0;
    const pass = control ? current.resolved === 0 : current.resolved >= authorisedBaseline;
    return Object.freeze({
      reason,
      cards: cards.length,
      resolved: Object.freeze({ current: current.resolved, baseline: authorisedBaseline }),
      review: current.review,
      open_world: current.open_world,
      not_located_in_output: current.not_located_in_output,
      artifact_missing: current.artifact_missing,
      control,
      movement: current.resolved - authorisedBaseline,
      pass,
    });
  }).sort((left, right) => left.reason.localeCompare(right.reason));
  const controls = results.filter((row) => row.control);
  if (controls.length !== 8 || controls.some((row) => row.resolved.baseline !== 0)) {
    fail('ORIGINAL_CONTROL_STRATA_INVALID', 'the recovered baseline must contain exactly eight zero-resolved control strata');
  }
  const failures = results.filter((row) => !row.pass).map((row) => Object.freeze({
    reason: row.reason,
    type: row.control ? 'CONTROL_STRATUM_MOVED' : 'STAGED_STRATUM_REGRESSED',
    current_resolved: row.resolved.current,
    baseline_resolved: row.resolved.baseline,
  }));
  return Object.freeze({
    schema_version: 'BLIND_CURRENT_RESCORE_STRATUM_GATE/V1',
    card_count: rows.length,
    stratum_count: results.length,
    cards_per_stratum: 8,
    blind_rescore_gate: failures.length === 0 ? 'PASS' : 'FAIL',
    pass: failures.length === 0,
    stage_3_entry: failures.length === 0 ? 'NOT_AUTHORISED_BY_THIS_GATE' : 'CLOSED',
    strata: Object.freeze(results),
    failures: Object.freeze(failures),
  });
}

function readGateInputs({ repoRoot = DEFAULT_ROOT, samplePath = SAMPLE_PATH, keyPath = KEY_PATH, baselinePath = BASELINE_SCORE_PATH, outputPath = OUTPUT_PATH } = {}) {
  const sample = readJson(resolve(repoRoot, samplePath));
  const key = readJson(resolve(repoRoot, keyPath));
  const baseline = readJson(resolve(repoRoot, baselinePath));
  const rows = readJson(resolve(repoRoot, outputPath));
  return Object.freeze({ sample, key, baseline, rows });
}

async function main(argv = process.argv.slice(2)) {
  if (argv.length === 1 && argv[0] === '--gate') {
    const report = evaluateStratumGate(readGateInputs());
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (!report.pass) process.exitCode = 1;
    return report;
  }
  if (argv.length !== 0) fail('USAGE', 'use no arguments to write the current score, or --gate to check its original strata');
  const { rows, trace } = await buildCurrentBlindRescore();
  writeFileSync(resolve(DEFAULT_ROOT, OUTPUT_PATH), `${JSON.stringify(rows, null, 2)}\n`);
  writeFileSync(resolve(DEFAULT_ROOT, TRACE_PATH), `${JSON.stringify(trace, null, 2)}\n`);
  process.stdout.write(`${rows.length} rows\n`);
}

const isMain = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) main().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});

export {
  AUTHORISED_STRATUM_BASELINE,
  CurrentBlindRescoreError,
  FAMILY_SOURCE_MANIFEST,
  OUTPUT_KEYS,
  assertAuthorisedBaseline,
  assertOriginalSampleJoin,
  assertOutput,
  assertStrata,
  buildCurrentBlindRescore,
  currentBatchRuns,
  currentCommittedRows,
  evaluateStratumGate,
  fallbackMatch,
  historicalCandidates,
  matchCard,
  matchCurrentOutput,
  readGateInputs,
  normalise,
  outcomeText,
  resolveMatches,
  sourceModeForFamily,
};
