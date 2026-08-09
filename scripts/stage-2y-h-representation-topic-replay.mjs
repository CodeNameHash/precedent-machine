#!/usr/bin/env node

/* Inert, recorded-corpus ledger. It never invokes a producer, resolver, writer, or serving path. */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isFinalCorpusRun } from './canonical-v2-corpus-review-artifact.mjs';

const require = createRequire(import.meta.url);
const { canonicalJson, sha256Hex, utf8Slice } = require('../lib/canonical-v2/canonical-bytes');
const {
  REGISTRY_VERSION, REGISTRY_DIGEST, NATIVE_LIMB_KEY, CLASSIFIED,
  classifyRepresentationTopic,
} = require('../lib/canonical-v2/representation-topic-registry');

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(SCRIPT_DIR, '..');
const OUTPUT = 'evidence/canonical-v2/stage-2y-h-representation-topic-replay.json';
const EXPECTED_SELECTED_RUNS = 157;
const EXPECTED_REPRESENTATIONS = 623;
const EXPECTED_MAE = 84;
const EXPECTED_NO_OTHER = 6;

function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')); }
function digest(value) { return sha256Hex(Buffer.from(String(value), 'utf8')); }
function fail(code, details = '') { const error = new Error(details ? `${code}:${details}` : code); error.code = code; throw error; }
function required(dir, name) { const path = resolve(dir, name); if (!existsSync(path)) fail('MISSING_REQUIRED_RUN_FILE', `${dir.split('/').pop()}:${name}`); return path; }
function countBy(rows, value) { const counts = new Map(); for (const row of rows) { const key = value(row); counts.set(key, (counts.get(key) || 0) + 1); } return Object.fromEntries([...counts].sort(([a], [b]) => a.localeCompare(b))); }
function sourceCandidates(receipt) { return (receipt.compiled_candidates || []).filter((entry) => entry?.candidate?.claim); }
function sourceCandidateFor(row, candidates, runName) {
  const matches = candidates.filter((entry) => entry.candidate.claim.closure_id === row.closure_id);
  if (matches.length !== 1) fail('SOURCE_CANDIDATE_IDENTITY_NOT_UNIQUE', `${runName}:${row.closure_id || 'missing'}`);
  const claim = matches[0].candidate.claim;
  if (claim.claim_definition_key !== row.claim_definition_key || claim.raw_value !== row.raw_value) fail('SOURCE_CANDIDATE_CONTENT_MISMATCH', `${runName}:${row.closure_id}`);
  return claim;
}
function sectionTextFor(receipt, adapter, sectionReference, runName) {
  const section = (receipt.resolved_sections || []).filter((item) => item.section_reference === sectionReference);
  if (section.length !== 1) fail('SECTION_NOT_UNIQUE', `${runName}:${sectionReference}`);
  const text = adapter?.admitted_source_contexts?.[0]?.canonical_text?.text;
  if (typeof text !== 'string') fail('ADMITTED_SOURCE_MISSING', runName);
  try { return { section: section[0], text: utf8Slice(text, section[0].start, section[0].end) }; } catch { fail('SECTION_UTF8_INVALID', `${runName}:${sectionReference}`); }
}
function exactEvidence(row, sourceClaim, sectionText, runName) {
  const evidence = sourceClaim.evidence || row.evidence;
  if (!Array.isArray(evidence) || evidence.length !== 1) fail('EVIDENCE_SPAN_NOT_UNIQUE', `${runName}:${row.closure_id}`);
  const span = evidence[0]; let exact;
  try { exact = utf8Slice(sectionText, span.absolute_start, span.absolute_end); } catch { fail('EVIDENCE_SPAN_INVALID', `${runName}:${row.closure_id}`); }
  if (exact !== row.raw_value || exact !== sourceClaim.raw_value) fail('EVIDENCE_RESLICING_MISMATCH', `${runName}:${row.closure_id}`);
  return Object.freeze({
    evidence_role: span.evidence_role || null, excerpt_id: span.excerpt_id || null,
    absolute_start: span.absolute_start, absolute_end: span.absolute_end,
    utf8_text: exact, utf8_digest: digest(exact),
  });
}
function identityFor(row, sourceClaim, runName) {
  const claimOccurrenceId = sourceClaim.claim_occurrence_id || row.original_claim_occurrence_id || null;
  const closureId = sourceClaim.closure_id || row.closure_id || null;
  if (!claimOccurrenceId && !closureId) fail('CLAIM_IDENTITY_MISSING', runName);
  return Object.freeze({ claim_occurrence_id: claimOccurrenceId, closure_id: closureId });
}
function immutableExcludedRow({ runName, deal, family, row, sourceClaim, evidence }) {
  const unchangedFields = Object.freeze({
    claim_definition_key: row.claim_definition_key === sourceClaim.claim_definition_key,
    raw_value: row.raw_value === sourceClaim.raw_value,
    closure_id: row.closure_id === sourceClaim.closure_id,
    evidence: canonicalJson(row.evidence || []) === canonicalJson(sourceClaim.evidence || []),
  });
  if (!Object.values(unchangedFields).every(Boolean)) fail('EXCLUDED_ROW_CHANGED', `${runName}:${row.closure_id}`);
  return Object.freeze({
    run: runName, deal, family, section_reference: row.section_reference || null,
    subject: row.attributes?.subject ?? null, raw_value_digest: digest(row.raw_value),
    identity: identityFor(row, sourceClaim, runName), evidence,
    classifier_invoked: false,
    classifier_result: Object.freeze({ state: 'EXCLUDED', reason: family === 'MAE_DEFINITION' ? 'REPRESENTATION_TOPIC_MAE_EXCLUDED' : 'REPRESENTATION_TOPIC_NO_OTHER_EXCLUDED', model_calls: 0 }),
    matched_rule_ids: Object.freeze([]), registry_version: REGISTRY_VERSION, registry_digest: REGISTRY_DIGEST,
    baseline_row_digest: digest(canonicalJson(row)), source_candidate_digest: digest(canonicalJson(sourceClaim)),
    unchanged_fields: unchangedFields, unchanged: true,
  });
}

