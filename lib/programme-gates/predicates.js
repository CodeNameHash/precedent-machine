const { REVIEW_LANES } = require('./registry');

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
    'process_identity_digest',
    'owner',
    'purpose',
    'recognition_status',
    'rotation_required',
    'rotation_completed',
    'secret_field_count',
  ]),
  G0_CLAUDE_CREDENTIAL_ROTATION: Object.freeze([
    'compromised_credential_ids',
    'revoked_ids',
    'replacement_activation_verified_at',
    'secret_field_count',
  ]),
  G0_SUPABASE_SECRET_DISPOSITION: Object.freeze([
    'disposition',
    'rotation_verified_at',
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
    'unauthenticated_status',
    'authorised_status',
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
      return isDigest(evidence.process_identity_digest)
        && isNonEmptyString(evidence.owner)
        && isNonEmptyString(evidence.purpose)
        && ['RECOGNISED', 'UNRECOGNISED'].includes(evidence.recognition_status)
        && typeof evidence.rotation_required === 'boolean'
        && typeof evidence.rotation_completed === 'boolean'
        && isNonNegativeInteger(evidence.secret_field_count);
    case 'G0_CLAUDE_CREDENTIAL_ROTATION':
      return isUniqueNonEmptyStringArray(evidence.compromised_credential_ids)
        && evidence.compromised_credential_ids.every(isDigest)
        && isUniqueNonEmptyStringArray(evidence.revoked_ids)
        && evidence.revoked_ids.every(isDigest)
        && isTimestamp(evidence.replacement_activation_verified_at)
        && isNonNegativeInteger(evidence.secret_field_count);
    case 'G0_SUPABASE_SECRET_DISPOSITION':
      return ['ROTATED', 'RECOGNISED_TRAFFIC_APPROVED_NA'].includes(evidence.disposition)
        && (evidence.rotation_verified_at === null || isTimestamp(evidence.rotation_verified_at))
        && (evidence.ben_approval_id === null || isNonEmptyString(evidence.ben_approval_id))
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
      return Number.isInteger(evidence.unauthenticated_status)
        && Number.isInteger(evidence.authorised_status);
    case 'G0_EXACT_DIGEST_REVIEW_SET':
      return isDigest(evidence.review_set_evidence_id)
        && isDigest(evidence.reviewed_root);
    case 'G0_BEN_SPEC_APPROVAL':
      return isDigest(evidence.approval_evidence_id)
        && isDigest(evidence.approved_root)
        && isDigest(evidence.passing_review_set_evidence_id)
        && Array.isArray(evidence.conditions);
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

function rotationVerifiedOrRecognisedTrafficNaWithBenApproval(evidence) {
  return (
    evidence.disposition === 'ROTATED'
    && isTimestamp(evidence.rotation_verified_at)
    && evidence.ben_approval_id === null
  ) || (
    evidence.disposition === 'RECOGNISED_TRAFFIC_APPROVED_NA'
    && evidence.rotation_verified_at === null
    && isNonEmptyString(evidence.ben_approval_id)
  );
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

function unauthenticatedAccessDenied(evidence) {
  return evidence.unauthenticated_status === 401 || evidence.unauthenticated_status === 403;
}

function authorisedTestAccessPass(evidence) {
  return evidence.authorised_status >= 200 && evidence.authorised_status < 300;
}

function verifiedReviewSet(evidence, context) {
  const verified = context && context.verifiedReviewSet;
  return isRecord(verified)
    && verified.evidence_id === evidence.review_set_evidence_id
    && verified.reviewed_root === evidence.reviewed_root
    && verified.reviewed_root === context.expectedSpecificationRoot;
}

function fiveNamedLanesPassSameRoot(evidence, context) {
  const expectedLaneIds = REVIEW_LANES.map((lane) => lane.lane_id);
  return verifiedReviewSet(evidence, context)
    && sameClosedStringSet(context.verifiedReviewSet.lane_ids, expectedLaneIds)
    && context.verifiedReviewSet.all_dispositions_pass === true;
}

function eligibleLegalReviewer(evidence, context) {
  return verifiedReviewSet(evidence, context)
    && context.verifiedReviewSet.legal_reviewer_eligible === true;
}

function reviewerIndependenceRecomputed(evidence, context) {
  return verifiedReviewSet(evidence, context)
    && context.verifiedReviewSet.independence_recomputed === true;
}

function rootUnchangedBeforeAndAfter(evidence, context) {
  return verifiedReviewSet(evidence, context)
    && context.verifiedReviewSet.root_before === context.expectedSpecificationRoot
    && context.verifiedReviewSet.root_after === context.expectedSpecificationRoot;
}

function approvedRootEqualsPassingReviewRoot(evidence, context) {
  const verified = context && context.verifiedBenApproval;
  return evidence.approved_root === context.expectedSpecificationRoot
    && isRecord(verified)
    && verified.evidence_id === evidence.approval_evidence_id
    && verified.approved_root === evidence.approved_root
    && verified.passing_review_set_evidence_id === evidence.passing_review_set_evidence_id;
}

function benIdentityAndSignatureValid(evidence, context) {
  const verified = context && context.verifiedBenApproval;
  return isRecord(verified)
    && verified.evidence_id === evidence.approval_evidence_id
    && verified.identity_and_signature_verified === true;
}

function approvalUnconditional(evidence, context) {
  const verified = context && context.verifiedBenApproval;
  return evidence.conditions.length === 0
    && isRecord(verified)
    && verified.evidence_id === evidence.approval_evidence_id
    && verified.unconditional === true;
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
    unauthenticated_access_denied: unauthenticatedAccessDenied,
    authorised_test_access_pass: authorisedTestAccessPass,
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
  authorisedTestAccessPass,
  benIdentityAndSignatureValid,
  branchPreviewUsesStagingOnlyCredentials,
  compromisedCredentialsRevoked,
  containmentTestPass,
  distinctProjectAndCredentials,
  eligibleLegalReviewer,
  evaluateAcceptanceClaims,
  everyBroadRouteContained,
  featureGateOff,
  fiveNamedLanesPassSameRoot,
  liveRouteZeroCorpusReads,
  noSecretInEvidence,
  ownerAndPurposeRecordedWithoutSecret,
  predicatesForGate,
  productionAliasUnchanged,
  productionDmlDenied,
  rawEvidenceShapeIsValid,
  recognisedOrRotationRequired,
  replacementActivationVerified,
  reviewerIndependenceRecomputed,
  rootUnchangedBeforeAndAfter,
  rotationVerifiedOrRecognisedTrafficNaWithBenApproval,
  sharedContextIsCurrent,
  snapshotRestoreOnly,
  sourceBuiltAndRuntimeRouteInventoriesEqual,
  unauthenticatedAccessDenied,
  zeroBroadNodeFallback,
};
