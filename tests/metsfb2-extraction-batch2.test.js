/* ─────────────────────────────────────────────────────────────────────────
   tests/metsfb2-extraction-batch2.test.js — MetsFB2 extraction batch 2.

   Item 1  Absence-of-Changes "No MAE since [date]" limbs + deterministic
           IOC-cite → covenant-name resolution.
   Item 2  No-Other-Reps / Non-Reliance (Abry) fields.
   Item 3  TERMF plain-English trigger codes + prompt discipline.
   Item 4  Knowledge-definition scope stamped onto knowledge-qualified reps.
   ───────────────────────────────────────────────────────────────────────── */

const { test } = require('node:test');
const assert = require('node:assert');

const {
  buildFeatureInstructions,
  normalizeSectionCite,
  resolveAocCovenantCitations,
  findKnowledgeDefinitions,
  linkKnowledgeScopeToReps,
} = require('../lib/parser-v2/extract');
const { refineSubCode } = require('../lib/parser-v2/classify');
const { TERMF_TRIGGER_CODES } = require('../lib/taxonomy');
const { getFeaturesForType, FEATURES } = require('../lib/rubric');
const { validateFeatures } = require('../lib/feature-validation');

// ───────────────────────── Item 1: AoC No-MAE + cite resolution ──────────

test('REP-T prompt asks for the AoC No-MAE and ordinary-course limbs, but never for post-pass keys', () => {
  const instr = buildFeatureInstructions('REP-T');
  assert.match(instr, /aocNoMaePresent/);
  assert.match(instr, /aocNoMaeSinceDate/);
  assert.match(instr, /aocOrdinaryCourseLimb/);
  assert.match(instr, /aocCitedCovenantSections/);
  // Post-pass-populated keys must NOT be requested from the model.
  assert.ok(!instr.includes('aocCitedCovenantNames'));
  assert.ok(!instr.includes('knowledgeScope'));
  // The pre-existing post-pass key is now excluded from prompts too.
  assert.ok(!instr.includes('linkedBringDownStandard'));
});

test('normalizeSectionCite collapses zero-padding, case, and "Section" prefixes', () => {
  assert.equal(normalizeSectionCite('Section 5.01(a)'), '5.1(a)');
  assert.equal(normalizeSectionCite('5.1(A)'), '5.1(a)');
  assert.equal(normalizeSectionCite('5.01'), '5.1');
  assert.equal(normalizeSectionCite('5.10(b)'), '5.10(b)'); // 5.10 ≠ 5.1
  assert.equal(normalizeSectionCite('no cite here'), null);
});

function iocProvision(sectionNumber, category) {
  return {
    type: 'IOC',
    code: 'IOC-OTHER',
    category,
    text: `The Company shall not ${category.toLowerCase()}.`,
    features: { sectionNumber },
  };
}

test('resolveAocCovenantCitations resolves cites to covenant names; unresolved cites keep the bare number', () => {
  const rep = {
    type: 'REP-T',
    code: 'REP-T-NOCHANGE',
    category: 'Absence of Certain Changes or Events',
    text: 'Since December 31, 2024, there has not been a Company Material Adverse Effect.',
    features: {
      aocNoMaePresent: true,
      aocNoMaeSinceDate: 'December 31, 2024',
      aocOrdinaryCourseLimb:
        'the business of the Company has been conducted in the ordinary course in all material respects, other than actions taken in respect of Sections 5.01(b) and 5.01(d)',
      aocCitedCovenantSections: ['5.01(b)', '5.01(d)', '5.01(z)'],
    },
  };
  const provisions = [
    rep,
    iocProvision('5.01(b)', 'Dividends and Distributions'),
    iocProvision('5.01(d)', 'Dispositions of Assets'),
    // no 5.01(z) provision — must stay unresolved, never invented
  ];
  resolveAocCovenantCitations(provisions);
  assert.deepEqual(rep.features.aocCitedCovenantNames, [
    { section: '5.01(b)', name: 'Dividends and Distributions' },
    { section: '5.01(d)', name: 'Dispositions of Assets' },
    { section: '5.01(z)', name: null },
  ]);
});

