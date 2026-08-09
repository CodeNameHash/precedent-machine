#!/usr/bin/env node

/* Stored final-corpus replay. It does not call a model, write a database, or serve data. */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isFinalCorpusRun } from './canonical-v2-corpus-review-artifact.mjs';

const require = createRequire(import.meta.url);
const { canonicalJson, sha256Hex, utf8Slice } = require('../lib/canonical-v2/canonical-bytes');
const { applyDuplicateSuppression, MODES } = require('../lib/canonical-v2/native-producer/duplicate-suppression');
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = 'evidence/canonical-v2/stage-2y-g-duplicate-suppression.json';
const json = (file) => JSON.parse(readFileSync(file, 'utf8'));
const digest = (value) => `sha256:${sha256Hex(Buffer.from(canonicalJson(value), 'utf8'))}`;
const typedMaeKey = (value) => new Set([
  'NATIVE_MAE_DEFINITION_PRONG_CANDIDATE',
  'NATIVE_MAE_CARVEOUT_CANDIDATE',
  'NATIVE_MAE_DISPROPORTIONALITY_CANDIDATE',
]).has(value);
const asPath = (part) => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(part) ? `.${part}` : `[${JSON.stringify(part)}]`;

function operativeEdge(claim) {
  const matches = (claim?.evidence || []).filter((edge) => edge?.evidence_role === 'OPERATIVE_TEXT');
  return matches.length === 1 ? matches[0] : null;
}
function sameBase(left, right) {
  const a = left?.attributes || {}; const b = right?.attributes || {};
  return a.section_reference === b.section_reference
    && a.defined_term_ref === b.defined_term_ref
    && a.definition_subject === b.definition_subject
    && canonicalJson(a.limb_path || []) === canonicalJson(b.limb_path || []);
}
function sourceLink({ runName, claim, receipt, source }) {
  const edge = operativeEdge(claim); const section = (receipt.resolved_sections || [])
    .find((item) => item.section_reference === claim.attributes?.section_reference);
  if (!edge || !section || typeof source?.canonical_text?.text !== 'string') throw new Error(`RETAINED_SOURCE_LINK_UNAVAILABLE:${runName}:${claim?.closure_id || 'unknown'}`);
  const documentStart = section.start + edge.absolute_start; const documentEnd = section.start + edge.absolute_end;
  const quote = utf8Slice(source.canonical_text.text, documentStart, documentEnd);
  if (quote !== claim.raw_value) throw new Error(`RETAINED_SOURCE_LINK_QUOTE_MISMATCH:${runName}:${claim.closure_id}`);
  return {
    artifact_path: `evidence/canonical-v2/${runName}/adapter-result.json`,
    json_pointer: '/admitted_source_contexts/0/canonical_text/text',
    section_reference: claim.attributes.section_reference,
    claim_evidence_id: edge.claim_evidence_id,
    section_relative_byte_span: { start: edge.absolute_start, end: edge.absolute_end },
    document_byte_span: { start: documentStart, end: documentEnd },
    quote_sha256: `sha256:${sha256Hex(Buffer.from(quote, 'utf8'))}`,
  };
}
function responseQuotePaths(value, needle, path = '$', found = []) {
  if (typeof value === 'string') { if (value === needle) found.push(path); return found; }
  if (Array.isArray(value)) { value.forEach((item, index) => responseQuotePaths(item, needle, `${path}[${index}]`, found)); return found; }
  if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) responseQuotePaths(item, needle, `${path}${asPath(key)}`, found);
  return found;
}
function resolutionState(claim, resolution) {
  const queue = (resolution.review_queue || []).filter((row) => row?.closure_id === claim.closure_id);
  const openWorld = (resolution.open_world || []).filter((row) => row?.closure_id === claim.closure_id);
  const resolved = (resolution.resolved || []).filter((row) => row?.claim?.closure_id === claim.closure_id || row?.closure_id === claim.closure_id);
  if (resolved.length) return { state: 'RESOLVED', closure_id: claim.closure_id, claim_revision_ids: resolved.map((row) => row.claim?.claim_revision_id).filter(Boolean).sort() };
  if (queue.length) return { state: 'REVIEW_QUEUE', closure_id: claim.closure_id, reasons: [...new Set(queue.flatMap((row) => row.reasons || []))].sort() };
  if (openWorld.length) return { state: 'OPEN_WORLD', closure_id: claim.closure_id, reasons: [...new Set(openWorld.map((row) => row.reason).filter(Boolean))].sort() };
  return { state: 'NOT_EMITTED', closure_id: claim.closure_id };
}
function retainedCause({ record, claim, candidates, resolution }) {
  const peers = candidates.filter((peer) => peer.closure_id !== claim.closure_id && sameBase(claim, peer));
  const exactTypedPeers = peers.filter((peer) => typedMaeKey(peer.claim_definition_key) && peer.raw_value === claim.raw_value);
  const typedCounterparts = peers.filter((peer) => typedMaeKey(peer.claim_definition_key));
  const otherExactPeers = candidates.filter((peer) => peer.closure_id !== claim.closure_id && !typedMaeKey(peer.claim_definition_key) && peer.raw_value === claim.raw_value);
  const peerRows = (items) => items.map((peer) => ({
    claim_definition_key: peer.claim_definition_key,
    claim_revision_id: peer.claim_revision_id,
    claim_occurrence_id: peer.claim_occurrence_id,
    closure_id: peer.closure_id,
    resolution: resolutionState(peer, resolution),
  })).sort((left, right) => left.closure_id.localeCompare(right.closure_id));
  if (record.reason_code === 'PARALLEL_TYPED_HELD') return {
    code: 'TYPED_PEER_HELD_IN_REVIEW_QUEUE',
    content_disposition: 'SHAPED_AS_TYPED_CANDIDATE_AND_HELD',
    typed_peer_rows: peerRows(exactTypedPeers),
  };
  if (otherExactPeers.some((peer) => peer.claim_definition_key === 'OPEN_WORLD_PROPOSITION')) return {
    code: 'OPEN_WORLD_PROPOSITION_WITH_SAME_EXACT_QUOTE',
    content_disposition: 'SHAPED_UNDER_ANOTHER_OPEN_WORLD_KIND',
    non_typed_peer_rows: peerRows(otherExactPeers),
  };
  if (typedCounterparts.length) return {
    code: 'TYPED_PEER_DIFFERENT_OPERATIVE_SPAN',
    content_disposition: 'SHAPED_AS_TYPED_CANDIDATE_WITH_A_DIFFERENT_EXACT_QUOTE',
    typed_peer_rows: peerRows(typedCounterparts),
  };
  return { code: 'GENERIC_SOURCE_LIMB_ONLY', content_disposition: 'RETAINED_NO_TYPED_OR_OTHER_PEER', typed_peer_rows: [] };
}
function retainedAccounts({ runName, decisions, receipt, resolution, source, responseFile, response }) {
  const candidates = receipt.compiled_candidates.filter((entry) => entry?.ok === true && entry?.candidate?.kind === 'claim').map((entry) => entry.candidate.claim);
  return decisions.filter((record) => record.disposition === 'RETAINED').map((record) => {
    const claim = candidates.find((candidate) => candidate.closure_id === record.carrier_closure_id);
    if (!claim) throw new Error(`RETAINED_CARRIER_NOT_COMPILED:${runName}:${record.carrier_closure_id}`);
    return {
      carrier_closure_id: claim.closure_id,
      carrier_claim_revision_id: claim.claim_revision_id,
      reason_code: record.reason_code,
      named_cause: retainedCause({ record, claim, candidates, resolution }),
      exact_source_link: sourceLink({ runName, claim, receipt, source }),
      recorded_response: {
        artifact_path: `evidence/canonical-v2/${runName}/${responseFile}`,
        exact_quote_json_paths: responseQuotePaths(response, claim.raw_value),
      },
    };
  }).sort((left, right) => left.carrier_closure_id.localeCompare(right.carrier_closure_id));
}
function conchoRecordingSummary(evidenceRoot) {
  return readdirSync(evidenceRoot).filter((name) => name.startsWith('concho-mae-definition-')).sort().map((runName) => {
    const dir = resolve(evidenceRoot, runName); const receipt = json(resolve(dir, 'run-receipt.json')); const resolution = json(resolve(dir, 'resolution.json'));
    const claims = receipt.compiled_candidates.filter((entry) => entry?.ok === true && entry?.candidate?.kind === 'claim').map((entry) => entry.candidate.claim);
    const responseFile = readdirSync(dir).find((name) => name.startsWith('native-producer-recorded-response-'));
    return {
      run_name: runName,
      recording_path: `evidence/canonical-v2/${runName}/recording.json`,
      recorded_response_path: responseFile ? `evidence/canonical-v2/${runName}/${responseFile}` : null,
      compiled_candidates: claims.length,
      generic_limb_carriers: claims.filter((claim) => claim.claim_definition_key === 'NATIVE_CAPITALISATION_LIMB_ASSERTION_CANDIDATE').length,
      typed_mae_candidates: claims.filter((claim) => typedMaeKey(claim.claim_definition_key)).length,
      resolved: resolution.resolved.length,
      review_queue: resolution.review_queue.length,
      open_world: resolution.open_world.length,
    };
  });
}

