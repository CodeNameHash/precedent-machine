'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const {
  rebuildAdmittedSourcePrimitives,
} = require('../lib/canonical-v2/admitted-source-chain-rebuild');
const { contentId } = require('../lib/canonical-v2/canonical-bytes');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT_ROOT = path.join(
  ROOT,
  'evidence/canonical-v2/stage-2y-structure-migration/prototype/m1',
);
const RECEIPT_PATH = path.join(
  ROOT,
  'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m1-falsification-prototype.json',
);
const CONTROL_PATH = path.join(
  ROOT,
  'evidence/canonical-v2/stage-2y-structure-migration/control/manifest.json',
);
const INPUTS_PATH = path.join(
  ROOT,
  'evidence/canonical-v2/stage-2y-structure-migration/control/prototype-inputs.json',
);
const SOURCE_BUILDER_PATH = path.join(
  ROOT,
  'scripts/lib/stage-2y-structure-source-prototype.mjs',
);

const OUTPUT_SCHEMAS = Object.freeze({
  'agreement-index.json': 'STAGE_2Y_STRUCTURE_PROTOTYPE_INDEX/V1',
  'byte-ownership.json': 'STAGE_2Y_STRUCTURE_BYTE_OWNERSHIP/V1',
  'node-aliases.json': 'STAGE_2Y_STRUCTURE_NODE_ALIASES/V1',
  'structure-alternatives.json': 'STAGE_2Y_STRUCTURE_ALTERNATIVES/V1',
  'reference-edges.json': 'STAGE_2Y_STRUCTURE_REFERENCE_EDGES/V1',
  'context-facts.json': 'STAGE_2Y_STRUCTURE_CONTEXT_FACTS/V1',
  'current-semantic-mapping.json': 'STAGE_2Y_STRUCTURE_SEMANTIC_MAPPING/V1',
  'source-to-row-diff.json': 'STAGE_2Y_STRUCTURE_SOURCE_TO_ROW_DIFF/V1',
  'decision.json': 'STAGE_2Y_STRUCTURE_PROTOTYPE_DECISION/V1',
});

const CASES = Object.freeze([
  {
    case_id: 'CONCHO_6_9_A',
    set: 'DECISION',
    spans: [
      ['6.9(a)', 227465, 229033, '8d10318d287c3b727dfc7599c950e8cc81352ce410810ae2c152bcadec618ce0'],
    ],
  },
  {
    case_id: 'TOPBUILD_6_2',
    set: 'DECISION',
    spans: [
      ['6.2', 364374, 365781, 'fe532d42c8124c3d1ff204b551f8552b5a5cf07454dc16a8b327f33b88794b9a'],
    ],
  },
  {
    case_id: 'REDHAT_3_01_3_02',
    set: 'DECISION',
    spans: [
      ['3.01', 28259, 104301, 'b800cb57763e92bb3278cb5d424eeb221930b44c6bb079aa7096b68c7ec3de18'],
      ['3.02', 104301, 114463, 'c243913a3386580cf92f4346667ae8c6514854581371500dcaa25ce994d0df4c'],
    ],
  },
  {
    case_id: 'METSERA_7_04',
    set: 'DECISION',
    spans: [
      ['7.04', 225755, 226294, '1e9d4b4058e39e5d71714c4ae7c81b906e6a19c5f92d56a7dcee92fbcf677d50'],
    ],
  },
  {
    case_id: 'CONCHO_4_10_ANNEX_A',
    set: 'DECISION',
    spans: [
      ['4.10', 61706, 66746, '694e13cae9a8929e6cef0f544c9ca744106e8de961e17217113c4923b6ecad85'],
      ['Annex-A', 309662, 349102, '0a7105c9a500bfb5318e1279825b546547c704f6f06216907585c7cf4dea1eea'],
    ],
  },
  {
    case_id: 'TOPBUILD_6_3',
    set: 'CONFIRMATION',
    spans: [
      ['6.3', 365781, 367588, '4406f381343348f6ab2e63a47ef92f6b89a6f449d1edc5752c54b9aa7113cf57'],
    ],
  },
  {
    case_id: 'REDHAT_5_07',
    set: 'CONFIRMATION',
    spans: [
      ['5.07', 197134, 198597, '8b8b2fd65c59a2070cdd4abfe57360ae468e12588c20be923b4b88f8154345d4'],
    ],
  },
  {
    case_id: 'METSERA_9_03',
    set: 'CONFIRMATION',
    spans: [
      ['9.03', 240292, 257871, '55fa9c6e3a0d3077e11da3267e3e028af018b48c6d78a51fb8ae48731f7a384d'],
    ],
  },
  {
    case_id: 'CONCHO_6_11_6_16_6_20',
    set: 'CONFIRMATION',
    spans: [
      ['6.11', 242010, 243106, '7deaa4f5fe4318e50b19190ea6020e6fd24038c78714d6bb6b47b80cd6c7c47b'],
      ['6.16', 249376, 250715, '26edcdbe88bdc5be2ed9ce5d900848eb4200d47128ee67c93e57117771d7d794'],
      ['6.20', 263581, 263769, '56e1fe16c2a9e04765b0e12180cc621dbe4501bc569535c70bb9ea6c6407793e'],
    ],
  },
]);

const HEX_256 = /^[0-9a-f]{64}$/;
const cache = new Map();
const sourceCache = new Map();
const frozenInputs = JSON.parse(fs.readFileSync(INPUTS_PATH, 'utf8'));

const ANALYSIS_NODE_KINDS = new Set([
  'AMBIGUITY_CONTAINER',
  'CHAPEAU',
  'DEFINED_TERM',
  'LIMB',
  'QUALIFICATION',
  'REFERENCE_OCCURRENCE',
  'SENTENCE',
]);

const CONCHO_KNOWLEDGE_USE = Object.freeze({
  start_byte: 62777,
  end_byte: 62808,
  text_sha256: 'a97d6403da51745d11e82c427fc0da6c3c1e5b370be52207d9fbca861a5f9779',
  quote: 'to the knowledge of the Company',
});

const TOPBUILD_63_QUALIFICATION = Object.freeze({
  start_byte: 367372,
  end_byte: 367588,
  text_sha256: '152a7b8c5612fc2ca4fe8e016245f7422eba0519bd7955212daf629b1760e5fb',
});

const TOPBUILD_63_REFERENCES = Object.freeze([
  Object.freeze({
    start_byte: 366312,
    end_byte: 366329,
    raw_text: 'Section \u200e\u200e4.4',
    normalised_reference: '4.4',
    text_sha256: '96c93fad81a354f0131bc8d08a04a7abc8641a37802bf47fe8149ecde4179674',
    parent_reference: '6.3(a)',
  }),
  Object.freeze({
    start_byte: 367031,
    end_byte: 367052,
    raw_text: 'Sections \u200e5.3(a)(i)',
    normalised_reference: '5.3(a)(i)',
    text_sha256: 'a08491cfe1494ba0ecbe685b05a951693a6677232d5d1f7e5af7bd5c4c42f93c',
    parent_reference: '6.3(b)',
  }),
  Object.freeze({
    start_byte: 367056,
    end_byte: 367069,
    raw_text: '\u200e5.3(a)(ii)',
    normalised_reference: '5.3(a)(ii)',
    text_sha256: '929327b0e891e37b2dfbc59b5384035341d26aaa1b941cab14c4978ed8ef9467',
    parent_reference: '6.3(b)',
  }),
  Object.freeze({
    start_byte: 367568,
    end_byte: 367585,
    raw_text: 'Section \u200e6.4(b)',
    normalised_reference: '6.4(b)',
    text_sha256: 'd827317a5e6712df4a5ce65769ef1f8bc4bf15685352380fa8ea99f12a6ad468',
    parent_reference: 'QUALIFICATION',
  }),
]);

const TOPBUILD_63_CONTEXT_FACTS = Object.freeze([
  ['OBJECT', 'THIS_AGREEMENT', 'This Agreement', 365813, 365827,
    '62db433223b2514b2ee2c70377ca1f3e8e712bd12b4bb63127b0bc6fd17b134c'],
  ['MODAL', 'MAY', 'may', 365828, 365831,
    'ee4d988c65de860fabbfbcd27f73d50bbebe3fba37fe419284f4811389c30bdc'],
  ['GOVERNING_PREDICATE', 'BE_TERMINATED', 'be terminated', 365832, 365845,
    '78f10c7f8e5098b594d2f69087ebbc3542b960663ce4e888c3de25246dafb254'],
  ['OBJECT', 'MERGERS', 'the Mergers', 365850, 365861,
    '4521ff459ac9c72c7a9c5948ef78860c2565980094ccb6f6b3c34c5796256647'],
  ['MODAL', 'MAY', 'may', 365862, 365865,
    'ee4d988c65de860fabbfbcd27f73d50bbebe3fba37fe419284f4811389c30bdc'],
  ['GOVERNING_PREDICATE', 'BE_ABANDONED', 'be abandoned', 365866, 365878,
    '5fec3ba466db6583ac5e7d22690d50e6faa40277a51170aa43e388a0e94fa952'],
  ['TIME_SCOPE', 'PRIOR_TO_TITANIUM_MERGER_EFFECTIVE_TIME',
    'at any time prior to the Titanium Merger Effective Time', 365879, 365934,
    'eb5aaa0971b19ae6f0590fac208a388ed3f4d1aaa7148af76487ffd69148f1f6'],
  ['RIGHT_HOLDER', 'Company', 'the Company', 365938, 365949,
    '5f918f5d004e525a45432ead3686c97cc2f00a542b39914965063eb8a0cc2ddb'],
  ['LIST_CONNECTIVE', 'IF', 'if:', 365950, 365953,
    'b032a723e3fc9f0b16b3587f724094b795e720b0b33e21f4c2011b54135c105e'],
]);

