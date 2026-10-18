#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────────
   scripts/product/reconcile-ben-samples.js — Phase 5 sample reconciliation
   in one command.

   Exports the V2 layered facts of one run and reconciles Ben's sample
   notes on that agreement against them (plan Phase 5: "Reconcile Ben's
   existing independent, detailed provision samples against the
   corresponding V2 agreement results"), writing v2-facts.json, the
   reconciliation report and a summary into --out-dir. The hour Olaplex or
   Apogee finishes under V2, the report is:

     node scripts/product/reconcile-ben-samples.js --notes olaplex --run <run-id> --out-dir <dir>

   --notes is "olaplex", "apogee" (fixtures/product/ben-samples) or a path.
   --run reads the run from the database through the same analysis read
   the review page uses (ProductPhase3Store#getAgreementAnalysis, as
   scripts/product/export-review-comparison-inputs.js does); --snapshot
   reads a PRODUCT_RUN_SNAPSHOT/V1 file (lib/product/run-rows.js) carrying
   product_proposals with their payloads and product_source_closures.

   The run must be the agreement the notes are about: when the note file
   names its source URL the run's retrieval URL must match it, and the
   command refuses a V1 run (no component trees) rather than reconciling
   against nothing. Exit code 1 on either.
   ───────────────────────────────────────────────────────────────────────── */

'use strict';

const fs = require('fs');
const path = require('path');
const { normaliseNoteFile, reconcileSampleNotes } = require('../../lib/product/sample-reconciliation');
const { readRunSnapshot, runLabel, sectionReferencesByNode } = require('../../lib/product/run-rows');
const { renderReport } = require('./reconcile-sample-notes');
const { buildV2Facts } = require('./export-review-comparison-inputs');

const NOTE_FIXTURES = Object.freeze({
  olaplex: path.join(__dirname, '..', '..', 'fixtures', 'product', 'ben-samples', 'olaplex-ben-partial-inventory.v1.json'),
  apogee: path.join(__dirname, '..', '..', 'fixtures', 'product', 'ben-samples', 'apogee-ben-partial-inventory.v1.json'),
});

class ReconcileBenSamplesError extends Error {}

function parseArguments(argv) {
  const options = { notes: null, runId: null, snapshot: null, outDir: null, allowSourceMismatch: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const next = argv[index + 1];
    if (argument === '--notes') { options.notes = next; index += 1; continue; }
    if (argument === '--run') { options.runId = next; index += 1; continue; }
    if (argument === '--snapshot') { options.snapshot = next; index += 1; continue; }
    if (argument === '--out-dir') { options.outDir = next; index += 1; continue; }
    if (argument === '--allow-source-mismatch') { options.allowSourceMismatch = true; continue; }
    throw new TypeError(`unknown argument: ${argument}`);
  }
  if (!options.notes || !options.outDir || (!options.runId && !options.snapshot) || (options.runId && options.snapshot)) {
    throw new TypeError('usage: reconcile-ben-samples.js --notes olaplex|apogee|<file> (--run <run-id> | --snapshot <file>) --out-dir <dir> [--allow-source-mismatch]');
  }
  return options;
}

function noteFilePath(notes) {
  return NOTE_FIXTURES[String(notes).toLowerCase()] || notes;
}

// The facts of a snapshot in the shape export-review-comparison-inputs.js
// writes (v2-facts.json): every proposal carrying a component tree.
function factsFromSnapshot(run) {
  const references = sectionReferencesByNode(run);
  const proposals = run.tables.product_proposals || [];
  const facts = proposals
    .filter((row) => Array.isArray(row.payload?.components) && row.payload.components.length > 0 && row.payload.headline)
    .map((row) => ({
      fact_id: row.proposal_id,
      structure_node_id: row.structure_node_id,
      section_reference: references.get(row.structure_node_id) || null,
      headline: row.payload.headline,
      components: row.payload.components,
      family_key: row.family_key,
      subtype_key: row.subtype_key,
      statement: row.payload.statement,
      validation_status: row.validation_status,
    }));
  const runRow = (run.tables.product_analysis_runs || [])[0] || null;
  return { facts, counts: { totalProposals: proposals.length, keptFacts: facts.length }, retrievalUrl: runRow?.retrieval_url || null, label: runLabel(run) };
}

async function factsFromDatabase(runId, dependencies) {
  const makeStore = dependencies.createStore || (() => {
    const { createClient } = require('@supabase/supabase-js');
    const { ProductPhase3Store } = require('../../lib/product/phase-3-store');
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new ReconcileBenSamplesError('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for --run');
    return new ProductPhase3Store({ client: createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }) });
  });
  const store = makeStore();
  const { v2Facts, counts } = await buildV2Facts({ store, runId });
  const run = typeof store.getRun === 'function' ? await store.getRun(runId) : null;
  return { facts: v2Facts, counts: { totalProposals: counts.totalProposals, keptFacts: counts.keptFacts }, retrievalUrl: run?.retrieval_url || null, label: run ? `${String(run.retrieval_url || '').split('/').pop()} generation ${run.source_generation ?? '?'} (${runId.slice(0, 8)})` : runId };
}

