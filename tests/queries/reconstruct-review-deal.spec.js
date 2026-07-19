const test = require('node:test');
const assert = require('node:assert/strict');

const { reconstructReviewDeal } = require('../../lib/queries/reconstruct-review-deal');
const { shapeReviewDealRows } = require('../../lib/queries/review-deal');
const { trimReviewDealForWire } = require('../../lib/queries/review-deal-wire');

function baseRow(overrides = {}) {
  return {
    id: overrides.id || 'row-1',
    deal_id: 'deal-1',
    provision_instance_id: overrides.provision_instance_id || overrides.id || 'card-1',
    excerpt_id: `${overrides.provision_instance_id || overrides.id || 'card-1'}:0`,
    section_ref: overrides.section_ref || 'Section 1.01',
    short_title: overrides.short_title || 'Test card',
    kind: overrides.kind || 'standard',
    defined_term: overrides.defined_term || null,
    defined_value: overrides.defined_value || null,
    primary_quote: overrides.primary_quote || 'the quoted text',
    region_full_text: overrides.region_full_text !== undefined ? overrides.region_full_text : (overrides.primary_quote || 'the quoted text'),
    references: overrides.references || [],
    provenance: {
      source_doc_id: 'doc-1',
      source_doc_page: 1,
      source_doc_offset_start: overrides.offset ?? 0,
      source_doc_offset_end: (overrides.offset ?? 0) + 10,
      extractor_name: 'parser-v2',
      extractor_version: 'test',
      model: 'test',
      run_id: 'run-1',
    },
    ...overrides,
  };
}

// End-to-end: build a reviewDeal the way fetchReviewDealCards would, trim it
// the way the API route does, then reconstruct it the way the client does —
// the result must be indistinguishable from the untrimmed shape.
test('trim + reconstruct round-trips to the same sections/definitions/resolvedReferences', () => {
  const def = baseRow({
    id: 'def-mae', provision_instance_id: 'def-mae', kind: 'definition',
    section_ref: 'Article I', short_title: 'MAE', defined_term: 'Material Adverse Effect',
    defined_value: 'means a bad thing', offset: 10,
  });
  const covenant = baseRow({
    id: 'ioc-mae', provision_instance_id: 'ioc-mae', kind: 'cross-reference',
    section_ref: 'Section 6.01', short_title: 'Conduct of Business',
    references: ['def-mae', 'missing-def'], offset: 100,
  });

  const original = shapeReviewDealRows('deal-1', [def, covenant]);
  const trimmed = trimReviewDealForWire(original);

  // Trim actually removed the fields it claims to.
  assert.equal(trimmed.sections, undefined);
  assert.equal(trimmed.definitions, undefined);
  for (const card of trimmed.cards) {
    assert.equal(card.region_full_text, undefined, 'region_full_text should be omitted (identical to primary_quote)');
    assert.equal(card.resolvedReferences, undefined);
    assert.equal(card.unresolvedReferences, undefined);
    assert.deepEqual(Object.keys(card.provenance).sort(), ['source_doc_offset_end', 'source_doc_offset_start']);
  }

  const rebuilt = reconstructReviewDeal(JSON.parse(JSON.stringify(trimmed)));

  assert.deepEqual(
    rebuilt.sections.map((s) => s.sectionRef),
    original.sections.map((s) => s.sectionRef),
  );
  assert.equal(rebuilt.definitions.length, original.definitions.length);

  const rebuiltCovenant = rebuilt.cards.find((c) => c.provision_instance_id === 'ioc-mae');
  const originalCovenant = original.cards.find((c) => c.provision_instance_id === 'ioc-mae');
  assert.deepEqual(rebuiltCovenant.resolvedReferences, originalCovenant.resolvedReferences);
  assert.deepEqual(rebuiltCovenant.unresolvedReferences, originalCovenant.unresolvedReferences);

  const rebuiltDef = rebuilt.cards.find((c) => c.provision_instance_id === 'def-mae');
  assert.equal(rebuiltDef.region_full_text, rebuiltDef.primary_quote);
});

test('divergent region_full_text is shipped on the wire and survives reconstruction', () => {
  const row = baseRow({
    id: 'weird', provision_instance_id: 'weird', primary_quote: 'short quote',
    region_full_text: 'the WIDER clause region, not identical to the quote',
  });
  const original = shapeReviewDealRows('deal-1', [row]);
  const trimmed = trimReviewDealForWire(original);
  const card = trimmed.cards[0];
  assert.equal(card.region_full_text, 'the WIDER clause region, not identical to the quote');

  const rebuilt = reconstructReviewDeal(JSON.parse(JSON.stringify(trimmed)));
  assert.equal(rebuilt.cards[0].region_full_text, 'the WIDER clause region, not identical to the quote');
});

test('reconstructReviewDeal is a no-op when sections/definitions are already present', () => {
  const shaped = shapeReviewDealRows('deal-1', [baseRow()]);
  const result = reconstructReviewDeal(shaped);
  assert.equal(result, shaped);
});

test('reconstructReviewDeal tolerates null/empty input', () => {
  assert.equal(reconstructReviewDeal(null), null);
  assert.deepEqual(reconstructReviewDeal({ cards: [] }).sections, []);
  assert.deepEqual(reconstructReviewDeal({ cards: [] }).definitions, []);
});

// Q1 acceptance criterion: cards API response must fit comfortably under the
// 300KB gz budget even at Metsera scale. Synthesize a Metsera-scale fixture
// (~2,000 cards, each carrying a realistic primary_quote + a handful of
// resolved-reference-worthy cross-references) and assert the trimmed wire
// payload gzips well under budget.
test('trimmed cards payload stays under the 300KB gz budget at Metsera scale', () => {
  const zlib = require('node:zlib');
  const CARD_COUNT = 2000;
  const LOREM = 'the parties hereto agree that this provision shall be interpreted in accordance with the terms set forth herein and shall not be construed to limit any other rights or remedies available under applicable law '.repeat(3);

  const defs = Array.from({ length: 40 }, (_, i) => baseRow({
    id: `def-${i}`, provision_instance_id: `def-${i}`, kind: 'definition',
    section_ref: 'Article I', short_title: `Defined Term ${i}`,
    defined_term: `Defined Term ${i}`, defined_value: LOREM, offset: i,
  }));
  const rows = Array.from({ length: CARD_COUNT - defs.length }, (_, i) => baseRow({
    id: `card-${i}`, provision_instance_id: `card-${i}`,
    kind: i % 5 === 0 ? 'cross-reference' : 'standard',
    section_ref: `Section ${1 + (i % 30)}.0${1 + (i % 9)}`,
    short_title: `Provision ${i}`,
    primary_quote: LOREM,
    references: i % 5 === 0 ? [`def-${i % 40}`] : [],
    offset: 1000 + i,
  }));

  const shaped = shapeReviewDealRows('deal-metsera', [...defs, ...rows]);
  const trimmed = trimReviewDealForWire(shaped);
  const gz = zlib.gzipSync(Buffer.from(JSON.stringify({ reviewDeal: trimmed }), 'utf8'));

  assert.ok(gz.length <= 300 * 1024, `expected <=300KB gz, got ${(gz.length / 1024).toFixed(1)}KB`);
});
