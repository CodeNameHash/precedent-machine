'use strict';

const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');
const {
  sectionizeAdmittedSource,
} = require('./native-producer/deterministic-sectionizer');
const {
  INLINE_STRUCTURE_SCHEMA_VERSION,
  INLINE_STRUCTURE_PARSER_VERSION,
  OFFSET_COORDINATE_SYSTEM,
  MAX_INLINE_DEPTH,
  segmentAuthoredInlineLists,
} = require('./agreement-inline-structure');

const AGREEMENT_INDEX_SCHEMA_VERSION = 'AGREEMENT_INDEX/V1';
const SOURCE_NODE_SCHEMA_VERSION = 'AGREEMENT_SOURCE_NODE/V1';
const SOURCE_ANNOTATION_SCHEMA_VERSION = 'AGREEMENT_SOURCE_ANNOTATION/V1';
const SOURCE_ARTEFACT_SCHEMA_VERSION = 'AGREEMENT_SOURCE_ARTEFACT/V1';
const BYTE_COVERAGE_SCHEMA_VERSION = 'AGREEMENT_BYTE_COVERAGE/V1';
const INLINE_MARKER_DISPOSITION_SCHEMA_VERSION = 'AGREEMENT_INLINE_MARKER_DISPOSITION/V1';
const INLINE_MARKER_CANDIDATE_SCHEMA_VERSION = 'AGREEMENT_INLINE_MARKER_CANDIDATE/V1';
const INLINE_MARKER_PARTITION_SCHEMA_VERSION = 'AGREEMENT_INLINE_MARKER_PARTITION/V1';
const INLINE_MARKER_SPAN_SET_DOMAIN = 'AGREEMENT_INLINE_MARKER_SPAN_SET/V1';
const COORDINATE_SYSTEM = 'UTF8_CANONICAL_TEXT_HALF_OPEN';
const AUTHORED_NODE_KINDS = Object.freeze([
  'AGREEMENT',
  'ARTICLE',
  'ANNEX',
  'SECTION',
  'LIMB',
  'HEADING',
  'CHAPEAU',
  'PARAGRAPH',
  'SENTENCE',
  'QUALIFICATION',
]);
const ANNOTATION_KINDS = Object.freeze([
  'OUTLINE_MARKER',
  'SECTION_REFERENCE',
  'DEFINED_TERM_DEFINITION',
  'DEFINED_TERM_USE',
]);
const SOURCE_ARTEFACT_KINDS = Object.freeze([
  'PAGE_NUMBER',
  'FORM_FEED',
  'CONVERSION_CONTROL',
]);
const BYTE_COVERAGE_OWNER_KINDS = Object.freeze([
  'AUTHORED_NODE',
  'SOURCE_ARTEFACT',
]);
const DIAGNOSTIC_TYPES = Object.freeze([
  'SECTIONIZER_REJECTED_INLINE_HEADING',
  'SECTIONIZER_SWALLOWED_HEADING',
  'DUPLICATE_MARKER_SEQUENCE_REPAIRED',
  'REVIEWED_STRUCTURE_OVERRIDE_APPLIED',
  'UNREPRESENTED_OUTLINE_MARKER',
  'SOURCE_ARTEFACT_INTERRUPTS_AUTHORED_BLOCK',
  'PARENT_REPAIRED',
  'NODE_COLLISION_DROPPED',
]);
const INLINE_MARKER_DISPOSITIONS = Object.freeze([
  'AUTHORED_INLINE_LIST',
  'NON_STRUCTURAL_MARKER',
  'UNRESOLVED_INLINE_LIST',
]);
const INLINE_MARKER_STYLES = Object.freeze([
  'UNCLASSIFIED',
  'alphaLower',
  'alphaUpper',
  'digit',
  'romanLower',
  'romanUpper',
  'xyz',
]);
const INLINE_AUTHORED_REASONS = Object.freeze([
  'CORROBORATED_SUBSTANTIVE_SEQUENCE',
]);
const INLINE_NONSTRUCTURAL_REASONS = Object.freeze([
  'AMBIGUOUS_MARKER_STYLE',
  'BARE_CLAUSE_REFERENCE',
  'GLUED_SECTION_REFERENCE',
  'TABLE_OF_CONTENTS_REFERENCE',
  'UNCORROBORATED_FIRST_MARKER',
]);
const INLINE_UNRESOLVED_REASONS = Object.freeze([
  'AMBIGUOUS_SAME_STYLE_RESTART',
  'CROSSING_LIST_BOUNDARY',
  'DEPTH_LIMIT',
  'INSUFFICIENT_ITEM_PAYLOAD',
  'OUT_OF_ORDER_MARKER_SEQUENCE',
  'SOURCE_ARTEFACT_BOUNDARY_AMBIGUOUS',
]);

const HEX_256 = /^[0-9a-f]{64}$/;
const STRUCTURAL_KINDS = new Set(['AGREEMENT', 'ARTICLE', 'ANNEX', 'SECTION', 'LIMB']);
const CLOSING_PUNCTUATION = new Set(['"', '\'', '\u2019', '\u201d', ')', ']', '}']);
const QUALIFICATION_PATTERN = /\b(?:provided\s*,?\s*(?:however\s*,?\s*)?that|provided\s+further\s+that|except\s*,?\s*(?:in\s+the\s+case\s+of|that|for)|subject\s+to|unless|notwithstanding|if(?=\s))\b/ig;
const PROTECTED_ABBREVIATION = /(?:\b(?:Inc|Corp|Co|Ltd|No|Nos|Rev|Rul|Fed|Reg|Mr|Mrs|Ms|Dr)\.|\b(?:L\.P|L\.L\.C|U\.S|U\.S\.C|C\.F\.R|E\.U|C\.B|P\.M|J\.P|e\.g|i\.e)\.)$/i;

class AgreementIndexError extends Error {
  constructor(code, detail) {
    super(`${code}: ${typeof detail === 'string' ? detail : canonicalJson(detail)}`);
    this.name = 'AgreementIndexError';
    this.code = code;
    this.detail = detail;
  }
}

function fail(code, detail) {
  throw new AgreementIndexError(code, detail);
}

function arraysEqual(left, right) {
  return Array.isArray(left)
    && left.length === right.length
    && left.every((value, index) => value === right[index]);
}

function hasValidUnicode(value) {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      return false;
    }
  }
  return true;
}

function normaliseExactSource(input) {
  if (typeof input === 'string') {
    if (!hasValidUnicode(input)) fail('INVALID_UTF8', 'canonical_text contains an unpaired surrogate');
    fail('EXACT_SOURCE_REQUIRED', 'exact source must include source identity and lineage');
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    fail('EXACT_SOURCE_REQUIRED', 'exact source must be an object');
  }
  const required = [
    'agreement_id',
    'deal',
    'canonical_text',
    'canonical_text_id',
    'canonical_text_sha256',
    'immutable_source_document_id',
    'raw_source_sha256',
    'raw_source_byte_length',
    'source_path',
  ];
  for (const field of required) {
    if (!Object.hasOwn(input, field)
      || input[field] === null
      || input[field] === undefined
      || input[field] === '') {
      fail('EXACT_SOURCE_FIELD_REQUIRED', field);
    }
  }
  if (typeof input.canonical_text !== 'string' || !hasValidUnicode(input.canonical_text)) {
    fail('INVALID_UTF8', 'canonical_text must be a valid Unicode string');
  }
  for (const field of [
    'agreement_id',
    'canonical_text_id',
    'canonical_text_sha256',
    'immutable_source_document_id',
    'raw_source_sha256',
  ]) {
    if (typeof input[field] !== 'string' || !HEX_256.test(input[field])) {
      fail('INVALID_DIGEST', field);
    }
  }
  const canonicalBytes = Buffer.from(input.canonical_text, 'utf8');
  if (sha256Hex(canonicalBytes) !== input.canonical_text_sha256) {
    fail('CANONICAL_TEXT_HASH_MISMATCH', input.canonical_text_sha256);
  }
  if (input.canonical_text_byte_length !== undefined
    && input.canonical_text_byte_length !== canonicalBytes.length) {
    fail('CANONICAL_TEXT_LENGTH_MISMATCH', input.canonical_text_byte_length);
  }
  if (!Number.isSafeInteger(input.raw_source_byte_length) || input.raw_source_byte_length < 0) {
    fail('EXACT_SOURCE_FIELD_REQUIRED', 'raw_source_byte_length');
  }
  return {
    agreement_id: input.agreement_id,
    deal: String(input.deal),
    canonical_text: input.canonical_text,
    canonical_text_id: input.canonical_text_id,
    canonical_text_sha256: input.canonical_text_sha256,
    canonical_text_byte_length: canonicalBytes.length,
    immutable_source_document_id: input.immutable_source_document_id,
    raw_source_sha256: input.raw_source_sha256,
    raw_source_byte_length: input.raw_source_byte_length,
    source_path: String(input.source_path),
    source_bindings: input.source_bindings === undefined ? null : structuredClone(input.source_bindings),
  };
}

function normalisePolicy(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    fail('STRUCTURAL_POLICY_REQUIRED', 'structural policy must be an object');
  }
  if (input.schema_version !== 'STAGE_2Y_STRUCTURAL_POLICY/V1') {
    fail('STRUCTURAL_POLICY_SCHEMA_MISMATCH', input.schema_version);
  }
  if (!Number.isSafeInteger(input.policy_version) || input.policy_version < 1) {
    fail('STRUCTURAL_POLICY_VERSION_INVALID', input.policy_version);
  }
  const enums = [
    ['authored_node_kinds', AUTHORED_NODE_KINDS],
    ['annotation_kinds', ANNOTATION_KINDS],
    ['source_artefact_kinds', SOURCE_ARTEFACT_KINDS],
    ['byte_coverage_owner_kinds', BYTE_COVERAGE_OWNER_KINDS],
    ['diagnostic_types', DIAGNOSTIC_TYPES],
  ];
  if (input.coordinate_system !== COORDINATE_SYSTEM
    || enums.some(([field, expected]) => !arraysEqual(input[field], expected))) {
    fail('STRUCTURAL_POLICY_ENUM_MISMATCH', 'closed structural-policy collections changed');
  }
  const inlinePolicy = input.inline_list_policy;
  if (!inlinePolicy
    || inlinePolicy.schema_version !== 'STAGE_2Y_INLINE_LIST_POLICY/V1'
    || inlinePolicy.parser_version !== INLINE_STRUCTURE_PARSER_VERSION
    || inlinePolicy.maximum_depth !== MAX_INLINE_DEPTH
    || !arraysEqual(inlinePolicy.dispositions, INLINE_MARKER_DISPOSITIONS)
    || !arraysEqual(inlinePolicy.styles, INLINE_MARKER_STYLES)
    || !arraysEqual(inlinePolicy.authored_reasons, INLINE_AUTHORED_REASONS)
    || !arraysEqual(inlinePolicy.non_structural_reasons, INLINE_NONSTRUCTURAL_REASONS)
    || !arraysEqual(inlinePolicy.unresolved_reasons, INLINE_UNRESOLVED_REASONS)) {
    fail('STRUCTURAL_POLICY_ENUM_MISMATCH', 'inline-list policy changed');
  }
  const unsigned = structuredClone(input);
  delete unsigned.policy_digest;
  const computedDigest = sha256Hex(Buffer.from(canonicalJson(unsigned), 'utf8'));
  if (input.policy_digest !== undefined && input.policy_digest !== computedDigest) {
    fail('STRUCTURAL_POLICY_DIGEST_MISMATCH', input.policy_digest);
  }
  return {
    value: structuredClone(input),
    digest: computedDigest,
  };
}

