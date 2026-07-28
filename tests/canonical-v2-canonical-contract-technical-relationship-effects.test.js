const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  canonicalJson,
  sha256Hex,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  compileCanonicalContractInput,
} = require('../lib/canonical-v2/canonical-contract-input-compiler');
const {
  validateAuthoredTechnicalRelationshipInputs,
  validateBringsDownEffect,
  validateContainedInEffect,
} = require('../lib/canonical-v2/canonical-contract-technical-relationship-validator');
const {
  compileFixtureContractV4,
  FIXTURE_CONTRACT_FINGERPRINT_V12,
  FIXTURE_CONTRACT_INPUT_V12,
} = require('../lib/canonical-v2/contract-bundle');
const {
  BUYER_GROUNDS,
  SELLER_GROUNDS,
} = require('../lib/canonical-v2/qxo-buyer-termination-fee-admitted-slice');
const {
  validateTerminationFeeTriggerEffect,
} = require('../lib/canonical-v2/termination-fee-trigger-path');
const {
  buildQxoCapitalisationServingFixture,
} = require('./helpers/qxo-capitalisation-serving-fixture');

const sourceRoot = path.join(
  __dirname,
  '..',
  'lib',
  'schema',
  'canonical',
  'contract-v2',
);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function compiled() {
  return compileCanonicalContractInput({ root_directory: sourceRoot });
}

function effectDefinition(output, key) {
  return output.authored_members.find(
    (member) => member.object_kind === 'RELATIONSHIP_EFFECT_SCHEMA'
      && member.stable_id === key,
  ).canonical_value.definition;
}

test('the six technical relationship members have pinned canonical identities', () => {
  const output = compiled();
  const expected = new Map([
    ['BRINGS_DOWN', [233, '9c104bacfe90fdba9d88c7e699fcd99f3ba1551f3c96297c329f362ccb48e4dc']],
    ['CONTAINED_IN', [230, '2f4e2e6bb7d1fc4845cebcfe1ef7a7c1bf8dbb1b47632e2f1622bf44ae2d8d28']],
    ['TRIGGERED_BY', [247, '9877dc202e03d76fbb1eb787d3bb4aaa4d7d0ae0c5ef6e932ba2e21c7e142e0e']],
    ['BRINGS_DOWN_EFFECT', [2236, 'a4f7e50f3c057fcbc3cfc47489d6e6a037bee1da034955017800054bff8ca20f']],
    ['CONTAINED_IN_EFFECT', [975, '2e006ecf116701fb027ca0c85920e0f7c063c99c8050399198b76c6af5d8d9b7']],
    ['TERMINATION_FEE_TRIGGER_EFFECT', [1885, '73f82545c20c1e039b7c8383843007d94c3ecea943e04b7464f2407d106a1e55']],
  ]);
  for (const [stableId, [byteLength, digest]] of expected) {
    const member = output.authored_members.find((entry) => entry.stable_id === stableId);
    const bytes = Buffer.from(canonicalJson(member.canonical_value), 'utf8');
    assert.equal(bytes.length, byteLength);
    assert.equal(sha256Hex(bytes), digest);
    assert.equal(member.canonical_bytes_digest, digest);
  }
});

test('legacy V12 remains byte-frozen while only EXCEPTED_BY is unauthored', () => {
  assert.equal(
    FIXTURE_CONTRACT_FINGERPRINT_V12,
    '261525a8268a1392428a610bbf0c2166c87318192971d08bc7e6ac5f2c7235e5',
  );
  assert.deepEqual(FIXTURE_CONTRACT_INPUT_V12.relationship_definitions, [
    { relationship_key: 'BRINGS_DOWN', effect_mode: 'TYPED_LEGAL_EFFECT', version: 1 },
    { relationship_key: 'CONTAINED_IN', effect_mode: 'NON_SEMANTIC', version: 1 },
    { relationship_key: 'EXCEPTED_BY', effect_mode: 'TYPED_LEGAL_EFFECT', version: 2 },
    { relationship_key: 'TRIGGERED_BY', effect_mode: 'TYPED_LEGAL_EFFECT', version: 1 },
    {
      relationship_key: 'USES_DEFINITION',
      effect_mode: 'TYPED_LEGAL_EFFECT',
      version: 3,
      effect_schema: 'USES_DEFINITION_EFFECT/V2',
    },
  ]);
  const output = compiled();
  const authored = new Set(output.authored_members
    .filter((member) => member.object_kind === 'RELATIONSHIP_DEFINITION')
    .map((member) => member.stable_id));
  assert.deepEqual(
    FIXTURE_CONTRACT_INPUT_V12.relationship_definitions
      .map((entry) => entry.relationship_key)
      .filter((key) => !authored.has(key)),
    ['EXCEPTED_BY'],
  );
  assert.equal(output.disposition.status, 'INCOMPLETE_UNIVERSE');
  assert.equal(output.disposition.freeze_eligible, false);
  assert.equal(output.disposition.canonical_contract_bundle_authority, 'NONE');
  assert.equal(output.disposition.p1_gate_status, 'NOT_EVALUATED');
  assert.equal(Object.hasOwn(output, 'canonical_contract_bundle'), false);
});

