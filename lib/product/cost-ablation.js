'use strict';

// Work package E1 item 3 (plan finding (167); implementer E; the manager's
// direction of 2026-10-18 22:30 UTC names it cost-ablation). The
// three-section ablation: one section of a stored run, extracted again
// under a variant of the request profile and the model, with the facts
// compared on the agreement's bytes against the facts the run stored, and
// the tokens, seconds and dollars beside them. Ben: "look at all of the
// output yourself and analyze if you think it is right or wrong and if
// not, iterate to improve it"; "I agree but I'd say get AS much cost
// reduction and increase in speed as possible." Nothing here submits,
// wakes or writes a run: the routing and residual answers come from the
// stored calls (lib/product/run-replay.js), only the extraction call of a
// variant is live, through the API provider with the variant's profile and
// models, and every live answer is recorded for replay. The baseline row
// costs nothing: it is the stored run read back through the same compiler.

const { LONG_SECTION_SPLIT, buildAgreementSectionDraft, splitForAttempt } = require('./agreement-draft');
const { tableShapesForRun } = require('./analysis-runner');
const { callUsage } = require('./extraction-cost-ledger');
const { factRanges, statusForShare } = require('./generation-comparison');
const { legalSchemaForVersion } = require('./legal-schema-selection');
const { callKey } = require('./model-adapter');
const { ANTHROPIC_API_DEFAULT_MODEL_CONFIG, ANTHROPIC_API_LEAN_MODEL_CONFIG, ANTHROPIC_API_MODEL_CONFIG, ANTHROPIC_API_PRICES, ANTHROPIC_API_PROVIDER_ID, ANTHROPIC_API_REQUEST_PROFILES, CLAUDE_CLI_PROVIDER_ID, REQUEST_PROFILES } = require('./product-model-config');
const { RunReplayError, createReplayModel, indexStoredCalls } = require('./run-replay');
const { substantiveSections } = require('./source-context');

const OPUS_5 = Object.freeze({ model: 'claude-opus-5', effort: 'high' });
const LOW = (model) => Object.freeze({ model, effort: 'low' });
const V9 = ANTHROPIC_API_REQUEST_PROFILES.V9;
const LEAN = ANTHROPIC_API_REQUEST_PROFILES.LEAN;

