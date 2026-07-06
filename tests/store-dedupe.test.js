const test = require('node:test');
const assert = require('node:assert/strict');
const { archiveProvisionRows, cleanProvisionText, dedupeProvisions, expandTypeGroupForStore, storeProvisionsForType } = require('../lib/parser-v2/store');

test('dedupeProvisions keeps the first byte-identical provision', () => {
  const provisions = [
    { type: 'EQUITY', category: 'Treatment of Equity Awards', full_text: 'Same provision text.' },
    { type: 'EQUITY', category: 'Treatment of Equity Awards', full_text: 'Same provision text.' },
  ];

  assert.deepEqual(dedupeProvisions(provisions), [provisions[0]]);
});

test('dedupeProvisions ignores section markers and whitespace', () => {
  const provisions = [
    { type: 'COND', category: 'Closing Conditions', full_text: '[[SECTION]] The   condition\napplies. [[/SECTION]]' },
    { type: 'COND', category: 'Closing Conditions', full_text: 'The condition applies.' },
  ];

  assert.deepEqual(dedupeProvisions(provisions), [provisions[0]]);
});

test('cleanProvisionText strips display markers from stored provision text', () => {
  assert.equal(
    cleanProvisionText({
      full_text: '[[DEFINED]]"Final Order"[[/DEFINED]] means an order that is final. [[REF]]Section 6.03[[/REF]] applies.',
    }),
    '"Final Order" means an order that is final. Section 6.03 applies.',
  );
  assert.equal(
    cleanProvisionText({
      full_text: '"Intellectual Property Rights"[[/D',
    }),
    '"Intellectual Property Rights"',
  );
  assert.equal(
    cleanProvisionText({
      full_text: 'subject to the terms of [[REF]',
    }),
    'subject to the terms of',
  );
});

test('dedupeProvisions keeps same-category provisions with different text', () => {
  const provisions = [
    { type: 'TERMF', category: 'Termination Fee', full_text: 'The fee is $10 million.' },
    { type: 'TERMF', category: 'Termination Fee', full_text: 'The fee is $12 million.' },
  ];

  assert.deepEqual(dedupeProvisions(provisions), provisions);
});

test('dedupeProvisions drops identical text under different categories', () => {
  const provisions = [
    { type: 'EQUITY', category: 'Treatment of Equity Awards', full_text: 'Options vest at closing.' },
    { type: 'EQUITY', category: 'Equity Award Treatment', full_text: 'Options vest at closing.' },
  ];

  assert.deepEqual(dedupeProvisions(provisions), [provisions[0]]);
});

test('dedupeProvisions never merges empty or missing full_text provisions', () => {
  const provisions = [
    { type: 'EQUITY', category: 'Blank A', full_text: '' },
    { type: 'EQUITY', category: 'Blank B', full_text: '   ' },
    { type: 'EQUITY', category: 'Missing' },
  ];

  assert.deepEqual(dedupeProvisions(provisions), provisions);
});

test('OTHER storage owns both catch-all coverage row types', () => {
  assert.deepEqual(expandTypeGroupForStore('OTHER'), ['OTHER', 'SECTION-LEFTOVER']);
});

test('archiveProvisionRows writes deleted provision payloads to the migration archive table', async () => {
  const inserted = [];
  const sb = {
    from(table) {
      assert.equal(table, 'provisions_archive_20260706');
      return {
        insert(rows) {
          inserted.push(...rows);
          return Promise.resolve({ error: null });
        },
      };
    },
  };

  const result = await archiveProvisionRows(sb, [
    { id: '11111111-1111-4111-8111-111111111111', deal_id: '22222222-2222-4222-8222-222222222222', category: 'Treatment of Equity Awards' },
  ], 'test/archive');

  assert.equal(result.archived, 1);
  assert.equal(inserted[0].original_provision_id, '11111111-1111-4111-8111-111111111111');
  assert.equal(inserted[0].archive_reason, 'test/archive');
  assert.equal(inserted[0].row_data.category, 'Treatment of Equity Awards');
});

const { differentiateCategories } = require('../lib/parser-v2/store');

test('differentiateCategories renames same-category distinct-text provisions by their own section heading', () => {
  const provisions = [
    { type: 'REP-T', category: 'Capitalization; Subsidiaries', full_text: 'SECTION 3.02. Capital Structure. The authorized capital stock consists of shares.' },
    { type: 'REP-T', category: 'Capitalization; Subsidiaries', full_text: 'SECTION 3.03. Company Subsidiaries. Each subsidiary is duly organized.' },
    { type: 'REP-T', category: 'Litigation', full_text: 'SECTION 3.13. Litigation. There is no pending action.' },
  ];
  const out = differentiateCategories(provisions);
  assert.equal(out[0].category, 'Capitalization; Subsidiaries — Capital Structure');
  assert.equal(out[1].category, 'Capitalization; Subsidiaries — Company Subsidiaries');
  // singleton untouched
  assert.equal(out[2].category, 'Litigation');
});

