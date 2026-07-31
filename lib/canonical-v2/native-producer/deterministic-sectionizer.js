// ─── Deterministic Sectionizer ───
//
// Turns an admitted merger-agreement text into a stable, ordered section
// tree with exact UTF-8 byte offsets into the ORIGINAL admitted bytes — no
// hand-picked interval constants, no model calls, no DB/file reads.
//
// This module is the automatic replacement for the human-typed
// {start,end} byte intervals that used to live in reviewed-*-slice.js
// files (see lib/canonical-v2/reviewed-qxo-capitalisation-slice.js). It
// answers: "where does Section 3.1(b) actually live in THIS document's
// bytes?" without a human having read the filing first.
//
// Reuse strategy (see project report for the full explanation):
//   - lib/parser-v2/structural.js's `parseStructure` is REQUIRED (imported,
//     not copied). It already solves ARTICLE / "Section X.XX" heading
//     detection deterministically and, critically, it is offset-transparent:
//     it never calls its own `cleanText` internally, so whatever string you
//     hand it, the `startChar`/`endChar` it returns are offsets into THAT
//     string. Every production caller in this repo (canonical-proposals.js,
//     parser-proposal-adapter.js, scripts/reprocess.js, ...) feeds it
//     `buildLayers(rawText).cleanText`, so that is the idiom this module
//     follows too.
//   - lib/parser-v2/text-layers.js's `buildLayers` is REQUIRED (imported).
//     It is the proven, monotone, round-trip-checked clean<->raw offset
//     mapping already relied on by
//     lib/canonical-v2/qxo-capitalisation-parser-source-closure-f27.js.
//   - structural.js does NOT export a subsection/sub-item tree builder
//     (only a per-section `subItemCount` counter for atomic-provision
//     metadata — see `countSubItems`). Nested "(a)" / "(i)" / "(A)" clause
//     detection below is NEW code, written for this module, not copied
//     from anywhere: there was nothing importable to reuse for it.
//   - A handful of small helpers inside structural.js that *would* have
//     been directly reusable for cross-reference-vs-heading classification
//     (`isHeading`, `XREF_SIGNALS`, `romanToInt`/`intToRoman`) are not
//     exported (`module.exports = { parseStructure, cleanText,
//     displayCleanText, buildParserReview }`), so they cannot be required.
//     This module does not duplicate them: it does not need
//     heading-vs-cross-reference classification at all (Section-level
//     heading detection is fully delegated to `parseStructure`), except for
//     a small independent roman-numeral <-> integer pair written from
//     scratch below for subsection-sequence validation ("(i)" -> "(ii)" ->
//     "(iii)"). That is a ubiquitous, non-proprietary algorithm, not a
//     derivative of structural.js's private implementation.

const { contentId, sha256Hex } = require('../canonical-bytes');
const { parseStructure } = require('../../parser-v2/structural');
const { buildLayers } = require('../../parser-v2/text-layers');

