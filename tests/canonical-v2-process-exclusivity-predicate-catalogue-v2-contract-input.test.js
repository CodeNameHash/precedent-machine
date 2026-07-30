const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  validateAuthoredProcessPredicateInputs,
} = require('../lib/canonical-v2/process-predicate-contract-input-validator');

const ROOT = path.join(__dirname, '../contracts/canonical-v2/successor');
const ALLOWLIST_PATH = path.join(
  __dirname,
  '../.github/phase-allowlists/wp-process-exclusivity-predicate-machine-rules-v2.json',
);
const EXPECTED_PREDECESSOR_KEYS = [
  'EXCLUSIVITY_REQUESTED',
  'EXCLUSIVITY_SUBJECT',
  'EXCLUSIVITY_REQUESTER',
  'EXCLUSIVITY_RECIPIENT',
  'EXCLUSIVITY_EXPRESS_REFUSAL',
  'EXCLUSIVITY_COUNTERPROPOSAL',
  'EXCLUSIVITY_CONDITIONAL_ACCEPTANCE',
  'EXCLUSIVITY_RESPONSE_ANY',
  'EXCLUSIVITY_GRANTED',
  'EXCLUSIVITY_GRANTOR',
  'EXCLUSIVITY_BENEFICIARY',
  'EXCLUSIVITY_START',
  'EXCLUSIVITY_END',
  'EXCLUSIVITY_DURATION',
  'EXCLUSIVITY_EXTENSION',
  'EXCLUSIVITY_AMENDMENT',
  'EXCLUSIVITY_WAIVER',
  'EXCLUSIVITY_EXPIRY',
  'EXCLUSIVITY_RATIONALE',
  'EXCLUSIVITY_CONDITION',
  'EXCLUSIVITY_BIDDER_TRACK',
  'EXCLUSIVITY_RESPONSE_RELATIONSHIP',
  'EXCLUSIVITY_ACTUAL_DRAFTING',
];
const EXPECTED_NEW_DEFINITIONS = [
  {
    predicate_key: 'EXCLUSIVITY_BOUND_ACTOR_SCOPE',
    predicate_version: 1,
    exact_semantic_requirement:
      'Govern every entity and representative category bound by the exclusivity covenant, plus the control, direction or efforts standard used to cause compliance.',
  },
  {
    predicate_key: 'EXCLUSIVITY_CONDUCT_LINKAGE_STANDARD',
    predicate_version: 1,
    exact_semantic_requirement:
      'Govern whether restricted conduct is direct or indirect, alone, jointly or through another person, including each knowledge, intent and materiality qualifier.',
  },
  {
    predicate_key: 'EXCLUSIVITY_RESTRICTED_ACTION',
    predicate_version: 1,
    exact_semantic_requirement:
      'Govern each action that the exclusivity covenant permits or prohibits, with exact action code, polarity, actor, subject, bidder track, qualifier, condition and source passage.',
  },
  {
    predicate_key: 'EXCLUSIVITY_SHUTDOWN_OBLIGATION',
    predicate_version: 1,
    exact_semantic_requirement:
      'Govern each affirmative duty to stop an existing process, including communications, negotiations, information access, data-room access and information return or destruction.',
  },
  {
    predicate_key: 'EXCLUSIVITY_STANDSTILL_TREATMENT',
    predicate_version: 1,
    exact_semantic_requirement:
      'Govern standstill and similar restrictions, including whether addressed and whether release, waiver or amendment is permitted, required or prohibited, with decision-maker, consent, notice, timing and scope.',
  },
  {
    predicate_key: 'EXCLUSIVITY_NOTICE_REQUIREMENT',
    predicate_version: 1,
    exact_semantic_requirement:
      'Govern each exclusivity notice duty with its trigger, recipient, deadline, measuring event, form and recordkeeping requirement.',
  },
  {
    predicate_key: 'EXCLUSIVITY_NOTICE_CONTENT',
    predicate_version: 1,
    exact_semantic_requirement:
      'Govern the content and continuing-update duties for exclusivity notices, including bidder identity, material terms, documents, correspondence, amendments and matching-process information.',
  },
  {
    predicate_key: 'EXCLUSIVITY_QUALIFYING_PROPOSAL_STANDARD',
    predicate_version: 1,
    exact_semantic_requirement:
      'Govern the superior-proposal or comparable qualifying-bid test, including bona fides, form, transaction threshold, financial comparison, non-financial factors and comparison adjustments.',
  },
  {
    predicate_key: 'EXCLUSIVITY_BIDDER_PARTICIPANT_SCOPE',
    predicate_version: 1,
    exact_semantic_requirement:
      'Govern the bidder-side people and entities included in permitted or restricted contact, including representatives, financing sources, affiliates, funds, co-investors and groups.',
  },
  {
    predicate_key: 'EXCLUSIVITY_RECOMMENDATION_CHANGE',
    predicate_version: 1,
    exact_semantic_requirement:
      'Govern each restricted or permitted board recommendation change, including withdrawal, qualification, failure to reaffirm, endorsement, disclosure and applicable exception process.',
  },
  {
    predicate_key: 'EXCLUSIVITY_TENDER_OFFER_RESPONSE',
    predicate_version: 1,
    exact_semantic_requirement:
      'Govern the special contractual response to a tender offer or exchange offer, including trigger, permitted or required response, deadline and contractual treatment.',
  },
  {
    predicate_key: 'EXCLUSIVITY_INTERVENING_EVENT_EXCEPTION',
    predicate_version: 1,
    exact_semantic_requirement:
      'Govern an intervening-event exception, including definition, exclusions, board and legal findings, notice and matching consequences.',
  },
  {
    predicate_key: 'EXCLUSIVITY_SUPERIOR_PROPOSAL_TERMINATION',
    predicate_version: 1,
    exact_semantic_requirement:
      'Govern termination of the signed agreement for a superior proposal, including availability, board finding, notice, matching completion, fee payment and concurrent alternative agreement.',
  },
  {
    predicate_key: 'EXCLUSIVITY_ALTERNATIVE_TRANSACTION_FEE',
    predicate_version: 1,
    exact_semantic_requirement:
      'Govern each fee or payment tied to an alternative transaction or exclusivity outcome, including amount or formula, trigger, payer, payee, timing, method and bidder-category variation.',
  },
  {
    predicate_key: 'EXCLUSIVITY_PUBLIC_DISCLOSURE',
    predicate_version: 1,
    exact_semantic_requirement:
      'Govern required and permitted public disclosure about competing approaches or board action, including consultation, notice and legal-requirement limits.',
  },
  {
    predicate_key: 'EXCLUSIVITY_GOVERNING_DOCUMENT',
    predicate_version: 1,
    exact_semantic_requirement:
      'Govern the agreement, section, party relationship, incorporated document and priority or conflict rule that controls the exclusivity answer.',
  },
  {
    predicate_key: 'EXCLUSIVITY_REMEDY',
    predicate_version: 1,
    exact_semantic_requirement:
      'Govern the remedy for breach of exclusivity, including specific performance, injunction, damages, fees, limitations, forum, governing law and dispute process.',
  },
  {
    predicate_key: 'EXCLUSIVITY_COUNTERPARTY_RESPONSE_EFFECT',
    predicate_version: 1,
    exact_semantic_requirement:
      'Govern the downstream contractual effect of counterparty action, inaction or refusal while preserving express refusal as distinct from silence or absence of a recorded response.',
  },
];
const EXPECTED_SUCCESSOR_SEMANTIC_KINDS = [
  'BOUND_ACTOR_SCOPE',
  'CONDUCT_LINKAGE_STANDARD',
  'RESTRICTED_ACTION',
  'SHUTDOWN_OBLIGATION',
  'STANDSTILL_TREATMENT',
  'NOTICE_REQUIREMENT',
  'NOTICE_CONTENT',
  'QUALIFYING_PROPOSAL_STANDARD',
  'BIDDER_PARTICIPANT_SCOPE',
  'RECOMMENDATION_CHANGE',
  'TENDER_OFFER_RESPONSE',
  'INTERVENING_EVENT_EXCEPTION',
  'SUPERIOR_PROPOSAL_TERMINATION',
  'ALTERNATIVE_TRANSACTION_FEE',
  'PUBLIC_DISCLOSURE',
  'GOVERNING_DOCUMENT',
  'REMEDY',
  'COUNTERPARTY_RESPONSE_EFFECT',
];

