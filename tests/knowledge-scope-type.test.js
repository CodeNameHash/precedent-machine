// Regression tests for the knowledgeScopeType audit fix: the review UI has
// supported display.scope ('Entire rep' / 'Partial: …') on the per-rep
// Knowledge Qualifier cell (components/review/table-logic.js,
// knowledgeQualifierDisplay) since fb2 block 2c, but extraction never emitted
// it — the LLM had no field to populate and no per-rep knowledgeQualifier
// value ever reached an individual rep row (it was an article-wide boolean
// that could only land on the shared preamble row). This wires a new
// clause-scoped LLM field, knowledgeScopeType (ENTIRE_REP / PARTIAL), through
// linkKnowledgeScopeToReps into the exact contract the UI already reads:
// features.knowledgeQualifier = { code, label, text, scope }.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const {
  linkKnowledgeScopeToReps,
  buildFeatureInstructions,
} = require('../lib/parser-v2/extract.js');
const { getFeaturesForType } = require('../lib/rubric');

function fieldFor(type, key) {
  return getFeaturesForType(type).find((f) => f.key === key);
}

test('knowledgeScopeType is registered in the feature schema for REP-T and REP-B', () => {
  for (const type of ['REP-T', 'REP-B']) {
    const f = fieldFor(type, 'knowledgeScopeType');
    assert.ok(f, `${type} must declare knowledgeScopeType`);
    assert.equal(f.type, 'enum');
    assert.deepEqual(f.options, ['ENTIRE_REP', 'PARTIAL']);
    assert.equal(f.scope, 'clause');
    // Must be LLM-populated (no `source` annotation) — unlike knowledgeScope,
    // which is stamped deterministically by post-processing.
    assert.equal(f.source, undefined);
  }
});

test('the REP-T/REP-B prompt asks for knowledgeScopeType with both anchored examples', () => {
  const instr = buildFeatureInstructions('REP-T');
  assert.match(instr, /knowledgeScopeType/);
  assert.match(instr, /ENTIRE_REP/);
  assert.match(instr, /PARTIAL/);
  // Anchored examples: chapeau-level ("To the Knowledge of the Company, the
  // Company is not in violation...") vs limb-only qualification.
  assert.match(instr, /the qualifier opens the sentence and every clause after it is knowledge-qualified/);
  assert.match(instr, /only the second sentence is knowledge-qualified/);
});

test('linkKnowledgeScopeToReps stamps features.knowledgeQualifier.scope = "ENTIRE_REP" when the LLM classified the whole rep', () => {
  const rep = {
    type: 'REP-T',
    category: 'Compliance with Laws',
    text: 'To the Knowledge of the Company, the Company is not in violation of any Law applicable to it.',
    features: { knowledgeScopeType: 'ENTIRE_REP' },
  };
  linkKnowledgeScopeToReps([rep]);
  assert.ok(rep.features.knowledgeQualifier, 'knowledgeQualifier must be stamped');
  assert.equal(rep.features.knowledgeQualifier.code, 'KNOWLEDGE_QUALIFIED');
  assert.equal(rep.features.knowledgeQualifier.scope, 'ENTIRE_REP');
});

test('linkKnowledgeScopeToReps stamps features.knowledgeQualifier.scope = "PARTIAL" when the LLM classified only a limb', () => {
  const rep = {
    type: 'REP-B',
    category: 'Litigation',
    text: "Parent has not received any written notice of any pending Proceeding. Parent is not, to Parent's Knowledge, under investigation by any Governmental Entity.",
    features: { knowledgeScopeType: 'PARTIAL' },
  };
  linkKnowledgeScopeToReps([rep]);
  assert.equal(rep.features.knowledgeQualifier.scope, 'PARTIAL');
});

test('scope is never invented — a knowledge-qualified rep with no knowledgeScopeType gets a plain pill, no scope key', () => {
  const rep = {
    type: 'REP-T',
    category: 'Litigation',
    text: 'To the Knowledge of the Company, there is no pending Legal Proceeding.',
    features: {},
  };
  linkKnowledgeScopeToReps([rep]);
  assert.ok(rep.features.knowledgeQualifier);
  assert.equal('scope' in rep.features.knowledgeQualifier, false);
});

test('a rep with no knowledge qualifier at all gets no knowledgeQualifier stamp', () => {
  const rep = {
    type: 'REP-T',
    category: 'Organization',
    text: 'The Company is duly organized and validly existing under the laws of Delaware.',
    features: {},
  };
  linkKnowledgeScopeToReps([rep]);
  assert.equal(rep.features.knowledgeQualifier, undefined);
});

test('end-to-end UI contract: knowledgeQualifierDisplay renders "entire" / "partial" from the stamped value', async () => {
  const mod = await import(path.join('..', 'components', 'review', 'table-logic.js'));
  const entireRep = {
    type: 'REP-T',
    text: 'To the Knowledge of the Company, the Company is not in violation of any Law.',
    features: { knowledgeScopeType: 'ENTIRE_REP' },
  };
  linkKnowledgeScopeToReps([entireRep]);
  const entireDisplay = mod.knowledgeQualifierDisplay(entireRep.features.knowledgeQualifier);
  assert.equal(entireDisplay.scope, 'entire');

  const partialRep = {
    type: 'REP-T',
    text: "The Company has not received notice. The Company is not, to the Knowledge of the Company, under investigation.",
    features: { knowledgeScopeType: 'PARTIAL' },
  };
  linkKnowledgeScopeToReps([partialRep]);
  const partialDisplay = mod.knowledgeQualifierDisplay(partialRep.features.knowledgeQualifier);
  assert.equal(partialDisplay.scope, 'partial');
});
