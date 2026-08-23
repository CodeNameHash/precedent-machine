const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { renderToStaticMarkup } = require('react-dom/server');
const { trimReviewDealForWire } = require('../lib/queries/review-deal-wire');
const { reconstructReviewDeal } = require('../lib/queries/reconstruct-review-deal');

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

function canonicalReviewRows() {
  return {
    schema_version: 'TERMINATION_RIGHTS_REVIEW_ROWS/V1',
    agreement_analysis_id: 'analysis:1',
    agreement_projection_id: 'projection:1',
    rows: [
      {
        display_section_id: 'termination-rights',
        governed_ordinal: 0,
        input_occurrence_id: 'occurrence:1',
        disposition_id: 'disposition:1',
        effect_id: 'effect:outside',
        rule_id: 'rule:outside',
        profile_id: 'profile:outside',
        profile_key: 'PROFILE:TERMINATION:OUTSIDE_DATE_RIGHT',
        subtype_key: 'OUTSIDE_DATE_RIGHT',
        projection_row_id: 'projection-row:outside',
        fact_ids: ['fact:outside'],
        source_span_ids: ['span:outside'],
        extraction_state: 'COMPLETE',
        source_quality: 'SUFFICIENT',
        output_disposition: 'NORMAL',
        review_required: false,
        issue_codes: [],
      },
      {
        display_section_id: 'termination-rights',
        governed_ordinal: 0,
        input_occurrence_id: 'occurrence:1',
        disposition_id: 'disposition:1',
        effect_id: 'effect:breach',
        rule_id: 'rule:breach',
        profile_id: 'profile:breach',
        profile_key: 'PROFILE:TERMINATION:BREACH_RIGHT',
        subtype_key: 'BREACH_RIGHT',
        projection_row_id: null,
        fact_ids: ['fact:breach'],
        source_span_ids: ['span:breach'],
        extraction_state: 'INCOMPLETE',
        source_quality: 'SUFFICIENT',
        output_disposition: 'REVIEW_ONLY',
        review_required: true,
        issue_codes: ['UNPROVED_DEPENDENT_RULE'],
      },
    ],
    general_review_items: [],
  };
}

test('Termination Rights renders canonical propositions in place and flags only the failed rule', () => {
  const selected = terminationRightsConfig.selectRows({
    cards: [],
    canonical_v2_termination_rights_review_rows: canonicalReviewRows(),
  });

  assert.equal(selected.length, 1);
  const canonicalGroup = selected[0].groups[0];
  assert.equal(canonicalGroup.id, 'canonical-v2-termination-right-propositions');
  assert.deepEqual(canonicalGroup.rows.map((row) => ({
    label: row.label,
    reviewRequired: row.reviewRequired,
    issueCodes: row.issueCodes,
  })), [
    {
      label: 'Outside date right',
      reviewRequired: false,
      issueCodes: [],
    },
    {
      label: 'Breach right',
      reviewRequired: true,
      issueCodes: ['UNPROVED_DEPENDENT_RULE'],
    },
  ]);
});

test('Termination Rights review rows survive the read-only server-to-browser path', () => {
  const canonicalRows = canonicalReviewRows();
  const reviewDeal = { dealId: 'deal:1', cardCount: 0, cards: [] };
  const attached = Object.freeze({
    ...reviewDeal,
    canonical_v2_termination_rights_review_rows: canonicalRows,
  });
  const reconstructed = reconstructReviewDeal(trimReviewDealForWire(attached));

  assert.deepEqual(reconstructed.canonical_v2_termination_rights_review_rows, canonicalRows);
  assert.equal(Object.prototype.hasOwnProperty.call(reviewDeal, 'canonical_v2_termination_rights_review_rows'), false);
  assert.equal(Object.isFrozen(attached), true);
});

test('Termination Rights keeps an unclassified failed effect in its general review lane', () => {
  const canonicalRows = canonicalReviewRows();
  canonicalRows.general_review_items.push({
    display_section_id: 'termination-rights',
    governed_ordinal: 1,
    input_occurrence_id: 'occurrence:2',
    disposition_id: 'disposition:2',
    effect_id: 'effect:unclassified',
    rule_id: null,
    output_disposition: 'REVIEW_ONLY',
    review_required: true,
    extraction_state: 'INCOMPLETE',
    source_quality: 'SUFFICIENT',
    issue_code: 'NO_COMPATIBLE_PROFILE',
    source_span_ids: ['span:unclassified'],
  });

  const selected = terminationRightsConfig.selectRows({
    cards: [],
    canonical_v2_termination_rights_review_rows: canonicalRows,
  });

  const general = selected[0].groups.find(
    (group) => group.id === 'canonical-v2-termination-general-review',
  );
  assert.deepEqual(general.rows.map((row) => ({
    label: row.label,
    reviewRequired: row.reviewRequired,
    issueCodes: row.issueCodes,
  })), [{
    label: 'Unclassified termination right',
    reviewRequired: true,
    issueCodes: ['NO_COMPATIBLE_PROFILE'],
  }]);
});

