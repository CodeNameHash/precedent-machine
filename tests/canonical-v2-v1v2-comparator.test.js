'use strict';

/**
 * tests/canonical-v2-v1v2-comparator.test.js
 *
 * Unit tests for lib/canonical-v2/native-producer/v1v2-comparator.js against
 * hand-built (synthetic) v1_snapshot/v2_side fixtures -- Tier 1 outcome
 * routing, Tier 2 value comparison, determinism, and the section-ref parse
 * rule. The REAL-DATA fixture acceptance test (TopBuild REP-T-CAP vs the
 * F28 third live run) lives in
 * tests/canonical-v2-v1v2-comparator-wiring.test.js, alongside the wiring
 * tests against candidate-resolution.js.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { canonicalJson } = require('../lib/canonical-v2/canonical-bytes');
const {
  V1_PROVISION_SNAPSHOT_SCHEMA,
  V1V2_COMPARISON_RECEIPT_SCHEMA,
  FAMILY_MAPPING_TABLE,
  FAMILY_MAPPING_TABLE_VERSION,
  VALUE_MAPPING_TABLE,
  VALUE_MAPPING_TABLE_VERSION,
  parseV1SectionRef,
  candidateComparisonString,
  buildV1V2ComparisonReceipt,
  isComparisonReceiptStale,
  V1V2ComparatorError,
} = require('../lib/canonical-v2/native-producer/v1v2-comparator');

function snapshot({ cards, dealMaxExtractionVersion = 'v1', dealId = 'deal-uuid-1', governedDealKey = 'deal:test:1' }) {
  return Object.freeze({
    schema_version: V1_PROVISION_SNAPSHOT_SCHEMA,
    snapshot_id: 'snapshot-id-1',
    deal_identity_bridge: Object.freeze({ production_deal_id: dealId, governed_deal_key: governedDealKey }),
    deal_max_extraction_version: dealMaxExtractionVersion,
    cards: Object.freeze(cards),
  });
}

function v1Card({
  id, provisionSubtype = 'REP-T-CAP', sectionRef = '3.1(b) | Capitalization | abc123',
  primaryQuote = 'the quoted text', regionHash = 'region-hash-1', extractionVersion = 'v1', values = undefined,
}) {
  const card = {
    id, provision_type: 'REPRESENTATION', provision_subtype: provisionSubtype, section_ref: sectionRef,
    primary_quote: primaryQuote, region_hash: regionHash, extraction_version: extractionVersion,
  };
  if (values) card.values = values;
  return Object.freeze(card);
}

// Minimal `resolved[]`-shaped entry -- only the fields buildV2Provisions/
// computeTier2 actually read.
function v2ResolvedEntry({
  provisionInstanceId, conceptKey, party = { role: 'REPRESENTATION_MAKER', value: 'the Company', capacity: 'TARGET' },
  resolvedClaimDefinitionKey = 'REPRESENTATION_MEASUREMENT_DATE', canonicalValue = '2026-04-18',
  normalizedCitation = '3.1(b)', validationSource = 'CORROBORATED_BY_DOCUMENT_TEXT', derivedCitation = 'III-INTRO(b)',
}) {
  return Object.freeze({
    concept_key: conceptKey,
    party,
    resolved_claim_definition_key: resolvedClaimDefinitionKey,
    provision_instance: Object.freeze({ provision_instance_id: provisionInstanceId }),
    claim: Object.freeze({ canonical_value: canonicalValue }),
    compiled_candidate: Object.freeze({
      citation_validation: Object.freeze({
        status: 'ok', accepted: true, validation_source: validationSource,
        model_citation: normalizedCitation, normalized_citation: normalizedCitation, derived_citation: derivedCitation,
      }),
    }),
  });
}

function v2Side({ resolved = [], openWorld = [] } = {}) {
  return Object.freeze({
    resolved: Object.freeze(resolved), review_queue: Object.freeze([]), open_world: Object.freeze(openWorld),
    residuals: Object.freeze([]), limb_component_trees: Object.freeze([]),
    resolution_receipt: Object.freeze({ schema_version: 'NATIVE_CANDIDATE_RESOLUTION_RECEIPT/V1' }),
  });
}

// ─── parseV1SectionRef (spec's pinned rule). ───

test('parseV1SectionRef: text before the first " | ", trimmed, leading "Section " stripped, case-preserved', () => {
  assert.equal(parseV1SectionRef('3.1(b) | Capitalization; Subsidiaries | eb1b1ba8d39b'), '3.1(b)');
  assert.equal(parseV1SectionRef('Section 3.1(b) | Capitalization'), '3.1(b)');
  assert.equal(parseV1SectionRef('  Section 3.1(b)  | x'), '3.1(b)');
  assert.equal(parseV1SectionRef('SECTION 3.1(b) | x'), 'SECTION 3.1(b)', 'only a literal leading "Section " (capital S) is stripped -- case-preserving, no case-insensitive match');
  assert.equal(parseV1SectionRef('no delimiter here'), 'no delimiter here');
  assert.equal(parseV1SectionRef('   '), null, 'blank after trim does not parse');
  assert.equal(parseV1SectionRef(''), null);
  assert.equal(parseV1SectionRef(null), null);
  assert.equal(parseV1SectionRef(42), null);
});

// ─── candidateComparisonString (audit M1 pinning). ───

test('candidateComparisonString: corroborated normalized_citation wins over derived_citation; falls back to derived_citation otherwise', () => {
  assert.equal(candidateComparisonString({
    validation_source: 'CORROBORATED_BY_DOCUMENT_TEXT', normalized_citation: '3.1(b)', derived_citation: 'III-INTRO(b)',
  }), '3.1(b)');
  assert.equal(candidateComparisonString({
    validation_source: 'CONSTRUCTED_FROM_TREE', normalized_citation: '3.1(b)', derived_citation: 'III-INTRO(b)',
  }), 'III-INTRO(b)', 'not corroborated -> derived_citation, never normalized_citation');
  assert.equal(candidateComparisonString(null), null);
  assert.equal(candidateComparisonString({}), null);
});

// ─── Tier 1 outcome routing. ───

test('Tier 1: V1V2_PRESENCE_AGREEMENT when the v1 card\'s parsed section equals the v2 provision\'s pinned comparison string', () => {
  const v1 = snapshot({ cards: [v1Card({ id: 'card-1' })] });
  const v2 = v2Side({ resolved: [v2ResolvedEntry({ provisionInstanceId: 'prov-1', conceptKey: 'REP-T-CAP' })] });
  const receipt = buildV1V2ComparisonReceipt({ v1_snapshot: v1, v2_side: v2, attempted_section_scope: ['3.1(b)'] });
  assert.equal(receipt.schema_version, V1V2_COMPARISON_RECEIPT_SCHEMA);
  assert.equal(receipt.provision_outcomes.length, 1);
  assert.equal(receipt.provision_outcomes[0].outcome, 'V1V2_PRESENCE_AGREEMENT');
  assert.equal(receipt.provision_outcomes[0].v2_provision_instance_id, 'prov-1');
  assert.equal(receipt.attempted_section_scope.length, 1);
  assert.equal(receipt.attempted_section_scope[0], '3.1(b)');
});

test('Tier 1: V2_NOT_ATTEMPTED when the v1 card\'s family/section is outside the run\'s DECLARED attempted scope entirely', () => {
  // A DIFFERENT family (REP-T-ORG, no v2 provision anywhere this run) at a
  // section the run never touched -- distinct from SECTION_MISMATCH, which
  // is for the SAME family found at a DIFFERENT section. Scope is declared
  // explicitly by the caller ('3.1(b)' only) and does NOT include '3.1(a)'.
  const v1 = snapshot({
    cards: [v1Card({ id: 'card-1', provisionSubtype: 'REP-T-ORG', sectionRef: '3.1(a) | Organization | x' })],
  });
  const v2 = v2Side({ resolved: [v2ResolvedEntry({ provisionInstanceId: 'prov-1', conceptKey: 'REP-T-CAP' })] });
  const receipt = buildV1V2ComparisonReceipt({ v1_snapshot: v1, v2_side: v2, attempted_section_scope: ['3.1(b)'] });
  // Two records: the v1 card's own V2_NOT_ATTEMPTED, plus the reverse-pass
  // V1_MISSING for v2's REP-T-CAP provision (this snapshot has no REP-T-CAP
  // card at all -- a distinct, deliberate finding, not a bug).
  assert.equal(receipt.provision_outcomes.length, 2);
  const orgOutcome = receipt.provision_outcomes.find((entry) => entry.v1_card_id === 'card-1');
  assert.equal(orgOutcome.outcome, 'V2_NOT_ATTEMPTED');
  assert.equal(orgOutcome.v2_provision_instance_id, null);
  const capOutcome = receipt.provision_outcomes.find((entry) => entry.concept_key === 'REP-T-CAP');
  assert.equal(capOutcome.outcome, 'V1_MISSING');
});

test('Tier 1: V2_MISSING when the v1 card\'s family has no v2 provision but its section IS inside the run\'s DECLARED attempted scope', () => {
  // Attempted scope includes "3.1(a)" via the caller's OWN declaration --
  // the run reached and processed that section, but v1's REP-T-ORG card
  // there never turned into a v2 REP-T-ORG provision (no family entry maps
  // to a v2 provision at that section). The open_world candidate is kept
  // here purely to exercise `observed_section_strings` (diagnostic only,
  // never consulted for this outcome -- see the DECLARED-scope test below
  // for the case where it disagrees with the derived set entirely).
  const v1 = snapshot({
    cards: [v1Card({ id: 'card-1', provisionSubtype: 'REP-T-ORG', sectionRef: '3.1(a) | Organization | x' })],
  });
  const openWorldEntry = Object.freeze({
    citation_validation: Object.freeze({
      status: 'ok', accepted: true, validation_source: 'CORROBORATED_BY_DOCUMENT_TEXT',
      model_citation: '3.1(a)', normalized_citation: '3.1(a)', derived_citation: 'III-INTRO(a)',
    }),
  });
  const v2 = v2Side({ resolved: [], openWorld: [openWorldEntry] });
  const receipt = buildV1V2ComparisonReceipt({ v1_snapshot: v1, v2_side: v2, attempted_section_scope: ['3.1(a)'] });
  assert.deepEqual(receipt.attempted_section_scope, ['3.1(a)']);
  assert.deepEqual(receipt.observed_section_strings, ['3.1(a)'], 'diagnostic derived set, not consulted for the outcome below');
  assert.equal(receipt.provision_outcomes.length, 1);
  assert.equal(receipt.provision_outcomes[0].outcome, 'V2_MISSING');
});

test('Tier 1: V2_MISSING (total-extraction-failure case) when the declared attempted_section_scope names a section with ZERO v2 candidates ANYWHERE (not even open_world) and a v1 card sits there', () => {
  // The declared scope is the ONLY reason this routes V2_MISSING instead of
  // V2_NOT_ATTEMPTED: v2_side carries no candidate at all for '3.1(a)' --
  // not resolved, not open_world -- so observed_section_strings would say
  // "never touched". The caller's own declaration that it attempted this
  // section is what correctly surfaces this as a total extraction failure.
  const v1 = snapshot({
    cards: [v1Card({ id: 'card-1', provisionSubtype: 'REP-T-ORG', sectionRef: '3.1(a) | Organization | x' })],
  });
  const v2 = v2Side({ resolved: [], openWorld: [] });
  const receipt = buildV1V2ComparisonReceipt({ v1_snapshot: v1, v2_side: v2, attempted_section_scope: ['3.1(a)'] });
  assert.deepEqual(receipt.observed_section_strings, [], 'the derived set saw nothing at all for this section');
  assert.equal(receipt.provision_outcomes.length, 1);
  assert.equal(receipt.provision_outcomes[0].outcome, 'V2_MISSING', 'declared scope, not the (empty) derived set, decides the split');
});

test('Tier 1: SECTION_MISMATCH when both sides found the same family at DIFFERENT sections', () => {
  const v1 = snapshot({ cards: [v1Card({ id: 'card-1', sectionRef: '3.1(b) | Capitalization | x' })] });
  const v2 = v2Side({
    resolved: [v2ResolvedEntry({
      provisionInstanceId: 'prov-1', conceptKey: 'REP-T-CAP', normalizedCitation: '3.2(a)', derivedCitation: 'III-INTRO(z)',
    })],
  });
  const receipt = buildV1V2ComparisonReceipt({ v1_snapshot: v1, v2_side: v2, attempted_section_scope: ['3.1(b)'] });
  assert.equal(receipt.provision_outcomes.length, 1);
  assert.equal(receipt.provision_outcomes[0].outcome, 'SECTION_MISMATCH');
  assert.equal(receipt.provision_outcomes[0].v1_section, '3.1(b)');
  assert.equal(receipt.provision_outcomes[0].v2_section, '3.2(a)');
});

test('Tier 1: V1_CARD_UNMAPPED for a null/unrecognised provision_subtype, and for a section_ref that fails to parse', () => {
  const v1 = snapshot({
    cards: [
      v1Card({ id: 'card-1', provisionSubtype: null }),
      v1Card({ id: 'card-2', provisionSubtype: 'REP-T-SOME-NEW-FAMILY-NEVER-SEEN' }),
      v1Card({ id: 'card-3', sectionRef: '   ' }),
    ],
  });
  const receipt = buildV1V2ComparisonReceipt({ v1_snapshot: v1, v2_side: v2Side(), attempted_section_scope: ['3.1(b)'] });
  assert.equal(receipt.provision_outcomes.length, 3);
  assert.ok(receipt.provision_outcomes.every((entry) => entry.outcome === 'V1_CARD_UNMAPPED'));
  const byCardId = new Map(receipt.provision_outcomes.map((entry) => [entry.v1_card_id, entry]));
  assert.equal(byCardId.get('card-1').reason, 'SUBTYPE_UNMAPPED');
  assert.equal(byCardId.get('card-2').reason, 'SUBTYPE_UNMAPPED');
  assert.equal(byCardId.get('card-3').reason, 'SECTION_REF_NOT_PARSEABLE');
});

test('Tier 1: V1_MISSING when v2 found a provision whose family has NO v1 card at all (in the whole snapshot)', () => {
  const v1 = snapshot({ cards: [v1Card({ id: 'card-1', provisionSubtype: 'REP-T-ORG', sectionRef: '3.1(a) | Org | x' })] });
  const v2 = v2Side({ resolved: [v2ResolvedEntry({ provisionInstanceId: 'prov-1', conceptKey: 'REP-T-CAP' })] });
  const receipt = buildV1V2ComparisonReceipt({ v1_snapshot: v1, v2_side: v2, attempted_section_scope: ['3.1(b)'] });
  const capOutcome = receipt.provision_outcomes.find((entry) => entry.concept_key === 'REP-T-CAP');
  assert.equal(capOutcome.outcome, 'V1_MISSING');
  assert.equal(capOutcome.v2_provision_instance_id, 'prov-1');
  assert.equal(capOutcome.v1_card_id, null);
});

test('FAMILY_MAPPING_TABLE: every entry is a real (v1_provision_subtype, concept_key) pair; no fuzzy matching', () => {
  assert.ok(Array.isArray(FAMILY_MAPPING_TABLE) && FAMILY_MAPPING_TABLE.length > 0);
  assert.equal(typeof FAMILY_MAPPING_TABLE_VERSION, 'number');
  assert.ok(Object.isFrozen(FAMILY_MAPPING_TABLE));
  for (const entry of FAMILY_MAPPING_TABLE) {
    assert.ok(Object.isFrozen(entry));
    assert.equal(typeof entry.v1_provision_subtype, 'string');
    assert.equal(typeof entry.concept_key, 'string');
  }
  const capEntry = FAMILY_MAPPING_TABLE.find((entry) => entry.v1_provision_subtype === 'REP-T-CAP');
  assert.ok(capEntry, 'REP-T-CAP is the one grounded, verified mapping');
  assert.equal(capEntry.concept_key, 'REP-T-CAP');
});

// ─── Tier 2 value comparison. ───

test('Tier 2: V1V2_VALUE_AGREEMENT, VALUE_MISMATCH (both values reported), and V1_VALUE_ABSENT', () => {
  const mappingEntry = VALUE_MAPPING_TABLE.find((entry) => entry.concept_key === 'TERMF-TARGET');
  assert.ok(mappingEntry, 'a TERMF-TARGET value-mapping entry exists for this test to exercise');

  function scenario(v1Values, v2CanonicalValue) {
    const v1 = snapshot({
      cards: [v1Card({
        id: 'card-1', provisionSubtype: 'TERMF-TARGET', sectionRef: '8.3(a) | Fee | x', values: v1Values,
      })],
    });
    const v2 = v2Side({
      resolved: [v2ResolvedEntry({
        provisionInstanceId: 'prov-1', conceptKey: 'TERMF-TARGET',
        resolvedClaimDefinitionKey: mappingEntry.claim_definition_key, canonicalValue: v2CanonicalValue,
        normalizedCitation: '8.3(a)', derivedCitation: 'VIII-3(a)',
      })],
    });
    return buildV1V2ComparisonReceipt({ v1_snapshot: v1, v2_side: v2, attempted_section_scope: ['8.3(a)'] });
  }

  const agree = scenario({ [mappingEntry.v1_value_field]: '3.0' }, '3.0');
  assert.equal(agree.value_outcomes.length, 1);
  assert.equal(agree.value_outcomes[0].outcome, 'V1V2_VALUE_AGREEMENT');

  const mismatch = scenario({ [mappingEntry.v1_value_field]: '3.0' }, '4.5');
  assert.equal(mismatch.value_outcomes.length, 1);
  assert.equal(mismatch.value_outcomes[0].outcome, 'VALUE_MISMATCH');
  assert.equal(mismatch.value_outcomes[0].v1_value, '3.0');
  assert.equal(mismatch.value_outcomes[0].v2_value, '4.5');

  const absent = scenario({}, '3.0');
  assert.equal(absent.value_outcomes.length, 1);
  assert.equal(absent.value_outcomes[0].outcome, 'V1_VALUE_ABSENT');
});

test('Tier 2 never runs on a SECTION_MISMATCH outcome -- "the dangerous one; always review", never a value comparison', () => {
  const mappingEntry = VALUE_MAPPING_TABLE.find((entry) => entry.concept_key === 'TERMF-TARGET');
  const v1 = snapshot({
    cards: [v1Card({
      id: 'card-1', provisionSubtype: 'TERMF-TARGET', sectionRef: '8.3(a) | Fee | x',
      values: { [mappingEntry.v1_value_field]: '3.0' },
    })],
  });
  const v2 = v2Side({
    resolved: [v2ResolvedEntry({
      provisionInstanceId: 'prov-1', conceptKey: 'TERMF-TARGET',
      resolvedClaimDefinitionKey: mappingEntry.claim_definition_key, canonicalValue: '3.0',
      normalizedCitation: '9.9(z)', derivedCitation: 'IX-9(z)',
    })],
  });
  const receipt = buildV1V2ComparisonReceipt({ v1_snapshot: v1, v2_side: v2, attempted_section_scope: ['8.3(a)'] });
  assert.equal(receipt.provision_outcomes[0].outcome, 'SECTION_MISMATCH');
  assert.equal(receipt.value_outcomes.length, 0, 'no Tier 2 outcome minted for a SECTION_MISMATCH provision');
});

test('VALUE_MAPPING_TABLE: frozen, versioned, every entry names a concept_key/claim_definition_key/v1_value_field', () => {
  assert.ok(Object.isFrozen(VALUE_MAPPING_TABLE));
  assert.equal(typeof VALUE_MAPPING_TABLE_VERSION, 'number');
  for (const entry of VALUE_MAPPING_TABLE) {
    assert.ok(Object.isFrozen(entry));
    assert.equal(typeof entry.concept_key, 'string');
    assert.equal(typeof entry.claim_definition_key, 'string');
    assert.equal(typeof entry.v1_value_field, 'string');
  }
});

// ─── quote_probe -- advisory only, never load-bearing. ───

test('quote_probe: NOT_ATTEMPTED with no v2_canonical_text; MATCHED/NOT_MATCHED (zero-width tolerant) when supplied, never changes the Tier 1 outcome', () => {
  const v1 = snapshot({ cards: [v1Card({ id: 'card-1', primaryQuote: 'the quoted te​xt' })] });
  const v2 = v2Side({ resolved: [v2ResolvedEntry({ provisionInstanceId: 'prov-1', conceptKey: 'REP-T-CAP' })] });

  const noProbe = buildV1V2ComparisonReceipt({ v1_snapshot: v1, v2_side: v2, attempted_section_scope: ['3.1(b)'] });
  assert.equal(noProbe.quote_probe[0].result, 'NOT_ATTEMPTED');
  assert.equal(noProbe.provision_outcomes[0].outcome, 'V1V2_PRESENCE_AGREEMENT');

  const matched = buildV1V2ComparisonReceipt({
    v1_snapshot: v1, v2_side: v2, attempted_section_scope: ['3.1(b)'], v2_canonical_text: 'preamble ... the quoted text ... tail',
  });
  assert.equal(matched.quote_probe[0].result, 'MATCHED');
  assert.equal(matched.provision_outcomes[0].outcome, 'V1V2_PRESENCE_AGREEMENT', 'quote_probe never changes the section-string outcome');

  const notMatched = buildV1V2ComparisonReceipt({
    v1_snapshot: v1, v2_side: v2, attempted_section_scope: ['3.1(b)'], v2_canonical_text: 'completely unrelated document text',
  });
  assert.equal(notMatched.quote_probe[0].result, 'NOT_MATCHED');
  assert.equal(notMatched.provision_outcomes[0].outcome, 'V1V2_PRESENCE_AGREEMENT', 'still never changes the outcome');
});

// ─── Determinism (spec Acceptance). ───

test('determinism: identical inputs produce a byte-identical receipt', () => {
  const v1 = snapshot({
    cards: [
      v1Card({ id: 'card-1' }),
      v1Card({ id: 'card-2', provisionSubtype: 'REP-T-ORG', sectionRef: '3.1(a) | Organization | x' }),
    ],
  });
  const v2 = v2Side({ resolved: [v2ResolvedEntry({ provisionInstanceId: 'prov-1', conceptKey: 'REP-T-CAP' })] });
  const first = buildV1V2ComparisonReceipt({ v1_snapshot: v1, v2_side: v2, attempted_section_scope: ['3.1(b)'] });
  const second = buildV1V2ComparisonReceipt({ v1_snapshot: v1, v2_side: v2, attempted_section_scope: ['3.1(b)'] });
  assert.equal(canonicalJson(first), canonicalJson(second));
  assert.equal(first.v1v2_comparison_receipt_id, second.v1v2_comparison_receipt_id);
});

test('determinism: v1 card order permutation invariant (same set, different array order -> byte-identical receipt)', () => {
  const cardA = v1Card({ id: 'card-1' });
  const cardB = v1Card({ id: 'card-2', provisionSubtype: 'REP-T-ORG', sectionRef: '3.1(a) | Organization | x' });
  const cardC = v1Card({ id: 'card-3', provisionSubtype: 'REP-T-AUTH', sectionRef: '3.1(c) | Authority | x' });
  const v2 = v2Side({ resolved: [v2ResolvedEntry({ provisionInstanceId: 'prov-1', conceptKey: 'REP-T-CAP' })] });

  const forward = buildV1V2ComparisonReceipt({ v1_snapshot: snapshot({ cards: [cardA, cardB, cardC] }), v2_side: v2, attempted_section_scope: ['3.1(b)'] });
  const shuffled = buildV1V2ComparisonReceipt({ v1_snapshot: snapshot({ cards: [cardC, cardA, cardB] }), v2_side: v2, attempted_section_scope: ['3.1(b)'] });

  // provision_outcomes is derived by iterating v1Cards in array order, so a
  // permuted INPUT array can (correctly) produce a permuted OUTPUT array --
  // "permutation invariant" is proven by comparing as SETS (every field
  // canonicalised), not by raw array equality.
  const normalise = (receipt) => [...receipt.provision_outcomes].map((entry) => canonicalJson(entry)).sort();
  assert.deepEqual(normalise(forward), normalise(shuffled));
  assert.deepEqual(forward.attempted_section_scope, shuffled.attempted_section_scope);
  assert.deepEqual(forward.counts, shuffled.counts);
});

// ─── Staleness rule (audit M4). ───

test('isComparisonReceiptStale: EQUALITY, not ordering -- any change to the pinned extraction_version invalidates', () => {
  const pinned = { deal_max_extraction_version: 'm2-00-corpus-backfill-v1' };
  assert.equal(isComparisonReceiptStale({ snapshot: pinned, current_deal_max_extraction_version: 'm2-00-corpus-backfill-v1' }), false);
  assert.equal(isComparisonReceiptStale({ snapshot: pinned, current_deal_max_extraction_version: 'm2-01-reprocess-v2' }), true);
  // Not a numeric/lexical ordering check: a lexicographically SMALLER label
  // still counts as stale, because extraction_version is an opaque tag, not
  // a monotonic version number.
  assert.equal(isComparisonReceiptStale({ snapshot: pinned, current_deal_max_extraction_version: 'a-earlier-label' }), true);
});

// ─── Input validation. ───

test('buildV1V2ComparisonReceipt rejects a malformed v1_snapshot or v2_side', () => {
  assert.throws(() => buildV1V2ComparisonReceipt({ v1_snapshot: null, v2_side: v2Side(), attempted_section_scope: ['3.1(b)'] }), V1V2ComparatorError);
  assert.throws(() => buildV1V2ComparisonReceipt({
    v1_snapshot: { ...snapshot({ cards: [] }), schema_version: 'WRONG/V1' }, v2_side: v2Side(), attempted_section_scope: ['3.1(b)'],
  }), V1V2ComparatorError);
  assert.throws(() => buildV1V2ComparisonReceipt({ v1_snapshot: snapshot({ cards: [] }), v2_side: null, attempted_section_scope: ['3.1(b)'] }), V1V2ComparatorError);
  assert.throws(() => buildV1V2ComparisonReceipt({
    v1_snapshot: snapshot({ cards: [{ id: 'x' }] }), v2_side: v2Side(), attempted_section_scope: ['3.1(b)'],
  }), V1V2ComparatorError, 'a card missing required fields (section_ref etc.) fails validation');
});

test('buildV1V2ComparisonReceipt rejects a missing/malformed attempted_section_scope', () => {
  const v1 = snapshot({ cards: [] });
  assert.throws(() => buildV1V2ComparisonReceipt({ v1_snapshot: v1, v2_side: v2Side() }), V1V2ComparatorError, 'missing entirely');
  assert.throws(() => buildV1V2ComparisonReceipt({ v1_snapshot: v1, v2_side: v2Side(), attempted_section_scope: 'not-an-array' }), V1V2ComparatorError);
  assert.throws(() => buildV1V2ComparisonReceipt({ v1_snapshot: v1, v2_side: v2Side(), attempted_section_scope: ['3.1(b)', ''] }), V1V2ComparatorError, 'an empty-string entry is not a valid drafted-section string');
  assert.throws(() => buildV1V2ComparisonReceipt({ v1_snapshot: v1, v2_side: v2Side(), attempted_section_scope: ['3.1(b)', null] }), V1V2ComparatorError);
  assert.doesNotThrow(() => buildV1V2ComparisonReceipt({ v1_snapshot: v1, v2_side: v2Side(), attempted_section_scope: ['3.1(b)'] }));
});
