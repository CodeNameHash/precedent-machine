const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  canonicalJson,
  sha256Hex,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  PROCESS_QUERY_ADMISSION_CONTEXT_SCHEMA,
  canonicalProcessQueryIrBytes,
  compileProcessQueryIr,
} = require('../lib/canonical-v2/process-query-ir');
const {
  compileProcessAskQuery,
  normalizeProcessAskPhrase,
  processAskMappingRegistryPayloadDigest,
} = require('../lib/canonical-v2/process-ask-compiler');
const {
  compileProcessBrowseQuery,
  listProcessBrowseOptions,
  processBrowseNavigationPayloadDigest,
} = require('../lib/canonical-v2/process-browse-compiler');

const ROOT = path.join(
  __dirname,
  '../contracts/canonical-v2/successor',
);
const RESULT_DEFINITION = Object.freeze({
  stable_id: 'PROCESS_PHRASEBOOK_PASSAGE_RESULT',
  version: 1,
});
const EVIDENCE_REQUIREMENT_IDS = Object.freeze([
  'EXACT_PASSAGE',
  'EXACT_SOURCE_CITATION',
]);

function loadDefinition(relativePath) {
  return JSON.parse(
    fs.readFileSync(path.join(ROOT, relativePath), 'utf8'),
  ).definition;
}

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

function sharedSectorField() {
  return {
    field_key: 'sector',
    field_version: 1,
    permitted_result_definitions: [RESULT_DEFINITION.stable_id],
    filter_scope: 'SAME_DEAL',
    multiplicity: 'ZERO_OR_ONE',
    capabilities: {
      display: true,
      filter: true,
      sort: true,
    },
    permitted_operators: ['EQ', 'IN'],
    completeness_semantics: 'UNKNOWN_IF_NOT_ADMITTED',
  };
}

function navigationDefinition() {
  return loadDefinition(
    'process/navigation/process-navigation-definition-catalogue.v2.json',
  );
}

function admission() {
  const processFields = loadDefinition(
    'process/fields/process-field-definition-catalogue.v1.json',
  ).field_definitions;
  const navigation = navigationDefinition();
  const predicateAdmission = (predicateKey) => ({
    domain_key: 'PROCESS',
    predicate_key: predicateKey,
    predicate_version: 1,
    admission_id: digest(`admission:${predicateKey}`),
    result_definitions: [clone(RESULT_DEFINITION)],
    evidence_requirement_ids: [...EVIDENCE_REQUIREMENT_IDS],
  });
  return {
    schema_version: PROCESS_QUERY_ADMISSION_CONTEXT_SCHEMA,
    approved_pm_data_version_id: digest('pm-data-version'),
    candidate_release_manifest_id: digest('candidate-release-manifest'),
    candidate_release_manifest_payload_digest: digest(
      'candidate-release-manifest-payload',
    ),
    canonical_contract_identity: {
      stable_id: 'CANONICAL_CONTRACT_BUNDLE',
      version: 1,
      payload_digest: digest('canonical-contract-bundle'),
    },
    product_field_catalogue: {
      stable_id: 'PRODUCT_FIELD_CATALOGUE',
      manifest_id: digest('product-field-catalogue-manifest'),
      payload_digest: digest('product-field-catalogue-payload'),
      field_definitions: [
        sharedSectorField(),
        ...processFields,
      ],
    },
    navigation_catalogue: {
      stable_id: 'PRODUCT_NAVIGATION_CATALOGUE',
      catalogue_id: digest('product-navigation-catalogue'),
      payload_digest: processBrowseNavigationPayloadDigest(navigation),
    },
    predicate_admissions: [
      predicateAdmission('EXCLUSIVITY_EXPRESS_REFUSAL'),
      predicateAdmission('EXCLUSIVITY_GRANTED'),
    ],
    exact_detail_actions: [
      'PARENT_BOUND_PARAGRAPH_CONTEXT',
      'RELATED_PASSAGE_CHILD_COLLECTION',
    ],
    coverage_identities: [
      digest('process-coverage'),
    ],
    route_budget: {
      maximum_page_size: 50,
    },
  };
}

