const test = require('node:test');
const assert = require('node:assert/strict');

const { canonicalJson, contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  COMPLETE_SELECTED_INPUT_FAMILIES,
  SINGLE_INPUTS_THAT_NEVER_DECIDE_CONTROL,
  buildTransactionControlOutcomeOccurrence,
  buildTransactionControlOutcomeRevision,
  validateTransactionControlOutcomeOccurrence,
  validateTransactionControlOutcomeRevision,
} = require('../lib/canonical-v2/transaction-control-outcome');

const id = (value) => contentId('TRANSACTION_CONTROL_TEST/V1', value);

const structureNames = [
  'direct merger',
  'forward triangular merger',
  'reverse triangular merger',
  'merger of equals',
  'reverse merger',
  'Reverse Morris Trust',
  'tender offer and second-step merger',
  'new holdco stock combination',
  'stock-for-stock exchange',
  'spin-merge',
  'share purchase',
  'asset acquisition',
  'de-SPAC',
  'sponsor consortium',
  'joint venture combination',
];

function occurrence(overrides = {}) {
  return buildTransactionControlOutcomeOccurrence({
    control_outcome_definition_and_version: {
      definition_key: 'TRANSACTION_CONTROL_OUTCOME',
      definition_version: 1,
    },
    effective_time_slot: 'POST_CLOSING',
    expected_control_outcome_slot_key: 'PRIMARY_CONTROL_OUTCOME',
    governed_deal_id: id('deal'),
    governed_ordinal: 0,
    ...overrides,
  });
}

function completeInputSet(label, evidenceEdges) {
  return Object.fromEntries(COMPLETE_SELECTED_INPUT_FAMILIES.map((family) => [
    family,
    family === 'EXACT_EVIDENCE_EDGES'
      ? evidenceEdges
      : [id(`${label}-${family}`)],
  ]));
}

function revision(label = 'default', overrides = {}) {
  const evidenceEdges = [id(`${label}-evidence`)];
  return buildTransactionControlOutcomeRevision({
    transaction_control_outcome_occurrence: occurrence(),
    complete_selected_input_set: completeInputSet(label, evidenceEdges),
    conflict_disposition: 'CLEAR',
    controlling_entity_ids: [id(`${label}-controller`)],
    control_outcome: 'CONTROLLED_BY_ONE_PARTICIPANT',
    derivation_rule: {
      observed_signals: ['BOARD_APPOINTMENT_RIGHT', 'VOTING_MAJORITY'],
      rule_key: 'MULTI_SIGNAL_CONTROL_RESOLUTION',
      rule_version: 1,
      supporting_input_families: [
        'BOARD_COMPOSITION_FACT_RESOLUTIONS',
        'VOTING_OWNERSHIP_FACT_RESOLUTIONS',
      ],
    },
    effective_time: id(`${label}-effective-time`),
    evidence_edges: evidenceEdges,
    resolver_version: 'transaction-control-resolver/v1',
    state: { code: 'PRESENT' },
    ...overrides,
  });
}

function emptyInputSet() {
  return Object.fromEntries(
    COMPLETE_SELECTED_INPUT_FAMILIES.map((family) => [family, []]),
  );
}

test('each governed control outcome enforces controller cardinality', () => {
  const cases = [
    ['CONTROLLED_BY_ONE_PARTICIPANT', [id('one')]],
    ['SHARED_CONTROL', [id('one'), id('two')]],
    ['NEW_HOLDCO_SHARED_CONTROL', [id('one'), id('two')]],
    ['NO_CLEAR_CONTROL', []],
  ];
  cases.forEach(([controlOutcome, controllingEntityIds], index) => {
    const result = revision(`outcome-${index}`, {
      control_outcome: controlOutcome,
      controlling_entity_ids: controllingEntityIds,
    });
    assert.equal(result.control_outcome, controlOutcome);
    assert.equal(result.terminal_eligible, true);
  });
});

test('every approved transaction form rejects a one-signal control inference', () => {
  structureNames.forEach((structureName) => {
    assert.throws(() => revision(structureName, {
      derivation_rule: {
        observed_signals: ['SURVIVING_ENTITY'],
        rule_key: 'INVALID_SINGLE_SIGNAL_CONTROL',
        rule_version: 1,
        supporting_input_families: ['TRANSACTION_LEG_RESOLUTION_REVISIONS'],
      },
    }), (error) => error.code === 'SINGLE_SIGNAL_CONTROL_INFERENCE');
  });
});

test('all named single signals fail closed when used alone', () => {
  SINGLE_INPUTS_THAT_NEVER_DECIDE_CONTROL.forEach((signal) => {
    assert.throws(() => revision(`single-${signal}`, {
      derivation_rule: {
        observed_signals: [signal],
        rule_key: 'INVALID_SINGLE_SIGNAL_CONTROL',
        rule_version: 1,
        supporting_input_families: ['PARTICIPANT_RELATIONSHIP_REVISIONS'],
      },
    }), (error) => error.code === 'SINGLE_SIGNAL_CONTROL_INFERENCE');
  });
});

