'use strict';

const { canonicalJson, contentId } = require('../canonical-v2/canonical-bytes');

class ProductPhase1StoreError extends Error {
  constructor(code, message, cause) {
    super(`${code}: ${message}`, cause ? { cause } : undefined);
    this.name = 'ProductPhase1StoreError';
    this.code = code;
  }
}

function requiredString(value, label) {
  if (typeof value !== 'string' || value.length === 0) throw new TypeError(`${label} is required`);
  return value;
}

function rpcError(name, error) {
  const message = error?.message || `${name} failed`;
  const code = /idempotency key/i.test(message) ? 'IDEMPOTENCY_CONFLICT'
    : /optimistic lock/i.test(message) ? 'OPTIMISTIC_LOCK_CONFLICT'
      : /stale section/i.test(message) ? 'STALE_SECTION_ATTEMPT' : 'DATABASE_ERROR';
  return new ProductPhase1StoreError(code, message, error);
}

class ProductPhase1Store {
  constructor({ client } = {}) {
    if (!client || typeof client.rpc !== 'function' || typeof client.from !== 'function') {
      throw new TypeError('a server-side Supabase client is required');
    }
    this.client = client;
  }

  async _rpc(name, parameters) {
    const { data, error } = await this.client.rpc(name, parameters);
    if (error) throw rpcError(name, error);
    return data;
  }

  async persistSourceDocument(source) {
    return this._rpc('product_phase1_persist_source', { p_source: source });
  }

  async findSourceDocumentByUrl(url) {
    const { data, error } = await this.client.from('product_source_documents')
      .select('payload').eq('retrieval_url', url).maybeSingle();
    if (error) throw rpcError('findSourceDocumentByUrl', error);
    return data?.payload || null;
  }

  async findRunBySubmission({ url, idempotencyKey, schemaVersion, promptBundleVersion, modelConfig, explicitGeneration = 0, maxAttempts = 3 }) {
    const request = await this.client.from('product_submission_requests')
      .select('run_id').eq('idempotency_key', idempotencyKey).maybeSingle();
    if (request.error) throw rpcError('findRunBySubmission', request.error);
    if (!request.data) return null;
    const result = await this.client.from('product_analysis_runs')
      .select('*').eq('run_id', request.data.run_id).maybeSingle();
    if (result.error) throw rpcError('findRunBySubmission', result.error);
    if (!result.data) throw new ProductPhase1StoreError('DATABASE_ERROR', 'submission request has no analysis run');
    const data = result.data;
    const matches = data.retrieval_url === url && data.schema_version === schemaVersion
      && data.prompt_bundle_version === promptBundleVersion && canonicalJson(data.model_config) === canonicalJson(modelConfig)
      && data.explicit_generation === explicitGeneration && data.max_attempts === maxAttempts;
    if (!matches) throw new ProductPhase1StoreError('IDEMPOTENCY_CONFLICT', 'idempotency key was already used for a different submission');
    return data;
  }

  async createOrGetRun({ sourceDocumentId, retrievalUrl, idempotencyKey, schemaVersion, promptBundleVersion, modelConfig, explicitGeneration = 0, maxAttempts = 3 }) {
    return this._rpc('product_phase1_create_run', {
      p_source_document_id: requiredString(sourceDocumentId, 'sourceDocumentId'),
      p_retrieval_url: requiredString(retrievalUrl, 'retrievalUrl'),
      p_idempotency_key: requiredString(idempotencyKey, 'idempotencyKey'),
      p_schema_version: requiredString(schemaVersion, 'schemaVersion'),
      p_prompt_bundle_version: requiredString(promptBundleVersion, 'promptBundleVersion'),
      p_model_config: modelConfig,
      p_explicit_generation: explicitGeneration,
      p_max_attempts: maxAttempts,
    });
  }

  async attachStructure({ runId, structure, identityReview = null }) {
    const structureId = contentId('AGREEMENT_STRUCTURE/V1', structure);
    return this._rpc('product_phase1_attach_structure', {
      p_run_id: requiredString(runId, 'runId'),
      p_structure_id: structureId,
      p_structure: structure,
      p_identity_review: identityReview,
    });
  }

  async failRun({ runId, stage, error }) {
    return this._rpc('product_phase1_fail_run', {
      p_run_id: requiredString(runId, 'runId'),
      p_stage: requiredString(stage, 'stage'),
      p_error: { message: error instanceof Error ? error.message : String(error) },
    });
  }