// The variants, each a step on the last so the table reads as a ladder.
// `replay` names the call kinds answered from the stored calls (no
// spend); the others go live. The baseline replays everything.
const ABLATION_VARIANTS = Object.freeze({
  baseline: { profile: V9, models: {}, replay: ['ROUTING', 'RESIDUAL', 'EXTRACTION'], note: 'the stored run read back through the compiler as it is now; no call' },
  format: { profile: { name: 'FORMAT', response_format: 'V10', quote_mode: 'text', context_mode: 'inline', stable_blocks: 2 }, models: {}, replay: ['ROUTING', 'RESIDUAL'], note: 'components alone (no roles, no evidence_quotes), short span aliases, two stable blocks; the words still verbatim; the context still inline' },
  anchors: { profile: { name: 'ANCHORS', response_format: 'V10', quote_mode: 'anchors', context_mode: 'inline', stable_blocks: 2 }, models: {}, replay: ['ROUTING', 'RESIDUAL'], note: 'format, and a long component\'s words as its first and last words, resolved by the validator' },
  lean: { profile: LEAN, models: {}, replay: ['ROUTING', 'RESIDUAL'], note: 'anchors, and the agreement sent once under its own cache breakpoint with the definitions and cross-references listed, not copied (the LEAN run config)' },
  lean_medium: { profile: LEAN, models: { EXTRACTION: { model: 'claude-opus-5', effort: 'medium' } }, replay: ['ROUTING', 'RESIDUAL'], note: 'lean at medium effort' },
  lean_opus55: { profile: LEAN, models: { EXTRACTION: { model: 'claude-opus-5-5', effort: 'high' } }, replay: ['ROUTING', 'RESIDUAL'], note: 'lean on claude-opus-5-5 at high effort' },
  lean_opus55_medium: { profile: LEAN, models: { EXTRACTION: { model: 'claude-opus-5-5', effort: 'medium' } }, replay: ['ROUTING', 'RESIDUAL'], note: 'lean on claude-opus-5-5 at medium effort' },
  // The CLI-expressible model rungs (work package E2): the same tier
  // changes as the lean_* rungs, on the inline context the CLI can send.
  anchors_medium: { profile: { name: 'ANCHORS', response_format: 'V10', quote_mode: 'anchors', context_mode: 'inline', stable_blocks: 2 }, models: { EXTRACTION: { model: 'claude-opus-5', effort: 'medium' } }, replay: ['ROUTING', 'RESIDUAL'], note: 'anchors at medium effort' },
  anchors_opus55: { profile: { name: 'ANCHORS', response_format: 'V10', quote_mode: 'anchors', context_mode: 'inline', stable_blocks: 2 }, models: { EXTRACTION: { model: 'claude-opus-5-5', effort: 'high' } }, replay: ['ROUTING', 'RESIDUAL'], note: 'anchors on claude-opus-5-5 at high effort' },
  anchors_opus55_medium: { profile: { name: 'ANCHORS', response_format: 'V10', quote_mode: 'anchors', context_mode: 'inline', stable_blocks: 2 }, models: { EXTRACTION: { model: 'claude-opus-5-5', effort: 'medium' } }, replay: ['ROUTING', 'RESIDUAL'], note: 'anchors on claude-opus-5-5 at medium effort' },
  offsets: { profile: { name: 'OFFSETS', response_format: 'V10', quote_mode: 'offsets', context_mode: 'inline', stable_blocks: 2 }, models: {}, replay: ['ROUTING', 'RESIDUAL'], note: 'format, and a long component\'s words as character offsets within the cited span, read back from the span (the manager\'s offsets mode; implementer A\'s validator acceptance is work package 21)' },
  all_contracts: { profile: { name: 'ALL_CONTRACTS', response_format: 'V10', quote_mode: 'anchors', context_mode: 'inline', stable_blocks: 2, contracts_scope: 'all' }, models: {}, replay: ['ROUTING', 'RESIDUAL'], note: 'anchors, and every family\'s contracts and tables in the stable block (one block per call kind for the run instead of one per routed family set)' },
  trimmed: { profile: { name: 'TRIMMED', response_format: 'V10', quote_mode: 'anchors', context_mode: 'trimmed', stable_blocks: 2 }, models: {}, replay: ['ROUTING', 'RESIDUAL'], note: 'anchors, and the cross-references one hop deep (the sections the section\'s own words name), each sent whole once; the others listed' },
  // Work package E3 part 2 (the fresh sheet, plan finding (185)): the
  // default itself as a rung, the deterministic experiments behind flags,
  // and a Sonnet extraction rung.
  default: { profile: REQUEST_PROFILES.DEFAULT, models: { ROUTING: LOW('claude-haiku-5-5'), RESIDUAL: LOW('claude-haiku-5-5'), EXTRACTION: { model: 'claude-opus-5-5', effort: 'high' } }, replay: [], note: 'the default request profile and models of new runs (finding (184)); on the CLI this is the rung that confirms Opus 5.5 there' },
  deterministic_routing: { profile: { ...V9, routing_mode: 'deterministic_first' }, models: {}, replay: ['ROUTING', 'RESIDUAL', 'EXTRACTION'], note: 'the routing from the heading and the defined terms, no routing call where the words decide; the stored calls answer the rest, so the row shows how many sections the words decide and whether the facts hold' },
  direct_definitions: { profile: { ...REQUEST_PROFILES.DEFAULT, definitions_scope: 'direct' }, models: {}, replay: ['ROUTING', 'RESIDUAL'], note: 'the default, with only the definitions the section\'s own words use sent whole; the transitive ones listed' },
  fact_budget: { profile: { ...REQUEST_PROFILES.DEFAULT, fact_budget: true }, models: {}, replay: ['ROUTING', 'RESIDUAL'], note: 'the default, with the section\'s fact budget in the request (a check, not a target)' },
  anchors_sonnet55: { profile: { name: 'ANCHORS', response_format: 'V10', quote_mode: 'anchors', context_mode: 'inline', stable_blocks: 2 }, models: { EXTRACTION: { model: 'claude-sonnet-5-5', effort: 'high' } }, replay: ['ROUTING', 'RESIDUAL'], note: 'anchors on claude-sonnet-5-5 at high effort: the next tier down writing the facts' },
  routing_sonnet: { profile: V9, models: { ROUTING: LOW('claude-sonnet-5-5'), RESIDUAL: LOW('claude-sonnet-5-5') }, replay: ['EXTRACTION'], note: 'routing and residual on claude-sonnet-5-5; the extraction replays when the routing agrees, else the disagreement is the finding' },
  routing_haiku: { profile: V9, models: { ROUTING: LOW('claude-haiku-5-5'), RESIDUAL: LOW('claude-haiku-5-5') }, replay: ['EXTRACTION'], note: 'routing and residual on claude-haiku-5-5; as above' },
});

function plainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

// Work package E2: what a provider can express of a variant. The CLI
// (`claude -p`) sends one prompt and caches on its own terms: a rung whose
// point is an API cache breakpoint (the agreement block of
// context_mode 'cached_agreement') cannot run on it and is listed, not
// faked; a rung whose stable_blocks layout is only a cache split still
// sends the same words, so it runs, with the note that the cache
// accounting is the CLI's own. Model and effort rungs go through the
// CLI's --model and --effort.
function variantAvailability(variant, providerId = ANTHROPIC_API_PROVIDER_ID) {
  if (providerId !== CLAUDE_CLI_PROVIDER_ID) return { runnable: true, notes: [] };
  const profile = variant.profile || {};
  if (profile.context_mode === 'cached_agreement') {
    return { runnable: false, notes: ['API-only rung: the agreement block is an API cache breakpoint the CLI does not control; not run on the CLI'] };
  }
  const notes = [];
  if (Number(profile.stable_blocks) === 2) notes.push('the two-block cache layout is the API\'s; the CLI sends the same words and reports its own cache split');
  if (variant.replay.length === 3) notes.push('no call on any provider');
  return { runnable: true, notes };
}

// A recording of live answers (PRODUCT_MODEL_RECORDING/V1 entries keyed by
// the call), so a variant's calls are made once and replayed after.
function createRecorder(entries = []) {
  const byKey = new Map(entries.map((entry) => [entry.call_key, entry]));
  return {
    entries: () => [...byKey.values()],
    lookup: (input) => byKey.get(callKey(input)) || null,
    remember: (input, result) => {
      const entry = {
        call_key: callKey(input), call_kind: input.call_kind, prompt_version: input.prompt_version, section_reference: input.request?.section_reference || input.request?.source_closure?.section_reference || null,
        provider_id: result.provider_id, model_id: result.model_id, raw_request: result.raw_request, raw_response: result.raw_response,
        input_tokens: result.input_tokens, output_tokens: result.output_tokens, cost_microusd: result.cost_microusd, duration_ms: result.duration_ms,
        ...(Number.isInteger(result.visible_output_tokens) ? { visible_output_tokens: result.visible_output_tokens, thinking_tokens: Math.max(0, result.output_tokens - result.visible_output_tokens), thinking_source: result.thinking_source || null } : {}),
        ...(Number.isInteger(result.list_cost_microusd) ? { list_cost_microusd: result.list_cost_microusd } : {}),
        ...(Number.isInteger(result.api_duration_ms) ? { api_duration_ms: result.api_duration_ms } : {}),
        recorded_at: new Date().toISOString(),
      };
      byKey.set(entry.call_key, entry);
      return entry;
    },
  };
}

