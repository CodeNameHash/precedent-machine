/* Metsera fb2 block 1 — Consideration hero display.
   Run: npm test
   Real-shaped fixture: Metsera CONSID-CONVERT features
   { perShareAmount: "$47.50", considerationType: "cash-with-cvr" }. */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

let mod;
test.before(async () => {
  mod = await import(path.join('..', 'components', 'review', 'table-logic.js'));
});

test('cash + CVR renders two pills joined by a literal "+" (Metsera shape)', () => {
  const parts = mod.buildPerShareParts({
    perShareText: '$47.50',
    hasCvr: true,
    hasCash: true,
    cvrMaxText: null,
  });
  assert.deepEqual(parts, [
    { type: 'pill', text: '$47.50 in cash' },
    { type: 'plus', text: '+' },
    { type: 'pill', text: '1 CVR' },
  ]);
});

test('CVR max payment folds into the CVR pill', () => {
  const parts = mod.buildPerShareParts({
    perShareText: '$47.50',
    hasCvr: true,
    hasCash: true,
    cvrMaxText: '$4.00',
  });
  assert.equal(parts[2].text, '1 CVR (up to $4.00)');
});

test('cash-only deal renders a single plain pill, no separator', () => {
  const parts = mod.buildPerShareParts({
    perShareText: '$25.00',
    hasCvr: false,
    hasCash: true,
    cvrMaxText: null,
  });
  assert.deepEqual(parts, [{ type: 'pill', text: '$25.00' }]);
});

test('no "per share" suffix in the parts (left label already says Per-Share)', () => {
  const parts = mod.buildPerShareParts({
    perShareText: '$47.50', hasCvr: true, hasCash: true, cvrMaxText: null,
  });
  for (const p of parts) assert.ok(!/per share/i.test(p.text));
});

/* Block 1a regression — the "Consideration Type" hero row was removed
   (Per-Share Consideration carries the type). Source-wiring check: the row
   must not come back into the heroRows list. */
test('ConsiderationTables no longer renders a Consideration Type hero row', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'components', 'review', 'ConsiderationTables.js'),
    'utf8',
  );
  assert.ok(!/label:\s*'Consideration Type'/.test(src));
  // and the per-share cell no longer prints a trailing "per share" text node
  assert.ok(!/>per share</.test(src));
});
