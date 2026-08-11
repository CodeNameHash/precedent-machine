import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { relative, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { canonicalJson, contentId, sha256Hex } = require('../../lib/canonical-v2/canonical-bytes');
const {
  rebuildAdmittedSourcePrimitives,
} = require('../../lib/canonical-v2/admitted-source-chain-rebuild');
const {
  sectionizeAdmittedSource,
} = require('../../lib/canonical-v2/native-producer/deterministic-sectionizer');

const COORDINATE_SYSTEM = 'UTF8_CANONICAL_TEXT_HALF_OPEN';
const POLICY_VERSION = 'STAGE_2Y_STRUCTURE_SOURCE_PROTOTYPE/V1';
const PROTOTYPE_INPUT_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/prototype-inputs.json';
const AUTHORED_SEMANTIC_NODE_KINDS = new Set([
  'AGREEMENT',
  'ARTICLE',
  'SECTION',
  'SUBSECTION',
  'CHAPEAU',
  'LIMB',
  'SENTENCE',
  'QUALIFICATION',
  'DEFINED_TERM',
  'AMBIGUITY_CONTAINER',
]);

function fail(code, message) {
  const error = new Error(`${code}: ${message}`);
  error.code = code;
  throw error;
}

function assert(condition, code, message) {
  if (!condition) fail(code, message);
}

function repoPath(repoRoot, absolutePath) {
  const path = relative(repoRoot, absolutePath).split('\\').join('/');
  assert(path && !path.startsWith('..'), 'PATH_OUTSIDE_REPOSITORY', absolutePath);
  return path;
}

function spanRecord(bytes, startByte, endByte) {
  assert(Number.isSafeInteger(startByte) && Number.isSafeInteger(endByte)
    && startByte >= 0 && endByte > startByte && endByte <= bytes.length,
  'INVALID_BYTE_SPAN', `[${startByte},${endByte})`);
  return {
    coordinate_system: COORDINATE_SYSTEM,
    start_byte: startByte,
    end_byte: endByte,
    text_sha256: sha256Hex(bytes.subarray(startByte, endByte)),
  };
}

function findAll(bytes, needle, start, end) {
  const token = Buffer.from(needle, 'utf8');
  const found = [];
  let cursor = start;
  while (cursor < end) {
    const offset = bytes.indexOf(token, cursor);
    if (offset < 0 || offset + token.length > end) break;
    found.push({ start: offset, end: offset + token.length });
    cursor = offset + token.length;
  }
  return found;
}

function unique(bytes, needle, start, end, label = needle) {
  const found = findAll(bytes, needle, start, end);
  assert(found.length === 1, 'AUTHORED_ANCHOR_NOT_UNIQUE', `${label}: ${found.length}`);
  return found[0];
}

function first(bytes, needle, start, end, label = needle) {
  const found = findAll(bytes, needle, start, end);
  assert(found.length >= 1, 'AUTHORED_ANCHOR_MISSING', label);
  return found[0];
}

function markerSpan(bytes, start) {
  const tail = bytes.subarray(start, Math.min(bytes.length, start + 16)).toString('utf8');
  const match = tail.match(/^\(([A-Za-z]{1,9}|[0-9]{1,3})\)/);
  if (!match) return null;
  return spanRecord(bytes, start, start + Buffer.byteLength(match[0], 'utf8'));
}

function trimTrailingWhitespace(bytes, start, end) {
  let cursor = end;
  while (cursor > start && [9, 10, 13, 32].includes(bytes[cursor - 1])) cursor -= 1;
  return cursor;
}

function skipHorizontalWhitespace(bytes, start, end) {
  let cursor = start;
  while (cursor < end && [9, 32].includes(bytes[cursor])) cursor += 1;
  return cursor;
}

function deepestAuthoredSemanticNode(registry, start, end, fallback) {
  const priority = new Map([
    ['QUALIFICATION', 0],
    ['SENTENCE', 1],
    ['LIMB', 2],
    ['CHAPEAU', 3],
    ['DEFINED_TERM', 4],
    ['SUBSECTION', 5],
    ['AMBIGUITY_CONTAINER', 6],
    ['SECTION', 7],
    ['ARTICLE', 8],
    ['AGREEMENT', 9],
  ]);
  return registry.nodes
    .filter((node) => AUTHORED_SEMANTIC_NODE_KINDS.has(node.node_kind)
      && node.extent_span.start_byte <= start && node.extent_span.end_byte >= end)
    .sort((left, right) => {
      const leftLength = left.extent_span.end_byte - left.extent_span.start_byte;
      const rightLength = right.extent_span.end_byte - right.extent_span.start_byte;
      return leftLength - rightLength
        || (priority.get(left.node_kind) ?? 99) - (priority.get(right.node_kind) ?? 99)
        || left.node_occurrence_id.localeCompare(right.node_occurrence_id);
    })[0] || fallback;
}

class Nodes {
  constructor({ caseId, canonicalTextId, bytes }) {
    this.caseId = caseId;
    this.canonicalTextId = canonicalTextId;
    this.bytes = bytes;
    this.nodes = [];
    this.byId = new Map();
    this.byKey = new Map();
    this.childCounts = new Map();
  }

  add({
    key,
    nodeKind,
    roles,
    reference = null,
    start,
    end,
    parentId = null,
    parseStatus = 'AUTHORED_EXACT',
    derivation = 'FROZEN_CASE_RULE',
    marker = null,
    heading = null,
    currentSectionIds = [],
    owned = false,
  }) {
    assert(!this.byKey.has(key), 'DUPLICATE_NODE_KEY', `${this.caseId}:${key}`);
    const occurrencePayload = {
      schema_version: 'STAGE_2Y_SOURCE_NODE_OCCURRENCE/V1',
      canonical_text_id: this.canonicalTextId,
      node_kind: nodeKind,
      anchor_start_byte: start,
    };
    const nodeOccurrenceId = contentId('STAGE_2Y_SOURCE_NODE_OCCURRENCE/V1', occurrencePayload);
    assert(!this.byId.has(nodeOccurrenceId), 'NODE_OCCURRENCE_COLLISION', `${this.caseId}:${key}`);
    const childOrdinal = this.childCounts.get(parentId) || 0;
    this.childCounts.set(parentId, childOrdinal + 1);
    const sortedRoles = [...new Set(roles)].sort();
    const extentSpan = spanRecord(this.bytes, start, end);
    const node = {
      node_occurrence_id: nodeOccurrenceId,
      structure_revision_id: null,
      node_kind: nodeKind,
      roles: sortedRoles,
      reference,
      parent_node_occurrence_id: parentId,
      child_ordinal: childOrdinal,
      extent_span: extentSpan,
      owned_spans: owned ? [extentSpan] : [],
      marker_span: marker,
      heading_span: heading,
      parse_status: parseStatus,
      derivation,
      current_section_ids: [...new Set(currentSectionIds)].sort(),
      child_node_occurrence_ids: [],
    };
    node.structure_revision_id = this.structureRevisionId(node);
    this.nodes.push(node);
    this.byId.set(nodeOccurrenceId, node);
    this.byKey.set(key, node);
    return node;
  }

  get(key) {
    const node = this.byKey.get(key);
    assert(node, 'UNKNOWN_NODE_KEY', `${this.caseId}:${key}`);
    return node;
  }

  structureRevisionId(node) {
    const revisionPayload = {
      schema_version: 'STAGE_2Y_SOURCE_STRUCTURE_REVISION/V1',
      node_occurrence_id: node.node_occurrence_id,
      end_byte: node.extent_span.end_byte,
      parent_node_occurrence_id: node.parent_node_occurrence_id,
      child_ordinal: node.child_ordinal,
      roles: node.roles,
      reference: node.reference,
      parse_status: node.parse_status,
      policy_version: POLICY_VERSION,
    };
    return contentId('STAGE_2Y_SOURCE_STRUCTURE_REVISION/V1', revisionPayload);
  }

  finish() {
    const compareSourceOrder = (left, right) =>
      left.extent_span.start_byte - right.extent_span.start_byte
        || left.extent_span.end_byte - right.extent_span.end_byte
        || left.node_kind.localeCompare(right.node_kind)
        || left.node_occurrence_id.localeCompare(right.node_occurrence_id);
    const childrenByParent = new Map();
    for (const node of this.nodes) node.child_node_occurrence_ids = [];
    for (const node of this.nodes) {
      const parentId = node.parent_node_occurrence_id;
      if (parentId !== null) {
        assert(this.byId.has(parentId), 'STRUCTURE_PARENT_MISSING',
          `${this.caseId}:${node.node_occurrence_id}`);
      }
      if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
      childrenByParent.get(parentId).push(node);
    }
    for (const [parentId, children] of childrenByParent) {
      children.sort(compareSourceOrder);
      for (const [index, child] of children.entries()) child.child_ordinal = index;
      if (parentId !== null) {
        this.byId.get(parentId).child_node_occurrence_ids =
          children.map((child) => child.node_occurrence_id);
      }
    }
    for (const node of this.nodes) {
      node.structure_revision_id = this.structureRevisionId(node);
    }

    for (const [parentId, children] of childrenByParent) {
      for (const [index, child] of children.entries()) {
        assert(child.child_ordinal === index, 'STRUCTURE_CHILD_ORDINAL_GAP',
          `${this.caseId}:${parentId ?? 'ROOT'}:${index}`);
        if (index > 0) {
          assert(children[index - 1].extent_span.start_byte <= child.extent_span.start_byte,
            'STRUCTURE_CHILD_ORDER_NON_MONOTONIC', `${this.caseId}:${parentId ?? 'ROOT'}`);
        }
        if (parentId !== null) {
          const parent = this.byId.get(parentId);
          assert(parent.extent_span.start_byte <= child.extent_span.start_byte
            && parent.extent_span.end_byte >= child.extent_span.end_byte,
          'STRUCTURE_PARENT_DOES_NOT_CONTAIN_CHILD',
          `${this.caseId}:${parentId}:${child.node_occurrence_id}`);
        }
      }
    }
    for (const parent of this.nodes) {
      const expected = childrenByParent.get(parent.node_occurrence_id) || [];
      assert(parent.child_node_occurrence_ids.length === expected.length
        && parent.child_node_occurrence_ids.every((childId, index) =>
          childId === expected[index].node_occurrence_id),
      'STRUCTURE_CHILD_LINK_MISMATCH', `${this.caseId}:${parent.node_occurrence_id}`);
      assert(new Set(parent.child_node_occurrence_ids).size
        === parent.child_node_occurrence_ids.length,
      'STRUCTURE_CHILD_LINK_DUPLICATE', `${this.caseId}:${parent.node_occurrence_id}`);
      for (const childId of parent.child_node_occurrence_ids) {
        const child = this.byId.get(childId);
        assert(child?.parent_node_occurrence_id === parent.node_occurrence_id,
          'STRUCTURE_CHILD_LINK_NOT_RECIPROCAL', `${this.caseId}:${parent.node_occurrence_id}:${childId}`);
      }
    }
    for (const node of this.nodes) {
      const visited = new Set();
      let cursor = node;
      while (cursor.parent_node_occurrence_id !== null) {
        assert(!visited.has(cursor.node_occurrence_id), 'STRUCTURE_PARENT_CYCLE',
          `${this.caseId}:${node.node_occurrence_id}`);
        visited.add(cursor.node_occurrence_id);
        cursor = this.byId.get(cursor.parent_node_occurrence_id);
        assert(cursor, 'STRUCTURE_PARENT_MISSING', `${this.caseId}:${node.node_occurrence_id}`);
      }
    }
    return this.nodes;
  }
}

function refreshAliasRevisionIds(registry, aliases) {
  for (const alias of aliases) {
    if (alias.case_id !== registry.caseId) continue;
    const node = registry.byId.get(alias.shadow_node_occurrence_id);
    assert(node, 'ALIAS_SHADOW_NODE_MISSING',
      `${registry.caseId}:${alias.shadow_node_occurrence_id}`);
    alias.shadow_structure_revision_id = node.structure_revision_id;
  }
}

function validateAuthority(control) {
  assert(control?.schema_version === 'STAGE_2Y_STRUCTURE_MIGRATION_CONTROL/V1',
    'CONTROL_SCHEMA_MISMATCH', 'control schema');
  assert(control.authority?.authorised_stages?.includes('M1'), 'M1_NOT_AUTHORISED', 'M1');
  for (const field of [
    'model_calls', 'phase_b_route_calls', 'product_writes', 'pin_changes',
    'baseline_changes', 'current_selector_changes', 'serving_changes',
  ]) assert(control.authority?.[field] === 0, 'AUTHORITY_NOT_ZERO', field);
  assert(control.authority.publication_authorisation === 'NONE',
    'PUBLICATION_AUTHORITY_PRESENT', 'publication');
}

function validateInputs(control, inputs) {
  assert(inputs?.schema_version === 'STAGE_2Y_STRUCTURE_PROTOTYPE_INPUTS/V1',
    'INPUT_SCHEMA_MISMATCH', 'prototype inputs');
  assert(inputs.input_rule === 'FROZEN_SECTIONIZER_UTF8_BYTE_SPANS'
    && inputs.rediscovery_permitted === false, 'INPUT_NOT_FROZEN', 'prototype inputs');
  assert(Array.isArray(inputs.cases) && inputs.cases.length > 0, 'CASES_REQUIRED', 'cases');
  const binding = control.control_bindings?.['prototype-inputs.json'];
  assert(binding && binding.path === PROTOTYPE_INPUT_PATH
    && Number.isSafeInteger(binding.byte_length)
    && typeof binding.sha256 === 'string' && /^[0-9a-f]{64}$/.test(binding.sha256),
  'INPUT_BINDING_REQUIRED', 'prototype-inputs.json');
  const sealed = Buffer.from(`${canonicalJson(inputs)}\n`, 'utf8');
  assert(sealed.length === binding.byte_length && sha256Hex(sealed) === binding.sha256,
    'INPUT_BINDING_MISMATCH', binding.path);
}

function rebuildCaseSource({ repoRoot, specification }) {
  assert(Array.isArray(specification.run_directories)
    && specification.run_directories.length > 0, 'RUN_DIRECTORIES_REQUIRED', specification.case_id);
  const rebuilt = specification.run_directories.map((runDirectory) => {
    assert(typeof runDirectory === 'string' && !runDirectory.includes('..'),
      'INVALID_RUN_DIRECTORY', String(runDirectory));
    const absoluteRun = resolve(repoRoot, 'evidence/canonical-v2', runDirectory);
    const primitives = rebuildAdmittedSourcePrimitives({ runDirectory: absoluteRun, repoRoot });
    return { runDirectory, primitives };
  });
  const primary = rebuilt[0].primitives;
  const text = primary.conversion.canonical_text;
  const bytes = Buffer.from(text, 'utf8');
  assert(primary.conversion.canonical_text_sha256 === specification.canonical_text_sha256,
    'CANONICAL_HASH_MISMATCH', specification.case_id);
  assert(bytes.length === specification.canonical_text_byte_length,
    'CANONICAL_LENGTH_MISMATCH', specification.case_id);
  assert(primary.immutable_source_document.immutable_source_document_id
    === specification.immutable_source_document_id, 'IMMUTABLE_SOURCE_ID_MISMATCH', specification.case_id);
  assert(primary.immutable_source_document.response_bytes_sha256
    === specification.sectionizer_document_hash, 'SECTIONIZER_DOCUMENT_HASH_MISMATCH', specification.case_id);
  assert(specification.raw_source_sha256 === specification.sectionizer_document_hash,
    'RAW_SOURCE_HASH_BINDING_MISMATCH', specification.case_id);
  assert(repoPath(repoRoot, primary.rebuild_diagnostics.raw_html_path) === specification.source_path,
    'RAW_SOURCE_PATH_MISMATCH', specification.case_id);
  const rawBytes = readFileSync(primary.rebuild_diagnostics.raw_html_path);
  assert(rawBytes.length === specification.raw_source_byte_length
    && sha256Hex(rawBytes) === specification.raw_source_sha256,
  'RAW_SOURCE_BYTES_MISMATCH', specification.case_id);
  for (const entry of rebuilt.slice(1)) {
    assert(entry.primitives.conversion.canonical_text_sha256 === specification.canonical_text_sha256
      && entry.primitives.conversion.canonical_text === text,
    'MULTI_RUN_SOURCE_DIVERGENCE', `${specification.case_id}:${entry.runDirectory}`);
  }
  return {
    text,
    bytes,
    canonicalTextId: primary.conversion.canonical_text_id,
    sourceBindings: rebuilt.map(({ runDirectory, primitives }) => ({
      run_directory: runDirectory,
      immutable_source_document_id:
        primitives.immutable_source_document.immutable_source_document_id,
      document_hash: primitives.immutable_source_document.response_bytes_sha256,
      canonical_text_id: primitives.conversion.canonical_text_id,
      canonical_text_sha256: primitives.conversion.canonical_text_sha256,
    })),
  };
}

function addCurrentStructure({ specification, source, registry, aliases }) {
  const tree = sectionizeAdmittedSource({
    source_text: source.text,
    document_hash: specification.sectionizer_document_hash,
  });
  assert(tree.source_sha256 === specification.canonical_text_sha256
    && tree.source_byte_length === specification.canonical_text_byte_length,
  'SECTIONIZER_SOURCE_DIVERGENCE', specification.case_id);
  const roots = new Map();
  for (const [index, frozen] of specification.spans.entries()) {
    assert(frozen.end - frozen.start === frozen.byte_length,
      'FROZEN_SPAN_LENGTH_MISMATCH', `${specification.case_id}:${frozen.section_reference}`);
    assert(sha256Hex(source.bytes.subarray(frozen.start, frozen.end)) === frozen.text_sha256,
      'FROZEN_SPAN_HASH_MISMATCH', `${specification.case_id}:${frozen.section_reference}`);
    const current = tree.nodes.find((node) => node.section_id === frozen.current_section_id);
    assert(current && current.start === frozen.start && current.end === frozen.end
      && current.reference === frozen.section_reference,
    'FROZEN_CURRENT_NODE_MISMATCH', `${specification.case_id}:${frozen.section_reference}`);
    const root = registry.add({
      key: `root:${index}`,
      nodeKind: current.kind,
      roles: [current.kind, 'FROZEN_SELECTED_SPAN', 'STRUCTURAL_CONTAINER'],
      reference: current.reference,
      start: frozen.start,
      end: frozen.end,
      parseStatus: 'FROZEN_CURRENT',
      derivation: 'CURRENT_SECTIONIZER_EXACT_FROZEN_SPAN',
      currentSectionIds: [current.section_id],
    });
    roots.set(frozen.section_reference, root);
    aliases.push({
      case_id: specification.case_id,
      current_node_id: current.section_id,
      shadow_node_occurrence_id: root.node_occurrence_id,
      shadow_structure_revision_id: root.structure_revision_id,
      cardinality: 'ONE_TO_ONE',
      basis: 'EXACT_REFERENCE_AND_UTF8_SPAN',
    });

    const descendants = tree.nodes
      .filter((node) => node.section_id !== current.section_id
        && node.start >= frozen.start && node.end <= frozen.end)
      .sort((left, right) => left.depth - right.depth || left.start - right.start || left.end - right.end);
    const currentMap = new Map([[current.section_id, root.node_occurrence_id]]);
    for (const [childIndex, candidate] of descendants.entries()) {
      const parentId = currentMap.get(candidate.parent_section_id) || root.node_occurrence_id;
      const shadow = registry.add({
        key: `current:${index}:${childIndex}`,
        nodeKind: 'CURRENT_STRUCTURE_CANDIDATE',
        roles: [candidate.kind, 'CURRENT_SECTIONIZER_NODE', 'STRUCTURAL_CONTAINER'],
        reference: candidate.reference,
        start: candidate.start,
        end: candidate.end,
        parentId,
        parseStatus: 'CURRENT_CANDIDATE',
        derivation: 'CURRENT_SECTIONIZER',
        marker: markerSpan(source.bytes, candidate.start),
        currentSectionIds: [candidate.section_id],
      });
      currentMap.set(candidate.section_id, shadow.node_occurrence_id);
      aliases.push({
        case_id: specification.case_id,
        current_node_id: candidate.section_id,
        shadow_node_occurrence_id: shadow.node_occurrence_id,
        shadow_structure_revision_id: shadow.structure_revision_id,
        cardinality: 'ONE_TO_ONE',
        basis: 'CURRENT_SECTIONIZER_CANDIDATE',
      });
    }
  }
  return { tree, roots };
}

function addHeading({ source, registry, root, currentNode, key }) {
  if (!currentNode?.heading) return null;
  const title = first(source.bytes, currentNode.heading,
    root.extent_span.start_byte, Math.min(root.extent_span.end_byte, root.extent_span.start_byte + 300),
    `${key}:heading`);
  let end = title.end;
  if (source.bytes[end] === 46) end += 1;
  while (end < root.extent_span.end_byte && /\s/.test(String.fromCharCode(source.bytes[end]))) end += 1;
  return registry.add({
    key,
    nodeKind: 'HEADING',
    roles: ['HEADING', 'AUTHORED_BLOCK'],
    start: root.extent_span.start_byte,
    end,
    parentId: root.node_occurrence_id,
    heading: spanRecord(source.bytes, root.extent_span.start_byte, end),
  });
}

function addMarker(registry, source, key, start, parentId, reference) {
  const marker = markerSpan(source.bytes, start);
  assert(marker, 'MARKER_EXPECTED', `${registry.caseId}:${reference}`);
  return registry.add({
    key,
    nodeKind: 'MARKER',
    roles: ['MARKER', 'AUTHORED_BLOCK'],
    reference,
    start: marker.start_byte,
    end: marker.end_byte,
    parentId,
    marker,
  });
}

function addIndependentSentenceChildren({
  source,
  registry,
  root,
  keyPrefix,
  sentenceStarts,
  bodyEnd = root.extent_span.end_byte,
  roles = [],
}) {
  const starts = sentenceStarts.map((literal, index) => unique(
    source.bytes,
    literal,
    root.extent_span.start_byte,
    bodyEnd,
    `${keyPrefix}:sentence:${index}`,
  ).start);
  starts.forEach((start, index) => {
    const untrimmedEnd = starts[index + 1] || bodyEnd;
    const end = trimTrailingWhitespace(source.bytes, start, untrimmedEnd);
    registry.add({
      key: `${keyPrefix}:sentence:${index}`,
      nodeKind: 'SENTENCE',
      roles: ['SENTENCE', 'UNNUMBERED_CHILD_BLOCK', 'AUTHORED_BLOCK', ...roles],
      start,
      end,
      parentId: root.node_occurrence_id,
    });
  });
}

function addConcho69({ specification, source, registry, roots }) {
  const frozen = specification.spans[0];
  const root = roots.get('6.9(a)');
  const labels = ['(i)', '(ii)', '(iii)', '(iv)'];
  const starts = labels.map((label) => unique(source.bytes, label, frozen.start, frozen.end, `6.9(a)${label}`).start);
  addMarker(registry, source, '6.9:a-marker', frozen.start, root.node_occurrence_id, '6.9(a)');
  registry.add({ key: '6.9:chapeau', nodeKind: 'CHAPEAU',
    roles: ['CHAPEAU', 'GOVERNING_CONTEXT', 'AUTHORED_BLOCK'],
    start: frozen.start + 3, end: starts[0], parentId: root.node_occurrence_id });
  starts.forEach((start, index) => {
    const end = starts[index + 1] || frozen.end;
    const reference = `6.9(a)${labels[index]}`;
    const limb = registry.add({ key: `6.9:limb:${index}`, nodeKind: 'LIMB',
      roles: ['LIMB', 'SUB_LIMB', 'STRUCTURAL_CONTAINER'], reference,
      start, end, parentId: root.node_occurrence_id, marker: markerSpan(source.bytes, start) });
    addMarker(registry, source, `6.9:limb-marker:${index}`, start, limb.node_occurrence_id, reference);
    if (index < 2) {
      const proviso = unique(source.bytes, 'provided that', start, end, `${reference}:proviso`);
      registry.add({ key: `6.9:proviso:${index}`, nodeKind: 'QUALIFICATION',
        roles: ['QUALIFICATION', 'PROVISO', 'LOCAL_TO_LIMB', 'AUTHORED_BLOCK'],
        start: proviso.start, end, parentId: limb.node_occurrence_id });
    }
  });
}

function addTopbuild62({ source, registry, roots }) {
  const root = roots.get('6.2');
  const start = root.extent_span.start_byte;
  const end = root.extent_span.end_byte;
  const markerStarts = ['\n(a)', '\n(b)', '\n(c)', '\n(d)']
    .map((label) => unique(source.bytes, label, start, end, `6.2:${label}`).start + 1);
  const heading = unique(source.bytes, '6.2 Termination by Either Parent or the Company. ', start, end);
  registry.add({ key: '6.2:heading', nodeKind: 'HEADING', roles: ['HEADING', 'AUTHORED_BLOCK'],
    start, end: heading.end, parentId: root.node_occurrence_id,
    heading: spanRecord(source.bytes, start, heading.end) });
  registry.add({ key: '6.2:chapeau', nodeKind: 'CHAPEAU',
    roles: ['CHAPEAU', 'MUTUAL_GRANT', 'GOVERNING_CONTEXT', 'AUTHORED_BLOCK'],
    start: heading.end, end: markerStarts[0], parentId: root.node_occurrence_id });
  markerStarts.forEach((limbStart, index) => {
    const limbEnd = markerStarts[index + 1] || end;
    const reference = `6.2(${String.fromCharCode(97 + index)})`;
    const limb = registry.add({ key: `6.2:limb:${index}`, nodeKind: 'LIMB',
      roles: ['LIMB', 'TERMINATION_TRIGGER', 'STRUCTURAL_CONTAINER'], reference,
      start: limbStart, end: limbEnd, parentId: root.node_occurrence_id,
      marker: markerSpan(source.bytes, limbStart) });
    addMarker(registry, source, `6.2:marker:${index}`, limbStart, limb.node_occurrence_id, reference);
    if (index === 0 || index === 3) {
      const phrase = index === 0 ? 'provided that' : 'provided, that';
      const proviso = unique(source.bytes, phrase, limbStart, limbEnd, `${reference}:proviso`);
      registry.add({ key: `6.2:proviso:${index}`, nodeKind: 'QUALIFICATION',
        roles: ['QUALIFICATION', 'CAUSATION_PROVISO', 'LOCAL_TO_LIMB', 'AUTHORED_BLOCK'],
        start: proviso.start, end: limbEnd, parentId: limb.node_occurrence_id });
    }
  });
}

function addTopbuild63({ source, registry, roots }) {
  const root = roots.get('6.3');
  const start = root.extent_span.start_byte;
  const end = root.extent_span.end_byte;
  const heading = registry.get('heading:6.3');
  const markerStarts = ['\n(a)', '\n(b)']
    .map((label) => unique(source.bytes, label, start, end, `6.3:${label}`).start + 1);
  registry.add({
    key: '6.3:chapeau',
    nodeKind: 'CHAPEAU',
    roles: ['CHAPEAU', 'GOVERNING_CONTEXT', 'AUTHORED_BLOCK'],
    start: heading.extent_span.end_byte,
    end: markerStarts[0],
    parentId: root.node_occurrence_id,
  });
  markerStarts.forEach((limbStart, index) => {
    const limbEnd = markerStarts[index + 1] || end;
    const reference = `6.3(${String.fromCharCode(97 + index)})`;
    const limb = registry.add({
      key: `6.3:limb:${index}`,
      nodeKind: 'LIMB',
      roles: ['LIMB', 'TERMINATION_TRIGGER', 'STRUCTURAL_CONTAINER'],
      reference,
      start: limbStart,
      end: limbEnd,
      parentId: root.node_occurrence_id,
      marker: markerSpan(source.bytes, limbStart),
    });
    addMarker(registry, source, `6.3:marker:${index}`, limbStart,
      limb.node_occurrence_id, reference);
    if (index === 1) {
      const proviso = unique(source.bytes,
        'provided that the Company is not then in breach',
        limbStart, limbEnd, `${reference}:proviso`);
      registry.add({
        key: '6.3:proviso:1',
        nodeKind: 'QUALIFICATION',
        roles: ['QUALIFICATION', 'LOCAL_TO_LIMB', 'TERMINATION_AVAILABILITY_PROVISO', 'AUTHORED_BLOCK'],
        start: proviso.start,
        end: limbEnd,
        parentId: limb.node_occurrence_id,
      });
    }
  });
}

function addRedHat({ source, registry, roots, alternatives }) {
  const root301 = roots.get('3.01');
  const root302 = roots.get('3.02');
  const hStart = unique(source.bytes, '(h) Contracts.\n(i)',
    root301.extent_span.start_byte, root301.extent_span.end_byte, '3.01(h)/(i)').start;
  const childIStart = hStart + Buffer.byteLength('(h) Contracts.\n', 'utf8');
  const topIStart = unique(source.bytes, '\n(i) Permits; Compliance with Laws.',
    childIStart, root301.extent_span.end_byte, '3.01(i) Permits').start + 1;
  const nextJ = unique(source.bytes, '\n(j) Environmental Matters.', topIStart,
    root301.extent_span.end_byte, '3.01(j)').start + 1;
  const h = registry.add({ key: 'redhat:h-corrected', nodeKind: 'LIMB',
    roles: ['LIMB', 'STRUCTURAL_CONTAINER', 'PARENTAGE_CANDIDATE'], reference: '3.01(h)',
    start: hStart, end: childIStart, parentId: root301.node_occurrence_id,
    marker: markerSpan(source.bytes, hStart), parseStatus: 'AMBIGUOUS' });
  const hMarker = addMarker(registry, source, 'redhat:h-marker', hStart,
    h.node_occurrence_id, '3.01(h)');
  registry.add({
    key: 'redhat:h-heading',
    nodeKind: 'HEADING',
    roles: ['HEADING', 'AUTHORED_BLOCK'],
    start: hMarker.extent_span.end_byte,
    end: childIStart,
    parentId: h.node_occurrence_id,
    heading: spanRecord(source.bytes, hMarker.extent_span.end_byte, childIStart),
  });
  const unresolvedParent = registry.add({
    key: 'redhat:h-i-unresolved-parent',
    nodeKind: 'AMBIGUITY_CONTAINER',
    roles: ['STRUCTURAL_CONTAINER', 'PARENTAGE_AMBIGUOUS', 'UNRESOLVED_PARENT'],
    start: childIStart,
    end: topIStart,
    parentId: root301.node_occurrence_id,
    parseStatus: 'AMBIGUOUS',
    derivation: 'UNRESOLVED_STRUCTURE_ALTERNATIVE',
  });
  const childI = registry.add({ key: 'redhat:h-i-corrected', nodeKind: 'LIMB',
    roles: ['SUB_LIMB', 'STRUCTURAL_CONTAINER', 'PARENTAGE_AMBIGUOUS'], reference: '(i)',
    start: childIStart, end: topIStart, parentId: unresolvedParent.node_occurrence_id,
    marker: markerSpan(source.bytes, childIStart), parseStatus: 'AMBIGUOUS' });
  addMarker(registry, source, 'redhat:h-i-marker', childIStart,
    childI.node_occurrence_id, '(i)');
  const topI = registry.add({ key: 'redhat:i-permits', nodeKind: 'LIMB',
    roles: ['LIMB', 'STRUCTURAL_CONTAINER'], reference: '3.01(i)',
    start: topIStart, end: nextJ, parentId: root301.node_occurrence_id,
    marker: markerSpan(source.bytes, topIStart) });
  addMarker(registry, source, 'redhat:i-permits-marker', topIStart,
    topI.node_occurrence_id, '3.01(i)');
  const currentI = registry.nodes.find((node) => node.current_section_ids
    .includes('ca980b412661238c3efc063073926a26cef171518c968a7f6227e55dd876e895'));
  const groupBody = {
    schema_version: 'STAGE_2Y_STRUCTURE_ALTERNATIVE_GROUP/V1',
    case_id: 'REDHAT_3_01_3_02',
    question: 'PARENT_AND_END_OF_MARKER_AT_55634',
    source_anchor_start_byte: childIStart,
    status: 'REQUIRES_BEN_LEGAL_JUDGEMENT',
    alternatives: [
      { key: 'CURRENT_SECTIONIZER_SIBLING', parent_node_occurrence_id: root301.node_occurrence_id,
        end_byte: currentI?.extent_span.end_byte || nextJ, source: 'CURRENT_SECTIONIZER' },
      { key: 'CHILD_OF_3_01_H', parent_node_occurrence_id: h.node_occurrence_id,
        end_byte: topIStart, source: 'WRITTEN_HEADING_PLUS_MODEL_DESCRIPTIVE_PATH' },
    ],
    selected_alternative: null,
  };
  alternatives.push({ ...groupBody,
    alternative_group_id: contentId('STAGE_2Y_STRUCTURE_ALTERNATIVE_GROUP/V1', groupBody),
    subject_node_occurrence_id: childI.node_occurrence_id });

  const biStart = unique(source.bytes, '\n(i) Each of Parent and Sub has the requisite corporate power',
    root302.extent_span.start_byte, root302.extent_span.end_byte, '3.02(b)(i)').start + 1;
  const biiStart = unique(source.bytes, '\n(ii) The execution and delivery', biStart,
    root302.extent_span.end_byte, '3.02(b)(ii)').start + 1;
  const sentence2 = unique(source.bytes, 'The execution and delivery of this Agreement by Parent and Sub,',
    biStart, biiStart, '3.02(b)(i):sentence2').start;
  const sentence3 = unique(source.bytes, 'This Agreement has been duly executed and delivered by Parent and Sub,',
    sentence2, biiStart, '3.02(b)(i):sentence3').start;
  const limb = registry.add({ key: 'redhat:3.02-b-i', nodeKind: 'LIMB',
    roles: ['SUB_LIMB', 'STRUCTURAL_CONTAINER'], reference: '3.02(b)(i)',
    start: biStart, end: biiStart, parentId: root302.node_occurrence_id,
    marker: markerSpan(source.bytes, biStart) });
  const biMarker = addMarker(registry, source, 'redhat:3.02-b-i-marker', biStart,
    limb.node_occurrence_id, '3.02(b)(i)');
  const sentence1 = skipHorizontalWhitespace(source.bytes,
    biMarker.extent_span.end_byte, sentence2);
  [[sentence1, sentence2], [sentence2, sentence3], [sentence3, biiStart]].forEach(([start, end], index) => {
    registry.add({ key: `redhat:sentence:${index}`, nodeKind: 'SENTENCE',
      roles: ['SENTENCE', 'UNNUMBERED_CHILD_BLOCK', 'AUTHORED_BLOCK'],
      start, end: trimTrailingWhitespace(source.bytes, start, end),
      parentId: limb.node_occurrence_id });
  });
}

function addMetsera704({ source, registry, roots }) {
  const root = roots.get('7.04');
  const start = root.extent_span.start_byte;
  const end = root.extent_span.end_byte;
  const firstSentence = unique(source.bytes, 'Neither Parent nor Merger Sub may rely', start, end);
  const secondSentence = unique(source.bytes, 'The Company may not rely', start, end);
  registry.add({ key: '7.04:heading', nodeKind: 'HEADING', roles: ['HEADING', 'AUTHORED_BLOCK'],
    start, end: firstSentence.start, parentId: root.node_occurrence_id,
    heading: spanRecord(source.bytes, start, firstSentence.start) });
  registry.add({ key: '7.04:sentence:0', nodeKind: 'SENTENCE',
    roles: ['SENTENCE', 'RECIPROCAL_BRANCH', 'UNNUMBERED_CHILD_BLOCK', 'AUTHORED_BLOCK'],
    start: firstSentence.start, end: secondSentence.start, parentId: root.node_occurrence_id });
  const footer = unique(source.bytes, '-59-', secondSentence.start, end, '7.04 footer');
  registry.add({ key: '7.04:sentence:1', nodeKind: 'SENTENCE',
    roles: ['SENTENCE', 'RECIPROCAL_BRANCH', 'UNNUMBERED_CHILD_BLOCK', 'AUTHORED_BLOCK'],
    start: secondSentence.start, end: footer.start - 1, parentId: root.node_occurrence_id });
}

function addRedHat507({ source, registry, roots }) {
  const root = roots.get('5.07');
  addIndependentSentenceChildren({
    source,
    registry,
    root,
    keyPrefix: '5.07',
    sentenceStarts: [
      'The parties agree that the initial press release',
      'Thereafter, the Company, on the one hand, and Parent and Sub, on the other hand,',
    ],
  });
}

function addConchoBareSentences({ source, registry, roots }) {
  addIndependentSentenceChildren({
    source,
    registry,
    root: roots.get('6.11'),
    keyPrefix: '6.11',
    sentenceStarts: [
      'In the event any Proceeding by any Governmental Entity or other Person is commenced',
      'The Company shall give Parent a reasonable opportunity to participate',
    ],
  });
  addIndependentSentenceChildren({
    source,
    registry,
    root: roots.get('6.16'),
    keyPrefix: '6.16',
    sentenceStarts: [
      'Parent shall take all action necessary to cause the Parent Common Stock',
      'Prior to the Closing Date, the Company shall cooperate with Parent',
      'If the Surviving Corporation is required to file any quarterly or annual report',
    ],
  });
  const root620 = roots.get('6.20');
  const footer = unique(source.bytes, '-74-',
    root620.extent_span.start_byte, root620.extent_span.end_byte, '6.20 footer');
  addIndependentSentenceChildren({
    source,
    registry,
    root: root620,
    keyPrefix: '6.20',
    sentenceStarts: [
      'Parent shall take all action necessary to cause Merger Sub and the Surviving Corporation',
    ],
    bodyEnd: footer.start,
  });
}

function addConchoDefinition({ source, registry, roots }) {
  const root410 = roots.get('4.10');
  const rootAnnex = roots.get('Annex-A');
  const uses = findAll(source.bytes, 'to the knowledge of the Company',
    root410.extent_span.start_byte, root410.extent_span.end_byte);
  assert(uses.length >= 1, 'DEFINED_TERM_USE_MISSING', 'Concho 4.10');
  registry.add({ key: 'knowledge:use', nodeKind: 'REFERENCE_OCCURRENCE',
    roles: ['DEFINED_TERM_USE', 'REFERENCE_OCCURRENCE', 'AUTHORED_BLOCK'],
    reference: 'knowledge', start: uses[0].start, end: uses[0].end,
    parentId: root410.node_occurrence_id });
  const definitionStart = unique(source.bytes, '“knowledge” means',
    rootAnnex.extent_span.start_byte, rootAnnex.extent_span.end_byte, 'knowledge definition').start;
  const nextDefinition = unique(source.bytes, '“Law” means', definitionStart,
    rootAnnex.extent_span.end_byte, 'Law definition').start;
  const definition = registry.add({ key: 'knowledge:definition', nodeKind: 'DEFINED_TERM',
    roles: ['DEFINED_TERM', 'DEFINITION_TARGET', 'STRUCTURAL_CONTAINER'], reference: 'knowledge',
    start: definitionStart, end: nextDefinition, parentId: rootAnnex.node_occurrence_id });
  const operative = unique(source.bytes, 'the actual knowledge of', definitionStart, nextDefinition);
  registry.add({ key: 'knowledge:operative', nodeKind: 'CHAPEAU',
    roles: ['DEFINITION_OPERATIVE', 'CHAPEAU', 'AUTHORED_BLOCK'],
    start: definitionStart, end: operative.end, parentId: definition.node_occurrence_id });
  const a = unique(source.bytes, '(a) in the case of the Company', definitionStart, nextDefinition);
  const b = unique(source.bytes, '(b) in the case of Parent', definitionStart, nextDefinition);
  [[a.start, b.start, 'a'], [b.start, nextDefinition - 1, 'b']].forEach(([start, end, label]) => {
    const limb = registry.add({ key: `knowledge:limb:${label}`, nodeKind: 'LIMB',
      roles: ['DEFINITION_LIMB', 'LIMB', 'STRUCTURAL_CONTAINER'], reference: `knowledge(${label})`,
      start, end, parentId: definition.node_occurrence_id, marker: markerSpan(source.bytes, start) });
    addMarker(registry, source, `knowledge:marker:${label}`, start, limb.node_occurrence_id,
      `knowledge(${label})`);
  });
}

function addCrossReferences({ specification, source, registry }) {
  const regex = /\bSections?[\t \u200e\u200f\u202a-\u202e\u2066-\u2069]+[0-9]+\.[0-9]+(?:\([A-Za-z0-9]+\))*/g;
  for (const [spanIndex, frozen] of specification.spans.entries()) {
    const local = source.bytes.subarray(frozen.start, frozen.end).toString('utf8');
    let match;
    let ordinal = 0;
    while ((match = regex.exec(local)) !== null) {
      const localStart = Buffer.byteLength(local.slice(0, match.index), 'utf8');
      const start = frozen.start + localStart;
      if (start === frozen.start) continue;
      const end = start + Buffer.byteLength(match[0], 'utf8');
      const root = registry.get(`root:${spanIndex}`);
      const parent = deepestAuthoredSemanticNode(registry, start, end, root);
      registry.add({ key: `xref:${spanIndex}:${ordinal}`, nodeKind: 'REFERENCE_OCCURRENCE',
        roles: ['CROSS_REFERENCE', 'REFERENCE_OCCURRENCE', 'AUTHORED_BLOCK'],
        reference: match[0].replace(
          /^Sections?[\t \u200e\u200f\u202a-\u202e\u2066-\u2069]+/,
          '',
        ),
        start,
        end,
        parentId: parent.node_occurrence_id });
      ordinal += 1;
    }
    if (specification.case_id === 'TOPBUILD_6_3' && frozen.section_reference === '6.3') {
      const parallel = unique(source.bytes, 'or \u200e5.3(a)(ii)',
        frozen.start, frozen.end, '6.3(b):parallel 5.3(a)(ii)');
      const start = parallel.start + Buffer.byteLength('or ', 'utf8');
      const end = parallel.end;
      const root = registry.get(`root:${spanIndex}`);
      const parent = deepestAuthoredSemanticNode(registry, start, end, root);
      registry.add({
        key: `xref:${spanIndex}:parallel-5.3-a-ii`,
        nodeKind: 'REFERENCE_OCCURRENCE',
        roles: ['BARE_PARALLEL_REFERENCE', 'CROSS_REFERENCE', 'REFERENCE_OCCURRENCE', 'AUTHORED_BLOCK'],
        reference: '5.3(a)(ii)',
        start,
        end,
        parentId: parent.node_occurrence_id,
      });
    }
  }
}

function validateReferenceParents(registry) {
  for (const node of registry.nodes.filter((candidate) =>
    candidate.node_kind === 'REFERENCE_OCCURRENCE')) {
    const parent = registry.byId.get(node.parent_node_occurrence_id);
    assert(parent && AUTHORED_SEMANTIC_NODE_KINDS.has(parent.node_kind),
      'REFERENCE_PARENT_NOT_SEMANTIC', `${registry.caseId}:${node.reference}`);
    const expected = deepestAuthoredSemanticNode(
      registry,
      node.extent_span.start_byte,
      node.extent_span.end_byte,
      null,
    );
    assert(expected?.node_occurrence_id === parent.node_occurrence_id,
      'REFERENCE_PARENT_NOT_DEEPEST', `${registry.caseId}:${node.reference}`);
  }
}

function validateFixedFeatures({ specification, registry, roots }) {
  const direct = (root, nodeKind) => registry.nodes.filter((node) =>
    node.parent_node_occurrence_id === root.node_occurrence_id && node.node_kind === nodeKind);
  if (specification.case_id === 'TOPBUILD_6_3') {
    const limbs = direct(roots.get('6.3'), 'LIMB');
    const limbB = limbs.find((node) => node.reference === '6.3(b)');
    const qualifications = registry.nodes.filter((node) => node.node_kind === 'QUALIFICATION');
    const references = registry.nodes.filter((node) => node.node_kind === 'REFERENCE_OCCURRENCE');
    const referenceByValue = new Map(references.map((node) => [node.reference, node]));
    assert(direct(roots.get('6.3'), 'CHAPEAU').length === 1
      && limbs.length === 2
      && qualifications.length === 1
      && qualifications[0].parent_node_occurrence_id === limbB?.node_occurrence_id
      && references.length === 4
      && ['4.4', '5.3(a)(i)', '5.3(a)(ii)', '6.4(b)']
        .every((reference) => referenceByValue.has(reference))
      && referenceByValue.get('5.3(a)(ii)')?.parent_node_occurrence_id === limbB?.node_occurrence_id
      && referenceByValue.get('6.4(b)')?.parent_node_occurrence_id
        === qualifications[0].node_occurrence_id,
    'CONFIRMATION_STRUCTURE_MISSING', 'TOPBUILD_6_3 chapeau, limbs, proviso and references');
  } else if (specification.case_id === 'REDHAT_5_07') {
    assert(direct(roots.get('5.07'), 'SENTENCE').length === 2,
      'CONFIRMATION_STRUCTURE_MISSING', 'REDHAT_5_07 sentence children');
  } else if (specification.case_id === 'METSERA_9_03') {
    assert(registry.nodes.filter((node) => node.node_kind === 'REFERENCE_OCCURRENCE').length === 2,
      'CONFIRMATION_STRUCTURE_MISSING', 'METSERA_9_03 reference occurrences');
  } else if (specification.case_id === 'CONCHO_6_11_6_16_6_20') {
    assert(direct(roots.get('6.11'), 'SENTENCE').length === 2
      && direct(roots.get('6.16'), 'SENTENCE').length === 3
      && direct(roots.get('6.20'), 'SENTENCE').length === 1,
    'CONFIRMATION_STRUCTURE_MISSING', 'CONCHO bare sentence children');
  } else if (specification.case_id === 'REDHAT_3_01_3_02') {
    assert(registry.nodes.filter((node) => node.node_kind === 'SENTENCE').length === 3,
      'DECISION_STRUCTURE_MISSING', 'REDHAT_3_02 three sentence children');
  }
}

function artifactSpans(source, frozen) {
  const local = source.bytes.subarray(frozen.start, frozen.end).toString('utf8');
  const found = [];
  for (const regex of [
    /-[0-9]{1,3}-/g,
    /(?:^|\n)([0-9]{1,3})(?=\n|$)/g,
    /(?:^|\n)(A-(?:[1-9]|1[0-2]))(?=\n|$)/g,
  ]) {
    let match;
    while ((match = regex.exec(local)) !== null) {
      const token = match[1] || match[0];
      const charStart = match.index + (match[1] ? match[0].indexOf(match[1]) : 0);
      const start = frozen.start + Buffer.byteLength(local.slice(0, charStart), 'utf8');
      found.push({ start, end: start + Buffer.byteLength(token, 'utf8') });
    }
  }
  return found;
}

function addOwnership({ specification, source, registry }) {
  const ownershipCases = [];
  const structural = registry.nodes.filter((node) => !node.node_kind.startsWith('CURRENT_'));
  for (const [spanIndex, frozen] of specification.spans.entries()) {
    const boundaries = new Set([frozen.start, frozen.end]);
    for (const node of structural) {
      const { start_byte: start, end_byte: end } = node.extent_span;
      if (start >= frozen.start && end <= frozen.end) {
        boundaries.add(start);
        boundaries.add(end);
      }
    }
    const artefacts = artifactSpans(source, frozen);
    for (const artefact of artefacts) {
      boundaries.add(artefact.start);
      boundaries.add(artefact.end);
    }
    const points = [...boundaries].sort((left, right) => left - right);
    const owners = [];
    for (let index = 0; index < points.length - 1; index += 1) {
      const start = points[index];
      const end = points[index + 1];
      if (end <= start) continue;
      const isArtefact = artefacts.some((span) => start >= span.start && end <= span.end);
      const containing = structural.filter((node) => {
        const span = node.extent_span;
        return node.node_kind !== 'SOURCE_TEXT' && node.node_kind !== 'SOURCE_ARTEFACT'
          && start >= span.start_byte && end <= span.end_byte;
      }).sort((left, right) => {
        const leftLength = left.extent_span.end_byte - left.extent_span.start_byte;
        const rightLength = right.extent_span.end_byte - right.extent_span.start_byte;
        return leftLength - rightLength || left.child_ordinal - right.child_ordinal;
      });
      const parent = containing[0] || registry.get(`root:${spanIndex}`);
      const owner = registry.add({ key: `owner:${spanIndex}:${index}`,
        nodeKind: isArtefact ? 'SOURCE_ARTEFACT' : 'SOURCE_TEXT',
        roles: [isArtefact ? 'SOURCE_ARTEFACT' : 'AUTHORED_TEXT', 'BYTE_OWNER'],
        start, end, parentId: parent.node_occurrence_id, owned: true,
        parseStatus: isArtefact ? 'TYPED_SOURCE_ARTEFACT' : 'EXACT_SOURCE_TEXT',
        derivation: 'EXACT_BYTE_PARTITION' });
      owners.push({ start_byte: start, end_byte: end,
        owner_node_occurrence_id: owner.node_occurrence_id,
        owner_kind: owner.node_kind, text_sha256: owner.extent_span.text_sha256 });
    }
    const gaps = [];
    const overlaps = [];
    let cursor = frozen.start;
    for (const owner of owners) {
      if (owner.start_byte > cursor) gaps.push({ start_byte: cursor, end_byte: owner.start_byte });
      if (owner.start_byte < cursor) overlaps.push({ start_byte: owner.start_byte,
        end_byte: Math.min(cursor, owner.end_byte) });
      cursor = Math.max(cursor, owner.end_byte);
    }
    if (cursor < frozen.end) gaps.push({ start_byte: cursor, end_byte: frozen.end });
    ownershipCases.push({
      section_reference: frozen.section_reference,
      selected_span: { start_byte: frozen.start, end_byte: frozen.end,
        byte_length: frozen.byte_length, text_sha256: frozen.text_sha256 },
      owners,
      gaps,
      overlaps,
      selected_byte_count: frozen.byte_length,
      exactly_once_byte_count: owners.reduce((sum, owner) => sum + owner.end_byte - owner.start_byte, 0),
      complete: gaps.length === 0 && overlaps.length === 0,
    });
  }
  return ownershipCases;
}

function buildCase({ repoRoot, specification, aliases, alternatives }) {
  const source = rebuildCaseSource({ repoRoot, specification });
  const registry = new Nodes({ caseId: specification.case_id,
    canonicalTextId: source.canonicalTextId, bytes: source.bytes });
  const current = addCurrentStructure({ specification, source, registry, aliases });
  for (const frozen of specification.spans) {
    const root = current.roots.get(frozen.section_reference);
    const currentNode = current.tree.nodes.find((node) => node.section_id === frozen.current_section_id);
    if (!['CONCHO_6_9_A', 'TOPBUILD_6_2', 'METSERA_7_04'].includes(specification.case_id)) {
      addHeading({ source, registry, root, currentNode,
        key: `heading:${frozen.section_reference}` });
    }
  }
  if (specification.case_id === 'CONCHO_6_9_A') {
    addConcho69({ specification, source, registry, roots: current.roots });
  } else if (specification.case_id === 'TOPBUILD_6_2') {
    addTopbuild62({ specification, source, registry, roots: current.roots });
  } else if (specification.case_id === 'REDHAT_3_01_3_02') {
    addRedHat({ specification, source, registry, roots: current.roots, alternatives });
  } else if (specification.case_id === 'METSERA_7_04') {
    addMetsera704({ specification, source, registry, roots: current.roots });
  } else if (specification.case_id === 'CONCHO_4_10_ANNEX_A') {
    addConchoDefinition({ specification, source, registry, roots: current.roots });
  } else if (specification.case_id === 'TOPBUILD_6_3') {
    addTopbuild63({ source, registry, roots: current.roots });
  } else if (specification.case_id === 'REDHAT_5_07') {
    addRedHat507({ source, registry, roots: current.roots });
  } else if (specification.case_id === 'CONCHO_6_11_6_16_6_20') {
    addConchoBareSentences({ source, registry, roots: current.roots });
  }
  addCrossReferences({ specification, source, registry });
  validateReferenceParents(registry);
  validateFixedFeatures({ specification, registry, roots: current.roots });
  const ownership = addOwnership({ specification, source, registry });
  const nodes = registry.finish();
  refreshAliasRevisionIds(registry, aliases);
  return {
    indexCase: {
      case_id: specification.case_id,
      set: specification.set,
      deal: specification.deal,
      canonical_text_id: source.canonicalTextId,
      canonical_text_sha256: specification.canonical_text_sha256,
      canonical_text_byte_length: specification.canonical_text_byte_length,
      sectionizer_document_hash: specification.sectionizer_document_hash,
      source_path: specification.source_path,
      raw_source_sha256: specification.raw_source_sha256,
      raw_source_byte_length: specification.raw_source_byte_length,
      source_chain_path: specification.source_chain_path,
      source_bindings: source.sourceBindings,
      selected_spans: specification.spans,
      packet_span: specification.packet_span,
      root_node_occurrence_ids: specification.spans.map((_, index) =>
        registry.get(`root:${index}`).node_occurrence_id),
      node_count: nodes.length,
      nodes,
    },
    ownership,
    runtime: {
      case_id: specification.case_id,
      canonical_text: source.text,
      selected_spans: specification.spans,
      nodes,
    },
  };
}

export function buildSourcePrototype({ repoRoot, control, inputs }) {
  assert(typeof repoRoot === 'string' && repoRoot.length > 0, 'REPO_ROOT_REQUIRED', 'repoRoot');
  const absoluteRoot = resolve(repoRoot);
  validateAuthority(control);
  validateInputs(control, inputs);
  const aliases = [];
  const alternatives = [];
  const cases = inputs.cases.map((specification) =>
    buildCase({ repoRoot: absoluteRoot, specification, aliases, alternatives }));
  const indexCases = cases.map((entry) => entry.indexCase);
  const ownershipCases = cases.map((entry) => ({
    case_id: entry.indexCase.case_id,
    spans: entry.ownership,
    complete: entry.ownership.every((span) => span.complete),
  }));
  assert(ownershipCases.every((entry) => entry.complete),
    'BYTE_OWNERSHIP_INCOMPLETE', 'one or more frozen spans');
  const sortedAliases = aliases.sort((left, right) =>
    left.case_id.localeCompare(right.case_id)
      || left.current_node_id.localeCompare(right.current_node_id)
      || left.shadow_node_occurrence_id.localeCompare(right.shadow_node_occurrence_id)
      || left.basis.localeCompare(right.basis));
  const currentEndpoints = new Set();
  const shadowEndpoints = new Set();
  const aliasCollisions = [];
  for (const alias of sortedAliases) {
    const currentEndpoint = `${alias.case_id}\0${alias.current_node_id}`;
    const shadowEndpoint = `${alias.case_id}\0${alias.shadow_node_occurrence_id}`;
    if (currentEndpoints.has(currentEndpoint)) {
      aliasCollisions.push({ collision_type: 'DUPLICATE_CURRENT_ENDPOINT', ...alias });
    }
    if (shadowEndpoints.has(shadowEndpoint)) {
      aliasCollisions.push({ collision_type: 'DUPLICATE_SHADOW_ENDPOINT', ...alias });
    }
    currentEndpoints.add(currentEndpoint);
    shadowEndpoints.add(shadowEndpoint);
  }
  assert(aliasCollisions.length === 0, 'NODE_ALIAS_COLLISION', canonicalJson(aliasCollisions));
  return {
    agreementIndex: {
      schema_version: 'STAGE_2Y_STRUCTURE_PROTOTYPE_INDEX/V1',
      coordinate_system: COORDINATE_SYSTEM,
      policy_version: POLICY_VERSION,
      case_count: indexCases.length,
      cases: indexCases,
    },
    byteOwnership: {
      schema_version: 'STAGE_2Y_STRUCTURE_BYTE_OWNERSHIP/V1',
      coordinate_system: COORDINATE_SYSTEM,
      case_count: ownershipCases.length,
      cases: ownershipCases,
      complete: ownershipCases.every((entry) => entry.complete),
    },
    nodeAliases: {
      schema_version: 'STAGE_2Y_STRUCTURE_NODE_ALIASES/V1',
      alias_count: sortedAliases.length,
      aliases: sortedAliases,
      collisions: aliasCollisions,
    },
    structureAlternatives: {
      schema_version: 'STAGE_2Y_STRUCTURE_ALTERNATIVES/V1',
      alternative_group_count: alternatives.length,
      alternatives,
    },
    runtime_cases: cases.map((entry) => entry.runtime),
  };
}
