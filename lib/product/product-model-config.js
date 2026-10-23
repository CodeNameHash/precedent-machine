'use strict';

const { canonicalJson } = require('../canonical-v2/canonical-bytes');

const ANTHROPIC_PROVIDER_ID = 'ANTHROPIC';
const CODEX_PROVIDER_ID = 'OPENAI_CODEX_CLI_SUBSCRIPTION';
const CLAUDE_CLI_PROVIDER_ID = 'ANTHROPIC_CLAUDE_CLI_SUBSCRIPTION';
const PHASE5_DIAGNOSTIC_RUN_ID = '46c45080-6935-49e5-96ae-b6cb0609a924';
const PHASE5_DIAGNOSTIC_SOURCE_ID = '238dc3fed996667b9124a853745708a003917bcb28c889bad703f6124d13e721';

const ANTHROPIC_MODEL_CONFIG = Object.freeze({
  provider_id: ANTHROPIC_PROVIDER_ID,
  model_id: 'claude-sonnet-4-5-20250929',
  temperature: 0,
  routing_max_tokens: 1200,
  extraction_max_tokens: 12000,
});

const CODEX_DIAGNOSTIC_MODEL_CONFIG = Object.freeze({
  provider_id: CODEX_PROVIDER_ID,
  model_id: 'gpt-5.4-mini;reasoning=low',
  execution_model: 'gpt-5.4-mini',
  reasoning_effort: 'low',
  sandbox: 'read-only',
  ephemeral: true,
  max_attempts_per_call: 1,
  marginal_api_cost_microusd: 0,
});

const CODEX_MINI_MODEL_CONFIG = Object.freeze({
  ...CODEX_DIAGNOSTIC_MODEL_CONFIG,
  sandbox: 'named-permission-profile',
  permission_profile: 'pm_extraction',
  tool_policy_version: 'PRODUCT_CODEX_TOOLLESS/V1',
  child_environment_policy: 'PRODUCT_CODEX_ENV_ALLOWLIST/V1',
});

// 2026-09-12: Codex CLI 0.145.0 on a ChatGPT login accepts only gpt-5.5
// (probe: scripts/product/probe-sandbox-models.js), so routing and residual
// calls use it at low reasoning effort. The V1 NCS run used gpt-5.4-mini.
const CODEX_CALL_KIND_MODELS = Object.freeze({
  ROUTING: Object.freeze({ model: 'gpt-5.5', reasoning_effort: 'low' }),
  RESIDUAL: Object.freeze({ model: 'gpt-5.5', reasoning_effort: 'low' }),
  EXTRACTION: Object.freeze({ model: 'gpt-5.5', reasoning_effort: 'medium' }),
});

const CODEX_MODEL_CONFIG = Object.freeze({
  provider_id: CODEX_PROVIDER_ID,
  model_id: 'PRODUCT_CODEX_CALL_KIND_MAP/V1',
  model_selection: 'CALL_KIND',
  call_kind_models: CODEX_CALL_KIND_MODELS,
  sandbox: 'named-permission-profile',
  permission_profile: 'pm_extraction',
  tool_policy_version: 'PRODUCT_CODEX_TOOLLESS/V1',
  child_environment_policy: 'PRODUCT_CODEX_ENV_ALLOWLIST/V1',
  ephemeral: true,
  max_attempts_per_call: 1,
  marginal_api_cost_microusd: 0,
});

// Ben, 2026-09-14: "Can you flip the codex cli to Claude cli?" The hosted
// worker runs Claude Code (`claude -p`) on a Claude subscription login
// (CLAUDE_CODE_OAUTH_TOKEN from `claude setup-token`), the same shape as the
// Codex path: one JSON object per call, no tools, no settings, no session
// on disk, zero marginal API cost. Claude Opus 5 on every call kind; routing
// and residual at low effort, extraction at high.
const CLAUDE_CLI_CALL_KIND_MODELS = Object.freeze({
  ROUTING: Object.freeze({ model: 'claude-opus-5', effort: 'low' }),
  RESIDUAL: Object.freeze({ model: 'claude-opus-5', effort: 'low' }),
  EXTRACTION: Object.freeze({ model: 'claude-opus-5', effort: 'high' }),
});

const CLAUDE_CLI_MODEL_CONFIG = Object.freeze({
  provider_id: CLAUDE_CLI_PROVIDER_ID,
  model_id: 'PRODUCT_CLAUDE_CLI_CALL_KIND_MAP/V1',
  model_selection: 'CALL_KIND',
  call_kind_models: CLAUDE_CLI_CALL_KIND_MODELS,
  tools: 'none',
  setting_sources: 'none',
  session_persistence: false,
  tool_policy_version: 'PRODUCT_CLAUDE_CLI_TOOLLESS/V1',
  child_environment_policy: 'PRODUCT_CLAUDE_CLI_ENV_ALLOWLIST/V1',
  max_attempts_per_call: 1,
  marginal_api_cost_microusd: 0,
});

