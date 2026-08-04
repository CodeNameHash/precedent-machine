'use strict';

const { contentId } = require('../canonical-bytes');

const SCHEMA = 'STRUCTURED_PER_SHARE_CASH_VALUE/V1';

function buildStructuredPerShareCashValue(value) {
  const required = [
    'consideration_term_ref',
    'operator',
    'base_amount',
    'currency',
    'variable_component',
    'defined_term_lineage',
    'operative_quote',
    'raw_formula',
  ];
  if (!value || required.some((key) => !(key in value))
    || typeof value.consideration_term_ref !== 'string' || !value.consideration_term_ref
    || value.operator !== 'BASE_PLUS_VARIABLE'
    || !/^\d+(?:\.\d+)?$/.test(value.base_amount)
    || value.currency !== 'USD'
    || typeof value.variable_component !== 'string' || !value.variable_component
    || !Array.isArray(value.defined_term_lineage) || value.defined_term_lineage.length < 2
    || typeof value.operative_quote !== 'string' || !value.operative_quote
    || typeof value.raw_formula !== 'string' || !value.raw_formula) {
    throw new TypeError('invalid structured per-share cash value');
  }
  const body = Object.freeze({ schema_version: SCHEMA, ...value });
  return Object.freeze({
    ...body,
    structured_per_share_cash_value_id: contentId(SCHEMA, body),
  });
}

module.exports = { SCHEMA, buildStructuredPerShareCashValue };
