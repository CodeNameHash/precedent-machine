'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  AGREEMENT_INDEX_SCHEMA_VERSION,
  SOURCE_NODE_SCHEMA_VERSION,
  SOURCE_ANNOTATION_SCHEMA_VERSION,
  SOURCE_ARTEFACT_SCHEMA_VERSION,
  BYTE_COVERAGE_SCHEMA_VERSION,
  COORDINATE_SYSTEM,
  AUTHORED_NODE_KINDS,
  ANNOTATION_KINDS,
  SOURCE_ARTEFACT_KINDS,
  BYTE_COVERAGE_OWNER_KINDS,
  DIAGNOSTIC_TYPES,
  AgreementIndexError,
  indexAgreement,
} = require('../lib/canonical-v2/agreement-index');
const {
  rebuildAdmittedSourcePrimitives,
} = require('../lib/canonical-v2/admitted-source-chain-rebuild');
const {
  sectionizeAdmittedSource,
} = require('../lib/canonical-v2/native-producer/deterministic-sectionizer');
const { canonicalJson, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');

const ROOT = path.resolve(__dirname, '..');
const MIGRATION_ROOT = path.join(
  ROOT,
  'evidence/canonical-v2/stage-2y-structure-migration',
);
const CONTROL_ROOT = path.join(MIGRATION_ROOT, 'control');
const SHADOW_ROOT = path.join(MIGRATION_ROOT, 'shadow/m2');
const COHORT_PATH = path.join(CONTROL_ROOT, 'cohort-agreements.json');
const POLICY_PATH = path.join(CONTROL_ROOT, 'structural-policy.json');
const M0_MANIFEST_PATH = path.join(CONTROL_ROOT, 'manifest.json');
const M2_AUTHORITY_PATH = path.join(CONTROL_ROOT, 'm2-authority.json');

const HEX_256 = /^[0-9a-f]{64}$/;
const EXPECTED_AUTHORED_NODE_KINDS = Object.freeze([
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
const FORBIDDEN_NODE_KINDS = Object.freeze([
  'MARKER',
  'OUTLINE_MARKER',
  'REFERENCE_OCCURRENCE',
  'DEFINED_TERM_DEFINITION',
  'DEFINED_TERM_USE',
  'SOURCE_ARTEFACT',
  'SOURCE_TEXT',
  'BYTE_OWNER',
  'AMBIGUITY_CONTAINER',
]);
const EXPECTED_ANNOTATION_KINDS = Object.freeze([
  'OUTLINE_MARKER',
  'SECTION_REFERENCE',
  'DEFINED_TERM_DEFINITION',
  'DEFINED_TERM_USE',
]);
const EXPECTED_ARTEFACT_KINDS = Object.freeze([
  'PAGE_NUMBER',
  'FORM_FEED',
  'CONVERSION_CONTROL',
]);
const EXPECTED_COVERAGE_OWNER_KINDS = Object.freeze([
  'AUTHORED_NODE',
  'SOURCE_ARTEFACT',
]);

const SYNTHETIC_TEXT = [
  'AGREEMENT',
  '',
  'ARTICLE III',
  'COVENANTS',
  '',
  'Section 3.1. Delivery. Parent shall:',
  '(a) cause Merger Sub to:',
  '(i) deliver the Certificate; and',
  '(ii) pay the Consideration, provided that Section 3.2 applies.',
  '',
  'Section 3.2. Notice. Parent shall give notice. The Company shall cooperate.',
  '',
  '-12-',
  '',
].join('\n');

const METSERA_704_SENTENCES = Object.freeze([
  Object.freeze({
    start_byte: 225804,
    end_byte: 226065,
    text: 'Neither Parent nor Merger Sub may rely on the failure of any condition set forth in Section 7.01 or Section 7.02 to be satisfied if such failure was primarily caused by Parent\u2019s or Merger Sub\u2019s material breach of any of its obligations under this Agreement.',
  }),
  Object.freeze({
    start_byte: 226066,
    end_byte: 226288,
    text: 'The Company may not rely on the failure of any condition set forth in Section 7.01 or Section 7.03 to be satisfied if such failure was primarily caused by its material breach of any of its obligations under this Agreement.',
  }),
]);
const METSERA_704_REFERENCES = Object.freeze([
  Object.freeze(['7.01', 225888, 225900]),
  Object.freeze(['7.02', 225904, 225916]),
  Object.freeze(['7.01', 226136, 226148]),
  Object.freeze(['7.03', 226152, 226164]),
]);
const METSERA_704_CAUSAL_QUALIFICATIONS = Object.freeze([
  Object.freeze({
    start_byte: 225933,
    end_byte: 226065,
    text: 'if such failure was primarily caused by Parent\u2019s or Merger Sub\u2019s material breach of any of its obligations under this Agreement.',
  }),
  Object.freeze({
    start_byte: 226181,
    end_byte: 226288,
    text: 'if such failure was primarily caused by its material breach of any of its obligations under this Agreement.',
  }),
]);
const REDHAT_301_H_I_INLINE_LIMBS = Object.freeze([
  Object.freeze({ reference: '3.01(h)(i)(1)', start_byte: 61435, end_byte: 61968 }),
  Object.freeze({ reference: '3.01(h)(i)(2)', start_byte: 61973, end_byte: 62302 }),
]);
const REDHAT_302_B_I_SENTENCES = Object.freeze([
  Object.freeze([105297, 105660]),
  Object.freeze([105661, 106349]),
  Object.freeze([106350, 106710]),
]);
const CONCHO_69_A_SENTENCE = Object.freeze({
  start_byte: 227469,
  end_byte: 229032,
  text: [
    'Until December 31 of the calendar year in which the Effective Time occurs, Parent shall cause each individual who is employed as of the Closing Date by the Company or a Subsidiary thereof (a “Company Employee”) and who remains employed by Parent or any of its Subsidiaries (including the Surviving Corporation or any of its Subsidiaries) to be provided with ',
    '(i) a total target cash compensation opportunity (consisting of base salary or wages, as applicable, and annual cash incentive opportunity) that is no less favorable than that provided to similarly situated employees of Parent or its Subsidiaries, provided that a Company Employee’s base compensation (salary or wages, as applicable) shall not be reduced below the level in effect for such Company Employee as of immediately prior to the Closing Date; ',
    '(ii) eligibility for equity compensation to the same extent as provided to similarly situated employees of Parent or its Subsidiaries, provided that the amount of such equity compensation may be adjusted to avoid duplication that otherwise may arise as a result of differences in timing\n-65-\nof grants by the Company prior to the Closing Date and by Parent following the Closing Date; ',
    '(iii) employee benefits (including retirement plan participation but excluding severance benefits) at a level that is no less favorable in the aggregate than that in effect for such Company Employee immediately prior to the Closing Date; and ',
    '(iv) eligibility for severance benefits on the same terms as similarly situated employees of Parent or its Subsidiaries.',
  ].join(''),
});
const CONCHO_69_A_INLINE_LIMBS = Object.freeze([
  Object.freeze({ reference: '6.9(a)(i)', start_byte: 227831, end_byte: 228285 }),
  Object.freeze({ reference: '6.9(a)(ii)', start_byte: 228285, end_byte: 228670 }),
  Object.freeze({ reference: '6.9(a)(iii)', start_byte: 228670, end_byte: 228912 }),
  Object.freeze({ reference: '6.9(a)(iv)', start_byte: 228912, end_byte: 229032 }),
]);
const CONCHO_69_A_INLINE_MARKERS = Object.freeze([
  Object.freeze(['6.9(a)(i)', 227831, 227834, '(i)']),
  Object.freeze(['6.9(a)(ii)', 228285, 228289, '(ii)']),
  Object.freeze(['6.9(a)(iii)', 228670, 228675, '(iii)']),
  Object.freeze(['6.9(a)(iv)', 228912, 228916, '(iv)']),
]);
const CONCHO_69_A_LOCAL_QUALIFICATIONS = Object.freeze([
  Object.freeze([228079, 228284]),
  Object.freeze([228420, 228669]),
]);

const SYNTHETIC_NESTED_INLINE_TEXT = [
  'AGREEMENT',
  '',
  'ARTICLE I',
  'COVENANTS',
  '',
  'Section 1.1. Delivery. Parent shall provide (i) certificates, including (A) an officer certificate and (B) a secretary certificate; and (ii) notices.',
  '',
  'Section 1.2. References. Parent shall comply with Section 6.9(a)(i), clauses (i) and (ii) above, and Item 601(b)(10). Parent may use an uncorroborated (i) reference.',
  '',
].join('\n');

const FROZEN_DIGESTS = Object.freeze({
  'evidence/canonical-v2/stage-2y-structure-migration/control/manifest.json':
    '62fa3cb1f25a0e180da93bd94516637a119d4e99b6890f0d8321c9ea30b25a41',
  'evidence/canonical-v2/stage-2y-cd-baseline.json':
    '892d258699ab933051e135d66c9a515fadd7983f6d2e11e2e7d4804871424dcb',
  'evidence/canonical-v2/stage-2y-n-rendered-rows.json':
    '537b1f132f4fcfa7df50cc9536f68fc615a81c7334929b4cbb55fd70f2f884d4',
});

const sourceCache = new Map();

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function digestFile(relativePath) {
  return sha256Hex(fs.readFileSync(path.join(ROOT, relativePath)));
}

function policyWithoutDeclaredDigest(policy) {
  const copy = structuredClone(policy);
  delete copy.policy_digest;
  return copy;
}

function basePolicy(overrides = {}) {
  return {
    schema_version: 'STAGE_2Y_STRUCTURAL_POLICY/V1',
    policy_version: 1,
    coordinate_system: COORDINATE_SYSTEM,
    authored_node_kinds: [...AUTHORED_NODE_KINDS],
    annotation_kinds: [...ANNOTATION_KINDS],
    source_artefact_kinds: [...SOURCE_ARTEFACT_KINDS],
    byte_coverage_owner_kinds: [...BYTE_COVERAGE_OWNER_KINDS],
    diagnostic_types: [...DIAGNOSTIC_TYPES],
    inline_list_policy: {
      schema_version: 'STAGE_2Y_INLINE_LIST_POLICY/V1',
      parser_version: 'AGREEMENT_INLINE_STRUCTURE_PARSER/V1',
      maximum_depth: 5,
      dispositions: [
        'AUTHORED_INLINE_LIST',
        'NON_STRUCTURAL_MARKER',
        'UNRESOLVED_INLINE_LIST',
      ],
      styles: [
        'UNCLASSIFIED',
        'alphaLower',
        'alphaUpper',
        'digit',
        'romanLower',
        'romanUpper',
        'xyz',
      ],
      authored_reasons: [
        'CORROBORATED_SUBSTANTIVE_SEQUENCE',
      ],
      non_structural_reasons: [
        'AMBIGUOUS_MARKER_STYLE',
        'BARE_CLAUSE_REFERENCE',
        'GLUED_SECTION_REFERENCE',
        'TABLE_OF_CONTENTS_REFERENCE',
        'UNCORROBORATED_FIRST_MARKER',
      ],
      unresolved_reasons: [
        'AMBIGUOUS_SAME_STYLE_RESTART',
        'CROSSING_LIST_BOUNDARY',
        'DEPTH_LIMIT',
        'INSUFFICIENT_ITEM_PAYLOAD',
        'OUT_OF_ORDER_MARKER_SEQUENCE',
        'SOURCE_ARTEFACT_BOUNDARY_AMBIGUOUS',
      ],
    },
    reviewed_structure_overrides: [],
    ...overrides,
  };
}

function exactSourceFor(text) {
  const canonicalTextSha256 = sha256Hex(text);
  const rawSourceSha256 = sha256Hex(`raw\0${text}`);
  return {
    agreement_id: sha256Hex(`agreement\0${text}`),
    deal: 'synthetic',
    canonical_text: text,
    canonical_text_id: sha256Hex(`canonical-text\0${text}`),
    canonical_text_sha256: canonicalTextSha256,
    canonical_text_byte_length: Buffer.byteLength(text, 'utf8'),
    immutable_source_document_id: sha256Hex(`source-document\0${text}`),
    raw_source_sha256: rawSourceSha256,
    raw_source_byte_length: Buffer.byteLength(`raw\0${text}`, 'utf8'),
    source_path: 'tests/fixtures/synthetic/agreement.txt',
    source_bindings: [{ binding_type: 'SYNTHETIC_TEST', raw_source_sha256: rawSourceSha256 }],
  };
}

function expectCode(code, operation) {
  assert.throws(operation, (error) => {
    assert.ok(error instanceof AgreementIndexError);
    assert.equal(error.code, code);
    assert.ok(Object.hasOwn(error, 'detail'));
    return true;
  });
}

function spanText(sourceText, span) {
  return Buffer.from(sourceText, 'utf8')
    .subarray(span.start_byte, span.end_byte)
    .toString('utf8');
}

function authoredTextWithoutArtefacts(index, node, sourceText) {
  const bytes = Buffer.from(sourceText, 'utf8');
  const artefacts = index.source_artefacts
    .filter((artefact) => artefact.span.start_byte >= node.extent_span.start_byte
      && artefact.span.end_byte <= node.extent_span.end_byte)
    .sort((left, right) => left.span.start_byte - right.span.start_byte);
  const components = [];
  let cursor = node.extent_span.start_byte;
  for (const artefact of artefacts) {
    components.push(bytes.subarray(cursor, artefact.span.start_byte));
    cursor = artefact.span.end_byte;
  }
  components.push(bytes.subarray(cursor, node.extent_span.end_byte));
  return Buffer.concat(components).toString('utf8').replace(/\s+/g, ' ').trim();
}

function assertExactSpan(span, sourceBytes, label) {
  assert.equal(span.coordinate_system, COORDINATE_SYSTEM, `${label} coordinate system`);
  assert.ok(Number.isSafeInteger(span.start_byte), `${label} start byte`);
  assert.ok(Number.isSafeInteger(span.end_byte), `${label} end byte`);
  assert.ok(span.start_byte >= 0, `${label} starts before source`);
  assert.ok(span.end_byte > span.start_byte, `${label} is empty or inverted`);
  assert.ok(span.end_byte <= sourceBytes.length, `${label} ends after source`);
  assert.match(span.text_sha256, HEX_256, `${label} span digest shape`);
  const selected = sourceBytes.subarray(span.start_byte, span.end_byte);
  assert.ok(Buffer.from(selected.toString('utf8'), 'utf8').equals(selected),
    `${label} starts and ends on UTF-8 character boundaries`);
  assert.equal(
    span.text_sha256,
    sha256Hex(selected),
    `${label} span digest`,
  );
}

function assertSourceBinding(index, expectedSource) {
  const binding = index.source_binding;
  const bytes = Buffer.from(expectedSource.canonical_text, 'utf8');
  assert.equal(binding.canonical_text, expectedSource.canonical_text);
  assert.equal(binding.canonical_text_sha256, sha256Hex(bytes));
  assert.equal(binding.canonical_text_byte_length, bytes.length);
  assert.equal(binding.agreement_id, expectedSource.agreement_id);
  assert.equal(binding.immutable_source_document_id, expectedSource.immutable_source_document_id);
  assert.match(binding.canonical_text_id, HEX_256);
  assert.match(binding.source_binding_digest, HEX_256);
}

function assertTree(index, sourceBytes) {
  const allowedKinds = new Set(EXPECTED_AUTHORED_NODE_KINDS);
  const forbiddenKinds = new Set(FORBIDDEN_NODE_KINDS);
  const byId = new Map();

  assert.ok(Array.isArray(index.nodes) && index.nodes.length > 0);
  for (const node of index.nodes) {
    assert.equal(node.schema_version, SOURCE_NODE_SCHEMA_VERSION);
    assert.match(node.node_occurrence_id, HEX_256);
    assert.match(node.structure_revision_id, HEX_256);
    assert.equal(byId.has(node.node_occurrence_id), false, 'duplicate node occurrence ID');
    byId.set(node.node_occurrence_id, node);
    assert.ok(allowedKinds.has(node.node_kind), `non-authored node kind ${node.node_kind}`);
    assert.equal(forbiddenKinds.has(node.node_kind), false, `forbidden node kind ${node.node_kind}`);
    assert.ok(Array.isArray(node.roles));
    assert.deepEqual(node.roles, [...new Set(node.roles)].sort());
    assert.ok(Array.isArray(node.child_node_occurrence_ids));
    assertExactSpan(node.extent_span, sourceBytes, `node ${node.node_occurrence_id}`);
  }

  assert.equal(new Set(index.nodes.map((node) => node.structure_revision_id)).size,
    index.nodes.length, 'structure revision IDs');
  const root = byId.get(index.root_node_occurrence_id);
  assert.ok(root, 'root node');
  assert.equal(root.node_kind, 'AGREEMENT');
  assert.equal(root.parent_node_occurrence_id, null);
  assert.equal(root.extent_span.start_byte, 0);
  assert.equal(root.extent_span.end_byte, sourceBytes.length);
  assert.equal(index.nodes.filter((node) => node.parent_node_occurrence_id === null).length, 1);

  for (const parent of index.nodes) {
    const children = parent.child_node_occurrence_ids.map((childId) => byId.get(childId));
    assert.ok(children.every(Boolean), `${parent.node_occurrence_id} child exists`);
    assert.deepEqual(children.map((child) => child.child_ordinal),
      children.map((_, ordinal) => ordinal), `${parent.node_occurrence_id} child ordinals`);
    for (const child of children) {
      assert.equal(child.parent_node_occurrence_id, parent.node_occurrence_id,
        `${child.node_occurrence_id} reciprocal parent`);
      assert.ok(parent.extent_span.start_byte <= child.extent_span.start_byte,
        `${child.node_occurrence_id} starts inside parent`);
      assert.ok(parent.extent_span.end_byte >= child.extent_span.end_byte,
        `${child.node_occurrence_id} ends inside parent`);
    }
    for (let position = 1; position < children.length; position += 1) {
      assert.ok(children[position - 1].extent_span.end_byte
        <= children[position].extent_span.start_byte,
      `${parent.node_occurrence_id} authored child blocks do not overlap`);
    }
  }

  for (const node of index.nodes) {
    if (node === root) continue;
    const parent = byId.get(node.parent_node_occurrence_id);
    assert.ok(parent, `${node.node_occurrence_id} parent exists`);
    assert.equal(parent.child_node_occurrence_ids[node.child_ordinal], node.node_occurrence_id,
      `${node.node_occurrence_id} reciprocal ordinal`);

    const seen = new Set([node.node_occurrence_id]);
    let cursor = node;
    while (cursor.parent_node_occurrence_id !== null) {
      assert.equal(seen.has(cursor.parent_node_occurrence_id), false,
        `${node.node_occurrence_id} acyclic ancestry`);
      seen.add(cursor.parent_node_occurrence_id);
      cursor = byId.get(cursor.parent_node_occurrence_id);
      assert.ok(cursor, `${node.node_occurrence_id} complete ancestry`);
    }
    assert.equal(cursor.node_occurrence_id, root.node_occurrence_id,
      `${node.node_occurrence_id} reaches root`);
  }

  function isAncestor(ancestorId, node) {
    let cursor = node;
    while (cursor.parent_node_occurrence_id !== null) {
      if (cursor.parent_node_occurrence_id === ancestorId) return true;
      cursor = byId.get(cursor.parent_node_occurrence_id);
    }
    return false;
  }
  const depths = new Map();
  for (const node of index.nodes) {
    let depth = 0;
    let cursor = node;
    while (cursor.parent_node_occurrence_id !== null) {
      depth += 1;
      cursor = byId.get(cursor.parent_node_occurrence_id);
    }
    depths.set(node.node_occurrence_id, depth);
  }
  const sourceOrder = [...index.nodes].sort((left, right) =>
    left.extent_span.start_byte - right.extent_span.start_byte
      || right.extent_span.end_byte - left.extent_span.end_byte
      || depths.get(left.node_occurrence_id) - depths.get(right.node_occurrence_id)
      || left.node_occurrence_id.localeCompare(right.node_occurrence_id));
  const openBlocks = [];
  for (const node of sourceOrder) {
    while (openBlocks.length > 0
      && openBlocks.at(-1).extent_span.end_byte <= node.extent_span.start_byte) {
      openBlocks.pop();
    }
    if (openBlocks.length > 0) {
      const containing = openBlocks.at(-1);
      assert.ok(node.extent_span.end_byte <= containing.extent_span.end_byte
        && isAncestor(containing.node_occurrence_id, node),
      `${containing.node_occurrence_id} and ${node.node_occurrence_id} cross block boundaries`);
    }
    openBlocks.push(node);
  }

  return byId;
}

function assertAnnotations(index, sourceBytes, nodesById) {
  const allowedKinds = new Set(EXPECTED_ANNOTATION_KINDS);
  const seen = new Set();
  for (const annotation of index.annotations) {
    assert.equal(annotation.schema_version, SOURCE_ANNOTATION_SCHEMA_VERSION);
    assert.match(annotation.annotation_occurrence_id, HEX_256);
    assert.equal(seen.has(annotation.annotation_occurrence_id), false,
      'duplicate annotation occurrence ID');
    seen.add(annotation.annotation_occurrence_id);
    assert.ok(allowedKinds.has(annotation.annotation_kind),
      `unknown annotation kind ${annotation.annotation_kind}`);
    assert.ok(Array.isArray(annotation.roles));
    assert.deepEqual(annotation.roles, [...new Set(annotation.roles)].sort());
    assertExactSpan(annotation.span, sourceBytes,
      `annotation ${annotation.annotation_occurrence_id}`);
    const owner = nodesById.get(annotation.owner_node_occurrence_id);
    assert.ok(owner, `${annotation.annotation_occurrence_id} owner`);
    assert.ok(owner.extent_span.start_byte <= annotation.span.start_byte);
    assert.ok(owner.extent_span.end_byte >= annotation.span.end_byte);
  }
}

function assertArtefacts(index, sourceBytes, nodesById) {
  const allowedKinds = new Set(EXPECTED_ARTEFACT_KINDS);
  const seen = new Set();
  for (const artefact of index.source_artefacts) {
    assert.equal(artefact.schema_version, SOURCE_ARTEFACT_SCHEMA_VERSION);
    assert.match(artefact.source_artefact_id, HEX_256);
    assert.equal(seen.has(artefact.source_artefact_id), false,
      'duplicate source artefact ID');
    seen.add(artefact.source_artefact_id);
    assert.ok(allowedKinds.has(artefact.source_artefact_kind),
      `unknown source artefact kind ${artefact.source_artefact_kind}`);
    assertExactSpan(artefact.span, sourceBytes, `artefact ${artefact.source_artefact_id}`);
    const containingNode = nodesById.get(artefact.containing_node_occurrence_id);
    assert.ok(containingNode, `${artefact.source_artefact_id} containing node`);
    assert.ok(containingNode.extent_span.start_byte <= artefact.span.start_byte);
    assert.ok(containingNode.extent_span.end_byte >= artefact.span.end_byte);
    assert.equal(index.nodes.some((node) => node.node_kind === 'HEADING'
      && node.extent_span.start_byte < artefact.span.end_byte
      && node.extent_span.end_byte > artefact.span.start_byte), false,
    `${artefact.source_artefact_id} does not overlap an authored heading`);
  }
}

function assertCoverage(index, sourceBytes, nodesById) {
  const coverage = index.byte_coverage;
  const artefactsById = new Map(index.source_artefacts
    .map((artefact) => [artefact.source_artefact_id, artefact]));
  assert.equal(coverage.schema_version, BYTE_COVERAGE_SCHEMA_VERSION);
  assert.equal(coverage.coordinate_system, COORDINATE_SYSTEM);
  assert.equal(coverage.source_byte_length, sourceBytes.length);
  assert.equal(coverage.covered_byte_length, sourceBytes.length);
  assert.equal(coverage.complete, true);
  assert.deepEqual(coverage.gaps, []);
  assert.deepEqual(coverage.overlaps, []);
  assert.match(coverage.proof_digest, HEX_256);
  assert.ok(Array.isArray(coverage.segments) && coverage.segments.length > 0);

  let cursor = 0;
  for (const [position, segment] of coverage.segments.entries()) {
    assert.equal(segment.start_byte, cursor, `coverage segment ${position} starts at cursor`);
    assert.ok(segment.end_byte > segment.start_byte, `coverage segment ${position} non-empty`);
    assert.ok(segment.end_byte <= sourceBytes.length, `coverage segment ${position} in source`);
    assert.equal(segment.text_sha256,
      sha256Hex(sourceBytes.subarray(segment.start_byte, segment.end_byte)),
    `coverage segment ${position} digest`);
    assert.ok(EXPECTED_COVERAGE_OWNER_KINDS.includes(segment.owner_kind));
    if (segment.owner_kind === 'AUTHORED_NODE') {
      const owner = nodesById.get(segment.owner_id);
      assert.ok(owner, `coverage segment ${position} authored owner`);
      assert.ok(owner.extent_span.start_byte <= segment.start_byte);
      assert.ok(owner.extent_span.end_byte >= segment.end_byte);
    } else {
      const owner = artefactsById.get(segment.owner_id);
      assert.ok(owner, `coverage segment ${position} artefact owner`);
      assert.equal(owner.span.start_byte, segment.start_byte);
      assert.equal(owner.span.end_byte, segment.end_byte);
    }
    cursor = segment.end_byte;
  }
  assert.equal(cursor, sourceBytes.length);
}

function assertAliases(index, nodesById) {
  const aliasIds = new Set();
  const edges = new Set();
  const targetsByLegacy = new Map();
  const legaciesByTarget = new Map();
  const recordsByLegacy = new Map();
  for (const alias of index.aliases) {
    assert.equal(alias.schema_version, 'AGREEMENT_SOURCE_ALIAS/V1');
    assert.match(alias.alias_id, HEX_256);
    assert.match(alias.legacy_node_id, HEX_256);
    assert.match(alias.node_occurrence_id, HEX_256);
    assert.match(alias.structure_revision_id, HEX_256);
    assert.ok(['ONE_TO_ONE', 'ONE_TO_MANY'].includes(alias.cardinality),
      `typed alias cardinality ${alias.cardinality}`);
    assert.equal(aliasIds.has(alias.alias_id), false, 'alias ID collision');
    const legacyKey = `${alias.legacy_schema_version}\0${alias.legacy_node_id}`;
    const edgeKey = `${legacyKey}\0${alias.node_occurrence_id}`;
    assert.equal(edges.has(edgeKey), false, 'duplicate alias edge');
    aliasIds.add(alias.alias_id);
    edges.add(edgeKey);
    if (!targetsByLegacy.has(legacyKey)) targetsByLegacy.set(legacyKey, new Set());
    if (!recordsByLegacy.has(legacyKey)) recordsByLegacy.set(legacyKey, []);
    if (!legaciesByTarget.has(alias.node_occurrence_id)) {
      legaciesByTarget.set(alias.node_occurrence_id, new Set());
    }
    targetsByLegacy.get(legacyKey).add(alias.node_occurrence_id);
    recordsByLegacy.get(legacyKey).push(alias);
    legaciesByTarget.get(alias.node_occurrence_id).add(legacyKey);
    const node = nodesById.get(alias.node_occurrence_id);
    assert.ok(node, `${alias.alias_id} source node`);
    assert.equal(alias.structure_revision_id, node.structure_revision_id);
    assert.equal(typeof alias.basis, 'string');
    assert.ok(alias.basis.length > 0);
  }

  for (const [legacyKey, targets] of targetsByLegacy) {
    const expectedCardinality = targets.size === 1 ? 'ONE_TO_ONE' : 'ONE_TO_MANY';
    assert.ok(recordsByLegacy.get(legacyKey).every((alias) =>
      alias.cardinality === expectedCardinality), `${legacyKey} cardinality declaration`);
    if (targets.size === 1) continue;
    for (const target of targets) {
      assert.equal(legaciesByTarget.get(target).size, 1,
        `${legacyKey} participates in a many-to-many alias`);
    }
  }
  for (const [target, legacies] of legaciesByTarget) {
    assert.equal(legacies.size, 1, `${target} has a many-to-one alias collision`);
  }
}

function assertCurrentSectionizerAliasCoverage(index, sourceText, documentHash) {
  const current = sectionizeAdmittedSource({
    source_text: sourceText,
    document_hash: documentHash,
  });
  const aliased = new Set(index.aliases
    .filter((alias) => alias.legacy_schema_version === current.schema_version)
    .map((alias) => alias.legacy_node_id));
  assert.deepEqual(
    [...aliased].sort(),
    current.nodes.map((node) => node.section_id).sort(),
    'every current sectionizer node has at least one typed alias edge',
  );
}

function assertTypedUncertainty(index, sourceBytes, nodesById) {
  const ambiguityIds = new Set();
  for (const ambiguity of index.ambiguities) {
    assert.equal(ambiguity.schema_version, 'AGREEMENT_STRUCTURE_AMBIGUITY/V1');
    assert.match(ambiguity.ambiguity_id, HEX_256);
    assert.equal(ambiguityIds.has(ambiguity.ambiguity_id), false);
    ambiguityIds.add(ambiguity.ambiguity_id);
    assert.equal(typeof ambiguity.ambiguity_type, 'string');
    assert.ok(ambiguity.ambiguity_type.length > 0);
    assert.equal(typeof ambiguity.status, 'string');
    assert.ok(Array.isArray(ambiguity.node_occurrence_ids));
    assert.ok(ambiguity.node_occurrence_ids.every((nodeId) => nodesById.has(nodeId)));
    assertExactSpan(ambiguity.span, sourceBytes, `ambiguity ${ambiguity.ambiguity_id}`);
    assert.notEqual(ambiguity.detail, undefined);
  }

  const diagnosticIds = new Set();
  for (const diagnostic of index.diagnostics) {
    assert.equal(diagnostic.schema_version, 'AGREEMENT_INDEX_DIAGNOSTIC/V1');
    assert.match(diagnostic.diagnostic_id, HEX_256);
    assert.equal(diagnosticIds.has(diagnostic.diagnostic_id), false);
    diagnosticIds.add(diagnostic.diagnostic_id);
    assert.ok(DIAGNOSTIC_TYPES.includes(diagnostic.diagnostic_type),
      `typed diagnostic ${diagnostic.diagnostic_type}`);
    assert.equal(typeof diagnostic.severity, 'string');
    assert.ok(diagnostic.severity.length > 0);
    if (diagnostic.span !== null) {
      assertExactSpan(diagnostic.span, sourceBytes, `diagnostic ${diagnostic.diagnostic_id}`);
    }
    assert.notEqual(diagnostic.detail, undefined);
  }
}

function assertAgreementIndex(index, exactSource, policy) {
  const sourceBytes = Buffer.from(exactSource.canonical_text, 'utf8');
  assert.equal(index.schema_version, AGREEMENT_INDEX_SCHEMA_VERSION);
  assert.equal(index.coordinate_system, COORDINATE_SYSTEM);
  assert.match(index.agreement_index_id, HEX_256);
  assertSourceBinding(index, exactSource);
  assert.equal(index.structural_policy.schema_version, policy.schema_version);
  assert.equal(index.structural_policy.policy_version, policy.policy_version);
  assert.equal(index.structural_policy.policy_digest,
    policy.policy_digest || sha256Hex(canonicalJson(policyWithoutDeclaredDigest(policy))));
  assert.ok(index.counts && typeof index.counts === 'object');
  assert.ok(Array.isArray(index.annotations));
  assert.ok(Array.isArray(index.source_artefacts));
  assert.ok(Array.isArray(index.aliases));
  assert.ok(Array.isArray(index.ambiguities));
  assert.ok(Array.isArray(index.diagnostics));

  const nodesById = assertTree(index, sourceBytes);
  assertAnnotations(index, sourceBytes, nodesById);
  assertArtefacts(index, sourceBytes, nodesById);
  assertCoverage(index, sourceBytes, nodesById);
  assertAliases(index, nodesById);
  assertTypedUncertainty(index, sourceBytes, nodesById);
}

function childNodes(index, parentId, kind = null) {
  const byId = new Map(index.nodes.map((node) => [node.node_occurrence_id, node]));
  const parent = byId.get(parentId);
  assert.ok(parent, `parent ${parentId}`);
  return parent.child_node_occurrence_ids
    .map((childId) => byId.get(childId))
    .filter((node) => !kind || node.node_kind === kind);
}

function isDescendantOf(index, node, ancestorId) {
  const byId = new Map(index.nodes.map((entry) => [entry.node_occurrence_id, entry]));
  let cursor = node;
  while (cursor.parent_node_occurrence_id !== null) {
    if (cursor.parent_node_occurrence_id === ancestorId) return true;
    cursor = byId.get(cursor.parent_node_occurrence_id);
    if (!cursor) return false;
  }
  return false;
}

function uniqueNode(index, predicate, label) {
  const matches = index.nodes.filter(predicate);
  assert.equal(matches.length, 1, `${label} must have one node, found ${matches.length}`);
  return matches[0];
}

function rebuiltSourceFor(agreement) {
  if (!sourceCache.has(agreement.agreement_id)) {
    const sourceChainPath = path.join(ROOT, agreement.source_chain_paths[0]);
    const primitives = rebuildAdmittedSourcePrimitives({
      runDirectory: path.dirname(sourceChainPath),
      repoRoot: ROOT,
    });
    const rawBytes = fs.readFileSync(path.join(ROOT, agreement.admitted_source_path));
    assert.equal(rawBytes.length, agreement.raw_source_byte_length);
    assert.equal(sha256Hex(rawBytes), agreement.raw_source_sha256);
    assert.equal(primitives.conversion.canonical_text_sha256,
      agreement.canonical_text_sha256);
    assert.equal(Buffer.byteLength(primitives.conversion.canonical_text, 'utf8'),
      agreement.canonical_text_byte_length);
    assert.equal(primitives.immutable_source_document.immutable_source_document_id,
      agreement.immutable_source_document_id || agreement.agreement_id);
    sourceCache.set(agreement.agreement_id, primitives.conversion.canonical_text);
  }
  return sourceCache.get(agreement.agreement_id);
}

function sealedIndexFor(agreement) {
  return readJson(path.join(SHADOW_ROOT, `${agreement.agreement_id}.agreement-index.json`));
}

test('the public API validates exact source and structural policy with typed errors', () => {
  assert.equal(AGREEMENT_INDEX_SCHEMA_VERSION, 'AGREEMENT_INDEX/V1');
  assert.deepEqual([...AUTHORED_NODE_KINDS], EXPECTED_AUTHORED_NODE_KINDS);
  assert.deepEqual([...ANNOTATION_KINDS], EXPECTED_ANNOTATION_KINDS);
  assert.deepEqual([...SOURCE_ARTEFACT_KINDS], EXPECTED_ARTEFACT_KINDS);
  assert.deepEqual([...BYTE_COVERAGE_OWNER_KINDS], EXPECTED_COVERAGE_OWNER_KINDS);
  assert.ok(Array.isArray(DIAGNOSTIC_TYPES) && DIAGNOSTIC_TYPES.length > 0);

  const source = exactSourceFor(SYNTHETIC_TEXT);
  const policy = basePolicy();
  expectCode('EXACT_SOURCE_REQUIRED', () => indexAgreement(null, policy));
  expectCode('EXACT_SOURCE_FIELD_REQUIRED', () => indexAgreement({}, policy));
  expectCode('INVALID_UTF8', () => indexAgreement('\ud800', policy));
  expectCode('CANONICAL_TEXT_HASH_MISMATCH', () => indexAgreement({
    ...source,
    canonical_text_sha256: '0'.repeat(64),
  }, policy));
  expectCode('CANONICAL_TEXT_LENGTH_MISMATCH', () => indexAgreement({
    ...source,
    canonical_text_byte_length: source.canonical_text_byte_length + 1,
  }, policy));
  expectCode('INVALID_DIGEST', () => indexAgreement({
    ...source,
    raw_source_sha256: 'not-a-digest',
  }, policy));
  expectCode('STRUCTURAL_POLICY_REQUIRED', () => indexAgreement(source, null));
  expectCode('STRUCTURAL_POLICY_SCHEMA_MISMATCH', () => indexAgreement(source, {
    ...policy,
    schema_version: 'STAGE_2Y_STRUCTURAL_POLICY/V2',
  }));
  expectCode('STRUCTURAL_POLICY_VERSION_INVALID', () => indexAgreement(source, {
    ...policy,
    policy_version: 0,
  }));
  expectCode('STRUCTURAL_POLICY_ENUM_MISMATCH', () => indexAgreement(source, {
    ...policy,
    authored_node_kinds: policy.authored_node_kinds.slice(1),
  }));
  expectCode('STRUCTURAL_POLICY_DIGEST_MISMATCH', () => indexAgreement(source, {
    ...policy,
    policy_digest: '0'.repeat(64),
  }));
});

test('a synthetic agreement produces a deterministic authored tree and separate ledgers', () => {
  const exactSource = exactSourceFor(SYNTHETIC_TEXT);
  const policy = basePolicy();
  const first = indexAgreement(exactSource, policy);
  const second = indexAgreement(structuredClone(exactSource), structuredClone(policy));
  assert.equal(canonicalJson(first), canonicalJson(second));
  assertAgreementIndex(first, exactSource, policy);
  const revisedPolicyIndex = indexAgreement(exactSource, basePolicy({ policy_version: 2 }));
  const revisedByOccurrence = new Map(revisedPolicyIndex.nodes.map((node) => [
    `${node.node_kind}:${node.extent_span.start_byte}`,
    node,
  ]));
  for (const node of first.nodes) {
    const revised = revisedByOccurrence.get(`${node.node_kind}:${node.extent_span.start_byte}`);
    assert.ok(revised, 'stable authored occurrence survives a policy revision');
    assert.equal(revised.node_occurrence_id, node.node_occurrence_id);
  }

  const section31 = uniqueNode(first,
    (node) => node.node_kind === 'SECTION' && node.reference === '3.1', 'synthetic 3.1');
  const section32 = uniqueNode(first,
    (node) => node.node_kind === 'SECTION' && node.reference === '3.2', 'synthetic 3.2');
  const limbA = uniqueNode(first,
    (node) => node.node_kind === 'LIMB' && node.reference === '3.1(a)', 'synthetic 3.1(a)');
  const limbI = uniqueNode(first,
    (node) => node.node_kind === 'LIMB' && node.reference === '3.1(a)(i)',
    'synthetic 3.1(a)(i)');
  const limbII = uniqueNode(first,
    (node) => node.node_kind === 'LIMB' && node.reference === '3.1(a)(ii)',
    'synthetic 3.1(a)(ii)');
  assert.equal(limbA.parent_node_occurrence_id, section31.node_occurrence_id);
  assert.equal(limbI.parent_node_occurrence_id, limbA.node_occurrence_id);
  assert.equal(limbII.parent_node_occurrence_id, limbA.node_occurrence_id);

  const chapeaux = first.nodes.filter((node) => node.node_kind === 'CHAPEAU');
  assert.ok(chapeaux.some((node) => spanText(SYNTHETIC_TEXT, node.extent_span).trim()
    === 'Parent shall:'));
  assert.ok(chapeaux.some((node) => spanText(SYNTHETIC_TEXT, node.extent_span).trim()
    === 'cause Merger Sub to:'));

  const qualifications = first.nodes.filter((node) => node.node_kind === 'QUALIFICATION');
  assert.ok(qualifications.some((node) => spanText(SYNTHETIC_TEXT, node.extent_span)
    .includes('provided that Section 3.2 applies')));
  const referenceAnnotations = first.annotations.filter((annotation) =>
    annotation.annotation_kind === 'SECTION_REFERENCE' && annotation.value === '3.2');
  assert.equal(referenceAnnotations.length, 1);
  assert.equal(spanText(SYNTHETIC_TEXT, referenceAnnotations[0].span), 'Section 3.2');

  const bareSentences = childNodes(first, section32.node_occurrence_id, 'SENTENCE');
  assert.deepEqual(bareSentences.map((node) => spanText(SYNTHETIC_TEXT, node.extent_span).trim()), [
    'Parent shall give notice.',
    'The Company shall cooperate.',
  ]);

  const markerAnnotations = first.annotations.filter((annotation) =>
    annotation.annotation_kind === 'OUTLINE_MARKER');
  const headingNodes = first.nodes.filter((node) => node.node_kind === 'HEADING');
  assert.ok(markerAnnotations.length >= 3);
  assert.ok(headingNodes.length >= 2);
  for (const marker of markerAnnotations) {
    assert.equal(headingNodes.some((heading) =>
      heading.extent_span.start_byte === marker.span.start_byte
      && heading.extent_span.end_byte === marker.span.end_byte), false,
    'an outline marker must not double as a heading node');
  }

  const pageNumbers = first.source_artefacts.filter((artefact) =>
    artefact.source_artefact_kind === 'PAGE_NUMBER');
  assert.equal(pageNumbers.length, 1);
  assert.equal(spanText(SYNTHETIC_TEXT, pageNumbers[0].span), '-12-');
});

test('inline-list parsing preserves nested authored limbs and rejects marker-shaped references', () => {
  const exactSource = exactSourceFor(SYNTHETIC_NESTED_INLINE_TEXT);
  const policy = basePolicy();
  const index = indexAgreement(exactSource, policy);
  assertAgreementIndex(index, exactSource, policy);

  const positiveSection = uniqueNode(index,
    (node) => node.node_kind === 'SECTION' && node.reference === '1.1',
    'synthetic inline-list section 1.1');
  const positiveSentence = uniqueNode(index,
    (node) => node.node_kind === 'SENTENCE'
      && node.parent_node_occurrence_id === positiveSection.node_occurrence_id,
    'synthetic inline-list sentence');
  assert.equal(
    spanText(SYNTHETIC_NESTED_INLINE_TEXT, positiveSentence.extent_span),
    'Parent shall provide (i) certificates, including (A) an officer certificate and (B) a secretary certificate; and (ii) notices.',
  );

  const sentenceChildren = childNodes(index, positiveSentence.node_occurrence_id);
  assert.deepEqual(sentenceChildren.map((node) => [
    node.node_kind,
    node.reference,
    spanText(SYNTHETIC_NESTED_INLINE_TEXT, node.extent_span).trim(),
  ]), [
    ['CHAPEAU', null, 'Parent shall provide'],
    ['LIMB', '1.1(i)', '(i) certificates, including (A) an officer certificate and (B) a secretary certificate; and'],
    ['LIMB', '1.1(ii)', '(ii) notices.'],
  ]);

  const outerFirst = sentenceChildren[1];
  const nestedChildren = childNodes(index, outerFirst.node_occurrence_id);
  assert.deepEqual(nestedChildren.map((node) => [
    node.node_kind,
    node.reference,
    spanText(SYNTHETIC_NESTED_INLINE_TEXT, node.extent_span).trim(),
  ]), [
    ['CHAPEAU', null, 'certificates, including'],
    ['LIMB', '1.1(i)(A)', '(A) an officer certificate and'],
    ['LIMB', '1.1(i)(B)', '(B) a secretary certificate; and'],
  ]);
  const positiveMarkers = index.annotations.filter((annotation) =>
    annotation.annotation_kind === 'OUTLINE_MARKER'
      && annotation.span.start_byte >= positiveSentence.extent_span.start_byte
      && annotation.span.end_byte <= positiveSentence.extent_span.end_byte);
  assert.deepEqual(positiveMarkers.map((annotation) => [
    annotation.value,
    spanText(SYNTHETIC_NESTED_INLINE_TEXT, annotation.span),
  ]), [
    ['1.1(i)', '(i)'],
    ['1.1(i)(A)', '(A)'],
    ['1.1(i)(B)', '(B)'],
    ['1.1(ii)', '(ii)'],
  ]);

  const negativeSection = uniqueNode(index,
    (node) => node.node_kind === 'SECTION' && node.reference === '1.2',
    'synthetic marker-shaped-reference section 1.2');
  const negativeSentences = childNodes(index, negativeSection.node_occurrence_id, 'SENTENCE');
  assert.equal(negativeSentences.length, 2);
  assert.equal(index.nodes.some((node) => node.node_kind === 'LIMB'
    && node.extent_span.start_byte >= negativeSection.extent_span.start_byte
    && node.extent_span.end_byte <= negativeSection.extent_span.end_byte), false,
  'cross-references and one uncorroborated marker do not create authored limbs');
  assert.equal(index.annotations.some((annotation) =>
    annotation.annotation_kind === 'OUTLINE_MARKER'
      && annotation.span.start_byte >= negativeSentences[0].extent_span.start_byte
      && annotation.span.end_byte <= negativeSection.extent_span.end_byte), false,
  'marker-shaped references do not create outline-marker annotations');
  const sectionReference = index.annotations.filter((annotation) =>
    annotation.annotation_kind === 'SECTION_REFERENCE'
      && annotation.value === '6.9(a)(i)'
      && annotation.span.start_byte >= negativeSentences[0].extent_span.start_byte
      && annotation.span.end_byte <= negativeSentences[0].extent_span.end_byte);
  assert.deepEqual(sectionReference.map((annotation) =>
    spanText(SYNTHETIC_NESTED_INLINE_TEXT, annotation.span)), ['Section 6.9(a)(i)']);
});

test('all seven sealed outputs retain the exact admitted source and satisfy structural invariants', () => {
  const cohort = readJson(COHORT_PATH);
  const policy = readJson(POLICY_PATH);
  assert.equal(cohort.agreement_count, 7);
  assert.equal(cohort.agreements.length, 7);
  const expectedNames = cohort.agreements
    .map((agreement) => `${agreement.agreement_id}.agreement-index.json`)
    .sort();
  const actualNames = fs.readdirSync(SHADOW_ROOT)
    .filter((name) => name.endsWith('.agreement-index.json'))
    .sort();
  assert.deepEqual(actualNames, expectedNames);

  for (const agreement of cohort.agreements) {
    const index = sealedIndexFor(agreement);
    const canonicalText = rebuiltSourceFor(agreement);
    const expectedSource = {
      ...index.source_binding,
      agreement_id: agreement.agreement_id,
      canonical_text: canonicalText,
      canonical_text_sha256: agreement.canonical_text_sha256,
      canonical_text_byte_length: agreement.canonical_text_byte_length,
      immutable_source_document_id: agreement.agreement_id,
    };
    assertAgreementIndex(index, expectedSource, policy);
    assert.equal(index.source_binding.deal, agreement.deal);
    assert.equal(index.source_binding.raw_source_sha256, agreement.raw_source_sha256);
    assert.equal(index.source_binding.raw_source_byte_length, agreement.raw_source_byte_length);
    assert.equal(index.source_binding.source_path, agreement.admitted_source_path);
    assertCurrentSectionizerAliasCoverage(index, canonicalText, agreement.raw_source_sha256);
    assert.equal(index.nodes.some((node) => node.node_kind === 'SECTION'
      && (/-INTRO$/.test(node.reference || '') || /^Annex-/.test(node.reference || ''))), false,
    `${agreement.deal}: parser-created section containers are not authored nodes`);

    const current = sectionizeAdmittedSource({
      source_text: canonicalText,
      document_hash: agreement.raw_source_sha256,
    });
    const nodesById = new Map(index.nodes.map((node) => [node.node_occurrence_id, node]));
    const aliasesByLegacy = new Map(index.aliases.map((alias) => [alias.legacy_node_id, alias]));
    for (const legacy of current.nodes) {
      const alias = aliasesByLegacy.get(legacy.section_id);
      assert.ok(alias, `${agreement.deal}: ${legacy.reference} alias`);
      const target = nodesById.get(alias.node_occurrence_id);
      if (legacy.kind === 'SECTION' && /-INTRO$/.test(legacy.reference || '')) {
        assert.ok(['CHAPEAU', 'HEADING'].includes(target.node_kind),
          `${agreement.deal}: ${legacy.reference} maps to authored introduction or heading`);
      }
      if (legacy.kind === 'SECTION' && /^Annex-[A-Z0-9]+$/.test(legacy.reference || '')) {
        assert.equal(target.node_kind, 'ANNEX',
          `${agreement.deal}: ${legacy.reference} maps to an authored annex`);
      }
      const legacyText = Buffer.from(canonicalText, 'utf8')
        .subarray(legacy.start, Math.min(legacy.end, legacy.start + 16))
        .toString('utf8');
      if (legacy.kind === 'ARTICLE' && /^ANNEX\s+[A-Z0-9]+/.test(legacyText)) {
        assert.equal(target.node_kind, 'HEADING',
          `${agreement.deal}: synthetic annex article maps to its authored heading`);
      }
    }

    const sourceBytes = Buffer.from(canonicalText, 'utf8');
    const annexMarkers = [];
    const annexPattern = /^ANNEX\s+([A-Z0-9]+)\s*$/gm;
    let annexMatch;
    while ((annexMatch = annexPattern.exec(canonicalText)) !== null) {
      const start = Buffer.byteLength(canonicalText.slice(0, annexMatch.index), 'utf8');
      annexMarkers.push({ label: annexMatch[1], start });
    }
    for (const [position, marker] of annexMarkers.entries()) {
      const annex = uniqueNode(index, (node) => node.node_kind === 'ANNEX'
        && node.reference === `ANNEX ${marker.label}`
        && node.extent_span.start_byte === marker.start,
      `${agreement.deal} ANNEX ${marker.label}`);
      assert.equal(annex.extent_span.end_byte,
        annexMarkers[position + 1]?.start || sourceBytes.length);
      const outline = index.annotations.filter((annotation) =>
        annotation.annotation_kind === 'OUTLINE_MARKER'
        && annotation.owner_node_occurrence_id === annex.node_occurrence_id);
      assert.deepEqual(outline.map((annotation) => spanText(canonicalText, annotation.span)),
        [`ANNEX ${marker.label}`]);
    }
    if (agreement.deal === 'topbuild') {
      assert.deepEqual(index.nodes.filter((node) => node.node_kind === 'HEADING'
        && [[406177, 406202], [406215, 406274]].some(([start, end]) =>
          node.extent_span.start_byte === start && node.extent_span.end_byte === end))
      .map((node) => [node.extent_span.start_byte, node.extent_span.end_byte]), [
        [406177, 406202],
        [406215, 406274],
      ]);
    }
  }
});

test('Metsera 7.04 round-trips deterministically with two source branches and four references', () => {
  const cohort = readJson(COHORT_PATH);
  const policy = readJson(POLICY_PATH);
  const agreement = cohort.agreements.find((entry) => entry.deal === 'metsera');
  assert.ok(agreement);
  const sealed = sealedIndexFor(agreement);
  const exactSource = structuredClone(sealed.source_binding);
  delete exactSource.source_binding_digest;
  exactSource.canonical_text = rebuiltSourceFor(agreement);

  const first = indexAgreement(exactSource, policy);
  const second = indexAgreement(structuredClone(exactSource), structuredClone(policy));
  assert.equal(canonicalJson(first), canonicalJson(second));
  assert.equal(canonicalJson(first), canonicalJson(sealed));

  const section = uniqueNode(sealed,
    (node) => node.node_kind === 'SECTION' && node.reference === '7.04', 'Metsera 7.04');
  const sentences = childNodes(sealed, section.node_occurrence_id, 'SENTENCE');
  assert.deepEqual(sentences.map((sentence) => ({
    start_byte: sentence.extent_span.start_byte,
    end_byte: sentence.extent_span.end_byte,
    text: spanText(exactSource.canonical_text, sentence.extent_span),
  })), METSERA_704_SENTENCES);
  const causalQualifications = sentences.map((sentence, index) => {
    const qualifications = childNodes(sealed, sentence.node_occurrence_id, 'QUALIFICATION');
    assert.equal(qualifications.length, 1,
      `Metsera 7.04 sentence ${index + 1} causal qualification`);
    assert.deepEqual(qualifications[0].roles, ['AUTHORED_QUALIFICATION']);
    return qualifications[0];
  });
  assert.deepEqual(causalQualifications.map((node) => ({
    start_byte: node.extent_span.start_byte,
    end_byte: node.extent_span.end_byte,
    text: spanText(exactSource.canonical_text, node.extent_span),
  })), METSERA_704_CAUSAL_QUALIFICATIONS);

  const references = sealed.annotations
    .filter((annotation) => annotation.annotation_kind === 'SECTION_REFERENCE'
      && annotation.span.start_byte >= section.extent_span.start_byte
      && annotation.span.end_byte <= section.extent_span.end_byte)
    .sort((left, right) => left.span.start_byte - right.span.start_byte);
  assert.deepEqual(references.map((annotation) => [
    annotation.value,
    annotation.span.start_byte,
    annotation.span.end_byte,
  ]), METSERA_704_REFERENCES);
  assert.deepEqual(references.map((annotation) =>
    spanText(exactSource.canonical_text, annotation.span)), [
    'Section 7.01',
    'Section 7.02',
    'Section 7.01',
    'Section 7.03',
  ]);
  const sentenceIds = new Set(sentences.map((sentence) => sentence.node_occurrence_id));
  assert.ok(references.every((annotation) => sentenceIds.has(annotation.owner_node_occurrence_id)));

  const prohibitedSemanticFragments = new Set(['may not rely', 'material breach', 'primarily caused']);
  assert.equal(sealed.nodes.some((node) =>
    prohibitedSemanticFragments.has(spanText(exactSource.canonical_text, node.extent_span).trim())),
  false, 'semantic fragments must not become source-tree children');
});

test('Concho 6.9(a) retains its sentence, governing chapeau, four limbs and local provisos', () => {
  const cohort = readJson(COHORT_PATH);
  const agreement = cohort.agreements.find((entry) => entry.deal === 'concho');
  assert.ok(agreement);
  const index = sealedIndexFor(agreement);
  const sourceText = rebuiltSourceFor(agreement);

  const outerLimb = uniqueNode(index,
    (node) => node.node_kind === 'LIMB' && node.reference === '6.9(a)',
    'Concho 6.9(a)');
  const sentence = uniqueNode(index,
    (node) => node.node_kind === 'SENTENCE'
      && node.parent_node_occurrence_id === outerLimb.node_occurrence_id,
    'Concho 6.9(a) retained sentence');
  assert.deepEqual({
    start_byte: sentence.extent_span.start_byte,
    end_byte: sentence.extent_span.end_byte,
    text: spanText(sourceText, sentence.extent_span),
  }, CONCHO_69_A_SENTENCE);

  const sentenceChildren = childNodes(index, sentence.node_occurrence_id);
  assert.deepEqual(sentenceChildren.map((node) => ({
    node_kind: node.node_kind,
    reference: node.reference,
    start_byte: node.extent_span.start_byte,
    end_byte: node.extent_span.end_byte,
  })), [
    {
      node_kind: 'CHAPEAU',
      reference: null,
      start_byte: CONCHO_69_A_SENTENCE.start_byte,
      end_byte: 227831,
    },
    ...CONCHO_69_A_INLINE_LIMBS.map((limb) => ({
      node_kind: 'LIMB',
      ...limb,
    })),
  ]);
  assert.equal(
    spanText(sourceText, sentenceChildren[0].extent_span),
    CONCHO_69_A_SENTENCE.text.slice(0, CONCHO_69_A_SENTENCE.text.indexOf('(i)')),
  );
  assert.deepEqual(sentenceChildren[0].roles, ['GOVERNING_TEXT']);

  const inlineLimbs = sentenceChildren.slice(1);
  assert.ok(inlineLimbs.every((limb) =>
    limb.parent_node_occurrence_id === sentence.node_occurrence_id));
  assert.ok(inlineLimbs.every((limb) =>
    limb.roles.includes('AUTHORED_INLINE_LIMB')));
  const inlineMarkers = index.annotations.filter((annotation) =>
    annotation.annotation_kind === 'OUTLINE_MARKER'
      && inlineLimbs.some((limb) =>
        annotation.owner_node_occurrence_id === limb.node_occurrence_id));
  assert.deepEqual(inlineMarkers.map((annotation) => [
    annotation.value,
    annotation.span.start_byte,
    annotation.span.end_byte,
    spanText(sourceText, annotation.span),
  ]), CONCHO_69_A_INLINE_MARKERS);

  const firstQualifications = childNodes(index, inlineLimbs[0].node_occurrence_id,
    'QUALIFICATION');
  const secondQualifications = childNodes(index, inlineLimbs[1].node_occurrence_id,
    'QUALIFICATION');
  assert.deepEqual([...firstQualifications, ...secondQualifications].map((qualification) => [
    qualification.extent_span.start_byte,
    qualification.extent_span.end_byte,
  ]), CONCHO_69_A_LOCAL_QUALIFICATIONS);
  assert.ok([...firstQualifications, ...secondQualifications].every((qualification) =>
    qualification.roles.includes('AUTHORED_QUALIFICATION')));
  assert.deepEqual(childNodes(index, sentence.node_occurrence_id, 'QUALIFICATION'), [],
    'a limb-local proviso must not govern its sibling limbs');
  assert.deepEqual(childNodes(index, inlineLimbs[2].node_occurrence_id, 'QUALIFICATION'), []);
  assert.deepEqual(childNodes(index, inlineLimbs[3].node_occurrence_id, 'QUALIFICATION'), []);

  const embeddedPageNumber = index.source_artefacts.filter((artefact) =>
    artefact.source_artefact_kind === 'PAGE_NUMBER'
      && artefact.span.start_byte === 228572
      && artefact.span.end_byte === 228576);
  assert.deepEqual(embeddedPageNumber.map((artefact) => [
    spanText(sourceText, artefact.span),
    artefact.containing_node_occurrence_id,
  ]), [['-65-', secondQualifications[0].node_occurrence_id]]);
  assert.deepEqual(index.byte_coverage.segments.filter((segment) =>
    segment.start_byte === 228572 && segment.end_byte === 228576)
  .map((segment) => [segment.owner_kind, segment.owner_id]), [
    ['SOURCE_ARTEFACT', embeddedPageNumber[0].source_artefact_id],
  ]);
});

test('Red Hat keeps three bare sentences and applies the ruled 3.01 hierarchy', () => {
  const cohort = readJson(COHORT_PATH);
  const agreement = cohort.agreements.find((entry) => entry.deal === 'redhat');
  assert.ok(agreement);
  const index = sealedIndexFor(agreement);
  const sourceText = rebuiltSourceFor(agreement);

  const authority = uniqueNode(index,
    (node) => node.node_kind === 'LIMB' && node.reference === '3.02(b)(i)',
    'Red Hat 3.02(b)(i)');
  const authoritySentences = childNodes(index, authority.node_occurrence_id, 'SENTENCE');
  assert.deepEqual(authoritySentences.map((sentence) => [
    sentence.extent_span.start_byte,
    sentence.extent_span.end_byte,
  ]), REDHAT_302_B_I_SENTENCES);
  assert.deepEqual(authoritySentences.map((sentence) =>
    authoredTextWithoutArtefacts(index, sentence, sourceText)), [
    'Each of Parent and Sub has the requisite corporate power and authority to execute and deliver this Agreement, to consummate the Merger and the other transactions contemplated by this Agreement, and to comply with the provisions of this Agreement (subject, in the case of the Merger, to the adoption of this Agreement by Parent, as the sole shareholder of Sub).',
    'The execution and delivery of this Agreement by Parent and Sub, the consummation by Parent and Sub of the Merger and the other transactions contemplated by this Agreement, and the compliance by Parent and Sub with the provisions of this Agreement have been duly authorized by all necessary corporate action on the part of Parent and Sub, and no other corporate proceedings on the part of Parent or Sub are necessary to authorize this Agreement, to comply with the terms of this Agreement or to consummate the Merger and the other transactions contemplated by this Agreement (subject, in the case of the Merger, to the adoption of this Agreement by Parent, as the sole shareholder of Sub).',
    'This Agreement has been duly executed and delivered by Parent and Sub, as applicable, and, assuming the due execution and delivery of this Agreement by the Company, constitutes a valid and binding obligation of Parent and Sub, as applicable, enforceable against Parent and Sub, as applicable, in accordance with its terms, subject to the Bankruptcy Exceptions.',
  ]);
  const embeddedPageNumber = index.source_artefacts.filter((artefact) =>
    artefact.source_artefact_kind === 'PAGE_NUMBER'
    && artefact.span.start_byte === 105596
    && artefact.span.end_byte === 105598);
  assert.equal(embeddedPageNumber.length, 1);
  assert.equal(spanText(sourceText, embeddedPageNumber[0].span), '22');
  const pageOwnerSegments = index.byte_coverage.segments.filter((segment) =>
    segment.start_byte === 105596 && segment.end_byte === 105598);
  assert.deepEqual(pageOwnerSegments.map((segment) => [segment.owner_kind, segment.owner_id]), [
    ['SOURCE_ARTEFACT', embeddedPageNumber[0].source_artefact_id],
  ]);

  const h = uniqueNode(index,
    (node) => node.node_kind === 'LIMB' && node.reference === '3.01(h)', 'Red Hat 3.01(h)');
  const nestedI = uniqueNode(index,
    (node) => node.node_kind === 'LIMB' && node.reference === '3.01(h)(i)',
    'Red Hat 3.01(h)(i)');
  const topLevelI = uniqueNode(index,
    (node) => node.node_kind === 'LIMB' && node.reference === '3.01(i)',
    'Red Hat top-level 3.01(i)');
  const topLevelJ = uniqueNode(index,
    (node) => node.node_kind === 'LIMB' && node.reference === '3.01(j)',
    'Red Hat top-level 3.01(j)');
  assert.equal(h.extent_span.start_byte, 55619);
  assert.equal(nestedI.extent_span.start_byte, 55634);
  assert.equal(topLevelI.extent_span.start_byte, 62303);
  assert.equal(topLevelJ.extent_span.start_byte, 64040);
  assert.equal(nestedI.parent_node_occurrence_id, h.node_occurrence_id);
  assert.equal(topLevelI.parent_node_occurrence_id, h.parent_node_occurrence_id);
  assert.equal(topLevelJ.parent_node_occurrence_id, h.parent_node_occurrence_id);
  assert.ok(h.child_ordinal < topLevelI.child_ordinal);
  assert.ok(topLevelI.child_ordinal < topLevelJ.child_ordinal);
  for (const letter of 'ABCDEFGHIJKLM') {
    const subLimb = uniqueNode(index,
      (node) => node.node_kind === 'LIMB'
        && node.reference === `3.01(h)(i)(${letter})`,
      `Red Hat 3.01(h)(i)(${letter})`);
    assert.equal(subLimb.parent_node_occurrence_id, nestedI.node_occurrence_id);
  }
  const redHatHeadings = childNodes(index, h.node_occurrence_id, 'HEADING')
    .concat(childNodes(index, topLevelI.node_occurrence_id, 'HEADING'));
  assert.deepEqual(redHatHeadings.map((heading) => [
    heading.extent_span.start_byte,
    heading.extent_span.end_byte,
    spanText(sourceText, heading.extent_span),
  ]), [
    [55623, 55633, 'Contracts.'],
    [62307, 62337, 'Permits; Compliance with Laws.'],
  ]);
  const limbM = uniqueNode(index,
    (node) => node.node_kind === 'LIMB' && node.reference === '3.01(h)(i)(M)',
    'Red Hat 3.01(h)(i)(M)');
  assert.equal(limbM.extent_span.end_byte, 60609);
  const nestedSentences = childNodes(index, nestedI.node_occurrence_id, 'SENTENCE');
  assert.deepEqual(nestedSentences.map((sentence) => [
    sentence.extent_span.start_byte,
    sentence.extent_span.end_byte,
  ]), [
    [60610, 60815],
    [60816, 61307],
    [61308, 62302],
  ]);
  const thirdSentence = nestedSentences[2];
  const inlineLimbs = childNodes(index, thirdSentence.node_occurrence_id, 'LIMB');
  assert.deepEqual(inlineLimbs.map((limb) => ({
    reference: limb.reference,
    start_byte: limb.extent_span.start_byte,
    end_byte: limb.extent_span.end_byte,
  })), REDHAT_301_H_I_INLINE_LIMBS);
  const inlineMarkers = index.annotations.filter((annotation) =>
    annotation.annotation_kind === 'OUTLINE_MARKER'
    && inlineLimbs.some((limb) =>
      annotation.owner_node_occurrence_id === limb.node_occurrence_id));
  assert.deepEqual(inlineMarkers.map((annotation) => [
    annotation.value,
    annotation.span.start_byte,
    annotation.span.end_byte,
    spanText(sourceText, annotation.span),
  ]), [
    ['3.01(h)(i)(1)', 61435, 61438, '(1)'],
    ['3.01(h)(i)(2)', 61973, 61976, '(2)'],
  ]);
  const governingQualifications = childNodes(index, thirdSentence.node_occurrence_id,
    'QUALIFICATION');
  assert.deepEqual(governingQualifications.map((qualification) => [
    qualification.extent_span.start_byte,
    qualification.extent_span.end_byte,
  ]), [[61308, 61434]]);
  const limbOneQualifications = childNodes(index, inlineLimbs[0].node_occurrence_id,
    'QUALIFICATION');
  assert.deepEqual(limbOneQualifications.map((qualification) => [
    qualification.extent_span.start_byte,
    qualification.extent_span.end_byte,
  ]), [[61490, 61567], [61932, 61968]]);
  assert.deepEqual(childNodes(index, inlineLimbs[1].node_occurrence_id, 'QUALIFICATION'), []);
  assert.ok(index.diagnostics.some((diagnostic) =>
    diagnostic.diagnostic_type === 'REVIEWED_STRUCTURE_OVERRIDE_APPLIED'));
  const currentTree = sectionizeAdmittedSource({
    source_text: sourceText,
    document_hash: agreement.raw_source_sha256,
  });
  const nestedLegacy = currentTree.nodes.find((node) =>
    node.reference === '3.01(i)' && node.start === 55634);
  const topLevelLegacy = currentTree.nodes.find((node) =>
    node.reference === '3.01(i)(M)(i)' && node.start === 62303);
  assert.ok(nestedLegacy, 'Red Hat current sectionizer nested marker source');
  assert.ok(topLevelLegacy, 'Red Hat current sectionizer top-level marker source');
  const nestedAliases = index.aliases.filter((alias) =>
    alias.legacy_schema_version === currentTree.schema_version
    && alias.legacy_node_id === nestedLegacy.section_id);
  const topLevelAliases = index.aliases.filter((alias) =>
    alias.legacy_schema_version === currentTree.schema_version
    && alias.legacy_node_id === topLevelLegacy.section_id);
  assert.deepEqual(nestedAliases.map((alias) => [
    alias.cardinality,
    alias.basis,
    alias.node_occurrence_id,
  ]), [[
    'ONE_TO_ONE',
    'SAME_MARKER_OCCURRENCE_REVISED_STRUCTURE',
    nestedI.node_occurrence_id,
  ]]);
  assert.deepEqual(topLevelAliases.map((alias) => [
    alias.cardinality,
    alias.basis,
    alias.node_occurrence_id,
  ]), [[
    'ONE_TO_ONE',
    'SAME_MARKER_OCCURRENCE_REVISED_STRUCTURE',
    topLevelI.node_occurrence_id,
  ]]);
});

test('the full-corpus ledgers keep residual blocks, markers, references and defined terms', () => {
  const cohort = readJson(COHORT_PATH);
  const byDeal = new Map(cohort.agreements.map((agreement) => [
    agreement.deal,
    { agreement, index: sealedIndexFor(agreement) },
  ]));
  const concho = byDeal.get('concho');
  const conchoText = rebuiltSourceFor(concho.agreement);
  const bareMarker = concho.index.annotations.filter((annotation) =>
    annotation.annotation_kind === 'OUTLINE_MARKER'
    && annotation.span.start_byte === 7160);
  assert.deepEqual(bareMarker.map((annotation) => [
    annotation.value,
    annotation.span.end_byte,
    spanText(conchoText, annotation.span),
  ]), [['1.1', 7163, '1.1']]);
  const annexPage = concho.index.source_artefacts.filter((artefact) =>
    artefact.span.start_byte === 313077);
  assert.deepEqual(annexPage.map((artefact) => [
    artefact.source_artefact_kind,
    artefact.span.end_byte,
    spanText(conchoText, artefact.span),
  ]), [['PAGE_NUMBER', 313080, 'A-1']]);
  const compressedReferences = concho.index.annotations
    .filter((annotation) => annotation.annotation_kind === 'SECTION_REFERENCE'
      && annotation.span.start_byte >= 57192
      && annotation.span.start_byte <= 57382)
    .map((annotation) => [
      annotation.span.start_byte,
      annotation.span.end_byte,
      annotation.value,
    ]);
  assert.deepEqual(compressedReferences, [
    [57192, 57210, '6.1(b)(i)'],
    [57212, 57220, '6.1(b)(iii)(A)'],
    [57222, 57226, '6.1(b)(iv)'],
    [57228, 57231, '6.1(b)(v)'],
    [57233, 57237, '6.1(b)(vi)'],
    [57239, 57244, '6.1(b)(vii)'],
    [57246, 57252, '6.1(b)(viii)'],
    [57254, 57257, '6.1(b)(x)'],
    [57259, 57264, '6.1(b)(xii)'],
    [57266, 57271, '6.1(b)(xiv)'],
    [57275, 57281, '6.1(b)(xvii)'],
    [57321, 57339, '6.1(b)(i)'],
    [57341, 57344, '6.1(b)(v)'],
    [57346, 57350, '6.1(b)(vi)'],
    [57352, 57357, '6.1(b)(vii)'],
    [57359, 57365, '6.1(b)(viii)'],
    [57367, 57370, '6.1(b)(x)'],
    [57372, 57377, '6.1(b)(xii)'],
    [57382, 57387, '6.1(b)(xiv)'],
  ]);

  const redHat = byDeal.get('redhat');
  const redHatReferences = redHat.index.annotations
    .filter((annotation) => annotation.annotation_kind === 'SECTION_REFERENCE'
      && annotation.span.start_byte >= 161921
      && annotation.span.start_byte <= 161945)
    .map((annotation) => [
      annotation.span.start_byte,
      annotation.span.end_byte,
      annotation.value,
    ]);
  assert.deepEqual(redHatReferences, [
    [161921, 161940, '5.03(a)(i)'],
    [161945, 161952, '5.03(a)(ii)'],
  ]);
  assert.deepEqual(redHat.index.annotations
    .filter((annotation) => annotation.value === 'Material Contracts'
      && [60790, 61008, 62174].includes(annotation.span.start_byte))
    .map((annotation) => [annotation.annotation_kind, annotation.span.start_byte]), [
    ['DEFINED_TERM_DEFINITION', 60790],
    ['DEFINED_TERM_USE', 61008],
    ['DEFINED_TERM_USE', 62174],
  ]);

  const definitionsByDeal = (entry) => new Set(entry.index.annotations
    .filter((annotation) => annotation.annotation_kind === 'DEFINED_TERM_DEFINITION')
    .map((annotation) => annotation.value));
  const allDefinedTermAnnotations = (entry, value) => entry.index.annotations
    .filter((annotation) => annotation.value === value
      && ['DEFINED_TERM_DEFINITION', 'DEFINED_TERM_USE'].includes(annotation.annotation_kind));
  const skechers = byDeal.get('skechers');
  const skechersDefinitions = definitionsByDeal(skechers);
  for (const term of ['Business Day', 'Processed', 'Processing', 'the date hereof']) {
    assert.ok(skechersDefinitions.has(term), `Skechers definition: ${term}`);
  }
  assert.deepEqual(allDefinedTermAnnotations(skechers, 'the date of this Agreement'), [],
    'a quoted right-hand gloss is not a local definition or use');
  const redHatDefinitions = definitionsByDeal(redHat);
  for (const term of ['Takeover Proposal', 'days', 'Material Contracts']) {
    assert.ok(redHatDefinitions.has(term), `Red Hat definition: ${term}`);
  }
  assert.equal(redHat.index.annotations.some((annotation) =>
    annotation.annotation_kind === 'DEFINED_TERM_DEFINITION'
    && annotation.value === 'calendar days'), false);
  const conchoDefinitions = definitionsByDeal(concho);
  for (const term of ['group', 'beneficial ownership', 'beneficially owning', 'Exchange Fund']) {
    assert.ok(conchoDefinitions.has(term), `Concho definition: ${term}`);
  }
  const modivDefinitions = definitionsByDeal(byDeal.get('modiv'));
  assert.ok(modivDefinitions.has('from'));
  assert.equal(modivDefinitions.has('from and including'), false);
  const topBuildDefinitions = definitionsByDeal(byDeal.get('topbuild'));
  assert.equal(topBuildDefinitions.has('toxic'), false);

  const conchoAnnex = uniqueNode(concho.index,
    (node) => node.node_kind === 'ANNEX' && node.reference === 'ANNEX A',
    'Concho ANNEX A');
  const materialAdverseEffect = uniqueNode(concho.index,
    (node) => node.node_kind === 'PARAGRAPH'
      && node.reference === 'Annex-A::Material Adverse Effect',
    'Concho Material Adverse Effect definition paragraph');
  const permittedEncumbrances = uniqueNode(concho.index,
    (node) => node.node_kind === 'PARAGRAPH'
      && node.reference === 'Annex-A::Permitted Encumbrances',
    'Concho Permitted Encumbrances definition paragraph');
  assert.equal(materialAdverseEffect.parent_node_occurrence_id, conchoAnnex.node_occurrence_id);
  assert.equal(permittedEncumbrances.parent_node_occurrence_id, conchoAnnex.node_occurrence_id);
  const maeChildren = childNodes(concho.index, materialAdverseEffect.node_occurrence_id);
  const permittedChildren = childNodes(concho.index, permittedEncumbrances.node_occurrence_id);
  assert.deepEqual(maeChildren.filter((node) => node.node_kind === 'LIMB').map((node) => [
    node.reference,
    node.extent_span.start_byte,
    node.extent_span.end_byte,
  ]), [
    ['Annex-A::Material Adverse Effect(a)', 325766, 325903],
    ['Annex-A::Material Adverse Effect(b)', 325903, 330452],
  ]);
  const maeB = uniqueNode(concho.index,
    (node) => node.reference === 'Annex-A::Material Adverse Effect(b)',
    'Concho Material Adverse Effect(b)');
  const maeBChildren = childNodes(concho.index, maeB.node_occurrence_id);
  assert.deepEqual(maeBChildren.filter((node) => node.node_kind === 'LIMB').map((node) => [
    node.reference,
    node.extent_span.start_byte,
    node.extent_span.end_byte,
  ]), [
    ['Annex-A::Material Adverse Effect(b)(i)', 326542, 326653],
    ['Annex-A::Material Adverse Effect(b)(ii)', 326653, 327068],
    ['Annex-A::Material Adverse Effect(b)(iii)', 327068, 327294],
    ['Annex-A::Material Adverse Effect(b)(iv)', 327294, 327613],
    ['Annex-A::Material Adverse Effect(b)(v)', 327613, 327816],
    ['Annex-A::Material Adverse Effect(b)(vi)', 327816, 328117],
    ['Annex-A::Material Adverse Effect(b)(vii)', 328117, 328387],
    ['Annex-A::Material Adverse Effect(b)(viii)', 328387, 328659],
    ['Annex-A::Material Adverse Effect(b)(ix)', 328659, 329356],
  ]);
  assert.deepEqual(maeBChildren.filter((node) => node.node_kind === 'QUALIFICATION').map((node) => [
    node.roles,
    node.extent_span.start_byte,
    node.extent_span.end_byte,
  ]), [[['AUTHORED_QUALIFICATION', 'TRAILING_QUALIFICATION'], 329356, 330447]]);
  const maeII = uniqueNode(concho.index,
    (node) => node.reference === 'Annex-A::Material Adverse Effect(b)(ii)',
    'Concho Material Adverse Effect(b)(ii)');
  assert.deepEqual(concho.index.nodes.filter((node) => node.node_kind === 'LIMB'
    && ['Annex-A::Material Adverse Effect(b)(ii)(A)',
      'Annex-A::Material Adverse Effect(b)(ii)(B)'].includes(node.reference))
  .map((node) => [node.reference, node.extent_span.start_byte, node.extent_span.end_byte,
    isDescendantOf(concho.index, node, maeII.node_occurrence_id)]), [
    ['Annex-A::Material Adverse Effect(b)(ii)(A)', 326799, 326899, true],
    ['Annex-A::Material Adverse Effect(b)(ii)(B)', 326899, 327068, true],
  ]);
  assert.deepEqual(permittedChildren.filter((node) => node.node_kind === 'LIMB').map((node) => [
    node.reference,
    node.extent_span.start_byte,
    node.extent_span.end_byte,
  ]), [
    ['Annex-A::Permitted Encumbrances(a)', 339812, 340224],
    ['Annex-A::Permitted Encumbrances(b)', 340224, 340759],
    ['Annex-A::Permitted Encumbrances(c)', 340759, 341063],
    ['Annex-A::Permitted Encumbrances(d)', 341063, 341903],
    ['Annex-A::Permitted Encumbrances(e)', 341903, 342203],
    ['Annex-A::Permitted Encumbrances(f)', 342203, 342774],
    ['Annex-A::Permitted Encumbrances(g)', 342774, 342941],
    ['Annex-A::Permitted Encumbrances(h)', 342941, 343112],
    ['Annex-A::Permitted Encumbrances(i)', 343112, 343879],
  ]);
  const permittedD = uniqueNode(concho.index,
    (node) => node.reference === 'Annex-A::Permitted Encumbrances(d)',
    'Concho Permitted Encumbrances(d)');
  assert.deepEqual(concho.index.nodes.filter((node) => node.node_kind === 'LIMB'
    && ['Annex-A::Permitted Encumbrances(d)(i)',
      'Annex-A::Permitted Encumbrances(d)(ii)'].includes(node.reference))
  .map((node) => [node.reference, node.extent_span.start_byte, node.extent_span.end_byte,
    isDescendantOf(concho.index, node, permittedD.node_occurrence_id)]), [
    ['Annex-A::Permitted Encumbrances(d)(i)', 341622, 341728, true],
    ['Annex-A::Permitted Encumbrances(d)(ii)', 341728, 341903, true],
  ]);

  assert.deepEqual(concho.index.nodes.filter((node) => node.node_kind === 'LIMB'
    && /^4\.3\(a\)\((?:i|ii|iii|iv)\)$/u.test(node.reference || ''))
  .map((node) => [node.reference, node.extent_span.start_byte, node.extent_span.end_byte]), [
    ['4.3(a)(i)', 49260, 49451],
    ['4.3(a)(ii)', 49451, 49567],
    ['4.3(a)(iii)', 49567, 49824],
    ['4.3(a)(iv)', 49824, 49943],
  ]);
  const concho419ix = uniqueNode(concho.index,
    (node) => node.reference === '4.19(a)(ix)', 'Concho 4.19(a)(ix)');
  const concho419x = uniqueNode(concho.index,
    (node) => node.reference === '4.19(a)(x)', 'Concho 4.19(a)(x)');
  assert.deepEqual([
    concho419ix.extent_span.start_byte,
    concho419ix.extent_span.end_byte,
    concho419x.extent_span.start_byte,
  ], [94210, 95198, 95198]);
  assert.deepEqual(concho.index.nodes.filter((node) => node.node_kind === 'LIMB'
    && ['4.19(a)(ix)(x)', '4.19(a)(ix)(y)'].includes(node.reference))
  .map((node) => [node.reference, node.extent_span.start_byte, node.extent_span.end_byte,
    isDescendantOf(concho.index, node, concho419ix.node_occurrence_id)]), [
    ['4.19(a)(ix)(x)', 94725, 94917, true],
    ['4.19(a)(ix)(y)', 94917, 95197, true],
  ]);
  const concho72aiii = uniqueNode(concho.index,
    (node) => node.reference === '7.2(a)(iii)', 'Concho 7.2(a)(iii)');
  assert.deepEqual(childNodes(concho.index, concho72aiii.node_occurrence_id, 'QUALIFICATION')
    .map((node) => [node.extent_span.start_byte, node.extent_span.end_byte]), [
    [268637, 268805],
    [268807, 269205],
  ]);

  const metsera = byDeal.get('metsera');
  assert.equal(uniqueNode(metsera.index,
    (node) => node.node_kind === 'LIMB'
      && node.reference === '3.03(iii)'
      && node.extent_span.start_byte === 47410,
    'Metsera 3.03(iii) after cited (i)/(ii)').extent_span.end_byte, 47898);
  assert.equal(uniqueNode(skechers.index,
    (node) => node.node_kind === 'LIMB'
      && node.reference === '8.3(f)(i)(D)'
      && node.extent_span.start_byte === 347085,
    'Skechers 8.3(f)(i)(D) after cited (A)/(B)/(C)').extent_span.end_byte, 347709);
  assert.equal(uniqueNode(byDeal.get('topbuild').index,
    (node) => node.node_kind === 'LIMB'
      && node.reference === '2.1(a)(i)(C)'
      && node.extent_span.start_byte === 16956,
    'TopBuild 2.1(a)(i)(C) after cited (A)/(B)').extent_span.end_byte, 17329);
  assert.ok(metsera.index.nodes.some((node) => node.node_kind === 'SENTENCE'
    && node.extent_span.start_byte <= 135769
    && node.extent_span.end_byte >= 135838),
  'multi-initial citations stay inside one authored sentence');
  assert.equal(metsera.index.nodes.some((node) => node.node_kind === 'SENTENCE'
    && node.extent_span.start_byte === 135817), false);

  function deepestNodeAt(index, byteOffset) {
    return index.nodes
      .filter((node) => node.extent_span.start_byte <= byteOffset
        && node.extent_span.end_byte > byteOffset)
      .sort((left, right) =>
        (left.extent_span.end_byte - left.extent_span.start_byte)
        - (right.extent_span.end_byte - right.extent_span.start_byte))[0];
  }
  const topBuild = byDeal.get('topbuild');
  assert.ok(['SENTENCE', 'PARAGRAPH', 'CHAPEAU', 'LIMB']
    .includes(deepestNodeAt(topBuild.index, 3700).node_kind),
    'agreement recitals have authored child blocks');
  assert.ok(!['AGREEMENT', 'ARTICLE'].includes(deepestNodeAt(metsera.index, 271183).node_kind),
    'article residual text has an authored child block');
});

test('M2 leaves the frozen baseline, projection and M0 controls byte-identical', () => {
  for (const [relativePath, expectedDigest] of Object.entries(FROZEN_DIGESTS)) {
    assert.equal(digestFile(relativePath), expectedDigest, relativePath);
  }

  const manifest = readJson(M0_MANIFEST_PATH);
  assert.equal(manifest.current_baseline_binding.sha256,
    FROZEN_DIGESTS[manifest.current_baseline_binding.path]);
  assert.equal(manifest.current_projection_binding.sha256,
    FROZEN_DIGESTS[manifest.current_projection_binding.path]);
  for (const binding of Object.values(manifest.control_bindings)) {
    assert.equal(digestFile(binding.path), binding.sha256, binding.path);
  }

  const m2Authority = readJson(M2_AUTHORITY_PATH);
  assert.equal(m2Authority.bindings.m0_control_manifest.sha256,
    FROZEN_DIGESTS['evidence/canonical-v2/stage-2y-structure-migration/control/manifest.json']);
  assert.equal(m2Authority.pin_changes, 0);
  assert.equal(m2Authority.baseline_changes, 0);
  assert.equal(m2Authority.current_selector_changes, 0);
  assert.equal(m2Authority.product_writes, 0);
  assert.equal(m2Authority.publication_authorisation, 'NONE');
  assert.equal(m2Authority.database_target, 'NONE');
  assert.equal(m2Authority.model_calls, 0);
});
