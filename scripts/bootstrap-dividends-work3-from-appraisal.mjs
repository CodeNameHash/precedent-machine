#!/usr/bin/env node
/** Bootstrap DIVIDENDS family-local files from APPRAISAL_DISSENTERS_RIGHTS templates. */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import canonicalModule from '../lib/canonical-v2/canonical-bytes.js';

const { sha256Hex } = canonicalModule;
const REPO_ROOT = join(import.meta.dirname, '..');

const PHASE2_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-dividends-authoring-phase2-authority-v2.json';

function readPhase2() {
  try {
    const phase2Bytes = readFileSync(join(REPO_ROOT, PHASE2_PATH));
    return { bytes: phase2Bytes, record: JSON.parse(phase2Bytes.toString('utf8')) };
  } catch {
    return { bytes: null, record: null };
  }
}

const { bytes: phase2Bytes, record: PHASE2 } = readPhase2();

const terminals = PHASE2?.source_terminal_successor_contract?.terminal_rule_registry ?? [];
const outsideCalibration = terminals.filter((t) => t.unresolved_items.includes(
  'COMPARATOR_CLAIM_OUTSIDE_CALIBRATION_PROVISION_EXAMPLES',
)).length;
const subtypeDivergence = terminals.filter((t) => t.unresolved_items.includes(
  'SUBTYPE_PARTITION_DIVERGES_FROM_CALIBRATION_PROPOSED_SUBTYPE',
)).length;

