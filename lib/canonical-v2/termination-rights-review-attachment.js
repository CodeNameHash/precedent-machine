'use strict';

const {
  buildTerminationRightsReviewRows,
  buildTerminationRightsReviewRowsV2,
} = require('./termination-rights-review-rows');

const FIELD = 'canonical_v2_termination_rights_review_rows';
const REVIEW_KEYS = [
  'schema_version',
  'agreement_analysis_id',
  'agreement_projection_id',
  'rows',
  'general_review_items',
];

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value, keys) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index]);
}

function attachTerminationRightsReviewRows(input) {
  if (!isObject(input) || !exactKeys(input, ['reviewDeal', 'reviewRows'])) {
    throw new TypeError('Termination Rights review attachment requires exact inputs.');
  }
  const { reviewDeal, reviewRows } = input;
  if (!isObject(reviewDeal)
      || Object.prototype.hasOwnProperty.call(reviewDeal, FIELD)
      || !isObject(reviewRows)
      || !exactKeys(reviewRows, REVIEW_KEYS)
      || !['TERMINATION_RIGHTS_REVIEW_ROWS/V1', 'TERMINATION_RIGHTS_REVIEW_ROWS/V2']
        .includes(reviewRows.schema_version)
      || typeof reviewRows.agreement_analysis_id !== 'string'
      || !reviewRows.agreement_analysis_id
      || typeof reviewRows.agreement_projection_id !== 'string'
      || !reviewRows.agreement_projection_id
      || !Array.isArray(reviewRows.rows)
      || !Array.isArray(reviewRows.general_review_items)) {
    throw new TypeError('Termination Rights review attachment is invalid.');
  }
  return Object.freeze({ ...reviewDeal, [FIELD]: reviewRows });
}

function assembleTerminationRightsReview(input) {
  if (!isObject(input) || !exactKeys(input, ['reviewDeal', 'analysis', 'projection'])) {
    throw new TypeError('Termination Rights review assembly requires exact inputs.');
  }
  const reviewRows = buildTerminationRightsReviewRows({
    analysis: input.analysis,
    projection: input.projection,
  });
  return attachTerminationRightsReviewRows({ reviewDeal: input.reviewDeal, reviewRows });
}

function assembleTerminationRightsReviewV2(input) {
  if (!isObject(input) || !exactKeys(input, [
    'reviewDeal',
    'analysis',
    'projection',
    'agreement_indexes',
    'review_state',
  ])) {
    throw new TypeError('Rich Termination Rights review assembly requires exact inputs.');
  }
  const reviewRows = buildTerminationRightsReviewRowsV2({
    analysis: input.analysis,
    projection: input.projection,
    agreement_indexes: input.agreement_indexes,
    review_state: input.review_state,
  });
  return attachTerminationRightsReviewRows({ reviewDeal: input.reviewDeal, reviewRows });
}

module.exports = {
  assembleTerminationRightsReview,
  assembleTerminationRightsReviewV2,
};
