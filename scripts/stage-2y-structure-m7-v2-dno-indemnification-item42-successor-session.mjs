#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import canonicalModule from '../lib/canonical-v2/canonical-bytes.js';
import {
  generateDnoIndemnificationFamilyProfilePackage,
  ITEM42_SUCCESSOR_PACKAGE_PATH,
} from './stage-2y-structure-m7-v2-dno-indemnification-family-profile-package.mjs';

const { canonicalJson, contentId, sha256Hex } = canonicalModule;
const REPO_ROOT = join(import.meta.dirname, '..');
const CONTROL = 'evidence/canonical-v2/stage-2y-structure-migration/control';
const RULING_ID = 'dno-item-42-linked-duty-blocker-b';
const RULING_PATH = 'docs/codex-program/notes/N1-BEN-LEGAL-RULINGS-RECEIPT-2026-08-25.json';
const POLICY_PATH = `${CONTROL}/m7-v2-repair-contract-policy.json`;
const WORK3_AUTHORITY_PATH =
  `${CONTROL}/m7-v2-repair-contract-work3-entry-correction-authority.json`;
const PREDECESSOR_DISPOSITION_PATH =
  `${CONTROL}/m7-v2-repair-dno-31-profile-inventory-disposition.json`;
const PREDECESSOR_SESSION_PATH =
  `${CONTROL}/m7-v2-repair-dno-ben-inventory-session-receipt.json`;
const PREDECESSOR_PACKAGE_PATH =
  `${CONTROL}/m7-v2-repair-family-work3-profile-package-dno-indemnification.json`;
const PACKAGE_PATH = ITEM42_SUCCESSOR_PACKAGE_PATH;
const METSERA_M2_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/shadow/m2/f783c4cdcaca4626c695d1c2c67924ccd8867eb066e16f17407ca64497ba778c.agreement-index.json';
const METSERA_M4_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/shadow/m4/f783c4cdcaca4626c695d1c2c67924ccd8867eb066e16f17407ca64497ba778c.agreement-analysis.json';
const ABBVIE_SOURCE_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/source/m7-generalisation/abbvie-landos/canonical.txt';

const POLICY_SUCCESSOR_PATH =
  `${CONTROL}/m7-v2-repair-contract-policy-item-42-successor-authority-2026-09-01.json`;
const INVENTORY_AUTHORITY_PATH =
  `${CONTROL}/m7-v2-repair-contract-work3-dno-indemnification-item-42-ben-inventory-session-successor-authority-2026-09-01.json`;
const DISPOSITION_PATH =
  `${CONTROL}/m7-v2-repair-dno-33-profile-inventory-disposition-item-42-successor-2026-09-01.json`;
const SESSION_RECEIPT_PATH =
  `${CONTROL}/m7-v2-repair-dno-ben-inventory-session-item-42-successor-receipt-2026-09-01.json`;
const SEAL_AUTHORITY_PATH =
  `${CONTROL}/m7-v2-repair-contract-work3-dno-indemnification-item-42-family-package-seal-successor-authority-2026-09-01.json`;
const SEAL_RECEIPT_PATH =
  `${CONTROL}/m7-v2-repair-dno-indemnification-item-42-family-package-seal-receipt-2026-09-01.json`;
const REGISTRATION_AUTHORITY_PATH =
  `${CONTROL}/m7-v2-repair-contract-work3-dno-indemnification-item-42-registration-successor-authority-2026-09-01.json`;
const APPLICATION_RECEIPT_PATH =
  'docs/codex-program/notes/N1-DNO-ITEM-42-RULING-APPLICATION-RECEIPT-2026-09-01.json';

const PREDECESSOR_PACKAGE_BINDING = Object.freeze({
  byte_length: 407522,
  git_blob_oid: 'c410d22bf518be891479995f878cdc2aa45b2b30',
  path: PREDECESSOR_PACKAGE_PATH,
  record_id: 'e5b568d8eaa764a63a17e4fc6337b3049c8cfa5163947cb230c120027c38395e',
  record_id_field: 'family_profile_package_id',
  schema_version: 'STAGE_2Y_M7_V2_FAMILY_PROFILE_PACKAGE/V2',
  sha256: '5fccaa143aed5deb4eecd81e9efaf3782930eaf282b069e6e5bc35f939acb0ed',
});

