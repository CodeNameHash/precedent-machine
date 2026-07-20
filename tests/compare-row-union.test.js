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

// r16 ROW_FAMILY step (docs/PLAN.md P3): taxonomy-split code pairs whose
// per-deal labels differ (each is that deal's own card.short_title/
// defined_term, not a fixed taxonomy label) must still union into ONE
// compare row, keyed off the underlying provision code rather than id/label.
test('rowIdentityKey: ROW_FAMILY canonicalizes REP-T-CONTRACTS / REP-T-MATERIAL-CONTRACTS to the same key', () => {
  const a = mod.rowIdentityKey({
    id: 'representations-qualifiers-11111111-2222-3333-4444-555555555555',
    label: 'Material Contracts; No Breach',
    card: { provision_subtype: 'REP-T-CONTRACTS' },
  });
  const b = mod.rowIdentityKey({
    id: 'representations-qualifiers-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    label: 'Contracts and Agreements',
    card: { provision_subtype: 'REP-T-MATERIAL-CONTRACTS' },
  });
  assert.equal(a, b);
  assert.equal(mod.rowFamilyLabel(a), 'Material contracts');
});

test('rowFamilyLabel: null for a non-family key', () => {
  assert.equal(mod.rowFamilyLabel('id:closing'), null);
  assert.equal(mod.rowFamilyLabel(null), null);
});

test('unionRows: a ROW_FAMILY pair that previously produced two one-sided rows now yields one row with both deals\' cells', () => {
  const primary = [
    { id: 'general-covenants-clause-11111111-2222-3333-4444-555555555555', label: 'Payment Agent', sourceCard: { provision_subtype: 'COV-PAYAGENT' }, cell: 'primary-payagent' },
  ];
  const compared = [
    { id: 'consideration-hero-clause-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', label: 'Exchange of Certificates', sourceCard: { provision_subtype: 'CONSID-EXCHANGE' }, cell: 'compared-exchange' },
  ];
  const union = mod.unionRows([primary, compared]);
  assert.equal(union.length, 1);
  const [entry] = union;
  assert.equal(mod.rowFamilyLabel(entry.key), 'Payment & exchange mechanics');
  assert.equal(entry.rows[0], primary[0]);
  assert.equal(entry.rows[1], compared[0]);
});

test('unionRows: ROW_FAMILY pairs for the other five mapped groups also collapse to one row', () => {
  const groups = [
    ['REP-T-CONSENT', 'REP-T-NOCONFLICT', 'No conflict; consents & approvals'],
    ['REP-T-SANCTIONS', 'REP-T-ANTICORR', 'Anti-corruption & sanctions'],
    ['MISC-JURY', 'MISC-JURISD', 'Jurisdiction & jury waiver'],
    ['COV-PROXY', 'COV-MEETING', 'Stockholder meeting & proxy'],
  ];
  for (const [codeA, codeB, label] of groups) {
    const primary = [{ id: `sec-1${Math.random()}`, label: 'Some Deal-Specific Title A', card: { provision_subtype: codeA } }];
    const compared = [{ id: `sec-2${Math.random()}`, label: 'Some Deal-Specific Title B', card: { provision_subtype: codeB } }];
    const union = mod.unionRows([primary, compared]);
    assert.equal(union.length, 1, `${codeA} / ${codeB} should union to one row`);
    assert.equal(mod.rowFamilyLabel(union[0].key), label);
  }
});

test('unionRows: non-family rows with genuinely different codes still stay one-sided', () => {
  const primary = [{ id: 'a-11111111-2222-3333-4444-555555555555', label: 'Unrelated A', card: { provision_subtype: 'REP-T-CAPITALIZATION' } }];
  const compared = [{ id: 'b-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', label: 'Unrelated B', card: { provision_subtype: 'REP-T-ORGANIZATION' } }];
  const union = mod.unionRows([primary, compared]);
  assert.equal(union.length, 2);
});

// r18 item 1 (Ben, dfaa71fa vs 7dc3a05f IOC compare): the band token in
// ioc-neg-<band>-<code> must never break cross-deal matching for the same
// canonical restriction code.
test('rowIdentityKey: IOC negative-covenant rows match by code, band dropped', () => {
  const a = mod.rowIdentityKey({ id: 'ioc-neg-5.2-IOC-MERGE', code: 'IOC-MERGE' });
  const b = mod.rowIdentityKey({ id: 'ioc-neg-4.1-IOC-MERGE', code: 'IOC-MERGE' });
  assert.equal(a, b);
  assert.equal(a, 'ioc-neg-code:IOC-MERGE');
});

