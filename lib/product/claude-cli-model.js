'use strict';

// Ben, 2026-09-14: "Can you flip the codex cli to Claude cli?" The Claude
// Code CLI (`claude -p`) on a Claude subscription login, wrapped the same
// way as the Codex CLI: one JSON object per call, the CLI's own usage
// accounting, zero marginal API cost, and a received-output record on
// every failure so nothing the model returned is lost.

const { createClaudeCliProductClient, receivedClaudeOutput, summariseReceivedClaudeOutput } = require('../llm-cli-client');
const { attachReceivedProviderFailure, createJsonModelAdapter } = require('./model-adapter');
const { ANTHROPIC_API_PROVIDER_ID, CLAUDE_CLI_MODEL_CONFIG, CLAUDE_CLI_PROVIDER_ID, DEEPSEEK_API_PROVIDER_ID, resolveClaudeCliCallModel } = require('./product-model-config');
const { exactJsonObject } = require('./codex-cli-model');
const { isFactLinesRequest, readFactLines } = require('./fact-lines');

const PROVIDER_ID = CLAUDE_CLI_PROVIDER_ID;
// Extraction on a long section at high effort runs past ten minutes.
const CALL_KIND_TIMEOUT_MS = Object.freeze({ EXTRACTION: 30 * 60 * 1000 });
// Compact JSON: a pretty-printed answer of 25 proposals ran to 166k
// characters and past the CLI's output cap (generation 6, 3.09); without
// indentation the same answer is about a third shorter.
const SYSTEM_PROMPT = 'Return one JSON object only, as compact JSON with no indentation, line breaks or spaces between tokens. Follow the supplied response contract exactly. Do not use Markdown. Do not use tools or inspect files. Use only the source text in the request.';
// Plan finding (192): the JSON Lines answer (request answer_mode 'lines').
const LINES_SYSTEM_PROMPT = 'Return JSON Lines only: one compact JSON object per line, no indentation, no line breaks inside an object, nothing else on any line. Follow the supplied response contract and lines instruction exactly. Do not use Markdown fences.';

class ClaudeCliProductModelError extends Error {
  constructor(code, detail) {
    super(`${code}: ${detail}`);
    this.name = 'ClaudeCliProductModelError';
    this.code = code;
  }
}

function fail(code, detail) {
  throw new ClaudeCliProductModelError(code, detail);
}

// The CLI sometimes wraps the object in a ```json fence even when told not
// to (probe 2026-09-14); the fence is stripped and the body must then be one
// exact JSON object.
function unfenced(text) {
  return String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
}

function totalInputTokens(usage) {
  return ['input_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens']
    .reduce((sum, key) => sum + (usageInteger(usage, key) ?? 0), 0);
}

function usageInteger(usage, key) {
  return Number.isInteger(usage?.[key]) && usage[key] >= 0 ? usage[key] : null;
}

