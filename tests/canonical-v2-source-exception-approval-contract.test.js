'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const {
  SOURCE_EXCEPTION_APPROVAL_PROPOSAL_SCHEMA,
  TRUSTED_CONTROLLER_BLOCKER,
  buildSourceExceptionApprovalProposal,
  buildSourceExceptionApprovalReadiness,
  consumeIssuedSourceExceptionApproval,
  validateSourceExceptionApprovalProposal,
  verifyIssuedSourceExceptionApproval,
} = require('../lib/canonical-v2/source-exception-approval-contract');
const { buildSourceIntakeReadiness } = require('../lib/canonical-v2/source-intake-readiness');
const { buildRoutinePrimaryDispositionProposal } = require('../lib/canonical-v2/routine-primary-source-disposition-policy');
const { buildTopBuildOrdinaryMultiOccurrenceDispositionPacket } = require('../lib/canonical-v2/topbuild-ordinary-multi-occurrence-disposition-packet');
const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const { makeCohort } = require('./helpers/canonical-v2-source-intake-fixture');

const ROOT = path.resolve(__dirname, '..');
const digest = (value) => sha256Hex(`source-exception:${value}`);

function request(overrides = {}) {
  return {
    exception_kind: 'FINAL_NON_INCLUDE',
    occurrence: {
      occurrence_id: 'METADATA/exceptional-final-non-include',
      governed_deal_key: 'deal:exceptional-source',
      source_locator: 'https://example.test/exceptional-source',
    },
    source_material: {
      kind: 'UNRESOLVED_SOURCE_EVIDENCE',
      evidence_id: 'evidence:source-unavailable',
      exact_text: 'The identified source is unavailable from the primary source.',
      exact_text_sha256: sha256Hex('The identified source is unavailable from the primary source.'),
    },
    requested_disposition: 'OUT_OF_PROGRAMME_SCOPE',
    reason_code: 'UNRESOLVED_SOURCE_FINAL_DISPOSITION',
    retained_occurrence_id: null,
    replacement_occurrence_id: null,
    independent_review_record: {
      review_record_id: 'review:independent-source-exception',
      reviewer_role: 'INDEPENDENT_LEGAL_REVIEWER',
      reviewed_at: '2026-08-04T12:00:00.000Z',
      evidence_digest: digest('review-evidence'),
    },
    policy_version: 'source-policy/v2-proposed',
    approval_nonce: 'nonce:source-exception:one-use',
    predecessor: { predecessor_proposal_id: null, predecessor_occurrence_id: null },
    supersession: { state: 'NONE', supersedes_proposal_id: null },
    expires_at: '2026-08-11T12:00:00.000Z',
    one_use_state: 'UNUSED_PENDING_TRUSTED_CONTROLLER',
    ...overrides,
  };
}

function ordinaryInputs() {
  const cohort = makeCohort({ dealCount: 40 });
  const packet = buildTopBuildOrdinaryMultiOccurrenceDispositionPacket({
    ...cohort,
    primary_occurrence_id: 'METADATA/deal-1',
    legal_findings: {
      same_executed_agreement: true,
      matched_section_count: 62,
      total_section_count: 63,
      redaction_delta: { section_reference: '7.7', redacted_item_count: 2, redaction_kind: 'EMAIL_ADDRESS_ONLY' },
      unredacted_occurrence_id: 'METADATA/deal-1',
      redacted_occurrence_id: 'TOPBUILD/SECOND_SEC_AGREEMENT_OCCURRENCE',
    },
  });
  const dispositionBody = {
    schema_version: 'M3_TOPBUILD_ORDINARY_MULTI_OCCURRENCE_DISPOSITION_AUTHORITY/V1',
    occurrence_id: 'TOPBUILD/SECOND_SEC_AGREEMENT_OCCURRENCE',
    status: 'ISSUED',
    treatment: 'ORDINARY_MULTI_OCCURRENCE_INCLUSION',
    packet_id: packet.packet_id,
    review_authority_reference_id: 'reviewed-ordinary-source-rule',
  };
  return {
    ...cohort,
    routine_primary_policy: buildRoutinePrimaryDispositionProposal(cohort),
    topbuild_disposition_packet: packet,
    ordinary_reviewed_dispositions: [{
      ...dispositionBody,
      disposition_authority_id: contentId('M3_TOPBUILD_ORDINARY_MULTI_OCCURRENCE_DISPOSITION_AUTHORITY/V1', dispositionBody),
    }],
  };
}