test('two weak facts still cannot decide control together', () => {
  assert.throws(() => revision('two-weak-signals', {
    derivation_rule: {
      observed_signals: ['COMPANY_NAME', 'HEADQUARTERS'],
      rule_key: 'INVALID_NON_CONTROL_SIGNAL_RULE',
      rule_version: 1,
      supporting_input_families: [
        'PARTICIPANT_RELATIONSHIP_REVISIONS',
        'SOURCE_CHARACTERISATION_FACT_RESOLUTIONS',
      ],
    },
  }), (error) => error.code === 'NON_CONTROL_SIGNAL_INFERENCE');
});

test('exact evidence is not a second substantive control input family', () => {
  assert.throws(() => revision('evidence-is-not-a-signal', {
    derivation_rule: {
      observed_signals: ['BOARD_APPOINTMENT_RIGHT', 'VOTING_MAJORITY'],
      rule_key: 'INVALID_EVIDENCE_AS_SIGNAL_RULE',
      rule_version: 1,
      supporting_input_families: [
        'EXACT_EVIDENCE_EDGES',
        'VOTING_OWNERSHIP_FACT_RESOLUTIONS',
      ],
    },
  }), (error) => error.code === 'SINGLE_SIGNAL_CONTROL_INFERENCE');
});

test('a present control outcome requires all seven selected input families', () => {
  const label = 'incomplete';
  const evidenceEdges = [id(`${label}-evidence`)];
  const incomplete = completeInputSet(label, evidenceEdges);
  incomplete.MANAGEMENT_FACT_RESOLUTIONS = [];
  assert.throws(() => revision(label, {
    complete_selected_input_set: incomplete,
  }), (error) => error.code === 'INCOMPLETE_TRANSACTION_CONTROL_INPUT');
});

test('the exact-evidence input family must equal the revision evidence', () => {
  const label = 'unbound-evidence';
  const evidenceEdges = [id(`${label}-evidence`)];
  const inputs = completeInputSet(label, evidenceEdges);
  inputs.EXACT_EVIDENCE_EDGES = [id('different-evidence')];
  assert.throws(() => revision(label, {
    complete_selected_input_set: inputs,
  }), (error) => error.code === 'UNBOUND_TRANSACTION_CONTROL_EVIDENCE');
});

test('control outcome cardinality rejects false controllers', () => {
  assert.throws(() => revision('one-with-two', {
    controlling_entity_ids: [id('one'), id('two')],
  }), (error) => error.code === 'INVALID_TRANSACTION_CONTROL_CARDINALITY');
  assert.throws(() => revision('shared-with-one', {
    control_outcome: 'SHARED_CONTROL',
    controlling_entity_ids: [id('one')],
  }), (error) => error.code === 'INVALID_TRANSACTION_CONTROL_CARDINALITY');
  assert.throws(() => revision('no-clear-with-one', {
    control_outcome: 'NO_CLEAR_CONTROL',
    controlling_entity_ids: [id('one')],
  }), (error) => error.code === 'INVALID_TRANSACTION_CONTROL_CARDINALITY');
});

test('ABSENT does not mean that the resolver found no controller', () => {
  assert.throws(() => buildTransactionControlOutcomeRevision({
    transaction_control_outcome_occurrence: occurrence(),
    complete_selected_input_set: emptyInputSet(),
    conflict_disposition: 'CLEAR',
    controlling_entity_ids: [],
    control_outcome: 'NO_CLEAR_CONTROL',
    derivation_rule: null,
    effective_time: null,
    evidence_edges: [id('absent-evidence')],
    resolver_version: 'transaction-control-resolver/v1',
    state: {
      code: 'ABSENT',
      complete_scope_id: id('complete-control-scope'),
    },
  }), (error) => error.code === 'NON_PRESENT_TRANSACTION_CONTROL_VALUE');
});

test('control occurrences are deterministic and value-independent', () => {
  const controlOccurrence = occurrence();
  assert.equal(validateTransactionControlOutcomeOccurrence(controlOccurrence), true);
  assert.equal(canonicalJson(controlOccurrence), canonicalJson(occurrence()));
  assert.throws(() => occurrence({ control_outcome: 'SHARED_CONTROL' }),
    (error) => error.code === 'INVALID_TRANSACTION_CONTROL');
  assert.throws(() => occurrence({ ownership_percentage: 51 }),
    (error) => error.code === 'INVALID_TRANSACTION_CONTROL');
});

test('validators reject a stale control revision', () => {
  const controlOccurrence = occurrence();
  const controlRevision = revision('stale', {
    transaction_control_outcome_occurrence: controlOccurrence,
  });
  assert.equal(validateTransactionControlOutcomeRevision({
    revision: controlRevision,
    transaction_control_outcome_occurrence: controlOccurrence,
  }), true);
  assert.throws(() => validateTransactionControlOutcomeRevision({
    revision: {
      ...structuredClone(controlRevision),
      transaction_control_outcome_revision_id: id('stale-control'),
    },
    transaction_control_outcome_occurrence: controlOccurrence,
  }), (error) => error.code === 'STALE_TRANSACTION_CONTROL_REVISION');
});
