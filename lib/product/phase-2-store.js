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

function sortedStrings(items) {
  return [...items].sort((left, right) => left.localeCompare(right));
}

function sortedObjects(items) {
  return [...items].sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

function draftFinalizationInput(draft) {
  return {
    schema_version: 'PRODUCT_DRAFT_FINALIZATION/V1',
    draft_analysis_id: draft.draft_analysis_id,
    source_document_id: draft.source_document_id,
    agreement_structure_id: draft.agreement_structure_id,
    legal_schema_version: draft.legal_schema_version,
    totals: draft.totals,
    global_issues: draft.issues.filter((item) => item.structure_node_id == null),
    global_coverage_assertions: draft.coverage_assertions.filter((item) => item.structure_node_id == null),
    components: {
      sections: sortedObjects(draft.sections.map((item) => ({
        node_id: item.node_id,
        section_routing_id: item.section_routing_id,
        source_closure_id: item.source_closure_id,
      }))),
      residual_pass_ids: sortedStrings(draft.residual_passes.map((item) => item.residual_pass_id)),
      model_call_ids: sortedStrings(draft.model_calls.map((item) => item.model_call_id)),
      source_closure_ids: sortedStrings(draft.source_closures.map((item) => item.source_closure_id)),
      span_ids: sortedStrings(draft.spans.map((item) => item.span_id)),
      source_closure_spans: sortedObjects(draft.source_closures.flatMap((closure) => closure.spans.map((span) => ({
        source_closure_id: closure.source_closure_id, span_id: span.span_id,
      })))),
      section_routing_ids: sortedStrings(draft.section_routings.map((item) => item.section_routing_id)),
      proposition_group_ids: sortedStrings(draft.proposition_groups.map((item) => item.proposition_group_id)),
      proposal_ids: sortedStrings(draft.proposals.map((item) => item.proposal_id)),
      proposal_spans: sortedObjects(draft.proposals.flatMap((proposal) => proposal.source_span_ids.map((spanId, ordinal) => ({
        proposal_id: proposal.proposal_id, span_id: spanId, ordinal,
      })))),
      fact_link_ids: sortedStrings(draft.fact_links.map((item) => item.fact_link_id)),
      fact_link_spans: sortedObjects(draft.fact_links.flatMap((link) => link.source_span_ids.map((spanId, ordinal) => ({
        fact_link_id: link.fact_link_id, span_id: spanId, ordinal,
      })))),
      section_issue_ids: sortedStrings(draft.issues.filter((item) => item.structure_node_id != null).map((item) => item.issue_id)),
      section_coverage_assertion_ids: sortedStrings(draft.coverage_assertions
        .filter((item) => item.structure_node_id != null).map((item) => item.coverage_assertion_id)),
    },
  };
}

const RESULT_TABLE_ORDER = Object.freeze({
  product_section_results: ['structure_node_id'],
  product_model_calls: ['model_call_id'],
  product_source_closures: ['source_closure_id'],
  product_source_spans: ['span_id'],
  product_source_closure_spans: ['source_closure_id', 'span_id'],
  product_section_routings: ['authored_order', 'section_routing_id'],
  product_proposition_groups: ['proposition_group_id'],
  product_proposals: ['proposal_id'],
  product_fact_links: ['fact_link_id'],
  product_issues: ['issue_id'],
  product_coverage_assertions: ['coverage_assertion_id'],
  product_residual_passes: ['residual_pass_id'],
});

async function selectAllRunRows(client, table, runId) {
  const rows = [];
  for (;;) {
    let query = client.from(table).select('*').eq('run_id', runId);
    for (const column of RESULT_TABLE_ORDER[table]) query = query.order(column);
    const result = await query.range(rows.length, rows.length + 499);
    if (result.error) throw rpcError(`loadCompletedSectionResults:${table}`, result.error);
    const page = result.data || [];
    if (page.length === 0) return rows;
    rows.push(...page);
  }
}

class ProductPhase2Store extends ProductPhase1Store {
  async recordModelCall({ runId, nodeId, workerId, attemptToken, call }) {
    const { data, error } = await this.client.rpc('product_phase2_record_model_call', {
      p_run_id: runId,
      p_node_id: nodeId,
      p_worker_id: workerId,
      p_attempt_token: attemptToken,
      p_call: call,
    });
    if (error) throw rpcError('recordModelCall', error);
    return data;
  }

  async failSection({ runId, nodeId, workerId, attemptToken, error: failure, modelCalls = [] }) {
    const { data, error } = await this.client.rpc('product_phase2_fail_section', {
      p_run_id: runId,
      p_node_id: nodeId,
      p_worker_id: workerId,
      p_attempt_token: attemptToken,
      p_error: { message: failure instanceof Error ? failure.message : String(failure) },
      p_model_calls: modelCalls,
    });
    if (error) throw rpcError('failSection', error);
    return data;
  }

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
    const { data, error } = await this.client.rpc('product_phase2_finalize_saved_run', {
      p_run_id: runId,
      p_finalization: draftFinalizationInput(draft),
    });
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
      rows[table] = await selectAllRunRows(this.client, table, runId);
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
        ...(call.invocation_id ? { invocation_id: call.invocation_id } : {}),
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
