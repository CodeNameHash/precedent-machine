const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { canonicalJson, contentId } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContract } = require('../lib/canonical-v2/contract-bundle');
const {
  applyApprovedPostScopeClaimCorrection,
  buildCorrectionApprovalAttestation,
  buildPostScopeClaimCorrection,
  claimPayloadDigest,
} = require('../lib/canonical-v2/post-scope-claim-correction');
const { buildReviewedNoShopSlice } = require('../lib/canonical-v2/reviewed-no-shop-slice');

const sourceText = fs.readFileSync('__fixtures__/demo-deal/landos-abbvie-agreement.txt', 'utf8');
const contractBundle = compileFixtureContract();
const id = (value) => contentId('POST_SCOPE_CORRECTION_TEST/V1', value);

function fixture() {
  return buildReviewedNoShopSlice({ sourceText, contractBundle });
}

function targetFor(writeSet, claim, overrides = {}) {
  return {
    deal_key: writeSet.deal.deal_key,
    deal_admission_id: writeSet.deal.deal_admission_id,
    document_hash: writeSet.deal.document_hash,
    subject_occurrence_id: claim.subject_occurrence_id,
    claim_occurrence_id: claim.claim_occurrence_id,
    expected_claim_revision_id: claim.claim_revision_id,
    expected_claim_payload_digest: claimPayloadDigest(claim),
    ...overrides,
  };
}

function evidenceFor(excerpt, evidenceRole) {
  return {
    evidence_role: evidenceRole,
    excerpt_id: excerpt.excerpt_id,
    document_ordinal: 0,
    absolute_start: excerpt.absolute_start,
    absolute_end: excerpt.absolute_end,
  };
}

function approve(correction, decision = 'PASS') {
  return buildCorrectionApprovalAttestation({
    correction,
    reviewer_id: 'reviewer:legal-semantic',
    reviewer_eligibility_evidence_digest: id('reviewer-eligibility'),
    authorisation_evidence_digest: id('authorisation'),
    decision,
    reason_digest: id(decision === 'PASS' ? 'approved' : 'rejected'),
  });
}

function correctionFor(slice, target, patch) {
  return buildPostScopeClaimCorrection({
    target: targetFor(slice.canonicalWriteSet, target),
    patch,
  });
}

test('an approved value and evidence correction creates one validated successor and preserves every sibling', () => {
  const slice = fixture();
  const writeSetBefore = canonicalJson(slice.canonicalWriteSet);
  const target = slice.durationClaims.notice;
  const correction = correctionFor(slice, target, {
    raw_value: 'within thirty-six (36) hours',
    canonical_value: '1.5',
    evidence: [
      evidenceFor(slice.excerpts.notice_clock, 'OPERATIVE_TEXT'),
      evidenceFor(slice.excerpts.notice, 'CROSS_REFERENCE'),
    ],
    normalisation_version: 'reviewed-correction/v1',
    derivation_version: 'reviewed-correction/v1',
  });
  const approval = approve(correction);

  const first = applyApprovedPostScopeClaimCorrection({
    writeSet: slice.canonicalWriteSet,
    correction,
    approval,
    contractBundle,
  });
  const reextracted = fixture();
  const second = applyApprovedPostScopeClaimCorrection({
    writeSet: reextracted.canonicalWriteSet,
    correction,
    approval,
    contractBundle,
  });

  assert.equal(canonicalJson(first), canonicalJson(second));
  assert.equal(canonicalJson(slice.canonicalWriteSet), writeSetBefore);
  assert.equal(first.predecessor_claim_revision.claim_revision_id, target.claim_revision_id);
  assert.equal(first.successor_claim_revision.claim_occurrence_id, target.claim_occurrence_id);
  assert.notEqual(first.successor_claim_revision.claim_revision_id, target.claim_revision_id);
  assert.equal(first.successor_claim_revision.canonical_value, '1.5');
  assert.equal(first.successor_claim_revision.evidence.length, 2);
  assert.equal(first.lineage.predecessor_claim_revision_id, target.claim_revision_id);
  assert.equal(first.lineage.successor_claim_revision_id, first.successor_claim_revision.claim_revision_id);
  assert.equal(first.validation.counts.residuals, 0);
  assert.equal(first.validation.publishableWriteSet.claims.length, slice.canonicalWriteSet.claims.length);

  const siblingIds = (claims) => claims
    .filter((claim) => claim.claim_occurrence_id !== target.claim_occurrence_id)
    .map((claim) => claim.claim_revision_id)
    .sort();
  assert.deepEqual(
    siblingIds(first.corrected_write_set.claims),
    siblingIds(slice.canonicalWriteSet.claims),
  );
});

