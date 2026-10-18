'use strict';

// Phase 6, "Execute rollback once and prove the prior view returns" (plan
// section 6). The pointer move is the database's ROLLBACK_RELEASE event
// (supabase/migrations/20260905070000_product_phase_3_review.sql): the
// source's current-release pointer goes to the active release's
// supersedes_release_id, atomically, and every release stays. "Back" is
// the review page's ACTIVATE_RELEASE of the same candidate again, which the
// database allows because the candidate still supersedes what the pointer
// now selects. The proof is the published read (the /query/provisions
// read, /api/product/published-facts): which run's facts the reader sees
// before, between and after.
//
// Nothing here publishes, evaluates or decides; the production switch is
// never run from here (Phase 6's switch needs Ben's explicit approval).

const { sourceAgreement } = require('./release-candidate');

function releaseById(workspace, releaseId) {
  return (workspace?.review?.release_history || []).find((release) => release.release_id === releaseId) || null;
}

// The prior view has returned when the published read shows the prior
// release: a release of this run is checked by its publication (the facts
// the reader sees are that publication's, released at its time); a release
// of another run of the source is checked by the read naming that run.
function priorViewVisible({ visible, before, workspace, priorReleaseId, runId }) {
  if (!visible) return false;
  const priorRelease = releaseById(workspace, priorReleaseId);
  if (!priorRelease) return visible.run_id !== runId && JSON.stringify(visible) !== JSON.stringify(before);
  const publication = (workspace.review?.publications || []).find((entry) => entry.publication_version === priorRelease.publication_version);
  const publishedFacts = (publication?.summary?.families || []).reduce((sum, family) => sum + (family.facts || []).filter((fact) => Array.isArray(fact.components)).length, 0);
  return visible.run_id === runId
    && instant(visible.released_at) === instant(priorRelease.published_at)
    && (!publication || visible.fact_count === publishedFacts);
}

// A timestamp as milliseconds whether it arrived as an ISO string (the
// deployment) or a Date (an in-process read straight from the driver).
function instant(value) {
  return value instanceof Date ? value.getTime() : Date.parse(String(value));
}

async function readPointer(client, runId) {
  const workspace = await client.getReview(runId);
  const sourceDocumentId = workspace.analysis?.source_document?.source_document_id || null;
  const visible = sourceAgreement(await client.getPublishedFacts(), sourceDocumentId);
  return { workspace, sourceDocumentId, activeReleaseId: workspace.review?.active_release_id || null, visible };
}

// rollbackDrill({ client, runId, restore = true, idempotencyPrefix }) ->
// { completed, blockers, steps: [{ name, active_release_id, visible }], ... }
async function rollbackDrill({ client, runId, restore = true, idempotencyPrefix } = {}) {
  if (!client) throw new TypeError('client is required');
  if (typeof runId !== 'string') throw new TypeError('runId is required');
  const prefix = idempotencyPrefix || `rollback-drill:${runId}:${Date.now()}`;
  const steps = [];
  const blockers = [];
  const start = await readPointer(client, runId);
  const candidate = releaseById(start.workspace, start.activeReleaseId);
  steps.push({ name: 'before', active_release_id: start.activeReleaseId, visible: start.visible, review_version: start.workspace.review?.version ?? null });
  if (!start.activeReleaseId) blockers.push('the source has no current release: nothing to roll back');
  else if (!candidate) blockers.push(`the current release ${start.activeReleaseId.slice(0, 12)} belongs to another run of this source: run the drill from that run`);
  else if (!candidate.supersedes_release_id) blockers.push(`release ${candidate.release_id.slice(0, 12)} supersedes nothing: no prior release to return to`);
  if (start.workspace.review?.state?.status !== 'PUBLISHED') blockers.push(`review is ${start.workspace.review?.state?.status || 'absent'}, not PUBLISHED`);
  if (blockers.length) return { completed: false, blockers, steps, candidate };

  const prior = candidate.supersedes_release_id;
  let version = start.workspace.review.version;
  const rolledBack = await client.reviewCommand(runId, {
    expected_version: version, idempotency_key: `${prefix}:rollback`, command: { type: 'ROLLBACK_RELEASE' },
  });
  version = rolledBack.review.version;
  const afterRollback = await readPointer(client, runId);
  const rollbackProof = {
    pointer_moved_to_prior: afterRollback.activeReleaseId === prior,
    candidate_still_stored: !!releaseById(afterRollback.workspace, candidate.release_id),
    prior_view_visible: priorViewVisible({ visible: afterRollback.visible, before: start.visible, workspace: afterRollback.workspace, priorReleaseId: prior, runId }),
  };
  steps.push({ name: 'rollback', active_release_id: afterRollback.activeReleaseId, visible: afterRollback.visible, review_version: version, proof: rollbackProof });
  if (!restore) {
    return { completed: Object.values(rollbackProof).every(Boolean), blockers, steps, candidate, prior_release_id: prior, restored: false };
  }
  const restored = await client.reviewCommand(runId, {
    expected_version: version, idempotency_key: `${prefix}:restore`, command: { type: 'ACTIVATE_RELEASE', release_id: candidate.release_id },
  });
  version = restored.review.version;
  const afterRestore = await readPointer(client, runId);
  const restoreProof = {
    pointer_back_on_candidate: afterRestore.activeReleaseId === candidate.release_id,
    candidate_view_visible: JSON.stringify(afterRestore.visible) === JSON.stringify(start.visible),
  };
  steps.push({ name: 'restore', active_release_id: afterRestore.activeReleaseId, visible: afterRestore.visible, review_version: version, proof: restoreProof });
  return {
    completed: [...Object.values(rollbackProof), ...Object.values(restoreProof)].every(Boolean),
    blockers, steps, candidate, prior_release_id: prior, restored: true,
  };
}

function renderDrill(result) {
  const lines = [];
  for (const step of result.steps) {
    const visible = step.visible ? `published read shows run ${step.visible.run_id.slice(0, 8)} (${step.visible.fact_count} facts, released ${step.visible.released_at})` : 'published read shows nothing for this source';
    lines.push(`${step.name}: pointer ${step.active_release_id ? step.active_release_id.slice(0, 12) : 'none'}; ${visible}; review version ${step.review_version}`);
    if (step.proof) for (const [check, passed] of Object.entries(step.proof)) lines.push(`  ${passed ? 'pass' : 'FAIL'} ${check.replaceAll('_', ' ')}`);
  }
  if (result.blockers.length) lines.push(`drill not run: ${result.blockers.join('; ')}`);
  else lines.push(result.completed ? 'drill complete: the prior view returned and the candidate is current again' : 'drill INCOMPLETE: see the failed checks');
  return lines.join('\n');
}

module.exports = { rollbackDrill, renderDrill };
