#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = 'evidence/canonical-v2/stage-2y-i-qualifier-dispatch-measurement.json';
const SCHEMA = 'STAGE_2Y_I_QUALIFIER_DISPATCH_MEASUREMENT/V1';
const EXPECTED_RUNS = 16;
const EXPECTED_CENSUS = Object.freeze({ THRESHOLD: 306, TEMPORAL: 157 });
const { canonicalJson, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContractV42 } = require('../lib/canonical-v2/contract-bundle');
const { MODE, TARGET_REASON, assessRepresentationQualifierDispatch } = require('../lib/canonical-v2/native-producer/representation-qualifier-dispatch-measurement');

function fail(code, message) { throw new Error(`${code}: ${message}`); }
function readJson(file) { return JSON.parse(readFileSync(file, 'utf8')); }
function digestFile(file) { return `sha256:${sha256Hex(readFileSync(file))}`; }

function selectedRuns({ repoRoot = ROOT } = {}) {
  const evidence = resolve(repoRoot, 'evidence/canonical-v2');
  const selected = [];
  for (const item of readdirSync(evidence, { withFileTypes: true })) {
    if (!item.isDirectory() || !item.name.includes('20260809-2xk-final')) continue;
    const runDir = resolve(evidence, item.name);
    const manifestPath = resolve(runDir, 'run-manifest.json');
    const resolutionPath = resolve(runDir, 'resolution.json');
    if (!existsSync(manifestPath) || !existsSync(resolutionPath)) continue;
    const manifest = readJson(manifestPath);
    if (manifest.section_family !== 'REPRESENTATIONS') continue;
    selected.push(Object.freeze({
      run_name: item.name, deal: manifest.deal, agreement_date: manifest.agreement_date || null,
      resolution_path: resolutionPath, resolution_digest: digestFile(resolutionPath),
    }));
  }
  selected.sort((left, right) => left.run_name.localeCompare(right.run_name));
  if (selected.length !== EXPECTED_RUNS) fail('INPUT_REJECTED', `selected ${selected.length} runs, expected ${EXPECTED_RUNS}`);
  return selected;
}

function officialFinalRepresentationRuns({ repoRoot = ROOT } = {}) {
  const evidence = resolve(repoRoot, 'evidence/canonical-v2');
  const rows = [];
  for (const item of readdirSync(evidence, { withFileTypes: true })) {
    if (!item.isDirectory() || !item.name.includes('20260809-2xk') || !item.name.endsWith('-final')) continue;
    const runDir = resolve(evidence, item.name);
    const manifestPath = resolve(runDir, 'run-manifest.json');
    const resolutionPath = resolve(runDir, 'resolution.json');
    if (!existsSync(manifestPath) || !existsSync(resolutionPath)) continue;
    const manifest = readJson(manifestPath);
    if (manifest.section_family !== 'REPRESENTATIONS') continue;
    const resolution = readJson(resolutionPath);
    for (const itemRow of resolution.open_world || []) {
      if (itemRow.reason !== TARGET_REASON) continue;
      rows.push(Object.freeze({ run_name: item.name, qualifier_kind: itemRow.attributes?.qualifier_kind, closure_id: itemRow.closure_id }));
    }
  }
  rows.sort((left, right) => left.run_name.localeCompare(right.run_name) || left.closure_id.localeCompare(right.closure_id));
  return rows;
}

function assertGovernance() {
  const contract = compileFixtureContractV42();
  const keys = new Set(contract.claim_definitions.map((definition) => definition.claim_definition_key));
  for (const key of ['GENERAL_MATERIALITY_QUALIFIER', 'REPRESENTATION_ACCURACY_STANDARD', 'REPRESENTATION_MEASUREMENT_DATE', 'RETROSPECTIVE_LOOKBACK']) {
    if (!keys.has(key)) fail('INPUT_REJECTED', `current contract lacks ${key}`);
  }
}