function queryTemplate() {
  return {
    result_definition: clone(RESULT_DEFINITION),
    evidence_requirement_ids: [...EVIDENCE_REQUIREMENT_IDS],
    cohort: {
      cohort_definition_id: digest('cohort-definition'),
      cohort_definition_payload_digest: digest('cohort-definition-payload'),
    },
    filters: [
      {
        field_key: 'sector',
        field_version: 1,
        operator: 'IN',
        value: ['Biopharma'],
      },
      {
        field_key: 'process_phase',
        field_version: 1,
        operator: 'EQ',
        value: 'PRE_SIGNING',
      },
    ],
    sort: [
      {
        field_key: 'process_event_time',
        field_version: 1,
        direction: 'DESC',
      },
      {
        field_key: 'sector',
        field_version: 1,
        direction: 'ASC',
      },
    ],
    diversity: {
      definition_id: digest('diversity-definition'),
      payload_digest: digest('diversity-definition-payload'),
    },
    requested_columns: [
      {
        field_key: 'sector',
        field_version: 1,
      },
      {
        field_key: 'actual_drafting',
        field_version: 1,
      },
      {
        field_key: 'process_event_type',
        field_version: 1,
      },
    ],
    pagination: {
      page_size: 25,
      cursor: null,
    },
    detail_actions: [
      'RELATED_PASSAGE_CHILD_COLLECTION',
      'PARENT_BOUND_PARAGRAPH_CONTEXT',
    ],
    coverage: {
      coverage_identity: digest('process-coverage'),
      coverage_payload_digest: digest('process-coverage-payload'),
      covered_set_identity: digest('covered-set'),
      exclusions_identity: digest('exclusions'),
    },
  };
}

function fullQuery(predicateKey = 'EXCLUSIVITY_GRANTED') {
  return {
    domain_key: 'PROCESS',
    predicate_key: predicateKey,
    predicate_version: 1,
    ...queryTemplate(),
  };
}

function concept(predicateKey, label) {
  return {
    predicate_key: predicateKey,
    predicate_version: 1,
    label,
  };
}

function compiledMapping({
  mappingKey,
  phrase,
  phraseClass,
  predicateKey = 'EXCLUSIVITY_GRANTED',
  conceptLabel = 'Granted',
}) {
  return {
    mapping_key: mappingKey,
    phrase,
    normalized_phrase: normalizeProcessAskPhrase(phrase),
    phrase_class: phraseClass,
    outcome: 'COMPILED',
    predicate_key: predicateKey,
    predicate_version: 1,
    concept_label: conceptLabel,
    choices: [],
    nearest_supported_concepts: [],
  };
}

