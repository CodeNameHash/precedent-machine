'use strict';

// Attempt resume after a worker stop (work package D3, plan finding (142)).
// A section attempt is a sequence of model calls: routing, residual, then
// one extraction call per part. Every call is recorded as it completes
// (product_model_calls, admitted under the attempt's invocation identity:
// "<attempt token>" for routing, residual and a whole-section extraction,
// "<attempt token>:part-<n>" for a part; migrations 20260914125500 and
// 20261018143000). Until now a worker restart between parts lost them all:
// the next attempt ran the section from the start (NCS generation 5, 5.8:
// two parts done and lost to the 18:34 UTC restart, $2.69, with no error
// record because the lease recovery wrote none).
//
// The rule: a call that completed inside an earlier attempt of the same
// section is reused by a later attempt when (a) the earlier attempt ended
// in an interruption (the worker stopped, restarted, or its lease expired:
// recorded on the work row's error_history with the attempt token), or
// failed on an extraction part, in which case the calls before that part
// are reusable (every other part's when the part was thin, plan finding
// (199e)); and (b) the later attempt would send the same call: the
// same call kind, prompt version and logical request, byte for byte once
// canonicalised (so a re-split section reuses nothing: its parts differ).
// A reused call is recorded again under the new attempt's invocation
// identity with the original request and raw response, zero tokens, zero
// cost and `resumed_from_model_call_id` naming the original, so the
// committed attempt's records are complete and the spend is counted once.

const { canonicalJson, sha256Hex } = require('../canonical-v2/canonical-bytes');

const INVOCATION_VERSION = 'PRODUCT_MODEL_INVOCATION/V1';
const FAILURE_RESPONSE_VERSION = 'PRODUCT_MODEL_FAILURE_RESPONSE/V1';
const CALL_KINDS = Object.freeze(['ROUTING', 'RESIDUAL', 'EXTRACTION']);
// The reasons an attempt ends without the section having failed on its
// merits: every call it completed is reusable.
const INTERRUPTION_CODES = Object.freeze(['WORKER_STOPPED', 'WORKER_RESTART', 'SECTION_LEASE_EXPIRED']);
const WORKER_STOP_REQUESTED = 'WORKER_STOP_REQUESTED';
const MAX_PARTS = 64;

function invocationId(attemptToken, kind) {
  return sha256Hex([INVOCATION_VERSION, attemptToken, kind].join('\x1f'));
}

// Every invocation identity an attempt token can carry: the three kinds
// and the extraction parts 1 to MAX_PARTS.
function attemptInvocations(attemptToken) {
  const ids = new Map();
  for (const kind of CALL_KINDS) ids.set(invocationId(attemptToken, kind), { kind, part: null });
  for (let part = 1; part <= MAX_PARTS; part += 1) ids.set(invocationId(`${attemptToken}:part-${part}`, 'EXTRACTION'), { kind: 'EXTRACTION', part });
  return ids;
}

