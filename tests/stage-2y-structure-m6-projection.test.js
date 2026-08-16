'use strict';

const assert = require('node:assert/strict');
const { readFileSync, readdirSync } = require('node:fs');
const { resolve } = require('node:path');
const test = require('node:test');

const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const { projectAgreement, viewPolicyFor } = require('../lib/canonical-v2/agreement-projection');

const ROOT = resolve(__dirname, '..', 'evidence/canonical-v2/stage-2y-structure-migration');

function json(path) {
  return JSON.parse(readFileSync(path));
}

function policy() {
  return viewPolicyFor(json(resolve(ROOT, 'receipts/stage-2y-structure-m5-preparation.json')).family_order);
}

function normaliseText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

test('M6 projects every complete authored proposition with exact lineage', () => {
  const viewPolicy = policy();
  const files = readdirSync(resolve(ROOT, 'shadow/m5-correction/analysis'))
    .filter((name) => name.endsWith('.agreement-analysis.json')).sort();
  let propositions = 0;
  let rows = 0;
  let reviewRows = 0;
  const memberIds = [];
  for (const name of files) {
    const analysis = json(resolve(ROOT, 'shadow/m5-correction/analysis', name));
    const projection = projectAgreement(analysis, viewPolicy);
    assert.equal(Object.isFrozen(projection), true);
    assert.equal(projection.agreement_projection_id, contentId('AGREEMENT_PROJECTION/V1',
      Object.fromEntries(Object.entries(projection).filter(([key]) => !['schema_version', 'agreement_projection_id'].includes(key)))));
    assert.equal(projection.counts.silent_no_row_count, 0);
    assert.equal(projection.counts.material_fact_omission_count, 0);
    assert.equal(projection.omissions.length, analysis.compound_propositions.length);
    for (const row of projection.rows) {
      assert.ok(row.fields.every((field) => field.source_compound_proposition_ids.length === 1));
      assert.ok(row.citations.length > 0);
      assert.ok(row.citations.every((citation) => citation.exact_text.length > 0));
      const sourceText = normaliseText(row.citations.map((citation) => citation.exact_text).join('\n\n'));
      const compactText = normaliseText(row.fields.find((field) => field.field_key === 'compact_text')?.value);
      const expandedText = normaliseText(row.fields.find((field) => field.field_key === 'expanded_text')?.value);
      assert.notEqual(expandedText, sourceText, 'expanded comparison row must not repeat the source clause');
      assert.match(compactText, /^Comparison point:/, 'compact row must identify the comparison point');
      assert.match(expandedText, /^Comparison point:/, 'expanded row must identify the comparison point');
      assert.doesNotMatch(expandedText, /M7_DETERMINISTIC|SOURCE_PROVISION|_|\b(?:IOC|TPB)\b|\b[a-f0-9]{24,}\b/i,
        'comparison text must not expose internal schema names');
      if (sourceText.length > 160) {
        assert.equal(expandedText.includes(sourceText.slice(0, 120)), false,
          'comparison text must not copy the opening of a long source clause');
      }
      memberIds.push(...row.member_analysis_claim_ids);
    }
    propositions += analysis.compound_propositions.length;
    rows += projection.rows.length;
    reviewRows += projection.review_rows.length;
  }
  assert.equal(files.length, 7);
  assert.equal(propositions, 1111);
  assert.equal(rows, 1111);
  assert.equal(reviewRows, 0);
  assert.equal(memberIds.length, 1528);
  assert.equal(new Set(memberIds).size, 1528);
});

test('TopBuild section 6.3 receives separate Termination rows', () => {
  const analysis = json(resolve(ROOT, 'shadow/m5-correction/analysis/3888fa7618bbd9fd6530b657aaa18c7e85ff515acf80edb1fc78a190af86e9cb.agreement-analysis.json'));
  const projection = projectAgreement(analysis, policy());
  const rows = projection.rows.filter((row) => row.family_key === 'TERMINATION' && row.section_reference === '6.3');
  assert.ok(rows.length >= 4);
  assert.ok(rows.every((row) => row.row_state === 'COMPLETE_COMPARISON_ROW'));
  assert.ok(rows.every((row) => row.grouping_decision === 'SEPARATE_AUTHORED_LEGAL_UNIT'));
});

