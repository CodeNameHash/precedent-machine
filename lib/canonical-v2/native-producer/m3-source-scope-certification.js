'use strict';

const {
  canonicalJson,
  contentId,
  sha256Hex,
  utf8ByteLength,
  utf8Slice,
} = require('../canonical-bytes');
const { buildAdmittedSourceReference } = require('../admitted-semantic-source');
const {
  SCHEMA_VERSION: SECTIONIZER_SCHEMA,
  sectionizeAdmittedSource,
} = require('./deterministic-sectionizer');
const { RUN_RECEIPT_SCHEMA } = require('./native-extraction-run');
const { RESOLUTION_RECEIPT_SCHEMA } = require('./candidate-resolution');

const CERTIFICATE_SCHEMA = 'M3_SOURCE_SCOPE_CERTIFICATE/V1';
const SET_SCHEMA = 'M3_SOURCE_SCOPE_CERTIFICATION_SET/V1';
const SECTION_TREE_SCHEMA = 'M3_SOURCE_SCOPE_SECTION_TREE/V1';
const INVENTORY_SCHEMA = 'M3_SOURCE_SCOPE_INVENTORY/V1';
const DISPOSITION_SCHEMA = 'M3_SOURCE_SCOPE_DISPOSITION/V1';
const EXECUTION_SCHEMA = 'M3_SOURCE_SCOPE_EXECUTION/V1';
const DIGEST_RE = /^[a-f0-9]{64}$/;
const DISPOSITIONS = new Set(['EXTRACTED', 'APPROVED_EXCLUDED', 'UNRESOLVED']);

const CERTIFICATE_KEYS = Object.freeze([
  'schema_version',
  'admitted_source_context',
  'admitted_source_reference',
  'section_tree_root_id',
  'inventory_root_id',
  'disposition_root_id',
  'execution_root_id',
  'run_receipt',
  'resolution_receipt',
  'atomic_units',
  'unresolved_unit_count',
  'certification_status',
  'm3_source_scope_certificate_id',
]);
const SET_KEYS = Object.freeze([
  'schema_version',
  'governed_deal_key',
  'deal_admission_id',
  'expected_source_occurrence_ids',
  'certificate_ids',
  'certificates',
  'certification_status',
  'm3_source_scope_certification_set_id',
]);

class M3SourceScopeCertificationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'M3SourceScopeCertificationError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new M3SourceScopeCertificationError(code, message);
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function plainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value, keys) {
  return plainObject(value)
    && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}

function requireDigest(value, label) {
  if (!DIGEST_RE.test(value || '')) fail('INVALID_DIGEST', `${label} must be a SHA-256 digest.`);
}

function requireNonEmptyString(value, label) {
  if (typeof value !== 'string' || !value.trim() || value.trim() !== value) {
    fail('INVALID_STRING', `${label} must be a non-empty trimmed string.`);
  }
}

