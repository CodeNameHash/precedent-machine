#!/usr/bin/env node
/** Bootstrap MERGER_STRUCTURE_CLOSING family-local files from INTERIM_OPERATING templates. */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import canonicalModule from '../lib/canonical-v2/canonical-bytes.js';

const { sha256Hex } = canonicalModule;
const REPO_ROOT = join(import.meta.dirname, '..');

const PHASE2_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-merger-structure-closing-authoring-phase2-authority-v2.json';

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
  [/INTERIM_OPERATING/g, 'MERGER_STRUCTURE_CLOSING'],
  [/interim_operating/g, 'merger_structure_closing'],
  [/interimOperating/g, 'mergerStructureClosing'],
  [/InterimOperating/g, 'MergerStructureClosing'],
  [/Interim Operating/g, 'Merger Structure / Closing'],
  [/Interim operating/g, 'Merger structure / closing'],
  [/interim-operating/g, 'merger-structure-closing'],
  [/N1 family #21/g, 'N1 family #23'],
  [/family #21/g, 'family #23'],
  [/INTERIM_OPERATING_PROFILE_COUNT = 113/g, 'MERGER_STRUCTURE_CLOSING_PROFILE_COUNT = 103'],
  [/INTERIM_OPERATING_SUBTYPE_DIVERGENCE_PROFILE_COUNT = \d+/g,
    `MERGER_STRUCTURE_CLOSING_SUBTYPE_DIVERGENCE_PROFILE_COUNT = ${subtypeDivergence}`],
  [/INTERIM_OPERATING_OUTSIDE_CALIBRATION_PROFILE_COUNT = \d+/g,
    `MERGER_STRUCTURE_CLOSING_OUTSIDE_CALIBRATION_PROFILE_COUNT = ${outsideCalibration}`],
  [/INTERIM_OPERATING_REGISTERED_SUBTYPE_BUCKET_COUNT = 5/g,
    'MERGER_STRUCTURE_CLOSING_REGISTERED_SUBTYPE_BUCKET_COUNT = 8'],
  [/INTERIM_OPERATING_POPULATED_SUBTYPE_BUCKET_COUNT = 1/g,
    'MERGER_STRUCTURE_CLOSING_POPULATED_SUBTYPE_BUCKET_COUNT = 6'],
  [/INTERIM_OPERATING_PHASE2_AUTHORITY_ID =\n  '[^']+'/g,
    `MERGER_STRUCTURE_CLOSING_PHASE2_AUTHORITY_ID =\n  '${PHASE2.merger_structure_closing_authoring_phase2_authority_id}'`],
  [/INTERIM_OPERATING_PHASE2_AUTHORITY_BYTES = \d+/g,
    `MERGER_STRUCTURE_CLOSING_PHASE2_AUTHORITY_BYTES = ${phase2Bytes.length}`],
  [/INTERIM_OPERATING_PHASE2_AUTHORITY_SHA256 =\n  '[^']+'/g,
    `MERGER_STRUCTURE_CLOSING_PHASE2_AUTHORITY_SHA256 =\n  '${sha256Hex(phase2Bytes)}'`],
  [/familyinterimoperating/g, 'familymergerstructureclosing'],
  [/six comparator deals \(Concho, Metsera, Red Hat, Skechers, Skywater, TopBuild\)/g,
    'seven comparator deals (Concho, Metsera, Modiv, Red Hat, Skechers, Skywater, TopBuild)'],
  [/Red Hat, Skechers, Skywater, TopBuild/g,
    'Modiv, Red Hat, Skechers, Skywater, TopBuild'],
  [/One hundred thirteen/g, 'One hundred three'],
  [/one hundred thirteen/g, 'one hundred three'],
  [/113-profile/g, '103-profile'],
  [/113 profile/g, '103 profile'],
  [/113 profiles/g, '103 profiles'],
  [/113_PROFILE/g, '103_PROFILE'],
  [/KEEP_ALL_113_PROPOSALS/g, 'KEEP_ALL_103_PROPOSALS'],
  [/BEN_113_PROFILE/g, 'BEN_103_PROFILE'],
  [/UNAPPROVED_113_PROFILE/g, 'UNAPPROVED_103_PROFILE'],
  [/REVIEW_ONLY_113_PROFILES/g, 'REVIEW_ONLY_103_PROFILES'],
  [/113_REVIEW_PROPOSALS/g, '103_REVIEW_PROPOSALS'],
  [/INTERIM_OPERATING_113_PROFILE/g, 'MERGER_STRUCTURE_CLOSING_103_PROFILE'],
  [/exactly 113/g, 'exactly 103'],
  [/The 113 profiles/g, 'The 103 profiles'],
  [/113 governed/g, '103 governed'],
  [/RESTRICTIVE_COVENANT/g, 'TRANSACTION_STEP'],
  [/AFFIRMATIVE_COVENANT/g, 'TRANSACTION_PLAN'],
  [/CONSENT_STANDARD/g, 'CLOSING'],
  [/THRESHOLD/g, 'EFFECTIVE_TIME'],
  [/EXCEPTION/g, 'LEGAL_EFFECT'],
  [/0 non-TRANSACTION_STEP/g, '0 non-TRANSACTION_STEP'],
  [/interim operating restriction limbs that differ/g,
    'merger-structure mechanic limbs that differ'],
  [/Concho section 6\.1 carries eighteen independently operative limbs/g,
    'TopBuild Article I carries twenty independently operative limbs'],
  [/INTERIM_OPERATING_ASSERTIONS_GOVERNED_INTERIM_COVENANT_EVIDENCE_ONLY/g,
    'MERGER_STRUCTURE_CLOSING_ASSERTIONS_GOVERNED_MERGER_MECHANIC_EVIDENCE_ONLY'],
  [/CALIBRATION_PACK_TAGS_ALL_SIX_EXAMPLES_RESTRICTIVE_COVENANT/g,
    'CALIBRATION_PACK_TAGS_ALL_SEVEN_EXAMPLES_TRANSACTION_STEP'],
  [/one populated bucket/g, 'six populated buckets'],
  [/one populated subtype bucket/g, 'six populated subtype buckets'],
  [/one populated/g, 'six populated'],
  [/five subtype buckets/g, 'eight subtype buckets'],
  [/one claim definition key under all five subtype buckets/g,
    'two claim definition keys under all eight subtype buckets'],
  [/General Covenants overlap stays classifier-resolved; dividend coordination covenant stays link-only under Dividends Q02./,
    'Closing Conditions stockholder-approval and Proxy / Meeting mechanics stay link-only under Q02.'],
  [/outside_calibration_example_flag_count: \d+/g,
    `outside_calibration_example_flag_count: ${outsideCalibration}`],
  [/subtype_partition_divergence_flag_count: \d+/g,
    `subtype_partition_divergence_flag_count: ${subtypeDivergence}`],
  [/Ben approves the INTERIM_OPERATING 113-profile/g,
    'Ben approves the MERGER_STRUCTURE_CLOSING 103-profile'],
  [/INTERIM_OPERATING 113-profile Work3/g, 'MERGER_STRUCTURE_CLOSING 103-profile Work3'],
  [/ONE_HUNDRED_THIRTEEN_GOVERNED_CLAIMS/g, 'ONE_HUNDRED_THREE_GOVERNED_CLAIMS'],
  [/FIVE_SUBTYPE_BUCKETS/g, 'EIGHT_SUBTYPE_BUCKETS'],
  [/comparator_deal_count: 6/g, 'comparator_deal_count: 7'],
  [/immutable_parent_bindings\.m2_m3_m4\.length, 6/g,
    'immutable_parent_bindings.m2_m3_m4.length, 7'],
  [/docs\/codex-program\/notes\/INTERIM-OPERATING-BEN-RULINGS-Q01-Q03-2026-08-24.md/g,
    'docs/codex-program/notes/MERGER-STRUCTURE-CLOSING-BEN-RULINGS-Q01-Q03-2026-08-24.md'],
  [/exact_agreement_terminal_counts[\s\S]*?\{[\s\S]*?\[TOPBUILD_AGREEMENT_ID\]: 26,[\s\S]*?\}/,
    `authority.source_terminal_successor_contract.exact_agreement_terminal_counts,
    {
      [CONCHO_AGREEMENT_ID]: 13,
      [METSERA_AGREEMENT_ID]: 10,
      [MODIV_AGREEMENT_ID]: 14,
      [REDHAT_AGREEMENT_ID]: 15,
      [SKECHERS_AGREEMENT_ID]: 14,
      [SKYWATER_AGREEMENT_ID]: 17,
      [TOPBUILD_AGREEMENT_ID]: 20,
    }`],
  [/populated_classification_buckets[\s\S]*?\[[\s\S]*?'TRANSACTION_STEP'[\s\S]*?\]/,
    `authority.source_terminal_successor_contract.populated_classification_buckets,
    [
      'TRANSACTION_STEP',
      'CLOSING',
      'EFFECTIVE_TIME',
      'LEGAL_EFFECT',
      'GOVERNANCE_SUCCESSION',
      'BOARD_DESIGNATION',
    ]`],
  [/CLASSIFICATION_BUCKETS = Object\.freeze\(\[[\s\S]*?\]\);/,
    `const MODIV_AGREEMENT_ID =
  'fb76ef57355bef7f05b3b8955f5f7da4f430964923fecce0c95156c6e0b04a5c';

const CLASSIFICATION_BUCKETS = Object.freeze([
  'TRANSACTION_STEP',
  'TRANSACTION_PLAN',
  'CLOSING',
  'EFFECTIVE_TIME',
  'LEGAL_EFFECT',
  'GOVERNANCE_SUCCESSION',
  'ORGANISATIONAL_DOCUMENT',
  'BOARD_DESIGNATION',
]);`],
  [/cross_family_link_only_boundaries\.map[\s\S]*?\),\s*\[\s*\]/,
    `cross_family_link_only_boundaries.map(
      (entry) => entry.owner_family_key,
    ),
    ['CLOSING_CONDITIONS', 'PROXY_MEETING']`],
  [/outside_calibration_example_count:\s*\n\s*interimOperatingAuthoring\.INTERIM_OPERATING_OUTSIDE_CALIBRATION_PROFILE_COUNT/g,
    'outside_calibration_example_count:\n      mergerStructureClosingAuthoring.MERGER_STRUCTURE_CLOSING_OUTSIDE_CALIBRATION_PROFILE_COUNT'],
  [/subtype_partition_divergence_count:\s*\n\s*interimOperatingAuthoring\.INTERIM_OPERATING_SUBTYPE_DIVERGENCE_PROFILE_COUNT/g,
    'subtype_partition_divergence_count:\n      mergerStructureClosingAuthoring.MERGER_STRUCTURE_CLOSING_SUBTYPE_DIVERGENCE_PROFILE_COUNT'],
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
    'lib/canonical-v2/m7-v2-merger-structure-closing-authoring.js',
  ],
  [
    'scripts/stage-2y-structure-m7-v2-interim-operating-authoring-phase4-authority.mjs',
    'scripts/stage-2y-structure-m7-v2-merger-structure-closing-authoring-phase4-authority.mjs',
  ],
  [
    'scripts/stage-2y-structure-m7-v2-interim-operating-inventory-review-packet.mjs',
    'scripts/stage-2y-structure-m7-v2-merger-structure-closing-inventory-review-packet.mjs',
  ],
  [
    'scripts/stage-2y-structure-m7-v2-interim-operating-ben-inventory-disposition.mjs',
    'scripts/stage-2y-structure-m7-v2-merger-structure-closing-ben-inventory-disposition.mjs',
  ],
  [
    'scripts/stage-2y-structure-m7-v2-interim-operating-family-profile-package.mjs',
    'scripts/stage-2y-structure-m7-v2-merger-structure-closing-family-profile-package.mjs',
  ],
  [
    'tests/stage-2y-structure-m7-v2-repair-interim-operating-work3.test.js',
    'tests/stage-2y-structure-m7-v2-repair-merger-structure-closing-work3.test.js',
  ],
];

for (const [src, dest] of pairs) {
  const content = transform(readFileSync(join(REPO_ROOT, src), 'utf8'));
  writeFileSync(join(REPO_ROOT, dest), content);
  console.log(`wrote ${dest}`);
}

console.log(JSON.stringify({
  profile_count: 103,
  outside_calibration: outsideCalibration,
  subtype_divergence: subtypeDivergence,
  phase2_id: PHASE2.merger_structure_closing_authoring_phase2_authority_id,
}, null, 2));
