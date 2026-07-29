const assert = require('node:assert/strict');
const test = require('node:test');

const { enumerateClosedMembers } = require('../../lib/programme-gates/enumerate');
const {
  createReviewContractBundle,
} = require('../../lib/programme-gates/review-contracts');
const {
  BEN_APPROVAL_CONTRACT,
  REVIEW_SET_CONTRACT,
  enumerateReviewExpectedMembers,
  memberSchemaSetForReview,
} = require('../../lib/programme-gates/review-enumerator');
const {
  ACCEPTANCE_DEFINITION_DESCRIPTORS,
} = require('../../lib/programme-gates/registry');
const {
  validateSchema,
} = require('../../lib/programme-gates/schema-registry');

const ROOT = 'a'.repeat(64);
const REVIEW_ID = 'b'.repeat(64);
const APPROVAL_ID = 'c'.repeat(64);
const COMMIT = 'd'.repeat(40);
const ARTIFACT = 'e'.repeat(64);

function reviewEvidence() {
  return {
    review_set_evidence_id: REVIEW_ID,
    reviewed_root: ROOT,
    reviewed_code_commit: COMMIT,
    review_artifact_sha256: ARTIFACT,
    review_artifact_byte_size: 16759182,
    lane_outcomes: [
      'ARCHITECTURE',
      'LEGAL_SEMANTIC',
      'QUERY_EFFICIENCY',
      'OPEN_WORLD',
      'RELEASE_PROPAGATION',
    ].map((lane_id) => ({
      lane_id,
      disposition: 'FAIL',
      review_output_digest: ARTIFACT,
      blocking_finding_count: 1,
    })),
    full_review_disposition: 'FAIL',
    full_review_pass_claimed: false,
  };
}

function approvalEvidence() {
  return {
    approval_evidence_id: APPROVAL_ID,
    approved_root: ROOT,
    approved_code_commit: COMMIT,
    review_set_evidence_id: REVIEW_ID,
    reviewed_root: ROOT,
    reviewed_code_commit: COMMIT,
    review_artifact_sha256: ARTIFACT,
    review_artifact_byte_size: 16759182,
    full_review_pass_claimed: false,
    authorisation_scope: 'ISOLATED_STAGING_CANONICAL_IMPLEMENTATION',
    permitted_actions: [
      'IMPLEMENTATION_PLANNING',
      'ISOLATED_STAGING_SETUP',
      'STAGING_SNAPSHOT_RESTORE_AND_PREVIEW',
      'STAGING_ONLY_CANONICAL_ENGINEERING_BEHIND_DISABLED_PRODUCTION_FLAGS',
    ],
    prohibited_actions: [
      'PRODUCTION_DATA_OR_CORPUS_WRITE',
      'PRODUCTION_REEXTRACTION_OR_BACKFILL',
      'PRODUCTION_OR_RELEASE_IMPORT',
      'RELEASE_ACTIVATION',
      'PRODUCT_FEATURE_ACTIVATION',
      'PRODUCTION_CUTOVER',
    ],
    review_findings_disposition: 'ACKNOWLEDGED_NOT_RESOLVED_OR_WAIVED',
    p1_p9_gate_state: 'OPEN',
    governance_diff_digest: ARTIFACT,
    github_actor_login: 'CodeNameHash',
    github_actor_id: '264183176',
    github_run_id: '30439653818',
    approval_intent: 'AUTHORISE_ISOLATED_STAGING_CANONICAL_IMPLEMENTATION',
    conditions: [],
  };
}

test('review and Ben approval contracts are active, closed and schema-bound', () => {
  const bundle = createReviewContractBundle({ specificationRoot: ROOT });
  assert.equal(bundle.definitions.length, 2);
  assert.deepEqual(
    bundle.definitions.map((definition) => definition.evidence_contract),
    [REVIEW_SET_CONTRACT, BEN_APPROVAL_CONTRACT],
  );
  for (const definition of bundle.definitions) {
    assert.equal(validateSchema('ProgrammeGateAcceptanceDefinition/V1', definition), true);
  }

  const activeReviewDescriptors = ACCEPTANCE_DEFINITION_DESCRIPTORS
    .filter((descriptor) => [
      'G0_EXACT_DIGEST_REVIEW_SET',
      'G0_BEN_SPEC_APPROVAL',
    ].includes(descriptor.gate_id));
  assert.ok(activeReviewDescriptors.every(
    (descriptor) => descriptor.activation_state === 'ACTIVE',
  ));
});

