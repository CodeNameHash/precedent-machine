'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { adaptFamily } = require('../lib/canonical-v2/family-adapter');
const { validateApprovedFamilyRoleSchema } = require('../lib/canonical-v2/family-role-schema-authority');
const { canonicalJson, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');

const ROOT = path.resolve(__dirname, '..');
const MIGRATION = path.resolve(ROOT, 'evidence/canonical-v2/stage-2y-structure-migration');
const familyKeys = JSON.parse(fs.readFileSync(path.resolve(MIGRATION, 'control/family-keys.json'))).family_keys;
const analysisPaths = fs.readdirSync(path.resolve(MIGRATION, 'shadow/m4'))
  .filter((name) => name.endsWith('.agreement-analysis.json'))
  .sort()
  .map((name) => path.resolve(MIGRATION, 'shadow/m4', name));
const analyses = analysisPaths.map((file) => JSON.parse(fs.readFileSync(file)));

function schemaAndAuthority(familyKey) {
  const schemaPath = path.resolve(MIGRATION, 'control/family-role-schemas', `${familyKey}.json`);
  const authorityPath = path.resolve(MIGRATION, 'control/family-execution-authorities', `${familyKey}.json`);
  const bytes = fs.readFileSync(schemaPath);
  const authority = JSON.parse(fs.readFileSync(authorityPath));
  return { schema: validateApprovedFamilyRoleSchema(bytes, authority), authority };
}

test('Ben programme rulings bind all 25 approved role schemas', () => {
  const rulingPath = path.resolve(MIGRATION, 'control/m5-programme-rulings.json');
  const rulingBytes = fs.readFileSync(rulingPath);
  const ruling = JSON.parse(rulingBytes);
  assert.equal(ruling.rulings.length, 3);
  assert.deepEqual(ruling.rulings.map((entry) => entry.selection), [
    'ONE_COMPOUND_PROPOSITION',
    'ONE_OWNER_WITH_LINKED_CONSUMERS',
    'FAIL_ONLY_THE_DEPENDENT_PROPOSITION',
  ]);
  for (const familyKey of familyKeys) {
    const { schema } = schemaAndAuthority(familyKey);
    assert.equal(schema.family_key, familyKey);
    assert.equal(schema.approval_id, ruling.approval_id);
    assert.equal(schema.ruling_bindings.length, 3);
    assert.ok(schema.ruling_bindings.every((entry) => entry.sha256 === sha256Hex(rulingBytes)));
    assert.ok(schema.subtype_profiles.every((profile) => profile.unresolved_legal_question_ids.length === 0));
  }
});

test('saved M4 analyses adapt deterministically without mutation or cross-family claims', () => {
  for (const familyKey of familyKeys) {
    const { schema } = schemaAndAuthority(familyKey);
    for (const analysis of analyses) {
      const before = canonicalJson(analysis);
      const result = adaptFamily(analysis, {
        schema_version: 'STAGE_2Y_FAMILY_ADAPTER_TASK/V1',
        family_key: familyKey,
        approved_role_schema: schema,
      });
      assert.equal(canonicalJson(analysis), before);
      assert.equal(result.family_key, familyKey);
      assert.equal(result.claim_count, analysis.claims.filter((claim) => claim.family === familyKey).length);
      assert.equal(result.claim_count, result.complete_count + result.missing_required_role_count);
      assert.ok(result.validations.every((entry) => entry.family === familyKey));
      for (const validation of result.validations) {
        const profile = schema.subtype_profiles.find((entry) => entry.profile_id === validation.profile_id);
        assert.ok(profile);
        if (validation.validation_state === 'COMPLETE') {
          assert.equal(validation.roles.length, profile.required_roles.length);
          assert.equal(validation.missing_required_roles.length, 0);
        } else {
          assert.ok(validation.missing_required_roles.length > 0);
        }
        for (const role of validation.roles) {
          assert.ok(role.provenance.length > 0);
          assert.ok(role.provenance.every((entry) => entry.source_span.text_sha256));
        }
      }
      const repeated = adaptFamily(analysis, {
        schema_version: 'STAGE_2Y_FAMILY_ADAPTER_TASK/V1',
        family_key: familyKey,
        approved_role_schema: schema,
      });
      assert.equal(canonicalJson(repeated), canonicalJson(result));
    }
  }
});

test('Capitalisation remains a zero-comparator structural family', () => {
  const { schema } = schemaAndAuthority('CAPITALISATION');
  assert.equal(schema.claim_definition_scope.included_claim_definition_keys.length, 7);
  assert.equal(analyses.flatMap((analysis) => analysis.claims).filter((claim) => claim.family === 'CAPITALISATION').length, 0);
});
