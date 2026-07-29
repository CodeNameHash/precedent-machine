const crypto = require('node:crypto');
const path = require('node:path');
const { domainDigest: contextlessDomainDigest } = require('./bytes');
const {
  enumerateCompleteGitAuthorshipUniverse,
} = require('./git-authorship');

const {
  REVIEW_CONTROLLER_POLICY,
  REVIEW_LANES,
  acceptanceDescriptorForContract,
} = require('./registry');
const { validateSchema } = require('./schema-registry');
const {
  specificationRootFromMembers,
} = require('./review-controller');

const HOUR_MS = 60 * 60 * 1000;
const FRESHNESS_WINDOWS_MS = Object.freeze({
  LIVE: 24 * HOUR_MS,
  GOVERNANCE: 7 * 24 * HOUR_MS,
});

const RAW_EVIDENCE_KEYS = Object.freeze({
  G0_MARKET_STATS_CONTAINED: Object.freeze([
    'schema_version',
    'gate_id',
    'code_commit',
    'runtime_deployment_id',
    'environment',
    'observed_at',
    'route_feature_enabled',
    'method_probes',
    'tests',
  ]),
  G0_BROAD_CORPUS_ROUTES_CONTAINED: Object.freeze([
    'schema_version',
    'gate_id',
    'code_commit',
    'runtime_deployment_id',
    'environment',
    'observed_at',
    'source_route_ids',
    'built_route_ids',
    'runtime_route_ids',
    'routes',
    'tests',
  ]),
  G0_ZAYO_DISPOSITION: Object.freeze([
    'schema_version',
    'gate_id',
    'code_commit',
    'environment',
    'observed_at',
    'attestation_source_digest',
    'process_identity_digest',
    'owner',
    'purpose',
    'recognition_status',
    'rotation_required',
    'rotation_completed',
    'secret_field_count',
  ]),
  G0_CLAUDE_CREDENTIAL_ROTATION: Object.freeze([
    'schema_version',
    'gate_id',
    'code_commit',
    'environment',
    'observed_at',
    'attestation_source_digest',
    'compromised_credential_ids',
    'revoked_ids',
    'replacement_activation_verified_at',
    'secret_field_count',
  ]),
  G0_SUPABASE_SECRET_DISPOSITION: Object.freeze([
    'schema_version',
    'gate_id',
    'code_commit',
    'environment',
    'observed_at',
    'attestation_source_digest',
    'disposition',
    'rotation_verified_at',
    'zayo_disposition_id',
    'ben_approval_id',
    'secret_field_count',
  ]),
  G0_STAGING_SUPABASE_ISOLATED: Object.freeze([
    'production_project_identity_digest',
    'staging_project_identity_digest',
    'production_credential_identity_digest',
    'staging_credential_identity_digest',
    'production_dml_probe',
    'restore_mode',
  ]),
  G0_STAGING_VERCEL_ISOLATED: Object.freeze([
    'preview_deployment_id',
    'preview_credential_scope',
    'production_alias_before',
    'production_alias_after',
  ]),
  G0_STAGING_ACCESS_PROTECTED: Object.freeze([
    'source_route_action_inventory',
    'source_route_action_inventory_root',
    'built_route_action_inventory',
    'built_route_action_inventory_root',
    'runtime_route_action_inventory',
    'runtime_route_action_inventory_root',
    'preview_route_actions',
  ]),
  G0_EXACT_DIGEST_REVIEW_SET: Object.freeze([
    'review_set_evidence_id',
    'reviewed_root',
  ]),
  G0_BEN_SPEC_APPROVAL: Object.freeze([
    'approval_evidence_id',
    'approved_root',
    'passing_review_set_evidence_id',
    'conditions',
  ]),
  P1_CONTRACT_FREEZE_ATTESTED: Object.freeze([
    'schema_version',
    'gate_id',
    'specification_root',
    'code_commit',
    'environment',
    'observed_at',
    'contract_bundle_id',
    'contract_bundle_digest',
    'contract_freeze_attestation_id',
    'frozen_contract_pair_digest',
    'contract_authority_manifest_id',
    'contract_authority_manifest_digest',
    'compilation_receipt_id',
    'semantic_identity_review_id',
    'legal_semantic_review_disposition_id',
    'identity_review_disposition_id',
    'freeze_gate_approval_id',
    'ben_bundle_approval_evidence_id',
    'authority_member_inventory',
    'status_generation',
    'status_payload_digest',
  ]),
});

const NESTED_RAW_EVIDENCE_KEYS = Object.freeze({
  method_probe: Object.freeze([
    'schema_version',
    'member_id',
    'route_id',
    'method',
    'status',
    'error_code',
    'cache_control',
    'database_calls',
    'corpus_reads',
    'retry_after',
    'code_commit',
    'runtime_deployment_id',
    'environment',
    'observed_at',
  ]),
  test: Object.freeze([
    'schema_version',
    'test_id',
    'code_commit',
    'environment',
    'command_digest',
    'executable_digest',
    'started_at',
    'completed_at',
    'exit_code',
    'output_digest',
    'attester_key_id',
    'signature_algorithm',
    'execution_signature',
  ]),
  route: Object.freeze([
    'schema_version',
    'member_id',
    'route_id',
    'method',
    'containment_class',
    'source_contained',
    'built_contained',
    'runtime_contained',
    'runtime_status',
    'runtime_error_code',
    'database_calls',
    'corpus_reads',
    'node_corpus_reads',
    'legacy_fallback_used',
    'code_commit',
    'runtime_deployment_id',
    'environment',
    'observed_at',
  ]),
});

const MARKET_STATS_METHODS = Object.freeze(['POST']);
const REQUIRED_CONTAINMENT_TEST_IDS = Object.freeze(['P0-ROUTE-01']);

const GATE_FRESHNESS_CLASS = Object.freeze({
  G0_MARKET_STATS_CONTAINED: 'LIVE',
  G0_BROAD_CORPUS_ROUTES_CONTAINED: 'LIVE',
  G0_ZAYO_DISPOSITION: 'GOVERNANCE',
  G0_CLAUDE_CREDENTIAL_ROTATION: 'GOVERNANCE',
  G0_SUPABASE_SECRET_DISPOSITION: 'GOVERNANCE',
  G0_STAGING_SUPABASE_ISOLATED: 'GOVERNANCE',
  G0_STAGING_VERCEL_ISOLATED: 'GOVERNANCE',
  G0_STAGING_ACCESS_PROTECTED: 'LIVE',
  G0_EXACT_DIGEST_REVIEW_SET: 'GOVERNANCE',
  G0_BEN_SPEC_APPROVAL: 'GOVERNANCE',
  P1_CONTRACT_FREEZE_ATTESTED: 'GOVERNANCE',
});

