// ─── Parser v2 — Phase 1: Structural Parsing ───
// Splits a merger agreement's full text into sections with article context.
// Purely deterministic regex-based parsing — no AI calls.

const {
  cleanEdgarText,
  removeRepeatedHeaders,
  cleanSectionText,
} = require('../edgar-cleanup');

// ─── Roman Numeral Utilities ───

const ROMAN_VALS = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };

function romanToInt(str) {
  if (!str) return 0;
  const upper = str.toUpperCase();
  let result = 0;
  for (let i = 0; i < upper.length; i++) {
    const curr = ROMAN_VALS[upper[i]] || 0;
    const next = ROMAN_VALS[upper[i + 1]] || 0;
    result += curr < next ? -curr : curr;
  }
  return result;
}

function intToRoman(num) {
  if (num <= 0 || num > 3999) return String(num);
  const map = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
    [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let result = '';
  for (const [val, sym] of map) {
    while (num >= val) {
      result += sym;
      num -= val;
    }
  }
  return result;
}

// Check if a string is a valid roman numeral
function isRomanNumeral(str) {
  return /^[IVXLCDM]+$/i.test(str) && romanToInt(str) > 0;
}

// ─── Cross-Reference Detection ───

// Words/phrases that signal a cross-reference rather than a heading
const XREF_SIGNALS = /(?:in|under|of|to|from|pursuant\s+to|set\s+forth\s+in|described\s+in|defined\s+in|referenced\s+in|subject\s+to|accordance\s+with|provided\s+in|specified\s+in|required\s+by|referred\s+to\s+in|see|per|comply\s+with|violation\s+of|provisions\s+of|obligations\s+under|requirements\s+of|terms\s+of|meaning\s+of|contemplated\s+by)\s*$/i;

/**
 * Determine if a "Section X.XX" match at `matchIndex` in `text` is a heading
 * (as opposed to a cross-reference within body text).
 *
 * A heading starts a new line (only whitespace before it on the line) or is
 * near the start of the text. A cross-reference is preceded by signal words
 * like "pursuant to", "defined in", etc.
 */
function isHeading(text, matchIndex) {
  // Lookback window
  const lookbackSize = 80;
  const lookback = text.substring(Math.max(0, matchIndex - lookbackSize), matchIndex);

  // Find the last newline before the match
  const lastNL = lookback.lastIndexOf('\n');

  if (lastNL !== -1) {
    // Text between last newline and match position
    const gap = lookback.substring(lastNL + 1);
    // Only whitespace between newline and "Section" => heading
    if (gap.trim().length === 0) return true;
    // Very short non-whitespace (e.g. indentation marker) => heading
    if (gap.trim().length <= 5) return true;
  } else if (matchIndex <= lookbackSize) {
    // Near start of text => heading
    return true;
  }

  // Check for cross-reference signal words immediately before
  const immediateBefore = text.substring(Math.max(0, matchIndex - 50), matchIndex);
  if (XREF_SIGNALS.test(immediateBefore)) return false;

  // More than lookbackSize chars from a newline => mid-paragraph => cross-ref
  return false;
}

// ─── Text Cleanup ───

/**
 * Apply EDGAR cleanup and handle common formatting issues.
 * Exported as a standalone helper.
 */
function cleanText(rawText) {
  if (!rawText || typeof rawText !== 'string') return '';

  let text = rawText;

  // Unicode replacement character — in EDGAR filings these are typically
  // corrupted smart quotes; restore as double quote (also handled in
  // cleanEdgarText, but we apply it first in case rawText bypassed that)
  text = text.replace(/�/g, '"');

  // Strip display markers ([[ARTICLE]], [[SECTION]], [[REF]], [[CENTER]],
  // [[TOC_*]], [[DEFINED]], etc.) that `displayCleanText` adds to the stored
  // text for rendering. When re-ingesting from `deals.metadata.full_text`
  // these markers are already present and would confuse the structural
  // regex below — which expects raw "ARTICLE I" / "Section 1.01" lines.
  // Specifically problematic: [[SECTION]]SECTION 1.01.[[/SECTION]] and
  // [[ARTICLE]]ARTICLE I[[/ARTICLE]] split the article/section tokens
  // across non-matching characters, so neither the article scanner nor the
  // section scanner picks them up. Strip them ALL before going further.
  text = stripDisplayMarkers(text);

  // Apply core EDGAR cleanup (SGML tags, entities, page numbers, etc.)
  text = cleanEdgarText(text);

  // Remove repeated headers (running headers/footers from PDF pages)
  text = removeRepeatedHeaders(text);

  return text;
}

/**
 * Strip [[ARTICLE]] / [[SECTION]] / [[REF]] / [[CENTER]] / [[TOC_*]] /
 * [[DEFINED]] etc. wrappers added by `displayCleanText`. Preserves the inner
 * text so the structural parser sees raw "ARTICLE I" / "SECTION 1.01" lines.
 *
 * Also drops the whole [[TOC_START]] ... [[/TOC_START]] block since the TOC
 * is already detected separately by parseStructure's bodyStart logic and the
 * stored TOC entries (e.g. "SECTION 1.01|The Merger|") would otherwise be
 * picked up as if they were body sections.
 */
function stripDisplayMarkers(text) {
  if (!text) return text;

  // Drop the TOC region in all its forms:
  //   (a) [[TOC_START]]...[[/TOC_START]] block (back-of-doc defined-terms
  //       index).
  //   (b) [[TOC_ARTICLE]]...[[/TOC_ARTICLE]] / [[TOC_ENTRY]]...[[/TOC_ENTRY]]
  //       wrappers (used by some formatters).
  //   (c) Pipe-delimited TOC section lines: "SECTION X.YZ|Title|" — newer
  //       formatters write the front-of-document TOC this way WITHOUT any
  //       [[TOC_*]] wrappers, so they're indistinguishable from body section
  //       lines unless we look for the pipes. Body sections are wrapped in
  //       [[SECTION]]SECTION X.YZ.[[/SECTION]] [[SECTION_TITLE]]Title[[/SECTION_TITLE]]
  //       which the pair-unwrap below converts to "SECTION X.YZ. Title".
  //       If we don't drop the pipe form first, the structural parser treats
  //       the TOC entries as body sections, pushing bodyStart deep into the
  //       document and killing classification.
  text = text.replace(/\[\[TOC_START\]\][\s\S]*?\[\[\/TOC_START\]\]/g, '');
  text = text.replace(/\[\[TOC_ARTICLE\]\][\s\S]*?\[\[\/TOC_ARTICLE\]\]/g, '');
  text = text.replace(/\[\[TOC_ENTRY\]\][\s\S]*?\[\[\/TOC_ENTRY\]\]/g, '');
  // Pipe-delimited TOC section entries — drop the whole line.
  text = text.replace(/^[ \t]*SECTION\s+\d+\.\d+\s*\|[^\n]*\|\s*$/gm, '');
  // Drop standalone TOC_* tags if any escaped the block-strip above.
  text = text.replace(/\[\[\/?TOC_[A-Z_]+\]\]/g, '');
  // Unwrap all [[FOO]]...[[/FOO]] pairs — keep the inner text.
  // Examples:
  //   [[ARTICLE]]ARTICLE I[[/ARTICLE]] -> ARTICLE I
  //   [[SECTION]]SECTION 1.01.[[/SECTION]] -> SECTION 1.01.
  //   [[REF]]Section 5.02[[/REF]] -> Section 5.02
  text = text.replace(/\[\[([A-Z_]+)\]\]([\s\S]*?)\[\[\/\1\]\]/g, '$2');
  // Strip any orphan open/close tags the pair-strip missed.
  text = text.replace(/\[\[\/?[A-Z_]+\]\]/g, '');
  // Collapse the extra whitespace these wrappers left behind.
  text = text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n');
  return text;
}

/**
 * Detect and strip an "Index of Defined Terms" region from the text.
 *
 * The index is a back-of-document (or pre-body) alphabetical list of every
 * defined term followed by its section reference. Layout looks like:
 *
 *   INDEX OF DEFINED TERMS
 *   Defined Term
 *   Location of
 *   Definition
 *   Acceptable Confidentiality Agreement
 *   5.02(h)
 *   Adverse Recommendation Change
 *   5.02(e)
 *   ...
 *
 * Detection works in two passes:
 *   1. Explicit header: "INDEX OF DEFINED TERMS" / "DEFINED TERMS" as a
 *      standalone line.
 *   2. Implicit: a run of 5+ consecutive { term-line, section-ref-line }
 *      pairs where the ref looks like "X.XX", "X.XX(a)", "Section X.XX",
 *      "Article X", "Preamble", or "Recitals".
 *
 * Returns the text with the detected region removed.
 */
function stripDefinedTermsIndex(text) {
  if (!text) return text;

  // Pattern: a section-reference line that follows a defined-term line.
  // Acceptable refs: 1.02, 9.03, 2.01(d), 3.11(i)(i), Preamble, Recitals,
  // Section X.XX, Article X, sometimes with sub-clause letters.
  const refLineRe = /^(?:(?:Section\s+|Article\s+)?\d{1,2}\.\d{1,2}(?:\([a-z0-9]+\))*|Preamble|Recitals|Article\s+(?:[IVXLCDM]+|\d+))$/i;

  // Pattern: a defined-term line — Title Case / mixed case, not a heading.
  const isTermLine = (line) => {
    const t = line.trim();
    if (t.length < 2 || t.length > 80) return false;
    if (/^(SECTION|ARTICLE|TABLE OF CONTENTS|INDEX OF DEFINED TERMS|DEFINED TERMS|Defined Term|Location of|Definition|Exhibit|Page|Exhibits)\b/i.test(t)) return false;
    if (/^-+[ivxlcdm]+-+$/i.test(t)) return false; // roman page nums
    if (/^\d+$/.test(t)) return false; // bare page number
    if (refLineRe.test(t)) return false;
    // Must contain letters and start with a letter (defined terms generally do)
    if (!/^[A-Za-z]/.test(t)) return false;
    return true;
  };

  const lines = text.split('\n');

  // Step 1: Look for explicit "INDEX OF DEFINED TERMS" header.
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*(?:INDEX\s+OF\s+DEFINED\s+TERMS|DEFINED\s+TERMS)\s*$/i.test(lines[i])) {
      headerIdx = i;
      break;
    }
  }

  // Step 2: Also scan for runs of 5+ { term, ref } pairs (with optional blank
  // lines between them). This catches indexes that lack the explicit header.
  let runStart = -1;
  let runEnd = -1;
  for (let i = 0; i < lines.length - 1; i++) {
    // Try to detect a run starting at i
    let j = i;
    let pairs = 0;
    let lastWithContent = i;
    while (j < lines.length) {
      // Skip blank lines
      while (j < lines.length && lines[j].trim() === '') j++;
      if (j >= lines.length) break;
      if (!isTermLine(lines[j])) break;
      const termAt = j;
      let k = j + 1;
      // Skip blank lines between term and ref
      while (k < lines.length && lines[k].trim() === '') k++;
      if (k >= lines.length) break;
      if (!refLineRe.test(lines[k].trim())) break;
      pairs++;
      lastWithContent = k;
      j = k + 1;
    }
    if (pairs >= 5) {
      runStart = i;
      runEnd = lastWithContent;
      break;
    }
  }

  // Determine cut range
  let cutStart = -1;
  let cutEnd = -1;

  if (headerIdx >= 0) {
    cutStart = headerIdx;
    // Find where the index ends — extend past pair-runs and intervening
    // page/header noise until we hit a "real" body line (uppercase ARTICLE
    // heading, a paragraph of prose, "This AGREEMENT", "IN WITNESS WHEREOF",
    // etc.). Note: "Article III" in title case is a LOCATION ref inside the
    // index, not a real article heading — those use UPPERCASE "ARTICLE III".
    let i = headerIdx + 1;
    let lastIdx = headerIdx;
    while (i < lines.length) {
      const trimmed = lines[i].trim();
      if (!trimmed) { i++; continue; }
      // Stop at the start of a substantive body block. Use case-sensitive
      // checks so title-case "Article III" (an index location ref) doesn't
      // prematurely end the cut region.
      if (/^ARTICLE\s+(?:[IVXLCDM]+|\d+)\b/.test(trimmed)) break;
      if (/^This\s+AGREEMENT/.test(trimmed)) break;
      if (/^IN\s+WITNESS\s+WHEREOF/.test(trimmed)) break;
      if (/^WHEREAS\b/.test(trimmed)) break;
      if (/^SECTION\s+\d+\.\d{1,2}\.\s+\S+/.test(trimmed) && trimmed.length > 40) break;
      // Page markers / Defined Term / Location of / Definition / refs / terms
      // continue to count as part of the index region
      lastIdx = i;
      i++;
    }
    cutEnd = lastIdx;
  } else if (runStart >= 0) {
    cutStart = runStart;
    cutEnd = runEnd;
    // Walk forward to swallow trailing "Defined Term / Location of / Definition"
    // header repetitions and page markers
    let i = cutEnd + 1;
    while (i < lines.length) {
      const trimmed = lines[i].trim();
      if (!trimmed) { i++; continue; }
      if (/^(Defined Term|Location of|Definition)$/i.test(trimmed)) { cutEnd = i; i++; continue; }
      if (/^-+[ivxlcdm]+-+$/i.test(trimmed)) { cutEnd = i; i++; continue; }
      if (/^\d{1,3}$/.test(trimmed)) { cutEnd = i; i++; continue; }
      // Another { term, ref } pair sneaking through
      if (isTermLine(trimmed)) {
        let k = i + 1;
        while (k < lines.length && lines[k].trim() === '') k++;
        if (k < lines.length && refLineRe.test(lines[k].trim())) {
          cutEnd = k;
          i = k + 1;
          continue;
        }
      }
      break;
    }
  }

  if (cutStart < 0) return text;

  // Remove the cut range
  const kept = lines.slice(0, cutStart).concat(lines.slice(cutEnd + 1));
  return kept.join('\n');
}