const SCHEMA_VERSION = 'DETERMINISTIC_SECTIONIZER/V1';
const ROMAN_CHARS = new Set(['i', 'v', 'x', 'l', 'c', 'd', 'm']);
const ROMAN_VALUES = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 };
const ROMAN_TABLE = [
  [1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'],
  [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'],
  [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i'],
];

class DeterministicSectionizerError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'DeterministicSectionizerError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new DeterministicSectionizerError(code, message);
}

// ─── Roman numerals (independent, minimal — see header note) ───

function romanToInt(str) {
  const lower = str.toLowerCase();
  let total = 0;
  for (let i = 0; i < lower.length; i++) {
    const curr = ROMAN_VALUES[lower[i]] || 0;
    const next = ROMAN_VALUES[lower[i + 1]] || 0;
    total += curr < next ? -curr : curr;
  }
  return total;
}

function intToRoman(num) {
  let n = num;
  let out = '';
  for (const [value, symbol] of ROMAN_TABLE) {
    while (n >= value) {
      out += symbol;
      n -= value;
    }
  }
  return out;
}

function isCanonicalLowerRoman(token) {
  if (!token || !/^[ivxlcdm]+$/.test(token)) return false;
  const value = romanToInt(token);
  return value > 0 && value <= 200 && intToRoman(value) === token;
}

// ─── Marker classification ───
//
// A "marker" is a parenthesized label ("(a)", "(ii)", "(A)") that opens a
// new line ("(?:^|\n)[ \t]*\(...\)"). Real merger agreements never start a
// genuine body line with a lettered list marker unless it IS a list item —
// mid-sentence cross-references like "the items referred to in clauses (B)
// and (C)" or "(the “A&R 2015 Plan”)" never appear at a line start,
// so the line-start anchor alone screens out the overwhelming majority of
// false positives without needing structural.js's heavier
// heading-vs-cross-reference heuristics.

const MARKER_PATTERN = /(?:^|\n)[ \t]*\(([A-Za-z]{1,3}|[0-9]{1,3})\)/g;

function classifyOpeningKind(label) {
  if (/^[0-9]+$/.test(label)) return 'DIGIT';
  if (label.length === 1) {
    const lower = label.toLowerCase();
    const isUpper = label === label.toUpperCase() && label !== label.toLowerCase();
    if (!ROMAN_CHARS.has(lower)) {
      // Unambiguous single letter outside the roman alphabet (b, d, e, f, g,
      // h, j, k, n, o, p, q, r, s, t, u, w, y, z) — always a letter marker,
      // whatever value it opens at (our real QXO fixture starts at "(b)",
      // not "(a)", because the excerpt omits subsection (a)).
      return isUpper ? 'UPPER_LETTER' : 'LOWER_LETTER';
    }
    // Ambiguous single char that is both a valid roman numeral and a valid
    // letter (i, v, x, l, c, d, m). "(i)"/"(I)" opening a fresh nested list
    // is overwhelmingly the roman numeral convention in US merger-agreement
    // drafting ("(a) ... (i) ... (ii) ..."); any other ambiguous opener
    // (v, x, l, c, d, m) with no preceding (i)-(iv) in this scope is far
    // more plausibly a letter sequence that simply doesn't start at "a"
    // (mirrors the unambiguous-letter case above).
    if (lower === 'i') return isUpper ? 'UPPER_ROMAN' : 'LOWER_ROMAN';
    return isUpper ? 'UPPER_LETTER' : 'LOWER_LETTER';
  }
  const lower = label.toLowerCase();
  const isUpper = label === label.toUpperCase();
  if (isCanonicalLowerRoman(lower)) return isUpper ? 'UPPER_ROMAN' : 'LOWER_ROMAN';
  // Doubled-letter overflow ("aa", "bb") — accepted as a letter-track
  // opener only in the degenerate single-run-of-one-char shape.
  if (/^([a-z])\1+$/.test(lower)) return isUpper ? 'UPPER_LETTER' : 'LOWER_LETTER';
  return null;
}

function kindMatchesLabel(kind, label) {
  switch (kind) {
    case 'LOWER_LETTER': return /^[a-z]$/.test(label) || /^([a-z])\1+$/.test(label);
    case 'UPPER_LETTER': return /^[A-Z]$/.test(label) || /^([A-Z])\1+$/.test(label);
    case 'LOWER_ROMAN': return isCanonicalLowerRoman(label);
    case 'UPPER_ROMAN': return isCanonicalLowerRoman(label.toLowerCase()) && label === label.toUpperCase();
    case 'DIGIT': return /^[0-9]+$/.test(label);
    default: return false;
  }
}

function expectedNext(kind, value) {
  switch (kind) {
    case 'LOWER_LETTER': {
      if (/^[a-z]$/.test(value)) {
        return value === 'z' ? null : String.fromCharCode(value.charCodeAt(0) + 1);
      }
      const m = value.match(/^([a-z])\1+$/);
      return m ? m[1].repeat(value.length + 1) : null;
    }
    case 'UPPER_LETTER': {
      if (/^[A-Z]$/.test(value)) {
        return value === 'Z' ? null : String.fromCharCode(value.charCodeAt(0) + 1);
      }
      const m = value.match(/^([A-Z])\1+$/);
      return m ? m[1].repeat(value.length + 1) : null;
    }
    case 'LOWER_ROMAN':
      return intToRoman(romanToInt(value.toLowerCase()) + 1);
    case 'UPPER_ROMAN':
      return intToRoman(romanToInt(value.toLowerCase()) + 1).toUpperCase();
    case 'DIGIT':
      return String(parseInt(value, 10) + 1);
    default:
      return null;
  }
}

// ─── Marker-stack tree builder ───
//
// Standard outline-to-tree conversion over a flat, in-order marker stream:
// a candidate continues the deepest open sequence it matches (closing any
// deeper, now-finished sequences on the way), or — if it matches no open
// sequence — opens a brand-new child level directly under whatever sequence
// is currently deepest. A candidate that does neither is not a marker and
// is left as body text.

function findMarkerCandidates(text) {
  const candidates = [];
  MARKER_PATTERN.lastIndex = 0;
  let match;
  while ((match = MARKER_PATTERN.exec(text)) !== null) {
    const label = match[1];
    const openParenLocal = match.index + match[0].lastIndexOf(`(${label})`);
    candidates.push({ label, start: openParenLocal, end: openParenLocal + label.length + 2 });
  }
  return candidates;
}

function buildMarkerTree(text) {
  const candidates = findMarkerCandidates(text);
  const root = { children: [] };
  // stack entries: { kind, value, node, parentChildren }
  const stack = [{ kind: null, value: null, node: root, parentChildren: null }];
  let previousCandidateEnd = 0;

  function finalize(frame, endLocal) {
    frame.node.localEnd = endLocal;
  }

  for (const candidate of candidates) {
    const { label, start, end: markerEnd } = candidate;

    // A candidate whose gap since the previous one PASSES THROUGH a long run
    // of literal spaces/tabs (30+, no newline within that run) is not a
    // continuation of anything real: drafted prose always wraps with actual
    // line breaks well before 30 columns of indentation, so a run like that
    // only shows up in artificial byte-offset padding (see the padded QXO
    // test fixture built for interval-drift tests elsewhere in this repo,
    // which places real section text inside ' '.repeat(n) filler). Treat it
    // as a hard reset back to the document root so two unrelated content
    // islands separated by such padding never get chained into one fake
    // nested sequence, even if the gap also contains ordinary prose/newlines
    // closer to the candidate itself.
    const gap = text.slice(previousCandidateEnd, start);
    const hardGapMatch = /[ \t]{30,}/.exec(gap);
    if (hardGapMatch) {
      // Close out the still-open frames at the point the padding run
      // actually STARTS (the true end of the previous real content island),
      // not at the previous marker's own token end — any real prose between
      // the previous marker and the padding (a trailing sentence, a
      // following heading picked up by structural.js, etc.) still belongs to
      // whatever was open before the reset.
      const islandEnd = previousCandidateEnd + hardGapMatch.index;
      while (stack.length > 1) finalize(stack.pop(), islandEnd);
    }
    previousCandidateEnd = markerEnd;

    let matchedDepth = -1;
    for (let depth = stack.length - 1; depth >= 1; depth--) {
      const frame = stack[depth];
      if (kindMatchesLabel(frame.kind, label) && expectedNext(frame.kind, frame.value) === label) {
        matchedDepth = depth;
        break;
      }
    }

    if (matchedDepth >= 0) {
      while (stack.length - 1 > matchedDepth) {
        finalize(stack.pop(), start);
      }
      const matched = stack.pop();
      finalize(matched, start);
      const parent = stack[stack.length - 1];
      const node = {
        marker: `(${label})`,
        label,
        kind: matched.kind,
        localStart: start,
        localMarkerEnd: markerEnd,
        localEnd: null,
        children: [],
      };
      parent.node.children.push(node);
      stack.push({ kind: matched.kind, value: label, node, parentChildren: parent.node.children });
      continue;
    }

    const kind = classifyOpeningKind(label);
    if (!kind) continue; // not a recognisable marker — leave as body text

    const parent = stack[stack.length - 1];
    const node = {
      marker: `(${label})`,
      label,
      kind,
      localStart: start,
      localMarkerEnd: markerEnd,
      localEnd: null,
      children: [],
    };
    parent.node.children.push(node);
    stack.push({ kind, value: label, node, parentChildren: parent.node.children });
  }

  while (stack.length > 1) {
    finalize(stack.pop(), text.length);
  }
  root.localEnd = text.length;
  return root.children;
}

// ─── Heuristic sub-heading capture ───
//
// Some top-level lettered subsections carry their own short title
// immediately after the marker ("(b)Capital Structure." — QXO Section
// 3.1(b)). Best-effort only: a short Title-Case, period-terminated phrase
// right after the marker with no line break. Anything else is left as
// heading: null — the node's byte span is the load-bearing property, not
// this label.
function captureMarkerHeading(text, node) {
  const after = text.slice(node.localMarkerEnd, Math.min(node.localEnd, node.localMarkerEnd + 90));
  const m = after.match(/^([A-Z][A-Za-z0-9 ,'&()/-]{1,78}?\.)(?=\s|$)/);
  if (!m) return null;
  const phrase = m[1];
  if (/[.!?]\s+[A-Z]/.test(phrase)) return null; // multi-sentence -> not a title
  return phrase;
}

// ─── Offset conversion ───

function charToByteOffset(text, charIndex) {
  return Buffer.byteLength(text.slice(0, charIndex), 'utf8');
}

// ─── Node assembly ───

function makeNode({
  documentHash, kind, reference, heading, sourceText, rawStartChar, rawEndChar, depth, parentId,
  required = true,
}) {
  const start = charToByteOffset(sourceText, rawStartChar);
  const end = charToByteOffset(sourceText, rawEndChar);
  if (!(end > start)) {
    // Real filings occasionally produce a degenerate span from structural.js's
    // own heuristics (e.g. a trailing EXHIBIT/ANNEX pseudo-article whose
    // start lands past every other computed boundary). The contract here is
    // "never invent, never throw on messy input" — so a non-ROOT node with
    // an empty/inverted span is dropped rather than raised.
    if (required) {
      fail('EMPTY_SECTION_SPAN', `section "${reference || kind}" resolved to an empty or inverted byte span`);
    }
    return null;
  }
  const exactText = sourceText.slice(rawStartChar, rawEndChar);
  const textSha256 = sha256Hex(Buffer.from(exactText, 'utf8'));
  const idBody = {
    schema_version: SCHEMA_VERSION,
    document_hash: documentHash,
    kind,
    reference: reference || null,
    depth,
    parent_section_id: parentId,
    start,
    end,
    text_sha256: textSha256,
  };
  return {
    section_id: contentId('DETERMINISTIC_SECTION_NODE/V1', idBody),
    parent_section_id: parentId,
    depth,
    kind,
    reference: reference || null,
    heading: heading || null,
    start,
    end,
    text_sha256: textSha256,
  };
}

function appendMarkerNodes({
  out, documentHash, sourceText, layers, markerNodes, containerCleanStart, containerRawStart,
  parentReference, parentId, depth, containerText,
}) {
  for (const node of markerNodes) {
    const cleanStart = containerCleanStart + node.localStart;
    const cleanEnd = containerCleanStart + node.localEnd;
    const rawStart = layers.mapCleanToRaw(cleanStart);
    const rawEnd = layers.mapCleanToRaw(cleanEnd);
    const reference = `${parentReference || ''}(${node.label})`;
    const heading = captureMarkerHeading(containerText, node);
    const built = makeNode({
      documentHash,
      kind: 'SUBSECTION',
      reference,
      heading,
      sourceText,
      rawStartChar: rawStart,
      rawEndChar: rawEnd,
      depth,
      parentId,
      required: false,
    });
    if (!built) continue;
    out.push(built);
    if (node.children.length > 0) {
      appendMarkerNodes({
        out,
        documentHash,
        sourceText,
        layers,
        markerNodes: node.children,
        containerCleanStart,
        containerRawStart,
        parentReference: reference,
        parentId: built.section_id,
        depth: depth + 1,
        containerText,
      });
    }
  }
}

// ─── Public API ───

function sectionizeAdmittedSource({ source_text: sourceText, document_hash: documentHash } = {}) {
  if (typeof sourceText !== 'string') fail('SOURCE_TEXT_REQUIRED', 'source_text must be a string');
  if (typeof documentHash !== 'string' || !documentHash) {
    fail('DOCUMENT_HASH_REQUIRED', 'document_hash must be a non-empty string');
  }

  const sourceByteLength = Buffer.byteLength(sourceText, 'utf8');
  const sourceSha256 = sha256Hex(Buffer.from(sourceText, 'utf8'));

  if (sourceText.length === 0) {
    return Object.freeze({
      schema_version: SCHEMA_VERSION,
      document_hash: documentHash,
      source_byte_length: sourceByteLength,
      source_sha256: sourceSha256,
      root_section_id: null,
      nodes: Object.freeze([]),
    });
  }

  const rootNode = makeNode({
    documentHash,
    kind: 'ROOT',
    reference: null,
    heading: null,
    sourceText,
    rawStartChar: 0,
    rawEndChar: sourceText.length,
    depth: 0,
    parentId: null,
  });
  const nodes = [rootNode];

  const layers = buildLayers(sourceText);
  const clean = layers.cleanText;
  const parsed = parseStructure(clean);

  const articleById = new Map();
  // `parseStructure` synthesizes a placeholder ARTICLE entry (title
  // "Article <roman>", `synthesized: true`) when a document's section
  // numbering implies an article that has no actual "ARTICLE ..." heading
  // in the text (its own documented fallback for EDGAR exhibits that drop
  // the header line). Materializing a node for that here would be
  // inventing structure the source bytes don't contain, so only real,
  // textually-observed article headings become ARTICLE nodes.
  const sortedArticles = [...(parsed.articles || [])]
    .filter((article) => !article.synthesized)
    .sort((a, b) => a.startChar - b.startChar);
  for (let i = 0; i < sortedArticles.length; i++) {
    const article = sortedArticles[i];
    const cleanStart = article.startChar;
    // The last article's end falls back to the FULL clean-text length, not
    // `bodyEnd` — structural.js appends trailing EXHIBIT/ANNEX pseudo-articles
    // (parseAnnexes) whose startChar can legitimately sit past `bodyEnd`,
    // which would otherwise produce an inverted span.
    const cleanEnd = i + 1 < sortedArticles.length
      ? sortedArticles[i + 1].startChar
      : clean.length;
    if (!(cleanEnd > cleanStart)) continue;
    const rawStart = layers.mapCleanToRaw(cleanStart);
    const rawEnd = layers.mapCleanToRaw(cleanEnd);
    const reference = `ARTICLE ${article.number}`;
    const built = makeNode({
      documentHash,
      kind: 'ARTICLE',
      reference,
      heading: article.title || null,
      sourceText,
      rawStartChar: rawStart,
      rawEndChar: rawEnd,
      depth: 1,
      parentId: rootNode.section_id,
      required: false,
    });
    if (!built) continue;
    nodes.push(built);
    articleById.set(article.number, built);
  }

  const sortedSections = [...(parsed.sections || [])].sort((a, b) => a.startChar - b.startChar);
  let anySectionOrSubsection = false;

  for (const section of sortedSections) {
    const cleanStart = section.startChar;
    const cleanEnd = section.endChar;
    if (!(cleanEnd > cleanStart)) continue;
    const rawStart = layers.mapCleanToRaw(cleanStart);
    const rawEnd = layers.mapCleanToRaw(cleanEnd);
    const parentArticle = articleById.get(String(section.articleNumber || '').toUpperCase());
    const parentId = parentArticle ? parentArticle.section_id : rootNode.section_id;
    const depth = parentArticle ? 2 : 1;
    const reference = section.number;
    const built = makeNode({
      documentHash,
      kind: 'SECTION',
      reference,
      heading: section.title || null,
      sourceText,
      rawStartChar: rawStart,
      rawEndChar: rawEnd,
      depth,
      parentId,
      required: false,
    });
    if (!built) continue;
    nodes.push(built);
    anySectionOrSubsection = true;

    const sectionCleanText = clean.slice(cleanStart, cleanEnd);
    const markerTree = buildMarkerTree(sectionCleanText);
    if (markerTree.length > 0) {
      appendMarkerNodes({
        out: nodes,
        documentHash,
        sourceText,
        layers,
        markerNodes: markerTree,
        containerCleanStart: cleanStart,
        containerRawStart: rawStart,
        parentReference: reference,
        parentId: built.section_id,
        depth: depth + 1,
        containerText: sectionCleanText,
      });
      anySectionOrSubsection = true;
    }
  }

  // No "Section X.XX" structure at all (e.g. an isolated excerpt that opens
  // directly on lettered subsections, like the QXO Section 3.1(b) capital
  // structure excerpt). Fall back to marker-tree parsing over the whole
  // document body so an addressable tree still comes out the other end.
  if (!anySectionOrSubsection) {
    const markerTree = buildMarkerTree(clean);
    if (markerTree.length > 0) {
      appendMarkerNodes({
        out: nodes,
        documentHash,
        sourceText,
        layers,
        markerNodes: markerTree,
        containerCleanStart: 0,
        containerRawStart: 0,
        parentReference: '',
        parentId: rootNode.section_id,
        depth: 1,
        containerText: clean,
      });
    }
  }

  return Object.freeze({
    schema_version: SCHEMA_VERSION,
    document_hash: documentHash,
    source_byte_length: sourceByteLength,
    source_sha256: sourceSha256,
    root_section_id: rootNode.section_id,
    nodes: Object.freeze(nodes.map((node) => Object.freeze(node))),
  });
}

function findSectionByReference(tree, reference) {
  if (!tree || !reference) return null;
  const nodes = Array.isArray(tree) ? tree : tree.nodes;
  if (!Array.isArray(nodes)) return null;
  const normalized = String(reference).trim();
  return nodes.find((node) => node.reference === normalized) || null;
}

module.exports = {
  SCHEMA_VERSION,
  DeterministicSectionizerError,
  sectionizeAdmittedSource,
  findSectionByReference,
};
