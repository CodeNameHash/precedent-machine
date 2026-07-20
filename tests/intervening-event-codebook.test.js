/* Intervening-event codebook (Ben-decided, 2026-07-20):
   INTERVENING_EVENT_TYPE (IE_POSITIVE_ONLY / IE_POSITIVE_OR_NEGATIVE /
   IE_NONE) + the INTERVENING_EVENT_EXCEPTION_META carve-out tag family in
   lib/taxonomy.js, and the reviewed coding table delivered via
   scripts/code-intervening-event.js. The script is a delivery vehicle for
   human-reviewed coding, so these tests pin its table to the fixture
   snapshot of the corpus pass (tests/fixtures/intervening-event-decks.json)
   — any drift between "what was classified" and "what the script writes"
   fails loudly. Run: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const taxonomy = require('../lib/taxonomy.js');
const { FEATURES } = require('../lib/schema/features.js');
const { CODING, UNRESOLVED } = require('../scripts/code-intervening-event.js');

const fixture = JSON.parse(fs.readFileSync(
  path.join(__dirname, 'fixtures', 'intervening-event-decks.json'), 'utf-8',
));

test('INTERVENING_EVENT_TYPE carries exactly the three Ben-decided codes with resolvable labels', () => {
  const dict = taxonomy.INTERVENING_EVENT_TYPE;
  assert.deepEqual(
    Object.keys(dict).sort(),
    ['IE_NONE', 'IE_POSITIVE_ONLY', 'IE_POSITIVE_OR_NEGATIVE'],
  );
  assert.match(taxonomy.labelForCode('IE_POSITIVE_ONLY', dict), /^Positive developments only/);
  assert.match(taxonomy.labelForCode('IE_POSITIVE_OR_NEGATIVE', dict), /^Positive or negative developments/);
  assert.match(taxonomy.labelForCode('IE_NONE', dict), /^No intervening event concept/);
  assert.equal(taxonomy.labelForCode('IE_BOGUS', dict), null);
});

test('interveningEventType and interveningEventExceptions resolve through taxonomyForFeatureKey', () => {
  assert.equal(taxonomy.taxonomyForFeatureKey('interveningEventType'), taxonomy.INTERVENING_EVENT_TYPE);
  assert.equal(taxonomy.taxonomyForFeatureKey('interveningEventExceptions'), taxonomy.INTERVENING_EVENT_EXCEPTION_CODES);
  // Exceptions render as a carve-out pill LIST (like MAE carve-outs).
  assert.equal(taxonomy.isListTaxonomyKey('interveningEventExceptions'), true);
  assert.equal(taxonomy.isListTaxonomyKey('interveningEventType'), false);
  // Both keys exist in the schema registry (taxonomy-schema-consistency).
  assert.ok(FEATURES.interveningEventType);
  assert.equal(FEATURES.interveningEventExceptions.listItemTagFamily, 'INTERVENING_EVENT_EXCEPTION_CODES');
});

test('exception tag family is corpus-derived: every code has a label and at least one synonym regex', () => {
  const meta = taxonomy.INTERVENING_EVENT_EXCEPTION_META;
  assert.deepEqual(
    Object.keys(meta).sort(),
    ['ACQUISITION_PROPOSAL_RELATED', 'AGREEMENT_COMPLIANCE_ACTIONS', 'CREDIT_RATING_CHANGE', 'MEETS_EXCEEDS_PROJECTIONS', 'STOCK_PRICE_CHANGE'],
  );
  for (const [code, entry] of Object.entries(meta)) {
    assert.equal(typeof entry.label, 'string', `${code} label`);
    assert.ok(entry.label.length > 0, `${code} label non-empty`);
    assert.ok(Array.isArray(entry.synonyms) && entry.synonyms.length > 0, `${code} synonyms`);
    assert.equal(taxonomy.INTERVENING_EVENT_EXCEPTION_CODES[code], entry.label, `${code} in metaToDict view`);
  }
  // The near-universal AP carve-out language must resolve via normalizeToCode.
  assert.equal(
    taxonomy.normalizeToCode('in no event shall the receipt, existence of or terms of an Acquisition Proposal or a Superior Proposal or the consequences thereof constitute an Intervening Event', meta),
    'ACQUISITION_PROPOSAL_RELATED',
  );
});

test("script's CODING table covers exactly the decks the corpus pass classified", () => {
  assert.deepEqual(
    Object.keys(CODING).sort(),
    Object.keys(fixture.classified).sort(),
    'CODING deals must match the fixture snapshot exactly (no silent additions or drops)',
  );
  for (const [dealId, snap] of Object.entries(fixture.classified)) {
    const entry = CODING[dealId];
    assert.equal(entry.dealName, snap.dealName, `${dealId} dealName`);
    assert.equal(entry.grade, snap.grade, `${dealId} grade`);
    assert.deepEqual([...entry.exceptions].sort(), [...snap.exceptions].sort(), `${dealId} exceptions`);
  }
});

test('every CODING entry is internally valid: known grade, known exceptions, non-empty key quote', () => {
  for (const [dealId, entry] of Object.entries(CODING)) {
    assert.ok(
      taxonomy.isValidTaxonomyCode(entry.grade, taxonomy.INTERVENING_EVENT_TYPE),
      `${dealId} grade ${entry.grade} not in INTERVENING_EVENT_TYPE`,
    );
    // The script never stamps IE_NONE — no provision row exists to stamp.
    assert.notEqual(entry.grade, 'IE_NONE', `${dealId}: IE_NONE decks have no row to stamp`);
    for (const code of entry.exceptions) {
      assert.ok(
        taxonomy.isValidTaxonomyCode(code, taxonomy.INTERVENING_EVENT_EXCEPTION_CODES),
        `${dealId} exception ${code} not in INTERVENING_EVENT_EXCEPTION_CODES`,
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
