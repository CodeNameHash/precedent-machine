'use strict';

const { buildAgreementStructure } = require('./agreement-structure');

const INPUT_KEYS = Object.freeze([
  'url', 'idempotencyKey', 'schemaVersion', 'promptBundleVersion',
  'modelConfig', 'explicitGeneration', 'maxAttempts',
]);

function normaliseInput(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('submit input must be an object');
  if (Object.keys(value).some((key) => !INPUT_KEYS.includes(key))) throw new TypeError('submit input has unexpected fields');
  const input = { explicitGeneration: 0, maxAttempts: 3, ...value };
  for (const key of ['url', 'idempotencyKey', 'schemaVersion', 'promptBundleVersion']) {
    if (typeof input[key] !== 'string' || input[key].length === 0) throw new TypeError(`${key} is required`);
  }
  if (!input.modelConfig || typeof input.modelConfig !== 'object' || Array.isArray(input.modelConfig)) throw new TypeError('modelConfig is required');
  if (!Number.isInteger(input.explicitGeneration) || input.explicitGeneration < 0) throw new TypeError('explicitGeneration must be a non-negative integer');
  if (!Number.isInteger(input.maxAttempts) || input.maxAttempts < 1) throw new TypeError('maxAttempts must be positive');
  return Object.freeze(input);
}

function createPhase1Foundation({ secIntake, store, structureBuilder = buildAgreementStructure } = {}) {
  if (!secIntake || typeof secIntake.intake !== 'function') throw new TypeError('secIntake.intake is required');
  if (!store || typeof store.findRunBySubmission !== 'function') throw new TypeError('store is required');
  if (typeof structureBuilder !== 'function') throw new TypeError('structureBuilder must be a function');
  return Object.freeze({
    async submit(value) {
      const input = normaliseInput(value);
      const existingRun = await store.findRunBySubmission(input);
      if (existingRun) {
        const attached = await store.getStructureForRun(existingRun.run_id);
        if (attached || existingRun.status === 'FAILED') return existingRun;
      }

      let source = await store.findSourceDocumentByUrl(input.url);
      if (!source) {
        source = await secIntake.intake({ url: input.url });
        if (!source || source.schema_version !== 'SOURCE_DOCUMENT/V1') throw new Error('intake must return SOURCE_DOCUMENT/V1');
        source = await store.persistSourceDocument(source);
      }

      const run = existingRun || await store.createOrGetRun({
        sourceDocumentId: source.source_document_id,
        retrievalUrl: source.retrieval_url,
        idempotencyKey: input.idempotencyKey,
        schemaVersion: input.schemaVersion,
        promptBundleVersion: input.promptBundleVersion,
        modelConfig: input.modelConfig,
        explicitGeneration: input.explicitGeneration,
        maxAttempts: input.maxAttempts,
      });
      const existingStructure = await store.getStructureForRun(run.run_id);
      if (existingStructure) return run;
      try {
        const structure = await store.findStructureBySource(source.source_document_id)
          || await structureBuilder(source);
        const identityReview = source.identity_status === 'NEEDS_REVIEW'
          ? { reasons: source.identity_review_reasons } : null;
        return await store.attachStructure({ runId: run.run_id, structure, identityReview });
      } catch (error) {
        await store.failRun({ runId: run.run_id, stage: 'STRUCTURE', error });
        throw error;
      }
    },
  });
}

module.exports = { createPhase1Foundation };
