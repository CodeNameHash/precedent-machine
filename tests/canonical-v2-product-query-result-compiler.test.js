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
  compileProductQueryIr,
} = require('../lib/canonical-v2/product-query-ir');
const {
  PRODUCT_DOMAIN_RESULT_VALIDATION_SCHEMA,
  PRODUCT_EXACT_CITATION_SCHEMA,
  PRODUCT_QUERY_RESULT_SCHEMA,
  validateProductQueryResult,
} = require('../lib/canonical-v2/product-citation-share-compiler');
const {
  PRODUCT_QUERY_RESULT_ADMISSION_RECEIPT_SCHEMA,
  PRODUCT_QUERY_RESULT_ADMISSION_STATE,
  PRODUCT_REQUESTED_FIELD_PROJECTION_SCHEMA,
  canonicalProductQueryResultBytes,
  compileProductQueryResult,
  requestedFieldProjectionIdentity,
} = require('../lib/canonical-v2/product-query-result-compiler');

const DOMAINS = Object.freeze({
  AGREEMENT: Object.freeze({
    predicate_key: 'SELLER_TERMINATION_FEE',
    result_definition: Object.freeze({
      stable_id: 'AGREEMENT_COMPARABLE_RESULT',
      version: 1,
    }),
    field_key: 'seller_termination_fee_percent',
    filter_value: 3.5,
    detail_action: 'RESULT_COMPONENT_CLAIM_EVIDENCE',
    representation_kind: 'STRUCTURED_RESULT',
    evidence: Object.freeze([
      'EXACT_CLAIM',
      'EXACT_SOURCE_CITATION',
    ]),
  }),
  CVR: Object.freeze({
    predicate_key: 'CVR_MILESTONE',
    result_definition: Object.freeze({
      stable_id: 'CVR_MILESTONE_RESULT',
      version: 1,
    }),
    field_key: 'cvr_milestone_status',
    filter_value: 'REGULATORY_APPROVAL',
    detail_action: 'RESULT_COMPONENT_CLAIM_EVIDENCE',
    representation_kind: 'STRUCTURED_RESULT',
    evidence: Object.freeze([
      'EXACT_CLAIM',
      'EXACT_SOURCE_CITATION',
    ]),
  }),
  PROCESS: Object.freeze({
    predicate_key: 'EXCLUSIVITY_GRANTED',
    result_definition: Object.freeze({
      stable_id: 'PROCESS_PHRASEBOOK_PASSAGE_RESULT',
      version: 1,
    }),
    field_key: 'process_phase',
    filter_value: 'PRE_SIGNING',
    detail_action: 'PARENT_BOUND_PARAGRAPH_CONTEXT',
    representation_kind: 'VERBATIM_TEXT',
    evidence: Object.freeze([
      'EXACT_PASSAGE',
      'EXACT_SOURCE_CITATION',
    ]),
  }),
});

