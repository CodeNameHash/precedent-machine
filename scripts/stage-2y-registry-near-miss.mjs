#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isFinalCorpusRun } from './canonical-v2-corpus-review-artifact.mjs';

const require = createRequire(import.meta.url);
const { canonicalJson, sha256Hex, utf8ByteLength, utf8Slice } = require('../lib/canonical-v2/canonical-bytes');
const { rebuildAdmittedSourcePrimitives } = require('../lib/canonical-v2/admitted-source-chain-rebuild');
const { MANIFEST, DIGEST: manifest_digest } = require('../lib/vocab/resolution/registry-substrate-manifest');
const closing = require('../lib/vocab/resolution/closing-condition-kinds-registry');
const general = require('../lib/vocab/resolution/general-covenant-registry');
const contracts = require('../lib/vocab/resolution/material-contract-registry');
const interim = require('../lib/vocab/resolution/interim-operating-registry');
const party = require('../lib/vocab/resolution/party-capacity-registry');
const materiality = require('../lib/vocab/resolution/materiality-qualifier-registry');

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const JSON_OUTPUT = resolve(ROOT, 'evidence/canonical-v2/stage-2y-registry-near-miss.json');
const MD_OUTPUT = resolve(ROOT, 'evidence/canonical-v2/stage-2y-registry-near-miss.md');
const REQUIRED = Object.freeze(['run-manifest.json', 'run-receipt.json', 'resolution.json', 'source-reference.json', 'recording.json']);
const MAX_LEADS_PER_MATCHER = 8;
const STOP_WORDS = new Set(['and', 'are', 'but', 'for', 'from', 'has', 'have', 'not', 'or', 'return', 'test', 'the', 'this', 'that', 'then', 'with', 'quote', 'true', 'false', 'case', 'const', 'match']);
const json = (file) => JSON.parse(readFileSync(file, 'utf8'));
const bytes = (file) => `sha256:${sha256Hex(readFileSync(file))}`;
const hash = (value) => `sha256:${sha256Hex(Buffer.from(canonicalJson(value), 'utf8'))}`;