function loadValue(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function member(value) {
  return {
    object_kind: value.object_kind,
    canonical_value: value,
  };
}

function members(catalogue = loadValue(
  'process/predicates/exclusivity-predicate-catalogue.v2.json',
)) {
  return [
    member(loadValue(
      'process/predicates/exclusivity-completeness-challenge-protocol.v1.json',
    )),
    member(catalogue),
  ];
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('admits one exact version-2 exclusivity predicate catalogue', () => {
  assert.doesNotThrow(() => validateAuthoredProcessPredicateInputs(members()));
  const catalogue = members()[1].canonical_value;

  assert.equal(catalogue.stable_id, 'PROCESS_EXCLUSIVITY_PREDICATE_CATALOGUE');
  assert.equal(catalogue.definition.catalogue_version, 2);
  assert.deepEqual(catalogue.definition.predecessor_contract, {
    stable_id: 'PROCESS_EXCLUSIVITY_PREDICATE_CATALOGUE',
    schema_version: 'PROCESS_PREDICATE_CONTRACT_INPUT/V1',
    catalogue_version: 1,
    definition_digest:
      'sha256:a75fde64f61ac5d0d6b40034c1c206a3560ec20221db23d9a0cc677ed54f0360',
  });
});

test('preserves all 23 predecessor keys and adds the exact 18 definitions', () => {
  const definition = members()[1].canonical_value.definition;
  const keys = definition.ordinary_question_contract.mandatory_predicate_keys;

  assert.equal(keys.length, 41);
  assert.equal(new Set(keys).size, 41);
  assert.deepEqual(keys.slice(0, 23), EXPECTED_PREDECESSOR_KEYS);
  assert.deepEqual(
    keys.slice(23),
    EXPECTED_NEW_DEFINITIONS.map((value) => value.predicate_key),
  );
  assert.deepEqual(
    definition.successor_predicate_definition_contract.definitions.map(
      ({
        predicate_key: predicateKey,
        predicate_version: predicateVersion,
        exact_semantic_requirement: exactSemanticRequirement,
      }) => ({
        predicate_key: predicateKey,
        predicate_version: predicateVersion,
        exact_semantic_requirement: exactSemanticRequirement,
      }),
    ),
    EXPECTED_NEW_DEFINITIONS,
  );
  assert.equal(
    definition.successor_predicate_definition_contract.definitions_are_closed,
    true,
  );
  assert.equal(
    definition.successor_predicate_definition_contract
      .unknown_predicate_has_runtime_path,
    false,
  );
  assert.equal(
    definition.successor_predicate_definition_contract
      .near_key_mapping_permitted,
    false,
  );
});

test('closes the machine rule for every successor predicate', () => {
  const successor = members()[1].canonical_value.definition
    .successor_predicate_definition_contract;
  assert.deepEqual(
    successor.definitions.map(
      (definition) => definition.machine_rule.semantic_kind,
    ),
    EXPECTED_SUCCESSOR_SEMANTIC_KINDS,
  );
  for (const definition of successor.definitions) {
    const rule = definition.machine_rule;
    assert.equal(
      rule.value_grain,
      'ONE_ATOMIC_LEGAL_PROPOSITION_PER_WITNESS',
    );
    assert.equal(
      rule.unlisted_typed_link_family_rule,
      'FORBIDDEN',
    );
    assert.equal(
      rule.required_typed_link_families.some(
        (family) => family.terminal_type
          === rule.primary_value_carrier_terminal_type,
      ),
      true,
    );
    assert.equal(
      rule.required_typed_link_families.some(
        (family) => family.terminal_type === 'PROCESS_PASSAGE_REVISION',
      ),
      true,
    );
    assert.equal(
      rule.evidence_binding.witness_assertion_evidence,
      'DIRECT_EXACT_ADMITTED_SOURCE_UTF8_INTERVAL_REQUIRED',
    );
    assert.equal(
      rule.evidence_binding.paragraph_or_date_proximity_can_create_link,
      false,
    );
  }
  assert.deepEqual(successor.response_union_rule, {
    successor_predicate_keys_can_be_atomic_constituents: false,
    successor_predicate_keys_can_be_generic_union: false,
    atomic_constituent_set_remains_governed_by_response_contract: true,
    new_union_membership_requires_successor_contract: true,
  });
});

test('binds the sealed complete reconciliation without claiming freeze', () => {
  const definition = members()[1].canonical_value.definition;
  const evidence = definition.reconciliation_evidence_contract;

  assert.equal(
    evidence.reconciliation_stable_id,
    'PROCESS_EXCLUSIVITY_QUESTION_RECONCILIATION/V1',
  );
  assert.equal(
    evidence.reconciliation_deterministic_content_digest,
    'sha256:a038cc96cdd1db83a0b33ca1de165969c132f1f90261d12a6f927386316686af',
  );
  assert.equal(
    evidence.independence_evidence_deterministic_content_digest,
    'sha256:d423487adb7d481539aa22c5682727e42a198b2531d4f8801147982a9129d8ec',
  );
  assert.deepEqual(
    [
      evidence.ordinary_predicates_reconciled,
      evidence.challenge_questions_reconciled,
      evidence.challenge_answer_slots_reconciled,
      evidence.matched_existing_answer_slots,
      evidence.new_predicate_answer_slots,
      evidence.required_new_predicate_count,
    ],
    [23, 48, 190, 104, 86, 18],
  );
  assert.equal(evidence.all_reconciled_gap_definitions_incorporated, true);
  assert.equal(
    definition.completeness_challenge_contract
      .successor_reconciliation_required_before_freeze,
    true,
  );
  assert.equal(
    definition.completeness_challenge_contract
      .this_catalogue_satisfies_independent_challenge,
    false,
  );
});

test('rejects version one, near keys, missing definitions and semantic drift', () => {
  const predecessorVersion = clone(members()[1].canonical_value);
  predecessorVersion.definition.catalogue_version = 1;
  assert.throws(
    () => validateAuthoredProcessPredicateInputs(members(predecessorVersion)),
    (error) => error.code === 'INVALID_PROCESS_EXCLUSIVITY_PREDICATE_CATALOGUE',
  );

  const mutations = [
    (catalogue) => {
      catalogue.definition.ordinary_question_contract
        .mandatory_predicate_keys[23] = 'EXCLUSIVITY_BOUND_ACTORS_SCOPE';
    },
    (catalogue) => {
      catalogue.definition.successor_predicate_definition_contract
        .definitions.pop();
    },
    (catalogue) => {
      catalogue.definition.successor_predicate_definition_contract
        .definitions[0].exact_semantic_requirement = 'Govern actors.';
    },
    (catalogue) => {
      catalogue.definition.successor_predicate_definition_contract
        .definitions[0].machine_rule.semantic_kind = 'NOTICE_REQUIREMENT';
    },
    (catalogue) => {
      catalogue.definition.successor_predicate_definition_contract
        .definitions[0].machine_rule.required_typed_link_families.pop();
    },
    (catalogue) => {
      catalogue.definition.successor_predicate_definition_contract
        .definitions[0].machine_rule.evidence_binding
        .paragraph_or_date_proximity_can_create_link = true;
    },
    (catalogue) => {
      catalogue.definition.reconciliation_evidence_contract
        .reconciliation_deterministic_content_digest
          = `sha256:${'0'.repeat(64)}`;
    },
  ];
  for (const mutate of mutations) {
    const catalogue = clone(members()[1].canonical_value);
    mutate(catalogue);
    assert.throws(
      () => validateAuthoredProcessPredicateInputs(members(catalogue)),
      (error) => error.code
        === 'INVALID_PROCESS_EXCLUSIVITY_PREDICATE_CATALOGUE',
    );
  }
});

test('grants no runtime, freeze or external authority', () => {
  const definition = members()[1].canonical_value.definition;
  assert.equal(
    Object.values(definition.authority_contract)
      .every((value) => value === false),
    true,
  );
  assert.equal(
    definition.reconciliation_evidence_contract
      .evidence_binding_can_create_runtime_or_freeze_authority,
    false,
  );
});

test('uses one exact four-file machine-rule allowlist', () => {
  const allowlist = JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf8'));
  assert.equal(
    allowlist.phase,
    'WP-PROCESS-EXCLUSIVITY-PREDICATE-MACHINE-RULES-V2',
  );
  assert.equal(allowlist.required_work_class, 'canonical_work_start');
  assert.deepEqual(allowlist.allowed, [
    '.github/phase-allowlists/wp-process-exclusivity-predicate-machine-rules-v2.json',
    'contracts/canonical-v2/successor/process/predicates/exclusivity-predicate-catalogue.v2.json',
    'lib/canonical-v2/process-predicate-contract-input-validator.js',
    'tests/canonical-v2-process-exclusivity-predicate-catalogue-v2-contract-input.test.js',
  ]);
});