test('partial propositions use the review lane and never a normal row', () => {
  const analysis = json(resolve(ROOT, 'shadow/m5-correction/analysis/3888fa7618bbd9fd6530b657aaa18c7e85ff515acf80edb1fc78a190af86e9cb.agreement-analysis.json'));
  const altered = structuredClone(analysis);
  const target = altered.compound_propositions[0];
  target.proposition_validation_state = 'MISSING_REQUIRED_ROLE';
  target.missing_required_roles = ['UNAMBIGUOUS_REQUIRED_SUPPORT'];
  const projection = projectAgreement(altered, policy());
  assert.equal(projection.rows.some((row) => row.source_compound_proposition_id === target.compound_proposition_id), false);
  const review = projection.review_rows.find((row) => row.source_compound_proposition_id === target.compound_proposition_id);
  assert.ok(review);
  assert.equal(review.review_state, 'REVIEWABLE_PARTIAL_NOT_A_COMPLETE_LEGAL_ANSWER');
});

test('a generic M7 source provision stays in review until a comparison point is proved', () => {
  const analysis = json(resolve(ROOT, 'shadow/m5-correction/analysis/3888fa7618bbd9fd6530b657aaa18c7e85ff515acf80edb1fc78a190af86e9cb.agreement-analysis.json'));
  const altered = structuredClone(analysis);
  const target = altered.compound_propositions[0];
  target.claim_definition_keys = ['M7_DETERMINISTIC_EMPLOYEE_MATTERS_SOURCE_PROVISION'];
  target.roles.LEGAL_EFFECT_OR_MECHANIC = [{
    assertion_kind: 'M7_DETERMINISTIC_SOURCE_PROVISION',
    claim_definition_key: 'M7_DETERMINISTIC_EMPLOYEE_MATTERS_SOURCE_PROVISION',
  }];
  const projection = projectAgreement(altered, policy());
  assert.equal(projection.rows.some((row) => row.source_compound_proposition_id === target.compound_proposition_id), false);
  const review = projection.review_rows.find((row) => row.source_compound_proposition_id === target.compound_proposition_id);
  assert.ok(review);
  assert.equal(review.review_reason, 'SOURCE_PROVISION_IDENTIFIED_BUT_SPECIFIC_COMPARISON_POINT_NOT_YET_PROVED');
  assert.ok(review.missing_required_roles.includes('COMPARISON_POINT_DETAIL'));
});

test('a classified M7 representation topic is a specific comparison point', () => {
  const analysis = json(resolve(ROOT, 'shadow/m5-correction/analysis/3888fa7618bbd9fd6530b657aaa18c7e85ff515acf80edb1fc78a190af86e9cb.agreement-analysis.json'));
  const altered = structuredClone(analysis);
  const target = altered.compound_propositions[0];
  target.family_key = 'REPRESENTATIONS';
  target.claim_definition_keys = ['M7_DETERMINISTIC_REPRESENTATIONS_SOURCE_PROVISION'];
  target.roles.LEGAL_EFFECT_OR_MECHANIC = [{
    assertion_kind: 'M7_DETERMINISTIC_SOURCE_PROVISION',
    claim_definition_key: 'M7_DETERMINISTIC_REPRESENTATIONS_SOURCE_PROVISION',
  }];
  target.roles.MEMBER_FACTS[0].attributes.representation_topics = ['CAPITALISATION'];
  const projection = projectAgreement(altered, policy());
  const row = projection.rows.find((entry) => entry.source_compound_proposition_id === target.compound_proposition_id);
  assert.ok(row);
  const expanded = row.fields.find((field) => field.field_key === 'expanded_text').value;
  assert.match(expanded, /^Comparison point: Representation: Capitalisation/);
});

test('Capitalisation remains parked and publication remains disabled', () => {
  const viewPolicy = policy();
  const capitalisation = viewPolicy.family_display_policies.find((entry) => entry.family_key === 'CAPITALISATION');
  assert.equal(capitalisation.normal_output, 'PARKED_NO_CURRENT_PROPOSITIONS');
  assert.equal(viewPolicy.publication_authorisation, 'NONE');
});
