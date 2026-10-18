'use strict';

// Phase 6, "Load the reviewed candidate through an inactive release
// pointer" (plan section 6). Publication already creates an immutable
// release that the current-release pointer does not point at: the
// database's PUBLISH event (supabase/migrations/20260905070000_product_
// phase_3_review.sql) inserts product_agreement_releases with
// supersedes_release_id = the source's current head and leaves
// product_agreement_release_heads alone; only ACTIVATE_RELEASE moves the
// pointer. So the load is the review page's own "Finalise inactive
// candidate" command sent from a script, with the readiness read first and
// the pointer checked after.
//
// Nothing here decides a review item: a candidate with a pending or
// unresolved item is reported, not published (OPERATING-RULES: "Only a
// lawyer-accepted fact is final for the internal release"; "Partial work
// has an unresolved count and never calls itself complete"). Nothing here
// activates: the switch of private Review to the release is Phase 6's own
// box and needs Ben's explicit approval.

const { buildReviewView } = require('./review-view');

function countBy(items, key) {
  const counts = {};
  for (const item of items) counts[item[key]] = (counts[item[key]] || 0) + 1;
  return counts;
}

function sourceAgreement(published, sourceDocumentId) {
  const agreement = (published?.agreements || []).find((entry) => entry.source_document_id === sourceDocumentId) || null;
  return agreement ? { run_id: agreement.run_id, released_at: agreement.released_at, fact_count: agreement.facts.length } : null;
}

// Pure: the readiness of one run's review for publication, from the review
// workspace read (GET /api/product/review/:id).
function assessReleaseCandidate(workspace) {
  const analysis = workspace?.analysis || {};
  const review = workspace?.review || null;
  const state = review?.state || null;
  const items = state?.items || [];
  const blockers = [];
  if (analysis.kind !== 'draftAnalysis' || analysis.status !== 'READY') blockers.push(`run is not READY (status ${analysis.status || 'unknown'}, stage ${analysis.stage || 'unknown'})`);
  if (!state) blockers.push('no review session');
  const decisions = countBy(items, 'decision');
  const pending = decisions.PENDING || 0;
  const unresolved = decisions.UNRESOLVED || 0;
  const coverage = state?.agreement_coverage?.decision || null;
  let canPublish = false;
  if (state && state.status === 'DRAFT' && analysis.kind === 'draftAnalysis') {
    const view = buildReviewView({ analysis, review });
    canPublish = view.can_publish;
    if (pending > 0) blockers.push(`${pending} review items pending a lawyer decision`);
    if (unresolved > 0) blockers.push(`${unresolved} review items marked unresolved`);
    if (coverage !== 'ACCEPTED') blockers.push('agreement coverage not confirmed');
    if (pending === 0 && unresolved === 0 && coverage === 'ACCEPTED' && !canPublish) blockers.push('review view refuses publication (group or relationship coherence)');
  } else if (state && state.status === 'PUBLISHED') {
    blockers.push('review is already PUBLISHED (reopen it to publish a new candidate)');
  }
  const releases = review?.release_history || [];
  const activeReleaseId = review?.active_release_id || null;
  return {
    run_id: analysis.analysis_run_id || review?.run_id || null,
    source_document_id: analysis.source_document?.source_document_id || null,
    run_status: analysis.status || null,
    legal_schema_version: analysis.legal_schema_version || null,
    review: state ? { version: review.version, status: state.status, started_at: state.started_at || null, updated_at: state.updated_at || null } : null,
    items: { total: items.length, pending, unresolved, by_decision: decisions, by_kind: countBy(items, 'kind') },
    agreement_coverage: coverage,
    releases: releases.map((release) => ({
      release_id: release.release_id, publication_version: release.publication_version,
      supersedes_release_id: release.supersedes_release_id || null, published_at: release.published_at,
      active: release.active === true,
    })),
    active_release_id: activeReleaseId,
    can_publish: canPublish,
    blockers,
  };
}

