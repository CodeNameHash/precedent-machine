'use strict';

const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');
const { pathToFileURL } = require('node:url');
const { test } = require('node:test');

const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('../lib/canonical-v2/canonical-bytes');

const REPO_ROOT = join(__dirname, '..');
const SCRIPT_PATH = join(
  REPO_ROOT,
  'scripts/stage-2y-structure-m7-v2-work3-closure-amendment-candidate.mjs',
);
const WORK3_RECEIPT_PATH = join(
  REPO_ROOT,
  'evidence/canonical-v2/stage-2y-structure-migration/receipts/'
    + 'stage-2y-structure-m7-v2-repair-work3-profile.json',
);
const EXTERNAL_REVIEW_RECEIPT_ID_FIELD =
  'work3_closure_amendment_external_review_receipt_id';

let loaded;
async function subject() {
  if (loaded === undefined) loaded = import(pathToFileURL(SCRIPT_PATH));
  return loaded;
}

function restamp(record) {
  const unsigned = { ...record };
  delete unsigned.closure_amendment_id;
  record.closure_amendment_id = contentId(record.schema_version, unsigned);
  return record;
}

function restampExternalReviewReceipt(record) {
  const unsigned = { ...record };
  delete unsigned[EXTERNAL_REVIEW_RECEIPT_ID_FIELD];
  record[EXTERNAL_REVIEW_RECEIPT_ID_FIELD] = contentId(
    record.schema_version,
    unsigned,
  );
  return record;
}

function canonicalRecordBytes(record) {
  return Buffer.from(`${canonicalJson(record)}\n`, 'utf8');
}

function validateExternalReviewReceipt(module, receipt, receiptBytes) {
  return module.validateExternalReviewReceipt(
    receipt,
    receiptBytes ?? canonicalRecordBytes(receipt),
    {
      observedReviewTargetCommitBinding:
        structuredClone(receipt.review_target_commit_binding),
    },
  );
}

function gitBlobOid(value) {
  return createHash('sha1').update(Buffer.concat([
    Buffer.from(`blob ${value.length}\0`, 'utf8'),
    value,
  ])).digest('hex');
}

test('Work3 closure amendment candidate is the exact 24-sealed plus parked closure', async () => {
  const module = await subject();
  const expected = module.buildWork3ClosureAmendmentCandidate();
  const candidatePath = join(REPO_ROOT, module.CANDIDATE_PATH);
  const actual = JSON.parse(readFileSync(candidatePath, 'utf8'));
  const result = module.validateWork3ClosureAmendmentCandidate(actual, expected);

  assert.deepEqual(actual, expected);
  assert.deepEqual(result, {
    artifact_binding_count: 52,
    closure_amendment_id: actual.closure_amendment_id,
    create_once_output_count: 7,
    effective_path_count: 53,
    family_count: 25,
    full_set_profile_count: 1383,
    parked_family_count: 1,
    sealed_family_package_count: 24,
    sealed_profile_count: 1382,
    state: 'AUTHORIZED_BY_DECISION_22_PENDING_EXTERNAL_REVIEW_AND_APPLICATION',
  });
  assert.deepEqual(actual.landing_preconditions, [
    'REVIEW_TARGET_TRIO_COMMIT_PUBLISHED_FOR_EXTERNAL_REVIEW_ONLY',
    'EXTERNAL_CROSS_VENDOR_REVIEW_PASS',
    'EXACT_CANDIDATE_BYTES_UNCHANGED',
  ]);
  assert.equal(
    actual.work3_receipt_creation_requires,
    'PUBLISHED_REVIEW_TARGET_COMMIT_THEN_EXTERNAL_REVIEW_PASS_RECEIPT_THEN_'
    + 'AMENDMENT_LANDED_WITH_PASS_RECEIPT_THEN_'
    + 'VALID_ZERO_EFFECT_APPLICATION_RECEIPT_THEN_VALID_SUCCESSOR_MANIFEST',
  );
  assert.deepEqual(actual.review_publication_contract, {
    application_effect_count: 0,
    authority_effect_count: 0,
    exact_commit_paths: [
      'evidence/canonical-v2/stage-2y-structure-migration/control/'
      + 'm7-v2-repair-work3-execution-manifest-closure-amendment.json',
      'scripts/stage-2y-structure-m7-v2-work3-closure-amendment-candidate.mjs',
      'tests/stage-2y-structure-m7-v2-work3-closure-amendment-candidate.test.js',
    ],
    external_review_receipt_write_count: 0,
    legal_semantic_change_count: 0,
    product_write_count: 0,
    publication_is_application: false,
    publication_is_sealed_closure: false,
    sealed_closure_effect_count: 0,
    state: 'PUBLISHED_FOR_EXTERNAL_REVIEW_ONLY',
    successor_manifest_write_count: 0,
    work3_receipt_write_count: 0,
  });
  assert.deepEqual(actual.authority_basis.capitalisation_parking_ruling, {
    ruling_id: 'BEN_2026_08_08_CAPITALISATION_PARKED_UNTIL_STAGE_9F',
    rule_text: 'Keep capitalisation parked until Stage 9F.',
    source_binding: actual.authority_basis.capitalisation_parking_ruling.source_binding,
    source_line: 1133,
  });
  assert.equal(
    actual.authority_basis.capitalisation_parking_ruling.source_binding.path,
    'docs/core/PLAN.md',
  );
  assert.equal(actual.zero_effect_boundary.legal_grouping_review_closure_count, 0);
  assert.equal(actual.zero_effect_boundary.legal_semantic_change_count, 0);
  assert.equal(actual.zero_effect_boundary.remaining_review_states, 'PRESERVED');
  assert.equal(existsSync(WORK3_RECEIPT_PATH), false);
});

