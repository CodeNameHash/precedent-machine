#!/usr/bin/env node
// Generates a `family -> [section_reference]` proposal for a pinned deal.
// PLAN.md Step 2A. Zero model calls, zero cost.
//
// Usage:
//   node scripts/canonical-v2-generate-family-section-refs.mjs --deal modiv
//   node scripts/canonical-v2-generate-family-section-refs.mjs --deal topbuild --out <path>
//   node scripts/canonical-v2-generate-family-section-refs.mjs --deal modiv --compare
//
// --compare diffs the generated map against the deal's committed
// `DEAL_PINS.<deal>.default_section_refs_by_family` and the section lists
// recorded in `evidence/canonical-v2/<deal>-*/`, and prints only the
// disagreements. Those are the lists a human has to read the document to
// settle; the agreements do not need reading.
//
// THE OUTPUT IS A PROPOSAL, NOT A PIN. Stage 1 matches titles and headings.
// It cannot know that a section whose title gives no hint carries the
// provision. Step 2A requires the raw generated output be committed next to
// the human-corrected version so the difference stays auditable.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

const { buildSecEdgarIntakeCapture } = require('../lib/canonical-v2/sec-edgar-intake-capture');
const { convertSecHtmlToCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text');
const {
  generateFamilySectionRefs,
} = require('../lib/canonical-v2/native-producer/family-section-ref-generator');

// Deliberately duplicated from canonical-v2-live-extraction-run.mjs rather
// than imported: that script's DEAL_PINS is not exported, and this generator
// must not be able to mutate the pins it exists to propose corrections to.
// Only the fields needed to rebuild canonical text are copied.
const DEAL_SOURCES = Object.freeze({
  modiv: Object.freeze({
    retrieval_url: 'https://www.sec.gov/Archives/edgar/data/1645873/000114036126018656/ef20072329_ex2-1.htm',
    raw_html_path: 'tests/fixtures/canonical-v2/mae-definition-family/modiv-raw-fetched.htm',
    canonical_text_sha256: '0ce6bc29354f702c637693b9d6b8eeb989ce58ee72ef5337a90feb851460339e',
  }),
  topbuild: Object.freeze({
    retrieval_url: 'https://www.sec.gov/Archives/edgar/data/1236275/000110465926045111/tm2612209d1_ex2-1.htm',
    raw_html_path: 'tests/fixtures/canonical-v2/mae-definition-family/topbuild-raw-fetched.htm',
    canonical_text_sha256: '7dfbb5bb90fa7034462e42496e9a5068fa2fa6ac55ba69f977cf7108378e7f5d',
  }),
});

function parseArgs(argv) {
  const args = { deal: null, out: null, compare: false };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--deal') { args.deal = argv[i += 1]; continue; }
    if (token === '--out') { args.out = argv[i += 1]; continue; }
    if (token === '--compare') { args.compare = true; continue; }
    throw new Error(`UNKNOWN_ARGUMENT: ${token}`);
  }
  if (!args.deal) throw new Error('DEAL_REQUIRED: pass --deal <name>');
  if (!DEAL_SOURCES[args.deal]) {
    throw new Error(`UNPINNED_DEAL: "${args.deal}" is not pinned; known: ${Object.keys(DEAL_SOURCES).join(', ')}`);
  }
  return args;
}

function canonicalTextForDeal(deal) {
  const source = DEAL_SOURCES[deal];
  const absolute = path.join(REPO_ROOT, source.raw_html_path);
  const rawBytes = fs.readFileSync(absolute);
  const capture = buildSecEdgarIntakeCapture({
    retrieval_url: source.retrieval_url,
    final_url: source.retrieval_url,
    status_code: 200,
    content_type: 'text/html; charset=UTF-8',
    retrieved_at: new Date().toISOString(),
    retrieval_policy_digest: crypto.createHash('sha256')
      .update(`Section-ref generation: reuse of already-admitted committed raw HTML for deal "${deal}"; no network fetch.`)
      .digest('hex'),
    redirect_count: 0,
    response_bytes: rawBytes,
  });
  const conversion = convertSecHtmlToCanonicalText(capture);
  // Fail closed on a source that is not the pinned one. Generating a section
  // map from the wrong bytes would produce a plausible, wrong, and very hard
  // to detect proposal.
  if (conversion.canonical_text_sha256 !== source.canonical_text_sha256) {
    throw new Error(
      `CANONICAL_TEXT_HASH_MISMATCH for "${deal}": expected ${source.canonical_text_sha256}, `
      + `got ${conversion.canonical_text_sha256}`,
    );
  }
  return conversion;
}