const TOPBUILD_63_CURE_FACTS = Object.freeze([
  Object.freeze({
    parent_reference: '6.3(a)',
    start_byte: 366368,
    end_byte: 366607,
    text_sha256: '418d2062e70b0209199eb178e8eb5c6dd4c95097e40d0a249fc95c5bf44bcbb5',
    quote: 'such breach is not curable or, if curable is not cured prior to the earlier of (A) the fifth business day after written notice thereof is given by the Company to Parent and (B) the date that is three business days prior to the Outside Date',
  }),
  Object.freeze({
    parent_reference: '6.3(b)',
    start_byte: 367079,
    end_byte: 367370,
    text_sha256: 'e2ba1244e32886c5461dd9233910e4530708b241bde0666ab746259a61d43ed2',
    quote: 'such breach or inaccuracy or failure to be true is not curable by the Outside Date or, if capable of being cured by the Outside Date, shall not have been cured prior to the earlier of (x) thirty (30) days after written notice thereof is given by the Company to Parent or (y) the Outside Date',
  }),
]);

const EXPECTED_BASELINE_COHORT_RUNS = Object.freeze([
  'concho-employee-matters-20260809-2xk-final',
  'concho-key-defined-terms-20260809-2xk-final',
  'metsera-closing-conditions-20260809-2xk-final',
  'redhat-representations-20260809-2xk-final',
  'topbuild-termination-20260809-2xk-r3-final',
]);

const ANNEX_PAGE_MARKERS = Object.freeze([
  ['A-1', 313077, 313080],
  ['A-2', 316605, 316608],
  ['A-3', 320139, 320142],
  ['A-4', 323376, 323379],
  ['A-5', 327064, 327067],
  ['A-6', 330448, 330451],
  ['A-7', 334029, 334032],
  ['A-8', 337415, 337418],
  ['A-9', 340755, 340758],
  ['A-10', 344137, 344141],
  ['A-11', 347235, 347239],
  ['A-12', 349097, 349101],
]);

const REQUIRED_INHERITED_FACTS = Object.freeze({
  CONCHO_6_9_A: Object.freeze([
    ['TIME_SCOPE', 'UNTIL_DECEMBER_31_OF_EFFECTIVE_TIME_YEAR',
      'Until December 31 of the calendar year in which the Effective Time occurs'],
    ['ACTOR', 'Parent', 'Parent'],
    ['MODAL', 'SHALL', 'shall'],
    ['GOVERNING_PREDICATE', 'CAUSE', 'cause'],
    ['PREDICATE_COMPLEMENT', 'TO_BE_PROVIDED_WITH', 'to be provided with'],
    ['OBJECT', 'COMPANY_EMPLOYEE_BENEFICIARY',
      'each individual who is employed as of the Closing Date'],
  ]),
  TOPBUILD_6_2: Object.freeze([
    ['OBJECT', 'THIS_AGREEMENT', 'This Agreement'],
    ['MODAL', 'MAY', 'may'],
    ['GOVERNING_PREDICATE', 'BE_TERMINATED', 'be terminated'],
    ['TIME_SCOPE', 'PRIOR_TO_TITANIUM_MERGER_EFFECTIVE_TIME',
      'at any time prior to the Titanium Merger Effective Time'],
    ['RIGHT_HOLDER', Object.freeze(['Parent', 'Company']), 'either Parent or the Company'],
    ['LIST_CONNECTIVE', 'IF', 'if:'],
  ]),
});

const REQUIRED_METSERA_FACTS = Object.freeze([
  Object.freeze([
    ['ACTOR', Object.freeze(['Parent', 'Merger Sub']), 'Neither Parent nor Merger Sub'],
    ['MODAL', 'MAY', 'may'],
    ['NEGATION', true, 'Neither Parent nor Merger Sub'],
    ['GOVERNING_PREDICATE', 'RELY_ON', 'rely on'],
    ['CAUSATION_STANDARD', 'PRIMARILY_CAUSED', 'primarily caused'],
    ['BREACH_STANDARD', 'MATERIAL_BREACH', 'material breach'],
  ]),
  Object.freeze([
    ['ACTOR', 'Company', 'The Company'],
    ['MODAL', 'MAY', 'may'],
    ['NEGATION', true, 'not'],
    ['GOVERNING_PREDICATE', 'RELY_ON', 'rely on'],
    ['CAUSATION_STANDARD', 'PRIMARILY_CAUSED', 'primarily caused'],
    ['BREACH_STANDARD', 'MATERIAL_BREACH', 'material breach'],
  ]),
]);

function output(name) {
  if (!cache.has(name)) {
    cache.set(name, JSON.parse(fs.readFileSync(path.join(OUTPUT_ROOT, name), 'utf8')));
  }
  return cache.get(name);
}

function caseById(index, caseId) {
  const matches = index.cases.filter((entry) => entry.case_id === caseId);
  assert.equal(matches.length, 1, `${caseId} must occur exactly once`);
  return matches[0];
}

function nodesOf(index, caseId, nodeKind) {
  return caseById(index, caseId).nodes.filter((node) => node.node_kind === nodeKind);
}

function sha256(value) {
  return crypto.createHash('sha256').update(Buffer.from(value, 'utf8')).digest('hex');
}

