// FB3 item 4 — COND enrichment batch:
//   (a) continuingRequirement on the No-MAE closing condition (COND-B-MAE)
//   (b) resolveCondCitedProvisionNames — extends the resolveAocCovenantCitations
//       cite-resolution pattern to COND bring-down rep cites + consents cross-refs
//   (c) linkStockholderApprovalDefinition — DEF lookup onto COND-M-STOCKHOLDER
//   (d) antitrustApprovals — HSR + scheduled approvals as two separate tagged
//       items on the Antitrust condition (COND-M-REG), never one merged field
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  resolveCondCitedProvisionNames,
  linkStockholderApprovalDefinition,
  buildFeatureInstructions,
  buildSectionCiteIndex,
  expandSectionRanges,
  normalizeSectionCite,
} = require('../lib/parser-v2/extract.js');
const { getFeaturesForType } = require('../lib/rubric');
const { ANTITRUST_APPROVAL_CODES } = require('../lib/taxonomy');

function fieldFor(type, key) {
  return getFeaturesForType(type).find((f) => f.key === key);
}

/* ── (a) continuingRequirement schema + prompt ───────────────────────── */

test('continuingRequirement is registered on COND-B (the No-MAE condition family)', () => {
  const f = fieldFor('COND-B', 'continuingRequirement');
  assert.ok(f, 'COND-B must declare continuingRequirement');
  assert.equal(f.type, 'boolean');
});

test('the COND prompt anchors continuingRequirement on the "that is continuing" language', () => {
  const instr = buildFeatureInstructions('COND-B');
  assert.match(instr, /continuingRequirement/);
  assert.match(instr, /that is continuing/);
});

/* ── (d) antitrustApprovals: HSR + scheduled approvals as separate pills ── */

test('antitrustApprovals is registered on COND-M with the ANTITRUST_APPROVAL_CODES taxonomy', () => {
  const f = fieldFor('COND-M', 'antitrustApprovals');
  assert.ok(f, 'COND-M must declare antitrustApprovals');
  assert.ok(ANTITRUST_APPROVAL_CODES.HSR);
  assert.ok(ANTITRUST_APPROVAL_CODES.SCHEDULED_APPROVALS);
});

test('the COND-M prompt instructs HSR and scheduled approvals as two SEPARATE tagged items with no cite in the label', () => {
  const instr = buildFeatureInstructions('COND-M');
  assert.match(instr, /antitrustApprovals/);
  assert.match(instr, /TWO SEPARATE tagged items/);
  assert.match(instr, /Section\/Schedule cite in "label"/);
});

/* ── (c) linkStockholderApprovalDefinition ───────────────────────────── */

test('linkStockholderApprovalDefinition stamps the DEF core onto COND-M-STOCKHOLDER', () => {
  const def = {
    type: 'DEF',
    category: 'Company Stockholder Approval',
    features: {
      canonicalTerm: 'Company Stockholder Approval',
      definitionText: 'the affirmative vote of the holders of a majority of the outstanding shares of Company Common Stock entitled to vote thereon',
    },
  };
  const cond = { type: 'COND-M', code: 'COND-M-STOCKHOLDER', features: {} };
  linkStockholderApprovalDefinition([def, cond]);
  assert.equal(
    cond.features.approvalDefinition,
    'the affirmative vote of the holders of a majority of the outstanding shares of Company Common Stock entitled to vote thereon',
  );
});

test('linkStockholderApprovalDefinition leaves the field null/absent when no matching DEF exists', () => {
  const cond = { type: 'COND-M', code: 'COND-M-STOCKHOLDER', features: {} };
  linkStockholderApprovalDefinition([cond]);
  assert.equal(cond.features.approvalDefinition, undefined);
});

