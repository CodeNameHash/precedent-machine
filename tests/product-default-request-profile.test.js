'use strict';

process.env.PRODUCT_PHASE2_HELPER_ONLY = '1';

const assert = require('node:assert/strict');
const test = require('node:test');
const { buildAgreementStructure } = require('../lib/product/agreement-structure');
const { LEAN_PROMPT_VERSION, buildAgreementSectionDraft, extractionPartConcurrency } = require('../lib/product/agreement-draft');
const { cacheableContent } = require('../lib/product/anthropic-api-model');
const { createProductIntakeHandler } = require('../lib/product/intake-handler');
const {
  ANTHROPIC_API_DEFAULT_MODEL_CONFIG, ANTHROPIC_API_LEAN_MODEL_CONFIG, ANTHROPIC_API_MODEL_CONFIG, ANTHROPIC_API_PROVIDER_ID, CLAUDE_CLI_DEFAULT_MODEL_CONFIG, CLAUDE_CLI_MODEL_CONFIG, CLAUDE_CLI_PROVIDER_ID, REQUEST_PROFILES,
  assertConfiguredRunModelConfig, claudeCliConfigForEnvironment, claudeCliModelConfigFor, configuredProductModelConfig, hostedModelConfigFor, requestProfileFor, requestProfileNameForEnvironment, resolveClaudeCliCallModel,
} = require('../lib/product/product-model-config');
const { substantiveSections } = require('../lib/product/source-context');
const { conchoSource, createSyntheticConchoModel } = require('./product-phase-2.test.js');
const schemaV2 = require('../contracts/product/legal-schema.v2.json');

// Work package E3 (plan findings (177) and (184); implementer E). Ben,
// 2026-10-19: "be implanting its existing ideas now too". The stack that
// needs no proof is the default for every new run on both providers,
// behind the model-config identity; a run created under an earlier config
// advances under it.

