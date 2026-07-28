const crypto = require('node:crypto');

const { domainDigest } = require('./bytes');
const {
  PRODUCTION_PROJECT_REF,
  SNAPSHOT_PROJECT_NAME,
  SNAPSHOT_PROJECT_REF,
} = require('../canonical-v2/production-snapshot-source-envelope');
const {
  STAGING_PROJECT_REF,
} = require('./isolation-readiness');

const PREVIEW_BRANCH = 'codex/canonical-corpus-v2';
const EXPECTED_SNAPSHOT_NAME = 'deal-corpus-canonical-v2-staging-snapshot';
const REQUIRED_PREVIEW_KEYS = Object.freeze([
  'CANONICAL_V2_STAGING_DATABASE_URL',
  'CANONICAL_V2_REVIEW_ENABLED',
  'NEXT_PUBLIC_CANONICAL_V2_REVIEW_ENABLED',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_URL',
]);
const REQUIRED_PREVIEW_ACTION_CLASSES = Object.freeze([
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

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function requireString(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${label} must be non-empty`);
  }
  return value;
}

function requireTimestamp(value) {
  requireString(value, 'observed_at');
  if (!Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) {
    throw new TypeError('observed_at must be a canonical UTC timestamp');
  }
  return value;
}

function refFromSupabaseUrl(value, label) {
  let url;
  try {
    url = new URL(requireString(value, label));
  } catch {
    throw new Error(`${label} is not a valid URL`);
  }
  const match = url.hostname.match(/^([a-z]{20})\.supabase\.co$/);
  if (!match) throw new Error(`${label} is not a pinned Supabase project URL`);
  return match[1];
}

function mapEnvironmentRecords(records, requiredKeys, target, branch) {
  if (!Array.isArray(records)) throw new TypeError('Vercel environment records must be an array');
  const identities = {};
  for (const key of requiredKeys) {
    const matches = records.filter((record) => record
      && record.key === key
      && Array.isArray(record.target)
      && record.target.includes(target)
      && (branch === null ? !record.gitBranch : record.gitBranch === branch));
    if (matches.length !== 1) {
      throw new Error(`${key} is not uniquely scoped to ${target}${branch ? `:${branch}` : ''}`);
    }
    identities[key] = {
      id: requireString(matches[0].id, `${key} environment record ID`),
      type: requireString(matches[0].type, `${key} environment record type`),
      updated_at: matches[0].updatedAt,
    };
  }
  return identities;
}

function credentialIdentity(value) {
  return domainDigest('PROGRAMME_GATE_SUPABASE_CREDENTIAL_IDENTITY/V1', {
    service_key_sha256: sha256(requireString(value, 'Supabase service key')),
  });
}

function redirectOrigin(response) {
  if (response.status !== 302) return null;
  const location = requireString(response.location, 'unauthenticated redirect location');
  const url = new URL(location);
  return `${url.origin}${url.pathname}`;
}

function validateSnapshotBoundary() {
  if (PRODUCTION_PROJECT_REF !== 'tzulhdasmioeechxapdy'
    || SNAPSHOT_PROJECT_REF === PRODUCTION_PROJECT_REF
    || SNAPSHOT_PROJECT_REF === STAGING_PROJECT_REF
    || SNAPSHOT_PROJECT_NAME !== EXPECTED_SNAPSHOT_NAME) {
    throw new Error('production snapshot source boundary has drifted');
  }
}

function previewRouteActions(records) {
  if (!Array.isArray(records)
    || records.length !== REQUIRED_PREVIEW_ACTION_CLASSES.length
    || new Set(records.map((entry) => entry && entry.action_id)).size !== records.length
    || new Set(records.map((entry) => entry && entry.action_class)).size !== records.length
    || !REQUIRED_PREVIEW_ACTION_CLASSES.every(
      (actionClass) => records.some((entry) => entry.action_class === actionClass),
    )) {
    throw new Error('preview route-action observation is incomplete');
  }
  return Object.freeze(records.map((entry) => Object.freeze({ ...entry })));
}

function buildIsolationObservationSource(input) {
  const observedAt = requireTimestamp(input.observedAt);
  const preview = mapEnvironmentRecords(
    input.previewEnvironmentRecords,
    REQUIRED_PREVIEW_KEYS,
    'preview',
    PREVIEW_BRANCH,
  );
  if (refFromSupabaseUrl(
      input.productionEnvironment.NEXT_PUBLIC_SUPABASE_URL,
      'production NEXT_PUBLIC_SUPABASE_URL',
    ) !== PRODUCTION_PROJECT_REF
    || input.previewRuntimeResponse.status !== 200
    || Object.keys(preview).length !== REQUIRED_PREVIEW_KEYS.length) {
    throw new Error('Vercel environments do not select the frozen production and staging projects');
  }
  const productionCredentialIdentity = credentialIdentity(
    input.productionEnvironment.SUPABASE_SERVICE_ROLE_KEY,
  );
  const stagingCredentialIdentity = credentialIdentity(input.stagingServiceKey);
  if (productionCredentialIdentity === stagingCredentialIdentity) {
    throw new Error('production and staging credentials are not distinct');
  }
  if (![401, 403].includes(input.productionDmlResponse.status)) {
    throw new Error('the staging service credential was not denied by production DML');
  }
  if (input.previewDeployment.id !== input.previewDeploymentId
    || ![null, 'preview'].includes(input.previewDeployment.target)
    || input.previewDeployment.projectId !== input.projectId
    || input.previewDeployment.meta?.githubCommitRef !== PREVIEW_BRANCH
    || input.previewDeployment.meta?.githubCommitSha !== input.codeCommit) {
    throw new Error('preview deployment is not the exact isolated branch commit');
  }
  if (input.productionDeploymentBefore.id !== input.productionDeploymentAfter.id
    || input.productionDeploymentBefore.projectId !== input.projectId
    || input.productionDeploymentAfter.projectId !== input.projectId
    || input.productionDeploymentBefore.target !== 'production'
    || input.productionDeploymentAfter.target !== 'production') {
    throw new Error('production alias changed during the isolation observation');
  }
  const unauthenticatedRedirectOrigin = redirectOrigin(input.unauthenticatedResponse);
  if (!([401, 403].includes(input.unauthenticatedResponse.status)
      || (input.unauthenticatedResponse.status === 302
        && unauthenticatedRedirectOrigin === 'https://vercel.com/sso-api'))
    || input.authorisedResponse.status < 200
    || input.authorisedResponse.status >= 300) {
    throw new Error('preview access protection observation did not pass');
  }
  validateSnapshotBoundary();
  const accessActions = previewRouteActions(input.previewRouteActions);
  return Object.freeze({
    schema_version: 'ProgrammeGateIsolationObservationSource/V1',
    observed_at: observedAt,
    production_project_ref: PRODUCTION_PROJECT_REF,
    staging_project_ref: STAGING_PROJECT_REF,
    production_credential_identity_digest: productionCredentialIdentity,
    staging_credential_identity_digest: stagingCredentialIdentity,
    production_dml_probe: 'DENIED',
    restore_mode: 'PRODUCTION_SNAPSHOT_ONLY',
    preview_deployment_id: input.previewDeploymentId,
    preview_code_commit: input.codeCommit,
    preview_credential_scope: 'STAGING_ONLY',
    production_alias_before: input.productionDeploymentBefore.id,
    production_alias_after: input.productionDeploymentAfter.id,
    preview_route_actions: accessActions,
    secret_field_count: 0,
  });
}

module.exports = {
  PREVIEW_BRANCH,
  REQUIRED_PREVIEW_KEYS,
  REQUIRED_PREVIEW_ACTION_CLASSES,
  buildIsolationObservationSource,
};
