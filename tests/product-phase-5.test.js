'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');

const legalSchema = require('../contracts/product/legal-schema.v1.json');
const { evaluateSupervisedRelease } = require('../lib/product/release-evaluation');
const {
  DIAGNOSTIC_SOURCE_DOCUMENT_ID, assertDatabaseTarget, assertDiagnosticRunTarget,
} = require('../scripts/product-phase-5-local-run');

test('local diagnostic runner is bound to the disposable host and exact diagnostic source', () => {
  assert.doesNotThrow(() => assertDatabaseTarget('https://ecrtoofsyxozazkvsvcl.supabase.co'));
  assert.throws(() => assertDatabaseTarget('https://production.supabase.co'), /PRODUCT_PHASE5_DATABASE_TARGET/);
  const runId = crypto.randomUUID();
  assert.doesNotThrow(() => assertDiagnosticRunTarget(runId, {
    run_id: runId, source_document_id: DIAGNOSTIC_SOURCE_DOCUMENT_ID,
  }));
  assert.throws(() => assertDiagnosticRunTarget(runId, {
    run_id: runId, source_document_id: 'f'.repeat(64),
  }), /PRODUCT_PHASE5_RUN_TARGET/);
  assert.throws(() => assertDiagnosticRunTarget(runId, null), /PRODUCT_PHASE5_RUN_TARGET/);
});

test('supervised release evaluation counts omissions and unresolved work against weighted recall and review burden', () => {
  const facts = [{ review_item_id: 'review-fact-1', family_key: 'TERMINATION', subtype_key: 'OUTSIDE_DATE', fact_type: 'OUTSIDE_DATE', roles: { terminating_party: 'Company', action: 'terminate', outside_date: '2027-01-01', transaction_not_completed_condition: 'Merger not completed', breach_bar: 'No causative breach' }, source_span_ids: ['span-1'] }];
  const reviewState = {
    items: [
      { item_id: 'review-fact-1', kind: 'PROPOSAL', decision: 'ACCEPTED', decided_by_role: 'LAWYER' },
      { item_id: 'exception-1', kind: 'EXCEPTION_LINK', decision: 'ACCEPTED' },
      { item_id: 'coverage-1', kind: 'COVERAGE', decision: 'UNRESOLVED' },
    ],
    agreement_coverage: { decision: 'ACCEPTED', confirmed_by_role: 'LAWYER' },
    metrics: { review_time_seconds: 600 },
    summary: { families: [{ family_key: 'TERMINATION', facts }] },
  };
  const result = evaluateSupervisedRelease({
    inventory: [
      { inventory_item_id: 'critical-1', severity: 'CRITICAL' },
      { inventory_item_id: 'material-1', severity: 'MATERIAL' },
    ],
    reconciliation: [
      { inventory_item_id: 'critical-1', disposition: 'PUBLISHED_FACT', review_item_id: 'review-fact-1', reviewed_by_role: 'LAWYER' },
      { inventory_item_id: 'material-1', disposition: 'REVIEWED_OMISSION', omission_reason: 'Not a material fact after source review.', reviewed_by_role: 'LAWYER' },
    ],
    analysis: {
      issues: [],
      coverage_assertions: [
        { subject_kind: 'SECTION', state: 'FOUND' },
        { subject_kind: 'ROLE', state: 'FOUND' },
        { subject_kind: 'FACT_TYPE', state: 'UNRESOLVED' },
      ],
    },
    reviewState,
    legalSchema,
    citationAssessments: [{ review_item_id: 'review-fact-1', exact: true, legally_sufficient: true, narrow: true, reviewed_by_role: 'LAWYER' }],
    elapsedMinutes: 91,
    developerAssisted: true,
  });
  assert.equal(result.diagnostics.severity_weighted_recall, 0.75);
  assert.equal(result.diagnostics.severity_weighted_precision, 1);
  assert.equal(result.diagnostics.unresolved_weight, 1);
  assert.equal(result.diagnostics.unresolved_count, 2);
  assert.equal(result.bars.inventory_reconciled, true);
  assert.equal(result.bars.no_unresolved_presented_as_completion, false);
  assert.equal(result.bars.review_within_ninety_minutes_without_developer, false);
  assert.equal(result.passed, false);
});

