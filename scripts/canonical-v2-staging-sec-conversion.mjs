#!/usr/bin/env node

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const { canonicalJson, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { validateSecEdgarIntakeCapture } = require('../lib/canonical-v2/sec-edgar-intake-capture');
const {
  convertSecHtmlToCanonicalText,
  validateSecHtmlCanonicalTextConversion,
} = require('../lib/canonical-v2/sec-html-canonical-text');
const {
  verifySecHtmlCanonicalText,
} = require('../lib/canonical-v2/sec-html-canonical-text-verifier');
const {
  buildVerifiedSecSourceAdmission,
  validateVerifiedSecSourceAdmission,
} = require('../lib/canonical-v2/sec-source-admission');

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT = Object.freeze({ ref: 'sjumbznveyyiizhwvixj', name: 'deal-corpus-canonical-v2-staging' });
const EXPECTED = Object.freeze({
  retrieval_url_sha256: 'c089e4896d7d1486f7d86ebe5b854b0cf2d4afcd2afcbcf9b8483133435d4f2e',
  response_bytes_sha256: 'abba043018410d718c207e7d7a43c9567166f6a10c4c9a6b4b0c8c7761cd6b9d',
});

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function guardProject() {
  const ref = readFileSync(join(ROOT, 'supabase/.temp/project-ref'), 'utf8').trim();
  const linked = JSON.parse(readFileSync(join(ROOT, 'supabase/.temp/linked-project.json'), 'utf8'));
  if (ref !== PROJECT.ref || linked.ref !== PROJECT.ref || linked.name !== PROJECT.name) {
    throw new Error(`Refusing to run outside ${PROJECT.name} (${PROJECT.ref}).`);
  }
}

function safeDiagnostic(output) {
  const line = String(output || '').split('\n').find((item) => /(?:ERROR|DETAIL|HINT):/i.test(item));
  return line
    ? line.slice(line.search(/(?:ERROR|DETAIL|HINT):/i)).replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-database-url]')
    : 'Canonical staging conversion read failed.';
}