test('the default profile and configs: new runs take them on both providers, earlier runs keep theirs by identity, the environment can choose V9', () => {
  assert.deepEqual(REQUEST_PROFILES.DEFAULT, { name: 'DEFAULT', response_format: 'V10', quote_mode: 'anchors', context_mode: 'inline', stable_blocks: 2, contracts_scope: 'all' });
  assert.equal(requestProfileNameForEnvironment({}), 'DEFAULT');
  assert.equal(requestProfileNameForEnvironment({ PRODUCT_REQUEST_PROFILE: 'v9' }), 'V9');
  assert.equal(requestProfileNameForEnvironment({ PRODUCT_REQUEST_PROFILE: 'V9', PRODUCT_ANTHROPIC_API_PROFILE: 'LEAN' }, ANTHROPIC_API_PROVIDER_ID), 'LEAN');
  assert.equal(requestProfileNameForEnvironment({ PRODUCT_REQUEST_PROFILE: 'V9', PRODUCT_ANTHROPIC_API_PROFILE: 'LEAN' }, CLAUDE_CLI_PROVIDER_ID), 'V9', 'the API switch does not reach the CLI');
  // The CLI.
  assert.equal(claudeCliConfigForEnvironment({}), CLAUDE_CLI_DEFAULT_MODEL_CONFIG);
  assert.equal(claudeCliConfigForEnvironment({ PRODUCT_REQUEST_PROFILE: 'V9' }), CLAUDE_CLI_MODEL_CONFIG);
  assert.throws(() => claudeCliConfigForEnvironment({ PRODUCT_REQUEST_PROFILE: 'LEAN' }), /PRODUCT_REQUEST_PROFILE_UNSUPPORTED: LEAN on ANTHROPIC_CLAUDE_CLI_SUBSCRIPTION/, 'the cached agreement is the API\'s alone');
  assert.equal(CLAUDE_CLI_DEFAULT_MODEL_CONFIG.model_id, 'PRODUCT_CLAUDE_CLI_CALL_KIND_MAP/V2');
  assert.deepEqual(resolveClaudeCliCallModel(CLAUDE_CLI_DEFAULT_MODEL_CONFIG, 'ROUTING'), { model: 'claude-haiku-5-5', effort: 'low' });
  assert.deepEqual(resolveClaudeCliCallModel(CLAUDE_CLI_DEFAULT_MODEL_CONFIG, 'RESIDUAL'), { model: 'claude-haiku-5-5', effort: 'low' });
  assert.deepEqual(resolveClaudeCliCallModel(CLAUDE_CLI_DEFAULT_MODEL_CONFIG, 'EXTRACTION'), { model: 'claude-opus-5', effort: 'high' }, 'the CLI keeps Opus 5 for extraction until the ablation has run its rung');
  assert.deepEqual(resolveClaudeCliCallModel(CLAUDE_CLI_MODEL_CONFIG, 'ROUTING'), { model: 'claude-opus-5', effort: 'low' }, 'V1 unchanged');
  assert.equal(requestProfileFor(CLAUDE_CLI_DEFAULT_MODEL_CONFIG).name, 'DEFAULT');
  assert.equal(requestProfileFor(CLAUDE_CLI_MODEL_CONFIG).name, 'V9');
  assert.equal(claudeCliModelConfigFor({ ...CLAUDE_CLI_DEFAULT_MODEL_CONFIG, max_output_tokens: 1 }), CLAUDE_CLI_DEFAULT_MODEL_CONFIG);
  assert.equal(claudeCliModelConfigFor({ ...CLAUDE_CLI_DEFAULT_MODEL_CONFIG, tools: 'all' }), null);
  // The API.
  assert.equal(ANTHROPIC_API_DEFAULT_MODEL_CONFIG.model_id, 'PRODUCT_ANTHROPIC_API_CALL_KIND_MAP/V3');
  assert.deepEqual(ANTHROPIC_API_DEFAULT_MODEL_CONFIG.call_kind_models.EXTRACTION, { model: 'claude-opus-5-5', effort: 'high' });
  assert.equal(requestProfileFor(ANTHROPIC_API_DEFAULT_MODEL_CONFIG).name, 'DEFAULT');
  assert.equal(requestProfileFor(ANTHROPIC_API_LEAN_MODEL_CONFIG).name, 'LEAN');
  // A run's stored config decides, on both providers: the paused and finished runs keep theirs.
  for (const [providerId, stored, fresh] of [[CLAUDE_CLI_PROVIDER_ID, CLAUDE_CLI_MODEL_CONFIG, CLAUDE_CLI_DEFAULT_MODEL_CONFIG], [ANTHROPIC_API_PROVIDER_ID, ANTHROPIC_API_MODEL_CONFIG, ANTHROPIC_API_DEFAULT_MODEL_CONFIG], [ANTHROPIC_API_PROVIDER_ID, ANTHROPIC_API_LEAN_MODEL_CONFIG, ANTHROPIC_API_DEFAULT_MODEL_CONFIG]]) {
    const run = { run_id: 'r', model_config: { ...stored, max_output_tokens: 64000 } };
    assert.equal(hostedModelConfigFor(providerId, run, {}), stored);
    assert.doesNotThrow(() => assertConfiguredRunModelConfig(run, hostedModelConfigFor(providerId, run, {})), 'the worker accepts the run under its own config');
    assert.throws(() => assertConfiguredRunModelConfig(run, fresh), /PRODUCT_RUN_MODEL_CONFIG_MISMATCH/);
    assert.equal(hostedModelConfigFor(providerId, null, {}), fresh);
    assert.equal(configuredProductModelConfig({ PRODUCT_MODEL_PROVIDER: providerId }), fresh);
  }
  // Eight loops and the parts together are the launcher's and the draft's defaults; the environment still overrides.
  assert.equal(extractionPartConcurrency({}), 4);
  assert.equal(extractionPartConcurrency({ PRODUCT_EXTRACTION_PART_CONCURRENCY: '1' }), 1);
  assert.match(require('node:fs').readFileSync(require('node:path').join(__dirname, '../infra/codex-sandbox-worker/launch.sh'), 'utf8'), /--workers "\$\{PRODUCT_HOSTED_WORKERS:-8\}"/);
});

