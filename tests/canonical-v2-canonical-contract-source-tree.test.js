const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  canonicalJson,
  sha256Hex,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  compileCanonicalContractInput,
} = require('../lib/canonical-v2/canonical-contract-input-compiler');
const {
  FIXTURE_CONTRACT_INPUT_V12,
  USES_DEFINITION_EFFECT_SCHEMA_V3,
} = require('../lib/canonical-v2/contract-bundle');

const sourceRoot = path.join(
  __dirname,
  '..',
  'contracts',
  'canonical-v2',
  'successor',
);

function jsonMembers(directory, relativeDirectory = '') {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = relativeDirectory
      ? `${relativeDirectory}/${entry.name}`
      : entry.name;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return jsonMembers(absolutePath, relativePath);
    if (entry.isFile() && entry.name.endsWith('.json') && relativePath !== 'manifest.json') {
      return [relativePath];
    }
    return [];
  }).sort();
}

function authoredPayloads(compiled, objectKind, keyField, schemaVersion) {
  return compiled.authored_members
    .filter((member) => member.object_kind === objectKind)
    .map((member) => {
      const {
        object_kind: valueObjectKind,
        stable_id: stableId,
        schema_version: valueSchemaVersion,
        ...payload
      } = member.canonical_value;
      assert.equal(valueObjectKind, objectKind);
      assert.equal(stableId, payload[keyField]);
      assert.equal(valueSchemaVersion, schemaVersion);
      return payload;
    })
    .sort((left, right) => left[keyField].localeCompare(right[keyField]));
}

function authoredPolicyPayload(compiled, objectKind, stableId, schemaVersion) {
  const members = compiled.authored_members
    .filter((member) => member.object_kind === objectKind);
  assert.equal(members.length, 1);
  const {
    object_kind: valueObjectKind,
    stable_id: valueStableId,
    ...payload
  } = members[0].canonical_value;
  assert.equal(valueObjectKind, objectKind);
  assert.equal(valueStableId, stableId);
  assert.equal(payload.schema_version, schemaVersion);
  return payload;
}

test('the single successor source compiles twice byte-identically as a complete authored universe without freeze authority', () => {
  const first = compileCanonicalContractInput({ root_directory: sourceRoot });
  const second = compileCanonicalContractInput({ root_directory: sourceRoot });

  assert.equal(canonicalJson(first), canonicalJson(second));
  assert.equal(first.authored_members.length, 168);
  assert.equal(
    first.authored_members.some(
      (member) => member.object_kind === 'CANONICAL_BUNDLE_INPUT_REQUIRED_KIND_REGISTRY',
    ),
    true,
  );
  assert.equal(
    first.authored_universe_assessment.status,
    'COMPLETE_AGAINST_GOVERNED_REQUIRED_KIND_REGISTRY',
  );
  assert.equal(
    first.authored_universe_assessment.required_kind_registry_binding.stable_id,
    'CANONICAL_BUNDLE_INPUT_REQUIRED_KIND_REGISTRY',
  );
  assert.equal(
    first.authored_universe_assessment.ordered_kind_results.every(
      (entry) => entry.status === 'PASS',
    ),
    true,
  );
  assert.equal(first.disposition.status, 'AUTHORED_UNIVERSE_MECHANICALLY_COMPLETE');
  assert.equal(first.disposition.reason_code, 'BUNDLE_GENERATION_AND_FREEZE_NOT_EVALUATED');
  assert.equal(first.disposition.freeze_eligible, false);
  assert.equal(first.disposition.canonical_contract_bundle_authority, 'NONE');
  assert.equal(first.disposition.p1_gate_status, 'NOT_EVALUATED');
  assert.equal(Object.hasOwn(first, 'canonical_contract_bundle'), false);
});

