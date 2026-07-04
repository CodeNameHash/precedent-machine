const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

const {
  BURDEN_COMMITMENT,
  BURDEN_BASELINE,
  LITIGATION_OBLIGATION,
  CLEAR_SKIES_FAMILY,
  CONSULTATION_TIER,
  PULL_REFILE,
  TIMING_AGREEMENT,
  ANTITRUST_CONTROL,
  taxonomyForFeatureKey,
} = require('../lib/taxonomy');
const { getFeaturesForType, getFeaturesForCode } = require('../lib/rubric');
const { buildFeatureInstructions } = require('../lib/parser-v2/extract');

let tableLogic;
test.before(async () => {
  tableLogic = await import(path.join('..', 'components', 'review', 'table-logic.js'));
});

function prov(id, features, code = 'ANTI-BURDEN', category = 'Burden Cap / Divestiture Limits') {
  return {
    id,
    type: 'ANTI',
    code,
    category,
    full_text: 'source text',
    ai_metadata: { code, features },
  };
}

function condReg(id = 'cond-reg') {
  return {
    id,
    type: 'COND-M',
    code: 'COND-M-REG',
    category: 'Antitrust',
    full_text: 'HSR waiting period has expired and scheduled approvals have been obtained.',
    ai_metadata: {
      code: 'COND-M-REG',
      features: { mainCondition: 'HSR waiting period expired or terminated; scheduled regulatory approvals obtained' },
    },
  };
}

test('canonical antitrust dictionaries are registered and fixed codes are present', () => {
  assert.equal(BURDEN_COMMITMENT.ANTI_HOHW, 'No obligation to divest or litigate (anti-HOHW)');
  assert.equal(BURDEN_COMMITMENT.SILENT_NO_CAP, 'No express limitation (efforts standard governs)');
  assert.equal(BURDEN_BASELINE.SIZE_NORMALIZED, 'Target deemed buyer-sized');
  assert.equal(LITIGATION_OBLIGATION.MANDATORY_DEFEND, 'Must defend (incl. appeals/final judgment)');
  assert.equal(CLEAR_SKIES_FAMILY.SUIT_SEEKING, 'Fails on suit merely seeking relief');
  assert.equal(CONSULTATION_TIER.GOOD_FAITH_VIEWS, 'Consider views in good faith');
  assert.equal(PULL_REFILE.BUYER_UNILATERAL_GF, 'Buyer may pull-and-refile (good-faith gated)');
  assert.equal(TIMING_AGREEMENT.BUYER_OPTION_CONSULT, 'Buyer option after consultation');
  assert.equal(ANTITRUST_CONTROL.BUYER_WITH_SETTLEMENT_GAG, 'Buyer controls; seller barred from offers/settlement except as directed');

  assert.equal(taxonomyForFeatureKey('burdenCommitment'), BURDEN_COMMITMENT);
  assert.equal(taxonomyForFeatureKey('burdenBaseline'), BURDEN_BASELINE);
  assert.equal(taxonomyForFeatureKey('litigationObligation'), LITIGATION_OBLIGATION);
  assert.equal(taxonomyForFeatureKey('consultationTier'), CONSULTATION_TIER);
  assert.equal(taxonomyForFeatureKey('pullRefile'), PULL_REFILE);
  assert.equal(taxonomyForFeatureKey('timingAgreement'), TIMING_AGREEMENT);

  const antiKeys = new Set(getFeaturesForType('ANTI').map((f) => f.key));
  for (const key of ['burdenCommitment', 'capDetail', 'burdenBaseline', 'litigationObligation', 'clearSkies', 'consultationTier', 'pullRefile', 'timingAgreement', 'hsrFilingDeadline', 'exHsrFilingDeadline']) {
    assert.ok(antiKeys.has(key), `${key} registered on ANTI`);
  }
  const filingKeys = new Set(getFeaturesForCode('ANTI-FILING').map((f) => f.key));
  assert.ok(filingKeys.has('hsrFilingDeadline'));
  assert.ok(filingKeys.has('exHsrFilingDeadline'));
});

test('ANTI prompt contains digest markers, HSR split, and both CRITICAL warnings verbatim', () => {
  const instr = buildFeatureInstructions('ANTI');
  assert.match(instr, /BURDEN_COMMITMENT/);
  assert.match(instr, /CLEAR_SKIES_FAMILY and scope modifiers/);
  assert.match(instr, /No numeric-count field exists in the clause bank; do not invent one\./);
  assert.match(instr, /hsrFilingDeadline and exHsrFilingDeadline/);
  assert.ok(instr.includes("The efforts adjective alone does NOT determine the burden level — the cap frequently lives inside the defined efforts term ('reasonable best efforts shall include/shall not require…'); classify burdenCommitment from the substantive limitation language, wherever it sits."));
  assert.ok(instr.includes('Facially-HOHW language may be capped by a remote proviso — check for provisos before EXPRESS_HOHW; SILENT_NO_CAP only when no limitation language exists anywhere in the efforts/remedies provisions.'));
});

