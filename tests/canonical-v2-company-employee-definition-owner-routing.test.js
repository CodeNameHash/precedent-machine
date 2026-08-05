'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { shapeDefinedTermsProposals } = require('../lib/canonical-v2/native-producer/anthropic-provider');
const {
  EMPLOYEE_MATTERS_OWNER,
  routeCompanyEmployeeDefinitionToEmployeeMatters,
} = require('../lib/canonical-v2/company-employee-definition-owner-routing');

const SOURCE = 'Section 1.1 Definitions.\n"Company Employee" means each employee of the Company or any Company Subsidiary as of the Effective Time.';
const BODY = '"Company Employee" means each employee of the Company or any Company Subsidiary as of the Effective Time.';
const HEAD = '"Company Employee" means';

function nativeCandidate() {
  const shaped = shapeDefinedTermsProposals({
    definition_envelopes: [{
      section_reference: '1.1',
      defined_term: 'Company Employee',
      definition_kind: 'TERM_DEFINITION',
      definition_head_quote: HEAD,
      definition_body_quote: BODY,
      cross_reference_target: 'Effective Time',
      owner_hint: 'UNREVIEWED',
    }],
    open_world_candidates: [],
  }, SOURCE);
  assert.equal(shaped.proposals.length, 1);
  return shaped.proposals[0];
}

function input(overrides = {}) {
  return {
    provision_type: 'DEFINITION',
    provision_subtype: 'DEF-GENERAL',
    source_structure: {
      provision_instance_id: sha256Hex('company-employee-definition'),
      section_reference: 'Section 1.1',
      structural_path: ['ARTICLE_I', 'SECTION_1.1'],
    },
    candidate: nativeCandidate(),
    source_text: SOURCE,
    ...overrides,
  };
}

test('routes an exact Company Employee definition to Employee Matters as exact evidence only', () => {
  const result = routeCompanyEmployeeDefinitionToEmployeeMatters(input());
  assert.equal(result.owner_family, EMPLOYEE_MATTERS_OWNER);
  assert.equal(result.comparison_eligibility, 'EXACT_TEXT_AND_RELATIONSHIPS_ONLY');
  assert.equal(result.market_statistics, 'NOT_CALCULATED');
  assert.equal(result.definition_envelope.definition_body_quote, BODY);
  assert.equal(result.relationships.cross_reference_target, 'Effective Time');
  assert.deepEqual(result.source_evidence.map((item) => item.exact_quote), [BODY]);
  assert.equal(Object.hasOwn(result, 'concept_key'), false);
  assert.equal(Object.hasOwn(result, 'claim_definition_key'), false);
});

test('never routes from subtype alone or a near-match label', () => {
  const wrongType = input({ provision_type: 'COVENANT', provision_subtype: 'COMPANY_EMPLOYEE_DEFINITION' });
  assert.equal(routeCompanyEmployeeDefinitionToEmployeeMatters(wrongType), null);

  const nearMatch = nativeCandidate();
  nearMatch.attributes.definition_envelope.defined_term = 'Company Employee Plan';
  nearMatch.attributes.structured_mechanic.defined_term = 'Company Employee Plan';
  assert.equal(routeCompanyEmployeeDefinitionToEmployeeMatters(input({ candidate: nearMatch })), null);
});

test('fails closed when a matching term loses exact structural or evidence support', () => {
  const missingBodyEvidence = nativeCandidate();
  missingBodyEvidence.evidence[0].absolute_end = missingBodyEvidence.evidence[0].absolute_start + 1;
  assert.throws(
    () => routeCompanyEmployeeDefinitionToEmployeeMatters(input({ candidate: missingBodyEvidence })),
    /exact definition head and body/i,
  );

  const subtypeOnly = nativeCandidate();
  subtypeOnly.claim_definition_key = 'OTHER_CANDIDATE';
  assert.equal(routeCompanyEmployeeDefinitionToEmployeeMatters(input({ candidate: subtypeOnly })), null);
});
