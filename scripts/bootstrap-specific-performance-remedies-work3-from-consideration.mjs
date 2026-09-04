#!/usr/bin/env node
/** Bootstrap SPECIFIC_PERFORMANCE_REMEDIES family-local files from CONSIDERATION templates. */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import canonicalModule from '../lib/canonical-v2/canonical-bytes.js';

const { sha256Hex } = canonicalModule;
const REPO_ROOT = join(import.meta.dirname, '..');

const PHASE2_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-specific-performance-remedies-authoring-phase2-authority-v2.json';

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
const ownerFamilyHold = terminals.filter((t) => t.unresolved_items.includes(
  'COMPARATOR_OWNER_FAMILY_DISPOSITION_REQUIRED',
)).length;
const approveCount = terminals.length - ownerFamilyHold;

const REPLACEMENTS = [
  [/CONSIDERATION/g, 'SPECIFIC_PERFORMANCE_REMEDIES'],
  [/consideration/g, 'specific_performance_remedies'],
  [/Consideration/g, 'Specific performance remedies'],
  [/N1 family #15/g, 'N1 family #20'],
  [/family #15/g, 'family #20'],
  [/CONSIDERATION_PROFILE_COUNT = 7/g,
    'SPECIFIC_PERFORMANCE_REMEDIES_PROFILE_COUNT = 8'],
  [/SPECIFIC_PERFORMANCE_REMEDIES_PROFILE_COUNT = 7/g,
    'SPECIFIC_PERFORMANCE_REMEDIES_PROFILE_COUNT = 8'],
  [/CONSIDERATION_SUBTYPE_DIVERGENCE_PROFILE_COUNT = 7/g,
    `SPECIFIC_PERFORMANCE_REMEDIES_SUBTYPE_DIVERGENCE_PROFILE_COUNT = ${subtypeDivergence}`],
  [/CONSIDERATION_OUTSIDE_CALIBRATION_PROFILE_COUNT = 0/g,
    `SPECIFIC_PERFORMANCE_REMEDIES_OUTSIDE_CALIBRATION_PROFILE_COUNT = ${outsideCalibration}`],
  [/CONSIDERATION_REGISTERED_SUBTYPE_BUCKET_COUNT = 10/g,
    'SPECIFIC_PERFORMANCE_REMEDIES_REGISTERED_SUBTYPE_BUCKET_COUNT = 7'],
  [/CONSIDERATION_POPULATED_SUBTYPE_BUCKET_COUNT = 2/g,
    'SPECIFIC_PERFORMANCE_REMEDIES_POPULATED_SUBTYPE_BUCKET_COUNT = 1'],
  [/familyconsideration/g, 'familyspecificperformanceremedies'],
  [/four comparator deals \(Metsera, Red Hat, Skechers, TopBuild\)/g,
    'six comparator deals (Concho, Metsera, Red Hat, Skechers, Skywater, TopBuild)'],
  [/Metsera, Red Hat, Skechers, TopBuild/g,
    'Concho, Metsera, Red Hat, Skechers, Skywater, TopBuild'],
  [/four comparator deals/g, 'six comparator deals'],
  [/comparator_deal_count: 4/g, 'comparator_deal_count: 6'],
  [/Comparator deals \| 4/g, 'Comparator deals | 6'],
  [/KEEP_ALL_7_PROPOSALS/g, 'KEEP_ALL_8_PROPOSALS'],
  [/BEN_7_PROFILE/g, 'BEN_8_PROFILE'],
  [/UNAPPROVED_7_PROFILE/g, 'UNAPPROVED_8_PROFILE'],
  [/REVIEW_ONLY_7_PROFILES/g, 'REVIEW_ONLY_8_PROFILES'],
  [/7_REVIEW_PROPOSALS/g, '8_REVIEW_PROPOSALS'],
  [/CONSIDERATION_7_PROFILE/g, 'SPECIFIC_PERFORMANCE_REMEDIES_8_PROFILE'],
  [/7-profile/g, '8-profile'],
  [/7 profile/g, '8 profile'],
  [/7 profiles/g, '8 profiles'],
  [/7_PROFILE/g, '8_PROFILE'],
  [/Seven/g, 'Eight'],
  [/seven/g, 'eight'],
  [/exactly 7/g, 'exactly 8'],
  [/exactly seven/g, 'exactly eight'],
  [/The 7 profiles/g, 'The 8 profiles'],
  [/7 governed/g, '8 governed'],
  [/7-profile Work3/g, '8-profile Work3'],
  [/CONSIDERATION_PACKAGE/g, 'GENERAL_EQUITABLE_RELIEF'],
  [/CASH_COMPONENT/g, 'CLOSING_ENFORCEMENT'],
  [/STOCK_COMPONENT/g, 'NON_OBJECTION'],
  [/CVR_COMPONENT/g, 'BOND_SECURITY_WAIVER'],
  [/ELECTION/g, 'REMEDY_COORDINATION'],
  [/APPRAISAL_LINK/g, 'REMEDY_ACTION_EXTENSION'],
  [/EXCLUSION/g, 'COST_SHIFT'],
  [/EQUITY_AWARD/g, 'GENERAL_EQUITABLE_RELIEF'],
  [/WITHHOLDING/g, 'BOND_SECURITY_WAIVER'],
  [/EXCHANGE_MECHANICS/g, 'REMEDY_ACTION_EXTENSION'],
  [/PER_SHARE_CASH_CONSIDERATION/g, 'SPECIFIC_PERFORMANCE_REMEDY_PRESENT'],
  [/APPRAISAL_RIGHTS_STATUS/g, 'SPECIFIC_PERFORMANCE_REMEDY_PRESENT'],
  [/APPRAISAL_DISSENTERS_RIGHTS/g, 'TERMINATION_FEE'],
  [/APPRAISAL_DISSENTERS_RIGHTS_SHARED_SECTION/g, 'TERMINATION_FEE_SOLE_REMEDY_SECTION'],
  [/LINK_ONLY_NOT_A_CONSIDERATION_TERMINAL/g,
    'LINK_ONLY_NOT_A_SPECIFIC_PERFORMANCE_REMEDIES_TERMINAL'],
  [/owner_family_key: 'APPRAISAL_DISSENTERS_RIGHTS'/g,
    "owner_family_key: 'TERMINATION_FEE'"],
  [/subject: 'APPRAISAL_DISSENTERS_RIGHTS_SHARED_SECTION'/g,
    "subject: 'TERMINATION_FEE_SOLE_REMEDY_SECTION'"],
  [/CONSIDERATION_ASSERTIONS_GOVERNED_PER_SHARE_CASH_AND_APPRAISAL_STATUS_APPRAISAL_FAMILY_Q02_LINK_ONLY/g,
    'SPECIFIC_PERFORMANCE_REMEDIES_ASSERTIONS_GOVERNED_EQUITABLE_RELIEF_ONLY_TERMINATION_FEE_SOLE_REMEDY_Q02_LINK_ONLY'],
  [/CALIBRATION_PACK_TAGS_ALL_FOUR_EXAMPLES_CONSIDERATION_PACKAGE/g,
    'CALIBRATION_PACK_TAGS_ALL_SIX_EXAMPLES_GENERAL_EQUITABLE_RELIEF'],
  [/election-branch per-share cash and appraisal linkage/g,
    'equitable-relief and remedy-coordination limbs on shared remedy sections'],
  [/sparse wave-4 deal-economics cluster/g,
    'sparse wave-4 equitable-relief cluster with termination-fee sole-remedy cross-family hold'],
  [/SEVEN_GOVERNED_CLAIMS_ACROSS_FOUR_COMPARATOR_DEALS/g,
    'EIGHT_GOVERNED_CLAIMS_ACROSS_SIX_COMPARATOR_DEALS'],
  [/METSERA_AGREEMENT_ID[\s\S]*?TOPBUILD_AGREEMENT_ID =\n  '3888fa7618bbd9fd6530b657aaa18c7e85ff515acf80edb1fc78a190af86e9cb';/g,
    `CONCHO_AGREEMENT_ID =
  '1d6bba9ac993f72340d048742f995eb515a50cdfadb9bc86b3f36847baed9116';
const METSERA_AGREEMENT_ID =
  'f783c4cdcaca4626c695d1c2c67924ccd8867eb066e16f17407ca64497ba778c';
const REDHAT_AGREEMENT_ID =
  '06ec301641939fe0ac6e6ba598a33b40f16b1acc3ffb29109c7227b14bf1025a';
const SKECHERS_AGREEMENT_ID =
  '08fd217ea2561699fd43cb6c75ee26c358c018084956322c92e1e19d7ecce154';
const SKYWATER_AGREEMENT_ID =
  'b74ed1f02f2e1385121b187cb0bb6dd8144ff18449149b6cf20182eede0eb363';
const TOPBUILD_AGREEMENT_ID =
  '3888fa7618bbd9fd6530b657aaa18c7e85ff515acf80edb1fc78a190af86e9cb';`],
  ...(PHASE2 ? [
    [/CONSIDERATION_PHASE2_AUTHORITY_ID =\n  '[^']+'/g,
      `SPECIFIC_PERFORMANCE_REMEDIES_PHASE2_AUTHORITY_ID =\n  '${PHASE2.specific_performance_remedies_authoring_phase2_authority_id}'`],
    [/CONSIDERATION_PHASE2_AUTHORITY_BYTES = \d+/g,
      `SPECIFIC_PERFORMANCE_REMEDIES_PHASE2_AUTHORITY_BYTES = ${phase2Bytes.length}`],
    [/CONSIDERATION_PHASE2_AUTHORITY_SHA256 =\n  '[^']+'/g,
      `SPECIFIC_PERFORMANCE_REMEDIES_PHASE2_AUTHORITY_SHA256 =\n  '${sha256Hex(phase2Bytes)}'`],
  ] : []),
];

