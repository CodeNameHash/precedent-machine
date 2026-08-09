#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { canonicalJson, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');
const BATCH_PATH = 'evidence/canonical-v2/stage-2y-l-live-batch.json';
const DIFF_PATH = 'evidence/canonical-v2/stage-2y-l-per-family-diff.json';
const RESIDUAL_A_PATH = 'evidence/canonical-v2/stage-2y-k-residual-a.json';
const RESIDUAL_B_PATH = 'evidence/canonical-v2/stage-2y-k-residual-b.json';
const OUTPUT_PATH = 'evidence/canonical-v2/stage-2y-l-target-cohort-audit.json';
const PROXY_BASELINES = Object.freeze([
  ['redhat', 'evidence/canonical-v2/redhat-proxy-meeting-20260809-2xk-final/resolution.json'],
  ['skechers', 'evidence/canonical-v2/skechers-proxy-meeting-20260809-2xk-final/resolution.json'],
]);
const SCHEMA_VERSION = 'STAGE_2Y_L_TARGET_COHORT_AUDIT/V1';
const CURRENT_ASSERTION_REASON = 'ASSERTION_KIND_UNCORROBORATED';
let atomicSequence = 0;

function json(path) { return JSON.parse(readFileSync(path, 'utf8')); }
function sha256File(path) { return sha256Hex(readFileSync(path)); }
function sorted(values) { return [...new Set(values || [])].sort(); }
function digest(value) { return `sha256:${sha256Hex(Buffer.from(canonicalJson(value), 'utf8'))}`; }
function artifactId(artifact) { const { artifact_id, ...body } = artifact; return digest(body); }
function plain(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function stableId(row) { return row.original_claim_occurrence_id || row.claim_revision_id || row.closure_id || digest({ evidence: evidenceSpans(row), raw_value: row.raw_value || row.normalised_phrase || null }); }
function evidenceSpans(row) {
  const source = row.source_evidence_byte_spans || row.evidence_byte_spans || row.evidence || [];
  return source.map((item) => ({ start: item.absolute_start, end: item.absolute_end }))
    .filter((item) => Number.isInteger(item.start) && Number.isInteger(item.end) && item.start >= 0 && item.end > item.start)
    .sort((left, right) => left.start - right.start || left.end - right.end);
}
function exactSpans(left, right) { return canonicalJson(left) === canonicalJson(right); }
function normalisedText(value) { return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase(); }
function contains(left, right) { return left.start <= right.start && left.end >= right.end; }
function spansContainEachOther(left, right) {
  if (!left.length || !right.length) return false;
  return left.every((span) => right.some((candidate) => contains(span, candidate) || contains(candidate, span)))
    && right.every((span) => left.some((candidate) => contains(span, candidate) || contains(candidate, span)));
}
function currentRows(resolution) {
  if (!plain(resolution) || !Array.isArray(resolution.review_queue) || !Array.isArray(resolution.open_world)) throw new Error('CURRENT_RESOLUTION_SCHEMA_INVALID');
  return [
    ...resolution.review_queue.map((row) => ({ row, collection: 'review_queue' })),
    ...resolution.open_world.map((row) => ({ row, collection: 'open_world' })),
  ];
}
function rowState(candidate) {
  if (candidate.collection === 'open_world') return 'OPEN_WORLD';
  if (candidate.row.has_resolution === true) return 'RESOLVED';
  return `HELD:${sorted(candidate.row.reasons).join('|') || 'UNSPECIFIED'}`;
}
function rowSummary(candidate) {
  return {
    current_card_id: stableId(candidate.row),
    collection: candidate.collection,
    state: rowState(candidate),
    reasons: sorted(candidate.row.reasons),
    resolved_claim_definition_key: candidate.row.resolved_claim_definition_key || null,
    concept_key: candidate.row.concept_key || null,
    evidence_spans: evidenceSpans(candidate.row),
    raw_value_digest: digest(candidate.row.raw_value || candidate.row.normalised_phrase || null),
  };
}
function collapseEquivalentCandidates(candidates) {
  const groups = new Map();
  for (const candidate of candidates) {
    const summary = rowSummary(candidate);
    const { current_card_id, ...equivalence } = summary;
    const key = canonicalJson(equivalence);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(candidate);
  }
  return [...groups.values()].map((group) => ({
    candidate: group.sort((left, right) => stableId(left.row).localeCompare(stableId(right.row)))[0],
    equivalent_current_card_ids: sorted(group.map((item) => stableId(item.row))),
  }));
}
function chooseMatch(candidates, method, ambiguousMethod) {
  const equivalent = collapseEquivalentCandidates(candidates);
  if (equivalent.length === 1) return { candidate: equivalent[0].candidate, method, equivalent_current_card_ids: equivalent[0].equivalent_current_card_ids };
  if (equivalent.length > 1) return { candidate: null, method: ambiguousMethod, candidates: equivalent.map((item) => rowSummary(item.candidate)) };
  return null;
}
function matchTarget(target, resolution) {
  const targetSpans = evidenceSpans(target);
  const rows = currentRows(resolution);
  const targetQuote = normalisedText(target.raw_quote);
  const quoteExact = targetQuote ? rows.filter((candidate) => targetQuote === normalisedText(candidate.row.raw_value || candidate.row.normalised_phrase)) : [];
  const exactQuoteMatch = chooseMatch(quoteExact, 'EXACT_NORMALISED_QUOTE', 'AMBIGUOUS_EXACT_QUOTE_MATCH');
  if (exactQuoteMatch) return exactQuoteMatch;
  const exact = rows.filter((candidate) => exactSpans(targetSpans, evidenceSpans(candidate.row)));
  const exactSpanMatch = targetSpans.length ? chooseMatch(exact, 'EXACT_EVIDENCE_SPAN', 'AMBIGUOUS_EXACT_MATCH') : null;
  if (exactSpanMatch) return exactSpanMatch;
  const fallback = rows.filter((candidate) => spansContainEachOther(targetSpans, evidenceSpans(candidate.row)));
  const spanFallbackMatch = targetSpans.length ? chooseMatch(fallback, 'CONTAINMENT_FALLBACK', 'AMBIGUOUS_CONTAINMENT_FALLBACK') : null;
  if (spanFallbackMatch) return spanFallbackMatch;
  const quoteContainment = targetQuote ? rows.filter((candidate) => {
    const candidateQuote = normalisedText(candidate.row.raw_value || candidate.row.normalised_phrase);
    return candidateQuote && (targetQuote.includes(candidateQuote) || candidateQuote.includes(targetQuote));
  }) : [];
  const quoteFallbackMatch = chooseMatch(quoteContainment, 'QUOTE_CONTAINMENT_FALLBACK', 'AMBIGUOUS_QUOTE_CONTAINMENT_FALLBACK');
  if (quoteFallbackMatch) return quoteFallbackMatch;
  return { candidate: null, method: 'NOT_EMITTED' };
}
function targetSummary(source, sourceKind) {
  return {
    baseline_card_id: source.id || stableId(source),
    baseline_source: sourceKind,
    baseline_run_path: source.run_path || null,
    deal: source.deal,
    family: source.family,
    section_reference: source.section_reference,
    reason_code: source.reason_code || null,
    mechanism_verdict: source.mechanism_verdict || null,
    raw_quote_digest: digest(source.raw_quote || null),
    evidence_spans: evidenceSpans(source),
  };
}
function targetCard({ source, sourceKind, sectionIndex, readResolution, resolutionDigest }) {
  const target = targetSummary(source, sourceKind);
  const section = sectionIndex.get(`${target.deal}\0${target.family}\0${target.section_reference}`);
  if (!section) throw new Error(`CURRENT_SECTION_MISSING:${target.deal}/${target.family}/${target.section_reference}`);
  const resolution = readResolution(section.current_directory);
  const matched = matchTarget(source, resolution);
  const current = matched.candidate ? rowSummary(matched.candidate) : null;
  return {
    ...target,
    current_directory: section.current_directory,
    current_resolution_sha256: resolutionDigest ? resolutionDigest(section.current_directory) : null,
    state: current?.state || 'NOT_EMITTED',
    match: {
      method: matched.method,
      fallback_used: ['CONTAINMENT_FALLBACK', 'QUOTE_CONTAINMENT_FALLBACK'].includes(matched.method),
      candidates: matched.candidates || [],
      equivalent_current_card_ids: matched.equivalent_current_card_ids || [],
    },
    current,
  };
}
function countCards(cards) {
  const counts = { target_cards: cards.length, resolved: 0, held: 0, open_world: 0, not_emitted: 0 };
  for (const card of cards) {
    if (card.state === 'RESOLVED') counts.resolved += 1;
    else if (card.state === 'OPEN_WORLD') counts.open_world += 1;
    else if (card.state === 'NOT_EMITTED') counts.not_emitted += 1;
    else if (card.state.startsWith('HELD:')) counts.held += 1;
    else throw new Error(`CARD_STATE_INVALID:${card.state}`);
  }
  return counts;
}
function sourceTargets({ residualA, residualB, proxyCards }) {
  const a = residualA?.occurrences || []; const b = residualB?.occurrences || [];
  if (!Array.isArray(a) || !Array.isArray(b) || !Array.isArray(proxyCards)) throw new Error('BASELINE_TARGET_SCHEMA_INVALID');
  return {
    financing: b.filter((row) => row.family === 'FINANCING_COVENANTS' && row.reason_code === CURRENT_ASSERTION_REASON),
    closing_accuracy: a.filter((row) => row.family === 'CLOSING_CONDITIONS' && row.reason_code === 'ACCURACY_STANDARD_OUT_OF_VOCABULARY'),
    closing_obligor: a.filter((row) => row.family === 'CLOSING_CONDITIONS' && row.mechanism_verdict === 'PRODUCER_CONDITION_OBLIGOR_OMITTED'),
    proxy_qualitative_day_count: proxyCards,
    redhat_accuracy_no_fix: a.filter((row) => row.deal === 'redhat' && row.family === 'CLOSING_CONDITIONS' && row.reason_code === 'ACCURACY_STANDARD_OUT_OF_VOCABULARY' && /prevent or materially delay/i.test(row.raw_quote || '')),
    redhat_condition_residual_no_fix: a.filter((row) => row.deal === 'redhat' && row.family === 'CLOSING_CONDITIONS' && row.mechanism_verdict === 'CORRECT_ABSTENTION_PARTYLESS_BURDENSOME_FRAGMENT'),
  };
}
function uniqueTargetCards(cards) {
  const ids = new Set();
  for (const card of cards) {
    const id = card.baseline_card_id;
    if (ids.has(id)) throw new Error(`BASELINE_CARD_DUPLICATE:${id}`);
    ids.add(id);
  }
  return cards.sort((left, right) => left.baseline_card_id.localeCompare(right.baseline_card_id));
}
function newFinancingHolds({ diffArtifact, financingCards, readResolution, resolutionDigest }) {
  const matchedCurrent = new Set(financingCards.map((card) => card.current?.current_card_id).filter(Boolean));
  const results = [];
  for (const section of diffArtifact.sections.filter((row) => row.family === 'FINANCING_COVENANTS')) {
    for (const candidate of currentRows(readResolution(section.current_directory))) {
      if (candidate.collection !== 'review_queue' || candidate.row.has_resolution !== false || !(candidate.row.reasons || []).includes(CURRENT_ASSERTION_REASON)) continue;
      const current = rowSummary(candidate);
      if (matchedCurrent.has(current.current_card_id)) continue;
      results.push({
        deal: section.deal,
        family: section.family,
        section_reference: section.section_reference,
        current_directory: section.current_directory,
        current_resolution_sha256: resolutionDigest ? resolutionDigest(section.current_directory) : null,
        ...current,
      });
    }
  }
  return results.sort((left, right) => `${left.deal}/${left.section_reference}/${left.current_card_id}`.localeCompare(`${right.deal}/${right.section_reference}/${right.current_card_id}`));
}
function assertExpectations(output) {
  const expected = {
    financing: { target_cards: 8, resolved: 2, held: 4, open_world: 0, not_emitted: 2 },
    closing_accuracy: { target_cards: 26, resolved: 24, held: 1, open_world: 1, not_emitted: 0 },
    closing_obligor: { target_cards: 7, resolved: 7, held: 0, open_world: 0, not_emitted: 0 },
    proxy_qualitative_day_count: { target_cards: 3, resolved: 0, held: 0, open_world: 3, not_emitted: 0 },
  };
  for (const [name, counts] of Object.entries(expected)) if (canonicalJson(output.cohorts[name].counts) !== canonicalJson(counts)) throw new Error(`COHORT_COUNTS_UNEXPECTED:${name}`);
  if (output.cohorts.financing.new_current_holds.length !== 2) throw new Error('NEW_FINANCING_HOLDS_UNEXPECTED');
  if (output.redhat_no_fix.cards.length !== 2 || output.redhat_no_fix.cards.some((card) => card.state !== 'OPEN_WORLD')) throw new Error('REDHAT_NO_FIX_NOT_PRESERVED');
}
function auditTargetCohort({ batchArtifact, diffArtifact, residualA, residualB, proxyCards, readResolution, resolutionDigest = null } = {}, { validateExpectations = false } = {}) {
  if (batchArtifact?.schema_version !== 'STAGE_2Y_L_LIVE_BATCH/V1' || !batchArtifact.artifact_id || diffArtifact?.schema_version !== 'STAGE_2Y_L_PER_FAMILY_DIFF/V1' || !diffArtifact.artifact_id || !Array.isArray(diffArtifact.sections)) throw new Error('SOURCE_ARTIFACT_SCHEMA_INVALID');
  const sectionIndex = new Map();
  for (const section of diffArtifact.sections) {
    const key = `${section.deal}\0${section.family}\0${section.section_reference}`;
    if (sectionIndex.has(key) || typeof section.current_directory !== 'string') throw new Error(`CURRENT_SECTION_INVALID:${key}`);
    sectionIndex.set(key, section);
  }
  const targets = sourceTargets({ residualA, residualB, proxyCards });
  const cardsFor = (rows, sourceKind) => uniqueTargetCards(rows.map((source) => targetCard({ source, sourceKind, sectionIndex, readResolution, resolutionDigest })));
  const cohorts = {
    financing: { cards: cardsFor(targets.financing, 'STAGE_2Y_K_RESIDUAL_B'), counts: null, new_current_holds: [] },
    closing_accuracy: { cards: cardsFor(targets.closing_accuracy, 'STAGE_2Y_K_RESIDUAL_A'), counts: null },
    closing_obligor: { cards: cardsFor(targets.closing_obligor, 'STAGE_2Y_K_RESIDUAL_A'), counts: null },
    proxy_qualitative_day_count: { cards: cardsFor(targets.proxy_qualitative_day_count, 'BASELINE_RESOLUTION'), counts: null },
  };
  for (const cohort of Object.values(cohorts)) cohort.counts = countCards(cohort.cards);
  cohorts.financing.new_current_holds = newFinancingHolds({ diffArtifact, financingCards: cohorts.financing.cards, readResolution, resolutionDigest });
  const redhatNoFix = uniqueTargetCards([
    ...cardsFor(targets.redhat_accuracy_no_fix, 'STAGE_2Y_K_RESIDUAL_A'),
    ...cardsFor(targets.redhat_condition_residual_no_fix, 'STAGE_2Y_K_RESIDUAL_A'),
  ]);
  const output = {
    schema_version: SCHEMA_VERSION,
    artifact_id: null,
    mode: 'REPORT_ONLY',
    model_calls: 0,
    resolver_reinvoked: false,
    matcher_change_authorisation: false,
    publication_authorisation: 'NONE',
    source_artifacts: {
      live_batch_artifact_id: batchArtifact.artifact_id,
      per_family_diff_artifact_id: diffArtifact.artifact_id,
      live_batch_call_count: batchArtifact.actual_call_count,
      per_family_diff_call_count: diffArtifact.actual_call_count,
    },
    cohorts,
    redhat_no_fix: { cards: redhatNoFix },
  };
  output.artifact_id = artifactId(output);
  if (validateExpectations) assertExpectations(output);
  return output;
}

function proxyCardsFromBaselines(repoRoot) {
  const cards = [];
  for (const [deal, location] of PROXY_BASELINES) {
    const resolution = json(resolve(repoRoot, location));
    for (const row of resolution.review_queue || []) {
      if (!(row.reasons || []).includes('NO_DAY_COUNT')) continue;
      cards.push({
        id: row.original_claim_occurrence_id || stableId(row), deal, family: 'PROXY_MEETING', section_reference: row.section_reference,
        reason_code: 'NO_DAY_COUNT', mechanism_verdict: 'QUALITATIVE_DAY_COUNT_CORRECT_ABSTENTION', run_path: location.replace(/\/resolution\.json$/, ''),
        raw_quote: row.raw_value || row.normalised_phrase || null, source_evidence_byte_spans: row.evidence || [],
      });
    }
  }
  return cards;
}
function buildTargetCohortAudit({ repoRoot = REPO_ROOT } = {}) {
  const batchPath = resolve(repoRoot, BATCH_PATH); const diffPath = resolve(repoRoot, DIFF_PATH);
  const residualAPath = resolve(repoRoot, RESIDUAL_A_PATH); const residualBPath = resolve(repoRoot, RESIDUAL_B_PATH);
  const resolutionDigest = (directory) => sha256File(resolve(repoRoot, directory, 'resolution.json'));
  return auditTargetCohort({
    batchArtifact: json(batchPath), diffArtifact: json(diffPath), residualA: json(residualAPath), residualB: json(residualBPath), proxyCards: proxyCardsFromBaselines(repoRoot),
    readResolution: (directory) => json(resolve(repoRoot, directory, 'resolution.json')),
    resolutionDigest,
  }, { validateExpectations: true });
}
function renderTargetCohortAudit(artifact) { return `${canonicalJson(artifact)}\n`; }
function writeTargetCohortAudit({ outputPath, artifact }) {
  mkdirSync(dirname(outputPath), { recursive: true }); const temporary = `${outputPath}.tmp-${process.pid}-${Date.now()}-${atomicSequence++}`;
  writeFileSync(temporary, renderTargetCohortAudit(artifact)); renameSync(temporary, outputPath);
}
function checkTargetCohortAudit({ outputPath, artifact }) { return existsSync(outputPath) && readFileSync(outputPath, 'utf8') === renderTargetCohortAudit(artifact); }
function parseArgs(args) {
  if (args.length !== 1 || !['--write', '--check'].includes(args[0])) throw new Error('USAGE: --write | --check');
  return args[0];
}
function main() {
  const mode = parseArgs(process.argv.slice(2)); const artifact = buildTargetCohortAudit(); const output = resolve(REPO_ROOT, OUTPUT_PATH);
  if (mode === '--write') writeTargetCohortAudit({ outputPath: output, artifact });
  if (!checkTargetCohortAudit({ outputPath: output, artifact })) throw new Error('STALE_OUTPUT');
  process.stdout.write(`financing: ${canonicalJson(artifact.cohorts.financing.counts)}\nclosing accuracy: ${canonicalJson(artifact.cohorts.closing_accuracy.counts)}\nclosing obligor: ${canonicalJson(artifact.cohorts.closing_obligor.counts)}\nproxy: ${canonicalJson(artifact.cohorts.proxy_qualitative_day_count.counts)}\n`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

export { auditTargetCohort, buildTargetCohortAudit, renderTargetCohortAudit, writeTargetCohortAudit, checkTargetCohortAudit };
