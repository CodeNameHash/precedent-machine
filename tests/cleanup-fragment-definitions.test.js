// Item 16.3 (UI Feedback Round 3): scripts/cleanup-fragment-definitions.js
// is DRY-RUN BY DEFAULT -- these tests exercise only the pure planning
// helpers (no DB, no network, module.exports guarded behind
// `require.main === module`) to lock in the plan-building logic without
// ever touching a real deal.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const mod = require(path.join('..', 'scripts', 'cleanup-fragment-definitions.js'));

function isFragmentDefinedTerm(term) {
  const t = String(term || '').trim();
  if (t.length < 3) return true;
  const blocklist = new Set(['from', 'to the extent', 'made available', 'under common control with', 'wise', 'likewise', 'otherwise']);
  if (blocklist.has(t.toLowerCase())) return true;
  if (/^[a-z]/.test(t)) return true;
  return false;
}

test('module does not touch the DB / make any network calls at require() time', () => {
  // If it did, this require() at the top of the file would already have
  // thrown (no Supabase creds are set in the test environment).
  assert.equal(typeof mod.planFragmentDeletes, 'function');
  assert.equal(typeof mod.planDuplicateDeletes, 'function');
});

test('planFragmentDeletes flags fragment DEFINITION cards, leaves genuine defined terms untouched', () => {
  const cards = [
    { id: 'a', provision_type: 'DEFINITION', defined_term: 'from', section_ref: '1.01' },
    { id: 'b', provision_type: 'DEFINITION', defined_term: 'wise', section_ref: '1.01' },
    { id: 'c', provision_type: 'DEFINITION', defined_term: 'knowledge', section_ref: '1.01' },
    { id: 'd', provision_type: 'DEFINITION', defined_term: 'Material Adverse Effect', section_ref: '1.01' },
    { id: 'e', provision_type: 'DEFINITION', defined_term: 'Applicable Date', section_ref: '1.01' },
  ];
  const deletes = mod.planFragmentDeletes(cards, isFragmentDefinedTerm);
  assert.deepEqual(deletes.map((d) => d.id).sort(), ['a', 'b', 'c']);
});

test('planFragmentDeletes never touches non-DEFINITION cards even if defined_term happens to be set', () => {
  const cards = [
    { id: 'a', provision_type: 'COVENANT_OTHER', defined_term: 'from', short_title: 'Some covenant' },
  ];
  const deletes = mod.planFragmentDeletes(cards, isFragmentDefinedTerm);
  assert.deepEqual(deletes, []);
});

// Regression (live Theravance dry-run, before this fix): 52 of 57 DEFINITION
// cards on Theravance have defined_term = NULL in the DB -- an entirely
// different, out-of-scope data issue (a definition that never got a term
// assigned), not the lowercase/stopword fragment junk this pass targets.
// isFragmentDefinedTerm(null) returns true (empty string < 3 chars), so
// without an explicit truthiness guard this pass would have swept every
// null-defined_term row into a fragment-cleanup delete.
test('planFragmentDeletes never flags a DEFINITION card with a null/empty defined_term (a different, out-of-scope data issue)', () => {
  const cards = [
    { id: 'a', provision_type: 'DEFINITION', defined_term: null, section_ref: '2.1 | General Definitions Section' },
    { id: 'b', provision_type: 'DEFINITION', defined_term: '', section_ref: '2.1' },
    { id: 'c', provision_type: 'DEFINITION', defined_term: 'wise', section_ref: '9.5' },
  ];
  const deletes = mod.planFragmentDeletes(cards, isFragmentDefinedTerm);
  assert.deepEqual(deletes.map((d) => d.id), ['c'], 'only the real fragment ("wise") should be flagged, never the null/empty rows');
});

test('planDuplicateDeletes collapses two same-deal cards sharing (section_ref, short_title, provision_subtype), keeping the longer text', () => {
  const cards = [
    { id: '5eea8833', provision_type: 'COVENANT_ANTITRUST', provision_subtype: 'ANTI-INFO', section_ref: '6.1 | Information to Regulators | x', short_title: 'Information to Regulators', primary_quote: 'Short.' },
    { id: 'a2e67986', provision_type: 'COVENANT_ANTITRUST', provision_subtype: 'ANTI-INFO', section_ref: '6.1 | Information to Regulators | y', short_title: 'Information to Regulators', primary_quote: 'A much longer, more complete captured version of this same provision.' },
  ];
  const deletes = mod.planDuplicateDeletes(cards);
  assert.equal(deletes.length, 1);
  assert.equal(deletes[0].id, '5eea8833', 'the SHORTER card must be the one flagged for deletion');
  assert.equal(deletes[0].keptId, 'a2e67986');
});

test('planDuplicateDeletes leaves non-duplicate provisions in the same section untouched', () => {
  const cards = [
    { id: 'a', provision_type: 'COVENANT_ANTITRUST', provision_subtype: 'ANTI-FOREIGN', section_ref: '6.1', short_title: 'Foreign Regulatory Approvals', primary_quote: 'text a' },
    { id: 'b', provision_type: 'COVENANT_ANTITRUST', provision_subtype: 'ANTI-LIT', section_ref: '6.1', short_title: 'Litigation Against Regulators', primary_quote: 'text b' },
  ];
  assert.deepEqual(mod.planDuplicateDeletes(cards), []);
});

test('planDuplicateDeletes never flags DEFINITION cards (those go through the fragment pass, not the duplicate pass)', () => {
  const cards = [
    { id: 'a', provision_type: 'DEFINITION', section_ref: '1.01', short_title: 'Material Adverse Effect', primary_quote: 'def a' },
    { id: 'b', provision_type: 'DEFINITION', section_ref: '1.01', short_title: 'Material Adverse Effect', primary_quote: 'def b, longer' },
  ];
  assert.deepEqual(mod.planDuplicateDeletes(cards), []);
});

test('formatPlanReport prints deal + term for every flagged deletion and a summary count', () => {
  const plan = mod.buildDealPlan('Theravance (acquired by X) [deal-id]', [
    { id: 'a', provision_type: 'DEFINITION', defined_term: 'wise', section_ref: '1.01' },
    { id: 'b', provision_type: 'COVENANT_ANTITRUST', provision_subtype: 'ANTI-INFO', section_ref: '6.1', short_title: 'Information to Regulators', primary_quote: 'short' },
    { id: 'c', provision_type: 'COVENANT_ANTITRUST', provision_subtype: 'ANTI-INFO', section_ref: '6.1', short_title: 'Information to Regulators', primary_quote: 'a longer duplicate text here' },
  ], isFragmentDefinedTerm);
  const report = mod.formatPlanReport([plan]);
  assert.match(report, /Theravance/);
  assert.match(report, /"wise"/);
  assert.match(report, /Information to Regulators/);
  assert.match(report, /Total: 1 fragment definition\(s\), 1 duplicate card\(s\) flagged/);
});
