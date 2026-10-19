'use strict';

// Work package 3 (plan findings (44) and (45)). The Anthropic API as a hosted
// provider beside the Claude CLI path: the same model tier and effort per
// call kind (claude-opus-5; routing and residual at low, extraction at
// high), the same compact-JSON system prompt, Claude Code's default output
// cap, adaptive thinking (the model's default; no sampling parameters, which
// the model refuses), streaming so a long extraction is not cut off by the
// request timeout, and every call's cost recorded at the published rates.
// The key is ANTHROPIC_API_KEY on the deployment, passed to the sandbox by
// the wake, never read from the repository. Ben, 2026-10-17: "also you now
// have $200 of API tokens you can use if you want to preseve subscription
// capcaity".

const { attachReceivedProviderFailure, createJsonModelAdapter } = require('./model-adapter');
const { ANTHROPIC_API_CACHE_TTL, ANTHROPIC_API_MODEL_CONFIG, ANTHROPIC_API_PROVIDER_ID, anthropicApiCostMicrousd, requestProfileFor, resolveAnthropicApiCallModel } = require('./product-model-config');
const { sha256Hex } = require('../canonical-v2/canonical-bytes');
const { exactJsonObject } = require('./codex-cli-model');
const { LINES_SYSTEM_PROMPT, SYSTEM_PROMPT, unfenced } = require('./claude-cli-model');
const { isFactLinesRequest, readFactLines } = require('./fact-lines');

const PROVIDER_ID = ANTHROPIC_API_PROVIDER_ID;

class AnthropicApiProductModelError extends Error {
  constructor(code, detail) {
    super(`${code}: ${detail}`);
    this.name = 'AnthropicApiProductModelError';
    this.code = code;
  }
}

function fail(code, detail) {
  throw new AnthropicApiProductModelError(code, detail);
}

function usageInteger(usage, key) {
  return Number.isInteger(usage?.[key]) && usage[key] >= 0 ? usage[key] : null;
}

// The whole prompt, as the CLI path counts it: fresh, cache-written and
// cache-read tokens together.
function totalInputTokens(usage) {
  return ['input_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens']
    .reduce((sum, key) => sum + (usageInteger(usage, key) ?? 0), 0);
}

// A 429 (after the SDK's own retries) or an exhausted credit balance (a 400
// naming the balance) is the account's limit, not a section failure: the
// worker stops with its usage-limit reason (scripts/product-hosted-worker.js,
// isUsageLimitError) instead of burning attempts, as it does on the CLI
// paths. The message carries the words that rule matches.
function isAccountLimit(error) {
  const status = Number(error?.status ?? error?.statusCode);
  if (status === 429) return true;
  return status === 400 && /credit balance/i.test(String(error?.message || ''));
}

// Work package 11 (plan finding (70)). NCS generation 5 on the API (run
// 51577c57, 2026-10-18 11:27 UTC) failed within a minute with zero tokens
// spent: every call answered 400 invalid_request_error, "This API key is
// not scoped to a workspace, so this request must include the
// anthropic-workspace-id header with the ID of the workspace to use. Add
// the header, or use an API key that is scoped to a workspace." Ben's key
// is an organisation-level key. When ANTHROPIC_WORKSPACE_ID is configured
// the client sends it as that header on every request (the SDK's
// defaultHeaders option: @anthropic-ai/sdk 0.78.0 client.d.ts, "Default
// headers to include with every request to the API"); when it is not,
// nothing changes. A 400 naming the header is the account's configuration,
// not a section failure: the worker stops on it the way it stops on a
// usage limit, instead of burning every section's attempts.
function isWorkspaceScopeError(error) {
  const status = Number(error?.status ?? error?.statusCode);
  return status === 400 && /anthropic-workspace-id|not scoped to a workspace/i.test(String(error?.message || ''));
}

function notConfiguredError(error, { workspaceConfigured = false } = {}) {
  const state = workspaceConfigured
    ? 'the API refused the key with the ANTHROPIC_WORKSPACE_ID header sent'
    : 'the API key is not scoped to a workspace and no ANTHROPIC_WORKSPACE_ID is set';
  const failure = new AnthropicApiProductModelError('ANTHROPIC_API_NOT_CONFIGURED', `${state} (400): ${String(error?.message || '').slice(0, 400)}`);
  failure.cause = error;
  return failure;
}

// The worker's test for the error above, wherever it surfaces.
function isNotConfiguredError(error) {
  return error?.code === 'ANTHROPIC_API_NOT_CONFIGURED' || /^ANTHROPIC_API_NOT_CONFIGURED\b/.test(String(error?.message || ''));
}

