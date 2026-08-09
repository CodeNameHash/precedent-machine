'use strict';
const { buildConditionalTerminationFeeValue } = require('./conditional-termination-fee-value');

const EXPECTED_BRANCH_SIDES = new Map([
  ['7.3(b)(i)', 'SELLER'],
  ['7.3(b)(ii)', 'SELLER'],
  ['7.3(b)(iii)', 'SELLER'],
  ['7.3(b)(iv)', 'SELLER'],
  ['7.3(b)(v)', 'SELLER'],
  ['7.3(c)', 'BUYER'],
]);

function exactlyOne(sourceText, pattern) {
  const matches = [...sourceText.matchAll(pattern)];
  return matches.length === 1 ? matches[0] : null;
}

function parseModivConditionalFees(sourceText) {
  if (typeof sourceText !== 'string') throw new TypeError('sourceText must be a string');
  const company = exactlyOne(sourceText, /“Company Base Amount” means \(x\) if payable pursuant to Section 7\.3\(b\)\(i\), Section 7\.3\(b\)\(ii\) or Section 7\.3\(b\)\(iii\), \$([\d,]+), or \(y\) if payable pursuant to Section 7\.3\(b\)\(iv\) or Section 7\.3\(b\)\(v\), \$([\d,]+(?:\.\d+)?)\./g);
  const parent = exactlyOne(sourceText, /“Parent Base Amount” means \$([\d,]+(?:\.\d+)?)\./g);
  const companyFee = exactlyOne(sourceText, /“Company Termination Fee” means (an amount equal to the lesser of \(i\) the Company Base Amount and \(ii\) the maximum amount, if any, that can be paid to Parent without causing Parent to fail to meet the requirements of Sections 856\(c\)\(2\) and \(3\) of the Code \(the “REIT Requirements”\) for such year determined as if the payment of such amount did not constitute Qualifying Income, as determined by independent accountants engaged by Parent \(taking into account any known or anticipated income of Parent which is not Qualifying Income and any appropriate “cushion” as determined by such independent accountants\))\./g);
  const parentFee = exactlyOne(sourceText, /“Parent Termination Fee” means (an amount equal to the lesser of \(i\) the Parent Base Amount and \(ii\) the maximum amount, if any, that can be paid to the Company without causing the Company to fail to meet the REIT Requirements for such year determined as if the payment of such amount did not constitute Qualifying Income, as determined by independent accountants engaged by the Company \(taking into account any known or anticipated income of the Company which is not Qualifying Income and any appropriate “cushion” as determined by such independent accountants\))\./g);
  if (!company || !parent || !companyFee || !parentFee) throw new Error('MODIV_FEE_DEFINITION_MISSING_OR_AMBIGUOUS');
  const row = (fee_side, triggering_branch, base_amount, lineage, citations, raw_formula) => buildConditionalTerminationFeeValue({
    fee_side,
    triggering_branch,
    base_amount: base_amount.replace(/,/g, ''),
    currency: 'USD',
    operator: 'LOWER_OF',
    reit_limit_cap_term_ref: 'REIT Requirements',
    defined_term_lineage: lineage,
    source_citations: [triggering_branch, ...citations],
    raw_formula,
  });
  return Object.freeze([
    ...['7.3(b)(i)', '7.3(b)(ii)', '7.3(b)(iii)'].map((branch) => row('SELLER', branch, company[1], ['Company Termination Fee', 'Company Base Amount'], ['8.12(m)', '8.12(f)'], companyFee[1])),
    ...['7.3(b)(iv)', '7.3(b)(v)'].map((branch) => row('SELLER', branch, company[2], ['Company Termination Fee', 'Company Base Amount'], ['8.12(m)', '8.12(f)'], companyFee[1])),
    row('BUYER', '7.3(c)', parent[1], ['Parent Termination Fee', 'Parent Base Amount'], ['8.12(vv)', '8.12(gg)'], parentFee[1]),
  ]);
}

function exactCompanyBaseAmountBranch(entry) {
  if (entry?.ok !== true
    || entry?.section_reference !== '8.12'
    || entry?.candidate?.kind !== 'claim'
    || entry.candidate.claim?.claim_definition_key !== 'NATIVE_TERMINATION_FEE_TRIGGER_CANDIDATE'
    || entry.citation_validation?.accepted !== true
    || entry.citation_validation?.derived_citation !== '8.12(f)'
    || entry.candidate.claim.attributes?.fee_side !== 'SELLER') {
    return null;
  }
  const match = /^(?:if payable pursuant to )?Section 7\.3\(b\)\((i|ii|iii|iv|v)\)$/.exec(
    entry.candidate.claim.raw_value,
  );
  return match ? `7.3(b)(${match[1]})` : null;
}

function requireModivFeeBranchSupport({
  sourceText, feeTriggerCandidates, sideMismatchCode, branchUnsupportedCode,
}) {
  if (!Array.isArray(feeTriggerCandidates)) throw new TypeError('fee_trigger_candidates must be an array');
  const supported = new Map();
  for (const entry of feeTriggerCandidates) {
    if (entry?.ok !== true
      || entry?.candidate?.kind !== 'claim'
      || entry.candidate.claim?.claim_definition_key !== 'NATIVE_TERMINATION_FEE_TRIGGER_CANDIDATE') {
      continue;
    }
    const branch = entry?.citation_validation?.accepted === true
      ? entry.citation_validation.derived_citation
      : null;
    const side = entry.candidate.claim.attributes?.fee_side;
    if (!EXPECTED_BRANCH_SIDES.has(branch)) continue;
    if (side !== EXPECTED_BRANCH_SIDES.get(branch)) {
      throw new Error(sideMismatchCode);
    }
    supported.set(branch, true);
  }
  let exactFormulaProved = false;
  for (const entry of feeTriggerCandidates) {
    const branch = exactCompanyBaseAmountBranch(entry);
    if (branch && !supported.has(branch)) {
      // A candidate may identify the cross-reference, but only the admitted
      // source parser proves the full Company Base Amount definition.
      if (!exactFormulaProved) {
        parseModivConditionalFees(sourceText);
        exactFormulaProved = true;
      }
      supported.set(branch, true);
    }
  }
  if ([...EXPECTED_BRANCH_SIDES.keys()].some((branch) => !supported.has(branch))) {
    throw new Error(branchUnsupportedCode);
  }
}

function resolveModivConditionalFees({ source_text: sourceText, fee_trigger_candidates: feeTriggerCandidates } = {}) {
  if (!Array.isArray(feeTriggerCandidates)) throw new TypeError('fee_trigger_candidates must be an array');
  // The formula parser independently proves the exact Modiv definition
  // before a definition cross-reference may supplement a missing branch.
  const parsed = parseModivConditionalFees(sourceText);
  requireModivFeeBranchSupport({
    sourceText,
    feeTriggerCandidates,
    sideMismatchCode: 'MODIV_FEE_TRIGGER_SIDE_MISMATCH',
    branchUnsupportedCode: 'MODIV_FEE_TRIGGER_BRANCH_UNSUPPORTED',
  });
  return parsed;
}

module.exports = {
  parseModivConditionalFees,
  requireModivFeeBranchSupport,
  resolveModivConditionalFees,
};
