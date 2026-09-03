#!/usr/bin/env node
// Work 6 unfamiliar-drafting report. Recounts sealed claim-closure diagnostic
// codes and maps each member to complete, incomplete, or blocked. Does not
// invent a new drafting class.

import { pathToFileURL } from 'node:url';

import {
  SEALED_LEDGERS,
  membersDigest,
  readSealedLedger,
  runReport,
  tally,
} from './stage-2y-structure-m7-v2-repair-work6-lib.mjs';

const SCHEMA = 'STAGE_2Y_M7_V2_REPAIR_WORK6_UNFAMILIAR_DRAFTING_REPORT/V1';
const ID_FIELD = 'work6_unfamiliar_drafting_report_id';

function draftingLabel(member) {
  if (member.validation_state === 'COMPLETE') return 'complete';
  if (member.validation_state === 'MISSING_REQUIRED_ROLE') return 'incomplete';
  return 'ambiguous';
}

export function buildUnfamiliarDraftingReport(root, selected) {
  const spec = SEALED_LEDGERS.claim_closure;
  const { record, digest, git_blob_oid } = readSealedLedger(root, spec);
  const patterned = record.members.filter((member) => Array.isArray(member.diagnostic_codes) && member.diagnostic_codes.length > 0);
  const codes = [];
  for (const member of patterned) {
    for (const code of member.diagnostic_codes) codes.push(code);
  }
  return {
    fileName: 'unfamiliar-drafting-report.json',
    schema: SCHEMA,
    idField: ID_FIELD,
    record: {
      schema_version: SCHEMA,
      work: 'WORK6',
      report: 'UNFAMILIAR_DRAFTING',
      candidate_registration_id: selected.candidateRegistrationId,
      registration_path: selected.registrationPath,
      claim_closure_binding: {
        path: spec.path,
        byte_length: spec.byte_length,
        sha256: digest,
        git_blob_oid,
      },
      observed_member_count: record.members.length,
      patterned_member_count: patterned.length,
      validation_state_counts: tally(record.members.map((member) => member.validation_state)),
      drafting_label_counts: tally(record.members.map(draftingLabel)),
      diagnostic_code_counts: tally(codes),
      members_digest: membersDigest(record.members),
      notes: [
        'Labels are complete / incomplete / ambiguous from sealed validation_state only.',
        'No approved-no-comparison overlay is created from these diagnostics.',
      ],
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runReport(process.argv, buildUnfamiliarDraftingReport);
}