// Reads the section lists a previous sweep actually used, from whichever of
// the two shapes a run directory happens to carry. Twenty Modiv directories
// record `section_references` in run-manifest.json; four have no manifest at
// all and record `requested_section_references` in section-location-scan.json.
function inferFamilyFromDirectory(entry, deal) {
  const { listRegisteredSectionFamilies } = require('../lib/canonical-v2/native-producer/producer-prompt-registry');
  const middle = entry.replace(new RegExp(`^${deal}-`), '').replace(/-\d{8}$/, '');
  const normalised = middle.replace(/-/g, '_').toUpperCase();
  let best = null;
  for (const candidate of listRegisteredSectionFamilies()) {
    if (normalised === candidate) return candidate;
    // Prefix both ways: the slug may be shorter than the family
    // (no_other_reps vs NO_OTHER_REPS_FRAUD) or longer (a run label appended).
    const matches = normalised.startsWith(candidate) || candidate.startsWith(normalised);
    if (matches && (!best || candidate.length > best.length)) best = candidate;
  }
  return best;
}

function harvestCommittedRefs(deal) {
  const evidenceRoot = path.join(REPO_ROOT, 'evidence/canonical-v2');
  if (!fs.existsSync(evidenceRoot)) return {};
  const harvested = {};
  for (const entry of fs.readdirSync(evidenceRoot)) {
    if (!entry.startsWith(`${deal}-`)) continue;
    const dir = path.join(evidenceRoot, entry);
    const manifestPath = path.join(dir, 'run-manifest.json');
    const scanPath = path.join(dir, 'section-location-scan.json');
    let refs = null;
    let family = null;
    if (fs.existsSync(manifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      refs = manifest.section_references || null;
      family = manifest.section_family || null;
    }
    if (!refs && fs.existsSync(scanPath)) {
      const scan = JSON.parse(fs.readFileSync(scanPath, 'utf8'));
      refs = scan.requested_section_references || null;
    }
    if (!refs) continue;
    // Four Modiv directories have no run-manifest.json and therefore no
    // section_family field. Infer it from the directory slug by longest
    // match against the registered families, because the slugs are not
    // mechanically derivable from the names -- "no-other-reps" is
    // NO_OTHER_REPS_FRAUD, and "termination-fee-citation-following" is
    // TERMINATION_FEE with a run label appended.
    const key = family || inferFamilyFromDirectory(entry, deal) || entry;
    harvested[key] = harvested[key] || { refs, directories: [] };
    harvested[key].directories.push(entry);
  }
  return harvested;
}

function main() {
  const args = parseArgs(process.argv);
  const conversion = canonicalTextForDeal(args.deal);
  const generated = generateFamilySectionRefs({
    source_text: conversion.canonical_text,
    document_hash: conversion.canonical_text_sha256,
  });

  const matched = Object.entries(generated.by_family).filter(([, refs]) => refs.length > 0);
  process.stdout.write(
    `GENERATED for deal "${args.deal}": ${matched.length} of ${generated.registered_family_count} families matched, `
    + `from ${generated.dispatchable_count} dispatchable nodes of ${generated.node_count}. Zero model calls.\n\n`,
  );
  for (const [family, refs] of matched) {
    process.stdout.write(`  ${family.padEnd(34)} ${JSON.stringify(refs)}\n`);
  }
  if (generated.unmatched_families.length > 0) {
    process.stdout.write(`\n  MATCHED NOTHING (${generated.unmatched_families.length}): `
      + `${generated.unmatched_families.join(', ')}\n`);
    process.stdout.write('  A family matching nothing is a finding to record, not a family to skip.\n');
  }

  if (args.compare) {
    const harvested = harvestCommittedRefs(args.deal);
    const families = Object.keys(harvested);
    process.stdout.write(`\n--- COMPARE against ${families.length} committed run directories ---\n`);
    let disagreements = 0;
    for (const family of families.sort()) {
      const committed = [...harvested[family].refs].sort();
      const proposed = [...(generated.by_family[family] || [])].sort();
      if (JSON.stringify(committed) === JSON.stringify(proposed)) continue;
      disagreements += 1;
      process.stdout.write(`  ${family}\n`);
      process.stdout.write(`    committed: ${JSON.stringify(committed)}\n`);
      process.stdout.write(`    generated: ${JSON.stringify(proposed)}\n`);
    }
    process.stdout.write(`\n  ${disagreements} disagreement(s). Each needs the document read before either is pinned.\n`);
  }

  if (args.out) {
    const payload = {
      deal: args.deal,
      generated_at_document_hash: conversion.canonical_text_sha256,
      generator: 'scripts/canonical-v2-generate-family-section-refs.mjs',
      note: 'RAW GENERATOR OUTPUT, PRE-HUMAN-REVIEW. Not a pinned list. See PLAN.md Step 2A.',
      node_count: generated.node_count,
      dispatchable_count: generated.dispatchable_count,
      by_family: generated.by_family,
      unmatched_families: generated.unmatched_families,
    };
    fs.writeFileSync(path.join(REPO_ROOT, args.out), `${JSON.stringify(payload, null, 2)}\n`);
    process.stdout.write(`\nWrote ${args.out}\n`);
  }
}

main();