function parseJsonObject(text) {
  if (typeof text !== 'string') return null;
  try {
    const value = JSON.parse(text);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

// The logical request of a stored or outgoing call: what the model was
// asked, independent of the provider's wire shape. The adapters send it as
// (1) the object itself (the synthetic and in-process models), (2) one JSON
// string in messages[0].content carrying call_kind and prompt_version
// beside the request's own keys (the Claude and Codex CLIs), or (3) two
// text blocks, the stable block then the section block (the Anthropic API,
// work package 10), each a JSON object, merged here in order.
function logicalRequest(request) {
  if (!request || typeof request !== 'object') return null;
  const content = Array.isArray(request.messages) && request.messages[0] ? request.messages[0].content : undefined;
  if (typeof content === 'string') return parseJsonObject(content);
  if (Array.isArray(content)) {
    const merged = {};
    for (const block of content) {
      const parsed = block && block.type === 'text' ? parseJsonObject(block.text) : null;
      if (!parsed) return null;
      Object.assign(merged, parsed);
    }
    return merged;
  }
  return request;
}

// The identity of a call: call kind, prompt version and the canonical
// logical request (its own call_kind and prompt_version keys, which the
// CLI shapes carry inside the content, removed so every shape reads alike).
function callIdentity({ callKind, promptVersion, request }) {
  const logical = logicalRequest(request);
  if (!logical) return null;
  const { call_kind: _kind, prompt_version: _version, ...body } = logical;
  return sha256Hex(['PRODUCT_CALL_IDENTITY/V1', callKind, promptVersion, canonicalJson(body)].join('\x1f'));
}

function extractionPart(request) {
  const logical = logicalRequest(request);
  const part = logical && logical.source_closure && logical.source_closure.extraction_part;
  if (!part || typeof part !== 'object') return null;
  const number = Number(part.part);
  const of = Number(part.of);
  return Number.isInteger(number) && number >= 1 ? { part: number, of: Number.isInteger(of) && of >= 1 ? of : null } : null;
}

function isFailureRecord(call) {
  return Boolean(call && call.response && typeof call.response === 'object' && call.response.schema_version === FAILURE_RESPONSE_VERSION);
}

// What an attempt's recorded calls amount to, for the work row's record
// when the attempt ends early: the kinds done and the parts done.
function attemptProgress(calls = []) {
  const kinds = new Set();
  const parts = new Set();
  let of = null;
  for (const call of calls) {
    if (!call || isFailureRecord(call)) continue;
    kinds.add(call.call_kind);
    const part = call.call_kind === 'EXTRACTION' ? extractionPart(call.request) : null;
    if (part) {
      parts.add(part.part);
      if (part.of) of = part.of;
    }
  }
  return {
    calls: calls.length,
    kinds: CALL_KINDS.filter((kind) => kinds.has(kind)),
    parts_completed: [...parts].sort((a, b) => a - b),
    parts_total: of,
  };
}

function historyCode(entry) {
  const reason = entry && entry.reason;
  const error = entry && entry.error;
  if (reason && typeof reason === 'object' && typeof reason.code === 'string') return reason.code;
  if (error && typeof error === 'object') {
    if (typeof error.code === 'string') return error.code;
    const match = /^([A-Z][A-Z0-9_]+):/.exec(String(error.message || ''));
    if (match) return match[1];
  }
  return null;
}

// The invocation identities an earlier attempt's calls may be reused under,
// from the work row's error_history: an interrupted attempt yields every
// identity; an attempt that failed on part k yields routing, residual and
// the parts before k; any other failure yields none. Entries without an
// attempt token (written before this rule) yield none.
function resumableInvocations(errorHistory = []) {
  const eligible = new Map();
  for (const entry of Array.isArray(errorHistory) ? errorHistory : []) {
    const token = entry && typeof entry.attempt_token === 'string' ? entry.attempt_token : null;
    if (!token) continue;
    const code = historyCode(entry);
    const part = entry.error && entry.error.part && typeof entry.error.part === 'object' ? entry.error.part : null;
    const failedPart = part && Number.isInteger(Number(part.part)) ? Number(part.part) : null;
    const interrupted = INTERRUPTION_CODES.includes(code);
    if (!interrupted && !failedPart) continue;
    // Plan finding (199e): a thin part (mode 'thin', the guard of (199))
    // fails its attempt once every part has answered, so every other
    // part's call is reusable, not only the ones before it; the failure
    // names every thin part when there were several.
    const thinParts = part && part.mode === 'thin'
      ? new Set((Array.isArray(part.thin_parts) && part.thin_parts.length > 0 ? part.thin_parts : [failedPart]).map(Number)) : null;
    for (const [id, meta] of attemptInvocations(token)) {
      const reusable = interrupted || meta.part === null || (thinParts ? !thinParts.has(meta.part) : meta.part < failedPart);
      if (reusable) eligible.set(id, { ...meta, attempt_token: token, code });
    }
  }
  return eligible;
}

// The stored calls a new attempt may reuse, keyed by call identity; the
// latest eligible record wins when two attempts completed the same call.
function resumableCalls({ errorHistory, calls }) {
  const eligible = resumableInvocations(errorHistory);
  const byIdentity = new Map();
  const ordered = [...(calls || [])].sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
  for (const call of ordered) {
    if (!call || !call.invocation_id || !eligible.has(call.invocation_id) || isFailureRecord(call)) continue;
    const identity = callIdentity({ callKind: call.call_kind, promptVersion: call.prompt_version, request: call.request });
    if (!identity) continue;
    byIdentity.set(identity, call);
  }
  return byIdentity;
}

// The parsed answer of a stored raw response: the object itself when the
// adapter stored none (the synthetic model), else the text blocks joined
// (every hosted adapter stores a message with `content` text blocks) and
// read as one JSON object, fences stripped as the adapters strip them.
function parsedStoredResponse(response) {
  if (!response || typeof response !== 'object') return null;
  if (!Array.isArray(response.content)) {
    return response.schema_version === FAILURE_RESPONSE_VERSION ? null : response;
  }
  const text = response.content.filter((item) => item && item.type === 'text' && typeof item.text === 'string').map((item) => item.text).join('').trim();
  const unfenced = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return parseJsonObject(unfenced);
}

function workerStopError(reason = 'the worker is stopping') {
  const error = new Error(`${WORKER_STOP_REQUESTED}: ${reason}`);
  error.code = WORKER_STOP_REQUESTED;
  return error;
}

function isWorkerStopRequested(error) {
  return Boolean(error) && error.code === WORKER_STOP_REQUESTED;
}

// The model the runner hands an attempt: a call whose identity an earlier
// attempt completed is answered from the store (zero spend, the original
// provider and model named, `resumed_from_model_call_id` on the record);
// every other call goes to the provider. A stop asked for between calls
// ends the attempt before the next call starts, never in the middle of one.
function resumingModel(model, { calls = new Map(), stopRequested = () => false, onReuse = null } = {}) {
  if (!model || typeof model.complete !== 'function') throw new TypeError('model.complete is required');
  const reused = [];
  return {
    reused,
    async complete(input) {
      if (stopRequested()) throw workerStopError();
      const identity = callIdentity({ callKind: input.call_kind, promptVersion: input.prompt_version, request: input.request });
      const stored = identity ? calls.get(identity) : null;
      const parsed = stored ? parsedStoredResponse(stored.response) : null;
      if (!stored || !parsed) return model.complete(input);
      const result = {
        response: parsed,
        raw_request: stored.request,
        raw_response: stored.response,
        provider_id: stored.provider_id,
        model_id: stored.model_id,
        input_tokens: 0,
        output_tokens: 0,
        cost_microusd: 0,
        duration_ms: 0,
        provider_completion_confirmed: true,
        resumed_from_model_call_id: stored.model_call_id,
      };
      reused.push({ call_kind: input.call_kind, model_call_id: stored.model_call_id, part: extractionPart(input.request)?.part ?? null });
      if (onReuse) await onReuse(result, input);
      return result;
    },
  };
}

// The runner's one call: the stored calls of the section that the claim's
// history makes eligible, as a resuming model over the provider's.
async function prepareResumption({ store, runId, claim, model, stopRequested }) {
  if (!claim || typeof store.loadSectionModelCalls !== 'function') {
    return { model: resumingModel(model, { stopRequested }), resumable: 0 };
  }
  const history = Array.isArray(claim.error_history) ? claim.error_history : [];
  const eligible = resumableInvocations(history);
  const calls = eligible.size > 0 ? await store.loadSectionModelCalls({ runId, nodeId: claim.node_id }) : [];
  const reusable = resumableCalls({ errorHistory: history, calls });
  return { model: resumingModel(model, { calls: reusable, stopRequested }), resumable: reusable.size };
}

// Worker ids: "product-hosted:<pid>:<n>", and since the sandbox pool
// "product-hosted:<sandbox>:<pid>:<n>", so a worker that starts after a
// restart can tell which claims a dead process of its own sandbox held.
function parseWorkerId(workerId) {
  const match = /^product-hosted:(?:([a-z0-9-]+):)?(\d+):(\d+)$/.exec(String(workerId || ''));
  if (!match) return null;
  return { sandbox: match[1] || null, pid: Number(match[2]), loop: Number(match[3]) };
}

function hostedWorkerId({ sandbox = null, pid, loop }) {
  return sandbox ? `product-hosted:${sandbox}:${pid}:${loop}` : `product-hosted:${pid}:${loop}`;
}

function processAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error && error.code === 'EPERM';
  }
}

