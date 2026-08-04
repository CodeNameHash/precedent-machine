'use strict';

const ROUTING_SCHEMA = 'COMPANY_EMPLOYEE_DEFINITION_OWNER_ROUTING/V1';
const COMPANY_EMPLOYEE_IDENTITY = 'company employee';
const EMPLOYEE_MATTERS_OWNER = 'EMPLOYEE_MATTERS';

function fail(message) { throw new TypeError(message); }
function plain(value) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function text(value, label) {
  if (typeof value !== 'string' || value.trim() !== value || value.length === 0) fail(`${label} must be non-empty trimmed text.`);
  return value;
}
function freeze(value) { return Object.freeze(structuredClone(value)); }

function normaliseDefinedTermIdentity(value) {
  const term = text(value, 'Defined term');
  const identity = term.normalize('NFKC').replace(/[“”"']/g, '')
    .replace(/[^A-Za-z0-9]+/g, ' ').trim().toLowerCase();
  if (!identity) fail('Defined term has no normalised identity.');
  return identity;
}

function validateSourceStructure(value) {
  if (!plain(value)) fail('source_structure must be an object.');
  const required = ['provision_instance_id', 'section_reference', 'structural_path'];
  if (Object.keys(value).length !== required.length || !required.every((key) => Object.hasOwn(value, key))) {
    fail('source_structure must contain only the required source bindings.');
  }
  if (typeof value.provision_instance_id !== 'string' || !/^[a-f0-9]{64}$/.test(value.provision_instance_id)) {
    fail('source_structure.provision_instance_id must be a SHA-256 identifier.');
  }
  text(value.section_reference, 'source_structure.section_reference');
  if (!Array.isArray(value.structural_path) || value.structural_path.length === 0) {
    fail('source_structure.structural_path must be non-empty.');
  }
  value.structural_path.forEach((part, index) => text(part, `source_structure.structural_path[${index}]`));
  return freeze(value);
}

function exactEvidence({ evidence, sourceText, definitionHead, definitionBody }) {
  if (!Array.isArray(evidence) || evidence.length === 0) fail('candidate.evidence must be non-empty.');
  const sourceBytes = Buffer.from(text(sourceText, 'source_text'), 'utf8');
  let hasHead = false;
  let hasBody = false;
  const preserved = evidence.map((item, index) => {
    if (!plain(item)) fail(`candidate.evidence[${index}] must be an object.`);
    const start = item.absolute_start;
    const end = item.absolute_end;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end <= start || end > sourceBytes.length) {
      fail(`candidate.evidence[${index}] has an invalid byte range.`);
    }
    const quote = sourceBytes.subarray(start, end).toString('utf8');
    if (quote.includes(definitionHead)) hasHead = true;
    if (quote === definitionBody) hasBody = true;
    return freeze({ ...item, exact_quote: quote });
  });
  if (!hasHead || !hasBody) fail('candidate.evidence must independently preserve the exact definition head and body.');
  return freeze(preserved);
}

function routeCompanyEmployeeDefinitionToEmployeeMatters({
  provision_type: provisionType,
  provision_subtype: provisionSubtype,
  source_structure: sourceStructure,
  candidate,
  source_text: sourceText,
} = {}) {
  if (provisionType !== 'DEFINITION') return null;
  text(provisionSubtype, 'provision_subtype');
  const structure = validateSourceStructure(sourceStructure);
  if (!plain(candidate) || candidate.claim_definition_key !== 'OPEN_WORLD_PROPOSITION') return null;
  const attributes = candidate.attributes;
  const envelope = attributes && attributes.definition_envelope;
  if (!plain(envelope)) return null;
  const identity = normaliseDefinedTermIdentity(envelope.defined_term);
  if (identity !== COMPANY_EMPLOYEE_IDENTITY) return null;
  if (envelope.definition_kind !== 'TERM_DEFINITION') fail('Company Employee must be a term definition.');
  const head = text(envelope.definition_head_quote, 'definition_head_quote');
  const body = text(envelope.definition_body_quote, 'definition_body_quote');
  if (!head.includes(envelope.defined_term) || !body.includes(head) || candidate.raw_value !== body) {
    fail('Company Employee definition envelope is not structurally corroborated.');
  }
  if (envelope.cross_reference_target !== null
    && (typeof envelope.cross_reference_target !== 'string' || !body.includes(envelope.cross_reference_target))) {
    fail('Company Employee definition cross-reference is not source corroborated.');
  }
  if (!plain(attributes.structured_mechanic)
    || JSON.stringify(attributes.structured_mechanic) !== JSON.stringify(envelope)) {
    fail('Company Employee definition structure does not match the source envelope.');
  }
  const evidence = exactEvidence({ evidence: candidate.evidence, sourceText, definitionHead: head, definitionBody: body });
  return freeze({
    schema_version: ROUTING_SCHEMA,
    record_kind: 'EXACT_DEFINITION_OWNER_RELATIONSHIP',
    owner_family: EMPLOYEE_MATTERS_OWNER,
    comparison_eligibility: 'EXACT_TEXT_AND_RELATIONSHIPS_ONLY',
    market_statistics: 'NOT_CALCULATED',
    provision_type: provisionType,
    provision_subtype: provisionSubtype,
    source_structure: structure,
    defined_term_identity: identity,
    definition_envelope: envelope,
    source_evidence: evidence,
    relationships: freeze({
      owner_family: EMPLOYEE_MATTERS_OWNER,
      cross_reference_target: envelope.cross_reference_target,
    }),
  });
}

module.exports = {
  COMPANY_EMPLOYEE_IDENTITY,
  EMPLOYEE_MATTERS_OWNER,
  ROUTING_SCHEMA,
  normaliseDefinedTermIdentity,
  routeCompanyEmployeeDefinitionToEmployeeMatters,
};
