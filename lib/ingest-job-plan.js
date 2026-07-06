const DEFAULT_MAX_DEAL_CONCURRENCY = 2;
const DEFAULT_MAX_FAMILY_CONCURRENCY = 4;
const DEFAULT_FAMILIES = [
  'REP-T',
  'REP-B',
  'IOC',
  'NOSOL',
  'ANTI',
  'COND',
  'TERMR',
  'TERMF',
  'DEF',
  'CONSID',
  'STRUCT',
  'COV',
  'MISC',
];

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

function candidateKey(item, index) {
  return item.candidate_id || `manifest-${item.index ?? index}`;
}

function buildPrepareJobs(items, options) {
  const runId = options.runId;
  return items.map((item, index) => {
    const key = candidateKey(item, index);
    return {
      id: jobId(runId, 'prepare', key),
      kind: 'deal-prepare',
      status: 'planned',
      run_id: runId,
      candidate_id: item.candidate_id || null,
      deal_id: null,
      deal_key: item.deal_key || null,
      url: item.url || item.agreement_exhibit_url,
      manifest_index: item.index ?? index,
      lock_key: `candidate:${key}`,
      max_attempts: 1,
      depends_on: [],
      priority_reasons: item.priority_reasons || [],
      payload: {
        candidate: item,
      },
      phases: [
        'claim-candidate',
        'fetch-source',
        'extract-metadata',
        'create-staging-deal',
        'parse-and-classify',
        'write-classified-snapshot',
      ],
    };
  });
}

function buildFamilyJobs(prepareJob, families = DEFAULT_FAMILIES) {
  if (!prepareJob || prepareJob.kind !== 'deal-prepare') throw new Error('buildFamilyJobs requires a deal-prepare job');
  const candidate = prepareJob.candidate_id || prepareJob.manifest_index;
  return families.map((family) => ({
    id: jobId(prepareJob.run_id, 'family', candidate, family),
    kind: 'family-extract',
    status: 'planned',
    run_id: prepareJob.run_id,
    candidate_id: prepareJob.candidate_id,
    deal_id: null,
    deal_key: prepareJob.deal_key,
    url: prepareJob.url,
    family,
    lock_key: `family:${candidate}:${family}`,
    max_attempts: 2,
    depends_on: [prepareJob.id],
    payload: {
      family,
      candidate_id: prepareJob.candidate_id,
    },
    phases: [
      'load-staging-deal',
      'load-classified-sections',
      `extract-${family}`,
      'validate-family',
      'store-family-on-staging-deal',
    ],
  }));
}

function buildQaJob(prepareJob, familyJobs) {
  const candidate = prepareJob.candidate_id || prepareJob.manifest_index;
  return {
    id: jobId(prepareJob.run_id, 'qa', candidate),
    kind: 'deal-qa',
    status: 'planned',
    run_id: prepareJob.run_id,
    candidate_id: prepareJob.candidate_id,
    deal_id: null,
    deal_key: prepareJob.deal_key,
    url: prepareJob.url,
    family: null,
    lock_key: `qa:${candidate}`,
    max_attempts: 1,
    depends_on: familyJobs.map((job) => job.id),
    payload: {},
    phases: ['load-staging-deal', 'refresh-coverage-backfill', 'run-ingest-qa', 'write-qa-artifact'],
  };
}

function buildFinalizeJob(prepareJob, qaJob) {
  const candidate = prepareJob.candidate_id || prepareJob.manifest_index;
  return {
    id: jobId(prepareJob.run_id, 'finalize', candidate),
    kind: 'finalize-candidate',
    status: 'planned',
    run_id: prepareJob.run_id,
    candidate_id: prepareJob.candidate_id,
    deal_id: null,
    deal_key: prepareJob.deal_key,
    url: prepareJob.url,
    family: null,
    lock_key: `finalize:${candidate}`,
    max_attempts: 1,
    depends_on: [qaJob.id],
    payload: {},
    phases: ['mark-deal-clean', 'mark-candidate-ingested', 'write-summary-artifact'],
  };
}

function buildJobPlan(items, options) {
  const families = options.families || DEFAULT_FAMILIES;
  const prepareJobs = buildPrepareJobs(items, options);
  const jobs = [];
  for (const prepareJob of prepareJobs) {
    const familyJobs = buildFamilyJobs(prepareJob, families);
    const qaJob = buildQaJob(prepareJob, familyJobs);
    const finalizeJob = buildFinalizeJob(prepareJob, qaJob);
    jobs.push(prepareJob, ...familyJobs, qaJob, finalizeJob);
  }

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
      deal_jobs: prepareJobs.length,
      family_jobs: prepareJobs.length * families.length,
      qa_jobs: prepareJobs.length,
      finalize_jobs: prepareJobs.length,
      total_jobs: jobs.length,
    },
    jobs,
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

module.exports = {
  DEFAULT_FAMILIES,
  DEFAULT_MAX_DEAL_CONCURRENCY,
  DEFAULT_MAX_FAMILY_CONCURRENCY,
  buildFamilyJobs,
  buildFinalizeJob,
  buildJobPlan,
  buildPrepareJobs,
  buildQaJob,
  candidateKey,
  jobId,
  normaliseManifest,
  runPlanOnly,
  selectManifestItems,
};
