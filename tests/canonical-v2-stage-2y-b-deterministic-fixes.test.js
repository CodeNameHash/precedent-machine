'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { compileFixtureContractV38 } = require('../lib/canonical-v2/contract-bundle');
const {
  proxyMeetingCorroboratedKinds,
  resolveCandidates,
} = require('../lib/canonical-v2/native-producer/candidate-resolution');

const ROOT = path.resolve(__dirname, '..');
const EVIDENCE_ROOT = path.join(ROOT, 'evidence', 'canonical-v2');

function readJson(runName, fileName) {
  return JSON.parse(fs.readFileSync(path.join(EVIDENCE_ROOT, runName, fileName), 'utf8'));
}

function replay(runName) {
  const receipt = readJson(runName, 'run-receipt.json');
  const adapter = readJson(runName, 'adapter-result.json');
  const manifest = readJson(runName, 'run-manifest.json');
  return resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: compileFixtureContractV38(),
    admitted_source_context: adapter.admitted_source_contexts[0],
    agreement_date: manifest.agreement_date,
  });
}

test('2Y-B replays the three Metsera ownership-ledger proxy cases as resolved', () => {
  const result = replay('metsera-proxy-meeting-20260809-2xk-final');
  const expected = new Map([
    ['including establishing a record date', 'RECORD_DATE_ESTABLISHMENT_PRESENT'],
    ['and completing a broker search pursuant to Section 14a-13 of the Exchange Act', 'BROKER_SEARCH_OBLIGATION_PRESENT'],
    ['Immediately following the execution of this Agreement, Parent, as sole stockholder of Merger Sub, shall adopt this Agreement.', 'MERGER_SUB_APPROVAL_OBLIGATION'],
  ]);

  for (const [quote, claimKey] of expected) {
    const resolved = result.resolved.filter((entry) => entry.claim.raw_value === quote);
    assert.equal(resolved.length, 1, quote);
    assert.equal(resolved[0].resolved_claim_definition_key, claimKey);
    assert.equal(result.review_queue.some((entry) => entry.raw_value === quote && entry.has_resolution === false), false);
  }
});

test('2Y-B recognises the Skechers sole-stockholder written consent without a Parent-approval double fire', () => {
  const quote = 'Immediately following the execution and delivery of this Agreement, Parent will cause the sole stockholder of Merger Sub to execute and deliver to Merger Sub and the Company a written consent approving the Merger in accordance with the DGCL (the “Parent Written Consent”).';
  assert.deepEqual(proxyMeetingCorroboratedKinds(quote), ['MERGER_SUB_APPROVAL']);

  const result = replay('skechers-proxy-meeting-20260809-2xk-final');
  const resolved = result.resolved.filter((entry) => entry.claim.raw_value === quote);
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].resolved_claim_definition_key, 'MERGER_SUB_APPROVAL_OBLIGATION');
  assert.equal(resolved[0].claim.attributes.approval_mechanism, 'SOLE_HOLDER_WRITTEN_CONSENT');
  assert.equal(result.review_queue.some((entry) => entry.raw_value === quote && entry.has_resolution === false), false);
});

test('2Y-B keeps genuine Parent shareholder approval distinct from Merger Sub approval', () => {
  const quote = 'Parent stockholders shall approve this Agreement by shareholder vote at the Parent Meeting.';
  assert.deepEqual(proxyMeetingCorroboratedKinds(quote), ['PARENT_APPROVAL']);
});

test('2Y-B preserves combined Parent approval and meeting obligations in the two recorded corpus runs', () => {
  const fixtures = [
    {
      run: 'concho-proxy-meeting-20260809-2xk-final',
      quote: 'Parent shall take all action necessary in accordance with applicable Laws and the Organizational Documents of Parent to duly give notice of, convene and hold (in person or virtually, in accordance with applicable Law) a meeting of its stockholders for the purpose of obtaining the Parent Stockholder Approval',
      parent_review_reason: 'APPROVAL_TIMING_NOT_IN_QUOTE',
    },
    {
      run: 'topbuild-proxy-meeting-20260809-2xk-r4-final',
      quote: 'Parent shall, no later than twenty-one (21) business days following the mailing of the Joint Proxy Statement/Prospectus, duly call, give notice of, convene and hold a meeting of its stockholders (the “Parent Stockholder Meeting”) for the purpose of obtaining the Parent Stockholder Approval',
      parent_review_reason: 'APPROVAL_MECHANISM_UNCORROBORATED',
    },
  ];

  for (const { run, quote, parent_review_reason: parentReviewReason } of fixtures) {
    assert.deepEqual(proxyMeetingCorroboratedKinds(quote), [
      'MEETING_DEADLINE',
      'CONVENE_OBLIGATION',
      'PARENT_APPROVAL',
    ]);
    const result = replay(run);
    const resolved = result.resolved.filter((entry) => entry.claim.raw_value === quote);
    assert.deepEqual(resolved.map((entry) => entry.resolved_claim_definition_key), [
      'MEETING_CONVENE_OBLIGATION',
    ], run);
    assert.equal(result.review_queue.some((entry) => entry.raw_value === quote
      && entry.reasons.includes(parentReviewReason)), true, run);
    assert.equal(result.review_queue.some((entry) => entry.raw_value === quote
      && entry.reasons.includes('AMBIGUOUS_PROXY_MEETING_KIND')), false, run);
  }
});
