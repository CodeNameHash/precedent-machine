const test = require('node:test');
const assert = require('node:assert/strict');

const { CLAIMS_SELECT, reshapeNarrowClaimRow, fetchDealClaims } = require('../../lib/queries/review-deal');
const { buildFeaturesForCard, groupClaimsByExcerpt } = require('../../lib/queries/claims-adapter');
const { FEATURES } = require('../../lib/schema/features');

test('CLAIMS_SELECT only asks for columns the adapter reads, plus provenance->feature_value', () => {
  assert.doesNotMatch(CLAIMS_SELECT, /(^|,\s*)\*/, 'must not select *');
  for (const col of ['id', 'deal_id', 'excerpt_id', 'attribute', 'canonical', 'evidence_quote', 'verbatim']) {
    assert.ok(CLAIMS_SELECT.includes(col), `missing column ${col}`);
  }
  assert.ok(CLAIMS_SELECT.includes('provenance->feature_value'));
  // Bulky provenance sub-fields the adapter never reads should not be
  // requested individually.
  assert.doesNotMatch(CLAIMS_SELECT, /extractor_name|prompt_hash|run_id/);
});

test('reshapeNarrowClaimRow re-nests the flat feature_value column back under provenance.feature_value', () => {
  const row = { id: 'c1', deal_id: 'd1', excerpt_id: 'e1', attribute: 'foo', canonical: 'FOO', evidence_quote: 'q', verbatim: 'v', feature_value: { code: 'FOO', label: 'Foo' } };
  const reshaped = reshapeNarrowClaimRow(row);
  assert.deepEqual(reshaped.provenance, { feature_value: { code: 'FOO', label: 'Foo' } });
  assert.equal(reshaped.feature_value, undefined);
  assert.equal(reshaped.attribute, 'foo');
});

test('reshapeNarrowClaimRow defaults to null feature_value when the column is absent', () => {
  const reshaped = reshapeNarrowClaimRow({ id: 'c1', attribute: 'bar' });
  assert.deepEqual(reshaped.provenance, { feature_value: null });
});

test('end-to-end: a narrowed+reshaped claim row still round-trips through buildFeaturesForCard identically to a full claims row', () => {
  const fullRow = {
    id: 'c1', deal_id: 'd1', excerpt_id: 'e1', attribute: 'mergerForm', canonical: 'ONE_STEP_MERGER',
    evidence_quote: 'the Merger shall be effected as a one-step merger', verbatim: 'one-step merger',
    provenance: { feature_value: { code: 'ONE_STEP_MERGER', label: 'One-step merger', text: 'one-step merger' }, extractor_name: 'parser-v2', run_id: 'run-1' },
  };
  const narrowedRow = reshapeNarrowClaimRow({
    id: 'c1', deal_id: 'd1', excerpt_id: 'e1', attribute: 'mergerForm', canonical: 'ONE_STEP_MERGER',
    evidence_quote: 'the Merger shall be effected as a one-step merger', verbatim: 'one-step merger',
    feature_value: { code: 'ONE_STEP_MERGER', label: 'One-step merger', text: 'one-step merger' },
  });

  const fullGrouped = groupClaimsByExcerpt([fullRow]);
  const narrowGrouped = groupClaimsByExcerpt([narrowedRow]);
  const fullFeatures = buildFeaturesForCard(fullGrouped.get('e1'));
  const narrowFeatures = buildFeaturesForCard(narrowGrouped.get('e1'));
  assert.deepEqual(narrowFeatures, fullFeatures);
});

test('fetchDealClaims pages through a fake Supabase using the narrowed select and reshapes every row', async () => {
  const claimsTable = Array.from({ length: 3 }, (_, i) => ({
    id: `c${i}`, deal_id: 'deal-1', excerpt_id: `e${i}`, attribute: 'attr', canonical: null,
    evidence_quote: null, verbatim: `v${i}`, feature_value: null,
  }));
  let seenSelect = null;
  const sb = {
    from(table) {
      assert.equal(table, 'claims');
      return {
        select(columns) {
          seenSelect = columns;
          return {
            eq(col, val) {
              assert.equal(col, 'deal_id');
              assert.equal(val, 'deal-1');
              return {
                order() {
                  return {
                    range(start, end) {
                      return Promise.resolve({ data: claimsTable.slice(start, end + 1), error: null });
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };
  const claims = await fetchDealClaims('deal-1', sb);
  assert.equal(seenSelect, CLAIMS_SELECT);
  assert.equal(claims.length, 3);
  for (const c of claims) {
    assert.equal(c.feature_value, undefined);
    assert.ok('provenance' in c);
  }
});
