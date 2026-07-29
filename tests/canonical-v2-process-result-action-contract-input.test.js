const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  validateAuthoredProcessResultActionInputs,
} = require('../lib/canonical-v2/process-result-action-contract-input-validator');

const ROOT = path.join(__dirname, '../contracts/canonical-v2/successor');

function loadMember(relativePath) {
  const canonicalValue = JSON.parse(
    fs.readFileSync(path.join(ROOT, relativePath), 'utf8'),
  );
  return {
    object_kind: canonicalValue.object_kind,
    canonical_value: canonicalValue,
  };
}

function actionMembers() {
  return [
    loadMember(
      'process/actions/process-release-pinned-citation-and-share.v1.json',
    ),
    loadMember(
      'process/actions/process-rerun-on-active-release.v1.json',
    ),
    loadMember(
      'process/actions/process-saved-query-definition.v1.json',
    ),
    loadMember(
      'process/actions/process-selected-result-export.v1.json',
    ),
  ];
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function byId(members, stableId) {
  return members.find(
    (member) => member.canonical_value.stable_id === stableId,
  ).canonical_value.definition;
}

test('validates the four closed Process result-action definitions', () => {
  const members = actionMembers();
  assert.doesNotThrow(
    () => validateAuthoredProcessResultActionInputs(members),
  );
  assert.deepEqual(
    members.map((member) => member.canonical_value.stable_id),
    [
      'PROCESS_RELEASE_PINNED_CITATION_AND_SHARE',
      'PROCESS_RERUN_ON_ACTIVE_RELEASE',
      'PROCESS_SAVED_QUERY_DEFINITION',
      'PROCESS_SELECTED_RESULT_EXPORT',
    ],
  );
});

test('keeps saved queries cursor-free and release selection explicit', () => {
  const saved = byId(
    actionMembers(),
    'PROCESS_SAVED_QUERY_DEFINITION',
  );
  assert.deepEqual(saved.definition_contract.release_modes, [
    'PINNED',
    'FOLLOW_ACTIVE',
  ]);
  assert.equal(saved.definition_contract.cursor_free_semantic_template_required, true);
  assert.equal(saved.definition_contract.bare_release_id_permitted, false);
  assert.equal(saved.definition_contract.cursor_permitted, false);
  assert.equal(saved.definition_contract.serving_fence_version_permitted, false);
  assert.equal(saved.definition_contract.resolved_active_tuple_permitted, false);
  assert.equal(
    saved.pinned_release_contract.inactive_disposition,
    'RELEASE_NOT_ACTIVE',
  );
  assert.equal(
    saved.pinned_release_contract
      .silent_active_release_substitution_permitted,
    false,
  );
});

test('makes citation and share references exact, active and non-authorising', () => {
  const citation = byId(
    actionMembers(),
    'PROCESS_RELEASE_PINNED_CITATION_AND_SHARE',
  );
  assert.equal(
    citation.parent_binding_contract
      .exact_candidate_release_manifest_id_and_payload_digest_required,
    true,
  );
  assert.equal(citation.parent_binding_contract.exact_detail_reference_required, true);
  assert.equal(citation.citation_contract.verbatim_passage_required, true);
  assert.equal(citation.citation_contract.citation_can_rewrite_source_text, false);
  assert.equal(citation.citation_contract.citation_reference_is_bearer_token, false);
  assert.equal(citation.share_contract.active_release_required, true);
  assert.equal(citation.share_contract.inactive_disposition, 'RELEASE_NOT_ACTIVE');
  assert.equal(
    citation.share_contract.silent_redirect_or_result_substitution_permitted,
    false,
  );
});

test('keeps export bounded, set-based and complete without owning numeric policy', () => {
  const exported = byId(
    actionMembers(),
    'PROCESS_SELECTED_RESULT_EXPORT',
  );
  assert.equal(exported.selection_contract.typed_selected_row_keys_required, true);
  assert.equal(exported.selection_contract.mixed_release_selection_permitted, false);
  assert.equal(exported.content_contract.page_one_only_export_permitted, false);
  assert.equal(exported.content_contract.browser_corpus_hydration_permitted, false);
  assert.equal(exported.content_contract.silent_truncation_permitted, false);
  assert.equal(exported.execution_contract.server_side_bounded_execution_required, true);
  assert.equal(
    exported.execution_contract.one_set_based_statement_per_chunk_required,
    true,
  );
  assert.equal(
    exported.execution_contract
      .global_route_and_capacity_manifests_own_numeric_limits,
    true,
  );
  assert.equal(
    exported.execution_contract.domain_contract_can_select_numeric_limit,
    false,
  );
  assert.equal(exported.execution_contract.failed_or_partial_artefact_visible, false);
  assert.equal(exported.failure_contract.immediate_retry_permitted, false);
});

test('requires an explicit warned rerun and preserves the original result', () => {
  const rerun = byId(
    actionMembers(),
    'PROCESS_RERUN_ON_ACTIVE_RELEASE',
  );
  assert.equal(rerun.eligibility_contract.explicit_user_action_required, true);
  assert.equal(
    rerun.eligibility_contract.changed_results_warning_required_before_action,
    true,
  );
  assert.equal(rerun.eligibility_contract.automatic_rerun_permitted, false);
  assert.equal(
    rerun.compilation_contract
      .fresh_active_candidate_release_manifest_admission_required,
    true,
  );
  assert.equal(rerun.compilation_contract.same_query_door_required, true);
  assert.equal(rerun.compilation_contract.nearest_predicate_substitution_permitted, false);
  assert.equal(rerun.result_contract.original_saved_definition_remains_immutable, true);
  assert.equal(
    rerun.result_contract.original_citation_or_result_substitution_permitted,
    false,
  );
  assert.equal(rerun.result_contract.silent_redirect_permitted, false);
});

test('grants no action, query, serving, write, release, activation or freeze authority', () => {
  for (const member of actionMembers()) {
    assert.deepEqual(
      Object.values(member.canonical_value.definition.authority_contract),
      [false, false, false, false, false, false, false],
    );
  }
});

test('rejects incomplete, stale-substituting, truncated and silent-rerun contracts', () => {
  assert.throws(
    () => validateAuthoredProcessResultActionInputs(actionMembers().slice(1)),
    (error) => (
      error.code === 'PROCESS_RESULT_ACTION_CONTRACT_MEMBERSHIP_MISMATCH'
    ),
  );

  const substituted = clone(actionMembers());
  byId(
    substituted,
    'PROCESS_SAVED_QUERY_DEFINITION',
  ).pinned_release_contract.silent_active_release_substitution_permitted = true;
  assert.throws(
    () => validateAuthoredProcessResultActionInputs(substituted),
    (error) => error.code === 'INVALID_PROCESS_SAVED_QUERY_DEFINITION_INPUT',
  );

  const truncated = clone(actionMembers());
  byId(
    truncated,
    'PROCESS_SELECTED_RESULT_EXPORT',
  ).content_contract.silent_truncation_permitted = true;
  assert.throws(
    () => validateAuthoredProcessResultActionInputs(truncated),
    (error) => error.code === 'INVALID_PROCESS_SELECTED_RESULT_EXPORT_INPUT',
  );

  const silentRerun = clone(actionMembers());
  byId(
    silentRerun,
    'PROCESS_RERUN_ON_ACTIVE_RELEASE',
  ).eligibility_contract.changed_results_warning_required_before_action = false;
  assert.throws(
    () => validateAuthoredProcessResultActionInputs(silentRerun),
    (error) => error.code === 'INVALID_PROCESS_ACTIVE_RELEASE_RERUN_INPUT',
  );

  const historicalShare = clone(actionMembers());
  byId(
    historicalShare,
    'PROCESS_RELEASE_PINNED_CITATION_AND_SHARE',
  ).share_contract.historical_serving_permitted = true;
  assert.throws(
    () => validateAuthoredProcessResultActionInputs(historicalShare),
    (error) => error.code === 'INVALID_PROCESS_CITATION_AND_SHARE_INPUT',
  );
});
