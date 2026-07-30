const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const Ajv = require('ajv');
const { domainDigest } = require('../../lib/programme-gates/bytes');

const {
  createIntegrationWindow,
  markIntegrationWindowReady,
  recordFinalVerification,
  recordMainMovement,
  recordSuccessorPublication,
  recordSuccessorPublicationFailure,
  validateIntegrationWindow,
} = require('../../lib/programme-gates/integration-window');

const ROOT = path.resolve(__dirname, '../..');
const SCHEMA = JSON.parse(fs.readFileSync(
  path.join(ROOT, '.github/pm-integration/window.schema.json'),
  'utf8',
));
const validateSchema = new Ajv({ allErrors: true }).compile(SCHEMA);
const COMMIT_A = 'a'.repeat(40);
const COMMIT_B = 'b'.repeat(40);
const COMMIT_C = 'c'.repeat(40);
const COMMIT_D = 'd'.repeat(40);
const COMMIT_E = 'e'.repeat(40);
const DIGEST_A = '1'.repeat(64);
const DIGEST_B = '2'.repeat(64);
const DIGEST_C = '3'.repeat(64);
const DIGEST_D = '4'.repeat(64);
const TEST_IDS = [
  'tests/programme-gates/integration-window.spec.js',
  'tests/canonical-v2-successor-manifest.test.js',
];

function workUnits() {
  return [
    {
      unit_id: 'shared-entities-v1',
      ordinal: 0,
      range_start_exclusive: COMMIT_A,
      range_end_inclusive: COMMIT_B,
      phase: 'WP-SHARED-AUTHORITY-ENTITY-CONTRACT-INPUTS-V1',
      required_work_class: 'canonical_work_start',
      phase_allowlist_path: '.github/phase-allowlists/wp-pi-spark-premerge-review-v1.json',
      allowlist_digest: DIGEST_B,
      authority_status_artefact_id: DIGEST_A,
    },
    {
      unit_id: 'shared-transactions-v1',
      ordinal: 1,
      range_start_exclusive: COMMIT_B,
      range_end_inclusive: COMMIT_C,
      phase: 'WP-SHARED-AUTHORITY-TRANSACTION-CONTRACT-INPUTS-V1',
      required_work_class: 'canonical_work_start',
      phase_allowlist_path: '.github/phase-allowlists/wp-pi-spark-premerge-review-v1.json',
      allowlist_digest: DIGEST_C,
      authority_status_artefact_id: DIGEST_A,
    },
  ];
}

function assemblingWindow() {
  return createIntegrationWindow({
    baseMainCommit: COMMIT_A,
    predecessorPublication: {
      git_object_id: COMMIT_D,
      status_artefact_id: DIGEST_A,
      generation: 1,
    },
    workUnits: workUnits(),
    expectedTestIds: TEST_IDS,
  });
}

function readyWindow() {
  return markIntegrationWindowReady({
    window: assemblingWindow(),
    candidateMainCommit: COMMIT_E,
    passedTestIds: TEST_IDS,
    stage2PremergeReviews: reviews(),
  });
}

function review(unit, source = 'SUPPLIED_BY_PI') {
  const value = {
    review_stage: 'STAGE_2_PRE_MERGE',
    work_unit_id: unit.unit_id,
    source,
    model: 'gpt-5.3-codex-spark',
    reasoning_effort: 'medium',
    base_commit: unit.range_start_exclusive,
    head_commit: unit.range_end_inclusive,
    changed_files: ['lib/programme-gates/integration-window.js'],
    changed_files_digest: domainDigest(
      'PROGRAMME_INTEGRATION_WINDOW_CHANGED_FILES/V1',
      ['lib/programme-gates/integration-window.js'],
    ),
    phase_allowlist_path: '.github/phase-allowlists/wp-pi-spark-premerge-review-v1.json',
    phase_allowlist_digest: unit.allowlist_digest,
    contract_paths: ['.github/pm-integration/window.schema.json'],
    interface_paths: ['lib/programme-gates/integration-window.js'],
    focused_test_ids: ['tests/programme-gates/integration-window.spec.js'],
    programme_gate_evidence_authority: 'NONE',
    contract_freeze_evidence_authority: 'NONE',
    findings: [],
  };
  return {
    review_id: domainDigest('PROGRAMME_INTEGRATION_WINDOW_SPARK_REVIEW_ID/V1', value),
    ...value,
  };
}