test('resolveAocCovenantCitations expands "(a) through (d)" ranges from the ordinary-course limb', () => {
  const rep = {
    type: 'REP-T',
    code: 'REP-T-NOCHANGE',
    category: 'Absence of Certain Changes',
    text: 'Absence of changes rep.',
    features: {
      aocOrdinaryCourseLimb:
        'other than actions taken in respect of Sections 5.01(a) through (d) of this Agreement',
      aocCitedCovenantSections: ['5.01(a)', '5.01(d)'],
    },
  };
  const provisions = [
    rep,
    iocProvision('5.01(a)', 'Organizational Documents'),
    iocProvision('5.01(b)', 'Dividends and Distributions'),
    iocProvision('5.01(c)', 'Equity Issuances'),
    iocProvision('5.01(d)', 'Dispositions of Assets'),
  ];
  resolveAocCovenantCitations(provisions);
  assert.deepEqual(rep.features.aocCitedCovenantNames, [
    { section: '5.01(a)', name: 'Organizational Documents' },
    { section: '5.01(b)', name: 'Dividends and Distributions' },
    { section: '5.01(c)', name: 'Equity Issuances' },
    { section: '5.01(d)', name: 'Dispositions of Assets' },
  ]);
});

test('resolveAocCovenantCitations matches across zero-padding variants (5.1 vs 5.01)', () => {
  const rep = {
    type: 'REP-T',
    code: 'REP-T-NOCHANGE',
    category: 'Absence of Changes',
    text: 'rep',
    features: { aocCitedCovenantSections: ['Section 5.1(b)'] },
  };
  const provisions = [rep, iocProvision('5.01(b)', 'Indebtedness')];
  resolveAocCovenantCitations(provisions);
  assert.deepEqual(rep.features.aocCitedCovenantNames, [
    { section: 'Section 5.1(b)', name: 'Indebtedness' },
  ]);
});

test('resolveAocCovenantCitations leaves reps without cites untouched', () => {
  const rep = {
    type: 'REP-T',
    code: 'REP-T-NOCHANGE',
    category: 'Absence of Changes',
    text: 'rep',
    features: { aocNoMaePresent: true, aocCitedCovenantSections: [] },
  };
  resolveAocCovenantCitations([rep, iocProvision('5.01(a)', 'Anything')]);
  assert.equal(rep.features.aocCitedCovenantNames, undefined);
});

// ───────────────────────── Item 2: No-Other-Reps / Abry fields ────────────

test('Abry fields: present with fraud carve-out validates cleanly on REP-B-ANTIRELIANCE', () => {
  const features = {
    canonicalCode: 'REP-B-ANTIRELIANCE',
    mainConcept: 'Parent and Merger Sub disclaim reliance on extra-contractual representations.',
    language: 'Except for the representations and warranties expressly set forth in Article III...',
    noOtherRepsPresent: true,
    noOtherRepsParty: 'COMPANY',
    nonRelianceClause:
      'each of Parent and Merger Sub acknowledges that it has not relied upon any representation or warranty other than those expressly set forth in Article III',
    extraContractualClaimsWaived: true,
    fraudCarveout: 'nothing in this Section 4.08 shall limit any claim for fraud',
  };
  const { errors, warnings } = validateFeatures('REP-B', features);
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings.filter((w) => w.kind === 'unknown-key'), []);
});

test('Abry fields: present with NO fraud carve-out — silence stays null and validates cleanly', () => {
  const features = {
    canonicalCode: 'REP-B-ANTIRELIANCE',
    mainConcept: 'Anti-reliance provision.',
    noOtherRepsPresent: true,
    noOtherRepsParty: 'COMPANY',
    nonRelianceClause: 'Parent has not relied on any representation not expressly set forth herein.',
    extraContractualClaimsWaived: true,
    fraudCarveout: null, // agreement silent on fraud — legally meaningful, never fabricated
  };
  const { errors, warnings } = validateFeatures('REP-B', features);
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings.filter((w) => w.kind === 'unknown-key'), []);
  assert.equal(features.fraudCarveout, null);
});

test('Abry fields: BOTH-parties variant validates on the company-side REP-T-NOREP code', () => {
  const features = {
    canonicalCode: 'REP-T-NOREP',
    mainConcept: 'Mutual no-other-reps provision.',
    noOtherRepsPresent: true,
    noOtherRepsParty: 'BOTH',
    nonRelianceClause:
      'each party acknowledges that no party has relied on any representation other than those expressly set forth in this Agreement',
    extraContractualClaimsWaived: false,
    fraudCarveout: null,
  };
  const { errors, warnings } = validateFeatures('REP-T', features);
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings.filter((w) => w.kind === 'unknown-key' || w.kind === 'enum-mismatch'), []);
  // The enum must accept exactly the three canonical parties.
  const schema = getFeaturesForType('REP-T', 'REP-T-NOREP');
  const party = schema.find((f) => f.key === 'noOtherRepsParty');
  assert.deepEqual(party.options, ['COMPANY', 'PARENT', 'BOTH']);
});

