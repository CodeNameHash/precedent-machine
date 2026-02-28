export const config = {
  api: { bodyParser: { sizeLimit: '50mb' } },
};

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
    // Ends with: (3+ dots or 3+ spaces) then 1-4 digit number
    return /(?:\.{3,}|[\s\t]{3,})\d{1,4}\s*$/.test(line);
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

// ─── Main Parser ───
function parseDocument(fullText) {
  // Step 1: Detect and skip TOC
  const toc = detectTOC(fullText);
  const bodyStart = toc.bodyStart;
  const body = fullText.substring(bodyStart);

  // Step 2: Find all section headings in the body
  const sectionPattern = /(?:SECTION|Section)\s+(\d+\.\d{1,2})\b/g;
  const headings = [];
  let m;
  while ((m = sectionPattern.exec(body)) !== null) {
    if (isHeading(body, m.index)) {
      headings.push({
        index: m.index,
        absIndex: bodyStart + m.index,
        number: m[1],
        fullMatch: m[0],
      });
    }
  }

  // Fallback: try bare "X.XX Title" format if too few Section matches
  if (headings.length < 5) {
    const barePattern = /(?:^|\n)\s*(\d+\.\d{1,2})\s+[A-Z]/g;
    while ((m = barePattern.exec(body)) !== null) {
      const num = m[1];
      if (!headings.some(h => h.number === num && Math.abs(h.index - m.index) < 20)) {
        const offset = m[0].startsWith('\n') ? 1 : 0;
        headings.push({
          index: m.index + offset,
          absIndex: bodyStart + m.index + offset,
          number: num,
          fullMatch: m[0].trim(),
        });
      }
    }
    headings.sort((a, b) => a.index - b.index);
  }

  // Step 3: Build sections by splitting between consecutive headings
  const sections = [];
  for (let i = 0; i < headings.length; i++) {
    const start = headings[i].index;
    const end = i + 1 < headings.length ? headings[i + 1].index : body.length;
    const text = body.substring(start, end).trim();
    if (text.length < 20) continue;

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
      totalChars: fullText.length,
      bodyStart,
      bodyChars: fullText.length - bodyStart,
      sectionCount: sections.length,
      articleCount: articles.length,
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
