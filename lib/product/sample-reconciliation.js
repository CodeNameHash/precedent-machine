'use strict';

// Reconciles a lawyer's independent sample notes on an agreement against the
// V2 layered facts of that agreement's run (Phase 5 exit item: "Reconcile
// Ben's existing independent, detailed provision samples against the
// corresponding V2 agreement results"). Pure functions; no database or
// model access. Contract: contracts/product/fact-components.v2.json.
//
// This module never decides severity or acceptance -- those columns are
// left blank for the lawyer. It only says which V2 fact a note item is
// probably about, and how confident that guess is.

const { walk, renderHeadline } = require('./fact-components');

// ─── Note normalisation ─────────────────────────────────────────────────
//
// Two source shapes are accepted, both from fixtures/product/ben-samples:
//  - note_batches[].items[]: section_reference, source_note_passage, point,
//    inventory_item_id, optional item_type: 'INVENTORY_GAP', optional
//    note_annotations (Ben's own process notes to himself -- not part of
//    the substantive point, so they never feed matching text).
//  - notes[]: section, user_text, one note per provision (a note may state
//    several points separated by semicolons; the spec asks for one item
//    per note, not a split on semicolons).
//
// `text` for the note_batches shape is `point`: a normalised transcription
// of Ben's own note, not new lawyer wording (normalised_points_are_new_
// lawyer_wording is false on both source fixtures), so it is a faithful,
// cleaner-to-tokenise stand-in for source_note_passage.

function normaliseNoteBatchesFile(raw) {
  const items = [];
  for (const batch of raw.note_batches || []) {
    for (const item of batch.items || []) {
      items.push({
        item_id: item.inventory_item_id,
        section_reference: item.section_reference,
        text: item.point,
        is_gap: item.item_type === 'INVENTORY_GAP',
      });
    }
  }
  return items;
}

