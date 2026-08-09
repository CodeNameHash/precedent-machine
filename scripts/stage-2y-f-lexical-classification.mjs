#!/usr/bin/env node

/* Stored-evidence review ledger. It does not call a model or alter extraction. */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isFinalCorpusRun } from './canonical-v2-corpus-review-artifact.mjs';

const require = createRequire(import.meta.url);
const { canonicalJson, sha256Hex, utf8Slice } = require('../lib/canonical-v2/canonical-bytes');
const { computeSectionCandidatesForLexicalDigest } = require('../lib/canonical-v2/native-producer/candidate-resolution');
const {
  buildLexicalDisagreementReceipt, computeCandidateDigest, isStructurallyValidReceipt,
} = require('../lib/canonical-v2/native-producer/lexical-disagreement-net');

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(SCRIPT_DIR, '..');
const OUTPUT = 'evidence/canonical-v2/stage-2y-f-lexical-classification.json';
const REVIEW_OUTPUT = 'evidence/canonical-v2/stage-2y-f-lexical-classification.html';
const DECISIONS = 'docs/codex-program/notes/stage-2y/lexical-classification-decisions.json';
const REASON = 'LEXICAL_UNMATCHED_SIGNAL_IN_SCOPE';
const CLASSES = new Set(['SAME_CONCEPT_REPEAT', 'GENUINE_UNCAPTURED_ITEM', 'AMBIGUOUS_NEEDS_REVIEW']);

function json(path) { return JSON.parse(readFileSync(path, 'utf8')); }
function hash(value) { return sha256Hex(Buffer.isBuffer(value) ? value : Buffer.from(value, 'utf8')); }
function object(value) { return value && typeof value === 'object' && !Array.isArray(value); }
function nonEmptyString(value) { return typeof value === 'string' && value.trim().length > 0; }
function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  return new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
}
function exactIdSet(value, expected) {
  return Array.isArray(value)
    && value.every(nonEmptyString)
    && new Set(value).size === value.length
    && value.length === expected.length
    && value.every((id) => expected.includes(id));
}
function knownIdList(value, available) {
  return Array.isArray(value)
    && value.length > 0
    && value.every(nonEmptyString)
    && new Set(value).size === value.length
    && value.every((id) => available.includes(id));
}
function missingRequiredRunFile(runName, file) {
  const error = new Error(`MISSING_REQUIRED_RUN_FILE:${runName}:${file}`);
  error.code = 'MISSING_REQUIRED_RUN_FILE';
  error.run_name = runName;
  error.file = file;
  return error;
}
function excerpt(bytes, start, end) {
  let left = Math.max(0, start - 80); let right = Math.min(bytes.length, end + 80);
  while (left < bytes.length && (bytes[left] & 0xc0) === 0x80) left += 1;
  while (right > 0 && right < bytes.length && (bytes[right] & 0xc0) === 0x80) right -= 1;
  return bytes.subarray(left, right).toString('utf8');
}
function boundary(bytes, offset) { return offset === 0 || offset === bytes.length || (bytes[offset] & 0xc0) !== 0x80; }
function failuresFor(root) {
  const failures = new Set(); const { section, canonical_text: text, lexical_receipt: receipt, outcome } = root;
  const bytes = Buffer.from(typeof text === 'string' ? text : '', 'utf8');
  if (!object(root.manifest) || !root.deal || !root.family) failures.add('MANIFEST_INVALID');
  if (!section || !Number.isInteger(section.start) || !Number.isInteger(section.end) || section.start < 0 || section.end <= section.start || section.end > bytes.length) failures.add('SECTION_RANGE_INVALID');
  const sectionBytes = section ? bytes.subarray(section.start, section.end) : Buffer.alloc(0);
  if (section && hash(sectionBytes) !== section.text_sha256) failures.add('SECTION_HASH_MISMATCH');
  if (!isStructurallyValidReceipt(receipt) || receipt.section_ref !== root.section_reference) failures.add('RECEIPT_MALFORMED');
  if (receipt?.text_sha256 !== section?.text_sha256) failures.add('RECEIPT_SECTION_HASH_MISMATCH');
  if (root.candidate_digest !== receipt?.candidate_digest) failures.add('CANDIDATE_DIGEST_MISMATCH');
  if (!outcome) failures.add('OUTCOME_MISSING');
  else {
    if (outcome.outcome !== 'LEXICAL_UNMATCHED_SIGNALS') failures.add('OUTCOME_INVALID');
    if (!Array.isArray(outcome.disagreement_set) || outcome.disagreement_set.length !== outcome.unmatched_count) failures.add('DISAGREEMENT_COUNT_MISMATCH');
  }
  for (const hit of outcome?.disagreement_set || []) {
    if (!Number.isInteger(hit.start) || !Number.isInteger(hit.end) || hit.start < 0 || hit.end <= hit.start || hit.end > sectionBytes.length) { failures.add('HIT_OUT_OF_FRAME'); continue; }
    if (!boundary(sectionBytes, hit.start) || !boundary(sectionBytes, hit.end)) failures.add('HIT_UTF8_BOUNDARY_INVALID');
    let exact; try { exact = utf8Slice(sectionBytes.toString('utf8'), hit.start, hit.end); } catch { failures.add('HIT_UTF8_BOUNDARY_INVALID'); continue; }
    if (!Buffer.from(exact, 'utf8').equals(sectionBytes.subarray(hit.start, hit.end))) failures.add('HIT_BYTE_ROUNDTRIP_FAILED');
    if (hit.excerpt !== excerpt(sectionBytes, hit.start, hit.end)) failures.add('HIT_EXCERPT_MISMATCH');
  }
  if (root.queue_rows.some((row) => row.has_resolution !== true || !row.reasons?.includes(REASON) || row.section_reference !== root.section_reference || row.concept_key !== root.concept_key)) failures.add('REVIEW_QUEUE_ROOT_MISMATCH');
  try {
    const replay = buildLexicalDisagreementReceipt({ governed_section: { section_ref: root.section_reference, text: sectionBytes.toString('utf8'), text_sha256: section.text_sha256 }, candidates: root.digest_candidates });
    if (canonicalJson(replay) !== canonicalJson(receipt)) failures.add('RECEIPT_REPLAY_MISMATCH');
  } catch { failures.add('RECEIPT_REPLAY_MISMATCH'); }
  return [...failures].sort();
}

