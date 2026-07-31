const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');

const {
  canonicalJson,
  contentId,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  F24_BUNDLE_DIGEST,
  F24_BUNDLE_ID,
  F24_MANIFEST_DIGEST,
  F24_MANIFEST_ID,
  F24_REGISTRY_ID,
  NOTICE_TRIGGER_CODES,
  __test,
  prepareTimingCertificationsForRendering,
  resolveMetricServingAdmissionF24,
  validateF24EnvelopeIdentity,
} = require(
  '../lib/canonical-v2/no-shop-timing-certification-f24'
);

const FIXTURE =
  'tests/fixtures/canonical-v2/qxo-no-shop-timing-f24-staging-attestation.json';
const RUNNER =
  'scripts/canonical-v2-staging-qxo-no-shop-clock-attestation.mjs';
const HISTORICAL_SNAPSHOTS = Object.freeze({
  'tests/fixtures/canonical-v2/qxo-no-shop-copy-delivery-release-f23-staging-attestation.json':
    '3b0fb494b0ff9386b2e7a4a9b96583e1077c7cdb06593066851b61527f65ef81',
  'lib/canonical-v2/metric-scoped-candidate-release-f23.js':
    '41a7cb83d356bc5be43ebb4823e10672dd690ba672c413529772729576aa8951',
  'lib/canonical-v2/metric-serving-admission.js':
    'c771279c8ff9dded8f676cd51e514f3cd90808558dccdd00db5e1bd9603088c9',
  'lib/canonical-v2/market-cohort-query.js':
    '01f42bd1afb7764d1b43278b3f64f8a01f1adf29a9ea3b76ee28e2391d0a6ae9',
  'lib/canonical-v2/shared-serving-row.js':
    'd7ae7d8caefa524f2089b1c881fbf254d1823a2a98b4460691df0cd6ad62eef1',
});

function fixture() {
  return JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
}

