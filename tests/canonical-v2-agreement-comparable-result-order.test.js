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
  CURRENT_PM_BASELINE_FIELD_KEYS,
  buildProductFieldCatalogueManifest,
  productFieldCatalogueQueryAdmission,
  sourceRegistryPayloadDigest,
} = require('../lib/canonical-v2/product-field-catalogue');
const {
  PRODUCT_QUERY_ADMISSION_CONTEXT_SCHEMA,
  PRODUCT_QUERY_IR_SCHEMA,
  compileProductQueryIr,
} = require('../lib/canonical-v2/product-query-ir');
const {
  AGREEMENT_COMPARABLE_RESULT_ORDERING_FACT_SCHEMA,
  AGREEMENT_COMPARABLE_RESULT_ORDERING_FAILURE_SCHEMA,
  AGREEMENT_COMPARABLE_RESULT_ORDERING_PROJECTION_SCHEMA,
  AGREEMENT_ORDERING_CONTRACT_DEFINITION_DIGEST,
  AGREEMENT_ORDERING_VALIDATOR_STABLE_ID,
  AGREEMENT_ORDERING_VALIDATOR_VERSION,
  ADMITTED_AGREEMENT_RESULT_DEFINITIONS,
  AUTHORITY_LIMITS,
  MISSING_STATES,
  compileAgreementComparableResultOrder,
  validateAgreementComparableResultOrderProjection,
} = require(
  '../lib/canonical-v2/agreement-comparable-result-order',
);
const orderingContract = require(
  '../contracts/canonical-v2/successor/agreement/query/agreement-comparable-result-ordering.v1.json',
);

const ROOT = path.join(
  __dirname,
  '../contracts/canonical-v2/successor',
);
const GROUP_LABELS = Object.freeze({
  DEAL_IDENTITY: 'Deal identity',
  CHRONOLOGY: 'Deal and date',
  PARTIES: 'Parties',
  ECONOMICS: 'Consideration and value',
  TRANSACTION_STRUCTURE: 'Transaction structure',
  CLASSIFICATIONS: 'Sector and classifications',
  PROFESSIONALS: 'Law firms, lawyers and advisers',
});

function loadJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function digest(label) {
  return sha256Hex(Buffer.from(label, 'utf8'));
}

