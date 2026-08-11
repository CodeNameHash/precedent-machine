'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { canonicalJson, contentId, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
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
const AUTHORITY_PATH = path.join(MIGRATION_ROOT, 'control/m3-authority.json');
const REVIEW_PATH = path.join(
  MIGRATION_ROOT,
  'reviews/stage-2y-structure-m3-full-contract-sol-freeze.json',
);

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
const m3Authority = readJson(AUTHORITY_PATH);
const fullContractReview = readJson(REVIEW_PATH);

test('shadow runner accepts the sealed predecessor trust-root binding', async () => {
  const { validatePolicy } = await import('../scripts/stage-2y-context-compilation-shadow.mjs');
  assert.equal(validatePolicy(semanticPolicy, m3Authority), semanticPolicy);
});
const CURRENT_STATE_HASHES = Object.fromEntries(Object.values(m3Authority.current_state_bindings)
  .map((binding) => [binding.path, sha256Hex(fs.readFileSync(path.join(ROOT, binding.path)))]));

const INDEXES_BY_DEAL = new Map(semanticPolicy.input_contract.agreement_indexes.map((binding) => [
  binding.deal,
  {
    binding,
    index: readJson(path.join(ROOT, binding.path)),
  },
]));
const COMPILATIONS_BY_DEAL = new Map();

function compareNodes(left, right) {
  return left.extent_span.start_byte - right.extent_span.start_byte
    || left.extent_span.end_byte - right.extent_span.end_byte
    || left.node_occurrence_id.localeCompare(right.node_occurrence_id);
}

function deriveFocusNodes(index) {
  const selectedKinds = new Set(semanticPolicy.input_contract.focus_derivation.selected_kinds);
  const nodesById = new Map(index.nodes.map((node) => [node.node_occurrence_id, node]));
  const hasSelectedDescendant = (node) => {
    const queue = [...node.child_node_occurrence_ids];
    const seen = new Set();
    while (queue.length > 0) {
      const id = queue.shift();
      assert.equal(seen.has(id), false, `acyclic descendants for ${node.node_occurrence_id}`);
      seen.add(id);
      const child = nodesById.get(id);
      assert.ok(child, `child ${id}`);
      if (selectedKinds.has(child.node_kind)) return true;
      queue.push(...child.child_node_occurrence_ids);
    }
    return false;
  };
  return index.nodes
    .filter((node) => selectedKinds.has(node.node_kind)
      || (node.node_kind === 'SECTION' && !hasSelectedDescendant(node)))
    .sort(compareNodes);
}

function fullCompilation(deal) {
  if (!COMPILATIONS_BY_DEAL.has(deal)) {
    const { index } = INDEXES_BY_DEAL.get(deal);
    COMPILATIONS_BY_DEAL.set(deal, compileContext(
      deriveFocusNodes(index).map((node) => node.node_occurrence_id),
      index,
      semanticPolicy,
    ));
  }
  return COMPILATIONS_BY_DEAL.get(deal);
}

function projectBoundedTopBuild(compilation) {
  const contract = semanticPolicy.bounded_projection_contract;
  const selection = contract.selection;
  const focusSet = new Set(selection.focus_node_occurrence_ids);
  const contextFacts = compilation.context_facts.filter((fact) =>
    focusSet.has(fact.target_node_occurrence_id)
      && fact.source_node_occurrence_id === selection.source_node_occurrence_id
      && fact.rule_id === selection.rule_id
      && fact.state === selection.fact_state);
  const factIds = new Set(contextFacts.map((fact) => fact.context_fact_id));
  const scopeEdgeIds = new Set(contextFacts.map((fact) => fact.scope_edge_id));
  const scopeEdges = compilation.scope_edges.filter((edge) =>
    scopeEdgeIds.has(edge.scope_edge_id)
      && edge.state === selection.scope_edge_state);
  return {
    schema_version: contract.schema_version,
    agreement_index_binding: compilation.agreement_index_binding,
    focus_node_occurrence_ids: [...selection.focus_node_occurrence_ids],
    frames: selection.focus_node_occurrence_ids.map((focusId) => {
      const frame = compilation.frames_by_focus_node_id[focusId];
      return {
        focus_node_occurrence_id: focusId,
        focus_node_kind: frame.focus_node_kind,
        focus_node_span: frame.focus_node_span,
        context_fact_ids: frame.context_fact_ids.filter((id) => factIds.has(id)),
        scope_edge_ids: frame.scope_edge_ids.filter((id) => scopeEdgeIds.has(id)),
      };
    }),
    context_facts: contextFacts,
    scope_edges: scopeEdges,
  };
}

function recomputePolicyDigest(policy) {
  const unsigned = structuredClone(policy);
  delete unsigned.policy_digest;
  policy.policy_digest = sha256Hex(Buffer.from(canonicalJson(unsigned), 'utf8'));
  return policy;
}

function assertRecordIdentity(record, idField) {
  assert.match(record[idField], HEX_256);
  const unsigned = structuredClone(record);
  delete unsigned[idField];
  assert.equal(record[idField], contentId(record.schema_version, unsigned));
}

function stateCounts(records) {
  return Object.fromEntries([...new Set(records.map((record) => record.state))]
    .sort()
    .map((state) => [state, records.filter((record) => record.state === state).length]));
}

function sourceSlice(index, span) {
  return Buffer.from(index.source_binding.canonical_text, 'utf8')
    .subarray(span.start_byte, span.end_byte);
}

function assertSpan(index, span) {
  assert.equal(span.coordinate_system, COORDINATE_SYSTEM);
  assert.equal(sha256Hex(sourceSlice(index, span)), span.text_sha256);
}

function assertSorted(records, comparator, label) {
  assert.deepEqual(records, [...records].sort(comparator), label);
}

function nodeById(nodeOccurrenceId) {
  return agreementIndex.nodes.find((node) =>
    node.node_occurrence_id === nodeOccurrenceId);
}

function quote(span) {
  return Buffer.from(agreementIndex.source_binding.canonical_text, 'utf8')
    .subarray(span.start_byte, span.end_byte)
    .toString('utf8');
}

