const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {
  withoutF20RollbackOnlyCertification,
} = require('./helpers/canonical-v2-staging-runner-scope');

const { canonicalJson, contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  FIXTURE_CONTRACT_FINGERPRINT_V6,
  FIXTURE_SERVING_CONTRACT_FINGERPRINTS,
} = require('../lib/canonical-v2/contract-bundle');
const {
  AUTHORITY_SCOPE,
  EFFECT_SPECS,
  PREREQUISITE_SPECS,
  SOURCE_SPANS,
  UNRESOLVED_EFFECT_SPECS,
  buildQxoNoShopExceptionSourceBindingF6,
  validateQxoNoShopExceptionSourceBindingF6CarrierIdentity,
} = require('../lib/canonical-v2/qxo-no-shop-exception-source-binding-f6');

const MODULE =
  'lib/canonical-v2/qxo-no-shop-exception-source-binding-f6.js';
const RUNNER =
  'scripts/canonical-v2-staging-qxo-no-shop-clock-attestation.mjs';
const FIXTURE =
  'tests/fixtures/canonical-v2/qxo-no-shop-exception-source-f6-staging-attestation.json';

function carrier() {
  const body = {
    schema_version: 'QXO_NO_SHOP_EXCEPTION_SOURCE_BINDING_F6/V1',
    authority_scope: AUTHORITY_SCOPE,
    contract_binding: {},
    source_binding: {},
    upstream_bindings: {},
    party_binding: {},
    governed_scopes: {},
    source_evidence: [],
    prerequisite_outcomes: [],
    exception_effect_outcomes: [],
    inline_permission_source_binding: {},
    unresolved_effects: [],
    retained_source_residuals: [],
    notice_dependency: {},
    definition_relationship_dependency: {},
    status: {},
  };
  return {
    ...body,
    qxo_no_shop_exception_source_binding_f6_id: contentId(
      'QXO_NO_SHOP_EXCEPTION_SOURCE_BINDING_F6/V1',
      body,
    ),
    canonical_payload_digest: contentId(
      'QXO_NO_SHOP_EXCEPTION_SOURCE_BINDING_F6_PAYLOAD/V1',
      body,
    ),
  };
}

function fixture() {
  return JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
}

test('the F6 exception source-binding carrier is closed and deterministic', () => {
  const first = carrier();
  const second = carrier();
  assert.equal(canonicalJson(first), canonicalJson(second));
  assert.equal(
    validateQxoNoShopExceptionSourceBindingF6CarrierIdentity(first),
    true,
  );
  const changed = JSON.parse(JSON.stringify(first));
  changed.status.release_eligible = true;
  assert.throws(
    () => validateQxoNoShopExceptionSourceBindingF6CarrierIdentity(changed),
    /identity has drifted/i,
  );
  assert.throws(
    () => buildQxoNoShopExceptionSourceBindingF6({ unknown_authority: true }),
    /outside its contract/i,
  );
});

