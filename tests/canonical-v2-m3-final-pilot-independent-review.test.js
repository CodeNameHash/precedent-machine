'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  FINAL_RE_REVIEW_FINDINGS_SCHEMA,
  FINAL_RE_REVIEW_RUBRIC,
  STRICT_INDEPENDENT_REVIEW_SCHEMA,
  FinalPilotIndependentReviewError,
  buildFinalPilotStrictIndependentReviewInput,
  validateFinalPilotReReviewFindings,
} = require('../lib/canonical-v2/native-producer/m3-final-pilot-independent-review');

const PACKET_PATH = '/private/tmp/canonical-v2-m3-pilot-20260803.L3KSNP/final-review/sealed-final-pilot-review-packet.json';
const V5_PACKET_PATH = '/private/tmp/canonical-v2-m3-pilot-20260803.L3KSNP/final-review-v5/sealed-final-pilot-review-packet.json';
const V5_SOURCE_BOUND_INPUT_PATH = '/private/tmp/canonical-v2-m3-pilot-20260803.L3KSNP/final-review-v5/sealed-strict-independent-legal-review-input-source-bound-v5.json';

test('prepares a strict twelve-item legal review with no automatic PASS', { skip: !fs.existsSync(PACKET_PATH) }, () => {
  const packet = JSON.parse(fs.readFileSync(PACKET_PATH, 'utf8'));
  const input = buildFinalPilotStrictIndependentReviewInput({ final_review_packet: packet });
  assert.equal(input.schema_version, STRICT_INDEPENDENT_REVIEW_SCHEMA);
  assert.equal(input.review_items.length, 12);
  assert.equal(input.model_call_count, 0);
  assert.equal(input.automatic_legal_passes, 0);
  assert.equal(input.review_items[0].re_review_rubric, FINAL_RE_REVIEW_RUBRIC);
  assert.match(input.review_items[0].reviewer_requirements.join(' '), /parent section/);
  assert.ok(input.review_items.every((item) => item.automatic_legal_disposition === 'NOT_DETERMINED'
    && item.independent_review_state === 'PENDING_INDEPENDENT_LEGAL_REVIEW'));
  const body = { ...input }; delete body.strict_independent_review_input_id;
  assert.equal(input.strict_independent_review_input_id, contentId(STRICT_INDEPENDENT_REVIEW_SCHEMA, body));
});

function reviewInputWithTwelveRows({ missingCitation = false, formulaRows = false } = {}) {
  return {
    schema_version: STRICT_INDEPENDENT_REVIEW_SCHEMA,
    review_items: Array.from({ length: 12 }, (_, index) => ({
      work_item_id: `work-${index + 1}`,
      review_rows: {
        resolved_claims: index === 0 ? [{
          claim_revision_id: 'claim-1',
          section_reference: '5.5',
          source_citation: missingCitation ? null : '5.5(a)',
          canonical_value: true,
          exact_source_quote: 'Each party shall consult.',
          party: { value: 'each party' },
          party_source_span: null,
          governing_context_quote: 'Each party shall consult.',
          exact_source_bytes: null,
        }] : [],
        review_queue: [],
        open_world: [],
        conditional_termination_fee_values: index === 0 && formulaRows ? [{
          conditional_termination_fee_value_id: 'fee-formula-1',
          formula: {
            base_amount: '10000000',
            currency: 'USD',
            raw_formula: 'the lesser of the Company Base Amount and the REIT limit',
            defined_term_lineage: ['Company Termination Fee', 'Company Base Amount'],
          },
          source_citations: ['7.3(b)(i)', '8.12(f)'],
          exact_source_bytes: { text: 'the lesser of the Company Base Amount and the REIT limit' },
        }] : [],
        structured_per_share_cash_values: index === 0 && formulaRows ? [{
          structured_per_share_cash_value_id: 'cash-formula-1',
          formula: {
            base_amount: '25.00',
            currency: 'USD',
            raw_formula: 'Twenty-Five Dollars ($25.00) plus accrued dividends',
            operative_quote: 'converted into the right to receive the Per Preferred Share Liquidation Price',
            defined_term_lineage: ['Per Company Preferred Share Merger Consideration', 'Per Preferred Share Liquidation Price'],
          },
          source_citations: ['2.1(b)(ii)'],
          exact_source_bytes: { text: 'converted into the right to receive the Per Preferred Share Liquidation Price. Twenty-Five Dollars ($25.00) plus accrued dividends' },
        }] : [],
      },
    })),
  };
}

