'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const legalSchema = require('../contracts/product/legal-schema.v1.json');
const { evaluateSupervisedRelease } = require('../lib/product/release-evaluation');

const sectionId = 'section-1';
const occurrenceId = 'occurrence-1';
const factId = 'fact-1';
const coverageId = 'coverage-1';
const coverageItemId = 'coverage-item-1';
const issueId = 'issue-1';
const issueItemId = 'issue-item-1';

function baseInput() {
  const subtype = legalSchema.families.find((item) => item.family_key === 'TERMINATION')
    .subtypes.find((item) => item.subtype_key === 'OUTSIDE_DATE');
  const roles = Object.fromEntries(subtype.required_roles.map((role) => [role, `${role}-value`]));
  const fact = {
    review_item_id: factId,
    structure_node_id: sectionId,
    family_key: 'TERMINATION',
    subtype_key: 'OUTSIDE_DATE',
    fact_type: 'OUTSIDE_DATE',
    roles,
    statement: 'The outside date is 1 January 2027.',
    canonical_value: '2027-01-01',
    proposition_group_id: 'group-1',
    source_span_ids: ['span-1'],
  };
  return {
    inventory: [{ inventory_item_id: 'inventory-1', severity: 'CRITICAL' }],
    reconciliation: [{
      inventory_item_id: 'inventory-1', disposition: 'PUBLISHED_FACT',
      review_item_id: factId, reviewed_by_role: 'LAWYER',
    }],
    analysis: {
      issues: [],
      sections: [{ structure_node_id: sectionId }],
      proposals: [{
        proposal_id: 'proposal-1', fact_occurrence_id: occurrenceId,
        family_key: 'TERMINATION', subtype_key: 'OUTSIDE_DATE',
      }],
      coverage_assertions: [
        { coverage_assertion_id: 'section-coverage', subject_kind: 'SECTION', subject_id: sectionId, structure_node_id: sectionId, state: 'FOUND' },
        ...subtype.required_roles.map((role) => ({
          coverage_assertion_id: `role-${role}`, subject_kind: 'ROLE',
          subject_id: `${occurrenceId}:${role}`, required_role: role, state: 'FOUND',
        })),
        {
          coverage_assertion_id: coverageId, subject_kind: 'FACT_TYPE',
          subject_id: `${sectionId}:TERMINATION:OUTSIDE_DATE`, structure_node_id: sectionId,
          family_key: 'TERMINATION', reason: 'FACT_TYPE:OUTSIDE_DATE', state: 'UNRESOLVED',
        },
      ],
    },
    reviewState: {
      items: [
        { item_id: factId, kind: 'PROPOSAL', decision: 'ACCEPTED', decided_by_role: 'LAWYER' },
        {
          item_id: coverageItemId, source_id: coverageId, kind: 'COVERAGE',
          decision: 'ACCEPTED', decided_by_role: 'LAWYER',
        },
      ],
      agreement_coverage: { decision: 'ACCEPTED', confirmed_by_role: 'LAWYER' },
      metrics: { review_time_seconds: 600 },
      summary: { families: [{ family_key: 'TERMINATION', facts: [fact] }] },
    },
    legalSchema,
    citationAssessments: [{
      review_item_id: factId, exact: true, legally_sufficient: true, narrow: true,
      reviewed_by_role: 'LAWYER',
    }],
    elapsedMinutes: 20,
    developerAssisted: false,
    processingStartedAt: '2026-09-05T12:00:00.000Z',
    processingCompletedAt: '2026-09-05T12:05:00.000Z',
  };
}

function publishedResolution(overrides = {}) {
  return {
    finding_item_id: coverageItemId,
    disposition: 'PUBLISHED_FACT',
    published_fact_review_item_id: factId,
    reviewed_by_role: 'LAWYER',
    ...overrides,
  };
}