// Work package E3 (plan findings (177) and (184); implementer E). Ben,
// 2026-10-19: "I'd push e again to say it should imagine itself like a
// nasa engineer in Apollo 13, having to figure out how to get all required
// performance on even less juice and even quicker. It can experiment,
// tear up ideas etc. cone at completely fresh. And be implanting its
// existing ideas now too". The existing ideas implanted now: the stack
// that needs no proof becomes the default for every new run, behind the
// model-config identity, so a run's stored config says what it ran on and
// the paused and finished runs keep theirs. The call-kind maps of the
// default: routing and residual on Haiku 5.5 at low effort (the routing
// is widened by code either way; $5.11 of NCS generation 5 at Opus
// rates), extraction at high effort on Opus 5.5 where the claude-api
// reference confirms it (the API: shared/models.md lists claude-opus-5-5
// Active with the same 1M context and 128K output, and the pricing table
// has it at $4 / $20; the subscription CLI's model list is the
// subscription's, not the reference's, so the CLI default keeps Opus 5
// for extraction until the ablation's anchors_opus55 rung has run on the
// third sandbox; one constant changes it). Medium effort and the cached
// agreement wait for the ablation (finding (181)).
const DEFAULT_CLAUDE_CLI_CALL_KIND_MODELS = Object.freeze({
  ROUTING: Object.freeze({ model: 'claude-haiku-5-5', effort: 'low' }),
  RESIDUAL: Object.freeze({ model: 'claude-haiku-5-5', effort: 'low' }),
  EXTRACTION: Object.freeze({ model: 'claude-opus-5', effort: 'high' }),
});
const DEFAULT_ANTHROPIC_API_CALL_KIND_MODELS = Object.freeze({
  ROUTING: Object.freeze({ model: 'claude-haiku-5-5', effort: 'low' }),
  RESIDUAL: Object.freeze({ model: 'claude-haiku-5-5', effort: 'low' }),
  EXTRACTION: Object.freeze({ model: 'claude-opus-5-5', effort: 'high' }),
});

// Work package 3 (plan findings (44), (45) and (46)), Ben, 2026-10-17: "also
// you now have $200 of API tokens you can use if you want to preseve
// subscription capcaity" and "done on the key, will be live on your next
// redploy". The Anthropic API on the hosted worker, at the Claude CLI
// path's model tier and effort per call kind (read from that path's map,
// never a second copy), metered at the published first-party rates. The
// output cap is the documented maximum of the synchronous Messages API
// for claude-opus-5 and claude-opus-5-5, "Max output: 128K tokens"
// (platform.claude.com/docs/en/models/opus-5/overview, read 2026-10-18;
// work package 15, plan finding (83): NCS generation 5's 5.1 lost two
// attempts at a 64,000-token cap on part 2 of 3, the restrictions list,
// 130,758 input tokens, the same split each time); the request streams so
// the cap, not the request timeout, is the limit. A section that still
// runs past it is re-split smaller on its next attempt
// (lib/product/agreement-draft.js splitForAttempt).
const ANTHROPIC_API_PROVIDER_ID = 'ANTHROPIC_API';
const ANTHROPIC_API_CALL_KIND_MODELS = CLAUDE_CLI_CALL_KIND_MODELS;
// USD per million tokens, from https://platform.claude.com/docs/en/about-claude/pricing
// as read on 2026-10-18 ("Model pricing" table: base input, 5m cache
// writes, 1h cache writes, cache hits and refreshes, output). One constant,
// one source; the cost of every call and the run estimate
// (scripts/product/estimate-run-cost.js) come from here.
const ANTHROPIC_API_PRICES = Object.freeze({
  source: 'https://platform.claude.com/docs/en/about-claude/pricing',
  retrieved: '2026-10-18',
  usd_per_million: Object.freeze({
    'claude-opus-5': Object.freeze({ input: 5, cache_write_5m: 6.25, cache_write_1h: 10, cache_read: 0.5, output: 25 }),
    'claude-opus-5-5': Object.freeze({ input: 4, cache_write_5m: 5, cache_write_1h: 8, cache_read: 0.2, output: 20 }),
    // Work package E1 (implementer E, 2026-10-18): the cheaper tiers the
    // routing and residual calls may run on. Base input, output and cache
    // reads from the claude-api skill's model table (read 2026-10-18:
    // Sonnet 5.5 $2 / $10, cache reads $0.20; Haiku 5.5 $0.10 / $0.50 for
    // prompts up to 100K tokens); cache writes at the documented
    // multipliers (1.25x the input rate for 5 minutes, 2x for 1 hour) and
    // Haiku's reads at the 0.1x the same reference gives as the general
    // rate. To be confirmed against the pricing page before a run is
    // priced on them; the run estimate names the model it priced.
    'claude-sonnet-5-5': Object.freeze({ input: 2, cache_write_5m: 2.5, cache_write_1h: 4, cache_read: 0.2, output: 10 }),
    'claude-haiku-5-5': Object.freeze({ input: 0.1, cache_write_5m: 0.125, cache_write_1h: 0.2, cache_read: 0.01, output: 0.5 }),
  }),
});
// DeepSeek's published rates, from
// https://api-docs.deepseek.com/quick_start/pricing/ as read on 2026-10-23.
// DeepSeek publishes two schedules: peak (01:00-04:00 and 06:00-10:00 UTC,
// Monday through Friday) and off-peak (half the peak rates, every other
// hour including weekends and Chinese public holidays). Both are kept here
// so a call is priced at the schedule it ran under; the public holidays
// are not modelled, so a call in one of those windows is priced at peak
// (never understated). Cache writes have no separate published rate: a
// token written to the cache is an uncached input token and is priced at
// the input (cache-miss) rate. The model names are the two the Anthropic-
// compatible endpoint lists (https://api.deepseek.com/models).
const DEEPSEEK_API_PRICES = Object.freeze({
  source: 'https://api-docs.deepseek.com/quick_start/pricing/',
  retrieved: '2026-10-23',
  peak_hours_utc: Object.freeze([Object.freeze([1, 4]), Object.freeze([6, 10])]),
  usd_per_million: Object.freeze({
    'deepseek-flash': Object.freeze({
      peak: Object.freeze({ input: 0.3, cache_read: 0.006, output: 1.2 }),
      off_peak: Object.freeze({ input: 0.15, cache_read: 0.003, output: 0.6 }),
    }),
    'deepseek-v4-pro': Object.freeze({
      peak: Object.freeze({ input: 1.32, cache_read: 0.044, output: 3.96 }),
      off_peak: Object.freeze({ input: 0.66, cache_read: 0.022, output: 1.98 }),
    }),
  }),
});

