#!/usr/bin/env node
// Derives the product-facing selection input for the ten sealed agreement
// IDs, purely from committed evidence files. No network, no model calls.
//
// Sources (all under REPO_ROOT):
//   1. control/m7-v2-repair-work3-agreement-analysis-set.json
//        -> the sealed ten agreement_id values (members[].agreement_id)
//   2. control/cohort-agreements.json
//        -> seven of the ten, plus the first source-reference.json in each
//           entry's source_chain_paths[]
//   3. receipts/stage-2y-structure-m7-source-admission.json
//        -> the other three, as candidates[]
//
// Run from any cwd: node docs/codex-program/handoffs/deal-terms/tools/derive-sealed-ten-selection.mjs

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Repository root: five levels above docs/codex-program/handoffs/deal-terms/tools/.
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "..");

function readJson(relPath) {
  const abs = join(REPO_ROOT, relPath);
  return JSON.parse(readFileSync(abs, "utf8"));
}

function assert(cond, message) {
  if (!cond) {
    throw new Error("ASSERTION FAILED: " + message);
  }
}

// --- SEC URL decomposition -------------------------------------------------
// https://www.sec.gov/Archives/edgar/data/<filer_cik>/<accession_18_digits>/<document_name>
const SEC_URL_RE =
  /^https:\/\/www\.sec\.gov\/Archives\/edgar\/data\/(\d{1,10})\/(\d{18})\/([^/]+)$/;

function decomposeSecUrl(url) {
  const m = SEC_URL_RE.exec(url);
  assert(m, `URL does not match the expected EDGAR Archives shape: ${url}`);
  const [, cikRaw, accessionRaw, documentName] = m;
  const filerCik = cikRaw.padStart(10, "0");
  const accessionNumber =
    accessionRaw.slice(0, 10) +
    "-" +
    accessionRaw.slice(10, 12) +
    "-" +
    accessionRaw.slice(12, 18);
  return { filerCik, accessionNumber, sec_document_name: documentName };
}

// --- 1. The sealed ten -------------------------------------------------
const sealedSet = readJson(
  "evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work3-agreement-analysis-set.json"
);
assert(
  sealedSet.schema_version === "AGREEMENT_ANALYSIS_SET/V1",
  `unexpected schema_version on sealed set: ${sealedSet.schema_version}`
);
const sealedTen = sealedSet.members.map((m) => m.agreement_id);
assert(sealedTen.length === 10, `expected 10 sealed members, got ${sealedTen.length}`);
assert(
  new Set(sealedTen).size === 10,
  "sealed ten agreement_id values are not unique"
);

// --- 2. Seven from cohort-agreements.json -------------------------------
const cohort = readJson(
  "evidence/canonical-v2/stage-2y-structure-migration/control/cohort-agreements.json"
);
assert(
  cohort.schema_version === "STAGE_2Y_STRUCTURE_COHORT_AGREEMENTS/V1",
  `unexpected schema_version on cohort-agreements.json: ${cohort.schema_version}`
);
assert(
  cohort.agreements.length === 7,
  `expected 7 cohort agreements, got ${cohort.agreements.length}`
);

const cohortRows = cohort.agreements.map((entry) => {
  assert(
    Array.isArray(entry.source_chain_paths) && entry.source_chain_paths.length > 0,
    `cohort entry ${entry.agreement_id} has no source_chain_paths`
  );
  const firstPath = entry.source_chain_paths[0];
  const sourceRef = readJson(firstPath);
  assert(
    sourceRef.schema_version === "GENERAL_EXTRACTION_RUN_SOURCE_REFERENCE/V1",
    `unexpected schema_version on ${firstPath}: ${sourceRef.schema_version}`
  );

  const capturedId =
    sourceRef.admitted_source_capture_inputs &&
    sourceRef.admitted_source_capture_inputs.immutable_source_document_id;
  assert(
    capturedId === entry.agreement_id,
    `${firstPath}: admitted_source_capture_inputs.immutable_source_document_id ` +
      `(${capturedId}) does not equal cohort agreement_id (${entry.agreement_id})`
  );

  const { filerCik, accessionNumber, sec_document_name } = decomposeSecUrl(
    sourceRef.retrieval_url
  );

  return {
    producer_deal_key: entry.deal,
    agreement_id: entry.agreement_id,
    filer_cik: filerCik,
    accession_number: accessionNumber,
    sec_document_name,
    document_role: "MERGER_AGREEMENT_EXHIBIT_2_1",
    canonical_text_sha256: entry.canonical_text_sha256,
    canonical_text_byte_length: entry.canonical_text_byte_length,
    raw_bytes_sha256: sourceRef.raw_bytes_sha256,
    raw_bytes_length: sourceRef.raw_bytes_length,
    amendment_status: "NOT_EXAMINED",
    _source: firstPath,
  };
});

