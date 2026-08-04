'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { compileFixtureContractV34 } = require('../lib/canonical-v2/contract-bundle');
const { shapeIocProposals } = require('../lib/canonical-v2/native-producer/anthropic-provider');
const { resolveCandidates } = require('../lib/canonical-v2/native-producer/candidate-resolution');
const { runNativeExtraction } = require('../lib/canonical-v2/native-producer/native-extraction-run');

const sourceFixture = JSON.parse(fs.readFileSync(path.join(
  __dirname, 'fixtures', 'canonical-v2', 'f28-third-live-run', 'adapter-result.json',
), 'utf8'));
const admittedSourceContext = sourceFixture.admitted_source_contexts[0];
const sourceText = admittedSourceContext.canonical_text.text;
const contractBundle = compileFixtureContractV34();

const EXPECTED_RESTRICTIONS = Object.freeze([
  ['4.1(vii)', 'DEBT', 'redeem, repurchase, prepay, defease, incur, assume, endorse, guarantee or otherwise become liable for any Indebtedness'],
  ['4.1(vii)', 'DEBT', 'materially modify the terms of any Indenture or the Senior Notes or take any action that would result in a Default or Event of Default (each, as such term is defined in the applicable Indenture) under any Indenture or the Senior Notes'],
  ['4.1(viii)', 'SETTLE', 'release, assign, compromise, pay, discharge, waive, settle, agree to settle, or satisfy any Action against the Company or any of its Affiliates or its or their respective directors, officers, managers, employees or agents (including any Action relating to this Agreement or the Transactions) or other rights, claims, liabilities or obligations (absolute, accrued, asserted or unasserted, contingent or otherwise)'],
  ['4.1(viii)', 'SETTLE', 'waive any claims of substantial value of more than $10,000,000 in the aggregate'],
  ['4.1(ix)', 'CAPEX', 'make, commit to make or authorize any capital expenditure'],
  ['4.1(x)', 'ACCOUNTING', 'make any material changes with respect to financial accounting policies or procedures'],
  ['4.1(xi)', 'CONTRACT', 'enter into any Contract which would have been a Company Material Contract or Company Real Property Lease if entered into prior to the date hereof'],
  ['4.1(xi)', 'CONTRACT', 'amend any Company Material Contract or Company Real Property Lease in any material respect or terminate any Company Material Contract or Company Real Property Lease'],
  ['4.1(xi)', 'CONTRACT', 'waive or grant any release or relinquishment of any material rights under, or renew, any Company Material Contract or Company Real Property Lease'],
  ['4.1(xii)', 'TAX', 'make, change or revoke any material Tax election'],
  ['4.1(xii)', 'TAX', 'settle or compromise any audit or proceeding relating to a material Tax liability or material refund of Tax'],
  ['4.1(xii)', 'TAX', 'enter into any Tax sharing agreement (other than contracts described in the parenthetical contained in Section ‎3.1(l)(iii)(A)) or material closing agreement within the meaning of Section 7121 of the Code (or any comparable provision of state, local or foreign Tax Law)'],
  ['4.1(xii)', 'TAX', 'change any material method of Tax accounting or Tax period'],
  ['4.1(xii)', 'TAX', 'except upon the request of a Tax Authority, execute any waivers extending the statutory period of limitations with respect to any material Tax Return'],
  ['4.1(xii)', 'TAX', 'file any amended income or other material Tax Return'],
  ['4.1(xii)', 'TAX', 'request any Tax ruling'],
  ['4.1(xiv)', 'COMP', 'grant any new rights to severance or termination payments or severance or termination benefits to any Company Service Provider'],
  ['4.1(xiv)', 'COMP', 'increase the compensation or employee benefits of any Company Service Provider'],
  ['4.1(xiv)', 'COMP', 'establish, adopt, terminate or amend any Benefit Plan (or any arrangement that would be a Benefit Plan if in effect on the date hereof) (other than any ordinary course changes to any Benefit Plan that is a group health plan that does not materially increase the Company’s cost with respect to such benefits) or any collective bargaining agreement'],
  ['4.1(xiv)', 'COMP', 'take any action to accelerate the vesting, payment or funding of any compensation or benefits under any Benefit Plan with respect to any Company Service Provider'],
  ['4.1(xiv)', 'COMP', 'hire, promote or terminate the employment (other than for cause) of any Company Employee with a “Management-Level” description in the employee census (provided to Parent prior to the date hereof) of “VPO/Regional Manager” or above (the “VPO/Regional Managers”)'],
]);

