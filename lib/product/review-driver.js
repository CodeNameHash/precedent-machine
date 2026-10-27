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
// "empty except 472 notes". Two kinds are rejected rather than accepted:
//   - a held proposal — one whose component tree failed validation — cannot
//     be ACCEPTED (the server refuses with REVIEW_INVALID_PROPOSAL), and a
//     fact that was never publishable is what a lawyer rejects when the
//     words do not support a fix;
//   - a model relationship (RELATIONSHIP, EXCEPTION_LINK): ACCEPTED on one
//     whose recorded type the schema does not allow for its endpoint throws
//     inside the save and the deployment answers 500, so the harness rejects
//     the machine's link rather than pretend it stands (finding (277)).
//     A rejected link is not published.
function acceptanceCommands(reviewState, { includeNotes = true } = {}) {
  return reviewState.items
    .filter((item) => item.decision === 'PENDING' && (includeNotes || !isNote(item)))
    .map((item) => {
      const held = item.kind === 'PROPOSAL' && item.original?.validation_status !== 'VALID';
      const link = item.kind === 'RELATIONSHIP' || item.kind === 'EXCEPTION_LINK';
      return { type: 'DECIDE_ITEM', item_id: item.item_id, decision: held || link ? 'REJECTED' : 'ACCEPTED' };
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
    if (!groupId) continue;
    const group = groups.get(groupId);
    // A group the analysis does not carry is as unpublishable as a
    // mismatched one (compileReviewSummary refuses both), so it is repaired
    // the same way. A repair keeps a lawyer's edited statement and roles,
    // never the machine's originals (the review of 2026-10-25, finding 8).
    const mismatch = !group || group.family_key !== item.original.family_key || group.subtype_key !== item.original.subtype_key;
    if (!mismatch) continue;
    const roles = item.edited_roles || item.original.roles;
    // A proposal with no roles cannot be edited (the server refuses an EDITED
    // item without its required roles), and it cannot stand published on a
    // mismatched group either: reject it, which is what the harness did with
    // every held fact (2026-10-27, the DeepSeek run's one such item).
    if (!roles || typeof roles !== 'object' || Object.keys(roles).length === 0) {
      repairs.push({ type: 'DECIDE_ITEM', item_id: item.item_id, decision: 'REJECTED' });
      continue;
    }
    repairs.push({
      type: 'DECIDE_ITEM', item_id: item.item_id, decision: 'EDITED',
      statement: item.edited_statement || item.original.statement,
      roles, proposition_group_id: null,
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
async function postCommand({ fetchJson, runId, version, idempotencyKey, body, retryOnServerError = true }) {
  const payload = body.commands ? { expected_version: version, idempotency_key: idempotencyKey, commands: body.commands }
    : { expected_version: version, idempotency_key: idempotencyKey, command: body.command };
  // A 5xx is often the deployment, not the command (the night of 2026-10-25
  // was one long 500 from a stale schema cache): one retry with the same
  // idempotency key, which the server deduplicates.
  let answer = await fetchJson(`/api/product/review/${runId}`, { method: 'POST', body: payload });
  if (retryOnServerError && answer.status >= 500) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    answer = await fetchJson(`/api/product/review/${runId}`, { method: 'POST', body: payload });
  }
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
      fetchJson, runId, version: current.version, idempotencyKey: `accept-${index}-${current.version}-${batch.length}`,
      body: { commands: batch },
    });
    index += 1;
    if (onBatch) onBatch({ batch: index, decided: batch.length, version: current.version });
  }
  return { review: current, commands: commands.length, batches: index };
}

// The repair PUBLISH refuses on, applied in one save when there is any.
async function repairGroups({ fetchJson, runId, review, analysis, batchSize = DEFAULT_BATCH_SIZE }) {
  const repairs = groupMismatchRepairs(analysis, review.state);
  if (repairs.length === 0) return { review, repairs: 0 };
  let current = review;
  let index = 0;
  for (const batch of chunks(repairs, batchSize)) {
    current = await postCommand({
      fetchJson, runId, version: current.version, idempotencyKey: `group-repair-${index}-${current.version}-${batch.length}`,
      body: { commands: batch },
    });
    index += 1;
  }
  return { review: current, repairs: repairs.length };
}

// Publish the review. The release steps after it are not taken here by
// default: EVALUATE_RELEASE requires the lawyer's own attestations and its
// reference samples (lib/product/review-state.js), and ACTIVATE_RELEASE
// requires a named release, so the driver stops at publication and says so.
// The review page's release panel is the place those decisions are made and
// recorded (the review of 2026-10-25, finding 2). A caller that holds a full
// release payload may pass it as `release` and the steps run.
async function publishAndRelease({ fetchJson, runId, review, release = null, confirmCoverage = true }) {
  let current = review;
  const steps = [];
  if (confirmCoverage && current.state.agreement_coverage?.decision !== 'ACCEPTED') {
    current = await postCommand({
      fetchJson, runId, version: current.version, idempotencyKey: `coverage-${current.version}`,
      body: { command: { type: 'CONFIRM_AGREEMENT_COVERAGE', confirmed: true } },
    });
    steps.push({ step: 'coverage', status: current.status });
  }
  // No retry: the handler applies the command before the database's
  // idempotency check, so a retry of a publish that committed answers
  // REVIEW_NOT_EDITABLE and hides a success (the review of 2026-10-25,
  // finding 4).
  current = await postCommand({
    fetchJson, runId, version: current.version, idempotencyKey: `publish-${current.version}`,
    body: { command: { type: 'PUBLISH' } }, retryOnServerError: false,
  });
  steps.push({ step: 'publish', status: current.status });
  if (!release) {
    steps.push({ step: 'release', status: 'NOT_TAKEN', note: 'the release evaluation needs the lawyer\'s attestations in the review page; see lib/product/review-state.js EVALUATE_RELEASE' });
    return { review: current, steps };
  }
  current = await postCommand({
    fetchJson, runId, version: current.version, idempotencyKey: `evaluate-${current.version}`,
    body: { command: { ...release.evaluate, type: 'EVALUATE_RELEASE' } }, retryOnServerError: false,
  });
  steps.push({ step: 'evaluate', status: current.status, passed: current.release_evaluation?.passed ?? null });
  current = await postCommand({
    fetchJson, runId, version: current.version, idempotencyKey: `activate-${current.version}`,
    body: { command: { ...release.activate, type: 'ACTIVATE_RELEASE' } }, retryOnServerError: false,
  });
  steps.push({ step: 'activate', status: current.status, active: current.active_release_id || null });
  if (release.drill) {
    current = await postCommand({
      fetchJson, runId, version: current.version, idempotencyKey: `rollback-${current.version}`,
      body: { command: { ...(release.rollback || {}), type: 'ROLLBACK_RELEASE' } }, retryOnServerError: false,
    });
    steps.push({ step: 'rollback', status: current.status, active: current.active_release_id || null });
  }
  return { review: current, steps };
}

module.exports = {
  DEFAULT_BATCH_SIZE, acceptanceCommands, groupMismatchRepairs, chunks, postCommand, acceptAll, repairGroups, publishAndRelease,
};
