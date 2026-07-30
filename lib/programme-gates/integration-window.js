const {
  domainDigest,
} = require('./bytes');

const SCHEMA_VERSION = 'ProgrammeIntegrationWindow/V1';
const WINDOW_ID_DOMAIN = 'PROGRAMME_INTEGRATION_WINDOW_ID/V1';
const WINDOW_REVISION_ID_DOMAIN = 'PROGRAMME_INTEGRATION_WINDOW_REVISION_ID/V1';
const CHANGED_FILES_DIGEST_DOMAIN = 'PROGRAMME_INTEGRATION_WINDOW_CHANGED_FILES/V1';
const REVIEW_ID_DOMAIN = 'PROGRAMME_INTEGRATION_WINDOW_SPARK_REVIEW_ID/V1';
const SPARK_MODEL = 'gpt-5.3-codex-spark';
const SPARK_ALLOWLIST_PATH = '.github/phase-allowlists/wp-pi-spark-premerge-review-v1.json';
const COMMIT_PATTERN = /^[a-f0-9]{40}$/;
const DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const TOKEN_PATTERN = /^[A-Z][A-Z0-9_./:-]{0,127}$/;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,127}$/;
const STATES = Object.freeze([
  'ASSEMBLING',
  'READY',
  'MAIN_MOVED',
  'SUCCESSOR_PUBLISHED',
  'VERIFIED',
  'RECOVERY_REQUIRED',
]);
const ROOT_KEYS = Object.freeze([
  'schema_version',
  'window_id',
  'window_revision_id',
  'state',
  'transition_ordinal',
  'base_main_commit',
  'predecessor_publication',
  'work_units',
  'stage_2_premerge_reviews',
  'expected_test_ids',
  'candidate_main_commit',
  'ready_test_result',
  'main_movement',
  'successor_publication',
  'final_verifier_result',
  'recovery',
]);

function requireExactKeys(value, allowedKeys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  const keys = Object.keys(value);
  const extras = keys.filter((key) => !allowedKeys.includes(key));
  const missing = allowedKeys.filter((key) => !keys.includes(key));
  if (extras.length > 0) {
    throw new Error(`${label} has unsupported fields: ${extras.join(', ')}`);
  }
  if (missing.length > 0) {
    throw new Error(`${label} is missing fields: ${missing.join(', ')}`);
  }
}

function requireCommit(value, label) {
  if (typeof value !== 'string' || !COMMIT_PATTERN.test(value)) {
    throw new TypeError(`${label} must be a Git commit ID`);
  }
  return value;
}

function requireDigest(value, label) {
  if (typeof value !== 'string' || !DIGEST_PATTERN.test(value)) {
    throw new TypeError(`${label} must be a SHA-256 digest`);
  }
  return value;
}

function requireToken(value, label) {
  if (typeof value !== 'string' || !TOKEN_PATTERN.test(value)) {
    throw new TypeError(`${label} must be a closed uppercase token`);
  }
  return value;
}

function requireIdentifier(value, label) {
  if (typeof value !== 'string' || !IDENTIFIER_PATTERN.test(value)) {
    throw new TypeError(`${label} must be a closed identifier`);
  }
  return value;
}

function requirePath(value, label) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 512) {
    throw new TypeError(`${label} must be a non-empty path`);
  }
  return value;
}

function requirePositiveInteger(value, label) {
  if (!Number.isInteger(value) || value < 1) {
    throw new TypeError(`${label} must be a positive integer`);
  }
  return value;
}

function requireNullable(value, validator, label) {
  if (value === null) return null;
  return validator(value, label);
}

function sameOrderedStrings(left, right) {
  return Array.isArray(left)
    && Array.isArray(right)
    && left.length === right.length
    && left.every((value, index) => value === right[index]);
}

function requireUniqueStrings(values, label, validator) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new TypeError(`${label} must be a non-empty array`);
  }
  values.forEach((value, index) => validator(value, `${label} ${index}`));
  if (new Set(values).size !== values.length) {
    throw new Error(`${label} must be unique`);
  }
  return values;
}

function validatePredecessorPublication(value) {
  requireExactKeys(value, [
    'git_object_id',
    'status_artefact_id',
    'generation',
  ], 'predecessor publication');
  requireCommit(value.git_object_id, 'predecessor publication Git object ID');
  requireDigest(value.status_artefact_id, 'predecessor status artefact ID');
  requirePositiveInteger(value.generation, 'predecessor publication generation');
}

