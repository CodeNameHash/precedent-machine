const test = require('node:test');
const assert = require('node:assert/strict');

const fixture = require('./fixtures/canonical-v2/qxo-no-shop-f6-source-spans.json');
const { canonicalJson, contentId, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const {
  compileFixtureContract,
  compileFixtureContractV5,
  compileFixtureContractV6,
  FIXTURE_SERVING_CONTRACT_FINGERPRINTS,
  NO_SHOP_ACTION_CODES_V2,
} = require('../lib/canonical-v2/contract-bundle');
const {
  ACTION_SPECS,
  buildQxoAdmittedNoShopActionsF6Slice,
  validateQxoAdmittedNoShopActionsF6Slice,
} = require('../lib/canonical-v2/reviewed-qxo-admitted-no-shop-actions-f6-slice');

function digest(label) {
  return contentId('QXO_NO_SHOP_F6_TEST_SOURCE/V1', label);
}

function sourceContext(contractBundle, mutateText) {
  const bytes = Buffer.alloc(fixture.canonical_text_byte_length, 0x20);
  for (const [key, pin] of Object.entries(fixture.spans)) {
    const exact = Buffer.from(pin.base64, 'base64');
    assert.equal(exact.length, pin.end - pin.start, key);
    assert.equal(sha256Hex(exact), pin.sha256, key);
    exact.copy(bytes, pin.start);
  }
  if (mutateText) mutateText(bytes);
  const text = bytes.toString('utf8');
  const sourceAdmissionManifestId = digest('source-admission');
  const dealAdmissionId = contentId('DEAL_ADMISSION/V2', {
    governed_deal_key: 'deal:qxo-topbuild',
    source_admission_manifest_id: sourceAdmissionManifestId,
    contract_fingerprint: contractBundle.fingerprint,
  });
  const immutableSourceDocumentId = digest('immutable-source');
  const sourceContentId = digest('source-content');
  const sourceOccurrenceKey = contentId('ADMITTED_SOURCE_OCCURRENCE_KEY/V1', {
    deal_admission_id: dealAdmissionId,
    source_ordinal: 0,
    immutable_source_document_id: immutableSourceDocumentId,
  });
  const body = {
    schema_version: 'ADMITTED_SEMANTIC_SOURCE_CONTEXT/V1',
    governed_deal_key: 'deal:qxo-topbuild',
    deal_admission_id: dealAdmissionId,
    source_ordinal: 0,
    immutable_source_document_id: immutableSourceDocumentId,
    source_admission_manifest_id: sourceAdmissionManifestId,
    semantic_extraction_input_envelope_id: digest('envelope'),
    source_content_id: sourceContentId,
    source_occurrence_id: contentId('SOURCE_OCCURRENCE/V1', {
      source_content_id: sourceContentId,
      source_occurrence_key: sourceOccurrenceKey,
    }),
    source_occurrence_key: sourceOccurrenceKey,
    source_kind: 'ORIGINAL_BYTES',
    document_hash: fixture.document_sha256,
    source_byte_length: fixture.canonical_text_byte_length + 1000,
    canonical_text_id: fixture.canonical_text_id,
    canonical_text_sha256: sha256Hex(Buffer.from(text, 'utf8')),
    canonical_text_byte_length: fixture.canonical_text_byte_length,
    canonical_text: {
      schema_version: 'ADMITTED_CANONICAL_TEXT_RUNTIME/V1',
      canonical_text_id: fixture.canonical_text_id,
      text,
    },
    converter_digest: digest('converter'),
    converter_config_digest: digest('converter-config'),
    source_map_encoding: 'GZIP_BASE64_JSON_V1',
    source_map_compressed_sha256: digest('source-map-compressed'),
    source_map_uncompressed_byte_length: 1,
    input_region_count: 1,
    output_mapping_count: 1,
    source_map_digest: digest('source-map'),
    verification_manifest_id: digest('verification'),
  };
  return Object.freeze({
    ...body,
    admitted_semantic_source_context_id: contentId(
      'ADMITTED_SEMANTIC_SOURCE_CONTEXT/V1',
      body,
    ),
  });
}

test('exact admitted QXO spans produce one deterministic F6 atomic-action mapping', () => {
  const contractBundle = compileFixtureContractV6();
  const source = sourceContext(contractBundle);
  const first = buildQxoAdmittedNoShopActionsF6Slice({
    sourceContext: source,
    contractBundle,
  });
  const second = buildQxoAdmittedNoShopActionsF6Slice({
    sourceContext: source,
    contractBundle,
  });

  assert.equal(canonicalJson(first), canonicalJson(second));
  assert.equal(validateQxoAdmittedNoShopActionsF6Slice({
    sourceContext: source,
    contractBundle,
    slice: first,
  }), true);
  assert.equal(first.action_occurrences.length, 24);
  assert.equal(first.action_components.length, 24);
  assert.equal(
    new Set(first.action_occurrences.map((entry) => entry.action_code)).size,
    23,
  );
  assert.deepEqual(
    [...new Set(first.action_occurrences.map((entry) => entry.action_code))].sort(),
    [...NO_SHOP_ACTION_CODES_V2].sort(),
  );
});

test('QXO keeps 24 source occurrences, exact limbs and occurrence-level qualifiers', () => {
  const contractBundle = compileFixtureContractV6();
  const source = sourceContext(contractBundle);
  const slice = buildQxoAdmittedNoShopActionsF6Slice({
    sourceContext: source,
    contractBundle,
  });
  const byKey = new Map(slice.action_occurrences.map(
    (entry) => [entry.occurrence_key, entry],
  ));

  assert.deepEqual(
    ['A', 'B', 'C'].map((limb) => slice.action_occurrences.filter(
      (entry) => entry.source_limb_code === limb,
    ).length),
    [6, 10, 8],
  );
  assert.deepEqual(
    ['A', 'B', 'C'].map((limb) => [
      slice.limb_spans[limb].absolute_start,
      slice.limb_spans[limb].absolute_end,
    ]),
    [
      [202580, 202928],
      [202928, 203339],
      [203339, 203664],
    ],
  );
  assert.equal(byKey.get('A_FACILITATE').knowledge_qualifier_code, 'KNOWINGLY');
  assert.equal(byKey.get('A_ENCOURAGE').knowledge_qualifier_code, 'KNOWINGLY');
  assert.equal(
    slice.action_occurrences.filter(
      (entry) => entry.knowledge_qualifier_code === 'KNOWINGLY',
    ).length,
    2,
  );
  const furnish = slice.action_occurrences.filter(
    (entry) => entry.action_code === 'FURNISH_NONPUBLIC_INFORMATION',
  );
  assert.equal(furnish.length, 2);
  assert.notEqual(furnish[0].action_occurrence_id, furnish[1].action_occurrence_id);
  assert.notDeepEqual(furnish[0].evidence_excerpt_ids, furnish[1].evidence_excerpt_ids);
  assert.deepEqual(
    byKey.get('A_FURNISH_METHOD').method_of_action_occurrence_ids,
    [
      byKey.get('A_ENCOURAGE').action_occurrence_id,
      byKey.get('A_FACILITATE').action_occurrence_id,
    ].sort(),
  );
  assert.deepEqual(
    byKey.get('A_DGCL_203_WAIVER').method_of_action_occurrence_ids,
    [],
  );
  assert.equal(byKey.get('B_FURNISH').method_of_action_occurrence_ids.length, 0);
  for (const spec of ACTION_SPECS) {
    const occurrence = byKey.get(spec.occurrence_key);
    const evidenceIntervals = occurrence.claim.evidence.map((entry) => [
      entry.absolute_start,
      entry.absolute_end,
    ]);
    assert.equal(
      evidenceIntervals.some(([start, end]) => start === 201405 && end === 201556),
      true,
      `${spec.occurrence_key} governing chapeau`,
    );
    assert.equal(
      evidenceIntervals.some(([start, end]) => start === 202396 && end === 202400),
      true,
      `${spec.occurrence_key} clause ii connector`,
    );
    assert.deepEqual(
      occurrence.claim.evidence
        .filter((entry) => entry.evidence_role === 'DERIVATION_INPUT')
        .map((entry) => ({
          start: entry.absolute_start,
          end: entry.absolute_end,
        })),
      spec.action_intervals,
      spec.occurrence_key,
    );
    assert.deepEqual(
      occurrence.claim.raw_value,
      spec.action_intervals.map((interval) => Buffer
        .from(source.canonical_text.text, 'utf8')
        .subarray(interval.start, interval.end)
        .toString('utf8')),
      spec.occurrence_key,
    );
  }
  for (const key of [
    'C_APPROVE',
    'C_RECOMMEND',
    'C_ENTER',
    'C_PROPOSE_APPROVE',
    'C_PROPOSE_RECOMMEND',
    'C_PROPOSE_ENTER',
  ]) {
    assert.equal(
      byKey.get(key).claim.evidence.some(
        (entry) => entry.absolute_start === 203563 && entry.absolute_end === 203580,
      ),
      true,
      `${key} agreement-to-proposal link`,
    );
  }
  for (const key of ['C_SUPPORT', 'C_FURTHER']) {
    assert.equal(
      byKey.get(key).claim.evidence.some(
        (entry) => entry.absolute_start === 203580 && entry.absolute_end === 203603,
      ),
      true,
      `${key} operative connector`,
    );
  }
});

test('purpose verbs are not double-counted and method links are local, bounded and acyclic', () => {
  const contractBundle = compileFixtureContractV6();
  const slice = buildQxoAdmittedNoShopActionsF6Slice({
    sourceContext: sourceContext(contractBundle),
    contractBundle,
  });
  const ids = new Set(slice.action_occurrences.map((entry) => entry.action_occurrence_id));
  for (const occurrence of slice.action_occurrences) {
    assert.equal(occurrence.method_of_action_occurrence_ids.length <= 4, true);
    assert.equal(new Set(occurrence.method_of_action_occurrence_ids).size,
      occurrence.method_of_action_occurrence_ids.length);
    for (const targetId of occurrence.method_of_action_occurrence_ids) {
      assert.equal(ids.has(targetId), true);
      assert.notEqual(targetId, occurrence.action_occurrence_id);
    }
  }
  assert.equal(ACTION_SPECS.length, 24);
  assert.equal(
    ACTION_SPECS.filter((entry) => entry.source_limb_code === 'B'
      && /SOLICIT|INITIATE|ENCOURAGE|FACILITATE/.test(entry.action_code)).length,
    0,
  );
});

test('every action is a validated V2 claim while source-level residuals block publication', () => {
  const contractBundle = compileFixtureContractV6();
  const slice = buildQxoAdmittedNoShopActionsF6Slice({
    sourceContext: sourceContext(contractBundle),
    contractBundle,
  });
  for (const occurrence of slice.action_occurrences) {
    assert.equal(occurrence.claim.claim_definition_key, 'NO_SHOP_PROHIBITED_ACTION');
    assert.equal(occurrence.claim.claim_definition_version, 2);
    assert.equal(occurrence.claim.state, 'PRESENT');
    assert.equal(occurrence.claim.publication_state, 'VALIDATED');
    assert.deepEqual(occurrence.claim.retained_residuals, []);
    assert.equal(occurrence.claim.canonical_value, occurrence.action_code);
    assert.equal(occurrence.claim.subject_occurrence_id, occurrence.action_occurrence_id);
    assert.equal(occurrence.claim.attributes.source_limb_code, occurrence.source_limb_code);
    assert.equal(
      occurrence.claim.attributes.knowledge_qualifier_code,
      occurrence.knowledge_qualifier_code,
    );
  }
  assert.equal(slice.reviewed_mapping.retained_residuals.length, 13);
  assert.equal(slice.retained_residuals.length, 13);
  assert.equal(
    slice.retained_residuals.every(
      (residual) => residual.state === 'PENDING_REVIEWED_DISPOSITION'
        && residual.publication_effect === 'BLOCK',
    ),
    true,
  );
  assert.deepEqual(
    slice.retained_residuals.slice(-4).map((residual) => residual.residual_code),
    [
      'NO_SHOP_ALTERNATIVE_AGREEMENT_FORM_ATTRIBUTES_UNTYPED',
      'NO_SHOP_DGCL_203_WAIVER_METHOD_RELATIONSHIP_UNRESOLVED',
      'NO_SHOP_POST_RESTRICTION_A_DUTIES_UNMAPPED',
      'NO_SHOP_LATER_NOTICE_C_DUTIES_UNMAPPED',
    ],
  );
});

test('the review mapping grants no downstream authority and names every deferred family', () => {
  const contractBundle = compileFixtureContractV6();
  const slice = buildQxoAdmittedNoShopActionsF6Slice({
    sourceContext: sourceContext(contractBundle),
    contractBundle,
  });
  const mapping = slice.reviewed_mapping;
  assert.equal(mapping.status.f6_atomic_action_reference_set_complete, true);
  assert.equal(mapping.status.section_4_3_scope_complete, false);
  assert.equal(mapping.status.publication_blocked, true);
  assert.equal(mapping.status.release_eligible, false);
  for (const key of [
    'canonical_write_authority',
    'rollup_authority',
    'relationship_effect_authority',
    'notice_obligation_authority',
    'result_authority',
    'metric_authority',
    'comparability_authority',
    'query_authority',
    'serving_authority',
    'release_authority',
  ]) {
    assert.equal(mapping.status[key], 'NONE', key);
  }
  assert.deepEqual(
    mapping.deferred_semantic_families.map((entry) => entry.family_key),
    [
      'NO_SHOP_ACTION_COMPARISON_ROLLUP',
      'NO_SHOP_INLINE_PERMISSION_EFFECT',
      'NO_SHOP_EXCEPTION_EFFECT',
      'NO_SHOP_NOTICE_OBLIGATION',
    ],
  );
  const deferredByFamily = new Map(mapping.deferred_semantic_families.map(
    (entry) => [entry.family_key, entry],
  ));
  assert.deepEqual(
    deferredByFamily.get('NO_SHOP_ACTION_COMPARISON_ROLLUP')
      .ordered_source_dependency_ids,
    mapping.ordered_action_occurrence_revision_ids,
  );
  assert.deepEqual(
    deferredByFamily.get('NO_SHOP_INLINE_PERMISSION_EFFECT')
      .ordered_source_dependency_ids,
    [slice.deferred_source_excerpts.inline_permission.excerpt_id],
  );
  assert.deepEqual(
    deferredByFamily.get('NO_SHOP_EXCEPTION_EFFECT').ordered_source_dependency_ids,
    [slice.governed_excerpts.exception.excerpt_id],
  );
  assert.deepEqual(
    deferredByFamily.get('NO_SHOP_NOTICE_OBLIGATION').ordered_source_dependency_ids,
    [slice.governed_excerpts.notice.excerpt_id],
  );
  assert.equal(FIXTURE_SERVING_CONTRACT_FINGERPRINTS.includes(
    contractBundle.fingerprint,
  ), false);
});

test('F1-F5, exact source drift and coherent object tampering fail closed', () => {
  for (const contractBundle of [compileFixtureContract(), compileFixtureContractV5()]) {
    assert.throws(() => buildQxoAdmittedNoShopActionsF6Slice({
      sourceContext: sourceContext(contractBundle),
      contractBundle,
    }), /exact frozen F6 contract/);
  }
  const contractBundle = compileFixtureContractV6();
  const driftedSource = sourceContext(contractBundle, (bytes) => {
    bytes[fixture.spans.restriction.start + 20] = 0x58;
  });
  assert.throws(() => buildQxoAdmittedNoShopActionsF6Slice({
    sourceContext: driftedSource,
    contractBundle,
  }), /source bytes have drifted/);

  const source = sourceContext(contractBundle);
  const slice = buildQxoAdmittedNoShopActionsF6Slice({
    sourceContext: source,
    contractBundle,
  });
  const changed = JSON.parse(JSON.stringify(slice));
  changed.action_occurrences[0].party.value = 'PARENT';
  assert.throws(() => validateQxoAdmittedNoShopActionsF6Slice({
    sourceContext: source,
    contractBundle,
    slice: changed,
  }), /identity or source binding has drifted/);
});
