'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

function resolved({ id, concept = 'TERMR-LEGAL', capacity = 'EITHER_PRINCIPAL_PARTY', definition = 'TERMINATION_RIGHT_GRANT' }) {
  return {
    section_reference: '8.1',
    resolved_claim_definition_key: definition,
    concept_key: concept,
    party: { role: 'TERMINATION_RIGHT_HOLDER', value: 'Parent and Company', capacity },
    provision_instance: {
      provision_instance_id: `provision-${id}`,
      party: { role: 'TERMINATION_RIGHT_HOLDER', value: 'Parent and Company', capacity },
    },
    claim: {
      claim_revision_id: `claim-${id}`,
      canonical_value: true,
      raw_value: `operative text ${id}`,
      attributes: { assertion_kind: 'RIGHT_GRANT', trigger_kind: 'LEGAL_RESTRAINT' },
      evidence: [{ excerpt_id: `excerpt-${id}`, absolute_start: 10, absolute_end: 20 }],
    },
  };
}

function resolution(resolvedItems, reviewQueue = []) {
  return {
    resolved: resolvedItems,
    open_world: [],
    review_queue: reviewQueue,
    resolution_receipt: { counts: { compiled_candidates: resolvedItems.length } },
  };
}

test('diagnosis proves that one canonical row hides later cards with the same code', async () => {
  const { diagnoseResolution } = await import('../scripts/audit/canonical-v2-termination-render-diagnosis.mjs');
  const report = await diagnoseResolution({
    resolution: resolution([resolved({ id: 'a' }), resolved({ id: 'b' })]),
    dealId: 'test-deal',
    runId: 'test-run',
  });

  assert.equal(report.counts.projected_governed_cards, 2);
  assert.equal(report.counts.rendered_governed_rows_with_content, 1);
  assert.equal(report.counts.resolved_claims_with_rendered_row_content, 1);
  assert.equal(report.counts.resolved_claims_without_rendered_row_content, 1);
  assert.equal(report.resolved_items.find((item) => !item.renders_with_content).no_row_reason, 'ROW_SELECTS_ONE_CARD_FOR_CODE');
});

test('diagnosis reports a projected no-shop breach card that has no Termination Rights row', async () => {
  const { diagnoseResolution } = await import('../scripts/audit/canonical-v2-termination-render-diagnosis.mjs');
  const report = await diagnoseResolution({
    resolution: resolution([
      resolved({ id: 'legal' }),
      resolved({ id: 'no-shop', concept: 'TERMR-NOSOL-BREACH', capacity: 'TARGET' }),
    ]),
    dealId: 'test-deal',
    runId: 'test-run',
  });

  assert.equal(report.projection_error, null);
  assert.deepEqual(report.projection_error_attribution, []);
  assert.equal(report.counts.projected_governed_cards, 2);
  assert.equal(report.counts.resolved_claims_with_rendered_row_content, 1);
  assert.equal(report.counts.resolved_claims_without_rendered_row_content, 1);
  assert.equal(
    report.resolved_items.find((item) => item.concept_key === 'TERMR-NOSOL-BREACH').no_row_reason,
    'NO_TERMINATION_RIGHT_ROW_FOR_CODE',
  );
});

test('review totals separate resolved overlap from unresolved work', async () => {
  const { reviewCounts } = await import('../scripts/audit/canonical-v2-termination-render-diagnosis.mjs');
  assert.deepEqual(reviewCounts([
    { has_resolution: true },
    { has_resolution: true },
    { has_resolution: false },
  ]), {
    total: 3,
    resolved_overlap: 2,
    unresolved: 1,
  });
});