test('Work3 closure amendment freezes the complete seven-output preservation-close overlay', async () => {
  const module = await subject();
  const candidate = module.buildWork3ClosureAmendmentCandidate();
  const closure = candidate.effective_family_package_closure;
  const transaction = candidate.preservation_close_transaction_contract_overlay;
  const approvedSet = candidate.approved_profile_set_contract_overlay;
  const receipt = candidate.receipt_contract_overlay;
  const successorManifest = candidate.successor_manifest_contract_overlay;
  const artifactInventory = candidate.exact_artifact_inventory_overlay;
  const rootPolicy = candidate.root_execution_policy_overlay.effective_execution_policy;
  const packagePaths = new Set(
    closure.sealed_family_packages.map((entry) => entry.package_binding.path),
  );

  assert.equal(closure.governed_family_keys.length, 25);
  assert.equal(closure.sealed_family_keys.length, 24);
  assert.equal(closure.full_set_validation.family_package_count, 25);
  assert.equal(closure.full_set_validation.profile_count, 1383);
  assert.equal(closure.full_set_validation.dimension_evidence_count, 1383);
  assert.deepEqual(closure.sealed_member_inventory.totals, {
    dimension_evidence_count: 1382,
    match_fixture_count: 2866,
    profile_count: 1382,
    structure_fixture_member_count: 1,
    subtype_tree_count: 24,
    total_package_member_count: 5655,
  });

  assert.equal(transaction.immutable_pre_existing_evidence_input_count, 24);
  assert.equal(transaction.predecessor_package_outputs_reclassified_as_immutable_inputs, 24);
  assert.equal(transaction.create_once_output_count, 7);
  assert.equal(transaction.non_receipt_output_count, 6);
  assert.equal(transaction.create_once_output_paths.length, 7);
  assert.equal(transaction.create_once_output_paths.at(-1),
    'evidence/canonical-v2/stage-2y-structure-migration/receipts/'
    + 'stage-2y-structure-m7-v2-repair-work3-profile.json');
  assert.equal(
    transaction.create_once_output_paths.some((path) => packagePaths.has(path)),
    false,
  );
  assert.equal(transaction.allowed_effects.family_profile_package_writes, 0);
  assert.equal(transaction.finalisation_contract.target_count, 7);
  assert.equal(
    transaction.finalisation_contract.clean_rollback_contract.verify_all_7_targets_absent,
    true,
  );
  assert.equal(
    transaction.finalisation_contract.write_order,
    'EXACT_6_NON_RECEIPT_OUTPUTS_IN_CREATE_ONCE_PATH_ORDER_THEN_RECEIPT_LAST',
  );
  assert.equal(rootPolicy.allowed_effects.create_once_output_writes, 7);
  assert.equal(rootPolicy.allowed_effects.family_profile_package_writes, 0);
  assert.deepEqual(
    rootPolicy.allowed_effects.named_repository_writes,
    transaction.create_once_output_paths,
  );
  assert.equal(rootPolicy.work3_commands[0].argv[2],
    candidate.successor_manifest_contract_overlay.path);
  assert.deepEqual(rootPolicy.success_conditions,
    candidate.successor_manifest_contract_overlay.success_conditions);

  assert.equal(approvedSet.family_profile_package_binding_count, 24);
  assert.equal(approvedSet.profile_count, 1382);
  assert.equal(approvedSet.dimension_evidence_binding_count, 1382);
  assert.equal(approvedSet.subtype_tree_binding_count, 24);
  assert.equal(approvedSet.family_key_order.includes('CAPITALISATION'), false);
  assert.equal(approvedSet.package_path_mapping.length, 24);

  assert.equal(artifactInventory.derivation.equation, '49_MINUS_9_PLUS_8_PLUS_4_EQUALS_52');
  assert.equal(artifactInventory.artifact_binding_count, 52);
  assert.equal(artifactInventory.effective_path_count, 53);
  assert.equal(artifactInventory.derivation.removed_package_path_count, 9);
  assert.equal(artifactInventory.derivation.added_successor_package_path_count, 8);
  assert.equal(artifactInventory.governance_chain_paths.length, 4);
  assert.equal(artifactInventory.record_id_categories.length, 12);
  assert.equal(
    artifactInventory.record_id_categories.find(
      (category) => category.record_id_field === 'family_profile_package_id',
    ).paths.length,
    24,
  );
  assert.equal(artifactInventory.artifact_binding_paths.includes(
    closure.capitalisation.planned_package_path,
  ), false);

  assert.equal(receipt.schema_version, 'STAGE_2Y_M7_V2_REPAIR_WORK3_RECEIPT/V2');
  assert.equal(receipt.exact_keys.length, 31);
  assert.equal(receipt.create_once_output_paths.length, 7);
  assert.equal(receipt.counts_contract.exact_values.family_key_count, 25);
  assert.equal(receipt.counts_contract.exact_values.family_profile_package_count, 24);
  assert.equal(receipt.counts_contract.exact_values.parked_family_count, 1);
  assert.equal(receipt.counts_contract.exact_values.profile_count, 1382);
  assert.equal(receipt.counts_contract.exact_values.dimension_evidence_count, 1382);
  assert.equal(receipt.counts_contract.exact_values.structure_fixture_member_count, 1);
  assert.equal(receipt.counts_contract.exact_values.subtype_tree_binding_count, 24);
  assert.equal(receipt.counts_contract.exact_values.create_once_output_count, 7);
  assert.equal(receipt.effects_contract.exact_values.files_written, 7);
  assert.equal(receipt.effects_contract.exact_values.family_profile_package_writes, 0);
  assert.equal(receipt.family_profile_evidence_contract.governed_family_keys.length, 25);
  assert.equal(receipt.family_profile_evidence_contract.sealed_package_family_keys.length, 24);
  assert.equal(
    receipt.checks_contract.exact_ordered_checks[1].check_id,
    'EXECUTION_MANIFEST_P53_SUCCESSOR',
  );
  assert.equal(
    receipt.checks_contract.exact_ordered_checks[4].check_id,
    'TWENTY_FOUR_SEALED_FAMILY_PACKAGES_AND_CAPITALISATION_PARKED',
  );
  assert.equal(
    receipt.command_execution_ledger_contract.argv_order[4][2],
    'evidence/canonical-v2/stage-2y-structure-migration/control/'
    + 'm7-v2-repair-work3-execution-manifest-closure-successor.json',
  );
  assert.equal(
    receipt.command_execution_ledger_contract.state_ranges[2].state,
    'WRITES_SEVEN_CREATE_ONCE_OUTPUTS_AND_THIS_RECEIPT',
  );
  assert.deepEqual(
    candidate.work3_execution_fixture_contract_overlay.effective_contract
      .command_run_counts.argv_order,
    receipt.command_execution_ledger_contract.argv_order,
  );
  assert.equal(receipt.repository_precondition_contract.generated_paths_absent.length, 7);
  assert.equal(
    receipt.repository_precondition_contract.immutable_pre_existing_package_bindings.length,
    24,
  );

  assert.equal(successorManifest.path_count, 53);
  assert.equal(successorManifest.manifest_write_path_count, 7);
  assert.equal(successorManifest.permitted_write_paths.length, 7);
  assert.equal(successorManifest.allowed_effects.family_profile_package_writes, 0);
  assert.equal(successorManifest.record_exact_keys.length, 27);
  assert.equal(successorManifest.record_added_exact_keys.length, 4);
  assert.equal(successorManifest.exact_argv_with_run_limits[0].argv[2],
    successorManifest.path);
  assert.equal(successorManifest.scope_equalities.git_add_paths,
    'EXACT_SEVEN_PRESERVATION_CLOSE_OUTPUT_PATHS');
  assert.equal(successorManifest.stop_conditions.includes(
    'ANY_OF_24_SEALED_INPUT_BINDINGS_MISSING_OR_BYTE_IDENTITY_DRIFTED',
  ), true);
  assert.equal(successorManifest.permitted_read_paths.includes(
    'evidence/canonical-v2/stage-2y-structure-migration/preparation/m5/'
    + 'calibration-packs/CAPITALISATION.json',
  ), true);
  assert.equal(
    candidate.work4_consumer_contract_overlay.exact_sealed_subtype_tree_binding_count,
    24,
  );
  assert.equal(
    candidate.work4_consumer_contract_overlay.exact_values.work4_required_bindings
      .includes('CAPITALISATION_PARKED_CLOSURE_BINDING'),
    true,
  );
  assert.equal(
    candidate.rich_work3_receipt_consumer_contract_overlay
      .closure_v2_contract.exact_key_count,
    31,
  );
  assert.equal(
    candidate.rich_work3_receipt_consumer_contract_overlay
      .legacy_v1_contract.remains_valid_for_legacy_v1_receipts,
    true,
  );
  assert.equal(
    candidate.landing_review_and_application_sequence.application_receipt_contract
      .binding_to_successor_manifest_forbidden,
    true,
  );

  const serialised = JSON.stringify(candidate);
  assert.equal(serialised.includes('"amendment_landed"'), false);
  assert.equal(serialised.includes('"external_review_receipt_binding":null'), false);
});

