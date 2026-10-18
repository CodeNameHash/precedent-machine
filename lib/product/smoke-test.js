'use strict';

// Phase 6, "Run an outside-in smoke test" (plan section 6): the product's
// own boundaries from the outside, in the order a lawyer meets them, and
// nothing behind them. Dry run only: the intake is submitted (the route
// fetches the SEC exhibit, stores the source and the structure, and
// returns a run), the run status, the provisions page read and the
// published read are read, and the run route that wakes the worker is
// never called, so no model call and no cost follow from this script.
// Starting a generation stays scripts/product/start-generation.js's job.
//
// The intake's own rule (product_phase1_create_run): a submission whose
// fingerprint (source, schema, prompt bundle, model config, explicit
// generation, attempts) matches an earlier run returns that run; any other
// fingerprint creates the next generation as a QUEUED run with no worker.
// The report says which happened.

const crypto = require('node:crypto');
const { previewFactsFromWorkspace } = require('./provisions-preview');
const { sourceAgreement } = require('./release-candidate');

async function step(name, fn) {
  const startedAt = Date.now();
  try {
    const detail = await fn();
    return { name, ok: true, ms: Date.now() - startedAt, ...detail };
  } catch (error) {
    return { name, ok: false, ms: Date.now() - startedAt, error: error.message || String(error), status: error.status ?? null };
  }
}

// runSmokeTest({ client, secUrl, generation, runId, pages }) -> { ok, steps }
// With `runId` and no `secUrl`, the intake step is skipped and the reads
// run against that run.
async function runSmokeTest({ client, secUrl = null, generation = 0, runId = null, pages = true } = {}) {
  if (!client) throw new TypeError('client is required');
  if (!secUrl && !runId) throw new TypeError('secUrl or runId is required');
  const steps = [];
  let run = runId;
  let knownRuns = null;
  if (secUrl) {
    steps.push(await step('intake (dry run, no worker woken)', async () => {
      const submitted = await client.submitIntake({
        url: secUrl, idempotencyKey: `smoke:${crypto.randomUUID()}`, explicitGeneration: generation, maxAttempts: 3,
      });
      run = submitted.run_id;
      return { run_id: submitted.run_id, source_document_id: submitted.source_document_id, generation: submitted.generation, run_status: submitted.status, stage: submitted.stage };
    }));
    if (!run) return { ok: false, run_id: null, steps };
  }
  steps.push(await step('run status', async () => {
    const analysis = await client.getAnalysis(run);
    knownRuns = analysis;
    return {
      kind: analysis.kind, run_status: analysis.status, stage: analysis.stage,
      progress: analysis.progress ? { completed: analysis.progress.completed, total: analysis.progress.total, failed: analysis.progress.failed } : null,
      model_provider: analysis.model_provider || null,
      ...(analysis.kind === 'draftAnalysis' ? { proposals: (analysis.proposals || []).length, legal_schema_version: analysis.legal_schema_version } : {}),
    };
  }));
  steps.push(await step('provisions page read', async () => {
    const workspace = await client.getPreview(run);
    const preview = previewFactsFromWorkspace(workspace);
    return {
      progress: workspace.progress, sections_completed: workspace.progress?.completed ?? null, sections_total: workspace.progress?.total ?? null,
      layered_facts: preview.facts.length, held: preview.held_count, review_status: workspace.review?.state?.status || null,
    };
  }));
  steps.push(await step('published read', async () => {
    const sourceDocumentId = knownRuns?.source_document?.source_document_id || knownRuns?.source_identity?.source_document_id || null;
    const published = await client.getPublishedFacts();
    const agreement = sourceDocumentId ? sourceAgreement(published, sourceDocumentId) : null;
    return { agreements_published: (published.agreements || []).length, this_source: agreement };
  }));
  // The page shells need a deployment: an in-process client has none.
  if (pages && client.base_url && typeof client.getPage === 'function') {
    for (const path of [`/review/product/${run}/provisions`, `/review/product/${run}`, '/query/provisions']) {
      steps.push(await step(`page ${path}`, async () => {
        const page = await client.getPage(path);
        if (page === null) return { skipped: 'no page shell in-process' };
        if (page.status !== 200 || !page.html) throw Object.assign(new Error(`page answered ${page.status}${page.html ? '' : ' without HTML'}`), { status: page.status });
        return { status: page.status, bytes: page.length };
      }));
    }
  }
  return { ok: steps.every((entry) => entry.ok), run_id: run, steps };
}

function renderSmokeTest(result) {
  const lines = [];
  for (const entry of result.steps) {
    const { name, ok, ms, error, status, ...detail } = entry;
    lines.push(`${ok ? 'pass' : 'FAIL'} ${name} (${ms} ms)${ok ? '' : `: ${error}${status ? ` [${status}]` : ''}`}`);
    for (const [key, value] of Object.entries(detail)) {
      if (value === undefined) continue;
      lines.push(`  ${key}: ${typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value)}`);
    }
  }
  lines.push(result.ok ? `smoke test passed for run ${result.run_id}` : `smoke test FAILED${result.run_id ? ` for run ${result.run_id}` : ''}`);
  return lines.join('\n');
}

module.exports = { runSmokeTest, renderSmokeTest };