// The model a variant runs on: the stored calls for the kinds it replays,
// the recording for a call already made, the live provider otherwise.
function createVariantModel({ variant, replayIndex, nodeByReference, liveModel, recorder, onLive = null, tokenCounter = null }) {
  const replay = createReplayModel({ index: replayIndex, match: 'exact', nodeByReference });
  const liveCalls = [];
  return {
    liveCalls,
    async complete(input) {
      if (variant.replay.includes(input.call_kind)) return replay.complete(input);
      const recorded = recorder.lookup(input);
      if (recorded) {
        return {
          provider_id: recorded.provider_id, model_id: recorded.model_id, raw_request: recorded.raw_request, raw_response: recorded.raw_response,
          response: recorded.raw_response?.content ? JSON.parse(recorded.raw_response.content.filter((block) => block.type === 'text').map((block) => block.text).join('').replace(/^\s*```(?:json)?\s*/, '').replace(/\s*```\s*$/, '')) : recorded.raw_response,
          input_tokens: recorded.input_tokens, output_tokens: recorded.output_tokens, cost_microusd: recorded.cost_microusd, duration_ms: recorded.duration_ms, provider_completion_confirmed: true,
        };
      }
      if (!liveModel) throw new RunReplayError('LIVE_CALL_REQUIRED', `${input.call_kind} for ${input.request?.section_reference || input.request?.source_closure?.section_reference || '?'} under variant ${variant.name}: no recording; run with --live`);
      const result = await liveModel.complete(input);
      // The thinking share measured, not assumed (the manager's direction):
      // the CLI reports it (usage.output_tokens_details.thinking_tokens,
      // and the list-price cost in model_usage); on the API the visible
      // answer's tokens are counted by the API's own tokenizer and taken
      // from the output tokens billed.
      const reportedThinking = result.raw_response?.usage?.output_tokens_details?.thinking_tokens;
      if (Number.isInteger(reportedThinking) && Number.isInteger(result.output_tokens)) {
        result.visible_output_tokens = Math.max(0, result.output_tokens - reportedThinking);
        result.thinking_source = 'reported';
      }
      const modelUsage = result.raw_response?.model_usage;
      if (plainObject(modelUsage)) {
        const listUsd = Object.values(modelUsage).reduce((sum, entry) => sum + (Number(entry?.costUSD) || 0), 0);
        if (listUsd > 0) result.list_cost_microusd = Math.round(listUsd * 1e6);
      }
      if (Number.isInteger(result.raw_response?.duration_api_ms)) result.api_duration_ms = result.raw_response.duration_api_ms;
      if (tokenCounter && !Number.isInteger(result.visible_output_tokens)) {
        try {
          const text = Array.isArray(result.raw_response?.content) ? result.raw_response.content.filter((block) => block.type === 'text').map((block) => block.text).join('') : '';
          const visible = text ? await tokenCounter(text, String(result.model_id || '').split(';')[0]) : null;
          if (Number.isInteger(visible)) { result.visible_output_tokens = visible; result.thinking_source = 'count_tokens'; }
        } catch { /* a count that fails leaves the share unmeasured for this call */ }
      }
      const entry = recorder.remember(input, result);
      liveCalls.push(entry);
      if (onLive) onLive(entry);
      return result;
    },
  };
}

function mergeRanges(ranges) {
  const sorted = ranges.filter(([start, end]) => Number.isSafeInteger(start) && Number.isSafeInteger(end) && end > start).sort((left, right) => left[0] - right[0]);
  const merged = [];
  for (const [start, end] of sorted) {
    const last = merged[merged.length - 1];
    if (last && start <= last[1]) last[1] = Math.max(last[1], end); else merged.push([start, end]);
  }
  return merged;
}

function overlapBytes(left, right) {
  let total = 0;
  for (const [aStart, aEnd] of left) for (const [bStart, bEnd] of right) { const start = Math.max(aStart, bStart); const end = Math.min(aEnd, bEnd); if (end > start) total += end - start; }
  return total;
}

function totalBytes(ranges) {
  return ranges.reduce((sum, [start, end]) => sum + (end - start), 0);
}

// The stored VALID facts of a section as byte ranges (their OWN component
// rows), and a variant's compiled facts likewise; a stored fact is MATCHED
// by the variant fact that covers half its bytes or more, PARTIAL by one
// that covers some, UNMATCHED by none; a variant fact that matches no
// stored fact is NEW. The rule is generation-comparison's.
function compareFacts({ storedFacts, variantFacts }) {
  const stored = storedFacts.map((fact) => ({ ...fact, ranges: mergeRanges(fact.ranges) })).filter((fact) => fact.ranges.length);
  const variant = variantFacts.map((fact) => ({ ...fact, ranges: factRanges(fact, new Map()) }));
  const matchedVariant = new Set();
  const rows = stored.map((fact) => {
    let best = null;
    for (const candidate of variant) {
      if (!candidate.ranges.length) continue;
      const share = overlapBytes(fact.ranges, candidate.ranges) / totalBytes(fact.ranges);
      if (share > 0 && (!best || share > best.share)) best = { share, candidate };
    }
    const status = best ? statusForShare(best.share) : 'UNMATCHED';
    if (best && status !== 'UNMATCHED') matchedVariant.add(best.candidate.proposal_id || best.candidate.client_ref);
    return { proposal_id: fact.proposal_id, family_key: fact.family_key, subtype_key: fact.subtype_key, summary: fact.summary || null, status, share: best ? Number(best.share.toFixed(2)) : 0, counterpart: best ? (best.candidate.proposal_id || best.candidate.client_ref) : null, counterpart_status: best ? best.candidate.validation_status : null };
  });
  const newFacts = variant.filter((fact) => fact.ranges.length && !matchedVariant.has(fact.proposal_id || fact.client_ref)).map((fact) => ({ proposal_id: fact.proposal_id, family_key: fact.family_key, subtype_key: fact.subtype_key, validation_status: fact.validation_status, summary: fact.headline?.summary || null }));
  const counts = { stored: stored.length, matched: rows.filter((row) => row.status === 'MATCHED').length, partial: rows.filter((row) => row.status === 'PARTIAL').length, unmatched: rows.filter((row) => row.status === 'UNMATCHED').length, new: newFacts.length };
  return { counts, rows, new_facts: newFacts };
}

