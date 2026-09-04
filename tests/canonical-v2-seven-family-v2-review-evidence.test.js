'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  GUARANTY_SILENT_SECTIONS,
  loadSevenFamilyV2ReviewEvidence,
} = require('../lib/canonical-v2/seven-family-v2-review-evidence');

test('seven-family review evidence joins every sealed profile to validated Phase2 and M4 evidence', () => {
  const result = loadSevenFamilyV2ReviewEvidence();
  assert.deepEqual({
    family_count: result.family_count,
    agreement_count: result.agreement_count,
    profile_count: result.profile_count,
    terminal_count: result.terminal_count,
    claim_count: result.claim_count,
    source_only_count: result.source_only_count,
  }, {
    family_count: 7,
    agreement_count: 6,
    profile_count: 140,
    terminal_count: 142,
    claim_count: 240,
    source_only_count: 4,
  });

  const profiles = result.families.flatMap((family) => family.profiles);
  assert.equal(profiles.length, 140);
  for (const profile of profiles) {
    assert.equal(profile.extraction_state, 'COMPLETE');
    assert.equal(profile.output_disposition, 'REVIEW_ONLY');
    assert.equal(profile.source_quality, 'SUFFICIENT');
    assert.ok(profile.evidence.length > 0);
  }

  const claims = profiles.flatMap((profile) => profile.evidence)
    .filter((entry) => entry.evidence_kind === 'M4_CLAIM');
  assert.equal(claims.length, 240);
  for (const claim of claims) {
    assert.equal(claim.claim_state, 'PRESENT');
    assert.equal(claim.publication_state, 'VALIDATED');
    assert.equal(claim.serving_state, 'NOT_SERVED');
    assert.equal(claim.serving_reason, 'SCHEMA_APPROVAL_PENDING');
    assert.notEqual(claim.canonical_value, null);
    assert.equal(typeof claim.raw_value, 'string');
  }
});

test('four Guaranty profiles report their exact M4-silent source rows without invented values', () => {
  const result = loadSevenFamilyV2ReviewEvidence();
  const guaranty = result.families.find((family) => (
    family.family_key === 'GUARANTY_FINANCING_PARTY'
  ));
  const sourceOnly = guaranty.profiles.flatMap((profile) => profile.evidence)
    .filter((entry) => entry.evidence_kind === 'PHASE2_SOURCE_ONLY');
  assert.equal(sourceOnly.length, 4);
  assert.deepEqual(
    Object.fromEntries(sourceOnly.map((entry) => [entry.source_row_key, entry.section_reference])),
    GUARANTY_SILENT_SECTIONS,
  );
  for (const entry of sourceOnly) {
    assert.equal(entry.claim_state, 'NO_M4_CLAIM');
    assert.equal(entry.serving_state, 'SOURCE_ONLY_NOT_SERVED');
    assert.equal(entry.serving_reason, 'M4_SILENT_PROVISION_EXAMPLE');
    assert.equal(entry.canonical_value, null);
    assert.equal(entry.raw_value, null);
    assert.ok(entry.source_span.start_byte < entry.source_span.end_byte);
  }
});

test('review evidence is serialisable and stable within a request process', () => {
  const first = loadSevenFamilyV2ReviewEvidence();
  const second = loadSevenFamilyV2ReviewEvidence();
  assert.equal(first, second);
  assert.doesNotThrow(() => JSON.stringify(first));
});
