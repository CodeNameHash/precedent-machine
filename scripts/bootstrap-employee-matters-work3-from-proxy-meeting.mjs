#!/usr/bin/env node
/** Bootstrap EMPLOYEE_MATTERS family-local files from PROXY_MEETING templates. */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '..');

const PHASE2 = JSON.parse(readFileSync(join(
  REPO_ROOT,
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-employee-matters-authoring-phase2-authority-v2.json',
), 'utf8'));

const terminals = PHASE2.source_terminal_successor_contract.terminal_rule_registry;
const outsideCalibration = terminals.filter((t) => t.unresolved_items.includes(
  'COMPARATOR_CLAIM_OUTSIDE_CALIBRATION_PROVISION_EXAMPLES',
)).length;
const subtypeDivergence = terminals.filter((t) => t.unresolved_items.includes(
  'SUBTYPE_PARTITION_DIVERGES_FROM_CALIBRATION_PROPOSED_SUBTYPE',
)).length;

const REPLACEMENTS = [
  [/PROXY_MEETING/g, 'EMPLOYEE_MATTERS'],
  [/proxy_meeting/g, 'employee_matters'],
  [/proxyMeeting/g, 'employeeMatters'],
  [/ProxyMeeting/g, 'EmployeeMatters'],
  [/Proxy \/ Meeting/g, 'Employee Matters'],
  [/Proxy meeting/g, 'Employee meeting'],
  [/proxy-meeting/g, 'employee-matters'],
  [/Proxy meeting/g, 'Employee matters'],
  [/N1 family #12/g, 'N1 family #14'],
  [/family #12/g, 'family #14'],
  [/PROXY_MEETING_PROFILE_COUNT = 31/g, 'EMPLOYEE_MATTERS_PROFILE_COUNT = 27'],
  [/PROXY_MEETING_SUBTYPE_DIVERGENCE_PROFILE_COUNT = 27/g,
    `EMPLOYEE_MATTERS_SUBTYPE_DIVERGENCE_PROFILE_COUNT = ${subtypeDivergence}`],
  [/PROXY_MEETING_OUTSIDE_CALIBRATION_PROFILE_COUNT = 2/g,
    `EMPLOYEE_MATTERS_OUTSIDE_CALIBRATION_PROFILE_COUNT = ${outsideCalibration}`],
  [/PROXY_MEETING_REGISTERED_SUBTYPE_BUCKET_COUNT = 6/g,
    'EMPLOYEE_MATTERS_REGISTERED_SUBTYPE_BUCKET_COUNT = 4'],
  [/PROXY_MEETING_POPULATED_SUBTYPE_BUCKET_COUNT = 5/g,
    'EMPLOYEE_MATTERS_POPULATED_SUBTYPE_BUCKET_COUNT = 3'],
  [/PROXY_MEETING_PHASE2_AUTHORITY_ID =\n  '[^']+'/g,
    `EMPLOYEE_MATTERS_PHASE2_AUTHORITY_ID =\n  '${PHASE2.employee_matters_authoring_phase2_authority_id}'`],
  [/PROXY_MEETING_PHASE2_AUTHORITY_BYTES = \d+/g,
    `EMPLOYEE_MATTERS_PHASE2_AUTHORITY_BYTES = ${87436}`],
  [/PROXY_MEETING_PHASE2_AUTHORITY_SHA256 =\n  '[^']+'/g,
    `EMPLOYEE_MATTERS_PHASE2_AUTHORITY_SHA256 =\n  '2f6fde70d059f89bccbf90782bcdd2670faa0012d27aa4946649f1e68783d470'`],
  [/familyproxymeeting/g, 'familyemployeematters'],
  [/six comparator deals \(Concho, Metsera, Modiv, Red Hat, SkyWater, TopBuild\)/g,
    'six comparator deals (Concho, Metsera, Red Hat, Skechers, Skywater, TopBuild)'],
  [/Modiv, Red Hat, SkyWater/g, 'Red Hat, Skechers, Skywater'],
  [/Modiv, Red Hat/g, 'Metsera, Red Hat'],
  [/KEEP_ALL_31_PROPOSALS/g, 'KEEP_ALL_27_PROPOSALS'],
  [/BEN_31_PROFILE/g, 'BEN_27_PROFILE'],
  [/UNAPPROVED_31_PROFILE/g, 'UNAPPROVED_27_PROFILE'],
  [/REVIEW_ONLY_31_PROFILES/g, 'REVIEW_ONLY_27_PROFILES'],
  [/31_REVIEW_PROPOSALS/g, '27_REVIEW_PROPOSALS'],
  [/PROXY_MEETING_31_PROFILE/g, 'EMPLOYEE_MATTERS_27_PROFILE'],
  [/31-profile/g, '27-profile'],
  [/31 profile/g, '27 profile'],
  [/31 profiles/g, '27 profiles'],
  [/31_PROFILE/g, '27_PROFILE'],
  [/Thirty-one/g, 'Twenty-seven'],
  [/thirty-one/g, 'twenty-seven'],
  [/exactly 31/g, 'exactly 27'],
  [/exactly thirty-one/g, 'exactly twenty-seven'],
  [/The 31 profiles/g, 'The 27 profiles'],
  [/31 governed/g, '27 governed'],
  [/31-profile Work3/g, '27-profile Work3'],
  [/DOCUMENT_FILING/g, 'EMPLOYEE_COMPENSATION'],
  [/MEETING_CALL_OR_HOLD/g, 'SERVICE_CREDIT'],
  [/RECORD_DATE_OR_BROKER_SEARCH/g, 'WELFARE_RELIEF'],
  [/RECOMMENDATION_INCLUSION/g, 'RETIREMENT_PLAN_ACTION'],
  [/ADJOURNMENT/g, 'RETIREMENT_PLAN_ACTION'],
  [/SUBSIDIARY_APPROVAL/g, 'RETIREMENT_PLAN_ACTION'],
  [/29 non-DOCUMENT_FILING/g, '16 non-EMPLOYEE_COMPENSATION'],
  [/27 calibration divergence, 2 outside-calibration/g,
    '16 subtype divergence, 0 outside-calibration'],
  [/27 calibration divergence/g, '16 subtype divergence'],
  [/2 outside-calibration/g, '0 outside-calibration'],
  [/meeting-covenant claims that differ/g,
    'comp-item and welfare-relief limbs that differ'],
  [/TopBuild s4\.5 carries two meeting-covenant claims/g,
    'Concho section 6.9 carries six independently operative limbs'],
  [/PROXY_MEETING_ASSERTIONS_GOVERNED_MEETING_COVENANT_EVIDENCE_ONLY/g,
    'EMPLOYEE_MATTERS_ASSERTIONS_GOVERNED_CONTINUATION_COVENANT_EVIDENCE_ONLY'],
  [/CALIBRATION_PACK_TAGS_ALL_SIX_EXAMPLES_DOCUMENT_FILING/g,
    'CALIBRATION_PACK_TAGS_ALL_SIX_EXAMPLES_EMPLOYEE_COMPENSATION'],
  [/five populated buckets/g, 'three populated buckets'],
  [/five populated subtype buckets/g, 'three populated subtype buckets'],
  [/five populated/g, 'three populated'],
  [/six subtype buckets/g, 'four subtype buckets'],
  [/seven claim definition keys under all six subtype buckets/g,
    'three claim definition keys under all four subtype buckets'],
  [/SKYWATER_AGREEMENT_ID[\s\S]*?CLASSIFICATION_BUCKETS = Object\.freeze\(\[[\s\S]*?\]\);/,
    `const REDHAT_AGREEMENT_ID =
  '06ec301641939fe0ac6e6ba598a33b40f16b1acc3ffb29109c7227b14bf1025a';
const METSERA_AGREEMENT_ID =
  'f783c4cdcaca4626c695d1c2c67924ccd8867eb066e16f17407ca64497ba778c';
const SKYWATER_AGREEMENT_ID =
  'b74ed1f02f2e1385121b187cb0bb6dd8144ff18449149b6cf20182eede0eb363';

const CLASSIFICATION_BUCKETS = Object.freeze([
  'EMPLOYEE_COMPENSATION',
  'SERVICE_CREDIT',
  'WELFARE_RELIEF',
  'RETIREMENT_PLAN_ACTION',
]);`],
  [/exact_agreement_terminal_counts[\s\S]*?\{[\s\S]*?\[SKYWATER_AGREEMENT_ID\]: 2,[\s\S]*?\[TOPBUILD_AGREEMENT_ID\]: 5,[\s\S]*?\}/,
    `authority.source_terminal_successor_contract.exact_agreement_terminal_counts,
    {
      [CONCHO_AGREEMENT_ID]: 6,
      [METSERA_AGREEMENT_ID]: 5,
      [REDHAT_AGREEMENT_ID]: 3,
      [SKECHERS_AGREEMENT_ID]: 5,
      [SKYWATER_AGREEMENT_ID]: 4,
      [TOPBUILD_AGREEMENT_ID]: 4,
    }`],
  [/populated_classification_buckets[\s\S]*?\[[\s\S]*?'DOCUMENT_FILING'[\s\S]*?\]/,
    `authority.source_terminal_successor_contract.populated_classification_buckets,
    [
      'EMPLOYEE_COMPENSATION',
      'SERVICE_CREDIT',
      'WELFARE_RELIEF',
    ]`],
  [/cross_family_link_only_boundaries\.map[\s\S]*?\),\s*\[\s*'CLOSING_CONDITIONS'\s*\]/,
    `authority.policy_overlay.cross_family_link_only_boundaries.map(
      (entry) => entry.owner_family_key,
    ),
    ['REPRESENTATIONS']`],
  [/CC tax-opinion receipt-only closing conditions stay link-only under Q02\./,
    'TopBuild section 3.1(h) benefit-plan accuracy rep stays link-only under Q02.'],
  [/subtype_partition_divergence_flag_count: 27/g,
    `subtype_partition_divergence_flag_count: ${subtypeDivergence}`],
  [/subtype_partition_divergence_flag_count: 7/g,
    `subtype_partition_divergence_flag_count: ${subtypeDivergence}`],
  [/outside_calibration_example_flag_count: 2/g,
    `outside_calibration_example_flag_count: ${outsideCalibration}`],
  [/outside_calibration_example_count:\s*\n\s*proxyMeetingAuthoring\.PROXY_MEETING_OUTSIDE_CALIBRATION_PROFILE_COUNT/g,
    'outside_calibration_example_count:\n      employeeMattersAuthoring.EMPLOYEE_MATTERS_OUTSIDE_CALIBRATION_PROFILE_COUNT'],
  [/subtype_partition_divergence_count:\s*\n\s*proxyMeetingAuthoring\.PROXY_MEETING_SUBTYPE_DIVERGENCE_PROFILE_COUNT/g,
    'subtype_partition_divergence_count:\n      employeeMattersAuthoring.EMPLOYEE_MATTERS_SUBTYPE_DIVERGENCE_PROFILE_COUNT'],
  [/Ben approves the PROXY_MEETING 31-profile/g,
    'Ben approves the EMPLOYEE_MATTERS 27-profile'],
  [/PROXY_MEETING 31-profile Work3/g, 'EMPLOYEE_MATTERS 27-profile Work3'],
  [/comparator_deal_count: 6/g, 'comparator_deal_count: 6'],
  [/comparator_deal_count: 4/g, 'comparator_deal_count: 6'],
  [/immutable_parent_bindings\.m2_m3_m4\.length, 6/g,
    'immutable_parent_bindings.m2_m3_m4.length, 6'],
  [/immutable_parent_bindings\.m2_m3_m4\.length, 4/g,
    'immutable_parent_bindings.m2_m3_m4.length, 6'],
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
    'lib/canonical-v2/m7-v2-proxy-meeting-authoring.js',
    'lib/canonical-v2/m7-v2-employee-matters-authoring.js',
  ],
  [
    'scripts/stage-2y-structure-m7-v2-proxy-meeting-authoring-phase4-authority.mjs',
    'scripts/stage-2y-structure-m7-v2-employee-matters-authoring-phase4-authority.mjs',
  ],
  [
    'scripts/stage-2y-structure-m7-v2-proxy-meeting-inventory-review-packet.mjs',
    'scripts/stage-2y-structure-m7-v2-employee-matters-inventory-review-packet.mjs',
  ],
  [
    'scripts/stage-2y-structure-m7-v2-proxy-meeting-ben-inventory-disposition.mjs',
    'scripts/stage-2y-structure-m7-v2-employee-matters-ben-inventory-disposition.mjs',
  ],
  [
    'scripts/stage-2y-structure-m7-v2-proxy-meeting-family-profile-package.mjs',
    'scripts/stage-2y-structure-m7-v2-employee-matters-family-profile-package.mjs',
  ],
  [
    'tests/stage-2y-structure-m7-v2-repair-proxy-meeting-work3.test.js',
    'tests/stage-2y-structure-m7-v2-repair-employee-matters-work3.test.js',
  ],
];

for (const [src, dest] of pairs) {
  const content = transform(readFileSync(join(REPO_ROOT, src), 'utf8'));
  writeFileSync(join(REPO_ROOT, dest), content);
  console.log(`wrote ${dest}`);
}

console.log(JSON.stringify({
  profile_count: 27,
  outside_calibration: outsideCalibration,
  subtype_divergence: subtypeDivergence,
  phase2_id: PHASE2.employee_matters_authoring_phase2_authority_id,
}, null, 2));
