const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  PRODUCT_QUERY_ADMISSION_CONTEXT_SCHEMA,
  PRODUCT_QUERY_IR_SCHEMA,
  compileProductQueryTemplate,
} = require('../lib/canonical-v2/product-query-ir');
const {
  PRODUCT_SAVED_QUERY_DEFINITION_SCHEMA,
  PRODUCT_SAVED_QUERY_OWNER_BINDING_SCHEMA,
  canonicalProductSavedQueryDefinitionBytes,
  compileProductSavedQueryDefinition,
  validateProductSavedQueryDefinition,
} = require('../lib/canonical-v2/product-saved-query-compiler');
const {
  PRODUCT_ACTIVE_RELEASE_RERUN_ACTION_SCHEMA,
  PRODUCT_ACTIVE_RELEASE_RESOLUTION_SCHEMA,
  PRODUCT_ACTIVE_RELEASE_RERUN_REFUSAL_SCHEMA,
  PRODUCT_ACTIVE_RELEASE_RERUN_SCHEMA,
  canonicalProductActiveReleaseRerunOutcomeBytes,
  compileProductActiveReleaseRerun,
  compileProductActiveReleaseRerunAction,
  validateProductActiveReleaseRerunOutcome,
  validateProductActiveReleaseResolution,
} = require('../lib/canonical-v2/product-rerun-compiler');
const savedQueryContract = require(
  '../contracts/canonical-v2/successor/product/query/product-saved-query-definition.v1.json',
);

const DOMAIN_DEFINITIONS = Object.freeze({
  AGREEMENT: Object.freeze({
    predicate: 'SELLER_TERMINATION_FEE',
    result: Object.freeze({
      stable_id: 'AGREEMENT_COMPARABLE_RESULT',
      version: 1,
    }),
    field: 'seller_termination_fee_percent',
    evidence: Object.freeze([
      'EXACT_CLAIM',
      'EXACT_SOURCE_CITATION',
    ]),
    detail: 'RESULT_COMPONENT_CLAIM_EVIDENCE',
  }),
  CVR: Object.freeze({
    predicate: 'REGULATORY_MILESTONE',
    result: Object.freeze({
      stable_id: 'CVR_MILESTONE_RESULT',
      version: 1,
    }),
    field: 'cvr_milestone_status',
    evidence: Object.freeze([
      'EXACT_CVR_TERM',
      'EXACT_SOURCE_CITATION',
    ]),
    detail: 'RESULT_COMPONENT_CLAIM_EVIDENCE',
  }),
  PROCESS: Object.freeze({
    predicate: 'EXCLUSIVITY_GRANTED',
    result: Object.freeze({
      stable_id: 'PROCESS_PHRASEBOOK_PASSAGE_RESULT',
      version: 1,
    }),
    field: 'process_phase',
    evidence: Object.freeze([
      'EXACT_PASSAGE',
      'EXACT_SOURCE_CITATION',
    ]),
    detail: 'PARENT_BOUND_PARAGRAPH_CONTEXT',
  }),
});