const ANTHROPIC_API_MODEL_CONFIG = Object.freeze({
  provider_id: ANTHROPIC_API_PROVIDER_ID,
  model_id: 'PRODUCT_ANTHROPIC_API_CALL_KIND_MAP/V1',
  model_selection: 'CALL_KIND',
  call_kind_models: ANTHROPIC_API_CALL_KIND_MODELS,
  max_output_tokens: 128000,
  thinking: 'adaptive',
  tools: 'none',
  billing_basis: 'ANTHROPIC_API_METERED',
  max_attempts_per_call: 1,
});

// Work package E1 (plan finding (167); implementer E, findings from
// (180)). Ben: "I agree but I'd say get AS much cost reduction and increase
// in speed as possible." The request profile is the part of a run's model
// config that says how the pipeline writes its requests and reads its
// answers, so a run's stored config says what it ran on and every section
// of a run is built the same way (lib/product/agreement-draft.js
// buildAgreementSectionDraft reads it; lib/product/anthropic-api-model.js
// lays the blocks out from it). The ledger of NCS generation 5
// (docs/codex-program/notes/EXTRACTION-COST-LEDGER-2026-10-18.md) is the
// reason for each field:
//
// - response_format: 'V9' is the request as it was (roles, evidence_quotes
//   and components, every span cited by its 64-hex id); 'V10' asks for the
//   components alone (the evidence quotes are the OWN components' words,
//   the roles are the components; evidence_quotes were 15 per cent of the
//   answer and roles 12) and names every closure span by a short alias
//   (s1, s2, ...; the 64-hex ids were 20 per cent of the answer), which
//   the compiler maps back before anything else reads the answer.
// - quote_mode: 'text' asks for every component's words verbatim;
//   'anchors' asks for a component's first and last few words (quote_from,
//   quote_to) and the validator resolves the one run of text between them
//   inside the cited span (the verbatim words were 21 per cent of the
//   answer, written back from the text the model had just read).
// - context_mode: 'inline' sends every definition and cross-referenced
//   section's text in every call (14.4 MB over the run for a 0.31 MB
//   agreement, every fresh token at the input rate); 'cached_agreement'
//   sends the agreement's whole canonical text once under its own cache
//   breakpoint (written once an hour, read at the cache rate on every
//   call) and lists the closure's definitions and cross-references by
//   section, span and first words for the model to read there.
// - stable_blocks: 1 is one stable block per routed family set (51
//   distinct blocks on NCS, 22 used once); 2 puts the parts that never
//   change (instructions, response contract, every family's target
//   contracts) in a first block written once a run and the routed
//   families' contracts and table shapes in a second.
// The manager's direction of 2026-10-18 22:30 UTC added three settings,
// each a rung of the ablation ladder and none the LEAN config's until the
// table says it holds:
// - quote_mode 'offsets': a component's words as character offsets within
//   the cited span's text (quote_offsets: [start, end], half open), which
//   the reader resolves against the span's own characters; the request
//   and answer contract are here, the validator's own acceptance of
//   offsets is implementer A's work package 21.
// - contracts_scope 'all': every family's contracts and table shapes in
//   the stable block of every extraction call, so a run writes one stable
//   block per call kind instead of one per routed family set; the routed
//   families are still named and the answer is still bound to them.
// - context_mode 'trimmed': cross-references one hop deep (the sections
//   the section's own words name), each sent whole once; the definitions
//   as they were.
const ANTHROPIC_API_REQUEST_PROFILES = Object.freeze({
  V9: Object.freeze({ name: 'V9', response_format: 'V9', quote_mode: 'text', context_mode: 'inline', stable_blocks: 1, contracts_scope: 'routed' }),
  LEAN: Object.freeze({ name: 'LEAN', response_format: 'V10', quote_mode: 'anchors', context_mode: 'cached_agreement', stable_blocks: 2, contracts_scope: 'routed' }),
  // Work package E3: the stack that needs no proof (the manager, 2026-10-19
  // 03:05 UTC, on Ben's brief): the V10 answer with span aliases and
  // anchored quotes, every family's contracts in two stable blocks (one
  // block per call kind for the run), the context inline as before; the
  // same request on both providers (the CLI sends the same words and
  // caches on its own terms).
  // Plan finding (227) (the manager, 2026-10-22): part_counts is the
  // default. Each part of a split section hears its fact budget and the
  // sentence count of every limb's opening words ((199d), (199e)); on NCS
  // 5.1 the counted rung held 63, 61, 63 of 66 with no fact unmatched in
  // three rolls at one roll's cost where the plain rung read 63, 53, 59
  // and lost the consent standards and exceptions once in three.
  DEFAULT: Object.freeze({ name: 'DEFAULT', response_format: 'V10', quote_mode: 'anchors', context_mode: 'inline', stable_blocks: 2, contracts_scope: 'all', part_counts: true }),
  // Plan finding (186): the all-families block is a cache layout. Measured
  // with the real table shapes, the DEFAULT profile's stable blocks are
  // 387 KB (table_shapes 213 KB, family_contracts 143 KB), about 143,000
  // tokens a call, written once a run and read at the cache rate on the
  // API; the subscription CLI (`claude -p`) counts them fresh on every
  // call (ledger section 4), so the CLI's default sends the routed
  // families' contracts (about 63 KB of stable blocks) and is otherwise
  // the same request.
  DEFAULT_CLI: Object.freeze({ name: 'DEFAULT_CLI', response_format: 'V10', quote_mode: 'anchors', context_mode: 'inline', stable_blocks: 2, contracts_scope: 'routed', part_counts: true }),
});
// The profiles are the request's, not the API's alone: the same table
// serves the CLI configs below.
const REQUEST_PROFILES = ANTHROPIC_API_REQUEST_PROFILES;

