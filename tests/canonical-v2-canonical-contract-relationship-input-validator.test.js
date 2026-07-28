const test = require('node:test');
const assert = require('node:assert/strict');

const {
  validateAuthoredRelationshipInputs,
} = require('../lib/canonical-v2/canonical-contract-relationship-input-validator');
const {
  FIXTURE_CONTRACT_INPUT_V12,
} = require('../lib/canonical-v2/contract-bundle');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function validRelationship() {
  return {
    object_kind: 'RELATIONSHIP_DEFINITION',
    stable_id: 'USES_DEFINITION',
    schema_version: 'RELATIONSHIP_DEFINITION/V1',
    ...clone(FIXTURE_CONTRACT_INPUT_V12.relationship_definitions.find(
      (entry) => entry.relationship_key === 'USES_DEFINITION',
    )),
  };
}

function validEffect() {
  return {
    object_kind: 'RELATIONSHIP_EFFECT_SCHEMA',
    stable_id: 'USES_DEFINITION_EFFECT',
    schema_version: 'RELATIONSHIP_EFFECT_SCHEMA/V1',
    effect_schema_key: 'USES_DEFINITION_EFFECT',
    effect_schema_version: 2,
    definition: clone(FIXTURE_CONTRACT_INPUT_V12.definition_use_effect_schema),
  };
}

function member(value) {
  return {
    object_kind: value.object_kind,
    canonical_value: value,
  };
}

function validPair() {
  return [member(validRelationship()), member(validEffect())];
}

function expectCode(code) {
  return (error) => error?.code === code;
}

test('accepts the exact authored USES_DEFINITION relationship and effect-schema pair', () => {
  assert.doesNotThrow(() => validateAuthoredRelationshipInputs(validPair()));
  assert.doesNotThrow(() => validateAuthoredRelationshipInputs([]));
});

test('rejects invalid typed relationship envelopes', () => {
  for (const mutate of [
    (value) => { value.stable_id = 'OTHER'; },
    (value) => { delete value.effect_schema; },
    (value) => { value.version = 0; },
  ]) {
    const relationship = validRelationship();
    mutate(relationship);
    assert.throws(
      () => validateAuthoredRelationshipInputs([
        member(relationship),
        member(validEffect()),
      ]),
      expectCode('INVALID_CANONICAL_BUNDLE_RELATIONSHIP_DEFINITION'),
    );
  }
});

test('accepts a closed non-semantic relationship and rejects mode drift', () => {
  const relationship = require(
    '../lib/schema/canonical/contract-v2/relationship-definitions/contained-in.v2.json'
  );
  const effect = require(
    '../lib/schema/canonical/contract-v2/relationship-effect-schemas/contained-in-effect.v1.json'
  );
  assert.doesNotThrow(() => validateAuthoredRelationshipInputs([
    member(relationship),
    member(effect),
  ]));

  const changed = clone(effect);
  changed.definition.effect_mode = 'TYPED_LEGAL_EFFECT';
  assert.throws(
    () => validateAuthoredRelationshipInputs([
      member(relationship),
      member(changed),
    ]),
    expectCode('CANONICAL_BUNDLE_RELATIONSHIP_EFFECT_BINDING_MISMATCH'),
  );
});

test('rejects invalid effect-schema envelopes and nested version drift', () => {
  for (const mutate of [
    (value) => { value.stable_id = 'OTHER'; },
    (value) => { value.effect_schema_version = 3; },
    (value) => { value.definition.schema_version = 'USES_DEFINITION_EFFECT/V3'; },
    (value) => { delete value.definition; },
  ]) {
    const effect = validEffect();
    mutate(effect);
    assert.throws(
      () => validateAuthoredRelationshipInputs([
        member(validRelationship()),
        member(effect),
      ]),
      expectCode('INVALID_CANONICAL_BUNDLE_RELATIONSHIP_EFFECT_SCHEMA'),
    );
  }
});

test('rejects missing, wrong-version and ambiguous effect-schema references', () => {
  assert.throws(
    () => validateAuthoredRelationshipInputs([member(validRelationship())]),
    expectCode('CANONICAL_BUNDLE_RELATIONSHIP_EFFECT_REFERENCE_UNRESOLVED'),
  );

  const wrongVersion = validRelationship();
  wrongVersion.effect_schema = 'USES_DEFINITION_EFFECT/V3';
  assert.throws(
    () => validateAuthoredRelationshipInputs([
      member(wrongVersion),
      member(validEffect()),
    ]),
    expectCode('CANONICAL_BUNDLE_RELATIONSHIP_EFFECT_REFERENCE_UNRESOLVED'),
  );

  assert.throws(
    () => validateAuthoredRelationshipInputs([
      member(validRelationship()),
      member(validEffect()),
      member(validEffect()),
    ]),
    expectCode('CANONICAL_BUNDLE_RELATIONSHIP_EFFECT_REFERENCE_AMBIGUOUS'),
  );
});

test('rejects effect schemas bound to another relationship key or version', () => {
  for (const mutate of [
    (value) => { value.definition.relationship_key = 'OTHER'; },
    (value) => { value.definition.relationship_definition_version = 2; },
  ]) {
    const effect = validEffect();
    mutate(effect);
    assert.throws(
      () => validateAuthoredRelationshipInputs([
        member(validRelationship()),
        member(effect),
      ]),
      expectCode('CANONICAL_BUNDLE_RELATIONSHIP_EFFECT_BINDING_MISMATCH'),
    );
  }
});

test('rejects unreferenced authored effect schemas', () => {
  assert.throws(
    () => validateAuthoredRelationshipInputs([member(validEffect())]),
    expectCode('CANONICAL_BUNDLE_RELATIONSHIP_EFFECT_SCHEMA_UNREFERENCED'),
  );
});
