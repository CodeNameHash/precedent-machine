'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normaliseRestrictionCategory,
  corroborateRestrictionCategory,
} = require('../lib/canonical-v2/native-producer/ioc-corroboration');
const {
  proxyMeetingCorroboratedKinds,
} = require('../lib/canonical-v2/native-producer/candidate-resolution');

const LEGACY_IOC_CASES = Object.freeze([
  Object.freeze({
    category: 'CHARTER',
    canonical: 'CHARTER_BYLAW_AMENDMENTS',
    quote: 'amend or propose to amend the Company’s Organizational Documents',
  }),
  Object.freeze({
    category: 'SETTLE',
    canonical: 'LITIGATION_SETTLEMENTS',
    quote: 'pay, discharge, settle or satisfy any claims, liabilities or obligations (whether absolute, accrued, asserted or unasserted, contingent or otherwise)',
  }),
  Object.freeze({
    category: 'SETTLE',
    canonical: 'LITIGATION_SETTLEMENTS',
    quote: 'the Company may not settle or propose to settle or compromise any Transaction Litigation',
  }),
  Object.freeze({
    category: 'SETTLE',
    canonical: 'LITIGATION_SETTLEMENTS',
    quote: 'settle, waive or amend any claims or rights of substantial value',
  }),
]);

test('Phase 0.2: the four recorded legacy IOC labels remain canonical and corroborated', () => {
  for (const { category, canonical, quote } of LEGACY_IOC_CASES) {
    const normalised = normaliseRestrictionCategory(category, quote);
    assert.equal(normalised, canonical);
    assert.equal(
      corroborateRestrictionCategory({ quote, asserted_category: normalised }).outcome,
      'RESOLVED',
    );
  }
});

test('Phase 0.2: Parent recommendation and record-date wording do not also assert Parent approval', () => {
  const recommendation = 'Except as permitted by Section 6.4, the Parent Board shall recommend that the stockholders of Parent vote in favor of the issuance of Parent Common Stock in the Merger and the Parent Board shall solicit from stockholders of Parent proxies in favor of the Parent Stock Issuance, and the Joint Proxy Statement shall include the Parent Board Recommendation.';
  const recordDate = 'Once Parent has established a record date for the Parent Stockholders Meeting, Parent shall not change such record date or establish a different record date for the Parent Stockholders Meeting without the prior written consent of the Company';

  assert.deepEqual(proxyMeetingCorroboratedKinds(recommendation), ['RECOMMENDATION_INCLUSION']);
  assert.deepEqual(proxyMeetingCorroboratedKinds(recordDate), ['RECORD_DATE_ESTABLISHMENT']);
});

test('Phase 0.2: supplemental or amended disclosure is an adjournment reason', () => {
  const quote = '(B) to allow reasonable additional time for the filing or mailing of any supplemental or amended disclosure that the Company has determined, after consultation with outside legal counsel, is reasonably likely to be required under applicable Law and for such supplemental or amended disclosure to be disseminated and reviewed by stockholders of the Company prior to the Shareholder Meeting';
  assert.deepEqual(proxyMeetingCorroboratedKinds(quote), ['ADJOURNMENT_REASON']);
});
