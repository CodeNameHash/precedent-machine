#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isFinalCorpusRun } from './canonical-v2-corpus-review-artifact.mjs';
import { replayInput, replayReceipt } from './stage-2y-corroboration-ladder.mjs';

const require = createRequire(import.meta.url);
const { canonicalJson, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EVIDENCE_ROOT = resolve(ROOT, 'evidence/canonical-v2');
const REQUIRED = Object.freeze(['run-manifest.json', 'run-receipt.json', 'resolution.json', 'source-reference.json', 'recording.json']);
const PHASES = Object.freeze(['regression', 'fixed']);
const json = (file) => JSON.parse(readFileSync(file, 'utf8'));
const sha256File = (file) => `sha256:${sha256Hex(readFileSync(file))}`;
const valueDigest = (value) => `sha256:${sha256Hex(Buffer.from(canonicalJson(value), 'utf8'))}`;

function sourceCandidateId(entry) {
  return entry?.compiled_candidate?.candidate?.claim?.claim_occurrence_id
    || entry?.original_claim_occurrence_id
    || entry?.claim?.claim_occurrence_id
    || null;
}

function semanticLocator(entry) {
  const sourceClaim = entry?.compiled_candidate?.candidate?.claim || {};
  const claim = entry?.claim || {};
  return {
    section: entry?.section_reference || entry?.source_citation || null,
    generic_claim_key: entry?.generic_claim_key || null,
    raw_value: claim.raw_value ?? entry?.raw_value ?? sourceClaim.raw_value ?? null,
  };
}

function snapshot(entry, collection) {
  const claim = entry?.claim || {};
  return {
    collection,
    resolved_claim_definition_key: entry?.resolved_claim_definition_key || null,
    state: claim.state ?? null,
    canonical_value: claim.canonical_value ?? null,
    raw_value: claim.raw_value ?? entry?.raw_value ?? null,
    claim_occurrence_id: claim.claim_occurrence_id ?? null,
    claim_revision_id: claim.claim_revision_id ?? null,
    source_candidate_id: sourceCandidateId(entry),
    reasons: [...(entry?.reasons || entry?.triage?.reasons || [])].sort(),
  };
}

function resolutionValueKey(entry) {
  const value = snapshot(entry, 'resolved');
  return canonicalJson({
    resolved_claim_definition_key: value.resolved_claim_definition_key,
    state: value.state,
    canonical_value: value.canonical_value,
    raw_value: value.raw_value,
  });
}

function indexedResolution(resolution) {
  const rows = new Map();
  for (const collection of ['resolved', 'review_queue', 'open_world', 'residuals']) {
    for (const entry of resolution?.[collection] || []) {
      const key = canonicalJson(semanticLocator(entry));
      const matches = rows.get(key) || [];
      matches.push({ entry, collection });
      rows.set(key, matches);
    }
  }
  return rows;
}

function snapshots(matches) {
  if (!matches || matches.length === 0) return null;
  const values = matches.map(({ entry, collection }) => snapshot(entry, collection));
  if (values.length === 1) return values[0];
  return { collection: 'MULTIPLE', candidates: values };
}

function changedResolution(before, after) {
  if (!after || after.collection !== 'resolved') return true;
  return before.resolved_claim_definition_key !== after.resolved_claim_definition_key
    || before.state !== after.state
    || canonicalJson(before.canonical_value) !== canonicalJson(after.canonical_value);
}

function claimIdentity({ manifest, runName, entry }) {
  const locator = semanticLocator(entry);
  return {
    deal: manifest.deal,
    run: runName,
    family: manifest.section_family,
    section: entry.section_reference || entry.source_citation || null,
    semantic_locator: locator,
    semantic_locator_digest: valueDigest(locator),
    source_candidate_id: sourceCandidateId(entry),
    generic_claim_key: entry.generic_claim_key || null,
  };
}

async function replayRun(runName) {
  const directory = resolve(EVIDENCE_ROOT, runName);
  const missing = REQUIRED.filter((name) => !existsSync(resolve(directory, name)));
  if (missing.length) throw new Error(`MISSING_REQUIRED_INPUT:${runName}:${missing.join(',')}`);
  const manifest = json(resolve(directory, 'run-manifest.json'));
  const sourceReference = json(resolve(directory, 'source-reference.json'));
  const recording = json(resolve(directory, 'recording.json'));
  const runReceipt = json(resolve(directory, 'run-receipt.json'));
  const committed = json(resolve(directory, 'resolution.json'));
  replayInput({ family: manifest.section_family, runName, manifest, sourceReference, recording, oldReceipt: runReceipt });
  const replayed = await replayReceipt({ family: manifest.section_family, runName, manifest, sourceReference, recording, oldReceipt: runReceipt });
  return { directory, manifest, committed, replayed: replayed.resolution };
}

async function buildResolutionSetDiff({ phase }) {
  if (!PHASES.includes(phase)) throw new Error('INVALID_PHASE');
  const runNames = readdirSync(EVIDENCE_ROOT).filter(isFinalCorpusRun).sort();
  const movedClaims = [];
  const newlyResolvedClaims = [];
  const errors = [];
  const collectionCountsPerRun = [];
  let previouslyResolvedClaimCount = 0;
  const replayResults = new Array(runNames.length);
  let cursor = 0;
  let completed = 0;
  async function worker() {
    while (cursor < runNames.length) {
      const index = cursor;
      cursor += 1;
      const runName = runNames[index];
      try {
        replayResults[index] = { value: await replayRun(runName) };
      } catch (error) {
        replayResults[index] = { error: String(error?.message || error) };
      }
      completed += 1;
      process.stderr.write(`DIFFED ${completed}/${runNames.length} ${runName}\n`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(8, runNames.length) }, () => worker()));
  for (const [index, runName] of runNames.entries()) {
    const result = replayResults[index];
    if (result.error) {
      errors.push({ run: runName, error: result.error });
      continue;
    }
    try {
      const { manifest, committed, replayed } = result.value;
      collectionCountsPerRun.push({
        deal: manifest.deal,
        run: runName,
        family: manifest.section_family,
        before: Object.fromEntries(['resolved', 'review_queue', 'open_world', 'residuals']
          .map((collection) => [collection, committed?.[collection]?.length || 0])),
        after: Object.fromEntries(['resolved', 'review_queue', 'open_world', 'residuals']
          .map((collection) => [collection, replayed?.[collection]?.length || 0])),
      });
      const beforeRows = indexedResolution(committed);
      const afterRows = indexedResolution(replayed);
      const locatorKeys = [...new Set([...beforeRows.keys(), ...afterRows.keys()])].sort();
      for (const key of locatorKeys) {
        const beforeMatches = beforeRows.get(key) || [];
        const afterMatches = afterRows.get(key) || [];
        const beforeResolved = beforeMatches.filter(({ collection }) => collection === 'resolved');
        const remainingAfterResolved = afterMatches.filter(({ collection }) => collection === 'resolved');
        const unresolvedAfter = afterMatches.filter(({ collection }) => collection !== 'resolved');
        previouslyResolvedClaimCount += beforeResolved.length;
        for (const beforeRow of beforeResolved) {
          const exactIndex = remainingAfterResolved.findIndex(({ entry }) => (
            resolutionValueKey(entry) === resolutionValueKey(beforeRow.entry)
          ));
          if (exactIndex !== -1) {
            remainingAfterResolved.splice(exactIndex, 1);
            continue;
          }
          const changedAfter = remainingAfterResolved.shift();
          movedClaims.push({
            ...claimIdentity({ manifest, runName, entry: beforeRow.entry }),
            before: snapshot(beforeRow.entry, 'resolved'),
            after: changedAfter ? snapshot(changedAfter.entry, 'resolved') : snapshots(unresolvedAfter),
          });
        }
        for (const afterRow of remainingAfterResolved) {
          newlyResolvedClaims.push({
            ...claimIdentity({ manifest, runName, entry: afterRow.entry }),
            before: snapshots(beforeMatches.filter(({ collection }) => collection !== 'resolved')),
            after: snapshot(afterRow.entry, 'resolved'),
          });
        }
      }
    } catch (error) {
      errors.push({ run: runName, error: String(error?.message || error) });
    }
  }
  const deals = [...new Set(runNames.map((name) => name.split('-', 1)[0]))].sort();
  const sortRows = (rows) => rows.sort((left, right) => left.deal.localeCompare(right.deal)
    || left.run.localeCompare(right.run) || String(left.section).localeCompare(String(right.section))
    || left.semantic_locator_digest.localeCompare(right.semantic_locator_digest));
  sortRows(movedClaims); sortRows(newlyResolvedClaims);
  collectionCountsPerRun.sort((a, b) => a.deal.localeCompare(b.deal) || a.run.localeCompare(b.run));
  const familyOpenWorld = new Map();
  for (const row of collectionCountsPerRun) {
    const counts = familyOpenWorld.get(row.family) || { family: row.family, before: 0, after: 0 };
    counts.before += row.before.open_world;
    counts.after += row.after.open_world;
    familyOpenWorld.set(row.family, counts);
  }
  const openWorldByFamily = [...familyOpenWorld.values()]
    .map((row) => ({ ...row, delta: row.after - row.before }))
    .sort((a, b) => a.family.localeCompare(b.family));
  const body = {
    schema_version: 'STAGE_2Y_RESOLUTION_SET_DIFF/V1',
    generation_command: `node scripts/stage-2y-resolution-set-diff.mjs --write ${phase}`,
    phase,
    authority: 'OFFLINE_REPLAY_COMPARISON_ONLY',
    publication_authorisation: 'NONE',
    comparison: 'COMMITTED_RESOLUTION_ARTIFACTS_TO_CURRENT_OFFLINE_REPLAY',
    resolver_source_digest: sha256File(resolve(ROOT, 'lib/canonical-v2/native-producer/candidate-resolution.js')),
    run_names: runNames,
    deals,
    summary: {
      deal_count: deals.length,
      run_count: runNames.length,
      previously_resolved_claim_count: previouslyResolvedClaimCount,
      moved_previously_resolved_claim_count: movedClaims.length,
      newly_resolved_claim_count: newlyResolvedClaims.length,
      replay_error_count: errors.length,
      open_world_rise_family_count: openWorldByFamily.filter((row) => row.delta > 0).length,
    },
    moved_previously_resolved_claims: movedClaims,
    newly_resolved_claims: newlyResolvedClaims,
    replay_errors: errors,
    open_world_by_family: openWorldByFamily,
    collection_counts_per_run: collectionCountsPerRun,
  };
  return { ...body, comparison_digest: valueDigest(body) };
}

function outputPath(phase) {
  return resolve(EVIDENCE_ROOT, `stage-2y-parent-approval-resolution-set-diff-${phase}.json`);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const [mode, phase] = process.argv.slice(2);
  if (!['--write', '--check'].includes(mode) || !PHASES.includes(phase) || process.argv.length !== 4) {
    throw new Error('USAGE: use --write|--check regression|fixed');
  }
  const value = await buildResolutionSetDiff({ phase });
  const output = `${JSON.stringify(value, null, 2)}\n`;
  const destination = outputPath(phase);
  if (mode === '--write') writeFileSync(destination, output);
  if (!existsSync(destination) || readFileSync(destination, 'utf8') !== output) throw new Error(`STALE_OUTPUT:${destination}`);
  process.stdout.write(`${mode} ${destination}\n`);
}

export { buildResolutionSetDiff, changedResolution, indexedResolution, replayRun, semanticLocator, snapshot, sourceCandidateId };
