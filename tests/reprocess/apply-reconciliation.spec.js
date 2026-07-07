const test = require('node:test');
const assert = require('node:assert/strict');

const { applyReconciliation, classifyDeferred, summary } = require('../../scripts/reprocess/apply-reconciliation');

test('WP-M2-01 applies MERGE entries and tags SPLIT target triples', () => {
  const queue = {
    entries: [
      {
        id: 'merge-1',
        deal_id: 'deal-1',
        field_key: 'consentStandard',
        raw_value: 'OLD',
        source_provision_id: 'prov-1',
        resolution: { action: 'MERGE', targetCanonicalKey: 'new-key', resolved_at: '2026-07-07T00:00:00.000Z' },
      },
      {
        id: 'split-1',
        deal_id: 'deal-1',
        field_key: 'undisclosedLiabilitiesExceptions',
        raw_value: 'OTHER',
        source_provision_id: 'prov-2',
        resolution: { action: 'SPLIT', targetCanonicalKey: 'FINANCIAL_STATEMENTS,TRANSACTION_EXPENSES', resolved_at: '2026-07-07T00:00:00.000Z' },
      },
    ],
  };
  const normalized = {
    triples: [
      { deal_id: 'deal-1', field_key: 'consentStandard', raw_value: 'OLD', canonicalKey: null, source_provision_id: 'prov-1', ai_metadata: {} },
      { deal_id: 'deal-1', field_key: 'undisclosedLiabilitiesExceptions', raw_value: 'FINANCIAL_STATEMENTS', canonicalKey: 'FINANCIAL_STATEMENTS', source_provision_id: 'prov-2', ai_metadata: {} },
      { deal_id: 'deal-1', field_key: 'undisclosedLiabilitiesExceptions', raw_value: 'TRANSACTION_EXPENSES', canonicalKey: 'TRANSACTION_EXPENSES', source_provision_id: 'prov-2', ai_metadata: {} },
    ],
  };

  const result = applyReconciliation(queue, normalized);
  assert.equal(result.normalized.triples[0].canonicalKey, 'new-key');
  assert.equal(result.normalized.triples[1].ai_metadata.reconciliation.origin, 'split');
  assert.equal(result.normalized.triples[2].ai_metadata.reconciliation.origin, 'split');
  assert.deepEqual(summary(result.outcomes).routeCounts, { reextracted: 2 });
});

test('WP-M2-01 routes deferred compensation items to structured object waitlist', () => {
  const classification = classifyDeferred({
    field_key: 'compensationItems',
    resolution: { rationale: 'compensationItems is structured item text, not an enum' },
  });
  assert.equal(classification.waiting_on, 'employment_compensation_structured_object');
  assert.match(classification.reason, /comparison group/);
});