const REPLACEMENTS = [
  [/APPRAISAL_DISSENTERS_RIGHTS/g, 'DIVIDENDS'],
  [/appraisal_dissenters_rights/g, 'dividends'],
  [/appraisalDissentersRights/g, 'dividends'],
  [/AppraisalDissentersRights/g, 'Dividends'],
  [/Appraisal \/ dissenters-rights/g, 'Dividends'],
  [/Appraisal dissenters-rights/g, 'Dividends'],
  [/appraisal-dissenters-rights/g, 'dividends'],
  [/Appraisal \/ dissenters' rights/g, 'Dividends'],
  [/N1 family #17/g, 'N1 family #19'],
  [/family #17/g, 'family #19'],
  [/APPRAISAL_DISSENTERS_RIGHTS_PROFILE_COUNT = 5/g,
    'DIVIDENDS_PROFILE_COUNT = 1'],
  [/DIVIDENDS_PROFILE_COUNT = 5/g,
    'DIVIDENDS_PROFILE_COUNT = 1'],
  [/APPRAISAL_DISSENTERS_RIGHTS_SUBTYPE_DIVERGENCE_PROFILE_COUNT = 5/g,
    `DIVIDENDS_SUBTYPE_DIVERGENCE_PROFILE_COUNT = ${subtypeDivergence}`],
  [/APPRAISAL_DISSENTERS_RIGHTS_OUTSIDE_CALIBRATION_PROFILE_COUNT = 0/g,
    `DIVIDENDS_OUTSIDE_CALIBRATION_PROFILE_COUNT = ${outsideCalibration}`],
  [/APPRAISAL_DISSENTERS_RIGHTS_REGISTERED_SUBTYPE_BUCKET_COUNT = 6/g,
    'DIVIDENDS_REGISTERED_SUBTYPE_BUCKET_COUNT = 5'],
  [/APPRAISAL_DISSENTERS_RIGHTS_POPULATED_SUBTYPE_BUCKET_COUNT = 2/g,
    'DIVIDENDS_POPULATED_SUBTYPE_BUCKET_COUNT = 1'],
  ...(PHASE2 ? [
    [/APPRAISAL_DISSENTERS_RIGHTS_PHASE2_AUTHORITY_ID =\n  '[^']+'/g,
      `DIVIDENDS_PHASE2_AUTHORITY_ID =\n  '${PHASE2.dividends_authoring_phase2_authority_id}'`],
    [/APPRAISAL_DISSENTERS_RIGHTS_PHASE2_AUTHORITY_BYTES = \d+/g,
      `DIVIDENDS_PHASE2_AUTHORITY_BYTES = ${phase2Bytes.length}`],
    [/APPRAISAL_DISSENTERS_RIGHTS_PHASE2_AUTHORITY_SHA256 =\n  '[^']+'/g,
      `DIVIDENDS_PHASE2_AUTHORITY_SHA256 =\n  '${sha256Hex(phase2Bytes)}'`],
  ] : []),
  [/familyappraisaldissentersrights/g, 'familydividends'],
  [/three comparator deals \(Skechers, Skywater, TopBuild\)/g,
    'one comparator deal (Concho)'],
  [/Skechers, Skywater, TopBuild/g, 'Concho'],
  [/three comparator deals/g, 'one comparator deal'],
  [/comparator_deal_count: 3/g, 'comparator_deal_count: 1'],
  [/Comparator deals \| 3/g, 'Comparator deals | 1'],
  [/SKECHERS_AGREEMENT_ID[\s\S]*?TOPBUILD_AGREEMENT_ID =\n  '3888fa7618bbd9fd6530b657aaa18c7e85ff515acf80edb1fc78a190af86e9cb';/g,
    `CONCHO_AGREEMENT_ID =
  '1d6bba9ac993f72340d048742f995eb515a50cdfadb9bc86b3f36847baed9116';`],
  [/APPRAISAL_ASSERTIONS_GOVERNED_WITHDRAWAL_RECONVERSION_AND_SETTLEMENT_CONSENT_CONSIDERATION_Q02_LINK_ONLY/g,
    'DIVIDENDS_ASSERTIONS_GOVERNED_DIVIDEND_COORDINATION_COVENANT_ONLY'],
  [/CALIBRATION_PACK_TAGS_ALL_THREE_EXAMPLES_APPRAISAL_STATUS/g,
    'CALIBRATION_PACK_TAGS_ALL_FIVE_EXAMPLES_DIVIDEND_COORDINATION'],
  [/withdrawal-reconversion and settlement-consent/g, 'dividend-coordination covenant'],
  [/APPRAISAL_STATUS/g, 'DIVIDEND_COORDINATION'],
  [/APPRAISAL_ENTITLEMENT/g, 'PERMITTED_PRE_CLOSING_DISTRIBUTION'],
  [/WITHDRAWAL_RECONVERSION/g, 'UNPAID_DECLARED_DISTRIBUTION'],
  [/APPRAISAL_NOTICE/g, 'CONSIDERATION_ADJUSTMENT_LINK'],
  [/NEGOTIATION_CONTROL/g, 'INTERIM_RESTRICTION_LINK'],
  [/SETTLEMENT_CONSENT/g, 'DIVIDEND_COORDINATION'],
  [/APPRAISAL_WITHDRAWAL_RECONVERSION/g, 'DIVIDEND_COORDINATION_COVENANT'],
  [/APPRAISAL_SETTLEMENT_CONSENT/g, 'DIVIDEND_COORDINATION_COVENANT'],
  [/owner_family_key: 'CONSIDERATION'/g,
    "owner_family_key: 'CONSIDERATION'"],
  [/cross_family_link_only_boundaries\.map\(\n      \(entry\) => entry\.owner_family_key,\n    \),\n    \['CONSIDERATION', 'CONSIDERATION'\],/g,
    'cross_family_link_only_boundaries.length, 0'],
  [/sparse wave-4 appraisal settlement cluster/g, 'sparse wave-4 dividend coordination cluster'],
  [/Five governed M4 claims across three comparator deals/g,
    'One governed M4 claim on the Concho comparator deal'],
  [/five profiles/g, 'one profile'],
  [/Five profiles/g, 'One profile'],
  [/five-profile/g, '1-profile'],
  [/5-profile/g, '1-profile'],
  [/5 profile/g, '1 profile'],
  [/5 profiles/g, '1 profile'],
  [/5_PROFILE/g, '1_PROFILE'],
  [/Five/g, 'One'],
  [/five/g, 'one'],
  [/exactly 5/g, 'exactly 1'],
  [/exactly five/g, 'exactly one'],
  [/The 5 profiles/g, 'The 1 profile'],
  [/5 governed/g, '1 governed'],
  [/5-profile Work3/g, '1-profile Work3'],
  [/KEEP_ALL_5_PROPOSALS/g, 'KEEP_ALL_1_PROPOSALS'],
  [/BEN_5_PROFILE/g, 'BEN_1_PROFILE'],
  [/UNAPPROVED_5_PROFILE/g, 'UNAPPROVED_1_PROFILE'],
  [/REVIEW_ONLY_5_PROFILES/g, 'REVIEW_ONLY_1_PROFILES'],
  [/5_REVIEW_PROPOSALS/g, '1_REVIEW_PROPOSALS'],
  [/APPRAISAL_DISSENTERS_RIGHTS_5_PROFILE/g, 'DIVIDENDS_1_PROFILE'],
  [/subtype_partition_divergence_flag_count: 5/g,
    `subtype_partition_divergence_flag_count: ${subtypeDivergence}`],
  [/legal_grouping_review_flag_count: 5/g,
    'legal_grouping_review_flag_count: 1'],
  [/complete_profile_count: 5/g, 'complete_profile_count: 1'],
  [/incomplete_profile_count: 0/g, 'incomplete_profile_count: 0'],
  [/proposed_profile_count: 5/g, 'proposed_profile_count: 1'],
  [/review_only_profile_count: 5/g, 'review_only_profile_count: 1'],
  [/outside_calibration_example_flag_count: 0/g,
    `outside_calibration_example_flag_count: ${outsideCalibration}`],
  [/outside_calibration_example_count: 0/g,
    `outside_calibration_example_count: ${outsideCalibration}`],
  [/populated_subtype_bucket_count: 2/g,
    'populated_subtype_bucket_count: 1'],
  [/registered_subtype_bucket_count: 6/g,
    'registered_subtype_bucket_count: 5'],
  [/legal_grouping_review_pending_count: 5/g,
    'legal_grouping_review_pending_count: 1'],
  [/subtype_partition_divergence_count: 5/g,
    `subtype_partition_divergence_count: ${subtypeDivergence}`],
  [/item\.review_flags\.includes\(FLAGS\.SUBTYPE_DIVERGENCE\),\n    \)\.length,\n    5,/g,
    `item.review_flags.includes(FLAGS.SUBTYPE_DIVERGENCE),\n    ).length,\n    ${subtypeDivergence},`],
  [/result\.review_accounting\.subtype_partition_divergence_flag_count, 5\)/g,
    `result.review_accounting.subtype_partition_divergence_flag_count, ${subtypeDivergence})`],
  [/result\.legal_grouping_disposition_binding\.subtype_partition_divergence_count,\n    5,/g,
    `result.legal_grouping_disposition_binding.subtype_partition_divergence_count,\n    ${subtypeDivergence},`],
  [/assert\.deepEqual\(\n    packageRecord\.profiles\.map\(\(profile\) => profile\.classification_path\[1\]\)\.sort\(\),\n    \['SETTLEMENT_CONSENT', 'SETTLEMENT_CONSENT', 'WITHDRAWAL_RECONVERSION', 'WITHDRAWAL_RECONVERSION', 'WITHDRAWAL_RECONVERSION'\],/g,
    `assert.deepEqual(\n    packageRecord.profiles.map((profile) => profile.classification_path[1]).sort(),\n    ['DIVIDEND_COORDINATION'],`],
  [/const skechersSignatures = result\.proposed_partition\.proposed_profiles[\s\S]*?assert\.equal\(Object\.isFrozen\(result\), true\);/g,
    'assert.equal(Object.isFrozen(result), true);'],
  [/authority\.immutable_parent_bindings\.m2_m3_m4\.length, 3/g,
    'authority.immutable_parent_bindings.m2_m3_m4.length, 1'],
  [/populated_classification_buckets',\n    \['SETTLEMENT_CONSENT', 'WITHDRAWAL_RECONVERSION'\],/g,
    "populated_classification_buckets',\n    ['DIVIDEND_COORDINATION'],"],
  [/cross_family_link_only_boundaries\.map\(\n      \(entry\) => entry\.owner_family_key,\n    \),\n    \['CONSIDERATION', 'CONSIDERATION'\],/g,
    'cross_family_link_only_boundaries.length, 0'],
  [/Ben approves the DIVIDENDS five-profile Work3 package inventory/g,
    'Ben approves the DIVIDENDS one-profile Work3 package inventory'],
  [/Ben approves the APPRAISAL_DISSENTERS_RIGHTS five-profile Work3 package inventory/g,
    'Ben approves the DIVIDENDS one-profile Work3 package inventory'],
  [/FIVE_GOVERNED_CLAIMS_ACROSS_THREE_COMPARATOR_DEALS/g,
    'ONE_GOVERNED_CLAIM_ON_CONCHO_COMPARATOR_DEAL'],
  [/NOT_REQUIRED_FOR_APPRAISAL_DISSENTERS_RIGHTS_FIRST_SLICE/g,
    'NOT_REQUIRED_FOR_DIVIDENDS_FIRST_SLICE'],
  [/STAGE_2Y_APPRAISAL_DISSENTERS_RIGHTS_TERMINAL_SUCCESSOR_CONTRACT/g,
    'STAGE_2Y_DIVIDENDS_TERMINAL_SUCCESSOR_CONTRACT'],
  [/M7_V2_APPRAISAL_DISSENTERS_RIGHTS_WORK3_FAMILY_PACKAGE_SEAL_CANDIDATE/g,
    'M7_V2_DIVIDENDS_WORK3_FAMILY_PACKAGE_SEAL_CANDIDATE'],
  [/BEN_APPRAISAL_DISSENTERS_RIGHTS_FAMILY_PACKAGE/g, 'BEN_DIVIDENDS_FAMILY_PACKAGE'],
  [/No Appraisal \/ dissenters-rights-specific ruling is invented\./g,
    'No Dividends-specific ruling is invented.'],
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
    'lib/canonical-v2/m7-v2-appraisal-dissenters-rights-authoring.js',
    'lib/canonical-v2/m7-v2-dividends-authoring.js',
  ],
  [
    'scripts/stage-2y-structure-m7-v2-appraisal-dissenters-rights-authoring-phase4-authority.mjs',
    'scripts/stage-2y-structure-m7-v2-dividends-authoring-phase4-authority.mjs',
  ],
  [
    'scripts/stage-2y-structure-m7-v2-appraisal-dissenters-rights-inventory-review-packet.mjs',
    'scripts/stage-2y-structure-m7-v2-dividends-inventory-review-packet.mjs',
  ],
  [
    'scripts/stage-2y-structure-m7-v2-appraisal-dissenters-rights-ben-inventory-disposition.mjs',
    'scripts/stage-2y-structure-m7-v2-dividends-ben-inventory-disposition.mjs',
  ],
  [
    'scripts/stage-2y-structure-m7-v2-appraisal-dissenters-rights-family-profile-package.mjs',
    'scripts/stage-2y-structure-m7-v2-dividends-family-profile-package.mjs',
  ],
  [
    'tests/stage-2y-structure-m7-v2-repair-appraisal-dissenters-rights-work3.test.js',
    'tests/stage-2y-structure-m7-v2-repair-dividends-work3.test.js',
  ],
];

for (const [src, dest] of pairs) {
  const content = transform(readFileSync(join(REPO_ROOT, src), 'utf8'));
  writeFileSync(join(REPO_ROOT, dest), content);
  console.log(`wrote ${dest}`);
}

console.log(JSON.stringify({
  profile_count: 1,
  outside_calibration: outsideCalibration,
  subtype_divergence: subtypeDivergence,
  phase2_available: Boolean(PHASE2),
}, null, 2));
