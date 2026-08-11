'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { canonicalJson, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { compileContext } = require('../lib/canonical-v2/context-compilation');

const ROOT = path.resolve(__dirname, '..');
const MIGRATION_ROOT = path.join(
  ROOT,
  'evidence/canonical-v2/stage-2y-structure-migration',
);
const INDEX_PATH = path.join(
  MIGRATION_ROOT,
  'shadow/m2/3888fa7618bbd9fd6530b657aaa18c7e85ff515acf80edb1fc78a190af86e9cb.agreement-index.json',
);
const CONCHO_INDEX_PATH = path.join(
  MIGRATION_ROOT,
  'shadow/m2/1d6bba9ac993f72340d048742f995eb515a50cdfadb9bc86b3f36847baed9116.agreement-index.json',
);
const POLICY_PATH = path.join(MIGRATION_ROOT, 'control/semantic-policy.json');

const COORDINATE_SYSTEM = 'UTF8_CANONICAL_TEXT_HALF_OPEN';
const HEX_256 = /^[0-9a-f]{64}$/;
const INDEX_SHA256 = 'e8f03463e792220b421bf8ccae1cb9a55e8e05a41396c60512cf63ae50b031af';
const AGREEMENT_INDEX_ID = 'e5ca967c6d1af76f53fdd6bb0c402aef416272f7757fcdbaa11d3e8968d0c29a';
const CANONICAL_TEXT_SHA256 = '7dfbb5bb90fa7034462e42496e9a5068fa2fa6ac55ba69f977cf7108378e7f5d';
const STRUCTURAL_POLICY_DIGEST = '39c2972a1cd0e30989b6acd21bce120ca818d834f98a446abfa729f662cdac4c';
const CHAPEAU_ID = '8807b25eb5ce3da6a2a6d0f014f5930becc74921e722316337b60e76fc283096';
const SHARED_PARENT_ID = 'aba8638fecd2e57e5b079313e56379fbe8727764830af1b011c37525cbad28dd';
const CONCHO_FOREIGN_LIMB_ID = 'b9a0bed2036cd00ea79ec1e0bdbace046c744c0c68b0418cf41a5edd599da31a';
const RULE_ID = 'TOPBUILD_6_2_CHAPEAU_FLOW';

