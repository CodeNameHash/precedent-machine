#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { selectLawyerSample } from './stage-2y-structure-corpus-compare.mjs';

const require = createRequire(import.meta.url);
const { canonicalJson, contentId, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'evidence/canonical-v2/stage-2y-structure-migration';
const ROW_CORRECTION_MODE = process.argv.length === 3 && process.argv[2] === '--row-correction';
const COMPARISON_ENTRY_CORRECTION_MODE = process.argv.length === 3 && process.argv[2] === '--comparison-entry-correction';
const CORRECTION_MODE = ROW_CORRECTION_MODE || COMPARISON_ENTRY_CORRECTION_MODE;

function absolute(relativePath) {
  return path.join(ROOT, relativePath);
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(absolute(relativePath), 'utf8'));
}

function binding(relativePath) {
  const bytes = fs.readFileSync(absolute(relativePath));
  return { path: relativePath, byte_length: bytes.length, sha256: sha256Hex(bytes) };
}

function writeJson(relativePath, value) {
  const bytes = Buffer.from(`${canonicalJson(value)}\n`, 'utf8');
  fs.mkdirSync(path.dirname(absolute(relativePath)), { recursive: true });
  fs.writeFileSync(absolute(relativePath), bytes);
  return binding(relativePath);
}

function record(schemaVersion, idKey, payload) {
  return { schema_version: schemaVersion, [idKey]: contentId(schemaVersion, payload), ...payload };
}

function projectionSets() {
  const sealedRoot = `${BASE}/shadow/${COMPARISON_ENTRY_CORRECTION_MODE
    ? 'm6-comparison-entry-correction'
    : ROW_CORRECTION_MODE ? 'm6-row-correction' : 'm6'}/projection`;
  const sealed = fs.readdirSync(absolute(sealedRoot)).filter((name) => name.endsWith('.agreement-projection.json')).sort()
    .map((name) => readJson(`${sealedRoot}/${name}`));
  const additiveRoot = `${BASE}/shadow/m7-generalisation${COMPARISON_ENTRY_CORRECTION_MODE
    ? '-comparison-entry-correction'
    : ROW_CORRECTION_MODE ? '-row-correction' : ''}`;
  const additive = fs.readdirSync(absolute(additiveRoot)).sort().flatMap((candidateKey) => {
    const relativePath = `${additiveRoot}/${candidateKey}/m6/agreement-projection.json`;
    if (!fs.existsSync(absolute(relativePath))) return [];
    return [{ candidateKey, projection: readJson(relativePath) }];
  });
  return { sealed, additive };
}

function sourceTextForAmbiguity(item, indexByAgreement) {
  if (item.item_kind !== 'PARSER_AMBIGUITY') return item;
  const index = indexByAgreement.get(item.agreement_id);
  const bytes = Buffer.from(index.source_binding.canonical_text, 'utf8');
  return {
    ...item,
    source_excerpt: bytes.subarray(item.source_span.start_byte, item.source_span.end_byte).toString('utf8'),
  };
}

if ((!CORRECTION_MODE && process.argv.length !== 2)
  || (CORRECTION_MODE && process.argv.length !== 3)) {
  throw new Error('use no arguments, --row-correction, or --comparison-entry-correction');
}

const authorityPath = `${BASE}/control/m7-generalisation-authority.json`;
const correctionAuthorityPath = `${BASE}/control/m7-${COMPARISON_ENTRY_CORRECTION_MODE
  ? 'comparison-entry-correction'
  : 'row-correction'}-authority.json`;
const generalisationReceiptPath = `${BASE}/receipts/stage-2y-structure-m7-generalisation${COMPARISON_ENTRY_CORRECTION_MODE
  ? '-comparison-entry-correction'
  : ROW_CORRECTION_MODE ? '-row-correction' : ''}.json`;
const authority = readJson(authorityPath);
const correctionAuthority = CORRECTION_MODE ? readJson(correctionAuthorityPath) : null;
const generalisationReceipt = readJson(generalisationReceiptPath);
const familyOrder = readJson(`${BASE}/control/m5-calibration-policy.json`).family_order_contract.families;
const reviewRoot = `${BASE}/shadow/m7${COMPARISON_ENTRY_CORRECTION_MODE
  ? '-comparison-entry-correction'
  : ROW_CORRECTION_MODE ? '-row-correction' : ''}`;
const knownLossLedger = readJson(`${reviewRoot}/known-loss-244-ledger.json`);
const ambiguityLedger = readJson(`${reviewRoot}/m2-inline-23-ledger.json`);
const { sealed, additive } = projectionSets();

if (authority.blind_sample_policy.sample_size !== 50
  || authority.blind_sample_policy.answers_opened !== false
  || generalisationReceipt.status !== 'PASS'
  || generalisationReceipt.counts.combined_agreements !== 10) {
  throw new Error('M7 sample entry gate failed');
}

