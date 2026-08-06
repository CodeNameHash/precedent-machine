#!/usr/bin/env node
/**
 * scripts/canonical-v2-citation-scope-resolution-harness.mjs
 *
 * OFFLINE, NO-MODEL prototype supporting
 * docs/codex-program/notes/citation-scope-design.md.
 *
 * Answers one narrow, mechanical question against real, committed data:
 * of the bare cross-references the model actually produced on Modiv's
 * TERMINATION_FEE family (evidence/canonical-v2/
 * modiv-termination-fee-scope-correction-20260805/native-producer-recorded-
 * response-{7.1,7.3,8.12}.json), how many does the deterministic sectionizer
 * (`findSectionByReference`, lib/canonical-v2/native-producer/
 * deterministic-sectionizer.js) resolve to exactly one node, how many are
 * genuinely ambiguous (>=2 nodes share the same reference string --
 * `findSectionByReference` itself cannot tell you this, it is a plain
 * `Array.prototype.find`, so this script independently counts matches
 * across the whole tree rather than trusting its single return value), and
 * how many return null.
 *
 * For every reference that DOES resolve, this script also reports what the
 * EXISTING, unmodified trigger-corroboration table
 * (`feeTriggerCorroboratedCodes`, candidate-resolution.js) would find in
 * the cited node's own text -- informational only. This script does not
 * call `resolveCandidates`, does not construct a claim, does not write to
 * `evidence/`, and does not modify the resolver, the sectionizer, or the
 * dispatch invariant in `native-extraction-run.js`. It makes zero network
 * or model calls: source text comes from the already-committed, already-
 * admitted raw HTML fixture, reused byte-for-byte (hashes re-verified
 * below, same pin the live run itself checked).
 *
 * Usage: node scripts/canonical-v2-citation-scope-resolution-harness.mjs
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { buildSecEdgarIntakeCapture } = require('../lib/canonical-v2/sec-edgar-intake-capture');
const { convertSecHtmlToCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text');
const {
  sectionizeAdmittedSource, findSectionByReference,
} = require('../lib/canonical-v2/native-producer/deterministic-sectionizer');
const { feeTriggerCorroboratedCodes } = require('../lib/canonical-v2/native-producer/candidate-resolution');

const RAW_HTML_PATH = 'tests/fixtures/canonical-v2/mae-definition-family/modiv-raw-fetched.htm';
const EXPECTED_RAW_BYTES_SHA256 = '659bcfaa017718ac735811861565fa2cd4e212657ba68e06ff1eab53e3729968';
const EXPECTED_CANONICAL_TEXT_SHA256 = '0ce6bc29354f702c637693b9d6b8eeb989ce58ee72ef5337a90feb851460339e';
const MODIV_RETRIEVAL_URL = 'https://www.sec.gov/Archives/edgar/data/1645873/000114036126018656/ef20072329_ex2-1.htm';

const EVIDENCE_DIR = 'evidence/canonical-v2/modiv-termination-fee-scope-correction-20260805';
const RECORDED_RESPONSES = ['7.1', '7.3', '8.12'];

// ─── Step 1: reproduce admission, offline, re-verified against the pin ───

function loadCanonicalText() {
  const rawBytes = readFileSync(resolve(RAW_HTML_PATH));
  const rawBytesSha256 = sha256Hex(rawBytes);
  if (rawBytesSha256 !== EXPECTED_RAW_BYTES_SHA256) {
    throw new Error(`raw HTML sha256 mismatch: expected ${EXPECTED_RAW_BYTES_SHA256}, got ${rawBytesSha256}`);
  }
  const capture = buildSecEdgarIntakeCapture({
    retrieval_url: MODIV_RETRIEVAL_URL,
    final_url: MODIV_RETRIEVAL_URL,
    status_code: 200,
    content_type: 'text/html; charset=UTF-8',
    retrieved_at: new Date().toISOString(),
    retrieval_policy_digest: sha256Hex('citation-scope-resolution-harness: reuse of committed raw HTML, no live fetch'),
    redirect_count: 0,
    response_bytes: rawBytes,
  });
  const conversion = convertSecHtmlToCanonicalText(capture);
  if (conversion.canonical_text_sha256 !== EXPECTED_CANONICAL_TEXT_SHA256) {
    throw new Error(`canonical text sha256 mismatch: expected ${EXPECTED_CANONICAL_TEXT_SHA256}, got ${conversion.canonical_text_sha256}`);
  }
  return { fullText: conversion.canonical_text, documentHash: rawBytesSha256 };
}

// ─── Step 2: pull every "Section X..." citation out of the recorded responses ───

function parseRecordedResponse(sectionRef) {
  const p = resolve(EVIDENCE_DIR, `native-producer-recorded-response-${sectionRef}.json`);
  const raw = JSON.parse(readFileSync(p, 'utf8'));
  let text = raw.raw_response_text.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '');
  return { dispatchedSection: sectionRef, parsed: JSON.parse(text) };
}

// Matches "Section 7.1(d)(ii)", "Section 8.12", "Section 7.3(b)" etc. --
// digits, optional decimal, then zero or more (letter|roman) groups.
const CITATION_PATTERN = /Section\s+(\d+(?:\.\d+)?(?:\([a-zA-Z0-9]+\))*)/g;

// Heuristic only (RES1 in P1-PLAN.md names this exact parser as not yet
// built): a quote is "bare citation shaped" if, after stripping every
// citation substring this pattern finds plus a short connector-word list,
// almost nothing recognisable remains. Deliberately conservative -- used
// here only to separate the legally salient subset (a trigger candidate
// that names NO ground of its own) from a quote that merely mentions a
// section in passing among real descriptive text.
const CONNECTOR_WORDS = /\b(by|the|company|parent|pursuant|to|or|and|this|agreement|a|of)\b/gi;
function isBareCitationQuote(quote) {
  const stripped = quote
    .replace(CITATION_PATTERN, ' ')
    .replace(CONNECTOR_WORDS, ' ')
    .replace(/[().,;]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return stripped.length <= 2; // allow a stray "A" / "1" enumeration marker
}

function extractCitations(parsed, dispatchedSection) {
  const found = [];
  for (const [arrayName, entries] of Object.entries(parsed)) {
    if (!Array.isArray(entries)) continue;
    entries.forEach((entry, entryIndex) => {
      for (const [fieldName, value] of Object.entries(entry)) {
        if (typeof value !== 'string') continue;
        const matches = [...value.matchAll(CITATION_PATTERN)];
        for (const m of matches) {
          found.push({
            dispatchedSection,
            array: arrayName,
            entryIndex,
            field: fieldName,
            reference: m[1],
            quote: value,
            triggerCode: arrayName === 'fee_trigger_assertions' ? entry.trigger_code : undefined,
            isBareCitationQuote: fieldName === 'quote' ? isBareCitationQuote(value) : null,
          });
        }
      }
    });
  }
  return found;
}

function sliceNodeText(fullText, node) {
  return Buffer.from(fullText, 'utf8').subarray(node.start, node.end).toString('utf8');
}

function main() {
  const { fullText, documentHash } = loadCanonicalText();
  const tree = sectionizeAdmittedSource({ source_text: fullText, document_hash: documentHash });
  console.log(`[harness] sectionizer tree: ${tree.nodes.length} nodes, document_hash=${documentHash.slice(0, 16)}...`);

  // Whole-tree ambiguity scan: does ANY reference string appear on more
  // than one node, independent of what got cited? findSectionByReference
  // cannot answer this itself (plain Array.prototype.find, first match,
  // no duplicate check) -- confirmed by reading the function directly
  // (deterministic-sectionizer.js:919-925). This script computes it
  // separately so a "resolved" result below can be labelled trustworthy
  // (exactly one node) rather than merely "found something".
  const refCounts = new Map();
  for (const node of tree.nodes) {
    if (!node.reference) continue;
    refCounts.set(node.reference, (refCounts.get(node.reference) || 0) + 1);
  }
  const duplicateRefs = [...refCounts.entries()].filter(([, count]) => count >= 2);
  console.log(`[harness] whole-tree reference collisions (same reference string on >=2 nodes): ${duplicateRefs.length}`);
  if (duplicateRefs.length > 0) {
    duplicateRefs.forEach(([ref, count]) => console.log(`    ${ref}  x${count}`));
  }

  // Gather every citation out of all three recorded responses.
  const allCitations = [];
  for (const ref of RECORDED_RESPONSES) {
    const { dispatchedSection, parsed } = parseRecordedResponse(ref);
    allCitations.push(...extractCitations(parsed, dispatchedSection));
  }

  // Distinct cited reference strings (a citation appearing twice, e.g.
  // once in fee_trigger_assertions.quote and again in wave_b_mechanics on
  // the SAME underlying clause, should be resolved once, not double
  // counted in the headline number -- occurrences are still shown per row).
  const distinctRefs = [...new Set(allCitations.map((c) => c.reference))].sort();

  console.log(`\n[harness] ${allCitations.length} citation occurrence(s) across ${RECORDED_RESPONSES.length} recorded responses, ${distinctRefs.length} distinct reference string(s)\n`);

  const rows = [];
  for (const ref of distinctRefs) {
    const node = findSectionByReference(tree, ref);
    const matchCount = refCounts.get(ref) || 0;
    let status;
    if (matchCount === 0) status = 'NULL';
    else if (matchCount >= 2) status = 'AMBIGUOUS';
    else status = 'RESOLVED';

    const occurrences = allCitations.filter((c) => c.reference === ref);
    const row = {
      reference: ref, status, matchCount, occurrences: occurrences.length,
      dispatchedFrom: [...new Set(occurrences.map((o) => o.dispatchedSection))],
      bareCitationOccurrence: occurrences.some((o) => o.isBareCitationQuote === true),
    };

    if (status === 'RESOLVED' && node) {
      const nodeText = sliceNodeText(fullText, node);
      const matchedCodes = feeTriggerCorroboratedCodes(nodeText);
      row.nodeKind = node.kind;
      row.nodeHeading = node.heading;
      row.nodeByteLength = node.end - node.start;
      row.matchedCodesInCitedText = matchedCodes;
      row.citedTextPreview = nodeText.replace(/\s+/g, ' ').trim().slice(0, 220);
    }
    rows.push(row);
  }

  console.log('reference'.padEnd(16), 'status'.padEnd(11), 'occ'.padEnd(4), 'from'.padEnd(14), 'bareCite'.padEnd(9), 'matchedCodes(cited text)');
  console.log('-'.repeat(120));
  for (const r of rows) {
    console.log(
      r.reference.padEnd(16),
      r.status.padEnd(11),
      String(r.occurrences).padEnd(4),
      r.dispatchedFrom.join(',').padEnd(14),
      String(r.bareCitationOccurrence).padEnd(9),
      r.status === 'RESOLVED' ? JSON.stringify(r.matchedCodesInCitedText) : '',
    );
  }

  const resolvedCount = rows.filter((r) => r.status === 'RESOLVED').length;
  const ambiguousCount = rows.filter((r) => r.status === 'AMBIGUOUS').length;
  const nullCount = rows.filter((r) => r.status === 'NULL').length;

  console.log(`\n[harness] SUMMARY -- distinct cited references: ${distinctRefs.length}`);
  console.log(`    RESOLVED  : ${resolvedCount}`);
  console.log(`    AMBIGUOUS : ${ambiguousCount}`);
  console.log(`    NULL      : ${nullCount}`);

  console.log('\n[harness] resolved references, cited node text preview + pattern-table result:');
  for (const r of rows.filter((x) => x.status === 'RESOLVED')) {
    console.log(`\n  ${r.reference}  (${r.nodeKind}${r.nodeHeading ? `, heading=${JSON.stringify(r.nodeHeading)}` : ''}, ${r.nodeByteLength} bytes)`);
    console.log(`    cited text: "${r.citedTextPreview}${r.citedTextPreview.length === 220 ? '...' : ''}"`);
    console.log(`    feeTriggerCorroboratedCodes(cited text) => ${JSON.stringify(r.matchedCodesInCitedText)}`);
  }

  if (nullCount > 0) {
    console.log('\n[harness] NULL references (sectionizer could not resolve):');
    for (const r of rows.filter((x) => x.status === 'NULL')) {
      console.log(`  ${r.reference}  (cited from: ${r.dispatchedFrom.join(', ')})`);
    }
  }

  // Narrower, legally salient subset: bare-citation-shaped fee_trigger_assertions
  // entries with trigger_code null -- the actual set this design exists to
  // help (a quote that names NO ground of its own, only a citation).
  const bareTriggerCandidates = allCitations.filter(
    (c) => c.array === 'fee_trigger_assertions' && c.field === 'quote'
      && c.triggerCode === null && c.isBareCitationQuote,
  );
  const bareTriggerByEntry = new Map();
  for (const c of bareTriggerCandidates) {
    const key = `${c.dispatchedSection}:${c.array}:${c.entryIndex}`;
    if (!bareTriggerByEntry.has(key)) bareTriggerByEntry.set(key, c);
  }
  console.log(`\n[harness] bare-citation-shaped, trigger_code:null fee_trigger_assertions entries: ${bareTriggerByEntry.size}`);
  for (const c of bareTriggerByEntry.values()) {
    const node = findSectionByReference(tree, c.reference);
    const cnt = refCounts.get(c.reference) || 0;
    const status = cnt === 0 ? 'NULL' : cnt >= 2 ? 'AMBIGUOUS' : 'RESOLVED';
    console.log(`  [${c.dispatchedSection}] "${c.quote}"  -> cites ${c.reference} (${status})`);
  }
}

main();
