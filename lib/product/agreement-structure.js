'use strict';

const crypto = require('node:crypto');
const { canonicalJson, utf8Slice } = require('../canonical-v2/canonical-bytes');
const {
  sectionizeAdmittedSource,
} = require('../canonical-v2/native-producer/deterministic-sectionizer');

const PRODUCT_STRUCTURE_VERSION = 'AGREEMENT_STRUCTURE/V1';
const COORDINATE_SYSTEM = 'UTF8_CANONICAL_TEXT_HALF_OPEN';
const KIND_MAP = Object.freeze({ ROOT: 'AGREEMENT', ARTICLE: 'ARTICLE', SECTION: 'SECTION', SUBSECTION: 'LIMB' });
const KIND_ORDER = Object.freeze({ AGREEMENT: 0, ARTICLE: 1, SECTION: 2, LIMB: 3 });
const ANNOTATION_KINDS = Object.freeze(['SECTION_REFERENCE', 'DEFINED_TERM']);
const DIAGNOSTIC_KINDS = Object.freeze(['REJECTED_HEADING_CANDIDATE', 'SWALLOWED_HEADING_RESIDUAL']);
const HEX_256 = /^[0-9a-f]{64}$/;

class AgreementStructureError extends Error {
  constructor(code, detail) {
    super(`${code}: ${detail}`);
    this.name = 'AgreementStructureError';
    this.code = code;
  }
}