// The lean run config: the same models and efforts per call kind until the
// three-section ablation (work package E1 item 3) decides otherwise; the
// profile is what differs. A run created under it advances under it.
const ANTHROPIC_API_LEAN_MODEL_CONFIG = Object.freeze({
  ...ANTHROPIC_API_MODEL_CONFIG,
  model_id: 'PRODUCT_ANTHROPIC_API_CALL_KIND_MAP/V2',
  request_profile: ANTHROPIC_API_REQUEST_PROFILES.LEAN,
});

// Work package E3: the default configs. V3 on the API (Haiku routing and
// residual, Opus 5.5 extraction, the DEFAULT profile); V2 on the CLI
// (Haiku routing and residual, Opus 5 extraction, the same profile).
const ANTHROPIC_API_DEFAULT_MODEL_CONFIG = Object.freeze({
  ...ANTHROPIC_API_MODEL_CONFIG,
  model_id: 'PRODUCT_ANTHROPIC_API_CALL_KIND_MAP/V3',
  call_kind_models: DEFAULT_ANTHROPIC_API_CALL_KIND_MODELS,
  request_profile: REQUEST_PROFILES.DEFAULT,
});
const CLAUDE_CLI_DEFAULT_MODEL_CONFIG = Object.freeze({
  ...CLAUDE_CLI_MODEL_CONFIG,
  model_id: 'PRODUCT_CLAUDE_CLI_CALL_KIND_MAP/V2',
  call_kind_models: DEFAULT_CLAUDE_CLI_CALL_KIND_MODELS,
  request_profile: REQUEST_PROFILES.DEFAULT_CLI,
});

// Work package E6 (plan findings (191) and (212)). Ben, 2026-10-19, on the
// tier question: "Sonnet makes sense". The extraction model becomes
// claude-sonnet-5-5 at high effort on the ANCHORS words (the three-section
// ladder's anchors_sonnet55 rows: 73 matched, 2 partial, none lost of 75;
// 73 per cent of the stored output tokens, 54 per cent of the seconds,
// about a third of the cost), the routing and residual on Haiku 5.5 as
// before, the DEFAULT profiles unchanged. New configs, V4 on the API and
// V3 on the CLI: a run created under V3 or V2 advances under it (the
// config's identity is its content less the output cap). The default
// changed only when the manager read the whole-agreement confirmation's
// totals row and wrote the decision into a finding.
const SONNET_ANTHROPIC_API_CALL_KIND_MODELS = Object.freeze({
  ROUTING: Object.freeze({ model: 'claude-haiku-5-5', effort: 'low' }),
  RESIDUAL: Object.freeze({ model: 'claude-haiku-5-5', effort: 'low' }),
  EXTRACTION: Object.freeze({ model: 'claude-sonnet-5-5', effort: 'high' }),
});
const SONNET_CLAUDE_CLI_CALL_KIND_MODELS = SONNET_ANTHROPIC_API_CALL_KIND_MODELS;
const ANTHROPIC_API_SONNET_MODEL_CONFIG = Object.freeze({
  ...ANTHROPIC_API_MODEL_CONFIG,
  model_id: 'PRODUCT_ANTHROPIC_API_CALL_KIND_MAP/V4',
  call_kind_models: SONNET_ANTHROPIC_API_CALL_KIND_MODELS,
  request_profile: REQUEST_PROFILES.DEFAULT,
});
const CLAUDE_CLI_SONNET_MODEL_CONFIG = Object.freeze({
  ...CLAUDE_CLI_MODEL_CONFIG,
  model_id: 'PRODUCT_CLAUDE_CLI_CALL_KIND_MAP/V3',
  call_kind_models: SONNET_CLAUDE_CLI_CALL_KIND_MODELS,
  request_profile: REQUEST_PROFILES.DEFAULT_CLI,
});