/**
 * Aggressive cleanup for human-readable display (Full Document view).
 * Removes EDGAR exhibit headers, isolated page numbers, runs of blank
 * lines, and rejoins lines broken mid-sentence by HTML-to-text conversion.
 *
 * Use this version when storing the agreement text for UI display,
 * not the parser-facing cleanText (which preserves structural cues).
 *
 * Also inserts bracket-style formatting markers so the renderer can build
 * a properly-formatted legal document. Markers used (all opaque to plain
 * text search after stripping):
 *   [[ARTICLE]] ARTICLE VII [[/ARTICLE]]
 *   [[ARTICLE_TITLE]] Conditions Precedent [[/ARTICLE_TITLE]]
 *   [[SECTION]] SECTION 7.01. [[/SECTION]] [[SECTION_TITLE]] Title. [[/SECTION_TITLE]]
 *   [[REF]] Section 7.01(a) [[/REF]]
 *   [[TOC_START]] ... [[TOC_ENTRY]]...[[/TOC_ENTRY]] ... [[/TOC_START]]
 *   [[DEFINED]] "Merger Consideration" [[/DEFINED]]
 *   [[CENTER]] AGREEMENT AND PLAN OF MERGER [[/CENTER]]
 */
function displayCleanText(rawText) {
  if (!rawText || typeof rawText !== 'string') return '';

  let text = cleanText(rawText);

  // Strip the auto-generated "Index of Defined Terms" region before any
  // further cleanup (the line-rejoining pass below would otherwise glue
  // the index entries into one long paragraph that is hard to detect).
  text = stripDefinedTermsIndex(text);

  // Remove EDGAR exhibit-style headers anywhere they appear as standalone lines
  // (EX-2.1, EX-10.1, Exhibit 2.1, EXECUTION VERSION, etc.)
  text = text.replace(/^\s*(?:EX-[\d.]+|Exhibit\s+[\d.]+|EXECUTION\s+VERSION|EXECUTION\s+COPY)\s*$/gm, '');

  // Remove filename-style lines that leak through from HTML conversion
  // (e.g. "d921605dex21.htm")
  text = text.replace(/^\s*[a-z0-9_]+\.htm\s*$/gm, '');

  // Remove single-character or 1-2 digit standalone lines (likely page nums or
  // sequence markers leftover from HTML). Also drop "-ii-" style roman page
  // numbers and bare "Page" labels.
  text = text.replace(/^\s*\d{1,3}\s*$/gm, '');
  text = text.replace(/^\s*-\s*[ivxlcdmIVXLCDM]+\s*-\s*$/gm, '');
  text = text.replace(/^\s*Page\s*$/gm, '');

  // Rejoin lines broken mid-sentence: if a line ends without terminal
  // punctuation AND the next line starts with a lowercase letter or
  // a continuation word, merge them with a space.
  const lines = text.split('\n');
  const merged = [];
  for (let i = 0; i < lines.length; i++) {
    const curr = lines[i];
    const trimmed = curr.trim();
    if (!trimmed) {
      merged.push(curr);
      continue;
    }
    if (merged.length === 0) {
      merged.push(curr);
      continue;
    }
    const prev = merged[merged.length - 1];
    const prevTrim = prev.trimEnd();
    // Don't merge if prev is a heading, section marker, or ends with punctuation
    if (prevTrim.length < 40) { merged.push(curr); continue; }
    if (/[.;:!?][”"\)\]]*\s*$/.test(prevTrim)) { merged.push(curr); continue; }
    if (/^(SECTION|Section|ARTICLE|Article|\([a-z]\)|\(\d+\)|\([ivxlc]+\))\s/i.test(trimmed)) {
      merged.push(curr);
      continue;
    }
    // Only merge if current line starts lowercase or is a continuation word
    if (/^[a-z]/.test(trimmed) || /^(?:and|or|but|the|a|an|of|in|to|for|with|by|from|on|at|as)\b/i.test(trimmed)) {
      merged[merged.length - 1] = prevTrim + ' ' + trimmed;
    } else {
      merged.push(curr);
    }
  }
  text = merged.join('\n');

  // Collapse runs of 3+ blank lines to single blank line
  text = text.replace(/\n\s*\n\s*\n+/g, '\n\n');
  // Trim trailing whitespace from each line
  text = text.replace(/[ \t]+$/gm, '');

  text = text.trim();

  // ── Inject formatting markers ──
  text = applyFormattingMarkers(text);

  return text;
}

// ─── Formatting Marker Injection ───

/**
 * Wrap structural features of the cleaned text with bracket markers that the
 * UI renders as styled regions. Markers are opaque text strings — the
 * renderer strips them out before display, so search and selection still
 * see the underlying plain text.
 */
function applyFormattingMarkers(text) {
  if (!text) return text;

  // 1. Mark the TOC region (TABLE OF CONTENTS up to the first body article)
  text = markTableOfContents(text);

  // 2. Mark ARTICLE headings + their title line
  text = markArticleHeadings(text);

  // 3. Mark SECTION headings + their title (within paragraph starts)
  text = markSectionHeadings(text);

  // 4. Mark cross-references (Section X.XX, Article X) in body prose.
  //    Must run AFTER section/article heading markers so already-wrapped
  //    headings aren't re-wrapped as refs.
  text = markCrossReferences(text);

  // 5. Mark defined terms — quoted capitalized phrases like "Merger Consideration"
  text = markDefinedTerms(text);

  // 6. Mark short ALL-CAPS standalone lines as centered headings (cover page
  //    titles like "AGREEMENT AND PLAN OF MERGER", "INDEX OF DEFINED TERMS")
  text = markCenteredHeadings(text);

  return text;
}

/**
 * Wrap the TOC region. The TOC starts at "TABLE OF CONTENTS" and ends just
 * before the first real body ARTICLE heading (where the body actually begins).
 */
function markTableOfContents(text) {
  const tocStart = text.search(/TABLE\s+OF\s+CONTENTS/i);
  if (tocStart < 0) return text;

  // Find body start using the same logic as the parser
  const bodyStart = findBodyStart(text);
  if (bodyStart <= tocStart) return text;

  const before = text.substring(0, tocStart);
  const tocRaw = text.substring(tocStart, bodyStart);
  const after = text.substring(bodyStart);

  // Split TOC into lines and group SECTION number lines with their following
  // title + page lines into single TOC_ENTRY blocks.
  const tocLines = tocRaw.split('\n');
  const formatted = [];
  let inHeader = true;

  for (let i = 0; i < tocLines.length; i++) {
    const line = tocLines[i].trim();
    if (!line) {
      formatted.push('');
      continue;
    }

    // Keep the "TABLE OF CONTENTS" header and "Page" label as-is (the
    // CENTER pass below will style "TABLE OF CONTENTS"). The "Page" label
    // was already stripped above as a side effect, but guard anyway.
    if (/^TABLE\s+OF\s+CONTENTS$/i.test(line)) {
      formatted.push(line);
      continue;
    }

    // ARTICLE in TOC — make it a TOC article heading
    if (/^ARTICLE\s+(?:[IVXLCDM]+|\d+)\b/i.test(line)) {
      // The next non-empty line is the article title (e.g. "The Merger")
      const titleLine = findNextNonEmpty(tocLines, i + 1);
      if (titleLine && !/^SECTION\s/i.test(titleLine.text)) {
        formatted.push(`[[TOC_ARTICLE]]${line} -- ${titleLine.text}[[/TOC_ARTICLE]]`);
        i = titleLine.idx; // skip past the consumed title line
      } else {
        formatted.push(`[[TOC_ARTICLE]]${line}[[/TOC_ARTICLE]]`);
      }
      continue;
    }

    // SECTION X.XX in TOC — collect title + page number from following lines
    const secMatch = line.match(/^(SECTION\s+\d+\.\d{1,2})\.?\s*(.*)$/i);
    if (secMatch) {
      let sectionNum = secMatch[1];
      let titleParts = [];
      let page = '';
      // Same-line content
      if (secMatch[2]) titleParts.push(secMatch[2]);

      // Walk following lines until we hit a page number or next SECTION/ARTICLE
      let j = i + 1;
      while (j < tocLines.length) {
        const next = tocLines[j].trim();
        if (!next) { j++; continue; }
        if (/^SECTION\s+\d+\.\d/i.test(next) || /^ARTICLE\s+/i.test(next)) break;
        // Bare page number → stop and consume it
        if (/^\d{1,3}$/.test(next)) {
          page = next;
          j++;
          break;
        }
        // Page in form "...123" or " 123" at end of line
        const inlinePage = next.match(/^(.*?)\s*\.{2,}\s*(\d{1,3})\s*$/);
        if (inlinePage) {
          titleParts.push(inlinePage[1].trim());
          page = inlinePage[2];
          j++;
          break;
        }
        const trailPage = next.match(/^(.+?)\s+(\d{1,3})\s*$/);
        if (trailPage && trailPage[1].length > 5) {
          titleParts.push(trailPage[1].trim());
          page = trailPage[2];
          j++;
          break;
        }
        titleParts.push(next);
        j++;
      }

      const title = titleParts.join(' ').replace(/\s+/g, ' ').trim();
      const pageStr = page ? page : '';
      formatted.push(`[[TOC_ENTRY]]${sectionNum}|${title}|${pageStr}[[/TOC_ENTRY]]`);
      i = j - 1;
      continue;
    }

    // Other lines (e.g. "Exhibits:", "Exhibit A", definition term entries)
    // stay as-is; they'll be rendered as plain TOC text.
    formatted.push(line);
  }

  // Wrap whole TOC region
  const tocBlock = `[[TOC_START]]\n${formatted.join('\n')}\n[[/TOC_START]]`;
  return before + tocBlock + '\n' + after;
}

function findNextNonEmpty(lines, fromIdx) {
  for (let i = fromIdx; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t) return { text: t, idx: i };
  }
  return null;
}

/**
 * Find ARTICLE X heading + its title line and wrap them. Only applies
 * outside the TOC (we run this after markTableOfContents so the TOC region
 * is already bracketed and skipped).
 */
function markArticleHeadings(text) {
  // Process line-by-line so we can detect the article-title-on-next-line case
  const lines = text.split('\n');
  const out = [];
  let inToc = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('[[TOC_START]]')) inToc = true;
    if (line.includes('[[/TOC_START]]')) { inToc = false; out.push(line); continue; }
    if (inToc) { out.push(line); continue; }

    const trimmed = line.trim();
    const m = trimmed.match(/^(ARTICLE\s+(?:[IVXLCDM]+|\d+))(?:\s+(.*))?$/i);
    if (m) {
      const articleHead = m[1];
      const sameLineTitle = (m[2] || '').trim();
      // Ensure a blank line separates the article heading from any preceding
      // paragraph — otherwise the renderer can't detect it as a block boundary.
      if (out.length > 0 && out[out.length - 1].trim() !== '') {
        out.push('');
      }
      if (sameLineTitle && !/^(?:shall|of|or|and|hereof|hereto|will|may|is|are|the\s+[a-z])/i.test(sameLineTitle)) {
        out.push(`[[ARTICLE]]${articleHead}[[/ARTICLE]]`);
        out.push(`[[ARTICLE_TITLE]]${sameLineTitle.replace(/^[\s.\-—:]+/, '').trim()}[[/ARTICLE_TITLE]]`);
        continue;
      } else if (!sameLineTitle) {
        // Title on next non-empty line
        out.push(`[[ARTICLE]]${articleHead}[[/ARTICLE]]`);
        // peek ahead
        let j = i + 1;
        while (j < lines.length && lines[j].trim() === '') { out.push(lines[j]); j++; }
        if (j < lines.length) {
          const titleLine = lines[j].trim();
          // Don't grab next SECTION as title
          if (titleLine && !/^SECTION\s/i.test(titleLine) && !/^ARTICLE\s/i.test(titleLine)) {
            out.push(`[[ARTICLE_TITLE]]${titleLine}[[/ARTICLE_TITLE]]`);
            i = j;
            continue;
          }
        }
        continue;
      }
    }

    out.push(line);
  }

  return out.join('\n');
}

