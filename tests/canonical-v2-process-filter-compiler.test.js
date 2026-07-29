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
  PROCESS_FILTER_COMPILATION_SCHEMA,
  PROCESS_FILTER_VALUE_OPTION_SET_SCHEMA,
  compileProcessFilters,
  listProcessFilterFields,
  listProcessFilterValueOptions,
  presentationRegistryPayloadDigest,
  processFilterQueryClauses,
  queryContextId,
  validateProcessFilterCompilation,
  valueOptionId,
} = require('../lib/canonical-v2/process-filter-compiler');
const {
  PROCESS_QUERY_ADMISSION_CONTEXT_SCHEMA,
  compileProcessQueryTemplate,
} = require('../lib/canonical-v2/process-query-ir');

const RESULT_DEFINITION = Object.freeze({
  stable_id: 'PROCESS_PHRASEBOOK_PASSAGE_RESULT',
  version: 1,
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function digest(label) {
  return sha256Hex(Buffer.from(label, 'utf8'));
}

function identity(stableId, version = 1) {
  return {
    stable_id: stableId,
    version,
    payload_digest: digest(`${stableId}:${version}`),
  };
}

function field({
  fieldKey,
  label,
  fieldGroup,
  valueType,
  controlType,
  permittedOperators,
  filterScope,
  multiplicity = 'ZERO_OR_ONE',
  completenessSemantics = 'TYPED_STATE_NEVER_EMPTY_TEXT',
  filter = true,
  supportedDomains = ['PROCESS'],
  resultDefinitions = [RESULT_DEFINITION.stable_id],
}) {
  return {
    field_key: fieldKey,
    field_version: 1,
    label,
    field_group: fieldGroup,
    value_type: valueType,
    control_type: controlType,
    supported_domains: [...supportedDomains].sort(),
    permitted_result_definitions: [...resultDefinitions].sort(),
    capabilities: {
      display: true,
      filter,
      sort: fieldKey === 'signed',
      group: filter,
      export: true,
    },
    permitted_operators: [...permittedOperators].sort(),
    filter_scope: filterScope,
    multiplicity,
    completeness_semantics: completenessSemantics,
    unavailable_reason: filter
      ? 'FIELD_NOT_AVAILABLE_FOR_SELECTED_QUERY'
      : 'FIELD_IS_DISPLAY_ONLY',
  };
}

function baseFields({ includeCvr = false } = {}) {
  const fields = [
    field({
      fieldKey: 'actual_drafting',
      label: 'Actual drafting',
      fieldGroup: 'PROCESS_SOURCE_AND_CERTIFICATION',
      valueType: 'PROCESS_PASSAGE_REFERENCE',
      controlType: 'NONE',
      permittedOperators: [],
      filterScope: 'SAME_RESULT_COMPONENT',
      multiplicity: 'ONE_OR_MORE',
      filter: false,
    }),
    field({
      fieldKey: 'law_firm_target',
      label: 'Law firm (target)',
      fieldGroup: 'PROFESSIONALS',
      valueType: 'PROFESSIONAL_ASSIGNMENT',
      controlType: 'PROFESSIONAL_MULTISELECT',
      permittedOperators: ['ALL', 'IN', 'NONE'],
      filterScope: 'SAME_PROFESSIONAL_ASSIGNMENT_COMPONENT',
      multiplicity: 'MANY',
      completenessSemantics:
        'NON_VACUOUS_ALL_AND_UNKNOWN_IF_COLLECTION_INCOMPLETE',
    }),
    field({
      fieldKey: 'process_participant',
      label: 'Process participant',
      fieldGroup: 'PROCESS_PARTIES_AND_TRACKS',
      valueType: 'PROCESS_PARTICIPANT_REFERENCE',
      controlType: 'IDENTITY_MULTISELECT',
      permittedOperators: ['ALL', 'IN'],
      filterScope: 'SAME_EVENT_AND_BIDDER_TRACK',
      multiplicity: 'ONE_OR_MORE',
      completenessSemantics:
        'NON_VACUOUS_ALL_AND_UNKNOWN_IF_COLLECTION_INCOMPLETE',
    }),
    field({
      fieldKey: 'process_participant_role',
      label: 'Process role',
      fieldGroup: 'PROCESS_PARTIES_AND_TRACKS',
      valueType: 'GOVERNED_CODE',
      controlType: 'ENUM_MULTISELECT',
      permittedOperators: ['IN'],
      filterScope: 'SAME_PARTICIPANT_COMPONENT',
      multiplicity: 'ONE_OR_MORE',
      completenessSemantics:
        'NON_VACUOUS_ALL_AND_UNKNOWN_IF_COLLECTION_INCOMPLETE',
    }),
    field({
      fieldKey: 'sector',
      label: 'Sector',
      fieldGroup: 'CLASSIFICATIONS',
      valueType: 'ENUM',
      controlType: 'ENUM_MULTISELECT',
      permittedOperators: ['EQ', 'EXISTS', 'IN', 'NONE'],
      filterScope: 'SINGLE_DEAL_FACT_RESOLUTION',
    }),
    field({
      fieldKey: 'signed',
      label: 'Signed',
      fieldGroup: 'CHRONOLOGY',
      valueType: 'DATE',
      controlType: 'DATE_RANGE',
      permittedOperators: ['AFTER', 'BEFORE', 'BETWEEN'],
      filterScope: 'SINGLE_DEAL_FACT_RESOLUTION',
    }),
    field({
      fieldKey: 'structure',
      label: 'Structure',
      fieldGroup: 'TRANSACTION_STRUCTURE',
      valueType: 'ENUM',
      controlType: 'ENUM_MULTISELECT',
      permittedOperators: ['EQ', 'IN', 'NONE'],
      filterScope: 'SINGLE_TRANSACTION_STRUCTURE_RESOLUTION',
    }),
  ];
  if (includeCvr) {
    fields.push(field({
      fieldKey: 'cvr_milestone_type',
      label: 'CVR milestone type',
      fieldGroup: 'CVR_MILESTONES',
      valueType: 'GOVERNED_CODE',
      controlType: 'ENUM_MULTISELECT',
      permittedOperators: ['EQ', 'IN'],
      filterScope: 'SAME_CVR_MILESTONE_COMPONENT',
      supportedDomains: ['CVR'],
      resultDefinitions: ['CVR_PHRASEBOOK_PASSAGE_RESULT'],
    }));
  }
  return fields.sort((left, right) => (
    left.field_key < right.field_key ? -1 : 1
  ));
}

function productFieldCatalogue({ includeCvr = false } = {}) {
  return {
    stable_id: 'PRODUCT_FIELD_CATALOGUE',
    manifest_id: digest(
      includeCvr
        ? 'product-field-catalogue-with-cvr'
        : 'product-field-catalogue',
    ),
    payload_digest: digest(
      includeCvr
        ? 'product-field-catalogue-payload-with-cvr'
        : 'product-field-catalogue-payload',
    ),
    field_definitions: baseFields({ includeCvr }),
  };
}

function browsePath(domainKey) {
  return domainKey === 'CVR'
    ? {
      topic_key: 'MILESTONES',
      pattern_key: 'CVR_REGULATORY_MILESTONE',
    }
    : {
      topic_key: 'EXCLUSIVITY',
      pattern_key: 'EXCLUSIVITY_GRANTED',
    };
}

function applicability(domainKey = 'PROCESS') {
  return [{
    domain_key: domainKey,
    predicate_key: domainKey === 'CVR'
      ? 'CVR_REGULATORY_MILESTONE'
      : 'EXCLUSIVITY_GRANTED',
    predicate_version: 1,
    result_definition_stable_id: domainKey === 'CVR'
      ? 'CVR_PHRASEBOOK_PASSAGE_RESULT'
      : RESULT_DEFINITION.stable_id,
    ask_permitted: true,
    browse_paths: [browsePath(domainKey)],
  }];
}

function mapping(
  practitionerOperator,
  machineOperator,
  operandKind,
) {
  return {
    practitioner_operator: practitionerOperator,
    machine_operator: machineOperator,
    operand_kind: operandKind,
  };
}

function presentationForField(catalogueField) {
  const common = {
    field_key: catalogueField.field_key,
    field_version: catalogueField.field_version,
    field_group_label: catalogueField.field_group
      .toLocaleLowerCase('en-US')
      .replace(/_/g, ' '),
    search_terms: [catalogueField.label],
    sentence_label: catalogueField.label,
    operator_mappings: [],
    query_applicability: applicability(
      catalogueField.supported_domains[0],
    ),
    scope_presentation: {
      filter_scope: catalogueField.filter_scope,
      role_label: null,
      correlation_contract: 'FIELD_SCOPE_IS_COMPLETE',
    },
    certification_identity:
      identity(`${catalogueField.field_key.toUpperCase()}_FILTER_PRESENTATION`),
  };
  switch (catalogueField.field_key) {
    case 'sector':
      common.search_terms.push('industry');
      common.operator_mappings = [
        mapping('includes any', 'IN', 'ONE_OR_MORE_OPTIONS'),
        mapping('is', 'EQ', 'ONE_OPTION'),
        mapping('is not', 'NONE', 'ONE_OR_MORE_OPTIONS'),
      ];
      break;
    case 'signed':
      common.operator_mappings = [
        mapping('after', 'AFTER', 'ONE_LITERAL'),
        mapping('before', 'BEFORE', 'ONE_LITERAL'),
        mapping('between', 'BETWEEN', 'TWO_LITERALS'),
      ];
      break;
    case 'structure':
      common.search_terms.push('transaction structure');
      common.operator_mappings = [
        mapping('includes any', 'IN', 'ONE_OR_MORE_OPTIONS'),
        mapping('is', 'EQ', 'ONE_OPTION'),
        mapping('is not', 'NONE', 'ONE_OR_MORE_OPTIONS'),
      ];
      break;
    case 'law_firm_target':
      common.search_terms.push('target counsel');
      common.sentence_label = 'Target counsel';
      common.operator_mappings = [
        mapping('includes all', 'ALL', 'ONE_OR_MORE_OPTIONS'),
        mapping('includes any', 'IN', 'ONE_OR_MORE_OPTIONS'),
        mapping('includes none', 'NONE', 'ONE_OR_MORE_OPTIONS'),
      ];
      common.scope_presentation.role_label = 'Target';
      break;
    case 'process_participant':
      common.operator_mappings = [
        mapping('includes all', 'ALL', 'ONE_OR_MORE_OPTIONS'),
        mapping('includes any', 'IN', 'ONE_OR_MORE_OPTIONS'),
      ];
      common.scope_presentation.correlation_contract =
        'COMPOSITE_FILTER_CONTRACT_REQUIRED';
      break;
    case 'process_participant_role':
      common.operator_mappings = [
        mapping('includes any', 'IN', 'ONE_OR_MORE_OPTIONS'),
      ];
      common.scope_presentation.correlation_contract =
        'COMPOSITE_FILTER_CONTRACT_REQUIRED';
      break;
    case 'cvr_milestone_type':
      common.operator_mappings = [
        mapping('includes any', 'IN', 'ONE_OR_MORE_OPTIONS'),
        mapping('is', 'EQ', 'ONE_OPTION'),
      ];
      break;
    default:
      throw new Error(`No presentation fixture for ${catalogueField.field_key}`);
  }
  return common;
}

function presentationRegistry(catalogue) {
  const presentations = catalogue.field_definitions
    .filter((catalogueField) => catalogueField.capabilities.filter)
    .map(presentationForField)
    .sort((left, right) => (
      left.field_key < right.field_key ? -1 : 1
    ));
  const exclusions = catalogue.field_definitions
    .filter((catalogueField) => !catalogueField.capabilities.filter)
    .map((catalogueField) => ({
      field_key: catalogueField.field_key,
      field_version: catalogueField.field_version,
      reason_code: 'FIELD_IS_DISPLAY_ONLY',
      evidence_identity:
        identity(`${catalogueField.field_key.toUpperCase()}_FILTER_EXCLUSION`),
    }));
  const registry = {
    schema_version: 'PROCESS_FILTER_PRESENTATION_REGISTRY/V1',
    stable_id: 'PROCESS_FILTER_PRESENTATION_REGISTRY',
    registry_version: 1,
    approved_pm_data_version_id: digest('approved-pm-data-version'),
    product_field_catalogue_manifest_id: catalogue.manifest_id,
    product_field_catalogue_payload_digest: catalogue.payload_digest,
    field_presentations: presentations,
    field_exclusions: exclusions,
    enumeration_certification: {
      independent_field_enumeration_identity:
        identity('FILTER_INDEPENDENT_FIELD_ENUMERATION'),
      presentation_exclusion_reconciliation_identity:
        identity('FILTER_PRESENTATION_EXCLUSION_RECONCILIATION'),
    },
    canonical_payload_digest: null,
  };
  registry.canonical_payload_digest =
    presentationRegistryPayloadDigest(registry);
  return registry;
}

function registryAdmission(registry, catalogue) {
  return {
    schema_version:
      'PROCESS_FILTER_PRESENTATION_REGISTRY_ADMISSION/V1',
    stable_id: registry.stable_id,
    registry_version: registry.registry_version,
    approved_pm_data_version_id: registry.approved_pm_data_version_id,
    product_field_catalogue_manifest_id: catalogue.manifest_id,
    product_field_catalogue_payload_digest: catalogue.payload_digest,
    registry_payload_digest: registry.canonical_payload_digest,
    enumeration_certification: clone(registry.enumeration_certification),
  };
}

function queryContext({
  catalogue,
  domainKey = 'PROCESS',
  entryMode = 'BROWSE',
} = {}) {
  const isCvr = domainKey === 'CVR';
  return {
    approved_pm_data_version_id: digest('approved-pm-data-version'),
    product_field_catalogue_manifest_id: catalogue.manifest_id,
    domain_key: domainKey,
    entry_mode: entryMode,
    topic_key: entryMode === 'BROWSE'
      ? browsePath(domainKey).topic_key
      : null,
    pattern_key: entryMode === 'BROWSE'
      ? browsePath(domainKey).pattern_key
      : null,
    predicate_key: isCvr
      ? 'CVR_REGULATORY_MILESTONE'
      : 'EXCLUSIVITY_GRANTED',
    predicate_version: 1,
    result_definition: {
      stable_id: isCvr
        ? 'CVR_PHRASEBOOK_PASSAGE_RESULT'
        : RESULT_DEFINITION.stable_id,
      version: 1,
    },
    understood_legal_question_label: isCvr
      ? 'Regulatory milestone'
      : 'Exclusivity granted',
  };
}

function inputs(options = {}) {
  const catalogue = productFieldCatalogue(options);
  const registry = presentationRegistry(catalogue);
  const context = queryContext({
    catalogue,
    domainKey: options.includeCvr ? 'CVR' : 'PROCESS',
    entryMode: options.entryMode || 'BROWSE',
  });
  return {
    catalogue,
    registry,
    admission: registryAdmission(registry, catalogue),
    context,
  };
}

function valueOption(fieldKey, fieldVersion, canonicalValue, label, count, ordinal) {
  return {
    option_id: valueOptionId(
      fieldKey,
      fieldVersion,
      canonicalValue,
      label,
    ),
    canonical_value: canonicalValue,
    display_label: label,
    occurrence_count: count,
    sort_ordinal: ordinal,
  };
}

function optionSet({
  catalogue,
  context,
  fieldKey,
  values,
}) {
  const body = {
    schema_version: PROCESS_FILTER_VALUE_OPTION_SET_SCHEMA,
    approved_pm_data_version_id: context.approved_pm_data_version_id,
    product_field_catalogue_manifest_id: catalogue.manifest_id,
    query_context_id: queryContextId(context),
    field_key: fieldKey,
    field_version: 1,
    other_filter_set_id: digest(`other-filter-set:${fieldKey}`),
    covered_set_identity: digest(`covered-set:${fieldKey}`),
    options: values.map((value, index) => valueOption(
      fieldKey,
      1,
      value.canonicalValue,
      value.label,
      value.count,
      index + 1,
    )),
  };
  return {
    ...body,
    option_set_id: contentId(PROCESS_FILTER_VALUE_OPTION_SET_SCHEMA, body),
  };
}

function findOption(set, label) {
  return set.options.find((option) => option.display_label === label);
}

function optionRequest(fieldKey, practitionerOperator, optionIds) {
  return {
    field_key: fieldKey,
    field_version: 1,
    practitioner_operator: practitionerOperator,
    operand: {
      kind: optionIds.length === 1 && practitionerOperator === 'is'
        ? 'ONE_OPTION'
        : 'ONE_OR_MORE_OPTIONS',
      values: optionIds,
    },
  };
}

function literalRequest(
  fieldKey,
  practitionerOperator,
  values,
) {
  return {
    field_key: fieldKey,
    field_version: 1,
    practitioner_operator: practitionerOperator,
    operand: {
      kind: values.length === 1 ? 'ONE_LITERAL' : 'TWO_LITERALS',
      values: values.map((value) => ({
        canonical_value: value.canonicalValue,
        display_label: value.label,
      })),
    },
  };
}

function assertDeepFrozen(value) {
  if (!value || typeof value !== 'object') return;
  assert.equal(Object.isFrozen(value), true);
  Object.values(value).forEach(assertDeepFrozen);
}

test('searches active fields and returns typed unavailable matches', () => {
  const fixture = inputs();
  const all = listProcessFilterFields({
    product_field_catalogue: fixture.catalogue,
    presentation_registry: fixture.registry,
    registry_admission: fixture.admission,
    query_context: fixture.context,
    search_text: '',
  });
  assert.equal(all.available_fields.length, 4);
  assert.equal(all.unavailable_matches.length, 0);

  const counsel = listProcessFilterFields({
    product_field_catalogue: fixture.catalogue,
    presentation_registry: fixture.registry,
    registry_admission: fixture.admission,
    query_context: fixture.context,
    search_text: 'target counsel',
  });
  assert.deepEqual(
    counsel.available_fields.map((entry) => entry.field_key),
    ['law_firm_target'],
  );
  assert.equal(counsel.available_fields[0].role_label, 'Target');

  const drafting = listProcessFilterFields({
    product_field_catalogue: fixture.catalogue,
    presentation_registry: fixture.registry,
    registry_admission: fixture.admission,
    query_context: fixture.context,
    search_text: 'actual drafting',
  });
  assert.deepEqual(drafting.available_fields, []);
  assert.deepEqual(drafting.unavailable_matches, [{
    field_key: 'actual_drafting',
    field_version: 1,
    label: 'Actual drafting',
    reason: 'FIELD_IS_DISPLAY_ONLY',
  }]);

  const participant = listProcessFilterFields({
    product_field_catalogue: fixture.catalogue,
    presentation_registry: fixture.registry,
    registry_admission: fixture.admission,
    query_context: fixture.context,
    search_text: 'Process participant',
  });
  assert.deepEqual(participant.available_fields, []);
  assert.equal(
    participant.unavailable_matches[0].reason,
    'COMPOSITE_FILTER_CONTRACT_REQUIRED',
  );
});

test('compiles practitioner operators and one short active-filter sentence', () => {
  const fixture = inputs();
  const sectors = optionSet({
    catalogue: fixture.catalogue,
    context: fixture.context,
    fieldKey: 'sector',
    values: [
      { canonicalValue: 'BIOPHARMA', label: 'Biopharma', count: 12 },
    ],
  });
  const compilation = compileProcessFilters({
    product_field_catalogue: fixture.catalogue,
    presentation_registry: fixture.registry,
    registry_admission: fixture.admission,
    query_context: fixture.context,
    filter_requests: [
      optionRequest(
        'sector',
        'is',
        [findOption(sectors, 'Biopharma').option_id],
      ),
      literalRequest('signed', 'after', [{
        canonicalValue: '2020-01-01',
        label: '2020',
      }]),
    ],
    value_option_sets: [sectors],
  });

  assert.deepEqual(processFilterQueryClauses(compilation), [
    {
      field_key: 'sector',
      field_version: 1,
      operator: 'EQ',
      value: 'BIOPHARMA',
    },
    {
      field_key: 'signed',
      field_version: 1,
      operator: 'AFTER',
      value: '2020-01-01',
    },
  ]);
  assert.equal(
    compilation.active_filter_sentence.text,
    'Exclusivity granted, Sector is Biopharma, Signed after 2020.',
  );
  assert.equal(compilation.active_filter_sentence.clause_count, 2);
  assertDeepFrozen(compilation);
});

test('feeds the existing Query IR without an adapter or hidden operator', () => {
  const fixture = inputs();
  const sectors = optionSet({
    catalogue: fixture.catalogue,
    context: fixture.context,
    fieldKey: 'sector',
    values: [
      { canonicalValue: 'BIOPHARMA', label: 'Biopharma', count: 12 },
    ],
  });
  const compilation = compileProcessFilters({
    product_field_catalogue: fixture.catalogue,
    presentation_registry: fixture.registry,
    registry_admission: fixture.admission,
    query_context: fixture.context,
    filter_requests: [
      optionRequest(
        'sector',
        'is',
        [findOption(sectors, 'Biopharma').option_id],
      ),
    ],
    value_option_sets: [sectors],
  });
  const admission = {
    schema_version: PROCESS_QUERY_ADMISSION_CONTEXT_SCHEMA,
    approved_pm_data_version_id: fixture.context.approved_pm_data_version_id,
    candidate_release_manifest_id: digest('candidate-release-manifest'),
    candidate_release_manifest_payload_digest:
      digest('candidate-release-manifest-payload'),
    canonical_contract_identity: identity('CANONICAL_CONTRACT_BUNDLE'),
    product_field_catalogue: fixture.catalogue,
    navigation_catalogue: {
      stable_id: 'PRODUCT_NAVIGATION_CATALOGUE',
      catalogue_id: digest('product-navigation-catalogue'),
      payload_digest: digest('product-navigation-catalogue-payload'),
    },
    predicate_admissions: [{
      domain_key: 'PROCESS',
      predicate_key: 'EXCLUSIVITY_GRANTED',
      predicate_version: 1,
      admission_id: digest('exclusivity-granted-admission'),
      result_definitions: [clone(RESULT_DEFINITION)],
      evidence_requirement_ids: [
        'EXACT_PASSAGE',
        'EXACT_SOURCE_CITATION',
      ],
    }],
    exact_detail_actions: ['PARENT_BOUND_PARAGRAPH_CONTEXT'],
    coverage_identities: [digest('process-coverage')],
    route_budget: {
      maximum_page_size: 50,
    },
  };
  const queryIr = compileProcessQueryTemplate({
    admission,
    domain_key: 'PROCESS',
    predicate_key: 'EXCLUSIVITY_GRANTED',
    predicate_version: 1,
    query_template: {
      result_definition: clone(RESULT_DEFINITION),
      evidence_requirement_ids: [
        'EXACT_PASSAGE',
        'EXACT_SOURCE_CITATION',
      ],
      cohort: {
        cohort_definition_id: digest('cohort'),
        cohort_definition_payload_digest: digest('cohort-payload'),
      },
      filters: processFilterQueryClauses(compilation),
      sort: [{
        field_key: 'signed',
        field_version: 1,
        direction: 'DESC',
      }],
      diversity: {
        definition_id: digest('diversity'),
        payload_digest: digest('diversity-payload'),
      },
      requested_columns: [{
        field_key: 'actual_drafting',
        field_version: 1,
      }],
      pagination: {
        page_size: 25,
        cursor: null,
      },
      detail_actions: ['PARENT_BOUND_PARAGRAPH_CONTEXT'],
      coverage: {
        coverage_identity: digest('process-coverage'),
        coverage_payload_digest: digest('process-coverage-payload'),
        covered_set_identity: digest('covered-set'),
        exclusions_identity: digest('coverage-exclusions'),
      },
    },
  });
  assert.equal(queryIr.filter_contract.clauses[0].operator, 'EQ');
  assert.equal(queryIr.filter_contract.clauses[0].field_scope,
    'SINGLE_DEAL_FACT_RESOLUTION');
});

test('keeps a selected zero-result value visible and hides an unselected one', () => {
  const fixture = inputs();
  const sectors = optionSet({
    catalogue: fixture.catalogue,
    context: fixture.context,
    fieldKey: 'sector',
    values: [
      { canonicalValue: 'BIOPHARMA', label: 'Biopharma', count: 8 },
      { canonicalValue: 'TECHNOLOGY', label: 'Technology', count: 0 },
      { canonicalValue: 'HEALTHCARE', label: 'Healthcare', count: 0 },
    ],
  });
  const technology = findOption(sectors, 'Technology');
  const view = listProcessFilterValueOptions({
    option_set: sectors,
    selected_option_ids: [technology.option_id],
    product_field_catalogue: fixture.catalogue,
    query_context: fixture.context,
  });
  assert.deepEqual(view.options.map((option) => option.display_label), [
    'Biopharma',
    'Technology',
  ]);
  assert.deepEqual(view.options[1], {
    option_id: technology.option_id,
    display_label: 'Technology',
    occurrence_count: 0,
    selected: true,
    active_choice: false,
  });
});

test('binds target counsel to the target assignment field and exact scope', () => {
  const fixture = inputs();
  const firms = optionSet({
    catalogue: fixture.catalogue,
    context: fixture.context,
    fieldKey: 'law_firm_target',
    values: [
      {
        canonicalValue: digest('WACHTELL_ENTITY'),
        label: 'Wachtell',
        count: 4,
      },
    ],
  });
  const compilation = compileProcessFilters({
    product_field_catalogue: fixture.catalogue,
    presentation_registry: fixture.registry,
    registry_admission: fixture.admission,
    query_context: fixture.context,
    filter_requests: [
      optionRequest(
        'law_firm_target',
        'includes any',
        [findOption(firms, 'Wachtell').option_id],
      ),
    ],
    value_option_sets: [firms],
  });
  assert.equal(
    compilation.clauses[0].field_scope,
    'SAME_PROFESSIONAL_ASSIGNMENT_COMPONENT',
  );
  assert.equal(compilation.clauses[0].role_label, 'Target');
  assert.equal(
    compilation.active_filter_sentence.text,
    'Exclusivity granted, Target counsel includes any Wachtell.',
  );
});

test('refuses participant and role filters until Query IR carries a composite scope', () => {
  const fixture = inputs();
  const participants = optionSet({
    catalogue: fixture.catalogue,
    context: fixture.context,
    fieldKey: 'process_participant',
    values: [{
      canonicalValue: digest('PARTICIPANT_PFIZER'),
      label: 'Pfizer',
      count: 2,
    }],
  });
  assert.throws(
    () => compileProcessFilters({
      product_field_catalogue: fixture.catalogue,
      presentation_registry: fixture.registry,
      registry_admission: fixture.admission,
      query_context: fixture.context,
      filter_requests: [
        optionRequest(
          'process_participant',
          'includes any',
          [participants.options[0].option_id],
        ),
      ],
      value_option_sets: [participants],
    }),
    (error) => error.code === 'COMPOSITE_FILTER_CONTRACT_REQUIRED',
  );
});

test('compiles reverse merger, RMT, and share purchase through one structure field', () => {
  const fixture = inputs();
  const structures = optionSet({
    catalogue: fixture.catalogue,
    context: fixture.context,
    fieldKey: 'structure',
    values: [
      {
        canonicalValue: 'REVERSE_MERGER',
        label: 'Reverse merger',
        count: 3,
      },
      {
        canonicalValue: 'REVERSE_MORRIS_TRUST',
        label: 'Reverse Morris Trust',
        count: 2,
      },
      {
        canonicalValue: 'SHARE_PURCHASE',
        label: 'Share purchase',
        count: 5,
      },
    ],
  });
  const compilation = compileProcessFilters({
    product_field_catalogue: fixture.catalogue,
    presentation_registry: fixture.registry,
    registry_admission: fixture.admission,
    query_context: fixture.context,
    filter_requests: [
      optionRequest(
        'structure',
        'includes any',
        structures.options.map((option) => option.option_id),
      ),
    ],
    value_option_sets: [structures],
  });
  assert.deepEqual(processFilterQueryClauses(compilation)[0].value, [
    'REVERSE_MERGER',
    'REVERSE_MORRIS_TRUST',
    'SHARE_PURCHASE',
  ]);
  assert.throws(
    () => compileProcessFilters({
      product_field_catalogue: fixture.catalogue,
      presentation_registry: fixture.registry,
      registry_admission: fixture.admission,
      query_context: fixture.context,
      filter_requests: [
        literalRequest('structure', 'includes any', [{
          canonicalValue: 'MERGER',
          label: 'Merger',
        }]),
      ],
      value_option_sets: [],
    }),
    (error) => error.code === 'INVALID_PROCESS_FILTER_REQUEST',
  );
});

test('enforces non-vacuous ALL and the field completeness contract', () => {
  const fixture = inputs();
  const firms = optionSet({
    catalogue: fixture.catalogue,
    context: fixture.context,
    fieldKey: 'law_firm_target',
    values: [{
      canonicalValue: digest('WACHTELL_ENTITY'),
      label: 'Wachtell',
      count: 4,
    }],
  });
  const empty = optionRequest('law_firm_target', 'includes all', []);
  assert.throws(
    () => compileProcessFilters({
      product_field_catalogue: fixture.catalogue,
      presentation_registry: fixture.registry,
      registry_admission: fixture.admission,
      query_context: fixture.context,
      filter_requests: [empty],
      value_option_sets: [firms],
    }),
    (error) => error.code === 'INVALID_PROCESS_FILTER_REQUEST',
  );

  const incomplete = inputs();
  incomplete.catalogue.field_definitions.find(
    (catalogueField) => catalogueField.field_key === 'law_firm_target',
  ).completeness_semantics = 'UNKNOWN_IF_COLLECTION_INCOMPLETE';
  assert.throws(
    () => compileProcessFilters({
      product_field_catalogue: incomplete.catalogue,
      presentation_registry: incomplete.registry,
      registry_admission: incomplete.admission,
      query_context: incomplete.context,
      filter_requests: [
        optionRequest(
          'law_firm_target',
          'includes all',
          [firms.options[0].option_id],
        ),
      ],
      value_option_sets: [firms],
    }),
    (error) => [
      'INVALID_PROCESS_FILTER_VALUE_OPTION_SET',
      'INVALID_PROCESS_FILTER_REQUEST',
    ].includes(error.code),
  );
});

test('rejects a changed self-rehashed registry without a new admission', () => {
  const fixture = inputs();
  fixture.registry.field_presentations.find(
    (presentation) => presentation.field_key === 'sector',
  ).sentence_label = 'Industry';
  fixture.registry.canonical_payload_digest =
    presentationRegistryPayloadDigest(fixture.registry);
  assert.throws(
    () => listProcessFilterFields({
      product_field_catalogue: fixture.catalogue,
      presentation_registry: fixture.registry,
      registry_admission: fixture.admission,
      query_context: fixture.context,
      search_text: '',
    }),
    (error) => error.code
      === 'INVALID_PROCESS_FILTER_PRESENTATION_REGISTRY_ADMISSION',
  );
});

test('rejects silent field disposition loss and unadmitted operator labels', () => {
  const missing = inputs();
  missing.registry.field_exclusions = [];
  missing.registry.canonical_payload_digest =
    presentationRegistryPayloadDigest(missing.registry);
  missing.admission = registryAdmission(missing.registry, missing.catalogue);
  assert.throws(
    () => listProcessFilterFields({
      product_field_catalogue: missing.catalogue,
      presentation_registry: missing.registry,
      registry_admission: missing.admission,
      query_context: missing.context,
      search_text: '',
    }),
    (error) => error.code
      === 'INVALID_PROCESS_FILTER_PRESENTATION_REGISTRY',
  );

  const fixture = inputs();
  const sectors = optionSet({
    catalogue: fixture.catalogue,
    context: fixture.context,
    fieldKey: 'sector',
    values: [{
      canonicalValue: 'BIOPHARMA',
      label: 'Biopharma',
      count: 12,
    }],
  });
  assert.throws(
    () => compileProcessFilters({
      product_field_catalogue: fixture.catalogue,
      presentation_registry: fixture.registry,
      registry_admission: fixture.admission,
      query_context: fixture.context,
      filter_requests: [
        optionRequest(
          'sector',
          'approximately',
          [sectors.options[0].option_id],
        ),
      ],
      value_option_sets: [sectors],
    }),
    (error) => error.code === 'INVALID_PROCESS_FILTER_REQUEST',
  );
});

test('adds a future CVR field without compiler code change', () => {
  const fixture = inputs({ includeCvr: true });
  const options = optionSet({
    catalogue: fixture.catalogue,
    context: fixture.context,
    fieldKey: 'cvr_milestone_type',
    values: [{
      canonicalValue: 'REGULATORY_APPROVAL',
      label: 'Regulatory approval',
      count: 7,
    }],
  });
  const search = listProcessFilterFields({
    product_field_catalogue: fixture.catalogue,
    presentation_registry: fixture.registry,
    registry_admission: fixture.admission,
    query_context: fixture.context,
    search_text: 'CVR milestone',
  });
  assert.deepEqual(
    search.available_fields.map((entry) => entry.field_key),
    ['cvr_milestone_type'],
  );
  const compilation = compileProcessFilters({
    product_field_catalogue: fixture.catalogue,
    presentation_registry: fixture.registry,
    registry_admission: fixture.admission,
    query_context: fixture.context,
    filter_requests: [
      optionRequest(
        'cvr_milestone_type',
        'is',
        [options.options[0].option_id],
      ),
    ],
    value_option_sets: [options],
  });
  assert.equal(
    compilation.active_filter_sentence.text,
    'Regulatory milestone, CVR milestone type is Regulatory approval.',
  );
});

test('rejects a correctly rehashed sentence forgery', () => {
  const fixture = inputs();
  const compilation = clone(compileProcessFilters({
    product_field_catalogue: fixture.catalogue,
    presentation_registry: fixture.registry,
    registry_admission: fixture.admission,
    query_context: fixture.context,
    filter_requests: [
      literalRequest('signed', 'after', [{
        canonicalValue: '2020-01-01',
        label: '2020',
      }]),
    ],
    value_option_sets: [],
  }));
  compilation.active_filter_sentence.text = 'A different sentence.';
  delete compilation.compilation_id;
  compilation.compilation_id = contentId(
    PROCESS_FILTER_COMPILATION_SCHEMA,
    compilation,
  );
  assert.throws(
    () => validateProcessFilterCompilation(compilation),
    (error) => error.code === 'INVALID_PROCESS_FILTER_COMPILATION',
  );
});

test('the compiler has no data query, network, write, UI, or activation path', () => {
  const source = fs.readFileSync(
    path.join(
      __dirname,
      '../lib/canonical-v2/process-filter-compiler.js',
    ),
    'utf8',
  );
  assert.doesNotMatch(
    source,
    /\b(?:fetch|writeFile|supabase|process\.env|activateRelease|serveResult)\b/,
  );
  const fixture = inputs({ entryMode: 'ASK' });
  assert.equal(
    canonicalJson(listProcessFilterFields({
      product_field_catalogue: fixture.catalogue,
      presentation_registry: fixture.registry,
      registry_admission: fixture.admission,
      query_context: fixture.context,
      search_text: '',
    })),
    canonicalJson(listProcessFilterFields({
      product_field_catalogue: fixture.catalogue,
      presentation_registry: fixture.registry,
      registry_admission: fixture.admission,
      query_context: fixture.context,
      search_text: '',
    })),
  );
});