const ITEM42_PROFILE_KEYS = Object.freeze([
  'PROFILE:DNO_INDEMNIFICATION:NO_ADVERSE_AMENDMENT',
  'PROFILE:DNO_INDEMNIFICATION:RIGHTS_SURVIVAL',
]);
const HELD_ORDINALS = new Set([14, 19, 22, 25, 27]);
const CHECK_ONLY = process.argv.includes('--check');
const WRITE = process.argv.includes('--write');

if (CHECK_ONLY === WRITE) {
  throw new Error('use exactly one of --check or --write');
}

function read(path) {
  return JSON.parse(readFileSync(join(REPO_ROOT, path), 'utf8'));
}

function bytes(path) {
  return readFileSync(join(REPO_ROOT, path));
}

function gitBlobOid(value) {
  return createHash('sha1').update(Buffer.concat([
    Buffer.from(`blob ${value.length}\0`, 'utf8'),
    value,
  ])).digest('hex');
}

function recordBinding(path, record, idField) {
  const value = Buffer.from(`${canonicalJson(record)}\n`, 'utf8');
  return {
    byte_length: value.length,
    git_blob_oid: gitBlobOid(value),
    path,
    record_id: record[idField],
    record_id_field: idField,
    schema_version: record.schema_version,
    sha256: sha256Hex(value),
  };
}

function fileBinding(path) {
  const value = bytes(path);
  const record = JSON.parse(value.toString('utf8'));
  return {
    byte_length: value.length,
    path,
    schema_version: record.schema_version,
    sha256: sha256Hex(value),
  };
}

function buildRecord(path, schemaVersion, idField, body) {
  const unsigned = { schema_version: schemaVersion, ...body };
  const record = { ...unsigned, [idField]: contentId(schemaVersion, unsigned) };
  const value = Buffer.from(`${canonicalJson(record)}\n`, 'utf8');
  return { path, value, record, binding: recordBinding(path, record, idField) };
}

function persist(outputs) {
  for (const output of outputs) {
    const fullPath = join(REPO_ROOT, output.path);
    if (existsSync(fullPath)) {
      const existing = readFileSync(fullPath);
      if (!existing.equals(output.value)) {
        throw new Error(`create-once successor output already exists with different bytes: ${output.path}`);
      }
      continue;
    }
    if (CHECK_ONLY) {
      throw new Error(`successor output is missing: ${output.path}`);
    }
    writeFileSync(fullPath, output.value);
  }
}

function sourceSpan(path, startByte, endByte, expectedText) {
  const sourceRecord = read(path);
  const sourceBytes = Buffer.from(sourceRecord.source_binding.canonical_text, 'utf8');
  const text = sourceBytes.subarray(startByte, endByte).toString('utf8');
  if (text !== expectedText) {
    throw new Error(`${path} bytes [${startByte},${endByte}) do not match the pinned text`);
  }
  return {
    coordinate_system: 'UTF8_CANONICAL_TEXT_HALF_OPEN',
    end_byte: endByte,
    source_path: path,
    start_byte: startByte,
    text,
    text_sha256: sha256Hex(Buffer.from(text, 'utf8')),
  };
}

function plainTextSpan(path, startByte, endByte, expectedText) {
  const sourceBytes = bytes(path);
  const text = sourceBytes.subarray(startByte, endByte).toString('utf8');
  if (text !== expectedText) {
    throw new Error(`${path} bytes [${startByte},${endByte}) do not match the pinned text`);
  }
  return {
    coordinate_system: 'UTF8_CANONICAL_TEXT_HALF_OPEN',
    end_byte: endByte,
    source_path: path,
    start_byte: startByte,
    text,
    text_sha256: sha256Hex(Buffer.from(text, 'utf8')),
  };
}

