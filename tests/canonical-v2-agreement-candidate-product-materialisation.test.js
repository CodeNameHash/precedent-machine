const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const contract = require(
  '../contracts/canonical-v2/successor/product/query/agreement-candidate-product-materialisation.v1.json',
);
const {
  AGREEMENT_CANDIDATE_PRODUCT_MATERIALISATION_SCHEMA,
  EVALUATION_EVIDENCE_SCHEMA,
  buildIocDetailPackage,
  compileAgreementCandidateProductMaterialisation,
  validateIocCitationDetailBinding,
} = require(
  '../lib/canonical-v2/agreement-candidate-product-materialisation',
);
const {
  validateAuthoredProductQueryInputs,
} = require('../lib/canonical-v2/product-query-contract-input-validator');
const {
  compileFixtureContract,
  compileFixtureContractV5,
} = require('../lib/canonical-v2/contract-bundle');
const { buildReviewedIocCapexSlice } = require('../lib/canonical-v2/reviewed-ioc-capex-slice');
const {
  authority,
  evaluationEvidence,
  familyInput,
  profileDetailAction,
} = require('./fixtures/canonical-v2/agreement-candidate-product-materialisation-inputs');
const productQueryIr = require(
  '../contracts/canonical-v2/successor/product/query/product-query-ir.v1.json',
);
const envelope = require(
  '../contracts/canonical-v2/successor/product/query/agreement-candidate-envelope.v1.json',
);
const surface = require(
  '../contracts/canonical-v2/successor/product/query/product-result-surface-binding.v1.json',
);
const f28 = require(
  '../contracts/canonical-v2/successor/product/query/qxo-capitalisation-f28-candidate-envelope.v1.json',
);

test('registers the exact five-input generic Agreement Product materialisation contract', () => {
  assert.equal(
    AGREEMENT_CANDIDATE_PRODUCT_MATERIALISATION_SCHEMA,
    'AGREEMENT_CANDIDATE_PRODUCT_MATERIALISATION/V1',
  );
  assert.equal(
    EVALUATION_EVIDENCE_SCHEMA,
    'AGREEMENT_CANDIDATE_PRODUCT_EVALUATION_EVIDENCE/V1',
  );
  assert.doesNotThrow(() => validateAuthoredProductQueryInputs([
    contract, envelope, productQueryIr, surface, f28,
  ].map((value) => ({ object_kind: value.object_kind, canonical_value: value }))));
  assert.deepEqual(contract.definition.input_contract.exact_inputs, [
    'agreement_candidate_envelope',
    'family_input',
    'pilot_product_authority_context',
    'pilot_product_authority_context_input',
    'product_evaluation_evidence',
  ]);
});

test('fails closed before any Product compiler can receive incomplete or caller-authorised input', () => {
  assert.throws(
    () => compileAgreementCandidateProductMaterialisation({}),
    { code: 'INVALID_AGREEMENT_CANDIDATE_PRODUCT_MATERIALISATION_INPUT' },
  );
});

test('uses the governed compilers and does not accept dummy or operational authority', () => {
  const source = fs.readFileSync(require.resolve(
    '../lib/canonical-v2/agreement-candidate-product-materialisation',
  ), 'utf8');
  for (const name of [
    'compileProductQueryIr',
    'compileProductQueryResult',
    'compileAgreementComparableResultOrder',
    'compileProductQueryResultSet',
    'compileProductResultPresentation',
    'compileProductResultSurfaceBindings',
  ]) assert.match(source, new RegExp(name));
  assert.doesNotMatch(source, /supabase|canonical-writer|database.*write|production/i);
  assert.match(source, /validateAgreementCandidateEnvelope/);
  assert.match(source, /validatePilotProductAuthorityContext/);
});

