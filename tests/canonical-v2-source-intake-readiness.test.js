'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { buildRoutinePrimaryDispositionProposal } = require('../lib/canonical-v2/routine-primary-source-disposition-policy');
const {
  SOURCE_INTAKE_TRUSTED_AUTHORITY_REQUIRED_BLOCKERS,
  TOPBUILD_SECOND_OCCURRENCE_ID,
  buildSourceIntakeReadiness,
} = require('../lib/canonical-v2/source-intake-readiness');
const { makeCohort } = require('./helpers/canonical-v2-source-intake-fixture');
const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  buildTopBuildOrdinaryMultiOccurrenceDispositionPacket,
} = require('../lib/canonical-v2/topbuild-ordinary-multi-occurrence-disposition-packet');

function topBuildPacket(cohort) {
  return buildTopBuildOrdinaryMultiOccurrenceDispositionPacket({
    ...cohort,
    primary_occurrence_id: 'METADATA/deal-1',
    legal_findings: {
      same_executed_agreement: true,
      matched_section_count: 62,
      total_section_count: 63,
      redaction_delta: { section_reference: '7.7', redacted_item_count: 2, redaction_kind: 'EMAIL_ADDRESS_ONLY' },
      unredacted_occurrence_id: 'METADATA/deal-1',
      redacted_occurrence_id: TOPBUILD_SECOND_OCCURRENCE_ID,
    },
  });
}

function issuedTopBuildDisposition(packet) {
  const body = {
    schema_version: 'M3_TOPBUILD_ORDINARY_MULTI_OCCURRENCE_DISPOSITION_AUTHORITY/V1',
    occurrence_id: TOPBUILD_SECOND_OCCURRENCE_ID,
    status: 'ISSUED',
    treatment: 'ORDINARY_MULTI_OCCURRENCE_INCLUSION',
    packet_id: packet.packet_id,
    review_authority_reference_id: 'reviewed-ordinary-source-rule',
  };
  return {
    ...body,
    disposition_authority_id: contentId('M3_TOPBUILD_ORDINARY_MULTI_OCCURRENCE_DISPOSITION_AUTHORITY/V1', body),
  };
}

function callerMintedAdoptedPolicy(cohortManifestId) {
  const body = {
    schema_version: 'M3_ROUTINE_PRIMARY_SOURCE_DISPOSITION_AUTHORITY/V1',
    status: 'ADOPTED',
    cohort_capture_manifest_id: cohortManifestId,
    proposal_policy_id: 'caller-minted-proposal',
    admission_authority: 'NOT_ADMISSION_AUTHORITY',
    source_admission_status: 'NOT_ATTEMPTED',
    deal_admission_status: 'NOT_ATTEMPTED',
  };
  return {
    ...body,
    policy_authority_id: contentId('M3_ROUTINE_PRIMARY_SOURCE_DISPOSITION_AUTHORITY/V1', body),
  };
}

function currentProposalInputs() {
  const cohort = makeCohort({ dealCount: 40 });
  const topbuildDispositionPacket = topBuildPacket(cohort);
  return {
    ...cohort,
    routine_primary_policy: buildRoutinePrimaryDispositionProposal(cohort),
    topbuild_disposition_packet: topbuildDispositionPacket,
    ordinary_reviewed_dispositions: [{
      occurrence_id: TOPBUILD_SECOND_OCCURRENCE_ID,
      status: 'PROPOSED_NOT_AUTHORITY',
      treatment: 'ORDINARY_MULTI_OCCURRENCE_INCLUSION',
      disposition_authority_id: 'proposal-only',
    }],
  };
}

test('proposal-only current inputs retain every trusted authority blocker and no authority', () => {
  const readiness = buildSourceIntakeReadiness(currentProposalInputs());
  assert.equal(readiness.status, 'BLOCKED');
  assert.deepEqual(readiness.blockers, [
    'UNISSUED_DEAL_IDENTITIES',
    ...SOURCE_INTAKE_TRUSTED_AUTHORITY_REQUIRED_BLOCKERS,
  ]);
  assert.deepEqual(readiness.execution_sources, []);
  assert.equal(readiness.admission_authority, 'NOT_ADMISSION_AUTHORITY');
  assert.equal(readiness.source_admission_status, 'NOT_ATTEMPTED');
  assert.equal(readiness.deal_admission_status, 'NOT_ATTEMPTED');
  assert.equal(readiness.source_intake_authority.authority, 'NONE');
  assert.equal(readiness.source_intake_authority.trusted_controller_verifier, 'UNAVAILABLE_IN_PHASE1');
  assert.equal(readiness.source_intake_authority.trusted_registry_verifier, 'UNAVAILABLE_IN_PHASE1');
  assert.equal(readiness.caller_authority_diagnostic.authority, 'NONE');
  assert.throws(() => readiness.blockers.splice(0), /read only|Cannot delete property/);
  assert.throws(() => readiness.execution_sources.push('caller-source'), /not extensible/);
});