// At a worker's start: every RUNNING claim of the run held by a worker of
// this sandbox (or by one with no sandbox in its id, from before the pool)
// whose process is gone is handed back at once (status
// PENDING, the attempt refunded, the reason WORKER_RESTART with the parts
// it had completed on the row), instead of waiting the lease out and losing
// the record. Claims of other sandboxes, or of live processes, are left
// alone.
async function releaseDeadClaims({ store, runId, sandbox = null, isAlive = processAlive, log = null }) {
  if (typeof store.listRunningSections !== 'function' || typeof store.releaseSection !== 'function') return [];
  const released = [];
  for (const row of await store.listRunningSections(runId)) {
    const holder = parseWorkerId(row.worker_id);
    // A holder that names another sandbox is not ours; one that names none
    // (an id from before the pool) is, since a run owns one sandbox.
    if (!holder || (holder.sandbox && holder.sandbox !== sandbox) || isAlive(holder.pid)) continue;
    const calls = typeof store.loadSectionModelCalls === 'function' ? await store.loadSectionModelCalls({ runId, nodeId: row.node_id }) : [];
    const own = attemptInvocations(row.attempt_token);
    const progress = attemptProgress(calls.filter((call) => own.has(call.invocation_id)));
    const reason = { code: 'WORKER_RESTART', dead_worker_id: row.worker_id, ...progress };
    await store.releaseSection({ runId, nodeId: row.node_id, workerId: row.worker_id, attemptToken: row.attempt_token, reason });
    if (typeof log === 'function') log({ event: 'DEAD_CLAIM_RELEASED', run_id: runId, node_id: row.node_id, worker_id: row.worker_id, ...progress });
    released.push({ node_id: row.node_id, worker_id: row.worker_id, ...progress });
  }
  return released;
}

module.exports = {
  CALL_KINDS,
  INTERRUPTION_CODES,
  MAX_PARTS,
  WORKER_STOP_REQUESTED,
  attemptInvocations,
  attemptProgress,
  callIdentity,
  extractionPart,
  historyCode,
  hostedWorkerId,
  invocationId,
  isFailureRecord,
  isWorkerStopRequested,
  logicalRequest,
  parseWorkerId,
  parsedStoredResponse,
  prepareResumption,
  processAlive,
  releaseDeadClaims,
  resumableCalls,
  resumableInvocations,
  resumingModel,
  workerStopError,
};