test('the staging carrier is pinned to the exact F6 contract, source, and upstream carriers', () => {
  const attestation = fixture();
  assert.equal(attestation.environment, 'STAGING');
  assert.equal(attestation.authority_scope, AUTHORITY_SCOPE);
  assert.equal(
    attestation.contract_binding.contract_fingerprint,
    FIXTURE_CONTRACT_FINGERPRINT_V6,
  );
  assert.deepEqual(attestation.contract_binding, {
    contract_key: 'CANONICAL_V2_VERTICAL_SLICE',
    contract_fingerprint: FIXTURE_CONTRACT_FINGERPRINT_V6,
    exception_effect_schema_definition_id:
      'e11fc723ec24e9b4934e891c18e59bc03606e95b08cefd78553d934957d2d609',
    exception_effect_schema_definition_payload_digest:
      '6b9a9b3bb8f80f6d6f7383c41effe3d6bce72df7c5c40f22a63adc8ec1caddb1',
    inline_permission_effect_schema_definition_id:
      '7071192bbe3d9e4b000189b6180c39f70adae7bb581be7be4e1859c774b756ad',
    inline_permission_effect_schema_definition_payload_digest:
      'd10f615c5040ef5d1136f44d4583b8c285987133c3bd599d452126993eda4229',
  });
  assert.deepEqual(attestation.source_binding, {
    admitted_semantic_source_context_id:
      '4749510f2fe70ac2f23d76c4a1e61d1d0208b2f56cdba7b27e4dcabef1cac201',
    canonical_text_id:
      '6a4ba385ae52f0135250abeadf0756c6a7cb79d64a3d98a7fa9d75e42e41b6ac',
    deal_admission_id:
      'e5be39266d3919fe4b4815e16b46628f2e79c37efd017f0788ba4b697954ff9b',
    document_hash:
      'abba043018410d718c207e7d7a43c9567166f6a10c4c9a6b4b0c8c7761cd6b9d',
    governed_deal_key: 'deal:qxo-topbuild',
    immutable_source_document_id:
      'a918bacf8fea58f4b8a3d83789fffc9512a7140510a671a4c62fdb9430baed8a',
    semantic_extraction_input_envelope_id:
      'f24f8e51ff1ca0db672082a7f458d5419fe9a8b68613285cd472ba2f5a0e81f7',
    source_admission_manifest_id:
      '4b3e94cbc66b7bb568b519d41ec561633c51a78a79ee8bb79ba414c6b51b3394',
    source_ordinal: 0,
  });
  assert.equal(
    attestation.upstream_bindings
      .qxo_no_shop_actions_f6_parser_bound_review_seed_id,
    'd1c8ab4fd5259f5ee67a6ade430d08e555029bc34eb371fc6620b7e91091a95c',
  );
  assert.equal(
    attestation.upstream_bindings
      .qxo_no_shop_actions_f6_parser_bound_review_seed_payload_digest,
    '82d4e7207854048789dc02df9ef5691c5bfeaba94dfd40662171e4c3a4559094',
  );
  assert.equal(
    attestation.upstream_bindings.qxo_no_shop_reviewed_definition_graph_f6_id,
    '65362ac2af8f3459f8b1f09b1ce4485ef5b22b23b4a51c0c1407a35cdb811e18',
  );
  assert.equal(
    attestation.upstream_bindings
      .qxo_no_shop_reviewed_definition_graph_f6_payload_digest,
    'b0fc4d26a0a13cdf79612e91ac4778e62be768ec083b1d11174ada627a4eb84a',
  );
});

test('all source evidence uses immutable absolute document coordinates', () => {
  assert.equal(Object.keys(SOURCE_SPANS).length, 27);
  assert.deepEqual(
    Object.fromEntries(Object.entries(SOURCE_SPANS).map(([key, span]) => [
      key,
      [span.start, span.end],
    ])),
    {
      RESTRICTION_SCOPE: [202400, 203664],
      INLINE_PERMISSION: [202932, 203013],
      EXCEPTION_SCOPE: [205454, 207783],
      BROADER_PRECEDENCE: [205457, 205570],
      NOTICE_PRECEDENCE: [205575, 205625],
      WINDOW: [205642, 205741],
      RECEIPT: [205743, 205841],
      NO_BREACH: [205843, 205914],
      BOARD_GOOD_FAITH: [205916, 205961],
      SUPERIOR_COUNSEL: [205967, 206079],
      SUPERIOR_RESULT: [206081, 206204],
      FIDUCIARY_COUNSEL: [206213, 206258],
      FIDUCIARY_RESULT: [206260, 206451],
      ACTOR_CHANNEL: [206458, 206525],
      FURNISH_VERB: [206531, 206538],
      FURNISH_CONDITION: [206540, 206591],
      FURNISH_OBJECT: [206593, 206749],
      INFORMATION_PROVISO: [206751, 207009],
      INFORMATION_PARITY: [206894, 207009],
      ENGAGE_VERB: [207019, 207028],
      PARTICIPATE_VERB: [207032, 207056],
      DISCUSSIONS_OBJECT: [207057, 207068],
      NEGOTIATIONS_OBJECT: [207072, 207084],
      DISCUSSION_CONTEXT: [207085, 207221],
      DISCUSSION_PERMISSION_CLUSTER: [207010, 207221],
      A_FURNISH_METHOD: [202650, 202703],
      FIRST_SENTENCE_NOTICE: [207783, 208859],
    },
  );
  assert.equal(fixture().source_evidence_count, 27);
});