function payloadDigest(value) {
  return sha256Hex(Buffer.from(canonicalJson(value), 'utf8'));
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function identity(stableId, version = 1) {
  return {
    stable_id: stableId,
    version,
    payload_digest: digest(`${stableId}:${version}`),
  };
}

function sharedCompleteness(field) {
  if (field.multiplicity === 'MANY') {
    return 'NON_VACUOUS_ALL_AND_UNKNOWN_IF_COLLECTION_INCOMPLETE';
  }
  return field.missing_state_behaviour;
}

function sourceField(field, sourceCatalogue) {
  return {
    field_key: field.field_key,
    field_version: field.field_version,
    label: field.label,
    field_group: field.field_group,
    value_type: field.value_type,
    control_type: field.control_type,
    supported_domains: [...field.permitted_domains].sort(),
    source_permitted_result_definitions: [],
    capabilities: {
      display: field.capabilities.display,
      filter: field.capabilities.filter,
      sort: field.capabilities.sort,
      group: field.capabilities.group,
      export: true,
    },
    permitted_operators: [...field.permitted_operators].sort(),
    filter_scope: field.filter_scope,
    multiplicity: field.multiplicity,
    completeness_semantics: sharedCompleteness(field),
    source_requirement: field.source_detail_action,
    derivation_requirement: 'CANONICAL_SHARED_FACT_PROJECTION_ONLY',
    unavailable_reason: field.unavailable_request_result,
    value_vocabulary_required: field.value_type === 'ENUM',
    source_binding: {
      source_stable_id: sourceCatalogue.stable_id,
      source_schema_version: sourceCatalogue.schema_version,
      source_field_key: field.field_key,
      source_field_version: field.field_version,
    },
  };
}

function sourceRegistry() {
  const shared = loadJson(
    'shared/field-definitions/shared-deal-field-catalogue.v1.json',
  );
  const fields = shared.field_definitions
    .map((field) => sourceField(field, shared))
    .sort((left, right) => compareText(
      `${left.field_key}\0${left.field_version}`,
      `${right.field_key}\0${right.field_version}`,
    ));
  const registry = {
    schema_version: 'PRODUCT_FIELD_SOURCE_REGISTRY/V1',
    stable_id: 'PRODUCT_FIELD_SOURCE_REGISTRY',
    registry_version: 1,
    approved_pm_data_version_id: digest('approved-pm-data-version'),
    source_bindings: [{
      source_stable_id: shared.stable_id,
      source_schema_version: shared.schema_version,
      source_payload_digest: payloadDigest(shared),
      source_field_count: shared.field_definitions.length,
    }],
    field_groups: shared.field_groups.map((fieldGroupKey, index) => ({
      field_group_key: fieldGroupKey,
      label: GROUP_LABELS[fieldGroupKey],
      sort_ordinal: index + 1,
    })),
    field_definitions: fields,
    source_exclusions: [],
    current_pm_baseline_field_keys: [...CURRENT_PM_BASELINE_FIELD_KEYS],
    enumeration_certification: {
      independent_enumeration_id: digest('field-enumeration'),
      inclusion_exclusion_reconciliation_id:
        digest('field-reconciliation'),
    },
    canonical_payload_digest: null,
  };
  registry.canonical_payload_digest = sourceRegistryPayloadDigest(registry);
  return registry;
}

function fieldAdmission(field) {
  return {
    field_key: field.field_key,
    field_version: field.field_version,
    supported_domains: [...field.supported_domains],
    permitted_result_definitions: ['AGREEMENT_COMPARABLE_RESULT'],
    capabilities: clone(field.capabilities),
    permitted_operators: [...field.permitted_operators],
    value_vocabulary: field.value_vocabulary_required
      ? identity(`${field.field_key.toUpperCase()}_VALUE_REGISTRY`)
      : null,
    certification_identity:
      identity(`${field.field_key.toUpperCase()}_FIELD_CERTIFICATION`),
  };
}

function productFieldManifest() {
  const registry = sourceRegistry();
  return buildProductFieldCatalogueManifest({
    source_registry: registry,
    release_admission: {
      schema_version: 'PRODUCT_FIELD_RELEASE_ADMISSION/V1',
      approved_pm_data_version_id: registry.approved_pm_data_version_id,
      candidate_release_manifest_id:
        digest('candidate-release-manifest'),
      candidate_release_manifest_payload_digest:
        digest('candidate-release-manifest-payload'),
      source_registry_admission: {
        stable_id: registry.stable_id,
        registry_version: registry.registry_version,
        approved_pm_data_version_id:
          registry.approved_pm_data_version_id,
        canonical_payload_digest: registry.canonical_payload_digest,
        enumeration_certification:
          clone(registry.enumeration_certification),
      },
      catalogue_generator_identity:
        identity('PRODUCT_FIELD_CATALOGUE_GENERATOR'),
      shared_deal_fact_specification_identity:
        identity('SHARED_DEAL_FACT_SPECIFICATION'),
      process_specification_identity:
        identity('PROCESS_INTELLIGENCE_SPECIFICATION'),
      field_admissions: registry.field_definitions.map(fieldAdmission),
      field_exclusions: [],
      previous_catalogue_identity: null,
    },
  });
}

const CATALOGUE = productFieldManifest();
const FIELD_BY_KEY = new Map(CATALOGUE.field_definitions.map(
  (field) => [field.field_key, field],
));

function queryAdmission() {
  return {
    schema_version: PRODUCT_QUERY_ADMISSION_CONTEXT_SCHEMA,
    approved_pm_data_version_id: CATALOGUE.approved_pm_data_version_id,
    candidate_release_manifest_id:
      CATALOGUE.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      CATALOGUE.candidate_release_manifest_payload_digest,
    canonical_contract_identity: identity('CANONICAL_CONTRACT_BUNDLE'),
    product_field_catalogue:
      productFieldCatalogueQueryAdmission(CATALOGUE),
    navigation_catalogue: {
      stable_id: 'PRODUCT_NAVIGATION_CATALOGUE',
      catalogue_id: digest('navigation-catalogue'),
      payload_digest: digest('navigation-payload'),
    },
    predicate_admissions: [{
      domain_key: 'AGREEMENT',
      predicate_key: 'TRANSACTION_STRUCTURE',
      predicate_version: 1,
      admission_id: digest('agreement-predicate-admission'),
      result_definitions: [{
        stable_id: 'AGREEMENT_COMPARABLE_RESULT',
        version: 1,
      }],
      evidence_requirement_ids: [
        'EXACT_CLAIM',
        'EXACT_SOURCE_CITATION',
      ],
    }],
    exact_detail_actions: [
      'RESULT_COMPONENT_CLAIM_EVIDENCE',
    ],
    coverage_identities: [digest('coverage:AGREEMENT')],
    route_budget: {
      maximum_page_size: 50,
    },
  };
}

function fieldReference(fieldKey) {
  return {
    field_key: fieldKey,
    field_version: 1,
  };
}

function queryIr(sort, pageSize = 8) {
  const requestedColumns = [...new Set([
    'deal',
    'structure',
    ...sort.map((entry) => entry.field_key),
  ])];
  return compileProductQueryIr({
    admission: queryAdmission(),
    query: {
      domain_key: 'AGREEMENT',
      predicate_key: 'TRANSACTION_STRUCTURE',
      predicate_version: 1,
      result_definition: {
        stable_id: 'AGREEMENT_COMPARABLE_RESULT',
        version: 1,
      },
      evidence_requirement_ids: [
        'EXACT_CLAIM',
        'EXACT_SOURCE_CITATION',
      ],
      cohort: {
        cohort_definition_id: digest('agreement-cohort'),
        cohort_definition_payload_digest:
          digest('agreement-cohort-payload'),
      },
      filters: [{
        field_key: 'structure',
        field_version: 1,
        operator: 'EQ',
        value: 'MERGER',
      }],
      sort: clone(sort),
      diversity: {
        definition_id: digest('agreement-diversity'),
        payload_digest: digest('agreement-diversity-payload'),
      },
      requested_columns: requestedColumns.map(fieldReference),
      pagination: {
        page_size: pageSize,
        cursor: null,
      },
      detail_actions: ['RESULT_COMPONENT_CLAIM_EVIDENCE'],
      coverage: {
        coverage_identity: digest('coverage:AGREEMENT'),
        coverage_payload_digest: digest('coverage-payload:AGREEMENT'),
        covered_set_identity: digest('covered:AGREEMENT'),
        exclusions_identity: digest('exclusions:AGREEMENT'),
      },
    },
  });
}

function sort(fieldKey, direction = 'ASC') {
  return {
    field_key: fieldKey,
    field_version: 1,
    direction,
  };
}

function comparable(fieldKey, value) {
  return {
    state: 'COMPARABLE_VALUE',
    value_type: FIELD_BY_KEY.get(fieldKey).value_type,
    value,
  };
}

function missing(fieldKey, state) {
  return {
    state,
    value_type: FIELD_BY_KEY.get(fieldKey).value_type,
    value: null,
  };
}

function orderingFailure(label, disposition = 'FIELD_PROJECTION_INVALID') {
  const body = {
    schema_version:
      AGREEMENT_COMPARABLE_RESULT_ORDERING_FAILURE_SCHEMA,
    disposition,
  };
  return {
    schema_version: body.schema_version,
    failure_identity: contentId(
      AGREEMENT_COMPARABLE_RESULT_ORDERING_FAILURE_SCHEMA,
      body,
    ),
    disposition: body.disposition,
  };
}

function orderingFact({
  query,
  label,
  deal = digest('same-deal'),
  projections = [],
  unavailable = false,
}) {
  const body = {
    schema_version:
      AGREEMENT_COMPARABLE_RESULT_ORDERING_FACT_SCHEMA,
    fact_state: unavailable
      ? 'ORDERING_UNAVAILABLE'
      : 'VALIDATED_SORT_PROJECTION',
    product_query_result_identity:
      digest(`${query.query_definition_id}:${label}:product-result`),
    agreement_comparable_result_identity:
      digest(`${label}:agreement-result`),
    governed_deal_admission_id: deal,
    sort_projections: unavailable
      ? []
      : query.presentation_contract.sort.map((item, index) => ({
        field_reference: fieldReference(item.field_key),
        value_type: projections[index].value_type,
        value_state: projections[index].state,
        value: clone(projections[index].value),
      })),
    external_field_projection_validation_receipt_id:
      digest(`${label}:field-validation`),
    external_candidate_membership_validation_receipt_id:
      digest(`${label}:candidate-membership`),
    ordering_failure: unavailable ? orderingFailure(label) : null,
    authority_state: 'NOT_GRANTED',
  };
  return {
    schema_version: body.schema_version,
    ordering_fact_id: contentId(
      AGREEMENT_COMPARABLE_RESULT_ORDERING_FACT_SCHEMA,
      body,
    ),
    fact_state: body.fact_state,
    product_query_result_identity:
      body.product_query_result_identity,
    agreement_comparable_result_identity:
      body.agreement_comparable_result_identity,
    governed_deal_admission_id:
      body.governed_deal_admission_id,
    sort_projections: body.sort_projections,
    external_field_projection_validation_receipt_id:
      body.external_field_projection_validation_receipt_id,
    external_candidate_membership_validation_receipt_id:
      body.external_candidate_membership_validation_receipt_id,
    ordering_failure: body.ordering_failure,
    authority_state: body.authority_state,
  };
}

function compile(query, facts) {
  return compileAgreementComparableResultOrder({
    product_query_ir: query,
    product_field_catalogue_manifest: CATALOGUE,
    ordering_facts: facts,
  });
}

function resultId(fact) {
  return fact.agreement_comparable_result_identity;
}

function rehashFact(fact) {
  const body = clone(fact);
  delete body.ordering_fact_id;
  fact.ordering_fact_id = contentId(
    AGREEMENT_COMPARABLE_RESULT_ORDERING_FACT_SCHEMA,
    body,
  );
  return fact;
}

function rehashQuery(query) {
  query.query_definition_id = contentId(PRODUCT_QUERY_IR_SCHEMA, {
    schema_version: query.schema_version,
    release_contract: query.release_contract,
    semantic_contract: query.semantic_contract,
    cohort_contract: query.cohort_contract,
    filter_contract: query.filter_contract,
    presentation_contract: query.presentation_contract,
    pagination_contract: query.pagination_contract,
    detail_action_contract: query.detail_action_contract,
    coverage_contract: query.coverage_contract,
  });
  return query;
}

function rehashProjection(projection) {
  const body = clone(projection);
  delete body.ordering_projection_id;
  delete body.canonical_payload_digest;
  projection.ordering_projection_id = contentId(
    AGREEMENT_COMPARABLE_RESULT_ORDERING_PROJECTION_SCHEMA,
    body,
  );
  projection.canonical_payload_digest = sha256Hex(Buffer.from(
    canonicalJson(body),
    'utf8',
  ));
  return projection;
}

function assertDeepFrozen(value) {
  if (!value || typeof value !== 'object') return;
  assert.equal(Object.isFrozen(value), true);
  Object.values(value).forEach(assertDeepFrozen);
}

test('orders all five admitted value types with typed comparators', () => {
  const cases = [
    {
      field: 'deal',
      entries: [
        ['second', comparable('deal', {
          governed_deal_id: '2'.repeat(64),
        })],
        ['first', comparable('deal', {
          governed_deal_id: '1'.repeat(64),
        })],
      ],
      expected: ['first', 'second'],
    },
    {
      field: 'signed',
      entries: [
        ['later', comparable('signed', {
          iso_8601_calendar_date: '2025-09-21',
        })],
        ['earlier', comparable('signed', {
          iso_8601_calendar_date: '2024-01-03',
        })],
      ],
      expected: ['earlier', 'later'],
    },
    {
      field: 'buyer',
      entries: [
        ['entity-b', comparable('buyer', {
          governed_entity_id: 'b'.repeat(64),
        })],
        ['entity-a', comparable('buyer', {
          governed_entity_id: 'a'.repeat(64),
        })],
      ],
      expected: ['entity-a', 'entity-b'],
    },
    {
      field: 'value',
      entries: [
        ['ten', comparable('value', {
          value_basis_code: 'EQUITY_VALUE',
          iso_4217_currency_code: 'USD',
          canonical_decimal_amount: '10',
        })],
        ['two', comparable('value', {
          value_basis_code: 'EQUITY_VALUE',
          iso_4217_currency_code: 'USD',
          canonical_decimal_amount: '2',
        })],
        ['euro', comparable('value', {
          value_basis_code: 'EQUITY_VALUE',
          iso_4217_currency_code: 'EUR',
          canonical_decimal_amount: '1000',
        })],
        ['enterprise', comparable('value', {
          value_basis_code: 'ENTERPRISE_VALUE',
          iso_4217_currency_code: 'USD',
          canonical_decimal_amount: '1',
        })],
      ],
      expected: ['enterprise', 'euro', 'two', 'ten'],
    },
    {
      field: 'sector',
      entries: [
        ['b', comparable('sector', {
          ordered_governed_enum_codes: ['B'],
        })],
        ['a-long', comparable('sector', {
          ordered_governed_enum_codes: ['A', 'Z'],
        })],
        ['a-short', comparable('sector', {
          ordered_governed_enum_codes: ['A'],
        })],
      ],
      expected: ['a-short', 'a-long', 'b'],
    },
  ];

  for (const valueCase of cases) {
    const query = queryIr([sort(valueCase.field)]);
    const factsByLabel = new Map(valueCase.entries.map(
      ([label, projection]) => [
        label,
        orderingFact({
          query,
          label: `${valueCase.field}:${label}`,
          projections: [projection],
        }),
      ],
    ));
    const projection = compile(
      query,
      [...factsByLabel.values()].reverse(),
    );
    assert.deepEqual(
      projection.ordered_agreement_result_identities,
      valueCase.expected.map((label) => resultId(factsByLabel.get(label))),
      valueCase.field,
    );
  }
});

test('applies direction only to values and keeps missing states fixed', () => {
  const query = queryIr([sort('signed', 'DESC')]);
  const facts = [
    orderingFact({
      query,
      label: 'older',
      projections: [comparable('signed', {
        iso_8601_calendar_date: '2024-01-01',
      })],
    }),
    orderingFact({
      query,
      label: 'newer',
      projections: [comparable('signed', {
        iso_8601_calendar_date: '2025-01-01',
      })],
    }),
    ...MISSING_STATES.map((state) => orderingFact({
      query,
      label: `missing:${state}`,
      projections: [missing('signed', state)],
    })),
  ];
  const byLabel = new Map(facts.map((fact) => [
    fact.ordering_fact_id,
    fact,
  ]));
  const projection = compile(query, [...facts].reverse());
  const expectedFacts = [
    facts[1],
    facts[0],
    ...facts.slice(2),
  ];

  assert.deepEqual(
    projection.ordered_agreement_result_identities,
    expectedFacts.map(resultId),
  );
  assert.equal(byLabel.size, facts.length);
});

test('uses later sort fields, then the stable Agreement identity', () => {
  const query = queryIr([
    sort('signed', 'ASC'),
    sort('buyer', 'DESC'),
  ]);
  const commonDate = {
    iso_8601_calendar_date: '2025-01-01',
  };
  const entityA = orderingFact({
    query,
    label: 'entity-a',
    projections: [
      comparable('signed', commonDate),
      comparable('buyer', {
        governed_entity_id: 'a'.repeat(64),
      }),
    ],
  });
  const entityB = orderingFact({
    query,
    label: 'entity-b',
    projections: [
      comparable('signed', commonDate),
      comparable('buyer', {
        governed_entity_id: 'b'.repeat(64),
      }),
    ],
  });
  const projection = compile(query, [entityA, entityB]);

  assert.deepEqual(
    projection.ordered_agreement_result_identities,
    [resultId(entityB), resultId(entityA)],
  );

  const first = orderingFact({
    query,
    label: 'tie-one',
    projections: clone(entityA.sort_projections).map((entry) => ({
      state: entry.value_state,
      value_type: entry.value_type,
      value: entry.value,
    })),
  });
  const second = orderingFact({
    query,
    label: 'tie-two',
    projections: clone(entityA.sort_projections).map((entry) => ({
      state: entry.value_state,
      value_type: entry.value_type,
      value: entry.value,
    })),
  });
  const tieProjection = compile(query, [first, second]);
  assert.deepEqual(
    tieProjection.ordered_agreement_result_identities,
    [resultId(first), resultId(second)].sort(compareText),
  );
});

test('diversifies by governed deal and appends typed failures', () => {
  const query = queryIr([sort('signed')]);
  const dealA = digest('deal-a');
  const dealB = digest('deal-b');
  const dated = (label, deal, date) => orderingFact({
    query,
    label,
    deal,
    projections: [comparable('signed', {
      iso_8601_calendar_date: date,
    })],
  });
  const a1 = dated('a1', dealA, '2025-01-01');
  const a2 = dated('a2', dealA, '2025-01-02');
  const b1 = dated('b1', dealB, '2025-01-03');
  const a3 = dated('a3', dealA, '2025-01-04');
  const b2 = dated('b2', dealB, '2025-01-05');
  const failedA = orderingFact({
    query,
    label: 'failed-a',
    deal: dealA,
    unavailable: true,
  });
  const failedB = orderingFact({
    query,
    label: 'failed-b',
    deal: dealB,
    unavailable: true,
  });
  const projection = compile(query, [
    failedB,
    a3,
    a2,
    b2,
    a1,
    failedA,
    b1,
  ]);
  const failedIds = [resultId(failedA), resultId(failedB)]
    .sort(compareText);

  assert.deepEqual(
    projection.ordered_agreement_result_identities,
    [
      resultId(a1),
      resultId(b1),
      resultId(a2),
      resultId(b2),
      resultId(a3),
      ...failedIds,
    ],
  );
  assert.deepEqual(
    projection.ordered_failed_agreement_result_identities,
    failedIds,
  );
  assert.equal(
    projection.failure_state,
    'TYPED_ORDERING_FAILURES_RETAINED',
  );
  for (const failedId of failedIds) {
    const fact = projection.validated_ordering_facts.find(
      (entry) => (
        entry.agreement_comparable_result_identity === failedId
      ),
    );
    assert.equal(fact.ordering_failure.disposition, 'FIELD_PROJECTION_INVALID');
  }
});

test('is deterministic, deeply frozen and does not pad a short page', () => {
  const query = queryIr([sort('signed')], 8);
  const facts = Array.from({ length: 10 }, (_, index) => orderingFact({
    query,
    label: `candidate-${index}`,
    deal: digest(`deal-${index % 3}`),
    projections: [comparable('signed', {
      iso_8601_calendar_date:
        `2025-01-${String(index + 1).padStart(2, '0')}`,
    })],
  }));
  const first = compile(query, facts);
  const second = compile(query, [...facts].reverse());
  const short = compile(query, facts.slice(0, 3));

  assert.deepEqual(first, second);
  assert.equal(first.first_page_agreement_result_identities.length, 8);
  assert.equal(short.first_page_agreement_result_identities.length, 3);
  assert.equal(new Set(
    first.ordered_agreement_result_identities,
  ).size, 10);
  assert.equal(first.no_padding_or_repetition, true);
  assert.equal(
    first.ordering_validator_stable_id,
    AGREEMENT_ORDERING_VALIDATOR_STABLE_ID,
  );
  assert.equal(
    first.ordering_validator_version,
    AGREEMENT_ORDERING_VALIDATOR_VERSION,
  );
  assert.equal(
    first.ordering_contract_definition_digest,
    AGREEMENT_ORDERING_CONTRACT_DEFINITION_DIGEST,
  );
  assert.deepEqual(first.authority_limits, AUTHORITY_LIMITS);
  assertDeepFrozen(first);
  assert.equal(
    validateAgreementComparableResultOrderProjection(first),
    true,
  );
});

test('rejects unsupported professional sorts before ordering candidates', () => {
  const query = clone(queryIr([sort('deal')]));
  query.presentation_contract.sort = [sort('law_firm')];
  rehashQuery(query);

  assert.throws(
    () => compile(query, []),
    (error) => (
      error.code === 'SORT_FIELD_TYPE_NOT_SUPPORTED'
      && error.details.value_type === 'PROFESSIONAL_ASSIGNMENT'
    ),
  );
});

test('rejects caller rank, display text and missing-state recasting', () => {
  const query = queryIr([sort('signed')]);
  const valid = orderingFact({
    query,
    label: 'valid',
    projections: [comparable('signed', {
      iso_8601_calendar_date: '2025-01-01',
    })],
  });
  const ranked = rehashFact(clone(valid));
  ranked.caller_rank = 1;
  rehashFact(ranked);
  assert.throws(
    () => compile(query, [ranked]),
    { code: 'INVALID_AGREEMENT_COMPARABLE_RESULT_ORDERING_FACT' },
  );

  const labelled = clone(valid);
  labelled.sort_projections[0].display_label = 'January 1, 2025';
  rehashFact(labelled);
  assert.throws(
    () => compile(query, [labelled]),
    { code: 'INVALID_AGREEMENT_COMPARABLE_RESULT_ORDERING_FACT' },
  );

  const recast = clone(valid);
  recast.sort_projections[0].value_state = 'UNKNOWN';
  recast.sort_projections[0].value = {
    iso_8601_calendar_date: '9999-12-31',
  };
  rehashFact(recast);
  assert.throws(
    () => compile(query, [recast]),
    { code: 'INVALID_AGREEMENT_COMPARABLE_RESULT_ORDERING_FACT' },
  );

  const enumQuery = queryIr([sort('sector')]);
  const displayText = orderingFact({
    query: enumQuery,
    label: 'display-text-enum',
    projections: [comparable('sector', {
      ordered_governed_enum_codes: ['Biopharma'],
    })],
  });
  assert.throws(
    () => compile(enumQuery, [displayText]),
    { code: 'INVALID_AGREEMENT_COMPARABLE_RESULT_ORDERING_FACT' },
  );
});

test('rejects malformed unavailable facts and duplicate candidates', () => {
  const query = queryIr([sort('signed')]);
  const unavailable = orderingFact({
    query,
    label: 'unavailable',
    unavailable: true,
  });
  const withProjection = clone(unavailable);
  withProjection.sort_projections = [{
    field_reference: fieldReference('signed'),
    value_type: 'DATE',
    value_state: 'UNKNOWN',
    value: null,
  }];
  rehashFact(withProjection);
  assert.throws(
    () => compile(query, [withProjection]),
    { code: 'INVALID_AGREEMENT_COMPARABLE_RESULT_ORDERING_FACT' },
  );

  const noFailure = clone(unavailable);
  noFailure.ordering_failure = null;
  rehashFact(noFailure);
  assert.throws(
    () => compile(query, [noFailure]),
    { code: 'INVALID_AGREEMENT_COMPARABLE_RESULT_ORDERING_FACT' },
  );

  assert.throws(
    () => compile(query, [unavailable, unavailable]),
    { code: 'DUPLICATE_AGREEMENT_COMPARABLE_RESULT_CANDIDATE' },
  );
});

test('rejects malformed typed values before comparison', () => {
  const cases = [
    {
      field: 'signed',
      value: {
        iso_8601_calendar_date: '2025-02-30',
      },
    },
    {
      field: 'value',
      value: {
        value_basis_code: 'EQUITY_VALUE',
        iso_4217_currency_code: 'US',
        canonical_decimal_amount: '10',
      },
    },
    {
      field: 'value',
      value: {
        value_basis_code: 'EQUITY_VALUE',
        iso_4217_currency_code: 'USD',
        canonical_decimal_amount: '01.00',
      },
    },
    {
      field: 'sector',
      value: {
        ordered_governed_enum_codes: ['BIOPHARMA', 'BIOPHARMA'],
      },
    },
  ];

  for (const valueCase of cases) {
    const query = queryIr([sort(valueCase.field)]);
    const fact = orderingFact({
      query,
      label: `malformed:${valueCase.field}:${canonicalJson(valueCase.value)}`,
      projections: [comparable(valueCase.field, valueCase.value)],
    });
    assert.throws(
      () => compile(query, [fact]),
      { code: 'INVALID_AGREEMENT_COMPARABLE_RESULT_ORDERING_FACT' },
    );
  }
});

test('rejects catalogue drift and correctly rehashed order forgery', () => {
  const query = queryIr([sort('signed')]);
  const first = orderingFact({
    query,
    label: 'first',
    projections: [comparable('signed', {
      iso_8601_calendar_date: '2025-01-01',
    })],
  });
  const second = orderingFact({
    query,
    label: 'second',
    projections: [comparable('signed', {
      iso_8601_calendar_date: '2025-01-02',
    })],
  });
  const driftedQuery = clone(query);
  driftedQuery.release_contract.product_field_catalogue_manifest_id =
    digest('other-catalogue');
  rehashQuery(driftedQuery);
  assert.throws(
    () => compile(driftedQuery, []),
    { code: 'INVALID_AGREEMENT_COMPARABLE_RESULT_ORDER_BINDING' },
  );

  const forged = clone(compile(query, [first, second]));
  forged.ordered_agreement_result_identities.reverse();
  forged.first_page_agreement_result_identities.reverse();
  rehashProjection(forged);
  assert.throws(
    () => validateAgreementComparableResultOrderProjection(forged),
    { code: 'INVALID_AGREEMENT_COMPARABLE_RESULT_ORDERING_PROJECTION' },
  );
});

test('fails closed when the signed ordering contract changes', () => {
  const query = queryIr([sort('deal')]);
  const original = orderingContract.definition.query_release_binding_contract
    .candidate_can_move_between_query_or_release;
  orderingContract.definition.query_release_binding_contract
    .candidate_can_move_between_query_or_release = true;
  try {
    assert.throws(
      () => compile(query, []),
      {
        code:
          'INVALID_AGREEMENT_COMPARABLE_RESULT_ORDER_CONTRACT_BINDING',
      },
    );
  } finally {
    orderingContract.definition.query_release_binding_contract
      .candidate_can_move_between_query_or_release = original;
  }
});

test('admits the closed generic Agreement result-definition set', () => {
  assert.deepEqual(ADMITTED_AGREEMENT_RESULT_DEFINITIONS, [
    { stable_id: 'AGREEMENT_COMPARABLE_RESULT', version: 1 },
    { stable_id: 'TARGET_CAPEX_RESTRICTION', version: 1 },
    { stable_id: 'TARGET_CAPITALISATION_BRING_DOWN', version: 3 },
  ]);
  assert.deepEqual(
    orderingContract.definition.projection_contract
      .admitted_agreement_result_definitions,
    ADMITTED_AGREEMENT_RESULT_DEFINITIONS,
  );
});

test('contains no query, source-read, database, serving or UI path', () => {
  const source = fs.readFileSync(
    path.join(
      __dirname,
      '../lib/canonical-v2/agreement-comparable-result-order.js',
    ),
    'utf8',
  );

  assert.doesNotMatch(
    source,
    /require\(['"](?:node:)?(?:fs|http|https|net|child_process)['"]\)/,
  );
  assert.doesNotMatch(
    source,
    /\b(?:fetch|execute|render|writeFile|readFile|createClient)\s*\(/,
  );
  assert.doesNotMatch(source, /\b(?:process\.env|supabase|postgres)\b/i);
});