function askMappingRegistry(queryAdmission) {
  const granted = concept('EXCLUSIVITY_GRANTED', 'Granted');
  const refusal = concept('EXCLUSIVITY_EXPRESS_REFUSAL', 'Expressly refused');
  const entries = [
    compiledMapping({
      mappingKey: 'ask-001',
      phrase: 'show me where targets granted exclusivity',
      phraseClass: 'PRACTITIONER_PHRASE',
    }),
    compiledMapping({
      mappingKey: 'ask-002',
      phrase: 'show exclusive-dealing drafting',
      phraseClass: 'DRAFTING_SYNONYM',
    }),
    compiledMapping({
      mappingKey: 'ask-003',
      phrase: 'show excl grants',
      phraseClass: 'ABBREVIATION',
    }),
    compiledMapping({
      mappingKey: 'ask-004',
      phrase: 'show exclusivty grants',
      phraseClass: 'ORDINARY_MISSPELLING',
    }),
    {
      mapping_key: 'ask-005',
      phrase: 'show confidentiality agreements',
      normalized_phrase: 'show confidentiality agreements',
      phrase_class: 'LEGALLY_ADJACENT_NEGATIVE',
      outcome: 'TYPED_UNSUPPORTED',
      predicate_key: null,
      predicate_version: null,
      concept_label: null,
      choices: [],
      nearest_supported_concepts: [granted],
    },
    {
      mapping_key: 'ask-006',
      phrase: 'show rejected exclusivity',
      normalized_phrase: 'show rejected exclusivity',
      phrase_class: 'AMBIGUOUS_LEGAL_PHRASE',
      outcome: 'AMBIGUOUS_REQUIRES_LEGAL_CHOICE',
      predicate_key: null,
      predicate_version: null,
      concept_label: null,
      choices: [refusal, granted],
      nearest_supported_concepts: [],
    },
    {
      mapping_key: 'ask-007',
      phrase: 'show reverse termination fees',
      normalized_phrase: 'show reverse termination fees',
      phrase_class: 'UNSUPPORTED_PHRASE',
      outcome: 'TYPED_UNSUPPORTED',
      predicate_key: null,
      predicate_version: null,
      concept_label: null,
      choices: [],
      nearest_supported_concepts: [refusal],
    },
  ];
  const registry = {
    schema_version: 'PROCESS_ASK_MAPPING_REGISTRY/V1',
    stable_id: 'PROCESS_EXCLUSIVITY_ASK_MAPPING_REGISTRY',
    registry_version: 1,
    approved_pm_data_version_id:
      queryAdmission.approved_pm_data_version_id,
    predicate_catalogue_stable_id:
      'PROCESS_EXCLUSIVITY_PREDICATE_CATALOGUE',
    certification: {
      independent_enumeration_id: digest('independent-enumeration'),
      mapping_reconciliation_id: digest('mapping-reconciliation'),
      query_goldens_id: digest('query-goldens'),
      utterance_suite_id: digest('utterance-suite'),
    },
    entries,
    canonical_payload_digest: null,
  };
  registry.canonical_payload_digest =
    processAskMappingRegistryPayloadDigest(registry);
  return registry;
}

function askMappingRegistryAdmission(registry) {
  return {
    stable_id: registry.stable_id,
    registry_version: registry.registry_version,
    approved_pm_data_version_id: registry.approved_pm_data_version_id,
    predicate_catalogue_stable_id:
      registry.predicate_catalogue_stable_id,
    certification: clone(registry.certification),
    canonical_payload_digest: registry.canonical_payload_digest,
  };
}

test('compiles one deterministic and immutable Query IR', () => {
  const firstQuery = fullQuery();
  const secondQuery = clone(firstQuery);
  secondQuery.filters.reverse();

  const first = compileProcessQueryIr({
    admission: admission(),
    query: firstQuery,
  });
  const second = compileProcessQueryIr({
    admission: admission(),
    query: secondQuery,
  });

  assert.equal(first.query_definition_id, second.query_definition_id);
  assert.equal(
    canonicalProcessQueryIrBytes(first).toString('utf8'),
    canonicalProcessQueryIrBytes(second).toString('utf8'),
  );
  assert.equal(
    first.filter_contract.clauses.find(
      (filter) => filter.field_key === 'sector',
    ).field_scope,
    'SAME_DEAL',
  );
  assertDeepFrozen(first);

  const changed = clone(first);
  changed.semantic_contract.predicate_key =
    'EXCLUSIVITY_EXPRESS_REFUSAL';
  assert.throws(
    () => canonicalProcessQueryIrBytes(changed),
    (error) => error.code === 'INVALID_PROCESS_QUERY_IR',
  );
});

test('uses the one PM-wide field catalogue for shared and Process fields', () => {
  const queryIr = compileProcessQueryIr({
    admission: admission(),
    query: fullQuery(),
  });
  assert.deepEqual(
    queryIr.presentation_contract.requested_columns.map(
      (column) => column.field_key,
    ),
    ['sector', 'actual_drafting', 'process_event_type'],
  );
  assert.deepEqual(
    queryIr.filter_contract.clauses.map((filter) => filter.field_key).sort(),
    ['process_phase', 'sector'],
  );
});