function same(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function sourceBinding(context) {
  return {
    admitted_semantic_source_context_id: context.admitted_semantic_source_context_id,
    source_occurrence_id: context.source_occurrence_id,
    source_content_id: context.source_content_id,
    canonical_text_id: context.canonical_text_id,
    canonical_text_sha256: context.canonical_text_sha256,
    canonical_text_byte_length: context.canonical_text_byte_length,
    document_hash: context.document_hash,
  };
}

function validateContext(context) {
  try {
    buildAdmittedSourceReference(context);
  } catch (error) {
    fail('INVALID_ADMITTED_SOURCE_CONTEXT', error.message);
  }
  if (utf8ByteLength(context.canonical_text.text) !== context.canonical_text_byte_length
    || sha256Hex(context.canonical_text.text) !== context.canonical_text_sha256) {
    fail('CANONICAL_TEXT_MISMATCH', 'admitted source canonical text does not match its committed bytes.');
  }
  const canonicalTextId = contentId('SEC_CANONICAL_TEXT/V2', {
    source_response_content_id: context.source_content_id,
    converter_digest: context.converter_digest,
    converter_config_digest: context.converter_config_digest,
    canonical_text_sha256: context.canonical_text_sha256,
    canonical_text_byte_length: context.canonical_text_byte_length,
    source_map_digest: context.source_map_digest,
  });
  if (context.canonical_text_id !== canonicalTextId) {
    fail('CANONICAL_TEXT_IDENTITY_MISMATCH', 'admitted source canonical text identity does not match its lineage.');
  }
  return context;
}

function sectionTreeRoot(context, tree) {
  const nodes = [...tree.nodes].map((node) => ({ ...node }))
    .sort((left, right) => left.start - right.start
      || left.end - right.end
      || left.section_id.localeCompare(right.section_id));
  return {
    schema_version: SECTION_TREE_SCHEMA,
    sectionizer_schema_version: SECTIONIZER_SCHEMA,
    ...sourceBinding(context),
    root_section_id: tree.root_section_id,
    nodes,
    rejected_inline_heading_candidates: [...tree.rejected_inline_heading_candidates],
  };
}

function deriveSourceScopePartition({ admitted_source_context: context } = {}) {
  validateContext(context);
  const tree = sectionizeAdmittedSource({
    source_text: context.canonical_text.text,
    document_hash: context.document_hash,
  });
  const byteLength = context.canonical_text_byte_length;
  if (tree.schema_version !== SECTIONIZER_SCHEMA
    || tree.document_hash !== context.document_hash
    || tree.source_byte_length !== byteLength
    || tree.source_sha256 !== context.canonical_text_sha256
    || !Array.isArray(tree.nodes)
    || tree.nodes.length === 0) {
    fail('SECTION_TREE_MISMATCH', 'deterministic section tree does not bind the admitted canonical source.');
  }
  const root = tree.nodes.find((node) => node.section_id === tree.root_section_id);
  if (!root || root.start !== 0 || root.end !== byteLength) {
    fail('SECTION_TREE_INCOMPLETE', 'deterministic section tree must have a root over the complete source.');
  }
  const nodeIds = new Set();
  const boundaries = new Set([0, byteLength]);
  tree.nodes.forEach((node) => {
    if (!plainObject(node) || typeof node.section_id !== 'string' || !node.section_id
      || !Number.isInteger(node.start) || !Number.isInteger(node.end)
      || node.start < 0 || node.end <= node.start || node.end > byteLength
      || nodeIds.has(node.section_id)) {
      fail('INVALID_SECTION_TREE', 'deterministic section tree contains an invalid node.');
    }
    nodeIds.add(node.section_id);
    try {
      utf8Slice(context.canonical_text.text, node.start, node.end);
    } catch (error) {
      fail('INVALID_SECTION_TREE', 'deterministic section tree has non-boundary byte offsets.');
    }
    boundaries.add(node.start);
    boundaries.add(node.end);
  });
  const sectionTree = sectionTreeRoot(context, tree);
  const sectionTreeRootId = contentId(SECTION_TREE_SCHEMA, sectionTree);
  const sorted = [...boundaries].sort((left, right) => left - right);
  const atomicUnits = [];
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const start = sorted[index];
    const end = sorted[index + 1];
    if (start === end) continue;
    const text = utf8Slice(context.canonical_text.text, start, end);
    const sectionNodeIds = tree.nodes
      .filter((node) => node.start <= start && node.end >= end)
      .map((node) => node.section_id)
      .sort();
    if (sectionNodeIds.length === 0) {
      fail('PARTITION_GAP', 'deterministic section tree left an uncovered atomic interval.');
    }
    const body = {
      admitted_semantic_source_context_id: context.admitted_semantic_source_context_id,
      section_tree_root_id: sectionTreeRootId,
      start,
      end,
      text_sha256: sha256Hex(text),
      section_node_ids: sectionNodeIds,
    };
    atomicUnits.push({
      ...body,
      atomic_unit_id: contentId('M3_SOURCE_SCOPE_ATOMIC_UNIT/V1', body),
    });
  }
  if (atomicUnits.length === 0
    || atomicUnits[0].start !== 0
    || atomicUnits[atomicUnits.length - 1].end !== byteLength
    || atomicUnits.some((unit, index) => index > 0 && atomicUnits[index - 1].end !== unit.start)) {
    fail('PARTITION_INCOMPLETE', 'atomic section-tree partition must cover the complete source exactly once.');
  }
  return freeze({
    section_tree_root_id: sectionTreeRootId,
    section_tree: sectionTree,
    atomic_units: atomicUnits,
  });
}