function reviews(source = 'SUPPLIED_BY_PI') {
  return workUnits().map((unit) => review(unit, source));
}

function movedWindow() {
  return recordMainMovement({
    window: readyWindow(),
    expectedOldMainCommit: COMMIT_A,
    newMainCommit: COMMIT_E,
  });
}

function publishedWindow() {
  return recordSuccessorPublication({
    window: movedWindow(),
    expectedPredecessorGitObjectId: COMMIT_D,
    newPublicationGitObjectId: COMMIT_C,
    statusArtefactId: DIGEST_D,
    generation: 2,
    codeCommit: COMMIT_E,
  });
}

function assertValid(window) {
  assert.equal(validateIntegrationWindow(window), true);
  assert.equal(validateSchema(window), true, JSON.stringify(validateSchema.errors));
}

test('binds the exact immutable integration basis and closes every schema object', () => {
  const window = assemblingWindow();
  assertValid(window);
  assert.equal(window.state, 'ASSEMBLING');
  assert.equal(window.transition_ordinal, 0);
  assert.deepEqual(window.work_units, workUnits());
  assert.deepEqual(window.expected_test_ids, TEST_IDS);
  assert.ok(Object.isFrozen(window));
  assert.ok(Object.isFrozen(window.work_units));
  assert.ok(Object.isFrozen(window.work_units[0]));

  const extraRoot = { ...structuredClone(window), surprise: true };
  assert.equal(validateSchema(extraRoot), false);
  const extraUnit = structuredClone(window);
  extraUnit.work_units[0].surprise = true;
  assert.equal(validateSchema(extraUnit), false);
  assert.throws(
    () => validateIntegrationWindow(extraUnit),
    /unsupported fields/,
  );
});

test('advances through one exact main movement, successor and final verification', () => {
  const assembling = assemblingWindow();
  const ready = readyWindow();
  const moved = movedWindow();
  const published = publishedWindow();
  const verified = recordFinalVerification({
    window: published,
    result: 'PASS',
    originMainCommit: COMMIT_E,
    publicationGitObjectId: COMMIT_C,
    statusArtefactId: DIGEST_D,
  });

  for (const window of [assembling, ready, moved, published, verified]) {
    assertValid(window);
  }
  assert.deepEqual(
    [assembling, ready, moved, published, verified].map((window) => [
      window.state,
      window.transition_ordinal,
    ]),
    [
      ['ASSEMBLING', 0],
      ['READY', 1],
      ['MAIN_MOVED', 2],
      ['SUCCESSOR_PUBLISHED', 3],
      ['VERIFIED', 4],
    ],
  );
  assert.equal(verified.main_movement.move_ordinal, 1);
  assert.equal(verified.successor_publication.code_commit, COMMIT_E);
  assert.equal(verified.final_verifier_result.result, 'PASS');
  assert.equal(verified.recovery, null);
});

test('requires the exact ordered test set before the window becomes ready', () => {
  assert.throws(
    () => markIntegrationWindowReady({
      window: assemblingWindow(),
      candidateMainCommit: COMMIT_E,
      passedTestIds: [...TEST_IDS].reverse(),
    }),
    /exact expected ordered test set/,
  );
  assert.throws(
    () => markIntegrationWindowReady({
      window: assemblingWindow(),
      candidateMainCommit: COMMIT_A,
      passedTestIds: TEST_IDS,
    }),
    /must advance/,
  );
});

