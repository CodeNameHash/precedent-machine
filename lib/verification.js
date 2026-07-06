/* ─────────────────────────────────────────────────────────────────────────
   lib/verification.js — the trust layer: quote verification + coverage.
   ───────────────────────────────────────────────────────────────────────────
   Two questions a legal-precedent tool must be able to answer about itself:

   1. QUOTE VERIFICATION — every citable feature stores model-emitted "verbatim"
      quotes ({ value, quotes: [...] }, legacy { value, text }, tagged
      { code, label, text }). Nothing has ever checked that those strings
      actually appear in the agreement. verifyDealQuotes() walks every
      provision's feature bag, extracts each quote, and fuzzy-matches it
      against the deal's source text (and the provision's own full_text).
      Unverified quotes are the hallucination surface — they get flagged, not
      trusted.

   2. COVERAGE — what fraction of the agreement's text is captured by SOME
      provision? computeCoverage() locates each provision's full_text inside
      the normalized source, merges the matched intervals, and reports the
      covered percentage plus the largest UNCOVERED gaps (with previews) so
      "what did we miss?" is a glance, not an audit.

   Matching is done in NORMALIZED space on both sides: strip the [[SECTION]]/
   [[REF]]/[[CENTER]]/«» pipeline markers, normalize smart quotes/dashes,
   collapse whitespace, lowercase. The model never reproduces markers and
   frequently normalizes punctuation, so raw indexOf would false-negative.

   CommonJS on purpose (same pattern as lib/search.js / lib/rubric.js) so both
   API routes and node --test can require it.
   ───────────────────────────────────────────────────────────────────────── */

