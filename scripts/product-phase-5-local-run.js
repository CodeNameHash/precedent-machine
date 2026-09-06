'use strict';

const { createClient } = require('@supabase/supabase-js');
const { advanceAgreementDraftAnalysis } = require('../lib/product/analysis-runner');
const { createCodexCliProductModel } = require('../lib/product/codex-cli-model');
const { ProductPhase3Store } = require('../lib/product/phase-3-store');
const {
  CODEX_MODEL_CONFIG, assertConfiguredRunModelConfig,
} = require('../lib/product/product-model-config');
const legalSchema = require('../contracts/product/legal-schema.v1.json');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DISPOSABLE_BRANCH_REF = 'ecrtoofsyxozazkvsvcl';
const DIAGNOSTIC_SOURCE_DOCUMENT_ID = '238dc3fed996667b9124a853745708a003917bcb28c889bad703f6124d13e721';
const ARGUMENTS = new Set(['run-id', 'actor', 'retry-key', 'workers']);

function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || value === undefined) throw new TypeError('arguments must be --name value pairs');
    const name = key.slice(2);
    if (!ARGUMENTS.has(name)) throw new TypeError(`unknown argument --${name}`);
    values[name] = value;
  }
  const workers = Number(values.workers || 2);
  if (!UUID.test(values['run-id'] || '')) throw new TypeError('--run-id must be a UUID');
  if (!values.actor) throw new TypeError('--actor is required');
  if (!Number.isInteger(workers) || workers < 1 || workers > 2) throw new TypeError('--workers must be 1 or 2');
  return { runId: values['run-id'], actor: values.actor, retryKey: values['retry-key'] || null, workers };
}

function assertDatabaseTarget(urlValue) {
  const url = new URL(urlValue);
  if (url.protocol !== 'https:' || url.hostname !== `${DISPOSABLE_BRANCH_REF}.supabase.co`) {
    throw new Error(`PRODUCT_PHASE5_DATABASE_TARGET: expected frozen disposable branch ${DISPOSABLE_BRANCH_REF}`);
  }
}

function retryLimitError(runId, item) {
  return new Error(`PRODUCT_PHASE5_RETRY_LIMIT: run=${runId}; node=${item.node_id}; attempts=${item.attempts}/${item.max_attempts}`);
}

function assertDiagnosticRunTarget(runId, run) {
  if (!run || run.run_id !== runId || run.source_document_id !== DIAGNOSTIC_SOURCE_DOCUMENT_ID) {
    throw new Error(`PRODUCT_PHASE5_RUN_TARGET: expected Public Storage diagnostic source ${DIAGNOSTIC_SOURCE_DOCUMENT_ID}`);
  }
}

function makeStore() {
  return new ProductPhase3Store({
    client: createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  });
}

async function run(options, output = process.stdout) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('product database environment is required');
  assertDatabaseTarget(process.env.SUPABASE_URL);
  const control = makeStore();
  const runRecord = await control.getRun(options.runId);
  assertDiagnosticRunTarget(options.runId, runRecord);
  assertConfiguredRunModelConfig(runRecord, CODEX_MODEL_CONFIG);
  await control.recoverExpiredSections({ runId: options.runId });
  await control.assignRunOwner({ runId: options.runId, actor: options.actor });
  if (options.retryKey) await control.retryRun({ runId: options.runId, actor: options.actor, idempotencyKey: options.retryKey });
  const started = Date.now();
  const worker = async (number) => {
    const store = makeStore();
    const model = createCodexCliProductModel({ modelConfig: runRecord.model_config });
    let previous = '';
    for (;;) {
      const analysis = await advanceAgreementDraftAnalysis({
        runId: options.runId, store, legalSchema, model,
        workerId: `product-phase5-local-${number}`, leaseSeconds: 900,
      });
      const progress = analysis.progress || {};
      const marker = `${analysis.status}:${analysis.stage}:${progress.completed}:${progress.failed}`;
      if (marker !== previous) {
        output.write(`${JSON.stringify({
          worker: number, status: analysis.status, stage: analysis.stage,
          completed: progress.completed, total: progress.total, failed: progress.failed,
          input_tokens: progress.input_tokens, output_tokens: progress.output_tokens,
          cost_microusd: progress.cost_microusd,
          elapsed_seconds: Math.round((Date.now() - started) / 1000),
        })}\n`);
        previous = marker;
      }
      if (analysis.status === 'READY') return;
      if (analysis.status === 'FAILED') throw new Error(`PRODUCT_PHASE5_RUN_FAILED: ${analysis.stage}`);
      const failed = await store.client.from('product_section_work')
        .select('node_id,attempts,max_attempts').eq('run_id', options.runId).eq('status', 'FAILED');
      if (failed.error) throw failed.error;
      const exhausted = (failed.data || []).find((item) => item.attempts >= item.max_attempts);
      if (exhausted) throw retryLimitError(options.runId, exhausted);
    }
  };
  await Promise.all(Array.from({ length: options.workers }, (_, index) => worker(index + 1)));
}

if (require.main === module) {
  run(parseArguments(process.argv.slice(2))).catch((error) => {
    process.stderr.write(`${error.name || 'Error'}: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  DIAGNOSTIC_SOURCE_DOCUMENT_ID, DISPOSABLE_BRANCH_REF, assertDatabaseTarget,
  assertDiagnosticRunTarget, parseArguments, retryLimitError, run,
};
