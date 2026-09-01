#!/usr/bin/env node
/** Bootstrap MISC_BOILERPLATE family-local files from INTERIM_OPERATING templates. */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import canonicalModule from '../lib/canonical-v2/canonical-bytes.js';

const { sha256Hex } = canonicalModule;
const REPO_ROOT = join(import.meta.dirname, '..');

const PHASE2_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-misc-boilerplate-authoring-phase2-authority-v2.json';

const phase2Bytes = readFileSync(join(REPO_ROOT, PHASE2_PATH));
const PHASE2 = JSON.parse(phase2Bytes.toString('utf8'));

const terminals = PHASE2.source_terminal_successor_contract.terminal_rule_registry;
const outsideCalibration = terminals.filter((t) => t.unresolved_items.includes(
  'COMPARATOR_CLAIM_OUTSIDE_CALIBRATION_PROVISION_EXAMPLES',
)).length;
const subtypeDivergence = terminals.filter((t) => t.unresolved_items.includes(
  'SUBTYPE_PARTITION_DIVERGES_FROM_CALIBRATION_PROPOSED_SUBTYPE',
)).length;
const populatedBuckets = PHASE2.source_terminal_successor_contract.populated_classification_buckets.length;

const REPLACEMENTS = [
  [/INTERIM_OPERATING/g, 'MISC_BOILERPLATE'],
  [/interim_operating/g, 'misc_boilerplate'],
  [/interimOperating/g, 'miscBoilerplate'],
  [/InterimOperating/g, 'MiscBoilerplate'],
  [/Interim Operating/g, 'Misc Boilerplate'],
  [/Interim operating/g, 'Misc boilerplate'],
  [/interim-operating/g, 'misc-boilerplate'],
  [/N1 family #21/g, 'N1 family #24'],
  [/family #21/g, 'family #24'],
  [/INTERIM_OPERATING_PROFILE_COUNT = 113/g, 'MISC_BOILERPLATE_PROFILE_COUNT = 114'],
  [/INTERIM_OPERATING_SUBTYPE_DIVERGENCE_PROFILE_COUNT = \d+/g,
    `MISC_BOILERPLATE_SUBTYPE_DIVERGENCE_PROFILE_COUNT = ${subtypeDivergence}`],
  [/INTERIM_OPERATING_OUTSIDE_CALIBRATION_PROFILE_COUNT = \d+/g,
    `MISC_BOILERPLATE_OUTSIDE_CALIBRATION_PROFILE_COUNT = ${outsideCalibration}`],
  [/INTERIM_OPERATING_REGISTERED_SUBTYPE_BUCKET_COUNT = 5/g,
    'MISC_BOILERPLATE_REGISTERED_SUBTYPE_BUCKET_COUNT = 12'],
  [/INTERIM_OPERATING_POPULATED_SUBTYPE_BUCKET_COUNT = 1/g,
    `MISC_BOILERPLATE_POPULATED_SUBTYPE_BUCKET_COUNT = ${populatedBuckets}`],
  [/INTERIM_OPERATING_PHASE2_AUTHORITY_ID =\n  '[^']+'/g,
    `MISC_BOILERPLATE_PHASE2_AUTHORITY_ID =\n  '${PHASE2.misc_boilerplate_authoring_phase2_authority_id}'`],
  [/INTERIM_OPERATING_PHASE2_AUTHORITY_BYTES = \d+/g,
    `MISC_BOILERPLATE_PHASE2_AUTHORITY_BYTES = ${phase2Bytes.length}`],
  [/INTERIM_OPERATING_PHASE2_AUTHORITY_SHA256 =\n  '[^']+'/g,
    `MISC_BOILERPLATE_PHASE2_AUTHORITY_SHA256 =\n  '${sha256Hex(phase2Bytes)}'`],
  [/familyinterimoperating/g, 'familymiscboilerplate'],
  [/six comparator deals \(Concho, Metsera, Red Hat, Skechers, Skywater, TopBuild\)/g,
    'six comparator deals (Concho, Metsera, Modiv, Skechers, Skywater, TopBuild)'],
  [/Red Hat, Skechers, Skywater, TopBuild/g,
    'Modiv, Skechers, Skywater, TopBuild'],
  [/One hundred thirteen/g, 'One hundred fourteen'],
  [/one hundred thirteen/g, 'one hundred fourteen'],
  [/113-profile/g, '114-profile'],
  [/113 profile/g, '114 profile'],
  [/113 profiles/g, '114 profiles'],
  [/113_PROFILE/g, '114_PROFILE'],
  [/KEEP_ALL_113_PROPOSALS/g, 'KEEP_ALL_114_PROPOSALS'],
  [/BEN_113_PROFILE/g, 'BEN_114_PROFILE'],
  [/UNAPPROVED_113_PROFILE/g, 'UNAPPROVED_114_PROFILE'],
  [/REVIEW_ONLY_113_PROFILES/g, 'REVIEW_ONLY_114_PROFILES'],
  [/113_REVIEW_PROPOSALS/g, '114_REVIEW_PROPOSALS'],
  [/INTERIM_OPERATING_113_PROFILE/g, 'MISC_BOILERPLATE_114_PROFILE'],
  [/exactly 113/g, 'exactly 114'],
  [/The 113 profiles/g, 'The 114 profiles'],
  [/113 governed/g, '114 governed'],
  [/RESTRICTIVE_COVENANT/g, 'GOVERNING_LAW'],
  [/AFFIRMATIVE_COVENANT/g, 'FORUM'],
  [/CONSENT_STANDARD/g, 'ASSIGNMENT'],
  [/THRESHOLD/g, 'AMENDMENT_WAIVER'],
  [/EXCEPTION/g, 'NOTICE'],
  [/0 non-GOVERNING_LAW/g, `${subtypeDivergence} non-GOVERNING_LAW`],
  [/interim operating restriction limbs that differ/g,
    'misc-boilerplate mechanic limbs that differ'],
  [/Concho section 6\.1 carries eighteen independently operative limbs/g,
    'TopBuild Article VII carries twenty-six independently operative limbs'],
  [/INTERIM_OPERATING_ASSERTIONS_GOVERNED_INTERIM_COVENANT_EVIDENCE_ONLY/g,
    'MISC_BOILERPLATE_ASSERTIONS_GOVERNED_BOILERPLATE_MECHANIC_EVIDENCE_ONLY'],
  [/CALIBRATION_PACK_TAGS_ALL_SIX_EXAMPLES_RESTRICTIVE_COVENANT/g,
    'CALIBRATION_PACK_TAGS_ALL_SIX_EXAMPLES_GOVERNING_LAW'],
  [/one populated bucket/g, `${populatedBuckets} populated buckets`],
  [/one populated subtype bucket/g, `${populatedBuckets} populated subtype buckets`],
  [/one populated/g, `${populatedBuckets} populated`],
  [/five subtype buckets/g, 'twelve subtype buckets'],
  [/one claim definition key under all five subtype buckets/g,
    'one claim definition key under all twelve subtype buckets'],
  [/General Covenants overlap stays classifier-resolved; dividend coordination covenant stays link-only under Dividends Q02./,
    'Termination rights-survival rows on shared sections stay link-only under Q02.'],
  [/outside_calibration_example_flag_count: \d+/g,
    `outside_calibration_example_flag_count: ${outsideCalibration}`],
  [/subtype_partition_divergence_flag_count: \d+/g,
    `subtype_partition_divergence_flag_count: ${subtypeDivergence}`],
  [/Ben approves the INTERIM_OPERATING 113-profile/g,
    'Ben approves the MISC_BOILERPLATE 114-profile'],
  [/INTERIM_OPERATING 113-profile Work3/g, 'MISC_BOILERPLATE 114-profile Work3'],
  [/ONE_HUNDRED_THIRTEEN_GOVERNED_CLAIMS/g, 'ONE_HUNDRED_FOURTEEN_GOVERNED_CLAIMS'],
  [/FIVE_SUBTYPE_BUCKETS/g, 'TWELVE_SUBTYPE_BUCKETS'],
  [/docs\/codex-program\/notes\/INTERIM-OPERATING-BEN-RULINGS-Q01-Q03-2026-08-24.md/g,
    'docs/codex-program/notes/MISC-BOILERPLATE-BEN-RULINGS-Q01-Q03-2026-08-24.md'],
  [/exact_agreement_terminal_counts[\s\S]*?\{[\s\S]*?\[TOPBUILD_AGREEMENT_ID\]: 26,[\s\S]*?\}/,
    `authority.source_terminal_successor_contract.exact_agreement_terminal_counts,
    {
      [CONCHO_AGREEMENT_ID]: 17,
      [METSERA_AGREEMENT_ID]: 16,
      [MODIV_AGREEMENT_ID]: 14,
      [SKECHERS_AGREEMENT_ID]: 24,
      [SKYWATER_AGREEMENT_ID]: 17,
      [TOPBUILD_AGREEMENT_ID]: 26,
    }`],
  [/populated_classification_buckets[\s\S]*?\[[\s\S]*?'GOVERNING_LAW'[\s\S]*?\]/,
    `authority.source_terminal_successor_contract.populated_classification_buckets,
    [
      'GOVERNING_LAW',
      'FORUM',
      'ASSIGNMENT',
      'AMENDMENT_WAIVER',
      'NOTICE',
      'ENTIRE_AGREEMENT',
      'THIRD_PARTY_BENEFICIARY',
      'SEVERABILITY',
      'COUNTERPARTS',
      'SURVIVAL',
      'CONSTRUCTION',
      'EXPENSES',
    ]`],
  [/CLASSIFICATION_BUCKETS = Object\.freeze\(\[[\s\S]*?\]\);/,
    `const MODIV_AGREEMENT_ID =
  'fb76ef57355bef7f05b3b8955f5f7da4f430964923fecce0c95156c6e0b04a5c';

const CLASSIFICATION_BUCKETS = Object.freeze([
  'GOVERNING_LAW',
  'FORUM',
  'ASSIGNMENT',
  'AMENDMENT_WAIVER',
  'NOTICE',
  'ENTIRE_AGREEMENT',
  'THIRD_PARTY_BENEFICIARY',
  'SEVERABILITY',
  'COUNTERPARTS',
  'SURVIVAL',
  'CONSTRUCTION',
  'EXPENSES',
]);`],
  [/cross_family_link_only_boundaries\.map[\s\S]*?\),\s*\[\s*\]/,
    `cross_family_link_only_boundaries.map(
      (entry) => entry.owner_family_key,
    ),
    ['TERMINATION']`],
  [/outside_calibration_example_count:\s*\n\s*interimOperatingAuthoring\.INTERIM_OPERATING_OUTSIDE_CALIBRATION_PROFILE_COUNT/g,
    'outside_calibration_example_count:\n      miscBoilerplateAuthoring.MISC_BOILERPLATE_OUTSIDE_CALIBRATION_PROFILE_COUNT'],
  [/subtype_partition_divergence_count:\s*\n\s*interimOperatingAuthoring\.INTERIM_OPERATING_SUBTYPE_DIVERGENCE_PROFILE_COUNT/g,
    'subtype_partition_divergence_count:\n      miscBoilerplateAuthoring.MISC_BOILERPLATE_SUBTYPE_DIVERGENCE_PROFILE_COUNT'],
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
    'lib/canonical-v2/m7-v2-interim-operating-authoring.js',
    'lib/canonical-v2/m7-v2-misc-boilerplate-authoring.js',
  ],
  [
    'scripts/stage-2y-structure-m7-v2-interim-operating-authoring-phase4-authority.mjs',
    'scripts/stage-2y-structure-m7-v2-misc-boilerplate-authoring-phase4-authority.mjs',
  ],
  [
    'scripts/stage-2y-structure-m7-v2-interim-operating-inventory-review-packet.mjs',
    'scripts/stage-2y-structure-m7-v2-misc-boilerplate-inventory-review-packet.mjs',
  ],
  [
    'scripts/stage-2y-structure-m7-v2-interim-operating-ben-inventory-disposition.mjs',
    'scripts/stage-2y-structure-m7-v2-misc-boilerplate-ben-inventory-disposition.mjs',
  ],
  [
    'scripts/stage-2y-structure-m7-v2-interim-operating-family-profile-package.mjs',
    'scripts/stage-2y-structure-m7-v2-misc-boilerplate-family-profile-package.mjs',
  ],
  [
    'tests/stage-2y-structure-m7-v2-repair-interim-operating-work3.test.js',
    'tests/stage-2y-structure-m7-v2-repair-misc-boilerplate-work3.test.js',
  ],
];

for (const [src, dest] of pairs) {
  const content = transform(readFileSync(join(REPO_ROOT, src), 'utf8'));
  writeFileSync(join(REPO_ROOT, dest), content);
  console.log(`wrote ${dest}`);
}

console.log(JSON.stringify({
  profile_count: 114,
  outside_calibration: outsideCalibration,
  subtype_divergence: subtypeDivergence,
  populated_buckets: populatedBuckets,
  phase2_id: PHASE2.misc_boilerplate_authoring_phase2_authority_id,
}, null, 2));