test('caller-minted ADOPTED policy and ISSUED TopBuild self-hashes cannot remove trusted authority blockers', () => {
  const input = currentProposalInputs();
  let controllerCalls = 0;
  let registryCalls = 0;
  input.routine_primary_policy = callerMintedAdoptedPolicy(input.cohort_manifest.cohort_capture_manifest_id);
  const issued = issuedTopBuildDisposition(input.topbuild_disposition_packet);
  input.topbuild_disposition_packet = issued;
  input.ordinary_reviewed_dispositions = [issued];
  input.trusted_controller_verifier = () => { controllerCalls += 1; return { status: 'PASS' }; };
  input.trusted_registry_verifier = new Proxy({}, {
    get() { registryCalls += 1; return () => ({ status: 'PASS' }); },
  });
  const readiness = buildSourceIntakeReadiness(input);
  assert.equal(readiness.status, 'BLOCKED');
  for (const blocker of SOURCE_INTAKE_TRUSTED_AUTHORITY_REQUIRED_BLOCKERS) {
    assert.ok(readiness.blockers.includes(blocker), blocker);
  }
  assert.equal(readiness.source_intake_authority.authority, 'NONE');
  assert.equal(readiness.source_intake_authority.routine_primary_policy_adoption_authority, 'NONE');
  assert.equal(readiness.source_intake_authority.topbuild_disposition_issuance_authority, 'NONE');
  assert.equal(readiness.caller_authority_diagnostic.status, 'CALLER_INPUT_DIAGNOSTIC_ONLY');
  assert.deepEqual(readiness.execution_sources, []);
  assert.equal(controllerCalls, 0);
  assert.equal(registryCalls, 0);
});

test('stale, swapped, and replayed caller authority records remain diagnostic and blocked', () => {
  const baseline = currentProposalInputs();
  const adopted = callerMintedAdoptedPolicy(baseline.cohort_manifest.cohort_capture_manifest_id);
  const issued = issuedTopBuildDisposition(baseline.topbuild_disposition_packet);
  const cases = [
    {
      name: 'stale-policy-self-hash',
      policy: { ...adopted, proposal_policy_id: 'changed-after-self-hash' },
      disposition: issued,
    },
    {
      name: 'stale-disposition-self-hash',
      policy: adopted,
      disposition: { ...issued, treatment: 'CHANGED_AFTER_SELF_HASH' },
    },
    {
      name: 'swapped-packet',
      policy: adopted,
      disposition: { ...issued, packet_id: '0'.repeat(64) },
    },
    {
      name: 'replayed-prior-cohort',
      policy: callerMintedAdoptedPolicy('f'.repeat(64)),
      disposition: { ...issued, review_authority_reference_id: 'replayed-prior-review' },
    },
  ];
  for (const hostile of cases) {
    const input = structuredClone(baseline);
    input.routine_primary_policy = hostile.policy;
    input.ordinary_reviewed_dispositions = [hostile.disposition];
    const readiness = buildSourceIntakeReadiness(input);
    assert.equal(readiness.status, 'BLOCKED', hostile.name);
    assert.deepEqual(
      readiness.blockers.filter((code) => SOURCE_INTAKE_TRUSTED_AUTHORITY_REQUIRED_BLOCKERS.includes(code)),
      SOURCE_INTAKE_TRUSTED_AUTHORITY_REQUIRED_BLOCKERS,
      hostile.name,
    );
    assert.equal(readiness.caller_authority_diagnostic.authority, 'NONE', hostile.name);
    assert.equal(readiness.source_intake_authority.authority, 'NONE', hostile.name);
  }
});

test('fails closed on hidden occurrences, a legacy exceptional input, and an unissued or mismatched ordinary disposition', () => {
  const cases = [
    (input) => input.receipt_records.pop(),
    (input) => { input.exceptional_dispositions = input.ordinary_reviewed_dispositions; delete input.ordinary_reviewed_dispositions; },
    (input) => { input.ordinary_reviewed_dispositions = []; },
    (input) => { input.ordinary_reviewed_dispositions[0].packet_id = '0'.repeat(64); },
    (input) => { input.topbuild_disposition_packet.legal_findings.matched_section_count = 61; },
  ];
  for (const mutate of cases) {
    const input = structuredClone(currentProposalInputs());
    input.ordinary_reviewed_dispositions = [issuedTopBuildDisposition(input.topbuild_disposition_packet)];
    mutate(input);
    const readiness = buildSourceIntakeReadiness(input);
    assert.equal(readiness.status, 'BLOCKED');
    assert.deepEqual(readiness.execution_sources, []);
  }
});

test('obsolete V1 identity authority or value manifests cannot satisfy source-intake readiness', () => {
  const input = currentProposalInputs();
  input.governed_deal_identity_authority = {
    schema_version: 'GOVERNED_DEAL_IDENTITY_MANIFEST/V1',
    authority: 'LEGACY',
    value: 'caller-chosen',
  };
  const readiness = buildSourceIntakeReadiness(input);
  assert.equal(readiness.status, 'BLOCKED');
  assert.ok(readiness.blockers.includes('OBSOLETE_V1_DEAL_IDENTITY_AUTHORITY_REJECTED'));
  assert.ok(readiness.blockers.includes('UNISSUED_DEAL_IDENTITIES'));
  assert.deepEqual(readiness.execution_sources, []);
});
