'use strict';

const { sha256Hex } = require('../canonical-v2/canonical-bytes');
const { ProductPhase2Store } = require('./phase-2-store');
const { ProductPhase1StoreError } = require('./phase-1-store');

function storeError(name, error) {
  const message = error?.message || `${name} failed`;
  const code = /optimistic lock/i.test(message) ? 'OPTIMISTIC_LOCK_CONFLICT'
    : /access denied|belongs to another/i.test(message) ? 'ACCESS_DENIED'
      : /idempotency collision/i.test(message) ? 'IDEMPOTENCY_CONFLICT'
        : /publishable|not ready|not reopened/i.test(message) ? 'REVIEW_NOT_PUBLISHABLE' : 'DATABASE_ERROR';
  return new ProductPhase1StoreError(code, message, error);
}

class ProductPhase3Store extends ProductPhase2Store {
  async assignRunOwner({ runId, actor }) {
    const { data, error } = await this.client.rpc('product_phase3_register_run_access', { p_run_id: runId, p_actor: actor });
    if (error) throw storeError('assignRunOwner', error);
    return data;
  }

  async assertAccess({ runId, actor }) {
    const result = await this.client.from('product_run_access').select('access_role').eq('run_id', runId).eq('actor', actor).maybeSingle();
    if (result.error) throw storeError('assertAccess', result.error);
    if (!result.data) throw new ProductPhase1StoreError('ACCESS_DENIED', 'run access denied');
    return result.data.access_role;
  }

  async retryRun({ runId, actor, idempotencyKey }) {
    const { data, error } = await this.client.rpc('product_phase3_retry_run', {
      p_run_id: runId, p_actor: actor, p_idempotency_key: idempotencyKey,
    });
    if (error) throw storeError('retryRun', error);
    return data;
  }

  async getReview({ runId, actor }) {
    const { data, error } = await this.client.rpc('product_phase3_get_review', { p_run_id: runId, p_actor: actor });
    if (error) throw storeError('getReview', error);
    return data;
  }

  async listReferenceSources({ actor }) {
    const { data, error } = await this.client.rpc('product_phase3_list_reference_sources', { p_actor: actor });
    if (error) throw storeError('listReferenceSources', error);
    return Array.isArray(data) ? data : [];
  }

  async getReleaseTiming({ runId }) {
    const run = await this.getRun(runId);
    const result = await this.client.from('product_draft_analyses').select('created_at').eq('run_id', runId).maybeSingle();
    if (result.error) throw storeError('getReleaseTiming', result.error);
    if (!run || !result.data) throw new ProductPhase1StoreError('DATABASE_ERROR', 'release timing is not available');
    return { processingStartedAt: run.created_at, processingCompletedAt: result.data.created_at };
  }

  async initialiseReview({ runId, state, actor }) {
    const { data, error } = await this.client.rpc('product_phase3_initialise_review', { p_run_id: runId, p_state: state, p_actor: actor });
    if (error) throw storeError('initialiseReview', error);
    return data;
  }

  async saveReview({ runId, expectedVersion, state, actor, eventType, idempotencyKey, command }) {
    const actionId = sha256Hex(`${runId}\u001f${actor}\u001f${idempotencyKey}`);
    const { data, error } = await this.client.rpc('product_phase3_save_review', {
      p_run_id: runId,
      p_expected_version: expectedVersion,
      p_state: state,
      p_actor: actor,
      p_event_type: eventType,
      p_action_id: actionId,
      p_idempotency_key: idempotencyKey,
      p_command: command,
    });
    if (error) throw storeError('saveReview', error);
    return data;
  }

  async listPublishedLayeredFacts({ familyKey = null, subtypeKey = null } = {}) {
    const heads = await this.client.from('product_agreement_release_heads').select('source_document_id, release_id');
    if (heads.error) throw storeError('listPublishedLayeredFacts', heads.error);
    const releases = await this.client.from('product_agreement_releases')
      .select('release_id, source_document_id, run_id, summary, published_at');
    if (releases.error) throw storeError('listPublishedLayeredFacts', releases.error);
    const sources = await this.client.from('product_source_documents').select('source_document_id, retrieval_url');
    if (sources.error) throw storeError('listPublishedLayeredFacts', sources.error);

    const releaseById = new Map((releases.data || []).map((release) => [release.release_id, release]));
    const retrievalUrlByDocumentId = new Map((sources.data || []).map((source) => [source.source_document_id, source.retrieval_url]));

    return (heads.data || []).map((head) => {
      const release = releaseById.get(head.release_id);
      if (!release) throw new ProductPhase1StoreError('DATABASE_ERROR', `release head ${head.release_id} has no matching release`);
      const families = Array.isArray(release.summary?.families) ? release.summary.families : [];
      const facts = families
        .flatMap((family) => (Array.isArray(family.facts) ? family.facts : []))
        .filter((fact) => Array.isArray(fact?.components))
        .filter((fact) => !familyKey || fact.family_key === familyKey)
        .filter((fact) => !subtypeKey || fact.subtype_key === subtypeKey);
      return {
        run_id: release.run_id,
        source_document_id: head.source_document_id,
        agreement_label: retrievalUrlByDocumentId.get(head.source_document_id) || head.source_document_id,
        released_at: release.published_at,
        facts,
      };
    }).sort((left, right) => left.agreement_label.localeCompare(right.agreement_label));
  }

  async restoreReview({ runId, expectedVersion, restoreVersion, actor, idempotencyKey }) {
    const command = { type: 'RESTORE', restore_version: restoreVersion };
    const actionId = sha256Hex(`${runId}\u001f${actor}\u001f${idempotencyKey}`);
    const { data, error } = await this.client.rpc('product_phase3_restore_review', {
      p_run_id: runId, p_expected_version: expectedVersion, p_restore_version: restoreVersion,
      p_actor: actor, p_action_id: actionId, p_idempotency_key: idempotencyKey,
    });
    if (error) throw storeError('restoreReview', error);
    return data;
  }
}

module.exports = { ProductPhase3Store };
