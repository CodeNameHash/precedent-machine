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
} = require('../lib/canonical-v2/contract-bundle');

const sourceRoot = path.join(
  __dirname,
  '..',
  'lib',
  'schema',
  'canonical',
  'contract-v2',
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

test('the first authored source compiles twice byte-identically without claiming completeness', () => {
  const first = compileCanonicalContractInput({ root_directory: sourceRoot });
  const second = compileCanonicalContractInput({ root_directory: sourceRoot });

  assert.equal(canonicalJson(first), canonicalJson(second));
  assert.equal(first.authored_members.length, 51);
  assert.equal(
    first.authored_members.some(
      (member) => member.object_kind === 'CANONICAL_BUNDLE_INPUT_REQUIRED_KIND_REGISTRY',
    ),
    false,
  );
  assert.equal(first.authored_universe_assessment.status, 'NOT_ASSESSED');
  assert.equal(first.authored_universe_assessment.required_kind_registry_binding, null);
  assert.deepEqual(first.authored_universe_assessment.ordered_kind_results, []);
  assert.equal(first.disposition.status, 'INCOMPLETE_UNIVERSE');
  assert.equal(first.disposition.reason_code, 'GOVERNED_REQUIRED_KIND_REGISTRY_NOT_SUPPLIED');
  assert.equal(first.disposition.freeze_eligible, false);
  assert.equal(first.disposition.canonical_contract_bundle_authority, 'NONE');
  assert.equal(first.disposition.p1_gate_status, 'NOT_EVALUATED');
  assert.equal(Object.hasOwn(first, 'canonical_contract_bundle'), false);
});

test('every authored claim is the exact existing V12 payload under the required envelope', () => {
  const compiled = compileCanonicalContractInput({ root_directory: sourceRoot });
  const actual = authoredPayloads(
    compiled,
    'CLAIM_DEFINITION',
    'claim_definition_key',
    'CLAIM_DEFINITION/V1',
  );
  const expected = [...FIXTURE_CONTRACT_INPUT_V12.claim_definitions]
    .sort((left, right) => left.claim_definition_key.localeCompare(right.claim_definition_key));

  assert.equal(actual.length, 13);
  assert.equal(canonicalJson(actual), canonicalJson(expected));
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

test('the sole authored relationship is the exact V12 USES_DEFINITION definition', () => {
  const compiled = compileCanonicalContractInput({ root_directory: sourceRoot });
  const actual = authoredPayloads(
    compiled,
    'RELATIONSHIP_DEFINITION',
    'relationship_key',
    'RELATIONSHIP_DEFINITION/V1',
  );
  const expected = FIXTURE_CONTRACT_INPUT_V12.relationship_definitions.filter(
    (entry) => entry.relationship_key === 'USES_DEFINITION',
  );

  assert.equal(actual.length, 1);
  assert.equal(canonicalJson(actual), canonicalJson(expected));
  assert.equal(actual[0].version, 3);
  assert.equal(actual[0].effect_schema, 'USES_DEFINITION_EFFECT/V2');
  assert.deepEqual(
    FIXTURE_CONTRACT_INPUT_V12.relationship_definitions
      .filter((entry) => entry.relationship_key !== 'USES_DEFINITION')
      .map((entry) => entry.relationship_key)
      .sort(),
    ['BRINGS_DOWN', 'CONTAINED_IN', 'EXCEPTED_BY', 'TRIGGERED_BY'],
  );
});

test('the authored USES_DEFINITION effect schema preserves the exact nested V12 definition', () => {
  const compiled = compileCanonicalContractInput({ root_directory: sourceRoot });
  const members = compiled.authored_members.filter(
    (member) => member.object_kind === 'RELATIONSHIP_EFFECT_SCHEMA',
  );

  assert.equal(members.length, 1);
  const member = members[0].canonical_value;
  assert.equal(member.object_kind, 'RELATIONSHIP_EFFECT_SCHEMA');
  assert.equal(member.stable_id, 'USES_DEFINITION_EFFECT');
  assert.equal(member.schema_version, 'RELATIONSHIP_EFFECT_SCHEMA/V1');
  assert.equal(member.effect_schema_key, 'USES_DEFINITION_EFFECT');
  assert.equal(member.effect_schema_version, 2);
  assert.equal(
    `${member.effect_schema_key}/V${member.effect_schema_version}`,
    'USES_DEFINITION_EFFECT/V2',
  );
  assert.equal(
    canonicalJson(member.definition),
    canonicalJson(FIXTURE_CONTRACT_INPUT_V12.definition_use_effect_schema),
  );
});

test('the compiler refuses the authored relationship when its effect schema is absent', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'canonical-relationship-input-'));
  fs.cpSync(sourceRoot, root, { recursive: true });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const effectPath = 'relationship-effect-schemas/uses-definition-effect.v2.json';
  fs.rmSync(path.join(root, ...effectPath.split('/')));
  const manifestPath = path.join(root, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.members = manifest.members.filter((member) => member.relative_path !== effectPath);
  delete manifest.per_kind_counts.RELATIONSHIP_EFFECT_SCHEMA;
  delete manifest.per_kind_schema_versions.RELATIONSHIP_EFFECT_SCHEMA;
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  assert.throws(
    () => compileCanonicalContractInput({ root_directory: root }),
    (error) => error?.code === 'CANONICAL_BUNDLE_RELATIONSHIP_EFFECT_REFERENCE_UNRESOLVED',
  );
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

test('the manifest exactly closes the complete 51-file V12 authored source tree', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'manifest.json'), 'utf8'));
  const actualMembers = jsonMembers(sourceRoot);
  const declaredMembers = manifest.members.map((member) => member.relative_path);

  assert.deepEqual(actualMembers, declaredMembers);
  assert.equal(manifest.members.length, 51);
  assert.deepEqual(manifest.per_kind_counts, {
    CLAIM_DEFINITION: 13,
    CLAIM_INTERPRETATION_POLICY: 1,
    COMPONENT_DEFINITION: 9,
    MONEY_DENOMINATOR_PRECISION_POLICY: 1,
    PARSER_PROPOSAL_BOUNDARY_DEFINITION: 1,
    PROVISION_CONCEPT: 19,
    RELATIONSHIP_DEFINITION: 1,
    RELATIONSHIP_EFFECT_SCHEMA: 1,
    SERVING_EXACT_DETAIL_ACTION_DEFINITION: 5,
  });
  assert.deepEqual(manifest.per_kind_schema_versions, {
    CLAIM_DEFINITION: ['CLAIM_DEFINITION/V1'],
    CLAIM_INTERPRETATION_POLICY: ['CLAIM_INTERPRETATION_POLICY/V2'],
    COMPONENT_DEFINITION: ['COMPONENT_DEFINITION/V1'],
    MONEY_DENOMINATOR_PRECISION_POLICY: ['MONEY_DENOMINATOR_PRECISION_POLICY/V1'],
    PARSER_PROPOSAL_BOUNDARY_DEFINITION: ['PARSER_PROPOSAL_BOUNDARY_DEFINITION/V1'],
    PROVISION_CONCEPT: ['PROVISION_CONCEPT/V1'],
    RELATIONSHIP_DEFINITION: ['RELATIONSHIP_DEFINITION/V1'],
    RELATIONSHIP_EFFECT_SCHEMA: ['RELATIONSHIP_EFFECT_SCHEMA/V1'],
    SERVING_EXACT_DETAIL_ACTION_DEFINITION: [
      'SERVING_EXACT_DETAIL_ACTION_DEFINITION/V1',
    ],
  });
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