test('Work3 closure amendment rejects publication-only commit treated as application', async () => {
  const module = await subject();
  const expected = module.buildWork3ClosureAmendmentCandidate();
  const forged = structuredClone(expected);
  forged.review_publication_contract.publication_is_application = true;
  forged.review_publication_contract.application_effect_count = 1;
  restamp(forged);

  assert.throws(
    () => module.validateWork3ClosureAmendmentCandidate(forged, expected),
    /differs from the exact live closure/,
  );
});

test('Work3 closure amendment rejects publication-only commit treated as sealed closure', async () => {
  const module = await subject();
  const expected = module.buildWork3ClosureAmendmentCandidate();
  const forged = structuredClone(expected);
  forged.review_publication_contract.state = 'LANDED_WITH_PASS_RECEIPT';
  forged.review_publication_contract.publication_is_sealed_closure = true;
  forged.review_publication_contract.sealed_closure_effect_count = 1;
  restamp(forged);

  assert.throws(
    () => module.validateWork3ClosureAmendmentCandidate(forged, expected),
    /differs from the exact live closure/,
  );
});

test('Work3 closure amendment binds every sealed package and no Capitalisation package', async () => {
  const module = await subject();
  const candidate = module.buildWork3ClosureAmendmentCandidate();
  const closure = candidate.effective_family_package_closure;
  const sealedFamilies = closure.sealed_family_packages.map((entry) => entry.family_key);
  const sealedPaths = closure.sealed_family_packages.map(
    (entry) => entry.package_binding.path,
  );

  assert.equal(new Set(sealedFamilies).size, 24);
  assert.equal(new Set(sealedPaths).size, 24);
  assert.equal(sealedFamilies.includes('CAPITALISATION'), false);
  for (const entry of closure.sealed_family_packages) {
    const binding = entry.package_binding;
    const value = readFileSync(join(REPO_ROOT, binding.path));
    const record = JSON.parse(value.toString('utf8'));
    assert.equal(value.length, binding.byte_length, binding.path);
    assert.equal(sha256Hex(value), binding.sha256, binding.path);
    assert.equal(gitBlobOid(value), binding.git_blob_oid, binding.path);
    assert.equal(record.schema_version, binding.schema_version, binding.path);
    assert.equal(record[binding.record_id_field], binding.record_id, binding.path);
    assert.equal(record.family_key, entry.family_key, binding.path);
  }
  assert.deepEqual(closure.capitalisation, {
    family_key: 'CAPITALISATION',
    on_disk_package_binding: null,
    on_disk_package_present: false,
    parked_state: 'PARKED',
    planned_package_path:
      'evidence/canonical-v2/stage-2y-structure-migration/control/'
      + 'm7-v2-repair-family-work3-profile-package-capitalisation.json',
    product_activation_permitted: false,
    serving_permitted: false,
    stage_9f_authority_required: true,
    synthetic_validation_package: {
      package_id: closure.capitalisation.synthetic_validation_package.package_id,
      profile_count: 1,
      state: 'IN_MEMORY_VALIDATION_ONLY_NOT_A_SEALED_PACKAGE',
    },
  });
  assert.equal(
    existsSync(join(REPO_ROOT, closure.capitalisation.planned_package_path)),
    false,
  );
});

