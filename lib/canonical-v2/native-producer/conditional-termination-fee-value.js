'use strict';

const { contentId } = require('../canonical-bytes');

const SCHEMA = 'CONDITIONAL_TERMINATION_FEE_VALUE/V1';
const SIDES = new Set(['SELLER', 'BUYER']);
const BRANCHES = new Set(['7.3(b)(i)', '7.3(b)(ii)', '7.3(b)(iii)', '7.3(b)(iv)', '7.3(b)(v)', '7.3(c)']);

function buildConditionalTerminationFeeValue(value) {
  const required = ['fee_side', 'triggering_branch', 'base_amount', 'currency', 'operator', 'reit_limit_cap_term_ref', 'defined_term_lineage', 'source_citations', 'raw_formula'];
  if (!value || required.some((key) => !(key in value)) || !SIDES.has(value.fee_side) || !BRANCHES.has(value.triggering_branch)
    || !/^\d+(?:\.\d+)?$/.test(value.base_amount) || value.currency !== 'USD' || value.operator !== 'LOWER_OF'
    || typeof value.reit_limit_cap_term_ref !== 'string' || !value.reit_limit_cap_term_ref
    || !Array.isArray(value.defined_term_lineage) || value.defined_term_lineage.length < 2
    || !Array.isArray(value.source_citations) || value.source_citations.length < 2
    || typeof value.raw_formula !== 'string' || !value.raw_formula) throw new TypeError('invalid conditional termination-fee value');
  const body = { schema_version: SCHEMA, ...value };
  return Object.freeze({ ...body, conditional_termination_fee_value_id: contentId(SCHEMA, body) });
}

module.exports = { SCHEMA, buildConditionalTerminationFeeValue };
