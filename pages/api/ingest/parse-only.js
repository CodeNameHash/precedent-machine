export const config = {
  api: { bodyParser: { sizeLimit: '50mb' } },
};

// ─── EDGAR Text Cleanup ───
// Strips formatting artifacts from Edgarized PDF/Word documents:
// form feeds, page numbers, repeated headers, excessive whitespace, etc.

function cleanEdgarText(text) {
  return text
    // EDGAR SGML tags (<PAGE>, <S>, <C>, etc.)
    .replace(/<\/?(?:PAGE|S|C|FN|TABLE|CAPTION)>/gi, '')
    // Form feed characters
    .replace(/\f/g, '\n')
    // Zero-width / invisible Unicode characters (BOM, ZWSP, ZWNJ, ZWJ, word joiner, LRM, RLM)
    .replace(/[\uFEFF\u200B\u200C\u200D\u2060\u200E\u200F]/g, '')
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

function removeRepeatedHeaders(text) {
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

// Clean section text — rejoin lines broken by EDGAR 80-char wrapping
// and strip embedded page artifacts within section body
function cleanSectionText(text) {
  return text
    // Remove standalone page numbers embedded within section text
    .replace(/\n\s*(?:[A-Z]-?)?\d{1,4}\s*\n/g, '\n')
    // Remove dash-wrapped page numbers (-5-, -42-)
    .replace(/\n\s*-\s*\d{1,4}\s*-\s*\n/g, '\n')
    // Collapse 3+ blank lines to 2
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ─── TOC Detection ───
// Two strategies:
// 1. Primary: Find explicit "TABLE OF CONTENTS" / "Table of Contents" header,
//    extract section numbers from that block, find where body starts after it.
// 2. Fallback: Cluster "Section X.XX" lines that end with page numbers.

function detectTOC(fullText) {
  // ── Strategy 1: Explicit "Table of Contents" header ──
  const tocHeaderMatch = fullText.match(/(?:^|\n)\s*(TABLE\s+OF\s+CONTENTS|Table\s+of\s+Contents)\s*\n/im);
  if (tocHeaderMatch) {
    const tocBlockStart = tocHeaderMatch.index + tocHeaderMatch[0].length;

    // Find where the TOC block ends: look for preamble, recitals, or
    // ARTICLE I body heading (preceded by substantive text, not a TOC line).
    // The body typically starts with "AGREEMENT AND PLAN", "This Agreement",
    // "PREAMBLE", "RECITALS", or the first ARTICLE with body text following.
    const afterHeader = fullText.substring(tocBlockStart);
    const bodySignals = [
      /\n\s*(AGREEMENT\s+AND\s+PLAN\s+OF\s+MERGER)/i,
      /\n\s*(This\s+Agreement\s+and\s+Plan)/i,
      /\n\s*(PREAMBLE)/i,
      /\n\s*(RECITALS)/i,
      /\n\s*(NOW,?\s+THEREFORE)/i,
    ];

    let tocBlockEnd = afterHeader.length;
    for (const sig of bodySignals) {
      const sm = afterHeader.match(sig);
      if (sm && sm.index < tocBlockEnd) {
        tocBlockEnd = sm.index;
      }
    }

    // Also check: if we see "ARTICLE I" or "Section 1" followed by substantial
    // text (>200 chars before next Section), that's body, not TOC
    const artBodyMatch = afterHeader.match(/\n\s*ARTICLE\s+(?:I|1)\b/i);
    if (artBodyMatch) {
      // Look ahead: is there a long paragraph after this ARTICLE heading?
      const afterArt = afterHeader.substring(artBodyMatch.index + artBodyMatch[0].length);
      const nextSection = afterArt.match(/(?:SECTION|Section)\s+\d+\.\d{1,2}\b/);
      if (nextSection && nextSection.index > 200) {
        // Substantial text before next section → this is body ARTICLE, not TOC
        if (artBodyMatch.index < tocBlockEnd) {
          tocBlockEnd = artBodyMatch.index;
        }
      }
    }

    const tocBlock = afterHeader.substring(0, tocBlockEnd);

    // Extract section numbers AND titles from the TOC block
    // Match both "SECTION X.XX  Title" and bare "X.XX  Title" patterns
    const entries = [];
    const tocTitles = {}; // { "1.01": "Definitions", ... }
    const seen = new Set();
    // Match: SECTION 1.01.  Title  or  SECTION 1.01  Title  (with optional trailing page num)
    const sectionRe = /(?:SECTION|Section)\s+(\d+\.\d{1,2})\.?\s+([^\n]+)/g;
    let m;
    while ((m = sectionRe.exec(tocBlock)) !== null) {
      if (!seen.has(m[1])) {
        entries.push(m[1]);
        seen.add(m[1]);
        // Clean the title: strip trailing page number, dots, whitespace
        const title = m[2].replace(/[\s.]*\d{1,4}\s*$/, '').trim();
        if (title.length > 0) tocTitles[m[1]] = title;
      }
    }
    // Also try bare "X.XX  Title" at start of line (for formats like "1.1  The Merger")
    if (entries.length < 5) {
      const bareRe = /(?:^|\n)\s*(\d+\.\d{1,2})\s+([^\n]+)/g;
      while ((m = bareRe.exec(tocBlock)) !== null) {
        if (!seen.has(m[1])) {
          entries.push(m[1]);
          seen.add(m[1]);
          const title = m[2].replace(/[\s.]*\d{1,4}\s*$/, '').trim();
          if (title.length > 0) tocTitles[m[1]] = title;
        }
      }
    }

    // Body starts after the TOC block
    const bodyStart = tocBlockStart + tocBlockEnd;

    if (entries.length >= 3) {
      return { found: true, entries, tocTitles, bodyStart };
    }
    // If too few entries found, the header might be misleading — fall through
  }

  // ── Strategy 2: Cluster Section lines ending with page numbers ──
  const sectionRe2 = /(?:SECTION|Section)\s+(\d+\.\d{1,2})\.?\s*([^\n]*)/g;
  const allMatches = [];
  let m;
  while ((m = sectionRe2.exec(fullText)) !== null) {
    allMatches.push({
      index: m.index,
      endIndex: m.index + m[0].length,
      number: m[1],
      rawTitle: m[2] || '',
    });
  }

  if (allMatches.length < 8) {
    return { found: false, entries: [], tocTitles: {}, bodyStart: findBodyStartFallback(fullText) };
  }

  // For each match, check if its line ends with a page number
  const tocFlags = allMatches.map(match => {
    const lineEnd = fullText.indexOf('\n', match.index);
    const line = fullText.substring(match.index, lineEnd === -1 ? fullText.length : lineEnd);
    return /(?:\.{2,}|[\s\t]{2,})\d{1,4}\s*$/.test(line);
  });

  let tocStart = -1;
  let tocEnd = -1;
  let runStart = -1;
  let runCount = 0;

  for (let i = 0; i < tocFlags.length; i++) {
    if (tocFlags[i]) {
      if (runStart === -1) runStart = i;
      runCount++;
    } else {
      if (runCount >= 5) {
        tocStart = runStart;
        tocEnd = i - 1;
        break;
      }
      if (runCount > 0 && i - runStart - runCount <= 2) {
        continue;
      }
      runStart = -1;
      runCount = 0;
    }
  }
  if (runCount >= 5 && tocStart === -1) {
    tocStart = runStart;
    tocEnd = allMatches.length - 1;
    if (tocEnd === allMatches.length - 1) {
      for (let i = runStart; i < tocFlags.length; i++) {
        if (!tocFlags[i] && i > runStart + 4) {
          tocEnd = i - 1;
          break;
        }
      }
    }
  }

  if (tocStart === -1 || tocEnd === -1) {
    return { found: false, entries: [], tocTitles: {}, bodyStart: findBodyStartFallback(fullText) };
  }

  if (allMatches[tocStart].index > fullText.length * 0.4) {
    return { found: false, entries: [], tocTitles: {}, bodyStart: findBodyStartFallback(fullText) };
  }

  const entries = [];
  const tocTitles = {};
  const seen = new Set();
  for (let i = tocStart; i <= tocEnd; i++) {
    if (!seen.has(allMatches[i].number)) {
      entries.push(allMatches[i].number);
      seen.add(allMatches[i].number);
      const title = allMatches[i].rawTitle.replace(/[\s.]*\d{1,4}\s*$/, '').trim();
      if (title.length > 0) tocTitles[allMatches[i].number] = title;
    }
  }

  const lastTocMatch = allMatches[tocEnd];
  const lastTocLineEnd = fullText.indexOf('\n', lastTocMatch.index);
  let bodyStart = lastTocLineEnd !== -1 ? lastTocLineEnd + 1 : lastTocMatch.endIndex;

  const afterToc = fullText.substring(bodyStart);
  const artMatch = afterToc.match(/^\s*ARTICLE\s+(?:[IVXLC]+|\d+)\b/im);
  const preambleMatch = afterToc.match(/(^|\n)\s*(This\s+Agreement|AGREEMENT\s+AND\s+PLAN)/i);
  const firstSection = afterToc.match(/(^|\n)\s*(?:SECTION|Section)\s+\d+\.\d{1,2}\b/);

  const candidates = [];
  if (artMatch) candidates.push(artMatch.index);
  if (preambleMatch) candidates.push(preambleMatch.index);
  if (firstSection) candidates.push(firstSection.index);

  if (candidates.length > 0) {
    bodyStart += Math.min(...candidates);
  }

  return { found: true, entries, tocTitles, bodyStart };
}

function findBodyStartFallback(fullText) {
  // Try explicit "TABLE OF CONTENTS" header → skip to first ARTICLE
  const tocHeader = fullText.match(/TABLE\s+OF\s+CONTENTS/i);
  if (tocHeader) {
    const afterToc = fullText.substring(tocHeader.index);
    // Look for body signals after the TOC header
    const bodySignals = [
      afterToc.match(/\n\s*(AGREEMENT\s+AND\s+PLAN)/i),
      afterToc.match(/\n\s*(PREAMBLE)/i),
      afterToc.match(/\n\s*ARTICLE\s+(?:[IVXLC]+|\d+)\b/i),
    ].filter(Boolean).map(m => m.index);
    if (bodySignals.length > 0) return tocHeader.index + Math.min(...bodySignals) + 1;
  }
  // Try first ARTICLE heading
  const firstArt = fullText.match(/\n\s*ARTICLE\s+(?:[IVXLC]+|\d+)\b/i);
  if (firstArt) return firstArt.index + 1;
  return 0;
}

// ─── Section Heading Detection ───
// Cross-reference signals — words that precede "Section X.XX" in cross-refs
const XREF_SIGNALS = /(?:in|under|of|to|pursuant\s+to|set\s+forth\s+in|described\s+in|defined\s+in|referenced\s+in|subject\s+to|accordance\s+with|provided\s+in|specified\s+in|required\s+by|referred\s+to\s+in|see|per)\s*$/i;

function isHeading(text, matchIndex) {
  const lookback = text.substring(Math.max(0, matchIndex - 80), matchIndex);
  const lastNL = lookback.lastIndexOf('\n');

  if (lastNL !== -1) {
    const gap = lookback.substring(lastNL + 1);
    if (gap.trim().length === 0) return true;
    if (gap.trim().length <= 5) return true;
  } else if (matchIndex <= 80) {
    return true;
  }

  const immediateBefore = text.substring(Math.max(0, matchIndex - 40), matchIndex);
  if (XREF_SIGNALS.test(immediateBefore)) return false;
  return false;
}

function extractTitle(heading) {
  return heading
    .replace(/^(?:SECTION|Section)\s+\d+\.\d{1,2}\b\s*/, '')
    .replace(/^[.\-\u2014:;\s]+/, '')
    .trim();
}

function romanToInt(str) {
  if (!str) return 0;
  const vals = { I: 1, V: 5, X: 10, L: 50, C: 100 };
  let result = 0;
  const upper = str.toUpperCase();
  for (let i = 0; i < upper.length; i++) {
    const curr = vals[upper[i]] || 0;
    const next = vals[upper[i + 1]] || 0;
    result += curr < next ? -curr : curr;
  }
  return result;
}

// ─── Signature Page / Exhibit Truncation ───
function findBodyEnd(fullText, bodyStart) {
  const afterBody = fullText.substring(bodyStart);

  // Look for signature page indicators
  const sigPattern = /\n\s*(IN WITNESS WHEREOF|\[Signature\s+Page)/i;
  const sigMatch = afterBody.match(sigPattern);

  if (!sigMatch) return { bodyEnd: fullText.length, truncatedChars: 0 };

  // Signature page found — truncate here
  const bodyEnd = bodyStart + sigMatch.index;

  return { bodyEnd, truncatedChars: fullText.length - bodyEnd };
}

// ─── Gap Detection ───
function detectGaps(sections) {
  const byArticle = {};
  for (const s of sections) {
    const numMatch = s.number.match(/(\d+)\.(\d{1,2})/);
    if (!numMatch) continue;
    const art = parseInt(numMatch[1], 10);
    const sec = parseInt(numMatch[2], 10);
    if (!byArticle[art]) byArticle[art] = new Set();
    byArticle[art].add(sec);
  }

  const gaps = [];
  for (const [artStr, secSet] of Object.entries(byArticle)) {
    const art = parseInt(artStr, 10);
    const nums = Array.from(secSet).sort((a, b) => a - b);
    if (nums.length < 2) continue;
    const usesZeroPad = sections.some(s => {
      const m = s.number.match(/(\d+)\.(\d{1,2})/);
      return m && parseInt(m[1]) === art && /\.\d{2}/.test(s.number);
    });
    for (let i = 0; i < nums.length - 1; i++) {
      for (let missing = nums[i] + 1; missing < nums[i + 1]; missing++) {
        const label = usesZeroPad ? `${art}.${String(missing).padStart(2, '0')}` : `${art}.${missing}`;
        gaps.push({ article: art, section: missing, label });
      }
    }
  }
  return gaps;
}

// ─── Find body start in cleaned text ───
// After EDGAR cleanup shifts character positions, re-locate where the body
// starts by searching for body signals after the TOC area.
function findBodyStartInCleanedText(cleanedText, tocEntries) {
  if (!tocEntries || tocEntries.length === 0) return 0;

  // If there's a "Table of Contents" header in cleaned text, skip past it
  const tocHeader = cleanedText.match(/(?:^|\n)\s*(?:TABLE\s+OF\s+CONTENTS|Table\s+of\s+Contents)\s*\n/im);
  const searchFrom = tocHeader ? tocHeader.index + tocHeader[0].length : 0;
  const afterTocHeader = cleanedText.substring(searchFrom);

  // Look for body start signals
  const bodySignals = [
    afterTocHeader.match(/\n\s*(AGREEMENT\s+AND\s+PLAN\s+OF\s+MERGER)/i),
    afterTocHeader.match(/\n\s*(PREAMBLE)/i),
    afterTocHeader.match(/\n\s*(RECITALS)/i),
    afterTocHeader.match(/\n\s*(NOW,?\s+THEREFORE)/i),
    afterTocHeader.match(/\n\s*(This\s+Agreement\s+and\s+Plan)/i),
  ].filter(Boolean);

  if (bodySignals.length > 0) {
    const earliest = Math.min(...bodySignals.map(m => m.index));
    return searchFrom + earliest + 1;
  }

  // Find first Section heading that's followed by substantial text (not a TOC line)
  const tocSet = new Set(tocEntries);
  const sectionRe = /(?:SECTION|Section)\s+(\d+\.\d{1,2})\b/g;
  let m;
  while ((m = sectionRe.exec(afterTocHeader)) !== null) {
    if (!tocSet.has(m[1])) continue;
    // Check: is the next 200 chars after this heading substantive text?
    const after = afterTocHeader.substring(m.index + m[0].length, m.index + m[0].length + 200);
    if (after.length > 100 && !/(?:SECTION|Section)\s+\d+\.\d{1,2}/.test(after.substring(0, 80))) {
      // Body heading — go back to start of line or preceding ARTICLE
      const before = afterTocHeader.substring(Math.max(0, m.index - 200), m.index);
      const artMatch = before.match(/\n\s*(ARTICLE\s+(?:[IVXLC]+|\d+)\b[^\n]*)\s*$/i);
      if (artMatch) {
        return searchFrom + m.index - (before.length - before.lastIndexOf('\n')) + 1;
      }
      const lineStart = afterTocHeader.lastIndexOf('\n', m.index);
      return searchFrom + (lineStart === -1 ? 0 : lineStart + 1);
    }
  }

  // Fallback: first ARTICLE heading
  const artFirst = cleanedText.match(/\n\s*ARTICLE\s+(?:[IVXLC]+|\d+)\b/i);
  if (artFirst) return artFirst.index + 1;
  return 0;
}

// ─── Main Parser ───
function parseDocument(rawText) {
  // Step 1: Detect TOC on RAW text (before cleanup strips page numbers)
  const tocRaw = detectTOC(rawText);

  // Step 2: Clean EDGAR formatting artifacts
  const fullText = removeRepeatedHeaders(cleanEdgarText(rawText));
  const charsRemoved = rawText.length - fullText.length;

  // Step 3: Find body start in cleaned text
  // If TOC was found, re-locate bodyStart since char positions shifted
  const bodyStart = tocRaw.found
    ? findBodyStartInCleanedText(fullText, tocRaw.entries)
    : findBodyStartFallback(fullText);

  // Use TOC entries from raw detection (section numbers are stable)
  const toc = { ...tocRaw, bodyStart };

  // Step 3b: Truncate at signature pages / exhibits
  const { bodyEnd, truncatedChars } = findBodyEnd(fullText, bodyStart);
  const body = fullText.substring(bodyStart, bodyEnd);

  // Step 2: Find all section headings in the body (two-pass approach)
  // Pass 1: Collect all candidates that pass isHeading()
  const sectionPattern = /(?:SECTION|Section)\s+(\d+\.\d{1,2})\b/g;
  const candidates = [];
  let m;
  while ((m = sectionPattern.exec(body)) !== null) {
    if (isHeading(body, m.index)) {
      candidates.push({
        index: m.index,
        absIndex: bodyStart + m.index,
        number: m[1],
        fullMatch: m[0],
      });
    }
  }

  // Fallback: try bare "X.XX Title" format if too few Section matches
  if (candidates.length < 5) {
    const barePattern = /(?:^|\n)\s*(\d+\.\d{1,2})\s+[A-Z]/g;
    while ((m = barePattern.exec(body)) !== null) {
      const num = m[1];
      if (!candidates.some(h => h.number === num && Math.abs(h.index - m.index) < 20)) {
        const offset = m[0].startsWith('\n') ? 1 : 0;
        candidates.push({
          index: m.index + offset,
          absIndex: bodyStart + m.index + offset,
          number: num,
          fullMatch: m[0].trim(),
        });
      }
    }
  }
  candidates.sort((a, b) => a.index - b.index);

  // Pass 2: TOC-aware validation — use TOC as ground truth when available
  const tocSet = toc.found ? new Set(toc.entries) : null;
  const tocTitles = toc.tocTitles || {};
  let rawHeadings = [];
  let lastArticle = -1;
  let lastSection = -1;
  for (const c of candidates) {
    const parts = c.number.match(/(\d+)\.(\d{1,2})/);
    if (!parts) continue;
    const art = parseInt(parts[1], 10);
    const sec = parseInt(parts[2], 10);
    c._art = art;
    c._sec = sec;

    const isFirstCandidate = rawHeadings.length === 0;

    // If TOC exists, use it as primary validator
    if (tocSet) {
      const inToc = tocSet.has(c.number);
      if (inToc) {
        rawHeadings.push(c);
        lastArticle = art;
        lastSection = sec;
        continue;
      }
      // Not in TOC — only accept if sequential
      const isNextInArticle = art === lastArticle && sec === lastSection + 1;
      const isNewArticle = art > lastArticle;
      if (isFirstCandidate || isNextInArticle || isNewArticle) {
        rawHeadings.push(c);
        lastArticle = art;
        lastSection = sec;
      }
      continue;
    }

    // No TOC — fall back to sequential + context validation
    const isNextInArticle = art === lastArticle && sec === lastSection + 1;
    const isNewArticle = art > lastArticle;

    let precededByBreak = false;
    if (!isNextInArticle && !isNewArticle && !isFirstCandidate) {
      const before = body.substring(Math.max(0, c.index - 20), c.index);
      const trimmed = before.trimEnd();
      if (trimmed.length > 0) {
        const lastChar = trimmed[trimmed.length - 1];
        precededByBreak = /[.\d:]/.test(lastChar);
      } else {
        precededByBreak = true;
      }
    }

    if (isFirstCandidate || isNextInArticle || isNewArticle || precededByBreak) {
      rawHeadings.push(c);
      lastArticle = art;
      lastSection = sec;
    }
  }

  // Pass 3: Sequence anomaly detection
  // If we see 5.01 → 6.01 → 5.02, the 6.01 is a false split (cross-reference).
  // Detect: a heading that jumps to a different article and then the next heading
  // returns to the previous article's sequence.
  const headings = [];
  for (let i = 0; i < rawHeadings.length; i++) {
    const curr = rawHeadings[i];
    const prev = i > 0 ? rawHeadings[i - 1] : null;
    const next = i + 1 < rawHeadings.length ? rawHeadings[i + 1] : null;

    if (prev && next) {
      const jumpedAway = curr._art !== prev._art && curr._art !== next._art;
      const nextResumes = next._art === prev._art;
      if (jumpedAway && nextResumes) {
        // This heading jumps to a different article and the sequence resumes after
        // it — it's almost certainly a cross-reference, not a real heading
        continue; // skip it
      }
    }
    headings.push(curr);
  }

  // Step 3: Build sections by splitting between consecutive headings
  const sections = [];
  for (let i = 0; i < headings.length; i++) {
    const start = headings[i].index;
    const end = i + 1 < headings.length ? headings[i + 1].index : body.length;
    const rawSectionText = body.substring(start, end).trim();
    if (rawSectionText.length < 20) continue;

    const text = cleanSectionText(rawSectionText);
    const headingLine = text.split('\n')[0].substring(0, 200).trim();
    let title = extractTitle(headingLine);

    // Use TOC title if available — more reliable than parsing from body text
    const tocTitle = tocTitles[headings[i].number];
    if (tocTitle) title = tocTitle;

    sections.push({
      number: headings[i].number,
      heading: headingLine,
      title: title || headingLine,
      text,
      charCount: text.length,
      absStart: headings[i].absIndex,
      tocTitle: tocTitle || null, // include for diagnostics
    });
  }

  // Step 3b: Auto-split definitions sections
  let definitionTerms = 0;
  const defTermPattern = /\n\s*\u201c([^\u201d]+)\u201d\s+(?:means?|shall\s+mean|has\s+the\s+meaning|shall\s+have\s+the\s+meaning)/;
  const defTermPatternGlobal = /\n\s*\u201c([^\u201d]+)\u201d\s+(?:means?|shall\s+mean|has\s+the\s+meaning|shall\s+have\s+the\s+meaning)/g;
  // Also try straight quotes
  const defTermPatternStraight = /\n\s*"([^"]+)"\s+(?:means?|shall\s+mean|has\s+the\s+meaning|shall\s+have\s+the\s+meaning)/;
  const defTermPatternStraightGlobal = /\n\s*"([^"]+)"\s+(?:means?|shall\s+mean|has\s+the\s+meaning|shall\s+have\s+the\s+meaning)/g;

  for (let si = 0; si < sections.length; si++) {
    const sec = sections[si];
    if (!/definition/i.test(sec.title)) continue;

    // Try curly quotes first, then straight quotes
    let usePattern = defTermPatternGlobal;
    let testMatch = sec.text.match(defTermPattern);
    if (!testMatch) {
      usePattern = defTermPatternStraightGlobal;
      testMatch = sec.text.match(defTermPatternStraight);
    }
    if (!testMatch) continue;

    // Find all defined term boundaries
    usePattern.lastIndex = 0;
    const termMatches = [];
    let tm;
    while ((tm = usePattern.exec(sec.text)) !== null) {
      termMatches.push({ index: tm.index + 1, term: tm[1] }); // +1 to skip the leading \n
    }

    if (termMatches.length < 3) continue; // not worth splitting for very few terms

    const subSections = [];

    // Preamble: text before the first defined term
    if (termMatches[0].index > 0) {
      const preambleText = sec.text.substring(0, termMatches[0].index).trim();
      if (preambleText.length > 20) {
        subSections.push({
          number: sec.number,
          heading: sec.heading,
          title: sec.title + ' (Preamble)',
          text: preambleText,
          charCount: preambleText.length,
          absStart: sec.absStart,
          isDefinition: true,
          subKey: '_preamble',
        });
      }
    }

    // Each defined term
    for (let ti = 0; ti < termMatches.length; ti++) {
      const start = termMatches[ti].index;
      const end = ti + 1 < termMatches.length ? termMatches[ti + 1].index : sec.text.length;
      const termText = sec.text.substring(start, end).trim();

      subSections.push({
        number: sec.number,
        heading: sec.heading,
        title: termMatches[ti].term,
        text: termText,
        charCount: termText.length,
        absStart: sec.absStart + start,
        isDefinition: true,
        subKey: termMatches[ti].term,
      });
    }

    definitionTerms += termMatches.length;

    // Replace the single definitions section with the sub-sections
    sections.splice(si, 1, ...subSections);
    si += subSections.length - 1; // adjust index
  }

  // Step 4: Find ARTICLE boundaries for context
  const articleRe = /\bARTICLE\s+(?:([IVXLC]+)|(\d+))\b([^\n]*)/gi;
  const articles = [];
  while ((m = articleRe.exec(body)) !== null) {
    if (isHeading(body, m.index)) {
      const roman = m[1];
      const arabic = m[2];
      const num = arabic ? parseInt(arabic) : romanToInt(roman);
      articles.push({
        number: num,
        heading: m[0].trim(),
        title: (m[3] || '').replace(/^[\s.\-\u2014:;]+/, '').trim(),
        absIndex: bodyStart + m.index,
      });
    }
  }

  // Associate sections with their parent article
  for (const section of sections) {
    const sectionArt = parseInt(section.number.split('.')[0]);
    const article = articles.find(a => a.number === sectionArt);
    if (article) {
      section.articleNumber = article.number;
      section.articleHeading = article.heading;
      section.articleTitle = article.title;
    }
  }

  // Step 5: Gap detection
  const gaps = detectGaps(sections);

  // Step 6: Cross-reference with TOC
  const tocComparison = {
    found: toc.found,
    totalEntries: toc.entries.length,
    matched: 0,
    missing: [],
    extra: [],
  };

  if (toc.found && toc.entries.length > 0) {
    const foundNumbers = new Set(sections.map(s => s.number));
    const tocSet = new Set(toc.entries);
    for (const entry of toc.entries) {
      if (foundNumbers.has(entry)) {
        tocComparison.matched++;
      } else {
        tocComparison.missing.push(entry);
      }
    }
    for (const s of sections) {
      if (!tocSet.has(s.number)) {
        tocComparison.extra.push(s.number);
      }
    }
  }

  return {
    sections,
    articles,
    toc: tocComparison,
    gaps,
    diagnostics: {
      totalChars: rawText.length,
      cleanedChars: charsRemoved,
      bodyStart,
      bodyEnd,
      bodyChars: bodyEnd - bodyStart,
      truncatedChars,
      sectionCount: sections.length,
      articleCount: articles.length,
      definitionTerms,
    },
  };
}

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { full_text } = req.body;
  if (!full_text) return res.status(400).json({ error: 'full_text is required' });

  try {
    const result = parseDocument(full_text);
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