test('fails closed for an unadmitted field, capability and operator', () => {
  const cases = [
    {
      code: 'FIELD_NOT_ADMITTED',
      mutate(query) {
        query.filters[0].field_key = 'raw_storage_column';
      },
    },
    {
      code: 'FIELD_CAPABILITY_NOT_ADMITTED',
      mutate(query) {
        query.filters[0].field_key = 'actual_drafting';
      },
    },
    {
      code: 'OPERATOR_NOT_ADMITTED',
      mutate(query) {
        query.filters[0].operator = 'ALL';
      },
    },
  ];
  for (const entry of cases) {
    const query = fullQuery();
    entry.mutate(query);
    assert.throws(
      () => compileProcessQueryIr({
        admission: admission(),
        query,
      }),
      (error) => error.code === entry.code,
    );
  }
});

test('fails closed for false ALL, release evidence, coverage and route budget', () => {
  const allQuery = fullQuery();
  allQuery.filters = [{
    field_key: 'process_outcome',
    field_version: 1,
    operator: 'ALL',
    value: [],
  }];
  assert.throws(
    () => compileProcessQueryIr({
      admission: admission(),
      query: allQuery,
    }),
    (error) => error.code === 'INVALID_FILTER_VALUE',
  );

  const evidenceQuery = fullQuery();
  evidenceQuery.evidence_requirement_ids = ['EXACT_PASSAGE'];
  assert.throws(
    () => compileProcessQueryIr({
      admission: admission(),
      query: evidenceQuery,
    }),
    (error) => error.code === 'EVIDENCE_REQUIREMENTS_NOT_ADMITTED',
  );

  const coverageQuery = fullQuery();
  coverageQuery.coverage.coverage_identity = digest('wrong-coverage');
  assert.throws(
    () => compileProcessQueryIr({
      admission: admission(),
      query: coverageQuery,
    }),
    (error) => error.code === 'COVERAGE_NOT_ADMITTED',
  );

  const largeQuery = fullQuery();
  largeQuery.pagination.page_size = 51;
  assert.throws(
    () => compileProcessQueryIr({
      admission: admission(),
      query: largeQuery,
    }),
    (error) => error.code === 'QUERY_BUDGET_EXCEEDED',
  );
});

test('does not compile an unadmitted predicate or a second domain', () => {
  assert.throws(
    () => compileProcessQueryIr({
      admission: admission(),
      query: fullQuery('EXCLUSIVITY_REQUESTED'),
    }),
    (error) => error.code === 'PREDICATE_NOT_ADMITTED',
  );
  const query = fullQuery();
  query.domain_key = 'TERMS';
  assert.throws(
    () => compileProcessQueryIr({
      admission: admission(),
      query,
    }),
    (error) => error.code === 'TYPED_UNSUPPORTED',
  );
});

test('Ask compiles checked phrases and an expressly checked misspelling', () => {
  const queryAdmission = admission();
  const registry = askMappingRegistry(queryAdmission);
  for (const question of [
    'Show me where targets granted exclusivity?',
    'show exclusivty grants',
  ]) {
    const result = compileProcessAskQuery({
      question,
      mapping_registry: registry,
      mapping_registry_admission: askMappingRegistryAdmission(registry),
      admission: queryAdmission,
      query_template: queryTemplate(),
    });
    assert.equal(result.outcome, 'COMPILED');
    assert.equal(
      result.query_ir.semantic_contract.predicate_key,
      'EXCLUSIVITY_GRANTED',
    );
  }
});

test('Ask returns no query for unknown, unsupported or ambiguous text', () => {
  const queryAdmission = admission();
  const registry = askMappingRegistry(queryAdmission);
  const cases = [
    ['show me something new', 'TYPED_UNSUPPORTED', 0],
    ['show confidentiality agreements', 'TYPED_UNSUPPORTED', 1],
    ['show rejected exclusivity', 'AMBIGUOUS_REQUIRES_LEGAL_CHOICE', 2],
  ];
  for (const [question, outcome, conceptCount] of cases) {
    const result = compileProcessAskQuery({
      question,
      mapping_registry: registry,
      mapping_registry_admission: askMappingRegistryAdmission(registry),
      admission: queryAdmission,
      query_template: queryTemplate(),
    });
    assert.equal(result.outcome, outcome);
    assert.equal(result.query_ir, null);
    const concepts = result.choices || result.nearest_supported_concepts;
    assert.equal(concepts.length, conceptCount);
  }
});

