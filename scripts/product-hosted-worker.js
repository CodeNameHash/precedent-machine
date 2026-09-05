'use strict';

const { createClient } = require('@supabase/supabase-js');
const legalSchema = require('../contracts/product/legal-schema.v1.json');
const { advanceAgreementDraftAnalysis } = require('../lib/product/analysis-runner');
const { createCodexCliProductModel } = require('../lib/product/codex-cli-model');
const { ProductPhase3Store } = require('../lib/product/phase-3-store');
const {
  CODEX_MODEL_CONFIG, assertConfiguredRunModelConfig,
} = require('../lib/product/product-model-config');
const { assertDisposableDatabaseUrl } = require('../lib/product/sandbox-wake');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDLE_WAIT_MS = 1000;
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
  const workers = Number(values.workers || 2);
  if (!Number.isInteger(workers) || workers < 1 || workers > 2) throw new TypeError('--workers must be 1 or 2');
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
  if (!options || !UUID.test(options.runId || '') || options.actor !== 'ben' || ![1, 2].includes(options.workers)) {
    throw new TypeError('invalid hosted worker options');
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('PRODUCT_HOSTED_DATABASE_ENV_REQUIRED');
  }
  assertDisposableDatabaseUrl(process.env.SUPABASE_URL);
  const makeStore = dependencies.createStore || createStore;
  const makeModel = dependencies.createModel || createCodexCliProductModel;
  const advance = dependencies.advance || advanceAgreementDraftAnalysis;
  const store = makeStore();
  const run = await store.getRun(options.runId);
  assertConfiguredRunModelConfig(run, CODEX_MODEL_CONFIG);
  await store.assertAccess({ runId: options.runId, actor: options.actor });
  if (run.stage === 'DOCUMENT_IDENTITY_REVIEW') throw new Error('PRODUCT_HOSTED_IDENTITY_REVIEW_REQUIRED');
  if (run.status === 'READY') return run;
  if (run.status === 'FAILED') throw new Error('PRODUCT_HOSTED_EXPLICIT_RETRY_REQUIRED');

  let lastReportedMarker = '';
  let stopped = false;
  const worker = async (number) => {
    try {
      const workerStore = number === 1 ? store : makeStore();
      const model = makeModel();
      let priorMarker = '';
      while (!stopped) {
        await workerStore.recoverExpiredSections({ runId: options.runId });
        if (stopped) break;
        const analysis = await advance({
          runId: options.runId, store: workerStore, legalSchema, model,
          workerId: `product-hosted:${process.pid}:${number}`, leaseSeconds: 900,
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
    process.exitCode = 1;
  });
}

module.exports = { parseArguments, runHostedWorker };
