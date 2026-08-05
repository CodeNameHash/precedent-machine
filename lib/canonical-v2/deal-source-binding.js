const { canonicalJson, contentId, sha256Hex } = require('./canonical-bytes');
const {
  validateV2DealIdentityAuthorityEvidence,
} = require('./governed-identity-proposal-packet');
const { requireIssuedIdentityConsumerEvidence } = require('./deal-identity-allocation-readiness');
const { validateVerifiedSecSourceAdmission } = require('./sec-source-admission');

const DIGEST_RE = /^[a-f0-9]{64}$/;
const ROLE_KEY_RE = /^[A-Z][A-Z0-9_]{1,63}$/;
const ACCESSION_RE = /^[0-9]{10}-[0-9]{2}-[0-9]{6}$/;
const ROLE_SCHEMA = 'DOCUMENT_ROLE_DEFINITION/V1';
const ROLE_REGISTRY_SCHEMA = 'DOCUMENT_ROLE_REGISTRY/V1';
const ROLE_REGISTRY_AUTHORITY_SCHEMA = 'DOCUMENT_ROLE_REGISTRY_AUTHORITY/V1';
const ORDERING_SCHEMA = 'DEAL_SOURCE_ORDERING_DEFINITION/V1';
const EVIDENCE_SCHEMA = 'DEAL_SOURCE_ROLE_EVIDENCE/V1';
const BINDING_SCHEMA = 'DEAL_SOURCE_BINDING/V2';
const COMPARATOR_FIELDS = Object.freeze([
  'source_system',
  'issuer_cik',
  'accession',
  'source_version',
  'exhibit_path',
  'retrieval_url_sha256',
]);
const LOCATOR_FIELDS = Object.freeze([
  ...COMPARATOR_FIELDS,
  'source_admission_manifest_id',
]);
const ROLE_KEYS = Object.freeze([
  'schema_version',
  'document_role_key',
  'definition_version',
  'contract_fingerprint',
  'definition_text',
  'required_text_anchors',
  'document_role_definition_id',
]);
const ORDERING_KEYS = Object.freeze([
  'schema_version',
  'definition_version',
  'ordinal_base',
  'comparator_fields',
  'deal_source_ordering_definition_id',
]);
const ROLE_REGISTRY_KEYS = Object.freeze([
  'schema_version',
  'contract_fingerprint',
  'document_role_definitions',
  'document_role_registry_id',
]);
const ROLE_REGISTRY_AUTHORITY_KEYS = Object.freeze([
  'schema_version',
  'document_role_registry_id',
  'contract_fingerprint',
  'freeze_gate_attestation_id',
  'ben_approval_id',
  'authority_status',
  'document_role_registry_authority_id',
]);
const EVIDENCE_KEYS = Object.freeze([
  'schema_version',
  'canonical_text_id',
  'start',
  'end',
  'text_sha256',
  'role_evidence_id',
]);
const BINDING_KEYS = Object.freeze([
  'schema_version',
  'deal_identity_manifest_id',
  'deal_identity_authority_kind',
  'deal_identity_authority_status',
  'governed_deal_key',
  'source_system',
  'issuer_cik',
  'accession',
  'exhibit_path',
  'source_version',
  'retrieval_url_sha256',
  'source_response_content_id',
  'intake_capture_receipt_id',
  'immutable_source_document_id',
  'document_hash',
  'source_admission_manifest_id',
  'source_admission_preparation_receipt_id',
  'semantic_extraction_input_envelope_id',
  'canonical_text_id',
  'canonical_text_sha256',
  'verification_manifest_id',
  'document_role_key',
  'document_role_definition_id',
  'document_role_registry_id',
  'document_role_registry_authority_id',
  'role_evidence',
  'deal_source_ordering_definition_id',
  'source_ordinal',
  'source_ordinal_status',
  'document_universe_status',
  'deal_wide_absence_status',
  'deal_source_binding_id',
]);
const BUILD_INPUT_KEYS = Object.freeze([
  'governed_deal_identity_evidence',
  'capture',
  'conversion',
  'verification',
  'source_admission_bundle',
  'source_locator',
  'document_role_registry',
  'document_role_registry_authority',
  'document_role_key',
  'role_evidence_spans',
  'ordering_definition',
]);

class DealSourceBindingError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'DealSourceBindingError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new DealSourceBindingError(code, message);
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function plain(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value, keys, label) {
  if (!plain(value)
    || canonicalJson(Object.keys(value).sort()) !== canonicalJson([...keys].sort())) {
    fail('INVALID_DEAL_SOURCE_BINDING', `${label} does not match its closed contract.`);
  }
}