const CHAPEAU_SPAN = Object.freeze({
  coordinate_system: COORDINATE_SYSTEM,
  start_byte: 364423,
  end_byte: 364547,
  text_sha256: 'a48f2e266c0e917d58e697dd37a9add4b75cffecac2a8fafb5f193ddd63def22',
});
const CONNECTIVE_SPAN = Object.freeze({
  coordinate_system: COORDINATE_SYSTEM,
  start_byte: 364544,
  end_byte: 364546,
  text_sha256: '935f68319d4f227e02bfd54a0ddf85b8a242e42a4277aa5ef5eaab691710924e',
});
const FACTS = Object.freeze([
  Object.freeze({
    role: 'ACTOR',
    value: 'either Parent or the Company',
    source_span: Object.freeze({
      coordinate_system: COORDINATE_SYSTEM,
      start_byte: 364515,
      end_byte: 364543,
      text_sha256: '222db478c301155dff95710110140472441d71f088b5a1cbb99c157ac922429a',
    }),
  }),
  Object.freeze({
    role: 'MODAL',
    value: 'may',
    source_span: Object.freeze({
      coordinate_system: COORDINATE_SYSTEM,
      start_byte: 364438,
      end_byte: 364441,
      text_sha256: 'ee4d988c65de860fabbfbcd27f73d50bbebe3fba37fe419284f4811389c30bdc',
    }),
  }),
  Object.freeze({
    role: 'VERB',
    value: 'be terminated',
    source_span: Object.freeze({
      coordinate_system: COORDINATE_SYSTEM,
      start_byte: 364442,
      end_byte: 364455,
      text_sha256: '78f10c7f8e5098b594d2f69087ebbc3542b960663ce4e888c3de25246dafb254',
    }),
  }),
  Object.freeze({
    role: 'OBJECT',
    value: 'This Agreement',
    source_span: Object.freeze({
      coordinate_system: COORDINATE_SYSTEM,
      start_byte: 364423,
      end_byte: 364437,
      text_sha256: '62db433223b2514b2ee2c70377ca1f3e8e712bd12b4bb63127b0bc6fd17b134c',
    }),
  }),
  Object.freeze({
    role: 'CONNECTIVE',
    value: 'if',
    source_span: CONNECTIVE_SPAN,
  }),
  Object.freeze({
    role: 'TIME',
    value: 'at any time prior to the Titanium Merger Effective Time',
    source_span: Object.freeze({
      coordinate_system: COORDINATE_SYSTEM,
      start_byte: 364456,
      end_byte: 364511,
      text_sha256: 'eb5aaa0971b19ae6f0590fac208a388ed3f4d1aaa7148af76487ffd69148f1f6',
    }),
  }),
]);
const LIMBS = Object.freeze([
  Object.freeze({
    reference: '6.2(a)',
    node_occurrence_id: '20800cde2e005201e9182939b5ea73785f0e25b4b3051b0695cba9a52e1f1cd7',
    span: Object.freeze({
      coordinate_system: COORDINATE_SYSTEM,
      start_byte: 364548,
      end_byte: 364925,
      text_sha256: '59df046aa9991b728b38400ed87c0acabdc525b16f90ee19ed12d575f6165bd7',
    }),
  }),
  Object.freeze({
    reference: '6.2(b)',
    node_occurrence_id: '81fff54644db6c9cdd8dc553c389a464489ed04e2a993a8df46c25e5f327636b',
    span: Object.freeze({
      coordinate_system: COORDINATE_SYSTEM,
      start_byte: 364925,
      end_byte: 365137,
      text_sha256: '8aa1f56c761a45914ea3fd7913b8e5a61b8c60ace216628cd1e8d3e601e4165c',
    }),
  }),
  Object.freeze({
    reference: '6.2(c)',
    node_occurrence_id: '492c594ec9814564bf30d5657ea5d774b760aabe20acbd29f02c61d763b74d4d',
    span: Object.freeze({
      coordinate_system: COORDINATE_SYSTEM,
      start_byte: 365137,
      end_byte: 365354,
      text_sha256: '01ebc70196982238b19de37b7ed6ef2f89858dee404384d8a277501df1716a45',
    }),
  }),
  Object.freeze({
    reference: '6.2(d)',
    node_occurrence_id: 'e1491fafffa0d5e77e4e703aeac3c211e2bc48518dcd05a6bc32572cebe11c9d',
    span: Object.freeze({
      coordinate_system: COORDINATE_SYSTEM,
      start_byte: 365354,
      end_byte: 365781,
      text_sha256: '68b2e739c779f4db5e93a385822543d40f7d1f0ae1fea5670108e65e5a066183',
    }),
  }),
]);
const FOCUS_NODE_IDS = Object.freeze(LIMBS.map((limb) => limb.node_occurrence_id));
const CONCHO_FOCUS_NODE_IDS = Object.freeze([
  '27bb19c1117c73132205b2b785be5b60a980c75e82a8d61eca6eb5af71ca1a91',
  '04083da04e19f3716747012faba58d58c083b400ae0b3b4a6c9803a520a516d0',
  '0fde255bd08b0aa5d5c1bf5229373e5f0ee8b8f741cf160f92c7617e78f02a3a',
  '54a1c5f948a326846e99fd7be8e9d8538ab90f3501a0114eef8aebfd8819ae93',
]);
const LOCAL_QUALIFICATIONS = Object.freeze([
  Object.freeze({
    node_occurrence_id: '3ec9665fb69c128973815664167bd850be0f4d25d3b5c2d0cbe8f404902fd8c8',
    owning_limb_id: LIMBS[0].node_occurrence_id,
    span: Object.freeze([364643, 364924]),
  }),
  Object.freeze({
    node_occurrence_id: '460996c5e2936d40712046653018df828228f7e493eadbde51e16a155bc25fe5',
    owning_limb_id: LIMBS[3].node_occurrence_id,
    span: Object.freeze([365508, 365780]),
  }),
]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

const agreementIndex = readJson(INDEX_PATH);
const conchoAgreementIndex = readJson(CONCHO_INDEX_PATH);
const semanticPolicy = readJson(POLICY_PATH);

function nodeById(nodeOccurrenceId) {
  return agreementIndex.nodes.find((node) =>
    node.node_occurrence_id === nodeOccurrenceId);
}

function quote(span) {
  return Buffer.from(agreementIndex.source_binding.canonical_text, 'utf8')
    .subarray(span.start_byte, span.end_byte)
    .toString('utf8');
}

function compile(index = agreementIndex, policy = semanticPolicy, focusNodeIds = FOCUS_NODE_IDS) {
  return compileContext([...focusNodeIds], index, policy);
}

function assertCode(expectedCode, action) {
  assert.throws(action, (error) => {
    assert.equal(error && error.code, expectedCode);
    return true;
  });
}

function assertExactKeys(value, expectedKeys) {
  assert.deepEqual(Object.keys(value).sort(), [...expectedKeys].sort());
}

test('TopBuild 6.2 binds the exact sealed chapeau and four source-ordered limbs', () => {
  assert.equal(sha256Hex(fs.readFileSync(INDEX_PATH)), INDEX_SHA256);
  assert.equal(agreementIndex.agreement_index_id, AGREEMENT_INDEX_ID);
  assert.equal(agreementIndex.source_binding.canonical_text_sha256, CANONICAL_TEXT_SHA256);

  const chapeau = nodeById(CHAPEAU_ID);
  assert.deepEqual({
    node_kind: chapeau.node_kind,
    parent_node_occurrence_id: chapeau.parent_node_occurrence_id,
    extent_span: chapeau.extent_span,
  }, {
    node_kind: 'CHAPEAU',
    parent_node_occurrence_id: SHARED_PARENT_ID,
    extent_span: CHAPEAU_SPAN,
  });
  assert.equal(quote(CHAPEAU_SPAN),
    'This Agreement may be terminated at any time prior to the Titanium Merger '
      + 'Effective Time by either Parent or the Company if:');

  assert.deepEqual(LIMBS.map((expected) => {
    const node = nodeById(expected.node_occurrence_id);
    return {
      reference: node.reference,
      node_occurrence_id: node.node_occurrence_id,
      node_kind: node.node_kind,
      parent_node_occurrence_id: node.parent_node_occurrence_id,
      extent_span: node.extent_span,
    };
  }), LIMBS.map((expected) => ({
    reference: expected.reference,
    node_occurrence_id: expected.node_occurrence_id,
    node_kind: 'LIMB',
    parent_node_occurrence_id: SHARED_PARENT_ID,
    extent_span: expected.span,
  })));
});

test('TopBuild 6.2 inherits all six exact chapeau facts into every limb with provenance', () => {
  const compilation = compile();
  const expectedFactOrder = LIMBS.flatMap((limb) =>
    FACTS.map((fact) => [limb.node_occurrence_id, fact.role]));

  assertExactKeys(compilation, [
    'schema_version',
    'context_compilation_id',
    'agreement_index_binding',
    'semantic_policy_binding',
    'focus_node_occurrence_ids',
    'frames_by_focus_node_id',
    'context_facts',
    'scope_edges',
    'ambiguities',
    'residuals',
    'reference_edges',
    'definition_edges',
    'semantic_relationships',
    'diagnostics',
  ]);
  assert.equal(compilation.schema_version, 'CONTEXT_COMPILATION/V1');
  assert.match(compilation.context_compilation_id, HEX_256);
  assertExactKeys(compilation.agreement_index_binding, [
    'agreement_index_id',
    'agreement_index_sha256',
    'canonical_text_sha256',
    'structural_policy_digest',
  ]);
  assert.deepEqual(compilation.agreement_index_binding, {
    agreement_index_id: AGREEMENT_INDEX_ID,
    agreement_index_sha256: INDEX_SHA256,
    canonical_text_sha256: CANONICAL_TEXT_SHA256,
    structural_policy_digest: STRUCTURAL_POLICY_DIGEST,
  });
  assertExactKeys(compilation.semantic_policy_binding, [
    'schema_version',
    'policy_version',
    'policy_digest',
  ]);
  assert.deepEqual(compilation.semantic_policy_binding, {
    schema_version: semanticPolicy.schema_version,
    policy_version: semanticPolicy.policy_version,
    policy_digest: semanticPolicy.policy_digest,
  });
  assert.deepEqual(compilation.focus_node_occurrence_ids, FOCUS_NODE_IDS);
  assert.deepEqual(Object.keys(compilation.frames_by_focus_node_id), FOCUS_NODE_IDS);
  assert.equal(compilation.context_facts.length, 24);
  assert.equal(compilation.scope_edges.length, 24);
  assert.deepEqual(compilation.context_facts.map((fact) => [
    fact.target_node_occurrence_id,
    fact.role,
  ]), expectedFactOrder);
  assert.deepEqual(compilation.scope_edges.map((edge) => [
    edge.target_node_occurrence_id,
    edge.governing_role,
  ]), expectedFactOrder);

  const edgesById = new Map(compilation.scope_edges.map((edge) =>
    [edge.scope_edge_id, edge]));
  assert.equal(edgesById.size, 24);

  for (const limb of LIMBS) {
    const frame = compilation.frames_by_focus_node_id[limb.node_occurrence_id];
    const facts = compilation.context_facts.filter((fact) =>
      fact.target_node_occurrence_id === limb.node_occurrence_id);
    const edges = facts.map((fact) => edgesById.get(fact.scope_edge_id));

    assertExactKeys(frame, [
      'schema_version',
      'context_frame_id',
      'focus_node_occurrence_id',
      'focus_node_kind',
      'focus_node_span',
      'context_fact_ids',
      'scope_edge_ids',
      'ambiguity_ids',
      'residual_ids',
    ]);
    assert.equal(frame.schema_version, 'CONTEXT_FRAME/V1');
    assert.match(frame.context_frame_id, HEX_256);
    assert.equal(frame.focus_node_occurrence_id, limb.node_occurrence_id);
    assert.equal(frame.focus_node_kind, 'LIMB');
    assert.deepEqual(frame.focus_node_span, limb.span);
    assert.deepEqual(frame.context_fact_ids, facts.map((fact) => fact.context_fact_id));
    assert.deepEqual(frame.scope_edge_ids, edges.map((edge) => edge.scope_edge_id));
    assert.deepEqual(frame.ambiguity_ids, []);
    assert.deepEqual(frame.residual_ids, []);

    assert.deepEqual(facts.map((fact) => fact.role), FACTS.map((fact) => fact.role));
    for (const [factIndex, actual] of facts.entries()) {
      const expected = FACTS[factIndex];
      const edge = edges[factIndex];
      assertExactKeys(actual, [
        'schema_version',
        'context_fact_id',
        'role',
        'value',
        'state',
        'source_node_occurrence_id',
        'source_span',
        'target_node_occurrence_id',
        'scope_edge_id',
        'rule_id',
        'rule_version',
        'overridden_fact_ids',
        'alternative_fact_ids',
      ]);
      assert.match(actual.context_fact_id, HEX_256);
      assert.equal(actual.schema_version, 'CONTEXT_FACT/V1');
      assert.equal(actual.value, expected.value);
      assert.equal(actual.state, 'INHERITED');
      assert.equal(actual.source_node_occurrence_id, CHAPEAU_ID);
      assert.deepEqual(actual.source_span, expected.source_span);
      assert.equal(quote(actual.source_span), expected.value);
      assert.equal(actual.target_node_occurrence_id, limb.node_occurrence_id);
      assert.equal(actual.rule_id, RULE_ID);
      assert.equal(actual.rule_version, 1);
      assert.deepEqual(actual.overridden_fact_ids, []);
      assert.deepEqual(actual.alternative_fact_ids, []);

      assert.ok(edge, `${limb.reference}:${expected.role} scope edge`);
      assertExactKeys(edge, [
        'schema_version',
        'scope_edge_id',
        'edge_kind',
        'state',
        'governing_role',
        'source_node_occurrence_id',
        'governing_source_span',
        'target_node_occurrence_id',
        'proof',
        'rule_id',
        'rule_version',
      ]);
      assert.equal(edge.schema_version, 'CONTEXT_SCOPE_EDGE/V1');
      assert.match(edge.scope_edge_id, HEX_256);
      assert.equal(edge.edge_kind, 'CHAPEAU_GOVERNS_LIMB');
      assert.equal(edge.state, 'RESOLVED');
      assert.equal(edge.governing_role, expected.role);
      assert.equal(edge.source_node_occurrence_id, CHAPEAU_ID);
      assert.deepEqual(edge.governing_source_span, expected.source_span);
      assert.equal(edge.target_node_occurrence_id, limb.node_occurrence_id);
      assert.equal(edge.rule_id, RULE_ID);
      assert.equal(edge.rule_version, 1);
      assertExactKeys(edge.proof, [
        'proof_kind',
        'shared_parent_node_occurrence_id',
        'source_node_kind',
        'target_node_kind',
        'source_extent_span',
        'target_extent_span',
        'connective_span',
        'ordered_target_node_occurrence_ids',
      ]);
      assert.deepEqual(edge.proof, {
        proof_kind: 'AUTHORED_CHAPEAU_CONTIGUOUS_LIMB_SIBLINGS',
        shared_parent_node_occurrence_id: SHARED_PARENT_ID,
        source_node_kind: 'CHAPEAU',
        target_node_kind: 'LIMB',
        source_extent_span: CHAPEAU_SPAN,
        target_extent_span: limb.span,
        connective_span: CONNECTIVE_SPAN,
        ordered_target_node_occurrence_ids: FOCUS_NODE_IDS,
      });
    }
  }

  assert.deepEqual(compilation.ambiguities, []);
  assert.deepEqual(compilation.residuals, []);
  assert.deepEqual(compilation.reference_edges, []);
  assert.deepEqual(compilation.definition_edges, []);
  assert.deepEqual(compilation.semantic_relationships, []);
  assert.deepEqual(compilation.diagnostics, []);
});

test('TopBuild 6.2 does not leak either limb-local proviso into a sibling limb', () => {
  const compilation = compile();
  const nodeIds = new Set(agreementIndex.nodes.map((node) => node.node_occurrence_id));

  for (const qualification of LOCAL_QUALIFICATIONS) {
    const node = nodeById(qualification.node_occurrence_id);
    assert.ok(nodeIds.has(node.node_occurrence_id));
    assert.equal(node.node_kind, 'QUALIFICATION');
    assert.deepEqual([
      node.extent_span.start_byte,
      node.extent_span.end_byte,
    ], qualification.span);

    const siblingIds = new Set(FOCUS_NODE_IDS.filter((nodeId) =>
      nodeId !== qualification.owning_limb_id));
    assert.equal(compilation.context_facts.some((fact) =>
      fact.source_node_occurrence_id === qualification.node_occurrence_id
        && siblingIds.has(fact.target_node_occurrence_id)), false);
    assert.equal(compilation.scope_edges.some((edge) =>
      edge.source_node_occurrence_id === qualification.node_occurrence_id
        && siblingIds.has(edge.target_node_occurrence_id)), false);
  }
});

test('TopBuild 6.2 compilation is byte-identical when repeated', () => {
  const first = Buffer.from(`${canonicalJson(compile())}\n`, 'utf8');
  const second = Buffer.from(`${canonicalJson(compile())}\n`, 'utf8');
  assert.deepEqual(first, second);
});

test('TopBuild 6.2 fails closed for unknown, foreign and duplicate focus identifiers', () => {
  assertCode('CONTEXT_COMPILATION_FOCUS_UNKNOWN', () =>
    compile(agreementIndex, semanticPolicy, ['unknown-node']));
  assertCode('CONTEXT_COMPILATION_FOCUS_UNKNOWN', () =>
    compile(agreementIndex, semanticPolicy, [CONCHO_FOREIGN_LIMB_ID]));
  assertCode('CONTEXT_COMPILATION_FOCUS_DUPLICATE', () =>
    compile(agreementIndex, semanticPolicy, [
      LIMBS[0].node_occurrence_id,
      LIMBS[0].node_occurrence_id,
      ...FOCUS_NODE_IDS.slice(1),
    ]));
});

test('TopBuild 6.2 fails closed for a non-limb focus and changed source order', () => {
  assertCode('CONTEXT_COMPILATION_FOCUS_KIND_MISMATCH', () =>
    compile(agreementIndex, semanticPolicy, [CHAPEAU_ID, ...FOCUS_NODE_IDS]));
  assertCode('CONTEXT_COMPILATION_FOCUS_ORDER_MISMATCH', () =>
    compile(agreementIndex, semanticPolicy, [...FOCUS_NODE_IDS].reverse()));
});

test('TopBuild 6.2 fails closed when the index or semantic-policy digest drifts', () => {
  const changedIndex = structuredClone(agreementIndex);
  changedIndex.nodes[0].roles = ['DRIFTED_ROLE'];
  assertCode('CONTEXT_COMPILATION_INDEX_DIGEST_MISMATCH', () =>
    compile(changedIndex));

  const changedPolicy = structuredClone(semanticPolicy);
  changedPolicy.policy_digest = '0'.repeat(64);
  assertCode('CONTEXT_COMPILATION_POLICY_DIGEST_MISMATCH', () =>
    compile(agreementIndex, changedPolicy));
});

test('TopBuild 6.2 rejects a different internally valid sealed M2 index', () => {
  assertCode('CONTEXT_COMPILATION_EXPERIMENT_BINDING_MISMATCH', () =>
    compile(conchoAgreementIndex, semanticPolicy, CONCHO_FOCUS_NODE_IDS));
});
