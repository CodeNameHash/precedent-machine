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
  compileProductAskQuery,
} = require('../lib/canonical-v2/product-ask-compiler');
const {
  compileProductBrowseQuery,
  listProductBrowseOptions,
} = require('../lib/canonical-v2/product-browse-compiler');
const {
  PRODUCT_ASK_MAPPING_REGISTRY_MANIFEST_SCHEMA,
  normalizeProductAskPhrase,
  productAskMappingRegistryPayloadDigest,
} = require('../lib/canonical-v2/product-ask-mapping-registry');
const {
  PRODUCT_QUERY_ADMISSION_CONTEXT_SCHEMA,
  PRODUCT_QUERY_IR_SCHEMA,
  canonicalProductQueryIrBytes,
} = require('../lib/canonical-v2/product-query-ir');

const AGREEMENT_RESULT = Object.freeze({
  stable_id: 'AGREEMENT_PHRASEBOOK_PASSAGE_RESULT',
  version: 1,
});
const PROCESS_RESULT = Object.freeze({
  stable_id: 'PROCESS_PHRASEBOOK_PASSAGE_RESULT',
  version: 1,
});
const CVR_RESULT = Object.freeze({
  stable_id: 'CVR_MILESTONE_PASSAGE_RESULT',
  version: 1,
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function digest(label) {
  return sha256Hex(Buffer.from(label, 'utf8'));
}

function identity(label) {
  return {
    stable_id: label,
    version: 1,
    payload_digest: digest(label),
  };
}

function pattern(patternKey, label, predicateKey = patternKey) {
  return {
    pattern_key: patternKey,
    label,
    predicate_key: predicateKey,
    predicate_version: 1,
    predicate_shape: 'ATOMIC',
  };
}

function navigationDefinition({ includeCvr = false } = {}) {
  const domains = [
    {
      domain_key: 'AGREEMENT',
      label: 'Agreement',
      domain_registry_stable_id: 'AGREEMENT',
      topics: [{
        topic_key: 'DEAL_PROTECTIONS',
        label: 'Deal protections',
        predicate_catalogue_stable_id:
          'AGREEMENT_DEAL_PROTECTION_PREDICATE_CATALOGUE',
        patterns: [
          pattern('NO_SHOP', 'No-shop'),
        ],
      }],
    },
    {
      domain_key: 'PROCESS',
      label: 'Process',
      domain_registry_stable_id: 'PROCESS',
      topics: [{
        topic_key: 'EXCLUSIVITY',
        label: 'Exclusivity',
        predicate_catalogue_stable_id:
          'PROCESS_EXCLUSIVITY_PREDICATE_CATALOGUE',
        patterns: [
          pattern('EXCLUSIVITY_GRANTED', 'Exclusivity granted'),
        ],
      }],
    },
  ];
  if (includeCvr) {
    domains.splice(1, 0, {
      domain_key: 'CVR',
      label: 'CVR',
      domain_registry_stable_id: 'CVR',
      topics: [{
        topic_key: 'MILESTONES',
        label: 'Milestones',
        predicate_catalogue_stable_id:
          'CVR_MILESTONE_PREDICATE_CATALOGUE',
        patterns: [
          pattern('REGULATORY_MILESTONE', 'Regulatory milestone'),
        ],
      }],
    });
  }
  return {
    pm_wide_catalogue_binding: {
      combined_catalogue_stable_id: 'PRODUCT_NAVIGATION_CATALOGUE',
    },
    hierarchy_contract: {
      levels: ['DOMAIN', 'TOPIC', 'PATTERN'],
      maximum_depth: 3,
      display_only_entry_permitted: false,
      all_is_catalogue_navigation_not_union_query: true,
    },
    domains,
    admission_contract: {
      domain_topic_and_pattern_compile_to_one_query_ir: true,
    },
  };
}

function field({ key, result, domain }) {
  return {
    field_key: key,
    field_version: 1,
    permitted_result_definitions: [result.stable_id],
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

function predicateAdmission({ domain, predicate, result, evidence }) {
  return {
    domain_key: domain,
    predicate_key: predicate,
    predicate_version: 1,
    admission_id: digest(`predicate:${domain}:${predicate}`),
    result_definitions: [clone(result)],
    evidence_requirement_ids: [...evidence],
  };
}

function queryAdmission(navigation, { includeCvr = false } = {}) {
  const fields = [
    field({
      key: 'agreement_term',
      result: AGREEMENT_RESULT,
      domain: 'AGREEMENT',
    }),
    field({
      key: 'process_phase',
      result: PROCESS_RESULT,
      domain: 'PROCESS',
    }),
  ];
  const predicates = [
    predicateAdmission({
      domain: 'AGREEMENT',
      predicate: 'NO_SHOP',
      result: AGREEMENT_RESULT,
      evidence: ['EXACT_PASSAGE', 'EXACT_SOURCE_CITATION'],
    }),
    predicateAdmission({
      domain: 'PROCESS',
      predicate: 'EXCLUSIVITY_GRANTED',
      result: PROCESS_RESULT,
      evidence: ['EXACT_PASSAGE', 'EXACT_SOURCE_CITATION'],
    }),
  ];
  if (includeCvr) {
    fields.splice(1, 0, field({
      key: 'cvr_milestone_status',
      result: CVR_RESULT,
      domain: 'CVR',
    }));
    predicates.splice(1, 0, predicateAdmission({
      domain: 'CVR',
      predicate: 'REGULATORY_MILESTONE',
      result: CVR_RESULT,
      evidence: ['EXACT_CVR_TERM', 'EXACT_SOURCE_CITATION'],
    }));
  }
  return {
    schema_version: PRODUCT_QUERY_ADMISSION_CONTEXT_SCHEMA,
    approved_pm_data_version_id: digest('pm-data-version'),
    candidate_release_manifest_id: digest('candidate-release'),
    candidate_release_manifest_payload_digest: digest('candidate-payload'),
    canonical_contract_identity: identity('CANONICAL_CONTRACT_BUNDLE'),
    product_field_catalogue: {
      stable_id: 'PRODUCT_FIELD_CATALOGUE',
      manifest_id: digest('field-manifest'),
      payload_digest: digest('field-payload'),
      field_definitions: fields,
    },
    navigation_catalogue: {
      stable_id: 'PRODUCT_NAVIGATION_CATALOGUE',
      catalogue_id: digest('navigation-manifest'),
      payload_digest: sha256Hex(
        Buffer.from(canonicalJson(navigation), 'utf8'),
      ),
    },
    predicate_admissions: predicates,
    exact_detail_actions: [
      'PARENT_BOUND_PARAGRAPH_CONTEXT',
    ],
    coverage_identities: [
      digest('agreement-coverage'),
      digest('process-coverage'),
      digest('cvr-coverage'),
    ],
    route_budget: {
      maximum_page_size: 50,
    },
  };
}

function queryTemplate({ result, evidence, fieldKey, coverage }) {
  return {
    result_definition: clone(result),
    evidence_requirement_ids: [...evidence],
    cohort: {
      cohort_definition_id: digest(`${coverage}:cohort`),
      cohort_definition_payload_digest: digest(`${coverage}:cohort-payload`),
    },
    filters: [{
      field_key: fieldKey,
      field_version: 1,
      operator: 'EQ',
      value: 'ADMITTED_VALUE',
    }],
    sort: [{
      field_key: fieldKey,
      field_version: 1,
      direction: 'ASC',
    }],
    diversity: {
      definition_id: digest(`${coverage}:diversity`),
      payload_digest: digest(`${coverage}:diversity-payload`),
    },
    requested_columns: [{
      field_key: fieldKey,
      field_version: 1,
    }],
    pagination: {
      page_size: 25,
      cursor: null,
    },
    detail_actions: ['PARENT_BOUND_PARAGRAPH_CONTEXT'],
    coverage: {
      coverage_identity: digest(coverage),
      coverage_payload_digest: digest(`${coverage}:payload`),
      covered_set_identity: digest(`${coverage}:covered`),
      exclusions_identity: digest(`${coverage}:exclusions`),
    },
  };
}

function queryTemplates({ includeCvr = false } = {}) {
  const templates = [
    {
      domain_key: 'AGREEMENT',
      query_template: queryTemplate({
        result: AGREEMENT_RESULT,
        evidence: ['EXACT_PASSAGE', 'EXACT_SOURCE_CITATION'],
        fieldKey: 'agreement_term',
        coverage: 'agreement-coverage',
      }),
    },
    {
      domain_key: 'PROCESS',
      query_template: queryTemplate({
        result: PROCESS_RESULT,
        evidence: ['EXACT_PASSAGE', 'EXACT_SOURCE_CITATION'],
        fieldKey: 'process_phase',
        coverage: 'process-coverage',
      }),
    },
  ];
  if (includeCvr) {
    templates.splice(1, 0, {
      domain_key: 'CVR',
      query_template: queryTemplate({
        result: CVR_RESULT,
        evidence: ['EXACT_CVR_TERM', 'EXACT_SOURCE_CITATION'],
        fieldKey: 'cvr_milestone_status',
        coverage: 'cvr-coverage',
      }),
    });
  }
  return templates;
}

function concept({
  domain,
  topic,
  patternKey,
  predicate,
  label,
}) {
  return {
    domain_key: domain,
    topic_key: topic,
    pattern_key: patternKey,
    predicate_key: predicate,
    predicate_version: 1,
    label,
  };
}

const AGREEMENT_CONCEPT = Object.freeze(concept({
  domain: 'AGREEMENT',
  topic: 'DEAL_PROTECTIONS',
  patternKey: 'NO_SHOP',
  predicate: 'NO_SHOP',
  label: 'No-shop',
}));
const PROCESS_CONCEPT = Object.freeze(concept({
  domain: 'PROCESS',
  topic: 'EXCLUSIVITY',
  patternKey: 'EXCLUSIVITY_GRANTED',
  predicate: 'EXCLUSIVITY_GRANTED',
  label: 'Exclusivity granted',
}));
const CVR_CONCEPT = Object.freeze(concept({
  domain: 'CVR',
  topic: 'MILESTONES',
  patternKey: 'REGULATORY_MILESTONE',
  predicate: 'REGULATORY_MILESTONE',
  label: 'Regulatory milestone',
}));

function mapping({
  key,
  phrase,
  phraseClass,
  outcome,
  target = null,
  choices = [],
  nearest = [],
}) {
  const definition = {
    mapping_key: key,
    phrase,
    normalized_phrase: normalizeProductAskPhrase(phrase),
    phrase_class: phraseClass,
    outcome,
    domain_key: target?.domain_key || null,
    topic_key: target?.topic_key || null,
    pattern_key: target?.pattern_key || null,
    predicate_key: target?.predicate_key || null,
    predicate_version: target?.predicate_version || null,
    concept_label: target?.label || null,
    choices: clone(choices),
    nearest_supported_concepts: clone(nearest),
  };
  return {
    ...definition,
    mapping_definition_id: contentId(
      'PRODUCT_ASK_MAPPING_DEFINITION/V1',
      definition,
    ),
  };
}

function mappings({ includeCvr = false } = {}) {
  const entries = [
    mapping({
      key: 'ASK-001',
      phrase: 'How is the no-shop drafted?',
      phraseClass: 'PRACTITIONER_PHRASE',
      outcome: 'COMPILED',
      target: AGREEMENT_CONCEPT,
    }),
    mapping({
      key: 'ASK-002',
      phrase: 'What does the exclusivity clause say?',
      phraseClass: 'DRAFTING_SYNONYM',
      outcome: 'COMPILED',
      target: AGREEMENT_CONCEPT,
    }),
    mapping({
      key: 'ASK-003',
      phrase: 'Did the target grant exclusivity?',
      phraseClass: 'PRACTITIONER_PHRASE',
      outcome: 'COMPILED',
      target: PROCESS_CONCEPT,
    }),
    mapping({
      key: 'ASK-004',
      phrase: 'NS',
      phraseClass: 'ABBREVIATION',
      outcome: 'COMPILED',
      target: AGREEMENT_CONCEPT,
    }),
    mapping({
      key: 'ASK-005',
      phrase: 'Did the target grant excluisvity?',
      phraseClass: 'ORDINARY_MISSPELLING',
      outcome: 'COMPILED',
      target: PROCESS_CONCEPT,
    }),
    mapping({
      key: 'ASK-006',
      phrase: 'Was the buyer interested?',
      phraseClass: 'LEGALLY_ADJACENT_NEGATIVE',
      outcome: 'TYPED_UNSUPPORTED',
      nearest: [PROCESS_CONCEPT],
    }),
    mapping({
      key: 'ASK-007',
      phrase: 'Show me exclusivity',
      phraseClass: 'AMBIGUOUS_LEGAL_PHRASE',
      outcome: 'AMBIGUOUS_REQUIRES_LEGAL_CHOICE',
      choices: [AGREEMENT_CONCEPT, PROCESS_CONCEPT],
    }),
    mapping({
      key: 'ASK-008',
      phrase: 'What did the bankers think?',
      phraseClass: 'UNSUPPORTED_PHRASE',
      outcome: 'TYPED_UNSUPPORTED',
      nearest: [PROCESS_CONCEPT],
    }),
  ];
  if (includeCvr) {
    entries.push(mapping({
      key: 'ASK-009',
      phrase: 'Show regulatory milestone drafting',
      phraseClass: 'DRAFTING_SYNONYM',
      outcome: 'COMPILED',
      target: CVR_CONCEPT,
    }));
  }
  return entries;
}

function rehashRegistry(registry) {
  const body = clone(registry);
  delete body.manifest_id;
  delete body.canonical_payload_digest;
  registry.manifest_id = contentId(
    PRODUCT_ASK_MAPPING_REGISTRY_MANIFEST_SCHEMA,
    body,
  );
  registry.canonical_payload_digest =
    productAskMappingRegistryPayloadDigest(registry);
  return registry;
}

function mappingRegistry(admission, { includeCvr = false } = {}) {
  const registry = {
    schema_version: PRODUCT_ASK_MAPPING_REGISTRY_MANIFEST_SCHEMA,
    stable_id: 'PRODUCT_ASK_MAPPING_REGISTRY',
    registry_version: 1,
    approved_pm_data_version_id: admission.approved_pm_data_version_id,
    candidate_release_manifest_id:
      admission.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      admission.candidate_release_manifest_payload_digest,
    basis: {
      navigation_catalogue_identity: {
        manifest_id: admission.navigation_catalogue.catalogue_id,
        payload_digest: admission.navigation_catalogue.payload_digest,
      },
      registry_compiler_identity:
        identity('PRODUCT_ASK_MAPPING_REGISTRY_COMPILER'),
      certification: {
        independent_enumeration_identity:
          identity('ASK_INDEPENDENT_ENUMERATION'),
        mapping_reconciliation_identity:
          identity('ASK_MAPPING_RECONCILIATION'),
        query_goldens_identity: identity('ASK_QUERY_GOLDENS'),
        utterance_suite_identity: identity('ASK_UTTERANCE_SUITE'),
      },
      previous_registry_identity: null,
    },
    entries: mappings({ includeCvr }),
    pattern_coverage: [],
    pattern_exclusions: [],
    difference: {
      previous_manifest_id: null,
      added_mapping_keys: [],
      removed_mapping_keys: [],
      changed_mapping_keys: [],
      unchanged_mapping_keys: [],
    },
    counts: {
      navigation_pattern_count: includeCvr ? 3 : 2,
      covered_pattern_count: includeCvr ? 3 : 2,
      excluded_pattern_count: 0,
      mapping_count: includeCvr ? 9 : 8,
      compiled_mapping_count: includeCvr ? 6 : 5,
      boundary_mapping_count: 3,
    },
    manifest_id: digest('temporary-manifest'),
    canonical_payload_digest: digest('temporary-payload'),
  };
  return rehashRegistry(registry);
}

function mappingAdmission(registry) {
  return {
    stable_id: registry.stable_id,
    registry_version: registry.registry_version,
    manifest_id: registry.manifest_id,
    payload_digest: registry.canonical_payload_digest,
    navigation_catalogue_identity:
      clone(registry.basis.navigation_catalogue_identity),
  };
}

function fixture({ includeCvr = false } = {}) {
  const navigation = navigationDefinition({ includeCvr });
  const admission = queryAdmission(navigation, { includeCvr });
  const registry = mappingRegistry(admission, { includeCvr });
  return {
    navigation,
    admission,
    templates: queryTemplates({ includeCvr }),
    registry,
    registryAdmission: mappingAdmission(registry),
  };
}

function askInput(state, question) {
  return {
    question,
    mapping_registry: state.registry,
    mapping_registry_admission: state.registryAdmission,
    navigation_definition: state.navigation,
    admission: state.admission,
    query_templates: state.templates,
  };
}

function browseInput(state, selection) {
  return {
    selection,
    navigation_definition: state.navigation,
    admission: state.admission,
    query_templates: state.templates,
  };
}

test('lists the dynamic Agreement and Process Browse hierarchy', () => {
  const state = fixture();
  const domains = listProductBrowseOptions({
    navigation_definition: state.navigation,
    admission: state.admission,
    query_templates: state.templates,
    selection: null,
  });
  assert.deepEqual(domains.options, [
    { key: 'AGREEMENT', label: 'Agreement' },
    { key: 'PROCESS', label: 'Process' },
  ]);
  const topics = listProductBrowseOptions({
    navigation_definition: state.navigation,
    admission: state.admission,
    query_templates: state.templates,
    selection: {
      domain_key: 'PROCESS',
      topic_key: null,
    },
  });
  assert.deepEqual(topics.options, [
    { key: 'EXCLUSIVITY', label: 'Exclusivity' },
  ]);
});

test('compiles Agreement and Process Browse paths to Product Query IR', () => {
  const state = fixture();
  const agreement = compileProductBrowseQuery(browseInput(state, {
    domain_key: 'AGREEMENT',
    topic_key: 'DEAL_PROTECTIONS',
    pattern_key: 'NO_SHOP',
  }));
  const process = compileProductBrowseQuery(browseInput(state, {
    domain_key: 'PROCESS',
    topic_key: 'EXCLUSIVITY',
    pattern_key: 'EXCLUSIVITY_GRANTED',
  }));
  assert.equal(agreement.query_ir.schema_version, PRODUCT_QUERY_IR_SCHEMA);
  assert.equal(
    agreement.query_ir.semantic_contract.domain_key,
    'AGREEMENT',
  );
  assert.equal(process.query_ir.schema_version, PRODUCT_QUERY_IR_SCHEMA);
  assert.equal(process.query_ir.semantic_contract.domain_key, 'PROCESS');
});

test('makes Ask and Browse byte-identical for the same legal meaning', () => {
  const state = fixture();
  const ask = compileProductAskQuery(askInput(
    state,
    '  HOW is the no-shop drafted?!  ',
  ));
  const browse = compileProductBrowseQuery(browseInput(state, {
    domain_key: 'AGREEMENT',
    topic_key: 'DEAL_PROTECTIONS',
    pattern_key: 'NO_SHOP',
  }));
  assert.equal(ask.outcome, 'COMPILED');
  assert.deepEqual(ask.query_ir, browse.query_ir);
  assert.equal(
    canonicalProductQueryIrBytes(ask.query_ir).toString('utf8'),
    canonicalProductQueryIrBytes(browse.query_ir).toString('utf8'),
  );

  const processAsk = compileProductAskQuery(askInput(
    state,
    'Did the target grant exclusivity?',
  ));
  const processBrowse = compileProductBrowseQuery(browseInput(state, {
    domain_key: 'PROCESS',
    topic_key: 'EXCLUSIVITY',
    pattern_key: 'EXCLUSIVITY_GRANTED',
  }));
  assert.equal(processAsk.outcome, 'COMPILED');
  assert.equal(
    processAsk.query_ir.semantic_contract.domain_key,
    'PROCESS',
  );
  assert.deepEqual(processAsk.query_ir, processBrowse.query_ir);
  assert.equal(
    canonicalProductQueryIrBytes(processAsk.query_ir).toString('utf8'),
    canonicalProductQueryIrBytes(processBrowse.query_ir).toString('utf8'),
  );
});

test('adds a later CVR domain without a compiler change', () => {
  const state = fixture({ includeCvr: true });
  const browse = compileProductBrowseQuery(browseInput(state, {
    domain_key: 'CVR',
    topic_key: 'MILESTONES',
    pattern_key: 'REGULATORY_MILESTONE',
  }));
  const ask = compileProductAskQuery(askInput(
    state,
    'Show regulatory milestone drafting',
  ));
  assert.equal(browse.query_ir.semantic_contract.domain_key, 'CVR');
  assert.deepEqual(ask.query_ir, browse.query_ir);
});

test('treats ALL as catalogue navigation and never as a union query', () => {
  const state = fixture();
  const result = compileProductBrowseQuery(browseInput(state, {
    domain_key: 'ALL',
    topic_key: 'ALL',
    pattern_key: 'ALL',
  }));
  assert.equal(result.outcome, 'CATALOGUE_NAVIGATION');
  assert.equal(result.next_level, 'DOMAIN');
  assert.equal(result.query_ir, null);
  assert.throws(
    () => compileProductBrowseQuery(browseInput(state, {
      domain_key: 'ALL',
      topic_key: 'EXCLUSIVITY',
      pattern_key: 'EXCLUSIVITY_GRANTED',
    })),
    { code: 'INVALID_PRODUCT_BROWSE_INPUT' },
  );
});

test('returns typed results for unknown, ambiguous and unsupported Ask text', () => {
  const state = fixture();
  const unknown = compileProductAskQuery(askInput(
    state,
    'Give me a legal answer that was never certified',
  ));
  assert.equal(unknown.outcome, 'TYPED_UNSUPPORTED');
  assert.equal(unknown.reason, 'NO_CHECKED_MAPPING');
  assert.equal(unknown.query_ir, null);

  const ambiguous = compileProductAskQuery(askInput(
    state,
    'Show me exclusivity',
  ));
  assert.equal(
    ambiguous.outcome,
    'AMBIGUOUS_REQUIRES_LEGAL_CHOICE',
  );
  assert.equal(ambiguous.choices.length, 2);
  assert.equal(ambiguous.query_ir, null);

  const unsupported = compileProductAskQuery(askInput(
    state,
    'Was the buyer interested?',
  ));
  assert.equal(unsupported.outcome, 'TYPED_UNSUPPORTED');
  assert.equal(unsupported.nearest_supported_concepts.length, 1);
  assert.equal(unsupported.query_ir, null);
});

test('fails closed when a visible domain has no governed template', () => {
  const state = fixture();
  state.templates.pop();
  assert.throws(
    () => listProductBrowseOptions({
      navigation_definition: state.navigation,
      admission: state.admission,
      query_templates: state.templates,
      selection: null,
    }),
    (error) => (
      error.code === 'DOMAIN_QUERY_TEMPLATE_NOT_ADMITTED'
      && error.details.domain_key === 'PROCESS'
    ),
  );
});

test('does not display a domain whose template cannot compile each Pattern', () => {
  const state = fixture();
  state.templates[1].query_template.evidence_requirement_ids = [
    'EXACT_SOURCE_CITATION',
  ];
  assert.throws(
    () => listProductBrowseOptions({
      navigation_definition: state.navigation,
      admission: state.admission,
      query_templates: state.templates,
      selection: null,
    }),
    { code: 'EVIDENCE_REQUIREMENTS_NOT_ADMITTED' },
  );
});

test('rejects stale release and navigation bindings', () => {
  const staleRelease = fixture();
  staleRelease.admission.candidate_release_manifest_id =
    digest('other-release');
  assert.throws(
    () => compileProductAskQuery(askInput(
      staleRelease,
      'How is the no-shop drafted?',
    )),
    { code: 'INVALID_PRODUCT_ASK_MAPPING_REGISTRY' },
  );

  const staleNavigation = fixture();
  staleNavigation.admission.navigation_catalogue.catalogue_id =
    digest('other-navigation');
  assert.throws(
    () => compileProductAskQuery(askInput(
      staleNavigation,
      'How is the no-shop drafted?',
    )),
    { code: 'INVALID_PRODUCT_ASK_MAPPING_REGISTRY' },
  );
});

test('rejects changed and correctly rehashed registry content', () => {
  const changed = fixture();
  changed.registry.entries[0].phrase = 'Changed without rehashing';
  assert.throws(
    () => compileProductAskQuery(askInput(
      changed,
      'How is the no-shop drafted?',
    )),
    { code: 'INVALID_PRODUCT_ASK_MAPPING_REGISTRY' },
  );

  const rehashed = fixture();
  rehashed.registry.entries[0].phrase = 'Changed and rehashed';
  rehashed.registry.entries[0].normalized_phrase =
    normalizeProductAskPhrase(rehashed.registry.entries[0].phrase);
  const {
    mapping_definition_id: ignored,
    ...definition
  } = rehashed.registry.entries[0];
  rehashed.registry.entries[0].mapping_definition_id = contentId(
    'PRODUCT_ASK_MAPPING_DEFINITION/V1',
    definition,
  );
  rehashRegistry(rehashed.registry);
  assert.throws(
    () => compileProductAskQuery(askInput(
      rehashed,
      'Changed and rehashed',
    )),
    { code: 'INVALID_PRODUCT_ASK_MAPPING_REGISTRY' },
  );
});

test('rejects a newly admitted mapping that points to the wrong predicate', () => {
  const state = fixture();
  const entry = state.registry.entries[0];
  entry.predicate_key = 'EXCLUSIVITY_GRANTED';
  const {
    mapping_definition_id: ignored,
    ...definition
  } = entry;
  entry.mapping_definition_id = contentId(
    'PRODUCT_ASK_MAPPING_DEFINITION/V1',
    definition,
  );
  rehashRegistry(state.registry);
  state.registryAdmission = mappingAdmission(state.registry);
  assert.throws(
    () => compileProductAskQuery(askInput(
      state,
      'How is the no-shop drafted?',
    )),
    { code: 'STALE_PRODUCT_ASK_MAPPING' },
  );
});

test('returns typed unsupported for an unadmitted Browse selection', () => {
  const state = fixture();
  const result = compileProductBrowseQuery(browseInput(state, {
    domain_key: 'PROCESS',
    topic_key: 'EXCLUSIVITY',
    pattern_key: 'NOT_ADMITTED',
  }));
  assert.equal(result.outcome, 'TYPED_UNSUPPORTED');
  assert.equal(result.reason, 'NAVIGATION_SELECTION_NOT_ADMITTED');
  assert.equal(result.query_ir, null);
});

test('keeps the unit outside prohibited runtime and product paths', () => {
  const sourceFiles = [
    'lib/canonical-v2/product-ask-compiler.js',
    'lib/canonical-v2/product-browse-compiler.js',
  ];
  const prohibited = [
    'components/',
    'data/',
    'pages/',
    'sql/',
    'supabase/',
    'fetch(',
    'XMLHttpRequest',
    'openai',
    'anthropic',
  ];
  for (const relativePath of sourceFiles) {
    const source = fs.readFileSync(
      path.join(__dirname, '..', relativePath),
      'utf8',
    );
    for (const marker of prohibited) {
      assert.equal(source.includes(marker), false, `${relativePath}: ${marker}`);
    }
  }
});
