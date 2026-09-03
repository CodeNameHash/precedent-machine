#!/usr/bin/env node
// Work 6 historical-limbs-69 report. Re-reads the sealed 69-member Red Hat
// limb ledger and recounts dispositions. The one RESIDUAL_QUOTE_UNVERIFIED
// member is reported and is never resolved here. No overlay. No Work 2/3 rerun.

import { pathToFileURL } from 'node:url';

import {
  SEALED_LEDGERS,
  membersDigest,
  readSealedLedger,
  runReport,
  tally,
} from './stage-2y-structure-m7-v2-repair-work6-lib.mjs';

const SCHEMA = 'STAGE_2Y_M7_V2_REPAIR_WORK6_HISTORICAL_LIMBS_69_REPORT/V1';
const ID_FIELD = 'work6_historical_limbs_69_report_id';

export function buildHistoricalLimbs69Report(root, selected) {
  const spec = SEALED_LEDGERS.historical_limbs_69;
  const { record, digest } = readSealedLedger(root, spec);
  const dispositions = tally(record.members.map((member) => member.disposition));
  const residual = record.members
    .filter((member) => member.disposition === 'RESIDUAL_QUOTE_UNVERIFIED')
    .map((member) => ({
      red_hat_limb_member_id: member.red_hat_limb_member_id,
      section_reference: member.section_reference ?? null,
      limb_path: member.limb_path ?? null,
      disposition: member.disposition,
      resolution: 'REPORTED_NOT_RESOLVED',
    }))
    .sort((left, right) => (
      left.red_hat_limb_member_id < right.red_hat_limb_member_id ? -1 : 1
    ));
  return {
    fileName: 'historical-limbs-69-report.json',
    schema: SCHEMA,
    idField: ID_FIELD,
    record: {
      schema_version: SCHEMA,
      work: 'WORK6',
      report: 'HISTORICAL_LIMBS_69',
      candidate_registration_id: selected.candidateRegistrationId,
      registration_path: selected.registrationPath,
      ledger_binding: {
        path: spec.path,
        byte_length: spec.byte_length,
        sha256: digest,
        schema_version: spec.schema_version,
        ledger_id: record.red_hat_limb_ledger_id,
      },
      expected_member_count: spec.expected_member_count,
      observed_member_count: record.members.length,
      members_digest: membersDigest(record.members),
      declared_counts: record.counts ?? null,
      disposition_counts: dispositions,
      residual_quote_unverified: residual,
      notes: [
        'The RESIDUAL_QUOTE_UNVERIFIED member is reported as such and is not resolved by Work 6.',
      ],
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runReport(process.argv, buildHistoricalLimbs69Report);
}