function fail(code, detail) {
  throw new AgreementStructureError(code, detail);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function stableId(domain, value) {
  return sha256(Buffer.from(`${domain}\0${JSON.stringify(value)}`, 'utf8'));
}

function charByteOffsets(text) {
  const offsets = new Array(text.length + 1);
  let bytes = 0;
  for (let index = 0; index < text.length;) {
    offsets[index] = bytes;
    const point = text.codePointAt(index);
    const width = point > 0xffff ? 2 : 1;
    if (width === 2) offsets[index + 1] = bytes;
    bytes += Buffer.byteLength(String.fromCodePoint(point), 'utf8');
    index += width;
    offsets[index] = bytes;
  }
  return offsets;
}

function utf8Text(canonicalText, startByte, endByte, code, detail) {
  try {
    return utf8Slice(canonicalText, startByte, endByte);
  } catch {
    return fail(code, detail);
  }
}

function sourceSpan(sourceBytes, sourceSha256, startByte, endByte) {
  return Object.freeze({
    coordinate_system: COORDINATE_SYSTEM,
    start_byte: startByte,
    end_byte: endByte,
    source_sha256: sourceSha256,
    text_sha256: sha256(sourceBytes.subarray(startByte, endByte)),
  });
}

function validateSpan(span, canonicalText, sourceBytes, sourceSha256, detail) {
  if (!span || span.coordinate_system !== COORDINATE_SYSTEM
    || span.source_sha256 !== sourceSha256
    || !Number.isSafeInteger(span.start_byte)
    || !Number.isSafeInteger(span.end_byte)
    || span.start_byte < 0
    || span.end_byte <= span.start_byte
    || span.end_byte > sourceBytes.length) {
    fail('STRUCTURE_SPAN', detail);
  }
  utf8Text(canonicalText, span.start_byte, span.end_byte, 'STRUCTURE_SPAN', detail);
  if (span.text_sha256 !== sha256(sourceBytes.subarray(span.start_byte, span.end_byte))) {
    fail('STRUCTURE_SPAN', detail);
  }
}

function nodeIdentity(agreementId, sourceSha256, node) {
  return stableId('AGREEMENT_STRUCTURE_NODE/V1', {
    agreement_id: agreementId,
    source_sha256: sourceSha256,
    coordinate_system: COORDINATE_SYSTEM,
    kind: node.kind,
    reference: node.reference,
    parent_id: node.parent_id,
    start_byte: node.span.start_byte,
    end_byte: node.span.end_byte,
    text_sha256: node.span.text_sha256,
  });
}

function compareAuthored(left, right) {
  return left.span.start_byte - right.span.start_byte
    || right.span.end_byte - left.span.end_byte
    || KIND_ORDER[left.kind] - KIND_ORDER[right.kind]
    || String(left.reference || '').localeCompare(String(right.reference || ''));
}

function buildNodes(parsed, agreementId, sourceBytes, sourceSha256) {
  const parserToProductId = new Map();
  const nodes = parsed.nodes.map((parsedNode) => {
    const parentId = parsedNode.parent_section_id === null
      ? null
      : parserToProductId.get(parsedNode.parent_section_id);
    if (parsedNode.parent_section_id !== null && !parentId) {
      fail('STRUCTURE_PARENT', parsedNode.reference || parsedNode.section_id);
    }
    const node = {
      parent_id: parentId,
      kind: KIND_MAP[parsedNode.kind] || fail('STRUCTURE_KIND', parsedNode.kind),
      reference: parsedNode.reference,
      span: sourceSpan(sourceBytes, sourceSha256, parsedNode.start, parsedNode.end),
    };
    node.node_id = nodeIdentity(agreementId, sourceSha256, node);
    parserToProductId.set(parsedNode.section_id, node.node_id);
    return node;
  });
  nodes.sort(compareAuthored);
  return {
    nodes: Object.freeze(nodes.map((node, authoredOrder) => Object.freeze({
      node_id: node.node_id,
      parent_id: node.parent_id,
      kind: node.kind,
      authored_order: authoredOrder,
      reference: node.reference,
      span: node.span,
    }))),
    rootNodeId: parserToProductId.get(parsed.root_section_id),
  };
}

function diagnosticEntry(kind, entry, sourceSha256, canonicalText) {
  if (!DIAGNOSTIC_KINDS.includes(kind)
    || !Number.isSafeInteger(entry.start)
    || entry.start < 0) {
    fail('STRUCTURE_DIAGNOSTIC', entry.reference || kind);
  }
  utf8Text(canonicalText, entry.start, entry.start, 'STRUCTURE_DIAGNOSTIC', entry.reference || kind);
  const identity = {
    kind,
    article: entry.article,
    reference: entry.reference,
    reason: entry.reason,
    coordinate_system: COORDINATE_SYSTEM,
    source_sha256: sourceSha256,
    start_byte: entry.start,
  };
  return Object.freeze({
    diagnostic_id: stableId('AGREEMENT_STRUCTURE_DIAGNOSTIC/V1', identity),
    ...identity,
  });
}

function buildStructuralDiagnostics(parsed, sourceSha256, canonicalText) {
  const rejected = parsed.rejected_inline_heading_candidates.map((entry) => (
    diagnosticEntry('REJECTED_HEADING_CANDIDATE', entry, sourceSha256, canonicalText)
  ));
  const swallowed = parsed.swallowed_heading_residuals.map((entry) => (
    diagnosticEntry('SWALLOWED_HEADING_RESIDUAL', entry, sourceSha256, canonicalText)
  ));
  return Object.freeze({
    completeness: rejected.length === 0 && swallowed.length === 0 ? 'COMPLETE' : 'INCOMPLETE',
    rejected_heading_candidates: Object.freeze(rejected),
    swallowed_heading_residuals: Object.freeze(swallowed),
  });
}

function annotationValueFromText(kind, exactText) {
  let match;
  if (kind === 'SECTION_REFERENCE') {
    match = exactText.match(/^Section\s+(\d{1,3}(?:\.\d{1,3})+(?:\([A-Za-z0-9]+\))*)(?![A-Za-z0-9]|\.\d)$/);
  } else if (kind === 'DEFINED_TERM') {
    match = exactText.match(/^[“"]([^”"\n]{1,120})[”"]\s+(?:means|shall mean|has the meaning)$/);
  } else {
    fail('STRUCTURE_ANNOTATION_KIND', kind);
  }
  if (!match) fail('STRUCTURE_ANNOTATION_VALUE', `${kind} does not match its source span`);
  return match[1];
}

function separatelyDefinedDocumentTerms(canonicalText) {
  const definitionsByTerm = new Map();
  const definitions = /[“"]([^”"\n]{1,120})[”"]\s+(?:means|shall mean)\s+([^\n]{1,1200})/g;
  for (const match of canonicalText.matchAll(definitions)) {
    const term = match[1].trim();
    const definition = match[2].trim();
    if (!/\b(?:Agreement|Indenture|Plan|Charter|Bylaws|Certificate)\b/i.test(term)) continue;
    const key = term.toLocaleLowerCase('en-US');
    if (!definitionsByTerm.has(key)) definitionsByTerm.set(key, []);
    definitionsByTerm.get(key).push({ term, definition });
  }
  const terms = [...definitionsByTerm.values()].filter((entries) => entries.length === 1).flatMap(([entry]) => {
    if (/^this\b[^.\n]{0,160}\b(?:agreement|indenture|plan|charter|bylaws|certificate)\b/i.test(entry.definition)
      || /^the\s+Agreement\b/i.test(entry.definition)) return [];
    if (!/\b(?:agreement|indenture|plan|charter|bylaws|certificate)\b/i.test(entry.definition)) return [];
    if (!/\b(?:that certain|dated as of|entered into|executed|by and among|between|as amended|amendments|restatements|limited partnership)\b/i.test(entry.definition)) return [];
    return [entry.term];
  });
  return [...new Set(terms)].sort((left, right) => right.length - left.length || left.localeCompare(right));
}

function isExternalSectionCitation(canonicalText, matchIndex, matchLength, externalDocumentTerms) {
  const prefix = canonicalText.slice(Math.max(0, matchIndex - 100), matchIndex);
  const suffix = canonicalText.slice(matchIndex + matchLength, matchIndex + matchLength + 120);
  const separatelyDefinedDocument = externalDocumentTerms.some((term) => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`^\\s+of\\s+(?:the\\s+)?[“"]?${escaped}[”"]?\\b`, 'i').test(suffix);
  });
  return /\b(?:Treasury\s+Regulations?|Internal\s+Revenue\s+Code|United\s+States\s+Code|U\.S\.\s+Code|Code\s+of\s+Federal\s+Regulations)\s*$/i.test(prefix)
    || /^\s+of\s+the\s+New York Stock Exchange Listed Company Manual\b/i.test(suffix)
    || separatelyDefinedDocument;
}

