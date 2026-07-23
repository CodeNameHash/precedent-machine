const {
  canonicalJson,
  contentId,
  sha256Hex,
  utf8Slice,
} = require('./canonical-bytes');
const { compileFixtureContract, compileFixtureContractV2 } = require('./contract-bundle');

const SHA256_RE = /^[a-f0-9]{64}$/;
const FIXTURE_CONTRACT = compileFixtureContract();
// SPEC-VERSIONED-CONTRACT-2026-07-23: this builder has no per-call visibility
// into which contract version governs a given provision (the harness and
// every reviewed-*-slice.js oracle call it without threading a contractBundle
// through), so its concept/component allowlists are the UNION of every
// currently-supported version's frozen vocabulary, not just the default (V1).
// A key absent from every known version is still rejected.
const FIXTURE_CONTRACT_V2 = compileFixtureContractV2();
const FIXTURE_CONCEPT_KEYS = new Set([
  ...FIXTURE_CONTRACT.concepts.map((entry) => entry.concept_key),
  ...FIXTURE_CONTRACT_V2.concepts.map((entry) => entry.concept_key),
]);
const FIXTURE_COMPONENT_KEYS = new Set(
  FIXTURE_CONTRACT.component_definitions.map((entry) => entry.component_key),
);

const FIXTURE_EXCERPT_DEFINITION_BODY = Object.freeze({
  schema_version: 'EXCERPT_DEFINITION/V1',
  excerpt_definition_key: 'SINGLE_OPERATIVE_SPAN',
  excerpt_definition_version: 1,
  component_slots: Object.freeze([Object.freeze({
    component_slot_key: 'PRIMARY',
    governed_slot_ordinal: 0,
    cardinality: 'EXACTLY_ONE',
  })]),
  excerpt_purpose: 'LEGAL_EVIDENCE',
  transformation_or_redaction_version: 'IDENTITY_UTF8/V1',
});

const FIXTURE_EXCERPT_DEFINITION = Object.freeze({
  ...FIXTURE_EXCERPT_DEFINITION_BODY,
  excerpt_definition_id: contentId('EXCERPT_DEFINITION/V1', FIXTURE_EXCERPT_DEFINITION_BODY),
  excerpt_definition_payload_digest: contentId(
    'EXCERPT_DEFINITION_PAYLOAD/V1',
    FIXTURE_EXCERPT_DEFINITION_BODY,
  ),
});

function assertDigest(value, label) {
  if (!SHA256_RE.test(value || '')) throw new TypeError(`${label} must be a full SHA-256 hex digest`);
}

function sourceBytesBuffer(value) {
  if (Buffer.isBuffer(value)) return Buffer.from(value);
  if (value instanceof Uint8Array) return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  if (typeof value === 'string') return Buffer.from(value, 'utf8');
  throw new TypeError('sourceBytes must be a string, Buffer or Uint8Array');
}

function decodeUtf8(bytes) {
  const text = bytes.toString('utf8');
  if (!Buffer.from(text, 'utf8').equals(bytes)) throw new TypeError('sourceBytes must be valid UTF-8');
  return text;
}