test('review claim definitions name their exact evidence and signed member paths', () => {
  const { definitions } = createReviewContractBundle({ specificationRoot: ROOT });
  const review = definitions.find(
    (definition) => definition.evidence_contract === REVIEW_SET_CONTRACT,
  );
  const approval = definitions.find(
    (definition) => definition.evidence_contract === BEN_APPROVAL_CONTRACT,
  );

  assert.deepEqual(
    new Set(review.ordered_claim_predicate_definitions.flatMap(
      (claim) => claim.exact_input_member_types_and_paths.map((entry) => entry.member_type),
    )),
    new Set([
      'ExactDigestReviewSetAttestation',
      'ColdReviewOutput',
      'TrustedReviewControllerRecord',
      'ReviewerIndependenceAttestation',
    ]),
  );
  assert.deepEqual(
    new Set(approval.ordered_claim_predicate_definitions.flatMap(
      (claim) => claim.exact_input_member_types_and_paths.map((entry) => entry.member_type),
    )),
    new Set([
      'BenSpecificationApprovalEvidence',
      'BenSpecificationApproval',
      'ExactDigestReviewSetAttestation',
    ]),
  );
});

test('review member universes reject missing, extra and duplicate members', () => {
  const { definitions } = createReviewContractBundle({ specificationRoot: ROOT });
  const definition = definitions.find(
    (entry) => entry.evidence_contract === REVIEW_SET_CONTRACT,
  );
  const expected = enumerateReviewExpectedMembers({
    definition,
    evidenceObject: reviewEvidence(),
  });
  const actual = expected.map((entry) => ({ ...entry, payload: {} }));
  assert.equal(enumerateClosedMembers({ expectedMembers: expected, members: actual }).length, 15);
  assert.throws(
    () => enumerateClosedMembers({ expectedMembers: expected, members: actual.slice(1) }),
    /missing required member_id/,
  );
  assert.throws(
    () => enumerateClosedMembers({
      expectedMembers: expected,
      members: [...actual, { member_id: 'extra', member_type: 'Unexpected', payload: {} }],
    }),
    /undeclared member_id/,
  );
  assert.throws(
    () => enumerateClosedMembers({
      expectedMembers: expected,
      members: [...actual, actual[0]],
    }),
    /duplicate member_id/,
  );
});

test('Ben approval universe binds one authorisation to its exact review outcome set', () => {
  const { definitions } = createReviewContractBundle({ specificationRoot: ROOT });
  const definition = definitions.find(
    (entry) => entry.evidence_contract === BEN_APPROVAL_CONTRACT,
  );
  assert.deepEqual(
    enumerateReviewExpectedMembers({
      definition,
      evidenceObject: approvalEvidence(),
    }).map(({ member_id, member_type }) => ({ member_id, member_type })),
    [
      {
        member_id: `approval:${APPROVAL_ID}`,
        member_type: 'BenSpecificationApproval',
      },
      {
        member_id: `review-set:${REVIEW_ID}`,
        member_type: 'ExactDigestReviewSetAttestation',
      },
    ],
  );
  assert.deepEqual(memberSchemaSetForReview(BEN_APPROVAL_CONTRACT), [
    {
      member_type: 'BenSpecificationApproval',
      schema_id: 'BenSpecificationApproval/V2',
    },
    {
      member_type: 'ExactDigestReviewSetAttestation',
      schema_id: 'ExactDigestReviewSetAttestation/V2',
    },
  ]);
});

test('review evidence projections are closed schemas', () => {
  assert.equal(
    validateSchema('ExactDigestReviewSetAttestation/V2', reviewEvidence()),
    true,
  );
  assert.equal(
    validateSchema('BenSpecificationApprovalEvidence/V2', approvalEvidence()),
    true,
  );
  assert.throws(
    () => validateSchema('ExactDigestReviewSetAttestation/V2', {
      ...reviewEvidence(),
      passing: true,
    }),
    /additional properties/,
  );
});