test('Work3 closure amendment freezes an exact cross-vendor PASS review receipt', async () => {
  const module = await subject();
  const candidate = module.buildWork3ClosureAmendmentCandidate();
  const contract = candidate.external_review_receipt_contract;
  const receipt = module.buildExternalReviewReceiptTestFixture();
  const result = validateExternalReviewReceipt(module, receipt);

  assert.deepEqual(result, {
    amendment_id: candidate.closure_amendment_id,
    external_review_receipt_id: receipt[EXTERNAL_REVIEW_RECEIPT_ID_FIELD],
    status: 'PASS',
  });
  assert.deepEqual(contract.base_commit_binding, {
    commit_sha: '05b5c49bd549a1d985bb3d888ee92fc313ac88df',
    parent_commit_sha: 'b167a3ed3353bb0b8f42855636b78ad9c8a137b7',
    tree_sha: 'c7e738bfaca3dfb47e8f49b63517c33179d71312',
  });
  assert.equal(
    contract.base_commit_role,
    'IMMUTABLE_PRE_BUNDLE_AUTHORITY_BASE_NOT_THE_REVIEW_TARGET_COMMIT',
  );
  assert.equal(contract.exact_keys.length, 14);
  assert.equal(contract.checks_exact_value.length, 11);
  assert.deepEqual(contract.findings_exact_value, []);
  assert.deepEqual(
    contract.review_target_commit_binding_contract.changed_paths_exact_value,
    candidate.review_publication_contract.exact_commit_paths,
  );
  assert.equal(
    contract.review_target_commit_binding_contract
      .authority_base_parent_commit_sha_exact_value,
    contract.base_commit_binding.commit_sha,
  );
  assert.equal(
    Object.hasOwn(
      contract.review_target_commit_binding_contract,
      'review_target_commit_sha_exact_value',
    ),
    false,
  );
  assert.equal(
    contract.review_target_commit_binding_contract.branch_exact_value,
    'codex/recover-m7-20260812',
  );
  assert.equal(
    contract.review_target_commit_binding_contract.remote_ref_exact_value,
    'origin/codex/recover-m7-20260812',
  );
  assert.equal(
    contract.review_target_commit_binding_contract.origin_url_exact_value,
    'https://github.com/CodeNameHash/precedent-machine.git',
  );
  assert.equal(
    contract.review_target_commit_binding_contract.live_remote_ref_exact_value,
    'refs/heads/codex/recover-m7-20260812',
  );
  assert.deepEqual(
    contract.review_target_commit_binding_contract.live_remote_verification_argv,
    [
      'git',
      'ls-remote',
      '--exit-code',
      'https://github.com/CodeNameHash/precedent-machine.git',
      'refs/heads/codex/recover-m7-20260812',
    ],
  );
  assert.equal(
    contract.reviewer_identity_contract.authoring_vendor_id_exact_value,
    'OPENAI',
  );
  assert.deepEqual(contract.reviewer_identity_contract.exact_keys, [
    'authoring_vendor_id',
    'reviewer_instance_id',
    'reviewer_model_id',
    'reviewer_vendor_id',
  ]);
  assert.deepEqual(
    contract.reviewer_identity_contract.reviewer_model_id_contract,
    {
      exact_value: 'WITHHELD_BY_HOST_POLICY',
      required: true,
      value_rule: 'EXACT_WITHHELD_BY_HOST_POLICY',
    },
  );
  assert.deepEqual(contract.independence_attestation_exact_value, {
    cross_vendor_review: true,
    reviewer_model_identity_or_host_withholding_state_recorded: true,
    reviewer_not_authoring_session: true,
    reviewer_vendor_differs_from_authoring_vendor: true,
  });
  for (const binding of [
    contract.reviewed_artifact_binding_contracts.generator_binding,
    contract.reviewed_artifact_binding_contracts.test_binding,
  ]) {
    const value = readFileSync(join(REPO_ROOT, binding.path));
    assert.equal(value.length, binding.byte_length, binding.path);
    assert.equal(sha256Hex(value), binding.sha256, binding.path);
    assert.equal(gitBlobOid(value), binding.git_blob_oid, binding.path);
  }
});