function buildImmutableSource({
  sourceBytes,
  sourceKind = 'PLAIN_UTF8',
  sourceOccurrenceKey = 'FIXTURE_SOURCE_OCCURRENCE',
  converterExecutableDigest = sha256Hex('IDENTITY_UTF8_CONVERTER/V1'),
  converterConfigurationDigest = sha256Hex('IDENTITY_UTF8_CONVERTER_CONFIG/V1'),
} = {}) {
  if (typeof sourceKind !== 'string' || !sourceKind) throw new TypeError('sourceKind is required');
  if (typeof sourceOccurrenceKey !== 'string' || !sourceOccurrenceKey) throw new TypeError('sourceOccurrenceKey is required');
  assertDigest(converterExecutableDigest, 'converterExecutableDigest');
  assertDigest(converterConfigurationDigest, 'converterConfigurationDigest');

  const bytes = sourceBytesBuffer(sourceBytes);
  const text = decodeUtf8(bytes);
  const documentHash = sha256Hex(bytes);
  const sourceContentId = contentId('SOURCE_CONTENT/V1', {
    source_kind: sourceKind,
    byte_length: bytes.length,
    exact_bytes_sha256: documentHash,
  });
  const sourceOccurrenceId = contentId('SOURCE_OCCURRENCE/V1', {
    source_content_id: sourceContentId,
    source_occurrence_key: sourceOccurrenceKey,
  });
  const sourceMapDigest = contentId('SOURCE_MAP/V1', {
    mapping_kind: 'IDENTITY_UTF8_BYTES',
    source_content_id: sourceContentId,
    byte_length: bytes.length,
  });
  const canonicalTextPayload = {
    schema_version: 'CANONICAL_TEXT/V1',
    source_content_id: sourceContentId,
    converter_executable_digest: converterExecutableDigest,
    converter_configuration_digest: converterConfigurationDigest,
    source_map_digest: sourceMapDigest,
    utf8_byte_length: bytes.length,
    text_sha256: documentHash,
  };
  const canonicalTextId = contentId('CANONICAL_TEXT/V1', canonicalTextPayload);
  const immutablePayload = {
    schema_version: 'IMMUTABLE_SOURCE_DOCUMENT/V1',
    source_content_id: sourceContentId,
    source_occurrence_id: sourceOccurrenceId,
    source_occurrence_key: sourceOccurrenceKey,
    source_kind: sourceKind,
    document_hash: documentHash,
    source_byte_length: bytes.length,
    canonical_text_id: canonicalTextId,
    canonical_text_payload_digest: contentId('CANONICAL_TEXT_PAYLOAD/V1', canonicalTextPayload),
    converter_executable_digest: converterExecutableDigest,
    converter_configuration_digest: converterConfigurationDigest,
    source_map_digest: sourceMapDigest,
  };

  return Object.freeze({
    ...immutablePayload,
    immutable_source_document_id: contentId('IMMUTABLE_SOURCE_DOCUMENT/V1', immutablePayload),
    source_bytes_base64: bytes.toString('base64'),
    canonical_text: Object.freeze({
      ...canonicalTextPayload,
      canonical_text_id: canonicalTextId,
      text,
    }),
    converter: Object.freeze({
      executable_digest: converterExecutableDigest,
      configuration_digest: converterConfigurationDigest,
    }),
  });
}

function validateImmutableSource(source) {
  if (!source || source.schema_version !== 'IMMUTABLE_SOURCE_DOCUMENT/V1') {
    throw new TypeError('invalid immutable source document');
  }
  const expected = buildImmutableSource({
    sourceBytes: Buffer.from(source.source_bytes_base64 || '', 'base64'),
    sourceKind: source.source_kind,
    sourceOccurrenceKey: source.source_occurrence_key,
    converterExecutableDigest: source.converter_executable_digest,
    converterConfigurationDigest: source.converter_configuration_digest,
  });
  if (canonicalJson(source) !== canonicalJson(expected)) {
    throw new TypeError('immutable source identity or exact bytes mismatch');
  }
  return true;
}

function spanArguments(sourceOrArgs, start, end) {
  if (sourceOrArgs && sourceOrArgs.source) {
    return { source: sourceOrArgs.source, start: sourceOrArgs.start, end: sourceOrArgs.end };
  }
  return { source: sourceOrArgs, start, end };
}

function buildSemanticSpan(sourceOrArgs, start, end) {
  const args = spanArguments(sourceOrArgs, start, end);
  const source = args.source;
  if (!source || !source.canonical_text || typeof source.canonical_text.text !== 'string') {
    throw new TypeError('a built immutable source is required');
  }
  assertDigest(source.canonical_text_id, 'canonical_text_id');
  const exactText = utf8Slice(source.canonical_text.text, args.start, args.end);
  const payload = {
    schema_version: 'SEMANTIC_SPAN/V1',
    canonical_text_id: source.canonical_text_id,
    absolute_start: args.start,
    absolute_end: args.end,
  };
  return Object.freeze({
    ...payload,
    semantic_span_id: contentId('SEMANTIC_SPAN/V1', payload),
    exact_bytes_digest: sha256Hex(Buffer.from(exactText, 'utf8')),
  });
}