function indexAgreement(exactSourceInput, structuralPolicyInput) {
  const exactSource = normaliseExactSource(exactSourceInput);
  const policy = normalisePolicy(structuralPolicyInput);
  const sourceText = exactSource.canonical_text;
  const sourceBytes = Buffer.from(sourceText, 'utf8');
  const charByteOffsets = new Array(sourceText.length + 1);
  let mappedByteOffset = 0;
  for (let index = 0; index < sourceText.length;) {
    charByteOffsets[index] = mappedByteOffset;
    const codePoint = sourceText.codePointAt(index);
    const width = codePoint > 0xffff ? 2 : 1;
    if (width === 2) charByteOffsets[index + 1] = mappedByteOffset;
    mappedByteOffset += Buffer.byteLength(String.fromCodePoint(codePoint), 'utf8');
    index += width;
    charByteOffsets[index] = mappedByteOffset;
  }
  const charToByte = (index) => charByteOffsets[index];
  const sectionizer = sectionizeAdmittedSource({
    source_text: sourceText,
    document_hash: exactSource.raw_source_sha256,
  });
  if (sectionizer.nodes.length === 0) {
    fail('EXACT_SOURCE_FIELD_REQUIRED', 'canonical_text must not be empty');
  }

  function span(startByte, endByte) {
    return {
      coordinate_system: COORDINATE_SYSTEM,
      start_byte: startByte,
      end_byte: endByte,
      text_sha256: sha256Hex(sourceBytes.subarray(startByte, endByte)),
    };
  }

  function byteText(startByte, endByte) {
    return sourceBytes.subarray(startByte, endByte).toString('utf8');
  }

  function trimSpan(startByte, endByte) {
    if (!(endByte > startByte)) return null;
    const value = byteText(startByte, endByte);
    const first = value.search(/\S/u);
    if (first < 0) return null;
    const trailing = value.match(/\s*$/u)[0].length;
    const last = value.length - trailing;
    const start = startByte + Buffer.byteLength(value.slice(0, first), 'utf8');
    const end = startByte + Buffer.byteLength(value.slice(0, last), 'utf8');
    return end > start ? { start, end } : null;
  }

  const internalNodes = [];
  const internalByTempId = new Map();
  const legacyToTemp = new Map();
  const retiredSyntheticContainers = new Map();
  let generatedOrdinal = 0;

  function addInternalNode({
    tempId = null,
    nodeKind,
    start,
    end,
    reference = null,
    roles = [],
    parentTempId = null,
    legacyNode = null,
    headingText = null,
  }) {
    if (!(Number.isSafeInteger(start) && Number.isSafeInteger(end) && end > start)) return null;
    const id = tempId || `generated:${generatedOrdinal += 1}:${nodeKind}:${start}:${end}`;
    if (internalByTempId.has(id)) return internalByTempId.get(id);
    const node = {
      temp_id: id,
      node_kind: nodeKind,
      start,
      end,
      reference,
      roles: [...new Set(roles)].sort(),
      parent_temp_id: parentTempId,
      legacy_node: legacyNode,
      heading_text: headingText,
    };
    internalNodes.push(node);
    internalByTempId.set(id, node);
    if (legacyNode) legacyToTemp.set(legacyNode.section_id, id);
    return node;
  }

  const kindMap = Object.freeze({
    ROOT: 'AGREEMENT',
    ARTICLE: 'ARTICLE',
    SECTION: 'SECTION',
    SUBSECTION: 'LIMB',
  });
  const legacyAnnexSections = new Map(sectionizer.nodes
    .filter((legacy) => legacy.kind === 'SECTION' && /^Annex-[A-Z0-9]+$/.test(legacy.reference || ''))
    .map((legacy) => [legacy.section_id, legacy]));
  const syntheticIntroContainers = new Map(sectionizer.nodes
    .filter((legacy) => legacy.kind === 'SECTION' && /-INTRO$/.test(legacy.reference || ''))
    .map((legacy) => [legacy.section_id, legacy]));
  const syntheticAnnexArticles = new Map(sectionizer.nodes
    .filter((legacy) => legacy.kind === 'ARTICLE'
      && [...legacyAnnexSections.values()].some((annex) =>
        annex.parent_section_id === legacy.section_id && annex.start === legacy.start))
    .map((legacy) => [legacy.section_id, legacy]));
  for (const legacy of sectionizer.nodes) {
    if (syntheticIntroContainers.has(legacy.section_id)
      || syntheticAnnexArticles.has(legacy.section_id)) {
      retiredSyntheticContainers.set(legacy.section_id, legacy);
    }
  }
  function authoredLegacyParentTempId(parentSectionId) {
    let parentId = parentSectionId;
    const seen = new Set();
    while (parentId !== null && retiredSyntheticContainers.has(parentId)) {
      if (seen.has(parentId)) fail('STRUCTURAL_POLICY_DIGEST_MISMATCH', 'synthetic parent cycle');
      seen.add(parentId);
      parentId = retiredSyntheticContainers.get(parentId).parent_section_id;
    }
    return parentId === null ? null : `legacy:${parentId}`;
  }
  for (const legacy of sectionizer.nodes) {
    if (retiredSyntheticContainers.has(legacy.section_id)
      || legacyAnnexSections.has(legacy.section_id)) continue;
    addInternalNode({
      tempId: `legacy:${legacy.section_id}`,
      nodeKind: kindMap[legacy.kind],
      start: legacy.start,
      end: legacy.end,
      reference: legacy.reference,
      roles: ['STRUCTURAL_CONTAINER'],
      parentTempId: authoredLegacyParentTempId(legacy.parent_section_id),
      legacyNode: legacy,
    });
  }

  const rootLegacy = sectionizer.nodes.find((legacy) => legacy.kind === 'ROOT');
  if (!rootLegacy) fail('EXACT_SOURCE_FIELD_REQUIRED', 'sectionizer root is missing');
  const annexMarkerPattern = /^ANNEX\s+([A-Z0-9]+)\s*$/gm;
  const annexMarkers = [];
  let annexMarkerMatch;
  while ((annexMarkerMatch = annexMarkerPattern.exec(sourceText)) !== null) {
    annexMarkers.push({
      label: annexMarkerMatch[1],
      start: charToByte(annexMarkerMatch.index),
    });
  }
  for (let index = 0; index < annexMarkers.length; index += 1) {
    const marker = annexMarkers[index];
    const end = annexMarkers[index + 1]?.start || sourceBytes.length;
    const legacy = [...legacyAnnexSections.values()].find((candidate) =>
      candidate.start === marker.start);
    const markerEnd = marker.start + Buffer.byteLength(`ANNEX ${marker.label}`, 'utf8');
    const afterMarker = byteText(markerEnd, Math.min(end, markerEnd + 512));
    const headingLine = /^\s*([^\n\r]+)/u.exec(afterMarker)?.[1]?.trim() || null;
    addInternalNode({
      tempId: legacy ? `legacy:${legacy.section_id}` : null,
      nodeKind: 'ANNEX',
      start: marker.start,
      end,
      reference: `ANNEX ${marker.label}`,
      roles: ['AUTHORED_ANNEX', 'STRUCTURAL_CONTAINER'],
      parentTempId: `legacy:${rootLegacy.section_id}`,
      legacyNode: legacy || null,
      headingText: legacy?.heading || headingLine,
    });
  }
  if (annexMarkers.length > 0) {
    const firstAnnexStart = annexMarkers[0].start;
    for (const node of internalNodes) {
      if (node.node_kind !== 'AGREEMENT'
        && node.node_kind !== 'ANNEX'
        && node.start < firstAnnexStart
        && node.end > firstAnnexStart) {
        node.end = firstAnnexStart;
      }
    }
  }

  const diagnostics = [];
  function addDiagnostic(type, diagnosticSpan, detail, severity = 'NOTICE') {
    const payload = {
      type,
      start_byte: diagnosticSpan ? diagnosticSpan.start_byte : null,
      detail,
    };
    diagnostics.push({
      schema_version: 'AGREEMENT_INDEX_DIAGNOSTIC/V1',
      diagnostic_id: contentId('AGREEMENT_INDEX_DIAGNOSTIC/V1', payload),
      diagnostic_type: type,
      severity,
      span: diagnosticSpan,
      detail,
    });
  }

  for (const rejected of sectionizer.rejected_inline_heading_candidates || []) {
    const start = Math.min(rejected.start || 0, sourceBytes.length - 1);
    addDiagnostic(
      'SECTIONIZER_REJECTED_INLINE_HEADING',
      span(start, Math.min(start + 1, sourceBytes.length)),
      rejected,
    );
  }
  for (const swallowed of sectionizer.swallowed_heading_residuals || []) {
    const start = Math.min(swallowed.start || 0, sourceBytes.length - 1);
    addDiagnostic(
      'SECTIONIZER_SWALLOWED_HEADING',
      span(start, Math.min(start + 1, sourceBytes.length)),
      swallowed,
      'REVIEW',
    );
  }

  const reviewedOverride = (policy.value.reviewed_structure_overrides || []).find(
    (entry) => entry.canonical_text_sha256 === exactSource.canonical_text_sha256
      && entry.operation === 'SPLIT_AND_REPARENT_DUPLICATE_LIMB',
  );
  if (reviewedOverride) {
    const {
      parent_marker_start_byte: hStart,
      nested_marker_start_byte: nestedStart,
      sibling_marker_start_byte: siblingStart,
      next_sibling_start_byte: nextSiblingStart,
    } = reviewedOverride;
    const section = internalNodes.find((node) => node.node_kind === 'SECTION'
      && node.reference === reviewedOverride.section_reference);
    const h = internalNodes.find((node) => node.node_kind === 'LIMB' && node.start === hStart);
    const nested = internalNodes.find((node) => node.node_kind === 'LIMB' && node.start === nestedStart);
    const topLevel = internalNodes.find((node) => node.node_kind === 'LIMB' && node.start === siblingStart);
    const nextSibling = internalNodes.find((node) => node.node_kind === 'LIMB'
      && node.start === nextSiblingStart);
    if (!section || !h || !nested || !topLevel || !nextSibling
      || byteText(hStart, hStart + 3) !== '(h)'
      || byteText(nestedStart, nestedStart + 3) !== '(i)'
      || byteText(siblingStart, siblingStart + 3) !== '(i)'
      || byteText(nextSiblingStart, nextSiblingStart + 3) !== '(j)') {
      fail('STRUCTURAL_POLICY_DIGEST_MISMATCH', `${reviewedOverride.override_id}: anchors do not match source`);
    }
    h.end = siblingStart;
    nested.parent_temp_id = h.temp_id;
    nested.reference = `${reviewedOverride.section_reference}(h)(i)`;
    nested.end = siblingStart;
    topLevel.parent_temp_id = section.temp_id;
    topLevel.reference = `${reviewedOverride.section_reference}(i)`;
    topLevel.end = nextSiblingStart;
    for (const node of internalNodes) {
      if (node === nested || node === topLevel) continue;
      if (node.reference && node.reference.startsWith(`${reviewedOverride.section_reference}(i)(`)
        && node.start < siblingStart) {
        node.reference = node.reference.replace(
          `${reviewedOverride.section_reference}(i)`,
          `${reviewedOverride.section_reference}(h)(i)`,
        );
        if (node.parent_temp_id === topLevel.temp_id) node.parent_temp_id = nested.temp_id;
        if (node.end > siblingStart) node.end = siblingStart;
      }
    }
    const limbM = internalNodes.find((node) => node.node_kind === 'LIMB'
      && node.reference === `${reviewedOverride.section_reference}(h)(i)(M)`);
    if (limbM) {
      const local = byteText(limbM.start, siblingStart);
      const sentenceEnd = local.indexOf('.');
      if (sentenceEnd >= 0) {
        limbM.end = limbM.start + Buffer.byteLength(local.slice(0, sentenceEnd + 1), 'utf8');
      }
    }
    addDiagnostic(
      'REVIEWED_STRUCTURE_OVERRIDE_APPLIED',
      span(hStart, nextSiblingStart),
      {
        override_id: reviewedOverride.override_id,
        result: 'STABLE_MARKER_OCCURRENCES_REPARENTED',
      },
    );
  }

  const sourceArtefacts = [];
  function addArtefact(kind, start, end) {
    if (!(end > start)) return;
    const occurrenceSpan = span(start, end);
    const sourceArtefactId = contentId('AGREEMENT_SOURCE_ARTEFACT/V1', {
      canonical_text_id: exactSource.canonical_text_id,
      source_artefact_kind: kind,
      start_byte: start,
      end_byte: end,
      text_sha256: occurrenceSpan.text_sha256,
    });
    sourceArtefacts.push({
      schema_version: SOURCE_ARTEFACT_SCHEMA_VERSION,
      source_artefact_id: sourceArtefactId,
      source_artefact_kind: kind,
      span: occurrenceSpan,
      containing_node_occurrence_id: null,
    });
  }

  const linePattern = /^(?:-\s*\d{1,4}\s*-|[A-Z]{1,3}-\d{1,4}|\d{1,3})$/gm;
  const bareCandidates = [];
  let lineMatch;
  while ((lineMatch = linePattern.exec(sourceText)) !== null) {
    const start = charToByte(lineMatch.index);
    const end = start + Buffer.byteLength(lineMatch[0], 'utf8');
    if (lineMatch[0].includes('-')) {
      addArtefact('PAGE_NUMBER', start, end);
    } else {
      bareCandidates.push({ start, end, value: Number(lineMatch[0]) });
    }
  }
  for (let index = 0; index < bareCandidates.length; index += 1) {
    const current = bareCandidates[index];
    const previous = bareCandidates[index - 1];
    const next = bareCandidates[index + 1];
    const continues = (previous
      && current.value === previous.value + 1
      && current.start - previous.start < 20000)
      || (next
        && next.value === current.value + 1
        && next.start - current.start < 20000);
    if (continues) addArtefact('PAGE_NUMBER', current.start, current.end);
  }
  for (let index = 0; index < sourceText.length; index += 1) {
    const character = sourceText[index];
    if (character === '\f') {
      const start = charToByte(index);
      addArtefact('FORM_FEED', start, start + 1);
    } else if (/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/u.test(character)) {
      const start = charToByte(index);
      addArtefact('CONVERSION_CONTROL', start, start + Buffer.byteLength(character, 'utf8'));
    }
  }
  sourceArtefacts.sort((left, right) => left.span.start_byte - right.span.start_byte);

  function meaningfulWithoutArtefacts(start, end) {
    if (!(end > start)) return false;
    let cursor = start;
    const pieces = [];
    for (const artefact of sourceArtefacts) {
      if (artefact.span.end_byte <= start) continue;
      if (artefact.span.start_byte >= end) break;
      if (artefact.span.start_byte > cursor) {
        pieces.push(sourceBytes.subarray(cursor, artefact.span.start_byte));
      }
      cursor = Math.max(cursor, artefact.span.end_byte);
    }
    if (cursor < end) pieces.push(sourceBytes.subarray(cursor, end));
    return Buffer.concat(pieces).toString('utf8').trim().length > 0;
  }

  function authoredTextWithoutArtefacts(start, end) {
    if (!(end > start)) return '';
    let cursor = start;
    const pieces = [];
    for (const artefact of sourceArtefacts) {
      if (artefact.span.end_byte <= start) continue;
      if (artefact.span.start_byte >= end) break;
      if (artefact.span.start_byte > cursor) {
        pieces.push(sourceBytes.subarray(cursor, artefact.span.start_byte));
      }
      cursor = Math.max(cursor, artefact.span.end_byte);
    }
    if (cursor < end) pieces.push(sourceBytes.subarray(cursor, end));
    return Buffer.concat(pieces).toString('utf8');
  }

  const annexDefinitionOverride = (policy.value.reviewed_structure_overrides || []).find(
    (entry) => entry.canonical_text_sha256 === exactSource.canonical_text_sha256
      && entry.operation === 'GROUP_ANNEX_DEFINITION_LISTS',
  );
  if (annexDefinitionOverride) {
    const annex = internalNodes.find((node) => node.node_kind === 'ANNEX'
      && node.reference === annexDefinitionOverride.annex_reference);
    if (!annex) {
      fail('STRUCTURAL_POLICY_DIGEST_MISMATCH',
        `${annexDefinitionOverride.override_id}: annex anchor is missing`);
    }
    for (const group of annexDefinitionOverride.groups || []) {
      const chapeauBytes = sourceBytes.subarray(group.chapeau_start_byte, group.chapeau_end_byte);
      if (group.paragraph_start_byte !== group.chapeau_start_byte
        || sha256Hex(chapeauBytes) !== group.chapeau_text_sha256
        || byteText(group.paragraph_end_byte,
          group.paragraph_end_byte + Buffer.byteLength(group.next_text, 'utf8')) !== group.next_text) {
        fail('STRUCTURAL_POLICY_DIGEST_MISMATCH',
          `${annexDefinitionOverride.override_id}: ${group.reference} text anchors drifted`);
      }
      const paragraph = addInternalNode({
        nodeKind: 'PARAGRAPH',
        start: group.paragraph_start_byte,
        end: group.paragraph_end_byte,
        reference: group.reference,
        roles: ['AUTHORED_PARAGRAPH', 'DEFINITION_BLOCK', 'STRUCTURAL_CONTAINER'],
        parentTempId: annex.temp_id,
      });
      addInternalNode({
        nodeKind: 'CHAPEAU',
        start: group.chapeau_start_byte,
        end: group.chapeau_end_byte,
        roles: ['GOVERNING_TEXT'],
        parentTempId: paragraph.temp_id,
      });
      let limbParent = paragraph;
      if (Array.isArray(group.outer_limbs) && group.outer_limbs.length > 0) {
        const outerLimbs = [];
        for (const outerAnchor of group.outer_limbs) {
          let outerLimb = internalNodes.find((node) => node.node_kind === 'LIMB'
            && node.start === outerAnchor.start_byte);
          if (!outerLimb) {
            outerLimb = addInternalNode({
              nodeKind: 'LIMB',
              start: outerAnchor.start_byte,
              end: outerAnchor.end_byte,
              reference: outerAnchor.reference,
              roles: ['AUTHORED_INLINE_LIMB', 'STRUCTURAL_CONTAINER'],
              parentTempId: paragraph.temp_id,
            });
          }
          if (!outerLimb
            || byteText(outerAnchor.start_byte,
              outerAnchor.start_byte + Buffer.byteLength(outerAnchor.marker, 'utf8'))
              !== outerAnchor.marker
            || !(outerAnchor.end_byte > outerAnchor.start_byte)
            || outerAnchor.end_byte > group.paragraph_end_byte) {
            fail('STRUCTURAL_POLICY_DIGEST_MISMATCH',
              `${annexDefinitionOverride.override_id}: ${outerAnchor.reference} marker drifted`);
          }
          outerLimb.end = outerAnchor.end_byte;
          outerLimb.reference = outerAnchor.reference;
          outerLimb.parent_temp_id = paragraph.temp_id;
          outerLimb.roles = [...new Set([
            ...outerLimb.roles,
            'AUTHORED_INLINE_LIMB',
            'STRUCTURAL_CONTAINER',
          ])].sort();
          outerLimbs.push(outerLimb);
        }
        limbParent = outerLimbs.at(-1);
      }
      for (const limbAnchor of group.limbs || []) {
        const limb = internalNodes.find((node) => node.node_kind === 'LIMB'
          && node.start === limbAnchor.start_byte);
        if (!limb
          || byteText(limbAnchor.start_byte,
            limbAnchor.start_byte + Buffer.byteLength(limbAnchor.marker, 'utf8'))
            !== limbAnchor.marker
          || !(limbAnchor.end_byte > limbAnchor.start_byte)
          || limbAnchor.end_byte > group.paragraph_end_byte) {
          fail('STRUCTURAL_POLICY_DIGEST_MISMATCH',
            `${annexDefinitionOverride.override_id}: ${limbAnchor.reference} marker drifted`);
        }
        limb.end = limbAnchor.end_byte;
        limb.reference = limbAnchor.reference;
        limb.parent_temp_id = limbParent.temp_id;
        limb.roles = [...new Set([
          ...limb.roles,
          'AUTHORED_INLINE_LIMB',
          'STRUCTURAL_CONTAINER',
        ])].sort();
      }
      if (group.trailing_qualification) {
        const qualification = group.trailing_qualification;
        const qualificationBytes = sourceBytes.subarray(
          qualification.start_byte,
          qualification.end_byte,
        );
        if (sha256Hex(qualificationBytes) !== qualification.text_sha256) {
          fail('STRUCTURAL_POLICY_DIGEST_MISMATCH',
            `${annexDefinitionOverride.override_id}: trailing qualification drifted`);
        }
        addInternalNode({
          nodeKind: 'QUALIFICATION',
          start: qualification.start_byte,
          end: qualification.end_byte,
          roles: ['AUTHORED_QUALIFICATION', 'TRAILING_QUALIFICATION'],
          parentTempId: limbParent.temp_id,
        });
      }
    }
    addDiagnostic(
      'REVIEWED_STRUCTURE_OVERRIDE_APPLIED',
      span(annexDefinitionOverride.groups[0].paragraph_start_byte,
        annexDefinitionOverride.groups.at(-1).paragraph_end_byte),
      {
        override_id: annexDefinitionOverride.override_id,
        result: 'ANNEX_DEFINITION_LISTS_GROUPED',
      },
    );
  }

  function directAuthoredChildren(parent) {
    return internalNodes
      .filter((node) => node.parent_temp_id === parent.temp_id)
      .sort((left, right) => left.start - right.start || left.end - right.end);
  }

  const markerAnnotations = [];
  const headingByParent = new Map();
  function addAnnotation(kind, start, end, value, ownerTempId = null, roles = []) {
    if (!(end > start)) return null;
    const annotationSpan = span(start, end);
    const annotation = {
      schema_version: SOURCE_ANNOTATION_SCHEMA_VERSION,
      annotation_occurrence_id: contentId('AGREEMENT_SOURCE_ANNOTATION/V1', {
        canonical_text_id: exactSource.canonical_text_id,
        annotation_kind: kind,
        start_byte: start,
        end_byte: end,
        value,
      }),
      annotation_kind: kind,
      roles: [...new Set(roles)].sort(),
      span: annotationSpan,
      owner_node_occurrence_id: null,
      owner_temp_id: ownerTempId,
      value,
    };
    if (kind === 'OUTLINE_MARKER') markerAnnotations.push(annotation);
    return annotation;
  }
  const annotations = [];

  function escapedPattern(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  }

  function markerSpanFor(node) {
    const prefix = byteText(node.start, Math.min(node.end, node.start + 128));
    let match = null;
    if (node.node_kind === 'ARTICLE') {
      match = /^ARTICLE\s+(?:[IVXLCDM]+|\d+)/i.exec(prefix);
    } else if (node.node_kind === 'ANNEX') {
      match = /^ANNEX\s+[A-Z0-9]+/i.exec(prefix);
    } else if (node.node_kind === 'SECTION' && node.reference) {
      match = new RegExp(
        `^(?:SECTION\\s+)?${escapedPattern(node.reference)}(?:\\.)?`,
        'i',
      ).exec(prefix);
    } else if (node.node_kind === 'LIMB') {
      match = /^\([A-Za-z0-9]{1,9}\)/.exec(prefix);
    }
    if (!match) return null;
    return { start: node.start, end: node.start + Buffer.byteLength(match[0], 'utf8') };
  }

  function inferredLimbHeading(node, firstChildStart) {
    if (node.node_kind !== 'LIMB') return null;
    const marker = markerSpanFor(node);
    if (!marker) return null;
    const limit = Math.min(node.end, firstChildStart || node.end, marker.end + 100);
    const afterMarker = byteText(marker.end, limit);
    const match = /^\s*([A-Z][A-Za-z0-9 ,;'&()\/-]{0,78}\.)\s/u.exec(afterMarker);
    if (!match) return null;
    const phrase = match[1].slice(0, -1);
    const significantWords = phrase
      .split(/[^A-Za-z]+/)
      .filter(Boolean)
      .filter((word) => !/^(?:and|as|at|by|for|from|in|of|on|or|the|to|with)$/i.test(word));
    if (significantWords.length === 0
      || significantWords.some((word) => !/^[A-Z]/.test(word))) return null;
    const leading = match[0].indexOf(match[1]);
    const start = marker.end + Buffer.byteLength(afterMarker.slice(0, leading), 'utf8');
    return { start, end: start + Buffer.byteLength(match[1], 'utf8') };
  }

  function headingSpanFor(node, legacyHeading, firstChildStart) {
    if (!legacyHeading || typeof legacyHeading !== 'string') {
      return inferredLimbHeading(node, firstChildStart);
    }
    const limit = Math.min(node.end, firstChildStart || node.end, node.start + 2048);
    if (!(limit > node.start)) return null;
    const prefix = byteText(node.start, limit);
    const match = new RegExp(escapedPattern(legacyHeading), 'i').exec(prefix);
    if (!match) return null;
    let matchedText = match[0];
    let following = prefix.slice(match.index + matchedText.length);
    if (following.startsWith('.')) {
      matchedText += '.';
      following = following.slice(1);
    }
    if (['ARTICLE', 'ANNEX'].includes(node.node_kind)) {
      let continuation = /^(\s*\r?\n)([A-Z][A-Z0-9 &;',.()\/-]{1,120})(?=\r?\n)/u.exec(following);
      while (continuation && !/^(?:[A-Z]{1,3}-\d{1,4}|-?\d{1,4}-?)$/u.test(continuation[2])) {
        matchedText += continuation[0];
        following = following.slice(continuation[0].length);
        continuation = /^(\s*\r?\n)([A-Z][A-Z0-9 &;',.()\/-]{1,120})(?=\r?\n)/u.exec(following);
      }
    }
    const start = node.start + Buffer.byteLength(prefix.slice(0, match.index), 'utf8');
    const end = start + Buffer.byteLength(matchedText, 'utf8');
    return end > start ? { start, end } : null;
  }

  const structuralSnapshot = internalNodes.filter((node) =>
    STRUCTURAL_KINDS.has(node.node_kind) || node.roles.includes('STRUCTURAL_CONTAINER'));
  for (const node of structuralSnapshot) {
    const children = directAuthoredChildren(node);
    const marker = markerSpanFor(node);
    if (marker) {
      annotations.push(addAnnotation(
        'OUTLINE_MARKER',
        marker.start,
        marker.end,
        node.reference,
        node.temp_id,
        ['STRUCTURAL_MARKER'],
      ));
    }
    const legacyHeading = node.heading_text || (node.legacy_node ? node.legacy_node.heading : null);
    const heading = headingSpanFor(node, legacyHeading, children[0]?.start);
    if (heading) {
      const headingNode = addInternalNode({
        nodeKind: 'HEADING',
        start: heading.start,
        end: heading.end,
        roles: ['AUTHORED_TITLE'],
        parentTempId: node.temp_id,
      });
      headingByParent.set(node.temp_id, headingNode);
    }
  }
  function localCharToByteMap(value) {
    const map = new Array(value.length + 1);
    let byte = 0;
    for (let index = 0; index < value.length;) {
      map[index] = byte;
      const codePoint = value.codePointAt(index);
      const width = codePoint > 0xffff ? 2 : 1;
      if (width === 2) map[index + 1] = byte;
      byte += Buffer.byteLength(String.fromCodePoint(codePoint), 'utf8');
      index += width;
      map[index] = byte;
    }
    return map;
  }

  function protectedBoundary(value, periodIndex) {
    if (value[periodIndex] !== '.') return false;
    if (/\d/.test(value[periodIndex - 1] || '') && /\d/.test(value[periodIndex + 1] || '')) {
      return true;
    }
    const prefix = value.slice(Math.max(0, periodIndex - 24), periodIndex + 1);
    if (/^[A-Z]\./.test(value.slice(periodIndex + 1))) return true;
    if (/(?:^|[^A-Za-z])(?:[A-Z]\.){2,}$/.test(prefix)) return true;
    if (PROTECTED_ABBREVIATION.test(prefix)) return true;
    if (/[A-Z]\.$/.test(prefix) && /^[A-Z][a-z]/.test(value.slice(periodIndex + 1).trimStart())) {
      return true;
    }
    return false;
  }

  function sentenceSpans(start, end) {
    const trimmed = trimSpan(start, end);
    if (!trimmed || !meaningfulWithoutArtefacts(trimmed.start, trimmed.end)) return [];
    const value = byteText(trimmed.start, trimmed.end);
    const charBytes = localCharToByteMap(value);
    const result = [];
    let sentenceStart = 0;
    for (let index = 0; index < value.length; index += 1) {
      const recitalJoin = value[index] === ';'
        ? /^(\s+and)?[ \t]*\r?\n[ \t]*(?=(?:WHEREAS\b|NOW,\s+THEREFORE\b))/iu
          .exec(value.slice(index + 1))
        : null;
      const recitalBoundary = Boolean(recitalJoin);
      if ((!'.?!'.includes(value[index]) || protectedBoundary(value, index))
        && !recitalBoundary) continue;
      let sentenceEnd = index + 1 + (recitalJoin?.[1]?.length || 0);
      while (sentenceEnd < value.length && CLOSING_PUNCTUATION.has(value[sentenceEnd])) {
        sentenceEnd += 1;
      }
      let next = sentenceEnd;
      while (next < value.length && /\s/u.test(value[next])) next += 1;
      const boundaryEnd = trimmed.start + charBytes[sentenceEnd];
      const sourceEnd = trimmed.start + charBytes[value.length];
      const atAuthoredEnd = !meaningfulWithoutArtefacts(boundaryEnd, sourceEnd);
      const nextVisible = value[next] || '';
      const startsProposition = recitalBoundary || /[A-Z\u201c"'(]/u.test(nextVisible);
      if (!atAuthoredEnd && !startsProposition) continue;
      const blockStart = trimmed.start + charBytes[sentenceStart];
      const blockEnd = boundaryEnd;
      const exact = trimSpan(blockStart, blockEnd);
      if (exact && meaningfulWithoutArtefacts(exact.start, exact.end)) result.push(exact);
      sentenceStart = next;
      index = Math.max(index, next - 1);
    }
    const residueStart = trimmed.start + charBytes[Math.min(sentenceStart, value.length)];
    if (meaningfulWithoutArtefacts(residueStart, trimmed.end)) {
      const residue = trimSpan(residueStart, trimmed.end);
      if (residue) result.push({ ...residue, paragraph: true });
    }
    return result;
  }

  function qualificationBounds(value, match) {
    const lower = match[0].toLowerCase();
    const after = value.slice(match.index + match[0].length);
    if (lower.startsWith('except') && value[match.index - 1] === '(') {
      const closingParenthesis = value.indexOf(')', match.index + match[0].length);
      if (closingParenthesis >= 0) {
        return { start: match.index - 1, end: closingParenthesis + 1 };
      }
    }
    if (lower.startsWith('subject to')) {
      const comma = after.indexOf(',');
      const numberedJoin = /(?=\s+(?:and|or)\s+\(\d+\))/i.exec(after);
      const candidates = [
        comma >= 0 ? match.index + match[0].length + comma + 1 : null,
        numberedJoin ? match.index + match[0].length + numberedJoin.index : null,
      ].filter((candidate) => candidate !== null);
      if (candidates.length > 0) return { start: match.index, end: Math.min(...candidates) };
    }
    if (lower.startsWith('except')) {
      const negativeSubject = /,(?=\s+(?:none|neither|no)\b)/i.exec(after);
      const boundary = /,(?=\s*(?:\(\d+\)|[A-Z][A-Za-z]+\s+(?:shall|will|may|must|is|are|has|have|made|constitutes)))/.exec(after);
      const candidates = [negativeSubject, boundary]
        .filter(Boolean)
        .map((candidate) => match.index + match[0].length + candidate.index + 1);
      if (candidates.length > 0) {
        return {
          start: match.index,
          end: Math.min(...candidates),
        };
      }
    }
    if (lower.startsWith('notwithstanding')) {
      const comma = after.indexOf(',');
      if (comma >= 0) {
        return { start: match.index, end: match.index + match[0].length + comma + 1 };
      }
    }
    return { start: match.index, end: value.length };
  }

  function addQualifications(sentenceNode) {
    const value = byteText(sentenceNode.start, sentenceNode.end);
    QUALIFICATION_PATTERN.lastIndex = 0;
    let match;
    let previousEnd = -1;
    while ((match = QUALIFICATION_PATTERN.exec(value)) !== null) {
      const bounds = qualificationBounds(value, match);
      if (!(bounds.end > bounds.start) || bounds.start < previousEnd) continue;
      const start = sentenceNode.start + Buffer.byteLength(value.slice(0, bounds.start), 'utf8');
      const end = sentenceNode.start + Buffer.byteLength(value.slice(0, bounds.end), 'utf8');
      const exact = trimSpan(start, end);
      if (!exact) continue;
      addInternalNode({
        nodeKind: 'QUALIFICATION',
        start: exact.start,
        end: exact.end,
        roles: ['AUTHORED_QUALIFICATION'],
        parentTempId: sentenceNode.temp_id,
      });
      previousEnd = bounds.end;
    }
  }

  function addTextBlocks(parent, start, end, preferChapeau = false) {
    const trimmed = trimSpan(start, end);
    if (!trimmed || !meaningfulWithoutArtefacts(trimmed.start, trimmed.end)) return;
    for (const block of sentenceSpans(trimmed.start, trimmed.end)) {
      const blockText = authoredTextWithoutArtefacts(block.start, block.end).trim();
      const isChapeau = preferChapeau && block.paragraph && /:$/.test(blockText);
      addInternalNode({
        nodeKind: isChapeau ? 'CHAPEAU' : block.paragraph ? 'PARAGRAPH' : 'SENTENCE',
        start: block.start,
        end: block.end,
        roles: [isChapeau
          ? 'GOVERNING_TEXT'
          : block.paragraph ? 'AUTHORED_PARAGRAPH' : 'AUTHORED_SENTENCE'],
        parentTempId: parent.temp_id,
      });
    }
  }

  for (const parent of structuralSnapshot) {
    const children = directAuthoredChildren(parent)
      .filter((child) => child.node_kind !== 'HEADING');
    const marker = markerSpanFor(parent);
    const heading = headingByParent.get(parent.temp_id);
    let cursor = Math.max(parent.start, marker?.end || parent.start, heading?.end || parent.start);
    if (children.length === 0) {
      addTextBlocks(parent, cursor, parent.end, false);
      continue;
    }
    for (let index = 0; index < children.length; index += 1) {
      const child = children[index];
      if (child.start > cursor) addTextBlocks(
        parent,
        cursor,
        child.start,
        index === 0 && (['ARTICLE', 'SECTION', 'LIMB'].includes(parent.node_kind)
          || parent.roles.includes('DEFINITION_BLOCK')),
      );
      cursor = Math.max(cursor, child.end);
    }
    if (cursor < parent.end) addTextBlocks(parent, cursor, parent.end, false);
  }

  for (const legacy of syntheticIntroContainers.values()) {
    const parentTempId = authoredLegacyParentTempId(legacy.parent_section_id);
    const authoredChapeau = internalNodes.find((node) => node.node_kind === 'CHAPEAU'
      && node.parent_temp_id === parentTempId
      && node.start >= legacy.start
      && node.end <= legacy.end);
    const target = authoredChapeau || headingByParent.get(parentTempId);
    if (!target || target.start < legacy.start || target.end > legacy.end) {
      fail('STRUCTURAL_POLICY_DIGEST_MISMATCH',
        `${legacy.reference}: synthetic introduction has no authored replacement`);
    }
    legacyToTemp.set(legacy.section_id, target.temp_id);
  }
  for (const legacy of syntheticAnnexArticles.values()) {
    const annex = internalNodes.find((node) => node.node_kind === 'ANNEX'
      && node.start === legacy.start);
    const target = annex ? headingByParent.get(annex.temp_id) : null;
    if (!target) {
      fail('STRUCTURAL_POLICY_DIGEST_MISMATCH',
        `${legacy.reference}: synthetic annex article has no authored heading`);
    }
    legacyToTemp.set(legacy.section_id, target.temp_id);
  }

  if (reviewedOverride) {
    const nested = internalNodes.find((node) => node.node_kind === 'LIMB'
      && node.reference === `${reviewedOverride.section_reference}(h)(i)`);
    const governedSentence = internalNodes.find((node) => node.node_kind === 'SENTENCE'
      && node.parent_temp_id === nested?.temp_id
      && node.start >= reviewedOverride.nested_marker_start_byte
      && node.end <= reviewedOverride.sibling_marker_start_byte
      && byteText(node.start, Math.min(node.end, node.start + 10)).startsWith('Except for'));
    if (nested && governedSentence) {
      addQualifications(governedSentence);
      const firstMarker = sourceBytes.indexOf(Buffer.from('(1)', 'utf8'), governedSentence.start);
      const secondMarker = sourceBytes.indexOf(Buffer.from('(2)', 'utf8'), firstMarker + 3);
      const firstEnd = secondMarker - Buffer.byteLength(' and ', 'utf8');
      if (firstMarker >= governedSentence.start
        && firstEnd > firstMarker
        && secondMarker > firstEnd
        && secondMarker < governedSentence.end) {
        const firstLimb = addInternalNode({
          nodeKind: 'LIMB',
          start: firstMarker,
          end: firstEnd,
          reference: `${nested.reference}(1)`,
          roles: ['AUTHORED_INLINE_LIMB'],
          parentTempId: governedSentence.temp_id,
        });
        const secondLimb = addInternalNode({
          nodeKind: 'LIMB',
          start: secondMarker,
          end: governedSentence.end,
          reference: `${nested.reference}(2)`,
          roles: ['AUTHORED_INLINE_LIMB'],
          parentTempId: governedSentence.temp_id,
        });
        for (const qualification of internalNodes.filter((node) =>
          node.node_kind === 'QUALIFICATION'
          && node.parent_temp_id === governedSentence.temp_id)) {
          if (qualification.start >= firstLimb.start && qualification.end <= firstLimb.end) {
            qualification.parent_temp_id = firstLimb.temp_id;
          } else if (qualification.start >= secondLimb.start
            && qualification.end <= secondLimb.end) {
            qualification.parent_temp_id = secondLimb.temp_id;
          }
        }
        annotations.push(addAnnotation(
          'OUTLINE_MARKER',
          firstMarker,
          firstMarker + 3,
          firstLimb.reference,
          firstLimb.temp_id,
          ['STRUCTURAL_MARKER'],
        ));
        annotations.push(addAnnotation(
          'OUTLINE_MARKER',
          secondMarker,
          secondMarker + 3,
          secondLimb.reference,
          secondLimb.temp_id,
          ['STRUCTURAL_MARKER'],
        ));
      }
    }
  }

  const inlineMarkerDispositionDrafts = [];
  const inlineAmbiguityDrafts = [];
  const inlineMarkerCandidateDrafts = [];
  const inlineScannedTempIds = [];

  function nearestReference(node) {
    let cursor = node;
    const seen = new Set();
    while (cursor) {
      if (seen.has(cursor.temp_id)) {
        fail('STRUCTURAL_POLICY_DIGEST_MISMATCH', 'inline-list reference ancestry cycle');
      }
      seen.add(cursor.temp_id);
      if (cursor.reference) return cursor.reference;
      cursor = cursor.parent_temp_id === null
        ? null
        : internalByTempId.get(cursor.parent_temp_id);
    }
    return null;
  }

  function deepestInternalOwner(container, start, end) {
    let owner = container;
    while (owner) {
      const child = directAuthoredChildren(owner).find((candidate) =>
        candidate.start <= start && candidate.end >= end);
      if (!child) return owner;
      owner = child;
    }
    return container;
  }

  const inlineTextCandidates = internalNodes.filter((node) =>
    ['SENTENCE', 'PARAGRAPH'].includes(node.node_kind));
  const inlineTextNodes = inlineTextCandidates
    .filter((node) => !inlineTextCandidates.some((candidate) =>
      candidate.temp_id !== node.temp_id
        && candidate.start <= node.start
        && candidate.end >= node.end
        && candidate.end - candidate.start > node.end - node.start))
    .sort((left, right) => left.start - right.start || right.end - left.end);
  for (const textNode of inlineTextNodes) {
    const value = byteText(textNode.start, textNode.end);
    const charBytes = localCharToByteMap(value);
    const charToAbsoluteByte = (offset) => textNode.start + charBytes[offset];
    const parsed = segmentAuthoredInlineLists(value, {
      maximumDepth: policy.value.inline_list_policy.maximum_depth,
    });
    inlineScannedTempIds.push(textNode.temp_id);
    for (const candidate of parsed.candidate_markers) {
      inlineMarkerCandidateDrafts.push({
        owner_temp_id: textNode.temp_id,
        label: candidate.label,
        span: span(
          charToAbsoluteByte(candidate.start),
          charToAbsoluteByte(candidate.end),
        ),
      });
    }
    if (parsed.schema_version !== INLINE_STRUCTURE_SCHEMA_VERSION
      || parsed.parser_version !== INLINE_STRUCTURE_PARSER_VERSION
      || parsed.coordinate_system !== OFFSET_COORDINATE_SYSTEM
      || parsed.maximum_depth !== policy.value.inline_list_policy.maximum_depth) {
      fail('STRUCTURAL_POLICY_DIGEST_MISMATCH',
        `inline parser contract drifted at ${textNode.start}`);
    }
    const tableOfContentsBlock = textNode.start === 0 && /TABLE OF CONTENTS/u.test(value);
    const materializedByList = new Map();
    const materializedByQualificationBlock = new Map();

    function existingInlineChildren(container, list) {
      const children = directAuthoredChildren(container)
        .filter((child) => child.node_kind === 'LIMB');
      const exact = list.items.map((item) => children.find((child) =>
        child.start === charToAbsoluteByte(item.start)) || null);
      if (!exact.every(Boolean)) return null;
      for (const child of exact) {
        child.roles = [...new Set([...child.roles, 'AUTHORED_INLINE_LIMB'])].sort();
      }
      return exact;
    }

    function materializeQualificationBlock(block, container, baseReference, trailing = true) {
      if (!block || tableOfContentsBlock) return null;
      if (materializedByQualificationBlock.has(block)) {
        return materializedByQualificationBlock.get(block);
      }
      const start = charToAbsoluteByte(block.start);
      const end = charToAbsoluteByte(block.end);
      let qualification = directAuthoredChildren(container).find((child) =>
        child.node_kind === 'QUALIFICATION' && child.start === start && child.end === end);
      if (!qualification) {
        const overlaps = directAuthoredChildren(container).filter((child) =>
          child.start < end && child.end > start);
        if (overlaps.length > 0) return null;
        qualification = addInternalNode({
          nodeKind: 'QUALIFICATION',
          start,
          end,
          roles: trailing
            ? ['AUTHORED_QUALIFICATION', 'TRAILING_QUALIFICATION']
            : ['AUTHORED_QUALIFICATION'],
          parentTempId: container.temp_id,
        });
      }
      if (!qualification) return null;
      materializedByQualificationBlock.set(block, qualification);
      for (const childList of block.child_lists || []) {
        materializeList(childList, qualification, baseReference);
      }
      for (const nestedQualification of block.qualification_blocks || []) {
        materializeQualificationBlock(
          nestedQualification,
          qualification,
          baseReference,
          true,
        );
      }
      return qualification;
    }

    function nestedTextCarrier(container, list) {
      const start = charToAbsoluteByte(list.items[0].marker_start);
      const end = charToAbsoluteByte(list.end);
      const carriers = directAuthoredChildren(container)
        .filter((child) => ['SENTENCE', 'PARAGRAPH'].includes(child.node_kind)
          && child.start <= start)
        .sort((left, right) => left.end - left.start - (right.end - right.start));
      const containing = carriers.find((child) => child.end >= end);
      if (containing) return containing;
      const extendable = carriers.find((child) => child.end < end
        && end <= container.end
        && !meaningfulWithoutArtefacts(child.end, end));
      if (extendable) {
        extendable.end = end;
        return extendable;
      }
      return container;
    }

    function materializeList(list, container, baseReference) {
      if (!list || tableOfContentsBlock) return [];
      let limbs = existingInlineChildren(container, list);
      if (!limbs) {
        if (list.chapeau) {
          addInternalNode({
            nodeKind: 'CHAPEAU',
            start: charToAbsoluteByte(list.chapeau.start),
            end: charToAbsoluteByte(list.chapeau.end),
            roles: ['GOVERNING_TEXT'],
            parentTempId: container.temp_id,
          });
        }
        limbs = list.items.map((item) => {
          const reference = baseReference ? `${baseReference}(${item.label})` : null;
          const limb = addInternalNode({
            nodeKind: 'LIMB',
            start: charToAbsoluteByte(item.start),
            end: charToAbsoluteByte(item.end),
            reference,
            roles: ['AUTHORED_INLINE_LIMB', 'STRUCTURAL_CONTAINER'],
            parentTempId: container.temp_id,
          });
          annotations.push(addAnnotation(
            'OUTLINE_MARKER',
            charToAbsoluteByte(item.marker_start),
            charToAbsoluteByte(item.marker_end),
            reference || `(${item.label})`,
            limb.temp_id,
            ['STRUCTURAL_MARKER'],
          ));
          return limb;
        });
      }
      materializedByList.set(list, { container, limbs });
      for (const [index, item] of list.items.entries()) {
        for (const childList of item.child_lists || []) {
          materializeList(
            childList,
            nestedTextCarrier(limbs[index], childList),
            limbs[index].reference,
          );
        }
        for (const qualificationBlock of item.qualification_blocks || []) {
          materializeQualificationBlock(
            qualificationBlock,
            limbs[index],
            limbs[index].reference,
            true,
          );
        }
      }
      if (list.trailing_qualification) {
        materializeQualificationBlock(
          list.trailing_qualification,
          container,
          baseReference,
          true,
        );
      }
      return limbs;
    }

    const rootReference = nearestReference(textNode);
    for (const rootList of parsed.root_lists || []) {
      materializeList(rootList, textNode, rootReference);
    }
    for (const rootQualification of parsed.root_qualification_blocks || []) {
      materializeQualificationBlock(rootQualification, textNode, rootReference, true);
    }

    for (const disposition of parsed.marker_dispositions) {
      const markerOffsets = disposition.marker_offsets;
      const start = charToAbsoluteByte(markerOffsets[0].start);
      const end = charToAbsoluteByte(markerOffsets.at(-1).end);
      let finalDisposition = disposition.disposition;
      let reason = disposition.reason;
      const style = disposition.style || 'UNCLASSIFIED';
      let parent = deepestInternalOwner(textNode, start, end);
      let producedTempIds = [];
      if (disposition.disposition === 'AUTHORED_INLINE_LIST') {
        const list = parsed.lists.find((candidate) =>
          candidate.style === disposition.style
            && candidate.depth === disposition.depth
            && candidate.items.length === disposition.marker_offsets.length
            && candidate.items.every((item, index) =>
              item.marker_start === disposition.marker_offsets[index].start));
        const materialized = list ? materializedByList.get(list) : null;
        if (tableOfContentsBlock) {
          finalDisposition = 'NON_STRUCTURAL_MARKER';
          reason = 'TABLE_OF_CONTENTS_REFERENCE';
          parent = textNode;
        } else if (!materialized) {
          finalDisposition = 'UNRESOLVED_INLINE_LIST';
          reason = 'CROSSING_LIST_BOUNDARY';
          parent = textNode;
        } else {
          parent = materialized.container;
          producedTempIds = materialized.limbs.map((limb) => limb.temp_id);
        }
      }
      const draft = {
        disposition: finalDisposition,
        reason,
        style,
        depth: Number.isInteger(disposition.depth) ? disposition.depth : null,
        parent_temp_id: parent.temp_id,
        marker_spans: markerOffsets.map((marker) => span(
          charToAbsoluteByte(marker.start),
          charToAbsoluteByte(marker.end),
        )),
        produced_temp_ids: producedTempIds,
      };
      inlineMarkerDispositionDrafts.push(draft);
      if (finalDisposition === 'UNRESOLVED_INLINE_LIST') {
        inlineAmbiguityDrafts.push({
          start,
          end,
          parent_temp_id: parent.temp_id,
          reason,
          disposition_draft: draft,
        });
      }
    }
  }

  const qualificationParents = internalNodes.filter((node) =>
    ['CHAPEAU', 'LIMB', 'PARAGRAPH', 'SENTENCE'].includes(node.node_kind));
  for (const parent of qualificationParents) {
    let ancestor = parent.parent_temp_id === null
      ? null
      : internalByTempId.get(parent.parent_temp_id);
    let insideQualification = false;
    while (ancestor) {
      if (ancestor.node_kind === 'QUALIFICATION') {
        insideQualification = true;
        break;
      }
      ancestor = ancestor.parent_temp_id === null
        ? null
        : internalByTempId.get(ancestor.parent_temp_id);
    }
    if (insideQualification) continue;
    const children = directAuthoredChildren(parent);
    if (children.some((child) => child.node_kind === 'QUALIFICATION')) continue;
    if (children.some((child) => child.node_kind !== 'HEADING')) continue;
    addQualifications(parent);
  }

  const occurrenceByTemp = new Map();
  const seenOccurrenceIds = new Set();
  for (const node of internalNodes) {
    node.node_occurrence_id = contentId('AGREEMENT_SOURCE_NODE_OCCURRENCE/V1', {
      canonical_text_id: exactSource.canonical_text_id,
      node_kind: node.node_kind,
      start_byte: node.start,
    });
    if (seenOccurrenceIds.has(node.node_occurrence_id)) {
      addDiagnostic(
        'NODE_COLLISION_DROPPED',
        span(node.start, node.end),
        { node_kind: node.node_kind, reference: node.reference },
        'REVIEW',
      );
    }
    seenOccurrenceIds.add(node.node_occurrence_id);
    occurrenceByTemp.set(node.temp_id, node.node_occurrence_id);
  }

  const inlineMarkerDispositions = inlineMarkerDispositionDrafts.map((draft) => {
    const payload = {
      schema_version: INLINE_MARKER_DISPOSITION_SCHEMA_VERSION,
      disposition: draft.disposition,
      reason: draft.reason,
      style: draft.style,
      depth: draft.depth,
      parent_node_occurrence_id: occurrenceByTemp.get(draft.parent_temp_id),
      marker_spans: draft.marker_spans,
      produced_limb_node_occurrence_ids: draft.produced_temp_ids.map((tempId) =>
        occurrenceByTemp.get(tempId)),
    };
    const disposition = {
      schema_version: INLINE_MARKER_DISPOSITION_SCHEMA_VERSION,
      disposition_id: contentId(INLINE_MARKER_DISPOSITION_SCHEMA_VERSION, payload),
      disposition: payload.disposition,
      reason: payload.reason,
      style: payload.style,
      depth: payload.depth,
      parent_node_occurrence_id: payload.parent_node_occurrence_id,
      marker_spans: payload.marker_spans,
      produced_limb_node_occurrence_ids: payload.produced_limb_node_occurrence_ids,
    };
    draft.disposition_id = disposition.disposition_id;
    return disposition;
  }).sort((left, right) => left.marker_spans[0].start_byte - right.marker_spans[0].start_byte
    || left.disposition.localeCompare(right.disposition)
    || left.disposition_id.localeCompare(right.disposition_id));

  const inlineMarkerCandidates = inlineMarkerCandidateDrafts.map((draft) => {
    const payload = {
      schema_version: INLINE_MARKER_CANDIDATE_SCHEMA_VERSION,
      owner_node_occurrence_id: occurrenceByTemp.get(draft.owner_temp_id),
      label: draft.label,
      span: draft.span,
    };
    return {
      schema_version: payload.schema_version,
      candidate_id: contentId(INLINE_MARKER_CANDIDATE_SCHEMA_VERSION, payload),
      owner_node_occurrence_id: payload.owner_node_occurrence_id,
      label: payload.label,
      span: payload.span,
    };
  }).sort((left, right) => left.span.start_byte - right.span.start_byte
    || left.span.end_byte - right.span.end_byte
    || left.candidate_id.localeCompare(right.candidate_id));

  const compareMarkerSpans = (left, right) => left.start_byte - right.start_byte
    || left.end_byte - right.end_byte
    || left.text_sha256.localeCompare(right.text_sha256);
  const candidateMarkerSpans = inlineMarkerCandidates.map((candidate) => candidate.span)
    .sort(compareMarkerSpans);
  const dispositionMarkerSpans = inlineMarkerDispositions
    .flatMap((disposition) => disposition.marker_spans)
    .sort(compareMarkerSpans);
  const markerSpanKey = (markerSpan) => `${markerSpan.start_byte}:${markerSpan.end_byte}`;
  if (new Set(candidateMarkerSpans.map(markerSpanKey)).size !== candidateMarkerSpans.length
    || new Set(dispositionMarkerSpans.map(markerSpanKey)).size !== dispositionMarkerSpans.length
    || canonicalJson(candidateMarkerSpans) !== canonicalJson(dispositionMarkerSpans)) {
    fail('INLINE_MARKER_PARTITION_MISMATCH', 'candidate markers are not exactly partitioned');
  }
  const candidateMarkerSpanSetDigest = contentId(
    INLINE_MARKER_SPAN_SET_DOMAIN,
    candidateMarkerSpans,
  );
  const dispositionMarkerSpanSetDigest = contentId(
    INLINE_MARKER_SPAN_SET_DOMAIN,
    dispositionMarkerSpans,
  );
  const inlineMarkerPartitionPayload = {
    schema_version: INLINE_MARKER_PARTITION_SCHEMA_VERSION,
    scanned_node_occurrence_ids: [...new Set(inlineScannedTempIds.map((tempId) =>
      occurrenceByTemp.get(tempId)))],
    candidate_markers: inlineMarkerCandidates,
    candidate_count: inlineMarkerCandidates.length,
    disposition_count: inlineMarkerDispositions.length,
    candidate_marker_span_set_digest: candidateMarkerSpanSetDigest,
    disposition_marker_span_set_digest: dispositionMarkerSpanSetDigest,
    exact_partition: true,
  };
  const inlineMarkerPartition = {
    schema_version: inlineMarkerPartitionPayload.schema_version,
    proof_digest: contentId(
      INLINE_MARKER_PARTITION_SCHEMA_VERSION,
      inlineMarkerPartitionPayload,
    ),
    scanned_node_occurrence_ids: inlineMarkerPartitionPayload.scanned_node_occurrence_ids,
    candidate_markers: inlineMarkerPartitionPayload.candidate_markers,
    candidate_count: inlineMarkerPartitionPayload.candidate_count,
    disposition_count: inlineMarkerPartitionPayload.disposition_count,
    candidate_marker_span_set_digest:
      inlineMarkerPartitionPayload.candidate_marker_span_set_digest,
    disposition_marker_span_set_digest:
      inlineMarkerPartitionPayload.disposition_marker_span_set_digest,
    exact_partition: inlineMarkerPartitionPayload.exact_partition,
  };

  const ambiguities = inlineAmbiguityDrafts.map((draft) => {
    const payload = {
      schema_version: 'AGREEMENT_STRUCTURE_AMBIGUITY/V1',
      ambiguity_type: 'UNRESOLVED_INLINE_LIST',
      status: 'OPEN',
      node_occurrence_ids: [occurrenceByTemp.get(draft.parent_temp_id)],
      span: span(draft.start, draft.end),
      detail: {
        inline_marker_disposition_id: draft.disposition_draft.disposition_id,
        parser_version: INLINE_STRUCTURE_PARSER_VERSION,
        reason: draft.reason,
        competing_readings: ['AUTHORED_LIST', 'CROSS_REFERENCE'],
      },
    };
    return {
      schema_version: payload.schema_version,
      ambiguity_id: contentId(payload.schema_version, payload),
      ambiguity_type: payload.ambiguity_type,
      status: payload.status,
      node_occurrence_ids: payload.node_occurrence_ids,
      span: payload.span,
      detail: payload.detail,
    };
  }).sort((left, right) => left.span.start_byte - right.span.start_byte
    || left.ambiguity_id.localeCompare(right.ambiguity_id));

  const childrenByParent = new Map();
  for (const node of internalNodes) {
    if (node.parent_temp_id === null) continue;
    if (!childrenByParent.has(node.parent_temp_id)) childrenByParent.set(node.parent_temp_id, []);
    childrenByParent.get(node.parent_temp_id).push(node);
  }
  for (const children of childrenByParent.values()) {
    children.sort((left, right) => left.start - right.start
      || left.end - right.end
      || left.node_kind.localeCompare(right.node_kind));
  }

  const publicNodes = internalNodes
    .sort((left, right) => left.start - right.start
      || right.end - left.end
      || left.node_kind.localeCompare(right.node_kind))
    .map((node) => {
      const siblings = node.parent_temp_id === null ? [node] : childrenByParent.get(node.parent_temp_id);
      const childOrdinal = node.parent_temp_id === null ? 0 : siblings.indexOf(node);
      const childIds = (childrenByParent.get(node.temp_id) || [])
        .map((child) => occurrenceByTemp.get(child.temp_id));
      const parentId = node.parent_temp_id === null
        ? null
        : occurrenceByTemp.get(node.parent_temp_id);
      const structureRevisionId = contentId('AGREEMENT_SOURCE_NODE_REVISION/V1', {
        node_occurrence_id: node.node_occurrence_id,
        end_byte: node.end,
        parent_node_occurrence_id: parentId,
        child_ordinal: childOrdinal,
        child_node_occurrence_ids: childIds,
        roles: node.roles,
        reference: node.reference,
        structural_policy_digest: policy.digest,
      });
      node.structure_revision_id = structureRevisionId;
      return {
        schema_version: SOURCE_NODE_SCHEMA_VERSION,
        node_occurrence_id: node.node_occurrence_id,
        structure_revision_id: structureRevisionId,
        node_kind: node.node_kind,
        roles: node.roles,
        reference: node.reference,
        parent_node_occurrence_id: parentId,
        child_ordinal: childOrdinal,
        extent_span: span(node.start, node.end),
        child_node_occurrence_ids: childIds,
      };
    });
  function deepestOwner(start, end) {
    let owner = internalNodes.find((node) => node.parent_temp_id === null);
    while (owner) {
      const child = (childrenByParent.get(owner.temp_id) || []).find(
        (candidate) => candidate.start <= start && candidate.end >= end,
      );
      if (!child) break;
      owner = child;
    }
    return owner;
  }

  for (const annotation of annotations) {
    const owner = annotation.owner_temp_id
      ? internalByTempId.get(annotation.owner_temp_id)
      : deepestOwner(annotation.span.start_byte, annotation.span.end_byte);
    annotation.owner_node_occurrence_id = owner.node_occurrence_id;
    delete annotation.owner_temp_id;
  }

  const outlineMarkers = annotations
    .filter((annotation) => annotation.annotation_kind === 'OUTLINE_MARKER');
  const referenceAtom = '(?:\\d+(?:\\.\\d+)+(?:\\([A-Za-z0-9]+\\))*|\\([A-Za-z0-9]+\\)(?:\\([A-Za-z0-9]+\\))*)';
  const sectionReferencePattern = new RegExp(
    `\\b(Sections?)\\s+(${referenceAtom}(?:(?:\\s*,\\s*(?:(?:and|or)\\s+)?|\\s+(?:and|or|through|to)\\s+)${referenceAtom})*)`,
    'gi',
  );
  const referenceTokenPattern = new RegExp(referenceAtom, 'g');
  function referenceLabelKind(label) {
    if (/^\d+$/.test(label)) return 'DIGIT';
    if (/^[A-Z]+$/.test(label)) return 'UPPER';
    if (/^[ivxlcdm]+$/.test(label)) return 'ROMAN';
    return 'LOWER';
  }
  function expandRelativeReference(base, token) {
    if (/^\d/.test(token)) return token;
    const root = /^\d+(?:\.\d+)+/.exec(base)?.[0];
    if (!root) return token;
    const baseLabels = [...base.matchAll(/\(([A-Za-z0-9]+)\)/g)].map((match) => match[1]);
    const tokenLabels = [...token.matchAll(/\(([A-Za-z0-9]+)\)/g)].map((match) => match[1]);
    if (tokenLabels.length === 0) return token;
    const targetKind = referenceLabelKind(tokenLabels[0]);
    let replacementIndex = -1;
    for (let index = baseLabels.length - 1; index >= 0; index -= 1) {
      if (referenceLabelKind(baseLabels[index]) === targetKind) {
        replacementIndex = index;
        break;
      }
    }
    const prefixLabels = replacementIndex >= 0 ? baseLabels.slice(0, replacementIndex) : [];
    return `${root}${prefixLabels.map((label) => `(${label})`).join('')}${token}`;
  }
  let referenceMatch;
  while ((referenceMatch = sectionReferencePattern.exec(sourceText)) !== null) {
    const bodyCharStart = referenceMatch.index + referenceMatch[0].indexOf(referenceMatch[2]);
    referenceTokenPattern.lastIndex = 0;
    let tokenMatch;
    let baseReference = null;
    let tokenOrdinal = 0;
    while ((tokenMatch = referenceTokenPattern.exec(referenceMatch[2])) !== null) {
      const token = tokenMatch[0];
      const value = expandRelativeReference(baseReference, token);
      if (/^\d/.test(value)) baseReference = value;
      const tokenStartChar = bodyCharStart + tokenMatch.index;
      const startChar = tokenOrdinal === 0 ? referenceMatch.index : tokenStartChar;
      const endChar = tokenStartChar + token.length;
      const start = charToByte(startChar);
      const end = charToByte(endChar);
      tokenOrdinal += 1;
      if (outlineMarkers.some((marker) => marker.span.start_byte <= start
        && marker.span.end_byte >= end)) continue;
      const owner = deepestOwner(start, end);
      const annotation = addAnnotation(
        'SECTION_REFERENCE',
        start,
        end,
        value,
        owner.temp_id,
        ['CROSS_REFERENCE'],
      );
      annotation.owner_node_occurrence_id = owner.node_occurrence_id;
      delete annotation.owner_temp_id;
      annotations.push(annotation);
    }
  }

  const quotedTermPattern = /[\u201c"]([^\u201d"\n]{1,120})[\u201d"]/g;
  const quotedSpans = [];
  const quotedOccurrences = [];
  const definedTerms = new Set();
  const definedTermAnnotationKeys = new Set();
  const quotedAliasPattern = '[\u201c"]([^\u201d"\\n]{1,120})[\u201d"]';
  const definitionPredicatePattern = '(?:means|shall mean|has the meaning|shall have the meaning)';
  const definitionHeadTailPattern = new RegExp(
    `^(?:\\s*(?:,?\\s*(?:and|or)\\s+|,?\\s*including\\s+the\\s+correlative\\s+term\\s+)${quotedAliasPattern})*\\s*${definitionPredicatePattern}\\b`,
    'i',
  );
  let termMatch;
  while ((termMatch = quotedTermPattern.exec(sourceText)) !== null) {
    const start = charToByte(termMatch.index);
    const end = start + Buffer.byteLength(termMatch[0], 'utf8');
    const value = termMatch[1].replace(/[\s.,;:]+$/u, '').trim();
    if (!value) continue;
    const prefix = sourceText.slice(Math.max(0, termMatch.index - 140), termMatch.index);
    const suffix = sourceText.slice(termMatch.index + termMatch[0].length,
      termMatch.index + termMatch[0].length + 320);
    const introducedBefore = /\breferred to(?:(?:\s+(?:collectively|individually|herein|hereinafter))|(?:\s+in this Agreement))*\s+as\s+(?:(?:the|a|an)\s+)?$/i.test(prefix);
    const parentheticalIntroduction = /\((?:the|an?)\s*$/i.test(prefix)
      && /^\s*\)/.test(suffix);
    const isDefinition = introducedBefore
      || parentheticalIntroduction
      || definitionHeadTailPattern.test(suffix);
    quotedOccurrences.push({ start, end, value, isDefinition });
    quotedSpans.push({ startChar: termMatch.index, endChar: termMatch.index + termMatch[0].length });
    if (isDefinition) definedTerms.add(value);
  }
  for (const occurrence of quotedOccurrences) {
    if (!occurrence.isDefinition && !definedTerms.has(occurrence.value)) continue;
    const kind = occurrence.isDefinition
      ? 'DEFINED_TERM_DEFINITION'
      : 'DEFINED_TERM_USE';
    const owner = deepestOwner(occurrence.start, occurrence.end);
    const annotation = addAnnotation(
      kind,
      occurrence.start,
      occurrence.end,
      occurrence.value,
      owner.temp_id,
      ['DEFINED_TERM'],
    );
    annotation.owner_node_occurrence_id = owner.node_occurrence_id;
    delete annotation.owner_temp_id;
    annotations.push(annotation);
    definedTermAnnotationKeys.add(`${occurrence.start}:${occurrence.end}`);
  }
  for (const term of [...definedTerms].sort((left, right) => right.length - left.length
    || left.localeCompare(right))) {
    let cursor = 0;
    while ((cursor = sourceText.indexOf(term, cursor)) !== -1) {
      const startChar = cursor;
      const endChar = cursor + term.length;
      cursor = endChar;
      if (/[A-Za-z0-9]/.test(sourceText[startChar - 1] || '')
        || /[A-Za-z0-9]/.test(sourceText[endChar] || '')
        || quotedSpans.some((quoted) => quoted.startChar <= startChar
          && quoted.endChar >= endChar)) continue;
      const start = charToByte(startChar);
      const end = charToByte(endChar);
      if (definedTermAnnotationKeys.has(`${start}:${end}`)) continue;
      const owner = deepestOwner(start, end);
      const annotation = addAnnotation(
        'DEFINED_TERM_USE',
        start,
        end,
        term,
        owner.temp_id,
        ['DEFINED_TERM'],
      );
      annotation.owner_node_occurrence_id = owner.node_occurrence_id;
      delete annotation.owner_temp_id;
      annotations.push(annotation);
      definedTermAnnotationKeys.add(`${start}:${end}`);
    }
  }
  annotations.sort((left, right) => left.span.start_byte - right.span.start_byte
    || left.span.end_byte - right.span.end_byte
    || left.annotation_kind.localeCompare(right.annotation_kind));

  for (const artefact of sourceArtefacts) {
    const owner = deepestOwner(artefact.span.start_byte, artefact.span.end_byte);
    artefact.containing_node_occurrence_id = owner.node_occurrence_id;
  }

  const revisionByTemp = new Map(internalNodes.map((node) => [node.temp_id, node.structure_revision_id]));
  const aliases = [];
  for (const legacy of sectionizer.nodes) {
    const targetTempId = legacyToTemp.get(legacy.section_id);
    const target = internalByTempId.get(targetTempId);
    if (!target) continue;
    const retiredSynthetic = retiredSyntheticContainers.has(legacy.section_id);
    const revised = target.parent_temp_id !== (legacy.parent_section_id === null
      ? null
      : `legacy:${legacy.parent_section_id}`)
      || target.start !== legacy.start
      || target.end !== legacy.end
      || target.reference !== legacy.reference;
    const basis = syntheticIntroContainers.has(legacy.section_id)
      ? target.node_kind === 'CHAPEAU'
        ? 'SYNTHETIC_INTRO_REPLACED_BY_AUTHORED_CHAPEAU'
        : 'SYNTHETIC_INTRO_REPLACED_BY_AUTHORED_HEADING'
      : syntheticAnnexArticles.has(legacy.section_id)
        ? 'SYNTHETIC_ARTICLE_WRAPPER_REPLACED_BY_AUTHORED_ANNEX_HEADING'
        : legacyAnnexSections.has(legacy.section_id)
          ? 'PSEUDO_SECTION_REPLACED_BY_AUTHORED_ANNEX'
      : revised
          ? 'SAME_MARKER_OCCURRENCE_REVISED_STRUCTURE'
          : 'SAME_AUTHORED_OCCURRENCE';
    aliases.push({
      schema_version: 'AGREEMENT_SOURCE_ALIAS/V1',
      alias_id: contentId('AGREEMENT_SOURCE_ALIAS/V1', {
        legacy_schema_version: sectionizer.schema_version,
        legacy_node_id: legacy.section_id,
        node_occurrence_id: target.node_occurrence_id,
      }),
      legacy_schema_version: sectionizer.schema_version,
      legacy_node_id: legacy.section_id,
      node_occurrence_id: target.node_occurrence_id,
      structure_revision_id: revisionByTemp.get(target.temp_id),
      cardinality: 'ONE_TO_ONE',
      basis,
    });
  }
  aliases.sort((left, right) => left.legacy_node_id.localeCompare(right.legacy_node_id));

  const boundaries = new Set([0, sourceBytes.length]);
  for (const node of publicNodes) {
    boundaries.add(node.extent_span.start_byte);
    boundaries.add(node.extent_span.end_byte);
  }
  for (const artefact of sourceArtefacts) {
    boundaries.add(artefact.span.start_byte);
    boundaries.add(artefact.span.end_byte);
  }
  const sortedBoundaries = [...boundaries].sort((left, right) => left - right);
  const coverageSegments = [];
  for (let index = 0; index < sortedBoundaries.length - 1; index += 1) {
    const start = sortedBoundaries[index];
    const end = sortedBoundaries[index + 1];
    if (!(end > start)) continue;
    const artefact = sourceArtefacts.find((candidate) =>
      candidate.span.start_byte <= start && candidate.span.end_byte >= end);
    const owner = artefact || deepestOwner(start, end);
    const ownerKind = artefact ? 'SOURCE_ARTEFACT' : 'AUTHORED_NODE';
    const ownerId = artefact ? artefact.source_artefact_id : owner.node_occurrence_id;
    const previous = coverageSegments.at(-1);
    if (previous && previous.end_byte === start
      && previous.owner_kind === ownerKind
      && previous.owner_id === ownerId) {
      previous.end_byte = end;
      previous.text_sha256 = sha256Hex(sourceBytes.subarray(previous.start_byte, end));
    } else {
      coverageSegments.push({
        start_byte: start,
        end_byte: end,
        text_sha256: sha256Hex(sourceBytes.subarray(start, end)),
        owner_kind: ownerKind,
        owner_id: ownerId,
      });
    }
  }
  const byteCoverage = {
    schema_version: BYTE_COVERAGE_SCHEMA_VERSION,
    coordinate_system: COORDINATE_SYSTEM,
    source_byte_length: sourceBytes.length,
    covered_byte_length: sourceBytes.length,
    complete: true,
    gaps: [],
    overlaps: [],
    segments: coverageSegments,
    proof_digest: contentId('AGREEMENT_BYTE_COVERAGE_PROOF/V1', coverageSegments),
  };

  const sourceBinding = {
    ...exactSource,
  };
  sourceBinding.source_binding_digest = contentId('AGREEMENT_SOURCE_BINDING/V1', sourceBinding);
  const structuralPolicy = {
    schema_version: policy.value.schema_version,
    policy_version: policy.value.policy_version,
    policy_digest: policy.digest,
  };
  const rootNode = internalNodes.find((node) => node.parent_temp_id === null);
  const counts = {
    nodes: publicNodes.length,
    annotations: annotations.length,
    source_artefacts: sourceArtefacts.length,
    aliases: aliases.length,
    ambiguities: ambiguities.length,
    diagnostics: diagnostics.length,
    inline_marker_dispositions: inlineMarkerDispositions.length,
    inline_marker_candidates: inlineMarkerCandidates.length,
    source_bytes: sourceBytes.length,
  };
  const agreementIndexId = contentId('AGREEMENT_INDEX/V1', {
    agreement_id: exactSource.agreement_id,
    canonical_text_id: exactSource.canonical_text_id,
    structural_policy_digest: policy.digest,
    root_node_occurrence_id: rootNode.node_occurrence_id,
    counts,
    node_set_digest: contentId('AGREEMENT_INDEX_NODE_SET/V1', publicNodes),
    annotation_set_digest: contentId('AGREEMENT_INDEX_ANNOTATION_SET/V1', annotations),
    source_artefact_set_digest: contentId(
      'AGREEMENT_INDEX_SOURCE_ARTEFACT_SET/V1',
      sourceArtefacts,
    ),
    alias_set_digest: contentId('AGREEMENT_INDEX_ALIAS_SET/V1', aliases),
    ambiguity_set_digest: contentId('AGREEMENT_INDEX_AMBIGUITY_SET/V1', ambiguities),
    diagnostic_set_digest: contentId('AGREEMENT_INDEX_DIAGNOSTIC_SET/V1', diagnostics),
    inline_marker_disposition_set_digest: contentId(
      'AGREEMENT_INDEX_INLINE_MARKER_DISPOSITION_SET/V1',
      inlineMarkerDispositions,
    ),
    inline_marker_partition_proof_digest: inlineMarkerPartition.proof_digest,
    byte_coverage_proof_digest: byteCoverage.proof_digest,
  });

  return {
    schema_version: AGREEMENT_INDEX_SCHEMA_VERSION,
    agreement_index_id: agreementIndexId,
    coordinate_system: COORDINATE_SYSTEM,
    source_binding: sourceBinding,
    structural_policy: structuralPolicy,
    root_node_occurrence_id: rootNode.node_occurrence_id,
    nodes: publicNodes,
    annotations,
    source_artefacts: sourceArtefacts,
    aliases,
    ambiguities,
    diagnostics,
    inline_marker_dispositions: inlineMarkerDispositions,
    inline_marker_partition: inlineMarkerPartition,
    byte_coverage: byteCoverage,
    counts,
  };
}

module.exports = {
  AGREEMENT_INDEX_SCHEMA_VERSION,
  SOURCE_NODE_SCHEMA_VERSION,
  SOURCE_ANNOTATION_SCHEMA_VERSION,
  SOURCE_ARTEFACT_SCHEMA_VERSION,
  BYTE_COVERAGE_SCHEMA_VERSION,
  INLINE_MARKER_DISPOSITION_SCHEMA_VERSION,
  INLINE_MARKER_CANDIDATE_SCHEMA_VERSION,
  INLINE_MARKER_PARTITION_SCHEMA_VERSION,
  INLINE_MARKER_SPAN_SET_DOMAIN,
  COORDINATE_SYSTEM,
  AUTHORED_NODE_KINDS,
  ANNOTATION_KINDS,
  SOURCE_ARTEFACT_KINDS,
  BYTE_COVERAGE_OWNER_KINDS,
  DIAGNOSTIC_TYPES,
  INLINE_MARKER_DISPOSITIONS,
  INLINE_MARKER_STYLES,
  INLINE_AUTHORED_REASONS,
  INLINE_NONSTRUCTURAL_REASONS,
  INLINE_UNRESOLVED_REASONS,
  AgreementIndexError,
  indexAgreement,
};
