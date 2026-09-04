#!/usr/bin/env node
/** Bootstrap CONSIDERATION family-local files from TAX_MATTERS templates. */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '..');

const REPLACEMENTS = [
  [/TAX_MATTERS/g, 'CONSIDERATION'],
  [/tax_matters/g, 'consideration'],
  [/taxMatters/g, 'consideration'],
  [/TaxMatters/g, 'Consideration'],
  [/Tax Matters/g, 'Consideration'],
  [/tax-matters/g, 'consideration'],
  [/Tax matters/g, 'Consideration'],
  [/N1 family #13/g, 'N1 family #15'],
  [/family #13/g, 'family #15'],
  [/TAX_MATTERS_PROFILE_COUNT = 17/g, 'CONSIDERATION_PROFILE_COUNT = 7'],
  [/TAX_MATTERS_SUBTYPE_DIVERGENCE_PROFILE_COUNT = \d+/g,
    'CONSIDERATION_SUBTYPE_DIVERGENCE_PROFILE_COUNT = 7'],
  [/TAX_MATTERS_OUTSIDE_CALIBRATION_PROFILE_COUNT = \d+/g,
    'CONSIDERATION_OUTSIDE_CALIBRATION_PROFILE_COUNT = 0'],
  [/TAX_MATTERS_REGISTERED_SUBTYPE_BUCKET_COUNT = 8/g,
    'CONSIDERATION_REGISTERED_SUBTYPE_BUCKET_COUNT = 10'],
  [/TAX_MATTERS_POPULATED_SUBTYPE_BUCKET_COUNT = 4/g,
    'CONSIDERATION_POPULATED_SUBTYPE_BUCKET_COUNT = 2'],
  [/familytaxmatters/g, 'familyconsideration'],
  [/four comparator deals \(Concho, Skechers, Skywater, TopBuild\)/g,
    'four comparator deals (Metsera, Red Hat, Skechers, TopBuild)'],
  [/Concho, Skechers, Skywater, TopBuild/g, 'Metsera, Red Hat, Skechers, TopBuild'],
  [/three comparator deals/g, 'four comparator deals'],
  [/Comparator deals \| 4/g, 'Comparator deals | 4'],
  [/comparator_deal_count: 4/g, 'comparator_deal_count: 4'],
  [/KEEP_ALL_17_PROPOSALS/g, 'KEEP_ALL_7_PROPOSALS'],
  [/BEN_17_PROFILE/g, 'BEN_7_PROFILE'],
  [/UNAPPROVED_17_PROFILE/g, 'UNAPPROVED_7_PROFILE'],
  [/REVIEW_ONLY_17_PROFILES/g, 'REVIEW_ONLY_7_PROFILES'],
  [/17_REVIEW_PROPOSALS/g, '7_REVIEW_PROPOSALS'],
  [/TAX_MATTERS_17_PROFILE/g, 'CONSIDERATION_7_PROFILE'],
  [/17-profile/g, '7-profile'],
  [/17 profile/g, '7 profile'],
  [/17 profiles/g, '7 profiles'],
  [/17_PROFILE/g, '7_PROFILE'],
  [/Seventeen/g, 'Seven'],
  [/seventeen/g, 'seven'],
  [/exactly 17/g, 'exactly 7'],
  [/exactly seventeen/g, 'exactly seven'],
  [/The 17 profiles/g, 'The 7 profiles'],
  [/17 governed/g, '7 governed'],
  [/17-profile Work3/g, '7-profile Work3'],
  [/INTENDED_TAX_TREATMENT/g, 'CONSIDERATION_PACKAGE'],
  [/TAX_TREATMENT_PROTECTION/g, 'CASH_COMPONENT'],
  [/TAX_REPORTING_CONSISTENCY/g, 'STOCK_COMPONENT'],
  [/TAX_OPINION_COOPERATION/g, 'CVR_COMPONENT'],
  [/TRANSFER_TAX_ALLOCATION/g, 'ELECTION'],
  [/WITHHOLDING_MECHANIC/g, 'APPRAISAL_LINK'],
  [/FIRPTA_CERTIFICATE/g, 'EXCLUSION'],
  [/TAX_INTEGRATION_OR_SPECIAL_MECHANIC/g, 'EQUITY_AWARD'],
  [/INTENDED_TAX_TREATMENT_KIND/g, 'PER_SHARE_CASH_CONSIDERATION'],
  [/TAX_TREATMENT_PROTECTION_COVENANT/g, 'APPRAISAL_RIGHTS_STATUS'],
  [/TAX_OPINION_COOPERATION_COVENANT/g, 'PER_SHARE_CASH_CONSIDERATION'],
  [/SEVENTEEN_GOVERNED_CLAIMS/g, 'SEVEN_GOVERNED_CLAIMS'],
  [/Seventeen governed/g, 'Seven governed'],
  [/sparse-to-medium set/g, 'sparse wave-4 deal-economics cluster'],
  [/multi-limb opinion cooperation/g, 'election-branch per-share cash and appraisal linkage'],
  [/TAX_ASSERTIONS_GOVERNED_COOPERATION_COVENANTS_CC_TAX_OPINION_RECEIPT_ONLY_LINK_ONLY/g,
    'CONSIDERATION_ASSERTIONS_GOVERNED_PER_SHARE_CASH_AND_APPRAISAL_STATUS_APPRAISAL_FAMILY_Q02_LINK_ONLY'],
  [/CALIBRATION_PACK_TAGS_ALL_FOUR_EXAMPLES_INTENDED_TAX_TREATMENT/g,
    'CALIBRATION_PACK_TAGS_ALL_FOUR_EXAMPLES_CONSIDERATION_PACKAGE'],
  [/CLOSING_CONDITIONS tax-opinion receipt-only closing conditions stay link-only \(Q02\)/g,
    'APPRAISAL_DISSENTERS_RIGHTS shared-section appraisal mechanics stay Q02 link-only'],
  [/Closing Conditions tax-opinion receipt-only conditions stay link-only \(Q02\)/g,
    'Appraisal / dissenters-rights shared-section mechanics stay Q02 link-only'],
  [/TAX_OPINION_RECEIPT_ONLY_CLOSING_CONDITION/g, 'APPRAISAL_DISSENTERS_RIGHTS_SHARED_SECTION'],
  [/LINK_ONLY_NOT_A_TAX_MATTERS_TERMINAL/g, 'LINK_ONLY_NOT_A_CONSIDERATION_TERMINAL'],
  [/owner_family_key: 'CLOSING_CONDITIONS'/g,
    "owner_family_key: 'APPRAISAL_DISSENTERS_RIGHTS'"],
  [/subject: 'TAX_OPINION_RECEIPT_ONLY_CLOSING_CONDITION'/g,
    "subject: 'APPRAISAL_DISSENTERS_RIGHTS_SHARED_SECTION'"],
  [/INTENDED_TAX_TREATMENT_KIND: 'INTENDED_TAX_TREATMENT'/g,
    "PER_SHARE_CASH_CONSIDERATION: 'CASH_COMPONENT'"],
  [/TAX_TREATMENT_PROTECTION_COVENANT: 'TAX_TREATMENT_PROTECTION'/g,
    "APPRAISAL_RIGHTS_STATUS: 'APPRAISAL_LINK'"],
  [/TAX_OPINION_COOPERATION_COVENANT: 'TAX_OPINION_COOPERATION'/g,
    "PER_SHARE_CASH_CONSIDERATION: 'CASH_COMPONENT'"],
  [/TRANSFER_TAX_ALLOCATION: 'TRANSFER_TAX_ALLOCATION'/g,
    "APPRAISAL_RIGHTS_STATUS: 'APPRAISAL_LINK'"],
  [/sparse_comparator_stress: 'SEVENTEEN_GOVERNED_CLAIMS_ACROSS_FOUR_COMPARATOR_DEALS'/g,
    "sparse_comparator_stress: 'SEVEN_GOVERNED_CLAIMS_ACROSS_FOUR_COMPARATOR_DEALS'"],
  [/Seven governed M4 claims across four comparator deals \(Metsera, Red Hat, Skechers, TopBuild\)/g,
    'Seven governed M4 claims across four comparator deals (Metsera, Red Hat, Skechers, TopBuild)'],
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
    'scripts/stage-2y-structure-m7-v2-consideration-authoring-phase2-authority.mjs',
    'scripts/stage-2y-structure-m7-v2-consideration-authoring-phase2-authority.mjs',
  ],
  [
    'scripts/stage-2y-structure-m7-v2-consideration-authoring-phase4-authority.mjs',
    'scripts/stage-2y-structure-m7-v2-consideration-authoring-phase4-authority.mjs',
  ],
  [
    'scripts/stage-2y-structure-m7-v2-consideration-inventory-review-packet.mjs',
    'scripts/stage-2y-structure-m7-v2-consideration-inventory-review-packet.mjs',
  ],
  [
    'scripts/stage-2y-structure-m7-v2-consideration-ben-inventory-disposition.mjs',
    'scripts/stage-2y-structure-m7-v2-consideration-ben-inventory-disposition.mjs',
  ],
  [
    'scripts/stage-2y-structure-m7-v2-consideration-family-profile-package.mjs',
    'scripts/stage-2y-structure-m7-v2-consideration-family-profile-package.mjs',
  ],
  [
    'lib/canonical-v2/m7-v2-consideration-authoring.js',
    'lib/canonical-v2/m7-v2-consideration-authoring.js',
  ],
  [
    'tests/stage-2y-structure-m7-v2-repair-consideration-work3.test.js',
    'tests/stage-2y-structure-m7-v2-repair-consideration-work3.test.js',
  ],
];

for (const [, dest] of pairs) {
  const content = transform(readFileSync(join(REPO_ROOT, dest), 'utf8'));
  writeFileSync(join(REPO_ROOT, dest), content);
  console.log(`transformed ${dest}`);
}

console.log('bootstrap complete');