class AcceptancePredicateError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AcceptancePredicateError';
    this.code = code;
  }
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value, expectedKeys) {
  if (!isRecord(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index]);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function isDigest(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

function isCommit(value) {
  return typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
}

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function isTimestamp(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function isUniqueNonEmptyStringArray(value) {
  return Array.isArray(value)
    && value.length > 0
    && value.every(isNonEmptyString)
    && new Set(value).size === value.length;
}

function sameClosedStringSet(left, right) {
  return isUniqueNonEmptyStringArray(left)
    && isUniqueNonEmptyStringArray(right)
    && left.length === right.length
    && left.every((value) => right.includes(value));
}

function trustedNow(clock) {
  if (!clock || typeof clock.now !== 'function') {
    throw new AcceptancePredicateError(
      'TRUSTED_CLOCK_REQUIRED',
      'context.clock.now must be a trusted injected clock',
    );
  }
  const value = clock.now();
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new AcceptancePredicateError(
      'INVALID_TRUSTED_CLOCK',
      'context.clock.now returned an invalid time',
    );
  }
  return date.getTime();
}

function sharedContextIsCurrent(context, freshnessClass) {
  if (!isRecord(context)) return false;
  if (!isDigest(context.specificationRoot) || !isDigest(context.expectedSpecificationRoot)) {
    return false;
  }
  if (!isCommit(context.codeCommit) || !isCommit(context.expectedCodeCommit)) return false;
  if (!['STAGING', 'PRODUCTION'].includes(context.environment)) return false;
  if (!['STAGING', 'PRODUCTION'].includes(context.expectedEnvironment)) return false;
  if (context.specificationRoot !== context.expectedSpecificationRoot) return false;
  if (context.codeCommit !== context.expectedCodeCommit) return false;
  if (context.environment !== context.expectedEnvironment) return false;
  if (!isTimestamp(context.observed_at)) return false;

  const age = trustedNow(context.clock) - Date.parse(context.observed_at);
  return age >= 0 && age <= FRESHNESS_WINDOWS_MS[freshnessClass];
}

function testRecordsAreValid(tests) {
  return Array.isArray(tests)
    && tests.length > 0
    && tests.every((entry) => (
      hasExactKeys(entry, NESTED_RAW_EVIDENCE_KEYS.test)
      && entry.schema_version === 'ProgrammeGateTestExecutionRecord/V1'
      && isNonEmptyString(entry.test_id)
      && isCommit(entry.code_commit)
      && ['STAGING', 'PRODUCTION'].includes(entry.environment)
      && isDigest(entry.command_digest)
      && isDigest(entry.executable_digest)
      && isTimestamp(entry.started_at)
      && isTimestamp(entry.completed_at)
      && Date.parse(entry.completed_at) >= Date.parse(entry.started_at)
      && Number.isInteger(entry.exit_code)
      && isDigest(entry.output_digest)
      && isNonEmptyString(entry.attester_key_id)
      && entry.signature_algorithm === 'Ed25519'
      && isNonEmptyString(entry.execution_signature)
    ))
    && new Set(tests.map((entry) => entry.test_id)).size === tests.length;
}

function methodProbeRecordsAreValid(probes) {
  return Array.isArray(probes)
    && probes.length > 0
    && probes.every((probe) => (
      hasExactKeys(probe, NESTED_RAW_EVIDENCE_KEYS.method_probe)
      && probe.schema_version === 'ContainedRouteMethodProbe/V1'
      && isNonEmptyString(probe.member_id)
      && isNonEmptyString(probe.route_id)
      && isNonEmptyString(probe.method)
      && Number.isInteger(probe.status)
      && isNonEmptyString(probe.error_code)
      && isNonEmptyString(probe.cache_control)
      && isNonNegativeInteger(probe.database_calls)
      && isNonNegativeInteger(probe.corpus_reads)
      && (probe.retry_after === null || isNonEmptyString(probe.retry_after))
      && isCommit(probe.code_commit)
      && isNonEmptyString(probe.runtime_deployment_id)
      && ['STAGING', 'PRODUCTION'].includes(probe.environment)
      && isTimestamp(probe.observed_at)
    ))
    && new Set(probes.map((probe) => probe.member_id)).size === probes.length;
}

function routeRecordsAreValid(routes) {
  return Array.isArray(routes)
    && routes.length > 0
    && routes.every((route) => (
      hasExactKeys(route, NESTED_RAW_EVIDENCE_KEYS.route)
      && route.schema_version === 'BroadRouteActionObservation/V1'
      && isNonEmptyString(route.member_id)
      && isNonEmptyString(route.route_id)
      && isNonEmptyString(route.method)
      && ['QUERY_ROUTE', 'BROAD_CORPUS_ACTION', 'PUBLIC_SERVICE_ACTION']
        .includes(route.containment_class)
      && typeof route.source_contained === 'boolean'
      && typeof route.built_contained === 'boolean'
      && typeof route.runtime_contained === 'boolean'
      && Number.isInteger(route.runtime_status)
      && (route.runtime_error_code === null || isNonEmptyString(route.runtime_error_code))
      && isNonNegativeInteger(route.database_calls)
      && isNonNegativeInteger(route.corpus_reads)
      && isNonNegativeInteger(route.node_corpus_reads)
      && typeof route.legacy_fallback_used === 'boolean'
      && isCommit(route.code_commit)
      && isNonEmptyString(route.runtime_deployment_id)
      && ['STAGING', 'PRODUCTION'].includes(route.environment)
      && isTimestamp(route.observed_at)
    ))
    && new Set(routes.map((route) => route.member_id)).size === routes.length;
}

function rawEvidenceShapeIsValid(gateId, evidence) {
  if (!hasExactKeys(evidence, RAW_EVIDENCE_KEYS[gateId] || [])) return false;
  switch (gateId) {
    case 'G0_MARKET_STATS_CONTAINED':
      return evidence.schema_version === 'MarketStatsContainmentAttestation/V1'
        && evidence.gate_id === gateId
        && isCommit(evidence.code_commit)
        && isNonEmptyString(evidence.runtime_deployment_id)
        && ['STAGING', 'PRODUCTION'].includes(evidence.environment)
        && isTimestamp(evidence.observed_at)
        && typeof evidence.route_feature_enabled === 'boolean'
        && methodProbeRecordsAreValid(evidence.method_probes)
        && testRecordsAreValid(evidence.tests);
    case 'G0_BROAD_CORPUS_ROUTES_CONTAINED':
      return evidence.schema_version === 'BroadRouteContainmentAttestation/V1'
        && evidence.gate_id === gateId
        && isCommit(evidence.code_commit)
        && isNonEmptyString(evidence.runtime_deployment_id)
        && ['STAGING', 'PRODUCTION'].includes(evidence.environment)
        && isTimestamp(evidence.observed_at)
        && isUniqueNonEmptyStringArray(evidence.source_route_ids)
        && isUniqueNonEmptyStringArray(evidence.built_route_ids)
        && isUniqueNonEmptyStringArray(evidence.runtime_route_ids)
        && routeRecordsAreValid(evidence.routes)
        && testRecordsAreValid(evidence.tests);
    case 'G0_ZAYO_DISPOSITION':
      return evidence.schema_version === 'ZayoTrafficDisposition/V1'
        && evidence.gate_id === gateId
        && isCommit(evidence.code_commit)
        && ['STAGING', 'PRODUCTION'].includes(evidence.environment)
        && isTimestamp(evidence.observed_at)
        && isDigest(evidence.attestation_source_digest)
        && isDigest(evidence.process_identity_digest)
        && isNonEmptyString(evidence.owner)
        && isNonEmptyString(evidence.purpose)
        && ['RECOGNISED', 'UNRECOGNISED'].includes(evidence.recognition_status)
        && typeof evidence.rotation_required === 'boolean'
        && typeof evidence.rotation_completed === 'boolean'
        && isNonNegativeInteger(evidence.secret_field_count);
    case 'G0_CLAUDE_CREDENTIAL_ROTATION':
      return evidence.schema_version === 'ClaudeCredentialRotationReceipt/V1'
        && evidence.gate_id === gateId
        && isCommit(evidence.code_commit)
        && ['STAGING', 'PRODUCTION'].includes(evidence.environment)
        && isTimestamp(evidence.observed_at)
        && isDigest(evidence.attestation_source_digest)
        && isUniqueNonEmptyStringArray(evidence.compromised_credential_ids)
        && evidence.compromised_credential_ids.every(isDigest)
        && isUniqueNonEmptyStringArray(evidence.revoked_ids)
        && evidence.revoked_ids.every(isDigest)
        && isTimestamp(evidence.replacement_activation_verified_at)
        && isNonNegativeInteger(evidence.secret_field_count);
    case 'G0_SUPABASE_SECRET_DISPOSITION':
      return evidence.schema_version === 'SupabaseSecretDisposition/V1'
        && evidence.gate_id === gateId
        && isCommit(evidence.code_commit)
        && ['STAGING', 'PRODUCTION'].includes(evidence.environment)
        && isTimestamp(evidence.observed_at)
        && isDigest(evidence.attestation_source_digest)
        && ['ROTATED', 'RECOGNISED_TRAFFIC_APPROVED_NA'].includes(evidence.disposition)
        && (evidence.rotation_verified_at === null || isTimestamp(evidence.rotation_verified_at))
        && (evidence.zayo_disposition_id === null || isDigest(evidence.zayo_disposition_id))
        && (evidence.ben_approval_id === null || isDigest(evidence.ben_approval_id))
        && isNonNegativeInteger(evidence.secret_field_count);
    case 'G0_STAGING_SUPABASE_ISOLATED':
      return isDigest(evidence.production_project_identity_digest)
        && isDigest(evidence.staging_project_identity_digest)
        && isDigest(evidence.production_credential_identity_digest)
        && isDigest(evidence.staging_credential_identity_digest)
        && isNonEmptyString(evidence.production_dml_probe)
        && isNonEmptyString(evidence.restore_mode);
    case 'G0_STAGING_VERCEL_ISOLATED':
      return isNonEmptyString(evidence.preview_deployment_id)
        && isNonEmptyString(evidence.preview_credential_scope)
        && isNonEmptyString(evidence.production_alias_before)
        && isNonEmptyString(evidence.production_alias_after);
    case 'G0_STAGING_ACCESS_PROTECTED':
      return Array.isArray(evidence.preview_route_actions)
        && evidence.preview_route_actions.length >= PREVIEW_ACTION_CLASSES.length
        && evidence.preview_route_actions.every((entry) => (
          isRecord(entry)
          && isNonEmptyString(entry.action_id)
          && PREVIEW_ACTION_CLASSES.includes(entry.action_class)
          && Number.isInteger(entry.unauthenticated_before_restore_status)
          && Number.isInteger(entry.unauthenticated_after_restore_status)
          && Number.isInteger(entry.authenticated_non_admin_status)
          && (entry.authorised_test_status === null
            || Number.isInteger(entry.authorised_test_status))
          && typeof entry.feature_enabled === 'boolean'
        ));
    case 'G0_EXACT_DIGEST_REVIEW_SET':
      return isDigest(evidence.review_set_evidence_id)
        && isDigest(evidence.reviewed_root);
    case 'G0_BEN_SPEC_APPROVAL':
      return isDigest(evidence.approval_evidence_id)
        && isDigest(evidence.approved_root)
        && isDigest(evidence.passing_review_set_evidence_id)
        && Array.isArray(evidence.conditions);
    case 'P1_CONTRACT_FREEZE_ATTESTED':
      return evidence.schema_version === 'ContractFreezeAttestation/V1'
        && evidence.gate_id === gateId
        && isDigest(evidence.specification_root)
        && isCommit(evidence.code_commit)
        && ['STAGING', 'PRODUCTION'].includes(evidence.environment)
        && isTimestamp(evidence.observed_at)
        && isDigest(evidence.contract_bundle_id)
        && isDigest(evidence.contract_bundle_digest)
        && isDigest(evidence.contract_freeze_attestation_id)
        && isDigest(evidence.frozen_contract_pair_digest)
        && isDigest(evidence.contract_authority_manifest_id)
        && isDigest(evidence.contract_authority_manifest_digest)
        && isDigest(evidence.compilation_receipt_id)
        && isDigest(evidence.semantic_identity_review_id)
        && isDigest(evidence.legal_semantic_review_disposition_id)
        && isDigest(evidence.identity_review_disposition_id)
        && isDigest(evidence.freeze_gate_approval_id)
        && isDigest(evidence.ben_bundle_approval_evidence_id)
        && Number.isInteger(evidence.status_generation)
        && evidence.status_generation >= 1
        && isDigest(evidence.status_payload_digest);
    default:
      return false;
  }
}

function evidenceCanBeEvaluated(gateId, evidence, context) {
  return rawEvidenceShapeIsValid(gateId, evidence)
    && sharedContextIsCurrent(context, GATE_FRESHNESS_CLASS[gateId])
    && (!Object.hasOwn(evidence, 'code_commit')
      || (
        evidence.code_commit === context.codeCommit
        && evidence.environment === context.environment
        && evidence.observed_at === context.observed_at
      ));
}

function featureGateOff(evidence) {
  return evidence.route_feature_enabled === false;
}

function liveRouteZeroCorpusReads(evidence, context) {
  return sameClosedStringSet(
    evidence.method_probes.map((probe) => probe.method),
    MARKET_STATS_METHODS,
  ) && evidence.method_probes.every((probe) => (
    probe.member_id === `${probe.method} /api/market-stats`
    && probe.route_id === '/api/market-stats'
    && probe.status === 503
    && probe.error_code === 'MARKET_STATS_DISABLED'
    && /private/i.test(probe.cache_control)
    && /no-store/i.test(probe.cache_control)
    && probe.database_calls === 0
    && probe.corpus_reads === 0
    && probe.retry_after === null
    && probe.code_commit === context.codeCommit
    && probe.runtime_deployment_id === evidence.runtime_deployment_id
    && probe.environment === context.environment
    && probe.observed_at === context.observed_at
  ));
}

function containmentTestPass(evidence, context) {
  return sameClosedStringSet(
    evidence.tests.map((entry) => entry.test_id),
    REQUIRED_CONTAINMENT_TEST_IDS,
  ) && evidence.tests.every((entry) => (
    entry.exit_code === 0
    && entry.code_commit === context.codeCommit
    && entry.environment === context.environment
    && Date.parse(entry.completed_at) <= Date.parse(context.observed_at)
  ));
}

function sourceBuiltAndRuntimeRouteInventoriesEqual(evidence) {
  return sameClosedStringSet(evidence.source_route_ids, evidence.built_route_ids)
    && sameClosedStringSet(evidence.source_route_ids, evidence.runtime_route_ids);
}

function everyBroadRouteContained(evidence, context) {
  return sameClosedStringSet(
    evidence.source_route_ids,
    evidence.routes.map((route) => route.member_id),
  )
    && evidence.routes.every((route) => (
      route.source_contained === true
      && route.built_contained === true
      && route.runtime_contained === true
      && route.runtime_status === 503
      && (
        route.runtime_error_code === 'ROUTE_CONTAINED'
        || (route.method === 'HEAD' && route.runtime_error_code === null)
      )
      && route.database_calls === 0
      && route.corpus_reads === 0
      && route.code_commit === context.codeCommit
      && route.runtime_deployment_id === evidence.runtime_deployment_id
      && route.environment === context.environment
      && route.observed_at === context.observed_at
    ))
    && containmentTestPass(evidence, context);
}

function zeroBroadNodeFallback(evidence) {
  return evidence.routes.every((route) => (
    route.node_corpus_reads === 0
    && route.legacy_fallback_used === false
  ));
}

function ownerAndPurposeRecordedWithoutSecret(evidence) {
  return isNonEmptyString(evidence.process_identity_digest)
    && isNonEmptyString(evidence.owner)
    && isNonEmptyString(evidence.purpose)
    && evidence.secret_field_count === 0;
}

function recognisedOrRotationRequired(evidence) {
  return (
    evidence.recognition_status === 'RECOGNISED'
    && evidence.rotation_required === false
  ) || (
    evidence.recognition_status === 'UNRECOGNISED'
    && evidence.rotation_required === true
    && evidence.rotation_completed === true
  );
}

function compromisedCredentialsRevoked(evidence) {
  return sameClosedStringSet(evidence.compromised_credential_ids, evidence.revoked_ids);
}

function replacementActivationVerified(evidence) {
  return isTimestamp(evidence.replacement_activation_verified_at);
}

function noSecretInEvidence(evidence) {
  return evidence.secret_field_count === 0;
}

function rotationVerifiedOrRecognisedTrafficNaWithBenApproval(evidence, context) {
  if (
    evidence.disposition === 'ROTATED'
    && isTimestamp(evidence.rotation_verified_at)
    && evidence.zayo_disposition_id === null
    && evidence.ben_approval_id === null
  ) return true;
  if (evidence.disposition !== 'RECOGNISED_TRAFFIC_APPROVED_NA'
    || evidence.rotation_verified_at !== null
    || !isDigest(evidence.zayo_disposition_id)
    || !isDigest(evidence.ben_approval_id)) return false;
  const zayo = memberFor(
    context,
    `zayo:${evidence.zayo_disposition_id}`,
    'ZayoTrafficDisposition',
  );
  const approval = memberFor(
    context,
    `approval:${evidence.ben_approval_id}`,
    'SupabaseSecretNaApproval',
  );
  const {
    approval_id: approvalId,
    signature: approvalSignature,
    ...approvalIdentityPayload
  } = approval || {};
  void approvalSignature;
  if (!zayo
    || !approval
    || zayo.gate_id !== 'G0_ZAYO_DISPOSITION'
    || zayo.attestation_source_digest !== evidence.attestation_source_digest
    || zayo.recognition_status !== 'RECOGNISED'
    || zayo.rotation_required !== false
    || zayo.purpose !== 'AUTHORISED_DATABASE_TRAFFIC'
    || context.domainDigest(
      'PROGRAMME_GATE_ZAYO_DISPOSITION_ID/V1',
      zayo,
    ) !== evidence.zayo_disposition_id
    || approval.approval_id !== evidence.ben_approval_id
    || approval.supabase_attestation_source_digest !== evidence.attestation_source_digest
    || approval.zayo_process_identity_digest !== zayo.process_identity_digest
    || approval.approved_disposition !== evidence.disposition
    || approval.approver_identity !== 'BEN_GOODCHILD'
    || approval.conditions.length !== 0
    || context.domainDigest(
      'PROGRAMME_GATE_SUPABASE_SECRET_NA_APPROVAL_ID/V1',
      approvalIdentityPayload,
    ) !== approvalId) return false;
  return signatureIsValid(context, {
    record: approval,
    signatureField: 'signature',
    keyId: approval.approver_key_id,
    role: 'BEN_APPROVER',
    domain: 'PROGRAMME_GATE_SUPABASE_SECRET_NA_APPROVAL/V1',
  });
}

function distinctProjectAndCredentials(evidence) {
  return evidence.production_project_identity_digest !== evidence.staging_project_identity_digest
    && evidence.production_credential_identity_digest !== evidence.staging_credential_identity_digest;
}

function productionDmlDenied(evidence) {
  return evidence.production_dml_probe === 'DENIED';
}

function snapshotRestoreOnly(evidence) {
  return evidence.restore_mode === 'PRODUCTION_SNAPSHOT_ONLY';
}

function branchPreviewUsesStagingOnlyCredentials(evidence) {
  return isNonEmptyString(evidence.preview_deployment_id)
    && evidence.preview_credential_scope === 'STAGING_ONLY';
}

function productionAliasUnchanged(evidence) {
  return evidence.production_alias_before === evidence.production_alias_after;
}

const PREVIEW_ACTION_CLASSES = Object.freeze([
  'READ_ONLY_TEST',
  'ADMIN_PRIVILEGED',
  'WRITER',
  'INGEST',
  'CORRECTION',
  'EXPORT',
  'IMPORT',
  'PROMOTION',
  'CUTOVER',
]);

const DISABLED_PREVIEW_ACTION_CLASSES = Object.freeze([
  'WRITER',
  'INGEST',
  'CORRECTION',
  'EXPORT',
  'IMPORT',
  'PROMOTION',
  'CUTOVER',
]);

function accessDenied(status) {
  return status === 401 || status === 403 || status === 404;
}

function completePreviewRouteActionInventory(evidence) {
  const actions = evidence.preview_route_actions;
  const source = evidence.source_route_action_inventory;
  const built = evidence.built_route_action_inventory;
  const runtime = evidence.runtime_route_action_inventory;
  const identity = (entry) => `${entry.action_id}\0${entry.action_class}`;
  const closedInventory = (inventory) => (
    Array.isArray(inventory)
    && inventory.length >= PREVIEW_ACTION_CLASSES.length
    && new Set(inventory.map((entry) => entry.action_id)).size === inventory.length
    && inventory.every((entry) => PREVIEW_ACTION_CLASSES.includes(entry.action_class))
    && PREVIEW_ACTION_CLASSES.every(
      (actionClass) => inventory.some((entry) => entry.action_class === actionClass),
    )
  );
  return Array.isArray(actions)
    && new Set(actions.map((entry) => entry.action_id)).size === actions.length
    && closedInventory(source)
    && closedInventory(built)
    && closedInventory(runtime)
    && exactStringSet(source.map(identity), built.map(identity))
    && exactStringSet(source.map(identity), runtime.map(identity))
    && exactStringSet(source.map(identity), actions.map(identity))
    && evidence.source_route_action_inventory_root === contextlessDomainDigest(
      'PROGRAMME_GATE_PREVIEW_ROUTE_ACTION_INVENTORY/V1',
      source,
    )
    && evidence.built_route_action_inventory_root === contextlessDomainDigest(
      'PROGRAMME_GATE_PREVIEW_ROUTE_ACTION_INVENTORY/V1',
      built,
    )
    && evidence.runtime_route_action_inventory_root === contextlessDomainDigest(
      'PROGRAMME_GATE_PREVIEW_ROUTE_ACTION_INVENTORY/V1',
      runtime,
    );
}

function unauthenticatedAccessDeniedBeforeAndAfterRestore(evidence) {
  return completePreviewRouteActionInventory(evidence)
    && evidence.preview_route_actions.every((entry) => (
      accessDenied(entry.unauthenticated_before_restore_status)
      && accessDenied(entry.unauthenticated_after_restore_status)
    ));
}

function authenticatedNonAdminPrivilegedActionsDenied(evidence) {
  return completePreviewRouteActionInventory(evidence)
    && evidence.preview_route_actions
      .filter((entry) => entry.action_class !== 'READ_ONLY_TEST')
      .every((entry) => accessDenied(entry.authenticated_non_admin_status));
}

function privilegedPreviewActionsDisabled(evidence) {
  return completePreviewRouteActionInventory(evidence)
    && evidence.preview_route_actions
      .filter((entry) => DISABLED_PREVIEW_ACTION_CLASSES.includes(entry.action_class))
      .every((entry) => (
        entry.feature_enabled === false
        && entry.authorised_test_status === null
      ));
}

function authorisedReadOnlyTestAccessPass(evidence) {
  return completePreviewRouteActionInventory(evidence)
    && evidence.preview_route_actions
      .filter((entry) => entry.action_class === 'READ_ONLY_TEST')
      .every((entry) => (
        entry.feature_enabled === true
        && entry.authorised_test_status >= 200
        && entry.authorised_test_status < 300
      ));
}

function memberFor(context, memberId, memberType) {
  if (!context || !Array.isArray(context.immutableMembers)) return null;
  const matches = context.immutableMembers.filter((member) => (
    member.member_id === memberId && member.member_type === memberType
  ));
  return matches.length === 1 ? matches[0].payload : null;
}

function unsigned(value, signatureField) {
  if (!isRecord(value)) return null;
  const { [signatureField]: signature, ...payload } = value;
  void signature;
  return payload;
}

function signatureIsValid(context, {
  record,
  signatureField,
  keyId,
  role,
  domain,
}) {
  if (!isRecord(record)
    || typeof context?.verifySignature !== 'function'
    || !isRecord(context.keyRegistry)
    || !context.clock
    || typeof context.clock.now !== 'function') return false;
  try {
    return context.verifySignature({
      keyRegistry: context.keyRegistry,
      keyId,
      role,
      domain,
      payload: unsigned(record, signatureField),
      signature: record[signatureField],
      at: context.clock.now(),
    }) === true;
  } catch {
    return false;
  }
}

function frozenReviewContextIsValid(record, lane, context) {
  const manifest = record.controller_supplied_input_manifest;
  const runtime = record.fixed_controller_runtime_context;
  if (!hasExactKeys(manifest, [
    'manifest_version',
    'lane_id',
    'exact_specification_root',
    'frozen_specification',
    'registered_prompt',
    'output_schema',
  ])
    || !hasExactKeys(manifest.frozen_specification, [
      'manifest_id', 'manifest_digest', 'file_count', 'ordered_members', 'immutable',
    ])
    || !hasExactKeys(manifest.registered_prompt, [
      'prompt_id',
      'path',
      'payload_digest',
      'byte_length',
      'immutable',
      'contains_prior_review_conclusions',
    ])
    || !hasExactKeys(manifest.output_schema, [
      'schema_id',
      'path',
      'payload_digest',
      'byte_length',
      'source_bytes_base64',
      'immutable',
    ])
    || !hasExactKeys(runtime, [
      'context_version',
      'review_runtime_binary_path',
      'review_runtime_version',
      'review_runtime_binary_digest',
      'controller_run_root',
      'lane_run_root',
      'working_directory',
      'operating_system',
      'architecture',
      'home_path',
      'codex_home_path',
      'tmpdir_path',
      'path_value',
      'lang',
      'lc_all',
      'term',
    ])) return false;
  const isolatedPaths = [
    runtime.working_directory,
    runtime.home_path,
    runtime.codex_home_path,
    runtime.tmpdir_path,
  ];
  const provenancePaths = [
    runtime.controller_run_root,
    runtime.lane_run_root,
    ...isolatedPaths,
  ];
  const laneRootPrefix = `${lane.lane_id.toLowerCase()}-`;
  if (manifest.manifest_version !== REVIEW_CONTROLLER_POLICY.task_manifest_version
    || manifest.lane_id !== lane.lane_id
    || manifest.exact_specification_root !== context.expectedSpecificationRoot
    || manifest.frozen_specification.manifest_id
      !== REVIEW_CONTROLLER_POLICY.frozen_specification_manifest_id
    || manifest.frozen_specification.file_count
      !== REVIEW_CONTROLLER_POLICY.frozen_specification_file_count
    || !Array.isArray(manifest.frozen_specification.ordered_members)
    || manifest.frozen_specification.ordered_members.length
      !== REVIEW_CONTROLLER_POLICY.frozen_specification_file_count
    || manifest.frozen_specification.immutable !== true
    || !isDigest(manifest.frozen_specification.manifest_digest)
    || manifest.registered_prompt.prompt_id !== lane.registered_prompt_id
    || manifest.registered_prompt.payload_digest
      !== REVIEW_CONTROLLER_POLICY.prompt_digests[lane.lane_id]
    || manifest.registered_prompt.immutable !== true
    || manifest.registered_prompt.contains_prior_review_conclusions !== false
    || !isNonEmptyString(manifest.registered_prompt.path)
    || !manifest.registered_prompt.path.startsWith('/')
    || !isNonNegativeInteger(manifest.registered_prompt.byte_length)
    || manifest.registered_prompt.byte_length === 0
    || manifest.output_schema.schema_id !== REVIEW_CONTROLLER_POLICY.output_schema_id
    || manifest.output_schema.immutable !== true
    || !isDigest(manifest.output_schema.payload_digest)
    || !isNonEmptyString(manifest.output_schema.path)
    || !manifest.output_schema.path.startsWith('/')
    || !isNonNegativeInteger(manifest.output_schema.byte_length)
    || manifest.output_schema.byte_length === 0
    || runtime.context_version !== 'TrustedReviewRuntimeContext/V1'
    || runtime.review_runtime_binary_path
      !== REVIEW_CONTROLLER_POLICY.review_runtime_binary_path
    || runtime.review_runtime_version !== REVIEW_CONTROLLER_POLICY.review_runtime_version
    || runtime.review_runtime_binary_digest
      !== REVIEW_CONTROLLER_POLICY.review_runtime_binary_digest
    || runtime.operating_system !== REVIEW_CONTROLLER_POLICY.operating_system
    || runtime.architecture !== REVIEW_CONTROLLER_POLICY.architecture
    || runtime.path_value !== REVIEW_CONTROLLER_POLICY.path_value
    || runtime.lang !== REVIEW_CONTROLLER_POLICY.locale
    || runtime.lc_all !== REVIEW_CONTROLLER_POLICY.locale
    || runtime.term !== REVIEW_CONTROLLER_POLICY.terminal
    || provenancePaths.some((pathValue) => (
      !isNonEmptyString(pathValue)
      || !path.isAbsolute(pathValue)
      || path.normalize(pathValue) !== pathValue
    ))
    || new Set(provenancePaths).size !== provenancePaths.length
    || path.dirname(runtime.lane_run_root) !== runtime.controller_run_root
    || !path.basename(runtime.controller_run_root).startsWith('g0-cold-review-')
    || !path.basename(runtime.lane_run_root).startsWith(laneRootPrefix)
    || path.dirname(runtime.working_directory) !== runtime.lane_run_root
    || path.basename(runtime.working_directory) !== 'specification'
    || path.dirname(runtime.home_path) !== runtime.lane_run_root
    || path.basename(runtime.home_path) !== 'home'
    || path.dirname(runtime.codex_home_path) !== runtime.lane_run_root
    || path.basename(runtime.codex_home_path) !== 'codex-home'
    || path.dirname(runtime.tmpdir_path) !== runtime.lane_run_root
    || path.basename(runtime.tmpdir_path) !== 'tmp'
    || manifest.registered_prompt.path !== path.join(runtime.lane_run_root, 'prompt.txt')
    || manifest.output_schema.path !== path.join(runtime.lane_run_root, 'output-schema.json')) {
    return false;
  }
  let derivedSpecificationRoot;
  let outputSchemaBytes;
  try {
    derivedSpecificationRoot = specificationRootFromMembers(
      manifest.frozen_specification.ordered_members,
    );
    outputSchemaBytes = Buffer.from(manifest.output_schema.source_bytes_base64, 'base64');
  } catch {
    return false;
  }
  const [specificationManifest] = manifest.frozen_specification.ordered_members;
  if (derivedSpecificationRoot !== context.expectedSpecificationRoot
    || specificationManifest.payload_digest
      !== manifest.frozen_specification.manifest_digest
    || outputSchemaBytes.length !== manifest.output_schema.byte_length
    || outputSchemaBytes.toString('base64') !== manifest.output_schema.source_bytes_base64
    || crypto.createHash('sha256').update(outputSchemaBytes).digest('hex')
      !== manifest.output_schema.payload_digest) return false;
  const manifestDigest = context.domainDigest(
    'PROGRAMME_GATE_REVIEW_TASK_MANIFEST/V1',
    manifest,
  );
  const runtimeDigest = context.domainDigest(
    'PROGRAMME_GATE_REVIEW_RUNTIME_CONTEXT/V1',
    runtime,
  );
  const exactContextDigest = context.domainDigest(
    'PROGRAMME_GATE_REVIEW_EXACT_INPUT_CONTEXT/V1',
    {
      context_version: 'TrustedReviewExactInputContext/V1',
      task_manifest_digest: manifestDigest,
      exact_specification_root: manifest.exact_specification_root,
      frozen_specification_manifest_digest:
        manifest.frozen_specification.manifest_digest,
      registered_prompt_digest: manifest.registered_prompt.payload_digest,
      output_schema_digest: manifest.output_schema.payload_digest,
      fixed_runtime_context_digest: runtimeDigest,
    },
  );
  return record.controller_supplied_input_manifest_digest === manifestDigest
    && record.fixed_controller_runtime_context_digest === runtimeDigest
    && record.exact_input_context_digest === exactContextDigest;
}

function reviewIndependenceIsRecomputed(record, independence, context) {
  const authorshipEvents = independence.source_control_authorship_events;
  const priorConclusions = independence.prior_conclusion_input_set;
  let completeAuthorshipEvents;
  try {
    completeAuthorshipEvents = enumerateCompleteGitAuthorshipUniverse({
      repositoryRoot: process.cwd(),
      expectedCommit: context.expectedCodeCommit,
    });
  } catch {
    return false;
  }
  if (!Array.isArray(authorshipEvents)
    || authorshipEvents.length === 0
    || !Array.isArray(priorConclusions)
    || independence.source_control_history_scope
      !== 'ALL_REFS_FROM_REPOSITORY_GENESIS'
    || independence.reviewed_code_commit !== context.expectedCodeCommit
    || context.domainDigest(
      'PROGRAMME_GATE_SOURCE_CONTROL_AUTHORSHIP_EVENT_SET_ROOT/V1',
      completeAuthorshipEvents,
    ) !== independence.source_control_authorship_event_set_root) return false;
  const reviewerIdentities = new Set(record.reviewer_source_control_identity_set);
  const authoringIntersection = authorshipEvents.filter((event) => (
    isRecord(event)
    && isCommit(event.commit_id)
    && isUniqueNonEmptyStringArray(event.identity_set)
    && event.identity_set.some((identity) => reviewerIdentities.has(identity))
  ));
  if (authorshipEvents.some((event) => (
    !isRecord(event)
    || !isCommit(event.commit_id)
    || !isUniqueNonEmptyStringArray(event.identity_set)
  ))
    || new Set(authorshipEvents.map((event) => event.commit_id)).size
      !== authorshipEvents.length) return false;
  const priorIntersection = priorConclusions.filter(
    (conclusion) => reviewerIdentities.has(conclusion),
  );
  return independence.source_control_authorship_event_set_root
      === context.domainDigest(
        'PROGRAMME_GATE_SOURCE_CONTROL_AUTHORSHIP_EVENT_SET_ROOT/V1',
        authorshipEvents,
      )
    && independence.authoring_event_intersection_root
      === context.domainDigest(
        'PROGRAMME_GATE_AUTHORING_EVENT_INTERSECTION_ROOT/V1',
        authoringIntersection,
      )
    && independence.prior_conclusion_intersection_root
      === context.domainDigest(
        'PROGRAMME_GATE_PRIOR_CONCLUSION_INTERSECTION_ROOT/V1',
        priorIntersection,
      )
    && authoringIntersection.length === 0
    && priorIntersection.length === 0;
}

function reviewSetFacts(evidence, context) {
  if (!isRecord(context) || typeof context.domainDigest !== 'function') return null;
  const laneMembers = [];
  const runtimeIdentities = new Set();
  const controllerRunRoots = new Set();
  const laneRunRoots = new Set();
  const taskIds = new Set();
  const sessionIds = new Set();
  const reviewIds = new Set();
  const nonces = new Set();
  const reviewerPrincipals = new Set();
  for (const lane of REVIEW_LANES) {
    const record = memberFor(
      context,
      `controller:${lane.lane_id}`,
      'TrustedReviewControllerRecord',
    );
    const independence = memberFor(
      context,
      `independence:${lane.lane_id}`,
      'ReviewerIndependenceAttestation',
    );
    const emptyEditRoot = context.domainDigest('PROGRAMME_GATE_REVIEWER_EDIT_SET_ROOT/V1', []);
    const emptyAuthorRoot = context.domainDigest(
      'PROGRAMME_GATE_AUTHORING_EVENT_INTERSECTION_ROOT/V1',
      [],
    );
    const emptyPriorRoot = context.domainDigest(
      'PROGRAMME_GATE_PRIOR_CONCLUSION_INTERSECTION_ROOT/V1',
      [],
    );
    if (!record
      || !independence
      || record.controller_id !== REVIEW_CONTROLLER_POLICY.controller_id
      || record.controller_version !== REVIEW_CONTROLLER_POLICY.controller_version
      || record.review_runtime_version !== REVIEW_CONTROLLER_POLICY.review_runtime_version
      || record.review_runtime_binary_digest
        !== REVIEW_CONTROLLER_POLICY.review_runtime_binary_digest
      || record.registered_prompt_id !== lane.registered_prompt_id
      || record.cold_review_prompt_digest
        !== REVIEW_CONTROLLER_POLICY.prompt_digests[lane.lane_id]
      || !frozenReviewContextIsValid(record, lane, context)
      || record.exact_specification_root !== context.expectedSpecificationRoot
      || record.reviewer_disposition !== 'PASS'
      || record.parent_session_state !== 'GENESIS'
      || record.no_earlier_review_conclusions_were_inputs !== true
      || record.input_context_digest_before_review !== record.exact_input_context_digest
      || record.input_context_digest_after_review !== record.exact_input_context_digest
      || record.reviewer_edit_set_root !== emptyEditRoot
      || !signatureIsValid(context, {
        record,
        signatureField: 'controller_signature',
        keyId: record.controller_key_id,
        role: 'REVIEW_CONTROLLER',
        domain: 'PROGRAMME_GATE_REVIEW_CONTROLLER_RECORD/V1',
      })
      || independence.reviewer_principal_id !== record.reviewer_principal_id
      || independence.immutable_session_id !== record.immutable_session_id
      || independence.session_parent_or_genesis !== 'GENESIS'
      || independence.exact_input_context_digest !== record.exact_input_context_digest
      || !reviewIndependenceIsRecomputed(record, independence, context)
      || independence.authoring_event_intersection_root !== emptyAuthorRoot
      || independence.prior_conclusion_intersection_root !== emptyPriorRoot
      || independence.reviewer_edit_set_root !== emptyEditRoot
      || !signatureIsValid(context, {
        record: independence,
        signatureField: 'signature',
        keyId: independence.validator_key_id,
        role: 'VALIDATOR',
        domain: 'PROGRAMME_GATE_REVIEWER_INDEPENDENCE/V1',
      })
      || taskIds.has(record.immutable_task_id)
      || sessionIds.has(record.immutable_session_id)
      || reviewIds.has(record.immutable_review_id)
      || nonces.has(record.nonce)
      || reviewerPrincipals.has(record.reviewer_principal_id)) return null;
    taskIds.add(record.immutable_task_id);
    sessionIds.add(record.immutable_session_id);
    reviewIds.add(record.immutable_review_id);
    nonces.add(record.nonce);
    reviewerPrincipals.add(record.reviewer_principal_id);
    runtimeIdentities.add(`${record.review_runtime_version}:${record.review_runtime_binary_digest}`);
    controllerRunRoots.add(record.fixed_controller_runtime_context.controller_run_root);
    laneRunRoots.add(record.fixed_controller_runtime_context.lane_run_root);
    laneMembers.push({
      lane_id: lane.lane_id,
      controller_record: record,
      independence_attestation: independence,
    });
  }
  if (runtimeIdentities.size !== 1
    || controllerRunRoots.size !== 1
    || laneRunRoots.size !== REVIEW_LANES.length
    || Math.max(...laneMembers.map((member) => (
      Date.parse(member.controller_record.review_start_time)
    ))) >= Math.min(...laneMembers.map((member) => (
      Date.parse(member.controller_record.review_end_time)
    )))
    || laneMembers.some((member) => {
      const record = member.controller_record;
      if (member.lane_id === 'LEGAL_SEMANTIC') {
        return !(
          (
            record.exact_model_identifier === REVIEW_CONTROLLER_POLICY.exact_model_identifier
            && record.reasoning_level === REVIEW_CONTROLLER_POLICY.reasoning_level
          )
          || (
            REVIEW_CONTROLLER_POLICY.fable_model_identifiers
              .includes(record.exact_model_identifier)
            && record.reasoning_level === REVIEW_CONTROLLER_POLICY.fable_reasoning_level
          )
        );
      }
      return record.exact_model_identifier !== REVIEW_CONTROLLER_POLICY.exact_model_identifier
        || record.reasoning_level !== REVIEW_CONTROLLER_POLICY.reasoning_level;
    })) return null;
  const evidenceId = context.domainDigest('PROGRAMME_GATE_REVIEW_SET/V1', laneMembers);
  if (evidence.review_set_evidence_id !== evidenceId
    || evidence.reviewed_root !== context.expectedSpecificationRoot) return null;
  return {
    laneMembers,
    legalReviewerEligible: laneMembers.some((member) => (
      member.lane_id === 'LEGAL_SEMANTIC'
      && (
        (
          member.controller_record.exact_model_identifier
            === REVIEW_CONTROLLER_POLICY.exact_model_identifier
          && member.controller_record.reasoning_level
            === REVIEW_CONTROLLER_POLICY.reasoning_level
        )
        || (
          REVIEW_CONTROLLER_POLICY.fable_model_identifiers
            .includes(member.controller_record.exact_model_identifier)
          && member.controller_record.reasoning_level
            === REVIEW_CONTROLLER_POLICY.fable_reasoning_level
        )
      )
    )),
  };
}

function fiveNamedLanesPassSameRoot(evidence, context) {
  return reviewSetFacts(evidence, context) !== null;
}

function eligibleLegalReviewer(evidence, context) {
  return reviewSetFacts(evidence, context)?.legalReviewerEligible === true;
}

function reviewerIndependenceRecomputed(evidence, context) {
  return reviewSetFacts(evidence, context) !== null;
}

function rootUnchangedBeforeAndAfter(evidence, context) {
  return reviewSetFacts(evidence, context) !== null;
}

function benApprovalFacts(evidence, context) {
  if (!isRecord(context) || typeof context.domainDigest !== 'function') return null;
  const record = memberFor(
    context,
    `approval:${evidence.approval_evidence_id}`,
    'BenSpecificationApproval',
  );
  const reviewSet = memberFor(
    context,
    `review-set:${evidence.passing_review_set_evidence_id}`,
    'ExactDigestReviewSetAttestation',
  );
  if (!record
    || !reviewSet
    || record.approver_identity !== 'BEN_GOODCHILD'
    || record.approved_root !== context.expectedSpecificationRoot
    || record.approved_root !== evidence.approved_root
    || record.passing_review_set_evidence_id !== evidence.passing_review_set_evidence_id
    || reviewSet.review_set_evidence_id !== evidence.passing_review_set_evidence_id
    || reviewSet.reviewed_root !== evidence.approved_root
    || record.conditions.length !== 0
    || evidence.conditions.length !== 0
    || context.domainDigest('PROGRAMME_GATE_BEN_APPROVAL_ID/V1', record)
      !== evidence.approval_evidence_id
    || !signatureIsValid(context, {
      record,
      signatureField: 'signature',
      keyId: record.approver_key_id,
      role: 'BEN_APPROVER',
      domain: 'PROGRAMME_GATE_BEN_APPROVAL/V1',
    })) return null;
  return { record, reviewSet };
}

function approvedRootEqualsPassingReviewRoot(evidence, context) {
  return benApprovalFacts(evidence, context) !== null;
}

function benIdentityAndSignatureValid(evidence, context) {
  return benApprovalFacts(evidence, context) !== null;
}

function approvalUnconditional(evidence, context) {
  return benApprovalFacts(evidence, context) !== null;
}

function contractFreezeMembers(evidence, context) {
  const attestationIdentity = memberFor(
    context,
    `freeze-identity:${evidence.contract_freeze_attestation_id}`,
    'ContractFreezeAttestationIdentity',
  );
  const authorityManifest = memberFor(
    context,
    `authority:${evidence.contract_authority_manifest_id}`,
    'ContractFreezeAuthorityManifest',
  );
  const compilation = memberFor(
    context,
    `compilation:${evidence.compilation_receipt_id}`,
    'ContractBundleCompilationReceipt',
  );
  const review = memberFor(
    context,
    `review:${evidence.semantic_identity_review_id}`,
    'ContractDiffReviewAttestation',
  );
  const approval = memberFor(
    context,
    `approval:${evidence.freeze_gate_approval_id}`,
    'ContractFreezeApproval',
  );
  const status = memberFor(
    context,
    `status:${evidence.status_generation}`,
    'ProgrammeGateStatusArtefact',
  );
  return attestationIdentity && authorityManifest && compilation && review && approval && status
    ? { attestationIdentity, authorityManifest, compilation, review, approval, status }
    : null;
}

function recordIdentityPayload(record, idField, signatureField = null) {
  return Object.fromEntries(Object.entries(record).filter(([key]) => (
    key !== idField && key !== signatureField
  )));
}

function compareContractMembers(left, right) {
  return Buffer.compare(
    Buffer.from(`${left.member_type}\0${left.member_id}`, 'utf8'),
    Buffer.from(`${right.member_type}\0${right.member_id}`, 'utf8'),
  );
}

function g0EnvelopeFacts({
  context,
  envelope,
  evidenceObject,
  expectedGateId,
  expectedContract,
  expectedObjectType,
  expectedSubjectType,
  members,
}) {
  const descriptor = acceptanceDescriptorForContract(expectedContract);
  if (!envelope
    || envelope.gate_id !== expectedGateId
    || envelope.evidence_contract !== expectedContract
    || descriptor.gate_id !== expectedGateId
    || envelope.specification_root !== context.expectedSpecificationRoot
    || envelope.code_commit !== context.expectedCodeCommit
    || envelope.environment !== context.expectedEnvironment
    || envelope.evidence_subject_type !== expectedSubjectType
    || envelope.required_evidence_object_type !== expectedObjectType
    || envelope.required_evidence_object_payload_digest !== context.domainDigest(
      'PROGRAMME_GATE_EVIDENCE_OBJECT_PAYLOAD/V1',
      evidenceObject,
    )
    || envelope.immutable_member_root !== context.domainDigest(
      'PROGRAMME_GATE_IMMUTABLE_MEMBER_ROOT/V1',
      [...members].sort(compareContractMembers),
    )
    || !Array.isArray(envelope.exact_acceptance_claims)
    || envelope.exact_acceptance_claims.length !== descriptor.ordered_claim_keys.length
    || envelope.exact_acceptance_claims.some(
      (claim, index) => claim.claim_key !== descriptor.ordered_claim_keys[index],
    )
    || envelope.exact_acceptance_claims.some((claim) => (
      !isRecord(claim)
      || claim.result_type !== 'BOOLEAN'
      || claim.typed_value !== true
    ))
    || envelope.terminal_state !== 'PASS'
    || !signatureIsValid(context, {
      record: envelope,
      signatureField: 'signature',
      keyId: envelope.validator_key_id,
      role: 'VALIDATOR',
      domain: 'PROGRAMME_GATE_EVIDENCE/V2',
    })) return null;
  return {
    envelopeId: context.domainDigest('PROGRAMME_GATE_EVIDENCE_ENVELOPE/V2', envelope),
    payloadDigest: context.domainDigest(
      'PROGRAMME_GATE_EVIDENCE_PAYLOAD/V2',
      unsigned(envelope, 'signature'),
    ),
  };
}

function passingStatusRow(status, gateId, envelopeFacts) {
  if (!status || !Array.isArray(status.ordered_gate_projection)) return false;
  const rows = status.ordered_gate_projection.filter((row) => row.gate_id === gateId);
  return rows.length === 1
    && rows[0].state === 'PASS'
    && rows[0].evidence_envelope_id === envelopeFacts.envelopeId
    && rows[0].evidence_payload_digest === envelopeFacts.payloadDigest;
}

const CONTRACT_AUTHORITY_ID_FIELDS = Object.freeze({
  SEMANTIC_QUESTION_CATALOGUE_AUTHORSHIP:
    'independent_semantic_question_catalogue_authorship_id',
  SEMANTIC_QUESTION_CATALOGUE_INPUT_ACCESS:
    'independent_semantic_question_catalogue_input_access_id',
  SEMANTIC_QUESTION_CATALOGUE_REVIEW:
    'independent_semantic_question_catalogue_review_id',
  COMPOSITION_CATALOGUE_AUTHORSHIP:
    'independent_composition_catalogue_authorship_id',
  COMPOSITION_CATALOGUE_INPUT_ACCESS:
    'independent_composition_catalogue_input_access_id',
  COMPOSITION_CATALOGUE_REVIEW:
    'independent_composition_catalogue_review_id',
});

const CONTRACT_AUTHORITY_DIGEST_FIELDS = Object.freeze({
  SEMANTIC_QUESTION_CATALOGUE_RECONCILIATION:
    'semantic_question_catalogue_reconciliation_digest',
  NEUTRAL_PROJECTION: 'neutral_projection_digest',
});

const CONTRACT_AUTHORITY_ROOT_FIELDS = Object.freeze({
  RELATIONSHIP_EFFECT_FIELD_UNIVERSE: Object.freeze({
    manifestField: 'relationship_effect_field_universe_set_root',
    payloadField: 'field_universe_set_root',
  }),
  REVIEWER_ELIGIBILITY_SET: Object.freeze({
    manifestField: 'reviewer_eligibility_set_root',
    payloadField: 'eligibility_set_root',
  }),
  BEN_TAXONOMY_CODEBOOK_DECISION_SET: Object.freeze({
    manifestField: 'ben_taxonomy_codebook_decision_set_root',
    payloadField: 'decision_set_root',
  }),
});

const CONTRACT_AUTHORITY_SEMANTICS = Object.freeze({
  SEMANTIC_QUESTION_CATALOGUE_AUTHORSHIP: Object.freeze({
    actorIdentity: 'INDEPENDENT_SEMANTIC_QUESTION_CATALOGUE_AUTHOR',
    disposition: 'PASS',
    attestorRole: 'VALIDATOR',
    signatureDomain: 'PROGRAMME_GATE_EVIDENCE/V2',
  }),
  SEMANTIC_QUESTION_CATALOGUE_INPUT_ACCESS: Object.freeze({
    actorIdentity: 'INPUT_ISOLATION_VALIDATOR',
    disposition: 'PASS',
    attestorRole: 'VALIDATOR',
    signatureDomain: 'PROGRAMME_GATE_EVIDENCE/V2',
  }),
  SEMANTIC_QUESTION_CATALOGUE_REVIEW: Object.freeze({
    actorIdentity: 'INDEPENDENT_SEMANTIC_QUESTION_CATALOGUE_REVIEWER',
    disposition: 'PASS',
    attestorRole: 'REVIEW_CONTROLLER',
    signatureDomain: 'PROGRAMME_GATE_CONTRACT_DIFF_REVIEW/V1',
  }),
  COMPOSITION_CATALOGUE_AUTHORSHIP: Object.freeze({
    actorIdentity: 'INDEPENDENT_COMPOSITION_CATALOGUE_AUTHOR',
    disposition: 'PASS',
    attestorRole: 'VALIDATOR',
    signatureDomain: 'PROGRAMME_GATE_EVIDENCE/V2',
  }),
  COMPOSITION_CATALOGUE_INPUT_ACCESS: Object.freeze({
    actorIdentity: 'INPUT_ISOLATION_VALIDATOR',
    disposition: 'PASS',
    attestorRole: 'VALIDATOR',
    signatureDomain: 'PROGRAMME_GATE_EVIDENCE/V2',
  }),
  COMPOSITION_CATALOGUE_REVIEW: Object.freeze({
    actorIdentity: 'INDEPENDENT_COMPOSITION_CATALOGUE_REVIEWER',
    disposition: 'PASS',
    attestorRole: 'REVIEW_CONTROLLER',
    signatureDomain: 'PROGRAMME_GATE_CONTRACT_DIFF_REVIEW/V1',
  }),
  SEMANTIC_QUESTION_CATALOGUE_RECONCILIATION: Object.freeze({
    actorIdentity: 'CATALOGUE_RECONCILIATION_VALIDATOR',
    disposition: 'RECONCILED',
    attestorRole: 'VALIDATOR',
    signatureDomain: 'PROGRAMME_GATE_EVIDENCE/V2',
  }),
  NEUTRAL_PROJECTION: Object.freeze({
    actorIdentity: 'NEUTRAL_PROJECTION_COMPILER',
    disposition: 'PASS',
    attestorRole: 'VALIDATOR',
    signatureDomain: 'PROGRAMME_GATE_EVIDENCE/V2',
  }),
  PRE_FREEZE_SEMANTIC_STAGE_OUTPUT_SET: Object.freeze({
    actorIdentity: 'SEMANTIC_STAGE_EXECUTOR',
    disposition: 'PASS',
    attestorRole: 'VALIDATOR',
    signatureDomain: 'PROGRAMME_GATE_EVIDENCE/V2',
  }),
  PRE_FREEZE_NEUTRAL_PROJECTION_SET: Object.freeze({
    actorIdentity: 'NEUTRAL_PROJECTION_COMPILER',
    disposition: 'PASS',
    attestorRole: 'VALIDATOR',
    signatureDomain: 'PROGRAMME_GATE_EVIDENCE/V2',
  }),
  RELATIONSHIP_EFFECT_FIELD_UNIVERSE: Object.freeze({
    actorIdentity: 'RELATIONSHIP_EFFECT_FIELD_UNIVERSE_COMPILER',
    disposition: 'PASS',
    attestorRole: 'VALIDATOR',
    signatureDomain: 'PROGRAMME_GATE_EVIDENCE/V2',
  }),
  REVIEWER_ELIGIBILITY_SET: Object.freeze({
    actorIdentity: 'REVIEW_ELIGIBILITY_VALIDATOR',
    disposition: 'PASS',
    attestorRole: 'VALIDATOR',
    signatureDomain: 'PROGRAMME_GATE_EVIDENCE/V2',
  }),
  BEN_TAXONOMY_CODEBOOK_DECISION_SET: Object.freeze({
    actorIdentity: 'BEN_GOODCHILD',
    disposition: 'APPROVED',
    attestorRole: 'BEN_APPROVER',
    signatureDomain: 'PROGRAMME_GATE_CONTRACT_FREEZE_APPROVAL/V1',
  }),
});

function exactStringSet(left, right) {
  return Array.isArray(left)
    && Array.isArray(right)
    && new Set(left).size === left.length
    && new Set(right).size === right.length
    && left.length === right.length
    && left.every((value) => right.includes(value));
}

const REQUIRED_CANONICAL_CONTRACT_MEMBER_KINDS = Object.freeze([
  'COMPARABILITY',
  'COMPOSITION_CATALOGUE',
  'CORE_CANONICAL_CONTRACT',
  'GOVERNED_RESIDUAL',
  'OPEN_WORLD_CONCEPT',
  'RELATIONSHIP_EFFECT_FIELD_UNIVERSE',
  'SEMANTIC_CATALOGUE',
  'SOURCE_SPECIFIC_PUBLICATION',
]);

function closedOrderedMembers(members) {
  return Array.isArray(members)
    && members.length > 0
    && new Set(members.map((member) => member.member_key)).size === members.length
    && members.every((member, index) => (
      isNonEmptyString(member.member_key)
      && isDigest(member.semantic_digest)
      && isDigest(member.identity_digest)
      && (index === 0 || members[index - 1].member_key.localeCompare(member.member_key) < 0)
    ));
}

function recomputedContractMemberRoot(context, domain, members) {
  return closedOrderedMembers(members) ? context.domainDigest(domain, members) : null;
}

function catalogueMembersAreValid(context, payload) {
  if (!Array.isArray(payload.catalogue_members)
    || payload.catalogue_members.length === 0
    || new Set(payload.catalogue_members.map((member) => member.member_key)).size
      !== payload.catalogue_members.length) return false;
  for (const [index, member] of payload.catalogue_members.entries()) {
    const bytes = Buffer.from(member.source_bytes_base64, 'base64');
    if (!isNonEmptyString(member.member_key)
      || !isDigest(member.payload_digest)
      || crypto.createHash('sha256').update(bytes).digest('hex') !== member.payload_digest
      || (index > 0 && payload.catalogue_members[index - 1].member_key
        .localeCompare(member.member_key) >= 0)) return false;
  }
  return payload.catalogue_root === context.domainDigest(
    `PROGRAMME_GATE_${payload.catalogue_kind}_CATALOGUE_ROOT/V1`,
    payload.catalogue_members.map(({ member_key, payload_digest }) => ({
      member_key,
      payload_digest,
    })),
  );
}

function catalogueAccessIsValid(context, payload) {
  if (!Array.isArray(payload.permitted_input_members)
    || !Array.isArray(payload.observed_input_members)
    || payload.permitted_input_members.length !== payload.observed_input_members.length
    || payload.prohibited_access_attempt_ids.length !== 0
    || payload.ordinary_contract_mount_present
    || payload.generated_output_mount_present
    || payload.prior_review_mount_present) return false;
  const permitted = [];
  for (const member of payload.permitted_input_members) {
    const bytes = Buffer.from(member.source_bytes_base64, 'base64');
    if (bytes.length !== member.byte_length
      || crypto.createHash('sha256').update(bytes).digest('hex') !== member.payload_digest) {
      return false;
    }
    permitted.push({
      input_key: member.input_key,
      input_class: member.input_class,
      byte_length: member.byte_length,
      payload_digest: member.payload_digest,
    });
  }
  return JSON.stringify(permitted) === JSON.stringify(payload.observed_input_members)
    && payload.observed_input_set_root === context.domainDigest(
      'PROGRAMME_GATE_CATALOGUE_BLIND_INPUT_SET_ROOT/V1',
      permitted,
    );
}

function authorityRecordIsValid(context, member) {
  const record = member.payload;
  const semantics = CONTRACT_AUTHORITY_SEMANTICS[record?.authority_kind];
  try {
    validateSchema('ContractFreezeAuthorityEvidence/V1', record);
  } catch {
    return false;
  }
  return Boolean(semantics)
    && member.member_id === `authority-evidence:${record.authority_evidence_id}`
    && record.actor_identity === semantics.actorIdentity
    && record.disposition === semantics.disposition
    && record.attestor_role === semantics.attestorRole
    && record.authority_payload_digest === context.domainDigest(
      'PROGRAMME_GATE_CONTRACT_AUTHORITY_PAYLOAD/V1',
      record.authority_payload,
    )
    && record.authority_evidence_id === context.domainDigest(
      'PROGRAMME_GATE_CONTRACT_AUTHORITY_EVIDENCE_ID/V1',
      recordIdentityPayload(record, 'authority_evidence_id', 'signature'),
    )
    && record.conditions.length === 0
    && signatureIsValid(context, {
      record,
      signatureField: 'signature',
      keyId: record.attestor_key_id,
      role: semantics.attestorRole,
      domain: semantics.signatureDomain,
    });
}

function oneAuthority(authorities, kind) {
  const matches = authorities.filter((member) => member.payload.authority_kind === kind);
  return matches.length === 1 ? matches[0].payload : null;
}

function catalogueAuthorityChainIsValid(context, authorities, prefix) {
  const authorship = oneAuthority(authorities, `${prefix}_CATALOGUE_AUTHORSHIP`);
  const access = oneAuthority(authorities, `${prefix}_CATALOGUE_INPUT_ACCESS`);
  const review = oneAuthority(authorities, `${prefix}_CATALOGUE_REVIEW`);
  return Boolean(authorship && access && review)
    && authorship.authority_payload.disposition_id === authorship.authority_subject_id
    && access.authority_payload.disposition_id === access.authority_subject_id
    && review.authority_payload.disposition_id === review.authority_subject_id
    && authorship.authority_payload.catalogue_root
      === access.authority_payload.catalogue_root
    && authorship.authority_payload.catalogue_root
      === review.authority_payload.catalogue_root
    && catalogueMembersAreValid(context, authorship.authority_payload)
    && authorship.authority_payload.author_principal_id
      === access.authority_payload.author_principal_id
    && authorship.authority_payload.authoring_session_id
      === access.authority_payload.authoring_session_id
    && authorship.authority_payload.authoring_executable_digest
      === access.authority_payload.authoring_executable_digest
    && catalogueAccessIsValid(context, access.authority_payload)
    && authorship.authority_payload.input_isolation_disposition_id
      === access.authority_subject_id
    && review.authority_payload.authorship_disposition_id
      === authorship.authority_subject_id
    && review.authority_payload.input_access_disposition_id
      === access.authority_subject_id
    && authorship.authority_payload.author_principal_id
      !== review.authority_payload.reviewer_principal_id
    && review.authority_payload.authoring_event_intersection_ids.length === 0
    && review.authority_payload.prior_conclusion_input_ids.length === 0
    && exactStringSet(authorship.related_authority_ids, [])
    && exactStringSet(access.related_authority_ids, [authorship.authority_evidence_id])
    && exactStringSet(review.related_authority_ids, [
      authorship.authority_evidence_id,
      access.authority_evidence_id,
    ]);
}

function contractAuthorityTopologyIsValid(context, authorities) {
  if (!catalogueAuthorityChainIsValid(context, authorities, 'SEMANTIC_QUESTION')
    || !catalogueAuthorityChainIsValid(context, authorities, 'COMPOSITION')) return false;
  const semanticReview = oneAuthority(authorities, 'SEMANTIC_QUESTION_CATALOGUE_REVIEW');
  const compositionReview = oneAuthority(authorities, 'COMPOSITION_CATALOGUE_REVIEW');
  const reconciliation = oneAuthority(
    authorities,
    'SEMANTIC_QUESTION_CATALOGUE_RECONCILIATION',
  );
  const neutral = oneAuthority(authorities, 'NEUTRAL_PROJECTION');
  const stages = authorities
    .filter((member) => (
      member.payload.authority_kind === 'PRE_FREEZE_SEMANTIC_STAGE_OUTPUT_SET'
    ))
    .map((member) => member.payload);
  const semanticStage = stages.find(
    (authority) => authority.authority_payload.catalogue_kind === 'SEMANTIC_QUESTION',
  );
  const compositionStage = stages.find(
    (authority) => authority.authority_payload.catalogue_kind === 'COMPOSITION',
  );
  const projected = oneAuthority(authorities, 'PRE_FREEZE_NEUTRAL_PROJECTION_SET');
  const fieldUniverse = oneAuthority(authorities, 'RELATIONSHIP_EFFECT_FIELD_UNIVERSE');
  const reviewerEligibility = oneAuthority(authorities, 'REVIEWER_ELIGIBILITY_SET');
  const benDecisions = oneAuthority(authorities, 'BEN_TAXONOMY_CODEBOOK_DECISION_SET');
  return Boolean(
    reconciliation && neutral && stages.length === 2
      && semanticStage && compositionStage && projected
      && fieldUniverse && reviewerEligibility && benDecisions,
  )
    && semanticStage.authority_payload.catalogue_root
      === semanticReview.authority_payload.catalogue_root
    && semanticStage.authority_payload.catalogue_review_disposition_id
      === semanticReview.authority_subject_id
    && semanticStage.authority_payload.failed_member_ids.length === 0
    && exactStringSet(semanticStage.related_authority_ids, [
      semanticReview.authority_evidence_id,
    ])
    && compositionStage.authority_payload.catalogue_root
      === compositionReview.authority_payload.catalogue_root
    && compositionStage.authority_payload.catalogue_review_disposition_id
      === compositionReview.authority_subject_id
    && compositionStage.authority_payload.failed_member_ids.length === 0
    && exactStringSet(compositionStage.related_authority_ids, [
      compositionReview.authority_evidence_id,
    ])
    && reconciliation.authority_payload.semantic_review_disposition_id
      === semanticReview.authority_subject_id
    && reconciliation.authority_payload.composition_review_disposition_id
      === compositionReview.authority_subject_id
    && reconciliation.authority_payload.semantic_question_stage_output_set_root
      === semanticStage.authority_payload.output_set_root
    && reconciliation.authority_payload.composition_stage_output_set_root
      === compositionStage.authority_payload.output_set_root
    && exactStringSet(reconciliation.related_authority_ids, [
      semanticStage.authority_evidence_id,
      compositionStage.authority_evidence_id,
    ])
    && neutral.authority_payload.source_reconciliation_digest
      === reconciliation.authority_payload_digest
    && exactStringSet(neutral.related_authority_ids, [
      reconciliation.authority_evidence_id,
    ])
    && projected.authority_payload.neutral_projection_digest
      === neutral.authority_payload_digest
    && exactStringSet(projected.related_authority_ids, [neutral.authority_evidence_id])
    && recomputedContractMemberRoot(
      context,
      'PROGRAMME_GATE_SEMANTIC_STAGE_OUTPUT_SET_ROOT/V1',
      semanticStage.authority_payload.output_members,
    ) === semanticStage.authority_payload.output_set_root
    && semanticStage.authority_payload.output_member_count
      === semanticStage.authority_payload.output_members.length
    && recomputedContractMemberRoot(
      context,
      'PROGRAMME_GATE_SEMANTIC_STAGE_OUTPUT_SET_ROOT/V1',
      compositionStage.authority_payload.output_members,
    ) === compositionStage.authority_payload.output_set_root
    && compositionStage.authority_payload.output_member_count
      === compositionStage.authority_payload.output_members.length
    && recomputedContractMemberRoot(
      context,
      'PROGRAMME_GATE_NEUTRAL_PROJECTION_SET_ROOT/V1',
      projected.authority_payload.projection_members,
    ) === projected.authority_payload.neutral_projection_set_root
    && projected.authority_payload.projection_member_count
      === projected.authority_payload.projection_members.length
    && recomputedContractMemberRoot(
      context,
      'PROGRAMME_GATE_RELATIONSHIP_EFFECT_FIELD_UNIVERSE_SET_ROOT/V1',
      fieldUniverse.authority_payload.field_universe_members,
    ) === fieldUniverse.authority_payload.field_universe_set_root
    && recomputedContractMemberRoot(
      context,
      'PROGRAMME_GATE_RELATIONSHIP_DEFINITION_SET_ROOT/V1',
      fieldUniverse.authority_payload.relationship_definition_members,
    ) === fieldUniverse.authority_payload.relationship_definition_set_root
    && recomputedContractMemberRoot(
      context,
      'PROGRAMME_GATE_EFFECT_SCHEMA_SET_ROOT/V1',
      fieldUniverse.authority_payload.effect_schema_members,
    ) === fieldUniverse.authority_payload.effect_schema_set_root
    && [semanticReview, compositionReview].every((review) => (
      review.authority_payload.reviewer_eligibility_set_root
        === reviewerEligibility.authority_payload.eligibility_set_root
      && reviewerEligibility.authority_payload.eligible_reviewers.some((eligible) => (
        eligible.reviewer_principal_id === review.authority_payload.reviewer_principal_id
        && eligible.reviewer_identity === review.authority_payload.reviewer_identity
        && eligible.reviewer_model_identifier
          === review.authority_payload.reviewer_model_identifier
        && eligible.reasoning_level === review.authority_payload.reasoning_level
      ))
    ))
    && exactStringSet(fieldUniverse.related_authority_ids, [])
    && exactStringSet(reviewerEligibility.related_authority_ids, [])
    && benDecisions.authority_payload.approver_identity === 'BEN_GOODCHILD'
    && exactStringSet(benDecisions.related_authority_ids, []);
}

function contractBundleMembersAreClosed(members) {
  return Array.isArray(members)
    && members.length > 0
    && members.every((member) => hasExactKeys(
      member,
      ['member_key', 'semantic_digest', 'identity_digest'],
    ) && isNonEmptyString(member.member_key)
      && isDigest(member.semantic_digest)
      && isDigest(member.identity_digest))
    && new Set(members.map((member) => member.member_key)).size === members.length
    && members.every((member, index) => (
      index === 0 || members[index - 1].member_key.localeCompare(member.member_key) < 0
    ));
}

function deriveContractSemanticIdentityDiff(predecessorMembers, successorMembers) {
  if (!contractBundleMembersAreClosed(predecessorMembers)
    || !contractBundleMembersAreClosed(successorMembers)) return null;
  const predecessor = new Map(predecessorMembers.map((member) => [member.member_key, member]));
  const successor = new Map(successorMembers.map((member) => [member.member_key, member]));
  const predecessorKeys = [...predecessor.keys()];
  const successorKeys = [...successor.keys()];
  const sharedKeys = predecessorKeys.filter((key) => successor.has(key));
  return {
    added_member_keys: successorKeys.filter((key) => !predecessor.has(key)),
    removed_member_keys: predecessorKeys.filter((key) => !successor.has(key)),
    semantic_changed_member_keys: sharedKeys.filter(
      (key) => predecessor.get(key).semantic_digest !== successor.get(key).semantic_digest,
    ),
    identity_changed_member_keys: sharedKeys.filter(
      (key) => predecessor.get(key).identity_digest !== successor.get(key).identity_digest,
    ),
  };
}

function contractFreezeAuthorityIsComplete(evidence, context, manifest) {
  const inventory = evidence.authority_member_inventory;
  if (!Array.isArray(inventory)
    || inventory.length === 0
    || new Set(inventory.map((entry) => `${entry.member_type}\0${entry.member_id}`)).size
      !== inventory.length) return false;
  const governing = context.immutableMembers.filter(
    (member) => member.member_type === 'ContractFreezeGoverningSpecificationMember',
  );
  if (governing.length !== manifest.governing_specification_members.length) return false;
  const attestationIdentities = context.immutableMembers.filter(
    (member) => member.member_type === 'ContractFreezeAttestationIdentity',
  );
  const bundleMembers = context.immutableMembers.filter(
    (member) => member.member_type === 'CanonicalContractBundleMember',
  );
  if (attestationIdentities.length !== 1
    || attestationIdentities[0].payload.contract_freeze_attestation_id
      !== evidence.contract_freeze_attestation_id
    || bundleMembers.length !== manifest.canonical_contract_bundle_member_count
    || bundleMembers.some((member) => !inventory.some((entry) => (
      entry.member_id === `bundle-member:${member.payload.member_key}`
      && entry.member_type === 'CanonicalContractBundleMember'
    )))) return false;
  for (const declared of manifest.governing_specification_members) {
    const member = governing.find((candidate) => candidate.payload.path === declared.path);
    if (!member) return false;
    const bytes = Buffer.from(member.payload.source_bytes_base64, 'base64');
    if (bytes.length !== declared.byte_length
      || member.payload.byte_length !== declared.byte_length
      || member.payload.payload_digest !== declared.payload_digest
      || context.domainDigest(
        'PROGRAMME_GATE_GOVERNING_SPECIFICATION_MEMBER_ID/V1',
        recordIdentityPayload(member.payload, 'specification_member_id'),
      ) !== member.payload.specification_member_id
      || crypto.createHash('sha256').update(bytes).digest('hex')
        !== declared.payload_digest) return false;
  }
  const rootManifest = manifest.governing_specification_members.find(
    (member) => member.path === 'docs/codex-program/specification-manifest.json',
  );
  if (!rootManifest || rootManifest.payload_digest !== manifest.root_manifest_digest) {
    return false;
  }
  const g0Review = memberFor(
    context,
    `review-set:${manifest.g0_review_set_evidence_id}`,
    'ExactDigestReviewSetAttestation',
  );
  const g0Approval = memberFor(
    context,
    `g0-approval:${manifest.g0_ben_approval_evidence_id}`,
    'BenSpecificationApprovalEvidence',
  );
  const g0ReviewEnvelope = memberFor(
    context,
    'g0-envelope:G0_EXACT_DIGEST_REVIEW_SET',
    'ProgrammeGateEvidenceEnvelope',
  );
  const g0ApprovalEnvelope = memberFor(
    context,
    'g0-envelope:G0_BEN_SPEC_APPROVAL',
    'ProgrammeGateEvidenceEnvelope',
  );
  const status = memberFor(
    context,
    `status:${evidence.status_generation}`,
    'ProgrammeGateStatusArtefact',
  );
  if (!g0Review
    || g0Review.review_set_evidence_id !== manifest.g0_review_set_evidence_id
    || g0Review.reviewed_root !== manifest.specification_root
    || !g0Approval
    || g0Approval.approval_evidence_id !== manifest.g0_ben_approval_evidence_id
    || g0Approval.approved_root !== manifest.specification_root
    || g0Approval.passing_review_set_evidence_id !== g0Review.review_set_evidence_id
    || g0Approval.conditions.length !== 0) return false;

  const reviewFacts = reviewSetFacts(g0Review, context);
  const benFacts = benApprovalFacts(g0Approval, context);
  if (!reviewFacts || !benFacts) return false;
  const reviewMembers = reviewFacts.laneMembers.flatMap((member) => [
    {
      member_id: `controller:${member.lane_id}`,
      member_type: 'TrustedReviewControllerRecord',
      payload: member.controller_record,
    },
    {
      member_id: `independence:${member.lane_id}`,
      member_type: 'ReviewerIndependenceAttestation',
      payload: member.independence_attestation,
    },
  ]);
  const approvalMembers = [
    {
      member_id: `approval:${g0Approval.approval_evidence_id}`,
      member_type: 'BenSpecificationApproval',
      payload: benFacts.record,
    },
    {
      member_id: `review-set:${g0Review.review_set_evidence_id}`,
      member_type: 'ExactDigestReviewSetAttestation',
      payload: g0Review,
    },
  ];
  const reviewEnvelopeFacts = g0EnvelopeFacts({
    context,
    envelope: g0ReviewEnvelope,
    evidenceObject: g0Review,
    expectedGateId: 'G0_EXACT_DIGEST_REVIEW_SET',
    expectedContract:
      'five-lane-provider-attested-exact-specification-root-review-set/v3',
    expectedObjectType: 'ExactDigestReviewSetAttestation',
    expectedSubjectType: 'ExactDigestReviewSetSubject',
    members: reviewMembers,
  });
  const approvalEnvelopeFacts = g0EnvelopeFacts({
    context,
    envelope: g0ApprovalEnvelope,
    evidenceObject: g0Approval,
    expectedGateId: 'G0_BEN_SPEC_APPROVAL',
    expectedContract: 'ben-approved-reviewed-specification-root/v3',
    expectedObjectType: 'BenSpecificationApproval',
    expectedSubjectType: 'BenSpecificationApprovalSubject',
    members: approvalMembers,
  });
  if (!reviewEnvelopeFacts
    || !approvalEnvelopeFacts
    || manifest.g0_review_set_payload_digest !== reviewEnvelopeFacts.payloadDigest
    || manifest.g0_ben_approval_payload_digest !== approvalEnvelopeFacts.payloadDigest
    || !passingStatusRow(
      status,
      'G0_EXACT_DIGEST_REVIEW_SET',
      reviewEnvelopeFacts,
    )
    || !passingStatusRow(
      status,
      'G0_BEN_SPEC_APPROVAL',
      approvalEnvelopeFacts,
    )) return false;

  const authorities = context.immutableMembers
    .filter((member) => member.member_type === 'ContractFreezeAuthorityEvidence');
  if (authorities.some((member) => !authorityRecordIsValid(context, member))
    || !contractAuthorityTopologyIsValid(context, authorities)) return false;
  for (const [kind, field] of Object.entries(CONTRACT_AUTHORITY_ID_FIELDS)) {
    const matches = authorities.filter((member) => member.payload.authority_kind === kind);
    if (matches.length !== 1
      || matches[0].payload.authority_subject_id !== manifest[field]) return false;
  }
  for (const [kind, field] of Object.entries(CONTRACT_AUTHORITY_DIGEST_FIELDS)) {
    const matches = authorities.filter((member) => member.payload.authority_kind === kind);
    if (matches.length !== 1
      || matches[0].payload.authority_subject_id !== manifest.contract_bundle_id
      || matches[0].payload.authority_payload_digest !== manifest[field]) return false;
  }
  for (const [kind, binding] of Object.entries(CONTRACT_AUTHORITY_ROOT_FIELDS)) {
    const matches = authorities.filter((member) => member.payload.authority_kind === kind);
    if (matches.length !== 1
      || matches[0].payload.authority_subject_id !== manifest.contract_bundle_id
      || matches[0].payload.authority_payload[binding.payloadField]
        !== manifest[binding.manifestField]) return false;
  }
  for (const [kind, roots] of [
    ['PRE_FREEZE_SEMANTIC_STAGE_OUTPUT_SET', manifest.pre_freeze_semantic_stage_output_set_roots],
    ['PRE_FREEZE_NEUTRAL_PROJECTION_SET', manifest.pre_freeze_neutral_projection_set_roots],
  ]) {
    const matches = authorities.filter((member) => member.payload.authority_kind === kind);
    if (matches.length !== roots.length
      || !roots.every((root) => (
        matches.some((member) => (
          member.payload.authority_payload[
            kind === 'PRE_FREEZE_SEMANTIC_STAGE_OUTPUT_SET'
              ? 'output_set_root'
              : 'neutral_projection_set_root'
          ] === root
        ))
      ))
      || matches.some(
        (member) => member.payload.authority_subject_id !== manifest.contract_bundle_id,
      )) return false;
  }
  const reviewerEligibility = authorities.find(
    (member) => member.payload.authority_kind === 'REVIEWER_ELIGIBILITY_SET',
  );
  const eligibleReviewers = reviewerEligibility.payload.authority_payload.eligible_reviewers;
  const eligibleIdentities = eligibleReviewers.map((reviewer) => reviewer.reviewer_identity);
  const eligiblePrincipals = eligibleReviewers.map((reviewer) => reviewer.reviewer_principal_id);
  if (!Array.isArray(eligibleIdentities)
    || new Set(eligibleIdentities).size !== eligibleIdentities.length
    || new Set(eligiblePrincipals).size !== eligiblePrincipals.length
    || !manifest.independent_reviewer_bindings.every(
      (binding) => eligibleReviewers.some((eligible) => (
        eligible.reviewer_principal_id === binding.reviewer_principal_id
        && eligible.reviewer_identity === binding.reviewer_identity
      )),
    )) return false;
  const catalogueReviews = [
    oneAuthority(authorities, 'SEMANTIC_QUESTION_CATALOGUE_REVIEW'),
    oneAuthority(authorities, 'COMPOSITION_CATALOGUE_REVIEW'),
  ];
  if (catalogueReviews.some((review) => !review)
    || !catalogueReviews.every((review) => (
      manifest.independent_reviewer_bindings.some((binding) => (
        binding.reviewer_principal_id
          === review.authority_payload.reviewer_principal_id
        && binding.reviewer_identity === review.authority_payload.reviewer_identity
        && binding.eligibility_evidence_digest
          === review.authority_payload.reviewer_eligibility_set_root
        && binding.review_disposition_id === review.authority_subject_id
      ))
    ))) return false;
  const contractReview = memberFor(
    context,
    `review:${evidence.semantic_identity_review_id}`,
    'ContractDiffReviewAttestation',
  );
  const contractReviewIndependence = contractReview && memberFor(
    context,
    `review-independence:${contractReview.independence_attestation_id}`,
    'ReviewerIndependenceAttestation',
  );
  if (!contractReviewIndependence
    || !inventory.some((entry) => (
      entry.member_id === `review-independence:${contractReview.independence_attestation_id}`
      && entry.member_type === 'ReviewerIndependenceAttestation'
    ))) return false;
  if (manifest.independent_reviewer_bindings.length !== 3
    || !manifest.independent_reviewer_bindings.some((binding) => (
      binding.reviewer_principal_id === contractReview.reviewer_principal_id
      && binding.reviewer_identity === contractReview.reviewer_identity
      && binding.eligibility_evidence_digest === contractReview.reviewer_eligibility_digest
      && binding.review_disposition_id === contractReview.review_id
    ))) return false;
  const expectedAuthorityCount = Object.keys(CONTRACT_AUTHORITY_ID_FIELDS).length
    + Object.keys(CONTRACT_AUTHORITY_DIGEST_FIELDS).length
    + Object.keys(CONTRACT_AUTHORITY_ROOT_FIELDS).length
    + manifest.pre_freeze_semantic_stage_output_set_roots.length
    + manifest.pre_freeze_neutral_projection_set_roots.length;
  return authorities.length === expectedAuthorityCount
    && inventory.length === governing.length
      + authorities.length
      + bundleMembers.length
      + (REVIEW_LANES.length * 2)
      + 6;
}

function contractAuthorityManifestMatches(evidence, context, manifest) {
  return manifest.authority_manifest_id === evidence.contract_authority_manifest_id
    && manifest.specification_root === evidence.specification_root
    && manifest.contract_bundle_id === evidence.contract_bundle_id
    && manifest.contract_bundle_digest === evidence.contract_bundle_digest
    && manifest.frozen_contract_pair_digest === evidence.frozen_contract_pair_digest
    && context.domainDigest(
      'PROGRAMME_GATE_CONTRACT_FREEZE_AUTHORITY_MANIFEST_ID/V1',
      recordIdentityPayload(manifest, 'authority_manifest_id'),
    ) === manifest.authority_manifest_id
    && context.domainDigest(
      'PROGRAMME_GATE_CONTRACT_FREEZE_AUTHORITY_MANIFEST_PAYLOAD/V1',
      manifest,
    ) === evidence.contract_authority_manifest_digest
    && contractFreezeAuthorityIsComplete(evidence, context, manifest);
}

function canonicalContractBundleFacts(context) {
  const records = context.immutableMembers
    .filter((member) => member.member_type === 'CanonicalContractBundleMember')
    .map((member) => member.payload)
    .sort((left, right) => left.member_key.localeCompare(right.member_key));
  if (records.length < REQUIRED_CANONICAL_CONTRACT_MEMBER_KINDS.length
    || new Set(records.map((record) => record.member_key)).size !== records.length) return null;
  for (const record of records) {
    try {
      validateSchema('CanonicalContractBundleMember/V1', record);
    } catch {
      return null;
    }
    const bytes = Buffer.from(record.source_bytes_base64, 'base64');
    if (bytes.length !== record.byte_length
      || crypto.createHash('sha256').update(bytes).digest('hex') !== record.payload_digest) {
      return null;
    }
  }
  const kinds = [...new Set(records.map((record) => record.member_kind))].sort();
  if (!exactStringSet(kinds, REQUIRED_CANONICAL_CONTRACT_MEMBER_KINDS)) return null;
  const projection = records.map((record) => ({
    member_key: record.member_key,
    semantic_digest: record.semantic_digest,
    identity_digest: record.identity_digest,
  }));
  return {
    records,
    projection,
    memberRoot: context.domainDigest(
      'PROGRAMME_GATE_CANONICAL_CONTRACT_BUNDLE_MEMBER_ROOT/V1',
      records,
    ),
    requiredKindSetRoot: context.domainDigest(
      'PROGRAMME_GATE_CANONICAL_CONTRACT_BUNDLE_REQUIRED_KIND_SET_ROOT/V1',
      kinds,
    ),
  };
}

function bundleCompiles(evidence, context) {
  const members = contractFreezeMembers(evidence, context);
  const bundle = canonicalContractBundleFacts(context);
  return Boolean(members)
    && Boolean(bundle)
    && contractFreezeAttestationIdentityIsValid(
      evidence,
      context,
      members.attestationIdentity,
    )
    && evidence.specification_root === context.expectedSpecificationRoot
    && contractAuthorityManifestMatches(evidence, context, members.authorityManifest)
    && members.compilation.receipt_id === evidence.compilation_receipt_id
    && members.compilation.contract_bundle_id === evidence.contract_bundle_id
    && members.compilation.contract_bundle_digest === evidence.contract_bundle_digest
    && members.compilation.frozen_contract_pair_digest === evidence.frozen_contract_pair_digest
    && members.compilation.canonical_contract_bundle_member_root === bundle.memberRoot
    && members.compilation.canonical_contract_bundle_member_count === bundle.records.length
    && members.compilation.canonical_contract_bundle_required_kind_set_root
      === bundle.requiredKindSetRoot
    && members.authorityManifest.canonical_contract_bundle_member_root === bundle.memberRoot
    && members.authorityManifest.canonical_contract_bundle_member_count
      === bundle.records.length
    && members.authorityManifest.canonical_contract_bundle_required_kind_set_root
      === bundle.requiredKindSetRoot
    && JSON.stringify(members.review.contract_bundle_members)
      === JSON.stringify(bundle.projection)
    && members.compilation.compiler_version === members.authorityManifest.compiler_version
    && members.compilation.generator_version === members.authorityManifest.generator_version
    && members.compilation.compile_report_digest
      === members.authorityManifest.compile_report_digest
    && members.compilation.cycle_report_digest
      === members.authorityManifest.cycle_report_digest
    && members.compilation.drift_report_digest
      === members.authorityManifest.drift_report_digest
    && context.domainDigest(
      'PROGRAMME_GATE_CONTRACT_GENERATED_OUTPUT_SET/V1',
      members.compilation.generated_outputs,
    ) === context.domainDigest(
      'PROGRAMME_GATE_CONTRACT_GENERATED_OUTPUT_SET/V1',
      members.authorityManifest.generated_outputs,
    )
    && members.compilation.compile_errors.length === 0
    && members.compilation.cycle_errors.length === 0
    && members.compilation.drift_errors.length === 0
    && members.compilation.terminal_state === 'PASS'
    && context.domainDigest(
      'PROGRAMME_GATE_CONTRACT_COMPILATION_RECEIPT_ID/V1',
      recordIdentityPayload(members.compilation, 'receipt_id', 'signature'),
    ) === members.compilation.receipt_id
    && signatureIsValid(context, {
      record: members.compilation,
      signatureField: 'signature',
      keyId: members.compilation.validator_key_id,
      role: 'VALIDATOR',
      domain: 'PROGRAMME_GATE_CONTRACT_COMPILATION_RECEIPT/V1',
    });
}

function contractDiffReviewIsMechanicallyBound(review, evidence, context) {
  try {
    validateSchema('ContractDiffReviewAttestation/V1', review);
  } catch {
    return false;
  }
  const derived = deriveContractSemanticIdentityDiff(
    review.predecessor_contract_members,
    review.contract_bundle_members,
  );
  if (!derived) return false;
  const expectedDiff = {
    predecessor_contract_bundle_id: review.predecessor_contract_bundle_id,
    successor_contract_bundle_id: review.contract_bundle_id,
    ...derived,
  };
  const predecessorDigest = context.domainDigest(
    'PROGRAMME_GATE_CONTRACT_BUNDLE_SNAPSHOT/V1',
    review.predecessor_contract_members,
  );
  const successorDigest = context.domainDigest(
    'PROGRAMME_GATE_CONTRACT_BUNDLE_SNAPSHOT/V1',
    review.contract_bundle_members,
  );
  const predecessorId = context.domainDigest(
    'PROGRAMME_GATE_CONTRACT_BUNDLE_ID/V1',
    { contract_bundle_digest: predecessorDigest },
  );
  const successorId = context.domainDigest(
    'PROGRAMME_GATE_CONTRACT_BUNDLE_ID/V1',
    { contract_bundle_digest: successorDigest },
  );
  const pairDigest = context.domainDigest(
    'PROGRAMME_GATE_FROZEN_CONTRACT_PAIR/V1',
    {
      predecessor_contract_bundle_id: predecessorId,
      predecessor_contract_bundle_digest: predecessorDigest,
      successor_contract_bundle_id: successorId,
      successor_contract_bundle_digest: successorDigest,
      contract_freeze_attestation_id: evidence.contract_freeze_attestation_id,
    },
  );
  const diffDigest = context.domainDigest(
    'PROGRAMME_GATE_CONTRACT_SEMANTIC_IDENTITY_DIFF/V1',
    expectedDiff,
  );
  const exactInputContextDigest = context.domainDigest(
    'PROGRAMME_GATE_CONTRACT_DIFF_REVIEW_EXACT_INPUT_CONTEXT/V1',
    {
      specification_root: evidence.specification_root,
      code_commit: evidence.code_commit,
      predecessor_contract_bundle_id: predecessorId,
      predecessor_contract_bundle_digest: predecessorDigest,
      contract_bundle_id: successorId,
      contract_bundle_digest: successorDigest,
      frozen_contract_pair_digest: pairDigest,
      semantic_identity_diff_digest: diffDigest,
    },
  );
  return review.predecessor_contract_bundle_digest === predecessorDigest
    && review.predecessor_contract_bundle_id === predecessorId
    && review.contract_bundle_digest === successorDigest
    && review.contract_bundle_id === successorId
    && review.contract_bundle_id === evidence.contract_bundle_id
    && review.contract_bundle_digest === evidence.contract_bundle_digest
    && review.frozen_contract_pair_digest === pairDigest
    && review.frozen_contract_pair_digest === evidence.frozen_contract_pair_digest
    && JSON.stringify(review.semantic_identity_diff) === JSON.stringify(expectedDiff)
    && review.semantic_identity_diff_digest === diffDigest
    && review.exact_input_context_digest === exactInputContextDigest;
}

function contractFreezeAttestationIdentityIsValid(evidence, context, identity) {
  try {
    validateSchema('ContractFreezeAttestationIdentity/V1', identity);
  } catch {
    return false;
  }
  const expectedId = context.domainDigest(
    'PROGRAMME_GATE_CONTRACT_FREEZE_ATTESTATION_ID/V1',
    recordIdentityPayload(identity, 'contract_freeze_attestation_id'),
  );
  const expectedPair = context.domainDigest(
    'PROGRAMME_GATE_FROZEN_CONTRACT_PAIR/V1',
    {
      predecessor_contract_bundle_id: identity.predecessor_contract_bundle_id,
      predecessor_contract_bundle_digest: identity.predecessor_contract_bundle_digest,
      successor_contract_bundle_id: identity.contract_bundle_id,
      successor_contract_bundle_digest: identity.contract_bundle_digest,
      contract_freeze_attestation_id: expectedId,
    },
  );
  return identity.contract_freeze_attestation_id === expectedId
    && evidence.contract_freeze_attestation_id === expectedId
    && identity.specification_root === evidence.specification_root
    && identity.code_commit === evidence.code_commit
    && identity.environment === evidence.environment
    && identity.contract_bundle_id === evidence.contract_bundle_id
    && identity.contract_bundle_digest === evidence.contract_bundle_digest
    && evidence.frozen_contract_pair_digest === expectedPair;
}

function contractReviewIndependenceIsValid(review, evidence, context) {
  const independence = memberFor(
    context,
    `review-independence:${review.independence_attestation_id}`,
    'ReviewerIndependenceAttestation',
  );
  if (!independence) return false;
  try {
    validateSchema('ReviewerIndependenceAttestation/V1', independence);
  } catch {
    return false;
  }
  const independenceId = context.domainDigest(
    'PROGRAMME_GATE_CONTRACT_REVIEW_INDEPENDENCE_ATTESTATION_ID/V1',
    independence,
  );
  const independencePayloadDigest = context.domainDigest(
    'PROGRAMME_GATE_CONTRACT_REVIEW_INDEPENDENCE_PAYLOAD/V1',
    independence,
  );
  const emptyEditRoot = context.domainDigest('PROGRAMME_GATE_REVIEWER_EDIT_SET_ROOT/V1', []);
  return review.independence_attestation_id === independenceId
    && review.independence_attestation_payload_digest === independencePayloadDigest
    && review.reviewer_principal_id === independence.reviewer_principal_id
    && review.immutable_session_id === independence.immutable_session_id
    && review.exact_input_context_digest === independence.exact_input_context_digest
    && independence.reviewed_code_commit === evidence.code_commit
    && independence.reviewed_code_commit === context.expectedCodeCommit
    && independence.session_parent_or_genesis === 'GENESIS'
    && independence.prior_conclusion_input_set.length === 0
    && independence.reviewer_edit_set_root === emptyEditRoot
    && reviewIndependenceIsRecomputed(review, independence, context)
    && signatureIsValid(context, {
      record: independence,
      signatureField: 'signature',
      keyId: independence.validator_key_id,
      role: 'VALIDATOR',
      domain: 'PROGRAMME_GATE_REVIEWER_INDEPENDENCE/V1',
    });
}

function contractReviewerEligibilityIsBound(review, context) {
  const eligibility = context.immutableMembers.find((member) => (
    member.member_type === 'ContractFreezeAuthorityEvidence'
    && member.payload.authority_kind === 'REVIEWER_ELIGIBILITY_SET'
  ))?.payload;
  return Boolean(eligibility)
    && eligibility.authority_payload.eligibility_set_root
      === review.reviewer_eligibility_digest
    && eligibility.authority_payload.eligible_reviewers.some((reviewer) => (
      reviewer.reviewer_identity === review.reviewer_identity
      && reviewer.reviewer_model_identifier === review.reviewer_model_identifier
      && reviewer.reasoning_level === review.reasoning_level
    ));
}

function semanticAndIdentityDiffReviewed(evidence, context) {
  const members = contractFreezeMembers(evidence, context);
  return Boolean(members)
    && contractFreezeAttestationIdentityIsValid(
      evidence,
      context,
      members.attestationIdentity,
    )
    && contractAuthorityManifestMatches(evidence, context, members.authorityManifest)
    && members.review.review_id === evidence.semantic_identity_review_id
    && members.review.contract_bundle_id === evidence.contract_bundle_id
    && members.review.contract_bundle_digest === evidence.contract_bundle_digest
    && members.review.frozen_contract_pair_digest === evidence.frozen_contract_pair_digest
    && members.review.semantic_identity_diff_digest
      === members.authorityManifest.semantic_identity_diff_digest
    && contractDiffReviewIsMechanicallyBound(members.review, evidence, context)
    && members.review.review_scope === 'SEMANTIC_AND_IDENTITY_DIFF'
    && members.review.review_disposition === 'PASS'
    && members.review.blocking_finding_count === 0
    && members.review.blocking_finding_ids.length === 0
    && (
      (
        members.review.reviewer_model_identifier
          === REVIEW_CONTROLLER_POLICY.exact_model_identifier
        && members.review.reasoning_level === REVIEW_CONTROLLER_POLICY.reasoning_level
      )
      || (
        REVIEW_CONTROLLER_POLICY.fable_model_identifiers
          .includes(members.review.reviewer_model_identifier)
        && members.review.reasoning_level
          === REVIEW_CONTROLLER_POLICY.fable_reasoning_level
      )
    )
    && members.review.reviewer_eligibility_digest
      === members.authorityManifest.reviewer_eligibility_set_root
    && contractReviewerEligibilityIsBound(members.review, context)
    && contractReviewIndependenceIsValid(members.review, evidence, context)
    && members.authorityManifest.independent_reviewer_bindings.some((binding) => (
      binding.reviewer_identity === members.review.reviewer_identity
      && binding.eligibility_evidence_digest === members.review.reviewer_eligibility_digest
      && binding.review_disposition_id === members.review.review_id
    ))
    && members.review.review_set_root === evidence.specification_root
    && evidence.legal_semantic_review_disposition_id === members.review.review_id
    && evidence.identity_review_disposition_id === members.review.review_id
    && context.domainDigest(
      'PROGRAMME_GATE_CONTRACT_DIFF_REVIEW_ID/V1',
      recordIdentityPayload(members.review, 'review_id', 'signature'),
    ) === members.review.review_id
    && signatureIsValid(context, {
      record: members.review,
      signatureField: 'signature',
      keyId: members.review.controller_key_id,
      role: 'REVIEW_CONTROLLER',
      domain: 'PROGRAMME_GATE_CONTRACT_DIFF_REVIEW/V1',
    });
}

function freezeGateApproved(evidence, context) {
  const members = contractFreezeMembers(evidence, context);
  return Boolean(members)
    && contractAuthorityManifestMatches(evidence, context, members.authorityManifest)
    && members.approval.approval_id === evidence.freeze_gate_approval_id
    && members.approval.authority_manifest_id
      === evidence.contract_authority_manifest_id
    && members.approval.frozen_contract_pair_digest === evidence.frozen_contract_pair_digest
    && evidence.ben_bundle_approval_evidence_id === members.approval.approval_id
    && members.approval.approver_identity === 'BEN_GOODCHILD'
    && members.approval.conditions.length === 0
    && signatureIsValid(context, {
      record: members.approval,
      signatureField: 'signature',
      keyId: members.approval.approver_key_id,
      role: 'BEN_APPROVER',
      domain: 'PROGRAMME_GATE_CONTRACT_FREEZE_APPROVAL/V1',
    });
}

function statusGenerationMatches(evidence, context) {
  const members = contractFreezeMembers(evidence, context);
  return Boolean(members)
    && members.status.specification_root === evidence.specification_root
    && members.status.code_commit === evidence.code_commit
    && members.status.environment === evidence.environment
    && members.status.generation === evidence.status_generation
    && signatureIsValid(context, {
      record: members.status,
      signatureField: 'signature',
      keyId: members.status.validator_key_id,
      role: 'STATUS_PUBLISHER',
      domain: 'PROGRAMME_GATE_STATUS/V2',
    })
    && context.domainDigest(
      'PROGRAMME_GATE_STATUS_ARTEFACT_PAYLOAD/V2',
      members.status,
    ) === evidence.status_payload_digest;
}

const ACCEPTANCE_PREDICATES = Object.freeze({
  G0_MARKET_STATS_CONTAINED: Object.freeze({
    feature_gate_off: featureGateOff,
    live_route_zero_corpus_reads: liveRouteZeroCorpusReads,
    containment_test_pass: containmentTestPass,
  }),
  G0_BROAD_CORPUS_ROUTES_CONTAINED: Object.freeze({
    source_built_and_runtime_route_inventories_equal: sourceBuiltAndRuntimeRouteInventoriesEqual,
    every_broad_route_contained: everyBroadRouteContained,
    zero_broad_node_fallback: zeroBroadNodeFallback,
  }),
  G0_ZAYO_DISPOSITION: Object.freeze({
    owner_and_purpose_recorded_without_secret: ownerAndPurposeRecordedWithoutSecret,
    recognised_or_rotation_required: recognisedOrRotationRequired,
  }),
  G0_CLAUDE_CREDENTIAL_ROTATION: Object.freeze({
    compromised_credentials_revoked: compromisedCredentialsRevoked,
    replacement_activation_verified: replacementActivationVerified,
    no_secret_in_evidence: noSecretInEvidence,
  }),
  G0_SUPABASE_SECRET_DISPOSITION: Object.freeze({
    rotation_verified_or_recognised_traffic_na_with_ben_approval:
      rotationVerifiedOrRecognisedTrafficNaWithBenApproval,
    no_secret_in_evidence: noSecretInEvidence,
  }),
  G0_STAGING_SUPABASE_ISOLATED: Object.freeze({
    distinct_project_and_credentials: distinctProjectAndCredentials,
    production_dml_denied: productionDmlDenied,
    snapshot_restore_only: snapshotRestoreOnly,
  }),
  G0_STAGING_VERCEL_ISOLATED: Object.freeze({
    branch_preview_uses_staging_only_credentials: branchPreviewUsesStagingOnlyCredentials,
    production_alias_unchanged: productionAliasUnchanged,
  }),
  G0_STAGING_ACCESS_PROTECTED: Object.freeze({
    complete_preview_route_action_inventory: completePreviewRouteActionInventory,
    unauthenticated_access_denied_before_and_after_restore:
      unauthenticatedAccessDeniedBeforeAndAfterRestore,
    authenticated_non_admin_privileged_actions_denied:
      authenticatedNonAdminPrivilegedActionsDenied,
    writer_ingest_correction_export_import_promotion_and_cutover_actions_disabled:
      privilegedPreviewActionsDisabled,
    authorised_read_only_test_access_pass: authorisedReadOnlyTestAccessPass,
  }),
  G0_EXACT_DIGEST_REVIEW_SET: Object.freeze({
    five_named_lanes_pass_same_root: fiveNamedLanesPassSameRoot,
    eligible_legal_reviewer: eligibleLegalReviewer,
    reviewer_independence_recomputed: reviewerIndependenceRecomputed,
    root_unchanged_before_and_after: rootUnchangedBeforeAndAfter,
  }),
  G0_BEN_SPEC_APPROVAL: Object.freeze({
    approved_root_equals_passing_review_root: approvedRootEqualsPassingReviewRoot,
    ben_identity_and_signature_valid: benIdentityAndSignatureValid,
    approval_unconditional: approvalUnconditional,
  }),
  P1_CONTRACT_FREEZE_ATTESTED: Object.freeze({
    bundle_compiles: bundleCompiles,
    semantic_and_identity_diff_reviewed: semanticAndIdentityDiffReviewed,
    freeze_gate_approved: freezeGateApproved,
    status_generation_matches: statusGenerationMatches,
  }),
});

function predicatesForGate(gateId) {
  const predicates = ACCEPTANCE_PREDICATES[gateId];
  if (!predicates) {
    throw new AcceptancePredicateError('UNKNOWN_GATE', `unknown G0 gate: ${gateId}`);
  }
  return predicates;
}

function falseClaims(predicates) {
  return Object.freeze(Object.keys(predicates).map((claimKey) => Object.freeze({
    claim_key: claimKey,
    result_type: 'BOOLEAN',
    typed_value: false,
  })));
}

function evaluateAcceptanceClaims({ gate_id: gateId, evidence, context }) {
  const predicates = predicatesForGate(gateId);
  if (!evidenceCanBeEvaluated(gateId, evidence, context)) {
    return falseClaims(predicates);
  }
  return Object.freeze(Object.entries(predicates).map(([claimKey, predicate]) => Object.freeze({
    claim_key: claimKey,
    result_type: 'BOOLEAN',
    typed_value: predicate(evidence, context),
  })));
}

module.exports = {
  ACCEPTANCE_PREDICATES,
  AcceptancePredicateError,
  FRESHNESS_WINDOWS_MS,
  GATE_FRESHNESS_CLASS,
  NESTED_RAW_EVIDENCE_KEYS,
  RAW_EVIDENCE_KEYS,
  approvalUnconditional,
  approvedRootEqualsPassingReviewRoot,
  authorisedReadOnlyTestAccessPass,
  benIdentityAndSignatureValid,
  branchPreviewUsesStagingOnlyCredentials,
  bundleCompiles,
  compromisedCredentialsRevoked,
  completePreviewRouteActionInventory,
  contractDiffReviewIsMechanicallyBound,
  contractReviewIndependenceIsValid,
  containmentTestPass,
  distinctProjectAndCredentials,
  eligibleLegalReviewer,
  evaluateAcceptanceClaims,
  everyBroadRouteContained,
  featureGateOff,
  fiveNamedLanesPassSameRoot,
  freezeGateApproved,
  liveRouteZeroCorpusReads,
  noSecretInEvidence,
  ownerAndPurposeRecordedWithoutSecret,
  predicatesForGate,
  productionAliasUnchanged,
  productionDmlDenied,
  privilegedPreviewActionsDisabled,
  rawEvidenceShapeIsValid,
  recognisedOrRotationRequired,
  replacementActivationVerified,
  reviewerIndependenceRecomputed,
  rootUnchangedBeforeAndAfter,
  rotationVerifiedOrRecognisedTrafficNaWithBenApproval,
  semanticAndIdentityDiffReviewed,
  sharedContextIsCurrent,
  snapshotRestoreOnly,
  sourceBuiltAndRuntimeRouteInventoriesEqual,
  statusGenerationMatches,
  authenticatedNonAdminPrivilegedActionsDenied,
  unauthenticatedAccessDeniedBeforeAndAfterRestore,
  zeroBroadNodeFallback,
};
