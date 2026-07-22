const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { canonicalJson, contentId, utf8ByteLength } = require('../lib/canonical-v2/canonical-bytes');
const { buildClaimRevision } = require('../lib/canonical-v2/claims-relationships');
const { compileFixtureContract } = require('../lib/canonical-v2/contract-bundle');
const { validateCorrectionValueEvidenceProof } = require('../lib/canonical-v2/correction-value-evidence');
const { normaliseDurationToDays } = require('../lib/canonical-v2/observation-normalisers');
const {
  applyApprovedPostScopeClaimCorrection,
  buildCorrectionApprovalAttestation,
  buildPostScopeClaimCorrection,
  claimPayloadDigest,
} = require('../lib/canonical-v2/post-scope-claim-correction');
const { buildReviewedNoShopSlice } = require('../lib/canonical-v2/reviewed-no-shop-slice');
const {
  buildExcerpt,
  buildFixtureSourceAdmission,
  buildImmutableSource,
  buildProvisionComponent,
  buildProvisionInstance,
  buildSemanticSpan,
} = require('../lib/canonical-v2/source-structure');

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

function correctionFor(slice, target, patch, writeSet = slice.canonicalWriteSet) {
  return buildPostScopeClaimCorrection({
    target: targetFor(writeSet, target),
    patch,
  });
}

function rebuildClaim(claim, patch = {}) {
  const field = (key) => (Object.hasOwn(patch, key) ? patch[key] : claim[key]);
  const taxonomyCodes = structuredClone(claim.taxonomy_codes || {});
  const built = buildClaimRevision({
    subject_occurrence_id: claim.subject_occurrence_id,
    claim_definition_key: claim.claim_definition_key,
    claim_definition_version: claim.claim_definition_version,
    ordinal: claim.ordinal,
    state: claim.state,
    raw_value: field('raw_value'),
    canonical_value: field('canonical_value'),
    unit: field('unit'),
    day_basis: field('day_basis'),
    denominator: field('denominator'),
    scope: structuredClone(claim.scope),
    applicability: structuredClone(claim.applicability),
    not_examined: structuredClone(claim.not_examined),
    failure: structuredClone(claim.failure),
    evidence: claim.evidence.map((edge) => ({
      evidence_role: edge.evidence_role,
      excerpt_id: edge.excerpt_id,
      document_ordinal: edge.document_ordinal,
      absolute_start: edge.absolute_start,
      absolute_end: edge.absolute_end,
    })),
    attributes: structuredClone(claim.attributes || {}),
    allowed_attributes: Object.keys(claim.attributes || {}),
    taxonomy_codes: taxonomyCodes,
    codebooks: Object.fromEntries(Object.entries(taxonomyCodes).map(([key, value]) => [key, [value]])),
    extraction_version: claim.extraction_version,
    normalisation_version: field('normalisation_version'),
    derivation_version: field('derivation_version'),
  });
  return {
    ...built,
    ...(claim.closure_id === undefined ? {} : { closure_id: claim.closure_id }),
  };
}

function writeSetWithClaim(writeSet, predecessor, successor) {
  return {
    ...structuredClone(writeSet),
    claims: writeSet.claims.map((claim) => (
      claim.claim_revision_id === predecessor.claim_revision_id ? successor : structuredClone(claim)
    )),
  };
}

