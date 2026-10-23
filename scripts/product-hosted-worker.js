'use strict';

const { createClient } = require('@supabase/supabase-js');
const { legalSchemaForVersion } = require('../lib/product/legal-schema-selection');
const { advanceAgreementDraftAnalysis } = require('../lib/product/analysis-runner');
const { createHostedProductModel } = require('../lib/product/claude-cli-model');
const { ProductPhase3Store } = require('../lib/product/phase-3-store');
const {
  ANTHROPIC_API_PROVIDER_ID, CLAUDE_CLI_PROVIDER_ID, DEEPSEEK_API_PROVIDER_ID, assertConfiguredRunModelConfig, hostedModelConfigFor, isHostedProvider,
} = require('../lib/product/product-model-config');
const { assertDisposableDatabaseUrl } = require('../lib/product/sandbox-wake');
const { workerStopReason } = require('../lib/product/worker-stop');
const { hostedWorkerId, isWorkerStopRequested, releaseDeadClaims } = require('../lib/product/attempt-resume');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDLE_WAIT_MS = 1000;
// The signals a stop arrives on (work package D3, plan finding (142)): the
// worker finishes the call in flight, hands its claims back with the parts
// done on the row, and exits with the reason; a plain wake resumes.
const STOP_SIGNALS = Object.freeze(['SIGTERM', 'SIGINT', 'SIGHUP']);
const SANDBOX_NAME_PATTERN = /^[a-z0-9-]{1,60}$/;

function sandboxNameFromEnv(env = process.env) {
  const name = env.PRODUCT_SANDBOX_NAME;
  return typeof name === 'string' && SANDBOX_NAME_PATTERN.test(name) ? name : null;
}
const MAX_WORKERS = 8;
function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || value === undefined) throw new TypeError('arguments must be --name value pairs');
    const name = key.slice(2);
    if (!['run-id', 'actor', 'workers'].includes(name)) throw new TypeError(`unknown argument --${name}`);
    values[name] = value;
  }
  if (!UUID.test(values['run-id'] || '')) throw new TypeError('--run-id must be a UUID');
  if (values.actor !== 'ben') throw new TypeError('--actor must be ben');
  // Work package E1 (implementer E): up to eight section loops on one
  // sandbox (the sections are independent and 97 per cent of a
  // generation's call time is output generation); two unless the wake
  // says otherwise (launch.sh reads PRODUCT_HOSTED_WORKERS).
  const workers = Number(values.workers || 2);
  if (!Number.isInteger(workers) || workers < 1 || workers > MAX_WORKERS) throw new TypeError(`--workers must be 1 to ${MAX_WORKERS}`);
  return { runId: values['run-id'], actor: values.actor, workers };
}

function createStore() {
  return new ProductPhase3Store({
    client: createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  });
}

async function runHostedWorker(options, output = process.stdout, dependencies = {}) {
  // A stop requested by a signal (or by the caller's `stop` in tests): the
  // loops end after the call in flight, the attempt is released, not failed.
  const stop = { requested: false, signal: null };
  const requestStop = (signal) => {
    if (stop.requested) return;
    stop.requested = true;
    stop.signal = signal;
    output.write(`${JSON.stringify({ at: new Date().toISOString(), event: 'WORKER_STOP_REQUESTED', signal, run_id: options?.runId || null })}\n`);
  };
  const signals = dependencies.signals === false ? [] : STOP_SIGNALS;
  for (const signal of signals) process.on(signal, () => requestStop(signal));
  if (typeof dependencies.onStopHandle === 'function') dependencies.onStopHandle(requestStop);
  try {
    return await runHostedWorkerLoops(options, output, dependencies, stop);
  } finally {
    for (const signal of signals) process.removeAllListeners(signal);
  }
}

