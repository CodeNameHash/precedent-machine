'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const legalSchema = require('../contracts/product/legal-schema.v1.json');
const { buildAgreementStructure } = require('../lib/product/agreement-structure');
const { runAgreementDraftAnalysis } = require('../lib/product/analysis-runner');
const { createSecIntakeAdapter } = require('../lib/product/sec-intake');
const { substantiveSections } = require('../lib/product/source-context');
const { applyReviewCommand, initialiseReviewState } = require('../lib/product/review-state');

const MODIV_URL = 'https://www.sec.gov/Archives/edgar/data/1645873/000114036126018656/ef20072329_ex2-1.htm';
const ROOT = path.resolve(__dirname, '..');
const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');

async function modivSource() {
  const raw = fs.readFileSync(path.join(ROOT, 'tests/fixtures/canonical-v2/mae-definition-family/modiv-raw-fetched.htm'));
  return createSecIntakeAdapter({ fetchImpl: async () => ({
    status: 200,
    url: MODIV_URL,
    headers: new Headers({ 'content-type': 'text/html', 'content-length': String(raw.length) }),
    body: null,
    arrayBuffer: async () => raw,
  }), clock: () => new Date('2026-09-05T12:00:00Z') }).intake({ url: MODIV_URL });
}

function calibrationModel() {
  const routed = new Map([['5.6', ['NO_SHOP']], ['7.1', ['TERMINATION']], ['7.3', ['TERMINATION_FEE']]]);
  return { async complete({ call_kind: kind, request }) {
    const reference = request.section_reference || request.source_closure.section_reference;
    const families = routed.get(reference) || [];
    let response;
    if (kind === 'ROUTING') response = { families, disposition: families.length ? 'FAMILY_ASSIGNED' : 'IMMATERIAL', rationale: 'Deterministic Modiv calibration routing', deterministic_disagreements: (request.deterministic_family_evidence || []).filter((item) => !families.includes(item.section_family)).map((item) => ({ family_key: item.section_family, reason: 'Phase 3 calibration does not exercise this newly registered family.' })) };
    else if (kind === 'RESIDUAL') response = { paragraphs: request.paragraphs.map((paragraph) => ({ source_span_id: paragraph.source_span_id, disposition: families.length ? 'KNOWN_FAMILY' : 'IMMATERIAL', family_keys: families, rationale: families.length ? 'Covered by a routed family.' : 'No material residual in this deterministic calibration.' })) };
    else {
      const proposals = [];
      const groups = [];
      if (reference === '7.1') {
        const components = [...request.source_closure.operative, ...request.source_closure.chapeau, ...request.source_closure.definitions, ...request.source_closure.cross_references, request.source_closure.full_section];
        const component = components.find((item) => item.exact_text.includes('mutual written consent'));
        assert.ok(component);
        groups.push({ client_ref: 'modiv-termination-group', family_key: 'TERMINATION', subtype_key: 'MUTUAL_CONSENT' });
        proposals.push({ client_ref: 'modiv-termination-proposal', group_ref: 'modiv-termination-group', family_key: 'TERMINATION', subtype_key: 'MUTUAL_CONSENT', fact_type: 'TERMINATION_RIGHT',
          statement: 'Parent and the Company may terminate by mutual oral consent.',
          roles: { terminating_parties: ['Parent', 'Company'], action: 'terminate', trigger: 'mutual consent', writing_requirement: false }, value: null,
          evidence_quotes: [{ quote: 'by the mutual written consent of Parent and the Company', occurrence: 0, source_span_id: component.span_id }] });
      }
      const coverage = {};
      const fact_type_coverage = {};
      for (const familyKey of families) {
        const family = legalSchema.families.find((item) => item.family_key === familyKey);
        coverage[familyKey] = proposals.some((item) => item.family_key === familyKey) ? 'FOUND' : 'NOT_FOUND';
        fact_type_coverage[familyKey] = Object.fromEntries(family.required_fact_types.map((factType) => [factType, proposals.some((item) => item.fact_type === factType) ? 'FOUND' : 'NOT_FOUND']));
      }
      response = { proposals, groups, links: [], coverage, fact_type_coverage };
    }
    return { provider_id: 'DETERMINISTIC_CALIBRATION', model_id: 'MODIV_PHASE3/V1', raw_request: request, raw_response: response, response,
      input_tokens: 80, output_tokens: kind === 'ROUTING' ? 20 : 40, cost_microusd: kind === 'ROUTING' ? 15 : 25, duration_ms: 1 };
  } };
}

