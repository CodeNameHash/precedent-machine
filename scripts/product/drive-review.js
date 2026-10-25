#!/usr/bin/env node
'use strict';

// Drive a review through the deployment's own HTTP boundary (work package
// 50, plan findings (276) and (277)): accept the queue in batches, repair
// the proposition-group mismatches PUBLISH refuses on, confirm coverage,
// publish, evaluate the release, activate it and — with --drill — roll back
// and activate again.
//
//   PRODUCT_INTERNAL_TOKEN=... VERCEL_PROTECTION_BYPASS=... \
//     node scripts/product/drive-review.js --run <run-id> [--base-url <url>] [--drill] [--dry-run]
//
// It decides ACCEPTED for every pending item, notes included, so the queue
// empties; --dry-run prints what it would do. This is the harness driving
// the loop with the owner's permission (Ben, 2026-10-25), never a lawyer's
// review: every decision is recorded against the actor the token names, and
// the review page shows them as that actor's. The driver stops at
// publication: the release evaluation needs the lawyer's own attestations
// and the activation names a release, so those two steps are taken in the
// review page's release panel, not here.

const { headersFor, DEFAULT_BASE_URL } = require('../../lib/product/preview-checks');
const {
  DEFAULT_BATCH_SIZE, acceptAll, repairGroups, publishAndRelease,
} = require('../../lib/product/review-driver');

function parseArgs(argv) {
  const args = { run: null, baseUrl: DEFAULT_BASE_URL, drill: false, dryRun: false, batchSize: DEFAULT_BATCH_SIZE };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--run') { args.run = argv[index + 1]; index += 1; continue; }
    if (argument === '--base-url') { args.baseUrl = argv[index + 1]; index += 1; continue; }
    if (argument === '--batch-size') { args.batchSize = Number.parseInt(argv[index + 1], 10); index += 1; continue; }
    if (argument === '--drill') { args.drill = true; continue; }
    if (argument === '--dry-run') { args.dryRun = true; continue; }
    throw new TypeError(`unknown argument ${argument}`);
  }
  if (!args.run) throw new TypeError('usage: drive-review.js --run <run-id> [--base-url <url>] [--drill] [--dry-run]');
  if (!Number.isInteger(args.batchSize) || args.batchSize < 1 || args.batchSize > 500) throw new TypeError('--batch-size must be 1 to 500');
  return args;
}

(async () => {
  const args = parseArgs(process.argv.slice(2));
  const token = process.env.PRODUCT_INTERNAL_TOKEN;
  if (!token) throw new TypeError('PRODUCT_INTERNAL_TOKEN is required');
  const base = String(args.baseUrl).replace(/\/+$/, '');
  const headers = { ...headersFor({ token, bypass: process.env.VERCEL_PROTECTION_BYPASS || null }), accept: 'application/json' };
  const fetchJson = async (path, { method = 'GET', body } = {}) => {
    const response = await fetch(`${base}${path}`, {
      method, headers: { ...headers, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    let parsed = null;
    try { parsed = JSON.parse(text); } catch { parsed = null; }
    return { status: response.status, body: parsed };
  };

  const started = Date.now();
  const read = await fetchJson(`/api/product/review/${args.run}`);
  if (read.status !== 200) throw new Error(`review read answered ${read.status}: ${read.body?.error || ''}`);
  let review = read.body.review;
  const pending = review.state.items.filter((item) => item.decision === 'PENDING');
  console.log(`review ${args.run}: version ${review.version}, ${review.state.items.length} items, ${pending.length} pending, status ${review.status}`);
  if (args.dryRun) {
    console.log(`would accept ${pending.length} items in ${Math.ceil(pending.length / args.batchSize)} batches of at most ${args.batchSize}, then publish${args.drill ? ', activate, roll back and activate again' : ' and activate'}.`);
    return;
  }
  const accepted = await acceptAll({
    fetchJson, runId: args.run, review, batchSize: args.batchSize,
    onBatch: ({ batch, decided, version }) => console.log(`  batch ${batch}: ${decided} decisions, version ${version} (${Math.round((Date.now() - started) / 1000)}s)`),
  });
  review = accepted.review;
  console.log(`accepted ${accepted.commands} decisions in ${accepted.batches} batches`);
  const repaired = await repairGroups({ fetchJson, runId: args.run, review, analysis: read.body.analysis });
  review = repaired.review;
  if (repaired.repairs) console.log(`repaired ${repaired.repairs} proposition-group mismatches`);
  const released = await publishAndRelease({ fetchJson, runId: args.run, review });
  for (const step of released.steps) console.log(`  ${step.step}: ${step.status}${step.active ? ` (${step.active})` : ''}${step.note ? ` — ${step.note}` : ''}`);
  const published = await fetchJson('/api/product/published-facts');
  const source = (published.body?.agreements || []).find((entry) => entry.run_id === args.run) || null;
  console.log(`published: ${published.status}, this run ${source ? `present (${source.fact_count ?? '?'} facts)` : 'not listed'}`);
  console.log(`done in ${Math.round((Date.now() - started) / 1000)}s`);
})().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
