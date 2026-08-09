'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { contentId } = require('../lib/canonical-v2/canonical-bytes');

const {
  FIXTURE_CONTRACT_INPUT_V42,
  FIXTURE_CONTRACT_INPUT_V43,
  REPRESENTATION_TOPIC_CODES_V1,
  REPRESENTATION_TOPIC_REGISTRY_BINDING_V1,
  REPRESENTATION_TOPIC_PRESENT_CLAIM_DEFINITION_V1,
  compileFixtureContractV42,
  compileFixtureContractV43,
  validateContractBundle,
} = require('../lib/canonical-v2/contract-bundle');
const {
  REGISTRY_VERSION,
  REGISTRY_DIGEST,
  TOPIC_RULES,
} = require('../lib/vocab/resolution/representation-topic-registry');

const FROZEN_V42_FINGERPRINT = 'cf8320d2cabedeeb7042f81a1c7c7c37ecbd8e1a41b6d0672902cf79279d7ae2';

test('V43 adds only the two representation topic concepts and the registry-bound enum claim', () => {
  const v42 = compileFixtureContractV42();
  const v43 = compileFixtureContractV43();
  assert.equal(v42.fingerprint, FROZEN_V42_FINGERPRINT);
  assert.equal('representation_topic_registry_binding' in v42, false);
  assert.equal(validateContractBundle(v43), true);
  assert.notEqual(v43.fingerprint, v42.fingerprint);
  assert.deepEqual(
    v43.concepts.map(({ concept_key }) => concept_key).filter((key) => !v42.concepts.some((entry) => entry.concept_key === key)),
    ['REP-B-TOPIC', 'REP-T-TOPIC'],
  );
  assert.deepEqual(
    v43.claim_definitions.filter((entry) => !v42.claim_definitions.some((prior) => prior.claim_definition_key === entry.claim_definition_key)),
    [REPRESENTATION_TOPIC_PRESENT_CLAIM_DEFINITION_V1],
  );
  assert.deepEqual(
    FIXTURE_CONTRACT_INPUT_V43.concepts.filter((entry) => !FIXTURE_CONTRACT_INPUT_V42.concepts.some((prior) => prior.concept_key === entry.concept_key)),
    [{ concept_key: 'REP-T-TOPIC', version: 1 }, { concept_key: 'REP-B-TOPIC', version: 1 }],
  );
});

test('V43 topic enum is exactly bound to the versioned representation topic registry', () => {
  const v43 = compileFixtureContractV43();
  const registryCodes = TOPIC_RULES.map(({ id }) => id.replace('REP_TOPIC_V1_', '')).sort();
  assert.equal(REPRESENTATION_TOPIC_REGISTRY_BINDING_V1.registry_version, REGISTRY_VERSION);
  assert.equal(REPRESENTATION_TOPIC_REGISTRY_BINDING_V1.registry_digest, REGISTRY_DIGEST);
  assert.deepEqual(v43.representation_topic_registry_binding, REPRESENTATION_TOPIC_REGISTRY_BINDING_V1);
  assert.deepEqual(REPRESENTATION_TOPIC_CODES_V1, registryCodes);
  assert.deepEqual(REPRESENTATION_TOPIC_PRESENT_CLAIM_DEFINITION_V1.allowed_canonical_values, registryCodes);
  assert.equal(new Set(registryCodes).size, 25);
});

test('registry version and digest mutations move the contract identity and fail validation', () => {
  const v43 = compileFixtureContractV43();
  const { fingerprint: _fingerprint, ...payload } = v43;
  for (const binding of [
    { ...REPRESENTATION_TOPIC_REGISTRY_BINDING_V1, registry_version: 'REPRESENTATION_TOPIC_REGISTRY/V2' },
    { ...REPRESENTATION_TOPIC_REGISTRY_BINDING_V1, registry_digest: '0'.repeat(64) },
  ]) {
    const mutatedPayload = { ...payload, representation_topic_registry_binding: binding };
    const mutatedFingerprint = contentId('CANONICAL_CONTRACT_BUNDLE/V1', mutatedPayload);
    assert.notEqual(mutatedFingerprint, v43.fingerprint);
    assert.throws(
      () => validateContractBundle({ ...mutatedPayload, fingerprint: mutatedFingerprint }),
      /representation topic registry binding/,
    );
  }
});
