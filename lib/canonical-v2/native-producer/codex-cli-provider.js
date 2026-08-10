'use strict';

const { createCodexCliClient, JSON_ONLY_INSTRUCTION } = require('../../llm-cli-client');
const { createAnthropicProvider } = require('./anthropic-provider');

const PROVIDER_ID = 'OPENAI_CODEX_CLI_SUBSCRIPTION';

const PROFILES = Object.freeze({
  TERRA_MEDIUM: Object.freeze({
    profile_id: 'TERRA_MEDIUM',
    model: 'gpt-5.6-terra',
    reasoning_effort: 'medium',
  }),
  SOL_MEDIUM: Object.freeze({
    profile_id: 'SOL_MEDIUM',
    model: 'gpt-5.6-sol',
    reasoning_effort: 'medium',
  }),
  SOL_HIGH: Object.freeze({
    profile_id: 'SOL_HIGH',
    model: 'gpt-5.6-sol',
    reasoning_effort: 'high',
  }),
  SOL_XHIGH: Object.freeze({
    profile_id: 'SOL_XHIGH',
    model: 'gpt-5.6-sol',
    reasoning_effort: 'xhigh',
  }),
});

class NativeProducerCodexError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'NativeProducerCodexError';
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function resolveProfile(profileId) {
  if (typeof profileId !== 'string' || !PROFILES[profileId]) {
    throw new NativeProducerCodexError(
      'UNKNOWN_PROFILE',
      `profile_id must be one of: ${Object.keys(PROFILES).join(', ')}`,
      { profile_id: profileId ?? null },
    );
  }
  return PROFILES[profileId];
}

function createCodexCliProvider({
  profileId = 'TERRA_MEDIUM',
  client,
  timeoutMs,
  promptPrefix = JSON_ONLY_INSTRUCTION,
} = {}) {
  const profile = resolveProfile(profileId);
  if (typeof promptPrefix !== 'string' || promptPrefix.trim() === '') {
    throw new NativeProducerCodexError('INVALID_PROMPT_PREFIX', 'promptPrefix must be a non-empty string');
  }
  const resolvedClient = client || createCodexCliClient({
    model: profile.model,
    reasoningEffort: profile.reasoning_effort,
    maxAttempts: 1,
    ephemeral: true,
    ignoreUserConfig: true,
    ignoreRules: true,
    isolated: true,
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
  });
  const modelId = `${profile.model};reasoning=${profile.reasoning_effort};profile=${profile.profile_id}`;
  const completenessCheckedClient = {
    messages: {
      async create(params) {
        const response = await resolvedClient.messages.create(params);
        if (!response || !response.codex_completion || response.codex_completion.status !== 'COMPLETE'
          || response.codex_completion.terminal_event !== 'turn.completed') {
          throw new NativeProducerCodexError(
            'CODEX_COMPLETION_UNPROVEN',
            'CODEX_COMPLETION_UNPROVEN: response lacks the unique successful turn.completed terminal event',
          );
        }
        return response;
      },
    },
  };
  const innerProvider = createAnthropicProvider({
    providerId: PROVIDER_ID,
    model: modelId,
    maxRetries: 0,
    client: completenessCheckedClient,
    // Codex completeness is proven by its terminal JSONL event. Claude's
    // 64k token-ceiling rule is a different transport contract.
    maxOutputTokens: null,
    includeRawResponse: true,
    transformPrompt(prompt) {
      const existing = prompt.system === undefined
        ? [] : (Array.isArray(prompt.system) ? prompt.system : [prompt.system]);
      return Object.freeze({
        ...prompt,
        system: Object.freeze([{ type: 'text', text: promptPrefix }, ...existing]),
      });
    },
  });

  return async function codexCliProvider(input) {
    try {
      const output = await innerProvider(input);
      return Object.freeze({ ...output, provider_id: PROVIDER_ID, model_id: modelId });
    } catch (error) {
      if (error && typeof error === 'object') {
        const existing = error.details && typeof error.details === 'object' ? error.details : {};
        const failedOutput = existing.provider_output && typeof existing.provider_output === 'object'
          ? Object.freeze({ ...existing.provider_output, provider_id: PROVIDER_ID, model_id: modelId })
          : null;
        error.details = Object.freeze({
          ...existing,
          provider_id: PROVIDER_ID,
          model_id: modelId,
          ...(failedOutput === null ? {} : { provider_output: failedOutput }),
        });
      }
      throw error;
    }
  };
}

module.exports = {
  PROVIDER_ID,
  PROFILES,
  NativeProducerCodexError,
  resolveProfile,
  createCodexCliProvider,
};
