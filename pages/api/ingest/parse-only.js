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
// Detects Table of Contents by finding lines with "Section X.XX" that end
// with a page number (preceded by leader dots or multiple spaces).
// If 5+ such lines cluster together in the first half of the doc, that's a TOC.

function detectTOC(fullText) {
  // Find ALL "Section X.XX" occurrences
  const sectionRe = /(?:SECTION|Section)\s+(\d+\.\d{1,2})\b/g;
  const allMatches = [];
  let m;
  while ((m = sectionRe.exec(fullText)) !== null) {
    allMatches.push({
      index: m.index,
      endIndex: m.index + m[0].length,
      number: m[1],
    });
  }

  if (allMatches.length < 8) {
    // Not enough matches to have both TOC + body
    return { found: false, entries: [], bodyStart: findBodyStartFallback(fullText) };
  }

  // For each match, check if its line ends with a page number
  // TOC lines: "Section 1.01   Definitions.......................3"
  // Body lines: "Section 1.01   Definitions. As used in this Agreement..."
  const tocFlags = allMatches.map(match => {
    const lineEnd = fullText.indexOf('\n', match.index);
    const line = fullText.substring(match.index, lineEnd === -1 ? fullText.length : lineEnd);
    // Ends with: dots or whitespace gap then 1-4 digit number
    // Lenient: 2+ dots or 2+ whitespace chars (EDGAR can produce irregular spacing)
    return /(?:\.{2,}|[\s\t]{2,})\d{1,4}\s*$/.test(line);
  });

  // Find the first cluster of TOC-flagged lines
  // A cluster = consecutive matches where most are TOC-flagged
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
      // Allow small gaps (1-2 non-TOC lines within a TOC block, e.g. ARTICLE headers)
      if (runCount > 0 && i - runStart - runCount <= 2) {
        continue; // keep the run going
      }
      runStart = -1;
      runCount = 0;
    }
  }
  // Check final run
  if (runCount >= 5 && tocStart === -1) {
    tocStart = runStart;
    tocEnd = allMatches.length - 1;
    // But make sure there are body sections after this — otherwise it's all body
    // A real TOC must be followed by body sections
    if (tocEnd === allMatches.length - 1) {
      // All matches are TOC? That can't be right. Only treat first portion as TOC.
      // Find where the TOC cluster really ends by looking at the flags
      for (let i = runStart; i < tocFlags.length; i++) {
        if (!tocFlags[i] && i > runStart + 4) {
          tocEnd = i - 1;
          break;
        }
      }
    }
  }

  if (tocStart === -1 || tocEnd === -1) {
    return { found: false, entries: [], bodyStart: findBodyStartFallback(fullText) };
  }

  // Validate: TOC should be in the first 40% of the document
  if (allMatches[tocStart].index > fullText.length * 0.4) {
    return { found: false, entries: [], bodyStart: findBodyStartFallback(fullText) };
  }

  // Extract TOC entries (unique section numbers)
  const entries = [];
  const seen = new Set();
  for (let i = tocStart; i <= tocEnd; i++) {
    if (!seen.has(allMatches[i].number)) {
      entries.push(allMatches[i].number);
      seen.add(allMatches[i].number);
    }
  }

  // Body starts after the last TOC entry's line
  const lastTocMatch = allMatches[tocEnd];
  const lastTocLineEnd = fullText.indexOf('\n', lastTocMatch.index);
  let bodyStart = lastTocLineEnd !== -1 ? lastTocLineEnd + 1 : lastTocMatch.endIndex;

  // Skip blank lines and look for first real content after TOC
  const afterToc = fullText.substring(bodyStart);

  // Look for ARTICLE heading, preamble, or first Section heading
  const artMatch = afterToc.match(/^\s*ARTICLE\s+(?:[IVXLC]+|\d+)\b/im);
  const preambleMatch = afterToc.match(/(^|\n)\s*(This\s+Agreement|AGREEMENT\s+AND\s+PLAN)/i);
  const firstSection = afterToc.match(/(^|\n)\s*(?:SECTION|Section)\s+\d+\.\d{1,2}\b/);

  // Use whichever comes first
  const candidates = [];
  if (artMatch) candidates.push(artMatch.index);
  if (preambleMatch) candidates.push(preambleMatch.index);
  if (firstSection) candidates.push(firstSection.index);

  if (candidates.length > 0) {
    bodyStart += Math.min(...candidates);
  }

  return { found: true, entries, bodyStart };
}

