const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  canonicalJson,
  contentId,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  buildAgreementCandidateEnvelope,
} = require('../lib/canonical-v2/agreement-candidate-envelope');
const {
  buildAgreementCandidateDomainResult,
  AgreementCandidateDomainResultAdapterError,
} = require('../lib/canonical-v2/agreement-candidate-domain-result-adapter');
const {
  compileCanonicalContractInput,
} = require('../lib/canonical-v2/canonical-contract-input-compiler');
const {
  assembleCanonicalContractBundleCurrentRootProposal,
} = require('../lib/canonical-v2/canonical-contract-bundle-current-root');
const {
  compileCanonicalContractBundle,
} = require('../lib/canonical-v2/canonical-contract-bundle-compiler');
const {
  compileFixtureContract,
} = require('../lib/canonical-v2/contract-bundle');
const {
  buildLandosCandidateReleaseFixture,
} = require('../__fixtures__/canonical-v2/landos-candidate-release');
const {
  compilePilotProductAuthorityContext,
} = require('../lib/canonical-v2/pilot-product-authority-context');
const {
  buildF28ProductInputs,
} = require('./fixtures/canonical-v2/qxo-capitalisation-f28-product-inputs');

const ROOT = path.resolve(__dirname, '../contracts/canonical-v2/successor');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function authorityContextInput() {
  const canonicalContractInputCompilation = compileCanonicalContractInput({
    root_directory: ROOT,
  });
  const proposal = assembleCanonicalContractBundleCurrentRootProposal({
    canonical_contract_input_compilation: canonicalContractInputCompilation,
  });
  const compiledContractBundle = compileCanonicalContractBundle({
    canonical_contract_input_compilation: canonicalContractInputCompilation,
    classification_registry: proposal.registry_assembly.classification_registry,
    dependency_registry: proposal.registry_assembly.dependency_registry,
    governed_registry_bindings: proposal.registry_assembly.governed_registry_bindings,
  });
  const candidateReleaseManifest = clone(
    buildLandosCandidateReleaseFixture().release.manifest,
  );
  candidateReleaseManifest.contract_fingerprint =
    compiledContractBundle.contract_bundle_digest;
  const {
    candidate_release_manifest_id: ignoredId,
    canonical_payload_digest: ignoredDigest,
    ...candidateReleaseBody
  } = candidateReleaseManifest;
  candidateReleaseManifest.candidate_release_manifest_id = contentId(
    'FIXTURE_CANDIDATE_RELEASE_MANIFEST/V1',
    candidateReleaseBody,
  );
  candidateReleaseManifest.canonical_payload_digest = contentId(
    'FIXTURE_CANDIDATE_RELEASE_MANIFEST_PAYLOAD/V1',
    candidateReleaseBody,
  );
  return {
    canonical_contract_input_compilation: canonicalContractInputCompilation,
    compiled_contract_bundle: compiledContractBundle,
    candidate_release_manifest: candidateReleaseManifest,
  };
}

let cachedAuthority;
function authority() {
  if (!cachedAuthority) {
    const input = authorityContextInput();
    cachedAuthority = {
      input,
      context: compilePilotProductAuthorityContext(input),
    };
  }
  return cachedAuthority;
}

function f28EnvelopeInput() {
  const source = buildF28ProductInputs();
  return {
    family_profile_id: 'CAPITALISATION_BRING_DOWN_V3',
    family_input: {
      qxo_cross_view_release: source.qxo_cross_view_release,
      reviewed_graph: source.reviewed_graph,
      source_context: source.source_context,
      parser_source_closure: source.parser_source_closure,
      contract_bundle: source.contract_bundle,
    },
  };
}

function iocEnvelopeInput() {
  return {
    family_profile_id: 'IOC_CAPEX_RESTRICTION_V1',
    family_input: {
      agreement_text: fs.readFileSync(
        '__fixtures__/demo-deal/landos-abbvie-agreement.txt', 'utf8',
      ),
      deal_value_source_text: fs.readFileSync(
        '__fixtures__/canonical-v2/landos-deal-value-sec-excerpt.txt', 'utf8',
      ),
      contract_bundle: compileFixtureContract(),
    },
  };
}

