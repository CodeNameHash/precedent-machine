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
  canonicalProductQueryIrBytes,
  compileProductQueryIr,
  compileProductQueryTemplate,
} = require('../lib/canonical-v2/product-query-ir');
const productQueryContract = require(
  '../contracts/canonical-v2/successor/product/query/product-query-ir.v1.json',
);

const AGREEMENT_RESULT = Object.freeze({
  stable_id: 'AGREEMENT_COMPARABLE_RESULT',
  version: 1,
});
const PROCESS_RESULT = Object.freeze({
  stable_id: 'PROCESS_PHRASEBOOK_PASSAGE_RESULT',
  version: 1,
});
const CVR_RESULT = Object.freeze({
  stable_id: 'CVR_MILESTONE_RESULT',
  version: 1,
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

function field({
  key,
  results,
  domains,
  operators = ['EQ', 'IN'],
}) {
  return {
    field_key: key,
    field_version: 1,
    permitted_result_definitions: results.map((result) => result.stable_id),
    filter_scope: 'SAME_DEAL',
    multiplicity: 'ZERO_OR_ONE',
    capabilities: {
      display: true,
      filter: true,
      sort: true,
    },
    supported_domains: [...domains],
    permitted_operators: operators,
    completeness_semantics: 'UNKNOWN_IF_NOT_ADMITTED',
  };
}

function predicateAdmission({
  domain,
  predicate,
  result,
  evidence,
}) {
  return {
    domain_key: domain,
    predicate_key: predicate,
    predicate_version: 1,
    admission_id: digest(`admission:${domain}:${predicate}`),
    result_definitions: [clone(result)],
    evidence_requirement_ids: [...evidence],
  };
}

function admission() {
  const agreementEvidence = ['EXACT_CLAIM', 'EXACT_SOURCE_CITATION'];
  const processEvidence = ['EXACT_PASSAGE', 'EXACT_SOURCE_CITATION'];
  return {
    schema_version: PRODUCT_QUERY_ADMISSION_CONTEXT_SCHEMA,
    approved_pm_data_version_id: digest('pm-data-version'),
    candidate_release_manifest_id: digest('candidate-release'),
    candidate_release_manifest_payload_digest: digest('candidate-payload'),
    canonical_contract_identity: {
      stable_id: 'CANONICAL_CONTRACT_BUNDLE',
      version: 1,
      payload_digest: digest('canonical-contract'),
    },
    product_field_catalogue: {
      stable_id: 'PRODUCT_FIELD_CATALOGUE',
      manifest_id: digest('field-manifest'),
      payload_digest: digest('field-payload'),
      field_definitions: [
        field({
          key: 'sector',
          results: [AGREEMENT_RESULT, PROCESS_RESULT],
          domains: ['AGREEMENT', 'PROCESS'],
        }),
        field({
          key: 'seller_termination_fee_percent',
          results: [AGREEMENT_RESULT],
          domains: ['AGREEMENT'],
          operators: ['BETWEEN', 'EQ'],
        }),
        field({
          key: 'process_phase',
          results: [PROCESS_RESULT],
          domains: ['PROCESS'],
        }),
      ],
    },
    navigation_catalogue: {
      stable_id: 'PRODUCT_NAVIGATION_CATALOGUE',
      catalogue_id: digest('navigation-catalogue'),
      payload_digest: digest('navigation-payload'),
    },
    predicate_admissions: [
      predicateAdmission({
        domain: 'AGREEMENT',
        predicate: 'COMMON_PATTERN',
        result: AGREEMENT_RESULT,
        evidence: agreementEvidence,
      }),
      predicateAdmission({
        domain: 'AGREEMENT',
        predicate: 'SELLER_TERMINATION_FEE',
        result: AGREEMENT_RESULT,
        evidence: agreementEvidence,
      }),
      predicateAdmission({
        domain: 'PROCESS',
        predicate: 'COMMON_PATTERN',
        result: PROCESS_RESULT,
        evidence: processEvidence,
      }),
      predicateAdmission({
        domain: 'PROCESS',
        predicate: 'EXCLUSIVITY_GRANTED',
        result: PROCESS_RESULT,
        evidence: processEvidence,
      }),
    ],
    exact_detail_actions: [
      'PARENT_BOUND_PARAGRAPH_CONTEXT',
      'RESULT_COMPONENT_CLAIM_EVIDENCE',
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

function template({
  result,
  evidence,
  filterKey,
  filterOperator,
  filterValue,
  detailAction,
  coverage,
}) {
  return {
    result_definition: clone(result),
    evidence_requirement_ids: [...evidence],
    cohort: {
      cohort_definition_id: digest('cohort'),
      cohort_definition_payload_digest: digest('cohort-payload'),
    },
    filters: [
      {
        field_key: filterKey,
        field_version: 1,
        operator: filterOperator,
        value: clone(filterValue),
      },
    ],
    sort: [
      {
        field_key: 'sector',
        field_version: 1,
        direction: 'ASC',
      },
    ],
    diversity: {
      definition_id: digest('diversity'),
      payload_digest: digest('diversity-payload'),
    },
    requested_columns: [
      {
        field_key: 'sector',
        field_version: 1,
      },
      {
        field_key: filterKey,
        field_version: 1,
      },
    ],
    pagination: {
      page_size: 25,
      cursor: null,
    },
    detail_actions: [detailAction],
    coverage: {
      coverage_identity: digest(coverage),
      coverage_payload_digest: digest(`${coverage}:payload`),
      covered_set_identity: digest(`${coverage}:covered`),
      exclusions_identity: digest(`${coverage}:exclusions`),
    },
  };
}

function agreementTemplate() {
  return template({
    result: AGREEMENT_RESULT,
    evidence: ['EXACT_CLAIM', 'EXACT_SOURCE_CITATION'],
    filterKey: 'seller_termination_fee_percent',
    filterOperator: 'BETWEEN',
    filterValue: [2, 4],
    detailAction: 'RESULT_COMPONENT_CLAIM_EVIDENCE',
    coverage: 'agreement-coverage',
  });
}

function processTemplate() {
  return template({
    result: PROCESS_RESULT,
    evidence: ['EXACT_PASSAGE', 'EXACT_SOURCE_CITATION'],
    filterKey: 'process_phase',
    filterOperator: 'EQ',
    filterValue: 'PRE_SIGNING',
    detailAction: 'PARENT_BOUND_PARAGRAPH_CONTEXT',
    coverage: 'process-coverage',
  });
}

function fullQuery(domain, predicate, queryTemplate) {
  return {
    domain_key: domain,
    predicate_key: predicate,
    predicate_version: 1,
    ...clone(queryTemplate),
  };
}

test('compiles one deterministic immutable Agreement domain plan', () => {
  const first = compileProductQueryIr({
    admission: admission(),
    query: fullQuery(
      'AGREEMENT',
      'SELLER_TERMINATION_FEE',
      agreementTemplate(),
    ),
  });
  const second = compileProductQueryIr({
    admission: admission(),
    query: fullQuery(
      'AGREEMENT',
      'SELLER_TERMINATION_FEE',
      agreementTemplate(),
    ),
  });

  assert.deepEqual(first, second);
  assertDeepFrozen(first);
  assert.equal(first.schema_version, PRODUCT_QUERY_IR_SCHEMA);
  assert.equal(first.semantic_contract.domain_key, 'AGREEMENT');
  assert.equal(
    first.semantic_contract.predicate_admission_id,
    digest('admission:AGREEMENT:SELLER_TERMINATION_FEE'),
  );
  assert.equal(
    canonicalProductQueryIrBytes(first).toString('utf8'),
    canonicalJson(first),
  );
});

test('emits Process plans under the distinct Product successor schema', () => {
  const product = compileProductQueryIr({
    admission: admission(),
    query: fullQuery(
      'PROCESS',
      'EXCLUSIVITY_GRANTED',
      processTemplate(),
    ),
  });

  assert.equal(product.schema_version, 'PRODUCT_QUERY_IR/V1');
  assert.equal(product.semantic_contract.domain_key, 'PROCESS');
  assert.equal(
    canonicalProductQueryIrBytes(product).toString('utf8'),
    canonicalJson(product),
  );
});

test('constructs and validates Agreement and Process plans directly as Product IR', () => {
  for (const [domain, predicate, queryTemplate] of [
    ['AGREEMENT', 'SELLER_TERMINATION_FEE', agreementTemplate()],
    ['PROCESS', 'EXCLUSIVITY_GRANTED', processTemplate()],
  ]) {
    const product = compileProductQueryIr({
      admission: admission(),
      query: fullQuery(domain, predicate, queryTemplate),
    });
    const {
      query_definition_id: queryDefinitionId,
      ...identityPayload
    } = product;

    assert.equal(product.schema_version, PRODUCT_QUERY_IR_SCHEMA);
    assert.equal(product.semantic_contract.domain_key, domain);
    assert.equal(
      queryDefinitionId,
      contentId(PRODUCT_QUERY_IR_SCHEMA, identityPayload),
    );
    assert.deepEqual(
      JSON.parse(canonicalProductQueryIrBytes(product).toString('utf8')),
      product,
    );
  }
});

test('keeps identical predicate keys separate by admitted domain', () => {
  const agreement = compileProductQueryIr({
    admission: admission(),
    query: fullQuery('AGREEMENT', 'COMMON_PATTERN', agreementTemplate()),
  });
  const process = compileProductQueryIr({
    admission: admission(),
    query: fullQuery('PROCESS', 'COMMON_PATTERN', processTemplate()),
  });

  assert.notEqual(
    agreement.semantic_contract.predicate_admission_id,
    process.semantic_contract.predicate_admission_id,
  );
  assert.notEqual(
    agreement.query_definition_id,
    process.query_definition_id,
  );
});

test('compiles templates through the same single-domain schema', () => {
  const compiled = compileProductQueryTemplate({
    admission: admission(),
    query_template: agreementTemplate(),
    domain_key: 'AGREEMENT',
    predicate_key: 'SELLER_TERMINATION_FEE',
    predicate_version: 1,
  });

  assert.equal(compiled.semantic_contract.domain_key, 'AGREEMENT');
  assert.equal(
    compiled.semantic_contract.predicate_key,
    'SELLER_TERMINATION_FEE',
  );
});

test('admits a later CVR domain without compiler code change', () => {
  const queryAdmission = admission();
  queryAdmission.product_field_catalogue.field_definitions.push(
    field({
      key: 'cvr_milestone_status',
      results: [CVR_RESULT],
      domains: ['CVR'],
    }),
  );
  queryAdmission.product_field_catalogue.field_definitions[0]
    .permitted_result_definitions.push(CVR_RESULT.stable_id);
  queryAdmission.product_field_catalogue.field_definitions[0]
    .supported_domains.push('CVR');
  queryAdmission.product_field_catalogue.field_definitions[0]
    .supported_domains.sort();
  queryAdmission.predicate_admissions.push(predicateAdmission({
    domain: 'CVR',
    predicate: 'MILESTONE_STATUS',
    result: CVR_RESULT,
    evidence: ['EXACT_CVR_TERM', 'EXACT_SOURCE_CITATION'],
  }));

  const compiled = compileProductQueryIr({
    admission: queryAdmission,
    query: fullQuery('CVR', 'MILESTONE_STATUS', template({
      result: CVR_RESULT,
      evidence: ['EXACT_CVR_TERM', 'EXACT_SOURCE_CITATION'],
      filterKey: 'cvr_milestone_status',
      filterOperator: 'EQ',
      filterValue: 'ACHIEVED',
      detailAction: 'RESULT_COMPONENT_CLAIM_EVIDENCE',
      coverage: 'cvr-coverage',
    })),
  });

  assert.equal(compiled.semantic_contract.domain_key, 'CVR');
  assert.equal(compiled.semantic_contract.predicate_key, 'MILESTONE_STATUS');
});

test('rejects cross-domain Boolean or multiple-domain plans', () => {
  const query = fullQuery(
    'AGREEMENT',
    'SELLER_TERMINATION_FEE',
    agreementTemplate(),
  );
  query.domain_plans = [
    { domain_key: 'AGREEMENT' },
    { domain_key: 'PROCESS' },
  ];
  assert.throws(
    () => compileProductQueryIr({ admission: admission(), query }),
    { code: 'INVALID_PRODUCT_QUERY_INPUT' },
  );
  assert.throws(
    () => compileProductQueryIr({
      admission: admission(),
      query: fullQuery(
        ['AGREEMENT', 'PROCESS'],
        'COMMON_PATTERN',
        agreementTemplate(),
      ),
    }),
    { code: 'INVALID_PRODUCT_QUERY_INPUT' },
  );
});

test('rejects an unadmitted domain without nearest-domain substitution', () => {
  assert.throws(
    () => compileProductQueryIr({
      admission: admission(),
      query: fullQuery('CVR', 'MILESTONE_STATUS', agreementTemplate()),
    }),
    (error) => (
      error.code === 'PREDICATE_NOT_ADMITTED'
      && error.details.domain_key === 'CVR'
      && error.details.predicate_key === 'MILESTONE_STATUS'
    ),
  );
});

test('rejects fields that are not admitted for the selected result', () => {
  const query = fullQuery(
    'AGREEMENT',
    'SELLER_TERMINATION_FEE',
    agreementTemplate(),
  );
  query.filters[0].field_key = 'process_phase';
  assert.throws(
    () => compileProductQueryIr({ admission: admission(), query }),
    { code: 'FIELD_NOT_ADMITTED_FOR_RESULT' },
  );
});

test('rejects a same-result field that is not admitted for the domain', () => {
  const queryAdmission = admission();
  queryAdmission.product_field_catalogue.field_definitions.push(field({
    key: 'process_only_agreement_shape',
    results: [AGREEMENT_RESULT],
    domains: ['PROCESS'],
  }));
  const query = fullQuery(
    'AGREEMENT',
    'SELLER_TERMINATION_FEE',
    agreementTemplate(),
  );
  query.filters[0] = {
    field_key: 'process_only_agreement_shape',
    field_version: 1,
    operator: 'EQ',
    value: 'FORGED_CROSS_DOMAIN_VALUE',
  };
  query.requested_columns[1] = {
    field_key: 'process_only_agreement_shape',
    field_version: 1,
  };

  assert.throws(
    () => compileProductQueryIr({ admission: queryAdmission, query }),
    (error) => (
      error.code === 'FIELD_NOT_ADMITTED_FOR_DOMAIN'
      && error.details.domain_key === 'AGREEMENT'
      && error.details.field_key === 'process_only_agreement_shape'
    ),
  );
});

test('requires exact evidence and checked release inputs', () => {
  const wrongEvidence = fullQuery(
    'AGREEMENT',
    'SELLER_TERMINATION_FEE',
    agreementTemplate(),
  );
  wrongEvidence.evidence_requirement_ids = ['EXACT_SOURCE_CITATION'];
  assert.throws(
    () => compileProductQueryIr({
      admission: admission(),
      query: wrongEvidence,
    }),
    { code: 'EVIDENCE_REQUIREMENTS_NOT_ADMITTED' },
  );

  const staleAdmission = admission();
  staleAdmission.candidate_release_manifest_id = 'not-a-digest';
  assert.throws(
    () => compileProductQueryIr({
      admission: staleAdmission,
      query: fullQuery(
        'AGREEMENT',
        'SELLER_TERMINATION_FEE',
        agreementTemplate(),
      ),
    }),
    (error) => (
      error.code === 'INVALID_PRODUCT_QUERY_ADMISSION'
      && !error.message.includes('Process')
    ),
  );
});

test('rejects malformed Product field domain admissions', () => {
  const duplicate = admission();
  duplicate.product_field_catalogue.field_definitions[0]
    .supported_domains = ['AGREEMENT', 'AGREEMENT'];
  assert.throws(
    () => compileProductQueryIr({
      admission: duplicate,
      query: fullQuery(
        'AGREEMENT',
        'SELLER_TERMINATION_FEE',
        agreementTemplate(),
      ),
    }),
    { code: 'INVALID_PRODUCT_QUERY_ADMISSION' },
  );

  const reordered = admission();
  reordered.product_field_catalogue.field_definitions[0]
    .supported_domains = ['PROCESS', 'AGREEMENT'];
  assert.throws(
    () => compileProductQueryIr({
      admission: reordered,
      query: fullQuery(
        'AGREEMENT',
        'SELLER_TERMINATION_FEE',
        agreementTemplate(),
      ),
    }),
    { code: 'INVALID_PRODUCT_QUERY_ADMISSION' },
  );
});

test('rejects Query IR identity tampering', () => {
  const compiled = compileProductQueryIr({
    admission: admission(),
    query: fullQuery(
      'AGREEMENT',
      'SELLER_TERMINATION_FEE',
      agreementTemplate(),
    ),
  });
  const tampered = clone(compiled);
  tampered.query_definition_id = digest('forged-query');

  assert.throws(
    () => canonicalProductQueryIrBytes(tampered),
    { code: 'INVALID_PRODUCT_QUERY_IR' },
  );
});

test('rejects a correctly self-rehashed nested authority forgery', () => {
  const forged = clone(compileProductQueryIr({
    admission: admission(),
    query: fullQuery(
      'AGREEMENT',
      'SELLER_TERMINATION_FEE',
      agreementTemplate(),
    ),
  }));
  forged.semantic_contract.invented_authority = true;
  const identityPayload = {
    schema_version: forged.schema_version,
    release_contract: forged.release_contract,
    semantic_contract: forged.semantic_contract,
    cohort_contract: forged.cohort_contract,
    filter_contract: forged.filter_contract,
    presentation_contract: forged.presentation_contract,
    pagination_contract: forged.pagination_contract,
    detail_action_contract: forged.detail_action_contract,
    coverage_contract: forged.coverage_contract,
  };
  forged.query_definition_id = contentId(
    PRODUCT_QUERY_IR_SCHEMA,
    identityPayload,
  );

  assert.throws(
    () => canonicalProductQueryIrBytes(forged),
    { code: 'INVALID_PRODUCT_QUERY_IR' },
  );
});

test('rejects the historical Process admission at the Product boundary', () => {
  const processAdmission = admission();
  processAdmission.schema_version = 'PROCESS_QUERY_ADMISSION_CONTEXT/V1';

  assert.throws(
    () => compileProductQueryIr({
      admission: processAdmission,
      query: fullQuery(
        'PROCESS',
        'EXCLUSIVITY_GRANTED',
        processTemplate(),
      ),
    }),
    { code: 'INVALID_PRODUCT_QUERY_ADMISSION' },
  );
});

test('rejects relabelled Process IR even when its Process identity is correct', () => {
  const product = clone(compileProductQueryIr({
    admission: admission(),
    query: fullQuery(
      'PROCESS',
      'EXCLUSIVITY_GRANTED',
      processTemplate(),
    ),
  }));
  product.schema_version = 'PROCESS_QUERY_IR/V1';
  const { query_definition_id: ignoredIdentity, ...processIdentityPayload } =
    product;
  product.query_definition_id = contentId(
    'PROCESS_QUERY_IR/V1',
    processIdentityPayload,
  );

  assert.throws(
    () => canonicalProductQueryIrBytes(product),
    { code: 'INVALID_PRODUCT_QUERY_IR' },
  );
});

test('contains no Process compiler, schema alias or domain rewrite path', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../lib/canonical-v2/product-query-ir.js'),
    'utf8',
  );
  for (const prohibited of [
    "require('./process-query-ir')",
    'compileProcessQueryIr',
    'PROCESS_QUERY_ADMISSION_CONTEXT_SCHEMA',
    'domainAliasMap',
    'translatedAdmission',
    'translatedQuery',
  ]) {
    assert.equal(source.includes(prohibited), false, prohibited);
  }
});

test('fails closed on any governed Product Query contract drift', () => {
  const original = productQueryContract.definition.domain_contract
    .cross_domain_boolean_query_permitted;
  productQueryContract.definition.domain_contract
    .cross_domain_boolean_query_permitted = true;
  try {
    assert.throws(
      () => compileProductQueryIr({
        admission: admission(),
        query: fullQuery(
          'AGREEMENT',
          'SELLER_TERMINATION_FEE',
          agreementTemplate(),
        ),
      }),
      { code: 'INVALID_PRODUCT_QUERY_CONTRACT_BINDING' },
    );
  } finally {
    productQueryContract.definition.domain_contract
      .cross_domain_boolean_query_permitted = original;
  }

  productQueryContract.definition.boundary_contract
    .invented_authority = true;
  try {
    assert.throws(
      () => compileProductQueryIr({
        admission: admission(),
        query: fullQuery(
          'PROCESS',
          'EXCLUSIVITY_GRANTED',
          processTemplate(),
        ),
      }),
      { code: 'INVALID_PRODUCT_QUERY_CONTRACT_BINDING' },
    );
  } finally {
    delete productQueryContract.definition.boundary_contract
      .invented_authority;
  }
});

test('does not mutate the admitted catalogue or query template', () => {
  const queryAdmission = admission();
  const query = fullQuery(
    'AGREEMENT',
    'SELLER_TERMINATION_FEE',
    agreementTemplate(),
  );
  const beforeAdmission = canonicalJson(queryAdmission);
  const beforeQuery = canonicalJson(query);

  compileProductQueryIr({ admission: queryAdmission, query });

  assert.equal(canonicalJson(queryAdmission), beforeAdmission);
  assert.equal(canonicalJson(query), beforeQuery);
});

test('has no runtime execution, network, database, write or activation path', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../lib/canonical-v2/product-query-ir.js'),
    'utf8',
  );
  for (const prohibited of [
    'child_process',
    'fetch(',
    'process.env',
    'supabase',
    '.insert(',
    '.update(',
    '.delete(',
    'activate',
  ]) {
    assert.equal(source.includes(prohibited), false, prohibited);
  }
});