test('Abry fields: absent — all fields null/false on an ordinary rep validates cleanly', () => {
  const features = {
    mainConcept: 'Organization and good standing.',
    noOtherRepsPresent: false,
    noOtherRepsParty: null,
    nonRelianceClause: null,
    extraContractualClaimsWaived: false,
    fraudCarveout: null,
  };
  for (const type of ['REP-T', 'REP-B']) {
    const { errors, warnings } = validateFeatures(type, features);
    assert.deepEqual(errors, [], `${type} errors`);
    assert.deepEqual(warnings.filter((w) => w.kind === 'unknown-key'), [], `${type} unknown keys`);
  }
});

test('No-Other-Reps sections are captured (coded) wherever they land: REP-T, REP-B, COV, MISC', () => {
  const landings = [
    { type: 'REP-T', expected: 'REP-T-NOREP' },
    { type: 'REP-B', expected: 'REP-B-ANTIRELIANCE' },
    { type: 'COV', expected: 'REP-B-ANTIRELIANCE' },
    { type: 'MISC', expected: 'REP-B-ANTIRELIANCE' },
  ];
  for (const { type, expected } of landings) {
    for (const title of ['No Other Representations and Warranties', 'Non-Reliance']) {
      assert.equal(
        refineSubCode({ title }, type),
        expected,
        `${title} under ${type}`,
      );
    }
  }
  // The Abry schema is registered for every landing code.
  for (const code of ['REP-T-NOREP', 'REP-B-NOREP', 'REP-B-ANTIRELIANCE']) {
    const keys = (FEATURES[code] || []).map((f) => f.key);
    for (const k of ['noOtherRepsPresent', 'noOtherRepsParty', 'nonRelianceClause', 'extraContractualClaimsWaived', 'fraudCarveout']) {
      assert.ok(keys.includes(k), `${code} schema has ${k}`);
    }
  }
});

test('REP prompts carry the Abry extraction rules (both articles)', () => {
  for (const type of ['REP-T', 'REP-B']) {
    const instr = buildFeatureInstructions(type);
    assert.match(instr, /NO-OTHER-REPS \/ NON-RELIANCE \(ABRY\) RULES/, type);
    assert.match(instr, /noOtherRepsPresent/, type);
    assert.match(instr, /fraudCarveout/, type);
    assert.match(instr, /SILENCE IS LEGALLY MEANINGFUL/, type);
    assert.match(instr, /Abry Partners/, type);
  }
});

// ───────────────────────── Item 3: TERMF plain-English triggers ───────────

test('TERMF_TRIGGER_CODES is a stable dictionary of plain-English trigger labels', () => {
  // Codes are stable cross-deal identifiers — renaming any of these breaks
  // stored data. Add new codes; never rename.
  for (const code of [
    'SUPERIOR_PROPOSAL', 'RECOMMENDATION_CHANGE', 'NO_SOLICIT_BREACH',
    'NAKED_NO_VOTE', 'TAIL', 'NO_VOTE', 'OUTSIDE_DATE',
    'COMPANY_BREACH', 'PARENT_BREACH', 'ANTITRUST_FAILURE',
    'FINANCING_FAILURE', 'OTHER',
  ]) {
    assert.ok(TERMF_TRIGGER_CODES[code], `missing ${code}`);
  }
  // Labels are what a partner would say — no section cross-references.
  for (const [code, label] of Object.entries(TERMF_TRIGGER_CODES)) {
    assert.ok(!/section\s+\d/i.test(label), `${code} label parrots a section ref`);
  }
  assert.equal(TERMF_TRIGGER_CODES.SUPERIOR_PROPOSAL, 'Company terminates to accept a Superior Proposal');
  assert.equal(TERMF_TRIGGER_CODES.RECOMMENDATION_CHANGE, 'Parent terminates after the Board changes its recommendation');
});

