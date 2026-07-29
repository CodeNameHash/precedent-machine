const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  compileCanonicalContractInput,
} = require('../lib/canonical-v2/canonical-contract-input-compiler');
const {
  validateAuthoredProductQueryActionInputs,
} = require(
  '../lib/canonical-v2/product-query-action-contract-input-validator',
);

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
    loadMember('product/query/product-rerun-on-active-release.v1.json'),
    loadMember('product/query/product-saved-query-definition.v1.json'),
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

test('registers the PM-wide saved-query and active-release rerun contracts', () => {
  const members = actionMembers();
  assert.doesNotThrow(
    () => validateAuthoredProductQueryActionInputs(members),
  );
  assert.deepEqual(
    members.map((member) => member.canonical_value.stable_id),
    [
      'PRODUCT_RERUN_ON_ACTIVE_RELEASE',
      'PRODUCT_SAVED_QUERY_DEFINITION',
    ],
  );
});

test('binds saved legal meaning to Product Query IR without a cursor', () => {
  const saved = byId(actionMembers(), 'PRODUCT_SAVED_QUERY_DEFINITION');
  assert.equal(saved.domain_key, 'PRODUCT');
  assert.equal(
    saved.definition_contract.query_ir_definition_stable_id,
    'PRODUCT_QUERY_IR',
  );
  assert.equal(
    saved.definition_contract.query_ir_schema_version,
    'PRODUCT_QUERY_IR/V1',
  );
  assert.equal(
    saved.definition_contract.exactly_one_admitted_domain_plan_required,
    true,
  );
  assert.deepEqual(saved.definition_contract.release_modes, [
    'PINNED',
    'FOLLOW_ACTIVE',
  ]);
  assert.equal(saved.definition_contract.cursor_permitted, false);
  assert.equal(saved.definition_contract.bare_release_id_permitted, false);
});

test('keeps pinned and follow-active release handling explicit', () => {
  const saved = byId(actionMembers(), 'PRODUCT_SAVED_QUERY_DEFINITION');
  assert.equal(
    saved.pinned_release_contract
      .exact_candidate_release_manifest_payload_digest_required,
    true,
  );
  assert.equal(
    saved.pinned_release_contract
      .silent_active_release_substitution_permitted,
    false,
  );
  assert.equal(
    saved.follow_active_contract
      .recompile_against_product_query_contract_required,
    true,
  );
  assert.equal(
    saved.follow_active_contract
      .field_navigation_and_mapping_admission_revalidation_required,
    true,
  );
  assert.equal(
    saved.follow_active_contract
      .save_time_validation_can_authorise_execution,
    false,
  );
});

test('requires an explicit warned rerun through the same Product query door', () => {
  const rerun = byId(
    actionMembers(),
    'PRODUCT_RERUN_ON_ACTIVE_RELEASE',
  );
  assert.equal(
    rerun.eligibility_contract.source_definition_stable_id,
    'PRODUCT_SAVED_QUERY_DEFINITION',
  );
  assert.equal(rerun.eligibility_contract.explicit_user_action_required, true);
  assert.equal(
    rerun.eligibility_contract.changed_results_warning_required_before_action,
    true,
  );
  assert.equal(rerun.eligibility_contract.automatic_rerun_permitted, false);
  assert.equal(
    rerun.compilation_contract.query_ir_definition_stable_id,
    'PRODUCT_QUERY_IR',
  );
  assert.equal(rerun.compilation_contract.same_query_door_required, true);
  assert.equal(
    rerun.compilation_contract.nearest_predicate_substitution_permitted,
    false,
  );
  assert.equal(
    rerun.result_contract.original_saved_definition_remains_immutable,
    true,
  );
  assert.equal(rerun.result_contract.silent_redirect_permitted, false);
});

test('grants no saved-query, rerun, query or release authority', () => {
  for (const member of actionMembers()) {
    assert.deepEqual(
      Object.values(member.canonical_value.definition.authority_contract),
      [false, false, false, false, false, false, false],
    );
  }
});

test('rejects missing members and any self-rehashed semantic drift', () => {
  assert.throws(
    () => validateAuthoredProductQueryActionInputs(
      actionMembers().slice(1),
    ),
    { code: 'PRODUCT_QUERY_ACTION_CONTRACT_MEMBERSHIP_MISMATCH' },
  );

  const substituted = clone(actionMembers());
  byId(
    substituted,
    'PRODUCT_SAVED_QUERY_DEFINITION',
  ).pinned_release_contract.silent_active_release_substitution_permitted = true;
  assert.throws(
    () => validateAuthoredProductQueryActionInputs(substituted),
    { code: 'INVALID_PRODUCT_SAVED_QUERY_DEFINITION_INPUT' },
  );

  const silentRerun = clone(actionMembers());
  byId(
    silentRerun,
    'PRODUCT_RERUN_ON_ACTIVE_RELEASE',
  ).eligibility_contract.changed_results_warning_required_before_action = false;
  assert.throws(
    () => validateAuthoredProductQueryActionInputs(silentRerun),
    { code: 'INVALID_PRODUCT_ACTIVE_RELEASE_RERUN_INPUT' },
  );
});

test('compiles both Product query-action inputs without freeze authority', () => {
  const compiled = compileCanonicalContractInput({
    root_directory: ROOT,
  });
  assert.equal(
    compiled.authored_members.filter(
      (member) => member.object_kind === 'PRODUCT_QUERY_ACTION_CONTRACT_INPUT',
    ).length,
    2,
  );
  assert.equal(compiled.disposition.freeze_eligible, false);
  assert.equal(compiled.disposition.canonical_contract_bundle_authority, 'NONE');
});