test('reviewed QXO Tier B and Tier C effects satisfy BRINGS_DOWN_EFFECT V1', () => {
  const output = compiled();
  const definition = effectDefinition(output, 'BRINGS_DOWN_EFFECT');
  const fixture = buildQxoCapitalisationServingFixture();
  assert.equal(fixture.slice.relationships.length, 2);
  for (const relationship of fixture.slice.relationships) {
    assert.equal(validateBringsDownEffect(relationship.effect, definition), true);
  }

  const tierA = {
    effect_mode: 'TYPED_LEGAL_EFFECT',
    legal_operation: 'TEST_ACCURACY_AT_SIGNING_AND_CLOSING',
    accuracy_standard: 'MAT_ALL_RESPECTS',
    exception: null,
    time_points: ['SIGNING', 'CLOSING', 'EXPRESS_EARLIER_DATE_IF_APPLICABLE'],
  };
  const tierD = {
    ...tierA,
    accuracy_standard: 'MAT_MAE_QUALIFIED',
    materiality_scrape: {
      applied: true,
      disregarded_qualifiers: [
        'MATERIAL',
        'MATERIALITY',
        'COMPANY_MATERIAL_ADVERSE_EFFECT',
      ],
    },
  };
  assert.equal(validateBringsDownEffect(tierA, definition), true);
  assert.equal(validateBringsDownEffect(tierD, definition), true);

  const wrongException = clone(fixture.slice.relationships[0].effect);
  wrongException.exception = null;
  assert.throws(
    () => validateBringsDownEffect(wrongException, definition),
    (error) => error?.code === 'INVALID_BRINGS_DOWN_EFFECT',
  );
  const wrongScrape = clone(fixture.slice.relationships[1].effect);
  wrongScrape.materiality_scrape.disregarded_qualifiers.pop();
  assert.throws(
    () => validateBringsDownEffect(wrongScrape, definition),
    (error) => error?.code === 'INVALID_BRINGS_DOWN_EFFECT',
  );
});

test('CONTAINED_IN remains exactly geometric and cannot carry semantic fields', () => {
  const definition = effectDefinition(compiled(), 'CONTAINED_IN_EFFECT');
  assert.equal(validateContainedInEffect({
    effect_mode: 'NON_SEMANTIC',
    legal_operation: 'GEOMETRIC_ONLY',
  }, definition), true);
  assert.throws(
    () => validateContainedInEffect({
      effect_mode: 'NON_SEMANTIC',
      legal_operation: 'GEOMETRIC_ONLY',
      governed_term: 'De Minimis Inaccuracies',
    }, definition),
    (error) => error?.code === 'INVALID_CONTAINED_IN_EFFECT',
  );
});

test('all current QXO buyer and seller fee pathways satisfy the selected V2 effect', () => {
  const output = compiled();
  const definition = effectDefinition(output, 'TERMINATION_FEE_TRIGGER_EFFECT');
  const fixtureContract = compileFixtureContractV4();
  const triggerPath = fixtureContract.serving_trigger_path_schema_definitions[0];
  const bindings = new Map(fixtureContract.serving_metric_operation_bindings.map(
    (binding) => [binding.legal_operation, binding],
  ));
  assert.deepEqual(
    definition.required_effect_fields,
    [
      'effect_mode',
      'legal_operation',
      'trigger_path_schema_key',
      'trigger_path_schema_version',
      'pathway_code',
      'trigger_code',
      'terminating_party',
      'payment_timing',
      'indexed_facts',
      'condition_expression',
    ],
  );
  for (const ground of [...BUYER_GROUNDS, ...SELLER_GROUNDS]) {
    assert.equal(validateTerminationFeeTriggerEffect(ground.effect, {
      binding: bindings.get(ground.effect.legal_operation),
      schema: triggerPath,
    }), true);
  }
  assert.throws(() => validateTerminationFeeTriggerEffect({
    effect_mode: 'TYPED_LEGAL_EFFECT',
    legal_operation: 'CREATES_SELLER_TERMINATION_FEE_PAYMENT_TRIGGER',
    trigger_code: 'CHANGE_IN_RECOMMENDATION_TERMINATION',
    terminating_party: 'PARENT',
    payment_timing: 'TWO_BUSINESS_DAYS_AFTER_TERMINATION',
    conditions: [],
  }, {
    binding: bindings.get('CREATES_SELLER_TERMINATION_FEE_PAYMENT_TRIGGER'),
    schema: triggerPath,
  }), /fields do not match/);
});

test('technical effect dependencies fail closed under drift', () => {
  const output = compiled();
  const mutations = [
    (members) => members.splice(members.findIndex(
      (member) => member.object_kind === 'SERVING_TRIGGER_PATH_SCHEMA_INPUT',
    ), 1),
    (members) => {
      const claim = members.find(
        (member) => member.stable_id === 'REPRESENTATION_ACCURACY_STANDARD',
      );
      claim.canonical_value.allowed_canonical_values.pop();
    },
    (members) => {
      const effect = members.find((member) => member.stable_id === 'CONTAINED_IN_EFFECT');
      effect.canonical_value.definition.propagation = 'INHERIT';
    },
    (members) => {
      const binding = members.find(
        (member) => member.stable_id
          === 'BUYER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE/V2',
      );
      binding.canonical_value.authored_binding.legal_operation = 'OTHER';
    },
  ];
  for (const mutate of mutations) {
    const members = clone(output.authored_members);
    mutate(members);
    assert.throws(
      () => validateAuthoredTechnicalRelationshipInputs(members),
      (error) => error?.name === 'CanonicalContractTechnicalRelationshipError',
    );
  }
});
