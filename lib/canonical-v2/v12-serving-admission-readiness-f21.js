const fs = require('node:fs');

const {
  canonicalJson,
  contentId,
} = require('./canonical-bytes');
const {
  FIXTURE_CONTRACT_FINGERPRINT_V1,
  FIXTURE_CONTRACT_FINGERPRINT_V2,
  FIXTURE_CONTRACT_FINGERPRINT_V3,
  FIXTURE_CONTRACT_FINGERPRINT_V4,
  FIXTURE_CONTRACT_FINGERPRINT_V5,
  FIXTURE_CONTRACT_FINGERPRINT_V6,
  FIXTURE_CONTRACT_FINGERPRINT_V7,
  FIXTURE_CONTRACT_FINGERPRINT_V8,
  FIXTURE_CONTRACT_FINGERPRINT_V9,
  FIXTURE_CONTRACT_FINGERPRINT_V10,
  FIXTURE_CONTRACT_FINGERPRINT_V11,
  FIXTURE_CONTRACT_FINGERPRINT_V12,
  FIXTURE_SERVING_CONTRACT_FINGERPRINTS,
  compileFixtureContractV5,
  compileFixtureContractV6,
  compileFixtureContractV7,
  compileFixtureContractV8,
  compileFixtureContractV9,
  compileFixtureContractV10,
  compileFixtureContractV11,
  compileFixtureContractV12,
  validateContractBundle,
} = require('./contract-bundle');
const {
  QXO_COPY_DELIVERY_F19_INTEGRATION_ADMISSION_ID,
  buildCandidateMetricDefinitionAdmission,
} = require('./candidate-metric-definition-policy');

const AUTHORITY_SCOPE =
  'OFFLINE_V12_SERVING_ADMISSION_READINESS_F21_ONLY';
const F20_ID =
  'bf2e3edd1bf1247fe2bb5a21f01b86141725beb3ad9b1c0d61091b855fe4ba23';
const F20_DIGEST =
  '9108e606e7a423c48a65b6c92efa818793701f16b717a3b949565c1c63eeaccc';
const F20_ATTESTATION_SNAPSHOT_DIGEST =
  'bd645cf9a139dc8b2be740ef12956920ebdf143fe847c4e328a31dafd0cd45e0';
const F20_UPSTREAM_F19_ID =
  '4b825c971317b982e20d2fd231f9f2329f263237648b363a4e3cf988dfc142a8';
