'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  FAMILY_ADAPTERS,
  shapeFinancingGuarantyProposals,
  shapeEmployeeDnoProposals,
  shapeTaxDividendAppraisalProposals,
  shapeRemediesMiscProposals,
  shapeKeyTermsMaeFollowOnProposals,
} = require('../lib/canonical-v2/native-producer/anthropic-provider');

function promptText(prompt) {
  return (prompt?.messages || [])
    .map((message) => message?.content)
    .filter((content) => typeof content === 'string')
    .join('\n');
}

test('every live family adapter requires only response lists declared by its own prompt', () => {
  const failures = [];

  for (const [family, adapter] of Object.entries(FAMILY_ADAPTERS)) {
    const prompt = adapter.prompt_builder({
      source_text: 'Section 1. Test source text.',
      governed_scope: { section_reference: 'Section 1' },
      known_definitions: [],
    });
    const text = promptText(prompt);

    for (const listName of adapter.required_response_lists) {
      const declaredKey = `"${listName}"`;
      if (!text.includes(declaredKey)) failures.push(`${family}:${listName}`);
    }
  }

  assert.deepEqual(failures, []);
});

test('combined family adapters keep governed facts, follow-on evidence and one open-world copy', () => {
  const cases = [
    {
      family: 'MERGER_STRUCTURE_CLOSING',
      governed: { structure_assertions: [{ assertion_kind: 'SHORT_FORM_251H', quote: 'The Merger shall be governed by Section 251(h).' }] },
      mechanic: { structure_mechanics: [{ surface: 'STOCKHOLDER_LIST', quote: 'The Company shall provide a stockholder list.', detail: 'list mechanic' }] },
    },
    {
      family: 'FINANCING_COVENANTS',
      governed: { financing_assertions: [{ assertion_kind: 'OBTAIN_EFFORTS', quote: 'Parent shall use reasonable best efforts to obtain the Debt Financing.' }] },
      mechanic: { financing_mechanics: [{ surface: 'ALTERNATIVE_FINANCING', quote: 'Parent may arrange alternative financing.', detail: 'replacement financing' }] },
    },
    {
      family: 'GUARANTY_FINANCING_PARTY',
      governed: { guaranty_assertions: [{ assertion_kind: 'GUARANTY_DELIVERED', guarantor_ref: 'Sponsor', quote: 'Sponsor delivered the Guaranty.' }] },
      mechanic: { financing_mechanics: [{ surface: 'GUARANTY_CORE_TERM', quote: 'The Guaranty is a guaranty of payment.', detail: 'payment term' }] },
    },
    {
      family: 'EMPLOYEE_MATTERS',
      governed: { employee_matters_assertions: [{ assertion_kind: 'CONTINUATION_PERIOD', quote: 'Employee benefits shall continue for twelve months.' }] },
      mechanic: { employee_dno_mechanics: [{ surface: 'RETIREMENT_401K', quote: 'The Company shall terminate its 401(k) plan before Closing.', detail: '401(k) mechanic' }] },
    },
    {
      family: 'DNO_INDEMNIFICATION',
      governed: { dno_assertions: [{ assertion_kind: 'INDEM_CONTINUATION', quote: 'Indemnification rights shall continue after Closing.' }] },
      mechanic: { employee_dno_mechanics: [{ surface: 'CLAIMS_HANDLING', quote: 'Parent may assume the defence of the claim.', detail: 'claims handling' }] },
    },
    {
      family: 'TAX_MATTERS',
      governed: { tax_assertions: [{ assertion_kind: 'TREATMENT_PROTECTION', quote: 'The parties shall not prevent the Intended Tax Treatment.' }] },
      mechanic: { mechanics: [{ surface: 'TAX_SHARING_TERMINATION', quote: 'All tax sharing agreements shall terminate at Closing.', detail: 'tax sharing' }] },
    },
    {
      family: 'DIVIDENDS',
      governed: { dividend_assertions: [{ assertion_kind: 'COORDINATION', quote: 'The parties shall coordinate their dividend record dates.' }] },
      mechanic: { mechanics: [{ surface: 'DIVIDEND_FINAL_PERIOD', quote: 'The final dividend shall be prorated through Closing.', detail: 'final period' }] },
    },
    {
      family: 'APPRAISAL_DISSENTERS_RIGHTS',
      governed: { appraisal_assertions: [{ assertion_kind: 'SETTLEMENT_CONSENT', quote: 'The Company shall not settle appraisal claims without Parent consent.' }] },
      mechanic: { mechanics: [{ surface: 'APPRAISAL_NOTICE', quote: 'The Company shall give prompt notice of appraisal demands.', detail: 'notice mechanic' }] },
    },
    {
      family: 'MISC_BOILERPLATE',
      governed: { boilerplate_assertions: [{ assertion_kind: 'GOVERNING_LAW', quote: 'This Agreement is governed by Delaware law.' }] },
      mechanic: { mechanics: [{ surface: 'DAMAGES_WAIVER', quote: 'No party shall recover punitive damages.', detail: 'damages waiver' }] },
    },
  ];

  for (const entry of cases) {
    const mechanic = Object.values(entry.mechanic)[0][0];
    const governed = Object.values(entry.governed)[0][0];
    const residualQuote = `Residual evidence for ${entry.family}.`;
    const parsed = {
      ...entry.governed,
      ...entry.mechanic,
      open_world_candidates: [{ observed_quote: residualQuote, why_unmapped: 'novel exact evidence', nearest_concept: null }],
    };
    const output = FAMILY_ADAPTERS[entry.family].response_shaper(
      parsed,
      [governed.quote, mechanic.quote, residualQuote].join(' '),
    );
    assert.ok(output.proposals.some((proposal) => proposal.raw_value === governed.quote), entry.family);
    assert.equal(output.proposals.filter((proposal) => proposal.raw_value === mechanic.quote).length, 1, entry.family);
    assert.equal(output.proposals.filter((proposal) => proposal.raw_value === residualQuote).length, 1, entry.family);
  }
});

