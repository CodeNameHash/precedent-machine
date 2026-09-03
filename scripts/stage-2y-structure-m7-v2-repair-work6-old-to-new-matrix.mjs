#!/usr/bin/env node
// Work 6 old-to-new state transition matrix. Recounts the sealed
// resolution-set-diff (sealed seven + additive three). A larger honest
// review-row residue is reported and is not a gate failure.

import { pathToFileURL } from 'node:url';

import {
  COMBINED_TEN_CORPUS_DIGEST,
  SEALED_LEDGERS,
  Work6Error,
  readSealedLedger,
  runReport,
} from './stage-2y-structure-m7-v2-repair-work6-lib.mjs';

const SCHEMA = 'STAGE_2Y_M7_V2_REPAIR_WORK6_OLD_TO_NEW_MATRIX_REPORT/V1';
const ID_FIELD = 'work6_old_to_new_matrix_report_id';

export function buildOldToNewMatrixReport(root, selected) {
  const spec = SEALED_LEDGERS.resolution_set_diff;
  const { record, digest, git_blob_oid } = readSealedLedger(root, spec);
  if (record.combined_ten_corpus_digest !== COMBINED_TEN_CORPUS_DIGEST) {
    throw new Work6Error(
      'LEDGER_DIGEST_MISMATCH',
      `combined_ten_corpus_digest ${record.combined_ten_corpus_digest} != ${COMBINED_TEN_CORPUS_DIGEST}`,
      spec.path,
    );
  }
  const sealedSeven = [...(record.sealed_seven ?? [])].sort((left, right) => (
    left.agreement_id < right.agreement_id ? -1 : 1
  ));
  const additiveThree = [...(record.additive_three ?? [])].sort((left, right) => (
    left.agreement_id < right.agreement_id ? -1 : 1
  ));
  const additiveReviewResidue = additiveThree.reduce((sum, row) => sum + (row.review_row_count ?? 0), 0);
  return {
    fileName: 'old-to-new-matrix-report.json',
    schema: SCHEMA,
    idField: ID_FIELD,
    record: {
      schema_version: SCHEMA,
      work: 'WORK6',
      report: 'OLD_TO_NEW_MATRIX',
      candidate_registration_id: selected.candidateRegistrationId,
      registration_path: selected.registrationPath,
      resolution_set_diff_binding: {
        path: spec.path,
        byte_length: spec.byte_length,
        sha256: digest,
        git_blob_oid,
      },
      combined_ten_corpus_digest: record.combined_ten_corpus_digest,
      unexpected_semantic_difference_count: record.unexpected_semantic_difference_count ?? null,
      sealed_seven: sealedSeven,
      additive_three: additiveThree,
      additive_review_row_residue: additiveReviewResidue,
      notes: [
        'Sealed-seven rows keep AUTHORISED_M6_COMPARISON_ENTRY_CORRECTION_NO_CLAIM_SEMANTIC_CHANGE where the artefact says so.',
        'Additive-three review_row_count is an honest REVIEW_ONLY residue and is not a gate failure.',
      ],
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runReport(process.argv, buildOldToNewMatrixReport);
}