test('the exception maps eight shared and two action-specific prerequisites', () => {
  assert.equal(PREREQUISITE_SPECS.length, 10);
  assert.equal(
    PREREQUISITE_SPECS.filter((spec) => spec.class === 'SHARED').length,
    8,
  );
  assert.equal(
    PREREQUISITE_SPECS.filter(
      (spec) => spec.class === 'ACTION_SPECIFIC',
    ).length,
    2,
  );
  assert.deepEqual(
    PREREQUISITE_SPECS.flatMap((spec) => spec.definition_uses),
    [
      ['COMPANY_ACQUISITION_PROPOSAL', 205797, 205825],
      ['COMPANY_ACQUISITION_PROPOSAL', 206091, 206119],
      ['COMPANY_SUPERIOR_PROPOSAL', 206179, 206204],
      ['COMPANY_ACQUISITION_PROPOSAL', 206277, 206305],
      ['COMPANY_ACQUISITION_PROPOSAL', 206091, 206119],
      ['ACCEPTABLE_CONFIDENTIALITY_AGREEMENT', 206555, 206591],
    ],
  );
  assert.deepEqual(
    PREREQUISITE_SPECS.flatMap(
      (spec) => spec.definition_dependencies || [],
    ),
    [
      ['COMPANY_SUPERIOR_PROPOSAL', 'COMPANY_ACQUISITION_PROPOSAL', 212900],
      ['COMPANY_SUPERIOR_PROPOSAL', 'COMPANY_ACQUISITION_PROPOSAL', 213708],
      ['COMPANY_SUPERIOR_PROPOSAL', 'COMPANY_ACQUISITION_PROPOSAL', 214004],
      ['COMPANY_SUPERIOR_PROPOSAL', 'COMPANY_ACQUISITION_PROPOSAL', 214097],
    ],
  );
  assert.equal(fixture().prerequisite_outcome_count, 10);
});

test('five express permissions bind to the correct prohibited-action occurrences', () => {
  assert.deepEqual(
    EFFECT_SPECS.map((spec) => ({
      legal_operation: spec.legal_operation,
      affected_action_code: spec.affected_action_code,
      action_occurrence_keys: spec.action_occurrence_keys,
    })),
    [
      {
        legal_operation: 'PERMITS_FURNISH_NONPUBLIC_INFORMATION',
        affected_action_code: 'FURNISH_NONPUBLIC_INFORMATION',
        action_occurrence_keys: ['A_FURNISH_METHOD', 'B_FURNISH'],
      },
      {
        legal_operation: 'PERMITS_ENGAGE_IN_DISCUSSIONS',
        affected_action_code: 'ENGAGE_IN_DISCUSSIONS',
        action_occurrence_keys: ['B_ENGAGE_DISCUSSIONS'],
      },
      {
        legal_operation: 'PERMITS_ENGAGE_IN_NEGOTIATIONS',
        affected_action_code: 'ENGAGE_IN_NEGOTIATIONS',
        action_occurrence_keys: ['B_ENGAGE_NEGOTIATIONS'],
      },
      {
        legal_operation: 'PERMITS_PARTICIPATE_IN_DISCUSSIONS',
        affected_action_code: 'PARTICIPATE_IN_DISCUSSIONS',
        action_occurrence_keys: ['B_PARTICIPATE_DISCUSSIONS'],
      },
      {
        legal_operation: 'PERMITS_PARTICIPATE_IN_NEGOTIATIONS',
        affected_action_code: 'PARTICIPATE_IN_NEGOTIATIONS',
        action_occurrence_keys: ['B_PARTICIPATE_NEGOTIATIONS'],
      },
    ],
  );
  const furnish = EFFECT_SPECS[0];
  assert.deepEqual(furnish.definition_dependencies, [[
    'ACCEPTABLE_CONFIDENTIALITY_AGREEMENT',
    'BASELINE_CONFIDENTIALITY_AGREEMENT',
    207463,
  ]]);
  assert.equal(fixture().supported_effect_outcome_count, 5);
});

