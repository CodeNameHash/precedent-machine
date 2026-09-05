'use strict';

const { ProductPhase1Store, ProductPhase1StoreError } = require('./phase-1-store');
const { SECTION_DRAFT_VERSION } = require('./agreement-draft');

function rpcError(name, error) {
  const message = error?.message || `${name} failed`;
  const code = /stale section/i.test(message) ? 'STALE_SECTION_ATTEMPT'
    : /collision|duplicate key/i.test(message) ? 'PERSISTENCE_CONFLICT'
      : /incomplete|identity review/i.test(message) ? 'RUN_NOT_FINALIZABLE' : 'DATABASE_ERROR';
  return new ProductPhase1StoreError(code, message, error);
}

function byNode(items, nodeKey = 'structure_node_id') {
  const map = new Map();
  for (const item of items) {
    const nodeId = item[nodeKey];
    if (!map.has(nodeId)) map.set(nodeId, []);
    map.get(nodeId).push(item);
  }
  return map;
}

class ProductPhase2Store extends ProductPhase1Store {
  async commitSection({ runId, nodeId, workerId, attemptToken, result }) {
    const { data, error } = await this.client.rpc('product_phase2_commit_section', {
      p_run_id: runId,
      p_node_id: nodeId,
      p_worker_id: workerId,
      p_attempt_token: attemptToken,
      p_result: result,
    });
    if (error) throw rpcError('commitSection', error);
    return data;
  }

  async finalizeDraft({ runId, draft }) {
    const { data, error } = await this.client.rpc('product_phase2_finalize_draft', { p_run_id: runId, p_draft: draft });
    if (error) throw rpcError('finalizeDraft', error);
    return data;
  }

  async getAgreementAnalysis(runId) {
    const { data, error } = await this.client.rpc('product_phase2_get_analysis', { p_run_id: runId });
    if (error) throw rpcError('getAgreementAnalysis', error);
    return data;
  }

  async getRunContext(runId) {
    const run = await this.getRun(runId);
    if (!run) throw new ProductPhase1StoreError('DATABASE_ERROR', 'analysis run not found');
    const sourceResult = await this.client.from('product_source_documents')
      .select('payload').eq('source_document_id', run.source_document_id).maybeSingle();
    if (sourceResult.error || !sourceResult.data) throw rpcError('getRunContext:source', sourceResult.error);
    const structure = await this.getStructureForRun(runId);
    if (!structure) throw new ProductPhase1StoreError('DATABASE_ERROR', 'AgreementStructure not found');
    return { run, sourceDocument: sourceResult.data.payload, agreementStructure: structure };
  }

  async loadCompletedSectionResults(runId) {
    const tableNames = [
      'product_section_results', 'product_model_calls', 'product_source_closures', 'product_source_spans',
      'product_source_closure_spans', 'product_section_routings', 'product_proposition_groups',
      'product_proposals', 'product_fact_links', 'product_issues', 'product_coverage_assertions',
      'product_residual_passes',
    ];
    const rows = {};
    await Promise.all(tableNames.map(async (table) => {
      const result = await this.client.from(table).select('*').eq('run_id', runId);
      if (result.error) throw rpcError(`loadCompletedSectionResults:${table}`, result.error);
      rows[table] = result.data || [];
    }));
    const calls = byNode(rows.product_model_calls);
    const closures = new Map(rows.product_source_closures.map((row) => [row.source_closure_id, row]));
    const spans = new Map(rows.product_source_spans.map((row) => [row.span_id, row]));
    const closureSpanIds = new Map();
    for (const row of rows.product_source_closure_spans) {
      if (!closureSpanIds.has(row.source_closure_id)) closureSpanIds.set(row.source_closure_id, []);
      closureSpanIds.get(row.source_closure_id).push(row.span_id);
    }
    const routings = new Map(rows.product_section_routings.map((row) => [row.structure_node_id, row.payload]));
    const groups = byNode(rows.product_proposition_groups);
    const proposals = byNode(rows.product_proposals);
    const proposalNode = new Map(rows.product_proposals.map((row) => [row.proposal_id, row.structure_node_id]));
    const links = byNode(rows.product_fact_links.map((row) => ({ ...row, structure_node_id: proposalNode.get(row.from_proposal_id) })));
    const issues = byNode(rows.product_issues.filter((row) => row.structure_node_id));
    const coverage = byNode(rows.product_coverage_assertions.filter((row) => row.structure_node_id));
    const residualPasses = new Map(rows.product_residual_passes.map((row) => [row.structure_node_id, row.payload]));
    return rows.product_section_results.sort((left, right) => {
      const leftRoute = rows.product_section_routings.find((row) => row.structure_node_id === left.structure_node_id);
      const rightRoute = rows.product_section_routings.find((row) => row.structure_node_id === right.structure_node_id);
      return leftRoute.authored_order - rightRoute.authored_order;
    }).map((row) => {
      const closureRow = closures.get(row.source_closure_id);
      const sectionSpans = (closureSpanIds.get(row.source_closure_id) || []).map((id) => spans.get(id)).filter(Boolean)
        .map((span) => ({
          schema_version: 'PRODUCT_SOURCE_SPAN/V1',
          span_id: span.span_id,
          source_document_id: span.source_document_id,
          coordinate_system: span.coordinate_system,
          start_byte: Number(span.start_byte),
          end_byte: Number(span.end_byte),
          text_sha256: span.text_sha256,
          kind: span.kind,
          structure_node_id: span.structure_node_id,
          exact_text: span.exact_text,
        })).sort((left, right) => left.span_id.localeCompare(right.span_id));
      const sourceClosure = { ...closureRow.payload, spans: sectionSpans };
      const modelCalls = (calls.get(row.structure_node_id) || []).map((call) => ({
        schema_version: 'PRODUCT_MODEL_CALL/V1',
        model_call_id: call.model_call_id,
        call_kind: call.call_kind,
        prompt_version: call.prompt_version,
        provider_id: call.provider_id,
        model_id: call.model_id,
        structure_node_id: call.structure_node_id,
        request: call.request,
        response: call.response,
        input_tokens: Number(call.input_tokens),
        output_tokens: Number(call.output_tokens),
        cost_microusd: Number(call.cost_microusd),
        duration_ms: Number(call.duration_ms),
      })).sort((left, right) => left.model_call_id.localeCompare(right.model_call_id));
      const payloads = (items, nodeId, idKey) => (items.get(nodeId) || []).map((item) => item.payload)
        .sort((left, right) => String(left[idKey]).localeCompare(String(right[idKey])));
      const residualPass = residualPasses.get(row.structure_node_id);
      if (!residualPass) {
        throw new ProductPhase1StoreError('DATABASE_ERROR', `paragraph residual pass missing for ${row.structure_node_id}`);
      }
      return {
        schema_version: SECTION_DRAFT_VERSION,
        node_id: row.structure_node_id,
        section_reference: routings.get(row.structure_node_id).section_reference,
        source_closure: sourceClosure,
        model_calls: modelCalls,
        routing: routings.get(row.structure_node_id),
        residual_pass: residualPass,
        spans: sectionSpans,
        proposals: payloads(proposals, row.structure_node_id, 'proposal_id'),
        groups: payloads(groups, row.structure_node_id, 'proposition_group_id'),
        links: payloads(links, row.structure_node_id, 'fact_link_id'),
        issues: payloads(issues, row.structure_node_id, 'issue_id'),
        coverage: payloads(coverage, row.structure_node_id, 'coverage_assertion_id'),
        section_result_id: row.section_result_id,
      };
    });
  }
}

module.exports = { ProductPhase2Store };
