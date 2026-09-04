#!/usr/bin/env node
/** Bootstrap INTERIM_OPERATING family-local files from EMPLOYEE_MATTERS templates. */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '..');

const PHASE2_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-interim-operating-authoring-phase2-authority-v2.json';

const PHASE2 = JSON.parse(readFileSync(join(REPO_ROOT, PHASE2_PATH), 'utf8'));
const terminals = PHASE2.source_terminal_successor_contract.terminal_rule_registry;
const outsideCalibration = terminals.filter((t) => t.unresolved_items.includes(
  'COMPARATOR_CLAIM_OUTSIDE_CALIBRATION_PROVISION_EXAMPLES',
)).length;
const subtypeDivergence = terminals.filter((t) => t.unresolved_items.includes(
  'SUBTYPE_PARTITION_DIVERGES_FROM_CALIBRATION_PROPOSED_SUBTYPE',
)).length;

const REPLACEMENTS = [
  [/EMPLOYEE_MATTERS/g, 'INTERIM_OPERATING'],
  [/employee_matters/g, 'interim_operating'],
  [/employeeMatters/g, 'interimOperating'],
  [/EmployeeMatters/g, 'InterimOperating'],
  [/Employee Matters/g, 'Interim Operating'],
  [/Employee matters/g, 'Interim operating'],
  [/employee-matters/g, 'interim-operating'],
  [/N1 family #14/g, 'N1 family #21'],
  [/family #14/g, 'family #21'],
  [/EMPLOYEE_MATTERS_PROFILE_COUNT = 27/g, 'INTERIM_OPERATING_PROFILE_COUNT = 113'],
  [/EMPLOYEE_MATTERS_SUBTYPE_DIVERGENCE_PROFILE_COUNT = 16/g,
    `INTERIM_OPERATING_SUBTYPE_DIVERGENCE_PROFILE_COUNT = ${subtypeDivergence}`],
  [/EMPLOYEE_MATTERS_OUTSIDE_CALIBRATION_PROFILE_COUNT = 0/g,
    `INTERIM_OPERATING_OUTSIDE_CALIBRATION_PROFILE_COUNT = ${outsideCalibration}`],
  [/EMPLOYEE_MATTERS_REGISTERED_SUBTYPE_BUCKET_COUNT = 4/g,
    'INTERIM_OPERATING_REGISTERED_SUBTYPE_BUCKET_COUNT = 5'],
  [/EMPLOYEE_MATTERS_POPULATED_SUBTYPE_BUCKET_COUNT = 3/g,
    'INTERIM_OPERATING_POPULATED_SUBTYPE_BUCKET_COUNT = 1'],
  [/EMPLOYEE_MATTERS_PHASE2_AUTHORITY_ID =\n  '[^']+'/g,
    `INTERIM_OPERATING_PHASE2_AUTHORITY_ID =\n  '${PHASE2.interim_operating_authoring_phase2_authority_id}'`],
  [/EMPLOYEE_MATTERS_PHASE2_AUTHORITY_BYTES = \d+/g,
    `INTERIM_OPERATING_PHASE2_AUTHORITY_BYTES = ${260688}`],
  [/EMPLOYEE_MATTERS_PHASE2_AUTHORITY_SHA256 =\n  '[^']+'/g,
    `INTERIM_OPERATING_PHASE2_AUTHORITY_SHA256 =\n  '164a203a73b8748450d71a4a56f69618cd46756c98d72caa1c574ce2c78bb35c'`],
  [/familyemployeematters/g, 'familyinterimoperating'],
  [/Twenty-seven/g, 'One hundred thirteen'],
  [/twenty-seven/g, 'one hundred thirteen'],
  [/27-profile/g, '113-profile'],
  [/27 profile/g, '113 profile'],
  [/27 profiles/g, '113 profiles'],
  [/27_PROFILE/g, '113_PROFILE'],
  [/KEEP_ALL_27_PROPOSALS/g, 'KEEP_ALL_113_PROPOSALS'],
  [/BEN_27_PROFILE/g, 'BEN_113_PROFILE'],
  [/UNAPPROVED_27_PROFILE/g, 'UNAPPROVED_113_PROFILE'],
  [/REVIEW_ONLY_27_PROFILES/g, 'REVIEW_ONLY_113_PROFILES'],
  [/27_REVIEW_PROPOSALS/g, '113_REVIEW_PROPOSALS'],
  [/EMPLOYEE_MATTERS_27_PROFILE/g, 'INTERIM_OPERATING_113_PROFILE'],
  [/exactly 27/g, 'exactly 113'],
  [/The 27 profiles/g, 'The 113 profiles'],
  [/27 governed/g, '113 governed'],
  [/EMPLOYEE_COMPENSATION/g, 'RESTRICTIVE_COVENANT'],
  [/SERVICE_CREDIT/g, 'AFFIRMATIVE_COVENANT'],
  [/WELFARE_RELIEF/g, 'CONSENT_STANDARD'],
  [/RETIREMENT_PLAN_ACTION/g, 'THRESHOLD'],
  [/16 non-RESTRICTIVE_COVENANT/g, '0 non-RESTRICTIVE_COVENANT'],
  [/16 subtype divergence, 0 outside-calibration/g,
    `${subtypeDivergence} subtype divergence, ${outsideCalibration} outside-calibration`],
  [/16 subtype divergence/g, `${subtypeDivergence} subtype divergence`],
  [/0 outside-calibration/g, `${outsideCalibration} outside-calibration`],
  [/comp-item and welfare-relief limbs that differ/g,
    'interim operating restriction limbs that differ'],
  [/Concho section 6.9 carries six independently operative limbs/g,
    'Concho section 6.1 carries eighteen independently operative limbs'],
  [/EMPLOYEE_MATTERS_ASSERTIONS_GOVERNED_CONTINUATION_COVENANT_EVIDENCE_ONLY/g,
    'INTERIM_OPERATING_ASSERTIONS_GOVERNED_INTERIM_COVENANT_EVIDENCE_ONLY'],
  [/CALIBRATION_PACK_TAGS_ALL_SIX_EXAMPLES_EMPLOYEE_COMPENSATION/g,
    'CALIBRATION_PACK_TAGS_ALL_SIX_EXAMPLES_RESTRICTIVE_COVENANT'],
  [/three populated buckets/g, 'one populated bucket'],
  [/three populated subtype buckets/g, 'one populated subtype bucket'],
  [/three populated/g, 'one populated'],
  [/four subtype buckets/g, 'five subtype buckets'],
  [/three claim definition keys under all four subtype buckets/g,
    'one claim definition key under all five subtype buckets'],
  [/TopBuild section 3.1\(h\) benefit-plan accuracy rep stays link-only under Q02./,
    'General Covenants overlap stays classifier-resolved; dividend coordination covenant stays link-only under Dividends Q02.'],
  [/cross_family_link_only_boundaries\.map[\s\S]*?\),\s*\[\s*'REPRESENTATIONS'\s*\]/,
    `cross_family_link_only_boundaries.map(
      (entry) => entry.owner_family_key,
    ),
    []`],
  [/outside_calibration_example_flag_count: 0/g,
    `outside_calibration_example_flag_count: ${outsideCalibration}`],
  [/subtype_partition_divergence_flag_count: 16/g,
    `subtype_partition_divergence_flag_count: ${subtypeDivergence}`],
  [/subtype_partition_divergence_flag_count: 7/g,
    `subtype_partition_divergence_flag_count: ${subtypeDivergence}`],
  [/Ben approves the EMPLOYEE_MATTERS 27-profile/g,
    'Ben approves the INTERIM_OPERATING 113-profile'],
  [/EMPLOYEE_MATTERS 27-profile Work3/g, 'INTERIM_OPERATING 113-profile Work3'],
  [/TWENTY_SEVEN_GOVERNED_CLAIMS/g, 'ONE_HUNDRED_THIRTEEN_GOVERNED_CLAIMS'],
  [/THREE_SUBTYPE_BUCKETS/g, 'FIVE_SUBTYPE_BUCKETS'],
  [/exact_agreement_terminal_counts[\s\S]*?\{[\s\S]*?\[TOPBUILD_AGREEMENT_ID\]: 4,[\s\S]*?\}/,
    `authority.source_terminal_successor_contract.exact_agreement_terminal_counts,
    {
      [CONCHO_AGREEMENT_ID]: 18,
      [METSERA_AGREEMENT_ID]: 18,
      [REDHAT_AGREEMENT_ID]: 13,
      [SKECHERS_AGREEMENT_ID]: 19,
      [SKYWATER_AGREEMENT_ID]: 19,
      [TOPBUILD_AGREEMENT_ID]: 26,
    }`],
  [/populated_classification_buckets[\s\S]*?\[[\s\S]*?'RESTRICTIVE_COVENANT'[\s\S]*?\]/,
    `authority.source_terminal_successor_contract.populated_classification_buckets,
    [
      'RESTRICTIVE_COVENANT',
    ]`],
  [/CLASSIFICATION_BUCKETS = Object\.freeze\(\[[\s\S]*?\]\);/,
    `CLASSIFICATION_BUCKETS = Object.freeze([
  'RESTRICTIVE_COVENANT',
  'AFFIRMATIVE_COVENANT',
  'CONSENT_STANDARD',
  'THRESHOLD',
  'EXCEPTION',
]);`],
  [/docs\/codex-program\/notes\/EMPLOYEE-MATTERS-BEN-RULINGS-Q01-Q03-2026-08-24.md/g,
    'docs/codex-program/notes/INTERIM-OPERATING-BEN-RULINGS-Q01-Q03-2026-08-24.md'],
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
    'lib/canonical-v2/m7-v2-employee-matters-authoring.js',
    'lib/canonical-v2/m7-v2-interim-operating-authoring.js',
  ],
  [
    'scripts/stage-2y-structure-m7-v2-employee-matters-authoring-phase4-authority.mjs',
    'scripts/stage-2y-structure-m7-v2-interim-operating-authoring-phase4-authority.mjs',
  ],
  [
    'scripts/stage-2y-structure-m7-v2-employee-matters-inventory-review-packet.mjs',
    'scripts/stage-2y-structure-m7-v2-interim-operating-inventory-review-packet.mjs',
  ],
  [
    'scripts/stage-2y-structure-m7-v2-employee-matters-ben-inventory-disposition.mjs',
    'scripts/stage-2y-structure-m7-v2-interim-operating-ben-inventory-disposition.mjs',
  ],
  [
    'scripts/stage-2y-structure-m7-v2-employee-matters-family-profile-package.mjs',
    'scripts/stage-2y-structure-m7-v2-interim-operating-family-profile-package.mjs',
  ],
  [
    'tests/stage-2y-structure-m7-v2-repair-employee-matters-work3.test.js',
    'tests/stage-2y-structure-m7-v2-repair-interim-operating-work3.test.js',
  ],
];

for (const [src, dest] of pairs) {
  const content = transform(readFileSync(join(REPO_ROOT, src), 'utf8'));
  writeFileSync(join(REPO_ROOT, dest), content);
  console.log(`wrote ${dest}`);
}

console.log(JSON.stringify({
  profile_count: 113,
  outside_calibration: outsideCalibration,
  subtype_divergence: subtypeDivergence,
  phase2_id: PHASE2.interim_operating_authoring_phase2_authority_id,
}, null, 2));