function build(repoRoot = ROOT) {
  const evidenceRoot = resolve(repoRoot, 'evidence/canonical-v2');
  const names = readdirSync(evidenceRoot).filter(isFinalCorpusRun).sort();
  const total = { compiled_candidates: 0, resolved: 0, review_queue: 0, open_world: 0 };
  const runs = [];
  for (const name of names) {
    const dir = resolve(evidenceRoot, name);
    for (const file of ['run-receipt.json', 'resolution.json']) if (!existsSync(resolve(dir, file))) throw new Error(`MISSING_FINAL_EVIDENCE:${name}:${file}`);
    const receipt = json(resolve(dir, 'run-receipt.json')); const resolution = json(resolve(dir, 'resolution.json'));
    total.compiled_candidates += receipt.compiled_candidates.length;
    total.resolved += resolution.resolved.length; total.review_queue += resolution.review_queue.length; total.open_world += resolution.open_world.length;
    if (!name.includes('-mae-definition-')) continue;
    const adapter = json(resolve(dir, 'adapter-result.json')); const source = adapter.admitted_source_contexts?.[0];
    const responseFile = readdirSync(dir).find((file) => file.startsWith('native-producer-recorded-response-'));
    if (!source || !responseFile) throw new Error(`MISSING_RETAINED_ACCOUNTING_EVIDENCE:${name}`);
    const recordedResponse = json(resolve(dir, responseFile)); const response = JSON.parse(recordedResponse.raw_response_text);
    const input = { run_receipt: receipt, resolved: resolution.resolved, open_world: resolution.open_world, limb_component_trees: resolution.limb_component_trees, admitted_source_context: source };
    const report = applyDuplicateSuppression({ ...input, mode: MODES.REPORT_ONLY });
    const enforce = applyDuplicateSuppression({ ...input, mode: MODES.ENFORCE });
    runs.push({
      run_name: name, run_receipt_id: receipt.run_receipt_id, document_hash: receipt.document_hash,
      source_hashes: { run_receipt: `sha256:${sha256Hex(readFileSync(resolve(dir, 'run-receipt.json')))}`, resolution: `sha256:${sha256Hex(readFileSync(resolve(dir, 'resolution.json')))}` },
      before_counts: { compiled_candidates: receipt.compiled_candidates.length, resolved: resolution.resolved.length, review_queue: resolution.review_queue.length, open_world: resolution.open_world.length },
      report_only: { ...report.counts, open_world_unchanged: canonicalJson(report.open_world) === canonicalJson(resolution.open_world) },
      enforce: { ...enforce.counts, open_world_after: enforce.open_world.length },
      decisions: report.records,
      retained_accounts: retainedAccounts({ runName: name, decisions: report.records, receipt, resolution, source, responseFile, response }),
    });
  }
  const counts = runs.reduce((out, run) => Object.fromEntries(Object.keys(out).map((key) => [key, out[key] + (run.report_only[key] || 0)])), { scanned: 0, would_suppress: 0, suppressed: 0, retained_typed_peer_held: 0, retained_no_typed_peer: 0 });
  const perRun = runs.filter((run) => run.report_only.would_suppress > 0).map((run) => run.report_only.would_suppress);
  const retainedAccountRows = runs.flatMap((run) => run.retained_accounts.map((account) => ({ run_name: run.run_name, ...account })));
  const retainedCauseCounts = retainedAccountRows.reduce((out, account) => ({ ...out, [account.named_cause.code]: (out[account.named_cause.code] || 0) + 1 }), {});
  const after = { ...total, open_world: total.open_world - counts.would_suppress, displayed_claim_rows: total.review_queue + total.open_world - counts.would_suppress, reason_code_occurrences: 4241 - counts.would_suppress };
  return {
    schema_version: 'STAGE_2Y_G_DUPLICATE_SUPPRESSION_EVIDENCE/V1',
    model_calls: 0, writes: false, serving: false, publication: 'WITHHELD',
    final_corpus: { selector: 'canonical-v2-corpus-review-artifact.mjs:isFinalCorpusRun', final_runs: names.length, before: { ...total, displayed_claim_rows: total.review_queue + total.open_world, reason_code_occurrences: 4241 }, after },
    duplicate_suppression: { mode: 'REPORT_ONLY', counts, eligible_per_run: perRun, records_digest: digest(runs.flatMap((run) => run.decisions)), retained_cause_counts: retainedCauseCounts, retained_accounts: retainedAccountRows },
    historical_concho_25_reconciliation: {
      plan_statement: 'The original plan called the remaining 25 a Concho concentration.',
      finding_code: 'PLAN_CONCHO_25_WAS_THE_TOTAL_RETAINED_COUNT_NOT_A_CONCHO_RUN_COUNT',
      total_retained_carriers: retainedAccountRows.length,
      concho_retained_carriers: retainedAccountRows.filter((account) => account.run_name.startsWith('concho-')).length,
      other_run_retained_carriers: retainedAccountRows.filter((account) => !account.run_name.startsWith('concho-')).length,
      conclusion: 'No committed Concho recording has 25 generic limb carriers. The current final Concho replay has 11, each also shaped as a typed MAE candidate and held in review because its subject is any Party. The historical 25 equals the total retained count, 84 scanned minus 59 would-suppress, across all five MAE runs.',
      concho_recordings: conchoRecordingSummary(evidenceRoot),
    },
    runs,
  };
}
function assertEvidence(value) {
  const c = value.duplicate_suppression.counts; const before = value.final_corpus.before; const after = value.final_corpus.after;
  if (value.final_corpus.final_runs !== 157 || before.compiled_candidates !== 4841 || before.resolved !== 1571 || before.review_queue !== 2310 || before.open_world !== 2692) throw new Error('FINAL_CORPUS_CENSUS_MISMATCH');
  if (c.scanned !== 84 || c.would_suppress !== 59 || c.retained_typed_peer_held !== 21 || c.retained_no_typed_peer !== 4 || canonicalJson(value.duplicate_suppression.eligible_per_run) !== canonicalJson([3, 11, 9, 20, 16])) throw new Error('DUPLICATE_CENSUS_MISMATCH');
  if (after.open_world !== 2633 || after.displayed_claim_rows !== 4943 || after.reason_code_occurrences !== 4182) throw new Error('ENFORCEMENT_CENSUS_MISMATCH');
  const concho = value.runs.find((run) => run.run_name.startsWith('concho-'));
  if (!concho || concho.before_counts.compiled_candidates !== 26 || concho.before_counts.review_queue !== 15 || concho.before_counts.open_world !== 11 || concho.report_only.would_suppress !== 0 || concho.report_only.retained_typed_peer_held !== 11) throw new Error('CONCHO_GUARD_MISMATCH');
  const accounts = value.duplicate_suppression.retained_accounts; const reconciliation = value.historical_concho_25_reconciliation;
  if (accounts.length !== 25 || canonicalJson(value.duplicate_suppression.retained_cause_counts) !== canonicalJson({ OPEN_WORLD_PROPOSITION_WITH_SAME_EXACT_QUOTE: 2, TYPED_PEER_DIFFERENT_OPERATIVE_SPAN: 2, TYPED_PEER_HELD_IN_REVIEW_QUEUE: 21 })) throw new Error('RETAINED_CAUSE_CENSUS_MISMATCH');
  if (!accounts.every((account) => account.named_cause?.code && account.exact_source_link?.claim_evidence_id && Number.isInteger(account.exact_source_link?.document_byte_span?.start) && account.exact_source_link.document_byte_span.end > account.exact_source_link.document_byte_span.start && account.recorded_response?.artifact_path)) throw new Error('RETAINED_SOURCE_LINK_MISSING');
  const held = accounts.filter((account) => account.named_cause.code === 'TYPED_PEER_HELD_IN_REVIEW_QUEUE');
  if (!held.every((account) => account.named_cause.typed_peer_rows.length > 0 && account.named_cause.typed_peer_rows.every((peer) => peer.resolution.state === 'REVIEW_QUEUE'))) throw new Error('TYPED_PEER_HOLD_ACCOUNTING_MISMATCH');
  if (!reconciliation || reconciliation.total_retained_carriers !== 25 || reconciliation.concho_retained_carriers !== 11 || reconciliation.other_run_retained_carriers !== 14 || reconciliation.finding_code !== 'PLAN_CONCHO_25_WAS_THE_TOTAL_RETAINED_COUNT_NOT_A_CONCHO_RUN_COUNT') throw new Error('CONCHO_25_RECONCILIATION_MISMATCH');
  if (!value.runs.every((run) => run.report_only.open_world_unchanged && run.decisions.every((row) => row.operative_span && Number.isInteger(row.operative_span.absolute_start)))) throw new Error('EVIDENCE_SPAN_OR_REPORT_ONLY_MISMATCH');
}
const args = process.argv.slice(2); const value = build(); assertEvidence(value); const text = `${JSON.stringify(value, null, 2)}\n`; const output = resolve(ROOT, OUTPUT);
if (args.includes('--write')) { writeFileSync(output, text); process.stdout.write(`WROTE ${OUTPUT}\n`); }
else if (args.includes('--check')) { if (!existsSync(output) || readFileSync(output, 'utf8') !== text) throw new Error('STALE_OUTPUT'); process.stdout.write(`CHECKED ${OUTPUT}\n`); }
else process.stdout.write(text);
export { build };
