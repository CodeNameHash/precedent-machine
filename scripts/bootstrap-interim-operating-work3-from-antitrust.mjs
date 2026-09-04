#!/usr/bin/env node
/** Bootstrap INTERIM_OPERATING family-local files from ANTITRUST_REGULATORY templates. */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '..');

const PHASE2_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-interim-operating-authoring-phase2-authority-v2.json';

function readPhase2() {
  try {
    const phase2Bytes = readFileSync(join(REPO_ROOT, PHASE2_PATH));
    return { bytes: phase2Bytes, record: JSON.parse(phase2Bytes.toString('utf8')) };
  } catch {
    return { bytes: null, record: null };
  }
}

const { record: PHASE2 } = readPhase2();

const terminals = PHASE2?.source_terminal_successor_contract?.terminal_rule_registry ?? [];
const outsideCalibration = terminals.filter((t) => t.unresolved_items.includes(
  'COMPARATOR_CLAIM_OUTSIDE_CALIBRATION_PROVISION_EXAMPLES',
)).length;
const subtypeDivergence = terminals.filter((t) => t.unresolved_items.includes(
  'SUBTYPE_PARTITION_DIVERGES_FROM_CALIBRATION_PROPOSED_SUBTYPE',
)).length;
const phase2Id = PHASE2?.interim_operating_authoring_phase2_authority_id ?? 'PLACEHOLDER';
const phase2Bytes = PHASE2 ? readPhase2().bytes.length : 0;

