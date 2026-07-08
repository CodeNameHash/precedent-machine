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
  'SEC Filing / Meeting Requirements',
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
  assert.ok(!repsBlock.includes('__ABRY'));

  const misc = body.indexOf("label: 'Miscellaneous / Boilerplate'");
  const abry = body.indexOf("label: 'No Other Reps / Fraud / Willful Breach (Abry)'");
  const defs = body.indexOf("label: 'Definitions'");
  assert.ok(misc < abry, 'Abry summary comes after Miscellaneous / Boilerplate');
  assert.ok(abry < defs, 'Abry summary comes before Definitions');
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

test('review page no longer renders legacy empty buyer-side section placeholders', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'pages', 'review', '[id].js'), 'utf8');
  assert.doesNotMatch(src, /'IOC \(Buyer\)'/);
  assert.doesNotMatch(src, /'No-Shop \(Buyer\)'/);
  assert.doesNotMatch(src, /\{' — None'\}/);
  assert.match(src, /<ProvisionCardTable reviewDeal=\{reviewDealForTables/);
});

test('IOC side gate treats single-item filter arrays as child clicks', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'pages', 'review', '[id].js'), 'utf8');
  const start = src.indexOf('const iocSide = (() =>');
  assert.ok(start > 0);
  const body = src.slice(start, src.indexOf('})();', start));
  assert.match(body, /const filters = Array\.isArray\(activeFilter\) \? activeFilter : \[activeFilter\]/);
  assert.match(body, /filters\.length === 1 && filters\[0\] === 'IOC-T'/);
  assert.match(body, /filters\.length === 1 && filters\[0\] === 'IOC-B'/);
});

test('sidebar provision clicks scroll without narrowing the review list', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'pages', 'review', '[id].js'), 'utf8');

  const filteredStart = src.indexOf('const filteredProvisions = useMemo(() =>');
  assert.ok(filteredStart > 0);
  const filteredBody = src.slice(filteredStart, src.indexOf('/* ── Group provisions by type', filteredStart));
  assert.doesNotMatch(filteredBody, /selectedProvId[\s\S]*return one \? \[one\] : \[\]/);

  const handlerStart = src.indexOf('const handleSidebarSelectProvision = useCallback((provId) =>');
  assert.ok(handlerStart > 0);
  const handlerBody = src.slice(handlerStart, src.indexOf('/* ── Edit provision ── */', handlerStart));
  assert.match(handlerBody, /queueProvisionScroll\(prov\)/);
  assert.match(handlerBody, /setActiveFilter\(null\)/);
  assert.doesNotMatch(handlerBody, /setActiveFilter\(sectionType\)/);
  assert.doesNotMatch(handlerBody, /activeFilterIncludesProvision/);
  assert.match(handlerBody, /if \(isEdit\) setEditingProvision\(prov\)/);
  assert.doesNotMatch(handlerBody, /setSelectedProvId\(null\)/);

  assert.match(src, /scrollIntoView\(\{ behavior: 'smooth', block: 'center' \}\)/);
  assert.match(src, /id=\{`review-prov-\$\{p\.id\}`\}/);
  assert.match(src, /provisionRefs=\{provisionRefs\}/);
});

test('sidebar section clicks and direct links scroll without filtering the page', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'pages', 'review', '[id].js'), 'utf8');
  const filterStart = src.indexOf('const handleFilterType = useCallback((type) =>');
  assert.ok(filterStart > 0);
  const filterBody = src.slice(filterStart, src.indexOf('/* ── Sidebar provision click', filterStart));
  assert.match(filterBody, /setActiveFilter\(null\)/);
  // Phase A shell-restore: nav clicks translate the provision type into the
  // accordion section id, then scroll/expand that curated table.
  assert.match(filterBody, /queueSectionScroll\(sectionId\)/);
  assert.doesNotMatch(filterBody, /setActiveFilter\(next\)/);

  const hydrateStart = src.indexOf('// Hydrate direct links once the route and provision list are ready.');
  assert.ok(hydrateStart > 0);
  const hydrateBody = src.slice(hydrateStart, src.indexOf('/* ── Save edits ── */', hydrateStart));
  assert.match(hydrateBody, /queueSectionScroll\(sectionIdForType\(validSections\[0\]\)\)/);
  assert.match(hydrateBody, /return prev === null \? prev : null/);
  assert.doesNotMatch(hydrateBody, /nextFilter =/);
});

test('MAE definition side detection reads the defined term before generic category/code', () => {
  const reviewSrc = fs.readFileSync(path.join(__dirname, '..', 'pages', 'review', '[id].js'), 'utf8');
  const sidebarSrc = fs.readFileSync(path.join(__dirname, '..', 'lib', 'sidebar-groups.js'), 'utf8');
  const start = reviewSrc.indexOf('function maeDefinitionSide(p)');
  assert.ok(start > 0);
  const body = reviewSrc.slice(start, reviewSrc.indexOf('/* P8 item 3', start));
  const termIdx = body.indexOf('const term = String(definitionLabel(p)');
  const fallbackIdx = body.indexOf('const fallbackText =');

  assert.match(body, /definitionLabel\(p\)/);
  assert.ok(termIdx > -1, 'defined term is inspected first');
  assert.ok(fallbackIdx > termIdx, 'definition body is fallback only');
  assert.match(body, /fallbackText/);
  assert.match(body, /parent\|buyer\|acquir\|purchaser/i);
  assert.match(body, /company\|target/i);
  assert.match(sidebarSrc, /Parent Material Adverse Effect/);
  assert.match(sidebarSrc, /MAE-DEF-P/);
});

test('MAE carve-out rows render the title without a duplicate code badge', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'pages', 'review', '[id].js'), 'utf8');
  const start = src.indexOf('function MaeSinglePartySummary');
  assert.ok(start > 0);
  const body = src.slice(start, src.indexOf('function labelForCarveoutCode', start));
  const rowsStart = body.indexOf('carveouts.map');
  assert.ok(rowsStart > 0);
  const rows = body.slice(rowsStart);

  assert.match(rows, /<TermCell provision=\{provision\}/);
  assert.doesNotMatch(rows, /<CodeBadge code=\{c\.code\}/);
});

test('review hero uses display party names while preserving contractual parent detail', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'pages', 'review', '[id].js'), 'utf8');
  assert.match(src, /const displayAcquirer = getDisplayAcquirer\(deal\)/);
  assert.match(src, /const displayTarget = getDisplayTarget\(deal\)/);
  assert.match(src, /\{displayAcquirer\} <span className="vs">acquires<\/span> \{displayTarget\}/);
  assert.match(src, /Contractual parent: \{contractualAcquirer\}/);
});