function slugForSection(section) {
  return String(section || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function normaliseFlatNotesFile(raw, prefix) {
  const seen = new Map();
  return (raw.notes || []).map((note) => {
    const slug = slugForSection(note.section);
    const occurrence = (seen.get(slug) || 0) + 1;
    seen.set(slug, occurrence);
    const item_id = occurrence > 1 ? `${prefix}-${slug}-${occurrence}` : `${prefix}-${slug}`;
    return {
      item_id,
      section_reference: note.section,
      text: note.user_text,
      is_gap: false,
    };
  });
}

// Auto-detects the shape and returns a flat item list:
// { item_id, section_reference, text, is_gap }[]
function normaliseNoteFile(raw, { flatItemPrefix = 'NOTE' } = {}) {
  if (raw && Array.isArray(raw.note_batches)) return normaliseNoteBatchesFile(raw);
  if (raw && Array.isArray(raw.notes)) return normaliseFlatNotesFile(raw, flatItemPrefix);
  throw new Error("unrecognised note file shape: expected 'note_batches' or 'notes'");
}

// ─── Section reference matching ─────────────────────────────────────────
//
// `candidate` (a fact's section_reference) is a self-or-descendant of
// `root` when it is exactly root, or starts with root followed by a
// boundary character ('(' opens a subsection, '.' a further decimal
// level). This lets a bare root like "5.2" or "7.1(c)" reach every nested
// subsection without also matching an unrelated sibling that merely
// shares a numeric prefix (e.g. root "5.1" must not match "5.10").
// Section numbers as the two sides write them: a note says "6.1(a)", the
// structure builder gives Metsera "6.01(a)" (two-digit section numbers
// are the agreement's own) and NCS "6.1(a)". Leading zeros in the
// section part are dropped on both sides (as lib/product/source-context.js
// normalizedReference does), so the note reaches the section whichever
// way the agreement counts. Read on the Metsera generation 8 dry run,
// 2026-10-18: before this every Olaplex note item was MISSING with no
// candidate, because no "6.1" matched a "6.01".
function normaliseReference(reference) {
  const text = String(reference || '').trim().replace(/^section\s+/i, '');
  const parts = text.match(/^(\d+)\.(\d+)(.*)$/);
  return parts ? `${parseInt(parts[1], 10)}.${parseInt(parts[2], 10)}${parts[3]}` : text;
}

function startsAtBoundary(longer, shorter) {
  if (!longer.startsWith(shorter)) return false;
  const boundary = longer[shorter.length];
  return boundary === '(' || boundary === '.';
}

function isSelfOrDescendant(root, candidate) {
  if (!root || !candidate) return false;
  const rootStr = normaliseReference(root);
  const candidateStr = normaliseReference(candidate);
  if (candidateStr === rootStr) return true;
  return startsAtBoundary(candidateStr, rootStr);
}

// A V2 fact's section_reference is its structure node's reference, and the
// active structure builder's nodes are sections ("6.01", "7.03"), never
// subsections (read from the source closures of Metsera generation 8 and
// NCS generations 4 and 5, 2026-10-18: no reference carries "(a)"). A note
// on "6.1(a)" is therefore about facts filed under "6.1": the fact's
// section may be the note's own section, below it, or above it. Before
// this reading only self-or-descendant matched, so every subsection note
// had no candidate on the Metsera dry run.
function isRelatedSection(root, candidate) {
  if (!root || !candidate) return false;
  if (isSelfOrDescendant(root, candidate)) return true;
  const candidateStr = normaliseReference(candidate);
  // The fact's section must be a section ("6.1"), never an article alone.
  if (!/^\d+\.\d+/.test(candidateStr)) return false;
  return startsAtBoundary(normaliseReference(root), candidateStr);
}

// Expands a lettered or numbered range ("a".."d", "1".."3"). Returns null
// (no expansion) for anything else, including roman numerals -- none of
// the source fixtures need that, and a silent wrong expansion would be
// worse than falling back to a literal, unexpanded reference.
function expandRangeTokens(startToken, endToken) {
  if (/^[a-z]$/.test(startToken) && /^[a-z]$/.test(endToken)) {
    const start = startToken.charCodeAt(0);
    const end = endToken.charCodeAt(0);
    if (end < start) return null;
    const out = [];
    for (let code = start; code <= end; code += 1) out.push(String.fromCharCode(code));
    return out;
  }
  if (/^\d+$/.test(startToken) && /^\d+$/.test(endToken)) {
    const start = parseInt(startToken, 10);
    const end = parseInt(endToken, 10);
    if (end < start || end - start > 50) return null;
    const out = [];
    for (let n = start; n <= end; n += 1) out.push(String(n));
    return out;
  }
  return null;
}

// One reference segment with no "and": either a plain root ("5.2",
// "7.1(c)") or a lettered/numbered range ("6.1(a)-(d)").
function matcherForSingleReference(reference) {
  const trimmed = reference.trim();
  const rangeMatch = trimmed.match(/^(.*)\(([a-z0-9]+)\)-\(([a-z0-9]+)\)$/i);
  if (rangeMatch) {
    const [, base, startToken, endToken] = rangeMatch;
    const letters = expandRangeTokens(startToken.toLowerCase(), endToken.toLowerCase());
    if (letters) {
      const roots = letters.map((letter) => `${base}(${letter})`);
      return (candidate) => roots.some((root) => isRelatedSection(root, candidate));
    }
  }
  return (candidate) => isRelatedSection(trimmed, candidate);
}

const ROMAN_VALUES = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };

function romanToArabic(roman) {
  let total = 0;
  for (let i = 0; i < roman.length; i += 1) {
    const value = ROMAN_VALUES[roman[i]];
    const next = ROMAN_VALUES[roman[i + 1]];
    total += next && value < next ? -value : value;
  }
  return total;
}

// "Article III intro" matches the Article III introduction/chapeau node.
// The active structure builder names that node "III-INTRO" (read from the
// stored source closures of Metsera generation 8 and NCS generations 4
// and 5 on the preview branch, 2026-10-18: every run carries "III-INTRO"
// and "IV-INTRO"); before that reading this accepted only the roman
// numeral alone ("III"), the bare arabic article number ("3") or a ".0"
// placeholder ("3.0"), so Apogee's "Article III intro" note would have
// matched nothing. All four forms are accepted.
function matcherForArticleIntro(reference) {
  const match = reference.trim().match(/^article\s+([ivxlcdm]+)\s+intro$/i);
  if (!match) return null;
  const roman = match[1].toUpperCase();
  const arabic = romanToArabic(roman);
  const accepted = new Set([roman, `${roman}-INTRO`, String(arabic), `${arabic}.0`]);
  return (candidate) => accepted.has(String(candidate).trim().toUpperCase());
}

// A note's section_reference to a predicate over a fact's section_reference.
// Handles "Article III intro", "X and Y" (either side matches), a lettered
// or numbered range ("6.1(a)-(d)"), and a plain reference-and-below root.
function referenceMatcher(noteReference) {
  const reference = String(noteReference || '');
  const introMatcher = matcherForArticleIntro(reference);
  if (introMatcher) return introMatcher;
  const parts = reference.split(/\s+and\s+/i).map((part) => part.trim()).filter(Boolean);
  const matchers = (parts.length ? parts : [reference]).map(matcherForSingleReference);
  return (candidate) => matchers.some((matcher) => matcher(candidate));
}

// ─── Token overlap ──────────────────────────────────────────────────────
//
// A deliberately small, standard English function-word list. Numbers and
// dollar amounts are always kept regardless of length (the spec requires
// it), and it does not strip legally loaded words like "not" or "must" --
// only pure grammatical filler that would otherwise dominate every note.
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'of', 'to', 'and', 'or', 'in', 'on', 'at', 'by', 'for', 'with', 'as',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'that', 'this', 'these', 'those',
  'it', 'its', 'their', 'his', 'her', 'from', 'into', 'than', 'then', 'so', 'such',
  'which', 'who', 'whom', 'but', 'if', 'because', 'about', 'above', 'after', 'again',
  'against', 'also', 'between', 'both', 'during', 'further', 'here', 'how', 'once',
  'only', 'other', 'out', 'over', 'same', 'some', 'through', 'until', 'up', 'very',
  'when', 'where', 'while', 'do', 'does', 'did', 'have', 'has', 'had', 'i', 'we', 'you', 'they',
]);

