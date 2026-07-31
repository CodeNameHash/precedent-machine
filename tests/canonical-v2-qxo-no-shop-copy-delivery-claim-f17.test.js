const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {
  withoutF20RollbackOnlyCertification,
} = require('./helpers/canonical-v2-staging-runner-scope');

const {
  compileFixtureContractV12,
  FIXTURE_SERVING_CONTRACT_FINGERPRINTS,
} = require('../lib/canonical-v2/contract-bundle');
const {
  buildClaimInterpretation,
  validateClaimInterpretation,
  validateInterpretedPresentClaimRevision,
} = require('../lib/canonical-v2/claim-interpretation');
const {
  AUTHORITY_SCOPE,
  RESULT_KEY,
  VALUE_SLOT_KEY,
} = require('../lib/canonical-v2/qxo-no-shop-copy-delivery-claim-f17');

const FIXTURE =
  'tests/fixtures/canonical-v2/qxo-no-shop-copy-delivery-claim-f17-staging-attestation.json';
const RUNNER =
  'scripts/canonical-v2-staging-qxo-no-shop-clock-attestation.mjs';
const PREDECESSOR_OCCURRENCE_ID =
  'eef50f360f7efab5c0d7ca00c32d51bfb4a9a142d3a76d7052db99b948964b7b';
const PREDECESSOR_REVISION_ID =
  '8bc47e7e4c1ee206052b1f7bda05c337d2b99c3b670b456c8826542128b34f33';

function fixture() {
  return JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
}

test('F17 remints the copy-delivery claim under frozen V12', () => {
  const value = fixture();
  assert.equal(value.environment, 'STAGING');
  assert.equal(value.authority_scope, AUTHORITY_SCOPE);
  assert.equal(
    value.contract_binding.contract_fingerprint,
    '261525a8268a1392428a610bbf0c2166c87318192971d08bc7e6ac5f2c7235e5',
  );
  assert.equal(value.claim.schema_version, 'CLAIM_REVISION/V2');
  assert.equal(
    value.claim.claim_definition_key,
    'NO_SHOP_COPY_DELIVERY_PERIOD_DAYS',
  );
  assert.equal(value.claim.claim_definition_version, 1);
  assert.equal(value.claim.ordinal, 1);
  assert.notEqual(
    value.claim.claim_occurrence_id,
    PREDECESSOR_OCCURRENCE_ID,
  );
});

test('the claim interpretation and ClaimRevision/V2 identities validate', () => {
  const value = fixture();
  const policy = compileFixtureContractV12()
    .claim_interpretation_policy_definition;
  assert.equal(validateClaimInterpretation({
    claim_interpretation: value.interpretation,
    policy,
  }), true);
  assert.equal(validateInterpretedPresentClaimRevision({
    claim: value.claim,
    interpretation: value.interpretation,
    policy,
    allowed_attributes: Object.keys(value.claim.attributes),
    codebooks: {},
    expected_attributes: value.claim.attributes,
  }), true);
  assert.equal(
    value.claim.interpretation_payload_id,
    value.interpretation.interpretation_payload_id,
  );
  assert.equal(
    value.interpretation.review_provenance
      .source_notice_clock_interpretation_payload_id,
    value.claim.attributes.source_notice_clock_interpretation_payload_id,
  );
  assert.equal(
    value.claim.attributes.interpretation_payload_id,
    value.claim.interpretation_payload_id,
  );
});

test('the exact source-backed evidence set and governed ordinal survive reclassification', () => {
  const value = fixture();
  assert.equal(
    value.reclassification_lineage.predecessor_claim_occurrence_id,
    PREDECESSOR_OCCURRENCE_ID,
  );
  assert.equal(
    value.reclassification_lineage.predecessor_claim_revision_id,
    PREDECESSOR_REVISION_ID,
  );
  assert.equal(
    value.reclassification_lineage.successor_claim_occurrence_id,
    value.claim.claim_occurrence_id,
  );
  assert.equal(
    value.reclassification_lineage.successor_claim_revision_id,
    value.claim.claim_revision_id,
  );
  assert.equal(
    value.reclassification_lineage.claim_occurrence_continuity,
    'PROHIBITED',
  );
  assert.equal(
    value.reclassification_lineage.source_evidence_set_preserved,
    true,
  );
  assert.equal(value.reclassification_lineage.governed_ordinal, 1);
  assert.deepEqual(
    value.claim.evidence.map((entry) => ({
      evidence_role: entry.evidence_role,
      excerpt_id: entry.excerpt_id,
      absolute_start: entry.absolute_start,
      absolute_end: entry.absolute_end,
    })),
    [
      {
        evidence_role: 'OPERATIVE_TEXT',
        excerpt_id:
          'f931ad1384f4c6eab9e70191ca85120dc35788ecdbb3eadae55ade483913e8e6',
        absolute_start: 208562,
        absolute_end: 208858,
      },
      {
        evidence_role: 'DERIVATION_INPUT',
        excerpt_id:
          'cf20e94b556b2742883007922268fc58026d1a58f733e6ecb65f40d1dce58c8e',
        absolute_start: 208605,
        absolute_end: 208641,
      },
    ],
  );
});