function sha256Bytes(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function frozenCaseById(caseId) {
  const matches = frozenInputs.cases.filter((entry) => entry.case_id === caseId);
  assert.equal(matches.length, 1, `${caseId} frozen input`);
  return matches[0];
}

function canonicalBytes(caseId) {
  const specification = frozenCaseById(caseId);
  const cacheKey = specification.canonical_text_sha256;
  if (!sourceCache.has(cacheKey)) {
    const primitives = rebuildAdmittedSourcePrimitives({
      runDirectory: path.join(ROOT, 'evidence/canonical-v2', specification.run_directories[0]),
      repoRoot: ROOT,
    });
    const bytes = Buffer.from(primitives.conversion.canonical_text, 'utf8');
    assert.equal(bytes.length, specification.canonical_text_byte_length, `${caseId} canonical length`);
    assert.equal(sha256Bytes(bytes), specification.canonical_text_sha256, `${caseId} canonical digest`);
    assert.equal(
      primitives.immutable_source_document.immutable_source_document_id,
      specification.immutable_source_document_id,
      `${caseId} immutable source identity`,
    );
    sourceCache.set(cacheKey, bytes);
  }
  return sourceCache.get(cacheKey);
}

function canonicalQuote(caseId, span) {
  const bytes = canonicalBytes(caseId);
  assert.ok(Number.isSafeInteger(span.start_byte), `${caseId} start byte`);
  assert.ok(Number.isSafeInteger(span.end_byte), `${caseId} end byte`);
  assert.ok(span.start_byte >= 0 && span.end_byte > span.start_byte && span.end_byte <= bytes.length);
  return bytes.subarray(span.start_byte, span.end_byte).toString('utf8');
}

function nodeMap(index, caseId) {
  return new Map(caseById(index, caseId).nodes.map((node) => [node.node_occurrence_id, node]));
}

function childrenOf(index, caseId, parentId, nodeKind = null) {
  return caseById(index, caseId).nodes
    .filter((node) => node.parent_node_occurrence_id === parentId
      && (!nodeKind || node.node_kind === nodeKind))
    .sort((left, right) => left.child_ordinal - right.child_ordinal);
}

function rootForSpan(index, caseId, sectionReference) {
  const entry = caseById(index, caseId);
  const selectedIndex = entry.selected_spans.findIndex((span) =>
    span.section_reference === sectionReference);
  assert.notEqual(selectedIndex, -1, `${caseId}:${sectionReference} selected span`);
  const root = nodeMap(index, caseId).get(entry.root_node_occurrence_ids[selectedIndex]);
  assert.ok(root, `${caseId}:${sectionReference} root`);
  return root;
}

function isDescendantOf(byId, node, ancestorId) {
  const visited = new Set();
  let cursor = node;
  while (cursor?.parent_node_occurrence_id) {
    assert.equal(visited.has(cursor.node_occurrence_id), false, `${node.node_occurrence_id} cycle`);
    visited.add(cursor.node_occurrence_id);
    if (cursor.parent_node_occurrence_id === ancestorId) return true;
    cursor = byId.get(cursor.parent_node_occurrence_id);
  }
  return false;
}

function spansOverlap(left, right) {
  return left.start_byte < right.end_byte && right.start_byte < left.end_byte;
}

function valuesEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function entryLeafOwnerIds(entry) {
  return entry.nodes
    .filter((node) => ['SOURCE_TEXT', 'SOURCE_ARTEFACT'].includes(node.node_kind)
      && node.owned_spans.length === 1
      && node.child_node_occurrence_ids.length === 0)
    .map((node) => node.node_occurrence_id);
}

function assertCanonicalSpan(caseId, span, quote = null) {
  const canonical = canonicalQuote(caseId, span);
  if (quote !== null) assert.equal(quote, canonical, `${caseId} canonical quote`);
  assert.equal(
    span.text_sha256,
    sha256Bytes(canonicalBytes(caseId).subarray(span.start_byte, span.end_byte)),
    `${caseId} canonical span digest`,
  );
}

function decisionRuns(mapping) {
  return mapping.cases
    .filter((entry) => entry.set === 'DECISION')
    .flatMap((entry) => entry.runs.map((run) => ({ case_id: entry.case_id, run })));
}

test('the sealed M1 directory contains exactly the nine required schemas', () => {
  const names = fs.readdirSync(OUTPUT_ROOT).filter((name) => name.endsWith('.json')).sort();
  assert.deepEqual(names, Object.keys(OUTPUT_SCHEMAS).sort());
  for (const [name, schema] of Object.entries(OUTPUT_SCHEMAS)) {
    assert.equal(output(name).schema_version, schema, `${name} schema`);
  }
});

test('the source index binds the exact nine frozen cases and thirteen selected spans', () => {
  const index = output('agreement-index.json');
  assert.equal(index.case_count, 9);
  assert.deepEqual(index.cases.map((entry) => entry.case_id), CASES.map((entry) => entry.case_id));
  assert.equal(index.cases.flatMap((entry) => entry.selected_spans).length, 13);

  for (const expected of CASES) {
    const actual = caseById(index, expected.case_id);
    const frozen = frozenCaseById(expected.case_id);
    assert.equal(actual.set, expected.set);
    assert.equal(actual.canonical_text_sha256, frozen.canonical_text_sha256);
    assert.equal(actual.canonical_text_byte_length, frozen.canonical_text_byte_length);
    assert.equal(actual.source_path, frozen.source_path);
    assert.equal(actual.raw_source_sha256, frozen.raw_source_sha256);
    assert.equal(actual.raw_source_byte_length, frozen.raw_source_byte_length);
    assert.deepEqual(
      actual.selected_spans.map((span) => [
        span.section_reference,
        span.start,
        span.end,
        span.text_sha256,
      ]),
      expected.spans,
    );
    for (const span of actual.selected_spans) {
      assert.equal(span.end - span.start, span.byte_length);
      assert.equal(
        sha256Bytes(canonicalBytes(expected.case_id).subarray(span.start, span.end)),
        span.text_sha256,
      );
    }
    assert.equal(actual.node_count, actual.nodes.length);
    assert.equal(new Set(actual.nodes.map((node) => node.node_occurrence_id)).size, actual.nodes.length);
    const ids = new Set(actual.nodes.map((node) => node.node_occurrence_id));
    for (const node of actual.nodes) {
      assert.match(node.node_occurrence_id, HEX_256);
      assert.match(node.structure_revision_id, HEX_256);
      if (node.parent_node_occurrence_id) assert.ok(ids.has(node.parent_node_occurrence_id));
    }
  }

  const aliases = output('node-aliases.json');
  assert.equal(aliases.alias_count, aliases.aliases.length);
  assert.deepEqual(aliases.collisions, []);
  assert.equal(new Set(aliases.aliases.map((alias) =>
    `${alias.case_id}\0${alias.current_node_id}`)).size, aliases.aliases.length);
  assert.equal(new Set(aliases.aliases.map((alias) =>
    `${alias.case_id}\0${alias.shadow_node_occurrence_id}`)).size, aliases.aliases.length);
  for (const alias of aliases.aliases) {
    assert.match(alias.current_node_id, HEX_256);
    assert.match(alias.shadow_node_occurrence_id, HEX_256);
    assert.match(alias.shadow_structure_revision_id, HEX_256);
  }
});

test('the source builder fails closed on a missing or wrong M0 prototype-input binding', async () => {
  const { buildSourcePrototype } = await import(pathToFileURL(SOURCE_BUILDER_PATH).href);
  const control = JSON.parse(fs.readFileSync(CONTROL_PATH, 'utf8'));
  const inputs = JSON.parse(fs.readFileSync(INPUTS_PATH, 'utf8'));

  const missingBinding = structuredClone(control);
  delete missingBinding.control_bindings['prototype-inputs.json'];
  assert.throws(
    () => buildSourcePrototype({ repoRoot: ROOT, control: missingBinding, inputs }),
    (error) => error?.code === 'INPUT_BINDING_REQUIRED',
  );

  const wrongBinding = structuredClone(control);
  wrongBinding.control_bindings['prototype-inputs.json'].sha256 = '0'.repeat(64);
  assert.throws(
    () => buildSourcePrototype({ repoRoot: ROOT, control: wrongBinding, inputs }),
    (error) => error?.code === 'INPUT_BINDING_MISMATCH',
  );
});

test('every node has a contained parent, an acyclic path, and exact child links and ordinals', () => {
  const index = output('agreement-index.json');
  for (const expected of CASES) {
    const entry = caseById(index, expected.case_id);
    const byId = nodeMap(index, expected.case_id);
    const rootIds = new Set(entry.root_node_occurrence_ids);
    assert.equal(rootIds.size, expected.spans.length);

    for (const [spanIndex, rootId] of entry.root_node_occurrence_ids.entries()) {
      const root = byId.get(rootId);
      const [, start, end, digest] = expected.spans[spanIndex];
      assert.ok(root);
      assert.equal(root.parent_node_occurrence_id, null);
      assert.equal(root.extent_span.start_byte, start);
      assert.equal(root.extent_span.end_byte, end);
      assert.equal(root.extent_span.text_sha256, digest);
    }
    assert.deepEqual(
      entry.nodes.filter((node) => node.parent_node_occurrence_id === null)
        .map((node) => node.node_occurrence_id).sort(),
      [...rootIds].sort(),
    );

    for (const node of entry.nodes) {
      assertCanonicalSpan(expected.case_id, node.extent_span);
      const children = childrenOf(index, expected.case_id, node.node_occurrence_id);
      assert.deepEqual(children.map((child) => child.child_ordinal),
        children.map((_, ordinal) => ordinal));
      assert.deepEqual(node.child_node_occurrence_ids,
        children.map((child) => child.node_occurrence_id));
      for (let childIndex = 1; childIndex < children.length; childIndex += 1) {
        assert.ok(
          children[childIndex - 1].extent_span.start_byte
            <= children[childIndex].extent_span.start_byte,
          `${expected.case_id}:${node.node_occurrence_id} child source order`,
        );
      }

      if (!rootIds.has(node.node_occurrence_id)) {
        const parent = byId.get(node.parent_node_occurrence_id);
        assert.ok(parent, `${expected.case_id}:${node.node_occurrence_id} parent`);
        assert.ok(parent.extent_span.start_byte <= node.extent_span.start_byte);
        assert.ok(parent.extent_span.end_byte >= node.extent_span.end_byte);
      }

      const visited = new Set([node.node_occurrence_id]);
      let cursor = node;
      while (cursor.parent_node_occurrence_id) {
        assert.equal(visited.has(cursor.parent_node_occurrence_id), false,
          `${expected.case_id}:${node.node_occurrence_id} acyclic`);
        visited.add(cursor.parent_node_occurrence_id);
        cursor = byId.get(cursor.parent_node_occurrence_id);
        assert.ok(cursor);
      }
      assert.ok(rootIds.has(cursor.node_occurrence_id));
    }
  }
});

test('every selected byte has exactly one leaf or artefact owner', () => {
  const index = output('agreement-index.json');
  const ownership = output('byte-ownership.json');
  assert.equal(ownership.case_count, 9);
  assert.equal(ownership.complete, true);
  assert.deepEqual(ownership.cases.map((entry) => entry.case_id), CASES.map((entry) => entry.case_id));
  assert.equal(ownership.cases.flatMap((entry) => entry.spans).length, 13);

  for (const expectedCase of CASES) {
    const actualCase = ownership.cases.find((entry) => entry.case_id === expectedCase.case_id);
    const byId = nodeMap(index, expectedCase.case_id);
    const ownerNodeIds = new Set();
    assert.ok(actualCase);
    assert.equal(actualCase.complete, true);
    assert.equal(actualCase.spans.length, expectedCase.spans.length);
    actualCase.spans.forEach((span, index) => {
      const [, start, end, digest] = expectedCase.spans[index];
      assert.deepEqual(span.gaps, []);
      assert.deepEqual(span.overlaps, []);
      assert.equal(span.complete, true);
      assert.equal(span.selected_span.start_byte, start);
      assert.equal(span.selected_span.end_byte, end);
      assert.equal(span.selected_span.text_sha256, digest);
      assert.equal(span.selected_byte_count, end - start);
      assert.equal(span.exactly_once_byte_count, end - start);
      assert.ok(span.owners.length > 0);
      assert.ok(span.owners.every((owner) =>
        owner.owner_kind === 'SOURCE_TEXT' || owner.owner_kind === 'SOURCE_ARTEFACT'));
      assert.equal(span.owners[0].start_byte, start);
      assert.equal(span.owners.at(-1).end_byte, end);
      const canonical = canonicalBytes(expectedCase.case_id);
      for (let ownerIndex = 1; ownerIndex < span.owners.length; ownerIndex += 1) {
        assert.equal(span.owners[ownerIndex - 1].end_byte, span.owners[ownerIndex].start_byte);
      }
      for (const owner of span.owners) {
        assert.equal(ownerNodeIds.has(owner.owner_node_occurrence_id), false,
          `${expectedCase.case_id} duplicate byte owner`);
        ownerNodeIds.add(owner.owner_node_occurrence_id);
        const ownerNode = byId.get(owner.owner_node_occurrence_id);
        assert.ok(ownerNode, `${expectedCase.case_id} owner node`);
        assert.equal(ownerNode.node_kind, owner.owner_kind);
        assert.equal(ownerNode.child_node_occurrence_ids.length, 0);
        assert.deepEqual(ownerNode.extent_span, {
          coordinate_system: 'UTF8_CANONICAL_TEXT_HALF_OPEN',
          start_byte: owner.start_byte,
          end_byte: owner.end_byte,
          text_sha256: owner.text_sha256,
        });
        assert.deepEqual(ownerNode.owned_spans, [ownerNode.extent_span]);
        assert.equal(owner.text_sha256,
          sha256Bytes(canonical.subarray(owner.start_byte, owner.end_byte)));
      }
    });
    assert.deepEqual(
      entryLeafOwnerIds(caseById(index, expectedCase.case_id)).sort(),
      [...ownerNodeIds].sort(),
    );
  }
});

test('Concho Annex page labels A-1 through A-12 are typed source artefacts', () => {
  const index = output('agreement-index.json');
  const ownership = output('byte-ownership.json');
  const entry = caseById(index, 'CONCHO_4_10_ANNEX_A');
  const annex = entry.selected_spans.find((span) => span.section_reference === 'Annex-A');
  const ownershipCase = ownership.cases.find((candidate) =>
    candidate.case_id === 'CONCHO_4_10_ANNEX_A');
  const ownershipSpan = ownershipCase.spans.find((span) =>
    span.section_reference === 'Annex-A');
  const artefactNodes = entry.nodes.filter((node) => node.node_kind === 'SOURCE_ARTEFACT');

  for (const [label, start, end] of ANNEX_PAGE_MARKERS) {
    assert.ok(start >= annex.start && end <= annex.end);
    assert.equal(canonicalQuote('CONCHO_4_10_ANNEX_A', {
      start_byte: start,
      end_byte: end,
    }), label);
    const digest = sha256(label);
    const nodes = artefactNodes.filter((node) =>
      node.extent_span.start_byte === start && node.extent_span.end_byte === end);
    assert.equal(nodes.length, 1, `${label} artefact node`);
    assert.equal(nodes[0].extent_span.text_sha256, digest);
    const owners = ownershipSpan.owners.filter((owner) =>
      owner.start_byte === start && owner.end_byte === end);
    assert.equal(owners.length, 1, `${label} artefact owner`);
    assert.equal(owners[0].owner_kind, 'SOURCE_ARTEFACT');
    assert.equal(owners[0].owner_node_occurrence_id, nodes[0].node_occurrence_id);
    assert.equal(owners[0].text_sha256, digest);
  }
});

test('the five decision cases expose the written source blocks and unresolved Red Hat alternative', () => {
  const index = output('agreement-index.json');
  assert.equal(nodesOf(index, 'CONCHO_6_9_A', 'CHAPEAU').length, 1);
  assert.equal(nodesOf(index, 'CONCHO_6_9_A', 'LIMB').length, 4);
  assert.equal(nodesOf(index, 'CONCHO_6_9_A', 'QUALIFICATION').length, 2);
  assert.equal(nodesOf(index, 'TOPBUILD_6_2', 'CHAPEAU').length, 1);
  assert.equal(nodesOf(index, 'TOPBUILD_6_2', 'LIMB').length, 4);
  assert.equal(nodesOf(index, 'TOPBUILD_6_2', 'QUALIFICATION').length, 2);
  assert.equal(nodesOf(index, 'REDHAT_3_01_3_02', 'SENTENCE').length, 3);
  assert.equal(nodesOf(index, 'METSERA_7_04', 'SENTENCE').length, 2);

  const alternatives = output('structure-alternatives.json');
  const redHat = alternatives.alternatives.filter((entry) => entry.case_id === 'REDHAT_3_01_3_02');
  assert.equal(redHat.length, 1);
  assert.equal(redHat[0].status, 'REQUIRES_BEN_LEGAL_JUDGEMENT');
  assert.equal(redHat[0].selected_alternative, null);
  assert.equal(redHat[0].alternatives.length, 2);
  assert.match(redHat[0].alternative_group_id, HEX_256);

  const byId = nodeMap(index, 'REDHAT_3_01_3_02');
  const subject = byId.get(redHat[0].subject_node_occurrence_id);
  const neutralParent = byId.get(subject?.parent_node_occurrence_id);
  assert.ok(subject);
  assert.equal(subject.node_kind, 'LIMB');
  assert.ok(subject.roles.includes('PARENTAGE_AMBIGUOUS'));
  assert.ok(neutralParent);
  assert.equal(neutralParent.node_kind, 'AMBIGUITY_CONTAINER');
  assert.ok(neutralParent.roles.includes('UNRESOLVED_PARENT'));
  assert.equal(neutralParent.parse_status, 'AMBIGUOUS');
  const candidateParentIds = new Set(redHat[0].alternatives.map((entry) =>
    entry.parent_node_occurrence_id));
  assert.equal(candidateParentIds.has(subject.parent_node_occurrence_id), false);
  assert.equal(candidateParentIds.has(neutralParent.node_occurrence_id), false);
  assert.ok(candidateParentIds.has(neutralParent.parent_node_occurrence_id));
});

test('Red Hat keeps markers, headings, ambiguous limbs, and bare sentences as separate nodes', () => {
  const index = output('agreement-index.json');
  const entry = caseById(index, 'REDHAT_3_01_3_02');
  const h = entry.nodes.find((node) => node.node_kind === 'LIMB' && node.reference === '3.01(h)');
  const hMarkers = childrenOf(index, entry.case_id, h.node_occurrence_id, 'MARKER');
  const hHeadings = childrenOf(index, entry.case_id, h.node_occurrence_id, 'HEADING');
  assert.equal(hMarkers.length, 1);
  assert.equal(hHeadings.length, 1);
  assert.equal(hMarkers[0].extent_span.end_byte, hHeadings[0].extent_span.start_byte);
  assert.equal(spansOverlap(hMarkers[0].extent_span, hHeadings[0].extent_span), false);

  const authorityLimb = entry.nodes.find((node) =>
    node.node_kind === 'LIMB' && node.reference === '3.02(b)(i)');
  const authorityMarkers = childrenOf(
    index,
    entry.case_id,
    authorityLimb.node_occurrence_id,
    'MARKER',
  );
  const authoritySentences = childrenOf(
    index,
    entry.case_id,
    authorityLimb.node_occurrence_id,
    'SENTENCE',
  );
  assert.equal(authorityMarkers.length, 1);
  assert.equal(authoritySentences.length, 3);
  assert.ok(authoritySentences.every((sentence) =>
    sentence.roles.includes('UNNUMBERED_CHILD_BLOCK')));
  assert.ok(authoritySentences[0].extent_span.start_byte >= authorityMarkers[0].extent_span.end_byte);
  for (let indexValue = 1; indexValue < authoritySentences.length; indexValue += 1) {
    assert.ok(authoritySentences[indexValue - 1].extent_span.end_byte
      <= authoritySentences[indexValue].extent_span.start_byte);
  }

  const markerIds = new Set(nodesOf(index, entry.case_id, 'MARKER')
    .map((node) => node.node_occurrence_id));
  const headingIds = new Set(nodesOf(index, entry.case_id, 'HEADING')
    .map((node) => node.node_occurrence_id));
  const sentenceIds = new Set(nodesOf(index, entry.case_id, 'SENTENCE')
    .map((node) => node.node_occurrence_id));
  assert.equal([...markerIds].some((id) => headingIds.has(id) || sentenceIds.has(id)), false);
  assert.equal([...headingIds].some((id) => sentenceIds.has(id)), false);
});

test('each of the thirteen frozen spans has authored analysis structure', () => {
  const index = output('agreement-index.json');
  for (const expected of CASES) {
    const entry = caseById(index, expected.case_id);
    const byId = nodeMap(index, expected.case_id);
    for (const [sectionReference, start, end] of expected.spans) {
      const root = rootForSpan(index, expected.case_id, sectionReference);
      const authored = entry.nodes.filter((node) =>
        ANALYSIS_NODE_KINDS.has(node.node_kind)
        && node.extent_span.start_byte >= start
        && node.extent_span.end_byte <= end
        && isDescendantOf(byId, node, root.node_occurrence_id));
      assert.ok(authored.length > 0,
        `${expected.case_id}:${sectionReference} has no authored analysis node`);
    }
  }
});

test('the confirmation structures have the exact fixed-case shape', () => {
  const index = output('agreement-index.json');

  const topbuildRoot = rootForSpan(index, 'TOPBUILD_6_3', '6.3');
  assert.equal(childrenOf(index, 'TOPBUILD_6_3', topbuildRoot.node_occurrence_id, 'CHAPEAU').length, 1);
  const topbuildLimbs = childrenOf(index, 'TOPBUILD_6_3', topbuildRoot.node_occurrence_id, 'LIMB');
  assert.equal(topbuildLimbs.length, 2);
  assert.deepEqual(topbuildLimbs.map((node) => node.reference), ['6.3(a)', '6.3(b)']);
  const topbuildQualifications = childrenOf(
    index,
    'TOPBUILD_6_3',
    topbuildLimbs[1].node_occurrence_id,
    'QUALIFICATION',
  );
  assert.equal(topbuildQualifications.length, 1);
  assert.equal(childrenOf(
    index,
    'TOPBUILD_6_3',
    topbuildLimbs[0].node_occurrence_id,
    'QUALIFICATION',
  ).length, 0);
  assert.equal(topbuildQualifications[0].extent_span.start_byte,
    TOPBUILD_63_QUALIFICATION.start_byte);
  assert.equal(topbuildQualifications[0].extent_span.end_byte,
    TOPBUILD_63_QUALIFICATION.end_byte);
  assert.equal(topbuildQualifications[0].extent_span.text_sha256,
    TOPBUILD_63_QUALIFICATION.text_sha256);
  assertCanonicalSpan('TOPBUILD_6_3', topbuildQualifications[0].extent_span);

  const redHatRoot = rootForSpan(index, 'REDHAT_5_07', '5.07');
  const redHatSentences = childrenOf(index, 'REDHAT_5_07', redHatRoot.node_occurrence_id, 'SENTENCE');
  assert.equal(redHatSentences.length, 2);
  assert.ok(redHatSentences.every((node) => node.roles.includes('UNNUMBERED_CHILD_BLOCK')));
  const redHatHeadings = childrenOf(index, 'REDHAT_5_07', redHatRoot.node_occurrence_id, 'HEADING');
  assert.equal(redHatHeadings.length, 1);
  assert.ok(redHatSentences.every((sentence) =>
    !spansOverlap(sentence.extent_span, redHatHeadings[0].extent_span)));

  for (const [sectionReference, expectedCount] of [['6.11', 2], ['6.16', 3], ['6.20', 1]]) {
    const root = rootForSpan(index, 'CONCHO_6_11_6_16_6_20', sectionReference);
    const sentences = childrenOf(
      index,
      'CONCHO_6_11_6_16_6_20',
      root.node_occurrence_id,
      'SENTENCE',
    );
    assert.equal(sentences.length, expectedCount, `Concho ${sectionReference} sentence count`);
    assert.ok(sentences.every((node) => node.roles.includes('UNNUMBERED_CHILD_BLOCK')));
  }

  const metseraRoot = rootForSpan(index, 'METSERA_9_03', '9.03');
  const metseraReferences = childrenOf(
    index,
    'METSERA_9_03',
    metseraRoot.node_occurrence_id,
    'REFERENCE_OCCURRENCE',
  );
  assert.equal(nodesOf(index, 'METSERA_9_03', 'REFERENCE_OCCURRENCE').length, 2);
  assert.equal(metseraReferences.length, 2);
  assert.equal(nodesOf(index, 'METSERA_9_03', 'SENTENCE').length, 0);
});

test('TopBuild 6.3 preserves all four reference occurrences under their deepest source parent', () => {
  const index = output('agreement-index.json');
  const references = output('reference-edges.json');
  const nodes = nodesOf(index, 'TOPBUILD_6_3', 'REFERENCE_OCCURRENCE')
    .sort((left, right) => left.extent_span.start_byte - right.extent_span.start_byte);
  const edges = references.edges.filter((edge) =>
    edge.case_id === 'TOPBUILD_6_3' && edge.edge_type === 'SECTION_REFERENCE')
    .sort((left, right) => left.source_occurrence.start_byte - right.source_occurrence.start_byte);
  const limbs = new Map(nodesOf(index, 'TOPBUILD_6_3', 'LIMB')
    .map((node) => [node.reference, node]));
  const qualifications = nodesOf(index, 'TOPBUILD_6_3', 'QUALIFICATION');
  assert.equal(nodes.length, 4);
  assert.equal(edges.length, 4);
  assert.equal(qualifications.length, 1);

  for (const [referenceIndex, expected] of TOPBUILD_63_REFERENCES.entries()) {
    const node = nodes[referenceIndex];
    const edge = edges[referenceIndex];
    const expectedParent = expected.parent_reference === 'QUALIFICATION'
      ? qualifications[0]
      : limbs.get(expected.parent_reference);
    assert.ok(expectedParent);
    assert.equal(node.reference, expected.normalised_reference);
    assert.ok(node.roles.includes('CROSS_REFERENCE'));
    assert.equal(node.extent_span.start_byte, expected.start_byte);
    assert.equal(node.extent_span.end_byte, expected.end_byte);
    assert.equal(node.extent_span.text_sha256, expected.text_sha256);
    assert.equal(node.parent_node_occurrence_id, expectedParent.node_occurrence_id);
    assert.equal(canonicalQuote('TOPBUILD_6_3', node.extent_span), expected.raw_text);

    assert.equal(edge.source_node_id, node.node_occurrence_id);
    assert.equal(edge.source_occurrence.start_byte, expected.start_byte);
    assert.equal(edge.source_occurrence.end_byte, expected.end_byte);
    assert.equal(edge.source_occurrence.raw_text, expected.raw_text);
    assert.equal(edge.source_occurrence.normalised_reference, expected.normalised_reference);
    assert.equal(edge.source_occurrence.text_sha256, expected.text_sha256);
    assert.equal(edge.source_occurrence.quote_sha256, expected.text_sha256);
    assert.equal(edge.resolution_status, 'UNRESOLVED');
    assert.deepEqual(edge.target_node_ids, []);
    assert.equal(edge.selected_target_node_id, null);
  }
});

test('every fact is bound to canonical bytes, its governing node, and the same scope support', () => {
  const index = output('agreement-index.json');
  const context = output('context-facts.json');
  const scopes = new Map(context.scope_edges.map((edge) => [edge.scope_edge_id, edge]));
  const inherited = context.facts.filter((fact) => fact.status === 'INHERITED');
  assert.ok(inherited.length > 0);
  assert.equal(context.fact_count, context.facts.length);
  assert.equal(context.inherited_fact_count, inherited.length);
  assert.equal(context.scope_edge_count, context.scope_edges.length);

  for (const fact of context.facts) {
    assert.match(fact.context_fact_id, HEX_256);
    assert.equal(fact.source_span.coordinate_system, 'UTF8_CANONICAL_TEXT_HALF_OPEN');
    assert.ok(Number.isSafeInteger(fact.source_span.start_byte));
    assert.ok(fact.source_span.end_byte > fact.source_span.start_byte);
    assert.equal(Buffer.byteLength(fact.source_span.quote, 'utf8'),
      fact.source_span.end_byte - fact.source_span.start_byte);
    assert.equal(sha256(fact.source_span.quote), fact.source_span.text_sha256);
    assert.equal(fact.quote_sha256, fact.source_span.text_sha256);
    assertCanonicalSpan(fact.case_id, fact.source_span, fact.source_span.quote);
    assert.equal(fact.confidence, 'DETERMINISTIC_SOURCE_PROOF');
    assert.equal(fact.resolution_status, 'RESOLVED');
    assert.deepEqual(fact.uncertainty, { status: 'NONE', reason_codes: [], alternatives: [] });

    const nodes = caseById(index, fact.case_id).nodes;
    const source = nodes.find((node) => node.node_occurrence_id === fact.governing_source_node_id);
    const target = nodes.find((node) => node.node_occurrence_id === fact.target_node_id);
    assert.ok(source, `${fact.context_fact_id} governing node`);
    assert.ok(target, `${fact.context_fact_id} target node`);
    assert.ok(source.extent_span.start_byte <= fact.source_span.start_byte);
    assert.ok(source.extent_span.end_byte >= fact.source_span.end_byte);

    const artefacts = nodes.filter((node) => node.node_kind === 'SOURCE_ARTEFACT');
    assert.equal(artefacts.some((node) => spansOverlap(node.extent_span, fact.source_span)), false,
      `${fact.context_fact_id} overlaps a source artefact`);

    const scope = scopes.get(fact.scope_edge_id);
    assert.ok(scope, `${fact.context_fact_id} scope edge`);
    assert.equal(scope.source_node_id, fact.governing_source_node_id);
    assert.ok(scope.target_node_ids.includes(fact.target_node_id));
    assert.deepEqual(scope.support, {
      start_byte: fact.source_span.start_byte,
      end_byte: fact.source_span.end_byte,
      text_sha256: fact.source_span.text_sha256,
    });
    assert.deepEqual(fact.relationship_path,
      [fact.governing_source_node_id, scope.edge_type, fact.target_node_id]);

    if (fact.status === 'INHERITED') {
      assert.notEqual(fact.governing_source_node_id, fact.target_node_id);
      const falselyLocal = target.extent_span.start_byte <= fact.source_span.start_byte
        && target.extent_span.end_byte >= fact.source_span.end_byte;
      if (!['QUALIFICATION_TEXT', 'EXCEPTION_TEXT'].includes(fact.fact_type)) {
        assert.equal(falselyLocal, false, `${fact.fact_type} must remain anchored outside its child`);
      }
    } else {
      assert.equal(fact.status, 'DIRECT');
      assert.equal(fact.governing_source_node_id, fact.target_node_id);
    }
  }
});

test('Concho and TopBuild contain every required direct and inherited governing fact', () => {
  const index = output('agreement-index.json');
  const context = output('context-facts.json');
  for (const [caseId, matrix] of Object.entries(REQUIRED_INHERITED_FACTS)) {
    const facts = context.facts.filter((fact) => fact.case_id === caseId);
    const chapeaux = nodesOf(index, caseId, 'CHAPEAU');
    const limbs = nodesOf(index, caseId, 'LIMB')
      .filter((node) => node.parent_node_occurrence_id === chapeaux[0]?.parent_node_occurrence_id)
      .map((node) => node.node_occurrence_id)
      .sort();
    assert.equal(chapeaux.length, 1, `${caseId} chapeau`);
    assert.equal(limbs.length, 4, `${caseId} direct limbs`);

    for (const [factType, expectedValue, quote] of matrix) {
      const typed = facts.filter((fact) => fact.fact_type === factType);
      assert.equal(typed.length, 5, `${caseId}:${factType} matrix size`);
      const direct = typed.filter((fact) => fact.status === 'DIRECT');
      const inherited = typed.filter((fact) => fact.status === 'INHERITED');
      assert.equal(direct.length, 1, `${caseId}:${factType} direct fact`);
      assert.equal(inherited.length, 4, `${caseId}:${factType} inherited facts`);
      assert.equal(direct[0].target_node_id, chapeaux[0].node_occurrence_id);
      assert.equal(direct[0].governing_source_node_id, chapeaux[0].node_occurrence_id);
      assert.equal(valuesEqual(direct[0].value, expectedValue), true);
      assert.equal(direct[0].source_span.quote, quote);
      assert.deepEqual(inherited.map((fact) => fact.target_node_id).sort(), limbs);
      for (const fact of inherited) {
        assert.equal(fact.governing_source_node_id, chapeaux[0].node_occurrence_id);
        assert.equal(valuesEqual(fact.value, expectedValue), true);
        assert.equal(fact.source_span.quote, quote);
        assert.deepEqual(fact.source_span, direct[0].source_span);
      }
    }
  }

  const conchoFacts = context.facts.filter((fact) => fact.case_id === 'CONCHO_6_9_A');
  const predicate = conchoFacts.find((fact) => fact.status === 'DIRECT'
    && fact.fact_type === 'GOVERNING_PREDICATE');
  const complement = conchoFacts.find((fact) => fact.status === 'DIRECT'
    && fact.fact_type === 'PREDICATE_COMPLEMENT');
  assert.notEqual(predicate.context_fact_id, complement.context_fact_id);
  assert.notEqual(predicate.source_span.start_byte, complement.source_span.start_byte);
  assert.equal(conchoFacts.some((fact) => fact.value === 'CAUSE_TO_BE_PROVIDED_WITH'), false);
});

test('TopBuild 6.3 keeps both coordinated predicates, both modal occurrences, and both cure facts', () => {
  const index = output('agreement-index.json');
  const context = output('context-facts.json');
  const facts = context.facts.filter((fact) => fact.case_id === 'TOPBUILD_6_3');
  const root = rootForSpan(index, 'TOPBUILD_6_3', '6.3');
  const chapeau = childrenOf(index, 'TOPBUILD_6_3', root.node_occurrence_id, 'CHAPEAU')[0];
  const limbs = childrenOf(index, 'TOPBUILD_6_3', root.node_occurrence_id, 'LIMB');
  const limbIds = limbs.map((node) => node.node_occurrence_id).sort();
  assert.ok(chapeau);
  assert.equal(limbs.length, 2);

  const requiredTypes = new Set(TOPBUILD_63_CONTEXT_FACTS.map(([factType]) => factType));
  const governingFacts = facts.filter((fact) => requiredTypes.has(fact.fact_type)
    && fact.governing_source_node_id === chapeau.node_occurrence_id);
  assert.equal(governingFacts.length, TOPBUILD_63_CONTEXT_FACTS.length * 3);

  for (const [factType, expectedValue, quote, start, end, digest] of TOPBUILD_63_CONTEXT_FACTS) {
    const matches = governingFacts.filter((fact) => fact.fact_type === factType
      && valuesEqual(fact.value, expectedValue)
      && fact.source_span.start_byte === start
      && fact.source_span.end_byte === end);
    const direct = matches.filter((fact) => fact.status === 'DIRECT');
    const inherited = matches.filter((fact) => fact.status === 'INHERITED');
    assert.equal(matches.length, 3, `${factType}:${expectedValue}:${start}`);
    assert.equal(direct.length, 1);
    assert.equal(inherited.length, 2);
    assert.equal(direct[0].target_node_id, chapeau.node_occurrence_id);
    assert.equal(direct[0].source_span.quote, quote);
    assert.equal(direct[0].source_span.text_sha256, digest);
    assert.deepEqual(inherited.map((fact) => fact.target_node_id).sort(), limbIds);
    assert.ok(inherited.every((fact) => fact.source_span.quote === quote
      && fact.source_span.text_sha256 === digest));
  }

  const modalDirect = governingFacts.filter((fact) =>
    fact.fact_type === 'MODAL' && fact.status === 'DIRECT');
  assert.deepEqual(modalDirect.map((fact) => [
    fact.source_span.start_byte,
    fact.source_span.end_byte,
  ]).sort((left, right) => left[0] - right[0]), [
    [365828, 365831],
    [365862, 365865],
  ]);

  const cureFacts = facts.filter((fact) => fact.fact_type === 'CURE_CONDITION');
  assert.equal(cureFacts.length, 2);
  for (const expected of TOPBUILD_63_CURE_FACTS) {
    const limb = limbs.find((node) => node.reference === expected.parent_reference);
    const matches = cureFacts.filter((fact) => fact.target_node_id === limb.node_occurrence_id);
    assert.equal(matches.length, 1, `${expected.parent_reference} cure fact`);
    const fact = matches[0];
    assert.equal(fact.status, 'DIRECT');
    assert.equal(fact.governing_source_node_id, limb.node_occurrence_id);
    assert.equal(fact.value, expected.quote);
    assert.equal(fact.source_span.quote, expected.quote);
    assert.equal(fact.source_span.start_byte, expected.start_byte);
    assert.equal(fact.source_span.end_byte, expected.end_byte);
    assert.equal(fact.source_span.text_sha256, expected.text_sha256);
  }
});

test('each Metsera reciprocal sentence contains the complete direct fact matrix', () => {
  const index = output('agreement-index.json');
  const context = output('context-facts.json');
  const sentences = nodesOf(index, 'METSERA_7_04', 'SENTENCE')
    .sort((left, right) => left.extent_span.start_byte - right.extent_span.start_byte);
  const facts = context.facts.filter((fact) => fact.case_id === 'METSERA_7_04');
  assert.equal(sentences.length, 2);
  assert.equal(facts.length, 12);
  assert.equal(facts.some((fact) => fact.status === 'INHERITED'), false);

  for (const [sentenceIndex, matrix] of REQUIRED_METSERA_FACTS.entries()) {
    const sentence = sentences[sentenceIndex];
    const sentenceFacts = facts.filter((fact) => fact.target_node_id === sentence.node_occurrence_id);
    assert.equal(sentenceFacts.length, matrix.length);
    for (const [factType, expectedValue, quote] of matrix) {
      const matches = sentenceFacts.filter((fact) => fact.fact_type === factType);
      assert.equal(matches.length, 1, `METSERA_7_04 sentence ${sentenceIndex + 1}:${factType}`);
      const fact = matches[0];
      assert.equal(fact.status, 'DIRECT');
      assert.equal(fact.governing_source_node_id, sentence.node_occurrence_id);
      assert.equal(valuesEqual(fact.value, expectedValue), true);
      assert.equal(fact.source_span.quote, quote);
    }
  }
});

test('local qualifications never propagate to a sibling limb', () => {
  const index = output('agreement-index.json');
  const context = output('context-facts.json');
  for (const [caseId, expectedQualificationCount] of [
    ['CONCHO_6_9_A', 2],
    ['TOPBUILD_6_2', 2],
    ['TOPBUILD_6_3', 1],
  ]) {
    const nodes = caseById(index, caseId).nodes;
    const byId = new Map(nodes.map((node) => [node.node_occurrence_id, node]));
    const qualifications = nodes.filter((node) => node.node_kind === 'QUALIFICATION');
    const limbIds = new Set(nodes.filter((node) => node.node_kind === 'LIMB')
      .map((node) => node.node_occurrence_id));
    assert.equal(qualifications.length, expectedQualificationCount);
    for (const qualification of qualifications) {
      assert.ok(limbIds.has(qualification.parent_node_occurrence_id));
      const edges = context.scope_edges.filter((edge) => edge.case_id === caseId
        && edge.source_node_id === qualification.node_occurrence_id);
      assert.ok(edges.length > 0);
      assert.ok(edges.every((edge) => ['QUALIFIES', 'EXCEPTS'].includes(edge.edge_type)));
      const targets = new Set(edges.flatMap((edge) => edge.target_node_ids));
      assert.deepEqual([...targets], [qualification.parent_node_occurrence_id]);
      const qualificationFacts = context.facts.filter((fact) => fact.case_id === caseId
        && fact.governing_source_node_id === qualification.node_occurrence_id);
      assert.ok(qualificationFacts.length > 0);
      assert.ok(qualificationFacts.every((fact) =>
        fact.target_node_id === qualification.parent_node_occurrence_id));
      assert.ok(qualificationFacts.every((fact) => byId.has(fact.target_node_id)));
    }
  }
});

test('reference edges preserve four Metsera occurrences and the Concho definition link', () => {
  const index = output('agreement-index.json');
  const references = output('reference-edges.json');
  const metsera = references.edges.filter((edge) =>
    edge.case_id === 'METSERA_7_04' && edge.edge_type === 'SECTION_REFERENCE')
    .sort((left, right) => left.source_occurrence.start_byte - right.source_occurrence.start_byte);
  assert.equal(metsera.length, 4);
  assert.equal(new Set(metsera.map((edge) => edge.reference_edge_id)).size, 4);
  assert.deepEqual(metsera.map((edge) => [
    edge.source_occurrence.start_byte,
    edge.source_occurrence.end_byte,
    edge.source_occurrence.raw_text,
    edge.source_occurrence.normalised_reference,
  ]), [
    [225888, 225900, 'Section 7.01', '7.01'],
    [225904, 225916, 'Section 7.02', '7.02'],
    [226136, 226148, 'Section 7.01', '7.01'],
    [226152, 226164, 'Section 7.03', '7.03'],
  ]);
  const metseraNodes = new Map(caseById(index, 'METSERA_7_04').nodes
    .map((node) => [node.node_occurrence_id, node]));
  const metseraSentences = nodesOf(index, 'METSERA_7_04', 'SENTENCE')
    .sort((left, right) => left.extent_span.start_byte - right.extent_span.start_byte);
  for (const [edgeIndex, edge] of metsera.entries()) {
    assert.equal(sha256(edge.source_occurrence.raw_text), edge.source_occurrence.quote_sha256);
    assert.equal(edge.source_occurrence.text_sha256, edge.source_occurrence.quote_sha256);
    const occurrenceNode = metseraNodes.get(edge.source_node_id);
    assert.equal(occurrenceNode?.node_kind, 'REFERENCE_OCCURRENCE');
    assert.equal(occurrenceNode.parent_node_occurrence_id,
      metseraSentences[edgeIndex < 2 ? 0 : 1].node_occurrence_id);
  }

  const definition = references.edges.filter((edge) =>
    edge.case_id === 'CONCHO_4_10_ANNEX_A' && edge.edge_type === 'USES_DEFINITION');
  assert.equal(definition.length, 1);
  assert.equal(definition[0].resolution_status, 'RESOLVED');
  assert.equal(definition[0].source_occurrence.start_byte, CONCHO_KNOWLEDGE_USE.start_byte);
  assert.equal(definition[0].source_occurrence.end_byte, CONCHO_KNOWLEDGE_USE.end_byte);
  assert.equal(definition[0].source_occurrence.raw_text, CONCHO_KNOWLEDGE_USE.quote);
  assert.equal(definition[0].source_occurrence.text_sha256, CONCHO_KNOWLEDGE_USE.text_sha256);
  assert.equal(definition[0].source_occurrence.quote_sha256, CONCHO_KNOWLEDGE_USE.text_sha256);
  assert.equal(definition[0].source_occurrence.normalised_reference, 'knowledge');
  assert.equal(definition[0].target_node_ids.length, 1);
  assert.equal(definition[0].selected_target_node_id, definition[0].target_node_ids[0]);
  const conchoNodes = new Map(caseById(index, 'CONCHO_4_10_ANNEX_A').nodes
    .map((node) => [node.node_occurrence_id, node]));
  assert.equal(conchoNodes.get(definition[0].source_node_id)?.node_kind, 'REFERENCE_OCCURRENCE');
  assert.equal(conchoNodes.get(definition[0].selected_target_node_id)?.node_kind, 'DEFINED_TERM');

  assert.equal(references.edge_count, references.edges.length);
  for (const edge of references.edges) {
    assert.match(edge.reference_edge_id, HEX_256);
    assert.equal(edge.source_occurrence.coordinate_system, 'UTF8_CANONICAL_TEXT_HALF_OPEN');
    assertCanonicalSpan(edge.case_id, edge.source_occurrence, edge.source_occurrence.raw_text);
    assert.equal(edge.source_occurrence.quote_sha256, edge.source_occurrence.text_sha256);
    const nodes = caseById(index, edge.case_id).nodes;
    const sourceNode = nodes.find((node) => node.node_occurrence_id === edge.source_node_id);
    assert.ok(sourceNode, `${edge.reference_edge_id} source node`);
    assert.ok(sourceNode.extent_span.start_byte <= edge.source_occurrence.start_byte);
    assert.ok(sourceNode.extent_span.end_byte >= edge.source_occurrence.end_byte);
    const artefacts = nodes.filter((node) => node.node_kind === 'SOURCE_ARTEFACT');
    assert.equal(artefacts.some((node) =>
      spansOverlap(node.extent_span, edge.source_occurrence)), false,
    `${edge.reference_edge_id} overlaps a source artefact`);
  }
});

test('context and reference ledgers bind all decision and confirmation cases exactly once', () => {
  const context = output('context-facts.json');
  const references = output('reference-edges.json');
  const expectedLedgers = CASES.map((entry) => ({ case_id: entry.case_id, set: entry.set }));
  assert.deepEqual(context.cases.map((entry) => ({ case_id: entry.case_id, set: entry.set })),
    expectedLedgers);
  assert.deepEqual(references.cases.map((entry) => ({ case_id: entry.case_id, set: entry.set })),
    expectedLedgers);

  for (const expected of CASES) {
    const factLedger = context.cases.filter((entry) => entry.case_id === expected.case_id);
    const referenceLedger = references.cases.filter((entry) => entry.case_id === expected.case_id);
    assert.equal(factLedger.length, 1);
    assert.equal(referenceLedger.length, 1);
    assert.deepEqual(
      factLedger[0].fact_ids,
      context.facts.filter((fact) => fact.case_id === expected.case_id)
        .map((fact) => fact.context_fact_id).sort(),
    );
    assert.deepEqual(
      factLedger[0].scope_edge_ids,
      context.scope_edges.filter((edge) => edge.case_id === expected.case_id)
        .map((edge) => edge.scope_edge_id).sort(),
    );
    assert.deepEqual(
      referenceLedger[0].reference_edge_ids,
      references.edges.filter((edge) => edge.case_id === expected.case_id)
        .map((edge) => edge.reference_edge_id).sort(),
    );
  }

  const metseraFacts = context.facts.filter((fact) => fact.case_id === 'METSERA_9_03');
  const metseraReferences = references.edges.filter((edge) => edge.case_id === 'METSERA_9_03');
  assert.deepEqual(metseraFacts, []);
  assert.equal(metseraReferences.length, 2);
  assert.ok(metseraReferences.every((edge) => edge.edge_type === 'SECTION_REFERENCE'));
});

test('semantic records and evidence spans have complete two-way coverage and digests', () => {
  const mapping = output('current-semantic-mapping.json');
  const index = output('agreement-index.json');
  const aliases = output('node-aliases.json');
  const summary = mapping.summary;
  assert.equal(summary.case_count, 9);
  assert.equal(summary.decision_case_count, 5);
  assert.equal(summary.confirmation_metadata_case_count, 4);
  assert.ok(summary.semantic_record_count > 0);
  assert.equal(summary.expected_selected_current_record_count, summary.mapped_selected_current_record_count);
  assert.equal(summary.missing_current_record_count, 0);
  assert.equal(summary.unexpected_mapped_record_count, 0);
  assert.equal(summary.identity_mismatch_count, 0);
  assert.equal(summary.state_mismatch_count, 0);
  assert.equal(summary.value_mismatch_count, 0);
  assert.equal(summary.unexpected_state_changes, 0);
  assert.equal(summary.unexpected_value_changes, 0);
  assert.ok(summary.evidence_span_count > 0);
  assert.equal(summary.evidence_spans_without_source_node_links, 0);
  assert.match(summary.expected_current_records_digest, HEX_256);
  assert.match(summary.mapped_current_records_digest, HEX_256);
  assert.match(summary.evidence_span_coverage_digest, HEX_256);
  assert.equal(summary.current_claim_record_count,
    summary.expected_selected_current_record_count);
  assert.equal(summary.current_claim_records_without_evidence, 0);
  assert.equal(summary.current_claim_records_without_source_node_links, 0);
  assert.equal(summary.current_claim_records_without_alias_paths, 0);
  assert.match(summary.claim_source_mapping_digest, HEX_256);
  assert.equal(summary.selected_decision_run_count, 7);
  assert.equal(summary.selected_baseline_cohort_run_count, 5);
  assert.deepEqual(summary.selected_baseline_cohort_run_directories,
    EXPECTED_BASELINE_COHORT_RUNS);

  const runs = decisionRuns(mapping);
  assert.equal(runs.length, 7);
  assert.deepEqual(runs.map((entry) => [entry.case_id, entry.run.run_directory]),
    frozenInputs.cases.filter((entry) => entry.set === 'DECISION')
      .flatMap((entry) => entry.run_directories.map((runDirectory) =>
        [entry.case_id, runDirectory])));
  const cohortRuns = runs.filter((entry) => entry.run.frozen_cohort_member)
    .map((entry) => entry.run.run_directory).sort();
  assert.deepEqual(cohortRuns, EXPECTED_BASELINE_COHORT_RUNS);
  assert.ok(cohortRuns.includes('concho-key-defined-terms-20260809-2xk-final'));
  assert.equal(runs.reduce((sum, entry) => sum + entry.run.records.length, 0),
    summary.semantic_record_count);
  assert.equal(runs.reduce((sum, entry) =>
    sum + entry.run.current_record_coverage.expected_record_count, 0),
  summary.expected_selected_current_record_count);
  assert.equal(runs.reduce((sum, entry) =>
    sum + entry.run.evidence_coverage.evidence_span_count, 0), summary.evidence_span_count);

  for (const { case_id: caseId, run } of runs) {
    const recordCoverage = run.current_record_coverage;
    assert.equal(recordCoverage.expected_record_count, recordCoverage.mapped_record_count, caseId);
    assert.equal(recordCoverage.missing_record_count, 0, caseId);
    assert.equal(recordCoverage.unexpected_record_count, 0, caseId);
    assert.equal(recordCoverage.identity_mismatch_count, 0, caseId);
    assert.equal(recordCoverage.state_mismatch_count, 0, caseId);
    assert.equal(recordCoverage.value_mismatch_count, 0, caseId);
    assert.deepEqual(recordCoverage.missing_linkage_keys, [], caseId);
    assert.deepEqual(recordCoverage.unexpected_linkage_keys, [], caseId);
    assert.deepEqual(recordCoverage.identity_mismatches, [], caseId);
    assert.deepEqual(recordCoverage.state_mismatches, [], caseId);
    assert.deepEqual(recordCoverage.value_mismatches, [], caseId);
    assert.equal(recordCoverage.expected_record_count,
      recordCoverage.expected_records.length, caseId);
    assert.equal(recordCoverage.mapped_record_count,
      recordCoverage.mapped_records.length, caseId);
    assert.equal(recordCoverage.expected_records_digest,
      contentId('STAGE_2Y_EXPECTED_CURRENT_RECORD_SET/V1', recordCoverage.expected_records),
      caseId);
    assert.equal(recordCoverage.mapped_records_digest,
      contentId('STAGE_2Y_MAPPED_CURRENT_RECORD_SET/V1', recordCoverage.mapped_records),
      caseId);
    assert.equal(run.evidence_coverage.evidence_spans_without_source_node_links, 0, caseId);
    assert.deepEqual(run.evidence_coverage.unlinked_evidence_spans, [], caseId);
    assert.equal(run.evidence_coverage.evidence_span_count,
      run.evidence_coverage.evidence_spans.length, caseId);
    assert.equal(run.evidence_coverage.evidence_span_set_digest,
      contentId('STAGE_2Y_MAPPED_EVIDENCE_SPAN_SET/V1',
        run.evidence_coverage.evidence_spans), caseId);

    const sourceCase = caseById(index, caseId);
    const nodes = new Map(sourceCase.nodes.map((node) =>
      [node.node_occurrence_id, node]));
    const caseAliases = aliases.aliases.filter((alias) => alias.case_id === caseId);
    const claimRecords = run.records.filter((record) => !record.adapter_residual);
    const claimCoverage = run.claim_source_coverage;
    assert.equal(claimCoverage.current_claim_record_count, claimRecords.length, caseId);
    assert.equal(claimCoverage.current_claim_records_without_evidence, 0, caseId);
    assert.equal(claimCoverage.current_claim_records_without_source_node_links, 0, caseId);
    assert.equal(claimCoverage.current_claim_records_without_alias_paths, 0, caseId);
    for (const record of claimRecords) {
      const sourceMapping = record.claim_source_mapping;
      assert.ok(sourceMapping.evidence_count > 0, `${caseId}:${record.linkage_key}`);
      assert.ok(sourceMapping.source_node_occurrence_ids.length > 0,
        `${caseId}:${record.linkage_key}`);
      assert.equal(sourceMapping.evidence_without_source_node_links, 0,
        `${caseId}:${record.linkage_key}`);
      assert.equal(sourceMapping.evidence_without_alias_paths, 0,
        `${caseId}:${record.linkage_key}`);
      assert.ok(sourceMapping.alias_paths.length > 0, `${caseId}:${record.linkage_key}`);
      for (const sourceNodeId of sourceMapping.source_node_occurrence_ids) {
        assert.ok(nodes.has(sourceNodeId), `${caseId}:${sourceNodeId}`);
      }
      for (const evidence of sourceMapping.alias_paths) {
        assert.equal(evidence.source_links_valid, true);
        const deepest = nodes.get(evidence.deepest_source_node_occurrence_id);
        assert.ok(deepest, `${caseId}:${evidence.deepest_source_node_occurrence_id}`);
        assert.ok(deepest.extent_span.start_byte <= evidence.document_span.start);
        assert.ok(deepest.extent_span.end_byte >= evidence.document_span.end);
        for (const containingId of evidence.containing_source_node_occurrence_ids) {
          if (containingId === evidence.deepest_source_node_occurrence_id) continue;
          let cursor = nodes.get(containingId);
          const visited = new Set();
          while (cursor?.parent_node_occurrence_id) {
            assert.equal(visited.has(cursor.node_occurrence_id), false,
              `${caseId}:${cursor.node_occurrence_id} cycle`);
            visited.add(cursor.node_occurrence_id);
            assert.notEqual(cursor.parent_node_occurrence_id,
              evidence.deepest_source_node_occurrence_id,
              `${caseId}:${evidence.deepest_source_node_occurrence_id} is not deepest`);
            cursor = nodes.get(cursor.parent_node_occurrence_id);
          }
        }
        const path = evidence.alias_path;
        const alias = caseAliases.find((candidate) =>
          candidate.current_node_id === path.current_node_id
            && candidate.shadow_node_occurrence_id === path.shadow_node_occurrence_id);
        assert.ok(alias, `${caseId}:${path.current_node_id}`);
        assert.equal(alias.cardinality, 'ONE_TO_ONE');
        assert.equal(alias.shadow_structure_revision_id, path.shadow_structure_revision_id);
        assert.equal(alias.basis, path.alias_basis);
        assert.equal(path.mapping_basis, 'SAME_CANONICAL_UTF8_SPAN_CONTAINMENT');
        const target = nodes.get(path.shadow_node_occurrence_id);
        assert.ok(target);
        assert.equal(target.structure_revision_id, path.shadow_structure_revision_id);
        assert.ok(target.current_section_ids.includes(path.current_node_id));
        assert.ok(target.extent_span.start_byte <= evidence.document_span.start);
        assert.ok(target.extent_span.end_byte >= evidence.document_span.end);
      }
    }
    const claimPayload = claimRecords.map((record) => ({
      semantic_record_id: record.semantic_record_id,
      linkage_key: record.linkage_key,
      current_state: record.current_state,
      claim_source_mapping: record.claim_source_mapping,
    }));
    assert.equal(claimCoverage.claim_source_mapping_digest,
      contentId('STAGE_2Y_CURRENT_CLAIM_SOURCE_MAPPING_SET/V1', claimPayload), caseId);

    const rows = run.frozen_row_comparison;
    assert.equal(rows.expected_frozen_row_count, rows.expected_frozen_rows.length, caseId);
    assert.equal(rows.mapped_current_row_count, rows.mapped_current_rows.length, caseId);
    assert.equal(rows.expected_frozen_rows_digest,
      contentId('STAGE_2Y_EXPECTED_FROZEN_ROW_SET/V1', rows.expected_frozen_rows), caseId);
    assert.equal(rows.mapped_current_rows_digest,
      contentId('STAGE_2Y_MAPPED_CURRENT_ROW_SET/V1', rows.mapped_current_rows), caseId);
  }
  assert.equal(summary.claim_source_mapping_digest, contentId(
    'STAGE_2Y_CURRENT_CLAIM_SOURCE_MAPPING_COVERAGE/V1',
    runs.map(({ case_id: caseId, run }) => ({
      case_id: caseId,
      run_directory: run.run_directory,
      digest: run.claim_source_coverage.claim_source_mapping_digest,
    })),
  ));
});

test('the frozen row ledger has full coverage in both directions with no changed row', () => {
  const mapping = output('current-semantic-mapping.json');
  const diff = output('source-to-row-diff.json');
  const summary = diff.summary;
  assert.equal(summary.record_count, diff.records.length);
  assert.equal(summary.record_count, mapping.summary.semantic_record_count);
  assert.ok(summary.expected_frozen_row_count > 0);
  assert.equal(summary.mapped_current_row_count, summary.expected_frozen_row_count);
  assert.equal(summary.unchanged_frozen_row_count, summary.expected_frozen_row_count);
  assert.equal(summary.changed_row_signature_count, 0);
  assert.equal(summary.missing_frozen_row_count, 0);
  assert.equal(summary.new_row_count, 0);
  assert.equal(summary.old_rows_changed, 0);
  assert.equal(summary.material_resolved_information_loss_case_count, 2);
  assert.deepEqual(
    diff.decision_case_findings
      .filter((entry) => entry.material_resolved_information_loss?.qualifies === true)
      .map((entry) => entry.case_id),
    ['TOPBUILD_6_2', 'METSERA_7_04'],
  );
  assert.match(summary.expected_frozen_rows_digest, HEX_256);
  assert.match(summary.mapped_current_rows_digest, HEX_256);

  const semanticByKey = new Map(decisionRuns(mapping).flatMap(({ case_id: caseId, run }) =>
    run.records.map((record) => [
      `${caseId}\0${run.run_directory}\0${record.semantic_record_id}`,
      record,
    ])));
  for (const diffRecord of diff.records) {
    const semanticRecord = semanticByKey.get(
      `${diffRecord.case_id}\0${diffRecord.run_directory}\0${diffRecord.semantic_record_id}`,
    );
    assert.ok(semanticRecord);
    assert.deepEqual(diffRecord.source_node_occurrence_ids,
      semanticRecord.adapter_residual
        ? [] : semanticRecord.claim_source_mapping.source_node_occurrence_ids);
  }

  for (const { case_id: caseId, run } of decisionRuns(mapping)) {
    const rows = run.frozen_row_comparison;
    assert.match(rows.expected_frozen_rows_digest, HEX_256);
    assert.match(rows.mapped_current_rows_digest, HEX_256);
    assert.equal(rows.changed_signature_count, 0, caseId);
    assert.equal(rows.missing_frozen_row_count, 0, caseId);
    assert.equal(rows.new_row_count, 0, caseId);
    assert.deepEqual(rows.differences, [], caseId);
    if (run.frozen_cohort_member) {
      assert.equal(rows.status, 'UNCHANGED', caseId);
      assert.equal(rows.mapped_current_row_count, rows.expected_frozen_row_count, caseId);
      assert.equal(rows.unchanged_row_count, rows.expected_frozen_row_count, caseId);
    } else {
      assert.equal(rows.status, 'NOT_IN_FROZEN_COHORT', caseId);
      assert.equal(rows.expected_frozen_row_count, 0, caseId);
      assert.equal(rows.mapped_current_row_count, 0, caseId);
    }
  }
});

test('the decision requires restructuring and Ben review without authorising M2 or publication', () => {
  const decision = output('decision.json');
  assert.equal(decision.stage, 'M1');
  assert.equal(decision.proposed_decision, 'INCREMENTAL_RESTRUCTURE');
  assert.ok(Object.values(decision.acceptance).every((value) => value === true));
  assert.equal(decision.legal_review.status, 'REQUIRED_BEN_LEGAL_JUDGEMENT');
  assert.equal(decision.legal_review.m2_blocking, false);
  assert.equal(decision.legal_review.required_before,
    'PARENTAGE_SELECTION_OR_LEGAL_SCOPE_CHANGE');
  assert.equal(decision.acceptance.all_current_claims_map_to_source_nodes, true);
  assert.equal(decision.acceptance.aliases_preserve_current_claim_links, true);
  assert.match(decision.assessments.byte_ownership.proof_digest, HEX_256);
  assert.match(decision.assessments.inherited_context.proof_digest, HEX_256);
  assert.equal(decision.m2_authorised, false);
  assert.equal(decision.publication_authorisation, 'NONE');
});

test('the sealed outputs record zero M1 authority violations', () => {
  const contextAuthority = output('context-facts.json').authority;
  const referenceAuthority = output('reference-edges.json').authority;
  const semanticAuthority = output('current-semantic-mapping.json').authority;

  for (const authority of [contextAuthority, referenceAuthority, semanticAuthority]) {
    assert.ok(authority);
    for (const field of [
      'model_calls',
      'phase_b_route_calls',
      'product_writes',
      'pin_changes',
      'baseline_changes',
      'saved_control_mutations',
      'release_receipts_created',
      'current_selector_changes',
      'serving_changes',
    ]) {
      if (Object.hasOwn(authority, field)) assert.equal(authority[field], 0, field);
    }
    if (Object.hasOwn(authority, 'publication_authorisation')) {
      assert.equal(authority.publication_authorisation, 'NONE');
    }
    if (Object.hasOwn(authority, 'database_target')) assert.equal(authority.database_target, 'NONE');
    if (Object.hasOwn(authority, 'internal_cutover_authorisation')) {
      assert.equal(authority.internal_cutover_authorisation, 'NONE');
    }
  }
  assert.equal(output('decision.json').m2_authorised, false);
  assert.equal(output('decision.json').publication_authorisation, 'NONE');

  const receipt = JSON.parse(fs.readFileSync(RECEIPT_PATH, 'utf8'));
  assert.equal(receipt.schema_version, 'STAGE_2Y_STRUCTURE_MIGRATION_PACKET_RECEIPT/V1');
  assert.equal(receipt.stage, 'M1');
  for (const field of [
    'model_calls',
    'phase_b_route_calls',
    'product_writes',
    'pin_changes',
    'baseline_changes',
    'saved_control_mutations',
    'release_receipts_created',
    'current_selector_changes',
    'serving_changes',
  ]) assert.equal(receipt[field], 0, field);
  assert.equal(receipt.database_target, 'NONE');
  assert.equal(receipt.internal_cutover_authorisation, 'NONE');
  assert.equal(receipt.publication_authorisation, 'NONE');
  assert.ok(['STOPPED', 'PASS'].includes(receipt.status));
});