function literalAnchors(source) {
  return [...new Set((String(source).match(/[A-Za-z]{3,}/g) || []).map((word) => word.toLowerCase()).filter((word) => !STOP_WORDS.has(word)))].slice(0, 6);
}
function regexMatcher({ registry, key, pattern }) {
  const source = pattern.source || String(pattern);
  return Object.freeze({ registry, key, matcher_type: 'REGEXP', matcher_source: source, anchors: literalAnchors(source), matches: (text) => { pattern.lastIndex = 0; return pattern.test(text); } });
}
function predicateMatcher({ registry, key, predicate, source }) {
  return Object.freeze({ registry, key, matcher_type: 'PREDICATE', matcher_source: source, anchors: literalAnchors(source), matches: predicate });
}
function buildMatchers() {
  const matchers = [];
  for (const [code, patterns] of Object.entries(general.GENERAL_COVENANT_CODE_PATTERNS)) patterns.forEach((pattern, index) => matchers.push(regexMatcher({ registry: 'general-covenant', key: `${code}#${index + 1}`, pattern })));
  for (const [bucket, meta] of Object.entries(contracts.MATERIAL_CONTRACT_BUCKET_META)) (meta.synonyms || []).forEach((pattern, index) => matchers.push(regexMatcher({ registry: 'material-contract', key: `${bucket}#${index + 1}`, pattern })));
  for (const [category, predicate] of Object.entries(interim.CATEGORY_TESTS)) matchers.push(predicateMatcher({ registry: 'interim-operating', key: category, predicate, source: predicate.toString() }));
  party.PARTY_CAPACITY_LEXICON.forEach(({ capacity, pattern }, index) => matchers.push(regexMatcher({ registry: 'party-capacity', key: `${capacity}#${index + 1}`, pattern })));
  materiality.KNOWLEDGE_STANDARD_PATTERNS.forEach(({ standard, pattern }, index) => matchers.push(regexMatcher({ registry: 'materiality-qualifier', key: `KNOWLEDGE_STANDARD_${standard}#${index + 1}`, pattern })));
  materiality.KNOWLEDGE_PATTERNS.forEach((pattern, index) => matchers.push(regexMatcher({ registry: 'materiality-qualifier', key: `KNOWLEDGE_LEXICAL#${index + 1}`, pattern })));
  materiality.ACCURACY_PATTERNS.forEach((pattern, index) => matchers.push(regexMatcher({ registry: 'materiality-qualifier', key: `ACCURACY_LEXICAL#${index + 1}`, pattern })));
  materiality.THRESHOLD_PATTERNS.forEach((pattern, index) => matchers.push(regexMatcher({ registry: 'materiality-qualifier', key: `THRESHOLD#${index + 1}`, pattern })));
  matchers.push(regexMatcher({ registry: 'materiality-qualifier', key: 'TEMPORAL_CALENDAR_DATE#1', pattern: materiality.TEMPORAL_CALENDAR_DATE_PATTERN }));
  materiality.ACCURACY_CODE_WHITELIST.forEach(({ code, phrase }, index) => {
    const normalised = phrase.toLowerCase().replace(/\s+/g, ' ').trim();
    matchers.push(predicateMatcher({ registry: 'materiality-qualifier', key: `ACCURACY_${code}#${index + 1}`, source: phrase, predicate: (text) => text.toLowerCase().replace(/\s+/g, ' ').includes(normalised) }));
  });
  [['MAE_QUALIFIER_IDIOM', materiality.MAE_QUALIFIER_IDIOM_PATTERN], ['MAE_TOLERANCE_FAILURE_IDIOM', materiality.MAE_TOLERANCE_FAILURE_IDIOM_PATTERN], ['DISCLOSURE_CARVEOUT_CLAUSE', materiality.DISCLOSURE_CARVEOUT_CLAUSE_PATTERN], ['DISCLOSURE_CARVEOUT_SIGNAL', materiality.DISCLOSURE_CARVEOUT_SIGNAL_PATTERN], ['ENUMERATED_DISCLOSURE_CARVEOUT', materiality.ENUMERATED_EXCEPT_DISCLOSURE_CARVEOUT_SIGNAL_PATTERN]].forEach(([key, pattern], index) => matchers.push(regexMatcher({ registry: 'materiality-qualifier', key: `${key}#${index + 1}`, pattern })));
  const scanned = matchers.filter((matcher) => matcher.anchors.length > 0);
  const identities = scanned.map((matcher) => `${matcher.registry}:${matcher.key}`);
  if (new Set(identities).size !== identities.length) throw new Error('DUPLICATE_MATCHER_IDENTITY');
  return scanned;
}
const MATCHERS = Object.freeze(buildMatchers());

function sentenceWindows(text) {
  const windows = [];
  const boundary = /(?:[.!?](?:\s+|$)|\n+)/g;
  let start = 0;
  let match;
  while ((match = boundary.exec(text)) !== null) {
    const end = match.index + match[0].length;
    if (text.slice(start, end).trim()) windows.push({ start, end, text: text.slice(start, end) });
    start = end;
  }
  if (text.slice(start).trim()) windows.push({ start, end: text.length, text: text.slice(start) });
  return windows;
}
function matchingCandidates(receipt, sectionReference, windowText) {
  return (receipt.compiled_candidates || []).filter((entry) => {
    const quote = entry?.candidate?.claim?.raw_value;
    return entry.section_reference === sectionReference && typeof quote === 'string' && quote.length > 0 && windowText.includes(quote);
  }).map((entry) => entry.candidate.claim.claim_occurrence_id).filter(Boolean).sort();
}
function runInputs(name) {
  const dir = resolve(ROOT, 'evidence/canonical-v2', name);
  for (const file of REQUIRED) if (!existsSync(resolve(dir, file))) throw new Error(`MISSING_NEAR_MISS_INPUT:${name}:${file}`);
  return { dir, digests: Object.fromEntries(REQUIRED.map((file) => [file, bytes(resolve(dir, file))])) };
}
function currentInputDigest(runNames) { return hash(runNames.map((name) => ({ name, digests: runInputs(name).digests }))); }
function offerLead(byMatcher, matcherKey, lead) {
  const current = byMatcher.get(matcherKey) || [];
  current.push(lead);
  current.sort((a, b) => b.rank - a.rank || a.run_name.localeCompare(b.run_name) || a.absolute_start - b.absolute_start);
  if (current.length > MAX_LEADS_PER_MATCHER) current.pop();
  byMatcher.set(matcherKey, current);
}