// DeepSeek as a hosted provider (2026-10-23; Ben: "you can build out a
// deepseek backend if you like - just get this working"). The endpoint is
// the Anthropic Messages API shape at
// https://api.deepseek.com/anthropic (https://api-docs.deepseek.com/
// guides/anthropic_api, read 2026-10-23): x-api-key, system, messages,
// output_config.effort and a standard message with text and thinking
// blocks. The same split as the Anthropic API's default: the strongest
// model where the facts are written (deepseek-v4-pro at high effort) and
// the cheapest for routing and residual (deepseek-flash at low). Both
// list a 1M-token context and a 384K maximum output
// (https://api-docs.deepseek.com/quick_start/pricing/); the config keeps
// the deployed 128,000-token cap because the cap is operational, not the
// model's identity (finding (87)). The request profile is the API's
// DEFAULT: the endpoint is Anthropic-shaped and ignores cache_control, so
// the same request the Anthropic API sends is valid here. The key is
// DEEPSEEK_API_KEY on the deployment, passed to the sandbox by the wake for
// this provider alone.
const DEEPSEEK_API_PROVIDER_ID = 'DEEPSEEK_API';
const DEEPSEEK_API_CALL_KIND_MODELS = Object.freeze({
  ROUTING: Object.freeze({ model: 'deepseek-flash', effort: 'low' }),
  RESIDUAL: Object.freeze({ model: 'deepseek-flash', effort: 'low' }),
  EXTRACTION: Object.freeze({ model: 'deepseek-v4-pro', effort: 'high' }),
});
const DEEPSEEK_API_MODEL_CONFIG = Object.freeze({
  provider_id: DEEPSEEK_API_PROVIDER_ID,
  model_id: 'PRODUCT_DEEPSEEK_API_CALL_KIND_MAP/V1',
  model_selection: 'CALL_KIND',
  call_kind_models: DEEPSEEK_API_CALL_KIND_MODELS,
  max_output_tokens: 128000,
  thinking: 'adaptive',
  tools: 'none',
  billing_basis: 'DEEPSEEK_API_METERED',
  base_url: 'https://api.deepseek.com/anthropic',
  api_key_env: 'DEEPSEEK_API_KEY',
  request_profile: REQUEST_PROFILES.DEFAULT,
});
const DEEPSEEK_API_MODEL_CONFIGS = Object.freeze([DEEPSEEK_API_MODEL_CONFIG]);

const ANTHROPIC_API_MODEL_CONFIGS = Object.freeze([ANTHROPIC_API_MODEL_CONFIG, ANTHROPIC_API_LEAN_MODEL_CONFIG, ANTHROPIC_API_DEFAULT_MODEL_CONFIG, ANTHROPIC_API_SONNET_MODEL_CONFIG]);
// The adapter is the Anthropic-shaped one for both providers: the known
// configs it can advance a run under are the Anthropic API's and
// DeepSeek's, and a stored config's identity decides which one it is.
const API_MODEL_CONFIGS = Object.freeze([...ANTHROPIC_API_MODEL_CONFIGS, ...DEEPSEEK_API_MODEL_CONFIGS]);
const CLAUDE_CLI_MODEL_CONFIGS = Object.freeze([CLAUDE_CLI_MODEL_CONFIG, CLAUDE_CLI_DEFAULT_MODEL_CONFIG, CLAUDE_CLI_SONNET_MODEL_CONFIG]);

// The known config a run's stored config is (by identity, the output cap
// aside), or null; per provider. The request profile a run follows is the
// known config's (V9 when it names none: every run before work package
// E1).
function knownModelConfigFor(modelConfig, candidates) {
  if (!modelConfig || typeof modelConfig !== 'object') return null;
  const identity = canonicalJson(modelConfigIdentity(modelConfig));
  return candidates.find((candidate) => canonicalJson(modelConfigIdentity(candidate)) === identity) || null;
}

function anthropicApiModelConfigFor(modelConfig) {
  return knownModelConfigFor(modelConfig, API_MODEL_CONFIGS);
}

function claudeCliModelConfigFor(modelConfig) {
  return knownModelConfigFor(modelConfig, CLAUDE_CLI_MODEL_CONFIGS);
}

function requestProfileFor(modelConfig) {
  const known = anthropicApiModelConfigFor(modelConfig) || claudeCliModelConfigFor(modelConfig);
  const profile = known?.request_profile || modelConfig?.request_profile || null;
  return profile || REQUEST_PROFILES.V9;
}