function buildRepresentationTopicReplay({ repoRoot = DEFAULT_ROOT } = {}) {
  const evidenceRoot = resolve(repoRoot, 'evidence/canonical-v2');
  const runNames = readdirSync(evidenceRoot).filter(isFinalCorpusRun).sort();
  if (runNames.length !== EXPECTED_SELECTED_RUNS) fail('SELECTED_RUN_COUNT_MISMATCH', `${runNames.length}`);
  const representationRows = []; const maeRows = []; const noOtherRows = [];
  for (const runName of runNames) {
    const dir = resolve(evidenceRoot, runName);
    const manifest = readJson(required(dir, 'run-manifest.json'));
    const receipt = readJson(required(dir, 'run-receipt.json'));
    const resolution = readJson(required(dir, 'resolution.json'));
    const adapter = readJson(required(dir, 'adapter-result.json'));
    const candidates = sourceCandidates(receipt);
    for (const row of resolution.open_world || []) {
      if (row.reason !== 'UNMAPPED_GENERIC_CLAIM_KEY') continue;
      const family = manifest.section_family;
      const sourceClaim = sourceCandidateFor(row, candidates, runName);
      const { text } = sectionTextFor(receipt, adapter, row.section_reference, runName);
      const evidence = exactEvidence(row, sourceClaim, text, runName);
      if (family === 'REPRESENTATIONS' && row.claim_definition_key === NATIVE_LIMB_KEY) {
        const classification = classifyRepresentationTopic({
          family, generic_claim_key: row.claim_definition_key, raw_value: row.raw_value,
          subject: row.attributes?.subject ?? null,
          evidence: { source_text: text, spans: [{ absolute_start: evidence.absolute_start, absolute_end: evidence.absolute_end }] },
        });
        if (classification.model_calls !== 0) fail('MODEL_CALLS_NONZERO', runName);
        representationRows.push(Object.freeze({
          run: runName, deal: manifest.deal, family, section_reference: row.section_reference,
          subject: row.attributes?.subject ?? null, raw_value_digest: digest(row.raw_value),
          identity: identityFor(row, sourceClaim, runName), evidence, classifier_result: classification,
          matched_rule_ids: classification.matched_rule_ids, registry_version: REGISTRY_VERSION,
          registry_digest: REGISTRY_DIGEST,
        }));
      } else if (family === 'MAE_DEFINITION' && row.claim_definition_key === NATIVE_LIMB_KEY) {
        maeRows.push(immutableExcludedRow({ runName, deal: manifest.deal, family, row, sourceClaim, evidence }));
      } else if (family === 'NO_OTHER_REPS_FRAUD') {
        noOtherRows.push(immutableExcludedRow({ runName, deal: manifest.deal, family, row, sourceClaim, evidence }));
      }
    }
  }
  representationRows.sort((a, b) => a.run.localeCompare(b.run) || a.section_reference.localeCompare(b.section_reference) || a.identity.closure_id.localeCompare(b.identity.closure_id));
  maeRows.sort((a, b) => a.run.localeCompare(b.run) || a.identity.closure_id.localeCompare(b.identity.closure_id));
  noOtherRows.sort((a, b) => a.run.localeCompare(b.run) || a.identity.closure_id.localeCompare(b.identity.closure_id));
  if (representationRows.length !== EXPECTED_REPRESENTATIONS) fail('REPRESENTATION_DENOMINATOR_MISMATCH', `${representationRows.length}`);
  if (maeRows.length !== EXPECTED_MAE) fail('MAE_DENOMINATOR_MISMATCH', `${maeRows.length}`);
  if (noOtherRows.length !== EXPECTED_NO_OTHER) fail('NO_OTHER_DENOMINATOR_MISMATCH', `${noOtherRows.length}`);
  const classified = representationRows.filter((row) => row.classifier_result.state === CLASSIFIED);
  const unclassified = representationRows.filter((row) => row.classifier_result.state !== CLASSIFIED);
  if (classified.length + unclassified.length !== EXPECTED_REPRESENTATIONS) fail('CLASSIFICATION_CONSERVATION_FAILED');
  return Object.freeze({
    schema_version: 'STAGE_2Y_H_REPRESENTATION_TOPIC_REPLAY_LEDGER/V1', mode: 'INERT_REPLAY_ONLY',
    selection: Object.freeze({ selector: 'canonical-v2-corpus-review-artifact.mjs:isFinalCorpusRun', selected_run_count: runNames.length, selected_runs: runNames }),
    registry: Object.freeze({ version: REGISTRY_VERSION, digest: REGISTRY_DIGEST }),
    publication: Object.freeze({ model_calls: 0, writes_performed: false, serving_activated: false, publication_disposition: 'WITHHELD' }),
    conservation: Object.freeze({ input_rows: EXPECTED_REPRESENTATIONS, classified_rows: classified.length, unclassified_rows: unclassified.length, total_rows: representationRows.length }),
    counts: Object.freeze({ per_code: countBy(classified, (row) => row.classifier_result.canonical_value), per_deal: countBy(representationRows, (row) => row.deal), unclassified_by_reason: countBy(unclassified, (row) => row.classifier_result.reason) }),
    representation_rows: Object.freeze(representationRows),
    exclusions: Object.freeze({ mae_native_limb_rows: Object.freeze({ expected: EXPECTED_MAE, actual: maeRows.length, classifier_invoked: false, unchanged: maeRows.every((row) => row.unchanged), rows: maeRows }), no_other_generic_rows: Object.freeze({ expected: EXPECTED_NO_OTHER, actual: noOtherRows.length, classifier_invoked: false, unchanged: noOtherRows.every((row) => row.unchanged), rows: noOtherRows }) }),
  });
}
function renderRepresentationTopicReplay(ledger) { return `${canonicalJson(ledger)}\n`; }
function main() {
  const mode = process.argv[2];
  if (!['--write', '--check'].includes(mode) || process.argv.length !== 3) throw new Error('usage: --write | --check');
  const ledger = buildRepresentationTopicReplay(); const output = renderRepresentationTopicReplay(ledger); const path = resolve(DEFAULT_ROOT, OUTPUT);
  if (mode === '--write') writeFileSync(path, output);
  if (!existsSync(path) || readFileSync(path, 'utf8') !== output) fail('STALE_OUTPUT');
  process.stdout.write(`representation rows: ${ledger.conservation.input_rows} = ${ledger.conservation.classified_rows} classified + ${ledger.conservation.unclassified_rows} unclassified\nMAE excluded: ${ledger.exclusions.mae_native_limb_rows.actual}; NO_OTHER excluded: ${ledger.exclusions.no_other_generic_rows.actual}\n`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
export { OUTPUT, EXPECTED_SELECTED_RUNS, EXPECTED_REPRESENTATIONS, EXPECTED_MAE, EXPECTED_NO_OTHER, buildRepresentationTopicReplay, renderRepresentationTopicReplay };