function digest(value, label) {
  if (!DIGEST_RE.test(value || '')) {
    fail('INVALID_DEAL_SOURCE_BINDING', `${label} must be a SHA-256 content ID.`);
  }
  return value;
}

function text(value, label, maximum = 512) {
  if (typeof value !== 'string'
    || !value
    || value !== value.trim()
    || /[\u0000-\u001f\u007f]/.test(value)
    || Buffer.byteLength(value, 'utf8') > maximum) {
    fail('INVALID_DEAL_SOURCE_BINDING', `${label} must be bounded, trimmed text.`);
  }
  return value;
}

function identified(domain, idKey, body) {
  return freeze({ ...body, [idKey]: contentId(domain, body) });
}

function buildDocumentRoleDefinition({
  document_role_key,
  definition_version,
  contract_fingerprint,
  definition_text,
  required_text_anchors,
} = {}) {
  if (!ROLE_KEY_RE.test(document_role_key || '')
    || !Number.isInteger(definition_version)
    || definition_version < 1
    || definition_version > 1_000
    || !Array.isArray(required_text_anchors)
    || required_text_anchors.length < 1
    || required_text_anchors.length > 8) {
    fail('INVALID_DOCUMENT_ROLE_DEFINITION', 'Document role definition is invalid.');
  }
  const anchors = required_text_anchors.map((anchor, index) => (
    text(anchor, `required_text_anchors[${index}]`, 160)
  )).sort();
  if (new Set(anchors).size !== anchors.length) {
    fail('INVALID_DOCUMENT_ROLE_DEFINITION', 'Document role anchors must be unique.');
  }
  const body = {
    schema_version: ROLE_SCHEMA,
    document_role_key,
    definition_version,
    contract_fingerprint: digest(contract_fingerprint, 'contract_fingerprint'),
    definition_text: text(definition_text, 'definition_text', 1_024),
    required_text_anchors: anchors,
  };
  return identified(ROLE_SCHEMA, 'document_role_definition_id', body);
}

function validateDocumentRoleDefinition(definition) {
  exactKeys(definition, ROLE_KEYS, 'document role definition');
  const expected = buildDocumentRoleDefinition(definition);
  if (canonicalJson(expected) !== canonicalJson(definition)) {
    fail('STALE_DOCUMENT_ROLE_DEFINITION', 'Document role definition identity is stale.');
  }
  return true;
}

function buildDocumentRoleRegistry({
  contract_fingerprint,
  document_role_definitions,
} = {}) {
  digest(contract_fingerprint, 'contract_fingerprint');
  if (!Array.isArray(document_role_definitions)
    || document_role_definitions.length < 1
    || document_role_definitions.length > 128) {
    fail('INVALID_DOCUMENT_ROLE_REGISTRY', 'Document role registry is invalid.');
  }
  const definitions = document_role_definitions.map((definition) => {
    validateDocumentRoleDefinition(definition);
    if (definition.contract_fingerprint !== contract_fingerprint) {
      fail('INVALID_DOCUMENT_ROLE_REGISTRY', 'Role definition contract fingerprint drifted.');
    }
    return definition;
  }).sort((left, right) => Buffer.compare(
    Buffer.from(canonicalJson([
      left.document_role_key,
      left.definition_version,
      left.document_role_definition_id,
    ]), 'utf8'),
    Buffer.from(canonicalJson([
      right.document_role_key,
      right.definition_version,
      right.document_role_definition_id,
    ]), 'utf8'),
  ));
  const keys = definitions.map((definition) => definition.document_role_key);
  if (new Set(keys).size !== keys.length) {
    fail('INVALID_DOCUMENT_ROLE_REGISTRY', 'Document role registry contains a duplicate key.');
  }
  return identified(ROLE_REGISTRY_SCHEMA, 'document_role_registry_id', {
    schema_version: ROLE_REGISTRY_SCHEMA,
    contract_fingerprint,
    document_role_definitions: definitions,
  });
}

function validateDocumentRoleRegistry(registry) {
  exactKeys(registry, ROLE_REGISTRY_KEYS, 'document role registry');
  const expected = buildDocumentRoleRegistry(registry);
  if (canonicalJson(expected) !== canonicalJson(registry)) {
    fail('STALE_DOCUMENT_ROLE_REGISTRY', 'Document role registry identity is stale.');
  }
  return true;
}