function validateReceipt(receipt, {
  schema,
  idKey,
  context,
  runReceiptId = null,
  label,
}) {
  if (!plainObject(receipt) || receipt.schema_version !== schema || !Object.hasOwn(receipt, idKey)) {
    fail('INVALID_RECEIPT', `${label} must use the exact committed receipt schema.`);
  }
  requireDigest(receipt[idKey], `${label}.${idKey}`);
  requireDigest(receipt.document_hash, `${label}.document_hash`);
  if (receipt.document_hash !== context.document_hash) {
    fail('RECEIPT_DOCUMENT_MISMATCH', `${label} does not bind the admitted source document.`);
  }
  if (runReceiptId !== null && receipt.run_receipt_id !== runReceiptId) {
    fail('RECEIPT_RUN_MISMATCH', `${label} does not bind the exact extraction run receipt.`);
  }
  const body = { ...receipt };
  delete body[idKey];
  if (receipt[idKey] !== contentId(schema, body)) {
    fail('RECEIPT_IDENTITY_MISMATCH', `${label} identity does not match its receipt payload.`);
  }
}

function normaliseDispositions(dispositions, partition) {
  if (!Array.isArray(dispositions) || dispositions.length !== partition.atomic_units.length) {
    fail('DISPOSITION_COUNT_MISMATCH', 'one explicit disposition is required for every atomic unit.');
  }
  const byInterval = new Map();
  dispositions.forEach((entry) => {
    if (!plainObject(entry) || !Number.isInteger(entry.start) || !Number.isInteger(entry.end)) {
      fail('INVALID_DISPOSITION', 'each disposition must identify one atomic byte interval.');
    }
    const key = `${entry.start}:${entry.end}`;
    if (byInterval.has(key)) fail('DUPLICATE_DISPOSITION', 'an atomic byte interval has more than one disposition.');
    byInterval.set(key, entry);
  });
  return partition.atomic_units.map((unit) => {
    const entry = byInterval.get(`${unit.start}:${unit.end}`);
    if (!entry || !DISPOSITIONS.has(entry.disposition)) {
      fail('PARTITION_DISPOSITION_GAP', 'each atomic byte interval must be EXTRACTED, APPROVED_EXCLUDED or UNRESOLVED.');
    }
    const baseKeys = ['start', 'end', 'disposition'];
    if (entry.disposition === 'EXTRACTED') {
      if (!exactKeys(entry, [...baseKeys, 'extraction_reference_id'])) {
        fail('INVALID_EXTRACTED_DISPOSITION', 'EXTRACTED disposition requires exactly one extraction reference.');
      }
      requireDigest(entry.extraction_reference_id, 'extraction_reference_id');
      return {
        atomic_unit_id: unit.atomic_unit_id,
        start: unit.start,
        end: unit.end,
        disposition: entry.disposition,
        extraction_reference_id: entry.extraction_reference_id,
      };
    }
    if (entry.disposition === 'APPROVED_EXCLUDED') {
      if (!exactKeys(entry, [...baseKeys, 'exclusion_approval_id'])) {
        fail('DEFAULT_EXCLUSION', 'APPROVED_EXCLUDED disposition requires an explicit exclusion approval.');
      }
      requireDigest(entry.exclusion_approval_id, 'exclusion_approval_id');
      return {
        atomic_unit_id: unit.atomic_unit_id,
        start: unit.start,
        end: unit.end,
        disposition: entry.disposition,
        exclusion_approval_id: entry.exclusion_approval_id,
      };
    }
    if (!exactKeys(entry, [...baseKeys, 'unresolved_reason'])) {
      fail('INVALID_UNRESOLVED_DISPOSITION', 'UNRESOLVED disposition requires an explicit reason.');
    }
    requireNonEmptyString(entry.unresolved_reason, 'unresolved_reason');
    return {
      atomic_unit_id: unit.atomic_unit_id,
      start: unit.start,
      end: unit.end,
      disposition: entry.disposition,
      unresolved_reason: entry.unresolved_reason,
    };
  });
}

