#!/usr/bin/env node
// Work 2 real-text validate. Re-derives receipt counts and applies the
// real-agreement receipt guard. Names the agreement on FAIL.

import {
  REPORT_PATH,
  Work2RealTextError,
  buildReceipt,
  fileBinding,
  loadRegistration,
  loadSealedSets,
  parseArgv,
  repoRootFrom,
  validateOutputs,
} from './stage-2y-structure-m7-v2-repair-work2-real-text-lib.mjs';

function main() {
  const options = parseArgv(process.argv);
  const root = repoRootFrom(import.meta.url, options.repoRoot);
  const registration = loadRegistration(root, options.registrationPath);
  const sets = loadSealedSets(root, registration);
  const report = fileBinding(root, REPORT_PATH).record;
  const checked = validateOutputs({ root, registration, sets });
  const receipt = checked.failures.length === 0
    ? buildReceipt({ analyses: checked.analyses, report, registration })
    : null;
  const first = checked.failures[0];
  process.stdout.write(`${JSON.stringify({
    status: first ? 'FAIL' : 'PASS',
    agreement_id: first?.agreement_id ?? null,
    code: first?.code ?? null,
    failure_count: checked.failures.length,
    receipt_id: receipt?.work2_real_text_receipt_id ?? null,
  }, null, 2)}\n`);
  if (first) process.exitCode = 2;
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
