#!/usr/bin/env node

/* Stored final-corpus replay. It does not call a model, write a database, or serve data. */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isFinalCorpusRun } from './canonical-v2-corpus-review-artifact.mjs';

const require = createRequire(import.meta.url);
const { canonicalJson, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { applyDuplicateSuppression, MODES } = require('../lib/canonical-v2/native-producer/duplicate-suppression');
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = 'evidence/canonical-v2/stage-2y-g-duplicate-suppression.json';
const json = (file) => JSON.parse(readFileSync(file, 'utf8'));
const digest = (value) => `sha256:${sha256Hex(Buffer.from(canonicalJson(value), 'utf8'))}`;

function build(repoRoot = ROOT) {
  const evidenceRoot = resolve(repoRoot, 'evidence/canonical-v2');
  const names = readdirSync(evidenceRoot).filter(isFinalCorpusRun).sort();
  const total = { compiled_candidates: 0, resolved: 0, review_queue: 0, open_world: 0 };
  const runs = [];
  for (const name of names) {
    const dir = resolve(evidenceRoot, name);
    for (const file of ['run-receipt.json', 'resolution.json']) if (!existsSync(resolve(dir, file))) throw new Error(`MISSING_FINAL_EVIDENCE:${name}:${file}`);
    const receipt = json(resolve(dir, 'run-receipt.json')); const resolution = json(resolve(dir, 'resolution.json'));
    total.compiled_candidates += receipt.compiled_candidates.length;
    total.resolved += resolution.resolved.length; total.review_queue += resolution.review_queue.length; total.open_world += resolution.open_world.length;
    if (!name.includes('-mae-definition-')) continue;
    const adapter = json(resolve(dir, 'adapter-result.json'));
    const input = { run_receipt: receipt, resolved: resolution.resolved, open_world: resolution.open_world, limb_component_trees: resolution.limb_component_trees, admitted_source_context: adapter.admitted_source_contexts?.[0] };
    const report = applyDuplicateSuppression({ ...input, mode: MODES.REPORT_ONLY });
    const enforce = applyDuplicateSuppression({ ...input, mode: MODES.ENFORCE });
    runs.push({
      run_name: name, run_receipt_id: receipt.run_receipt_id, document_hash: receipt.document_hash,
      source_hashes: { run_receipt: `sha256:${sha256Hex(readFileSync(resolve(dir, 'run-receipt.json')))}`, resolution: `sha256:${sha256Hex(readFileSync(resolve(dir, 'resolution.json')))}` },
      before_counts: { compiled_candidates: receipt.compiled_candidates.length, resolved: resolution.resolved.length, review_queue: resolution.review_queue.length, open_world: resolution.open_world.length },
      report_only: { ...report.counts, open_world_unchanged: canonicalJson(report.open_world) === canonicalJson(resolution.open_world) },
      enforce: { ...enforce.counts, open_world_after: enforce.open_world.length },
      decisions: report.records,
    });
  }
  const counts = runs.reduce((out, run) => Object.fromEntries(Object.keys(out).map((key) => [key, out[key] + (run.report_only[key] || 0)])), { scanned: 0, would_suppress: 0, suppressed: 0, retained_typed_peer_held: 0, retained_no_typed_peer: 0 });
  const perRun = runs.filter((run) => run.report_only.would_suppress > 0).map((run) => run.report_only.would_suppress);
  const after = { ...total, open_world: total.open_world - counts.would_suppress, displayed_claim_rows: total.review_queue + total.open_world - counts.would_suppress, reason_code_occurrences: 4241 - counts.would_suppress };
  return {
    schema_version: 'STAGE_2Y_G_DUPLICATE_SUPPRESSION_EVIDENCE/V1',
    model_calls: 0, writes: false, serving: false, publication: 'WITHHELD',
    final_corpus: { selector: 'canonical-v2-corpus-review-artifact.mjs:isFinalCorpusRun', final_runs: names.length, before: { ...total, displayed_claim_rows: total.review_queue + total.open_world, reason_code_occurrences: 4241 }, after },
    duplicate_suppression: { mode: 'REPORT_ONLY', counts, eligible_per_run: perRun, records_digest: digest(runs.flatMap((run) => run.decisions)) },
    runs,
  };
}
function assertEvidence(value) {
  const c = value.duplicate_suppression.counts; const before = value.final_corpus.before; const after = value.final_corpus.after;
  if (value.final_corpus.final_runs !== 157 || before.compiled_candidates !== 4841 || before.resolved !== 1571 || before.review_queue !== 2310 || before.open_world !== 2692) throw new Error('FINAL_CORPUS_CENSUS_MISMATCH');
  if (c.scanned !== 84 || c.would_suppress !== 59 || c.retained_typed_peer_held !== 21 || c.retained_no_typed_peer !== 4 || canonicalJson(value.duplicate_suppression.eligible_per_run) !== canonicalJson([3, 11, 9, 20, 16])) throw new Error('DUPLICATE_CENSUS_MISMATCH');
  if (after.open_world !== 2633 || after.displayed_claim_rows !== 4943 || after.reason_code_occurrences !== 4182) throw new Error('ENFORCEMENT_CENSUS_MISMATCH');
  const concho = value.runs.find((run) => run.run_name.startsWith('concho-'));
  if (!concho || concho.before_counts.compiled_candidates !== 26 || concho.before_counts.review_queue !== 15 || concho.before_counts.open_world !== 11 || concho.report_only.would_suppress !== 0 || concho.report_only.retained_typed_peer_held !== 11) throw new Error('CONCHO_GUARD_MISMATCH');
  if (!value.runs.every((run) => run.report_only.open_world_unchanged && run.decisions.every((row) => row.operative_span && Number.isInteger(row.operative_span.absolute_start)))) throw new Error('EVIDENCE_SPAN_OR_REPORT_ONLY_MISMATCH');
}
const args = process.argv.slice(2); const value = build(); assertEvidence(value); const text = `${JSON.stringify(value, null, 2)}\n`; const output = resolve(ROOT, OUTPUT);
if (args.includes('--write')) { writeFileSync(output, text); process.stdout.write(`WROTE ${OUTPUT}\n`); }
else if (args.includes('--check')) { if (!existsSync(output) || readFileSync(output, 'utf8') !== text) throw new Error('STALE_OUTPUT'); process.stdout.write(`CHECKED ${OUTPUT}\n`); }
else process.stdout.write(text);
export { build };