const EXPECTED_ACTIVE_SERVING_FINGERPRINTS = Object.freeze([
  FIXTURE_CONTRACT_FINGERPRINT_V1,
  FIXTURE_CONTRACT_FINGERPRINT_V2,
  FIXTURE_CONTRACT_FINGERPRINT_V3,
  FIXTURE_CONTRACT_FINGERPRINT_V4,
  FIXTURE_CONTRACT_FINGERPRINT_V5,
].sort());
const CONTRACT_CHAIN = Object.freeze([
  Object.freeze({
    version: 5,
    fingerprint: FIXTURE_CONTRACT_FINGERPRINT_V5,
    compile: compileFixtureContractV5,
  }),
  Object.freeze({
    version: 6,
    fingerprint: FIXTURE_CONTRACT_FINGERPRINT_V6,
    compile: compileFixtureContractV6,
  }),
  Object.freeze({
    version: 7,
    fingerprint: FIXTURE_CONTRACT_FINGERPRINT_V7,
    compile: compileFixtureContractV7,
  }),
  Object.freeze({
    version: 8,
    fingerprint: FIXTURE_CONTRACT_FINGERPRINT_V8,
    compile: compileFixtureContractV8,
  }),
  Object.freeze({
    version: 9,
    fingerprint: FIXTURE_CONTRACT_FINGERPRINT_V9,
    compile: compileFixtureContractV9,
  }),
  Object.freeze({
    version: 10,
    fingerprint: FIXTURE_CONTRACT_FINGERPRINT_V10,
    compile: compileFixtureContractV10,
  }),
  Object.freeze({
    version: 11,
    fingerprint: FIXTURE_CONTRACT_FINGERPRINT_V11,
    compile: compileFixtureContractV11,
  }),
  Object.freeze({
    version: 12,
    fingerprint: FIXTURE_CONTRACT_FINGERPRINT_V12,
    compile: compileFixtureContractV12,
  }),
]);
const VERSION_STEPS = Object.freeze([
  Object.freeze({
    version: 6,
    predecessor_version: 5,
    expected_delta_fields: Object.freeze([
      'claim_definitions',
      'no_shop_semantic_schema_definitions',
      'relationship_definitions',
    ]),
    governed_change:
      'ATOMIC_NO_SHOP_ACTION_EXCEPTION_AND_NOTICE_CONTRACT',
  }),
  Object.freeze({
    version: 7,
    predecessor_version: 6,
    expected_delta_fields: Object.freeze([
      'claim_interpretation_policy_definition',
      'definition_use_effect_schema_definition',
      'no_shop_semantic_schema_definitions',
      'relationship_definitions',
    ]),
    governed_change:
      'INTERPRETATION_CLARITY_EXACT_DEFINITION_USE_AND_NOTICE_CLOCK_CONTRACT',
  }),
  Object.freeze({
    version: 8,
    predecessor_version: 7,
    expected_delta_fields: Object.freeze([
      'definition_use_effect_schema_definition',
      'no_shop_semantic_schema_definitions',
      'relationship_definitions',
    ]),
    governed_change:
      'STABLE_NOTICE_DEFINITION_USE_AND_PARTY_OCCURRENCE_IDENTITIES',
  }),
  Object.freeze({
    version: 9,
    predecessor_version: 8,
    expected_delta_fields: Object.freeze([
      'no_shop_semantic_schema_definitions',
    ]),
    governed_change:
      'QXO_PROPOSAL_OR_REQUEST_RECEIPT_PRIMARY_INTERPRETATION',
  }),
  Object.freeze({
    version: 10,
    predecessor_version: 9,
    expected_delta_fields: Object.freeze([
      'no_shop_semantic_schema_definitions',
    ]),
    governed_change:
      'BOUNDED_FIXED_POINT_DEFINITION_SCOPE_CLOSURE',
  }),
  Object.freeze({
    version: 11,
    predecessor_version: 10,
    expected_delta_fields: Object.freeze([
      'no_shop_semantic_schema_definitions',
    ]),
    governed_change:
      'SEPARATE_PRIMARY_COPY_CLOCK_AND_UNRESOLVED_ALTERNATIVE',
  }),
  Object.freeze({
    version: 12,
    predecessor_version: 11,
    expected_delta_fields: Object.freeze([
      'claim_definitions',
      'claim_interpretation_policy_definition',
    ]),
    governed_change:
      'DISTINCT_COPY_DELIVERY_METRIC_SPECIFIC_AMBIGUITY_ADMISSION',
  }),
]);
const APPROVED_LEGAL_DECISIONS = Object.freeze([
  Object.freeze({
    decision_key:
      'ATOMIC_NO_SHOP_ACTIONS_AND_EXACT_EXCEPTION_GROUPING',
    first_governed_version: 6,
    approved_value:
      'TWENTY_THREE_SOURCE_FAITHFUL_ACTIONS_WITH_NINE_COMPARISON_ROLLUPS_ONE_UNROLLED_DGCL_203_ACTION_EIGHT_SHARED_PREREQUISITES_AND_TWO_INFORMATION_SPECIFIC_PREREQUISITES',
  }),
  Object.freeze({
    decision_key:
      'QXO_COPY_CLOCK_PRIMARY_TRIGGER_AND_APPLICATION_SCOPE',
    first_governed_version: 9,
    approved_value:
      'EACH_QUALIFYING_COMPANY_ACQUISITION_PROPOSAL_OR_COMPANY_REQUEST_RECEIPT_STARTS_A_SEPARATE_PRIMARY_24_ELAPSED_HOUR_CLOCK_WITH_ITEM_RECEIPT_RETAINED_AS_UNRESOLVED_ALTERNATIVE',
  }),
  Object.freeze({
    decision_key:
      'AMBIGUITY_QUALIFIED_COPY_DELIVERY_MARKET_COMPARISON',
    first_governed_version: 12,
    approved_value:
      'SELECTED_PRIMARY_INTERPRETATION_MAY_ENTER_ONLY_AN_INTERPRETATION_KEYED_METRIC_COHORT_WITH_MANDATORY_ALTERNATIVE_AND_LAWYER_WARNING',
  }),
  Object.freeze({
    decision_key:
      'SOURCE_LOCAL_PLURAL_AND_NESTED_DEFINITION_HANDLING',
    first_governed_version: 7,
    approved_value:
      'ORDINARY_PLURAL_IS_NOT_A_DUPLICATE_OR_ALIAS_NESTED_DEFINITIONS_ARE_TRANSITIVE_AND_UNRESOLVED_TERMS_ARE_NEVER_SILENTLY_SKIPPED',
  }),
]);
const SOURCE_EVIDENCE_SPECS = Object.freeze([
  Object.freeze({
    source_path:
      'lib/canonical-v2/qxo-no-shop-actions-f6-parser-bridge.js',
    source_snapshot_digest:
      'b0a9f3ca71e96e56517215956a7556aab2363199623e288ad27bd1460f0b8d9c',
    evidence_scope: 'V6_ATOMIC_ACTIONS_AND_EXCEPTION_EFFECTS',
    evidence_role: 'ATOMIC_ACTION_CARRIER',
  }),
  Object.freeze({
    source_path:
      'lib/canonical-v2/qxo-no-shop-exception-source-binding-f6.js',
    source_snapshot_digest:
      '9b33ca3109bfa61c4e2f7037cb4b6957507c6091140f4ba38618b7d748a633e7',
    evidence_scope: 'V6_ATOMIC_ACTIONS_AND_EXCEPTION_EFFECTS',
    evidence_role: 'EXCEPTION_EFFECT_CARRIER',
  }),
  Object.freeze({
    source_path:
      'lib/canonical-v2/qxo-no-shop-notice-review-materialisation-f7.js',
    source_snapshot_digest:
      '378a22b741e7695e2dee797fdc9f8f0c7927ba581d75b2db43b9a23c7afbbe29',
    evidence_scope: 'V7_V10_NOTICE_AND_DEFINITION_GRAPH',
    evidence_role: 'NOTICE_REVIEW_CARRIER',
  }),
  Object.freeze({
    source_path:
      'lib/canonical-v2/qxo-no-shop-definition-relationships-f8.js',
    source_snapshot_digest:
      '62b7c1bf9592f2eb5296201a76497fd03dfc68f5ed4fe0005c36b706b7306515',
    evidence_scope: 'V7_V10_NOTICE_AND_DEFINITION_GRAPH',
    evidence_role: 'DEFINITION_RELATIONSHIP_CARRIER',
  }),
  Object.freeze({
    source_path:
      'lib/canonical-v2/qxo-no-shop-notice-receipt-f10.js',
    source_snapshot_digest:
      'f181b4782726b58875be9e91408b8bb0e450c5d3432b6d6032ebda72771e6c5b',
    evidence_scope: 'V7_V10_NOTICE_AND_DEFINITION_GRAPH',
    evidence_role: 'NOTICE_RECEIPT_CARRIER',
  }),
  Object.freeze({
    source_path:
      'lib/canonical-v2/qxo-no-shop-definition-control-f11.js',
    source_snapshot_digest:
      'c657c0b7bf3b417d128656b5147b06ab6c37e2921ee2b12fbfaa539cfa1fba13',
    evidence_scope: 'V7_V10_NOTICE_AND_DEFINITION_GRAPH',
    evidence_role: 'DEFINITION_CONTROL_CARRIER',
  }),
  Object.freeze({
    source_path:
      'lib/canonical-v2/qxo-no-shop-definition-scope-closure-f13.js',
    source_snapshot_digest:
      '02ba83f4b33da7b000aa9eb2973afc888ab58dc8a926d19dce2e1974b8698d2d',
    evidence_scope: 'V7_V10_NOTICE_AND_DEFINITION_GRAPH',
    evidence_role: 'DEFINITION_SCOPE_CLOSURE_CARRIER',
  }),
  Object.freeze({
    source_path:
      'lib/canonical-v2/qxo-no-shop-notice-revision-f14.js',
    source_snapshot_digest:
      'efebf1ca647ba87573a95e9ac8e9f41f8096f3440a5faacffc85b92a12744372',
    evidence_scope: 'V7_V10_NOTICE_AND_DEFINITION_GRAPH',
    evidence_role: 'NOTICE_REVISION_CARRIER',
  }),
  Object.freeze({
    source_path:
      'lib/canonical-v2/qxo-no-shop-copy-clock-f15.js',
    source_snapshot_digest:
      '4321f94608a228ef3d038c6ec18642c37bbe36496e4fa8c254b9be50a037b7f7',
    evidence_scope: 'V11_PARENT_NOTICE_COPY_CLOCK_RESULT',
    evidence_role: 'PARENT_COPY_CLOCK_CARRIER',
  }),
  Object.freeze({
    source_path: 'lib/canonical-v2/market-cohort-query.js',
    source_snapshot_digest:
      '5a4f29bada0792b784441cb38ac47e08d80ba16bf9add853644a2f152e848b9c',
    evidence_scope: 'CURRENT_SERVING_ADMISSION_POLICY',
    evidence_role: 'MARKET_QUERY_VALIDATOR',
  }),
  Object.freeze({
    source_path: 'lib/canonical-v2/shared-serving-row.js',
    source_snapshot_digest:
      'f46f3e9610b54a9b0d08a29e4768ac5de52a4722abc89a152cb11931961b7e69',
    evidence_scope: 'CURRENT_SERVING_ADMISSION_POLICY',
    evidence_role: 'SHARED_ROW_VALIDATOR',
  }),
]);
const CUMULATIVE_SERVING_EVIDENCE_BASE = Object.freeze([
  Object.freeze({
    scope_key: 'V6_ATOMIC_ACTIONS_AND_EXCEPTION_EFFECTS',
    contract_versions: Object.freeze([6]),
    certification_state: 'NOT_SERVING_CERTIFIED',
    retained_authority: 'NONE',
    blocker_code:
      'V6_ATOMIC_ACTION_EXCEPTION_SERVING_CERTIFICATION_REQUIRED',
  }),
  Object.freeze({
    scope_key: 'V7_V10_NOTICE_AND_DEFINITION_GRAPH',
    contract_versions: Object.freeze([7, 8, 9, 10]),
    certification_state: 'NOT_SERVING_CERTIFIED',
    retained_authority: 'NONE',
    blocker_code:
      'V7_V10_NOTICE_DEFINITION_SERVING_CERTIFICATION_REQUIRED',
  }),
  Object.freeze({
    scope_key: 'V11_PARENT_NOTICE_COPY_CLOCK_RESULT',
    contract_versions: Object.freeze([11]),
    certification_state: 'NOT_SERVING_CERTIFIED',
    retained_authority: 'NONE',
    blocker_code:
      'V11_PARENT_NOTICE_COPY_CLOCK_SERVING_CERTIFICATION_REQUIRED',
  }),
  Object.freeze({
    scope_key: 'V12_COPY_DELIVERY_METRIC',
    contract_versions: Object.freeze([12]),
    certification_state:
      'CERTIFIED_OFFLINE_METRIC_SCOPED_BY_F20',
    retained_authority: 'NONE',
    blocker_code: null,
  }),
]);

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  Object.values(value).forEach(freeze);
  return value;
}

function requireExactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || canonicalJson(Object.keys(value).sort())
      !== canonicalJson([...keys].sort())) {
    throw new TypeError(`${label} fields are outside the F21 contract`);
  }
}

function loadF21SourceSnapshots() {
  return SOURCE_EVIDENCE_SPECS.map((spec) => ({
    source_path: spec.source_path,
    source_bytes: fs.readFileSync(spec.source_path, 'utf8'),
  }));
}

function validateSourceEvidence(sourceSnapshots) {
  if (!Array.isArray(sourceSnapshots)
    || sourceSnapshots.length !== SOURCE_EVIDENCE_SPECS.length) {
    throw new TypeError(
      'F21 requires the exact cumulative carrier and serving-policy source snapshots',
    );
  }
  const snapshotByPath = new Map();
  sourceSnapshots.forEach((snapshot) => {
    requireExactKeys(
      snapshot,
      ['source_path', 'source_bytes'],
      'F21 source snapshot',
    );
    if (typeof snapshot.source_path !== 'string'
      || typeof snapshot.source_bytes !== 'string'
      || snapshotByPath.has(snapshot.source_path)) {
      throw new TypeError('F21 source snapshots must be unique text artifacts');
    }
    snapshotByPath.set(snapshot.source_path, snapshot);
  });
  const artifacts = SOURCE_EVIDENCE_SPECS.map((spec) => {
    const snapshot = snapshotByPath.get(spec.source_path);
    const digest = snapshot && contentId(
      'F21_SOURCE_SNAPSHOT/V1',
      snapshot,
    );
    if (!snapshot || digest !== spec.source_snapshot_digest) {
      throw new TypeError(
        `F21 source evidence drifted for ${spec.source_path}`,
      );
    }
    const isPolicy = spec.evidence_scope
      === 'CURRENT_SERVING_ADMISSION_POLICY';
    const operativeStatus = isPolicy
      ? {
        admission_key: 'contract_fingerprint',
        admission_match:
          'FIXTURE_SERVING_CONTRACT_FINGERPRINTS.includes',
        mechanism_scope: 'CONTRACT_FINGERPRINT_WIDE',
      }
      : {
        serving_authority: 'NONE',
        release_authority: 'NONE',
      };
    if (isPolicy) {
      if (!snapshot.source_bytes.includes(
        'FIXTURE_SERVING_CONTRACT_FINGERPRINTS.includes(',
      )) {
        throw new TypeError(
          `F21 serving-policy mechanism drifted for ${spec.source_path}`,
        );
      }
    } else if (!snapshot.source_bytes.includes(
      "serving_authority: 'NONE'",
    ) || !snapshot.source_bytes.includes(
      "release_authority: 'NONE'",
    )) {
      throw new TypeError(
        `F21 carrier authority drifted for ${spec.source_path}`,
      );
    }
    const artifact = {
      source_path: spec.source_path,
      evidence_scope: spec.evidence_scope,
      evidence_role: spec.evidence_role,
      source_snapshot_digest: digest,
      operative_status: operativeStatus,
    };
    return {
      ...artifact,
      source_artifact_id: contentId(
        'F21_SOURCE_ARTIFACT/V1',
        artifact,
      ),
    };
  });
  const cumulativeEvidence = CUMULATIVE_SERVING_EVIDENCE_BASE.map(
    (scope) => {
      if (scope.scope_key === 'V12_COPY_DELIVERY_METRIC') {
        return { ...scope };
      }
      const sourceArtifacts = artifacts.filter(
        (artifact) => artifact.evidence_scope === scope.scope_key,
      );
      if (sourceArtifacts.length === 0) {
        throw new TypeError(
          `F21 has no source evidence for ${scope.scope_key}`,
        );
      }
      return {
        ...scope,
        source_artifacts: sourceArtifacts,
      };
    },
  );
  const validatorArtifacts = artifacts.filter(
    (artifact) => artifact.evidence_scope
      === 'CURRENT_SERVING_ADMISSION_POLICY',
  );
  if (validatorArtifacts.length !== 2) {
    throw new TypeError(
      'F21 requires both fingerprint-wide serving validators',
    );
  }
  const policyEvidence = {
    mechanism_scope: 'CONTRACT_FINGERPRINT_WIDE',
    admission_key: 'contract_fingerprint',
    validator_source_artifacts: validatorArtifacts,
  };
  return {
    cumulative_evidence: cumulativeEvidence,
    policy_evidence: {
      ...policyEvidence,
      serving_policy_snapshot_id: contentId(
        'F21_SERVING_POLICY_SNAPSHOT/V1',
        policyEvidence,
      ),
    },
  };
}