async function runHostedWorkerLoops(options, output, dependencies, stop) {
  if (!options || !UUID.test(options.runId || '') || options.actor !== 'ben' || !Number.isInteger(options.workers) || options.workers < 1 || options.workers > MAX_WORKERS) {
    throw new TypeError('invalid hosted worker options');
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('PRODUCT_HOSTED_DATABASE_ENV_REQUIRED');
  }
  assertDisposableDatabaseUrl(process.env.SUPABASE_URL);
  const makeStore = dependencies.createStore || createStore;
  const makeModel = dependencies.createModel || createHostedProductModel;
  const advance = dependencies.advance || advanceAgreementDraftAnalysis;
  const store = makeStore();
  const run = await store.getRun(options.runId);
  const legalSchema = legalSchemaForVersion(run?.schema_version);
  // The run's own model_config names the provider (Codex CLI or Claude CLI);
  // it must be that provider's canonical config, and a Claude run needs the
  // subscription login the wake passed in.
  const providerId = run?.model_config?.provider_id;
  if (!isHostedProvider(providerId)) throw new Error('PRODUCT_RUN_MODEL_CONFIG_MISMATCH: not a hosted provider');
  assertConfiguredRunModelConfig(run, hostedModelConfigFor(providerId, run));
  if (providerId === CLAUDE_CLI_PROVIDER_ID && !process.env.CLAUDE_CODE_OAUTH_TOKEN) {
    throw new Error('PRODUCT_HOSTED_CLAUDE_LOGIN_REQUIRED');
  }
  // The API path (work package 3) needs the key the wake passed in;
  // ANTHROPIC_WORKSPACE_ID beside it is optional (work package 11) and the
  // model reads it from the environment itself.
  if (providerId === ANTHROPIC_API_PROVIDER_ID && !process.env.ANTHROPIC_API_KEY) {
    throw new Error('PRODUCT_HOSTED_ANTHROPIC_API_KEY_REQUIRED');
  }
  // DeepSeek's key reaches the worker the same way (2026-10-23).
  if (providerId === DEEPSEEK_API_PROVIDER_ID && !process.env.DEEPSEEK_API_KEY) {
    throw new Error('PRODUCT_HOSTED_DEEPSEEK_API_KEY_REQUIRED');
  }
  await store.assertAccess({ runId: options.runId, actor: options.actor });
  if (run.stage === 'DOCUMENT_IDENTITY_REVIEW') throw new Error('PRODUCT_HOSTED_IDENTITY_REVIEW_REQUIRED');
  if (run.status === 'READY') return run;
  if (run.status === 'FAILED') throw new Error('PRODUCT_HOSTED_EXPLICIT_RETRY_REQUIRED');
  // After a restart (work package D3): the claims a dead process of this
  // sandbox still holds are handed back now, with the parts they completed
  // on the row, instead of waiting the lease out with no record.
  const sandbox = dependencies.sandbox === undefined ? sandboxNameFromEnv() : dependencies.sandbox;
  const released = await releaseDeadClaims({
    store, runId: options.runId, sandbox, isAlive: dependencies.isAlive,
    log: (event) => output.write(`${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`),
  });
  if (released.length > 0) output.write(`${JSON.stringify({ event: 'DEAD_CLAIMS_RELEASED', run_id: options.runId, sections: released.length })}\n`);

  let lastReportedMarker = '';
  let stopped = false;
  const worker = async (number) => {
    try {
      const workerStore = number === 1 ? store : makeStore();
      const model = makeModel(run);
      let priorMarker = '';
      while (!stopped && !stop.requested) {
        await workerStore.recoverExpiredSections({ runId: options.runId });
        if (stopped || stop.requested) break;
        const analysis = await advance({
          runId: options.runId, store: workerStore, legalSchema, model,
          workerId: hostedWorkerId({ sandbox, pid: process.pid, loop: number }), leaseSeconds: 900,
          stopRequested: () => stop.requested,
          // Every lease renewal outcome on the worker's output (tee'd to
          // the sandbox log by launch.sh): generation 6 lost 2.02 three
          // times to an expired lease with nothing to read.
          log: (event) => output.write(`${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`),
        });
        const progress = analysis.progress || {};
        const marker = `${analysis.status}:${analysis.stage}:${progress.completed}:${progress.failed}`;
        const progressed = marker !== priorMarker;
        priorMarker = marker;
        if (marker !== lastReportedMarker) {
          output.write(`${JSON.stringify({
            run_id: options.runId, status: analysis.status, stage: analysis.stage,
            completed: progress.completed, total: progress.total, failed: progress.failed,
            input_tokens: progress.input_tokens, output_tokens: progress.output_tokens,
            cost_microusd: progress.cost_microusd,
          })}\n`);
          lastReportedMarker = marker;
        }
        if (analysis.status === 'READY') {
          stopped = true;
          return analysis;
        }
        if (analysis.status === 'FAILED') throw new Error(`PRODUCT_HOSTED_RUN_FAILED: ${analysis.stage}`);
        if (analysis.stage === 'DOCUMENT_IDENTITY_REVIEW') throw new Error('PRODUCT_HOSTED_IDENTITY_REVIEW_REQUIRED');
        if (!progressed && !stopped) await new Promise((resolve) => setTimeout(resolve, IDLE_WAIT_MS));
      }
      return null;
    } catch (error) {
      stopped = true;
      // A stop the worker asked for (a signal; work package D3): the attempt
      // was handed back by the runner; the worker exits with the reason.
      if (isWorkerStopRequested(error)) throw new Error(`PRODUCT_HOSTED_WORKER_STOPPED: ${stop.signal || 'stop requested'}`);
      // A usage limit on the Codex or Claude login or the API account, or
      // an API key the account refuses for want of its workspace header,
      // is not a section failure: the worker stops with the reason so the
      // run can be woken again once the account has credits or the
      // configuration is fixed (Metsera generation 5, 2026-09-14;
      // generation 7 at 19:29 UTC, the Claude session limit; NCS
      // generation 5 on the API, 2026-10-18, finding (73)). The section
      // loop rethrows such an error after one recorded attempt
      // (lib/product/worker-stop.js). The usage-limit code keeps its name.
      const stopReason = workerStopReason(error);
      if (stopReason) throw new Error(`${stopReason}: ${error.message}`);
      throw error;
    }
  };
  const workers = Array.from({ length: options.workers }, (_, index) => worker(index + 1));
  try {
    return (await Promise.all(workers)).find(Boolean);
  } catch (error) {
    await Promise.allSettled(workers);
    throw error;
  }
}

if (require.main === module) {
  runHostedWorker(parseArguments(process.argv.slice(2))).catch((error) => {
    process.stderr.write(`${error.name || 'Error'}: ${error.message}\n`);
    // 143 as a SIGTERM exit: the launcher's log says the worker stopped on
    // request, not that it failed.
    process.exitCode = /^PRODUCT_HOSTED_WORKER_STOPPED/.test(error.message) ? 143 : 1;
  });
}

module.exports = { STOP_SIGNALS, parseArguments, runHostedWorker, sandboxNameFromEnv };
