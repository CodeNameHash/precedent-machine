// FB3 missed item 5 — Willful Breach folded into the No Other Reps / Fraud
// (Abry) section (12.3), single home: removed from the Misc/Boilerplate
// table. Sourced from ANY provision carrying willfulBreachDefinition (a DEF
// provision on Metsera, not necessarily MISC) — lib/abry.js is pure and
// dependency-free (see its header), directly importable under node --test.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

let abry;
test.before(async () => {
  abry = await import(path.join('..', 'lib', 'abry.js'));
});

// Metsera's real shape: willfulBreachDefinition lives on a DEF provision
// (id 127a1960-…, sourceSectionType TERMF), NOT a MISC provision.
function metseraWillfulBreachDefProvision() {
  return {
    id: '127a1960-ec23-47bd-8373-a1c3d1df6648',
    type: 'DEF',
    category: 'Willful Breach',
    ai_metadata: {
      code: 'DEF',
      features: {
        canonicalTerm: 'willful and material breach',
        sourceSectionType: 'TERMF',
        willfulBreachDefinition: {
          value: true,
          quotes: ['a material breach of, or a material failure to perform, any representation, warranty or covenant set forth in this Agreement, in each case that is the consequence of an intentional act or intentional omission by a party with the actual knowledge that the taking of such act or failure to take such act would result in such material breach of this or material failure to perform.'],
        },
      },
    },
  };
}

test('firstWillfulBreachDefinition finds the definition on a DEF provision (Metsera shape), not just MISC', () => {
  const hit = abry.firstWillfulBreachDefinition([{ type: 'MISC', ai_metadata: { features: {} } }, metseraWillfulBreachDefProvision()]);
  assert.ok(hit);
  assert.match(hit.text, /intentional act or intentional omission/);
  assert.equal(hit.provision.type, 'DEF');
});

test('firstWillfulBreachDefinition returns null when no provision carries the field', () => {
  assert.equal(abry.firstWillfulBreachDefinition([{ type: 'MISC', ai_metadata: { features: {} } }]), null);
  assert.equal(abry.firstWillfulBreachDefinition([]), null);
});

test('deriveAbrySummary includes a willfulBreach field: "defined" with the verbatim quote when present, "not_defined" when absent', () => {
  const defined = abry.deriveAbrySummary([metseraWillfulBreachDefProvision()]);
  assert.equal(defined.willfulBreach.status, 'defined');
  assert.match(defined.willfulBreach.quote, /intentional act or intentional omission/);

  const absent = abry.deriveAbrySummary([{ type: 'MISC', ai_metadata: { features: {} } }]);
  assert.equal(absent.willfulBreach.status, 'not_defined');
});

/* ── Wiring: NoOtherRepsFraudTable.js (header rename + new row) and the
   Misc table single-home removal in pages/review/[id].js. Both files are
   JSX; source-text pattern per tests/fb3-wiring.test.js. */
const noOtherRepsSrc = fs.readFileSync(path.join(__dirname, '..', 'components', 'review', 'NoOtherRepsFraudTable.js'), 'utf8');
const reviewSrc = fs.readFileSync(path.join(__dirname, '..', 'pages', 'review', '[id].js'), 'utf8');
const sharedSrc = fs.readFileSync(path.join(__dirname, '..', 'components', 'review', 'shared.js'), 'utf8');

test('NoOtherRepsFraudTable header is renamed to include Willful Breach', () => {
  assert.match(noOtherRepsSrc, /No Other Reps \/ Fraud \/ Willful Breach \(Abry\)/);
  assert.ok(!/No Other Reps \/ Fraud \(Abry\)/.test(noOtherRepsSrc), 'old header string fully replaced, not just appended to');
});

test('NoOtherRepsFraudTable renders a Willful Breach row after the fraud row, "Not defined" when absent', () => {
  const fraudIdx = noOtherRepsSrc.indexOf('Fraud Carve-Out');
  const wbIdx = noOtherRepsSrc.indexOf('>Willful Breach<');
  assert.ok(fraudIdx > 0 && wbIdx > fraudIdx, 'Willful Breach row comes after the fraud row');
  assert.match(noOtherRepsSrc, /Not defined/);
  assert.match(noOtherRepsSrc, /summary\.willfulBreach/);
});

test('sidebar labels (shared.js) also carry the renamed Abry section', () => {
  assert.match(sharedSrc, /No Other Reps \/ Fraud \/ Willful Breach \(Abry\)/);
});

test('the Misc/Boilerplate table no longer renders the Willful Breach Definition row (single home moved to Abry table) but keeps the other 3 willful-breach flags', () => {
  const start = reviewSrc.indexOf('function MiscSummaryTable(');
  assert.ok(start > 0);
  const body = reviewSrc.slice(start, reviewSrc.indexOf('\n}', reviewSrc.indexOf('</table>', start)));
  assert.ok(!/label="Willful Breach Definition"/.test(body), 'definition row removed — single home is now Abry table');
  assert.match(body, /label="Willful Breach Requires Actual Knowledge"/, 'the other 3 flags stay on Misc — not covered by the new Abry row');
  assert.match(body, /label="Willful Breach Covers Omissions"/);
  assert.match(body, /label="Willful Breach Limited to Material"/);
});

test('MISC_CONSUMED_KEY_GROUPS no longer consumes willfulBreachDefinition (so it never silently disappears from the "other provisions" footer)', () => {
  const start = reviewSrc.indexOf('const MISC_CONSUMED_KEY_GROUPS');
  const body = reviewSrc.slice(start, reviewSrc.indexOf('];', start));
  assert.ok(!/\['willfulBreachDefinition'\]/.test(body));
  assert.match(body, /\['willfulBreachRequiresActualKnowledge'\]/);
});