test('release evaluation rejects vacuous or non-lawyer evidence and duplicate or unknown citation assessments', () => {
  const roles = { terminating_party: 'Company', action: 'terminate', outside_date: '2027-01-01', transaction_not_completed_condition: 'Merger not completed', breach_bar: 'No causative breach' };
  const roleCoverage = ['terminating_party', 'action', 'outside_date', 'transaction_not_completed_condition']
    .map((role) => ({ subject_kind: 'ROLE', subject_id: `occurrence-1:${role}`, required_role: role, state: 'FOUND' }));
  const base = {
    inventory: [{ inventory_item_id: 'critical-1', severity: 'CRITICAL' }],
    reconciliation: [{ inventory_item_id: 'critical-1', disposition: 'PUBLISHED_FACT', review_item_id: 'fact-1', reviewed_by_role: 'LAWYER' }],
    analysis: {
      issues: [],
      sections: [{ structure_node_id: 'section-1' }],
      proposals: [{ proposal_id: 'proposal-1', fact_occurrence_id: 'occurrence-1', family_key: 'TERMINATION', subtype_key: 'OUTSIDE_DATE' }],
      coverage_assertions: [{ subject_kind: 'SECTION', subject_id: 'section-1', structure_node_id: 'section-1', state: 'FOUND' }, ...roleCoverage],
    },
    reviewState: {
      items: [{ item_id: 'fact-1', kind: 'PROPOSAL', decision: 'ACCEPTED', decided_by_role: 'LAWYER' }],
      agreement_coverage: { decision: 'ACCEPTED', confirmed_by_role: 'LAWYER' },
      metrics: { review_time_seconds: 1800 },
      summary: { families: [{ family_key: 'TERMINATION', facts: [{ review_item_id: 'fact-1', family_key: 'TERMINATION', subtype_key: 'OUTSIDE_DATE', fact_type: 'OUTSIDE_DATE', roles, source_span_ids: ['span-1'] }] }] },
    },
    legalSchema,
    citationAssessments: [{ review_item_id: 'fact-1', exact: true, legally_sufficient: true, narrow: true, reviewed_by_role: 'LAWYER' }],
    elapsedMinutes: 30,
    developerAssisted: false,
    processingStartedAt: '2026-01-01T00:00:00.000Z',
    processingCompletedAt: '2026-01-01T00:10:00.000Z',
  };
  const passingBaseline = evaluateSupervisedRelease(base);
  assert.equal(passingBaseline.passed, true, JSON.stringify(passingBaseline.bars));
  const broadButSufficient = evaluateSupervisedRelease({
    ...base,
    citationAssessments: [{ ...base.citationAssessments[0], narrow: false }],
  });
  assert.equal(broadButSufficient.passed, true);
  assert.equal(broadButSufficient.bars.citations_exact_and_legally_sufficient, true);
  assert.equal(broadButSufficient.diagnostics.citation_narrowness_rate, 0);
  for (const requiredAssessment of ['exact', 'legally_sufficient']) {
    for (const value of [false, undefined]) {
      const insufficient = evaluateSupervisedRelease({
        ...base,
        citationAssessments: [{ ...base.citationAssessments[0], [requiredAssessment]: value }],
      });
      assert.equal(insufficient.passed, false);
      assert.equal(insufficient.bars.citations_exact_and_legally_sufficient, false);
    }
  }
  assert.equal(evaluateSupervisedRelease({
    ...base,
    reviewState: {
      ...base.reviewState,
      items: [{ ...base.reviewState.items[0], decision: 'REJECTED' }],
    },
  }).bars.all_final_facts_lawyer_accepted, false);
  assert.equal(evaluateSupervisedRelease({ ...base, elapsedMinutes: -0.1 }).bars.review_within_ninety_minutes_without_developer, false);
  assert.equal(evaluateSupervisedRelease({ ...base, reviewState: { ...base.reviewState, metrics: { review_time_seconds: 5401 } } }).bars.review_within_ninety_minutes_without_developer, false);
  assert.equal(evaluateSupervisedRelease({ ...base, reviewState: { ...base.reviewState, metrics: null } }).bars.review_within_ninety_minutes_without_developer, false);
  assert.equal(evaluateSupervisedRelease({ ...base, inventory: [], reconciliation: [] }).passed, false);
  assert.equal(evaluateSupervisedRelease({ ...base, reviewState: { ...base.reviewState, summary: { families: [] } }, reconciliation: [{ ...base.reconciliation[0], disposition: 'REVIEWED_OMISSION', review_item_id: undefined, omission_reason: 'Not material after source review.' }], citationAssessments: [] }).passed, false);
  assert.throws(() => evaluateSupervisedRelease({ ...base, citationAssessments: [{ ...base.citationAssessments[0], reviewed_by_role: 'AUTOMATION' }] }), /CITATION_ASSESSMENT/);
  assert.throws(() => evaluateSupervisedRelease({ ...base, citationAssessments: [...base.citationAssessments, base.citationAssessments[0]] }), /CITATION_ASSESSMENT/);
  assert.throws(() => evaluateSupervisedRelease({ ...base, citationAssessments: [{ ...base.citationAssessments[0], review_item_id: 'unknown' }] }), /CITATION_ASSESSMENT/);
  assert.throws(() => evaluateSupervisedRelease({ ...base, reconciliation: [{ ...base.reconciliation[0], review_item_id: 'unknown' }] }), /RECONCILIATION_FACT/);
  assert.throws(() => evaluateSupervisedRelease({ ...base, reconciliation: [{ ...base.reconciliation[0], disposition: 'REVIEWED_OMISSION', review_item_id: undefined }] }), /RECONCILIATION_ITEM/);
  const missingRole = structuredClone(base);
  delete missingRole.reviewState.summary.families[0].facts[0].roles.transaction_not_completed_condition;
  assert.equal(evaluateSupervisedRelease(missingRole).bars.section_role_exception_and_agreement_coverage_complete, false);
  const missingSection = structuredClone(base);
  missingSection.analysis.coverage_assertions = missingSection.analysis.coverage_assertions.filter((item) => item.subject_kind !== 'SECTION');
  assert.equal(evaluateSupervisedRelease(missingSection).bars.section_role_exception_and_agreement_coverage_complete, false);
  const missingRoleCoverage = structuredClone(base);
  missingRoleCoverage.analysis.coverage_assertions = missingRoleCoverage.analysis.coverage_assertions.filter((item) => item.subject_id !== 'occurrence-1:action');
  assert.equal(evaluateSupervisedRelease(missingRoleCoverage).bars.section_role_exception_and_agreement_coverage_complete, false);
  const notRun = structuredClone(base);
  notRun.analysis.coverage_assertions[0].state = 'NOT_RUN';
  assert.equal(evaluateSupervisedRelease(notRun).bars.no_unresolved_presented_as_completion, false);
  const conflicting = structuredClone(base);
  const conflictFacts = conflicting.reviewState.summary.families[0].facts;
  conflictFacts[0].proposition_group_id = 'group-1';
  conflictFacts.push({ ...structuredClone(conflictFacts[0]), review_item_id: 'fact-2', statement: 'Outside date is 2028-01-01.', canonical_value: '2028-01-01' });
  conflicting.reviewState.items.push({ item_id: 'fact-2', kind: 'PROPOSAL', decision: 'ACCEPTED', decided_by_role: 'LAWYER' });
  conflicting.citationAssessments.push({ review_item_id: 'fact-2', exact: true, legally_sufficient: true, narrow: true, reviewed_by_role: 'LAWYER' });
  assert.equal(evaluateSupervisedRelease(conflicting).bars.no_group_contradiction, false);
});
