const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const {
  canonicalJson,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  compileFixtureContract,
} = require('../lib/canonical-v2/contract-bundle');
const {
  AGREEMENT_CANDIDATE_ENVELOPE_RUNTIME_SCHEMA,
  AUTHORITY_STATE,
  buildAgreementCandidateEnvelope,
  validateAgreementCandidateEnvelope,
} = require('../lib/canonical-v2/agreement-candidate-envelope');
const {
  buildAgreementCandidateEnvelopeCarrier,
  buildProductCandidateResultWriteEnvelope,
  validateProductCandidateResultWriteSet,
} = require('../lib/canonical-v2/product-candidate-result-write');
const {
  buildF28ProductInputs,
} = require('./fixtures/canonical-v2/qxo-capitalisation-f28-product-inputs');
const {
  buildQxoCapitalisationF28CandidateEnvelope,
} = require(
  '../lib/canonical-v2/qxo-capitalisation-f28-candidate-envelope',
);
const {
  buildReviewedIocCapexServingRow,
  buildReviewedIocCapexSlice,
} = require('../lib/canonical-v2/reviewed-ioc-capex-slice');

function f28Input() {
  const value = buildF28ProductInputs();
  return {
    family_profile_id: 'CAPITALISATION_BRING_DOWN_V3',
    family_input: {
      qxo_cross_view_release: value.qxo_cross_view_release,
      reviewed_graph: value.reviewed_graph,
      source_context: value.source_context,
      parser_source_closure: value.parser_source_closure,
      contract_bundle: value.contract_bundle,
    },
  };
}

function iocInput() {
  return {
    family_profile_id: 'IOC_CAPEX_RESTRICTION_V1',
    family_input: {
      agreement_text: fs.readFileSync(
        '__fixtures__/demo-deal/landos-abbvie-agreement.txt',
        'utf8',
      ),
      deal_value_source_text: fs.readFileSync(
        '__fixtures__/canonical-v2/landos-deal-value-sec-excerpt.txt',
        'utf8',
      ),
      contract_bundle: compileFixtureContract(),
    },
  };
}

test('one generic envelope preserves all fourteen QXO F28 terminals', () => {
  const value = buildAgreementCandidateEnvelope(f28Input());
  assert.equal(
    value.schema_version,
    AGREEMENT_CANDIDATE_ENVELOPE_RUNTIME_SCHEMA,
  );
  assert.equal(value.family_profile_id, 'CAPITALISATION_BRING_DOWN_V3');
  assert.equal(value.ordered_terminals.length, 14);
  assert.equal(value.authority_state, AUTHORITY_STATE);
  assert.equal(
    value.product_membership.result_definition_stable_id,
    'TARGET_CAPITALISATION_BRING_DOWN',
  );
});

test('the same generic envelope onboards Landos IOC capex as a second family', () => {
  const value = buildAgreementCandidateEnvelope(iocInput());
  assert.equal(value.family_profile_id, 'IOC_CAPEX_RESTRICTION_V1');
  assert.equal(value.ordered_terminals.length, 1);
  assert.equal(
    value.product_membership.result_definition_stable_id,
    'TARGET_CAPEX_RESTRICTION',
  );
  assert.equal(
    value.ordered_terminals[0].metric_key,
    'IOC_CAPEX_THRESHOLD_PERCENT_OF_DEAL_VALUE',
  );
  assert.equal(
    value.ordered_terminals[0].subject_terminal.canonical_value,
    '0.07272727',
  );
  assert.equal(
    value.provision_row.canonical_result.components[0].raw_value,
    '$100,000',
  );
});

