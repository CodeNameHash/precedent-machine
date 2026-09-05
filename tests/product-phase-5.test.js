'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const freeze = require('./fixtures/product/phase-5-preblind-freeze.v1.json');
const finalFreeze = require('./fixtures/product/phase-5-final-candidate-freeze.v1.json');
const legalSchema = require('../contracts/product/legal-schema.v1.json');
const { evaluateSupervisedRelease } = require('../lib/product/release-evaluation');

const FROZEN_RELEASE_BARS = [
  "The lawyer's independent critical and material inventory is fully reconciled into published facts or explicit reviewed omissions.",
  'Every published fact has an exact and legally sufficient citation.',
  'Every substantive section and required role has a coverage state, every exception is reviewed, and the lawyer gives one agreement-level coverage confirmation.',
  'No contradiction remains inside a published proposition group.',
  'No NOT_RUN or UNRESOLVED item is presented as absence or completion.',
  'Every final published fact is lawyer accepted.',
  'A standard agreement can be processed and reviewed in no more than 90 minutes without a developer.',
];
const FROZEN_ISSUE_KINDS = [
  'CRITICAL_OR_MATERIAL_FACT_OMITTED',
  'PUBLISHED_FACT_CITATION_MISSING_OR_LEGALLY_INSUFFICIENT',
  'CITATION_SCOPE_TOO_BROAD',
  'DUPLICATE_FACT',
  'CONTRADICTION_WITHIN_PROPOSITION_GROUP',
  'NOT_RUN_OR_UNRESOLVED_PRESENTED_AS_ABSENCE_OR_COMPLETION',
  'REQUIRED_ROLE_WITHOUT_DISPOSITION',
  'EXCEPTION_NOT_REVIEWED',
  'AGREEMENT_COVERAGE_NOT_CONFIRMED',
  'FINAL_FACT_NOT_LAWYER_ACCEPTED',
  'REVIEW_EXCEEDS_NINETY_MINUTES_OR_REQUIRES_DEVELOPER',
];
const FINAL_CANDIDATE_FILES = [
  'contracts/product/legal-schema.v1.json',
  'lib/canonical-v2/native-producer/deterministic-sectionizer.js',
  'lib/parser-v2/structural.js',
  'lib/product/agreement-draft.js',
  'lib/product/agreement-structure.js',
  'lib/product/source-context.js',
  'lib/product/section-reference-display.js',
  'lib/product/review-state.js',
  'lib/product/review-handler.js',
  'components/product/ReviewWorkspace.jsx',
  'supabase/migrations/20260905020346_product_phase_1_foundation.sql',
  'supabase/migrations/20260905043000_product_phase_2_vertical_slice.sql',
  'supabase/migrations/20260905070000_product_phase_3_review.sql',
  'supabase/migrations/20260905190000_product_substantive_section_work.sql',
  'lib/product/provider-recording-adapter.js',
  'lib/product/anthropic-model.js',
  'lib/product/release-evaluation.js',
  'lib/product/sec-intake.js',
];

function fileHash(relativePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, relativePath))).digest('hex');
}

function promptBundleHash(paths) {
  const payload = [...paths].sort().map((relativePath) => `${relativePath}\u001f${fileHash(relativePath)}`).join('\n');
  return crypto.createHash('sha256').update(payload).digest('hex');
}

test('pre-blind schema, prompt bundle, release bars and lawyer issue list remain frozen evidence', () => {
  assert.equal(fileHash(freeze.legal_schema.path), freeze.legal_schema.sha256);
  assert.equal(promptBundleHash(freeze.prompt_bundle.paths), freeze.prompt_bundle.sha256);
  for (const [relativePath, sha256] of Object.entries(freeze.candidate_files)) {
    assert.equal(typeof relativePath, 'string');
    assert.match(sha256, /^[0-9a-f]{64}$/);
  }
  assert.deepEqual(freeze.release_bars, FROZEN_RELEASE_BARS);
  assert.deepEqual(freeze.expected_lawyer_issue_kinds, FROZEN_ISSUE_KINDS);
});

test('corrected final candidate is frozen before a new untouched agreement is selected', () => {
  assert.equal(finalFreeze.based_on, 'tests/fixtures/product/phase-5-preblind-freeze.v1.json');
  assert.equal(finalFreeze.blind_driven_shared_corrections.length, 22);
  assert.deepEqual(finalFreeze.production_model_configuration, {
    provider_id: 'ANTHROPIC',
    model_id: 'claude-sonnet-4-5-20250929',
    temperature: 0,
    routing_max_tokens: 1200,
    extraction_max_tokens: 12000,
  });
  assert.deepEqual(Object.keys(finalFreeze.candidate_files).sort(), [...FINAL_CANDIDATE_FILES].sort());
  for (const [relativePath, sha256] of Object.entries(finalFreeze.candidate_files)) assert.equal(fileHash(relativePath), sha256, relativePath);
  assert.equal(fileHash(freeze.legal_schema.path), freeze.legal_schema.sha256);
  assert.equal(promptBundleHash(freeze.prompt_bundle.paths), freeze.prompt_bundle.sha256);
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
      summary: { families: [{ family_key: 'TERMINATION', facts: [{ review_item_id: 'fact-1', family_key: 'TERMINATION', subtype_key: 'OUTSIDE_DATE', fact_type: 'OUTSIDE_DATE', roles, source_span_ids: ['span-1'] }] }] },
    },
    legalSchema,
    citationAssessments: [{ review_item_id: 'fact-1', exact: true, legally_sufficient: true, narrow: true, reviewed_by_role: 'LAWYER' }],
    elapsedMinutes: 30,
    developerAssisted: false,
  };
  const passingBaseline = evaluateSupervisedRelease(base);
  assert.equal(passingBaseline.passed, true, JSON.stringify(passingBaseline.bars));
  assert.equal(evaluateSupervisedRelease({ ...base, elapsedMinutes: -0.1 }).bars.review_within_ninety_minutes_without_developer, false);
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
