#!/usr/bin/env node
// Work 6 parser-ambiguities-23 report. Re-reads the sealed 23-member M2
// inline-ambiguity ledger, recounts reviewed dispositions, and reports
// unresolved vs uniquely resolved cases. Does not create an overlay.

import { pathToFileURL } from 'node:url';

import {
  SEALED_LEDGERS,
  membersDigest,
  readSealedLedger,
  runReport,
  tally,
} from './stage-2y-structure-m7-v2-repair-work6-lib.mjs';

const SCHEMA = 'STAGE_2Y_M7_V2_REPAIR_WORK6_PARSER_AMBIGUITIES_23_REPORT/V1';
const ID_FIELD = 'work6_parser_ambiguities_23_report_id';

export function buildParserAmbiguities23Report(root, selected) {
  const spec = SEALED_LEDGERS.parser_ambiguities_23;
  const { record, digest } = readSealedLedger(root, spec);
  const reviewed = tally(record.members.map((member) => member.reviewed_disposition));
  const reasons = tally(record.members.map((member) => member.parser_reason));
  const members = record.members
    .map((member) => ({
      ambiguity_id: member.ambiguity_id,
      agreement_id: member.agreement_id,
      reviewed_disposition: member.reviewed_disposition,
      parser_reason: member.parser_reason,
      competing_structure_count: Array.isArray(member.competing_structures)
        ? member.competing_structures.length
        : 0,
      overlay_created: false,
    }))
    .sort((left, right) => (left.ambiguity_id < right.ambiguity_id ? -1 : 1));
  return {
    fileName: 'parser-ambiguities-23-report.json',
    schema: SCHEMA,
    idField: ID_FIELD,
    record: {
      schema_version: SCHEMA,
      work: 'WORK6',
      report: 'PARSER_AMBIGUITIES_23',
      candidate_registration_id: selected.candidateRegistrationId,
      registration_path: selected.registrationPath,
      ledger_binding: {
        path: spec.path,
        byte_length: spec.byte_length,
        sha256: digest,
        schema_version: spec.schema_version,
        ledger_id: record.m2_inline_ambiguity_ledger_id,
      },
      expected_member_count: spec.expected_member_count,
      observed_member_count: record.members.length,
      members_digest: membersDigest(record.members),
      declared_counts: record.counts ?? null,
      reviewed_disposition_counts: reviewed,
      parser_reason_counts: reasons,
      members,
      overlays_created: 0,
      notes: [
        'Unresolved or uniquely resolved cases are reported from the sealed members.',
        'No overlay was created; none is authorised from this report.',
      ],
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runReport(process.argv, buildParserAmbiguities23Report);
}