test('external review receipt rejects a re-signed stale base commit', async () => {
  const module = await subject();
  const receipt = module.buildExternalReviewReceiptTestFixture();
  receipt.base_commit_binding.commit_sha = '0'.repeat(40);
  restampExternalReviewReceipt(receipt);

  assert.throws(
    () => validateExternalReviewReceipt(module, receipt),
    /exact PASS contract is invalid/,
  );
});

test('external review receipt rejects a re-signed forged generator binding', async () => {
  const module = await subject();
  const receipt = module.buildExternalReviewReceiptTestFixture();
  receipt.reviewed_artifact_bindings.generator_binding.sha256 = '0'.repeat(64);
  restampExternalReviewReceipt(receipt);

  assert.throws(
    () => validateExternalReviewReceipt(module, receipt),
    /three-file bindings are invalid/,
  );
});

test('external review receipt rejects a re-signed forged authoring vendor', async () => {
  const module = await subject();
  const receipt = module.buildExternalReviewReceiptTestFixture();
  receipt.reviewer_identity.authoring_vendor_id = 'FORGED_AUTHOR_VENDOR';
  restampExternalReviewReceipt(receipt);

  assert.throws(
    () => validateExternalReviewReceipt(module, receipt),
    /not independently identified cross-vendor review/,
  );
});