test('requires complete, exact and authority-free Spark Stage 2 reviews before READY', () => {
  const valid = reviews();
  assertValid(markIntegrationWindowReady({
    window: assemblingWindow(), candidateMainCommit: COMMIT_E,
    passedTestIds: TEST_IDS, stage2PremergeReviews: valid,
  }));
  assertValid(markIntegrationWindowReady({
    window: assemblingWindow(), candidateMainCommit: COMMIT_E,
    passedTestIds: TEST_IDS, stage2PremergeReviews: reviews('RUN_BY_PM'),
  }));
  const cases = [
    ['base', (review) => { review.base_commit = COMMIT_D; }],
    ['head', (review) => { review.head_commit = COMMIT_D; }],
    ['changed files', (review) => { review.changed_files.push('tests/other.js'); }],
    ['allowlist', (review) => { review.phase_allowlist_digest = DIGEST_D; }],
    ['contract coverage', (review) => { review.contract_paths = []; }],
    ['interface coverage', (review) => { review.interface_paths = []; }],
    ['test coverage', (review) => { review.focused_test_ids = []; }],
    ['model', (review) => { review.model = 'gpt-5.3-codex'; }],
    ['reasoning', (review) => { review.reasoning_effort = 'high'; }],
    ['forged authority', (review) => { review.programme_gate_evidence_authority = 'PROGRAMME_GATE'; }],
    ['Stage 4', (review) => { review.review_stage = 'STAGE_4'; }],
  ];
  for (const [, mutate] of cases) {
    const invalid = structuredClone(valid);
    mutate(invalid[0]);
    assert.throws(() => markIntegrationWindowReady({
      window: assemblingWindow(), candidateMainCommit: COMMIT_E,
      passedTestIds: TEST_IDS, stage2PremergeReviews: invalid,
    }));
  }
  const unresolved = structuredClone(valid);
  unresolved[0].findings = [{
    finding_id: 'missing-hostile-test', category: 'MISSING_HOSTILE_TEST',
    assessment_area: 'OTHER', final_disposition: 'OPEN',
    escalation_disposition_id: null,
  }];
  unresolved[0].review_id = domainDigest(
    'PROGRAMME_INTEGRATION_WINDOW_SPARK_REVIEW_ID/V1',
    (({ review_id: _id, ...basis }) => basis)(unresolved[0]),
  );
  assert.throws(() => markIntegrationWindowReady({
    window: assemblingWindow(), candidateMainCommit: COMMIT_E,
    passedTestIds: TEST_IDS, stage2PremergeReviews: unresolved,
  }), /final disposition/);
  const missingEscalation = structuredClone(valid);
  missingEscalation[0].findings = [{
    finding_id: 'identity-risk', category: 'IDENTITY', assessment_area: 'IDENTITY',
    final_disposition: 'RESOLVED', escalation_disposition_id: null,
  }];
  missingEscalation[0].review_id = domainDigest(
    'PROGRAMME_INTEGRATION_WINDOW_SPARK_REVIEW_ID/V1',
    (({ review_id: _id, ...basis }) => basis)(missingEscalation[0]),
  );
  assert.throws(() => markIntegrationWindowReady({
    window: assemblingWindow(), candidateMainCommit: COMMIT_E,
    passedTestIds: TEST_IDS, stage2PremergeReviews: missingEscalation,
  }), /linked Sol escalation/);
});

test('rejects reordered, duplicate and re-signed work-unit ranges', () => {
  const reordered = workUnits().reverse().map((unit, ordinal) => ({
    ...unit,
    ordinal,
  }));
  const reorderedWindow = createIntegrationWindow({
    baseMainCommit: COMMIT_A,
    predecessorPublication: {
      git_object_id: COMMIT_D,
      status_artefact_id: DIGEST_A,
      generation: 1,
    },
    workUnits: reordered,
    expectedTestIds: TEST_IDS,
  });
  assert.notEqual(reorderedWindow.window_id, assemblingWindow().window_id);

  const duplicate = workUnits();
  duplicate[1] = {
    ...duplicate[1],
    range_start_exclusive: duplicate[0].range_start_exclusive,
    range_end_inclusive: duplicate[0].range_end_inclusive,
  };
  assert.throws(
    () => createIntegrationWindow({
      baseMainCommit: COMMIT_A,
      predecessorPublication: {
        git_object_id: COMMIT_D,
        status_artefact_id: DIGEST_A,
        generation: 1,
      },
      workUnits: duplicate,
      expectedTestIds: TEST_IDS,
    }),
    /commit ranges must be unique/,
  );

  const resigned = structuredClone(assemblingWindow());
  resigned.work_units[0].allowlist_digest = DIGEST_D;
  assert.throws(
    () => validateIntegrationWindow(resigned),
    /identity has drifted/,
  );
});

