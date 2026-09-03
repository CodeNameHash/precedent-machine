#!/usr/bin/env node
// Work 6 touched-rows report. Lists every known-loss member touched by a
// corrected rule (the sealed 244, not only the fixed-50 sample) and recounts
// sealed row-field-preservation members. No compiler rerun.

import { pathToFileURL } from 'node:url';

import {
  SEALED_LEDGERS,
  membersDigest,
  readSealedLedger,
  runReport,
  tally,
} from './stage-2y-structure-m7-v2-repair-work6-lib.mjs';

const SCHEMA = 'STAGE_2Y_M7_V2_REPAIR_WORK6_TOUCHED_ROWS_REPORT/V1';
const ID_FIELD = 'work6_touched_rows_report_id';

export function buildTouchedRowsReport(root, selected) {
  const lossSpec = SEALED_LEDGERS.known_loss_244;
  const rowSpec = SEALED_LEDGERS.row_field_preservation;
  const { record: loss, digest: lossDigest, git_blob_oid: lossOid } = readSealedLedger(root, lossSpec);
  const { record: rows, digest: rowDigest, git_blob_oid: rowOid } = readSealedLedger(root, rowSpec);
  return {
    fileName: 'touched-rows-report.json',
    schema: SCHEMA,
    idField: ID_FIELD,
    record: {
      schema_version: SCHEMA,
      work: 'WORK6',
      report: 'TOUCHED_ROWS',
      candidate_registration_id: selected.candidateRegistrationId,
      registration_path: selected.registrationPath,
      known_loss_ledger_binding: {
        path: lossSpec.path,
        byte_length: lossSpec.byte_length,
        sha256: lossDigest,
        git_blob_oid: lossOid,
      },
      row_field_preservation_binding: {
        path: rowSpec.path,
        byte_length: rowSpec.byte_length,
        sha256: rowDigest,
        git_blob_oid: rowOid,
      },
      touched_by_corrected_rule_count: loss.members.length,
      preserved_projection_row_count: rows.members.length,
      incomplete_rendered_count: rows.incomplete_rendered_count ?? null,
      known_loss_by_family: tally(loss.members.map((member) => member.family_key)),
      known_loss_by_deal: tally(loss.members.map((member) => member.deal)),
      preserved_rows_by_family: tally(rows.members.map((member) => member.family_key)),
      members_digest: membersDigest(loss.members),
      notes: [
        'Touched-by-corrected-rule rows are the sealed known-loss 244, not the fixed-50 sample.',
        'Projection-row preservation is recounted from the sealed comparison-entry-correction artefact.',
      ],
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runReport(process.argv, buildTouchedRowsReport);
}
