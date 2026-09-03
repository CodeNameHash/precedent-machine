#!/usr/bin/env node
// Work 6 additive-three calibration. Recounts the sealed additive open-world
// ledger (AbbVie/Landos, Lilly/Verve, Rocket/Redfin). Does not invent
// calibration beyond those members and does not re-run Work 2 or Work 3.

import { pathToFileURL } from 'node:url';

import {
  SEALED_LEDGERS,
  membersDigest,
  readSealedLedger,
  runReport,
  tally,
} from './stage-2y-structure-m7-v2-repair-work6-lib.mjs';

const SCHEMA = 'STAGE_2Y_M7_V2_REPAIR_WORK6_ADDITIVE_THREE_CALIBRATION_REPORT/V1';
const ID_FIELD = 'work6_additive_three_calibration_report_id';

export function buildAdditiveThreeCalibrationReport(root, selected) {
  const spec = SEALED_LEDGERS.additive_three;
  const { record, digest } = readSealedLedger(root, spec);
  const byDeal = tally(record.members.map((member) => member.candidate_key));
  const byFamily = tally(record.members.map((member) => member.family_key));
  const byState = tally(record.members.map((member) => member.baseline_state));
  return {
    fileName: 'additive-three-calibration-report.json',
    schema: SCHEMA,
    idField: ID_FIELD,
    record: {
      schema_version: SCHEMA,
      work: 'WORK6',
      report: 'ADDITIVE_THREE_CALIBRATION',
      candidate_registration_id: selected.candidateRegistrationId,
      registration_path: selected.registrationPath,
      ledger_binding: {
        path: spec.path,
        byte_length: spec.byte_length,
        sha256: digest,
        schema_version: spec.schema_version,
        ledger_id: record.ledger_id,
      },
      expected_member_count: spec.expected_member_count,
      observed_member_count: record.members.length,
      members_digest: membersDigest(record.members),
      declared_total: record.total ?? null,
      candidate_key_counts: byDeal,
      family_counts: byFamily,
      baseline_state_counts: byState,
      members: record.members
        .map((member) => ({
          candidate_key: member.candidate_key,
          family_key: member.family_key,
          baseline_state: member.baseline_state,
          open_world_occurrence_id: member.open_world_occurrence_id,
        }))
        .sort((left, right) => (
          left.open_world_occurrence_id < right.open_world_occurrence_id ? -1 : 1
        )),
      notes: [
        'Additive-three members are AbbVie/Landos, Lilly/Verve and Rocket/Redfin from the sealed comparison-entry-correction ledger.',
        'This report recounts those members only. It does not add calibration beyond the sealed set.',
      ],
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runReport(process.argv, buildAdditiveThreeCalibrationReport);
}