function priceOf(modelId) {
  return ANTHROPIC_API_PRICES.usd_per_million[String(modelId || '').split(';')[0]] || null;
}

function usageOfCalls(calls) {
  const total = { calls: 0, fresh_input_tokens: 0, cache_read_tokens: 0, cache_write_tokens: 0, output_tokens: 0, cost_microusd: 0, duration_ms: 0, stable_block_bytes: 0, section_block_bytes: 0 };
  for (const call of calls) {
    const usage = callUsage(call);
    total.calls += 1;
    total.fresh_input_tokens += usage.fresh_input_tokens;
    total.cache_read_tokens += usage.cache_read_tokens;
    total.cache_write_tokens += usage.cache_write_tokens;
    total.output_tokens += usage.output_tokens;
    total.cost_microusd += usage.cost_microusd;
    total.duration_ms += usage.duration_ms;
    total.stable_block_bytes += usage.stable_bytes;
    total.section_block_bytes += usage.section_bytes;
  }
  return total;
}

// What the same tokens would cost at a model's rates (the stored baseline
// priced at claude-opus-5-5, for the one-line answer to "what if we only
// changed the model").
function repriced(usage, modelId) {
  const rates = priceOf(modelId);
  if (!rates) return null;
  return Number(((usage.fresh_input_tokens * rates.input + usage.cache_write_tokens * rates.cache_write_1h + usage.cache_read_tokens * rates.cache_read + usage.output_tokens * rates.output) / 1e6).toFixed(2));
}

