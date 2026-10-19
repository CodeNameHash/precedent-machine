'use strict';

// Work package E1 item 4 (plan finding (167); implementer E). The replay
// harness: a run finalised again from its stored model responses with no
// model call, so a validator, compiler or page fix is judged on the real
// answers without a generation. Ben: "do you think it is worth spooling
// an ageng to look at the cost of extractions/number of runs because it
// seems SO high"; the number of runs is this: thirteen generations of two
// agreements each re-read the whole agreement to test code fixes that
// never changed what the model was asked.
//
// How it works: every stored call's request is rebuilt into the pipeline's
// own request ({ call_kind, prompt_version, request };
// lib/product/extraction-cost-ledger.js pipelineRequestOf) and keyed the
// way the recorded adapter keys a call (lib/product/model-adapter.js
// callKey). buildAgreementSectionDraft then runs as it did, with a model
// whose complete() answers from that index: the same request gets the
// same stored response, and the compile, validation, split and merge
// rules of the code as it is now produce the section result. The
// committed attempt's split is reproduced from the work row's
// error_history through splitForAttempt, as the runner did. The sections
// are assembled and validated into a draft (assembleAgreementDraft,
// validateAgreementDraft, the finalisation path) and compared with the
// stored proposals by proposal id and validation status. A request the
// code now builds differently (a changed instruction) has no exact
// recording; `match: 'loose'` answers it with the stored call of the same
// section, kind and part and records the drift, so a prompt change is
// still judged on the old answers where that is what is wanted. Pure
// functions over the rows; no database or model access.

const { canonicalJson, sha256Hex } = require('../canonical-v2/canonical-bytes');
const {
  LONG_SECTION_SPLIT, assembleAgreementDraft, buildAgreementSectionDraft, splitForAttempt, validateAgreementDraft,
} = require('./agreement-draft');
const { tableShapesForRun } = require('./analysis-runner');
const { pipelineRequestOf, isFailedCall } = require('./extraction-cost-ledger');
const { legalSchemaForVersion } = require('./legal-schema-selection');
const { callKey } = require('./model-adapter');
const { substantiveSections } = require('./source-context');


class RunReplayError extends Error {
  constructor(code, detail) {
    super(`${code}: ${detail}`);
    this.name = 'RunReplayError';
    this.code = code;
  }
}

function plainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

// The response the pipeline parsed from a stored call: the API message's
// text, the CLI's content, or the plain response object.
function storedResponseText(call) {
  const response = call.response;
  if (!plainObject(response)) return typeof response === 'string' ? response : JSON.stringify(response);
  if (Array.isArray(response.content)) return response.content.filter((block) => block && block.type === 'text' && typeof block.text === 'string').map((block) => block.text).join('');
  if (typeof response.content === 'string') return response.content;
  if (typeof response.result === 'string') return response.result;
  return null;
}

function parsedStoredResponse(call) {
  const text = storedResponseText(call);
  if (text === null) return call.response;
  const stripped = text.replace(/^\s*```(?:json)?\s*/, '').replace(/\s*```\s*$/, '');
  try {
    return JSON.parse(stripped);
  } catch {
    throw new RunReplayError('STORED_RESPONSE_NOT_JSON', `${call.call_kind} ${call.model_call_id}`);
  }
}

// The index of a run's stored calls: by exact request key, and by
// section, call kind and part for the loose match. Failure records are
// never answers (their attempt did not commit).
function indexStoredCalls(calls, { referenceByNode }) {
  const exact = new Map();
  const loose = new Map();
  const entries = [];
  for (const call of calls) {
    if (isFailedCall(call)) continue;
    const rebuilt = pipelineRequestOf(call);
    const input = { call_kind: rebuilt.call_kind, prompt_version: rebuilt.prompt_version, request: rebuilt.request };
    const key = callKey(input);
    const part = rebuilt.request?.source_closure?.extraction_part?.part ?? null;
    const entry = { call, input, key, part, section_reference: referenceByNode.get(call.structure_node_id) || null, used: 0 };
    entries.push(entry);
    // Two identical committed calls (a section whose attempt was repeated
    // with the same answer) keep the later one; the first is unreachable
    // by key and is reported as unused.
    exact.set(key, entry);
    const looseKey = [call.structure_node_id, call.call_kind, part ?? 0].join('|');
    const existing = loose.get(looseKey);
    if (!existing || String(call.created_at || '') >= String(existing.call.created_at || '')) loose.set(looseKey, entry);
  }
  return { exact, loose, entries };
}

