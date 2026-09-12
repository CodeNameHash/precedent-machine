'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { validateLegalSchema } = require('../lib/product/legal-schema');
const v1 = require('../contracts/product/legal-schema.v1.json');
const v2 = require('../contracts/product/legal-schema.v2.json');

test('V2 validates and is the deterministic output of its generator', () => {
  assert.equal(validateLegalSchema(v2).schema_version, 'LEGAL_SCHEMA/V2');
  assert.equal(validateLegalSchema(v1).schema_version, 'LEGAL_SCHEMA/V1');
  const before = fs.readFileSync(path.join(__dirname, '../contracts/product/legal-schema.v2.json'), 'utf8');
  execFileSync('node', [path.join(__dirname, '../scripts/product/build-legal-schema-v2.js')], { stdio: 'pipe' });
  const after = fs.readFileSync(path.join(__dirname, '../contracts/product/legal-schema.v2.json'), 'utf8');
  assert.equal(after, before, 'committed V2 must equal the generator output');
});

test('every V1 subtype survives in V2 by key or renamed_from, and no generic role is forced', () => {
  for (const family of v1.families) {
    const target = v2.families.find((candidate) => candidate.family_key === family.family_key);
    assert.ok(target, family.family_key);
    for (const subtype of family.subtypes) {
      const found = target.subtypes.find((candidate) => candidate.subtype_key === subtype.subtype_key || candidate.renamed_from === subtype.subtype_key);
      assert.ok(found, `${family.family_key}.${subtype.subtype_key}`);
      for (const role of ['TEMPORAL_OR_TRIGGER_SCOPE', 'QUALIFICATIONS', 'FORUM']) assert.ok(!found.required_roles.includes(role));
    }
  }
});

test("Ben's 2026-09-12 decisions are in V2", () => {
  const sub = (family, key) => v2.families.find((f) => f.family_key === family).subtypes.find((s) => s.subtype_key === key);
  assert.equal(sub('TERMINATION', 'BREACH').optional_roles.includes('notice_period'), false);
  assert.ok(sub('TERMINATION', 'BREACH').optional_roles.includes('cure_period_end'));
  assert.ok(sub('TERMINATION', 'BREACH').optional_roles.includes('curability'));
  assert.ok(sub('TERMINATION', 'SUPPORT_AGREEMENT_NOT_DELIVERED'));
  assert.ok(sub('TERMINATION', 'WRITTEN_CONSENT_NOT_DELIVERED'));
  assert.ok(sub('TERMINATION', 'BESPOKE_DATE_RIGHT'));
  assert.ok(sub('TERMINATION_FEE', 'FEE_ELECTION'));
  assert.ok(sub('NO_SHOP', 'RETURN_OR_DESTROY_REQUIREMENT'));
  assert.ok(sub('NO_SHOP', 'SUBSEQUENT_VDR_REMOVAL'));
  assert.ok(sub('KEY_DEFINED_TERMS', 'ACCEPTABLE_CONFIDENTIALITY_AGREEMENT'));
  assert.equal(sub('ANTITRUST_REGULATORY', 'LITIGATION_OBLIGATION').renamed_from, 'LITIGATION');
  assert.equal(sub('ANTITRUST_REGULATORY', 'REMEDY_LIMITATION').renamed_from, 'BURDEN');
  assert.ok(sub('ANTITRUST_REGULATORY', 'REMEDY_RESTRICTION'));
  assert.deepEqual(sub('ANTITRUST_REGULATORY', 'EFFORTS').standard_components, ['EFFORTS_STANDARD', 'MATERIALITY_QUALIFIER']);
  assert.equal(sub('SPECIFIC_PERFORMANCE_REMEDIES', 'AGREEMENT_OF_IRREPARABLE_DAMAGE').label, 'Agreement of irreparable damage');
  assert.equal(sub('SPECIFIC_PERFORMANCE_REMEDIES', 'AGREEMENT_TO_EQUITABLE_RELIEF').renamed_from, 'GENERAL_EQUITABLE_RELIEF');
  assert.ok(sub('PROXY_MEETING', 'SUPPORT_AGREEMENT_DELIVERY'));
  assert.equal(v2.families.find((f) => f.family_key === 'MISC_BOILERPLATE').coverage_only, true);
  assert.equal(v2.families.filter((f) => f.coverage_only).length, 1);
  assert.match(v2.families.find((f) => f.family_key === 'MATERIAL_CONTRACTS').headline.note, /threshold/);
  assert.ok(sub('MAE_DEFINITION', 'EXCLUSION').optional_roles.includes('FORUM'));
});