test('both profiles use the same immutable runtime schema and identity rules', () => {
  const f28 = buildAgreementCandidateEnvelope(f28Input());
  const ioc = buildAgreementCandidateEnvelope(iocInput());
  assert.equal(f28.schema_version, ioc.schema_version);
  assert.notEqual(
    f28.agreement_candidate_envelope_id,
    ioc.agreement_candidate_envelope_id,
  );
  assert.equal(Object.isFrozen(f28), true);
  assert.equal(Object.isFrozen(ioc), true);
  assert.equal(
    validateAgreementCandidateEnvelope(f28, f28Input()),
    true,
  );
  assert.equal(
    validateAgreementCandidateEnvelope(ioc, iocInput()),
    true,
  );
});

test('generic profiles preserve both predecessor family outputs byte for byte', () => {
  const f28 = f28Input();
  const genericF28 = buildAgreementCandidateEnvelope(f28);
  const predecessorF28 = buildQxoCapitalisationF28CandidateEnvelope(
    f28.family_input,
  );
  assert.equal(
    canonicalJson(genericF28.provision_row),
    canonicalJson(predecessorF28.provision_row),
  );
  assert.deepEqual(
    genericF28.ordered_terminals.map((terminal) => (
      canonicalJson(terminal.subject_terminal)
    )),
    predecessorF28.ordered_terminals.map((terminal) => (
      canonicalJson(terminal.subject_terminal)
    )),
  );

  const ioc = iocInput();
  const genericIoc = buildAgreementCandidateEnvelope(ioc);
  const slice = buildReviewedIocCapexSlice({
    agreementText: ioc.family_input.agreement_text,
    dealValueSourceText: ioc.family_input.deal_value_source_text,
    contractBundle: ioc.family_input.contract_bundle,
  });
  const predecessorIocRow = buildReviewedIocCapexServingRow({
    slice,
    contractBundle: ioc.family_input.contract_bundle,
  });
  assert.equal(
    canonicalJson(genericIoc.provision_row),
    canonicalJson(predecessorIocRow),
  );
  assert.equal(
    canonicalJson(genericIoc.ordered_terminals[0].subject_terminal),
    canonicalJson(slice.projection.observation),
  );
});

test('unknown profiles and exact source drift fail closed', () => {
  assert.throws(
    () => buildAgreementCandidateEnvelope({
      ...iocInput(),
      family_profile_id: 'NEAREST_LEGAL_FAMILY',
    }),
    /not admitted/,
  );
  const changed = iocInput();
  changed.family_input.agreement_text += ' ';
  assert.throws(
    () => buildAgreementCandidateEnvelope(changed),
    /source hash mismatch/,
  );
});

test('profile, row, terminal and authority values cannot be rehashed into validity', () => {
  const input = iocInput();
  const value = structuredClone(buildAgreementCandidateEnvelope(input));
  value.product_membership.result_definition_stable_id =
    'TARGET_CAPITALISATION_BRING_DOWN';
  value.ordered_terminals[0].subject_terminal.canonical_value = '99';
  value.authority_state = 'GRANTED';
  assert.throws(
    () => validateAgreementCandidateEnvelope(value, input),
    /changed/,
  );
});

test('the generic envelope contains no family-specific authority grant', () => {
  for (const input of [f28Input(), iocInput()]) {
    const value = buildAgreementCandidateEnvelope(input);
    assert.equal(value.candidate_state, 'VALIDATED_NOT_MATERIALISED');
    assert.equal(value.authority_state, 'NONE');
    assert.doesNotMatch(canonicalJson(value), /GRANTED|ACTIVE_POINTER/);
  }
});

test('the admitted Agreement carrier cannot manufacture the missing Product result', () => {
  const carrier = buildAgreementCandidateEnvelopeCarrier(
    buildAgreementCandidateEnvelope(iocInput()),
  );
  assert.throws(
    () => validateProductCandidateResultWriteSet(
      buildProductCandidateResultWriteEnvelope({
        adapter_identifier: 'AGREEMENT_CANDIDATE_ENVELOPE',
        domain_carrier: carrier,
      }),
    ),
    (error) => error.code === 'INVALID_AGREEMENT_CANDIDATE_ENVELOPE_CARRIER',
  );
});