test('Reviewed acknowledgement alone stays blocked; explicit fact or reasoned omission resolves UNRESOLVED coverage', () => {
  const input = baseInput();
  assert.equal(evaluateSupervisedRelease(input).bars.no_unresolved_presented_as_completion, false);
  const linked = evaluateSupervisedRelease({ ...input, findingResolutions: [publishedResolution()] });
  assert.equal(linked.bars.no_unresolved_presented_as_completion, true);
  assert.equal(linked.passed, true, JSON.stringify(linked.bars));
  const omitted = evaluateSupervisedRelease({
    ...input,
    findingResolutions: [{
      finding_item_id: coverageItemId,
      disposition: 'REVIEWED_OMISSION',
      omission_reason: 'The source review confirms that this fact type is not present.',
      reviewed_by_role: 'LAWYER',
    }],
  });
  assert.equal(omitted.bars.no_unresolved_presented_as_completion, true);
  const weakCitation = structuredClone(input);
  weakCitation.citationAssessments[0].narrow = false;
  assert.equal(evaluateSupervisedRelease({
    ...weakCitation, findingResolutions: [publishedResolution()],
  }).bars.citations_sufficient_and_narrow, false);
  const unreconciled = structuredClone(input);
  unreconciled.reconciliation[0].disposition = 'UNRESOLVED';
  assert.equal(evaluateSupervisedRelease({
    ...unreconciled, findingResolutions: [publishedResolution()],
  }).bars.inventory_reconciled, false);
});

test('finding resolutions reject identity, authority, scope and NOT_RUN violations', () => {
  const input = baseInput();
  for (const resolution of [
    publishedResolution({ finding_item_id: 'unknown' }),
    publishedResolution({ reviewed_by_role: 'AUTOMATION' }),
    publishedResolution({ published_fact_review_item_id: 'unknown' }),
    { finding_item_id: coverageItemId, disposition: 'REVIEWED_OMISSION', omission_reason: ' ', reviewed_by_role: 'LAWYER' },
  ]) {
    assert.throws(() => evaluateSupervisedRelease({ ...input, findingResolutions: [resolution] }), /FINDING_RESOLUTION/);
  }
  assert.throws(() => evaluateSupervisedRelease({
    ...input, findingResolutions: [publishedResolution(), publishedResolution()],
  }), /FINDING_RESOLUTION/);
  const notRun = structuredClone(input);
  notRun.analysis.coverage_assertions.at(-1).state = 'NOT_RUN';
  assert.throws(() => evaluateSupervisedRelease({
    ...notRun, findingResolutions: [publishedResolution()],
  }), /FINDING_RESOLUTION/);
  const incompatible = structuredClone(input);
  incompatible.reviewState.summary.families[0].facts[0].family_key = 'NO_SHOP';
  assert.throws(() => evaluateSupervisedRelease({
    ...incompatible, findingResolutions: [publishedResolution()],
  }), /FINDING_RESOLUTION/);
});

test('explicit resolution clears an original contradiction but never a live published-group conflict', () => {
  const input = baseInput();
  input.analysis.coverage_assertions.pop();
  input.reviewState.items.pop();
  input.analysis.issues = [{
    issue_id: issueId, code: 'CONTRADICTION_WITHIN_PROPOSITION_GROUP', state: 'OPEN',
    structure_node_id: sectionId, family_key: 'TERMINATION',
  }];
  input.reviewState.items.push({
    item_id: issueItemId, source_id: issueId, kind: 'ISSUE',
    decision: 'ACCEPTED', decided_by_role: 'LAWYER',
  });
  assert.equal(evaluateSupervisedRelease(input).bars.no_group_contradiction, false);
  const findingResolutions = [{
    finding_item_id: issueItemId,
    disposition: 'REVIEWED_OMISSION',
    omission_reason: 'The lawyer selected the supported proposition and rejected the conflicting extraction.',
    reviewed_by_role: 'LAWYER',
  }];
  assert.equal(evaluateSupervisedRelease({ ...input, findingResolutions }).bars.no_group_contradiction, true);
  const analysisResolved = structuredClone(input);
  analysisResolved.analysis.issues[0].state = 'RESOLVED';
  assert.equal(evaluateSupervisedRelease(analysisResolved).bars.no_group_contradiction, true);
  const conflict = structuredClone(input);
  const second = {
    ...conflict.reviewState.summary.families[0].facts[0],
    review_item_id: 'fact-2', statement: 'The outside date is 1 January 2028.', canonical_value: '2028-01-01',
  };
  conflict.reviewState.summary.families[0].facts.push(second);
  conflict.reviewState.items.push({ item_id: 'fact-2', kind: 'PROPOSAL', decision: 'ACCEPTED', decided_by_role: 'LAWYER' });
  conflict.citationAssessments.push({
    review_item_id: 'fact-2', exact: true, legally_sufficient: true, narrow: true, reviewed_by_role: 'LAWYER',
  });
  assert.equal(evaluateSupervisedRelease({ ...conflict, findingResolutions }).bars.no_group_contradiction, false);
});
