#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const DEFAULT_MAX_DEAL_CONCURRENCY = 2;
const DEFAULT_MAX_FAMILY_CONCURRENCY = 4;
const DEFAULT_FAMILIES = [
  'REP-T',
  'REP-B',
  'IOC',
  'COND',
  'TERMR',
  'TERMF',
  'DEF',
  'CONSID',
  'STRUCT',
  'COV',
  'MISC',
];

function parseArgs(argv) {
  const args = {
    manifest: null,
    out: null,
    runId: null,
    offset: 0,
    limit: null,
    candidateIds: new Set(),
    maxDealConcurrency: DEFAULT_MAX_DEAL_CONCURRENCY,
    maxFamilyConcurrency: DEFAULT_MAX_FAMILY_CONCURRENCY,
    execute: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--manifest') args.manifest = argv[++i];
    else if (arg === '--out') args.out = argv[++i];
    else if (arg === '--run-id') args.runId = argv[++i];
    else if (arg === '--offset') args.offset = Number(argv[++i]);
    else if (arg === '--limit') args.limit = Number(argv[++i]);
    else if (arg === '--candidate-id') args.candidateIds.add(argv[++i]);
    else if (arg === '--max-deal-concurrency') args.maxDealConcurrency = Number(argv[++i]);
    else if (arg === '--max-family-concurrency') args.maxFamilyConcurrency = Number(argv[++i]);
    else if (arg === '--execute') args.execute = true;
    else throw new Error(`Unknown arg: ${arg}`);
  }

  if (!args.manifest) throw new Error('Provide --manifest <path.json>');
  if (!Number.isInteger(args.offset) || args.offset < 0) throw new Error('--offset must be a non-negative integer');
  if (args.limit != null && (!Number.isInteger(args.limit) || args.limit <= 0)) throw new Error('--limit must be a positive integer');
  if (!Number.isInteger(args.maxDealConcurrency) || args.maxDealConcurrency <= 0) throw new Error('--max-deal-concurrency must be a positive integer');
  if (!Number.isInteger(args.maxFamilyConcurrency) || args.maxFamilyConcurrency <= 0) throw new Error('--max-family-concurrency must be a positive integer');
  args.maxDealConcurrency = Math.min(args.maxDealConcurrency, 2);
  args.maxFamilyConcurrency = Math.min(args.maxFamilyConcurrency, 6);
  if (!args.runId) args.runId = `ingest-jobs-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normaliseManifest(raw) {
  const rows = Array.isArray(raw) ? raw : raw.candidates;
  if (!Array.isArray(rows)) throw new Error('Manifest must be an array or an object with a candidates array');

  return rows.map((row, index) => {
    if (typeof row === 'string') {
      return {
        index,
        candidate_id: null,
        url: row,
        agreement_exhibit_url: row,
        priority_reasons: [],
      };
    }
    const url = row.agreement_exhibit_url || row.url;
    if (!url) throw new Error(`Manifest row ${index} is missing agreement_exhibit_url/url`);
    return {
      ...row,
      index,
      candidate_id: row.candidate_id || row.id || null,
      url,
      agreement_exhibit_url: url,
      priority_reasons: Array.isArray(row.priority_reasons) ? row.priority_reasons : [],
    };
  });
}

function selectManifestItems(items, args) {
  let selected = [...items];
  if (args.candidateIds && args.candidateIds.size > 0) {
    selected = selected.filter((item) => item.candidate_id && args.candidateIds.has(item.candidate_id));
  }
  if (args.offset) selected = selected.slice(args.offset);
  if (args.limit != null) selected = selected.slice(0, args.limit);
  return selected;
}

function slugPart(value, fallback = 'unknown') {
  return String(value || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || fallback;
}

function jobId(...parts) {
  return parts.map((part) => slugPart(part)).join(':');
}

function buildDealJobs(items, options) {
  const runId = options.runId;
  return items.map((item, index) => {
    const candidateId = item.candidate_id || `manifest-${item.index ?? index}`;
    return {
      id: jobId(runId, 'deal', candidateId),
      kind: 'deal-ingest',
      status: 'planned',
      run_id: runId,
      candidate_id: item.candidate_id || null,
      deal_key: item.deal_key || null,
      url: item.url || item.agreement_exhibit_url,
      manifest_index: item.index ?? index,
      lock_key: `candidate:${candidateId}`,
      max_attempts: 1,
      depends_on: [],
      priority_reasons: item.priority_reasons || [],
      phases: [
        'claim-candidate',
        'fetch-source',
        'parse-and-classify',
        'extract-all-families',
        'validate',
        'store',
        'qa',
      ],
    };
  });
}

function buildFamilyJobs(dealJob, families = DEFAULT_FAMILIES) {
  if (!dealJob || dealJob.kind !== 'deal-ingest') throw new Error('buildFamilyJobs requires a deal-ingest job');
  return families.map((family) => ({
    id: jobId(dealJob.run_id, 'family', dealJob.candidate_id || dealJob.manifest_index, family),
    kind: 'family-extract',
    status: 'planned',
    run_id: dealJob.run_id,
    candidate_id: dealJob.candidate_id,
    deal_key: dealJob.deal_key,
    url: dealJob.url,
    family,
    lock_key: `family:${dealJob.candidate_id || dealJob.manifest_index}:${family}`,
    max_attempts: 2,
    depends_on: [dealJob.id],
    phases: [
      'load-classified-sections',
      `extract-${family}`,
      'validate-family',
      'write-family-staging',
    ],
  }));
}

function buildJobPlan(items, options) {
  const dealJobs = buildDealJobs(items, options);
  const familyJobs = dealJobs.flatMap((dealJob) => buildFamilyJobs(dealJob, options.families || DEFAULT_FAMILIES));
  return {
    generated_at: (options.now || (() => new Date()))().toISOString(),
    run_id: options.runId,
    mode: 'plan-only',
    safety: {
      ingestion_executed: false,
      writes_production_data: false,
      execute_supported: false,
    },
    concurrency: {
      deals: options.maxDealConcurrency,
      families_per_deal: options.maxFamilyConcurrency,
    },
    counts: {
      deal_jobs: dealJobs.length,
      family_jobs: familyJobs.length,
      total_jobs: dealJobs.length + familyJobs.length,
    },
    jobs: [...dealJobs, ...familyJobs],
  };
}

async function runPlanOnly(plan, worker) {
  if (typeof worker !== 'function') return plan.jobs.map((job) => ({ id: job.id, status: 'planned' }));
  const results = [];
  for (const job of plan.jobs) {
    results.push(await worker(job));
  }
  return results;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.execute) {
    throw new Error('--execute is intentionally not wired yet. This command only plans resumable ingest jobs.');
  }

  const manifest = normaliseManifest(readJson(args.manifest));
  const items = selectManifestItems(manifest, args);
  const plan = buildJobPlan(items, args);
  const json = `${JSON.stringify(plan, null, 2)}\n`;

  if (args.out) {
    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(args.out, json);
  } else {
    process.stdout.write(json);
  }
}

module.exports = {
  DEFAULT_FAMILIES,
  DEFAULT_MAX_DEAL_CONCURRENCY,
  DEFAULT_MAX_FAMILY_CONCURRENCY,
  buildDealJobs,
  buildFamilyJobs,
  buildJobPlan,
  jobId,
  normaliseManifest,
  parseArgs,
  runPlanOnly,
  selectManifestItems,
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