function changedTopLevelFields(predecessor, successor) {
  const fieldBytes = (value) => value === undefined
    ? canonicalJson({ present: false })
    : canonicalJson({ present: true, value });
  return [...new Set([
    ...Object.keys(predecessor),
    ...Object.keys(successor),
  ])]
    .filter((key) => key !== 'fingerprint')
    .filter(
      (key) => fieldBytes(predecessor[key])
        !== fieldBytes(successor[key]),
    )
    .sort();
}

function validateContractChain(contractBundles) {
  if (!Array.isArray(contractBundles)
    || contractBundles.length !== CONTRACT_CHAIN.length) {
    throw new TypeError('F21 requires the exact V5 through V12 contract chain');
  }
  const byVersion = new Map();
  CONTRACT_CHAIN.forEach((expected, index) => {
    const supplied = contractBundles[index];
    validateContractBundle(supplied);
    if (supplied.fingerprint !== expected.fingerprint
      || canonicalJson(supplied)
        !== canonicalJson(expected.compile())) {
      throw new TypeError(
        `F21 contract V${expected.version} identity has drifted`,
      );
    }
    byVersion.set(expected.version, supplied);
  });
  return VERSION_STEPS.map((step) => {
    const predecessor = byVersion.get(step.predecessor_version);
    const successor = byVersion.get(step.version);
    const deltaFields = changedTopLevelFields(predecessor, successor);
    if (canonicalJson(deltaFields)
      !== canonicalJson(step.expected_delta_fields)) {
      throw new TypeError(
        `F21 contract V${step.version} changed outside its governed area`,
      );
    }
    return {
      contract_version: step.version,
      predecessor_version: step.predecessor_version,
      contract_fingerprint: successor.fingerprint,
      predecessor_fingerprint: predecessor.fingerprint,
      governed_change: step.governed_change,
      exact_delta_fields: deltaFields,
      contract_validation: 'PASSED',
    };
  });
}

