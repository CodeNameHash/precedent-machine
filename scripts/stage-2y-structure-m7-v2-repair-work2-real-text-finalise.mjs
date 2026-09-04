#!/usr/bin/env node
// Work 2 real-text finalise. Recomputes receipt counts from bound files.
// Does not write the sealed receipts/ path unless --write-receipt is set
// (Ext does not seal receipts).

import {
  RECEIPT_PATH,
  REPORT_PATH,
  Work2RealTextError,
  analysisPathFor,
  buildReceipt,
  fileBinding,
  loadRegistration,
  loadSealedSets,
  parseArgv,
  repoRootFrom,
  writeJson,
} from './stage-2y-structure-m7-v2-repair-work2-real-text-lib.mjs';

function main() {
  const options = parseArgv(process.argv);
  const root = repoRootFrom(import.meta.url, options.repoRoot);
  const registration = loadRegistration(root, options.registrationPath);
  const sets = loadSealedSets(root, registration);
  const report = fileBinding(root, REPORT_PATH).record;
  const analyses = sets.analysisSet.record.members.map((member) =>
    fileBinding(root, analysisPathFor(member.agreement_id)).record);
  const receipt = buildReceipt({ analyses, report, registration });
  if (options.writeReceipt) writeJson(root, RECEIPT_PATH, receipt);
  process.stdout.write(`${JSON.stringify({
    work2_real_text_receipt_id: receipt.work2_real_text_receipt_id,
    analysis_count: receipt.analysis_count,
    wrote_receipt: options.writeReceipt === true,
  }, null, 2)}\n`);
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