// The model whose complete() answers from the index. Each answer is the
// stored call's response with the stored call's own metrics, provider and
// model ids, so the call record the pipeline writes is byte-identical to
// the stored one and every content id downstream (proposals, section
// results, the draft) can be compared with the stored run.
function createReplayModel({ index, match = 'exact', nodeByReference, onDrift = null }) {
  const drifts = [];
  return {
    drifts,
    async complete(input) {
      const key = callKey(input);
      let entry = index.exact.get(key);
      let drift = null;
      if (!entry && match === 'loose') {
        const reference = input?.request?.section_reference || input?.request?.source_closure?.section_reference || null;
        const nodeId = nodeByReference.get(reference);
        const part = input?.request?.source_closure?.extraction_part?.part ?? 0;
        entry = nodeId ? index.loose.get([nodeId, input.call_kind, part].join('|')) : null;
        if (entry) {
          drift = { section_reference: reference, call_kind: input.call_kind, part: part || null, stored_model_call_id: entry.call.model_call_id, reason: 'request differs from the stored call; answered loosely' };
          drifts.push(drift);
          if (onDrift) onDrift(drift);
        }
      }
      if (!entry) {
        const reference = input?.request?.section_reference || input?.request?.source_closure?.section_reference || '?';
        throw new RunReplayError('REPLAY_MISS', `${input?.call_kind} for ${reference}${input?.request?.source_closure?.extraction_part ? ` part ${input.request.source_closure.extraction_part.part}` : ''}: no stored call answers this request (${match} match)`);
      }
      entry.used += 1;
      const call = entry.call;
      return {
        provider_id: call.provider_id,
        model_id: call.model_id,
        raw_request: call.request,
        raw_response: call.response,
        response: parsedStoredResponse(call),
        input_tokens: Number(call.input_tokens) || 0,
        output_tokens: Number(call.output_tokens) || 0,
        cost_microusd: Number(call.cost_microusd) || 0,
        duration_ms: Number(call.duration_ms) || 0,
        provider_completion_confirmed: true,
      };
    },
  };
}

function countByStatus(proposals) {
  const counts = { total: 0, VALID: 0, INVALID: 0, other: 0 };
  for (const proposal of proposals) {
    counts.total += 1;
    const status = proposal.validation_status || proposal.payload?.validation_status;
    if (status === 'VALID' || status === 'INVALID') counts[status] += 1; else counts.other += 1;
  }
  return counts;
}

