'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { getProducerPromptModule } = require('../lib/canonical-v2/native-producer/producer-prompt-registry');
const appraisal = require('../lib/canonical-v2/native-producer/appraisal-producer-prompt');
const dividends = require('../lib/canonical-v2/native-producer/dividends-producer-prompt');
const dno = require('../lib/canonical-v2/native-producer/dno-producer-prompt');
const employee = require('../lib/canonical-v2/native-producer/employee-matters-producer-prompt');
const mergerStructure = require('../lib/canonical-v2/native-producer/merger-structure-producer-prompt');
const remedies = require('../lib/canonical-v2/native-producer/specific-performance-remedies-producer-prompt');
const tax = require('../lib/canonical-v2/native-producer/tax-matters-producer-prompt');

const CASES = Object.freeze([
  {
    family: 'APPRAISAL_DISSENTERS_RIGHTS', module: appraisal,
    builder: appraisal.buildAppraisalProducerPrompt,
    responseKeys: ['appraisal_assertions', 'mechanics', 'open_world_candidates'],
    sourceQuote: 'Except with the prior written consent of Parent, the Company shall not make any payment with respect to any demands for appraisal.',
    governedInstruction: 'Extract standalone appraisal settlement-consent and withdrawal-reconversion covenants into appraisal_assertions.',
    boundaryInstruction: 'Availability, conversion and exchange mechanics remain with Consideration.',
  },
  {
    family: 'DIVIDENDS', module: dividends, builder: dividends.buildDividendsProducerPrompt,
    responseKeys: ['dividend_assertions', 'mechanics', 'open_world_candidates'],
    sourceQuote: 'Prior to the Effective Time, the Company may declare a special cash dividend (the "Special Dividend") of $2.00 per share.',
    governedInstruction: 'Extract coordination covenants and one-time pre-closing special dividends into dividend_assertions.',
    boundaryInstruction: 'Recurring mandated dividends remain open world.',
  },
  {
    family: 'DNO_INDEMNIFICATION', module: dno, builder: dno.buildDnoProducerPrompt,
    responseKeys: ['dno_assertions', 'employee_dno_mechanics', 'open_world_candidates'],
    sourceQuote: 'each current and former director or officer of the Company and its Subsidiaries',
    governedInstruction: 'Put governed facts in dno_assertions.',
    boundaryInstruction: 'A mechanics surface label routes evidence only and is not a governed legal code.',
  },
  {
    family: 'EMPLOYEE_MATTERS', module: employee, builder: employee.buildEmployeeMattersProducerPrompt,
    responseKeys: ['employee_matters_assertions', 'employee_dno_mechanics', 'open_world_candidates'],
    sourceQuote: 'a base salary or wage rate, as applicable, that is not less than the base salary or wage rate',
    governedInstruction: 'Put governed facts in employee_matters_assertions.',
    boundaryInstruction: 'Never infer absence, pension formulas, bonus formulas or unquoted benefit terms.',
  },
  {
    family: 'MERGER_STRUCTURE_CLOSING', module: mergerStructure,
    builder: mergerStructure.buildMergerStructureProducerPrompt,
    responseKeys: ['structure_assertions', 'structure_mechanics', 'transaction_steps', 'open_world_candidates'],
    sourceQuote: 'The Merger will be governed by and effected under Section 251(h) of the DGCL.',
    governedInstruction: 'Put a positive fact that fits a structure_assertions kind in structure_assertions.',
    boundaryInstruction: 'Use structure_mechanics only for a deferred or novel mechanism that cannot be stated faithfully as one governed assertion.',
  },
  {
    family: 'SPECIFIC_PERFORMANCE_REMEDIES', module: remedies,
    builder: remedies.buildSpecificPerformanceRemediesProducerPrompt,
    responseKeys: ['remedy_assertions', 'open_world_candidates'],
    sourceQuote: 'shall be entitled to an injunction or injunctions, specific performance or other equitable relief',
    governedInstruction: 'Capture specific performance, including an express injunction, equitable-relief or force-consummation right, only when the quote states it.',
    boundaryInstruction: 'Put damages waivers, litigation extensions, expedited proceedings and any other remedy text in open_world_candidates unless a separately governed family owns it.',
  },
  {
    family: 'TAX_MATTERS', module: tax, builder: tax.buildTaxMattersProducerPrompt,
    responseKeys: ['tax_assertions', 'mechanics', 'open_world_candidates'],
    sourceQuote: 'Neither Parent nor the Company shall take any action that would prevent or impede the Merger from qualifying for the Intended Tax Treatment.',
    governedInstruction: 'TAX_OPINION_COOPERATION requires an operative covenant to cooperate with, provide to, or deliver for tax counsel in connection with a tax opinion.',
    boundaryInstruction: 'A closing condition that merely requires receipt of a tax opinion is open world, not this covenant.',
  },
]);

test('follow-on family prompts retain their registry, response and evidence-boundary contracts', () => {
  for (const entry of CASES) {
    const prompt = entry.builder({
      source_text: entry.sourceQuote,
      governed_scope: { section_reference: 'Test Section' },
    });
    const content = prompt.messages[0].content;

    assert.equal(getProducerPromptModule(entry.family), entry.builder, entry.family);
    assert.equal(prompt.prompt_id, entry.module.PROMPT_ID, entry.family);
    assert.equal(prompt.prompt_version, entry.module.PROMPT_VERSION, entry.family);
    assert.deepEqual(Object.keys(JSON.parse(entry.module.RESPONSE_SHAPE)), entry.responseKeys, entry.family);
    assert.ok(content.includes(entry.governedInstruction), `${entry.family}: governed boundary`);
    assert.ok(content.includes(entry.boundaryInstruction), `${entry.family}: open-world boundary`);
    assert.ok(content.includes(entry.sourceQuote), `${entry.family}: source quote`);
  }
});