test('external review receipt rejects author-vendor aliases as reviewer identity', async () => {
  const module = await subject();
  for (const reviewerVendorId of [
    'OPENAI',
    'OpenAI',
    'open-ai',
    'OPENAI_REVIEW',
    'ChatGPT',
    'CODEX_REVIEW',
  ]) {
    const receipt = module.buildExternalReviewReceiptTestFixture({ reviewerVendorId });
    assert.throws(
      () => validateExternalReviewReceipt(module, receipt),
      /not independently identified cross-vendor review/,
      reviewerVendorId,
    );
  }
});

test('external review receipt accepts exact host-policy withholding for reviewer model', async () => {
  const module = await subject();
  const receipt = module.buildExternalReviewReceiptTestFixture({
    reviewerModelId: 'WITHHELD_BY_HOST_POLICY',
  });

  assert.equal(validateExternalReviewReceipt(module, receipt).status, 'PASS');
});

test('external review receipt rejects missing or aliased host-policy model values', async () => {
  const module = await subject();
  for (const reviewerModelId of [
    '',
    'UNKNOWN',
    'UNAVAILABLE',
    'REDACTED',
    'HOST_POLICY_WITHHELD',
    'WITHHELD_BY_HOST_POLICY ',
    'withheld_by_host_policy',
    'WITHHELD-BY-HOST-POLICY',
    'WITHHELD_BY_HOST_POLICY_ALIAS',
  ]) {
    const receipt = module.buildExternalReviewReceiptTestFixture({ reviewerModelId });
    assert.throws(
      () => validateExternalReviewReceipt(module, receipt),
      /not independently identified cross-vendor review/,
      reviewerModelId,
    );
  }
});

