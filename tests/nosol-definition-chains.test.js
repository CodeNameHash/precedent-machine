// FB3 missed item 6 — NOSOL Key Definitions table must include the deal's
// ACTUAL Superior [Company] Proposal / Company Takeover (Acquisition)
// Proposal defined-term variants (sourced from DEF provisions, not bespoke
// feature keys), and pull in a one-level-deep chained reference when a
// definition's own text names another defined term that itself has a DEF
// provision in this deal. nosolDefinitionChainRows lives in
// components/review/table-logic.js — JSX-free (see nosol-rebuild.test.js
// for the established import pattern for this file).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

let mod;
test.before(async () => {
  mod = await import(path.join('..', 'components', 'review', 'table-logic.js'));
});

// Metsera's real DEF provisions, trimmed to the fields the matcher reads.
function metseraDefProvisions() {
  return [
    {
      id: '1e788460-baf5-4cd7-8cdc-e9bf4bfcd574',
      type: 'DEF',
      features: {
        canonicalTerm: 'Company Takeover Proposal',
        definitionText: 'any inquiry, proposal or offer from any Person or group relating to ... (i) any direct or indirect acquisition ... twenty percent (20%) or more ... (ii) any tender offer, exchange offer, merger, consolidation ... involving the Company',
        crossReferences: ['Company Board', 'Company Subsidiaries', 'Person'],
      },
    },
    {
      id: 'a12b5fa9-6065-4687-8e26-e0f78fd656c6',
      type: 'DEF',
      features: {
        canonicalTerm: 'Superior Company Proposal',
        definitionText: 'any bona fide, unsolicited written Company Takeover Proposal that if consummated would result in a Person or group owning ... fifty percent (50%) or more ... on terms which the Company Board determines ... would result in greater value to the stockholders of the Company ... than the Transactions',
        crossReferences: ['Company Takeover Proposal', 'Company Board', 'Transactions'],
      },
    },
  ];
}

test('nosolDefinitionChainRows finds both Metsera term variants from the deal\'s own DEF provisions', () => {
  const rows = mod.nosolDefinitionChainRows(metseraDefProvisions());
  const terms = rows.map((r) => r.term);
  assert.ok(terms.includes('Superior Company Proposal'));
  assert.ok(terms.includes('Company Takeover Proposal'));
});

test('Superior Company Proposal chains in Company Takeover Proposal one level deep (its own text literally names it, and it has its own DEF provision)', () => {
  const rows = mod.nosolDefinitionChainRows(metseraDefProvisions());
  const superior = rows.find((r) => r.term === 'Superior Company Proposal');
  assert.ok(superior.child, 'chained child present');
  assert.equal(superior.child.term, 'Company Takeover Proposal');
  assert.match(superior.child.text, /tender offer, exchange offer, merger/);
});

test('Company Takeover Proposal has no further chain (its crossReferences are generic terms with no DEF provision of their own)', () => {
  const rows = mod.nosolDefinitionChainRows(metseraDefProvisions());
  const takeover = rows.find((r) => r.term === 'Company Takeover Proposal');
  assert.equal(takeover.child, null);
});

test('never fabricates a chain: a crossReference not actually present in the definition text is not pulled in', () => {
  const provisions = [
    { id: 'p1', type: 'DEF', features: { canonicalTerm: 'Superior Proposal', definitionText: 'a proposal the Board determines is superior', crossReferences: ['Acquisition Proposal'] } },
    { id: 'p2', type: 'DEF', features: { canonicalTerm: 'Acquisition Proposal', definitionText: 'any proposal to acquire the Company' } },
  ];
  const rows = mod.nosolDefinitionChainRows(provisions);
  const superior = rows.find((r) => r.term === 'Superior Proposal');
  assert.equal(superior.child, null, 'crossReferences alone is not enough — the text must literally name it');
});

test('never fabricates a chain: a named reference with no matching DEF provision in this deal is not pulled in', () => {
  const provisions = [
    { id: 'p1', type: 'DEF', features: { canonicalTerm: 'Superior Company Proposal', definitionText: 'a Company Takeover Proposal the Board determines is superior', crossReferences: ['Company Takeover Proposal'] } },
    // No 'Company Takeover Proposal' DEF provision exists in this deal.
  ];
  const rows = mod.nosolDefinitionChainRows(provisions);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].child, null);
});

test('returns an empty array when neither target definition exists in this deal', () => {
  const rows = mod.nosolDefinitionChainRows([{ id: 'x', type: 'DEF', features: { canonicalTerm: 'Knowledge', definitionText: 'actual knowledge' } }]);
  assert.deepEqual(rows, []);
});

/* ── Wiring: NosolFourTables.js passes allProvisions through to the Key
   Definitions table as extraRows; pages/review/[id].js's NOSOL branch feeds
   allProvisions in. JSX source-text pattern per tests/fb3-wiring.test.js. */
const nosolTablesSrc = fs.readFileSync(path.join(__dirname, '..', 'components', 'review', 'NosolFourTables.js'), 'utf8');
const reviewSrc = fs.readFileSync(path.join(__dirname, '..', 'pages', 'review', '[id].js'), 'utf8');

test('NosolFourTables accepts allProvisions and wires nosolDefinitionChainRows into the Key Definitions table\'s extraRows', () => {
  assert.match(nosolTablesSrc, /export function NosolFourTables\(\{ provisions, allProvisions \}\)/);
  assert.match(nosolTablesSrc, /nosolDefinitionChainRows\(allProvisions \|\| provisions\)/);
  assert.match(nosolTablesSrc, /title="Key Definitions"[\s\S]{0,200}extraRows=\{defChainRows\}/);
});

test('the old dead placeholder definitions row (feature keys that no provision ever carries) was removed', () => {
  assert.ok(!/acquisitionTransactionDefinition/.test(nosolTablesSrc));
});

test('pages/review/[id].js passes allProvisions into NosolFourTables', () => {
  assert.match(reviewSrc, /<NosolFourTables provisions=\{provisions\} allProvisions=\{allProvisions\} \/>/);
});
