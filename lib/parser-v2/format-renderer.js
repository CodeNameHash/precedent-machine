/**
 * format-renderer.js — convert the marker-laden full_text stored in the DB
 * into a structured token stream the UI can render.
 *
 * Markers (produced by structural.js > displayCleanText > applyFormattingMarkers):
 *   [[ARTICLE]] ARTICLE VII [[/ARTICLE]]
 *   [[ARTICLE_TITLE]] Title [[/ARTICLE_TITLE]]
 *   [[SECTION]] SECTION 7.01. [[/SECTION]]
 *   [[SECTION_TITLE]] Title [[/SECTION_TITLE]]
 *   [[REF]] Section 7.01(a) [[/REF]]
 *   [[DEFINED]] "Term" [[/DEFINED]]
 *   [[CENTER]] HEADING [[/CENTER]]
 *   [[TOC_START]] ... [[/TOC_START]]
 *   [[TOC_ARTICLE]] ARTICLE I -- title [[/TOC_ARTICLE]]
 *   [[TOC_ENTRY]] SECTION 1.01|Title|3 [[/TOC_ENTRY]]
 *
 * Two helpers are exported:
 *  - `parseFormattedDocument(text)` — returns an array of block tokens
 *      [{ type, ...payload, children? }]
 *  - `stripFormattingMarkers(text)` — returns plain text with all markers
 *      removed (so selection/search can ignore them).
 *
 * Both are pure functions; no React imports here, so it can run on the
 * server (e.g. for testing) and in the browser.
 */

const MARKER_NAMES = [
  'ARTICLE',
  'ARTICLE_TITLE',
  'SECTION',
  'SECTION_TITLE',
  'REF',
  'DEFINED',
  'CENTER',
  'TOC_ENTRY',
  'TOC_ARTICLE',
];

// Build a regex that finds any marker open or close
const MARKER_RE = new RegExp(
  `\\[\\[(\\/?)(${MARKER_NAMES.join('|')}|TOC_START)\\]\\]`,
  'g'
);

/**
 * Strip all marker brackets but leave the inner text intact.
 * Used when we want plain text from a marker-laden string (e.g. when the
 * user selects text in the UI).
 *
 * TOC entries are encoded with "num|title|page" — rewrite to readable form
 * so plain-text consumers (search, selection) see natural prose.
 */
function stripFormattingMarkers(text) {
  if (!text) return '';
  let out = text;
  // TOC entries: "[[TOC_ENTRY]]num|title|page[[/TOC_ENTRY]]" → "num. title ... page"
  out = out.replace(/\[\[TOC_ENTRY\]\]([^[]*?)\[\[\/TOC_ENTRY\]\]/g, (_m, inner) => {
    const parts = inner.split('|');
    const num = (parts[0] || '').trim();
    const title = (parts[1] || '').trim();
    const page = (parts[2] || '').trim();
    return `${num}. ${title}${page ? ' ... ' + page : ''}`;
  });
  // TOC article: "[[TOC_ARTICLE]]ARTICLE I -- The Merger[[/TOC_ARTICLE]]"
  out = out.replace(/\[\[TOC_ARTICLE\]\]([\s\S]*?)\[\[\/TOC_ARTICLE\]\]/g, '$1');
  // Drop any remaining open/close marker
  out = out.replace(/\[\[\/?[A-Z_]+\]\]/g, '');
  return out;
}

// Parse a single line/region's inline markers (REF / DEFINED) into inline tokens.
function parseInline(text) {
  if (!text) return [];
  const tokens = [];
  const re = /\[\[(REF|DEFINED)\]\]([\s\S]*?)\[\[\/\1\]\]/g;
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) tokens.push({ type: 'text', text: text.substring(last, m.index) });
    tokens.push({ type: m[1].toLowerCase(), text: m[2] });
    last = m.index + m[0].length;
  }
  if (last < text.length) tokens.push({ type: 'text', text: text.substring(last) });
  return tokens;
}

/**
 * Parse the full marker-laden document into a tree of blocks.
 * Returns an array of block tokens. Each block has a `type` and either
 * `inline` (array of inline tokens) or `children` (array of blocks).
 */
function parseFormattedDocument(text) {
  if (!text) return [];

  // 1. Pull out the TOC region as one big block first.
  const tocStart = text.indexOf('[[TOC_START]]');
  const tocEnd = text.indexOf('[[/TOC_START]]');
  let head = '';
  let tocRaw = '';
  let body = '';
  if (tocStart >= 0 && tocEnd > tocStart) {
    head = text.substring(0, tocStart).trim();
    tocRaw = text.substring(tocStart + '[[TOC_START]]'.length, tocEnd).trim();
    body = text.substring(tocEnd + '[[/TOC_START]]'.length).trim();
  } else {
    body = text;
  }

  const blocks = [];

  if (head) blocks.push(...parseLinearBlocks(head));

  if (tocRaw) {
    blocks.push({ type: 'toc', children: parseTocBlocks(tocRaw) });
  }

  if (body) blocks.push(...parseLinearBlocks(body));

  return blocks;
}