// The profile the environment selects for a new run (work package E3):
// PRODUCT_REQUEST_PROFILE names DEFAULT (the default now), V9 (every run
// before this package) or LEAN (the API alone: the cached agreement).
// PRODUCT_ANTHROPIC_API_PROFILE, the API's own switch from work package
// E1, still wins for the API when set.
function requestProfileNameForEnvironment(env = process.env, providerId = ANTHROPIC_API_PROVIDER_ID) {
  const specific = providerId === ANTHROPIC_API_PROVIDER_ID ? env.PRODUCT_ANTHROPIC_API_PROFILE : null;
  return String(specific || env.PRODUCT_REQUEST_PROFILE || 'DEFAULT').toUpperCase();
}

function anthropicApiConfigForEnvironment(env = process.env) {
  const name = requestProfileNameForEnvironment(env, ANTHROPIC_API_PROVIDER_ID);
  if (name === 'DEFAULT') return ANTHROPIC_API_SONNET_MODEL_CONFIG;
  if (name === 'OPUS') return ANTHROPIC_API_DEFAULT_MODEL_CONFIG;
  if (name === 'V9') return ANTHROPIC_API_MODEL_CONFIG;
  if (name === 'LEAN') return ANTHROPIC_API_LEAN_MODEL_CONFIG;
  throw new Error(`PRODUCT_ANTHROPIC_API_PROFILE_UNSUPPORTED: ${name}`);
}

function claudeCliConfigForEnvironment(env = process.env) {
  const name = requestProfileNameForEnvironment(env, CLAUDE_CLI_PROVIDER_ID);
  if (name === 'DEFAULT') return CLAUDE_CLI_SONNET_MODEL_CONFIG;
  if (name === 'OPUS') return CLAUDE_CLI_DEFAULT_MODEL_CONFIG;
  if (name === 'V9') return CLAUDE_CLI_MODEL_CONFIG;
  throw new Error(`PRODUCT_REQUEST_PROFILE_UNSUPPORTED: ${name} on ${CLAUDE_CLI_PROVIDER_ID}`);
}

const HOSTED_PROVIDER_IDS = Object.freeze([CODEX_PROVIDER_ID, CLAUDE_CLI_PROVIDER_ID, ANTHROPIC_API_PROVIDER_ID, DEEPSEEK_API_PROVIDER_ID]);

function isHostedProvider(providerId) {
  return HOSTED_PROVIDER_IDS.includes(providerId);
}

// The canonical model config a hosted run must carry, by its provider.
// `run` (a run row or its model_config) picks the API config a run was
// created under among the known ones (work package E1: the lean profile);
// without it, the environment's.
function hostedModelConfigFor(providerId, run = null, env = process.env) {
  if (providerId === CODEX_PROVIDER_ID) return CODEX_MODEL_CONFIG;
  const stored = run && typeof run === 'object' ? (run.model_config || run) : null;
  if (providerId === CLAUDE_CLI_PROVIDER_ID) {
    return (stored && claudeCliModelConfigFor(stored)) || claudeCliConfigForEnvironment(env);
  }
  if (providerId === ANTHROPIC_API_PROVIDER_ID) {
    return (stored && knownModelConfigFor(stored, ANTHROPIC_API_MODEL_CONFIGS)) || anthropicApiConfigForEnvironment(env);
  }
  // DeepSeek has one known config: a run created under it keeps it (the
  // environment has no DeepSeek variant to choose), and another provider's
  // stored config is not it.
  if (providerId === DEEPSEEK_API_PROVIDER_ID) {
    return (stored && knownModelConfigFor(stored, DEEPSEEK_API_MODEL_CONFIGS)) || DEEPSEEK_API_MODEL_CONFIG;
  }
  throw new Error(`PRODUCT_HOSTED_PROVIDER_UNSUPPORTED: ${providerId}`);
}

function configuredProductModelConfig(env = process.env) {
  const provider = env.PRODUCT_MODEL_PROVIDER || ANTHROPIC_PROVIDER_ID;
  if (provider === ANTHROPIC_PROVIDER_ID) return ANTHROPIC_MODEL_CONFIG;
  if (provider === CODEX_PROVIDER_ID) return CODEX_MODEL_CONFIG;
  if (provider === CLAUDE_CLI_PROVIDER_ID) return claudeCliConfigForEnvironment(env);
  if (provider === ANTHROPIC_API_PROVIDER_ID) return anthropicApiConfigForEnvironment(env);
  if (provider === DEEPSEEK_API_PROVIDER_ID) return DEEPSEEK_API_MODEL_CONFIG;
  throw new Error(`PRODUCT_MODEL_PROVIDER_UNSUPPORTED: ${provider}`);
}

function resolveClaudeCliCallModel(modelConfig, callKind) {
  if (!Object.prototype.hasOwnProperty.call(CLAUDE_CLI_CALL_KIND_MODELS, callKind)) {
    throw new Error(`PRODUCT_MODEL_CALL_KIND_UNSUPPORTED: ${callKind}`);
  }
  // Any known CLI config (V1, or work package E3's default): the run's own
  // call-kind map decides the model and effort.
  const known = claudeCliModelConfigFor(modelConfig);
  if (!known) {
    throw new Error('PRODUCT_CLAUDE_CLI_MODEL_CONFIG_UNSUPPORTED');
  }
  return known.call_kind_models[callKind];
}

