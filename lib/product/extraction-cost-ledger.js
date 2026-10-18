'use strict';

// Work package E1 (plan finding (167); implementer E, findings from (180)).
// Ben, 2026-10-18: "do you think it is worth spooling an ageng to look at the
// cost of extractions/number of runs because it seems SO high ... I'm
// thinking like a 10-100x reduciton in cost"; "I agree but I'd say get AS
// much cost reduction and increase in speed as possible." Standing rule:
// "everything to be driven by coding and not just a layer on top so all
// edits need to be repeatable across corpus".
//
// The ledger of one analysis run, computed from its stored rows alone
// (lib/product/run-rows.js: product_model_calls, product_section_work,
// product_source_closures, product_source_spans, product_proposals,
// product_fact_components, product_analysis_runs): what every call cost
// in tokens, dollars and seconds; which bytes of the agreement were sent
// how many times; what the output tokens were spent on; what the failed
// attempts cost; when the worker was idle; the floor (read the agreement
// once, write the facts once) and the ratio to it. The same numbers feed
// the per-run cost gate (runCostMetrics, assertNoUnexplainedRise). Pure
// functions; no database or model access.

const { ANTHROPIC_API_CACHE_TTL, ANTHROPIC_API_PRICES } = require('./product-model-config');

const LEDGER_VERSION = 'PRODUCT_EXTRACTION_COST_LEDGER/V1';
const FAILURE_RESPONSE = 'PRODUCT_MODEL_FAILURE_RESPONSE/V1';