/**
 * Mark SECTION X.XX. Title. paragraphs.
 *   "SECTION 1.01. The Merger. On the terms..." →
 *   "[[SECTION]]SECTION 1.01.[[/SECTION]] [[SECTION_TITLE]]The Merger.[[/SECTION_TITLE]] On the terms..."
 *
 * The pattern matches at the start of a line only (so cross-references mid-
 * paragraph are not affected).
 */
function markSectionHeadings(text) {
  // Process line by line to limit to line starts, and skip TOC region
  const lines = text.split('\n');
  const out = [];
  let inToc = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('[[TOC_START]]')) { inToc = true; out.push(line); continue; }
    if (line.includes('[[/TOC_START]]')) { inToc = false; out.push(line); continue; }
    if (inToc) { out.push(line); continue; }

    // Match: "SECTION 1.01. Title. body..."
    // Title runs from after the number+period up to the next ". " followed by
    // a capital letter or paren.
    const m = line.match(/^(\s*)(SECTION\s+\d+\.\d{1,2})\.\s+(.*)$/);
    if (m) {
      // Ensure a blank line separates the section heading from any preceding
      // paragraph so the renderer treats it as its own block.
      if (out.length > 0 && out[out.length - 1].trim() !== '') {
        out.push('');
      }
      const lead = m[1];
      const sectionNum = m[2] + '.';
      const rest = m[3];

      // Find title boundary: first ". X" where X is letter or paren — that's
      // where body prose starts.
      let endIdx = -1;
      for (let k = 0; k < rest.length - 2; k++) {
        if (rest[k] === '.' && /\s/.test(rest[k + 1])) {
          const after = rest.substring(k + 1).replace(/^\s+/, '');
          if (!after) continue;
          if (/[A-Za-z(]/.test(after[0])) {
            endIdx = k;
            break;
          }
        }
      }

      if (endIdx > 0 && endIdx < 200) {
        const title = rest.substring(0, endIdx + 1).trim(); // include trailing period
        const body = rest.substring(endIdx + 1).replace(/^\s+/, '');
        const titleNoPeriod = title.replace(/\.+$/, '');
        out.push(`${lead}[[SECTION]]${sectionNum}[[/SECTION]] [[SECTION_TITLE]]${titleNoPeriod}[[/SECTION_TITLE]]. ${body}`);
        continue;
      }

      // Couldn't find title boundary; still mark the number
      out.push(`${lead}[[SECTION]]${sectionNum}[[/SECTION]] ${rest}`);
      continue;
    }

    out.push(line);
  }

  return out.join('\n');
}

/**
 * Wrap inline cross-references — "Section 1.01", "Section 1.01(a)",
 * "Article VII", "Sections 2.01 and 2.02" — in body prose. Skips matches
 * inside [[SECTION]]…[[/SECTION]] or [[ARTICLE]]…[[/ARTICLE]] markers and
 * skips matches inside the TOC region.
 */
