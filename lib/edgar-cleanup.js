// ─── Shared EDGAR Text Cleanup ───
// Strips formatting artifacts from Edgarized PDF/Word documents:
// form feeds, page numbers, repeated headers, excessive whitespace, etc.

export function cleanEdgarText(text) {
  return text
    // EDGAR SGML tags (<PAGE>, <S>, <C>, etc.)
    .replace(/<\/?(?:PAGE|S|C|FN|TABLE|CAPTION)>/gi, '')
    // Form feed characters
    .replace(/\f/g, '\n')
    // Decode numeric HTML entities (&#8220; → ", &#8221; → ", &#8217; → ', etc.)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    // Decode named HTML entities not handled by stripHtml
    .replace(/&ldquo;/gi, '\u201c')
    .replace(/&rdquo;/gi, '\u201d')
    .replace(/&lsquo;/gi, '\u2018')
    .replace(/&rsquo;/gi, '\u2019')
    .replace(/&mdash;/gi, '\u2014')
    .replace(/&ndash;/gi, '\u2013')
    // Zero-width / invisible Unicode characters (BOM, ZWSP, ZWNJ, ZWJ, word joiner, LRM, RLM)
    .replace(/[\uFEFF\u200B\u200C\u200D\u2060\u200E\u200F]/g, '')
    // Unicode replacement character — in EDGAR filings these are almost always
    // corrupted smart quotes (curly quotes → \uFFFD), so restore as double quote
    .replace(/\uFFFD/g, '"')
    // Non-breaking spaces → regular spaces
    .replace(/\u00A0/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#160;/g, ' ')
    // Standalone page numbers: plain (42), prefixed (A-37), or dash-wrapped (-5-)
    .replace(/^\s*(?:[A-Z]-?)?\d{1,4}\s*$/gm, '')
    .replace(/^\s*-\s*\d{1,4}\s*-\s*$/gm, '')
    // Standalone lowercase roman numeral page numbers
    .replace(/^\s*(?:i{1,3}|iv|vi{0,3}|ix|xi{0,3})\s*$/gm, '')
    // Lines of underscores, equals, dashes (decorative separators, 10+ chars)
    .replace(/^\s*[_=\-]{10,}\s*$/gm, '')
    // Leader dot remnants (....3)
    .replace(/\.{4,}\s*\d{1,4}\s*$/gm, '')
    // Excessive blank lines → max 2 consecutive
    .replace(/\n{4,}/g, '\n\n\n')
    // Trailing whitespace on each line
    .replace(/[ \t]+$/gm, '')
    .trim();
}

export function removeRepeatedHeaders(text) {
  const lines = text.split('\n');
  const lineCounts = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length < 3 || trimmed.length > 80) continue;
    lineCounts[trimmed] = (lineCounts[trimmed] || 0) + 1;
  }

  const repeatedHeaders = new Set();
  for (const [line, count] of Object.entries(lineCounts)) {
    if (count < 3) continue;
    const upperRatio = line.replace(/[^A-Z]/g, '').length / line.length;
    const isAllCaps = upperRatio > 0.6 && line.length < 60;
    const isPageNum = /^\s*(?:[A-Z]-?)?\d{1,4}\s*$/.test(line);
    if (isAllCaps || isPageNum) {
      repeatedHeaders.add(line);
    }
  }

  if (repeatedHeaders.size === 0) return text;
  return lines.filter(line => !repeatedHeaders.has(line.trim())).join('\n');
}

// Rejoin lines that were broken mid-sentence by EDGAR's ~80-char wrapping.
// Heuristic: if a line doesn't end with terminal punctuation and the next
// line continues naturally (no structural element), join them with a space.
export function rejoinEdgarLines(text) {
  const lines = text.split('\n');
  const result = [];

  for (let i = 0; i < lines.length; i++) {
    const currTrimmed = lines[i].trim();

    // First line or blank line — push as-is
    if (result.length === 0 || currTrimmed.length === 0) {
      result.push(lines[i]);
      continue;
    }

    const prevLine = result[result.length - 1];
    const prevTrimmed = prevLine.trimEnd();

    // Don't join if prev line is short (intentional break, not EDGAR wrap)
    if (prevTrimmed.length < 40) {
      result.push(lines[i]);
      continue;
    }

    // Don't join if prev line ends with terminal punctuation (.;:!?)
    // possibly followed by closing quotes/parens
    if (/[.;:!?][\u201d"\)\]]*\s*$/.test(prevTrimmed)) {
      result.push(lines[i]);
      continue;
    }

    // Don't join if current line starts with structural elements
    if (/^\s*\([a-z]\)\s/.test(lines[i]) ||          // (a) subclause
        /^\s*\(\d+\)\s/.test(lines[i]) ||              // (1) numbered item
        /^\s*\([ivxlc]+\)\s/i.test(lines[i]) ||        // (i) roman numeral item
        /^\s*(?:SECTION|Section|ARTICLE|Article)\s/i.test(lines[i]) ||
        /^\s*[A-Z][A-Z\s]{5,}[A-Z]\s*$/.test(lines[i]) ||  // ALL-CAPS heading
        /^\s*\d+\.\d{1,2}\s/.test(lines[i])) {         // bare section number
      result.push(lines[i]);
      continue;
    }

    // Join: this line is a continuation of the previous (EDGAR-wrapped)
    result[result.length - 1] = prevTrimmed + ' ' + currTrimmed;
  }

  return result.join('\n');
}

// Clean section text — rejoin lines broken by EDGAR 80-char wrapping
// and strip embedded page artifacts within section body
export function cleanSectionText(text) {
  let cleaned = text
    // Remove standalone page numbers embedded within section text
    .replace(/\n\s*(?:[A-Z]-?)?\d{1,4}\s*\n/g, '\n')
    // Remove dash-wrapped page numbers (-5-, -42-)
    .replace(/\n\s*-\s*\d{1,4}\s*-\s*\n/g, '\n')
    // Collapse 3+ blank lines to 2
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Recover from HTML page breaks: when a line ends without terminal punctuation
  // and the next non-blank line starts with lowercase, the blank line is a page-break
  // artifact — collapse it so rejoinEdgarLines can join the interrupted sentence
  cleaned = cleaned.replace(/([^\n.;:!?\u201d"\)\]])\n\n+(?=\s*[a-z])/g, '$1\n');

  // Rejoin lines broken mid-sentence by EDGAR 80-char wrapping
  cleaned = rejoinEdgarLines(cleaned);

  return cleaned;
}
