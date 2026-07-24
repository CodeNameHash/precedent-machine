const { canonicalJson, contentId } = require('./canonical-bytes');

const SHA256_RE = /^[a-f0-9]{64}$/;
const MANIFEST_SCHEMA_VERSION = 'GOVERNED_DEAL_IDENTITY_MANIFEST/V1';
const IDENTITY_SCHEMA_VERSION = 'GOVERNED_DEAL_IDENTITY/V1';
const AUTHORITY_ATTESTATION_SCHEMA_VERSION = 'DEAL_IDENTITY_AUTHORITY_ATTESTATION/V1';
const UUID_RE = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const SEED_KINDS = new Set([
  'EXTERNAL_TRANSACTION_ID',
  'BEN_APPROVED_IMPORT_IDENTITY',
]);
const MANIFEST_KEYS = [
  'schema_version',
  'deal_identity_schema_version',
  'immutable_deal_seed',
  'governed_deal_key',
  'reviewed_supersession_reference_ids',
  'deal_identity_manifest_id',
];
const AUTHORITY_ATTESTATION_KEYS = [
  'schema_version',
  'deal_identity_manifest_id',
  'governed_deal_key',
  'immutable_deal_seed',
  'authority_reference_id',
  'deal_identity_authority_attestation_id',
];
const SEED_KEYS = [
  'kind',
  'authority',
  'value',
];

class DealIdentityError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'DealIdentityError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new DealIdentityError(code, message, details);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('INVALID_DEAL_IDENTITY', `${label} must be an object.`, { label });
  }
}

function requireExactKeys(value, expected, label) {
  requireObject(value, label);
  if (canonicalJson(Object.keys(value).sort()) !== canonicalJson([...expected].sort())) {
    fail('INVALID_DEAL_IDENTITY', `${label} fields do not match the closed contract.`, {
      label,
    });
  }
}

function requireDigest(value, label) {
  if (!SHA256_RE.test(value || '')) {
    fail('INVALID_DEAL_IDENTITY', `${label} must be a SHA-256 content ID.`, { label });
  }
  return value;
}

function requireBoundedText(value, label, maximumBytes) {
  if (typeof value !== 'string'
    || !value
    || value !== value.trim()
    || /[\u0000-\u001f\u007f]/.test(value)
    || Buffer.byteLength(value, 'utf8') > maximumBytes) {
    fail(
      'INVALID_DEAL_IDENTITY',
      `${label} must be trimmed, non-empty text of at most ${maximumBytes} UTF-8 bytes.`,
      { label },
    );
  }
  return value;
}

function rejectLocatorAuthority(authority) {
  const label = authority.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
  if (/(?:^|_)APPLICATION_(?:DATABASE|DB)(?:_|$)/.test(label)
    || /(?:^|_)SOURCE_LOCATOR(?:_|$)/.test(label)) {
    fail(
      'PROHIBITED_DEAL_IDENTITY_AUTHORITY',
      'Application database and source locator labels cannot govern deal identity.',
      { authority },
    );
  }
}

function validateSeed(seed) {
  requireExactKeys(seed, SEED_KEYS, 'immutable_deal_seed');
  if (!SEED_KINDS.has(seed.kind)) {
    fail('INVALID_DEAL_IDENTITY', 'immutable_deal_seed.kind is not governed.', {
      kind: seed.kind,
    });
  }
  const authority = requireBoundedText(seed.authority, 'immutable_deal_seed.authority', 160);
  const value = requireBoundedText(seed.value, 'immutable_deal_seed.value', 512);
  rejectLocatorAuthority(authority);
  if (seed.kind === 'BEN_APPROVED_IMPORT_IDENTITY' && UUID_RE.test(value)) {
    fail(
      'PROHIBITED_DEAL_IDENTITY_VALUE',
      'A Ben-approved import identity cannot be an environment-allocated UUID.',
      { value },
    );
  }
  return {
    kind: seed.kind,
    authority,
    value,
  };
}

