#!/usr/bin/env node
// Work 6 ten-agreement calibration. Recounts the sealed ten-agreement
// analysis set and the known-loss-244 members by deal. TopBuild is reported
// separately. Does not re-run Work 2 or Work 3.

import { pathToFileURL } from 'node:url';

import {
  COMBINED_TEN_CORPUS_DIGEST,
  SEALED_LEDGERS,
  Work6Error,
  membersDigest,
  readSealedLedger,
  runReport,
  tally,
} from './stage-2y-structure-m7-v2-repair-work6-lib.mjs';

const SCHEMA = 'STAGE_2Y_M7_V2_REPAIR_WORK6_TEN_AGREEMENT_CALIBRATION_REPORT/V1';
const ID_FIELD = 'work6_ten_agreement_calibration_report_id';

export function buildTenAgreementCalibrationReport(root, selected) {
  const setSpec = SEALED_LEDGERS.ten_agreement_set;
  const lossSpec = SEALED_LEDGERS.known_loss_244;
  const { record: analysisSet, digest: setDigest } = readSealedLedger(root, setSpec);
  const { record: loss, digest: lossDigest } = readSealedLedger(root, lossSpec);
  if (loss.combined_ten_corpus_digest !== COMBINED_TEN_CORPUS_DIGEST) {
    throw new Work6Error(
      'LEDGER_DIGEST_MISMATCH',
      `combined_ten_corpus_digest ${loss.combined_ten_corpus_digest} != ${COMBINED_TEN_CORPUS_DIGEST}`,
      lossSpec.path,
    );
  }
  const dealCounts = tally(loss.members.map((member) => member.deal));
  const topbuild = loss.members
    .filter((member) => member.deal === 'topbuild')
    .map((member) => member.known_loss_member_id)
    .sort();
  return {
    fileName: 'ten-agreement-calibration-report.json',
    schema: SCHEMA,
    idField: ID_FIELD,
    record: {
      schema_version: SCHEMA,
      work: 'WORK6',
      report: 'TEN_AGREEMENT_CALIBRATION',
      candidate_registration_id: selected.candidateRegistrationId,
      registration_path: selected.registrationPath,
      analysis_set_binding: {
        path: setSpec.path,
        byte_length: setSpec.byte_length,
        sha256: setDigest,
        schema_version: setSpec.schema_version,
        agreement_analysis_set_id: analysisSet.agreement_analysis_set_id,
      },
      known_loss_ledger_binding: {
        path: lossSpec.path,
        byte_length: lossSpec.byte_length,
        sha256: lossDigest,
        schema_version: lossSpec.schema_version,
      },
      combined_ten_corpus_digest: loss.combined_ten_corpus_digest,
      agreement_ids: analysisSet.members.map((member) => member.agreement_id).sort(),
      agreement_count: analysisSet.members.length,
      known_loss_deal_counts: dealCounts,
      topbuild: {
        deal: 'topbuild',
        known_loss_member_count: topbuild.length,
        known_loss_member_ids: topbuild,
        notes: [
          'TopBuild is reported separately: largest known-loss contribution on the sealed 244, and zero cards in the fixed human review.',
        ],
      },
      members_digest: membersDigest(analysisSet.members),
      notes: [
        'Ten agreements are the sealed Work 3 analysis-set members. Calibration recounts sealed known-loss members by deal; no compiler rerun.',
      ],
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runReport(process.argv, buildTenAgreementCalibrationReport);
}