function compile(index = agreementIndex, policy = semanticPolicy,
  focusNodeIds = deriveFocusNodes(index).map((node) => node.node_occurrence_id)) {
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
  const full = fullCompilation('topbuild');
  const projection = projectBoundedTopBuild(full);
  const compilation = {
    ...full,
    focus_node_occurrence_ids: projection.focus_node_occurrence_ids,
    frames_by_focus_node_id: Object.fromEntries(projection.frames.map((frame) => [
      frame.focus_node_occurrence_id,
      {
        ...full.frames_by_focus_node_id[frame.focus_node_occurrence_id],
        context_fact_ids: frame.context_fact_ids,
        scope_edge_ids: frame.scope_edge_ids,
        ambiguity_ids: [],
        residual_ids: [],
      },
    ])),
    context_facts: projection.context_facts,
    scope_edges: projection.scope_edges,
    ambiguities: [],
    residuals: [],
    reference_edges: [],
    definition_edges: [],
    semantic_relationships: [],
    diagnostics: [],
  };
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

  const bytes = Buffer.from(canonicalJson(projection), 'utf8');
  const contract = semanticPolicy.bounded_projection_contract;
  assert.equal(bytes.length, contract.canonical_byte_length_without_lf);
  assert.equal(sha256Hex(bytes), contract.canonical_sha256_without_lf);
  assert.equal(sha256Hex(Buffer.concat([bytes, Buffer.from('\n')])),
    contract.canonical_sha256_with_lf);
  assert.equal(contentId(contract.schema_version, projection), contract.content_id);
});

test('TopBuild 6.2 does not leak either limb-local proviso into a sibling limb', () => {
  const compilation = fullCompilation('topbuild');
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
  const first = Buffer.from(`${canonicalJson(fullCompilation('topbuild'))}\n`, 'utf8');
  const second = Buffer.from(`${canonicalJson(compile())}\n`, 'utf8');
  assert.deepEqual(first, second);
});

test('TopBuild 6.2 fails closed for unknown, foreign and duplicate focus identifiers', () => {
  const fullFocus = deriveFocusNodes(agreementIndex).map((node) => node.node_occurrence_id);
  assertCode('CONTEXT_COMPILATION_FOCUS_UNKNOWN', () =>
    compile(agreementIndex, semanticPolicy, ['unknown-node']));
  assertCode('CONTEXT_COMPILATION_FOCUS_UNKNOWN', () =>
    compile(agreementIndex, semanticPolicy, [CONCHO_FOREIGN_LIMB_ID]));
  assertCode('CONTEXT_COMPILATION_FOCUS_DUPLICATE', () =>
    compile(agreementIndex, semanticPolicy, [
      fullFocus[0],
      fullFocus[0],
      ...fullFocus.slice(1),
    ]));
});

test('TopBuild 6.2 fails closed for a non-limb focus and changed source order', () => {
  const fullFocus = deriveFocusNodes(agreementIndex).map((node) => node.node_occurrence_id);
  const wrongKind = agreementIndex.nodes.find((node) =>
    !semanticPolicy.focus_node_kinds.includes(node.node_kind));
  assertCode('CONTEXT_COMPILATION_FOCUS_KIND_MISMATCH', () =>
    compile(agreementIndex, semanticPolicy, [wrongKind.node_occurrence_id, ...fullFocus]));
  assertCode('CONTEXT_COMPILATION_FOCUS_ORDER_MISMATCH', () =>
    compile(agreementIndex, semanticPolicy, [...fullFocus].reverse()));
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
  assertCode('CONTEXT_COMPILATION_FOCUS_UNKNOWN', () =>
    compile(conchoAgreementIndex, semanticPolicy, FOCUS_NODE_IDS));
});

function allPrimaryRecords(compilation) {
  return [
    ...compilation.context_facts.map((record) => [record, 'context_fact_id']),
    ...compilation.scope_edges.map((record) => [record, 'scope_edge_id']),
    ...compilation.ambiguities.map((record) => [record, 'ambiguity_id']),
    ...compilation.residuals.map((record) => [record, 'residual_id']),
    ...compilation.reference_edges.map((record) => [record, 'reference_edge_id']),
    ...compilation.definition_edges.map((record) => [record, 'definition_edge_id']),
    ...compilation.semantic_relationships.map((record) => [record, 'semantic_relationship_id']),
    ...compilation.diagnostics.map((record) => [record, 'diagnostic_id']),
    ...Object.values(compilation.frames_by_focus_node_id)
      .map((record) => [record, 'context_frame_id']),
  ];
}