// Cross-check the source-reference bytes/hashes against cohort-agreements.json
// itself (both describe the same admitted document).
for (const entry of cohort.agreements) {
  const row = cohortRows.find((r) => r.agreement_id === entry.agreement_id);
  assert(
    row.canonical_text_sha256 === entry.canonical_text_sha256,
    `canonical_text_sha256 mismatch for ${entry.agreement_id}`
  );
  assert(
    row.canonical_text_byte_length === entry.canonical_text_byte_length,
    `canonical_text_byte_length mismatch for ${entry.agreement_id}`
  );
}

// --- 3. Three from the M7 source-admission receipt ----------------------
const receipt = readJson(
  "evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-source-admission.json"
);
assert(
  receipt.schema_version === "STAGE_2Y_M7_SOURCE_ADMISSION_RECEIPT/V1",
  `unexpected schema_version on source-admission receipt: ${receipt.schema_version}`
);
assert(
  receipt.status === "PASS",
  `source-admission receipt status is not PASS: ${receipt.status}`
);
assert(
  receipt.candidates.length === 3,
  `expected 3 receipt candidates, got ${receipt.candidates.length}`
);

const receiptRows = receipt.candidates.map((c) => {
  assert(
    typeof c.immutable_source_document_id === "string" &&
      /^[0-9a-f]{64}$/.test(c.immutable_source_document_id),
    `candidate ${c.candidate_key} has a malformed immutable_source_document_id`
  );
  // For a receipt candidate the agreement_id IS immutable_source_document_id
  // (no separate agreement_id field exists in this record); the assertion
  // required here is that this identity is well-formed and, below, that the
  // union of all ten equals the sealed set exactly.
  const agreementId = c.immutable_source_document_id;

  const { filerCik, accessionNumber, sec_document_name } = decomposeSecUrl(
    c.final_url
  );

  return {
    producer_deal_key: c.governed_deal_key,
    agreement_id: agreementId,
    filer_cik: filerCik,
    accession_number: accessionNumber,
    sec_document_name,
    document_role: "MERGER_AGREEMENT_EXHIBIT_2_1",
    canonical_text_sha256: c.canonical_text_sha256,
    canonical_text_byte_length: c.canonical_text_byte_length,
    raw_bytes_sha256: c.response_bytes_sha256,
    raw_bytes_length: c.response_byte_length,
    amendment_status: "NOT_EXAMINED",
    _source:
      "evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-source-admission.json",
  };
});

// --- Union assertion: the ten sealed IDs == the seven plus three ---------
const derivedIds = [...cohortRows, ...receiptRows].map((r) => r.agreement_id);
assert(derivedIds.length === 10, `expected 10 derived rows, got ${derivedIds.length}`);
assert(new Set(derivedIds).size === 10, "derived agreement_id values are not unique");

const sealedSorted = [...sealedTen].sort();
const derivedSorted = [...derivedIds].sort();
assert(
  JSON.stringify(sealedSorted) === JSON.stringify(derivedSorted),
  "the seven cohort rows plus the three receipt rows are not exactly the sealed ten:\n" +
    `sealed:  ${JSON.stringify(sealedSorted)}\n` +
    `derived: ${JSON.stringify(derivedSorted)}`
);

// --- Emit -----------------------------------------------------------------
const allRows = [...cohortRows, ...receiptRows]
  .map(({ _source, ...rest }) => rest) // drop internal bookkeeping field
  .sort((a, b) => (a.agreement_id < b.agreement_id ? -1 : 1));

console.log(JSON.stringify(allRows, null, 2));