test('external review receipt rejects the contradictory old model attestation', async () => {
  const module = await subject();
  const receipt = module.buildExternalReviewReceiptTestFixture({
    reviewerModelId: 'WITHHELD_BY_HOST_POLICY',
  });
  delete receipt.independence_attestation
    .reviewer_model_identity_or_host_withholding_state_recorded;
  receipt.independence_attestation.reviewer_model_identity_recorded = true;
  restampExternalReviewReceipt(receipt);

  assert.throws(
    () => validateExternalReviewReceipt(module, receipt),
    /exact PASS contract is invalid/,
  );
});

test('external review receipt rejects live remote drift despite matching local origin ref', async () => {
  const module = await subject();
  const receipt = module.buildExternalReviewReceiptTestFixture();
  const observed = structuredClone(receipt.review_target_commit_binding);
  observed.live_remote_commit_sha = '3'.repeat(40);

  assert.throws(
    () => module.validateExternalReviewReceipt(
      receipt,
      canonicalRecordBytes(receipt),
      { observedReviewTargetCommitBinding: observed },
    ),
    /pushed review-target commit observation is invalid/,
  );
});

test('external review receipt rejects a stale local origin tracking ref', async () => {
  const module = await subject();
  const receipt = module.buildExternalReviewReceiptTestFixture();
  const observed = structuredClone(receipt.review_target_commit_binding);
  observed.remote_ref_commit_sha = '4'.repeat(40);

  assert.throws(
    () => module.validateExternalReviewReceipt(
      receipt,
      canonicalRecordBytes(receipt),
      { observedReviewTargetCommitBinding: observed },
    ),
    /pushed review-target commit observation is invalid/,
  );
});

test('external review receipt rejects a re-signed forged target path blob', async () => {
  const module = await subject();
  const receipt = module.buildExternalReviewReceiptTestFixture();
  receipt.review_target_commit_binding.path_blob_bindings[0].git_blob_oid =
    '4'.repeat(40);
  restampExternalReviewReceipt(receipt);

  assert.throws(
    () => validateExternalReviewReceipt(module, receipt),
    /review-target commit binding is invalid/,
  );
});

test('external review receipt rejects re-signed non-PASS or non-empty findings', async () => {
  const module = await subject();
  const nonPass = module.buildExternalReviewReceiptTestFixture();
  nonPass.status = 'FAIL';
  restampExternalReviewReceipt(nonPass);
  assert.throws(
    () => validateExternalReviewReceipt(module, nonPass),
    /exact PASS contract is invalid/,
  );

  const finding = module.buildExternalReviewReceiptTestFixture();
  finding.findings = [{ finding_id: 'unexpected-added-authority' }];
  restampExternalReviewReceipt(finding);
  assert.throws(
    () => validateExternalReviewReceipt(module, finding),
    /exact PASS contract is invalid/,
  );
});

test('external review receipt rejects non-canonical physical bytes', async () => {
  const module = await subject();
  const receipt = module.buildExternalReviewReceiptTestFixture();
  const nonCanonicalBytes = Buffer.concat([
    canonicalRecordBytes(receipt),
    Buffer.from('\n', 'utf8'),
  ]);

  assert.throws(
    () => validateExternalReviewReceipt(module, receipt, nonCanonicalBytes),
    /bytes are not canonical JSON plus one LF/,
  );
});

test('Work3 closure amendment rejects a re-signed forged sealed package binding', async () => {
  const module = await subject();
  const expected = module.buildWork3ClosureAmendmentCandidate();
  const forged = structuredClone(expected);
  forged.effective_family_package_closure.sealed_family_packages[0]
    .package_binding.sha256 = '0'.repeat(64);
  restamp(forged);

  assert.throws(
    () => module.validateWork3ClosureAmendmentCandidate(forged, expected),
    /differs from the exact live closure/,
  );
});