test('the authored claims preserve every exact V12 payload and add only the three governed successors', () => {
  const compiled = compileCanonicalContractInput({ root_directory: sourceRoot });
  const actual = authoredPayloads(
    compiled,
    'CLAIM_DEFINITION',
    'claim_definition_key',
    'CLAIM_DEFINITION/V1',
  );
  const expected = [...FIXTURE_CONTRACT_INPUT_V12.claim_definitions]
    .sort((left, right) => left.claim_definition_key.localeCompare(right.claim_definition_key));

  assert.equal(actual.length, 16);
  assert.equal(
    canonicalJson(actual.filter((entry) => expected.some(
      (candidate) => candidate.claim_definition_key === entry.claim_definition_key,
    ))),
    canonicalJson(expected),
  );
  assert.deepEqual(
    actual.filter((entry) => !expected.some(
      (candidate) => candidate.claim_definition_key === entry.claim_definition_key,
    )).map((entry) => entry.claim_definition_key),
    [
      'GENERAL_MATERIALITY_QUALIFIER',
      'REPRESENTATION_MEASUREMENT_DATE',
      'RETROSPECTIVE_LOOKBACK',
    ],
  );
});

test('every authored component is the exact existing V12 payload under the required envelope', () => {
  const compiled = compileCanonicalContractInput({ root_directory: sourceRoot });
  const actual = authoredPayloads(
    compiled,
    'COMPONENT_DEFINITION',
    'component_key',
    'COMPONENT_DEFINITION/V1',
  );
  const expected = [...FIXTURE_CONTRACT_INPUT_V12.component_definitions]
    .sort((left, right) => left.component_key.localeCompare(right.component_key));

  assert.equal(actual.length, 9);
  assert.equal(canonicalJson(actual), canonicalJson(expected));
});

test('every authored concept is the exact existing V12 payload under the required envelope', () => {
  const compiled = compileCanonicalContractInput({ root_directory: sourceRoot });
  const actual = authoredPayloads(
    compiled,
    'PROVISION_CONCEPT',
    'concept_key',
    'PROVISION_CONCEPT/V1',
  );
  const expected = [...FIXTURE_CONTRACT_INPUT_V12.concepts]
    .sort((left, right) => left.concept_key.localeCompare(right.concept_key));

  assert.equal(actual.length, 19);
  assert.equal(canonicalJson(actual), canonicalJson(expected));
});

test('the authored relationships preserve USES_DEFINITION and add four successor schemas', () => {
  const compiled = compileCanonicalContractInput({ root_directory: sourceRoot });
  const actual = authoredPayloads(
    compiled,
    'RELATIONSHIP_DEFINITION',
    'relationship_key',
    'RELATIONSHIP_DEFINITION/V1',
  );
  assert.equal(actual.length, 5);
  assert.deepEqual(actual.map((entry) => [
    entry.relationship_key,
    entry.effect_mode,
    entry.version,
    entry.effect_schema,
  ]), [
    ['BRINGS_DOWN', 'TYPED_LEGAL_EFFECT', 3, 'BRINGS_DOWN_EFFECT/V2'],
    ['CONTAINED_IN', 'NON_SEMANTIC', 2, 'CONTAINED_IN_EFFECT/V1'],
    ['EXCEPTED_BY', 'TYPED_LEGAL_EFFECT', 3, 'EXCEPTED_BY_EFFECT/V1'],
    ['TRIGGERED_BY', 'TYPED_LEGAL_EFFECT', 2, 'TERMINATION_FEE_TRIGGER_EFFECT/V2'],
    ['USES_DEFINITION', 'TYPED_LEGAL_EFFECT', 4, 'USES_DEFINITION_EFFECT/V3'],
  ]);
  assert.deepEqual(
    FIXTURE_CONTRACT_INPUT_V12.relationship_definitions
      .filter((entry) => !actual.some(
        (authored) => authored.relationship_key === entry.relationship_key,
      ))
      .map((entry) => entry.relationship_key)
      .sort(),
    [],
  );
});