// A non-fire is a sentence that contains one or more literal anchors from one
// controlled matcher but does not satisfy that matcher. It is only a review lead.
// The scan never calls a provider or resolver and cannot change a claim outcome.
function build() {
  const run_names = readdirSync(resolve(ROOT, 'evidence/canonical-v2')).filter(isFinalCorpusRun).sort();
  const runs = [];
  const totals = new Map(MATCHERS.map((matcher) => [`${matcher.registry}:${matcher.key}`, { matcher, anchor_hits: 0, non_fires: 0 }]));
  const leadsByMatcher = new Map();
  for (const name of run_names) {
    const { dir, digests } = runInputs(name);
    const receipt = json(resolve(dir, 'run-receipt.json'));
    const manifest = json(resolve(dir, 'run-manifest.json'));
    let primitives;
    try { primitives = rebuildAdmittedSourcePrimitives({ runDirectory: dir, repoRoot: ROOT }); } catch (error) {
      runs.push({ run_name: name, family: manifest.section_family, source_rebuild: 'EXCLUDED', reason: error.code || String(error.message).split(':', 1)[0], input_digests: digests });
      continue;
    }
    let evaluated_spans = 0;
    for (const section of receipt.resolved_sections || []) {
      if (!Number.isInteger(section.start) || !Number.isInteger(section.end)) continue;
      const sectionText = utf8Slice(primitives.conversion.canonical_text, section.start, section.end);
      for (const window of sentenceWindows(sectionText)) {
        evaluated_spans += 1;
        const lower = window.text.toLowerCase();
        const absolute_start = section.start + utf8ByteLength(sectionText.slice(0, window.start));
        const absolute_end = absolute_start + utf8ByteLength(window.text);
        const candidate_ids = matchingCandidates(receipt, section.section_reference, window.text);
        for (const matcher of MATCHERS) {
          const anchors_present = matcher.anchors.filter((anchor) => lower.includes(anchor));
          if (anchors_present.length === 0) continue;
          const metric = totals.get(`${matcher.registry}:${matcher.key}`);
          metric.anchor_hits += 1;
          if (matcher.matches(window.text)) continue;
          metric.non_fires += 1;
          offerLead(leadsByMatcher, `${matcher.registry}:${matcher.key}`, {
            run_name: name, family: manifest.section_family, registry: matcher.registry, matcher: matcher.key, matcher_type: matcher.matcher_type, matcher_source: matcher.matcher_source,
            section_reference: section.section_reference, absolute_start, absolute_end, excerpt: window.text.trim().slice(0, 700), excerpt_sha256: `sha256:${sha256Hex(window.text)}`,
            anchors_present, recorded_candidate_ids: candidate_ids, rank: anchors_present.length * 1000 + Math.min(window.text.length, 999), disposition: 'REVIEW_LEAD_ONLY', classification_performed: false,
          });
        }
      }
    }
    runs.push({ run_name: name, family: manifest.section_family, source_rebuild: 'INCLUDED', evaluated_spans, input_digests: digests });
  }
  const matcher_summary = [...totals.values()].map(({ matcher, anchor_hits, non_fires }) => ({ registry: matcher.registry, matcher: matcher.key, matcher_type: matcher.matcher_type, matcher_source: matcher.matcher_source, anchors: matcher.anchors, anchor_hits, non_fires, reported_leads: (leadsByMatcher.get(`${matcher.registry}:${matcher.key}`) || []).length })).sort((a, b) => a.registry.localeCompare(b.registry) || a.matcher.localeCompare(b.matcher));
  const records = [...leadsByMatcher.values()].flat().sort((a, b) => b.rank - a.rank || a.registry.localeCompare(b.registry) || a.matcher.localeCompare(b.matcher));
  const included = runs.filter((row) => row.source_rebuild === 'INCLUDED');
  const excluded = runs.filter((row) => row.source_rebuild === 'EXCLUDED');
  return { schema_version: 'STAGE_2Y_REGISTRY_NEAR_MISS_REPORT/V3', method: 'SOURCE_REBUILD_PER_MATCHER_NON_FIRE_SCAN', execution: { product_writes: false, artifact_write_only: true, classification_performed: false, model_calls: 0, serving: false }, publication_disposition: 'WITHHELD', registry_substrate: { manifest: MANIFEST, manifest_digest }, matcher_coverage: { closing_condition_kinds: { matcher_count: 0, reason: 'The closing-condition registry is an enum only. It contains no controlled source matcher to test.' }, scanned_matcher_count: MATCHERS.length }, run_names, input_digest: currentInputDigest(run_names), summary: { runs_discovered: run_names.length, runs_rebuilt: included.length, runs_excluded: excluded.length, evaluated_spans: included.reduce((sum, row) => sum + row.evaluated_spans, 0), anchor_hits: matcher_summary.reduce((sum, row) => sum + row.anchor_hits, 0), non_fires: matcher_summary.reduce((sum, row) => sum + row.non_fires, 0), review_leads_reported: records.length, review_leads_per_matcher_cap: MAX_LEADS_PER_MATCHER }, runs, matcher_summary, records };
}
function markdown(value) {
  const lines = ['# Stage 2Y registry near-miss report', '', 'Method: rebuild each admitted source, split resolved sections into sentence spans, and test every controlled registry matcher. A record has matcher anchors but the same matcher did not fire. It is a review lead only. No provider, resolver, classification, product write, or publication occurred. Only this JSON report and Markdown report were written.', '', `Runs rebuilt: ${value.summary.runs_rebuilt}/${value.summary.runs_discovered}`, `Runs excluded: ${value.summary.runs_excluded}`, `Evaluated spans: ${value.summary.evaluated_spans}`, `Matcher anchor hits: ${value.summary.anchor_hits}`, `Matcher non-fires: ${value.summary.non_fires}`, `Reported review leads: ${value.summary.review_leads_reported}, maximum ${value.summary.review_leads_per_matcher_cap} per matcher.`, '', '## Ranked review leads', ''];
  for (const [index, record] of value.records.entries()) lines.push(`### ${index + 1}. ${record.registry} / ${record.matcher}`, '', `Run: ${record.run_name}. Section: ${record.section_reference}. UTF-8 bytes: ${record.absolute_start}-${record.absolute_end}. Anchors: ${record.anchors_present.join(', ')}. Recorded candidates in sentence: ${record.recorded_candidate_ids.length}.`, '', `> ${record.excerpt.replace(/\n+/g, ' ').trim()}`, '');
  lines.push('Classification performed: false', '', 'Model calls: 0', '', 'Publication disposition: WITHHELD', '');
  return lines.join('\n');
}
function isCurrentReport({ stored, storedMarkdown, current }) {
  return stored === `${JSON.stringify(current, null, 2)}\n` && storedMarkdown === markdown(current);
}
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const mode = process.argv[2];
  if (!['--write', '--check'].includes(mode)) throw new Error('USAGE: use --write or --check');
  const value = build();
  const text = `${JSON.stringify(value, null, 2)}\n`;
  const md = markdown(value);
  if (mode === '--write') {
    writeFileSync(JSON_OUTPUT, text);
    writeFileSync(MD_OUTPUT, md);
    process.stdout.write(`WROTE ${JSON_OUTPUT}\nWROTE ${MD_OUTPUT}\n`);
  } else {
    if (!existsSync(JSON_OUTPUT) || !existsSync(MD_OUTPUT)
      || !isCurrentReport({ stored: readFileSync(JSON_OUTPUT, 'utf8'), storedMarkdown: readFileSync(MD_OUTPUT, 'utf8'), current: value })) throw new Error('STALE_OUTPUT');
    process.stdout.write(`CHECKED ${JSON_OUTPUT}\nCHECKED ${MD_OUTPUT}\n`);
  }
}
export { build, sentenceWindows, matchingCandidates, literalAnchors, markdown, isCurrentReport, MATCHERS };