function markCrossReferences(text) {
  // Process line by line, skipping TOC region
  const lines = text.split('\n');
  const out = [];
  let inToc = false;

  for (const line of lines) {
    if (line.includes('[[TOC_START]]')) { inToc = true; out.push(line); continue; }
    if (line.includes('[[/TOC_START]]')) { inToc = false; out.push(line); continue; }
    if (inToc) { out.push(line); continue; }

    let processed = line;

    // Section refs — "Section X.XX" optionally with (a), (b)(i) suffix.
    // Avoid matching inside existing [[SECTION]] markers.
    processed = processed.replace(
      /(?<!\[\[SECTION\]\])\b(Sections?\s+\d+\.\d{1,2}(?:\([a-z]+\))?(?:\([ivxlc]+\))?(?:\([A-Z]\))?)/g,
      (match, p1, offset, full) => {
        // Skip if inside any marker
        const before = full.substring(0, offset);
        const openCount = (before.match(/\[\[(?:SECTION|ARTICLE|TOC_ENTRY|TOC_ARTICLE|REF|SECTION_TITLE|ARTICLE_TITLE|DEFINED|CENTER)\]\]/g) || []).length;
        const closeCount = (before.match(/\[\[\/(?:SECTION|ARTICLE|TOC_ENTRY|TOC_ARTICLE|REF|SECTION_TITLE|ARTICLE_TITLE|DEFINED|CENTER)\]\]/g) || []).length;
        if (openCount > closeCount) return match; // inside a marker
        return `[[REF]]${p1}[[/REF]]`;
      }
    );

    // Article refs — "Article VII" / "Article 7"
    processed = processed.replace(
      /\b(Articles?\s+(?:[IVXLCDM]+|\d+))\b/g,
      (match, p1, offset, full) => {
        const before = full.substring(0, offset);
        const openCount = (before.match(/\[\[(?:SECTION|ARTICLE|TOC_ENTRY|TOC_ARTICLE|REF|SECTION_TITLE|ARTICLE_TITLE|DEFINED|CENTER)\]\]/g) || []).length;
        const closeCount = (before.match(/\[\[\/(?:SECTION|ARTICLE|TOC_ENTRY|TOC_ARTICLE|REF|SECTION_TITLE|ARTICLE_TITLE|DEFINED|CENTER)\]\]/g) || []).length;
        if (openCount > closeCount) return match;
        return `[[REF]]${p1}[[/REF]]`;
      }
    );

    out.push(processed);
  }

  return out.join('\n');
}

/**
 * Wrap quoted defined terms — "Merger Consideration", "Closing", etc. Only
 * wraps terms that look like defined terms (capitalized words) and avoids
 * generic phrases. Skips inside existing markers and TOC.
 */
function markDefinedTerms(text) {
  // Match double-quoted phrases (curly or straight quotes) where the content
  // looks like a defined term: starts with capital letter, length 2-60.
  // Curly quotes: “ ”
  return text.replace(
    /([“"])([A-Z][A-Za-z0-9 .\-/&]{1,60}?)([”"])/g,
    (match, openQ, content, closeQ, offset, full) => {
      // Skip if inside an existing marker
      const before = full.substring(0, offset);
      const openCount = (before.match(/\[\[(?:SECTION|ARTICLE|TOC_ENTRY|TOC_ARTICLE|REF|SECTION_TITLE|ARTICLE_TITLE|DEFINED|CENTER)\]\]/g) || []).length;
      const closeCount = (before.match(/\[\[\/(?:SECTION|ARTICLE|TOC_ENTRY|TOC_ARTICLE|REF|SECTION_TITLE|ARTICLE_TITLE|DEFINED|CENTER)\]\]/g) || []).length;
      if (openCount > closeCount) return match;

      // Reject if it looks like a regular quotation (has lowercase sentence-y feel
      // mid-content like "with the Company's prior")
      // Heuristic: defined terms are mostly Title Case
      const words = content.trim().split(/\s+/);
      const titleCaseCount = words.filter(w => /^[A-Z]/.test(w) || /^(of|the|and|or|to|in|on|at|for|with|by|a|an)$/i.test(w)).length;
      if (titleCaseCount < words.length * 0.6) return match;

      return `[[DEFINED]]${openQ}${content}${closeQ}[[/DEFINED]]`;
    }
  );
}

/**
 * Mark short standalone ALL-CAPS lines as centered headings. Used for
 * cover-page titles ("AGREEMENT AND PLAN OF MERGER"), "TABLE OF CONTENTS",
 * "INDEX OF DEFINED TERMS", etc.
 */