test('UI source wires the custom ANTI span-table renderer and removes terminated-party breach carveout row', () => {
  const reviewSrc = fs.readFileSync(path.join(__dirname, '..', 'pages', 'review', '[id].js'), 'utf8');
  const summarySrc = fs.readFileSync(path.join(__dirname, '..', 'lib', 'category-summary-features.js'), 'utf8');
  const tableLogicSrc = fs.readFileSync(path.join(__dirname, '..', 'components', 'review', 'table-logic.js'), 'utf8');
  assert.match(reviewSrc, /function AntitrustSummaryTable/);
  assert.match(reviewSrc, /rowSpan=\{row\.rowSpan\}/);
  assert.match(tableLogicSrc, /Closing Condition \(antitrust\)/);
  assert.match(summarySrc, /HSR Filing Deadline/);
  assert.match(summarySrc, /Ex-HSR Filing Deadline/);
  assert.ok(!summarySrc.includes('Terminating Party Breach Carveout'));
  assert.ok(!summarySrc.includes('Refile Cap Without Company Consent'));
});

test('antitrust row plan folds burdensome-condition sub-rows into Caps & Limits', () => {
  const p = prov('burden', {
    effortsStandard: { code: 'REASONABLE_BEST_EFFORTS', label: 'Reasonable best efforts', text: 'reasonable best efforts' },
    burdenCommitment: { code: 'BURDENSOME_CONDITION', label: 'Burdensome-condition / MAE-style cap', text: 'Burdensome Condition' },
    capDetail: 'not required to agree to a Burdensome Condition',
    burdensomeConditionScope: 'combined company MAE-style cap',
    burdensomeConditionInTerminationTriggers: 'Burdensome Condition failure permits termination',
  });
  const rows = tableLogic.buildAntitrustSummaryRows([p], [p, condReg()]);
  const caps = rows.find((r) => r.section === 'Caps & Limits');
  assert.ok(caps);
  assert.deepEqual(rows.filter((r) => /Burdensome Condition/i.test(r.label)).map((r) => r.label), []);
  assert.ok(caps.detailKeys.includes('burdensomeConditionScope'));
  assert.ok(rows.find((r) => r.section === 'Closing Condition (antitrust)'));
});

test('antitrust row plan supports anti-HOHW burden and separate filing rows', () => {
  const p = prov('anti-hohw', {
    burdenCommitment: { code: 'ANTI_HOHW', label: 'No obligation to divest or litigate (anti-HOHW)', text: 'not required to divest or litigate' },
    litigationObligation: { code: 'EXPRESS_NONE', label: 'Expressly no obligation', text: 'no obligation to litigate' },
    pullRefile: { code: 'BUYER_UNILATERAL_GF', label: 'Buyer may pull-and-refile (good-faith gated)', text: 'Parent may withdraw and refile' },
    hsrFilingDeadline: { days: 10, unit: 'Business Days', text: 'within ten (10) Business Days' },
    exHsrFilingDeadline: { standard: 'as promptly as practicable', jurisdictions: ['EC'], text: 'EC filing as promptly as practicable' },
  });
  const rows = tableLogic.buildAntitrustSummaryRows([p], [p]);
  assert.equal(rows.find((r) => r.section === 'Caps & Limits').hit.value.code, 'ANTI_HOHW');
  assert.ok(rows.find((r) => r.label === 'Litigation'));
  assert.ok(rows.find((r) => r.label === 'HSR Filing Deadline'));
  assert.ok(rows.find((r) => r.label === 'Ex-HSR Filing Deadline'));
});

test('antitrust row plan keeps silent codes but omits unsupported rows', () => {
  const p = prov('silent', {
    effortsStandard: { code: 'FLAT', label: 'Flat (unqualified obligation)', text: 'shall file' },
    burdenCommitment: { code: 'SILENT_NO_CAP', label: 'No express limitation (efforts standard governs)', text: null },
    litigationObligation: { code: 'SILENT', label: 'Silent', text: null },
    pullRefile: { code: 'SILENT', label: 'Silent', text: null },
    timingAgreement: { code: 'SILENT', label: 'Silent', text: null },
  }, 'ANTI-EFFORTS', 'Standard of Efforts');
  const rows = tableLogic.buildAntitrustSummaryRows([p], [p]);
  assert.ok(rows.find((r) => r.section === 'Efforts'));
  assert.ok(rows.find((r) => r.section === 'Caps & Limits'));
  assert.ok(rows.find((r) => r.label === 'Litigation'));
  assert.ok(rows.find((r) => r.label === 'Pull-Refiling'));
  assert.ok(rows.find((r) => r.label === 'Timing Agreement'));
  assert.equal(rows.find((r) => r.label === 'Control'), undefined);
  assert.equal(rows.find((r) => r.label === 'HSR Filing Deadline'), undefined);
});
