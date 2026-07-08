const test = require('node:test');
const assert = require('node:assert/strict');

const {
  compareDeal,
  dedupeLegacyCells,
  isRecitalLegacyCell,
  legacyCells,
  parserRegionLocated,
  suppressedRecitalsMarkdown,
  suppressedUnlocatedMarkdown,
} = require('../scripts/audit/schema-parity');

const deal = { id: 'deal-1', acquirer: 'Buyer', target: 'Target' };

function provision(overrides = {}) {
  return {
    id: overrides.id || 'prov-1',
    type: overrides.type || 'STRUCT',
    category: overrides.category || 'The Merger',
    full_text: overrides.full_text || 'The merger shall occur at the effective time.',
  };
}

function card(overrides = {}) {
  const quote = overrides.primary_quote || overrides.region_full_text || 'The merger shall occur at the effective time.';
  return {
    id: overrides.id || 'card-1',
    provision_type: overrides.provision_type || 'STRUCTURE_MECHANICS',
    section_ref: overrides.section_ref || '1.1',
    short_title: overrides.short_title || 'The Merger',
    defined_term: overrides.defined_term || null,
    primary_quote: quote,
    region_full_text: overrides.region_full_text || quote,
    kind: overrides.kind || 'standard',
  };
}

test('recital legacy cells are suppressed, not counted as missing schema cards', () => {
  const result = compareDeal({
    deal,
    provisions: [
      provision({
        id: 'recital-1',
        type: 'DEF',
        category: 'General Definitions Section',
        full_text: 'WHEREAS, the parties desire to effect the Merger upon the terms set forth herein.',
      }),
    ],
    cards: [],
  });

  assert.equal(result.diffs.length, 0);
  assert.equal(result.suppressedRecitals.length, 1);
  assert.equal(result.suppressedRecitals[0].category, 'recital_user_hidden');
});

test('recital detection is conservative for ordinary definition text', () => {
  const [cell] = legacyCells([
    provision({
      type: 'DEF',
      category: 'Acquisition Proposal',
      full_text: 'Acquisition Proposal means any offer or proposal relating to a merger.',
    }),
  ]);

  assert.equal(isRecitalLegacyCell(cell), false);
});

test('schema comparison uses user-mode card shaping', () => {
  const result = compareDeal({
    deal,
    provisions: [provision({ category: '[PROPOSED] The Merger' })],
    cards: [
      card({ short_title: '[PROPOSED] The Merger' }),
      card({
        id: 'uncovered',
        short_title: 'Uncovered text - The Merger',
        primary_quote: 'Coverage-only text.',
      }),
    ],
  });

  assert.deepEqual(result.diffs, []);
  assert.equal(result.schemaCellCount, 1);
});

test('legacy STRUCT provisions compare to STRUCTURE_MECHANICS cards', () => {
  const result = compareDeal({
    deal,
    provisions: [provision({ type: 'STRUCT' })],
    cards: [card({ provision_type: 'STRUCTURE_MECHANICS' })],
  });

  assert.deepEqual(result.diffs, []);
});

test('legacy OTHER provisions compare to MISC_BOILERPLATE cards', () => {
  const result = compareDeal({
    deal,
    provisions: [provision({ type: 'OTHER', category: 'Effect of Termination' })],
    cards: [card({ provision_type: 'MISC_BOILERPLATE', short_title: 'Effect of Termination' })],
  });

  assert.deepEqual(result.diffs, []);
});

test('timing agreements title is equivalent to no inconsistent action for antitrust cards', () => {
  const quote = 'The parties shall not enter into a timing agreement without consent.';
  const result = compareDeal({
    deal,
    provisions: [provision({ type: 'ANTI', category: 'Timing Agreements', full_text: quote })],
    cards: [card({ provision_type: 'ANTITRUST_REGULATORY', short_title: 'No Inconsistent Action', primary_quote: quote })],
  });

  assert.deepEqual(result.diffs, []);
});

test('duplicate legacy cells with the same quote and type compare once', () => {
  const quote = 'The same source span appears under two legacy labels.';
  const duplicateProvisions = [
    provision({ id: 'a', type: 'ANTI', category: 'Timing Agreements', full_text: quote }),
    provision({ id: 'b', type: 'ANTI', category: 'No Inconsistent Action', full_text: quote }),
  ];
  const result = compareDeal({
    deal,
    provisions: duplicateProvisions,
    cards: [card({ provision_type: 'ANTITRUST_REGULATORY', short_title: 'No Inconsistent Action', primary_quote: quote })],
  });

  assert.deepEqual(result.diffs, []);
  assert.equal(dedupeLegacyCells(legacyCells(duplicateProvisions)).length, 1);
});

test('unlocated legacy rows are suppressed from missing-card parity diffs', () => {
  const result = compareDeal({
    deal,
    provisions: [provision({ full_text: 'This orphaned legacy text is not in any parser region.' })],
    cards: [],
    parserRegions: [{ raw_text: 'A different source-backed parser region.' }],
  });

  assert.equal(result.diffs.length, 0);
  assert.equal(result.suppressedUnlocated.length, 1);
  assert.equal(result.suppressedUnlocated[0].category, 'legacy_unlocated');
});

test('parserRegionLocated matches normalized parser region text', () => {
  assert.equal(parserRegionLocated(
    { quote: 'The Company’s stockholders approved the merger.' },
    [{ raw_text: 'the companys stockholders approved the merger' }],
  ), true);
  assert.equal(parserRegionLocated(
    { quote: 'This orphaned legacy text is not in any parser region.' },
    [{ raw_text: 'A different source-backed parser region.' }],
  ), false);
});

test('suppressed recital markdown records the audit rationale', () => {
  const markdown = suppressedRecitalsMarkdown([
    {
      suppressedRecitals: [
        {
          deal: 'Buyer / Target',
          section: 'DEF',
          field: 'General Definitions Section',
          legacy: 'WHEREAS, the parties desire to effect the Merger.',
          rationale: 'Recital provision retained for audit/admin treatment, hidden from user-mode review parity.',
        },
      ],
    },
  ], '2026-07-08T00:00:00.000Z');

  assert.equal(markdown.includes('recital provisions for audit/admin purposes'), true);
  assert.match(markdown, /recital_user_hidden|Recital provision retained/);
});

test('suppressed unlocated markdown records the source-anchoring rationale', () => {
  const markdown = suppressedUnlocatedMarkdown([
    {
      suppressedUnlocated: [
        {
          deal: 'Buyer / Target',
          section: 'DEF',
          field: 'General Definitions Section',
          legacy: 'This orphaned legacy text is not in any parser region.',
          rationale: 'Legacy provision text cannot be located in parser regions.',
        },
      ],
    },
  ], '2026-07-08T00:00:00.000Z');

  assert.equal(markdown.includes('source-anchored parser regions'), true);
  assert.match(markdown, /Legacy provision text cannot be located/);
});