const REPLACEMENTS = [
  [/ANTITRUST_REGULATORY/g, 'INTERIM_OPERATING'],
  [/antitrust_regulatory/g, 'interim_operating'],
  [/antitrustRegulatory/g, 'interimOperating'],
  [/AntitrustRegulatory/g, 'InterimOperating'],
  [/Antitrust \/ Regulatory/g, 'Interim Operating'],
  [/Antitrust regulatory/g, 'Interim operating'],
  [/antitrust-regulatory/g, 'interim-operating'],
  [/N1 family #11/g, 'N1 family #21'],
  [/family #11/g, 'family #21'],
  [/ANTITRUST_REGULATORY_PROFILE_COUNT = 70/g, 'INTERIM_OPERATING_PROFILE_COUNT = 113'],
  [/ANTITRUST_REGULATORY_M5_SUBTYPE_UNRESOLVED_PROFILE_COUNT = 6/g,
    'INTERIM_OPERATING_SUBTYPE_DIVERGENCE_PROFILE_COUNT = 0'],
  [/ANTITRUST_REGULATORY_NON_HSR_FILING_REGIME_PROFILE_COUNT = 5/g,
    'INTERIM_OPERATING_OUTSIDE_CALIBRATION_PROFILE_COUNT = 8'],
  [/ANTITRUST_REGULATORY_ONE_SIDED_OBLIGOR_PROFILE_COUNT = 12/g,
    'INTERIM_OPERATING_REGISTERED_SUBTYPE_BUCKET_COUNT = 5'],
  [/ANTITRUST_REGULATORY_REGISTERED_SUBTYPE_BUCKET_COUNT = 12/g,
    'INTERIM_OPERATING_REGISTERED_SUBTYPE_BUCKET_COUNT = 5'],
  [/ANTITRUST_REGULATORY_POPULATED_SUBTYPE_BUCKET_COUNT = 14/g,
    'INTERIM_OPERATING_POPULATED_SUBTYPE_BUCKET_COUNT = 1'],
  [/M5_SUBTYPE: 'M5_SUBTYPE_BUCKET_PARTITION_UNRESOLVED'/g,
    "SUBTYPE_DIVERGENCE: 'SUBTYPE_PARTITION_DIVERGES_FROM_CALIBRATION_PROPOSED_SUBTYPE'"],
  [/M5_SUBTYPE: 'M5_SUBTYPE_BUCKET_PARTITION_UNRESOLVED'/g,
    "OUTSIDE_CALIBRATION: 'COMPARATOR_CLAIM_OUTSIDE_CALIBRATION_PROVISION_EXAMPLES'"],
  [/NON_HSR: 'NON_HSR_FILING_REGIME'/g, ''],
  [/ONE_SIDED: 'ONE_SIDED_OBLIGOR_CAPACITY'/g, ''],
  [/70-profile/g, '113-profile'],
  [/70 profile/g, '113 profile'],
  [/70 profiles/g, '113 profiles'],
  [/70_PROFILE/g, '113_PROFILE'],
  [/Seventy/g, 'One hundred thirteen'],
  [/seventy/g, 'one hundred thirteen'],
  [/exactly 70/g, 'exactly 113'],
  [/KEEP_ALL_70_PROPOSALS/g, 'KEEP_ALL_113_PROPOSALS'],
  [/BEN_70_PROFILE/g, 'BEN_113_PROFILE'],
  [/UNAPPROVED_70_PROFILE/g, 'UNAPPROVED_113_PROFILE'],
  [/REVIEW_ONLY_70_PROFILES/g, 'REVIEW_ONLY_113_PROFILES'],
  [/70_REVIEW_PROPOSALS/g, '113_REVIEW_PROPOSALS'],
  [/ANTITRUST_REGULATORY_70_PROFILE/g, 'INTERIM_OPERATING_113_PROFILE'],
  [/familyantitrustregulatory/g, 'familyinterimoperating'],
  [/seven comparator deals/g, 'six comparator deals'],
  [/Seven comparator/g, 'Six comparator'],
  [/seven deals/g, 'six deals'],
  [/immutable_parent_bindings\.m2_m3_m4\.length, 7/g,
    'immutable_parent_bindings.m2_m3_m4.length, 6'],
  [/comparator_deal_count: 7/g, 'comparator_deal_count: 6'],
  [/M5_SUBTYPE_COUNT/g, 'OUTSIDE_CALIBRATION_COUNT'],
  [/ANTITRUST_REGULATORY_M5_SUBTYPE_UNRESOLVED_PROFILE_COUNT/g,
    'INTERIM_OPERATING_OUTSIDE_CALIBRATION_PROFILE_COUNT'],
  [/M5-subtype-partition-unresolved/g, 'outside-calibration'],
  [/M5_SUBTYPE_BUCKET_PARTITION_UNRESOLVED/g,
    'COMPARATOR_CLAIM_OUTSIDE_CALIBRATION_PROVISION_EXAMPLES'],
  [/twelve sealed M5 buckets and fourteen comparator buckets/g,
    'five sealed M5 subtype buckets with RESTRICTIVE_COVENANT as Work3 first candidate'],
  [/twelve sealed M5 buckets/g, 'five sealed M5 subtype buckets'],
  [/fourteen comparator buckets/g, 'one populated comparator bucket'],
  [/NON_HSR_FILING_REGIME/g, 'COMPARATOR_CLAIM_OUTSIDE_CALIBRATION_PROVISION_EXAMPLES'],
  [/ONE_SIDED_OBLIGOR_CAPACITY/g, ''],
  [/KEY_DEFINED_TERMS/g, 'GENERAL_COVENANTS'],
  [/ANTITRUST_REGULATORY_REGISTERED_SUBTYPE_BUCKETS/g,
    'INTERIM_OPERATING_CLASSIFICATION_BUCKETS'],
  [/ANTITRUST_REGULATORY_BEN_RULINGS_BINDING/g,
    'INTERIM_OPERATING_BEN_RULINGS_BINDING'],
  [/docs\/codex-program\/notes\/ANTITRUST-REGULATORY-BEN-RULINGS-Q01-Q03-2026-08-24.md/g,
    'docs/codex-program/notes/INTERIM-OPERATING-BEN-RULINGS-Q01-Q03-2026-08-24.md'],
  [/ANTITRUST_REGULATORY_ASSERTIONS_GOVERNED_REGULATORY_EVIDENCE_ONLY/g,
    'INTERIM_OPERATING_ASSERTIONS_GOVERNED_INTERIM_COVENANT_EVIDENCE_ONLY'],
  [/REGULATORY_EFFORTS_STANDARD/g, 'IOC_RESTRICTION_PRESENT'],
  [/HSR_FILING_DEADLINE_DAYS/g, 'IOC_RESTRICTION_PRESENT'],
  [/FILING_OBLIGATION/g, 'RESTRICTIVE_COVENANT'],
  [/FILING_DEADLINE/g, 'RESTRICTIVE_COVENANT'],
  [/FILING_TIMING_STANDARD/g, 'RESTRICTIVE_COVENANT'],
  [/EFFORTS/g, 'RESTRICTIVE_COVENANT'],
  [/BURDEN/g, 'RESTRICTIVE_COVENANT'],
  [/LITIGATION/g, 'RESTRICTIVE_COVENANT'],
  [/TIMING_AGREEMENT/g, 'RESTRICTIVE_COVENANT'],
  [/WITHDRAWAL_REFILING/g, 'RESTRICTIVE_COVENANT'],
  [/STRATEGY_CONTROL/g, 'RESTRICTIVE_COVENANT'],
  [/CONSULTATION/g, 'RESTRICTIVE_COVENANT'],
  [/COOPERATION/g, 'RESTRICTIVE_COVENANT'],
  [/INFORMATION_SHARING/g, 'RESTRICTIVE_COVENANT'],
  [/NON_IMPEDIMENT/g, 'RESTRICTIVE_COVENANT'],
  [/NOTIFICATION/g, 'RESTRICTIVE_COVENANT'],
  [/REGULATORY_REQUEST_RESPONSE/g, 'EXCEPTION'],
  [/fb76ef57355bef7f05b3b8955f5f7da4f430964923fecce0c95156c6e0b04a5c/g, ''],
  [/rocket-redfin/g, ''],
  [/lilly-verve/g, ''],
  [/abbvie-landos/g, ''],
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
    'lib/canonical-v2/m7-v2-antitrust-regulatory-authoring.js',
    'lib/canonical-v2/m7-v2-interim-operating-authoring.js',
  ],
  [
    'scripts/stage-2y-structure-m7-v2-antitrust-regulatory-authoring-phase4-authority.mjs',
    'scripts/stage-2y-structure-m7-v2-interim-operating-authoring-phase4-authority.mjs',
  ],
  [
    'scripts/stage-2y-structure-m7-v2-antitrust-regulatory-inventory-review-packet.mjs',
    'scripts/stage-2y-structure-m7-v2-interim-operating-inventory-review-packet.mjs',
  ],
  [
    'scripts/stage-2y-structure-m7-v2-antitrust-regulatory-ben-inventory-disposition.mjs',
    'scripts/stage-2y-structure-m7-v2-interim-operating-ben-inventory-disposition.mjs',
  ],
  [
    'scripts/stage-2y-structure-m7-v2-antitrust-regulatory-family-profile-package.mjs',
    'scripts/stage-2y-structure-m7-v2-interim-operating-family-profile-package.mjs',
  ],
  [
    'tests/stage-2y-structure-m7-v2-repair-antitrust-regulatory-work3.test.js',
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
  phase2_id: phase2Id,
  phase2_bytes: phase2Bytes,
}, null, 2));
