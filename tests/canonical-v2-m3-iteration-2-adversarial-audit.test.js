'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  AUDIT_MODEL_CALL_COUNT,
  AUDIT_PROFILE_ID,
  Iteration2AdversarialAuditError,
  buildIteration2AdversarialAuditInput,
  validateIteration2AdversarialAuditInput,
} = require('../lib/canonical-v2/native-producer/m3-iteration-2-adversarial-audit');

const hash = (value) => value.repeat(64).slice(0, 64);
const commit = (value) => value.repeat(40).slice(0, 40);
const liveTerraIds = [
  'modiv-antitrust-consents-5-5',
  'modiv-closing-conditions-6-1',
  'modiv-mae-definition-8-12-g',
  'skechers-capitalisation-3-7',
  'topbuild-capitalisation-3-1-b',
  'topbuild-remedies-specific-performance-7-6',
];
const liveSolIds = ['topbuild-ioc-company-4-1', 'topbuild-no-shop-company-4-3'];
const retainedIds = ['modiv-consideration-2-1', 'modiv-termination-fee-7-3'];
const replayIds = ['skechers-no-other-reps-3-28', 'topbuild-termination-company-6-3'];

function fixture() {
  const allIds = [...liveTerraIds, ...liveSolIds, ...retainedIds, ...replayIds].sort();
  const firstExecutionId = hash('a');
  const gateId = hash('b');
  const planId = hash('c');
  const checklistHash = hash('d');
  const findings = allIds.map((work_item_id, index) => ({
    work_item_id,
    review_packet_id: hash(String(index + 1)),
    reviewer_kind: 'INDEPENDENT',
    status: index % 2 === 0 ? 'PASS' : 'FAIL',
    reason: `review finding ${index + 1}`,
  }));
  const reviewReports = [0, 1].map((index) => ({
    schema_version: 'M3_12_CALL_PILOT_INDEPENDENT_REVIEW_FINDINGS/V1',
    reviewer_kind: 'INDEPENDENT',
    review_packet_adapter_id: hash('e'),
    findings: findings.slice(index * 6, (index + 1) * 6),
    independent_review_findings_id: hash(String(index + 6)),
  }));
  const plan = {
    iteration_2_rerun_plan_id: planId,
    first_execution_result_id: firstExecutionId,
    quality_gate_id: gateId,
    controls: { live_model_call_count: 8, replay_model_call_count: 0 },
    live_terra_work_items: liveTerraIds.map((work_item_id) => ({ work_item_id })),
    live_sol_work_items: liveSolIds.map((work_item_id) => ({ work_item_id })),
  };
  const attempt3 = {
    plan,
    quality_gate: {
      schema_version: 'M3_12_CALL_PILOT_QUALITY_GATE/V1', quality_gate_id: gateId,
      work_item_findings: allIds.map((work_item_id) => ({ work_item_id })),
    },
    acceptance_checklist_v2: {
      schema_version: 'M3_MODEL_RERUN_ACCEPTANCE_CHECKLIST/V2', execution_result_id: firstExecutionId,
      content_hash: checklistHash, items: allIds.slice(0, 10).map((work_item_id) => ({ work_item_id })),
    },
    revised_decision_vector_v3: {
      schema_version: 'M3_12_CALL_ITERATION_2_REVISED_DECISION_VECTOR/V3', content_hash: hash('f'),
      actual_model_call_count: 0,
      bindings: {
        first_execution_result_id: firstExecutionId, quality_gate_id: gateId,
        iteration_2_rerun_plan_id: planId,
        acceptance_checklist: { content_hash: checklistHash },
      },
      decisions: allIds.map((work_item_id) => ({
        work_item_id,
        action: liveTerraIds.includes(work_item_id) || liveSolIds.includes(work_item_id) ? 'LIVE' : retainedIds.includes(work_item_id) ? 'RETAIN' : 'REPLAY_ONLY',
        profile_id: liveTerraIds.includes(work_item_id) ? 'TERRA_MEDIUM' : liveSolIds.includes(work_item_id) ? 'SOL_HIGH' : null,
      })),
    },
  };
  const liveExecution = {
    schema_version: 'NATIVE_UNIFIED_RUN_EXECUTION_RESULT/V1', execution_result_id: hash('0'),
    succeeded_count: 8, failed_count: 0,
    work_results: [...liveTerraIds, ...liveSolIds].map((work_item_id, index) => ({
      work_item_id,
      profile_id: liveSolIds.includes(work_item_id) ? 'SOL_HIGH' : 'TERRA_MEDIUM',
      status: 'SUCCEEDED', failure_code: null,
      resolution: {
        resolved: Array(index + 1).fill({}), review_queue: Array(index % 2).fill({}),
        open_world: [], residuals: [], limb_component_trees: [], ioc_restriction_components: [],
      },
    })),
  };
  return {
    pilot_baseline_commit: commit('a'),
    consolidation_commits: [
      { commit_id: commit('b'), subject: 'feat(canonical-v2): first consolidation', changed_paths: ['lib/a.js'] },
      { commit_id: commit('c'), subject: 'fix(canonical-v2): second consolidation', changed_paths: ['lib/b.js', 'tests/b.test.js'] },
    ],
    first_pass_review_reports: reviewReports,
    attempt_3: attempt3,
    live_execution: liveExecution,
    live_execution_artifact: {
      artifact_path: 'iteration-2/execution-result.json',
      content_sha256: hash('3'),
    },
    family_design_decisions: [
      { document_path: 'docs/superpowers/specs/a-family-design.md', document_content_sha256: hash('1'), decision_excerpt: 'Decision A.' },
      { document_path: 'docs/superpowers/specs/b-family-design.md', document_content_sha256: hash('2'), decision_excerpt: 'Decision B.' },
    ],
  };
}

