#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const {
  DEFAULT_FAMILIES,
  DEFAULT_MAX_DEAL_CONCURRENCY,
  DEFAULT_MAX_FAMILY_CONCURRENCY,
  buildJobPlan,
  normaliseManifest,
  selectManifestItems,
} = require('../lib/ingest-job-plan');

function parseArgs(argv) {
  const args = {
    manifest: null,
    out: null,
    runId: null,
    mode: 'seed',
    backend: 'codex',
    model: 'gpt-5.5',
    offset: 0,
    limit: null,
    candidateIds: new Set(),
    maxDealConcurrency: DEFAULT_MAX_DEAL_CONCURRENCY,
    maxFamilyConcurrency: DEFAULT_MAX_FAMILY_CONCURRENCY,
    execute: false,
    enqueue: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--manifest') args.manifest = argv[++i];
    else if (arg === '--out') args.out = argv[++i];
    else if (arg === '--run-id') args.runId = argv[++i];
    else if (arg === '--mode') args.mode = argv[++i];
    else if (arg === '--backend') args.backend = argv[++i];
    else if (arg === '--model') args.model = argv[++i];
    else if (arg === '--offset') args.offset = Number(argv[++i]);
    else if (arg === '--limit') args.limit = Number(argv[++i]);
    else if (arg === '--candidate-id') args.candidateIds.add(argv[++i]);
    else if (arg === '--max-deal-concurrency') args.maxDealConcurrency = Number(argv[++i]);
    else if (arg === '--max-family-concurrency') args.maxFamilyConcurrency = Number(argv[++i]);
    else if (arg === '--execute') args.execute = true;
    else if (arg === '--enqueue') args.enqueue = true;
    else throw new Error(`Unknown arg: ${arg}`);
  }

  if (!args.manifest) throw new Error('Provide --manifest <path.json>');
  if (!['seed', 'manual', 'continuous'].includes(args.mode)) throw new Error('--mode must be seed, manual, or continuous');
  if (!['claude', 'codex'].includes(args.backend)) throw new Error('--backend must be claude or codex');
  if (!Number.isInteger(args.offset) || args.offset < 0) throw new Error('--offset must be a non-negative integer');
  if (args.limit != null && (!Number.isInteger(args.limit) || args.limit <= 0)) throw new Error('--limit must be a positive integer');
  if (!Number.isInteger(args.maxDealConcurrency) || args.maxDealConcurrency <= 0) throw new Error('--max-deal-concurrency must be a positive integer');
  if (!Number.isInteger(args.maxFamilyConcurrency) || args.maxFamilyConcurrency <= 0) throw new Error('--max-family-concurrency must be a positive integer');
  args.maxDealConcurrency = Math.min(args.maxDealConcurrency, 8);
  args.maxFamilyConcurrency = Math.min(args.maxFamilyConcurrency, 8);
  if (!args.runId) args.runId = `ingest-jobs-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  return args;
}

function findDotEnvLocal(start = path.join(__dirname, '..')) {
  let dir = start;
  for (;;) {
    const candidate = path.join(dir, '.env.local');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function loadDotEnvLocal(envPath = findDotEnvLocal()) {
  if (!envPath || !fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function stableJson(value) {
  return JSON.stringify(value, Object.keys(value || {}).sort());
}

function manifestHash(items) {
  return crypto.createHash('sha256').update(JSON.stringify(items)).digest('hex');
}

function serviceSupabase() {
  loadDotEnvLocal();
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service credentials required for --enqueue');
  return createClient(url, key);
}

async function insertEvent(sb, event) {
  const { error } = await sb.from('ingest_job_events').insert(event);
  if (error) throw new Error(`Event insert failed: ${error.message}`);
}

async function enqueuePlan(sb, plan, args, items) {
  const { error: runError } = await sb.from('ingest_runs').upsert({
    id: plan.run_id,
    mode: args.mode,
    backend: args.backend,
    model: args.model,
    status: 'queued',
    manifest: { path: args.manifest, selected: items },
    manifest_hash: manifestHash(items),
    counts: plan.counts,
    concurrency: plan.concurrency,
  }, { onConflict: 'id' });
  if (runError) throw new Error(`Run enqueue failed: ${runError.message}`);

  const jobs = plan.jobs.map((job) => ({
    id: job.id,
    run_id: job.run_id,
    kind: job.kind,
    status: 'pending',
    candidate_id: job.candidate_id || null,
    deal_id: job.deal_id || null,
    family: job.family || null,
    lock_key: job.lock_key,
    payload: {
      ...(job.payload || {}),
      url: job.url,
      deal_key: job.deal_key,
      manifest_index: job.manifest_index,
      priority_reasons: job.priority_reasons || [],
      phases: job.phases || [],
    },
    max_attempts: job.max_attempts || 1,
  }));

  const { error: jobError } = await sb.from('ingest_jobs').upsert(jobs, { onConflict: 'id' });
  if (jobError) throw new Error(`Job enqueue failed: ${jobError.message}`);

  const deps = plan.jobs.flatMap((job) => (job.depends_on || []).map((dep) => ({
    job_id: job.id,
    depends_on_job_id: dep,
  })));
  if (deps.length > 0) {
    const { error: depError } = await sb.from('ingest_job_dependencies').upsert(deps, { onConflict: 'job_id,depends_on_job_id' });
    if (depError) throw new Error(`Dependency enqueue failed: ${depError.message}`);
  }

  await sb.from('ingest_job_artifacts').insert({
    run_id: plan.run_id,
    kind: 'job-plan',
    label: 'Planned ingest jobs',
    json: plan,
  });
  await insertEvent(sb, {
    run_id: plan.run_id,
    event: 'run_enqueued',
    message: `Enqueued ${plan.counts.total_jobs} job(s)`,
    data: { counts: plan.counts, args: { ...args, candidateIds: [...args.candidateIds] } },
  });
  return { run_id: plan.run_id, jobs: jobs.length, dependencies: deps.length };
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.execute) {
    throw new Error('--execute is intentionally not wired. Use --enqueue, then run scripts/ingest-worker.js locally.');
  }

  const manifest = normaliseManifest(readJson(args.manifest));
  const items = selectManifestItems(manifest, args);
  if (items.length === 0) throw new Error('No manifest items selected');
  const plan = buildJobPlan(items, args);
  const json = `${JSON.stringify(plan, null, 2)}\n`;

  if (args.out) {
    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(args.out, json);
  } else if (!args.enqueue) {
    process.stdout.write(json);
  }

  if (args.enqueue) {
    const result = await enqueuePlan(serviceSupabase(), plan, args, items);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  }
}

module.exports = {
  DEFAULT_FAMILIES,
  DEFAULT_MAX_DEAL_CONCURRENCY,
  DEFAULT_MAX_FAMILY_CONCURRENCY,
  buildJobPlan,
  enqueuePlan,
  findDotEnvLocal,
  loadDotEnvLocal,
  manifestHash,
  normaliseManifest,
  parseArgs,
  selectManifestItems,
  serviceSupabase,
  stableJson,
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