function canonicalSupersessionReferences(values) {
  if (!Array.isArray(values)) {
    fail(
      'INVALID_DEAL_IDENTITY',
      'reviewed_supersession_reference_ids must be an array.',
    );
  }
  const selected = values.map((value, index) => (
    requireDigest(value, `reviewed_supersession_reference_ids[${index}]`)
  )).sort();
  if (new Set(selected).size !== selected.length) {
    fail(
      'DUPLICATE_DEAL_IDENTITY_SUPERSESSION',
      'reviewed_supersession_reference_ids contains a duplicate identity.',
    );
  }
  return selected;
}

function governedDealKey(immutableDealSeed) {
  return contentId('GOVERNED_DEAL_KEY/V1', {
    deal_identity_schema_version: IDENTITY_SCHEMA_VERSION,
    immutable_deal_seed: immutableDealSeed,
  });
}

function buildDealIdentityManifest({
  immutable_deal_seed,
  reviewed_supersession_reference_ids = [],
} = {}) {
  const seed = validateSeed(immutable_deal_seed);
  const references = canonicalSupersessionReferences(reviewed_supersession_reference_ids);
  const body = {
    schema_version: MANIFEST_SCHEMA_VERSION,
    deal_identity_schema_version: IDENTITY_SCHEMA_VERSION,
    immutable_deal_seed: seed,
    governed_deal_key: governedDealKey(seed),
    reviewed_supersession_reference_ids: references,
  };
  return deepFreeze({
    ...body,
    deal_identity_manifest_id: contentId('GOVERNED_DEAL_IDENTITY_MANIFEST/V1', body),
  });
}

function validateDealIdentityManifest(manifest) {
  requireExactKeys(manifest, MANIFEST_KEYS, 'deal identity manifest');
  const rebuilt = buildDealIdentityManifest({
    immutable_deal_seed: manifest.immutable_deal_seed,
    reviewed_supersession_reference_ids:
      manifest.reviewed_supersession_reference_ids,
  });
  if (canonicalJson(rebuilt) !== canonicalJson(manifest)) {
    fail(
      'STALE_DEAL_IDENTITY',
      'Deal identity manifest content or content-addressed identity is stale.',
    );
  }
  return true;
}

function buildDealIdentityAuthorityAttestation({
  deal_identity_manifest,
  authority_reference_id,
} = {}) {
  validateDealIdentityManifest(deal_identity_manifest);
  const body = {
    schema_version: AUTHORITY_ATTESTATION_SCHEMA_VERSION,
    deal_identity_manifest_id: deal_identity_manifest.deal_identity_manifest_id,
    governed_deal_key: deal_identity_manifest.governed_deal_key,
    immutable_deal_seed: deal_identity_manifest.immutable_deal_seed,
    authority_reference_id: requireDigest(
      authority_reference_id,
      'authority_reference_id',
    ),
  };
  return deepFreeze({
    ...body,
    deal_identity_authority_attestation_id: contentId(
      AUTHORITY_ATTESTATION_SCHEMA_VERSION,
      body,
    ),
  });
}

function validateDealIdentityAuthorityAttestation({
  attestation,
  deal_identity_manifest,
} = {}) {
  requireExactKeys(
    attestation,
    AUTHORITY_ATTESTATION_KEYS,
    'deal identity authority attestation',
  );
  const rebuilt = buildDealIdentityAuthorityAttestation({
    deal_identity_manifest,
    authority_reference_id: attestation.authority_reference_id,
  });
  if (canonicalJson(rebuilt) !== canonicalJson(attestation)) {
    fail(
      'STALE_DEAL_IDENTITY_AUTHORITY',
      'Deal identity authority attestation does not match its governed identity.',
    );
  }
  return true;
}

module.exports = {
  AUTHORITY_ATTESTATION_SCHEMA_VERSION,
  DealIdentityError,
  IDENTITY_SCHEMA_VERSION,
  MANIFEST_SCHEMA_VERSION,
  buildDealIdentityAuthorityAttestation,
  buildDealIdentityManifest,
  validateDealIdentityAuthorityAttestation,
  validateDealIdentityManifest,
};