test('linkStockholderApprovalDefinition never overwrites an already-populated value', () => {
  const def = {
    type: 'DEF',
    category: 'Company Stockholder Approval',
    features: { definitionText: 'some definition' },
  };
  const cond = { type: 'COND-M', code: 'COND-M-STOCKHOLDER', features: { approvalDefinition: 'pre-existing' } };
  linkStockholderApprovalDefinition([def, cond]);
  assert.equal(cond.features.approvalDefinition, 'pre-existing');
});

/* ── (b) resolveCondCitedProvisionNames ──────────────────────────────── */

test('expandSectionRanges expands "Section 3.02(b) through Section 3.02(e)" into the four lettered cites', () => {
  const out = expandSectionRanges('Section 3.02(b) through Section 3.02(e)');
  assert.deepEqual(out, ['3.02(b)', '3.02(c)', '3.02(d)', '3.02(e)']);
});

test('buildSectionCiteIndex indexes REP-T sections by their bare sectionNumber', () => {
  const provisions = [
    { type: 'REP-T', category: 'Capital Structure', features: { sectionNumber: '3.02' } },
    { type: 'REP-T', category: 'Authority; Enforceability', features: { sectionNumber: '3.04' } },
  ];
  const idx = buildSectionCiteIndex(provisions, 'REP');
  assert.equal(idx.get(normalizeSectionCite('3.02')).name, 'Capital Structure');
  assert.equal(idx.get(normalizeSectionCite('3.04')).name, 'Authority; Enforceability');
});

test('resolveCondCitedProvisionNames resolves a bring-down tier\'s "reps_covered" cites — including a range — to REP names, bare-matching the sub-clause suffix', () => {
  const provisions = [
    { type: 'REP-T', category: 'Organization; Qualification; Standing', features: { sectionNumber: '3.01' } },
    { type: 'REP-T', category: 'Capital Structure', features: { sectionNumber: '3.02' } },
    { type: 'REP-T', category: 'Authority; Enforceability', features: { sectionNumber: '3.04' } },
    { type: 'REP-T', category: 'Brokers; Finders', features: { sectionNumber: '3.22' } },
    {
      type: 'COND-B',
      code: 'COND-B-REP',
      features: {
        bringDownTiers: [
          {
            standard: 'MAT_ALL_MATERIAL',
            reps_covered: 'Section 3.01 (first sentence only), Section 3.02(b) through Section 3.02(e), Section 3.04, Section 3.05(a)(i)(x), and Section 3.22',
          },
        ],
      },
    },
  ];
  resolveCondCitedProvisionNames(provisions);
  const cond = provisions.find((p) => p.code === 'COND-B-REP');
  const names = cond.features.citedProvisionNames;
  assert.ok(Array.isArray(names));
  const bySection = Object.fromEntries(names.map((n) => [n.section, n.name]));
  assert.equal(bySection['3.01'], 'Organization; Qualification; Standing');
  assert.equal(bySection['3.02(b)'], 'Capital Structure', 'range-expanded cite bare-matches the 3.02 rep');
  assert.equal(bySection['3.02(e)'], 'Capital Structure');
  assert.equal(bySection['3.04'], 'Authority; Enforceability');
  assert.equal(bySection['3.22'], 'Brokers; Finders');
});

test('resolveCondCitedProvisionNames never invents a name for an unresolvable cite', () => {
  const provisions = [
    {
      type: 'COND-S',
      code: 'COND-S-REP',
      features: { bringDownTiers: [{ standard: 'MAT_ALL_MATERIAL', reps_covered: 'Section 9.99' }] },
    },
  ];
  resolveCondCitedProvisionNames(provisions);
  const names = provisions[0].features.citedProvisionNames;
  assert.deepEqual(names, [{ section: '9.99', name: null }]);
});

test('resolveCondCitedProvisionNames is a no-op when there is nothing to resolve', () => {
  const cond = { type: 'COND-M', code: 'COND-M-LEGAL', features: { mainCondition: 'no legal restraint' } };
  resolveCondCitedProvisionNames([cond]);
  assert.equal('citedProvisionNames' in cond.features, false);
});