function summaryLines({ noteFile, source, items, reconciliation }) {
  const { summary, results, unmentionedFacts } = reconciliation;
  const lines = [];
  lines.push(`notes: ${noteFile} (${items.length} items, ${items.filter((item) => item.is_gap).length} GAP)`);
  lines.push(`run: ${source.label}; facts with a component tree: ${source.counts.keptFacts} of ${source.counts.totalProposals} proposals`);
  lines.push(`MATCHED ${summary.MATCHED}, PARTIAL ${summary.PARTIAL}, MISSING ${summary.MISSING}, GAP ${summary.GAP}; facts in noted sections the notes do not mention: ${unmentionedFacts.length}`);
  const noCandidates = results.filter((result) => !result.is_gap && result.candidate_count === 0);
  lines.push(`note items whose section has no fact in the run: ${noCandidates.length}${noCandidates.length ? ` (${[...new Set(noCandidates.map((result) => result.section_reference))].join(', ')})` : ''}`);
  return lines;
}

async function runReconcileBenSamples(options, dependencies = {}, output = process.stdout) {
  const noteFile = noteFilePath(options.notes);
  const rawNotes = JSON.parse(fs.readFileSync(noteFile, 'utf8'));
  const items = normaliseNoteFile(rawNotes);
  const source = options.snapshot ? factsFromSnapshot(readRunSnapshot(options.snapshot)) : await factsFromDatabase(options.runId, dependencies);
  if (source.counts.keptFacts === 0) throw new ReconcileBenSamplesError(`${source.label} has no proposals with a component tree (a V1 run); the notes reconcile against V2 output only`);
  const declaredUrl = rawNotes.source_url || rawNotes.provenance?.source_url || null;
  if (declaredUrl && source.retrievalUrl && declaredUrl !== source.retrievalUrl && !options.allowSourceMismatch) {
    throw new ReconcileBenSamplesError(`the notes are about ${declaredUrl} and the run read ${source.retrievalUrl}; pass --allow-source-mismatch only for a path check against another agreement`);
  }
  const reconciliation = reconcileSampleNotes({ items, facts: source.facts });
  fs.mkdirSync(options.outDir, { recursive: true });
  fs.writeFileSync(path.join(options.outDir, 'v2-facts.json'), `${JSON.stringify(source.facts, null, 2)}\n`);
  const report = renderReport({ items, facts: source.facts });
  const header = [
    `<!-- notes: ${path.basename(noteFile)}; run: ${source.label}${declaredUrl && source.retrievalUrl && declaredUrl !== source.retrievalUrl ? '; SOURCE MISMATCH: a path check, not a measure' : ''} -->`,
    '',
  ].join('\n');
  fs.writeFileSync(path.join(options.outDir, 'reconciliation.md'), `${header}${report}\n`);
  const lines = summaryLines({ noteFile: path.basename(noteFile), source, items, reconciliation });
  fs.writeFileSync(path.join(options.outDir, 'summary.txt'), `${lines.join('\n')}\n`);
  for (const line of lines) output.write(`${line}\n`);
  return { items, facts: source.facts, reconciliation, source };
}

async function main() {
  let options;
  try {
    options = parseArguments(process.argv.slice(2));
    await runReconcileBenSamples(options);
  } catch (error) {
    process.stderr.write(`${error.message || error}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = { NOTE_FIXTURES, ReconcileBenSamplesError, factsFromSnapshot, noteFilePath, parseArguments, runReconcileBenSamples, summaryLines };