function assertCompilationContract(compilation, index) {
  const contract = semanticPolicy.output_contract;
  assertExactKeys(compilation, contract.context_compilation_fields);
  assertExactKeys(compilation.agreement_index_binding, contract.agreement_index_binding_fields);
  assertExactKeys(compilation.semantic_policy_binding, contract.semantic_policy_binding_fields);
  assertRecordIdentity(compilation, 'context_compilation_id');

  const collections = [
    [Object.values(compilation.frames_by_focus_node_id), contract.context_frame_fields],
    [compilation.context_facts, contract.context_fact_fields],
    [compilation.scope_edges, contract.scope_edge_fields],
    [compilation.ambiguities, contract.context_ambiguity_fields],
    [compilation.residuals, contract.context_residual_fields],
    [compilation.reference_edges, contract.context_reference_edge_fields],
    [compilation.definition_edges, contract.context_definition_edge_fields],
    [compilation.semantic_relationships, contract.semantic_relationship_fields],
    [compilation.diagnostics, contract.context_diagnostic_fields],
  ];
  for (const [records, fields] of collections) {
    for (const record of records) assertExactKeys(record, fields);
  }
  for (const edge of compilation.scope_edges) {
    assertExactKeys(edge.proof, contract.scope_edge_proof_fields);
  }
  for (const relationship of compilation.semantic_relationships) {
    assertExactKeys(relationship.source_endpoint, contract.semantic_endpoint_fields);
    assertExactKeys(relationship.target_endpoint, contract.semantic_endpoint_fields);
    assertExactKeys(relationship.temporal_scope, contract.temporal_scope_fields);
  }

  const identityPairs = allPrimaryRecords(compilation);
  const primaryIds = identityPairs.map(([record, field]) => record[field]);
  assert.equal(new Set(primaryIds).size, primaryIds.length);
  for (const [record, field] of identityPairs) assertRecordIdentity(record, field);

  const nodeIds = new Set(index.nodes.map((node) => node.node_occurrence_id));
  const annotationIds = new Set(index.annotations.map((annotation) =>
    annotation.annotation_occurrence_id));
  const primaryIdSet = new Set(primaryIds);
  const requireMember = (id, set, label) => assert.ok(set.has(id), `${label}: ${id}`);
  for (const frame of Object.values(compilation.frames_by_focus_node_id)) {
    requireMember(frame.focus_node_occurrence_id, nodeIds, 'frame focus');
    for (const id of [...frame.context_fact_ids, ...frame.scope_edge_ids,
      ...frame.ambiguity_ids, ...frame.residual_ids]) requireMember(id, primaryIdSet, 'frame link');
    assertSpan(index, frame.focus_node_span);
  }
  for (const fact of compilation.context_facts) {
    requireMember(fact.source_node_occurrence_id, nodeIds, 'fact source');
    requireMember(fact.target_node_occurrence_id, nodeIds, 'fact target');
    requireMember(fact.scope_edge_id, primaryIdSet, 'fact scope');
    for (const id of [...fact.overridden_fact_ids, ...fact.alternative_fact_ids]) {
      requireMember(id, primaryIdSet, 'fact dependency');
    }
    assertSpan(index, fact.source_span);
  }
  for (const edge of compilation.scope_edges) {
    requireMember(edge.source_node_occurrence_id, nodeIds, 'scope source');
    requireMember(edge.target_node_occurrence_id, nodeIds, 'scope target');
    for (const id of edge.proof.ordered_target_node_occurrence_ids) {
      requireMember(id, nodeIds, 'scope ordered target');
    }
    for (const span of [edge.governing_source_span, edge.proof.source_extent_span,
      edge.proof.target_extent_span, edge.proof.connective_span].filter(Boolean)) {
      assertSpan(index, span);
    }
  }
  for (const edge of compilation.reference_edges) {
    requireMember(edge.source_annotation_occurrence_id, annotationIds, 'reference annotation');
    requireMember(edge.owner_node_occurrence_id, nodeIds, 'reference owner');
    for (const id of edge.target_node_occurrence_ids) requireMember(id, nodeIds, 'reference target');
    assertSpan(index, edge.source_span);
  }
  for (const edge of compilation.definition_edges) {
    requireMember(edge.source_annotation_occurrence_id, annotationIds, 'definition use');
    requireMember(edge.owner_node_occurrence_id, nodeIds, 'definition owner');
    for (const id of edge.target_definition_annotation_occurrence_ids) {
      requireMember(id, annotationIds, 'definition target');
    }
    for (const id of edge.target_owner_node_occurrence_ids) {
      requireMember(id, nodeIds, 'definition target owner');
    }
    assertSpan(index, edge.source_span);
  }

  const focusOrder = new Map(compilation.focus_node_occurrence_ids
    .map((id, ordinal) => [id, ordinal]));
  const roleOrder = new Map(semanticPolicy.context_role_order
    .map((role, ordinal) => [role, ordinal]));
  assertSorted(compilation.context_facts, (left, right) =>
    focusOrder.get(left.target_node_occurrence_id) - focusOrder.get(right.target_node_occurrence_id)
      || roleOrder.get(left.role) - roleOrder.get(right.role)
      || left.source_span.start_byte - right.source_span.start_byte
      || left.source_span.end_byte - right.source_span.end_byte
      || left.context_fact_id.localeCompare(right.context_fact_id), 'fact order');
  assertSorted(compilation.scope_edges, (left, right) =>
    focusOrder.get(left.target_node_occurrence_id) - focusOrder.get(right.target_node_occurrence_id)
      || roleOrder.get(left.governing_role) - roleOrder.get(right.governing_role)
      || left.governing_source_span.start_byte - right.governing_source_span.start_byte
      || left.governing_source_span.end_byte - right.governing_source_span.end_byte
      || left.scope_edge_id.localeCompare(right.scope_edge_id), 'scope order');
  assertSorted(compilation.reference_edges, (left, right) =>
    left.source_span.start_byte - right.source_span.start_byte
      || left.source_span.end_byte - right.source_span.end_byte
      || left.source_annotation_occurrence_id.localeCompare(right.source_annotation_occurrence_id),
  'reference order');
  assertSorted(compilation.definition_edges, (left, right) =>
    left.source_span.start_byte - right.source_span.start_byte
      || left.source_span.end_byte - right.source_span.end_byte
      || left.source_annotation_occurrence_id.localeCompare(right.source_annotation_occurrence_id),
  'definition order');
  assertSorted(compilation.ambiguities, (left, right) =>
    left.source_spans[0].start_byte - right.source_spans[0].start_byte
      || left.source_spans[0].end_byte - right.source_spans[0].end_byte
      || left.ambiguity_type.localeCompare(right.ambiguity_type)
      || left.ambiguity_id.localeCompare(right.ambiguity_id), 'ambiguity order');
  assertSorted(compilation.residuals, (left, right) =>
    focusOrder.get(left.focus_node_occurrence_id)
      - focusOrder.get(right.focus_node_occurrence_id)
      || left.residual_kind.localeCompare(right.residual_kind)
      || left.residual_id.localeCompare(right.residual_id), 'residual order');
  assertSorted(compilation.semantic_relationships, (left, right) =>
    left.source_spans[0].start_byte - right.source_spans[0].start_byte
      || left.source_spans[0].end_byte - right.source_spans[0].end_byte
      || left.relationship_type.localeCompare(right.relationship_type)
      || left.source_endpoint.entity_id.localeCompare(right.source_endpoint.entity_id)
      || left.target_endpoint.entity_id.localeCompare(right.target_endpoint.entity_id)
      || left.semantic_relationship_id.localeCompare(right.semantic_relationship_id),
  'relationship order');
  assertSorted(compilation.diagnostics, (left, right) => {
    const leftStart = left.source_spans[0]?.start_byte ?? Number.POSITIVE_INFINITY;
    const rightStart = right.source_spans[0]?.start_byte ?? Number.POSITIVE_INFINITY;
    return leftStart - rightStart
      || left.diagnostic_type.localeCompare(right.diagnostic_type)
      || left.diagnostic_id.localeCompare(right.diagnostic_id);
  }, 'diagnostic order');

  const frameArrays = new Map(compilation.focus_node_occurrence_ids.map((focusId) => [focusId, {
    context_fact_ids: [],
    scope_edge_ids: [],
    ambiguity_ids: [],
    residual_ids: [],
  }]));
  for (const fact of compilation.context_facts) {
    frameArrays.get(fact.target_node_occurrence_id).context_fact_ids.push(fact.context_fact_id);
  }
  for (const edge of compilation.scope_edges) {
    frameArrays.get(edge.target_node_occurrence_id).scope_edge_ids.push(edge.scope_edge_id);
  }
  for (const ambiguity of compilation.ambiguities) {
    for (const focusId of ambiguity.target_node_occurrence_ids) {
      frameArrays.get(focusId).ambiguity_ids.push(ambiguity.ambiguity_id);
    }
  }
  for (const residual of compilation.residuals) {
    frameArrays.get(residual.focus_node_occurrence_id).residual_ids.push(residual.residual_id);
  }
  for (const [focusId, expected] of frameArrays) {
    const frame = compilation.frames_by_focus_node_id[focusId];
    assert.deepEqual({
      context_fact_ids: frame.context_fact_ids,
      scope_edge_ids: frame.scope_edge_ids,
      ambiguity_ids: frame.ambiguity_ids,
      residual_ids: frame.residual_ids,
    }, expected, `frame global-order filter ${focusId}`);
  }
}

