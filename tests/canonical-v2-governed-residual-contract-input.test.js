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
  '../.github/phase-allowlists/wp-p1-governed-residual-contract-family-v2.json',
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

function definition(values, stableId) {
  return values.find(
    (member) => member.canonical_value.stable_id === stableId,
  ).canonical_value.definition;
}

function expectCode(code, mutate) {
  const hostile = clone(members());
  mutate(hostile);
  assert.throws(
    () => validateAuthoredGovernedResidualInputs(hostile),
    (error) => error.code === code,
  );
}

test('accepts only the complete governed-residual contract family', () => {
  const exact = members();
  assert.equal(validateAuthoredGovernedResidualInputs(exact), true);
  assert.equal(validateAuthoredGovernedResidualInputs(clone(exact)), true);
  assert.deepEqual(
    exact.map((member) => member.canonical_value.stable_id).sort(),
    GOVERNED_RESIDUAL_CONTRACT_IDS,
  );

  assert.throws(
    () => validateAuthoredGovernedResidualInputs(exact.slice(1)),
    (error) => error.code === 'GOVERNED_RESIDUAL_CONTRACT_MEMBERSHIP_MISMATCH',
  );
  assert.throws(
    () => validateAuthoredGovernedResidualInputs([...exact, clone(exact[0])]),
    (error) => error.code === 'GOVERNED_RESIDUAL_CONTRACT_MEMBERSHIP_MISMATCH',
  );
});

test('rejects missing producers, carriers and boundary ownership collisions', () => {
  expectCode('GOVERNED_RESIDUAL_PRODUCER_TOTALITY_MISMATCH', (values) => {
    definition(
      values,
      'GOVERNED_RESIDUAL_PRODUCER_REGISTRY',
    ).producer_registry_contract.closed_producer_entries.shift();
  });
  expectCode('GOVERNED_RESIDUAL_PRODUCER_TOTALITY_MISMATCH', (values) => {
    definition(
      values,
      'GOVERNED_RESIDUAL_PRODUCER_REGISTRY',
    ).producer_registry_contract.closed_producer_entries[1]
      .residual_capable_boundaries[0] = 'INTAKE_REJECTION';
  });
  expectCode('GOVERNED_RESIDUAL_PRODUCER_TOTALITY_MISMATCH', (values) => {
    definition(
      values,
      'GOVERNED_RESIDUAL_PRODUCER_REGISTRY',
    ).producer_registry_contract.closed_producer_entries[0]
      .residual_carrier_schema_id = null;
  });
});

test('rejects observation lineage loss and mutable identity inputs', () => {
  expectCode('GOVERNED_RESIDUAL_OBSERVATION_LINEAGE_MISMATCH', (values) => {
    definition(
      values,
      'GOVERNED_RESIDUAL_OBSERVATION',
    ).observation_contract.required_payload_fields.splice(8, 2);
  });
  expectCode('GOVERNED_RESIDUAL_OBSERVATION_LINEAGE_MISMATCH', (values) => {
    definition(
      values,
      'GOVERNED_RESIDUAL_OBSERVATION',
    ).identity_contract.required_identity_inputs[0] =
      'governing_contract_bundle_id';
  });
  expectCode('GOVERNED_RESIDUAL_OBSERVATION_LINEAGE_MISMATCH', (values) => {
    definition(
      values,
      'GOVERNED_RESIDUAL_OBSERVATION',
    ).observation_contract.explicit_no_span_requires_source_reference_and_reason =
      false;
  });
});

test('rejects dropped admission atoms and incomplete source receipts', () => {
  expectCode('SEMANTIC_BOUNDARY_ADMISSION_CONTRACT_MISMATCH', (values) => {
    definition(
      values,
      'SEMANTIC_BOUNDARY_ADMISSION',
    ).admission_contract.one_receipt_per_exact_input_atom = false;
  });
  expectCode('SEMANTIC_BOUNDARY_ADMISSION_CONTRACT_MISMATCH', (values) => {
    definition(
      values,
      'SEMANTIC_BOUNDARY_ADMISSION',
    ).admission_contract.receipt_binds_exact_source_coordinates_or_governed_no_span =
      false;
  });
  expectCode('SEMANTIC_BOUNDARY_ADMISSION_CONTRACT_MISMATCH', (values) => {
    definition(
      values,
      'SEMANTIC_BOUNDARY_ADMISSION',
    ).slot_registry_contract.required_entry_fields.pop();
  });
});

