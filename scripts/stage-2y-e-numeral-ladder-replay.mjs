#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isFinalCorpusRun } from './canonical-v2-corpus-review-artifact.mjs';

const require = createRequire(import.meta.url);
const { canonicalJson, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContractV42 } = require('../lib/canonical-v2/contract-bundle');
const { resolveCandidates } = require('../lib/canonical-v2/native-producer/candidate-resolution');
const { NUMERAL_LADDER_SCHEMA, NUMERAL_LADDER_RUNGS, parseDurationAtNumeralRung } = require('../lib/normalize-numeric');
const { parseFilingDeadlineDaysAtNumeralRung } = require('../lib/canonical-v2/native-producer/antitrust-regulatory-parse');
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = 'evidence/canonical-v2/stage-2y-e-numeral-ladder-replay.json';
const json = (file) => JSON.parse(readFileSync(file, 'utf8'));
const digest = (value) => `sha256:${sha256Hex(Buffer.from(canonicalJson(value), 'utf8'))}`;
const SPECS = Object.freeze([
  { family: 'ANTITRUST_REGULATORY', assertion_kind: 'HSR_FILING_DEADLINE', parser: 'FILING_DAYS', resolved_claim_definition_key: 'HSR_FILING_DEADLINE_DAYS' },
  { family: 'EMPLOYEE_MATTERS', assertion_kind: 'CONTINUATION_PERIOD', parser: 'MONTHS', resolved_claim_definition_key: 'BENEFITS_CONTINUATION_PERIOD_MONTHS' },
  { family: 'DNO_INDEMNIFICATION', assertion_kind: 'INDEM_SURVIVAL_PERIOD', parser: 'YEARS', resolved_claim_definition_key: 'INDEMNIFICATION_SURVIVAL_YEARS' },
  { family: 'DNO_INDEMNIFICATION', assertion_kind: 'TAIL_PERIOD', parser: 'YEARS', resolved_claim_definition_key: 'TAIL_POLICY_PERIOD_YEARS' },
]);