// Runs one variant over the named sections. `liveModelFactory({ profile,
// callKindModels })` builds the API provider for a live variant (null
// means recording-only).
async function runSectionAblation({ run, context = run?.context, sections, variantName, liveModelFactory = null, recorder = createRecorder(), log = null, tokenCounter = null, providerId = ANTHROPIC_API_PROVIDER_ID }) {
  const variant = ABLATION_VARIANTS[variantName];
  if (!variant) throw new RunReplayError('VARIANT_UNKNOWN', `${variantName} (known: ${Object.keys(ABLATION_VARIANTS).join(', ')})`);
  const availability = variantAvailability(variant, providerId);
  if (!availability.runnable) {
    if (log) log({ event: 'VARIANT_NOT_RUN', variant: variantName, provider_id: providerId, reason: availability.notes.join('; ') });
    return { schema_version: 'PRODUCT_SECTION_ABLATION/V1', run_id: run.run_id, variant: variantName, note: variant.note, provider_id: providerId, not_run: availability.notes.join('; '), sections: [], recording: recorder.entries() };
  }
  if (!context?.run || !context.sourceDocument || !context.agreementStructure) throw new RunReplayError('RUN_CONTEXT_REQUIRED', 'the run row, source document and AgreementStructure are required');
  const tables = run.tables;
  const closures = tables.product_source_closures || [];
  const referenceByNode = new Map(closures.map((closure) => [closure.structure_node_id, closure.section_reference]));
  const substantive = substantiveSections(context.agreementStructure);
  for (const node of substantive) if (!referenceByNode.has(node.node_id)) referenceByNode.set(node.node_id, node.reference);
  const nodeByReference = new Map([...referenceByNode].map(([nodeId, reference]) => [reference, nodeId]));
  const schema = legalSchemaForVersion(context.run.schema_version);
  const tableShapes = tableShapesForRun(context.run);
  const workByNode = new Map((tables.product_section_work || []).map((row) => [row.node_id, row]));
  const replayIndex = indexStoredCalls(tables.product_model_calls || [], { referenceByNode });
  const modelConfig = variant.profile.name === 'LEAN' ? ANTHROPIC_API_LEAN_MODEL_CONFIG : variant.profile.name === 'DEFAULT' ? ANTHROPIC_API_DEFAULT_MODEL_CONFIG : ANTHROPIC_API_MODEL_CONFIG;
  const liveModel = variant.replay.length < 3 && liveModelFactory ? liveModelFactory({ profile: variant.profile, callKindModels: variant.models, modelConfig }) : null;
  const model = createVariantModel({ variant: { ...variant, name: variantName }, replayIndex, nodeByReference, liveModel, recorder, tokenCounter, onLive: log ? (entry) => log({ event: 'LIVE_CALL', variant: variantName, ...entry, raw_request: undefined, raw_response: undefined }) : null });
  const componentsByProposal = new Map();
  for (const row of tables.product_fact_components || []) {
    if (!componentsByProposal.has(row.proposal_id)) componentsByProposal.set(row.proposal_id, []);
    componentsByProposal.get(row.proposal_id).push(row);
  }
  const headlineByProposal = new Map((tables.product_fact_headlines || []).map((row) => [row.proposal_id, row]));
  const results = [];
  for (const reference of sections) {
    const nodeId = nodeByReference.get(reference);
    const node = substantive.find((item) => item.node_id === nodeId);
    if (!node) { results.push({ section_reference: reference, error: 'section not found in the run' }); continue; }
    const work = workByNode.get(nodeId);
    const claim = { error_history: Array.isArray(work?.error_history) ? work.error_history : [] };
    const calls = [];
    const started = Date.now();
    let result = null;
    let error = null;
    try {
      result = await buildAgreementSectionDraft({
        sourceDocument: context.sourceDocument, agreementStructure: context.agreementStructure, legalSchema: schema, model, node,
        attemptToken: work?.attempt_token || null, tableShapes, longSectionSplit: splitForAttempt(LONG_SECTION_SPLIT, claim), requestProfile: variant.profile,
        onModelCall: async (call) => { calls.push(call); },
      });
    } catch (failure) {
      error = { code: failure.code || null, message: failure.message };
    }
    const storedProposals = (tables.product_proposals || []).filter((row) => row.structure_node_id === nodeId);
    const storedValid = storedProposals.filter((row) => (row.validation_status || row.payload?.validation_status) === 'VALID');
    const storedFacts = storedValid.map((row) => ({
      proposal_id: row.proposal_id, family_key: row.family_key || row.payload?.family_key, subtype_key: row.subtype_key || row.payload?.subtype_key,
      summary: headlineByProposal.get(row.proposal_id)?.summary || row.payload?.headline?.summary || null,
      ranges: (componentsByProposal.get(row.proposal_id) || []).filter((component) => (component.origin === 'OWN' || !component.origin) && Number.isSafeInteger(Number(component.start_byte))).map((component) => [Number(component.start_byte), Number(component.end_byte)]),
    }));
    const variantValid = result ? result.proposals.filter((proposal) => proposal.validation_status === 'VALID') : [];
    const comparison = compareFacts({ storedFacts, variantFacts: variantValid });
    const extractionCalls = calls.filter((call) => call.call_kind === 'EXTRACTION');
    const storedCommitted = (tables.product_model_calls || []).filter((call) => call.structure_node_id === nodeId && !(call.response?.schema_version) && call.call_kind === 'EXTRACTION');
    const usage = usageOfCalls(extractionCalls);
    const storedUsage = usageOfCalls(storedCommitted);
    const issueCodes = {};
    for (const issue of result ? result.issues : []) issueCodes[issue.code] = (issueCodes[issue.code] || 0) + 1;
    results.push({
      section_reference: reference,
      node_id: nodeId,
      variant: variantName,
      profile: variant.profile.name,
      models: variant.models,
      error,
      routing_families: result ? result.routing.families : null,
      routing_source: result ? (result.routing.routing_source || 'MODEL') : null,
      stored_routing_families: (tables.product_section_routings || []).find((row) => row.structure_node_id === nodeId)?.families || null,
      facts: result ? { total: result.proposals.length, valid: variantValid.length, held: result.proposals.length - variantValid.length, with_readout: variantValid.filter((proposal) => proposal.conclusions).length } : null,
      stored_facts: { total: storedProposals.length, valid: storedValid.length, held: storedProposals.length - storedValid.length },
      comparison,
      issue_codes: issueCodes,
      extraction: {
        ...usage,
        // The extraction's own live calls; a routing variant's live routing
        // and residual calls are counted beside them.
        live_calls: model.liveCalls.filter((entry) => entry.section_reference === reference && entry.call_kind === 'EXTRACTION').length,
        routing_live_calls: model.liveCalls.filter((entry) => entry.section_reference === reference && entry.call_kind !== 'EXTRACTION').length,
        model_ids: [...new Set(extractionCalls.map((call) => call.model_id))], elapsed_ms: Date.now() - started,
        ...thinkingOf(recorder.entries().filter((entry) => entry.section_reference === reference && entry.call_kind === 'EXTRACTION')),
      },
      stored_extraction: { ...storedUsage, model_ids: [...new Set(storedCommitted.map((call) => call.model_id))], repriced_opus_5_5_usd: repriced(storedUsage, 'claude-opus-5-5') },
      lean_note: result ? (result.issues.find((issue) => issue.code === 'LEAN_RESPONSE_NORMALISED')?.message || null) : null,
      result,
    });
    if (log) log({ event: 'SECTION_ABLATED', variant: variantName, section_reference: reference, facts: results[results.length - 1].facts, comparison: comparison.counts, error });
  }
  return { schema_version: 'PRODUCT_SECTION_ABLATION/V1', run_id: run.run_id, variant: variantName, note: variant.note, provider_id: providerId, provider_notes: availability.notes, sections: results, recording: recorder.entries() };
}

