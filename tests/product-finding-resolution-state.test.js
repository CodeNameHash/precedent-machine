'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { applyReviewCommand } = require('../lib/product/review-state');

const analysis = {
  kind: 'draftAnalysis',
  proposals: [],
  issues: [
    { issue_id: 'issue-published', code: 'CONTRADICTION', state: 'OPEN', structure_node_id: null, family_key: null },
    { issue_id: 'issue-omitted', code: 'CONTRADICTION', state: 'OPEN', structure_node_id: null, family_key: null },
  ],
  coverage_assertions: [],
  sections: [],
};
const legalSchema = { families: [] };

function publishedState() {
  return {
    schema_version: 'PRODUCT_REVIEW_STATE/V1',
    draft_analysis_id: 'finding-resolution-draft',
    analysis_run_id: '00000000-0000-4000-8000-000000000015',
    status: 'PUBLISHED',
    started_at: '2026-09-05T09:00:00.000Z',
    updated_at: '2026-09-05T09:35:00.000Z',
    published_at: '2026-09-05T09:35:00.000Z',
    review_timing: {
      schema_version: 'PRODUCT_REVIEW_TIMING/V1',
      accumulated_draft_seconds: 2100,
      active_draft_started_at: null,
    },
    agreement_coverage: {
      decision: 'ACCEPTED',
      reviewed_at: '2026-09-05T09:34:00.000Z',
    },
    items: [
      { item_id: 'finding-published', source_id: 'issue-published', kind: 'ISSUE', decision: 'ACCEPTED' },
      { item_id: 'finding-omitted', source_id: 'issue-omitted', kind: 'ISSUE', decision: 'ACCEPTED' },
      { item_id: 'review-item-1', source_id: 'proposal-1', kind: 'PROPOSAL', decision: 'ACCEPTED' },
    ],
    summary: {
      schema_version: 'PRODUCT_REVIEW_SUMMARY/V1',
      summary_id: 'finding-resolution-summary',
      draft_analysis_id: 'finding-resolution-draft',
      families: [{
        family_key: 'TEST',
        facts: [{
          review_item_id: 'review-item-1',
          structure_node_id: null,
          family_key: 'TEST',
          subtype_key: 'TEST',
          fact_type: 'TEST',
          statement: 'A published fact.',
          roles: {},
          source_span_ids: ['span-1'],
        }],
      }],
      relationships: [],
    },
    metrics: {
      schema_version: 'PRODUCT_REVIEW_METRICS/V1',
      proposal_count: 0,
      proposal_errors: 0,
      proposal_omissions: 0,
      unresolved_count: 0,
      review_time_seconds: 2100,
    },
    release_evaluation_input: null,
    release_evaluation: null,
  };
}

function evaluationCommand(findingResolutions) {
  return {
    type: 'EVALUATE_RELEASE',
    reviewer_identity: 'finding-resolution-lawyer',
    lawyer_attestation: true,
    independent_inventory_attestation: true,
    inventory: [],
    reconciliation: [],
    citation_assessments: [{
      review_item_id: 'review-item-1', exact: true, legally_sufficient: true, narrow: true,
    }],
    finding_resolutions: findingResolutions,
    elapsed_minutes: 1,
    developer_assisted: false,
  };
}

const options = {
  analysis,
  legalSchema,
  clock: () => new Date('2026-09-05T09:36:00.000Z'),
  timing: {
    processingStartedAt: '2026-09-05T08:10:00.000Z',
    processingCompletedAt: '2026-09-05T09:00:00.000Z',
  },
};

test('release evaluation persists lawyer-stamped finding resolutions', () => {
  const findingResolutions = [
    {
      finding_item_id: 'finding-published',
      disposition: 'PUBLISHED_FACT',
      published_fact_review_item_id: 'review-item-1',
    },
    {
      finding_item_id: 'finding-omitted',
      disposition: 'REVIEWED_OMISSION',
      omission_reason: 'The finding is not material to the agreement summary.',
    },
  ];

  const state = applyReviewCommand(publishedState(), evaluationCommand(findingResolutions), options);

  assert.deepEqual(state.release_evaluation_input.finding_resolutions, findingResolutions.map((resolution) => ({
    ...resolution,
    reviewed_by_role: 'LAWYER',
  })));
});

test('release evaluation accepts an omitted finding resolution list as empty', () => {
  const command = evaluationCommand(undefined);
  delete command.finding_resolutions;

  const state = applyReviewCommand(publishedState(), command, options);

  assert.deepEqual(state.release_evaluation_input.finding_resolutions, []);
});

test('release evaluation rejects malformed finding resolutions', () => {
  const invalid = [
    [{ finding_item_id: 'finding-1', disposition: 'REVIEWED' }],
    [{ finding_item_id: 'finding-1', disposition: 'PUBLISHED_FACT' }],
    [{ finding_item_id: 'finding-1', disposition: 'REVIEWED_OMISSION' }],
    [{ disposition: 'REVIEWED_OMISSION', omission_reason: 'Not material.' }],
  ];

  for (const findingResolutions of invalid) {
    assert.throws(
      () => applyReviewCommand(publishedState(), evaluationCommand(findingResolutions), options),
      /FINDING_RESOLUTION/,
    );
  }
});
