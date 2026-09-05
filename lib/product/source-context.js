'use strict';

const { contentId, sha256Hex, utf8Slice } = require('../canonical-v2/canonical-bytes');
const { validateAgreementStructure } = require('./agreement-structure');

const SOURCE_CLOSURE_VERSION = 'SOURCE_CLOSURE/V1';
const SPAN_VERSION = 'PRODUCT_SOURCE_SPAN/V1';
const INTRO_REFERENCE = /-INTRO$/;

class SourceContextError extends Error {
  constructor(code, detail) {
    super(`${code}: ${detail}`);
    this.name = 'SourceContextError';
    this.code = code;
  }
}

function fail(code, detail) {
  throw new SourceContextError(code, detail);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function trimByteRange(sourceText, startByte, endByte) {
  const bytes = Buffer.from(sourceText, 'utf8');
  let start = startByte;
  let end = endByte;
  while (start < end && /\s/.test(bytes.subarray(start, start + 1).toString('utf8'))) start += 1;
  while (end > start && /\s/.test(bytes.subarray(end - 1, end).toString('utf8'))) end -= 1;
  return { start, end };
}

function makeSpan(sourceDocument, startByte, endByte, kind, nodeId) {
  const sourceText = sourceDocument.canonical_text;
  const sourceBytes = Buffer.from(sourceText, 'utf8');
  if (!Number.isSafeInteger(startByte) || !Number.isSafeInteger(endByte)
    || startByte < 0 || endByte <= startByte || endByte > sourceBytes.length) {
    fail('SOURCE_SPAN_RANGE', `${kind}:${nodeId}`);
  }
  let exactText;
  try {
    exactText = utf8Slice(sourceText, startByte, endByte);
  } catch {
    fail('SOURCE_SPAN_BOUNDARY', `${kind}:${nodeId}`);
  }
  const identity = {
    source_document_id: sourceDocument.source_document_id,
    kind,
    structure_node_id: nodeId,
    coordinate_system: 'UTF8_CANONICAL_TEXT_HALF_OPEN',
    start_byte: startByte,
    end_byte: endByte,
    text_sha256: sha256Hex(Buffer.from(exactText, 'utf8')),
  };
  return deepFreeze({
    schema_version: SPAN_VERSION,
    span_id: contentId(SPAN_VERSION, identity),
    ...identity,
    kind,
    structure_node_id: nodeId,
    exact_text: exactText,
  });
}

function substantiveSections(agreementStructure) {
  return agreementStructure.nodes.filter((node) => node.kind === 'SECTION'
    && typeof node.reference === 'string'
    && !INTRO_REFERENCE.test(node.reference)
    && !agreementStructure.nodes.some((candidate) => (
      candidate.kind === 'SECTION'
      && candidate.node_id !== node.node_id
      && String(candidate.reference || '').startsWith(`${node.reference}::`)
    )));
}

function residualParagraphSpans({ sourceDocument, closure }) {
  const fullSection = closure.spans.find((span) => span.span_id === closure.full_section_span_id);
  if (!fullSection) fail('SOURCE_CLOSURE_FULL_SECTION', closure.source_closure_id);
  const text = fullSection.exact_text;
  const ranges = [];
  const boundary = /\n+/g;
  let start = 0;
  for (const match of text.matchAll(boundary)) {
    if (match.index > start) ranges.push([start, match.index]);
    start = match.index + match[0].length;
  }
  if (start < text.length) ranges.push([start, text.length]);
  const nonEmpty = ranges.filter(([from, to]) => text.slice(from, to).trim().length > 0);
  const blocks = nonEmpty.length > 0 ? nonEmpty : [[0, text.length]];
  return deepFreeze(blocks.map(([from, to]) => {
    const prefixBytes = Buffer.byteLength(text.slice(0, from), 'utf8');
    const blockBytes = Buffer.byteLength(text.slice(from, to), 'utf8');
    const trimmed = trimByteRange(
      sourceDocument.canonical_text,
      fullSection.start_byte + prefixBytes,
      fullSection.start_byte + prefixBytes + blockBytes,
    );
    return makeSpan(sourceDocument, trimmed.start, trimmed.end, 'RESIDUAL_PARAGRAPH', closure.structure_node_id);
  }));
}

function sectionTitle(sourceDocument, node) {
  const authoredReference = String(node.reference).replace(/^.*::/, '');
  const firstLine = utf8Slice(sourceDocument.canonical_text, node.span.start_byte, node.span.end_byte)
    .slice(0, 600).split('\n').map((line) => line.trim()).find(Boolean) || node.reference;
  return firstLine.replace(new RegExp(`^(?:Section\\s+)?${authoredReference.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[.\\s:-]*`, 'i'), '').trim()
    || firstLine;
}

function nearestSection(node, nodesById) {
  let current = node;
  const seen = new Set();
  while (current && !seen.has(current.node_id)) {
    seen.add(current.node_id);
    if (current.kind === 'SECTION') return current;
    current = current.parent_id ? nodesById.get(current.parent_id) : null;
  }
  return node;
}

function uniqueNodes(nodes) {
  return [...new Map(nodes.filter(Boolean).map((node) => [node.node_id, node])).values()]
    .sort((left, right) => left.authored_order - right.authored_order);
}

function documentScope(node, nodesById) {
  let current = node;
  const seen = new Set();
  while (current && !seen.has(current.node_id)) {
    seen.add(current.node_id);
    if (/^(?:Exhibit|Annex)-[A-Za-z0-9]+$/.test(String(current.reference || ''))) return current.reference;
    current = current.parent_id ? nodesById.get(current.parent_id) : null;
  }
  return null;
}

function authoredReference(reference) {
  return String(reference || '').replace(/^.*::/, '');
}

function normalizedReference(reference) {
  const parts = String(reference || '').match(/^(\d+)\.(\d+)(.*)$/);
  return parts ? `${parseInt(parts[1], 10)}.${parseInt(parts[2], 10)}${parts[3]}` : String(reference || '');
}

function isAgreementDefinitionsScope(scopeReference, nodesById, sourceText) {
  if (!scopeReference) return false;
  const scope = [...nodesById.values()].find((node) => node.reference === scopeReference);
  if (!scope) return false;
  const opening = utf8Slice(sourceText, scope.span.start_byte, Math.min(scope.span.end_byte, scope.span.start_byte + 1200));
  return /\bCERTAIN DEFINITIONS\b/i.test(opening)
    && /For purposes of this Agreement\s*\(including this Exhibit/i.test(opening);
}

function resolveReferencedNode(nodes, reference, ownerNode, nodesById, crossScopeResolutions, sourceText) {
  const ownerScope = documentScope(ownerNode, nodesById);
  let candidate = reference;
  while (candidate) {
    const normalized = normalizedReference(candidate);
    const matches = nodes.filter((node) => normalizedReference(authoredReference(node.reference)) === normalized);
    const localMatches = matches.filter((node) => documentScope(node, nodesById) === ownerScope);
    if (localMatches.length === 1) return localMatches[0];
    const agreementMatches = matches.filter((node) => documentScope(node, nodesById) === null);
    if (localMatches.length === 0 && agreementMatches.length === 1
      && isAgreementDefinitionsScope(ownerScope, nodesById, sourceText)) {
      crossScopeResolutions.push(Object.freeze({
        reference: candidate,
        from_scope: ownerScope,
        to_scope: 'MAIN_AGREEMENT',
        target_node_id: agreementMatches[0].node_id,
      }));
      return agreementMatches[0];
    }
    if (localMatches.length === 0 && matches.length === 1) {
      const targetScope = documentScope(matches[0], nodesById);
      if (targetScope !== ownerScope) {
        crossScopeResolutions.push(Object.freeze({
          reference: candidate,
          from_scope: ownerScope || 'MAIN_AGREEMENT',
          to_scope: targetScope || 'MAIN_AGREEMENT',
          target_node_id: matches[0].node_id,
        }));
      }
      return matches[0];
    }
    const shortened = candidate.replace(/\([^()]+\)$/, '');
    if (shortened === candidate) return null;
    candidate = shortened;
  }
  return null;
}

function buildSourceClosure({ sourceDocument, agreementStructure, nodeId }) {
  if (!sourceDocument || sourceDocument.schema_version !== 'SOURCE_DOCUMENT/V1') {
    fail('SOURCE_DOCUMENT', 'SOURCE_DOCUMENT/V1 is required');
  }
  validateAgreementStructure(agreementStructure, sourceDocument.canonical_text);
  if (agreementStructure.agreement_id !== sourceDocument.source_document_id) {
    fail('SOURCE_STRUCTURE_IDENTITY', 'source and structure do not identify the same agreement');
  }
  const nodesById = new Map(agreementStructure.nodes.map((node) => [node.node_id, node]));
  const node = nodesById.get(nodeId);
  if (!node) fail('SOURCE_NODE', nodeId);
  const section = nearestSection(node, nodesById);
  const children = agreementStructure.nodes.filter((candidate) => candidate.parent_id === node.node_id)
    .sort((left, right) => left.authored_order - right.authored_order);
  const chapeauEnd = children.length > 0 ? children[0].span.start_byte : node.span.end_byte;
  const chapeauRange = trimByteRange(sourceDocument.canonical_text, node.span.start_byte, chapeauEnd);
  const operativeNodes = children.length > 0 ? children : [node];
  const operativeSpans = operativeNodes.map((candidate) => makeSpan(
    sourceDocument,
    candidate.span.start_byte,
    candidate.span.end_byte,
    'OPERATIVE',
    candidate.node_id,
  ));
  const chapeauSpans = chapeauRange.end > chapeauRange.start
    ? [makeSpan(sourceDocument, chapeauRange.start, chapeauRange.end, 'CHAPEAU', node.node_id)]
    : [];

  const definitions = [];
  const references = [];
  const crossScopeResolutions = [];
  const unresolvedReferences = new Set();
  const traversed = new Set([section.node_id]);
  const queue = [section];
  const maxContextNodes = agreementStructure.nodes.length;
  while (queue.length > 0) {
    const current = queue.shift();
    const currentText = utf8Slice(sourceDocument.canonical_text, current.span.start_byte, current.span.end_byte);
    const currentAnnotations = agreementStructure.annotations.filter((annotation) => (
      annotation.span.start_byte >= current.span.start_byte && annotation.span.end_byte <= current.span.end_byte
    ));
    for (const annotation of currentAnnotations.filter((item) => item.kind === 'SECTION_REFERENCE')) {
      const annotationOwner = nodesById.get(annotation.owner_node_id) || current;
      const target = resolveReferencedNode(
        agreementStructure.nodes,
        annotation.value,
        annotationOwner,
        nodesById,
        crossScopeResolutions,
        sourceDocument.canonical_text,
      );
      if (!target) {
        unresolvedReferences.add(annotation.value);
        continue;
      }
      const targetSection = nearestSection(target, nodesById);
      references.push(targetSection);
      if (!traversed.has(targetSection.node_id)) {
        traversed.add(targetSection.node_id);
        queue.push(targetSection);
      }
    }
    const mentionedDefinitions = agreementStructure.annotations.filter((item) => {
      if (item.kind !== 'DEFINED_TERM'
        || !new RegExp(`\\b${String(item.value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(currentText)) return false;
      const owner = nodesById.get(item.owner_node_id);
      return owner && nearestSection(owner, nodesById).kind === 'SECTION';
    });
    for (const value of new Set(mentionedDefinitions.map((item) => item.value))) {
      const candidates = mentionedDefinitions.filter((item) => item.value === value);
      const currentScope = documentScope(current, nodesById);
      const local = candidates.filter((item) => (
        documentScope(nodesById.get(item.owner_node_id), nodesById) === currentScope
      ));
      const agreementDefinitions = currentScope === null ? candidates.filter((item) => (
        isAgreementDefinitionsScope(
          documentScope(nodesById.get(item.owner_node_id), nodesById),
          nodesById,
          sourceDocument.canonical_text,
        )
      )) : [];
      const selected = local.length > 0 ? local : agreementDefinitions;
      for (const annotation of selected) {
        const definitionSection = nearestSection(nodesById.get(annotation.owner_node_id), nodesById);
        definitions.push(definitionSection);
        if (!traversed.has(definitionSection.node_id)) {
          traversed.add(definitionSection.node_id);
          queue.push(definitionSection);
        }
      }
    }
  }

  const definitionSpans = uniqueNodes(definitions).map((candidate) => makeSpan(
    sourceDocument, candidate.span.start_byte, candidate.span.end_byte, 'DEFINITION', candidate.node_id,
  ));
  const crossReferenceSpans = uniqueNodes(references).map((candidate) => makeSpan(
    sourceDocument, candidate.span.start_byte, candidate.span.end_byte, 'CROSS_REFERENCE', candidate.node_id,
  ));
  const fullSectionSpan = makeSpan(
    sourceDocument, section.span.start_byte, section.span.end_byte, 'FULL_SECTION', section.node_id,
  );
  const allSpans = [...operativeSpans, ...chapeauSpans, ...definitionSpans, ...crossReferenceSpans, fullSectionSpan];
  const spans = [...new Map(allSpans.map((span) => [span.span_id, span])).values()];
  const body = {
    schema_version: SOURCE_CLOSURE_VERSION,
    source_document_id: sourceDocument.source_document_id,
    structure_node_id: node.node_id,
    section_node_id: section.node_id,
    section_reference: section.reference,
    operative_span_ids: operativeSpans.map((span) => span.span_id),
    chapeau_span_ids: chapeauSpans.map((span) => span.span_id),
    definition_span_ids: definitionSpans.map((span) => span.span_id),
    cross_reference_span_ids: crossReferenceSpans.map((span) => span.span_id),
    full_section_span_id: fullSectionSpan.span_id,
    sec_mapping: {
      retrieval_url: sourceDocument.retrieval_url,
      final_url: sourceDocument.final_url,
      filing_accession: sourceDocument.filing_accession,
      exhibit_filename: sourceDocument.exhibit_filename,
      canonical_text_sha256: sourceDocument.canonical_text_sha256,
      source_map_id: sourceDocument.source_map_id,
      coordinate_system: agreementStructure.coordinate_system,
    },
    context_diagnostics: {
      traversal_complete: queue.length === 0,
      traversed_node_count: traversed.size,
      maximum_context_nodes: maxContextNodes,
      unresolved_section_references: [...unresolvedReferences].sort(),
      cross_scope_section_references: [...new Map(crossScopeResolutions.map((entry) => (
        [`${entry.reference}:${entry.from_scope}:${entry.to_scope}:${entry.target_node_id}`, entry]
      ))).values()],
    },
  };
  return deepFreeze({
    ...body,
    source_closure_id: contentId(SOURCE_CLOSURE_VERSION, body),
    spans,
  });
}

function sourceClosureForModel(closure) {
  const byId = new Map(closure.spans.map((span) => [span.span_id, span]));
  const pick = (ids) => ids.map((id) => {
    const span = byId.get(id);
    return {
      span_id: span.span_id,
      source_document_id: span.source_document_id,
      structure_node_id: span.structure_node_id,
      kind: span.kind,
      start_byte: span.start_byte,
      end_byte: span.end_byte,
      exact_text: span.exact_text,
    };
  });
  return deepFreeze({
    schema_version: closure.schema_version,
    source_closure_id: closure.source_closure_id,
    section_reference: closure.section_reference,
    operative: pick(closure.operative_span_ids),
    chapeau: pick(closure.chapeau_span_ids),
    definitions: pick(closure.definition_span_ids),
    cross_references: pick(closure.cross_reference_span_ids),
    full_section: pick([closure.full_section_span_id])[0],
    sec_mapping: closure.sec_mapping,
    context_diagnostics: closure.context_diagnostics,
  });
}

module.exports = {
  SOURCE_CLOSURE_VERSION,
  SPAN_VERSION,
  SourceContextError,
  buildSourceClosure,
  makeSpan,
  residualParagraphSpans,
  sectionTitle,
  sourceClosureForModel,
  substantiveSections,
};
