#!/usr/bin/env node

import https from 'node:https';
import {
  existsSync, mkdirSync, readFileSync, writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { canonicalJson, contentId, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { decodeSecHtmlCanonicalTextSourceMap } = require('../lib/canonical-v2/sec-html-canonical-text');
const { buildAdmission, fetchExactCandidate } = require('../lib/canonical-v2/m7-source-admission');

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const AUTHORITY_PATH = resolve(ROOT, 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-generalisation-authority.json');
const OUTPUT_ROOT = resolve(ROOT, 'evidence/canonical-v2/stage-2y-structure-migration/source/m7-generalisation');
const RECEIPT_PATH = resolve(ROOT, 'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-source-admission.json');

function fail(code, detail) { throw new Error(`M7_SOURCE_ADMIT_${code}: ${detail}`); }
function repoPath(path) { return relative(ROOT, path).split('\\').join('/'); }
function binding(path) {
  const bytes = readFileSync(path);
  return { path: repoPath(path), byte_length: bytes.length, sha256: sha256Hex(bytes) };
}
function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')); }
function writeCanonical(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, Buffer.from(canonicalJson(value), 'utf8'));
}
function parseArgs(argv) {
  if (argv.length !== 6 || argv[2] !== '--authority' || argv[4] !== '--output-root') {
    fail('ARGUMENTS', 'requires only --authority and --output-root');
  }
  if (resolve(argv[3]) !== AUTHORITY_PATH || resolve(argv[5]) !== OUTPUT_ROOT) fail('PATH', 'path drift');
}
function validateAuthority(authority) {
  const unsigned = structuredClone(authority); delete unsigned.authority_digest;
  if (authority.schema_version !== 'STAGE_2Y_M7_GENERALISATION_AUTHORITY/V1'
    || authority.authority_state !== 'BEN_AUTHORISED_REPORT_ONLY'
    || authority.authority_digest !== contentId(authority.schema_version, unsigned)
    || authority.candidates.length !== 3
    || authority.blind_sample_policy.sample_size !== 50
    || authority.prior_failed_attempt_network_reads !== 3
    || authority.limits.network_read_count !== 6) fail('AUTHORITY', 'authority invalid');
  for (const item of authority.input_bindings) {
    const actual = binding(resolve(ROOT, item.path));
    if (canonicalJson(actual) !== canonicalJson(item)) fail('INPUT_DRIFT', item.path);
  }
}

export async function run({ httpsGet = https.get } = {}) {
  const authority = readJson(AUTHORITY_PATH);
  validateAuthority(authority);
  if (existsSync(RECEIPT_PATH)) fail('ALREADY_RUN', repoPath(RECEIPT_PATH));
  const candidates = [];
  const outputs = [];
  for (const candidate of authority.candidates) {
    const fetched = await fetchExactCandidate(candidate, {
      httpsGet,
      now: () => authority.approved_at,
    });
    const built = buildAdmission(candidate, fetched, authority.approved_at);
    const candidateRoot = resolve(OUTPUT_ROOT, candidate.candidate_key);
    const rawPath = resolve(candidateRoot, 'response.html');
    const canonicalPath = resolve(candidateRoot, 'canonical.txt');
    const sourceMapPath = resolve(candidateRoot, 'source-map.json');
    const admissionPath = resolve(candidateRoot, 'admission.json');
    mkdirSync(candidateRoot, { recursive: true });
    writeFileSync(rawPath, fetched.bytes);
    writeFileSync(canonicalPath, Buffer.from(built.conversion.canonical_text, 'utf8'));
    writeCanonical(sourceMapPath, decodeSecHtmlCanonicalTextSourceMap(built.conversion));
    writeCanonical(admissionPath, {
      candidate,
      capture: built.capture,
      conversion: built.conversion,
      verification: built.verification,
      bundle: built.bundle,
    });
    const candidatePaths = [rawPath, canonicalPath, sourceMapPath, admissionPath];
    if (candidate.historical_fixture_equivalence) {
      const historicalPath = resolve(ROOT, candidate.historical_fixture_equivalence.path);
      const historical = binding(historicalPath);
      if (historical.byte_length !== candidate.historical_fixture_equivalence.byte_length
        || historical.sha256 !== candidate.historical_fixture_equivalence.sha256) {
        fail('HISTORICAL_FIXTURE_DRIFT', candidate.candidate_key);
      }
      const normalise = (text) => text.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
      if (normalise(readFileSync(historicalPath, 'utf8'))
        !== normalise(built.conversion.canonical_text)) {
        fail('HISTORICAL_FIXTURE_NOT_EQUIVALENT', candidate.candidate_key);
      }
      const equivalencePath = resolve(candidateRoot, 'historical-equivalence.json');
      writeCanonical(equivalencePath, {
        schema_version: 'STAGE_2Y_M7_SOURCE_EQUIVALENCE/V1',
        candidate_key: candidate.candidate_key,
        current_canonical_text_sha256: built.conversion.canonical_text_sha256,
        historical_fixture_binding: historical,
        comparison: 'EXACT_AFTER_UNICODE_WHITESPACE_NORMALISATION',
        result: 'PASS',
      });
      candidatePaths.push(equivalencePath);
    }
    const candidateBindings = candidatePaths.map(binding);
    outputs.push(...candidateBindings);
    candidates.push({
      candidate_key: candidate.candidate_key,
      governed_deal_key: candidate.governed_deal_key,
      requested_url: candidate.url,
      final_url: candidate.url,
      redirect_count: 0,
      http_status: 200,
      network_read_status: 'PERFORMED',
      response_bytes_sha256: built.capture.response_bytes_sha256,
      response_byte_length: built.capture.response_byte_length,
      canonical_text_sha256: built.conversion.canonical_text_sha256,
      canonical_text_byte_length: built.conversion.canonical_text_byte_length,
      canonical_text_id: built.conversion.canonical_text_id,
      immutable_source_document_id: built.bundle.immutable_source_document.immutable_source_document_id,
      source_admission_manifest_id: built.bundle.source_admission_manifest.source_admission_manifest_id,
      output_bindings: candidateBindings,
    });
  }
  candidates.sort((a, b) => a.candidate_key.localeCompare(b.candidate_key));
  outputs.sort((a, b) => a.path.localeCompare(b.path));
  const unsigned = {
    schema_version: 'STAGE_2Y_M7_SOURCE_ADMISSION_RECEIPT/V1',
    stage: 'M7_ENTRY_SOURCE_ADMISSION',
    status: 'PASS',
    authority_binding: { ...binding(AUTHORITY_PATH), authority_digest: authority.authority_digest },
    candidates,
    output_bindings: outputs,
    successful_attempt_network_read_count: 3,
    prior_failed_attempt_network_read_count: authority.prior_failed_attempt_network_reads,
    network_read_count: 6,
    model_call_count: 0,
    database_write_count: 0,
    product_write_count: 0,
    serving_change_count: 0,
    publication_count: 0,
    selector_change_count: 0,
  };
  const receipt = { ...unsigned, receipt_id: contentId(unsigned.schema_version, unsigned) };
  writeCanonical(RECEIPT_PATH, receipt);
  return receipt;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { parseArgs(process.argv); console.log(JSON.stringify(await run())); }
  catch (error) { console.error(error.message); process.exit(1); }
}