test('TERMF prompt demands tagged { code, label, text } triggers and bans bare section-ref labels', () => {
  const instr = buildFeatureInstructions('TERMF');
  assert.match(instr, /TRIGGER SHAPE/);
  assert.match(instr, /"code": "<TERMF_TRIGGER_CODES code>"/);
  assert.match(instr, /plain-English one-liner/);
  assert.match(instr, /must NEVER be a bare section cross-reference/);
  // The codebook itself is embedded.
  assert.match(instr, /SUPERIOR_PROPOSAL: Company terminates to accept a Superior Proposal/);
  assert.match(instr, /NAKED_NO_VOTE/);
  // The trigger matrix rows carry the canonical code too.
  assert.match(instr, /\{ code, name, terminationClauses \(list of section refs\), feeAmount, feeAmountPct \}/);
});

// ───────────────────────── Item 4: Knowledge-definition scope ─────────────

const KNOWLEDGE_DEF_CORE =
  'the actual knowledge, after reasonable inquiry, of the individuals listed on Section 1.01(a) of the Company Disclosure Letter';

function knowledgeDef(term, core, overrides = {}) {
  return {
    type: 'DEF',
    code: 'DEF-KNOWLEDGE',
    category: term,
    text: `"${term}" means ${core}.`,
    features: { canonicalTerm: term, definitionText: core },
    ...overrides,
  };
}

test('linkKnowledgeScopeToReps stamps the side-matched definition core onto knowledge-qualified reps only', () => {
  const companyDef = knowledgeDef('Knowledge of the Company', KNOWLEDGE_DEF_CORE);
  const parentDef = knowledgeDef(
    "Parent's Knowledge",
    'the actual knowledge of the officers of Parent listed on Schedule B',
  );
  const qualifiedRepT = {
    type: 'REP-T',
    category: 'Litigation',
    text: 'To the Knowledge of the Company, there is no pending Legal Proceeding.',
    features: {},
  };
  const unqualifiedRepT = {
    type: 'REP-T',
    category: 'Organization',
    text: 'The Company is duly organized and validly existing.',
    features: {},
  };
  const qualifiedRepB = {
    type: 'REP-B',
    category: 'Parent Litigation',
    text: "To Parent's Knowledge, there is no Legal Proceeding pending against Parent.",
    features: {},
  };
  linkKnowledgeScopeToReps([companyDef, parentDef, qualifiedRepT, unqualifiedRepT, qualifiedRepB]);
  assert.equal(qualifiedRepT.features.knowledgeScope, KNOWLEDGE_DEF_CORE);
  assert.equal(
    qualifiedRepB.features.knowledgeScope,
    'the actual knowledge of the officers of Parent listed on Schedule B',
  );
  // Absence is meaningful — an unqualified rep is never stamped.
  assert.equal(unqualifiedRepT.features.knowledgeScope, undefined);
});

test('a single generic "Knowledge" definition serves both rep articles', () => {
  const genericDef = knowledgeDef('Knowledge', KNOWLEDGE_DEF_CORE);
  const repT = {
    type: 'REP-T',
    category: 'Compliance',
    text: 'To the knowledge of the Company, it is in compliance with all applicable Laws.',
    features: {},
  };
  const repB = {
    type: 'REP-B',
    category: 'Parent Litigation',
    text: "To Parent's knowledge, no Legal Proceeding is pending.",
    features: {},
  };
  linkKnowledgeScopeToReps([genericDef, repT, repB]);
  assert.equal(repT.features.knowledgeScope, KNOWLEDGE_DEF_CORE);
  assert.equal(repB.features.knowledgeScope, KNOWLEDGE_DEF_CORE);
});

test('findKnowledgeDefinitions matches knowledge-qualifier terms, not terms merely containing "Knowledge"', () => {
  const real = knowledgeDef('Knowledge of the Company', KNOWLEDGE_DEF_CORE);
  const decoy = {
    type: 'DEF',
    code: null,
    category: 'Knowledge Base IP',
    text: '"Knowledge Base IP" means all documentation in the knowledge base.',
    features: { canonicalTerm: 'Knowledge Base IP', definitionText: 'all documentation in the knowledge base' },
  };
  const defs = findKnowledgeDefinitions([decoy, real]);
  assert.equal(defs.company, real);
  assert.equal(defs.parent, null);
  assert.equal(defs.generic, null);
});

test('no Knowledge definition in the deal → nothing is stamped (never invent)', () => {
  const rep = {
    type: 'REP-T',
    category: 'Litigation',
    text: 'To the Knowledge of the Company, there is no pending Legal Proceeding.',
    features: {},
  };
  linkKnowledgeScopeToReps([rep]);
  assert.equal(rep.features.knowledgeScope, undefined);
});
