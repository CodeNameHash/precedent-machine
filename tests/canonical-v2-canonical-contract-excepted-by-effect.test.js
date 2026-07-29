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
  validateAuthoredExceptedByInputs,
  validateExceptedByEffect,
} = require('../lib/canonical-v2/canonical-contract-excepted-by-validator');
const {
  FIXTURE_CONTRACT_FINGERPRINT_V12,
} = require('../lib/canonical-v2/contract-bundle');

const sourceRoot = path.join(
  __dirname,
  '..',
  'contracts',
  'canonical-v2',
  'successor',
);
const PARTY = Object.freeze({
  role: 'COVENANT_OBLIGOR',
  value: 'COMPANY',
  capacity: 'TARGET',
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function compiled() {
  return compileCanonicalContractInput({ root_directory: sourceRoot });
}

function definition(output) {
  return output.authored_members.find(
    (member) => member.object_kind === 'RELATIONSHIP_EFFECT_SCHEMA'
      && member.stable_id === 'EXCEPTED_BY_EFFECT',
  ).canonical_value.definition;
}

function semanticSchema(output, stableId) {
  return output.authored_members.find(
    (member) => member.object_kind === 'NO_SHOP_SEMANTIC_SCHEMA_INPUT'
      && member.stable_id === stableId,
  ).canonical_value.authored_schema;
}

function conditionalEffect(output) {
  const schema = semanticSchema(output, 'NO_SHOP_EXCEPTION_EFFECT');
  return {
    effect_mode: 'TYPED_LEGAL_EFFECT',
    effect_variant: 'CONDITIONAL_ACTION_PERMISSION',
    legal_operation: 'PERMITS_ENGAGE_IN_DISCUSSIONS',
    affected_action_code: 'ENGAGE_IN_DISCUSSIONS',
    shared_prerequisite_codes: schema.required_shared_prerequisite_codes,
    action_specific_prerequisite_codes: [],
    temporal_start: 'SIGNING',
    temporal_end: 'STOCKHOLDER_APPROVAL',
    obligated_party: PARTY,
    protected_party: {
      role: 'COVENANT_BENEFICIARY',
      value: 'PARENT',
      capacity: 'BUYER',
    },
    governing_notice_obligation_revision_id: 'a'.repeat(64),
    definition_use_relationship_ids: [],
    precedence_code: 'SUBJECT_TO_INITIAL_PROPOSAL_NOTICE',
  };
}

function inlineEffect() {
  return {
    effect_mode: 'TYPED_LEGAL_EFFECT',
    effect_variant: 'INLINE_PERMISSION',
    legal_operation: 'PERMITS_INFORMING_PERSONS_OF_NO_SHOP_PROVISIONS',
    permitted_action_code: 'INFORM_PERSONS_OF_NO_SHOP_PROVISIONS',
    qualified_action_occurrence_ids: ['b'.repeat(64)],
    permitted_actor_party: PARTY,
    information_subject_code: 'GOVERNING_NO_SHOP_PROVISIONS',
    temporal_scope_inheritance: 'INHERITS_PARENT_NO_SHOP_RESTRICTION',
    cross_reference_excerpt_id: 'c'.repeat(64),
    evidence_excerpt_ids: ['d'.repeat(64)],
    scope_closure_id: 'e'.repeat(64),
  };
}

function restrictionCarveoutEffect() {
  return {
    effect_mode: 'TYPED_LEGAL_EFFECT',
    effect_variant: 'RESTRICTION_CARVEOUT',
    legal_operation: 'EXCLUDES_CAPEX_RESTRICTION_WHEN_APPLICABLE',
    restriction_period: 'PRE_CLOSING_PERIOD',
    obligors: ['COMPANY', 'COMPANY_SUBSIDIARIES'],
    exceptions: [
      'REQUIRED_OR_CONTEMPLATED_BY_AGREEMENT_OR_LAW',
      'PARENT_WRITTEN_CONSENT',
      'COMPANY_DISCLOSURE_SCHEDULE',
    ],
    consent_standard: 'NOT_UNREASONABLY_WITHHELD_CONDITIONED_OR_DELAYED',
  };
}

test('EXCEPTED_BY V3 and its umbrella effect have pinned canonical identities', () => {
  const output = compiled();
  const expected = new Map([
    ['EXCEPTED_BY', [
      233,
      'ea7a0f2d3c91430bde6bf532e8dc06d3e55aa4e91f25fbc57e6f87fbca2feeb9',
    ]],
    ['EXCEPTED_BY_EFFECT', [
      2781,
      '43b05d5c61330da35eaa9ac3c72b73d3fa05f6e0c9dfdc98f8a19f69c7755ed0',
    ]],
  ]);
  for (const [stableId, [byteLength, digest]] of expected) {
    const member = output.authored_members.find((entry) => entry.stable_id === stableId);
    const bytes = Buffer.from(canonicalJson(member.canonical_value), 'utf8');
    assert.equal(bytes.length, byteLength);
    assert.equal(sha256Hex(bytes), digest);
    assert.equal(member.canonical_bytes_digest, digest);
  }
  assert.equal(
    FIXTURE_CONTRACT_FINGERPRINT_V12,
    '261525a8268a1392428a610bbf0c2166c87318192971d08bc7e6ac5f2c7235e5',
  );
});

test('the umbrella closes exactly the three Ben-approved effect variants', () => {
  const output = compiled();
  const schema = definition(output);
  assert.deepEqual(schema.allowed_effect_variants, [
    'CONDITIONAL_ACTION_PERMISSION',
    'INLINE_PERMISSION',
    'RESTRICTION_CARVEOUT',
  ]);
  assert.deepEqual(schema.comparison_contract, {
    cohort_key_fields: ['effect_variant', 'legal_operation'],
    cross_variant_comparison: 'FORBIDDEN',
    missing_variant_disposition: 'QUARANTINE_RELATIONSHIP',
    unknown_variant_disposition: 'RETAIN_RESIDUAL_AND_QUARANTINE_RELATIONSHIP',
  });
  assert.equal(schema.automatic_variant_inference, 'FORBIDDEN');
});

test('one source-backed example for each approved variant validates', () => {
  const output = compiled();
  const schema = definition(output);
  for (const effect of [
    conditionalEffect(output),
    inlineEffect(),
    restrictionCarveoutEffect(),
  ]) {
    assert.equal(
      validateExceptedByEffect(effect, schema, output.authored_members),
      true,
    );
  }
});

test('missing, unknown and cross-shaped variants fail closed', () => {
  const output = compiled();
  const schema = definition(output);
  const cases = [
    (() => {
      const effect = conditionalEffect(output);
      delete effect.effect_variant;
      return effect;
    })(),
    {
      ...conditionalEffect(output),
      effect_variant: 'INLINE_PERMISSION',
    },
    {
      ...restrictionCarveoutEffect(),
      exceptions: ['UNREVIEWED_EXCEPTION'],
    },
    {
      ...inlineEffect(),
      qualified_action_occurrence_ids: ['b'.repeat(64), 'b'.repeat(64)],
    },
  ];
  for (const effect of cases) {
    assert.throws(
      () => validateExceptedByEffect(effect, schema, output.authored_members),
      (error) => error?.name === 'CanonicalContractExceptedByError',
    );
  }
});

test('authored dependencies and comparison isolation fail closed under drift', () => {
  const output = compiled();
  const mutations = [
    (members) => {
      const effect = members.find((member) => member.stable_id === 'EXCEPTED_BY_EFFECT');
      effect.canonical_value.definition.allowed_effect_variants.reverse();
    },
    (members) => {
      const effect = members.find((member) => member.stable_id === 'EXCEPTED_BY_EFFECT');
      effect.canonical_value.definition.comparison_contract.cross_variant_comparison = 'ALLOWED';
    },
    (members) => {
      const source = members.find(
        (member) => member.stable_id === 'NO_SHOP_EXCEPTION_EFFECT',
      );
      source.canonical_value.authored_schema.relationship_definition_version = 3;
    },
  ];
  for (const mutate of mutations) {
    const members = clone(output.authored_members);
    mutate(members);
    assert.throws(
      () => validateAuthoredExceptedByInputs(members),
      (error) => error?.name === 'CanonicalContractExceptedByError',
    );
  }
});

test('the completed relationship universe remains non-authoritative until registry freeze', () => {
  const output = compiled();
  assert.equal(output.authored_members.length, 99);
  assert.equal(output.disposition.status, 'INCOMPLETE_UNIVERSE');
  assert.equal(output.disposition.freeze_eligible, false);
  assert.equal(output.disposition.canonical_contract_bundle_authority, 'NONE');
  assert.equal(output.disposition.p1_gate_status, 'NOT_EVALUATED');
  assert.equal(Object.hasOwn(output, 'canonical_contract_bundle'), false);
});