test('24 source hours remain raw while the canonical value is one elapsed day', () => {
  const claim = fixture().claim;
  assert.equal(claim.raw_value, 'twenty-four (24) hours after receipt');
  assert.equal(claim.canonical_value, '1');
  assert.equal(claim.unit, 'DAYS');
  assert.equal(claim.day_basis, 'ELAPSED');
  assert.equal(
    claim.attributes.basis_key,
    'DAYS:ELAPSED:PROPOSAL_OR_REQUEST_RECEIPT',
  );
  assert.deepEqual(claim.attributes.source_raw_duration, {
    magnitude: '24',
    unit: 'HOURS',
    day_basis: 'ELAPSED',
  });
  assert.equal(claim.attributes.promptly_qualifier, true);
  assert.equal(
    claim.attributes.outside_cap_semantic_code,
    'PROMPTLY_AND_NO_LATER_THAN_STATED_DURATION',
  );
});

test('the primary and alternative legal readings remain typed and lawyer-visible', () => {
  const value = fixture();
  assert.equal(
    value.interpretation.primary_interpretation.code,
    'RECEIPT_OF_PRIOR_CLAUSE_COMPANY_ACQUISITION_PROPOSAL_OR_COMPANY_REQUEST',
  );
  assert.deepEqual(
    value.interpretation.primary_interpretation.trigger_operand_codes,
    [
      'RECEIPT_OF_COMPANY_ACQUISITION_PROPOSAL',
      'RECEIPT_OF_SOURCE_DEFINED_COMPANY_REQUEST',
    ],
  );
  assert.equal(
    value.interpretation.alternative_interpretations[0].code,
    'RECEIPT_BY_OBLIGATED_PARTY_OF_ITEM_REQUIRED_TO_BE_COPIED',
  );
  assert.deepEqual(value.interpretation.ambiguity_dimension_codes, [
    'REFERENT',
    'SCOPE',
    'CARDINALITY',
  ]);
  assert.equal(value.presentation.lawyer_warning_required, true);
  assert.match(
    value.presentation.ambiguity_warning_text,
    /item to be copied/,
  );
});

test('F17 builds one complete comparable result with exact claim lineage', () => {
  const value = fixture();
  assert.equal(value.result.result_key, RESULT_KEY);
  assert.equal(value.result.value_slot_key, VALUE_SLOT_KEY);
  assert.equal(value.result.concept_key, 'NOSOL-NOTICE');
  assert.equal(value.result.completeness, 'COMPLETE');
  assert.equal(value.result.comparability, 'COMPARABLE');
  assert.deepEqual(value.result.claim_revision_ids, [
    value.claim.claim_revision_id,
  ]);
  assert.deepEqual(value.result.relationship_revision_ids, []);
});

test('F17 remains excluded from active serving and release authority', () => {
  const value = fixture();
  assert.equal(
    FIXTURE_SERVING_CONTRACT_FINGERPRINTS.includes(
      value.contract_binding.contract_fingerprint,
    ),
    false,
  );
  assert.equal(
    value.status.claim_materialisation_authority,
    'OFFLINE_REVIEWED_ONLY',
  );
  assert.equal(
    value.status.result_materialisation_authority,
    'OFFLINE_REVIEWED_ONLY',
  );
  assert.equal(value.status.candidate_projection_authority, 'NONE');
  assert.equal(value.status.candidate_release_authority, 'NONE');
  assert.equal(value.status.active_serving_authority, 'NONE');
  assert.equal(value.status.active_query_authority, 'NONE');
  assert.equal(value.status.active_pointer_authority, 'NONE');
  assert.equal(value.status.publication_blocked, true);
  assert.equal(value.status.release_eligible, false);
  assert.deepEqual(value.status.blocker_codes, [
    'F18_SHARED_ROW_AND_EXACT_DETAIL_REQUIRED',
  ]);
});