test('rowIdentityKey: IOC negative-covenant rows with genuinely different codes stay one-sided', () => {
  const a = mod.rowIdentityKey({ id: 'ioc-neg-5.2-IOC-MERGE', code: 'IOC-MERGE' });
  const b = mod.rowIdentityKey({ id: 'ioc-neg-4.1-IOC-DIVIDEND', code: 'IOC-DIVIDEND' });
  assert.notEqual(a, b);
});

test('unionRows: IOC negative rows across two deals with different section bands collapse to one row', () => {
  const primary = [{ id: 'ioc-neg-5.2-IOC-MERGE', code: 'IOC-MERGE', label: 'M&A Restrictions' }];
  const compared = [{ id: 'ioc-neg-4.1-IOC-MERGE', code: 'IOC-MERGE', label: 'Mergers & Acquisitions' }];
  const union = mod.unionRows([primary, compared]);
  assert.equal(union.length, 1);
  assert.equal(union[0].rows[0], primary[0]);
  assert.equal(union[0].rows[1], compared[0]);
});

test('rowIdentityKey: titleText matches IOC affirmative/fragment rows across deal-specific ids', () => {
  const a = mod.rowIdentityKey({ id: 'ioc-aff-card-111-0', titleText: 'Conduct business in ordinary course' });
  const b = mod.rowIdentityKey({ id: 'ioc-aff-card-222-0', titleText: 'Conduct business in ordinary course' });
  assert.equal(a, b);
  assert.equal(a, 'title:conduct business in ordinary course');
  const c = mod.rowIdentityKey({ id: 'ioc-frag-card-333', titleText: 'Tax matters' });
  const d = mod.rowIdentityKey({ id: 'ioc-frag-card-444', titleText: 'Tax matters' });
  assert.equal(c, d);
  const e = mod.rowIdentityKey({ id: 'ioc-frag-card-555', titleText: 'Insurance maintenance' });
  assert.notEqual(c, e);
});

// r18 item 2 (Ben): Definitions unify by normalized defined term.
test('normalizeDefinedTerm collapses case and punctuation', () => {
  assert.equal(mod.normalizeDefinedTerm('Merger Sub.'), 'merger sub');
  assert.equal(mod.normalizeDefinedTerm('MERGER SUB'), 'merger sub');
  assert.equal(mod.normalizeDefinedTerm(''), null);
  assert.equal(mod.normalizeDefinedTerm(null), null);
});

test('unionDefinitions: matched terms align, alphabetical order, gaps stay null', () => {
  const primary = [
    { defined_term: 'Merger Sub', defined_value: 'Primary sub def' },
    { defined_term: 'Outside Date', defined_value: 'Primary outside date def' },
  ];
  const compared = [
    { defined_term: 'MERGER SUB.', defined_value: 'Compared sub def' },
    { defined_term: 'Termination Fee', defined_value: 'Compared fee def' },
  ];
  const entries = mod.unionDefinitions([primary, compared]);
  assert.deepEqual(entries.map((e) => e.term), ['Merger Sub', 'Outside Date', 'Termination Fee']);
  const mergerSub = entries[0];
  assert.equal(mergerSub.defs[0], primary[0]);
  assert.equal(mergerSub.defs[1], compared[0]);
  const outsideDate = entries[1];
  assert.equal(outsideDate.defs[0], primary[1]);
  assert.equal(outsideDate.defs[1], null);
  const terminationFee = entries[2];
  assert.equal(terminationFee.defs[0], null);
  assert.equal(terminationFee.defs[1], compared[1]);
});

test('unionRows: three deals -- compared deals contribute in URL order', () => {
  const primary = [{ id: 'a', label: 'A' }];
  const cmp1 = [{ id: 'b', label: 'B' }];
  const cmp2 = [{ id: 'c', label: 'C' }, { id: 'b', label: 'B' }];
  const union = mod.unionRows([primary, cmp1, cmp2]);
  assert.deepEqual(union.map((e) => e.key), ['id:a', 'id:b', 'id:c']);
  assert.equal(union[1].rows[2], cmp2[1]);
});