function validateWorkUnits(workUnits) {
  if (!Array.isArray(workUnits) || workUnits.length === 0) {
    throw new TypeError('work units must be a non-empty array');
  }
  const unitIds = new Set();
  const ranges = new Set();
  workUnits.forEach((unit, index) => {
    requireExactKeys(unit, [
      'unit_id',
      'ordinal',
      'range_start_exclusive',
      'range_end_inclusive',
      'phase',
      'required_work_class',
      'phase_allowlist_path',
      'allowlist_digest',
      'authority_status_artefact_id',
    ], `work unit ${index}`);
    requireIdentifier(unit.unit_id, `work unit ${index} ID`);
    if (unit.ordinal !== index) {
      throw new Error('work-unit ordinals must equal their exact array order');
    }
    requireCommit(unit.range_start_exclusive, `work unit ${index} range start`);
    requireCommit(unit.range_end_inclusive, `work unit ${index} range end`);
    if (unit.range_start_exclusive === unit.range_end_inclusive) {
      throw new Error(`work unit ${index} commit range must be non-empty`);
    }
    requireToken(unit.phase, `work unit ${index} phase`);
    requireIdentifier(
      unit.required_work_class,
      `work unit ${index} required work class`,
    );
    if (unit.phase_allowlist_path !== SPARK_ALLOWLIST_PATH) {
      throw new Error(`work unit ${index} phase allowlist path is not supported`);
    }
    requireDigest(unit.allowlist_digest, `work unit ${index} allowlist digest`);
    requireDigest(
      unit.authority_status_artefact_id,
      `work unit ${index} authority status artefact ID`,
    );
    if (unitIds.has(unit.unit_id)) {
      throw new Error('work-unit IDs must be unique');
    }
    unitIds.add(unit.unit_id);
    const range = `${unit.range_start_exclusive}:${unit.range_end_inclusive}`;
    if (ranges.has(range)) {
      throw new Error('work-unit commit ranges must be unique');
    }
    ranges.add(range);
  });
}

function validateReadyTestResult(value, expectedTestIds) {
  requireExactKeys(value, [
    'result',
    'passed_test_ids',
  ], 'ready test result');
  if (value.result !== 'PASS') {
    throw new Error('ready test result must be PASS');
  }
  if (!sameOrderedStrings(value.passed_test_ids, expectedTestIds)) {
    throw new Error('ready tests must equal the exact expected ordered test set');
  }
}

