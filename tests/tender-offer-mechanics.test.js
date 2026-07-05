const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { CODES, getFeaturesForType } = require('../lib/rubric');
const { tryDeterministic, refineSubCode } = require('../lib/parser-v2/classify');
const { extractTenderOfferMechanicsFeatures, filterFeaturesToCodeSchema } = require('../lib/parser-v2/extract');
const { validateFeatures } = require('../lib/feature-validation');

const OFFER_SECTION = {
  title: 'The Offer',
  heading: 'The Offer',
  text: [
    'Section 2.1 The Offer.',
    'Provided that this Agreement shall not have been terminated, Merger Sub shall, and Parent shall cause Merger Sub to, commence the Offer to purchase all of the Shares at a price per Share equal to the Per Share Amount in cash.',
    'The obligations of Merger Sub to accept for payment, and pay for, any Shares validly tendered pursuant to the Offer are subject to the prior satisfaction or waiver of the Minimum Condition and the other conditions set forth in Annex A.',
    'Merger Sub shall extend the Offer for successive periods if, at any scheduled Expiration Time, any Offer Condition has not been satisfied or waived.',
    'Parent and Merger Sub shall file with the SEC a Tender Offer Statement on Schedule TO and related offer documents.',
  ].join(' '),
};

test('STRUCT-OFFER is a canonical STRUCT code with an offer-specific schema', () => {
  assert.equal(CODES['STRUCT-OFFER'].type, 'STRUCT');
  assert.equal(CODES['STRUCT-OFFER'].label, 'Tender Offer Mechanics');
  const keys = getFeaturesForType('STRUCT', 'STRUCT-OFFER').map((f) => f.key);
  assert.ok(keys.includes('offerCommencementDeadline'));
  assert.ok(keys.includes('schedule14D9Filing'));
  assert.ok(keys.includes('backendMergerMechanic'));
});

test('The Offer article sections stay STRUCT and refine to STRUCT-OFFER', () => {
  const cls = tryDeterministic(OFFER_SECTION, 'STRUCT');
  assert.equal(cls.type, 'STRUCT');
  assert.equal(refineSubCode(OFFER_SECTION, cls.type), 'STRUCT-OFFER');

  const companyActions = { title: 'Company Actions', text: 'The Company shall file a Schedule 14D-9 with respect to the Offer.' };
  assert.equal(refineSubCode(companyActions, 'STRUCT'), 'STRUCT-OFFER');
  assert.equal(refineSubCode(companyActions, 'COV'), null);
});

test('offer mechanics features capture launch, price, conditions, extension, acceptance, and Schedule TO', () => {
  const features = extractTenderOfferMechanicsFeatures(OFFER_SECTION);
  assert.equal(features.canonicalCode, 'STRUCT-OFFER');
  assert.equal(features.dealStructure, 'TWO_STEP_TENDER_OFFER');
  assert.equal(features.mergerForm.code, 'TWO_STEP_TENDER_OFFER');
  assert.match(features.offerCommencementDeadline, /commence the Offer/);
  assert.match(features.offerPrice, /price per Share/);
  assert.equal(features.offerConsideration, 'Cash');
  assert.match(features.offerConditionsReference, /Minimum Condition/);
  assert.match(features.offerExpirationAndExtension, /extend the Offer/);
  assert.match(features.acceptanceAndPaymentMechanics, /accept for payment/);
  assert.match(features.scheduleTOFiling, /Schedule TO/);

  const filtered = filterFeaturesToCodeSchema(features, 'STRUCT-OFFER');
  const validation = validateFeatures('STRUCT', filtered);
  assert.deepEqual(validation.errors, []);
});

test('company action, stockholder-list, directors, and 251(h) snippets map to the right offer fields', () => {
  const schedule = extractTenderOfferMechanicsFeatures({
    title: 'Company Actions',
    text: 'The Company shall file with the SEC a Solicitation/Recommendation Statement on Schedule 14D-9 with respect to the Offer.',
  });
  assert.match(schedule.schedule14D9Filing, /Schedule 14D-9/);

  const lists = extractTenderOfferMechanicsFeatures({
    title: 'Stockholder Lists',
    text: 'The Company shall cause its transfer agent to furnish Parent with mailing labels and stockholder lists for communicating the Offer to holders of Shares.',
  });
  assert.match(lists.stockholderListCovenant, /mailing labels/);

  const directors = extractTenderOfferMechanicsFeatures({
    title: 'Directors',
    text: 'After the Offer Closing, Merger Sub shall be entitled to designate such number of directors to the Company Board.',
  });
  assert.match(directors.buyerBoardDesignation, /designate/);

  const backend = extractTenderOfferMechanicsFeatures({
    title: 'Merger Without a Vote of Stockholders',
    text: 'The parties shall cause the Merger to become effective without a vote of the holders of Shares in accordance with Section 251(h) of the DGCL.',
  });
  assert.equal(backend.section251h, true);
  assert.match(backend.backendMergerMechanic, /251\(h\)/);
});

test('review and compare surfaces include tender-offer mechanics fields', () => {
  const reviewSrc = fs.readFileSync(path.join(__dirname, '..', 'pages', 'review', '[id].js'), 'utf8');
  assert.match(reviewSrc, /STRUCT-OFFER/);
  assert.match(reviewSrc, /offerCommencementDeadline/);
  assert.match(reviewSrc, /schedule14D9Filing/);

  const summarySrc = fs.readFileSync(path.join(__dirname, '..', 'lib', 'category-summary-features.js'), 'utf8');
  assert.match(summarySrc, /Offer Commencement/);
  assert.match(summarySrc, /Back-End Merger/);
});
