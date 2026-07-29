const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  compileCanonicalContractInput,
} = require('../lib/canonical-v2/canonical-contract-input-compiler');
const {
  validateAuthoredSharedAuthorityInputs,
} = require('../lib/canonical-v2/shared-authority-contract-input-validator');

const ROOT = path.join(__dirname, '../contracts/canonical-v2/successor');
const PROJECTION_PATH = 'shared/projections/canonical-deal-fact-projection.v1.json';
const CATALOGUE_PATH = 'shared/field-definitions/shared-deal-field-catalogue.v1.json';
const BASELINE_FIELDS = [
  'deal',
  'signed',
  'buyer',
  'value',
  'type',
  'structure',
  'buyer_type',
  'sector',
  'law_firm',
  'lawyer',
  'law_firm_buyer',
  'law_firm_target',
  'lawyers_buyer',
  'lawyers_target',
  'merger_form',
];

function load(relativePath) {
  const canonicalValue = JSON.parse(
    fs.readFileSync(path.join(ROOT, relativePath), 'utf8'),
  );
  return {
    object_kind: canonicalValue.object_kind,
    canonical_value: canonicalValue,
  };
}

function members() {
  return [load(PROJECTION_PATH), load(CATALOGUE_PATH)];
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('compiles the shared projection and full PM baseline catalogue without release authority', () => {
  const first = compileCanonicalContractInput({ root_directory: ROOT });
  const second = compileCanonicalContractInput({ root_directory: ROOT });

  assert.deepEqual(first, second);
  assert.equal(first.authored_universe_assessment.status, 'NOT_ASSESSED');
  assert.equal(first.disposition.status, 'INCOMPLETE_UNIVERSE');
  assert.equal(first.disposition.freeze_eligible, false);
  assert.equal(first.disposition.canonical_contract_bundle_authority, 'NONE');
});

test('accepts the exact projection and field catalogue contracts', () => {
  assert.doesNotThrow(() => validateAuthoredSharedAuthorityInputs(members()));
});

test('offers all 15 current PM fields through one release-admitted catalogue', () => {
  const catalogue = members()[1].canonical_value;
  assert.deepEqual(catalogue.current_pm_baseline_field_keys, BASELINE_FIELDS);
  assert.deepEqual(
    catalogue.field_definitions.map((field) => field.field_key),
    BASELINE_FIELDS,
  );
  assert.ok(catalogue.field_definitions.every((field) => field.capabilities.filter));
  assert.equal(
    catalogue.catalogue_contract.release_admitted_union_drives_more_filters,
    true,
  );
  assert.equal(
    catalogue.catalogue_contract.new_field_in_existing_group_requires_ui_code,
    false,
  );
});

test('keeps each projected field typed, release-pinned and exact-detail capable', () => {
  const projection = members()[0].canonical_value.definition.type_contract;
  assert.equal(projection.admitted_fields_only, true);
  assert.equal(projection.selected_revision_required, true);
  assert.equal(projection.generic_revision_id_permitted, false);
  assert.equal(projection.complete_release_identity_per_field, true);
  assert.equal(projection.exact_detail_action_from_terminal_lineage, true);
  assert.equal(projection.write_credential_in_projection, false);
  assert.equal(projection.direct_write_path, false);
  assert.equal(projection.legacy_value_fallback, false);
});

test('uses same-component professional filters and three-valued completeness', () => {
  const catalogue = members()[1].canonical_value;
  const professionalFields = catalogue.field_definitions.filter(
    (field) => field.field_group === 'PROFESSIONALS',
  );

  assert.equal(professionalFields.length, 6);
  for (const field of professionalFields) {
    assert.equal(field.filter_scope, 'SAME_PROFESSIONAL_ASSIGNMENT_COMPONENT');
    assert.equal(field.multiplicity, 'MANY');
    assert.equal(field.incomplete_collection_behaviour, 'UNKNOWN');
    assert.equal(field.identity_filter_uses_canonical_id, true);
    assert.equal(field.legacy_filter_authority, false);
    assert.ok(field.permitted_operators.includes('ALL'));
  }
});

test('rejects a missing baseline field and a hidden current filter', () => {
  const missing = clone(members()[1]);
  missing.canonical_value.field_definitions.pop();
  assert.throws(
    () => validateAuthoredSharedAuthorityInputs([missing]),
    (error) => error.code === 'INVALID_SHARED_AUTHORITY_FIELD_CATALOGUE_INPUT',
  );

  const hidden = clone(members()[1]);
  hidden.canonical_value.field_definitions[0].capabilities.filter = false;
  assert.throws(
    () => validateAuthoredSharedAuthorityInputs([hidden]),
    (error) => error.code === 'INVALID_SHARED_AUTHORITY_FIELD_CATALOGUE_INPUT',
  );
});

test('rejects legacy professional authority and a generic projection revision', () => {
  const legacy = clone(members()[1]);
  legacy.canonical_value.field_definitions
    .find((field) => field.field_key === 'law_firm')
    .legacy_filter_authority = true;
  assert.throws(
    () => validateAuthoredSharedAuthorityInputs([legacy]),
    (error) => error.code === 'INVALID_SHARED_AUTHORITY_FIELD_CATALOGUE_INPUT',
  );

  const generic = clone(members()[0]);
  generic.canonical_value.definition.type_contract.generic_revision_id_permitted = true;
  assert.throws(
    () => validateAuthoredSharedAuthorityInputs([generic]),
    (error) => error.code === 'INVALID_SHARED_AUTHORITY_LOGICAL_TYPE_INPUT',
  );
});