test('continue discussions and negotiations remain explicit unresolved effect gaps', () => {
  assert.deepEqual(UNRESOLVED_EFFECT_SPECS, [
    {
      action_occurrence_key: 'B_CONTINUE_DISCUSSIONS',
      affected_action_code: 'CONTINUE_DISCUSSIONS',
    },
    {
      action_occurrence_key: 'B_CONTINUE_NEGOTIATIONS',
      affected_action_code: 'CONTINUE_NEGOTIATIONS',
    },
  ]);
  const attestation = fixture();
  assert.equal(attestation.unresolved_effect_count, 2);
  assert.equal(
    attestation.unresolved_effects_digest,
    '3ad1016ae6880ac5ef337ef1e5db8c2a1d41c5e73ce3fef67cbaeeb499394a78',
  );
  assert.equal(
    attestation.binding_status.blocker_codes.includes(
      'F6_CONTINUE_DISCUSSIONS_EXCEPTION_EFFECT_UNGOVERNED',
    ),
    true,
  );
  assert.equal(
    attestation.binding_status.blocker_codes.includes(
      'F6_CONTINUE_NEGOTIATIONS_EXCEPTION_EFFECT_UNGOVERNED',
    ),
    true,
  );
});

test('notice, definition relationships, residuals, and downstream authority stay incomplete', () => {
  const attestation = fixture();
  const status = attestation.binding_status;
  assert.equal(attestation.retained_source_residual_count, 7);
  assert.equal(attestation.reviewed_definition_dependency_edge_count, 5);
  assert.equal(status.prerequisite_source_bindings_complete, true);
  assert.equal(status.governed_effect_source_bindings_complete, true);
  assert.equal(status.inline_permission_source_binding_complete, true);
  assert.equal(status.notice_dependency_complete, false);
  assert.equal(status.definition_relationship_dependency_complete, false);
  assert.equal(status.review_source_binding_authority, 'EXACT_SOURCE_ONLY');
  assert.equal(status.review_renderable, true);
  assert.equal(status.publication_blocked, true);
  assert.equal(status.release_eligible, false);
  for (const key of [
    'absence_authority',
    'relationship_effect_authority',
    'canonical_write_authority',
    'result_authority',
    'metric_authority',
    'comparability_authority',
    'query_authority',
    'serving_authority',
    'release_authority',
  ]) {
    assert.equal(status[key], 'NONE', key);
  }
  assert.equal(
    FIXTURE_SERVING_CONTRACT_FINGERPRINTS.includes(
      attestation.contract_binding.contract_fingerprint,
    ),
    false,
  );
});

test('the live staging runner verifies failure isolation with one bounded read and no writes', () => {
  const moduleSource = fs.readFileSync(MODULE, 'utf8');
  const runnerSource = withoutF20RollbackOnlyCertification(
    fs.readFileSync(RUNNER, 'utf8'),
  );
  assert.match(runnerSource, /--exception-source-f6-print/);
  assert.match(runnerSource, /--exception-source-f6-verify/);
  assert.equal((runnerSource.match(/\breadCapture\(\)/g) || []).length, 2);
  assert.match(runnerSource, /SELECT canonical_payload/);
  assert.match(runnerSource, /LIMIT 2/);
  assert.match(runnerSource, /timeout: 90_000/);
  assert.match(runnerSource, /MAX_RESPONSE_BYTES = 4 \* 1024 \* 1024/);
  assert.equal(fixture().carrier_drift_rejected, true);
  assert.equal(fixture().failure_isolation_verified, true);
  assert.doesNotMatch(
    runnerSource,
    /\b(?:INSERT\s+INTO|UPDATE\s+[a-z_]|DELETE\s+FROM|UPSERT)\b/i,
  );
  assert.doesNotMatch(
    moduleSource,
    /canonical-writer|candidate-release|serving-projection|lib\/query/,
  );
});