function validateResponse(response, { lines = false } = {}) {
  if (!response || typeof response !== 'object' || Array.isArray(response)
    || response.claude_completion?.status !== 'COMPLETE' || response.claude_completion?.subtype !== 'success') {
    fail('CLAUDE_PRODUCT_COMPLETION', 'one successful result is required');
  }
  if (!Array.isArray(response.content) || response.content.length !== 1
    || response.content[0]?.type !== 'text' || typeof response.content[0].text !== 'string') {
    fail('CLAUDE_PRODUCT_RESPONSE', 'one completed text response is required');
  }
  const usage = response.usage;
  for (const key of ['input_tokens', 'output_tokens']) {
    if (usageInteger(usage, key) === null) fail('CLAUDE_PRODUCT_USAGE', `${key} must be a non-negative integer`);
  }
  if (lines) {
    // Plan finding (192): a JSON Lines answer keeps every whole line of a
    // capped answer; the draft reads answer_lines and asks for the rest.
    const blocks = response.claude_completion?.text_blocks;
    const truncated = response.claude_completion?.stop_reason === 'max_tokens' || (Number.isInteger(blocks) && blocks > 1);
    const read = readFactLines(unfenced(response.content[0].text), { truncated });
    if (read.lines.kept === 0) fail(truncated ? 'CLAUDE_OUTPUT_TRUNCATED' : 'CLAUDE_PRODUCT_JSON', `response must be JSON Lines; ${read.lines.lines} lines, none readable (${usage.output_tokens} output tokens)`);
    return { usage, parsed: read.response };
  }
  let parsed;
  try {
    parsed = exactJsonObject(unfenced(response.content[0].text));
  } catch {
    // Several text blocks that do not join into one object: the answer
    // outran the CLI's output cap and the model resumed with a second
    // object (generation 6, 3.09: "resume_note": "Continuing ... The
    // earlier portion of this response was truncated by the output
    // limit"). Named so the attempt history says so.
    const blocks = response.claude_completion?.text_blocks;
    if (Number.isInteger(blocks) && blocks > 1) {
      fail('CLAUDE_OUTPUT_TRUNCATED', `${blocks} text blocks (${usage.output_tokens} output tokens) do not join into one JSON object`);
    }
    fail('CLAUDE_PRODUCT_JSON', 'response must be one exact JSON object');
  }
  return { usage, parsed };
}