function validateRootEvidence(root) {
  const failures = failuresFor(root);
  return { ...root, failures, evidence_valid: failures.length === 0 };
}
function evidenceFingerprint(root) {
  const evidence = root.resolved_entries.flatMap((entry) => (entry.claim?.evidence || []).map((item) => [
    entry.claim.claim_revision_id,
    item.claim_evidence_id,
    item.absolute_start,
    item.absolute_end,
  ])).sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right)));
  return `sha256:${hash(canonicalJson({
    root_id: root.root_id,
    section_hash: root.section.text_sha256,
    candidate_digest: root.candidate_digest,
    receipt_id: root.lexical_receipt.lexical_disagreement_receipt_id,
    hits: root.disagreement_items.map((hit) => [hit.pattern_id, hit.start, hit.end]),
    claim_evidence: evidence,
  }))}`;
}
function sourceLink(row, candidates) {
  const claims = candidates.filter((entry) => entry?.candidate?.claim);
  const pick = (items) => items.length === 1 ? { state: 'SOURCE_CANDIDATE_UNIQUE', candidate: items[0] } : { state: items.length ? 'SOURCE_CANDIDATE_AMBIGUOUS' : 'SOURCE_CANDIDATE_NOT_LOCATED', candidates: items };
  if (row.original_claim_occurrence_id) { const found = claims.filter((x) => x.candidate.claim.claim_occurrence_id === row.original_claim_occurrence_id); if (found.length) return pick(found); }
  if (row.claim_revision_id) { const found = claims.filter((x) => x.candidate.claim.claim_revision_id === row.claim_revision_id); if (found.length) return pick(found); }
  if (row.closure_id) { const found = claims.filter((x) => x.candidate.claim.closure_id === row.closure_id); if (found.length) return pick(found); }
  return pick(claims.filter((x) => x.candidate.claim.claim_definition_key === row.generic_claim_key && x.candidate.claim.raw_value === (row.raw_value || row.normalised_phrase)));
}

