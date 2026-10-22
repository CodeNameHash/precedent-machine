'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { buildAgreementStructure } = require('../lib/product/agreement-structure');
const { buildAgreementDraft } = require('../lib/product/agreement-draft');
const { createProductAblationHandler } = require('../lib/product/ablation-handler');
const { createClaudeCliProductModel } = require('../lib/product/claude-cli-model');
const { ABLATION_VARIANTS, ablationTotals, createRecorder, estimateAblationTokens, isRetryableAblationFailure, mapInOrder, renderAblationTable, runSectionAblation, variantAvailability } = require('../lib/product/cost-ablation');
const { createRecordedModelAdapter } = require('../lib/product/model-adapter');
const { ANTHROPIC_API_PROVIDER_ID, CLAUDE_CLI_PROVIDER_ID } = require('../lib/product/product-model-config');
const { internalBearerActor } = require('../lib/product/request-auth');
const {
  ABLATION_LAUNCHER, ABLATION_SANDBOX_NAME, MINIMUM_SESSION_MS, SANDBOX_WORKDIR, ablationStatusScript, parseAblationStatus, readSandboxAblationStatus, wakeSandboxAblation,
} = require('../lib/product/sandbox-wake');
const { createSecIntakeAdapter } = require('../lib/product/sec-intake');
const { substantiveSections } = require('../lib/product/source-context');
const schemaV2 = require('../contracts/product/legal-schema.v2.json');
const { FAMILY_FOR, conductOfBusinessSource, countedAnswerFor } = require('./fixtures/product/conduct-of-business-layout');

// Work package E2 (implementer E; the manager, 2026-10-19 02:55 UTC): the
// ablation job through the deployment's wake path on the experiments
// sandbox, and the CLI provider path of the cost ablation, proven on the
// phase-1 fixture with a recorded adapter. No live call, no sandbox.

const RUN_ID = '0f9c1a2b-3d4e-4f60-8a1b-2c3d4e5f6072';
const SEC_URL = 'https://www.sec.gov/Archives/edgar/data/98246/000119312519299997/d840067dex21.htm';
const TOKEN = 'internal-token-'.padEnd(40, 'x');
const INTERNAL_ENV = { PRODUCT_INTERNAL_TOKEN: TOKEN };

// The phase-1 fixture (tests/product-phase-1.test.js agreementHtml), with
// one sentence of substance in the termination section.
function agreementHtml() {
  return [
    '<!doctype html><html><head><title>EX-2.1 Agreement and Plan of Merger</title></head><body>',
    '<TYPE data-source="filing">EX-2.1', '<TITLE data-source="filing">Agreement and Plan of Merger', '<DESCRIPTION>Agreement and Plan of Merger', '<FILENAME>d840067dex21.htm',
    '<h1>AGREEMENT AND PLAN OF MERGER</h1>',
    '<p>by and among ACME CORPORATION, a Delaware corporation (the "Company")</p>',
    '<p>BUYER CORPORATION, a Delaware corporation (the "Parent")</p>',
    '<p>MERGER SUB CORPORATION, a Delaware corporation (the "Merger Sub")</p>',
    '<p>Dated as of April 13, 2026</p>',
    '<h2>ARTICLE I</h2><h3>COVENANTS</h3>',
    '<p>Section 1.1. Delivery.</p><p>Parent shall deliver the Certificate.</p>',
    '<p>Section 1.2. Closing.</p><p>The Closing shall occur promptly.</p>',
    '<h2>ARTICLE II</h2><h3>REPRESENTATIONS</h3>',
    '<p>Section 2.1. Organisation.</p><p>Each party is duly organised.</p>',
    '<h2>ARTICLE III</h2><h3>TERMINATION</h3>',
    '<p>Section 3.1. Termination.</p><p>This Agreement may be terminated by mutual written consent of Parent and the Company at any time prior to the Effective Time.</p>',
    '</body></html>',
  ].join('\n');
}