test('the authored relationship effect schemas select one closed schema each', () => {
  const compiled = compileCanonicalContractInput({ root_directory: sourceRoot });
  const members = compiled.authored_members.filter(
    (member) => member.object_kind === 'RELATIONSHIP_EFFECT_SCHEMA',
  );

  assert.equal(members.length, 5);
  const member = members.find(
    (entry) => entry.canonical_value.effect_schema_key === 'USES_DEFINITION_EFFECT',
  ).canonical_value;
  assert.equal(member.object_kind, 'RELATIONSHIP_EFFECT_SCHEMA');
  assert.equal(member.stable_id, 'USES_DEFINITION_EFFECT');
  assert.equal(member.schema_version, 'RELATIONSHIP_EFFECT_SCHEMA/V1');
  assert.equal(member.effect_schema_key, 'USES_DEFINITION_EFFECT');
  assert.equal(member.effect_schema_version, 3);
  assert.equal(
    `${member.effect_schema_key}/V${member.effect_schema_version}`,
    'USES_DEFINITION_EFFECT/V3',
  );
  assert.equal(
    canonicalJson(member.definition),
    canonicalJson(USES_DEFINITION_EFFECT_SCHEMA_V3),
  );
  assert.deepEqual(
    members.map((entry) => [
      entry.canonical_value.effect_schema_key,
      entry.canonical_value.effect_schema_version,
    ]).sort((left, right) => left[0].localeCompare(right[0])),
    [
      ['BRINGS_DOWN_EFFECT', 2],
      ['CONTAINED_IN_EFFECT', 1],
      ['EXCEPTED_BY_EFFECT', 1],
      ['TERMINATION_FEE_TRIGGER_EFFECT', 2],
      ['USES_DEFINITION_EFFECT', 3],
    ],
  );
});

test('the compiler refuses the authored relationship when its effect schema is absent', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'canonical-relationship-input-'));
  fs.cpSync(sourceRoot, root, { recursive: true });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const effectPath = 'agreement/relationship-effect-schemas/uses-definition-effect.v3.json';
  fs.rmSync(path.join(root, ...effectPath.split('/')));
  const manifestPath = path.join(root, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.members = manifest.members.filter((member) => member.relative_path !== effectPath);
  manifest.per_kind_counts.RELATIONSHIP_EFFECT_SCHEMA = 4;
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  assert.throws(
    () => compileCanonicalContractInput({ root_directory: root }),
    (error) => error?.code === 'CANONICAL_BUNDLE_RELATIONSHIP_EFFECT_REFERENCE_UNRESOLVED',
  );
});

test('no-shop semantic inputs preserve V12 except governed successors', () => {
  const compiled = compileCanonicalContractInput({ root_directory: sourceRoot });
  const members = compiled.authored_members.filter(
    (member) => member.object_kind === 'NO_SHOP_SEMANTIC_SCHEMA_INPUT',
  );
  const expected = [...FIXTURE_CONTRACT_INPUT_V12.no_shop_semantic_schemas]
    .sort((left, right) => left.schema_key.localeCompare(right.schema_key));

  assert.equal(members.length, 5);
  const actual = members.map((member) => {
    const value = member.canonical_value;
    assert.deepEqual(Object.keys(value).sort(), [
      'authored_schema',
      'object_kind',
      'schema_version',
      'stable_id',
    ]);
    assert.equal(value.object_kind, 'NO_SHOP_SEMANTIC_SCHEMA_INPUT');
    assert.equal(value.schema_version, 'NO_SHOP_SEMANTIC_SCHEMA_INPUT/V1');
    assert.equal(value.stable_id, value.authored_schema.schema_key);
    assert.equal(Object.hasOwn(value, 'semantic_schema_key'), false);
    assert.equal(Object.hasOwn(value, 'semantic_schema_version'), false);
    assert.equal(Object.hasOwn(value, 'semantic_schema_definition_id'), false);
    assert.equal(
      Object.hasOwn(value, 'semantic_schema_definition_payload_digest'),
      false,
    );
    return value.authored_schema;
  }).sort((left, right) => left.schema_key.localeCompare(right.schema_key));

  assert.deepEqual(
    actual.map((entry) => [entry.schema_key, entry.schema_version]),
    [
      ['NO_SHOP_ACTION_COMPARISON_ROLLUP', 1],
      ['NO_SHOP_ACTION_OCCURRENCE', 1],
      ['NO_SHOP_EXCEPTION_EFFECT', 1],
      ['NO_SHOP_INLINE_PERMISSION_EFFECT', 1],
      ['NO_SHOP_NOTICE_OBLIGATION', 6],
    ],
  );
  const unchangedKeys = new Set([
    'NO_SHOP_ACTION_COMPARISON_ROLLUP',
    'NO_SHOP_ACTION_OCCURRENCE',
  ]);
  assert.equal(
    canonicalJson(actual.filter((entry) => unchangedKeys.has(entry.schema_key))),
    canonicalJson(expected.filter((entry) => unchangedKeys.has(entry.schema_key))),
  );
  assert.notEqual(
    canonicalJson(actual.filter((entry) => !unchangedKeys.has(entry.schema_key))),
    canonicalJson(expected.filter((entry) => !unchangedKeys.has(entry.schema_key))),
  );
});