function readCapture() {
  const directory = mkdtempSync(join(tmpdir(), 'canonical-v2-sec-conversion-'));
  const file = join(directory, 'capture.sql');
  writeFileSync(file, `BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout='10000ms';
SELECT canonical_payload
FROM canonical_v2_staging.intake_capture_receipts
WHERE retrieval_url_sha256='${EXPECTED.retrieval_url_sha256}'
  AND response_bytes_sha256='${EXPECTED.response_bytes_sha256}'
LIMIT 2;
COMMIT;
`, { mode: 0o600 });
  try {
    const result = spawnSync('supabase', ['db', 'query', '--linked', '--file', file, '--output', 'json'], {
      cwd: ROOT, encoding: 'utf8', timeout: 20000, maxBuffer: 4 * 1024 * 1024,
    });
    if (result.status !== 0) throw new Error(safeDiagnostic(`${result.stderr}\n${result.stdout}`));
    const rows = JSON.parse(result.stdout)?.rows;
    if (!Array.isArray(rows) || rows.length !== 1 || !rows[0]?.canonical_payload) {
      throw new Error('The exact QXO SEC intake capture must exist exactly once.');
    }
    return rows[0].canonical_payload;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function byteOffsets(text, pattern) {
  const offsets = [];
  for (const match of text.matchAll(pattern)) {
    offsets.push(Buffer.byteLength(text.slice(0, match.index), 'utf8'));
  }
  return offsets;
}

function attest(conversion, verification, admissionBundle) {
  const capitalisationOffsets = byteOffsets(conversion.canonical_text, /\(b\)\s*Capital Structure\./g);
  const capitalisationEndOffsets = byteOffsets(
    conversion.canonical_text,
    /\(c\)\s*Corporate Authority and Approval\./g,
  );
  const bringdownOffsets = byteOffsets(
    conversion.canonical_text,
    /5\.2\s*Additional Conditions to the Obligations of Parent, Titanium Merger Sub and Forward Merger Sub\./g,
  );
  const bringdownEndOffsets = byteOffsets(
    conversion.canonical_text,
    /5\.3\s*Additional Conditions to the Obligations of the Company\./g,
  );
  if (capitalisationOffsets.length !== 2 || capitalisationEndOffsets.length < 1
    || bringdownOffsets.length !== 1 || bringdownEndOffsets.length !== 1
    || capitalisationEndOffsets[0] <= capitalisationOffsets[0]
    || bringdownEndOffsets[0] <= bringdownOffsets[0]) {
    throw new Error('QXO canonical section anchors are not uniquely accountable.');
  }
  const canonicalBytes = Buffer.from(conversion.canonical_text, 'utf8');
  const span = (start, end) => ({
    start,
    end,
    sha256: sha256Hex(canonicalBytes.subarray(start, end)),
  });
  return {
    schema_version: 'SEC_HTML_CANONICAL_TEXT_STAGING_ATTESTATION/V1',
    environment: 'staging',
    source_response_content_id: conversion.source_response_content_id,
    canonical_text_id: conversion.canonical_text_id,
    canonical_text_sha256: conversion.canonical_text_sha256,
    canonical_text_byte_length: conversion.canonical_text_byte_length,
    source_map_digest: conversion.source_map_digest,
    converter_digest: conversion.converter_digest,
    converter_config_digest: conversion.converter_config_digest,
    verification_manifest_id: verification.verification_manifest_id,
    verifier_digest: verification.verifier_digest,
    input_region_count: conversion.input_region_count,
    output_mapping_count: conversion.output_mapping_count,
    source_map_compressed_byte_length: Buffer.from(
      conversion.source_map_payload_base64,
      'base64',
    ).byteLength,
    conversion_payload_byte_length: Buffer.byteLength(JSON.stringify(conversion), 'utf8'),
    qxo_anchor_offsets: {
      capital_structure_all: capitalisationOffsets,
      section_5_2: bringdownOffsets[0],
    },
    qxo_governed_spans: {
      company_capitalisation: span(capitalisationOffsets[0], capitalisationEndOffsets[0]),
      buyer_bringdown: span(bringdownOffsets[0], bringdownEndOffsets[0]),
    },
    conversion_stage: conversion.conversion_stage,
    independent_verification_status: verification.verification_status,
    persisted_source_admission_status: verification.source_admission_status,
    prepared_source_admission: {
      admission_state: admissionBundle.source_admission_manifest.admission_state,
      immutable_source_document_id:
        admissionBundle.immutable_source_document.immutable_source_document_id,
      source_admission_manifest_id:
        admissionBundle.source_admission_manifest.source_admission_manifest_id,
      source_admission_preparation_receipt_id:
        admissionBundle.source_admission_preparation_receipt
          .source_admission_preparation_receipt_id,
      semantic_extraction_input_envelope_id:
        admissionBundle.semantic_extraction_input_envelope.semantic_extraction_input_envelope_id,
      persistence_status: 'NOT_WRITTEN',
    },
    database_transaction: 'READ_ONLY',
  };
}

if (process.argv.length !== 3 || process.argv[2] !== '--verify') {
  fail('Usage: node scripts/canonical-v2-staging-sec-conversion.mjs --verify');
}

try {
  guardProject();
  const capture = readCapture();
  validateSecEdgarIntakeCapture(capture);
  const conversion = convertSecHtmlToCanonicalText(capture);
  validateSecHtmlCanonicalTextConversion({ capture, conversion });
  const verification = verifySecHtmlCanonicalText({ capture, conversion });
  const admissionBundle = buildVerifiedSecSourceAdmission({ capture, conversion, verification });
  validateVerifiedSecSourceAdmission({ capture, conversion, verification, bundle: admissionBundle });
  process.stdout.write(`${canonicalJson(attest(conversion, verification, admissionBundle))}\n`);
} catch (error) {
  fail(error instanceof Error ? error.message : 'Canonical staging conversion failed.');
}
