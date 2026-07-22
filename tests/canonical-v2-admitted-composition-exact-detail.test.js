const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const {
  buildAdmittedResultCompositionDetailPackage,
  validateAdmittedResultCompositionDetailPackage,
} = require('../lib/canonical-v2/admitted-composition-exact-detail');
const { buildFixtureCandidateInputAuthority } = require('../__fixtures__/canonical-v2/candidate-input-authority');
const {
  buildFixtureCandidateRelease,
  validateCandidateReleaseBundle,
} = require('../lib/canonical-v2/candidate-release');
const {
  buildCandidateReleaseImportPlan,
} = require('../lib/canonical-v2/candidate-release-import');
const { contentId, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContract } = require('../lib/canonical-v2/contract-bundle');
const {
  buildQxoCapitalisationServingSlice,
} = require('../lib/canonical-v2/qxo-capitalisation-serving-slice');
const {
  CAPITAL_STRUCTURE_INTERVAL,
  SECTION_5_2_INTERVAL,
  buildQxoReviewedCapitalisationSlice,
} = require('../lib/canonical-v2/reviewed-qxo-capitalisation-slice');
const { QXO_5_2_TEXT } = require('./fixtures/qxo-section-5-2');

function digest(label) {
  return contentId('ADMITTED_COMPOSITION_DETAIL_TEST/V1', label);
}

function buildSource() {
  const capital = fs.readFileSync('tests/fixtures/qxo-section-3-1-b.txt', 'utf8');
  const chunks = [' '.repeat(CAPITAL_STRUCTURE_INTERVAL.start), capital];
  const capitalEnd = CAPITAL_STRUCTURE_INTERVAL.start + Buffer.byteLength(capital, 'utf8');
  chunks.push(' '.repeat(SECTION_5_2_INTERVAL.start - capitalEnd), QXO_5_2_TEXT);
  const conditionEnd = SECTION_5_2_INTERVAL.start + Buffer.byteLength(QXO_5_2_TEXT, 'utf8');
  chunks.push(' '.repeat(SECTION_5_2_INTERVAL.end - conditionEnd));
  const text = chunks.join('');
  const canonicalTextId = digest(`canonical:${sha256Hex(text)}`);
  const immutableSourceDocumentId = digest('immutable-source-v2');
  const dealAdmissionId = digest('deal-admission-v2');
  const sourceOccurrenceKey = contentId('ADMITTED_SOURCE_OCCURRENCE_KEY/V1', {
    deal_admission_id: dealAdmissionId,
    source_ordinal: 0,
    immutable_source_document_id: immutableSourceDocumentId,
  });
  const sourceContentId = digest('original-source-content');
  const sourceOccurrenceId = contentId('SOURCE_OCCURRENCE/V1', {
    source_content_id: sourceContentId,
    source_occurrence_key: sourceOccurrenceKey,
  });
  const sourceMapDigest = digest('source-map');
  const admissionBody = {
    schema_version: 'SOURCE_ADMISSION_MANIFEST/V2',
    admission_state: 'VERIFIED',
    source_kind: 'ORIGINAL_BYTES',
    immutable_source_document_id: immutableSourceDocumentId,
    source_response_content_id: sourceContentId,
    canonical_text_id: canonicalTextId,
    verification_manifest_id: digest('verification'),
    admitted_intervals: [{ start: 0, end: Buffer.byteLength(text, 'utf8') }],
    excluded_intervals: [],
    conversion_loss_residual_ids: [],
    discrepancy_count: 0,
    blocking_discrepancy_count: 0,
    coverage_proof_digest: contentId('SOURCE_ADMISSION_COVERAGE_PROOF/V2', {
      canonical_text_id: canonicalTextId,
      canonical_text_byte_length: Buffer.byteLength(text, 'utf8'),
      source_map_digest: sourceMapDigest,
      admitted_intervals: [{ start: 0, end: Buffer.byteLength(text, 'utf8') }],
      excluded_intervals: [],
      discrepancy_count: 0,
    }),
  };
  const admission = {
    ...admissionBody,
    source_admission_manifest_id: contentId('SOURCE_ADMISSION_MANIFEST/V2', admissionBody),
  };
  const body = {
    schema_version: 'ADMITTED_SEMANTIC_SOURCE_CONTEXT/V1',
    governed_deal_key: 'deal:qxo-topbuild',
    deal_admission_id: dealAdmissionId,
    source_ordinal: 0,
    immutable_source_document_id: immutableSourceDocumentId,
    source_admission_manifest_id: admission.source_admission_manifest_id,
    semantic_extraction_input_envelope_id: digest('semantic-envelope'),
    source_content_id: sourceContentId,
    source_occurrence_id: sourceOccurrenceId,
    source_occurrence_key: sourceOccurrenceKey,
    source_kind: 'ORIGINAL_BYTES',
    document_hash: digest('original-response-bytes'),
    source_byte_length: Buffer.byteLength(text, 'utf8') + 1000,
    canonical_text_id: canonicalTextId,
    canonical_text_sha256: sha256Hex(text),
    canonical_text_byte_length: Buffer.byteLength(text, 'utf8'),
    canonical_text: {
      schema_version: 'ADMITTED_CANONICAL_TEXT_RUNTIME/V1',
      canonical_text_id: canonicalTextId,
      text,
    },
    converter_digest: digest('converter'),
    converter_config_digest: digest('converter-config'),
    source_map_encoding: 'DEFLATE_RAW_BASE64_UINT32_TUPLES/V1',
    source_map_compressed_sha256: digest('compressed-source-map'),
    source_map_uncompressed_byte_length: 16,
    input_region_count: 1,
    output_mapping_count: 1,
    source_map_digest: sourceMapDigest,
    verification_manifest_id: admission.verification_manifest_id,
  };
  return {
    source: {
      ...body,
      admitted_semantic_source_context_id: contentId('ADMITTED_SEMANTIC_SOURCE_CONTEXT/V1', body),
    },
    admission,
  };
}

