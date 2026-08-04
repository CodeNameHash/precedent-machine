'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const { buildConditionalTerminationFeeValue } = require('../lib/canonical-v2/native-producer/conditional-termination-fee-value');
const value = { fee_side:'SELLER', triggering_branch:'7.3(b)(i)', base_amount:'10000000', currency:'USD', operator:'LOWER_OF', reit_limit_cap_term_ref:'maximum amount', defined_term_lineage:['Company Termination Fee','Company Base Amount'], source_citations:['7.3(b)(i)','8.12(f)','8.12(m)'], raw_formula:'the lesser of (i) the Company Base Amount and (ii) the maximum amount' };
test('seals an inactive lower-of fee formula without a flattened amount', () => { const x=buildConditionalTerminationFeeValue(value); assert.equal(x.operator,'LOWER_OF'); assert.equal(x.base_amount,'10000000'); assert.ok(x.conditional_termination_fee_value_id); });
test('fails closed for a missing branch or cap lineage', () => { assert.throws(()=>buildConditionalTerminationFeeValue({...value,triggering_branch:'7.3(z)'})); assert.throws(()=>buildConditionalTerminationFeeValue({...value,defined_term_lineage:['Company Termination Fee']})); });
