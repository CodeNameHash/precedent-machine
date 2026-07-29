const test = require('node:test');
const assert = require('node:assert/strict');

const {
  canonicalJson,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  CLAUSE_B_CLASS,
  CLAUSE_C_CLASS,
  QUALIFIER_SCOPE_MEMBERS,
  buildQxoReviewedCapitalisationF27,
  validateQxoReviewedCapitalisationF27,
} = require('../lib/canonical-v2/reviewed-qxo-capitalisation-f27');
const {
  buildF27Inputs,
} = require('./fixtures/canonical-v2/qxo-capitalisation-f27-inputs');

function build() {
  const inputs = buildF27Inputs();
  return {
    inputs,
    value: buildQxoReviewedCapitalisationF27(inputs),
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('F27 builds one deterministic reviewed graph under the exact V13 contract', () => {
  const first = build();
  const second = build();
  assert.equal(canonicalJson(first.value), canonicalJson(second.value));
  assert.equal(validateQxoReviewedCapitalisationF27({
    candidate: first.value,
    ...first.inputs,
  }), true);
  assert.equal(first.value.provisions.length, 2);
  assert.equal(first.value.representation_components.length, 5);
  assert.equal(first.value.condition_group_components.length, 2);
  assert.equal(first.value.claims.length, 7);
  assert.equal(first.value.relationships.length, 3);
  assert.equal(first.value.result_inputs.length, 6);
  assert.equal(
    first.value.claims.every(
      (entry) => entry.publication_state === 'VALIDATED',
    ),
    true,
  );
  assert.equal(
    first.value.relationships.every(
      (entry) => entry.publication_state === 'VALIDATED',
    ),
    true,
  );
  assert.deepEqual(first.value.authority, {
    review_publication_authority: 'INACTIVE_CANDIDATE_ONLY',
    market_cohort_authority: 'NONE_PENDING_F27_CERTIFICATION',
    active_release_authority: 'NONE',
    corpus_write_authority: 'NONE',
    production_activation_authority: 'NONE',
  });
});

test('F27 binds the two ordered clause groups to disjoint exact limb sets', () => {
  const { value } = build();
  const limbIds = value.representation_components.map(
    (entry) => entry.provision_component_id,
  );
  const [groupB, groupC] = value.condition_group_components;
  const [bringsDownB, bringsDownC] = value.relationships;

  assert.deepEqual(groupB, {
    ...groupB,
    schema_version: 'CAPITALISATION_CONDITION_GROUP/V1',
    comparison_class_key: CLAUSE_B_CLASS,
    source_clause_code: 'B',
    target_limb_ordinals: [1, 3],
    component_key: 'CAPITALISATION_ACCURACY_GROUP',
    governed_ordinal: 1,
  });
  assert.equal(groupC.comparison_class_key, CLAUSE_C_CLASS);
  assert.equal(groupC.source_clause_code, 'C');
  assert.deepEqual(groupC.target_limb_ordinals, [2, 4, 5]);
  assert.equal(groupC.governed_ordinal, 2);
  assert.deepEqual(bringsDownB.target_occurrence_ids, [
    limbIds[0],
    limbIds[2],
  ]);
  assert.deepEqual(bringsDownC.target_occurrence_ids, [
    limbIds[1],
    limbIds[3],
    limbIds[4],
  ]);
  assert.equal(
    bringsDownB.target_occurrence_ids.some(
      (id) => bringsDownC.target_occurrence_ids.includes(id),
    ),
    false,
  );
  assert.equal(
    bringsDownB.effect.dated_representation_proviso.application,
    'EXPRESS_DATE_OR_PERIOD_ONLY',
  );
  assert.equal(
    bringsDownC.effect.dated_representation_proviso.application,
    'EXPRESS_DATE_OR_PERIOD_ONLY',
  );
  assert.deepEqual(bringsDownC.effect.materiality_scrape, {
    state: 'APPLIED',
    disregarded_qualifier_codes: [
      'MATERIAL',
      'MATERIALITY',
      'COMPANY_MATERIAL_ADVERSE_EFFECT',
    ],
    evidence_excerpt_id:
      value.source_excerpts.materiality_scrape.excerpt_id,
  });
});

test('F27 derives the measurement date from an exact signing-date source anchor', () => {
  const { value } = build();
  const claim = value.claims.find(
    (entry) => entry.claim_definition_key
      === 'REPRESENTATION_MEASUREMENT_DATE',
  );
  const signing = value.source_excerpts.signing_date;

  assert.equal(signing.exact_text, 'dated as of April 18, 2026');
  assert.deepEqual(claim.attributes, {
    raw_measurement_date: '2026-04-17',
    signing_date: '2026-04-18',
    signing_relative_offset: -1,
    offset_unit: 'CALENDAR_DAY',
    day_basis: 'CALENDAR_DAY',
    semantic_class: 'NEAR_SIGNING_MEASUREMENT_SNAPSHOT',
    precision: 'EXACT',
    derivation_version: 'QXO_CAPITALISATION_BRING_DOWN_F27/V1',
    signing_anchor_evidence_excerpt_ids: [signing.excerpt_id],
  });
  assert.equal(
    claim.evidence.some(
      (entry) => entry.excerpt_id === signing.excerpt_id
        && entry.evidence_role === 'DERIVATION_INPUT',
    ),
    true,
  );
});

test('F27 qualifier absences have the exact governed scope and independent closure IDs', () => {
  const { value } = build();
  const claims = value.claims.filter((entry) => entry.state === 'ABSENT');
  assert.deepEqual(
    claims.map((entry) => entry.claim_definition_key),
    [
      'KNOWLEDGE_QUALIFIER',
      'GENERAL_MATERIALITY_QUALIFIER',
      'RETROSPECTIVE_LOOKBACK',
    ],
  );
  assert.equal(new Set(claims.map(
    (entry) => entry.scope.scope_closure_id,
  )).size, 3);
  for (const claim of claims) {
    assert.deepEqual(
      claim.scope.required_scope_members,
      QUALIFIER_SCOPE_MEMBERS,
    );
    assert.deepEqual(
      claim.scope.required_interval_ids,
      claim.scope.examined_interval_ids,
    );
    assert.deepEqual(claim.scope.party_scope, {
      role: 'REPRESENTATION_MAKER',
      value: 'COMPANY',
      capacity: 'TARGET',
    });
    assert.equal(
      claim.scope.temporal_scope,
      'COMPLETE_REPRESENTATION_AS_EXPRESSLY_DATED',
    );
    assert.equal(claim.scope.candidate_selected_scope, false);
    for (const member of QUALIFIER_SCOPE_MEMBERS) {
      const ids = claim.scope.member_evidence_excerpt_ids[member];
      assert.ok(ids.length > 0);
      ids.forEach((id) => assert.ok(
        claim.scope.required_interval_ids.includes(id),
      ));
    }
  }
  assert.equal(
    value.claims.some(
      (entry) => entry.claim_definition_key
        === 'GENERAL_MATERIALITY_QUALIFIER'
        && entry.state === 'PRESENT',
    ),
    false,
  );
});

test('F27 definition use is exact and selects only the Company denominator', () => {
  const { value } = build();
  const relationship = value.relationships.find(
    (entry) => entry.relationship_definition_key === 'USES_DEFINITION',
  );
  const exactUse = value.source_excerpts.de_minimis_exact_use;
  const effect = relationship.effect;

  assert.equal(exactUse.exact_text, 'De Minimis Inaccuracies');
  assert.deepEqual(effect.exact_use_span, {
    canonical_text_id: exactUse.canonical_text_id,
    absolute_start: exactUse.absolute_start,
    absolute_end: exactUse.absolute_end,
  });
  assert.equal(
    effect.affected_endpoint.affected_field_key,
    'accuracy_exception',
  );
  assert.deepEqual(effect.definition_application, {
    defined_term_code: 'DE_MINIMIS_INACCURACIES',
    denominator_party_value: 'COMPANY',
    raw_alternative_phrase_code: 'OR_PARENT_AS_THE_CASE_MAY_BE',
    denominator_selection_evidence_excerpt_ids: [
      exactUse.excerpt_id,
      value.source_excerpts.de_minimis_definition.excerpt_id,
    ].sort(),
    denominator_selection_derivation_version:
      'QXO_CAPITALISATION_BRING_DOWN_F27/V1',
    parent_representation_generalisation: false,
  });
});

test('F27 publishes one buyer group while preserving all source party tokens', () => {
  const { value } = build();
  assert.deepEqual(value.party, {
    role: 'CONDITION_BENEFICIARY',
    value: 'BUYER_GROUP',
    capacity: 'ACQUIRER',
  });
  assert.deepEqual(value.source_party_tokens, [
    'Parent',
    'Titanium Merger Sub',
    'Forward Merger Sub',
  ]);
  assert.equal(value.condition_group_components.every(
    (entry) => entry.party.value === 'BUYER_GROUP',
  ), true);
});

test('F27 rejects forged parser closure data and keeps page 16 out of semantic evidence', () => {
  const { inputs, value } = build();
  const forged = clone(inputs.parserSourceClosure);
  forged.party_token_bindings[0].exact_clean_text = 'FORGED PARTY';
  assert.throws(
    () => buildQxoReviewedCapitalisationF27({
      ...inputs,
      parserSourceClosure: forged,
    }),
    /closure|mismatch/i,
  );
  assert.equal(
    /(^|\n)16(?=\n|$)/m.test(canonicalJson(value.source_excerpts)),
    false,
  );
  assert.doesNotMatch(canonicalJson(value), /TIER_B|TIER_C/);
});
