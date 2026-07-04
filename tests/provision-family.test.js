/* FB3 (provision card view, Surface 1) — components/review/provision-family.js.
   Run: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

let mod;
test.before(async () => {
  mod = await import(path.join('..', 'components', 'review', 'provision-family.js'));
});

function prov(id, { type, category, section, code, text }) {
  return {
    id,
    type,
    category,
    full_text: text || `text for ${id}`,
    ai_metadata: { code, features: section ? { sectionNumber: section } : {} },
  };
}

test('getSectionNumber reads ai_metadata.features.sectionNumber', () => {
  const p = prov('a', { type: 'NOSOL-T', category: 'No-Shop', section: '5.3(b)' });
  assert.equal(mod.getSectionNumber(p), '5.3(b)');
});

test('getSectionNumber falls back to provision.section_number, else empty string', () => {
  assert.equal(mod.getSectionNumber({ section_number: '4.01' }), '4.01');
  assert.equal(mod.getSectionNumber({}), '');
  assert.equal(mod.getSectionNumber(null), '');
});

test('sectionRoot drops sub-clause parens but keeps the numeric path', () => {
  assert.equal(mod.sectionRoot('5.3(b)(ii)'), '5.3');
  assert.equal(mod.sectionRoot('5.3'), '5.3');
  assert.equal(mod.sectionRoot('Article V'), null);
  assert.equal(mod.sectionRoot(''), null);
});

test('codeFamilyRoot strips a trailing split-index suffix', () => {
  assert.equal(mod.codeFamilyRoot('NOSOL-EXCEPTION-2'), 'NOSOL-EXCEPTION');
  assert.equal(mod.codeFamilyRoot('COND-FRUSTRATE'), 'COND-FRUSTRATE');
  assert.equal(mod.codeFamilyRoot(null), null);
});

test('buildProvisionFamily: a single, unsplit provision is its own family', () => {
  const p = prov('a', { type: 'REP-T', category: 'Authority', section: '3.04', code: 'REP-T-AUTH' });
  const { isSplit, parts, parent } = mod.buildProvisionFamily(p, [p]);
  assert.equal(isSplit, false);
  assert.equal(parts.length, 1);
  assert.equal(parent.id, 'a');
  assert.equal(parent.isSynthetic, false);
});

test('buildProvisionFamily: groups siblings sharing a section-number root, in agreement order', () => {
  const a = prov('a', { type: 'NOSOL-T', category: 'No-Shop', section: '5.3(a)', code: 'NOSOL-CEASE' });
  const b = prov('b', { type: 'NOSOL-T', category: 'No-Shop', section: '5.3(b)', code: 'NOSOL-CHANGEREC' });
  const c = prov('c', { type: 'NOSOL-T', category: 'No-Shop', section: '5.3(c)', code: 'NOSOL-EXCEPTIONS' });
  const unrelated = prov('u', { type: 'NOSOL-T', category: 'No-Shop', section: '5.4', code: 'NOSOL-OTHER' });
  const other_type = prov('o', { type: 'NOSOL-B', category: 'No-Shop', section: '5.3(a)', code: 'NOSOL-CEASE' });

  const { isSplit, parts, parent } = mod.buildProvisionFamily(b, [c, a, b, unrelated, other_type]);
  assert.equal(isSplit, true);
  assert.deepEqual(parts.map((p) => p.id), ['a', 'b', 'c']); // agreement order, not input order
  assert.equal(parent.isSynthetic, true);
  assert.equal(parent.sectionNumber, '5.3');
  assert.ok(parent.full_text.includes('text for a'));
  assert.ok(parent.full_text.includes('text for b'));
  assert.ok(parent.full_text.includes('text for c'));
  assert.ok(!parent.full_text.includes('text for u'));
});

test('buildProvisionFamily: groups by shared taxonomy-code root when section numbers are absent', () => {
  const a = prov('a', { type: 'COND', category: 'Frustration', code: 'COND-FRUSTRATE-1' });
  const b = prov('b', { type: 'COND', category: 'Frustration', code: 'COND-FRUSTRATE-2' });
  const { isSplit, parts } = mod.buildProvisionFamily(a, [a, b]);
  assert.equal(isSplit, true);
  assert.equal(parts.length, 2);
});

test('buildProvisionFamily: a category mismatch never merges even with a matching section root', () => {
  const a = prov('a', { type: 'COV', category: 'Insurance', section: '6.10' });
  const b = prov('b', { type: 'COV', category: 'Employee Matters', section: '6.10' });
  const { isSplit, parts } = mod.buildProvisionFamily(a, [a, b]);
  assert.equal(isSplit, false);
  assert.equal(parts.length, 1);
});

test('buildProvisionFamily: a provision with no section number AND no code never over-groups with same-type/category siblings', () => {
  const a = prov('a', { type: 'MISC', category: 'General' });
  const b = prov('b', { type: 'MISC', category: 'General' });
  const { isSplit, parts } = mod.buildProvisionFamily(a, [a, b]);
  assert.equal(isSplit, false);
  assert.equal(parts.length, 1);
});