// Replay one run. `run` is the rows ({ run_id, tables, context? }) and
// `context` the run row, source document and structure when the rows do
// not carry them. `sections` narrows the replay to section references
// (then no draft is assembled). Returns the section results, the draft
// when assembled, the comparison with the stored rows, and the calls'
// use.
// `longSectionSplit` is the runner's split (LONG_SECTION_SPLIT, the
// default) so a hosted run's parts are reproduced; a caller whose run was
// built without a split (buildAgreementDraft, the tests) passes null.
async function replayRun({ run, context = run?.context, match = 'exact', sections = null, legalSchema = null, log = null, longSectionSplit = LONG_SECTION_SPLIT }) {
  if (!run || !run.tables) throw new RunReplayError('RUN_ROWS_REQUIRED', 'rows of a run are required');
  if (!context || !context.run || !context.sourceDocument || !context.agreementStructure) throw new RunReplayError('RUN_CONTEXT_REQUIRED', 'the run row, source document and AgreementStructure are required');
  const tables = run.tables;
  const calls = tables.product_model_calls || [];
  if (calls.length === 0) throw new RunReplayError('NO_STORED_CALLS', run.run_id);
  const closures = tables.product_source_closures || [];
  const referenceByNode = new Map(closures.map((closure) => [closure.structure_node_id, closure.section_reference]));
  const substantive = substantiveSections(context.agreementStructure);
  for (const node of substantive) if (!referenceByNode.has(node.node_id)) referenceByNode.set(node.node_id, node.reference);
  const nodeByReference = new Map();
  for (const [nodeId, reference] of referenceByNode) nodeByReference.set(reference, nodeId);
  const schema = legalSchema || legalSchemaForVersion(context.run.schema_version);
  const tableShapes = tableShapesForRun(context.run);
  const workByNode = new Map((tables.product_section_work || []).map((row) => [row.node_id, row]));
  const index = indexStoredCalls(calls, { referenceByNode });
  const model = createReplayModel({ index, match, nodeByReference });
  const wanted = sections ? new Set(sections) : null;
  const results = [];
  const failures = [];
  const started = Date.now();
  for (const node of substantive) {
    if (wanted && !wanted.has(node.reference)) continue;
    const work = workByNode.get(node.node_id);
    const claim = { error_history: Array.isArray(work?.error_history) ? work.error_history : [] };
    const sectionStarted = Date.now();
    try {
      const result = await buildAgreementSectionDraft({
        sourceDocument: context.sourceDocument,
        agreementStructure: context.agreementStructure,
        legalSchema: schema,
        model,
        node,
        attemptToken: work?.attempt_token || null,
        tableShapes,
        longSectionSplit: longSectionSplit ? splitForAttempt(longSectionSplit, claim) : null,
      });
      results.push(result);
      if (log) log({ event: 'SECTION_REPLAYED', section_reference: node.reference, proposals: result.proposals.length, ms: Date.now() - sectionStarted });
    } catch (error) {
      failures.push({ section_reference: node.reference, node_id: node.node_id, code: error.code || null, message: error.message });
      if (log) log({ event: 'SECTION_REPLAY_FAILED', section_reference: node.reference, error: error.message });
    }
  }
  let draft = null;
  let draftError = null;
  if (!wanted && failures.length === 0) {
    try {
      draft = assembleAgreementDraft({ sourceDocument: context.sourceDocument, agreementStructure: context.agreementStructure, legalSchema: schema, results });
      validateAgreementDraft(draft, { sourceDocument: context.sourceDocument, agreementStructure: context.agreementStructure, legalSchema: schema });
    } catch (error) {
      draftError = { code: error.code || null, message: error.message };
    }
  }
  // The comparison with the stored run: proposals by id and status, per
  // section; issues by code.
  const replayedProposals = results.flatMap((result) => result.proposals.map((proposal) => ({ ...proposal, section_reference: result.section_reference })));
  const storedProposals = (tables.product_proposals || []).filter((row) => !wanted || wanted.has(referenceByNode.get(row.structure_node_id)));
  const storedIds = new Map(storedProposals.map((row) => [row.proposal_id, row]));
  const replayedIds = new Map(replayedProposals.map((proposal) => [proposal.proposal_id, proposal]));
  const onlyStored = [...storedIds.keys()].filter((id) => !replayedIds.has(id));
  const onlyReplayed = [...replayedIds.keys()].filter((id) => !storedIds.has(id));
  const statusChanged = [];
  for (const [id, proposal] of replayedIds) {
    const stored = storedIds.get(id);
    if (stored && (stored.validation_status || stored.payload?.validation_status) !== proposal.validation_status) {
      statusChanged.push({ proposal_id: id, section_reference: proposal.section_reference, stored: stored.validation_status || stored.payload?.validation_status, replayed: proposal.validation_status });
    }
  }
  const issueCounts = (issues) => {
    const counts = {};
    for (const issue of issues) counts[issue.code] = (counts[issue.code] || 0) + 1;
    return Object.fromEntries(Object.entries(counts).sort());
  };
  const storedIssues = (tables.product_issues || []).filter((row) => !wanted || !row.structure_node_id || wanted.has(referenceByNode.get(row.structure_node_id))).map((row) => row.payload || row);
  const replayedIssues = [...results.flatMap((result) => result.issues), ...(draft ? draft.issues.filter((issue) => !issue.structure_node_id) : [])];
  const unusedCalls = index.entries.filter((entry) => entry.used === 0).map((entry) => ({ model_call_id: entry.call.model_call_id, section_reference: entry.section_reference, call_kind: entry.call.call_kind, part: entry.part }));
  const failedStored = calls.filter((call) => isFailedCall(call)).length;
  return {
    schema_version: 'PRODUCT_RUN_REPLAY/V1',
    run_id: run.run_id,
    match,
    sections_requested: sections,
    sections_replayed: results.length,
    sections_failed: failures,
    draft: draft ? { draft_analysis_id: draft.draft_analysis_id, proposals: draft.proposals.length, issues: draft.issues.length } : null,
    draft_error: draftError,
    model_calls: { stored: calls.length, stored_failed: failedStored, answered: index.entries.reduce((sum, entry) => sum + entry.used, 0), unused: unusedCalls, drifts: model.drifts, live_calls: 0, cost_usd: 0 },
    proposals: {
      stored: countByStatus(storedProposals),
      replayed: countByStatus(replayedProposals),
      identical: onlyStored.length === 0 && onlyReplayed.length === 0 && statusChanged.length === 0,
      only_stored: onlyStored,
      only_replayed: onlyReplayed.map((id) => ({ proposal_id: id, section_reference: replayedIds.get(id).section_reference, validation_status: replayedIds.get(id).validation_status })),
      status_changed: statusChanged,
    },
    issues: { stored: issueCounts(storedIssues), replayed: issueCounts(replayedIssues) },
    elapsed_ms: Date.now() - started,
    results,
    draft_body: draft,
  };
}