test('rejects collapsed terminal branches and double consumption', () => {
  expectCode('SEMANTIC_BOUNDARY_CONSUMPTION_CONTRACT_MISMATCH', (values) => {
    definition(
      values,
      'SEMANTIC_BOUNDARY_CONSUMPTION',
    ).consumption_contract.closed_terminal_kinds = [
      'GOVERNED_CARRIER',
      'GOVERNED_RESIDUAL',
    ];
  });
  expectCode('SEMANTIC_BOUNDARY_CONSUMPTION_CONTRACT_MISMATCH', (values) => {
    definition(
      values,
      'SEMANTIC_BOUNDARY_CONSUMPTION',
    ).consumption_contract.duplicate_or_multiple_consumption_permitted = true;
  });
  expectCode('SEMANTIC_BOUNDARY_CONSUMPTION_CONTRACT_MISMATCH', (values) => {
    definition(
      values,
      'SEMANTIC_BOUNDARY_CONSUMPTION',
    ).reconciliation_contract.required_empty_difference_roots.splice(3, 1);
  });
});

test('rejects incomplete universe heads, prefixes and root payload bindings', () => {
  expectCode('GOVERNED_RESIDUAL_UNIVERSE_CONTRACT_MISMATCH', (values) => {
    definition(
      values,
      'GOVERNED_RESIDUAL_UNIVERSE',
    ).universe_contract.pre_scope_predecessor_or_genesis_required = false;
  });
  expectCode('GOVERNED_RESIDUAL_UNIVERSE_CONTRACT_MISMATCH', (values) => {
    definition(
      values,
      'GOVERNED_RESIDUAL_UNIVERSE',
    ).universe_contract.candidate_complete_adds_extraction_and_candidate_prefix_once =
      false;
  });
  expectCode('GOVERNED_RESIDUAL_UNIVERSE_CONTRACT_MISMATCH', (values) => {
    const bindings = definition(
      values,
      'GOVERNED_RESIDUAL_UNIVERSE',
    ).manifest_contract.required_bindings;
    bindings.splice(bindings.indexOf('terminal_consumption_root_set_payload_digest'), 1);
  });
});

test('rejects wrong dispositions, invalid duplicate links and cross-wired decisions', () => {
  expectCode('GOVERNED_RESIDUAL_DISPOSITION_CONTRACT_MISMATCH', (values) => {
    definition(
      values,
      'GOVERNED_RESIDUAL_DISPOSITION',
    ).disposition_contract.closed_final_dispositions[0] =
      'CORRECTED_AND_REPROCESSED';
  });
  expectCode('GOVERNED_RESIDUAL_DISPOSITION_CONTRACT_MISMATCH', (values) => {
    definition(
      values,
      'GOVERNED_RESIDUAL_DISPOSITION',
    ).duplicate_contract.cycles_permitted = true;
  });
  expectCode('GOVERNED_RESIDUAL_DISPOSITION_CONTRACT_MISMATCH', (values) => {
    definition(
      values,
      'GOVERNED_RESIDUAL_DISPOSITION',
    ).duplicate_contract.links_must_target_earliest_equivalent_residual = false;
  });
  expectCode('GOVERNED_RESIDUAL_DISPOSITION_CONTRACT_MISMATCH', (values) => {
    definition(
      values,
      'GOVERNED_RESIDUAL_DISPOSITION',
    ).review_decision_contract.required_eligibility_action =
      'CANDIDATE_FINAL_DISPOSITION';
  });
  expectCode('GOVERNED_RESIDUAL_DISPOSITION_CONTRACT_MISMATCH', (values) => {
    definition(
      values,
      'GOVERNED_RESIDUAL_DISPOSITION',
    ).review_decision_contract.cross_residual_or_cross_target_decision_reuse_permitted =
      true;
  });
});