test('seals one Sol High adversarial-audit input with the full post-run context', () => {
  const input = buildIteration2AdversarialAuditInput(fixture());
  assert.equal(input.audit_model_profile_id, AUDIT_PROFILE_ID);
  assert.equal(input.planned_model_call_count, AUDIT_MODEL_CALL_COUNT);
  assert.equal(input.consolidation_commits.length, 2);
  assert.equal(input.first_pass_review_reports.length, 2);
  assert.equal(input.attempt_3.revised_decision_vector_v3.schema_version, 'M3_12_CALL_ITERATION_2_REVISED_DECISION_VECTOR/V3');
  assert.equal(input.live_execution.work_results.length, 8);
  assert.deepEqual(input.post_run_metrics.profile_counts, { SOL_HIGH: 2, TERRA_MEDIUM: 6 });
  assert.equal(input.post_run_metrics.resolution_totals.resolved, 36);
  assert.deepEqual(input.questions.map((question) => question.question_id), [
    'FALSE_POSITIVES', 'FALSE_NEGATIVES', 'TAXONOMY_LEAKAGE', 'CITATION_INTEGRITY',
    'RESOLVER_OVERREACH', 'ALL_FAMILIES_AND_FULL_CORPUS_LESSONS',
  ]);
  assert.equal(validateIteration2AdversarialAuditInput(input), input);
});

test('fails closed when live execution or sealed V3 bindings do not match the plan', () => {
  const wrongLiveProfile = fixture();
  wrongLiveProfile.live_execution.work_results[0].profile_id = 'SOL_HIGH';
  assert.throws(
    () => buildIteration2AdversarialAuditInput(wrongLiveProfile),
    (error) => error instanceof Iteration2AdversarialAuditError && error.code === 'INVALID_LIVE_EXECUTION',
  );
  const wrongVectorBinding = fixture();
  wrongVectorBinding.attempt_3.revised_decision_vector_v3.bindings.iteration_2_rerun_plan_id = hash('9');
  assert.throws(
    () => buildIteration2AdversarialAuditInput(wrongVectorBinding),
    (error) => error instanceof Iteration2AdversarialAuditError && error.code === 'ATTEMPT_3_VECTOR_MISMATCH',
  );
});

test('fails closed when a sealed audit input is changed after identity creation', () => {
  const input = buildIteration2AdversarialAuditInput(fixture());
  const changed = {
    ...input,
    post_run_metrics: {
      ...input.post_run_metrics,
      profile_counts: { ...input.post_run_metrics.profile_counts, SOL_HIGH: 3 },
    },
  };
  assert.throws(
    () => validateIteration2AdversarialAuditInput(changed),
    (error) => error instanceof Iteration2AdversarialAuditError && error.code === 'ADVERSARIAL_AUDIT_INPUT_ID_MISMATCH',
  );
});