test('Ask rejects a changed mapping registry and over-size input', () => {
  const queryAdmission = admission();
  const changedRegistry = askMappingRegistry(queryAdmission);
  const checkedAdmission = askMappingRegistryAdmission(changedRegistry);
  changedRegistry.entries[0].concept_label = 'Changed after certification';
  changedRegistry.canonical_payload_digest =
    processAskMappingRegistryPayloadDigest(changedRegistry);
  assert.throws(
    () => compileProcessAskQuery({
      question: changedRegistry.entries[0].phrase,
      mapping_registry: changedRegistry,
      mapping_registry_admission: checkedAdmission,
      admission: queryAdmission,
      query_template: queryTemplate(),
    }),
    (error) => error.code === 'INVALID_PROCESS_ASK_MAPPING_REGISTRY',
  );
  const validRegistry = askMappingRegistry(queryAdmission);
  assert.throws(
    () => compileProcessAskQuery({
      question: validRegistry.entries[0].phrase,
      mapping_registry: validRegistry,
      admission: queryAdmission,
      query_template: queryTemplate(),
    }),
    (error) => (
      error.code === 'INVALID_PROCESS_ASK_MAPPING_REGISTRY_ADMISSION'
    ),
  );
  assert.throws(
    () => compileProcessAskQuery({
      question: 'x'.repeat(2049),
      mapping_registry: askMappingRegistry(queryAdmission),
      mapping_registry_admission: askMappingRegistryAdmission(
        askMappingRegistry(queryAdmission),
      ),
      admission: queryAdmission,
      query_template: queryTemplate(),
    }),
    (error) => error.code === 'PROCESS_ASK_TOO_LARGE',
  );
});

test('Browse exposes the dynamic Domain, Topic and admitted Pattern levels', () => {
  const queryAdmission = admission();
  const navigation = navigationDefinition();
  const domains = listProcessBrowseOptions({
    navigation_definition: navigation,
    admission: queryAdmission,
    selection: null,
  });
  const topics = listProcessBrowseOptions({
    navigation_definition: navigation,
    admission: queryAdmission,
    selection: {
      domain_key: 'PROCESS',
      topic_key: null,
    },
  });
  const patterns = listProcessBrowseOptions({
    navigation_definition: navigation,
    admission: queryAdmission,
    selection: {
      domain_key: 'PROCESS',
      topic_key: 'EXCLUSIVITY',
    },
  });

  assert.equal(domains.next_level, 'DOMAIN');
  assert.deepEqual(domains.options, [{ key: 'PROCESS', label: 'Process' }]);
  assert.equal(topics.next_level, 'TOPIC');
  assert.deepEqual(
    topics.options,
    [{ key: 'EXCLUSIVITY', label: 'Exclusivity' }],
  );
  assert.equal(patterns.next_level, 'PATTERN');
  assert.deepEqual(
    patterns.options.map((pattern) => pattern.key),
    ['EXCLUSIVITY_EXPRESS_REFUSAL', 'EXCLUSIVITY_GRANTED'],
  );
  assert.equal(patterns.query_ir, null);
});