function buildM3SourceScopeCertificate({
  admitted_source_context: context,
  run_receipt: runReceipt,
  resolution_receipt: resolutionReceipt,
  dispositions,
} = {}) {
  validateContext(context);
  const partition = deriveSourceScopePartition({ admitted_source_context: context });
  validateReceipt(runReceipt, {
    schema: RUN_RECEIPT_SCHEMA,
    idKey: 'run_receipt_id',
    context,
    label: 'run_receipt',
  });
  validateReceipt(resolutionReceipt, {
    schema: RESOLUTION_RECEIPT_SCHEMA,
    idKey: 'resolution_receipt_id',
    context,
    runReceiptId: runReceipt.run_receipt_id,
    label: 'resolution_receipt',
  });
  const normalisedDispositions = normaliseDispositions(dispositions, partition);
  const atomicUnits = partition.atomic_units.map((unit, index) => ({
    ...unit,
    ...normalisedDispositions[index],
  }));
  const binding = sourceBinding(context);
  const inventoryBody = {
    schema_version: INVENTORY_SCHEMA,
    ...binding,
    section_tree_root_id: partition.section_tree_root_id,
    atomic_unit_ids: atomicUnits.map((unit) => unit.atomic_unit_id),
  };
  const inventoryRootId = contentId(INVENTORY_SCHEMA, inventoryBody);
  const dispositionBody = {
    schema_version: DISPOSITION_SCHEMA,
    ...binding,
    section_tree_root_id: partition.section_tree_root_id,
    inventory_root_id: inventoryRootId,
    atomic_unit_dispositions: atomicUnits.map((unit) => ({
      atomic_unit_id: unit.atomic_unit_id,
      disposition: unit.disposition,
      ...(unit.extraction_reference_id ? { extraction_reference_id: unit.extraction_reference_id } : {}),
      ...(unit.exclusion_approval_id ? { exclusion_approval_id: unit.exclusion_approval_id } : {}),
      ...(unit.unresolved_reason ? { unresolved_reason: unit.unresolved_reason } : {}),
    })),
  };
  const dispositionRootId = contentId(DISPOSITION_SCHEMA, dispositionBody);
  const executionBody = {
    schema_version: EXECUTION_SCHEMA,
    ...binding,
    section_tree_root_id: partition.section_tree_root_id,
    inventory_root_id: inventoryRootId,
    disposition_root_id: dispositionRootId,
    run_receipt_id: runReceipt.run_receipt_id,
    resolution_receipt_id: resolutionReceipt.resolution_receipt_id,
  };
  const executionRootId = contentId(EXECUTION_SCHEMA, executionBody);
  const unresolvedUnitCount = atomicUnits.filter((unit) => unit.disposition === 'UNRESOLVED').length;
  const body = {
    schema_version: CERTIFICATE_SCHEMA,
    admitted_source_context: context,
    admitted_source_reference: buildAdmittedSourceReference(context),
    section_tree_root_id: partition.section_tree_root_id,
    inventory_root_id: inventoryRootId,
    disposition_root_id: dispositionRootId,
    execution_root_id: executionRootId,
    run_receipt: runReceipt,
    resolution_receipt: resolutionReceipt,
    atomic_units: atomicUnits,
    unresolved_unit_count: unresolvedUnitCount,
    certification_status: unresolvedUnitCount === 0 ? 'CERTIFIED' : 'BLOCKED_UNRESOLVED',
  };
  const certificate = freeze({
    ...body,
    m3_source_scope_certificate_id: contentId(CERTIFICATE_SCHEMA, body),
  });
  return certificate;
}

function validateM3SourceScopeCertificate(certificate) {
  if (!exactKeys(certificate, CERTIFICATE_KEYS) || certificate.schema_version !== CERTIFICATE_SCHEMA) {
    fail('INVALID_CERTIFICATE', 'source-scope certificate must match its closed V1 contract.');
  }
  requireDigest(certificate.m3_source_scope_certificate_id, 'm3_source_scope_certificate_id');
  const body = { ...certificate };
  delete body.m3_source_scope_certificate_id;
  if (certificate.m3_source_scope_certificate_id !== contentId(CERTIFICATE_SCHEMA, body)) {
    fail('CERTIFICATE_IDENTITY_MISMATCH', 'source-scope certificate identity does not match its payload.');
  }
  validateContext(certificate.admitted_source_context);
  if (!same(certificate.admitted_source_reference,
    buildAdmittedSourceReference(certificate.admitted_source_context))) {
    fail('SOURCE_REFERENCE_MISMATCH', 'certificate source reference does not match its admitted context.');
  }
  const rebuilt = buildM3SourceScopeCertificate({
    admitted_source_context: certificate.admitted_source_context,
    run_receipt: certificate.run_receipt,
    resolution_receipt: certificate.resolution_receipt,
    dispositions: certificate.atomic_units.map((unit) => ({
      start: unit.start,
      end: unit.end,
      disposition: unit.disposition,
      ...(unit.extraction_reference_id ? { extraction_reference_id: unit.extraction_reference_id } : {}),
      ...(unit.exclusion_approval_id ? { exclusion_approval_id: unit.exclusion_approval_id } : {}),
      ...(unit.unresolved_reason ? { unresolved_reason: unit.unresolved_reason } : {}),
    })),
  });
  if (!same(certificate, rebuilt)) {
    fail('CERTIFICATE_BINDING_MISMATCH', 'certificate does not match the deterministic source partition and receipts.');
  }
  return true;
}