function inputFor(envelopeInput) {
  const { input, context } = authority();
  return {
    agreement_candidate_envelope: buildAgreementCandidateEnvelope(envelopeInput),
    agreement_candidate_envelope_input: envelopeInput,
    pilot_product_authority_context: context,
    pilot_product_authority_context_input: input,
  };
}

function assertCode(code, operation) {
  assert.throws(operation, (error) => {
    assert.equal(error.name, 'AgreementCandidateDomainResultAdapterError');
    assert.equal(error.code, code);
    return true;
  });
}

test('one profile-driven adapter creates an F28 shared Agreement domain result', () => {
  const input = inputFor(f28EnvelopeInput());
  const result = buildAgreementCandidateDomainResult(input);
  assert.deepEqual(result.domain_result_definition, {
    stable_id: 'TARGET_CAPITALISATION_BRING_DOWN',
    version: 3,
  });
  assert.equal(result.domain_key, 'AGREEMENT');
  assert.equal(result.domain_result_source_representation_kind, 'STRUCTURED_RESULT');
  assert.equal(
    result.domain_result_identity,
    input.agreement_candidate_envelope.product_membership.domain_result_identity,
  );
  assert.equal(Object.isFrozen(result), true);
});

test('IOC capex uses the same profile-driven Agreement domain-result code', () => {
  const input = inputFor(iocEnvelopeInput());
  const result = buildAgreementCandidateDomainResult(input);
  assert.deepEqual(result.domain_result_definition, {
    stable_id: 'TARGET_CAPEX_RESTRICTION',
    version: 1,
  });
  assert.equal(
    result.domain_result_identity,
    input.agreement_candidate_envelope.product_membership.domain_result_identity,
  );
});

test('row, result-definition and context drift fail closed even after rehashing', () => {
  const rowDrift = inputFor(f28EnvelopeInput());
  rowDrift.agreement_candidate_envelope = clone(
    rowDrift.agreement_candidate_envelope,
  );
  rowDrift.agreement_candidate_envelope.provision_row.label = 'Changed';
  assertCode('INVALID_AGREEMENT_CANDIDATE_ENVELOPE', () => (
    buildAgreementCandidateDomainResult(rowDrift)
  ));

  const definitionDrift = inputFor(f28EnvelopeInput());
  definitionDrift.agreement_candidate_envelope = clone(
    definitionDrift.agreement_candidate_envelope,
  );
  definitionDrift.agreement_candidate_envelope.product_membership
    .result_definition_version = 2;
  assertCode('INVALID_AGREEMENT_CANDIDATE_ENVELOPE', () => (
    buildAgreementCandidateDomainResult(definitionDrift)
  ));

  const contextDrift = inputFor(iocEnvelopeInput());
  contextDrift.pilot_product_authority_context = clone(
    contextDrift.pilot_product_authority_context,
  );
  contextDrift.pilot_product_authority_context.product_query_admission_context
    .exact_detail_actions = [];
  const { authority_context_id: ignoredId, ...body } =
    contextDrift.pilot_product_authority_context;
  contextDrift.pilot_product_authority_context.authority_context_id = contentId(
    contextDrift.pilot_product_authority_context.schema_version,
    body,
  );
  assertCode('INVALID_PILOT_PRODUCT_AUTHORITY_CONTEXT', () => (
    buildAgreementCandidateDomainResult(contextDrift)
  ));
});

test('the output contains only the closed shared Product domain-result carrier', () => {
  const result = buildAgreementCandidateDomainResult(inputFor(f28EnvelopeInput()));
  assert.deepEqual(Object.keys(result).sort(), [
    'domain_key',
    'domain_result_definition',
    'domain_result_identity',
    'domain_result_payload',
    'domain_result_payload_digest',
    'domain_result_source_representation_kind',
    'domain_result_validation',
  ]);
  assert.equal(
    result.domain_result_validation.schema_version,
    'PRODUCT_DOMAIN_RESULT_VALIDATION/V1',
  );
  assert.match(result.domain_result_validation.validation_receipt_id, /^[a-f0-9]{64}$/);
  assert.equal(canonicalJson(result.domain_result_payload).length > 2, true);
});