const samplePolicyPayload = {
  stage: 'M7',
  policy_state: 'FROZEN_BEFORE_ANSWERS_OPENED',
  combined_ten_corpus_digest: generalisationReceipt.combined_ten_corpus_digest,
  authority_binding: binding(authorityPath),
  ...(CORRECTION_MODE ? { correction_authority_binding: binding(correctionAuthorityPath) } : {}),
  generalisation_receipt_binding: binding(generalisationReceiptPath),
  sample_size: 50,
  selection_method: 'RISK_WEIGHTED_DETERMINISTIC',
  random_seed: authority.blind_sample_policy.random_seed,
  strata: [
    'EVERY_REGISTERED_FAMILY',
    'EACH_ADDITIVE_AGREEMENT',
    'EACH_KNOWN_LOSS_CLASS',
    'GROUPED_ROWS',
    'REVIEW_ONLY_NO_NORMAL_ROW',
    'PARSER_AMBIGUITY',
  ],
  acceptance_threshold: {
    required_correct_answers: 50,
    permitted_incorrect_answers: 0,
    permitted_cannot_judge_answers: 0,
    style_comment_treatment: 'DOES_NOT_FAIL_WHEN_LEGAL_MEANING_IS_CORRECT',
  },
  decision_17_error_class_rule: 'EACH_ERROR_CLASS_IS_MEASURED_SEPARATELY_AND_CANNOT_BE_HIDDEN_BY_AN_OVERALL_AVERAGE',
  cannot_judge_rule: 'FAIL_THE_AFFECTED_ITEM_TYPE_AND_RETURN_IT_FOR_REPAIR',
  reviewer: {
    identity: 'BEN_GOODCHILD',
    authority: 'QUALIFIED_M_AND_A_LAWYER_AND_PROGRAMME_OWNER',
  },
  approval: {
    approver: 'BEN_GOODCHILD',
    approved_at: '2026-08-12',
    approval_text: 'Ok',
    approval_context: COMPARISON_ENTRY_CORRECTION_MODE
      ? 'Approved correction of the unusable comparison entries across the lawyer packet. Exact source remains separate evidence.'
      : CORRECTION_MODE
      ? 'Approved correction of the withdrawn source-copy rows and reuse of the unchanged 50-of-50 legal threshold.'
      : 'Approved the recommended M7 rule that all 50 items must be legally correct and cannot-judge fails the affected type.',
  },
  answers_opened: false,
};
const samplePolicy = record('STAGE_2Y_LAWYER_SAMPLE_POLICY/V1', 'lawyer_sample_policy_id', samplePolicyPayload);
const policyPath = `${BASE}/control/lawyer-sample-policy${COMPARISON_ENTRY_CORRECTION_MODE
  ? '-comparison-entry-correction'
  : ROW_CORRECTION_MODE ? '-row-correction' : ''}.json`;
const policyBinding = writeJson(policyPath, samplePolicy);

const sealedRows = sealed.flatMap((projection) => projection.rows);
const additiveRows = additive.flatMap(({ candidateKey, projection }) =>
  projection.rows.map((row) => ({ ...row, _candidate_key: candidateKey })));
const additiveReviews = additive.flatMap(({ candidateKey, projection }) =>
  projection.review_rows.map((review, index) => ({ candidateKey, review, index })));
let items = selectLawyerSample({
  familyOrder,
  sealedRows,
  additiveRows,
  additiveReviews,
  ambiguityLedger,
  knownLossLedger,
  samplePolicy,
});

const indexByAgreement = new Map();
for (const name of fs.readdirSync(absolute(`${BASE}/shadow/m2`)).filter((entry) => entry.endsWith('.agreement-index.json'))) {
  const index = readJson(`${BASE}/shadow/m2/${name}`);
  indexByAgreement.set(index.source_binding.agreement_id, index);
}
items = items.map((item) => sourceTextForAmbiguity(item, indexByAgreement));

const lossClassesByRow = new Map();
for (const member of knownLossLedger.members) {
  if (!member.row_id) continue;
  if (!lossClassesByRow.has(member.row_id)) lossClassesByRow.set(member.row_id, new Set());
  lossClassesByRow.get(member.row_id).add(member.family_key);
}
items = items.map((item) => ({
  ...item,
  risk_strata: [
    item.family_key ? 'FAMILY_OUTPUT' : null,
    item.candidate_key ? 'ADDITIVE_AGREEMENT' : null,
    item.grouping_decision === 'ONE_COMPOUND_PROPOSITION' || (item.lineage?.analysis_claim_ids?.length ?? 0) > 1 ? 'GROUPED_ROW' : null,
    item.item_kind === 'REVIEW_ONLY_NO_NORMAL_ROW' ? 'NO_OUTPUT' : null,
    item.item_kind === 'PARSER_AMBIGUITY' ? 'AMBIGUITY' : null,
    ...(lossClassesByRow.get(item.row_id) ?? []),
  ].filter(Boolean),
}));

