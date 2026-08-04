'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { buildSecEdgarIntakeCapture } = require('../lib/canonical-v2/sec-edgar-intake-capture');
const { convertSecHtmlToCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text');
const { parseModivConditionalFees, resolveModivConditionalFees } = require('../lib/canonical-v2/native-producer/modiv-termination-fee-source-parser');

const rawBytes = fs.readFileSync(path.join(__dirname, 'fixtures', 'canonical-v2', 'mae-definition-family', 'modiv-raw-fetched.htm'));
const capture = buildSecEdgarIntakeCapture({
  retrieval_url: 'https://www.sec.gov/Archives/edgar/data/1/modiv.htm',
  final_url: 'https://www.sec.gov/Archives/edgar/data/1/modiv.htm',
  status_code: 200,
  content_type: 'text/html; charset=UTF-8',
  retrieved_at: '2026-08-03T00:00:00.000Z',
  retrieval_policy_digest: sha256Hex('modiv conditional fee parser test'),
  redirect_count: 0,
  response_bytes: rawBytes,
});
const text = convertSecHtmlToCanonicalText(capture).canonical_text;

function trigger(branch, feeSide) {
  return {
    ok: true,
    citation_validation: { accepted: true, derived_citation: branch },
    candidate: {
      kind: 'claim',
      claim: {
        claim_definition_key: 'NATIVE_TERMINATION_FEE_TRIGGER_CANDIDATE',
        attributes: { fee_side: feeSide },
      },
    },
  };
}

test('parses six exact Modiv lower-of fee branches with defined-term lineage', () => {
  const rows = parseModivConditionalFees(text);
  assert.equal(rows.length, 6);
  assert.deepEqual(rows.map((row) => row.base_amount), ['10000000', '10000000', '10000000', '15000000.00', '15000000.00', '15000000.00']);
  assert.ok(rows.every((row) => row.operator === 'LOWER_OF'));
  assert.deepEqual(rows[0].source_citations, ['7.3(b)(i)', '8.12(m)', '8.12(f)']);
  assert.match(rows[0].raw_formula, /lesser of/i);
  assert.match(rows[5].raw_formula, /REIT Requirements/);
});

test('requires every retained trigger branch and its supported side', () => {
  const candidates = [
    trigger('7.3(b)(i)', 'SELLER'), trigger('7.3(b)(ii)', 'SELLER'), trigger('7.3(b)(iii)', 'SELLER'),
    trigger('7.3(b)(iv)', 'SELLER'), trigger('7.3(b)(v)', 'SELLER'), trigger('7.3(c)', 'BUYER'),
  ];
  assert.equal(resolveModivConditionalFees({ source_text: text, fee_trigger_candidates: candidates }).length, 6);
  assert.throws(() => resolveModivConditionalFees({ source_text: text, fee_trigger_candidates: candidates.slice(1) }), /BRANCH_UNSUPPORTED/);
  assert.throws(() => resolveModivConditionalFees({ source_text: text, fee_trigger_candidates: [...candidates.slice(0, 5), trigger('7.3(c)', 'SELLER')] }), /SIDE_MISMATCH/);
});