function sourceSetEntry(context) {
  validateContext(context);
  return {
    governed_deal_key: context.governed_deal_key,
    deal_admission_id: context.deal_admission_id,
    source_occurrence_id: context.source_occurrence_id,
  };
}

function buildM3SourceScopeCertificationSet({
  admitted_source_contexts: contexts,
  certificates,
} = {}) {
  if (!Array.isArray(contexts) || contexts.length === 0 || !Array.isArray(certificates)) {
    fail('INVALID_SET_INPUT', 'certification set requires admitted sources and their certificates.');
  }
  const expected = contexts.map(sourceSetEntry);
  const cohort = expected[0];
  if (expected.some((entry) => entry.governed_deal_key !== cohort.governed_deal_key
    || entry.deal_admission_id !== cohort.deal_admission_id)) {
    fail('MIXED_COHORT', 'all admitted sources in a certification set must share one deal admission cohort.');
  }
  const expectedIds = expected.map((entry) => entry.source_occurrence_id).sort();
  if (new Set(expectedIds).size !== expectedIds.length) {
    fail('DUPLICATE_EXPECTED_SOURCE', 'admitted source cohort contains duplicate source occurrences.');
  }
  certificates.forEach(validateM3SourceScopeCertificate);
  const sortedCertificates = [...certificates].sort((left, right) =>
    left.admitted_source_context.source_occurrence_id.localeCompare(
      right.admitted_source_context.source_occurrence_id,
    ));
  const certificateSourceIds = sortedCertificates.map(
    (certificate) => certificate.admitted_source_context.source_occurrence_id,
  );
  if (new Set(certificateSourceIds).size !== certificateSourceIds.length) {
    fail('DUPLICATE_CERTIFICATE_SOURCE', 'certification set contains duplicate source certificates.');
  }
  if (!same(certificateSourceIds, expectedIds)) {
    fail('CERTIFICATE_SOURCE_SET_MISMATCH', 'certification set has a missing, extra or changed admitted source.');
  }
  const body = {
    schema_version: SET_SCHEMA,
    governed_deal_key: cohort.governed_deal_key,
    deal_admission_id: cohort.deal_admission_id,
    expected_source_occurrence_ids: expectedIds,
    certificate_ids: sortedCertificates.map((certificate) => certificate.m3_source_scope_certificate_id),
    certificates: sortedCertificates,
    certification_status: sortedCertificates.every(
      (certificate) => certificate.certification_status === 'CERTIFIED',
    ) ? 'CERTIFIED' : 'BLOCKED_UNRESOLVED',
  };
  return freeze({
    ...body,
    m3_source_scope_certification_set_id: contentId(SET_SCHEMA, body),
  });
}

function validateM3SourceScopeCertificationSet(set) {
  if (!exactKeys(set, SET_KEYS) || set.schema_version !== SET_SCHEMA) {
    fail('INVALID_CERTIFICATION_SET', 'source-scope certification set must match its closed V1 contract.');
  }
  requireDigest(set.m3_source_scope_certification_set_id, 'm3_source_scope_certification_set_id');
  const body = { ...set };
  delete body.m3_source_scope_certification_set_id;
  if (set.m3_source_scope_certification_set_id !== contentId(SET_SCHEMA, body)) {
    fail('CERTIFICATION_SET_IDENTITY_MISMATCH', 'certification set identity does not match its payload.');
  }
  const rebuilt = buildM3SourceScopeCertificationSet({
    admitted_source_contexts: set.certificates.map((certificate) => certificate.admitted_source_context),
    certificates: set.certificates,
  });
  if (!same(set, rebuilt)) {
    fail('CERTIFICATION_SET_BINDING_MISMATCH', 'certification set does not match its complete admitted source cohort.');
  }
  return true;
}

module.exports = {
  CERTIFICATE_SCHEMA,
  SET_SCHEMA,
  M3SourceScopeCertificationError,
  deriveSourceScopePartition,
  buildM3SourceScopeCertificate,
  validateM3SourceScopeCertificate,
  buildM3SourceScopeCertificationSet,
  validateM3SourceScopeCertificationSet,
};