function buildDocumentRoleRegistryAuthority({
  document_role_registry,
  freeze_gate_attestation_id,
  ben_approval_id,
} = {}) {
  validateDocumentRoleRegistry(document_role_registry);
  const body = {
    schema_version: ROLE_REGISTRY_AUTHORITY_SCHEMA,
    document_role_registry_id: document_role_registry.document_role_registry_id,
    contract_fingerprint: document_role_registry.contract_fingerprint,
    freeze_gate_attestation_id: digest(
      freeze_gate_attestation_id,
      'freeze_gate_attestation_id',
    ),
    ben_approval_id: digest(ben_approval_id, 'ben_approval_id'),
    authority_status: 'APPROVED',
  };
  return identified(
    ROLE_REGISTRY_AUTHORITY_SCHEMA,
    'document_role_registry_authority_id',
    body,
  );
}

function validateDocumentRoleRegistryAuthority({
  authority,
  document_role_registry,
} = {}) {
  exactKeys(authority, ROLE_REGISTRY_AUTHORITY_KEYS, 'document role registry authority');
  const expected = buildDocumentRoleRegistryAuthority({
    document_role_registry,
    freeze_gate_attestation_id: authority.freeze_gate_attestation_id,
    ben_approval_id: authority.ben_approval_id,
  });
  if (canonicalJson(expected) !== canonicalJson(authority)) {
    fail(
      'STALE_DOCUMENT_ROLE_REGISTRY_AUTHORITY',
      'Document role registry authority does not match the frozen registry.',
    );
  }
  return true;
}

function buildDealSourceOrderingDefinition({ definition_version } = {}) {
  if (!Number.isInteger(definition_version)
    || definition_version < 1
    || definition_version > 1_000) {
    fail('INVALID_DEAL_SOURCE_ORDERING', 'Ordering definition version is invalid.');
  }
  const body = {
    schema_version: ORDERING_SCHEMA,
    definition_version,
    ordinal_base: 1,
    comparator_fields: [...COMPARATOR_FIELDS],
  };
  return identified(ORDERING_SCHEMA, 'deal_source_ordering_definition_id', body);
}

function validateDealSourceOrderingDefinition(definition) {
  exactKeys(definition, ORDERING_KEYS, 'deal source ordering definition');
  const expected = buildDealSourceOrderingDefinition(definition);
  if (canonicalJson(expected) !== canonicalJson(definition)) {
    fail('STALE_DEAL_SOURCE_ORDERING', 'Deal source ordering definition is stale.');
  }
  return true;
}

function locator(value, label) {
  exactKeys(value, LOCATOR_FIELDS, label);
  if (value.source_system !== 'SEC_EDGAR'
    || !/^[1-9][0-9]{0,9}$/.test(value.issuer_cik || '')
    || !ACCESSION_RE.test(value.accession || '')
    || typeof value.exhibit_path !== 'string'
    || !/^[A-Za-z0-9._-]{1,160}$/.test(value.exhibit_path)
    || (value.source_version !== null
      && (typeof value.source_version !== 'string'
        || !value.source_version
        || value.source_version !== value.source_version.trim()
        || Buffer.byteLength(value.source_version, 'utf8') > 80))) {
    fail('INVALID_DEAL_SOURCE_LOCATOR', `${label} is not an immutable SEC locator.`);
  }
  digest(value.source_admission_manifest_id, `${label}.source_admission_manifest_id`);
  digest(value.retrieval_url_sha256, `${label}.retrieval_url_sha256`);
  return {
    source_system: value.source_system,
    issuer_cik: value.issuer_cik,
    accession: value.accession,
    source_version: value.source_version,
    exhibit_path: value.exhibit_path,
    retrieval_url_sha256: value.retrieval_url_sha256,
    source_admission_manifest_id: value.source_admission_manifest_id,
  };
}