function buildLexicalClassificationInventory({ repoRoot = DEFAULT_ROOT } = {}) {
  const evidenceRoot = resolve(repoRoot, 'evidence/canonical-v2');
  const names = readdirSync(evidenceRoot).filter(isFinalCorpusRun).sort(); const roots = new Map(); const stats = { selected_run_count: names.length, lexical_file_count: 0, governed_section_count: 0, affected_claim_rows: 0, pattern_hits: 0, matched_hits: 0, unmatched_hits: 0, irreproducible_hits: 0, source_candidate_linkage_totals: { SOURCE_CANDIDATE_UNIQUE: 0, SOURCE_CANDIDATE_AMBIGUOUS: 0, SOURCE_CANDIDATE_NOT_LOCATED: 0 } };
  for (const run_name of names) {
    const dir = resolve(evidenceRoot, run_name); const paths = Object.fromEntries(['run-manifest.json', 'run-receipt.json', 'resolution.json', 'adapter-result.json', 'lexical-disagreement.json'].map((file) => [file, resolve(dir, file)]));
    for (const [file, path] of Object.entries(paths)) if (!existsSync(path)) throw missingRequiredRunFile(run_name, file);
    stats.lexical_file_count += 1;
    const manifest = json(paths['run-manifest.json']); const run_receipt = json(paths['run-receipt.json']); const resolution = json(paths['resolution.json']); const adapter = json(paths['adapter-result.json']); const lexical = json(paths['lexical-disagreement.json']);
    const text = adapter?.admitted_source_contexts?.[0]?.canonical_text?.text;
    stats.governed_section_count += Array.isArray(run_receipt.resolved_sections) ? run_receipt.resolved_sections.length : 0;
    for (const row of resolution.review_queue || []) {
      if (!row.reasons?.includes(REASON)) continue; stats.affected_claim_rows += 1;
      const section = (run_receipt.resolved_sections || []).filter((item) => item.section_reference === row.section_reference);
      const receipt = lexical[row.section_reference]; const outcome = receipt?.family_outcomes?.find((item) => item.family === row.concept_key);
      const rootKey = [manifest.deal, row.section_reference, row.concept_key].join('\0');
      if (roots.has(rootKey)) {
        // Several affected queue rows can legitimately belong to the same
        // root in one run. A collision across final runs is the forbidden
        // unapproved merge.
        if (roots.get(rootKey).run_name !== run_name) roots.get(rootKey).duplicate_runs.push(run_name);
        continue;
      }
      const sectionValue = section[0] || {}; const bytes = Buffer.from(text || '', 'utf8'); const sectionText = section.length === 1 ? bytes.subarray(sectionValue.start, sectionValue.end).toString('utf8') : '';
      const digest_candidates = computeSectionCandidatesForLexicalDigest(resolution.resolved || [], row.section_reference);
      const root = { run_name, deal: manifest.deal, family: manifest.section_family, manifest, section_reference: row.section_reference, concept_key: row.concept_key, section: { section_ref: row.section_reference, start: sectionValue.start, end: sectionValue.end, byte_length: Buffer.byteLength(sectionText, 'utf8'), text_sha256: sectionValue.text_sha256 }, canonical_text: text, lexical_receipt: receipt, candidate_digest: computeCandidateDigest(digest_candidates), digest_candidates, queue_rows: [], duplicate_runs: [], resolved_entries: (resolution.resolved || []).filter((entry) => entry.section_reference === row.section_reference && entry.concept_key === row.concept_key), compiled_candidates: (run_receipt.compiled_candidates || []).filter((entry) => entry.section_reference === row.section_reference), outcome, disagreement_items: outcome?.disagreement_set || [] };
      root.root_id = `sha256:${hash(canonicalJson([run_name, root.deal, root.section_reference, root.concept_key, root.section.text_sha256, receipt?.candidate_digest, receipt?.lexical_disagreement_receipt_id]))}`;
      roots.set(rootKey, root);
    }
  }
  const list = [...roots.values()];
  // Attach all rows after root identities are known. This preserves one root per key.
  for (const root of list) {
    const dir = resolve(evidenceRoot, root.run_name); const resolution = json(resolve(dir, 'resolution.json')); const receipt = json(resolve(dir, 'run-receipt.json'));
    root.queue_rows = (resolution.review_queue || []).filter((row) => row.reasons?.includes(REASON) && row.section_reference === root.section_reference && row.concept_key === root.concept_key).map((row) => {
      const source_candidate_linkage = sourceLink(row, receipt.compiled_candidates || []);
      stats.source_candidate_linkage_totals[source_candidate_linkage.state] += 1;
      return { ...row, source_candidate_linkage };
    });
    root.disagreement_items = (root.outcome?.disagreement_set || []).map((hit, index) => ({ disagreement_id: `${root.root_id}:${index}`, ...hit, exact_hit_text: (() => { try { return utf8Slice(Buffer.from(root.canonical_text, 'utf8').subarray(root.section.start, root.section.end).toString('utf8'), hit.start, hit.end); } catch { return null; } })() }));
    root.failures = failuresFor(root); root.evidence_valid = root.failures.length === 0; root.evidence_fingerprint = evidenceFingerprint(root);
    if (root.duplicate_runs.length) { root.failures.push('DUPLICATE_ROOT_KEY'); root.evidence_valid = false; }
    const o = root.outcome || {}; stats.pattern_hits += o.pattern_hit_count || 0; stats.matched_hits += o.matched_count || 0; stats.unmatched_hits += o.unmatched_count || 0; stats.irreproducible_hits += o.irreproducible_count || 0;
  }
  return { schema_version: 'STAGE_2Y_F_LEXICAL_CLASSIFICATION/V1', selection_reconciliation: { selector: 'canonical-v2-corpus-review-artifact.mjs:isFinalCorpusRun', selected_run_count: stats.selected_run_count, historical_note_claimed_run_count: 151, difference: stats.selected_run_count - 151, status: 'COUNT_DISCREPANCY_UNRESOLVED' }, stats, roots: list.sort((a, b) => a.deal.localeCompare(b.deal) || a.section_reference.localeCompare(b.section_reference) || a.concept_key.localeCompare(b.concept_key) || a.run_name.localeCompare(b.run_name)) };
}