function validateStage2PremergeReviews(reviews, window) {
  if (!Array.isArray(reviews)) throw new TypeError('Stage 2 pre-merge reviews must be an array');
  if (window.state === 'ASSEMBLING' && reviews.length === 0) return;
  if (reviews.length !== window.work_units.length) {
    throw new Error('Stage 2 pre-merge reviews must cover every work unit exactly once');
  }
  const seenWorkUnitIds = new Set();
  reviews.forEach((review, index) => {
    requireExactKeys(review, [
      'review_id', 'review_stage', 'work_unit_id', 'source', 'model', 'reasoning_effort',
      'base_commit', 'head_commit', 'changed_files', 'changed_files_digest',
      'phase_allowlist_path', 'phase_allowlist_digest', 'contract_paths',
      'interface_paths', 'focused_test_ids', 'programme_gate_evidence_authority',
      'contract_freeze_evidence_authority', 'findings',
    ], `Stage 2 pre-merge review ${index}`);
    requireDigest(review.review_id, `Stage 2 pre-merge review ${index} ID`);
    if (review.review_stage !== 'STAGE_2_PRE_MERGE') throw new Error(`Stage 2 pre-merge review ${index} cannot satisfy Stage 4`);
    requireIdentifier(review.work_unit_id, `Stage 2 pre-merge review ${index} work unit ID`);
    if (!['SUPPLIED_BY_PI', 'RUN_BY_PM'].includes(review.source)) throw new Error(`Stage 2 pre-merge review ${index} source is not supported`);
    if (review.model !== SPARK_MODEL || review.reasoning_effort !== 'medium') throw new Error(`Stage 2 pre-merge review ${index} must use ${SPARK_MODEL} at medium reasoning`);
    requireCommit(review.base_commit, `Stage 2 pre-merge review ${index} base commit`);
    requireCommit(review.head_commit, `Stage 2 pre-merge review ${index} head commit`);
    requireUniqueStrings(review.changed_files, `Stage 2 pre-merge review ${index} changed files`, requirePath);
    if (review.changed_files_digest !== domainDigest(CHANGED_FILES_DIGEST_DOMAIN, review.changed_files)) throw new Error(`Stage 2 pre-merge review ${index} changed-file digest has drifted`);
    if (review.phase_allowlist_path !== SPARK_ALLOWLIST_PATH) throw new Error(`Stage 2 pre-merge review ${index} phase allowlist path is not supported`);
    requireDigest(review.phase_allowlist_digest, `Stage 2 pre-merge review ${index} phase allowlist digest`);
    requireUniqueStrings(review.contract_paths, `Stage 2 pre-merge review ${index} contract paths`, requirePath);
    requireUniqueStrings(review.interface_paths, `Stage 2 pre-merge review ${index} interface paths`, requirePath);
    requireUniqueStrings(review.focused_test_ids, `Stage 2 pre-merge review ${index} focused test IDs`, requirePath);
    if (review.programme_gate_evidence_authority !== 'NONE' || review.contract_freeze_evidence_authority !== 'NONE') throw new Error(`Stage 2 pre-merge review ${index} cannot carry gate or freeze authority`);
    if (!Array.isArray(review.findings)) throw new TypeError(`Stage 2 pre-merge review ${index} findings must be an array`);
    review.findings.forEach((finding, findingIndex) => {
      requireExactKeys(finding, ['finding_id', 'category', 'assessment_area', 'final_disposition', 'escalation_disposition_id'], `Stage 2 pre-merge review ${index} finding ${findingIndex}`);
      requireIdentifier(finding.finding_id, `Stage 2 pre-merge review ${index} finding ${findingIndex} ID`);
      if (!['CORRECTNESS', 'CONTRACT_BINDING', 'IDENTITY', 'DIGEST', 'EVIDENCE_PRESERVATION', 'AUTHORITY_BOUNDARY', 'STALE_REFERENCE', 'MISSING_HOSTILE_TEST', 'FILE_SCOPE'].includes(finding.category)) throw new Error(`Stage 2 pre-merge review ${index} finding ${findingIndex} category is not supported`);
      if (!['LEGAL_SEMANTIC', 'SECURITY', 'IDENTITY', 'CROSS_CONTRACT', 'UNCERTAIN', 'OTHER'].includes(finding.assessment_area)) throw new Error(`Stage 2 pre-merge review ${index} finding ${findingIndex} assessment area is not supported`);
      if (!['RESOLVED', 'ESCALATED_TO_SOL_HIGH_OR_XHIGH'].includes(finding.final_disposition)) throw new Error(`Stage 2 pre-merge review ${index} finding ${findingIndex} lacks a final disposition`);
      const requiresEscalation = ['LEGAL_SEMANTIC', 'SECURITY', 'IDENTITY', 'CROSS_CONTRACT', 'UNCERTAIN'].includes(finding.assessment_area) || finding.category === 'IDENTITY';
      if (requiresEscalation && (finding.final_disposition !== 'ESCALATED_TO_SOL_HIGH_OR_XHIGH' || finding.escalation_disposition_id === null)) throw new Error(`Stage 2 pre-merge review ${index} finding ${findingIndex} requires linked Sol escalation`);
      if (finding.escalation_disposition_id !== null) requireDigest(finding.escalation_disposition_id, `Stage 2 pre-merge review ${index} finding ${findingIndex} escalation disposition ID`);
    });
    const unit = window.work_units.find((candidate) => candidate.unit_id === review.work_unit_id);
    if (!unit || seenWorkUnitIds.has(review.work_unit_id) || review.base_commit !== unit.range_start_exclusive || review.head_commit !== unit.range_end_inclusive || review.phase_allowlist_digest !== unit.allowlist_digest) throw new Error(`Stage 2 pre-merge review ${index} does not bind the exact work unit`);
    seenWorkUnitIds.add(review.work_unit_id);
    const { review_id: reviewId, ...reviewBasis } = review;
    if (reviewId !== domainDigest(REVIEW_ID_DOMAIN, reviewBasis)) throw new Error(`Stage 2 pre-merge review ${index} identity has drifted`);
  });
}

