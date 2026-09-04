#!/usr/bin/env node
/** Bootstrap NO_SHOP family-local files from KEY_DEFINED_TERMS templates (slice A). */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import canonicalModule from '../lib/canonical-v2/canonical-bytes.js';

const { sha256Hex } = canonicalModule;
const REPO_ROOT = join(import.meta.dirname, '..');

const PHASE2_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-no-shop-authoring-phase2-authority-v2.json';
const phase2Bytes = readFileSync(join(REPO_ROOT, PHASE2_PATH));
const PHASE2 = JSON.parse(phase2Bytes.toString('utf8'));

const SLICE_A_KEYS = new Set([
  'NO_SHOP_PROHIBITED_ACTION',
  'NO_SHOP_EXCEPTION_PREREQUISITE',
]);

const terminals = PHASE2.source_terminal_successor_contract.terminal_rule_registry;
const sliceATerminals = terminals.filter((t) => SLICE_A_KEYS.has(
  t.source_closure.members[0].claim_definition_key,
));
const outsideCalibration = sliceATerminals.filter((t) => t.unresolved_items.includes(
  'COMPARATOR_CLAIM_OUTSIDE_CALIBRATION_PROVISION_EXAMPLES',
)).length;
const subtypeDivergence = sliceATerminals.filter((t) => t.unresolved_items.includes(
  'SUBTYPE_PARTITION_DIVERGES_FROM_CALIBRATION_PROPOSED_SUBTYPE',
)).length;

