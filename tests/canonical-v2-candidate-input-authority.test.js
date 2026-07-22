const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const {
  RECHECK_RPC,
  SELECTOR_RPC,
  MAX_AUTHORITY_MATERIALISATIONS,
  buildCandidateCorrectionInputSealV2,
  buildCandidateInputEvent,
  buildCandidateInputHead,
  buildCorrectionAuthorityMaterialisation,
  buildCorrectionDischargeMap,
  recheckCandidateInputHead,
  selectTrustedCandidateInputs,
  validateCandidateInputEvent,
  validateCandidateCorrectionInputSealV2,
  validateCandidateInputAuthoritySelection,
  validateCandidateInputHead,
  validateCorrectionAuthorityMaterialisation,
  validateCorrectionDischargeMap,
  validateAuthorityMaterialisationCount,
} = require('../lib/canonical-v2/candidate-input-authority');
const {
  buildCorrectionDischarge,
  buildCorrectionOutputRef,
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
const id = (value) => contentId('CANDIDATE_INPUT_AUTHORITY_TEST/V1', value);

function correctionMaterialisation(derivationVersion = 'reviewed-correction/authority-v1') {
  const slice = buildReviewedNoShopSlice({ sourceText, contractBundle });
  const claim = slice.durationClaims.notice;
  const correction = buildPostScopeClaimCorrection({
    target: {
      deal_key: slice.canonicalWriteSet.deal.deal_key,
      deal_admission_id: slice.canonicalWriteSet.deal.deal_admission_id,
      document_hash: slice.canonicalWriteSet.deal.document_hash,
      subject_occurrence_id: claim.subject_occurrence_id,
      claim_occurrence_id: claim.claim_occurrence_id,
      expected_claim_revision_id: claim.claim_revision_id,
      expected_claim_payload_digest: claimPayloadDigest(claim),
    },
    patch: { derivation_version: derivationVersion },
  });
  const approval = buildCorrectionApprovalAttestation({
    correction,
    reviewer_id: 'reviewer:legal-semantic',
    reviewer_eligibility_evidence_digest: id('reviewer-eligibility'),
    authorisation_evidence_digest: id('authorisation'),
    decision: 'PASS',
    reason_digest: id(derivationVersion),
  });
  const correctionOutput = applyApprovedPostScopeClaimCorrection({
    writeSet: slice.canonicalWriteSet,
    correction,
    approval,
    contractBundle,
  });
  return {
    correction_output: correctionOutput,
    correction_discharge: buildCorrectionDischarge({
      correction_output: correctionOutput,
      contract_bundle: contractBundle,
    }),
  };
}

function emptyAuthority() {
  const map = buildCorrectionDischargeMap({
    contract_bundle: contractBundle,
    correction_materialisations: [],
  });
  const head = buildCandidateInputHead({
    generation: 8,
    correction_discharge_map: map,
  });
  return { map, head };
}

test('an explicit empty correction authority map, sealed head and genesis event are immutable', () => {
  const { map, head } = emptyAuthority();
  const event = buildCandidateInputEvent({
    successor_candidate_input_head: head,
    successor_correction_discharge_map: map,
  });

  assert.equal(map.schema_version, 'CORRECTION_DISCHARGE_MAP/V1');
  assert.deepEqual(map.ordered_entries, []);
  assert.equal(map.counts.ordered_entries, 0);
  assert.equal(head.environment, 'staging');
  assert.equal(head.status, 'SEALED');
  assert.equal(head.contract_fingerprint, contractBundle.fingerprint);
  assert.equal(event.transition, 'INITIALISE');
  assert.equal(event.predecessor_candidate_input_head_id, null);
  assert.equal(Object.isFrozen(map), true);
  assert.equal(Object.isFrozen(head), true);
  assert.equal(validateCorrectionDischargeMap({
    correction_discharge_map: map,
    contract_bundle: contractBundle,
  }), true);
  assert.equal(validateCandidateInputHead({
    candidate_input_head: head,
    correction_discharge_map: map,
  }), true);
  assert.equal(validateCandidateInputEvent({
    candidate_input_event: event,
    successor_candidate_input_head: head,
    successor_correction_discharge_map: map,
  }), true);
  assert.throws(() => buildCorrectionDischargeMap({
    contract_bundle: contractBundle,
  }), (error) => error.code === 'INVALID_CORRECTION_DISCHARGE_MAP');
  assert.throws(() => buildCandidateInputHead({
    environment: 'production',
    generation: 8,
    correction_discharge_map: map,
  }), (error) => error.code === 'INVALID_CANDIDATE_INPUT_HEAD');
});

test('the compact map canonically binds separately stored full correction materialisations', () => {
  const materialisation = correctionMaterialisation();
  const authorityMaterialisation = buildCorrectionAuthorityMaterialisation({
    correction_materialisation: materialisation,
    contract_bundle: contractBundle,
  });
  const map = buildCorrectionDischargeMap({
    contract_bundle: contractBundle,
    correction_materialisations: [materialisation],
  });
  const [entry] = map.ordered_entries;

  assert.equal(validateCorrectionAuthorityMaterialisation({
    correction_authority_materialisation: authorityMaterialisation,
    contract_bundle: contractBundle,
  }), true);
  assert.equal(entry.correction_application_id, authorityMaterialisation.correction_application_id);
  assert.equal(entry.correction_discharge_id, authorityMaterialisation.correction_discharge_id);
  assert.equal(
    entry.correction_authority_materialisation_id,
    authorityMaterialisation.correction_authority_materialisation_id,
  );
  assert.equal(
    entry.correction_authority_materialisation_payload_digest,
    authorityMaterialisation.canonical_payload_digest,
  );
  assert.equal(Object.hasOwn(entry, 'correction_output'), false);

  const tamperedMaterialisation = structuredClone(authorityMaterialisation);
  tamperedMaterialisation.correction_discharge.status = 'FAIL';
  assert.throws(() => validateCorrectionAuthorityMaterialisation({
    correction_authority_materialisation: tamperedMaterialisation,
    contract_bundle: contractBundle,
  }));

  const tamperedMap = structuredClone(map);
  tamperedMap.ordered_entries[0].correction_discharge_id = id('different-discharge');
  assert.throws(() => validateCorrectionDischargeMap({
    correction_discharge_map: tamperedMap,
    contract_bundle: contractBundle,
  }), (error) => error.code === 'INVALID_CORRECTION_DISCHARGE_MAP');
});

test('an advance event binds the exact predecessor, successor and successor map', () => {
  const first = emptyAuthority();
  const secondMap = buildCorrectionDischargeMap({
    contract_bundle: contractBundle,
    correction_materialisations: [correctionMaterialisation()],
  });
  const secondHead = buildCandidateInputHead({
    generation: first.head.generation + 1,
    correction_discharge_map: secondMap,
    previous_candidate_input_head_id: first.head.candidate_input_head_id,
  });
  const event = buildCandidateInputEvent({
    predecessor_candidate_input_head: first.head,
    predecessor_correction_discharge_map: first.map,
    successor_candidate_input_head: secondHead,
    successor_correction_discharge_map: secondMap,
  });

  assert.equal(event.transition, 'ADVANCE');
  assert.equal(event.predecessor_candidate_input_head_id, first.head.candidate_input_head_id);
  assert.equal(event.successor_candidate_input_head_id, secondHead.candidate_input_head_id);
  assert.equal(event.correction_discharge_map_id, secondMap.correction_discharge_map_id);
  assert.equal(validateCandidateInputEvent({
    candidate_input_event: event,
    predecessor_candidate_input_head: first.head,
    predecessor_correction_discharge_map: first.map,
    successor_candidate_input_head: secondHead,
    successor_correction_discharge_map: secondMap,
  }), true);

  const skippedHead = buildCandidateInputHead({
    generation: first.head.generation + 2,
    correction_discharge_map: secondMap,
    previous_candidate_input_head_id: first.head.candidate_input_head_id,
  });
  assert.throws(() => buildCandidateInputEvent({
    predecessor_candidate_input_head: first.head,
    predecessor_correction_discharge_map: first.map,
    successor_candidate_input_head: skippedHead,
    successor_correction_discharge_map: secondMap,
  }), (error) => error.code === 'INVALID_CANDIDATE_INPUT_EVENT');
});

test('trusted selection makes one current-head RPC and derives active IDs from validated records', async () => {
  const materialisation = correctionMaterialisation();
  const authorityMaterialisation = buildCorrectionAuthorityMaterialisation({
    correction_materialisation: materialisation,
    contract_bundle: contractBundle,
  });
  const map = buildCorrectionDischargeMap({
    contract_bundle: contractBundle,
    correction_materialisations: [materialisation],
  });
  const head = buildCandidateInputHead({ generation: 9, correction_discharge_map: map });
  const calls = [];
  const selected = await selectTrustedCandidateInputs({
    client: {
      rpc(name, params) {
        calls.push({ name, params });
        return Promise.resolve({
          data: {
            captured_candidate_input_head: head,
            correction_discharge_map: map,
            ordered_materialisations: [authorityMaterialisation],
          },
          error: null,
        });
      },
    },
    contract_bundle: contractBundle,
  });

  assert.deepEqual(calls, [{
    name: SELECTOR_RPC,
    params: {
      p_environment: 'staging',
      p_contract_fingerprint: contractBundle.fingerprint,
    },
  }]);
  assert.deepEqual(selected.active_correction_application_ids, [
    authorityMaterialisation.correction_application_id,
  ]);
  assert.equal(canonicalJson(selected.candidate_input_head), canonicalJson(head));
  assert.equal(selected.correction_materialisations.length, 1);
  assert.equal(Object.isFrozen(selected), true);
});

test('trusted selection rejects missing materialisations and never retries a failed RPC', async () => {
  const materialisation = correctionMaterialisation();
  const map = buildCorrectionDischargeMap({
    contract_bundle: contractBundle,
    correction_materialisations: [materialisation],
  });
  const head = buildCandidateInputHead({ generation: 9, correction_discharge_map: map });
  let incompleteCalls = 0;
  await assert.rejects(selectTrustedCandidateInputs({
    client: {
      rpc() {
        incompleteCalls += 1;
        return { data: {
          captured_candidate_input_head: head,
          correction_discharge_map: map,
          ordered_materialisations: [],
        }, error: null };
      },
    },
    contract_bundle: contractBundle,
  }), (error) => error.code === 'INCOMPLETE_CANDIDATE_INPUT_SELECTOR');
  assert.equal(incompleteCalls, 1);

  let failedCalls = 0;
  await assert.rejects(selectTrustedCandidateInputs({
    client: {
      rpc() {
        failedCalls += 1;
        return Promise.reject(new Error('database unavailable'));
      },
    },
    contract_bundle: contractBundle,
  }), (error) => error.code === 'CANDIDATE_INPUT_SELECTOR_FAILED');
  assert.equal(failedCalls, 1);

  let timeoutCalls = 0;
  await assert.rejects(selectTrustedCandidateInputs({
    client: {
      rpc() {
        timeoutCalls += 1;
        return new Promise(() => {});
      },
    },
    contract_bundle: contractBundle,
    timeout_ms: 1,
  }), (error) => error.code === 'CANDIDATE_INPUT_SELECTOR_TIMEOUT');
  assert.equal(timeoutCalls, 1);
});

test('the separate bounded recheck accepts only the exact captured head and never retries', async () => {
  const { map, head } = emptyAuthority();
  const calls = [];
  assert.equal(await recheckCandidateInputHead({
    client: {
      rpc(name, params) {
        calls.push({ name, params });
        return { data: { current_candidate_input_head: head }, error: null };
      },
    },
    candidate_input_head: head,
  }), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, RECHECK_RPC);
  assert.equal(calls[0].params.p_expected_candidate_input_head_id, head.candidate_input_head_id);

  const advancedHead = buildCandidateInputHead({
    generation: head.generation + 1,
    correction_discharge_map: map,
    previous_candidate_input_head_id: head.candidate_input_head_id,
  });
  let changedCalls = 0;
  await assert.rejects(recheckCandidateInputHead({
    client: {
      rpc() {
        changedCalls += 1;
        return { data: { current_candidate_input_head: advancedHead }, error: null };
      },
    },
    candidate_input_head: head,
  }), (error) => error.code === 'CANDIDATE_INPUT_HEAD_CHANGED');
  assert.equal(changedCalls, 1);
});

test('Seal V2 binds an explicit empty authority head and map without caller-supplied IDs', async () => {
  const { map, head } = emptyAuthority();
  const authoritySelection = await selectTrustedCandidateInputs({
    client: {
      rpc() {
        return { data: {
          captured_candidate_input_head: head,
          correction_discharge_map: map,
          ordered_materialisations: [],
        }, error: null };
      },
    },
    contract_bundle: contractBundle,
  });
  const seal = buildCandidateCorrectionInputSealV2({
    authority_selection: authoritySelection,
    contract_bundle: contractBundle,
    release_correction_materialisations: [],
  });

  assert.equal(validateCandidateInputAuthoritySelection({
    authority_selection: authoritySelection,
    contract_bundle: contractBundle,
  }), true);
  assert.equal(validateCandidateCorrectionInputSealV2(seal), true);
  assert.equal(seal.schema_version, 'CANDIDATE_CORRECTION_INPUT_SEAL/V2');
  assert.equal(seal.candidate_input_head_id, head.candidate_input_head_id);
  assert.equal(seal.candidate_input_head_payload_digest, head.canonical_payload_digest);
  assert.equal(seal.correction_discharge_map_id, map.correction_discharge_map_id);
  assert.equal(seal.correction_discharge_map_payload_digest, map.canonical_payload_digest);
  assert.deepEqual(seal.expected_active_application_ids, []);
  assert.deepEqual(seal.correction_entries, []);

  for (const field of [
    'candidate_input_head_id',
    'candidate_input_head_payload_digest',
    'correction_discharge_map_id',
    'correction_discharge_map_payload_digest',
  ]) {
    const tampered = structuredClone(seal);
    tampered[field] = id(`tampered:${field}`);
    assert.throws(
      () => validateCandidateCorrectionInputSealV2(tampered),
      (error) => error.code === 'INVALID_CORRECTION_INPUT_SEAL_V2',
    );
  }
  for (const root of [
    'authority_active_correction_application_root',
    'correction_authority_materialisation_root',
    'authority_correction_discharge_root',
    'expected_active_application_root',
    'correction_entry_root',
    'correction_discharge_root',
  ]) {
    const tampered = structuredClone(seal);
    tampered.roots[root] = id(`tampered-root:${root}`);
    assert.throws(
      () => validateCandidateCorrectionInputSealV2(tampered),
      (error) => error.code === 'INVALID_CORRECTION_INPUT_SEAL_V2',
    );
  }
});

test('Seal V2 rejects release materialisations missing from or extra to the authority map', async () => {
  const materialisation = correctionMaterialisation();
  const authorityMaterialisation = buildCorrectionAuthorityMaterialisation({
    correction_materialisation: materialisation,
    contract_bundle: contractBundle,
  });
  const map = buildCorrectionDischargeMap({
    contract_bundle: contractBundle,
    correction_materialisations: [materialisation],
  });
  const head = buildCandidateInputHead({ generation: 10, correction_discharge_map: map });
  const authoritySelection = await selectTrustedCandidateInputs({
    client: { rpc: () => ({ data: {
      captured_candidate_input_head: head,
      correction_discharge_map: map,
      ordered_materialisations: [authorityMaterialisation],
    }, error: null }) },
    contract_bundle: contractBundle,
  });

  const exactSeal = buildCandidateCorrectionInputSealV2({
    authority_selection: authoritySelection,
    contract_bundle: contractBundle,
    release_correction_materialisations: [materialisation],
  });
  assert.equal(validateCandidateCorrectionInputSealV2(exactSeal), true);

  assert.throws(() => buildCandidateCorrectionInputSealV2({
    authority_selection: authoritySelection,
    contract_bundle: contractBundle,
    release_correction_materialisations: [],
  }), (error) => error.code === 'CORRECTION_AUTHORITY_MATERIALISATION_MISMATCH');

  const empty = emptyAuthority();
  const emptySelection = await selectTrustedCandidateInputs({
    client: { rpc: () => ({ data: {
      captured_candidate_input_head: empty.head,
      correction_discharge_map: empty.map,
      ordered_materialisations: [],
    }, error: null }) },
    contract_bundle: contractBundle,
  });
  assert.throws(() => buildCandidateCorrectionInputSealV2({
    authority_selection: emptySelection,
    contract_bundle: contractBundle,
    release_correction_materialisations: [materialisation],
  }), (error) => error.code === 'CORRECTION_AUTHORITY_MATERIALISATION_MISMATCH');

  const differentDischarge = buildCorrectionDischarge({
    correction_output: materialisation.correction_output,
    contract_bundle: contractBundle,
    consistency_output_refs: [buildCorrectionOutputRef({
      role: 'CONSISTENCY',
      logical_type: 'SHARED_SERVING_ROW',
      stable_key: 'same-application-different-discharge',
      immutable_id: id('different-discharge-row'),
      canonical_payload_digest: id('different-discharge-row-payload'),
    })],
  });
  assert.equal(
    differentDischarge.correction_application_id,
    materialisation.correction_discharge.correction_application_id,
  );
  assert.notEqual(
    differentDischarge.correction_discharge_id,
    materialisation.correction_discharge.correction_discharge_id,
  );
  assert.throws(() => buildCandidateCorrectionInputSealV2({
    authority_selection: authoritySelection,
    contract_bundle: contractBundle,
    release_correction_materialisations: [{
      correction_output: materialisation.correction_output,
      correction_discharge: differentDischarge,
    }],
  }), (error) => error.code === 'CORRECTION_AUTHORITY_MATERIALISATION_MISMATCH');
});

test('authority materialisation arrays are bounded at 512 before payload validation', () => {
  assert.equal(MAX_AUTHORITY_MATERIALISATIONS, 512);
  assert.equal(validateAuthorityMaterialisationCount(new Array(512).fill(null)), true);
  assert.throws(
    () => validateAuthorityMaterialisationCount(new Array(513).fill(null)),
    (error) => error.code === 'AUTHORITY_MATERIALISATION_LIMIT_EXCEEDED'
      && error.details.count === 513
      && error.details.maximum === 512,
  );
  assert.throws(() => buildCorrectionDischargeMap({
    contract_bundle: contractBundle,
    correction_materialisations: new Array(513).fill(null),
  }), (error) => error.code === 'AUTHORITY_MATERIALISATION_LIMIT_EXCEEDED');
});
