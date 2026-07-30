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
  PRODUCT_ACTIVE_RELEASE_RESOLUTION_SCHEMA,
} = require('../lib/canonical-v2/product-rerun-compiler');
const {
  PRODUCT_CITATION_AND_SHARE_ACTION_SCHEMA,
  PRODUCT_CITATION_AND_SHARE_REFUSAL_SCHEMA,
  PRODUCT_DOMAIN_RESULT_VALIDATION_SCHEMA,
  PRODUCT_EXACT_CITATION_SCHEMA,
  PRODUCT_QUERY_RESULT_SCHEMA,
  PRODUCT_RESULT_ACTION_OWNER_BINDING_SCHEMA,
  PRODUCT_SHARE_REFERENCE_SCHEMA,
  canonicalProductCitationAndShareOutcomeBytes,
  compileProductCitationAndShareAction,
  validateProductCitationAndShareOutcome,
  validateProductQueryResult,
} = require('../lib/canonical-v2/product-citation-share-compiler');
const {
  PRODUCT_SELECTED_RESULT_EXPORT_PAYLOAD_SCHEMA,
  PRODUCT_SELECTED_RESULT_EXPORT_REFUSAL_SCHEMA,
  canonicalProductSelectedResultExportBytes,
  compileProductSelectedResultExport,
  validateProductSelectedResultExportOutcome,
} = require(
  '../lib/canonical-v2/product-selected-result-export-compiler',
);

