#!/usr/bin/env node
'use strict';

// Publish a review over a direct Postgres connection instead of the REST
// proxy (work package 52, plan finding (285)).
//
// Why: Supabase's REST API sits behind Cloudflare, whose origin timeout is
// about 100 seconds. The publish of a review is one transaction that carries
// the whole 7 MB state twice (the session row and the revision) and validates
// every item, so on a real agreement's review it runs past that limit and the
// proxy answers 520 while the same command publishes locally in milliseconds
// (finding (284)). A direct connection has no such proxy in front of it.
//
//   DATABASE_URL='postgres://...' PRODUCT_INTERNAL_TOKEN=... \
//     node scripts/product/publish-direct.js --run <run-id> [--base-url <url>] [--actor <name>] [--dry-run]
//
// It reads the analysis and the review through the REST API (the reads fit
// the proxy), applies PUBLISH locally with the same command layer the route
// uses, and then calls product_private.product_phase3_save_review on the
// direct connection. Every other event (evaluate, activate, rollback) is a
// small write and stays on the REST route.

const crypto = require('node:crypto');
const { headersFor, DEFAULT_BASE_URL } = require('../../lib/product/preview-checks');
const { applyReviewCommand } = require('../../lib/product/review-state');

function actionIdFor(runId, actor, idempotencyKey) {
  return crypto.createHash('sha256').update(`${runId}\u001f${actor}\u001f${idempotencyKey}`, 'utf8').digest('hex');
}

function publishArgs({ runId, actor, idempotencyKey, expectedVersion, state }) {
  return {
    p_run_id: runId,
    p_expected_version: expectedVersion,
    p_state: state,
    p_actor: actor,
    p_event_type: 'PUBLISH',
    p_action_id: actionIdFor(runId, actor, idempotencyKey),
    p_idempotency_key: idempotencyKey,
    p_command: { type: 'PUBLISH' },
  };
}

function parseArgs(argv) {
  const args = { run: null, baseUrl: DEFAULT_BASE_URL, actor: process.env.AUTH_USERNAME || 'ben', dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--run') { args.run = argv[index + 1]; index += 1; continue; }
    if (argv[index] === '--base-url') { args.baseUrl = argv[index + 1]; index += 1; continue; }
    if (argv[index] === '--actor') { args.actor = argv[index + 1]; index += 1; continue; }
    if (argv[index] === '--dry-run') { args.dryRun = true; continue; }
    throw new TypeError(`unknown argument ${argv[index]}`);
  }
  if (!args.run) throw new TypeError('usage: publish-direct.js --run <run-id> [--base-url <url>] [--actor <name>] [--dry-run]');
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const token = process.env.PRODUCT_INTERNAL_TOKEN;
  const databaseUrl = process.env.DATABASE_URL;
  if (!token) throw new TypeError('PRODUCT_INTERNAL_TOKEN is required for the REST reads');
  const base = String(args.baseUrl).replace(/\/+$/, '');
  const headers = { ...headersFor({ token, bypass: process.env.VERCEL_PROTECTION_BYPASS || null }), accept: 'application/json' };
  const get = async (path) => {
    const response = await fetch(`${base}${path}`, { headers });
    const text = await response.text();
    if (response.status !== 200) throw new Error(`${path} answered ${response.status}: ${text.slice(0, 200)}`);
    return JSON.parse(text);
  };
  const workspace = await get(`/api/product/review/${args.run}`);
  const review = workspace.review;
  const legalSchema = require(`../../contracts/product/legal-schema.${String(workspace.analysis.legal_schema_version || 'V2').toLowerCase().replace('legal_schema/', '')}.json`);
  console.log(`review ${args.run}: version ${review.version}, status ${review.status}, ${review.state.items.length} items`);
  const state = applyReviewCommand(review.state, { type: 'PUBLISH' }, { analysis: workspace.analysis, legalSchema, clock: () => new Date() });
  console.log(`publish would set status ${state.status} with ${(state.summary?.families || []).flatMap((family) => family.facts).length} facts`);
  if (args.dryRun) return;
  if (!databaseUrl) throw new TypeError('DATABASE_URL is required to publish over the direct connection');
  const { Client } = require('pg');
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const argsForRpc = publishArgs({
      runId: args.run, actor: args.actor, idempotencyKey: `publish-direct-${review.version}`,
      expectedVersion: review.version, state,
    });
    const result = await client.query(
      'select product_private.product_phase3_save_review($1, $2, $3::jsonb, $4, $5, $6, $7, $8::jsonb) as review',
      [argsForRpc.p_run_id, argsForRpc.p_expected_version, JSON.stringify(argsForRpc.p_state), argsForRpc.p_actor,
        argsForRpc.p_event_type, argsForRpc.p_action_id, argsForRpc.p_idempotency_key, JSON.stringify(argsForRpc.p_command)],
    );
    const saved = result.rows[0].review;
    console.log(`published: version ${saved.version}, status ${saved.status}`);
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  });
}

module.exports = { actionIdFor, publishArgs, parseArgs };
