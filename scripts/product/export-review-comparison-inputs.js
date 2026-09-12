#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────────
   scripts/product/export-review-comparison-inputs.js — Phase 5B.6 comparison
   input export.

   Exports the two input files scripts/product/compare-review-items.js
   expects, from the private preview database, so a lead can compare a
   lawyer's V1 review of one run against the V2 layered facts of a later
   run of the same agreement.

   Usage:
     node scripts/product/export-review-comparison-inputs.js \
       --v1-run <run_id> --v2-run <run_id> --out-dir <dir>

   Reads the review state via the same RPC the review page uses
   (ProductPhase3Store#getReview, backed by product_review_sessions) and
   the V2 facts via the same analysis read the review page uses
   (ProductPhase2Store#getAgreementAnalysis), so the export matches what
   the page shows. No new SQL; no network access other than the database.

   Exit code is non-zero if either run is missing (or not yet analysed) or
   the V2 run has no proposals with a component tree.
   ───────────────────────────────────────────────────────────────────────── */

'use strict';

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { ProductPhase3Store } = require('../../lib/product/phase-3-store');

const ACTOR = 'ben';

class ExportInputsError extends Error {}

function parseArgs(argv) {
  const args = { v1Run: null, v2Run: null, outDir: null };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--v1-run') args.v1Run = argv[i += 1];
    else if (argv[i] === '--v2-run') args.v2Run = argv[i += 1];
    else if (argv[i] === '--out-dir') args.outDir = argv[i += 1];
  }
  return args;
}

// Same section-reference lookup the review page uses for a layered fact
// (lib/product/review-view.js's layeredFactExtras): the agreement structure
// node matching the item's/fact's structure_node_id.
function sectionReferenceForNode(analysis, structureNodeId) {
  if (!structureNodeId) return null;
  const node = (analysis.agreement_structure?.nodes || [])
    .find((candidate) => candidate.node_id === structureNodeId);
  return node?.reference ?? null;
}

// Only items with a comment or a non-PENDING decision are worth comparing
// against a rerun -- the same rule compareReviewItems applies internally.
function isReviewedItem(item) {
  const hasComment = typeof item.comment === 'string' && item.comment.trim().length > 0;
  const hasDecision = item.decision && item.decision !== 'PENDING';
  return hasComment || hasDecision;
}

function citedSpanIds(item) {
  const fromOriginal = (item.original && item.original.source_span_ids) || [];
  const fromItem = item.source_span_ids || [];
  return [...new Set([...fromOriginal, ...fromItem])];
}

function spanSubset(analysis, spanIds) {
  const spansById = new Map((analysis.spans || []).map((span) => [span.span_id, span]));
  const subset = {};
  for (const id of spanIds) {
    const span = spansById.get(id);
    if (span) subset[id] = { start_byte: span.start_byte, end_byte: span.end_byte, exact_text: span.exact_text };
  }
  return subset;
}

async function requireDraftAnalysis(store, runId, label) {
  let analysis;
  try {
    analysis = await store.getAgreementAnalysis(runId);
  } catch (error) {
    throw new ExportInputsError(`${label} run ${runId} could not be read: ${error.message}`);
  }
  if (!analysis || analysis.kind !== 'draftAnalysis') {
    throw new ExportInputsError(`${label} run ${runId} has no completed analysis`);
  }
  return analysis;
}

// { v1Review: { items, spans }, counts } from the run's stored review state
// (product_review_sessions, read via getReview) and its analysis spans.
async function buildV1Review({ store, runId, actor }) {
  const analysis = await requireDraftAnalysis(store, runId, 'v1');
  const review = await store.getReview({ runId, actor });
  const allItems = (review && review.state && review.state.items) || [];
  const items = allItems.filter(isReviewedItem).map((item) => ({
    ...item,
    section_reference: sectionReferenceForNode(analysis, item.structure_node_id),
  }));
  const spanIds = new Set();
  for (const item of items) for (const id of citedSpanIds(item)) spanIds.add(id);
  return {
    v1Review: { items, spans: spanSubset(analysis, spanIds) },
    counts: { totalItems: allItems.length, keptItems: items.length },
  };
}

function hasComponentTree(proposal) {
  return Array.isArray(proposal.components) && proposal.components.length > 0 && !!proposal.headline;
}

// { v2Facts, counts } from the run's analysis proposals -- every proposal
// carrying a FACT_COMPONENTS/V2 tree, shaped for compare-review-items.js.
async function buildV2Facts({ store, runId }) {
  const analysis = await requireDraftAnalysis(store, runId, 'v2');
  const proposals = analysis.proposals || [];
  const facts = proposals.filter(hasComponentTree).map((proposal) => ({
    fact_id: proposal.proposal_id,
    structure_node_id: proposal.structure_node_id,
    section_reference: sectionReferenceForNode(analysis, proposal.structure_node_id),
    headline: proposal.headline,
    components: proposal.components,
    family_key: proposal.family_key,
    subtype_key: proposal.subtype_key,
    statement: proposal.statement,
    validation_status: proposal.validation_status,
  }));
  if (facts.length === 0) throw new ExportInputsError(`v2 run ${runId} has no proposals with a component tree`);
  return { v2Facts: facts, counts: { totalProposals: proposals.length, keptFacts: facts.length } };
}

async function exportReviewComparisonInputs({ store, v1RunId, v2RunId, actor = ACTOR }) {
  const [v1, v2] = await Promise.all([
    buildV1Review({ store, runId: v1RunId, actor }),
    buildV2Facts({ store, runId: v2RunId }),
  ]);
  return { v1Review: v1.v1Review, v2Facts: v2.v2Facts, counts: { v1: v1.counts, v2: v2.counts } };
}

function createStore() {
  return new ProductPhase3Store({
    client: createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  });
}

// Builds the export with an injectable store, writes the two files, and
// prints counts. Throws on missing runs / an empty V2 fact set; the caller
// (main) turns that into a non-zero exit code.
async function runExportReviewComparisonInputs(options, output = process.stdout, dependencies = {}) {
  if (!options || !options.v1RunId || !options.v2RunId || !options.outDir) {
    throw new TypeError('--v1-run, --v2-run and --out-dir are required');
  }
  const makeStore = dependencies.createStore || createStore;
  const store = makeStore();
  const result = await exportReviewComparisonInputs({ store, v1RunId: options.v1RunId, v2RunId: options.v2RunId });
  fs.mkdirSync(options.outDir, { recursive: true });
  fs.writeFileSync(path.join(options.outDir, 'v1-review.json'), `${JSON.stringify(result.v1Review, null, 2)}\n`);
  fs.writeFileSync(path.join(options.outDir, 'v2-facts.json'), `${JSON.stringify(result.v2Facts, null, 2)}\n`);
  output.write(`v1 review items: ${result.counts.v1.keptItems} of ${result.counts.v1.totalItems} exported (decided or commented)\n`);
  output.write(`v1 spans exported: ${Object.keys(result.v1Review.spans).length}\n`);
  output.write(`v2 facts: ${result.counts.v2.keptFacts} of ${result.counts.v2.totalProposals} proposals have a component tree\n`);
  return result;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.v1Run || !args.v2Run || !args.outDir) {
    process.stderr.write('usage: export-review-comparison-inputs.js --v1-run <run_id> --v2-run <run_id> --out-dir <dir>\n');
    process.exitCode = 1;
    return;
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    process.stderr.write('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required\n');
    process.exitCode = 1;
    return;
  }
  try {
    await runExportReviewComparisonInputs({ v1RunId: args.v1Run, v2RunId: args.v2Run, outDir: args.outDir });
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  parseArgs,
  isReviewedItem,
  sectionReferenceForNode,
  hasComponentTree,
  buildV1Review,
  buildV2Facts,
  exportReviewComparisonInputs,
  runExportReviewComparisonInputs,
  ExportInputsError,
};
