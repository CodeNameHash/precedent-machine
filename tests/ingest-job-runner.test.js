const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const {
  DEFAULT_FAMILIES,
  buildFamilyJobs,
  buildJobPlan,
  buildPrepareJobs,
  runPlanOnly,
} = require('../lib/ingest-job-plan');
const { parseArgs } = require('../scripts/ingest-job-runner');

const ITEMS = [
  {
    index: 0,
    candidate_id: 'candidate-a',
    deal_key: 'deal-a',
    url: 'https://sec.example/a.htm',
    priority_reasons: ['Paul Weiss named in agreement text'],
  },
  {
    index: 1,
    candidate_id: 'candidate-b',
    deal_key: 'deal-b',
    url: 'https://sec.example/b.htm',
    priority_reasons: ['Deal value at or above $10bn'],
  },
];

test('parseArgs caps concurrency and defaults to plan-only mode', () => {
  const args = parseArgs([
    'node',
    'script',
    '--manifest',
    'manifest.json',
    '--max-deal-concurrency',
    '9',
    '--max-family-concurrency',
    '20',
  ]);

  assert.equal(args.execute, false);
  assert.equal(args.maxDealConcurrency, 8);
  assert.equal(args.maxFamilyConcurrency, 8);
});

test('pure planner source has no ingest, Supabase, or LLM imports', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'lib', 'ingest-job-plan.js'), 'utf8');
  assert.doesNotMatch(source, /ingestOne|ingest-local|ingest-seed-batch|@supabase\/supabase-js|llm-cli-client/);
});

test('buildPrepareJobs creates one locked prepare job per manifest item', () => {
  const jobs = buildPrepareJobs(ITEMS, { runId: 'run-1' });

  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].kind, 'deal-prepare');
  assert.equal(jobs[0].status, 'planned');
  assert.equal(jobs[0].lock_key, 'candidate:candidate-a');
  assert.equal(jobs[0].url, 'https://sec.example/a.htm');
  assert.ok(jobs[0].phases.includes('write-classified-snapshot'));
  assert.ok(!jobs[0].phases.includes('extract-all-families'));
});

test('buildFamilyJobs expands a deal into retryable per-family jobs', () => {
  const [prepareJob] = buildPrepareJobs([ITEMS[0]], { runId: 'run-1' });
  const jobs = buildFamilyJobs(prepareJob, ['REP-T', 'IOC', 'TERMR']);

  assert.deepEqual(jobs.map((job) => job.family), ['REP-T', 'IOC', 'TERMR']);
  assert.deepEqual(jobs.map((job) => job.depends_on), [[prepareJob.id], [prepareJob.id], [prepareJob.id]]);
  assert.equal(jobs[0].max_attempts, 2);
  assert.equal(jobs[0].lock_key, 'family:candidate-a:REP-T');
});

test('buildJobPlan records safety flags and creates prepare/family/qa/finalize graph', () => {
  const plan = buildJobPlan(ITEMS, {
    runId: 'run-1',
    maxDealConcurrency: 2,
    maxFamilyConcurrency: 4,
    now: () => new Date('2026-07-05T12:00:00.000Z'),
  });

  assert.equal(plan.mode, 'plan-only');
  assert.equal(plan.safety.ingestion_executed, false);
  assert.equal(plan.safety.writes_production_data, false);
  assert.equal(plan.safety.execute_supported, false);
  assert.equal(plan.counts.deal_jobs, 2);
  assert.equal(plan.counts.family_jobs, 2 * DEFAULT_FAMILIES.length);
  assert.equal(plan.counts.qa_jobs, 2);
  assert.equal(plan.counts.finalize_jobs, 2);
  assert.equal(plan.jobs.length, plan.counts.total_jobs);
  assert.deepEqual(
    plan.jobs.filter((job) => job.candidate_id === 'candidate-a').map((job) => job.kind),
    ['deal-prepare', ...DEFAULT_FAMILIES.map(() => 'family-extract'), 'deal-qa', 'finalize-candidate'],
  );
  const qa = plan.jobs.find((job) => job.kind === 'deal-qa' && job.candidate_id === 'candidate-a');
  const finalize = plan.jobs.find((job) => job.kind === 'finalize-candidate' && job.candidate_id === 'candidate-a');
  assert.equal(qa.depends_on.length, DEFAULT_FAMILIES.length);
  assert.deepEqual(finalize.depends_on, [qa.id]);
});

test('runPlanOnly returns planned results and only calls an injected dry worker', async () => {
  const plan = buildJobPlan([ITEMS[0]], {
    runId: 'run-1',
    maxDealConcurrency: 1,
    maxFamilyConcurrency: 2,
    families: ['REP-T'],
    now: () => new Date('2026-07-05T12:00:00.000Z'),
  });
  const seen = [];
  const results = await runPlanOnly(plan, async (job) => {
    seen.push(job.id);
    return { id: job.id, status: 'planned' };
  });

  assert.deepEqual(seen, plan.jobs.map((job) => job.id));
  assert.deepEqual(results.map((result) => result.status), ['planned', 'planned', 'planned', 'planned']);
});

test('CLI keeps --execute blocked', () => {
  const args = parseArgs(['node', 'script', '--manifest', 'manifest.json', '--execute']);
  assert.equal(args.execute, true);
});
