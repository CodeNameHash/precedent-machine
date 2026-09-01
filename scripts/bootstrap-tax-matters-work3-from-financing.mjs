#!/usr/bin/env node
/** Bootstrap TAX_MATTERS family-local files from FINANCING_COVENANTS templates. */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '..');

const PHASE2 = JSON.parse(readFileSync(join(
  REPO_ROOT,
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-tax-matters-authoring-phase2-authority-v2.json',
), 'utf8'));

const terminals = PHASE2.source_terminal_successor_contract.terminal_rule_registry;
const outsideCalibration = terminals.filter((t) => t.unresolved_items.includes(
  'COMPARATOR_CLAIM_OUTSIDE_CALIBRATION_PROVISION_EXAMPLES',
)).length;
const subtypeDivergence = terminals.filter((t) => t.unresolved_items.includes(
  'SUBTYPE_PARTITION_DIVERGES_FROM_CALIBRATION_PROPOSED_SUBTYPE',
)).length;

const REPLACEMENTS = [
  [/FINANCING_COVENANTS/g, 'TAX_MATTERS'],
  [/financing_covenants/g, 'tax_matters'],
  [/financingCovenants/g, 'taxMatters'],
  [/FinancingCovenants/g, 'TaxMatters'],
  [/Financing Covenants/g, 'Tax Matters'],
  [/financing-covenants/g, 'tax-matters'],
  [/Financing covenants/g, 'Tax matters'],
  [/five-profile/g, '17-profile'],
  [/five profile/g, '17 profile'],
  [/Five-profile/g, '17-profile'],
  [/Five profile/g, '17 profile'],
  [/five profiles/g, '17 profiles'],
  [/Five profiles/g, '17 profiles'],
  [/five-profile/g, '17-profile'],
  [/5-profile/g, '17-profile'],
  [/5_PROFILE/g, '17_PROFILE'],
  [/5 profile/g, '17 profile'],
  [/Five/g, 'Seventeen'],
  [/five/g, 'seventeen'],
  [/N1 family #9/g, 'N1 family #13'],
  [/family #9/g, 'family #13'],
  [/FINANCING_COVENANTS_PROFILE_COUNT = 5/g,
    'TAX_MATTERS_PROFILE_COUNT = 17'],
  [/FINANCING_COVENANTS_SUBTYPE_DIVERGENCE_PROFILE_COUNT = 2/g,
    `TAX_MATTERS_SUBTYPE_DIVERGENCE_PROFILE_COUNT = ${subtypeDivergence}`],
  [/FINANCING_COVENANTS_OUTSIDE_CALIBRATION_PROFILE_COUNT = 1/g,
    `TAX_MATTERS_OUTSIDE_CALIBRATION_PROFILE_COUNT = ${outsideCalibration}`],
  [/FINANCING_COVENANTS_REGISTERED_SUBTYPE_BUCKET_COUNT = 7/g,
    'TAX_MATTERS_REGISTERED_SUBTYPE_BUCKET_COUNT = 8'],
  [/FINANCING_COVENANTS_POPULATED_SUBTYPE_BUCKET_COUNT = 3/g,
    'TAX_MATTERS_POPULATED_SUBTYPE_BUCKET_COUNT = 4'],
  [/FINANCING_COVENANTS_PHASE2_AUTHORITY_ID =\n  '[^']+'/g,
    `TAX_MATTERS_PHASE2_AUTHORITY_ID =\n  '${PHASE2.tax_matters_authoring_phase2_authority_id}'`],
  [/FINANCING_COVENANTS_PHASE2_AUTHORITY_BYTES = \d+/g,
    `TAX_MATTERS_PHASE2_AUTHORITY_BYTES = ${60738}`],
  [/FINANCING_COVENANTS_PHASE2_AUTHORITY_SHA256 =\n  '[^']+'/g,
    `TAX_MATTERS_PHASE2_AUTHORITY_SHA256 =\n  '872d1cce1125b99d2a95d418957ca99edb711a96b24e74eb4586ad28363e18bf'`],
  [/familyfinancingcovenants/g, 'familytaxmatters'],
  [/three comparator deals \(Concho, Skechers, TopBuild\)/g,
    'four comparator deals (Concho, Skechers, Skywater, TopBuild)'],
  [/three comparator deals/g, 'four comparator deals'],
  [/Comparator deals \| 3/g, 'Comparator deals | 4'],
  [/comparator_deal_count: 3/g, 'comparator_deal_count: 4'],
  [/KEEP_ALL_5_PROPOSALS/g, 'KEEP_ALL_17_PROPOSALS'],
  [/BEN_5_PROFILE/g, 'BEN_17_PROFILE'],
  [/UNAPPROVED_5_PROFILE/g, 'UNAPPROVED_17_PROFILE'],
  [/REVIEW_ONLY_5_PROFILES/g, 'REVIEW_ONLY_17_PROFILES'],
  [/5_REVIEW_PROPOSALS/g, '17_REVIEW_PROPOSALS'],
  [/FINANCING_COVENANTS_5_PROFILE/g, 'TAX_MATTERS_17_PROFILE'],
  [/FINANCING_COVENANTS five-profile/g, 'TAX_MATTERS 17-profile'],
  [/FINANCING_COVENANTS five profile/g, 'TAX_MATTERS 17 profile'],
  [/FINANCING_COVENANTS 5-profile/g, 'TAX_MATTERS 17-profile'],
  [/FINANCING_COVENANTS 5 profile/g, 'TAX_MATTERS 17 profile'],
  [/five-profile Work3/g, '17-profile Work3'],
  [/five profile Work3/g, '17 profile Work3'],
  [/The five profiles/g, 'The 17 profiles'],
  [/The 5 profiles/g, 'The 17 profiles'],
  [/exactly 5/g, 'exactly 17'],
  [/exactly five/g, 'exactly seventeen'],
  [/FIVE_GOVERNED_CLAIMS/g, 'SEVENTEEN_GOVERNED_CLAIMS'],
  [/Five governed/g, 'Seventeen governed'],
  [/sparse-to-medium set/g, 'medium wave-4 tax cluster'],
  [/payoff lead-time/g, 'multi-limb opinion cooperation'],
  [/PAYOFF/g, 'TAX_OPINION_COOPERATION'],
  [/OBTAIN_FINANCING/g, 'INTENDED_TAX_TREATMENT'],
  [/NO_FINANCING_CONDITION/g, 'TRANSFER_TAX_ALLOCATION'],
  [/COST_AND_RISK_ALLOCATION/g, 'TAX_INTEGRATION_OR_SPECIAL_MECHANIC'],
  [/NOTE_OFFER_OR_CONSENT/g, 'FIRPTA_CERTIFICATE'],
  [/ALTERNATIVE_FINANCING/g, 'TAX_REPORTING_CONSISTENCY'],
  [/TARGET_COOPERATION/g, 'WITHHOLDING_MECHANIC'],
  [/GUARANTY_FINANCING_PARTY/g, 'CLOSING_CONDITIONS'],
  [/FINANCING_SOURCE_PROTECTION_WAIVER/g, 'TAX_OPINION_RECEIPT_ONLY_CLOSING_CONDITION'],
  [/FINANCING_ASSERTIONS_GOVERNED_FINANCING_MECHANICS_EVIDENCE_ONLY/g,
    'TAX_ASSERTIONS_GOVERNED_COOPERATION_COVENANTS_CC_TAX_OPINION_RECEIPT_ONLY_LINK_ONLY'],
  [/CALIBRATION_PACK_TAGS_ALL_THREE_EXAMPLES_OBTAIN_FINANCING/g,
    'CALIBRATION_PACK_TAGS_ALL_FOUR_EXAMPLES_INTENDED_TAX_TREATMENT'],
  [/sparse_comparator_stress: 'FIVE_GOVERNED_CLAIMS_ACROSS_THREE_COMPARATOR_DEALS'/g,
    "sparse_comparator_stress: 'SEVENTEEN_GOVERNED_CLAIMS_ACROSS_FOUR_COMPARATOR_DEALS'"],
];