  async resolveIdentityReview({ runId, resolution }) {
    return this._rpc('product_phase1_resolve_identity', { p_run_id: runId, p_resolution: resolution });
  }

  async getRun(runId) {
    const { data, error } = await this.client.from('product_analysis_runs').select('*').eq('run_id', runId).maybeSingle();
    if (error) throw rpcError('getRun', error);
    return data || null;
  }

  async getStructureForRun(runId) {
    const mapping = await this.client.from('product_run_structures').select('structure_id').eq('run_id', runId).maybeSingle();
    if (mapping.error) throw rpcError('getStructureForRun', mapping.error);
    if (!mapping.data) return null;
    const result = await this.client.from('product_agreement_structures').select('payload').eq('structure_id', mapping.data.structure_id).maybeSingle();
    if (result.error) throw rpcError('getStructureForRun', result.error);
    return result.data?.payload || null;
  }

  async claimNextSection({ runId, workerId, leaseSeconds = 300 }) {
    return this._rpc('product_phase1_claim_section', { p_run_id: runId, p_worker_id: workerId, p_lease_seconds: leaseSeconds });
  }

  async recoverExpiredSections({ runId }) {
    return this._rpc('product_phase1_recover_expired_sections', { p_run_id: runId });
  }

  async renewSectionLease({ runId, nodeId, workerId, attemptToken, leaseSeconds }) {
    return this._rpc('product_phase1_renew_section_lease', {
      p_run_id: runId, p_node_id: nodeId, p_worker_id: workerId,
      p_attempt_token: attemptToken, p_lease_seconds: leaseSeconds,
    });
  }

  async completeSection({ runId, nodeId, workerId, attemptToken, costMicrousd = 0, inputTokens = 0, outputTokens = 0 }) {
    return this._rpc('product_phase1_complete_section', {
      p_run_id: runId, p_node_id: nodeId, p_worker_id: workerId, p_attempt_token: attemptToken,
      p_cost_microusd: costMicrousd, p_input_tokens: inputTokens, p_output_tokens: outputTokens,
    });
  }

  async failSection({ runId, nodeId, workerId, attemptToken, error }) {
    return this._rpc('product_phase1_fail_section', {
      p_run_id: runId, p_node_id: nodeId, p_worker_id: workerId, p_attempt_token: attemptToken,
      p_error: { message: error instanceof Error ? error.message : String(error) },
    });
  }

  async getProgress(runId) {
    const { data, error } = await this.client.from('product_section_work')
      .select('status,cost_microusd,input_tokens,output_tokens').eq('run_id', runId);
    if (error) throw rpcError('getProgress', error);
    return (data || []).reduce((progress, row) => ({
      total: progress.total + 1,
      completed: progress.completed + Number(row.status === 'COMPLETE'),
      failed: progress.failed + Number(row.status === 'FAILED'),
      cost_microusd: progress.cost_microusd + Number(row.cost_microusd),
      input_tokens: progress.input_tokens + Number(row.input_tokens),
      output_tokens: progress.output_tokens + Number(row.output_tokens),
    }), { total: 0, completed: 0, failed: 0, cost_microusd: 0, input_tokens: 0, output_tokens: 0 });
  }

  async getDraftForRun(runId) {
    const { data, error } = await this.client.from('product_drafts').select('*').eq('run_id', runId).maybeSingle();
    if (error) throw rpcError('getDraftForRun', error);
    return data || null;
  }

  async saveDraft({ draftId, expectedVersion, state, actor }) {
    requiredString(actor, 'actor');
    return this._rpc('product_phase1_save_draft', {
      p_draft_id: draftId, p_expected_version: expectedVersion, p_state: state, p_actor: actor,
    });
  }

  async snapshot() {
    const tables = ['product_source_documents', 'product_analysis_runs', 'product_submission_requests',
      'product_agreement_structures', 'product_run_structures', 'product_document_identity_reviews', 'product_section_work',
      'product_drafts', 'product_draft_revisions', 'product_draft_audit_events'];
    const entries = await Promise.all(tables.map(async (table) => {
      const { data, error } = await this.client.from(table).select('*');
      if (error) throw rpcError(`snapshot:${table}`, error);
      return [table, data || []];
    }));
    return Object.fromEntries(entries);
  }
}

module.exports = { ProductPhase1Store, ProductPhase1StoreError };