function digest(label) {
  return sha256Hex(Buffer.from(label, 'utf8'));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertDeepFrozen(value) {
  if (!value || typeof value !== 'object') return;
  assert.equal(Object.isFrozen(value), true);
  Object.values(value).forEach(assertDeepFrozen);
}

function fieldDefinition(domain) {
  const definition = DOMAIN_DEFINITIONS[domain];
  return {
    field_key: definition.field,
    field_version: 1,
    permitted_result_definitions: [
      definition.result.stable_id,
    ],
    filter_scope: 'SAME_DEAL',
    multiplicity: 'ZERO_OR_ONE',
    capabilities: {
      display: true,
      filter: true,
      sort: true,
    },
    supported_domains: [domain],
    permitted_operators: ['EQ'],
    completeness_semantics: 'UNKNOWN_IF_NOT_ADMITTED',
  };
}

function predicateAdmission(domain) {
  const definition = DOMAIN_DEFINITIONS[domain];
  return {
    domain_key: domain,
    predicate_key: definition.predicate,
    predicate_version: 1,
    admission_id: digest(`predicate:${domain}:${definition.predicate}`),
    result_definitions: [clone(definition.result)],
    evidence_requirement_ids: [...definition.evidence],
  };
}

function admission(release, { includeCvr = true } = {}) {
  const domains = includeCvr
    ? ['AGREEMENT', 'CVR', 'PROCESS']
    : ['AGREEMENT', 'PROCESS'];
  return {
    schema_version: PRODUCT_QUERY_ADMISSION_CONTEXT_SCHEMA,
    approved_pm_data_version_id: digest(`pm-data:${release}`),
    candidate_release_manifest_id: digest(`release:${release}`),
    candidate_release_manifest_payload_digest:
      digest(`release-payload:${release}`),
    canonical_contract_identity: {
      stable_id: 'CANONICAL_CONTRACT_BUNDLE',
      version: 1,
      payload_digest: digest('canonical-contract'),
    },
    product_field_catalogue: {
      stable_id: 'PRODUCT_FIELD_CATALOGUE',
      manifest_id: digest(`field-catalogue:${release}`),
      payload_digest: digest(`field-catalogue-payload:${release}`),
      field_definitions: domains.map(fieldDefinition),
    },
    navigation_catalogue: {
      stable_id: 'PRODUCT_NAVIGATION_CATALOGUE',
      catalogue_id: digest(`navigation:${release}`),
      payload_digest: digest(`navigation-payload:${release}`),
    },
    predicate_admissions: domains.map(predicateAdmission),
    exact_detail_actions: [
      'PARENT_BOUND_PARAGRAPH_CONTEXT',
      'RESULT_COMPONENT_CLAIM_EVIDENCE',
    ],
    coverage_identities: domains.map(
      (domain) => digest(`coverage:${domain}`),
    ),
    route_budget: {
      maximum_page_size: 50,
    },
  };
}

function queryTemplate(domain, { cursor = null } = {}) {
  const definition = DOMAIN_DEFINITIONS[domain];
  return {
    result_definition: clone(definition.result),
    evidence_requirement_ids: [...definition.evidence],
    cohort: {
      cohort_definition_id: digest(`cohort:${domain}`),
      cohort_definition_payload_digest:
        digest(`cohort-payload:${domain}`),
    },
    filters: [{
      field_key: definition.field,
      field_version: 1,
      operator: 'EQ',
      value: `${domain}_VALUE`,
    }],
    sort: [{
      field_key: definition.field,
      field_version: 1,
      direction: 'ASC',
    }],
    diversity: {
      definition_id: digest(`diversity:${domain}`),
      payload_digest: digest(`diversity-payload:${domain}`),
    },
    requested_columns: [{
      field_key: definition.field,
      field_version: 1,
    }],
    pagination: {
      page_size: 25,
      cursor,
    },
    detail_actions: [definition.detail],
    coverage: {
      coverage_identity: digest(`coverage:${domain}`),
      coverage_payload_digest: digest(`coverage-payload:${domain}`),
      covered_set_identity: digest(`covered:${domain}`),
      exclusions_identity: digest(`exclusions:${domain}`),
    },
  };
}

function productQuery(domain, release = 'ONE', options = {}) {
  const definition = DOMAIN_DEFINITIONS[domain];
  return compileProductQueryTemplate({
    admission: admission(release),
    query_template: queryTemplate(domain, options),
    domain_key: domain,
    predicate_key: definition.predicate,
    predicate_version: 1,
  });
}

function ownerBinding() {
  return {
    schema_version: PRODUCT_SAVED_QUERY_OWNER_BINDING_SCHEMA,
    owner_principal_id: 'BEN_GOODCHILD',
    owner_authority_binding_id: digest('owner-authority-binding'),
    runtime_authorisation_state: 'REQUIRED_BEFORE_USE',
  };
}

function savedQuery(
  domain = 'AGREEMENT',
  mode = 'PINNED',
  release = 'ONE',
) {
  return compileProductSavedQueryDefinition({
    query_ir: productQuery(domain, release),
    release_mode: mode,
    owner_binding: ownerBinding(),
  });
}

function activeReleaseResolution(active, label = 'fresh-resolution') {
  const body = {
    schema_version: PRODUCT_ACTIVE_RELEASE_RESOLUTION_SCHEMA,
    active_fence_identity: digest(`active-fence:${label}`),
    candidate_release_manifest_id:
      active.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      active.candidate_release_manifest_payload_digest,
    resolution_state: 'FRESH_EXTERNAL_RESOLUTION',
    execution_authority_state: 'NOT_GRANTED',
  };
  return {
    schema_version: body.schema_version,
    resolution_id: contentId(
      PRODUCT_ACTIVE_RELEASE_RESOLUTION_SCHEMA,
      body,
    ),
    active_fence_identity: body.active_fence_identity,
    candidate_release_manifest_id:
      body.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      body.candidate_release_manifest_payload_digest,
    resolution_state: body.resolution_state,
    execution_authority_state: body.execution_authority_state,
  };
}

function rerunContext(saved, active, label = 'fresh-resolution') {
  const resolution = activeReleaseResolution(active, label);
  const action = compileProductActiveReleaseRerunAction({
    saved_query_definition: saved,
    active_admission: active,
    active_release_resolution: resolution,
    actor_principal_id: 'BEN_GOODCHILD',
    user_action_binding_id: digest(`user-action:${label}`),
    changed_results_warning_acknowledged: true,
  });
  return { resolution, action };
}

function rehashSaved(definition) {
  const body = clone(definition);
  delete body.saved_query_definition_id;
  definition.saved_query_definition_id = contentId(
    PRODUCT_SAVED_QUERY_DEFINITION_SCHEMA,
    body,
  );
  return definition;
}

function rehashAction(action) {
  const body = clone(action);
  delete body.action_id;
  action.action_id = contentId(
    PRODUCT_ACTIVE_RELEASE_RERUN_ACTION_SCHEMA,
    body,
  );
  return action;
}

function rehashResolution(resolution) {
  const body = clone(resolution);
  delete body.resolution_id;
  resolution.resolution_id = contentId(
    PRODUCT_ACTIVE_RELEASE_RESOLUTION_SCHEMA,
    body,
  );
  return resolution;
}

function rehashOutcome(outcome) {
  const isRefusal =
    outcome.schema_version === PRODUCT_ACTIVE_RELEASE_RERUN_REFUSAL_SCHEMA;
  const idKey = isRefusal
    ? 'rerun_refusal_id'
    : 'rerun_compilation_id';
  const body = clone(outcome);
  delete body[idKey];
  outcome[idKey] = contentId(outcome.schema_version, body);
  return outcome;
}

test('compiles one immutable cursor-free pinned Product saved query', () => {
  const first = savedQuery();
  const second = savedQuery();

  assert.deepEqual(first, second);
  assertDeepFrozen(first);
  assert.equal(
    first.schema_version,
    PRODUCT_SAVED_QUERY_DEFINITION_SCHEMA,
  );
  assert.equal(first.release_policy.mode, 'PINNED');
  assert.equal(
    first.release_policy.pinned_preflight_requirement,
    'ACTIVE_MANIFEST_BYTE_EQUALITY_REQUIRED',
  );
  assert.equal(
    first.semantic_template.query_template.pagination.cursor,
    null,
  );
  assert.equal(
    canonicalProductSavedQueryDefinitionBytes(first).toString('utf8'),
    canonicalJson(first),
  );
});

test('keeps FOLLOW_ACTIVE as a fresh preflight requirement', () => {
  const saved = savedQuery('PROCESS', 'FOLLOW_ACTIVE');

  assert.equal(saved.release_policy.mode, 'FOLLOW_ACTIVE');
  assert.equal(
    saved.release_policy.follow_active_preflight_requirement,
    'FRESH_ACTIVE_RELEASE_RECOMPILE_REQUIRED',
  );
  assert.equal(
    saved.release_policy.pinned_preflight_requirement,
    'NOT_APPLICABLE',
  );
  assert.equal(saved.authority_state, 'CANONICAL_DEFINITION_ONLY');
});

test('refuses to save a valid Product Query IR with a cursor', () => {
  const cursor = {
    cursor_id: digest('cursor'),
    payload_digest: digest('cursor-payload'),
  };
  assert.throws(
    () => compileProductSavedQueryDefinition({
      query_ir: productQuery('AGREEMENT', 'ONE', { cursor }),
      release_mode: 'PINNED',
      owner_binding: ownerBinding(),
    }),
    { code: 'SAVED_QUERY_CURSOR_FORBIDDEN' },
  );
});

test('requires one bounded unresolved runtime owner binding', () => {
  const missing = ownerBinding();
  delete missing.owner_authority_binding_id;
  assert.throws(
    () => compileProductSavedQueryDefinition({
      query_ir: productQuery('AGREEMENT'),
      release_mode: 'PINNED',
      owner_binding: missing,
    }),
    { code: 'INVALID_PRODUCT_SAVED_QUERY_OWNER' },
  );

  const selfAuthorising = ownerBinding();
  selfAuthorising.runtime_authorisation_state = 'AUTHORISED';
  assert.throws(
    () => compileProductSavedQueryDefinition({
      query_ir: productQuery('AGREEMENT'),
      release_mode: 'PINNED',
      owner_binding: selfAuthorising,
    }),
    { code: 'INVALID_PRODUCT_SAVED_QUERY_OWNER' },
  );
});

test('rejects a correctly rehashed saved-template forgery', () => {
  const forged = clone(savedQuery());
  forged.semantic_template.query_template.invented_authority = true;
  rehashSaved(forged);

  assert.throws(
    () => validateProductSavedQueryDefinition(forged),
    { code: 'INVALID_PRODUCT_SAVED_QUERY_TEMPLATE' },
  );
});

test('rejects a correctly rehashed semantic substitution', () => {
  const forged = clone(savedQuery());
  forged.semantic_template.predicate_key = 'NEAREST_LEGAL_PREDICATE';
  rehashSaved(forged);

  assert.throws(
    () => validateProductSavedQueryDefinition(forged),
    { code: 'INVALID_PRODUCT_SAVED_QUERY_TEMPLATE' },
  );
});

test('requires an explicit warned owner-bound rerun action', () => {
  const saved = savedQuery();
  const active = admission('TWO');
  const { resolution, action } = rerunContext(saved, active);

  assertDeepFrozen(action);
  assert.equal(
    action.schema_version,
    PRODUCT_ACTIVE_RELEASE_RERUN_ACTION_SCHEMA,
  );
  assert.equal(action.changed_results_warning_acknowledged, true);
  assert.equal(action.execution_authority_state, 'NOT_GRANTED');
  assert.equal(
    action.saved_query_definition_id,
    saved.saved_query_definition_id,
  );

  assert.throws(
    () => compileProductActiveReleaseRerunAction({
      saved_query_definition: saved,
      active_admission: active,
      active_release_resolution: resolution,
      actor_principal_id: 'BEN_GOODCHILD',
      user_action_binding_id: digest('user-action:false-warning'),
      changed_results_warning_acknowledged: false,
    }),
    { code: 'INVALID_PRODUCT_RERUN_ACTION' },
  );
  assert.throws(
    () => compileProductActiveReleaseRerunAction({
      saved_query_definition: saved,
      active_admission: active,
      active_release_resolution: resolution,
      actor_principal_id: 'ANOTHER_PRINCIPAL',
      user_action_binding_id: digest('user-action:wrong-owner'),
      changed_results_warning_acknowledged: true,
    }),
    { code: 'INVALID_PRODUCT_RERUN_ACTION' },
  );
});

test('requires a fresh external release carrier with no execution authority', () => {
  const saved = savedQuery();
  const active = admission('TWO');
  const resolution = activeReleaseResolution(active);

  assert.doesNotThrow(
    () => validateProductActiveReleaseResolution(resolution),
  );
  assert.equal(resolution.execution_authority_state, 'NOT_GRANTED');

  const selfAsserted = clone(resolution);
  selfAsserted.resolution_state = 'CALLER_ASSERTED_ACTIVE';
  rehashResolution(selfAsserted);
  assert.throws(
    () => validateProductActiveReleaseResolution(selfAsserted),
    { code: 'INVALID_PRODUCT_ACTIVE_RELEASE_RESOLUTION' },
  );

  const otherAdmission = admission('THREE');
  assert.throws(
    () => compileProductActiveReleaseRerunAction({
      saved_query_definition: saved,
      active_admission: otherAdmission,
      active_release_resolution: resolution,
      actor_principal_id: 'BEN_GOODCHILD',
      user_action_binding_id: digest('user-action:mismatch'),
      changed_results_warning_acknowledged: true,
    }),
    { code: 'ACTIVE_RELEASE_ADMISSION_MISMATCH' },
  );
});

for (const domain of ['AGREEMENT', 'PROCESS', 'CVR']) {
  test(`recompiles ${domain} through Product Query IR on a new release`, () => {
    const saved = savedQuery(domain, 'FOLLOW_ACTIVE');
    const active = admission('TWO');
    const { resolution, action } = rerunContext(
      saved,
      active,
      `fresh-${domain}`,
    );
    const originalBytes = canonicalJson(saved);
    const result = compileProductActiveReleaseRerun({
      saved_query_definition: saved,
      active_admission: active,
      active_release_resolution: resolution,
      user_action: action,
    });

    assertDeepFrozen(result);
    assert.equal(
      result.schema_version,
      PRODUCT_ACTIVE_RELEASE_RERUN_SCHEMA,
    );
    assert.equal(
      result.compiled_query_ir.schema_version,
      PRODUCT_QUERY_IR_SCHEMA,
    );
    assert.equal(
      result.compiled_query_ir.semantic_contract.domain_key,
      domain,
    );
    assert.equal(
      result.compiled_query_ir.release_contract
        .candidate_release_manifest_id,
      active.candidate_release_manifest_id,
    );
    assert.notEqual(
      result.compiled_query_ir.query_definition_id,
      saved.source_query_ir.query_definition_id,
    );
    assert.equal(canonicalJson(saved), originalBytes);
    assert.equal(
      canonicalProductActiveReleaseRerunOutcomeBytes(result)
        .toString('utf8'),
      canonicalJson(result),
    );
    assert.equal(result.result_state.execution_state, 'NOT_EXECUTED');
  });
}

test('refuses a rerun while the saved release is still active', () => {
  const saved = savedQuery();
  const active = admission('ONE');
  const resolution = activeReleaseResolution(active, 'still-active');
  assert.throws(
    () => compileProductActiveReleaseRerunAction({
      saved_query_definition: saved,
      active_admission: active,
      active_release_resolution: resolution,
      actor_principal_id: 'BEN_GOODCHILD',
      user_action_binding_id: digest('user-action:still-active'),
      changed_results_warning_acknowledged: true,
    }),
    { code: 'SOURCE_RELEASE_STILL_ACTIVE' },
  );
});

test('returns a typed refusal when the predicate is no longer admitted', () => {
  const saved = savedQuery('PROCESS', 'FOLLOW_ACTIVE');
  const active = admission('TWO');
  active.predicate_admissions = active.predicate_admissions.filter(
    (entry) => entry.domain_key !== 'PROCESS',
  );
  const { resolution, action } = rerunContext(
    saved,
    active,
    'predicate-removed',
  );
  const originalBytes = canonicalJson(saved);
  const result = compileProductActiveReleaseRerun({
    saved_query_definition: saved,
    active_admission: active,
    active_release_resolution: resolution,
    user_action: action,
  });

  assert.equal(
    result.schema_version,
    PRODUCT_ACTIVE_RELEASE_RERUN_REFUSAL_SCHEMA,
  );
  assert.equal(result.reason.code, 'PREDICATE_NOT_ADMITTED');
  assert.equal(result.reason.domain_key, 'PROCESS');
  assert.equal(result.result_state.disposition, 'TYPED_REFUSAL');
  assert.equal(
    result.result_state.empty_result_rendering_permitted,
    false,
  );
  assert.equal(canonicalJson(saved), originalBytes);
  assert.doesNotThrow(
    () => validateProductActiveReleaseRerunOutcome(result),
  );
});

test('fails closed on an invalid active admission', () => {
  const saved = savedQuery();
  const active = admission('TWO');
  const { resolution, action } = rerunContext(
    saved,
    active,
    'invalid-admission',
  );
  active.candidate_release_manifest_payload_digest = 'invalid';

  assert.throws(
    () => compileProductActiveReleaseRerun({
      saved_query_definition: saved,
      active_admission: active,
      active_release_resolution: resolution,
      user_action: action,
    }),
    { code: 'INVALID_PRODUCT_QUERY_ADMISSION' },
  );
});

test('rejects a correctly rehashed automatic-rerun action', () => {
  const saved = savedQuery();
  const active = admission('TWO');
  const { resolution, action: validAction } = rerunContext(
    saved,
    active,
    'forged-action',
  );
  const action = clone(validAction);
  action.automatic_rerun = true;
  rehashAction(action);

  assert.throws(
    () => compileProductActiveReleaseRerun({
      saved_query_definition: saved,
      active_admission: active,
      active_release_resolution: resolution,
      user_action: action,
    }),
    { code: 'INVALID_PRODUCT_RERUN_ACTION' },
  );
});

test('rejects a correctly rehashed nested rerun authority forgery', () => {
  const saved = savedQuery();
  const active = admission('TWO');
  const { resolution, action } = rerunContext(
    saved,
    active,
    'forged-outcome',
  );
  const result = clone(compileProductActiveReleaseRerun({
    saved_query_definition: saved,
    active_admission: active,
    active_release_resolution: resolution,
    user_action: action,
  }));
  result.result_state.invented_authority = true;
  rehashOutcome(result);

  assert.throws(
    () => validateProductActiveReleaseRerunOutcome(result),
    { code: 'INVALID_PRODUCT_RERUN_INPUT' },
  );
});

test('fails closed if the signed Product action contract drifts', () => {
  const original = savedQueryContract.definition
    .pinned_release_contract
    .silent_active_release_substitution_permitted;
  savedQueryContract.definition
    .pinned_release_contract
    .silent_active_release_substitution_permitted = true;
  try {
    assert.throws(
      () => savedQuery(),
      { code: 'INVALID_PRODUCT_QUERY_ACTION_CONTRACT_BINDING' },
    );
  } finally {
    savedQueryContract.definition
      .pinned_release_contract
      .silent_active_release_substitution_permitted = original;
  }
});

test('contains no data, network, execution or Process-schema path', () => {
  const sources = [
    'lib/canonical-v2/product-saved-query-compiler.js',
    'lib/canonical-v2/product-rerun-compiler.js',
  ].map((relativePath) => fs.readFileSync(
    path.join(__dirname, '..', relativePath),
    'utf8',
  ));
  for (const source of sources) {
    for (const prohibited of [
      'PROCESS_QUERY_IR/V1',
      'process.env',
      'fetch(',
      "require('pg')",
      'createClient(',
      'child_process',
    ]) {
      assert.equal(source.includes(prohibited), false, prohibited);
    }
  }
});
