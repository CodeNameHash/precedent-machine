'use strict';

const { canonicalJson, contentId } = require('./canonical-bytes');
const {
  CANONICAL_V2_FEATURE_FLAG_DEFINITIONS,
  isEnabled,
} = require('./feature-flags');
const { resolveDurableArtifactRoot } = require('./durable-artifact-root');

const DARK_INTEGRATION_CONFIGURATION_SCHEMA = 'CANONICAL_V2_DARK_INTEGRATION_CONFIGURATION/V1';
const DARK_INTEGRATION_PREFLIGHT_SCHEMA = 'CANONICAL_V2_DARK_INTEGRATION_PREFLIGHT/V1';
const DARK_INTEGRATION_AUTHORITY = 'NONE';
const CURRENT_ENVIRONMENT_VERIFICATION = 'UNAVAILABLE_EXTERNAL_TRUSTED_CONTROLLER_AND_REGISTRY_REQUIRED';
const TRUSTED_CURRENT_ENVIRONMENT_VERIFIER_BLOCKER = 'DARK_INTEGRATION_TRUSTED_CURRENT_ENVIRONMENT_VERIFIER_UNAVAILABLE';
const REQUIRED_AUTHORITY_KEYS = Object.freeze([
  'production_activation_authority',
  'production_authority',
  'production_corpus_write_authority',
  'production_import_authority',
]);
const REQUIRED_CONFIGURATION_KEYS = Object.freeze([
  'authority',
  'durable_artifact_root',
  'schema_version',
]);

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(value, requiredKeys) {
  return isPlainObject(value)
    && canonicalJson(Object.keys(value).sort()) === canonicalJson([...requiredKeys].sort());
}

function blocker(code, message) {
  return Object.freeze({ code, message });
}

function flagStatus(environment) {
  return Object.freeze(CANONICAL_V2_FEATURE_FLAG_DEFINITIONS
    .map((definition) => {
      const configured = environment[definition.environment_key];
      return Object.freeze({
        environment_key: definition.environment_key,
        surface: definition.surface,
        configured: configured === undefined ? null : String(configured),
        configured_enabled: isEnabled(configured),
        effective_enabled: definition.is_enabled(environment),
      });
    })
    .sort((left, right) => left.environment_key.localeCompare(right.environment_key)));
}

function authorityStatus(configuration, blockers) {
  const authority = configuration?.authority;
  if (!exactKeys(authority, REQUIRED_AUTHORITY_KEYS)) {
    blockers.push(blocker(
      'DARK_INTEGRATION_AUTHORITY_SCHEMA_DRIFT',
      'Production authority must declare exactly the four Canonical V2 authority controls.',
    ));
    return null;
  }
  const status = Object.freeze(Object.fromEntries(REQUIRED_AUTHORITY_KEYS
    .map((key) => [key, authority[key]])));
  for (const key of REQUIRED_AUTHORITY_KEYS) {
    if (status[key] !== 'NONE') {
      blockers.push(blocker(
        'DARK_INTEGRATION_PRODUCTION_AUTHORITY_ENABLED',
        `Production authority ${key} must be NONE during dark integration.`,
      ));
    }
  }
  return status;
}

function durableRootStatus(configuration, environment, blockers) {
  try {
    return resolveDurableArtifactRoot({
      root: configuration?.durable_artifact_root,
      environment,
      certificationMode: true,
      requireExisting: true,
    });
  } catch (error) {
    blockers.push(blocker(
      error?.code || 'DARK_INTEGRATION_DURABLE_ARTIFACT_ROOT_INVALID',
      error?.message || 'Durable artifact root is invalid.',
    ));
    return null;
  }
}