function schemaFor(bundle, key) {
  return bundle.no_shop_semantic_schema_definitions.find(
    (entry) => entry.semantic_schema_key === key,
  );
}

function validateGovernedSemantics(contractBundles) {
  const byVersion = new Map(
    CONTRACT_CHAIN.map((entry, index) => [
      entry.version,
      contractBundles[index],
    ]),
  );
  const v6 = byVersion.get(6);
  const actionClaim = v6.claim_definitions.find(
    (entry) => entry.claim_definition_key
      === 'NO_SHOP_PROHIBITED_ACTION',
  );
  const prerequisiteClaim = v6.claim_definitions.find(
    (entry) => entry.claim_definition_key
      === 'NO_SHOP_EXCEPTION_PREREQUISITE',
  );
  const actionRollup = schemaFor(
    v6,
    'NO_SHOP_ACTION_COMPARISON_ROLLUP',
  );
  const exceptionEffect = schemaFor(v6, 'NO_SHOP_EXCEPTION_EFFECT');
  if (actionClaim?.allowed_canonical_values?.length !== 23
    || prerequisiteClaim?.allowed_canonical_values?.length !== 10
    || actionRollup?.rollups?.length !== 9
    || canonicalJson(actionRollup?.unrolled_action_codes)
      !== canonicalJson(['GRANT_DGCL_SECTION_203_WAIVER'])
    || exceptionEffect?.maximum_shared_prerequisites !== 8
    || exceptionEffect?.maximum_action_specific_prerequisites !== 2
    || exceptionEffect?.allowed_legal_operations?.length !== 5) {
    throw new TypeError('F21 atomic no-shop decision has drifted');
  }

  const v7 = byVersion.get(7);
  const definitionEffect = v7.definition_use_effect_schema_definition;
  if (definitionEffect?.propagation !== 'EXACT_NAMED_TARGET_ONLY'
    || definitionEffect?.alias_authority !== 'NONE'
    || definitionEffect?.plural_normalisation_rule?.scope
      !== 'THIS_SOURCE_USE_ONLY'
    || definitionEffect?.plural_normalisation_rule?.alias_authority
      !== 'NONE'
    || !definitionEffect?.allowed_legal_role_codes?.includes(
      'NESTED_DEFINITION_DEPENDENCY',
    )) {
    throw new TypeError('F21 definition-use decision has drifted');
  }

  const v8 = byVersion.get(8);
  const v8Notice = schemaFor(v8, 'NO_SHOP_NOTICE_OBLIGATION');
  if (v8Notice?.notice_occurrence_identity_contract
    ?.revision_content_forbidden_from_identity !== true
    || v8.definition_use_effect_schema_definition
      ?.notice_relationship_endpoint_must_be_stable_occurrence !== true) {
    throw new TypeError('F21 stable occurrence identity has drifted');
  }

  const v9 = byVersion.get(9);
  const v9Clock = schemaFor(v9, 'NO_SHOP_NOTICE_OBLIGATION')
    ?.copy_clock_scope_contract;
  if (v9Clock?.required_primary_receipt_interpretation_code
      !== 'RECEIPT_OF_PRIOR_CLAUSE_COMPANY_ACQUISITION_PROPOSAL_OR_COMPANY_REQUEST'
    || canonicalJson(
      v9Clock?.required_alternative_receipt_interpretation_codes,
    ) !== canonicalJson([
      'RECEIPT_BY_OBLIGATED_PARTY_OF_ITEM_REQUIRED_TO_BE_COPIED',
    ])
    || v9Clock?.lawyer_ambiguity_flag_required !== true) {
    throw new TypeError('F21 QXO receipt interpretation has drifted');
  }

  const v10 = byVersion.get(10);
  const definitionClosure = schemaFor(
    v10,
    'NO_SHOP_NOTICE_OBLIGATION',
  )?.definition_scope_closure_contract;
  if (definitionClosure?.inventory_contract
      ?.catalogue_blind_capitalised_and_quoted_candidate_scan_required
      !== true
    || definitionClosure?.inventory_contract?.silent_skip_forbidden
      !== true
    || definitionClosure?.transitive_closure_contract
      ?.fixed_point_required !== true
    || definitionClosure?.transitive_closure_contract
      ?.source_local_plural_self_reference_resolves_lexically_without_edge
      !== true
    || definitionClosure?.authority_contract?.serving_authority
      !== 'NONE') {
    throw new TypeError('F21 definition closure has drifted');
  }

  const v11 = byVersion.get(11);
  const v11Clock = schemaFor(v11, 'NO_SHOP_NOTICE_OBLIGATION')
    ?.copy_clock_scope_contract;
  if (v11Clock?.required_primary_clock_application_scope_code
      !== 'EACH_SATISFYING_PRIOR_TRIGGER_OCCURRENCE'
    || v11Clock?.required_alternative_clock_application_scope_state
      !== 'UNRESOLVED_ITEM_OR_BATCH'
    || v11Clock?.required_comparability_state
      !== 'PRIMARY_INTERPRETATION_COMPARABLE_WITH_AMBIGUITY_FLAG'
    || v11Clock?.primary_metric_contract?.required_raw_magnitude !== '24'
    || v11Clock?.primary_metric_contract?.required_raw_unit !== 'HOURS'
    || v11Clock?.primary_metric_contract?.required_canonical_value !== '1'
    || v11Clock?.primary_metric_contract?.required_canonical_unit !== 'DAYS'
    || v11Clock?.primary_metric_contract?.required_day_basis !== 'ELAPSED'
    || v11Clock?.primary_metric_contract
      ?.item_receipt_clock_cohort_mix_forbidden !== true
    || v11Clock?.ambiguity_presentation_contract
      ?.ambiguity_flag_required_in_every_review_compare_and_query_result
      !== true) {
    throw new TypeError('F21 QXO copy clock has drifted');
  }

  const v12 = byVersion.get(12);
  const copyClaim = v12.claim_definitions.find(
    (entry) => entry.claim_definition_key
      === 'NO_SHOP_COPY_DELIVERY_PERIOD_DAYS',
  );
  const metricAdmission = v12.claim_interpretation_policy_definition
    ?.metric_specific_ambiguous_admissions?.find(
      (entry) => entry.metric_key
        === 'NO_SHOP_COPY_DELIVERY_PERIOD_DAYS',
    );
  if (copyClaim?.version !== 1
    || metricAdmission?.metric_version !== 1
    || metricAdmission?.admission_semantics
      !== 'SELECTED_PRIMARY_INTERPRETATION_FOR_SEPARATE_RELEASE_KEYED_COHORT_WITH_MANDATORY_LAWYER_WARNING'
    || metricAdmission
      ?.cohort_identity_must_include_interpretation_projection !== true
    || metricAdmission?.lawyer_warning_required !== true) {
    throw new TypeError('F21 metric-specific ambiguity admission has drifted');
  }

  return [
    'ATOMIC_ACTION_AND_EXCEPTION_CONTRACT',
    'EXACT_USE_PLURAL_AND_NESTED_DEFINITION_CONTRACT',
    'STABLE_OCCURRENCE_IDENTITY_CONTRACT',
    'PRIMARY_RECEIPT_INTERPRETATION_WITH_ALTERNATIVE',
    'BOUNDED_FIXED_POINT_DEFINITION_CLOSURE',
    'PER_RECEIPT_COPY_CLOCK_AND_DURATION_NORMALISATION',
    'INTERPRETATION_KEYED_AMBIGUITY_QUALIFIED_METRIC',
  ].map((check) => ({
    check,
    state: 'PASSED',
  }));
}