function findingFor(reviewItem, status = 'PASS') {
  return {
    work_item_id: reviewItem.work_item_id,
    status,
    reason_codes: status === 'FAIL' ? ['MISSING_PUBLISHED_SOURCE_CITATION'] : [],
    claim_reviews: reviewItem.review_rows.resolved_claims.map((row) => ({
      claim_revision_id: row.claim_revision_id,
      value_status: status,
      party_status: status,
      citation_status: status,
      chapeau_status: status,
      status,
    })),
    review_queue_reviews: [],
    open_world_reviews: [],
    conditional_termination_fee_value_reviews: (reviewItem.review_rows.conditional_termination_fee_values || []).map((row) => ({
      conditional_termination_fee_value_id: row.conditional_termination_fee_value_id,
      value_status: status,
      formula_status: status,
      citation_lineage_status: status,
      status,
    })),
    structured_per_share_cash_value_reviews: (reviewItem.review_rows.structured_per_share_cash_values || []).map((row) => ({
      structured_per_share_cash_value_id: row.structured_per_share_cash_value_id,
      value_status: status,
      formula_status: status,
      citation_lineage_status: status,
      status,
    })),
  };
}

test('accepts one sealed twelve-item findings file and does not reject a parent extraction scope with a child published citation', () => {
  const input = reviewInputWithTwelveRows();
  const artifact = {
    schema_version: FINAL_RE_REVIEW_FINDINGS_SCHEMA,
    findings: input.review_items.map((item) => findingFor(item)),
  };
  assert.equal(validateFinalPilotReReviewFindings({ strict_independent_review_input: input, finding_artifacts: [artifact] }), true);
});

test('accepts two sealed six-item findings files and requires a FAIL for a missing published citation', () => {
  const input = reviewInputWithTwelveRows({ missingCitation: true });
  const findings = input.review_items.map((item) => findingFor(item, item.work_item_id === 'work-1' ? 'FAIL' : 'PASS'));
  const artifacts = [
    { schema_version: FINAL_RE_REVIEW_FINDINGS_SCHEMA, findings: findings.slice(0, 6) },
    { schema_version: FINAL_RE_REVIEW_FINDINGS_SCHEMA, findings: findings.slice(6) },
  ];
  assert.equal(validateFinalPilotReReviewFindings({ strict_independent_review_input: input, finding_artifacts: artifacts }), true);
  artifacts[0].findings[0] = findingFor(input.review_items[0]);
  assert.throws(
    () => validateFinalPilotReReviewFindings({ strict_independent_review_input: input, finding_artifacts: artifacts }),
    (error) => error instanceof FinalPilotIndependentReviewError && error.code === 'RE_REVIEW_RUBRIC_VIOLATION',
  );
});

