#!/usr/bin/env node
// Work 2 real-text run. --registration is mandatory. Writes analyses and
// attempt records under m7-v2-repair/v2-candidate/. Does not write
// control/ or receipts/. Zero model calls.

import {
  Work2RealTextError,
  analysisPathFor,
  attemptPathFor,
  compileAgreement,
  loadApprovedInputs,
  loadRegistration,
  loadSealedSets,
  parseArgv,
  reasonCodeCounts,
  repoRootFrom,
  sha256Hex,
  writeJson,
  REPORT_PATH,
} from './stage-2y-structure-m7-v2-repair-work2-real-text-lib.mjs';

function main(argv = process.argv) {
  const options = parseArgv(argv);
  const root = repoRootFrom(import.meta.url, options.repoRoot);
  const registration = loadRegistration(root, options.registrationPath);
  const sets = loadSealedSets(root, registration);
  const approved = loadApprovedInputs(root, registration);
  const analyses = [];
  const failures = [];
  for (const member of sets.analysisSet.record.members) {
    const agreementId = member.agreement_id;
    try {
      const compiled = compileAgreement({
        root, registration, sets, approved, agreementId,
      });
      writeJson(root, analysisPathFor(agreementId), compiled.analysis);
      writeJson(root, attemptPathFor(agreementId), {
        schema: 'WORK2_REAL_TEXT_ATTEMPT_RECORD/V1',
        agreement_id: agreementId,
        occurrences: compiled.attempts,
      });
      analyses.push(compiled.analysis);
    } catch (error) {
      failures.push({
        agreement_id: agreementId,
        code: error?.code ?? 'COMPILE',
        detail: String(error?.message ?? error),
      });
    }
  }
  const report = {
    schema: 'WORK2_REAL_TEXT_REPORT/V1',
    candidate_registration_id: registration.record.candidate_registration_id,
    registration_sha256: registration.sha256,
    lifecycle_state: registration.record.lifecycle_state,
    analysis_count: analyses.length,
    failures,
    reason_code_counts: reasonCodeCounts(analyses),
    governance_check: registration.record.lifecycle_state === 'CANDIDATE_PENDING_REVIEW'
      ? 'FAILED_EXPECTED'
      : failures.length === 0 ? 'PASS' : 'FAIL',
  };
  report.report_sha256 = sha256Hex(Buffer.from(`${JSON.stringify({
    ...report, report_sha256: undefined,
  }, null, 2)}\n`, 'utf8'));
  writeJson(root, REPORT_PATH, report);
  process.stdout.write(`${JSON.stringify({
    analysis_count: report.analysis_count,
    failures: report.failures.length,
    governance_check: report.governance_check,
    reason_code_counts: report.reason_code_counts,
  }, null, 2)}\n`);
  if (report.governance_check !== 'PASS' || failures.length > 0) {
    process.exitCode = 2;
  }
}

try {
  main();
} catch (error) {
  if (error instanceof Work2RealTextError) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 2;
  } else {
    throw error;
  }
}