test('builds deterministic non-authority requests for final non-includes, exceptional admissions and reacquisition replacements', () => {
  const finalNonInclude = buildSourceExceptionApprovalProposal(request());
  assert.equal(finalNonInclude.schema_version, SOURCE_EXCEPTION_APPROVAL_PROPOSAL_SCHEMA);
  assert.equal(finalNonInclude.authority, 'NONE');
  assert.equal(finalNonInclude.approval_status, 'NOT_ISSUED');
  assert.deepEqual(validateSourceExceptionApprovalProposal(finalNonInclude), finalNonInclude);

  const exceptionalAdmission = buildSourceExceptionApprovalProposal(request({
    exception_kind: 'EXCEPTIONAL_ADMISSION',
    source_material: { kind: 'EXACT_SOURCE_BYTES', raw_sha256: digest('exceptional-bytes'), raw_byte_length: 61 },
    requested_disposition: 'INCLUDE_AS_ROLE',
    reason_code: 'NON_STANDARD_SOURCE_ROLE',
  }));
  assert.equal(exceptionalAdmission.authority, 'NONE');

  const reacquisition = buildSourceExceptionApprovalProposal(request({
    exception_kind: 'REACQUISITION_REPLACEMENT',
    occurrence: { occurrence_id: 'METADATA/reacquired-source', governed_deal_key: 'deal:exceptional-source', source_locator: 'https://example.test/reacquired' },
    source_material: { kind: 'EXACT_SOURCE_BYTES', raw_sha256: digest('reacquired-bytes'), raw_byte_length: 99 },
    requested_disposition: 'REPLACE_REACQUIRED_SOURCE',
    reason_code: 'REACQUIRED_SOURCE_REPLACES_UNRESOLVED_OCCURRENCE',
    retained_occurrence_id: 'METADATA/prior-unresolved-source',
    replacement_occurrence_id: 'METADATA/reacquired-source',
    predecessor: { predecessor_proposal_id: null, predecessor_occurrence_id: 'METADATA/prior-unresolved-source' },
  }));
  assert.equal(reacquisition.retained_occurrence_id, 'METADATA/prior-unresolved-source');
  assert.equal(reacquisition.replacement_occurrence_id, 'METADATA/reacquired-source');
});

test('ordinary TopBuild inclusion, ordinary admission labels, self-consumption and fabricated authority cannot escape the contract', () => {
  assert.throws(() => buildSourceExceptionApprovalProposal(request({
    occurrence: { occurrence_id: 'TOPBUILD/SECOND_SEC_AGREEMENT_OCCURRENCE', governed_deal_key: 'deal:topbuild', source_locator: 'https://example.test/topbuild' },
  })), (error) => error.code === 'ORDINARY_TOPBUILD_INCLUSION_OUTSIDE_EXCEPTION_CONTRACT');
  assert.throws(() => buildSourceExceptionApprovalProposal(request({
    exception_kind: 'EXCEPTIONAL_ADMISSION',
    source_material: { kind: 'EXACT_SOURCE_BYTES', raw_sha256: digest('ordinary'), raw_byte_length: 1 },
    requested_disposition: 'INCLUDE_AS_ROLE',
    reason_code: 'ORDINARY_ORIGINAL_BYTE_ADMISSION',
  })), (error) => error.code === 'ORDINARY_SOURCE_ADMISSION_OUTSIDE_EXCEPTION_CONTRACT');

  const proposal = buildSourceExceptionApprovalProposal(request());
  const fabricated = {
    schema_version: 'SOURCE_EXCEPTION_APPROVAL_AUTHORITY_BUNDLE/V1',
    source_exception_approval_proposal_id: proposal.source_exception_approval_proposal_id,
    approval_nonce: proposal.approval_nonce,
    consumption_state: 'CONSUMED',
  };
  for (const operation of [verifyIssuedSourceExceptionApproval, consumeIssuedSourceExceptionApproval]) {
    assert.throws(() => operation({ proposal, authority_bundle: fabricated }),
      (error) => error.code === 'TRUSTED_SOURCE_EXCEPTION_APPROVAL_CONTROLLER_UNAVAILABLE');
  }
});

test('source readiness exposes exception requests as a blocker and never as an admission source', () => {
  const proposal = buildSourceExceptionApprovalProposal(request());
  const readiness = buildSourceIntakeReadiness({ ...ordinaryInputs(), source_exception_approval_proposal: proposal });
  assert.equal(readiness.status, 'BLOCKED');
  assert.equal(readiness.source_exception_approval.authority, 'NONE');
  assert.equal(readiness.source_exception_approval.proposal_id, proposal.source_exception_approval_proposal_id);
  assert.ok(readiness.blockers.includes(TRUSTED_CONTROLLER_BLOCKER));
  assert.deepEqual(readiness.execution_sources, []);
  assert.equal(buildSourceExceptionApprovalReadiness().proposal_id, null);
});

test('proposal module has no admission, execution, provider, database, network or write capability', () => {
  const source = fs.readFileSync(path.join(ROOT, 'lib/canonical-v2/source-exception-approval-contract.js'), 'utf8');
  assert.doesNotMatch(source, /loadAdmittedSourceForExecution|validateUnifiedRunManifest|executeUnifiedRun|createCodexCliProvider|node:https|node:http|\bfetch\s*\(|supabase|INSERT\s+INTO|writeFile|mkdir/i);
});
