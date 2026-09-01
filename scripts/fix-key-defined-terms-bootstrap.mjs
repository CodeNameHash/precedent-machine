#!/usr/bin/env node
/** Fix camelCase and path hyphenation after bootstrap. */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '..');

const FILES = [
  'lib/canonical-v2/m7-v2-key-defined-terms-authoring.js',
  'scripts/stage-2y-structure-m7-v2-key-defined-terms-authoring-phase4-authority.mjs',
  'scripts/stage-2y-structure-m7-v2-key-defined-terms-inventory-review-packet.mjs',
  'scripts/stage-2y-structure-m7-v2-key-defined-terms-ben-inventory-disposition.mjs',
  'scripts/stage-2y-structure-m7-v2-key-defined-terms-family-profile-package.mjs',
  'tests/stage-2y-structure-m7-v2-repair-key-defined-terms-work3.test.js',
];

const REPLACEMENTS = [
  [/key_defined_termsAuthoring/g, 'keyDefinedTermsAuthoring'],
  [/key_defined_termsAgreementSources/g, 'keyDefinedTermsAgreementSources'],
  [/key_defined_termsProposalCoverageRecords/g, 'keyDefinedTermsProposalCoverageRecords'],
  [/key_defined_termsProposalPartition/g, 'keyDefinedTermsProposalPartition'],
  [/key_defined_termsProposalInventoryDigest/g, 'keyDefinedTermsProposalInventoryDigest'],
  [/key_defined_termsPhase4ExpectedParentBindings/g, 'keyDefinedTermsPhase4ExpectedParentBindings'],
  [/key_defined_termsContainsForbiddenKey/g, 'keyDefinedTermsContainsForbiddenKey'],
  [/key_defined_termsPhase4ValidatePhase2Proposal/g, 'keyDefinedTermsPhase4ValidatePhase2Proposal'],
  [/key_defined_termsPhase4DeriveProfiles/g, 'keyDefinedTermsPhase4DeriveProfiles'],
  [/key_defined_termsWork3ValidatePinnedEnvelope/g, 'keyDefinedTermsWork3ValidatePinnedEnvelope'],
  [/key_defined_termsWork3ValidateInput/g, 'keyDefinedTermsWork3ValidateInput'],
  [/key_defined_termsWork3Phase4/g, 'keyDefinedTermsWork3Phase4'],
  [/key_defined_termsWork3ValidatePacket/g, 'keyDefinedTermsWork3ValidatePacket'],
  [/key_defined_termsWork3ValidateDisposition/g, 'keyDefinedTermsWork3ValidateDisposition'],
  [/key_defined_termsWork3ValidateSessionReceipt/g, 'keyDefinedTermsWork3ValidateSessionReceipt'],
  [/key_defined_termsWork3ValidateSealReceipt/g, 'keyDefinedTermsWork3ValidateSealReceipt'],
  [/m7-v2-key_defined_terms-authoring/g, 'm7-v2-key-defined-terms-authoring'],
  [/m7-v2-repair-contract-key_defined_terms-/g, 'm7-v2-repair-contract-key-defined-terms-'],
  [/m7-v2-repair-key_defined_terms-/g, 'm7-v2-repair-key-defined-terms-'],
  [/m7-v2-repair-contract-work3-key_defined_terms-/g, 'm7-v2-repair-contract-work3-key-defined-terms-'],
  [/m7-v2-repair-family-work3-profile-package-key_defined_terms/g,
    'm7-v2-repair-family-work3-profile-package-key-defined-terms'],
  [/familykey_defined_terms/g, 'familykeydefinedterms'],
  [/repair-key_defined_terms-work3/g, 'repair-key-defined-terms-work3'],
  [/KEY_DEFINED_TERMS_PROFILE_COUNT = 7/g, 'KEY_DEFINED_TERMS_PROFILE_COUNT = 76'],
  [/KEY_DEFINED_TERMS_SUBTYPE_DIVERGENCE_PROFILE_COUNT = 7/g,
    'KEY_DEFINED_TERMS_SUBTYPE_DIVERGENCE_PROFILE_COUNT = 41'],
  [/KEY_DEFINED_TERMS_OUTSIDE_CALIBRATION_PROFILE_COUNT = 0/g,
    'KEY_DEFINED_TERMS_OUTSIDE_CALIBRATION_PROFILE_COUNT = 20'],
  [/KEY_DEFINED_TERMS_REGISTERED_SUBTYPE_BUCKET_COUNT = 10/g,
    'KEY_DEFINED_TERMS_REGISTERED_SUBTYPE_BUCKET_COUNT = 5'],
  [/KEY_DEFINED_TERMS_POPULATED_SUBTYPE_BUCKET_COUNT = 2/g,
    'KEY_DEFINED_TERMS_POPULATED_SUBTYPE_BUCKET_COUNT = 5'],
  [/KEY_DEFINED_TERMS_PHASE2_AUTHORITY_ID =\n  '[^']+'/g,
    "KEY_DEFINED_TERMS_PHASE2_AUTHORITY_ID =\n  '319f558db1531bc1dff3eb22767de67b6bb653f72f96b3c0401d3ef549959e8f'"],
  [/KEY_DEFINED_TERMS_PHASE2_AUTHORITY_BYTES = \d+/g,
    'KEY_DEFINED_TERMS_PHASE2_AUTHORITY_BYTES = 186117'],
  [/KEY_DEFINED_TERMS_PHASE2_AUTHORITY_SHA256 =\n  '[^']+'/g,
    "KEY_DEFINED_TERMS_PHASE2_AUTHORITY_SHA256 =\n  '4b8afa76e24d63a2fb9633fec144d226b54b4ef3e81f3b5293cb859474f5d5c4'"],
  [/Skechers §2\.7 carries\n \* two independently operative per-share cash election limbs plus appraisal linkage;\n \* Q01 requires one profile per limb, not one per section\./g,
    'Each profile binds one governed M4 claim; Representations KNOWLEDGE_QUALIFIER rows stay Q02 link-only.'],
  [/claim definition keys under all ten subtype buckets — so every profile carries\n \* LEGAL_GROUPING_REVIEW_REQUIRED; all seventy-six rows additionally carry\n \* SUBTYPE_PARTITION_DIVERGES_FROM_CALIBRATION_PROPOSED_SUBTYPE because the\n \* calibration pack tags every provision example KEY_DEFINED_TERMS_PACKAGE/g,
    'claim definition keys under five sealed subtype buckets — so every profile carries\n * LEGAL_GROUPING_REVIEW_REQUIRED; forty-one rows carry\n * SUBTYPE_PARTITION_DIVERGES_FROM_CALIBRATION_PROPOSED_SUBTYPE because the\n * calibration pack tags every provision example ACQUISITION_PROPOSAL; twenty rows carry\n * COMPARATOR_CLAIM_OUTSIDE_CALIBRATION_PROVISION_EXAMPLES'],
];

for (const rel of FILES) {
  let content = readFileSync(join(REPO_ROOT, rel), 'utf8');
  for (const [pattern, replacement] of REPLACEMENTS) {
    content = content.replace(pattern, replacement);
  }
  writeFileSync(join(REPO_ROOT, rel), content);
  console.log(`fixed ${rel}`);
}