const metseraSpans = Object.freeze({
  survival: sourceSpan(
    METSERA_M2_PATH,
    202825,
    202856,
    '(ii) shall survive the Merger, ',
  ),
  continuation: sourceSpan(
    METSERA_M2_PATH,
    202856,
    203136,
    '(iii) shall continue in full force and effect in accordance with their terms with respect to any claims against any such Indemnified Party arising out of such acts or omissions for the period beginning as of the Effective Time and ending six (6) years from the Effective Time and ',
  ),
  noAdverse: sourceSpan(
    METSERA_M2_PATH,
    203136,
    203421,
    '(iv) shall not, except as may be required by Law, be amended, repealed or otherwise modified in any manner that would adversely affect any right thereunder of any such Indemnified Party for the period beginning as of the Effective Time and ending six (6) years from the Effective Time.',
  ),
});

const abbvieSpans = Object.freeze({
  survival: plainTextSpan(
    ABBVIE_SOURCE_PATH,
    190173,
    190205,
    'shall survive the Effective Time',
  ),
  noAdverse: plainTextSpan(
    ABBVIE_SOURCE_PATH,
    190210,
    190353,
    'shall not be amended, repealed, or otherwise modified in any manner that would adversely affect the rights thereunder of any Indemnified Person',
  ),
});

const metseraRowEvidence = Object.freeze({
  14: sourceSpan(
    METSERA_M2_PATH,
    202862,
    203131,
    'shall continue in full force and effect in accordance with their terms with respect to any claims against any such Indemnified Party arising out of such acts or omissions for the period beginning as of the Effective Time and ending six (6) years from the Effective Time',
  ),
  19: sourceSpan(
    METSERA_M2_PATH,
    208102,
    208387,
    'neither Parent nor the Surviving Corporation shall be required to pay an aggregate annual premium for such insurance policies in excess of three hundred percent (300%) of the annual premium payable by the Company for coverage for its current fiscal year under the Existing D&O Policies',
  ),
  22: sourceSpan(
    METSERA_M2_PATH,
    202388,
    202499,
    'as provided in the Company Charter, the Company By-laws, the organizational documents of any Company Subsidiary',
  ),
  25: sourceSpan(
    METSERA_M2_PATH,
    207586,
    207807,
    'Parent shall either purchase such “tail” insurance policies or, for the period beginning upon as of the Effective Time and ending six (6) years from the Effective Time, cause the Existing D&O Policies to be maintained',
  ),
  27: sourceSpan(
    METSERA_M2_PATH,
    201843,
    201971,
    'All rights to indemnification and exculpation from liabilities for acts or omissions occurring at or prior to the Effective Time',
  ),
});
const metseraRowClaims = Object.freeze({
  14: {
    analysis_claim_id: 'e741e1ef03bcaae353eaa17446c05ed2b1c6ef286f6c553522e9ce089fb79a84',
    claim_definition_key: 'INDEMNIFICATION_SURVIVAL_YEARS',
  },
  19: {
    analysis_claim_id: '7c134ea8ba53a22f1ce174be59199b8f8eff4e2bf3c99f389e003e0408914e5c',
    claim_definition_key: 'TAIL_PREMIUM_CAP_PERCENT',
  },
  22: {
    analysis_claim_id: 'ed84404e1f7cb3184973e32dd93b6f8a92d0d0c6ead112fb7c39db4a596b0099',
    claim_definition_key: 'CHARTER_PROTECTION_CONTINUATION',
  },
  25: {
    analysis_claim_id: '17d970d94b595559e6a911480f732469bf958403ae49ef3c3676a18cbffb0ab6',
    claim_definition_key: 'TAIL_POLICY_OBLIGATION',
  },
  27: {
    analysis_claim_id: '0815f3f1c92e5db866a1dc9106fa60ca65c9557285bf25239aac2fdc7006abc9',
    claim_definition_key: 'INDEMNIFICATION_CONTINUATION',
  },
});