test('every serving metric-operation binding input preserves the exact nested V12 source', () => {
  const compiled = compileCanonicalContractInput({ root_directory: sourceRoot });
  const members = compiled.authored_members.filter(
    (member) => member.object_kind === 'SERVING_METRIC_OPERATION_BINDING_INPUT',
  );
  const expected = [...FIXTURE_CONTRACT_INPUT_V12.serving_metric_operation_bindings]
    .sort((left, right) => left.binding_key.localeCompare(right.binding_key));

  assert.equal(members.length, 2);
  const actual = members.map((member) => {
    const value = member.canonical_value;
    assert.deepEqual(Object.keys(value).sort(), [
      'authored_binding',
      'object_kind',
      'schema_version',
      'stable_id',
    ]);
    assert.equal(value.object_kind, 'SERVING_METRIC_OPERATION_BINDING_INPUT');
    assert.equal(value.schema_version, 'SERVING_METRIC_OPERATION_BINDING_INPUT/V1');
    assert.equal(value.stable_id, value.authored_binding.binding_key);
    assert.equal(Object.hasOwn(value, 'metric_operation_binding_definition_id'), false);
    assert.equal(
      Object.hasOwn(value, 'metric_operation_binding_definition_payload_digest'),
      false,
    );
    return value.authored_binding;
  }).sort((left, right) => left.binding_key.localeCompare(right.binding_key));

  assert.deepEqual(
    actual.map((entry) => [
      entry.binding_key,
      entry.metric_version,
      entry.trigger_path_schema_version,
    ]),
    [
      ['BUYER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE/V2', 1, 2],
      ['SELLER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE/V2', 1, 2],
    ],
  );
  assert.equal(canonicalJson(actual), canonicalJson(expected));
});

test('the serving trigger-path schema input preserves the exact nested V12 source', () => {
  const compiled = compileCanonicalContractInput({ root_directory: sourceRoot });
  const members = compiled.authored_members.filter(
    (member) => member.object_kind === 'SERVING_TRIGGER_PATH_SCHEMA_INPUT',
  );

  assert.equal(members.length, 1);
  const value = members[0].canonical_value;
  assert.deepEqual(Object.keys(value).sort(), [
    'authored_schema',
    'object_kind',
    'schema_version',
    'stable_id',
  ]);
  assert.equal(value.object_kind, 'SERVING_TRIGGER_PATH_SCHEMA_INPUT');
  assert.equal(value.schema_version, 'SERVING_TRIGGER_PATH_SCHEMA_INPUT/V1');
  assert.equal(value.stable_id, value.authored_schema.schema_key);
  assert.equal(value.authored_schema.schema_key, 'TERMINATION_FEE_TRIGGER_PATH');
  assert.equal(value.authored_schema.schema_version, 2);
  assert.equal(
    canonicalJson(value.authored_schema),
    canonicalJson(FIXTURE_CONTRACT_INPUT_V12.serving_trigger_path_schemas[0]),
  );
  assert.equal(Object.hasOwn(value, 'trigger_path_schema_key'), false);
  assert.equal(Object.hasOwn(value, 'trigger_path_schema_version'), false);
  assert.equal(Object.hasOwn(value, 'trigger_path_schema_definition_id'), false);
  assert.equal(
    Object.hasOwn(value, 'trigger_path_schema_definition_payload_digest'),
    false,
  );
});