const DOMAIN_FACTS = Object.freeze({
  AGREEMENT: Object.freeze({
    result_definition: Object.freeze({
      stable_id: 'AGREEMENT_COMPARABLE_RESULT',
      version: 1,
    }),
    field_key: 'seller_termination_fee_percent',
    exact_detail_action: 'RESULT_COMPONENT_CLAIM_EVIDENCE',
    representation_kind: 'STRUCTURED_RESULT',
  }),
  CVR: Object.freeze({
    result_definition: Object.freeze({
      stable_id: 'CVR_MILESTONE_RESULT',
      version: 1,
    }),
    field_key: 'cvr_milestone_status',
    exact_detail_action: 'RESULT_COMPONENT_CLAIM_EVIDENCE',
    representation_kind: 'STRUCTURED_RESULT',
  }),
  PROCESS: Object.freeze({
    result_definition: Object.freeze({
      stable_id: 'PROCESS_PHRASEBOOK_PASSAGE_RESULT',
      version: 1,
    }),
    field_key: 'process_phase',
    exact_detail_action: 'PARENT_BOUND_PARAGRAPH_CONTEXT',
    representation_kind: 'VERBATIM_TEXT',
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

function fieldReference(fieldKey, version = 1) {
  return {
    field_key: fieldKey,
    field_version: version,
  };
}

function ownerBinding(label = 'owner') {
  return {
    schema_version: PRODUCT_RESULT_ACTION_OWNER_BINDING_SCHEMA,
    actor_principal_id: 'BEN_GOODCHILD',
    object_authorisation_binding_id: digest(`owner:${label}`),
    runtime_authorisation_state: 'REQUIRED_BEFORE_USE',
  };
}

function activeRelease(release = 'ONE') {
  const body = {
    schema_version: PRODUCT_ACTIVE_RELEASE_RESOLUTION_SCHEMA,
    active_fence_identity: digest(`active-fence:${release}`),
    candidate_release_manifest_id: digest(`release:${release}`),
    candidate_release_manifest_payload_digest:
      digest(`release-payload:${release}`),
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

function productResult(
  domain = 'AGREEMENT',
  release = 'ONE',
  ordinal = 1,
) {
  const facts = DOMAIN_FACTS[domain];
  const payload = facts.representation_kind === 'VERBATIM_TEXT'
    ? `Exact ${domain} source passage ${ordinal}.`
    : {
      canonical_value: `${domain}_VALUE_${ordinal}`,
      state: 'PRESENT',
    };
  const payloadDigest = sha256Hex(
    Buffer.from(canonicalJson(payload), 'utf8'),
  );
  const validationBody = {
    validator_stable_id: `${domain}_RESULT_VALIDATOR`,
    validator_version: 1,
    validated_payload_digest: payloadDigest,
    validation_state: 'EXTERNALLY_VALIDATED',
  };
  const domainValidation = {
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
  };
  const identityInputs = {
    schema_version: PRODUCT_QUERY_RESULT_SCHEMA,
    product_query_definition_id:
      digest(`query:${domain}:${release}`),
    approved_pm_data_version_id: digest(`pm-data:${release}`),
    candidate_release_manifest_id: digest(`release:${release}`),
    candidate_release_manifest_payload_digest:
      digest(`release-payload:${release}`),
    domain_key: domain,
    domain_result_definition_stable_id:
      facts.result_definition.stable_id,
    domain_result_definition_version:
      facts.result_definition.version,
    domain_result_identity:
      digest(`domain-result:${domain}:${release}:${ordinal}`),
  };
  const productResultIdentity = contentId(
    PRODUCT_QUERY_RESULT_SCHEMA,
    identityInputs,
  );
  const sourceDocumentIdentity = digest(
    `source-document:${domain}:${ordinal}`,
  );
  const sourceEvidenceIdentity = digest(
    `source-evidence:${domain}:${ordinal}`,
  );
  const citationTargetIdentity = contentId(
    PRODUCT_EXACT_CITATION_SCHEMA,
    {
      product_query_result_identity: productResultIdentity,
      candidate_release_manifest_id:
        identityInputs.candidate_release_manifest_id,
      candidate_release_manifest_payload_digest:
        identityInputs.candidate_release_manifest_payload_digest,
      source_document_identity: sourceDocumentIdentity,
      source_evidence_identity: sourceEvidenceIdentity,
    },
  );
  const exactCitation = {
    schema_version: PRODUCT_EXACT_CITATION_SCHEMA,
    source_document_identity: sourceDocumentIdentity,
    source_evidence_identity: sourceEvidenceIdentity,
    source_representation_kind: facts.representation_kind,
    source_interval: facts.representation_kind === 'VERBATIM_TEXT'
      ? {
        start_utf8_byte: 100 * ordinal,
        end_utf8_byte: (100 * ordinal) + 50,
        exact_text_digest: sha256Hex(Buffer.from(payload, 'utf8')),
      }
      : null,
    result_component_evidence_identity:
      facts.representation_kind === 'STRUCTURED_RESULT'
        ? digest(`component-evidence:${domain}:${ordinal}`)
        : null,
    source_accession_or_equivalent_identity:
      `ACCESSION-${domain}-${ordinal}`,
    source_filing_type: domain === 'CVR' ? null : 'DEFM14A',
    source_filing_date: domain === 'CVR' ? null : '2026-07-29',
    source_location_label: `Section ${ordinal}.01`,
    human_readable_source_label:
      `${domain} agreement, Section ${ordinal}.01`,
    citation_target_identity: citationTargetIdentity,
  };
  const filterContract = {
    clauses: [{
      field_key: facts.field_key,
      field_version: 1,
      operator: 'EQ',
      value: `${domain}_FILTER`,
    }],
  };
  const coverageContract = {
    coverage_identity: digest(`coverage:${domain}:${release}`),
    covered_set_identity: digest(`covered:${domain}:${release}`),
    exclusions_identity: digest(`exclusions:${domain}:${release}`),
  };
  const requestedFields = [
    fieldReference(facts.field_key),
    fieldReference('deal_name'),
  ];
  return {
    schema_version: PRODUCT_QUERY_RESULT_SCHEMA,
    product_query_result_identity: productResultIdentity,
    product_query_definition_id:
      identityInputs.product_query_definition_id,
    approved_pm_data_version_id:
      identityInputs.approved_pm_data_version_id,
    candidate_release_manifest_id:
      identityInputs.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      identityInputs.candidate_release_manifest_payload_digest,
    domain_key: domain,
    domain_result_definition: clone(facts.result_definition),
    domain_result_identity:
      identityInputs.domain_result_identity,
    domain_result_payload: payload,
    domain_result_payload_digest: payloadDigest,
    domain_result_validation: domainValidation,
    domain_result_source_representation_kind:
      facts.representation_kind,
    exact_citation: exactCitation,
    exact_detail_action: facts.exact_detail_action,
    query_provenance: {
      filter_contract: filterContract,
      filter_contract_digest: sha256Hex(
        Buffer.from(canonicalJson(filterContract), 'utf8'),
      ),
      coverage_contract: coverageContract,
      coverage_contract_digest: sha256Hex(
        Buffer.from(canonicalJson(coverageContract), 'utf8'),
      ),
      requested_field_references: requestedFields,
    },
    result_fields: [
      {
        field_reference: clone(requestedFields[0]),
        value: `${domain}_VALUE_${ordinal}`,
      },
      {
        field_reference: clone(requestedFields[1]),
        value: `${domain} DEAL ${ordinal}`,
      },
    ],
  };
}

function compileAction(
  domain = 'AGREEMENT',
  actionKind = 'CITATION',
  release = 'ONE',
  ordinal = 1,
) {
  return compileProductCitationAndShareAction({
    product_query_result:
      productResult(domain, release, ordinal),
    active_release_resolution: activeRelease(release),
    action_kind: actionKind,
    object_authorisation_binding:
      ownerBinding(`${domain}:${actionKind}`),
  });
}

function actionIdentityPayload(action) {
  return {
    schema_version: action.schema_version,
    action_kind: action.action_kind,
    product_query_result_identity:
      action.product_query_result_identity,
    product_query_definition_id:
      action.product_query_definition_id,
    approved_pm_data_version_id:
      action.approved_pm_data_version_id,
    candidate_release_manifest_id:
      action.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      action.candidate_release_manifest_payload_digest,
    domain_key: action.domain_key,
    domain_result_identity: action.domain_result_identity,
    active_release_resolution_id:
      action.active_release_resolution_id,
    object_authorisation_binding:
      action.object_authorisation_binding,
    exact_citation: action.exact_citation,
    copy_payload: action.copy_payload,
  };
}

function exportPayloadDigestPayload(payload) {
  const body = clone(payload);
  delete body.product_selected_result_export_id;
  delete body.canonical_payload_digest;
  return body;
}

test('validates one exact Product result without materialising it', () => {
  for (const domain of ['AGREEMENT', 'PROCESS', 'CVR']) {
    assert.equal(validateProductQueryResult(productResult(domain)), true);
  }
});

test('validates canonical Product payload and raw UTF-8 citation digests separately', () => {
  const result = productResult('PROCESS');
  const rawUtf8Digest = sha256Hex(
    Buffer.from(result.domain_result_payload, 'utf8'),
  );
  const canonicalPayloadDigest = sha256Hex(
    Buffer.from(canonicalJson(result.domain_result_payload), 'utf8'),
  );

  assert.notEqual(rawUtf8Digest, canonicalPayloadDigest);
  assert.equal(
    result.domain_result_payload_digest,
    canonicalPayloadDigest,
  );
  assert.equal(
    result.exact_citation.source_interval.exact_text_digest,
    rawUtf8Digest,
  );
  assert.equal(validateProductQueryResult(result), true);

  const canonicalDigestSubstitutedForRaw = clone(result);
  canonicalDigestSubstitutedForRaw.exact_citation.source_interval
    .exact_text_digest = canonicalPayloadDigest;
  assert.throws(
    () => validateProductQueryResult(canonicalDigestSubstitutedForRaw),
    { code: 'INVALID_PRODUCT_QUERY_RESULT' },
  );

  const rawDigestSubstitutedForCanonical = clone(result);
  rawDigestSubstitutedForCanonical.domain_result_payload_digest =
    rawUtf8Digest;
  assert.throws(
    () => validateProductQueryResult(rawDigestSubstitutedForCanonical),
    { code: 'INVALID_PRODUCT_QUERY_RESULT' },
  );
});

test('compiles an immutable release-pinned citation action', () => {
  const first = compileAction();
  const second = compileAction();

  assert.deepEqual(first, second);
  assertDeepFrozen(first);
  assert.equal(
    first.schema_version,
    PRODUCT_CITATION_AND_SHARE_ACTION_SCHEMA,
  );
  assert.equal(first.action_kind, 'CITATION');
  assert.equal(first.copy_payload, null);
  assert.equal(first.share_reference, null);
  assert.equal(first.execution_state, 'NOT_EXECUTED');
  assert.equal(first.authority_state, 'NOT_GRANTED');
  assert.equal(
    canonicalProductCitationAndShareOutcomeBytes(first).toString('utf8'),
    canonicalJson(first),
  );
});

test('copies only the exact domain payload and exact citation', () => {
  const action = compileAction('PROCESS', 'COPY');
  const source = productResult('PROCESS');

  assert.equal(action.action_kind, 'COPY');
  assert.deepEqual(
    action.copy_payload.exact_domain_result_payload,
    source.domain_result_payload,
  );
  assert.deepEqual(
    action.copy_payload.exact_citation,
    source.exact_citation,
  );
  assert.equal(action.share_reference, null);
});

test('makes a share reference release-bound and non-authorising', () => {
  const action = compileAction('AGREEMENT', 'SHARE');

  assert.equal(
    action.share_reference.schema_version,
    PRODUCT_SHARE_REFERENCE_SCHEMA,
  );
  assert.equal(action.share_reference.action_id, action.action_id);
  assert.equal(action.share_reference.bearer_authorisation, false);
  assert.equal(
    action.share_reference.runtime_authorisation_state,
    'REQUIRED_ON_OPEN',
  );
});

test('uses the same action schema for Agreement, Process and later CVR', () => {
  const actions = ['AGREEMENT', 'PROCESS', 'CVR'].map(
    (domain) => compileAction(domain, 'CITATION'),
  );

  assert.deepEqual(
    actions.map((action) => action.schema_version),
    [
      PRODUCT_CITATION_AND_SHARE_ACTION_SCHEMA,
      PRODUCT_CITATION_AND_SHARE_ACTION_SCHEMA,
      PRODUCT_CITATION_AND_SHARE_ACTION_SCHEMA,
    ],
  );
  assert.deepEqual(
    actions.map((action) => action.domain_key),
    ['AGREEMENT', 'PROCESS', 'CVR'],
  );
});

test('returns a typed refusal for an inactive release', () => {
  const outcome = compileProductCitationAndShareAction({
    product_query_result: productResult('AGREEMENT', 'OLD'),
    active_release_resolution: activeRelease('NEW'),
    action_kind: 'SHARE',
    object_authorisation_binding: ownerBinding('inactive'),
  });

  assert.equal(
    outcome.schema_version,
    PRODUCT_CITATION_AND_SHARE_REFUSAL_SCHEMA,
  );
  assert.equal(outcome.disposition, 'RELEASE_NOT_ACTIVE');
  assert.equal(outcome.original_result_preserved, true);
  assert.equal(outcome.authority_state, 'NOT_GRANTED');
});

test('rejects Product result and citation identity drift', () => {
  const changedResult = productResult();
  changedResult.product_query_definition_id = digest('wrong-query');
  assert.throws(
    () => validateProductQueryResult(changedResult),
    { code: 'INVALID_PRODUCT_QUERY_RESULT' },
  );

  const changedCitation = productResult();
  changedCitation.exact_citation.source_evidence_identity =
    digest('wrong-evidence');
  assert.throws(
    () => validateProductQueryResult(changedCitation),
    { code: 'INVALID_PRODUCT_QUERY_RESULT' },
  );

  const changedText = productResult('PROCESS');
  changedText.exact_citation.source_interval.exact_text_digest =
    digest('different-source-text');
  assert.throws(
    () => validateProductQueryResult(changedText),
    { code: 'INVALID_PRODUCT_QUERY_RESULT' },
  );
});

test('rejects a correctly rehashed nested action authority forgery', () => {
  const action = clone(compileAction());
  action.object_authorisation_binding.invented_authority = true;
  action.action_id = contentId(
    PRODUCT_CITATION_AND_SHARE_ACTION_SCHEMA,
    actionIdentityPayload(action),
  );

  assert.throws(
    () => validateProductCitationAndShareOutcome(action),
    { code: 'INVALID_PRODUCT_RESULT_ACTION_OWNER' },
  );
});

test('exports an exact selected subset in query order', () => {
  const results = [
    productResult('AGREEMENT', 'ONE', 1),
    productResult('AGREEMENT', 'ONE', 2),
    productResult('AGREEMENT', 'ONE', 3),
  ];
  const selected = [
    results[0].product_query_result_identity,
    results[2].product_query_result_identity,
  ];
  const requested = [fieldReference('deal_name')];
  const output = compileProductSelectedResultExport({
    product_query_results: results,
    ordered_selected_product_result_identities: selected,
    ordered_requested_field_references: requested,
    active_release_resolution: activeRelease('ONE'),
    object_authorisation_binding: ownerBinding('export'),
  });

  assertDeepFrozen(output);
  assert.equal(
    output.schema_version,
    PRODUCT_SELECTED_RESULT_EXPORT_PAYLOAD_SCHEMA,
  );
  assert.deepEqual(
    output.results.map(
      (result) => result.product_query_result_identity,
    ),
    selected,
  );
  assert.deepEqual(
    output.results.map((result) => result.fields[0].value),
    ['AGREEMENT DEAL 1', 'AGREEMENT DEAL 3'],
  );
  assert.equal(output.selected_result_count, 2);
  assert.equal(output.emitted_result_count, 2);
  assert.equal(output.render_state, 'CANONICAL_PAYLOAD_ONLY');
  assert.equal(output.authority_state, 'NOT_GRANTED');
  assert.equal(
    canonicalProductSelectedResultExportBytes(output).toString('utf8'),
    canonicalJson(output),
  );
});

test('refuses a field outside the checked Product result', () => {
  const result = productResult();
  const output = compileProductSelectedResultExport({
    product_query_results: [result],
    ordered_selected_product_result_identities: [
      result.product_query_result_identity,
    ],
    ordered_requested_field_references: [
      fieldReference('physical_database_id'),
    ],
    active_release_resolution: activeRelease(),
    object_authorisation_binding: ownerBinding('wrong-field'),
  });

  assert.equal(
    output.schema_version,
    PRODUCT_SELECTED_RESULT_EXPORT_REFUSAL_SCHEMA,
  );
  assert.equal(output.disposition, 'FIELD_NOT_IN_CHECKED_RESULT');
  assert.equal(output.emitted_result_count, 0);
  assert.equal(output.partial_export_permitted, false);
});

test('refuses a missing selected result without a partial export', () => {
  const result = productResult();
  const missingId = digest('missing-result');
  const output = compileProductSelectedResultExport({
    product_query_results: [result],
    ordered_selected_product_result_identities: [
      result.product_query_result_identity,
      missingId,
    ],
    ordered_requested_field_references: [
      fieldReference('deal_name'),
    ],
    active_release_resolution: activeRelease(),
    object_authorisation_binding: ownerBinding('missing-result'),
  });

  assert.equal(output.disposition, 'RESULT_NOT_IN_PINNED_RELEASE');
  assert.equal(output.emitted_result_count, 0);
  assert.equal(output.partial_export_permitted, false);
});

test('refuses export from an inactive release', () => {
  const result = productResult('PROCESS', 'OLD');
  const output = compileProductSelectedResultExport({
    product_query_results: [result],
    ordered_selected_product_result_identities: [
      result.product_query_result_identity,
    ],
    ordered_requested_field_references: [
      fieldReference('deal_name'),
    ],
    active_release_resolution: activeRelease('NEW'),
    object_authorisation_binding: ownerBinding('inactive-export'),
  });

  assert.equal(output.disposition, 'RELEASE_NOT_ACTIVE');
  assert.equal(output.authority_state, 'NOT_GRANTED');
});

test('rejects selection reordered against the query result set', () => {
  const first = productResult('AGREEMENT', 'ONE', 1);
  const second = productResult('AGREEMENT', 'ONE', 2);
  assert.throws(
    () => compileProductSelectedResultExport({
      product_query_results: [first, second],
      ordered_selected_product_result_identities: [
        second.product_query_result_identity,
        first.product_query_result_identity,
      ],
      ordered_requested_field_references: [
        fieldReference('deal_name'),
      ],
      active_release_resolution: activeRelease(),
      object_authorisation_binding:
        ownerBinding('reordered-export'),
    }),
    { code: 'INVALID_PRODUCT_SELECTED_RESULT_EXPORT_INPUT' },
  );
});

test('rejects a correctly rehashed nested export authority forgery', () => {
  const result = productResult();
  const output = compileProductSelectedResultExport({
    product_query_results: [result],
    ordered_selected_product_result_identities: [
      result.product_query_result_identity,
    ],
    ordered_requested_field_references: [
      fieldReference('deal_name'),
    ],
    active_release_resolution: activeRelease(),
    object_authorisation_binding: ownerBinding('forged-export'),
  });
  const forged = clone(output);
  forged.results[0].exact_citation.invented_authority = true;
  forged.canonical_payload_digest = sha256Hex(Buffer.from(
    canonicalJson(exportPayloadDigestPayload(forged)),
    'utf8',
  ));

  assert.throws(
    () => validateProductSelectedResultExportOutcome(forged),
    { code: 'INVALID_PRODUCT_EXACT_CITATION' },
  );
});

test('contains no source reader, data, network or rendering path', () => {
  const files = [
    'lib/canonical-v2/product-citation-share-compiler.js',
    'lib/canonical-v2/product-selected-result-export-compiler.js',
  ];
  const source = files.map((file) => fs.readFileSync(
    path.join(__dirname, '..', file),
    'utf8',
  )).join('\n');

  assert.doesNotMatch(source, /\bfetch\s*\(/);
  assert.doesNotMatch(source, /\bprocess\.env\b/);
  assert.doesNotMatch(source, /\bcreateClient\s*\(/);
  assert.doesNotMatch(source, /\bINSERT\b|\bUPDATE\b|\bDELETE\b/);
  assert.doesNotMatch(source, /\bpdf\b|\bclipboard\b/i);
});
