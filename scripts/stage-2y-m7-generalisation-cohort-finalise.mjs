#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { canonicalJson, contentId, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { indexAgreement } = require('../lib/canonical-v2/agreement-index');
const { selectFamilySections } = require('../lib/canonical-v2/m7-deterministic-generalisation');

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const BASE = 'evidence/canonical-v2/stage-2y-structure-migration';
const CORRECTION_MODE = process.argv.length === 3 && process.argv[2] === '--row-correction';
const AUTHORITY_PATH = `${BASE}/control/m7-generalisation-authority.json`;
const CORRECTION_AUTHORITY_PATH = `${BASE}/control/m7-row-correction-authority.json`;
const ADMISSION_RECEIPT_PATH = `${BASE}/receipts/stage-2y-structure-m7-source-admission.json`;
const M6_CORRECTION_RECEIPT_PATH = `${BASE}/receipts/stage-2y-structure-m6-agreement-projection-row-correction.json`;
const FAMILY_POLICY_PATH = `${BASE}/control/m5-calibration-policy.json`;
const STRUCTURAL_POLICY_PATH = `${BASE}/control/structural-policy.json`;
const OUTPUT_PATH = `${BASE}/control/m7-generalisation-cohort${CORRECTION_MODE ? '-row-correction' : ''}.json`;

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function binding(relativePath) {
  const bytes = fs.readFileSync(path.join(ROOT, relativePath));
  return { path: relativePath, byte_length: bytes.length, sha256: sha256Hex(bytes) };
}

function sourceBinding(candidate, suffix) {
  const found = candidate.output_bindings.find((entry) => entry.path.endsWith(`/${suffix}`));
  if (!found) throw new Error(`missing ${suffix} for ${candidate.candidate_key}`);
  const actual = binding(found.path);
  if (canonicalJson(actual) !== canonicalJson(found)) throw new Error(`source binding drift: ${found.path}`);
  return found;
}

if ((!CORRECTION_MODE && process.argv.length !== 2)
  || (CORRECTION_MODE && (process.argv.length !== 3 || process.argv[2] !== '--row-correction'))) {
  throw new Error('use no arguments for the original cohort or --row-correction for the authorised correction');
}

const originalAuthority = readJson(AUTHORITY_PATH);
let authority = originalAuthority;
if (CORRECTION_MODE) {
  const unsigned = {
    stage: 'M7_ROW_CORRECTION',
    authority_state: 'BEN_AUTHORISED_REPORT_ONLY',
    ben_approval_id: 'BEN-M7-ROW-CORRECTION-2026-08-12',
    approval_text: 'ok',
    discovered_defect: 'ALL_38_SOURCE_TO_ROW_REVIEW_ITEMS_REPEATED_SOURCE_TEXT',
    authorised_scope: [
      'PRESERVE_ORIGINAL_M7_GENERALISATION_AND_REVIEW_PACKET',
      'SELECT_A_SMALL_AUTHORED_LEGAL_UNIT_FROM_A_MATCHING_SECTION_HEADING',
      'USE_THE_CORRECTED_M6_ROW_BUILDER',
      'RERUN_M7_MACHINE_AUDIT_AND_FREEZE_A_REPLACEMENT_SAMPLE',
    ],
    input_bindings: [
      binding(AUTHORITY_PATH),
      binding(ADMISSION_RECEIPT_PATH),
      binding(M6_CORRECTION_RECEIPT_PATH),
    ],
    limits: {
      model_call_count: 0,
      database_write_count: 0,
      product_write_count: 0,
      serving_change_count: 0,
      publication_count: 0,
      selector_change_count: 0,
    },
    prohibited_effects: ['MODEL_CALL', 'DATABASE_WRITE', 'PRODUCT_WRITE', 'SERVING_CHANGE', 'PUBLICATION', 'M8', 'M9', 'M10'],
  };
  const schemaVersion = 'STAGE_2Y_M7_ROW_CORRECTION_AUTHORITY/V1';
  authority = {
    schema_version: schemaVersion,
    correction_authority_id: contentId(schemaVersion, { schema_version: schemaVersion, ...unsigned }),
    ...unsigned,
  };
  fs.writeFileSync(path.join(ROOT, CORRECTION_AUTHORITY_PATH), `${canonicalJson(authority)}\n`);
}
const admissionReceipt = readJson(ADMISSION_RECEIPT_PATH);
const familyOrder = readJson(FAMILY_POLICY_PATH).family_order_contract.families;
const structuralPolicy = readJson(STRUCTURAL_POLICY_PATH);

