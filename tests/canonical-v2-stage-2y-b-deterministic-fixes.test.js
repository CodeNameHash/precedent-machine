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