test('requires exact formula coverage and makes a failed formula fail its work item', () => {
  const input = reviewInputWithTwelveRows({ formulaRows: true });
  const findings = input.review_items.map((item) => findingFor(item));
  const artifact = { schema_version: FINAL_RE_REVIEW_FINDINGS_SCHEMA, findings };
  assert.equal(validateFinalPilotReReviewFindings({ strict_independent_review_input: input, finding_artifacts: [artifact] }), true);

  artifact.findings[0].conditional_termination_fee_value_reviews = [];
  assert.throws(
    () => validateFinalPilotReReviewFindings({ strict_independent_review_input: input, finding_artifacts: [artifact] }),
    (error) => error instanceof FinalPilotIndependentReviewError && error.code === 'RE_REVIEW_OMISSION',
  );

  artifact.findings[0] = findingFor(input.review_items[0]);
  artifact.findings[0].conditional_termination_fee_value_reviews[0].status = 'FAIL';
  assert.throws(
    () => validateFinalPilotReReviewFindings({ strict_independent_review_input: input, finding_artifacts: [artifact] }),
    (error) => error instanceof FinalPilotIndependentReviewError && error.code === 'RE_REVIEW_RUBRIC_VIOLATION',
  );

  const citationlessInput = reviewInputWithTwelveRows({ formulaRows: true });
  citationlessInput.review_items[0].review_rows.conditional_termination_fee_values[0].source_citations = [];
  const citationlessArtifact = {
    schema_version: FINAL_RE_REVIEW_FINDINGS_SCHEMA,
    findings: citationlessInput.review_items.map((item) => findingFor(item)),
  };
  assert.throws(
    () => validateFinalPilotReReviewFindings({ strict_independent_review_input: citationlessInput, finding_artifacts: [citationlessArtifact] }),
    (error) => error instanceof FinalPilotIndependentReviewError && error.code === 'RE_REVIEW_RUBRIC_VIOLATION',
  );
});

test('preserves V5 formula sidecars, claim attributes, citation context, and formula source citations', {
  skip: !fs.existsSync(V5_PACKET_PATH) || !fs.existsSync(V5_SOURCE_BOUND_INPUT_PATH),
}, () => {
  const packet = JSON.parse(fs.readFileSync(V5_PACKET_PATH, 'utf8'));
  const sourceBound = JSON.parse(fs.readFileSync(V5_SOURCE_BOUND_INPUT_PATH, 'utf8'));
  const exactSourceBytesByDocumentHash = {};
  for (const item of sourceBound.review_items) {
    for (const claim of item.review_rows.resolved_claims || []) {
      const source = claim.exact_source_bytes;
      if (source?.document_hash && source.text) exactSourceBytesByDocumentHash[source.document_hash] = source.text;
    }
  }
  const input = buildFinalPilotStrictIndependentReviewInput({
    final_review_packet: packet,
    exact_source_bytes_by_document_hash: exactSourceBytesByDocumentHash,
  });
  const consideration = input.review_items.find((item) => item.work_item_id === 'modiv-consideration-2-1');
  const fees = input.review_items.find((item) => item.work_item_id === 'modiv-termination-fee-7-3');
  assert.equal(consideration.review_rows.structured_per_share_cash_values.length, 1);
  assert.ok(consideration.review_rows.structured_per_share_cash_values[0].source_citations.includes('2.1(b)(ii)'));
  assert.equal(fees.review_rows.conditional_termination_fee_values.length, 6);
  assert.ok(fees.review_rows.conditional_termination_fee_values.every((row) => row.source_citations.length >= 3));
  assert.ok(consideration.review_rows.resolved_claims[0].attributes.ratio_term_ref);
  assert.equal(consideration.review_rows.resolved_claims[0].citation_context.child_section_reference, '2.1');
});

test('rejects a final packet that has any automatic legal PASS', { skip: !fs.existsSync(PACKET_PATH) }, () => {
  const packet = JSON.parse(fs.readFileSync(PACKET_PATH, 'utf8'));
  packet.legal_disposition = 'PASS';
  const body = { ...packet }; delete body.final_review_packet_id;
  packet.final_review_packet_id = contentId(packet.schema_version, body);
  assert.throws(
    () => buildFinalPilotStrictIndependentReviewInput({ final_review_packet: packet }),
    (error) => error instanceof FinalPilotIndependentReviewError && error.code === 'INVALID_FINAL_REVIEW_PACKET',
  );
});
