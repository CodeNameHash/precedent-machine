'use strict';

// Driving a review through its own HTTP boundary (work package 50, plan
// findings (276) and (277)).
//
// The review of a 97-section deal is 2,398 item decisions, and one save per
// decision costs 47 seconds and a 22 MB response because every save
// validates the whole state. So the driver sends item decisions in batches
// (the route's `commands` array, at most 500), takes the version from each
// answer, repairs the proposition-group mismatches PUBLISH refuses on, then
// publishes, evaluates, activates and — for the drill — rolls back and
// activates again. It decides ACCEPTED: it is the harness driving the loop
// with the owner's explicit permission (Ben, 2026-10-25: "Only I use the
// site so no concerns on lawyer review etc"), not a lawyer's judgement, and
// every decision is recorded against the actor the token names.

const DEFAULT_BATCH_SIZE = 300;

function isNote(item) {
  return item.kind === 'ISSUE' && item.original && item.original.kind === 'NOTE';
}

// Every pending item as a DECIDE_ITEM command. Notes are accepted too when
// `includeNotes`, which the harness does so the queue is empty rather than
// "empty except 472 notes". A held proposal — one whose component tree failed
// validation — cannot be ACCEPTED (the server refuses with
// REVIEW_INVALID_PROPOSAL): the harness rejects it, which is the honest
// decision for a fact that was never publishable and is what a lawyer does
// when the words do not support a fix. A rejected proposal is not published.
function acceptanceCommands(reviewState, { includeNotes = true } = {}) {
  return reviewState.items
    .filter((item) => item.decision === 'PENDING' && (includeNotes || !isNote(item)))
    .map((item) => {
      const held = item.kind === 'PROPOSAL' && item.original?.validation_status === 'INVALID';
      return { type: 'DECIDE_ITEM', item_id: item.item_id, decision: held ? 'REJECTED' : 'ACCEPTED' };
    });
}

// The proposals PUBLISH will refuse on: a member of a recorded proposition
// group whose family or subtype differs from the group's. The repair is the
// one the review UI offers: the fact is EDITED with its own statement and
// roles and no group.
function groupMismatchRepairs(analysis, reviewState) {
  const groups = new Map((analysis.proposition_groups || []).map((group) => [group.proposition_group_id, group]));
  const repairs = [];
  for (const item of reviewState.items) {
    if (item.kind !== 'PROPOSAL' || item.decision === 'REJECTED') continue;
    const groupId = item.edited_proposition_group_id === null ? null : (item.edited_proposition_group_id || item.original?.proposition_group_id);
    const group = groupId ? groups.get(groupId) : null;
    if (!group) continue;
    if (group.family_key === item.original.family_key && group.subtype_key === item.original.subtype_key) continue;
    repairs.push({
      type: 'DECIDE_ITEM', item_id: item.item_id, decision: 'EDITED',
      statement: item.edited_statement || item.original.statement,
      roles: item.original.roles, proposition_group_id: null,
    });
  }
  return repairs;
}

function chunks(list, size) {
  const out = [];
  for (let index = 0; index < list.length; index += size) out.push(list.slice(index, index + size));
  return out;
}

// POST one command or one batch and return the new review state. `version`
// comes from the answer: the server is the only source of the next expected
// version.
async function postCommand({ fetchJson, runId, version, idempotencyKey, body }) {
  const payload = body.commands ? { expected_version: version, idempotency_key: idempotencyKey, commands: body.commands }
    : { expected_version: version, idempotency_key: idempotencyKey, command: body.command };
  const answer = await fetchJson(`/api/product/review/${runId}`, { method: 'POST', body: payload });
  if (answer.status !== 200) {
    const error = new Error(`${answer.body?.error || 'REVIEW_COMMAND_FAILED'}${answer.body?.message ? `: ${answer.body.message}` : ''}`);
    error.code = answer.body?.error || null;
    throw error;
  }
  return answer.body.review;
}

// Accept every pending item in batches; returns the review with the new
// decisions and how many commands it took.
async function acceptAll({ fetchJson, runId, review, batchSize = DEFAULT_BATCH_SIZE, onBatch = null }) {
  const commands = acceptanceCommands(review.state);
  let current = review;
  let index = 0;
  for (const batch of chunks(commands, batchSize)) {
    current = await postCommand({
      fetchJson, runId, version: current.version, idempotencyKey: `accept-${index}-${batch.length}`,
      body: { commands: batch },
    });
    index += 1;
    if (onBatch) onBatch({ batch: index, decided: batch.length, version: current.version });
  }
  return { review: current, commands: commands.length, batches: index };
}

// The repair PUBLISH refuses on, applied in one save when there is any.
async function repairGroups({ fetchJson, runId, review, analysis }) {
  const repairs = groupMismatchRepairs(analysis, review.state);
  if (repairs.length === 0) return { review, repairs: 0 };
  const next = await postCommand({
    fetchJson, runId, version: review.version, idempotencyKey: `group-repair-${repairs.length}`,
    body: { commands: repairs },
  });
  return { review: next, repairs: repairs.length };
}

// Publish, evaluate the release, activate it, and (for the drill) roll back
// and activate again. Each step returns the review so the caller can print
// what the server decided.
async function publishAndRelease({ fetchJson, runId, review, drill = false, confirmCoverage = true }) {
  let current = review;
  const steps = [];
  if (confirmCoverage && current.state.agreement_coverage?.decision !== 'ACCEPTED') {
    current = await postCommand({
      fetchJson, runId, version: current.version, idempotencyKey: 'coverage-confirmed',
      body: { command: { type: 'CONFIRM_AGREEMENT_COVERAGE', confirmed: true } },
    });
    steps.push({ step: 'coverage', status: current.status });
  }
  current = await postCommand({ fetchJson, runId, version: current.version, idempotencyKey: 'publish-1', body: { command: { type: 'PUBLISH' } } });
  steps.push({ step: 'publish', status: current.status });
  current = await postCommand({ fetchJson, runId, version: current.version, idempotencyKey: 'evaluate-1', body: { command: { type: 'EVALUATE_RELEASE' } } });
  steps.push({ step: 'evaluate', status: current.status, release: current.release_evaluation?.decision || current.release_report?.decision || null });
  current = await postCommand({ fetchJson, runId, version: current.version, idempotencyKey: 'activate-1', body: { command: { type: 'ACTIVATE_RELEASE' } } });
  steps.push({ step: 'activate', status: current.status, active: current.active_release_id || null });
  if (drill) {
    current = await postCommand({ fetchJson, runId, version: current.version, idempotencyKey: 'rollback-1', body: { command: { type: 'ROLLBACK_RELEASE' } } });
    steps.push({ step: 'rollback', status: current.status, active: current.active_release_id || null });
    current = await postCommand({ fetchJson, runId, version: current.version, idempotencyKey: 'activate-2', body: { command: { type: 'ACTIVATE_RELEASE' } } });
    steps.push({ step: 'activate again', status: current.status, active: current.active_release_id || null });
  }
  return { review: current, steps };
}

module.exports = {
  DEFAULT_BATCH_SIZE, acceptanceCommands, groupMismatchRepairs, chunks, postCommand, acceptAll, repairGroups, publishAndRelease,
};
