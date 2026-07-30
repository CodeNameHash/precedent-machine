const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  validateAuthoredPilotResultDefinitionInputs,
} = require(
  '../lib/canonical-v2/pilot-result-definition-input-validator',
);

const ROOT = path.join(__dirname, '../contracts/canonical-v2/successor');
const PATHS = [
  'agreement/result-definitions/target-capex-restriction.v1.json',
  'agreement/result-definitions/buyer-initial-match-right.v1.json',
];

function members() {
  return PATHS.map((relativePath) => {
    const canonicalValue = JSON.parse(
      fs.readFileSync(path.join(ROOT, relativePath), 'utf8'),
    );
    return {
      object_kind: canonicalValue.object_kind,
      canonical_value: canonicalValue,
    };
  });
}

function byId(values, stableId) {
  return values.find(
    (member) => member.canonical_value.stable_id === stableId,
  ).canonical_value.authored_definition;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('governs exact capex and initial-match result targets and slots', () => {
  assert.doesNotThrow(() => validateAuthoredPilotResultDefinitionInputs(members()));
  const values = members();
  const capex = byId(values, 'TARGET_CAPEX_RESTRICTION');
  const noShop = byId(values, 'BUYER_INITIAL_MATCH_RIGHT');

  assert.equal(capex.primary_claim_slots[0].value_slot_key, 'CAPEX_THRESHOLD');
  assert.equal(
    capex.primary_claim_slots[0].required_claim_definition_key,
    'IOC_CAPEX_THRESHOLD_PERCENT_OF_DEAL_VALUE',
  );
  assert.equal(
    noShop.primary_claim_slots[0].value_slot_key,
    'INITIAL_MATCH_PERIOD',
  );
  assert.equal(
    noShop.primary_claim_slots[0].required_claim_definition_key,
    'NO_SHOP_INITIAL_MATCH_PERIOD_DAYS',
  );
});

test('keeps IOC optional-relationship ownership and no-shop claim ownership', () => {
  const values = members();
  const capex = byId(values, 'TARGET_CAPEX_RESTRICTION');
  const noShop = byId(values, 'BUYER_INITIAL_MATCH_RIGHT');

  assert.equal(capex.relationship_ownership.mode, 'RESULT_OPTIONAL_RELATIONSHIPS');
  assert.deepEqual(capex.relationship_ownership.optional_relationships, [{
    relationship_key: 'EXCEPTED_BY',
    relationship_version: 3,
  }]);
  assert.equal(noShop.relationship_ownership.mode, 'RESULT_CLAIM');
  assert.deepEqual(noShop.relationship_ownership.optional_relationships, []);
});

test('rejects missing targets, invented slots and ownership reversals', () => {
  assert.throws(
    () => validateAuthoredPilotResultDefinitionInputs(members().slice(1)),
    { code: 'PILOT_RESULT_DEFINITION_MEMBERSHIP_MISMATCH' },
  );

  const inventedSlot = clone(members());
  byId(inventedSlot, 'TARGET_CAPEX_RESTRICTION')
    .primary_claim_slots[0].value_slot_key = 'INVENTED_SLOT';
  assert.throws(
    () => validateAuthoredPilotResultDefinitionInputs(inventedSlot),
    { code: 'INVALID_PILOT_IOC_RESULT_DEFINITION_INPUT' },
  );

  const reversedOwnership = clone(members());
  byId(reversedOwnership, 'BUYER_INITIAL_MATCH_RIGHT')
    .relationship_ownership.mode = 'RESULT_OPTIONAL_RELATIONSHIPS';
  assert.throws(
    () => validateAuthoredPilotResultDefinitionInputs(reversedOwnership),
    { code: 'INVALID_PILOT_NO_SHOP_RESULT_DEFINITION_INPUT' },
  );
});
