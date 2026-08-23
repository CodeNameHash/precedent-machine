'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const {
  attachStageBGovernedDisclosureNotes,
} = require('../lib/canonical-v2/termination-rights-review-stage-b-notes');
const {
  createCanonicalTerminationRightsReviewAttacher,
} = require('../lib/canonical-v2/termination-rights-review-serving-source');
const { canonicalJson } = require('../lib/canonical-v2/canonical-bytes');

const REVIEW_ROWS_FIELD = 'canonical_v2_termination_rights_review_rows';

const DEAL_ID = '00000000-0000-4000-8000-000000000001';
const B9E_PROFILE_KEY =
  'b9e3024406e1a399f7bcf363f4f6267545b265dafb0ed12cd43c71b154c16712';
const B9E_PROFILE_PATH =
  `PROFILE:TERMINATION:LEGAL_RESTRAINT:${B9E_PROFILE_KEY}`;
const DISPLAY_TEXT = 'contained in non-public disclosure letter';

let terminationRightsConfig;

test.before(async () => {
  ({ terminationRightsConfig } = await import(path.join(
    '..',
    'components',
    'review',
    'table-configs',
    'termination-rights.config.js',
  )));
});

function stageBBlueprint() {
  return {
    schema_version: 'M7_V2_TERMINATION_WORK3_STAGE_B_45_PROFILE_BLUEPRINT_PROPOSAL/V1',
    profile_approval_state: 'UNAPPROVED',
    proposed_profiles: [{
      proposed_profile_key: B9E_PROFILE_KEY,
      governed_disclosure_notes: [{
        display_text: DISPLAY_TEXT,
        disposition_kind: 'NON_PUBLIC_DISCLOSURE_LOCATION',
        field_key: 'JURISDICTION_LIST_REFERENCE',
        profile_key: B9E_PROFILE_PATH,
      }],
    }],
  };
}

function jurisdictionFact() {
  return {
    kind: 'FACT',
    fact_id: 'fact:jurisdiction',
    field_key: 'JURISDICTION_LIST_REFERENCE',
    value_type: 'REFERENCE',
    typed_value: null,
    materiality: 'MATERIAL',
    evidence_parts: [],
  };
}

function reviewDealWithRestraintRow() {
  const fact = jurisdictionFact();
  return {
    dealId: DEAL_ID,
    cards: [],
    [REVIEW_ROWS_FIELD]: {
      schema_version: 'TERMINATION_RIGHTS_REVIEW_ROWS/V2',
      agreement_analysis_id: 'analysis:1',
      agreement_projection_id: 'projection:1',
      rows: [{
        display_section_id: 'termination-rights',
        governed_ordinal: 0,
        input_occurrence_id: 'occurrence:1',
        disposition_id: 'disposition:1',
        effect_id: 'effect:restraint',
        rule_id: 'rule:restraint',
        profile_id: 'profile:restraint',
        profile_key: B9E_PROFILE_PATH,
        subtype_key: 'LEGAL_RESTRAINT_RIGHT',
        projection_row_id: null,
        fact_ids: [fact.fact_id],
        source_span_ids: [],
        extraction_state: 'INCOMPLETE',
        source_quality: 'SUFFICIENT',
        output_disposition: 'REVIEW_ONLY',
        review_required: true,
        issue_codes: [],
        full_provision: {
          location: 'PRIMARY',
          source_reference: '7.01(b)',
          agreement_index_id: 'agreement-index:1',
          source_node_occurrence_id: 'node:7.01(b)',
          selector: {
            coordinate_system: 'UTF8_CANONICAL_TEXT_HALF_OPEN',
            start_byte: 0,
            end_byte: 10,
            text_sha256: 'provision-hash',
          },
          exact_text: 'legal restraint',
        },
        linked_provisions: [],
        dependency_references: [],
        expression_tree: {
          expression_id: 'expression:root',
          operator: 'ALL_OF',
          result_kind: 'LOGICAL',
          connective_evidence_parts: [],
          children: [{
            kind: 'FACT',
            ordinal: 1,
            role: 'MEMBER',
            node: fact,
          }],
        },
        child_rules: [],
        fact_groups: [],
        ungrouped_fact_ids: [fact.fact_id],
        dimension_reviews: [],
        decision_review_required: false,
      }],
      general_review_items: [],
    },
  };
}