test('differentiateCategories leaves a member alone when its heading equals the shared label', () => {
  const provisions = [
    { type: 'IOC-T', category: 'Indebtedness', full_text: '(i) incur any indebtedness for borrowed money in excess of $500,000.' },
    { type: 'IOC-T', category: 'Indebtedness', full_text: '(n) make any capital contribution or investment in any Person.', ai_metadata: { features: { sectionNumber: '5.01(n)' } } },
  ];
  const out = differentiateCategories(provisions);
  // No SECTION heading in sub-clause text: first has no number either -> unchanged;
  // second falls back to its section number.
  assert.equal(out[0].category, 'Indebtedness');
  assert.equal(out[1].category, 'Indebtedness (§5.01(n))');
});

function fakeStoreSupabase(sourceText) {
  const inserted = [];
  return {
    inserted,
    from(table) {
      const chain = {
        select() { return chain; },
        eq() { return chain; },
        in() { return chain; },
        single: async () => {
          if (table === 'deals') return { data: { metadata: { full_text: sourceText } }, error: null };
          return { data: null, error: null };
        },
        insert(rows) {
          const list = Array.isArray(rows) ? rows : [rows];
          inserted.push(...list);
          return {
            select: async () => ({ data: list.map((_, i) => ({ id: `inserted-${i}` })), error: null }),
          };
        },
        then(resolve, reject) {
          return Promise.resolve({ data: [], error: null }).then(resolve, reject);
        },
      };
      return chain;
    },
  };
}

test('storeProvisionsForType repairs verified MAE subset quotes and removes compressed quote strings before insert', async () => {
  const source = [
    'any failure, in and of itself, by the Company Group to meet (1) any public analyst estimates',
    "or expectations of the Company Group's revenue, earnings or other financial performance or results of operations",
    'for any period; or (2) any internal projections or forecasts of its revenues, earnings or other financial performance',
  ].join(' ');
  const compressed = 'any failure, in and of itself, by the Company Group to meet any public analyst estimates or expectations or internal projections or forecasts';
  const good = 'any internal projections or forecasts of its revenues';
  const sb = fakeStoreSupabase(source);

  const result = await storeProvisionsForType('deal-1', 'DEF', [{
    type: 'DEF',
    code: 'DEF-MAE',
    category: 'Material Adverse Effect',
    text: source,
    favorability: 'neutral',
    features: {
      carveouts: [
        { code: 'FAILURE_TO_MEET_PROJECTIONS', label: 'Failure to meet projections', text: source },
      ],
      nonDisproportionateImpactCarveouts: [
        { code: 'FAILURE_TO_MEET_PROJECTIONS', label: 'Failure to meet projections', text: compressed },
      ],
      failureToMeetProjectionCarveout: { value: true, quotes: [compressed, good] },
    },
  }], sb);

  assert.equal(result.insertedCount, 1);
  assert.equal(sb.inserted.length, 1);
  const meta = sb.inserted[0].ai_metadata;
  assert.equal(meta.features.nonDisproportionateImpactCarveouts[0].text, source);
  assert.deepEqual(meta.features.failureToMeetProjectionCarveout.quotes, [good]);
  assert.equal(meta.quote_verification.repaired, 1);
  assert.equal(meta.quote_verification.removed, 1);
  assert.deepEqual(meta.quote_verification.details.map((d) => d.action), [
    'replaced_with_verified_carveout_quote',
    'removed_unverified_quote',
  ]);
});

test('storeProvisionsForType dedupes exact duplicate provisions before insert', async () => {
  const text = '(m) implement or adopt any material change in its accounting policies.';
  const sb = fakeStoreSupabase(text);

  const result = await storeProvisionsForType('deal-1', 'IOC', [
    {
      type: 'IOC-T',
      code: 'IOC-ACCOUNTING',
      category: 'Accounting Changes',
      text,
      favorability: 'buyer-favorable',
      features: { canonicalCode: 'IOC-ACCOUNTING', mainObligation: text },
    },
    {
      type: 'IOC-T',
      code: 'IOC-ACCOUNTING',
      category: 'Accounting Changes',
      text,
      favorability: 'buyer-favorable',
      features: { canonicalCode: 'IOC-ACCOUNTING', mainObligation: text },
    },
  ], sb);

  assert.equal(result.insertedCount, 1);
  assert.equal(sb.inserted.length, 1);
  assert.equal(sb.inserted[0].category, 'Accounting Changes');
});

test('storeProvisionsForType strips display markers before insert', async () => {
  const source = '"Final Order" means an order that is final.';
  const sb = fakeStoreSupabase(source);

  const result = await storeProvisionsForType('deal-1', 'DEF', [
    {
      type: 'DEF',
      code: 'DEF-GENERAL',
      category: 'Final Order',
      text: '[[DEFINED]]"Final Order"[[/DEFINED]] means an order that is final.',
      favorability: 'neutral',
      features: {
        canonicalTerm: 'Final Order',
        definitionText: '[[DEFINED]]"Final Order"[[/DEFINED]] means an order that is final.',
      },
    },
  ], sb);

  assert.equal(result.insertedCount, 1);
  assert.equal(sb.inserted[0].full_text, '"Final Order" means an order that is final.');
  assert.equal(
    sb.inserted[0].ai_metadata.features.definitionText,
    '"Final Order" means an order that is final.',
  );
});