function bundle() {
  return fixture().timing_certification_bundle;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function byMetric(value = bundle()) {
  return new Map(value.timing_certifications.map(
    (entry) => [entry.observation.metric_key, entry],
  ));
}

function hashFile(path) {
  return crypto.createHash('sha256')
    .update(fs.readFileSync(path))
    .digest('hex');
}

function f24RunnerSection() {
  const source = fs.readFileSync(RUNNER, 'utf8');
  return source.slice(
    source.indexOf('// F24_ROLLBACK_ONLY_STAGING_CERTIFICATION_BEGIN'),
    source.indexOf('// F24_ROLLBACK_ONLY_STAGING_CERTIFICATION_END'),
  );
}

function resignCarrier(carrier) {
  const value = clone(carrier);
  const observationBody = clone(value.observation);
  delete observationBody.canonical_payload_digest;
  value.observation.canonical_payload_digest = contentId(
    'F24_TIMING_OBSERVATION_PAYLOAD/V1',
    observationBody,
  );
  const queryBody = clone(value.query_projection);
  delete queryBody.canonical_payload_digest;
  value.query_projection.canonical_payload_digest = contentId(
    'QUERY_PROJECTION_RECORD_PAYLOAD/V5',
    queryBody,
  );
  const carrierBody = clone(value);
  delete carrierBody.timing_metric_certification_id;
  delete carrierBody.canonical_payload_digest;
  value.timing_metric_certification_id = contentId(
    'NO_SHOP_TIMING_METRIC_CERTIFICATION_F24/V1',
    carrierBody,
  );
  value.canonical_payload_digest = contentId(
    'NO_SHOP_TIMING_METRIC_CERTIFICATION_F24_PAYLOAD/V1',
    carrierBody,
  );
  return value;
}

function resignEnvelope(value) {
  value.manifest.roots.timing_certification_root = contentId(
    'F24_TIMING_CERTIFICATION_ROOT/V1',
    value.timing_certifications.map(
      (entry) => entry.timing_metric_certification_id,
    ),
  );
  value.manifest.roots.observation_root = contentId(
    'F24_TIMING_OBSERVATION_ROOT/V1',
    value.timing_certifications.map(
      (entry) => entry.observation.canonical_payload_digest,
    ),
  );
  value.manifest.roots.query_projection_root = contentId(
    'F24_TIMING_QUERY_PROJECTION_ROOT/V1',
    value.timing_certifications.map(
      (entry) => entry.query_projection.canonical_payload_digest,
    ),
  );
  const manifestBody = clone(value.manifest);
  delete manifestBody.no_shop_timing_certification_manifest_f24_id;
  delete manifestBody.canonical_payload_digest;
  value.manifest.no_shop_timing_certification_manifest_f24_id =
    contentId(
      'NO_SHOP_TIMING_CERTIFICATION_MANIFEST_F24/V1',
      manifestBody,
    );
  value.manifest.canonical_payload_digest = contentId(
    'NO_SHOP_TIMING_CERTIFICATION_MANIFEST_F24_PAYLOAD/V1',
    manifestBody,
  );
  const bundleBody = clone(value);
  delete bundleBody.no_shop_timing_certification_bundle_f24_id;
  delete bundleBody.canonical_payload_digest;
  value.no_shop_timing_certification_bundle_f24_id = contentId(
    'NO_SHOP_TIMING_CERTIFICATION_BUNDLE_F24/V1',
    bundleBody,
  );
  value.canonical_payload_digest = contentId(
    'NO_SHOP_TIMING_CERTIFICATION_BUNDLE_F24_PAYLOAD/V1',
    bundleBody,
  );
  return value;
}

test('F24 attestation, bundle, manifest and registry identities are exact', () => {
  const value = fixture();
  const {
    qxo_no_shop_timing_f24_staging_attestation_id: id,
    canonical_payload_digest: digest,
    ...body
  } = value;
  assert.equal(
    id,
    contentId(
      'QXO_NO_SHOP_TIMING_F24_STAGING_ATTESTATION/V1',
      body,
    ),
  );
  assert.equal(
    digest,
    contentId(
      'QXO_NO_SHOP_TIMING_F24_STAGING_ATTESTATION_PAYLOAD/V1',
      body,
    ),
  );
  assert.equal(
    id,
    'b785b0c04f51037155b9629c6064e92525945d49d097e75e84cf46af82da8bb3',
  );
  assert.equal(
    digest,
    '1d53e6ea819208dce825e5d6ac09e60a1dbd1868d215af5b281dc03046e02fd4',
  );
  assert.equal(
    value.timing_certification_bundle
      .no_shop_timing_certification_bundle_f24_id,
    F24_BUNDLE_ID,
  );
  assert.equal(
    value.timing_certification_bundle.canonical_payload_digest,
    F24_BUNDLE_DIGEST,
  );
  assert.equal(
    value.timing_certification_bundle.manifest
      .no_shop_timing_certification_manifest_f24_id,
    F24_MANIFEST_ID,
  );
  assert.equal(
    value.timing_certification_bundle.manifest
      .canonical_payload_digest,
    F24_MANIFEST_DIGEST,
  );
  assert.equal(
    value.timing_certification_bundle.registry
      .metric_serving_admission_registry_id,
    F24_REGISTRY_ID,
  );
  assert.equal(
    validateF24EnvelopeIdentity(
      value.timing_certification_bundle,
    ),
    true,
  );
});

test('24 raw elapsed hours become one day without losing source units', () => {
  const notice = byMetric().get(
    'NO_SHOP_NOTICE_PERIOD_DAYS',
  );
  assert.deepEqual(notice.observation.raw_value, {
    text: 'twenty-four (24) hours after receipt',
    magnitude: '24',
    unit: 'HOURS',
    day_basis: 'ELAPSED',
  });
  assert.equal(notice.observation.canonical_value, '1');
  assert.equal(notice.observation.canonical_unit, 'DAYS');
  assert.equal(notice.observation.day_basis, 'ELAPSED');
  assert.equal(
    notice.observation.basis_key,
    'DAYS:ELAPSED:RECEIPT_OF_COMPETING_PROPOSAL',
  );
  assert.equal(
    notice.query_projection.raw_value.unit,
    'HOURS',
  );
});

test('notice binds the authoritative proposal-or-request trigger and source-local plural', () => {
  const notice = byMetric().get(
    'NO_SHOP_NOTICE_PERIOD_DAYS',
  );
  const policy = notice.interpretation_policy;
  assert.equal(policy.clarity_state, 'CLEAR');
  assert.deepEqual(policy.ambiguity_dimension_codes, []);
  assert.equal(
    policy.metric_trigger_projection,
    'LEGACY_GENERIC_RECEIPT_OF_COMPETING_PROPOSAL',
  );
  assert.equal(policy.source_legal_trigger.operator, 'ANY_OF');
  assert.deepEqual(
    policy.source_legal_trigger.operand_codes,
    NOTICE_TRIGGER_CODES,
  );
  assert.equal(
    policy.source_legal_trigger.operand_sufficiency,
    'EACH_OPERAND_INDEPENDENTLY_SUFFICIENT',
  );
  assert.equal(
    policy.source_legal_trigger.application_scope_code,
    'EACH_SATISFYING_TRIGGER_OCCURRENCE',
  );
  assert.equal(policy.temporal_operator, 'CEILING');
  assert.deepEqual(policy.qualifier_codes, [
    'PROMPTLY',
    'NO_LATER_THAN_24_ELAPSED_HOURS',
  ]);
  assert.deepEqual(policy.definition_treatment, {
    controlling_term: 'Company Request',
    plural_source_form: 'Company Requests',
    plural_resolution:
      'SOURCE_LOCAL_INFLECTION_OF_SINGULAR_DEFINITION',
    alias_authority: 'NONE',
    definition_scope_closure_id:
      '58d8f42f20fc8be31af4a1b7b2e57a17b4da60894bffe61cb8ee5babacc76b17',
    definition_use_relationship_set_digest:
      '039429474c7fd7e47aa20c12bc27583d8062f35dc50be15df9d721e73616675b',
  });
  assert.equal(policy.lawyer_warning.required, false);
});

test('source closure includes the exact admitted semantic context identity', () => {
  const canonicalText = 'source payload outside the governed section';
  const canonicalTextSha256 = crypto.createHash('sha256')
    .update(canonicalText)
    .digest('hex');
  const sourceBody = {
    schema_version: 'ADMITTED_SEMANTIC_SOURCE_CONTEXT/V1',
    document_hash:
      'abba043018410d718c207e7d7a43c9567166f6a10c4c9a6b4b0c8c7761cd6b9d',
    governed_deal_key: 'deal:qxo-topbuild',
    source_ordinal: 0,
    immutable_source_document_id: '1'.repeat(64),
    source_admission_manifest_id: '2'.repeat(64),
    semantic_extraction_input_envelope_id: '3'.repeat(64),
    source_content_id: '4'.repeat(64),
    converter_digest: '5'.repeat(64),
    converter_config_digest: '6'.repeat(64),
    source_map_digest: '7'.repeat(64),
    canonical_text_sha256: canonicalTextSha256,
    canonical_text_byte_length: Buffer.byteLength(canonicalText),
    canonical_text: {
      schema_version: 'ADMITTED_CANONICAL_TEXT_RUNTIME/V1',
      canonical_text_id: null,
      text: canonicalText,
    },
  };
  sourceBody.canonical_text_id = contentId(
    'SEC_CANONICAL_TEXT/V2',
    {
      source_response_content_id: sourceBody.source_content_id,
      converter_digest: sourceBody.converter_digest,
      converter_config_digest: sourceBody.converter_config_digest,
      canonical_text_sha256: sourceBody.canonical_text_sha256,
      canonical_text_byte_length:
        sourceBody.canonical_text_byte_length,
      source_map_digest: sourceBody.source_map_digest,
    },
  );
  sourceBody.canonical_text.canonical_text_id =
    sourceBody.canonical_text_id;
  const source = {
    ...sourceBody,
    admitted_semantic_source_context_id: contentId(
      'ADMITTED_SEMANTIC_SOURCE_CONTEXT/V1',
      sourceBody,
    ),
  };
  const f15 = {
    source_binding: {
      admitted_semantic_source_context_id:
        '9'.repeat(64),
      document_hash: source.document_hash,
      governed_deal_key: source.governed_deal_key,
      source_ordinal: source.source_ordinal,
      immutable_source_document_id:
        source.immutable_source_document_id,
      source_admission_manifest_id:
        source.source_admission_manifest_id,
      semantic_extraction_input_envelope_id:
        source.semantic_extraction_input_envelope_id,
      canonical_text_id: source.canonical_text_id,
    },
  };
  assert.notEqual(
    source.admitted_semantic_source_context_id,
    f15.source_binding.admitted_semantic_source_context_id,
  );
  assert.equal(__test.sourceBindingMatches(source, f15), true);
  source.canonical_text.text = 'mutated ignored source payload';
  source.canonical_text_sha256 = crypto.createHash('sha256')
    .update(source.canonical_text.text)
    .digest('hex');
  source.canonical_text_byte_length =
    Buffer.byteLength(source.canonical_text.text);
  const resignedBody = clone(source);
  delete resignedBody.admitted_semantic_source_context_id;
  source.admitted_semantic_source_context_id = contentId(
    'ADMITTED_SEMANTIC_SOURCE_CONTEXT/V1',
    resignedBody,
  );
  assert.equal(
    __test.sourceContextIdentityMatches(source),
    true,
  );
  assert.equal(__test.sourceBindingMatches(source, f15), false);
});

test('initial and subsequent match periods remain distinct legal cohorts', () => {
  const records = byMetric();
  const initial = records.get(
    'NO_SHOP_INITIAL_MATCH_PERIOD_DAYS',
  );
  const subsequent = records.get(
    'NO_SHOP_SUBSEQUENT_MATCH_PERIOD_DAYS',
  );
  assert.equal(initial.observation.canonical_value, '4');
  assert.equal(subsequent.observation.canonical_value, '4');
  assert.equal(initial.observation.day_basis, 'BUSINESS');
  assert.equal(subsequent.observation.day_basis, 'BUSINESS');
  assert.equal(
    initial.observation.source_legal_trigger.code,
    'SUPERIOR_PROPOSAL_NOTICE',
  );
  assert.equal(
    subsequent.observation.source_legal_trigger.code,
    'EACH_MATERIAL_AMENDMENT_TO_SUPERIOR_PROPOSAL',
  );
  assert.equal(
    subsequent.observation.source_legal_trigger
      .application_scope_code,
    'EACH_MATERIAL_AMENDMENT',
  );
  assert.notEqual(
    initial.observation.comparability_class_digest,
    subsequent.observation.comparability_class_digest,
  );
  assert.notEqual(
    initial.cohort_request.cohort_digest,
    subsequent.cohort_request.cohort_digest,
  );
  assert.notEqual(
    initial.cohort_request.cache_key,
    subsequent.cohort_request.cache_key,
  );
});

test('all timing carriers have exact source, admission, cohort and Query closure', () => {
  const value = bundle();
  const admissionIds = value.registry.admission_records.map(
    (entry) => entry.metric_serving_admission_id,
  ).sort();
  assert.deepEqual(
    value.manifest.metric_serving_admission_ids,
    admissionIds,
  );
  assert.equal(admissionIds.length, 4);
  assert.equal(value.timing_certifications.length, 3);
  for (const carrier of value.timing_certifications) {
    const admission =
      carrier.metric_serving_admission
        .metric_serving_admission_id;
    assert.equal(
      carrier.observation.metric_serving_admission_id,
      admission,
    );
    assert.equal(
      carrier.cohort_request.metric_serving_admission_id,
      admission,
    );
    assert.equal(
      carrier.cohort_result.metric_serving_admission_id,
      admission,
    );
    assert.equal(
      carrier.query_projection.metric_serving_admission_id,
      admission,
    );
    assert.equal(
      carrier.cohort_request.execution_shape,
      'ONE_INDEXED_SET_BASED_SQL',
    );
    assert.equal(carrier.observation.evidence.length, 2);
    assert.ok(
      carrier.observation.evidence.some(
        (entry) => (
          entry.exact_text
            === carrier.observation.raw_value.text
        ),
      ),
    );
    assert.ok(
      carrier.observation.evidence.some(
        (entry) => (
          entry.exact_text.length
            > carrier.observation.raw_value.text.length
          && entry.exact_text.includes(
            carrier.observation.raw_value.text,
          )
        ),
      ),
    );
  }
});

test('the successor resolver accepts only exact declared metric admissions', () => {
  const value = bundle();
  const declared =
    value.manifest.metric_serving_admission_ids;
  for (const carrier of value.timing_certifications) {
    const observation = carrier.observation;
    const resolution = resolveMetricServingAdmissionF24({
      bundle: value,
      metric_key: observation.metric_key,
      metric_version: observation.metric_version,
      concept_key: observation.concept_key,
      required_claim_definition_key:
        observation.metric_key,
      metric_serving_admission_id:
        observation.metric_serving_admission_id,
      declared_metric_serving_admission_ids:
        declared,
    });
    assert.equal(resolution.admission_lane, 'METRIC_SCOPED');
    assert.equal(
      resolution.certification_manifest_validation,
      'PASSED',
    );
  }
  const initial = value.timing_certifications[0].observation;
  const notice = value.timing_certifications[1].observation;
  assert.throws(() => resolveMetricServingAdmissionF24({
    bundle: value,
    metric_key: initial.metric_key,
    metric_version: initial.metric_version,
    concept_key: initial.concept_key,
    required_claim_definition_key: initial.metric_key,
    metric_serving_admission_id:
      notice.metric_serving_admission_id,
    declared_metric_serving_admission_ids: declared,
  }), /did not resolve/);
  assert.throws(() => resolveMetricServingAdmissionF24({
    bundle: value,
    metric_key: initial.metric_key,
    metric_version: initial.metric_version,
    concept_key: initial.concept_key,
    required_claim_definition_key: initial.metric_key,
    metric_serving_admission_id:
      initial.metric_serving_admission_id,
    declared_metric_serving_admission_ids:
      declared.filter(
        (id) => id !== initial.metric_serving_admission_id,
      ),
  }), /must equal the F24 manifest/);
  assert.throws(() => resolveMetricServingAdmissionF24({
    bundle: value,
    metric_key: initial.metric_key,
    metric_version: initial.metric_version,
    concept_key: initial.concept_key,
    required_claim_definition_key: initial.metric_key,
    metric_serving_admission_id:
      initial.metric_serving_admission_id,
    declared_metric_serving_admission_ids: [
      ...declared,
      '0'.repeat(64),
    ].sort(),
  }), /must equal the F24 manifest/);
});

test('a malformed timing record fails locally without suppressing siblings', () => {
  const value = bundle();
  const records = clone(value.timing_certifications);
  records[1].observation.canonical_value = '2';
  const rendered = prepareTimingCertificationsForRendering(
    records,
    value,
  );
  assert.deepEqual(
    rendered.map((entry) => entry.render_kind),
    [
      'TIMING_METRIC',
      'TIMING_METRIC_RENDER_FAILED',
      'TIMING_METRIC',
    ],
  );
  assert.equal(
    rendered[1].reason_code,
    'INVALID_F24_TIMING_METRIC_CERTIFICATION',
  );
});

test('full-shell re-signing cannot replace the immutable F24 certification', () => {
  const value = clone(bundle());
  const noticeIndex = value.timing_certifications.findIndex(
    (entry) => (
      entry.observation.metric_key
        === 'NO_SHOP_NOTICE_PERIOD_DAYS'
    ),
  );
  const notice = value.timing_certifications[noticeIndex];
  notice.observation.raw_value.magnitude = '48';
  notice.query_projection.raw_value.magnitude = '48';
  value.timing_certifications[noticeIndex] =
    resignCarrier(notice);
  resignEnvelope(value);
  assert.notEqual(
    value.no_shop_timing_certification_bundle_f24_id,
    F24_BUNDLE_ID,
  );
  assert.throws(
    () => validateF24EnvelopeIdentity(value),
    /exact F24 certification envelope/,
  );
});

test('F24 keeps every authority closed and the serving plan bounded', () => {
  const manifest = bundle().manifest;
  assert.deepEqual(manifest.authority, {
    active_release_authority: 'NONE',
    active_query_authority: 'NONE',
    active_pointer_authority: 'NONE',
    corpus_write_authority: 'NONE',
    production_activation_authority: 'NONE',
  });
  assert.deepEqual(manifest.serving_plan, {
    database_calls_per_request: 1,
    database_call_growth_with_corpus_size: 'CONSTANT',
    request_shape: 'ONE_INDEXED_SET_BASED_SQL',
    cache_scope: 'RELEASE_METRIC_PARTY_BASIS_ADMISSION',
    immediate_retries: 0,
  });
  assert.equal(manifest.status.publication_blocked, true);
  assert.equal(manifest.status.release_eligible, false);
});

test('the F24 staging proof is set-based, rollback-only and leaves no residue', () => {
  const execution = fixture().staging_execution;
  assert.equal(execution.database_calls, 3);
  assert.equal(execution.immediate_retries, 0);
  assert.equal(
    execution.insert_shape,
    'ONE_SET_BASED_JSONB_TO_RECORDSET',
  );
  assert.equal(execution.transaction.timing_rows, 3);
  assert.equal(execution.transaction.distinct_admissions, 3);
  assert.equal(execution.transaction.bound_carriers, 15);
  assert.equal(execution.post_rollback.probe_table_exists, false);
  assert.equal(execution.active_pointer_unchanged, true);
  assert.equal(execution.rollback_verified, true);
  assert.equal(execution.durable_rows_written, 0);

  const source = f24RunnerSection();
  assert.match(source, /deal-corpus-canonical-v2-staging|guardProject/);
  assert.match(source, /jsonb_to_recordset/);
  assert.match(source, /ENABLE ROW LEVEL SECURITY/);
  assert.match(source, /REVOKE ALL/);
  assert.match(source, /ROLLBACK;/);
  assert.doesNotMatch(
    source,
    /canonical_v2_activate|UPDATE\s+canonical_v2_staging|DELETE\s+FROM/,
  );
});

test('F24 leaves all frozen F19 through F23 serving artifacts byte-identical', () => {
  for (const [path, expected] of Object.entries(
    HISTORICAL_SNAPSHOTS,
  )) {
    assert.equal(hashFile(path), expected, path);
  }
});

test('the F24 module has no database, network, route or feature-activation path', () => {
  const source = fs.readFileSync(
    'lib/canonical-v2/no-shop-timing-certification-f24.js',
    'utf8',
  );
  assert.doesNotMatch(
    source,
    /supabase|fetch\(|\.rpc\(|process\.env|pages\/api|active_corpus_release_pointers/,
  );
  assert.doesNotMatch(
    source,
    /production_activation_authority:\s*'(?!NONE)/,
  );
});
