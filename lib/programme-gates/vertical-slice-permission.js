const COMMIT_RE = /^[a-f0-9]{40}$/;

class VerticalSlicePermissionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'VerticalSlicePermissionError';
    this.code = 'VERTICAL_SLICE_EXECUTION_NOT_AUTHORISED';
  }
}

function requireVerticalSliceExecutionPermission(verifiedPublication) {
  if (
    !verifiedPublication
    || verifiedPublication.result !== 'PASS'
    || !Number.isSafeInteger(verifiedPublication.generation)
    || verifiedPublication.generation < 1
    || !COMMIT_RE.test(verifiedPublication.origin_main_commit || '')
    || !COMMIT_RE.test(verifiedPublication.publication_commit || '')
    || verifiedPublication.gate_states?.P1_CONTRACT_FREEZE_ATTESTED !== 'PASS'
    || verifiedPublication.work_classes?.vertical_slice_execution !== 'PASS'
  ) {
    throw new VerticalSlicePermissionError(
      'Refusing staging database access until the protected programme '
        + 'status verifies P1_CONTRACT_FREEZE_ATTESTED and '
        + 'vertical_slice_execution as PASS.',
    );
  }
  return Object.freeze({
    schema_version: 'VERTICAL_SLICE_EXECUTION_PERMISSION/V1',
    generation: verifiedPublication.generation,
    origin_main_commit: verifiedPublication.origin_main_commit,
    publication_commit: verifiedPublication.publication_commit,
    p1_contract_freeze_attested: 'PASS',
    vertical_slice_execution: 'PASS',
    authority_source: 'PROTECTED_PROGRAMME_STATUS_PUBLICATION',
  });
}

module.exports = {
  VerticalSlicePermissionError,
  requireVerticalSliceExecutionPermission,
};