if (CORRECTION_MODE) {
  const invalidItems = items.filter((item) => {
    if (item.item_kind !== 'SOURCE_TO_ROW') return false;
    const expanded = String(item.expanded_row || '').replace(/\s+/g, ' ').trim();
    const source = String(item.source_excerpt || '').replace(/\s+/g, ' ').trim();
    if (!COMPARISON_ENTRY_CORRECTION_MODE) return expanded === source;
    return expanded === source
      || !expanded.startsWith('Comparison point:')
      || /M7_DETERMINISTIC|SOURCE_PROVISION|\b[A-Z][A-Z0-9]+_[A-Z0-9_]+\b|\b(?:IOC|TPB)\b|\b[a-f0-9]{24,}\b/i.test(expanded)
      || (source.length > 160 && expanded.includes(source.slice(0, 120)));
  });
  if (invalidItems.length > 0) throw new Error(`replacement sample contains ${invalidItems.length} invalid comparison entries`);
}

const familyCoverage = new Set(items.filter((item) => item.family_key).map((item) => item.family_key));
const additiveCoverage = new Set(items.filter((item) => item.candidate_key).map((item) => item.candidate_key));
const lossCoverage = new Set(items.flatMap((item) => item.risk_strata)
  .filter((state) => ['DNO_INDEMNIFICATION', 'MAE_DEFINITION', 'NO_OTHER_REPS_FRAUD', 'NO_SHOP'].includes(state)));
if (items.length !== 50 || familyCoverage.size !== 25 || additiveCoverage.size !== 3 || lossCoverage.size !== 4
  || !items.some((item) => item.risk_strata.includes('GROUPED_ROW'))
  || !items.some((item) => item.risk_strata.includes('NO_OUTPUT'))
  || !items.some((item) => item.risk_strata.includes('AMBIGUITY'))
  || items.some((item) => !item.source_excerpt)) {
  throw new Error(`M7 lawyer sample coverage failed: ${canonicalJson({
    items: items.length,
    families: familyCoverage.size,
    additive: [...additiveCoverage],
    loss_classes: [...lossCoverage],
    grouped: items.filter((item) => item.risk_strata.includes('GROUPED_ROW')).length,
    no_output: items.filter((item) => item.risk_strata.includes('NO_OUTPUT')).length,
    ambiguity: items.filter((item) => item.risk_strata.includes('AMBIGUITY')).length,
    missing_source: items.filter((item) => !item.source_excerpt).length,
  })}`);
}

const packetPayload = {
  stage: 'M7',
  packet_state: CORRECTION_MODE ? 'SEALED_REPLACEMENT_BEFORE_REVIEW' : 'SEALED_BEFORE_REVIEW',
  combined_ten_corpus_digest: generalisationReceipt.combined_ten_corpus_digest,
  lawyer_sample_policy_binding: policyBinding,
  sample_size: items.length,
  coverage: {
    family_count: familyCoverage.size,
    additive_agreement_count: additiveCoverage.size,
    known_loss_class_count: lossCoverage.size,
    grouped_row_count: items.filter((item) => item.risk_strata.includes('GROUPED_ROW')).length,
    no_output_count: items.filter((item) => item.risk_strata.includes('NO_OUTPUT')).length,
    ambiguity_count: items.filter((item) => item.risk_strata.includes('AMBIGUITY')).length,
  },
  items,
  expected_answers_included: false,
};
const packet = record('STAGE_2Y_LAWYER_REVIEW_PACKET/V1', 'lawyer_review_packet_id', packetPayload);
const packetPath = `${reviewRoot}/lawyer-review-packet.json`;
const packetBinding = writeJson(packetPath, packet);

const ledgerPayload = {
  stage: 'M7',
  ledger_state: 'NOT_STARTED',
  combined_ten_corpus_digest: generalisationReceipt.combined_ten_corpus_digest,
  lawyer_sample_policy_binding: policyBinding,
  lawyer_review_packet_binding: packetBinding,
  reviewer: samplePolicy.reviewer,
  decisions: [],
  counts: { total: 50, answered: 0, correct: 0, incorrect: 0, cannot_judge: 0, remaining: 50 },
  gate_state: 'PENDING_HUMAN_REVIEW',
};
const ledger = record('STAGE_2Y_LAWYER_DECISION_LEDGER/V1', 'lawyer_decision_ledger_id', ledgerPayload);
const ledgerPath = `${reviewRoot}/lawyer-decision-ledger.json`;
const ledgerBinding = writeJson(ledgerPath, ledger);

process.stdout.write(`${canonicalJson({
  status: 'PASS_SAMPLE_FROZEN',
  policy_binding: policyBinding,
  packet_binding: packetBinding,
  decision_ledger_binding: ledgerBinding,
  packet_id: packet.lawyer_review_packet_id,
  sample_size: packet.sample_size,
  coverage: packet.coverage,
})}\n`);