class CalibrationStore {
  constructor(sourceDocument, agreementStructure) {
    this.sourceDocument = sourceDocument; this.agreementStructure = agreementStructure;
    this.pending = substantiveSections(agreementStructure).map((node) => node.node_id);
    this.complete = new Set(); this.results = []; this.analysis = null;
  }
  async getRunContext() { return { sourceDocument: this.sourceDocument, agreementStructure: this.agreementStructure }; }
  async claimNextSection() { const nodeId = this.pending.shift(); return nodeId ? { node_id: nodeId, attempt_token: crypto.randomUUID() } : null; }
  async renewSectionLease() {}
  async commitSection({ nodeId, result }) { this.results.push(result); this.complete.add(nodeId); }
  async completeSection({ nodeId }) { this.complete.add(nodeId); }
  async failSection() {}
  async getProgress() { return { total: this.complete.size + this.pending.length, completed: this.complete.size, failed: 0 }; }
  async loadCompletedSectionResults() { return this.results; }
  async finalizeDraft({ draft }) {
    const closureIds = new Map();
    for (const closure of draft.source_closures) for (const span of closure.spans) {
      if (!closureIds.has(span.span_id)) closureIds.set(span.span_id, []);
      closureIds.get(span.span_id).push(closure.source_closure_id);
    }
    this.analysis = { schema_version: 'AGREEMENT_ANALYSIS_READ/V1', kind: 'draftAnalysis', analysis_run_id: '00000000-0000-4000-8000-000000000003',
      status: 'READY', stage: 'READY', progress: { total: this.complete.size, completed: this.complete.size, failed: 0, cost_microusd: draft.totals.cost_microusd },
      draft_analysis_id: draft.draft_analysis_id, legal_schema_version: draft.legal_schema_version,
      source_document: this.sourceDocument, agreement_structure: this.agreementStructure, sections: draft.section_routings,
      model_calls: draft.model_calls, source_closures: draft.source_closures,
      spans: draft.spans.map((span) => ({ ...span, source_closure_ids: closureIds.get(span.span_id) || [] })),
      proposals: draft.proposals, proposition_groups: draft.proposition_groups, fact_links: draft.fact_links,
      issues: draft.issues, coverage_assertions: draft.coverage_assertions };
  }
  async getAgreementAnalysis() { return this.analysis; }
}

test('Modiv calibration records proposal errors, omissions, run time, model cost and review time', async (context) => {
  const source = await modivSource();
  const structure = buildAgreementStructure({ agreement_id: source.source_document_id, canonical_text: source.canonical_text, canonical_text_sha256: source.canonical_text_sha256 });
  const store = new CalibrationStore(source, structure);
  const runStarted = performance.now();
  const analysis = await runAgreementDraftAnalysis({ runId: '00000000-0000-4000-8000-000000000003', store, legalSchema, model: calibrationModel(), workerId: 'modiv-calibration' });
  const runTimeMs = Math.round(performance.now() - runStarted);
  assert.equal(analysis.status, 'READY');
  const nodes = Object.fromEntries(['5.6', '7.1'].map((reference) => [reference, structure.nodes.find((node) => node.kind === 'SECTION' && node.reference === reference)]));
  const closures = Object.fromEntries(['5.6', '7.1'].map((reference) => [reference, analysis.source_closures.find((closure) => closure.structure_node_id === nodes[reference].node_id)]));
  const noShopSpan = analysis.spans.find((span) => span.source_closure_ids.includes(closures['5.6'].source_closure_id) && span.exact_text.includes('solicit, initiate'))
    || analysis.spans.find((span) => span.source_closure_ids.includes(closures['5.6'].source_closure_id));
  const reviewStarted = performance.now();
  let state = initialiseReviewState(analysis, { clock: () => new Date('2026-09-05T12:10:00Z') });
  const proposed = state.items.find((item) => item.kind === 'PROPOSAL');
  state = applyReviewCommand(state, { type: 'DECIDE_ITEM', item_id: proposed.item_id, decision: 'EDITED',
    statement: 'Parent and the Company may terminate by mutual written consent.',
    roles: { ...proposed.original.roles, writing_requirement: true } }, { analysis, legalSchema });
  state = applyReviewCommand(state, { type: 'ADD_MISSING_FACT', structure_node_id: nodes['5.6'].node_id,
    source_closure_id: closures['5.6'].source_closure_id, family_key: 'NO_SHOP', subtype_key: 'PROHIBITED_ACTION', fact_type: 'PROHIBITED_ACTION',
    statement: 'The Company must not solicit or knowingly facilitate a Company Acquisition Proposal.',
    roles: { covenant_obligor: 'Company', prohibited_action: 'solicit or knowingly facilitate a Company Acquisition Proposal' },
    source_span_ids: [noShopSpan.span_id] }, { analysis, legalSchema });
  for (const item of state.items.filter((candidate) => candidate.decision === 'PENDING')) {
    state = applyReviewCommand(state, { type: 'DECIDE_ITEM', item_id: item.item_id, decision: 'ACCEPTED' }, { analysis, legalSchema });
  }
  state = applyReviewCommand(state, { type: 'CONFIRM_AGREEMENT_COVERAGE', confirmed: true }, { analysis, legalSchema });
  state = applyReviewCommand(state, { type: 'PUBLISH' }, { analysis, legalSchema, clock: () => new Date('2026-09-05T12:13:00Z') });
  const reviewHarnessMs = Math.round(performance.now() - reviewStarted);
  assert.equal(state.metrics.proposal_count, 1);
  assert.equal(state.metrics.proposal_errors, 1);
  assert.equal(state.metrics.proposal_omissions, 1);
  assert.equal(state.metrics.review_time_seconds, 180);
  assert.equal(state.summary.families.find((family) => family.family_key === 'TERMINATION').facts.length, 1);
  assert.equal(state.summary.families.find((family) => family.family_key === 'NO_SHOP').facts.length, 1);
  const modelCostUsd = analysis.model_calls.reduce((sum, call) => sum + call.cost_microusd, 0) / 1000000;
  context.diagnostic(`MODIV_CALIBRATION run_time_ms=${runTimeMs} model_cost_usd=${modelCostUsd.toFixed(6)} review_time_seconds=180 automated_review_harness_ms=${reviewHarnessMs} proposal_errors=1 proposal_omissions=1`);
});
