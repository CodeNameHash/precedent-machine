/* ───────────────────────────────────────────────────────────────────────────
   lib/parser-v2/notice-advisors.js — deterministic extraction of outside
   counsel (firm + lawyers, per SIDE) from a deal's NOTICES provision
   (type MISC, code MISC-NOTICES).

   A notices section lists, per party, a notice block:

     if to Parent or Merger Sub, to:
       <Party legal entity>
       <address>
       Attention: <officer>
     with a copy (which shall not constitute notice) to:
       <Law Firm LLP>
       <address>
       Attention: <lawyer>; <lawyer>

   Extraction strategy (pure, no LLM):
     1. Split the text into party blocks at "if to <designation> ... :".
     2. Attribute each block to buyer/seller by (in priority order):
        (a) matching the designation against the deal's known party names
            (acquirer / parent_entity / acquirer_display vs target /
            target_entity / target_display) — handles defined-term headers
            like "if to Marriott, ... Merger Sub" where BOTH sides' headers
            mention "Merger Sub";
        (b) matching the block's first address line against party names —
            handles codename headers ("if to Maverick, to: Mr. Cooper
            Group Inc. ...");
        (c) generic keywords (parent/buyer/purchaser/merger sub vs
            company/target/seller);
        (d) if exactly two blocks and one side resolved, the other block
            takes the opposite side.
     3. Within each block, locate law-firm lines (canonical-firm alias hit,
        or a generic "... LLP" line) — skipping internal "copy to" blocks
        that name the party itself — and capture the "Attention:" names
        that follow each firm, up to the next firm / next party block.

   Output is RAW verbatim capture; canonicalization happens at read time in
   lib/canonical-advisors.js. CommonJS.
   ─────────────────────────────────────────────────────────────────────── */

const { decodeNumericEntities } = require('../html-entities');
const { FIRM_CANON } = require('../canonical-advisors');

// ── Text normalization ──────────────────────────────────────────────────────
const NAMED_ENTITIES = {
  '&nbsp;': ' ', '&emsp;': ' ', '&ensp;': ' ', '&thinsp;': ' ',
  '&amp;': '&', '&sect;': '§', '&mdash;': '—', '&ndash;': '–',
  '&ldquo;': '“', '&rdquo;': '”', '&lsquo;': '‘', '&rsquo;': '’',
};

function normalizeText(text) {
  let s = String(text || '').replace(/\r\n?/g, '\n');
  s = decodeNumericEntities(s);
  s = s.replace(/&[a-z]+;/gi, (m) => (m in NAMED_ENTITIES ? NAMED_ENTITIES[m.toLowerCase()] : m));
  return s;
}

// ── Party-name matching ──────────────────────────────────────────────────────
const GENERIC_NAME_TOKENS = new Set([
  'inc', 'corp', 'corporation', 'company', 'companies', 'co', 'llc', 'lp',
  'llp', 'plc', 'ltd', 'limited', 'holdings', 'holding', 'group', 'the',
  'and', 'of', 'sa', 'ag', 'nv', 'usa',
]);

