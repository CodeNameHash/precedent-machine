const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const {
  buildCandidateCorrectionInputSeal,
  buildCorrectionDischarge,
  buildCorrectionOutputRef,
  validateCandidateCorrectionInputSeal,
  validateCorrectionDischarge,
} = require('../lib/canonical-v2/candidate-correction-input');
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
const id = (value) => contentId('CANDIDATE_CORRECTION_INPUT_TEST/V1', value);

function fixture() {
  return buildReviewedNoShopSlice({ sourceText, contractBundle });
}

function correctionTarget(writeSet, claim) {
  return {
    deal_key: writeSet.deal.deal_key,
    deal_admission_id: writeSet.deal.deal_admission_id,
    document_hash: writeSet.deal.document_hash,
    subject_occurrence_id: claim.subject_occurrence_id,
    claim_occurrence_id: claim.claim_occurrence_id,
    expected_claim_revision_id: claim.claim_revision_id,
    expected_claim_payload_digest: claimPayloadDigest(claim),
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

function approve(correction) {
  return buildCorrectionApprovalAttestation({
    correction,
    reviewer_id: 'reviewer:legal-semantic',
    reviewer_eligibility_evidence_digest: id('reviewer-eligibility'),
    authorisation_evidence_digest: id('authorisation'),
    decision: 'PASS',
    reason_digest: id('source-backed-evidence-correction'),
  });
}

function applyCorrection({ writeSet, claim, patch, supersededCorrectionIds = [] }) {
  const correction = buildPostScopeClaimCorrection({
    target: correctionTarget(writeSet, claim),
    patch,
    superseded_correction_ids: supersededCorrectionIds,
  });
  return applyApprovedPostScopeClaimCorrection({
    writeSet,
    correction,
    approval: approve(correction),
    contractBundle,
  });
}

function firstCorrection(slice = fixture()) {
  return applyCorrection({
    writeSet: slice.canonicalWriteSet,
    claim: slice.durationClaims.notice,
    patch: {
      evidence: [
        evidenceFor(slice.excerpts.notice, 'CROSS_REFERENCE'),
        evidenceFor(slice.excerpts.notice_clock, 'OPERATIVE_TEXT'),
      ],
      derivation_version: 'reviewed-correction/v2',
    },
  });
}

function materialise(correctionOutput, consistencyOutputRefs = []) {
  const discharge = buildCorrectionDischarge({
    correction_output: correctionOutput,
    contract_bundle: contractBundle,
    consistency_output_refs: consistencyOutputRefs,
  });
  return { correction_output: correctionOutput, correction_discharge: discharge };
}

test('a mandatory empty correction input produces a deterministic non-null seal', () => {
  const input = {
    contract_bundle: contractBundle,
    expected_active_application_ids: [],
    correction_materialisations: [],
  };
  const first = buildCandidateCorrectionInputSeal(input);
  const second = buildCandidateCorrectionInputSeal(input);

  assert.equal(canonicalJson(first), canonicalJson(second));
  assert.equal(validateCandidateCorrectionInputSeal(first), true);
  assert.equal(first.status, 'PASS');
  assert.equal(first.counts.expected_active_applications, 0);
  assert.equal(first.counts.correction_entries, 0);
  assert.match(first.candidate_correction_input_seal_id, /^[a-f0-9]{64}$/);
  assert.throws(() => buildCandidateCorrectionInputSeal({
    contract_bundle: contractBundle,
    correction_materialisations: [],
  }), (error) => error.code === 'INVALID_CORRECTION_INPUT');
  assert.throws(() => buildCandidateCorrectionInputSeal({
    contract_bundle: contractBundle,
    expected_active_application_ids: [],
  }), (error) => error.code === 'INVALID_CORRECTION_INPUT');
});

test('one active correction binds exact approval, application, lineage, successor and discharge', () => {
  const correctionOutput = firstCorrection();
  const consistencyRef = buildCorrectionOutputRef({
    role: 'CONSISTENCY',
    logical_type: 'SHARED_SERVING_ROW',
    stable_key: 'row:deal:landos-abbvie:no-shop-notice',
    immutable_id: id('corrected-serving-row'),
    canonical_payload_digest: id('corrected-serving-row-payload'),
  });
  const materialisation = materialise(correctionOutput, [consistencyRef]);
  const seal = buildCandidateCorrectionInputSeal({
    contract_bundle: contractBundle,
    expected_active_application_ids: [correctionOutput.application.correction_application_id],
    correction_materialisations: [materialisation],
  });

  assert.equal(validateCorrectionDischarge({
    discharge: materialisation.correction_discharge,
    correction_output: correctionOutput,
    contract_bundle: contractBundle,
  }), true);
  assert.equal(validateCandidateCorrectionInputSeal(seal), true);
  assert.equal(seal.correction_entries.length, 1);
  const [entry] = seal.correction_entries;
  assert.equal(entry.correction_id, correctionOutput.correction.correction_id);
  assert.equal(entry.correction_approval_attestation_id, correctionOutput.approval.correction_approval_attestation_id);
  assert.equal(entry.correction_application_id, correctionOutput.application.correction_application_id);
  assert.equal(entry.correction_lineage_id, correctionOutput.lineage.post_scope_claim_revision_lineage_id);
  assert.equal(entry.predecessor_claim_revision_id, correctionOutput.predecessor_claim_revision.claim_revision_id);
  assert.equal(entry.successor_claim_revision_id, correctionOutput.successor_claim_revision.claim_revision_id);
  assert.deepEqual(entry.consistency_output_ref_ids, [consistencyRef.correction_output_ref_id]);
});

test('a fresh deterministic extraction reproduces the same correction discharge and candidate seal', () => {
  const first = firstCorrection(fixture());
  const second = firstCorrection(fixture());
  const firstMaterialisation = materialise(first);
  const secondMaterialisation = materialise(second);
  const firstSeal = buildCandidateCorrectionInputSeal({
    contract_bundle: contractBundle,
    expected_active_application_ids: [first.application.correction_application_id],
    correction_materialisations: [firstMaterialisation],
  });
  const secondSeal = buildCandidateCorrectionInputSeal({
    contract_bundle: contractBundle,
    expected_active_application_ids: [second.application.correction_application_id],
    correction_materialisations: [secondMaterialisation],
  });

  assert.equal(canonicalJson(firstMaterialisation.correction_discharge), canonicalJson(secondMaterialisation.correction_discharge));
  assert.equal(canonicalJson(firstSeal), canonicalJson(secondSeal));
});

test('omitted, extra and duplicate active applications fail closed', () => {
  const correctionOutput = firstCorrection();
  const applicationId = correctionOutput.application.correction_application_id;
  const materialisation = materialise(correctionOutput);

  assert.throws(() => buildCandidateCorrectionInputSeal({
    contract_bundle: contractBundle,
    expected_active_application_ids: [applicationId],
    correction_materialisations: [],
  }), (error) => error.code === 'INCOMPLETE_CORRECTION_INPUT'
    && error.details.missing_application_ids[0] === applicationId);
  assert.throws(() => buildCandidateCorrectionInputSeal({
    contract_bundle: contractBundle,
    expected_active_application_ids: [],
    correction_materialisations: [materialisation],
  }), (error) => error.code === 'INCOMPLETE_CORRECTION_INPUT'
    && error.details.extra_application_ids[0] === applicationId);
  assert.throws(() => buildCandidateCorrectionInputSeal({
    contract_bundle: contractBundle,
    expected_active_application_ids: [applicationId, applicationId],
    correction_materialisations: [materialisation],
  }), (error) => error.code === 'DUPLICATE_CORRECTION_INPUT');
  assert.throws(() => buildCandidateCorrectionInputSeal({
    contract_bundle: contractBundle,
    expected_active_application_ids: [applicationId],
    correction_materialisations: [materialisation, materialisation],
  }), (error) => error.code === 'DUPLICATE_CORRECTION_INPUT');
});

test('stale correction, approval, lineage, successor and discharge identities fail closed', () => {
  const correctionOutput = firstCorrection();
  const staleApproval = structuredClone(correctionOutput);
  staleApproval.approval.reason_digest = id('different-reason');
  assert.throws(() => buildCorrectionDischarge({
    correction_output: staleApproval,
    contract_bundle: contractBundle,
  }), (error) => error.code === 'STALE_CORRECTION_INPUT');

  const staleLineage = structuredClone(correctionOutput);
  staleLineage.lineage.successor_claim_payload_digest = id('stale-successor-payload');
  assert.throws(() => buildCorrectionDischarge({
    correction_output: staleLineage,
    contract_bundle: contractBundle,
  }), (error) => error.code === 'STALE_CORRECTION_INPUT');

  const staleSuccessor = structuredClone(correctionOutput);
  staleSuccessor.successor_claim_revision.canonical_value = '2';
  assert.throws(() => buildCorrectionDischarge({
    correction_output: staleSuccessor,
    contract_bundle: contractBundle,
  }), (error) => error.code === 'STALE_CORRECTION_INPUT');

  const materialisation = materialise(correctionOutput);
  const staleDischarge = structuredClone(materialisation.correction_discharge);
  staleDischarge.successor_claim_revision_id = id('different-successor');
  assert.throws(() => validateCorrectionDischarge({
    discharge: staleDischarge,
    correction_output: correctionOutput,
    contract_bundle: contractBundle,
  }), (error) => error.code === 'INVALID_CORRECTION_DISCHARGE');
});

test('a correction superseded by another correction cannot remain in the active seal', () => {
  const first = firstCorrection();
  const second = applyCorrection({
    writeSet: first.corrected_write_set,
    claim: first.successor_claim_revision,
    patch: { derivation_version: 'reviewed-correction/v3' },
    supersededCorrectionIds: [first.correction.correction_id],
  });
  const firstMaterialisation = materialise(first);
  const secondMaterialisation = materialise(second);

  assert.throws(() => buildCandidateCorrectionInputSeal({
    contract_bundle: contractBundle,
    expected_active_application_ids: [
      first.application.correction_application_id,
      second.application.correction_application_id,
    ],
    correction_materialisations: [firstMaterialisation, secondMaterialisation],
  }), (error) => error.code === 'SUPERSEDED_CORRECTION_INPUT');

  const terminalSeal = buildCandidateCorrectionInputSeal({
    contract_bundle: contractBundle,
    expected_active_application_ids: [second.application.correction_application_id],
    correction_materialisations: [secondMaterialisation],
  });
  assert.equal(validateCandidateCorrectionInputSeal(terminalSeal), true);
  assert.deepEqual(terminalSeal.correction_entries[0].superseded_correction_ids, [first.correction.correction_id]);
});

test('two unsuperseded corrections cannot both claim the same governed occurrence', () => {
  const slice = fixture();
  const first = firstCorrection(slice);
  const competing = applyCorrection({
    writeSet: slice.canonicalWriteSet,
    claim: slice.durationClaims.notice,
    patch: { derivation_version: 'competing-reviewed-correction/v2' },
  });
  assert.throws(() => buildCandidateCorrectionInputSeal({
    contract_bundle: contractBundle,
    expected_active_application_ids: [
      first.application.correction_application_id,
      competing.application.correction_application_id,
    ],
    correction_materialisations: [materialise(first), materialise(competing)],
  }), (error) => error.code === 'CONFLICTING_CORRECTION_INPUT');
});

test('seal count, root and payload tampering is independently rejected', () => {
  const correctionOutput = firstCorrection();
  const seal = buildCandidateCorrectionInputSeal({
    contract_bundle: contractBundle,
    expected_active_application_ids: [correctionOutput.application.correction_application_id],
    correction_materialisations: [materialise(correctionOutput)],
  });

  const badRoot = structuredClone(seal);
  badRoot.roots.correction_entry_root = id('different-entry-root');
  assert.throws(() => validateCandidateCorrectionInputSeal(badRoot), (error) => (
    error.code === 'INVALID_CORRECTION_INPUT_SEAL'
  ));
  const badCount = structuredClone(seal);
  badCount.counts.correction_entries = 2;
  assert.throws(() => validateCandidateCorrectionInputSeal(badCount), (error) => (
    error.code === 'INVALID_CORRECTION_INPUT_SEAL'
  ));
  const badPayload = structuredClone(seal);
  badPayload.canonical_payload_digest = id('different-payload');
  assert.throws(() => validateCandidateCorrectionInputSeal(badPayload), (error) => (
    error.code === 'INVALID_CORRECTION_INPUT_SEAL'
  ));
});
