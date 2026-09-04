const test = require('node:test');
const assert = require('node:assert/strict');

const {
  TerminationRightsReviewRowsError,
  buildTerminationRightsReviewRows,
} = require('../lib/canonical-v2/termination-rights-review-rows');
const {
  assembleTerminationRightsReview,
} = require('../lib/canonical-v2/termination-rights-review-attachment');

function profile(profileId, profileKey, subtypeKey) {
  return {
    profile_id: profileId,
    profile_key: profileKey,
    family_key: 'TERMINATION',
    subtype_path: ['TERMINATION', 'TERMINATION_RIGHT', subtypeKey],
  };
}

function rule({
  ruleId,
  effectId,
  occurrenceId,
  profileId,
  outputDisposition,
  issueCodes = [],
}) {
  return {
    rule_id: ruleId,
    effect_id: effectId,
    input_occurrence_id: occurrenceId,
    profile_id: profileId,
    fact_ids: [`fact:${ruleId}`],
    validation: {
      extraction_state: outputDisposition === 'REVIEW_ONLY' ? 'INCOMPLETE' : 'COMPLETE',
      source_quality: 'SUFFICIENT',
      output_disposition: outputDisposition,
      issue_codes: issueCodes,
    },
  };
}

function scenario() {
  const occurrenceId = 'occurrence:1';
  const normalRule = rule({
    ruleId: 'rule:normal',
    effectId: 'effect:normal',
    occurrenceId,
    profileId: 'profile:outside',
    outputDisposition: 'NORMAL',
  });
  const reviewRule = rule({
    ruleId: 'rule:review',
    effectId: 'effect:breach',
    occurrenceId,
    profileId: 'profile:breach',
    outputDisposition: 'REVIEW_ONLY',
    issueCodes: ['UNPROVED_DEPENDENT_RULE'],
  });
  const issue = {
    effect_id: reviewRule.effect_id,
    rule_id: reviewRule.rule_id,
    issue_code: 'UNPROVED_DEPENDENT_RULE',
    extraction_state: 'INCOMPLETE',
    source_quality: 'SUFFICIENT',
    source_span_ids: ['span:breach'],
  };
  const disposition = {
    disposition_id: 'disposition:1',
    input_occurrence_id: occurrenceId,
    prior_family_key: 'TERMINATION',
    rule_ids: [normalRule.rule_id, reviewRule.rule_id],
    output_disposition: 'REVIEW_ONLY',
    issues: [issue],
  };
  return {
    analysis: {
      schema_version: 'AGREEMENT_ANALYSIS/V2',
      agreement_analysis_id: 'analysis:1',
      governed_input_occurrence_ids: [occurrenceId],
      profile_snapshots: [
        profile('profile:outside', 'PROFILE:TERMINATION:OUTSIDE_DATE_RIGHT', 'OUTSIDE_DATE_RIGHT'),
        profile('profile:breach', 'PROFILE:TERMINATION:BREACH_RIGHT', 'BREACH_RIGHT'),
      ],
      candidate_sets: [{
        effects: [
          {
            effect_id: normalRule.effect_id,
            input_occurrence_id: occurrenceId,
            source_span_ids: ['span:outside'],
          },
          {
            effect_id: reviewRule.effect_id,
            input_occurrence_id: occurrenceId,
            source_span_ids: ['span:breach'],
          },
        ],
      }],
      rules: [normalRule, reviewRule],
      dispositions: [disposition],
    },
    projection: {
      schema_version: 'AGREEMENT_PROJECTION/V2',
      agreement_projection_id: 'projection:1',
      agreement_analysis_id: 'analysis:1',
      rows: [{
        row_id: 'projection-row:normal',
        rule_id: normalRule.rule_id,
        disposition_id: disposition.disposition_id,
        output_disposition: 'NORMAL',
      }],
      review_rows: [{
        disposition_id: disposition.disposition_id,
        input_occurrence_id: occurrenceId,
        rule_ids: disposition.rule_ids,
        issues: [issue],
      }],
    },
  };
}

test('Termination review rows flag only the failed dependent proposition in place', () => {
  const input = scenario();

  const result = buildTerminationRightsReviewRows(input);

  assert.equal(result.schema_version, 'TERMINATION_RIGHTS_REVIEW_ROWS/V1');
  assert.deepEqual(result.rows.map((row) => ({
    rule_id: row.rule_id,
    subtype_key: row.subtype_key,
    output_disposition: row.output_disposition,
    review_required: row.review_required,
    issue_codes: row.issue_codes,
  })), [
    {
      rule_id: 'rule:normal',
      subtype_key: 'OUTSIDE_DATE_RIGHT',
      output_disposition: 'NORMAL',
      review_required: false,
      issue_codes: [],
    },
    {
      rule_id: 'rule:review',
      subtype_key: 'BREACH_RIGHT',
      output_disposition: 'REVIEW_ONLY',
      review_required: true,
      issue_codes: ['UNPROVED_DEPENDENT_RULE'],
    },
  ]);
  assert.deepEqual(result.rows[1].source_span_ids, ['span:breach']);
  assert.equal(result.rows[1].display_section_id, 'termination-rights');
});

