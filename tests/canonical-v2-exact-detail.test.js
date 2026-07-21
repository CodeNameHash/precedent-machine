const test = require('node:test');
const assert = require('node:assert/strict');

const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  buildFixtureClaimEvidenceDetailPackage,
  validateFixtureExactDetailPackage,
} = require('../lib/canonical-v2/exact-detail');
const { validateSharedServingRow } = require('../lib/canonical-v2/shared-serving-row');
const { buildCompleteServingFixture } = require('./helpers/canonical-v2-serving-fixture');

function buildPackage(options = {}) {
  const fixture = buildCompleteServingFixture(options);
  const detailPackage = buildFixtureClaimEvidenceDetailPackage({
    contract_bundle: fixture.contract,
    row: fixture.row,
    source: fixture.source,
    source_admission: fixture.sourceAdmission,
    excerpt: fixture.claimExcerpt,
    claim: fixture.claim,
  });
  return { ...fixture, detailPackage };
}

function validate(fixture, candidate = fixture.detailPackage, overrides = {}) {
  return validateFixtureExactDetailPackage({
    package: candidate,
    contract_bundle: fixture.contract,
    source: fixture.source,
    source_admission: fixture.sourceAdmission,
    excerpt: fixture.claimExcerpt,
    claim: fixture.claim,
    ...overrides,
  });
}

test('one result component publishes one atomic, source-backed claim-evidence action', () => {
  const fixture = buildPackage();
  const { detailPackage } = fixture;
  const payload = detailPackage.detail_payloads[0];

  assert.equal(validate(fixture), true);
  assert.equal(validateSharedServingRow(detailPackage.row), true);
  assert.equal(detailPackage.row.row_serving_key, fixture.row.row_serving_key);
  assert.notEqual(detailPackage.row.canonical_payload_digest, fixture.row.canonical_payload_digest);
  assert.equal(detailPackage.row.canonical_result.source_detail_state.state, 'AVAILABLE');
  assert.equal(payload.response_body.excerpt.exact_text, 'true in all material respects.');
  assert.equal(payload.response_body.excerpt.exact_bytes_digest, fixture.claimExcerpt.exact_bytes_digest);
  assert.equal(payload.response_body.source_lineage.document_hash, fixture.source.document_hash);
  assert.deepEqual(
    detailPackage.references[0].ordered_path.map((item) => item.object_type),
    [
      'ClaimRevision',
      'ClaimEvidence',
      'Excerpt',
      'SemanticSpan',
      'CanonicalText',
      'SourceOccurrence',
      'SourceAdmissionManifest',
      'SourceContent',
    ],
  );
  assert.notEqual(fixture.claimExcerpt.excerpt_id, fixture.claimSpan.semantic_span_id);
});

test('release identity rekeys the detail graph while row payload-only changes do not', () => {
  const base = buildPackage();
  const release = buildPackage({ release: 'candidate-b' });
  const counts = buildPackage({ counts: { eligible_deals: 40 } });

  assert.notEqual(
    base.detailPackage.detail_payloads[0].source_detail_payload_id,
    release.detailPackage.detail_payloads[0].source_detail_payload_id,
  );
  assert.notEqual(
    base.detailPackage.references[0].source_detail_reference_id,
    release.detailPackage.references[0].source_detail_reference_id,
  );
  assert.notEqual(base.detailPackage.parent_edges[0].parent_edge_id, release.detailPackage.parent_edges[0].parent_edge_id);
  assert.equal(base.row.row_serving_key, counts.row.row_serving_key);
  assert.notEqual(base.row.canonical_payload_digest, counts.row.canonical_payload_digest);
  assert.equal(
    base.detailPackage.references[0].source_detail_reference_id,
    counts.detailPackage.references[0].source_detail_reference_id,
  );
  assert.equal(base.detailPackage.parent_edges[0].parent_edge_id, counts.detailPackage.parent_edges[0].parent_edge_id);
});

test('tampered text, offsets, lineage and synthetic span-as-excerpt identities fail closed', () => {
  const fixture = buildPackage();
  const badText = structuredClone(fixture.detailPackage);
  badText.detail_payloads[0].response_body.excerpt.exact_text = 'true in all respects.';
  assert.throws(() => validate(fixture, badText), /identity|lineage/);

  const badOffset = structuredClone(fixture.detailPackage);
  badOffset.detail_payloads[0].response_body.excerpt.absolute_start = 0;
  assert.throws(() => validate(fixture, badOffset), /identity|lineage/);

  const badAdmission = structuredClone(fixture.sourceAdmission);
  badAdmission.canonical_payload_digest = '0'.repeat(64);
  assert.throws(() => validate(fixture, fixture.detailPackage, { source_admission: badAdmission }), /admission/);

  const syntheticExcerpt = {
    ...fixture.claimExcerpt,
    excerpt_id: fixture.claimSpan.semantic_span_id,
  };
  assert.throws(() => validate(fixture, fixture.detailPackage, { excerpt: syntheticExcerpt }), /excerpt identity/);
});

test('missing, duplicate, orphaned and wrong-parent objects reject the whole package', () => {
  const fixture = buildPackage();
  const missing = structuredClone(fixture.detailPackage);
  missing.detail_payloads = [];
  assert.throws(() => validate(fixture, missing), /exactly one/);

  const duplicate = structuredClone(fixture.detailPackage);
  duplicate.references.push(structuredClone(duplicate.references[0]));
  assert.throws(() => validate(fixture, duplicate), /exactly one/);

  const orphan = structuredClone(fixture.detailPackage);
  orphan.parent_edges[0].source_detail_reference_id = '0'.repeat(64);
  assert.throws(() => validate(fixture, orphan), /closed atomic graph/);

  const wrongParent = structuredClone(fixture.detailPackage);
  wrongParent.references[0].parent_row_serving_key = contentId('RESULT_SERVING_ROW/V1', 'wrong-parent');
  assert.throws(() => validate(fixture, wrongParent), /closed atomic graph/);
});

test('an attachment failure leaves the independently valid base row unchanged', () => {
  const fixture = buildCompleteServingFixture();
  const before = structuredClone(fixture.row);
  const badExcerpt = { ...fixture.claimExcerpt, exact_text: 'forged' };

  assert.throws(() => buildFixtureClaimEvidenceDetailPackage({
    contract_bundle: fixture.contract,
    row: fixture.row,
    source: fixture.source,
    source_admission: fixture.sourceAdmission,
    excerpt: badExcerpt,
    claim: fixture.claim,
  }), /exact source bytes/);
  assert.deepEqual(fixture.row, before);
  assert.equal(validateSharedServingRow(fixture.row), true);
});