test('rebuilds the IOC claim-evidence package with its complete source inputs', () => {
  const contractBundle = compileFixtureContractV5();
  const slice = buildReviewedIocCapexSlice({
    agreementText: fs.readFileSync('__fixtures__/demo-deal/landos-abbvie-agreement.txt', 'utf8'),
    dealValueSourceText: fs.readFileSync('__fixtures__/canonical-v2/landos-deal-value-sec-excerpt.txt', 'utf8'),
    contractBundle,
  });
  const detail = buildIocDetailPackage(slice, contractBundle);
  assert.equal(detail.schema_version, 'EXACT_DETAIL_ATOMIC_PACKAGE/V1');
  assert.match(detail.row.row_serving_key, /^[a-f0-9]{64}$/);
  assert.equal(detail.detail_payloads.length, 1);
});

for (const profile of [
  'CAPITALISATION_BRING_DOWN_V3',
  'IOC_CAPEX_RESTRICTION_V1',
]) {
  test(`${profile} materialises through the exact authority, result, ordering, presentation and four surfaces`, () => {
    const { input: authorityInput, context: authorityContext } = authority();
    const envelopeInput = {
      family_profile_id: profile,
      family_input: familyInput(profile),
    };
    const prepared = evaluationEvidence({
      envelopeInput,
      authorityInput,
      authorityContext,
    });
    const output = compileAgreementCandidateProductMaterialisation({
      agreement_candidate_envelope: prepared.envelopeValue,
      family_input: envelopeInput.family_input,
      pilot_product_authority_context: authorityContext,
      pilot_product_authority_context_input: authorityInput,
      product_evaluation_evidence: prepared.product_evaluation_evidence,
    });
    assert.equal(output.authority_state, 'NOT_GRANTED');
    assert.equal(output.materialisation_state, 'VALIDATED_NOT_PERSISTED');
    assert.equal(output.product_query_result.domain_key, 'AGREEMENT');
    assert.deepEqual(
      output.product_query_ir.presentation_contract.requested_columns,
      profile === 'IOC_CAPEX_RESTRICTION_V1'
        ? [{ field_key: 'deal', field_version: 1 }]
        : [
          { field_key: 'deal', field_version: 1 },
          { field_key: 'signed', field_version: 1 },
        ],
    );
    assert.deepEqual(
      output.product_query_ir.presentation_contract.sort,
      profile === 'IOC_CAPEX_RESTRICTION_V1'
        ? []
        : [{ field_key: 'signed', field_version: 1, direction: 'DESC' }],
    );
    assert.equal(output.product_result_set.ordered_result_slots.length, 1);
    assert.equal(output.product_result_presentation.result_slots.length, 1);
    assert.deepEqual(
      Object.keys(output.product_result_surfaces.surface_bindings),
      ['COMPARE', 'CORPUS_CONTEXT', 'QUERY', 'REVIEW'],
    );
    const exactDetailAction = profile === 'IOC_CAPEX_RESTRICTION_V1'
      ? output.evidence_sidecar.exact_detail_package.row.source_actions[0].action_slot_key
      : output.evidence_sidecar.exact_detail_package.exact_detail_action;
    assert.equal(exactDetailAction, profileDetailAction(profile));
    if (profile === 'IOC_CAPEX_RESTRICTION_V1') {
      const detail = output.evidence_sidecar.exact_detail_package;
      const reference = detail.references[0];
      const payload = detail.detail_payloads[0];
      const claimEvidencePath = reference.ordered_path.find(
        (entry) => entry.object_type === 'ClaimEvidence',
      );
      const excerptPath = reference.ordered_path.find(
        (entry) => entry.object_type === 'Excerpt',
      );
      assert.equal(
        output.product_query_result.exact_citation.source_evidence_identity,
        excerptPath.object_id,
      );
      assert.equal(
        output.product_query_result.exact_citation
          .result_component_evidence_identity,
        claimEvidencePath.object_id,
      );
      assert.equal(claimEvidencePath.object_id, payload.terminal_object_id);
      assert.equal(
        claimEvidencePath.object_id,
        payload.response_body.claim_evidence_id,
      );
      assert.equal(
        excerptPath.object_id,
        payload.response_body.excerpt.excerpt_id,
      );
      assert.equal(
        validateIocCitationDetailBinding(
          output.product_query_result.exact_citation,
          detail,
        ),
        true,
      );
    }
  });
}