function integer(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function plainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseJsonObject(text) {
  if (typeof text !== 'string') return null;
  const stripped = text.replace(/^\s*```(?:json)?\s*/, '').replace(/\s*```\s*$/, '');
  if (!/^\s*\{/.test(stripped)) return null;
  try {
    const parsed = JSON.parse(stripped);
    return plainObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// The request as the pipeline built it ({ call_kind, prompt_version,
// request }) from the request a call stored, whichever provider stored it:
// the API provider's two text blocks (the stable block under the cache
// breakpoint, then the section block; lib/product/anthropic-api-model.js
// splitRequestForCache), the CLI providers' one JSON string, or the plain
// request object a recorded or synthetic adapter keeps. The split is by
// key, so joining the blocks gives the request back exactly. Used by the
// replay harness to key a stored response to a rebuilt request.
function pipelineRequestOf(call) {
  const stored = call?.request;
  const message = plainObject(stored) && Array.isArray(stored.messages) ? stored.messages[0] : null;
  if (message && Array.isArray(message.content)) {
    // The cached-agreement profile's agreement block is stored as a marker
    // ({ agreement_block }) and is not part of the request.
    const blocks = message.content.filter((block) => block && block.type === 'text').map((block) => parseJsonObject(block.text) || {})
      .filter((block) => !(Object.keys(block).length === 1 && block.agreement_block));
    const merged = Object.assign({}, ...blocks);
    const { call_kind: callKind, prompt_version: promptVersion, ...request } = merged;
    return {
      call_kind: callKind || call.call_kind,
      prompt_version: promptVersion || call.prompt_version,
      request,
      layout: 'API_BLOCKS',
      stable_bytes: Buffer.byteLength(String(message.content[0]?.text || ''), 'utf8'),
      section_bytes: Buffer.byteLength(String(message.content[1]?.text || ''), 'utf8'),
      stable_text: message.content[0]?.text || '',
    };
  }
  if (message && typeof message.content === 'string') {
    const parsed = parseJsonObject(message.content) || {};
    const { call_kind: callKind, prompt_version: promptVersion, ...request } = parsed;
    return {
      call_kind: callKind || call.call_kind,
      prompt_version: promptVersion || call.prompt_version,
      request,
      layout: 'CLI_STRING',
      stable_bytes: 0,
      section_bytes: Buffer.byteLength(message.content, 'utf8'),
      stable_text: '',
    };
  }
  if (plainObject(stored)) {
    const { call_kind: callKind, prompt_version: promptVersion, ...request } = stored;
    return {
      call_kind: callKind || call.call_kind,
      prompt_version: promptVersion || call.prompt_version,
      request: callKind || promptVersion ? request : stored,
      layout: 'PLAIN',
      stable_bytes: 0,
      section_bytes: Buffer.byteLength(JSON.stringify(stored), 'utf8'),
      stable_text: '',
    };
  }
  return { call_kind: call?.call_kind, prompt_version: call?.prompt_version, request: {}, layout: 'UNKNOWN', stable_bytes: 0, section_bytes: 0, stable_text: '' };
}

// The response text a call stored (the model's answer as text), whichever
// provider stored it: the API message's text blocks joined, the CLI's
// content, a failure record's raw response, or a plain response object.
function responseTextOf(call) {
  const response = call?.response;
  if (!plainObject(response)) return typeof response === 'string' ? response : '';
  const message = response.schema_version === FAILURE_RESPONSE ? response.raw_response : response;
  if (!plainObject(message)) return '';
  if (Array.isArray(message.content)) {
    return message.content.filter((block) => block && block.type === 'text' && typeof block.text === 'string').map((block) => block.text).join('');
  }
  if (typeof message.content === 'string') return message.content;
  if (typeof message.result === 'string') return message.result;
  return JSON.stringify(message);
}

function isFailedCall(call) {
  return plainObject(call?.response) && call.response.schema_version === FAILURE_RESPONSE;
}

// One call's usage: fresh (uncached) input, cache reads and writes, output,
// the part it was for, how long it took and when it started.
function callUsage(call) {
  const response = plainObject(call?.response) ? call.response : {};
  const message = response.schema_version === FAILURE_RESPONSE ? (plainObject(response.raw_response) ? response.raw_response : {}) : response;
  const usage = plainObject(message.usage) ? message.usage : {};
  const fresh = integer(usage.input_tokens);
  const read = integer(usage.cache_read_input_tokens);
  const written = integer(usage.cache_creation_input_tokens);
  const breakdown = plainObject(usage.cache_creation) ? usage.cache_creation : null;
  const thinking = integer(usage.output_tokens_details?.thinking_tokens) || null;
  const request = pipelineRequestOf(call);
  const part = request.request?.source_closure?.extraction_part;
  const durationMs = integer(call.duration_ms);
  const endedAt = call.created_at ? new Date(call.created_at).getTime() : null;
  return {
    model_call_id: call.model_call_id,
    structure_node_id: call.structure_node_id,
    call_kind: call.call_kind,
    model_id: call.model_id,
    failed: isFailedCall(call),
    failure_code: isFailedCall(call) ? (response.validation_error?.code || response.validation_error?.message || response.status) : null,
    input_tokens: integer(call.input_tokens),
    fresh_input_tokens: fresh,
    cache_read_tokens: read,
    cache_write_tokens: written,
    cache_write_5m_tokens: breakdown ? integer(breakdown.ephemeral_5m_input_tokens) : 0,
    cache_write_1h_tokens: breakdown ? integer(breakdown.ephemeral_1h_input_tokens) : 0,
    output_tokens: integer(call.output_tokens),
    thinking_tokens: thinking,
    cost_microusd: integer(call.cost_microusd),
    duration_ms: durationMs,
    started_at: endedAt === null ? null : endedAt - durationMs,
    ended_at: endedAt,
    part: plainObject(part) ? integer(part.part) : null,
    part_of: plainObject(part) ? integer(part.of) : null,
    stable_bytes: request.stable_bytes,
    section_bytes: request.section_bytes,
    stop_reason: message.stop_reason || null,
    request,
  };
}

function emptyBucket() {
  return {
    calls: 0, failed_calls: 0, input_tokens: 0, fresh_input_tokens: 0, cache_read_tokens: 0, cache_write_tokens: 0,
    output_tokens: 0, thinking_tokens: 0, cost_microusd: 0, duration_ms: 0, stable_block_bytes: 0, section_block_bytes: 0,
  };
}

function addToBucket(bucket, usage) {
  bucket.calls += 1;
  if (usage.failed) bucket.failed_calls += 1;
  for (const key of ['input_tokens', 'fresh_input_tokens', 'cache_read_tokens', 'cache_write_tokens', 'output_tokens', 'cost_microusd', 'duration_ms']) {
    bucket[key] += usage[key];
  }
  bucket.stable_block_bytes += usage.stable_bytes;
  bucket.section_block_bytes += usage.section_bytes;
  bucket.thinking_tokens += usage.thinking_tokens || 0;
}

// The spans a call sent, by role, from the request as the pipeline built
// it: an extraction's closure (operative, chapeau, definitions,
// cross-references, the full section when its text was sent), a routing
// call's section, a residual pass's paragraphs (whose bytes come from the
// run's span rows, by id).
function sentSpans(request, spansById) {
  const out = [];
  const push = (role, span) => {
    const start = Number(span?.start_byte);
    const end = Number(span?.end_byte);
    if (Number.isSafeInteger(start) && Number.isSafeInteger(end) && end > start) out.push({ role, start, end, bytes: Buffer.byteLength(String(span.exact_text ?? ''), 'utf8') });
  };
  const body = request.request || {};
  const closure = body.source_closure;
  if (plainObject(closure)) {
    for (const role of ['operative', 'chapeau', 'definitions', 'cross_references']) {
      for (const span of Array.isArray(closure[role]) ? closure[role] : []) push(role, span);
    }
    if (plainObject(closure.full_section) && closure.full_section.exact_text) push('full_section', closure.full_section);
  }
  if (plainObject(body.section)) push('routing_section', body.section);
  for (const paragraph of Array.isArray(body.paragraphs) ? body.paragraphs : []) {
    const span = spansById.get(paragraph?.source_span_id);
    if (span) push('residual_paragraphs', { ...span, exact_text: paragraph.exact_text ?? span.exact_text });
    else if (typeof paragraph?.exact_text === 'string') out.push({ role: 'residual_paragraphs', start: null, end: null, bytes: Buffer.byteLength(paragraph.exact_text, 'utf8') });
  }
  return out;
}

// How many times each agreement byte was sent: a sweep over every span
// every call sent, bucketed by depth. byte_sends is bytes times depth.
function bytesSentHistogram(intervals) {
  const events = [];
  for (const { start, end } of intervals) {
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || end <= start) continue;
    events.push([start, 1], [end, -1]);
  }
  events.sort((left, right) => left[0] - right[0] || left[1] - right[1]);
  const byDepth = new Map();
  let depth = 0;
  for (let index = 0; index < events.length; index += 1) {
    const [position, delta] = events[index];
    depth += delta;
    const next = events[index + 1];
    if (!next || next[0] <= position) continue;
    byDepth.set(depth, (byDepth.get(depth) || 0) + (next[0] - position));
  }
  const buckets = [
    { bucket: '0', min: 0, max: 0 }, { bucket: '1-2', min: 1, max: 2 }, { bucket: '3-5', min: 3, max: 5 }, { bucket: '6-10', min: 6, max: 10 },
    { bucket: '11-20', min: 11, max: 20 }, { bucket: '21-50', min: 21, max: 50 }, { bucket: '51-100', min: 51, max: 100 }, { bucket: '>100', min: 101, max: Infinity },
  ].map((entry) => ({ ...entry, bytes: 0, byte_sends: 0, max_depth: null }));
  let bytesCovered = 0;
  let byteSends = 0;
  for (const [count, bytes] of byDepth) {
    const bucket = buckets.find((entry) => count >= entry.min && count <= entry.max);
    bucket.bytes += bytes;
    bucket.byte_sends += bytes * count;
    bucket.max_depth = Math.max(bucket.max_depth ?? 0, count);
    if (count > 0) { bytesCovered += bytes; byteSends += bytes * count; }
  }
  return {
    bytes_covered: bytesCovered,
    byte_sends: byteSends,
    mean_sends_per_byte: bytesCovered ? Number((byteSends / bytesCovered).toFixed(1)) : 0,
    buckets: buckets.filter((entry) => entry.bytes > 0).map(({ min: _min, max: _max, ...entry }) => entry),
  };
}

// What the output tokens were spent on: the proposals' statements, roles,
// evidence quotes, component trees (quotes, span ids, labels), headlines,
// conclusions, and the response's groups, links and coverage, measured in
// bytes of the response text as the model wrote it.
function outputComposition(usages) {
  const totals = {
    responses: 0, text_bytes: 0, proposals: 0, statement: 0, roles: 0, evidence_quotes: 0, evidence_quote_text: 0, evidence_quote_count: 0,
    components: 0, component_nodes: 0, component_quote_text: 0, component_span_ids: 0, component_labels: 0,
    headline: 0, conclusions: 0, non_proposal: 0,
  };
  const walk = (nodes, visit) => {
    for (const node of Array.isArray(nodes) ? nodes : []) {
      if (!plainObject(node)) continue;
      visit(node);
      walk(node.children, visit);
    }
  };
  const bytesOf = (value) => (value === undefined ? 0 : Buffer.byteLength(typeof value === 'string' ? value : JSON.stringify(value), 'utf8'));
  for (const usage of usages) {
    if (usage.call_kind !== 'EXTRACTION' || usage.failed) continue;
    const text = usage.response_text;
    const parsed = parseJsonObject(text);
    if (!parsed) continue;
    totals.responses += 1;
    totals.text_bytes += Buffer.byteLength(text, 'utf8');
    for (const proposal of Array.isArray(parsed.proposals) ? parsed.proposals : []) {
      if (!plainObject(proposal)) continue;
      totals.proposals += 1;
      totals.statement += bytesOf(proposal.statement);
      totals.roles += bytesOf(proposal.roles);
      totals.evidence_quotes += bytesOf(proposal.evidence_quotes);
      for (const quote of Array.isArray(proposal.evidence_quotes) ? proposal.evidence_quotes : []) {
        totals.evidence_quote_count += 1;
        totals.evidence_quote_text += bytesOf(quote?.quote);
      }
      totals.components += bytesOf(proposal.components);
      walk(proposal.components, (node) => {
        totals.component_nodes += 1;
        totals.component_quote_text += bytesOf(node.quote);
        totals.component_span_ids += bytesOf(node.source_span_id);
        totals.component_labels += bytesOf(node.label);
      });
      totals.headline += bytesOf(proposal.headline);
      totals.conclusions += bytesOf(proposal.conclusions);
    }
    for (const key of ['groups', 'links', 'cross_section_links', 'coverage', 'fact_type_coverage', 'coverage_reason']) totals.non_proposal += bytesOf(parsed[key]);
  }
  return totals;
}

// The stable block (the cache's unit) by key, and the cache's entries: how
// many distinct stable blocks the run sent per call kind, how many were
// used once (a write with no read to pay for it), how many writes it made.
function stableBlockProfile(usages) {
  const byKind = {};
  for (const usage of usages) {
    if (usage.request.layout !== 'API_BLOCKS') continue;
    const kind = byKind[usage.call_kind] || (byKind[usage.call_kind] = { calls: 0, calls_without_cache: 0, key_bytes: {}, sets: new Map() });
    kind.calls += 1;
    if (usage.cache_read_tokens === 0 && usage.cache_write_tokens === 0) kind.calls_without_cache += 1;
    const stable = parseJsonObject(usage.request.stable_text) || {};
    for (const [key, value] of Object.entries(stable)) {
      kind.key_bytes[key] = (kind.key_bytes[key] || 0) + Buffer.byteLength(JSON.stringify(value), 'utf8');
    }
    const hash = require('crypto').createHash('sha256').update(usage.request.stable_text).digest('hex').slice(0, 16);
    const set = kind.sets.get(hash) || { calls: 0, writes: 0, write_tokens: 0, read_tokens: 0, first_started_at: usage.started_at, last_started_at: usage.started_at };
    set.calls += 1;
    if (usage.cache_write_tokens > 0) { set.writes += 1; set.write_tokens += usage.cache_write_tokens; }
    set.read_tokens += usage.cache_read_tokens;
    set.first_started_at = Math.min(set.first_started_at ?? Infinity, usage.started_at ?? Infinity);
    set.last_started_at = Math.max(set.last_started_at ?? -Infinity, usage.started_at ?? -Infinity);
    kind.sets.set(hash, set);
  }
  return Object.fromEntries(Object.entries(byKind).map(([kind, entry]) => {
    const sets = [...entry.sets.values()];
    return [kind, {
      calls: entry.calls,
      key_bytes: Object.fromEntries(Object.entries(entry.key_bytes).sort((left, right) => right[1] - left[1])),
      distinct_sets: sets.length,
      sets_used_once: sets.filter((set) => set.calls === 1).length,
      writes: sets.reduce((sum, set) => sum + set.writes, 0),
      write_tokens: sets.reduce((sum, set) => sum + set.write_tokens, 0),
      read_tokens: sets.reduce((sum, set) => sum + set.read_tokens, 0),
      calls_without_cache: entry.calls_without_cache,
    }];
  }));
}

// The worker's timeline from the calls alone: wall clock from the first
// call's start to the last call's end, the minutes with no call in flight
// (idle: failures, restarts, the store between calls), with one call, with
// two or more (the hosted worker runs two section loops), and the gaps
// over two minutes with their clock times.
function timeline(usages) {
  const events = [];
  for (const usage of usages) {
    if (usage.started_at === null || usage.ended_at === null) continue;
    events.push([usage.started_at, 1], [usage.ended_at, -1]);
  }
  if (events.length === 0) return null;
  events.sort((left, right) => left[0] - right[0] || left[1] - right[1]);
  const byDepth = new Map();
  const gaps = [];
  let depth = 0;
  for (let index = 0; index < events.length; index += 1) {
    const [at, delta] = events[index];
    depth += delta;
    const next = events[index + 1];
    if (!next || next[0] <= at) continue;
    const ms = next[0] - at;
    byDepth.set(depth, (byDepth.get(depth) || 0) + ms);
    if (depth === 0 && ms > 120000) gaps.push({ from: new Date(at).toISOString(), to: new Date(next[0]).toISOString(), minutes: Number((ms / 60000).toFixed(1)) });
  }
  const minutes = (ms) => Number(((ms || 0) / 60000).toFixed(1));
  const first = events[0][0];
  const last = events[events.length - 1][0];
  let callMinutes = 0;
  for (const [count, ms] of byDepth) callMinutes += count * ms;
  return {
    first_call_started_at: new Date(first).toISOString(),
    last_call_ended_at: new Date(last).toISOString(),
    wall_minutes: minutes(last - first),
    idle_minutes: minutes(byDepth.get(0)),
    one_call_minutes: minutes(byDepth.get(1)),
    two_or_more_calls_minutes: minutes([...byDepth].filter(([count]) => count >= 2).reduce((sum, [, ms]) => sum + ms, 0)),
    max_concurrency: Math.max(0, ...byDepth.keys()),
    call_minutes: minutes(callMinutes),
    gaps_over_two_minutes: gaps,
  };
}

function priceFor(modelId) {
  const bare = String(modelId || '').split(';')[0];
  return ANTHROPIC_API_PRICES.usd_per_million[bare] || null;
}

// The floor: the agreement read once at the input rate, the facts written
// once (statement, labels, headline, conclusions, and an offset pair
// instead of each verbatim quote) at the output rate, both in tokens at
// the run's own measured bytes per token; the time floor at the run's
// measured output rate, serial (every section one after another) and
// parallel (the largest section alone, every section at once).
function floorFor({ agreementBytes, sectionBytes, outputSubstanceBytes, inputBytesPerToken, outputBytesPerToken, outputTokensPerSecond, largestSectionOutputSubstanceBytes, rates }) {
  const inputTokens = Math.round((sectionBytes || agreementBytes || 0) / (inputBytesPerToken || 4));
  const outputTokens = Math.round((outputSubstanceBytes || 0) / (outputBytesPerToken || 3));
  const largestOutputTokens = Math.round((largestSectionOutputSubstanceBytes || 0) / (outputBytesPerToken || 3));
  const cost = rates ? (inputTokens * rates.input + outputTokens * rates.output) / 1e6 : null;
  return {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cost_usd: cost === null ? null : Number(cost.toFixed(2)),
    serial_minutes: outputTokensPerSecond ? Number((outputTokens / outputTokensPerSecond / 60).toFixed(1)) : null,
    parallel_minutes: outputTokensPerSecond ? Number((largestOutputTokens / outputTokensPerSecond / 60).toFixed(1)) : null,
    basis: 'the agreement\'s section bytes read once at the input rate; the facts\' statement, labels, headline, conclusions and an offset pair per component written once at the output rate; tokens at the run\'s measured bytes per token; time at the run\'s measured output tokens per second',
  };
}

function ledgerFromRows(run, { cacheTtl = ANTHROPIC_API_CACHE_TTL } = {}) {
  const tables = run?.tables || {};
  const runRow = (tables.product_analysis_runs || [])[0] || null;
  const calls = tables.product_model_calls || [];
  const work = tables.product_section_work || [];
  const closures = tables.product_source_closures || [];
  const spans = tables.product_source_spans || [];
  const proposals = tables.product_proposals || [];
  const components = tables.product_fact_components || [];
  const spansById = new Map(spans.map((span) => [span.span_id, span]));
  const referenceByNode = new Map(closures.map((closure) => [closure.structure_node_id, closure.section_reference]));
  const sectionBytesByNode = new Map();
  for (const closure of closures) {
    const full = spansById.get(closure.payload?.full_section_span_id);
    if (full) sectionBytesByNode.set(closure.structure_node_id, Number(full.end_byte) - Number(full.start_byte));
  }
  const usages = calls.map((call) => ({ ...callUsage(call), response_text: responseTextOf(call) }));

  // Totals by call kind, and the failed calls' cost.
  const byKind = {};
  const total = emptyBucket();
  const failed = emptyBucket();
  for (const usage of usages) {
    addToBucket(byKind[usage.call_kind] || (byKind[usage.call_kind] = emptyBucket()), usage);
    addToBucket(total, usage);
    if (usage.failed) addToBucket(failed, usage);
  }

  // Calls of attempts that did not commit: every call of a section beyond
  // the ones its committed attempt made (the work row's attempt token and
  // its parts carry the committed attempt's invocation ids).
  const { sha256Hex } = require('../canonical-v2/canonical-bytes');
  const committedIds = new Set();
  for (const row of work) {
    if (!row.attempt_token) continue;
    for (const kind of ['ROUTING', 'RESIDUAL', 'EXTRACTION']) committedIds.add(sha256Hex(['PRODUCT_MODEL_INVOCATION/V1', row.attempt_token, kind].join('\x1f')));
    for (let part = 1; part <= 64; part += 1) committedIds.add(sha256Hex(['PRODUCT_MODEL_INVOCATION/V1', `${row.attempt_token}:part-${part}`, 'EXTRACTION'].join('\x1f')));
  }
  const uncommitted = emptyBucket();
  const callsById = new Map(calls.map((call) => [call.model_call_id, call]));
  for (const usage of usages) {
    const call = callsById.get(usage.model_call_id);
    if (call?.invocation_id && committedIds.size > 0 && !committedIds.has(call.invocation_id)) addToBucket(uncommitted, usage);
  }

  // Per section.
  const sections = [];
  const usagesByNode = new Map();
  for (const usage of usages) {
    if (!usagesByNode.has(usage.structure_node_id)) usagesByNode.set(usage.structure_node_id, []);
    usagesByNode.get(usage.structure_node_id).push(usage);
  }
  const factsByNode = new Map();
  for (const proposal of proposals) {
    const entry = factsByNode.get(proposal.structure_node_id) || { facts: 0, valid: 0 };
    entry.facts += 1;
    if (proposal.validation_status === 'VALID' || proposal.payload?.validation_status === 'VALID') entry.valid += 1;
    factsByNode.set(proposal.structure_node_id, entry);
  }
  const workByNode = new Map(work.map((row) => [row.node_id, row]));
  const nodes = [...new Set([...usagesByNode.keys(), ...work.map((row) => row.node_id)])];
  for (const nodeId of nodes) {
    const list = usagesByNode.get(nodeId) || [];
    const bucket = emptyBucket();
    for (const usage of list) addToBucket(bucket, usage);
    const row = workByNode.get(nodeId);
    const started = list.map((usage) => usage.started_at).filter((value) => value !== null);
    const ended = list.map((usage) => usage.ended_at).filter((value) => value !== null);
    sections.push({
      structure_node_id: nodeId,
      section_reference: referenceByNode.get(nodeId) || null,
      authored_order: row?.authored_order ?? null,
      section_bytes: sectionBytesByNode.get(nodeId) ?? null,
      attempts: row?.attempts ?? null,
      failures_recorded: Array.isArray(row?.error_history) ? row.error_history.length : 0,
      routing_calls: list.filter((usage) => usage.call_kind === 'ROUTING').length,
      residual_calls: list.filter((usage) => usage.call_kind === 'RESIDUAL').length,
      extraction_calls: list.filter((usage) => usage.call_kind === 'EXTRACTION').length,
      parts: Math.max(0, ...list.map((usage) => usage.part_of || 0)) || null,
      ...bucket,
      first_call_started_at: started.length ? new Date(Math.min(...started)).toISOString() : null,
      last_call_ended_at: ended.length ? new Date(Math.max(...ended)).toISOString() : null,
      elapsed_minutes: started.length && ended.length ? Number(((Math.max(...ended) - Math.min(...started)) / 60000).toFixed(1)) : null,
      facts: factsByNode.get(nodeId)?.facts || 0,
      valid_facts: factsByNode.get(nodeId)?.valid || 0,
    });
  }
  sections.sort((left, right) => (left.authored_order ?? Infinity) - (right.authored_order ?? Infinity));

  // What the section blocks carried, by role, and how many times each byte went.
  const sentByRole = {};
  const intervals = [];
  for (const usage of usages) {
    for (const span of sentSpans(usage.request, spansById)) {
      const role = sentByRole[span.role] || (sentByRole[span.role] = { spans: 0, bytes: 0 });
      role.spans += 1;
      role.bytes += span.bytes;
      if (span.start !== null) intervals.push({ start: span.start, end: span.end });
    }
  }
  const histogram = bytesSentHistogram(intervals);
  const agreementBytes = spans.length ? Math.max(...spans.map((span) => Number(span.end_byte))) : null;
  const sectionBytesSum = [...sectionBytesByNode.values()].reduce((sum, bytes) => sum + bytes, 0);

  // Output composition and the floor.
  const output = outputComposition(usages);
  const storedSubstance = {
    component_quote_bytes: components.reduce((sum, row) => sum + Buffer.byteLength(String(row.text || ''), 'utf8'), 0),
    component_label_bytes: components.reduce((sum, row) => sum + Buffer.byteLength(String(row.label || ''), 'utf8'), 0),
    components: components.length,
    statement_bytes: proposals.reduce((sum, row) => sum + Buffer.byteLength(String(row.payload?.statement || ''), 'utf8'), 0),
    headline_bytes: proposals.reduce((sum, row) => sum + Buffer.byteLength(JSON.stringify(row.payload?.headline || ''), 'utf8'), 0),
    conclusions_bytes: proposals.reduce((sum, row) => sum + Buffer.byteLength(JSON.stringify(row.payload?.conclusions || ''), 'utf8'), 0),
  };
  const extraction = byKind.EXTRACTION || emptyBucket();
  const inputBytesPerToken = extraction.input_tokens ? (extraction.stable_block_bytes + extraction.section_block_bytes) / extraction.input_tokens : null;
  const reportedThinking = extraction.thinking_tokens || 0;
  // Visible output per token: measured when the provider reports the
  // thinking split (the CLI path), else the share of a run that does
  // (Metsera generation 8: 1,249,344 of 3,512,309 extraction output
  // tokens were thinking, 36 per cent), stated as an assumption.
  const thinkingShare = reportedThinking && extraction.output_tokens ? reportedThinking / extraction.output_tokens : 0.356;
  const visibleOutputTokens = Math.round(extraction.output_tokens * (1 - thinkingShare));
  const outputBytesPerToken = visibleOutputTokens ? output.text_bytes / visibleOutputTokens : null;
  const outputSubstanceBytes = storedSubstance.statement_bytes + storedSubstance.component_label_bytes + storedSubstance.headline_bytes
    + storedSubstance.conclusions_bytes + storedSubstance.components * 12;
  const largestSection = sections.reduce((best, section) => (section.output_tokens > (best?.output_tokens || 0) ? section : best), null);
  const outputTokensPerSecond = extraction.duration_ms ? extraction.output_tokens / (extraction.duration_ms / 1000) : null;
  const rates = priceFor(usages.find((usage) => usage.call_kind === 'EXTRACTION')?.model_id) || priceFor('claude-opus-5');
  const floor = floorFor({
    agreementBytes, sectionBytes: sectionBytesSum, outputSubstanceBytes, inputBytesPerToken, outputBytesPerToken, outputTokensPerSecond,
    largestSectionOutputSubstanceBytes: largestSection && extraction.output_tokens ? outputSubstanceBytes * (largestSection.output_tokens / extraction.output_tokens) : 0,
    rates,
  });
  const costUsd = total.cost_microusd / 1e6;
  const time = timeline(usages);
  const validFacts = proposals.filter((row) => row.validation_status === 'VALID' || row.payload?.validation_status === 'VALID').length;
  const metrics = {
    cost_usd: Number(costUsd.toFixed(2)),
    facts: proposals.length,
    valid_facts: validFacts,
    cost_per_valid_fact_usd: validFacts ? Number((costUsd / validFacts).toFixed(4)) : null,
    input_tokens_per_agreement_byte: sectionBytesSum ? Number((total.input_tokens / sectionBytesSum).toFixed(2)) : null,
    output_tokens_per_agreement_byte: sectionBytesSum ? Number((total.output_tokens / sectionBytesSum).toFixed(2)) : null,
    output_tokens_per_valid_fact: validFacts ? Math.round(total.output_tokens / validFacts) : null,
    call_minutes_per_section: sections.length ? Number((total.duration_ms / 60000 / sections.length).toFixed(2)) : null,
    wall_minutes_per_section: time && sections.length ? Number((time.wall_minutes / sections.length).toFixed(2)) : null,
    calls_per_section: sections.length ? Number((total.calls / sections.length).toFixed(2)) : null,
    sends_per_agreement_byte: histogram.mean_sends_per_byte,
    failed_call_cost_usd: Number((failed.cost_microusd / 1e6).toFixed(2)),
    uncommitted_attempt_cost_usd: Number((uncommitted.cost_microusd / 1e6).toFixed(2)),
  };
  return {
    schema_version: LEDGER_VERSION,
    run_id: run.run_id,
    run: runRow ? {
      status: runRow.status, source_generation: runRow.source_generation, provider_id: runRow.model_config?.provider_id || null,
      prompt_bundle_version: runRow.prompt_bundle_version, retrieval_url: runRow.retrieval_url, created_at: runRow.created_at, updated_at: runRow.updated_at,
    } : null,
    cache_ttl: cacheTtl,
    rates_usd_per_million: rates,
    agreement: { bytes_spanned: agreementBytes, section_bytes: sectionBytesSum, sections: sections.length },
    totals: { ...total, by_call_kind: byKind, failed, uncommitted_attempts: uncommitted, cost_usd: Number(costUsd.toFixed(2)) },
    sections,
    sent: { by_role: sentByRole, histogram },
    stable_blocks: stableBlockProfile(usages),
    output: { ...output, stored_substance: storedSubstance, thinking_share: Number(thinkingShare.toFixed(3)), thinking_share_measured: Boolean(reportedThinking), visible_output_tokens: visibleOutputTokens },
    rates_measured: {
      input_bytes_per_token: inputBytesPerToken === null ? null : Number(inputBytesPerToken.toFixed(2)),
      output_bytes_per_visible_token: outputBytesPerToken === null ? null : Number(outputBytesPerToken.toFixed(2)),
      output_tokens_per_second: outputTokensPerSecond === null ? null : Number(outputTokensPerSecond.toFixed(1)),
    },
    timeline: time,
    floor,
    ratio_to_floor: {
      cost: floor.cost_usd ? Number((costUsd / floor.cost_usd).toFixed(1)) : null,
      input_tokens: floor.input_tokens ? Number((total.input_tokens / floor.input_tokens).toFixed(1)) : null,
      output_tokens: floor.output_tokens ? Number((total.output_tokens / floor.output_tokens).toFixed(1)) : null,
      wall_minutes_to_serial_floor: floor.serial_minutes && time ? Number((time.wall_minutes / floor.serial_minutes).toFixed(1)) : null,
      wall_minutes_to_parallel_floor: floor.parallel_minutes && time ? Number((time.wall_minutes / floor.parallel_minutes).toFixed(1)) : null,
    },
    metrics,
  };
}

// The per-run gate (work package E1, item 5): the figures a run is judged
// on, and the rule. A rise over the baseline beyond the tolerance fails
// unless an explanation names the metric (the plan finding that accepted
// it). Lower is never a failure.
const GATE_METRICS = Object.freeze({
  cost_per_valid_fact_usd: 0.15,
  input_tokens_per_agreement_byte: 0.15,
  output_tokens_per_agreement_byte: 0.15,
  output_tokens_per_valid_fact: 0.15,
  call_minutes_per_section: 0.25,
  calls_per_section: 0.10,
  sends_per_agreement_byte: 0.15,
});

function runCostMetrics(ledger) {
  return { ...ledger.metrics };
}

function assertNoUnexplainedRise(metrics, baseline, { tolerances = GATE_METRICS, explanations = {} } = {}) {
  const failures = [];
  const rises = [];
  for (const [metric, tolerance] of Object.entries(tolerances)) {
    const before = baseline?.[metric];
    const after = metrics?.[metric];
    if (!Number.isFinite(before) || !Number.isFinite(after) || before <= 0) continue;
    const change = (after - before) / before;
    if (change <= tolerance) continue;
    const entry = { metric, baseline: before, actual: after, rise: Number((change * 100).toFixed(1)), tolerance_percent: tolerance * 100 };
    if (typeof explanations[metric] === 'string' && explanations[metric].trim()) rises.push({ ...entry, explanation: explanations[metric] });
    else failures.push(entry);
  }
  if (failures.length) {
    const error = new Error(`RUN_COST_RISE_UNEXPLAINED: ${failures.map((entry) => `${entry.metric} ${entry.baseline} -> ${entry.actual} (+${entry.rise}%, tolerance ${entry.tolerance_percent}%)`).join('; ')}`);
    error.code = 'RUN_COST_RISE_UNEXPLAINED';
    error.failures = failures;
    throw error;
  }
  return { ok: true, explained_rises: rises };
}

function usd(microusd) {
  return `$${(integer(microusd) / 1e6).toFixed(2)}`;
}

function thousands(value) {
  return Number(value || 0).toLocaleString('en-US');
}

function renderLedger(ledger) {
  const lines = [];
  const run = ledger.run || {};
  lines.push(`## Run ${ledger.run_id}${run.source_generation ? ` (generation ${run.source_generation})` : ''}`);
  lines.push('');
  lines.push(`Provider ${run.provider_id || '?'}, bundle ${run.prompt_bundle_version || '?'}, status ${run.status || '?'}. Agreement: ${thousands(ledger.agreement.section_bytes)} section bytes over ${ledger.agreement.sections} sections (${thousands(ledger.agreement.bytes_spanned)} bytes spanned). Rates: ${JSON.stringify(ledger.rates_usd_per_million)}.`);
  lines.push('');
  lines.push('### Tokens by call kind');
  lines.push('');
  lines.push('| Call kind | Calls | Failed | Fresh input | Cache read | Cache write | Output | Cost | Call minutes |');
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const [kind, bucket] of [...Object.entries(ledger.totals.by_call_kind), ['Total', ledger.totals]]) {
    lines.push(`| ${kind} | ${bucket.calls} | ${bucket.failed_calls} | ${thousands(bucket.fresh_input_tokens)} | ${thousands(bucket.cache_read_tokens)} | ${thousands(bucket.cache_write_tokens)} | ${thousands(bucket.output_tokens)} | ${usd(bucket.cost_microusd)} | ${(bucket.duration_ms / 60000).toFixed(0)} |`);
  }
  lines.push(`| Failed calls | ${ledger.totals.failed.calls} | | ${thousands(ledger.totals.failed.fresh_input_tokens)} | ${thousands(ledger.totals.failed.cache_read_tokens)} | ${thousands(ledger.totals.failed.cache_write_tokens)} | ${thousands(ledger.totals.failed.output_tokens)} | ${usd(ledger.totals.failed.cost_microusd)} | ${(ledger.totals.failed.duration_ms / 60000).toFixed(0)} |`);
  lines.push(`| Calls of attempts that did not commit | ${ledger.totals.uncommitted_attempts.calls} | | ${thousands(ledger.totals.uncommitted_attempts.fresh_input_tokens)} | ${thousands(ledger.totals.uncommitted_attempts.cache_read_tokens)} | ${thousands(ledger.totals.uncommitted_attempts.cache_write_tokens)} | ${thousands(ledger.totals.uncommitted_attempts.output_tokens)} | ${usd(ledger.totals.uncommitted_attempts.cost_microusd)} | ${(ledger.totals.uncommitted_attempts.duration_ms / 60000).toFixed(0)} |`);
  lines.push('');
  lines.push('### What the calls sent (bytes of agreement text, by role)');
  lines.push('');
  lines.push('| Role | Spans | Bytes |');
  lines.push('| --- | ---: | ---: |');
  for (const [role, entry] of Object.entries(ledger.sent.by_role).sort((left, right) => right[1].bytes - left[1].bytes)) lines.push(`| ${role} | ${thousands(entry.spans)} | ${thousands(entry.bytes)} |`);
  lines.push('');
  lines.push(`### How many times each agreement byte was sent (mean ${ledger.sent.histogram.mean_sends_per_byte}, ${thousands(ledger.sent.histogram.byte_sends)} byte-sends over ${thousands(ledger.sent.histogram.bytes_covered)} bytes)`);
  lines.push('');
  lines.push('| Times sent | Bytes | Byte-sends | Deepest |');
  lines.push('| --- | ---: | ---: | ---: |');
  for (const bucket of ledger.sent.histogram.buckets) lines.push(`| ${bucket.bucket} | ${thousands(bucket.bytes)} | ${thousands(bucket.byte_sends)} | ${bucket.max_depth} |`);
  lines.push('');
  lines.push('### The stable block (the cache\'s unit), by key, and the cache entries');
  lines.push('');
  for (const [kind, entry] of Object.entries(ledger.stable_blocks)) {
    lines.push(`${kind}: ${entry.calls} calls, ${entry.distinct_sets} distinct stable blocks, ${entry.sets_used_once} used once, ${entry.writes} writes (${thousands(entry.write_tokens)} tokens written, ${thousands(entry.read_tokens)} read). Bytes by key over the run: ${Object.entries(entry.key_bytes).map(([key, bytes]) => `${key} ${thousands(bytes)}`).join('; ')}.`);
    lines.push('');
  }
  const output = ledger.output;
  lines.push(`### What the output tokens were spent on (${thousands(output.text_bytes)} bytes of response text over ${output.responses} extraction answers, ${output.proposals} proposals; thinking share ${(output.thinking_share * 100).toFixed(0)}%${output.thinking_share_measured ? ', reported' : ', assumed from Metsera generation 8'})`);
  lines.push('');
  lines.push('| Part of the answer | Bytes | Share |');
  lines.push('| --- | ---: | ---: |');
  const share = (bytes) => (output.text_bytes ? `${((bytes / output.text_bytes) * 100).toFixed(0)}%` : '');
  for (const [label, bytes] of [
    ['components (the trees)', output.components], ['  of which verbatim quotes', output.component_quote_text], ['  of which 64-hex span ids', output.component_span_ids], ['  of which labels', output.component_labels],
    ['evidence_quotes (the quotes again)', output.evidence_quotes], ['roles', output.roles], ['statement', output.statement], ['conclusions', output.conclusions], ['headline', output.headline], ['groups, links, coverage', output.non_proposal],
  ]) lines.push(`| ${label} | ${thousands(bytes)} | ${share(bytes)} |`);
  lines.push('');
  const time = ledger.timeline;
  if (time) {
    lines.push('### Wall clock');
    lines.push('');
    lines.push(`${time.first_call_started_at} to ${time.last_call_ended_at}: ${time.wall_minutes} minutes of wall clock, ${time.call_minutes} call-minutes; ${time.idle_minutes} minutes with no call in flight, ${time.one_call_minutes} with one, ${time.two_or_more_calls_minutes} with two or more (deepest ${time.max_concurrency}). Gaps over two minutes: ${time.gaps_over_two_minutes.map((gap) => `${gap.from.slice(11, 16)}-${gap.to.slice(11, 16)} (${gap.minutes} min)`).join(', ') || 'none'}.`);
    lines.push('');
  }
  lines.push('### Floor and ratio');
  lines.push('');
  lines.push(`Measured: ${ledger.rates_measured.input_bytes_per_token} input bytes per token, ${ledger.rates_measured.output_bytes_per_visible_token} output bytes per visible token, ${ledger.rates_measured.output_tokens_per_second} output tokens per second. Floor: ${thousands(ledger.floor.input_tokens)} input tokens, ${thousands(ledger.floor.output_tokens)} output tokens, $${ledger.floor.cost_usd}, ${ledger.floor.serial_minutes} minutes serial, ${ledger.floor.parallel_minutes} minutes parallel (${ledger.floor.basis}). Actual: ${thousands(ledger.totals.input_tokens)} input, ${thousands(ledger.totals.output_tokens)} output, $${ledger.totals.cost_usd}, ${time ? time.wall_minutes : '?'} minutes. Ratio: cost ${ledger.ratio_to_floor.cost}x, input tokens ${ledger.ratio_to_floor.input_tokens}x, output tokens ${ledger.ratio_to_floor.output_tokens}x, wall clock ${ledger.ratio_to_floor.wall_minutes_to_serial_floor}x the serial floor and ${ledger.ratio_to_floor.wall_minutes_to_parallel_floor}x the parallel floor.`);
  lines.push('');
  lines.push('### Gate metrics');
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify(ledger.metrics, null, 2));
  lines.push('```');
  lines.push('');
  lines.push('### Per section');
  lines.push('');
  lines.push('| Section | Bytes | Attempts | R | P | E | Parts | Failed | Fresh | Read | Write | Output | Cost | Call s | Elapsed min | Facts (valid) |');
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const section of ledger.sections) {
    lines.push(`| ${section.section_reference || section.structure_node_id.slice(0, 8)} | ${thousands(section.section_bytes)} | ${section.attempts ?? ''} | ${section.routing_calls} | ${section.residual_calls} | ${section.extraction_calls} | ${section.parts || ''} | ${section.failed_calls} | ${thousands(section.fresh_input_tokens)} | ${thousands(section.cache_read_tokens)} | ${thousands(section.cache_write_tokens)} | ${thousands(section.output_tokens)} | ${usd(section.cost_microusd)} | ${(section.duration_ms / 1000).toFixed(0)} | ${section.elapsed_minutes ?? ''} | ${section.facts} (${section.valid_facts}) |`);
  }
  return lines.join('\n');
}

module.exports = {
  GATE_METRICS,
  LEDGER_VERSION,
  assertNoUnexplainedRise,
  bytesSentHistogram,
  callUsage,
  isFailedCall,
  ledgerFromRows,
  outputComposition,
  pipelineRequestOf,
  renderLedger,
  responseTextOf,
  runCostMetrics,
  sentSpans,
  timeline,
};