function validateMainMovement(value, window) {
  requireExactKeys(value, [
    'move_ordinal',
    'expected_old_main_commit',
    'new_main_commit',
  ], 'main movement');
  if (value.move_ordinal !== 1) {
    throw new Error('an integration window permits exactly one main movement');
  }
  requireCommit(value.expected_old_main_commit, 'expected old main commit');
  requireCommit(value.new_main_commit, 'new main commit');
  if (value.expected_old_main_commit !== window.base_main_commit
    || value.new_main_commit !== window.candidate_main_commit) {
    throw new Error('main movement does not bind the exact window commits');
  }
}

function validateSuccessorPublication(value, window) {
  requireExactKeys(value, [
    'expected_predecessor_git_object_id',
    'new_publication_git_object_id',
    'status_artefact_id',
    'generation',
    'code_commit',
  ], 'successor publication');
  requireCommit(
    value.expected_predecessor_git_object_id,
    'expected predecessor publication Git object ID',
  );
  requireCommit(
    value.new_publication_git_object_id,
    'new publication Git object ID',
  );
  requireDigest(value.status_artefact_id, 'successor status artefact ID');
  requirePositiveInteger(value.generation, 'successor publication generation');
  requireCommit(value.code_commit, 'successor status code commit');
  if (value.expected_predecessor_git_object_id
      !== window.predecessor_publication.git_object_id
    || value.new_publication_git_object_id
      === value.expected_predecessor_git_object_id
    || value.generation !== window.predecessor_publication.generation + 1
    || value.code_commit !== window.candidate_main_commit) {
    throw new Error('successor publication does not bind the exact window');
  }
}

function validateFinalVerifierResult(value, window) {
  requireExactKeys(value, [
    'result',
    'origin_main_commit',
    'publication_git_object_id',
    'status_artefact_id',
    'failure_code',
  ], 'final verifier result');
  if (!['PASS', 'FAIL'].includes(value.result)) {
    throw new Error('final verifier result must be PASS or FAIL');
  }
  requireCommit(value.origin_main_commit, 'verified origin main commit');
  requireCommit(
    value.publication_git_object_id,
    'verified publication Git object ID',
  );
  requireDigest(value.status_artefact_id, 'verified status artefact ID');
  if (value.result === 'PASS') {
    if (value.failure_code !== null) {
      throw new Error('a passing final verifier cannot have a failure code');
    }
  } else {
    requireToken(value.failure_code, 'final verifier failure code');
  }
  if (value.origin_main_commit !== window.candidate_main_commit
    || value.publication_git_object_id
      !== window.successor_publication.new_publication_git_object_id
    || value.status_artefact_id
      !== window.successor_publication.status_artefact_id) {
    throw new Error('final verifier result does not bind the exact window');
  }
}

function validateRecovery(value) {
  requireExactKeys(value, [
    'stage',
    'failure_code',
  ], 'recovery');
  if (!['SUCCESSOR_PUBLICATION', 'FINAL_VERIFICATION'].includes(value.stage)) {
    throw new Error('recovery stage is not supported');
  }
  requireToken(value.failure_code, 'recovery failure code');
}

function windowBasis(window) {
  return {
    schema_version: window.schema_version,
    base_main_commit: window.base_main_commit,
    predecessor_publication: window.predecessor_publication,
    work_units: window.work_units,
    expected_test_ids: window.expected_test_ids,
  };
}

function withoutRevisionId(window) {
  const { window_revision_id: _revisionId, ...body } = window;
  return body;
}

function validateState(window) {
  const present = (value) => value !== null;
  const fields = {
    candidate: present(window.candidate_main_commit),
    ready: present(window.ready_test_result),
    moved: present(window.main_movement),
    published: present(window.successor_publication),
    verified: present(window.final_verifier_result),
    recovery: present(window.recovery),
  };
  const expectedByState = {
    ASSEMBLING: [0, false, false, false, false, false, false],
    READY: [1, true, true, false, false, false, false],
    MAIN_MOVED: [2, true, true, true, false, false, false],
    SUCCESSOR_PUBLISHED: [3, true, true, true, true, false, false],
    VERIFIED: [4, true, true, true, true, true, false],
  };
  if (window.state !== 'RECOVERY_REQUIRED') {
    const expected = expectedByState[window.state];
    if (!expected
      || window.transition_ordinal !== expected[0]
      || fields.candidate !== expected[1]
      || fields.ready !== expected[2]
      || fields.moved !== expected[3]
      || fields.published !== expected[4]
      || fields.verified !== expected[5]
      || fields.recovery !== expected[6]) {
      throw new Error(`integration window state ${window.state} is inconsistent`);
    }
    if (window.state === 'VERIFIED'
      && window.final_verifier_result.result !== 'PASS') {
      throw new Error('VERIFIED requires a passing final verifier result');
    }
    return;
  }

  if (!fields.candidate || !fields.ready || !fields.moved || !fields.recovery) {
    throw new Error('RECOVERY_REQUIRED must follow the one main movement');
  }
  if (window.recovery.stage === 'SUCCESSOR_PUBLICATION') {
    if (window.transition_ordinal !== 3
      || fields.published
      || fields.verified) {
      throw new Error('publication recovery state is inconsistent');
    }
    return;
  }
  if (window.transition_ordinal !== 4
    || !fields.published
    || !fields.verified
    || window.final_verifier_result.result !== 'FAIL'
    || window.final_verifier_result.failure_code
      !== window.recovery.failure_code) {
    throw new Error('verification recovery state is inconsistent');
  }
}