const OPEN_WORLD_QUOTE = 'agree, authorize or commit to do any of the foregoing, or authorize, recommend or announce an intention to do any of the foregoing';

test('TopBuild IOC replay keeps each post-vii sibling on its own source-tree citation', async () => {
  const runReceipt = await runNativeExtraction({
    source_text: sourceText,
    document_hash: admittedSourceContext.document_hash,
    section_references: ['4.1'],
    section_family_assignments: [{
      section_reference: '4.1',
      family_id: 'INTERIM_OPERATING',
      covenant_side: 'TARGET',
    }],
    contract_bundle: contractBundle,
    definitions: { known_definitions: [] },
    provider: async ({ governed_scope: scope }) => {
      const shaped = shapeIocProposals({
        ioc_restriction_assertions: [
          ...EXPECTED_RESTRICTIONS,
          ['4.1(xvi)', 'CONTRACT', OPEN_WORLD_QUOTE],
        ].map(([, restrictionCategory, quote]) => ({
          section_reference: '4.1',
          assertion_kind: 'RESTRICTION_PRESENT',
          restriction_category: restrictionCategory,
          threshold_basis: null,
          quote,
        })),
        ioc_mechanics: [],
        open_world_candidates: [],
      }, scope.source_text, { covenant_side: 'TARGET' });
      return {
        provider_id: 'topbuild-ioc-sibling-citation-replay/v1',
        model_id: 'recorded',
        prompt: 'topbuild-ioc-sibling-citation-replay/v1',
        proposals: shaped.proposals,
        evidence_residuals: shaped.evidence_residuals,
      };
    },
  });

  const replayed = resolveCandidates({
    run_receipt: runReceipt,
    contract_vocabulary: contractBundle,
    admitted_source_context: admittedSourceContext,
  });
  const actualRestrictions = replayed.resolved.map((entry) => [
    entry.source_citation,
    entry.claim.attributes.restriction_category,
    entry.claim.raw_value,
  ]);

  assert.deepEqual(actualRestrictions, EXPECTED_RESTRICTIONS);
  const citationCounts = replayed.resolved.reduce((counts, entry) => ({
    ...counts,
    [entry.source_citation]: (counts[entry.source_citation] || 0) + 1,
  }), {});
  assert.deepEqual(citationCounts, {
    '4.1(vii)': 2,
    '4.1(viii)': 2,
    '4.1(ix)': 1,
    '4.1(x)': 1,
    '4.1(xi)': 3,
    '4.1(xii)': 7,
    '4.1(xiv)': 5,
  });
  assert.equal(replayed.resolved.filter((entry) => entry.source_citation !== '4.1(vii)').length, 19);
  assert.equal(replayed.resolved.filter((entry) => entry.source_citation === '4.1(vii)').length, 2);
  assert.ok(replayed.resolved
    .filter((entry) => entry.source_citation === '4.1(vii)')
    .every((entry) => entry.claim.attributes.restriction_category === 'DEBT'));

  assert.equal(replayed.open_world.length, 1);
  assert.equal(replayed.open_world[0].source_citation, '4.1(xvi)');
  assert.equal(replayed.open_world[0].raw_value, OPEN_WORLD_QUOTE);

  const allCitations = [
    ...replayed.resolved.map((entry) => entry.source_citation),
    ...replayed.open_world.map((entry) => entry.source_citation),
  ];
  assert.equal(allCitations.filter((citation) => /^4\.1\(vii\)\(/.test(citation)).length, 0);
});