test('an intake on either hosted provider creates the run under the default config; the environment\'s V9 switch gives the earlier one', async () => {
  const submitted = [];
  const handler = (env) => createProductIntakeHandler({
    getClient: () => ({}), intakeFactory: () => ({ intake() {} }), storeFactory: () => ({}),
    modelConfigResolver: () => configuredProductModelConfig({ PRODUCT_MODEL_PROVIDER: CLAUDE_CLI_PROVIDER_ID, ...env }),
    foundationFactory: () => ({ submit: async (input) => { submitted.push(input); return { run_id: 'run-1', source_document_id: 's', source_generation: 9, status: 'QUEUED', stage: 'SECTION_ANALYSIS' }; } }),
  });
  const recorder = () => ({ statusCode: null, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
  const body = { url: 'https://www.sec.gov/Archives/edgar/data/1/0001/x.htm', idempotencyKey: 'k-1', explicitGeneration: 9 };
  await handler({})({ method: 'POST', body }, recorder());
  assert.equal(submitted[0].modelConfig, CLAUDE_CLI_DEFAULT_MODEL_CONFIG);
  await handler({ PRODUCT_REQUEST_PROFILE: 'V9' })({ method: 'POST', body }, recorder());
  assert.equal(submitted[1].modelConfig, CLAUDE_CLI_MODEL_CONFIG);
  // A provider named in the body takes the environment's config for that provider (hostedModelConfigFor without a run).
  await handler({})({ method: 'POST', body: { ...body, provider: ANTHROPIC_API_PROVIDER_ID } }, recorder());
  assert.equal(submitted[2].modelConfig.model_id, hostedModelConfigFor(ANTHROPIC_API_PROVIDER_ID).model_id);
});

// The answer the model writes under the default profile: aliases, the
// components alone, a long component by its first and last words.
function defaultAnswer(request) {
  const family = request.family_contracts.find((item) => item.family_key === 'NO_SHOP');
  const subtype = family.subtypes[0];
  const operative = request.source_closure.operative[0];
  const sentence = operative.exact_text.split(/(?<=\.)\s+/)[0];
  const words = sentence.trim().split(/\s+/);
  return {
    proposals: [{
      client_ref: 'p1', group_ref: 'g1', family_key: 'NO_SHOP', subtype_key: subtype.subtype_key, fact_type: family.required_fact_types[0], statement: sentence,
      headline: { label: subtype.label || subtype.subtype_key, distinguishing_refs: ['c1'], summary: 'The no-shop covenant under the default profile' },
      components: [{ ref: 'c1', kind: 'OPERATION', label: 'the covenant', quote_from: words.slice(0, 4).join(' '), quote_to: words.slice(-4).join(' '), source_span_id: operative.span_id, occurrence: 0, origin: 'OWN', gap_before: false, children: [] }],
    }],
    groups: [{ client_ref: 'g1', family_key: 'NO_SHOP', subtype_key: subtype.subtype_key }],
    links: [],
    coverage: Object.fromEntries(Object.keys(request.response_contract.allowed_fact_types_by_family).map((key) => [key, key === 'NO_SHOP' ? 'FOUND' : 'NOT_FOUND'])),
  };
}

test('under the default profile Concho 6.3 goes out as one V10 request with every family\'s contracts in the stable blocks and the routed family named, and the fact compiles VALID', async () => {
  const sourceDocument = await conchoSource();
  const agreementStructure = buildAgreementStructure(sourceDocument);
  const node = substantiveSections(agreementStructure).find((item) => item.reference === '6.3');
  const synthetic = createSyntheticConchoModel();
  const seen = [];
  const model = { async complete(input) {
    seen.push(input);
    if (input.call_kind !== 'EXTRACTION') return synthetic.complete(input);
    const response = defaultAnswer(input.request);
    return { provider_id: 'SYNTHETIC', model_id: 'DEFAULT/V1', raw_request: input.request, raw_response: response, response, input_tokens: 10, output_tokens: 5, cost_microusd: 0, duration_ms: 1 };
  } };
  const result = await buildAgreementSectionDraft({ sourceDocument, agreementStructure, legalSchema: schemaV2, model, node, requestProfile: requestProfileFor(ANTHROPIC_API_DEFAULT_MODEL_CONFIG) });
  const extraction = seen.find((input) => input.call_kind === 'EXTRACTION');
  assert.equal(extraction.prompt_version, LEAN_PROMPT_VERSION);
  assert.equal(extraction.context, undefined, 'the context stays inline: the cached agreement waits for the ablation');
  assert.equal(extraction.request.family_contracts.length, schemaV2.families.length, 'every family\'s contract goes in the stable block');
  assert.deepEqual(extraction.request.routed_families, ['NO_SHOP']);
  assert.deepEqual(Object.keys(extraction.request.response_contract.allowed_fact_types_by_family), ['NO_SHOP'], 'the answer is bound to the routed family');
  assert.equal(extraction.request.response_contract.proposals[0].roles, undefined);
  assert.match(extraction.request.component_instruction, /quote_from/);
  // Laid out for the API: two stable blocks, the second the same on every section (every family), and the section block.
  const laid = cacheableContent(extraction, REQUEST_PROFILES.DEFAULT);
  assert.equal(laid.content.length, 3);
  assert.ok(laid.content[0].cache_control && laid.content[1].cache_control && !laid.content[2].cache_control);
  const second = JSON.parse(laid.content[1].text);
  assert.equal(second.family_contracts.length, schemaV2.families.length);
  assert.equal(result.proposals.length, 1);
  assert.equal(result.proposals[0].validation_status, 'VALID', JSON.stringify(result.issues.map((issue) => [issue.code, issue.message]).slice(0, 6)));
  assert.ok(result.proposals[0].components[0].text.split(/\s+/).length >= 8, 'the anchored words resolved');
  const note = JSON.parse(result.issues.find((issue) => issue.code === 'LEAN_RESPONSE_NORMALISED').message);
  assert.equal(note.request_profile, 'DEFAULT');
  assert.equal(note.anchors_resolved, 1);
});