test('rejects IOC Product materialisation without governed approximate precision', () => {
  const { input: authorityInput, context: authorityContext } = authority();
  const family = {
    agreement_text: fs.readFileSync(
      '__fixtures__/demo-deal/landos-abbvie-agreement.txt',
      'utf8',
    ),
    deal_value_source_text: fs.readFileSync(
      '__fixtures__/canonical-v2/landos-deal-value-sec-excerpt.txt',
      'utf8',
    ),
    contract_bundle: compileFixtureContract(),
  };
  const envelopeInput = {
    family_profile_id: 'IOC_CAPEX_RESTRICTION_V1',
    family_input: family,
  };
  const prepared = evaluationEvidence({
    envelopeInput,
    authorityInput,
    authorityContext,
  });
  assert.throws(
    () => compileAgreementCandidateProductMaterialisation({
      agreement_candidate_envelope: prepared.envelopeValue,
      family_input: family,
      pilot_product_authority_context: authorityContext,
      pilot_product_authority_context_input: authorityInput,
      product_evaluation_evidence: prepared.product_evaluation_evidence,
    }),
    { code: 'INVALID_AGREEMENT_IOC_PRODUCT_SOURCE' },
  );
});

test('rejects IOC citation drift from its claim-evidence reference and payload', () => {
  const { input: authorityInput, context: authorityContext } = authority();
  const envelopeInput = {
    family_profile_id: 'IOC_CAPEX_RESTRICTION_V1',
    family_input: familyInput('IOC_CAPEX_RESTRICTION_V1'),
  };
  const prepared = evaluationEvidence({
    envelopeInput,
    authorityInput,
    authorityContext,
  });
  const output = compileAgreementCandidateProductMaterialisation({
    agreement_candidate_envelope: prepared.envelopeValue,
    family_input: envelopeInput.family_input,
    pilot_product_authority_context: authorityContext,
    pilot_product_authority_context_input: authorityInput,
    product_evaluation_evidence: prepared.product_evaluation_evidence,
  });
  const citation = structuredClone(output.product_query_result.exact_citation);
  citation.result_component_evidence_identity = 'f'.repeat(64);
  assert.throws(
    () => validateIocCitationDetailBinding(
      citation,
      output.evidence_sidecar.exact_detail_package,
    ),
    { code: 'INVALID_AGREEMENT_IOC_PRODUCT_EVIDENCE_BINDING' },
  );
  const detail = structuredClone(output.evidence_sidecar.exact_detail_package);
  detail.references[0].ordered_path.find(
    (entry) => entry.object_type === 'ClaimEvidence',
  ).object_id = 'e'.repeat(64);
  assert.throws(
    () => validateIocCitationDetailBinding(
      output.product_query_result.exact_citation,
      detail,
    ),
    { code: 'INVALID_AGREEMENT_IOC_PRODUCT_EVIDENCE_BINDING' },
  );
});

for (const [name, rawProductQueryPatch] of [
  ['an extra signed requested column without a sort', {
    requested_columns: [
      { field_key: 'deal', field_version: 1 },
      { field_key: 'signed', field_version: 1 },
    ],
    sort: [],
  }],
  ['a signed descending sort', {
    requested_columns: [{ field_key: 'deal', field_version: 1 }],
    sort: [{ field_key: 'signed', field_version: 1, direction: 'DESC' }],
  }],
]) {
  test(`rejects a coherent IOC query with ${name}`, () => {
    const { input: authorityInput, context: authorityContext } = authority();
    const envelopeInput = {
      family_profile_id: 'IOC_CAPEX_RESTRICTION_V1',
      family_input: familyInput('IOC_CAPEX_RESTRICTION_V1'),
    };
    const prepared = evaluationEvidence({
      envelopeInput,
      authorityInput,
      authorityContext,
      rawProductQueryPatch,
    });
    assert.throws(() => compileAgreementCandidateProductMaterialisation({
      agreement_candidate_envelope: prepared.envelopeValue,
      family_input: envelopeInput.family_input,
      pilot_product_authority_context: authorityContext,
      pilot_product_authority_context_input: authorityInput,
      product_evaluation_evidence: prepared.product_evaluation_evidence,
    }), { code: 'INVALID_AGREEMENT_CANDIDATE_PRODUCT_MATERIALISATION_INPUT' });
  });
}