// Loads one run's reviewed candidate into a release the pointer does not
// select. Returns { loaded, assessment, before, after?, release?, proof? }.
async function loadReleaseCandidate({ client, runId, idempotencyKey, publish = true } = {}) {
  if (!client) throw new TypeError('client is required');
  if (typeof runId !== 'string') throw new TypeError('runId is required');
  const workspace = await client.getReview(runId);
  const before = assessReleaseCandidate(workspace);
  const published = await client.getPublishedFacts();
  const visibleBefore = sourceAgreement(published, before.source_document_id);
  if (!publish || before.blockers.length > 0) {
    return { loaded: false, published: false, assessment: before, visible_before: visibleBefore };
  }
  const key = idempotencyKey || `load-release-candidate:${runId}:${workspace.review.version}`;
  const response = await client.reviewCommand(runId, {
    expected_version: workspace.review.version, idempotency_key: key, command: { type: 'PUBLISH' },
  });
  const afterWorkspace = response?.review ? response : await client.getReview(runId);
  const after = assessReleaseCandidate(afterWorkspace);
  const release = (afterWorkspace.review.release_history || []).find((entry) => (
    !(workspace.review.release_history || []).some((prior) => prior.release_id === entry.release_id)
  )) || null;
  const visibleAfter = sourceAgreement(await client.getPublishedFacts(), before.source_document_id);
  const summaryFacts = (afterWorkspace.review.state?.summary?.families || []).reduce((sum, family) => sum + (family.facts || []).length, 0);
  const proof = {
    review_status: afterWorkspace.review.state?.status || null,
    release_created: !!release,
    release_inactive: !!release && afterWorkspace.review.active_release_id !== release.release_id,
    head_unchanged: (afterWorkspace.review.active_release_id || null) === (workspace.review.active_release_id || null),
    published_read_unchanged: JSON.stringify(visibleBefore) === JSON.stringify(visibleAfter),
    summary_fact_count: summaryFacts,
  };
  return {
    loaded: Object.values(proof).every((value) => value !== false),
    published: true,
    assessment: before,
    assessment_after: after,
    release: release ? { ...release, supersedes_release_id: release.supersedes_release_id || null, run_id: runId, summary_fact_count: summaryFacts } : null,
    proof,
    visible_before: visibleBefore,
    visible_after: visibleAfter,
    idempotency_key: key,
  };
}

function renderAssessment(assessment) {
  const lines = [];
  lines.push(`run ${assessment.run_id}: status ${assessment.run_status || 'unknown'}, schema ${assessment.legal_schema_version || 'unknown'}`);
  lines.push(assessment.review
    ? `review: version ${assessment.review.version}, ${assessment.review.status}; items ${assessment.items.total} (pending ${assessment.items.pending}, unresolved ${assessment.items.unresolved}, ${Object.entries(assessment.items.by_decision).filter(([decision]) => !['PENDING', 'UNRESOLVED'].includes(decision)).map(([decision, count]) => `${decision.toLowerCase()} ${count}`).join(', ') || 'no decisions'}); coverage ${assessment.agreement_coverage || 'unknown'}`
    : 'review: no session');
  lines.push(`releases of this run: ${assessment.releases.length}${assessment.releases.length ? ` (${assessment.releases.map((release) => `${release.release_id.slice(0, 12)} v${release.publication_version}${release.active ? ' ACTIVE' : ''}`).join('; ')})` : ''}; current pointer for the source: ${assessment.active_release_id ? assessment.active_release_id.slice(0, 12) : 'none'}`);
  lines.push(assessment.blockers.length ? `not publishable: ${assessment.blockers.join('; ')}` : 'publishable: every item decided, coverage confirmed');
  return lines.join('\n');
}

module.exports = { assessReleaseCandidate, loadReleaseCandidate, renderAssessment, sourceAgreement };