function findBodyStartFallback(fullText) {
  // Try explicit "TABLE OF CONTENTS" header
  const tocHeader = fullText.match(/TABLE\s+OF\s+CONTENTS/i);
  if (tocHeader) {
    const afterToc = fullText.substring(tocHeader.index);
    const artMatch = afterToc.match(/\n\s*ARTICLE\s+(?:[IVXLC]+|\d+)\b/i);
    if (artMatch) return tocHeader.index + artMatch.index + 1;
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
// starts by searching for the first ARTICLE or Section heading.
function findBodyStartInCleanedText(cleanedText, tocEntries) {
  if (!tocEntries || tocEntries.length === 0) return 0;

  // Strategy: find the first "Section X.XX" or "ARTICLE" that appears as a
  // real heading (not a TOC line). A TOC line ends with dots+pagenum; a body
  // heading is followed by substantive text.
  const sectionRe = /(?:SECTION|Section)\s+(\d+\.\d{1,2})\b/g;
  const tocSet = new Set(tocEntries);
  let m;
  while ((m = sectionRe.exec(cleanedText)) !== null) {
    if (!tocSet.has(m[1])) continue;
    // Check if this line looks like a TOC line (ends with dots + page number)
    const lineEnd = cleanedText.indexOf('\n', m.index);
    const line = cleanedText.substring(m.index, lineEnd === -1 ? cleanedText.length : lineEnd);
    if (/(?:\.{2,}|[\s\t]{2,})\d{1,4}\s*$/.test(line)) continue; // TOC line, skip

    // This is a body heading — find start of its line or preceding ARTICLE
    const before = cleanedText.substring(Math.max(0, m.index - 200), m.index);
    const artMatch = before.match(/\n\s*(ARTICLE\s+(?:[IVXLC]+|\d+)\b[^\n]*)\s*$/i);
    if (artMatch) {
      return m.index - (before.length - before.lastIndexOf('\n')) + 1;
    }
    // Start at beginning of this heading's line
    const lineStart = cleanedText.lastIndexOf('\n', m.index);
    return lineStart === -1 ? 0 : lineStart + 1;
  }

  // Fallback: look for first ARTICLE heading
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
  const headings = [];
  let lastArticle = -1;
  let lastSection = -1;
  for (const c of candidates) {
    const parts = c.number.match(/(\d+)\.(\d{1,2})/);
    if (!parts) continue;
    const art = parseInt(parts[1], 10);
    const sec = parseInt(parts[2], 10);

    const isFirstCandidate = headings.length === 0;

    // If TOC exists, use it as primary validator
    if (tocSet) {
      const inToc = tocSet.has(c.number);
      // Accept: it's in the TOC (it's a real section heading)
      if (inToc) {
        headings.push(c);
        lastArticle = art;
        lastSection = sec;
        continue;
      }
      // Not in TOC — only accept if sequential (could be a subsection not listed in TOC)
      const isNextInArticle = art === lastArticle && sec === lastSection + 1;
      const isNewArticle = art > lastArticle;
      if (isFirstCandidate || isNextInArticle || isNewArticle) {
        headings.push(c);
        lastArticle = art;
        lastSection = sec;
      }
      // else: not in TOC and breaks sequence → cross-reference, skip
      continue;
    }

    // No TOC — fall back to sequential + context validation
    const isNextInArticle = art === lastArticle && sec === lastSection + 1;
    const isNewArticle = art > lastArticle;

    // Check character immediately before "Section" (ignoring whitespace)
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
      headings.push(c);
      lastArticle = art;
      lastSection = sec;
    }
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
    const title = extractTitle(headingLine);

    sections.push({
      number: headings[i].number,
      heading: headingLine,
      title: title || headingLine,
      text,
      charCount: text.length,
      absStart: headings[i].absIndex,
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