function build() {
  const contract = compileFixtureContract();
  const { source, admission } = buildSource();
  const corpusReleaseId = digest('corpus-release');
  const slice = buildQxoReviewedCapitalisationSlice({ sourceContext: source, contractBundle: contract });
  const serving = buildQxoCapitalisationServingSlice({
    sourceContext: source,
    slice,
    contractBundle: contract,
    corpusReleaseId,
    servingNamespaceId: digest('serving-namespace'),
    dealDimensions: { buyer: 'QXO' },
  });
  const input = serving.admitted_exact_detail_inputs[0];
  const excerptsById = new Map(Object.values(slice.excerpts).map((excerpt) => [excerpt.excerpt_id, excerpt]));
  const targetsById = new Map(slice.components.map((component) => [component.provision_component_id, component]));
  const args = {
    contract_bundle: contract,
    row: serving.shared_rows[0],
    source,
    source_admission: admission,
    components: input.components,
    relationship_targets: input.relationship_target_occurrence_ids.map((id) => targetsById.get(id)),
    excerpts: input.ordered_excerpt_ids.map((id) => excerptsById.get(id)),
  };
  return { args, package: buildAdmittedResultCompositionDetailPackage(args) };
}

function buildReleaseReady() {
  const contract = compileFixtureContract();
  const { source, admission } = buildSource();
  const corpusReleaseId = digest('release-ready-corpus');
  const servingNamespaceId = digest('release-ready-namespace');
  const slice = buildQxoReviewedCapitalisationSlice({ sourceContext: source, contractBundle: contract });
  const serving = buildQxoCapitalisationServingSlice({
    sourceContext: source,
    sourceAdmission: admission,
    slice,
    contractBundle: contract,
    corpusReleaseId,
    servingNamespaceId,
    dealDimensions: { buyer: 'QXO' },
  });
  const release = buildFixtureCandidateRelease({
    contract_bundle: contract,
    serving_namespace_id: servingNamespaceId,
    corpus_release_id: corpusReleaseId,
    members: serving.candidate_release_members,
    correction_authority_selection: buildFixtureCandidateInputAuthority({ contractBundle: contract }),
    deal_directory_entries: [{
      application_deal_id: '7dc3a05f-b170-4d59-a255-b7103cca16e1',
      governed_deal_key: 'deal:qxo-topbuild',
    }],
  });
  return { serving, release, plan: buildCandidateReleaseImportPlan({ release }) };
}

test('a real-shape admitted V2 source produces one valid bounded composition package', () => {
  const fixture = build();
  assert.equal(validateAdmittedResultCompositionDetailPackage({
    package: fixture.package,
    ...fixture.args,
  }), true);
  assert.equal(fixture.package.row.source_actions[0].action_slot_key, 'RESULT_COMPOSITION_EVIDENCE');
  assert.equal(fixture.package.detail_payloads[0].response_body.components.length, 4);
  assert.equal(fixture.package.detail_payloads[0].response_body.excerpts.length, 5);
  assert.equal(
    fixture.package.detail_payloads[0].encoded_byte_length <= (16 * 1024) - 512,
    true,
  );
  assert.equal(fixture.package.detail_payloads[0].response_body.source_lineage.document_hash,
    fixture.args.source.document_hash);
});

test('admitted composition detail rejects altered V2 lineage and incomplete scope evidence', () => {
  const lineageDrift = build();
  lineageDrift.args.source_admission = {
    ...lineageDrift.args.source_admission,
    canonical_text_id: digest('wrong-canonical-text'),
  };
  assert.throws(() => buildAdmittedResultCompositionDetailPackage(lineageDrift.args), /lineage/);

  const missingScope = build();
  missingScope.args.excerpts = missingScope.args.excerpts.slice(1);
  assert.throws(() => buildAdmittedResultCompositionDetailPackage(missingScope.args), /excerpt closure/);
});

test('the QXO source-admission branch produces an exactly certified candidate release partition', () => {
  const { serving, release, plan } = buildReleaseReady();
  assert.equal(serving.release_readiness.status, 'READY_FOR_CANDIDATE_RELEASE');
  assert.deepEqual(serving.release_readiness.blocking_reasons, []);
  assert.equal(serving.candidate_release_members.length, 2);
  assert.deepEqual(Object.keys(serving.candidate_release_members[0]).sort(), [
    'exact_detail', 'projection_output', 'shared_row',
  ]);
  assert.equal(serving.candidate_release_members[0].shared_row,
    serving.candidate_release_members[0].exact_detail.package.row);
  assert.deepEqual(serving.candidate_release_members[1], {
    projection_output: serving.projections[1],
    shared_row: null,
    exact_detail: null,
  });
  assert.equal(validateCandidateReleaseBundle(release), true);
  assert.equal(release.manifest.counts.observations, 1);
  assert.equal(release.manifest.counts.exclusions, 1);
  assert.equal(release.manifest.counts.exact_detail_packages, 1);
  assert.equal(plan.expected_counts.market_observations, 1);
  assert.equal(plan.expected_counts.market_exclusions, 1);
});