test('M3 V2 policy and authority are the recursively validated final controls', () => {
  assert.equal(sha256Hex(fs.readFileSync(POLICY_PATH)),
    'd00b971f240a9d8d67f559533d685e9ad2801fdfd1e5986de810dbe803e58bdb');
  assert.equal(semanticPolicy.policy_digest,
    '2538c810b5aee2ee3edc318e77abd2ceaee3a4e9a48929aec9ccdb28ab491d54');
  const unsignedPolicy = structuredClone(semanticPolicy);
  delete unsignedPolicy.policy_digest;
  assert.equal(sha256Hex(Buffer.from(canonicalJson(unsignedPolicy), 'utf8')),
    semanticPolicy.policy_digest);
  assert.equal(sha256Hex(fs.readFileSync(AUTHORITY_PATH)),
    '959c09a62ac376ed19504b6fcf3d4e1b44054ba7599436dc322a2524117a6b06');
  const unsignedAuthority = structuredClone(m3Authority);
  delete unsignedAuthority.authority_digest;
  assert.equal(sha256Hex(Buffer.from(canonicalJson(unsignedAuthority), 'utf8')),
    m3Authority.authority_digest);
  assert.equal(sha256Hex(fs.readFileSync(REVIEW_PATH)),
    'f870d4e5a8fed1752403aa33d68a3dad3bc09c6b47f21a1beb30509a5fb7dc16');
  const unsignedReview = structuredClone(fullContractReview);
  delete unsignedReview.review_id;
  assert.equal(fullContractReview.review_id,
    contentId(fullContractReview.schema_version, unsignedReview));
  assert.equal(m3Authority.bindings.full_contract_review.sha256,
    sha256Hex(fs.readFileSync(REVIEW_PATH)));
  assert.equal(m3Authority.bindings.semantic_policy.sha256,
    sha256Hex(fs.readFileSync(POLICY_PATH)));
  assert.equal(m3Authority.prohibitions.model_calls, 0);
  assert.equal(m3Authority.prohibitions.database_writes, 0);
  assert.equal(m3Authority.prohibitions.product_writes, 0);
  assert.equal(m3Authority.prohibitions.serving_changes, 0);
  assert.equal(m3Authority.prohibitions.publication_authorisation, 'NONE');
});

test('all seven V2 compilations have the exact focus set, schema, identity and order', () => {
  let focusCount = 0;
  for (const [deal, { binding, index }] of INDEXES_BY_DEAL) {
    const derived = deriveFocusNodes(index).map((node) => node.node_occurrence_id);
    const compilation = fullCompilation(deal);
    assert.equal(derived.length, binding.focus_count);
    assert.deepEqual(compilation.focus_node_occurrence_ids, derived);
    assert.deepEqual(Object.keys(compilation.frames_by_focus_node_id), derived);
    assert.deepEqual(compilation.semantic_policy_binding, {
      schema_version: semanticPolicy.schema_version,
      policy_version: 2,
      policy_digest: semanticPolicy.policy_digest,
    });
    assertCompilationContract(compilation, index);
    focusCount += derived.length;
  }
  assert.equal(focusCount, 13996);
});

test('M2 reference and definition annotations close with the exact seven-index inventories', () => {
  const references = [];
  const definitions = [];
  for (const deal of INDEXES_BY_DEAL.keys()) {
    const compilation = fullCompilation(deal);
    references.push(...compilation.reference_edges);
    definitions.push(...compilation.definition_edges);
  }
  assert.equal(references.length, 2000);
  assert.deepEqual(stateCounts(references), { AMBIGUOUS: 11, RESOLVED: 1856, UNRESOLVED: 133 });
  assert.equal(definitions.length, 27836);
  assert.deepEqual(stateCounts(definitions), { AMBIGUOUS: 2055, RESOLVED: 25781 });
  for (const edge of references) {
    assert.equal(edge.state === 'RESOLVED', edge.selected_target_node_occurrence_id !== null);
  }
  for (const edge of definitions) {
    assert.equal(edge.state === 'RESOLVED',
      edge.selected_definition_annotation_occurrence_id !== null);
  }
});

test('all 23 M2 ambiguities carry forward and sparse frames retain explicit residuals', () => {
  const carried = [];
  for (const [deal, { index }] of INDEXES_BY_DEAL) {
    const compilation = fullCompilation(deal);
    const nodesById = new Map(index.nodes.map((node) => [node.node_occurrence_id, node]));
    const agreementCarried = compilation.ambiguities.filter((ambiguity) =>
      ambiguity.ambiguity_type === 'M2_STRUCTURE_AMBIGUITY');
    carried.push(...agreementCarried);
    for (const ambiguity of agreementCarried) {
      const predecessor = index.ambiguities.find((entry) =>
        entry.ambiguity_id === ambiguity.predecessor_ambiguity_id);
      assert.ok(predecessor);
      const predecessorNodes = new Set(predecessor.node_occurrence_ids);
      for (const targetId of ambiguity.target_node_occurrence_ids) {
        const target = nodesById.get(targetId);
        let current = target;
        let equalOrDescendant = false;
        while (current) {
          if (predecessorNodes.has(current.node_occurrence_id)) {
            equalOrDescendant = true;
            break;
          }
          current = current.parent_node_occurrence_id === null
            ? null
            : nodesById.get(current.parent_node_occurrence_id);
        }
        const containedBySpan = target.extent_span.start_byte >= predecessor.span.start_byte
          && target.extent_span.end_byte <= predecessor.span.end_byte;
        assert.ok(equalOrDescendant || containedBySpan, `strict ambiguity target ${targetId}`);
      }
    }
    const factTargets = new Set(compilation.context_facts.map((fact) =>
      fact.target_node_occurrence_id));
    for (const focusId of compilation.focus_node_occurrence_ids) {
      const noContext = compilation.residuals.filter((residual) =>
        residual.focus_node_occurrence_id === focusId
          && residual.residual_kind === 'NO_CONTEXT_RULE_APPLIED');
      assert.equal(noContext.length, factTargets.has(focusId) ? 0 : 1, `sparse frame ${focusId}`);
      assert.ok(noContext.every((residual) => residual.related_ambiguity_ids.length === 0));
    }
  }
  assert.equal(carried.length, 23);
  assert.equal(new Set(carried.map((ambiguity) => ambiguity.predecessor_ambiguity_id)).size, 23);
  assert.ok(carried.every((ambiguity) => ambiguity.state === 'CARRIED_FORWARD'));
});