test('compiles all 41 admitted exclusivity Browse Patterns through one runtime', () => {
  const navigation = navigationDefinition();
  const patterns = navigation.domains[0].topics[0].patterns;
  const queryAdmission = admission();
  const seedAdmission = queryAdmission.predicate_admissions[0];
  queryAdmission.predicate_admissions = patterns.map((pattern) => ({
    ...clone(seedAdmission),
    predicate_key: pattern.predicate_key,
    predicate_version: pattern.predicate_version,
    admission_id: digest(`admission:${pattern.predicate_key}`),
  }));

  const listed = listProcessBrowseOptions({
    navigation_definition: navigation,
    admission: queryAdmission,
    selection: {
      domain_key: 'PROCESS',
      topic_key: 'EXCLUSIVITY',
    },
  });
  assert.equal(listed.options.length, 41);

  for (const pattern of patterns) {
    const compiled = compileProcessBrowseQuery({
      selection: {
        domain_key: 'PROCESS',
        topic_key: 'EXCLUSIVITY',
        pattern_key: pattern.pattern_key,
      },
      navigation_definition: navigation,
      admission: queryAdmission,
      query_template: queryTemplate(),
    });
    assert.equal(compiled.outcome, 'COMPILED');
    assert.equal(
      compiled.query_ir.semantic_contract.predicate_key,
      pattern.predicate_key,
    );
  }
});

test('Browse All and stale selections never compile a union or display label', () => {
  const queryAdmission = admission();
  const navigation = navigationDefinition();
  const all = compileProcessBrowseQuery({
    selection: {
      domain_key: 'ALL',
      topic_key: 'IGNORED',
      pattern_key: 'IGNORED',
    },
    navigation_definition: navigation,
    admission: queryAdmission,
    query_template: queryTemplate(),
  });
  assert.equal(all.outcome, 'CATALOGUE_NAVIGATION');
  assert.equal(all.query_ir, null);

  const stale = compileProcessBrowseQuery({
    selection: {
      domain_key: 'PROCESS',
      topic_key: 'EXCLUSIVITY',
      pattern_key: 'EXCLUSIVITY_REQUESTED',
    },
    navigation_definition: navigation,
    admission: queryAdmission,
    query_template: queryTemplate(),
  });
  assert.equal(stale.outcome, 'TYPED_UNSUPPORTED');
  assert.equal(stale.query_ir, null);

  assert.throws(
    () => listProcessBrowseOptions({
      navigation_definition: navigation,
      admission: queryAdmission,
      selection: {
        domain_key: null,
        topic_key: 'EXCLUSIVITY',
      },
    }),
    (error) => error.code === 'INVALID_PROCESS_BROWSE_INPUT',
  );
});

test('Ask and Browse emit byte-equivalent Query IR for the same legal meaning', () => {
  const queryAdmission = admission();
  const template = queryTemplate();
  const registry = askMappingRegistry(queryAdmission);
  const ask = compileProcessAskQuery({
    question: 'show me where targets granted exclusivity',
    mapping_registry: registry,
    mapping_registry_admission: askMappingRegistryAdmission(registry),
    admission: queryAdmission,
    query_template: template,
  });
  const browse = compileProcessBrowseQuery({
    selection: {
      domain_key: 'PROCESS',
      topic_key: 'EXCLUSIVITY',
      pattern_key: 'EXCLUSIVITY_GRANTED',
    },
    navigation_definition: navigationDefinition(),
    admission: queryAdmission,
    query_template: template,
  });

  assert.equal(ask.outcome, 'COMPILED');
  assert.equal(browse.outcome, 'COMPILED');
  assert.equal(
    ask.query_ir.query_definition_id,
    browse.query_ir.query_definition_id,
  );
  assert.equal(
    canonicalJson(ask.query_ir),
    canonicalJson(browse.query_ir),
  );
  assert.equal(
    canonicalJson(ask.query_ir).includes('show me where targets'),
    false,
  );
  assert.equal(canonicalJson(browse.query_ir).includes('Granted'), false);
});

test('Browse rejects a navigation definition that differs from its release', () => {
  const queryAdmission = admission();
  const navigation = navigationDefinition();
  navigation.domains[0].label = 'Changed after release admission';
  assert.throws(
    () => listProcessBrowseOptions({
      navigation_definition: navigation,
      admission: queryAdmission,
      selection: null,
    }),
    (error) => error.code === 'INVALID_PROCESS_NAVIGATION_CATALOGUE',
  );
});
