#!/usr/bin/env node
/** Bootstrap APPRAISAL_DISSENTERS_RIGHTS family-local files from FINANCING_COVENANTS templates. */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import canonicalModule from '../lib/canonical-v2/canonical-bytes.js';

const { sha256Hex } = canonicalModule;
const REPO_ROOT = join(import.meta.dirname, '..');

const PHASE2_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-appraisal-dissenters-rights-authoring-phase2-authority-v2.json';
const phase2Bytes = readFileSync(join(REPO_ROOT, PHASE2_PATH));

const PHASE2 = JSON.parse(phase2Bytes.toString('utf8'));

const terminals = PHASE2.source_terminal_successor_contract.terminal_rule_registry;
const outsideCalibration = terminals.filter((t) => t.unresolved_items.includes(
  'COMPARATOR_CLAIM_OUTSIDE_CALIBRATION_PROVISION_EXAMPLES',
)).length;
const subtypeDivergence = terminals.filter((t) => t.unresolved_items.includes(
  'SUBTYPE_PARTITION_DIVERGES_FROM_CALIBRATION_PROPOSED_SUBTYPE',
)).length;

const REPLACEMENTS = [
  [/FINANCING_COVENANTS/g, 'APPRAISAL_DISSENTERS_RIGHTS'],
  [/financing_covenants/g, 'appraisal_dissenters_rights'],
  [/financingCovenants/g, 'appraisalDissentersRights'],
  [/FinancingCovenants/g, 'AppraisalDissentersRights'],
  [/Financing Covenants/g, 'Appraisal / dissenters-rights'],
  [/Financing covenants/g, 'Appraisal / dissenters-rights'],
  [/financing-covenants/g, 'appraisal-dissenters-rights'],
  [/Financing covenants/g, 'Appraisal dissenters-rights'],
  [/N1 family #9/g, 'N1 family #17'],
  [/family #9/g, 'family #17'],
  [/FINANCING_COVENANTS_PROFILE_COUNT = 5/g,
    'APPRAISAL_DISSENTERS_RIGHTS_PROFILE_COUNT = 5'],
  [/FINANCING_COVENANTS_SUBTYPE_DIVERGENCE_PROFILE_COUNT = 2/g,
    `APPRAISAL_DISSENTERS_RIGHTS_SUBTYPE_DIVERGENCE_PROFILE_COUNT = ${subtypeDivergence}`],
  [/FINANCING_COVENANTS_OUTSIDE_CALIBRATION_PROFILE_COUNT = 1/g,
    `APPRAISAL_DISSENTERS_RIGHTS_OUTSIDE_CALIBRATION_PROFILE_COUNT = ${outsideCalibration}`],
  [/FINANCING_COVENANTS_REGISTERED_SUBTYPE_BUCKET_COUNT = 7/g,
    'APPRAISAL_DISSENTERS_RIGHTS_REGISTERED_SUBTYPE_BUCKET_COUNT = 6'],
  [/FINANCING_COVENANTS_POPULATED_SUBTYPE_BUCKET_COUNT = 3/g,
    'APPRAISAL_DISSENTERS_RIGHTS_POPULATED_SUBTYPE_BUCKET_COUNT = 2'],
  [/FINANCING_COVENANTS_PHASE2_AUTHORITY_ID =\n  '[^']+'/g,
    `APPRAISAL_DISSENTERS_RIGHTS_PHASE2_AUTHORITY_ID =\n  '${PHASE2.appraisal_dissenters_rights_authoring_phase2_authority_id}'`],
  [/FINANCING_COVENANTS_PHASE2_AUTHORITY_BYTES = \d+/g,
    `APPRAISAL_DISSENTERS_RIGHTS_PHASE2_AUTHORITY_BYTES = ${phase2Bytes.length}`],
  [/FINANCING_COVENANTS_PHASE2_AUTHORITY_SHA256 =\n  '[^']+'/g,
    `APPRAISAL_DISSENTERS_RIGHTS_PHASE2_AUTHORITY_SHA256 =\n  '${sha256Hex(phase2Bytes)}'`],
  [/familyfinancingcovenants/g, 'familyappraisaldissentersrights'],
  [/three comparator deals \(Concho, Skechers, TopBuild\)/g,
    'three comparator deals (Skechers, Skywater, TopBuild)'],
  [/Concho, Skechers, TopBuild/g, 'Skechers, Skywater, TopBuild'],
  [/CONCHO_AGREEMENT_ID[\s\S]*?TOPBUILD_AGREEMENT_ID =\n  '3888fa7618bbd9fd6530b657aaa18c7e85ff515acf80edb1fc78a190af86e9cb';/g,
    `SKECHERS_AGREEMENT_ID =
  '08fd217ea2561699fd43cb6c75ee26c358c018084956322c92e1e19d7ecce154';
const SKYWATER_AGREEMENT_ID =
  'b74ed1f02f2e1385121b187cb0bb6dd8144ff18449149b6cf20182eede0eb363';
const TOPBUILD_AGREEMENT_ID =
  '3888fa7618bbd9fd6530b657aaa18c7e85ff515acf80edb1fc78a190af86e9cb';`],
  [/FINANCING_ASSERTIONS_GOVERNED_FINANCING_MECHANICS_EVIDENCE_ONLY/g,
    'APPRAISAL_ASSERTIONS_GOVERNED_WITHDRAWAL_RECONVERSION_AND_SETTLEMENT_CONSENT_CONSIDERATION_Q02_LINK_ONLY'],
  [/CALIBRATION_PACK_TAGS_ALL_THREE_EXAMPLES_OBTAIN_FINANCING/g,
    'CALIBRATION_PACK_TAGS_ALL_THREE_EXAMPLES_APPRAISAL_STATUS'],
  [/payoff lead-time/g, 'withdrawal-reconversion and settlement-consent'],
  [/OBTAIN_FINANCING/g, 'APPRAISAL_STATUS'],
  [/NO_FINANCING_CONDITION/g, 'NEGOTIATION_CONTROL'],
  [/PAYOFF/g, 'WITHDRAWAL_RECONVERSION'],
  [/ALTERNATIVE_FINANCING/g, 'APPRAISAL_ENTITLEMENT'],
  [/TARGET_COOPERATION/g, 'APPRAISAL_NOTICE'],
  [/NOTE_OFFER_OR_CONSENT/g, 'SETTLEMENT_CONSENT'],
  [/COST_AND_RISK_ALLOCATION/g, 'APPRAISAL_ENTITLEMENT'],
  [/GUARANTY_FINANCING_PARTY/g, 'CONSIDERATION'],
  [/FINANCING_SOURCE_PROTECTION_WAIVER/g, 'APPRAISAL_RIGHTS_STATUS'],
  [/LINK_ONLY_NOT_A_FINANCING_COVENANTS_TERMINAL/g,
    'LINK_ONLY_NOT_AN_APPRAISAL_DISSENTERS_RIGHTS_TERMINAL'],
  [/sparse-to-medium set/g, 'sparse wave-4 appraisal settlement cluster'],
  [/subtype_partition_divergence_flag_count: 2/g,
    `subtype_partition_divergence_flag_count: ${subtypeDivergence}`],
  [/outside_calibration_example_flag_count: 1/g,
    `outside_calibration_example_flag_count: ${outsideCalibration}`],
  [/outside_calibration_example_count: 1/g,
    `outside_calibration_example_count: ${outsideCalibration}`],
  [/populated_subtype_bucket_count: 3/g,
    'populated_subtype_bucket_count: 2'],
  [/registered_subtype_bucket_count: 7/g,
    'registered_subtype_bucket_count: 6'],
  [/item\.review_flags\.includes\(FLAGS\.SUBTYPE_DIVERGENCE\),\n    \)\.length,\n    2,/g,
    `item.review_flags.includes(FLAGS.SUBTYPE_DIVERGENCE),\n    ).length,\n    ${subtypeDivergence},`],
  [/item\.review_flags\.includes\(FLAGS\.OUTSIDE_CALIBRATION\),\n    \)\.length,\n    1,/g,
    `item.review_flags.includes(FLAGS.OUTSIDE_CALIBRATION),\n    ).length,\n    ${outsideCalibration},`],
  [/result\.review_accounting\.subtype_partition_divergence_flag_count, 2\)/g,
    `result.review_accounting.subtype_partition_divergence_flag_count, ${subtypeDivergence})`],
  [/result\.legal_grouping_disposition_binding\.subtype_partition_divergence_count,\n    2,/g,
    `result.legal_grouping_disposition_binding.subtype_partition_divergence_count,\n    ${subtypeDivergence},`],
  [/assert\.deepEqual\(\n    packageRecord\.profiles\.map\(\(profile\) => profile\.classification_path\[1\]\)\.sort\(\),\n    \['NO_FINANCING_CONDITION', 'OBTAIN_FINANCING', 'OBTAIN_FINANCING', 'PAYOFF', 'PAYOFF'\],/g,
    `assert.deepEqual(\n    packageRecord.profiles.map((profile) => profile.classification_path[1]).sort(),\n    ['SETTLEMENT_CONSENT', 'SETTLEMENT_CONSENT', 'WITHDRAWAL_RECONVERSION', 'WITHDRAWAL_RECONVERSION', 'WITHDRAWAL_RECONVERSION'],`],
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
    'lib/canonical-v2/m7-v2-appraisal-dissenters-rights-authoring.js',
  ],
  [
    'scripts/stage-2y-structure-m7-v2-financing-covenants-authoring-phase4-authority.mjs',
    'scripts/stage-2y-structure-m7-v2-appraisal-dissenters-rights-authoring-phase4-authority.mjs',
  ],
  [
    'scripts/stage-2y-structure-m7-v2-financing-covenants-inventory-review-packet.mjs',
    'scripts/stage-2y-structure-m7-v2-appraisal-dissenters-rights-inventory-review-packet.mjs',
  ],
  [
    'scripts/stage-2y-structure-m7-v2-financing-covenants-ben-inventory-disposition.mjs',
    'scripts/stage-2y-structure-m7-v2-appraisal-dissenters-rights-ben-inventory-disposition.mjs',
  ],
  [
    'scripts/stage-2y-structure-m7-v2-financing-covenants-family-profile-package.mjs',
    'scripts/stage-2y-structure-m7-v2-appraisal-dissenters-rights-family-profile-package.mjs',
  ],
  [
    'tests/stage-2y-structure-m7-v2-repair-financing-covenants-work3.test.js',
    'tests/stage-2y-structure-m7-v2-repair-appraisal-dissenters-rights-work3.test.js',
  ],
];

for (const [src, dest] of pairs) {
  const content = transform(readFileSync(join(REPO_ROOT, src), 'utf8'));
  writeFileSync(join(REPO_ROOT, dest), content);
  console.log(`wrote ${dest}`);
}

console.log(JSON.stringify({
  profile_count: 5,
  outside_calibration: outsideCalibration,
  subtype_divergence: subtypeDivergence,
}, null, 2));