// Strip pipeline markup + normalize typography + collapse whitespace.
// Quote marks and apostrophes are REMOVED (not normalized): the cleaning
// pipeline drops possessive apostrophes from the stored source ("Companys
// stock") while model quotes keep them, and definitions are stored unquoted
// ("Acquisition Proposal means") while the source quotes the term. Removing
// the characters on both sides makes those classes match without loosening
// anything meaningful.
function normalizeForMatch(s) {
  if (typeof s !== 'string') return '';
  return s
    .replace(/\[\[\/?[A-Za-z0-9_ -]+\]\]/g, ' ') // [[SECTION]] / [[/REF]] / [[CENTER]] …
    .replace(/\[\[\/?[A-Za-z0-9_ -]*$/g, ' ')
    // displayCleanText serializes marked section headings as
    // "Section 2.8|Title"; parser/extractor text uses "Section 2.8. Title".
    .replace(/\|/g, '. ')
    .replace(/[«»]/g, ' ')
    .replace(/[‘’‛'“”„"]/g, '')
    .replace(/[–—]/g, '-')
    // Line-break hyphenation: a hyphenated compound split across a line in the
    // source cleans to "covenants- not-to-sue" (hyphen + stray space) while the
    // model quotes it closed ("covenants-not-to-sue"). Rejoin an intra-word
    // hyphen-space (word char on both sides) so the two forms match. Leaves real
    // dash separators ("the closing - which") untouched (space before hyphen).
    .replace(/([a-zA-Z0-9])-\s+(?=[a-zA-Z0-9])/g, '$1-')
    // Mirror image: stray space BEFORE the hyphen ("Section 13.1 -721 of the
    // VSCA" in Kraft's filing) while the model quotes it closed ("13.1-721").
    // Real separators ("the closing - which") keep spaces on BOTH sides, so
    // requiring the hyphen to touch the next word char leaves them alone.
    .replace(/([a-zA-Z0-9])\s+-(?=[a-zA-Z0-9])/g, '$1-')
    // Quote-mark stripping in the source cleanup leaves a stray space just
    // inside an opening paren — '("LFRP")' stores as '( LFRP)' — and section
    // refs render with a gap between adjacent parens ("10.2(iii) (a)"). The
    // model quotes both closed. Pure typography: collapse on both sides.
    .replace(/([([])\s+/g, '$1')
    .replace(/\)\s+\(/g, ')(')
    // Marker replacement leaves stray spaces before punctuation in the source
    // ("jurisdiction . (a)", "section 6.02 ,") — collapse them on both sides.
    .replace(/\s+([.,;:)\]])/g, '$1')
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// A quote "verifies" when its normalized form appears in the normalized
// source. Very short quotes (< 12 chars) are too ambiguous to prove anything
// either way — skip them rather than award false confidence. Long quotes that
// fail whole-string matching get one more chance on their first ~80 chars
// (models often truncate the tail with an ellipsis).
const MIN_QUOTE_CHARS = 12;

function quoteAppearsIn(normQuote, normSource) {
  if (!normQuote || normQuote.length < MIN_QUOTE_CHARS) return null; // unjudgeable
  if (fragmentAppears(normQuote, normSource)) return true;
  // Elided quotes ("granted under a Company Equity Plan ... having an exercise
  // price") verify fragment-by-fragment: every judgeable fragment must appear.
  // Split on 3+ dots: a quote elided right after a sentence ("Effect. ...
  // except") normalizes to four glued dots; splitting on exactly "..." would
  // leave the sentence period stuck to the NEXT fragment (". except…"), which
  // then never matches.
  const frags = normQuote.split(/\s*(?:\.{3,}|…)\s*/).filter((f) => f.length >= MIN_QUOTE_CHARS);
  if (frags.length > 1) {
    return frags.every((f) => fragmentAppears(f, normSource));
  }
  const head = (frags[0] || normQuote).slice(0, 80);
  if (head.length >= MIN_QUOTE_CHARS && normSource.includes(head)) return true;
  if (crossRefAppearsIn(normQuote, normSource)) return true;
  return false;
}

// Exact containment, with ONE narrow tolerance: a quote (or elided-quote
// fragment) that ends in a sentence period where the source sentence keeps
// going ("…the SOX Act." quoted from "…the SOX Act, and any rules…") is a
// truncation artifact, not fabrication — every preceding word still has to
// match verbatim. Only trailing dots are forgiven, and the stripped remainder
// must still clear MIN_QUOTE_CHARS so this can never rescue a stub.
function fragmentAppears(frag, normSource) {
  if (normSource.includes(frag)) return true;
  const stripped = frag.replace(/\.+$/, '');
  return stripped.length !== frag.length
    && stripped.length >= MIN_QUOTE_CHARS
    && normSource.includes(stripped);
}

// Enumerated cross-reference fallback. Agreements compress a run of clause
// references onto ONE section anchor — "a breach of Section 5.01(a), (d), (f),
// (g)" — so only "Section 5.01(a)" ever appears verbatim; (d), (f)… are bare
// paren-clauses. The extractor faithfully expands each into a standalone
// citation ("Section 5.01(f)"), which is true to the document but not a
// contiguous substring, so whole-string matching false-flags it as unverified.
// Verify such a quote structurally: its leading Section<num>(clause) anchor
// must exist AND that specific paren-clause must appear inside the SAME
// enumerated run (bounded to the next section reference so we never borrow a
// "(f)" from unrelated text).
function crossRefAppearsIn(normQuote, normSource) {
  const m = normQuote.match(/^section\s+(\d+(?:\.\d+)*)\s*\(([a-z0-9]{1,4})\)/);
  if (!m) return false;
  const sec = m[1];
  const clause = m[2].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const clauseRe = new RegExp(`\\(${clause}\\)`);
  const anchorRe = new RegExp(`section\\s+${sec.replace(/\./g, '\\.')}\\s*\\(`, 'g');
  let a;
  while ((a = anchorRe.exec(normSource)) !== null) {
    // The enumerated run starts at the anchor and ends at the next section
    // reference (or 350 chars, whichever comes first).
    let run = normSource.slice(a.index, a.index + 350);
    const nextSec = run.slice(1).search(/\bsection\s+\d/);
    if (nextSec !== -1) run = run.slice(0, nextSec + 1);
    if (clauseRe.test(run)) return true;
  }
  return false;
}

// Recursively collect every quote-bearing string from a feature bag.
// Quote-bearing fields, by convention across the codebase:
//   • `quotes: [ "…" ]` arrays inside citable wrappers
//   • legacy citable `{ value, text }` → text
//   • tagged items `{ code, label, text }` → text (meant to be verbatim)
// Plain string VALUES are not quotes (they're often labels/summaries) and are
// not collected.
function collectQuotes(node, path = '', out = []) {
  if (node === null || node === undefined) return out;
  if (Array.isArray(node)) {
    node.forEach((v, i) => collectQuotes(v, `${path}[${i}]`, out));
    return out;
  }
  if (typeof node !== 'object') return out;

  if (Array.isArray(node.quotes)) {
    for (const q of node.quotes) {
      if (typeof q === 'string' && q.trim()) out.push({ path: `${path}.quotes`, quote: q.trim() });
    }
  }
  // {value, text} citable OR {code,label,text} tagged — text is verbatim-intent.
  if (typeof node.text === 'string' && node.text.trim() && ('value' in node || 'code' in node)) {
    out.push({ path: `${path}.text`, quote: node.text.trim() });
  }
  for (const [k, v] of Object.entries(node)) {
    if (k === 'quotes' || k === 'text') continue;
    if (v && typeof v === 'object') collectQuotes(v, path ? `${path}.${k}` : k, out);
  }
  return out;
}

function truncateQuote(q) {
  return q.length > 220 ? `${q.slice(0, 219)}…` : q;
}

function quoteVerifiesAgainstAny(quote, normHaystacks) {
  const haystacks = (normHaystacks || []).filter(Boolean);
  if (haystacks.length === 0) return true;
  const nq = normalizeForMatch(quote);
  let sawJudgeable = false;
  for (const haystack of haystacks) {
    const result = quoteAppearsIn(nq, haystack);
    if (result === true) return true;
    if (result === false) sawJudgeable = true;
  }
  return sawJudgeable ? false : true;
}

function quoteAppearsInAny(quote, normHaystacks) {
  const nq = normalizeForMatch(quote);
  return (normHaystacks || []).some((haystack) => haystack && quoteAppearsIn(nq, haystack) === true);
}

const MAE_SUBSET_CARVEOUT_KEYS = new Set([
  'disproportionateImpactCarveouts',
  'nonDisproportionateImpactCarveouts',
]);

function verifiedCarveoutTextByCode(features, normHaystacks) {
  const byCode = new Map();
  const duplicateCodes = new Set();
  const carveouts = Array.isArray(features && features.carveouts) ? features.carveouts : [];
  for (const item of carveouts) {
    if (!item || typeof item !== 'object') continue;
    const code = typeof item.code === 'string' ? item.code.trim() : '';
    const text = typeof item.text === 'string' ? item.text.trim() : '';
    if (!code || !text || !quoteAppearsInAny(text, normHaystacks)) continue;
    if (byCode.has(code)) {
      duplicateCodes.add(code);
      continue;
    }
    byCode.set(code, text);
  }
  for (const code of duplicateCodes) byCode.delete(code);
  return byCode;
}

function repairMaeSubsetCarveoutQuotes(features, normHaystacks, details) {
  const byCode = verifiedCarveoutTextByCode(features, normHaystacks);
  if (byCode.size === 0) return 0;
  let repaired = 0;
  for (const key of MAE_SUBSET_CARVEOUT_KEYS) {
    const items = Array.isArray(features[key]) ? features[key] : [];
    items.forEach((item, i) => {
      if (!item || typeof item !== 'object') return;
      const code = typeof item.code === 'string' ? item.code.trim() : '';
      const text = typeof item.text === 'string' ? item.text.trim() : '';
      if (!code || !text || quoteVerifiesAgainstAny(text, normHaystacks)) return;
      const replacement = byCode.get(code);
      if (!replacement) return;
      item.text = replacement;
      repaired += 1;
      details.push({
        path: `${key}[${i}].text`,
        quote: truncateQuote(text),
        replacement: truncateQuote(replacement),
        action: 'replaced_with_verified_carveout_quote',
      });
    });
  }
  return repaired;
}

/**
 * Remove quote-bearing feature strings that cannot be verified against the
 * source text or provision text. Values/codes stay; only unverifiable evidence
 * strings are removed so QA cannot later trust a paraphrase as a quote.
 */
function sanitizeFeatureQuotes(features, sourceText, opts = {}) {
  const details = [];
  if (!features || typeof features !== 'object') {
    return { features, removed: 0, details };
  }

  const normSource = typeof opts.normalizedSource === 'string'
    ? opts.normalizedSource
    : normalizeForMatch(sourceText || '');
  const normProvision = typeof opts.normalizedProvisionText === 'string'
    ? opts.normalizedProvisionText
    : normalizeForMatch(opts.provisionText || '');
  const normHaystacks = [normSource, normProvision].filter(Boolean);
  let removed = 0;
  const repaired = repairMaeSubsetCarveoutQuotes(features, normHaystacks, details);

  const keepQuote = (quote, path) => {
    const trimmed = typeof quote === 'string' ? quote.trim() : '';
    if (!trimmed) return true;
    if (quoteVerifiesAgainstAny(trimmed, normHaystacks)) return true;
    details.push({
      path,
      quote: truncateQuote(trimmed),
      action: 'removed_unverified_quote',
    });
    removed += 1;
    return false;
  };

  const walk = (node, path = '') => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, `${path}[${i}]`));
      return;
    }

    if (Array.isArray(node.quotes)) {
      const next = [];
      node.quotes.forEach((quote, i) => {
        if (typeof quote !== 'string') {
          next.push(quote);
          return;
        }
        if (keepQuote(quote, `${path}.quotes[${i}]`)) next.push(quote.trim());
      });
      node.quotes = next;
    }

    if (typeof node.text === 'string' && node.text.trim() && ('value' in node || 'code' in node)) {
      if (!keepQuote(node.text, `${path}.text`)) node.text = null;
    }

    for (const [k, v] of Object.entries(node)) {
      if (k === 'quotes' || k === 'text') continue;
      if (v && typeof v === 'object') walk(v, path ? `${path}.${k}` : k);
    }
  };

  walk(features);
  return { features, removed, repaired, details };
}

/**
 * Verify every quote across a deal's provisions against the source text.
 * @param {Array} provisions — rows with { id, type, category, full_text, ai_metadata }
 * @param {string} sourceText — the deal's full agreement text
 * @returns {{ total, verified, unverified, skipped, failures: [...] }}
 */
function verifyDealQuotes(provisions, sourceText) {
  const normSource = normalizeForMatch(sourceText || '');
  let total = 0;
  let verified = 0;
  let skipped = 0;
  const failures = [];

  for (const p of provisions || []) {
    const meta = p && p.ai_metadata && typeof p.ai_metadata === 'object' ? p.ai_metadata : {};
    const feats = meta.features && typeof meta.features === 'object' ? meta.features : {};
    const quotes = collectQuotes(feats);
    if (quotes.length === 0) continue;
    const normProvText = normalizeForMatch(p.full_text || '');

    for (const { path, quote } of quotes) {
      total += 1;
      const nq = normalizeForMatch(quote);
      const inSource = quoteAppearsIn(nq, normSource);
      if (inSource === null) { skipped += 1; continue; }
      if (inSource) { verified += 1; continue; }
      failures.push({
        provision_id: p.id,
        type: p.type,
        category: p.category,
        feature_path: path,
        quote: quote.length > 220 ? `${quote.slice(0, 219)}…` : quote,
        // Weaker signal recorded for triage: does it at least appear in the
        // provision's own captured text? (If yes, the SOURCE text is likely
        // stale/differently-normalized rather than the quote invented.)
        in_provision_text: quoteAppearsIn(nq, normProvText) === true,
      });
    }
  }

  return { total, verified, unverified: failures.length, skipped, failures };
}

/* ── Ancillary-document exclusion ──────────────────────────────────────────
   An SEC merger-agreement filing bundles, after the operative agreement's
   signature block, a stack of ATTACHED documents that are NOT merger-agreement
   provisions we extract: the CVR agreement, support/voting/tender agreements,
   forms of certificate/letter, disclosure schedules, registration-rights and
   escrow agreements. Counting them in the coverage denominator understates
   coverage — Metsera's whole CVR agreement (~59k chars, its own definitions +
   payment mechanics) read as one giant "uncovered gap".

   We exclude those spans from the denominator, but KEEP back-of-document
   DEFINITIONS appendices (Landos's "Exhibit A — Certain Definitions", ~105
   terms we DO extract). Detection is gated to at-or-after the operative
   agreement's first signature block so in-body defined-term references
   ("...the Contingent Value Rights Agreement...") never trigger it. */

// Titles of attached agreements. To QUALIFY as a real attached document (not a
// defined-term reference like "...the Voting Agreement..."), an occurrence must
// be followed closely by agreement-preamble language (see PREAMBLE below).
const ANCILLARY_AGREEMENT_TITLES = [
  'contingent value rights agreement',
  'tender and support agreement',
  'voting and support agreement',
  'voting agreement',
  'support agreement',
  'investor rights agreement',
  'exchange agreement',
  'tax receivable agreement',
  'registration rights agreement',
  'escrow agreement',
];
// Preamble language that only a real executed/attached agreement carries.
const PREAMBLE = /(dated as of|by and between|by and among|is (?:made and )?entered into|is being executed and delivered|made and entered into)/;
// Charter / bylaws EXHIBITS (the form of the surviving corporation's articles
// of incorporation or bylaws attached as Exhibit A/B). These carry NO
// agreement preamble, so they need their own qualifier: corporate-charter
// boilerplate within a short window of the header (CSRA's attached Nevada
// articles+bylaws were 56k chars of "registered office / authorized shares /
// offices ... within or without the state" counted against coverage).
const CHARTER_EXHIBIT_TITLES = [
  'articles of incorporation',
  'certificate of incorporation',
  'certificate of designations',
  'amended and restated bylaws',
  'bylaws of',
  'by-laws of',
];
const CHARTER_BOILERPLATE = /(registered (?:office|agent)|name of the corporation|authorized[\s\S]{0,60}shares|series\s+[a-z]\s+(?:cumulative\s+)?(?:redeemable\s+)?preferred stock|does hereby certify|principal office|offices[\s\S]{0,80}(?:within or without|without the state)|article i\b)/;
// A KEPT definitions appendix (integral — we extract it). If one starts after
// the first attached agreement, it re-breaks the excluded tail.
const DEF_APPENDIX_HEADERS = ['certain definitions', 'index of defined terms'];

function looksLikeKeptDefinitionAppendix(normSource, idx, phrase) {
  const after = normSource.slice(idx, idx + 120);
  if (phrase === 'certain definitions' && /\bcertain definitions\s+for purposes of\s+(?:this\s+)?article\b/.test(after)) {
    return false;
  }
  return true;
}

/**
 * Detect attached-ancillary spans to exclude from the coverage denominator.
 * Model: the operative agreement ends at its first signature block; the first
 * REAL attached agreement after it (title + nearby preamble) begins the
 * exhibit stack, which runs to EOF. A definitions appendix beginning later in
 * that tail is carved back out (kept). Returns merged [start, end, label].
 */
function detectAncillaryRegions(normSource) {
  const srcLen = normSource.length;
  const sigMatch = normSource.match(/in witness whereof[\s\S]{0,400}?(?:executed|caused this[\s\S]{0,80}?to be executed)/)
    || normSource.match(/\[?\s*signature page to [^\]\n]{3,120}\]?/);
  if (!sigMatch) return [];
  const sigStart = sigMatch.index;
  const sigEnd = sigMatch.index + sigMatch[0].length;
  const signaturePageMarker = /\bsignature page to\b/.test(sigMatch[0]);
  const scanFrom = Math.max(sigEnd, Math.floor(srcLen * 0.4));

  // Earliest QUALIFIED attached-agreement header at/after the signature.
  let firstStart = -1;
  let firstLabel = null;
  for (const title of ANCILLARY_AGREEMENT_TITLES) {
    let from = scanFrom;
    let i;
    while ((i = normSource.indexOf(title, from)) !== -1) {
      // Real attached agreement iff a preamble phrase sits within ~160 chars.
      if (PREAMBLE.test(normSource.slice(i, i + 160))) {
        if (firstStart === -1 || i < firstStart) { firstStart = i; firstLabel = title; }
        break; // earliest occurrence of THIS title is enough
      }
      from = i + title.length;
    }
  }
  // Charter/bylaws exhibit forms: header + charter boilerplate within ~600
  // chars qualifies (no agreement preamble exists on these).
  for (const title of CHARTER_EXHIBIT_TITLES) {
    let from = scanFrom;
    let i;
    while ((i = normSource.indexOf(title, from)) !== -1) {
      if (CHARTER_BOILERPLATE.test(normSource.slice(i, i + 600))) {
        if (firstStart === -1 || i < firstStart) { firstStart = i; firstLabel = title; }
        break;
      }
      from = i + title.length;
    }
  }
  if (firstStart === -1) return [];
  const exclusionStart = signaturePageMarker ? Math.min(sigStart, firstStart) : firstStart;

  // Excluded tail = [firstStart, EOF), minus any definitions appendix that
  // starts within it (carved back so integral defs stay counted). Carve out
  // ONLY the appendix span — NOT everything after it. Kraft's tail runs
  // charter exhibit → index of defined terms → by-laws → tax opinions;
  // ending the exclusion at the index header put ~200k of by-laws/opinions
  // back in the denominator (coverage 59.6% on a fully-extracted deal).
  let defStart = -1;
  for (const ph of DEF_APPENDIX_HEADERS) {
    let from = firstStart;
    let di;
    while ((di = normSource.indexOf(ph, from)) !== -1) {
      if (looksLikeKeptDefinitionAppendix(normSource, di, ph)) {
        if (defStart === -1 || di < defStart) defStart = di;
        break;
      }
      from = di + ph.length;
    }
  }
  if (defStart === -1) {
    if (srcLen - exclusionStart < 2000) return []; // too small to matter
    return [[exclusionStart, srcLen, firstLabel]];
  }

  // Appendix end: the next exhibit-like header after it, capped — a defined-
  // terms appendix/index is a few pages, never tens of thousands of chars.
  const DEF_APPENDIX_MAX_CHARS = 25000;
  let defEnd = Math.min(srcLen, defStart + DEF_APPENDIX_MAX_CHARS);
  for (const t of [...CHARTER_EXHIBIT_TITLES, ...ANCILLARY_AGREEMENT_TITLES]) {
    const i = normSource.indexOf(t, defStart + 40);
    if (i !== -1 && i < defEnd) defEnd = i;
  }

  const spans = [];
  if (defStart - exclusionStart >= 2000) spans.push([exclusionStart, defStart, firstLabel]);
  if (srcLen - defEnd >= 2000) spans.push([defEnd, srcLen, firstLabel]);
  return spans;
}