test('stale predecessors, wrong governed subjects and non-passing approvals fail closed', () => {
  const slice = fixture();
  const target = slice.durationClaims.notice;
  const patch = { canonical_value: '1.5', normalisation_version: 'reviewed-correction/v1' };

  const stale = buildPostScopeClaimCorrection({
    target: targetFor(slice.canonicalWriteSet, target, {
      expected_claim_revision_id: id('superseded-revision'),
    }),
    patch,
  });
  assert.throws(() => applyApprovedPostScopeClaimCorrection({
    writeSet: slice.canonicalWriteSet,
    correction: stale,
    approval: approve(stale),
    contractBundle,
  }), (error) => error.code === 'STALE_CORRECTION');

  const wrongSubject = buildPostScopeClaimCorrection({
    target: targetFor(slice.canonicalWriteSet, target, { deal_key: 'deal:not-landos' }),
    patch,
  });
  assert.throws(() => applyApprovedPostScopeClaimCorrection({
    writeSet: slice.canonicalWriteSet,
    correction: wrongSubject,
    approval: approve(wrongSubject),
    contractBundle,
  }), (error) => error.code === 'WRONG_CORRECTION_SUBJECT');

  const rejected = correctionFor(slice, target, patch);
  assert.throws(() => applyApprovedPostScopeClaimCorrection({
    writeSet: slice.canonicalWriteSet,
    correction: rejected,
    approval: approve(rejected, 'FAIL'),
    contractBundle,
  }), (error) => error.code === 'CORRECTION_NOT_APPROVED');
});

test('approval substitution, no-effect patches and invalid corrected evidence cannot publish', () => {
  const slice = fixture();
  const target = slice.durationClaims.notice;
  const correction = correctionFor(slice, target, { canonical_value: '1.5' });
  const otherCorrection = correctionFor(slice, target, { canonical_value: '2' });
  assert.throws(() => applyApprovedPostScopeClaimCorrection({
    writeSet: slice.canonicalWriteSet,
    correction,
    approval: approve(otherCorrection),
    contractBundle,
  }), (error) => error.code === 'CORRECTION_APPROVAL_MISMATCH');

  const noEffect = correctionFor(slice, target, { canonical_value: target.canonical_value });
  assert.throws(() => applyApprovedPostScopeClaimCorrection({
    writeSet: slice.canonicalWriteSet,
    correction: noEffect,
    approval: approve(noEffect),
    contractBundle,
  }), (error) => error.code === 'NO_EFFECT_CORRECTION');

  const missingEvidence = correctionFor(slice, target, {
    evidence: [{
      evidence_role: 'OPERATIVE_TEXT',
      excerpt_id: id('missing-excerpt'),
      document_ordinal: 0,
      absolute_start: target.evidence[0].absolute_start,
      absolute_end: target.evidence[0].absolute_end,
    }],
  });
  assert.throws(() => applyApprovedPostScopeClaimCorrection({
    writeSet: slice.canonicalWriteSet,
    correction: missingEvidence,
    approval: approve(missingEvidence),
    contractBundle,
  }), (error) => error.code === 'CORRECTED_TARGET_NOT_PUBLISHABLE');

  const quarantinedWriteSet = structuredClone(slice.canonicalWriteSet);
  const quarantinedTarget = quarantinedWriteSet.claims.find(
    (claim) => claim.claim_revision_id === target.claim_revision_id,
  );
  quarantinedTarget.publication_state = 'QUARANTINED';
  quarantinedTarget.retained_residuals = [{
    schema_version: 'RETAINED_RESIDUAL/V1',
    retained_residual_id: id('retained-residual'),
    affected_object_type: 'ClaimRevision',
    affected_object_id: quarantinedTarget.claim_revision_id,
    reason: 'UNKNOWN_ATTRIBUTE',
    attribute: 'unreviewed_field',
    raw_value: 'must survive correction',
  }];
  quarantinedTarget.quarantine = {
    affected_object_type: 'ClaimRevision',
    affected_object_id: quarantinedTarget.claim_revision_id,
    reason_codes: ['UNKNOWN_ATTRIBUTE'],
  };
  const cannotLaunder = buildPostScopeClaimCorrection({
    target: targetFor(quarantinedWriteSet, quarantinedTarget),
    patch: { canonical_value: '1.5' },
  });
  assert.throws(() => applyApprovedPostScopeClaimCorrection({
    writeSet: quarantinedWriteSet,
    correction: cannotLaunder,
    approval: approve(cannotLaunder),
    contractBundle,
  }), (error) => error.code === 'CORRECTED_TARGET_NOT_PUBLISHABLE');
});
