const { REVIEW_LANES } = require('./registry');

const REVIEW_SET_CONTRACT =
  'five-lane-exact-signed-review-outcomes-recorded/v1';
const BEN_APPROVAL_CONTRACT = 'ben-exact-root-isolated-staging-authorisation/v1';

const REVIEW_MEMBER_SCHEMA_SETS = Object.freeze({
  [REVIEW_SET_CONTRACT]: Object.freeze([
    Object.freeze({
      member_type: 'ColdReviewOutput',
      schema_id: 'ColdReviewOutput/V1',
    }),
    Object.freeze({
      member_type: 'ReviewerIndependenceAttestation',
      schema_id: 'ReviewerIndependenceAttestation/V1',
    }),
    Object.freeze({
      member_type: 'TrustedReviewControllerRecord',
      schema_id: 'TrustedReviewControllerRecord/V1',
    }),
  ]),
  [BEN_APPROVAL_CONTRACT]: Object.freeze([
    Object.freeze({
      member_type: 'BenSpecificationApproval',
      schema_id: 'BenSpecificationApproval/V2',
    }),
    Object.freeze({
      member_type: 'ExactDigestReviewSetAttestation',
      schema_id: 'ExactDigestReviewSetAttestation/V2',
    }),
  ]),
});

function contractForDefinition(definition) {
  const contract = definition && definition.evidence_contract;
  if (!Object.hasOwn(REVIEW_MEMBER_SCHEMA_SETS, contract)) {
    throw new Error(`unsupported review evidence contract: ${contract}`);
  }
  return contract;
}

function member(memberId, memberType, payload) {
  return Object.freeze({
    member_id: memberId,
    member_type: memberType,
    ...(payload === undefined ? {} : { payload }),
  });
}

function expectedReviewMembers() {
  return REVIEW_LANES.flatMap((lane) => [
    member(`controller:${lane.lane_id}`, 'TrustedReviewControllerRecord'),
    member(`output:${lane.lane_id}`, 'ColdReviewOutput'),
    member(`independence:${lane.lane_id}`, 'ReviewerIndependenceAttestation'),
  ]);
}

function expectedApprovalMembers(evidenceObject) {
  return [
    member(`approval:${evidenceObject.approval_evidence_id}`, 'BenSpecificationApproval'),
    member(
      `review-set:${evidenceObject.review_set_evidence_id}`,
      'ExactDigestReviewSetAttestation',
    ),
  ];
}

function enumerateReviewExpectedMembers({ definition, evidenceObject }) {
  const contract = contractForDefinition(definition);
  if (!evidenceObject || typeof evidenceObject !== 'object' || Array.isArray(evidenceObject)) {
    throw new TypeError('review evidence object must be an object');
  }
  return Object.freeze(
    contract === REVIEW_SET_CONTRACT
      ? expectedReviewMembers()
      : expectedApprovalMembers(evidenceObject),
  );
}

function reviewSetMembers(reviewMembers) {
  if (!Array.isArray(reviewMembers)) {
    throw new TypeError('review members must be an array');
  }
  return Object.freeze(reviewMembers.flatMap((entry) => [
    member(
      `controller:${entry.lane_id}`,
      'TrustedReviewControllerRecord',
      entry.controller_record,
    ),
    member(
      `output:${entry.lane_id}`,
      'ColdReviewOutput',
      entry.review_output,
    ),
    member(
      `independence:${entry.lane_id}`,
      'ReviewerIndependenceAttestation',
      entry.independence_attestation,
    ),
  ]));
}

function benApprovalMembers({ approvalEvidenceId, approvalRecord, reviewSetAttestation }) {
  return Object.freeze([
    member(
      `approval:${approvalEvidenceId}`,
      'BenSpecificationApproval',
      approvalRecord,
    ),
    member(
      `review-set:${reviewSetAttestation.review_set_evidence_id}`,
      'ExactDigestReviewSetAttestation',
      reviewSetAttestation,
    ),
  ]);
}

function memberSchemaSetForReview(evidenceContract) {
  const schemaSet = REVIEW_MEMBER_SCHEMA_SETS[evidenceContract];
  if (!schemaSet) {
    throw new Error(`unsupported review evidence contract: ${evidenceContract}`);
  }
  return schemaSet;
}

module.exports = {
  BEN_APPROVAL_CONTRACT,
  REVIEW_MEMBER_SCHEMA_SETS,
  REVIEW_SET_CONTRACT,
  benApprovalMembers,
  enumerateReviewExpectedMembers,
  memberSchemaSetForReview,
  reviewSetMembers,
};
