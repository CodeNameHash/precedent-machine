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

async function withSectionLeaseHeartbeat({ runId, store, claim, workerId, leaseSeconds, action, commit, now = Date.now }) {
  if (typeof store.renewSectionLease !== 'function') throw new TypeError('section lease renewal is required');
  if (typeof commit !== 'function') throw new TypeError('section commit is required');
  let stopped = false;
  let lost = null;
  let pending = Promise.resolve();
  let lastRenewedAt = now();
  const intervalMs = Math.max(100, Math.floor(leaseSeconds * 1000 / 3));
  const timer = setInterval(() => {
    pending = pending.then(async () => {
      if (stopped) return;
      await store.renewSectionLease({
        runId, nodeId: claim.node_id, workerId, attemptToken: claim.attempt_token, leaseSeconds,
      });
      lastRenewedAt = now();
    }).catch((error) => {
      if (stopped) return;
      const expired = now() - lastRenewedAt >= leaseSeconds * 1000;
      if (!isStaleLeaseError(error) && !expired) return;
      lost = error;
      stopped = true;
      clearInterval(timer);
    });
  }, intervalMs);
  try {
    const result = await action();
    stopped = true;
    clearInterval(timer);
    await pending;
    if (lost) throw new AgreementAnalysisRunnerError('SECTION_LEASE_LOST', `${runId}:${claim.node_id}`);
    try {
      await store.renewSectionLease({
        runId, nodeId: claim.node_id, workerId, attemptToken: claim.attempt_token, leaseSeconds,
      });
    } catch {
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
  runId, store, legalSchema, model, workerId = 'product-phase2', leaseSeconds = 300,
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
        runId, store, claim, workerId, leaseSeconds,
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
      try {
        await store.failSection({
          runId, nodeId: claim.node_id, workerId, attemptToken: claim.attempt_token,
          error, modelCalls: attemptModelCalls,
        });
      } catch {}
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
  runId, store, legalSchema, model, workerId = 'product-phase3', leaseSeconds = 300,
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
        runId, store, claim, workerId, leaseSeconds,
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
      try {
        await store.failSection({
          runId, nodeId: claim.node_id, workerId, attemptToken: claim.attempt_token,
          error, modelCalls: attemptModelCalls,
        });
      } catch {}
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