test('the three migration-only codebook and tuple inputs preserve exact V12 order', () => {
  const compiled = compileCanonicalContractInput({ root_directory: sourceRoot });
  const configs = [
    {
      object_kind: 'CLAIM_STATE_CODEBOOK_MIGRATION_INPUT',
      stable_id: 'FIXTURE_CONTRACT_INPUT_V12_CLAIM_STATES',
      ordered_field: 'ordered_values',
      expected: FIXTURE_CONTRACT_INPUT_V12.claim_states,
    },
    {
      object_kind: 'PARTY_TUPLE_SHAPE_MIGRATION_INPUT',
      stable_id: 'FIXTURE_CONTRACT_INPUT_V12_PARTY_TUPLE_FIELDS',
      ordered_field: 'ordered_fields',
      expected: FIXTURE_CONTRACT_INPUT_V12.party_tuple_fields,
    },
    {
      object_kind: 'RESIDUAL_REASON_CODEBOOK_MIGRATION_INPUT',
      stable_id: 'FIXTURE_CONTRACT_INPUT_V12_RESIDUAL_REASON_CODES',
      ordered_field: 'ordered_values',
      expected: FIXTURE_CONTRACT_INPUT_V12.residual_reason_codes,
    },
  ];

  for (const config of configs) {
    const members = compiled.authored_members.filter(
      (member) => member.object_kind === config.object_kind,
    );
    assert.equal(members.length, 1);
    const value = members[0].canonical_value;
    assert.deepEqual(Object.keys(value).sort(), [
      'authority',
      'object_kind',
      config.ordered_field,
      'schema_version',
      'source_fixture',
      'stable_id',
    ].sort());
    assert.equal(value.object_kind, config.object_kind);
    assert.equal(value.schema_version, `${config.object_kind}/V1`);
    assert.equal(value.stable_id, config.stable_id);
    assert.equal(value.source_fixture, 'FIXTURE_CONTRACT_INPUT_V12');
    assert.equal(value.authority, 'MIGRATION_INPUT_ONLY');
    assert.equal(canonicalJson(value[config.ordered_field]), canonicalJson(config.expected));
  }
});

test('every authored exact-detail action is the exact existing V12 source record', () => {
  const compiled = compileCanonicalContractInput({ root_directory: sourceRoot });
  const actual = authoredPayloads(
    compiled,
    'SERVING_EXACT_DETAIL_ACTION_DEFINITION',
    'action_slot_key',
    'SERVING_EXACT_DETAIL_ACTION_DEFINITION/V1',
  );
  const expected = [...FIXTURE_CONTRACT_INPUT_V12.serving_exact_detail_actions]
    .sort((left, right) => left.action_slot_key.localeCompare(right.action_slot_key));

  assert.equal(actual.length, 5);
  assert.equal(canonicalJson(actual), canonicalJson(expected));
  for (const member of compiled.authored_members.filter(
    (entry) => entry.object_kind === 'SERVING_EXACT_DETAIL_ACTION_DEFINITION',
  )) {
    assert.equal(Object.hasOwn(member.canonical_value, 'action_definition_id'), false);
    assert.equal(
      Object.hasOwn(member.canonical_value, 'action_definition_payload_digest'),
      false,
    );
  }
});

test('the authored parser proposal boundary is the exact existing V12 source record', () => {
  const compiled = compileCanonicalContractInput({ root_directory: sourceRoot });
  const actual = authoredPayloads(
    compiled,
    'PARSER_PROPOSAL_BOUNDARY_DEFINITION',
    'adapter_key',
    'PARSER_PROPOSAL_BOUNDARY_DEFINITION/V1',
  );

  assert.equal(actual.length, 1);
  assert.equal(canonicalJson(actual[0]), canonicalJson(FIXTURE_CONTRACT_INPUT_V12.parser_proposal_boundary));
  const member = compiled.authored_members.find(
    (entry) => entry.object_kind === 'PARSER_PROPOSAL_BOUNDARY_DEFINITION',
  );
  assert.equal(Object.hasOwn(member.canonical_value, 'proposal_boundary_definition_id'), false);
  assert.equal(
    Object.hasOwn(member.canonical_value, 'proposal_boundary_definition_payload_digest'),
    false,
  );
});

