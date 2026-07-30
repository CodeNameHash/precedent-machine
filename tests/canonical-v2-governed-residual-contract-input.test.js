const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  GOVERNED_RESIDUAL_CONTRACT_IDS,
  validateAuthoredGovernedResidualInputs,
} = require('../lib/canonical-v2/governed-residual-contract-input-validator');

const ROOT = path.join(
  __dirname,
  '../contracts/canonical-v2/successor/governance/residuals',
);
const ALLOWLIST = path.join(
  __dirname,
  '../.github/phase-allowlists/wp-p1-governed-residual-contract-family-v1.json',
);
const FILES = Object.freeze([
  'governed-residual-disposition.v1.json',
  'governed-residual-impact.v1.json',
  'governed-residual-observation.v1.json',
  'governed-residual-producer-registry.v1.json',
  'governed-residual-review-queue.v1.json',
  'governed-residual-universe.v1.json',
  'semantic-boundary-admission.v1.json',
  'semantic-boundary-consumption.v1.json',
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function members() {
  return FILES.map((file) => {
    const canonicalValue = JSON.parse(
      fs.readFileSync(path.join(ROOT, file), 'utf8'),
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
  );
}

test('accepts the exact complete governed-residual P1-P7 contract family', () => {
  const exact = members();

  assert.equal(validateAuthoredGovernedResidualInputs(exact), true);
  assert.equal(validateAuthoredGovernedResidualInputs(clone(exact)), true);
  assert.deepEqual(
    exact.map((member) => member.canonical_value.stable_id).sort(),
    GOVERNED_RESIDUAL_CONTRACT_IDS,
  );
});

test('binds the producer registry to source-backed isolated QXO and Metsera pilots', () => {
  const producer = byId(
    members(),
    'GOVERNED_RESIDUAL_PRODUCER_REGISTRY',
  ).canonical_value.definition;

  assert.deepEqual(
    producer.pilot_scope_contract.allowed_deal_keys,
    ['METSERA', 'QXO'],
  );
  assert.equal(producer.pilot_scope_contract.isolated_staging_only, true);
  assert.equal(producer.pilot_scope_contract.scope_widening_permitted, false);
  assert.equal(
    producer.producer_registry_contract.closed_producer_kinds.length,
    8,
  );
  assert.equal(
    producer.producer_registry_contract.closed_producer_kinds
      .every((entry) => entry.source_backed_evidence_required === true),
    true,
  );
});

test('keeps observation identity source-backed and independent of review and runtime state', () => {
  const observation = byId(
    members(),
    'GOVERNED_RESIDUAL_OBSERVATION',
  ).canonical_value.definition;

  assert.equal(
    observation.observation_contract.raw_value_or_bytes_must_be_retained,
    true,
  );
  assert.equal(
    observation.observation_contract.string_only_warning_permitted,
    false,
  );
  assert.deepEqual(
    observation.identity_contract.prohibited_identity_inputs,
    [
      'contract_freeze_attestation_id',
      'database_row_id',
      'disposition_id',
      'impact_closure_id',
      'model_run_id',
      'reviewer_id',
      'timestamp',
    ],
  );
});

test('closes every semantic boundary as one carrier or one residual', () => {
  const exact = members();
  const admission = byId(
    exact,
    'SEMANTIC_BOUNDARY_ADMISSION',
  ).canonical_value.definition.admission_contract;
  const consumption = byId(
    exact,
    'SEMANTIC_BOUNDARY_CONSUMPTION',
  ).canonical_value.definition.consumption_contract;

  assert.equal(admission.one_receipt_per_admitted_semantic_atom, true);
  assert.equal(admission.receipt_precedes_governed_carrier_or_residual, true);
  assert.deepEqual(
    consumption.terminal_outcomes,
    ['GOVERNED_CARRIER', 'GOVERNED_RESIDUAL'],
  );
  assert.equal(
    consumption.each_admission_has_exactly_one_terminal_outcome,
    true,
  );
  assert.equal(
    consumption.carrier_and_residual_dual_consumption_permitted,
    false,
  );
});

test('requires two independent residual universes and an exact reconciliation manifest', () => {
  const universe = byId(
    members(),
    'GOVERNED_RESIDUAL_UNIVERSE',
  ).canonical_value.definition;

  assert.deepEqual(
    universe.universe_contract.scope_codes,
    ['PRE_SCOPE', 'CANDIDATE_COMPLETE'],
  );
  assert.equal(
    universe.universe_contract.boundary_enumerator_must_not_read_producer_registry,
    true,
  );
  assert.equal(
    universe.universe_contract.bidirectional_identity_and_payload_equality_required,
    true,
  );
  assert.equal(universe.manifest_contract.required_empty_roots.length, 6);
  assert.equal(universe.manifest_contract.count_only_completeness_permitted, false);
});

test('separates final disposition, impact reconciliation and empty review queue', () => {
  const exact = members();
  const disposition = byId(
    exact,
    'GOVERNED_RESIDUAL_DISPOSITION',
  ).canonical_value.definition;
  const impact = byId(
    exact,
    'GOVERNED_RESIDUAL_IMPACT',
  ).canonical_value.definition;
  const queue = byId(
    exact,
    'GOVERNED_RESIDUAL_REVIEW_QUEUE',
  ).canonical_value.definition;

  assert.equal(
    disposition.disposition_contract.terminal_disposition_implies_impact_clearance,
    false,
  );
  assert.equal(
    impact.impact_contract.walkers_implementation_disjoint,
    true,
  );
  assert.equal(
    impact.impact_contract.terminal_disposition_implies_zero_impact,
    false,
  );
  assert.equal(
    queue.queue_contract.missing_or_unreconciled_impact_closure_is_queued,
    true,
  );
  assert.equal(
    queue.queue_contract.caller_supplied_empty_boolean_permitted,
    false,
  );
  assert.equal(
    queue.empty_root_contract.empty_root_is_certification_input_not_execution_authority,
    true,
  );
});

test('grants no runtime or downstream authority from any family member', () => {
  for (const member of members()) {
    const authority = member.canonical_value.definition.authority_contract;
    assert.equal(authority.definition_only, true);
    assert.equal(
      Object.entries(authority)
        .filter(([key]) => key !== 'definition_only')
        .every(([, value]) => value === false),
      true,
      member.canonical_value.stable_id,
    );
  }
});

test('rejects missing, duplicate and unregistered family members', () => {
  const exact = members();
  assert.throws(
    () => validateAuthoredGovernedResidualInputs(exact.slice(1)),
    (error) => error.code === 'GOVERNED_RESIDUAL_CONTRACT_MEMBERSHIP_MISMATCH',
  );
  assert.throws(
    () => validateAuthoredGovernedResidualInputs([...exact, clone(exact[0])]),
    (error) => error.code === 'GOVERNED_RESIDUAL_CONTRACT_MEMBERSHIP_MISMATCH',
  );

  const unknown = clone(exact);
  unknown[0].canonical_value.stable_id = 'UNREGISTERED_RESIDUAL_CONTRACT';
  assert.throws(
    () => validateAuthoredGovernedResidualInputs(unknown),
    (error) => error.code === 'GOVERNED_RESIDUAL_CONTRACT_MEMBERSHIP_MISMATCH',
  );
});

test('rejects source loss, scope widening and false empty-queue shortcuts', () => {
  const sourceLoss = clone(members());
  byId(
    sourceLoss,
    'GOVERNED_RESIDUAL_OBSERVATION',
  ).canonical_value.definition.observation_contract.source_backed_evidence_required = false;
  assert.throws(
    () => validateAuthoredGovernedResidualInputs(sourceLoss),
    (error) => error.code === 'INVALID_GOVERNED_RESIDUAL_CONTRACT_INPUT',
  );

  const widened = clone(members());
  byId(
    widened,
    'GOVERNED_RESIDUAL_PRODUCER_REGISTRY',
  ).canonical_value.definition.pilot_scope_contract.allowed_deal_keys.push('OTHER_DEAL');
  assert.throws(
    () => validateAuthoredGovernedResidualInputs(widened),
    (error) => error.code === 'INVALID_GOVERNED_RESIDUAL_CONTRACT_INPUT',
  );

  const falseEmpty = clone(members());
  byId(
    falseEmpty,
    'GOVERNED_RESIDUAL_REVIEW_QUEUE',
  ).canonical_value.definition.queue_contract.caller_supplied_empty_boolean_permitted = true;
  assert.throws(
    () => validateAuthoredGovernedResidualInputs(falseEmpty),
    (error) => error.code === 'INVALID_GOVERNED_RESIDUAL_CONTRACT_INPUT',
  );
});

test('rejects authority escalation and residual-impact suppression', () => {
  const authority = clone(members());
  byId(
    authority,
    'GOVERNED_RESIDUAL_IMPACT',
  ).canonical_value.definition.authority_contract.creates_writer_execution_authority = true;
  assert.throws(
    () => validateAuthoredGovernedResidualInputs(authority),
    (error) => error.code === 'GOVERNED_RESIDUAL_AUTHORITY_ESCALATION',
  );

  const suppressed = clone(members());
  byId(
    suppressed,
    'GOVERNED_RESIDUAL_DISPOSITION',
  ).canonical_value.definition.disposition_contract
    .terminal_disposition_implies_impact_clearance = true;
  assert.throws(
    () => validateAuthoredGovernedResidualInputs(suppressed),
    (error) => error.code === 'INVALID_GOVERNED_RESIDUAL_CONTRACT_INPUT',
  );

  const oneWalker = clone(members());
  byId(
    oneWalker,
    'GOVERNED_RESIDUAL_IMPACT',
  ).canonical_value.definition.impact_contract.walkers_implementation_disjoint = false;
  assert.throws(
    () => validateAuthoredGovernedResidualInputs(oneWalker),
    (error) => error.code === 'INVALID_GOVERNED_RESIDUAL_CONTRACT_INPUT',
  );
});

test('uses one exact closed canonical-work-start allowlist', () => {
  const allowlist = JSON.parse(fs.readFileSync(ALLOWLIST, 'utf8'));
  assert.equal(allowlist.required_work_class, 'canonical_work_start');
  assert.deepEqual(allowlist.allowed, [
    '.github/phase-allowlists/wp-p1-governed-residual-contract-family-v1.json',
    'contracts/canonical-v2/successor/governance/residuals/governed-residual-disposition.v1.json',
    'contracts/canonical-v2/successor/governance/residuals/governed-residual-impact.v1.json',
    'contracts/canonical-v2/successor/governance/residuals/governed-residual-observation.v1.json',
    'contracts/canonical-v2/successor/governance/residuals/governed-residual-producer-registry.v1.json',
    'contracts/canonical-v2/successor/governance/residuals/governed-residual-review-queue.v1.json',
    'contracts/canonical-v2/successor/governance/residuals/governed-residual-universe.v1.json',
    'contracts/canonical-v2/successor/governance/residuals/semantic-boundary-admission.v1.json',
    'contracts/canonical-v2/successor/governance/residuals/semantic-boundary-consumption.v1.json',
    'lib/canonical-v2/governed-residual-contract-input-validator.js',
    'tests/canonical-v2-governed-residual-contract-input.test.js',
  ]);
  assert.match(
    allowlist.note,
    /no extraction, database, writer execution, serving, release, import, activation, production/i,
  );
  assert.match(allowlist.note, /central manifest, compiler, signer and status integration remain separate/i);
});
