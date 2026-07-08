const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildFeaturesForCard,
  claimOrder,
  groupClaimsByExcerpt,
} = require('../../lib/queries/claims-adapter');

function claim(overrides = {}) {
  return {
    id: overrides.id || 'claim-1',
    deal_id: 'deal-1',
    excerpt_id: overrides.excerpt_id || 'card-1:0',
    provision_instance_id: overrides.provision_instance_id || 'card-1',
    region_id: overrides.region_id || null,
    attribute: overrides.attribute,
    verbatim: overrides.verbatim ?? null,
    evidence_quote: overrides.evidence_quote ?? null,
    canonical: overrides.canonical ?? null,
    provenance: overrides.provenance || {},
    source_provision_id: overrides.source_provision_id || null,
    created_at: overrides.created_at || '2026-07-08T00:00:00.000Z',
    ...overrides,
  };
}

test('groupClaimsByExcerpt groups by excerpt_id and ignores rows without one', () => {
  const claims = [
    claim({ id: 'a', excerpt_id: 'card-1:0', attribute: 'effortsStandard' }),
    claim({ id: 'b', excerpt_id: 'card-2:0', attribute: 'effortsStandard' }),
    claim({ id: 'c', excerpt_id: null, attribute: 'effortsStandard' }),
  ];
  const grouped = groupClaimsByExcerpt(claims);
  assert.equal(grouped.size, 2);
  assert.equal(grouped.get('card-1:0').length, 1);
  assert.equal(grouped.get('card-2:0').length, 1);
});

test('MAE carve-outs (list + tag) rebuild as an array of tagged claims, one per row, in claim order', () => {
  const claims = [
    claim({
      id: 'c3',
      attribute: 'carveouts',
      canonical: 'PANDEMIC',
      verbatim: 'pandemic or other public health crisis',
      evidence_quote: 'except for any pandemic or other public health crisis affecting the industry generally',
      created_at: '2026-07-08T00:00:02.000Z',
    }),
    claim({
      id: 'c1',
      attribute: 'carveouts',
      canonical: 'ECONOMY_GENERAL',
      verbatim: 'general changes in the economy',
      evidence_quote: 'general changes in the United States or global economy generally',
      created_at: '2026-07-08T00:00:00.000Z',
    }),
    // Canonical is often null on the claims table — exercise the
    // synonym-based fallback (normalizeToCode against MAE_CARVEOUT_META).
    claim({
      id: 'c2',
      attribute: 'carveouts',
      canonical: null,
      verbatim: 'changes in applicable law after the date hereof',
      evidence_quote: 'changes in applicable Law or the interpretation thereof after the date of this Agreement',
      created_at: '2026-07-08T00:00:01.000Z',
    }),
  ];

  const features = buildFeaturesForCard(claims);
  assert.ok(Array.isArray(features.carveouts), 'carveouts must be an array, not collapsed to one item');
  assert.equal(features.carveouts.length, 3, 'all three carve-out rows must survive the rebuild');

  // Order follows claim order (created_at), not insertion order into the fixture array.
  assert.deepEqual(features.carveouts.map((item) => item.code), [
    'ECONOMY_GENERAL',
    'CHANGE_IN_LAW',
    'PANDEMIC',
  ]);

  for (const item of features.carveouts) {
    assert.equal(typeof item.code, 'string');
    assert.equal(typeof item.label, 'string');
    assert.ok(item.label.length > 0);
    // Codes must never surface raw where a friendly label is available.
    assert.notEqual(item.label, item.code);
    assert.equal(typeof item.text, 'string');
    assert.ok(Array.isArray(item.quotes) && item.quotes.length === 1);
  }

  const lawItem = features.carveouts.find((item) => item.code === 'CHANGE_IN_LAW');
  assert.equal(lawItem.quotes[0], 'changes in applicable Law or the interpretation thereof after the date of this Agreement');
});

test('scalar enum attribute (effortsStandard) resolves to a single tagged object, not an array', () => {
  const claims = [
    claim({
      attribute: 'effortsStandard',
      canonical: 'REASONABLE_BEST_EFFORTS',
      verbatim: 'reasonable best efforts',
      evidence_quote: 'Company shall use its reasonable best efforts to consummate the Merger',
    }),
  ];
  const features = buildFeaturesForCard(claims);
  assert.equal(Array.isArray(features.effortsStandard), false);
  assert.equal(features.effortsStandard.code, 'REASONABLE_BEST_EFFORTS');
  assert.equal(features.effortsStandard.label, 'Reasonable best efforts');
  assert.deepEqual(features.effortsStandard.quotes, ['Company shall use its reasonable best efforts to consummate the Merger']);
});

test('plain string/boolean scalar attributes are left as raw primitives (not wrapped)', () => {
  const claims = [
    claim({ attribute: 'mainConcept', verbatim: 'Material Adverse Effect' }),
    claim({ attribute: 'preventDelayProng', verbatim: 'true' }),
  ];
  const features = buildFeaturesForCard(claims);
  assert.equal(features.mainConcept, 'Material Adverse Effect');
  assert.equal(features.preventDelayProng, true);
});

test('an attribute with no claims never appears in the rebuilt features object', () => {
  const features = buildFeaturesForCard([
    claim({ attribute: 'effortsStandard', canonical: 'BEST_EFFORTS', verbatim: 'best efforts' }),
  ]);
  assert.equal('carveouts' in features, false);
  assert.equal('litigationObligation' in features, false);
});

test('claimOrder sorts by created_at then id as a stable tiebreak', () => {
  const a = claim({ id: 'a', created_at: '2026-07-08T00:00:01.000Z' });
  const b = claim({ id: 'b', created_at: '2026-07-08T00:00:00.000Z' });
  const c = claim({ id: 'c', created_at: '2026-07-08T00:00:00.000Z' });
  assert.deepEqual([a, b, c].sort(claimOrder).map((x) => x.id), ['b', 'c', 'a']);
});