function buildAnnotations(canonicalText, sourceBytes, sourceSha256, nodes) {
  const offsets = charByteOffsets(canonicalText);
  const annotations = [];
  const externalDocumentTerms = separatelyDefinedDocumentTerms(canonicalText);
  const patterns = [
    ['SECTION_REFERENCE', /\bSection\s+(\d{1,3}(?:\.\d{1,3})+(?:\([A-Za-z0-9]+\))*)(?![A-Za-z0-9]|\.\d)/g],
    ['DEFINED_TERM', /[“"]([^”"\n]{1,120})[”"](?=\s+(?:means|shall mean|has the meaning))/g],
  ];
  for (const [kind, pattern] of patterns) {
    for (const match of canonicalText.matchAll(pattern)) {
      if (kind === 'SECTION_REFERENCE'
        && isExternalSectionCitation(canonicalText, match.index, match[0].length, externalDocumentTerms)) continue;
      const startByte = offsets[match.index];
      let endIndex = match.index + match[0].length;
      if (kind === 'DEFINED_TERM') {
        const suffix = canonicalText.slice(endIndex).match(/^\s+(?:means|shall mean|has the meaning)/);
        endIndex += suffix ? suffix[0].length : 0;
      }
      const endByte = offsets[endIndex];
      const owner = nodes
        .filter((node) => node.span.start_byte <= startByte && node.span.end_byte >= endByte)
        .sort((left, right) => (left.span.end_byte - left.span.start_byte) - (right.span.end_byte - right.span.start_byte))[0];
      if (!owner) fail('STRUCTURE_ANNOTATION_OWNER', match[0]);
      const exactText = utf8Text(canonicalText, startByte, endByte, 'STRUCTURE_ANNOTATION_VALUE', match[0]);
      const identity = {
        kind,
        owner_node_id: owner.node_id,
        start_byte: startByte,
        end_byte: endByte,
        value: annotationValueFromText(kind, exactText),
      };
      annotations.push(Object.freeze({
        annotation_id: stableId('AGREEMENT_ANNOTATION/V1', identity),
        ...identity,
        span: sourceSpan(sourceBytes, sourceSha256, startByte, endByte),
      }));
    }
  }
  return Object.freeze(annotations);
}

function parsedSource(canonicalText, sourceSha256) {
  return sectionizeAdmittedSource({ source_text: canonicalText, document_hash: sourceSha256 });
}

function buildAgreementStructure({ agreement_id: agreementId, canonical_text: canonicalText, canonical_text_sha256: suppliedSourceSha256 }) {
  if (!HEX_256.test(agreementId || '')) fail('STRUCTURE_AGREEMENT_ID', 'agreement_id must be a SHA-256 identity');
  if (typeof canonicalText !== 'string' || canonicalText.length === 0) fail('STRUCTURE_SOURCE', 'canonical_text is required');
  const sourceBytes = Buffer.from(canonicalText, 'utf8');
  const sourceSha256 = sha256(sourceBytes);
  if (suppliedSourceSha256 !== sourceSha256) fail('STRUCTURE_SOURCE_HASH', 'canonical_text_sha256 does not match the source');

  const parsed = parsedSource(canonicalText, sourceSha256);
  const built = buildNodes(parsed, agreementId, sourceBytes, sourceSha256);
  const structure = {
    schema_version: PRODUCT_STRUCTURE_VERSION,
    agreement_id: agreementId,
    source_sha256: sourceSha256,
    source_byte_length: sourceBytes.length,
    root_node_id: built.rootNodeId,
    coordinate_system: COORDINATE_SYSTEM,
    nodes: built.nodes,
    structural_diagnostics: buildStructuralDiagnostics(parsed, sourceSha256, canonicalText),
    annotations: buildAnnotations(canonicalText, sourceBytes, sourceSha256, built.nodes),
  };
  validateAgreementStructureAgainstParsed(structure, canonicalText, parsed);
  return Object.freeze(structure);
}

function validateAgreementStructureAgainstParsed(structure, canonicalText, parsed) {
  const sourceBytes = Buffer.from(canonicalText, 'utf8');
  const sourceSha256 = sha256(sourceBytes);
  if (!structure || structure.schema_version !== PRODUCT_STRUCTURE_VERSION
    || !HEX_256.test(structure.agreement_id || '')
    || structure.coordinate_system !== COORDINATE_SYSTEM
    || sourceSha256 !== structure.source_sha256
    || sourceBytes.length !== structure.source_byte_length) {
    fail('STRUCTURE_SOURCE_HASH', 'source identity or coordinate system changed');
  }
  if (!Array.isArray(structure.nodes) || structure.nodes.length === 0) fail('STRUCTURE_ROOT', 'nodes are required');
  const ids = new Set(structure.nodes.map((node) => node.node_id));
  if (ids.size !== structure.nodes.length) fail('STRUCTURE_IDENTITY', 'node IDs are not unique');
  const roots = structure.nodes.filter((node) => node.parent_id === null);
  if (roots.length !== 1 || roots[0].node_id !== structure.root_node_id) fail('STRUCTURE_ROOT', 'exactly one declared root is required');

  structure.nodes.forEach((node, index) => {
    if (!Object.hasOwn(KIND_ORDER, node.kind)) fail('STRUCTURE_KIND', node.kind);
    validateSpan(node.span, canonicalText, sourceBytes, sourceSha256, node.node_id);
    if (node.authored_order !== index) fail('STRUCTURE_ORDER', node.node_id);
    if (index > 0 && compareAuthored(structure.nodes[index - 1], node) > 0) fail('STRUCTURE_ORDER', node.node_id);
    if (node.parent_id !== null && !ids.has(node.parent_id)) fail('STRUCTURE_PARENT', node.node_id);
    const visited = new Set([node.node_id]);
    let parentId = node.parent_id;
    while (parentId !== null) {
      if (visited.has(parentId)) fail('STRUCTURE_CYCLE', node.node_id);
      visited.add(parentId);
      const parent = structure.nodes.find((candidate) => candidate.node_id === parentId);
      if (!parent) fail('STRUCTURE_PARENT', node.node_id);
      if (parent.span.start_byte > node.span.start_byte || parent.span.end_byte < node.span.end_byte) {
        fail('STRUCTURE_PARENT_SPAN', node.node_id);
      }
      if (parent.authored_order >= node.authored_order) fail('STRUCTURE_ORDER', node.node_id);
      parentId = parent.parent_id;
    }
    if (!visited.has(structure.root_node_id)) fail('STRUCTURE_DISCONNECTED', node.node_id);
    if (node.node_id !== nodeIdentity(structure.agreement_id, sourceSha256, node)) {
      fail('STRUCTURE_IDENTITY', node.node_id);
    }
  });

  for (const parent of structure.nodes) {
    const children = structure.nodes.filter((node) => node.parent_id === parent.node_id);
    for (let index = 1; index < children.length; index++) {
      if (children[index - 1].span.start_byte >= children[index].span.start_byte
        || children[index - 1].authored_order >= children[index].authored_order) {
        fail('STRUCTURE_ORDER', children[index].node_id);
      }
    }
  }

  const expectedNodes = buildNodes(parsed, structure.agreement_id, sourceBytes, sourceSha256);
  if (structure.root_node_id !== expectedNodes.rootNodeId
    || structure.nodes.length !== expectedNodes.nodes.length
    || structure.nodes.some((node, index) => canonicalJson(node) !== canonicalJson(expectedNodes.nodes[index]))) {
    fail('STRUCTURE_IDENTITY', 'nodes do not equal the source-derived structure');
  }

  const expectedDiagnostics = buildStructuralDiagnostics(parsed, sourceSha256, canonicalText);
  if (canonicalJson(structure.structural_diagnostics) !== canonicalJson(expectedDiagnostics)) {
    fail('STRUCTURE_DIAGNOSTIC', 'diagnostics do not equal the source-derived parser residuals');
  }

  if (!Array.isArray(structure.annotations)) {
    fail('STRUCTURE_ANNOTATION_COLLECTION', 'annotations must be an array');
  }
  const annotationIds = new Set();
  for (const annotation of structure.annotations) {
    if (!ANNOTATION_KINDS.includes(annotation.kind)) fail('STRUCTURE_ANNOTATION_KIND', annotation.kind);
    const owner = structure.nodes.find((node) => node.node_id === annotation.owner_node_id);
    validateSpan(annotation.span, canonicalText, sourceBytes, sourceSha256, annotation.annotation_id);
    if (annotationIds.has(annotation.annotation_id) || !owner
      || annotation.span.start_byte !== annotation.start_byte
      || annotation.span.end_byte !== annotation.end_byte
      || annotation.span.start_byte < owner.span.start_byte
      || annotation.span.end_byte > owner.span.end_byte) {
      fail('STRUCTURE_ANNOTATION_OWNER', annotation.annotation_id);
    }
    const exactText = utf8Text(canonicalText, annotation.start_byte, annotation.end_byte, 'STRUCTURE_ANNOTATION_VALUE', annotation.annotation_id);
    if (annotation.value !== annotationValueFromText(annotation.kind, exactText)) {
      fail('STRUCTURE_ANNOTATION_VALUE', annotation.annotation_id);
    }
    annotationIds.add(annotation.annotation_id);
    const identity = {
      kind: annotation.kind,
      owner_node_id: annotation.owner_node_id,
      start_byte: annotation.start_byte,
      end_byte: annotation.end_byte,
      value: annotation.value,
    };
    if (annotation.annotation_id !== stableId('AGREEMENT_ANNOTATION/V1', identity)) {
      fail('STRUCTURE_ANNOTATION_IDENTITY', annotation.annotation_id);
    }
  }
  const expectedAnnotations = buildAnnotations(canonicalText, sourceBytes, sourceSha256, structure.nodes);
  if (canonicalJson(structure.annotations) !== canonicalJson(expectedAnnotations)) {
    fail('STRUCTURE_ANNOTATION_COLLECTION', 'annotations do not equal the complete source-derived collection');
  }
  return structure;
}

function validateAgreementStructure(structure, canonicalText) {
  if (typeof canonicalText !== 'string') fail('STRUCTURE_SOURCE', 'canonical_text is required');
  const sourceSha256 = sha256(Buffer.from(canonicalText, 'utf8'));
  return validateAgreementStructureAgainstParsed(structure, canonicalText, parsedSource(canonicalText, sourceSha256));
}

function ancestorsOf(structure, nodeId) {
  const byId = new Map(structure.nodes.map((node) => [node.node_id, node]));
  if (!byId.has(nodeId)) fail('STRUCTURE_FOCUS', nodeId);
  const result = [];
  let cursor = byId.get(nodeId);
  while (cursor) {
    result.unshift(cursor);
    cursor = cursor.parent_id === null ? null : byId.get(cursor.parent_id);
  }
  return Object.freeze(result);
}

function sourceTextForSpan(canonicalText, span) {
  if (!span || span.coordinate_system !== COORDINATE_SYSTEM
    || !Number.isSafeInteger(span.start_byte)
    || !Number.isSafeInteger(span.end_byte)) {
    fail('STRUCTURE_SOURCE_RANGE', 'invalid UTF-8 span');
  }
  return utf8Text(canonicalText, span.start_byte, span.end_byte, 'STRUCTURE_SOURCE_RANGE', span.end_byte);
}

module.exports = {
  AgreementStructureError,
  PRODUCT_STRUCTURE_VERSION,
  ancestorsOf,
  buildAgreementStructure,
  sourceTextForSpan,
  validateAgreementStructure,
};