function changedExistingRow(row) {
  if (!HELD_ORDINALS.has(row.ordinal)) return structuredClone(row);
  return {
    disposition: 'APPROVE',
    disposition_reason: 'ITEM_42_LINKED_DUTY_SHARED_SOURCE_REVIEW_APPROVED_BY_SUCCESSOR_RULING',
    linked_duty_deferred_acknowledged: true,
    ordinal: row.ordinal,
    prior_disposition: row.disposition,
    prior_disposition_reason: row.disposition_reason,
    proposed_profile_key: row.proposed_profile_key,
    review_flags_acknowledged: [...row.review_flags_acknowledged],
    ruling_application: {
      option_id: 'approve-child-profiles',
      ruling_id: RULING_ID,
    },
  };
}

function addedProfileDisposition(profile, ordinal) {
  return {
    disposition: 'APPROVE',
    linked_duty_deferred_acknowledged: false,
    ordinal,
    package_profile_key: profile.profile_key,
    proposed_profile_key: sha256Hex(Buffer.from(canonicalJson({
      classification_path: profile.classification_path,
      required_expression_signature: profile.required_expression_signature,
    }), 'utf8')),
    review_flags_acknowledged: [],
  };
}

function normalisedInheritedProfile(profile) {
  const value = structuredClone(profile);
  delete value.profile_id;
  for (const proof of value.fixture_proofs) {
    proof.fixture_binding.container_path = '<FAMILY_PACKAGE>';
  }
  return value;
}

function assertSuccessorPackageContinuity(predecessorPackage, successorPackage) {
  const successorProfilesByKey = new Map(
    successorPackage.profiles.map((profile) => [profile.profile_key, profile]),
  );
  for (const predecessorProfile of predecessorPackage.profiles) {
    const successorProfile = successorProfilesByKey.get(predecessorProfile.profile_key);
    if (!successorProfile
        || canonicalJson(normalisedInheritedProfile(successorProfile))
          !== canonicalJson(normalisedInheritedProfile(predecessorProfile))) {
      throw new Error(
        `D&O item-42 successor changed inherited profile semantics: ${predecessorProfile.profile_key}`,
      );
    }
  }
  const successorFixturesById = new Map(
    successorPackage.match_fixtures.map((fixture) => [fixture.match_fixture_id, fixture]),
  );
  for (const predecessorFixture of predecessorPackage.match_fixtures) {
    if (canonicalJson(successorFixturesById.get(predecessorFixture.match_fixture_id))
        !== canonicalJson(predecessorFixture)) {
      throw new Error(
        `D&O item-42 successor changed inherited fixture: ${predecessorFixture.match_fixture_id}`,
      );
    }
  }
}

function assertDispositionClosesPackage(rows, packageRecord) {
  if (rows.length !== 33
      || rows.some((row, index) => row.ordinal !== index + 1 || row.disposition !== 'APPROVE')) {
    throw new Error('D&O item-42 successor disposition does not approve exact ordinals 1 through 33');
  }
  const profilesByKey = new Map(
    packageRecord.profiles.map((profile) => [profile.profile_key, profile]),
  );
  const rowProfileKeys = rows.map((row) => {
    if (row.package_profile_key !== undefined) return row.package_profile_key;
    const matches = packageRecord.profiles.filter(
      (profile) => profile.profile_key.endsWith(`:${row.proposed_profile_key}`),
    );
    if (matches.length !== 1) {
      throw new Error(`D&O item-42 disposition row ${row.ordinal} has no unique package profile`);
    }
    return matches[0].profile_key;
  });
  if (new Set(rowProfileKeys).size !== 33
      || canonicalJson([...rowProfileKeys].sort())
        !== canonicalJson([...profilesByKey.keys()].sort())) {
    throw new Error('D&O item-42 successor disposition does not close the exact package profiles');
  }
  const dimensionEvidenceCounts = new Map();
  for (const evidence of packageRecord.dimension_evidence) {
    dimensionEvidenceCounts.set(
      evidence.profile_id,
      (dimensionEvidenceCounts.get(evidence.profile_id) ?? 0) + 1,
    );
  }
  if ([...profilesByKey.values()].some(
    (profile) => dimensionEvidenceCounts.get(profile.profile_id) !== 1,
  )) {
    throw new Error('D&O item-42 successor package lacks one dimension-evidence row per profile');
  }
}