test('Termination Rights renders one visible review badge without flagging its normal sibling', () => {
  const selected = terminationRightsConfig.selectRows({
    cards: [],
    canonical_v2_termination_rights_review_rows: canonicalReviewRows(),
  });
  const rows = selected[0].groups[0].rows;

  const normalHtml = renderToStaticMarkup(rows[0].children);
  const reviewHtml = renderToStaticMarkup(rows[1].children);

  assert.doesNotMatch(normalHtml, /data-termination-review-required/);
  assert.doesNotMatch(normalHtml, /Needs review/);
  assert.match(reviewHtml, /data-termination-review-required="true"/);
  assert.match(reviewHtml, /Needs review/);
  assert.match(reviewHtml, /Linked provision could not be proved/);
});

test('Termination Rights explains an unclassified review item in plain English', () => {
  const canonicalRows = canonicalReviewRows();
  canonicalRows.general_review_items.push({
    display_section_id: 'termination-rights',
    governed_ordinal: 1,
    input_occurrence_id: 'occurrence:2',
    disposition_id: 'disposition:2',
    effect_id: 'effect:unclassified',
    rule_id: null,
    output_disposition: 'REVIEW_ONLY',
    review_required: true,
    extraction_state: 'INCOMPLETE',
    source_quality: 'SUFFICIENT',
    issue_code: 'NO_COMPATIBLE_PROFILE',
    source_span_ids: ['span:unclassified'],
  });
  const selected = terminationRightsConfig.selectRows({
    cards: [],
    canonical_v2_termination_rights_review_rows: canonicalRows,
  });
  const general = selected[0].groups.find(
    (group) => group.id === 'canonical-v2-termination-general-review',
  );

  assert.match(
    renderToStaticMarkup(general.rows[0].children),
    /No approved Termination Right type matched/,
  );
});

test('Termination Rights restores governed occurrence order at the UI boundary', () => {
  const canonicalRows = canonicalReviewRows();
  canonicalRows.rows.unshift({
    ...canonicalRows.rows[0],
    governed_ordinal: 1,
    input_occurrence_id: 'occurrence:2',
    disposition_id: 'disposition:2',
    effect_id: 'effect:legal',
    rule_id: 'rule:legal',
    profile_id: 'profile:legal',
    profile_key: 'PROFILE:TERMINATION:LEGAL_RESTRAINT_RIGHT',
    subtype_key: 'LEGAL_RESTRAINT_RIGHT',
    projection_row_id: 'projection-row:legal',
    fact_ids: ['fact:legal'],
    source_span_ids: ['span:legal'],
  });

  const selected = terminationRightsConfig.selectRows({
    cards: [],
    canonical_v2_termination_rights_review_rows: canonicalRows,
  });

  assert.deepEqual(
    selected[0].groups[0].rows.map((row) => row.governedOrdinal),
    [0, 0, 1],
  );
});

test('Termination Rights has presentation labels for all nine approved right types', () => {
  const subtypeKeys = [
    'MUTUAL_CONSENT_RIGHT',
    'OUTSIDE_DATE_RIGHT',
    'LEGAL_RESTRAINT_RIGHT',
    'STOCKHOLDER_APPROVAL_FAILURE_RIGHT',
    'BREACH_RIGHT',
    'SUPERIOR_PROPOSAL_RIGHT',
    'RECOMMENDATION_CHANGE_RIGHT',
    'FAILURE_TO_CLOSE_RIGHT',
    'FIDUCIARY_NOTICE_RIGHT',
  ];
  const canonicalRows = canonicalReviewRows();
  canonicalRows.rows = subtypeKeys.map((subtypeKey, index) => ({
    ...canonicalRows.rows[0],
    governed_ordinal: index,
    input_occurrence_id: `occurrence:${index}`,
    disposition_id: `disposition:${index}`,
    effect_id: `effect:${index}`,
    rule_id: `rule:${index}`,
    profile_id: `profile:${index}`,
    profile_key: `PROFILE:TERMINATION:${subtypeKey}`,
    subtype_key: subtypeKey,
    projection_row_id: `projection-row:${index}`,
    fact_ids: [`fact:${index}`],
    source_span_ids: [`span:${index}`],
  }));

  const selected = terminationRightsConfig.selectRows({
    cards: [],
    canonical_v2_termination_rights_review_rows: canonicalRows,
  });

  assert.deepEqual(selected[0].groups[0].rows.map((row) => row.label), [
    'Mutual consent right',
    'Outside date right',
    'Legal restraint right',
    'Stockholder approval failure right',
    'Breach right',
    'Superior proposal right',
    'Recommendation change right',
    'Failure to close right',
    'Fiduciary notice right',
  ]);
});