function resolveAnthropicApiCallModel(modelConfig, callKind) {
  if (!Object.prototype.hasOwnProperty.call(ANTHROPIC_API_CALL_KIND_MODELS, callKind)) {
    throw new Error(`PRODUCT_MODEL_CALL_KIND_UNSUPPORTED: ${callKind}`);
  }
  // The run's stored config may carry the output cap it was created with
  // (modelConfigIdentity above): the identity decides, the deployed cap is
  // used (NCS generation 5, 2026-10-18: the new worker refused every
  // section with this code until the cap was left out of the comparison).
  // Any known API config (the V1 map or the lean profile's, work package
  // E1): the run's own call-kind map decides the model and effort.
  const known = anthropicApiModelConfigFor(modelConfig);
  if (!known) {
    throw new Error('PRODUCT_ANTHROPIC_API_MODEL_CONFIG_UNSUPPORTED');
  }
  return known.call_kind_models[callKind];
}

// Work package 10 (plan finding (67)): the prompt cache's lifetime for the
// API provider's stable prefix. Generation 8's stored calls (313 calls, four
// workers) decide it: a call that would read an entry starts, per worker,
// a median 233 seconds after the previous extraction call started (p90 457
// seconds, 52 of 126 gaps over five minutes), because the lifetime runs
// from the start of the request that wrote or read the entry and an
// extraction answers for 217 seconds at the median and up to 30 minutes.
// On that profile, at claude-opus-5's rates, the 5-minute entry ($6.25 per
// million written) would be read by 45 of the 90 repeat extraction calls
// and saves $3.07 a generation; the 1-hour entry ($10 per million written,
// one write per routed family set per hour) would be read by 85 of 90 and
// saves $6.64. The hour wins while a generation runs sections for longer
// than a few minutes each.
const ANTHROPIC_API_CACHE_TTL = '1h';
const ANTHROPIC_API_CACHE_TTLS = Object.freeze(['5m', '1h']);

// Whether a DeepSeek call ran under the published peak schedule: 01:00-04:00
// and 06:00-10:00 UTC, Monday through Friday. Chinese public holidays are
// off-peak too and are not modelled; a call on one is priced at peak.
function deepseekPeakRate(at = Date.now()) {
  const date = at instanceof Date ? at : new Date(at);
  const day = date.getUTCDay();
  if (day === 0 || day === 6) return false;
  const hour = date.getUTCHours();
  return DEEPSEEK_API_PRICES.peak_hours_utc.some(([start, end]) => hour >= start && hour < end);
}

// One model's Anthropic-shaped rate row: the published Anthropic row, or
// DeepSeek's row for the schedule the call ran under (cache writes at the
// input rate: DeepSeek bills an uncached input token, it has no separate
// write premium).
function apiModelRates(modelId, at = Date.now()) {
  const anthropic = ANTHROPIC_API_PRICES.usd_per_million[modelId];
  if (anthropic) return anthropic;
  const deepseek = DEEPSEEK_API_PRICES.usd_per_million[modelId];
  if (!deepseek) throw new Error(`PRODUCT_ANTHROPIC_API_RATES_UNKNOWN: ${modelId}`);
  const rates = deepseek[deepseekPeakRate(at) ? 'peak' : 'off_peak'];
  return {
    input: rates.input,
    cache_write_5m: rates.input,
    cache_write_1h: rates.input,
    cache_read: rates.cache_read,
    output: rates.output,
  };
}

// Microdollars for one call at the published rates: fresh input, cache
// writes at the lifetime they were written for (the message's
// usage.cache_creation breakdown when the API returns it, else the
// lifetime the request asked for; 5 minutes when nothing says otherwise),
// cache reads and output each at their own rate; a model without a
// published row is refused. A DeepSeek call is priced at the peak or
// off-peak schedule it ran under (`at`; the call's start by default).
function anthropicApiCostMicrousd(modelId, usage, { cacheTtl = '5m', at = Date.now() } = {}) {
  const rates = apiModelRates(modelId, at);
  if (!ANTHROPIC_API_CACHE_TTLS.includes(cacheTtl)) throw new Error(`PRODUCT_ANTHROPIC_API_CACHE_TTL_UNKNOWN: ${cacheTtl}`);
  const integer = (object, key) => (Number.isInteger(object?.[key]) && object[key] >= 0 ? object[key] : null);
  const count = (key) => integer(usage, key) ?? 0;
  const breakdown = usage?.cache_creation;
  const written5m = integer(breakdown, 'ephemeral_5m_input_tokens');
  const written1h = integer(breakdown, 'ephemeral_1h_input_tokens');
  const writes = written5m !== null || written1h !== null
    ? (written5m ?? 0) * rates.cache_write_5m + (written1h ?? 0) * rates.cache_write_1h
    : count('cache_creation_input_tokens') * (cacheTtl === '1h' ? rates.cache_write_1h : rates.cache_write_5m);
  return Math.round(count('input_tokens') * rates.input + writes
    + count('cache_read_input_tokens') * rates.cache_read + count('output_tokens') * rates.output);
}