function buildDarkIntegrationPreflight({
  configuration,
  environment = process.env,
} = {}) {
  const blockers = [];
  const safeEnvironment = isPlainObject(environment) ? environment : {};
  if (!isPlainObject(environment)) {
    blockers.push(blocker(
      'DARK_INTEGRATION_ENVIRONMENT_INVALID',
      'Feature-flag environment must be a plain object.',
    ));
  }
  if (!exactKeys(configuration, REQUIRED_CONFIGURATION_KEYS)
    || configuration.schema_version !== DARK_INTEGRATION_CONFIGURATION_SCHEMA) {
    blockers.push(blocker(
      'DARK_INTEGRATION_CONFIGURATION_SCHEMA_DRIFT',
      'Dark-integration configuration must match the current exact schema.',
    ));
  }

  const featureFlags = flagStatus(safeEnvironment);
  for (const flag of featureFlags) {
    if (flag.configured_enabled || flag.effective_enabled) {
      blockers.push(blocker(
        'DARK_INTEGRATION_FEATURE_FLAG_ENABLED',
        `Canonical V2 feature flag ${flag.environment_key} must remain closed.`,
      ));
    }
  }
  const authority = authorityStatus(configuration, blockers);
  const durableArtifactRoot = durableRootStatus(configuration, safeEnvironment, blockers);
  const sortedBlockers = Object.freeze([...blockers].sort((left, right) => (
    left.code.localeCompare(right.code) || left.message.localeCompare(right.message)
  )));
  const diagnosticBlockers = Object.freeze([
    ...sortedBlockers,
    blocker(
      TRUSTED_CURRENT_ENVIRONMENT_VERIFIER_BLOCKER,
      'Caller-supplied environment values are diagnostic only. An external trusted controller using a protected registry must verify the current environment before executable PASS can exist.',
    ),
  ].sort((left, right) => (
    left.code.localeCompare(right.code) || left.message.localeCompare(right.message)
  )));
  const body = {
    schema_version: DARK_INTEGRATION_PREFLIGHT_SCHEMA,
    status: 'BLOCKED',
    authority: DARK_INTEGRATION_AUTHORITY,
    executable_pass: false,
    current_environment_verification: CURRENT_ENVIRONMENT_VERIFICATION,
    feature_flags: featureFlags,
    production_authority: authority,
    durable_artifact_root: durableArtifactRoot,
    blockers: diagnosticBlockers,
  };
  return Object.freeze({
    ...body,
    preflight_id: contentId(DARK_INTEGRATION_PREFLIGHT_SCHEMA, body),
  });
}

function validateDarkIntegrationPreflightReceipt(receipt, callerVerification) {
  const requiredKeys = [
    'authority',
    'blockers',
    'current_environment_verification',
    'durable_artifact_root',
    'executable_pass',
    'feature_flags',
    'preflight_id',
    'production_authority',
    'schema_version',
    'status',
  ];
  if (!exactKeys(receipt, requiredKeys)
    || receipt.schema_version !== DARK_INTEGRATION_PREFLIGHT_SCHEMA
    || receipt.status !== 'BLOCKED'
    || receipt.authority !== DARK_INTEGRATION_AUTHORITY
    || receipt.executable_pass !== false
    || receipt.current_environment_verification !== CURRENT_ENVIRONMENT_VERIFICATION) {
    throw new TypeError('Dark-integration preflight receipt has an invalid schema.');
  }
  if (!Array.isArray(receipt.blockers) || !receipt.blockers.some((entry) => (
    entry && entry.code === TRUSTED_CURRENT_ENVIRONMENT_VERIFIER_BLOCKER
  ))) {
    throw new TypeError('Dark-integration preflight receipt is missing the required external current-environment verifier blocker.');
  }
  if (callerVerification !== undefined) {
    throw new TypeError('Caller-supplied current-environment verification is not trusted.');
  }
  const { preflight_id: preflightId, ...body } = receipt;
  if (typeof preflightId !== 'string'
    || preflightId !== contentId(DARK_INTEGRATION_PREFLIGHT_SCHEMA, body)) {
    throw new TypeError('Dark-integration preflight receipt does not match its content identity.');
  }
  return Object.freeze({ ...receipt });
}

module.exports = {
  CURRENT_ENVIRONMENT_VERIFICATION,
  TRUSTED_CURRENT_ENVIRONMENT_VERIFIER_BLOCKER,
  DARK_INTEGRATION_AUTHORITY,
  DARK_INTEGRATION_CONFIGURATION_SCHEMA,
  DARK_INTEGRATION_PREFLIGHT_SCHEMA,
  REQUIRED_AUTHORITY_KEYS,
  buildDarkIntegrationPreflight,
  validateDarkIntegrationPreflightReceipt,
};