function validateF20(f20) {
  requireExactKeys(f20, [
    'schema_version',
    'environment',
    'authority_scope',
    'upstream_f19_id',
    'query_certification',
    'status',
    'adversarial_rejections',
    'qxo_no_shop_copy_delivery_query_f20_id',
    'canonical_payload_digest',
  ], 'F20 attestation');
  const f20Id = f20.qxo_no_shop_copy_delivery_query_f20_id;
  const payloadDigest = f20.canonical_payload_digest;
  if (f20.schema_version
      !== 'QXO_NO_SHOP_COPY_DELIVERY_QUERY_F20_STAGING_ATTESTATION/V2'
    || f20.environment !== 'STAGING'
    || f20.authority_scope
      !== 'OFFLINE_QXO_COPY_DELIVERY_QUERY_F20_ONLY'
    || f20.upstream_f19_id !== F20_UPSTREAM_F19_ID
    || f20Id !== F20_ID
    || payloadDigest !== F20_DIGEST
    || contentId('F20_STAGING_ATTESTATION_SNAPSHOT/V1', f20)
      !== F20_ATTESTATION_SNAPSHOT_DIGEST) {
    throw new TypeError('F21 requires the exact content-addressed F20 proof');
  }
  const query = f20.query_certification;
  const status = f20.status;
  if (query.plan_node_type !== 'Index Only Scan'
    || query.plan_actual_rows !== 1
    || query.database_calls_per_request !== 1
    || query.different_class_poison_excluded !== true
    || query.poison_interpretation_identity_propagation !== 'PASSED'
    || query.poison_interpretation_warning_digest_alignment !== 'PASSED'
    || query.poison_review_authority
      !== 'HYPOTHETICAL_NON_ADMITTED_ONLY'
    || query.release_aware_cache_verified !== true
    || query.rollback_verified !== true
    || status.indexed_query_executor_certification
      !== 'RESOLVED_STAGING_ROLLBACK_ONLY'
    || status.active_serving_authority !== 'NONE'
    || status.active_query_authority !== 'NONE'
    || status.active_pointer_authority !== 'NONE'
    || status.publication_blocked !== true
    || status.release_eligible !== false
    || canonicalJson(status.blocker_codes)
      !== canonicalJson(['V12_ACTIVE_SERVING_ADMISSION_REQUIRED'])) {
    throw new TypeError('F21 F20 certification or authority has drifted');
  }
  return {
    qxo_no_shop_copy_delivery_query_f20_id: f20Id,
    canonical_payload_digest: payloadDigest,
    query_semantics_digest: query.query_semantics_digest,
    comparability_class_digest: query.comparability_class_digest,
    candidate_executor_definition_digest:
      query.candidate_executor_definition_digest,
    index_definition_digest: query.index_definition_digest,
    validation: 'PASSED',
  };
}

