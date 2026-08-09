'use strict';

/**
 * tests/canonical-v2-p2-qualifier-kinds.test.js
 *
 * Acceptance tests for
 * docs/superpowers/specs/2026-08-02-p2-qualifier-kinds-design.md, section
 * 10, SCOPED to the pieces actually wired this pass: the lexicon front
 * door (DISCLOSURE_SCHEDULE_CARVEOUT / PERFORMANCE_ASSUMPTION), the
 * schedule-reference pointer parser, the measurement-date-parse v2 date
 * machinery (C4/C5), and the three-place SCHEDULE_REFERENCE_STRING
 * validator lockstep at the two candidate-resolution.js/validate-write-set.js
 * `canonicalValueAllowed` copies (the registry `typedDefinition`
 * whitelist / candidate-resolution table wiring / resolveQualifierPart
 * branches are NOT wired this pass -- see the delivery report).
 *
 * Every quote below is the byte-exact `raw_value` of the named committed
 * fixture row (tests/fixtures/canonical-v2/modiv-first-live-run/
 * resolution.json), per spec section 9.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  QUALIFIER_KIND_LEXICON_VERSION,
  QUALIFIER_KINDS,
  DISCLOSURE_CARVEOUT_PARTIAL,
  DISCLOSURE_CARVEOUT_UNCORROBORATED,
  QUALIFIER_KIND_DISAGREEMENT,
  classifyQualifierQuote,
} = require('../lib/canonical-v2/native-producer/qualifier-kind-lexicon');
const {
  SCHEDULE_REFERENCE_PARSE_VERSION,
  SCHEDULE_REFERENCE_STRING_PATTERN,
  parseScheduleReference,
} = require('../lib/canonical-v2/native-producer/schedule-reference-parse');
const {
  MEASUREMENT_DATE_PARSE_VERSION,
  parseMeasurementDate,
  parseMeasurementPeriod,
} = require('../lib/canonical-v2/native-producer/measurement-date-parse');
const {
  canonicalValueAllowed: candidateResolutionCanonicalValueAllowed,
  lookupGenericClaimKeyMapping,
  derivePerformanceAssumptionLevel,
  resolveCandidates,
} = require('../lib/canonical-v2/native-producer/candidate-resolution');
const validateWriteSet = require('../lib/canonical-v2/validate-write-set');
const {
  compileFixtureContractV17,
  compileFixtureContractV18,
} = require('../lib/canonical-v2/contract-bundle');

const MODIV_FIXTURE = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, 'fixtures', 'canonical-v2', 'modiv-first-live-run', 'resolution.json'),
    'utf8'
  )
);
const MODIV_RUN_RECEIPT = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, 'fixtures', 'canonical-v2', 'modiv-first-live-run', 'run-receipt.json'),
    'utf8'
  )
);
const MODIV_ADMITTED_SOURCE_CONTEXT = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, 'fixtures', 'canonical-v2', 'modiv-first-live-run', 'adapter-result.json'),
    'utf8'
  )
).admitted_source_contexts[0];

function fixtureQuote(closurePrefix) {
  const row = MODIV_FIXTURE.open_world.find((r) => r.closure_id.startsWith(closurePrefix));
  assert.ok(row, `fixture row ${closurePrefix} must exist in the committed corpus`);
  return row.raw_value;
}

// ─── Versions ───

test('QUALIFIER_KIND_LEXICON_VERSION is 5, SCHEDULE_REFERENCE_PARSE_VERSION is 1, MEASUREMENT_DATE_PARSE_VERSION is 2', () => {
  // Stage 3 bumped the lexicon 2 -> 3; Step 2X-D (DECISIONS.md entry 14,
  // 2026-08-08) bumps 3 -> 4 (MAE aggregate phrase -> MAT_MAE_QUALIFIED).
  // See canonical-v2-qualifier-kind-lexicon.test.js's own version pin.
  assert.equal(QUALIFIER_KIND_LEXICON_VERSION, 5);
  assert.equal(SCHEDULE_REFERENCE_PARSE_VERSION, 1);
  assert.equal(MEASUREMENT_DATE_PARSE_VERSION, 2);
});

// ─── Test 1 (scoped): lexicon front door on the real fixture quotes ───

test('every coverage-map CONVERTS carve-out quote classifies DISCLOSURE_SCHEDULE_CARVEOUT with its recorded THRESHOLD hint (legacy-hint abstention)', () => {
  const converts = [
    ['72cf145f2bd6e4c7953871d74f8b7223fa873b6129e77d9d3ab534266aee9b8e', '3.2(b)'],
    ['cc9b6dd956a8836a5dde90669108d1316be56ad4735ab6af476faec18e24bdae', '3.2(c)'],
    ['1f5fe703f428c497beff9cb4139240e8f5a24b1e576e7a793404d1dd57a2f783', '3.2(c)'],
    ['5e4759d89d18db01f24f14c6b6a059cbc4e23ed0385bc2ccf406206c208e3ffc', '3.2(f)'],
    ['8f47f5256ee0ca2651c0d224822e86b4d8b2c7696b3fb4127fba4727d8a31901', '3.2(f)'],
  ];
  for (const [closureId, citation] of converts) {
    const quote = fixtureQuote(closureId);
    const result = classifyQualifierQuote({ quote, modelKind: 'THRESHOLD' });
    assert.equal(result.outcome, 'CLASSIFIED', `${closureId} (${citation})`);
    assert.equal(result.kind, 'DISCLOSURE_SCHEDULE_CARVEOUT');
    // Also confirm with no hint at all (abstention baseline).
    assert.equal(classifyQualifierQuote({ quote }).kind, 'DISCLOSURE_SCHEDULE_CARVEOUT');
  }
});

test('all four Modiv mixed carve-out quotes route REVIEW DISCLOSURE_CARVEOUT_PARTIAL', () => {
  const reviewsExpected = [
    'a7e0b0788330cc18',
    'eafc21cab5c139a9',
    '1c3a8c1e70f50080',
    'af9d471091f10ad0',
  ];
  for (const prefix of reviewsExpected) {
    const quote = fixtureQuote(prefix);
    const result = classifyQualifierQuote({ quote, modelKind: 'THRESHOLD' });
    assert.equal(result.outcome, 'REVIEW', prefix);
    assert.equal(result.reason, DISCLOSURE_CARVEOUT_PARTIAL, prefix);
  }
});

test('the full af9d Modiv enumerated exception quote routes REVIEW', () => {
  const exactQuote =
    'Except (i) pursuant to the Company Charter, (ii) pursuant to the Partnership Agreement, (iii) for equity securities and other instruments (including loans) in wholly owned Company Subsidiaries and (iv) as set forth in Section 3.2(d) of the Company Disclosure Letter,';
  assert.equal(fixtureQuote('af9d471091f10ad0'), exactQuote);

  const result = classifyQualifierQuote({ quote: exactQuote, modelKind: 'THRESHOLD' });
  assert.equal(result.outcome, 'REVIEW');
  assert.equal(result.reason, DISCLOSURE_CARVEOUT_PARTIAL);
});

test('anti-noise: Skechers "this Section 3.7" and whole-letter (no citation) quotes are non-fires, v1-identical', () => {
  assert.equal(
    classifyQualifierQuote({ quote: 'Except as set forth in this Section 3.7' }).outcome,
    'OPEN_WORLD'
  );
  assert.equal(
    classifyQualifierQuote({ quote: 'except as set forth in the Disclosure Letter' }).outcome,
    'OPEN_WORLD'
  );
  assert.equal(
    classifyQualifierQuote({
      quote:
        'Except (i) pursuant to the Company Charter, (ii) pursuant to the Partnership Agreement, (iii) pursuant to another agreement and (iv) as set forth in the Disclosure Letter',
    }).outcome,
    'OPEN_WORLD'
  );
});

test('anti-noise: an enumerated multi-citation carve-out is not admitted by the Modiv-only tripwire', () => {
  assert.equal(
    classifyQualifierQuote({
      quote:
        'Except (i) pursuant to the Company Charter, (ii) pursuant to the Partnership Agreement, (iii) pursuant to another agreement and (iv) as set forth in Sections 3.2(d) and 3.2(e) of the Company Disclosure Letter',
    }).outcome,
    'OPEN_WORLD'
  );
});

test('anti-noise: F28 unanchored agreement-subsection quotes (literal U+200E bytes) do not fire', () => {
  const quote = 'as set forth in Sections ‎3.1(b)(i) and ‎3.1(b)(ii)';
  assert.equal(classifyQualifierQuote({ quote }).outcome, 'OPEN_WORLD');
});

test('ACCURACY hint on a pure carve-out quote -> REVIEW; modelKind DISCLOSURE_SCHEDULE_CARVEOUT with no signal -> REVIEW DISCLOSURE_CARVEOUT_UNCORROBORATED', () => {
  const pure = fixtureQuote('72cf145f2bd6e4c7953871d74f8b7223fa873b6129e77d9d3ab534266aee9b8e');
  const accuracyHint = classifyQualifierQuote({ quote: pure, modelKind: 'ACCURACY' });
  assert.equal(accuracyHint.outcome, 'REVIEW');
  assert.equal(accuracyHint.reason, QUALIFIER_KIND_DISAGREEMENT);

  const uncorroborated = classifyQualifierQuote({
    quote: 'The Company is a Delaware corporation.',
    modelKind: 'DISCLOSURE_SCHEDULE_CARVEOUT',
  });
  assert.equal(uncorroborated.outcome, 'REVIEW');
  assert.equal(uncorroborated.reason, DISCLOSURE_CARVEOUT_UNCORROBORATED);
});

// ─── Test 2: lexicon v1 regression (already covered fully by
// tests/canonical-v2-qualifier-kind-lexicon.test.js's 32 cases, unedited
// except the two named version/enum pins) ───

// ─── Test 3: PERFORMANCE_ASSUMPTION ───

test('PERFORMANCE_ASSUMPTION: both F28 quotes classify with THRESHOLD hints; anti-noise; co-fires route correctly', () => {
  const f28a = '(assuming achievement of the applicable performance goals at the target level)';
  const f28b = '(including the number of Company Shares assuming achievement of the applicable performance goals at the target level)';
  for (const quote of [f28a, f28b]) {
    const result = classifyQualifierQuote({ quote, modelKind: 'THRESHOLD' });
    assert.equal(result.outcome, 'CLASSIFIED');
    assert.equal(result.kind, 'PERFORMANCE_ASSUMPTION');
  }
  const maximum = classifyQualifierQuote({ quote: 'assuming satisfaction of applicable performance criteria at maximum levels' });
  assert.equal(maximum.kind, 'PERFORMANCE_ASSUMPTION');

  assert.equal(
    classifyQualifierQuote({ quote: 'assuming the accuracy of the representations and warranties' }).outcome,
    'OPEN_WORLD'
  );

  const legacyCoFire = classifyQualifierQuote({
    quote: 'assuming satisfaction of applicable performance criteria at target levels in excess of $1,000,000',
    modelKind: 'THRESHOLD',
  });
  assert.equal(legacyCoFire.outcome, 'OPEN_WORLD');

  const accuracyCoFire = classifyQualifierQuote({
    quote: 'assuming satisfaction of applicable performance criteria at target levels, true and correct in all respects',
  });
  assert.equal(accuracyCoFire.outcome, 'REVIEW');
  assert.equal(accuracyCoFire.reason, QUALIFIER_KIND_DISAGREEMENT);
});

// ─── Test 4: pointer parser ───

test('pointer parser: table-driven over the five converting Modiv quotes, exact canonical_value incl. suffix', () => {
  const table = [
    ['72cf145f2bd6e4c7953871d74f8b7223fa873b6129e77d9d3ab534266aee9b8e', '3.2(b)@DISCLOSURE_LETTER'],
    ['cc9b6dd956a8836a5dde90669108d1316be56ad4735ab6af476faec18e24bdae', '3.2(c)@DISCLOSURE_LETTER'],
    ['1f5fe703f428c497beff9cb4139240e8f5a24b1e576e7a793404d1dd57a2f783', '3.2(c)@DISCLOSURE_LETTER'],
    ['5e4759d89d18db01f24f14c6b6a059cbc4e23ed0385bc2ccf406206c208e3ffc', '3.2(f)@DISCLOSURE_LETTER'],
    ['8f47f5256ee0ca2651c0d224822e86b4d8b2c7696b3fb4127fba4727d8a31901', '3.2(f)@DISCLOSURE_LETTER'],
  ];
  for (const [closureId, expected] of table) {
    const result = parseScheduleReference({ quote: fixtureQuote(closureId) });
    assert.equal(result.outcome, 'RESOLVED', closureId);
    assert.equal(result.canonical_value, expected, closureId);
    assert.match(result.canonical_value, SCHEDULE_REFERENCE_STRING_PATTERN);
  }
});

test('pointer parser: the four mixed quotes are typed abstains; multi-citation; whole-letter', () => {
  for (const prefix of ['a7e0b0788330cc18', 'af9d471091f10ad0', 'eafc21cab5c139a9', '1c3a8c1e70f50080']) {
    const result = parseScheduleReference({ quote: fixtureQuote(prefix) });
    assert.equal(result.outcome, 'ABSTAIN', prefix);
  }
  assert.equal(
    parseScheduleReference({ quote: 'except as set forth in Sections 3.2(a) and 3.2(b) of the Company Disclosure Letter' }).reason,
    'MULTIPLE_SCHEDULE_CITATIONS'
  );
  assert.equal(
    parseScheduleReference({ quote: 'except as set forth in the Disclosure Letter' }).reason,
    'NOT_A_PURE_CARVEOUT_CLAUSE'
  );
});

// ─── Test 5 (scoped): SCHEDULE_REFERENCE_STRING validator lockstep across
// the schedule-reference-parse regex and the two canonicalValueAllowed
// copies (candidate-resolution.js, validate-write-set.js). The THIRD site
// -- contract-bundle.js's fixture-shape typedDefinition whitelist -- is not
// exercised by a definition here because the V18 registry entries were not
// wired this pass; see the delivery report. ───

test('three-place lockstep vector (two of three sites): accept/reject agree exactly', () => {
  const accept = ['3.2(f)@DISCLOSURE_LETTER', '3.1(b)(ii)@DISCLOSURE_LETTER'];
  const reject = ['3.2(f)', '3.2(f)@OTHER', 'III-INTRO(b)', 'Section 3.2(f)', '', '3.2(f) @DISCLOSURE_LETTER'];
  const definition = { canonical_value_type: 'SCHEDULE_REFERENCE_STRING' };
  for (const value of accept) {
    assert.equal(SCHEDULE_REFERENCE_STRING_PATTERN.test(value), true, value);
    assert.equal(candidateResolutionCanonicalValueAllowed(definition, value), true, value);
    assert.equal(validateWriteSet.canonicalValueAllowed(definition, value), true, value);
  }
  for (const value of reject) {
    assert.equal(SCHEDULE_REFERENCE_STRING_PATTERN.test(value), false, value);
    assert.equal(candidateResolutionCanonicalValueAllowed(definition, value), false, value);
    assert.equal(validateWriteSet.canonicalValueAllowed(definition, value), false, value);
  }
});

test('P2 phase 2 registry admits only the two approved claim definitions', () => {
  const v17 = compileFixtureContractV17();
  const v18 = compileFixtureContractV18();
  const v17Keys = v17.claim_definitions.map((definition) => definition.claim_definition_key).sort();
  const v18Keys = v18.claim_definitions.map((definition) => definition.claim_definition_key).sort();
  assert.deepEqual(
    v18Keys.filter((key) => !v17Keys.includes(key)),
    ['DISCLOSURE_SCHEDULE_CARVEOUT', 'PERFORMANCE_VESTING_ASSUMPTION']
  );
  const carveout = v18.claim_definitions.find((definition) => definition.claim_definition_key === 'DISCLOSURE_SCHEDULE_CARVEOUT');
  const performance = v18.claim_definitions.find((definition) => definition.claim_definition_key === 'PERFORMANCE_VESTING_ASSUMPTION');
  assert.equal(carveout.canonical_value_type, 'SCHEDULE_REFERENCE_STRING');
  assert.deepEqual(performance.allowed_canonical_values, ['MAXIMUM', 'TARGET']);
});

test('P2 phase 2 maps only the approved carve-out and performance shapes', () => {
  const carveout = lookupGenericClaimKeyMapping(
    'NATIVE_CAPITALISATION_QUALIFIER_CANDIDATE',
    'DISCLOSURE_SCHEDULE_CARVEOUT',
    'ITEM'
  );
  assert.equal(carveout.registered_claim_definition_key, 'DISCLOSURE_SCHEDULE_CARVEOUT');
  assert.equal(
    lookupGenericClaimKeyMapping(
      'NATIVE_CAPITALISATION_QUALIFIER_CANDIDATE',
      'DISCLOSURE_SCHEDULE_CARVEOUT',
      'TRAILING'
    ),
    null
  );
  const performance = lookupGenericClaimKeyMapping(
    'NATIVE_CAPITALISATION_QUALIFIER_CANDIDATE',
    'PERFORMANCE_ASSUMPTION',
    'ITEM'
  );
  assert.equal(performance.registered_claim_definition_key, 'PERFORMANCE_VESTING_ASSUMPTION');
  assert.equal(derivePerformanceAssumptionLevel('assuming achievement of the applicable performance goals at the target level'), 'TARGET');
  assert.equal(derivePerformanceAssumptionLevel('assuming satisfaction of applicable performance criteria at maximum levels'), 'MAXIMUM');
  assert.equal(
    derivePerformanceAssumptionLevel('assuming achievement of applicable performance goals at target levels and assuming satisfaction of applicable performance criteria at maximum levels'),
    null
  );
});

test('P2 phase 2 resolves the five grounded Modiv disclosure-letter pointers under V18', () => {
  const resolution = resolveCandidates({
    run_receipt: MODIV_RUN_RECEIPT,
    contract_vocabulary: compileFixtureContractV18(),
    admitted_source_context: MODIV_ADMITTED_SOURCE_CONTEXT,
    agreement_date: '2026-05-01',
  });
  const pointers = resolution.resolved
    .filter((entry) => entry.resolved_claim_definition_key === 'DISCLOSURE_SCHEDULE_CARVEOUT')
    .map((entry) => entry.claim.canonical_value)
    .sort();
  assert.deepEqual(
    pointers,
    [
      '3.2(b)@DISCLOSURE_LETTER',
      '3.2(c)@DISCLOSURE_LETTER',
      '3.2(c)@DISCLOSURE_LETTER',
      '3.2(f)@DISCLOSURE_LETTER',
      '3.2(f)@DISCLOSURE_LETTER',
    ]
  );
  assert.ok(
    resolution.review_queue.some((entry) => entry.reasons.includes(DISCLOSURE_CARVEOUT_PARTIAL)),
    'mixed carve-outs remain review items'
  );
});

// ─── Test 7: date machinery ───

test('date machinery: AS_OF_BRIDGE fires on both C5 byte-forms and refuses free prose', () => {
  const modivC5 = 'As of the close of business on May 1, 2026 (the “Capitalization Date”)';
  const skechersC5 = 'As of 5:00 p.m., Eastern time, on May 2, 2025 (such time and date, the “Capitalization Date”),';
  assert.equal(classifyQualifierQuote({ quote: modivC5 }).kind, 'TEMPORAL');
  assert.equal(classifyQualifierQuote({ quote: skechersC5 }).kind, 'TEMPORAL');
  assert.equal(classifyQualifierQuote({ quote: 'as of a recent date' }).outcome, 'OPEN_WORLD');
  assert.equal(classifyQualifierQuote({ quote: 'as of the close of the offer' }).outcome, 'OPEN_WORLD');
});

test('date machinery: definition detection captures Capitalization Date from both parenthetical forms', () => {
  const modiv = parseMeasurementDate({ quote: 'As of the close of business on May 1, 2026 (the “Capitalization Date”)' });
  assert.equal(modiv.outcome, 'RESOLVED');
  assert.equal(modiv.iso_date, '2026-05-01');
  assert.equal(modiv.defined_term, 'Capitalization Date');

  const skechers = parseMeasurementDate({
    quote: 'As of 5:00 p.m., Eastern time, on May 2, 2025 (such time and date, the “Capitalization Date”),',
  });
  assert.equal(skechers.outcome, 'RESOLVED');
  assert.equal(skechers.iso_date, '2025-05-02');
  assert.equal(skechers.defined_term, 'Capitalization Date');
});

test('date machinery: symbolic reference resolves via defined_dates, abstains DEFINED_DATE_UNRESOLVED when absent', () => {
  const resolved = parseMeasurementDate({
    quote: 'As of the Capitalization Date,',
    defined_dates: { 'Capitalization Date': '2026-05-01' },
  });
  assert.equal(resolved.outcome, 'RESOLVED');
  assert.equal(resolved.resolution, 'SYMBOLIC_DEAL_DEFINED');
  assert.equal(resolved.iso_date, '2026-05-01');

  const unresolved = parseMeasurementDate({ quote: 'As of the Capitalization Date,' });
  assert.equal(unresolved.outcome, 'ABSTAIN');
  assert.equal(unresolved.reason, 'DEFINED_DATE_UNRESOLVED');
});

test('date machinery: period parse yields both legs on the two fixture period forms, PERIOD_DETECTED dispatch first', () => {
  const skechersPeriod = 'From the Capitalization Date to the date hereof';
  assert.equal(parseMeasurementDate({ quote: skechersPeriod }).outcome, 'PERIOD_DETECTED');
  const skechersResolved = parseMeasurementPeriod({
    quote: skechersPeriod,
    agreement_date: '2025-05-02',
    defined_dates: { 'Capitalization Date': '2025-05-02' },
  });
  assert.equal(skechersResolved.outcome, 'RESOLVED_PERIOD');
  assert.equal(skechersResolved.start.iso_date, '2025-05-02');
  assert.equal(skechersResolved.end.iso_date, '2025-05-02');
  assert.equal(skechersPeriod.slice(skechersResolved.start.start, skechersResolved.start.end), skechersResolved.start.matched_text);
  assert.equal(skechersPeriod.slice(skechersResolved.end.start, skechersResolved.end.end), skechersResolved.end.matched_text);

  const modivPeriod = 'Since the Capitalization Date through the date hereof';
  const modivResolved = parseMeasurementPeriod({
    quote: modivPeriod,
    agreement_date: '2026-05-01',
    defined_dates: { 'Capitalization Date': '2026-05-01' },
  });
  assert.equal(modivResolved.outcome, 'RESOLVED_PERIOD');
  assert.equal(modivResolved.start.iso_date, '2026-05-01');
  assert.equal(modivResolved.end.iso_date, '2026-05-01');
});

test('date machinery: PERIOD_ENDPOINT_UNRESOLVED when one endpoint is "the Closing Date" (still ungoverned)', () => {
  const result = parseMeasurementPeriod({
    quote: 'From the Capitalization Date to the Closing Date',
    defined_dates: { 'Capitalization Date': '2025-05-02' },
  });
  assert.equal(result.outcome, 'ABSTAIN');
  assert.equal(result.reason, 'PERIOD_ENDPOINT_UNRESOLVED');
  assert.equal(result.leg, 'end');
});

// ─── Additivity smoke check: quotes with no P2-shaped input classify
// byte-identically to v1 (no DISCLOSURE_SCHEDULE_CARVEOUT/PERFORMANCE_
// ASSUMPTION false positives on ordinary ACCURACY/THRESHOLD/KNOWLEDGE
// quotes). Full receipt-level additivity (mapping_table_version,
// contract_vocabulary_digest, resolution_receipt_id recomputation) is NOT
// exercised here -- that requires the registry/resolution-table wiring
// this pass deferred; see the delivery report. ───

test('additivity smoke check: ordinary ACCURACY/THRESHOLD/KNOWLEDGE quotes are unaffected by the P2 front doors', () => {
  assert.equal(classifyQualifierQuote({ quote: 'true and correct in all material respects' }).kind, 'ACCURACY');
  assert.equal(classifyQualifierQuote({ quote: 'material to the Company' }).kind, 'THRESHOLD');
  assert.equal(classifyQualifierQuote({ quote: 'to the knowledge of the Company' }).kind, 'KNOWLEDGE');
});