test('rejects one-walker, stale-dependant and unresolved impact shortcuts', () => {
  expectCode('GOVERNED_RESIDUAL_IMPACT_CONTRACT_MISMATCH', (values) => {
    definition(
      values,
      'GOVERNED_RESIDUAL_IMPACT',
    ).governed_object_impact_contract.exactly_two_governed_object_walkers_required =
      false;
  });
  expectCode('GOVERNED_RESIDUAL_IMPACT_CONTRACT_MISMATCH', (values) => {
    definition(
      values,
      'GOVERNED_RESIDUAL_IMPACT',
    ).governed_object_impact_contract.walker_disagreement_blocks_closure =
      false;
  });
  expectCode('GOVERNED_RESIDUAL_IMPACT_CONTRACT_MISMATCH', (values) => {
    definition(
      values,
      'GOVERNED_RESIDUAL_IMPACT',
    ).governed_object_impact_contract.stale_dependant_detection_required =
      false;
  });
  expectCode('GOVERNED_RESIDUAL_IMPACT_CONTRACT_MISMATCH', (values) => {
    definition(
      values,
      'GOVERNED_RESIDUAL_IMPACT',
    ).projection_reconciliation_contract.unresolved_impact_root_required_empty =
      false;
  });
  expectCode('GOVERNED_RESIDUAL_IMPACT_CONTRACT_MISMATCH', (values) => {
    definition(
      values,
      'GOVERNED_RESIDUAL_IMPACT',
    ).final_residual_impact_contract.fully_incorporated_zero_distinct_from_non_substantive_zero =
      false;
  });
});

test('rejects false empty queues and queue-based nonzero impact blocking', () => {
  expectCode('GOVERNED_RESIDUAL_REVIEW_QUEUE_CONTRACT_MISMATCH', (values) => {
    const roots = definition(
      values,
      'GOVERNED_RESIDUAL_REVIEW_QUEUE',
    ).empty_root_contract.required_empty_difference_roots;
    roots.splice(roots.indexOf('invalid_link_root'), 1);
  });
  expectCode('GOVERNED_RESIDUAL_REVIEW_QUEUE_CONTRACT_MISMATCH', (values) => {
    const roots = definition(
      values,
      'GOVERNED_RESIDUAL_REVIEW_QUEUE',
    ).empty_root_contract.required_empty_difference_roots;
    roots.splice(roots.indexOf('unresolved_impact_root'), 1);
  });
  expectCode('GOVERNED_RESIDUAL_REVIEW_QUEUE_CONTRACT_MISMATCH', (values) => {
    definition(
      values,
      'GOVERNED_RESIDUAL_REVIEW_QUEUE',
    ).queue_contract.caller_supplied_empty_boolean_permitted = true;
  });
  expectCode('GOVERNED_RESIDUAL_REVIEW_QUEUE_CONTRACT_MISMATCH', (values) => {
    definition(
      values,
      'GOVERNED_RESIDUAL_REVIEW_QUEUE',
    ).queue_contract.reconciled_nonzero_impact_alone_is_queued = true;
  });
});

test('rejects authority escalation and unreviewed definition drift', () => {
  expectCode('GOVERNED_RESIDUAL_AUTHORITY_ESCALATION', (values) => {
    definition(
      values,
      'GOVERNED_RESIDUAL_IMPACT',
    ).authority_contract.creates_writer_execution_authority = true;
  });
  expectCode('INVALID_GOVERNED_RESIDUAL_CONTRACT_INPUT', (values) => {
    definition(
      values,
      'GOVERNED_RESIDUAL_OBSERVATION',
    ).observation_contract.schema_id = 'GOVERNED_RESIDUAL_OBSERVATION/V2';
  });
});

test('uses one exact successor phase allowlist', () => {
  const allowlist = JSON.parse(fs.readFileSync(ALLOWLIST, 'utf8'));
  assert.equal(
    allowlist.phase,
    'WP-P1-GOVERNED-RESIDUAL-CONTRACT-FAMILY-V2',
  );
  assert.equal(allowlist.required_work_class, 'canonical_work_start');
  assert.deepEqual(allowlist.allowed, [
    '.github/phase-allowlists/wp-p1-governed-residual-contract-family-v2.json',
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
  assert.match(
    allowlist.note,
    /central manifest, compiler, count, signer and status integration remain separate/i,
  );
});