// The client's options: the key, and the workspace header when a workspace
// id is configured. The id is not printed anywhere.
function clientOptions({ apiKey, workspaceId }) {
  const id = typeof workspaceId === 'string' ? workspaceId.trim() : '';
  return { apiKey, ...(id ? { defaultHeaders: { 'anthropic-workspace-id': id } } : {}) };
}

function accountLimitError(error) {
  const status = Number(error?.status ?? error?.statusCode);
  const limit = new AnthropicApiProductModelError('ANTHROPIC_API_USAGE_LIMIT', `usage limit on the API account (${status}): ${String(error?.message || '').slice(0, 300)}`);
  limit.cause = error;
  return limit;
}

// Work package 10 (plan finding (67)): the prompt cache. Every request is
// sent as two text blocks in one user message. The first holds the parts
// that do not change from section to section (call kind, prompt version,
// the instructions, the response contract, and for an extraction the
// routed families' contracts, table shapes and layer rules: a function of
// the schema and the routed family set only) and carries the cache
// breakpoint; the second holds the section under analysis. Across sections
// with the same routed families the first block is byte-identical, so the
// API reads it from its cache (claude-opus-5 caches a prefix of 512 tokens
// or more: platform.claude.com/docs/en/build-with-claude/prompt-caching,
// read 2026-10-18; the smallest stable block here, a residual pass's, is
// about 1,600 bytes). The cache is keyed per routed family set, so the
// model reads exactly the contracts it read before the cache, in a new
// order: the section's closure now follows the contracts instead of
// preceding them. The whole schema's contracts in one cache for every
// section would have made the model read contracts it was not routed to,
// a change of what it reads; not taken. Generation 8's profile: extraction's
// stable part was 41 per cent of its input tokens over 40 distinct routed
// family sets (90 of 130 calls repeat a set), routing's 76 per cent (one
// set), a residual pass's 27 per cent.
const PER_SECTION_KEYS = Object.freeze({
  ROUTING: Object.freeze(['section_reference', 'section', 'deterministic_family_evidence']),
  RESIDUAL: Object.freeze(['section_reference', 'routed_families', 'paragraphs']),
  EXTRACTION: Object.freeze(['source_closure', 'part_instruction', 'article_introduction_instruction', 'no_other_reps_instruction']),
});

// Added to the system prompt when the request is sent in two blocks.
const REQUEST_LAYOUT_NOTE = 'The request is two JSON objects in one message: the first holds the instructions and contracts, the second the section under analysis. Read them together as one request.';

// Work package E1 (implementer E): under a request profile with two
// stable blocks, the keys that never change from call to call of a kind
// (the instructions, the response contract, every family's target
// contracts) go in a first block written once a run, and the routed
// families' contracts and table shapes in a second; NCS generation 5
// wrote 51 distinct stable blocks (one per routed family set, 22 used
// once) at twice the input rate, and 41 per cent of their bytes were the
// same on every call.
const ROUTED_KEYS = Object.freeze(['family_contracts', 'table_shapes', 'no_conclusions_subtype_keys', 'family_routing_contracts', 'allowed_families']);

function splitRequestForCache(input, profile = null) {
  const perSection = new Set(PER_SECTION_KEYS[input?.call_kind] || []);
  const stable = { call_kind: input.call_kind, prompt_version: input.prompt_version };
  const routed = {};
  const section = {};
  const twoBlocks = Number(profile?.stable_blocks) === 2;
  for (const [key, value] of Object.entries(input.request || {})) {
    if (perSection.has(key)) section[key] = value;
    else if (twoBlocks && ROUTED_KEYS.includes(key)) routed[key] = value;
    else stable[key] = value;
  }
  return { stable, routed, section };
}

// The agreement block of the cached-agreement profile: the whole canonical
// text under its own breakpoint, written once an hour and read at the
// cache rate on every call; the stored request keeps a marker in its
// place (the text is the stored source document's, by id and hash).
const AGREEMENT_LAYOUT_NOTE = 'The first block is the agreement\'s whole text; the request\'s source_closure names the sections, definitions and cross-references within it by section reference, span and first words. Read them there.';