// Total length of [start,end,...] spans.
function spansLength(spans) {
  let n = 0;
  for (const [s, e] of spans) n += e - s;
  return n;
}

// True if index falls inside any [start,end) span.
function inSpans(idx, spans) {
  for (const [s, e] of spans) if (idx >= s && idx < e) return true;
  return false;
}

function objectValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function provisionMetadata(provision) {
  return objectValue(provision && provision.ai_metadata);
}

function provisionFeatures(provision) {
  return objectValue(provisionMetadata(provision).features);
}

function firstPresent(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return null;
}

function baseSectionNumber(value) {
  if (value === undefined || value === null) return null;
  const match = String(value).match(/\b(?:section\s*)?(\d{1,2}\.\d{1,3})(?:\b|\()/i);
  return match ? match[1] : null;
}

function provisionHintText(provision) {
  const metadata = provisionMetadata(provision);
  const features = provisionFeatures(provision);
  return [
    provision && provision.type,
    provision && provision.category,
    provision && provision.full_text,
    provision && provision.text,
    metadata.code,
    features.canonicalCode,
    features.sectionNumber,
    features.section_number,
    features.sourceSection,
    features.source_section,
    features.mainConcept,
    features.standstillWaiverConditions,
    features.ceaseDiscussionsLiability,
    features.representativeBreachConditions,
  ].filter(Boolean).join(' ');
}

function inferredSectionBase(provision) {
  const metadata = provisionMetadata(provision);
  const features = provisionFeatures(provision);
  const explicit = firstPresent(
    provision && provision.section_number,
    provision && provision.sectionNumber,
    metadata.section_number,
    metadata.sectionNumber,
    features.section_number,
    features.sectionNumber,
    features.sourceSection,
    features.source_section,
  );
  const fromField = baseSectionNumber(explicit);
  if (fromField) return fromField;

  const type = String(provision && provision.type || '').toUpperCase();
  if (!/^IOC(?:-|$)|^NOSOL(?:-|$)/.test(type)) return null;

  const text = provisionHintText(provision);
  const fromText = baseSectionNumber(text.match(/\bsection\s+\d{1,2}\.\d{1,3}(?:\([a-z0-9]+\))?/i)?.[0]);
  if (fromText) return fromText;

  if (/^IOC-B$/.test(type)) return '6.2';
  if (/^IOC-T$/.test(type)) return '6.1';
  if (/^NOSOL-B$/.test(type)) return '6.4';
  if (/^NOSOL-T$/.test(type)) return '6.3';

  if (type === 'NOSOL') {
    const parentStrong = /\bParent\s+(?:Board|Stockholder Approval|Competing Proposal|Superior Proposal|Intervening Event)\b/i.test(text)
      || /\bParent\s+(?:may|shall|represents?|warrants?)\b/i.test(text);
    const companyStrong = /\bCompany\s+(?:Board|Stockholder Approval|Competing Proposal|Superior Proposal|Intervening Event)\b/i.test(text)
      || /\bCompany\s+(?:may|shall|represents?|warrants?)\b/i.test(text);
    if (parentStrong && !companyStrong) return '6.4';
    if (companyStrong && !parentStrong) return '6.3';
  }

  return null;
}

function sectionHeadingNeedles(base, provision) {
  if (!base) return [];
  const type = String(provision && provision.type || '').toUpperCase();
  const text = provisionHintText(provision);
  const parentish = /\bParent\b|\bBuyer\b/i.test(text) || /-B$/.test(type);
  const companyish = /\bCompany\b|\bTarget\b|\bSeller\b/i.test(text) || /-T$/.test(type);
  const out = [];

  if (/^IOC(?:-|$)/.test(type)) {
    if (parentish || base === '6.2') {
      out.push(`${base} conduct of parent business pending`);
      out.push(`${base} conduct of buyer business pending`);
      out.push(`${base} conduct of parent business`);
    }
    if (companyish || base === '6.1') {
      out.push(`${base} conduct of company business pending`);
      out.push(`${base} conduct of target business pending`);
      out.push(`${base} conduct of company business`);
    }
  }

  if (/^NOSOL(?:-|$)/.test(type)) {
    if (parentish || base === '6.4') {
      out.push(`${base} no solicitation by parent`);
      out.push(`${base} no solicitation by buyer`);
    }
    if (companyish || base === '6.3') {
      out.push(`${base} no solicitation by the company`);
      out.push(`${base} no solicitation by company`);
      out.push(`${base} no solicitation by target`);
    }
    out.push(`${base} no solicitation`);
  }

  return [...new Set(out.map((needle) => normalizeForMatch(needle)).filter(Boolean))];
}

function allIndexesOf(source, needle) {
  const hits = [];
  if (!source || !needle) return hits;
  let idx = -1;
  while ((idx = source.indexOf(needle, idx + 1)) !== -1) hits.push(idx);
  return hits;
}

function sectionHeadingHits(normSource, provision) {
  const base = inferredSectionBase(provision);
  const hits = [];
  for (const needle of sectionHeadingNeedles(base, provision)) {
    for (const idx of allIndexesOf(normSource, needle)) hits.push(idx);
  }
  return [...new Set(hits)].sort((a, b) => a - b);
}

function startCharHint(provision, sourceText) {
  const metadata = provisionMetadata(provision);
  const raw = firstPresent(
    provision && provision.start_char,
    provision && provision.startChar,
    metadata.start_char,
    metadata.startChar,
  );
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return -1;
  return normalizeForMatch(String(sourceText || '').slice(0, n)).length;
}

function chooseHitAfterNearestHeading(hits, headingHits) {
  let best = null;
  for (const heading of headingHits || []) {
    const hit = hits.find((candidate) => candidate >= heading);
    if (hit === undefined) continue;
    const distance = hit - heading;
    if (!best || distance < best.distance) best = { hit, distance };
  }
  return best ? best.hit : null;
}

function locateProvisionInSource(provision, sourceText, opts = {}) {
  const normSource = typeof opts.normalizedSource === 'string'
    ? opts.normalizedSource
    : normalizeForMatch(sourceText || '');
  const norm = normalizeForMatch(provision && provision.full_text ? provision.full_text : '');
  if (norm.length < 30) return null;

  const needle = norm.slice(0, Math.min(160, norm.length));
  const hits = allIndexesOf(normSource, needle);
  if (hits.length === 0) return null;

  let idx = chooseHitAfterNearestHeading(hits, sectionHeadingHits(normSource, provision));
  if (idx === null) {
    const hint = startCharHint(provision, sourceText);
    if (hint >= 0) {
      idx = hits.find((candidate) => candidate >= hint);
      if (idx === undefined) {
        idx = hits.reduce((best, candidate) => (
          Math.abs(candidate - hint) < Math.abs(best - hint) ? candidate : best
        ), hits[0]);
      }
    }
  }
  if (idx === null || idx === undefined) idx = hits[0];

  return {
    start: idx,
    end: Math.min(normSource.length, idx + norm.length),
    length: norm.length,
    hitCount: hits.length,
  };
}

/**
 * Coverage: locate each provision's full_text in the normalized source, merge
 * intervals, report covered % + the largest uncovered gaps.
 *
 * The denominator EXCLUDES attached ancillary documents (CVR agreement, forms,
 * schedules) so coverage reflects the operative merger agreement, not the
 * exhibit stack. Pass opts.includeAncillary=true to measure the raw filing.
 *
 * Provisions were substringed from the cleaned source, so a normalized prefix
 * match is reliable. Overlaps (preamble vs. sub-clauses, DEF entries inside
 * section text) are handled by interval merging.
 */
function computeCoverage(provisions, sourceText, opts = {}) {
  const minGapChars = opts.minGapChars || 400;
  const maxGaps = opts.maxGaps || 10;
  const normSource = normalizeForMatch(sourceText || '');
  const srcLen = normSource.length;
  if (!srcLen) return { sourceChars: 0, coveredChars: 0, pct: 0, located: 0, unlocated: 0, gaps: [], excludedChars: 0, excludedRegions: [] };

  const ancillary = opts.includeAncillary ? [] : detectAncillaryRegions(normSource);
  const excludedChars = spansLength(ancillary);
  const effectiveLen = Math.max(1, srcLen - excludedChars);

  const intervals = [];
  let located = 0;
  let unlocated = 0;

  for (const p of provisions || []) {
    const locatedProvision = locateProvisionInSource(p, sourceText, { normalizedSource: normSource });
    if (!locatedProvision) { unlocated += 1; continue; }
    located += 1;
    intervals.push([locatedProvision.start, locatedProvision.end]);
  }

  intervals.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const [s, e] of intervals) {
    if (merged.length && s <= merged[merged.length - 1][1]) {
      merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], e);
    } else {
      merged.push([s, e]);
    }
  }

  // Covered chars two ways: total (whole filing) and effective (only text
  // OUTSIDE excluded ancillary spans — a CVR definition we happened to code
  // must not pad coverage of a region removed from the denominator).
  let coveredTotal = 0;
  let covered = 0;
  for (const [s, e] of merged) {
    coveredTotal += e - s;
    covered += overlapOutside(s, e, ancillary);
  }

  // Uncovered gaps — skip any gap that falls entirely inside an excluded
  // ancillary region (those are not "missed", they're out of scope).
  const gaps = [];
  let cursor = 0;
  const pushGap = (s, e) => {
    if (e - s < minGapChars) return;
    const mid = Math.floor((s + e) / 2);
    if (inSpans(mid, ancillary)) return; // gap sits in excluded ancillary text
    gaps.push({ start: s, length: e - s, preview: `${normSource.slice(s, s + 240).trim()}…` });
  };
  for (const [s, e] of merged) {
    pushGap(cursor, s);
    cursor = Math.max(cursor, e);
  }
  pushGap(cursor, srcLen);
  gaps.sort((a, b) => b.length - a.length);

  return {
    sourceChars: srcLen,
    coveredChars: covered,
    pct: Math.round((covered / effectiveLen) * 1000) / 10,
    // Raw coverage over the full filing (ancillary included), for transparency.
    rawPct: Math.round((coveredTotal / srcLen) * 1000) / 10,
    located,
    unlocated,
    gaps: gaps.slice(0, maxGaps),
    excludedChars,
    excludedRegions: ancillary.map(([s, e, label]) => ({ start: s, length: e - s, label })),
  };
}

// Length of [s,e) that lies OUTSIDE all excluded spans.
function overlapOutside(s, e, spans) {
  if (!spans.length) return e - s;
  let total = e - s;
  for (const [xs, xe] of spans) {
    const lo = Math.max(s, xs);
    const hi = Math.min(e, xe);
    if (hi > lo) total -= hi - lo;
  }
  return Math.max(0, total);
}

module.exports = {
  normalizeForMatch,
  quoteAppearsIn,
  collectQuotes,
  sanitizeFeatureQuotes,
  verifyDealQuotes,
  computeCoverage,
  locateProvisionInSource,
  detectAncillaryRegions,
  MIN_QUOTE_CHARS,
};
