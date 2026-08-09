#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = 'evidence/canonical-v2/stage-2y-0-joint-sweep.json';
const CONFIG = 'evidence/canonical-v2/stage-2y-0-joint-sweep-config.json';
const HUMAN_ANCHOR_DIRECTORY = 'evidence/blind-review/2026-08-09';
const DEFINED_TERM_REPLAY = 'evidence/canonical-v2/stage-2y-d-defined-term-replay.json';

const { canonicalJson, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const {
  buildJointSweepConfig,
  runBlockedJointSweep,
  sealJointSweepRunEvidence,
} = require('../lib/canonical-v2/stage-2y-joint-sweep');
const {
  buildHumanAnchorReviewPacket,
  humanAnchorReviewGate,
} = require('../lib/canonical-v2/human-anchor-review');
const {
  FINAL_CORPUS_DEFINED_TERM_BINDINGS,
} = require('../lib/canonical-v2/native-producer/same-deal-defined-term-resolution');
const { isFinalCorpusRun } = await import('./canonical-v2-corpus-review-artifact.mjs');

function fail(code, message) {
  throw new Error(`${code}: ${message}`);
}

function readJson(relativePath) {
  const path = resolve(ROOT, relativePath);
  if (!existsSync(path)) fail('MISSING_INPUT', relativePath);
  return JSON.parse(readFileSync(path, 'utf8'));
}

function digestFile(relativePath) {
  const path = resolve(ROOT, relativePath);
  if (!existsSync(path)) fail('MISSING_INPUT', relativePath);
  return sha256Hex(readFileSync(path));
}

function countBy(rows, key) {
  return Object.fromEntries([...rows.reduce((counts, row) => {
    const value = row[key];
    counts.set(value, (counts.get(value) || 0) + 1);
    return counts;
  }, new Map()).entries()].sort(([left], [right]) => String(left).localeCompare(String(right))));
}

function compactBlockerRows(rows) {
  return rows.map((row) => ({
    deal: row.deal,
    ledger_id: row.ledger_id,
    requested_party: row.typed_absence_or_conflict?.requested_party || null,
  })).sort((left, right) => left.deal.localeCompare(right.deal)
    || left.ledger_id.localeCompare(right.ledger_id));
}

function finalCorpusDeals() {
  const evidenceRoot = resolve(ROOT, 'evidence/canonical-v2');
  const deals = new Set();
  for (const entry of readdirSync(evidenceRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || !isFinalCorpusRun(entry.name)) continue;
    const manifest = readJson(`evidence/canonical-v2/${entry.name}/run-manifest.json`);
    if (typeof manifest.deal !== 'string' || !manifest.deal) fail('INVALID_MANIFEST', entry.name);
    deals.add(manifest.deal);
  }
  return [...deals].sort();
}

function buildEvidenceBlockers(definedTermReplay) {
  const rows = definedTermReplay.ledger_rows;
  if (!Array.isArray(rows)) fail('DEFINED_TERM_REPLAY_INVALID', 'ledger_rows are required');
  const falseAbsences = rows.filter((row) => (
    row.definition_gap_classification?.classification === 'FALSE_NO_DEFINITION_MISSING_KDT_EVIDENCE'
  ));
  const trueFallbacks = rows.filter((row) => (
    row.definition_gap_classification?.classification === 'TRUE_AGREEMENT_DEFINITION_ABSENCE'
  ));
  if (falseAbsences.length !== 18 || trueFallbacks.length !== 3) {
    fail('DEFINED_TERM_REPLAY_CENSUS_MISMATCH', 'expected 18 false absences and 3 true fallbacks');
  }
  const notAssessable = finalCorpusDeals().filter((deal) => !Object.hasOwn(FINAL_CORPUS_DEFINED_TERM_BINDINGS, deal))
    .map((deal) => ({ deal, family: 'REPRESENTATIONS', reason: 'MISSING_FINAL_CORPUS_DEFINED_TERM_BINDING' }));
  return {
    b_d: {
      false_no_definition_missing_kdt_evidence: {
        count: falseAbsences.length,
        by_deal: countBy(falseAbsences, 'deal'),
        rows: compactBlockerRows(falseAbsences),
      },
      true_agreement_definition_absence: {
        count: trueFallbacks.length,
        by_deal: countBy(trueFallbacks, 'deal'),
        rows: compactBlockerRows(trueFallbacks),
      },
      not_assessable: notAssessable,
    },
  };
}

function buildReport() {
  const config = buildJointSweepConfig(readJson(CONFIG));
  const machinePacket = readJson(`${HUMAN_ANCHOR_DIRECTORY}/stage-2y-0-human-anchor-machine-packet.json`);
  const ledger = readJson(`${HUMAN_ANCHOR_DIRECTORY}/stage-2y-0-human-anchor-decision-ledger.json`);
  const reviewPacket = buildHumanAnchorReviewPacket({ machine_packet: machinePacket });
  const humanAnchorGate = humanAnchorReviewGate({ ledger, review_packet: reviewPacket });
  const blocked = runBlockedJointSweep({ config, human_anchor_gate: humanAnchorGate });
  const definedTermReplay = readJson(DEFINED_TERM_REPLAY);
  return sealJointSweepRunEvidence({
    ...blocked,
    model_calls: 0,
    writes_performed: false,
    serving_activated: false,
    evidence_blockers: buildEvidenceBlockers(definedTermReplay),
    input_digests: {
      config: digestFile(CONFIG),
      human_anchor_machine_packet: digestFile(`${HUMAN_ANCHOR_DIRECTORY}/stage-2y-0-human-anchor-machine-packet.json`),
      human_anchor_decision_ledger: digestFile(`${HUMAN_ANCHOR_DIRECTORY}/stage-2y-0-human-anchor-decision-ledger.json`),
      defined_term_replay: digestFile(DEFINED_TERM_REPLAY),
    },
  });
}

function render(report) {
  return `${JSON.stringify(report, null, 2)}\n`;
}

function main(argv = process.argv.slice(2)) {
  if (argv.length !== 1 || !['--write', '--check'].includes(argv[0])) fail('USAGE', 'use --write or --check');
  const report = buildReport();
  const output = render(report);
  const outputPath = resolve(ROOT, OUTPUT);
  if (argv[0] === '--write') writeFileSync(outputPath, output);
  if (!existsSync(outputPath) || readFileSync(outputPath, 'utf8') !== output) fail('STALE_OUTPUT', OUTPUT);
  process.stdout.write(`${argv[0]} ${OUTPUT}\n`);
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}

export { OUTPUT, CONFIG, buildEvidenceBlockers, buildReport, render, main };