function agreementBlock(input) {
  const text = input?.context?.agreement_text;
  if (typeof text !== 'string' || !text) return null;
  const marker = {
    agreement_block: {
      source_document_id: input.request?.agreement_context?.source_document_id || null,
      bytes: Buffer.byteLength(text, 'utf8'),
      sha256: sha256Hex(Buffer.from(text, 'utf8')),
      note: 'the agreement\'s canonical text was sent here under a cache breakpoint; it is the stored source document\'s, not repeated in the stored request',
    },
  };
  return {
    sent: { type: 'text', text: `AGREEMENT TEXT\n\n${text}`, cache_control: { type: 'ephemeral', ttl: ANTHROPIC_API_CACHE_TTL } },
    stored: { type: 'text', text: JSON.stringify(marker), cache_control: { type: 'ephemeral', ttl: ANTHROPIC_API_CACHE_TTL } },
  };
}

// The system prompt and the user content for one call: the agreement
// block when the profile caches the agreement, the stable block (or two)
// under a breakpoint each, then the section block when there is one (an
// empty text block is refused by the API). Returns the content as sent
// and the content to store (the same, with the agreement text replaced by
// its marker).
function cacheableContent(input, profile = null) {
  const { stable, routed, section } = splitRequestForCache(input, profile);
  const ttl = { type: 'ephemeral', ttl: ANTHROPIC_API_CACHE_TTL };
  const sent = [];
  const stored = [];
  const agreement = profile?.context_mode === 'cached_agreement' ? agreementBlock(input) : null;
  if (agreement) { sent.push(agreement.sent); stored.push(agreement.stored); }
  const stableBlock = { type: 'text', text: JSON.stringify(stable), cache_control: ttl };
  sent.push(stableBlock); stored.push(stableBlock);
  if (Object.keys(routed).length > 0) {
    const routedBlock = { type: 'text', text: JSON.stringify(routed), cache_control: ttl };
    sent.push(routedBlock); stored.push(routedBlock);
  }
  if (Object.keys(section).length > 0) {
    const sectionBlock = { type: 'text', text: JSON.stringify(section) };
    sent.push(sectionBlock); stored.push(sectionBlock);
  }
  const notes = [isFactLinesRequest(input.request) ? LINES_SYSTEM_PROMPT : SYSTEM_PROMPT];
  if (sent.length > 1) notes.push(sent.length === 2 && !agreement ? REQUEST_LAYOUT_NOTE : `The request is ${sent.length} blocks in one message${agreement ? ': the agreement\'s text, then' : ':'} the instructions and contracts, then the section under analysis. Read them together as one request.`);
  if (agreement) notes.push(AGREEMENT_LAYOUT_NOTE);
  return { system: notes.join(' '), content: sent, stored_content: stored };
}

function validateMessage(message, { lines = false } = {}) {
  if (!message || typeof message !== 'object' || !Array.isArray(message.content)) fail('ANTHROPIC_API_RESPONSE', 'one message with content is required');
  if (message.stop_reason === 'refusal') fail('ANTHROPIC_API_REFUSAL', `the model declined (${message.stop_details?.category || 'no category'})`);
  const usage = message.usage;
  for (const key of ['input_tokens', 'output_tokens']) {
    if (usageInteger(usage, key) === null) fail('ANTHROPIC_API_USAGE', `${key} must be a non-negative integer`);
  }
  const text = message.content.filter((item) => item && item.type === 'text' && typeof item.text === 'string').map((item) => item.text).join('');
  if (!text) fail('ANTHROPIC_API_RESPONSE', 'one text response is required');
  // Plan finding (192): a JSON Lines answer keeps every whole line of a
  // capped answer; the draft reads answer_lines and asks for the rest.
  if (lines) {
    const read = readFactLines(unfenced(text), { truncated: message.stop_reason === 'max_tokens' });
    if (read.lines.kept === 0) fail(message.stop_reason === 'max_tokens' ? 'ANTHROPIC_API_OUTPUT_TRUNCATED' : 'ANTHROPIC_API_JSON', `response must be JSON Lines; ${read.lines.lines} lines, none readable (${usage.output_tokens} output tokens)`);
    return { usage, parsed: read.response };
  }
  if (message.stop_reason === 'max_tokens') fail('ANTHROPIC_API_OUTPUT_TRUNCATED', `the answer ran past the output cap (${usage.output_tokens} output tokens)`);
  let parsed;
  try {
    parsed = exactJsonObject(unfenced(text));
  } catch {
    fail('ANTHROPIC_API_JSON', 'response must be one exact JSON object');
  }
  return { usage, parsed };
}

