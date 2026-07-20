/* Information-sharing codebook (Ben-decided, 2026-07-20): a multi-field
   codebook over the NOSOL notice/disclosure provision — informationSharing
   (primary grade), copiesScope, bidderIdentity, ongoingUpdates, and
   engagementNotice (see INFORMATION_SHARING_GRADE / COPIES_SCOPE /
   BIDDER_IDENTITY_REQUIREMENT / ONGOING_UPDATES_STANDARD /
   ENGAGEMENT_NOTICE_TIMING in lib/taxonomy.js), delivered via the
   human-reviewed coding table in scripts/code-information-sharing.js.
   These tests pin that table to the fixture snapshot of the corpus pass
   (tests/fixtures/information-sharing-decks.json) — any drift between
   "what was classified" and "what the script writes" fails loudly.
   Run: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const taxonomy = require('../lib/taxonomy.js');
const { FEATURES } = require('../lib/schema/features.js');
const { CODING, UNRESOLVED } = require('../scripts/code-information-sharing.js');

const fixture = JSON.parse(fs.readFileSync(
  path.join(__dirname, 'fixtures', 'information-sharing-decks.json'), 'utf-8',
));

test('INFORMATION_SHARING_GRADE carries exactly the three Ben-decided codes with resolvable labels', () => {
  const dict = taxonomy.INFORMATION_SHARING_GRADE;
  assert.deepEqual(
    Object.keys(dict).sort(),
    ['NOTICE_ONLY', 'TERMS_AND_COPIES', 'TERMS_ONLY'],
  );
  assert.equal(taxonomy.labelForCode('TERMS_AND_COPIES', dict), 'Terms + copies of bid documents');
  assert.equal(taxonomy.labelForCode('TERMS_ONLY', dict), 'Material terms described, no documents');
  assert.equal(taxonomy.labelForCode('NOTICE_ONLY', dict), 'Bare notice a proposal arrived');
  assert.equal(taxonomy.labelForCode('BOGUS', dict), null);
});

test('COPIES_SCOPE, BIDDER_IDENTITY_REQUIREMENT, ONGOING_UPDATES_STANDARD, ENGAGEMENT_NOTICE_TIMING carry the Ben-decided codes', () => {
  assert.deepEqual(
    Object.keys(taxonomy.COPIES_SCOPE).sort(),
    ['REDACTION_PERMITTED', 'UNREDACTED', 'UNSPECIFIED'],
  );
  assert.deepEqual(
    Object.keys(taxonomy.BIDDER_IDENTITY_REQUIREMENT).sort(),
    ['CARVEOUT', 'NOT_REQUIRED', 'REQUIRED'],
  );
  assert.deepEqual(
    Object.keys(taxonomy.ONGOING_UPDATES_STANDARD).sort(),
    ['DEADLINE', 'NONE', 'ON_REQUEST', 'REASONABLY_INFORMED'],
  );
  assert.deepEqual(
    Object.keys(taxonomy.ENGAGEMENT_NOTICE_TIMING).sort(),
    ['ADVANCE', 'NONE', 'PROMPT_AFTER'],
  );
});

test('all five feature keys resolve through taxonomyForFeatureKey and are wired into the schema registry', () => {
  const pairs = [
    ['informationSharing', taxonomy.INFORMATION_SHARING_GRADE],
    ['copiesScope', taxonomy.COPIES_SCOPE],
    ['bidderIdentity', taxonomy.BIDDER_IDENTITY_REQUIREMENT],
    ['ongoingUpdates', taxonomy.ONGOING_UPDATES_STANDARD],
    ['engagementNotice', taxonomy.ENGAGEMENT_NOTICE_TIMING],
  ];
  for (const [key, dict] of pairs) {
    assert.equal(taxonomy.taxonomyForFeatureKey(key), dict, `${key} taxonomy wiring`);
    // None of these five are carve-out-style pill LISTs -- each is a single
    // tagged grade per provision.
    assert.equal(taxonomy.isListTaxonomyKey(key), false, `${key} should not be a list taxonomy key`);
    assert.ok(FEATURES[key], `${key} must exist in lib/schema/features.js`);
    assert.equal(FEATURES[key].provisionTypes[0], 'NOSOL', `${key} provisionTypes`);
  }
});

// financingDocsIncluded is deliberately NOT part of this codebook -- it
// rides the pre-existing infoRequiredFinancingPapers boolean.
test('financingDocsIncluded is not duplicated as a new field; infoRequiredFinancingPapers already covers it', () => {
  assert.equal(FEATURES.financingDocsIncluded, undefined);
  assert.ok(FEATURES.infoRequiredFinancingPapers);
});

test("script's CODING table covers exactly the decks the corpus pass classified, with exactly these field values", () => {
  assert.deepEqual(
    Object.keys(CODING).sort(),
    Object.keys(fixture.classified).sort(),
    'CODING deals must match the fixture snapshot exactly (no silent additions or drops)',
  );
  for (const [dealId, snap] of Object.entries(fixture.classified)) {
    const entry = CODING[dealId];
    assert.equal(entry.dealName, snap.dealName, `${dealId} dealName`);
    assert.equal(entry.informationSharing, snap.informationSharing, `${dealId} informationSharing`);
    assert.equal(entry.copiesScope || null, snap.copiesScope, `${dealId} copiesScope`);
    assert.equal(entry.bidderIdentity || 'REQUIRED', snap.bidderIdentity, `${dealId} bidderIdentity`);
    assert.equal(entry.ongoingUpdates || 'REASONABLY_INFORMED', snap.ongoingUpdates, `${dealId} ongoingUpdates`);
    assert.equal(entry.engagementNotice || null, snap.engagementNotice, `${dealId} engagementNotice`);
  }
});

test('every CODING entry is internally valid: known codes, non-empty key quote, copiesScope only under TERMS_AND_COPIES', () => {
  for (const [dealId, entry] of Object.entries(CODING)) {
    assert.ok(
      taxonomy.isValidTaxonomyCode(entry.informationSharing, taxonomy.INFORMATION_SHARING_GRADE),
      `${dealId} informationSharing ${entry.informationSharing} not in INFORMATION_SHARING_GRADE`,
    );
    // The 2026-07 corpus pass found zero decks at the NOTICE_ONLY floor.
    assert.notEqual(entry.informationSharing, 'NOTICE_ONLY', `${dealId}: no corpus precedent for NOTICE_ONLY`);

    if (entry.copiesScope) {
      assert.ok(
        taxonomy.isValidTaxonomyCode(entry.copiesScope, taxonomy.COPIES_SCOPE),
        `${dealId} copiesScope ${entry.copiesScope} not in COPIES_SCOPE`,
      );
      assert.equal(entry.informationSharing, 'TERMS_AND_COPIES', `${dealId}: copiesScope only meaningful under TERMS_AND_COPIES`);
    } else {
      assert.notEqual(entry.informationSharing, 'TERMS_AND_COPIES', `${dealId}: TERMS_AND_COPIES deck missing copiesScope`);
    }

    if (entry.bidderIdentity) {
      assert.ok(
        taxonomy.isValidTaxonomyCode(entry.bidderIdentity, taxonomy.BIDDER_IDENTITY_REQUIREMENT),
        `${dealId} bidderIdentity ${entry.bidderIdentity} not in BIDDER_IDENTITY_REQUIREMENT`,
      );
    }
    if (entry.ongoingUpdates) {
      assert.ok(
        taxonomy.isValidTaxonomyCode(entry.ongoingUpdates, taxonomy.ONGOING_UPDATES_STANDARD),
        `${dealId} ongoingUpdates ${entry.ongoingUpdates} not in ONGOING_UPDATES_STANDARD`,
      );
    }
    if (entry.engagementNotice) {
      assert.ok(
        taxonomy.isValidTaxonomyCode(entry.engagementNotice, taxonomy.ENGAGEMENT_NOTICE_TIMING),
        `${dealId} engagementNotice ${entry.engagementNotice} not in ENGAGEMENT_NOTICE_TIMING`,
      );
    }

    assert.equal(typeof entry.keyQuote, 'string');
    assert.ok(entry.keyQuote.trim().length >= 20, `${dealId} key quote too short to review`);
  }
});

test("script's UNRESOLVED list matches the fixture and never overlaps CODING", () => {
  assert.deepEqual(Object.keys(UNRESOLVED).sort(), [...fixture.unresolved].sort());
  for (const dealId of Object.keys(UNRESOLVED)) {
    assert.ok(!(dealId in CODING), `${dealId} is both UNRESOLVED and coded`);
    assert.ok(String(UNRESOLVED[dealId]).length > 0, `${dealId} unresolved reason missing`);
  }
});

test('engagementNotice is never default-guessed: only present where the corpus pass explicitly established it', () => {
  const withNotice = Object.entries(CODING).filter(([, e]) => e.engagementNotice);
  assert.ok(withNotice.length > 0, 'expected at least one deck with an established engagementNotice');
  assert.ok(withNotice.length < Object.keys(CODING).length, 'engagementNotice must be the exception, not the default');
});
