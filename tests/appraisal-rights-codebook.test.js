/* Appraisal-rights codebook (Ben-decided, 2026-07-20): a single-field
   codebook over the deal's CONSID-DISSENT provision (or, where the
   appraisal clause is drafted inline into the share-conversion/exchange
   mechanics, the CONSID-CONVERT/CONSID-EXCHANGE provision carrying that
   text) -- appraisalRightsStatus (see APPRAISAL_RIGHTS_STATUS in
   lib/taxonomy.js), delivered via the human-reviewed coding table in
   scripts/code-appraisal-rights.js. These tests pin that table to the
   fixture snapshot of the corpus pass
   (tests/fixtures/appraisal-rights-decks.json) -- any drift between "what
   was classified" and "what the script writes" fails loudly.
   Run: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const taxonomy = require('../lib/taxonomy.js');
const { FEATURES } = require('../lib/schema/features.js');
const { CODING, UNRESOLVED } = require('../scripts/code-appraisal-rights.js');

const fixture = JSON.parse(fs.readFileSync(
  path.join(__dirname, 'fixtures', 'appraisal-rights-decks.json'), 'utf-8',
));

test('APPRAISAL_RIGHTS_STATUS carries exactly the three Ben-decided codes with resolvable labels', () => {
  const dict = taxonomy.APPRAISAL_RIGHTS_STATUS;
  assert.deepEqual(
    Object.keys(dict).sort(),
    ['AVAILABLE', 'NOT_AVAILABLE', 'SILENT'],
  );
  assert.equal(taxonomy.labelForCode('AVAILABLE', dict), 'Appraisal rights available');
  assert.equal(taxonomy.labelForCode('NOT_AVAILABLE', dict), 'Agreement states no appraisal rights');
  assert.equal(taxonomy.labelForCode('SILENT', dict), 'Agreement silent — statutory default governs');
  assert.equal(taxonomy.labelForCode('BOGUS', dict), null);
});

test('appraisalRightsStatus resolves through taxonomyForFeatureKey and is wired into the schema registry', () => {
  assert.equal(taxonomy.taxonomyForFeatureKey('appraisalRightsStatus'), taxonomy.APPRAISAL_RIGHTS_STATUS);
  // A single tagged grade per provision, not a carve-out-style pill list.
  assert.equal(taxonomy.isListTaxonomyKey('appraisalRightsStatus'), false);
  assert.ok(FEATURES.appraisalRightsStatus, 'appraisalRightsStatus must exist in lib/schema/features.js');
  assert.equal(FEATURES.appraisalRightsStatus.provisionTypes[0], 'CONSID');
  assert.ok(FEATURES.appraisalRightsStatus.provisionCodes.includes('CONSID-DISSENT'));
});

// appraisalRightsAvailable is a pre-existing boolean field with a TODO
// description -- appraisalRightsStatus is a distinct, richer tri-state
// codebook and does not replace or duplicate it.
test('appraisalRightsStatus is additive: the pre-existing appraisalRightsAvailable boolean is untouched', () => {
  assert.ok(FEATURES.appraisalRightsAvailable, 'appraisalRightsAvailable must still exist');
  assert.equal(FEATURES.appraisalRightsAvailable.valueType, 'boolean');
  assert.equal(FEATURES.appraisalRightsStatus.valueType, 'object');
});

test("script's CODING table covers exactly the decks the corpus pass classified, with exactly these status values", () => {
  assert.deepEqual(
    Object.keys(CODING).sort(),
    Object.keys(fixture.classified).sort(),
    'CODING deals must match the fixture snapshot exactly (no silent additions or drops)',
  );
  for (const [dealId, snap] of Object.entries(fixture.classified)) {
    const entry = CODING[dealId];
    assert.equal(entry.dealName, snap.dealName, `${dealId} dealName`);
    assert.equal(entry.appraisalRightsStatus, snap.appraisalRightsStatus, `${dealId} appraisalRightsStatus`);
  }
});

test('every CODING entry is internally valid: known code, non-empty key quote', () => {
  for (const [dealId, entry] of Object.entries(CODING)) {
    assert.ok(
      taxonomy.isValidTaxonomyCode(entry.appraisalRightsStatus, taxonomy.APPRAISAL_RIGHTS_STATUS),
      `${dealId} appraisalRightsStatus ${entry.appraisalRightsStatus} not in APPRAISAL_RIGHTS_STATUS`,
    );
    // The 2026-07 corpus pass drew a hard line at the two anchor cases
    // (AVAILABLE, NOT_AVAILABLE) -- SILENT is the honest floor value for a
    // genuinely silent agreement, never asserted from a stored-data gap.
    assert.notEqual(entry.appraisalRightsStatus, 'SILENT', `${dealId}: no corpus deck classified SILENT (stored-data gaps are UNRESOLVED, not guessed)`);

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

test('Ben\'s two anchor NOT_AVAILABLE examples (Heinz/Kraft Sec. 2.01(c), ENDRA/Renergen Sec. 3.5) are coded NOT_AVAILABLE with the express negative quote', () => {
  const heinz = CODING['c7c16365-c9cf-4bfb-93a6-1575084d717c'];
  assert.ok(heinz, 'Heinz / Kraft must be coded');
  assert.equal(heinz.appraisalRightsStatus, 'NOT_AVAILABLE');
  assert.match(heinz.keyQuote, /no appraisal rights shall be available/i);

  const endra = CODING['65a3e3c8-91e6-4075-bad0-4e3c4d1b43b9'];
  assert.ok(endra, 'ENDRA Life Sciences / Renergen must be coded');
  assert.equal(endra.appraisalRightsStatus, 'NOT_AVAILABLE');
  assert.match(endra.keyQuote, /no appraisal rights shall be available/i);
});

test('NOT_AVAILABLE decks are the minority and every keyQuote for NOT_AVAILABLE contains an express negative', () => {
  const entries = Object.values(CODING);
  const notAvailable = entries.filter((e) => e.appraisalRightsStatus === 'NOT_AVAILABLE');
  const available = entries.filter((e) => e.appraisalRightsStatus === 'AVAILABLE');
  assert.ok(notAvailable.length > 0, 'expected at least one NOT_AVAILABLE deck');
  assert.ok(available.length > notAvailable.length, 'AVAILABLE should be the market default, not the exception');
  for (const e of notAvailable) {
    assert.match(e.keyQuote, /no (?:dissenters'? or )?appraisal rights (?:shall|will) be available/i, `${e.dealName} NOT_AVAILABLE quote must be an express negative`);
  }
});