if (authority.authority_state !== 'BEN_AUTHORISED_REPORT_ONLY' || admissionReceipt.status !== 'PASS') {
  throw new Error('M7 authority or source admission is not passing');
}
if (admissionReceipt.candidates.length !== 3 || familyOrder.length !== 25) {
  throw new Error('M7 cohort cardinality mismatch');
}

const agreements = admissionReceipt.candidates
  .map((candidate) => {
    const canonical = sourceBinding(candidate, 'canonical.txt');
    const raw = sourceBinding(candidate, 'response.html');
    const sourceMap = sourceBinding(candidate, 'source-map.json');
    const admission = sourceBinding(candidate, 'admission.json');
    const canonicalText = fs.readFileSync(path.join(ROOT, canonical.path), 'utf8');
    const index = indexAgreement({
      agreement_id: candidate.immutable_source_document_id,
      deal: candidate.candidate_key,
      canonical_text: canonicalText,
      canonical_text_id: candidate.canonical_text_id,
      canonical_text_sha256: candidate.canonical_text_sha256,
      immutable_source_document_id: candidate.immutable_source_document_id,
      raw_source_sha256: raw.sha256,
      raw_source_byte_length: raw.byte_length,
      source_path: canonical.path,
      source_bindings: {
        governed_deal_key: candidate.governed_deal_key,
        source_admission_manifest_id: candidate.source_admission_manifest_id,
      },
    }, structuralPolicy);
    return {
      candidate_key: candidate.candidate_key,
      governed_deal_key: candidate.governed_deal_key,
      agreement_id: candidate.immutable_source_document_id,
      immutable_source_document_id: candidate.immutable_source_document_id,
      canonical_text_id: candidate.canonical_text_id,
      raw_source_binding: raw,
      canonical_source_binding: canonical,
      source_map_binding: sourceMap,
      admission_manifest_binding: admission,
      source_admission_manifest_id: candidate.source_admission_manifest_id,
      selection_reason: 'BEN_APPROVED_M7_GENERALISATION_COHORT_MEMBER',
      family_input_states: selectFamilySections(index, familyOrder),
    };
  })
  .sort((left, right) => left.candidate_key.localeCompare(right.candidate_key));

const unsigned = {
  stage: 'M7',
  state: 'SEALED_ADDITIVE_THREE_AGREEMENT_COHORT',
  authority_binding: binding(CORRECTION_MODE ? CORRECTION_AUTHORITY_PATH : AUTHORITY_PATH),
  source_admission_receipt_binding: binding(ADMISSION_RECEIPT_PATH),
  family_order_binding: binding(FAMILY_POLICY_PATH),
  structural_policy_binding: binding(STRUCTURAL_POLICY_PATH),
  agreement_count: agreements.length,
  registered_family_count: familyOrder.length,
  agreements,
  effects: {
    model_calls: 0,
    database_writes: 0,
    product_writes: 0,
    serving_changes: 0,
    publications: 0,
    selector_changes: 0,
  },
};
const output = {
  schema_version: 'STAGE_2Y_M7_GENERALISATION_COHORT/V1',
  cohort_id: contentId('STAGE_2Y_M7_GENERALISATION_COHORT/V1', unsigned),
  ...unsigned,
};
fs.writeFileSync(path.join(ROOT, OUTPUT_PATH), `${canonicalJson(output)}\n`);
process.stdout.write(`${OUTPUT_PATH}\n${output.cohort_id}\n`);