test('sealed scope fixtures preserve qualification boundaries and Metsera source uniqueness', () => {
  const fixtureKeys = new Set();
  for (const fixture of semanticPolicy.fixture_scope_rules) {
    const binding = semanticPolicy.input_contract.agreement_indexes.find((entry) =>
      entry.agreement_id === fixture.agreement_id);
    const compilation = fullCompilation(binding.deal);
    const key = [fixture.rule_id, fixture.rule_version,
      fixture.source_node_occurrence_id].join('\0');
    assert.equal(fixtureKeys.has(key), false, `fixture key ${key}`);
    fixtureKeys.add(key);
    const edges = compilation.scope_edges.filter((edge) =>
      edge.rule_id === fixture.rule_id
        && edge.rule_version === fixture.rule_version
        && edge.source_node_occurrence_id === fixture.source_node_occurrence_id
        && fixture.target_node_occurrence_ids.includes(edge.target_node_occurrence_id));
    const allFixtureSourceEdges = compilation.scope_edges.filter((edge) =>
      edge.rule_id === fixture.rule_id
        && edge.rule_version === fixture.rule_version
        && edge.source_node_occurrence_id === fixture.source_node_occurrence_id);
    assert.equal(edges.length, fixture.expected_edge_count, fixture.rule_id);
    assert.equal(allFixtureSourceEdges.length, edges.length,
      `${fixture.rule_id} has no out-of-fixture target`);
    assert.deepEqual([...new Set(edges.map((edge) => edge.target_node_occurrence_id))],
      fixture.target_node_occurrence_ids);
    for (const edge of edges) {
      const targetOrdinal = fixture.target_node_occurrence_ids
        .indexOf(edge.target_node_occurrence_id);
      assert.equal(edge.source_node_occurrence_id, fixture.source_node_occurrence_id);
      assert.ok(fixture.governing_roles.includes(edge.governing_role));
      assertSpan(INDEXES_BY_DEAL.get(binding.deal).index, edge.governing_source_span);
      assert.ok(edge.governing_source_span.start_byte >= fixture.source_span.start_byte);
      assert.ok(edge.governing_source_span.end_byte <= fixture.source_span.end_byte);
      assert.equal(edge.proof.proof_kind, fixture.proof_kind);
      assert.equal(edge.edge_kind, fixture.edge_kind);
      assert.deepEqual(edge.proof.source_extent_span, fixture.source_span);
      assert.deepEqual(edge.proof.target_extent_span, fixture.target_spans[targetOrdinal]);
      assert.deepEqual(edge.proof.connective_span, fixture.connective_span);
      assert.deepEqual(edge.proof.ordered_target_node_occurrence_ids,
        fixture.target_node_occurrence_ids);
    }
  }
  const metsera = semanticPolicy.fixture_scope_rules.filter((fixture) =>
    fixture.rule_id === 'METSERA_7_04_PARENT_SENTENCE_SCOPE/V1');
  assert.equal(metsera.length, 2);
  assert.equal(new Set(metsera.map((fixture) => fixture.source_node_occurrence_id)).size, 2);
  assert.ok(metsera.every((fixture) => fixture.target_node_occurrence_ids.length === 1));
});

test('Concho 6.20 emits two CAUSES_TO_PERFORM edges and never infers control', () => {
  const fixture = semanticPolicy.input_contract.topology_fixture;
  const compilation = fullCompilation('concho');
  const relationships = compilation.semantic_relationships.filter((relationship) =>
    relationship.source_node_occurrence_ids.includes(fixture.source_node_occurrence_id));
  const causes = relationships.filter((relationship) =>
    relationship.relationship_type === fixture.relationship_type);
  assert.equal(causes.length, 2);
  assert.ok(causes.every((relationship) => relationship.directed
    && relationship.source_endpoint.entity_id === fixture.source_endpoint.entity_id));
  assert.deepEqual(causes.map((relationship) => relationship.target_endpoint.entity_id).sort(),
    fixture.target_endpoints.map((endpoint) => endpoint.entity_id).sort());
  assert.equal(relationships.some((relationship) =>
    fixture.forbidden_relationship_types.includes(relationship.relationship_type)), false);
});

test('TopBuild 6.3 records four upstream annotation omissions without invented reference edges', () => {
  const compilation = fullCompilation('topbuild');
  const omissions = semanticPolicy.reference_resolution_contract.upstream_annotation_omissions;
  const diagnostics = compilation.diagnostics.filter((diagnostic) =>
    diagnostic.diagnostic_type === 'UPSTREAM_REFERENCE_ANNOTATION_ABSENT');
  assert.equal(diagnostics.length, 4);
  for (const omission of omissions) {
    assert.ok(diagnostics.some((diagnostic) =>
      diagnostic.source_node_occurrence_ids.includes(omission.owner_node_occurrence_id)
        && diagnostic.source_spans.some((span) =>
          span.start_byte === omission.source_span.start_byte
            && span.end_byte === omission.source_span.end_byte)));
    assert.equal(compilation.reference_edges.some((edge) =>
      edge.source_span.start_byte === omission.source_span.start_byte
        && edge.source_span.end_byte === omission.source_span.end_byte), false);
  }
});