// Lower-cases, then keeps runs of letters and number-like runs (which may
// carry a leading "$" and trailing unit letters, e.g. "2.5mm", "$150,000").
const TOKEN_PATTERN = /[a-z]+|\$?\d[\d,.]*[a-z%]*/g;

function tokenize(text) {
  if (!text) return [];
  const raw = String(text).toLowerCase().match(TOKEN_PATTERN) || [];
  return raw.filter((token) => {
    if (/\d/.test(token)) return true;
    return token.length > 1 && !STOP_WORDS.has(token);
  });
}

function factTokenSet(fact) {
  const tokens = new Set();
  for (const token of tokenize(renderHeadline(fact))) tokens.add(token);
  for (const [component] of walk(fact.components || [])) {
    for (const token of tokenize(component.text)) tokens.add(token);
  }
  return tokens;
}

// Share of the note's own distinct tokens that also appear in the fact's
// token set -- "how much of what the note said, this fact accounts for".
function overlapShare(noteTokens, factTokens) {
  const distinct = new Set(noteTokens);
  if (distinct.size === 0) return 0;
  let hits = 0;
  for (const token of distinct) if (factTokens.has(token)) hits += 1;
  return hits / distinct.size;
}

// ─── Ordering ────────────────────────────────────────────────────────────

function naturalParts(value) {
  return String(value || '').match(/\d+|\D+/g) || [];
}

function naturalCompare(a, b) {
  const partsA = naturalParts(a);
  const partsB = naturalParts(b);
  const length = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < length; i += 1) {
    const partA = partsA[i] ?? '';
    const partB = partsB[i] ?? '';
    if (partA === partB) continue;
    const numA = /^\d+$/.test(partA) ? Number(partA) : null;
    const numB = /^\d+$/.test(partB) ? Number(partB) : null;
    if (numA !== null && numB !== null) return numA - numB;
    return partA < partB ? -1 : 1;
  }
  return 0;
}

// ─── Reconciliation ─────────────────────────────────────────────────────

function statusForShare(share) {
  if (share >= 0.5) return 'MATCHED';
  if (share >= 0.2) return 'PARTIAL';
  return 'UNMATCHED';
}

