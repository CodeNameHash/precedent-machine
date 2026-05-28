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

  // Apply core EDGAR cleanup (SGML tags, entities, page numbers, etc.)
  text = cleanEdgarText(text);

  // Remove repeated headers (running headers/footers from PDF pages)
  text = removeRepeatedHeaders(text);

  return text;
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
      /(?<!\[\[SECTION\]\])\b(Sections?\s+\d+\.\d{1,2}(?:\([a-z]+\))?(?:\([ivxlc]+\))?(?:\([A-Z]\))?)\b/g,
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

      // Real section: substantial text remaining after stripping the number
      if (withoutLeader.length > 30) {
        // Walk backwards to find the preceding ARTICLE heading
        const before = afterToc.substring(0, sm.index);
        const artPattern = /\n\s*ARTICLE\s+(?:[IVXLCDM]+|\d+)\b/gi;
        let lastArtIdx = -1;
        let am;
        while ((am = artPattern.exec(before)) !== null) lastArtIdx = am.index;

        if (lastArtIdx >= 0) return tocMatch.index + lastArtIdx + 1;
        return tocMatch.index + sm.index;
      }
    }
  }

  // No TOC or couldn't determine body start from TOC — look for first ARTICLE heading
  const firstArt = fullText.match(/\n\s*ARTICLE\s+(?:[IVXLCDM]+|\d+)\b/i);
  if (firstArt) return firstArt.index + 1;

  return 0;
}

/**
 * Find where the agreement body ends — truncate at signature blocks.
 * Returns the character index where the body ends.
 */
function findBodyEnd(fullText, bodyStart) {
  const afterBody = fullText.substring(bodyStart);

  // Signature page patterns
  const sigPatterns = [
    /\n\s*IN WITNESS WHEREOF/i,
    /\n\s*\[Signature\s+Page/i,
    /\n\s*\[Remainder\s+of\s+(this\s+)?page\s+intentionally\s+left\s+blank\]/i,
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
      // ARTICLE, or a bare X.XX number).
      const afterMatch = body.substring(matchStart + m[0].length);
      const candidate = findNextHeadingLine(afterMatch);
      if (candidate) {
        title = candidate;
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
  return articles;
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

  for (let i = 0; i < headings.length; i++) {
    const start = headings[i].index;
    const end = i + 1 < headings.length
      ? headings[i + 1].index
      : Math.min(effectiveEnd, body.length);

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

  return { sections, delimiter };
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