function parseAtRung(row, numeralRung) {
  if (row.parser === 'FILING_DAYS') {
    const result = parseFilingDeadlineDaysAtNumeralRung(row.raw_value, numeralRung);
    return result.outcome === 'RESOLVED'
      ? { outcome: 'RESOLVED', canonical_value: result.canonical_value, unit: result.day_kind }
      : { outcome: 'ABSTAIN', reason: result.reason };
  }
  const result = parseDurationAtNumeralRung(row.raw_value, {
    numeralRung,
    convertToUnit: row.parser === 'MONTHS' ? 'months' : null,
  });
  return result ? { outcome: 'RESOLVED', canonical_value: String(result.value), unit: result.unit } : { outcome: 'ABSTAIN', reason: 'NUMERIC_DURATION_UNRESOLVED' };
}
function applicableRows(repoRoot) {
  const evidenceRoot = resolve(repoRoot, 'evidence/canonical-v2');
  const rows = [];
  for (const runName of readdirSync(evidenceRoot).filter(isFinalCorpusRun).sort()) {
    const receipt = json(resolve(evidenceRoot, runName, 'run-receipt.json'));
    for (const entry of receipt.compiled_candidates || []) {
      const claim = entry?.ok === true && entry?.candidate?.kind === 'claim' ? entry.candidate.claim : null;
      if (!claim || typeof claim.raw_value !== 'string') continue;
      const spec = SPECS.find((item) => item.family === entry.section_family && item.assertion_kind === claim.attributes?.assertion_kind);
      if (!spec) continue;
      rows.push({
        run_name: runName,
        section_family: spec.family,
        assertion_kind: spec.assertion_kind,
        parser: spec.parser,
        resolved_claim_definition_key: spec.resolved_claim_definition_key,
        claim_revision_id: claim.claim_revision_id,
        claim_occurrence_id: claim.claim_occurrence_id,
        closure_id: claim.closure_id,
        raw_value_sha256: `sha256:${sha256Hex(Buffer.from(claim.raw_value, 'utf8'))}`,
        raw_value: claim.raw_value,
      });
    }
  }
  return rows.sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right)));
}
function outputForCandidate(resolution, row) {
  const resolvedMatches = (resolution.resolved || []).filter((item) => (
    item.claim?.raw_value === row.raw_value
    && item.claim.claim_definition_key === row.resolved_claim_definition_key
  ));
  if (resolvedMatches.length > 1) throw new Error(`AMBIGUOUS_RESOLVED_MATCH:${row.run_name}:${row.claim_occurrence_id}`);
  if (resolvedMatches.length === 1) {
    const resolved = resolvedMatches[0];
    return {
      outcome: 'RESOLVED',
      canonical_value: resolved.claim.canonical_value,
      claim_definition_key: resolved.claim.claim_definition_key,
    };
  }
  const review = (resolution.review_queue || []).find((item) => item.original_claim_occurrence_id === row.claim_occurrence_id);
  if (review) {
    if (review.has_resolution === true) {
      const resolved = (resolution.resolved || []).find((item) => item.claim?.claim_revision_id === review.claim_revision_id);
      if (!resolved) throw new Error(`RESOLVED_REVIEW_QUEUE_ENTRY_MISSING_CLAIM:${row.run_name}:${row.claim_occurrence_id}`);
      return {
        outcome: 'RESOLVED',
        canonical_value: resolved.claim.canonical_value,
        claim_definition_key: resolved.claim.claim_definition_key,
      };
    }
    return { outcome: 'REVIEW', reasons: review.reasons || [] };
  }
  const heldByExactRawValue = (resolution.review_queue || []).filter((item) => item.has_resolution === false && item.raw_value === row.raw_value);
  if (heldByExactRawValue.length === 1) return { outcome: 'REVIEW', reasons: heldByExactRawValue[0].reasons || [] };
  if (heldByExactRawValue.length > 1) throw new Error(`AMBIGUOUS_REVIEW_MATCH:${row.run_name}:${row.claim_occurrence_id}`);
  const openWorld = (resolution.open_world || []).find((item) => item.closure_id === row.closure_id);
  if (openWorld) return { outcome: 'OPEN_WORLD', reason: openWorld.reason };
  return { outcome: 'NOT_LOCATED_IN_OUTPUT' };
}
function buildRunInputCache(repoRoot) {
  const evidenceRoot = resolve(repoRoot, 'evidence/canonical-v2');
  const cache = new Map();
  return (runName) => {
    if (cache.has(runName)) return cache.get(runName);
    const runDir = resolve(evidenceRoot, runName);
    const input = {
      run_receipt: json(resolve(runDir, 'run-receipt.json')),
      admitted_source_context: json(resolve(runDir, 'adapter-result.json')).admitted_source_contexts[0],
    };
    cache.set(runName, input);
    return input;
  };
}
function publicResultsAtRung(rows, getRunInput, numeralRung) {
  const resultsByRun = new Map();
  for (const runName of [...new Set(rows.map((row) => row.run_name))].sort()) {
    const input = getRunInput(runName);
    resultsByRun.set(runName, resolveCandidates({
      ...input,
      contract_vocabulary: compileFixtureContractV42(),
      numeral_rung: numeralRung,
    }));
  }
  return rows.map((row) => ({
    ...row,
    parser_result: parseAtRung(row, numeralRung),
    resolver_result: outputForCandidate(resultsByRun.get(row.run_name), row),
  }));
}
function build(repoRoot = ROOT) {
  const rows = applicableRows(repoRoot);
  const getRunInput = buildRunInputCache(repoRoot);
  const rungs = Object.values(NUMERAL_LADDER_RUNGS).map((numeralRung) => {
    const results = publicResultsAtRung(rows, getRunInput, numeralRung);
    const counts = results.reduce((out, row) => ({ ...out, [row.resolver_result.outcome]: (out[row.resolver_result.outcome] || 0) + 1 }), {
      RESOLVED: 0, REVIEW: 0, OPEN_WORLD: 0, NOT_LOCATED_IN_OUTPUT: 0,
    });
    return { numeral_rung: numeralRung, counts, results, results_digest: digest(results) };
  });
  return {
    schema_version: 'STAGE_2Y_E_NUMERAL_LADDER_REPLAY/V1',
    numeral_ladder_schema: NUMERAL_LADDER_SCHEMA,
    model_calls: 0,
    writes: false,
    production_activation: false,
    selector: 'canonical-v2-corpus-review-artifact.mjs:isFinalCorpusRun',
    final_run_count: readdirSync(resolve(repoRoot, 'evidence/canonical-v2')).filter(isFinalCorpusRun).length,
    affected_recording_count: rows.length,
    input_digest: digest(rows),
    rungs,
  };
}
function assertEvidence(value) {
  if (value.final_run_count !== 157 || value.affected_recording_count !== 19 || value.production_activation !== false || value.model_calls !== 0 || value.writes !== false) throw new Error('NUMERAL_LADDER_CENSUS_MISMATCH');
  if (value.rungs.length !== 4 || !value.rungs.every((rung, index) => rung.numeral_rung === index && Object.values(rung.counts).reduce((sum, count) => sum + count, 0) === 19)) throw new Error('NUMERAL_LADDER_RUNG_MISMATCH');
  const dayRungThree = value.rungs[3].results.filter((row) => row.parser === 'FILING_DAYS');
  if (!dayRungThree.every((row) => row.parser_result.reason !== 'MULTIPLE_DAY_COUNTS' || row.parser_result.outcome === 'ABSTAIN')) throw new Error('MULTIPLE_DAY_COUNTS_NOT_HELD');
}
const args = process.argv.slice(2); const value = build(); assertEvidence(value); const text = `${JSON.stringify(value, null, 2)}\n`; const output = resolve(ROOT, OUTPUT);
if (args.includes('--write')) { writeFileSync(output, text); process.stdout.write(`WROTE ${OUTPUT}\n`); }
else if (args.includes('--check')) { if (!existsSync(output) || readFileSync(output, 'utf8') !== text) throw new Error('STALE_OUTPUT'); process.stdout.write(`CHECKED ${OUTPUT}\n`); }
else process.stdout.write(text);
export { build };
