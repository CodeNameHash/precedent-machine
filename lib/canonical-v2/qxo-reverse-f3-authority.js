const { contentId } = require('./canonical-bytes');
const {
  buildCandidateInputEvent,
  buildCandidateInputHead,
  buildCorrectionDischargeMap,
} = require('./candidate-input-authority');
const { compileFixtureContractV3 } = require('./contract-bundle');
const {
  QXO_REVERSE_F3_CONTRACT_FINGERPRINT,
} = require('./qxo-reverse-candidate-identity');

const OPERATION = 'FIXTURE_CORRECTION_AUTHORITY';
const IDEMPOTENCY_KEY = 'canonical-v2-empty-correction-authority-f3-genesis-v1';

function buildQxoReverseF3AuthorityGenesis() {
  const contractBundle = compileFixtureContractV3();
  if (contractBundle.fingerprint !== QXO_REVERSE_F3_CONTRACT_FINGERPRINT) {
    throw new Error('The F3 contract fingerprint has drifted.');
  }
  const correctionDischargeMap = buildCorrectionDischargeMap({
    contract_bundle: contractBundle,
    correction_materialisations: [],
  });
  const candidateInputHead = buildCandidateInputHead({
    environment: 'staging',
    generation: 1,
    correction_discharge_map: correctionDischargeMap,
    previous_candidate_input_head_id: null,
  });
  const candidateInputEvent = buildCandidateInputEvent({
    predecessor_candidate_input_head: null,
    predecessor_correction_discharge_map: null,
    successor_candidate_input_head: candidateInputHead,
    successor_correction_discharge_map: correctionDischargeMap,
  });
  const writeSet = Object.freeze({
    correction_authority_materialisations: Object.freeze([]),
    correction_discharge_map: correctionDischargeMap,
    candidate_input_event: candidateInputEvent,
    expected_candidate_input_head: null,
    next_candidate_input_head: candidateInputHead,
  });
  const inputDigest = contentId('CANONICAL_WRITE_INPUT/V1', {
    operation: OPERATION,
    idempotencyKey: IDEMPOTENCY_KEY,
    writeSet,
  });
  const receiptBody = {
    operation: OPERATION,
    idempotencyKey: IDEMPOTENCY_KEY,
    inputDigest,
    status: 'COMMITTED',
    publishableObjectCount: 3,
    residualCount: 0,
    quarantinedClosureCount: 0,
  };
  return Object.freeze({
    operation: OPERATION,
    idempotency_key: IDEMPOTENCY_KEY,
    contract_bundle: contractBundle,
    correction_discharge_map: correctionDischargeMap,
    candidate_input_head: candidateInputHead,
    candidate_input_event: candidateInputEvent,
    write_set: writeSet,
    input_digest: inputDigest,
    receipt: Object.freeze({
      receiptId: contentId('CANONICAL_WRITE_RECEIPT/V1', receiptBody),
      ...receiptBody,
    }),
  });
}

module.exports = {
  IDEMPOTENCY_KEY,
  OPERATION,
  buildQxoReverseF3AuthorityGenesis,
};
