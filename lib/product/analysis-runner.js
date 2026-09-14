'use strict';

const {
  assembleAgreementDraft,
  buildAgreementSectionDraft,
  LONG_SECTION_SPLIT,
  validateAgreementDraft,
} = require('./agreement-draft');
const { substantiveSections } = require('./source-context');
const tableShapesV3 = require('../../contracts/product/table-shapes.v3.json');

// Prompt bundle V9 (plan Phase 5B.8) asks the extractor for a coded
// conclusions readout against the table shapes. The bundle is recorded on
// the run at submission; the runner hands the shapes to every section of a
// V9 run and nothing to earlier bundles, so their prompts stay byte-identical.
// (Metsera V9 run c4c90c61, 2026-09-13: the first sections went out as V8
// because nothing passed the shapes through.)
const CONCLUSIONS_PROMPT_BUNDLE = 'PRODUCT_LAYERED_COMPONENTS/V9';
function tableShapesForRun(run) {
  return run?.prompt_bundle_version === CONCLUSIONS_PROMPT_BUNDLE ? tableShapesV3 : null;
}

class AgreementAnalysisRunnerError extends Error {
  constructor(code, detail) {
    super(`${code}: ${detail}`);
    this.name = 'AgreementAnalysisRunnerError';
    this.code = code;
  }
}

// A renewal that the store refuses as stale (the lease is held by another
// attempt or has already expired) loses the section at once. Any other
// renewal failure (a dropped connection, a transient database error) is
// retried at the next tick for as long as the lease still has time: Metsera
// generation 5, 5.01 (the interim operating covenants, extracted in parts
// over a quarter of an hour) lost its lease on one failed renewal, the
// heartbeat stopped, and the section was recorded as SECTION_LEASE_EXPIRED
// twenty minutes later while the worker was still working on it.
const STALE_LEASE = /stale section attempt|\b40001\b/i;
function isStaleLeaseError(error) {
  return STALE_LEASE.test(String(error?.message || '')) || String(error?.code || '') === '40001';
}