function digest(label) {
  return sha256Hex(Buffer.from(label, 'utf8'));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function fieldDefinition({
  fieldKey,
  domains,
  resultDefinitions,
  operators = ['EQ'],
}) {
  return {
    field_key: fieldKey,
    field_version: 1,
    permitted_result_definitions:
      resultDefinitions.map((result) => result.stable_id),
    filter_scope: 'SAME_DEAL',
    multiplicity: 'ZERO_OR_ONE',
    capabilities: {
      display: true,
      filter: true,
      sort: true,
    },
    supported_domains: [...domains],
    permitted_operators: [...operators],
    completeness_semantics: 'UNKNOWN_IF_NOT_ADMITTED',
  };
}

function predicateAdmission(domain, config) {
  return {
    domain_key: domain,
    predicate_key: config.predicate_key,
    predicate_version: 1,
    admission_id: digest(`predicate-admission:${domain}`),
    result_definitions: [clone(config.result_definition)],
    evidence_requirement_ids: [...config.evidence],
  };
}

function queryAdmission() {
  const entries = Object.entries(DOMAINS);
  return {
    schema_version: PRODUCT_QUERY_ADMISSION_CONTEXT_SCHEMA,
    approved_pm_data_version_id: digest('pm-data-version'),
    candidate_release_manifest_id: digest('candidate-release'),
    candidate_release_manifest_payload_digest:
      digest('candidate-release-payload'),
    canonical_contract_identity: {
      stable_id: 'CANONICAL_CONTRACT_BUNDLE',
      version: 1,
      payload_digest: digest('canonical-contract'),
    },
    product_field_catalogue: {
      stable_id: 'PRODUCT_FIELD_CATALOGUE',
      manifest_id: digest('field-catalogue'),
      payload_digest: digest('field-catalogue-payload'),
      field_definitions: [
        fieldDefinition({
          fieldKey: 'sector',
          domains: entries.map(([domain]) => domain),
          resultDefinitions:
            entries.map(([, config]) => config.result_definition),
        }),
        ...entries.map(([domain, config]) => fieldDefinition({
          fieldKey: config.field_key,
          domains: [domain],
          resultDefinitions: [config.result_definition],
        })),
      ].sort((left, right) => (
        left.field_key < right.field_key ? -1 : 1
      )),
    },
    navigation_catalogue: {
      stable_id: 'PRODUCT_NAVIGATION_CATALOGUE',
      catalogue_id: digest('navigation-catalogue'),
      payload_digest: digest('navigation-catalogue-payload'),
    },
    predicate_admissions:
      entries.map(([domain, config]) => (
        predicateAdmission(domain, config)
      )),
    exact_detail_actions: [
      'PARENT_BOUND_PARAGRAPH_CONTEXT',
      'RESULT_COMPONENT_CLAIM_EVIDENCE',
    ],
    coverage_identities:
      entries.map(([domain]) => digest(`coverage:${domain}`)),
    route_budget: {
      maximum_page_size: 50,
    },
  };
}

function queryIr(domain) {
  const config = DOMAINS[domain];
  return compileProductQueryIr({
    admission: queryAdmission(),
    query: {
      domain_key: domain,
      predicate_key: config.predicate_key,
      predicate_version: 1,
      result_definition: clone(config.result_definition),
      evidence_requirement_ids: [...config.evidence],
      cohort: {
        cohort_definition_id: digest(`cohort:${domain}`),
        cohort_definition_payload_digest:
          digest(`cohort-payload:${domain}`),
      },
      filters: [{
        field_key: config.field_key,
        field_version: 1,
        operator: 'EQ',
        value: config.filter_value,
      }],
      sort: [{
        field_key: 'sector',
        field_version: 1,
        direction: 'ASC',
      }],
      diversity: {
        definition_id: digest(`diversity:${domain}`),
        payload_digest: digest(`diversity-payload:${domain}`),
      },
      requested_columns: [
        {
          field_key: 'sector',
          field_version: 1,
        },
        {
          field_key: config.field_key,
          field_version: 1,
        },
      ],
      pagination: {
        page_size: 12,
        cursor: null,
      },
      detail_actions: [config.detail_action],
      coverage: {
        coverage_identity: digest(`coverage:${domain}`),
        coverage_payload_digest:
          digest(`coverage-payload:${domain}`),
        covered_set_identity: digest(`covered-set:${domain}`),
        exclusions_identity: digest(`exclusions:${domain}`),
      },
    },
  });
}

function domainPayload(domain, ordinal = 1) {
  if (domain === 'PROCESS') {
    return (
      ordinal === 1
        ? 'On September 12, 2025, Metsera agreed to negotiate exclusively with Pfizer.'
        : `Exact Process passage ${ordinal}.`
    );
  }
  if (domain === 'CVR') {
    return {
      milestone_type: 'REGULATORY_APPROVAL',
      milestone_status: 'PRESENT',
      ordinal,
    };
  }
  return {
    seller_termination_fee_percent: 3.5,
    ordinal,
  };
}

function domainResult(domain, ordinal = 1) {
  const config = DOMAINS[domain];
  const payload = domainPayload(domain, ordinal);
  const payloadDigestValue = sha256Hex(Buffer.from(
    canonicalJson(payload),
    'utf8',
  ));
  const validationBody = {
    validator_stable_id: `${domain}_RESULT_VALIDATOR`,
    validator_version: 1,
    validated_payload_digest: payloadDigestValue,
    validation_state: 'EXTERNALLY_VALIDATED',
  };
  return {
    domain_key: domain,
    domain_result_definition: clone(config.result_definition),
    domain_result_identity:
      digest(`domain-result:${domain}:${ordinal}`),
    domain_result_payload: payload,
    domain_result_payload_digest: payloadDigestValue,
    domain_result_validation: {
      schema_version: PRODUCT_DOMAIN_RESULT_VALIDATION_SCHEMA,
      validator_stable_id: validationBody.validator_stable_id,
      validator_version: validationBody.validator_version,
      validation_receipt_id: contentId(
        PRODUCT_DOMAIN_RESULT_VALIDATION_SCHEMA,
        validationBody,
      ),
      validated_payload_digest:
        validationBody.validated_payload_digest,
      validation_state: validationBody.validation_state,
    },
    domain_result_source_representation_kind:
      config.representation_kind,
  };
}

function resultFields(domain) {
  const config = DOMAINS[domain];
  return [
    {
      field_reference: {
        field_key: 'sector',
        field_version: 1,
      },
      value: domain === 'CVR' ? 'BIOPHARMA' : 'HEALTHCARE',
    },
    {
      field_reference: {
        field_key: config.field_key,
        field_version: 1,
      },
      value: config.filter_value === 'PRE_SIGNING'
        ? 'PRE_SIGNING'
        : config.filter_value,
    },
  ];
}

function expectedProductResultIdentity(ir, result) {
  return contentId(PRODUCT_QUERY_RESULT_SCHEMA, {
    schema_version: PRODUCT_QUERY_RESULT_SCHEMA,
    product_query_definition_id: ir.query_definition_id,
    approved_pm_data_version_id:
      ir.release_contract.approved_pm_data_version_id,
    candidate_release_manifest_id:
      ir.release_contract.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      ir.release_contract.candidate_release_manifest_payload_digest,
    domain_key: result.domain_key,
    domain_result_definition_stable_id:
      result.domain_result_definition.stable_id,
    domain_result_definition_version:
      result.domain_result_definition.version,
    domain_result_identity: result.domain_result_identity,
  });
}

function exactCitation(domain, ir, result, ordinal = 1) {
  const config = DOMAINS[domain];
  const productResultIdentity =
    expectedProductResultIdentity(ir, result);
  const sourceDocumentIdentity =
    digest(`source-document:${domain}:${ordinal}`);
  const sourceEvidenceIdentity =
    digest(`source-evidence:${domain}:${ordinal}`);
  return {
    schema_version: PRODUCT_EXACT_CITATION_SCHEMA,
    source_document_identity: sourceDocumentIdentity,
    source_evidence_identity: sourceEvidenceIdentity,
    source_representation_kind: config.representation_kind,
    source_interval: domain === 'PROCESS'
      ? {
        start_utf8_byte: ordinal * 100,
        end_utf8_byte: (ordinal * 100)
          + Buffer.byteLength(result.domain_result_payload, 'utf8'),
        exact_text_digest: result.domain_result_payload_digest,
      }
      : null,
    result_component_evidence_identity: domain === 'PROCESS'
      ? null
      : digest(`component-evidence:${domain}:${ordinal}`),
    source_accession_or_equivalent_identity:
      `ACCESSION-${domain}-${ordinal}`,
    source_filing_type: domain === 'CVR' ? null : 'DEFM14A',
    source_filing_date: domain === 'CVR' ? null : '2025-09-22',
    source_location_label: `Section ${ordinal}.01`,
    human_readable_source_label:
      `${domain} source, Section ${ordinal}.01`,
    citation_target_identity: contentId(
      PRODUCT_EXACT_CITATION_SCHEMA,
      {
        product_query_result_identity: productResultIdentity,
        candidate_release_manifest_id:
          ir.release_contract.candidate_release_manifest_id,
        candidate_release_manifest_payload_digest:
          ir.release_contract
            .candidate_release_manifest_payload_digest,
        source_document_identity: sourceDocumentIdentity,
        source_evidence_identity: sourceEvidenceIdentity,
      },
    ),
  };
}

function admissionReceipt(
  ir,
  result,
  fields,
  {
    validatorAdmission = 'domain-validator-admission',
    states = {},
  } = {},
) {
  const body = {
    schema_version: PRODUCT_QUERY_RESULT_ADMISSION_RECEIPT_SCHEMA,
    product_query_definition_id: ir.query_definition_id,
    approved_pm_data_version_id:
      ir.release_contract.approved_pm_data_version_id,
    candidate_release_manifest_id:
      ir.release_contract.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      ir.release_contract.candidate_release_manifest_payload_digest,
    domain_key: result.domain_key,
    domain_result_definition: clone(result.domain_result_definition),
    domain_result_identity: result.domain_result_identity,
    domain_result_payload_digest:
      result.domain_result_payload_digest,
    domain_validator_admission_identity:
      digest(validatorAdmission),
    domain_validation_receipt_id:
      result.domain_result_validation.validation_receipt_id,
    query_coverage_identity:
      ir.coverage_contract.coverage_identity,
    covered_set_identity:
      ir.coverage_contract.covered_set_identity,
    query_cohort_identity:
      ir.cohort_contract.cohort_definition_id,
    predicate_evaluation_state:
      states.predicate || 'PASS',
    cohort_evaluation_state: states.cohort || 'PASS',
    filter_evaluation_state: states.filter || 'PASS',
    covered_set_membership_state:
      states.covered || 'PASS',
    requested_field_projection_identity:
      requestedFieldProjectionIdentity({
        queryIr: ir,
        domainResult: result,
        resultFields: fields,
      }),
    admission_state: PRODUCT_QUERY_RESULT_ADMISSION_STATE,
    authority_state: 'NOT_GRANTED',
  };
  return {
    schema_version: body.schema_version,
    admission_receipt_id: contentId(
      PRODUCT_QUERY_RESULT_ADMISSION_RECEIPT_SCHEMA,
      body,
    ),
    product_query_definition_id:
      body.product_query_definition_id,
    approved_pm_data_version_id:
      body.approved_pm_data_version_id,
    candidate_release_manifest_id:
      body.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      body.candidate_release_manifest_payload_digest,
    domain_key: body.domain_key,
    domain_result_definition: body.domain_result_definition,
    domain_result_identity: body.domain_result_identity,
    domain_result_payload_digest:
      body.domain_result_payload_digest,
    domain_validator_admission_identity:
      body.domain_validator_admission_identity,
    domain_validation_receipt_id:
      body.domain_validation_receipt_id,
    query_coverage_identity: body.query_coverage_identity,
    covered_set_identity: body.covered_set_identity,
    query_cohort_identity: body.query_cohort_identity,
    predicate_evaluation_state:
      body.predicate_evaluation_state,
    cohort_evaluation_state: body.cohort_evaluation_state,
    filter_evaluation_state: body.filter_evaluation_state,
    covered_set_membership_state:
      body.covered_set_membership_state,
    requested_field_projection_identity:
      body.requested_field_projection_identity,
    admission_state: body.admission_state,
    authority_state: body.authority_state,
  };
}

function fixture(domain = 'PROCESS', ordinal = 1, options = {}) {
  const ir = queryIr(domain);
  const result = domainResult(domain, ordinal);
  const fields = resultFields(domain);
  return {
    product_query_ir: ir,
    domain_result: result,
    result_fields: fields,
    exact_citation: exactCitation(domain, ir, result, ordinal),
    exact_detail_action: DOMAINS[domain].detail_action,
    admission_receipt:
      admissionReceipt(ir, result, fields, options),
  };
}

function compile(domain = 'PROCESS', ordinal = 1, options = {}) {
  return compileProductQueryResult(fixture(domain, ordinal, options));
}

function assertDeepFrozen(value) {
  if (!value || typeof value !== 'object') return;
  assert.equal(Object.isFrozen(value), true);
  Object.values(value).forEach(assertDeepFrozen);
}

function rehashReceipt(receipt) {
  const body = clone(receipt);
  delete body.admission_receipt_id;
  receipt.admission_receipt_id = contentId(
    PRODUCT_QUERY_RESULT_ADMISSION_RECEIPT_SCHEMA,
    body,
  );
  return receipt;
}

test('compiles one deterministic immutable Metsera Product result', () => {
  const first = compile();
  const second = compile();

  assert.deepEqual(first, second);
  assertDeepFrozen(first);
  assert.equal(first.schema_version, PRODUCT_QUERY_RESULT_SCHEMA);
  assert.equal(
    first.domain_result_payload,
    'On September 12, 2025, Metsera agreed to negotiate exclusively with Pfizer.',
  );
  assert.equal(validateProductQueryResult(first), true);
  assert.equal(
    canonicalProductQueryResultBytes(first).toString('utf8'),
    canonicalJson(first),
  );
  assert.equal(
    Object.hasOwn(first, 'admission_receipt'),
    false,
  );
});

test('uses one compiler for Agreement, Process and future CVR', () => {
  for (const domain of ['AGREEMENT', 'PROCESS', 'CVR']) {
    const result = compile(domain);
    assert.equal(result.domain_key, domain);
    assert.deepEqual(
      result.domain_result_definition,
      DOMAINS[domain].result_definition,
    );
    assert.equal(validateProductQueryResult(result), true);
  }
});

test('keeps the external admission receipt out of result identity', () => {
  const first = compile('PROCESS', 1, {
    validatorAdmission: 'validator-admission-one',
  });
  const second = compile('PROCESS', 1, {
    validatorAdmission: 'validator-admission-two',
  });

  assert.deepEqual(first, second);
  assert.equal(
    first.product_query_result_identity,
    second.product_query_result_identity,
  );
});

test('does not mutate the query, result, fields, citation or receipt', () => {
  const input = fixture('PROCESS');
  const before = clone(input);
  compileProductQueryResult(input);
  assert.deepEqual(input, before);
});

test('binds exact query, release, domain result and covered set', () => {
  const input = fixture();
  for (const [key, replacement] of [
    ['product_query_definition_id', digest('wrong-query')],
    ['candidate_release_manifest_id', digest('wrong-release')],
    ['domain_result_identity', digest('wrong-domain-result')],
    ['query_coverage_identity', digest('wrong-coverage')],
    ['covered_set_identity', digest('wrong-covered-set')],
    ['query_cohort_identity', digest('wrong-cohort')],
  ]) {
    const changed = clone(input);
    changed.admission_receipt[key] = replacement;
    rehashReceipt(changed.admission_receipt);
    assert.throws(
      () => compileProductQueryResult(changed),
      { code: 'INVALID_PRODUCT_QUERY_RESULT_COMPILER_INPUT' },
      key,
    );
  }
});

test('requires every query evaluation and membership state to pass', () => {
  for (const state of ['predicate', 'cohort', 'filter', 'covered']) {
    const input = fixture('PROCESS', 1, {
      states: { [state]: 'FAIL' },
    });
    assert.throws(
      () => compileProductQueryResult(input),
      { code: 'INVALID_PRODUCT_QUERY_RESULT_COMPILER_INPUT' },
      state,
    );
  }
});

test('rejects changed domain payload and external validator receipt', () => {
  const changedPayload = fixture();
  changedPayload.domain_result.domain_result_payload = 'Changed text.';
  assert.throws(
    () => compileProductQueryResult(changedPayload),
    { code: 'INVALID_PRODUCT_QUERY_RESULT_COMPILER_INPUT' },
  );

  const changedValidation = fixture();
  changedValidation.domain_result.domain_result_validation
    .validation_receipt_id = digest('wrong-validation-receipt');
  assert.throws(
    () => compileProductQueryResult(changedValidation),
    { code: 'INVALID_PRODUCT_QUERY_RESULT_COMPILER_INPUT' },
  );
});

test('rejects a missing, reordered or changed requested field projection', () => {
  const missing = fixture();
  missing.result_fields.pop();
  assert.throws(
    () => compileProductQueryResult(missing),
    { code: 'INVALID_PRODUCT_QUERY_RESULT_COMPILER_INPUT' },
  );

  const reordered = fixture();
  reordered.result_fields.reverse();
  assert.throws(
    () => compileProductQueryResult(reordered),
    { code: 'INVALID_PRODUCT_QUERY_RESULT_COMPILER_INPUT' },
  );

  const changed = fixture();
  changed.result_fields[1].value = 'POST_SIGNING';
  assert.throws(
    () => compileProductQueryResult(changed),
    { code: 'INVALID_PRODUCT_QUERY_RESULT_COMPILER_INPUT' },
  );
});

test('rejects an unadmitted detail action and citation drift', () => {
  const action = fixture();
  action.exact_detail_action = 'OTHER_ACTION';
  assert.throws(
    () => compileProductQueryResult(action),
    { code: 'INVALID_PRODUCT_QUERY_RESULT_COMPILER_INPUT' },
  );

  const citation = fixture();
  citation.exact_citation.source_document_identity =
    digest('wrong-source');
  assert.throws(
    () => compileProductQueryResult(citation),
    { code: 'INVALID_PRODUCT_QUERY_RESULT_COMPILER_INPUT' },
  );
});

test('rejects receipt identity drift and correctly rehashed failure states', () => {
  const identityDrift = fixture();
  identityDrift.admission_receipt.admission_receipt_id =
    digest('wrong-receipt');
  assert.throws(
    () => compileProductQueryResult(identityDrift),
    { code: 'INVALID_PRODUCT_QUERY_RESULT_COMPILER_INPUT' },
  );

  const rehashed = fixture();
  rehashed.admission_receipt.admission_state = 'FAIL';
  rehashReceipt(rehashed.admission_receipt);
  assert.throws(
    () => compileProductQueryResult(rehashed),
    { code: 'INVALID_PRODUCT_QUERY_RESULT_COMPILER_INPUT' },
  );
});

test('rejects extra receipt fields and forged authority', () => {
  const extra = fixture();
  extra.admission_receipt.legacy_authority = false;
  assert.throws(
    () => compileProductQueryResult(extra),
    { code: 'INVALID_PRODUCT_QUERY_RESULT_COMPILER_INPUT' },
  );

  const authority = fixture();
  authority.admission_receipt.authority_state = 'GRANTED';
  rehashReceipt(authority.admission_receipt);
  assert.throws(
    () => compileProductQueryResult(authority),
    { code: 'INVALID_PRODUCT_QUERY_RESULT_COMPILER_INPUT' },
  );
});

test('uses the exact signed Product result identity inputs', () => {
  const input = fixture('AGREEMENT');
  const result = compileProductQueryResult(input);
  assert.equal(
    result.product_query_result_identity,
    expectedProductResultIdentity(
      input.product_query_ir,
      input.domain_result,
    ),
  );
  assert.equal(
    result.query_provenance.coverage_contract.coverage_identity,
    input.product_query_ir.coverage_contract.coverage_identity,
  );
  assert.deepEqual(
    result.query_provenance.requested_field_references,
    input.product_query_ir.presentation_contract.requested_columns,
  );
});

test('defines the field projection as query, domain result and ordered values', () => {
  const input = fixture('PROCESS');
  const expected = contentId(
    PRODUCT_REQUESTED_FIELD_PROJECTION_SCHEMA,
    {
      product_query_definition_id:
        input.product_query_ir.query_definition_id,
      domain_result_identity:
        input.domain_result.domain_result_identity,
      ordered_result_fields: input.result_fields,
    },
  );
  assert.equal(
    input.admission_receipt.requested_field_projection_identity,
    expected,
  );
});

test('contains no query, source, model, network or database operation', () => {
  const source = fs.readFileSync(
    path.join(
      __dirname,
      '../lib/canonical-v2/product-query-result-compiler.js',
    ),
    'utf8',
  );
  for (const prohibited of [
    'fetch(',
    'XMLHttpRequest',
    'supabase',
    'openai',
    'anthropic',
    'readFile',
    'writeFile',
  ]) {
    assert.equal(source.includes(prohibited), false, prohibited);
  }
});
