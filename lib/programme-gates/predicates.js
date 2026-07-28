const crypto = require('node:crypto');
const {
  enumerateCompleteGitAuthorshipUniverse,
} = require('./git-authorship');

const {
  REVIEW_CONTROLLER_POLICY,
  REVIEW_LANES,
} = require('./registry');

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
  return Array.isArray(actions)
    && new Set(actions.map((entry) => entry.action_id)).size === actions.length
    && sameClosedStringSet(
      actions.map((entry) => entry.action_class),
      PREVIEW_ACTION_CLASSES,
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
      'manifest_id', 'manifest_digest', 'file_count', 'immutable',
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
      'schema_id', 'path', 'payload_digest', 'byte_length', 'immutable',
    ])
    || !hasExactKeys(runtime, [
      'context_version',
      'review_runtime_binary_path',
      'review_runtime_version',
      'review_runtime_binary_digest',
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
  const scratchPaths = [runtime.home_path, runtime.codex_home_path, runtime.tmpdir_path];
  if (manifest.manifest_version !== REVIEW_CONTROLLER_POLICY.task_manifest_version
    || manifest.lane_id !== lane.lane_id
    || manifest.exact_specification_root !== context.expectedSpecificationRoot
    || manifest.frozen_specification.manifest_id
      !== REVIEW_CONTROLLER_POLICY.frozen_specification_manifest_id
    || manifest.frozen_specification.file_count
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
    || !isNonEmptyString(runtime.working_directory)
    || !runtime.working_directory.startsWith('/')
    || scratchPaths.some((pathValue) => (
      !isNonEmptyString(pathValue) || !pathValue.startsWith('/')
    ))
    || new Set(scratchPaths).size !== scratchPaths.length) return false;
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
    laneMembers.push({
      lane_id: lane.lane_id,
      controller_record: record,
      independence_attestation: independence,
    });
  }
  if (runtimeIdentities.size !== 1
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
  return authorityManifest && compilation && review && approval && status
    ? { authorityManifest, compilation, review, approval, status }
    : null;
}

function recordIdentityPayload(record, idField, signatureField = null) {
  return Object.fromEntries(Object.entries(record).filter(([key]) => (
    key !== idField && key !== signatureField
  )));
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
  RELATIONSHIP_EFFECT_FIELD_UNIVERSE:
    'relationship_effect_field_universe_set_root',
  REVIEWER_ELIGIBILITY_SET: 'reviewer_eligibility_set_root',
  BEN_TAXONOMY_CODEBOOK_DECISION_SET:
    'ben_taxonomy_codebook_decision_set_root',
});

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
    `g0-review:${manifest.g0_review_set_evidence_id}`,
    'ExactDigestReviewSetAttestation',
  );
  const g0Approval = memberFor(
    context,
    `g0-approval:${manifest.g0_ben_approval_evidence_id}`,
    'BenSpecificationApprovalEvidence',
  );
  if (!g0Review
    || g0Review.review_set_evidence_id !== manifest.g0_review_set_evidence_id
    || g0Review.reviewed_root !== manifest.specification_root
    || context.domainDigest('PROGRAMME_GATE_G0_REVIEW_SET_PAYLOAD/V1', g0Review)
      !== manifest.g0_review_set_payload_digest
    || !g0Approval
    || g0Approval.approval_evidence_id !== manifest.g0_ben_approval_evidence_id
    || g0Approval.approved_root !== manifest.specification_root
    || g0Approval.passing_review_set_evidence_id !== g0Review.review_set_evidence_id
    || g0Approval.conditions.length !== 0
    || context.domainDigest('PROGRAMME_GATE_G0_BEN_APPROVAL_PAYLOAD/V1', g0Approval)
      !== manifest.g0_ben_approval_payload_digest) return false;

  const authorities = context.immutableMembers
    .filter((member) => member.member_type === 'ContractFreezeAuthorityEvidence');
  if (authorities.some((member) => (
    member.member_id !== `authority-evidence:${member.payload.authority_evidence_id}`
    || member.payload.authority_payload_digest !== context.domainDigest(
      'PROGRAMME_GATE_CONTRACT_AUTHORITY_PAYLOAD/V1',
      member.payload.authority_payload,
    )
    || member.payload.authority_evidence_id !== context.domainDigest(
      'PROGRAMME_GATE_CONTRACT_AUTHORITY_EVIDENCE_ID/V1',
      recordIdentityPayload(member.payload, 'authority_evidence_id'),
    )
    || member.payload.conditions.length !== 0
  ))) return false;
  for (const [kind, field] of Object.entries(CONTRACT_AUTHORITY_ID_FIELDS)) {
    const matches = authorities.filter((member) => member.payload.authority_kind === kind);
    if (matches.length !== 1
      || matches[0].payload.authority_subject_id !== manifest[field]) return false;
  }
  for (const [kind, field] of Object.entries(CONTRACT_AUTHORITY_DIGEST_FIELDS)) {
    const matches = authorities.filter((member) => member.payload.authority_kind === kind);
    if (matches.length !== 1
      || matches[0].payload.authority_payload_digest !== manifest[field]) return false;
  }
  for (const [kind, roots] of [
    ['PRE_FREEZE_SEMANTIC_STAGE_OUTPUT_SET', manifest.pre_freeze_semantic_stage_output_set_roots],
    ['PRE_FREEZE_NEUTRAL_PROJECTION_SET', manifest.pre_freeze_neutral_projection_set_roots],
  ]) {
    const matches = authorities.filter((member) => member.payload.authority_kind === kind);
    if (matches.length !== roots.length
      || !roots.every((root) => (
        matches.some((member) => member.payload.authority_payload_digest === root)
      ))) return false;
  }
  const reviewerEligibility = authorities.find(
    (member) => member.payload.authority_kind === 'REVIEWER_ELIGIBILITY_SET',
  );
  const eligibleIdentities =
    reviewerEligibility.payload.authority_payload.eligible_reviewer_identities;
  if (!Array.isArray(eligibleIdentities)
    || new Set(eligibleIdentities).size !== eligibleIdentities.length
    || !manifest.independent_reviewer_bindings.every(
      (binding) => eligibleIdentities.includes(binding.reviewer_identity),
    )) return false;
  const expectedAuthorityCount = Object.keys(CONTRACT_AUTHORITY_ID_FIELDS).length
    + Object.keys(CONTRACT_AUTHORITY_DIGEST_FIELDS).length
    + manifest.pre_freeze_semantic_stage_output_set_roots.length
    + manifest.pre_freeze_neutral_projection_set_roots.length;
  return authorities.length === expectedAuthorityCount
    && inventory.length === governing.length + authorities.length + 2;
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

function bundleCompiles(evidence, context) {
  const members = contractFreezeMembers(evidence, context);
  return Boolean(members)
    && evidence.specification_root === context.expectedSpecificationRoot
    && contractAuthorityManifestMatches(evidence, context, members.authorityManifest)
    && members.compilation.receipt_id === evidence.compilation_receipt_id
    && members.compilation.contract_bundle_id === evidence.contract_bundle_id
    && members.compilation.contract_bundle_digest === evidence.contract_bundle_digest
    && members.compilation.frozen_contract_pair_digest === evidence.frozen_contract_pair_digest
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

function semanticAndIdentityDiffReviewed(evidence, context) {
  const members = contractFreezeMembers(evidence, context);
  return Boolean(members)
    && contractAuthorityManifestMatches(evidence, context, members.authorityManifest)
    && members.review.review_id === evidence.semantic_identity_review_id
    && members.review.contract_bundle_id === evidence.contract_bundle_id
    && members.review.contract_bundle_digest === evidence.contract_bundle_digest
    && members.review.frozen_contract_pair_digest === evidence.frozen_contract_pair_digest
    && members.review.semantic_identity_diff_digest
      === members.authorityManifest.semantic_identity_diff_digest
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
