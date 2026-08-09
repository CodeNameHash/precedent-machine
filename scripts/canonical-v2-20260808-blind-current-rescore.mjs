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
const SAMPLE_CUTOFF = '2026-08-08T23:59:59.999Z';
const OUTPUT_KEYS = Object.freeze(['id', 'deal', 'family', 'orig_reason', 'now', 'source']);

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
  return [...new Set(cards.map((card) => card.family))].sort().map((family) => Object.freeze({
    family,
    mode: 'replay',
    reason: 'CURRENT_GENERIC_RESOLVER_AND_CONTRACT_BUNDLE_POSTDATE_2026_08_08_SAMPLE',
  }));
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
  if (!Array.isArray(sample) || !Array.isArray(key) || sample.length !== 96 || key.length !== 96) {
    fail('ORIGINAL_SAMPLE_CARD_COUNT_INVALID', 'sample and key must each contain exactly 96 cards');
  }
  const keyById = new Map(key.map((row) => [row.id, row]));
  if (keyById.size !== 96 || sample.some((row) => !keyById.has(row.id))) fail('ORIGINAL_SAMPLE_ID_JOIN_INVALID', 'sample and key must join exactly on 96 IDs');
  const discovered = historicalCandidates({ repoRoot });
  const inventory = candidates || discovered.candidates;
  const runner = runnerModule || await import(pathToFileURL(resolve(repoRoot, 'scripts/canonical-v2-live-extraction-run.mjs')));
  const replayCache = new Map();
  const cachedResolveRun = async (args) => {
    if (!replayCache.has(args.sourceRun)) replayCache.set(args.sourceRun, Promise.resolve(resolveRun({ ...args, runner })));
    return replayCache.get(args.sourceRun);
  };
  const rows = [];
  const matchTrace = [];
  for (const card of sample) {
    const keyedCard = Object.freeze({ ...card, _reason: keyById.get(card.id)._reason });
    const match = matchCard(keyedCard, inventory);
    const resolved = match.method === 'not_located'
      ? {
        now: discovered.dealFamilyRuns.has(canonicalJson([card.deal, card.family]))
          ? 'NOT_LOCATED_IN_OUTPUT' : 'ARTIFACT_MISSING',
        observations: [],
      }
      : await resolveMatches({ repoRoot, card, matched: match.candidates, resolveRun: cachedResolveRun });
    const origReason = keyById.get(card.id)._reason;
    rows.push(Object.freeze({ id: card.id, deal: card.deal, family: card.family, orig_reason: origReason, now: resolved.now, source: 'replay' }));
    matchTrace.push(Object.freeze({
      id: card.id,
      match_method: match.method,
      matched_candidates: match.candidates.map((candidate) => ({ source_run: candidate.source_run, candidate_id: candidate.candidate_id, replayable: candidate.replayable })),
      observations: resolved.observations.map((observation) => ({
        source_run: observation.candidate.source_run,
        candidate_id: observation.candidate.candidate_id,
        now: observation.now,
        error_code: observation.error_code,
        observed_dispositions: observation.observed_dispositions || [observation.now],
      })),
      now: resolved.now,
    }));
  }
  assertOutput(rows, sample);
  const trace = Object.freeze({
    schema_version: 'BLIND_CURRENT_RESCORE_TRACE/V1',
    replay_family_modes: familyModes(sample),
    matching: { exact_first: true, fallback_only_after_exact_miss: true, normaliser: 'zero-width-strip + NFKC + whitespace-collapse' },
    cards: matchTrace,
    successor_comparison: successorComparison({
      baseline: readJson(resolve(repoRoot, baselinePath)), key, successor: readJson(resolve(repoRoot, successorPath)),
    }),
  });
  return Object.freeze({ rows: Object.freeze(rows), trace });
}

function assertOutput(rows, sample) {
  if (!Array.isArray(rows) || rows.length !== 96) fail('OUTPUT_CARD_COUNT_INVALID', 'current output must contain exactly 96 rows');
  const ids = new Set(rows.map((row) => row.id));
  if (ids.size !== 96 || sample.some((card) => !ids.has(card.id))) fail('OUTPUT_ID_SET_INVALID', 'current output must contain every original sample ID exactly once');
  for (const row of rows) {
    if (canonicalJson(Object.keys(row).sort()) !== canonicalJson([...OUTPUT_KEYS].sort())) fail('OUTPUT_SCHEMA_INVALID', 'each output row must have exactly the public schema keys', { id: row.id });
    if (!/^(RESOLVED \[[A-Z0-9_]+\]|REVIEW:[A-Z0-9_]+|OPEN_WORLD:[A-Z0-9_]+|NOT_LOCATED_IN_OUTPUT|ARTIFACT_MISSING)$/.test(row.now)) {
      fail('OUTPUT_DISPOSITION_INVALID', 'current disposition is outside the governed grammar', { id: row.id, now: row.now });
    }
  }
}

async function main() {
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
  CurrentBlindRescoreError,
  OUTPUT_KEYS,
  assertOutput,
  buildCurrentBlindRescore,
  fallbackMatch,
  historicalCandidates,
  matchCard,
  normalise,
  outcomeText,
  resolveMatches,
};
