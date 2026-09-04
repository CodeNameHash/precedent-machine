#!/usr/bin/env node
/** Bootstrap MATERIAL_CONTRACTS family-local files from EMPLOYEE_MATTERS templates. */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '..');

const PHASE2 = JSON.parse(readFileSync(join(
  REPO_ROOT,
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-material-contracts-authoring-phase2-authority-v2.json',
), 'utf8'));

const terminals = PHASE2.source_terminal_successor_contract.terminal_rule_registry;
const outsideCalibration = terminals.filter((t) => t.unresolved_items.includes(
  'COMPARATOR_CLAIM_OUTSIDE_CALIBRATION_PROVISION_EXAMPLES',
)).length;
const subtypeDivergence = terminals.filter((t) => t.unresolved_items.includes(
  'SUBTYPE_PARTITION_DIVERGES_FROM_CALIBRATION_PROPOSED_SUBTYPE',
)).length;

const REPLACEMENTS = [
  [/EMPLOYEE_MATTERS/g, 'MATERIAL_CONTRACTS'],
  [/employee_matters/g, 'material_contracts'],
  [/employeeMatters/g, 'materialContracts'],
  [/EmployeeMatters/g, 'MaterialContracts'],
  [/Employee Matters/g, 'Material Contracts'],
  [/Employee matters/g, 'Material contracts'],
  [/employee-matters/g, 'material-contracts'],
  [/N1 family #14/g, 'N1 family #22'],
  [/family #14/g, 'family #22'],
  [/EMPLOYEE_MATTERS_PROFILE_COUNT = 27/g, 'MATERIAL_CONTRACTS_PROFILE_COUNT = 116'],
  [/EMPLOYEE_MATTERS_SUBTYPE_DIVERGENCE_PROFILE_COUNT = 16/g,
    `MATERIAL_CONTRACTS_SUBTYPE_DIVERGENCE_PROFILE_COUNT = ${subtypeDivergence}`],
  [/EMPLOYEE_MATTERS_OUTSIDE_CALIBRATION_PROFILE_COUNT = 0/g,
    `MATERIAL_CONTRACTS_OUTSIDE_CALIBRATION_PROFILE_COUNT = ${outsideCalibration}`],
  [/EMPLOYEE_MATTERS_REGISTERED_SUBTYPE_BUCKET_COUNT = 4/g,
    'MATERIAL_CONTRACTS_REGISTERED_SUBTYPE_BUCKET_COUNT = 4'],
  [/EMPLOYEE_MATTERS_POPULATED_SUBTYPE_BUCKET_COUNT = 3/g,
    'MATERIAL_CONTRACTS_POPULATED_SUBTYPE_BUCKET_COUNT = 1'],
  [/EMPLOYEE_MATTERS_PHASE2_AUTHORITY_ID =\n  '[^']+'/g,
    `MATERIAL_CONTRACTS_PHASE2_AUTHORITY_ID =\n  '${PHASE2.material_contracts_authoring_phase2_authority_id}'`],
  [/EMPLOYEE_MATTERS_PHASE2_AUTHORITY_BYTES = \d+/g,
    `MATERIAL_CONTRACTS_PHASE2_AUTHORITY_BYTES = ${282745}`],
  [/EMPLOYEE_MATTERS_PHASE2_AUTHORITY_SHA256 =\n  '[^']+'/g,
    `MATERIAL_CONTRACTS_PHASE2_AUTHORITY_SHA256 =\n  'f41f137e0c9d2dd6a156318fa547bee42c4264919585b6b0dc57b8ecb3a950f7'`],
  [/familyemployeematters/g, 'familymaterialcontracts'],
  [/six comparator deals \(Concho, Metsera, Red Hat, Skechers, Skywater, TopBuild\)/g,
    'six comparator deals (Concho, Metsera, Modiv, Red Hat, Skywater, TopBuild)'],
  [/Red Hat, Skechers, Skywater/g, 'Modiv, Red Hat, Skywater'],
  [/Metsera, Red Hat/g, 'Metsera, Modiv, Red Hat'],
  [/KEEP_ALL_27_PROPOSALS/g, 'KEEP_ALL_116_PROPOSALS'],
  [/BEN_27_PROFILE/g, 'BEN_116_PROFILE'],
  [/UNAPPROVED_27_PROFILE/g, 'UNAPPROVED_116_PROFILE'],
  [/REVIEW_ONLY_27_PROFILES/g, 'REVIEW_ONLY_116_PROFILES'],
  [/27_REVIEW_PROPOSALS/g, '116_REVIEW_PROPOSALS'],
  [/EMPLOYEE_MATTERS_27_PROFILE/g, 'MATERIAL_CONTRACTS_116_PROFILE'],
  [/27-profile/g, '116-profile'],
  [/27 profile/g, '116 profile'],
  [/27 profiles/g, '116 profiles'],
  [/27_PROFILE/g, '116_PROFILE'],
  [/Twenty-seven/g, 'One hundred sixteen'],
  [/twenty-seven/g, 'one hundred sixteen'],
  [/exactly 27/g, 'exactly 116'],
  [/exactly twenty-seven/g, 'exactly one hundred sixteen'],
  [/The 27 profiles/g, 'The 116 profiles'],
  [/27 governed/g, '116 governed'],
  [/27-profile Work3/g, '116-profile Work3'],
  [/EMPLOYEE_COMPENSATION/g, 'MATERIAL_CONTRACT_CATEGORY_CRITERION'],
  [/SERVICE_CREDIT/g, 'MATERIAL_CONTRACT_DISCLOSURE_LIST'],
  [/WELFARE_RELIEF/g, 'MATERIAL_CONTRACT_STATUS_REPRESENTATION'],
  [/RETIREMENT_PLAN_ACTION/g, 'MATERIAL_CONTRACT_BREACH_TERMINATION_RIGHT'],
  [/16 non-EMPLOYEE_COMPENSATION/g, '0 non-MATERIAL_CONTRACT_CATEGORY_CRITERION'],
  [/16 subtype divergence, 0 outside-calibration/g,
    `${subtypeDivergence} subtype divergence, ${outsideCalibration} outside-calibration`],
  [/16 subtype divergence/g, `${subtypeDivergence} subtype divergence`],
  [/comp-item and welfare-relief limbs/g,
    'bucket-present and threshold-structure limbs'],
  [/Concho section 6\.9 carries six independently operative limbs/g,
    'Metsera section 3.13 carries thirty-two independently operative limbs'],
  [/EMPLOYEE_MATTERS_ASSERTIONS_GOVERNED_CONTINUATION_COVENANT_EVIDENCE_ONLY/g,
    'MATERIAL_CONTRACTS_ASSERTIONS_GOVERNED_DISCLOSURE_AND_THRESHOLD_COVENANTS_EVIDENCE_ONLY'],
  [/CALIBRATION_PACK_TAGS_ALL_SIX_EXAMPLES_EMPLOYEE_COMPENSATION/g,
    'CALIBRATION_PACK_TAGS_ALL_SIX_EXAMPLES_MATERIAL_CONTRACT_CATEGORY_CRITERION'],
  [/three populated buckets/g, 'one populated bucket'],
  [/three populated subtype buckets/g, 'one populated subtype bucket'],
  [/three populated/g, 'one populated'],
  [/three claim definition keys under all four subtype buckets/g,
    'two claim definition keys under all four subtype buckets'],
  [/TopBuild section 3\.1\(h\) benefit-plan accuracy rep stays link-only under Q02\./,
    'Representations status reps and Termination breach-termination-right subtypes stay link-only under Q02.'],
  [/subtype_partition_divergence_flag_count: 16/g,
    `subtype_partition_divergence_flag_count: ${subtypeDivergence}`],
  [/subtype_partition_divergence_flag_count: 7/g,
    `subtype_partition_divergence_flag_count: ${subtypeDivergence}`],
  [/outside_calibration_example_flag_count: 0/g,
    `outside_calibration_example_flag_count: ${outsideCalibration}`],
  [/outside_calibration_example_count:\s*\n\s*employeeMattersAuthoring\.EMPLOYEE_MATTERS_OUTSIDE_CALIBRATION_PROFILE_COUNT/g,
    'outside_calibration_example_count:\n      materialContractsAuthoring.MATERIAL_CONTRACTS_OUTSIDE_CALIBRATION_PROFILE_COUNT'],
  [/subtype_partition_divergence_count:\s*\n\s*employeeMattersAuthoring\.EMPLOYEE_MATTERS_SUBTYPE_DIVERGENCE_PROFILE_COUNT/g,
    'subtype_partition_divergence_count:\n      materialContractsAuthoring.MATERIAL_CONTRACTS_SUBTYPE_DIVERGENCE_PROFILE_COUNT'],
  [/Ben approves the EMPLOYEE_MATTERS 27-profile/g,
    'Ben approves the MATERIAL_CONTRACTS 116-profile'],
  [/EMPLOYEE_MATTERS 27-profile Work3/g, 'MATERIAL_CONTRACTS 116-profile Work3'],
  [/SKECHERS_AGREEMENT_ID[\s\S]*?CLASSIFICATION_BUCKETS = Object\.freeze\(\[[\s\S]*?\]\);/,
    `const MODIV_AGREEMENT_ID =
  'fb76ef57355bef7f05b3b8955f5f7da4f430964923fecce0c95156c6e0b04a5c';
const METSERA_AGREEMENT_ID =
  'f783c4cdcaca4626c695d1c2c67924ccd8867eb066e16f17407ca64497ba778c';
const SKYWATER_AGREEMENT_ID =
  'b74ed1f02f2e1385121b187cb0bb6dd8144ff18449149b6cf20182eede0eb363';

const CLASSIFICATION_BUCKETS = Object.freeze([
  'MATERIAL_CONTRACT_CATEGORY_CRITERION',
  'MATERIAL_CONTRACT_DISCLOSURE_LIST',
  'MATERIAL_CONTRACT_STATUS_REPRESENTATION',
  'MATERIAL_CONTRACT_BREACH_TERMINATION_RIGHT',
]);`],
  [/exact_agreement_terminal_counts[\s\S]*?\{[\s\S]*?\[SKECHERS_AGREEMENT_ID\]: 5,[\s\S]*?\[TOPBUILD_AGREEMENT_ID\]: 4,[\s\S]*?\}/,
    `authority.source_terminal_successor_contract.exact_agreement_terminal_counts,
    {
      [CONCHO_AGREEMENT_ID]: 16,
      [METSERA_AGREEMENT_ID]: 32,
      [MODIV_AGREEMENT_ID]: 20,
      [REDHAT_AGREEMENT_ID]: 6,
      [SKYWATER_AGREEMENT_ID]: 22,
      [TOPBUILD_AGREEMENT_ID]: 20,
    }`],
  [/populated_classification_buckets[\s\S]*?\[[\s\S]*?'EMPLOYEE_COMPENSATION'[\s\S]*?\]/,
    `authority.source_terminal_successor_contract.populated_classification_buckets,
    [
      'MATERIAL_CONTRACT_CATEGORY_CRITERION',
    ]`],
  [/cross_family_link_only_boundaries\.map[\s\S]*?\),\s*\[\s*'REPRESENTATIONS'\s*\]/,
    `authority.policy_overlay.cross_family_link_only_boundaries.map(
      (entry) => entry.owner_family_key,
    ),
    ['REPRESENTATIONS', 'TERMINATION']`],
  [/prepareTaxMattersPhase2FamilyProposal/g, 'prepareMaterialContractsPhase2FamilyProposal'],
  [/taxMattersAuthoringPhase2Authority/g, 'materialContractsAuthoringPhase2Authority'],
  [/TWENTY_SEVEN_GOVERNED_CLAIMS/g, 'ONE_HUNDRED_SIXTEEN_GOVERNED_CLAIMS'],
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
    'lib/canonical-v2/m7-v2-material-contracts-authoring.js',
  ],
  [
    'scripts/stage-2y-structure-m7-v2-employee-matters-authoring-phase4-authority.mjs',
    'scripts/stage-2y-structure-m7-v2-material-contracts-authoring-phase4-authority.mjs',
  ],
  [
    'scripts/stage-2y-structure-m7-v2-employee-matters-inventory-review-packet.mjs',
    'scripts/stage-2y-structure-m7-v2-material-contracts-inventory-review-packet.mjs',
  ],
  [
    'scripts/stage-2y-structure-m7-v2-employee-matters-ben-inventory-disposition.mjs',
    'scripts/stage-2y-structure-m7-v2-material-contracts-ben-inventory-disposition.mjs',
  ],
  [
    'scripts/stage-2y-structure-m7-v2-employee-matters-family-profile-package.mjs',
    'scripts/stage-2y-structure-m7-v2-material-contracts-family-profile-package.mjs',
  ],
  [
    'tests/stage-2y-structure-m7-v2-repair-employee-matters-work3.test.js',
    'tests/stage-2y-structure-m7-v2-repair-material-contracts-work3.test.js',
  ],
];

for (const [src, dest] of pairs) {
  const content = transform(readFileSync(join(REPO_ROOT, src), 'utf8'));
  writeFileSync(join(REPO_ROOT, dest), content);
  console.log(`wrote ${dest}`);
}

console.log(JSON.stringify({
  profile_count: 116,
  outside_calibration: outsideCalibration,
  subtype_divergence: subtypeDivergence,
  phase2_id: PHASE2.material_contracts_authoring_phase2_authority_id,
}, null, 2));
