#!/usr/bin/env node
/** Bootstrap KEY_DEFINED_TERMS family-local files from CONSIDERATION templates. */
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '..');

const REPLACEMENTS = [
  [/CONSIDERATION/g, 'KEY_DEFINED_TERMS'],
  [/consideration/g, 'key_defined_terms'],
  [/Consideration/g, 'KeyDefinedTerms'],
  [/Consideration /g, 'Key Defined Terms '],
  [/N1 family #15/g, 'N1 family #16'],
  [/family #15/g, 'family #16'],
  [/CONSIDERATION_PROFILE_COUNT = 7/g, 'KEY_DEFINED_TERMS_PROFILE_COUNT = 76'],
  [/CONSIDERATION_SUBTYPE_DIVERGENCE_PROFILE_COUNT = \d+/g,
    'KEY_DEFINED_TERMS_SUBTYPE_DIVERGENCE_PROFILE_COUNT = 56'],
  [/CONSIDERATION_OUTSIDE_CALIBRATION_PROFILE_COUNT = \d+/g,
    'KEY_DEFINED_TERMS_OUTSIDE_CALIBRATION_PROFILE_COUNT = 20'],
  [/CONSIDERATION_REGISTERED_SUBTYPE_BUCKET_COUNT = 10/g,
    'KEY_DEFINED_TERMS_REGISTERED_SUBTYPE_BUCKET_COUNT = 5'],
  [/CONSIDERATION_POPULATED_SUBTYPE_BUCKET_COUNT = 2/g,
    'KEY_DEFINED_TERMS_POPULATED_SUBTYPE_BUCKET_COUNT = 5'],
  [/familyconsideration/g, 'familykeydefinedterms'],
  [/four comparator deals \(Metsera, Red Hat, Skechers, TopBuild\)/g,
    'six comparator deals (Concho, Metsera, Red Hat, Skechers, Skywater, TopBuild)'],
  [/Metsera, Red Hat, Skechers, TopBuild/g,
    'Concho, Metsera, Red Hat, Skechers, Skywater, TopBuild'],
  [/three comparator deals/g, 'six comparator deals'],
  [/four comparator deals/g, 'six comparator deals'],
  [/comparator_deal_count: 4/g, 'comparator_deal_count: 6'],
  [/KEEP_ALL_7_PROPOSALS/g, 'KEEP_ALL_76_PROPOSALS'],
  [/BEN_7_PROFILE/g, 'BEN_76_PROFILE'],
  [/UNAPPROVED_7_PROFILE/g, 'UNAPPROVED_76_PROFILE'],
  [/REVIEW_ONLY_7_PROFILES/g, 'REVIEW_ONLY_76_PROFILES'],
  [/7_REVIEW_PROPOSALS/g, '76_REVIEW_PROPOSALS'],
  [/CONSIDERATION_7_PROFILE/g, 'KEY_DEFINED_TERMS_76_PROFILE'],
  [/7-profile/g, '76-profile'],
  [/7 profile/g, '76 profile'],
  [/7 profiles/g, '76 profiles'],
  [/7_PROFILE/g, '76_PROFILE'],
  [/Seven/g, 'Seventy-six'],
  [/seven/g, 'seventy-six'],
  [/exactly 7/g, 'exactly 76'],
  [/exactly seven/g, 'exactly seventy-six'],
  [/The 7 profiles/g, 'The 76 profiles'],
  [/7 governed/g, '76 governed'],
  [/7-profile Work3/g, '76-profile Work3'],
  [/PER_SHARE_CASH_CONSIDERATION/g, 'ACQUISITION_PROPOSAL_THRESHOLD_PERCENT'],
  [/APPRAISAL_RIGHTS_STATUS/g, 'KNOWLEDGE_PERSON_SOURCE'],
  [/CONSIDERATION_PACKAGE/g, 'ACQUISITION_PROPOSAL'],
  [/CASH_COMPONENT/g, 'SUPERIOR_PROPOSAL'],
  [/STOCK_COMPONENT/g, 'INTERVENING_EVENT'],
  [/CVR_COMPONENT/g, 'KNOWLEDGE'],
  [/ELECTION/g, 'WILLFUL_BREACH'],
  [/APPRAISAL_LINK/g, 'ACQUISITION_PROPOSAL'],
  [/EXCLUSION/g, 'SUPERIOR_PROPOSAL'],
  [/EQUITY_AWARD/g, 'INTERVENING_EVENT'],
  [/WITHHOLDING/g, 'KNOWLEDGE'],
  [/EXCHANGE_MECHANICS/g, 'WILLFUL_BREACH'],
  [/APPRAISAL_DISSENTERS_RIGHTS/g, 'REPRESENTATIONS'],
  [/APPRAISAL_DISSENTERS_RIGHTS_SHARED_SECTION/g,
    'REPRESENTATIONS_KNOWLEDGE_QUALIFIER_ROWS'],
  [/LINK_ONLY_NOT_A_CONSIDERATION_TERMINAL/g,
    'LINK_ONLY_NOT_A_KEY_DEFINED_TERMS_TERMINAL'],
  [/sparse wave-4 deal-economics cluster/g,
    'wave-2 definitions-article cluster with Representations Q02 knowledge boundary'],
  [/SEVEN_GOVERNED_CLAIMS/g, 'SEVENTY_SIX_GOVERNED_CLAIMS'],
  [/Seven governed/g, 'Seventy-six governed'],
  [/sparse-to-medium set/g, 'medium-density definitions set'],
  [/election-branch per-share cash and appraisal linkage/g,
    'knowledge-person and standard definition content with Representations link-only boundary'],
  [/CONSIDERATION_ASSERTIONS_GOVERNED_PER_SHARE_CASH_AND_APPRAISAL_STATUS_APPRAISAL_FAMILY_Q02_LINK_ONLY/g,
    'KEY_DEFINED_TERMS_ASSERTIONS_GOVERNED_DEFINITION_CONTENT_REPRESENTATIONS_KNOWLEDGE_Q02_LINK_ONLY'],
  [/CALIBRATION_PACK_TAGS_ALL_FOUR_EXAMPLES_CONSIDERATION_PACKAGE/g,
    'CALIBRATION_PACK_TAGS_ALL_SIX_EXAMPLES_ACQUISITION_PROPOSAL'],
  [/Appraisal \/ dissenters-rights shared-section mechanics stay Q02 link-only/g,
    'Representations KNOWLEDGE_QUALIFIER rows stay Q02 link-only — do not absorb'],
  [/per-share cash amounts and appraisal-rights linkage limbs/g,
    'knowledge-person definitions, superior-proposal thresholds, intervening events, and willful-breach definitions'],
  [/wave 4/g, 'wave 2'],
  [/wave: 4/g, 'wave: 2'],
  [/CONSIDERATION_PHASE2_AUTHORITY_BYTES = \d+/g,
    'KEY_DEFINED_TERMS_PHASE2_AUTHORITY_BYTES = 0'],
  [/CONSIDERATION_PHASE2_AUTHORITY_SHA256 =\n  '[^']+'/g,
    "KEY_DEFINED_TERMS_PHASE2_AUTHORITY_SHA256 =\n  '0'.repeat(64)"],
  [/CONSIDERATION_PHASE2_AUTHORITY_ID =\n  '[^']+'/g,
    "KEY_DEFINED_TERMS_PHASE2_AUTHORITY_ID =\n  '0'.repeat(64)"],
  [/CONSIDERATION_PHASE4_AUTHORITY_BYTES = \d+/g,
    'KEY_DEFINED_TERMS_PHASE4_AUTHORITY_BYTES = 0'],
  [/CONSIDERATION_PHASE4_AUTHORITY_SHA256 =\n  '[^']+'/g,
    "KEY_DEFINED_TERMS_PHASE4_AUTHORITY_SHA256 =\n  '0'.repeat(64)"],
  [/CONSIDERATION_PHASE4_AUTHORITY_ID =\n  '[^']+'/g,
    "KEY_DEFINED_TERMS_PHASE4_AUTHORITY_ID =\n  '0'.repeat(64)"],
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
    'lib/canonical-v2/m7-v2-consideration-authoring.js',
    'lib/canonical-v2/m7-v2-key-defined-terms-authoring.js',
  ],
  [
    'scripts/stage-2y-structure-m7-v2-consideration-authoring-phase4-authority.mjs',
    'scripts/stage-2y-structure-m7-v2-key-defined-terms-authoring-phase4-authority.mjs',
  ],
  [
    'scripts/stage-2y-structure-m7-v2-consideration-inventory-review-packet.mjs',
    'scripts/stage-2y-structure-m7-v2-key-defined-terms-inventory-review-packet.mjs',
  ],
  [
    'scripts/stage-2y-structure-m7-v2-consideration-ben-inventory-disposition.mjs',
    'scripts/stage-2y-structure-m7-v2-key-defined-terms-ben-inventory-disposition.mjs',
  ],
  [
    'scripts/stage-2y-structure-m7-v2-consideration-family-profile-package.mjs',
    'scripts/stage-2y-structure-m7-v2-key-defined-terms-family-profile-package.mjs',
  ],
  [
    'tests/stage-2y-structure-m7-v2-repair-consideration-work3.test.js',
    'tests/stage-2y-structure-m7-v2-repair-key-defined-terms-work3.test.js',
  ],
];

for (const [src, dest] of pairs) {
  const content = transform(readFileSync(join(REPO_ROOT, src), 'utf8'));
  writeFileSync(join(REPO_ROOT, dest), content);
  console.log(`bootstrapped ${dest}`);
}

console.log('bootstrap complete — phase2 authority script must be written separately');
