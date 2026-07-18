// FB3 missed item 2 — IOC restriction components: deterministic post-pass
// stamping `restrictionComponents` (IOC_CATEGORY_CODES-style tags) on each
// IOC-T/IOC-B sub-clause by keyword-matching its OWN text. Cross-deal
// comparability hook; no LLM involved.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const {
  classifyIocRestrictionComponents,
  stampIocRestrictionComponents,
} = require('../lib/parser-v2/extract.js');
const { FEATURES, getFeaturesForType } = require('../lib/rubric');

test('restrictionComponents is registered on the shared IOC schema (IOC-T/IOC-B resolve to it), sourced as a post-pass (not requested of the LLM)', () => {
  const field = FEATURES.IOC.find((f) => f.key === 'restrictionComponents');
  assert.ok(field, 'IOC schema declares restrictionComponents');
  assert.equal(field.source, 'post-pass');
  assert.equal(field.type, 'list');
  assert.equal(field.scope, 'clause');
  // IOC-T / IOC-B aren't distinct rubric schema keys — they resolve to the
  // shared 'IOC' schema (lib/parser-v2/extract.js lookupType normalization).
  const resolved = getFeaturesForType('IOC');
  assert.ok(resolved.some((f) => f.key === 'restrictionComponents'));
});

test('classifyIocRestrictionComponents: a plain indebtedness clause tags INDEBTEDNESS only', () => {
  const text = 'incur, create, assume or otherwise become liable or responsible for any indebtedness for borrowed money';
  assert.deepEqual(classifyIocRestrictionComponents(text), ['INDEBTEDNESS']);
});

test('classifyIocRestrictionComponents: a bundled clause (indebtedness AND guaranteeing a third party\'s indebtedness) gets BOTH tags — real Metsera sub-clause (i)(i)', () => {
  const text = 'incur, create, assume or otherwise become liable or responsible for, or amend or modify the terms of, any indebtedness for borrowed money, or guarantee any indebtedness of another Person (except for short-term borrowings incurred in the ordinary course)';
  const codes = classifyIocRestrictionComponents(text);
  assert.ok(codes.includes('INDEBTEDNESS'), 'indebtedness tag present');
  assert.ok(codes.includes('THIRD_PARTY_OBLIGATIONS'), 'guarantee-of-third-party-obligation tag present');
});

test('classifyIocRestrictionComponents: acquisitions vs dispositions vs mergers stay distinct', () => {
  assert.deepEqual(classifyIocRestrictionComponents('acquire or agree to acquire any business or any corporation'), ['ACQUISITIONS']);
  // "lease" is a real dual-signal (asset disposition AND the REAL_ESTATE
  // synonym /\bleases?\b/i) — both tags are correct, not a bug.
  const disposition = classifyIocRestrictionComponents('sell, transfer, lease, license, abandon or otherwise dispose of any material properties or assets');
  assert.ok(disposition.includes('ASSET_SALES_LICENSES'));
  assert.ok(disposition.includes('REAL_ESTATE'));
  assert.deepEqual(classifyIocRestrictionComponents('merge or consolidate the Company or any Company Subsidiary with any Person'), ['MERGE_DISSOLVE_RECAP']);
});

test('classifyIocRestrictionComponents: no keyword hit returns an empty array (never forces an OTHER/fabricated tag)', () => {
  assert.deepEqual(classifyIocRestrictionComponents('some unrelated boilerplate sentence with no restriction keywords'), []);
});

test('stampIocRestrictionComponents: only stamps IOC-T / IOC-B sub-clauses, never the bare-IOC preamble/general-exceptions/affirmative provisions', () => {
  const provisions = [
    { type: 'IOC', category: 'IOC General Exceptions', full_text: 'guarantee any indebtedness of another Person', features: {} },
    { type: 'IOC-T', category: 'Indebtedness', full_text: 'incur any indebtedness for borrowed money, or guarantee any indebtedness of another Person', features: {} },
  ];
  stampIocRestrictionComponents(provisions);
  assert.equal(provisions[0].features.restrictionComponents, undefined, 'bare-IOC preamble untouched');
  assert.deepEqual(provisions[1].features.restrictionComponents.sort(), ['INDEBTEDNESS', 'THIRD_PARTY_OBLIGATIONS'].sort());
});

test('stampIocRestrictionComponents is idempotent — skips a provision that already carries a non-empty restrictionComponents', () => {
  const provisions = [
    { type: 'IOC-T', full_text: 'incur any indebtedness for borrowed money', features: { restrictionComponents: ['CAPEX'] } },
  ];
  stampIocRestrictionComponents(provisions);
  assert.deepEqual(provisions[0].features.restrictionComponents, ['CAPEX'], 'existing value preserved, not overwritten');
});

/* ── Wiring: restrictionComponents pills on the IOC negative-covenants table
   (pages/review/[id].js is JSX and can't be imported under node --test —
   see tests/fb3-wiring.test.js for the established source-text pattern). */
const reviewSrc = fs.readFileSync(path.join(__dirname, '..', 'pages', 'review-v1', '[id].js'), 'utf8');

test('IocNegativeCovenantsTableSingle renders restrictionComponents pills in the strict Provision column', () => {
  const start = reviewSrc.indexOf('function IocNegativeCovenantsTableSingle(');
  assert.ok(start > 0);
  const body = reviewSrc.slice(start, reviewSrc.indexOf('function IocNegativeCovenantsTable(', start));
  assert.match(body, /<th className="px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider">Provision<\/th>/);
  assert.match(body, /restrictionComponents/);
  assert.match(body, /IOC_CATEGORY_META\[code\]/);
});
