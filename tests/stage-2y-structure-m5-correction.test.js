'use strict';

const assert = require('node:assert/strict');
const { readFileSync, readdirSync } = require('node:fs');
const { resolve } = require('node:path');
const test = require('node:test');

const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const { adaptCompoundFamily, policyForFamily } = require('../lib/canonical-v2/family-compound-adapter');

const ROOT = resolve(__dirname, '..', 'evidence/canonical-v2/stage-2y-structure-migration');

function json(path) {
  return JSON.parse(readFileSync(path));
}

function inputs() {
  const familyOrder = json(resolve(ROOT, 'receipts/stage-2y-structure-m5-preparation.json')).family_order;
  const agreements = readdirSync(resolve(ROOT, 'shadow/m4'))
    .filter((name) => name.endsWith('.agreement-analysis.json'))
    .sort()
    .map((name) => {
      const agreementId = name.split('.')[0];
      return {
        m4: json(resolve(ROOT, 'shadow/m4', name)),
        m2: json(resolve(ROOT, 'shadow/m2', `${agreementId}.agreement-index.json`)),
        m3: json(resolve(ROOT, 'shadow/m3', `${agreementId}.context-compilation.json`)),
      };
    });
  return { familyOrder, agreements };
}

test('corrective family policies replace the universal role list', () => {
  const { familyOrder } = inputs();
  const policies = familyOrder.map((entry) => policyForFamily(entry.family_key, entry.wave));
  assert.equal(policies.length, 25);
  assert.equal(new Set(policies.map((policy) => policy.family_policy_id)).size, 25);
  assert.equal(policyForFamily('KEY_DEFINED_TERMS', 2).actor_rule, 'NOT_UNIVERSALLY_REQUIRED');
  assert.equal(policyForFamily('TERMINATION', 1).actor_rule, 'REQUIRED');
  for (const policy of policies) {
    const unsigned = structuredClone(policy);
    delete unsigned.schema_version;
    delete unsigned.family_policy_id;
    assert.equal(policy.family_policy_id, contentId(policy.schema_version, unsigned));
    assert.equal(policy.approval_state, 'BEN_APPROVED_AND_SEALED');
  }
});

test('compound correction accounts for every M4 member once and closes system gaps', () => {
  const { familyOrder, agreements } = inputs();
  const memberIds = [];
  const propositions = [];
  for (const agreement of agreements) {
    for (const family of familyOrder) {
      const result = adaptCompoundFamily(
        agreement.m4,
        agreement.m2,
        agreement.m3,
        policyForFamily(family.family_key, family.wave),
      );
      memberIds.push(...result.member_ledger.map((entry) => entry.analysis_claim_id));
      propositions.push(...result.propositions);
    }
  }
  assert.equal(memberIds.length, 1528);
  assert.equal(new Set(memberIds).size, 1528);
  assert.equal(propositions.length, 1111);
  assert.equal(propositions.filter((entry) => entry.proposition_validation_state === 'COMPLETE').length, 1111);
  assert.equal(propositions.filter((entry) => entry.proposition_validation_state !== 'COMPLETE').length, 0);
  for (const proposition of propositions) {
    assert.ok(proposition.member_analysis_claim_ids.length > 0);
    assert.ok(proposition.source_node_occurrence_ids.length > 0);
    assert.ok(proposition.roles.AUTHORED_SOURCE.every((source) => source.validation_state === 'EXACT_BYTES_VERIFIED'));
    assert.ok(proposition.required_roles.every((role) => proposition.roles[role].length > 0));
  }
});

test('TopBuild section 6.3 termination rights are complete and retain exact triggers', () => {
  const { familyOrder, agreements } = inputs();
  const topBuild = agreements.find((entry) => entry.m4.agreement_id === '3888fa7618bbd9fd6530b657aaa18c7e85ff515acf80edb1fc78a190af86e9cb');
  const family = familyOrder.find((entry) => entry.family_key === 'TERMINATION');
  const result = adaptCompoundFamily(topBuild.m4, topBuild.m2, topBuild.m3, policyForFamily(family.family_key, family.wave));
  const section63 = result.propositions.filter((entry) => entry.roles.MEMBER_FACTS.some((member) => member.attributes.section_reference === '6.3'));
  assert.ok(section63.length >= 4);
  assert.ok(section63.every((entry) => entry.proposition_validation_state === 'COMPLETE'));
  const triggerKinds = new Set(section63.flatMap((entry) => entry.roles.MEMBER_FACTS.map((member) => member.attributes.trigger_kind)).filter(Boolean));
  assert.ok(triggerKinds.has('RECOMMENDATION_CHANGE'));
  assert.ok(triggerKinds.has('BREACH'));
});

test('the adapter is pure and isolates returned values from input mutation', () => {
  const { familyOrder, agreements } = inputs();
  const agreement = agreements[0];
  const family = familyOrder[0];
  const before = JSON.stringify(agreement.m4);
  const result = adaptCompoundFamily(agreement.m4, agreement.m2, agreement.m3, policyForFamily(family.family_key, family.wave));
  assert.equal(JSON.stringify(agreement.m4), before);
  if (result.propositions[0]) result.propositions[0].roles.AUTHORED_SOURCE[0].text = 'changed';
  assert.equal(JSON.stringify(agreement.m4), before);
});