function buildExcerpt({ source, span, definition = FIXTURE_EXCERPT_DEFINITION } = {}) {
  if (!source || !source.immutable_source_document_id) throw new TypeError('source is required');
  assertSpanForSource(source, span);
  if (canonicalJson(definition) !== canonicalJson(FIXTURE_EXCERPT_DEFINITION)) {
    throw new TypeError('excerpt definition is outside the frozen fixture contract');
  }
  const exactText = utf8Slice(source.canonical_text.text, span.absolute_start, span.absolute_end);
  const orderedComponentAssignments = [{
    component_slot_key: 'PRIMARY',
    governed_slot_ordinal: 0,
    semantic_span_id: span.semantic_span_id,
  }];
  const identity = {
    excerpt_definition_key: definition.excerpt_definition_key,
    excerpt_definition_version: definition.excerpt_definition_version,
    excerpt_definition_payload_digest: definition.excerpt_definition_payload_digest,
    ordered_component_assignments: orderedComponentAssignments,
    excerpt_purpose: definition.excerpt_purpose,
    transformation_or_redaction_version: definition.transformation_or_redaction_version,
    output_text_hash: sha256Hex(Buffer.from(exactText, 'utf8')),
  };
  return Object.freeze({
    schema_version: 'EXCERPT/V1',
    excerpt_id: contentId('EXCERPT/V1', identity),
    excerpt_definition_id: definition.excerpt_definition_id,
    ...identity,
    source_content_id: source.source_content_id,
    source_occurrence_id: source.source_occurrence_id,
    canonical_text_id: source.canonical_text_id,
    document_hash: source.document_hash,
    absolute_start: span.absolute_start,
    absolute_end: span.absolute_end,
    exact_bytes_digest: span.exact_bytes_digest,
    exact_text: exactText,
  });
}

function validateExcerpt({ source, excerpt, definition = FIXTURE_EXCERPT_DEFINITION } = {}) {
  if (!excerpt || excerpt.schema_version !== 'EXCERPT/V1') throw new TypeError('invalid fixture excerpt');
  const assignments = excerpt.ordered_component_assignments;
  if (!Array.isArray(assignments) || assignments.length !== 1) throw new TypeError('fixture excerpt requires one component assignment');
  const span = buildSemanticSpan(source, excerpt.absolute_start, excerpt.absolute_end);
  const expected = buildExcerpt({ source, span, definition });
  const candidate = Object.fromEntries(Object.keys(expected).map((key) => [key, excerpt[key]]));
  if (canonicalJson(candidate) !== canonicalJson(expected)
    || Object.keys(excerpt).some((key) => !Object.hasOwn(expected, key) && key !== 'closure_id')) {
    throw new TypeError('excerpt identity or exact source bytes do not match');
  }
  return true;
}

function buildFixtureSourceAdmission({
  source,
  dealKey,
  dealAdmissionId,
  contractFingerprint,
  sourceOrdinal = 0,
} = {}) {
  if (!source || !source.immutable_source_document_id) throw new TypeError('source is required');
  if (typeof dealKey !== 'string' || !dealKey.trim()) throw new TypeError('dealKey is required');
  assertDigest(dealAdmissionId, 'dealAdmissionId');
  assertDigest(contractFingerprint, 'contractFingerprint');
  if (!Number.isInteger(sourceOrdinal) || sourceOrdinal < 0) throw new TypeError('sourceOrdinal must be a non-negative integer');
  const payload = {
    schema_version: 'SOURCE_ADMISSION_MANIFEST/V1',
    governed_deal_key: dealKey.trim(),
    deal_admission_id: dealAdmissionId,
    source_ordinal: sourceOrdinal,
    immutable_source_document_id: source.immutable_source_document_id,
    source_content_id: source.source_content_id,
    source_occurrence_id: source.source_occurrence_id,
    canonical_text_id: source.canonical_text_id,
    document_hash: source.document_hash,
    source_byte_length: source.source_byte_length,
    contract_fingerprint: contractFingerprint,
  };
  return Object.freeze({
    ...payload,
    source_admission_manifest_id: contentId('SOURCE_ADMISSION_MANIFEST/V1', payload),
    canonical_payload_digest: contentId('SOURCE_ADMISSION_MANIFEST_PAYLOAD/V1', payload),
  });
}

function validateFixtureSourceAdmission({
  source,
  admission,
  dealKey,
  dealAdmissionId,
  contractFingerprint,
} = {}) {
  const expected = buildFixtureSourceAdmission({
    source,
    dealKey,
    dealAdmissionId,
    contractFingerprint,
    sourceOrdinal: admission && admission.source_ordinal,
  });
  if (canonicalJson(admission) !== canonicalJson(expected)) throw new TypeError('source admission identity or lineage mismatch');
  return true;
}