test('the authored money denominator precision policy is the exact existing V12 policy', () => {
  const compiled = compileCanonicalContractInput({ root_directory: sourceRoot });
  const actual = authoredPolicyPayload(
    compiled,
    'MONEY_DENOMINATOR_PRECISION_POLICY',
    'MONEY_DENOMINATOR_PRECISION_POLICY',
    'MONEY_DENOMINATOR_PRECISION_POLICY/V1',
  );

  assert.equal(
    canonicalJson(actual),
    canonicalJson(FIXTURE_CONTRACT_INPUT_V12.money_denominator_precision_policy),
  );
});

test('the authored claim interpretation policy is the exact existing V12 policy', () => {
  const compiled = compileCanonicalContractInput({ root_directory: sourceRoot });
  const actual = authoredPolicyPayload(
    compiled,
    'CLAIM_INTERPRETATION_POLICY',
    'CLAIM_INTERPRETATION_POLICY',
    'CLAIM_INTERPRETATION_POLICY/V2',
  );

  assert.equal(
    canonicalJson(actual),
    canonicalJson(FIXTURE_CONTRACT_INPUT_V12.claim_interpretation_policy),
  );
});

test('the manifest exactly closes the 168-file Agreement, shared, Process, Product and governance source tree', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'manifest.json'), 'utf8'));
  const actualMembers = jsonMembers(sourceRoot);
  const declaredMembers = manifest.members.map((member) => member.relative_path);

  assert.deepEqual(actualMembers, declaredMembers);
  assert.equal(manifest.members.length, 168);
  assert.equal(
    manifest.members.filter((member) => member.relative_path.startsWith('agreement/')).length,
    92,
  );
  assert.equal(
    manifest.members.filter((member) => member.relative_path.startsWith('shared/')).length,
    17,
  );
  assert.equal(
    manifest.members.filter((member) => member.relative_path.startsWith('process/')).length,
    36,
  );
  assert.equal(
    manifest.members.filter((member) => member.relative_path.startsWith('product/')).length,
    14,
  );
  assert.equal(
    manifest.members.filter((member) => member.relative_path.startsWith('governance/')).length,
    9,
  );
  assert.equal(
    fs.existsSync(path.join(__dirname, '../lib/schema/canonical/contract-v2')),
    false,
  );
  const perKindCounts = {};
  const perKindSchemaVersions = {};
  for (const declaredMember of manifest.members) {
    const canonicalMember = JSON.parse(
      fs.readFileSync(
        path.join(sourceRoot, ...declaredMember.relative_path.split('/')),
        'utf8',
      ),
    );
    perKindCounts[canonicalMember.object_kind] =
      (perKindCounts[canonicalMember.object_kind] || 0) + 1;
    perKindSchemaVersions[canonicalMember.object_kind] = [
      ...new Set([
        ...(perKindSchemaVersions[canonicalMember.object_kind] || []),
        canonicalMember.schema_version,
      ]),
    ].sort();
  }
  assert.deepEqual(manifest.per_kind_counts, perKindCounts);
  assert.deepEqual(manifest.per_kind_schema_versions, perKindSchemaVersions);
  for (const declaredMember of manifest.members) {
    const canonicalMember = JSON.parse(
      fs.readFileSync(
        path.join(sourceRoot, ...declaredMember.relative_path.split('/')),
        'utf8',
      ),
    );
    assert.equal(
      sha256Hex(Buffer.from(canonicalJson(canonicalMember), 'utf8')),
      declaredMember.canonical_bytes_digest,
    );
  }
});