test('live family adapters use the named follow-on shapers', () => {
  const cases = [
    {
      family: 'FINANCING_COVENANTS',
      listKey: 'financing_mechanics',
      surface: 'ALTERNATIVE_FINANCING',
      fallbackDetail: 'financing mechanism observed',
      shaper: shapeFinancingGuarantyProposals,
    },
    {
      family: 'GUARANTY_FINANCING_PARTY',
      listKey: 'financing_mechanics',
      surface: 'GUARANTY_CORE_TERM',
      fallbackDetail: 'guaranty or financing-party mechanism observed',
      shaper: shapeFinancingGuarantyProposals,
    },
    {
      family: 'EMPLOYEE_MATTERS',
      listKey: 'employee_dno_mechanics',
      surface: 'RETIREMENT_401K',
      fallbackDetail: 'employee mechanism observed',
      shaper: shapeEmployeeDnoProposals,
    },
    {
      family: 'DNO_INDEMNIFICATION',
      listKey: 'employee_dno_mechanics',
      surface: 'CLAIMS_HANDLING',
      fallbackDetail: 'D&O mechanism observed',
      shaper: shapeEmployeeDnoProposals,
    },
    {
      family: 'TAX_MATTERS',
      listKey: 'mechanics',
      surface: 'TAX_SHARING_TERMINATION',
      fallbackDetail: 'tax mechanism observed',
      shaper: shapeTaxDividendAppraisalProposals,
    },
    {
      family: 'DIVIDENDS',
      listKey: 'mechanics',
      surface: 'DIVIDEND_FINAL_PERIOD',
      fallbackDetail: 'dividend mechanism observed',
      shaper: shapeTaxDividendAppraisalProposals,
    },
    {
      family: 'APPRAISAL_DISSENTERS_RIGHTS',
      listKey: 'mechanics',
      surface: 'APPRAISAL_NOTICE',
      fallbackDetail: 'appraisal mechanism observed',
      shaper: shapeTaxDividendAppraisalProposals,
    },
    {
      family: 'MISC_BOILERPLATE',
      listKey: 'mechanics',
      surface: 'DAMAGES_WAIVER',
      fallbackDetail: 'remedies or boilerplate mechanism observed',
      shaper: shapeRemediesMiscProposals,
    },
    {
      family: 'KEY_DEFINED_TERMS',
      listKey: 'mechanics',
      surface: 'MADE_AVAILABLE_DEFINITION',
      fallbackDetail: 'defined term or MAE mechanism observed',
      shaper: shapeKeyTermsMaeFollowOnProposals,
    },
  ];

  for (const entry of cases) {
    const quote = `Verified ${entry.family} follow-on language.`;
    const parsed = {
      [entry.listKey]: [{ surface: entry.surface, quote }],
      open_world_candidates: [],
    };
    const expected = entry.shaper(parsed, quote, entry.fallbackDetail);
    const actual = FAMILY_ADAPTERS[entry.family].response_shaper(parsed, quote);
    assert.deepEqual(actual, expected, entry.family);
  }
});

test('MAE definition adapter does not consume Key Defined Terms follow-on mechanics', () => {
  const quote = 'The term Made Available means posted to the data room.';
  const output = FAMILY_ADAPTERS.MAE_DEFINITION.response_shaper({
    mae_definition_instances: [],
    mechanics: [{ surface: 'MADE_AVAILABLE_DEFINITION', quote }],
    open_world_candidates: [],
  }, quote);

  assert.equal(output.proposals.some((proposal) => proposal.raw_value === quote), false);
  assert.equal(FAMILY_ADAPTERS.MAE_DEFINITION.required_response_lists.includes('mechanics'), false);
});