function parseTocBlocks(tocText) {
  const out = [];
  const lines = tocText.split('\n');
  let pendingParas = [];

  const flushPara = () => {
    if (pendingParas.length === 0) return;
    const joined = pendingParas.join(' ').trim();
    if (joined) out.push({ type: 'toc_text', inline: parseInline(joined) });
    pendingParas = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) { flushPara(); continue; }

    // TABLE OF CONTENTS heading (may be wrapped in CENTER)
    const centerMatch = line.match(/^\[\[CENTER\]\](.*)\[\[\/CENTER\]\]$/);
    if (centerMatch) {
      flushPara();
      out.push({ type: 'toc_heading', text: centerMatch[1].trim() });
      continue;
    }
    if (/^TABLE\s+OF\s+CONTENTS$/i.test(line)) {
      flushPara();
      out.push({ type: 'toc_heading', text: line });
      continue;
    }

    // Article line in TOC
    const artMatch = line.match(/^\[\[TOC_ARTICLE\]\](.*)\[\[\/TOC_ARTICLE\]\]$/);
    if (artMatch) {
      flushPara();
      // article body may be "ARTICLE I -- The Merger"
      const parts = artMatch[1].split(/\s+--\s+/);
      out.push({
        type: 'toc_article',
        number: parts[0] || '',
        title: parts[1] || '',
      });
      continue;
    }

    // Section entry: "SECTION X.XX|Title|page"
    const secMatch = line.match(/^\[\[TOC_ENTRY\]\](.*?)\[\[\/TOC_ENTRY\]\]$/);
    if (secMatch) {
      flushPara();
      const parts = secMatch[1].split('|');
      out.push({
        type: 'toc_entry',
        number: (parts[0] || '').trim(),
        title: (parts[1] || '').trim(),
        page: (parts[2] || '').trim(),
      });
      continue;
    }

    // Otherwise accumulate as TOC narrative text (e.g. exhibits list)
    pendingParas.push(line);
  }
  flushPara();

  return out;
}

/**
 * Parse a marker-laden region (no TOC) into linear blocks. Articles and
 * sections become their own block types; everything else is a paragraph.
 */
function parseLinearBlocks(text) {
  const out = [];
  // Split into paragraphs on blank lines, but treat ARTICLE/SECTION/CENTER
  // markers as their own paragraph boundaries.
  const paragraphs = text.split(/\n\s*\n+/);

  for (const para of paragraphs) {
    if (!para.trim()) continue;
    appendParagraphBlocks(para, out);
  }

  // Post-process: pair ARTICLE block with following ARTICLE_TITLE paragraph if
  // they were split across blank lines.
  const folded = [];
  for (let i = 0; i < out.length; i++) {
    const b = out[i];
    if (
      b.type === 'article' &&
      !b.title &&
      i + 1 < out.length &&
      out[i + 1].type === 'article_title'
    ) {
      folded.push({ ...b, title: out[i + 1].text });
      i++; // skip title block
      continue;
    }
    folded.push(b);
  }
  return folded;
}

function appendParagraphBlocks(para, out) {
  const trimmed = para.trim();

  // ARTICLE heading (possibly followed by [[ARTICLE_TITLE]] inline)
  const artRe = /^\[\[ARTICLE\]\]([\s\S]*?)\[\[\/ARTICLE\]\]\s*(?:\n\s*\[\[ARTICLE_TITLE\]\]([\s\S]*?)\[\[\/ARTICLE_TITLE\]\])?/;
  const artMatch = trimmed.match(artRe);
  if (artMatch) {
    out.push({
      type: 'article',
      number: artMatch[1].trim(),
      title: (artMatch[2] || '').trim(),
    });
    const rest = trimmed.substring(artMatch[0].length).trim();
    if (rest) appendParagraphBlocks(rest, out);
    return;
  }

  // Standalone ARTICLE_TITLE paragraph (split from its ARTICLE by blank lines)
  const titleOnly = trimmed.match(/^\[\[ARTICLE_TITLE\]\]([\s\S]*?)\[\[\/ARTICLE_TITLE\]\]$/);
  if (titleOnly) {
    out.push({ type: 'article_title', text: titleOnly[1].trim() });
    return;
  }

  // CENTER heading only
  const centerOnly = trimmed.match(/^\[\[CENTER\]\]([\s\S]*?)\[\[\/CENTER\]\]$/);
  if (centerOnly) {
    out.push({ type: 'center', text: centerOnly[1].trim() });
    return;
  }

  // SECTION heading at start of paragraph
  const secStart = trimmed.match(/^\[\[SECTION\]\]([\s\S]*?)\[\[\/SECTION\]\]\s*(?:\[\[SECTION_TITLE\]\]([\s\S]*?)\[\[\/SECTION_TITLE\]\])?\.?\s*([\s\S]*)$/);
  if (secStart) {
    out.push({
      type: 'section',
      number: secStart[1].trim(),
      title: (secStart[2] || '').trim(),
      inline: parseInline((secStart[3] || '').trim()),
    });
    return;
  }

  // Fallback: a regular paragraph that may contain inline REF / DEFINED /
  // CENTER markers. CENTER appearing mid-paragraph is split out.
  // Detect any CENTER markers and split paragraph around them.
  const centerInline = /\[\[CENTER\]\]([\s\S]*?)\[\[\/CENTER\]\]/g;
  let last = 0;
  let m;
  let didCenter = false;
  while ((m = centerInline.exec(trimmed)) !== null) {
    didCenter = true;
    if (m.index > last) {
      const seg = trimmed.substring(last, m.index).trim();
      if (seg) out.push({ type: 'paragraph', inline: parseInline(seg) });
    }
    out.push({ type: 'center', text: m[1].trim() });
    last = m.index + m[0].length;
  }
  if (didCenter) {
    const tail = trimmed.substring(last).trim();
    if (tail) out.push({ type: 'paragraph', inline: parseInline(tail) });
    return;
  }

  out.push({ type: 'paragraph', inline: parseInline(trimmed) });
}

module.exports = {
  parseFormattedDocument,
  stripFormattingMarkers,
  parseInline,
};