function renderReplaySummary(replay) {
  const lines = [];
  lines.push(`Replay of run ${replay.run_id} (${replay.match} match): ${replay.sections_replayed} sections replayed, ${replay.sections_failed.length} failed, ${replay.model_calls.answered} stored answers used of ${replay.model_calls.stored} stored calls (${replay.model_calls.stored_failed} failure records, ${replay.model_calls.unused.length} unused), ${replay.model_calls.live_calls} live calls, $${replay.model_calls.cost_usd.toFixed(2)} spent, ${(replay.elapsed_ms / 1000).toFixed(1)} s.`);
  const stored = replay.proposals.stored;
  const replayed = replay.proposals.replayed;
  lines.push(`Proposals: stored ${stored.total} (${stored.VALID} VALID, ${stored.INVALID} held); replayed ${replayed.total} (${replayed.VALID} VALID, ${replayed.INVALID} held); ${replay.proposals.identical ? 'identical by proposal id and status' : `${replay.proposals.only_stored.length} only stored, ${replay.proposals.only_replayed.length} only replayed, ${replay.proposals.status_changed.length} changed status`}.`);
  if (replay.draft) lines.push(`Draft assembled and validated: ${replay.draft.draft_analysis_id} (${replay.draft.proposals} proposals, ${replay.draft.issues} issues).`);
  if (replay.draft_error) lines.push(`Draft not assembled: ${replay.draft_error.message}`);
  for (const failure of replay.sections_failed) lines.push(`  section ${failure.section_reference} failed: ${failure.message}`);
  if (replay.model_calls.drifts.length) lines.push(`  ${replay.model_calls.drifts.length} requests differed from the stored calls and were answered loosely: ${replay.model_calls.drifts.map((drift) => `${drift.section_reference} ${drift.call_kind}${drift.part ? ` part ${drift.part}` : ''}`).join(', ')}`);
  const changedCodes = Object.keys({ ...replay.issues.stored, ...replay.issues.replayed }).filter((code) => (replay.issues.stored[code] || 0) !== (replay.issues.replayed[code] || 0));
  if (changedCodes.length) lines.push(`  issue counts that differ: ${changedCodes.map((code) => `${code} ${replay.issues.stored[code] || 0} -> ${replay.issues.replayed[code] || 0}`).join('; ')}`);
  return lines.join('\n');
}

module.exports = {
  RunReplayError,
  createReplayModel,
  indexStoredCalls,
  parsedStoredResponse,
  renderReplaySummary,
  replayRun,
};