function fixtureWithThirtySixHourTargetDocument() {
  const exactText = 'within thirty-six (36) hours';
  const source = buildImmutableSource({
    sourceBytes: exactText,
    sourceOccurrenceKey: 'reviewed-correction-target-36-hours',
  });
  const dealAdmissionId = id('36-hour-deal-admission');
  const admission = buildFixtureSourceAdmission({
    source,
    dealKey: 'deal:reviewed-correction-36-hours',
    dealAdmissionId,
    contractFingerprint: contractBundle.fingerprint,
  });
  const span = buildSemanticSpan({
    source,
    start: 0,
    end: utf8ByteLength(exactText),
  });
  const closureId = id('36-hour-publication-closure');
  const excerpt = { ...buildExcerpt({ source, span }), closure_id: closureId };
  const provision = buildProvisionInstance({
    source,
    span,
    conceptKey: 'NOSOL-NOTICE',
    party: { role: 'COVENANT_OBLIGOR', value: 'COMPANY', capacity: 'TARGET' },
    ordinal: 1,
  });
  const component = buildProvisionComponent({
    source,
    parentProvision: provision,
    span,
    componentKey: 'NOTICE_LIMB',
    ordinal: 1,
  });
  const priorNormalisation = normaliseDurationToDays({
    rawMagnitude: '24',
    rawUnit: 'HOURS',
    dayBasis: 'ELAPSED',
    trigger: 'RECEIPT_OF_COMPETING_PROPOSAL',
    derivationVersion: 'reviewed-correction-fixture/v1',
  });
  const claim = {
    ...buildClaimRevision({
      subject_occurrence_id: component.provision_component_id,
      claim_definition_key: 'NO_SHOP_NOTICE_PERIOD_DAYS',
      state: 'PRESENT',
      raw_value: 'within twenty-four (24) hours',
      canonical_value: priorNormalisation.canonical_value,
      unit: priorNormalisation.canonical_unit,
      day_basis: priorNormalisation.day_basis,
      attributes: {
        basis_key: priorNormalisation.basis_key,
        trigger: priorNormalisation.trigger,
        raw_magnitude: priorNormalisation.raw_value.magnitude,
        raw_unit: priorNormalisation.raw_value.unit,
        normalisation_payload_digest: priorNormalisation.normalisation_payload_digest,
      },
      allowed_attributes: [
        'basis_key', 'trigger', 'raw_magnitude', 'raw_unit', 'normalisation_payload_digest',
      ],
      evidence: [evidenceFor(excerpt, 'OPERATIVE_TEXT')],
      scope: {
        scope_closure_id: id('36-hour-claim-scope'),
        coverage_status: 'COMPLETE',
        required_interval_ids: [excerpt.excerpt_id],
        examined_interval_ids: [excerpt.excerpt_id],
      },
      extraction_version: 'reviewed-correction-fixture/v1',
      normalisation_version: 'reviewed-correction-fixture/v1',
      derivation_version: 'reviewed-correction-fixture/v1',
    }),
    closure_id: closureId,
  };
  const writeSet = {
    source,
    source_admission: admission,
    deal: {
      deal_key: admission.governed_deal_key,
      deal_admission_id: dealAdmissionId,
      document_hash: source.document_hash,
    },
    excerpts: [excerpt],
    provisions: [{ ...provision, closure_id: closureId }],
    components: [{ ...component, closure_id: closureId }],
    claims: [claim],
    relationships: [],
  };
  return { writeSet, claim, excerpt };
}

function crossAdmittedSourceThirtySixHourEvidence() {
  const slice = fixture();
  const exactText = 'within thirty-six (36) hours';
  const source = buildImmutableSource({
    sourceBytes: exactText,
    sourceOccurrenceKey: 'cross-admitted-correction-evidence-36-hours',
  });
  const admission = buildFixtureSourceAdmission({
    source,
    dealKey: slice.canonicalWriteSet.deal.deal_key,
    dealAdmissionId: slice.canonicalWriteSet.deal.deal_admission_id,
    contractFingerprint: contractBundle.fingerprint,
    sourceOrdinal: 1,
  });
  const span = buildSemanticSpan({ source, start: 0, end: utf8ByteLength(exactText) });
  const baseExcerpt = slice.canonicalWriteSet.excerpts.find((excerpt) => (
    excerpt.excerpt_id === slice.excerpts.notice_clock.excerpt_id
  ));
  const excerpt = { ...buildExcerpt({ source, span }), closure_id: baseExcerpt.closure_id };
  const writeSet = {
    ...structuredClone(slice.canonicalWriteSet),
    sources: [structuredClone(slice.canonicalWriteSet.source), source],
    source_admissions: [structuredClone(slice.canonicalWriteSet.source_admission), admission],
    excerpts: [...slice.canonicalWriteSet.excerpts.map((item) => structuredClone(item)), excerpt],
  };
  delete writeSet.source;
  delete writeSet.source_admission;
  return { slice, writeSet, excerpt };
}