test('Work3 closure amendment rejects a re-signed unparked Capitalisation state', async () => {
  const module = await subject();
  const expected = module.buildWork3ClosureAmendmentCandidate();
  const forged = structuredClone(expected);
  forged.effective_family_package_closure.capitalisation.parked_state = 'SEALED';
  forged.effective_family_package_closure.capitalisation.on_disk_package_present = true;
  restamp(forged);

  assert.throws(
    () => module.validateWork3ClosureAmendmentCandidate(forged, expected),
    /differs from the exact live closure/,
  );
});

test('Work3 closure amendment rejects a re-signed 23-package omission', async () => {
  const module = await subject();
  const expected = module.buildWork3ClosureAmendmentCandidate();
  const forged = structuredClone(expected);
  const removed = forged.effective_family_package_closure.sealed_family_packages.pop();
  forged.effective_family_package_closure.sealed_family_package_count = 23;
  forged.effective_family_package_closure.sealed_profile_count -= removed.profile_count;
  restamp(forged);

  assert.throws(
    () => module.validateWork3ClosureAmendmentCandidate(forged, expected),
    /differs from the exact live closure/,
  );
});

test('Work3 closure amendment rejects a re-signed duplicate package substitution', async () => {
  const module = await subject();
  const expected = module.buildWork3ClosureAmendmentCandidate();
  const forged = structuredClone(expected);
  forged.effective_family_package_closure.sealed_family_packages[1]
    .package_binding = structuredClone(
      forged.effective_family_package_closure.sealed_family_packages[0].package_binding,
    );
  restamp(forged);

  assert.throws(
    () => module.validateWork3ClosureAmendmentCandidate(forged, expected),
    /differs from the exact live closure/,
  );
});

test('Work3 closure amendment rejects a re-signed second parked family', async () => {
  const module = await subject();
  const expected = module.buildWork3ClosureAmendmentCandidate();
  const forged = structuredClone(expected);
  forged.effective_family_package_closure.parked_family_count = 2;
  forged.effective_family_package_closure.additional_parked_family_keys = [
    'ANTITRUST_REGULATORY',
  ];
  restamp(forged);

  assert.throws(
    () => module.validateWork3ClosureAmendmentCandidate(forged, expected),
    /differs from the exact live closure/,
  );
});

test('Work3 closure amendment rejects synthetic Capitalisation promoted as sealed evidence', async () => {
  const module = await subject();
  const expected = module.buildWork3ClosureAmendmentCandidate();
  const forged = structuredClone(expected);
  const capitalisation = forged.effective_family_package_closure.capitalisation;
  const syntheticBinding = {
    byte_length: 0,
    git_blob_oid: '0'.repeat(40),
    path: capitalisation.planned_package_path,
    record_id: capitalisation.synthetic_validation_package.package_id,
    record_id_field: 'family_profile_package_id',
    schema_version: 'STAGE_2Y_M7_V2_FAMILY_PROFILE_PACKAGE/V2',
    sha256: '0'.repeat(64),
  };
  forged.effective_family_package_closure.sealed_family_packages.push({
    family_key: 'CAPITALISATION',
    package_binding: syntheticBinding,
    profile_count: 1,
  });
  forged.effective_family_package_closure.sealed_family_package_count = 25;
  forged.effective_family_package_closure.sealed_profile_count = 1383;
  capitalisation.on_disk_package_binding = syntheticBinding;
  capitalisation.on_disk_package_present = true;
  capitalisation.parked_state = 'SEALED';
  restamp(forged);

  assert.throws(
    () => module.validateWork3ClosureAmendmentCandidate(forged, expected),
    /differs from the exact live closure/,
  );
});

test('Work3 closure amendment rejects a re-signed stale predecessor binding', async () => {
  const module = await subject();
  const expected = module.buildWork3ClosureAmendmentCandidate();
  const forged = structuredClone(expected);
  forged.predecessor_work3_execution_manifest_binding.sha256 = '0'.repeat(64);
  restamp(forged);

  assert.throws(
    () => module.validateWork3ClosureAmendmentCandidate(forged, expected),
    /differs from the exact live closure/,
  );
});