function normName(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function distinctiveTokens(name) {
  return normName(name)
    .split(' ')
    .filter((t) => t.length >= 3 && !GENERIC_NAME_TOKENS.has(t));
}

/* Score how strongly `text` refers to any of `names`. Full normalized-name
   containment scores high; distinctive-token hits score low. */
function nameMatchScore(text, names) {
  const hay = ' ' + normName(text) + ' ';
  if (hay.trim() === '') return 0;
  let score = 0;
  for (const name of names) {
    const n = normName(name);
    if (n && n.length >= 4 && hay.includes(' ' + n + ' ')) score += 10;
    for (const tok of distinctiveTokens(name)) {
      if (hay.includes(' ' + tok + ' ')) score += 1;
    }
  }
  return score;
}

const BUYER_KEYWORD_RE = /\b(?:parent|buyer|purchaser|acquiror|acquirer|guarantor|merger\s+sub(?:sidiar(?:y|ies))?|holdco|bidco)\b/i;
const SELLER_KEYWORD_RE = /\b(?:company|target|seller)\b/i;

/**
 * buildDealNames(deal) → { buyer: [...], seller: [...] } — the known names
 * for each side, from the deals row + metadata (parent_entity /
 * acquirer_display / target_entity / target_display).
 */
function buildDealNames(deal) {
  const meta = (deal && deal.metadata && typeof deal.metadata === 'object') ? deal.metadata : {};
  const buyer = [deal && deal.acquirer, meta.parent_entity, meta.acquirer_display].filter(Boolean);
  const seller = [deal && deal.target, meta.target_entity, meta.target_display].filter(Boolean);
  return { buyer, seller };
}

// ── Block segmentation ──────────────────────────────────────────────────────
const HEADER_RE = /\bif\s+to\s+([^:]{1,200}?)[,\s]*(?:\bto\s*)?:/gi;

function splitBlocks(text) {
  const headers = [];
  let m;
  const re = new RegExp(HEADER_RE.source, HEADER_RE.flags);
  while ((m = re.exec(text)) !== null) {
    headers.push({ designation: m[1].replace(/\s+/g, ' ').trim(), start: m.index, bodyStart: m.index + m[0].length });
  }
  return headers.map((h, i) => ({
    designation: h.designation,
    body: text.slice(h.bodyStart, i + 1 < headers.length ? headers[i + 1].start : text.length),
  }));
}

// ── Firm-candidate detection within a block ─────────────────────────────────
// A line "looks like a law firm" when it hits a canonical alias, or ends in
// LLP/L.L.P. with a name-like prefix. Party-entity lines (internal copies
// like "Eli Lilly and Company") are excluded by the caller via party names.
const GENERIC_LLP_RE = /\b(?:LLP|L\.L\.P\.?)\b/;

/* Capture the verbatim firm name around a hit inside `line`: from the hit
   start through the trailing LLP if present, else to the first address-ish
   token / end of line. Sanofi-style one-line blocks ("Paul, Weiss, ... LLP
   1285 Avenue of the Americas ... Attention: ...") are cut at "LLP". */
function captureFirmRaw(line, hitStart) {
  const rest = line.slice(hitStart);
  const llp = rest.match(/^(.{0,120}?\bL\.?L\.?P\.?)(?=[\s,.]|$)/);
  if (llp) return llp[1].replace(/\s+/g, ' ').trim();
  // No LLP: cut at first digit / address / contact cue.
  const cut = rest.search(/\d|\b(?:Attention|Attn|Email|E-mail|Fax|Facsimile|Telephone|Tel)\b/);
  const raw = (cut >= 0 ? rest.slice(0, cut) : rest).replace(/\s+/g, ' ').trim();
  return raw.replace(/[,;:\s]+$/, '');
}

// Email / URL lines ("Email: sbarshay@paulweiss.com", "wlrk.com") would
// otherwise hit the firm alias regexes — never treat them as firm lines.
const CONTACT_LINE_RE = /@|\.(?:com|net|org|law)\b/i;

function findFirmCandidates(blockText, partyNames) {
  // Build LOGICAL lines: a firm name wrapped across physical lines
  // ("Paul, Weiss,\nRifkind, Wharton & Garrison LLP") is joined when a line
  // ends with a comma or ampersand. Track [start, end) offsets into
  // blockText so lawyer-capture windows can be sliced from the original.
  const physical = [];
  let offset = 0;
  for (const line of blockText.split('\n')) {
    physical.push({ line, start: offset, end: offset + line.length });
    offset += line.length + 1;
  }
  const logical = [];
  for (let i = 0; i < physical.length; i++) {
    const p = physical[i];
    if (!p.line.trim()) continue;
    const last = logical[logical.length - 1];
    if (last && /[,&]\s*$/.test(last.text) && !CONTACT_LINE_RE.test(p.line)) {
      last.text = last.text.replace(/\s+$/, '') + ' ' + p.line.trim();
      last.end = p.end;
      last.joined = true;
      continue;
    }
    logical.push({ text: p.line, start: p.start, end: p.end, joined: false });
  }

  const candidates = [];
  for (const { text: line, start: lineStart, end: lineEnd, joined } of logical) {
    if (/\bc\/o\b/i.test(line)) continue; // "Beach Acquisition Co Parent, LLC c/o 3G Capital Inc."
    let hitStart = -1;
    for (const f of FIRM_CANON) {
      const m = line.match(f.re);
      if (m && (hitStart < 0 || m.index < hitStart)) hitStart = m.index;
    }
    if (hitStart < 0 && GENERIC_LLP_RE.test(line)) {
      // Generic LLP line — firm starts at the first capitalized word.
      const m = line.match(/[A-Z]/);
      if (m) hitStart = m.index;
    }
    if (hitStart < 0) continue;
    const firmRaw = captureFirmRaw(line, hitStart);
    if (!firmRaw || firmRaw.length < 4) continue;
    // Alias hit inside an email/URL ("sbarshay@paulweiss.com") is not a firm
    // line. NOTE: this must be a candidate-level check, not a line-level
    // skip — Sanofi-style one-line blocks put the real firm name AND the
    // contact emails on the same physical line.
    if (CONTACT_LINE_RE.test(firmRaw)) continue;
    // Exclude the deal parties themselves (internal "copy to" blocks).
    if (nameMatchScore(firmRaw, partyNames) > 0) continue;
    // Window for lawyer capture starts right after the firm name. For a
    // single physical line the offset math is exact — this keeps an inline
    // "Attention: ..." on the SAME line (Sanofi one-line blocks) inside the
    // window. For joined (wrapped) firm lines the offsets shifted, so fall
    // back to the end of the joined group. Different offices of the same
    // firm (Jones Day x2) stay separate candidates and are merged in
    // parseBlock.
    const end = joined ? lineEnd : Math.min(lineStart + hitStart + firmRaw.length, lineEnd);
    candidates.push({ firmRaw, start: lineStart + hitStart, end });
  }
  return candidates;
}

// ── Attention-name capture ──────────────────────────────────────────────────
const TITLE_WORD_RE = /\b(?:counsel|officer|office|president|secretary|director|general|chief|vice|senior|executive|department|attention|corporate|business|development|committee|group|manager|head|legal|associate|americas|transactions?|affairs|avenue|street|drive|road|floor|suite|boulevard|plaza|tower|center|centre)\b/i;
const STOP_LINE_RE = /@|\d|\b(?:e-?mail|fax|facsimile|telephone|phone|tel)\b\s*(?:no\.?)?\s*[:.]?|\bif\s+to\b|\bcop(?:y|ies)\b|^\s*\(|\band\s+to\s*:|\bor\s+such\s+other\b/i;

function cleanNameFragment(frag) {
  let s = String(frag || '').replace(/\s+/g, ' ').trim();
  s = s.replace(/^[\s,;:–—-]+/, '').replace(/[\s,;:]+$/, '');
  s = s.replace(/\s+and$/i, '');
  // Strip trailing credentials: ", P.C." / ", Esq."
  s = s.replace(/[,;\s]*(?:esq\.?|p\.?\s?c\.?)\s*$/i, '').replace(/[,;\s]+$/, '');
  // "Andrew Ashe, COO & General Counsel" → keep the name, drop the title tail.
  const comma = s.split(',');
  if (comma.length > 1 && TITLE_WORD_RE.test(comma.slice(1).join(','))) {
    s = comma[0].trim();
  }
  return s;
}

function looksLikePersonName(s) {
  if (!s) return false;
  if (TITLE_WORD_RE.test(s)) return false;
  if (/[\d@*\[\]]/.test(s)) return false;
  // Allow generational suffix after stripping.
  const core = s.replace(/,?\s+(?:Jr\.?|Sr\.?|II|III|IV)$/i, '');
  const tokens = core.split(/\s+/);
  if (tokens.length < 2 || tokens.length > 5) return false;
  const particleOk = (t) => /^(?:van|von|de|der|da|di|la|le|del)$/i.test(t);
  for (const t of tokens) {
    if (particleOk(t)) continue;
    if (!/^[A-Z][A-Za-z'’.-]*$/.test(t)) return false;
  }
  // Last token must be a real surname (≥2 letters), not a dangling initial.
  const last = tokens[tokens.length - 1];
  if (/^[A-Z]\.?$/.test(last)) return false;
  return true;
}

/* Split an inline run ("Scott A. Barshay and Jeffrey D. Marell", "A; B; C")
   into individual candidate names. */
function splitNameRun(run) {
  return String(run || '')
    .split(/;|\n|\s+\band\b\s+/i)
    .map(cleanNameFragment)
    .filter(Boolean);
}

/**
 * extractAttentionNames(windowText) — all person names introduced by
 * "Attention:" cues within the window. Handles inline lists (";", "and"),
 * one-name-per-line lists (blank lines between), and names wrapped across
 * lines ("Steven J.\nWilliams").
 */
function extractAttentionNames(windowText) {
  const names = [];
  const cueRe = /(?:attention|attn)\s*[:.]?\s*/gi;
  let m;
  while ((m = cueRe.exec(windowText)) !== null) {
    const after = windowText.slice(m.index + m[0].length);
    const lines = after.split('\n');
    let pending = null; // possible wrapped name ("Steven J.")
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      if (!line) continue;
      // Inline stop tokens: cut the line at the first stop cue, keep the prefix.
      const stop = line.search(STOP_LINE_RE);
      let isLast = false;
      if (stop === 0) {
        // Whole line is a stop — flush pending and end this cue's capture.
        if (pending) { pending = null; }
        break;
      } else if (stop > 0) {
        line = line.slice(0, stop).trim();
        isLast = true;
      }
      const frags = splitNameRun(line);
      for (let j = 0; j < frags.length; j++) {
        let frag = frags[j];
        if (pending) {
          const joined = cleanNameFragment(pending + ' ' + frag);
          if (looksLikePersonName(joined)) {
            names.push(joined);
            pending = null;
            continue;
          }
          pending = null;
        }
        if (looksLikePersonName(frag)) {
          names.push(frag);
        } else if (/\b[A-Z]\.$/.test(frag) && /^[A-Z]/.test(frag) && !TITLE_WORD_RE.test(frag)) {
          // Ends with an initial — likely a name wrapped onto the next line.
          pending = frag;
        } else if (names.length > 0 || pending) {
          // Non-name after we started collecting → stop this cue.
          pending = null;
          isLast = true;
          break;
        } else {
          // Non-name immediately after the cue ("General Counsel") → give up
          // on this cue entirely.
          isLast = true;
          break;
        }
      }
      if (isLast) break;
    }
  }
  // Dedupe exact repeats (normalized).
  const seen = new Set();
  return names.filter((n) => {
    const k = n.toLowerCase().replace(/\s+/g, ' ');
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ── Per-block parse ─────────────────────────────────────────────────────────
function firstNonEmptyLines(blockText, n) {
  const out = [];
  for (const line of blockText.split('\n')) {
    const t = line.trim();
    if (t) out.push(t);
    if (out.length >= n) break;
  }
  return out;
}

function parseBlock(block, dealNames) {
  const allPartyNames = [...dealNames.buyer, ...dealNames.seller];
  const candidates = findFirmCandidates(block.body, allPartyNames);
  const firms = [];
  for (let i = 0; i < candidates.length; i++) {
    const cand = candidates[i];
    const windowEnd = i + 1 < candidates.length ? candidates[i + 1].start : block.body.length;
    const windowText = block.body.slice(cand.end, windowEnd);
    const lawyers = extractAttentionNames(windowText);
    // Merge with an earlier segment for the same firm string (second office
    // of the same firm — e.g. Jones Day New York + Cleveland).
    const existing = firms.find((f) => f.firm_raw.toLowerCase() === cand.firmRaw.toLowerCase());
    if (existing) {
      for (const l of lawyers) if (!existing.lawyers.includes(l)) existing.lawyers.push(l);
    } else {
      firms.push({ firm_raw: cand.firmRaw, lawyers });
    }
  }
  return {
    designation: block.designation,
    entity_line: firstNonEmptyLines(block.body, 1)[0] || null,
    firms,
  };
}

function resolveSides(blocks, dealNames) {
  const sides = blocks.map((b) => {
    // (a) designation vs party names
    const dB = nameMatchScore(b.designation, dealNames.buyer);
    const dS = nameMatchScore(b.designation, dealNames.seller);
    if (dB > dS) return 'buyer';
    if (dS > dB) return 'seller';
    // (b) block body's first lines vs party names
    const bodyHead = firstNonEmptyLines(b.body, 3).join(' ');
    const bB = nameMatchScore(bodyHead, dealNames.buyer);
    const bS = nameMatchScore(bodyHead, dealNames.seller);
    if (bB > bS) return 'buyer';
    if (bS > bB) return 'seller';
    // (c) generic keywords in the designation
    const kB = BUYER_KEYWORD_RE.test(b.designation);
    const kS = SELLER_KEYWORD_RE.test(b.designation);
    if (kB && !kS) return 'buyer';
    if (kS && !kB) return 'seller';
    return null;
  });
  // (d) two blocks, one resolved → other side is the opposite.
  if (blocks.length === 2) {
    if (sides[0] && !sides[1]) sides[1] = sides[0] === 'buyer' ? 'seller' : 'buyer';
    if (sides[1] && !sides[0]) sides[0] = sides[1] === 'buyer' ? 'seller' : 'buyer';
  }
  return sides;
}

/**
 * extractNoticeAdvisors(noticeText, dealNames) → { blocks: [...] }
 * dealNames = { buyer: [names], seller: [names] } (see buildDealNames).
 * Each block: { side: 'buyer'|'seller'|null, designation, entity_line,
 *               firms: [{ firm_raw, lawyers: [raw names] }] }.
 */
function extractNoticeAdvisors(noticeText, dealNames) {
  const text = normalizeText(noticeText);
  const rawBlocks = splitBlocks(text);
  const parsed = rawBlocks.map((b) => ({ ...parseBlock(b, dealNames), body: b.body }));
  const sides = resolveSides(rawBlocks, dealNames);
  return {
    blocks: parsed.map((p, i) => ({
      side: sides[i],
      designation: p.designation,
      entity_line: p.entity_line,
      firms: p.firms,
    })),
  };
}

/**
 * buildAdvisorsV2(noticeProvisions, deal) → advisors_v2 object or null.
 * noticeProvisions: [{ id, full_text }] — the deal's MISC-NOTICES provisions.
 * Picks the provision that yields the most firm attributions.
 *
 * Shape: { buyer_firm, buyer_lawyers, seller_firm, seller_lawyers,
 *          buyer_firms, seller_firms, raw } — all RAW verbatim strings;
 *          canonicalize at read time via lib/canonical-advisors.js.
 */
function buildAdvisorsV2(noticeProvisions, deal) {
  const dealNames = buildDealNames(deal);
  let best = null;
  let bestScore = -1;
  for (const p of noticeProvisions || []) {
    const text = p && p.full_text ? p.full_text : '';
    if (!/if\s+to/i.test(text)) continue;
    const result = extractNoticeAdvisors(text, dealNames);
    const score = result.blocks.reduce(
      (acc, b) => acc + (b.side ? 1 : 0) + b.firms.length + b.firms.reduce((a, f) => a + f.lawyers.length, 0),
      0
    );
    if (score > bestScore) {
      bestScore = score;
      best = { provisionId: p.id, result };
    }
  }
  if (!best) return null;

  const sideAgg = { buyer: { firms: [], lawyers: [] }, seller: { firms: [], lawyers: [] } };
  for (const block of best.result.blocks) {
    if (!block.side) continue;
    for (const f of block.firms) {
      sideAgg[block.side].firms.push(f.firm_raw);
      sideAgg[block.side].lawyers.push(...f.lawyers);
    }
  }
  return {
    buyer_firm: sideAgg.buyer.firms[0] || null,
    buyer_lawyers: sideAgg.buyer.lawyers,
    seller_firm: sideAgg.seller.firms[0] || null,
    seller_lawyers: sideAgg.seller.lawyers,
    buyer_firms: sideAgg.buyer.firms,
    seller_firms: sideAgg.seller.firms,
    raw: {
      source_provision_id: best.provisionId,
      blocks: best.result.blocks,
    },
  };
}

module.exports = {
  extractNoticeAdvisors,
  buildAdvisorsV2,
  buildDealNames,
  // exposed for tests
  normalizeText,
  splitBlocks,
  extractAttentionNames,
  looksLikePersonName,
  nameMatchScore,
};