function validateServingPolicy(activeServingFingerprints) {
  if (!Array.isArray(activeServingFingerprints)) {
    throw new TypeError('F21 requires the exact active serving policy');
  }
  const supplied = [...activeServingFingerprints].sort();
  if (canonicalJson(supplied)
      !== canonicalJson(EXPECTED_ACTIVE_SERVING_FINGERPRINTS)
    || canonicalJson(
      [...FIXTURE_SERVING_CONTRACT_FINGERPRINTS].sort(),
    ) !== canonicalJson(EXPECTED_ACTIVE_SERVING_FINGERPRINTS)
    || supplied.includes(FIXTURE_CONTRACT_FINGERPRINT_V12)
    || supplied.some((fingerprint) => [
      FIXTURE_CONTRACT_FINGERPRINT_V6,
      FIXTURE_CONTRACT_FINGERPRINT_V7,
      FIXTURE_CONTRACT_FINGERPRINT_V8,
      FIXTURE_CONTRACT_FINGERPRINT_V9,
      FIXTURE_CONTRACT_FINGERPRINT_V10,
      FIXTURE_CONTRACT_FINGERPRINT_V11,
      FIXTURE_CONTRACT_FINGERPRINT_V12,
    ].includes(fingerprint))) {
    throw new TypeError('F21 cannot widen active serving policy');
  }
  return supplied;
}