function decisionErrors(decision, root) {
  if (!object(decision) || !CLASSES.has(decision.classification)) return ['DECISION_UNKNOWN_CLASS'];
  const errors = [];
  if (decision.evidence_fingerprint !== evidenceFingerprint(root)) errors.push('DECISION_STALE');
  if (!nonEmptyString(decision.rationale)) errors.push('DECISION_RATIONALE_MISSING');
  if (!nonEmptyString(decision.reviewed_by)) errors.push('DECISION_REVIEWER_MISSING');
  if (!isIsoDate(decision.reviewed_on)) errors.push('DECISION_REVIEW_DATE_INVALID');
  if (decision.classification === 'SAME_CONCEPT_REPEAT') {
    const claimIds = [...new Set(root.resolved_entries.map((entry) => entry.claim?.claim_revision_id).filter(nonEmptyString))].sort();
    const disagreementIds = root.disagreement_items.map((hit) => hit.disagreement_id).sort();
    if (!claimIds.length || !exactIdSet(decision.covered_claim_revision_ids, claimIds)) errors.push('DECISION_SAME_CONCEPT_CLAIM_COVERAGE_MISMATCH');
    if (!exactIdSet(decision.covered_disagreement_ids, disagreementIds)) errors.push('DECISION_SAME_CONCEPT_DISAGREEMENT_COVERAGE_MISMATCH');
  }
  if (decision.classification === 'GENUINE_UNCAPTURED_ITEM') {
    if (!nonEmptyString(decision.missing_item_description) || !nonEmptyString(decision.follow_up_id)) errors.push('DECISION_INCOMPLETE');
    const disagreementIds = root.disagreement_items.map((hit) => hit.disagreement_id);
    if (!knownIdList(decision.proving_disagreement_ids, disagreementIds)) errors.push('DECISION_GENUINE_PROVING_DISAGREEMENT_IDS_INVALID');
  }
  if (decision.classification === 'AMBIGUOUS_NEEDS_REVIEW' && !nonEmptyString(decision.review_question)) errors.push('DECISION_INCOMPLETE');
  return errors;
}
function applyClassificationDecisions(inventory, decisions) {
  const input = decisions || { decisions: [] }; const errors = [];
  if (!object(input) || input.schema_version !== 'STAGE_2Y_F_LEXICAL_DECISIONS/V1' || !Array.isArray(input.decisions)) errors.push('DECISIONS_MALFORMED');
  const byId = new Map(); for (const decision of input.decisions || []) { if (byId.has(decision.root_id)) errors.push('DECISION_DUPLICATE'); byId.set(decision.root_id, decision); }
  const rootIds = new Set(inventory.roots.map((root) => root.root_id)); for (const id of byId.keys()) if (!rootIds.has(id)) errors.push('DECISION_UNKNOWN_ROOT');
  const roots = inventory.roots.map((root) => { const decision = byId.get(root.root_id); const rootDecisionErrors = decision ? decisionErrors(decision, root) : []; let classification; let classification_source; if (!root.evidence_valid) { classification = 'INVALID_INPUT'; classification_source = 'EVIDENCE_VALIDATION'; } else if (!decision || rootDecisionErrors.length) { classification = 'AMBIGUOUS_NEEDS_REVIEW'; classification_source = 'DEFAULT_FAIL_CLOSED'; errors.push(...rootDecisionErrors); } else { classification = decision.classification; classification_source = 'HUMAN_REVIEW'; }
    return { ...root, classification, classification_source, decision: decision || null, decision_error: rootDecisionErrors.length ? rootDecisionErrors : null }; });
  const counts = Object.fromEntries(['SAME_CONCEPT_REPEAT', 'GENUINE_UNCAPTURED_ITEM', 'AMBIGUOUS_NEEDS_REVIEW', 'INVALID_INPUT'].map((name) => [name, roots.filter((root) => root.classification === name).length]));
  return { ...inventory, roots, decision_validation_errors: [...new Set(errors)].sort(), classification_counts: counts };
}
function renderLexicalClassificationInventory(inventory) {
  // Canonical agreement text is input used for validation, not ledger evidence.
  // The ledger keeps the governed byte slices, hits and hashes instead.
  const serialisable = {
    ...inventory,
    roots: inventory.roots.map(({ canonical_text, manifest, lexical_receipt, outcome, ...root }) => ({
      ...root,
      queue_rows: root.queue_rows.map(({ source_candidate_linkage, ...row }) => ({
        ...row,
        source_candidate_linkage: source_candidate_linkage && {
          state: source_candidate_linkage.state,
          candidate_claim_revision_ids: [source_candidate_linkage.candidate, ...(source_candidate_linkage.candidates || [])]
            .filter(Boolean)
            .map((entry) => entry.candidate?.claim?.claim_revision_id)
            .filter(Boolean)
            .sort(),
        },
      })),
      outcome: outcome && {
        family: outcome.family,
        outcome: outcome.outcome,
        pattern_hit_count: outcome.pattern_hit_count,
        matched_count: outcome.matched_count,
        unmatched_count: outcome.unmatched_count,
        irreproducible_count: outcome.irreproducible_count,
      },
      lexical_receipt: lexical_receipt && {
        schema_version: lexical_receipt.schema_version,
        lexicon_version: lexical_receipt.lexicon_version,
        lexicon_content_hash: lexical_receipt.lexicon_content_hash,
        candidate_digest: lexical_receipt.candidate_digest,
        lexical_disagreement_receipt_id: lexical_receipt.lexical_disagreement_receipt_id,
      },
    })),
  };
  return `${canonicalJson(serialisable)}\n`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function sourceExcerptForCandidate(root, edge) {
  if (!Number.isInteger(edge?.absolute_start) || !Number.isInteger(edge?.absolute_end)
    || edge.absolute_start < 0 || edge.absolute_end <= edge.absolute_start) return null;
  const sectionBytes = Buffer.from(root.canonical_text || '', 'utf8').subarray(root.section.start, root.section.end);
  if (edge.absolute_end > sectionBytes.length || !boundary(sectionBytes, edge.absolute_start) || !boundary(sectionBytes, edge.absolute_end)) return null;
  return excerpt(sectionBytes, edge.absolute_start, edge.absolute_end);
}
function candidateRowsForReview(root) {
  const rows = [];
  for (const entry of root.compiled_candidates || []) {
    const claim = entry?.candidate?.claim;
    if (!claim) continue;
    const excerpts = (claim.evidence || []).map((edge) => ({
      evidence_role: edge.evidence_role || null,
      claim_evidence_id: edge.claim_evidence_id || null,
      absolute_start: edge.absolute_start,
      absolute_end: edge.absolute_end,
      excerpt: sourceExcerptForCandidate(root, edge),
    }));
    rows.push({
      claim_revision_id: claim.claim_revision_id || null,
      claim_occurrence_id: claim.claim_occurrence_id || null,
      claim_definition_key: claim.claim_definition_key || null,
      canonical_value: claim.canonical_value,
      raw_value: claim.raw_value || null,
      evidence: excerpts,
    });
  }
  return rows.sort((left, right) => String(left.claim_revision_id).localeCompare(String(right.claim_revision_id)));
}
function reviewCard(root, number) {
  const disagreements = root.disagreement_items.map((hit) => `<li><code>${escapeHtml(hit.disagreement_id)}</code><br><strong>${escapeHtml(hit.pattern_id)}</strong>: <mark>${escapeHtml(hit.exact_hit_text)}</mark><pre>${escapeHtml(hit.excerpt)}</pre></li>`).join('');
  const candidates = candidateRowsForReview(root).map((claim) => `<li><code>${escapeHtml(claim.claim_revision_id)}</code> <strong>${escapeHtml(claim.claim_definition_key)}</strong> = ${escapeHtml(claim.canonical_value)}<pre>${escapeHtml(claim.raw_value)}</pre>${claim.evidence.map((edge) => `<div class="evidence"><code>${escapeHtml(edge.evidence_role)} ${escapeHtml(edge.claim_evidence_id)} [${escapeHtml(edge.absolute_start)}, ${escapeHtml(edge.absolute_end)})</code><pre>${escapeHtml(edge.excerpt || 'UNAVAILABLE')}</pre></div>`).join('')}</li>`).join('');
  const claimKeys = [...new Set((root.resolved_entries || []).map((entry) => entry.claim?.claim_revision_id).filter(nonEmptyString))].sort();
  const decisionKeys = [`root_id=${root.root_id}`, `evidence_fingerprint=${root.evidence_fingerprint}`, ...claimKeys.map((id) => `claim_revision_id=${id}`), ...root.disagreement_items.map((hit) => `disagreement_id=${hit.disagreement_id}`)];
  return `<article class="card" data-root-id="${escapeHtml(root.root_id)}" data-family="${escapeHtml(root.family)}" data-state="${escapeHtml(root.classification)}"><h2>${number}. ${escapeHtml(root.deal)} · ${escapeHtml(root.family)} · §${escapeHtml(root.section_reference)} · ${escapeHtml(root.concept_key)}</h2><p><strong>State:</strong> ${escapeHtml(root.classification)} (${escapeHtml(root.classification_source)})<br><strong>Run:</strong> ${escapeHtml(root.run_name)}<br><strong>Section:</strong> bytes [${escapeHtml(root.section.start)}, ${escapeHtml(root.section.end)}) · ${escapeHtml(root.section.text_sha256)}</p><details open><summary>Exact decision keys</summary><pre>${escapeHtml(decisionKeys.join('\n'))}</pre></details><details open><summary>Lexical disagreement excerpts (${root.disagreement_items.length})</summary><ol>${disagreements || '<li>None</li>'}</ol></details><details open><summary>Compiled candidate excerpts (${root.compiled_candidates.length})</summary><ol>${candidates || '<li>None</li>'}</ol></details><details><summary>Queue linkage (${root.queue_rows.length})</summary><pre>${escapeHtml(root.queue_rows.map((row) => `${row.closure_id || row.claim_revision_id || 'unknown'} · ${row.source_candidate_linkage?.state || 'UNAVAILABLE'}`).join('\n'))}</pre></details></article>`;
}
function renderLexicalClassificationReview(inventory) {
  const families = [...new Set(inventory.roots.map((root) => root.family))].sort();
  const states = [...new Set(inventory.roots.map((root) => root.classification))].sort();
  const cards = inventory.roots.map((root, index) => reviewCard(root, index + 1)).join('\n');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Stage 2Y-F lexical adjudication</title><style>body{margin:0;background:#f6f7f9;color:#18212f;font:14px/1.45 system-ui,sans-serif}main{max-width:1200px;margin:auto;padding:24px}.controls,.card{background:#fff;border:1px solid #d9dee7;border-radius:8px;padding:16px;margin:14px 0}.controls{position:sticky;top:0;z-index:1}label{margin-right:14px}select{margin-left:6px}h1,h2{margin-top:0}h2{font-size:16px}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f1f3f6;padding:10px;border-radius:4px}ol{padding-left:22px}.evidence{margin:8px 0}mark{background:#ffed9d}.hidden{display:none}</style></head><body><main><h1>Stage 2Y-F lexical adjudication</h1><p>Read-only inventory. Every root remains fail-closed until a signed decision validates against its exact keys.</p><div class="controls"><label>Family <select id="family"><option value="">All</option>${families.map((value) => `<option>${escapeHtml(value)}</option>`).join('')}</select></label><label>State <select id="state"><option value="">All</option>${states.map((value) => `<option>${escapeHtml(value)}</option>`).join('')}</select></label><strong id="count"></strong></div>${cards}</main><script>const cards=[...document.querySelectorAll('.card')],family=document.querySelector('#family'),state=document.querySelector('#state'),count=document.querySelector('#count');function filter(){let visible=0;for(const card of cards){const show=(!family.value||card.dataset.family===family.value)&&(!state.value||card.dataset.state===state.value);card.classList.toggle('hidden',!show);if(show)visible+=1}count.textContent=visible+' / '+cards.length+' roots'}family.onchange=filter;state.onchange=filter;filter()</script></body></html>\n`;
}

function main() {
  const mode = process.argv[2]; const allowUnreviewed = process.argv.includes('--allow-unreviewed');
  if (!['--write', '--check'].includes(mode) || process.argv.slice(2).some((arg) => !['--write', '--check', '--allow-unreviewed'].includes(arg))) throw new Error('usage: --write | --check [--allow-unreviewed]');
  const decisions = json(resolve(DEFAULT_ROOT, DECISIONS)); const inventory = applyClassificationDecisions(buildLexicalClassificationInventory(), decisions); const output = renderLexicalClassificationInventory(inventory); const review = renderLexicalClassificationReview(inventory); const path = resolve(DEFAULT_ROOT, OUTPUT); const reviewPath = resolve(DEFAULT_ROOT, REVIEW_OUTPUT);
  if (mode === '--write') { writeFileSync(path, output); writeFileSync(reviewPath, review); }
  const validOutput = existsSync(path) && readFileSync(path, 'utf8') === output
    && existsSync(reviewPath) && readFileSync(reviewPath, 'utf8') === review;
  const invalid = inventory.roots.filter((root) => !root.evidence_valid).length; const incomplete = inventory.roots.filter((root) => root.evidence_valid && root.classification === 'AMBIGUOUS_NEEDS_REVIEW').length;
  const links = inventory.stats.source_candidate_linkage_totals;
  process.stdout.write(`roots: ${inventory.roots.length} = ${inventory.classification_counts.SAME_CONCEPT_REPEAT} SAME + ${inventory.classification_counts.GENUINE_UNCAPTURED_ITEM} GENUINE + ${inventory.classification_counts.AMBIGUOUS_NEEDS_REVIEW} AMBIGUOUS + ${inventory.classification_counts.INVALID_INPUT} INVALID\naffected claim rows: ${inventory.stats.affected_claim_rows}\nunmatched hits: ${inventory.stats.unmatched_hits}\nselected runs: ${inventory.stats.selected_run_count}, lexical files: ${inventory.stats.lexical_file_count}, governed sections: ${inventory.stats.governed_section_count}\nsource linkage: ${links.SOURCE_CANDIDATE_UNIQUE} unique, ${links.SOURCE_CANDIDATE_AMBIGUOUS} ambiguous, ${links.SOURCE_CANDIDATE_NOT_LOCATED} not located, ${links.SOURCE_CANDIDATE_UNIQUE + links.SOURCE_CANDIDATE_AMBIGUOUS + links.SOURCE_CANDIDATE_NOT_LOCATED} total\n`);
  if (!validOutput) throw new Error('STALE_OUTPUT');
  if (invalid || inventory.decision_validation_errors.length) {
    throw new Error(invalid ? 'INVALID_INPUT' : inventory.decision_validation_errors.join(','));
  }
  if (mode === '--check' && incomplete && !allowUnreviewed) throw new Error('INCOMPLETE_REVIEW');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
export { buildLexicalClassificationInventory, validateRootEvidence, applyClassificationDecisions, renderLexicalClassificationInventory, renderLexicalClassificationReview };