function transform(content) {
  let out = content;
  for (const [pattern, replacement] of REPLACEMENTS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

const pairs = [
  [
    'lib/canonical-v2/m7-v2-financing-covenants-authoring.js',
    'lib/canonical-v2/m7-v2-tax-matters-authoring.js',
  ],
  [
    'scripts/stage-2y-structure-m7-v2-financing-covenants-authoring-phase4-authority.mjs',
    'scripts/stage-2y-structure-m7-v2-tax-matters-authoring-phase4-authority.mjs',
  ],
  [
    'scripts/stage-2y-structure-m7-v2-financing-covenants-inventory-review-packet.mjs',
    'scripts/stage-2y-structure-m7-v2-tax-matters-inventory-review-packet.mjs',
  ],
  [
    'scripts/stage-2y-structure-m7-v2-financing-covenants-ben-inventory-disposition.mjs',
    'scripts/stage-2y-structure-m7-v2-tax-matters-ben-inventory-disposition.mjs',
  ],
  [
    'scripts/stage-2y-structure-m7-v2-financing-covenants-family-profile-package.mjs',
    'scripts/stage-2y-structure-m7-v2-tax-matters-family-profile-package.mjs',
  ],
  [
    'tests/stage-2y-structure-m7-v2-repair-financing-covenants-work3.test.js',
    'tests/stage-2y-structure-m7-v2-repair-tax-matters-work3.test.js',
  ],
];

for (const [src, dest] of pairs) {
  const content = transform(readFileSync(join(REPO_ROOT, src), 'utf8'));
  writeFileSync(join(REPO_ROOT, dest), content);
  console.log(`wrote ${dest}`);
}

console.log(JSON.stringify({
  profile_count: 17,
  outside_calibration: outsideCalibration,
  subtype_divergence: subtypeDivergence,
}, null, 2));