function transform(content) {
  let out = content;
  for (const [pattern, replacement] of REPLACEMENTS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

const files = [
  'lib/canonical-v2/m7-v2-specific-performance-remedies-authoring.js',
  'scripts/stage-2y-structure-m7-v2-specific-performance-remedies-authoring-phase4-authority.mjs',
  'scripts/stage-2y-structure-m7-v2-specific-performance-remedies-inventory-review-packet.mjs',
  'scripts/stage-2y-structure-m7-v2-specific-performance-remedies-ben-inventory-disposition.mjs',
  'scripts/stage-2y-structure-m7-v2-specific-performance-remedies-family-profile-package.mjs',
  'tests/stage-2y-structure-m7-v2-repair-specific-performance-remedies-work3.test.js',
];

for (const dest of files) {
  const content = transform(readFileSync(join(REPO_ROOT, dest), 'utf8'));
  writeFileSync(join(REPO_ROOT, dest), content);
  console.log(`transformed ${dest}`);
}

console.log(JSON.stringify({
  profile_count: 8,
  outside_calibration: outsideCalibration,
  subtype_divergence: subtypeDivergence,
  owner_family_hold: ownerFamilyHold,
  approve_count: approveCount,
  phase2_available: Boolean(PHASE2),
}, null, 2));