function markCenteredHeadings(text) {
  const lines = text.split('\n');
  const out = [];
  let inToc = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('[[TOC_START]]')) { inToc = true; out.push(line); continue; }
    if (line.includes('[[/TOC_START]]')) { inToc = false; out.push(line); continue; }

    const trimmed = line.trim();
    // Already-marked lines stay as-is
    if (/\[\[(?:ARTICLE|SECTION|CENTER|TOC_)/.test(trimmed)) {
      out.push(line);
      continue;
    }

    // Heuristic: 3-80 chars, all uppercase letters / spaces / common punct,
    // contains at least one letter, not a single word ≤ 2 chars (so we skip
    // accidental "OK" / page labels).
    if (
      trimmed.length >= 8 &&
      trimmed.length <= 80 &&
      /^[A-Z0-9 .,&'\-]+$/.test(trimmed) &&
      /[A-Z]/.test(trimmed) &&
      trimmed.split(/\s+/).length >= 2 &&
      !/^\d/.test(trimmed)
    ) {
      // Check that the line is "standalone" — surrounded by blank lines or
      // edges so it's clearly a heading, not body text in shouty case.
      const prevBlank = i === 0 || lines[i - 1].trim() === '' || /\[\[\/(?:TOC_START|CENTER|ARTICLE_TITLE)/.test(lines[i - 1]);
      const nextBlank = i === lines.length - 1 || lines[i + 1].trim() === '' || /^[A-Za-z]/.test(lines[i + 1].trim()) === false;
      if (prevBlank && (nextBlank || inToc)) {
        out.push(`[[CENTER]]${trimmed}[[/CENTER]]`);
        continue;
      }
    }

    out.push(line);
  }

  return out.join('\n');
}

// ─── Body Boundary Detection ───

/**
 * Find where the agreement body starts — skip past TABLE OF CONTENTS.
 *
 * TOC entries are stubs: just a section number on a line (possibly with
 * leader dots and a page number). Real body sections have substantive text
 * on the same line as the heading (title + body > 30 chars after number).
 *
 * Improved over segment.js: also handles "TABLE OF CONTENTS" followed by
 * "ARTICLE" stubs in the TOC, and double-checks by looking for the first
 * line where text after the section number exceeds a threshold.
 */
function findBodyStart(fullText) {
  const tocMatch = fullText.match(/TABLE\s+OF\s+CONTENTS/i);

  if (tocMatch) {
    const afterToc = fullText.substring(tocMatch.index);

    // Scan for SECTION headings after the TOC marker
    const secPattern = /(?:SECTION|Section)\s+\d+\.\d{1,2}\b/g;
    let sm;
    while ((sm = secPattern.exec(afterToc)) !== null) {
      // Grab the rest of the line
      const restOfLine = afterToc.substring(sm.index).match(/[^\n]+/);
      if (!restOfLine) continue;

      // Strip the "SECTION X.XX" prefix and optional period/whitespace
      const afterNum = restOfLine[0]
        .replace(/^(?:SECTION|Section)\s+\d+\.\d{1,2}\b\s*\.?\s*/, '');

      // Strip leader dots and trailing page number (TOC artifact)
      const withoutLeader = afterNum.replace(/\.{3,}\s*\d{1,4}\s*$/, '').trim();

      // Real section: substantial text remaining after stripping the number.
      // BUT a stray cross-reference inside the recitals (e.g. "Section 3.1(b)
      // and any Dissenting Shares...") can also satisfy this test. To avoid
      // returning a TOC ARTICLE as the body start, walk back for the NEAREST
      // ARTICLE heading that is itself followed by body-prose. A TOC article
      // is followed by stub lines (just titles + blank lines + page numbers),
      // whereas a body article has a real first section with substantive
      // inline content.
      if (withoutLeader.length > 30) {
        // Walk backwards to find the preceding ARTICLE heading
        const before = afterToc.substring(0, sm.index);
        const artPattern = /\n\s*ARTICLE\s+(?:[IVXLCDM]+|\d+)\b/gi;
        let lastArtIdx = -1;
        let am;
        while ((am = artPattern.exec(before)) !== null) lastArtIdx = am.index;

        // Reject the walk-back if this ARTICLE is itself inside the TOC.
        // Heuristic: if the FIRST Section X.XX after this ARTICLE has no
        // substantive content on its same line (TOC stub layout), bail and
        // try to find a real body ARTICLE further along.
        if (lastArtIdx >= 0) {
          const candidate = afterToc.substring(lastArtIdx);
          const firstSec = candidate.match(/(?:SECTION|Section)\s+\d+\.\d{1,2}\b[^\n]*/);
          if (firstSec) {
            const firstSecRest = firstSec[0]
              .replace(/^(?:SECTION|Section)\s+\d+\.\d{1,2}\b\s*\.?\s*/, '')
              .replace(/\.{3,}\s*\d{1,4}\s*$/, '')
              .trim();
            if (firstSecRest.length > 30) {
              return tocMatch.index + lastArtIdx + 1;
            }
          }
          // TOC stub — keep scanning past this ARTICLE and look for the
          // first body ARTICLE later (one whose first section has inline
          // content on the same line). Any same-line content (even a short
          // title like "The Offer.") distinguishes a body section from a
          // TOC stub, where the title sits on the next non-empty line.
          const restAfter = afterToc.substring(lastArtIdx + 1);
          const bodyArtRe = /\n\s*(ARTICLE\s+(?:[IVXLCDM]+|\d+))\b/gi;
          let bm;
          while ((bm = bodyArtRe.exec(restAfter)) !== null) {
            const tail = restAfter.substring(bm.index);
            const firstSec2 = tail.match(/(?:SECTION|Section)\s+\d+\.\d{1,2}\b[^\n]*/);
            if (!firstSec2) continue;
            const rest2 = firstSec2[0]
              .replace(/^(?:SECTION|Section)\s+\d+\.\d{1,2}\b\s*\.?\s*/, '')
              .replace(/\.{3,}\s*\d{1,4}\s*$/, '')
              .trim();
            if (rest2.length > 3) {
              return tocMatch.index + lastArtIdx + 1 + bm.index + 1;
            }
          }
          return tocMatch.index + lastArtIdx + 1;
        }
        return tocMatch.index + sm.index;
      }
    }
  }

  // No TOC or couldn't determine body start from TOC — pick the EARLIEST of:
  //   (a) first ARTICLE heading on its own line (Title Case OR ALL CAPS)
  //   (b) first SECTION 1.X heading on its own line
  // and return whichever comes first.
  //
  // Why both: some EDGAR exhibits drop "ARTICLE I" entirely (we still need
  // body to start at section 1.01), and the original case-insensitive ARTICLE
  // regex misdetected cross-references like "Article VII," inside section
  // 1.02's body text.
  //
  // Discriminator that defeats the cross-reference false-positive:
  //   - PRECEDED by a blank line (`\n\n`), not just a single line break
  //     (a single break is typical of PDF-wrapped prose like "...provisions
  //     of\nArticle VII,"; real headings have a blank line before them).
  //   - FOLLOWED by EOL / dash — not a comma or continued prose.
  //   - Case-insensitive: Title Case "Article" headings are legitimate.
  let candidate = -1;

  const firstArt = fullText.match(/\n\n[ \t]*Article\s+(?:[IVXLCDM]+|\d+)\b(?=\s*(?:\n|--|—))/i);
  if (firstArt) candidate = firstArt.index + 2; // skip the leading \n\n

  const firstSec101 = fullText.match(/\n\s*(?:SECTION|Section)\s+1\.0?1\b/);
  if (firstSec101 && (candidate < 0 || firstSec101.index + 1 < candidate)) {
    candidate = firstSec101.index + 1;
  }

  if (candidate >= 0) return candidate;
  return 0;
}

/**
 * Find where the agreement body ends — truncate at signature blocks or an
 * "Index of Defined Terms" appendix.
 * Returns the character index where the body ends.
 */
function findBodyEnd(fullText, bodyStart) {
  const afterBody = fullText.substring(bodyStart);

  // Signature page patterns + back-of-document defined-terms index
  const sigPatterns = [
    /\n\s*IN WITNESS WHEREOF/i,
    /\n\s*\[Signature\s+Page/i,
    /\n\s*\[Remainder\s+of\s+(this\s+)?page\s+intentionally\s+left\s+blank\]/i,
    /\n\s*INDEX\s+OF\s+DEFINED\s+TERMS\s*\n/i,
  ];

  let earliest = afterBody.length;
  for (const pat of sigPatterns) {
    const m = afterBody.match(pat);
    if (m && m.index < earliest) {
      earliest = m.index;
    }
  }

  return bodyStart + earliest;
}

// ─── Article Parsing ───

/**
 * Parse ARTICLE headings from the body text.
 *
 * Common patterns:
 *   ARTICLE VII\nCONDITIONS TO THE MERGER
 *   ARTICLE VII — CONDITIONS TO THE MERGER
 *   ARTICLE 7. CONDITIONS TO THE MERGER
 *   ARTICLE VII  CONDITIONS TO THE MERGER
 *
 * Returns array of { number, title, startChar } sorted by startChar.
 */
function parseArticles(body, bodyStart) {
  const articles = [];

  // Match ARTICLE followed by roman numeral or digit
  const artPattern = /(?:^|\n)\s*(ARTICLE\s+((?:[IVXLCDM]+|\d+)))\b([^\n]*)/gi;
  let m;

  while ((m = artPattern.exec(body)) !== null) {
    const matchStart = m.index + (m[0].startsWith('\n') ? 1 : 0);

    // Skip if this looks like a cross-reference (mid-paragraph)
    if (!isHeading(body, matchStart)) continue;

    const rawNumber = m[2].trim();
    const afterArticle = m[3];

    // Cross-reference filter: if the text immediately after the article number
    // (on the same line) is lowercase or starts with a comma/conjunction, this
    // is a cross-reference ("Article VII, the closing..." / "Article VII shall...").
    // Real ARTICLE headings either end the line, or are followed by a title
    // with whitespace/separator (em-dash, period, colon) and capitalized text.
    const trailing = afterArticle.replace(/^\s+/, '');
    if (trailing.length > 0) {
      // If it starts with comma, semicolon, "shall", "of", "or", "and" etc., it's a cross-ref
      if (/^[,;:.](?!\s*$)/.test(trailing) && !/^[.:]\s+[A-Z]/.test(trailing)) {
        // punctuation followed by something non-title-like
        if (/^,\s*[a-z]/.test(trailing) || /^,\s*the\b/i.test(trailing)) continue;
      }
      if (/^(?:shall|of|or|and|hereof|hereto|above|below|states?|provides?|sets?|together|will|may|does|do|is|are|that|which|the\s+[a-z])\b/i.test(trailing)) {
        continue;
      }
      // Lowercase letter immediately after "ARTICLE X" with just a space →
      // looks like body continuation, not a heading
      if (/^\s+[a-z]/.test(afterArticle)) continue;
    }

    let title = '';

    // Case 1: title on the same line after a separator (—, -, ., :, or just whitespace)
    const sameLine = afterArticle.replace(/^[\s.\-—:]+/, '').trim();
    if (sameLine.length > 2) {
      title = sameLine;
    } else {
      // Case 2: title on the next non-empty line(s). Skip blank lines, then take
      // the first non-empty line that doesn't itself look like a heading (SECTION,
      // ARTICLE, or a bare X.XX number). Additionally, if the next non-empty
      // line(s) look like a continuation of an ALL-CAPS heading (e.g. multi-line
      // "REPRESENTATIONS AND WARRANTIES\n\nOF PARENT AND PURCHASER"), join them.
      const afterMatch = body.substring(matchStart + m[0].length);
      const candidate = findNextHeadingLine(afterMatch);
      if (candidate) {
        title = candidate;
        // Look for a continuation line — same ALL-CAPS style, separated by a
        // blank line, starting with "OF " or "OF X" etc. Common in agreements
        // that split "REPRESENTATIONS AND WARRANTIES" / "OF PARENT AND PURCHASER".
        const cont = findContinuationLine(afterMatch, candidate);
        if (cont) {
          title = (title + ' ' + cont).replace(/\s+/g, ' ').trim();
        }
      }
    }

    // Clean up title: remove trailing periods, normalize whitespace.
    // Stop at the first period that ends a "heading sentence" (capitalized
    // continuation begins). Do NOT split on hyphens or other punctuation.
    title = title.replace(/\s+/g, ' ').trim();
    title = title.replace(/\.+$/, '').trim();

    articles.push({
      number: rawNumber.toUpperCase(),
      title,
      startChar: bodyStart + matchStart,
    });
  }

  // Sort by position
  articles.sort((a, b) => a.startChar - b.startChar);

  // Deduplicate articles with the same number. We may have captured both a
  // TOC entry and the real body entry, or a stray ARTICLE-shaped reference
  // inside an annex/exhibit. Strategy:
  //   - Group by article number.
  //   - For each group, keep the entry that anchors the longest contiguous
  //     ascending sequence of article numbers. In practice this picks the
  //     "real" body articles (I, II, III, IV, ... in order, well-spaced) and
  //     drops stray duplicates (TOC sections that match, sub-articles in
  //     annexes/exhibits with reused numbering, etc.).
  return dedupeArticles(articles);
}

/**
 * Look for an ALL-CAPS continuation line following a heading-title line. Used
 * when an article title is split across multiple lines, e.g.:
 *   REPRESENTATIONS AND WARRANTIES
 *   <blank>
 *   OF PARENT AND PURCHASER
 *
 * Returns the continuation text or '' if none found. Only triggers on titles
 * that are themselves ALL CAPS (avoids picking up the first sentence of body
 * prose as a "continuation").
 */
function findContinuationLine(afterMatch, firstTitle) {
  // Only consider ALL-CAPS first titles (multi-line headings are styled this way).
  if (!/[A-Z]/.test(firstTitle)) return '';
  if (/[a-z]/.test(firstTitle)) return '';
  const window = afterMatch.substring(0, 600);
  const lines = window.split('\n');
  // Locate the line containing firstTitle and walk forward from there
  let foundFirst = false;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!foundFirst) {
      if (t === firstTitle) foundFirst = true;
      continue;
    }
    if (!t) continue;
    // Reject obvious non-title lines
    if (/^(?:SECTION|Section)\s+\d/.test(t)) return '';
    if (/^ARTICLE\s+(?:[IVXLCDM]+|\d+)\b/i.test(t)) return '';
    if (/^\d+\.\d{1,2}\b/.test(t)) return '';
    // Must be a short ALL-CAPS-style continuation (no lowercase letters)
    if (/[a-z]/.test(t)) return '';
    if (t.length > 120) return '';
    // Heuristic: continuation usually starts with "OF" / connector
    if (!/^(?:OF\b|AND\b|TO\b|FOR\b|BY\b|WITH\b|—|-)/.test(t)) return '';
    return t;
  }
  return '';
}

/**
 * Dedupe a sorted-by-position array of articles by number. Keeps the entry
 * that best fits an ascending sequence (I, II, III, ...). When duplicates
 * exist for a number, picks the one in the "main body" run — i.e., the
 * occurrence that is part of the longest contiguous ascending sequence of
 * distinct article numbers.
 */
function dedupeArticles(articles) {
  if (articles.length <= 1) return articles;

  // Convert each article number to an integer for ordering
  const toInt = (n) => isRomanNumeral(n) ? romanToInt(n) : parseInt(n, 10);

  // Compute LIS-like: for each article occurrence, find the longest ascending
  // run of distinct numbers ending at that occurrence (only counting earlier
  // articles that have smaller numbers).
  const n = articles.length;
  const vals = articles.map(a => toInt(a.number));
  const runLen = new Array(n).fill(1);
  for (let i = 1; i < n; i++) {
    for (let j = 0; j < i; j++) {
      if (vals[j] < vals[i] && runLen[j] + 1 > runLen[i]) {
        runLen[i] = runLen[j] + 1;
      }
    }
  }

  // For each unique number, keep the occurrence with the largest runLen.
  // Tie-break: prefer the EARLIER occurrence (more likely to be the real
  // body article rather than a stray reference in an annex).
  const bestByNum = new Map();
  for (let i = 0; i < n; i++) {
    const key = String(vals[i]);
    const prev = bestByNum.get(key);
    if (!prev || runLen[i] > prev.run || (runLen[i] === prev.run && i < prev.idx)) {
      bestByNum.set(key, { idx: i, run: runLen[i] });
    }
  }

  const keepIdx = new Set(Array.from(bestByNum.values()).map(v => v.idx));
  return articles.filter((_, i) => keepIdx.has(i));
}

/**
 * Given text starting just after a heading marker, find the next non-empty
 * line that looks like a heading title. Returns the line text (trimmed), or
 * an empty string if no suitable line is found.
 *
 * Skips blank lines. Rejects lines that look like SECTION/ARTICLE headings
 * or bare X.XX section numbers. Limits search to a small window so we don't
 * accidentally pick up body text.
 */
function findNextHeadingLine(text) {
  // Look at lines within the first ~400 chars after the marker
  const window = text.substring(0, 400);
  const lines = window.split('\n');
  // First entry is the rest of the current line; only use it if non-empty
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    // Reject obvious non-titles
    if (/^(?:SECTION|Section)\s+\d+\.\d/.test(line)) return '';
    if (/^ARTICLE\s+(?:[IVXLCDM]+|\d+)\b/i.test(line)) return '';
    if (/^\d+\.\d{1,2}\b/.test(line)) return '';
    // Title-like line: reasonable length, not all body text
    if (line.length > 200) {
      // Long line — likely body text. Take only up to first period.
      const periodIdx = line.indexOf('. ');
      if (periodIdx > 5 && periodIdx < 100) {
        return line.substring(0, periodIdx).trim();
      }
      return '';
    }
    return line;
  }
  return '';
}

// ─── Section Title Extraction ───

/**
 * Extract the title for a section given its full text and the section number.
 *
 * Handles these layouts (after the section number is stripped):
 *   "SECTION 3.02. Capital Structure. (a) The authorized..."  → "Capital Structure"
 *   "SECTION 3.01.\nOrganization, Standing and Power. The Company..." → "Organization, Standing and Power"
 *   "SECTION 6.08. Rule 16b-3 Matters. The Company..." → "Rule 16b-3 Matters" (preserve hyphens)
 *   "3.02 Capital Structure. (a) ..." (bare numeric prefix)
 *
 * The title ends at the first sentence-terminating period that is followed
 * by a space and a capital letter / lowercase letter starting body prose.
 * Hyphens, dashes, colons, semicolons inside the title are preserved.
 */
function extractSectionTitle(sectionText, sectionNumber) {
  if (!sectionText) return '';

  // Strip the section number prefix from the start.
  // Handles: "SECTION X.XX." / "SECTION X.XX" / "Section X.XX." / "X.XX"
  // Followed by optional period, then possibly newlines/whitespace.
  const prefixPattern = new RegExp(
    `^(?:(?:SECTION|Section)\\s+)?${sectionNumber.replace('.', '\\.')}\\s*\\.?\\s*`
  );
  let rest = sectionText.replace(prefixPattern, '');

  // Skip leading whitespace and newlines so multi-line headings work
  rest = rest.replace(/^[\s\n]+/, '');

  if (!rest) return '';

  // Find the end of the title: first ". " followed by a letter, OR end of line
  // if the line is short. The title is typically followed by a period.
  // Look at the first ~300 chars for the title candidate.
  const window = rest.substring(0, 500);

  // Find first ". X" (period + space + word char) — this ends the title and
  // begins the body sentence.
  let endIdx = -1;
  for (let i = 0; i < window.length - 2; i++) {
    if (window[i] === '.' && /\s/.test(window[i + 1])) {
      // Check that what follows is the start of body prose (a letter or paren)
      const after = window.substring(i + 1).replace(/^\s+/, '');
      if (after.length === 0) continue;
      const nextCh = after[0];
      // body prose starts with letter or open paren (sub-clause)
      if (/[A-Za-z(]/.test(nextCh)) {
        endIdx = i;
        break;
      }
    }
  }

  let title;
  if (endIdx >= 0) {
    title = window.substring(0, endIdx);
  } else {
    // No period found — take up to first newline or 200 chars
    const nlIdx = window.indexOf('\n');
    title = nlIdx >= 0 ? window.substring(0, nlIdx) : window.substring(0, 200);
  }

  // Normalize whitespace (collapse internal newlines)
  title = title.replace(/\s+/g, ' ').trim();
  // Remove trailing period if any
  title = title.replace(/\.+$/, '').trim();

  // Sanity check: if title is empty or starts with body-like text, return ''
  if (!title) return '';
  // Reject titles that are clearly mid-paragraph fragments (start with
  // lowercase + are long)
  if (/^[a-z]/.test(title) && title.length > 30) return '';

  return title;
}

// ─── Section Parsing ───

/**
 * Parse Section headings from the body text.
 *
 * Finds "Section X.XX" or "SECTION X.XX" patterns, classifies each as a
 * heading vs cross-reference, and builds section objects with text, title,
 * and article association.
 */
function parseSections(body, bodyStart, bodyEnd, articles) {
  // Step 1: Find all "Section X.XX" occurrences
  const sectionPattern = /(?:SECTION|Section)\s+(\d+\.\d{1,2})\b/g;
  const allMatches = [];
  let m;

  while ((m = sectionPattern.exec(body)) !== null) {
    // Only consider matches within the body range
    if (bodyStart + m.index >= bodyEnd) break;

    allMatches.push({
      index: m.index,
      absIndex: bodyStart + m.index,
      number: m[1],
      fullMatch: m[0],
    });
  }

  // If very few "Section X.XX" matches, also try bare "X.XX Title" format
  if (allMatches.length < 5) {
    const barePattern = /(?:^|\n)\s*(\d+\.\d{1,2})\s+[A-Z]/g;
    while ((m = barePattern.exec(body)) !== null) {
      if (bodyStart + m.index >= bodyEnd) break;
      const num = m[1];
      // Don't duplicate if already matched as "Section X.XX"
      if (!allMatches.some(a => a.number === num && Math.abs(a.index - m.index) < 20)) {
        const offset = m[0].startsWith('\n') ? 1 : 0;
        allMatches.push({
          index: m.index + offset,
          absIndex: bodyStart + m.index + offset,
          number: num,
          fullMatch: m[0].trim(),
        });
      }
    }
    allMatches.sort((a, b) => a.index - b.index);
  }

  // Step 2: Classify each match as heading vs cross-reference
  const headings = allMatches.filter(match => {
    if (!isHeading(body, match.index)) return false;

    // Additional filter: section followed by lowercase / cross-ref signal is
    // a cross-reference, even if it appears at the start of a line (line wrap).
    // E.g. "...the representations and warranties set forth in\nSection 4.08
    // are true..." — "Section 4.08" starts a line but is a cross-ref.
    const afterNum = body.substring(match.index + match.fullMatch.length, match.index + match.fullMatch.length + 80);

    // Also check the preceding line to detect cross-ref signal words that
    // got cut by a newline
    const lookbackSize = 120;
    const lookback = body.substring(Math.max(0, match.index - lookbackSize), match.index);
    const lastNL = lookback.lastIndexOf('\n');
    const prevLine = lastNL > 0 ? lookback.substring(0, lastNL).trim() : lookback.trim();
    // If previous line ends in a cross-ref signal word, this is a cross-ref
    if (prevLine && XREF_SIGNALS.test(prevLine.substring(Math.max(0, prevLine.length - 60)) + ' ')) {
      return false;
    }
    // If previous line ends with "in", "of", "to", "under" etc., cross-ref
    if (/\b(?:in|under|of|to|from|pursuant\s+to|set\s+forth\s+in|described\s+in|defined\s+in|referenced\s+in|subject\s+to|accordance\s+with|provided\s+in|specified\s+in|required\s+by|referred\s+to\s+in|see|per|comply\s+with|violation\s+of|provisions\s+of|obligations\s+under|requirements\s+of|terms\s+of|meaning\s+of|contemplated\s+by)\s*$/i.test(prevLine)) {
      return false;
    }

    // If what follows looks like body prose (lowercase verb/connector),
    // it's a cross-reference
    if (/^\s*\([a-z]\)/.test(afterNum)) return false; // "Section 3.02(b)"
    if (/^\s+(?:are|is|was|were|shall|will|may|of|and|or|hereof|hereto|above|below|requires?|sets?|describes?|provides?|states?|contemplated|notwithstanding|to\s+be|to\s+the)\b/i.test(afterNum)) {
      return false;
    }
    // Comma followed by another Section/Article reference → list of cross-refs
    if (/^\s*,\s*(?:Section|Article|SECTION|ARTICLE)\s/.test(afterNum)) return false;
    // Comma followed by lowercase → cross-ref continuation
    if (/^\s*,\s*[a-z]/.test(afterNum)) return false;
    // If immediately followed by lowercase letter (after just whitespace),
    // it's body continuation
    if (/^\s+[a-z]/.test(afterNum) && !/^\s*\(/.test(afterNum)) return false;

    return true;
  });

  // Detect delimiter pattern for diagnostics
  const delimiter = allMatches.length >= 5
    ? (body.match(/SECTION\s+\d/i) ? 'Section X.XX' : 'X.XX bare')
    : 'fallback';

  // Step 3: Build sections between consecutive headings
  const effectiveEnd = bodyEnd - bodyStart; // relative to body
  const sections = [];

  // Item 1: precompute ARTICLE heading positions (in body-relative coords) so a
  // section's end can be tightened to MIN(next SECTION heading, next ARTICLE
  // heading). Without this, a section near the end of one article that has a
  // higher section number than the first section of the next article (rare but
  // happens when EDGAR drops a heading line) silently swallows the article
  // boundary AND the next article's preamble.
  const articleAbsPositions = (articles || [])
    .map((a) => a.startChar)
    .filter((p) => typeof p === 'number' && p >= bodyStart)
    .map((abs) => abs - bodyStart)
    .sort((a, b) => a - b);

  for (let i = 0; i < headings.length; i++) {
    const start = headings[i].index;
    const nextSectionEnd = i + 1 < headings.length
      ? headings[i + 1].index
      : Math.min(effectiveEnd, body.length);
    // Find the next ARTICLE heading strictly after this section's start, if any
    let nextArticleEnd = Infinity;
    for (const ap of articleAbsPositions) {
      if (ap > start) { nextArticleEnd = ap; break; }
    }
    const end = Math.min(nextSectionEnd, nextArticleEnd, body.length);

    const rawText = body.substring(start, end).trim();
    const text = cleanSectionText(rawText);

    // Skip tiny fragments
    if (text.length < 20) continue;

    // Extract heading line
    const headingLine = text.split('\n')[0].substring(0, 200).trim();

    // Extract title
    let title = extractSectionTitle(text, headings[i].number);

    // Associate with parent article
    const sectionNum = headings[i].number;
    const articleInt = parseInt(sectionNum.split('.')[0], 10);
    const { articleNumber, articleTitle } = findParentArticle(
      articles, bodyStart + start, articleInt
    );

    // Count (a)/(b)/(c) sub-item markers
    const subItemCount = countSubItems(text);

    sections.push({
      number: sectionNum,
      heading: headingLine,
      title,
      text,
      articleNumber,
      articleTitle,
      startChar: bodyStart + start,
      endChar: bodyStart + end,
      level: 'section',
      subItemCount,
    });
  }

  // ── Article chapeau / "General Introduction" sections ──
  //  The text BETWEEN an ARTICLE heading and that article's FIRST Section
  //  heading is the article chapeau (e.g. the Representations lead-in:
  //  "Except as disclosed in the Filed Company SEC Documents ... or the
  //  Company Disclosure Letter ..., the Company represents and warrants ...
  //  as follows:"). The section loop above keys on SECTION headings, so this
  //  chapeau was never emitted and the General Exceptions / preamble fields
  //  had nothing to extract from. Emit it as a synthetic section with
  //  `level: 'article_intro'` so classify/extract can treat it as the REP
  //  preamble. Only emit when the gap holds substantive prose (not just the
  //  article title line).
  for (const art of articles || []) {
    const artStart = art.startChar; // absolute
    if (typeof artStart !== 'number' || artStart < bodyStart) continue;
    // First SECTION heading after this article (absolute coords).
    let firstSecAbs = Infinity;
    for (const h of headings) {
      const hAbs = bodyStart + h.index;
      if (hAbs > artStart && hAbs < firstSecAbs) firstSecAbs = hAbs;
    }
    // Next ARTICLE after this one — chapeau can't run past it.
    let nextArtAbs = Infinity;
    for (const ap of articleAbsPositions) {
      const apAbs = bodyStart + ap;
      if (apAbs > artStart && apAbs < nextArtAbs) nextArtAbs = apAbs;
    }
    const gapEnd = Math.min(firstSecAbs, nextArtAbs, bodyEnd);
    if (!(gapEnd > artStart) || gapEnd === Infinity) continue;
    // artStart / gapEnd are ABSOLUTE offsets; `body` is the bodyStart-relative
    // slice, so subtract bodyStart to index into it.
    let chapeau = cleanSectionText(body.substring(artStart - bodyStart, gapEnd - bodyStart).trim());
    // Drop the leading "ARTICLE III" + title line(s) so only the prose remains.
    chapeau = chapeau
      .replace(/^ARTICLE\s+(?:[IVXLCDM]+|\d+)\b[^\n]*\n?/i, '')
      .replace(/^[A-Z][A-Za-z ,&/-]{2,80}\n/, '') // an all-caps/title-case heading line
      .trim();
    // Require real chapeau prose: long enough AND looks like a represents-and-
    // warrants / except-as lead-in rather than an accidental fragment.
    if (chapeau.length < 120) continue;
    if (!/represent|warrant|except as|set forth in|disclosed in/i.test(chapeau)) continue;
    sections.push({
      number: `${art.number}-INTRO`,
      heading: 'General Introduction',
      title: 'General Introduction',
      text: chapeau,
      articleNumber: art.number,
      articleTitle: art.title || '',
      startChar: artStart,
      endChar: gapEnd,
      level: 'article_intro',
      subItemCount: 0,
    });
  }
  // Keep sections in document order after adding chapeaux.
  sections.sort((a, b) => (a.startChar || 0) - (b.startChar || 0));

  // Dedupe sections with the same number — keep the first occurrence (the
  // real body section). Subsequent occurrences are typically defined-terms
  // index entries ("Section 2.2" appearing in an alphabetical reference list
  // inside Section 9.4 "Terms Defined Elsewhere"), or duplicates introduced
  // by TOC/exhibit re-headings.
  const seenNumbers = new Set();
  const deduped = [];
  for (const s of sections) {
    if (seenNumbers.has(s.number)) continue;
    seenNumbers.add(s.number);
    deduped.push(s);
  }

  return { sections: deduped, delimiter };
}

/**
 * Find the parent article for a section based on:
 * 1. The article number derived from the section number (Section 7.01 => Article VII/7)
 * 2. Position: the article whose heading appears before the section
 */
function findParentArticle(articles, sectionAbsPos, articleInt) {
  // Try to match by article number first
  for (const art of articles) {
    const artInt = isRomanNumeral(art.number)
      ? romanToInt(art.number)
      : parseInt(art.number, 10);
    if (artInt === articleInt) {
      return { articleNumber: art.number, articleTitle: art.title };
    }
  }

  // Fallback: find the last article whose startChar is before this section
  let bestArt = null;
  for (const art of articles) {
    if (art.startChar <= sectionAbsPos) {
      bestArt = art;
    }
  }

  if (bestArt) {
    return { articleNumber: bestArt.number, articleTitle: bestArt.title };
  }

  // No article found — derive from section number
  const romanNum = intToRoman(articleInt);
  return { articleNumber: romanNum, articleTitle: '' };
}

// ─── Sub-Item Counting ───

/**
 * Count (a)/(b)/(c) style sub-item markers within section text.
 * Used for complexity estimation.
 */
function countSubItems(text) {
  // Match (a), (b), ..., (z), (aa), (bb), etc. at start of line or after whitespace
  const subItemPattern = /(?:^|\n)\s*\([a-z]{1,2}\)\s/g;
  let count = 0;
  while (subItemPattern.exec(text) !== null) count++;
  return count;
}

// ─── Gap Detection and Recovery ───

/**
 * Detect missing sequential section numbers within each article.
 * E.g., found 5.01, 5.02, 5.04 => gap at 5.03.
 */
function detectGaps(sections) {
  // Group section numbers by article
  const byArticle = {};

  for (const s of sections) {
    const parts = s.number.match(/^(\d+)\.(\d{1,2})$/);
    if (!parts) continue;
    const art = parseInt(parts[1], 10);
    const sec = parseInt(parts[2], 10);
    if (!byArticle[art]) byArticle[art] = { nums: new Set(), usesZeroPad: false };
    byArticle[art].nums.add(sec);
    // Detect zero-padded format (e.g. 7.01 vs 7.1)
    if (parts[2].length === 2 && parts[2][0] === '0') {
      byArticle[art].usesZeroPad = true;
    }
  }

  const gaps = [];

  for (const [artStr, data] of Object.entries(byArticle)) {
    const art = parseInt(artStr, 10);
    const nums = Array.from(data.nums).sort((a, b) => a - b);
    if (nums.length < 2) continue;

    for (let i = 0; i < nums.length - 1; i++) {
      for (let missing = nums[i] + 1; missing < nums[i + 1]; missing++) {
        const label = data.usesZeroPad
          ? `${art}.${String(missing).padStart(2, '0')}`
          : `${art}.${missing}`;
        gaps.push({ article: art, section: missing, label });
      }
    }
  }

  return gaps;
}

/**
 * Attempt to recover gaps by searching for the number pattern without
 * the "Section" prefix (bare number at start of line).
 */
function recoverGaps(gaps, fullText, sections, bodyStart, bodyEnd) {
  const recovered = [];
  const body = fullText.substring(bodyStart, bodyEnd);

  for (const gap of gaps) {
    const escapedNum = gap.label.replace('.', '\\.');

    // Search for the bare number at the start of a line
    const pattern = new RegExp(
      `^\\s*(?:(?:SECTION|Section)\\s+)?${escapedNum}\\b[^\\n]*`, 'gm'
    );

    let match;
    while ((match = pattern.exec(body)) !== null) {
      const absPos = bodyStart + match.index;

      // Skip if already covered by an existing section
      const alreadyCovered = sections.some(
        s => absPos >= s.startChar && absPos < s.endChar
      );
      if (alreadyCovered) continue;

      // Determine end: next known section boundary or capped at 5000 chars
      let endChar = Math.min(absPos + 5000, bodyEnd);
      for (const s of sections) {
        if (s.startChar > absPos && s.startChar < endChar) {
          endChar = s.startChar;
        }
      }

      const text = fullText.substring(absPos, endChar).trim();
      if (text.length < 30) continue;

      // Extract heading and title
      const headingLine = text.split('\n')[0].substring(0, 200).trim();
      const title = extractSectionTitle(text, gap.label);

      // Find article association
      const articleInt = gap.article;
      const articles = []; // We don't have articles here, but findParentArticle handles empty
      const { articleNumber, articleTitle } = findParentArticle(
        [], absPos, articleInt
      );

      recovered.push({
        number: gap.label,
        heading: headingLine,
        title,
        text,
        articleNumber,
        articleTitle,
        startChar: absPos,
        endChar: endChar,
        level: 'section',
        subItemCount: countSubItems(text),
        recovered: true,
      });
      break; // Only recover first match per gap
    }
  }

  return recovered;
}

// ─── Annex / Schedule Parsing (tender-offer Offer Conditions, etc.) ───

/**
 * Scan the post-signature region for substantive Annex/Schedule blocks that
 * carry agreement-level provisions — most commonly "Annex I — Conditions to
 * the Offer" in tender-offer deals. These would otherwise be cut off by
 * findBodyEnd's signature-page stop.
 *
 * Each recognized annex becomes a pseudo-section so the classifier can pick
 * it up. The section number uses an "Annex-I", "Annex-II" style label that
 * does not collide with normal X.XX numbering, and the article association
 * is left null so the classifier's article-context routing falls through to
 * the annex-specific deterministic rules.
 *
 * Roman numerals only — Annex 1 / Schedule 1 ASCII forms are skipped because
 * they collide too often with bare section numbers.
 */
function parseAnnexes(fullText, bodyEnd, articles) {
  if (!fullText || bodyEnd >= fullText.length) return [];

  const tail = fullText.substring(bodyEnd);
  // Match annex/schedule headings like "Annex I" / "Schedule I" / "ANNEX I"
  // followed by an ALL-CAPS title on the next non-empty line.
  const annexHeadingRe = /(?:^|\n)\s*(Annex|ANNEX|Schedule|SCHEDULE)\s+([IVXLCDM]+)\b[^\n]*/g;
  const out = [];
  const matches = [];
  let m;
  while ((m = annexHeadingRe.exec(tail)) !== null) {
    matches.push({
      kind: m[1],
      num: m[2].toUpperCase(),
      relStart: m.index + (m[0].startsWith('\n') ? 1 : 0),
      headerLine: m[0].replace(/^\n/, '').trim(),
    });
  }

  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i];
    const next = matches[i + 1];
    const segStart = cur.relStart;
    const segEnd = next ? next.relStart : tail.length;
    const segText = tail.substring(segStart, segEnd).trim();
    if (segText.length < 80) continue; // skip empty/stub annex headings

    // Extract the annex title from the line after the heading (the
    // ALL-CAPS title, e.g., "CONDITIONS TO THE OFFER").
    const lines = segText.split('\n');
    let title = '';
    for (let k = 1; k < Math.min(lines.length, 6); k++) {
      const t = lines[k].trim();
      if (!t) continue;
      // Reject obvious body-prose continuations
      if (/[a-z]/.test(t) && !/^[A-Z][A-Z\s,;:'\-]+$/.test(t)) {
        // Allow Title Case "Conditions to the Offer"
        if (!/^[A-Z][A-Za-z]/.test(t)) break;
      }
      title = t.replace(/\s+/g, ' ').trim();
      break;
    }

    // Only surface annexes that contain agreement-level provisions. The most
    // common case is "Conditions to the Offer" (tender-offer COND-B). Other
    // typical annexes — Certificate of Incorporation, Bylaws, CVR form —
    // are formal documents in their own right and we skip them.
    const isOfferConditions = /conditions?\s+(?:to|of)\s+(?:the\s+)?offer|offer\s+conditions/i
      .test(title + ' ' + segText.substring(0, 200));
    if (!isOfferConditions) continue;

    const absStart = bodyEnd + segStart;
    const absEnd = bodyEnd + segEnd;
    const heading = lines[0].substring(0, 200).trim();
    out.push({
      number: `Annex-${cur.num}`,
      heading,
      title: title || cur.headerLine,
      text: segText,
      articleNumber: cur.num,
      articleTitle: title || 'Offer Conditions',
      startChar: absStart,
      endChar: absEnd,
      level: 'annex',
      subItemCount: countSubItems(segText),
      isAnnex: true,
    });
  }

  return out;
}

// ─── Main Entry Point ───

/**
 * Parse the structural layout of a merger agreement.
 *
 * @param {string} fullText - The full text of the merger agreement
 * @returns {{ sections, articles, diagnostics }}
 */
function parseStructure(fullText) {
  if (!fullText || typeof fullText !== 'string') {
    return {
      sections: [],
      articles: [],
      diagnostics: {
        bodyStart: 0,
        totalSections: 0,
        totalArticles: 0,
        delimiter: 'none',
        coveragePct: 0,
        gaps: [],
      },
    };
  }

  // Step 1: Find body boundaries
  const bodyStart = findBodyStart(fullText);
  const bodyEnd = findBodyEnd(fullText, bodyStart);
  const body = fullText.substring(bodyStart, bodyEnd);

  // Step 2: Parse article headings
  const articles = parseArticles(body, bodyStart);

  // Step 3: Parse section headings
  const { sections, delimiter } = parseSections(
    body, bodyStart, bodyEnd, articles
  );

  // Step 2.5: Synthesize missing articles from section-number gaps.
  // Some EDGAR exhibits drop the "ARTICLE I" header line entirely during
  // HTML cleanup (e.g. Metsera) — the body jumps straight from the
  // preamble to "The Merger\n\nSECTION 1.01." with no explicit article
  // marker. parseArticles can't see it, so sections 1.01-1.06 end up with
  // no article context and the classifier guesses inconsistently
  // (STRUCT for some, OTHER for others). Detect this case: for every
  // distinct section-number prefix present in `sections`, if there's no
  // matching article entry, synthesize one. Title is derived from the
  // first line of body text before SECTION X.01, or falls back to
  // "Article <roman>".
  const ROMAN = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV'];
  const presentArticleNums = new Set();
  for (const a of articles) {
    const n = parseInt(String(a.number || '').replace(/[^0-9]/g, ''), 10);
    if (n) presentArticleNums.add(n);
    // Articles often store roman numerals — normalize via index
    const rn = String(a.number || '').toUpperCase();
    const idx = ROMAN.indexOf(rn);
    if (idx >= 0) presentArticleNums.add(idx + 1);
  }
  const seenArticleNumsFromSections = new Set();
  for (const s of sections) {
    const num = String(s.number || '');
    const articleInt = parseInt(num.split('.')[0], 10);
    if (articleInt) seenArticleNumsFromSections.add(articleInt);
  }
  for (const articleInt of seenArticleNumsFromSections) {
    if (presentArticleNums.has(articleInt)) continue;
    // Synthesize a missing article. Derive the title by looking backward
    // from the first section of this article for a short line of body
    // text (typically the dropped "ARTICLE I" heading's title-line).
    const firstSec = sections.find((s) => parseInt(String(s.number || '').split('.')[0], 10) === articleInt);
    if (!firstSec) continue;
    const firstSecOffset = firstSec.startChar || 0;
    // Walk backwards from this section's start, in the FULL TEXT, for a
    // short non-empty line followed by a blank line.
    const beforeWindow = fullText.substring(Math.max(0, firstSecOffset - 400), firstSecOffset);
    // Find lines (split on \n\n)
    const blocks = beforeWindow.split(/\n\n+/).filter((b) => b.trim().length > 0);
    let title = '';
    for (let i = blocks.length - 1; i >= 0; i--) {
      const candidate = blocks[i].trim().replace(/\s+/g, ' ');
      // Reject blocks that look like prose (multiple sentences / >80 chars)
      // — real article titles are usually 2-10 words.
      if (candidate.length > 0 && candidate.length <= 80 && !/[.!?]\s+[A-Z]/.test(candidate)) {
        title = candidate;
        break;
      }
    }
    const roman = ROMAN[articleInt - 1] || String(articleInt);
    articles.push({
      number: roman,
      title: title || `Article ${roman}`,
      articleTitle: title || `Article ${roman}`,
      startChar: firstSecOffset, // best approximation
      synthesized: true,
    });
  }
  // Sort articles by startChar so any synthesized entries land in order.
  articles.sort((a, b) => (a.startChar || 0) - (b.startChar || 0));

  // Step 4: Detect and recover gaps
  const gaps = detectGaps(sections);
  const recovered = recoverGaps(gaps, fullText, sections, bodyStart, bodyEnd);

  // Merge recovered sections and update article associations
  if (recovered.length > 0) {
    // Re-associate recovered sections with their articles now that we have
    // the full article list
    for (const rec of recovered) {
      const articleInt = parseInt(rec.number.split('.')[0], 10);
      const parent = findParentArticle(articles, rec.startChar, articleInt);
      rec.articleNumber = parent.articleNumber;
      rec.articleTitle = parent.articleTitle;
    }
    sections.push(...recovered);
  }

  // Sort all sections by document position
  sections.sort((a, b) => a.startChar - b.startChar);

  // Step 4.5: Capture tender-offer Annexes that live AFTER the signature page
  // ("Annex I — Conditions to the Offer" in particular). These contain the
  // buyer's conditions in tender-offer deals and would otherwise be lost by
  // bodyEnd truncation. We synthesize one pseudo-section per recognized annex
  // so the classifier can tag it (Offer Conditions → COND-B). We also push a
  // pseudo-article entry so the classifier's article-context lookup can find
  // it (keyed by the annex's roman numeral).
  const annexSections = parseAnnexes(fullText, bodyEnd, articles);
  if (annexSections.length > 0) {
    sections.push(...annexSections);
    sections.sort((a, b) => a.startChar - b.startChar);
    // Synthesize article entries for annexes so the classifier can resolve
    // them via the article map. The "number" mirrors the section's
    // articleNumber. Avoid collisions with existing articles by using a
    // distinct number namespace (the section.number "Annex-I" already
    // doesn't match by split('.')[0] — see classifySections, which we
    // teach to honour the section's articleTitle directly).
    for (const annex of annexSections) {
      // Only push if no real article with this number exists
      if (!articles.some(a => a.number === annex.articleNumber)) {
        articles.push({
          number: annex.articleNumber,
          title: annex.articleTitle,
          startChar: annex.startChar,
          isAnnex: true,
        });
      }
    }
  }

  // Step 5: Compute remaining gaps after recovery
  const remainingGaps = detectGaps(sections);

  // Step 6: Coverage diagnostics
  const bodyLength = bodyEnd - bodyStart;
  const coveredChars = sections.reduce(
    (sum, s) => sum + Math.min(s.endChar, bodyEnd) - Math.max(s.startChar, bodyStart),
    0
  );
  const coveragePct = bodyLength > 0
    ? Math.round((Math.min(coveredChars, bodyLength) / bodyLength) * 100)
    : 0;

  return {
    sections,
    articles,
    diagnostics: {
      bodyStart,
      totalSections: sections.length,
      totalArticles: articles.length,
      delimiter,
      coveragePct,
      gaps: remainingGaps.map(g => g.label),
    },
  };
}

// ─── Exports ───

module.exports = { parseStructure, cleanText, displayCleanText };