test('Stage B display notes attach to the Termination Rights review path without Work3 identity', () => {
  assert.equal(
    typeof attachStageBGovernedDisclosureNotes,
    'function',
    'Stage B review-note adapter is missing from the product path.',
  );

  const reviewDeal = reviewDealWithRestraintRow();
  const before = canonicalJson(reviewDeal);
  const result = attachStageBGovernedDisclosureNotes(reviewDeal, stageBBlueprint());

  assert.notEqual(result, reviewDeal);
  assert.equal(canonicalJson(reviewDeal), before);
  const fact = result[REVIEW_ROWS_FIELD]
    .rows[0]
    .expression_tree
    .children[0]
    .node;
  assert.equal(fact.typed_value, null);
  assert.equal(fact.governed_disclosure_notes.length, 1);
  assert.equal(fact.governed_disclosure_notes[0].display_text, DISPLAY_TEXT);
  assert.equal(
    fact.governed_disclosure_notes[0].disposition_kind,
    'NON_PUBLIC_DISCLOSURE_LOCATION',
  );
  assert.equal(
    fact.governed_disclosure_notes[0].field_key,
    'JURISDICTION_LIST_REFERENCE',
  );
  for (const key of [
    'profile_id',
    'requirement_id',
    'expression_id',
    'rule_id',
    'inventory_fingerprint',
    'approval_record',
    'registration_id',
    'activation_id',
  ]) {
    assert.equal(
      Object.prototype.hasOwnProperty.call(fact.governed_disclosure_notes[0], key),
      false,
      key,
    );
  }
});

test('the cards serving path applies a registered Stage B blueprint after assembly', async () => {
  const agreementIndexes = [{
    schema_version: 'AGREEMENT_INDEX/V1',
    agreement_index_id: 'agreement-index:1',
  }];
  const analysis = {
    schema_version: 'AGREEMENT_ANALYSIS/V2',
    source_closures: [{
      agreement_index_binding: {
        record_id_field: 'agreement_index_id',
        record_id: agreementIndexes[0].agreement_index_id,
      },
    }],
  };
  const attach = createCanonicalTerminationRightsReviewAttacher({
    validateAnalysis() { return { status: 'PASS' }; },
    validateProjection() { return { status: 'PASS' }; },
    assemble(input) {
      return {
        ...input.reviewDeal,
        ...reviewDealWithRestraintRow(),
        dealId: input.reviewDeal.dealId,
      };
    },
  });

  const result = await attach({ dealId: DEAL_ID, cards: [] }, {
    sources: {
      [DEAL_ID]: () => ({
        application_deal_id: DEAL_ID,
        analysis,
        projection: { schema_version: 'AGREEMENT_PROJECTION/V2' },
        agreement_indexes: agreementIndexes,
        view_policy: { schema_version: 'STAGE_2Y_M7_V2_VIEW_POLICY/V1' },
        resolve_binding: () => Buffer.from(`${canonicalJson(agreementIndexes[0])}\n`, 'utf8'),
      }),
    },
    reviewState: {
      [DEAL_ID]: { open_review_keys: [], prompts: [], fact_groups: [] },
    },
    stageBBlueprints: { [DEAL_ID]: stageBBlueprint() },
  });

  const fact = result[REVIEW_ROWS_FIELD]
    .rows[0]
    .expression_tree
    .children[0]
    .node;
  assert.equal(fact.governed_disclosure_notes[0].display_text, DISPLAY_TEXT);
});

test('the Termination Rights UI renders the Stage B B9e note as display-only metadata', () => {
  const noted = attachStageBGovernedDisclosureNotes(
    reviewDealWithRestraintRow(),
    stageBBlueprint(),
  );
  const selected = terminationRightsConfig.selectRows(noted);
  const html = renderToStaticMarkup(
    React.createElement(React.Fragment, null, selected[0].groups[0].rows[0].children),
  );
  assert.match(html, /contained in non-public disclosure letter/);
  assert.match(html, /data-termination-governed-disclosure-note/);
  assert.doesNotMatch(html, /profile_id|requirement_id|inventory_fingerprint/);
});