function assertParty(party) {
  if (!party || typeof party !== 'object' || Array.isArray(party)) throw new TypeError('party must be an object');
  const keys = Object.keys(party).sort();
  if (keys.join(',') !== 'capacity,role,value') throw new Error('party must contain exactly role, value and capacity');
  for (const key of ['role', 'value', 'capacity']) {
    if (typeof party[key] !== 'string' || !party[key]) throw new TypeError(`party.${key} is required`);
  }
}

function assertOrdinal(ordinal) {
  if (!Number.isInteger(ordinal) || ordinal < 1) throw new TypeError('ordinal must be a positive integer');
}

function assertSpanForSource(source, span) {
  if (!span || span.canonical_text_id !== source.canonical_text_id) {
    throw new Error('span does not belong to the immutable source canonical text');
  }
  const exactText = utf8Slice(source.canonical_text.text, span.absolute_start, span.absolute_end);
  const payload = {
    schema_version: 'SEMANTIC_SPAN/V1',
    canonical_text_id: source.canonical_text_id,
    absolute_start: span.absolute_start,
    absolute_end: span.absolute_end,
  };
  if (span.semantic_span_id !== contentId('SEMANTIC_SPAN/V1', payload)
    || span.exact_bytes_digest !== sha256Hex(Buffer.from(exactText, 'utf8'))) {
    throw new Error('span identity does not match its exact source bytes');
  }
}

function buildProvisionInstance({ source, span, conceptKey, party, ordinal } = {}) {
  if (!source || !source.immutable_source_document_id) throw new TypeError('source is required');
  assertSpanForSource(source, span);
  if (!FIXTURE_CONCEPT_KEYS.has(conceptKey)) throw new Error(`conceptKey is outside the frozen fixture contract: ${conceptKey}`);
  assertParty(party);
  assertOrdinal(ordinal);
  const payload = {
    schema_version: 'PROVISION_INSTANCE/V1',
    source_occurrence_id: source.source_occurrence_id,
    canonical_text_id: source.canonical_text_id,
    document_hash: source.document_hash,
    absolute_start: span.absolute_start,
    absolute_end: span.absolute_end,
    concept_key: conceptKey,
    party: { role: party.role, value: party.value, capacity: party.capacity },
    ordinal,
  };
  return Object.freeze({
    ...payload,
    source_anchor_id: span.semantic_span_id,
    provision_instance_id: contentId('PROVISION_INSTANCE/V1', payload),
  });
}

function buildProvisionComponent({ source, parentProvision, span, componentKey, ordinal } = {}) {
  if (!source || !source.immutable_source_document_id) throw new TypeError('source is required');
  if (!parentProvision || !parentProvision.provision_instance_id) throw new TypeError('parentProvision is required');
  assertSpanForSource(source, span);
  if (parentProvision.canonical_text_id !== source.canonical_text_id) throw new Error('parent provision belongs to another canonical text');
  if (span.absolute_start < parentProvision.absolute_start || span.absolute_end > parentProvision.absolute_end) {
    throw new Error('component span must be contained by its parent provision');
  }
  if (typeof componentKey !== 'string' || !componentKey) throw new TypeError('componentKey is required');
  if (!FIXTURE_COMPONENT_KEYS.has(componentKey)) {
    throw new Error(`componentKey is outside the frozen fixture contract: ${componentKey}`);
  }
  assertOrdinal(ordinal);
  const payload = {
    schema_version: 'PROVISION_COMPONENT/V1',
    parent_provision_instance_id: parentProvision.provision_instance_id,
    canonical_text_id: source.canonical_text_id,
    absolute_start: span.absolute_start,
    absolute_end: span.absolute_end,
    component_key: componentKey,
    ordinal,
  };
  return Object.freeze({
    ...payload,
    source_anchor_id: span.semantic_span_id,
    provision_component_id: contentId('PROVISION_COMPONENT/V1', payload),
  });
}

module.exports = {
  FIXTURE_EXCERPT_DEFINITION,
  buildExcerpt,
  buildFixtureSourceAdmission,
  buildImmutableSource,
  buildSemanticSpan,
  buildProvisionInstance,
  buildProvisionComponent,
  validateImmutableSource,
  validateExcerpt,
  validateFixtureSourceAdmission,
};