test('permits no wrong or second main movement', () => {
  assert.throws(
    () => recordMainMovement({
      window: readyWindow(),
      expectedOldMainCommit: COMMIT_B,
      newMainCommit: COMMIT_E,
    }),
    /exact leased window commits/,
  );
  assert.throws(
    () => recordMainMovement({
      window: movedWindow(),
      expectedOldMainCommit: COMMIT_A,
      newMainCommit: COMMIT_E,
    }),
    /must be READY, got MAIN_MOVED/,
  );
});

test('requires the exact predecessor, generation and candidate in the successor', () => {
  const base = {
    window: movedWindow(),
    expectedPredecessorGitObjectId: COMMIT_D,
    newPublicationGitObjectId: COMMIT_C,
    statusArtefactId: DIGEST_D,
    generation: 2,
    codeCommit: COMMIT_E,
  };
  for (const patch of [
    { expectedPredecessorGitObjectId: COMMIT_B },
    { newPublicationGitObjectId: COMMIT_D },
    { generation: 3 },
    { codeCommit: COMMIT_B },
  ]) {
    assert.throws(
      () => recordSuccessorPublication({ ...base, ...patch }),
      /does not bind the exact window/,
    );
  }
});

test('failed publication enters terminal recovery and cannot retry or move main', () => {
  const recovery = recordSuccessorPublicationFailure({
    window: movedWindow(),
    failureCode: 'PUBLICATION_CAS_FAILED',
  });
  assertValid(recovery);
  assert.equal(recovery.state, 'RECOVERY_REQUIRED');
  assert.deepEqual(recovery.recovery, {
    stage: 'SUCCESSOR_PUBLICATION',
    failure_code: 'PUBLICATION_CAS_FAILED',
  });
  assert.equal(recovery.successor_publication, null);

  assert.throws(
    () => recordSuccessorPublication({
      window: recovery,
      expectedPredecessorGitObjectId: COMMIT_D,
      newPublicationGitObjectId: COMMIT_C,
      statusArtefactId: DIGEST_D,
      generation: 2,
      codeCommit: COMMIT_E,
    }),
    /must be MAIN_MOVED, got RECOVERY_REQUIRED/,
  );
  assert.throws(
    () => recordMainMovement({
      window: recovery,
      expectedOldMainCommit: COMMIT_A,
      newMainCommit: COMMIT_E,
    }),
    /must be READY, got RECOVERY_REQUIRED/,
  );
});

test('failed final verification records exact observations and requires recovery', () => {
  const recovery = recordFinalVerification({
    window: publishedWindow(),
    result: 'FAIL',
    originMainCommit: COMMIT_E,
    publicationGitObjectId: COMMIT_C,
    statusArtefactId: DIGEST_D,
    failureCode: 'STATUS_CODE_COMMIT_STALE',
  });
  assertValid(recovery);
  assert.equal(recovery.state, 'RECOVERY_REQUIRED');
  assert.equal(recovery.final_verifier_result.result, 'FAIL');
  assert.deepEqual(recovery.recovery, {
    stage: 'FINAL_VERIFICATION',
    failure_code: 'STATUS_CODE_COMMIT_STALE',
  });
  assert.throws(
    () => recordFinalVerification({
      window: recovery,
      result: 'PASS',
      originMainCommit: COMMIT_E,
      publicationGitObjectId: COMMIT_C,
      statusArtefactId: DIGEST_D,
    }),
    /must be SUCCESSOR_PUBLISHED, got RECOVERY_REQUIRED/,
  );
});

test('rejects a verifier result for any substituted main, publication or status', () => {
  const base = {
    window: publishedWindow(),
    result: 'PASS',
    originMainCommit: COMMIT_E,
    publicationGitObjectId: COMMIT_C,
    statusArtefactId: DIGEST_D,
  };
  for (const patch of [
    { originMainCommit: COMMIT_B },
    { publicationGitObjectId: COMMIT_B },
    { statusArtefactId: DIGEST_B },
  ]) {
    assert.throws(
      () => recordFinalVerification({ ...base, ...patch }),
      /does not bind the exact window/,
    );
  }
});
