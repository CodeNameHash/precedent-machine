/**
 * tests/canonical-v2-qualifier-kind-lexicon.test.js
 *
 * Task 2 of docs/superpowers/plans/2026-08-01-claim-identity-provenance-plan.md
 * against docs/superpowers/specs/2026-08-01-claim-identity-provenance-design.md
 * section "2. Deterministic qualifier-kind classifier".
 *
 * Every test below traces to a named requirement in the plan's Task 2
 * "Tests:" paragraph or the spec's own worked examples. Where the plan
 * asserts a KIND ("... classifies THRESHOLD", "trailing ACCURACY
 * classifies") the assertion is made against `lexiconKind` -- the
 * classifier's deterministic, lexicon-only answer -- rather than the
 * outcome envelope, because a null ACCURACY code independently routes a
 * would-be CLASSIFIED result to REVIEW (plan Task 2 item 5: "zero or
 * multiple matches -> code null (and review when the kind is ACCURACY)").
 * `lexiconKind` is present on every outcome variant precisely so callers
 * (and this test file) can inspect the deterministic answer regardless of
 * whether it also needs a human.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  QUALIFIER_KIND_LEXICON_VERSION,
  QUALIFIER_KINDS,
  QUALIFIER_KIND_DISAGREEMENT,
  QUALIFIER_KIND_UNCLASSIFIED,
  ACCURACY_CODES,
  ACCURACY_CODE_WHITELIST,
  findAllMarkerOccurrences,
  deriveAccuracyCode,
  applyExceptionConnectiveBinding,
  classifyQualifierQuote,
} = require('../lib/canonical-v2/native-producer/qualifier-kind-lexicon');

// ─── Version ───

test('QUALIFIER_KIND_LEXICON_VERSION is pinned at 4', () => {
  // P2 (docs/superpowers/specs/2026-08-02-p2-qualifier-kinds-design.md
  // section 1): 1 -> 2. Stage 3 (structural-inheritance-diagnosis.md;
  // Ben's never-alias materiality ruling): 2 -> 3 -- two qualifier-only
  // whitelist pairs and the MAE-qualifier idiom front door.
  // Step 2X-D / DECISIONS.md entry 14 (2026-08-08): 3 -> 4 -- revert the
  // MAT_MAE_AGGREGATE / MAT_MAE_QUALIFIED split; aggregate phrase classifies
  // as MAT_MAE_QUALIFIED.
  assert.equal(QUALIFIER_KIND_LEXICON_VERSION, 4);
});

test('QUALIFIER_KINDS enumerates the six families', () => {
  // P2 section 1: four -> six, frozen.
  assert.deepEqual(
    [...QUALIFIER_KINDS].sort(),
    ['ACCURACY', 'DISCLOSURE_SCHEDULE_CARVEOUT', 'KNOWLEDGE', 'PERFORMANCE_ASSUMPTION', 'TEMPORAL', 'THRESHOLD']
  );
});

// ─── The run-1/run-2 model-disagreement clause ───
// Motivating case from the spec header: the model classified this exact
// clause ACCURACY in run 1 and THRESHOLD in run 2. The lexicon must answer
// THRESHOLD both times, regardless of what the model says.

test('run-1/run-2 disagreement clause classifies THRESHOLD both times', () => {
  const quote = 'with a fair market value that is material to the Company and its Subsidiaries, taken as a whole';

  const run1 = classifyQualifierQuote({ quote, modelKind: 'ACCURACY' });
  assert.equal(run1.lexiconKind, 'THRESHOLD', 'lexicon answer must be stable regardless of the model hint');
  // ACCURACY is on one side of the disagreement (the model's claim), so
  // this is an ACCURACY-boundary doubt and must reach review.
  assert.equal(run1.outcome, 'REVIEW');
  assert.equal(run1.reason, QUALIFIER_KIND_DISAGREEMENT);

  const run2 = classifyQualifierQuote({ quote, modelKind: 'THRESHOLD' });
  assert.equal(run2.lexiconKind, 'THRESHOLD');
  assert.equal(run2.outcome, 'CLASSIFIED');
  assert.equal(run2.kind, 'THRESHOLD');
});

// ─── Exception-connective binding: single ACCURACY unit ───

test('"true and correct, except for inaccuracies that are not material ..." stays ONE ACCURACY unit', () => {
  const quote = 'true and correct, except for inaccuracies that are not material to the Company';
  const result = classifyQualifierQuote({ quote });
  // The THRESHOLD marker ("material to") sits inside the bound "except
  // for" clause and must never surface as a second, free-standing family.
  assert.equal(result.lexiconKind, 'ACCURACY');
  assert.notEqual(result.outcome, 'SPLIT');
  assert.deepEqual(result.families ?? ['ACCURACY'], ['ACCURACY']);
});

test('"true and correct, except as provided in Section X, in all material respects" closes the bound clause at the second comma; trailing ACCURACY classifies', () => {
  const quote = 'true and correct, except as provided in Section X, in all material respects';
  const binding = applyExceptionConnectiveBinding(quote);
  assert.equal(binding.boundClauses.length, 1);
  assert.equal(binding.boundClauses[0].clauseText, ' provided in Section X');
  assert.equal(binding.boundClauses[0].hasMarker, false, 'the bound clause itself carries no marker');

  const result = classifyQualifierQuote({ quote });
  assert.equal(result.lexiconKind, 'ACCURACY');
  assert.notEqual(result.outcome, 'SPLIT');
});

// ─── Nested "(other than ...)" inside "except for ...": innermost-first ───

test('nested "(other than ...)" inside "except for ..." binds innermost-first without breaking the outer scan', () => {
  const quote = 'true and correct, except for inaccuracies (other than immaterial items), in all respects';
  const binding = applyExceptionConnectiveBinding(quote);
  const outer = binding.boundClauses.find((bc) => bc.connective === 'except for');
  const inner = binding.boundClauses.find((bc) => bc.connective === 'other than');
  assert.ok(outer, 'outer "except for" connective must be found');
  assert.ok(inner, 'inner "other than" connective must be found');
  // The outer scan must thread straight through the nested parenthetical
  // and only close at the comma before "in all respects" (whose
  // continuation carries the ACCURACY marker).
  assert.equal(outer.clauseText, ' inaccuracies (other than immaterial items)');
  assert.equal(inner.clauseText, ' immaterial items');

  const result = classifyQualifierQuote({ quote });
  assert.equal(result.lexiconKind, 'ACCURACY');
  assert.notEqual(result.outcome, 'SPLIT');
});

// ─── "provided that" / "subject to": doubt rule, not auto-binding ───

test('"provided that" with markers on both sides routes by the doubt rule', () => {
  const quote = 'true and correct, provided that the Company has no obligation to pay any amount material to its business';
  const result = classifyQualifierQuote({ quote });
  assert.equal(result.outcome, 'REVIEW');
  assert.equal(result.reason, QUALIFIER_KIND_DISAGREEMENT);
  assert.ok(result.families.includes('ACCURACY'));
  assert.ok(result.families.includes('THRESHOLD'));
});

test('"subject to" is not an auto-binding connective', () => {
  const binding = applyExceptionConnectiveBinding('true and correct, subject to Section 3.2, in all respects');
  assert.equal(binding.boundClauses.length, 0);
});

// ─── Deterministic split ───

test('"... in all material respects as of the Closing Date" splits into ACCURACY + TEMPORAL, both parts byte-verified, inherited attachment', () => {
  const quote = 'true and correct in all material respects as of the Closing Date';
  const result = classifyQualifierQuote({ quote });
  assert.equal(result.outcome, 'SPLIT');
  // Spec §2 rule 3's worked example: EXACTLY two parts -- one merged
  // ACCURACY region, one TEMPORAL. Per-occurrence fragmentation (three
  // parts, none matching the code whitelist) was final-audit finding C1.
  assert.equal(result.parts.length, 2);
  assert.deepEqual(result.parts.map((p) => p.kind), ['ACCURACY', 'TEMPORAL']);
  const accuracyPart = result.parts[0];
  assert.equal(accuracyPart.code, 'MAT_ALL_MATERIAL',
    'the merged ACCURACY part must match the whole-part whitelist -- the slice headline capability');

  // Parts exactly partition the quote (no gap, no overlap, no drop).
  let cursor = 0;
  for (const part of result.parts) {
    assert.equal(part.start, cursor);
    assert.equal(quote.slice(part.start, part.end), part.text, 'every part must byte-verify against the source quote');
    cursor = part.end;
  }
  assert.equal(cursor, quote.length);

  const temporalPart = result.parts.find((p) => p.kind === 'TEMPORAL');
  assert.equal(temporalPart.measurementDateEligible, true, 'TEMPORAL split from an ACCURACY host is measurement-date eligible');
});

test('a three-family quote partitions pairwise, each part classifying alone', () => {
  const quote = 'to the knowledge of the Company, true and correct in all material respects, as of the date hereof';
  const result = classifyQualifierQuote({ quote });
  assert.equal(result.outcome, 'SPLIT');
  // One part per FAMILY region: adjacent same-family occurrences merge
  // (audit C1) -- three families, exactly three parts.
  const kinds = result.parts.map((p) => p.kind);
  assert.deepEqual(kinds, ['KNOWLEDGE', 'ACCURACY', 'TEMPORAL']);

  let cursor = 0;
  for (const part of result.parts) {
    assert.equal(part.start, cursor);
    assert.equal(quote.slice(part.start, part.end), part.text);
    cursor = part.end;
  }
  assert.equal(cursor, quote.length);

  const temporalPart = result.parts.find((p) => p.kind === 'TEMPORAL');
  assert.equal(
    temporalPart.measurementDateEligible,
    false,
    'TEMPORAL co-occurring with KNOWLEDGE anywhere in the quote is never measurement-date eligible'
  );
});

// ─── Measurement-date reachability, stated positively ───

test('"material to the Company as of the date hereof" — the TEMPORAL part does NOT reach the measurement-date mapping', () => {
  const quote = 'material to the Company as of the date hereof';
  const result = classifyQualifierQuote({ quote });
  assert.equal(result.outcome, 'SPLIT');
  const temporalPart = result.parts.find((p) => p.kind === 'TEMPORAL');
  assert.ok(temporalPart);
  assert.equal(temporalPart.measurementDateEligible, false);
});

test('"to the knowledge of the Company as of the date hereof" (round-2 finding 2) — the TEMPORAL part never reaches the measurement-date mapping', () => {
  const quote = 'to the knowledge of the Company as of the date hereof';
  const result = classifyQualifierQuote({ quote });
  assert.equal(result.outcome, 'SPLIT');
  const temporalPart = result.parts.find((p) => p.kind === 'TEMPORAL');
  assert.ok(temporalPart);
  assert.equal(temporalPart.measurementDateEligible, false);
});

test('"as of the date hereof" fires TEMPORAL via the symbolic list, whole-quote-alone eligible', () => {
  const result = classifyQualifierQuote({ quote: 'as of the date hereof' });
  assert.equal(result.outcome, 'CLASSIFIED');
  assert.equal(result.kind, 'TEMPORAL');
  assert.equal(result.measurementDateEligible, true);
});

test('a calendar date after "as of" also fires TEMPORAL', () => {
  const result = classifyQualifierQuote({ quote: 'as of April 17, 2026' });
  assert.equal(result.outcome, 'CLASSIFIED');
  assert.equal(result.kind, 'TEMPORAL');
  assert.equal(result.measurementDateEligible, true);
});

// ─── ITEM-attached ACCURACY: the classifier answers kind only ───

test('"correct and complete list of Company Options" fires ACCURACY; attachment-based rep-level routing is Task 3\'s job, not this classifier\'s', () => {
  const result = classifyQualifierQuote({ quote: 'correct and complete list of Company Options' });
  // This module takes no attachment-position input and returns no claim
  // definition -- it is deliberately unable to "resolve rep-level" on its
  // own. That an ITEM-attached ACCURACY qualifier never resolves to
  // REPRESENTATION_ACCURACY_STANDARD is enforced by Task 3's
  // GENERIC_CLAIM_KEY_RESOLUTION_TABLE ((QUALIFIER, ACCURACY, ITEM) ->
  // review queue), not here.
  assert.equal(result.lexiconKind, 'ACCURACY');
  assert.ok(!('claim_definition_key' in result));
  assert.ok(!('attachment_position' in result));
});

// ─── U+200E inside a marker phrase ───

test('U+200E inside a marker phrase still matches', () => {
  const quote = 'to the knowledge‎ of the Company';
  const occurrences = findAllMarkerOccurrences(
    require('../lib/canonical-v2/zero-width-normalise').normaliseForMatching(quote)
  );
  assert.equal(occurrences.length, 1);
  assert.equal(occurrences[0].family, 'KNOWLEDGE');

  const result = classifyQualifierQuote({ quote });
  assert.equal(result.outcome, 'CLASSIFIED');
  assert.equal(result.kind, 'KNOWLEDGE');
});

// ─── ACCURACY code whitelist ───

test('whitelist exact match derives the correct code, whole-quote matching', () => {
  assert.equal(deriveAccuracyCode('true and correct in all respects'), ACCURACY_CODES.MAT_ALL_RESPECTS);
  assert.equal(deriveAccuracyCode('true and correct in all material respects'), ACCURACY_CODES.MAT_ALL_MATERIAL);
});

test('whitelist non-match yields null code (whole-quote exact matching, no precedence)', () => {
  const deal_specific = 'true and correct in all material respects, subject to the exceptions described in the Disclosure Schedule';
  assert.equal(deriveAccuracyCode(deal_specific), null);

  // The classifier still recognises the ACCURACY family; it is only the
  // CODE that is unresolved -- and per plan Task 2 item 5, a null code on
  // an ACCURACY kind routes to review rather than silently minting a
  // codeless claim.
  const result = classifyQualifierQuote({ quote: deal_specific });
  assert.equal(result.lexiconKind, 'ACCURACY');
  assert.equal(result.outcome, 'REVIEW');
  assert.equal(result.reason, QUALIFIER_KIND_UNCLASSIFIED);
});

test('every ACCURACY_CODE_WHITELIST entry is a unique exact phrase mapped to a registered code', () => {
  const phrases = ACCURACY_CODE_WHITELIST.map((e) => e.phrase);
  assert.equal(new Set(phrases).size, phrases.length, 'whitelist phrases must be unique (whole-quote matching assumes at most one hit)');
  for (const entry of ACCURACY_CODE_WHITELIST) {
    assert.ok(Object.values(ACCURACY_CODES).includes(entry.code));
  }
});

// ─── Round-2 finding 1: the Securities Act carve-out binds through its interior comma ───

test('the run-2 Securities Act carve-out binds as ONE clause through its interior comma (round-2 finding 1)', () => {
  const quote =
    'true and correct, except for such transfer restrictions of general applicability as provided under the U.S. Securities Act of 1933, as amended (the “Securities Act”) or other applicable securities Laws.';
  const binding = applyExceptionConnectiveBinding(quote);
  const exceptFor = binding.boundClauses.find((bc) => bc.connective === 'except for');
  assert.ok(exceptFor);
  // The clause must run all the way to the end of the sentence -- NOT
  // truncate at the comma immediately after "1933" (the blocking bug the
  // spec's round-2 audit fixed).
  assert.equal(
    exceptFor.clauseText,
    ' such transfer restrictions of general applicability as provided under the U.S. Securities Act of 1933, as amended (the “Securities Act”) or other applicable securities Laws.'
  );

  const result = classifyQualifierQuote({ quote });
  // No marker lives inside that carve-out text at all, so the whole thing
  // still resolves to the single "true and correct" ACCURACY family — not
  // split by the interior comma.
  assert.equal(result.lexiconKind, 'ACCURACY');
  assert.notEqual(result.outcome, 'SPLIT');
});

// ─── List exceptions bind through their list commas ───

test('"except for X, Y and Z, the Company ..." list exceptions bind through their list commas', () => {
  const quote = 'except for Cash, Accounts Receivable and Inventory, the Company owns no other current assets.';
  const binding = applyExceptionConnectiveBinding(quote);
  assert.equal(binding.boundClauses.length, 1);
  // The clause must span through BOTH list commas ("Cash," and
  // "Inventory,") rather than truncating at the first one.
  assert.equal(binding.boundClauses[0].clauseText, ' Cash, Accounts Receivable and Inventory, the Company owns no other current assets.');
});

// ─── Hostless bound clause -> doubt rule ───

test('a hostless bound clause carrying a marker routes by the doubt rule', () => {
  const quote = 'the Company shall, except as the Board determines is material to the transaction, deliver the Report';
  const binding = applyExceptionConnectiveBinding(quote);
  assert.equal(binding.boundClauses.length, 1);
  assert.equal(binding.boundClauses[0].hostless, true);

  const result = classifyQualifierQuote({ quote });
  // Only THRESHOLD is implicated (no ACCURACY anywhere), so this is doubt
  // among non-ACCURACY families -> open world, not review.
  assert.equal(result.outcome, 'OPEN_WORLD');
});

test('"Except as set forth in the Disclosure Letter ..." carries no marker; binding is a no-op', () => {
  const quote = 'Except as set forth in the Disclosure Letter, the Company has good title to its assets';
  const binding = applyExceptionConnectiveBinding(quote);
  assert.equal(binding.boundClauses.length, 1);
  assert.equal(binding.boundClauses[0].hasMarker, false);
  assert.equal(binding.boundClauses[0].hostless, false, 'a markerless clause is a no-op, not a hostless doubt');

  const result = classifyQualifierQuote({ quote });
  assert.equal(result.outcome, 'OPEN_WORLD');
  assert.deepEqual(result.families, []);
});

// ─── Model-hint absence: null is abstention ───

test('null model kind is abstention: classification proceeds on the lexicon alone', () => {
  const withNullHint = classifyQualifierQuote({ quote: 'as of the Closing Date' });
  const withoutHintKeyAtAll = classifyQualifierQuote({ quote: 'as of the Closing Date', modelKind: undefined });
  assert.equal(withNullHint.lexiconKind, 'TEMPORAL');
  assert.equal(withoutHintKeyAtAll.lexiconKind, 'TEMPORAL');
  assert.equal(withNullHint.modelKind, null);
});

test('null model kind on a THRESHOLD-only fire classifies cleanly, no doubt', () => {
  const result = classifyQualifierQuote({ quote: 'material to the Company', modelKind: null });
  assert.equal(result.outcome, 'CLASSIFIED');
  assert.equal(result.kind, 'THRESHOLD');
});

// ─── Zero-family abstention ───

test('a quote with no marker at all is open world, not a crash', () => {
  const result = classifyQualifierQuote({ quote: 'The Company is a Delaware corporation.' });
  assert.equal(result.outcome, 'OPEN_WORLD');
  assert.equal(result.lexiconKind, null);
});

test('model claims ACCURACY while the lexicon abstains -> review with QUALIFIER_KIND_UNCLASSIFIED', () => {
  const result = classifyQualifierQuote({ quote: 'The Company is a Delaware corporation.', modelKind: 'ACCURACY' });
  assert.equal(result.outcome, 'REVIEW');
  assert.equal(result.reason, QUALIFIER_KIND_UNCLASSIFIED);
  assert.equal(result.lexiconKind, null);
});

// ─── KNOWLEDGE and THRESHOLD single-family sanity ───

test('a bare KNOWLEDGE marker classifies KNOWLEDGE', () => {
  const result = classifyQualifierQuote({ quote: 'to the knowledge of the Company' });
  assert.equal(result.outcome, 'CLASSIFIED');
  assert.equal(result.kind, 'KNOWLEDGE');
});

test('monetary and percentage THRESHOLD markers fire', () => {
  const monetary = classifyQualifierQuote({ quote: 'in excess of $1,000,000 individually' });
  assert.equal(monetary.lexiconKind, 'THRESHOLD');
  const percentage = classifyQualifierQuote({ quote: 'representing more than 5% of the outstanding shares' });
  assert.equal(percentage.lexiconKind, 'THRESHOLD');
  const deMinimis = classifyQualifierQuote({ quote: 'de minimis inaccuracies shall be disregarded' });
  assert.equal(deMinimis.lexiconKind, 'THRESHOLD');
});

// ─── Input validation ───

test('classifyQualifierQuote rejects a non-string quote', () => {
  assert.throws(() => classifyQualifierQuote({ quote: null }), TypeError);
});

test('classifyQualifierQuote rejects an unrecognised modelKind', () => {
  assert.throws(() => classifyQualifierQuote({ quote: 'true and correct', modelKind: 'NOT_A_KIND' }), TypeError);
});

// ─── Final-audit finding C1: depth-zero boundary enforcement ───

test('a comma inside a parenthetical never cuts a part: the TEMPORAL claim is never a mangled fragment', () => {
  const quote = 'true and correct in all material respects (as amended, restated) as of the Closing Date';
  const result = classifyQualifierQuote({ quote });
  assert.equal(result.outcome, 'SPLIT');
  assert.equal(result.parts.length, 2);
  const temporalPart = result.parts.find((p) => p.kind === 'TEMPORAL');
  // The depth-1 comma inside "(as amended, restated)" must not become a
  // boundary: the parenthetical residue stays with the ACCURACY host, and
  // the TEMPORAL part is the clean date clause -- never " restated) as of...".
  assert.equal(temporalPart.text.trim(), 'as of the Closing Date');
  const accuracyPart = result.parts.find((p) => p.kind === 'ACCURACY');
  assert.ok(accuracyPart.text.includes('(as amended, restated)'),
    'the parenthetical residue stays with the host part');
  // The polluted ACCURACY part must NOT match the whitelist (no nearest-fit).
  assert.equal(accuracyPart.code, null);

  let cursor = 0;
  for (const part of result.parts) {
    assert.equal(part.start, cursor);
    assert.equal(quote.slice(part.start, part.end), part.text);
    cursor = part.end;
  }
  assert.equal(cursor, quote.length);
});

// ═══════════════════════════════════════════════════════════════════════
// Stage 3 (lexicon version 3): qualifier-only whitelist pairs and the
// MAE-qualifier idiom front door. Real quotes from the committed Red Hat
// REPRESENTATIONS run (evidence/canonical-v2/redhat-representations-
// 20260808-r1/run-receipt.json), not invented shapes.
// ═══════════════════════════════════════════════════════════════════════

test('Stage 3: the two qualifier-only materiality phrases classify with SEPARATE codes, never aliased (Ben ruling 1)', () => {
  const allMaterial = classifyQualifierQuote({ quote: 'in all material respects', modelKind: 'ACCURACY' });
  assert.equal(allMaterial.outcome, 'CLASSIFIED');
  assert.equal(allMaterial.kind, 'ACCURACY');
  assert.equal(allMaterial.code, 'MAT_ALL_MATERIAL');

  const anyMaterial = classifyQualifierQuote({ quote: 'in any material respect', modelKind: 'ACCURACY' });
  assert.equal(anyMaterial.outcome, 'CLASSIFIED');
  assert.equal(anyMaterial.kind, 'ACCURACY');
  assert.equal(anyMaterial.code, 'MAT_MATERIAL_INLINE');
  assert.notEqual(anyMaterial.code, allMaterial.code, 'the two phrases must never share a code');
});

test('Stage 3 / Step 2X-D: the MAE-qualifier idiom front door classifies Red Hat chapeau and item forms as MAT_MAE_QUALIFIED (aggregate phrase is not a separate code)', () => {
  // Justified edit (Step 2X-D): Stage 3 asserted MAT_MAE_AGGREGATE for the
  // "individually or in the aggregate" form. Ben's 2026-08-08 reversal
  // (DECISIONS.md entry 14) treats that phrase as a drafting variant of
  // MAT_MAE_QUALIFIED — same legal standard, same code.
  const chapeau = classifyQualifierQuote({
    quote: 'Except for matters that would not reasonably be expected to have, individually or in the aggregate, a Material Adverse Effect',
    modelKind: 'ACCURACY',
  });
  assert.equal(chapeau.outcome, 'CLASSIFIED');
  assert.equal(chapeau.kind, 'ACCURACY');
  assert.equal(chapeau.code, 'MAT_MAE_QUALIFIED');

  const item = classifyQualifierQuote({
    quote: 'would not reasonably be expected to have, individually or in the aggregate, a Material Adverse Effect',
    modelKind: null,
  });
  assert.equal(item.outcome, 'CLASSIFIED');
  assert.equal(item.code, 'MAT_MAE_QUALIFIED');

  const bare = classifyQualifierQuote({
    quote: 'except as would not reasonably be expected to have a Material Adverse Effect',
    modelKind: null,
  });
  assert.equal(bare.outcome, 'CLASSIFIED');
  assert.equal(bare.code, 'MAT_MAE_QUALIFIED', 'bare and aggregate forms share MAT_MAE_QUALIFIED');
});

test('Step 2X-D pin: "individually or in the aggregate" MAE idiom classifies as MAT_MAE_QUALIFIED (DECISIONS.md entry 14, Ben 2026-08-08)', () => {
  // Pins the reversal explicitly: the aggregate drafting variant must not
  // emit MAT_MAE_AGGREGATE from the V2 lexicon.
  const result = classifyQualifierQuote({
    quote: 'would not reasonably be expected to have, individually or in the aggregate, a Material Adverse Effect',
    modelKind: 'ACCURACY',
  });
  assert.equal(result.outcome, 'CLASSIFIED');
  assert.equal(result.kind, 'ACCURACY');
  assert.equal(result.code, 'MAT_MAE_QUALIFIED');
  assert.equal(
    Object.prototype.hasOwnProperty.call(ACCURACY_CODES, 'MAT_MAE_AGGREGATE'),
    false,
    'MAT_MAE_AGGREGATE must not be emittable from ACCURACY_CODES',
  );
});

test('Stage 3 HOSTILE: the affirmative MAE form never classifies through the idiom door, and a longer quote merely CONTAINING the idiom never front-door classifies', () => {
  // Affirmative ("would reasonably be expected to have") is a different
  // legal assertion from the negative tolerance -- must not classify here.
  const affirmative = classifyQualifierQuote({
    quote: 'that would reasonably be expected to have, individually or in the aggregate, a Material Adverse Effect',
    modelKind: 'ACCURACY',
  });
  assert.notEqual(affirmative.outcome, 'CLASSIFIED');

  // Whole-quote anchoring: extra operative content around the idiom must
  // fall through to the ordinary pipeline, never match the door.
  const embedded = classifyQualifierQuote({
    quote: 'the Company shall have performed its obligations except as would not reasonably be expected to have a Material Adverse Effect',
    modelKind: null,
  });
  assert.notEqual(embedded.outcome === 'CLASSIFIED' && embedded.code === 'MAT_MAE_QUALIFIED', true);
});

test('Stage 3 HOSTILE: a definite non-ACCURACY model hint on a front-door ACCURACY fire still routes to review, never overridden', () => {
  const result = classifyQualifierQuote({ quote: 'in all material respects', modelKind: 'KNOWLEDGE' });
  assert.equal(result.outcome, 'REVIEW');
  assert.equal(result.reason, QUALIFIER_KIND_DISAGREEMENT);
});
