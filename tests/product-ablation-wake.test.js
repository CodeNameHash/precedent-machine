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
const { ABLATION_VARIANTS, createRecorder, estimateAblationTokens, renderAblationTable, runSectionAblation, variantAvailability } = require('../lib/product/cost-ablation');
const { createRecordedModelAdapter } = require('../lib/product/model-adapter');
const { ANTHROPIC_API_PROVIDER_ID, CLAUDE_CLI_PROVIDER_ID } = require('../lib/product/product-model-config');
const { internalBearerActor } = require('../lib/product/request-auth');
const {
  ABLATION_LAUNCHER, ABLATION_SANDBOX_NAME, MINIMUM_SESSION_MS, SANDBOX_WORKDIR, ablationStatusScript, parseAblationStatus, readSandboxAblationStatus, wakeSandboxAblation,
} = require('../lib/product/sandbox-wake');
const { createSecIntakeAdapter } = require('../lib/product/sec-intake');
const { substantiveSections } = require('../lib/product/source-context');
const schemaV2 = require('../contracts/product/legal-schema.v2.json');

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
      product_section_work: draft.sections.map((section, index) => ({ run_id: RUN_ID, node_id: section.node_id, authored_order: index, status: 'COMPLETE', attempts: 1, attempt_token: null, error_history: [] })),
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
  return { draft, rows };
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
    run_id: '51577c57-41b1-4b75-bcdf-c84ef2558589', sandbox_name: ABLATION_SANDBOX_NAME, provider_id: CLAUDE_CLI_PROVIDER_ID, sections: ['3.19', '5.2', '5.17'], variants: ['baseline', 'format'], command_id: 'ablation-command-1',
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
    runId: '51577c57-41b1-4b75-bcdf-c84ef2558589', sections: ['3.19', '5.2', '5.17'], variants: ['baseline', 'format'], providerId: CLAUDE_CLI_PROVIDER_ID, sandboxName: ABLATION_SANDBOX_NAME, now: undefined,
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