// The measured thinking share of a section's live extraction answers:
// output tokens billed less the visible answer's tokens as the API counts
// them; absent when no call was counted.
function thinkingOf(entries) {
  const counted = entries.filter((entry) => Number.isInteger(entry.visible_output_tokens));
  const listCost = entries.reduce((sum, entry) => sum + (Number.isInteger(entry.list_cost_microusd) ? entry.list_cost_microusd : 0), 0);
  const extra = listCost > 0 ? { list_cost_microusd: listCost } : {};
  if (counted.length === 0) return { ...extra };
  const output = counted.reduce((sum, entry) => sum + (entry.output_tokens || 0), 0);
  const visible = counted.reduce((sum, entry) => sum + entry.visible_output_tokens, 0);
  const sources = [...new Set(counted.map((entry) => entry.thinking_source).filter(Boolean))];
  return { ...extra, visible_output_tokens: visible, thinking_tokens: Math.max(0, output - visible), thinking_share: output ? Number(((output - visible) / output).toFixed(3)) : null, thinking_source: sources.join('+') || null };
}

// The analysis read's shape (what scripts/product/compare-generations.js
// takes as --v1-file / --v2-file: proposals with their components' bytes,
// spans, sections with their families, issues, coverage) built from a
// variant's section results, and from the stored rows for the same
// sections, so the two compare on the bytes by that script's own rule.
function analysisFromResults({ run, results, label }) {
  return {
    kind: 'draftAnalysis',
    label,
    run_id: run.run_id,
    sections: results.map((result) => ({ structure_node_id: result.node_id, section_reference: result.section_reference, families: result.routing.families, disposition: result.routing.disposition })),
    proposals: results.flatMap((result) => result.proposals),
    spans: results.flatMap((result) => result.spans),
    issues: results.flatMap((result) => result.issues),
    coverage_assertions: results.flatMap((result) => result.coverage),
  };
}

function analysisFromStoredRows({ run, nodeIds, label }) {
  const tables = run.tables;
  const wanted = new Set(nodeIds);
  const components = new Map();
  for (const row of tables.product_fact_components || []) {
    if (!components.has(row.proposal_id)) components.set(row.proposal_id, []);
    components.get(row.proposal_id).push({ component_id: row.component_id, parent_component_id: row.parent_component_id, ordinal: row.ordinal, kind: row.kind, label: row.label, text: row.text, source_span_id: row.source_span_id, start_byte: Number(row.start_byte), end_byte: Number(row.end_byte), origin: row.origin });
  }
  const headlines = new Map((tables.product_fact_headlines || []).map((row) => [row.proposal_id, row]));
  const proposals = (tables.product_proposals || []).filter((row) => wanted.has(row.structure_node_id)).map((row) => {
    const payload = row.payload || {};
    const flat = components.get(row.proposal_id) || [];
    const headline = headlines.get(row.proposal_id);
    return { ...payload, proposal_id: row.proposal_id, structure_node_id: row.structure_node_id, family_key: row.family_key || payload.family_key, subtype_key: row.subtype_key || payload.subtype_key, fact_type: row.fact_type || payload.fact_type, validation_status: row.validation_status || payload.validation_status, components: flat.filter((component) => !component.parent_component_id).map((component) => ({ ...component, children: flat.filter((child) => child.parent_component_id === component.component_id) })), ...(headline ? { headline: { label: headline.label, summary: headline.summary } } : {}) };
  });
  return {
    kind: 'draftAnalysis',
    label,
    run_id: run.run_id,
    sections: (tables.product_section_routings || []).filter((row) => wanted.has(row.structure_node_id)).map((row) => ({ structure_node_id: row.structure_node_id, section_reference: row.payload?.section_reference || null, families: row.families || row.payload?.families || [], disposition: row.disposition })),
    proposals,
    spans: (tables.product_source_spans || []).filter((row) => wanted.has(row.structure_node_id)).map((row) => ({ ...row, start_byte: Number(row.start_byte), end_byte: Number(row.end_byte) })),
    issues: (tables.product_issues || []).filter((row) => wanted.has(row.structure_node_id)).map((row) => row.payload || row),
    coverage_assertions: [],
  };
}