test('source evidence can correct a bad notice duration canonical value back to one day', () => {
  const slice = fixture();
  const extracted = slice.canonicalWriteSet.claims.find((claim) => (
    claim.claim_revision_id === slice.durationClaims.notice.claim_revision_id
  ));
  const target = rebuildClaim(extracted, { canonical_value: '2' });
  const writeSet = writeSetWithClaim(slice.canonicalWriteSet, extracted, target);
  const writeSetBefore = canonicalJson(writeSet);
  const correction = correctionFor(slice, target, { canonical_value: '1' }, writeSet);
  const approval = approve(correction);

  const first = applyApprovedPostScopeClaimCorrection({
    writeSet,
    correction,
    approval,
    contractBundle,
  });
  const second = applyApprovedPostScopeClaimCorrection({
    writeSet: structuredClone(writeSet),
    correction,
    approval,
    contractBundle,
  });

  assert.equal(canonicalJson(first), canonicalJson(second));
  assert.equal(canonicalJson(writeSet), writeSetBefore);
  assert.equal(first.predecessor_claim_revision.claim_revision_id, target.claim_revision_id);
  assert.equal(first.successor_claim_revision.claim_occurrence_id, target.claim_occurrence_id);
  assert.notEqual(first.successor_claim_revision.claim_revision_id, target.claim_revision_id);
  assert.equal(first.successor_claim_revision.canonical_value, '1');
  assert.equal(first.successor_claim_revision.evidence.length, 1);
  assert.equal(first.value_evidence_proof.status, 'PASS');
  assert.equal(first.value_evidence_proof.duration_witness.magnitude, '24');
  assert.equal(first.value_evidence_proof.duration_witness.raw_unit, 'HOURS');
  assert.equal(validateCorrectionValueEvidenceProof(first.value_evidence_proof), true);
  assert.equal(first.lineage.predecessor_claim_revision_id, target.claim_revision_id);
  assert.equal(first.lineage.successor_claim_revision_id, first.successor_claim_revision.claim_revision_id);
  assert.equal(first.validation.counts.residuals, 0);
  assert.equal(first.validation.publishableWriteSet.claims.length, writeSet.claims.length);

  const siblingIds = (claims) => claims
    .filter((claim) => claim.claim_occurrence_id !== target.claim_occurrence_id)
    .map((claim) => claim.claim_revision_id)
    .sort();
  assert.deepEqual(
    siblingIds(first.corrected_write_set.claims),
    siblingIds(writeSet.claims),
  );
});

test('existing twenty-four-hour evidence cannot support a thirty-six-hour or 1.5-day correction', () => {
  const slice = fixture();
  const target = slice.durationClaims.notice;
  const correction = correctionFor(slice, target, {
    raw_value: 'within thirty-six (36) hours',
    canonical_value: '1.5',
  });
  assert.throws(() => applyApprovedPostScopeClaimCorrection({
    writeSet: slice.canonicalWriteSet,
    correction,
    approval: approve(correction),
    contractBundle,
  }), (error) => error.code === 'CORRECTED_VALUE_EVIDENCE_MISMATCH');
});

test('new exact thirty-six-hour evidence supports a 1.5-day successor and generated attributes', () => {
  const { writeSet, claim, excerpt } = fixtureWithThirtySixHourTargetDocument();
  const correction = buildPostScopeClaimCorrection({
    target: targetFor(writeSet, claim),
    patch: {
      raw_value: excerpt.exact_text,
      canonical_value: '1.5',
      evidence: [evidenceFor(excerpt, 'OPERATIVE_TEXT')],
    },
  });
  const result = applyApprovedPostScopeClaimCorrection({
    writeSet,
    correction,
    approval: approve(correction),
    contractBundle,
  });

  assert.equal(result.successor_claim_revision.raw_value, 'within thirty-six (36) hours');
  assert.equal(result.successor_claim_revision.canonical_value, '1.5');
  assert.equal(result.successor_claim_revision.attributes.raw_magnitude, '36');
  assert.equal(result.successor_claim_revision.attributes.raw_unit, 'HOURS');
  assert.equal(
    result.successor_claim_revision.attributes.normalisation_payload_digest,
    result.value_evidence_proof.normalisation_payload_digest,
  );
  assert.equal(validateCorrectionValueEvidenceProof(result.value_evidence_proof), true);
});