// A renewal that does not answer within renewTimeoutMs counts as a
// transient failure (Metsera generation 6: 2.02 lost its lease on all
// three attempts with one renewal recorded per attempt, the later ticks
// queued behind a request that never returned), so the next tick renews
// on its own request. Every renewal outcome goes to `log` when given.
const RENEW_TIMEOUT_MS = 60000;
function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label}: no answer in ${ms} ms`)), ms); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function withSectionLeaseHeartbeat({
  runId, store, claim, workerId, leaseSeconds, action, commit, now = Date.now, log = null, renewTimeoutMs = RENEW_TIMEOUT_MS,
}) {
  if (typeof store.renewSectionLease !== 'function') throw new TypeError('section lease renewal is required');
  if (typeof commit !== 'function') throw new TypeError('section commit is required');
  let stopped = false;
  let lost = null;
  let lastRenewedAt = now();
  const intervalMs = Math.max(100, Math.floor(leaseSeconds * 1000 / 3));
  const note = (event, detail) => { if (typeof log === 'function') log({ event, run_id: runId, node_id: claim.node_id, worker_id: workerId, ...detail }); };
  const renew = () => withTimeout(store.renewSectionLease({
    runId, nodeId: claim.node_id, workerId, attemptToken: claim.attempt_token, leaseSeconds,
  }), renewTimeoutMs, 'section lease renewal');
  const ticks = [];
  const timer = setInterval(() => {
    const started = now();
    const tick = renew().then(() => {
      if (stopped) return;
      lastRenewedAt = now();
      note('LEASE_RENEWED', { after_ms: lastRenewedAt - started });
    }).catch((error) => {
      if (stopped) return;
      const expired = now() - lastRenewedAt >= leaseSeconds * 1000;
      note(isStaleLeaseError(error) ? 'LEASE_STALE' : (expired ? 'LEASE_EXPIRED' : 'LEASE_RENEWAL_FAILED'), { after_ms: now() - started, error: String(error?.message || error) });
      if (!isStaleLeaseError(error) && !expired) return;
      lost = error;
      stopped = true;
      clearInterval(timer);
    });
    ticks.push(tick);
  }, intervalMs);
  const pending = { then: (resolve, reject) => Promise.allSettled(ticks).then(resolve, reject) };
  try {
    const result = await action();
    stopped = true;
    clearInterval(timer);
    await pending;
    if (lost) throw new AgreementAnalysisRunnerError('SECTION_LEASE_LOST', `${runId}:${claim.node_id}`);
    try {
      await renew();
    } catch (error) {
      note('LEASE_LOST_AT_COMMIT', { error: String(error?.message || error) });
      throw new AgreementAnalysisRunnerError('SECTION_LEASE_LOST', `${runId}:${claim.node_id}`);
    }
    return commit(result);
  } catch (error) {
    stopped = true;
    clearInterval(timer);
    await pending;
    if (lost) throw new AgreementAnalysisRunnerError('SECTION_LEASE_LOST', `${runId}:${claim.node_id}`);
    throw error;
  }
}

// A section's failure is recorded on its row and written to the log; when
// the record itself is refused it is tried once more without the model
// calls (they were recorded as they happened) and the refusal is logged
// too. Metsera generation 6, 2026-09-14: three split sections (2.02, 3.09,
// 3.11) ended five minutes into extraction with no model call and no
// failure on the row, the worker moved on, and nothing said why.
async function recordSectionFailure({ store, runId, claim, workerId, error, modelCalls, log }) {
  const note = (event, detail) => { if (typeof log === 'function') log({ event, run_id: runId, node_id: claim.node_id, worker_id: workerId, ...detail }); };
  note('SECTION_FAILED', { error: String(error?.message || error), code: error?.code || null, model_calls: modelCalls.length });
  for (const calls of [modelCalls, []]) {
    try {
      await store.failSection({
        runId, nodeId: claim.node_id, workerId, attemptToken: claim.attempt_token, error, modelCalls: calls,
      });
      return;
    } catch (recordError) {
      note('SECTION_FAILURE_RECORD_FAILED', { error: String(recordError?.message || recordError), with_model_calls: calls.length });
    }
  }
}

async function finalizeCompletedAnalysis({ runId, store, context, substantive, legalSchema }) {
  try {
    const results = await store.loadCompletedSectionResults(runId);
    if (results.length !== substantive.size) {
      throw new AgreementAnalysisRunnerError('SECTION_RESULTS_INCOMPLETE', `${results.length}/${substantive.size} substantive sections persisted`);
    }
    const draft = assembleAgreementDraft({
      sourceDocument: context.sourceDocument,
      agreementStructure: context.agreementStructure,
      legalSchema,
      results,
    });
    validateAgreementDraft(draft, {
      sourceDocument: context.sourceDocument,
      agreementStructure: context.agreementStructure,
      legalSchema,
    });
    await store.finalizeDraft({ runId, draft });
  } catch (error) {
    try {
      if (typeof store.failRun === 'function') {
        await store.failRun({ runId, stage: 'DRAFT_FINALIZATION', error });
      }
    } catch {}
    throw error;
  }
}

async function runAgreementDraftAnalysis({
  runId, store, legalSchema, model, workerId = 'product-phase2', leaseSeconds = 300, log = null,
}) {
  if (!store || typeof store.claimNextSection !== 'function' || typeof store.commitSection !== 'function') {
    throw new TypeError('a Phase 2 store is required');
  }
  const context = await store.getRunContext(runId);
  const substantive = new Map(substantiveSections(context.agreementStructure).map((node) => [node.node_id, node]));
  for (;;) {
    const claim = await store.claimNextSection({ runId, workerId, leaseSeconds });
    if (!claim) break;
    const attemptModelCalls = [];
    try {
      const node = substantive.get(claim.node_id);
      if (!node) {
        await store.completeSection({
          runId, nodeId: claim.node_id, workerId, attemptToken: claim.attempt_token,
          costMicrousd: 0, inputTokens: 0, outputTokens: 0,
        });
        continue;
      }
      await withSectionLeaseHeartbeat({
        runId, store, claim, workerId, leaseSeconds, log,
        action: () => buildAgreementSectionDraft({
          sourceDocument: context.sourceDocument,
          agreementStructure: context.agreementStructure,
          legalSchema,
          model,
          node,
          attemptToken: claim.attempt_token,
          tableShapes: tableShapesForRun(context.run),
          longSectionSplit: LONG_SECTION_SPLIT,
          onModelCall: async (call) => {
            attemptModelCalls.push(call);
            if (typeof store.recordModelCall === 'function') {
              await store.recordModelCall({
                runId, nodeId: claim.node_id, workerId, attemptToken: claim.attempt_token, call,
              });
            }
          },
        }),
        commit: (result) => store.commitSection({
          runId, nodeId: claim.node_id, workerId, attemptToken: claim.attempt_token, result,
        }),
      });
    } catch (error) {
      await recordSectionFailure({ store, runId, claim, workerId, error, modelCalls: attemptModelCalls, log });
      throw error;
    }
  }
  const progress = await store.getProgress(runId);
  if (progress.completed !== progress.total) {
    throw new AgreementAnalysisRunnerError('RUN_INCOMPLETE', `${progress.completed}/${progress.total} section work items complete`);
  }
  await finalizeCompletedAnalysis({ runId, store, context, substantive, legalSchema });
  return store.getAgreementAnalysis(runId);
}

async function advanceAgreementDraftAnalysis({
  runId, store, legalSchema, model, workerId = 'product-phase3', leaseSeconds = 300, log = null,
}) {
  const context = await store.getRunContext(runId);
  const substantive = new Map(substantiveSections(context.agreementStructure).map((node) => [node.node_id, node]));
  for (;;) {
    const claim = await store.claimNextSection({ runId, workerId, leaseSeconds });
    if (!claim) break;
    const node = substantive.get(claim.node_id);
    const attemptModelCalls = [];
    try {
      if (!node) {
        await store.completeSection({ runId, nodeId: claim.node_id, workerId, attemptToken: claim.attempt_token });
        continue;
      }
      await withSectionLeaseHeartbeat({
        runId, store, claim, workerId, leaseSeconds, log,
        action: () => buildAgreementSectionDraft({
          sourceDocument: context.sourceDocument, agreementStructure: context.agreementStructure,
          legalSchema, model, node, attemptToken: claim.attempt_token,
          tableShapes: tableShapesForRun(context.run),
          longSectionSplit: LONG_SECTION_SPLIT,
          onModelCall: async (call) => {
            attemptModelCalls.push(call);
            if (typeof store.recordModelCall === 'function') {
              await store.recordModelCall({
                runId, nodeId: claim.node_id, workerId, attemptToken: claim.attempt_token, call,
              });
            }
          },
        }),
        commit: (result) => store.commitSection({
          runId, nodeId: claim.node_id, workerId, attemptToken: claim.attempt_token, result,
        }),
      });
      break;
    } catch (error) {
      await recordSectionFailure({ store, runId, claim, workerId, error, modelCalls: attemptModelCalls, log });
      return store.getAgreementAnalysis(runId);
    }
  }
  const progress = await store.getProgress(runId);
  if (progress.completed !== progress.total) return store.getAgreementAnalysis(runId);
  await finalizeCompletedAnalysis({ runId, store, context, substantive, legalSchema });
  return store.getAgreementAnalysis(runId);
}

module.exports = {
  isStaleLeaseError,
  AgreementAnalysisRunnerError, CONCLUSIONS_PROMPT_BUNDLE, advanceAgreementDraftAnalysis, runAgreementDraftAnalysis,
  tableShapesForRun, withSectionLeaseHeartbeat,
};