function countBy(rows, property) {
  const counts = {};
  for (const row of rows) counts[row[property]] = (counts[row[property]] || 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

function buildReport({ repoRoot = ROOT } = {}) {
  assertGovernance();
  const runs = selectedRuns({ repoRoot });
  const rows = [];
  for (const run of runs) {
    const resolution = readJson(run.resolution_path);
    for (const item of resolution.open_world || []) {
      if (item.reason !== TARGET_REASON) continue;
      const assessment = assessRepresentationQualifierDispatch({ row: item, agreement_date: run.agreement_date });
      rows.push(Object.freeze({
        run_name: run.run_name,
        deal: run.deal,
        section_reference: item.section_reference,
        closure_id: item.closure_id,
        evidence_ids: (item.evidence || []).map((edge) => edge.claim_evidence_id).sort(),
        assessment,
      }));
    }
  }
  rows.sort((left, right) => left.run_name.localeCompare(right.run_name)
    || left.section_reference.localeCompare(right.section_reference)
    || left.closure_id.localeCompare(right.closure_id));
  const kinds = countBy(rows.map((row) => ({ kind: row.assessment.qualifier_kind })), 'kind');
  if (canonicalJson(kinds) !== canonicalJson(EXPECTED_CENSUS)) fail('INPUT_REJECTED', `census ${canonicalJson(kinds)} does not equal ${canonicalJson(EXPECTED_CENSUS)}`);
  const dispatches = countBy(rows.map((row) => ({ dispatch: row.assessment.dispatch })), 'dispatch');
  const residualRows = rows.filter((row) => row.assessment.residual_code);
  const residuals = countBy(residualRows.map((row) => ({ residual_code: row.assessment.residual_code })), 'residual_code');
  const accounted = Object.values(dispatches).reduce((sum, value) => sum + value, 0);
  if (accounted !== rows.length) fail('INPUT_REJECTED', `dispatch partition ${accounted} does not equal census ${rows.length}`);
  const officialFinalRows = officialFinalRepresentationRuns({ repoRoot });
  const selectedClosureIds = new Set(rows.map((row) => row.closure_id));
  const difference = officialFinalRows.filter((row) => !selectedClosureIds.has(row.closure_id));
  if (officialFinalRows.length !== 485 || difference.length !== 22 || canonicalJson(countBy(difference, 'qualifier_kind')) !== canonicalJson({ TEMPORAL: 2, THRESHOLD: 20 })
    || new Set(difference.map((row) => row.run_name)).size !== 1 || difference[0]?.run_name !== 'topbuild-representations-20260809-2xk-r3-final') {
    fail('INPUT_REJECTED', 'register discrepancy is not the known TopBuild final-run delta');
  }
  const proposedClaims = rows.reduce((sum, row) => sum + row.assessment.proposed_claims.length, 0);
  return Object.freeze({
    schema_version: SCHEMA,
    mode: MODE,
    publication: Object.freeze({ model_calls: 0, writes_performed: false, serving_activated: false, taxonomy_activated: false, publication_disposition: 'WITHHELD' }),
    census: Object.freeze({ source_reason: TARGET_REASON, selected_run_count: runs.length, measured_rows: rows.length, by_qualifier_kind: kinds, register_reconciliation: Object.freeze({ register_rows: officialFinalRows.length, excluded_rows: difference.length, excluded_by_qualifier_kind: countBy(difference, 'qualifier_kind'), excluded_run: 'topbuild-representations-20260809-2xk-r3-final', selection_basis: 'The 463-row measurement fixes the exact 20260809-2xk-final naming cohort; the register also includes the official TopBuild r3-final run.' }) }),
    inputs: Object.freeze({ contract_bundle: 'V42', runs: runs.map(({ resolution_path, ...run }) => run) }),
    accounting: Object.freeze({ by_dispatch: dispatches, residuals, residual_coded_rows: residualRows.length, proposed_claim_count: proposedClaims, accounted_rows: accounted }),
    rows: Object.freeze(rows),
  });
}

function parseArgs(args) {
  if (args.length !== 1 || !['--write', '--check'].includes(args[0])) fail('USAGE', 'use exactly one of --write or --check');
  return args[0];
}

async function main(args = process.argv.slice(2)) {
  const mode = parseArgs(args);
  const report = buildReport();
  const rendered = `${JSON.stringify(report, null, 2)}\n`;
  const outputPath = resolve(ROOT, OUTPUT);
  if (mode === '--check') {
    if (!existsSync(outputPath) || readFileSync(outputPath, 'utf8') !== rendered) fail('CHECK_FAILED', `${OUTPUT} is stale or missing`);
  } else {
    writeFileSync(outputPath, rendered);
  }
  process.stdout.write(`${mode} ${OUTPUT}\n`);
  return report;
}

const isMain = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) main().catch((error) => { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1; });

export { OUTPUT, SCHEMA, EXPECTED_RUNS, EXPECTED_CENSUS, selectedRuns, officialFinalRepresentationRuns, buildReport, parseArgs, main };
