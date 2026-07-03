/* Metsera fb2 block 4 — global review-page layout.
   Run: npm test
   Section order: Structure → Consideration → Reps → MAE → Material Contracts
   → IOC → No-Sol → Antitrust → Closing Conditions → Termination Rights →
   Termination Fees → rest; Seller/Target sections before Buyer/Parent. */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

let groupsMod;
test.before(async () => {
  groupsMod = await import(path.join('..', 'lib', 'sidebar-groups.js'));
});

const EXPECTED_ORDER = [
  'Structure & Mechanics',
  'Consideration',
  'Representations',
  'Material Adverse Effect',
  'Material Contracts',
  'Interim Operating Covenants',
  'No-Solicitation / No-Shop',
  'Antitrust / Regulatory',
  'Conditions to Closing',
  'Termination Rights',
  'Termination Fees',
];

test('4a: lib/sidebar-groups.js group order matches the canonical reading order', () => {
  const labels = groupsMod.SIDEBAR_GROUPS.map((g) => g.label);
  assert.deepEqual(labels.slice(0, EXPECTED_ORDER.length), EXPECTED_ORDER);
});

test('4a: components/review/shared.js SIDEBAR_GROUPS keeps the same order', () => {
  // shared.js contains JSX so it can't be imported under node --test —
  // assert the label ORDER from source instead. The review page derives
  // TYPE_SORT_ORDER (and therefore section order) from this array.
  const src = fs.readFileSync(path.join(__dirname, '..', 'components', 'review', 'shared.js'), 'utf8');
  const start = src.indexOf('export const SIDEBAR_GROUPS');
  assert.ok(start > 0);
  const body = src.slice(start, src.indexOf('];', start));
  let last = -1;
  for (const label of EXPECTED_ORDER) {
    const idx = body.indexOf(`label: '${label}'`);
    assert.ok(idx >= 0, `group "${label}" present`);
    assert.ok(idx > last, `group "${label}" in canonical position`);
    last = idx;
  }
  // Material Contracts is its own section between MAE and IOC — no longer a
  // child of Representations.
  const repsBlock = body.slice(body.indexOf("label: 'Representations'"), body.indexOf("label: 'Material Adverse Effect'"));
  assert.ok(!repsBlock.includes('__MATERIAL_CONTRACTS'));
});

test('4b: seller/target children come before buyer/parent in every split group', () => {
  for (const g of groupsMod.SIDEBAR_GROUPS) {
    if (!Array.isArray(g.children)) continue;
    const target = g.children.findIndex((c) => /company|target/i.test(c.label));
    const buyer = g.children.findIndex((c) => /buyer|parent/i.test(c.label));
    if (target >= 0 && buyer >= 0) {
      assert.ok(target < buyer, `${g.label}: seller/target child first`);
    }
  }
});

test('4a: review page sorts rendered sections by SIDEBAR_GROUPS order (synthesized groups included)', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'pages', 'review', '[id].js'), 'utf8');
  // filteredProvsByType must re-order its entries by TYPE_SORT_ORDER before
  // returning — otherwise synthesized empty sections (IOC-B, NOSOL-B, TERMR
  // children) fall to the bottom of the page.
  assert.match(src, /const orderedEntries = Object\.entries\(collapsed\)\.sort/);
  assert.match(src, /return Object\.fromEntries\(orderedEntries\)/);
});

test('4c: empty buyer-side sections collapse to a single inline "— None" line', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'pages', 'review', '[id].js'), 'utf8');
  assert.ok(src.includes("'IOC (Buyer)'"));
  assert.ok(src.includes("'No-Shop (Buyer)'"));
  assert.match(src, /\{' — None'\}/);
});