const REPLACEMENTS = [
  [/KEY_DEFINED_TERMS/g, 'NO_SHOP'],
  [/key_defined_terms/g, 'no_shop'],
  [/keyDefinedTerms/g, 'noShop'],
  [/KeyDefinedTerms/g, 'NoShop'],
  [/Key Defined Terms/g, 'No-Shop'],
  [/key-defined-terms/g, 'no-shop'],
  [/N1 family #16/g, 'N1 family #18'],
  [/family #16/g, 'family #18'],
  [/NO_SHOP_PROFILE_COUNT = 76/g, `NO_SHOP_PROFILE_COUNT = ${sliceATerminals.length}`],
  [/NO_SHOP_PHASE2_TERMINAL_COUNT = \d+/g, `NO_SHOP_PHASE2_TERMINAL_COUNT = ${terminals.length}`],
  [/NO_SHOP_SUBTYPE_DIVERGENCE_PROFILE_COUNT = \d+/g,
    `NO_SHOP_SUBTYPE_DIVERGENCE_PROFILE_COUNT = ${subtypeDivergence}`],
  [/NO_SHOP_OUTSIDE_CALIBRATION_PROFILE_COUNT = \d+/g,
    `NO_SHOP_OUTSIDE_CALIBRATION_PROFILE_COUNT = ${outsideCalibration}`],
  [/NO_SHOP_REGISTERED_SUBTYPE_BUCKET_COUNT = 5/g,
    'NO_SHOP_REGISTERED_SUBTYPE_BUCKET_COUNT = 8'],
  [/NO_SHOP_POPULATED_SUBTYPE_BUCKET_COUNT = 5/g,
    'NO_SHOP_POPULATED_SUBTYPE_BUCKET_COUNT = 1'],
  [/NO_SHOP_PHASE2_AUTHORITY_ID =\n  '[^']+'/g,
    `NO_SHOP_PHASE2_AUTHORITY_ID =\n  '${PHASE2.no_shop_authoring_phase2_authority_id}'`],
  [/NO_SHOP_PHASE2_AUTHORITY_BYTES = \d+/g,
    `NO_SHOP_PHASE2_AUTHORITY_BYTES = ${phase2Bytes.length}`],
  [/NO_SHOP_PHASE2_AUTHORITY_SHA256 =\n  '[^']+'/g,
    `NO_SHOP_PHASE2_AUTHORITY_SHA256 =\n  '${sha256Hex(phase2Bytes)}'`],
  [/familykeydefinedterms/g, 'familynoshop'],
  [/six comparator deals \(Concho, Metsera, Red Hat, Skechers, Skywater, TopBuild\)/g,
    'seven comparator deals (Concho, Metsera, Modiv, Red Hat, Skechers, Skywater, TopBuild)'],
  [/Concho, Metsera, Red Hat, Skechers, Skywater, TopBuild/g,
    'Concho, Metsera, Modiv, Red Hat, Skechers, Skywater, TopBuild'],
  [/six comparator deals/g, 'seven comparator deals'],
  [/comparator_deal_count: 6/g, 'comparator_deal_count: 7'],
  [/KEEP_ALL_76_PROPOSALS/g, `KEEP_ALL_${sliceATerminals.length}_PROPOSALS`],
  [/BEN_76_PROFILE/g, `BEN_${sliceATerminals.length}_PROFILE`],
  [/UNAPPROVED_76_PROFILE/g, `UNAPPROVED_${sliceATerminals.length}_PROFILE`],
  [/REVIEW_ONLY_76_PROFILES/g, `REVIEW_ONLY_${sliceATerminals.length}_PROFILE_SLICE_A`],
  [/76_REVIEW_PROPOSALS/g, `${sliceATerminals.length}_REVIEW_PROPOSALS`],
  [/NO_SHOP_76_PROFILE/g, `NO_SHOP_${sliceATerminals.length}_PROFILE_SLICE_A`],
  [/76-profile/g, `${sliceATerminals.length}-profile`],
  [/76 profile/g, `${sliceATerminals.length} profile`],
  [/76 profiles/g, `${sliceATerminals.length} profiles`],
  [/76_PROFILE/g, `${sliceATerminals.length}_PROFILE`],
  [/Seventy-six/g, `${sliceATerminals.length}`],
  [/seventy-six/g, String(sliceATerminals.length)],
  [/exactly 76/g, `exactly ${sliceATerminals.length}`],
  [/exactly seventy-six/g, `exactly ${sliceATerminals.length}`],
  [/The 76 profiles/g, `The ${sliceATerminals.length} slice A profiles`],
  [/76 governed/g, `${sliceATerminals.length} governed slice A`],
  [/76-profile Work3/g, `${sliceATerminals.length}-profile Work3 slice A`],
  [/KEY_DEFINED_TERMS_ASSERTIONS_GOVERNED_DEFINITION_CONTENT_REPRESENTATIONS_KNOWLEDGE_Q02_LINK_ONLY/g,
    'NO_SHOP_ASSERTIONS_GOVERNED_PROHIBITED_ACTIONS_AND_EXCEPTION_LADDERS_KEY_DEFINED_TERMS_Q02_LINK_ONLY'],
  [/CALIBRATION_PACK_TAGS_ALL_SIX_EXAMPLES_ACQUISITION_PROPOSAL/g,
    'CALIBRATION_PACK_TAGS_ALL_SEVEN_EXAMPLES_RESTRICTION'],
  [/Representations KNOWLEDGE_QUALIFIER rows stay Q02 link-only — do not absorb/g,
    'KEY_DEFINED_TERMS owns Acquisition Proposal / Superior Proposal definitions (Q02 link-only); TERMINATION_FEE, PROXY_MEETING, TERMINATION cross-refs stay link-only'],
  [/knowledge-person definitions, superior-proposal thresholds, intervening events, and willful-breach definitions/g,
    'prohibited-action enumeration and exception-prerequisite pairing across seven comparator deals'],
  [/wave 2/g, 'wave 3'],
  [/wave: 2/g, 'wave: 3'],
  [/LINK_ONLY_NOT_A_KEY_DEFINED_TERMS_TERMINAL/g, 'LINK_ONLY_NOT_A_NO_SHOP_TERMINAL'],
  [/medium-density definitions set/g, 'largest N1 family — slice A prohibited actions + exception prerequisites'],
  [/SEVENTY_SIX_GOVERNED_CLAIMS/g, 'TWO_HUNDRED_FOUR_SLICE_A_GOVERNED_CLAIMS'],
  [/Seventy-six governed/g, `${sliceATerminals.length} slice A governed`],
  [/KEY_DEFINED_TERMS_Q01_Q02_Q03_BOUND_TO_SEALED_M5_PROGRAMME_RULINGS/g,
    'NO_SHOP_Q01_Q02_Q03_BOUND_TO_SEALED_M5_PROGRAMME_RULINGS'],
  [/ACQUISITION_PROPOSAL/g, 'RESTRICTION'],
  [/SUPERIOR_PROPOSAL/g, 'ENGAGEMENT_PERMISSION'],
  [/INTERVENING_EVENT/g, 'NOTICE'],
  [/KNOWLEDGE/g, 'STANDSTILL'],
  [/WILLFUL_BREACH/g, 'RECOMMENDATION_CHANGE'],
  [/REPRESENTATIONS_KNOWLEDGE_QUALIFIER_ROWS/g,
    'ACQUISITION_PROPOSAL_SUPERIOR_PROPOSAL_INTERVENING_EVENT_DEFINITIONS'],
  [/subtype_partition_divergence_flag_count: 41/g,
    `subtype_partition_divergence_flag_count: ${subtypeDivergence}`],
  [/outside_calibration_example_flag_count: 20/g,
    `outside_calibration_example_flag_count: ${outsideCalibration}`],
  [/outside_calibration_example_count: 20/g,
    `outside_calibration_example_count: ${outsideCalibration}`],
  [/populated_subtype_bucket_count: 5/g, 'populated_subtype_bucket_count: 1'],
  [/registered_subtype_bucket_count: 5/g, 'registered_subtype_bucket_count: 8'],
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
    'lib/canonical-v2/m7-v2-key-defined-terms-authoring.js',
    'lib/canonical-v2/m7-v2-no-shop-authoring.js',
  ],
  [
    'scripts/stage-2y-structure-m7-v2-key-defined-terms-authoring-phase4-authority.mjs',
    'scripts/stage-2y-structure-m7-v2-no-shop-authoring-phase4-authority.mjs',
  ],
  [
    'scripts/stage-2y-structure-m7-v2-key-defined-terms-inventory-review-packet.mjs',
    'scripts/stage-2y-structure-m7-v2-no-shop-inventory-review-packet.mjs',
  ],
  [
    'scripts/stage-2y-structure-m7-v2-key-defined-terms-ben-inventory-disposition.mjs',
    'scripts/stage-2y-structure-m7-v2-no-shop-ben-inventory-disposition.mjs',
  ],
  [
    'scripts/stage-2y-structure-m7-v2-key-defined-terms-family-profile-package.mjs',
    'scripts/stage-2y-structure-m7-v2-no-shop-family-profile-package.mjs',
  ],
  [
    'tests/stage-2y-structure-m7-v2-repair-key-defined-terms-work3.test.js',
    'tests/stage-2y-structure-m7-v2-repair-no-shop-work3.test.js',
  ],
];

for (const [src, dest] of pairs) {
  const content = transform(readFileSync(join(REPO_ROOT, src), 'utf8'));
  writeFileSync(join(REPO_ROOT, dest), content);
  console.log(`wrote ${dest}`);
}

console.log(JSON.stringify({
  profile_count: sliceATerminals.length,
  terminal_count: terminals.length,
  outside_calibration: outsideCalibration,
  subtype_divergence: subtypeDivergence,
}, null, 2));
