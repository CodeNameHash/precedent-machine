'use strict';

const { ProductPhase1StoreError } = require('./phase-1-store');
const { ProductPhase3Store } = require('./phase-3-store');
const { applyReviewCommand, initialiseReviewState, ProductReviewError } = require('./review-state');
const { ProductReleaseEvaluationError } = require('./release-evaluation');
const { ProductRequestAuthError, getProductActor, requireSameOriginMutation } = require('./request-auth');
const legalSchema = require('../../contracts/product/legal-schema.v1.json');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function reviewTimingHistory(review) {
  const publications = [...(review.publications || [])]
    .sort((left, right) => (right.publication_version || 0) - (left.publication_version || 0));
  if (publications.length === 0) return { hasPriorPublication: false };
  const latestPublication = publications[0];
  const draftTransitions = (review.revisions || []).filter((revision) => (
    ['REOPEN', 'RESTORE'].includes(revision.event_type)
    && revision.version > latestPublication.review_version
  )).sort((left, right) => (left.version || 0) - (right.version || 0));
  return {
    hasPriorPublication: true,
    accumulatedDraftSeconds: latestPublication.metrics?.review_time_seconds,
    activeDraftStartedAt: draftTransitions[0]?.created_at,
  };
}

function createProductReviewHandler({ getClient, storeFactory = (client) => new ProductPhase3Store({ client }), actorResolver = getProductActor, clock } = {}) {
  if (typeof getClient !== 'function') throw new TypeError('getClient is required');
  return async function productReviewHandler(req, res) {
    res.setHeader('Cache-Control', 'private, no-store');
    const runId = Array.isArray(req.query?.id) ? req.query.id[0] : req.query?.id;
    if (!UUID.test(runId || '')) return res.status(400).json({ error: 'Invalid analysis run ID' });
    if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' });
    try {
      const actor = await actorResolver(req);
      if (req.method === 'POST') requireSameOriginMutation(req);
      const client = getClient();
      if (!client) return res.status(500).json({ error: 'Product database is not configured' });
      const store = storeFactory(client);
      await store.assertAccess({ runId, actor });
      const analysis = await store.getAgreementAnalysis(runId);
      if (analysis.kind !== 'draftAnalysis') return res.status(409).json({ error: 'Analysis is not ready', analysis });
      let review = await store.getReview({ runId, actor });
      if (!review) review = await store.initialiseReview({ runId, state: initialiseReviewState(analysis), actor });
      if (req.method === 'GET') return res.status(200).json({ schema_version: 'PRODUCT_REVIEW_WORKSPACE/V1', analysis, review });
      const body = req.body || {};
      if (!Number.isInteger(body.expected_version) || typeof body.idempotency_key !== 'string' || !body.command) {
        return res.status(400).json({ error: 'Invalid review command' });
      }
      if (body.command.type === 'RESTORE') {
        review = await store.restoreReview({
          runId, expectedVersion: body.expected_version, restoreVersion: body.command.restore_version,
          actor, idempotencyKey: body.idempotency_key,
        });
      } else {
        const command = body.command.type === 'EVALUATE_RELEASE'
          ? { ...body.command, reviewer_identity: actor }
          : body.command;
        const timing = body.command.type === 'EVALUATE_RELEASE' ? await store.getReleaseTiming({ runId }) : undefined;
        const state = applyReviewCommand(review.state, command, {
          analysis, legalSchema, timing, clock, reviewHistory: reviewTimingHistory(review),
        });
        const eventType = ['PUBLISH', 'REOPEN', 'EVALUATE_RELEASE', 'ACTIVATE_RELEASE', 'ROLLBACK_RELEASE'].includes(body.command.type)
          ? body.command.type : 'SAVE';
        review = await store.saveReview({
          runId, expectedVersion: body.expected_version, state, actor, eventType,
          idempotencyKey: body.idempotency_key, command,
        });
      }
      review = await store.getReview({ runId, actor });
      return res.status(200).json({ schema_version: 'PRODUCT_REVIEW_WORKSPACE/V1', analysis, review });
    } catch (error) {
      if (error instanceof ProductRequestAuthError) return res.status(error.code === 'CSRF_REQUIRED' ? 403 : 401).json({ error: error.code });
      if (error instanceof ProductReviewError) return res.status(422).json({ error: error.code, message: error.message });
      if (error instanceof ProductReleaseEvaluationError) return res.status(422).json({ error: error.code, message: error.message });
      if (error instanceof ProductPhase1StoreError && error.code === 'OPTIMISTIC_LOCK_CONFLICT') return res.status(409).json({ error: error.code });
      if (error instanceof ProductPhase1StoreError && error.code === 'ACCESS_DENIED') return res.status(404).json({ error: 'Analysis run not found' });
      console.error('[product-review]', error);
      return res.status(500).json({ error: 'Product review could not be updated' });
    }
  };
}

module.exports = { createProductReviewHandler };
