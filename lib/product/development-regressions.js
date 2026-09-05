'use strict';

const ERROR_CLASSES = Object.freeze([
  'NO_RUN', 'WRONG_MEANING', 'MISSING_ROLE', 'PARSER', 'DUPLICATE', 'DISPLAY', 'CONTROL',
]);
const ASSERTION_KINDS = Object.freeze([
  'PROPOSAL_REQUIRED', 'ATOMIC_OUTCOME', 'REQUIRED_ROLES', 'PARSER_OUTCOME',
  'NO_DUPLICATE_FACT', 'DISPLAY_EXCLUSION', 'ATOMIC_FACT_SET', 'NO_COMPARISON_OUTPUT',
]);

function validateDevelopmentRegressions(fixture) {
  if (!fixture || fixture.schema_version !== 'DEVELOPMENT_REGRESSIONS/V1'
    || JSON.stringify(fixture.supported_error_classes) !== JSON.stringify(ERROR_CLASSES)
    || !Array.isArray(fixture.cases) || fixture.cases.length !== 50) {
    throw new Error('DEVELOPMENT_REGRESSION_CONTRACT');
  }
  const ids = new Set();
  for (const item of fixture.cases) {
    if (ids.has(item.case_id) || !ERROR_CLASSES.includes(item.error_class)
      || !ASSERTION_KINDS.includes(item.assertion?.kind)
      || !Array.isArray(item.source?.spans) || item.source.spans.length === 0) {
      throw new Error(`DEVELOPMENT_REGRESSION_CASE: ${item?.ordinal}`);
    }
    ids.add(item.case_id);
  }
  return fixture;
}

module.exports = { ASSERTION_KINDS, ERROR_CLASSES, validateDevelopmentRegressions };