// `callKindModels` (work package E2, the cost ablation on the CLI): a
// variant's own model and effort per call kind, through the CLI's --model
// and --effort, in place of the run config's map; a run never passes it.
function createClaudeCliProductModel({
  client = null, clientFactory = createClaudeCliProductClient, modelConfig = CLAUDE_CLI_MODEL_CONFIG, timeoutMs, env, callKindModels = null,
} = {}) {
  const adapters = new Map();
  const adapterFor = (selection, callKind) => {
    const callTimeoutMs = timeoutMs === undefined ? CALL_KIND_TIMEOUT_MS[callKind] : timeoutMs;
    const selectedModelId = `${selection.model};effort=${selection.effort}`;
    const adapterKey = `${selectedModelId};timeout=${callTimeoutMs ?? 'default'}`;
    if (adapters.has(adapterKey)) return adapters.get(adapterKey);
    const selectedClient = client || clientFactory({
      model: selection.model,
      effort: selection.effort,
      systemPrompt: SYSTEM_PROMPT,
      ...(env ? { env } : {}),
      ...(callTimeoutMs === undefined ? {} : { timeoutMs: callTimeoutMs }),
    });
    if (!selectedClient?.messages || typeof selectedClient.messages.create !== 'function') {
      throw new TypeError('a Claude CLI messages client is required');
    }
    const adapter = createJsonModelAdapter({
      providerId: PROVIDER_ID,
      modelId: selectedModelId,
      provider: async (input) => {
        const request = {
          model: selection.model,
          effort: selection.effort,
          billing_basis: 'CLAUDE_SUBSCRIPTION_ZERO_MARGINAL_API_COST',
          system: isFactLinesRequest(input.request) ? LINES_SYSTEM_PROMPT : SYSTEM_PROMPT,
          messages: [{ role: 'user', content: JSON.stringify({
            call_kind: input.call_kind,
            prompt_version: input.prompt_version,
            ...input.request,
          }) }],
        };
        const started = Date.now();
        // The failure reason names the section and its size (work package
        // 9: a call that outran the cap or the clock says which section
        // and how long it was, never a bare timeout).
        const closure = input?.request?.source_closure;
        const fullSection = closure?.full_section;
        const sectionNote = closure && closure.section_reference
          ? ` [section ${closure.section_reference}: ${Number.isInteger(fullSection?.end_byte) && Number.isInteger(fullSection?.start_byte) ? (fullSection.end_byte - fullSection.start_byte).toLocaleString('en-US') : 'unknown'} bytes, ${Array.isArray(closure.operative) ? closure.operative.length : 0} operative spans${closure.extraction_part ? `, part ${closure.extraction_part.part} of ${closure.extraction_part.of}` : ''}]`
          : '';
        let response;
        try {
          response = await selectedClient.messages.create(request);
        } catch (error) {
          if (sectionNote && !String(error.message || '').includes(sectionNote)) error.message = `${error.message}${sectionNote}`;
          const received = receivedClaudeOutput(error);
          if (!received) throw error;
          throw attachReceivedProviderFailure(error, {
            provider_id: PROVIDER_ID,
            model_id: selectedModelId,
            raw_request: request,
            raw_response: { schema_version: 'CLAUDE_CLI_RECEIVED_OUTPUT/V1', raw_json: received, received_summary: summariseReceivedClaudeOutput(received) },
            provider_completion_confirmed: false,
            input_tokens: null,
            output_tokens: null,
            cost_microusd: 0,
            duration_ms: Math.max(0, Date.now() - started),
          });
        }
        let validated;
        try {
          validated = validateResponse(response, { lines: isFactLinesRequest(input.request) });
        } catch (error) {
          if (response === undefined) throw error;
          if (sectionNote) error.message = `${error.message}${sectionNote}`;
          throw attachReceivedProviderFailure(error, {
            provider_id: PROVIDER_ID,
            model_id: selectedModelId,
            raw_request: request,
            raw_response: JSON.parse(JSON.stringify(response)),
            provider_completion_confirmed: response?.claude_completion?.status === 'COMPLETE'
              && response?.claude_completion?.subtype === 'success',
            input_tokens: usageInteger(response?.usage, 'input_tokens') === null ? null : totalInputTokens(response.usage),
            output_tokens: usageInteger(response?.usage, 'output_tokens'),
            cost_microusd: 0,
            duration_ms: Math.max(0, Date.now() - started),
          });
        }
        const { usage, parsed } = validated;
        return {
          response: parsed,
          raw_request: request,
          raw_response: JSON.parse(JSON.stringify(response)),
          // Claude Code serves most of the prompt from its cache; the input
          // count is the whole prompt (fresh, cache-written and cache-read),
          // not the fresh slice alone (generation 6 showed 26 input tokens
          // for three sections).
          input_tokens: totalInputTokens(usage),
          output_tokens: usage.output_tokens,
          cost_microusd: 0,
          duration_ms: Date.now() - started,
          provider_completion_confirmed: true,
        };
      },
    });
    adapters.set(adapterKey, adapter);
    return adapter;
  };
  return {
    async complete(input) {
      const selection = callKindModels?.[input?.call_kind] || resolveClaudeCliCallModel(modelConfig, input?.call_kind);
      return adapterFor(selection, input?.call_kind).complete(input);
    },
  };
}

// The product model for a run record, by the provider its model_config names.
function createHostedProductModel(run) {
  const providerId = run?.model_config?.provider_id;
  if (providerId === CLAUDE_CLI_PROVIDER_ID) return createClaudeCliProductModel({ modelConfig: run.model_config });
  if (providerId === ANTHROPIC_API_PROVIDER_ID || providerId === DEEPSEEK_API_PROVIDER_ID) {
    // Required here, not at the top: anthropic-api-model shares this
    // module's system prompt. DeepSeek's endpoint is Anthropic-shaped, so
    // it is the same adapter under its own model config (2026-10-23).
    const { createAnthropicApiProductModel } = require('./anthropic-api-model');
    return createAnthropicApiProductModel({ modelConfig: run.model_config });
  }
  const { createCodexCliProductModel } = require('./codex-cli-model');
  return createCodexCliProductModel({ modelConfig: run?.model_config });
}

module.exports = {
  CALL_KIND_TIMEOUT_MS,
  LINES_SYSTEM_PROMPT,
  ClaudeCliProductModelError,
  PROVIDER_ID,
  SYSTEM_PROMPT,
  createClaudeCliProductModel,
  createHostedProductModel,
  totalInputTokens,
  unfenced,
};
