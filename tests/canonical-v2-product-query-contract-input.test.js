const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  compileCanonicalContractInput,
} = require('../lib/canonical-v2/canonical-contract-input-compiler');
const {
  validateAuthoredProductQueryInputs,
} = require('../lib/canonical-v2/product-query-contract-input-validator');

const ROOT = path.join(
  __dirname,
  '../contracts/canonical-v2/successor',
);

function loadMember() {
  const canonicalValue = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'product/query/product-query-ir.v1.json'),
    'utf8',
  ));
  return {
    object_kind: canonicalValue.object_kind,
    canonical_value: canonicalValue,
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('registers one PM-wide Product Query IR successor contract', () => {
  const member = loadMember();
  assert.doesNotThrow(
    () => validateAuthoredProductQueryInputs([member]),
  );
  assert.equal(member.canonical_value.stable_id, 'PRODUCT_QUERY_IR');
  assert.equal(
    member.canonical_value.definition.query_ir_contract.schema_version,
    'PRODUCT_QUERY_IR/V1',
  );
  assert.equal(
    member.canonical_value.definition.query_ir_contract
      .admission_context_schema_version,
    'PRODUCT_QUERY_ADMISSION_CONTEXT/V1',
  );
  assert.equal(
    member.canonical_value.definition.query_ir_contract
      .historical_process_query_ir_is_not_product_query_ir,
    true,
  );
});

test('requires one admitted domain and supports later CVR by registry data', () => {
  const domain = loadMember().canonical_value.definition.domain_contract;

  assert.deepEqual(domain.initial_required_domains, [
    'AGREEMENT',
    'PROCESS',
  ]);
  assert.equal(domain.selected_domain_must_be_release_admitted, true);
  assert.equal(domain.selected_domain_preserved_at_product_boundary, true);
  assert.equal(
    domain.filter_sort_and_column_fields_require_selected_domain_membership,
    true,
  );
  assert.equal(domain.future_domain_admission_is_registry_driven, true);
  assert.equal(domain.future_cvr_domain_requires_no_compiler_code_change, true);
  assert.equal(domain.internal_validation_alias_can_escape_product_boundary, false);
  assert.equal(domain.cross_domain_boolean_query_permitted, false);
});

test('closes nested structure and the exported Product boundary', () => {
  const definition = loadMember().canonical_value.definition;

  assert.equal(definition.required_sections.closed_nested_sections_required, true);
  assert.equal(
    definition.required_sections.additional_nested_authority_fields_permitted,
    false,
  );
  assert.equal(
    definition.required_sections.correctly_rehashed_structural_forgery_permitted,
    false,
  );
  assert.equal(definition.boundary_contract.exported_error_namespace, 'PRODUCT');
  assert.equal(
    definition.boundary_contract.process_error_code_can_escape_product_boundary,
    false,
  );
  assert.equal(
    definition.boundary_contract.requested_domain_must_be_retained_in_error_details,
    true,
  );
});

test('binds release, field domains and exact deterministic identity', () => {
  const definition = loadMember().canonical_value.definition;

  assert.equal(
    definition.release_contract.exact_approved_pm_data_version_required,
    true,
  );
  assert.equal(
    definition.release_contract
      .exact_product_field_catalogue_manifest_id_and_digest_required,
    true,
  );
  assert.equal(
    definition.identity_contract.stable_id_domain,
    'PRODUCT_QUERY_IR/V1',
  );
  assert.equal(
    definition.identity_contract.schema_version_participates_in_identity,
    true,
  );
  assert.equal(
    definition.identity_contract.prohibited_identity_inputs
      .includes('internal_domain_alias'),
    true,
  );
  assert.equal(
    definition.identity_contract
      .same_semantic_inputs_produce_byte_equivalent_product_query_ir,
    true,
  );
});

test('rejects missing, extra and semantically drifted Product contracts', () => {
  assert.throws(
    () => validateAuthoredProductQueryInputs([
      loadMember(),
      clone(loadMember()),
    ]),
    { code: 'PRODUCT_QUERY_CONTRACT_MEMBERSHIP_MISMATCH' },
  );

  const changed = loadMember();
  changed.canonical_value.definition.domain_contract
    .cross_domain_boolean_query_permitted = true;
  assert.throws(
    () => validateAuthoredProductQueryInputs([changed]),
    { code: 'INVALID_PRODUCT_QUERY_IR_CONTRACT_INPUT' },
  );

  const nested = loadMember();
  nested.canonical_value.definition.required_sections
    .invented_authority = true;
  assert.throws(
    () => validateAuthoredProductQueryInputs([nested]),
    { code: 'INVALID_PRODUCT_QUERY_IR_CONTRACT_INPUT' },
  );
});

test('compiles as one non-authorising successor input', () => {
  const compiled = compileCanonicalContractInput({ root_directory: ROOT });
  const member = compiled.authored_members.find(
    (candidate) => candidate.stable_id === 'PRODUCT_QUERY_IR',
  );

  assert.equal(compiled.authored_members.length, 130);
  assert.equal(member.object_kind, 'PRODUCT_QUERY_CONTRACT_INPUT');
  assert.equal(
    Object.values(member.canonical_value.definition.authority_contract)
      .every((value) => value === false),
    true,
  );
  assert.equal(compiled.authored_universe_assessment.status, 'NOT_ASSESSED');
  assert.equal(compiled.disposition.status, 'INCOMPLETE_UNIVERSE');
  assert.equal(compiled.disposition.freeze_eligible, false);
  assert.equal(compiled.disposition.canonical_contract_bundle_authority, 'NONE');
});
