// FB3 item 6 — MISC batch:
//   (a) linkWillfulBreachDefinition: deterministic post-pass finds the DEF
//       "Willful Breach" definition and stamps its verbatim core onto MISC
//       provisions carrying the willfulBreachDefinition field, when the LLM
//       left it null (the concept is usually DEFINED elsewhere in the
//       agreement, not restated inline on the remedies section).
//   (b) forumCourts / forumFallback: the governing-law/jurisdiction provision
//       must name the actual court(s) verbatim — never a bare boolean.
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  findDefinitionByTerm,
  linkWillfulBreachDefinition,
  buildFeatureInstructions,
} = require('../lib/parser-v2/extract.js');
const { getFeaturesForType } = require('../lib/rubric');

function fieldFor(type, key) {
  return getFeaturesForType(type).find((f) => f.key === key);
}

/* ── (a) willful breach ──────────────────────────────────────────────── */

test('willfulBreachDefinition is already registered on MISC (schema unchanged — only the post-pass is new)', () => {
  assert.ok(fieldFor('MISC', 'willfulBreachDefinition'));
});

test('findDefinitionByTerm matches the Metsera "willful and material breach" DEF phrasing', () => {
  const def = {
    type: 'DEF',
    category: 'Willful Breach',
    features: {
      canonicalTerm: 'Willful Breach',
      definitionText: '"willful and material breach" means a material breach of, or a material failure to perform, any representation, warranty or covenant set forth in this Agreement, in each case that is the consequence of an intentional act or intentional omission by a party with the actual knowledge that the taking of such act or failure to take such action would cause a breach of this Agreement.',
    },
  };
  const hit = findDefinitionByTerm([def], /willful(?:\s+(?:and|or)\s+material)?\s+breach/i);
  assert.equal(hit, def);
});

test('linkWillfulBreachDefinition stamps the DEF core onto a MISC provision whose LLM value was left null', () => {
  const def = {
    type: 'DEF',
    category: 'Willful Breach',
    features: { canonicalTerm: 'Willful Breach', definitionText: 'a material breach that is intentional' },
  };
  const misc = { type: 'MISC', category: 'Survival', features: { willfulBreachDefinition: null } };
  linkWillfulBreachDefinition([def, misc]);
  assert.equal(misc.features.willfulBreachDefinition, 'a material breach that is intentional');
});

test('linkWillfulBreachDefinition never overwrites an already-populated value', () => {
  const def = {
    type: 'DEF',
    category: 'Willful Breach',
    features: { definitionText: 'new definition' },
  };
  const misc = { type: 'MISC', category: 'Survival', features: { willfulBreachDefinition: 'already extracted inline' } };
  linkWillfulBreachDefinition([def, misc]);
  assert.equal(misc.features.willfulBreachDefinition, 'already extracted inline');
});

test('linkWillfulBreachDefinition leaves the field untouched (does not add the key) when no DEF exists anywhere in the deal', () => {
  const misc = { type: 'MISC', category: 'Survival', features: {} };
  linkWillfulBreachDefinition([misc]);
  assert.equal('willfulBreachDefinition' in misc.features, false);
});

test('linkWillfulBreachDefinition only stamps MISC provisions that already declare the field (never invents the key elsewhere)', () => {
  const def = {
    type: 'DEF',
    category: 'Willful Breach',
    features: { definitionText: 'a material breach that is intentional' },
  };
  const termf = { type: 'TERMF', code: 'TERMF-SOLE', features: { willfulBreachException: true } };
  linkWillfulBreachDefinition([def, termf]);
  assert.equal('willfulBreachDefinition' in termf.features, false);
});

/* ── (b) forum courts / fallback ─────────────────────────────────────── */

test('forumCourts (list) and forumFallback (text) are registered on MISC — no bare boolean', () => {
  const courts = fieldFor('MISC', 'forumCourts');
  const fallback = fieldFor('MISC', 'forumFallback');
  assert.ok(courts);
  assert.equal(courts.type, 'list');
  assert.ok(fallback);
  assert.equal(fallback.type, 'text');
});

test('the MISC prompt instructs forumCourts to capture every named court verbatim, never a bare boolean', () => {
  const instr = buildFeatureInstructions('MISC');
  assert.match(instr, /forumCourts/);
  assert.match(instr, /NEVER return a bare boolean/);
  assert.match(instr, /forumFallback/);
});