function buildRoleEvidence(conversion, spans, roleDefinition) {
  if (!Array.isArray(spans) || spans.length < 1 || spans.length > 16) {
    fail('INVALID_ROLE_EVIDENCE', 'Role evidence must be a bounded non-empty array.');
  }
  const canonicalBytes = Buffer.from(conversion.canonical_text, 'utf8');
  let priorEnd = -1;
  const evidenceText = [];
  const evidence = spans.map((span, index) => {
    exactKeys(span, ['start', 'end', 'text_sha256'], `role_evidence_spans[${index}]`);
    if (!Number.isInteger(span.start)
      || !Number.isInteger(span.end)
      || span.start < 0
      || span.end <= span.start
      || span.end > canonicalBytes.length
      || span.start < priorEnd) {
      fail('INVALID_ROLE_EVIDENCE', 'Role evidence offsets are invalid or unordered.');
    }
    digest(span.text_sha256, `role_evidence_spans[${index}].text_sha256`);
    const selected = canonicalBytes.subarray(span.start, span.end);
    const selectedText = selected.toString('utf8');
    if (Buffer.byteLength(selectedText, 'utf8') !== selected.length
      || sha256Hex(selected) !== span.text_sha256) {
      fail('ROLE_EVIDENCE_MISMATCH', 'Role evidence does not match canonical text bytes.');
    }
    priorEnd = span.end;
    evidenceText.push(selectedText);
    return identified(EVIDENCE_SCHEMA, 'role_evidence_id', {
      schema_version: EVIDENCE_SCHEMA,
      canonical_text_id: conversion.canonical_text_id,
      start: span.start,
      end: span.end,
      text_sha256: span.text_sha256,
    });
  });
  const combined = evidenceText.join('\n');
  if (roleDefinition.required_text_anchors.some((anchor) => !combined.includes(anchor))) {
    fail('ROLE_EVIDENCE_MISMATCH', 'Role evidence does not support the governed document role.');
  }
  return freeze(evidence);
}

function validateLocatorAgainstCapture(sourceLocator, capture) {
  const accessionPath = sourceLocator.accession.replaceAll('-', '');
  const expectedUrl = `https://www.sec.gov/Archives/edgar/data/${sourceLocator.issuer_cik}`
    + `/${accessionPath}/${sourceLocator.exhibit_path}`;
  if (capture.source_host !== 'www.sec.gov'
    || capture.retrieval_url_sha256 !== sourceLocator.retrieval_url_sha256
    || sha256Hex(Buffer.from(expectedUrl, 'utf8')) !== sourceLocator.retrieval_url_sha256) {
    fail('SOURCE_LOCATOR_MISMATCH', 'SEC locator does not match the admitted retrieval URL.');
  }
}

function validateV2SourceBindingIdentityEvidence(evidence) {
  const keys = [
    'approval_signature_evidence', 'approval_signing_request', 'deal_identity_manifest',
    'issued_allocation_receipt', 'issued_reviewed_bridge', 'production_deal_id',
  ];
  if (!plain(evidence) || canonicalJson(Object.keys(evidence).sort()) !== canonicalJson(keys)) {
    fail('V2_GOVERNED_DEAL_IDENTITY_REQUIRED', 'deal-source binding requires closed V2 signed approval or frozen issuer identity evidence.');
  }
  try {
    const authority = validateV2DealIdentityAuthorityEvidence({
      deal_identity_manifest: evidence.deal_identity_manifest,
      approval_signing_request: evidence.approval_signing_request,
      approval_signature_evidence: evidence.approval_signature_evidence,
    });
    requireIssuedIdentityConsumerEvidence({ allocation_receipt: evidence.issued_allocation_receipt, reviewed_bridge: evidence.issued_reviewed_bridge, production_deal_id: evidence.production_deal_id, governed_deal_key: authority.governed_deal_key, manifest_id: authority.deal_identity_manifest_id });
    return authority;
  } catch (error) {
    fail(error?.code || 'V2_GOVERNED_DEAL_IDENTITY_REQUIRED', error?.message || 'V2 deal identity evidence is invalid.');
  }
}