test('heading-owned definition residuals use the nearest focus or container fallback', () => {
  const { index } = INDEXES_BY_DEAL.get('metsera');
  const compilation = fullCompilation('metsera');
  const nodesById = new Map(index.nodes.map((node) => [node.node_occurrence_id, node]));
  const focusNodes = deriveFocusNodes(index);
  const headingEdges = compilation.definition_edges.filter((edge) =>
    edge.state === 'AMBIGUOUS'
      && nodesById.get(edge.owner_node_occurrence_id).node_kind === 'HEADING');
  assert.equal(headingEdges.length, 12);
  for (const edge of headingEdges) {
    const owner = nodesById.get(edge.owner_node_occurrence_id);
    let expected = null;
    let ancestor = owner.parent_node_occurrence_id === null
      ? null
      : nodesById.get(owner.parent_node_occurrence_id);
    while (ancestor) {
      if (compilation.frames_by_focus_node_id[ancestor.node_occurrence_id]) {
        expected = ancestor;
        break;
      }
      ancestor = ancestor.parent_node_occurrence_id === null
        ? null
        : nodesById.get(ancestor.parent_node_occurrence_id);
    }
    let container = nodesById.get(owner.parent_node_occurrence_id);
    while (container && !['SECTION', 'ARTICLE', 'AGREEMENT'].includes(container.node_kind)) {
      container = container.parent_node_occurrence_id === null
        ? null
        : nodesById.get(container.parent_node_occurrence_id);
    }
    assert.ok(container);
    const inside = (node) => {
      let current = node;
      while (current && current.parent_node_occurrence_id !== null) {
        if (current.parent_node_occurrence_id === container.node_occurrence_id) return true;
        current = nodesById.get(current.parent_node_occurrence_id);
      }
      return false;
    };
    if (!expected) {
      expected = focusNodes.find((node) =>
        inside(node) && node.extent_span.start_byte >= owner.extent_span.end_byte);
    }
    const residual = compilation.residuals.find((record) =>
      record.residual_kind === 'DEFINITION_TARGET_UNAVAILABLE'
        && record.blocked_dependency_ids.includes(edge.definition_edge_id));
    assert.ok(expected);
    assert.equal(residual.focus_node_occurrence_id, expected.node_occurrence_id);
  }
});

test('semantic captures and connective scopes exclude source artefact bytes', () => {
  let structurallyCrossingEdgeCount = 0;
  let omittedQualificationCaptureCount = 0;
  for (const [deal, { index }] of INDEXES_BY_DEAL) {
    const compilation = fullCompilation(deal);
    const overlapsArtefact = (span) => index.source_artefacts.some((artefact) =>
      span.start_byte < artefact.span.end_byte && span.end_byte > artefact.span.start_byte);
    assert.ok(compilation.context_facts.every((fact) => !overlapsArtefact(fact.source_span)));
    for (const edge of compilation.scope_edges.filter((record) =>
      record.proof.connective_span !== null)) {
      assert.equal(overlapsArtefact(edge.proof.connective_span), false);
      if (overlapsArtefact(edge.proof.source_extent_span)) structurallyCrossingEdgeCount += 1;
    }
    for (const fixture of semanticPolicy.fixture_scope_rules.filter((entry) =>
      entry.agreement_id === index.source_binding.agreement_id
        && entry.governing_roles.includes('CONNECTIVE')
        && overlapsArtefact(entry.source_span))) {
      const connectiveFacts = compilation.context_facts.filter((fact) =>
        fact.source_node_occurrence_id === fixture.source_node_occurrence_id
          && fact.rule_id === 'EXACT_CONNECTIVE_CAPTURE/V1'
          && fact.role === 'CONNECTIVE'
          && fact.source_span.start_byte === fixture.connective_span.start_byte
          && fact.source_span.end_byte === fixture.connective_span.end_byte);
      assert.ok(connectiveFacts.length > 0, `${fixture.rule_id} connective capture`);
      assert.equal(compilation.context_facts.some((fact) =>
        fact.source_node_occurrence_id === fixture.source_node_occurrence_id
          && fact.rule_id === 'EXACT_QUALIFICATION_TEXT/V1'
          && fact.role === 'SCOPE'), false, `${fixture.rule_id} split capture omitted`);
      omittedQualificationCaptureCount += 1;
    }
  }
  assert.ok(structurallyCrossingEdgeCount > 0);
  assert.ok(omittedQualificationCaptureCount > 0);
});

test('M3 has no inferred override and constructs overlap conflicts without selection', () => {
  const facts = [...INDEXES_BY_DEAL.keys()].flatMap((deal) =>
    fullCompilation(deal).context_facts);
  assert.equal(facts.filter((fact) => fact.state === 'OVERRIDDEN').length, 0);
  assert.ok(facts.every((fact) => fact.overridden_fact_ids.length === 0));

  const { index } = INDEXES_BY_DEAL.get('topbuild');
  const target = index.nodes.find((node) => node.node_occurrence_id === LIMBS[2].node_occurrence_id);
  const text = sourceSlice(index, target.extent_span).toString('utf8');
  const wordMatch = /[A-Za-z]+\s+[A-Za-z]+/.exec(text);
  assert.ok(wordMatch);
  const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const priority = Math.max(...semanticPolicy.capture_rules.map((rule) => rule.priority)) + 1;
  const makeRule = (ruleId, capturedText) => ({
    rule_id: ruleId,
    rule_version: 1,
    priority,
    applies_to_node_kinds: [target.node_kind],
    source_byte_mode: 'AUTHORED_BYTES_EXCLUDING_SOURCE_ARTEFACTS',
    match_mode: 'FULL',
    pattern: `^(?:${escape(text.slice(0, wordMatch.index))})(?<slot>${escape(capturedText)})(?:${escape(text.slice(wordMatch.index + capturedText.length))})$`,
    pattern_flags: 'u',
    capture_roles: [{
      capture_name: 'slot', role: 'OBJECT', value_mode: 'EXACT_SOURCE_TEXT', occurrence: 1,
    }],
    required_source_roles: [],
    blocked_by_m2_ambiguity: false,
  });
  const firstWord = wordMatch[0].split(/\s+/)[0];
  const conflictPolicy = structuredClone(semanticPolicy);
  conflictPolicy.capture_rules.push(
    makeRule('TEST_OVERLAP_NARROW/V1', firstWord),
    makeRule('TEST_OVERLAP_WIDE/V1', wordMatch[0]),
  );
  recomputePolicyDigest(conflictPolicy);
  const conflict = compile(index, conflictPolicy);
  const ambiguity = conflict.ambiguities.find((record) =>
    record.ambiguity_type === 'CONTEXT_CAPTURE_CONFLICT'
      && record.target_node_occurrence_ids.includes(target.node_occurrence_id));
  assert.ok(ambiguity);
  assert.equal(ambiguity.state, 'OPEN');
  assert.equal(ambiguity.alternative_fact_ids.length, 2);
  const alternatives = conflict.context_facts.filter((fact) =>
    ambiguity.alternative_fact_ids.includes(fact.context_fact_id));
  assert.equal(alternatives.length, 2);
  assert.ok(alternatives.every((fact) => fact.state === 'AMBIGUOUS'
    && fact.overridden_fact_ids.length === 0));
});