// reconcileSampleNotes({ items, facts }) -> { results, unmentionedFacts, summary }
//
// `items`: normalised note items ({ item_id, section_reference, text, is_gap }).
// `facts`: V2 facts (FACT_COMPONENTS/V2), each with section_reference.
//
// Candidate facts for an item are those inside the item's section
// reference (see referenceMatcher). The best candidate is the one with
// the highest overlap_share; ties break by section order then fact_id for
// a deterministic report. A GAP item never runs matching -- Ben already
// recorded that the document has no corresponding provision.
//
// "Facts the notes do not mention": among facts that were at least a
// candidate for some item, those never picked as a MATCHED or PARTIAL
// best match for any item. A fact that was only ever a low-overlap best
// guess (i.e. behind a MISSING result) does not count as mentioned --
// the note almost certainly was not about it.
function reconcileSampleNotes({ items, facts }) {
  const allFacts = facts || [];
  const factsWithReference = allFacts.filter((fact) => fact.section_reference);

  const candidateFactIds = new Set();
  const mentionedFactIds = new Set();

  const results = (items || []).map((item) => {
    if (item.is_gap) {
      return {
        item_id: item.item_id,
        section_reference: item.section_reference,
        text: item.text,
        is_gap: true,
        status: 'GAP',
        candidate_count: 0,
        best_fact: null,
        overlap_share: null,
      };
    }

    const matches = referenceMatcher(item.section_reference);
    const candidates = factsWithReference.filter((fact) => matches(fact.section_reference));
    for (const fact of candidates) candidateFactIds.add(fact.fact_id);

    const noteTokens = tokenize(item.text);
    const scored = candidates
      .map((fact) => ({ fact, share: overlapShare(noteTokens, factTokenSet(fact)) }))
      .sort((a, b) => (
        b.share - a.share
        || naturalCompare(a.fact.section_reference, b.fact.section_reference)
        || String(a.fact.fact_id).localeCompare(String(b.fact.fact_id))
      ));

    const best = scored[0] || null;
    // Work package 41 (2026-10-25, from the Apogee reconciliation): MISSING
    // means the section has no fact to compare against at all — the machine
    // proposed nothing there. A section that does have facts, none of which
    // shares the note's words, is UNMATCHED: the note may be a conceptual
    // shorthand no word overlap can reach (Ben's "cap on buyer. efforts;
    // anti hell or high water" against "No divestiture, conduct or
    // litigation commitment"), so it needs a lawyer's eye rather than being
    // reported as a fact the machine missed.
    const status = best ? statusForShare(best.share) : 'MISSING';
    const reportedStatus = status === 'UNMATCHED' && candidates.length === 0 ? 'MISSING' : status;
    if (best && (reportedStatus === 'MATCHED' || reportedStatus === 'PARTIAL')) mentionedFactIds.add(best.fact.fact_id);

    return {
      item_id: item.item_id,
      section_reference: item.section_reference,
      text: item.text,
      is_gap: false,
      status: reportedStatus,
      candidate_count: candidates.length,
      best_fact: best ? { fact_id: best.fact.fact_id, section_reference: best.fact.section_reference, headline: renderHeadline(best.fact) } : null,
      overlap_share: best ? best.share : null,
    };
  });

  const unmentionedFacts = factsWithReference
    .filter((fact) => candidateFactIds.has(fact.fact_id) && !mentionedFactIds.has(fact.fact_id))
    .map((fact) => ({ fact_id: fact.fact_id, section_reference: fact.section_reference, headline: renderHeadline(fact) }))
    .sort((a, b) => naturalCompare(a.section_reference, b.section_reference) || a.fact_id.localeCompare(b.fact_id));

  const summary = { MATCHED: 0, PARTIAL: 0, UNMATCHED: 0, MISSING: 0, GAP: 0 };
  for (const result of results) summary[result.status] += 1;

  return { results, unmentionedFacts, summary };
}

module.exports = {
  normaliseReference,
  normaliseNoteFile,
  normaliseNoteBatchesFile,
  normaliseFlatNotesFile,
  referenceMatcher,
  isRelatedSection,
  isSelfOrDescendant,
  tokenize,
  overlapShare,
  reconcileSampleNotes,
};
