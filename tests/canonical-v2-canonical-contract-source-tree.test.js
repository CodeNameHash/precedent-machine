const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
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

test('the first authored source compiles twice byte-identically without claiming completeness', () => {
  const first = compileCanonicalContractInput({ root_directory: sourceRoot });
  const second = compileCanonicalContractInput({ root_directory: sourceRoot });

  assert.equal(canonicalJson(first), canonicalJson(second));
  assert.equal(first.authored_members.length, 41);
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

test('the manifest exactly closes the complete 41-file V12 authored vocabulary tree', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'manifest.json'), 'utf8'));
  const actualMembers = jsonMembers(sourceRoot);
  const declaredMembers = manifest.members.map((member) => member.relative_path);

  assert.deepEqual(actualMembers, declaredMembers);
  assert.equal(manifest.members.length, 41);
  assert.deepEqual(manifest.per_kind_counts, {
    CLAIM_DEFINITION: 13,
    COMPONENT_DEFINITION: 9,
    PROVISION_CONCEPT: 19,
  });
  assert.deepEqual(manifest.per_kind_schema_versions, {
    CLAIM_DEFINITION: ['CLAIM_DEFINITION/V1'],
    COMPONENT_DEFINITION: ['COMPONENT_DEFINITION/V1'],
    PROVISION_CONCEPT: ['PROVISION_CONCEPT/V1'],
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