function buildDealSourceBinding(input = {}) {
  exactKeys(input, BUILD_INPUT_KEYS, 'deal source binding input');
  const {
    governed_deal_identity_evidence,
    capture,
    conversion,
    verification,
    source_admission_bundle,
    source_locator,
    document_role_registry,
    document_role_registry_authority,
    document_role_key,
    role_evidence_spans,
    ordering_definition,
  } = input;
  const dealIdentity = validateV2SourceBindingIdentityEvidence(governed_deal_identity_evidence);
  validateVerifiedSecSourceAdmission({
    capture,
    conversion,
    verification,
    bundle: source_admission_bundle,
  });
  validateDocumentRoleRegistry(document_role_registry);
  validateDocumentRoleRegistryAuthority({
    authority: document_role_registry_authority,
    document_role_registry,
  });
  validateDealSourceOrderingDefinition(ordering_definition);
  if (!ROLE_KEY_RE.test(document_role_key || '')) {
    fail('DOCUMENT_ROLE_NOT_GOVERNED', 'Document role selection is invalid.');
  }
  const matchingRoles = document_role_registry.document_role_definitions.filter(
    (definition) => definition.document_role_key === document_role_key,
  );
  if (matchingRoles.length !== 1) {
    fail('DOCUMENT_ROLE_NOT_GOVERNED', 'Document role is not in the frozen registry.');
  }
  const [documentRoleDefinition] = matchingRoles;
  const sourceLocator = locator(source_locator, 'source_locator');
  validateLocatorAgainstCapture(sourceLocator, capture);
  const admission = source_admission_bundle.source_admission_manifest;
  if (sourceLocator.source_admission_manifest_id !== admission.source_admission_manifest_id
    || source_admission_bundle.immutable_source_document.response_bytes_sha256
      === conversion.canonical_text_sha256) {
    fail('SOURCE_LINEAGE_MISMATCH', 'Source locator or raw/canonical identity is invalid.');
  }
  const roleEvidence = buildRoleEvidence(
    conversion,
    role_evidence_spans,
    documentRoleDefinition,
  );
  const immutable = source_admission_bundle.immutable_source_document;
  const receipt = source_admission_bundle.source_admission_preparation_receipt;
  const envelope = source_admission_bundle.semantic_extraction_input_envelope;
  const body = {
    schema_version: BINDING_SCHEMA,
    deal_identity_manifest_id: dealIdentity.deal_identity_manifest_id,
    deal_identity_authority_kind: dealIdentity.authority_kind,
    deal_identity_authority_status: dealIdentity.authority_status,
    governed_deal_key: dealIdentity.governed_deal_key,
    source_system: sourceLocator.source_system,
    issuer_cik: sourceLocator.issuer_cik,
    accession: sourceLocator.accession,
    exhibit_path: sourceLocator.exhibit_path,
    source_version: sourceLocator.source_version,
    retrieval_url_sha256: sourceLocator.retrieval_url_sha256,
    source_response_content_id: immutable.source_response_content_id,
    intake_capture_receipt_id: immutable.intake_capture_receipt_id,
    immutable_source_document_id: immutable.immutable_source_document_id,
    document_hash: immutable.response_bytes_sha256,
    source_admission_manifest_id: admission.source_admission_manifest_id,
    source_admission_preparation_receipt_id:
      receipt.source_admission_preparation_receipt_id,
    semantic_extraction_input_envelope_id:
      envelope.semantic_extraction_input_envelope_id,
    canonical_text_id: conversion.canonical_text_id,
    canonical_text_sha256: conversion.canonical_text_sha256,
    verification_manifest_id: verification.verification_manifest_id,
    document_role_key: documentRoleDefinition.document_role_key,
    document_role_definition_id:
      documentRoleDefinition.document_role_definition_id,
    document_role_registry_id: document_role_registry.document_role_registry_id,
    document_role_registry_authority_id:
      document_role_registry_authority.document_role_registry_authority_id,
    role_evidence: roleEvidence,
    deal_source_ordering_definition_id:
      ordering_definition.deal_source_ordering_definition_id,
    source_ordinal: null,
    source_ordinal_status: 'BLOCKED_PENDING_CERTIFIED_DOCUMENT_UNIVERSE',
    document_universe_status: 'NOT_CERTIFIED',
    deal_wide_absence_status: 'BLOCKED',
  };
  return identified(BINDING_SCHEMA, 'deal_source_binding_id', body);
}

function validateDealSourceBinding({ binding, ...inputs } = {}) {
  exactKeys(binding, BINDING_KEYS, 'deal source binding');
  const expected = buildDealSourceBinding(inputs);
  if (canonicalJson(expected) !== canonicalJson(binding)) {
    fail('STALE_DEAL_SOURCE_BINDING', 'Deal source binding identity or lineage is stale.');
  }
  return true;
}

module.exports = {
  BINDING_SCHEMA,
  DealSourceBindingError,
  buildDealSourceBinding,
  buildDealSourceOrderingDefinition,
  buildDocumentRoleDefinition,
  buildDocumentRoleRegistry,
  buildDocumentRoleRegistryAuthority,
  validateDealSourceBinding,
  validateV2SourceBindingIdentityEvidence,
  validateDealSourceOrderingDefinition,
  validateDocumentRoleDefinition,
  validateDocumentRoleRegistry,
  validateDocumentRoleRegistryAuthority,
};
