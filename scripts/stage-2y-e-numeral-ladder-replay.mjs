#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isFinalCorpusRun } from './canonical-v2-corpus-review-artifact.mjs';

const require = createRequire(import.meta.url);
const { canonicalJson, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { NUMERAL_LADDER_SCHEMA, NUMERAL_LADDER_RUNGS, parseDurationAtNumeralRung } = require('../lib/normalize-numeric');
const { parseFilingDeadlineDaysAtNumeralRung } = require('../lib/canonical-v2/native-producer/antitrust-regulatory-parse');
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = 'evidence/canonical-v2/stage-2y-e-numeral-ladder-replay.json';
const json = (file) => JSON.parse(readFileSync(file, 'utf8'));
const digest = (value) => `sha256:${sha256Hex(Buffer.from(canonicalJson(value), 'utf8'))}`;
const SPECS = Object.freeze([
  { family: 'ANTITRUST_REGULATORY', assertion_kind: 'HSR_FILING_DEADLINE', parser: 'FILING_DAYS' },
  { family: 'EMPLOYEE_MATTERS', assertion_kind: 'CONTINUATION_PERIOD', parser: 'MONTHS' },
  { family: 'DNO_INDEMNIFICATION', assertion_kind: 'INDEM_SURVIVAL_PERIOD', parser: 'YEARS' },
  { family: 'DNO_INDEMNIFICATION', assertion_kind: 'TAIL_PERIOD', parser: 'YEARS' },
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
        claim_revision_id: claim.claim_revision_id,
        closure_id: claim.closure_id,
        raw_value_sha256: `sha256:${sha256Hex(Buffer.from(claim.raw_value, 'utf8'))}`,
        raw_value: claim.raw_value,
      });
    }
  }
  return rows.sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right)));
}
function build(repoRoot = ROOT) {
  const rows = applicableRows(repoRoot);
  const rungs = Object.values(NUMERAL_LADDER_RUNGS).map((numeralRung) => {
    const results = rows.map((row) => ({ ...row, result: parseAtRung(row, numeralRung) }));
    const counts = results.reduce((out, row) => ({ ...out, [row.result.outcome]: (out[row.result.outcome] || 0) + 1 }), { RESOLVED: 0, ABSTAIN: 0 });
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
  if (value.rungs.length !== 4 || !value.rungs.every((rung, index) => rung.numeral_rung === index && rung.counts.RESOLVED + rung.counts.ABSTAIN === 19)) throw new Error('NUMERAL_LADDER_RUNG_MISMATCH');
  const dayRungThree = value.rungs[3].results.filter((row) => row.parser === 'FILING_DAYS');
  if (!dayRungThree.every((row) => row.result.reason !== 'MULTIPLE_DAY_COUNTS' || row.result.outcome === 'ABSTAIN')) throw new Error('MULTIPLE_DAY_COUNTS_NOT_HELD');
}
const args = process.argv.slice(2); const value = build(); assertEvidence(value); const text = `${JSON.stringify(value, null, 2)}\n`; const output = resolve(ROOT, OUTPUT);
if (args.includes('--write')) { writeFileSync(output, text); process.stdout.write(`WROTE ${OUTPUT}\n`); }
else if (args.includes('--check')) { if (!existsSync(output) || readFileSync(output, 'utf8') !== text) throw new Error('STALE_OUTPUT'); process.stdout.write(`CHECKED ${OUTPUT}\n`); }
else process.stdout.write(text);
export { build };
