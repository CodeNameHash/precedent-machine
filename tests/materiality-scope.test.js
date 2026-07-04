// FB3 item 1 — materialityScopeType, mirroring the knowledgeScopeType audit
// fix (tests/knowledge-scope-type.test.js) exactly. Unlike knowledgeQualifier
// (synthesized from scratch by a post-pass off a regex match),
// materialityQualifier is ALREADY an LLM-authored tagged object — so the
// post-pass here only needs to fold the clause-level materialityScopeType
// onto the existing object's "scope" key, never inventing one.
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  linkMaterialityScopeToReps,
  buildFeatureInstructions,
} = require('../lib/parser-v2/extract.js');
const { getFeaturesForType } = require('../lib/rubric');

function fieldFor(type, key) {
  return getFeaturesForType(type).find((f) => f.key === key);
}

test('materialityScopeType is registered in the feature schema for REP-T and REP-B', () => {
  for (const type of ['REP-T', 'REP-B']) {
    const f = fieldFor(type, 'materialityScopeType');
    assert.ok(f, `${type} must declare materialityScopeType`);
    assert.equal(f.type, 'enum');
    assert.deepEqual(f.options, ['ENTIRE_REP', 'PARTIAL']);
    assert.equal(f.scope, 'clause');
    // Must be LLM-populated (no `source` annotation) — the post-pass only
    // folds it onto materialityQualifier.scope, it doesn't invent it.
    assert.equal(f.source, undefined);
  }
});

test('the REP-T/REP-B prompt asks for materialityScopeType with both anchored examples', () => {
  const instr = buildFeatureInstructions('REP-T');
  assert.match(instr, /materialityScopeType/);
  assert.match(instr, /ENTIRE_REP/);
  assert.match(instr, /PARTIAL/);
  assert.match(instr, /the qualifier opens the sentence and every clause after it is materiality-qualified/);
  assert.match(instr, /only the second sentence carries a materiality qualifier/);
});

test('linkMaterialityScopeToReps folds ENTIRE_REP onto the bare tagged materialityQualifier object', () => {
  const rep = {
    type: 'REP-T',
    category: 'Compliance with Laws',
    features: {
      materialityScopeType: 'ENTIRE_REP',
      materialityQualifier: { code: 'MAT_MAE_AGGREGATE', label: 'MAE', text: 'except as would not have an MAE' },
    },
  };
  linkMaterialityScopeToReps([rep]);
  assert.equal(rep.features.materialityQualifier.scope, 'ENTIRE_REP');
});

test('linkMaterialityScopeToReps folds PARTIAL onto the citable-wrapped { value, quotes } shape', () => {
  const rep = {
    type: 'REP-B',
    category: 'Taxes',
    features: {
      materialityScopeType: 'PARTIAL',
      materialityQualifier: {
        value: { code: 'MAT_MATERIAL_INLINE', label: 'Materiality inline', text: 'all material Tax Returns' },
        quotes: [],
      },
    },
  };
  linkMaterialityScopeToReps([rep]);
  assert.equal(rep.features.materialityQualifier.value.scope, 'PARTIAL');
});

test('scope is never invented — a materiality-qualified rep with no materialityScopeType gets no scope key', () => {
  const rep = {
    type: 'REP-T',
    category: 'Litigation',
    features: {
      materialityQualifier: { code: 'MAT_MATERIAL_TO_COMPANY', label: 'Material to Company', text: 'would not be material' },
    },
  };
  linkMaterialityScopeToReps([rep]);
  assert.equal('scope' in rep.features.materialityQualifier, false);
});

test('a rep with no materialityQualifier at all is left untouched', () => {
  const rep = {
    type: 'REP-T',
    category: 'Organization',
    features: { materialityScopeType: 'ENTIRE_REP' },
  };
  linkMaterialityScopeToReps([rep]);
  assert.equal(rep.features.materialityQualifier, undefined);
});

test('an already-set scope is never overwritten', () => {
  const rep = {
    type: 'REP-T',
    category: 'Litigation',
    features: {
      materialityScopeType: 'PARTIAL',
      materialityQualifier: { code: 'MAT_ALL_MATERIAL', label: 'In all material respects', text: '...', scope: 'ENTIRE_REP' },
    },
  };
  linkMaterialityScopeToReps([rep]);
  assert.equal(rep.features.materialityQualifier.scope, 'ENTIRE_REP');
});