function validateIntegrationWindow(window) {
  requireExactKeys(window, ROOT_KEYS, 'integration window');
  if (window.schema_version !== SCHEMA_VERSION) {
    throw new Error('unsupported integration-window schema version');
  }
  requireDigest(window.window_id, 'integration window ID');
  requireDigest(window.window_revision_id, 'integration window revision ID');
  if (!STATES.includes(window.state)) {
    throw new Error('integration window state is not supported');
  }
  if (!Number.isInteger(window.transition_ordinal)
    || window.transition_ordinal < 0
    || window.transition_ordinal > 4) {
    throw new TypeError('transition ordinal must be an integer from zero to four');
  }
  requireCommit(window.base_main_commit, 'base main commit');
  validatePredecessorPublication(window.predecessor_publication);
  validateWorkUnits(window.work_units);
  validateStage2PremergeReviews(window.stage_2_premerge_reviews, window);
  requireUniqueStrings(
    window.expected_test_ids,
    'expected test IDs',
    requireIdentifier,
  );
  requireNullable(window.candidate_main_commit, requireCommit, 'candidate main commit');
  if (window.ready_test_result !== null) {
    validateReadyTestResult(window.ready_test_result, window.expected_test_ids);
  }
  if (window.main_movement !== null) {
    validateMainMovement(window.main_movement, window);
  }
  if (window.successor_publication !== null) {
    validateSuccessorPublication(window.successor_publication, window);
  }
  if (window.final_verifier_result !== null) {
    if (window.successor_publication === null) {
      throw new Error('final verification requires a successor publication');
    }
    validateFinalVerifierResult(window.final_verifier_result, window);
  }
  if (window.recovery !== null) validateRecovery(window.recovery);
  validateState(window);
  if (window.window_id !== domainDigest(WINDOW_ID_DOMAIN, windowBasis(window))) {
    throw new Error('integration window identity has drifted');
  }
  if (window.window_revision_id
      !== domainDigest(WINDOW_REVISION_ID_DOMAIN, withoutRevisionId(window))) {
    throw new Error('integration window revision identity has drifted');
  }
  return true;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function sealWindow(body) {
  const cloned = structuredClone(body);
  const sealed = {
    ...cloned,
    window_revision_id: domainDigest(
      WINDOW_REVISION_ID_DOMAIN,
      withoutRevisionId(cloned),
    ),
  };
  validateIntegrationWindow(sealed);
  return deepFreeze(sealed);
}

function checkedWindow(window, requiredState) {
  validateIntegrationWindow(window);
  if (window.state !== requiredState) {
    throw new Error(
      `integration window must be ${requiredState}, got ${window.state}`,
    );
  }
  return window;
}

function createIntegrationWindow({
  baseMainCommit,
  predecessorPublication,
  workUnits,
  expectedTestIds,
} = {}) {
  const basis = {
    schema_version: SCHEMA_VERSION,
    base_main_commit: baseMainCommit,
    predecessor_publication: structuredClone(predecessorPublication),
    work_units: structuredClone(workUnits),
    expected_test_ids: structuredClone(expectedTestIds),
  };
  const body = {
    ...basis,
    stage_2_premerge_reviews: [],
    window_id: domainDigest(WINDOW_ID_DOMAIN, basis),
    state: 'ASSEMBLING',
    transition_ordinal: 0,
    candidate_main_commit: null,
    ready_test_result: null,
    main_movement: null,
    successor_publication: null,
    final_verifier_result: null,
    recovery: null,
  };
  return sealWindow(body);
}

function markIntegrationWindowReady({
  window,
  candidateMainCommit,
  passedTestIds,
  stage2PremergeReviews,
} = {}) {
  checkedWindow(window, 'ASSEMBLING');
  requireCommit(candidateMainCommit, 'candidate main commit');
  if (candidateMainCommit === window.base_main_commit) {
    throw new Error('candidate main commit must advance the base main commit');
  }
  if (!sameOrderedStrings(passedTestIds, window.expected_test_ids)) {
    throw new Error('passed tests must equal the exact expected ordered test set');
  }
  validateStage2PremergeReviews(stage2PremergeReviews, {
    ...window,
    state: 'READY',
  });
  return sealWindow({
    ...structuredClone(window),
    state: 'READY',
    transition_ordinal: 1,
    candidate_main_commit: candidateMainCommit,
    ready_test_result: {
      result: 'PASS',
      passed_test_ids: structuredClone(passedTestIds),
    },
    stage_2_premerge_reviews: structuredClone(stage2PremergeReviews),
  });
}

function recordMainMovement({
  window,
  expectedOldMainCommit,
  newMainCommit,
} = {}) {
  checkedWindow(window, 'READY');
  if (expectedOldMainCommit !== window.base_main_commit
    || newMainCommit !== window.candidate_main_commit) {
    throw new Error('main movement must use the exact leased window commits');
  }
  return sealWindow({
    ...structuredClone(window),
    state: 'MAIN_MOVED',
    transition_ordinal: 2,
    main_movement: {
      move_ordinal: 1,
      expected_old_main_commit: expectedOldMainCommit,
      new_main_commit: newMainCommit,
    },
  });
}

function recordSuccessorPublication({
  window,
  expectedPredecessorGitObjectId,
  newPublicationGitObjectId,
  statusArtefactId,
  generation,
  codeCommit,
} = {}) {
  checkedWindow(window, 'MAIN_MOVED');
  const successorPublication = {
    expected_predecessor_git_object_id: expectedPredecessorGitObjectId,
    new_publication_git_object_id: newPublicationGitObjectId,
    status_artefact_id: statusArtefactId,
    generation,
    code_commit: codeCommit,
  };
  validateSuccessorPublication(successorPublication, window);
  return sealWindow({
    ...structuredClone(window),
    state: 'SUCCESSOR_PUBLISHED',
    transition_ordinal: 3,
    successor_publication: successorPublication,
  });
}

function recordSuccessorPublicationFailure({
  window,
  failureCode,
} = {}) {
  checkedWindow(window, 'MAIN_MOVED');
  requireToken(failureCode, 'successor publication failure code');
  return sealWindow({
    ...structuredClone(window),
    state: 'RECOVERY_REQUIRED',
    transition_ordinal: 3,
    recovery: {
      stage: 'SUCCESSOR_PUBLICATION',
      failure_code: failureCode,
    },
  });
}

function recordFinalVerification({
  window,
  result,
  originMainCommit,
  publicationGitObjectId,
  statusArtefactId,
  failureCode = null,
} = {}) {
  checkedWindow(window, 'SUCCESSOR_PUBLISHED');
  const finalVerifierResult = {
    result,
    origin_main_commit: originMainCommit,
    publication_git_object_id: publicationGitObjectId,
    status_artefact_id: statusArtefactId,
    failure_code: failureCode,
  };
  validateFinalVerifierResult(finalVerifierResult, window);
  if (result === 'PASS') {
    return sealWindow({
      ...structuredClone(window),
      state: 'VERIFIED',
      transition_ordinal: 4,
      final_verifier_result: finalVerifierResult,
    });
  }
  return sealWindow({
    ...structuredClone(window),
    state: 'RECOVERY_REQUIRED',
    transition_ordinal: 4,
    final_verifier_result: finalVerifierResult,
    recovery: {
      stage: 'FINAL_VERIFICATION',
      failure_code: failureCode,
    },
  });
}

module.exports = {
  SCHEMA_VERSION,
  STATES,
  WINDOW_ID_DOMAIN,
  WINDOW_REVISION_ID_DOMAIN,
  CHANGED_FILES_DIGEST_DOMAIN,
  REVIEW_ID_DOMAIN,
  SPARK_MODEL,
  SPARK_ALLOWLIST_PATH,
  createIntegrationWindow,
  markIntegrationWindowReady,
  recordFinalVerification,
  recordMainMovement,
  recordSuccessorPublication,
  recordSuccessorPublicationFailure,
  validateIntegrationWindow,
};
