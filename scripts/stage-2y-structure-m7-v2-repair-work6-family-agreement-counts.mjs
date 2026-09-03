#!/usr/bin/env node
// Work 6 family-and-agreement counts. Recounts sealed claim-closure,
// source-coverage and output-ownership members. Reports only fields those
// artefacts actually carry.

import { pathToFileURL } from 'node:url';

import {
  SEALED_LEDGERS,
  membersDigest,
  readSealedLedger,
  runReport,
  tally,
} from './stage-2y-structure-m7-v2-repair-work6-lib.mjs';

const SCHEMA = 'STAGE_2Y_M7_V2_REPAIR_WORK6_FAMILY_AGREEMENT_COUNTS_REPORT/V1';
const ID_FIELD = 'work6_family_agreement_counts_report_id';

export function buildFamilyAgreementCountsReport(root, selected) {
  const closureSpec = SEALED_LEDGERS.claim_closure;
  const coverageSpec = SEALED_LEDGERS.source_coverage;
  const ownerSpec = SEALED_LEDGERS.output_ownership;
  const closure = readSealedLedger(root, closureSpec);
  const coverage = readSealedLedger(root, coverageSpec);
  const ownership = readSealedLedger(root, ownerSpec);
  const byFamilyAgreement = {};
  for (const member of closure.record.members) {
    const key = `${member.family_key}::${member.agreement_id}`;
    if (!byFamilyAgreement[key]) {
      byFamilyAgreement[key] = {
        family_key: member.family_key,
        agreement_id: member.agreement_id,
        input_occurrences: 0,
        complete: 0,
        incomplete: 0,
        blocked: 0,
      };
    }
    byFamilyAgreement[key].input_occurrences += 1;
    if (member.validation_state === 'COMPLETE') byFamilyAgreement[key].complete += 1;
    else byFamilyAgreement[key].incomplete += 1;
    if (member.projection_eligibility === 'BLOCKED') byFamilyAgreement[key].blocked += 1;
  }
  return {
    fileName: 'family-agreement-counts-report.json',
    schema: SCHEMA,
    idField: ID_FIELD,
    record: {
      schema_version: SCHEMA,
      work: 'WORK6',
      report: 'FAMILY_AGREEMENT_COUNTS',
      candidate_registration_id: selected.candidateRegistrationId,
      registration_path: selected.registrationPath,
      claim_closure_binding: {
        path: closureSpec.path,
        byte_length: closureSpec.byte_length,
        sha256: closure.digest,
        git_blob_oid: closure.git_blob_oid,
      },
      source_coverage_binding: {
        path: coverageSpec.path,
        byte_length: coverageSpec.byte_length,
        sha256: coverage.digest,
        git_blob_oid: coverage.git_blob_oid,
      },
      output_ownership_binding: {
        path: ownerSpec.path,
        byte_length: ownerSpec.byte_length,
        sha256: ownership.digest,
        git_blob_oid: ownership.git_blob_oid,
      },
      family_counts: tally(closure.record.members.map((member) => member.family_key)),
      validation_state_counts: tally(closure.record.members.map((member) => member.validation_state)),
      linked_consumer_policy_counts: tally(ownership.record.members.map((member) => member.linked_consumer_policy)),
      agreements: coverage.record.members
        .map((member) => ({
          agreement_id: member.agreement_id,
          compound_proposition_count: member.compound_proposition_count,
          normal_row_count: member.normal_row_count,
          review_row_count: member.review_row_count,
        }))
        .sort((left, right) => (left.agreement_id < right.agreement_id ? -1 : 1)),
      family_agreement_counts: Object.values(byFamilyAgreement).sort((left, right) => {
        if (left.family_key !== right.family_key) return left.family_key < right.family_key ? -1 : 1;
        return left.agreement_id < right.agreement_id ? -1 : 1;
      }),
      members_digest: membersDigest(closure.record.members),
      notes: [
        'Approved-limited, no-comparison and no-output columns are absent from these sealed members and are not invented.',
        'Linked consumers are the sealed ONE_OWNER_WITH_LINKED_CONSUMERS policy counts.',
      ],
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runReport(process.argv, buildFamilyAgreementCountsReport);
}