async function phase1Source() {
  const response = new Response(agreementHtml(), { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
  Object.defineProperty(response, 'url', { value: SEC_URL });
  const adapter = createSecIntakeAdapter({ fetchImpl: async () => response, clock: () => new Date('2026-09-04T12:00:00Z') });
  return adapter.intake({ url: SEC_URL });
}

const ROUTES = { '3.1': ['TERMINATION'] };
const FAMILY = schemaV2.families.find((family) => family.family_key === 'TERMINATION');
const SUBTYPE = FAMILY.subtypes.find((subtype) => subtype.subtype_key === 'MUTUAL_CONSENT');
const OPERATION = 'This Agreement may be terminated';
const CONDITION = 'by mutual written consent of Parent and the Company';

// One answer per call kind, from the request alone: the V9 answer for the
// stored run (roles, evidence quotes, real span ids) and the V10 answer the
// CLI variants ask for (aliases, components only).
function answerFor(kind, request) {
  const reference = request.section_reference || request.source_closure?.section_reference;
  const families = ROUTES[reference] || [];
  if (kind === 'ROUTING') {
    return {
      families, disposition: families.length ? 'FAMILY_ASSIGNED' : 'IMMATERIAL', rationale: families.length ? 'The section terminates the agreement.' : 'No family of the slice.',
      deterministic_disagreements: (request.deterministic_family_evidence || []).filter((item) => !families.includes(item.section_family)).map((item) => ({ family_key: item.section_family, reason: 'Not this family.' })),
    };
  }
  if (kind === 'RESIDUAL') {
    return { paragraphs: request.paragraphs.map((paragraph) => ({ source_span_id: paragraph.source_span_id, disposition: families.length ? 'KNOWN_FAMILY' : 'IMMATERIAL', family_keys: families, rationale: families.length ? 'Covered by the routed family.' : 'Nothing residual.' })) };
  }
  const routed = request.family_contracts.map((family) => family.family_key);
  const lean = request.prompt_version === 'PRODUCT_ALL_FAMILY_EXTRACTOR/V10';
  const coverage = Object.fromEntries((request.routed_families || routed).map((key) => [key, key === 'TERMINATION' ? 'FOUND' : 'NOT_FOUND']));
  if (!families.length || !routed.includes('TERMINATION')) return { proposals: [], groups: [], links: [], coverage };
  const operative = request.source_closure.operative[0];
  const component = (ref, kind, label, quote) => ({ ref, kind, label, quote, source_span_id: operative.span_id, occurrence: 0, origin: 'OWN', gap_before: false, children: [] });
  const proposal = {
    client_ref: 'p1', group_ref: 'g1', family_key: 'TERMINATION', subtype_key: SUBTYPE.subtype_key, fact_type: 'TERMINATION_RIGHT',
    statement: 'The agreement may be terminated by mutual written consent of Parent and the Company before the Effective Time.',
    headline: { label: 'Mutual consent termination', distinguishing_refs: ['c2'], summary: 'Termination by mutual written consent of Parent and the Company at any time before the Effective Time.' },
    components: [component('c1', 'OPERATION', 'termination right', OPERATION), component('c2', 'CONDITION', 'mutual written consent', CONDITION)],
    ...(lean ? {} : {
      roles: { terminating_parties: 'Parent and the Company', action: 'terminate this Agreement', trigger: 'at any time prior to the Effective Time', writing_requirement: 'mutual written consent' },
      evidence_quotes: [{ quote: OPERATION, source_span_id: operative.span_id, occurrence: 0 }, { quote: CONDITION, source_span_id: operative.span_id, occurrence: 0 }],
    }),
  };
  return { proposals: [proposal], groups: [{ client_ref: 'g1', family_key: 'TERMINATION', subtype_key: SUBTYPE.subtype_key }], links: [], coverage, fact_type_coverage: { TERMINATION: Object.fromEntries(FAMILY.required_fact_types.map((type) => [type, type === 'TERMINATION_RIGHT' ? 'FOUND' : 'NOT_FOUND'])) } };
}

// The stored run: the phase-1 fixture through the pipeline on a synthetic
// model, its rows as the tables hold them.
let shared = null;
function storedRun() {
  if (!shared) shared = buildStoredRun();
  return shared;
}

async function buildStoredRun() {
  const sourceDocument = await phase1Source();
  const agreementStructure = buildAgreementStructure(sourceDocument);
  const model = { async complete({ call_kind: kind, request }) {
    const response = answerFor(kind, request);
    return { provider_id: 'SYNTHETIC', model_id: 'SYNTHETIC/V9', raw_request: request, raw_response: response, response, input_tokens: 100, output_tokens: 50, cost_microusd: 0, duration_ms: 5 };
  } };
  const draft = await buildAgreementDraft({ sourceDocument, agreementStructure, legalSchema: schemaV2, model });
  return { draft, rows: rowsFrom(draft, { sourceDocument, agreementStructure }) };
}

// The draft's rows as the tables hold them; `errorHistoryFor(reference)`
// is the section's work-row history (plan finding (199e): the stored
// claim's cap failures shape the split the ablation runs).
function rowsFrom(draft, { sourceDocument, agreementStructure, errorHistoryFor = () => [] }) {
  const referenceOf = new Map(draft.source_closures.map((closure) => [closure.structure_node_id, closure.section_reference]));
  const components = [];
  const flatten = (proposalId, list, parentId) => {
    (list || []).forEach((component, ordinal) => {
      components.push({ run_id: RUN_ID, proposal_id: proposalId, component_id: component.component_id, parent_component_id: parentId, ordinal, kind: component.kind, label: component.label, text: component.text, source_span_id: component.source_span_id, start_byte: component.start_byte, end_byte: component.end_byte, origin: component.origin });
      flatten(proposalId, component.children, component.component_id);
    });
  };
  for (const proposal of draft.proposals) flatten(proposal.proposal_id, proposal.components, null);
  const rows = {
    run_id: RUN_ID,
    tables: {
      product_analysis_runs: [{ run_id: RUN_ID, status: 'READY', schema_version: schemaV2.schema_version, prompt_bundle_version: 'PRODUCT_V1', model_config: { provider_id: 'SYNTHETIC_TEST_PROVIDER' } }],
      product_model_calls: draft.model_calls.map((call) => ({ run_id: RUN_ID, ...call, created_at: '2026-10-19T00:00:00Z' })),
      product_section_work: draft.sections.map((section, index) => ({ run_id: RUN_ID, node_id: section.node_id, authored_order: index, status: 'COMPLETE', attempts: 1, attempt_token: null, error_history: errorHistoryFor(referenceOf.get(section.node_id)) })),
      product_source_closures: draft.source_closures.map((closure) => ({ run_id: RUN_ID, source_closure_id: closure.source_closure_id, structure_node_id: closure.structure_node_id, section_reference: closure.section_reference, payload: closure })),
      product_source_spans: draft.source_closures.flatMap((closure) => closure.spans.map((span) => ({ run_id: RUN_ID, ...span }))),
      product_section_routings: (draft.section_routings || []).map((routing) => ({ run_id: RUN_ID, structure_node_id: routing.structure_node_id, families: routing.families, disposition: routing.disposition, payload: routing })),
      product_proposals: draft.proposals.map((proposal) => ({ run_id: RUN_ID, proposal_id: proposal.proposal_id, structure_node_id: proposal.structure_node_id, family_key: proposal.family_key, subtype_key: proposal.subtype_key, fact_type: proposal.fact_type, validation_status: proposal.validation_status, payload: proposal })),
      product_fact_components: components,
      product_fact_headlines: draft.proposals.filter((proposal) => proposal.headline).map((proposal) => ({ run_id: RUN_ID, proposal_id: proposal.proposal_id, label: proposal.headline.label, summary: proposal.headline.summary || null })),
      product_issues: draft.issues.map((issue) => ({ run_id: RUN_ID, issue_id: issue.issue_id, structure_node_id: issue.structure_node_id || null, payload: issue })),
    },
    context: { run: { run_id: RUN_ID, schema_version: schemaV2.schema_version, prompt_bundle_version: 'PRODUCT_V1' }, sourceDocument, agreementStructure },
  };
  return rows;
}

// Plan finding (199e): a stored run on NCS 5.1's layout (the fixture of
// tests/fixtures/product/conduct-of-business-layout.js), 5.1's work row
// carrying one output-cap failure as NCS 5.1's does, so the ablation
// splits it (two parts: the heading with limb (a); limbs (b) and (c)).
const CAP_FAILURE = { error: { code: 'ANTHROPIC_API_OUTPUT_TRUNCATED', message: 'ran past the output cap' } };
function layoutAnswer(kind, request) {
  const reference = request.section_reference || request.source_closure?.section_reference;
  const familyKey = FAMILY_FOR[reference] || null;
  if (kind === 'ROUTING') {
    return {
      families: familyKey ? [familyKey] : [], disposition: familyKey ? 'FAMILY_ASSIGNED' : 'IMMATERIAL', rationale: familyKey ? 'The section states covenants.' : 'No family of the slice.',
      deterministic_disagreements: (request.deterministic_family_evidence || []).filter((item) => item.section_family !== familyKey).map((item) => ({ family_key: item.section_family, reason: 'Not this family.' })),
    };
  }
  if (kind === 'RESIDUAL') return { paragraphs: request.paragraphs.map((paragraph) => ({ source_span_id: paragraph.source_span_id, disposition: 'IMMATERIAL', family_keys: [], rationale: 'Covered by the limbs.' })) };
  if (!familyKey || !request.family_contracts.some((family) => family.family_key === familyKey)) {
    return { proposals: [], groups: [], links: [], coverage: Object.fromEntries(Object.keys(request.response_contract.allowed_fact_types_by_family).map((key) => [key, 'NOT_FOUND'])) };
  }
  return countedAnswerFor(request, { familyKey });
}
async function buildLayoutRun() {
  const sourceDocument = await conductOfBusinessSource();
  const agreementStructure = buildAgreementStructure(sourceDocument);
  const model = { async complete({ call_kind: kind, request }) {
    const response = layoutAnswer(kind, request);
    return { provider_id: 'SYNTHETIC', model_id: 'SYNTHETIC/V9', raw_request: request, raw_response: response, response, input_tokens: 100, output_tokens: 50, cost_microusd: 0, duration_ms: 5 };
  } };
  const draft = await buildAgreementDraft({ sourceDocument, agreementStructure, legalSchema: schemaV2, model });
  return rowsFrom(draft, { sourceDocument, agreementStructure, errorHistoryFor: (reference) => (reference === '5.1' ? [CAP_FAILURE] : []) });
}

// A fake `claude -p` client: the answer as the CLI returns it (one text
// block, the CLI's usage with its thinking split, the list-price cost and
// the API time), for the request the CLI would be sent.
function cliCompleted(answer) {
  const text = JSON.stringify(answer);
  const output = Math.max(1, Math.round(text.length / 4));
  const thinking = Math.round(output * 0.4);
  return {
    content: [{ type: 'text', text }],
    stop_reason: 'end_turn',
    usage: { input_tokens: 3, output_tokens: output + thinking, cache_read_input_tokens: 1200, cache_creation_input_tokens: 400, output_tokens_details: { thinking_tokens: thinking } },
    claude_completion: { status: 'COMPLETE', subtype: 'success', stop_reason: 'end_turn', text_blocks: 1 },
    total_cost_usd: 0.0123, duration_ms: 2100, duration_api_ms: 2050, num_turns: 1, session_id: 's',
    model_usage: { 'claude-opus-5': { costUSD: 0.0123, inputTokens: 3, outputTokens: output + thinking, thinkingTokens: thinking } },
  };
}

function fakeCliFactory(creations, calls) {
  return ({ callKindModels }) => createClaudeCliProductModel({
    callKindModels,
    clientFactory(options) {
      creations.push({ model: options.model, effort: options.effort });
      return { messages: { create: async (request) => {
        const sent = JSON.parse(request.messages[0].content);
        calls.push({ model: options.model, call_kind: sent.call_kind, prompt_version: sent.prompt_version });
        const { call_kind: kind, prompt_version: promptVersion, ...rest } = sent;
        return cliCompleted(answerFor(kind, { ...rest, prompt_version: promptVersion }));
      } } };
    },
  });
}

const SECTIONS = ['3.1'];
const VARIANTS = ['baseline', 'format', 'lean', 'routing_haiku'];

test('the stored run on the phase-1 fixture holds one VALID termination fact in 3.1', async () => {
  const { draft } = await storedRun();
  const facts = draft.proposals.filter((proposal) => proposal.validation_status === 'VALID');
  assert.equal(facts.length, 1, JSON.stringify(draft.issues.map((issue) => [issue.code, issue.message]).slice(0, 8)));
  assert.equal(facts[0].family_key, 'TERMINATION');
  assert.ok(facts[0].components.length === 2 && facts[0].components.every((component) => Number.isSafeInteger(component.start_byte)));
});

test('the CLI path of the cost ablation runs the expressible variants through the CLI\'s --model and --effort, lists the API-only rung, measures what the CLI reports, and replays from the recording with no call', async () => {
  const { rows } = await storedRun();
  const creations = [];
  const calls = [];
  const recorder = createRecorder();
  const ablations = [];
  for (const variantName of VARIANTS) {
    ablations.push(await runSectionAblation({ run: rows, sections: SECTIONS, variantName, providerId: CLAUDE_CLI_PROVIDER_ID, liveModelFactory: fakeCliFactory(creations, calls), recorder }));
  }
  const [baseline, format, lean, routingHaiku] = ablations;
  // baseline: the stored calls through the compiler, no call.
  assert.equal(baseline.sections[0].extraction.live_calls, 0);
  assert.equal(baseline.sections[0].comparison.counts.matched, 1);
  assert.deepEqual(baseline.provider_notes, ['no call on any provider']);
  // format: the V10 request went to the CLI on the extraction model, the fact matched on the bytes, the CLI's thinking and list cost reported.
  const section = format.sections[0];
  assert.equal(section.error, null);
  assert.equal(section.extraction.live_calls, 1);
  assert.deepEqual(section.comparison.counts, { stored: 1, matched: 1, partial: 0, unmatched: 0, new: 0 });
  assert.equal(section.facts.valid, 1);
  assert.equal(section.extraction.thinking_source, 'reported');
  assert.ok(section.extraction.thinking_tokens > 0 && section.extraction.thinking_share > 0.25 && section.extraction.thinking_share < 0.35);
  assert.equal(section.extraction.list_cost_microusd, 12300);
  assert.equal(section.extraction.cache_read_tokens, 1200);
  assert.equal(section.extraction.cost_microusd, 0, 'the subscription bills nothing');
  assert.ok(section.extraction.model_ids.every((id) => id.startsWith('claude-opus-5;effort=high')), JSON.stringify(section.extraction.model_ids));
  assert.match(format.provider_notes.join(' '), /cache layout is the API's/);
  // lean: not expressible on the CLI, listed and not run.
  assert.equal(lean.sections.length, 0);
  assert.match(lean.not_run, /API-only rung/);
  assert.equal(variantAvailability(ABLATION_VARIANTS.lean, ANTHROPIC_API_PROVIDER_ID).runnable, true);
  // routing_haiku: routing and residual on claude-haiku-5-5 through --model; the routing agreed so the extraction replayed from the stored call.
  const haiku = routingHaiku.sections[0];
  assert.equal(haiku.error, null);
  assert.deepEqual(haiku.routing_families, ['TERMINATION']);
  assert.equal(haiku.extraction.live_calls, 0, 'the extraction replayed');
  assert.equal(haiku.extraction.routing_live_calls, 2, 'routing and residual went live');
  assert.ok(creations.some((creation) => creation.model === 'claude-haiku-5-5' && creation.effort === 'low'));
  assert.deepEqual(calls.filter((call) => call.model === 'claude-haiku-5-5').map((call) => call.call_kind).sort(), ['RESIDUAL', 'ROUTING']);
  assert.ok(calls.some((call) => call.call_kind === 'EXTRACTION' && call.prompt_version === 'PRODUCT_ALL_FAMILY_EXTRACTOR/V10'));
  const table = renderAblationTable(ablations);
  assert.match(table, /\| lean \| all \| not run \|.*API-only rung/);
  assert.match(table, /\| format \| 3\.1 \| 1 \(0\) \| 1 \/ 0 \/ 0 of 1 \| 0 \|.*\$0\.00 at list \$0\.01 \| \$0\.0\d \| \$0\.0\d \| 1 live \(claude-opus-5;effort=high\) thinking \d+ of \d+ output \(\d+%, reported\)/);
  // The recording answers a second pass with no call at all: a recorded adapter in place of the CLI.
  const recording = { schema_version: 'PRODUCT_MODEL_RECORDING/V1', calls: recorder.entries().map((entry) => ({ ...entry, raw_response: JSON.parse(entry.raw_response.content[0].text) })) };
  assert.equal(recording.calls.length, 3, 'one extraction, one routing, one residual were live');
  const recorded = createRecordedModelAdapter(recording);
  const before = calls.length;
  const again = [];
  for (const variantName of VARIANTS) again.push(await runSectionAblation({ run: rows, sections: SECTIONS, variantName, providerId: CLAUDE_CLI_PROVIDER_ID, liveModelFactory: () => recorded, recorder: createRecorder() }));
  assert.equal(calls.length, before, 'the fake CLI was not called');
  recorded.assertExhausted();
  assert.deepEqual(again[1].sections[0].comparison.counts, section.comparison.counts);
  // The recorded adapter is another call record (its own raw request and
  // response), so the proposal id differs; the fact is the same by its
  // occurrence (family, subtype, fact type, spans) and its component bytes.
  assert.equal(again[1].sections[0].result.proposals[0].fact_occurrence_id, section.result.proposals[0].fact_occurrence_id, 'the same fact by occurrence');
  assert.deepEqual(again[1].sections[0].result.proposals[0].components.map((component) => [component.start_byte, component.end_byte]), section.result.proposals[0].components.map((component) => [component.start_byte, component.end_byte]));
});

test('the cost-ablation script on the CLI provider runs from a snapshot and a recording, writing the table, the json and the compare-generations inputs, with no call', async () => {
  const { rows } = await storedRun();
  const creations = [];
  const calls = [];
  const recorder = createRecorder();
  await runSectionAblation({ run: rows, sections: SECTIONS, variantName: 'format', providerId: CLAUDE_CLI_PROVIDER_ID, liveModelFactory: fakeCliFactory(creations, calls), recorder });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pm-ablation-test-'));
  fs.writeFileSync(path.join(dir, 'rows.json'), JSON.stringify({ schema_version: 'PRODUCT_RUN_SNAPSHOT/V1', ...rows }));
  fs.writeFileSync(path.join(dir, 'recording.json'), JSON.stringify({ schema_version: 'PRODUCT_MODEL_RECORDING/V1', calls: recorder.entries() }));
  const script = require('../scripts/product/cost-ablation');
  const logs = [];
  const originalLog = console.log;
  console.log = (line) => logs.push(String(line));
  let ablations;
  try {
    ablations = await script.main(['--snapshot', path.join(dir, 'rows.json'), '--sections', '3.1', '--variant', 'baseline,format,lean', '--provider', CLAUDE_CLI_PROVIDER_ID, '--recording', path.join(dir, 'recording.json'), '--out', path.join(dir, 'ablation.md'), '--json', path.join(dir, 'ablation.json'), '--analysis-dir', path.join(dir, 'analysis')]);
  } finally {
    console.log = originalLog;
  }
  assert.equal(ablations.length, 3);
  assert.match(logs.join('\n'), /not expressible on this provider and listed, not run: lean/);
  const table = fs.readFileSync(path.join(dir, 'ablation.md'), 'utf8');
  assert.match(table, /\| format \| 3\.1 \| 1 \(0\) \| 1 \/ 0 \/ 0 of 1 \|/);
  assert.match(table, /Provider: ANTHROPIC_CLAUDE_CLI_SUBSCRIPTION\. Not expressible on this provider, listed and not run: lean\./);
  const json = JSON.parse(fs.readFileSync(path.join(dir, 'ablation.json'), 'utf8'));
  assert.deepEqual(json.map((ablation) => [ablation.variant, ablation.not_run ? 'not run' : ablation.sections.length]), [['baseline', 1], ['format', 1], ['lean', 'not run']]);
  assert.deepEqual(fs.readdirSync(path.join(dir, 'analysis')).sort(), ['baseline.analysis.json', 'format.analysis.json', 'stored.analysis.json']);
  const stored = JSON.parse(fs.readFileSync(path.join(dir, 'analysis', 'stored.analysis.json'), 'utf8')).analysis;
  assert.equal(stored.proposals.length, 1);
  assert.equal(stored.proposals[0].components[0].start_byte > 0, true);
  assert.equal(calls.length, 1, 'the one live call was the recording pass; the script made none');
});

test('the ablation wake resumes the experiments sandbox, passes the run wake\'s environment and launches the ablation launcher with the job, run, sections and variants', async () => {
  let getInput;
  let commandInput;
  let extension;
  const sessionStarted = new Date('2026-10-19T03:00:00.000Z');
  const result = await wakeSandboxAblation({
    runId: '51577c57-41b1-4b75-bcdf-c84ef2558589', sections: ['3.19', '5.2', '5.17'], variants: ['baseline', 'format'],
    databaseUrl: 'https://ecrtoofsyxozazkvsvcl.supabase.co/', serviceRoleKey: 'service-role-secret-value',
    providerId: CLAUDE_CLI_PROVIDER_ID, claudeOauthToken: 'claude-oauth-token-secret-value',
    sandboxApi: { async get(input) {
      getInput = input;
      return {
        currentSession: () => ({ createdAt: sessionStarted, timeout: 30 * 60 * 1000 }),
        async extendTimeout(value) { extension = value; },
        async runCommand(command) {
          commandInput = command;
          return { cmdId: 'ablation-command-1', async wait({ signal }) { return new Promise((resolve, reject) => { signal.addEventListener('abort', () => reject(signal.reason), { once: true }); }); } };
        },
      };
    } },
    now: () => Date.parse('2026-10-19T03:10:00.000Z'),
  });
  assert.deepEqual(getInput, { name: ABLATION_SANDBOX_NAME, resume: true });
  assert.equal(extension, MINIMUM_SESSION_MS - (20 * 60 * 1000));
  assert.deepEqual(commandInput, {
    cmd: ABLATION_LAUNCHER,
    args: ['pm-ablation-20261019T031000Z', '51577c57-41b1-4b75-bcdf-c84ef2558589', '3.19,5.2,5.17', 'baseline,format'],
    cwd: SANDBOX_WORKDIR,
    env: { SUPABASE_URL: 'https://ecrtoofsyxozazkvsvcl.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'service-role-secret-value', PRODUCT_MODEL_PROVIDER: CLAUDE_CLI_PROVIDER_ID, CLAUDE_CODE_OAUTH_TOKEN: 'claude-oauth-token-secret-value' },
    detached: true,
    timeoutMs: MINIMUM_SESSION_MS,
  });
  assert.deepEqual(result, {
    schema_version: 'PRODUCT_SANDBOX_ABLATION_WAKE/V1', job_id: 'pm-ablation-20261019T031000Z', job_dir: '/vercel/sandbox/pm-ablation-20261019T031000Z',
    run_id: '51577c57-41b1-4b75-bcdf-c84ef2558589', sandbox_name: ABLATION_SANDBOX_NAME, provider_id: CLAUDE_CLI_PROVIDER_ID, sections: ['3.19', '5.2', '5.17'], variants: ['baseline', 'format'], loops: 1, command_id: 'ablation-command-1',
  });
  assert.doesNotMatch(JSON.stringify(result), /secret-value/);
  const base = { runId: '51577c57-41b1-4b75-bcdf-c84ef2558589', sections: ['3.19'], variants: ['baseline'], databaseUrl: 'https://ecrtoofsyxozazkvsvcl.supabase.co', serviceRoleKey: 'service-role-secret-value', providerId: CLAUDE_CLI_PROVIDER_ID, claudeOauthToken: 'claude-oauth-token-secret-value', sandboxApi: { get: async () => assert.fail('must fail before the resume') } };
  await assert.rejects(() => wakeSandboxAblation({ ...base, sandboxName: 'pm-codex-preview-worker' , sandboxApi: { async get() { return { currentSession: () => ({}), async extendTimeout() {}, async runCommand() { return { cmdId: 'c', async wait() { return { exitCode: 78 }; } }; } }; } } }), /STARTUP_FAILED/, 'a pool sandbox may be named; the launcher\'s own refusal surfaces');
  await assert.rejects(() => wakeSandboxAblation({ ...base, sandboxName: 'pm-codex-preview-worker-9' }), /PRODUCT_SANDBOX_NAME_INVALID/);
  await assert.rejects(() => wakeSandboxAblation({ ...base, sections: ['3.19; rm -rf /'] }), /PRODUCT_ABLATION_SECTIONS_INVALID/);
  await assert.rejects(() => wakeSandboxAblation({ ...base, variants: ['Format'] }), /PRODUCT_ABLATION_VARIANTS_INVALID/);
  await assert.rejects(() => wakeSandboxAblation({ ...base, claudeOauthToken: null }), /PRODUCT_SANDBOX_CLAUDE_TOKEN_REQUIRED/);
  await assert.rejects(() => wakeSandboxAblation({ ...base, providerId: ANTHROPIC_API_PROVIDER_ID }), /PRODUCT_SANDBOX_ANTHROPIC_API_KEY_REQUIRED/);
  await assert.rejects(() => wakeSandboxAblation({ ...base, databaseUrl: 'https://tzulhdasmioeechxapdy.supabase.co' }), /DATABASE_TARGET/);
});

test('the status read runs the fixed status shell on the sandbox and parses the job directory, exit code, log tail and table', async () => {
  const output = ['JOB_DIR=/vercel/sandbox/pm-ablation-20261019T031000Z', 'JOB=pm-ablation-20261019T020000Z', 'JOB=pm-ablation-20261019T031000Z', 'EXIT_CODE=0', '---LOG', '{"event":"SECTION_ABLATED"}', '{"event":"ABLATION_JOB_END","exit_code":0}', '', '---TABLE', '| Variant | Section |', '| baseline | 3.19 |', ''].join('\n');
  let commandInput;
  const status = await readSandboxAblationStatus({ jobId: 'pm-ablation-20261019T031000Z', sandboxApi: { async get() { return { async runCommand(command) { commandInput = command; return { exitCode: 0, async stdout() { return output; } }; } }; } } });
  assert.equal(commandInput.cmd, 'sh');
  assert.equal(commandInput.detached, false);
  assert.equal(commandInput.args[1], ablationStatusScript('pm-ablation-20261019T031000Z', 12000));
  assert.deepEqual(status, {
    schema_version: 'PRODUCT_SANDBOX_ABLATION_STATUS/V1', sandbox_name: ABLATION_SANDBOX_NAME, job_id: 'pm-ablation-20261019T031000Z', job_dir: '/vercel/sandbox/pm-ablation-20261019T031000Z',
    jobs: ['pm-ablation-20261019T020000Z', 'pm-ablation-20261019T031000Z'], state: 'DONE', exit_code: 0,
    log_tail: '{"event":"SECTION_ABLATED"}\n{"event":"ABLATION_JOB_END","exit_code":0}', table: '| Variant | Section |\n| baseline | 3.19 |',
  });
  assert.match(ablationStatusScript(null, 500), /ls -d \/vercel\/sandbox\/pm-ablation-\* .* \| tail -n 1/);
  assert.equal(parseAblationStatus('JOB_DIR=/vercel/sandbox/pm-ablation-20261019T031000Z\n---LOG\nrunning\n\n---TABLE\n').state, 'RUNNING');
  assert.equal(parseAblationStatus('JOB_DIR=/x/pm-ablation-20261019T031000Z\nEXIT_CODE=1\n---LOG\n\n---TABLE\n').state, 'FAILED');
  await assert.rejects(() => readSandboxAblationStatus({ jobId: 'pm-ablation-x; ls', sandboxApi: { get: async () => assert.fail('must fail before the resume') } }), /PRODUCT_ABLATION_JOB_ID_INVALID/);
});

function responseDouble() {
  return { statusCode: null, body: null, headers: {}, setHeader(name, value) { this.headers[name] = value; }, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

test('the ablation route opens to the internal bearer token alone, starts the job on the experiments sandbox and reads its status; secrets never return', async () => {
  let wakeInput = null;
  let statusInput = null;
  const handler = createProductAblationHandler({
    actorResolver: (req) => internalBearerActor(req, INTERNAL_ENV),
    wakeAblation: async (input) => { wakeInput = input; return { schema_version: 'PRODUCT_SANDBOX_ABLATION_WAKE/V1', job_id: 'pm-ablation-20261019T031000Z', command_id: 'c1' }; },
    readStatus: async (input) => { statusInput = input; return { schema_version: 'PRODUCT_SANDBOX_ABLATION_STATUS/V1', state: 'RUNNING', log_tail: 'tail' }; },
    databaseUrlResolver: () => 'https://ecrtoofsyxozazkvsvcl.supabase.co',
    serviceRoleKeyResolver: () => 'service-role-secret-value',
    claudeOauthTokenResolver: () => 'claude-oauth-token-secret-value',
    anthropicApiKeyResolver: () => 'sk-ant-api-secret-value-0000000000',
  });
  const bearer = { authorization: `Bearer ${TOKEN}` };
  const body = { run_id: '51577c57-41b1-4b75-bcdf-c84ef2558589', sections: '3.19,5.2,5.17', variants: ['baseline', 'format'] };
  // No bearer: a browser session or nothing at all is refused before anything runs.
  let response = responseDouble();
  await handler({ method: 'POST', headers: { 'x-pm-csrf': 'same-origin', cookie: 'pm_session=whatever' }, body }, response);
  assert.equal(response.statusCode, 401);
  assert.equal(wakeInput, null);
  response = responseDouble();
  await handler({ method: 'POST', headers: { authorization: 'Bearer wrong-token-value-that-is-long-enough-00' }, body }, response);
  assert.equal(response.statusCode, 401);
  // The job on the CLI, the default.
  response = responseDouble();
  await handler({ method: 'POST', headers: bearer, body }, response);
  assert.equal(response.statusCode, 202, JSON.stringify(response.body));
  assert.equal(response.headers['Cache-Control'], 'private, no-store');
  assert.deepEqual({ ...wakeInput, now: undefined }, {
    runId: '51577c57-41b1-4b75-bcdf-c84ef2558589', sections: ['3.19', '5.2', '5.17'], variants: ['baseline', 'format'], providerId: CLAUDE_CLI_PROVIDER_ID, sandboxName: ABLATION_SANDBOX_NAME, now: undefined, loops: 1,
    databaseUrl: 'https://ecrtoofsyxozazkvsvcl.supabase.co', serviceRoleKey: 'service-role-secret-value', claudeOauthToken: 'claude-oauth-token-secret-value',
  });
  assert.equal(typeof wakeInput.now, 'function');
  assert.equal(response.body.job.job_id, 'pm-ablation-20261019T031000Z');
  assert.doesNotMatch(JSON.stringify(response.body), /secret-value/);
  // The API when named: the key goes, the OAuth token does not.
  response = responseDouble();
  await handler({ method: 'POST', headers: bearer, body: { ...body, provider: ANTHROPIC_API_PROVIDER_ID } }, response);
  assert.equal(response.statusCode, 202);
  assert.equal(wakeInput.anthropicApiKey, 'sk-ant-api-secret-value-0000000000');
  assert.equal(wakeInput.claudeOauthToken, undefined);
  // Bad bodies.
  for (const [bad, code] of [[{ ...body, variants: ['nope'] }, 'PRODUCT_ABLATION_VARIANTS_INVALID'], [{ ...body, sections: [] }, 'PRODUCT_ABLATION_SECTIONS_INVALID'], [{ ...body, run_id: 'x' }, 'PRODUCT_ABLATION_RUN_ID_INVALID'], [{ ...body, sandbox_name: 'pm-codex-preview-worker-9' }, 'PRODUCT_SANDBOX_NAME_INVALID'], [{ ...body, provider: 'OPENAI_CODEX_CLI_SUBSCRIPTION' }, 'PRODUCT_ABLATION_PROVIDER_INVALID']]) {
    response = responseDouble();
    await handler({ method: 'POST', headers: bearer, body: bad }, response);
    assert.equal(response.statusCode, 400, code);
    assert.equal(response.body.error, code);
  }
  // Status.
  response = responseDouble();
  await handler({ method: 'POST', headers: bearer, body: { status: true, job_id: 'pm-ablation-20261019T031000Z' } }, response);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(statusInput, { sandboxName: ABLATION_SANDBOX_NAME, jobId: 'pm-ablation-20261019T031000Z' });
  assert.equal(response.body.status.state, 'RUNNING');
  response = responseDouble();
  await handler({ method: 'POST', headers: bearer, body: { status: true } }, response);
  assert.deepEqual(statusInput, { sandboxName: ABLATION_SANDBOX_NAME, jobId: null });
  // A gone sandbox and a missing credential answer as the run route does.
  const gone = Object.assign(new Error('PRODUCT_SANDBOX_GONE: pm-codex-preview-worker-3 cannot be resumed'), { code: 'PRODUCT_SANDBOX_GONE', sandbox_name: 'pm-codex-preview-worker-3' });
  const goneHandler = createProductAblationHandler({ actorResolver: (req) => internalBearerActor(req, INTERNAL_ENV), wakeAblation: async () => { throw gone; }, databaseUrlResolver: () => 'https://ecrtoofsyxozazkvsvcl.supabase.co', serviceRoleKeyResolver: () => 'service-role-secret-value', claudeOauthTokenResolver: () => 'claude-oauth-token-secret-value' });
  response = responseDouble();
  await goneHandler({ method: 'POST', headers: bearer, body }, response);
  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.body, { error: 'PRODUCT_SANDBOX_GONE', sandbox_name: 'pm-codex-preview-worker-3' });
  const unconfigured = createProductAblationHandler({ actorResolver: (req) => internalBearerActor(req, INTERNAL_ENV), wakeAblation: wakeSandboxAblation, databaseUrlResolver: () => 'https://ecrtoofsyxozazkvsvcl.supabase.co', serviceRoleKeyResolver: () => 'service-role-secret-value', claudeOauthTokenResolver: () => null });
  response = responseDouble();
  await unconfigured({ method: 'POST', headers: bearer, body }, response);
  assert.equal(response.statusCode, 503);
  assert.equal(response.body.error, 'Product ablation is not configured');
  response = responseDouble();
  await handler({ method: 'GET', headers: bearer }, response);
  assert.equal(response.statusCode, 405);
});

// Plan finding (189): the full-agreement confirmation runs over every
// section ('all'), and the subscription tokens it would take are
// estimated from the stored run's own calls before anything runs.
test('sections "all" runs every section the stored run has a closure for, and the estimate prices the ladder from the stored calls without a call', async () => {
  const { rows, draft } = await storedRun();
  const baseline = await runSectionAblation({ run: rows, sections: ['all'], variantName: 'baseline', providerId: CLAUDE_CLI_PROVIDER_ID });
  assert.equal(baseline.sections.length, draft.sections.length);
  assert.ok(baseline.sections.every((section) => section.error === null), JSON.stringify(baseline.sections.map((section) => section.error).filter(Boolean)));
  assert.equal(baseline.sections.reduce((sum, section) => sum + section.extraction.live_calls, 0), 0);
  const table = renderAblationTable([baseline]);
  assert.match(table, new RegExp(`\\| baseline \\| all ${draft.sections.length} sections \\|`));
  const estimate = estimateAblationTokens({ run: rows, sections: ['all'], variants: ['anchors_opus55_medium', 'anchors_sonnet55', 'baseline'] });
  const storedCalls = rows.tables.product_model_calls.filter((call) => call.call_kind === 'EXTRACTION');
  assert.equal(estimate.sections, draft.sections.length);
  assert.equal(estimate.stored_extraction_calls, storedCalls.length);
  assert.equal(estimate.stored_output_tokens, storedCalls.length * 50);
  const [opus, sonnet, replayed] = estimate.variants;
  assert.equal(opus.input_tokens, estimate.stored_input_tokens);
  assert.equal(opus.output_tokens, Math.round(estimate.stored_output_tokens * 0.6));
  assert.equal(sonnet.output_tokens, Math.round(estimate.stored_output_tokens * 0.73));
  assert.deepEqual([replayed.input_tokens, replayed.output_tokens], [0, 0], 'a replay rung costs nothing');
  assert.equal(estimate.total_output_tokens, opus.output_tokens + sonnet.output_tokens);
  // The script prints the same estimate from a snapshot and runs nothing.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pm-ablation-estimate-'));
  fs.writeFileSync(path.join(dir, 'rows.json'), JSON.stringify({ schema_version: 'PRODUCT_RUN_SNAPSHOT/V1', ...rows }));
  const script = require('../scripts/product/cost-ablation');
  const logs = [];
  const originalLog = console.log;
  console.log = (line) => logs.push(String(line));
  try {
    await script.main(['--snapshot', path.join(dir, 'rows.json'), '--sections', 'all', '--variant', 'anchors_opus55_medium,anchors_sonnet55', '--provider', CLAUDE_CLI_PROVIDER_ID, '--estimate']);
  } finally {
    console.log = originalLog;
  }
  assert.match(logs.join('\n'), new RegExp(`estimate over ${draft.sections.length} sections`));
  assert.match(logs.join('\n'), /anchors_opus55_medium: about [0-9,]+ input and [0-9,]+ output tokens/);
});


// Plan finding (193), work package E7: the ablation retries a section once
// after a retryable provider failure, as the pipeline's attempt would be
// retried; `loops` sections run at once; the estimate's minutes follow the
// loops asked for; the route, the wake and the launcher carry `loops`.
test('a section whose live call fails on CLAUDE_PRODUCT_JSON is tried once more with the same request; a second failure stays a failed row; a non-retryable failure is not retried', async () => {
  const { rows } = await storedRun();
  const outcomes = { live: [] };
  const factoryWith = (plan) => ({ callKindModels }) => createClaudeCliProductModel({
    callKindModels,
    clientFactory() {
      return { messages: { create: async (request) => {
        const sent = JSON.parse(request.messages[0].content);
        const { call_kind: kind, prompt_version: promptVersion, ...rest } = sent;
        if (kind === 'EXTRACTION') {
          const step = plan.shift();
          outcomes.live.push(step);
          if (step === 'bad') return cliCompleted('prose around the object { not json');
        }
        return cliCompleted(answerFor(kind, { ...rest, prompt_version: promptVersion }));
      } } };
    },
  });
  const logs = [];
  const retried = await runSectionAblation({ run: rows, sections: ['3.1'], variantName: 'format', providerId: CLAUDE_CLI_PROVIDER_ID, liveModelFactory: factoryWith(['bad', 'good']), recorder: createRecorder(), log: (event) => logs.push(event) });
  const row = retried.sections[0];
  assert.equal(row.error, null, JSON.stringify(row.error));
  assert.equal(row.attempts, 2);
  assert.equal(row.retried_after, 'CLAUDE_PRODUCT_JSON');
  assert.equal(row.facts.valid, 1, 'the second attempt extracted the fact');
  assert.equal(row.extraction.live_calls, 1, 'the failed call is not a model call of the section; the good one is');
  assert.ok(logs.some((event) => event.event === 'SECTION_RETRY' && event.after === 'CLAUDE_PRODUCT_JSON' && event.section_reference === '3.1'));
  assert.ok(logs.some((event) => event.event === 'SECTION_ABLATED' && event.attempts === 2 && event.retried_after === 'CLAUDE_PRODUCT_JSON'));
  assert.match(renderAblationTable([retried]), /\| format \| 3\.1 \| 1 \(0\) \|[^\n]*second attempt after CLAUDE_PRODUCT_JSON/);
  // Plan finding (194): what the model wrote on the failed call stays on the row, with the lines reader's reading of it.
  assert.equal(row.failed_calls.length, 1);
  const wrote = row.failed_calls[0];
  assert.equal(wrote.code, 'CLAUDE_PRODUCT_JSON');
  assert.equal(wrote.call_kind, 'EXTRACTION');
  assert.equal(wrote.text_head, '"prose around the object { not json"', 'the CLI fake returns the text JSON-quoted; the call\'s text as received');
  assert.equal(wrote.shape, 'begins with prose');
  assert.deepEqual(wrote.lines_reader, { lines: 1, kept: 0, malformed: 1, trailer: false, broken_last_line: false, truncated: false, proposals: 0 });
  assert.match(renderAblationTable([retried]), /the model wrote: EXTRACTION CLAUDE_PRODUCT_JSON: 36 characters, begins with prose, lines reader keeps 0 of 1 lines \(0 proposals, no trailer\)/);
  // A cut JSON Lines answer the one-object reader rejects: the lines reader would have kept its whole lines.
  const cutLines = ['{"line":"proposal","client_ref":"p1","group_ref":"g1","family_key":"TERMINATION","subtype_key":"X","fact_type":"TERMINATION_RIGHT","components":[]}', '{"line":"proposal","client_ref":"p2","group_ref":"g2","family_key":"TERMINATION","subtype_key":"X","fact_type":"TERMINATION_RIGHT","compo'].join('\n');
  const cutFactory = ({ callKindModels }) => createClaudeCliProductModel({ callKindModels, clientFactory() { return { messages: { create: async (request) => { const sent = JSON.parse(request.messages[0].content); if (sent.call_kind === 'EXTRACTION') { const response = cliCompleted('x'); response.content[0].text = cutLines; response.claude_completion.text_blocks = 2; return response; } const { call_kind: kind, prompt_version: promptVersion, ...rest } = sent; return cliCompleted(answerFor(kind, { ...rest, prompt_version: promptVersion })); } } }; } });
  const cut = await runSectionAblation({ run: rows, sections: ['3.1'], variantName: 'format', providerId: CLAUDE_CLI_PROVIDER_ID, liveModelFactory: cutFactory, recorder: createRecorder() });
  assert.equal(cut.sections[0].attempts, 2);
  assert.equal(cut.sections[0].failed_calls.length, 2, 'both attempts\' failed calls');
  assert.equal(cut.sections[0].failed_calls[0].code, 'CLAUDE_OUTPUT_TRUNCATED');
  assert.equal(cut.sections[0].failed_calls[0].shape, 'begins with JSON');
  assert.deepEqual(cut.sections[0].failed_calls[0].lines_reader, { lines: 2, kept: 1, malformed: 0, trailer: false, broken_last_line: true, truncated: true, proposals: 1 });
  assert.match(renderAblationTable([cut]), /failed twice \(second attempt after CLAUDE_OUTPUT_TRUNCATED\)[^\n]*lines reader keeps 1 of 2 lines \(1 proposals, last line broken, no trailer\)/);
  const twice = await runSectionAblation({ run: rows, sections: ['3.1'], variantName: 'format', providerId: CLAUDE_CLI_PROVIDER_ID, liveModelFactory: factoryWith(['bad', 'bad', 'bad']), recorder: createRecorder() });
  assert.equal(twice.sections[0].attempts, 2);
  assert.equal(twice.sections[0].retried_after, 'CLAUDE_PRODUCT_JSON');
  assert.match(twice.sections[0].error.code, /CLAUDE_PRODUCT_JSON/);
  assert.match(renderAblationTable([twice]), /\| format \| 3\.1 \| failed \|[^\n]*failed twice \(second attempt after CLAUDE_PRODUCT_JSON\)/);
  assert.equal(ablationTotals(twice), null, 'no section done: no totals row');
  const other = await runSectionAblation({ run: rows, sections: ['3.1'], variantName: 'format', providerId: CLAUDE_CLI_PROVIDER_ID, liveModelFactory: () => ({ async complete() { throw Object.assign(new Error('PROVIDER_DOWN: no'), { code: 'PROVIDER_DOWN' }); } }), recorder: createRecorder() });
  assert.equal(other.sections[0].attempts, 1, 'an unknown failure is not retried');
  assert.equal(other.sections[0].retried_after, undefined);
  assert.equal(isRetryableAblationFailure({ code: 'ANTHROPIC_API_OUTPUT_TRUNCATED' }), true);
  assert.equal(isRetryableAblationFailure({ code: 'REPLAY_MISS' }), false);
  assert.equal(isRetryableAblationFailure({ message: 'CLAUDE_PRODUCT_JSON: response must be one exact JSON object [section 5.17]' }), true);
});

// Plan finding (199e), work package E12: a THIN_ANSWER retry costs the
// thin part alone: the first attempt lets every part answer, the second
// replays the healthy parts' records (the pipeline's attempt-resume rule)
// and sends the thin part again.
test('a THIN_ANSWER on one part is retried with the first attempt\'s other calls replayed: the provider answers the thin part alone the second time, the row names the replayed calls and the spend is counted once', async () => {
  const rows = await buildLayoutRun();
  assert.deepEqual(rows.tables.product_section_work.map((row) => row.error_history.length), rows.tables.product_section_work.map((row) => (rows.tables.product_source_closures.find((closure) => closure.structure_node_id === row.node_id)?.section_reference === '5.1' ? 1 : 0)));
  const provider = [];
  let partOneShort = true;
  const factory = ({ callKindModels }) => createClaudeCliProductModel({
    callKindModels,
    clientFactory() {
      return { messages: { create: async (request) => {
        const sent = JSON.parse(request.messages[0].content);
        const { call_kind: kind, prompt_version: promptVersion, ...rest } = sent;
        const logical = { ...rest, prompt_version: promptVersion };
        const part = logical.source_closure?.extraction_part?.part || null;
        provider.push(`${kind}${part ? ` part ${part}` : ''}`);
        if (kind !== 'EXTRACTION') return cliCompleted(layoutAnswer(kind, logical));
        const answer = countedAnswerFor(logical, { familyKey: 'INTERIM_OPERATING', shortfall: (which) => (which === 1 && partOneShort ? 1 : 0) });
        if (part === 1) partOneShort = false;
        return cliCompleted(answer);
      } } };
    },
  });
  const logs = [];
  const result = await runSectionAblation({ run: rows, sections: ['5.1'], variantName: 'counts_sonnet55', providerId: CLAUDE_CLI_PROVIDER_ID, liveModelFactory: factory, recorder: createRecorder(), log: (event) => logs.push(event) });
  const row = result.sections[0];
  assert.equal(row.error, null, JSON.stringify(row.error));
  assert.equal(row.attempts, 2);
  assert.equal(row.retried_after, 'THIN_ANSWER');
  assert.deepEqual(provider.filter((entry) => entry.startsWith('EXTRACTION')), ['EXTRACTION part 1', 'EXTRACTION part 2', 'EXTRACTION part 1'], 'every part answered on the first attempt; the thin part alone on the second');
  assert.ok(row.replayed_calls.includes('EXTRACTION part 2'), JSON.stringify(row.replayed_calls));
  const extraction = row.result.model_calls.filter((call) => call.call_kind === 'EXTRACTION');
  assert.equal(extraction.filter((call) => call.resumed_from_model_call_id).length, 1, 'part 2 of the second attempt is a record of the first\'s with no spend');
  assert.ok(extraction.filter((call) => call.resumed_from_model_call_id).every((call) => call.output_tokens === 0 && call.cost_microusd === 0));
  assert.equal(row.extraction.live_calls, 3, 'three extraction calls were made');
  assert.ok(logs.some((event) => event.event === 'SECTION_ABLATED' && event.attempts === 2 && event.replayed_calls.includes('EXTRACTION part 2')));
  assert.match(renderAblationTable([result]), /second attempt after THIN_ANSWER \(\d+ of the first attempt's calls replayed: [^)]*EXTRACTION part 2[^)]*\)/);
  assert.ok(row.facts.valid >= 3, `limb (a)'s two lead sentences, limb (b)'s one and limb (c): ${row.facts.valid}`);
});

test('loops runs that many sections at once with the rows in the run\'s order; the estimate\'s minutes follow the loops asked; the route, the wake and the launcher carry loops', async () => {
  const { rows, draft } = await storedRun();
  let inFlight = 0;
  let peak = 0;
  const factory = ({ callKindModels }) => createClaudeCliProductModel({
    callKindModels,
    clientFactory() {
      return { messages: { create: async (request) => {
        inFlight += 1; peak = Math.max(peak, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 15));
        inFlight -= 1;
        const sent = JSON.parse(request.messages[0].content);
        const { call_kind: kind, prompt_version: promptVersion, ...rest } = sent;
        return cliCompleted(answerFor(kind, { ...rest, prompt_version: promptVersion }));
      } } };
    },
  });
  // routing_haiku routes every section live, so two sections' calls overlap; format's one live extraction (3.1) does not.
  const two = await runSectionAblation({ run: rows, sections: ['all'], variantName: 'routing_haiku', providerId: CLAUDE_CLI_PROVIDER_ID, liveModelFactory: factory, recorder: createRecorder(), loops: 2 });
  assert.deepEqual(two.sections.map((section) => section.section_reference), draft.sections.map((section) => section.section_reference), 'the rows keep the run\'s order');
  assert.ok(two.sections.every((section) => section.error === null), JSON.stringify(two.sections.map((section) => section.error).filter(Boolean)));
  assert.equal(peak, 2, 'two sections in flight at once');
  const one = await runSectionAblation({ run: rows, sections: ['all'], variantName: 'routing_haiku', providerId: CLAUDE_CLI_PROVIDER_ID, liveModelFactory: factory, recorder: createRecorder() });
  assert.equal(one.sections.length, two.sections.length);
  const ordered = await mapInOrder([30, 5, 1], 3, async (ms) => { await new Promise((resolve) => setTimeout(resolve, ms)); return ms; });
  assert.deepEqual(ordered, [30, 5, 1]);
  const estimate = estimateAblationTokens({ run: rows, sections: ['all'], variants: ['anchors_sonnet55'], loops: 4 });
  const single = estimateAblationTokens({ run: rows, sections: ['all'], variants: ['anchors_sonnet55'] });
  assert.equal(estimate.loops, 4);
  assert.equal(single.loops, 1, 'one loop unless asked: the job runs sections one after another');
  assert.equal(estimate.variants[0].wall_minutes_at_loops, Math.round(estimate.variants[0].serial_seconds / 4 / 60));
  assert.equal(single.variants[0].wall_minutes_at_loops, Math.round(single.variants[0].serial_seconds / 60));
  // The wake: a fifth argument only when more than one.
  let commandInput;
  const api = { async get() { return { currentSession: () => ({ createdAt: new Date('2026-10-19T03:00:00.000Z'), timeout: 60 * 60 * 1000 }), async extendTimeout() {}, async runCommand(command) { commandInput = command; return { cmdId: 'c', async wait({ signal }) { return new Promise((resolve, reject) => { signal.addEventListener('abort', () => reject(signal.reason), { once: true }); }); } }; } }; } };
  const base = { runId: '51577c57-41b1-4b75-bcdf-c84ef2558589', sections: ['all'], variants: ['anchors_sonnet55'], databaseUrl: 'https://ecrtoofsyxozazkvsvcl.supabase.co', serviceRoleKey: 'service-role-secret-value', providerId: CLAUDE_CLI_PROVIDER_ID, claudeOauthToken: 'claude-oauth-token-secret-value', sandboxApi: api, now: () => Date.parse('2026-10-19T03:10:00.000Z') };
  const woke = await wakeSandboxAblation({ ...base, loops: 3 });
  assert.deepEqual(commandInput.args, ['pm-ablation-20261019T031000Z', '51577c57-41b1-4b75-bcdf-c84ef2558589', 'all', 'anchors_sonnet55', '3']);
  assert.equal(woke.loops, 3);
  await wakeSandboxAblation(base);
  assert.deepEqual(commandInput.args, ['pm-ablation-20261019T031000Z', '51577c57-41b1-4b75-bcdf-c84ef2558589', 'all', 'anchors_sonnet55'], 'one loop: the launcher\'s four arguments as before');
  await assert.rejects(() => wakeSandboxAblation({ ...base, loops: 0 }), /PRODUCT_ABLATION_LOOPS_INVALID/);
  // The route body.
  let wakeInput;
  const handler = createProductAblationHandler({ actorResolver: (req) => internalBearerActor(req, INTERNAL_ENV), wakeAblation: async (input) => { wakeInput = input; return { job_id: 'pm-ablation-20261019T031000Z' }; }, databaseUrlResolver: () => 'https://ecrtoofsyxozazkvsvcl.supabase.co', serviceRoleKeyResolver: () => 'service-role-secret-value', claudeOauthTokenResolver: () => 'claude-oauth-token-secret-value' });
  const bearer = { authorization: `Bearer ${INTERNAL_ENV.PRODUCT_INTERNAL_TOKEN}` };
  const body = { run_id: '51577c57-41b1-4b75-bcdf-c84ef2558589', sections: ['all'], variants: ['anchors_sonnet55'] };
  let response = responseDouble();
  await handler({ method: 'POST', headers: bearer, body: { ...body, loops: 4 } }, response);
  assert.equal(response.statusCode, 202);
  assert.equal(wakeInput.loops, 4);
  response = responseDouble();
  await handler({ method: 'POST', headers: bearer, body }, response);
  assert.equal(wakeInput.loops, 1, 'one unless asked');
  response = responseDouble();
  await handler({ method: 'POST', headers: bearer, body: { ...body, loops: 99 } }, response);
  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error, 'PRODUCT_ABLATION_LOOPS_INVALID');
  // The launcher takes a fifth argument and passes it as --loops.
  const launcher = fs.readFileSync(path.join(__dirname, '../infra/codex-sandbox-worker/ablation-launch.sh'), 'utf8');
  assert.match(launcher, /\(\$# -ne 4 && \$# -ne 5\)/);
  assert.match(launcher, /LOOPS="\$\{5:-1\}"/);
  assert.match(launcher, /--loops "\$loops"/);
  // The script prints the minutes at the loops asked.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pm-ablation-loops-'));
  fs.writeFileSync(path.join(dir, 'rows.json'), JSON.stringify({ schema_version: 'PRODUCT_RUN_SNAPSHOT/V1', ...rows }));
  const script = require('../scripts/product/cost-ablation');
  const logs = [];
  const originalLog = console.log;
  console.log = (line) => logs.push(String(line));
  try {
    await script.main(['--snapshot', path.join(dir, 'rows.json'), '--sections', 'all', '--variant', 'anchors_sonnet55', '--provider', CLAUDE_CLI_PROVIDER_ID, '--estimate', '--loops', '2']);
  } finally {
    console.log = originalLog;
  }
  assert.match(logs.join('\n'), /min at 2 loops/);
});
