'use strict';

const { ProductPhase1Store, ProductPhase1StoreError } = require('./phase-1-store');
const { ISSUE_VERSION, SECTION_DRAFT_VERSION } = require('./agreement-draft');
const { validateFactComponents, walk } = require('./fact-components');
const { contentId } = require('../canonical-v2/canonical-bytes');

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
    legal_schema_revision: draft.legal_schema_revision,
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

function crossSectionRelationshipStagingInput(draft) {
  const links = draft.fact_links.filter((link) => link.schema_version === 'PRODUCT_FACT_LINK/V2');
  const crossSectionIssues = draft.issues.filter((issue) => (
    issue.code === 'CROSS_SECTION_RELATIONSHIP_UNRESOLVED'
  ));
  const requiredSpanIds = new Set([
    ...links.flatMap((link) => [...link.source_span_ids, ...link.target_source_span_ids]),
    ...crossSectionIssues.flatMap((issue) => issue.source_span_ids || []),
  ]);
  return {
    schema_version: 'PRODUCT_CROSS_SECTION_RELATIONSHIP_STAGING/V1',
    source_document_id: draft.source_document_id,
    spans: draft.spans.filter((span) => requiredSpanIds.has(span.span_id)),
    source_closure_spans: draft.source_closures.flatMap((closure) => closure.spans
      .filter((span) => requiredSpanIds.has(span.span_id))
      .map((span) => ({ source_closure_id: closure.source_closure_id, span_id: span.span_id }))),
    links,
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
  product_fact_components: ['proposal_id', 'ordinal'],
  product_fact_headlines: ['proposal_id'],
});

// FACT_COMPONENTS/V2 (contracts/product/fact-components.v2.json). A section
// result's proposals carry `components` (a tree) and `headline` when the
// section was extracted under the V2 fact model. Flattening happens here,
// on the way into the atomic section commit, so the tree can be stored as
// rows (product_fact_components, product_fact_headlines) alongside the
// proposal instead of only inside its opaque jsonb payload.
function flattenComponentRows(components, proposalId) {
  const rows = [];
  for (const [component, path, parent] of walk(components)) {
    rows.push({
      proposal_id: proposalId,
      component_id: component.component_id,
      parent_component_id: parent ? parent.component_id : null,
      ordinal: path[path.length - 1],
      kind: component.kind,
      label: component.label ?? null,
      text: component.text,
      source_span_id: component.source_span_id ?? null,
      start_byte: Number.isSafeInteger(component.start_byte) ? component.start_byte : null,
      end_byte: Number.isSafeInteger(component.end_byte) ? component.end_byte : null,
      origin: component.origin,
      origin_structure_node_id: component.origin_structure_node_id ?? null,
      gap_before: component.gap_before === true,
      value: component.value ?? null,
      members: component.members ?? null,
      resolves_to: component.resolves_to ?? null,
    });
  }
  return rows;
}

function makeFactComponentsIssue({ problems, familyKey, subtypeKey, nodeId, proposalId, sourceClosureId, sourceSpanIds }) {
  const body = {
    schema_version: ISSUE_VERSION,
    kind: 'VALIDATION',
    code: 'INVALID_FACT_COMPONENTS',
    message: JSON.stringify(problems),
    family_key: familyKey ?? null,
    subtype_key: subtypeKey ?? null,
    structure_node_id: nodeId ?? null,
    proposal_id: proposalId ?? null,
    source_closure_id: sourceClosureId ?? null,
    source_span_ids: sourceSpanIds || [],
    state: 'OPEN',
  };
  return { ...body, issue_id: contentId(ISSUE_VERSION, body) };
}

// Validates every V2 proposal's component tree before the section commit.
// A tree with problems is never written to product_fact_components /
// product_fact_headlines; the proposal is marked INVALID and an issue
// records the problems. A V1 proposal (no `components`/`headline`) passes
// through unchanged, so V1 runs are unaffected.
function prepareSectionResultForCommit(result) {
  const spansById = new Map((result.spans || []).map((span) => [span.span_id, span]));
  const issues = [...result.issues];
  const factComponentRows = [];
  const factHeadlineRows = [];
  const proposals = result.proposals.map((proposal) => {
    if (!Array.isArray(proposal.components) || !proposal.headline) return proposal;
    const problems = validateFactComponents(proposal, { spansById });
    if (problems.length > 0) {
      issues.push(makeFactComponentsIssue({
        problems,
        familyKey: proposal.family_key,
        subtypeKey: proposal.subtype_key,
        nodeId: result.node_id,
        proposalId: proposal.proposal_id,
        sourceClosureId: proposal.source_closure_id,
        sourceSpanIds: proposal.source_span_ids,
      }));
      return proposal.validation_status === 'INVALID' ? proposal : { ...proposal, validation_status: 'INVALID' };
    }
    factComponentRows.push(...flattenComponentRows(proposal.components, proposal.proposal_id));
    factHeadlineRows.push({
      proposal_id: proposal.proposal_id,
      label: proposal.headline.label,
      distinguishing_component_ids: proposal.headline.distinguishing_component_ids || [],
      coverage_only: proposal.coverage_only === true,
    });
    return proposal;
  });
  return {
    ...result,
    proposals,
    issues,
    ...(factComponentRows.length ? { fact_component_rows: factComponentRows } : {}),
    ...(factHeadlineRows.length ? { fact_headline_rows: factHeadlineRows } : {}),
  };
}