test('competing exact fixture target sets remain ambiguous and do not propagate facts', () => {
  const { index } = INDEXES_BY_DEAL.get('topbuild');
  const conflictPolicy = structuredClone(semanticPolicy);
  const fixture = conflictPolicy.fixture_scope_rules.find((entry) =>
    entry.rule_id === RULE_ID && entry.source_node_occurrence_id === CHAPEAU_ID);
  fixture.governing_roles = ['OBJECT'];
  fixture.expected_edge_count = fixture.target_node_occurrence_ids.length;
  const alternative = structuredClone(fixture);
  alternative.rule_id = 'TEST_COMPETING_TOPBUILD_6_2_SCOPE/V1';
  alternative.target_node_occurrence_ids = [fixture.target_node_occurrence_ids[0]];
  alternative.target_spans = [fixture.target_spans[0]];
  alternative.expected_edge_count = 1;
  alternative.legal_ruling_code = 'TEST_ONLY_COMPETING_SCOPE_READING';
  conflictPolicy.fixture_scope_rules.push(alternative);
  recomputePolicyDigest(conflictPolicy);
  const conflict = compile(index, conflictPolicy);
  const ambiguity = conflict.ambiguities.find((record) =>
    record.ambiguity_type === 'MULTIPLE_SCOPE_READINGS'
      && record.source_node_occurrence_ids.includes(CHAPEAU_ID)
      && record.affected_roles.includes('OBJECT'));
  assert.ok(ambiguity);
  const competingEdges = conflict.scope_edges.filter((edge) =>
    ambiguity.alternative_scope_edge_ids.includes(edge.scope_edge_id));
  assert.equal(competingEdges.length, fixture.target_node_occurrence_ids.length + 1);
  assert.ok(competingEdges.every((edge) => edge.state === 'AMBIGUOUS'
    && [fixture.rule_id, alternative.rule_id].includes(edge.rule_id)));
  assert.deepEqual([...new Set(competingEdges.map((edge) => edge.target_node_occurrence_id))]
    .sort(), [...ambiguity.alternative_target_ids].sort());
  assert.deepEqual(ambiguity.blocked_dependency_ids, []);
  assert.equal(conflict.context_facts.some((fact) =>
    fact.state === 'INHERITED'
      && fact.source_node_occurrence_id === CHAPEAU_ID
      && fact.role === 'OBJECT'
      && ambiguity.alternative_target_ids.includes(fact.target_node_occurrence_id)), false);
  assert.equal(conflict.ambiguities.filter((record) =>
    record.ambiguity_type === 'MULTIPLE_SCOPE_READINGS'
      && record.source_node_occurrence_ids.includes(CHAPEAU_ID)
      && record.affected_roles.includes('OBJECT')).length, 1);
  assert.equal(conflict.residuals.some((residual) =>
    residual.residual_kind === 'NO_SCOPE_PROOF'
      && residual.source_node_occurrence_ids.includes(CHAPEAU_ID)
      && residual.affected_roles.includes('OBJECT')), false);
  assert.equal(conflict.diagnostics.filter((diagnostic) =>
    diagnostic.diagnostic_type === 'CONTEXT_AMBIGUITY_RECORDED'
      && diagnostic.related_ids.includes(ambiguity.ambiguity_id)).length, 1);
});