function usd(microusd) {
  return `$${((Number(microusd) || 0) / 1e6).toFixed(2)}`;
}

// The ablation table: one row per variant and section, the baseline row
// from the stored calls.
function renderAblationTable(ablations) {
  const lines = [];
  lines.push('| Variant | Section | Facts valid (held) | Matched / partial / unmatched of stored | New | Fresh in | Read | Write | Output | Seconds | Cost | Note |');
  lines.push('| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |');
  const seenStored = new Set();
  for (const ablation of ablations) {
    if (ablation.not_run) {
      lines.push(`| ${ablation.variant} | all | not run | | | | | | | | | ${ablation.not_run} |`);
      continue;
    }
    for (const section of ablation.sections) {
      if (!seenStored.has(section.section_reference) && section.stored_extraction) {
        seenStored.add(section.section_reference);
        const stored = section.stored_extraction;
        lines.push(`| stored run | ${section.section_reference} | ${section.stored_facts.valid} (${section.stored_facts.held}) | | | ${stored.fresh_input_tokens.toLocaleString('en-US')} | ${stored.cache_read_tokens.toLocaleString('en-US')} | ${stored.cache_write_tokens.toLocaleString('en-US')} | ${stored.output_tokens.toLocaleString('en-US')} | ${(stored.duration_ms / 1000).toFixed(0)} | ${usd(stored.cost_microusd)} | the committed attempt's extraction calls as stored (${stored.model_ids.join(', ')}); at claude-opus-5-5 rates $${stored.repriced_opus_5_5_usd} |`);
      }
      if (section.error) { lines.push(`| ${ablation.variant} | ${section.section_reference} | failed | | | | | | | | | ${section.error.message} |`); continue; }
      const c = section.comparison.counts;
      const e = section.extraction;
      const routing = section.stored_routing_families && section.routing_families && JSON.stringify([...section.routing_families].sort()) !== JSON.stringify([...section.stored_routing_families].sort()) ? ` routing differs: ${section.routing_families.join(', ')} (stored ${section.stored_routing_families.join(', ')})` : '';
      const thinking = Number.isInteger(e.thinking_tokens) ? ` thinking ${e.thinking_tokens.toLocaleString('en-US')} of ${e.output_tokens.toLocaleString('en-US')} output (${Math.round((e.thinking_share || 0) * 100)}%, ${e.thinking_source || 'measured'})` : (e.live_calls ? ' thinking not reported' : '');
      const listCost = Number.isInteger(e.list_cost_microusd) ? ` at list ${usd(e.list_cost_microusd)}` : '';
      const providerNotes = (ablation.provider_notes || []).length ? ` ${ablation.provider_notes.join('; ')}` : '';
      const routingLive = e.routing_live_calls ? ` routing and residual ${e.routing_live_calls} live` : '';
      const routedBy = section.routing_source === 'DETERMINISTIC' ? ' routed by the words, no routing call' : '';
      lines.push(`| ${ablation.variant} | ${section.section_reference} | ${section.facts.valid} (${section.facts.held}) | ${c.matched} / ${c.partial} / ${c.unmatched} of ${c.stored} | ${c.new} | ${e.fresh_input_tokens.toLocaleString('en-US')} | ${e.cache_read_tokens.toLocaleString('en-US')} | ${e.cache_write_tokens.toLocaleString('en-US')} | ${e.output_tokens.toLocaleString('en-US')} | ${(e.duration_ms / 1000).toFixed(0)} | ${usd(e.cost_microusd)}${listCost} | ${e.live_calls ? `${e.live_calls} live` : 'replayed'}${routingLive}${e.model_ids.length ? ` (${e.model_ids.join(', ')})` : ''}${thinking}${routing}${routedBy}${providerNotes}${section.lean_note ? ` ${section.lean_note}` : ''} |`);
    }
  }
  return lines.join('\n');
}

module.exports = { ABLATION_VARIANTS, analysisFromResults, analysisFromStoredRows, compareFacts, createRecorder, createVariantModel, renderAblationTable, repriced, runSectionAblation, thinkingOf, usageOfCalls, variantAvailability };
