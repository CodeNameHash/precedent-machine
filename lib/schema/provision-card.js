const crypto = require('node:crypto');

const PROVISION_KINDS = ['standard', 'definition', 'cross-reference'];

const REQUIRED_PROVENANCE_FIELDS = [
  'source_doc_id',
  'source_doc_page',
  'source_doc_offset_start',
  'source_doc_offset_end',
  'extractor_name',
  'extractor_version',
  'model',
  'prompt_hash',
  'run_id',
  'extracted_at',
];

function normalizeText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function spanHash(text) {
  return crypto.createHash('sha256').update(normalizeText(text)).digest('hex').slice(0, 12);
}

function provisionInstanceId({ dealId, sectionPath, text }) {
  if (!dealId) throw new Error('dealId is required');
  if (!sectionPath) throw new Error('sectionPath is required');
  const hash = spanHash(text);
  if (!hash) throw new Error('text is required');
  return `${dealId}:${sectionPath}:${hash}`;
}

function excerptId(provisionId, excerptIndex = 0) {
  if (!provisionId) throw new Error('provisionId is required');
  if (!Number.isInteger(excerptIndex) || excerptIndex < 0) throw new Error('excerptIndex must be a non-negative integer');
  return `${provisionId}:${excerptIndex}`;
}

function assertPlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function validateProvenance(provenance) {
  assertPlainObject(provenance, 'provenance');
  const missing = REQUIRED_PROVENANCE_FIELDS.filter((field) => provenance[field] === undefined || provenance[field] === null);
  if (missing.length) throw new Error(`provenance missing fields: ${missing.join(', ')}`);
  if (!Number.isInteger(provenance.source_doc_page)) throw new Error('provenance.source_doc_page must be an integer');
  if (!Number.isInteger(provenance.source_doc_offset_start)) throw new Error('provenance.source_doc_offset_start must be an integer');
  if (!Number.isInteger(provenance.source_doc_offset_end)) throw new Error('provenance.source_doc_offset_end must be an integer');
  if (provenance.source_doc_offset_start < 0 || provenance.source_doc_offset_end < provenance.source_doc_offset_start) {
    throw new Error('provenance source offsets are invalid');
  }
  if (Number.isNaN(Date.parse(provenance.extracted_at))) throw new Error('provenance.extracted_at must be an ISO date');
  return provenance;
}

function validateProvisionCardShape(card) {
  assertPlainObject(card, 'provision card');
  if (!card.provision_instance_id) throw new Error('provision_instance_id is required');
  if (!card.excerpt_id) throw new Error('excerpt_id is required');
  if (!PROVISION_KINDS.includes(card.kind)) throw new Error(`invalid provision kind: ${card.kind || '(empty)'}`);
  validateProvenance(card.provenance);
  if (card.kind === 'definition') {
    if (!card.defined_term) throw new Error('definition cards require defined_term');
    if (!card.defined_value) throw new Error('definition cards require defined_value');
  }
  const refs = card.references;
  if (!Array.isArray(refs)) throw new Error('references must be an array');
  if (card.kind === 'cross-reference' && refs.length === 0) throw new Error('cross-reference cards require references');
  return card;
}

module.exports = {
  PROVISION_KINDS,
  REQUIRED_PROVENANCE_FIELDS,
  excerptId,
  normalizeText,
  provisionInstanceId,
  spanHash,
  validateProvenance,
  validateProvisionCardShape,
};