function main() {
  const actualPredecessorPackage = read(PREDECESSOR_PACKAGE_PATH);
  const actualPredecessorPackageBinding = recordBinding(
    PREDECESSOR_PACKAGE_PATH,
    actualPredecessorPackage,
    'family_profile_package_id',
  );
  if (canonicalJson(actualPredecessorPackageBinding)
      !== canonicalJson(PREDECESSOR_PACKAGE_BINDING)) {
    throw new Error('sealed D&O predecessor package bytes changed before successor authoring');
  }
  const rulingBinding = fileBinding(RULING_PATH);
  const policy = read(POLICY_PATH);
  const policyBinding = recordBinding(POLICY_PATH, policy, 'contract_policy_id');
  const work3Authority = read(WORK3_AUTHORITY_PATH);
  const work3AuthorityBinding = recordBinding(
    WORK3_AUTHORITY_PATH,
    work3Authority,
    'correction_authority_id',
  );
  const predecessorDisposition = read(PREDECESSOR_DISPOSITION_PATH);
  const predecessorDispositionBinding = recordBinding(
    PREDECESSOR_DISPOSITION_PATH,
    predecessorDisposition,
    'inventory_disposition_id',
  );
  const predecessorSession = read(PREDECESSOR_SESSION_PATH);
  const predecessorSessionBinding = recordBinding(
    PREDECESSOR_SESSION_PATH,
    predecessorSession,
    'ben_inventory_session_receipt_id',
  );
  const metseraM2 = read(METSERA_M2_PATH);
  const metseraM4 = read(METSERA_M4_PATH);
  const metseraM2Binding = recordBinding(METSERA_M2_PATH, metseraM2, 'agreement_index_id');
  const metseraM4Binding = recordBinding(METSERA_M4_PATH, metseraM4, 'agreement_analysis_id');
  const generated = generateDnoIndemnificationFamilyProfilePackage({
    item42Successor: true,
    write: false,
  });
  const newPackageBinding = generated.outputBinding;
  if (newPackageBinding.path !== PACKAGE_PATH
      || newPackageBinding.sha256 === PREDECESSOR_PACKAGE_BINDING.sha256
      || generated.packageRecord.profiles.length !== 33
      || generated.packageRecord.dimension_evidence.length !== 33) {
    throw new Error('D&O item-42 successor package did not produce the required new seal');
  }
  const successorProfilesByKey = new Map(
    generated.packageRecord.profiles.map((profile) => [profile.profile_key, profile]),
  );
  for (const profileKey of ITEM42_PROFILE_KEYS) {
    if (!successorProfilesByKey.has(profileKey)) {
      throw new Error(`D&O item-42 successor package is missing ${profileKey}`);
    }
  }
  assertSuccessorPackageContinuity(actualPredecessorPackage, generated.packageRecord);

  const policySuccessor = buildRecord(
    POLICY_SUCCESSOR_PATH,
    'N1_DNO_ITEM42_POLICY_PIN_SUCCESSOR_AUTHORITY/V1',
    'item42_policy_pin_successor_authority_id',
    {
      applied_on: '2026-09-01',
      authority_state: 'APPLIED_TO_DNO_WORK3_SUCCESSOR_ONLY',
      predecessor_policy_binding: policyBinding,
      ruling_binding: rulingBinding,
      ruling_id: RULING_ID,
      ruling_option_id: 'approve-child-profiles',
      successor_pin: {
        exact_profile_keys: [...ITEM42_PROFILE_KEYS],
        prior_profile_keys_changed: false,
        prior_state: 'PROFILE_KEYS_PINNED_BUT_ABSENT_FROM_ON_DISK_DNO_PACKAGE',
        successor_state: 'EXACT_PROFILE_KEYS_PRESENT_IN_RESEALED_DNO_PACKAGE',
      },
      source_identity_disclosure: {
        policy_item_42_agreement: 'ABBVIE_LANDOS',
        policy_item_42_agreement_id: 'f4a123d7c2bd8ba6358499dd9870513c8bac6a6893985bf5a581a536af280d71',
        policy_item_42_spans: abbvieSpans,
        ruling_receipt_comparator_deal: 'METSERA',
        ruling_receipt_comparator_spans: metseraSpans,
        treatment: 'KEEP_SOURCE_OCCURRENCES_DISTINCT_WHILE_APPLYING_THE_SAME_TWO_EXACT_PROFILE_KEYS',
      },
      scope: {
        predecessor_package_path: PREDECESSOR_PACKAGE_PATH,
        permitted_package_path: PACKAGE_PATH,
        production_activation_permitted: false,
        stamp_clearance_permitted: false,
      },
    },
  );

  const inventoryAuthority = buildRecord(
    INVENTORY_AUTHORITY_PATH,
    'N1_DNO_ITEM42_INVENTORY_SESSION_SUCCESSOR_AUTHORITY/V1',
    'item42_inventory_session_successor_authority_id',
    {
      applied_on: '2026-09-01',
      authority_state: 'AUTHORISED_SUCCESSOR_DISPOSITION_AND_PROFILE_AUTHORING',
      evidence_bindings: {
        metsera_m2: metseraM2Binding,
        metsera_m4: metseraM4Binding,
        predecessor_disposition: predecessorDispositionBinding,
        predecessor_package: PREDECESSOR_PACKAGE_BINDING,
        predecessor_session_receipt: predecessorSessionBinding,
        ruling_receipt: rulingBinding,
        successor_policy_pin: policySuccessor.binding,
      },
      exact_changed_existing_ordinals: [...HELD_ORDINALS].sort((a, b) => a - b),
      exact_new_profile_keys: [...ITEM42_PROFILE_KEYS],
      legal_determination: {
        distinct_operative_units: true,
        no_adverse_amendment_span: metseraSpans.noAdverse,
        rights_survival_span: metseraSpans.survival,
        survival_duration_span: metseraSpans.continuation,
      },
      permitted_writes: [
        DISPOSITION_PATH,
        SESSION_RECEIPT_PATH,
        SEAL_AUTHORITY_PATH,
        PACKAGE_PATH,
        SEAL_RECEIPT_PATH,
        REGISTRATION_AUTHORITY_PATH,
        APPLICATION_RECEIPT_PATH,
      ],
      prohibited_effects: {
        production_activation: true,
        serving_change: true,
        stamp_clearance: true,
      },
    },
  );

  const successorRows = [
    ...predecessorDisposition.profile_dispositions.map(changedExistingRow),
    addedProfileDisposition(
      successorProfilesByKey.get('PROFILE:DNO_INDEMNIFICATION:NO_ADVERSE_AMENDMENT'),
      32,
    ),
    addedProfileDisposition(
      successorProfilesByKey.get('PROFILE:DNO_INDEMNIFICATION:RIGHTS_SURVIVAL'),
      33,
    ),
  ];
  assertDispositionClosesPackage(successorRows, generated.packageRecord);
  const disposition = buildRecord(
    DISPOSITION_PATH,
    'N1_DNO_ITEM42_33_PROFILE_INVENTORY_DISPOSITION/V1',
    'inventory_disposition_id',
    {
      applied_on: '2026-09-01',
      predecessor_binding: predecessorDispositionBinding,
      profile_dispositions: successorRows,
      ruling_binding: rulingBinding,
      ruling_id: RULING_ID,
      session_summary: {
        added_profile_count: 2,
        approved_count: 33,
        hold_count: 0,
        item_42_existing_hold_lift_count: 5,
        reject_count: 0,
      },
      successor_authority_id:
        inventoryAuthority.record.item42_inventory_session_successor_authority_id,
    },
  );

  const sessionReceipt = buildRecord(
    SESSION_RECEIPT_PATH,
    'N1_DNO_ITEM42_BEN_INVENTORY_SESSION_RECEIPT/V1',
    'ben_inventory_session_receipt_id',
    {
      completion_state: 'COMPLETE',
      disposition_binding: disposition.binding,
      predecessor_session_binding: predecessorSessionBinding,
      profile_count: 33,
      ruling_binding: rulingBinding,
      ruling_id: RULING_ID,
      successor_authority_binding: inventoryAuthority.binding,
      zero_effect_boundary: {
        production_activation_count: 0,
        product_write_count: 0,
        stamp_clearance_count: 0,
      },
    },
  );

  const sealAuthority = buildRecord(
    SEAL_AUTHORITY_PATH,
    'N1_DNO_ITEM42_FAMILY_PACKAGE_SEAL_SUCCESSOR_AUTHORITY/V1',
    'item42_family_package_seal_successor_authority_id',
    {
      applied_on: '2026-09-01',
      authority_state: 'AUTHORISED_RESEAL_ONLY',
      exact_package_path: PACKAGE_PATH,
      inventory_session_authority_binding: inventoryAuthority.binding,
      predecessor_package_binding: PREDECESSOR_PACKAGE_BINDING,
      successor_disposition_binding: disposition.binding,
      successor_policy_pin_binding: policySuccessor.binding,
      successor_session_receipt_binding: sessionReceipt.binding,
      required_profile_count: 33,
      required_profile_keys: [...ITEM42_PROFILE_KEYS],
      required_restored_dimension_evidence_profile_keys: [...ITEM42_PROFILE_KEYS],
      production_activation_permitted: false,
      stamp_clearance_permitted: false,
    },
  );

  const sealReceipt = buildRecord(
    SEAL_RECEIPT_PATH,
    'N1_DNO_ITEM42_FAMILY_PACKAGE_SEAL_RECEIPT/V1',
    'item42_family_package_seal_receipt_id',
    {
      completion_state: 'COMPLETE',
      independent_review_state: 'PENDING',
      package_transition: {
        predecessor: PREDECESSOR_PACKAGE_BINDING,
        successor: newPackageBinding,
      },
      profile_accounting: {
        approved_count: 33,
        dimension_evidence_count: 33,
        hold_count: 0,
        profile_count: 33,
      },
      ruling_binding: rulingBinding,
      ruling_id: RULING_ID,
      seal_successor_authority_binding: sealAuthority.binding,
      stamp_cleared: false,
      successor_disposition_binding: disposition.binding,
    },
  );

  const registrationAuthority = buildRecord(
    REGISTRATION_AUTHORITY_PATH,
    'N1_DNO_ITEM42_REGISTRATION_SUCCESSOR_AUTHORITY/V1',
    'item42_registration_successor_authority_id',
    {
      applied_on: '2026-09-01',
      authority_state: 'REGISTERED_ZERO_PRODUCT_WRITE_EFFECT',
      exact_changed_existing_ordinals: [...HELD_ORDINALS].sort((a, b) => a - b),
      exact_new_profile_keys: [...ITEM42_PROFILE_KEYS],
      family_package_seal_receipt_binding: sealReceipt.binding,
      predecessor_package_binding: PREDECESSOR_PACKAGE_BINDING,
      profile_count: 33,
      production_activation_permitted: false,
      ruling_binding: rulingBinding,
      ruling_id: RULING_ID,
      ruling_option_id: 'approve-child-profiles',
      stamp_clearance_permitted: false,
      successor_disposition_binding: disposition.binding,
      successor_package_binding: newPackageBinding,
      successor_policy_pin_binding: policySuccessor.binding,
      work3_entry_correction_authority_binding: work3AuthorityBinding,
      zero_effect_boundary: {
        database_write_count: 0,
        product_write_count: 0,
        serving_change_count: 0,
      },
    },
  );

  const predecessorRowsByOrdinal = new Map(
    predecessorDisposition.profile_dispositions.map((row) => [row.ordinal, row]),
  );
  const changedRows = [...HELD_ORDINALS].sort((a, b) => a - b).map((ordinal) => ({
    after: successorRows.find((row) => row.ordinal === ordinal),
    before: predecessorRowsByOrdinal.get(ordinal),
    evidence_span: metseraRowEvidence[ordinal],
    m4_claim: metseraRowClaims[ordinal],
    row_change: 'HOLD_TO_APPROVE',
  }));
  changedRows.push({
    after: successorRows.find((row) => row.ordinal === 32),
    before: null,
    profile_field_evidence: {
      NO_ADVERSE_AMENDMENT: metseraSpans.noAdverse,
      NO_ADVERSE_AMENDMENT_DURATION: metseraSpans.noAdverse,
    },
    row_change: 'ADD_APPROVED_PROFILE',
    template_profile_key: 'PROFILE:DNO_INDEMNIFICATION:NO_ADVERSE_AMENDMENT',
  }, {
    after: successorRows.find((row) => row.ordinal === 33),
    before: null,
    profile_field_evidence: {
      RIGHTS_SURVIVAL: metseraSpans.survival,
      RIGHTS_SURVIVAL_DURATION: metseraSpans.continuation,
    },
    row_change: 'ADD_APPROVED_PROFILE',
    template_profile_key: 'PROFILE:DNO_INDEMNIFICATION:RIGHTS_SURVIVAL',
  });

  const applicationReceipt = buildRecord(
    APPLICATION_RECEIPT_PATH,
    'N1_RULING_APPLICATION_RECEIPT/V1',
    'ruling_application_receipt_id',
    {
      applied_on: '2026-09-01',
      changed_rows: changedRows,
      distinct_unit_determination: {
        conclusion: 'RIGHTS_SURVIVAL_AND_NO_ADVERSE_AMENDMENT_ARE_DISTINCT_OPERATIVE_UNITS',
        metsera_numbered_limb_spans: metseraSpans,
      },
      independent_review_state: 'PENDING',
      metsera_m4_binding: metseraM4Binding,
      package_transition: {
        predecessor: PREDECESSOR_PACKAGE_BINDING,
        successor: newPackageBinding,
      },
      ruling_binding: rulingBinding,
      ruling_id: RULING_ID,
      ruling_option_id: 'approve-child-profiles',
      source_identity_disclosure:
        'The sealed item-42 policy source is AbbVie-Landos section 5.7. The five lifted comparator rows are Metsera section 6.05. This application keeps those source occurrences distinct.',
      stamp_cleared: false,
      successor_authorities: [
        policySuccessor.binding,
        inventoryAuthority.binding,
        sealAuthority.binding,
        registrationAuthority.binding,
      ],
      successor_disposition_binding: disposition.binding,
      successor_seal_receipt_binding: sealReceipt.binding,
      successor_session_receipt_binding: sessionReceipt.binding,
    },
  );

  persist([
    policySuccessor,
    inventoryAuthority,
    disposition,
    sessionReceipt,
    sealAuthority,
    { path: generated.packagePath, value: generated.bytes },
    sealReceipt,
    registrationAuthority,
    applicationReceipt,
  ]);

  console.log(JSON.stringify({
    mode: CHECK_ONLY ? 'CHECK' : 'WRITE_CREATE_ONCE',
    application_receipt: applicationReceipt.binding,
    disposition: disposition.binding,
    package: newPackageBinding,
    registration_authority: registrationAuthority.binding,
    seal_authority: sealAuthority.binding,
    seal_receipt: sealReceipt.binding,
    session_authority: inventoryAuthority.binding,
    session_receipt: sessionReceipt.binding,
    successor_policy: policySuccessor.binding,
  }, null, 2));
}

main();