function createAnthropicApiProductModel({
  apiKey = process.env.ANTHROPIC_API_KEY, workspaceId = process.env.ANTHROPIC_WORKSPACE_ID, client = null, clientFactory = null,
  modelConfig = ANTHROPIC_API_MODEL_CONFIG, requestProfile = null, callKindModels = null,
} = {}) {
  let workspaceConfigured = false;
  if (!client) {
    if (typeof apiKey !== 'string' || apiKey.length < 20) throw new Error('ANTHROPIC_API_KEY is not configured');
    const options = clientOptions({ apiKey, workspaceId });
    workspaceConfigured = Boolean(options.defaultHeaders);
    if (clientFactory) {
      client = clientFactory(options);
    } else {
      const AnthropicModule = require('@anthropic-ai/sdk');
      const Anthropic = AnthropicModule.default || AnthropicModule;
      client = new Anthropic(options);
    }
  }
  if (!client?.messages || typeof client.messages.stream !== 'function') throw new TypeError('an Anthropic messages client with stream() is required');
  // The run's request profile (work package E1) lays the blocks out; a
  // caller may hand one in directly (the three-section ablation runs a
  // variant that is not yet a run's config).
  const profile = requestProfile || requestProfileFor(modelConfig);
  const adapters = new Map();
  const adapterFor = (selection) => {
    const selectedModelId = `${selection.model};effort=${selection.effort}`;
    if (adapters.has(selectedModelId)) return adapters.get(selectedModelId);
    const adapter = createJsonModelAdapter({
      providerId: PROVIDER_ID,
      modelId: selectedModelId,
      provider: async (input) => {
        const { system, content, stored_content: storedContent } = cacheableContent(input, profile);
        const request = {
          model: selection.model,
          // The deployed cap, whatever cap the run's stored config carries
          // (finding (87): the cap is operational, not the model's identity).
          max_tokens: ANTHROPIC_API_MODEL_CONFIG.max_output_tokens,
          output_config: { effort: selection.effort },
          system,
          messages: [{ role: 'user', content }],
        };
        // The request as stored: the request as sent, the agreement block's
        // text (the cached-agreement profile) replaced by its marker.
        const storedRequest = { ...request, messages: [{ role: 'user', content: storedContent }] };
        const started = Date.now();
        let message;
        try {
          message = await client.messages.stream(request).finalMessage();
        } catch (error) {
          if (isWorkspaceScopeError(error)) throw notConfiguredError(error, { workspaceConfigured });
          if (isAccountLimit(error)) throw accountLimitError(error);
          throw error;
        }
        const rawResponse = JSON.parse(JSON.stringify(message));
        let validated;
        try {
          validated = validateMessage(message, { lines: isFactLinesRequest(input.request) });
        } catch (error) {
          throw attachReceivedProviderFailure(error, {
            provider_id: PROVIDER_ID,
            model_id: selectedModelId,
            raw_request: storedRequest,
            raw_response: rawResponse,
            provider_completion_confirmed: message?.stop_reason === 'end_turn',
            input_tokens: usageInteger(message?.usage, 'input_tokens') === null ? null : totalInputTokens(message.usage),
            output_tokens: usageInteger(message?.usage, 'output_tokens'),
            cost_microusd: message?.usage ? anthropicApiCostMicrousd(selection.model, message.usage, { cacheTtl: ANTHROPIC_API_CACHE_TTL }) : null,
            duration_ms: Math.max(0, Date.now() - started),
          });
        }
        const { usage, parsed } = validated;
        return {
          response: parsed,
          raw_request: storedRequest,
          raw_response: rawResponse,
          input_tokens: totalInputTokens(usage),
          output_tokens: usage.output_tokens,
          cost_microusd: anthropicApiCostMicrousd(selection.model, usage, { cacheTtl: ANTHROPIC_API_CACHE_TTL }),
          duration_ms: Date.now() - started,
          provider_completion_confirmed: message.stop_reason === 'end_turn',
        };
      },
    });
    adapters.set(selectedModelId, adapter);
    return adapter;
  };
  return {
    async complete(input) {
      // The ablation's variant may name its own models per call kind; a
      // run's config decides otherwise.
      const selection = callKindModels?.[input?.call_kind] || resolveAnthropicApiCallModel(modelConfig, input?.call_kind);
      return adapterFor(selection).complete(input);
    },
  };
}

module.exports = {
  AGREEMENT_LAYOUT_NOTE,
  AnthropicApiProductModelError,
  PER_SECTION_KEYS,
  ROUTED_KEYS,
  PROVIDER_ID,
  REQUEST_LAYOUT_NOTE,
  cacheableContent,
  clientOptions,
  createAnthropicApiProductModel,
  isAccountLimit,
  isNotConfiguredError,
  isWorkspaceScopeError,
  splitRequestForCache,
  totalInputTokens,
};
