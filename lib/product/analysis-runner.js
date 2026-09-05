'use strict';

const {
  assembleAgreementDraft,
  buildAgreementSectionDraft,
  validateAgreementDraft,
} = require('./agreement-draft');
const { substantiveSections } = require('./source-context');

class AgreementAnalysisRunnerError extends Error {
  constructor(code, detail) {
    super(`${code}: ${detail}`);
    this.name = 'AgreementAnalysisRunnerError';
    this.code = code;
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
    try {
      const node = substantive.get(claim.node_id);
      if (!node) {
        await store.completeSection({
          runId, nodeId: claim.node_id, workerId, attemptToken: claim.attempt_token,
          costMicrousd: 0, inputTokens: 0, outputTokens: 0,
        });
        continue;
      }
      const result = await buildAgreementSectionDraft({
        sourceDocument: context.sourceDocument,
        agreementStructure: context.agreementStructure,
        legalSchema,
        model,
        node,
      });
      await store.commitSection({ runId, nodeId: claim.node_id, workerId, attemptToken: claim.attempt_token, result });
    } catch (error) {
      try {
        await store.failSection({ runId, nodeId: claim.node_id, workerId, attemptToken: claim.attempt_token, error });
      } catch {}
      throw error;
    }
  }
  const progress = await store.getProgress(runId);
  if (progress.completed !== progress.total) {
    throw new AgreementAnalysisRunnerError('RUN_INCOMPLETE', `${progress.completed}/${progress.total} section work items complete`);
  }
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
    try {
      if (!node) {
        await store.completeSection({ runId, nodeId: claim.node_id, workerId, attemptToken: claim.attempt_token });
        continue;
      }
      const result = await buildAgreementSectionDraft({
        sourceDocument: context.sourceDocument, agreementStructure: context.agreementStructure,
        legalSchema, model, node,
      });
      await store.commitSection({ runId, nodeId: claim.node_id, workerId, attemptToken: claim.attempt_token, result });
      break;
    } catch (error) {
      try { await store.failSection({ runId, nodeId: claim.node_id, workerId, attemptToken: claim.attempt_token, error }); } catch {}
      return store.getAgreementAnalysis(runId);
    }
  }
  const progress = await store.getProgress(runId);
  if (progress.completed !== progress.total) return store.getAgreementAnalysis(runId);
  const results = await store.loadCompletedSectionResults(runId);
  if (results.length !== substantive.size) return store.getAgreementAnalysis(runId);
  const draft = assembleAgreementDraft({
    sourceDocument: context.sourceDocument, agreementStructure: context.agreementStructure,
    legalSchema, results,
  });
  validateAgreementDraft(draft, { sourceDocument: context.sourceDocument, agreementStructure: context.agreementStructure, legalSchema });
  await store.finalizeDraft({ runId, draft });
  return store.getAgreementAnalysis(runId);
}

module.exports = { AgreementAnalysisRunnerError, advanceAgreementDraftAnalysis, runAgreementDraftAnalysis };
