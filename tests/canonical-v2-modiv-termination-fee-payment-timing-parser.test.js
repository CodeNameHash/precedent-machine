'use strict';

/* PLAN.md Step 3D-adjacent PLAN.md Step 3I ("payment timing"). Mirrors
   tests/canonical-v2-modiv-termination-fee-source-parser.test.js exactly --
   same real Modiv fixture, same trigger()-fixture-candidate helper shape,
   same gate-hostile-test structure -- for the sibling sidecar
   modiv-termination-fee-payment-timing-parser.js. */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { buildSecEdgarIntakeCapture } = require('../lib/canonical-v2/sec-edgar-intake-capture');
const { convertSecHtmlToCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text');
const { resolveModivConditionalFees } = require('../lib/canonical-v2/native-producer/modiv-termination-fee-source-parser');
const {
  buildTerminationFeePaymentTiming,
  parseModivPaymentTimings,
  resolveModivPaymentTimings,
} = require('../lib/canonical-v2/native-producer/modiv-termination-fee-payment-timing-parser');

const rawBytes = fs.readFileSync(path.join(__dirname, 'fixtures', 'canonical-v2', 'mae-definition-family', 'modiv-raw-fetched.htm'));
const capture = buildSecEdgarIntakeCapture({
  retrieval_url: 'https://www.sec.gov/Archives/edgar/data/1/modiv.htm',
  final_url: 'https://www.sec.gov/Archives/edgar/data/1/modiv.htm',
  status_code: 200,
  content_type: 'text/html; charset=UTF-8',
  retrieved_at: '2026-08-07T00:00:00.000Z',
  retrieval_policy_digest: sha256Hex('modiv payment-timing parser test'),
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

function companyBaseAmountCrossReference(rawValue, {
  citation = '8.12(f)', feeSide = 'SELLER', sectionReference = '8.12',
} = {}) {
  return {
    ok: true,
    section_reference: sectionReference,
    citation_validation: { accepted: true, derived_citation: citation },
    candidate: {
      kind: 'claim',
      claim: {
        claim_definition_key: 'NATIVE_TERMINATION_FEE_TRIGGER_CANDIDATE',
        raw_value: rawValue,
        attributes: { fee_side: feeSide },
      },
    },
  };
}

const ALL_SIX = [
  trigger('7.3(b)(i)', 'SELLER'), trigger('7.3(b)(ii)', 'SELLER'), trigger('7.3(b)(iii)', 'SELLER'),
  trigger('7.3(b)(iv)', 'SELLER'), trigger('7.3(b)(v)', 'SELLER'), trigger('7.3(c)', 'BUYER'),
];

const R1_V2_SHAPE_WITHOUT_DIRECT_BIII = ALL_SIX.filter(
  (entry) => entry.citation_validation.derived_citation !== '7.3(b)(iii)',
);

test('buildTerminationFeePaymentTiming: valid input freezes and content-addresses; every required field is enforced', () => {
  const row = buildTerminationFeePaymentTiming({
    fee_side: 'SELLER',
    triggering_branch: '7.3(b)(i)',
    payment_timing_quote: 'within two (2) Business Days after the date of such termination by Parent',
    source_citations: ['7.3(b)(i)'],
  });
  assert.equal(row.schema_version, 'TERMINATION_FEE_PAYMENT_TIMING/V1');
  assert.ok(Object.isFrozen(row));
  assert.ok(typeof row.termination_fee_payment_timing_id === 'string' && row.termination_fee_payment_timing_id.length > 0);

  // Same input twice -> identical id (content-addressed, not random).
  const again = buildTerminationFeePaymentTiming({
    fee_side: 'SELLER',
    triggering_branch: '7.3(b)(i)',
    payment_timing_quote: 'within two (2) Business Days after the date of such termination by Parent',
    source_citations: ['7.3(b)(i)'],
  });
  assert.equal(row.termination_fee_payment_timing_id, again.termination_fee_payment_timing_id);

  // Different quote -> different id.
  const different = buildTerminationFeePaymentTiming({
    fee_side: 'SELLER',
    triggering_branch: '7.3(b)(i)',
    payment_timing_quote: 'a different quote entirely',
    source_citations: ['7.3(b)(i)'],
  });
  assert.notEqual(row.termination_fee_payment_timing_id, different.termination_fee_payment_timing_id);

  assert.throws(() => buildTerminationFeePaymentTiming({
    fee_side: 'TARGET', triggering_branch: '7.3(b)(i)', payment_timing_quote: 'x', source_citations: ['7.3(b)(i)'],
  }), TypeError, 'fee_side must be SELLER or BUYER');
  assert.throws(() => buildTerminationFeePaymentTiming({
    fee_side: 'SELLER', triggering_branch: '9.9(z)', payment_timing_quote: 'x', source_citations: ['7.3(b)(i)'],
  }), TypeError, 'triggering_branch must be one of the six registered branches');
  assert.throws(() => buildTerminationFeePaymentTiming({
    fee_side: 'SELLER', triggering_branch: '7.3(b)(i)', payment_timing_quote: '', source_citations: ['7.3(b)(i)'],
  }), TypeError, 'payment_timing_quote must be non-empty');
  assert.throws(() => buildTerminationFeePaymentTiming({
    fee_side: 'SELLER', triggering_branch: '7.3(b)(i)', payment_timing_quote: 'x', source_citations: [],
  }), TypeError, 'source_citations must be non-empty');
});

test('parses six exact Modiv payment-timing rows, verbatim and grouped exactly as the real sentence groups them', () => {
  const rows = parseModivPaymentTimings(text);
  assert.equal(rows.length, 6);
  const byBranch = new Map(rows.map((row) => [row.triggering_branch, row]));

  for (const branch of ['7.3(b)(i)', '7.3(b)(iv)', '7.3(b)(v)']) {
    assert.equal(byBranch.get(branch).payment_timing_quote, 'within two (2) Business Days after the date of such termination by Parent', branch);
    assert.equal(byBranch.get(branch).fee_side, 'SELLER', branch);
  }
  assert.equal(byBranch.get('7.3(b)(ii)').payment_timing_quote, 'prior to or substantially concurrently with such termination by the Company');
  assert.equal(
    byBranch.get('7.3(b)(iii)').payment_timing_quote,
    'within two (2) Business Days after the earlier of entry into a definitive agreement relating to the Company Acquisition Proposal referred to in clause (B) of Section 7.3(b)(iii) and consummation of such Company Acquisition Proposal',
  );
  assert.equal(byBranch.get('7.3(c)').payment_timing_quote, 'within two (2) Business Days after the date of such termination by the Company');
  assert.equal(byBranch.get('7.3(c)').fee_side, 'BUYER');

  // Every quote is a genuine substring of the real, converted Modiv text --
  // not paraphrased, not invented.
  for (const row of rows) {
    assert.ok(text.includes(row.payment_timing_quote), `${row.triggering_branch}'s quote must be real Modiv text`);
  }

  // Each row's own source_citations names exactly its own branch (this
  // parser does not (yet) attempt the "which OTHER sections also govern
  // this limb" join grounds-to-amount-mapping.md solves for amounts --
  // deliberately narrower, see this file's own header note in the parser).
  for (const row of rows) {
    assert.deepEqual(row.source_citations, [row.triggering_branch]);
  }
});

test('requires every retained trigger branch and its supported side, hostile: a missing branch or a mismatched side refuses rather than guesses', () => {
  assert.equal(resolveModivPaymentTimings({ source_text: text, fee_trigger_candidates: ALL_SIX }).length, 6);

  // Hostile 1: one branch missing entirely.
  assert.throws(
    () => resolveModivPaymentTimings({ source_text: text, fee_trigger_candidates: ALL_SIX.slice(1) }),
    /BRANCH_UNSUPPORTED/,
  );

  // Hostile 2: a branch present but corroborated to the wrong side (a
  // buyer-side citation masquerading as a seller-side one, or vice versa)
  // must refuse, not silently accept whichever side arrived first.
  assert.throws(
    () => resolveModivPaymentTimings({
      source_text: text,
      fee_trigger_candidates: [...ALL_SIX.slice(0, 5), trigger('7.3(c)', 'SELLER')],
    }),
    /SIDE_MISMATCH/,
  );

  // Hostile 3: no fee-trigger candidates at all (a wholly different
  // family/deal shape) -- the caller (candidate-resolution.js) gates this
  // case before ever calling in, but the function itself must still refuse
  // cleanly rather than emit a partial or empty-but-successful result that
  // could be confused with "ran and found nothing to report".
  assert.throws(
    () => resolveModivPaymentTimings({ source_text: text, fee_trigger_candidates: [] }),
    /BRANCH_UNSUPPORTED/,
  );
});

test('the R1-v2 shape recovers both Modiv sidecars through one exact Company Base Amount branch gate', () => {
  const candidates = [
    ...R1_V2_SHAPE_WITHOUT_DIRECT_BIII,
    companyBaseAmountCrossReference('Section 7.3(b)(iii)'),
  ];
  assert.equal(resolveModivConditionalFees({ source_text: text, fee_trigger_candidates: candidates }).length, 6);
  assert.equal(resolveModivPaymentTimings({ source_text: text, fee_trigger_candidates: candidates }).length, 6);
});

test('payment timing refuses malformed or unproved Company Base Amount supplementation', () => {
  const resolves = (reference) => resolveModivPaymentTimings({
    source_text: text,
    fee_trigger_candidates: reference
      ? [...R1_V2_SHAPE_WITHOUT_DIRECT_BIII, reference]
      : R1_V2_SHAPE_WITHOUT_DIRECT_BIII,
  });
  assert.throws(() => resolves(null), /BRANCH_UNSUPPORTED/);
  assert.throws(
    () => resolves(companyBaseAmountCrossReference('Section 7.3(b)(iii)', { citation: '8.12(g)' })),
    /BRANCH_UNSUPPORTED/,
  );
  assert.throws(
    () => resolves(companyBaseAmountCrossReference('Section 7.3(b)(iii)', { feeSide: 'BUYER' })),
    /BRANCH_UNSUPPORTED/,
  );
  assert.throws(
    () => resolves(companyBaseAmountCrossReference('Section 7.3(b)(vi)')),
    /BRANCH_UNSUPPORTED/,
  );
  assert.throws(
    () => resolveModivPaymentTimings({
      source_text: text,
      fee_trigger_candidates: [...R1_V2_SHAPE_WITHOUT_DIRECT_BIII, trigger('7.3(b)(iii)', 'BUYER')],
    }),
    /SIDE_MISMATCH/,
  );
});

test('payment timing refuses a definition supplement when the exact Company Base Amount source formula is absent', () => {
  const withoutCompanyBaseAmount = text.replace('“Company Base Amount” means', '“Changed Base Amount” means');
  assert.throws(
    () => resolveModivPaymentTimings({
      source_text: withoutCompanyBaseAmount,
      fee_trigger_candidates: [
        ...R1_V2_SHAPE_WITHOUT_DIRECT_BIII,
        companyBaseAmountCrossReference('Section 7.3(b)(iii)'),
      ],
    }),
    /MODIV_FEE_DEFINITION_MISSING_OR_AMBIGUOUS/,
  );
});

test('hostile: a differently-worded agreement (not Modiv) refuses cleanly rather than matching a wrong sentence', () => {
  const differentAgreementText = [
    'This is a completely different merger agreement.',
    'Section 7.3(b) governs the termination fee, payable within five (5) days of termination.',
    'The payment of the Company Termination Fee shall be made promptly.',
  ].join('\n');
  assert.throws(
    () => parseModivPaymentTimings(differentAgreementText),
    /MODIV_PAYMENT_TIMING_SENTENCE_MISSING_OR_AMBIGUOUS/,
  );
  assert.throws(
    () => resolveModivPaymentTimings({ source_text: differentAgreementText, fee_trigger_candidates: ALL_SIX }),
    /MODIV_PAYMENT_TIMING_SENTENCE_MISSING_OR_AMBIGUOUS/,
  );
});

test('hostile: a duplicated payment-timing sentence (ambiguous nesting) refuses rather than picking the first match', () => {
  const companySentence = 'The payment of the Company Termination Fee shall be made (1) in the case of a payment pursuant to Section 7.3(b)(i), Section 7.3(b)(iv) or Section 7.3(b)(v), within two (2) Business Days after the date of such termination by Parent, (2) in the case of a payment pursuant to Section 7.3(b)(ii), prior to or substantially concurrently with such termination by the Company and (3) in the case of a payment pursuant to Section 7.3(b)(iii), within two (2) Business Days after the earlier of entry into a definitive agreement relating to the Company Acquisition Proposal referred to in clause (B) of Section 7.3(b)(iii) and consummation of such Company Acquisition Proposal.';
  const parentSentence = 'The payment of the Parent Termination Fee shall be made within two (2) Business Days after the date of such termination by the Company.';
  const duplicated = [companySentence, parentSentence, companySentence].join('\n\n');
  assert.throws(
    () => parseModivPaymentTimings(duplicated),
    /MODIV_PAYMENT_TIMING_SENTENCE_MISSING_OR_AMBIGUOUS/,
  );
});