test('rejects a correctly rehashed cross-family evaluation query', () => {
  const { input: authorityInput, context: authorityContext } = authority();
  const f28EnvelopeInput = {
    family_profile_id: 'CAPITALISATION_BRING_DOWN_V3',
    family_input: familyInput('CAPITALISATION_BRING_DOWN_V3'),
  };
  const iocPrepared = evaluationEvidence({
    envelopeInput: {
      family_profile_id: 'IOC_CAPEX_RESTRICTION_V1',
      family_input: familyInput('IOC_CAPEX_RESTRICTION_V1'),
    },
    authorityInput,
    authorityContext,
  });
  const f28Envelope = evaluationEvidence({
    envelopeInput: f28EnvelopeInput,
    authorityInput,
    authorityContext,
  }).envelopeValue;
  assert.throws(() => compileAgreementCandidateProductMaterialisation({
    agreement_candidate_envelope: f28Envelope,
    family_input: f28EnvelopeInput.family_input,
    pilot_product_authority_context: authorityContext,
    pilot_product_authority_context_input: authorityInput,
    product_evaluation_evidence: iocPrepared.product_evaluation_evidence,
  }), { code: 'INVALID_AGREEMENT_CANDIDATE_PRODUCT_MATERIALISATION_INPUT' });
});

test('uses the exact seven-file phase boundary', () => {
  const allowlist = JSON.parse(fs.readFileSync(path.join(
    __dirname,
    '../.github/phase-allowlists/wp-p8-agreement-candidate-product-materialisation-v1.json',
  ), 'utf8'));
  assert.equal(allowlist.allowed.length, 7);
  assert.equal(allowlist.allowed.includes(
    'lib/canonical-v2/agreement-candidate-product-materialisation.js',
  ), true);
});

test('uses the exact four-file Stage 3 IOC correction boundary', () => {
  const allowlist = JSON.parse(fs.readFileSync(path.join(
    __dirname,
    '../.github/phase-allowlists/wp-p8-agreement-materialisation-stage3-correction-v1.json',
  ), 'utf8'));
  assert.deepEqual(allowlist.allowed, [
    '.github/phase-allowlists/wp-p8-agreement-materialisation-stage3-correction-v1.json',
    'lib/canonical-v2/agreement-candidate-product-materialisation.js',
    'tests/canonical-v2-agreement-candidate-product-materialisation.test.js',
    'tests/fixtures/canonical-v2/agreement-candidate-product-materialisation-inputs.js',
  ]);
});

test('uses the exact Stage 4 IOC legal-correction boundary', () => {
  const allowlist = JSON.parse(fs.readFileSync(path.join(
    __dirname,
    '../.github/phase-allowlists/wp-p8-stage4-ioc-legal-corrections-v1.json',
  ), 'utf8'));
  assert.deepEqual(allowlist.allowed, [
    '.github/phase-allowlists/wp-p8-stage4-ioc-legal-corrections-v1.json',
    'lib/canonical-v2/agreement-candidate-product-materialisation.js',
    'lib/canonical-v2/reviewed-ioc-capex-slice.js',
    'tests/canonical-v2-agreement-candidate-product-materialisation.test.js',
    'tests/canonical-v2-reviewed-ioc-capex-slice.test.js',
    'tests/fixtures/canonical-v2/agreement-candidate-product-materialisation-inputs.js',
  ]);
});
