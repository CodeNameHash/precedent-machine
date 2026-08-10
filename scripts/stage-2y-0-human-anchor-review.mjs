#!/usr/bin/env node

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { isFinalCorpusRun } from './canonical-v2-corpus-review-artifact.mjs';

const require = createRequire(import.meta.url);
const { canonicalJson } = require('../lib/canonical-v2/canonical-bytes');
const {
  buildHumanAnchorMachinePacket,
  buildHumanAnchorReviewPacket,
  buildHumanAnchorKey,
  buildEmptyHumanAnchorDecisionLedger,
  validateHumanAnchorMachinePacket,
  validateHumanAnchorReviewPacket,
  validateHumanAnchorKey,
  validateHumanAnchorDecisionLedger,
  humanAnchorReviewGate,
} = require('../lib/canonical-v2/human-anchor-review');
const { buildAnchorSetFromHumanAnchorLedger } = require('../lib/canonical-v2/calibration-harness');
const { previewResolvedClaimRow } = require('../lib/review-parity/rendered-row-preview');

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '..');
const OUTPUT_DIR = 'evidence/blind-review/2026-08-10';
const MACHINE_OUTPUT = `${OUTPUT_DIR}/stage-2y-0-human-anchor-machine-packet.json`;
const KEY_OUTPUT = `${OUTPUT_DIR}/stage-2y-0-human-anchor-key.json`;
const LEDGER_OUTPUT = `${OUTPUT_DIR}/stage-2y-0-human-anchor-decision-ledger.json`;

function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')); }
function sourceRuns({ repoRoot = ROOT } = {}) {
  const evidenceRoot = resolve(repoRoot, 'evidence/canonical-v2');
  return readdirSync(evidenceRoot).filter(isFinalCorpusRun).sort().map((run) => {
    const dir = resolve(evidenceRoot, run);
    return Object.freeze({
      run,
      manifest: readJson(resolve(dir, 'run-manifest.json')),
      receipt: readJson(resolve(dir, 'run-receipt.json')),
      adapter: readJson(resolve(dir, 'adapter-result.json')),
      resolution: readJson(resolve(dir, 'resolution.json')),
    });
  });
}
function buildHumanAnchorArtefacts({ repoRoot = ROOT } = {}) {
  const machinePacket = buildHumanAnchorMachinePacket({
    runs: sourceRuns({ repoRoot }),
    rendered_row_preview: previewResolvedClaimRow,
  });
  const reviewPacket = buildHumanAnchorReviewPacket({ machine_packet: machinePacket });
  const key = buildHumanAnchorKey({ machine_packet: machinePacket, review_packet: reviewPacket });
  const ledger = buildEmptyHumanAnchorDecisionLedger({ review_packet: reviewPacket });
  const gate = humanAnchorReviewGate({ ledger, review_packet: reviewPacket });
  return Object.freeze({ machinePacket, reviewPacket, key, ledger, gate });
}
function expectedOutputs({ repoRoot = ROOT } = {}) {
  const artefacts = buildHumanAnchorArtefacts({ repoRoot });
  return Object.freeze({
    [resolve(repoRoot, MACHINE_OUTPUT)]: `${canonicalJson(artefacts.machinePacket)}\n`,
    [resolve(repoRoot, KEY_OUTPUT)]: `${canonicalJson(artefacts.key)}\n`,
    [resolve(repoRoot, LEDGER_OUTPUT)]: `${canonicalJson(artefacts.ledger)}\n`,
  });
}

function validateImportedHumanAnchorLedger({ ledgerPath, repoRoot = ROOT } = {}) {
  if (typeof ledgerPath !== 'string' || ledgerPath.length === 0 || !existsSync(ledgerPath)) {
    throw new Error('LEDGER_INPUT_REQUIRED');
  }
  const machinePacket = readJson(resolve(repoRoot, MACHINE_OUTPUT));
  const reviewPacket = buildHumanAnchorReviewPacket({ machine_packet: machinePacket });
  const seedKey = readJson(resolve(repoRoot, KEY_OUTPUT));
  const ledger = readJson(ledgerPath);
  validateHumanAnchorMachinePacket(machinePacket);
  validateHumanAnchorReviewPacket(reviewPacket);
  validateHumanAnchorKey({ key: seedKey, machine_packet: machinePacket, review_packet: reviewPacket });
  validateHumanAnchorDecisionLedger({ ledger, review_packet: reviewPacket });
  const anchorSet = buildAnchorSetFromHumanAnchorLedger({
    machine_packet: machinePacket,
    review_packet: reviewPacket,
    seed_key: seedKey,
    decision_ledger: ledger,
  });
  return Object.freeze({ ledger, anchorSet });
}

function main() {
  const mode = process.argv[2];
  if (mode === '--validate-ledger') {
    if (process.argv.length !== 4) throw new Error('usage: --validate-ledger <ledger-path>');
    const { ledger, anchorSet } = validateImportedHumanAnchorLedger({ ledgerPath: resolve(ROOT, process.argv[3]) });
    process.stdout.write(`human anchor ledger validated: ${ledger.decisions.length}; anchor set: ${anchorSet.anchor_set_id}\n`);
    return;
  }
  if (!['--write', '--check'].includes(mode) || process.argv.length !== 3) throw new Error('usage: --write | --check');
  const outputs = expectedOutputs();
  if (mode === '--write') {
    mkdirSync(resolve(ROOT, OUTPUT_DIR), { recursive: true });
    for (const [file, contents] of Object.entries(outputs)) writeFileSync(file, contents);
  }
  for (const [file, contents] of Object.entries(outputs)) {
    if (!existsSync(file) || readFileSync(file, 'utf8') !== contents) throw new Error(`STALE_OUTPUT:${file}`);
  }
  const { machinePacket, gate } = buildHumanAnchorArtefacts();
  process.stdout.write(`human anchor cards: ${machinePacket.cards.length}; gate: ${gate.reason}\n`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

export { OUTPUT_DIR, MACHINE_OUTPUT, KEY_OUTPUT, LEDGER_OUTPUT, sourceRuns, buildHumanAnchorArtefacts, expectedOutputs, validateImportedHumanAnchorLedger };
