/* r14 deal-compare: unified per-section table -- pure row-union logic
   (components/review-v2/compareRowUnion.js). Identity rule: stable config
   row id first; ids embedding a deal-specific token (card UUID / long digit
   run) fall back to the normalized label. Ordering: primary deal's rows in
   primary order, then compared-only rows appended in their own order. */

const test = require('node:test');
const assert = require('node:assert/strict');

let mod;
test.before(async () => {
  mod = await import('../components/review-v2/compareRowUnion.js');
});

test('rowIdentityKey: stable ids match by id', () => {
  assert.equal(mod.rowIdentityKey({ id: 'structure-mechanics-closing-timing', label: 'Closing' }), 'id:structure-mechanics-closing-timing');
});

test('rowIdentityKey: uuid-bearing ids fall back to normalized label', () => {
  const key = mod.rowIdentityKey({
    id: 'representations-qualifiers-7dc3a05f-b170-4d59-a255-b7103cca16e1',
    label: '  Capitalization ',
  });
  assert.equal(key, 'label:capitalization');
});

test('rowIdentityKey: long digit runs are deal-specific too', () => {
  assert.equal(mod.rowIdentityKey({ id: 'row-123456789', label: 'Outside Date' }), 'label:outside date');
});

test('rowIdentityKey: no stable id, non-string label -> uuid id kept as last resort; nothing -> null', () => {
  assert.equal(
    mod.rowIdentityKey({ id: 'x-7dc3a05f-b170-4d59-a255-b7103cca16e1', label: { type: 'span' } }),
    'id:x-7dc3a05f-b170-4d59-a255-b7103cca16e1',
  );
  assert.equal(mod.rowIdentityKey({}), null);
  assert.equal(mod.rowIdentityKey(null), null);
});

test('normalizeLabelKey collapses whitespace and case', () => {
  assert.equal(mod.normalizeLabelKey('  Outside   Date '), 'outside date');
  assert.equal(mod.normalizeLabelKey(''), null);
  assert.equal(mod.normalizeLabelKey(42), null);
});

test('unionRows: primary order first, compared-only rows appended in their own order', () => {
  const primary = [
    { id: 'closing', label: 'Closing' },
    { id: 'outside-date', label: 'Outside date' },
    { id: 'primary-only', label: 'Primary only' },
  ];
  const compared = [
    { id: 'outside-date', label: 'Outside date' },
    { id: 'cmp-only-1', label: 'Compared only 1' },
    { id: 'closing', label: 'Closing' },
    { id: 'cmp-only-2', label: 'Compared only 2' },
  ];
  const union = mod.unionRows([primary, compared]);
  assert.deepEqual(union.map((e) => e.key), [
    'id:closing', 'id:outside-date', 'id:primary-only', 'id:cmp-only-1', 'id:cmp-only-2',
  ]);
  // matched row present in both slots
  const closing = union[0];
  assert.equal(closing.rows[0], primary[0]);
  assert.equal(closing.rows[1], compared[2]);
  // primary-only row has null for the compared deal (renders "Not extracted for this deal")
  assert.equal(union[2].rows[0], primary[2]);
  assert.equal(union[2].rows[1], null);
  // compared-only rows have null for primary
  assert.equal(union[3].rows[0], null);
  assert.equal(union[3].rows[1], compared[1]);
});

test('unionRows: label fallback matches reps rows whose ids embed card uuids', () => {
  const primary = [
    { id: 'representations-qualifiers-11111111-2222-3333-4444-555555555555', label: 'Capitalization' },
    { id: 'representations-qualifiers-11111111-2222-3333-4444-666666666666', label: 'Organization' },
  ];
  const compared = [
    { id: 'representations-qualifiers-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', label: 'Organization' },
  ];
  const union = mod.unionRows([primary, compared]);
  assert.equal(union.length, 2);
  assert.equal(union[1].key, 'label:organization');
  assert.equal(union[1].rows[0], primary[1]);
  assert.equal(union[1].rows[1], compared[0]);
  assert.equal(union[0].rows[1], null);
});

test('unionRows: duplicate keys within one list stay distinct and match by occurrence', () => {
  const a = [
    { label: 'Termination fee' },
    { label: 'Termination fee' },
  ];
  const b = [
    { label: 'Termination fee' },
  ];
  const union = mod.unionRows([a, b]);
  assert.equal(union.length, 2);
  assert.equal(union[0].rows[0], a[0]);
  assert.equal(union[0].rows[1], b[0]);
  assert.equal(union[1].rows[0], a[1]);
  assert.equal(union[1].rows[1], null);
});

test('unionRows: rows with no identity never match across deals', () => {
  const a = [{ foo: 1 }];
  const b = [{ foo: 2 }];
  const union = mod.unionRows([a, b]);
  assert.equal(union.length, 2);
  assert.equal(union[0].rows[1], null);
  assert.equal(union[1].rows[0], null);
});

test('unionRows: three deals -- compared deals contribute in URL order', () => {
  const primary = [{ id: 'a', label: 'A' }];
  const cmp1 = [{ id: 'b', label: 'B' }];
  const cmp2 = [{ id: 'c', label: 'C' }, { id: 'b', label: 'B' }];
  const union = mod.unionRows([primary, cmp1, cmp2]);
  assert.deepEqual(union.map((e) => e.key), ['id:a', 'id:b', 'id:c']);
  assert.equal(union[1].rows[2], cmp2[1]);
});
