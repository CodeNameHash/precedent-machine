const test = require('node:test');
const assert = require('node:assert/strict');

const {
  enforceCardModelInvariants,
  assertFieldGroups,
  looksSerializedObjectText,
} = require('../../../lib/schema/card-model');

function baseCard(overrides = {}) {
  const regionFullText = 'SECTION 3.14. Litigation. There is no Proceeding pending except as would not have a Company Material Adverse Effect.';
  return {
    provisionType: 'REPRESENTATION',
    provisionSubtype: 'LITIGATION',
    sectionRef: 'Section 3.14',
    shortTitle: 'Litigation',
    partyScope: 'COMPANY',
    regionId: '00000000-0000-0000-0000-000000003014',
    regionFullText,
    regionHash: 'hash',
    primaryQuoteStart: 25,
    primaryQuoteEnd: regionFullText.length,
    primaryQuote: regionFullText.slice(25),
    fieldGroups: [
      { name: 'primary', displayOrder: 1, isCollapsedByDefault: false },
      { name: 'qualifiers', displayOrder: 2, isCollapsedByDefault: false },
      { name: 'cross_refs', displayOrder: 3, isCollapsedByDefault: false },
      { name: 'metadata', displayOrder: 4, isCollapsedByDefault: true },
    ],
    crossReferences: [
      {
        refKind: 'DEFINED_TERM',
        refText: 'Company Material Adverse Effect',
        sourceSpanStart: 76,
        sourceSpanEnd: 107,
        resolutionStatus: 'UNRESOLVED',
        displayOrder: 1,
      },
    ],
    childTables: {
      representation_mae_subclauses: [
        {
          subclause_ref: '(a)',
          is_mae_qualified: true,
          source_span_start: 68,
          source_span_end: regionFullText.length,
          verbatim_quote: regionFullText.slice(68),
          display_order: 1,
        },
      ],
    },
    extractedBy: 'CODEX',
    extractionVersion: 'card-v1',
    ...overrides,
  };
}

test('card model invariant accepts a minimal valid representation card', () => {
  assert.equal(enforceCardModelInvariants(baseCard(), { parserRegionText: baseCard().regionFullText }), true);
});

test('card model invariant rejects parser-region truncation', () => {
  const card = baseCard({ regionFullText: 'SECTION 3.14. Litigation.' });
  assert.throws(
    () => enforceCardModelInvariants(card, { parserRegionText: baseCard().regionFullText }),
    /region_full_text/i,
  );
});

test('card model invariant rejects fabricated primary quote', () => {
  const card = baseCard({ primaryQuote: 'fabricated' });
  assert.throws(() => enforceCardModelInvariants(card), /primary_quote quote fidelity/i);
});

test('card model invariant rejects fabricated child-table quote', () => {
  const card = baseCard();
  card.childTables.representation_mae_subclauses[0].verbatim_quote = 'fabricated';
  assert.throws(() => enforceCardModelInvariants(card), /verbatim_quote quote fidelity/i);
});

test('card model invariant rejects two primary groups', () => {
  const groups = [
    { name: 'primary', displayOrder: 1 },
    { name: 'primary', displayOrder: 2 },
  ];
  assert.throws(() => assertFieldGroups(groups, 'REPRESENTATION'), /exactly one primary/i);
});

test('card model invariant rejects display-order gaps', () => {
  const groups = [
    { name: 'primary', displayOrder: 1 },
    { name: 'metadata', displayOrder: 3 },
  ];
  assert.throws(() => assertFieldGroups(groups, 'REPRESENTATION'), /no gaps/i);
});

test('card model invariant rejects serialized object text', () => {
  assert.equal(looksSerializedObjectText('[object Object]'), true);
  assert.equal(looksSerializedObjectText('{"a":1}'), true);
  assert.throws(() => enforceCardModelInvariants(baseCard({ reviewNotes: '[object Object]' })), /serialized object/i);
});

test('card model invariant rejects missing party scope for meaningful provision types', () => {
  const card = baseCard({ partyScope: null });
  assert.throws(() => enforceCardModelInvariants(card), /requires party_scope/i);
});