// A run's model_config is the identity of the model it runs under: the
// provider, the call-kind map, the selection, thinking, tools and the
// billing basis. The output cap is an operational limit the provider
// enforces on each call, not part of that identity: a run begun under one
// cap advances under a larger one (NCS generation 5, 2026-10-18: the run
// was created with the 64,000-token cap, work package 15 raised the cap to
// the documented maximum while it ran, and the run route refused to
// advance it with PRODUCT_RUN_MODEL_CONFIG_MISMATCH). The stored config
// keeps the cap the run was created with as history; the deployed config's
// cap is the one used.
function modelConfigIdentity(config) {
  if (!config || typeof config !== 'object') return config;
  const { max_output_tokens: _cap, ...identity } = config;
  return identity;
}

function assertRunModelConfig(run, expected = configuredProductModelConfig()) {
  if (!run || canonicalJson(modelConfigIdentity(run.model_config)) !== canonicalJson(modelConfigIdentity(expected))) {
    throw new Error('PRODUCT_RUN_MODEL_CONFIG_MISMATCH');
  }
  return expected;
}

function assertConfiguredRunModelConfig(run, expected = configuredProductModelConfig()) {
  if (canonicalJson(expected) === canonicalJson(CODEX_MODEL_CONFIG) && run?.run_id === PHASE5_DIAGNOSTIC_RUN_ID
    && run.source_document_id === PHASE5_DIAGNOSTIC_SOURCE_ID) {
    return assertRunModelConfig(run, CODEX_DIAGNOSTIC_MODEL_CONFIG);
  }
  return assertRunModelConfig(run, expected);
}

function resolveCodexCallModel(modelConfig, callKind) {
  if (!Object.prototype.hasOwnProperty.call(CODEX_CALL_KIND_MODELS, callKind)) {
    throw new Error(`PRODUCT_MODEL_CALL_KIND_UNSUPPORTED: ${callKind}`);
  }
  if (canonicalJson(modelConfig) === canonicalJson(CODEX_MODEL_CONFIG)) {
    return CODEX_CALL_KIND_MODELS[callKind];
  }
  if (canonicalJson(modelConfig) === canonicalJson(CODEX_MINI_MODEL_CONFIG)
    || canonicalJson(modelConfig) === canonicalJson(CODEX_DIAGNOSTIC_MODEL_CONFIG)) {
    return Object.freeze({
      model: modelConfig.execution_model,
      reasoning_effort: modelConfig.reasoning_effort,
    });
  }
  throw new Error('PRODUCT_CODEX_MODEL_CONFIG_UNSUPPORTED');
}

module.exports = {
  modelConfigIdentity,
  ANTHROPIC_API_CALL_KIND_MODELS,
  ANTHROPIC_API_DEFAULT_MODEL_CONFIG,
  CLAUDE_CLI_DEFAULT_MODEL_CONFIG,
  CLAUDE_CLI_MODEL_CONFIGS,
  CLAUDE_CLI_SONNET_MODEL_CONFIG,
  DEFAULT_ANTHROPIC_API_CALL_KIND_MODELS,
  DEFAULT_CLAUDE_CLI_CALL_KIND_MODELS,
  REQUEST_PROFILES,
  claudeCliConfigForEnvironment,
  claudeCliModelConfigFor,
  requestProfileNameForEnvironment,
  ANTHROPIC_API_LEAN_MODEL_CONFIG,
  ANTHROPIC_API_MODEL_CONFIGS,
  ANTHROPIC_API_SONNET_MODEL_CONFIG,
  ANTHROPIC_API_REQUEST_PROFILES,
  API_MODEL_CONFIGS,
  DEEPSEEK_API_CALL_KIND_MODELS,
  DEEPSEEK_API_MODEL_CONFIG,
  DEEPSEEK_API_MODEL_CONFIGS,
  DEEPSEEK_API_PRICES,
  DEEPSEEK_API_PROVIDER_ID,
  anthropicApiConfigForEnvironment,
  anthropicApiModelConfigFor,
  requestProfileFor,
  ANTHROPIC_API_CACHE_TTL,
  ANTHROPIC_API_CACHE_TTLS,
  ANTHROPIC_API_MODEL_CONFIG,
  ANTHROPIC_API_PROVIDER_ID,
  ANTHROPIC_API_PRICES,
  anthropicApiCostMicrousd,
  resolveAnthropicApiCallModel,
  ANTHROPIC_MODEL_CONFIG,
  ANTHROPIC_PROVIDER_ID,
  CLAUDE_CLI_CALL_KIND_MODELS,
  CLAUDE_CLI_MODEL_CONFIG,
  CLAUDE_CLI_PROVIDER_ID,
  HOSTED_PROVIDER_IDS,
  hostedModelConfigFor,
  isHostedProvider,
  resolveClaudeCliCallModel,
  CODEX_CALL_KIND_MODELS,
  CODEX_DIAGNOSTIC_MODEL_CONFIG,
  CODEX_MINI_MODEL_CONFIG,
  CODEX_MODEL_CONFIG,
  CODEX_PROVIDER_ID,
  PHASE5_DIAGNOSTIC_RUN_ID,
  PHASE5_DIAGNOSTIC_SOURCE_ID,
  assertConfiguredRunModelConfig,
  assertRunModelConfig,
  configuredProductModelConfig,
  resolveCodexCallModel,
};
