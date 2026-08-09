#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildLexicalClassificationInventory } from './stage-2y-f-lexical-classification.mjs';
import { validateTerraAdjudicationArtifact } from './stage-2y-f-terra-adjudication.mjs';

const require = createRequire(import.meta.url);
const { canonicalJson, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(SCRIPT_DIR, '..');
const DEFAULT_TERRA_INPUT = 'evidence/canonical-v2/stage-2y-f-terra-adjudication.json';
const DEFAULT_OUTPUT = 'evidence/canonical-v2/stage-2y-f-concept-coverage-simulation.json';
const SCHEMA_VERSION = 'STAGE_2Y_F_CONCEPT_COVERAGE_SIMULATION/V1';
const CLASSIFICATIONS = ['SAME_CONCEPT_REPEAT', 'GENUINE_UNCAPTURED_ITEM', 'AMBIGUOUS_NEEDS_REVIEW', 'INVALID_INPUT'];

function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')); }
function sorted(values) { return [...new Set(values || [])].sort(); }
function hash(value) { return `sha256:${sha256Hex(Buffer.from(canonicalJson(value), 'utf8'))}`; }
function rootIdentity(root) {
  return {
    root_id: root.root_id,
    evidence_fingerprint: root.evidence_fingerprint,
    run_name: root.run_name,
    deal: root.deal,
    family: root.family,
    section_reference: root.section_reference,
    concept_key: root.concept_key,
  };
}
function terraBinding(root) {
  return {
    terra_artifact_id: root.decision?.terra_artifact_id || null,
    terra_call_id: root.decision?.terra_call_id || null,
    terra_decision_id: root.decision?.terra_decision_id || null,
  };
}
function rawDecisionCounts(artifact) {
  return Object.fromEntries(CLASSIFICATIONS.map((classification) => [
    classification,
    (artifact.decisions || []).filter((decision) => decision?.classification === classification).length,
  ]));
}
function artifactId(simulation) {
  const { artifact_id, ...body } = simulation;
  return hash(body);
}
function orderedRoots(roots) { return [...roots].sort((left, right) => left.root_id.localeCompare(right.root_id)); }
function coverageRecord(root) {
  return {
    ...rootIdentity(root),
    disposition: 'CONCEPT_COVERED_REPORT_ONLY',
    classification_source: root.classification_source,
    covered_claim_revision_ids: sorted(root.decision?.covered_claim_revision_ids),
    covered_disagreement_ids: sorted(root.decision?.covered_disagreement_ids),
    ...terraBinding(root),
  };
}
function genuineHoldRecord(root) {
  return {
    ...rootIdentity(root),
    disposition: 'HELD_GENUINE_UNCAPTURED_ITEM',
    classification_source: root.classification_source,
    follow_up_id: root.decision?.follow_up_id || null,
    proving_disagreement_ids: sorted(root.decision?.proving_disagreement_ids),
    ...terraBinding(root),
  };
}
function ambiguousHoldRecord(root) {
  return {
    ...rootIdentity(root),
    disposition: 'HELD_AMBIGUOUS_NEEDS_REVIEW',
    raw_classification: root.decision?.classification || null,
    classification_source: root.classification_source,
    decision_errors: sorted(root.decision_error),
    ...terraBinding(root),
  };
}

function buildConceptCoverageSimulation({
  repoRoot = DEFAULT_ROOT,
  inventory = null,
  terraArtifact = null,
  validateArtifact = validateTerraAdjudicationArtifact,
} = {}) {
  const sourceInventory = inventory || buildLexicalClassificationInventory({ repoRoot });
  const sourceArtifact = terraArtifact || readJson(resolve(repoRoot, DEFAULT_TERRA_INPUT));
  const checked = validateArtifact({
    inventory: sourceInventory,
    artifact: sourceArtifact,
    expectedRootCount: sourceInventory.roots.length,
  });
  if (!checked?.ok) throw new Error(`TERRA_ARTIFACT_INVALID:${sorted(checked?.errors).join(',') || 'UNKNOWN'}`);
  const appliedRoots = orderedRoots(checked.applied?.roots || []);
  if (appliedRoots.length !== sourceInventory.roots.length) throw new Error('APPLIED_ROOT_COUNT_MISMATCH');
  if ((checked.applied?.classification_counts?.INVALID_INPUT || 0) !== 0) throw new Error('INVALID_INPUT_ROOT');

  const covered = appliedRoots.filter((root) => root.classification === 'SAME_CONCEPT_REPEAT').map(coverageRecord);
  const genuineHeld = appliedRoots.filter((root) => root.classification === 'GENUINE_UNCAPTURED_ITEM').map(genuineHoldRecord);
  const ambiguousHeld = appliedRoots.filter((root) => root.classification === 'AMBIGUOUS_NEEDS_REVIEW').map(ambiguousHoldRecord);
  const simulation = {
    schema_version: SCHEMA_VERSION,
    artifact_id: null,
    mode: 'REPORT_ONLY',
    model_calls: 0,
    resolver_reinvoked: false,
    matcher_change_authorisation: false,
    publication_authorisation: 'NONE',
    scope: {
      matcher_state: 'UNCHANGED',
      source_claims: 'UNCHANGED',
      review_queue: 'UNCHANGED',
      taxonomy: 'UNCHANGED',
      serving_activated: false,
    },
    source_terra_artifact: {
      artifact_id: sourceArtifact.artifact_id || null,
      inventory_digest: sourceArtifact.inventory_digest || null,
      root_count: sourceInventory.roots.length,
      raw_decision_counts: rawDecisionCounts(sourceArtifact),
      decision_validation_errors: sorted(checked.decision_validation_errors),
    },
    counts: {
      total_roots: appliedRoots.length,
      concept_covered_report_only: covered.length,
      held_genuine_uncaptured_item: genuineHeld.length,
      held_ambiguous_needs_review: ambiguousHeld.length,
      invalid_input: checked.applied?.classification_counts?.INVALID_INPUT || 0,
    },
    concept_covered_root_ids: covered.map((record) => record.root_id),
    held_genuine_root_ids: genuineHeld.map((record) => record.root_id),
    held_ambiguous_root_ids: ambiguousHeld.map((record) => record.root_id),
    covered_concepts: covered,
    held_genuine_uncaptured_items: genuineHeld,
    held_ambiguous_needs_review: ambiguousHeld,
    fail_closed_reclassifications: ambiguousHeld
      .filter((record) => record.raw_classification === 'SAME_CONCEPT_REPEAT')
      .map((record) => ({
        root_id: record.root_id,
        raw_classification: record.raw_classification,
        applied_classification: 'AMBIGUOUS_NEEDS_REVIEW',
        decision_errors: record.decision_errors,
      })),
  };
  simulation.artifact_id = artifactId(simulation);
  return simulation;
}

function renderConceptCoverageSimulation(simulation) { return `${canonicalJson(simulation)}\n`; }
function writeConceptCoverageSimulation({ outputPath, simulation }) {
  mkdirSync(dirname(outputPath), { recursive: true });
  const temporary = `${outputPath}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(temporary, renderConceptCoverageSimulation(simulation));
  renameSync(temporary, outputPath);
}
function checkConceptCoverageSimulation({ outputPath, simulation }) {
  return existsSync(outputPath) && readFileSync(outputPath, 'utf8') === renderConceptCoverageSimulation(simulation);
}
function parseArgs(args) {
  const config = { mode: null, output: DEFAULT_OUTPUT, terra: DEFAULT_TERRA_INPUT };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--write' || arg === '--check') { if (config.mode) throw new Error('MODE_DUPLICATE'); config.mode = arg; }
    else if (arg === '--output') { config.output = args[++index]; }
    else if (arg === '--terra') { config.terra = args[++index]; }
    else throw new Error('USAGE: --write | --check [--output <path>] [--terra <path>]');
  }
  if (!config.mode || !config.output || !config.terra) throw new Error('USAGE: --write | --check [--output <path>] [--terra <path>]');
  return config;
}
function main() {
  const config = parseArgs(process.argv.slice(2));
  const outputPath = resolve(DEFAULT_ROOT, config.output);
  const terraPath = resolve(DEFAULT_ROOT, config.terra);
  const simulation = buildConceptCoverageSimulation({ terraArtifact: readJson(terraPath) });
  if (config.mode === '--write') writeConceptCoverageSimulation({ outputPath, simulation });
  if (!checkConceptCoverageSimulation({ outputPath, simulation })) throw new Error('STALE_OUTPUT');
  process.stdout.write(`roots: ${simulation.counts.total_roots}\ncovered report-only: ${simulation.counts.concept_covered_report_only}\nheld genuine: ${simulation.counts.held_genuine_uncaptured_item}\nheld ambiguous: ${simulation.counts.held_ambiguous_needs_review}\n`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

export {
  SCHEMA_VERSION,
  buildConceptCoverageSimulation,
  renderConceptCoverageSimulation,
  writeConceptCoverageSimulation,
  checkConceptCoverageSimulation,
};
