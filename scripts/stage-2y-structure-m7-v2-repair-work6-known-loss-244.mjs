#!/usr/bin/env node
// Work 6 known-loss-244 report. Re-reads the sealed 244-member ledger, recounts
// dispositions from the members, and binds the selected registration. Does not
// re-run Work 2 or Work 3. Writes only under m7-v2-repair/work6/.

import { pathToFileURL } from 'node:url';

import {
  SEALED_LEDGERS,
  membersDigest,
  readSealedLedger,
  runReport,
  tally,
} from './stage-2y-structure-m7-v2-repair-work6-lib.mjs';

const SCHEMA = 'STAGE_2Y_M7_V2_REPAIR_WORK6_KNOWN_LOSS_244_REPORT/V1';
const ID_FIELD = 'work6_known_loss_244_report_id';

export function buildKnownLoss244Report(root, selected) {
  const spec = SEALED_LEDGERS.known_loss_244;
  const { record, digest } = readSealedLedger(root, spec);
  const dispositions = tally(record.members.map((member) => member.disposition));
  const families = tally(record.members.map((member) => member.family_key));
  const deals = tally(record.members.map((member) => member.deal));
  return {
    fileName: 'known-loss-244-report.json',
    schema: SCHEMA,
    idField: ID_FIELD,
    record: {
      schema_version: SCHEMA,
      work: 'WORK6',
      report: 'KNOWN_LOSS_244',
      candidate_registration_id: selected.candidateRegistrationId,
      registration_path: selected.registrationPath,
      ledger_binding: {
        path: spec.path,
        byte_length: spec.byte_length,
        sha256: digest,
        schema_version: spec.schema_version,
        ledger_id: record.known_loss_ledger_id,
      },
      expected_member_count: spec.expected_member_count,
      observed_member_count: record.members.length,
      members_digest: membersDigest(record.members),
      declared_counts: record.counts ?? null,
      disposition_counts: dispositions,
      family_counts: families,
      deal_counts: deals,
      member_ids: record.members.map((member) => member.known_loss_member_id).sort(),
      notes: ['All 244 members recounted from the sealed ledger. No overlay created.'],
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runReport(process.argv, buildKnownLoss244Report);
}
