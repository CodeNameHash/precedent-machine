# Step 2X-H — Record input tokens

## Root cause

The Claude Code CLI (`claude -p --output-format json`) reports `usage.input_tokens`
as **only the non-cached tail** of the prompt. On a warmed cache, that figure is
typically **2** per call. The bulk of a live extraction call sits in
`cache_read_input_tokens` and `cache_creation_input_tokens` instead.

`scripts/canonical-v2-live-extraction-run.mjs` wrote `parsed.usage` to
`call-telemetry.json` unchanged, so aggregating `usage.input_tokens` across the
fifteen REPRESENTATIONS chunks produced **426 across 172 calls** — impossible for
~40k-token prompts. Output tokens were recorded correctly.

## Fix

`normalizeProviderUsage` in `lib/canonical-v2/native-producer/anthropic-provider.js`
sums `input_tokens + cache_creation_input_tokens + cache_read_input_tokens` when
cache fields are present, records the CLI's original non-cached tail as
`input_tokens_non_cache`, and leaves SDK-shaped usage (no cache fields) unchanged.

The general runner applies this before telemetry write and before returning usage
to `createAnthropicProvider`. `providerResponseMetadata` uses the same helper so
`provider_usage` on the receipt matches telemetry.

## Proof

```bash
CI=true node --test tests/canonical-v2-input-token-telemetry.test.js
echo $?
```

Expected exit code: **0**.