test('duration evidence from a different admitted document cannot prove the correction', () => {
  const { slice, writeSet, excerpt } = crossAdmittedSourceThirtySixHourEvidence();
  const target = slice.durationClaims.notice;
  const correction = correctionFor(slice, target, {
    raw_value: excerpt.exact_text,
    canonical_value: '1.5',
    evidence: [{ ...evidenceFor(excerpt, 'OPERATIVE_TEXT'), document_ordinal: 1 }],
  }, writeSet);
  assert.throws(() => applyApprovedPostScopeClaimCorrection({
    writeSet,
    correction,
    approval: approve(correction),
    contractBundle,
  }), (error) => error.code === 'INVALID_CORRECTION_EVIDENCE_SOURCE');
});

test('ambiguous duration evidence and day-basis substitution fail closed', () => {
  const slice = fixture();
  const target = slice.durationClaims.notice;
  const ambiguous = correctionFor(slice, target, {
    canonical_value: '4',
    evidence: [evidenceFor(slice.excerpts.initial_match, 'OPERATIVE_TEXT')],
  });
  assert.throws(() => applyApprovedPostScopeClaimCorrection({
    writeSet: slice.canonicalWriteSet,
    correction: ambiguous,
    approval: approve(ambiguous),
    contractBundle,
  }), (error) => error.code === 'AMBIGUOUS_DURATION_EVIDENCE');

  const substitutedBasis = correctionFor(slice, target, { day_basis: 'BUSINESS' });
  assert.throws(() => applyApprovedPostScopeClaimCorrection({
    writeSet: slice.canonicalWriteSet,
    correction: substitutedBasis,
    approval: approve(substitutedBasis),
    contractBundle,
  }), (error) => error.code === 'CORRECTED_VALUE_EVIDENCE_MISMATCH');
});

test('evidence-only and derivation-only corrections remain permitted without a value proof', () => {
  const slice = fixture();
  const target = slice.durationClaims.notice;
  const evidenceOnly = correctionFor(slice, target, {
    evidence: [
      evidenceFor(slice.excerpts.notice_clock, 'OPERATIVE_TEXT'),
      evidenceFor(slice.excerpts.notice, 'CROSS_REFERENCE'),
    ],
  });
  const evidenceResult = applyApprovedPostScopeClaimCorrection({
    writeSet: slice.canonicalWriteSet,
    correction: evidenceOnly,
    approval: approve(evidenceOnly),
    contractBundle,
  });
  assert.equal(evidenceResult.value_evidence_proof, null);
  assert.equal(evidenceResult.successor_claim_revision.evidence.length, 2);

  const derivationOnly = correctionFor(slice, target, { derivation_version: 'reviewed-correction/v1' });
  const derivationResult = applyApprovedPostScopeClaimCorrection({
    writeSet: slice.canonicalWriteSet,
    correction: derivationOnly,
    approval: approve(derivationOnly),
    contractBundle,
  });
  assert.equal(derivationResult.value_evidence_proof, null);
  assert.equal(derivationResult.successor_claim_revision.derivation_version, 'reviewed-correction/v1');
});

test('unsupported claim-definition value changes fail closed', () => {
  const slice = fixture();
  const target = slice.actionClaims[0];
  const correction = correctionFor(slice, target, { canonical_value: 'OTHER_PROHIBITED_ACTION' });
  assert.throws(() => applyApprovedPostScopeClaimCorrection({
    writeSet: slice.canonicalWriteSet,
    correction,
    approval: approve(correction),
    contractBundle,
  }), (error) => error.code === 'UNSUPPORTED_CORRECTION_VALUE_EVIDENCE');
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
    patch: { derivation_version: 'reviewed-correction/v1' },
  });
  assert.throws(() => applyApprovedPostScopeClaimCorrection({
    writeSet: quarantinedWriteSet,
    correction: cannotLaunder,
    approval: approve(cannotLaunder),
    contractBundle,
  }), (error) => error.code === 'CORRECTED_TARGET_NOT_PUBLISHABLE');
});