test('overlapping equal-priority topology readings fail closed without a resolved winner', () => {
  const { index } = INDEXES_BY_DEAL.get('concho');
  const fixture = semanticPolicy.input_contract.topology_fixture;
  const baseline = fullCompilation('concho');
  assert.equal(baseline.semantic_relationships.filter((relationship) =>
    relationship.relationship_type === 'CAUSES_TO_PERFORM'
      && relationship.source_node_occurrence_ids.includes(fixture.source_node_occurrence_id)
      && relationship.state === 'RESOLVED').length, 2);

  const conflictPolicy = structuredClone(semanticPolicy);
  const existingRule = conflictPolicy.topology_rules.find((rule) =>
    rule.rule_id === 'EXACT_CAUSES_TO_PERFORM/V1');
  const conflictRule = {
    ...structuredClone(existingRule),
    rule_id: 'TEST_OVERLAPPING_CAUSES_TO_PERFORM/V1',
    pattern: '^(?<source>Parent) shall take all action necessary to cause (?<target>Merger Sub and) the Surviving Corporation to perform their respective obligations under this Agreement\\.$',
  };
  conflictPolicy.topology_rules.push(conflictRule);
  const execution = conflictPolicy.input_contract.topology_rule_execution.find((entry) =>
    entry.rule_id === existingRule.rule_id);
  conflictPolicy.input_contract.topology_rule_execution.push({
    ...structuredClone(execution),
    rule_id: conflictRule.rule_id,
  });
  recomputePolicyDigest(conflictPolicy);
  const conflict = compile(index, conflictPolicy);
  const relationships = conflict.semantic_relationships.filter((relationship) =>
    relationship.source_node_occurrence_ids.includes(fixture.source_node_occurrence_id)
      && [existingRule.rule_id, conflictRule.rule_id].includes(relationship.rule_id));
  assert.equal(relationships.length, 2);
  assert.ok(relationships.every((relationship) =>
    relationship.relationship_type === 'CAUSES_TO_PERFORM'
      && relationship.directed
      && relationship.state === 'AMBIGUOUS'
      && relationship.reason_code === 'TOPOLOGY_SOURCE_CONFLICT'));
  for (const relationship of relationships) {
    assertRecordIdentity(relationship, 'semantic_relationship_id');
  }
  assert.equal(new Set(relationships.map((relationship) => canonicalJson({
    source_endpoint_entity_id: relationship.source_endpoint.entity_id,
    target_endpoint_entity_id: relationship.target_endpoint.entity_id,
    temporal_scope: relationship.temporal_scope,
  }))).size, 2);
  assert.equal(relationships.some((relationship) => relationship.state === 'RESOLVED'), false);
  assert.equal(conflict.semantic_relationships.filter((relationship) =>
    relationship.rule_id === 'CONCHO_6_20_SECOND_CAUSES_TO_PERFORM/V1'
      && relationship.source_node_occurrence_ids.includes(fixture.source_node_occurrence_id)
      && relationship.state === 'RESOLVED').length, 1);

  const ambiguity = conflict.ambiguities.find((record) =>
    record.ambiguity_type === 'TOPOLOGY_SOURCE_CONFLICT'
      && record.source_node_occurrence_ids.includes(fixture.source_node_occurrence_id));
  assert.ok(ambiguity);
  assertRecordIdentity(ambiguity, 'ambiguity_id');
  assert.deepEqual(ambiguity.blocked_dependency_ids,
    conflict.semantic_relationships
      .filter((relationship) => relationships.some((candidate) =>
        candidate.semantic_relationship_id === relationship.semantic_relationship_id))
      .map((relationship) => relationship.semantic_relationship_id));
  assert.deepEqual(ambiguity.source_node_occurrence_ids,
    [...new Set(relationships.flatMap((relationship) =>
      relationship.source_node_occurrence_ids))]);
  const sourceSpans = [...new Map(relationships.flatMap((relationship) =>
    relationship.source_spans).map((span) => [canonicalJson(span), span])).values()]
    .sort((left, right) => left.start_byte - right.start_byte
      || left.end_byte - right.end_byte
      || left.text_sha256.localeCompare(right.text_sha256));
  assert.deepEqual(ambiguity.source_spans, sourceSpans);
  const endpointIds = [...new Set(relationships.flatMap((relationship) => [
    relationship.source_endpoint.entity_id,
    relationship.target_endpoint.entity_id,
  ]))].sort();
  assert.deepEqual(ambiguity.alternative_target_ids, endpointIds);
  assert.equal(conflict.ambiguities.filter((record) =>
    record.ambiguity_type === 'TOPOLOGY_SOURCE_CONFLICT'
      && record.source_node_occurrence_ids.includes(fixture.source_node_occurrence_id)).length, 1);
  assert.equal(conflict.diagnostics.filter((diagnostic) =>
    diagnostic.diagnostic_type === 'CONTEXT_AMBIGUITY_RECORDED'
      && diagnostic.related_ids.includes(ambiguity.ambiguity_id)).length, 1);
  assert.equal(conflict.diagnostics.filter((diagnostic) =>
    diagnostic.diagnostic_type === 'TOPOLOGY_AMBIGUOUS'
      && diagnostic.related_ids.includes(ambiguity.ambiguity_id)).length, 1);
  assert.equal(conflict.residuals.some((residual) =>
    residual.reason_code === 'TOPOLOGY_SOURCE_CONFLICT'), false);
  for (const relationship of relationships) {
    assert.equal(conflict.residuals.filter((residual) =>
      residual.residual_kind === 'TEMPORAL_SCOPE_UNSTATED'
        && residual.blocked_dependency_ids.includes(relationship.semantic_relationship_id)).length, 1);
  }
});

test('inventory drift and closed-output duplicate, dangling, cross-agreement, order and identity drift fail', () => {
  const { index } = INDEXES_BY_DEAL.get('topbuild');
  const driftedReferencePolicy = structuredClone(semanticPolicy);
  driftedReferencePolicy.reference_resolution_contract.per_agreement_expected
    .find((entry) => entry.agreement_id === index.source_binding.agreement_id)
    .annotation_count += 1;
  recomputePolicyDigest(driftedReferencePolicy);
  assertCode('CONTEXT_COMPILATION_REFERENCE_INVENTORY_MISMATCH', () =>
    compile(index, driftedReferencePolicy));

  const driftedDefinitionPolicy = structuredClone(semanticPolicy);
  driftedDefinitionPolicy.definition_resolution_contract.per_agreement_expected
    .find((entry) => entry.agreement_id === index.source_binding.agreement_id)
    .uses += 1;
  recomputePolicyDigest(driftedDefinitionPolicy);
  assertCode('CONTEXT_COMPILATION_DEFINITION_INVENTORY_MISMATCH', () =>
    compile(index, driftedDefinitionPolicy));

  const valid = fullCompilation('topbuild');
  const duplicate = structuredClone(valid);
  duplicate.context_facts[1].context_fact_id = duplicate.context_facts[0].context_fact_id;
  assert.throws(() => assertCompilationContract(duplicate, index));

  const dangling = structuredClone(valid);
  dangling.frames_by_focus_node_id[dangling.focus_node_occurrence_ids[0]]
    .context_fact_ids.push('0'.repeat(64));
  assert.throws(() => assertCompilationContract(dangling, index));

  const crossAgreement = structuredClone(valid);
  crossAgreement.reference_edges[0].target_node_occurrence_ids = [
    conchoAgreementIndex.root_node_occurrence_id,
  ];
  assert.throws(() => assertCompilationContract(crossAgreement, index));

  const unordered = structuredClone(valid);
  unordered.reference_edges.reverse();
  assert.throws(() => assertCompilationContract(unordered, index));

  const wrongIdentity = structuredClone(valid);
  wrongIdentity.residuals[0].residual_id = 'f'.repeat(64);
  assert.throws(() => assertCompilationContract(wrongIdentity, index));
});

test('all seven outputs are byte-deterministic and compilation has zero current-system effects', () => {
  for (const [deal, { index }] of INDEXES_BY_DEAL) {
    const first = Buffer.from(`${canonicalJson(fullCompilation(deal))}\n`, 'utf8');
    const second = Buffer.from(`${canonicalJson(compile(index))}\n`, 'utf8');
    assert.deepEqual(second, first, `${deal} deterministic bytes`);
  }
  for (const [relativePath, before] of Object.entries(CURRENT_STATE_HASHES)) {
    assert.equal(sha256Hex(fs.readFileSync(path.join(ROOT, relativePath))), before, relativePath);
  }
  assert.equal(m3Authority.zero_effect_expectations.model_calls, 0);
  assert.equal(m3Authority.zero_effect_expectations.phase_b_route_calls, 0);
  assert.equal(m3Authority.zero_effect_expectations.network_calls, 0);
  assert.ok(Object.entries(m3Authority.zero_effect_expectations)
    .filter(([, value]) => typeof value === 'boolean')
    .every(([, value]) => value));
});