test('Termination review rows reject an issue joined to the wrong effect', () => {
  const input = scenario();
  input.projection.review_rows[0].issues[0].effect_id = 'effect:normal';

  assert.throws(
    () => buildTerminationRightsReviewRows(input),
    (error) => error instanceof TerminationRightsReviewRowsError
      && error.code === 'REVIEW_JOIN_DRIFT',
  );
});

test('Termination review rows accept only the two-record public interface', () => {
  const input = scenario();

  assert.throws(
    () => buildTerminationRightsReviewRows({ ...input, review_required: true }),
    (error) => error instanceof TerminationRightsReviewRowsError
      && error.code === 'INVALID_REVIEW_INPUT',
  );
});

test('Termination review rows retain a failed effect with no rule in the general review lane', () => {
  const input = scenario();
  const issue = {
    effect_id: 'effect:unassigned',
    rule_id: null,
    issue_code: 'NO_COMPATIBLE_PROFILE',
    extraction_state: 'INCOMPLETE',
    source_quality: 'SUFFICIENT',
    source_span_ids: ['span:unassigned'],
  };
  input.analysis.candidate_sets[0].effects.push({
    effect_id: issue.effect_id,
    input_occurrence_id: 'occurrence:1',
    source_span_ids: issue.source_span_ids,
  });
  input.analysis.dispositions[0].issues.push(issue);
  input.projection.review_rows[0].issues.push(issue);

  const result = buildTerminationRightsReviewRows(input);

  assert.deepEqual(result.general_review_items, [{
    display_section_id: 'termination-rights',
    governed_ordinal: 0,
    input_occurrence_id: 'occurrence:1',
    disposition_id: 'disposition:1',
    effect_id: 'effect:unassigned',
    rule_id: null,
    output_disposition: 'REVIEW_ONLY',
    review_required: true,
    extraction_state: 'INCOMPLETE',
    source_quality: 'SUFFICIENT',
    issue_code: 'NO_COMPATIBLE_PROFILE',
    source_span_ids: ['span:unassigned'],
  }]);
});

test('Termination review rows reject a Termination profile without a stable profile key', () => {
  const input = scenario();
  delete input.analysis.profile_snapshots[1].profile_key;

  assert.throws(
    () => buildTerminationRightsReviewRows(input),
    (error) => error instanceof TerminationRightsReviewRowsError
      && error.code === 'REVIEW_JOIN_DRIFT',
  );
});

test('Termination review rows require both canonical record identities', () => {
  const input = scenario();
  delete input.analysis.agreement_analysis_id;
  delete input.projection.agreement_analysis_id;
  delete input.projection.agreement_projection_id;

  assert.throws(
    () => buildTerminationRightsReviewRows(input),
    (error) => error instanceof TerminationRightsReviewRowsError
      && error.code === 'INVALID_REVIEW_INPUT',
  );
});

test('Termination review rows reject projection issue drift from canonical Analysis', () => {
  const input = scenario();
  input.projection.review_rows[0].issues = [{
    ...input.projection.review_rows[0].issues[0],
    source_span_ids: ['span:invented'],
  }];

  assert.throws(
    () => buildTerminationRightsReviewRows(input),
    (error) => error instanceof TerminationRightsReviewRowsError
      && error.code === 'REVIEW_JOIN_DRIFT',
  );
});

test('Termination review rows reject a normal projection row without its canonical row ID', () => {
  const input = scenario();
  delete input.projection.rows[0].row_id;

  assert.throws(
    () => buildTerminationRightsReviewRows(input),
    (error) => error instanceof TerminationRightsReviewRowsError
      && error.code === 'REVIEW_JOIN_DRIFT',
  );
});

test('Termination review rows use governed source order and return frozen derived data', () => {
  const input = scenario();
  const before = structuredClone(input);
  input.analysis.rules.reverse();

  const result = buildTerminationRightsReviewRows(input);

  assert.deepEqual(result.rows.map((row) => row.rule_id), ['rule:normal', 'rule:review']);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.rows), true);
  assert.equal(Object.isFrozen(result.rows[0]), true);
  assert.deepEqual({
    ...input,
    analysis: { ...input.analysis, rules: [...input.analysis.rules].reverse() },
  }, before);
});

test('Termination review assembly remains read-only from canonical records to display payload', () => {
  const records = scenario();
  const reviewDeal = { dealId: 'deal:1', cardCount: 0, cards: [] };
  const before = structuredClone({ records, reviewDeal });

  const assembled = assembleTerminationRightsReview({ reviewDeal, ...records });

  assert.equal(
    assembled.canonical_v2_termination_rights_review_rows.schema_version,
    'TERMINATION_RIGHTS_REVIEW_ROWS/V1',
  );
  assert.deepEqual({ records, reviewDeal }, before);
  assert.equal(Object.isFrozen(assembled), true);
  assert.equal(
    Object.isFrozen(assembled.canonical_v2_termination_rights_review_rows),
    true,
  );
});

test('Termination review rows verify a matched rule issue without relying on prior family', () => {
  const input = scenario();
  input.analysis.dispositions[0].prior_family_key = null;
  input.projection.review_rows[0].issues = [{
    ...input.projection.review_rows[0].issues[0],
    source_span_ids: ['span:invented'],
  }];

  assert.throws(
    () => buildTerminationRightsReviewRows(input),
    (error) => error instanceof TerminationRightsReviewRowsError
      && error.code === 'REVIEW_JOIN_DRIFT',
  );
});