test('interpretation or claim identity drift is rejected', () => {
  const value = fixture();
  const policy = compileFixtureContractV12()
    .claim_interpretation_policy_definition;
  const changedInterpretation = structuredClone(value.interpretation);
  changedInterpretation.ambiguity_dimension_codes = ['REFERENT'];
  assert.throws(() => validateClaimInterpretation({
    claim_interpretation: changedInterpretation,
    policy,
  }), /identity has drifted/);
  const changedClaim = structuredClone(value.claim);
  changedClaim.canonical_value = '2';
  assert.throws(() => validateInterpretedPresentClaimRevision({
    claim: changedClaim,
    interpretation: value.interpretation,
    policy,
    allowed_attributes: Object.keys(value.claim.attributes),
    codebooks: {},
    expected_attributes: value.claim.attributes,
  }), /revision identity has drifted/);
});

test('clarity cardinality and claim-to-interpretation occurrence binding fail closed', () => {
  const value = fixture();
  const policy = compileFixtureContractV12()
    .claim_interpretation_policy_definition;
  assert.throws(() => buildClaimInterpretation({
    claim_occurrence_id: value.claim.claim_occurrence_id,
    policy,
    ...value.interpretation,
    alternative_interpretations: [],
    ambiguity_dimension_codes: [],
  }), /outside the frozen policy/);
  const wrongClaim = structuredClone(value.claim);
  wrongClaim.claim_occurrence_id = 'f'.repeat(64);
  assert.throws(() => validateInterpretedPresentClaimRevision({
    claim: wrongClaim,
    interpretation: value.interpretation,
    policy,
    allowed_attributes: Object.keys(value.claim.attributes),
    codebooks: {},
    expected_attributes: value.claim.attributes,
  }), /outside the closed contract/);
});

test('ungoverned attributes and taxonomy cannot pass the generic V2 validator', () => {
  const value = fixture();
  const policy = compileFixtureContractV12()
    .claim_interpretation_policy_definition;
  const unknownAttribute = structuredClone(value.claim);
  unknownAttribute.attributes.unknown_legal_guess = true;
  assert.throws(() => validateInterpretedPresentClaimRevision({
    claim: unknownAttribute,
    interpretation: value.interpretation,
    policy,
    allowed_attributes: Object.keys(value.claim.attributes),
    codebooks: {},
    expected_attributes: value.claim.attributes,
  }), /attributes violate/);
  const unknownTaxonomy = structuredClone(value.claim);
  unknownTaxonomy.taxonomy_codes = { timing: 'PLAUSIBLE_GUESS' };
  assert.throws(() => validateInterpretedPresentClaimRevision({
    claim: unknownTaxonomy,
    interpretation: value.interpretation,
    policy,
    allowed_attributes: Object.keys(value.claim.attributes),
    codebooks: {},
    expected_attributes: value.claim.attributes,
  }), /taxonomy violates/);
});

test('the staging path remains one bounded select-only read', () => {
  const source = withoutF20RollbackOnlyCertification(
    fs.readFileSync(RUNNER, 'utf8'),
  );
  assert.match(source, /--copy-delivery-claim-f17-verify/);
  assert.match(source, /LIMIT 2/);
  const start = source.indexOf(
    'function buildCopyDeliveryClaimF17Attestation',
  );
  const end = source.indexOf('\nfunction ', start + 1);
  assert.doesNotMatch(
    source.slice(start, end),
    /\b(?:INSERT|UPDATE|DELETE|UPSERT)\b/,
  );
});

test('all F17 identities are pinned', () => {
  const value = fixture();
  assert.equal(
    value.interpretation.interpretation_payload_id,
    '37cb53c93218aa39f22e6055808f08dce5d9c0b172baeca21e0955b2c9dd6e56',
  );
  assert.equal(
    value.claim.claim_occurrence_id,
    '8c4caf3744d4b40245ccc122d77286134394b98b0261ba01d088c9327c7078cf',
  );
  assert.equal(
    value.claim.claim_revision_id,
    'e622340d03ffda82adf750a597723f715d6abb9b6b8bbec659a72bc4242cacd2',
  );
  assert.equal(
    value.result.component_revision_id,
    'c92142e85bb79ff91a0c4fc5e78711d38aa1e55fe4dde8081f2104e46e66a743',
  );
  assert.equal(
    value.qxo_no_shop_copy_delivery_claim_f17_id,
    'f89db21d30e4985296c82abd7cdd6df63452f0fd61503d27a834c8c9c199c753',
  );
  assert.equal(
    value.canonical_payload_digest,
    '01ff52425c64daac1ad40654c2848619b567d95c9884b8f30201b58963fe97dd',
  );
});
