'use strict';
const assert = require('assert'); const { shapeTaxDividendAppraisalProposals } = require('../lib/canonical-v2/native-producer/anthropic-provider');
const quote = 'the parties shall coordinate the record and payment dates for their regular quarterly dividends.';
const output = shapeTaxDividendAppraisalProposals({ mechanics: [{ surface: 'DIVIDEND_COORDINATION', quote, detail: 'quarterly record-date coordination' }], open_world_candidates: [] }, quote);
assert.strictEqual(output.proposals.length, 1); assert.strictEqual(output.proposals[0].claim_definition_key, 'OPEN_WORLD_PROPOSITION'); assert.strictEqual(output.proposals[0].canonical_value, null); console.log('canonical-v2 tax dividend appraisal follow-on tests passed');