// Rebuilds one proposal's component tree from its flat, ordinal-ordered rows.
function buildComponentTree(rows) {
  const byParent = new Map();
  for (const row of rows) {
    const key = row.parent_component_id || null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(row);
  }
  const build = (parentId) => (byParent.get(parentId) || [])
    .slice()
    .sort((left, right) => left.ordinal - right.ordinal)
    .map((row) => ({
      component_id: row.component_id,
      kind: row.kind,
      label: row.label,
      text: row.text,
      source_span_id: row.source_span_id,
      start_byte: Number(row.start_byte),
      end_byte: Number(row.end_byte),
      origin: row.origin,
      ...(row.origin_structure_node_id ? { origin_structure_node_id: row.origin_structure_node_id } : {}),
      gap_before: row.gap_before === true,
      ...(row.value != null ? { value: row.value } : {}),
      ...(row.members != null ? { members: row.members } : {}),
      ...(row.resolves_to != null ? { resolves_to: row.resolves_to } : {}),
      children: build(row.component_id),
    }));
  return build(null);
}

// Attaches `components` and `headline` to proposals with stored component
// rows, and strips both keys from every other proposal so a V1 proposal (no
// rows) reads back exactly as it was written.
function withFactComponents(proposalPayloads, componentRowsByProposal, headlineByProposal) {
  return proposalPayloads.map((payload) => {
    const { components, headline, coverage_only, ...rest } = payload;
    const componentRows = componentRowsByProposal.get(payload.proposal_id);
    const headlineRow = headlineByProposal.get(payload.proposal_id);
    if (!componentRows || !componentRows.length || !headlineRow) return rest;
    return {
      ...rest,
      components: buildComponentTree(componentRows),
      headline: {
        label: headlineRow.label,
        distinguishing_component_ids: headlineRow.distinguishing_component_ids || [],
      },
      coverage_only: headlineRow.coverage_only === true,
    };
  });
}

async function selectAllRunRows(client, table, runId) {
  const rows = [];
  const pageSize = table === 'product_model_calls' ? 50 : 500;
  for (;;) {
    let query = client.from(table).select('*').eq('run_id', runId);
    for (const column of RESULT_TABLE_ORDER[table]) query = query.order(column);
    const result = await query.range(rows.length, rows.length + pageSize - 1);
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
      p_result: prepareSectionResultForCommit(result),
    });
    if (error) throw rpcError('commitSection', error);
    return data;
  }

  async finalizeDraft({ runId, draft }) {
    const hasCrossSectionOutput = draft.fact_links.some((link) => (
      link.schema_version === 'PRODUCT_FACT_LINK/V2'
    )) || draft.issues.some((issue) => issue.code === 'CROSS_SECTION_RELATIONSHIP_UNRESOLVED');
    if (hasCrossSectionOutput) {
      const staged = await this.client.rpc('product_phase2_stage_cross_section_relationships', {
        p_run_id: runId,
        p_staging: crossSectionRelationshipStagingInput(draft),
      });
      if (staged.error) throw rpcError('stageCrossSectionRelationships', staged.error);
    }
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
      'product_residual_passes', 'product_fact_components', 'product_fact_headlines',
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
    const componentRowsByProposal = byNode(rows.product_fact_components, 'proposal_id');
    const headlineByProposal = new Map(rows.product_fact_headlines.map((row) => [row.proposal_id, row]));
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
        proposals: withFactComponents(
          payloads(proposals, row.structure_node_id, 'proposal_id'),
          componentRowsByProposal,
          headlineByProposal,
        ),
        groups: payloads(groups, row.structure_node_id, 'proposition_group_id'),
        links: payloads(links, row.structure_node_id, 'fact_link_id'),
        issues: payloads(issues, row.structure_node_id, 'issue_id'),
        coverage: payloads(coverage, row.structure_node_id, 'coverage_assertion_id'),
        section_result_id: row.section_result_id,
      };
    });
  }
}

module.exports = { ProductPhase2Store, crossSectionRelationshipStagingInput };