function buildV12ServingAdmissionReadinessF21({
  contract_bundles: contractBundles,
  active_serving_fingerprints: activeServingFingerprints,
  f20_attestation: f20Attestation,
  source_snapshots: sourceSnapshots,
} = {}) {
  const versionInventory = validateContractChain(contractBundles);
  const semanticChecks = validateGovernedSemantics(contractBundles);
  const f20Binding = validateF20(f20Attestation);
  const sourceEvidence = validateSourceEvidence(sourceSnapshots);
  const activeFingerprints = validateServingPolicy(
    activeServingFingerprints,
  );
  const candidateMetricAdmission =
    buildCandidateMetricDefinitionAdmission({
      contract_bundle: contractBundles[7],
      metric_key: 'NO_SHOP_COPY_DELIVERY_PERIOD_DAYS',
    });
  const approvalRecord = {
    schema_version: 'LEGAL_DECISION_APPROVAL_RECORD/V1',
    review_authority: 'BEN',
    approved_on: '2026-07-27',
    source_context: 'MAIN_CODEX_TASK',
    approval_scope:
      'V6_THROUGH_V12_LEGAL_SEMANTICS_READINESS_ONLY',
    decisions: APPROVED_LEGAL_DECISIONS,
    serving_admission_authority: 'NONE',
    release_activation_authority: 'NONE',
    production_cutover_authority: 'NONE',
  };
  const body = {
    schema_version: 'V12_SERVING_ADMISSION_READINESS_F21/V1',
    authority_scope: AUTHORITY_SCOPE,
    target_contract_fingerprint:
      FIXTURE_CONTRACT_FINGERPRINT_V12,
    active_serving_predecessor_fingerprint:
      FIXTURE_CONTRACT_FINGERPRINT_V5,
    approval_record: {
      ...approvalRecord,
      legal_decision_approval_record_id: contentId(
        'LEGAL_DECISION_APPROVAL_RECORD/V1',
        approvalRecord,
      ),
    },
    version_inventory: versionInventory,
    governed_semantic_checks: semanticChecks,
    f20_binding: f20Binding,
    serving_evidence_inventory:
      sourceEvidence.cumulative_evidence.map((scope) => (
        scope.scope_key === 'V12_COPY_DELIVERY_METRIC'
          ? {
            ...scope,
            certification_artifacts: {
              qxo_no_shop_copy_delivery_canonical_f19_id:
                F20_UPSTREAM_F19_ID,
              qxo_no_shop_copy_delivery_query_f20_id: F20_ID,
              f20_canonical_payload_digest: F20_DIGEST,
            },
          }
          : scope
      )),
    serving_policy: {
      active_serving_fingerprints: activeFingerprints,
      current_admission_mechanism_scope:
        sourceEvidence.policy_evidence.mechanism_scope,
      current_admission_policy_evidence:
        sourceEvidence.policy_evidence,
      target_v12_admitted: false,
      cumulative_v6_through_v12_admitted: false,
      policy_unchanged: true,
    },
    readiness: {
      state: 'NOT_READY_FOR_CURRENT_GLOBAL_SERVING_ADMISSION',
      metric_scoped_candidate_state:
        'COPY_DELIVERY_METRIC_EVIDENCE_COMPLETE_PENDING_SCOPED_ADMISSION_MECHANISM',
      certified_scope: {
        contract_fingerprint:
          FIXTURE_CONTRACT_FINGERPRINT_V12,
        metric_key: 'NO_SHOP_COPY_DELIVERY_PERIOD_DAYS',
        metric_version: 1,
        metric_definition_id:
          candidateMetricAdmission.metric_definition_id,
        concept_key: candidateMetricAdmission.concept_key,
        required_claim_definition_key:
          candidateMetricAdmission.required_claim_definition_key,
        interpretation_admission_digest:
          candidateMetricAdmission.interpretation_admission_digest,
        candidate_metric_definition_admission_id:
          candidateMetricAdmission
            .candidate_metric_definition_admission_id,
        integration_admission_id:
          QXO_COPY_DELIVERY_F19_INTEGRATION_ADMISSION_ID,
        qxo_no_shop_copy_delivery_canonical_f19_id:
          F20_UPSTREAM_F19_ID,
        qxo_no_shop_copy_delivery_query_f20_id: F20_ID,
        certification_state: 'CERTIFIED_OFFLINE_ONLY',
      },
      required_metric_scoped_gate_key_fields: [
        'contract_fingerprint',
        'metric_key',
        'metric_version',
        'concept_key',
        'required_claim_definition_key',
        'interpretation_admission_digest',
        'candidate_metric_definition_admission_id',
        'integration_admission_id',
      ],
      next_permitted_slice:
        'METRIC_SCOPED_V12_SERVING_ADMISSION_BOUNDARY_DESIGN',
      remaining_required_authority: [
        'SEPARATE_METRIC_SCOPED_V12_SERVING_POLICY_ADMISSION',
      ],
      evidence_blocker_codes: [
        'CURRENT_ADMISSION_POLICY_IS_FINGERPRINT_WIDE',
        'F20_CERTIFIES_COPY_DELIVERY_METRIC_ONLY',
        'GLOBAL_V12_ADMISSION_WOULD_ENABLE_UNCERTIFIED_METRICS',
        'NON_COPY_DELIVERY_V6_V12_FAMILIES_RETAIN_NO_SERVING_AUTHORITY',
        'METRIC_SCOPED_SERVING_ADMISSION_NOT_IMPLEMENTED',
      ],
    },
    authority: {
      active_serving_authority: 'NONE',
      active_query_authority: 'NONE',
      active_pointer_authority: 'NONE',
      corpus_write_authority: 'NONE',
      release_activation_authority: 'NONE',
      production_cutover_authority: 'NONE',
    },
    status: {
      publication_blocked: true,
      release_eligible: false,
      blocker_codes: [
        'GLOBAL_V12_FINGERPRINT_ADMISSION_FORBIDDEN_WITH_CURRENT_EVIDENCE',
        'V12_COPY_DELIVERY_METRIC_SCOPED_ADMISSION_REQUIRED',
      ],
    },
  };
  return freeze({
    ...body,
    v12_serving_admission_readiness_f21_id: contentId(
      'V12_SERVING_ADMISSION_READINESS_F21/V1',
      body,
    ),
    canonical_payload_digest: contentId(
      'V12_SERVING_ADMISSION_READINESS_F21_PAYLOAD/V1',
      body,
    ),
  });
}

function fixtureF21Inputs(f20Attestation) {
  return {
    contract_bundles: CONTRACT_CHAIN.map((entry) => entry.compile()),
    active_serving_fingerprints: [
      ...FIXTURE_SERVING_CONTRACT_FINGERPRINTS,
    ],
    f20_attestation: f20Attestation,
    source_snapshots: loadF21SourceSnapshots(),
  };
}

function validateV12ServingAdmissionReadinessF21({
  v12_serving_admission_readiness_f21: candidate,
  ...inputs
} = {}) {
  const expected = buildV12ServingAdmissionReadinessF21(inputs);
  if (canonicalJson(candidate) !== canonicalJson(expected)) {
    throw new TypeError('the V12 F21 readiness attestation has drifted');
  }
  return true;
}

module.exports = {
  APPROVED_LEGAL_DECISIONS,
  AUTHORITY_SCOPE,
  EXPECTED_ACTIVE_SERVING_FINGERPRINTS,
  F20_DIGEST,
  F20_ID,
  SOURCE_EVIDENCE_SPECS,
  VERSION_STEPS,
  buildV12ServingAdmissionReadinessF21,
  fixtureF21Inputs,
  loadF21SourceSnapshots,
  validateV12ServingAdmissionReadinessF21,
};
