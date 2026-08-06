#!/usr/bin/env node
/**
 * scripts/nets-eligibility-report.mjs
 *
 * Read-only, OFFLINE report: runs the comparator-wiring two-pass flow
 * (docs/superpowers/specs/2026-08-02-comparator-wiring-design.md, section
 * 4) over the three committed live-run fixtures (TopBuild/F28, Skechers,
 * Modiv) + their re-exported v1 snapshots
 * (tests/fixtures/canonical-v2/v1v2-comparator/), and prints the queue-data
 * summary Ben was promised: per deal, claims resolved / both-nets-clean /
 * blocked-by (condition breakdown) / v1 recall (Tier 1) outcomes.
 *
 * NEVER TOUCHES THE NETWORK OR A DATABASE. Every input is a fixture already
 * committed to this repo -- no --deal argument, no Supabase credentials, no
 * live model call. This is the read-only report script itself, not the
 * (separate, explicitly gated) v1 snapshot export
 * (scripts/export-v1-provision-snapshot.mjs).
 *
 * HONESTY PIN (spec "Why", audit B-M1): both_nets_clean is ZERO on every
 * claim in all three runs BY CONSTRUCTION this slice -- every resolved
 * claim is REP-family, REP cards carry no Tier 2 values (VALUE_MAPPING_TABLE
 * has no real REP entries), so condition 1 stays
 * V1_V2_COMPARATOR_INAPPLICABLE_TO_CLAIM under Ben's ruled option A. This
 * script's own summary counts field for both_nets_clean is OMITTED (present
 * only when > 0) for exactly that reason -- see `summarizeDeal` below. This
 * report is the CONDITION BREAKDOWN becoming visible, typed data, never a
 * claim that auto-pass "would open" -- activation remains Ben + sampling.
 *
 * Usage: node scripts/nets-eligibility-report.mjs [--json]
 *
 * CURRENTLY BLOCKED END-TO-END (as of commit 0d17ad00, "Phase 1
 * production-readiness controls", 2026-08-04). That commit made
 * `runTwoPassFlow` refuse a snapshot without verified
 * `snapshot_identity_evidence` (tests/nets-eligibility-report-identity-
 * fence.test.js), and, correctly, could no longer trust the raw
 * `governed_deal_key` `loadSkechersReplayRun()` used to hand-pass into
 * `buildAdmittedSemanticSourceContext()` (a derived value, not issued/
 * verified identity evidence) -- so the same commit made
 * `loadSkechersReplayRun()` throw unconditionally as its very first
 * statement, leaving ~38 lines of the original replay below it dead. That
 * fence is correctly scoped to Skechers in principle. In practice, `main()`'s
 * `deals` loop has no per-deal try/catch, so today running this script
 * produces NO output at all for ANY deal -- not just Skechers, but also
 * TopBuild and Modiv, which have complete data and nothing to do with the
 * Skechers identity gap (see the last successful run, captured before this
 * commit, in docs/archive/handoffs/NETS-ELIGIBILITY-2026-08-02.md). Until
 * Skechers has real issued identity evidence, or `main()` is changed to
 * isolate a per-deal failure instead of aborting the whole run, this script
 * cannot produce the report its own header above describes.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');

const {
  resolveCandidates, computeSectionCandidatesForLexicalDigest,
} = require(join(REPO_ROOT, 'lib/canonical-v2/native-producer/candidate-resolution'));
const { buildLexicalDisagreementReceipt } = require(join(REPO_ROOT, 'lib/canonical-v2/native-producer/lexical-disagreement-net'));
const { buildV1V2ComparisonReceipt } = require(join(REPO_ROOT, 'lib/canonical-v2/native-producer/v1v2-comparator'));
const { compileFixtureContractV13 } = require(join(REPO_ROOT, 'lib/canonical-v2/contract-bundle'));
const { buildAdmittedSemanticSourceContext } = require(join(REPO_ROOT, 'lib/canonical-v2/admitted-semantic-source'));
const { buildSecEdgarIntakeCapture } = require(join(REPO_ROOT, 'lib/canonical-v2/sec-edgar-intake-capture'));
const { convertSecHtmlToCanonicalText } = require(join(REPO_ROOT, 'lib/canonical-v2/sec-html-canonical-text'));
const { verifySecHtmlCanonicalText } = require(join(REPO_ROOT, 'lib/canonical-v2/sec-html-canonical-text-verifier'));
const { buildVerifiedSecSourceAdmission } = require(join(REPO_ROOT, 'lib/canonical-v2/sec-source-admission'));
const { runNativeExtraction } = require(join(REPO_ROOT, 'lib/canonical-v2/native-producer/native-extraction-run'));
const { shapeProposals } = require(join(REPO_ROOT, 'lib/canonical-v2/native-producer/anthropic-provider'));
const { parseJSON } = require(join(REPO_ROOT, 'lib/parser-v2/parse-json'));
const { sha256Hex } = require(join(REPO_ROOT, 'lib/canonical-v2/canonical-bytes'));

const AGREEMENT_DATE = '2026-04-18';
const CONTRACT_BUNDLE_V13 = compileFixtureContractV13();
const FIXTURES_DIR = join(REPO_ROOT, 'tests', 'fixtures', 'canonical-v2');

function loadFixtureJson(dealDir, name) {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, dealDir, name), 'utf8'));
}

function loadSnapshot(name) {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, 'v1v2-comparator', name), 'utf8'));
}

function sectionBodyText(canonicalText, section) {
  return Buffer.from(canonicalText, 'utf8').slice(section.start, section.end).toString('utf8');
}

function loadDirectRun(dealDir) {
  const runReceipt = loadFixtureJson(dealDir, 'run-receipt.json');
  const adapterResult = loadFixtureJson(dealDir, 'adapter-result.json');
  return { runReceipt, admittedSourceContext: adapterResult.admitted_source_contexts[0] };
}

// Skechers' committed run-receipt.json is the pre-citation-fix recording
// (tests/canonical-v2-skechers-replay.test.js) -- replayed OFFLINE through
// the real admission chain against the committed raw HTML fixture + the
// committed recorded raw model response, exactly as that test and
// tests/canonical-v2-comparator-wiring-replay.test.js do. Still zero
// network/DB access: skechers-raw-fetched.htm is a committed fixture.
async function loadSkechersReplayRun() {
  throw new Error('NETS eligibility report is blocked: no verified snapshot identity binding exists for Skechers. A raw governed deal key cannot substitute for issued allocation and reviewed bridge evidence.');
  const dealDir = 'skechers-first-live-run';
  const retrievalUrl = 'https://www.sec.gov/Archives/edgar/data/1065837/000119312525112159/d943603dex21.htm';
  const rawBytes = readFileSync(join(FIXTURES_DIR, dealDir, 'skechers-raw-fetched.htm'));
  const retrievalPolicyDigest = sha256Hex(
    'Skechers first live run pinning fetch: User-Agent "precedent-machine research bengoodchild@gmail.com", no redirects followed.',
  );
  const capture = buildSecEdgarIntakeCapture({
    retrieval_url: retrievalUrl, final_url: retrievalUrl, status_code: 200,
    content_type: 'text/html; charset=UTF-8', retrieved_at: '2026-08-01T12:34:55.229Z',
    retrieval_policy_digest: retrievalPolicyDigest, redirect_count: 0, response_bytes: rawBytes,
  });
  const conversion = convertSecHtmlToCanonicalText(capture);
  const verification = verifySecHtmlCanonicalText({ capture, conversion });
  const admissionBundle = buildVerifiedSecSourceAdmission({ capture, conversion, verification });
  const admittedSourceContext = buildAdmittedSemanticSourceContext({
    immutable_source_document: admissionBundle.immutable_source_document,
    source_admission_manifest: admissionBundle.source_admission_manifest,
    semantic_extraction_input_envelope: admissionBundle.semantic_extraction_input_envelope,
    conversion,
    deal_admission_id: sha256Hex('deal-admission:skechers-first-live-run'),
    source_ordinal: 0,
  });
  const recorded = loadFixtureJson(dealDir, 'native-producer-recorded-response.json');
  const recordedParsed = parseJSON(recorded.raw_response_text);
  const runReceipt = await runNativeExtraction({
    source_text: conversion.canonical_text, document_hash: admittedSourceContext.document_hash,
    section_references: ['3.7'], contract_bundle: CONTRACT_BUNDLE_V13,
    definitions: { known_definitions: [] },
    provider: async ({ governed_scope: governedScope }) => {
      const { proposals, evidence_residuals: evidenceResiduals } = shapeProposals(recordedParsed, governedScope.source_text);
      return {
        provider_id: 'nets-eligibility-report/skechers/v1', model_id: 'x', prompt: 'x',
        proposals, evidence_residuals: evidenceResiduals,
      };
    },
  });
  return { runReceipt, admittedSourceContext };
}

async function runTwoPassFlow({ runReceipt, admittedSourceContext, snapshot }) {
  if (!snapshot?.snapshot_identity_evidence) {
    throw new Error('NETS eligibility report is blocked: V1 snapshot lacks verified issued identity binding.');
  }
  const canonicalText = admittedSourceContext.canonical_text.text;
  const plain = resolveCandidates({
    run_receipt: runReceipt, contract_vocabulary: CONTRACT_BUNDLE_V13,
    admitted_source_context: admittedSourceContext, agreement_date: AGREEMENT_DATE,
  });

  const lexicalDisagreement = {};
  for (const section of runReceipt.resolved_sections) {
    const candidates = computeSectionCandidatesForLexicalDigest(plain.resolved, section.section_reference);
    const governedSection = {
      section_ref: section.section_reference,
      text: sectionBodyText(canonicalText, section),
      text_sha256: section.text_sha256,
    };
    lexicalDisagreement[section.section_reference] = buildLexicalDisagreementReceipt({ governed_section: governedSection, candidates });
  }

  const attemptedSectionScope = [...new Set(plain.resolved.map((entry) => {
    const citationValidation = entry.compiled_candidate && entry.compiled_candidate.citation_validation;
    if (!citationValidation) return null;
    if (citationValidation.validation_source === 'CORROBORATED_BY_DOCUMENT_TEXT'
      && typeof citationValidation.normalized_citation === 'string') return citationValidation.normalized_citation;
    return typeof citationValidation.derived_citation === 'string' ? citationValidation.derived_citation : null;
  }).filter(Boolean))];

  const comparison = buildV1V2ComparisonReceipt({ v1_snapshot: snapshot, v2_side: plain, attempted_section_scope: attemptedSectionScope });

  const wired = resolveCandidates({
    run_receipt: runReceipt, contract_vocabulary: CONTRACT_BUNDLE_V13,
    admitted_source_context: admittedSourceContext, agreement_date: AGREEMENT_DATE,
    v1v2_comparison: comparison, lexical_disagreement: lexicalDisagreement,
  });

  return { plain, wired, comparison };
}

// Per-deal summary. `both_nets_clean` is OMITTED entirely when zero (spec
// pin: "the review-queue artifact's counts field is therefore ABSENT
// (present only when > 0)") -- this report's own honesty discipline, not
// candidate-resolution.js's (which always carries the field, explicit 0s).
function summarizeDeal(name, { plain, wired, comparison }) {
  const blockedBy = {};
  let bothNetsClean = 0;
  for (const entry of wired.resolved) {
    if (entry.triage.both_nets_clean) bothNetsClean += 1;
    for (const condition of entry.triage.unevaluated_conditions) {
      blockedBy[condition] = (blockedBy[condition] || 0) + 1;
    }
  }
  const summary = {
    deal: name,
    claims_resolved: wired.resolved.length,
    review_queue: wired.review_queue.length,
    open_world: plain.open_world.length,
    blocked_by: blockedBy,
    v1_recall: comparison.counts.by_tier1_outcome,
    v1_cards_total: comparison.provision_outcomes.length,
  };
  if (bothNetsClean > 0) summary.both_nets_clean = bothNetsClean;
  return summary;
}

async function main() {
  const jsonOutput = process.argv.includes('--json');

  const deals = [
    { name: 'TopBuild', load: async () => ({ ...loadDirectRun('f28-third-live-run'), snapshot: loadSnapshot('topbuild-v1-provision-snapshot.json') }) },
    { name: 'Skechers', load: async () => ({ ...(await loadSkechersReplayRun()), snapshot: loadSnapshot('skechers-v1-provision-snapshot.json') }) },
    { name: 'Modiv', load: async () => ({ ...loadDirectRun('modiv-first-live-run'), snapshot: loadSnapshot('modiv-v1-provision-snapshot.json') }) },
  ];

  const summaries = [];
  for (const deal of deals) {
    const run = await deal.load();
    const result = await runTwoPassFlow(run);
    summaries.push(summarizeDeal(deal.name, result));
  }

  if (jsonOutput) {
    process.stdout.write(`${JSON.stringify(summaries, null, 2)}\n`);
    return summaries;
  }

  process.stdout.write(
    'NETS ELIGIBILITY REPORT -- both_nets_clean is ZERO by construction this\n'
    + 'slice under Ben\'s option A (docs/superpowers/specs/2026-08-02-\n'
    + 'comparator-wiring-design.md, "Why"): every resolved claim is REP-\n'
    + 'family, REP cards carry no Tier 2 values, so condition 1 stays\n'
    + 'V1_V2_COMPARATOR_INAPPLICABLE_TO_CLAIM (or is already blocked by a\n'
    + 'SECTION_MISMATCH) -- working as designed, not a defect. Nothing below\n'
    + 'is an auto-pass claim; activation remains Ben + sampling.\n\n',
  );
  for (const summary of summaries) {
    process.stdout.write(`=== ${summary.deal} ===\n`);
    process.stdout.write(`  claims resolved:   ${summary.claims_resolved}\n`);
    process.stdout.write(`  review queue:      ${summary.review_queue}\n`);
    process.stdout.write(`  open_world:        ${summary.open_world}\n`);
    process.stdout.write(`  both_nets_clean:   ${summary.both_nets_clean || 0}${summary.both_nets_clean ? '' : ' (absent from JSON summary -- zero)'}\n`);
    process.stdout.write(`  blocked_by:        ${JSON.stringify(summary.blocked_by)}\n`);
    process.stdout.write(`  v1 recall (Tier1): ${JSON.stringify(summary.v1_recall)}\n`);
    process.stdout.write(`  v1 cards total:    ${summary.v1_cards_total}\n\n`);
  }
  return summaries;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    process.stderr.write(`${error.stack || error.message || error}\n`);
    process.exit(1);
  });
}

export { main, summarizeDeal, runTwoPassFlow };
