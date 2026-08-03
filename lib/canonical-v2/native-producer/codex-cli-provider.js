'use strict';

const { createCodexCliClient } = require('../../llm-cli-client');
const { createAnthropicProvider } = require('./anthropic-provider');

const PROVIDER_ID = 'OPENAI_CODEX_CLI_SUBSCRIPTION';

const PROFILES = Object.freeze({
  TERRA_MEDIUM: Object.freeze({
    profile_id: 'TERRA_MEDIUM',
    model: 'gpt-5.6-terra',
    reasoning_effort: 'medium',
  }),
  SOL_HIGH: Object.freeze({
    profile_id: 'SOL_HIGH',
    model: 'gpt-5.6-sol',
    reasoning_effort: 'high',
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
} = {}) {
  const profile = resolveProfile(profileId);
  const resolvedClient = client || createCodexCliClient({
    model: profile.model,
    reasoningEffort: profile.reasoning_effort,
    maxAttempts: 1,
    ephemeral: true,
    ignoreRules: true,
    isolated: true,
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
  });
  const modelId = `${profile.model};reasoning=${profile.reasoning_effort};profile=${profile.profile_id}`;
  const innerProvider = createAnthropicProvider({
    model: modelId,
    maxRetries: 0,
    client: resolvedClient,
  });

  return async function codexCliProvider(input) {
    const output = await innerProvider(input);
    return Object.freeze({
      ...output,
      provider_id: PROVIDER_ID,
      model_id: modelId,
    });
  };
}

module.exports = {
  PROVIDER_ID,
  PROFILES,
  NativeProducerCodexError,
  resolveProfile,
  createCodexCliProvider,
};
