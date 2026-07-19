const test = require('node:test');
const assert = require('node:assert/strict');

const {
  reconstructReviewDeal,
  buildDefinitionsIndex,
  resolveCardReferences,
} = require('../../lib/queries/reconstruct-review-deal');
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
// sections/definitions/region_full_text must be indistinguishable from the
// untrimmed shape. resolvedReferences is NO LONGER part of
// reconstructReviewDeal's output (perf fix, see reconstruct-review-deal.js's
// header comment) — it's resolved separately, on demand, via
// buildDefinitionsIndex/resolveCardReferences (covered below).
test('trim + reconstruct round-trips to the same sections/definitions, region_full_text', () => {
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

  // reconstructReviewDeal itself must NOT attach resolvedReferences/
  // unresolvedReferences (that's the whole point of the fix).
  for (const card of rebuilt.cards) {
    assert.equal(card.resolvedReferences, undefined);
    assert.equal(card.unresolvedReferences, undefined);
  }

  assert.deepEqual(
    rebuilt.sections.map((s) => s.sectionRef),
    original.sections.map((s) => s.sectionRef),
  );
  assert.equal(rebuilt.definitions.length, original.definitions.length);

  const rebuiltDef = rebuilt.cards.find((c) => c.provision_instance_id === 'def-mae');
  assert.equal(rebuiltDef.region_full_text, rebuiltDef.primary_quote);

  // On-demand resolution (what ProvisionCardTable's hover preview now calls)
  // still reproduces exactly what the old eager pass computed.
  const definitionsById = buildDefinitionsIndex(rebuilt.cards);
  const rebuiltCovenant = rebuilt.cards.find((c) => c.provision_instance_id === 'ioc-mae');
  const originalCovenant = original.cards.find((c) => c.provision_instance_id === 'ioc-mae');
  const resolved = resolveCardReferences(rebuiltCovenant, definitionsById);
  assert.deepEqual(resolved.resolvedReferences, originalCovenant.resolvedReferences);
  assert.deepEqual(resolved.unresolvedReferences, originalCovenant.unresolvedReferences);
});

// PERF REGRESSION test: reconstructReviewDeal must be O(n) — independent of
// how many definitions exist or how many references each cross-reference
// card carries. Cox-scale-and-then-some: 443 definitions (each with a
// multi-KB defined_value, matching real MAE-style definitions), 626 cards,
// a third of which cross-reference 8 definitions apiece — this is the exact
// shape that measured 13.9s DOMContentLoaded before the fix.
test('reconstructReviewDeal stays fast (no resolvedReferences pass) at Cox-adversarial scale', () => {
  const BIG_DEFINITION_TEXT = 'means, with respect to any Person, any event, change, effect, occurrence, fact, condition, development or circumstance '.repeat(60); // ~7.5KB
  const DEF_COUNT = 443;
  const CARD_COUNT = 626;
  const defs = Array.from({ length: DEF_COUNT }, (_, i) => baseRow({
    id: `def-${i}`, provision_instance_id: `def-${i}`, kind: 'definition',
    section_ref: 'Article I', short_title: `Term ${i}`, defined_term: `Term ${i}`,
    defined_value: BIG_DEFINITION_TEXT, offset: i,
  }));
  const rows = Array.from({ length: CARD_COUNT - DEF_COUNT }, (_, i) => baseRow({
    id: `card-${i}`, provision_instance_id: `card-${i}`,
    kind: i % 3 === 0 ? 'cross-reference' : 'standard',
    section_ref: `Section ${1 + (i % 40)}.0${1 + (i % 9)}`, short_title: `Provision ${i}`,
    primary_quote: 'clause text',
    references: i % 3 === 0 ? Array.from({ length: 8 }, (_, j) => `def-${(i + j) % DEF_COUNT}`) : [],
    offset: 1000 + i,
  }));
  const shaped = shapeReviewDealRows('deal-cox', [...defs, ...rows]);
  const trimmed = JSON.parse(JSON.stringify(trimReviewDealForWire(shaped)));

  const t0 = process.hrtime.bigint();
  const rebuilt = reconstructReviewDeal(trimmed);
  const elapsedMs = Number(process.hrtime.bigint() - t0) / 1e6;

  assert.equal(rebuilt.cards.length, CARD_COUNT);
  assert.equal(rebuilt.definitions.length, DEF_COUNT);
  // Generous CI-safe ceiling — this ran in under 5ms in local profiling; the
  // regression it's guarding against took 13,900ms in production.
  assert.ok(elapsedMs < 500, `reconstructReviewDeal took ${elapsedMs.toFixed(1)}ms — must stay O(n), no resolvedReferences pass`);
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

// Regression guard for the merge with origin/main's FIX 9
// (fetchReviewDealCards started also returning reviewDeal.transactionSteps
// — structure-mechanics.config.js reads it to render multi-step mergers).
// trimReviewDealForWire's allowlist must not silently drop it.
test('trimReviewDealForWire passes transactionSteps through unchanged', () => {
  const shaped = shapeReviewDealRows('deal-1', [baseRow()]);
  const withSteps = { ...shaped, transactionSteps: [{ id: 'step-1', step_order: 1, kind: 'merger' }, { id: 'step-2', step_order: 2, kind: 'merger' }] };
  const trimmed = trimReviewDealForWire(withSteps);
  assert.deepEqual(trimmed.transactionSteps, withSteps.transactionSteps);

  const rebuilt = reconstructReviewDeal(JSON.parse(JSON.stringify(trimmed)));
  assert.deepEqual(rebuilt.transactionSteps, withSteps.transactionSteps);
});

test('trimReviewDealForWire omits transactionSteps when absent (no stray key)', () => {
  const shaped = shapeReviewDealRows('deal-1', [baseRow()]);
  const trimmed = trimReviewDealForWire(shaped);
  assert.equal('transactionSteps' in trimmed, false);
});

// DOM-parity regression (caught in Playwright hover verification against
// real Cox data, post-perf-fix): a card whose references are ALL dangling
// (point at a definition id that doesn't exist — pruned/renamed) must
// resolve to zero resolvedReferences, same as the old eager pass. This is
// what components/review/useDefinitionResolver.js's getResolvableCount
// gates the "N definitions" badge on — using card.references.length there
// instead would surface a badge for a card that previously rendered none
// at all.
test('resolveCardReferences returns zero resolvedReferences for an all-dangling-references card', () => {
  const card = baseRow({
    id: 'orphan', provision_instance_id: 'orphan', kind: 'cross-reference',
    references: ['missing-def-1', 'missing-def-2'],
  });
  const definitionsById = buildDefinitionsIndex([card]); // no definition cards at all
  const resolved = resolveCardReferences(card, definitionsById);
  assert.equal(resolved.resolvedReferences.length, 0);
  assert.deepEqual(resolved.unresolvedReferences, ['missing-def-1', 'missing-def-2']);
});

test('resolveCardReferences returns only the resolvable subset for a mixed resolved/dangling card', () => {
  const def = baseRow({ id: 'def-1', provision_instance_id: 'def-1', kind: 'definition', defined_term: 'Term' });
  const card = baseRow({
    id: 'mixed', provision_instance_id: 'mixed', kind: 'cross-reference',
    references: ['def-1', 'missing-def'],
  });
  const definitionsById = buildDefinitionsIndex([def, card]);
  const resolved = resolveCardReferences(card, definitionsById);
  assert.equal(resolved.resolvedReferences.length, 1);
  assert.equal(resolved.resolvedReferences[0].provision_instance_id, 'def-1');
  assert.deepEqual(resolved.unresolvedReferences, ['missing-def']);
});
